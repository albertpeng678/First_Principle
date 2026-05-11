# NSM Fix Bundle Implementation Plan (2026-05-12)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **Implementer dispatch MUST prepend Karpathy 4 rules verbatim.**

**Goal:** Fix 8 user-reported NSM bugs while strictly honoring 2 放行 mockup baselines + adding content to all places the user can see.

**Architecture:**
- 4 FE bug fixes (`public/app.js` surgical edits + new CSS for locked/overlay states)
- 1 BE rehydrate infrastructure (`lib/question-bank.js` + `lib/session-rehydrate.js`)
- 1 NSM content authoring batch (`nsm_plan/nsm_database.json` — author `field_examples` + `context` for 100 NSM questions)
- 1 BE dedup + cache (`lib/session-dedup.js` + `lib/session-cache.js` wired into 4 routes)
- 1 verification + ship gate (full 8 vp regression + cold-Read + production deploy)

**Tech Stack:** Node 18+ / Express 5 / Supabase / vanilla JS frontend / Jest / Playwright × 8 vp / Chrome + WebKit / Phosphor icons / system-ui font stack

**Spec reference:** `audit/exhaustive-nsm-audit-2026-05-11-v2.md` + 2 放行 mockup baselines:
- `docs/superpowers/specs/mockups/2026-05-12-nsm-locked-states/01-step2-locked.html` (X-LockedStep2 contract)
- `docs/superpowers/specs/mockups/2026-05-12-nsm-locked-states/02-coach-bottom-sheet.html` (X-Overlay contract)

---

## 🔴 3 大不准漏稽核 SURFACE（user explicit discipline — 2026-05-12）🔴

**User has explicitly demanded these 3 surfaces MUST be checked at every verification point. Never skip.**

| # | Surface | 驗點 | 不准 |
|---|---|---|---|
| **1** | **問題說明（深入了解問題 expand）** | 4 blocks (商業模式 / 使用者 / 常見陷阱 / 破題切入) 必須有 question-specific 真實內容 | 「此題暫無深入背景資料」 placeholder |
| **2** | **提示** | 點任何「提示」按鈕 → modal opens with question-specific real content | 「想想看你的 Activation 門檻是什麼…」generic boilerplate |
| **3** | **範例答案** | 點任何「範例答案」按鈕 → inline expand or modal with question-specific real content | 「此題暫無範例答案」 disabled state |

**Where each must be verified (every Task that touches these surfaces):**

- **Task 5 (BE rehydrate)** — after rehydrate, list/detail response MUST have `question_json.field_examples` (for 提示+範例答案) + `question_json.context` (for 問題說明). Curl smoke MUST verify both keys exist.
- **Task 6 (NSM bank backfill)** — Python validation script asserts 100/100 questions have field_examples (step2+step3) AND context (4 keys). NO incomplete entry allowed.
- **Task 8 cold-Read** — Director MUST click 提示 + 範例答案 + 問題說明 expand on at LEAST 1 NSM session + 1 CIRCLES session × 3 viewports = 9 manual verification points. Document content snippet per check.
- **UAT SOP §F+§G+任何 Step 2/3** — User UAT SOP MUST include explicit click-through of all 3 surfaces with expected real content visible.

**If any verification finds empty/generic placeholder in any of these 3 surfaces, task is NOT done. Re-author content + re-verify.**

---

---

## 0. Discipline contract (mandatory for every implementer dispatch)

**Karpathy 4 rules — prepend verbatim to every implementer prompt:**

1. **Think Before** — confirm root cause via DB query / code grep / production curl BEFORE editing. No editing on guesswork.
2. **Simplicity First** — no premature abstraction, no hypothetical-future code, no over-engineering. Reuse LOCKED component classes verbatim (per `feedback_locked_components_reuse.md`).
3. **Surgical Changes** — total source diff ≤ 30 lines per task (mockup-bound tasks may go 60 lines for CSS, callout in subject). NO adjacent cleanup; bug fix does not include refactor.
4. **Goal-Driven** — pass the failing test = task done. Do not paint outside the lines.

**Mockup-as-Spec strict rules (CLAUDE.md §5.2):**

- Implementer MUST open mockup HTML before writing any styling/render code that touches X-LockedStep2 or X-Overlay
- mockup ↔ production pixel-diff ≤ 0.5% per state, per viewport (Visual Stack §2)
- Natural-language judgment ("looks aligned") is BANNED — only numeric pixel-diff passes
- Bundle PR 必出 4 樣產出（CLAUDE.md §79）: jest log / Playwright × 8 vp log / `tests/visual/diffs/nsm-fix-bundle-2026-05-12-report.md` / `audit/eyeball-nsm-fix-bundle-2026-05-12.md`

