# Wave 1 C1-C6 — 6 atomic commit message drafts (revised 2026-05-19)

> **Status**: DRAFT — placeholders for serial verifier 5x consecutive numbers (see `[PLACEHOLDER: …]` markers below).
> **Date**: 2026-05-19
> **Source**: `audit/wave-1補洞+phase1-cheat-sheet-v4.md` §A/§B + tracker §2-§5 + per-finding audit docs.
> **Karpathy guidelines (prepend each commit work)**: §4.1 Think Before · §4.2 Simplicity First · §4.3 Surgical Changes · §4.4 Goal-Driven.
> **Skill citation headers (mandatory per RITUAL §3.19)**: each commit must include its applicable Pitfall / Section reference from playwright-skill + STANDING memory cross-ref.

---

## 2026-05-19 User Decisions

- **Decision 1 = A**: Phase A prep（4 c-drift user provision + auth.setup +98 lines）**獨立 C6 commit**，不折入 C5
- **Decision 2 = B**: C4 等 B13 prompt fix implementer (slot 2 `ab8bfc8d`) 完工 → **C4 一次 ship spec + prompt fix（RED→GREEN atomic）**，不分 C7
- **Decision 3 = N/A**（因 Decision 2 = B，不需 known-red footer）
- **Decision 4**: mockup 06+07 親眼放行（等 user 看 `audit/mockup-06-prep/section-d-3vp-wide.png` + `audit/mockup-07-prep/section-g-3vp-wide.png` 後決定）

**Commit 順序 (C1→C6)**:
1. C1 — F-CT2.1 q3 卡片 silent session noise fix
2. C2 — B6 mockup 04 11 drift fix（含 `known-skip: AC-3 (O-13 backlog)` footer）
3. C3 — F-CT1.3 CIRCLES gate prompt backoff
4. **C4 (revised)** — B13 adversarial 3 spec + prompt schema 方案 A 門檻 60（RED→GREEN atomic — 等 implementer `ab8bfc8d` 回 + reviewer pass）
5. **C5 (revised)** — W1-補.7 NSM i18n + offcanvas WebKit + NEW-Test-Debt（**c-drift user 移到 C6**）
6. **C6 (NEW)** — Wave 2 Phase A infrastructure: `scripts/register-c-drift-test-accounts.js` + `tests/setup/auth.setup.js` +98 lines（`C_DRIFT_LANES` array + 4 storageState path）

下面 5 個 draft 是 original C1-C5 版本（C4/C5 需依 user decisions 重整 — 用 Director judgment 在 ship 時 inline 修）。Director ship 時依 above 6-commit 順序 + decision context 動筆。

---

## C1 — F-CT2.1 q3 卡片 silent session noise fix

**Scope**: `public/app.js` 1 hunk (line 6394 region) + new e2e spec + 30 evidence PNG + finding doc.

**Tracker finding**: `audit/e2e-master-tracker.md` §3 F-CT2.1 (P1) — 5,487 個 q3/Slack 題「點卡片即建 session」噪音；S1→S2 drop 99.7%；lifecycle='created' 99.9% 偏差掩蓋真實 conversion。

**Audit doc**: `audit/補修-fct2.1-findings.md`

**Files in commit**:
- `public/app.js` (1 hunk @ ~line 6394 — remove `ensureNsmDraftSession().catch(...)` on question card click; lazy-create moved to Step 2 first PATCH)
- `tests/e2e/nsm-step1-card-click-no-session.spec.js` (NEW — windowed DB invariant via `testStartTimestamp` + per-project `actualQid` from `AppState.nsmSelectedQuestion.id`)
- `audit/F-CT2.1-evidence/` (NEW — 30 PNG × 3 vp, 10 steps each: boot → step1 → card-click → no-session → step2 entered → session created → fields filled → submit → reload persists)
- `audit/補修-fct2.1-findings.md` (NEW)

