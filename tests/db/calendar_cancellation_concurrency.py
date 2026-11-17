#!/usr/bin/env python3
"""Packet D: real two-session PostgreSQL integration verification.

Use ONLY against a disposable, EMPTY, isolated database containing the existing
KRISTOU schema and the forward Packet D migration. Never use the production DB.
The runner creates real synthetic auth.users/profiles/role_assignments/class
fixtures, calls the installed SECURITY DEFINER RPCs as `authenticated`, verifies
committed state as a privileged observer, and cleans up ONLY its own fixtures.

Dependency in the isolated test runner: psycopg >= 3; not an app dependency.
See tests/db/README.calendar-cancellation.md for environment and commands.
"""
from __future__ import annotations

import json
import os
import re
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
    sys.exit("BLOCKED: install psycopg[binary] in the isolated test runner; not installed")

PRODUCTION_REF = "ofppapwofhovhroyjtkc"
ACK_VALUE = "YES_DISPOSABLE_SYNTHETIC_ONLY"
REQUIRED_RESPONSES = ("ATTENDING", "ACKNOWLEDGED", "DECLINED")


def require_isolated_target() -> str:
    dsn = os.environ.get("KRISTOU_D_ISOLATED_DSN", "")
    mode = os.environ.get("KRISTOU_D_ISOLATION_MODE", "")
    parsed = urlsplit(dsn)
    if os.environ.get("KRISTOU_D_CONFIRM_ISOLATED") != ACK_VALUE:
        sys.exit("BLOCKED: KRISTOU_D_CONFIRM_ISOLATED must equal YES_DISPOSABLE_SYNTHETIC_ONLY")
    if parsed.scheme not in ("postgres", "postgresql") or not parsed.hostname or not parsed.path:
        sys.exit("BLOCKED: valid PostgreSQL URI for an isolated database required")
    host = parsed.hostname.lower()
    database = parsed.path.lstrip("/")
    if PRODUCTION_REF in dsn.lower():
        sys.exit("BLOCKED: production project ref occurs in DSN")
    if mode == "local":
        named_disposable = re.fullmatch(r"kristou_packet_d_[a-z0-9_]+", database)
        dedicated_supabase_stack = (
            database == "postgres"
            and os.environ.get("KRISTOU_D_LOCAL_DEDICATED_SUPABASE") == "YES_NEW_EMPTY_LOCAL_STACK"
        )
        if host not in ("localhost", "127.0.0.1", "::1") or not (named_disposable or dedicated_supabase_stack):
            sys.exit("BLOCKED: local mode requires loopback plus a named disposable DB or explicitly dedicated local Supabase stack")
    elif mode == "supabase_branch":
        ref = os.environ.get("KRISTOU_D_BRANCH_REF", "").lower()
        if not re.fullmatch(r"[a-z0-9]{20}", ref) or ref == PRODUCTION_REF:
            sys.exit("BLOCKED: an explicit non-production 20-character Supabase branch project ref required")
        if host != f"db.{ref}.supabase.co" or database != "postgres":
            sys.exit("BLOCKED: branch mode requires direct DB host matching its isolated project ref")
    else:
        sys.exit("BLOCKED: KRISTOU_D_ISOLATION_MODE must be local or supabase_branch")
    return dsn


def privileged(dsn: str):
    return psycopg.connect(dsn, autocommit=True, row_factory=dict_row)


def actor(dsn: str, uid: uuid.UUID | None):
    """Exercise the same DB role and auth.uid() as an ordinary RPC caller."""
    conn = privileged(dsn)
    conn.execute("SET ROLE authenticated")
    conn.execute("SELECT set_config('request.jwt.claim.sub', %s, false)", (str(uid) if uid else "",))
    conn.execute("SET statement_timeout TO '20000ms'")
    conn.execute("SET SESSION CHARACTERISTICS AS TRANSACTION ISOLATION LEVEL READ COMMITTED")
    return conn


