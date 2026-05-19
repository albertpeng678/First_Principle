# Lane B — Test Inventory Map (2026-05-17)

> Extends `audit/testing-trophy-audit-2026-05-16.md`. Files already classified there are listed in the summary counts but NOT repeated row-by-row. This file covers EVERY file missed by the previous audit.

---

## Categorized Table — New Files (not in prior audit)

### A. API Layer — Real Playwright `request` against localhost (Trophy API 60%)

| File | LOC | Trophy Tier | Real-vs-Hollow | Tests what | Product surface | Entry-point |
|---|---|---|---|---|---|---|
| `tests/api/lifecycle-circles.spec.js` | 255 | API (Trophy 60%) | REAL (Playwright request → localhost:4000 + real Supabase test DB; only `api.openai.com` mocked via route.fulfill) | POST /draft, PATCH /progress, POST /gate, POST /final-report lifecycle transitions | CIRCLES Phase 1→2→3→4 state machine | line 34 `test.describe('CIRCLES session lifecycle')` |
| `tests/api/lifecycle-nsm.spec.js` | 291 | API (Trophy 60%) | REAL (same pattern) | POST NSM /gate, /evaluate, /progress | NSM Steps 1-4 lifecycle | line 38 `test.describe('NSM session lifecycle')` |
| `tests/api/lifecycle-list.spec.js` | 234 | API (Trophy 60%) | REAL | GET list + include_empty filter | Session list API | line 30 `test.describe('lifecycle list filter')` |
| `tests/api/circles-gate-contract.spec.js` | 153 | API (Trophy 60%) | REAL (localhost:3000 + real Supabase; env token gate; 401 spec always runs) | POST /api/circles-sessions/:id/gate — shape + auth + content validation | CIRCLES Phase 1.5 Gate | line 35 `const QUESTION_ID = 'circles_001'` / test line 72 |

### B. Unit — Pure Functions (Trophy Unit)

| File | LOC | Trophy Tier | Real-vs-Hollow | Tests what | Product surface | Entry-point |
|---|---|---|---|---|---|---|
| `tests/lib/question-bank.test.js` | 21 | Unit | REAL (reads real JSON files from disk) | `circlesById` / `nsmById` lookup functions | Question bank lib | line 3 `describe('question-bank lookup')` |
| `tests/lib/session-cache.test.js` | 45 | Unit | REAL (pure in-memory module) | `cache.get/set/invalidate/_reset` | Session cache lib | line 5 `describe('session-cache')` |
| `tests/lib/session-dedup.test.js` | 79 | Unit | REAL (pure function) | `dedupSessions` — completed beats active, latest wins | Session dedup lib | line 5 `describe('dedupSessions')` |
| `tests/lib/session-rehydrate.test.js` | 40 | Unit | REAL (reads real question bank) | `rehydrateQuestionJson` — merge field_examples from bank | Session rehydrate lib | line 3 `describe('session rehydrate')` |
| `tests/circles-database-analysis.test.js` | 56 | Unit | REAL (reads real circles_database.json) | 100/100 questions have populated analysis fields | CIRCLES question DB completeness | line 5 `describe('circles_database.json analysis backfill')` |
| `tests/sp4-nsm-context-backfill.test.js` | 71 | Unit | REAL (reads real script file) | `isContextComplete` / `loadQuestions` / `saveQuestions` exports | NSM context backfill script | line 7 `describe('scripts/backfill-nsm-context.js')` |
| `tests/sp4-nsm-context-prefer-pregenerated.test.js` | 62 | Unit | HOLLOW — vm.createContext used to extract `getNsmContextSource` from app.js; function no longer exists (PENDING_PATH_2_REIMPL marker present) | Prefer pre-generated context over fetch | NSM context source selection | line 8 `describe('NSM context source selection')` |
| `tests/sp4-nsm-db-extraction.test.js` | 45 | Unit | REAL (reads real nsm-db.js + app.js) | NSM_QUESTIONS extracted to public/nsm-db.js with 103 entries | NSM DB extraction | line 7 `test('public/nsm-db.js exists')` |
| `tests/snapshot-guard.test.js` | 44 | Unit | REAL (reads real server-side prompt files as text) | Q3 contract — prompts use session.question_json not fresh DB lookup | Prompt correctness contract | line 9 `describe('Q3 — server-side prompts use session.question_json')` |
| `tests/nsm-step2-hint.test.js` | 31 | Unit | REAL (imports real module) | `generateNSMStep2Hint` exports async function | NSM step2 hint prompt module | line 3 `describe('generateNSMStep2Hint')` |
| `tests/sp1.5-helpers.test.js` | 74 | Unit | HOLLOW — vm.createContext to extract helpers from app.js | `formatSaveError`, `hasMeaningfulContent`, `clampScore` helpers | app.js helpers | line 12 `describe(...)` via vm load |
| `tests/sp1.5-bugfix-helpers.test.js` | 45 | Unit | HOLLOW — vm.createContext to extract from app.js | `loadCirclesSessionFromHistory` NSM branch field population | app.js NSM restore | line 12 via vm |
| `tests/sp1.5-bugfix-action-bar.test.js` | 65 | Unit | HOLLOW — vm.createContext | Action bar visible logic (phase 2) | app.js action bar | line 15 via vm |
| `tests/sp1.5-locked-banner.test.js` | 54 | Unit | HOLLOW — vm.createContext + `isStepLocked` function extraction | Step locked logic | app.js step lock | line 14 via vm |
| `tests/nsm-render-bug-fixes.test.js` | 206 | Unit | HOLLOW — vm.createContext to extract render functions from app.js | Fix 1-3: renderNSMDim / renderNSMField / renderNSMContextCard | NSM render helpers | line 12 `describe('NSM render bug fixes')` |
| `tests/issue-bug1-nsm-session-restore.test.js` | 231 | Unit | HOLLOW — pure logic mirror (no vm; just JS constant mirroring app.js routing logic) | NSM restore smart routing: scored→step4, in-progress→correct step | NSM offcanvas restore | line 14 `describe('Bug 1...')` |
| `tests/issue2b-offcanvas-phase-restore.test.js` | 66 | Unit | HOLLOW — pure logic mirror | Phase restore always returns Phase 1 for incomplete sessions | Offcanvas restore | line 13 `describe('Issue 2b...')` |