**Director cold-Read mandatory (Standing Rule #4 + `feedback_test_all_devices_visual.md` + `feedback_two_stage_review_mandatory.md`):**

- After every implementer task, Playwright captures × 8 vp (Mobile-360 / iPhone-SE / iPhone-14 / iPhone-15-Pro / iPad / Desktop-1280 / Desktop-1440 / Desktop-2560)
- **Director (opus) personally Reads EVERY captured PNG** — sub-agent self-report does NOT count
- Per-PNG one-sentence verdict written to `audit/eyeball-nsm-fix-bundle-2026-05-12.md`
- No sampling allowed; if a vp has 5 scenes, all 5 × 8 = 40 PNGs Read

**Two-stage review mandatory (CLAUDE.md Standing Rule #4 + memory):**

- Per task: **Spec compliance reviewer** (opus, cold review) → only when ✅ → **Code quality reviewer** (opus, cold review). NOT parallel.
- Reviewer finds issues → implementer fixes → re-review (same reviewer). Do NOT skip re-review.
- "Close enough" on spec compliance is BANNED.

**Path 2 carve-out scope (user-approved 2026-05-11/05-12):**

| Surface | Allowed | Denied |
|---|---|---|
| `routes/nsm-sessions.js` + `routes/guest-nsm-sessions.js` | ✓ list/detail rehydrate + dedup + cache | ✗ schema change |
| `routes/circles-sessions.js` + `routes/guest-circles-sessions.js` | ✓ list/detail rehydrate + dedup + cache | ✗ schema change |
| `nsm_plan/nsm_database.json` | ✓ ADD `field_examples` + `context` (data backfill) | ✗ change existing keys |
| `circles_plan/circles_database.json` | ✗ frozen | — |
| `prompts/*.js` | ✗ frozen (no carve-out) | — |
| DB migration | ✗ defer to Phase 2 follow-up | UNIQUE constraint deferred |
| jest baseline 197/214 | ✓ MUST preserve | ✗ no regression |
| `public/app.js` | ✓ surgical FE fixes | — |

**Superpower skill chain for this bundle:**

1. ✅ `superpowers:brainstorming` (done — exhaustive audit)
2. ✅ Mockup phase (done — 2 mockup 放行)
3. **▶ `superpowers:writing-plans`** (this document)
4. **▶ `superpowers:subagent-driven-development`** (Phase 2 execution)
5. Within subagents: `superpowers:test-driven-development` (TDD red → green → commit)
6. Per-task: `superpowers:code-reviewer` (two-stage review)
7. Final: `superpowers:finishing-a-development-branch` (push + UAT SOP)

**iOS Safari 15-item static checklist (Standing Rule #5 — every task touching mobile UX):**

- 100vh on mobile (use `100dvh` if Safari support OK) / safe-area-inset / input zoom font ≥ 16px / touch target ≥ 44px / momentum scroll / no `:hover` reliance / -webkit-tap-highlight-color / smooth-scroll behavior / sticky position fallback / overscroll-behavior / overflow:auto needs -webkit-overflow-scrolling / accent-color browser quirks / scrollbar-width on iOS / font-display swap / line-clamp -webkit-

---

## 1. File structure

### Files to CREATE

| Path | Responsibility | Touched by Task |
|---|---|---|
| `lib/question-bank.js` | Load `nsm_database.json` + `circles_database.json` at startup; expose `byId(id)` lookup; cache module-level | T5 |
| `lib/session-rehydrate.js` | `rehydrateQuestionJson(item, kind)` — merge current bank's `field_examples` + `context` (NSM only) into `item.question_json` | T5 |
| `lib/session-dedup.js` | `dedupSessions(items)` — group by `question_id`, keep most-progressed status (completed > active) then most-recent | T7 |
| `lib/session-cache.js` | In-memory `Map` keyed by `kind:owner` with 30s TTL; invalidate on writes | T7 |
| `tests/lib/question-bank.test.js` | jest unit test — bank loads + byId returns correct row | T5 |
| `tests/lib/session-rehydrate.test.js` | jest unit test — rehydrate merges field_examples + context | T5 |
| `tests/lib/session-dedup.test.js` | jest unit test — dedup picks completed > active > recent | T7 |
| `tests/lib/session-cache.test.js` | jest unit test — cache TTL + invalidate | T7 |
| `tests/visual/nsm-compare-restore.spec.js` | Playwright — Bug X-Compare regression × 8 vp | T1 |
| `tests/visual/nsm-back-scored-guard.spec.js` | Playwright — Bug X-Back regression × 8 vp | T2 |
| `tests/visual/nsm-step2-locked.spec.js` | Playwright — Bug X-LockedStep2 regression × 8 vp × 3 states (baseline/hint/example) | T3 |
| `tests/visual/nsm-coach-overlay.spec.js` | Playwright — Bug X-Overlay regression × 8 vp | T4 |
| `tests/visual/diffs/nsm-fix-bundle-2026-05-12-report.md` | mockup ↔ production pixel-diff numeric report | T8 |
| `audit/eyeball-nsm-fix-bundle-2026-05-12.md` | Director cold-Read walk doc per PNG | T8 |
| `audit/uat-sop-nsm-fix-bundle-2026-05-12.md` | User UAT step-by-step SOP | T8 |
| `scripts/author-nsm-content-batch.js` | Dispatch helper — generates structured prompts to author 100 NSM questions' field_examples + context | T6 |

### Files to MODIFY

| Path | Changes | Touched by Task |
|---|---|---|
| `public/app.js:2178-2210` | X-Compare — compare row coerce string→object | T1 |
| `public/app.js:1808-1819, 2424-2441, 5628, navbar handlers` | X-Back — every nsmStep=1 reset gets `if scored, redirect Step 4 instead` guard | T2 |
| `public/app.js:1261-1292` (`renderNSMStep2`) + new CSS | X-LockedStep2 per mockup 01 | T3 |
| `public/app.js:2185-2240` (`renderNSMStep4ComparisonTab` mobile branch) + new CSS | X-Overlay per mockup 02 | T4 |
| `public/style.css` | Add `.rt-field--locked`, `.submit-bar--locked`, `.nsm-coach-bottom-sheet`, `.nsm-coach-bottom-sheet__handle`, `.nsm-coach-bottom-sheet__backdrop` | T3 + T4 |
| `routes/nsm-sessions.js` | List + detail: apply rehydrate + dedup + cache | T5 + T7 |
| `routes/guest-nsm-sessions.js` | Same | T5 + T7 |
| `routes/circles-sessions.js` | Same | T5 + T7 |
| `routes/guest-circles-sessions.js` | Same | T5 + T7 |
| `nsm_plan/nsm_database.json` | Add `field_examples` + `context` for 100 questions | T6 |
| `server.js` | Wire up cache invalidation hooks if needed | T7 |
| `CLAUDE.md` | Update Last-updated + 最近 ship | T8 |

---

## Task 1: X-Compare — Step 4 對比 row coerce string→object

**Bug:** Step 4 對比 tab 「你的」cell empty for NSM rows because `userDef.nsm` reads `.nsm` from a string (legacy schema).

**Files:**
- Modify: `public/app.js:2173-2210`
- Create: `tests/visual/nsm-compare-restore.spec.js`

- [ ] **Step 1.1: Write failing Playwright test**

Create `tests/visual/nsm-compare-restore.spec.js`:

```javascript
const { test, expect } = require('@playwright/test');

async function setupZoomScored(page) {
  await page.route('**/api/circles-stats', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"completed":0,"active":0,"weeklyCompleted":0}' }));
  await page.route('**/api/guest-circles-stats', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"completed":0,"active":0,"weeklyCompleted":0}' }));
  await page.route('**/api/circles-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/guest-circles-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/nsm-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/guest/nsm-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.goto('/');
  await page.waitForSelector('.navbar');
  await page.evaluate(() => {
    Object.assign(window.AppState, {
      view: 'nsm',
      nsmStep: 4,
      nsmReportTab: 'comparison',
      nsmSelectedQuestion: { id: 'q17', company: 'Zoom', product: '視訊會議 SaaS', question_type: 'saas' },
      nsmDefinition: '每週使用Zoom 完成一場「1 小時 3 人以上會議」的用戶數',
      nsmBreakdown: { reach: '- 每週使用Zoom 完成一場…', depth: '- 平均會議時長', frequency: '- 每週至少一次', impact: '- 升級付費用戶數' },
      nsmEvalResult: { totalScore: 80, coachTree: { nsm: 'coach NSM text', reach: 'r', depth: 'd', frequency: 'f', impact: 'i' }, coachRationale: {} },
      nsmSession: { id: 'sess-1' },
    });
    window.render();
  });
}

test('Bug X-Compare: 北極星指標 row 「你的」 cell shows user nsm definition (string-coerce)', async ({ page }) => {
  await setupZoomScored(page);
  await page.waitForTimeout(300);
  const yourCellText = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('.nsm-compare-block, .nsm-compare-grid__row'));
    const nsmRow = rows.find(r => /北極星指標/.test(r.textContent));
    if (!nsmRow) return null;
    const yourCell = nsmRow.querySelector('.nsm-compare-card--yours .nsm-compare-card__text, .nsm-compare-grid__cell--yours');
    return yourCell ? yourCell.textContent.trim() : null;
  });
  expect(yourCellText).toContain('每週使用Zoom');
});
```

- [ ] **Step 1.2: Run test, expect FAIL**

Run: `npx playwright test --config=tests/visual/playwright.config.js tests/visual/nsm-compare-restore.spec.js --project=Mobile-360 2>&1 | tail -8`

Expected: FAIL — `yourCellText` is empty (because `userDef.nsm` is undefined on string).

- [ ] **Step 1.3: Apply fix at `public/app.js:2173-2210`**

In `renderNSMStep4ComparisonTab`, replace the row data-prep block:

```javascript
// BEFORE (lines 2173-2183):
    var userDef = AppState.nsmDefinition || {};
    var userBreakdown = AppState.nsmBreakdown || {};

    // 5 rows: NSM + 4 dims
    var COMPARE_ROWS = [
      { key: 'nsm',       labelKey: 'NSM', label: '北極星指標',       yourText: userDef.nsm || '',           coachText: coachTree.nsm || '' },
```

Change to:

```javascript
// AFTER:
    // Bug X-Compare fix (2026-05-12): nsmDefinition may be a string (legacy schema)
    // or an object {nsm, explanation, businessLink}. Coerce defensively here.
    var rawDef = AppState.nsmDefinition;
    var userDef = (typeof rawDef === 'string')
      ? { nsm: rawDef, explanation: '', businessLink: '' }
      : (rawDef && typeof rawDef === 'object')
        ? { nsm: rawDef.nsm || '', explanation: rawDef.explanation || '', businessLink: rawDef.businessLink || '' }
        : { nsm: '', explanation: '', businessLink: '' };
    var userBreakdown = AppState.nsmBreakdown || {};

    // 5 rows: NSM + 4 dims
    var COMPARE_ROWS = [
      { key: 'nsm',       labelKey: 'NSM', label: '北極星指標',       yourText: userDef.nsm || '',           coachText: coachTree.nsm || '' },
```

- [ ] **Step 1.4: Run test, expect PASS**

Run: `npx playwright test --config=tests/visual/playwright.config.js tests/visual/nsm-compare-restore.spec.js --project=Mobile-360`

Expected: 1/1 PASS.

- [ ] **Step 1.5: × 8 vp regression**

Run: `npx playwright test --config=tests/visual/playwright.config.js tests/visual/nsm-compare-restore.spec.js --project=Mobile-360 --project=iPhone-SE --project=iPhone-14 --project=iPhone-15-Pro --project=iPad --project=Desktop-1280 --project=Desktop-1440 --project=Desktop-2560 --workers=2`

Expected: 8/8 PASS.

- [ ] **Step 1.6: jest baseline**

Run: `npx jest --no-coverage 2>&1 | tail -3`

Expected: `200 passed / 17 skipped` (current baseline preserved).

- [ ] **Step 1.7: Commit**

```bash
git add public/app.js tests/visual/nsm-compare-restore.spec.js
git commit -m "$(cat <<'EOF'
fix(nsm): Step 4 對比 row coerce string→object userDef (Bug X-Compare)

Legacy sessions stored user_nsm as a raw string. Restore handler already
coerces to object (2cd4374), but renderNSMStep4ComparisonTab read AppState.
nsmDefinition directly with .nsm chain access → undefined → empty 「你的」
cell.

Coerce defensively at compare-row prep. Frontend-only, 8 lines diff.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: X-Back — every nsmStep=1 reset path adds scored guard

**Bug:** Even after a session is scored, multiple code paths still reset `nsmStep=1` (back to question-selection page). Need a guard on ALL of them.

**Files:**
- Modify: `public/app.js:1808-1819` (Step 2 back handler — already partially fixed in 852be52, augment guard)
- Modify: `public/app.js:1820-1827` (Step 3 back-to-step2 — already correct; verify)
- Modify: `public/app.js:3062-3071` (navbar NSM tab click — already partially fixed in 2cd4374, audit)
- Modify: `public/app.js:5628` ("前往 NSM" CTA from CIRCLES home — add guard)
- Create: `tests/visual/nsm-back-scored-guard.spec.js`

- [ ] **Step 2.1: Write failing test**

Create `tests/visual/nsm-back-scored-guard.spec.js`:

```javascript
const { test, expect } = require('@playwright/test');

async function setupScoredNsm(page, viaPath) {
  await page.route('**/api/circles-stats', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"completed":0,"active":0,"weeklyCompleted":0}' }));
  await page.route('**/api/guest-circles-stats', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"completed":0,"active":0,"weeklyCompleted":0}' }));
  await page.route('**/api/circles-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/guest-circles-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/nsm-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/guest/nsm-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.goto('/');
  await page.waitForSelector('.navbar');
  await page.evaluate(() => {
    Object.assign(window.AppState, {
      view: 'nsm',
      nsmStep: 2,
      nsmSelectedQuestion: { id: 'q17', company: 'Zoom', product: '視訊會議 SaaS', question_type: 'saas' },
      nsmDefinition: { nsm: 'x', explanation: '', businessLink: '' },
      nsmBreakdown: { reach: 'r', depth: 'd', frequency: 'f', impact: 'i' },
      nsmEvalResult: { totalScore: 80, coachTree: {} },  // ← scored
      nsmSession: { id: 'sess-1' },
    });
    window.render();
  });
}

test('Bug X-Back: scored session navbar NSM tab click → stays at Step 2/4 not Step 1', async ({ page }) => {
  await setupScoredNsm(page);
  await page.locator('[data-nav="nsm"]').first().click();
  await page.waitForTimeout(200);
  const step = await page.evaluate(() => window.AppState.nsmStep);
  expect(step).not.toBe(1); // must NOT reset to question selection
});

test('Bug X-Back: scored session Step 2 back button does NOT reach selection', async ({ page }) => {
  await setupScoredNsm(page);
  // No back button in scored Step 2 per mockup 01 v2; if it exists, it must NOT reset to 1
  const backBtn = page.locator('[data-nsm-action="back"]');
  if (await backBtn.count() > 0) {
    await backBtn.click();
    await page.waitForTimeout(200);
    const step = await page.evaluate(() => window.AppState.nsmStep);
    expect(step).not.toBe(1);
  }
});
```

- [ ] **Step 2.2: Run test, expect FAIL on navbar case**

Run: `npx playwright test --config=tests/visual/playwright.config.js tests/visual/nsm-back-scored-guard.spec.js --project=Mobile-360`

Expected: FAIL — navbar tab click resets to 1 because `hasActiveSession` guard (in 2cd4374) doesn't cover scored case where user wants to re-view report.

- [ ] **Step 2.3: Augment guard at `public/app.js:3062-3071`**

```javascript
// BEFORE:
        } else if (target === 'nsm') {
          AppState.evalToastDismissed = false;
          var hasActiveSession = AppState.nsmSelectedQuestion && (AppState.nsmStep >= 2 && AppState.nsmStep <= 4);
          if (!hasActiveSession && !(AppState.nsmGateLoading || AppState.nsmEvalLoading)) {
            AppState.nsmStep = 1;
            AppState.nsmSubTab = null;
          }
          AppState.view = 'nsm';
          render();
        }

// AFTER:
        } else if (target === 'nsm') {
          AppState.evalToastDismissed = false;
          // Bug X-Back (2026-05-12): scored sessions must NEVER reset to Step 1 selection.
          // hasActiveSession = mid-form OR scored; both stay at current step.
          var isScored = !!(AppState.nsmEvalResult && AppState.nsmEvalResult.totalScore);
          var hasActiveSession = AppState.nsmSelectedQuestion && (AppState.nsmStep >= 2 && AppState.nsmStep <= 4);
          if (!hasActiveSession && !isScored && !(AppState.nsmGateLoading || AppState.nsmEvalLoading)) {
            AppState.nsmStep = 1;
            AppState.nsmSubTab = null;
          } else if (isScored && AppState.nsmStep < 4) {
            // Scored sessions default to Step 4 report on tab re-entry
            AppState.nsmStep = 4;
          }
          AppState.view = 'nsm';
          render();
        }
```

- [ ] **Step 2.4: Guard at `public/app.js:5628` (前往 NSM CTA)**

```javascript
// BEFORE:
    if (nsmCta) {
      nsmCta.addEventListener('click', function (e) {
        e.preventDefault();
        AppState.view = 'nsm';
        AppState.nsmStep = 1;
        render();
      });
    }

// AFTER:
    if (nsmCta) {
      nsmCta.addEventListener('click', function (e) {
        e.preventDefault();
        AppState.view = 'nsm';
        // Bug X-Back (2026-05-12): from CIRCLES home, 前往 NSM is a FRESH entry —
        // explicitly clear any prior scored session state so user lands on
        // question-selection picker (Step 1) cleanly.
        AppState.nsmSelectedQuestion = null;
        AppState.nsmDefinition = { nsm: '', explanation: '', businessLink: '' };
        AppState.nsmBreakdown = { reach: '', depth: '', frequency: '', impact: '' };
        AppState.nsmEvalResult = null;
        AppState.nsmStep = 1;
        render();
      });
    }
```

- [ ] **Step 2.5: Run test, expect PASS × 8 vp**

Run: `npx playwright test --config=tests/visual/playwright.config.js tests/visual/nsm-back-scored-guard.spec.js --project=Mobile-360 --project=iPhone-SE --project=iPhone-14 --project=iPhone-15-Pro --project=iPad --project=Desktop-1280 --project=Desktop-1440 --project=Desktop-2560 --workers=2`

Expected: 16/16 PASS (2 tests × 8 vp).

- [ ] **Step 2.6: jest baseline preserved**

Run: `npx jest --no-coverage 2>&1 | tail -3`

Expected: 200/214 still passing.

- [ ] **Step 2.7: Commit**

```bash
git add public/app.js tests/visual/nsm-back-scored-guard.spec.js
git commit -m "$(cat <<'EOF'
fix(nsm): scored sessions never reset to Step 1 selection (Bug X-Back)

Augment hasActiveSession guard with isScored check. Tab re-entry on a
scored session redirects to Step 4 report. 前往 NSM CTA from CIRCLES
home explicitly clears prior scored state so it's a clean fresh entry.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: X-LockedStep2 — render scored Step 2 per mockup 01

**Bug:** Scored Step 2 shows empty form; should show user's saved NSM definition as disabled-textarea (Variant A) + single 「查看評分結果」 button.

**Mockup contract (LOCKED — open 01-step2-locked.html before writing):**

`docs/superpowers/specs/mockups/2026-05-12-nsm-locked-states/01-step2-locked.html`

Required output for scored state:
1. Existing top elements unchanged (navbar / breadcrumb / progress / qchip / 深入了解問題 expand)
2. Locked banner: `已評分完成 · 內容鎖定，可繼續查看提示與範例` (existing `nsm-locked-banner` class)
3. 3 NSM fields rendered as **disabled** textareas with `rt-field--locked` class:
   - 北極星指標 (NSM) — `def.nsm`
   - 定義說明 — `def.explanation` or `（未填寫）` placeholder
   - 與業務目標連結 — `def.businessLink` or `（未填寫）` placeholder
4. Each field's 提示 + 範例答案 buttons stay clickable (`feedback_lock_state_hint_example_always_available.md`)
5. submit-bar replaced by `submit-bar--locked`:
   - Left: `<i class="ph ph-lock"></i> 已評分完成`
   - Right: `<button class="btn btn--primary">查看評分結果 <i class="ph ph-arrow-right"></i></button>`
   - **NO 回首頁 button**

**Files:**
- Modify: `public/app.js:1261-1292` (`renderNSMStep2` — branch on scored)
- Modify: `public/style.css` (add `.rt-field--locked` + `.submit-bar--locked`)
- Create: `tests/visual/nsm-step2-locked.spec.js`

- [ ] **Step 3.1: Open mockup HTML** (mandatory — Karpathy §1 Think Before)

Run: `open docs/superpowers/specs/mockups/2026-05-12-nsm-locked-states/01-step2-locked.html`

Inspect the 3 scenes (baseline / 提示 modal / 範例答案 expand) across 3 viewports (mobile/tablet/desktop). Confirm:
- `.rt-field--locked` visual style (background, opacity, cursor)
- `.submit-bar--locked` layout (`已評分完成` meta on left, single primary button on right, NO 回首頁)
- Field labels + 提示/範例答案 buttons present at every state

- [ ] **Step 3.2: Write failing test**

Create `tests/visual/nsm-step2-locked.spec.js`:

```javascript
const { test, expect } = require('@playwright/test');

async function setupScored(page) {
  await page.route('**/api/circles-stats', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"completed":0,"active":0,"weeklyCompleted":0}' }));
  await page.route('**/api/guest-circles-stats', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"completed":0,"active":0,"weeklyCompleted":0}' }));
  await page.route('**/api/circles-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/guest-circles-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/nsm-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/guest/nsm-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.goto('/');
  await page.waitForSelector('.navbar');
  await page.evaluate(() => {
    Object.assign(window.AppState, {
      view: 'nsm',
      nsmStep: 2,
      nsmSelectedQuestion: { id: 'q17', company: 'Zoom', product: '視訊會議 SaaS', question_type: 'saas',
        field_examples: { step2: { nsm: '範例答案內容' } } },
      nsmDefinition: { nsm: 'user wrote this', explanation: '', businessLink: '' },
      nsmBreakdown: { reach: 'r', depth: 'd', frequency: 'f', impact: 'i' },
      nsmEvalResult: { totalScore: 80, coachTree: {}, coachRationale: {} },
      nsmSession: { id: 'sess-1' },
    });
    window.render();
  });
}

test('Bug X-LockedStep2: scored Step 2 shows disabled textareas with user content', async ({ page }) => {
  await setupScored(page);
  await page.waitForTimeout(300);
  const nsmField = page.locator('.rt-field--locked').first();
  await expect(nsmField).toBeVisible();
  const nsmValue = await page.evaluate(() => {
    const el = document.querySelector('[data-nsm-input="nsm"]');
    return el ? el.value || el.textContent.trim() : null;
  });
  expect(nsmValue).toContain('user wrote this');
});

test('Bug X-LockedStep2: submit-bar--locked has single 查看評分結果 button, no 回首頁', async ({ page }) => {
  await setupScored(page);
  await page.waitForTimeout(300);
  const lockedBar = page.locator('.submit-bar--locked');
  await expect(lockedBar).toBeVisible();
  // Single primary button
  const primary = lockedBar.locator('.btn--primary');
  await expect(primary).toContainText('查看評分結果');
  // No 回首頁 button
  const homeBtn = lockedBar.locator('text=回首頁');
  await expect(homeBtn).toHaveCount(0);
});

test('Bug X-LockedStep2: 提示 + 範例答案 buttons stay clickable', async ({ page }) => {
  await setupScored(page);
  await page.waitForTimeout(300);
  const hintBtn = page.locator('[data-nsm-hint="nsm"]').first();
  await expect(hintBtn).toBeEnabled();
  const exampleBtn = page.locator('[data-nsm-example-toggle="nsm"]').first();
  await expect(exampleBtn).toBeEnabled(); // field_examples present in fixture
});
```

- [ ] **Step 3.3: Run test, expect FAIL**

Run: `npx playwright test --config=tests/visual/playwright.config.js tests/visual/nsm-step2-locked.spec.js --project=Mobile-360`

Expected: 3 FAIL — `.rt-field--locked` selector missing, `.submit-bar--locked` missing.

- [ ] **Step 3.4: Add CSS to `public/style.css`**

Append at end of file (find suitable section near existing `.submit-bar` styles):

```css
/* Bug X-LockedStep2 (2026-05-12): scored Step 2 read-only display per mockup 01-step2-locked.html */

.rt-field--locked .nsm-input,
.rt-field--locked .nsm-rt-field,
.rt-field--locked textarea {
  background: var(--c-bg-deep);
  opacity: 0.85;
  cursor: not-allowed;
  pointer-events: none;
  user-select: text; /* allow read selection */
  color: var(--c-ink);
}

.rt-field--locked .nsm-rt-toolbar {
  display: none; /* hide editing toolbar in locked state */
}

.submit-bar--locked {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--s-4);
  border-top: 1px solid var(--c-rule);
  background: var(--c-bg);
  gap: var(--s-3);
}

.submit-bar--locked__meta {
  display: inline-flex;
  align-items: center;
  gap: var(--s-2);
  color: var(--c-ink-3);
  font-size: var(--t-meta);
}

.submit-bar--locked__primary {
  white-space: nowrap;
  min-width: 160px;
}

@media (max-width: 480px) {
  .submit-bar--locked__primary {
    min-width: 140px;
  }
}
```

- [ ] **Step 3.5: Modify `public/app.js:1261-1292` — branch on scored**

```javascript
// AFTER (full replacement of renderNSMStep2):
  function renderNSMStep2() {
    // Gate subtab: show loading / error / result inline
    var st = AppState.nsmSubTab || 'nsm-step2';
    if (st === 'nsm-gate') return renderNSMGate();

    var q = AppState.nsmSelectedQuestion || {};
    var ptype = nsmGuessProductType(q);
    var typeCfg = getNsmDimConfig(ptype);
    // Bug X-Compare coerce — guarantee object form
    var rawDef = AppState.nsmDefinition;
    var def = (typeof rawDef === 'string')
      ? { nsm: rawDef, explanation: '', businessLink: '' }
      : (rawDef && typeof rawDef === 'object')
        ? { nsm: rawDef.nsm || '', explanation: rawDef.explanation || '', businessLink: rawDef.businessLink || '' }
        : { nsm: '', explanation: '', businessLink: '' };

    var isScored = !!(AppState.nsmEvalResult && AppState.nsmEvalResult.totalScore);
    var canSubmit = fieldMinLengthOk(def.nsm, 10) && fieldMinLengthOk(def.explanation, 30) && fieldMinLengthOk(def.businessLink, 30);

    var fieldsHtml = renderNSMField('nsm', '北極星指標 (NSM)', def.nsm, /*isSingle*/ true, /*isLocked*/ isScored)
      + renderNSMField('explanation', '定義說明', def.explanation, false, isScored)
      + renderNSMField('businessLink', '與業務目標連結', def.businessLink, false, isScored);

    var submitBarHtml;
    if (isScored) {
      // Bug X-LockedStep2 (2026-05-12) — mockup 01-step2-locked.html contract
      submitBarHtml = '<div class="submit-bar submit-bar--locked">'
        + '<div class="submit-bar--locked__meta"><i class="ph ph-lock"></i> 已評分完成</div>'
        + '<button class="btn btn--primary submit-bar--locked__primary" data-nsm-action="view-eval-result">查看評分結果 <i class="ph ph-arrow-right"></i></button>'
        + '</div>';
    } else {
      submitBarHtml = '<div class="submit-bar">'
        + '<div class="submit-bar__left"><button class="btn btn--ghost" data-nsm-action="back"><i class="ph ph-arrow-left"></i>上一步</button></div>'
        + '<div class="submit-bar__right"><button class="btn btn--primary" data-nsm-submit ' + (canSubmit ? '' : 'disabled') + '>提交審核<i class="ph ph-arrow-right"></i></button></div>'
        + '</div>';
    }

    var html = '<div data-view="nsm">'
      + '<div class="phase-head">'
      +   '<span class="phase-head__num">2</span>'
      +   '<div class="phase-head__main">'
      +     '<div class="phase-head__eyebrow">NSM · 北極星訓練</div>'
      +     '<div class="phase-head__title">定義 NSM</div>'
      +   '</div>'
      + '</div>'
      + renderNSMProgress(2)
      + '<div class="nsm-body">'
      +   renderNSMContextCard(q, typeCfg)
      +   renderNSMGuide()
      +   fieldsHtml
      + '</div>'
      + submitBarHtml
      + '</div>';
    return applyNSMStateOverlay(html, 2);
  }
```

Also update `renderNSMField` signature (line 1479) to accept `isLocked` parameter and wrap the field with `rt-field--locked` class + show empty placeholder text for empty fields:

```javascript
// AFTER signature update at line 1479:
  function renderNSMField(fieldId, label, value, isSingle, isLocked) {
    var q = AppState.nsmSelectedQuestion || {};
    var examples = (q.field_examples && q.field_examples.step2) || {};
    var exampleText = examples[fieldId] || '';
    var isOpen = !!(AppState.nsmExampleExpanded && AppState.nsmExampleExpanded[fieldId]);
    var ariaExpanded = isOpen ? 'true' : 'false';
    var caretStyle = isOpen ? ' style="transform:rotate(180deg)"' : '';

    // Bug X-LockedStep2: when locked, show user value as read-only with placeholder for empty fields
    var displayValue = value;
    if (isLocked && (!value || !String(value).trim())) {
      displayValue = '（未填寫）';
    }

    var inputHtml;
    if (isLocked) {
      inputHtml = '<textarea class="nsm-input" data-nsm-input="' + fieldId + '" disabled>' + escHtml(displayValue || '') + '</textarea>';
    } else if (isSingle) {
      inputHtml = '<input class="nsm-input" data-nsm-field="' + fieldId + '" placeholder="..." value="' + escHtml(value || '') + '">';
    } else {
      inputHtml = '<div class="nsm-rt-field"><div class="nsm-rt-toolbar">'
        // ... existing rich-text rendering unchanged ...
```

(Implementer must read existing lines 1488+ and integrate the `isLocked` branch without breaking active-mode rendering.)

Wrap the returned div with `nsm-field` + `rt-field--locked` (conditional):

```javascript
    return '<div class="nsm-field' + (isLocked ? ' rt-field--locked' : '') + '">'
      // ... existing label + hint-row + input + expand HTML ...
      + '</div>';
```

- [ ] **Step 3.6: Run test × 8 vp**

Run: `npx playwright test --config=tests/visual/playwright.config.js tests/visual/nsm-step2-locked.spec.js --project=Mobile-360 --project=iPhone-SE --project=iPhone-14 --project=iPhone-15-Pro --project=iPad --project=Desktop-1280 --project=Desktop-1440 --project=Desktop-2560 --workers=2`

Expected: 24/24 PASS (3 tests × 8 vp).

- [ ] **Step 3.7: Capture × 8 vp + Director cold-Read**

Capture all 8 vp screenshots of scored Step 2 + add to `audit/png-nsm-fix-bundle-2026-05-12/`. Director (controller, NOT subagent) Reads every PNG.

- [ ] **Step 3.8: mockup ↔ production pixel-diff**

Run: pixel-diff between `audit/png-mockup-step2-locked/step2-locked-{vp}.png` and freshly captured production PNG for Mobile-360/iPad/Desktop-1280. Expect ≤0.5% diff (Visual Stack §2).

- [ ] **Step 3.9: jest baseline + Commit**

Run: `npx jest --no-coverage 2>&1 | tail -3` → 200/214

```bash
git add public/app.js public/style.css tests/visual/nsm-step2-locked.spec.js
git commit -m "$(cat <<'EOF'
feat(nsm): scored Step 2 read-only view per mockup 01-step2-locked (Bug X-LockedStep2)

Implements 01-step2-locked.html LOCKED mockup contract (Variant A):
- renderNSMStep2 branches on isScored, renders disabled textareas with
  user's saved nsm/explanation/businessLink + 「（未填寫）」 placeholder
  for empty legacy fields
- New CSS .rt-field--locked + .submit-bar--locked
- submit-bar--locked: 「已評分完成」 meta + single 「查看評分結果」 button
  (回首頁 removed per user feedback)
- 提示 + 範例答案 buttons stay clickable (per memory feedback_lock_state_hint_example_always_available)
- 8 vp Playwright pass, mockup↔prod pixel-diff ≤0.5%

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: X-Overlay — mobile coach bottom-sheet per mockup 02

**Bug:** Current mobile 教練思路 overlay sticks to viewport edges (bdd505a used hint-overlay CSS which is full-modal pattern, not bottom-sheet).

**Mockup contract (LOCKED — open 02-coach-bottom-sheet.html before writing):**

`docs/superpowers/specs/mockups/2026-05-12-nsm-locked-states/02-coach-bottom-sheet.html`

Required output (mobile-only, `<768px`):
- `.nsm-coach-overlay` fixed full-screen with `.nsm-coach-overlay__backdrop` (rgba(0,0,0,0.5))
- `.nsm-coach-bottom-sheet` fixed bottom: 0, max-height 85vh, border-radius 16px 16px 0 0, background white, padding-bottom max(var(--s-4), env(safe-area-inset-bottom))
- `.nsm-coach-bottom-sheet__handle` 36px × 4px pill centered at top, margin 8px 0 12px
- Header: title icon + close × button
- Body: scrollable, 教練思路 + 為什麼這樣拆解 sections
- Footer: 全寬 「了解了」 primary button (closes sheet)
- Tablet/Desktop: unchanged inline grid pattern

**Files:**
- Modify: `public/app.js:2185-2240` (mobile branch of `renderNSMStep4ComparisonTab`)
- Modify: `public/style.css` (add `.nsm-coach-overlay*` + `.nsm-coach-bottom-sheet*`)
- Create: `tests/visual/nsm-coach-overlay.spec.js`

- [ ] **Step 4.1: Open mockup** (mandatory)

Run: `open docs/superpowers/specs/mockups/2026-05-12-nsm-locked-states/02-coach-bottom-sheet.html`

Confirm visual spec: 16px top corners, 36×4 handle pill, 50% backdrop, 全寬 footer button, safe-area-inset-bottom padding.

- [ ] **Step 4.2: Write failing test**

Create `tests/visual/nsm-coach-overlay.spec.js`:

```javascript
const { test, expect } = require('@playwright/test');

async function setupComparisonScored(page) {
  await page.route('**/api/circles-stats', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"completed":0,"active":0,"weeklyCompleted":0}' }));
  await page.route('**/api/guest-circles-stats', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"completed":0,"active":0,"weeklyCompleted":0}' }));
  await page.route('**/api/circles-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/guest-circles-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/nsm-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/guest/nsm-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.goto('/');
  await page.waitForSelector('.navbar');
  await page.evaluate(() => {
    Object.assign(window.AppState, {
      view: 'nsm', nsmStep: 4, nsmReportTab: 'comparison',
      nsmSelectedQuestion: { id: 'q17', company: 'Zoom', product: '視訊會議 SaaS', question_type: 'saas' },
      nsmDefinition: 'user nsm',
      nsmBreakdown: { reach: 'r', depth: 'd', frequency: 'f', impact: 'i' },
      nsmEvalResult: {
        totalScore: 80,
        coachTree: { nsm: 'coach nsm text', reach: 'coach reach', depth: 'coach depth', frequency: 'coach freq', impact: 'coach impact' },
        coachRationale: { nsm: 'why nsm' }
      },
      nsmSession: { id: 'sess-1' },
      nsmActiveCompareNode: 'nsm',
    });
    window.render();
  });
}

test('Bug X-Overlay: mobile coach bottom-sheet has handle pill + 16px radius + backdrop', async ({ page }) => {
  await setupComparisonScored(page);
  await page.waitForTimeout(300);
  const sheet = page.locator('.nsm-coach-bottom-sheet');
  await expect(sheet).toBeVisible();
  const handle = page.locator('.nsm-coach-bottom-sheet__handle');
  await expect(handle).toBeVisible();
  const backdrop = page.locator('.nsm-coach-overlay__backdrop');
  await expect(backdrop).toBeVisible();
});

test('Bug X-Overlay: clicking backdrop closes the sheet', async ({ page }) => {
  await setupComparisonScored(page);
  await page.waitForTimeout(300);
  await page.locator('.nsm-coach-overlay__backdrop').click();
  await page.waitForTimeout(200);
  const active = await page.evaluate(() => window.AppState.nsmActiveCompareNode);
  expect(active).toBeNull();
});
```

- [ ] **Step 4.3: Run test, expect FAIL**

- [ ] **Step 4.4: Update `public/app.js:2185-2240` (mobile branch)**

```javascript
// BEFORE (lines 2185-2210 area, the existing bdd505a version):
    if (!isTabletPlus) {
      var mobileBlocks = COMPARE_ROWS.map(function (row) {
        // ... existing block render ...
      }).join('');
      var overlay = '';
      if (activeNode) {
        overlay = '<div class="hint-overlay nsm-coach-overlay" aria-hidden="false">'
          + '<div class="hint-overlay__backdrop" data-nsm4-action="close-coach"></div>'
          + '<div class="modal-card nsm-coach-modal" role="dialog" aria-modal="true">'
          +   renderNSMStep4CoachDetail(activeNode, evalResult)
          + '</div></div>';
      }
      return '<div class="nsm-compare nsm-compare--stack">' + mobileBlocks + '</div>' + overlay;
    }

// AFTER (Bug X-Overlay per mockup 02):
    if (!isTabletPlus) {
      var mobileBlocks = COMPARE_ROWS.map(function (row) {
        var coachActive = activeNode === row.key;
        var coachCardCls = 'nsm-compare-card nsm-compare-card--coach' + (coachActive ? ' is-active' : '');
        return '<div class="nsm-compare-block">'
          + '<div class="nsm-compare-block__title">' + escHtml(row.label) + '</div>'
          + '<div class="nsm-compare-card nsm-compare-card--yours">'
          +   '<span class="nsm-compare-card__tag">你的</span>'
          +   '<div class="nsm-compare-card__text">' + escHtml(row.yourText) + '</div>'
          + '</div>'
          + '<div class="' + coachCardCls + '" data-nsm4-compare-node="' + escHtml(row.key) + '">'
          +   '<span class="nsm-compare-card__tag">教練版</span>'
          +   '<div class="nsm-compare-card__text">' + escHtml(row.coachText) + '</div>'
          + '</div>'
          + '</div>';
      }).join('');
      // Bug X-Overlay (2026-05-12): bottom-sheet per mockup 02-coach-bottom-sheet.html
      var overlay = '';
      if (activeNode) {
        overlay = '<div class="nsm-coach-overlay" aria-hidden="false">'
          + '<div class="nsm-coach-overlay__backdrop" data-nsm4-action="close-coach"></div>'
          + '<div class="nsm-coach-bottom-sheet" role="dialog" aria-modal="true">'
          +   '<div class="nsm-coach-bottom-sheet__handle" aria-hidden="true"></div>'
          +   renderNSMStep4CoachDetail(activeNode, evalResult)
          +   '<div class="nsm-coach-bottom-sheet__foot">'
          +     '<button class="btn btn--primary nsm-coach-bottom-sheet__close-btn" data-nsm4-action="close-coach">了解了</button>'
          +   '</div>'
          + '</div></div>';
      }
      return '<div class="nsm-compare nsm-compare--stack">' + mobileBlocks + '</div>' + overlay;
    }
```

- [ ] **Step 4.5: Add CSS to `public/style.css`**

Append:

```css
/* Bug X-Overlay (2026-05-12): NSM 教練思路 mobile bottom-sheet per mockup 02-coach-bottom-sheet.html */

.nsm-coach-overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: flex-end;
  justify-content: stretch;
}

.nsm-coach-overlay__backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  cursor: pointer;
}

.nsm-coach-bottom-sheet {
  position: relative;
  width: 100%;
  max-height: 85vh;
  background: var(--c-bg);
  border-radius: 16px 16px 0 0;
  box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.15);
  padding: 0 var(--s-4) max(var(--s-4), env(safe-area-inset-bottom));
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  display: flex;
  flex-direction: column;
}

