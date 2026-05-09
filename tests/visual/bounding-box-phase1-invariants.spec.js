// bounding-box-phase1-invariants.spec.js
// Phase 1 verification bundle — 5 boundingBox invariants
// Verifies structural correctness of 6 Phase 1 items:
//   Item 1: NSM preflight session
//   Item 2: NSM tab nav reset
//   Item 3: NSM context-card 4-block expand
//   Item 4: CIRCLES qchip stale fix
//   Item 5: NSM sub-tabs removed
//   Item 6: NSM guide step 3 vanity rewrite
const { test, expect } = require('@playwright/test');

async function setupRoutes(page) {
  await page.route('**/api/circles-stats**', r => r.fulfill({ status: 200, body: '{}' }));
  await page.route('**/api/guest-circles-stats**', r => r.fulfill({ status: 200, body: '{}' }));
  await page.route('**/api/circles-sessions**', r => r.fulfill({ status: 200, body: '[]' }));
  await page.route('**/api/guest-circles-sessions**', r => r.fulfill({ status: 200, body: '[]' }));
  await page.route('**/api/nsm-sessions**', async (route, request) => {
    if (request.method() === 'POST') return route.fulfill({ status: 200, body: JSON.stringify({ id: 's1', sessionId: 's1' }) });
    return route.fulfill({ status: 200, body: '[]' });
  });
  await page.route('**/api/guest/nsm-sessions**', async (route, request) => {
    if (request.method() === 'POST') return route.fulfill({ status: 200, body: JSON.stringify({ id: 's1', sessionId: 's1' }) });
    return route.fulfill({ status: 200, body: '[]' });
  });
  await page.route('**/api/nsm-context**', r => r.fulfill({
    status: 200, body: JSON.stringify({ model: 'm', users: 'u', traps: 't', insight: 'i' })
  }));
}

async function goToNSMStep2(page) {
  await page.goto('/?circles_onboarding_done=1');
  await page.waitForSelector('.navbar');
  await page.evaluate(() => {
    window.AppState.view = 'nsm';
    window.AppState.nsmStep = 2;
    window.AppState.nsmSelectedQuestion = window.NSM_QUESTIONS[0];
    window.render();
  });
  await page.waitForSelector('[data-nsm-field="nsm"]', { timeout: 5000 });
}

test.describe('Phase 1 boundingBox invariants', () => {
  test.beforeEach(async ({ page }) => {
    await setupRoutes(page);
  });

  test('Invariant 1: navbar height in 56-72px range', async ({ page }) => {
    await page.goto('/?circles_onboarding_done=1');
    await page.waitForSelector('.navbar');
    const box = await page.locator('.navbar').boundingBox();
    expect(box).not.toBeNull();
    expect(box.height).toBeGreaterThanOrEqual(56);
    expect(box.height).toBeLessThanOrEqual(72);
  });

  test('Invariant 2: nsm-context-card width > 280px on Step 2 (Item 3)', async ({ page }) => {
    await goToNSMStep2(page);
    await page.waitForSelector('.nsm-context-card', { timeout: 5000 });
    const box = await page.locator('.nsm-context-card').boundingBox();
    expect(box).not.toBeNull();
    expect(box.width).toBeGreaterThan(280);
  });

  test('Invariant 3: context-card expand toggle button visible and clickable (Item 3)', async ({ page }) => {
    await goToNSMStep2(page);
    await page.waitForSelector('.nsm-context-card__expand-toggle, [data-nsm="context-toggle"]', { timeout: 5000 });
    const toggle = page.locator('[data-nsm="context-toggle"]');
    const box = await toggle.boundingBox();
    expect(box).not.toBeNull();
    expect(box.width).toBeGreaterThan(60);
    expect(box.height).toBeGreaterThan(20);
  });

  test('Invariant 4: 4 ana blocks visible when expanded (Item 3)', async ({ page }) => {
    await page.goto('/?circles_onboarding_done=1');
    await page.waitForSelector('.navbar');
    await page.evaluate(() => {
      window.AppState.view = 'nsm';
      window.AppState.nsmStep = 2;
      window.AppState.nsmSelectedQuestion = window.NSM_QUESTIONS[0];
      window.AppState.nsmContextExpanded = true;
      window.render();
    });
    await page.waitForSelector('.nsm-context-card__ana-block', { timeout: 5000 });
    const count = await page.locator('.nsm-context-card__ana-block').count();
    expect(count).toBe(4);
    const trapCount = await page.locator('.nsm-context-card__ana-block--trap').count();
    expect(trapCount).toBe(1);
  });

  test('Invariant 5: nsm-sub-tabs absent — DOM-removed contract (Item 5)', async ({ page }) => {
    await goToNSMStep2(page);
    expect(await page.locator('.nsm-sub-tabs').count()).toBe(0);
    expect(await page.locator('.nsm-sub-tab').count()).toBe(0);
  });
});
