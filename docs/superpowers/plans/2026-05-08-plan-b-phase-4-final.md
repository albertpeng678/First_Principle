# Plan B Phase 4 Final Report — Mockup 13 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development.

**Goal:** Implement CIRCLES Phase 4 模擬面試總結報告 view per mockup 13 — 3 sections (A success / B Loading / C Error) × 3 viewports.

**Spec:** `docs/superpowers/specs/2026-05-08-mockup-13-phase4-final-design.md`
**Mockup:** `docs/superpowers/specs/mockups/2026-05-02-frontend-rewrite/13-phase-4-final.html` — opus親Read 9 PNGs `audit/png-mockup-13/section-{A,B,C}-{mobile,tablet,desktop}.png`

---

## File Structure

**Modify:**
- `public/app.js` — add `renderCirclesPhase4()` + 3 sub-renderers; add Phase 4 router case BEFORE `renderCirclesStub()`; add 2 AppState fields; add 7-axis radar SVG helper; add 4-step checklist setInterval + 60s timeout
- `public/style.css` — append Phase 4 final CSS verbatim from mockup 13 (score-summary / step-row / nsm-mini-card / strengths/improvements/verdict/nextsteps section / SVG radar styling)

**New:**
- `tests/visual/phase4-final.spec.js` — 12+ specs covering 3 sections + state transitions + radar render + retry

**Update:**
- `audit/eyeball-mockup-13.md` (new) — 9-PNG mockup baseline + 9 production PNG audit

---

## Tasks (single sub-bundle, 5 commits)

### Task P4-1: AppState + Phase 4 router scaffolding

**Files:**
- Modify `public/app.js`: add 2 fields (`circlesPhase4LoadingStep: 0`, `circlesPhase4Error: null`); modify view router `~line 215` to add Phase 4 case BEFORE stub:
  ```javascript
  if (AppState.circlesPhase === 4 && AppState.circlesSession) {
    return renderCirclesPhase4();
  }
  ```
- Stub `renderCirclesPhase4()` returning `<div data-view="circles" data-phase="4">Phase 4 placeholder</div>`
- New `tests/visual/phase4-final.spec.js` with router test:
  ```javascript
  test('Phase 4 router: phase=4 + session → renderCirclesPhase4 not stub', async ({ page }) => {
    await page.goto('/'); await page.waitForSelector('.navbar');
    await page.evaluate(() => {
      Object.assign(window.AppState, {
        view: 'circles', circlesPhase: 4,
        circlesSession: { id: 's1' },
        circlesSelectedQuestion: { id:'q1', company:'Spotify', product:'Spotify Podcast' },
        circlesMode: 'simulation',
      });
      window.renderApp();
    });
    await expect(page.locator('[data-view="circles"][data-phase="4"]')).toBeVisible();
    await expect(page.locator('text=Plan B 實作')).toHaveCount(0);
  });
  ```
- TDD red → green → commit `feat(plan-b-phase4): P4-1 — AppState + Phase 4 router scaffolding`

### Task P4-2: Section B Loading + auto-trigger POST final-report + 60s timeout

**Files:**
- Modify `public/app.js`:
  - When `!circlesFinalReport && !circlesPhase4Error` on Phase 4 entry → render Section B Loading
  - On Phase 4 first render: auto-fire `triggerFinalReport()` async helper that calls `POST /api/(guest-)circles-sessions/:id/final-report` (auth/guest endpoint switch via `AppState.accessToken` ternary, mirror Phase 3 pattern); on response set `AppState.circlesFinalReport = data` + `renderApp()`; on error set `circlesPhase4Error = { code, message }`
  - 56px navy spinner + 4-step checklist
  - setInterval 7s advance step (slower than Phase 3 since 30-60s window)
  - setTimeout 60s timeout fallback (set error REPORT_TIMEOUT)
- Modify `public/style.css`: reuse `.score-loading-spinner` / `.score-loading-step` from Phase 3 (already in stylesheet — verify no naming conflict)
- Tests:
  - Loading: 4-step checklist visible + spinner + step advances every 7s
  - 60s timeout → `circlesPhase4Error.code === 'REPORT_TIMEOUT'`
  - auto-fire POST final-report on mount (assert mocked endpoint called)
- Commit: `feat(plan-b-phase4): P4-2 — Section B Loading + auto-fire final-report + 60s timeout`

### Task P4-3: Section A success report — score-summary + 7-axis radar + 7 step-rows + NSM mini-cards