def call(conn, function: str, *args):
    allowed = {
        "respond_to_calendar_event": 2,
        "cancel_school_calendar_event": 2,
        "upsert_school_calendar_event": 8,
    }
    if allowed.get(function) != len(args):
        raise AssertionError("unexpected RPC or arguments")
    params = ", ".join(["%s"] * len(args))
    return conn.execute(f"SELECT * FROM public.{function}({params})", args).fetchone()


def expect_error(expected: str, callback, sqlstate: str = "P0001"):
    try:
        callback()
    except psycopg.Error as exc:
        assert exc.sqlstate == sqlstate, f"Expected SQLSTATE {sqlstate}, got {exc.sqlstate}: {exc}"
        assert expected in str(exc), f"Expected {expected!r}, got {exc!r}"
    else:
        raise AssertionError(f"Expected DB rejection: {expected}")


def assert_empty_disposable_database(admin, mode: str):
    db = admin.execute("SELECT current_database() AS name").fetchone()["name"]
    if mode == "local" and not (
        db.startswith("kristou_packet_d_")
        or (db == "postgres" and os.environ.get("KRISTOU_D_LOCAL_DEDICATED_SUPABASE") == "YES_NEW_EMPTY_LOCAL_STACK")
    ):
        raise AssertionError("connected database does not match isolated local target")
    if mode == "supabase_branch" and db != "postgres":
        raise AssertionError("unexpected branch database")
    for table in ("auth.users", "public.profiles", "public.school_calendar_events"):
        count = admin.execute(f"SELECT count(*) AS count FROM {table}").fetchone()["count"]
        assert count == 0, f"Isolation failure: {table} contains {count} existing rows (no changes made)"
    # Run only if the expected historical base and the new migration exist.
    for function in ("respond_to_calendar_event", "cancel_school_calendar_event", "upsert_school_calendar_event"):
        exists = admin.execute("SELECT to_regprocedure(%s) IS NOT NULL AS exists", (f"public.{function}({('uuid,text' if function != 'upsert_school_calendar_event' else 'text,text,text,date,date,uuid,boolean,boolean')})",)).fetchone()
        assert exists["exists"], f"missing installed RPC: {function}"
    response_def = admin.execute(
        "SELECT pg_get_functiondef('public.respond_to_calendar_event(uuid,text)'::regprocedure) AS body"
    ).fetchone()["body"].lower()
    cancel_def = admin.execute(
        "SELECT pg_get_functiondef('public.cancel_school_calendar_event(uuid,text)'::regprocedure) AS body"
    ).fetchone()["body"].lower()
    assert "for update" in response_def and "calendar_event_cancelled" in response_def, "Packet D forward migration not installed in isolated DB"
    assert "for update" in cancel_def, "Packet D cancel RPC not installed in isolated DB"
    for function in ("respond_to_calendar_event", "cancel_school_calendar_event"):
        grants = admin.execute(
            "SELECT has_function_privilege('authenticated', %s::regprocedure, 'EXECUTE') AS a, "
            "has_function_privilege('anon', %s::regprocedure, 'EXECUTE') AS anon",
            (f"public.{function}(uuid,text)", f"public.{function}(uuid,text)"),
        ).fetchone()
        assert grants["a"] and not grants["anon"], f"RPC grants mismatch for {function}"


