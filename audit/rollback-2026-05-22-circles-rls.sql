-- ROLLBACK for migrations/2026-05-22-fix-circles-rls-guest-policy.sql
-- ============================================================================
-- If post-migration TC3/TC5/TC6 fail OR anon traffic starts erroring in prod,
-- paste this into Supabase Studio SQL editor to restore the pre-fix state.
--
-- This restores the KNOWN-LEAKY baseline (anon can read all guest_id rows).
-- That's worse than the new policy, but is a known-baseline rollback, not a
-- new surprise.
-- ============================================================================

BEGIN;

DROP POLICY IF EXISTS "auth_users_own_circles_sessions" ON public.circles_sessions;
DROP POLICY IF EXISTS "guest_own_circles_sessions" ON public.circles_sessions;

CREATE POLICY "users own their circles sessions"
  ON public.circles_sessions FOR ALL TO public
  USING (
    ((auth.uid() IS NOT NULL) AND (user_id = auth.uid()))
    OR
    ((auth.uid() IS NULL) AND (guest_id IS NOT NULL))
  );

COMMIT;
