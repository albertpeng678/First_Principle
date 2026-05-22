# P0-SCHEMA-1-v2: NSM `/evaluate` shape coerce design

> **Status**: Brainstorming approved by user (2026-05-22) — pending spec self-review + user spec review → writing-plans
> **Origin**: `audit/e2e-master-tracker.md` §1 P0-SCHEMA-1-v2 (supersedes SCHEMA-1)
> **Live data baseline (agent B 2026-05-22)**: 6,977 rows scanned — **0 row currently string**; 99.28% `{}`, 0.72% obj_full. **Latent P0** — flips to active P0 when NSM completion rate climbs or D-2 LS restore is fixed.

---

## §1 Goal (one sentence)

防止 NSM `/evaluate` 端把 `user_nsm` 從 object 退化成 string，並保住已存在的 `explanation` + `businessLink` 欄位，即使未來 FE 任何 site regress 也擋得住。

## §2 Architecture — Defense-in-depth + helper centralization

兩層防護 + 1 個 helper：

**Layer 1 (Source fix)** — FE `app.js:2016 + 2518` 改送 full object（root cause）
**Layer 2 (Defense)** — BE 6 個寫入站全用 `coerceUserNsm()` helper（防 future regression）

Helper 集中在 `routes/_helpers/coerce-user-nsm.js`。Strategy: incoming string → SELECT 既有 row → merge with existing `explanation`/`businessLink` → 保住既有資料。

---

## §3 Helper module — `routes/_helpers/coerce-user-nsm.js`

### Function signature

```js
/**
 * Coerce incoming userNsm value into a guaranteed object shape.
 * Idempotent for object input; merges with existing DB row on string input.
 *
 * @param {Object}  args
 * @param {*}       args.incoming    Raw value from req.body.userNsm (any type)
 * @param {string}  args.sessionId   nsm_sessions.id for SELECT-merge path
 * @param {Object}  args.db          Supabase service-role client
 * @returns {Promise<Object|undefined>}
 *   - undefined: caller should NOT include user_nsm in patch (no-op)
 *   - Object: guaranteed { nsm, explanation, businessLink } shape
 */
async function coerceUserNsm({ incoming, sessionId, db }) { ... }
```

### 5 branches

| Branch | Input | Action | Returns |
|---|---|---|---|
| B1 | `undefined` | No-op | `undefined` |
| B2 | object (any keys) | Passthrough — **FE contract: caller MUST send all 3 keys (nsm/explanation/businessLink) for object input. Partial object overwrites; helper does NOT defensively merge missing keys.** Rationale: 99% traffic path; SELECT-per-call would double DB load. FE single source 已在 `app.js:2075` (NEW-Bug-A 修對) + 本 spec §5 兩個新點都 fallback 完整 3-key default object — partial-object never reaches BE unless explicit external caller bug. | `incoming` |
| B3 | non-empty string | SELECT existing → merge | `{nsm: incoming, explanation: existing.explanation \|\| '', businessLink: existing.businessLink \|\| ''}` |
| B4 | string but SELECT fails/row gone | Fallback wrap | `{nsm: incoming, explanation: '', businessLink: ''}` + `console.warn('[coerce-user-nsm] SELECT fail fallback', sessionId)` |
| B5 | other type (number, array, null, boolean) | Treat as invalid → no-op | `undefined` + `console.warn('[coerce-user-nsm] invalid type', typeof incoming)` |

### Logging contract (audit trail)

- B3 (string→object merge): `console.warn('[coerce-user-nsm] string→object', { sessionId, incomingLen: incoming.length })`
- B4 (SELECT fail fallback): see B4 row above
- B5 (invalid type): see B5 row above
- B1, B2: silent (常態 path)

**Purpose**: 修完之後若 prod log 還看到 B3 = 有未知 FE site regress; 看到 B4 = DB 異常; 看到 B5 = 外部 caller / test bug。

---

## §4 Call sites — 6 BE write locations

### Auth routes (`routes/nsm-sessions.js`)

| Line | Endpoint | Current | Patch |
|---|---|---|---|
| 131 | POST `/evaluate` checkpoint | `user_nsm: userNsm` (raw) | `user_nsm: await coerceUserNsm({ incoming: userNsm, sessionId: req.params.id, db })` |
| 140 | POST `/evaluate` final write | same | same |
| 228 | PATCH `/progress` | `if (userNsm !== undefined) patch.user_nsm = userNsm;` | wrap with conditional helper (see §5) |