def seed_synthetic_fixtures(admin, dsn: str, created_users: list[uuid.UUID], created_classes: list[uuid.UUID]):
    """Uses actual persisted Supabase Auth principals; no fabricated missing UUIDs."""
    tag = uuid.uuid4().hex[:10]
    identities: dict[str, uuid.UUID] = {}
    for label, role, status in (
        ("owner", "APP_ADMIN", "APPROVED"),
        ("member", "PARENT", "APPROVED"),
        ("pending", "PARENT", "PENDING"),
        ("suspended", "PARENT", "SUSPENDED"),
    ):
        uid = uuid.uuid4()
        username = f"pd_{label}_{tag}"
        metadata = json.dumps({"username": username, "full_name": "Packet D synthetic fixture", "requested_role": role})
        # Track the UUID BEFORE insertion so cleanup catches partial trigger failures.
        created_users.append(uid)
        admin.execute(
            "INSERT INTO auth.users (id, aud, role, email, raw_user_meta_data, created_at, updated_at) "
            "VALUES (%s, 'authenticated', 'authenticated', %s, %s::jsonb, now(), now())",
            (uid, f"{username}@example.invalid", metadata),
        )
        row = admin.execute(
            "UPDATE public.profiles SET account_status = %s::public.account_approval_status "
            "WHERE id = %s RETURNING id, account_status", (status, uid),
        ).fetchone()
        assert row and row["id"] == uid and str(row["account_status"]) == status, "Auth trigger/profile fixture failed"
        admin.execute(
            "INSERT INTO public.role_assignments (user_id, role, active) "
            "VALUES (%s, %s::public.app_role, true)", (uid, role),
        )
        identities[label] = uid

    year = admin.execute("SELECT id FROM public.academic_years ORDER BY starts_on DESC LIMIT 1").fetchone()
    level = admin.execute("SELECT code FROM public.school_levels ORDER BY sort_order LIMIT 1").fetchone()
    assert year and level, "existing schema/seed must provide an academic year and level"
    class_id = uuid.uuid4()
    created_classes.append(class_id)
    admin.execute(
        "INSERT INTO public.school_classes (id, academic_year_id, level_code, name, created_by) "
        "VALUES (%s, %s, %s, %s, %s)",
        (class_id, year["id"], level["code"], f"Packet D class {tag}", identities["owner"]),
    )

    # Check authorization through the real functions and persisted states.
    with actor(dsn, identities["owner"]) as conn:
        assert conn.execute("SELECT public.current_user_has_role('APP_ADMIN'::public.app_role) AS yes").fetchone()["yes"]
    with actor(dsn, identities["member"]) as conn:
        row = conn.execute(
            "SELECT public.is_approved_school_member() AS approved, public.can_access_class(%s) AS scoped", (class_id,),
        ).fetchone()
        assert row["approved"] and not row["scoped"], "member must be approved and unrelated to test class"
    for label in ("pending", "suspended"):
        with actor(dsn, identities[label]) as conn:
            assert not conn.execute("SELECT public.is_approved_school_member() AS approved").fetchone()["approved"]
    return identities, class_id


def make_event(dsn, owner, created_events, *, class_id=None):
    day = date.today() + timedelta(days=14)
    with actor(dsn, owner) as conn:
        row = call(conn, "upsert_school_calendar_event", f"Packet D {uuid.uuid4().hex[:10]}",
                   "Synthetic isolated verification", "EVENT", day, day, class_id, True, False)
    assert row["status"] == "SCHEDULED"
    created_events.append(row["id"])
    return row["id"]


def persisted(admin, event_id, expected_status, responses: dict[uuid.UUID, str], reason=None):
    event = admin.execute(
        "SELECT status, cancellation_reason, updated_at FROM public.school_calendar_events WHERE id=%s", (event_id,)
    ).fetchone()
    assert event and event["status"] == expected_status, f"Incorrect persisted event status: {event}"
    if reason is not None:
        assert event["cancellation_reason"] == reason, "Persisted cancellation reason changed"
    rows = admin.execute(
        "SELECT user_id, response FROM public.school_calendar_responses WHERE event_id = %s", (event_id,)
    ).fetchall()
    actual = {row["user_id"]: row["response"] for row in rows}
    assert len(rows) == len(responses) and actual == responses, f"Persisted RSVP mismatch: {actual!r}"
    return event


def wait_for_blocker(observer, waiter_pid, holder_pid):
    """Assert actual PostgreSQL lock contention, not a sleep/timing surrogate."""
    deadline = time.monotonic() + 8
    while time.monotonic() < deadline:
        row = observer.execute("SELECT pg_blocking_pids(%s) AS blockers", (waiter_pid,)).fetchone()
        if row and holder_pid in row["blockers"]:
            return
        time.sleep(0.05)
    raise AssertionError(f"Session {waiter_pid} did not block behind holder {holder_pid} on the RPC row lock")


