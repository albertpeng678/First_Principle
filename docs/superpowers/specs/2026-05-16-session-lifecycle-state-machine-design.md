# Session Lifecycle State Machine — Design Spec

**Date:** 2026-05-16
**Author:** Director (Opus 4.7) — written from aligned brainstorm
**Spec status:** Design; awaiting user 放行 before writing-plans decomposition
**Touches:** `circles_sessions` + `nsm_sessions` schema, all `/api/{circles,nsm}-sessions*` routes, cron job (new), `public/app.js` (read-side only)

---

## §1 Context

### 1.1 Problem (production-observed)

`練習記錄` drawer (`offcanvas-history` / mockup 09) currently shows a long tail of **empty draft skeletons** — sessions with no user input that pollute the list and bury legitimate practice records under noise. User cannot tell at a glance which rows are real work vs. ghosts.

### 1.2 Why this happens — the eager-INSERT pattern

To eliminate a documented FE↔BE race (Bug 6b + many bugs B1-H), the FE pre-creates a backend session row the moment a user lands on a CIRCLES or NSM page, **before** they type anything:

| File:line | Function | Trigger |
|---|---|---|
| `public/app.js:6927` | `preflightDraftSession` (CIRCLES) | Phase 1 mount, on every render where `circlesSession.id` is null |
| `public/app.js:1749` | `preflightNsmDraftSession` (NSM) | Step 2 / Step 3 mount |
| `public/app.js:3715` | `ensureCirclesDraftSession` | first textarea save (fallback) |
| `public/app.js:1724` | `ensureNsmDraftSession` | first NSM step transition (fallback) |

Each calls `POST /api/{circles,nsm}-sessions[/draft]` which inserts a row with `status='active'`, empty `framework_draft={}` / `user_nsm=''` / `user_breakdown={}`. This is **intentional and load-bearing** — it gives FE a stable `session_id` for:

1. Autosave PATCH idempotency
2. SSE channel binding (Phase 2 chat)
3. Cross-device resume (`tryResumeLatestSession`)
4. Pre-emptive mutex anchor (B6 race fix)

We will **not** remove the eager-INSERT. We will instead **classify** rows by user-content state and **filter** the list view.

### 1.3 Why a state column (not a derived predicate)

A pure "is the session non-empty?" view filter would work but has three problems:

- **Performance** — JSON `?` / length checks across N fields, every list query, no index.
- **Ambiguity** — "non-empty" depends on each field's stub default (`''` / `{}` / `null`). Easy to drift as fields are added.
- **Auditability** — cron cleanup needs an indexable predicate ("created and never touched in 24h"); a derived predicate is fragile here.

An explicit `lifecycle` enum column is small, surgical, indexable, and gives us a single source of truth all four layers share.

### 1.4 Constraints carried in from prior work

- **Iron Laws** apply (root cause / verification / TDD). This spec encodes the root cause as a state model, not as patches.
- **B1-B8 + Stage 1A race fixes are LOCKED.** `AppState.gateInflight`, `_resumePromise`, `_phase1PreflightInFlightForQid`, `_nsmPreflightInFlightForQid`, `restoreCirclesPhase1FromSession`, `tryResumeLatestSession` Bugs B/D/E/F/G — none of these change. Lifecycle transitions ride on top of existing PATCH/POST handlers.
- **Path 2 carve-out** — backend prompts / DB rows / jest semantics frozen *except* this change, which is explicitly user-approved.
- **No FE rule changes** — FE keeps PATCHing the same payloads. The server derives lifecycle from payload content.

---

## §2 Architecture — 4 Layers of Defense

The state model itself:

```
                 first PATCH with        gate POST 200          analysis POST 200
                 substantive content                            (evaluate/final-report)
   created ─────────────────────────► editing ──────────────► gated ─────────────────► completed
      │                                  │                       │                        ▲
      │                                  └───── (skip — gate     │                        │
      │                                          may run         └──── (analysis can      │
      │                                          before some            run from any      │
      │                                          steps)                 non-created)──────┘
      │
      └────► (cron @ 24h, created & never PATCHed) ────► DELETE
```