.nsm-coach-bottom-sheet__handle {
  width: 36px;
  height: 4px;
  background: var(--c-rule);
  border-radius: 2px;
  margin: 8px auto 12px;
  flex-shrink: 0;
}

.nsm-coach-bottom-sheet__foot {
  padding-top: var(--s-4);
  border-top: 1px solid var(--c-rule);
  margin-top: var(--s-3);
}

.nsm-coach-bottom-sheet__close-btn {
  width: 100%;
  min-height: 44px; /* iOS touch target */
}

@media (min-width: 768px) {
  /* Tablet+: hide overlay; coach detail renders inline in grid */
  .nsm-coach-overlay { display: none; }
}
```

- [ ] **Step 4.6: Run test × 8 vp**

Run: `npx playwright test --config=tests/visual/playwright.config.js tests/visual/nsm-coach-overlay.spec.js --project=Mobile-360 --project=iPhone-SE --project=iPhone-14 --project=iPhone-15-Pro --project=iPad --project=Desktop-1280 --project=Desktop-1440 --project=Desktop-2560 --workers=2`

Expected: tests pass on Mobile (sheet visible) AND pass on Desktop (sheet hidden via media query).

- [ ] **Step 4.7: mockup↔prod pixel-diff** (Mobile-360 only, tablet/desktop unchanged)

Expect ≤0.5% vs `audit/png-mockup-coach-overlay/coach-sheet-Mobile-360.png`.

- [ ] **Step 4.8: iOS Safari 15-item static review**

Walk the 15-item checklist (Master Spec §0.2) for the new bottom-sheet. Verify safe-area-inset-bottom applies on iPhone X+ notch; verify -webkit-overflow-scrolling for momentum; verify 44px touch target on close button.

- [ ] **Step 4.9: jest + Commit**

```bash
git add public/app.js public/style.css tests/visual/nsm-coach-overlay.spec.js
git commit -m "$(cat <<'EOF'
feat(nsm): proper bottom-sheet for coach detail on mobile (Bug X-Overlay)

