#!/usr/bin/env python3
"""Real two-session Packet D integration test. NEVER run on a hosted database.

Requires an isolated PostgreSQL/Supabase schema plus seeded approved identities:
  KRISTOU_D_ISOLATED_DSN = postgresql://postgres:...@127.0.0.1:5432/kristou_packet_d_<suffix>
  KRISTOU_D_OWNER_UID    = approved APP_ADMIN profile/auth.users UUID
  KRISTOU_D_MEMBER_UID   = approved ordinary PARENT/STUDENT/TEACHER profile UUID
  KRISTOU_D_CLASS_ID     = class the member CANNOT access (owner CAN access)

Install psycopg[binary] in the disposable test runner, not application dependencies.
Run ONLY after installing the new forward migration on the isolated database.
"""

from __future__ import annotations

import os
import sys
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import date, timedelta
from urllib.parse import urlsplit

try:
    import psycopg
    from psycopg.rows import dict_row
except ImportError:
    sys.exit("BLOCKED: psycopg v3 is required in the isolated test runner (not installed).")


def require_local_dsn() -> str:
    dsn = os.environ.get("KRISTOU_D_ISOLATED_DSN", "")
    parsed = urlsplit(dsn)
    if (
        parsed.scheme not in {"postgres", "postgresql"}
        or parsed.hostname not in {"localhost", "127.0.0.1", "::1"}
        or not parsed.path.lstrip("/").startswith("kristou_packet_d_")
    ):
        sys.exit("BLOCKED: use a local TCP PostgreSQL database named kristou_packet_d_*; hosted DSNs prohibited")
    return dsn


def require_uuid(name: str) -> uuid.UUID:
    try:
        return uuid.UUID(os.environ[name])
    except (KeyError, ValueError) as exc:
        sys.exit(f"BLOCKED: expected seeded isolated fixture UUID in {name}: {exc}")


def privileged(dsn: str):
    return psycopg.connect(dsn, autocommit=True, row_factory=dict_row)


def actor(dsn: str, uid: uuid.UUID | None):
    conn = privileged(dsn)
    conn.execute("SET ROLE authenticated")
    conn.execute("SELECT set_config('request.jwt.claim.sub', %s, false)", (str(uid) if uid else "",))
    conn.execute("SET statement_timeout = '12000ms'")
    return conn


def call(conn, function: str, *args):
    """Invoke the real installed function; only fixed whitelisted identifiers."""
    allowed = {
        "respond_to_calendar_event": 2,
        "cancel_school_calendar_event": 2,
        "upsert_school_calendar_event": 8,
    }
    assert function in allowed and len(args) == allowed[function]
    params = ", ".join(["%s"] * len(args))
    return conn.execute(f"SELECT * FROM public.{function}({params})", args).fetchone()


def expect_error(code: str, operation):
    try:
        operation()
    except psycopg.Error as exc:
        assert code in str(exc), f"Expected {code!r}, got {exc!r}"
    else:
        raise AssertionError(f"Expected DB exception {code!r}; operation succeeded")


def wait_for_row_lock(admin, backend_pid: int):
    deadline = time.monotonic() + 5.0
    while time.monotonic() < deadline:
        row = admin.execute(
            "SELECT wait_event_type FROM pg_catalog.pg_stat_activity WHERE pid = %s", (backend_pid,)
        ).fetchone()
        if row and row["wait_event_type"] == "Lock":
            return
        time.sleep(0.05)
    raise AssertionError(f"Second PostgreSQL session {backend_pid} did not block on an event-row lock")


def make_event(dsn: str, creator: uuid.UUID, created: list[uuid.UUID], *, class_id=None):
    day = date.today() + timedelta(days=14)
    with actor(dsn, creator) as conn:
        row = call(
            conn, "upsert_school_calendar_event",
            f"Packet D isolated race {uuid.uuid4().hex[:10]}", "Isolated verification only",
            "EVENT", day, day, class_id, True, False,
        )
    event_id = row["id"]
    assert row["status"] == "SCHEDULED"
    created.append(event_id)
    return event_id


def read_response(conn, event_id):
    return conn.execute(
        "SELECT response FROM public.school_calendar_responses WHERE event_id = %s", (event_id,)
    ).fetchall()


def test_active_and_retries(dsn, owner, member, created):
    event_id = make_event(dsn, owner, created)
    with actor(dsn, member) as conn:
        for answer in ("ATTENDING", "ACKNOWLEDGED", "DECLINED", "DECLINED"):
            row = call(conn, "respond_to_calendar_event", event_id, answer)
            assert row["response"] == answer
            assert [r["response"] for r in read_response(conn, event_id)] == [answer]
    print("PASS active event, all three RSVP choices and repeated upsert: 1 response row")


def test_cancelled_and_retry(dsn, owner, member, created):
    event_id = make_event(dsn, owner, created)
    with actor(dsn, owner) as creator:
        cancelled = call(creator, "cancel_school_calendar_event", event_id, "First cancellation")
        again = call(creator, "cancel_school_calendar_event", event_id, "Duplicate request")
        assert cancelled["status"] == again["status"] == "CANCELLED"
        assert again["cancellation_reason"] == "First cancellation"
        assert again["updated_at"] == cancelled["updated_at"]
    with actor(dsn, member) as respondent:
        expect_error("calendar_event_cancelled", lambda: call(respondent, "respond_to_calendar_event", event_id, "ATTENDING"))
        assert not read_response(respondent, event_id)
    print("PASS cancelled-event rejection and idempotent cancellation retry")


