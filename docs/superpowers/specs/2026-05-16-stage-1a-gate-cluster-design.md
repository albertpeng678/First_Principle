# Stage 1A — Gate Cluster (B1 + B6) Design Spec

**Date:** 2026-05-16
**Status:** Draft (awaiting user review)
**Cluster:** Stage 1 / 1A — Gate (B1 + B6)
**Carve-out:** ⚠️ Modifies `prompts/circles-gate.js` (Path 2 standing rule invoked: 後端/prompts 不動，except explicit user approval — granted 2026-05-16 in brainstorm Q2 = Level 2)
**Related Stage 0:** Reuses `tests/helpers/env-guard.js` + `tests/fixtures/auto-cleanup.fixture.js` + `e2e@first-principle.test` account (all shipped 2026-05-16)
**Defers:** Stage 1B (B3 + B4 — state/cache) / Stage 1C (B5 — UI mockup) / B-Hint task #174

---

## 1. Context

### Bugs in scope

**B1 — Gate accepts all "Y" answers**
- User screenshot PNG 19: Phase 1 form filled with `Y / Y / Y / Y / Y / Y / Y / Y` → gate evaluator passed → user could proceed to Phase 2.
- Root cause hypothesis (per Explore agent 2026-05-16):
  - `prompts/circles-gate.js:15-71` — 14-box prompt has quality rules (lines 30-39) but accepts brief yes-shaped answers if they pass syntax check.
  - FE `submitFrameworkToGate` (`public/app.js:7375-7443`) has no client-side length / triviality guard.

**B6 — Sometimes skips gate review entirely**
- User reported: "我有經歷過沒有經過審核階段直接放行的狀況" (no screenshot — intermittent).
- Root cause hypothesis (per Explore):
  - FE phase transition is synchronous: Phase 1 submit → `circlesPhase = 1.5` → render → shows gate. No mutex protects against:
    - rapid double-click on submit
    - parallel side-effect (rehydrate / localStorage restore) overwriting `circlesPhase` mid-flight
    - cross-tab session sync racing the gate response
- No reproduction steps from user; investigation = systematic-debugging.

### Why bundled together

B1 + B6 share the same Phase 1 → 1.5 gate code path. Fixing B1 (tighter validation) without B6 (race guard) means a tightened gate could still be skipped. Fixing them together = 1 e2e test surface, 1 carve-out review, 1 ship.

---

## 2. Architecture

### 2-layer defense + 1-mutex guard

```
                              [User fills Phase 1 form (8 fields: I.×4 + C1.×4)]
                                              │
                                         click「送出評估」
                                              │
              ┌───────────────────────────────┴───────────────────┐
              │  Layer 1 — FE pre-guard (frameworkValidator.js)    │ ◀── B1 治標
              │   minLength(value, 4)                              │
              │   notAllSameChar(value)                            │
              │   notTrivialAsciiToken(value)                      │
              └─────────────────┬──────────────────────────────────┘
                                │ pass → continue
                                │ fail → inline error UI, no POST
                                ▼
              ┌──────────────────────────────────────┐
              │  AppState.gateInflight = true (mutex)│ ◀── B6 race guard
              │  disable submit button                │
              └──────────────────┬───────────────────┘
                                 │
                                 ▼
                       POST /api/circles-evaluator/gate
                                 │
              ┌──────────────────┴────────────────────┐
              │  Layer 2 — BE prompt strict           │ ◀── B1 治本
              │   + quality rules (具體名詞/動詞/範圍)│
              │   + 4 few-shot examples (2 好 / 2 壞) │
              │   + 「敷衍/抽象 → error」             │
              └──────────────────┬────────────────────┘
                                 │ resp { overallStatus, items }
                                 ▼
              ┌──────────────────────────────────────┐
              │  AppState.gateInflight = false       │ ◀── B6 mutex 釋放
              │  re-enable button                    │
              │  render gate result (red/warn/green) │
              └──────────────────────────────────────┘
```

### Why layer 1 + layer 2

