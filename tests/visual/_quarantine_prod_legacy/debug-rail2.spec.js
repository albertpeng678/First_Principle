// Debug v2 — hard-clear localStorage + fresh login + sample rail every 500ms × 10
const { test } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const OUT_DIR = path.join(__dirname, '../../audit/debug-rail2');
fs.mkdirSync(OUT_DIR, { recursive: true });

test('rail state sampled over time', async ({ page }, testInfo) => {
  testInfo.setTimeout(120_000);
  const vp = testInfo.project.name;
  if (vp !== 'Desktop-1280') return;

  const consoleMsgs = [];
  page.on('console', msg => consoleMsgs.push({ type: msg.type(), text: msg.text() }));
  page.on('pageerror', err => consoleMsgs.push({ type: 'pageerror', text: String(err) }));

  // Step 1: visit + force auth state (matches uat spec pattern)
  await page.goto('/');
  await page.waitForSelector('.qcard, .auth-card', { timeout: 20000 });
  const authVisible = await page.locator('.auth-card').count();
  if (!authVisible) {
    await page.evaluate(() => {
      window.AppState.accessToken = null;
      window.AppState.userEmail = null;
      window.AppState.view = 'auth';
      window.AppState.authTab = 'login';
      // Important: also reset rail to test fresh load behaviour
      window.AppState.circlesRecentSessions = null;
      window.render();
    });
    await page.waitForSelector('.auth-card', { timeout: 5000 });
  }

  // Step 2: login
  await page.locator('#auth-email').fill('albertpeng678@gmail.com');
  await page.locator('#auth-pw').fill('21345678');
  await page.locator('#auth-submit').click();
  await page.waitForSelector('.auth-card', { state: 'detached', timeout: 20000 });
  await page.waitForSelector('.qcard', { timeout: 15000 });

  // First: just call apiFetch raw and see how long it takes
  const directFetch = await page.evaluate(async () => {
    const t0 = Date.now();
    try {
      const r = await window.apiFetch('/api/circles-sessions');
      const t1 = Date.now();
      const j = await r.json();
      const t2 = Date.now();
      return { ok: r.ok, status: r.status, fetchMs: t1 - t0, jsonMs: t2 - t1, isArr: Array.isArray(j), len: Array.isArray(j) ? j.length : null };
    } catch (e) { return { err: String(e), elapsed: Date.now() - t0 }; }
  });
  fs.writeFileSync(`${OUT_DIR}/direct-fetch.json`, JSON.stringify(directFetch, null, 2));

  // Patch loadHistoryForRail to log everything
  await page.evaluate(() => {
    window._rail_log = [];
    const origLoad = async function () {
      const log = (msg, data) => window._rail_log.push({ t: Date.now(), msg, data });
      try {
        const circlesPath = window.AppState.accessToken ? '/api/circles-sessions' : '/api/guest-circles-sessions';
        const nsmPath = window.AppState.accessToken ? '/api/nsm-sessions' : '/api/guest/nsm-sessions';
        log('start', { circlesPath, nsmPath, token: !!window.AppState.accessToken });
        const results = await Promise.all([window.apiFetch(circlesPath), window.apiFetch(nsmPath)]);
        log('fetched', { circlesOk: results[0].ok, nsmOk: results[1].ok, cStatus: results[0].status, nStatus: results[1].status });
        if (!results[0].ok || !results[1].ok) throw new Error('history_load_error');
        const circles = await results[0].json();
        const nsm = await results[1].json();
        log('parsed', { cType: Array.isArray(circles) ? 'arr' : typeof circles, cLen: Array.isArray(circles) ? circles.length : 'NA', nType: Array.isArray(nsm) ? 'arr' : typeof nsm, nLen: Array.isArray(nsm) ? nsm.length : 'NA' });
        const merged = [].concat(circles || [], (nsm || []).map(n => { n._isNsm = true; return n; }));
        log('merged', { mergedLen: merged.length });
        merged.sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at));
        window.AppState.circlesRecentSessions = merged.slice(0, 5);
        log('set-success', { newLen: window.AppState.circlesRecentSessions.length });
        window.render();
      } catch (e) {
        log('catch', { msg: String(e), code: e.code });
        window.AppState.circlesRecentSessions = [];
        window.render();
      }
    };
    // Reset state and re-trigger
    window.AppState.circlesRecentSessions = null;
    origLoad();
  });

  // Step 3: sample rail state every 300ms for 10 seconds
  const samples = [];
  for (let i = 0; i < 33; i++) {
    const s = await page.evaluate(() => ({
      t: Date.now(),
      rail: window.AppState.circlesRecentSessions,
      railLen: Array.isArray(window.AppState.circlesRecentSessions) ? window.AppState.circlesRecentSessions.length : null,
      view: window.AppState.view,
      token: !!window.AppState.accessToken,
    }));
    samples.push({ i, ...s });
    if (s.rail !== null && Array.isArray(s.rail) && s.rail.length > 0) break;
    await page.waitForTimeout(300);
  }
  const t0 = samples[0]?.t || 0;
  samples.forEach(s => s.dt = s.t - t0);
  fs.writeFileSync(`${OUT_DIR}/samples.json`, JSON.stringify(samples, null, 2));
  fs.writeFileSync(`${OUT_DIR}/console.json`, JSON.stringify(consoleMsgs, null, 2));
  const railLog = await page.evaluate(() => window._rail_log || []);
  fs.writeFileSync(`${OUT_DIR}/rail-log.json`, JSON.stringify(railLog, null, 2));
  await page.screenshot({ path: `${OUT_DIR}/home-after-poll.png`, fullPage: false });
});
