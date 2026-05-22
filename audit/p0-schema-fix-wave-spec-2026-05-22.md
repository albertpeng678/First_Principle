# P0 SCHEMA Fix Wave — Spec & Plan (2026-05-22)

> **Post round-2 quiz** — all 6 BLOCKED items addressed.
> **Source of truth** for the 5 P0 fixes ordered NEW-1 → 1-v2 (ship+soak) → 3 → 2 → 4.
> Per `feedback_update_claude_md_and_tracker_on_ship` — must sync CLAUDE.md + tracker on each ship.

---

## §1 Round-2 quiz 6 BLOCKED items resolution

| # | Quiz Q | Fix applied | Evidence |
|---|---|---|---|
| 1 | Q1 dedupe null bug — `${user_id}::${question_id}` collapses guests | Group key now `u:{user_id}::{qid}` OR `g:{guest_id}::{qid}` OR `orphan:{id}` | `scripts/dedupe-nsm-dry-run.js` re-run: 61 groups, 514 deletes (was 163/6790 illusion) |
| 2 | Q2 RLS spec TC1/TC2 wrong payload schema | TC1 → `{questionId, questionJson}` per `routes/nsm-sessions.js:19-20`; TC2 → `{questionId, questionJson, mode}` per `routes/circles-sessions.js:27-29` | `tests/api/rls-cross-user-isolation.spec.js` updated |
| 3 | Q3 coerce wrap nullable contract | Canonical-shape constructor below (§3) — handles string/null/undefined/non-object | See §3 |
| 4 | Q4 OpenAI mock decision | shape-contract spec stubs `/evaluate` per playwright-skill `core/network-mocking.md`; real-OpenAI lane tagged `@expensive` | See §4 |
| 5 | Q5 latency single-shot noise | DROP `expect.poll(latency).toBeLessThan(20)` from Phase 3. Replace with `EXPLAIN ANALYZE` proof in commit message | See §5 |
| 6 | Q7 NSM RLS policy unknown | Pre-flight `pg_policies` probe via service-role node script BEFORE Phase 5 codify migration | See §7 |

---

## §2 Execution order (locked)

1. **NEW-1** CIRCLES RLS leak (most urgent — anon currently reads 608 rows)
2. **SCHEMA-1-v2** evaluate path shape unify (FE 2 lines + BE 4 coerce sites)
3. **24h soak** — let SCHEMA-1-v2 settle; if any FE still sends string, BE coerce captures it
4. **SCHEMA-3** guest_id index (1-line migration, no-tx file)
5. **SCHEMA-2** dedupe DML + UNIQUE partial index DDL (2 migration files per Context7)
6. **SCHEMA-4** NSM RLS codify (after §7 pg_policies probe)

---

## §3 Canonical coerce wrap (SCHEMA-1-v2 BE)

**Wrong** (round-1 proposal): `typeof userNsm === 'string' ? {nsm: userNsm, ...} : userNsm` — leaks null/undefined.

**Correct** canonical-shape constructor:

```js
function coerceUserNsm(input) {
  if (input && typeof input === 'object' && !Array.isArray(input)) {
    return {
      nsm:          typeof input.nsm === 'string' ? input.nsm : '',
      explanation:  typeof input.explanation === 'string' ? input.explanation : '',
      businessLink: typeof input.businessLink === 'string' ? input.businessLink : '',
    };
  }
  if (typeof input === 'string') {
    return { nsm: input, explanation: '', businessLink: '' };
  }
  // null / undefined / number / array / boolean
  return { nsm: '', explanation: '', businessLink: '' };
}
```

**Apply at 4 BE sites** (per Agent E):
- `routes/nsm-sessions.js:140` (`/evaluate` final UPDATE)
- `routes/nsm-sessions.js:228` (PATCH `/progress`)
- `routes/guest-nsm-sessions.js:114` (`/evaluate`)
- `routes/guest-nsm-sessions.js:181` (PATCH `/progress`)

**FE fix** (per Agent E):
- `public/app.js:2016` `userNsm: (AppState.nsmDefinition||{}).nsm || ''` → `userNsm: AppState.nsmDefinition || { nsm: '', explanation: '', businessLink: '' }`
- `public/app.js:2518` same

---

## §4 OpenAI mock decision (Phase 2 e2e)

Two-tier spec strategy per playwright-skill `core/network-mocking.md`:

**Tier 1 — `tests/api/nsm-evaluate-shape-contract.spec.js`** (cheap, every CI run):
```js
await page.route('**/api/nsm-sessions/*/evaluate', (route) => {
  if (route.request().method() === 'POST') {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ scores: { reach: 8, depth: 7, frequency: 6 }, totalScore: 70 }),
    });
  }
  return route.continue();
});
// Then trigger evaluate flow → assert UI renders → reload → GET via apiFetch →
// expect(body.user_nsm).toMatchObject({ nsm: String, explanation: String, businessLink: String })
```