- **Layer 1 (FE)** — saves network cost on obvious garbage; instant feedback (no spinner wait).
- **Layer 2 (BE prompt)** — semantic check that FE can't do (`上班族` is 3 chars but legit only if context fits; needs LLM judgment).
- Defense in depth: layer 1 catches `Y / Y / Y` 100%; layer 2 catches `上班族男 / 上班族男 / ...` (passes layer 1, fails semantic).

### Why mutex (not full async lock)

Single-tab rapid double-click is the realistic risk. Cross-tab sync is rare in solo-user workflow (deferred to Stage 1B if turns out to matter). `gateInflight` is in-memory only — no localStorage persistence (per error-handling §5: mid-flight refresh resets safely).

---

## 3. Components

### New files (5)

| File | LOC | Responsibility | Tests |
|---|---|---|---|
| `public/lib/frameworkValidator.js` | ~60 | 4 pure functions: `minLength(v, n)` (default n=4) / `notAllSameChar(v)` (rejects `aaaa`, `1111`, `....`) / `notTrivialAsciiToken(v)` (rejects ≤4-char ASCII tokens with no spaces + no Chinese chars; e.g., `asdf`, `Y`, `1234`; passes `30 歲女性` because contains Chinese) + `validateFrameworkInput(values)` aggregate. Returns `{ ok: bool, errors: [{field, rule, message}] }`. | `tests/unit/framework-validator.test.js` (jest, ~15 specs incl. IL-3 red-green-revert) |
| `tests/setup/auth.setup.js` | ~30 | Setup project: UI-login `e2e@first-principle.test` once → save `playwright/.auth/user.json` for storageState reuse. | implicit (other specs depend on it) |
| `tests/factories/circles-phase1.factory.js` | ~80 | 3 pools `garbage()` / `thin()` / `quality()` returning `{I:{4 fields}, C1:{4 fields}}` with realistic zh-TW content. | implicit (used downstream) |
| `tests/page-objects/circles-phase1.page.js` | ~80 | POM: constructor takes `Page`, locators readonly, methods `fillI(values)` / `fillC1(values)` / `submitGate()` / `getGateStatus()`. **Zero assertions inside** (per `pom/page-object-model.md`). | implicit |
| `tests/e2e/circles-gate.spec.js` (5 specs) + `tests/api/circles-gate-contract.spec.js` (6 specs) | ~250 + ~120 | E2E happy / sad-garbage / sad-thin / race (B6) / visual baseline; API contract per input class. | self |

### Modified files (3)

| File | Change | LOC delta |
|---|---|---|
| `public/app.js` | (a) `submitFrameworkToGate` entry: call `validateFrameworkInput()`; if fail, render inline errors and return. (b) On pass: set `AppState.gateInflight=true`, disable submit button. (c) Gate response handler: set `gateInflight=false`, re-enable. (d) Phase transition entry points (3 sites): early-exit if `gateInflight=true`. | +35 / -5 |
| `prompts/circles-gate.js` | Add quality rules: 「答案需含具體名詞 + 動詞 + 範圍/數量描述」「敷衍/抽象詞 → overallStatus=error」. Add 4 few-shot examples (2 good → ok / 2 stub-style with `Y Y Y Y` + `aaa bbb` → error). max_tokens unchanged. | +35 / -0 |
| `playwright.config.js` (existing) | Add `setup` project + `dependencies: ['setup']` + `storageState: 'playwright/.auth/user.json'` + `process.env.CI` knob (`reporter`, `retries`, `forbidOnly`, `trace`). | +20 |

### Reused (Stage 0 deliverables, no change)

| File | Use |
|---|---|
| `tests/helpers/env-guard.js` | `assertNotProdWithRealAccount({baseUrl, email})` in spec setup |
| `tests/fixtures/auto-cleanup.fixture.js` | `cleanupTracker.track('circles', sessionId)` in e2e specs; afterEach DELETE |
| `.env.local` / `.env.test` | `BASE_URL` + `TEST_EMAIL` / `TEST_PASSWORD` |
| `e2e@first-principle.test` (live on prod, userId `4501e548-dbfa-4870-ab84-b24e5a0aeeb2`) | Auth target for `auth.setup.js` |

### `.gitignore` additions

```
playwright/.auth/
playwright-report/
test-results/
```
(Verify each before adding; some may already exist.)

---

## 4. Data Flow / State Machine