def test_active_and_retries(dsn, admin, owner, member, created):
    event_id = make_event(dsn, owner, created)
    with actor(dsn, member) as conn:
        for choice in REQUIRED_RESPONSES + ("DECLINED",):
            row = call(conn, "respond_to_calendar_event", event_id, choice)
            assert row["response"] == choice
            persisted(admin, event_id, "SCHEDULED", {member: choice})
        expect_error("school_calendar_responses_response_check", lambda: call(conn, "respond_to_calendar_event", event_id, "MAYBE"), "23514")
    persisted(admin, event_id, "SCHEDULED", {member: "DECLINED"})
    print("PASS active event + 3 RSVP choices + idempotent retry + invalid value denied + persisted state")


def test_cancelled_and_retry(dsn, admin, owner, member, created):
    event_id = make_event(dsn, owner, created)
    with actor(dsn, owner) as conn:
        first = call(conn, "cancel_school_calendar_event", event_id, "First cancellation")
        second = call(conn, "cancel_school_calendar_event", event_id, "Duplicate request")
        assert first["status"] == second["status"] == "CANCELLED"
        assert first["updated_at"] == second["updated_at"]
    with actor(dsn, member) as conn:
        expect_error("calendar_event_cancelled", lambda: call(conn, "respond_to_calendar_event", event_id, "ATTENDING"))
    event = persisted(admin, event_id, "CANCELLED", {}, "First cancellation")
    assert event["updated_at"] == first["updated_at"]
    print("PASS cancelled response denied; duplicate cancellation idempotent; persisted state unchanged")


def test_denials(dsn, admin, ids, class_id, created):
    owner, member = ids["owner"], ids["member"]
    private = make_event(dsn, owner, created, class_id=class_id)
    general = make_event(dsn, owner, created)
    with actor(dsn, member) as conn:
        expect_error("insufficient_authority", lambda: call(conn, "respond_to_calendar_event", private, "DECLINED"))
        expect_error("insufficient_authority", lambda: call(conn, "cancel_school_calendar_event", general, "Unauthorized"))
        expect_error("insufficient_authority", lambda: call(conn, "cancel_school_calendar_event", private, "Unauthorized"))
        expect_error("target_not_found", lambda: call(conn, "respond_to_calendar_event", uuid.uuid4(), "ATTENDING"))
    for label in ("pending", "suspended"):
        with actor(dsn, ids[label]) as conn:
            expect_error("actor_not_approved", lambda: call(conn, "respond_to_calendar_event", general, "ATTENDING"))
            expect_error("actor_not_approved", lambda: call(conn, "cancel_school_calendar_event", general, "Unauthorized"))
    with actor(dsn, None) as conn:
        expect_error("actor_unauthenticated", lambda: call(conn, "respond_to_calendar_event", general, "ATTENDING"))
        expect_error("actor_unauthenticated", lambda: call(conn, "cancel_school_calendar_event", general, "Unauthorized"))
    with actor(dsn, owner) as conn:
        expect_error("target_not_found", lambda: call(conn, "cancel_school_calendar_event", uuid.uuid4(), "Unknown"))
    persisted(admin, private, "SCHEDULED", {})
    persisted(admin, general, "SCHEDULED", {})
    print("PASS cross-class / unauthorized cancellation / real pending+suspended / anonymous denial; no writes")