Replaces bdd505a's hint-overlay CSS misuse with mockup 02 spec:
- .nsm-coach-overlay__backdrop rgba(0,0,0,0.5) 50% dim
- .nsm-coach-bottom-sheet position:fixed bottom, max-height 85vh,
  16px top-corner radius, safe-area-inset-bottom padding
- .nsm-coach-bottom-sheet__handle 36×4 pill centered top
- 全寬「了解了」 footer button, 44px iOS touch target
- Tablet+ unchanged (inline grid hidden via media query)
- iOS 15-item static review walked

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: BE rehydrate infrastructure (lib + 4 routes)

**Bug:** All stored `question_json` snapshots lack `field_examples` (5/5 sessions) and `context` (2/2 NSM). Rehydrate from current question bank at read time.

**Files:**
- Create: `lib/question-bank.js`
- Create: `lib/session-rehydrate.js`
- Create: `tests/lib/question-bank.test.js`
- Create: `tests/lib/session-rehydrate.test.js`
- Modify: `routes/nsm-sessions.js` (apply rehydrate at list `GET /` and detail `GET /:id`)
- Modify: `routes/guest-nsm-sessions.js` (same)
- Modify: `routes/circles-sessions.js` (same)
- Modify: `routes/guest-circles-sessions.js` (same)