**Tier 2 — `tests/api/@expensive/nsm-evaluate-real-openai.spec.js`** (rare, manual / nightly):
- Real OpenAI call
- Cost & flake gated; only run with `npx playwright test --grep @expensive`
- Excluded from `cross-plan-smoke` default lane

---

## §5 SCHEMA-3 index — DROP latency assertion

Replace `expect.poll(() => measureLatency()).toBeLessThan(20)` with:

1. Commit message MUST include `EXPLAIN ANALYZE` output BEFORE / AFTER index:
   ```
   BEFORE:
     Seq Scan on nsm_sessions (cost=0.00..876.42 rows=1 width=180)
     Filter: ((guest_id = ?) AND (lifecycle = 'created'))
     Rows Removed by Filter: 6976
     Execution Time: 47.234 ms
   AFTER:
     Index Scan using idx_nsm_sessions_lifecycle_guest on nsm_sessions
     Index Cond: ((guest_id = ?) AND (lifecycle = 'created'))
     Execution Time: 0.318 ms
   ```
2. Migration content (per Context7 Supabase docs — single-stmt, no-tx file):
   ```sql
   -- migrations/2026-05-22-nsm-guest-id-index.sql
   CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_nsm_sessions_lifecycle_guest
     ON nsm_sessions (guest_id, lifecycle, updated_at DESC)
     WHERE guest_id IS NOT NULL;
   ```

---

## §6 SCHEMA-2 dedupe — 2 migration files per Context7

**File 1 — DML (transactional)**: `migrations/2026-05-22-nsm-dedupe-created.sql`
```sql
-- Dedupe lifecycle=created rows keeping latest non-empty user_nsm.
-- Partition by COALESCE(user_id::text, 'g:'||guest_id::text) to keep distinct
-- guests separate (quiz Q1 fix).
BEGIN;
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY COALESCE(user_id::text, 'g:'||guest_id::text), question_id
           ORDER BY
             (user_nsm IS NOT NULL
                AND COALESCE(TRIM(user_nsm->>'nsm'), '') <> '') DESC,
             updated_at DESC NULLS LAST,
             created_at DESC NULLS LAST,
             id DESC
         ) AS rn
  FROM nsm_sessions
  WHERE lifecycle = 'created'
    AND (user_id IS NOT NULL OR guest_id IS NOT NULL)
)
DELETE FROM nsm_sessions WHERE id IN (SELECT id FROM ranked WHERE rn > 1);
COMMIT;
```

**File 2 — DDL (single-stmt, no-tx)**: `migrations/2026-05-22-nsm-unique-active.sql`
```sql
-- UNIQUE partial index for (owner, question_id) under active lifecycle.
-- CONCURRENTLY required to avoid table lock on prod.
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS uniq_active_user_nsm
  ON nsm_sessions (user_id, question_id)
  WHERE lifecycle = 'created' AND user_id IS NOT NULL;

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS uniq_active_guest_nsm
  ON nsm_sessions (guest_id, question_id)
  WHERE lifecycle = 'created' AND guest_id IS NOT NULL;
```

**Pre-flight required**: user must eyeball the **1 collision** (`584c67fb` q17 `ee133f7e` vs `fec01e08`) before File 1 runs. Spec `tests/api/nsm-dedupe-post-verify.spec.js` (post-migration): assert 0 dup groups.

---

## §7 SCHEMA-4 — pg_policies probe FIRST

Pre-flight script `scripts/probe-rls-policies.js` (write before Phase 5):
- service-role connect
- `SELECT polname, polcmd, polqual, polwithcheck FROM pg_policies WHERE schemaname='public' AND tablename IN ('nsm_sessions','circles_sessions')`
- output current policy text per table
- Migration content **MUST exactly reproduce** existing policies (or improve them only with explicit user approval)

This avoids the Q7 risk: blind `CREATE POLICY` might conflict with the existing dashboard-set policy that's already protecting NSM.

---

## §8 NEW-1 specific plan (CIRCLES RLS policy bug — most urgent)

**Revised post round-2 pg_policies snapshot** + **round-3 quiz APPROVED_WITH_NITS**:

CIRCLES RLS is already ON. Existing policy has overly-permissive guest OR clause. Replace with 2 separate policies mirroring NSM's correct design.

### §8.1 Migration (with explicit tx wrap per round-3 Q1)

