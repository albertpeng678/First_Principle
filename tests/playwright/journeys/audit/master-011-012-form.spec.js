// master-011-012-form.spec.js — Wave A fix-A3.
// M-011: when autosave network call fails, draft must be persisted to localStorage
//        so the user does not lose work; on reload, local draft hydrates AppState.
// M-012: drill mode Phase-1 submit bar must include a "上一步" button which is
//        hidden on the first drill step (C1) and navigates to the previous drill
//        step on click.

const { test, expect } = require('@playwright/test');

const TARGET = ['Desktop-1280'];
function only(testInfo, names) {
  test.skip(!names.includes(testInfo.project.name), `only ${names.join(',')}`);
}

async function gotoCirclesPhase1Drill(page, drillStep = 'C1') {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  // Force drill mode + selected step + jump straight into Phase 1 with a stub question.
  await page.evaluate((step) => {
    window.AppState.circlesMode = 'drill';
    window.AppState.circlesDrillStep = step;
    window.AppState.circlesSelectedQuestion = {
      id: 'test-q-1',
      company: 'TestCo',
      product: 'TestApp',
      problem_statement: 'How to grow MAU?',
    };
    window.AppState.circlesPhase = 1;
    window.render();
  }, drillStep);
  await page.waitForSelector('.circles-submit-bar', { timeout: 5000 });
}

test.describe('M-011 — autosave offline → localStorage fallback', () => {
  test('M-011 [P1] autosave failure persists draft to localStorage', async ({ page }, testInfo) => {
    only(testInfo, TARGET);
    await gotoCirclesPhase1Drill(page, 'C1');
    // Block autosave network calls so triggerCirclesAutoSave hits the catch block.
    await page.route('**/api/**circles**', (route) => route.abort('failed'));

    // Type into the first field
    const ta = page.locator('.circles-field-input').first();
    await ta.click();
    await ta.fill('離線備份測試內容');

    // Wait past the 1.5s debounce + a bit of slack for the failure round-trip.
    await page.waitForTimeout(2200);

    // Local draft must have been written.
    const stored = await page.evaluate(() => {
      // Find any key that looks like the local draft key for circles drill C1.
      const keys = Object.keys(localStorage).filter(k => k.indexOf('circles_local_draft') === 0);
      return keys.map(k => ({ k, v: localStorage.getItem(k) }));
    });
    expect(stored.length, 'a circles_local_draft_* key must be written when autosave fails').toBeGreaterThan(0);
    const blob = stored[0].v || '';
    expect(blob).toContain('離線備份測試內容');

    // Indicator should mark offline / error state with offline copy.
    const indicatorText = await page.locator('.save-indicator').first().textContent().catch(() => '');
    expect(indicatorText || '').toMatch(/離線|本機|未連線|儲存失敗/);
  });

  test('M-011 [P1] localStorage draft hydrates AppState when network draft is empty', async ({ page }, testInfo) => {
    only(testInfo, TARGET);
    await gotoCirclesPhase1Drill(page, 'C1');
    // Seed local draft for current question + step (key derived from question id + step key)
    await page.evaluate(() => {
      const key = 'circles_local_draft_test-q-1_C1';
      localStorage.setItem(key, JSON.stringify({ '問題範圍': '本機草稿恢復' }));
    });
    // Re-render the drill phase 1 — the load helper should pick the local draft up.
    await page.evaluate(() => {
      // Simulate a render flow that consults the local draft loader.
      if (typeof window._circlesLoadLocalDraft === 'function') {
        const data = window._circlesLoadLocalDraft('test-q-1', 'C1');
        if (data) {
          window.AppState.circlesStepDrafts.C1 = Object.assign({}, window.AppState.circlesStepDrafts.C1 || {}, data);
          window.AppState.circlesFrameworkDraft = Object.assign({}, window.AppState.circlesFrameworkDraft || {}, data);
        }
      }
      window.render();
    });
    await page.waitForTimeout(200);
    // The first textarea (問題範圍) should now show the restored value.
    const val = await page.locator('.circles-field-input').first().inputValue();
    expect(val).toBe('本機草稿恢復');
  });
});

test.describe('M-012 — drill submit bar prev button', () => {
  test('M-012 [P1] drill Phase-1 submit bar shows 上一步 button on non-first step and navigates back', async ({ page }, testInfo) => {
    only(testInfo, TARGET);
    await gotoCirclesPhase1Drill(page, 'I'); // I is the second drill step
    const prevBtn = page.locator('#circles-p1-prev');
    await expect(prevBtn, '上一步 button must render in drill mode on non-first step').toBeVisible();
    await prevBtn.click();
    await page.waitForTimeout(150);
    const drillStep = await page.evaluate(() => window.AppState.circlesDrillStep);
    expect(drillStep).toBe('C1');
  });

  test('M-012 [P1] drill first step (C1) hides the 上一步 button', async ({ page }, testInfo) => {
    only(testInfo, TARGET);
    await gotoCirclesPhase1Drill(page, 'C1');
    const prevBtn = page.locator('#circles-p1-prev');
    // either not present, or present but hidden
    const visible = await prevBtn.isVisible().catch(() => false);
    expect(visible, '上一步 button must be hidden on the first drill step').toBeFalsy();
  });
});
