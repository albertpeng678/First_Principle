const { test, expect } = require('@playwright/test');

test.describe('NSM Step 1 — viewport-conditional card order (mockup 06)', () => {
  async function gotoNsm(page) {
    await page.route('**/api/circles-stats**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"completed":0,"active":0,"weeklyCompleted":0}' }));
    await page.route('**/api/circles-sessions**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.route('**/api/guest-circles-sessions**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.route('**/api/nsm-sessions**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.route('**/api/guest/nsm-sessions**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.goto('/');
    await page.waitForSelector('.navbar');
    // Use JS click to bypass display:none on mobile (navbar tabs hidden <480px per style.css:478)
    await page.locator('[data-nav="nsm"]').first().evaluate(el => el.click());
    await page.waitForSelector('.nsm-q-card');
  }

  // Helper: get the visible nsm-q-list (mobile uses nsm-body > nsm-q-list, desktop uses nsm-desktop-shell)
  // Both mobile and desktop shells exist in DOM; select the visible one's cards.
  function visibleCards(page) {
    return page.locator('.nsm-q-card').filter({ visible: true });
  }
  function selectedCard(page) {
    return page.locator('.nsm-q-card.is-selected').filter({ visible: true }).first();
  }

  // ── Mobile 1-col: 當筆 in-place expand ──────────────────────────
  test('mobile-360 點第 1 筆 → selected 視覺仍在第 1 個位置 (order:0)', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 1100 });
    await gotoNsm(page);
    const all = visibleCards(page);
    await all.first().click();
    await page.waitForSelector('.nsm-q-card.is-selected .nsm-context');
    const selBox = await selectedCard(page).boundingBox();
    const secondBox = await all.nth(1).boundingBox();
    expect(selBox.y).toBeLessThan(secondBox.y);
    const orderProp = await selectedCard(page).evaluate(el => getComputedStyle(el).order);
    expect(orderProp).toBe('0');
  });

  test('mobile-360 點第 3 筆 → selected 仍在第 3 個視覺位置', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 1100 });
    await gotoNsm(page);
    const all = await visibleCards(page).all();
    if (all.length < 3) { test.skip(); return; }
    const targetQid = await all[2].getAttribute('data-qid');
    await all[2].click();
    await page.waitForSelector('.nsm-q-card.is-selected .nsm-context');
    // 第 3 筆 expanded：前 2 個卡的 y 應 < selected.y < 第 4 個卡的 y
    const allAfter = await visibleCards(page).all();
    const selBox = await selectedCard(page).boundingBox();
    const card0Box = await allAfter[0].boundingBox();
    const card1Box = await allAfter[1].boundingBox();
    expect(card0Box.y).toBeLessThan(selBox.y);
    expect(card1Box.y).toBeLessThan(selBox.y);
    if (allAfter.length > 3) {
      const card3Box = await allAfter[3].boundingBox();
      expect(selBox.y).toBeLessThan(card3Box.y);
    }
    expect(await selectedCard(page).getAttribute('data-qid')).toBe(targetQid);
    // code-reviewer 建議 #2 — 雙保險：mobile in-place 鐵律 order==0
    const selOrder = await selectedCard(page).evaluate(el => getComputedStyle(el).order);
    expect(selOrder).toBe('0');
  });

  test('iPhone-SE (375) 點第 1 筆 → selected 仍視覺在前', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await gotoNsm(page);
    const all = visibleCards(page);
    await all.first().click();
    await page.waitForSelector('.nsm-q-card.is-selected .nsm-context');
    const selBox = await selectedCard(page).boundingBox();
    const secondBox = await all.nth(1).boundingBox();
    expect(selBox.y).toBeLessThan(secondBox.y);
  });

  // ── Tablet/Desktop 2-col: order:999 推末位避免 grid 破洞 ──────────
  test('tablet-768 點第 1 筆 → selected order:999 推末位（保留 becce460 fix）', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1100 });
    await gotoNsm(page);
    const all = visibleCards(page);
    await all.first().click();
    await page.waitForSelector('.nsm-q-card.is-selected .nsm-context');
    const orderProp = await selectedCard(page).evaluate(el => getComputedStyle(el).order);
    expect(orderProp).toBe('999');
  });

  test('desktop-1280 點第 1 筆 → selected order:999 推末位', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 1100 });
    await gotoNsm(page);
    const all = visibleCards(page);
    await all.first().click();
    await page.waitForSelector('.nsm-q-card.is-selected .nsm-context');
    const orderProp = await selectedCard(page).evaluate(el => getComputedStyle(el).order);
    expect(orderProp).toBe('999');
    // 跨 2 col
    const selBox = await selectedCard(page).boundingBox();
    const listBox = await page.locator('.nsm-q-list').filter({ visible: true }).first().boundingBox();
    expect(selBox.width).toBeGreaterThan(listBox.width * 0.9);
  });

  test('desktop-1280 grid 不破洞：5 卡 + 1 expanded → 共 3 row（2×2 + 1 row 全寬）', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 1100 });
    await gotoNsm(page);
    const all = visibleCards(page);
    const count = await all.count();
    if (count !== 5) { test.skip(); return; }
    await all.first().click();
    await page.waitForSelector('.nsm-q-card.is-selected .nsm-context');
    // collect Y 座標 unique values（quantize 10px）for visible cards
    const ys = await all.evaluateAll(els =>
      els.map(el => Math.round(el.getBoundingClientRect().top / 10) * 10)
    );
    const uniqueRows = [...new Set(ys)];
    expect(uniqueRows.length).toBe(3); // 3 rows tight, no holes
  });
});