### Phase × gateInflight matrix

| Phase | gateInflight | Submit button | Phase transitions allowed |
|---|---|---|---|
| 1 | false | enabled | → 1.5 (via submitFrameworkToGate) |
| 1 | true | disabled (mutex) | none (race guard blocks) |
| 1.5 | false | n/a (gate result rendered) | → 2 (if status=ok or warn, user-clicked) |
| 2 | false | n/a | → 3 (via Phase 2 conclude) |

### Submit flow

1. **Pre-guard (Layer 1)** — `validateFrameworkInput(values)` runs sync.
   - Pass: continue.
   - Fail: render inline errors next to each failing field; do NOT set `gateInflight`; do NOT POST.
2. **Mutex acquire** — `AppState.gateInflight = true`. Disable submit button. Render loading spinner per existing UX.
3. **POST `/api/circles-evaluator/gate`** with `{ sessionId, frameworkDraft }`.
4. **BE Layer 2** — prompt evaluates 14 boxes; returns `{ overallStatus: 'ok'|'warn'|'error', items: [{box, status, comment}] }`.
5. **Mutex release** — `AppState.gateInflight = false`. Re-enable button.
6. **Render gate result** — per mockup 04 (red/warn/green tri-state).
7. **User decision** — click 「進入下一步」 if status=ok or warn → `circlesPhase = 2`; if error → stay at 1.5 to revise.

### Race guard entry points (B6)

