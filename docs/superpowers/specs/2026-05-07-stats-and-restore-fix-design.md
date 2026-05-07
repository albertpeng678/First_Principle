# Stats 0/0/0 + Phase 1 Restore Mapping Drift — Hotfix Design

**Date:** 2026-05-07
**Author:** Claude (opus director) + albertpeng (user)
**Status:** Approved — proceed to writing-plans
**Scope:** Path 2 hotfix — 2 user-reported bugs; backend surgical add-on for Bug A only.
**Master Spec ref:** `docs/superpowers/specs/2026-05-02-frontend-rewrite-master-spec.md`
**Mockup contracts:** `01-circles-home.html` (stats-strip), `03-phase-1-form.html` (Phase 1 form 7 步 restore)

---

## 0. Why this exists

User reported via screenshots two production bugs after Plan E ship + 4 post-ship hotfixes:

1. **Bug A — `0 已完成 · 0 進行中 · 0 本週`** on home stats-strip even though user has practice records.
2. **Bug B — Phase 1 form field mapping drift on restore.** User filled "測試" in 時間範圍, closed via offcanvas, reopened the same session via 練習紀錄 list — "測試" appeared in 業務影響 instead. User states drift can hit any field across any of the 7 steps (C1/I/R/C2/L/E/S), not just C1.

Both bugs broke after recent hotfix `2607720` (offcanvas drafts visibility) added lazy-create `POST /draft` + PATCH `/progress` for guest sessions — this surfaced existing code paths that were never exercised at scale.

---

## 1. Bug A — Stats 0/0/0 for guest users

### 1.1 Root cause

`server.js:42` mounts `/api/circles-stats` with `requireAuth` middleware:

```js
app.use('/api/circles-stats', requireAuth, require('./routes/circles-stats'));
```

Guest users have no token → middleware returns 401 → frontend `loadCirclesStats()` (`public/app.js:2105-2130`) early-returns at line 2116 (`if (!res.ok) return;`). The `[data-stat]` elements in the HTML template stay at their initial `0`. **No `/api/guest-circles-stats` endpoint exists** to mirror the `guest-circles-sessions` pattern.

This was a pre-existing gap surfaced by the offcanvas hotfix: now that guest sessions are persisted to backend (was only localStorage before `2607720`), the data exists in DB but is invisible on home.

### 1.2 Fix — surgical backend add-on (mirrors `2607720` precedent)

**Backend (per user explicit approval; aligns with established `circles-sessions` ↔ `guest-circles-sessions` route pair pattern):**

1. Create `routes/guest-circles-stats.js` mirroring `routes/circles-stats.js`:
   - Use `requireGuestId` middleware (parse `X-Guest-ID` header)
   - Query `circles_sessions` table with `.eq('guest_id', req.guestId)` instead of `.eq('user_id', req.user.id)`
   - Return identical shape: `{ completed, active, weeklyCompleted }`
2. `server.js`: register `app.use('/api/guest-circles-stats', require('./routes/guest-circles-stats'));` (no `requireAuth`; the route uses `requireGuestId` internally).
3. **Do NOT modify** existing `routes/circles-stats.js` or its mount — auth path stays untouched.

**Frontend (`public/app.js:2105-2130`):**

```js
// before
var path = '/api/circles-stats';
```

```js
// after
var path = AppState.accessToken ? '/api/circles-stats' : '/api/guest-circles-stats';
```

(Mirrors the same auth-vs-guest path branch pattern used at line 3191 for session detail fetch and elsewhere.)

### 1.3 Tests (RED first)

- `tests/guest-circles-stats.test.js` (new):
  - 400 without `X-Guest-ID` header
  - 400 with malformed (non-UUIDv4) `X-Guest-ID`
  - With valid guest_id and 0 sessions → `{completed:0, active:0, weeklyCompleted:0}`
  - With seeded fixtures: 1 active draft + 1 completed (this week) + 1 completed (>7d ago) → `{completed:2, active:1, weeklyCompleted:1}`
- Existing `tests/circles-stats.test.js` (auth) — unchanged, must stay green.
- `tests/playwright/visual/home-stats-guest.spec.js` (new):
  - Stub `/api/guest-circles-stats` → `{completed:5, active:2, weeklyCompleted:3}`; render home; assert visible numbers in stats-strip on **all 8 viewports** (mobile-360 / iPhone-SE / iPhone-14 / iPhone-15-Pro / iPad / Desktop-1280 / Desktop-1440 / Desktop-2560).
  - Stub auth path → confirm auth users still hit `/api/circles-stats`.

### 1.4 Mockup alignment

mockup `01-circles-home.html` §A stats-strip is contract-locked. Visual output must match line-for-line for both auth and guest after fix. Pixel-diff threshold 0.5%.

---

## 2. Bug B — Phase 1 restore field mapping drift

### 2.1 Root cause (C/I/R/C2 step — confirmed)

`public/app.js:2552-2573` in `populateTextareasFromDraft`:

```js
var draftValues = Object.values(draftForStep);
textareas.forEach(function (ta, idx) {
  if (ta.innerHTML && ta.innerHTML.trim()) return;
  var fieldIdx = parseInt(ta.dataset.fieldIdx, 10);
  if (isNaN(fieldIdx)) fieldIdx = idx;
  var fieldKey = cfg.fields[fieldIdx] && cfg.fields[fieldIdx].key;
  var value = (fieldKey && draftForStep[fieldKey]) || draftValues[fieldIdx] || '';
  ...
```

The `|| draftValues[fieldIdx]` positional fallback is the bug. `cfg.fields[idx].key` returns Chinese keys (`'問題範圍'`/`'時間範圍'`/`'業務影響'`/`'假設確認'`) — write side `circlesFrameworkDraft['C1']['問題範圍'] = innerHTML` (line 2740) uses the same Chinese keys, so key-based read SHOULD always succeed.

The fallback was apparently added so the existing test fixtures (which use English keys `boundaryScope`/`timeWindow`/`businessImpact`/`assumption`) still pass via positional `Object.values(...)[idx]`. But in production:

- If `draftForStep[fieldKey]` returns `''` (empty string — JS falsy) → falls through to `draftValues[fieldIdx]`
- `Object.values(draftForStep)` returns values in **insertion order**, not field-config order. Insertion order depends on which field user typed in first.
- Partial fills (e.g. user filled idx 0 + idx 2, skipped idx 1 + idx 3) → `Object.values` length = 2 → values inserted into wrong textareas via positional fallback

Concrete drift scenario matching user's report:
- User types in field idx 1 (時間範圍), `draftForStep = { '時間範圍': '測試' }` → `Object.values = ['測試']`
- User then types in idx 0 (問題範圍), `draftForStep = { '時間範圍': '測試', '問題範圍': 'X' }` → keys still in original insertion order
- User clears idx 1, types real content in idx 1 + 2 — but partial save races, lands in DB with mixed state
- On restore, fallback positional lookup pollutes wrong textareas

### 2.2 Audit of L / E / S step restore paths (user requirement)

User stated drift can affect any field. Per audit:

| Step | Path (`public/app.js`) | Mechanism | Risk | Action |
|---|---|---|---|---|
| C / I / R / C2 | 2552-2573 | key-based + positional fallback | 🔴 confirmed bug | Remove fallback (§2.3) |
| L sol-card mechanism + name | 2575-2592 | array-index `solutions[idx].mechanism / .name` | 🟡 safe IF solutions array is dense and ordered; risk if sparse `[undefined, {...}]` from add/remove | Audit add/remove splice logic; add guard `if (!solutions[idx]) return;` (already present); add no-drift spec |
| E per-sol × 4 nested | 2594-2605 | `evalData[solIdx][fieldKey]` (both indices) | 🟡 safe under normal flow; risk if `evalData` is sparse or solution count mismatch | Audit alignment with `circlesPhase1Solutions` length; add no-drift spec |
| S main 3-field | 2607-2620 | Chinese label key map (`'推薦方案'→'recommendation'`) | 🟢 pure key-based, no fallback | Add no-drift spec |
| S tracking 4-dim | 2622-2630 | `data-s-tracking="reach|depth|frequency|impact"` → `tracking[dimKey]` | 🟢 pure key-based, no fallback | Add no-drift spec |

All 7 steps get a partial-fill restore Playwright spec to prevent regression.

### 2.3 Fix — remove positional fallback, add legacy English-key alias

**`populateTextareasFromDraft` C/I/R/C2 branch (line 2552-2573 only):**

```js
// Legacy English-key alias for sessions saved before Chinese-key migration.
// (Chinese keys are canonical per CIRCLES_STEP_CONFIG.fields[].key.)
var ENGLISH_ALIAS = {
  '問題範圍': 'boundaryScope', '時間範圍': 'timeWindow',
  '業務影響': 'businessImpact', '假設確認': 'assumption',
  '目標用戶分群': 'targetSegment', '選定焦點對象': 'focusGroup',
  '用戶動機假設(JTBD)': 'jtbd', '排除對象': 'excluded',
  '功能性': 'functional', '情感性': 'emotional', '社交性': 'social', '核心痛點': 'corePain',
  '取捨標準': 'criteria', '最優先': 'priority', '暫緩': 'defer', '排序理由': 'rationale',
};

textareas.forEach(function (ta, idx) {
  if (ta.innerHTML && ta.innerHTML.trim()) return;
  var fieldIdx = parseInt(ta.dataset.fieldIdx, 10);
  if (isNaN(fieldIdx)) fieldIdx = idx;
  var fieldKey = cfg.fields[fieldIdx] && cfg.fields[fieldIdx].key;
  if (!fieldKey) return;
  // Canonical Chinese-key lookup ONLY; legacy English alias as second-chance.
  var value = draftForStep[fieldKey];
  if (value == null || value === '') {
    var alias = ENGLISH_ALIAS[fieldKey];
    if (alias) value = draftForStep[alias];
  }
  if (value) {
    ta.innerHTML = value;
    syncCharCounter(ta);
  }
});
```