Four layers, each independently sufficient to filter *some* noise; together they form defense-in-depth.

### 2.1 Layer 1 — Schema (`lifecycle` column + index)

```sql
ALTER TABLE circles_sessions
  ADD COLUMN IF NOT EXISTS lifecycle TEXT NOT NULL DEFAULT 'created'
    CHECK (lifecycle IN ('created','editing','gated','completed'));

CREATE INDEX IF NOT EXISTS idx_circles_sessions_lifecycle_user
  ON circles_sessions (user_id, lifecycle, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_circles_sessions_lifecycle_guest
  ON circles_sessions (guest_id, lifecycle, updated_at DESC);

-- Same shape for nsm_sessions (no guest_id index for auth table).
ALTER TABLE nsm_sessions
  ADD COLUMN IF NOT EXISTS lifecycle TEXT NOT NULL DEFAULT 'created'
    CHECK (lifecycle IN ('created','editing','gated','completed'));

CREATE INDEX IF NOT EXISTS idx_nsm_sessions_lifecycle_user
  ON nsm_sessions (user_id, lifecycle, updated_at DESC);
```

**Rationale**
- `TEXT + CHECK` over Postgres `ENUM` — easier to migrate, drops cleanly, matches existing `status TEXT` precedent in the repo.
- `(user_id, lifecycle, updated_at DESC)` matches the dominant query: "this user's non-created sessions, newest first."
- Default `'created'` so existing rows + new INSERTs need zero handler change before the route layer ships.

### 2.2 Layer 2 — Transition (server-enforced, FE-blind)

The lifecycle is **computed by the server** on every PATCH/POST that mutates a session. FE never sends `lifecycle` in the body; if it does, server ignores it.

Computation lives in **one shared helper** (`lib/session-lifecycle.js`) used by both routes:

```js
// pseudocode
function computeLifecycle(prior, patch, kind, route) {
  if (prior.lifecycle === 'completed') return 'completed'; // terminal
  if (route === 'analysis_done')        return 'completed';
  if (route === 'gate_ok')              return 'gated';
  // any PATCH that carries substantive content promotes created → editing
  if (prior.lifecycle === 'created' && hasSubstantiveContent(patch, kind, route)) {
    return 'editing';
  }
  return prior.lifecycle;
}
```

Transitions are **monotone** in priority: `created < editing < gated < completed`. A PATCH that only carries `currentStep` does NOT downgrade `gated` back to `editing`.

### 2.3 Layer 3 — List filter (default-exclude `created`)

```
GET /api/circles-sessions
GET /api/nsm-sessions
GET /api/guest-circles-sessions
GET /api/guest-nsm-sessions
```

All four list endpoints add a default `WHERE lifecycle != 'created'` clause to the existing query. The detail endpoint `GET /:id` is **unchanged** — direct access to a created row still works (rehydrate / resume by id paths rely on this).

Debug flag: `?include_empty=true` bypasses the filter. Gated to operator-only (see §5.3).

### 2.4 Layer 4 — Cleanup (Railway cron, idempotent)

A nightly job deletes `lifecycle='created' AND created_at < NOW() - INTERVAL '24 hours'`. Provides a **hard ceiling** on the polluted-row backlog: even if Layer 2 has a bug, the table cannot grow past one day of ghosts.

```
Railway cron:  0 3 * * *        (03:00 UTC daily)
Endpoint:      POST /api/admin/cleanup-empty-sessions
Auth:          x-cron-secret header == process.env.CRON_SECRET
Modes:         ?dry=true (default off) — log SELECT counts, no DELETE
Safety cap:    if would-delete > MAX_DELETES_PER_RUN (default 500), abort + alert
```

---

## §3 Components — file-by-file

