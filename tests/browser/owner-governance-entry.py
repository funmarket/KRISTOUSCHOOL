"""Actual app/browser regression. Requires a legitimate approved Owner session.

Run with Python Playwright installed, KRISTOU_BROWSER_URL, and
KRISTOU_BROWSER_STORAGE_STATE pointing to private Playwright storage state.
Optional KRISTOU_CHROMIUM_BIN selects an existing Chromium executable.
No network interception, mocked context, fixture accounts or hosted writes.
"""
import os


def assert_owner_governance_entry(page):
    page.locator('[data-testid="homepage-OWNER_HOME"]').wait_for()
    results = []
    for section, card in [
        ('pending-approvals', 'owner-pending-approvals'),
        ('user-directory', 'owner-user-directory'),
        ('manager-delegation', 'owner-manager-delegation'),
        ('role-governance', 'owner-role-governance'),
    ]:
        page.locator(f'[data-testid="shortcut-card-{card}"]').click()
        page.locator(f'[data-testid="gov-section-{section}"]').wait_for()
        workspace = page.locator(f'[data-testid="owner-governance-workspace-{section}"]')
        rect = workspace.bounding_box()
        assert rect and 0 <= rect['y'] < page.viewport_size['height'], f'{section} opened offscreen: {rect}'
        assert page.evaluate('document.activeElement?.dataset.testid') == 'owner-governance-surface'
        # Returning to the grid and opening the already selected section must work too.
        page.locator(f'[data-testid="shortcut-card-{card}"]').click()
        rect = workspace.bounding_box()
        assert rect and 0 <= rect['y'] < page.viewport_size['height'], f'{section} repeat entry failed'
        results.append({'section': section, 'top': rect['y'], 'repeatEntry': True})
    page.locator('[data-testid="shortcut-card-owner-school-settings"]').click()
    surface = page.locator('[data-testid="owner-governance-surface"]')
    rect = surface.bounding_box()
    assert rect and 0 <= rect['y'] < page.viewport_size['height']
    assert surface.inner_text().strip()
    page.locator('[data-testid="shortcut-card-owner-directory-oversight"]').click()
    page.locator('[data-testid="directory-view"]').wait_for()
    return results


if __name__ == '__main__':
    from playwright.sync_api import sync_playwright
    target = os.environ.get('KRISTOU_BROWSER_URL')
    storage = os.environ.get('KRISTOU_BROWSER_STORAGE_STATE')
    if not target or not storage:
        raise SystemExit('Set KRISTOU_BROWSER_URL and private KRISTOU_BROWSER_STORAGE_STATE for an approved Owner.')
    with sync_playwright() as p:
        options = {'headless': True}
        if os.environ.get('KRISTOU_CHROMIUM_BIN'):
            options['executable_path'] = os.environ['KRISTOU_CHROMIUM_BIN']
        browser = p.chromium.launch(**options)
        for width, height in [(1280, 900), (390, 844)]:
            context = browser.new_context(viewport={'width': width, 'height': height}, storage_state=storage)
            page = context.new_page()
            errors = []
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.goto(target, wait_until='networkidle')
            print(width, assert_owner_governance_entry(page), flush=True)
            assert not errors, errors
            context.close()
        browser.close()
