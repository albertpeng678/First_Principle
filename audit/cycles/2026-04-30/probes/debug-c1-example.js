const { chromium } = require('@playwright/test');
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 360, height: 780 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await page.goto('http://localhost:4000/?onboarding=0', { waitUntil: 'networkidle' });
  // simulate C1 entry via clicking first card
  await page.evaluate(() => {
    const q = window.CIRCLES_QUESTIONS.find(x => x.question_type === 'design');
    AppState.circlesMode = 'simulation';
    AppState.circlesSelectedQuestion = q;
    AppState.circlesSimStep = 0; // C1
    AppState.circlesPhase = 1;
    AppState.circlesDrillStep = 'C1';
    AppState.circlesSession = { id: 'probe-c1-x', mode: 'simulation', drill_step: 'C1' };
    AppState.view = 'circles';
    render();
  });
  await page.waitForTimeout(500);
  const btn = await page.$('.field-example-toggle');
  if (btn) {
    await btn.click();
    await page.waitForTimeout(1500);
    const r = await page.evaluate(() => ({
      open: document.querySelectorAll('.field-example-body.open').length,
      collapseBtns: Array.from(document.querySelectorAll('.field-example-toggle')).filter(b => /收起範例/.test(b.textContent||'')).length,
    }));
    console.log('C1 example open:', JSON.stringify(r));
  }
  await browser.close();
})();
