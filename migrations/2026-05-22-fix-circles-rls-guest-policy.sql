-- P0-SCHEMA-NEW-1 fix: tighten CIRCLES guest RLS policy to require x-guest-id header match
-- ============================================================================
-- BACKGROUND:
--   Live pg_policies snapshot (audit/rls-policies-snapshot-2026-05-22.md) showed
--   existing policy "users own their circles sessions" has overly-permissive
--   guest OR clause: `(auth.uid() IS NULL AND guest_id IS NOT NULL)` lets ANY
--   anon-key request read EVERY guest row (Agent A scan: 608 rows leaked).
--   NSM has correct design using x-guest-id header match — mirror that here.
--
-- SAFETY:
--   - self FE (public/app.js:228) only uses supabaseClient.auth.* (no .from(...))
--   - self BE (db/client.js) uses SUPABASE_SERVICE_ROLE_KEY → bypasses RLS
--   - FE sends X-Guest-ID header (lowercased by PostgREST) on apiFetch
--   New policy mirrors NSM `guest_own_nsm_sessions` policy structure exactly.
--
-- ROLLBACK: see audit/rollback-2026-05-22-circles-rls.sql
-- VERIFY: tests/api/rls-cross-user-isolation.spec.js TC3 + TC5 + TC6
-- ============================================================================

BEGIN;

DROP POLICY IF EXISTS "users own their circles sessions" ON public.circles_sessions;

CREATE POLICY "auth_users_own_circles_sessions"
  ON public.circles_sessions FOR ALL TO public
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "guest_own_circles_sessions"
  ON public.circles_sessions FOR ALL TO public
  USING (
    guest_id IS NOT NULL
    AND guest_id = (SELECT COALESCE(
      ((current_setting('request.headers', true))::jsonb ->> 'x-guest-id'),
      ''
    ))
  )
  WITH CHECK (
    guest_id IS NOT NULL
    AND guest_id = (SELECT COALESCE(
      ((current_setting('request.headers', true))::jsonb ->> 'x-guest-id'),
      ''
    ))
  );

COMMIT;