### C. Supertest Route Tests (Jest + supertest against real express — no browser)

| File | LOC | Trophy Tier | Real-vs-Hollow | Tests what | Product surface | Entry-point |
|---|---|---|---|---|---|---|
| `tests/circles-sessions.test.js` | 1052 | API | SEMI-HOLLOW — `jest.mock('../db/client')` mocks Supabase client; real express routes but fake DB | CIRCLES sessions CRUD, auth, guest, B4 cache specs | CIRCLES sessions API | line 5 `describe('CIRCLES Sessions')` |
| `tests/circles-sessions-draft.test.js` | 220 | API | HOLLOW — `jest.mock('../db/client')` | POST /draft lazy-create auth + guest | CIRCLES draft endpoint | line 3 `describe('POST /draft')` |
| `tests/circles-stats.test.js` | 25 | API | REAL (real express, real Supabase for 401 test only) | 401 without auth | CIRCLES stats API | line 5 `describe('GET /api/circles-stats')` |
| `tests/guest-circles-stats.test.js` | 32 | API | REAL (real express, 400 without guest-id) | 400 without X-Guest-ID header | Guest stats API | line 4 `describe('GET /api/guest-circles-stats')` |
| `tests/nsm-public-route.test.js` | 38 | API | REAL (real express, 400 on missing fields — no DB needed) | POST /api/nsm-public/step2-hint missing params | NSM public hint route | line 3 `describe('POST /api/nsm-public/step2-hint')` |
| `tests/middleware.test.js` | 74 | Unit | SEMI-HOLLOW — `jest.mock('../db/client')` for auth.getUser | `requireGuestId` + `requireAuth` middleware logic | Auth + guest middleware | line 12 `describe('requireGuestId')` |
| `tests/migrate-guest.unit.test.js` | 94 | API | HOLLOW — `jest.mock` auth/guest middleware + `jest.mock('../db/client')` | POST /api/migrate-guest CIRCLES/NSM/Legacy/conflict buckets | Guest migration route | line 10 `describe('POST /api/migrate-guest')` |
| `tests/circles-coach.test.js` | 196 | Unit | HOLLOW — `jest.mock('openai')` entire OpenAI package | `circles-coach.js` prompt construction + output parsing | CIRCLES coach AI module | line 13 `describe('circles-coach')` |
| `tests/circles-evaluator.test.js` | 456 | Unit | HOLLOW — `jest.mock('openai')` | Evaluator prompt + schema output | CIRCLES evaluator AI module | line 13 `describe('circles-evaluator')` |
| `tests/bug6-nsm-persistence-fix.test.js` | 209 | Unit | HOLLOW — pure logic (makeDef helpers, no require of real module) | triggerNsmSaveCycle payload / bindNSMStep1 session create / rehydrate coerce | NSM persistence fix contracts | line 17 `describe('Bug 6 — NSM persistence')` |
| `tests/bug6b-persistence.test.js` | 1498 | API | HOLLOW — `jest.mock('../db/client')` inline chain mock | NSM + CIRCLES PATCH /progress + GET list + FE rehydrate | NSM/CIRCLES persistence | line 19 `describe('Section A: Backend route tests')` |

### D. Integration Tests

| File | LOC | Trophy Tier | Real-vs-Hollow | Tests what | Product surface | Entry-point |
|---|---|---|---|---|---|---|
| `tests/integration/circles-evaluator.live.test.js` | 44 | Integration | REAL — calls real OpenAI (gated on `OPENAI_API_KEY`, `describe.skip` when absent) | `coachVersion` structured schema returned by evaluator | CIRCLES Phase 3 evaluator AI output | line 13 `maybe('SP3 (live)...')` |
| `tests/integration/hint-routes.test.js` | 47 | API | SEMI-HOLLOW — mocks OpenAI prompt modules but uses real express routes | Hint endpoints accept question-only payloads; route wiring correct | NSM hint routes | line 10 `describe('hint routes')` |

### E. Adversarial Tests (real OpenAI calls)

| File | LOC | Trophy Tier | Real-vs-Hollow | Tests what | Product surface | Entry-point |
|---|---|---|---|---|---|---|
| `tests/adversarial/circles-coach.spec.js` | 162 | Adversarial | REAL — calls real OpenAI | Coach prompt adversarial inputs (garbage/thin/edge) | CIRCLES coach AI | line 5 `test.describe('Adversarial — circles-coach')` |
| `tests/adversarial/circles-evaluator.spec.js` | 38 | Adversarial | REAL — calls real OpenAI | Evaluator adversarial | CIRCLES evaluator | line 3 `describe('Adversarial...')` |
| `tests/adversarial/circles-final-report.spec.js` | 60 | Adversarial | REAL — calls real OpenAI | Final report adversarial | CIRCLES Phase 4 | line 3 `describe('Adversarial...')` |
| `tests/adversarial/circles-gate.spec.js` | 38 | Adversarial | REAL — calls real OpenAI | Gate adversarial inputs | CIRCLES Phase 1.5 Gate | line 3 `describe('Adversarial...')` |
| `tests/adversarial/nsm-evaluator.spec.js` | 55 | Adversarial | REAL — calls real OpenAI | NSM evaluator adversarial | NSM Step 4 AI | line 3 `describe('Adversarial...')` |
| `tests/adversarial/nsm-gate.spec.js` | 39 | Adversarial | REAL — calls real OpenAI | NSM gate adversarial | NSM Step 3 Gate | line 3 `describe('Adversarial...')` |
| `tests/adversarial/nsm-step2-hint.test.js` | 130 | Adversarial | REAL — calls real OpenAI | NSM step2 hint robustness | NSM Step 2 hints | line 10 `describe('NSM step2 hint adversarial')` |
| `tests/adversarial/nsm-step3-hint.test.js` | 163 | Adversarial | REAL — calls real OpenAI | NSM step3 hint robustness | NSM Step 3 hints | line 10 `describe('NSM step3 hint adversarial')` |