```
fix(fe): F-CT2.1 — q3 卡片不再 silent 建 session noise

白話：以前點 NSM 第一頁的問題卡片就會偷偷在 DB 建一筆空殼 session，
結果 q3/Slack 那種卡片累積了 5,487 筆完全空白的 session，把「99.9%
用戶沒完成 NSM」這個指標完全污染掉。

Fix: public/app.js 1 hunk (line 6394 region) — remove eager
`ensureNsmDraftSession().catch(() => {})` on `nsmCardClick`. Session now
lazy-creates at Step 2 first PATCH (bindNSMStep2And3 preflight @ line
1777-1783) + Step 2 submit fallback @ line 1944 + hints @ line 4418.
triggerNsmSaveCycle already guards `if (sessionId)` so no leak path.

Evidence:
- tracker §3 F-CT2.1 (P1, 5,487 polluted rows)
- audit/補修-fct2.1-findings.md (3-change summary + per-project actualQid)
- tests/e2e/nsm-step1-card-click-no-session.spec.js (NEW)
  - testStartTimestamp + actualQid window prevents noise pollution
  - Step D: expect.poll count toBe(0) post card-click
  - Step I: expect.poll count toBe(1) post Step 2 submit (exact, not >=)
  - imports auto-cleanup.fixture (mandatory per Pitfall 14)
- audit/F-CT2.1-evidence/ 30 PNG (3 vp × 10 steps)
- Serial verifier 5x consecutive: [PLACEHOLDER: X/5 GREEN — fill from verifier]
- jest baseline: [PLACEHOLDER: N/M, 0 new fail]

Skills cited: playwright-skill Pitfall 14 (auto-cleanup mandatory),
Pitfall 11 (no mock own backend success path), §3.18 5x consecutive
0 flake; STANDING `feedback_e2e_real_data_only`.

Karpathy: §4.3 Surgical Changes (1-hunk delete, no helper rewrite).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
```

---

## C2 — B6 mockup 04 11-drift fix (D-1~D-11) + cross-spec drift sync

**Scope**: `renderCirclesGate` family (5136-5240) + style.css `.gate-item__suggestion-body` rule + new Layer (a) visual spec with 44 mockup-sourced baselines + new Layer (b) full-flow e2e + 1 cross-spec drift sync (`circles-gate.spec.js` 4→5 step). **Bug B padding is NOT in this commit — already shipped `b0c7a55`** (per `git log --oneline`). Drop "Bug B padding" from prompt; this commit ships only the 11 B6 drift fixes.

**Tracker findings**: `audit/e2e-master-tracker.md` §3 B6 D-1~D-11 (P1 visual contract; mockup 04 §A/§B/§C/§D) — D-4 already partially shipped `1b75c0f`; this commit closes the remaining 10 drift + re-applies D-4 baseline alongside.

**Audit docs**: `audit/wave1-task-5-findings.md` + `audit/補修-b6-findings.md` + `audit/B6-mockup04-audit/` (12 mockup baseline PNG)

**Known-fail registry**: `audit/known-fail-registry.md` (NEW — entry: `circles-gate-warn-icon-color.spec.js` AC-3 deferred per O-13 architectural debt; D-11 qchip icon `ph-info`→`ph-bookmark-simple` makes prod-self-referenced baseline stale).

**Files in commit**:
- `public/app.js` (renderCirclesGate / renderGateResult / renderGateItem / renderGateLoading — D-1/2/3/5/6/7/8/9/10/11 hunks, all in 5136-5240 region; D-4 already at line 5146 from `1b75c0f`)
- `public/style.css` (line 1313 — `.gate-item__suggestion-body { flex:1; min-width:0; color: var(--c-ink-2); }` mirror mockup 04 line 347)
- `tests/visual/wave1-b6-mockup04-drift-fix.spec.js` (NEW — Layer a DOM + getComputedStyle 3-measure + 75 tests)
- `tests/visual/wave1-b6-mockup04-drift-fix.spec.js-snapshots/` (NEW — 44 PNG: 12 cross-platform + 32 darwin-tagged)
- `tests/e2e/wave1-b6-circles-phase1-to-gate-real-flow.spec.js` (NEW — Layer b real OpenAI gate; 3 test × 3 vp)
- `tests/visual/circles-gate.spec.js` (line 88 + 105 — 4-step → 5-step checklist assertion; cross-spec drift caught by reviewer)
- `scripts/capture-mockup-04-baselines.js` (NEW — Director-only mockup-sourced baseline capture)
- `audit/known-fail-registry.md` (NEW)
- `audit/wave1-task-5-findings.md` (NEW)
- `audit/補修-b6-findings.md` (NEW)
- `audit/B6-mockup04-audit/` (12 mockup PNG reference)

