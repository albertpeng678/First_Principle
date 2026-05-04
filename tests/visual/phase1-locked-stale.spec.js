// Plan B SB9b — Locked / Stale / Save-error variants
// Mockup: docs/superpowers/specs/mockups/2026-05-02-frontend-rewrite/03-phase-1-form.html Section E line 1953-2106
const { test, expect } = require('@playwright/test');
test.use({ baseURL: 'http://localhost:4000' });

function stub(page) {
  return Promise.all([
    page.route('**/api/circles-stats**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' })),
    page.route('**/api/circles-sessions**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' })),
    page.route('**/api/guest-circles-sessions**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' })),
    page.route('**/api/nsm-sessions**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' })),
    page.route('**/api/guest/nsm-sessions**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' })),
  ]);
}

async function gotoSimC1(page) {
  await page.goto('/');
  await page.waitForSelector('.qcard');
  await page.locator('.mode-card').nth(0).click();
  await page.locator('.qcard').first().click();
  await page.locator('.qcard__btn--primary').click();
  await page.waitForSelector('.phase-head');
}

// ── LOCKED ──
test('locked: banner--locked + lock-key icon + 已評分鎖定 copy', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1100 });
  await stub(page);
  await gotoSimC1(page);
  await page.evaluate(() => {
    window.AppState.circlesLocked = true;
    window.AppState.circlesScoreResult = { totalScore: 76 };
    window.renderApp();
  });
  await expect(page.locator('.banner.banner--locked')).toBeVisible();
  await expect(page.locator('.banner.banner--locked i.ph-lock-key').first()).toBeVisible();
  await expect(page.locator('.banner.banner--locked')).toContainText('已評分鎖定');
  await expect(page.locator('.banner.banner--locked')).toContainText('76');
});

test('locked: rt-field is disabled + bg-soft + opacity 0.85', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1100 });
  await stub(page);
  await gotoSimC1(page);
  await page.evaluate(() => {
    window.AppState.circlesLocked = true;
    window.renderApp();
  });
  const rtField = page.locator('.rt-field').first();
  const isLocked = await rtField.evaluate(el => el.classList.contains('rt-field--locked'));
  expect(isLocked).toBe(true);
  // textarea / contenteditable is non-editable
  const editableState = await page.locator('.rt-textarea').first().evaluate(el => {
    if (el.tagName === 'TEXTAREA') return el.disabled ? 'disabled' : 'enabled';
    return el.getAttribute('contenteditable') === 'false' ? 'disabled' : 'enabled';
  });
  expect(editableState).toBe('disabled');
});

test('locked: submit-bar primary 改「看評分結果」', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1100 });
  await stub(page);
  await gotoSimC1(page);
  await page.evaluate(() => {
    window.AppState.circlesLocked = true;
    window.renderApp();
  });
  const cta = page.locator('.submit-bar__right .btn--primary');
  await expect(cta).toContainText('看評分結果');
});

// ── STALE ──
test('stale: banner--stale + warning-octagon icon + 題庫已更新 copy', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1100 });
  await stub(page);
  await gotoSimC1(page);
  await page.evaluate(() => {
    window.AppState.circlesStale = true;
    window.renderApp();
  });
  await expect(page.locator('.banner.banner--stale')).toBeVisible();
  await expect(page.locator('.banner.banner--stale i.ph-warning-octagon').first()).toBeVisible();
  await expect(page.locator('.banner.banner--stale')).toContainText('題庫已更新');
});

test('stale: rt-field disabled (same as locked)', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1100 });
  await stub(page);
  await gotoSimC1(page);
  await page.evaluate(() => {
    window.AppState.circlesStale = true;
    window.renderApp();
  });
  const rtField = page.locator('.rt-field').first();
  const isLocked = await rtField.evaluate(el => el.classList.contains('rt-field--locked'));
  expect(isLocked).toBe(true);
});

test('stale: submit-bar primary 改「用最新題目重練」', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1100 });
  await stub(page);
  await gotoSimC1(page);
  await page.evaluate(() => {
    window.AppState.circlesStale = true;
    window.renderApp();
  });
  const cta = page.locator('.submit-bar__right .btn--primary');
  await expect(cta).toContainText('用最新題目重練');
});

// ── SAVE ERROR (offline banner) ──
test('save error: banner danger + cloud-warning icon + 離線中已存於本機', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1100 });
  await stub(page);
  await gotoSimC1(page);
  await page.evaluate(() => {
    window.AppState.circlesPhase1SaveState = 'error';
    window.renderApp();
  });
  await expect(page.locator('.banner.banner--save-error')).toBeVisible();
  await expect(page.locator('.banner.banner--save-error i.ph-cloud-warning').first()).toBeVisible();
  await expect(page.locator('.banner.banner--save-error')).toContainText('離線中');
  await expect(page.locator('.banner.banner--save-error')).toContainText('立即重試');
});

test('save error: submit primary disabled with 請先恢復連線 copy', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1100 });
  await stub(page);
  await gotoSimC1(page);
  await page.evaluate(() => {
    window.AppState.circlesPhase1SaveState = 'error';
    window.renderApp();
  });
  const cta = page.locator('.submit-bar__right .btn--primary');
  await expect(cta).toBeDisabled();
  await expect(cta).toContainText('請先恢復連線');
});

test('save error: rt-field NOT disabled (user 仍可編輯草稿)', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1100 });
  await stub(page);
  await gotoSimC1(page);
  await page.evaluate(() => {
    window.AppState.circlesPhase1SaveState = 'error';
    window.renderApp();
  });
  const rtField = page.locator('.rt-field').first();
  const isLocked = await rtField.evaluate(el => el.classList.contains('rt-field--locked'));
  expect(isLocked).toBe(false);
});

// ── DEFAULT (none of the above) ──
test('default: no banner-locked/stale/save-error rendered', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1100 });
  await stub(page);
  await gotoSimC1(page);
  await expect(page.locator('.banner.banner--locked')).toHaveCount(0);
  await expect(page.locator('.banner.banner--stale')).toHaveCount(0);
  await expect(page.locator('.banner.banner--save-error')).toHaveCount(0);
});
