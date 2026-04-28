const { test } = require('@playwright/test');

test.setTimeout(60000);

test('debug spotify session stuck', async ({ page }) => {
  const consoleLogs = [];
  page.on('console', msg => consoleLogs.push(`[${msg.type()}] ${msg.text()}`));

  const sessionGetBody = { value: null };
  page.on('response', async (resp) => {
    const url = resp.url();
    if (url.includes('/api/circles-sessions/') && !url.endsWith('circles-sessions/')) {
      try {
        const body = await resp.text();
        sessionGetBody.value = { url, status: resp.status(), body };
      } catch {}
    }
  });

  await page.goto('http://localhost:4000/');
  await page.waitForLoadState('networkidle');

  // Navigate to login
  await page.waitForSelector('#navbar-actions button', { timeout: 10000 });
  await page.evaluate(() => window.navigate('login'));
  await page.waitForSelector('#auth-form', { timeout: 5000 });
  await page.fill('#email', 'albertpeng678@gmail.com');
  await page.fill('#password', '21345678');
  await page.click('#auth-form button[type="submit"]');
  // Wait for auth-form to disappear (login completed)
  await page.waitForSelector('#auth-form', { state: 'hidden', timeout: 10000 }).catch(()=>{});
  await page.waitForTimeout(2000);

  // Verify logged in
  const loggedIn = await page.evaluate(() => !!window.AppState?.accessToken);
  console.log('logged in:', loggedIn);

  // Open offcanvas (sidebar with practice records)
  await page.evaluate(() => {
    const fn = window.openOffcanvas || window.toggleOffcanvas;
    if (typeof fn === 'function') fn();
    else document.querySelector('button.btn-icon, .ph-list, [data-offcanvas-toggle]')?.click();
  });
  await page.waitForTimeout(1500);

  const itemCount = await page.locator('.offcanvas-item').count();
  console.log('offcanvas items:', itemCount);

  // Click Spotify item
  const spotify = page.locator('.offcanvas-item:has-text("Spotify")').first();
  if (await spotify.count() === 0) {
    console.log('no Spotify item found. List:');
    console.log(await page.locator('.offcanvas-item').allInnerTexts());
    return;
  }
  await spotify.click();
  await page.waitForTimeout(3000);

  // Inspect AppState
  const state = await page.evaluate(() => {
    const a = window.AppState || {};
    return {
      phase: a.circlesPhase,
      mode: a.circlesMode,
      drillStep: a.circlesDrillStep,
      simStep: a.circlesSimStep,
      hasScoreResult: !!a.circlesScoreResult,
      stepScoreKeys: Object.keys(a.circlesStepScores || {}),
      C1HasScore: !!(a.circlesStepScores && a.circlesStepScores.C1),
      sessionId: a.circlesSession?.id,
      currentView: window.AppState?.currentView,
    };
  });
  console.log('STATE:', JSON.stringify(state, null, 2));

  const stuck = (await page.locator('body').innerText()).includes('評分結果載入中');
  console.log('STUCK:', stuck);

  if (sessionGetBody.value) {
    console.log('GET response status:', sessionGetBody.value.status);
    try {
      const j = JSON.parse(sessionGetBody.value.body);
      console.log('GET response keys:', Object.keys(j));
      console.log('  current_phase:', j.current_phase);
      console.log('  drill_step:', j.drill_step);
      console.log('  step_scores keys:', Object.keys(j.step_scores || {}));
      console.log('  step_scores.C1 exists:', !!(j.step_scores && j.step_scores.C1));
    } catch(e) {
      console.log('parse failed:', e.message);
      console.log(sessionGetBody.value.body.slice(0, 500));
    }
  } else {
    console.log('NO GET /:id response captured!');
  }

  console.log('\n--- console logs ---');
  consoleLogs.slice(-20).forEach(l => console.log(l));
});
