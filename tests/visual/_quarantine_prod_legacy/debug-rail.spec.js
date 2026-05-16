// Debug spec — figure out why recent-rail shows 尚無近期練習 even with 4 sessions
const { test } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const OUT_DIR = path.join(__dirname, '../../audit/debug-rail');
fs.mkdirSync(OUT_DIR, { recursive: true });

test('rail state dump', async ({ page }, testInfo) => {
  testInfo.setTimeout(120_000);
  const vp = testInfo.project.name;
  if (vp !== 'Desktop-1280') return; // single vp is enough for debug

  // Capture console errors
  const consoleMsgs = [];
  page.on('console', msg => consoleMsgs.push({ type: msg.type(), text: msg.text() }));
  page.on('pageerror', err => consoleMsgs.push({ type: 'pageerror', text: String(err) }));

  await page.goto('/');
  await page.waitForSelector('.qcard, .auth-card', { timeout: 20000 });
  const authVisible = await page.locator('.auth-card').count();
  if (!authVisible) {
    await page.evaluate(() => {
      window.AppState.accessToken = null;
      window.AppState.userEmail = null;
      window.AppState.view = 'auth';
      window.AppState.authTab = 'login';
      window.render();
    });
    await page.waitForSelector('.auth-card', { timeout: 5000 });
  }
  await page.locator('#auth-email').fill('albertpeng678@gmail.com');
  await page.locator('#auth-pw').fill('21345678');
  await page.locator('#auth-submit').click();
  await page.waitForSelector('.auth-card', { state: 'detached', timeout: 20000 });
  await page.waitForSelector('.qcard', { timeout: 15000 });

  // Wait 5s for rail load
  await page.waitForTimeout(5000);

  // Manually re-run loadHistoryForRail and trace
  const traceResult = await page.evaluate(async () => {
    const out = {};
    try {
      const circlesPath = window.AppState.accessToken ? '/api/circles-sessions' : '/api/guest-circles-sessions';
      const nsmPath     = window.AppState.accessToken ? '/api/nsm-sessions'     : '/api/guest/nsm-sessions';
      out.paths = { circles: circlesPath, nsm: nsmPath };
      const results = await Promise.all([
        window.apiFetch(circlesPath),
        window.apiFetch(nsmPath),
      ]);
      out.circlesOk = results[0].ok;
      out.nsmOk = results[1].ok;
      const circles = await results[0].json();
      const nsm     = await results[1].json();
      out.circlesIsArr = Array.isArray(circles);
      out.nsmIsArr = Array.isArray(nsm);
      out.circlesLen = Array.isArray(circles) ? circles.length : 'NA';
      out.nsmLen = Array.isArray(nsm) ? nsm.length : 'NA';
      const merged = [].concat(circles || [], (nsm || []).map(function (n) { n._isNsm = true; return n; }));
      out.mergedLen = merged.length;
      merged.sort(function (a, b) {
        return new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at);
      });
      out.mergedSortedFirst3 = merged.slice(0, 3).map(m => ({ id: m.id, qid: m.question_id, _isNsm: m._isNsm, updated: m.updated_at, created: m.created_at }));
    } catch (e) {
      out.err = String(e);
      out.errCode = e.code;
    }
    return out;
  });

  // Dump everything
  const state = await page.evaluate(async () => {
    const out = {};
    out.railState = window.AppState.circlesRecentSessions;
    out.railLength = window.AppState.circlesRecentSessions ? window.AppState.circlesRecentSessions.length : null;

    // Manually run the same fetch that loadHistoryForRail would do
    try {
      const [cRes, nRes] = await Promise.all([
        window.apiFetch('/api/circles-sessions'),
        window.apiFetch('/api/nsm-sessions'),
      ]);
      out.circlesOk = cRes.ok;
      out.circlesStatus = cRes.status;
      out.nsmOk = nRes.ok;
      out.nsmStatus = nRes.status;
      const c = await cRes.json();
      const n = await nRes.json();
      out.circlesType = Array.isArray(c) ? 'array' : typeof c;
      out.circlesLen = Array.isArray(c) ? c.length : null;
      out.circlesKeys = Array.isArray(c) ? null : Object.keys(c || {});
      out.nsmType = Array.isArray(n) ? 'array' : typeof n;
      out.nsmLen = Array.isArray(n) ? n.length : null;
      out.nsmKeys = Array.isArray(n) ? null : Object.keys(n || {});
      out.circlesFirstItem = Array.isArray(c) && c[0] ? { id: c[0].id, question_id: c[0].question_id, status: c[0].status } : null;
      out.nsmFirstItem = Array.isArray(n) && n[0] ? { id: n[0].id, question_id: n[0].question_id, status: n[0].status } : null;
    } catch (e) {
      out.fetchErr = String(e);
      out.fetchErrCode = e.code;
    }

    return out;
  });

  fs.writeFileSync(`${OUT_DIR}/state.json`, JSON.stringify(state, null, 2));
  fs.writeFileSync(`${OUT_DIR}/trace.json`, JSON.stringify(traceResult, null, 2));
  fs.writeFileSync(`${OUT_DIR}/console.json`, JSON.stringify(consoleMsgs, null, 2));
  await page.screenshot({ path: `${OUT_DIR}/home.png`, fullPage: false });
});
