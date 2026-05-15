#!/usr/bin/env node
/**
 * One-time test account registration on prod.
 * Usage:  node scripts/register-test-account.js
 * Reads:  BASE_URL, TEST_EMAIL, TEST_PASSWORD from .env.test (must exist)
 * Action: POST /api/auth/register; if 200 ok, prints success;
 *         if "already exists" detected, prints idempotent note;
 *         otherwise exits non-zero.
 */
require('dotenv').config({ path: '.env.test' });

const BASE_URL = (process.env.BASE_URL || '').replace(/\/$/, '');
const EMAIL    = process.env.TEST_EMAIL;
const PASSWORD = process.env.TEST_PASSWORD;

if (!BASE_URL || !EMAIL || !PASSWORD) {
  console.error('Missing env: BASE_URL, TEST_EMAIL, TEST_PASSWORD must all be set in .env.test');
  process.exit(1);
}

async function register() {
  const res = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

(async () => {
  try {
    console.log(`Registering ${EMAIL} at ${BASE_URL}...`);
    const { status, body } = await register();

    // Success: status 200/201 with ok=true OR userId present
    if ((status === 200 || status === 201) && (body.ok || body.userId || body.user)) {
      const id = body.userId || (body.user && body.user.id) || '<unknown>';
      console.log(`SUCCESS: account created (userId=${id})`);
      process.exit(0);
    }

    // Idempotent: status 400/409 with error mentioning "already"
    if ((status === 400 || status === 409) && /already|exist|duplicate/i.test(body.error || body.message || '')) {
      console.log(`NOTE: account "${EMAIL}" already exists at ${BASE_URL}.`);
      console.log(`  - If you set this password yourself, you can log in with it.`);
      console.log(`  - If a previous run failed mid-write, the saved TEST_PASSWORD in .env.test should still work.`);
      console.log(`  - If the password no longer works, reset via Supabase admin dashboard then update .env.test.`);
      process.exit(0);
    }

    console.error(`FAILED: status=${status}, body=${JSON.stringify(body)}`);
    process.exit(1);
  } catch (e) {
    console.error(`NETWORK ERROR: ${e.message}`);
    process.exit(2);
  }
})();
