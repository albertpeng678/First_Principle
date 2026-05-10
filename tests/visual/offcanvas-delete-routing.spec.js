// tests/visual/offcanvas-delete-routing.spec.js
// RED guard for offcanvas delete bug (UAT 2026-05-10):
// historyList merges circles + nsm sessions, but delete handler used to
// always hit /api/circles-sessions/:id. Deleting an NSM session would
// 404 silently — item disappeared from UI but reappeared on reload.
// Fix: route based on item kind (mirror loadCirclesSessionFromHistory heuristic).

const { test, expect } = require('@playwright/test');
const path = require('path');

const APP_URL = 'file://' + path.resolve(__dirname, '../../public/app.html');

test.describe('Offcanvas delete — routes to correct endpoint per session kind', () => {
  test('NSM session delete hits /api/nsm-sessions, NOT /api/circles-sessions', async ({ page }) => {
    let circlesDeleteHits = [];
    let nsmDeleteHits = [];

    await page.route('**/api/**', function (route) {
      const req = route.request();
      const url = req.url();
      const method = req.method();
      if (method === 'DELETE') {
        if (url.includes('/circles-sessions/')) circlesDeleteHits.push(url);
        if (url.includes('/nsm-sessions')) nsmDeleteHits.push(url);
      }
      // stub all responses
      if (method === 'DELETE') return route.fulfill({ status: 200, body: '{"ok":true}' });
      return route.fulfill({ status: 200, body: '[]' });
    });

    await page.goto(APP_URL);
    await page.waitForLoadState('networkidle');

    // Inject AppState with mixed historyList (1 circles + 1 nsm)
    await page.evaluate(() => {
      window.AppState.historyList = [
        { id: 'circles-id-1', mode: 'drill', drill_step: 'C1', question_json: { company: 'Spotify' }, updated_at: '2026-05-10T10:00:00Z' },
        { id: 'nsm-id-1', question_json: { company: 'Slack' }, scores_json: null, updated_at: '2026-05-10T11:00:00Z' },
      ];
      window.AppState.offcanvasOpen = true;
      window.AppState.guestId = 'test-guest';
      window.render();
    });

    await page.waitForSelector('[data-offcanvas="delete"][data-id="nsm-id-1"]');

    // Click delete on NSM item
    await page.click('[data-offcanvas="delete"][data-id="nsm-id-1"]');
    await page.waitForTimeout(300);

    expect(nsmDeleteHits.length, 'NSM delete should hit /api/nsm-sessions endpoint').toBeGreaterThan(0);
    expect(circlesDeleteHits.length, 'NSM delete should NOT hit /api/circles-sessions endpoint').toBe(0);
  });

  test('CIRCLES session delete still hits /api/circles-sessions', async ({ page }) => {
    let circlesDeleteHits = [];
    let nsmDeleteHits = [];

    await page.route('**/api/**', function (route) {
      const req = route.request();
      const url = req.url();
      const method = req.method();
      if (method === 'DELETE') {
        if (url.includes('/circles-sessions/')) circlesDeleteHits.push(url);
        if (url.includes('/nsm-sessions')) nsmDeleteHits.push(url);
      }
      if (method === 'DELETE') return route.fulfill({ status: 200, body: '{"ok":true}' });
      return route.fulfill({ status: 200, body: '[]' });
    });

    await page.goto(APP_URL);
    await page.waitForLoadState('networkidle');

    await page.evaluate(() => {
      window.AppState.historyList = [
        { id: 'circles-id-2', mode: 'drill', drill_step: 'I', question_json: { company: 'Netflix' }, updated_at: '2026-05-10T12:00:00Z' },
      ];
      window.AppState.offcanvasOpen = true;
      window.AppState.guestId = 'test-guest';
      window.render();
    });

    await page.waitForSelector('[data-offcanvas="delete"][data-id="circles-id-2"]');

    await page.click('[data-offcanvas="delete"][data-id="circles-id-2"]');
    await page.waitForTimeout(300);

    expect(circlesDeleteHits.length, 'CIRCLES delete should hit /api/circles-sessions endpoint').toBeGreaterThan(0);
    expect(nsmDeleteHits.length, 'CIRCLES delete should NOT hit /api/nsm-sessions endpoint').toBe(0);
  });
});
