"""Authenticated S2 Students navigation acceptance (real app, no mocks, no writes).

Required environment:
  KRISTOU_BROWSER_URL: live or staging app URL for the exact tested revision
  KRISTOU_BROWSER_STORAGE_STATE: approved Owner/Office Playwright storage state
  KRISTOU_S2_STUDENT_ID: enrolled student UUID available to that actor
  KRISTOU_S2_CLASS_ID: class UUID containing that student
Optional:
  KRISTOU_S2_ROSTER_QUERY: current roster search term matching the student

Run: python tests/browser/students-s2-navigation.py
Requires Python Playwright + Chromium. This does not test cross-actor revocation.
"""
import os
import re
from playwright.sync_api import sync_playwright


def navigate(page, test_id):
    page.locator('button[aria-expanded]:has(img[alt])').first.click()
    page.locator(f'[data-testid="{test_id}"]').click()


def main():
    required = (
        'KRISTOU_BROWSER_URL',
        'KRISTOU_BROWSER_STORAGE_STATE',
        'KRISTOU_S2_STUDENT_ID',
        'KRISTOU_S2_CLASS_ID',
    )
    missing = [name for name in required if not os.getenv(name)]
    if missing:
        raise SystemExit('Missing required environment: ' + ', '.join(missing))
    student_id = os.environ['KRISTOU_S2_STUDENT_ID']
    class_id = os.environ['KRISTOU_S2_CLASS_ID']
    query = os.environ.get('KRISTOU_S2_ROSTER_QUERY', '')

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        for width, height in ((1280, 900), (390, 844)):
            context = browser.new_context(
                viewport={'width': width, 'height': height},
                storage_state=os.environ['KRISTOU_BROWSER_STORAGE_STATE'],
            )
            page = context.new_page()
            errors = []
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.goto(os.environ['KRISTOU_BROWSER_URL'], wait_until='networkidle')

            navigate(page, 'navbar-menu-students')
            list_action = page.locator(f'[data-testid="students-view-{student_id}"]')
            list_action.wait_for()
            name = list_action.inner_text().strip()
            list_action.click()
            page.get_by_role('heading', name=name, exact=True).wait_for()
            page.get_by_role(
                'button', name=re.compile(r'Back to Students List|Retour aux élèves|العودة إلى قائمة التلاميذ')
            ).click()
            list_action.wait_for()
            assert page.locator('h1').filter(has_text=name).count() == 0, 'Dossier remained open after directory Back'

            navigate(page, 'navbar-menu-classes')
            page.locator(f'[data-testid="view-class-students-{class_id}"]').click()
            page.locator('[data-testid="class-detail-roster-view"]').wait_for()
            search = page.locator('[data-testid="roster-student-search"]')
            search.fill(query)
            view = page.locator(f'[data-testid="view-student-{student_id}"]')
            view.wait_for()
            view.click()
            page.get_by_role(
                'button', name=re.compile(r'Back to Class Roster|Retour à la classe|العودة إلى القسم')
            ).click()
            page.locator('[data-testid="class-detail-roster-view"]').wait_for()
            restored = page.locator('[data-testid="roster-student-search"]')
            assert restored.input_value() == query, 'Roster search was lost during dossier round-trip'
            page.locator(f'[data-testid="view-student-{student_id}"]').wait_for()
            assert not errors, errors
            print(f'PASS: actual Student-directory and roster return paths, viewport={width}x{height}', flush=True)
            context.close()
        browser.close()


if __name__ == '__main__':
    main()
