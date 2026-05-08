# Plan B Phase 3 Score — Mockup 11 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Implement CIRCLES Phase 3 步驟分數 view per mockup 11 — 4 sections (A 預設 / B 低分自動展開 / C Loading / D Error) × 3 viewports.

**Architecture:** Pure frontend rewrite per Path 2. New `renderCirclesPhase3()` + sub-renderers + AppState fields + 4-step checklist setInterval + 30s timeout fallback. Backend evaluate-step already wired (from Phase 2 SB-B).

**Spec:** `docs/superpowers/specs/2026-05-08-mockup-11-phase3-score-design.md`
**Mockup:** `docs/superpowers/specs/mockups/2026-05-02-frontend-rewrite/11-phase-3-score.html` — opus親Read 12 PNGs `audit/png-mockup-11/section-{A,B,C,D}-{mobile,tablet,desktop}.png`

---

## File Structure

**Modify:**
- `public/app.js` — add `renderCirclesPhase3()` + sub-renderers; replace `renderCirclesStub()` call site at `~line 215` to dispatch Phase 3 when `circlesPhase===3 && circlesSession`; add 4 AppState fields; add 4-step checklist setInterval; wire retry button
- `public/style.css` — append Phase 3 score CSS section verbatim from mockup 11 (score-card / dim-row / highlights / coach-demo / score-loading-* / error-circle / error-code-badge)

**New:**
- `tests/visual/phase3-score.spec.js` — 12+ specs covering 4 sections + state transitions + retry + auto-expand rule
- `tests/visual/capture-mockup-11-pngs.spec.js` — already exists from pre-impl audit

**Update:**
- `CLAUDE.md` — Plan B Phase 3 row + last-updated
- `audit/eyeball-mockup-11.md` (new) — 12-PNG mockup baseline + 12 production PNG audit

---

## Tasks (single sub-bundle, 5 commits)

### Task P3-1: AppState scaffolding + Phase 3 router + Section A skeleton

**Files:**
- Modify `public/app.js`:
  - Add 4 AppState fields (`circlesPhase3LoadingStep`, `circlesPhase3Error`, `circlesPhase3DimExpanded`, `circlesPhase3CoachDemoOpen`)
  - Modify view router around `~line 215` to add Phase 3 case BEFORE `renderCirclesStub()` catchall:
    ```javascript
    if (AppState.circlesPhase === 3 && AppState.circlesSession) {
      return renderCirclesPhase3();
    }
    ```
  - Stub `renderCirclesPhase3()` returning placeholder `<div data-view="circles" data-phase="3">Phase 3 placeholder</div>`
- New `tests/visual/phase3-score.spec.js` — router test:
  ```javascript
  test('Phase 3 router: circlesPhase=3 + session + circlesScoreResult → renderCirclesPhase3 not stub', async ({ page }) => {
    await page.goto('/'); await page.waitForSelector('.navbar');
    await page.evaluate(() => {
      Object.assign(window.AppState, {
        view: 'circles', circlesPhase: 3,
        circlesSession: { id: 's1' },
        circlesSelectedQuestion: { id: 'q1', company: 'Spotify', product: 'Spotify Podcast', question_type: 'design' },
        circlesDrillStep: 'I',
        circlesScoreResult: { totalScore: 78, dimensions: [], coachVersion: { context:'', perField:[], reasoning:'' }, strengths:'', improvements:'' },
      });
      window.renderApp();
    });
    await expect(page.locator('[data-view="circles"][data-phase="3"]')).toBeVisible();
    await expect(page.locator('text=Plan B 實作')).toHaveCount(0); // stub gone
  });
  ```
- TDD red → green → commit `feat(plan-b-phase3): P3-1 — AppState + Phase 3 router scaffolding`

### Task P3-2: Section A 預設狀態 — score-card + dim-rows + highlights + coach-demo accordion

**Files:**
- Modify `public/app.js`:
  - Replace stub `renderCirclesPhase3()` with full Section A render
  - Reuse navbar / drill-pill 7-step rail / phase-head LOCKED helpers (copy from `renderCirclesPhase1` / `renderCirclesPhase2`)
  - `.score-card` with Instrument Serif italic `.score-card__num` (use `.font-serif italic` token already in mockup 03)
  - 4 `.dim-row` with progress-bar visualizing `score/5` (each dim from `AppState.circlesScoreResult.dimensions`)
  - mobile/tablet: dim-rows collapsed (chevron); desktop: auto-expanded inline with body comment + 教練版本 + 進一步 suggestion
  - 2-col `.highlights` (success ✓ green strong + warn ⚠ orange weak)
  - `.coach-demo` accordion (collapsed by default)
  - bottom 2-button row 回首頁 / 再練一題
- Modify `public/style.css`:
  - Append `.score-card`, `.score-card__num` (Instrument Serif italic 80px navy), `.score-card__sub`
  - Append `.dim-row`, `.dim-row__head`, `.dim-row__title`, `.dim-row__bar`, `.dim-row__score`, `.dim-row__caret`, `.dim-row.is-open`, `.dim-row__body`, `.dim-row__coach-block`, `.dim-row__suggestion`
  - Append `.highlights`, `.highlight--strong` (success), `.highlight--weak` (warn)
  - Append `.coach-demo` accordion + `.coach-demo__head` + `.coach-demo__body` (`.is-open`)
  - VERBATIM from mockup 11