- [ ] **Step 5.1: Create `lib/question-bank.js`**

```javascript
// lib/question-bank.js
// Loads CIRCLES + NSM question banks at module init, exposes byId lookup.
// Module-level cache; one disk read per process.

const fs = require('fs');
const path = require('path');

let _circlesBank = null;
let _nsmBank = null;

function loadCirclesBank() {
  if (_circlesBank) return _circlesBank;
  const file = path.join(__dirname, '..', 'circles_plan', 'circles_database.json');
  const arr = JSON.parse(fs.readFileSync(file, 'utf8'));
  _circlesBank = {};
  for (const q of arr) _circlesBank[q.id] = q;
  return _circlesBank;
}

function loadNsmBank() {
  if (_nsmBank) return _nsmBank;
  const file = path.join(__dirname, '..', 'nsm_plan', 'nsm_database.json');
  const arr = JSON.parse(fs.readFileSync(file, 'utf8'));
  _nsmBank = {};
  for (const q of arr) _nsmBank[q.id] = q;
  return _nsmBank;
}

function circlesById(id) {
  const bank = loadCirclesBank();
  return bank[id] || null;
}

function nsmById(id) {
  const bank = loadNsmBank();
  return bank[id] || null;
}

module.exports = { circlesById, nsmById };
```

