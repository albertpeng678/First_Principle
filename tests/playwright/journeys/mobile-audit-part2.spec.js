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

test('mobile audit part2', async ({ page }) => {
  await page.setViewportSize({ width: 430, height: 932 });
  await login(page);

  // Phase3 score (open offcanvas → click Spotify completed)
  await page.evaluate(() => window.navigate('circles'));
  await page.waitForTimeout(800);
  await page.click('#btn-hamburger');
  await page.waitForTimeout(700);
  const item = page.locator('.offcanvas-item:has-text("Spotify")').first();
  await item.click();
  await page.waitForTimeout(2500);
  await page.screenshot({ path: 'mobile-audit/08-phase3-score.png', fullPage: true });

  // NSM home
  await page.evaluate(() => window.navigate('nsm'));
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'mobile-audit/09-nsm-home.png', fullPage: true });

  // review-examples list
  await page.goto('http://localhost:4000/review-examples.html');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'mobile-audit/10-review-examples.png', fullPage: true });

  // review expanded
  await page.locator('.card-header').first().click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'mobile-audit/11-review-expanded.png', fullPage: true });

  // CIRCLES q expanded with full card UI (model picker + drill step pills)
  await page.evaluate(() => window.navigate('circles'));
  await page.waitForTimeout(1000);
  await page.locator('.circles-q-card').first().click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'mobile-audit/12-circles-q-detail-modal.png', fullPage: true });

  // Login screen
  await page.evaluate(() => { localStorage.clear(); });
  await page.goto('http://localhost:4000/');
  await page.waitForSelector('#navbar-actions button', { timeout: 10000 });
  await page.evaluate(() => window.navigate('login'));
  await page.waitForSelector('#auth-form', { timeout: 5000 });
  await page.screenshot({ path: 'mobile-audit/13-login.png', fullPage: true });

  console.log('part2 done');
});