| Layer | File | Change |
|---|---|---|
| Schema | `migrations/2026-05-17-session-lifecycle.sql` (new) | `ALTER TABLE` + 3 indexes (CIRCLES + NSM, idempotent `IF NOT EXISTS`) |
| Schema | `scripts/backfill-lifecycle.js` (new) | Idempotent backfill — see §8.3 |
| Transition | `lib/session-lifecycle.js` (new) | `computeLifecycle()` + `hasSubstantiveContent()` + `isStubValue()` |
| Transition | `routes/circles-sessions.js` | `POST /:id/gate` → set `gated`; `POST /:id/final-report` → set `completed`; `PATCH /:id/progress` → run `computeLifecycle`; `POST /draft` insert defaults to `'created'` (no change needed, default fills it) |
| Transition | `routes/guest-circles-sessions.js` | Mirror — same edits |
| Transition | `routes/nsm-sessions.js` | `POST /:id/gate` → `gated` (NSM Step 1 hint dim gate); `POST /:id/evaluate` → `completed`; `PATCH /:id/progress` → run `computeLifecycle` |
| Transition | `routes/guest-nsm-sessions.js` | Mirror |
| List | `routes/circles-sessions.js` GET `/` | Append `.neq('lifecycle','created')` unless `req.query.include_empty === 'true' && req.user.isOperator` |
| List | `routes/nsm-sessions.js` GET `/` | Same |
| List | guest variants × 2 | Same |
| Cleanup | `routes/admin-cleanup.js` (new) | `POST /api/admin/cleanup-empty-sessions` — auth via `x-cron-secret` env, supports `?dry=true`, safety cap, structured log |
| Cleanup | `server.js` | Mount `app.use('/api/admin', require('./routes/admin-cleanup'))` |
| Cleanup | Railway dashboard | Add cron service: `0 3 * * *` → `curl -X POST -H "x-cron-secret: $CRON_SECRET" $BASE_URL/api/admin/cleanup-empty-sessions` |
| FE (read-only) | `public/app.js` | **No write changes.** Only ensure 練習記錄 drawer renders the filtered list as-is. (Already does — it just iterates whatever GET returns.) |
| Tests | `tests/lib/session-lifecycle.test.js` (new) | jest unit specs for the helper |
| Tests | `tests/contracts/lifecycle-route.test.js` (new) | jest API contract specs |
| Tests | `tests/visual/lifecycle.spec.js` (new) | Playwright E2E per §6 |

---

## §4 Data flow — sequence diagrams

### 4.1 CIRCLES happy path

```
USER LANDS ON /circles?qid=Q1                 BE STATE
─────────────────────────────────────────     ────────────────────────────────
preflightDraftSession()                       INSERT circles_sessions
  → POST /api/circles-sessions/draft          (lifecycle='created' default)
                                              ROW: lifecycle=created

USER TYPES "我們的目標是..."
triggerSaveCycle() 800ms debounce
  → PATCH /:id/progress
      body: { stepDrafts: {C1: {問題範圍: "我們的目標是..."}}, frameworkDraft: {...} }
                                              computeLifecycle:
                                                prior=created + substantive → editing
                                              ROW: lifecycle=editing

USER CLICKS 「送出」 → submitFrameworkToGate()
  → POST /:id/gate { step:'C1', frameworkDraft }
                                              reviewFramework() → result.ok=true
                                              UPDATE lifecycle='gated', gate_result=result
                                              ROW: lifecycle=gated

USER FINISHES ALL 7 STEPS → finalReport()
  → POST /:id/final-report
                                              generateFinalReport() OK
                                              UPDATE lifecycle='completed', status='completed'
                                              ROW: lifecycle=completed

USER OPENS 練習記錄 DRAWER
  → GET /api/circles-sessions
                                              SELECT ... WHERE user_id=$1 AND lifecycle != 'created'
                                              RETURNS: this session (and prior real ones)
                                              DOES NOT RETURN: any other created ghosts
```

### 4.2 NSM happy path

