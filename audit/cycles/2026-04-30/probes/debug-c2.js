const { chromium } = require('@playwright/test');
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 360, height: 780 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await page.goto('http://localhost:4000/?onboarding=0', { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    const q = window.CIRCLES_QUESTIONS.find(x => x.question_type === 'design');
    AppState.circlesMode = 'simulation';
    AppState.circlesSelectedQuestion = q;
    AppState.circlesSimStep = 3;
    AppState.circlesPhase = 1;
    AppState.circlesDrillStep = 'C2';
    AppState.circlesSession = { id: 'probe-c2-x', mode: 'simulation', drill_step: 'C2' };
    AppState.view = 'circles';
    render();
  });
  await page.waitForTimeout(500);
  const info = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('.field-example-toggle'));
    return btns.map(b => {
      const r = b.getBoundingClientRect();
      return {
        text: (b.textContent||'').trim().slice(0,30),
        visible: b.offsetParent !== null,
        top: r.top, bottom: r.bottom, w: r.width, h: r.height,
        hasNextSibling: !!b.nextElementSibling,
        nextSiblingClass: b.nextElementSibling ? b.nextElementSibling.className : null,
      };
    });
  });
  console.log('toggles:', JSON.stringify(info, null, 2));
  // click first
  const btn = await page.$('.field-example-toggle');
  if (btn) {
    await btn.scrollIntoViewIfNeeded();
    const before = await page.evaluate(() => document.querySelectorAll('.field-example-body.open').length);
    await btn.click();
    await page.waitForTimeout(1500);
    const after = await page.evaluate(() => ({
      open: document.querySelectorAll('.field-example-body.open').length,
      collapseBtns: Array.from(document.querySelectorAll('.field-example-toggle')).filter(b => /收起範例/.test(b.textContent||'')).length,
      bodies: Array.from(document.querySelectorAll('.field-example-body')).map(b => ({open: b.classList.contains('open'), text: (b.textContent||'').slice(0,60)})),
    }));
    console.log('before open:', before, 'after:', JSON.stringify(after, null, 2));
  }
  await browser.close();
})();