### Guest routes (`routes/guest-nsm-sessions.js`)

| Line | Endpoint | Current | Patch |
|---|---|---|---|
| 108 | POST `/evaluate` checkpoint | same | same |
| 114 | POST `/evaluate` final write | same | same |
| 181 | PATCH `/progress` | same | wrap with conditional helper |

### Conditional pattern for `/progress` (lines 228, 181)

```js
// BEFORE:
if (userNsm !== undefined) patch.user_nsm = userNsm;

// AFTER:
if (userNsm !== undefined) {
  const coerced = await coerceUserNsm({ incoming: userNsm, sessionId: req.params.id, db });
  if (coerced !== undefined) patch.user_nsm = coerced;
}
```

(B5 invalid type returns undefined → caller drops the patch entry → DB column untouched.)

---

## §5 FE changes — 2 lines in `public/app.js`

### Line 2016 (POST `/evaluate` first call)

```js
// BEFORE:
userNsm: (AppState.nsmDefinition || {}).nsm || '',

// AFTER:
userNsm: AppState.nsmDefinition || { nsm: '', explanation: '', businessLink: '' },
```

### Line 2518 (POST `/evaluate` retry button)

```js
// BEFORE:
userNsm: (AppState.nsmDefinition || {}).nsm || '',

// AFTER:
userNsm: AppState.nsmDefinition || { nsm: '', explanation: '', businessLink: '' },
```

Mirror existing `app.js:2075` pattern (already correct from NEW-Bug-A `b126937`).

---

## §6 Tests

### API spec — `tests/api/nsm-evaluate-shape-coerce.spec.js` (Q4 strategy B)

3 TCs against real Supabase test DB via service-role seed:

| TC | Seed | Send | Expect (DB) |
|---|---|---|---|
| TC1 string-input merge | `{nsm:'old', explanation:'X', businessLink:'Y'}` | `"new"` | `{nsm:'new', explanation:'X', businessLink:'Y'}` |
| TC2 object-input passthrough | `{}` | `{nsm:'a', explanation:'b', businessLink:'c'}` | same as send |
| TC3 invalid type no-op | `{nsm:'old', explanation:'X', businessLink:'Y'}` | `[1,2,3]` (array) | unchanged from seed |

5× consecutive 0 flake gate. Project added to `tests/api/playwright.config.js`.

Skill citations in spec header:
- `playwright-skill/core/api-testing.md §APIRequestContext Basics` for request fixture
- `playwright-skill/core/api-testing.md §Data Seeding (service-role carve-out)` for seed
- `playwright-skill/core/common-pitfalls.md Pitfall 11` for no-mock self-backend
- `playwright-skill/core/assertions-and-waiting.md` for response shape assertions

### E2E spec — `tests/e2e/nsm-evaluate-shape-roundtrip.spec.js` (Q4 strategy C)

1 TC, cross-vp 3 projects × 5 runs = 15/15:

```
user fills 3 fields (nsm + explanation + businessLink)
  → click '送出評分'
  → wait for /api/.../evaluate response 2xx
  → reload page (full F5)
  → tryResumeLatestSession restores nsm_sessions row
  → assert 3 fields still visible with original values
```

Pitfall 14 (auto-cleanup fixture) + Pitfall 19 (`test.step()` per phase) + Pitfall 3 (role-based locators).

Skill citations:
- `playwright-skill/core/auth-flows.md:928-949 "Login via API for Speed"` for auth setup
- `playwright-skill/core/common-pitfalls.md Pitfall 19` for test.step
- `playwright-skill/core/mobile-and-responsive.md` for cross-vp 3 projects

---

## §7 Ship sequencing (user choice A — BE first / FE second)

**Prerequisite (gate)**: NEW-1 (CIRCLES RLS `917d485`) 24 hr soak GREEN — verified by:
- Supabase log: no anon CIRCLES enumeration errors
- nsm_sessions row count growth pattern normal
- 0 user-reported issue
Before this gate is met, neither Commit 1 nor Commit 2 ships (per robust sequencing 紀律 — DB-level + code-level ship 不疊加 risk window).

