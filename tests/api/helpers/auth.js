// tests/api/helpers/auth.js
// Gets a real Supabase JWT for e2e@first-principle.test by calling
// the Supabase auth REST endpoint directly via node-fetch/https.
//
// Per api-testing.md §Request Fixtures: "Login via API to get a token."
// Per when-to-mock.md: auth is our own system — use real auth, not mocked.
// The Stage 0 ruling uses e2e@first-principle.test for all real API tests.
//
// Note: uses node's built-in https (no Playwright request fixture needed here),
// because request.newContext() is only available on playwright.request (APIRequest)
// not on the test-scoped request fixture (APIRequestContext).
//
// Usage: const token = await getE2eToken();

const path = require('path');
const https = require('https');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '..', '.env.local') });
require('dotenv').config({ path: path.join(__dirname, '..', '..', '..', '.env'), override: false });

const SUPABASE_URL  = process.env.SUPABASE_URL;
const SUPABASE_ANON = process.env.SUPABASE_ANON_KEY;
const TEST_EMAIL    = process.env.TEST_EMAIL    || 'e2e@first-principle.test';
const TEST_PASSWORD = process.env.TEST_PASSWORD || 'FFq2thIF1dSSziVc';

let _cachedToken = null;

/**
 * Sign in with e2e test account and return a Bearer token.
 * Caches within a single test run to avoid repeated auth round-trips.
 * Uses native https to avoid Playwright fixture scope constraints.
 * @returns {Promise<string>} JWT access token
 */
async function getE2eToken() {
  if (_cachedToken) return _cachedToken;

  const url = new URL(`${SUPABASE_URL}/auth/v1/token?grant_type=password`);
  const body = JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD });

  const token = await new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: url.hostname,
        path: url.pathname + url.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
          'apikey': SUPABASE_ANON,
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          if (res.statusCode >= 400) {
            reject(new Error(`getE2eToken: Supabase sign-in ${res.statusCode}: ${data}`));
            return;
          }
          try {
            const parsed = JSON.parse(data);
            resolve(parsed.access_token);
          } catch (e) {
            reject(new Error(`getE2eToken: JSON parse failed: ${data}`));
          }
        });
      }
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });

  _cachedToken = token;
  return _cachedToken;
}

// Per test-organization.md anti-pattern "Shared mutable state": reset cache between test files
// if running in same process. For workers=1 serial runs this is fine as-is.
function clearTokenCache() {
  _cachedToken = null;
}

module.exports = { getE2eToken, clearTokenCache };
