// tests/e2e/apiFetch-401-refresh-retry.spec.js
//
// C fix verification — apiFetch 401 → refreshSession → retry pattern.
// Validates Supabase canonical 401 retry pattern (per WebSearch 2026-05-17):
//   1. apiFetch returns 401 → call supabaseClient.auth.refreshSession()
//   2. On success → retry original request with new Bearer token
//   3. On failure → kick to login (original behavior preserved)
//
// Skill citations:
//   common-pitfalls.md Pitfall 11 — page.route ONLY for error simulation (carve-out)
//   common-pitfalls.md Pitfall 14 — test-local mutable state for hit counter
//   network-mocking.md 839-933   — intermittent failure pattern
//   authentication.md 29-70      — storageState reuse from auth.setup.js

'use strict';

const { test, expect } = require('@playwright/test');

test.describe('apiFetch 401 → refresh → retry (C fix 2026-05-17)', () => {
  test.use({ storageState: 'playwright/.auth/user.json' });

  test('AC-C-1: 401 on protected API → refreshSession() success → retry succeeds → no kick to login', async ({ page }) => {
    let postHitCount = 0;
    let firstBearer = null;
    let retryBearer = null;

    // Mock target API: first call → 401, second call → 200
    await page.route('**/api/nsm-sessions', async (route, request) => {
      if (request.method() !== 'POST') return route.continue();
      postHitCount++;
      const bearer = (request.headers()['authorization'] || '').replace(/^Bearer\s+/i, '');
      if (postHitCount === 1) {
        firstBearer = bearer;
        return route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'jwt expired' }) });
      }
      retryBearer = bearer;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ sessionId: 'test-session-after-refresh', lifecycle: 'created' }),
      });
    });

    // Mock supabase refresh endpoint to return a NEW different token
    await page.route('**/auth/v1/token**', async (route, request) => {
      const url = new URL(request.url());
      if (url.searchParams.get('grant_type') !== 'refresh_token') return route.continue();
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          access_token: 'NEW.REFRESHED.JWT.token',
          token_type: 'bearer',
          expires_in: 3600,
          refresh_token: 'new-refresh-token',
          user: { id: 'test-user-1', email: 'e2e@first-principle.test' },
        }),
      });
    });

    await page.goto('/');
    await page.waitForFunction(() => window.AppState && !!window.AppState.accessToken, { timeout: 15_000 });

    // Sanity: capture initial token
    const initialToken = await page.evaluate(() => window.AppState.accessToken);
    expect(initialToken).toBeTruthy();
    expect(initialToken).not.toBe('NEW.REFRESHED.JWT.token');

    // Trigger the apiFetch call
    const result = await page.evaluate(async () => {
      const res = await window.apiFetch('/api/nsm-sessions', {
        method: 'POST',
        body: JSON.stringify({ questionId: 'q1', questionJson: { id: 'q1' } }),
      });
      return { status: res.status, view: window.AppState.view, token: window.AppState.accessToken };
    });

    // Assertions
    expect(postHitCount).toBe(2);          // original + retry
    expect(firstBearer).toBe(initialToken); // first used old token
    expect(retryBearer).toBe('NEW.REFRESHED.JWT.token'); // retry used new token
    expect(result.status).toBe(200);       // retry succeeded
    expect(result.token).toBe('NEW.REFRESHED.JWT.token'); // AppState updated
    expect(result.view).not.toBe('auth');  // NOT kicked to login
  });

  test('AC-C-2: 401 on protected API → refreshSession() fails → user kicked to login (original behavior preserved)', async ({ page }) => {
    // Mock target API: always 401
    await page.route('**/api/nsm-sessions', async (route, request) => {
      if (request.method() !== 'POST') return route.continue();
      return route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'jwt expired' }) });
    });

    // Mock supabase refresh endpoint: 400 = refresh token also invalid
    await page.route('**/auth/v1/token**', async (route, request) => {
      const url = new URL(request.url());
      if (url.searchParams.get('grant_type') !== 'refresh_token') return route.continue();
      return route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'invalid_grant', error_description: 'refresh token expired' }),
      });
    });

    await page.goto('/');
    await page.waitForFunction(() => window.AppState && !!window.AppState.accessToken, { timeout: 15_000 });

    const result = await page.evaluate(async () => {
      const res = await window.apiFetch('/api/nsm-sessions', {
        method: 'POST',
        body: JSON.stringify({ questionId: 'q1', questionJson: { id: 'q1' } }),
      });
      return { status: res.status, view: window.AppState.view, token: window.AppState.accessToken };
    });

    expect(result.status).toBe(401);    // refresh failed → original 401 returned
    expect(result.token).toBeNull();    // token cleared
    expect(result.view).toBe('auth');   // kicked to login (original behavior preserved)
  });
});
