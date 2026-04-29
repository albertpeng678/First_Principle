// tests/playwright/journeys/onboarding-tour.spec.js
// Phase 5 — Onboarding tour: welcome card + 4-step coachmark tour + mobile variant.
// Spec: docs/superpowers/specs/2026-04-28-desktop-rwd-direction-c-design.md §4

const { test, expect } = require('@playwright/test');

// On this base branch, spec selectors `.mode-section / .type-section / .q-list / .q-row.expanded .btn-primary`
// map to existing classes:
//   - mode-section          → .circles-mode-row
//   - type-section          → .circles-type-tabs
//   - q-list                → .circles-q-list
//   - q-row.expanded .btn-primary → expanded .circles-q-card .circles-q-confirm-btn (auto-expand first Easy)
// See `// TODO(integration): re-target after Phase 4.1 desktop merge` comments in app.js.

async function gotoFreshHome(page) {
  // Clear localStorage *before* the SPA boots so it observes a first-time state.
  await page.addInitScript(() => {
    try {
      window.localStorage.removeItem('circles_onboarding_done');
    } catch (e) {}
  });
  await page.goto('/');
  await page.waitForSelector('.circles-mode-card', { timeout: 10000 });
}

test.describe('Onboarding Tour (Phase 5)', () => {
  test.describe.configure({ mode: 'serial' });

  test('Desktop: welcome card visible on first visit', async ({ page, browserName }, testInfo) => {
    test.skip(testInfo.project.name !== 'Desktop', 'Desktop-only assertion');
    await gotoFreshHome(page);

    const welcome = page.locator('.onboarding-welcome');
    await expect(welcome).toBeVisible();
    await expect(welcome.locator('#onb-start')).toBeVisible();
    await expect(welcome.locator('#onb-skip')).toBeVisible();
  });

  test('Desktop: clicking "開始引導" launches Step 1 spotlight + tooltip', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'Desktop', 'Desktop-only assertion');
    await gotoFreshHome(page);

    await page.click('#onb-start');

    await expect(page.locator('#onb-overlay')).toBeVisible();
    await expect(page.locator('#onb-spotlight')).toBeVisible();
    await expect(page.locator('#onb-tooltip')).toBeVisible();

    // Step counter shows "1 / 4"
    const stepText = await page.locator('#onb-tooltip .onb-step').textContent();
    expect(stepText).toMatch(/1/);
    expect(stepText).toMatch(/4/);
  });

  test('Desktop: clicking "下一步" 4 times finishes the tour and sets localStorage flag', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'Desktop', 'Desktop-only assertion');
    await gotoFreshHome(page);
    await page.click('#onb-start');

    // 4 steps total — click "下一步" 4 times. The 4th click ends the tour.
    for (let i = 0; i < 4; i++) {
      await page.waitForSelector('#onb-next', { state: 'visible' });
      await page.click('#onb-next');
    }

    // Tour DOM gone
    await expect(page.locator('#onb-overlay')).toHaveCount(0);
    await expect(page.locator('#onb-tooltip')).toHaveCount(0);

    // Flag set
    const flag = await page.evaluate(() => localStorage.getItem('circles_onboarding_done'));
    expect(flag).toBe('1');
  });

  test('Desktop: reload after completion does NOT show welcome card', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'Desktop', 'Desktop-only assertion');

    await page.goto('/');
    await page.waitForSelector('.circles-mode-card', { timeout: 10000 });
    // Pre-set the flag (simulating a previously-completed tour)
    await page.evaluate(() => localStorage.setItem('circles_onboarding_done', '1'));
    await page.reload();
    await page.waitForSelector('.circles-mode-card', { timeout: 10000 });

    await expect(page.locator('.onboarding-welcome')).toHaveCount(0);
  });

  test('Desktop: ?onboarding=1 dev hook forces welcome card even with flag set', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'Desktop', 'Desktop-only assertion');

    await page.goto('/');
    await page.waitForSelector('.circles-mode-card', { timeout: 10000 });
    await page.evaluate(() => localStorage.setItem('circles_onboarding_done', '1'));

    await page.goto('/?onboarding=1');
    await page.waitForSelector('.circles-mode-card', { timeout: 10000 });

    await expect(page.locator('.onboarding-welcome')).toBeVisible();
  });

  test('Desktop: "直接自己選題" skip button hides welcome and sets flag', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'Desktop', 'Desktop-only assertion');
    await gotoFreshHome(page);

    await page.click('#onb-skip');
    await expect(page.locator('.onboarding-welcome')).toHaveCount(0);

    const flag = await page.evaluate(() => localStorage.getItem('circles_onboarding_done'));
    expect(flag).toBe('1');
  });

  test('Mobile: tooltip is fixed-bottom (no overlay) during tour', async ({ page }, testInfo) => {
    // Run on iPhone-SE only (mobile)
    test.skip(testInfo.project.name !== 'iPhone-SE', 'Mobile-only assertion');
    await gotoFreshHome(page);

    await page.click('#onb-start');
    await page.waitForSelector('#onb-tooltip', { state: 'visible' });

    // On mobile per spec §4.5: overlay is display:none
    const overlayDisplay = await page.locator('#onb-overlay').evaluate(el => getComputedStyle(el).display).catch(() => 'none');
    expect(overlayDisplay).toBe('none');

    // Tooltip is anchored to viewport bottom (within 64px of viewport bottom)
    const box = await page.locator('#onb-tooltip').boundingBox();
    const vp = page.viewportSize();
    expect(box).not.toBeNull();
    const distanceFromBottom = vp.height - (box.y + box.height);
    expect(distanceFromBottom).toBeLessThan(64);
  });
});