def test_denial(dsn, owner, member, class_id, created):
    event_id = make_event(dsn, owner, created, class_id=class_id)
    with actor(dsn, member) as wrong_class:
        expect_error("insufficient_authority", lambda: call(wrong_class, "respond_to_calendar_event", event_id, "DECLINED"))
    global_event_id = make_event(dsn, owner, created)
    with actor(dsn, uuid.uuid4()) as not_approved:
        expect_error("actor_not_approved", lambda: call(not_approved, "respond_to_calendar_event", global_event_id, "ATTENDING"))
    with actor(dsn, None) as unauthenticated:
        expect_error("actor_unauthenticated", lambda: call(unauthenticated, "respond_to_calendar_event", global_event_id, "ATTENDING"))
    with actor(dsn, member) as respondent:
        expect_error("target_not_found", lambda: call(respondent, "respond_to_calendar_event", uuid.uuid4(), "ATTENDING"))
    print("PASS wrong-class, unapproved, unauthenticated and unknown-event denial")


def test_cancel_commits_before_response(dsn, admin, owner, member, created):
    event_id = make_event(dsn, owner, created)
    cancelling = actor(dsn, owner)
    responding = actor(dsn, member)
    try:
        cancelling.execute("BEGIN")
        row = call(cancelling, "cancel_school_calendar_event", event_id, "Race cancellation")
        assert row["status"] == "CANCELLED"
        with ThreadPoolExecutor(max_workers=1) as pool:
            blocked = pool.submit(call, responding, "respond_to_calendar_event", event_id, "ATTENDING")
            wait_for_row_lock(admin, responding.info.backend_pid)
            cancelling.execute("COMMIT")
            try:
                blocked.result(timeout=10)
            except psycopg.Error as exc:
                assert "calendar_event_cancelled" in str(exc), f"Expected cancelled rejection after row-lock wait, got: {exc}"
            else:
                raise AssertionError("Response incorrectly succeeded after cancellation won the lock")
    finally:
        cancelling.execute("ROLLBACK")
        cancelling.close()
        responding.close()
    print("PASS two-session race: cancellation wins; waiting response rejected")


def test_response_commits_before_cancel(dsn, admin, owner, member, created):
    event_id = make_event(dsn, owner, created)
    responding = actor(dsn, member)
    cancelling = actor(dsn, owner)
    try:
        responding.execute("BEGIN")
        assert call(responding, "respond_to_calendar_event", event_id, "ACKNOWLEDGED")["response"] == "ACKNOWLEDGED"
        with ThreadPoolExecutor(max_workers=1) as pool:
            blocked = pool.submit(call, cancelling, "cancel_school_calendar_event", event_id, "Race cancellation")
            wait_for_row_lock(admin, cancelling.info.backend_pid)
            responding.execute("COMMIT")
            assert blocked.result(timeout=10)["status"] == "CANCELLED"
        with actor(dsn, member) as reader:
            assert [r["response"] for r in read_response(reader, event_id)] == ["ACKNOWLEDGED"]
            expect_error("calendar_event_cancelled", lambda: call(reader, "respond_to_calendar_event", event_id, "DECLINED"))
    finally:
        responding.execute("ROLLBACK")
        responding.close()
        cancelling.close()
    print("PASS two-session race: response wins; later cancellation succeeds; subsequent response denied")


def main():
    dsn = require_local_dsn()
    owner = require_uuid("KRISTOU_D_OWNER_UID")
    member = require_uuid("KRISTOU_D_MEMBER_UID")
    class_id = require_uuid("KRISTOU_D_CLASS_ID")
    assert owner != member, "Owner and member fixtures must be different identities"
    created = []
    with privileged(dsn) as admin:
        db = admin.execute("SELECT current_database() AS name, current_setting('is_superuser') AS su").fetchone()
        assert db["name"].startswith("kristou_packet_d_") and db["su"] == "on", "Disposable DB and privileged local observer required"
        with actor(dsn, owner) as creator:
            role = creator.execute("SELECT public.current_user_has_role('APP_ADMIN'::public.app_role) AS allowed").fetchone()
            assert role["allowed"], "Owner fixture requires approved APP_ADMIN role assignment"
        with actor(dsn, member) as respondent:
            flags = respondent.execute(
                "SELECT public.is_approved_school_member() AS approved, public.can_access_class(%s) AS has_class", (class_id,)
            ).fetchone()
            assert flags["approved"] and not flags["has_class"], "Member must be approved but unrelated to fixture class"
        try:
            test_active_and_retries(dsn, owner, member, created)
            test_cancelled_and_retry(dsn, owner, member, created)
            test_denial(dsn, owner, member, class_id, created)
            test_cancel_commits_before_response(dsn, admin, owner, member, created)
            test_response_commits_before_cancel(dsn, admin, owner, member, created)
        finally:
            if created:
                admin.execute("DELETE FROM public.school_calendar_events WHERE id = ANY(%s::uuid[])", (created,))
    print("PASS Packet D: five real-DB scenarios completed; fixture events cleaned up")


if __name__ == "__main__":
    main()
