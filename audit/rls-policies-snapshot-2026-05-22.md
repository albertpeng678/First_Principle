# RLS Policies Snapshot — 2026-05-22

Source: user manual paste from Supabase Studio SQL editor (Playwright auto-probe failed login flow; user pasted result).
Project: `klvlizxmvzfpvfgswmfk`

---

## (1) RLS enabled per table

| schema | table_name | rls_enabled | rls_forced |
|---|---|---|---|
| public | circles_sessions | **true** | false |
| public | nsm_sessions | **true** | false |

**Both tables have RLS ON.** `rls_forced=false` means service-role / postgres bypass policies (normal Supabase behavior).

---

## (2) Policies per table

### `circles_sessions` — 1 policy (BUG — too permissive for guests)

| policyname | cmd | using_expr |
|---|---|---|
| `users own their circles sessions` | ALL | `(((auth.uid() IS NOT NULL) AND (user_id = auth.uid())) OR ((auth.uid() IS NULL) AND (guest_id IS NOT NULL)))` |

**Vulnerability**: the second OR clause `(auth.uid() IS NULL) AND (guest_id IS NOT NULL)` lets ANY anon-key request read EVERY guest session — only checks that `guest_id` exists, NOT that it matches the requester's actual guest_id. This is why Agent A's anon probe saw 608 rows + leaked guest_id UUIDs.

### `nsm_sessions` — 2 policies (correct design)

| policyname | cmd | using_expr |
|---|---|---|
| `auth_users_own_nsm_sessions` | ALL | `auth.uid() = user_id` |
| `guest_own_nsm_sessions` | ALL | `(guest_id IS NOT NULL) AND (guest_id = (SELECT COALESCE(((current_setting('request.headers', true))::jsonb ->> 'x-guest-id'), '')))` |

**Correct**: anon must send `x-guest-id: <uuid>` header AND server-side equality check filters; without header → 0 rows (matches Agent A scan).

---

## (3) Role grants

Both tables grant ALL (SELECT/INSERT/UPDATE/DELETE/TRUNCATE/TRIGGER/REFERENCES) to `anon`, `authenticated`, `postgres`, `service_role`. This is normal Supabase pattern — RLS policies do the actual row-level filtering. Grants alone don't expose data when RLS is on.

---

## §4 Implications for P0 SCHEMA fix wave

### P0-SCHEMA-NEW-1 (CIRCLES anon leak) — **scope shrinks dramatically**

**Original plan**: enable RLS on CIRCLES + write policy from scratch + dashboard step + codify migration.

**Revised plan**: RLS already on; only need to **revise the existing CIRCLES policy** to mirror NSM's `x-guest-id` header pattern.

```sql
-- migrations/2026-05-22-fix-circles-rls-guest-policy.sql
-- Round-3 finding: existing CIRCLES policy allows anon to read ANY guest row.
-- Tighten the guest branch to require x-guest-id header match (mirror NSM design).

DROP POLICY IF EXISTS "users own their circles sessions" ON public.circles_sessions;

-- Split into 2 policies matching NSM pattern.
CREATE POLICY "auth_users_own_circles_sessions"
  ON public.circles_sessions FOR ALL TO public
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "guest_own_circles_sessions"
  ON public.circles_sessions FOR ALL TO public
  USING (
    guest_id IS NOT NULL
    AND guest_id = (
      SELECT COALESCE(
        ((current_setting('request.headers', true))::jsonb ->> 'x-guest-id'),
        ''
      )
    )
  )
  WITH CHECK (
    guest_id IS NOT NULL
    AND guest_id = (
      SELECT COALESCE(
        ((current_setting('request.headers', true))::jsonb ->> 'x-guest-id'),
        ''
      )
    )
  );
```

### P0-SCHEMA-4 (NSM RLS codify) — **also simplifies**

NSM policies already exist + work correctly. Phase 5 = just codify both NSM policies verbatim into a migration so they're reproducible on replatform / dashboard reset. No behavior change.

### Required pre-flight verification before applying CIRCLES fix

Check whether FE / BE actually sends `x-guest-id` header on guest CIRCLES requests:
- `public/app.js` — does `apiFetch` include this header for guest flow?
- `routes/guest-circles-sessions.js` — does it pass through `x-guest-id`?

If FE/BE doesn't send the header, applying the new policy will **break all guest CIRCLES traffic**. This is the irreversible-risk check per `addy:doubt-driven-development`.

---

## §5 Quiz round-2 Q7 final answer

NSM RLS is enabled AND has 2 correctly-designed policies (one for authed, one for guest with header check). CIRCLES RLS is enabled but has 1 overly-permissive policy on guest path. The fix scope is much smaller than originally estimated.

Both findings confirmed via real `pg_policies` query — IL-2 verification gate satisfied.