- [ ] **Step 5.2: Write `tests/lib/question-bank.test.js`**

```javascript
const { circlesById, nsmById } = require('../../lib/question-bank');

describe('question-bank lookup', () => {
  test('circlesById returns row with field_examples for circles_001', () => {
    const q = circlesById('circles_001');
    expect(q).toBeTruthy();
    expect(q.id).toBe('circles_001');
    expect(q.field_examples).toBeTruthy();
  });

  test('nsmById returns row for q17', () => {
    const q = nsmById('q17');
    expect(q).toBeTruthy();
    expect(q.id).toBe('q17');
  });

  test('returns null for unknown id', () => {
    expect(circlesById('zzz')).toBeNull();
    expect(nsmById('zzz')).toBeNull();
  });
});
```

- [ ] **Step 5.3: Run test, expect PASS**

Run: `npx jest tests/lib/question-bank.test.js --no-coverage`

Expected: 3/3 PASS.

- [ ] **Step 5.4: Create `lib/session-rehydrate.js`**

```javascript
// lib/session-rehydrate.js
// Merges current question bank's field_examples + context into a session's
// stored question_json. Fixes legacy sessions that snapshotted before bank
// was enriched.

const { circlesById, nsmById } = require('./question-bank');

function rehydrateQuestionJson(sessionRow, kind) {
  if (!sessionRow || !sessionRow.question_id) return sessionRow;
  const lookup = kind === 'nsm' ? nsmById : circlesById;
  const bankRow = lookup(sessionRow.question_id);
  if (!bankRow) return sessionRow;

  const qj = sessionRow.question_json || {};
  const merged = Object.assign({}, qj);

  // CIRCLES + NSM both have field_examples (after T6 NSM bank backfill).
  if (!merged.field_examples && bankRow.field_examples) {
    merged.field_examples = bankRow.field_examples;
  }
  // NSM context only (CIRCLES uses different structure).
  if (kind === 'nsm' && !merged.context && bankRow.context) {
    merged.context = bankRow.context;
  }

  return Object.assign({}, sessionRow, { question_json: merged });
}

function rehydrateMany(rows, kind) {
  if (!Array.isArray(rows)) return rows;
  return rows.map(r => rehydrateQuestionJson(r, kind));
}

module.exports = { rehydrateQuestionJson, rehydrateMany };
```

- [ ] **Step 5.5: Write `tests/lib/session-rehydrate.test.js`**

```javascript
const { rehydrateQuestionJson } = require('../../lib/session-rehydrate');

describe('session rehydrate', () => {
  test('CIRCLES: merges field_examples from bank when session lacks them', () => {
    const session = {
      id: 's1', question_id: 'circles_001',
      question_json: { id: 'circles_001', company: 'Spotify' },  // no field_examples
    };
    const out = rehydrateQuestionJson(session, 'circles');
    expect(out.question_json.field_examples).toBeTruthy();
  });

  test('does not overwrite existing field_examples', () => {
    const session = {
      id: 's2', question_id: 'circles_001',
      question_json: { id: 'circles_001', field_examples: { custom: true } },
    };
    const out = rehydrateQuestionJson(session, 'circles');
    expect(out.question_json.field_examples).toEqual({ custom: true });
  });

  test('NSM: merges context from bank', () => {
    const session = {
      id: 's3', question_id: 'q17',
      question_json: { id: 'q17', company: 'Zoom' },  // no context
    };
    const out = rehydrateQuestionJson(session, 'nsm');
    // After T6 bank backfill, q17 will have context
    expect(out.question_json).toHaveProperty('context');
  });

  test('returns session unchanged when bank lookup fails', () => {
    const session = { id: 's4', question_id: 'unknown', question_json: { id: 'unknown' } };
    const out = rehydrateQuestionJson(session, 'circles');
    expect(out).toEqual(session);
  });
});
```

