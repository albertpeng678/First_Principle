// tests/playwright/journeys/circles-progress-save.spec.js
// Phase 2 Spec 2 — CIRCLES progress save: auto-save, resume banner, dismiss
// persistence, and offcanvas "進行中" badge.
//
// Auth: tests run as guest (X-Guest-ID) — no login required. The same
// flow applies for logged-in users; switching is just a header swap.
// Spec ref: docs/superpowers/specs/2026-04-28-circles-progress-save-design.md
//   §4 auto-save (debounce 1.5s, lazy-create), §6 offcanvas badge,
//   §7 home resume banner, §10 test scenarios.

const { test, expect } = require('@playwright/test');

// The shared dev server (port 4000) may be pinned to a different worktree.
// Allow `PMDRILL_BASE_URL=http://localhost:NNNN` to target a worktree-local
// server when this spec is run from a parallel worktree branch.
if (process.env.PMDRILL_BASE_URL) {
  test.use({ baseURL: process.env.PMDRILL_BASE_URL });
}

// Auto-save debounce is 1500ms; allow margin for network + lazy-create POST.
const AUTOSAVE_WAIT_MS = 4000;
const TEST_TEXT = '【自動儲存測試】聚焦電池熱管理在高速場景的安全邊界。';

// Navigate to the CIRCLES practice page where textareas are visible.
// Default flow (matches circles-phase1.spec.js): home → click question card →
// `.circles-field-input` textareas render. The first textarea is a C1 field
// regardless of mode (simulation Phase 1 starts with C1 fields too).
async function gotoCirclesPractice(page) {
  await page.addInitScript(() => {
    try { localStorage.clear(); } catch (_e) {}
  });
  await page.goto('/');
  // Wait for question cards to render AND list to stabilize (re-renders happen
  // when fetchActiveDraft / sessions resolve). Poll until count is steady.
  await page.waitForSelector('.circles-q-card', { timeout: 15000 });
  await page.waitForFunction(() => {
    const n = document.querySelectorAll('.circles-q-card').length;
    return n >= 3 && !window.__circlesRendering;
  }, { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(500);
  // Click the first card — avoid the inner expand area. Playwright auto-waits
  // for stability so we don't need scrollIntoViewIfNeeded (which races against
  // re-renders).
  const card = page.locator('.circles-q-card').first();
  await card.click({ position: { x: 20, y: 20 } });
  // Wait for the expand area to actually render visible (display flips from none).
  const expandArea = card.locator('.circles-q-card-expand-area');
  await expect(expandArea).toBeVisible({ timeout: 5000 });
  const confirmBtn = card.locator('.circles-q-confirm-btn');
  await expect(confirmBtn).toBeVisible({ timeout: 5000 });
  await confirmBtn.click();
  await page.waitForSelector('.circles-field-input', { timeout: 15000 });
}

test.describe('CIRCLES Progress Save (Phase 2 Spec 2)', () => {
  test('auto-save creates draft and shows 已儲存 indicator', async ({ page }) => {
    await gotoCirclesPractice(page);

    // Type into the first C1 textarea — should fire `input` listener +
    // triggerCirclesAutoSave (debounce 1500ms, lazy-create on first save).
    const firstField = page.locator('.circles-field-input').first();
    await firstField.fill(TEST_TEXT);

    // Wait past debounce + network round-trip.
    await page.waitForTimeout(AUTOSAVE_WAIT_MS);

    // Save indicator must read "已儲存".
    const indicator = page.locator('.save-indicator');
    await expect(indicator).toBeVisible();
    await expect(indicator).toContainText('已儲存');

    // Session must have been lazy-created (id appears in AppState) and
    // posted to the guest list endpoint.
    const sessionId = await page.evaluate(() => window.AppState?.circlesSession?.id || null);
    expect(sessionId, 'expected circlesSession.id to be populated by lazy-create').toBeTruthy();

    // Verify via API that the draft persisted server-side with our text.
    const guestId = await page.evaluate(() => window.AppState?.guestId || null);
    expect(guestId).toBeTruthy();
    const apiResp = await page.request.get('/api/guest-circles-sessions?status=active&limit=10', {
      headers: { 'X-Guest-ID': guestId },
    });
    expect(apiResp.ok()).toBe(true);
    const list = await apiResp.json();
    const found = list.find(s => s.id === sessionId);
    expect(found, 'lazy-created session should be returned by list endpoint').toBeTruthy();
    expect(found.step_drafts && Object.keys(found.step_drafts).length > 0).toBe(true);
  });

  test('resume banner appears on CIRCLES home after saving', async ({ page }) => {
    await gotoCirclesPractice(page);
    await page.locator('.circles-field-input').first().fill(TEST_TEXT);
    await page.waitForTimeout(AUTOSAVE_WAIT_MS);

    const sessionId = await page.evaluate(() => window.AppState?.circlesSession?.id || null);
    expect(sessionId).toBeTruthy();

    // Navigate back to CIRCLES home via the home button (resets active question).
    await page.locator('#circles-p1-home').click();
    // Wait for the banner — fetchActiveDraft is async, then DOM is patched.
    const banner = page.locator('.resume-banner');
    await expect(banner).toBeVisible({ timeout: 10000 });
    await expect(banner).toContainText('未完成練習');
    // The banner should reference the just-saved draft id.
    await expect(banner).toHaveAttribute('data-resume-id', sessionId);
  });

  test('dismiss banner persists in localStorage across reload', async ({ page }) => {
    await gotoCirclesPractice(page);
    await page.locator('.circles-field-input').first().fill(TEST_TEXT);
    await page.waitForTimeout(AUTOSAVE_WAIT_MS);

    const sessionId = await page.evaluate(() => window.AppState?.circlesSession?.id || null);
    expect(sessionId).toBeTruthy();

    await page.locator('#circles-p1-home').click();
    const banner = page.locator('.resume-banner');
    await expect(banner).toBeVisible({ timeout: 10000 });

    // Click the dismiss icon (Phosphor ph-x).
    await banner.locator('.dismiss').click();
    await expect(banner).toHaveCount(0);

    // localStorage flag should now be set for this draft id.
    const flag = await page.evaluate(id => localStorage.getItem('dismiss-resume-' + id), sessionId);
    expect(flag).toBe('1');

    // Reload — banner must NOT reappear for the same draft id.
    await page.reload();
    await page.waitForSelector('.circles-mode-card', { timeout: 10000 });
    // Give fetchActiveDraft + render-slot patching time to land.
    await page.waitForTimeout(2000);
    await expect(page.locator('.resume-banner')).toHaveCount(0);
  });

  test('offcanvas shows 進行中 badge with badge-warn class for active draft', async ({ page }) => {
    await gotoCirclesPractice(page);
    await page.locator('.circles-field-input').first().fill(TEST_TEXT);
    await page.waitForTimeout(AUTOSAVE_WAIT_MS);

    const sessionId = await page.evaluate(() => window.AppState?.circlesSession?.id || null);
    expect(sessionId).toBeTruthy();

    // Open offcanvas (function exposed on window).
    await page.evaluate(() => window.openOffcanvas && window.openOffcanvas());

    const item = page.locator(`.offcanvas-item[data-id="${sessionId}"]`);
    await expect(item).toBeVisible({ timeout: 10000 });

    const badge = item.locator('.badge');
    await expect(badge).toHaveText('進行中');
    await expect(badge).toHaveClass(/badge-warn/);
  });
});