**Files:**
- Modify `public/app.js`:
  - When `circlesFinalReport` exists → render Section A
  - `renderRadarSVG(radarData)` helper: 7-vertex polygon (heptagon) navy filled. Compute vertices from 7 step scores (0-100 → radius 0-r). Use inline SVG `<polygon points="...">` + grid background lines.
  - `.score-summary-card` 大字 score + summary text
  - 7 `.step-row` iter `circlesFinalReport.stepRows`：each row letter circle + title + score + commentary
  - NSM 4 mini-cards (ONLY if `circlesFinalReport.nsmDims`)：`.nsm-mini-card` × 4 dashed border, 1-col stack
  - desktop: `.phase4-top-grid` 2-col (radar 380px + step-rows 1fr) — flex `display:contents` for ordering on smaller viewports
  - mobile/tablet: 1-col stack
- Modify `public/style.css`:
  - Append `.score-summary-card`, `.step-row`, `.step-row__letter` (Instrument Serif italic), `.step-row__title`, `.step-row__score`, `.step-row__commentary`
  - Append `.nsm-mini-card` (dashed border) × 4 stack
  - Append `.phase4-top-grid` 2-col desktop
  - Append SVG radar styling (polygon navy lt fill + ink-3 grid)
  - VERBATIM from mockup 13
- Tests:
  - Seed full report → score-summary visible with 77 + summary text
  - 7 step-rows render with each step letter + title + score + commentary
  - NSM 4 mini-cards present when nsmDims provided
  - radar SVG polygon rendered with 7 vertices
  - desktop 2-col layout (assert grid-template-columns includes 380px)
- Commit: `feat(plan-b-phase4): P4-3 — Section A success report + radar SVG + step-rows + NSM mini-cards`

### Task P4-4: Section A strengths/improvements/verdict/nextsteps + submit-bar + Section C Error + retry

**Files:**
- Modify `public/app.js`:
  - Section A bottom: `.strengths-section` (success ✓ list) + `.improvements-section` (warn ⚠ list) + `.verdict-section` (navy bg) + `.nextsteps-section` (bullets) iterating arrays from response
  - submit-bar bottom: 1-line summary text + 「匯出 PNG」 ghost (click handler stub — `console.log('export PNG TBD')`) + 「再練一題」 navy → home + clear session
  - Section C Error: 80px danger circle + cloud-warning + dynamic copy per code + error-code-badge mono + 「⌂ 回首頁」/「↻ 重試」 retry handler resets state + re-fires triggerFinalReport
- Modify `public/style.css`:
  - Append `.strengths-section`, `.improvements-section`, `.verdict-section`, `.nextsteps-section`
  - Reuse `.error-circle`, `.error-code-badge` from Phase 3
- Tests:
  - strengths × 3 / improvements × 3 / verdict text / nextsteps × N rendered
  - 再練一題 click → AppState.circlesPhase = 1, circlesSession = null, view = circles, etc (back to home)
  - Error: cloud-warning + REPORT_API_ERROR badge + 2-button row
  - Retry click: clears error + reset loadingStep + re-fires final-report
- Commit: `feat(plan-b-phase4): P4-4 — strengths/improvements/verdict/nextsteps + submit-bar + Section C Error + retry`

### Task P4-5: 9 production PNG audit + iOS 15-item + audit doc

- Capture 9 production PNGs (3 sections × 3 viewports) via new spec `tests/visual/capture-prod-phase4-pngs.spec.js`. Output `audit/png-prod-mockup-13/`
- Use Read tool on each of 9 PNGs personally + 1-line observation per PNG
- iOS 15-item static review (radar SVG perf, scroll behavior on long report, safe-area)
- Create `audit/eyeball-mockup-13.md` mirroring `audit/eyeball-mockup-11.md` format
- Final commit: `docs(plan-b-phase4): P4-5 — 9 production PNG audit + iOS 15-item + eyeball doc`

---

## Verification gates

- jest 143/143
- Playwright phase4-final all 8 viewports green
- Critical regression (circles-home + phase1-form + phase2-chat + phase3-score) Desktop-1280 green
- 9 production PNGs Read

---

## Self-Review

- All 3 sections covered ✓
- Backend endpoint reused (no routes/prompts/lib edits) ✓
- LOCKED component reuse ✓
- Phase 4 only triggered for sim mode (router guards `circlesMode === 'simulation'` if needed) — defer enforcement to follow-up since drill end-to-end already complete ✓