def test_cancel_first(dsn, admin, owner, member, created):
    event_id = make_event(dsn, owner, created)
    cancel = actor(dsn, owner)
    response = actor(dsn, member)
    try:
        cancel.execute("BEGIN")
        assert call(cancel, "cancel_school_calendar_event", event_id, "Race winner") ["status"] == "CANCELLED"
        with ThreadPoolExecutor(max_workers=1) as pool:
            future = pool.submit(call, response, "respond_to_calendar_event", event_id, "ATTENDING")
            wait_for_blocker(admin, response.info.backend_pid, cancel.info.backend_pid)
            cancel.execute("COMMIT")
            expect_error("calendar_event_cancelled", lambda: future.result(timeout=15))
        persisted(admin, event_id, "CANCELLED", {}, "Race winner")
    finally:
        cancel.execute("ROLLBACK")
        cancel.close()
        response.close()
    print("PASS two-session cancellation first: actual lock wait; RSVP denied; state durable")


def test_response_first(dsn, admin, owner, member, created):
    event_id = make_event(dsn, owner, created)
    response = actor(dsn, member)
    cancel = actor(dsn, owner)
    try:
        response.execute("BEGIN")
        assert call(response, "respond_to_calendar_event", event_id, "ACKNOWLEDGED")["response"] == "ACKNOWLEDGED"
        with ThreadPoolExecutor(max_workers=1) as pool:
            future = pool.submit(call, cancel, "cancel_school_calendar_event", event_id, "Race end")
            wait_for_blocker(admin, cancel.info.backend_pid, response.info.backend_pid)
            response.execute("COMMIT")
            assert future.result(timeout=15)["status"] == "CANCELLED"
        persisted(admin, event_id, "CANCELLED", {member: "ACKNOWLEDGED"}, "Race end")
        with actor(dsn, member) as conn:
            expect_error("calendar_event_cancelled", lambda: call(conn, "respond_to_calendar_event", event_id, "DECLINED"))
        persisted(admin, event_id, "CANCELLED", {member: "ACKNOWLEDGED"}, "Race end")
    finally:
        response.execute("ROLLBACK")
        response.close()
        cancel.close()
    print("PASS two-session response first: lock wait; RSVP preserved; later update rejected")


def cleanup(admin, events: list[uuid.UUID], classes: list[uuid.UUID], users: list[uuid.UUID]):
    """Delete ONLY this runner's own synthetic IDs; cascade removes their replies."""
    if users or events:
        admin.execute(
            "DELETE FROM public.school_calendar_events WHERE created_by = ANY(%s::uuid[]) OR id = ANY(%s::uuid[])",
            (users, events),
        )
    if classes:
        admin.execute("DELETE FROM public.school_classes WHERE id = ANY(%s::uuid[])", (classes,))
    if users:
        admin.execute("DELETE FROM auth.users WHERE id = ANY(%s::uuid[])", (users,))
    for table, condition, values in (
        ("public.school_calendar_events", "id = ANY(%s::uuid[])", (events,)),
        ("public.profiles", "id = ANY(%s::uuid[])", (users,)),
    ):
        if values[0]:
            count = admin.execute(f"SELECT count(*) AS count FROM {table} WHERE {condition}", values).fetchone()["count"]
            assert count == 0, f"fixture cleanup incomplete for {table}"


def main():
    dsn = require_isolated_target()
    created_users: list[uuid.UUID] = []
    created_events: list[uuid.UUID] = []
    created_classes: list[uuid.UUID] = []
    with privileged(dsn) as admin:
        assert_empty_disposable_database(admin, os.environ["KRISTOU_D_ISOLATION_MODE"])
        try:
            identities, class_id = seed_synthetic_fixtures(admin, dsn, created_users, created_classes)
            test_active_and_retries(dsn, admin, identities["owner"], identities["member"], created_events)
            test_cancelled_and_retry(dsn, admin, identities["owner"], identities["member"], created_events)
            test_denials(dsn, admin, identities, class_id, created_events)
            test_cancel_first(dsn, admin, identities["owner"], identities["member"], created_events)
            test_response_first(dsn, admin, identities["owner"], identities["member"], created_events)
        finally:
            cleanup(admin, created_events, created_classes, created_users)
    print("PASS Packet D: five real-DB scenarios, 2 sessions each race, all runner fixtures cleaned")


if __name__ == "__main__":
    main()