```
fix(fe+visual): B6 mockup 04 11-drift fix + mockup-sourced baseline

白話：Phase 1.5 Gate 畫面跟 mockup 04 有 11 處小偏差（按鈕文字、loading
步驟數、qchip icon、warn 建議標籤顏色、desktop 計時器…）。本 commit
一次補齊；測試基準改用 mockup HTML 直接 render，不再從 production 自截。

Fix scope: public/app.js 線 5136-5240 (renderCirclesGate + helpers)
+ public/style.css line 1313 (.gate-item__suggestion-body rule align
mockup 04 line 347).

11 drifts closed:
- D-1: ok sub-copy 「四個欄位都對齊到 X 步核心定義，沒有需要修正」
- D-2: warn title「通過附提醒」+ sub「N 處可優化，繼續 Phase 2 不會卡」
- D-3: error title「需要修正方向」+ sub「N 個欄位偏離 X 步核心」
- D-4: warn icon ph-warning → ph-check-circle (already shipped 1b75c0f)
- D-5: section count format per state (ok: N/N 通過; warn: N 通過 · N 提醒)
- D-6: warn 建議 label「建議」(warm orange), error「修正」
- D-7: loading title「AI 正在審核你的框架」+「通常需要 8-15 秒」
- D-8: loading 5-step checklist (was 4)
- D-9: loading phase-head meta tablet/desktop visibility
- D-10: result phase-head meta tablet/desktop timer + field summary
- D-11: qchip icon ph-info → ph-bookmark-simple + responsive 公司/產品/mode

Test layers:
- Layer (a) DOM + getComputedStyle 3-measure: 75 tests × 3 vp via
  tests/visual/wave1-b6-mockup04-drift-fix.spec.js + 44 mockup-sourced
  baseline PNG (via scripts/capture-mockup-04-baselines.js — NOT
  production self-referenced; per STANDING `feedback_visual_baseline_
  from_mockup_not_production`)
- Layer (b) real OpenAI gate: 3 test × 3 vp via tests/e2e/wave1-b6-
  circles-phase1-to-gate-real-flow.spec.js (drainSessions + page.evaluate
  apiFetch auth pattern)

Cross-spec drift fix:
- tests/visual/circles-gate.spec.js line 88 + 105: 4 → 5 step checklist
  assertion (caught by spec-reviewer; D-8 prod change would have broken
  this spec)

known-skip: AC-3 (O-13 backlog)
- tests/visual/circles-gate-warn-icon-color.spec.js AC-3 toHaveScreenshot
  baseline self-referenced (captured pre-D-11 ph-info icon); ship deferred
  to O-13 mockup-source baseline rebuild
- audit/known-fail-registry.md entry tracks deadline (Phase 2)

Evidence:
- tracker §3 B6 D-1~D-11 (P1 visual contract)
- audit/wave1-task-5-findings.md (per-drift status table)
- audit/補修-b6-findings.md (reviewer-caught Critical補修 × 3)
- audit/B6-mockup04-audit/ 12 mockup reference PNG
- Layer (a) 5x consecutive: 120/151/122/167/232 passed × 5 runs = 792/0
- Layer (b) full-flow 1 run (real OpenAI budget): 4/4 PASS desktop
- Serial verifier 5x consecutive: [PLACEHOLDER: X/5 GREEN]
- jest baseline: [PLACEHOLDER: N/M, 0 new fail]

Skills cited: playwright-skill §3.11 cross-vp, §3.5 test.step, Pitfall 11
(error injection carve-out), Pitfall 14 (drainSessions auth pattern);
STANDING `feedback_locked_components_reuse`, `feedback_visual_baseline_
from_mockup_not_production`, `feedback_mockup_strict_compliance`.

Karpathy: §4.3 Surgical Changes (all hunks contained in 5136-5240).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
```

---

## C3 — F-CT1.3 CIRCLES gate retry progressive backoff

**Scope**: 1-line backoff in `prompts/circles-gate.js` catch block + 1 jest unit + 1 e2e regression smoke.

**Tracker finding**: `audit/e2e-master-tracker.md` §3 F-CT1.3 (P2) — `circles-gate.js:104-121` retry 無 backoff；429 rate-limit 等於連打三次無防護（vs nsm-gate.js 已有 800ms/1600ms 漸進）。

**Audit doc**: `audit/wave1-task-3-findings.md` + `audit/補洞-fct1.3-e2e-findings.md`