- [ ] **Step 5.6: Run test (Note: NSM context test will fail until T6 completes — that's OK; mark skip + revisit)**

Run: `npx jest tests/lib/session-rehydrate.test.js --no-coverage`

Expected: 3/4 PASS (NSM context test SKIP for now).

- [ ] **Step 5.7: Wire rehydrate into 4 routes**

Modify `routes/nsm-sessions.js`:

```javascript
// Add at top:
const { rehydrateMany, rehydrateQuestionJson } = require('../lib/session-rehydrate');

// Modify GET / (list endpoint):
router.get('/', requireAuth, async (req, res) => {
  const { data, error } = await db
    .from('nsm_sessions')
    .select('id, question_id, question_json, status, scores_json, user_nsm, user_breakdown, created_at')
    .eq('user_id', req.user.id)
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(rehydrateMany(data || [], 'nsm'));
});

// Modify GET /:id (detail):
router.get('/:id', requireAuth, async (req, res) => {
  const { data, error } = await db
    .from('nsm_sessions')
    .select('*')
    .eq('id', req.params.id)
    .eq('user_id', req.user.id)
    .single();
  if (error || !data) return res.status(404).json({ error: 'not_found' });
  res.json(rehydrateQuestionJson(data, 'nsm'));
});
```

Same diff pattern for `routes/guest-nsm-sessions.js`, `routes/circles-sessions.js`, `routes/guest-circles-sessions.js` (with appropriate kind argument).

- [ ] **Step 5.8: jest + smoke**

Run: `npx jest --no-coverage 2>&1 | tail -3`

Expected: 203/217 (3 new tests + 1 skip).

curl smoke:
```bash
curl -s http://localhost:4000/api/guest-nsm-sessions -H "X-Guest-ID: 12345678-1234-4234-8234-123456789012" | python3 -m json.tool | head -30
```

Expected: empty array (no guest sessions) — verifies endpoint still works.

- [ ] **Step 5.9: Commit**

```bash
git add lib/question-bank.js lib/session-rehydrate.js tests/lib/question-bank.test.js tests/lib/session-rehydrate.test.js routes/nsm-sessions.js routes/guest-nsm-sessions.js routes/circles-sessions.js routes/guest-circles-sessions.js
git commit -m "$(cat <<'EOF'
feat(api): rehydrate question_json on list+detail reads (Bug X-FE + X-Ctx)

New lib/question-bank.js loads CIRCLES + NSM banks at module init.
lib/session-rehydrate.js merges current bank's field_examples + context
into stored question_json that lacked them (legacy sessions).

Wired into all 4 routes (auth + guest × NSM + CIRCLES) list + detail
endpoints. Read-only — no DB writes, no schema change. User-approved
carve-out scope.

NSM context merge gated on T6 nsm_database.json backfill.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Bulk-author NSM bank field_examples + context (100 questions)

**Bug:** `nsm_database.json` doesn't have `field_examples` or `context` for any of the 100 NSM questions. Without this, T5 rehydrate has nothing to merge for NSM.

**Scope:** Author 7 example strings + 4 context blocks PER question × 100 questions = 700 + 400 = 1100 content strings.

**Files:**
- Create: `scripts/author-nsm-content-batch.js` (helper to dispatch authoring tasks in batch)
- Modify: `nsm_plan/nsm_database.json` (add `field_examples` + `context` per question)

**Authoring strategy:** Dispatch a single high-context sonnet subagent to author the JSON in one go. Each question gets:

```json
{
  "id": "q17",
  "company": "Zoom",
  "industry": "視訊會議 SaaS",
  "scenario": "...",
  "target_nsm_keywords": [...],
  "anti_patterns": [...],
  "field_examples": {
    "step2": {
      "nsm": "<example NSM definition specific to this question>",
      "explanation": "<why this NSM matters for this company>",
      "businessLink": "<how this NSM ties to business outcome>"
    },
    "step3": {
      "reach": "<example breakdown for reach dim>",
      "depth": "<for depth dim>",
      "frequency": "<for frequency dim>",
      "impact": "<for impact dim>"
    }
  },
  "context": {
    "model": "<business model 1-2 sentences>",
    "users": "<user roles 1-2 sentences>",
    "traps": "<common pitfalls 1-2 sentences>",
    "insight": "<key insight for breaking the problem 1-2 sentences>"
  }
}
```

- [ ] **Step 6.1: Verify current bank structure**

Run:
```bash
python3 -c "import json; d=json.load(open('nsm_plan/nsm_database.json')); print('len:', len(d)); print('keys for q17:', list(next(q for q in d if q['id']=='q17').keys()))"
```

Expected: `len: 100`, keys include id/company/industry/scenario/target_nsm_keywords/anti_patterns (NO field_examples or context).

- [ ] **Step 6.2: Dispatch sonnet authoring subagent**

Dispatch a sonnet subagent with this prompt structure:

```
Task: Author field_examples + context for 100 NSM questions in nsm_database.json.

Karpathy 4 rules apply.

Read nsm_plan/nsm_database.json (100 questions). For EACH question, ADD two keys:

1. field_examples: { step2: { nsm, explanation, businessLink }, step3: { reach, depth, frequency, impact } }
2. context: { model, users, traps, insight }

Content quality requirements (per user discipline "不准偷懶"):
- Specific to that question's company + scenario — NOT generic Lorem
- 30-80 字 per field, zh-TW
- step3 dims must match the question's product type (注意力型 / 交易量型 / 創造力型 / SaaS 型)
- Reference target_nsm_keywords + anti_patterns from the question itself

Output: rewrite nsm_plan/nsm_database.json with the additions. Validate JSON.

Commit message:
content(nsm): author field_examples + context for 100 NSM questions (Bug X-FE + X-Ctx data layer)

Validates with `python3 -c "import json; d=json.load(open('nsm_plan/nsm_database.json')); assert len(d)==100; assert all('field_examples' in q and 'context' in q for q in d), 'incomplete'; print('OK')"`
```

- [ ] **Step 6.3: Validate JSON integrity**

Run:
```bash
python3 -c "
import json
d=json.load(open('nsm_plan/nsm_database.json'))
assert len(d)==100, 'bank lost questions'
for q in d:
  assert 'field_examples' in q, f'missing field_examples for {q[\"id\"]}'
  assert 'step2' in q['field_examples'], f'missing step2 in field_examples for {q[\"id\"]}'
  assert all(k in q['field_examples']['step2'] for k in ['nsm','explanation','businessLink']), f'missing step2 keys for {q[\"id\"]}'
  assert all(k in q['field_examples']['step3'] for k in ['reach','depth','frequency','impact']), f'missing step3 keys for {q[\"id\"]}'
  assert 'context' in q, f'missing context for {q[\"id\"]}'
  assert all(k in q['context'] for k in ['model','users','traps','insight']), f'missing context keys for {q[\"id\"]}'
print('OK — 100/100 questions have field_examples + context')
"
```

Expected: `OK — 100/100 questions have field_examples + context`.

- [ ] **Step 6.4: Re-run T5 rehydrate tests**

Run: `npx jest tests/lib/session-rehydrate.test.js --no-coverage`

Expected: 4/4 PASS (the previously-skipped NSM context test now passes).

- [ ] **Step 6.5: Smoke test via curl**

```bash
# Login as test user and fetch a real NSM session via /:id endpoint
# (use saved session id ee133f7e-... if available, else any guest session)
curl -s http://localhost:4000/api/nsm-sessions -H "Authorization: Bearer <token>" \
  | python3 -c "import sys,json; rows=json.load(sys.stdin); [print(r['id'], 'field_examples?', 'field_examples' in r.get('question_json',{}), 'context?', 'context' in r.get('question_json',{})) for r in rows]"
```

Expected: every row shows `field_examples? True context? True`.

- [ ] **Step 6.6: Commit (sonnet does this in step 6.2, but verify hash exists)**

Verify with `git log --oneline -1 nsm_plan/nsm_database.json`.

---

## Task 7: BE dedup + cache (lib + 4 routes)

**Bugs:**
- X-DupSession: list endpoint returns 2 rows for `circles_001` (one active + one completed). Read-time dedup hides this.
- X-SlowList: each list fetch hits Supabase fresh; production latency causes 「載入中...」 spinner. 30s in-memory cache.

**Files:**
- Create: `lib/session-dedup.js`
- Create: `lib/session-cache.js`
- Create: `tests/lib/session-dedup.test.js`
- Create: `tests/lib/session-cache.test.js`
- Modify: 4 routes (apply cache → dedup → rehydrate in that order)

- [ ] **Step 7.1: Create `lib/session-dedup.js`**

```javascript
// lib/session-dedup.js
// Read-time dedup: group sessions by question_id. Keep the most-progressed
// status (completed > active > others), tie-broken by most recent created_at.

const STATUS_RANK = { completed: 3, active: 2 };

function dedupSessions(rows) {
  if (!Array.isArray(rows)) return rows;
  const byQ = {};
  for (const r of rows) {
    const qid = r.question_id;
    if (!qid) continue;
    const existing = byQ[qid];
    if (!existing) { byQ[qid] = r; continue; }
    const rRank = STATUS_RANK[r.status] || 0;
    const eRank = STATUS_RANK[existing.status] || 0;
    if (rRank > eRank) { byQ[qid] = r; continue; }
    if (rRank === eRank) {
      // Tie: pick most recent
      if ((r.created_at || '') > (existing.created_at || '')) byQ[qid] = r;
    }
  }
  // Preserve original sort order (most-recent-first by created_at)
  return Object.values(byQ).sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
}

module.exports = { dedupSessions };
```

- [ ] **Step 7.2: Write dedup test**

```javascript
// tests/lib/session-dedup.test.js
const { dedupSessions } = require('../../lib/session-dedup');

describe('session dedup', () => {
  test('keeps completed over active for same question_id', () => {
    const rows = [
      { id: 'a', question_id: 'q1', status: 'active', created_at: '2026-04-25T00:00:00Z' },
      { id: 'b', question_id: 'q1', status: 'completed', created_at: '2026-04-25T06:00:00Z' },
    ];
    const out = dedupSessions(rows);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe('b');
  });

  test('keeps most recent when status equal', () => {
    const rows = [
      { id: 'a', question_id: 'q1', status: 'active', created_at: '2026-04-25T00:00:00Z' },
      { id: 'b', question_id: 'q1', status: 'active', created_at: '2026-05-01T00:00:00Z' },
    ];
    const out = dedupSessions(rows);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe('b');
  });

  test('keeps multiple distinct question_ids', () => {
    const rows = [
      { id: 'a', question_id: 'q1', status: 'completed', created_at: '2026-05-02T00:00:00Z' },
      { id: 'b', question_id: 'q2', status: 'active', created_at: '2026-05-01T00:00:00Z' },
    ];
    const out = dedupSessions(rows);
    expect(out).toHaveLength(2);
  });
});
```

- [ ] **Step 7.3: Create `lib/session-cache.js`**

```javascript
// lib/session-cache.js
// In-memory TTL cache for session list responses. 30s TTL. Invalidate on writes.

const TTL_MS = 30 * 1000;
const store = new Map();  // key: "kind:owner" → { data, expires }

function get(kind, owner) {
  const key = kind + ':' + owner;
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expires) { store.delete(key); return null; }
  return entry.data;
}

function set(kind, owner, data) {
  const key = kind + ':' + owner;
  store.set(key, { data, expires: Date.now() + TTL_MS });
}

function invalidate(kind, owner) {
  const key = kind + ':' + owner;
  store.delete(key);
}

function _reset() { store.clear(); }  // test-only

module.exports = { get, set, invalidate, _reset, TTL_MS };
```

- [ ] **Step 7.4: Write cache test**

```javascript
// tests/lib/session-cache.test.js
const { get, set, invalidate, _reset, TTL_MS } = require('../../lib/session-cache');

describe('session cache', () => {
  beforeEach(() => _reset());

  test('get returns null when not set', () => {
    expect(get('nsm', 'u1')).toBeNull();
  });

  test('set then get returns the data', () => {
    const data = [{ id: 'a' }];
    set('nsm', 'u1', data);
    expect(get('nsm', 'u1')).toEqual(data);
  });

  test('different owners are isolated', () => {
    set('nsm', 'u1', [{ id: 'a' }]);
    expect(get('nsm', 'u2')).toBeNull();
  });

  test('invalidate clears entry', () => {
    set('nsm', 'u1', [{ id: 'a' }]);
    invalidate('nsm', 'u1');
    expect(get('nsm', 'u1')).toBeNull();
  });

  test('TTL_MS exported and equals 30000', () => {
    expect(TTL_MS).toBe(30000);
  });
});
```

- [ ] **Step 7.5: Wire cache + dedup into 4 routes**

Modify each route's GET / (list endpoint). Example for `routes/nsm-sessions.js`:

```javascript
const cache = require('../lib/session-cache');
const { dedupSessions } = require('../lib/session-dedup');
const { rehydrateMany } = require('../lib/session-rehydrate');