```sql
-- migrations/2026-05-22-fix-circles-rls-guest-policy.sql
-- Tighten CIRCLES guest path to require x-guest-id header match (mirror NSM).
-- See audit/rls-policies-snapshot-2026-05-22.md for original policy + analysis.
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
```

### §8.2 Rollback (per round-3 Q4)

If TC3/TC5 fail post-migration:

```sql
-- audit/rollback-2026-05-22-circles-rls.sql (kept in audit/, ready to paste)
BEGIN;
DROP POLICY IF EXISTS "auth_users_own_circles_sessions" ON public.circles_sessions;
DROP POLICY IF EXISTS "guest_own_circles_sessions" ON public.circles_sessions;
CREATE POLICY "users own their circles sessions"
  ON public.circles_sessions FOR ALL TO public
  USING (((auth.uid() IS NOT NULL) AND (user_id = auth.uid()))
      OR ((auth.uid() IS NULL) AND (guest_id IS NOT NULL)));
COMMIT;
```

Restores exact pre-state (known-leaky baseline, not improvement, but no surprise).

### §8.3 E2E spec additions (per round-3 Q3)

`tests/api/rls-cross-user-isolation.spec.js` must include:
- **TC3** (existing) — anon WITHOUT header → 0 rows (proves policy denies)
- **TC5** (NEW) — anon WITH correct `x-guest-id` matching seeded row → 1 row returned (proves policy USING clause works affirmatively, not deny-all)
- **TC6** (NEW) — anon WITH wrong `x-guest-id` (different uuid) → 0 rows (proves no enumeration via guessed UUID)

### §8.4 Ship sequence

1. User open Supabase Studio → SQL editor → paste §8.1 migration → Run
2. Verify pg_policies via probe script: 2 new policies present, old one gone
3. `BASE_URL=http://localhost:4000 npx playwright test tests/api/rls-cross-user-isolation.spec.js --reporter=list`
   - TC1, TC2 → still PASS (auth path unchanged)
   - TC3 → now PASS (was RED before fix)
   - TC4 → still PASS (NSM unchanged)
   - TC5 → PASS (proves legitimate guest still works)
   - TC6 → PASS (proves no enumeration)
4. 5x consecutive serial 0 flake per RITUAL §3.18
5. Cross-vp per RITUAL §3.11
6. If any fail → paste §8.2 rollback into Supabase Studio
7. Commit + push migration file + spec update + audit doc
8. Sync `CLAUDE.md` + tracker §1 NEW-1 → §5 with commit SHA per `feedback_update_claude_md_and_tracker_on_ship`

---

## §9 Skill citations applied per stage

| Stage | RITUAL § / skill |
|---|---|
| pg_policies probe | playwright-skill `core/api-testing.md:783-848` (service-role data seeding carve-out) + RITUAL §3.8 |
| RLS spec | playwright-skill `core/multi-user-and-collaboration.md:27-58` + RITUAL §3.7 + §3.12 |
| coerce wrap unit test | `superpowers:test-driven-development` + addy `test-driven-development` |
| dedupe dry-run | RITUAL §3.16 + §3.17 (read-only, no stubs) |
| dedupe production migration | `addy:doubt-driven-development` (hoisted to stage 0 — irreversible) + Context7 Supabase docs |
| index migration | Context7 docs §1 + §2 (single-stmt no-tx, CONCURRENTLY) |
| OpenAI mock | playwright-skill `core/network-mocking.md` + RITUAL §3.2 Pitfall 11 carve-out |
| 5× consecutive | RITUAL §3.18 |
| cross-vp | RITUAL §3.11 (3 e2e projects) |
| commit + ship | `addy:shipping-and-launch` + `addy:git-workflow-and-versioning` + `feedback_update_claude_md_and_tracker_on_ship` |
| cold-Read evidence | RITUAL §6 #4 + `feedback_uiux_visual_only` + `feedback_audit_responsibility_on_director` |

---

## §10 Files produced (deliverables for round-3 quiz)

- ✅ `scripts/dedupe-nsm-dry-run.js` — Q1 fixed, re-run 514 deletes verified
- ✅ `tests/api/rls-cross-user-isolation.spec.js` — Q2 fixed (TC1+TC2 payload schema)
- ✅ This doc `audit/p0-schema-fix-wave-spec-2026-05-22.md` — Q3+Q4+Q5+Q6+Q7 specs locked
- ⏳ `scripts/probe-rls-policies.js` — to write before Phase 5
- ⏳ `migrations/2026-05-22-*.sql` — to write per §5/§6/§7
- ⏳ `tests/api/nsm-evaluate-shape-contract.spec.js` (mocked) — to write
- ⏳ `tests/api/nsm-dedupe-post-verify.spec.js` — to write