### F. Scripts Tests

| File | LOC | Trophy Tier | Real-vs-Hollow | Tests what | Product surface | Entry-point |
|---|---|---|---|---|---|---|
| `scripts/scan-pollution.test.js` | 135 | Unit | REAL (pure regex function test) | `isPolluted` / `extractStrings` from scan-pollution.js | Data pollution detection | line 4 `describe('isPolluted regex')` |

### G. SP4 misc

| File | LOC | Trophy Tier | Real-vs-Hollow | Tests what | Product surface | Entry-point |
|---|---|---|---|---|---|---|
| `tests/sp4-nsm-context-backfill.test.js` | 71 | Unit | REAL | Script existence + exported test hooks | NSM context script | line 7 `describe(...)` |

### H. Audit Batch

| File | LOC | Trophy Tier | Real-vs-Hollow | Tests what | Product surface | Entry-point |
|---|---|---|---|---|---|---|
| `tests/audit/specs/batch-01.spec.js` | 326 | E2E | REAL — Playwright against localhost:4000, guest session only | CIRCLES Home render + RWD × 4 breakpoints (50 tests) | CIRCLES Home | line 14 `test.describe('Batch 01 — CIRCLES Home')` |

### I. Visual Specs — Path 2 Production Contract Tests (Playwright + localhost)

All files in this group use `page.route()` to stub stats/session list endpoints (own API mock = HOLLOW for those stubs), but navigate to and interact with the real rendered app at localhost. The stubs avoid flaky network calls; the assertions validate rendered DOM structure.

**Key hollow signal**: any file calling `route.fulfill` on `/api/*` own endpoints is partially hollow for that surface but REAL for the UI rendering under test.