```
USER LANDS ON /nsm step 1 (5 hint dims)       BE STATE
─────────────────────────────────────────     ────────────────────────────────
(NO preflight on step 1)                      —

USER CLICKS step1 hint chip + types into 4-dim breakdown
  → eventual step → 2 navigation
  preflightNsmDraftSession (on bindNSMStep2And3)
  → POST /api/nsm-sessions                    INSERT (lifecycle=created)
                                              ROW: lifecycle=created

USER TYPES NSM definition + breakdown
  → PATCH /:id/progress { userNsm, userBreakdown, currentStep:2 }
                                              computeLifecycle:
                                                prior=created + substantive userNsm/userBreakdown
                                                → editing
                                              ROW: lifecycle=editing

USER CLICKS step2 gate
  → POST /:id/gate { nsm, rationale }
                                              reviewNSMGate() → ok
                                              UPDATE lifecycle='gated'
                                              ROW: lifecycle=gated

USER COMPLETES step3 + step4 evaluate
  → POST /:id/evaluate
                                              evaluateNSM() OK
                                              UPDATE lifecycle='completed', status='completed'
                                              ROW: lifecycle=completed
```

### 4.3 Substantive-content rule (`hasSubstantiveContent`)

A PATCH body promotes `created → editing` iff at least one user-editable field, **after stripping HTML and trimming whitespace**, is non-empty and is **not** a polluted stub (as detected by `scripts/scan-pollution.js::isPolluted`, which we import).

Per kind, the editable fields are:

**CIRCLES** (`PATCH /:id/progress` body):
- `frameworkDraft.<step>.<field>` (string values, after HTML strip)
- `stepDrafts.framework.<step>.<field>` (legacy nested shape)
- `stepDrafts.P1 / P1S / P1L / P1E` (each may carry user input)
- `phase2ConclusionDraft` (string)

**NSM** (`PATCH /:id/progress` body):
- `userNsm` (string OR `{nsm, explanation, businessLink}` — any non-empty trimmed field)
- `userBreakdown.{reach,depth,frequency,impact}` (4 dim strings)
- `userExplanation` (string)
- `userBusinessLink` (string)

**Anti-stub guard.** If every non-empty value matches `isPolluted()`, the PATCH does **not** promote. This prevents pollution from showing in the drawer even if our env-guard / pre-commit hook misses a future test bug. Pure goal-driven defense; cheap to add since the helper already exists.

**Whitespace.** `String(v).replace(/<[^>]+>/g,'').trim()` — same as the existing `submitFrameworkToGate` `hasContent` check at `public/app.js:7403`. Single function in the helper; reused everywhere.

---

## §5 Error handling + edge cases

### 5.1 Race: PATCH and gate POST land out of order

PATCH carries `currentStep` change (no content) → computeLifecycle returns `prior` (no demotion). Gate POST lands first and sets `gated`; PATCH lands second carrying old content → computeLifecycle sees `prior=gated`, monotone rule keeps `gated`. **Safe.**

### 5.2 Race: two tabs editing the same session

Existing `step_drafts` shallow-merge (circles-sessions.js:302) handles content merge. Lifecycle is a scalar — last writer wins, both PATCHes compute the same `editing` result. **No new race.**

### 5.3 `?include_empty=true` abuse

Threat: caller bypasses filter to flood themselves with their own empty drafts (low risk — they already own them) or probes for others' (blocked by existing `WHERE user_id=$1`).

Mitigation: gate the flag.

```js
// pseudocode in list handler
const wantsEmpty = req.query.include_empty === 'true';
const isOperator = req.user && req.user.email === process.env.OPERATOR_EMAIL;
if (wantsEmpty && !isOperator) return res.status(403).json({ error: 'forbidden' });
```

Defense in depth: even if `OPERATOR_EMAIL` isn't set in some env, falsy comparison fails closed → flag denied. **Goal-driven minimum** — no role/ACL system added, just one env var, matches repo's auth simplicity.

### 5.4 Cron over-deletion