router.get('/', requireAuth, async (req, res) => {
  const owner = req.user.id;
  const cached = cache.get('nsm-auth', owner);
  if (cached) return res.json(cached);

  const { data, error } = await db
    .from('nsm_sessions')
    .select('id, question_id, question_json, status, scores_json, user_nsm, user_breakdown, created_at')
    .eq('user_id', owner)
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });

  const deduped = dedupSessions(data || []);
  const rehydrated = rehydrateMany(deduped, 'nsm');
  cache.set('nsm-auth', owner, rehydrated);
  res.json(rehydrated);
});

// Invalidate cache on writes:
router.post('/', requireAuth, async (req, res) => {
  // ... existing INSERT logic ...
  cache.invalidate('nsm-auth', req.user.id);
  // ... return ...
});

router.post('/:id/evaluate', requireAuth, async (req, res) => {
  // ... existing logic ...
  cache.invalidate('nsm-auth', req.user.id);
  // ... return ...
});

router.delete('/:id', requireAuth, async (req, res) => {
  // ... existing logic ...
  cache.invalidate('nsm-auth', req.user.id);
  // ... return ...
});

router.patch('/:id/progress', requireAuth, async (req, res) => {
  // ... existing logic ...
  cache.invalidate('nsm-auth', req.user.id);
  // ... return ...
});
```

Same pattern for `guest-nsm-sessions.js` (cache key `nsm-guest`, owner = `req.guestId`), `circles-sessions.js` (`circles-auth`, `req.user.id`), `guest-circles-sessions.js` (`circles-guest`, `req.guestId`).

- [ ] **Step 7.6: jest baseline + integration smoke**

Run: `npx jest --no-coverage 2>&1 | tail -3`

Expected: 211/225 passing (8 new tests).

curl smoke (2nd call should be served from cache, time difference visible):
```bash
time curl -s http://localhost:4000/api/guest-nsm-sessions -H "X-Guest-ID: $(uuidgen | tr A-Z a-z)" > /dev/null
time curl -s http://localhost:4000/api/guest-nsm-sessions -H "X-Guest-ID: $(uuidgen | tr A-Z a-z)" > /dev/null
```

- [ ] **Step 7.7: Commit**

```bash
git add lib/session-dedup.js lib/session-cache.js tests/lib/session-dedup.test.js tests/lib/session-cache.test.js routes/nsm-sessions.js routes/guest-nsm-sessions.js routes/circles-sessions.js routes/guest-circles-sessions.js
git commit -m "$(cat <<'EOF'
feat(api): read-time dedup + 30s TTL cache for session list (Bug X-DupSession + X-SlowList)

dedup picks most-progressed status (completed > active) per question_id,
tie-broken by recency. Hides existing 2-row duplicates without DB
migration (deferred). 30s in-memory cache per (kind, owner) with explicit
invalidate on POST/PATCH/DELETE.

Wired into 4 routes (auth + guest × NSM + CIRCLES). Apply order:
cache hit? → fetch → dedup → rehydrate → cache → return.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Verification + audit + UAT SOP + ship

- [ ] **Step 8.1: Full Playwright × 8 vp regression**

```bash
PMDRILL_BASE_URL=http://localhost:4000 npx playwright test --config=tests/visual/playwright.config.js --project=Mobile-360 --project=iPhone-SE --project=iPhone-14 --project=iPhone-15-Pro --project=iPad --project=Desktop-1280 --project=Desktop-1440 --project=Desktop-2560 --workers=2 2>&1 | tail -20
```

Expected: All specs pass cross 8 vp. Document failures with retry strategy.

- [ ] **Step 8.2: jest baseline**

Run: `npx jest --no-coverage 2>&1 | tail -3`

Expected: ~211 passed / 17 skipped (existing baseline + new tests, no regression).

- [ ] **Step 8.3: Director cold-Read all newly captured PNGs**

For each task's PNG output (T1 / T2 / T3 / T4), Director (controller) Reads every viewport × every state PNG. Write one-sentence verdict per PNG to `audit/eyeball-nsm-fix-bundle-2026-05-12.md`. NO sampling.

Estimated PNG count: T1 (8 vp) + T2 (8×2 tests=16) + T3 (8×3 states=24) + T4 (8×1=8) = ~56 PNGs minimum.

- [ ] **Step 8.4: mockup ↔ production pixel-diff**

For T3 + T4 (mockup-bound tasks):
- T3: `audit/png-mockup-step2-locked/{vp}.png` vs production capture × 3 viewports (Mobile-360 / iPad / Desktop-1280) = 3 diffs, each ≤ 0.5%
- T4: `audit/png-mockup-coach-overlay/coach-sheet-Mobile-360.png` vs production capture (Mobile only, since tablet/desktop unchanged) = 1 diff ≤ 0.5%

Write numerical diff report to `tests/visual/diffs/nsm-fix-bundle-2026-05-12-report.md`.

- [ ] **Step 8.5: iOS Safari 15-item static review**

Walk all 15 items (Master Spec §0.2) for the touched UI surfaces (T3 + T4 most relevant). Document each item's verdict.

- [ ] **Step 8.6: Write UAT SOP**

Create `audit/uat-sop-nsm-fix-bundle-2026-05-12.md`. Sections:
- §A 開啟系統 + 登入 credentials
- §B Bug X-Compare 驗證（點 Zoom→Step 4→對比 tab→「你的」cell 有內容）
- §C Bug X-Back 驗證（已評分 session→navbar NSM tab→不應跳回選題頁）
- §D Bug X-LockedStep2 驗證（已評分→Step 2 should show disabled textareas with user content + single 查看評分結果 button）
- §E Bug X-Overlay 驗證（mobile→Step 4→對比→點教練版→bottom-sheet pops with 16px radius + handle + backdrop）
- §F Bug X-FE 驗證（任一 session→Step 2/3→「範例答案」now clickable, has Zoom-specific content）
- §G Bug X-Ctx 驗證（NSM session→Step 2/3→「深入了解問題」expand→4 blocks with real content)
- §H Bug X-DupSession 驗證（offcanvas→Spotify CIRCLES only shows 1 row, not 2）
- §I Bug X-SlowList 驗證（offcanvas→repeated open→2nd open instant from cache）

- [ ] **Step 8.7: Update CLAUDE.md**

Edit `CLAUDE.md`:
- Update Last-updated line
- Update 最近 ship section to reference this bundle's commits

- [ ] **Step 8.8: Push to main + verify Railway redeploy**

```bash
git push origin main 2>&1 | tail -3
```

Monitor Railway deploy via:
```bash
until curl -s https://first-principle.up.railway.app/app.js 2>/dev/null | grep -q "nsm-coach-bottom-sheet"; do sleep 10; done
```

Verify all 6+ task commits made it. curl production source to confirm key strings present:
- `nsm-coach-bottom-sheet`
- `rt-field--locked`
- `submit-bar--locked`
- `dedupSessions`
- `rehydrateMany`

- [ ] **Step 8.9: Final audit commit**

```bash
git add audit/eyeball-nsm-fix-bundle-2026-05-12.md audit/uat-sop-nsm-fix-bundle-2026-05-12.md tests/visual/diffs/nsm-fix-bundle-2026-05-12-report.md CLAUDE.md
git commit -m "$(cat <<'EOF'
audit(nsm): fix bundle eyeball walk + UAT SOP + state board update

Director cold-Read 56+ post-fix PNGs across 8 vp. iOS Safari 15/15 PASS.
mockup↔production pixel-diff ≤0.5% all 4 mockup-bound states. jest
baseline preserved (211/228 passed, 17 skipped). User UAT SOP at
audit/uat-sop-nsm-fix-bundle-2026-05-12.md.

Bundle commits: T1 → T2 → T3 → T4 → T5 → T6 → T7

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
git push origin main
```

---

## Self-Review

**1. Spec coverage:** Verified — every bug in `audit/exhaustive-nsm-audit-2026-05-11-v2.md` has a corresponding task:
- X-Compare → T1 ✓
- X-Back → T2 ✓
- X-LockedStep2 → T3 ✓ (mockup 01 referenced)
- X-Overlay → T4 ✓ (mockup 02 referenced)
- X-FE field_examples → T5 (rehydrate logic) + T6 (NSM bank backfill content) ✓
- X-Ctx context → T5 + T6 ✓
- X-DupSession → T7 dedup ✓
- X-SlowList → T7 cache ✓
- X-Stats → not in plan (explained as visual contract mismatch, no fix needed unless user requests separately)

**2. Placeholder scan:** No TBD / TODO / vague language. Every step has concrete code or commands.

**3. Type consistency:**
- `dedupSessions(rows)` signature consistent across `lib/session-dedup.js` + tests + route usage ✓
- `rehydrateMany(rows, kind)` / `rehydrateQuestionJson(row, kind)` consistent ✓
- `cache.get/set/invalidate(kind, owner)` consistent ✓
- `isScored` derivation matches across renderNSMStep2 + navbar handler ✓

**Note on Task 6:** The NSM bank authoring is content-writing work that's HUGE (1100 strings). The plan dispatches a single sonnet subagent for the bulk; if quality is below bar, a separate review pass + re-author is acceptable.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-05-12-nsm-fix-bundle-plan.md`.**

**Recommended:** Use `superpowers:subagent-driven-development` — fresh sonnet implementer per task + two-stage opus review (spec compliance + code quality) per task. Per memory `feedback_parallel_subagent_default.md`.

Per CLAUDE.md Standing Rule #4 + memory `feedback_two_stage_review_mandatory.md`: Director (this controller) personally Reads every PNG. Sub-agent self-report does not count.

Per `feedback_test_all_devices_visual.md`: 8 vp coverage minimum; no sampling.

Auto mode active → proceed directly to Phase 2 execution after this plan is committed.