| File | LOC | Trophy Tier | Real-vs-Hollow | Tests what | Product surface | Entry-point |
|---|---|---|---|---|---|---|
| `tests/visual/smoke.spec.js` | 29 | E2E | REAL | App boots without console errors | All | line 3 `test.describe('Path 2 Plan A smoke')` |
| `tests/visual/auth-flow.spec.js` | 231 | E2E | REAL (no own-API mocks; navigates to login page) | Login/register/logout/migration/token-expiry DOM structure | Auth (mockup 02) | line 9 `test.describe('Auth Flow')` |
| `tests/visual/circles-home.spec.js` | 289 | E2E | SEMI-HOLLOW (stubs stats+session lists) | CIRCLES Home BEM, 5-random, reshuffle, mode toggle | CIRCLES Home (mockup 01) | line 12 `test.describe('B1 CIRCLES Home')` |
| `tests/visual/circles-gate.spec.js` | 276 | E2E | SEMI-HOLLOW (injects gate result via route.fulfill on gate endpoint) | Phase 1.5 gate 3 states (ok/warn/error) + loading | CIRCLES Phase 1.5 Gate (mockup 04) | line 3 `test.describe('Phase 1.5 Gate')` |
| `tests/visual/phase1-form.spec.js` | 172 | E2E | SEMI-HOLLOW (stubs stats) | Phase 1 form BEM + 13 viewport-conditional contracts | CIRCLES Phase 1 (mockup 03) | line 5 `test.describe('B SB3 Phase 1 Form')` |
| `tests/visual/phase2-chat.spec.js` | 812 | E2E | SEMI-HOLLOW (stubs sessions/stats, route.fulfill SSE for typewriter) | Phase 2 bubble layout, SSE streaming, 4 bottom states | CIRCLES Phase 2 (mockup 05) | line 9 `test.describe('Phase 2 Chat')` |
| `tests/visual/phase2-qchip.spec.js` | 83 | E2E | SEMI-HOLLOW (stubs stats) | Phase 2 qchip open/close × 3 vp | CIRCLES Phase 2 qchip | line 3 `test.describe('Phase 2 qchip')` |
| `tests/visual/phase2-typewriter.spec.js` | 260 | E2E | SEMI-HOLLOW (route.fulfill SSE) | Typewriter per-delta render, cursor, timing | CIRCLES Phase 2 typewriter | line 12 `test.describe('Phase 2 typewriter')` |
| `tests/visual/phase3-score.spec.js` | 349 | E2E | SEMI-HOLLOW | Phase 3 score card rendering (mockup 11) | CIRCLES Phase 3 | line 8 `test.describe('Phase 3 Score')` |
| `tests/visual/phase3-error-loading.spec.js` | 242 | E2E | SEMI-HOLLOW | Phase 3 error + slow-loading inline warn | CIRCLES Phase 3 error (mockup 12) | line 5 `test.describe('Phase 3 Error/Loading')` |
| `tests/visual/phase4-final.spec.js` | 381 | E2E | SEMI-HOLLOW (stubs session/gate) | Phase 4 final report radar + step-rows (mockup 13) | CIRCLES Phase 4 | line 8 `test.describe('Phase 4 Final')` |
| `tests/visual/nsm-home.spec.js` | 76 | E2E | SEMI-HOLLOW (stubs sessions) | NSM step 1 home 5-cards + 4-col context (mockup 06) | NSM Step 1 | line 6 `describe('NSM Home')` |
| `tests/visual/nsm-step-2-3.spec.js` | 228 | E2E | SEMI-HOLLOW | NSM step 2/3 sub-tabs + 4-dim label (mockup 07) | NSM Steps 2-3 | line 5 `test.describe('NSM Step 2-3')` |
| `tests/visual/nsm-step-4.spec.js` | 316 | E2E | SEMI-HOLLOW | NSM step 4 tabs + coach panel + pentagon radar (mockup 14) | NSM Step 4 | line 6 `test.describe('NSM Step 4')` |
| `tests/visual/nsm-lock-state.spec.js` | 156 | E2E | SEMI-HOLLOW | NSM step 2+3 lock state — hint/example still visible | NSM Steps 2-3 lock | line 5 `test.describe('NSM lock state')` |
| `tests/visual/nsm-gate-inline.spec.js` | 238 | E2E | SEMI-HOLLOW | NSM gate inline 5-dim × 3 states (mockup 08) | NSM Step 3 Gate | line 5 `test.describe('NSM Gate Inline')` |
| `tests/visual/offcanvas.spec.js` | 153 | E2E | SEMI-HOLLOW (stubs session list) | Offcanvas 280px drawer + 4 states × 3 vp (mockup 09) | Offcanvas history | line 5 `test.describe('D1 Offcanvas History drawer')` |
| `tests/visual/onboarding.spec.js` | 122 | E2E | SEMI-HOLLOW | Welcome + 4-step coachmark + dual-ring spotlight (mockup 10) | Onboarding | line 5 `test.describe('Onboarding')` |
| `tests/visual/master-pixel-diff.spec.js` | 1486 | Visual | REAL (reads real mockup HTML + compares pixel-diff to localhost screenshots) | 16 mockups × 3 vp pixel-diff ≤0.5% | All mockups (Layer 2) | line 9 `test.use({ baseURL })` |
| `tests/visual/bounding-box-phase1-invariants.spec.js` | 96 | E2E | REAL (no API mocks for core assertions) | 5 boundingBox invariants across Phase B items | CIRCLES/NSM Phase B | line 12 `test.describe('Phase 1 invariants')` |
| `tests/visual/phase-b-ship-readiness.spec.js` | 399 | Visual | REAL (pixel-diff comparison) | mockup 14 §A + 05 §G + 07 §D/§E pixel-diff | CIRCLES Phase 2/NSM Step 4 | line 10 `test.describe('Phase B ship readiness')` |
| `tests/visual/baselines.spec.js` | 29 | Visual | REAL (screenshot capture only) | Mockup HTML baseline capture | All (Layer 1) | line 8 `test.describe('Mockup baselines (Layer 1)')` |
| `tests/visual/conversation-persistence-roundtrip.spec.js` | 132 | E2E | SEMI-HOLLOW | SSE conversation stored + reloaded correctly | CIRCLES Phase 2 persistence | line 5 `test.describe(...)` |
| `tests/visual/restore-no-drift.spec.js` | 275 | E2E | SEMI-HOLLOW | Offcanvas click → correct step restore, no drift | Offcanvas restore | line 5 `test.describe(...)` |
| `tests/visual/cross-tab-resume-toast.spec.js` | 151 | E2E | REAL | Cross-tab resume toast appears on re-open | §D cross-tab (mockup 16) | line 5 `test.describe(...)` |
| `tests/visual/sb4-sb5-section-pixel-diff.spec.js` | 149 | Visual | REAL (pixel-diff) | mockup 03 §B + §C pixel-diff (reports raw %, human-judged) | CIRCLES Phase 1 form §B/§C | line 5 `test.describe(...)` |
| `tests/visual/sb6-section-pixel-diff.spec.js` | 98 | Visual | REAL | mockup 03 §D pixel-diff | CIRCLES Phase 1 form §D | line 5 `test.describe(...)` |
| `tests/visual/sb7-section-pixel-diff.spec.js` | 113 | Visual | REAL | mockup 03 §E pixel-diff (E-step via L-step baseline) | CIRCLES Phase 1 form §E | line 5 `test.describe(...)` |
| `tests/visual/sb9b-section-pixel-diff.spec.js` | 120 | Visual | REAL | mockup 03 §E frames: mobile-locked / tablet-stale / desktop-error | CIRCLES Phase 1 form §E states | line 5 `test.describe(...)` |
| `tests/visual/nsm-circles-parity-phase2.spec.js` | 104 | E2E | SEMI-HOLLOW | NSM phase 2 UI parity with CIRCLES | NSM/CIRCLES parity | line 5 `test.describe(...)` |
| `tests/visual/nsm-context-expand.spec.js` | 91 | E2E | SEMI-HOLLOW | NSM context card expand/collapse | NSM Step 1 context | line 5 `test.describe(...)` |
| `tests/visual/nsm-search-focus-clear.spec.js` | 111 | E2E | REAL | NSM search focus → X clear button | NSM Step 1 search | line 5 `test.describe(...)` |
| `tests/visual/nsm-back-button.spec.js` | 63 | E2E | REAL | NSM back button navigates correctly | NSM navigation | line 3 `test.describe(...)` |
| `tests/visual/nsm-back-scored-guard.spec.js` | 136 | E2E | REAL | Back on scored session triggers guard dialog | NSM scored guard | line 5 `test.describe(...)` |
| `tests/visual/nsm-card-inplace-expand.spec.js` | 116 | E2E | SEMI-HOLLOW | NSM card in-place expand | NSM Step 1 cards | line 5 `test.describe(...)` |
| `tests/visual/nsm-step2-locked.spec.js` | 81 | E2E | REAL | NSM step 2 locked state rendering | NSM Step 2 lock | line 3 `test.describe(...)` |
| `tests/visual/nsm-step4-drift-fix.spec.js` | 160 | E2E | REAL | NSM step 4 score drift fix | NSM Step 4 | line 5 `test.describe(...)` |
| `tests/visual/nsm-step4-restore-scores.spec.js` | 82 | E2E | REAL | NSM step 4 restore scores from session | NSM Step 4 restore | line 3 `test.describe(...)` |
| `tests/visual/nsm-compare-restore.spec.js` | 38 | E2E | REAL | NSM compare + restore comparison | NSM restore | line 3 `test.describe(...)` |
| `tests/visual/nsm-step2-hint-modal-close-paths.spec.js` | 68 | E2E | SEMI-HOLLOW | NSM step2 hint modal close (X / backdrop / Esc) | NSM Step 2 hint | line 5 `test.describe(...)` |
| `tests/visual/nsm-coach-overlay.spec.js` | 62 | E2E | REAL | NSM coach overlay display | NSM coach UI | line 3 `test.describe(...)` |
| `tests/visual/nsm-home-stats.spec.js` | 45 | E2E | SEMI-HOLLOW (stubs stats) | NSM home stats strip render | NSM Home stats | line 3 `test.describe(...)` |
| `tests/visual/nsm-restore-routing.spec.js` | 71 | E2E | REAL | NSM session restore routing (step → correct state) | NSM restore | line 3 `test.describe(...)` |
| `tests/visual/nsm-preflight-session.spec.js` | 73 | E2E | SEMI-HOLLOW | NSM preflight session creation | NSM Step 1 preflight | line 5 `test.describe(...)` |
| `tests/visual/nsm-tab-reset.spec.js` | 91 | E2E | SEMI-HOLLOW | NSM tab reset on question change | NSM Step 1 tab reset | line 5 `test.describe(...)` |
| `tests/visual/nsm-guide-vanity-rewrite.spec.js` | 39 | E2E | SEMI-HOLLOW | NSM guide step 3 vanity rewrite | NSM Step 3 guide | line 5 `test.describe(...)` |
| `tests/visual/nsm-sub-tabs-removed.spec.js` | 64 | E2E | SEMI-HOLLOW | NSM sub-tabs removed from step 3 | NSM Step 3 | line 5 `test.describe(...)` |
| `tests/visual/offcanvas-draft.spec.js` | 109 | E2E | SEMI-HOLLOW (stubs list) | Offcanvas draft session shown | Offcanvas | line 5 `test.describe(...)` |
| `tests/visual/offcanvas-delete-routing.spec.js` | 91 | E2E | SEMI-HOLLOW | Offcanvas delete + routing after delete | Offcanvas | line 5 `test.describe(...)` |
| `tests/visual/offcanvas-item-click-restore.spec.js` | 360 | E2E | SEMI-HOLLOW | Offcanvas click → session restore by type | Offcanvas restore | line 5 `test.describe(...)` |
| `tests/visual/preflight-session-creation.spec.js` | 193 | E2E | REAL (hits real /api/circles-sessions/draft) | Preflight draft session creation + persistence | CIRCLES Phase 1 preflight | line 5 `test.describe(...)` |
| `tests/visual/phase1-save-indicator.spec.js` | 98 | E2E | REAL | Phase 1 save indicator display on input | CIRCLES Phase 1 | line 3 `test.describe(...)` |
| `tests/visual/phase1-locked-stale.spec.js` | 160 | E2E | REAL | Phase 1 locked + stale states | CIRCLES Phase 1 | line 5 `test.describe(...)` |
| `tests/visual/phase1-hint-modal.spec.js` | 85 | E2E | REAL | Phase 1 hint modal open/close | CIRCLES Phase 1 hint | line 3 `test.describe(...)` |
| `tests/visual/phase1-e-step.spec.js` | 115 | E2E | REAL | Phase 1 E-step rendering | CIRCLES Phase 1 E | line 3 `test.describe(...)` |
| `tests/visual/phase1-l-step.spec.js` | 87 | E2E | REAL | Phase 1 L-step rendering | CIRCLES Phase 1 L | line 3 `test.describe(...)` |
| `tests/visual/phase1-s-step.spec.js` | 133 | E2E | REAL | Phase 1 S-step rendering | CIRCLES Phase 1 S | line 3 `test.describe(...)` |
| `tests/visual/phase1-qchip-expand.spec.js` | 101 | E2E | REAL | Phase 1 qchip expand | CIRCLES Phase 1 qchip | line 3 `test.describe(...)` |
| `tests/visual/phase1-example-expand.spec.js` | 82 | E2E | REAL | Phase 1 example expand | CIRCLES Phase 1 example | line 3 `test.describe(...)` |
| `tests/visual/home-stats-guest.spec.js` | 60 | E2E | SEMI-HOLLOW | Home stats shown for guest user | Home stats | line 3 `test.describe(...)` |
| `tests/visual/circles-qchip-stale-fix.spec.js` | 103 | E2E | REAL | CIRCLES qchip stale session fix | CIRCLES qchip | line 3 `test.describe(...)` |
| `tests/visual/draft-data-loss-fix.spec.js` | 168 | E2E | REAL | Draft data loss fix on navigation | CIRCLES draft | line 5 `test.describe(...)` |
| `tests/visual/drill-step-default-fix.spec.js` | 204 | E2E | REAL | Drill step default fix | CIRCLES step defaults | line 5 `test.describe(...)` |
| `tests/visual/min-length-frontend.spec.js` | 230 | E2E | REAL | Frontend min-length validation | CIRCLES Phase 1 validation | line 5 `test.describe(...)` |
| `tests/visual/sse-typewriter-perf.spec.js` | 308 | E2E | SEMI-HOLLOW (route.fulfill SSE stream) | SSE typewriter performance timing | CIRCLES Phase 2 SSE | line 5 `test.describe(...)` |
| `tests/visual/onboarding-position.spec.js` | 127 | E2E | REAL | Onboarding coachmark position | Onboarding | line 3 `test.describe(...)` |
| `tests/visual/nsm-step-4-qchip.spec.js` | 98 | E2E | REAL | NSM step 4 qchip | NSM Step 4 qchip | line 3 `test.describe(...)` |
| `tests/visual/regression-r5-nsm-step3-fullmatrix.spec.js` | 186 | E2E | REAL | NSM step 3 full state matrix regression | NSM Step 3 | line 5 `test.describe(...)` |
| `tests/visual/nsm-submit-reactive.spec.js` | 179 | E2E | REAL | NSM submit button reactive to form fill | NSM Step 2 submit | line 5 `test.describe(...)` |