`MAX_DELETES_PER_RUN` (default 500) — if SELECT count > cap, abort with `503` and log structured event. Spec author note: 500 is conservative (real prod has <30 sessions per active user); a runaway INSERT bug couldn't produce more than ~1 day's worth at our QPS. Operator alert in console + Railway log will be visible within hours.

Dry-run mode (`?dry=true`) on first 3 production runs to confirm count + sample IDs. Documented in §8 deploy plan.

### 5.5 Backwards compat during Railway rolling deploy

**Risk:** migration adds the column, but old pods are still serving and don't filter. Result: old pod returns the empty rows to drawer; new pod doesn't. Inconsistent UX for ~1-2 minutes.

**Mitigation:** the column has `DEFAULT 'created'` so old code's INSERTs still satisfy the constraint. The filter `WHERE lifecycle != 'created'` is additive — old pods' queries are unaffected. Worst case: user sees an empty row that disappears on next refresh. Acceptable for ~2 min, no data corruption.

**Migration ordering** (§8.1):
1. Run `ALTER TABLE` (1 round-trip, idempotent)
2. Run `scripts/backfill-lifecycle.js` (sets correct values on existing rows)
3. Deploy code with new routes (Railway picks up)
4. After deploy stabilizes, schedule first dry-run cron

### 5.6 NSM Step 1 — no preflight, so no `created` rows for Step 1 alone

NSM only preflights on Step 2/3 mount. Users browsing Step 1 hint dims won't create a row. **Good.** First row appears only when the user advances → first PATCH carries substantive content → goes straight to `editing`. No `created` skeletons from NSM Step 1 flow.

### 5.7 Phase 2 chat-only sessions

If a user reaches Phase 2 and only chats (no Phase 1 framework drafts), the gate POST has already promoted to `gated`. POST `/:id/message` doesn't move lifecycle. **Correct** — gated means "user passed at least one gate", which is what we want surfaced.

### 5.8 Delete a real session by mistake (cron)

Impossible: cron WHERE is `lifecycle='created' AND created_at < NOW() - INTERVAL '24h'`. Any user activity → lifecycle is `editing` or higher → never matched. The 24h window also gives a paranoid buffer for users who land on a page, walk away, and come back the next morning to type — that row would be deleted, they'd see a fresh draft. Acceptable: their typed content was never persisted anywhere, so nothing is lost.

---

## §6 Testing strategy

### 6.1 Playwright E2E (the load-bearing surface)

Skill applied: **`playwright-skill/core/crud-testing.md`** — lifecycle is fundamentally CRUD-with-state, and that recipe explicitly covers "Create → Read (list) → Update → Delete" plus optimistic UI variations. The Tips section "Test the full lifecycle" maps directly to our state machine.

We add **one new spec** `tests/visual/lifecycle.spec.js` with 5 tests, using existing infra (auth.setup.js storageState, circles-phase1 POM, real BE — per `feedback_e2e_real_data_only`):

