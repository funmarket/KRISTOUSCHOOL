#!/usr/bin/env python3
"""Real React MessagesView browser regression (backend/context boundaries are controlled).

From repository root after frozen Bun install and Python Playwright/Chromium setup:
    python3 tests/browser/test_notification_messages_component.py

The test starts only an isolated Vite fixture server on loopback. It never connects to
KRISTOUSCHOOL production, and it does not mock the MessagesView component itself.
"""
from __future__ import annotations

import os
import socket
import subprocess
import time
import unittest
from pathlib import Path
from urllib.request import urlopen

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
THREAD_A = "11111111-1111-4111-8111-111111111111"
THREAD_B = "22222222-2222-4222-8222-222222222222"


def make_thread(identifier: str, label: str) -> dict:
    return {
        "id": identifier,
        "subject": f"Thread {label}",
        "recipientName": "School Teacher",
        "recipientId": "teacher-1",
        "recipientRole": "TEACHER",
        "lastMessage": f"Preview {label}",
        "unread": False,
        "updatedAt": "2026-11-15T12:00:00Z",
        "messages": [{"id": f"msg-{label}", "senderId": "teacher-1", "senderName": "School Teacher", "content": f"Message {label} body"}],
    }


def notification(identifier: str, owner: str, request_id: int) -> dict:
    return {"tab": "messages", "refId": identifier, "actorKey": f"{owner}::PARENT::APPROVED", "requestId": request_id}


def account(identifier: str) -> dict:
    return {"id": identifier, "username": identifier, "fullName": identifier, "role": "PARENT", "accountStatus": "APPROVED"}


class MessagesNavigationComponentTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        binary = ROOT / "node_modules" / ".bin" / "vite"
        if not binary.exists():
            raise RuntimeError("Missing frozen-installed Vite: run Bun frozen installation first")
        with socket.socket() as probe:
            probe.bind(("127.0.0.1", 0))
            cls.port = probe.getsockname()[1]
        cls.base = f"http://127.0.0.1:{cls.port}/tests/browser/notification-messages.html"
        cls.vite = subprocess.Popen(
            [str(binary), "--config", "tests/browser/notification-messages.vite.config.ts", "--host", "127.0.0.1", "--port", str(cls.port), "--strictPort"],
            cwd=ROOT, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True,
            env={**os.environ, "BROWSER": "none"},
        )
        try:
            for _ in range(100):
                if cls.vite.poll() is not None:
                    raise RuntimeError("Vite component fixture failed to start")
                try:
                    with urlopen(cls.base, timeout=0.5) as response:
                        if response.status == 200:
                            break
                except OSError:
                    time.sleep(0.1)
            else:
                raise RuntimeError("Timed out starting isolated Vite component fixture")
            cls.playwright = sync_playwright().start()
            cls.browser = cls.playwright.chromium.launch(headless=True)
        except Exception:
            cls.vite.terminate()
            cls.vite.wait(timeout=10)
            raise

    @classmethod
    def tearDownClass(cls) -> None:
        if hasattr(cls, "browser"):
            cls.browser.close()
        if hasattr(cls, "playwright"):
            cls.playwright.stop()
        if hasattr(cls, "vite"):
            cls.vite.terminate()
            try:
                cls.vite.wait(timeout=10)
            except subprocess.TimeoutExpired:
                cls.vite.kill()

    def setUp(self) -> None:
        self.page = self.browser.new_page()

    def tearDown(self) -> None:
        self.page.close()

    def open_fixture(self, initial: str = "error") -> None:
        self.page.goto(f"{self.base}?initial={initial}", wait_until="domcontentloaded")
        self.page.wait_for_function("window.__messageFixtureReady === true")
        self.page.locator('[data-testid="messages-view"]').wait_for()

    def update(self, patch: dict) -> None:
        self.page.evaluate("(patch) => window.__setMessageScenario(patch)", patch)

    def wait_scenario(self, *, actor: str, request_id: int, status: str) -> None:
        self.page.wait_for_function(
            "([actor, req, status]) => document.documentElement.dataset.notificationTestActor === actor && document.documentElement.dataset.notificationTestRequest === String(req) && document.documentElement.dataset.notificationTestStatus === status",
            arg=[actor, request_id, status],
        )
        # Let the real component's passive effects settle before the next backend transition.
        self.page.wait_for_timeout(30)

    def expect_selected(self, identifier: str) -> None:
        self.page.wait_for_function(
            "(id) => document.getElementById('notification-thread-' + id)?.className.includes('border-blue-600') === true",
            arg=identifier,
        )

    def test_01_initial_error_retry_selects_requested_thread(self) -> None:
        self.open_fixture()
        self.page.locator('[data-testid="messages-error-state"]').wait_for()
        self.page.locator('[data-testid="notification-target-unavailable"]').wait_for()
        self.update({"messagesStatus": "READY", "messagesError": None, "messages": [make_thread(THREAD_B, "B"), make_thread(THREAD_A, "A")]})
        self.expect_selected(THREAD_A)
        self.page.get_by_text("Message A body", exact=True).wait_for()

    def test_02_initial_loading_then_success(self) -> None:
        self.open_fixture("loading")
        self.page.locator('[data-testid="messages-loading-state"]').wait_for()
        self.update({"isHydratingSchoolData": False, "messages": [make_thread(THREAD_B, "B"), make_thread(THREAD_A, "A")]})
        self.expect_selected(THREAD_A)

    def test_03_account_change_during_failed_recovery(self) -> None:
        self.open_fixture()
        self.page.locator('[data-testid="messages-error-state"]').wait_for()
        self.update({"currentUser": account("user-b"), "notificationTarget": notification(THREAD_B, "user-b", 2), "messagesStatus": "ERROR", "messages": []})
        self.wait_scenario(actor="user-b", request_id=2, status="ERROR")
        self.update({"messagesStatus": "READY", "messagesError": None, "messages": [make_thread(THREAD_A, "A"), make_thread(THREAD_B, "B")]})
        self.expect_selected(THREAD_B)
        self.assertFalse(self.page.get_by_text("Message A body", exact=True).is_visible())

    def test_04_newer_request_supersedes_failed_request(self) -> None:
        self.open_fixture()
        self.page.locator('[data-testid="messages-error-state"]').wait_for()
        self.update({"notificationTarget": notification(THREAD_B, "user-a", 2)})
        self.wait_scenario(actor="user-a", request_id=2, status="ERROR")
        self.page.locator('[data-testid="notification-target-unavailable"]').wait_for()
        self.update({"messagesStatus": "READY", "messagesError": None, "messages": [make_thread(THREAD_A, "A"), make_thread(THREAD_B, "B")]})
        self.expect_selected(THREAD_B)

    def test_05_manual_thread_selection_remains_after_successful_navigation(self) -> None:
        self.open_fixture("ready")
        self.expect_selected(THREAD_A)
        self.page.locator(f'[id="notification-thread-{THREAD_B}"]').click()
        self.expect_selected(THREAD_B)
        # A fresh props/list render must not reapply the already consumed successful intent.
        self.update({"messages": [make_thread(THREAD_A, "A"), make_thread(THREAD_B, "B")]})
        self.expect_selected(THREAD_B)
        self.page.get_by_text("Message B body", exact=True).wait_for()


if __name__ == "__main__":
    unittest.main(verbosity=2)