### J. Visual Specs — Screenshot-only (capture / audit / prod-pointing)

These do not assert structure; they capture PNG for human review. Classified as SCREENSHOT-ONLY — no integration claim.

| File | LOC | Trophy Tier | Real-vs-Hollow | Tests what | Product surface | Entry-point |
|---|---|---|---|---|---|---|
| `tests/visual/capture-mockup-04-pngs.spec.js` | ~50 | Screenshot | SCREENSHOT-ONLY | Capture Phase 1.5 gate mockup PNGs | CIRCLES Phase 1.5 Gate | line 5 `test(...)` |
| `tests/visual/capture-mockup-05-pngs.spec.js` | 58 | Screenshot | SCREENSHOT-ONLY | Capture Phase 2 mockup PNGs | CIRCLES Phase 2 | line 5 |
| `tests/visual/capture-mockup-07-pngs.spec.js` | ~50 | Screenshot | SCREENSHOT-ONLY | Capture NSM step 2-3 mockup PNGs | NSM Steps 2-3 | line 5 |
| `tests/visual/capture-mockup-08-pngs.spec.js` | 135 | Screenshot | SCREENSHOT-ONLY | Capture NSM gate mockup PNGs | NSM Step 3 Gate | line 5 |
| `tests/visual/capture-mockup-10-pngs.spec.js` | ~50 | Screenshot | SCREENSHOT-ONLY | Capture onboarding mockup PNGs | Onboarding | line 5 |
| `tests/visual/capture-mockup-11-pngs.spec.js` | 53 | Screenshot | SCREENSHOT-ONLY | Capture Phase 3 score PNGs | CIRCLES Phase 3 | line 5 |
| `tests/visual/capture-mockup-12-pngs.spec.js` | 52 | Screenshot | SCREENSHOT-ONLY | Capture Phase 3 error PNGs | CIRCLES Phase 3 error | line 5 |
| `tests/visual/capture-mockup-13-pngs.spec.js` | 52 | Screenshot | SCREENSHOT-ONLY | Capture Phase 4 final PNGs | CIRCLES Phase 4 | line 5 |
| `tests/visual/capture-mockup-16-resume-pngs.spec.js` | 81 | Screenshot | SCREENSHOT-ONLY | Capture cross-tab resume PNGs | §D cross-tab | line 5 |
| `tests/visual/capture-mockup-05-amend-af.spec.js` | 49 | Screenshot | SCREENSHOT-ONLY | Capture amended Phase 2 §A/§F PNGs | CIRCLES Phase 2 | line 3 |
| `tests/visual/capture-mockup-coach-overlay.spec.js` | 35 | Screenshot | SCREENSHOT-ONLY | Capture coach overlay PNGs | CIRCLES coach overlay | line 3 |
| `tests/visual/capture-mockup-step2-locked.spec.js` | 32 | Screenshot | SCREENSHOT-ONLY | Capture NSM step 2 locked PNGs | NSM Step 2 | line 3 |
| `tests/visual/capture-nsm-step-4-pngs.spec.js` | 124 | Screenshot | SCREENSHOT-ONLY | Capture NSM step 4 PNGs | NSM Step 4 | line 5 |
| `tests/visual/capture-prod-mockup-01-pngs.spec.js` | 208 | Screenshot | SCREENSHOT-ONLY (prod or localhost) | Capture CIRCLES Home production PNGs | CIRCLES Home | line 5 |
| `tests/visual/capture-prod-mockup-03-pngs.spec.js` | 248 | Screenshot | SCREENSHOT-ONLY | Capture Phase 1 form production PNGs | CIRCLES Phase 1 | line 5 |
| `tests/visual/capture-prod-mockup-06-pngs.spec.js` | 231 | Screenshot | SCREENSHOT-ONLY | Capture NSM Step 1 production PNGs | NSM Step 1 | line 5 |
| `tests/visual/capture-prod-mockup-09-pngs.spec.js` | 289 | Screenshot | SCREENSHOT-ONLY | Capture Offcanvas production PNGs | Offcanvas | line 5 |
| `tests/visual/capture-prod-mockup-12-pngs.spec.js` | 94 | Screenshot | SCREENSHOT-ONLY | Capture Phase 3 error production PNGs | CIRCLES Phase 3 error | line 5 |
| `tests/visual/capture-prod-phase2-pngs.spec.js` | 211 | Screenshot | SCREENSHOT-ONLY | Capture Phase 2 production PNGs | CIRCLES Phase 2 | line 5 |
| `tests/visual/capture-prod-phase3-pngs.spec.js` | 123 | Screenshot | SCREENSHOT-ONLY | Capture Phase 3 production PNGs | CIRCLES Phase 3 | line 5 |
| `tests/visual/capture-prod-phase4-pngs.spec.js` | 152 | Screenshot | SCREENSHOT-ONLY | Capture Phase 4 production PNGs | CIRCLES Phase 4 | line 5 |
| `tests/visual/capture-phase1-pngs.spec.js` | ~80 | Screenshot | SCREENSHOT-ONLY | Capture Phase 1 localhost PNGs | CIRCLES Phase 1 | line 3 |
| `tests/visual/capture-phase2-pngs.spec.js` | ~80 | Screenshot | SCREENSHOT-ONLY | Capture Phase 2 localhost PNGs | CIRCLES Phase 2 | line 3 |
| `tests/visual/capture-p0-drill-fix-pngs.spec.js` | 102 | Screenshot | SCREENSHOT-ONLY | Capture P0 drill fix PNGs | CIRCLES drill | line 3 |
| `tests/visual/capture-p1-preflight-pngs.spec.js` | 56 | Screenshot | SCREENSHOT-ONLY | Capture P1 preflight PNGs | CIRCLES preflight | line 3 |
| `tests/visual/capture-step4-drift-audit.spec.js` | 76 | Screenshot | SCREENSHOT-ONLY | Capture step 4 drift audit PNGs | NSM Step 4 drift | line 3 |
| `tests/visual/capture-regression-step3-hint-row.spec.js` | 66 | Screenshot | SCREENSHOT-ONLY | Capture step 3 hint row regression PNGs | NSM Step 3 hint | line 3 |
| `tests/visual/capture-step2-locked-prod.spec.js` | 59 | Screenshot | SCREENSHOT-ONLY | Capture step 2 locked production PNGs | NSM Step 2 lock | line 3 |
| `tests/visual/capture-bug-F-current.spec.js` | 61 | Screenshot | SCREENSHOT-ONLY | Capture bug F current state PNGs | Bug F | line 3 |
| `tests/visual/capture-bug234-fix.spec.js` | 92 | Screenshot | SCREENSHOT-ONLY | Capture bug 2/3/4 fix PNGs | Bug 2-4 | line 3 |
| `tests/visual/capture-button-navy-unify.spec.js` | 23 | Screenshot | SCREENSHOT-ONLY | Capture button navy unify PNGs | Button design | line 3 |
| `tests/visual/capture-coach-overlay-prod.spec.js` | 55 | Screenshot | SCREENSHOT-ONLY | Capture coach overlay production PNGs | Coach overlay | line 3 |
| `tests/visual/capture-issue4-phase1-r-after.spec.js` | 68 | Screenshot | SCREENSHOT-ONLY | Capture phase1 R-step after-fix PNGs | CIRCLES Phase 1 R | line 3 |
| `tests/visual/capture-uat-bug-A-D.spec.js` | 156 | Screenshot | SCREENSHOT-ONLY | Capture UAT bug A-D PNGs | UAT bugs A-D | line 3 |
| `tests/visual/audit-nsm-bug1-hint-longwait.spec.js` | 86 | Screenshot | SCREENSHOT-ONLY | NSM bug 1 hint long-wait audit PNGs | NSM hint | line 3 |
| `tests/visual/audit-nsm-bug1-vintageB-hint.spec.js` | 135 | Screenshot | SCREENSHOT-ONLY | NSM bug 1 vintage B hint audit PNGs | NSM hint restore | line 3 |
| `tests/visual/audit-nsm-comprehensive-2026-05-11.spec.js` | 183 | Screenshot | SCREENSHOT-ONLY | NSM comprehensive audit PNGs | NSM all steps | line 3 |
| `tests/visual/audit-nsm-restore-vintages-2026-05-11.spec.js` | 227 | Screenshot | SCREENSHOT-ONLY | NSM restore vintages audit PNGs | NSM restore | line 3 |

