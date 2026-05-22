#!/usr/bin/env node
/**
 * P0-SCHEMA-4 + NEW-1 — RLS policy probe (READ ONLY)
 * ------------------------------------------------------------
 * Round-2 quiz Q7 fix:
 *   We previously inferred RLS state from "anon GET returns 0 rows".
 *   That's circumstantial. Before writing Phase 5 codify migration we must
 *   actually query pg_policies + pg_class.relrowsecurity to know:
 *     (a) Is RLS enabled on each table?
 *     (b) What policies exist (name, cmd, USING expr, WITH CHECK expr)?
 *     (c) Codify migration MUST reproduce or improve — never blind-add.
 *
 * Caveat: PostgREST does NOT expose information_schema / pg_catalog by default.
 *   We try 3 strategies in order:
 *     1. Hypothetical RPC `exec_sql` / `query` (likely 404 — already proven by Agent A)
 *     2. supabase-js .from('pg_policies') passthrough (if enabled in API exposure)
 *     3. Fallback: print the SQL the user must paste into Supabase Studio SQL editor
 *
 *   Strategy 3 is the realistic outcome — the script becomes a documented
 *   probe + manual-paste helper.
 *
 * ABSOLUTELY NO WRITES.
 */

require('dotenv').config({
  path: require('path').join(__dirname, '..', '.env'),
});
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const PROBE_SQL = `
-- Run this in Supabase Studio SQL editor (service-role auth)
-- to extract current RLS state. Paste output back to the migration author.

-- (1) RLS enabled flag per table
SELECT n.nspname AS schema,
       c.relname AS table,
       c.relrowsecurity AS rls_enabled,
       c.relforcerowsecurity AS rls_forced
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('nsm_sessions', 'circles_sessions')
ORDER BY c.relname;

-- (2) Policies per table (full body)
SELECT schemaname,
       tablename,
       policyname,
       permissive,
       roles,
       cmd,
       qual          AS using_expr,
       with_check    AS with_check_expr
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('nsm_sessions', 'circles_sessions')
ORDER BY tablename, policyname;

-- (3) Grants (for full picture)
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN ('nsm_sessions', 'circles_sessions')
ORDER BY table_name, grantee, privilege_type;
`.trim();

async function tryRpc(fnName) {
  try {
    const { data, error } = await sb.rpc(fnName, { query: 'SELECT 1' });
    if (!error && data) return true;
  } catch (_) { /* no-op */ }
  return false;
}

async function tryPassthrough(table) {
  try {
    const { data, error, status } = await sb.from(table).select('*').limit(5);
    return { ok: !error, status, sample: data?.length || 0, error: error?.message };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

(async () => {
  console.log('RLS POLICY PROBE — READ ONLY');
  console.log('SUPABASE_URL:', SUPABASE_URL);
  console.log('');

  // Strategy 1 — RPC
  console.log('--- Strategy 1: try SQL-exec RPC ---');
  for (const fn of ['exec_sql', 'execute_sql', 'sql', 'query', 'run_sql', 'pg_query']) {
    const ok = await tryRpc(fn);
    console.log(`  ${fn}: ${ok ? 'AVAILABLE' : 'not available'}`);
  }
  console.log('');

  // Strategy 2 — passthrough
  console.log('--- Strategy 2: try pg_policies / pg_class passthrough ---');
  for (const t of ['pg_policies', 'pg_class']) {
    const res = await tryPassthrough(t);
    console.log(`  ${t}: ${res.ok ? `OK (sample=${res.sample})` : `BLOCKED (${res.error || res.status})`}`);
  }
  console.log('');

  // Strategy 3 — print SQL for manual paste
  console.log('--- Strategy 3: paste this SQL into Supabase Studio SQL editor ---');
  console.log('  URL: https://supabase.com/dashboard/project/<your-project>/sql/new');
  console.log('');
  console.log('  Paste the SQL block below, copy the result, and save to:');
  console.log('  audit/rls-policies-snapshot-2026-05-22.md');
  console.log('');
  console.log('===== BEGIN SQL =====');
  console.log(PROBE_SQL);
  console.log('===== END SQL =====');
  console.log('');
  console.log('After Studio output is saved, Phase 5 migration author can compose');
  console.log('  migrations/2026-05-22-rls-codify.sql that reproduces existing');
  console.log('  policies verbatim + adds missing ones (e.g. circles_sessions).');
})().catch((e) => {
  console.error('ERROR:', e.message || e);
  process.exit(1);
});