- Tests:
  - Section A renders score 78, 4 dim-rows visible, 2 highlights visible, coach-demo collapsed
  - desktop viewport (Desktop-1280): dim-rows auto-expanded showing comment + coach + suggestion blocks
  - mobile viewport (Mobile-360): dim-rows collapsed (no body visible)
  - bottom 2-button row visible
- Commit: `feat(plan-b-phase3): P3-2 — Section A score-card + dim-rows + highlights + coach-demo`

### Task P3-3: Section B auto-expand rule + multi-section coach-demo

**Files:**
- Modify `public/app.js`:
  - In renderCirclesPhase3, add auto-expand logic: any dim with `score <= 2` → render `.is-open` with body
  - When ANY dim has score ≤ 2 → also auto-open `.coach-demo` (set `circlesPhase3CoachDemoOpen` true on first render)
  - Render multi-section `.coach-demo__body`:
    - section 1: `coachVersion.context` (為什麼這個分群重要)
    - section 2: `coachVersion.perField` (4 sub-blocks 候選分群 / 焦點分群 / 選擇理由 / 用戶動機假設)
    - section 3: `coachVersion.reasoning` (99 為什麼這樣 — lightbulb icon header)
- Tests:
  - Seed score 52 + dim 邏輯性=1 → 邏輯性 `.is-open` + body+coach+suggestion visible
  - coach-demo auto-open with 3 sections rendered
  - perField iterates 4 sub-blocks
  - other dims (score ≥ 3) follow viewport rule (collapsed mobile / expanded desktop)
- Commit: `feat(plan-b-phase3): P3-3 — Section B auto-expand low-score dim + multi-section coach-demo`

### Task P3-4: Section C Loading + Section D Error + retry wire

**Files:**
- Modify `public/app.js`:
  - When `!AppState.circlesScoreResult && !circlesPhase3Error` → render Section C Loading:
    - 56px navy spinner
    - title「正在生成評分」+ sub
    - 4-step checklist with state markers driven by `circlesPhase3LoadingStep` (0/1/2/3)
    - Start `setInterval` 5s on mount of Loading state to advance step (cap at 3); clear on unmount
    - Start `setTimeout` 30s on mount: if still loading → set `circlesPhase3Error = { code: 'EVAL_TIMEOUT', message: '...' }`
  - When `circlesPhase3Error` → render Section D Error:
    - 80px danger circle + cloud-warning icon
    - title「評分生成失敗」+ dynamic sub per error code
    - error code badge (mono font灰底)
    - 2-button row 返回修改答案 (← Phase 1 form same step) / 重新評分 (retry)
  - Retry handler: clear error + reset loadingStep + invoke evaluate-step retry (delegate to existing Phase 2 SB-B `evaluateStepFromConclusion` helper or write `retryEvaluateStep()` if not extracted)
- Modify `public/style.css`:
  - Append `.score-loading-spinner` (56px circular outline animation)
  - Append `.score-loading-step` (4 variants: done ✓ / active ⊙ / pending ○)
  - Append `.error-circle` (80px danger lt bg + filled cloud-warning red)
  - Append `.error-code-badge` (mono font + ink-3 lt bg)
  - VERBATIM from mockup 11
- Tests:
  - Loading: 4-step checklist visible + spinner visible + advance step every 5s (use `page.clock` to fast-forward)
  - 30s timeout → set error EVAL_TIMEOUT
  - Error: code badge + sub copy per code; retry button visible
  - Retry click → loadingStep=0 + error cleared + evaluate-step refetch
- Commit: `feat(plan-b-phase3): P3-4 — Section C Loading + D Error + retry wire`

### Task P3-5: 12 production PNG audit + iOS 15-item + audit doc + final commit

- Capture spec for production render:
  - Extend or create `tests/visual/capture-prod-phase3-pngs.spec.js` to capture 12 production PNGs (4 sections × 3 viewports)
  - Output `audit/png-prod-mockup-11/section-{A,B,C,D}-{mobile,tablet,desktop}.png`
- Director (after impl): use Read tool on each of 12 PNGs personally + 1-line observation per PNG comparing to mockup baseline
- iOS 15-item static review:
  - 56px spinner animation perf on iOS Safari
  - dim-row chevron tap target ≥ 44px
  - coach-demo accordion expand/collapse no flicker
  - safe-area-inset-bottom on 2-button row
- Create `audit/eyeball-mockup-11.md` mirroring `audit/eyeball-mockup-05.md` format
- Update CLAUDE.md row + last-updated
- Commit: `docs(plan-b-phase3): 12 production PNG audit + iOS 15-item + eyeball doc`

---

## Self-Review

Spec coverage: 4 sections + state matrix + AppState + retry + auto-expand rule — all mapped to tasks. ✓

Type consistency: `circlesScoreResult.coachVersion` shape `{context, perField[], reasoning}` matches lib `isValidEvaluatorResult` guard at `lib/evaluate-step-handler.js:48-58`. ✓

No placeholder. ✓

---

## Execution Handoff

After this plan is complete, dispatch sonnet implementer for all 5 tasks in one go (single sub-bundle, sequential commits). Director (opus) cold-reviews via 8-viewport Playwright + 12-PNG cross-viewport read.

Next mockup after this: 13 (Phase 4 final) — same pattern.