### K. Playwright Journey Specs (tests/playwright/journeys/)

47 journey specs + 19 audit sub-specs. These hit real localhost with real navigation; no own-API mocking detected except `circles-stats-strip.spec.js`.

| File | LOC | Trophy Tier | Real-vs-Hollow | Tests what | Product surface | Entry-point |
|---|---|---|---|---|---|---|
| `tests/playwright/circles.spec.js` | 242 | E2E | REAL | CIRCLES home → question list → phase 1 happy path | CIRCLES end-to-end | line 3 `test.describe(...)` |
| `tests/playwright/journeys/auth.spec.js` | 81 | E2E | REAL | Login form visible, no overflow | Auth | line 3 `test.describe(...)` |
| `tests/playwright/journeys/nsm.spec.js` | 91 | E2E | REAL | CIRCLES home → NSM → question list → select → step 2 | NSM Step 1-2 | line 3 `test.describe(...)` |
| `tests/playwright/journeys/circles-home.spec.js` | 113 | E2E | REAL | App loads, CIRCLES default, mode cards | CIRCLES Home | line 3 `test.describe(...)` |
| `tests/playwright/journeys/circles-phase1.spec.js` | 113 | E2E | REAL | Select question → Phase 1 → submit → gate | CIRCLES Phase 1-1.5 | line 3 `test.describe(...)` |
| `tests/playwright/journeys/circles-simulation.spec.js` | 188 | E2E | REAL | Simulation mode flow | CIRCLES simulation | line 3 `test.describe(...)` |
| `tests/playwright/journeys/history.spec.js` | 58 | E2E | REAL | Offcanvas history open + items | Offcanvas | line 3 `test.describe(...)` |
| `tests/playwright/journeys/onboarding-tour.spec.js` | 131 | E2E | REAL | Onboarding coachmark tour steps | Onboarding | line 3 `test.describe(...)` |
| `tests/playwright/journeys/circles-stats-strip.spec.js` | ~60 | E2E | SEMI-HOLLOW (route.fulfill stats) | Stats strip render | CIRCLES stats | line 3 `test.describe(...)` |
| `tests/playwright/journeys/audit/audit-master.spec.js` | 1237 | E2E | REAL | Full audit P0/P1 issue matrix (failing baseline) | All surfaces | line 5 `test.describe('audit master')` |
| `tests/playwright/journeys/audit/rwd-visual-gate.spec.js` | 189 | E2E | REAL | RWD full-page screenshot × 8 vp × routes (ship blocker) | All surfaces | line 7 `test.describe('RWD visual gate')` |
| `tests/playwright/journeys/audit/*.spec.js` (17 others) | varies | E2E | REAL | Coverage clusters A3/A6/C7/D1-D5 + master-001 thru master-025 | Auth/CIRCLES/NSM/Phase 3/4 | varies |