| # | Test | Assertion |
|---|---|---|
| E1 | created → editing on first substantive keystroke | After preflight: row exists (verified via API `?include_empty=true`) with `lifecycle='created'`. Type "x" in C1 first field, wait for save cycle. Re-query API → `lifecycle='editing'`. Drawer GET (no flag) → row present. |
| E2 | editing → gated on submitFrameworkToGate ok | Continue from E1; type full valid C1 draft; click 送出; wait gate result. API → `lifecycle='gated'`. |
| E3 | gated → completed on final-report (CIRCLES) / evaluate (NSM) | Stub gate to always-ok (allowed: it's our own AI, not third-party — wait, NO, §IL violates `feedback_e2e_real_data_only`). **Use real gate with the seed question known to pass.** API → `lifecycle='completed'`. |
| E4 | Stub content does NOT promote | Type only `"e2e-r1-1789..."` (matches `isPolluted` shape). Wait save. API → still `lifecycle='created'`. Drawer GET → row absent. |
| E5 | List filter — empty drafts hidden, `?include_empty=true` shows them (operator only) | After preflight only, drawer GET → row absent. As non-operator, GET `?include_empty=true` → 403. As operator (set OPERATOR_EMAIL=test account in `.env.test`) → row present. |

**Cron behaviour** — split into a **jest test** rather than Playwright (no UI surface):
- C1 (jest): `?dry=true` returns count + IDs, no DELETE.
- C2 (jest): real run on a fixture with 1 created < 24h (kept) + 1 created > 24h (deleted) → exit count 1, fixture re-query confirms.
- C3 (jest): when count > MAX cap → 503, no DELETE.

**Race coverage** — already covered by existing Stage 1A specs (`tests/visual/lifecycle.spec.js` does not need to re-prove `gateInflight`). We add a `test.describe('lifecycle race')` block with **one** test: two parallel PATCH + POST gate land in arbitrary order, final lifecycle is `gated` not `editing` (monotone rule).

### 6.2 jest unit + contract

- `tests/lib/session-lifecycle.test.js` — `hasSubstantiveContent` happy/empty/whitespace/HTML-only/polluted/mixed; `computeLifecycle` × every (prior, route) combo (16 cases); `isStubValue` reuse from scan-pollution.
- `tests/contracts/lifecycle-route.test.js` — PATCH/POST set the column correctly; GET filter applies; flag enforcement.

### 6.3 Adversarial sweep

Lifecycle helper is not an AI call, so the §IL adversarial-sweep rule (5 AI stages) does NOT apply. But we do add **one** ad-hoc adversarial check in the contract spec: malformed PATCH bodies (string-as-frameworkDraft, array-as-userBreakdown, `lifecycle: 'completed'` injection attempt in body) — all should be ignored and not advance the column.

### 6.4 8-viewport visual regression

No UI change is introduced (drawer rendering is unchanged — it just receives fewer rows). One smoke spec at **Mobile-360 + Desktop-1280** verifies drawer renders correctly when the list is shorter than before. Skip the full 8-vp grid — over-engineering for a backend filter.

---

## §7 Acceptance criteria

Numbered as **SLC-AC1..N** (Session Lifecycle Acceptance Criteria). Every line is an observable behavior; the implementation plan must produce a test/proof for each.

- **SLC-AC1.** `circles_sessions` and `nsm_sessions` both have a `lifecycle TEXT NOT NULL DEFAULT 'created' CHECK (IN ('created','editing','gated','completed'))` column after migration.
- **SLC-AC2.** Indexes `idx_{circles,nsm}_sessions_lifecycle_user` (+ `_guest` for circles) exist after migration.
- **SLC-AC3.** Backfill script run on a snapshot containing 1 completed + 1 gated + 1 editing + 1 created row produces correct lifecycle values (verified by SELECT after).
- **SLC-AC4.** Eager-INSERT (`POST /draft` + `POST /api/nsm-sessions`) creates rows with `lifecycle='created'`.
- **SLC-AC5.** First PATCH carrying ≥1 substantive (non-whitespace, non-HTML-only, non-stub) field promotes `created → editing` in one round-trip.
- **SLC-AC6.** PATCH carrying ONLY stub-shaped strings (matches `scan-pollution.isPolluted`) does NOT promote. Row stays `created`.
- **SLC-AC7.** Successful gate POST (`/api/circles-sessions/:id/gate` and `/api/nsm-sessions/:id/gate`) promotes to `gated`. Failed gate (500 / parse error / `ok=false` result) does NOT promote.
- **SLC-AC8.** `POST /:id/final-report` (CIRCLES) and `POST /:id/evaluate` (NSM) promote to `completed`. Failure does not promote.
- **SLC-AC9.** Lifecycle is monotone: a PATCH following a successful gate cannot demote `gated → editing` even if the PATCH carries non-content fields only.
- **SLC-AC10.** FE-supplied `lifecycle` in PATCH body is ignored — server always computes from prior + route + payload.
- **SLC-AC11.** Default `GET /api/{circles,nsm}-sessions` and guest variants return ZERO rows with `lifecycle='created'`.
- **SLC-AC12.** `GET /:id` (detail endpoint) still returns a `created` row when requested by id (rehydrate path unaffected).
- **SLC-AC13.** `?include_empty=true` without operator privilege returns 403.
- **SLC-AC14.** `?include_empty=true` as operator returns all rows including `created`.
- **SLC-AC15.** Cron endpoint authenticated by `x-cron-secret` header; wrong/missing secret → 401.
- **SLC-AC16.** `POST /api/admin/cleanup-empty-sessions?dry=true` returns `{ would_delete: N, sample_ids: [...] }` without modifying DB.
- **SLC-AC17.** Cron actual run deletes ONLY rows matching `lifecycle='created' AND created_at < NOW() - 24h`.
- **SLC-AC18.** Cron aborts with 503 when would-delete > `MAX_DELETES_PER_RUN` (default 500), no rows touched, structured log emitted.
- **SLC-AC19.** Cron run is idempotent — repeated runs within 24h on a stable DB delete the same set (zero on the second run).
- **SLC-AC20.** 練習記錄 drawer (FE) renders correctly with the filtered list; no JS error when list is empty.
- **SLC-AC21.** All Bug B1-H locked invariants still pass: full Stage 1A jest + Playwright suite green post-deploy.

---

## §8 Migration plan

### 8.1 Deploy order

1. **Prep (PR review on main).** All code merged but Railway not redeployed yet.
2. **Run migration.** `psql $DATABASE_URL -f migrations/2026-05-17-session-lifecycle.sql`. Idempotent `IF NOT EXISTS` — safe to retry.
3. **Run backfill.** `node scripts/backfill-lifecycle.js --dry` first; review counts; then `--apply`. Script logs `{N completed, N gated, N editing, N created}` summary.
4. **Trigger Railway redeploy.** New pods pick up filter routes + lifecycle compute logic. Old pods (rolling deploy ~1-2 min overlap) keep working — they ignore the column on writes (default `'created'` fills it), they don't filter on reads (user sees ghosts for ~1 min until they refresh against a new pod). Acceptable per §5.5.
5. **Smoke test prod.** Director opens drawer → no ghosts. Operator runs `?include_empty=true` → ghosts visible.
6. **Wire cron.** Add Railway cron service with `0 3 * * *` schedule. First 3 runs in `?dry=true` mode; review log; flip off dry flag.

### 8.2 Rollback strategy

If anything goes wrong post-deploy:

- **Read-side bug** (drawer broken): revert code commit only. Column + default value harmlessly persist. Old code ignores `lifecycle`.
- **Write-side bug** (lifecycle stuck at `created`): revert code commit. Drawer reverts to showing all rows (the original bug — survivable). Re-run backfill at leisure on a freshly-fixed branch.
- **Migration corrupt** (very unlikely with `IF NOT EXISTS`): `ALTER TABLE circles_sessions DROP COLUMN IF EXISTS lifecycle;` (mirror for nsm). All app code falls back gracefully because lifecycle reads are wrapped in `prior.lifecycle || 'created'`.
- **Cron over-deletes**: not possible (§5.4 cap), but if it ever did, Supabase point-in-time recovery is available; the admin would restore the affected rows. The cron secret is rotated; the cron service is paused until investigation completes.

### 8.3 Backfill rule (idempotent re-run)

`scripts/backfill-lifecycle.js`:

```
FOR each row in circles_sessions:
  IF row.status = 'completed' OR row.lifecycle = 'completed':
     SET lifecycle = 'completed'
  ELIF row.gate_result IS NOT NULL AND (row.gate_result->>'ok')::bool = true:
     SET lifecycle = 'gated'
  ELIF hasSubstantiveContent(row.framework_draft, row.step_drafts, row.progress_json):
     SET lifecycle = 'editing'
  ELSE:
     SET lifecycle = 'created'

FOR each row in nsm_sessions:
  IF row.status = 'completed' OR row.scores_json IS NOT NULL:
     SET lifecycle = 'completed'
  ELIF row.progress_json->>'gateResult' IS NOT NULL AND (...->>'ok')::bool = true:
     SET lifecycle = 'gated'
  ELIF hasSubstantiveContent(row.user_nsm, row.user_breakdown, row.user_explanation, row.user_business_link):
     SET lifecycle = 'editing'
  ELSE:
     SET lifecycle = 'created'
```

Verification SQL post-backfill:
```sql
SELECT lifecycle, COUNT(*) FROM circles_sessions GROUP BY 1;
SELECT lifecycle, COUNT(*) FROM nsm_sessions     GROUP BY 1;
```
Director eyeballs counts; if `created` count > 50% of total, investigate before deploying read filter.

---

## §9 Out of scope

This spec **does not** and **must not** touch:

- B1-B8 race fixes (`AppState.gateInflight`, `_resumePromise`, mutex, `restoreCirclesPhase1FromSession`, `tryResumeLatestSession` bugs B/D/E/F/G/H). All locked.
- Eager-INSERT removal. Pre-flight stays exactly as it is.
- B-Hint cluster work (task #174). Separate plan.
- AI prompt changes — `circles-gate`, `nsm-gate`, `nsm-evaluator`, `nsm-context`, `nsm-hints`. All locked under Path 2 carve-out.
- Path 2 frontend rewrite mockups (00-16). LOCKED.
- Existing `status` column semantics. We add `lifecycle` orthogonally; `status='completed'` remains a meaningful "user finished entire flow" marker and is set in parallel by the same handlers that set `lifecycle='completed'`. We do not deprecate or remove `status`.
- jest baseline (170/187). Stays.
- Onboarding tooltip / Phase 1.5 gate three-state / Phase 2 chat / NSM offcanvas drawer mockup. No FE rewrites here — drawer just receives a shorter list.

Anything else requires explicit director gate before being pulled in.

---

## §10 Karpathy check (self-audit)

- **Think before:** §1.3 explains why we picked an explicit column over a derived predicate. Not skipped.
- **Simplicity first:** No new ACL system (§5.3 uses one env var). No new ORM layer (raw Supabase queries with `IF NOT EXISTS`). One shared helper, not per-route logic duplication.
- **Surgical:** §3 lists the exact files; nothing else moves. No refactor of existing race fixes. No FE write changes.
- **Goal-driven:** the goal is "练习記錄 shows no empty rows." Every layer either directly achieves it (Layer 3) or prevents it from coming back (Layers 1/2/4). No nice-to-have.

Possible over-engineering flag: **anti-stub guard (`isPolluted` import in Layer 2)**. If E2E hygiene infrastructure from Stage 0 holds, this is unnecessary. Kept because the cost is one import + one branch and it eliminates a whole class of "test bug pollutes prod" reincarnations. Defensible.

---

## §11 Self-review checklist (writing-plans inline)

1. **Spec coverage** — §1-9 all populated, no TBD/TK. ✓
2. **Internal consistency** — §2 architecture states ≡ §4 sequences ≡ §6 tests ≡ §7 ACs. Cross-checked. ✓
3. **Scope check** — 4 layers, ~10 file touches, 1 migration, 1 backfill, 1 cron, ~10 ACs + 5 E2E + 6-ish jest specs. Single implementation plan — yes. ✓
4. **Ambiguity check** — "substantive content" defined in §4.3 with exact function spec + repo reuse. "Operator" defined in §5.3 (env var). "Idempotent backfill" defined in §8.3 with exact SQL. "Cron over-deletion" capped in §5.4 with default. **One possible ambiguity flagged for user:** §5.3 operator gating — should it be `OPERATOR_EMAIL` env var (matches repo's e2e@first-principle.test pattern) OR added to a per-user role flag? Spec currently picks the env-var path (simpler, matches `feedback_e2e_real_data_only` infrastructure); flagged for confirmation before implementation.