Three sites in `public/app.js` add this guard:
```js
if (AppState.gateInflight) {
  console.warn('gate inflight; ignoring transition');
  return;
}
```
Sites:
- `submitFrameworkToGate` entry (dedupe rapid double-click)
- `setCirclesPhase(n)` setter (block `setPhase(2)` calls during gate inflight)
- `rehydrateCirclesFromServer` (don't overwrite phase mid-flight from server response)

`gateInflight` is **in-memory only** — never written to localStorage, never sent to BE. On refresh, defaults to false. On `localStorage` rehydrate, never read (so no stale `true` value can resurrect).

### Cleanup flow (e2e specs)

Per Stage 0 `tests/fixtures/auto-cleanup.fixture.js`:
```js
// in spec
cleanupTracker.track('circles', sessionId);  // register at spec start
// ... test body ...
// auto fixture afterEach:
//   for each tracked: DELETE /api/circles-sessions/:id
//   if any non-404 fail: throw → spec marked failed (loud)
```

---

## 5. Error Handling

### Failure classes

| Failure | Trigger | Behavior | UX |
|---|---|---|---|
| Layer 1 fail | FE pre-guard | No POST; inline error per field («需 ≥ 4 字» / «不能全同字» / «請更具體») | Inline; submit button stays enabled |
| Layer 2 error | `overallStatus=error` | Render gate UI red box; stay at Phase 1.5; «修正後再試» CTA | Per mockup 04. **Per memory `feedback_gate_red_blocks_always`: red = 必擋, no simulation override** |
| Layer 2 warn | `overallStatus=warn` | Render gate UI yellow box; «進入下一步» enabled (warn ≠ block) | Per mockup 04 |
| Network fail | `fetch` reject / `response.ok=false` | Toast «送出失敗，請重試» + retry button; `gateInflight=false` (mutex released) | Form values preserved; no data loss |
| Server 5xx | `response.status >= 500` | Same as network fail | Same |
| Malformed response | JSON parse error / missing `overallStatus` | Same as network fail; `console.error` logs raw response (no token) | Same |
| Mid-flight refresh | User F5 during inflight | `gateInflight` is in-memory → reset to false on reload; rehydrate phase from server `current_phase` | Form values restored from `circles_sessions.framework_draft` (existing logic); user re-submits |
| Cross-tab race | 2 tabs submit ~simultaneously | No FE-side mutex; BE idempotent guard catches; window ~5s | **Out of scope for 1A** — defer to 1B if symptomatic |

### Retry semantics

- **Layer 1 fail** — manual: user fixes value, re-clicks.
- **Layer 2 error/warn** — manual: revise per gate UI feedback, re-clicks.
- **Network fail** — manual: 1-click retry button reuses same `sessionId` (BE idempotent on POST /gate).
- **Auto retry** — **none** (per Karpathy Simplicity First: auto retry hides root cause).

### Security

| Concern | Mitigation |
|---|---|
| Gate response echoes user input | FE escapes via `textContent` (existing; not `innerHTML`) |
| Prompt injection in form input | BE prompt sandboxes user content in quote block (existing) |
| Token expired (401) | Re-login flow (existing) |
| Logging leaks token | Network fail path logs `status` + `message`; never `Authorization` header (per Stage 0 security review) |

---

## 6. Testing Strategy

### Layered approach (per `playwright-skill core/test-architecture.md` testing trophy)

| Layer | Tool | Scope | Specs |
|---|---|---|---|
| Unit | jest | `frameworkValidator.js` 3 pure functions + `gateInflight` mutex logic | ~15 (incl. IL-3 red-green-revert cycle) |
| API contract | Playwright `request` context (no browser, fastest) | POST `/api/circles-evaluator/gate` × 3 input classes (garbage / thin / quality) | 6 |
| E2E user journey | Playwright `page` (real browser, real BE) | Login → CIRCLES question → Phase 1 fill → 1.5 gate → Phase 2 transition | 4 critical |
| E2E race | Playwright `page` | Rapid double-click on submit → 2nd blocked by `gateInflight` | 1 |
| Visual baseline | Playwright `page` + `toHaveScreenshot` | Gate result red / warn / green × Mobile-360 | 3 (extension of existing baseline) |
| Adversarial sweep | existing `npm run test:adversarial` (per memory `feedback_adversarial_review_testing`) | 10 case × 5 stage; CIRCLES gate is 1 of 5 stages | required gate before ship |

### Failing-test order (per IL-3)

1. Write E2E spec (red: feature absent).
2. Write unit spec for `frameworkValidator` (red: module missing).
3. Implement `frameworkValidator.js` → unit green.
4. Wire `submitFrameworkToGate` to call validator + set `gateInflight` → E2E green.
5. Modify `prompts/circles-gate.js` → API contract green.
6. Run adversarial sweep → block ship if any case ❌.
7. Revert each piece (unit, then E2E) → confirm goes red → restore → confirm green again.

### Cross-viewport coverage

Per memory `feedback_full_sit_uat_uiux`: full 8 vp Playwright suite must pass before ship (iPhone-SE / 14 / 15-Pro / iPad / Mobile-360 / Desktop-1280 / 1440 / 2560).

For gate-cluster specs specifically, 3 representative viewports (per `mobile-and-responsive.md` recommendation) cover reflow risk:
- desktop-chrome (Desktop-1280)
- mobile-chrome (Mobile-360)
- mobile-safari (iPhone-14, WebKit)

### Director cold-Read PNG (per memory `feedback_uiux_visual_only`)

After spec passes, director runs Playwright capture × 3 vp → opens each PNG via Read tool → comments inline. No DOM-only audit accepted.

---

## 7. Acceptance Criteria

Stage 1A is "done" when **all** below pass:

### Functional

- [ ] **B1-AC1**: Filling all 8 Phase 1 fields with `Y` (1 char each) → submit blocked at Layer 1 (`minLength` rule) with inline error per field.
- [ ] **B1-AC2**: Filling all 8 fields with `YYYY` (4 same chars each) → blocked at Layer 1 (`notAllSameChar` rule).
- [ ] **B1-AC3**: Filling all 8 fields with `asdf` (4-char ASCII no spaces) → blocked at Layer 1 (`notTrivialAsciiToken` rule).
- [ ] **B1-AC4**: Filling all 8 fields with `上班族` (3 chars Chinese) → blocked at Layer 1 (`minLength` < 4).
- [ ] **B1-AC5**: Filling all 8 fields with `上班族男` (4 chars Chinese) → passes Layer 1 (≥4 chars, has Chinese so not trivial ASCII), BE Layer 2 evaluates semantics; expected `overallStatus=warn` or `error` (semantically thin).
- [ ] **B1-AC6**: Filling all 8 fields with realistic zh-TW (≥ 10 chars per field, with named entities + verbs + range/quantity) → passes both layers → user can click 「進入下一步」 to Phase 2.
- [ ] **B6-AC1**: Rapid double-click on 「送出評估」 → only 1 POST sent to `/api/circles-evaluator/gate` (verified via `page.route()` request counter).
- [ ] **B6-AC2**: During gate inflight (between POST and response), submit button is `disabled` (verified via `expect(btn).toBeDisabled()`).
- [ ] **B6-AC3**: Mid-flight refresh (F5 during POST inflight) → page reloads to Phase 1 with form values preserved (from server `framework_draft`); `gateInflight` resets to false in-memory; user can re-submit cleanly.
- [ ] **B6-AC4** (adversarial): Programmatically setting `AppState.circlesPhase = 2` while `gateInflight=true` → mutex guard at `setCirclesPhase` rejects (logs warn); state remains 1 (no skip).

### Quality gates

- [ ] All ~30 jest specs (15 unit + 6 API contract + ~9 cross-cutting) pass.
- [ ] All 5 e2e specs (4 critical + 1 race) pass on 3 viewports (desktop / mobile-chrome / mobile-safari).
- [ ] Visual baseline 3 specs pass (gate red/warn/green × Mobile-360).
- [ ] Adversarial sweep 10 cases × 5 stages: 0 ❌ on CIRCLES gate stage.
- [ ] Full 8-vp Playwright regression: 0 new failures (1 pre-existing fail OK per Stage 0 baseline).
- [ ] iOS Safari 15-item static review (per memory `feedback_ios_review_before_ship`).
- [ ] Director cold-Read 9 PNG (3 viewports × 3 gate states) with inline comments.

### Process gates

- [ ] User-typed «進入下一步» on user gate after spec written.
- [ ] Two-stage review per task (spec compliance + code quality) per memory `feedback_two_stage_review_mandatory`.
- [ ] CLAUDE.md state board updated.
- [ ] Standing memory updated if new pattern emerges.

---

## 8. Out of Scope

| Bug | Why deferred | When |
|---|---|---|
| B2 (test fixture stub strings) | Resolved by Stage 0 B7 cleanup (4 polluted sessions deleted) | Verify-only after Stage 1A ship |
| B3 (回評分 stuck loading) | Different root cause (Phase 3 SSE/state); Stage 1B | After 1A ship |
| B4 (offcanvas cache invalidation) | Different root cause (DELETE non-blocking + cache); Stage 1B | After 1A ship |
| B5 (Phase 2 chat UI mockup) | Pure FE CSS+render, no functional risk; Stage 1C | After 1A + 1B ship |
| B7 (prod pollution) | Done in Stage 0 (commit `1ba062e`) | — |
| B8 (UAT methodology) | Stage 0 infra (auto-cleanup fixture / env-guard) addresses; ongoing adoption | Continuous |
| B-Hint task #174 | Hint prompt review; separate cycle | After Stage 1A |
| Cross-tab `gateInflight` sync (BroadcastChannel) | Edge case; window ~5s; BE idempotent already | Stage 1B if user reports |
| GitHub Actions CI setup | Solo workflow; can run locally | Future stage |

---

## 9. References

- Plan: TBD (writing-plans skill output, file `docs/superpowers/plans/2026-05-16-stage-1a-gate-cluster.md`)
- Stage 0 spec: `docs/superpowers/specs/2026-05-16-stage-0-b7-cleanup-design.md`
- Skill integration plan: `audit/skill-integration-plan-2026-05-16.md` v2.1
- Master Spec §0.5: `docs/superpowers/specs/2026-05-02-frontend-rewrite-master-spec.md`
- Mockup 04: `docs/superpowers/specs/mockups/2026-05-02-frontend-rewrite/04-phase-1-5-gate.md`
- Existing prompt: `prompts/circles-gate.js`
- Existing FE submit: `public/app.js:7375-7443`
- playwright-skill: `/Users/albertpeng/.claude/skills/playwright-skill/`
- Memory: `feedback_three_iron_laws.md` / `feedback_e2e_real_data_only.md` / `feedback_gate_red_blocks_always.md` / `feedback_adversarial_review_testing.md` / `feedback_full_sit_uat_uiux.md` / `reference_playwright_skill_testing_bible.md`