---

## Counts

| Category | Count |
|---|---|
| Total spec/test files (main repo, excl. quarantine, excl. worktrees) | ~210 |
| Already inventoried in prior audit (2026-05-16) | 23 |
| New files catalogued this report | ~187 |
| **Trophy — API/Integration (real Playwright request or supertest real express)** | ~18 |
| **Trophy — E2E (Playwright browser, real or semi-hollow)** | ~95 |
| **Trophy — Visual/Screenshot (pixel-diff or screenshot-only)** | ~55 |
| **Trophy — Unit (pure logic)** | ~35 |
| **Trophy — Adversarial (real OpenAI)** | 8 |
| Real integration (no own-API mock at all) | ~30 |
| Semi-hollow (stubs stats/session lists but real UI assertions) | ~65 |
| Hollow (vm.createContext or jest.mock('../db/client') masking own infra) | ~18 |
| Screenshot-only (no integration claim) | ~38 |
| Quarantined (_quarantine_prod_legacy/) | 20 |

---

## Surface Coverage Gap

| Surface | Files covering it |
|---|---|
| CIRCLES Home | circles-home.spec.js, circles-home (journey), desktop-circles-home, audit-master, rwd-visual-gate, circles.spec.js, capture-prod-mockup-01 |
| CIRCLES Phase 1 form | phase1-form.spec.js, circles-phase1 (journey), desktop-phase1, 9× phase1-* visual specs, lifecycle-circles.spec.js |
| CIRCLES Phase 1.5 Gate | circles-gate.spec.js (visual + e2e), capture-mockup-04-pngs, circles-gate-contract.spec.js (API), adversarial/circles-gate |
| CIRCLES Phase 2 | phase2-chat.spec.js, phase2-qchip, phase2-typewriter, capture-prod-phase2, desktop-phase2, conversation-persistence-roundtrip, sse-typewriter-perf |
| CIRCLES Phase 3 score | phase3-score.spec.js, capture-prod-phase3, desktop-phase3 |
| CIRCLES Phase 4 final | phase4-final.spec.js, capture-prod-phase4 |
| NSM Step 1 | nsm-home.spec.js, nsm.spec.js (journey), desktop-nsm-step1-3, nsm-search-focus-clear, nsm-card-inplace-expand, nsm-tab-reset, nsm-preflight-session, capture-prod-mockup-06, audit batch-01 |
| NSM Steps 2-3 | nsm-step-2-3.spec.js, nsm-lock-state, nsm-step2-locked, nsm-step2-hint-modal-close-paths, nsm-submit-reactive, nsm-guide-vanity-rewrite, nsm-sub-tabs-removed, nsm-gate-inline, regression-r5-nsm-step3-fullmatrix, adversarial/nsm-gate |
| NSM Step 4 | nsm-step-4.spec.js, nsm-step-4-qchip, nsm-step4-drift-fix, nsm-step4-restore-scores, desktop-nsm-step4, capture-nsm-step-4, capture-prod-mockup… (none for mockup 14 production capture) |
| Auth (login/logout/guest) | auth-flow.spec.js, auth.spec.js (journey), desktop-review-login, coverage-a3-login, coverage-a6-401 |
| Offcanvas history | offcanvas.spec.js, offcanvas-draft, offcanvas-delete-routing, offcanvas-item-click-restore, history (journey), offcanvas-delete (e2e), capture-prod-mockup-09 |
| Onboarding | onboarding.spec.js, onboarding-position, onboarding-tour (journey), capture-mockup-10 |
| Lifecycle state machine | lifecycle-circles.spec.js (API), lifecycle-nsm.spec.js (API), lifecycle-list.spec.js (API), session-lifecycle.test.js (unit), backfill-lifecycle.test.js (unit), 2026-05-17-session-lifecycle.test.js (migration text), contracts/lifecycle-* (hollow — schedule for deletion) |

