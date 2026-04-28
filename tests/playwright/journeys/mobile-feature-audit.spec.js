// Mobile feature audit — full-page screenshots of every screen state
// in the existing mobile RWD, so we can build an exhaustive feature inventory
// before designing desktop equivalents.
const { test } = require('@playwright/test');

test.setTimeout(180000);

async function login(page) {
  await page.goto('http://localhost:4000/');
  await page.waitForSelector('#navbar-actions button', { timeout: 10000 });
  await page.evaluate(() => window.navigate('login'));
  await page.waitForSelector('#auth-form', { timeout: 5000 });
  await page.fill('#email', 'albertpeng678@gmail.com');
  await page.fill('#password', '21345678');
  await page.click('#auth-form button[type="submit"]');
  await page.waitForSelector('#auth-form', { state: 'hidden', timeout: 10000 }).catch(()=>{});
  await page.waitForTimeout(1500);
}

test('mobile feature audit @ iPhone-15-Pro 430x932', async ({ page }) => {
  await page.setViewportSize({ width: 430, height: 932 });
  await login(page);

  const shots = [];

  // 1. Home (after login lands on circles)
  await page.evaluate(() => window.navigate('home'));
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'mobile-audit/01-home.png', fullPage: true });
  shots.push('01-home');

  // 2. Hamburger / offcanvas
  await page.click('#btn-hamburger').catch(()=>{});
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'mobile-audit/02-offcanvas.png', fullPage: true });
  await page.click('#btn-offcanvas-close').catch(()=>{});
  await page.waitForTimeout(400);
  shots.push('02-offcanvas');

  // 3. CIRCLES home
  await page.evaluate(() => window.navigate('circles'));
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'mobile-audit/03-circles-home.png', fullPage: true });
  shots.push('03-circles-home');

  // 4. CIRCLES expand a question card
  const firstCard = page.locator('.circles-q-card').first();
  if (await firstCard.count()) {
    await firstCard.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'mobile-audit/04-circles-q-expanded.png', fullPage: true });
    shots.push('04-circles-q-expanded');
  }

  // 5. Phase 1 — drill mode confirm
  const drillBtn = page.locator('button:has-text("步驟加練"), button:has-text("專項")').first();
  if (await drillBtn.count()) await drillBtn.click();
  await page.waitForTimeout(400);
  const c1Btn = page.locator('button:has-text("C1"), [data-step="C1"]').first();
  if (await c1Btn.count()) {
    await c1Btn.click();
    await page.waitForTimeout(1000);
  }
  const confirmBtn = page.locator('.circles-q-confirm-btn').first();
  if (await confirmBtn.count()) {
    await confirmBtn.click();
    await page.waitForTimeout(1500);
  }
  await page.screenshot({ path: 'mobile-audit/05-phase1-form.png', fullPage: true });
  shots.push('05-phase1-form');

  // 6. Phase 1 hint overlay
  const hintBtn = page.locator('.circles-hint-trigger').first();
  if (await hintBtn.count()) {
    await hintBtn.click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: 'mobile-audit/06-phase1-hint.png', fullPage: true });
    // close hint
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  }
  shots.push('06-phase1-hint');

  // 7. Phase 1 example open
  const exBtn = page.locator('.field-example-toggle').first();
  if (await exBtn.count()) {
    await exBtn.click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'mobile-audit/07-phase1-example.png', fullPage: true });
  }
  shots.push('07-phase1-example');

  // 8. Phase 2 chat (need to fill phase 1 + submit gate)
  // We won't actually run phase 2 (too complex) — instead navigate to a completed session
  await page.evaluate(() => window.navigate('circles'));
  await page.waitForTimeout(1000);
  await page.click('#btn-hamburger').catch(()=>{});
  await page.waitForTimeout(600);
  const completedItem = page.locator('.offcanvas-item:has-text("Spotify")').first();
  if (await completedItem.count()) {
    await completedItem.click();
    await page.waitForTimeout(2500);
    await page.screenshot({ path: 'mobile-audit/08-phase3-score.png', fullPage: true });
    shots.push('08-phase3-score');
  }

  // 9. NSM home
  await page.evaluate(() => window.navigate('nsm'));
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'mobile-audit/09-nsm-home.png', fullPage: true });
  shots.push('09-nsm-home');

  // 10. review-examples
  await page.goto('http://localhost:4000/review-examples.html');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'mobile-audit/10-review-examples.png', fullPage: true });
  // expand first card
  const firstReviewCard = page.locator('.card-header').first();
  if (await firstReviewCard.count()) {
    await firstReviewCard.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'mobile-audit/11-review-expanded.png', fullPage: true });
    shots.push('11-review-expanded');
  }

  console.log('Captured', shots.length, 'screenshots');
});
