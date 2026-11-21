#!/usr/bin/env python3
"""ARCH-01 focused real-React verification; service boundaries are controlled, not Supabase network tests."""
import os
import socket
import subprocess
import time
import unittest
from pathlib import Path
from urllib.request import urlopen
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]

class Arch01ContextTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        with socket.socket() as probe:
            probe.bind(('127.0.0.1', 0))
            cls.port = probe.getsockname()[1]
        cls.base = f'http://127.0.0.1:{cls.port}/tests/browser'
        cls.vite = subprocess.Popen([
            str(ROOT / 'node_modules/.bin/vite'), '--config',
            'tests/browser/notification-messages.vite.config.ts', '--host', '127.0.0.1',
            '--port', str(cls.port), '--strictPort',
        ], cwd=ROOT, env={**os.environ, 'BROWSER': 'none'},
            stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
        for _ in range(100):
            if cls.vite.poll() is not None: raise RuntimeError('Vite exited before ready')
            try:
                if urlopen(cls.base + '/arch01-contexts.html', timeout=0.5).status == 200:
                    break
            except OSError:
                time.sleep(0.1)
        else:
            raise RuntimeError('Vite failed to start')
        cls.pw = sync_playwright().start()
        cls.browser = cls.pw.chromium.launch(headless=True)

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.pw.stop()
        cls.vite.terminate()
        cls.vite.wait(timeout=10)

    def setUp(self):
        self.page = self.browser.new_page()
        self.page.goto(self.base + '/arch01-contexts.html', wait_until='domcontentloaded')
        self.page.wait_for_function('window.__arch01Ready === true')

    def tearDown(self):
        self.page.close()

    def value(self, key, target='arch01-state'):
        return self.page.evaluate('([key,target]) => JSON.parse(document.querySelector("[data-testid="+target+"]").textContent)[key]', [key,target])

    def wait_condition(self, javascript):
        self.page.wait_for_function(javascript)

    def loaded_notifications(self):
        self.page.evaluate('window.__arch01.hydrateNotifications()')
        self.wait_condition('JSON.parse(document.querySelector("[data-testid=arch01-state]").textContent).notifications.length === 1')

    def test_01_local_defaults_preserve_language_and_theme(self):
        self.assertEqual(self.value('language'), 'fr')
        self.assertEqual(self.value('theme'), 'light')
        self.assertEqual(self.value('preferenceStatus'), 'LOCAL_ONLY')

    def test_02_failed_preference_persistence_never_claims_saved(self):
        self.page.evaluate("window.__arch01.setPreferenceMode('save-error'); window.__arch01.setLanguage('ar')")
        self.wait_condition('JSON.parse(document.querySelector("[data-testid=arch01-state]").textContent).preferenceStatus === "ERROR"')
        self.assertEqual(self.value('language'), 'ar')
        self.assertEqual(self.value('preferenceError'), 'save_failed')

    def test_03_blocked_preference_hydration_fail_closed(self):
        self.page.evaluate("async () => { window.__arch01.setPreferenceMode('load-blocked'); await window.__arch01.hydratePreferences() }")
        self.wait_condition('JSON.parse(document.querySelector("[data-testid=arch01-state]").textContent).preferenceStatus === "UNAVAILABLE"')
        self.assertNotEqual(self.value('preferenceStatus'), 'SAVED')

    def test_04_denied_preference_hydration_reports_denial(self):
        self.page.evaluate("async () => { window.__arch01.setPreferenceMode('load-denied'); await window.__arch01.hydratePreferences() }")
        self.wait_condition('JSON.parse(document.querySelector("[data-testid=arch01-state]").textContent).preferenceStatus === "ERROR"')
        self.assertEqual(self.value('preferenceError'), 'access_denied')

    def test_05_denied_single_notification_mark_restores_unread(self):
        self.loaded_notifications()
        self.page.evaluate("window.__arch01.setNotificationMode('mark-denied'); window.__arch01.markRead('note-a')")
        self.wait_condition('(() => { const x = JSON.parse(document.querySelector("[data-testid=arch01-state]").textContent); return x.notificationError === "access_denied" && x.notifications[0].read === false })()')
        self.assertFalse(self.value('notifications')[0]['read'])

    def test_06_denied_mark_all_restores_unread(self):
        self.loaded_notifications()
        self.page.evaluate("window.__arch01.setNotificationMode('mark-denied'); window.__arch01.markAllRead()")
        self.wait_condition('(() => { const x = JSON.parse(document.querySelector("[data-testid=arch01-state]").textContent); return x.notificationError === "access_denied" && x.notifications[0].read === false && x.markingAll === false })()')
        self.assertFalse(self.value('notifications')[0]['read'])

    def test_07_account_switch_clears_and_reloads_new_actor_preferences(self):
        self.page.evaluate('window.__arch01.hydratePreferences()')
        self.wait_condition('JSON.parse(document.querySelector("[data-testid=arch01-state]").textContent).preferenceStatus === "SAVED"')
        self.page.evaluate('window.__arch01.switchActorB()')
        self.wait_condition('JSON.parse(document.querySelector("[data-testid=arch01-state]").textContent).preferenceStatus === "LOCAL_ONLY"')
        self.page.evaluate('window.__arch01.hydratePreferences()')
        self.wait_condition('JSON.parse(document.querySelector("[data-testid=arch01-state]").textContent).language === "en"')
        self.assertEqual(self.value('preferenceStatus'), 'SAVED')

    def test_08_account_switch_clears_old_notifications_and_loads_actor_b(self):
        self.loaded_notifications()
        self.assertEqual(self.value('notifications')[0]['id'], 'note-a')
        self.page.evaluate('window.__arch01.switchActorB()')
        self.wait_condition('JSON.parse(document.querySelector("[data-testid=arch01-state]").textContent).notifications.length === 0')
        self.page.evaluate('window.__arch01.hydrateNotifications()')
        self.wait_condition('(() => { const x = JSON.parse(document.querySelector("[data-testid=arch01-state]").textContent); return x.notifications.length === 1 && x.notifications[0].id === "note-b" })()')
        self.assertEqual(self.value('notifications')[0]['id'], 'note-b')

    def test_09_logout_cannot_retain_prior_actor_notifications(self):
        self.loaded_notifications()
        self.page.evaluate('window.__arch01.logout()')
        self.wait_condition('JSON.parse(document.querySelector("[data-testid=arch01-state]").textContent).notifications.length === 0')
        self.assertEqual(self.value('notifications'), [])

    def test_10_stale_actor_a_read_completion_cannot_mutate_actor_b(self):
        self.loaded_notifications()
        self.page.evaluate("window.__arch01.setNotificationMode('pending'); window.__arch01.markRead('note-a')")
        self.wait_condition('JSON.parse(document.querySelector("[data-testid=arch01-state]").textContent).notifications[0].read === true')
        self.page.evaluate('window.__arch01.switchActorB()')
        self.wait_condition('JSON.parse(document.querySelector("[data-testid=arch01-state]").textContent).notifications.length === 0')
        self.page.evaluate('window.__arch01.hydrateNotifications()')
        self.wait_condition('(() => { const x = JSON.parse(document.querySelector("[data-testid=arch01-state]").textContent); return x.notifications.length === 1 && x.notifications[0].id === "note-b" })()')
        self.page.evaluate('window.__arch01.completePendingRead()')
        self.page.wait_for_timeout(100)
        self.assertEqual(self.value('notifications')[0]['id'], 'note-b')
        self.assertFalse(self.value('notifications')[0]['read'])
        self.assertIsNone(self.value('notificationError'))

    def test_11_real_public_useapp_mount_has_valid_provider_order(self):
        self.page.route('https://example.supabase.co/**', lambda route: route.abort())
        self.page.goto(self.base + '/arch01-useapp.html', wait_until='domcontentloaded')
        self.page.wait_for_function('window.__arch01UseAppReady === true')
        self.assertEqual(self.value('language','arch01-useapp-state'), 'fr')
        self.assertEqual(self.value('notifications','arch01-useapp-state'), [])
        self.assertTrue(self.value('hasMarkRead','arch01-useapp-state'))
        self.assertTrue(self.value('hasMarkAll','arch01-useapp-state'))

    def test_12_real_public_useapp_reflects_preferences_state(self):
        self.page.route('https://example.supabase.co/**', lambda route: route.abort())
        self.page.goto(self.base + '/arch01-useapp.html', wait_until='domcontentloaded')
        self.page.wait_for_function('window.__arch01UseAppReady === true')
        self.page.evaluate("window.__arch01UseAppSetLanguage('ar')")
        self.wait_condition('(() => { const x = JSON.parse(document.querySelector("[data-testid=arch01-useapp-state]").textContent); return x.language === "ar" && x.dir === "rtl" })()')
        self.assertEqual(self.value('language','arch01-useapp-state'), 'ar')

    def test_13_provider_imports_have_no_public_useapp_dependency(self):
        for file_name in ('PreferencesContext.tsx','NotificationContext.tsx'):
            source = (ROOT / 'src' / 'context' / file_name).read_text()
            self.assertNotIn('useApp(', source)
            self.assertNotIn("from './AppContext'", source)
            self.assertNotIn('useAppCore(', source)

if __name__ == '__main__':
    unittest.main(verbosity=2)