**Why English alias retained:** Test fixtures + any sessions saved before the recent Chinese-key migration would otherwise show empty fields after this fix. Alias is read-only; new saves continue using Chinese keys (write side at line 2740 unchanged).

### 2.4 L / E / S audit fixes (only if audit reveals breakage)

If audit specs go red:
- L step: tighten `solutions[idx]` guard if sparse arrays slip through
- E step: confirm `evalData[solIdx]` matches `solutions[solIdx]` order
- S step: confirm `tracking` shape (object keyed by dim) is preserved through save/restore round-trip

These are conditional — only fix if the new partial-fill specs go red. We don't refactor speculatively.

### 2.5 Tests (RED first)

New file `tests/playwright/visual/restore-no-drift.spec.js`:

1. **C1 partial-fill** — only idx 1 (時間範圍) filled with '測試' → restore → idx 1 textarea shows '測試', idx 0/2/3 empty (placeholder visible)
2. **C1 partial-fill alt** — only idx 0 + idx 2 → idx 1 stays empty (was the drift bait)
3. **I step partial-fill** — same pattern
4. **R step partial-fill** — same pattern
5. **C2 step partial-fill** — same pattern
6. **L step partial-fill** — sol-card 2 only, sol-card 1 empty
7. **E step partial-fill** — only sol 0 field 2 filled
8. **S main partial-fill** — only `reasoning` filled, `recommendation` + `nsm` empty
9. **S tracking partial-fill** — only `frequency` filled, others empty
10. **Legacy English-key fixture** — fixtures use `boundaryScope`/`timeWindow`/... → restore correctly into matching Chinese-keyed slots (alias path)
11. **Round-trip** — fill all 4 C1 fields → save (mock PATCH) → reopen via offcanvas → all 4 fields restored correctly to same slots

All 11 specs run on **3 viewports min** (mobile-360 / iPad / Desktop-1280); critical specs 1/2/10/11 run on **all 8 viewports**.

---

## 3. Visual verification (user explicit standing rule)

Every code change in this hotfix MUST be verified across all viewports + devices, strictly aligned with mockup. This is enforced via:

1. **Playwright × 8 viewport** — chromium 8 projects + webkit (iPhone-SE / iPhone-14 / iPhone-15-Pro / iPad)
2. **Director (opus) Read PNG** — minimum 6 PNGs per bug:
   - Bug A: home stats-strip × mobile-360 / iPad / Desktop-1280 × auth + guest = 6 PNGs
   - Bug B: Phase 1 form × C1 (4 fields with partial restore) × mobile-360 / iPad / Desktop-1280 = 3 PNGs minimum, plus L/E/S spot-check 3 PNGs = 6 PNGs total
3. **Pixel-diff vs mockup baseline** — 0.5% threshold against `01-circles-home.html` (Bug A) and `03-phase-1-form.html` (Bug B)
4. **Eyeball walk doc** — `audit/eyeball-stats-and-restore-fix.md` covering every PNG with one-sentence-per-PNG comment
5. **iOS Safari 15-item static review** — both bugs touch mobile UX (stats visible to guest mobile + form on mobile), so checklist applies
6. **Live port for user** — `npm run dev`, give URL + SOP after green

Sub-agent dispatch instructions MUST embed all 6 above as completion criteria.

---

## 4. Out of scope

- No backend `routes/circles-sessions.js` or `routes/guest-circles-sessions.js` modifications (PATCH /progress, POST /draft logic untouched).
- No mockup edits (mockups 01 + 03 are contract-locked, untouched).
- No `triggerSaveCycle` debounce/timing changes.
- No new save-side (write-direction) logic — fix is read-direction only. Write-side already uses correct Chinese keys.
- No retroactive DB migration of legacy English-keyed sessions (handled by frontend alias).
- No expansion of `loadCirclesStats` beyond the 1-line path branch.

---

## 5. Risk + rollback

**Backend risk (low):** New route + new mount; doesn't touch existing auth path. If broken, simply revert the mount line in `server.js` + delete `routes/guest-circles-stats.js`.

**Frontend risk (low):** Bug A is 1-line path-branch; Bug B removes a fallback. Worst case Bug B regression is "field shows empty when it should show value" — visible to user, recoverable via re-typing. Cannot make data worse than current drift.

**Test baseline:** jest 157 → 161 (+4 from new guest stats route tests). Playwright 91 → ~110 (+11 partial-fill specs + 2 stats stub specs). Both must stay 100% green before commit.

**Rollback plan:** Single commit per bug. `git revert <sha>` restores prior state. Backend route is purely additive.

---

## 6. Success criteria (gating ship)

- [ ] jest 161/161 green
- [ ] Playwright × 8 viewport ~110/110 green (chromium + webkit)
- [ ] 6+ PNGs per bug Read by opus director with one-sentence comments
- [ ] pixel-diff vs mockup 01 + 03 ≤ 0.5%
- [ ] iOS 15-item checklist walked
- [ ] eyeball walk doc committed
- [ ] live port verified by user with SOP
- [ ] CLAUDE.md updated with hotfix entry
- [ ] Single commit each (or 1 bundled commit) directly on main per standing rule