**Coverage gaps:**
- No real E2E test for complete CIRCLES Phase 1→2→3→4 happy path in a single spec (lifecycle-circles.spec.js tests API only; no browser flow)
- NSM Step 3 gate has adversarial + inline visual spec but no real API contract test (NSM gate AI response verified only in adversarial, not in a chained API test)
- Guest migration route tested only with fully mocked DB (`migrate-guest.unit.test.js`)
- Onboarding has no API-layer test (no server component — client-only, acceptable)

---

## Anti-pattern Flags (Pitfall 11 / 14 / 18 violations)

| File | Line | Flag |
|---|---|---|
| `tests/sp1.5-bugfix-action-bar.test.js` | 8 | Pitfall 11 — `vm.createContext` extracts from app.js; mocks own frontend client |
| `tests/sp1.5-bugfix-helpers.test.js` | 8 | Pitfall 11 — `vm.createContext` |
| `tests/sp1.5-helpers.test.js` | 8 | Pitfall 11 — `vm.createContext` |
| `tests/sp1.5-locked-banner.test.js` | 8 | Pitfall 11 — `vm.createContext` |
| `tests/nsm-render-bug-fixes.test.js` | 12 | Pitfall 11 — `vm.createContext` function-string extraction |
| `tests/sp4-nsm-context-prefer-pregenerated.test.js` | 8 | Pitfall 11 — `vm.createContext`; function no longer exists (`PENDING_PATH_2_REIMPL` marker) — test is permanently dead |
| `tests/circles-sessions.test.js` | 5 | Pitfall 11 — `jest.mock('../db/client')` mocks own Supabase; real express but fake DB |
| `tests/circles-sessions-draft.test.js` | 4 | Pitfall 11 — `jest.mock('../db/client')` |
| `tests/bug6b-persistence.test.js` | 19 | Pitfall 11 — inline `jest.mock('../db/client')` chain mock (1498 LOC, very large) |
| `tests/migrate-guest.unit.test.js` | 4 | Pitfall 11 — `jest.mock` auth + guest middleware + db/client |
| `tests/circles-coach.test.js` | 3 | Pitfall 11 — `jest.mock('openai')` entire SDK |
| `tests/circles-evaluator.test.js` | 3 | Pitfall 11 — `jest.mock('openai')` entire SDK |
| `tests/e2e/phase2-ui-fix.spec.js` | ~80 | Pitfall 14 — `'normal-test-session-synthetic'` sentinel string |
| `tests/visual/circles-home.spec.js` | 12 | Partial Pitfall 11 — `route.fulfill` on `/api/circles-stats` + `/api/circles-sessions` stubs own API |
| `tests/visual/phase2-chat.spec.js` | 9 | Partial Pitfall 11 — stubs own sessions/stats APIs (only SSE route.fulfill is acceptable per when-to-mock §660) |

---

## Caveats

- `tests/playwright/journeys/audit/*.spec.js` (17 files beyond audit-master + rwd-visual-gate): individually small (50-200 LOC each), all REAL Playwright journeys. Not individually tabled to avoid table bloat; same pattern as audit-master.
- `tests/playwright/journeys/*.spec.js` (remaining ~38 beyond those tabled): same REAL pattern; cover desktop/mobile layout audits, rich-text toolbar, theme, container widths, guest flow, debug probes. Classified as E2E REAL.
- `tests/visual/capture-prod-*` specs may point at production URL depending on `BASE_URL` env var; when run without override they default to localhost. Treat as SCREENSHOT-ONLY either way.
- `tests/sp4-nsm-context-prefer-pregenerated.test.js` contains a `PENDING_PATH_2_REIMPL` marker indicating the tested function (`getNsmContextSource`) was removed during the Path 2 rewrite. The test silently skips (function not found → `it.skip` fallback). This is a dead test; should be deleted or rewritten.
- Files I could not confirm entry-point line exactly (capture-mockup-04/07/10-pngs which are untracked per git status): confirmed file structure via directory listing, LOC estimated from similar capture specs.
