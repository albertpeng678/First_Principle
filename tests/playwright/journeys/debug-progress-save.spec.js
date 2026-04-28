const { test } = require('@playwright/test');

test.setTimeout(60000);

test('check if circles in-progress drafts persist across reload', async ({ page }) => {
  // Login
  await page.goto('http://localhost:4000/');
  await page.waitForSelector('#navbar-actions button', { timeout: 10000 });
  await page.evaluate(() => window.navigate('login'));
  await page.waitForSelector('#auth-form', { timeout: 5000 });
  await page.fill('#email', 'albertpeng678@gmail.com');
  await page.fill('#password', '21345678');
  await page.click('#auth-form button[type="submit"]');
  await page.waitForSelector('#auth-form', { state: 'hidden', timeout: 10000 }).catch(()=>{});
  await page.waitForTimeout(2000);
  console.log('logged in:', await page.evaluate(() => !!window.AppState?.accessToken));

  // Navigate to CIRCLES
  await page.evaluate(() => window.navigate('circles'));
  await page.waitForTimeout(1500);

  // Pick first question card → drill mode → C1
  const firstCard = page.locator('.circles-q-card').first();
  await firstCard.scrollIntoViewIfNeeded();
  await firstCard.click(); // expand
  await page.waitForTimeout(500);

  // Click drill mode (or simulation, whichever shows first)
  const drillBtn = page.locator('button:has-text("專項練習"), button:has-text("Drill")').first();
  if (await drillBtn.count()) await drillBtn.click();
  else await page.locator('.circles-q-confirm-btn').first().click();
  await page.waitForTimeout(1000);

  // Pick C1 step (drill mode shows step picker)
  const c1 = page.locator('button:has-text("C1"), [data-step="C1"]').first();
  if (await c1.count()) {
    await c1.click();
    await page.waitForTimeout(1500);
  }

  // Find first textarea (問題範圍) and fill
  const inputs = page.locator('textarea.circles-field-input');
  const count = await inputs.count();
  console.log('field input count:', count);
  if (count === 0) {
    console.log('no field inputs — body text:', (await page.locator('body').innerText()).slice(0, 500));
    return;
  }

  const TEST_TEXT = '【測試】聚焦 Tesla Autopilot 高速行駛安全性';
  await inputs.first().fill(TEST_TEXT);
  await inputs.first().blur();
  await page.waitForTimeout(2000); // allow fire-and-forget PATCH to land

  // Check if session was created and what session id
  const beforeReload = await page.evaluate(() => {
    const a = window.AppState || {};
    return {
      sessionId: a.circlesSession?.id,
      phase: a.circlesPhase,
      drillStep: a.circlesDrillStep,
      stepDrafts: a.circlesStepDrafts,
    };
  });
  console.log('BEFORE RELOAD:', JSON.stringify(beforeReload, null, 2));

  // Reload page (simulate user closing browser)
  await page.reload();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2500);

  // Check session list — does it show in-progress?
  await page.evaluate(() => {
    const fn = window.openOffcanvas || window.toggleOffcanvas;
    if (typeof fn === 'function') fn();
    else document.querySelector('[data-offcanvas-toggle], button.btn-icon')?.click();
  });
  await page.waitForTimeout(1000);
  const offcanvasItems = await page.locator('.offcanvas-item').allInnerTexts();
  console.log('OFFCANVAS AFTER RELOAD:', offcanvasItems);

  // If our session is there, click it and check if our text is restored
  if (beforeReload.sessionId) {
    const sid = beforeReload.sessionId;
    const sessionItem = page.locator(`.offcanvas-item[data-id="${sid}"]`);
    if (await sessionItem.count()) {
      await sessionItem.click();
      await page.waitForTimeout(2000);

      const afterRestore = await page.evaluate(() => {
        const a = window.AppState || {};
        const ta = document.querySelector('textarea.circles-field-input');
        return {
          phase: a.circlesPhase,
          drillStep: a.circlesDrillStep,
          stepDrafts: a.circlesStepDrafts,
          firstFieldValue: ta ? ta.value : '(no textarea)',
        };
      });
      console.log('AFTER RESTORE:', JSON.stringify(afterRestore, null, 2));

      const restored = afterRestore.firstFieldValue.includes(TEST_TEXT);
      console.log('TEXT RESTORED CORRECTLY:', restored);
    } else {
      console.log('session NOT in offcanvas list');
    }
  } else {
    console.log('no session id was created during typing');
  }
});