**Files in commit**:
- `prompts/circles-gate.js` (line 119-120 — `await new Promise(r => setTimeout(r, 800 * (attempt + 1)));`)
- `tests/circles-gate-backoff.test.js` (NEW — jest unit, 3 tests: backoff timing / fast-path / 3-failure-throw; uses jest.mock OpenAI, no module-level state)
- `tests/e2e/wave1-fct1.3-circles-gate-backoff-real-flow.spec.js` (NEW — RITUAL §1 full chain regression guard: backoff patch doesn't break gate success path; 1 test × 3 vp)
- `audit/wave1-task-3-findings.md` (NEW)
- `audit/補洞-fct1.3-e2e-findings.md` (NEW — explains 429 simulation architecture: backoff is server-to-OpenAI, page.route only intercepts browser-to-server, so e2e leg pivots to success-path regression guard)

```
fix(prompt): F-CT1.3 — CIRCLES gate retry 加 progressive backoff

白話：CIRCLES Phase 1.5 gate prompt 的 retry 之前 0 延遲，遇到 OpenAI
429 rate-limit 等於 3 次連續打三次（毫秒級），retry 沒實際效果。對齊
NSM gate 已有的 800ms/1600ms 漸進 backoff。

Fix: prompts/circles-gate.js line 119 — 1 line add
`await new Promise(r => setTimeout(r, 800 * (attempt + 1)));`
mirror nsm-gate.js:166 pattern verbatim.

Test layers:
- jest unit tests/circles-gate-backoff.test.js (NEW)
  - retry attempts have progressive backoff delay (800ms × attempt)
  - no backoff on first attempt success
  - throws after 3 consecutive failures (no infinite retry)
- e2e regression smoke tests/e2e/wave1-fct1.3-circles-gate-backoff-
  real-flow.spec.js (NEW) — full chain: submit → real gate → DB
  persist → reload verify; 1 test × 3 vp

Architecture note (per audit/補洞-fct1.3-e2e-findings.md):
backoff retry loop is server-to-OpenAI; Playwright page.route only
intercepts browser-to-server. e2e leg therefore designed as
RITUAL §1 full chain regression guard, NOT 429 simulation. jest
unit covers the 800ms backoff math directly.

Evidence:
- tracker §3 F-CT1.3 (P2)
- audit/wave1-task-3-findings.md
- audit/補洞-fct1.3-e2e-findings.md
- jest 5x consecutive: 15/15 GREEN × 5 runs = 0 flake
- adversarial no-regression: tests/adversarial/circles-hint.test.js
  10/10 PASS
- Serial verifier 5x consecutive (e2e leg): [PLACEHOLDER: X/5 GREEN]
- jest baseline: [PLACEHOLDER: N/M, 0 new fail]

Skills cited: playwright-skill Pitfall 14 (test-local timing counter,
no module-level state), §3.9 api-testing (jest.mock OpenAI),
§3.18 5x consecutive.

Karpathy: §4.3 Surgical Changes (+1 line, mirror existing nsm-gate.js
pattern exactly — no new helper, no new abstraction).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
```

---

## C4 — B13 adversarial expansion + NEW-B13-W1 finding

**Scope**: 3 new adversarial jest specs covering circles prompts that lacked low-quality / meaningless input robustness coverage + new B13 finding tracker entry.

**Tracker finding**: `audit/e2e-master-tracker.md` §3 NEW-B13-W1 (P1, caught 2026-05-18 PM during Wave 1 #1 B13 adversarial sweep) — `circles-final-report.js` mixed-input hallucination + 2 sibling prompts (`circles-conclusion-check`, `circles-coach-version`) missing adversarial coverage.

**Audit doc**: `audit/B13-NEW-B13-W1-prompt-fix-scope-brainstorm.md` (find-only mapping table per STANDING `feedback_find_first_fix_later_via_tracker` — NO prompt code change; only test additions to expose the gap).

**Files in commit**:
- `tests/adversarial/circles-conclusion-check-adversarial.test.js` (NEW — 10 variants × 5 stages garbage/thin/meaningless/all-Y/all-N input → assert max totalScore < 60 + no hallucinated next-step)
- `tests/adversarial/circles-final-report-adversarial.test.js` (NEW — mixed-input hallucination guard; high score on filler vs real C1 evidence)
- `tests/adversarial/circles-coach-version-adversarial.test.js` (NEW — Sonnet/Opus parity sanity on adversarial input; ensures coach version selector doesn't drift)
- `audit/B13-NEW-B13-W1-prompt-fix-scope-brainstorm.md` (NEW)

```
test(adversarial): B13 expand — 3 prompts × 10-variant adversarial coverage

白話：B13 sweep 發現 circles-final-report prompt 對「混合輸入」會出現
幻覺（半空白半真的回答時 AI 自編下一步），但對應 adversarial 測試沒寫；
sibling prompts (conclusion-check / coach-version) 也漏。本 commit 補齊
三個 adversarial spec，但 **不改 prompt 本身**（per find-first STANDING；
prompt fix 進 Phase 2 backlog）。

New adversarial specs (3 file × ~10 variant × 5 stage):
- tests/adversarial/circles-conclusion-check-adversarial.test.js
  - garbage / thin / meaningless / all-Y / all-N inputs
  - assert max totalScore < 60
  - assert no fabricated next-step proposal
- tests/adversarial/circles-final-report-adversarial.test.js
  - mixed-input hallucination guard (real C1 + filler 後欄位)
  - score gradient assertions (filler must rank lower)
- tests/adversarial/circles-coach-version-adversarial.test.js
  - Sonnet / Opus coach version selector parity sanity

These are RED-only for the hallucination case (will fail today on
final-report). Director RED log captured in audit doc. Prompt fix
deferred to Phase 2 per STANDING `feedback_find_first_fix_later_via_
tracker` — this commit only exposes the gap.

Evidence:
- tracker §3 NEW-B13-W1 (P1, caught 2026-05-18 PM)
- audit/B13-NEW-B13-W1-prompt-fix-scope-brainstorm.md (find-only
  mapping table; no prompt code proposed)
- 4-pillar preventive sweep status (CLAUDE.md tests/quality gates):
  L2 CIRCLES gate ✓ / L9 NSM gate ✓ / L12 CIRCLES evaluator ✓ /
  L15 NSM evaluator ✓ — this commit adds L16-L18 placeholder slots
  for conclusion-check / final-report / coach-version
- Serial verifier (adversarial subset) 5x consecutive: [PLACEHOLDER:
  X/5 GREEN — note final-report mixed-input case is RED-expected per
  audit doc; commit ships as documented finding, not fix]
- jest baseline: [PLACEHOLDER: N/M; expected +K new fail = documented
  RED for B13-NEW-B13-W1; non-blocking per known-fail entry]

Skills cited: playwright-skill §3.18 5x consecutive 0 flake (for
non-RED specs only), §3.2 Pitfall 11 (adversarial error injection is
legitimate carve-out from no-mock rule); STANDING `feedback_adversarial_
review_testing`, `feedback_find_first_fix_later_via_tracker`,
`feedback_tracker_findings_only`.

Karpathy: §4.4 Goal-Driven (expose gap before fix; 不擅自改 prompt 違反
find-first).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
```

---

## C5 — F-CT1.4 NSM gate/eval i18n + classification + offcanvas WebKit fix + NEW-Test-Debt dim count + Phase A prep auxiliary

**Scope**: BE error classification (nsm-sessions.js gate + evaluator) + FE i18n render + retry button + 1 new e2e spec (543 lines) + offcanvas WebKit race fix (2 spec) + NEW-Test-Debt 4→3 dim count cross-spec sync + Phase A prep (4 c-drift lane auth fixtures for Wave 2 — GAP-2 mitigation).

**Tracker findings**:
- `audit/e2e-master-tracker.md` §3 F-CT1.4 (P2) — `routes/nsm-sessions.js:189/152-161` e.message leak + no 429/timeout classification
- `audit/e2e-master-tracker.md` §3 NEW-Test-Debt (post Bug B 2-stage review) — `tests/visual/nsm-step-2-3.spec.js` expects 4 dim but `NSM_DIMENSION_CONFIGS` (app.js 6037-6078) has 3 (impact removed)
- `audit/e2e-master-tracker.md` §3 F-CT1.4b (find-only, 2026-05-19) — CIRCLES side `e.message` leak audit (deferred to Phase 2, not in this commit)
- Offcanvas WebKit fix: `audit/offcanvas-delete-spec-2-prexisting-fails-rootcause.md` §5 #2 (B10 follow-up — `offcanvas-delete.spec.js` 2 pre-existing fails)

**Audit docs**: `audit/wave1-task-7-findings.md` (F-CT1.4) + `audit/wave1-task-6-findings.md` (NEW-Test-Debt) + `audit/補修-offcanvas-flake-fix-findings.md` (offcanvas drainSessions) + `audit/F-CT1.4b-circles-emessage-leak-audit.md` (find-only)

**Files in commit**:
- `routes/nsm-sessions.js` (catch block @ line 152-161 evaluator + line 189-202 gate — classify AbortError|timeout → `*_TIMEOUT`; 429|rate.limit → `*_RATE_LIMIT`; else → `*_API_ERROR`; return 503 `{error:'ai_service_error', code}`; do NOT leak e.message)
- `public/app.js` (renderNSMGate line ~1460 + renderNSMStep3 line ~1671 + retry handler line ~1949 + FE state code line 2027/2050/2063 — code-based i18n + error-wrap component + retry/back-to-step2 buttons; also dead conditional cleanup @ 2027 caught by reviewer)
- `tests/e2e/wave1-fct1.4-nsm-gate-error-i18n.spec.js` (NEW — 543 lines; 3 AC × 3 vp; AC-1 429 → `GATE_RATE_LIMIT` Chinese copy / AC-2 503 → `GATE_API_ERROR` / AC-3 network abort → `GATE_API_ERROR`)
- `tests/visual/nsm-gate-inline.spec.js` (line 213 NIT — `'gate_error'` → `'GATE_API_ERROR'` align new state shape)
- `tests/visual/nsm-step-2-3.spec.js` (line 94/110/113/128/206-211/229-234 — 4 dim → 3 dim assertion + test titles align `NSM_DIMENSION_CONFIGS`; NEW-Test-Debt close)
- `tests/e2e/offcanvas-delete.spec.js` (helper `openOffcanvasAndAwaitItem` @ line 195 — add `page.waitForResponse` for `/api/(guest-)?(circles|nsm)-sessions GET 200` before `expect.toBeVisible`; bump 10s → 20s for WebKit slow-start)
- `tests/e2e/offcanvas-delete-invalidates-recent-sessions.spec.js` (`drainSessions` helper via `page.evaluate(apiFetch)` — auth-carrying drain at bootApp time; replaces broken `cleanupTracker` 401 trap; `forceRecentRailLoad` injection pattern for parallel race deflake)
- `tests/setup/auth.setup.js` (+98 lines — `C_DRIFT_LANES` array × 4 lane setup; Phase A prep #3 / GAP-2 mitigation)
- `scripts/register-c-drift-test-accounts.js` (NEW 95 lines — Supabase admin.createUser × 4 unique e2e+c-drift-N@first-principle.test users; idempotent re-run safe)
- `audit/wave1-task-7-findings.md` (NEW)
- `audit/F-CT1.4b-circles-emessage-leak-audit.md` (NEW — find-only, fix deferred to Phase 2)
- `audit/補修-offcanvas-flake-fix-findings.md` (NEW)

```
fix(be+fe+test): F-CT1.4 NSM gate/eval i18n + offcanvas WebKit race +
NEW-Test-Debt 4→3 dim + Phase A prep c-drift auth lanes

白話：四件事捆一起 ship，因為都圍繞「NSM 錯誤路徑可觀測性 + Wave 2 並行
基礎建設」：
1. NSM gate/evaluator OpenAI 失敗時不再回英文錯誤訊息，前端顯示中文 +
   error code + 重試按鈕
2. offcanvas 刪除測試 mobile-safari 偶爾 flake 修掉（WebKit 慢一步）
3. NSM step 3 spec 還在 assert 4 維度 (impact 已移除) 修正成 3 維度
4. Wave 2 4 並行 lane 的 test user / storageState 預備好（GAP-2 解）

— Backend (routes/nsm-sessions.js) —
- evaluator catch (line 152-166): classify
  AbortError|timeout → EVAL_TIMEOUT, 429|rate.limit → EVAL_RATE_LIMIT,
  else → EVAL_API_ERROR; return 503 {error:'ai_service_error', code}
- gate catch (line 189-202): same shape, GATE_* codes
- e.message no longer in client response (内部 progress_json.evaluation_
  error 不變)

— Frontend (public/app.js) —
- renderNSMGate (line ~1460): code-based i18n + error-wrap component
  + retry / back-to-step2 buttons; closes HTML structure correctly
- renderNSMStep3 (line ~1671): new evalErrHtml block above submit bar
- retry handler (line ~1949): data-nsm-gate-action="retry" clears
  error + returns to step 2 form
- FE state code (line 2027/2050/2063): err.code || 'GATE_API_ERROR'
  fallback; catch maps AbortError|timeout → EVAL_TIMEOUT
- Dead conditional cleanup @ line 2027 (Wave 1 reviewer CRITICAL)

— Tests —
- tests/e2e/wave1-fct1.4-nsm-gate-error-i18n.spec.js (NEW 543 lines)
  - AC-1 429 → GATE_RATE_LIMIT → '審核服務目前負載過高'
  - AC-2 503 → GATE_API_ERROR → '審核服務暫時無法使用'
  - AC-3 network abort → GATE_API_ERROR (TypeError, not AbortError —
    browser fetch behaviour; documented in findings)
- tests/visual/nsm-gate-inline.spec.js line 213 NIT — 'gate_error' →
  'GATE_API_ERROR' align new state shape
- tests/visual/nsm-step-2-3.spec.js (NEW-Test-Debt close):
  - line 94/113 test titles 4 → 3 dim
  - line 110 attention labels: 觸及/互動/習慣 (drop 留存驅力)
  - line 128 saas labels: 啟用/席次/黏著 (drop 擴張信號)
  - line 206-211 + 229-234 descs aligned 4 → 3
- tests/e2e/offcanvas-delete.spec.js (B10 follow-up):
  - openOffcanvasAndAwaitItem @ line 195: + page.waitForResponse for
    GET /api/(guest-)?(circles|nsm)-sessions before expect.toBeVisible;
    10s → 20s timeout for WebKit slow-start
  - audit/offcanvas-delete-spec-2-prexisting-fails-rootcause.md §5 #2
- tests/e2e/offcanvas-delete-invalidates-recent-sessions.spec.js:
  - drainSessions helper (page.evaluate apiFetch — auth-carrying)
  - replaces cleanupTracker 401 trap pattern (request fixture has no
    storageState); mirrors bug4-offcanvas-delete-cache-reproduce
    spec line 24-27 doc
  - forceRecentRailLoad: deterministic AppState inject instead of
    GET-then-slice(0,5) — survives 6 parallel workers
  - audit/補修-offcanvas-flake-fix-findings.md (root cause + 5x
    GREEN 7/7 × 5 runs = 35/35)

— Phase A prep (Wave 2 GAP-2 mitigation) —
- scripts/register-c-drift-test-accounts.js (NEW 95 lines)
  - Supabase admin.createUser × 4: e2e+c-drift-{1,2,3,4}@first-
    principle.test, email_confirm:true, idempotent
- tests/setup/auth.setup.js (+98 lines)
  - C_DRIFT_LANES array × 4 storageState file
  - per-lane env-guard / preflight / atomic-write
  - prevents drainSessions cross-lane互殺 (per #199 verify)

Out-of-scope follow-up (find-only, NOT in commit):
- audit/F-CT1.4b-circles-emessage-leak-audit.md — CIRCLES side has 7
  parallel e.message leaks (lines 39/105/198/251/306/463/482); only
  #3 gate is HIGH (mirror NSM W1-補.7); deferred to Phase 2 per
  find-first STANDING

Evidence:
- tracker §3 F-CT1.4 (P2) + NEW-Test-Debt + F-CT1.4b find-only
- audit/wave1-task-7-findings.md (F-CT1.4)
- audit/wave1-task-6-findings.md (NEW-Test-Debt)
- audit/補修-offcanvas-flake-fix-findings.md (offcanvas)
- audit/F-CT1.4-evidence/ 9 PNG (3 AC × 3 vp)
- F-CT1.4 5x consecutive: 50/50 PASS (per task-7 findings)
- NEW-Test-Debt 5x consecutive: 12/12 × 5 = 60/60 (per task-6 findings)
- offcanvas-invalidates 5x consecutive: 7/7 × 5 = 35/35 (per補修 doc)
- Serial verifier 5x consecutive (full bundle): [PLACEHOLDER: X/5 GREEN]
- jest baseline: [PLACEHOLDER: N/M, 0 new fail]

Skills cited: playwright-skill Pitfall 11 (error injection carve-out,
adversarial 503/timeout), Pitfall 14 (drainSessions auth pattern,
cleanupTracker 401 trap documented), §3.5 test.step, §3.9 api-testing,
§3.11 cross-vp, §3.18 5x consecutive; STANDING `feedback_e2e_real_data_
only`, `feedback_find_first_fix_later_via_tracker`, `feedback_three_
iron_laws` (IL-1 root cause classification per error path), STANDING
`feedback_subagent_self_report_unverifiable` (5-step Director cross-
check applied).

Karpathy: §4.1 Think Before (assumptions stated per audit doc 4.1),
§4.3 Surgical Changes (BE +18 line / FE +204-45 line, all hunks scoped
to error-path render functions; no helper rewrite), §4.4 Goal-Driven
(observability for OpenAI failure paths — single concern bundled with
其它 NSM error-path test-debt 一同 ship).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
```

---

## Placeholders to fill from serial verifier (`a7fb535b` run)

Each commit body has these placeholder slots to fill after verifier completes (~2 hr):

| Commit | Placeholder | Source |
|---|---|---|
| C1 | `[PLACEHOLDER: X/5 GREEN]` (e2e leg) + `[PLACEHOLDER: N/M, 0 new fail]` (jest) | verifier `nsm-step1-card-click-no-session.spec.js` 5x + `npm test` summary |
| C2 | `[PLACEHOLDER: X/5 GREEN]` + `[PLACEHOLDER: N/M, 0 new fail]` | verifier `wave1-b6-mockup04-drift-fix.spec.js` + Layer (b) + jest |
| C3 | `[PLACEHOLDER: X/5 GREEN]` (e2e leg) + `[PLACEHOLDER: N/M, 0 new fail]` | verifier `wave1-fct1.3-circles-gate-backoff-real-flow.spec.js` 5x + jest |
| C4 | `[PLACEHOLDER: X/5 GREEN]` + `[PLACEHOLDER: N/M; expected +K RED documented]` | verifier adversarial subset + jest (RED for final-report mixed-input expected per audit) |
| C5 | `[PLACEHOLDER: X/5 GREEN]` (full bundle) + `[PLACEHOLDER: N/M, 0 new fail]` | verifier `wave1-fct1.4-*` + `offcanvas-delete*` + `nsm-step-2-3` + jest |

---

## HITL gate notes (per RITUAL §13 + Live demo gate STANDING)

Before each commit:
1. Director cold-Read terminal output (verifier numbers actually GREEN)
2. `git diff --cached` 確認 file list 對齊上述 scope
3. `git ls-files --error-unmatch <file>` for every NEW file in commit (anti drift per `feedback_subagent_self_report_unverifiable`)
4. afplay sound ping at gate per `feedback_sound_ping_on_confirmation`
5. user 親眼「對」才執行 commit + push (per `feedback_live_demo_gate_protocol`)

C2 commit message MUST include `known-skip: AC-3 (O-13 backlog)` string per cheat-sheet v4 §A.1 Q2 fix.

---

## Open clarifications (for user/director before commit)

1. **Bug B padding** — user prompt for C2 mentioned「Bug B padding」but `git log --oneline` shows it shipped `b0c7a55` (2026-05-17 PM follow-up to b126937). Confirmed dropped from C2. If anything else padding-related remains staged outside this drift set, please flag.
2. **Phase A prep auxiliary in C5** — `tests/setup/auth.setup.js` + `scripts/register-c-drift-test-accounts.js` are conceptually Wave 2 prep (GAP-2 mitigation), not Wave 1 補洞. Option A: keep in C5 as auxiliary (current draft). Option B: split into C6 with subject `chore(test-infra): provision 4 c-drift lane auth fixtures (Wave 2 GAP-2)`. User decision.
3. **C4 RED ship** — circles-final-report mixed-input adversarial is RED-expected per audit. Bundle ships the spec as documented finding (not fix). If user prefers shipping prompt fix in same wave, add a C6/C7 prompt patch commit; otherwise leave as Phase 2 backlog item.
4. **Serial verifier number gating** — if any 5x run < 5/5 GREEN, that commit MUST split out the failing item (per IL-2 verification-before-completion). Director re-Read terminal before filling placeholder.

End of draft.