### Commit 1 — BE coerce defense layer

Files:
- `routes/_helpers/coerce-user-nsm.js` (new ~30 lines)
- `routes/nsm-sessions.js` (3 edits + 1 import)
- `routes/guest-nsm-sessions.js` (3 edits + 1 import)
- `tests/api/nsm-evaluate-shape-coerce.spec.js` (new)
- `tests/api/playwright.config.js` (add project)

Pre-commit gate:
- API spec 3 TCs × 5 runs = 15/15 GREEN
- jest no new regression
- 2-stage review (spec compliance + code quality)

Soak window: **6 hr** (code-only, no DB migration — shorter than NEW-1's 24 hr).

Post-soak verify:
- Supabase log scan: expect B3 `[coerce-user-nsm] string→object` triggers (FE still sends string) — proves coerce active in prod
- Re-run agent B DB scan: still 0 string rows (proves merge path works)

### Commit 2 — FE source fix

Files:
- `public/app.js` (2 line edits)
- `tests/e2e/nsm-evaluate-shape-roundtrip.spec.js` (new)

Pre-commit gate:
- E2E spec × 3 vp × 5 runs = 15/15 GREEN
- 2-stage review

Soak window: **24 hr** (FE-visible change → full SCHEMA-3 prerequisite).

Post-soak verify:
- Supabase log scan: B3 `[coerce-user-nsm] string→object` should drop to 0 (FE no longer sends string)
- Live-demo gate: user opens NSM, fills 3 fields, evaluates, reloads — 3 fields still there

---

## §8 Edge cases + error handling

| Edge case | Behavior |
|---|---|
| DB SELECT timeout in B3 path | Fallback to B4 wrap (no block) |
| FE sends `null` | B5 invalid-type → no-op (DB unchanged) |
| FE sends `[]` or `123` | B5 invalid-type → no-op + warn |
| First evaluate (existing `user_nsm = {}`) | B3 merge: `{nsm: incoming, explanation: '', businessLink: ''}` — same as B4 |
| Concurrent `/evaluate` race (2 tabs) | Each request SELECTs at its own moment; last-write-wins is acceptable (no merge across requests) |
| Auth user_id mismatch on SELECT | Helper does `.eq('id', sessionId)` only (route already enforced auth); helper trusts caller |

---

## §9 Cross-references

- Tracker: `audit/e2e-master-tracker.md` §1 P0-SCHEMA-1-v2
- Audit ref: `audit/supabase-nsm-schema-data-audit-2026-05-19.md` §5 + F3
- NEW-Bug-A mirror: commit `b126937` (FE PATCH `/progress` shape fix — same pattern)
- Skill mapping: `audit/skill-to-stage-mapping-2026-05-22.md`
- Quiz gate: 3-round opus reviewer (殺手鐧 5 + RITUAL §13 self-confirm + SCHEMA-1-v2 specific risk)

---

## §10 Out of scope (defer)

- DB backfill: live data 0 string rows, no backfill needed
- CI check (regex scan for `userNsm: ... \\.nsm \\|\\| ''`): defer to housekeeping wave
- Schema migration `ALTER COLUMN user_nsm SET NOT NULL` with shape constraint: defer to SCHEMA-4 RLS codify wave
- `/progress` 在 NEW-Bug-A 已修對 shape，這次只加 coerce defense；不再動 source

---

## §11 Success criteria (verifiable)

Karpathy §4.4 goal-driven — 修完算 GREEN 的條件：

1. ✅ Commit 1 ship: API spec 15/15 + Commit 1 push origin/main
2. ✅ Commit 1 soak 6 hr: Supabase log B3 trigger count > 0 (proves active)
3. ✅ Commit 2 ship: E2E spec 15/15 + Commit 2 push origin/main
4. ✅ Commit 2 soak 24 hr: Supabase log B3 trigger count = 0
5. ✅ Re-run agent B DB scan post-soak: 0 string rows + 100% object shape
6. ✅ Tracker §1 P0-SCHEMA-1-v2 entry moves to §5 closure with full evidence
7. ✅ CLAUDE.md state board + tracker §5 sync (per STANDING `feedback_update_claude_md_and_tracker_on_ship`)
