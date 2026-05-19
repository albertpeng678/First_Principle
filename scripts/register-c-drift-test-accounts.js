#!/usr/bin/env node
/**
 * Phase A prep #3 — provision 4 unique test users for Wave 2 parallel
 * implementers + verifier, so each lane has its own auth.users row and
 * drainSessions cleanup helpers cannot 互殺 between lanes (per #199).
 *
 * Users created:
 *   e2e+c-drift-1@first-principle.test
 *   e2e+c-drift-2@first-principle.test
 *   e2e+c-drift-3@first-principle.test
 *   e2e+c-drift-4@first-principle.test
 *
 * All share password = process.env.TEST_PASSWORD (same as e2e@ baseline).
 *
 * Auth path: Supabase service-role admin.createUser({ email_confirm: true }).
 * This bypasses email verification and is idempotent — re-running on an
 * already-registered user prints a NOTE and exits 0 for that user.
 *
 * Usage:  node scripts/register-c-drift-test-accounts.js
 * Env:    SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env
 *         TEST_PASSWORD in .env.local (or .env.test)
 */
require('dotenv').config({ path: '.env' });
require('dotenv').config({ path: '.env.local', override: false });
require('dotenv').config({ path: '.env.test', override: false });

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PASSWORD = process.env.TEST_PASSWORD;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing env: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY must be set in .env');
  process.exit(1);
}
if (!PASSWORD) {
  console.error('Missing env: TEST_PASSWORD must be set in .env.local or .env.test');
  process.exit(1);
}

const EMAILS = [
  'e2e+c-drift-1@first-principle.test',
  'e2e+c-drift-2@first-principle.test',
  'e2e+c-drift-3@first-principle.test',
  'e2e+c-drift-4@first-principle.test',
];

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

async function registerOne(email) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  });

  if (error) {
    const msg = String(error.message || '');
    // Idempotent path — supabase returns "already been registered" / "already exists"
    if (/already|exist|duplicate|registered/i.test(msg)) {
      return { email, status: 'exists', message: msg };
    }
    return { email, status: 'error', message: msg };
  }
  return { email, status: 'created', userId: data.user && data.user.id };
}

(async () => {
  console.log(`Registering ${EMAILS.length} c-drift accounts on ${SUPABASE_URL}...`);
  let failures = 0;
  for (const email of EMAILS) {
    try {
      const r = await registerOne(email);
      if (r.status === 'created') {
        console.log(`  CREATED  ${email}  (userId=${r.userId})`);
      } else if (r.status === 'exists') {
        console.log(`  EXISTS   ${email}  (idempotent: ${r.message})`);
      } else {
        console.error(`  FAILED   ${email}  (${r.message})`);
        failures += 1;
      }
    } catch (e) {
      console.error(`  ERROR    ${email}  (${e.message})`);
      failures += 1;
    }
  }
  if (failures > 0) {
    console.error(`\nDone with ${failures} failure(s).`);
    process.exit(1);
  }
  console.log('\nAll 4 c-drift accounts provisioned (created or already existed).');
})();
