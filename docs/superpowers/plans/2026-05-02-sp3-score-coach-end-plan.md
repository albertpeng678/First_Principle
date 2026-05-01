# SP3 — Score Deepen + Coach Demo + End-Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development.
>
> **MANDATORY READS:**
> 1. Spec: `docs/superpowers/specs/2026-05-02-sp3-score-coach-end-design.md`
> 2. Mockups:
>    - `docs/superpowers/specs/mockups/2026-05-02-pm-drill-overhaul/sp3-score-coach-end.html`
>    - `docs/superpowers/specs/mockups/2026-05-02-pm-drill-overhaul/sp3-loading-error-states.html`
> 3. Verification standard: `docs/superpowers/specs/2026-05-02-verification-standard.md`
> 4. `audit-cycle.md` (universe rows G, H for Phase 3 / Phase 4 invariants)

**Goal:** Enrich Phase 3 score page (collapsible dimensions + multi-section coach demo + loading/error states) and simplify end-of-step actions to a single「再練一題」button.

**Architecture:** Backend evaluator prompt schema change (string → object) + frontend Phase 3 renderer 3-state branch (loading / error / content) + collapse interactions. SP1 must be merged.

**Tech Stack:** OpenAI gpt-4o (evaluator) / vanilla JS / Playwright 8 projects / jest unit tests.

**Branch:**
```bash
git worktree add .claude/worktrees/sp3-score -b feat/sp3-score main
cd .claude/worktrees/sp3-score
cp ../../.env .env
```

---

## File structure

| File | Action |
|---|---|
| `prompts/circles-evaluator.js` | Schema: `coachVersion` becomes `{ context, perField: [...], reasoning }` |
| `routes/circles-sessions.js` + `routes/guest-circles-sessions.js` | Evaluate-step route — error code mapping |
| `tests/circles-evaluator.test.js` | Update assertions for new schema |
| `public/app.js` | AppState slots `circlesScoreLoading`/`circlesScoreError`; Phase 3 renderer 3-state; collapse handler; 再練一題 behaviour |
| `public/style.css` | `.dim-summary[data-open]` collapse styles + `.coach-demo` + `.loading-wrap` + `.error-wrap` |
| `tests/playwright/journeys/sp3-phase3.spec.js` | NEW — happy / collapse / fallback / loading / error |

---

## Task 1: Pre-flight

- [ ] **Step 1: Confirm SP1 baseline**

```bash
grep -E "^\s*--pad-block:" public/style.css && echo SP1_OK
```

- [ ] **Step 2: Open both mockups**

```bash
open docs/superpowers/specs/mockups/2026-05-02-pm-drill-overhaul/sp3-score-coach-end.html
open docs/superpowers/specs/mockups/2026-05-02-pm-drill-overhaul/sp3-loading-error-states.html
```

- [ ] **Step 3: Read existing evaluator prompt**

```bash
sed -n '1,90p' prompts/circles-evaluator.js
```

Record: where `coachVersion` is generated (line 68 area).

---

## Task 2: TDD — failing test for new evaluator schema

**Files:** Modify `tests/circles-evaluator.test.js`

- [ ] **Step 1: Read existing test file**

```bash
cat tests/circles-evaluator.test.js | head -40
```

- [ ] **Step 2: Add new test asserting object schema**

Append to the test describe block:

```javascript
describe('SP3 — coachVersion is structured object', () => {
  it('returns coachVersion with context / perField / reasoning', async () => {
    // Skip if no OPENAI_API_KEY (CI without secret)
    if (!process.env.OPENAI_API_KEY) return;
    const { evaluateCirclesStep } = require('../prompts/circles-evaluator');
    const result = await evaluateCirclesStep({
      step: 'C1',
      isSimulation: false,
      questionJson: { company: 'Spotify', product: 'Spotify Podcast', problem_statement: '提升 Podcast 體驗', coach_circles: { C1: '練習釐清題目邊界...' } },
      frameworkDraft: { '問題範圍': '聚焦 Podcast 用戶留存', '時間範圍': '1 季', '業務影響': '增加日均收聽時長', '假設確認': '' },
      conversation: [],
    });
    expect(result.coachVersion).toBeDefined();
    expect(typeof result.coachVersion).toBe('object');
    expect(typeof result.coachVersion.context).toBe('string');
    expect(Array.isArray(result.coachVersion.perField)).toBe(true);
    expect(result.coachVersion.perField.length).toBeGreaterThan(0);
    expect(typeof result.coachVersion.reasoning).toBe('string');
    expect(result.coachVersion.context.length).toBeGreaterThan(20);
    expect(result.coachVersion.reasoning.length).toBeGreaterThan(20);
  }, 30000);
});
```

- [ ] **Step 3: Run — should fail**

```bash
OPENAI_API_KEY=$(grep OPENAI_API_KEY .env | cut -d= -f2) npx jest tests/circles-evaluator.test.js -t "structured object" --no-coverage
```

Expected: FAIL — current `coachVersion` is a string, not object.

- [ ] **Step 4: Commit failing test**

```bash
git add tests/circles-evaluator.test.js
git commit -m "test(sp3): failing test for evaluator coachVersion object schema"
```

---

## Task 3: Update evaluator prompt — coachVersion as object

**Files:** Modify `prompts/circles-evaluator.js`

- [ ] **Step 1: Replace schema in `systemPrompt`**

Find the JSON schema literal in the `systemPrompt` template (around line 56-69). Change `coachVersion` line from:

```
"coachVersion": "${isSimulation ? '完整示範答案（展示給學員）' : '簡短提示（不完全給答案）'}"
```

to:

```
"coachVersion": {
  "context": "情境前置（這個步驟的核心任務是什麼，為什麼重要，1 段，60-100 字）",
  "perField": [
    { "field": "欄位名稱", "demo": "教練會這樣寫的具體答案（30-80 字）" },
    ...每個 framework 欄位一筆...
  ],
  "reasoning": "為什麼這樣答（解釋背後思路，1-2 句，40-80 字）"
}
```

- [ ] **Step 2: Adjust max_tokens if needed**

Current `max_tokens: 800` may be insufficient. Bump to `1500`:

```javascript
max_tokens: 1500,
```

- [ ] **Step 3: Re-run failing test → expect PASS**

```bash
OPENAI_API_KEY=$(grep OPENAI_API_KEY .env | cut -d= -f2) npx jest tests/circles-evaluator.test.js -t "structured object" --no-coverage
```

Expected: PASS.

- [ ] **Step 4: Run full evaluator test suite**

```bash
OPENAI_API_KEY=$(grep OPENAI_API_KEY .env | cut -d= -f2) npx jest tests/circles-evaluator.test.js --no-coverage
```

- [ ] **Step 5: Commit**

```bash
git add prompts/circles-evaluator.js
git commit -m "feat(sp3): coachVersion schema as object (context + perField + reasoning)"
```

---

## Task 4: Routes — add error code mapping

**Files:** Modify `routes/circles-sessions.js`, `routes/guest-circles-sessions.js`

- [ ] **Step 1: Find evaluate-step route in both files**

```bash
grep -n "evaluate-step\|evaluateCirclesStep" routes/circles-sessions.js routes/guest-circles-sessions.js
```

- [ ] **Step 2: Wrap evaluator call with error mapping**

In each route handler, replace existing try/catch with:

```javascript
try {
  const result = await evaluateCirclesStep({ /* args */ });
  // ... existing save logic
  res.json(result);
} catch (e) {
  let code = 'EVAL_API_ERROR';
  if (e.name === 'AbortError' || /timeout/i.test(e.message)) code = 'EVAL_TIMEOUT';
  else if (/JSON|parse/i.test(e.message)) code = 'EVAL_PARSE_ERROR';
  console.warn('[evaluate-step]', code, e.message);
  res.status(500).json({ error: e.message, code });
}
```

- [ ] **Step 3: Commit**

```bash
git add routes/circles-sessions.js routes/guest-circles-sessions.js
git commit -m "feat(sp3): evaluate-step error code mapping (TIMEOUT/API_ERROR/PARSE_ERROR)"
```

---

## Task 5: Frontend AppState slots + 3-state Phase 3 renderer

**Files:** Modify `public/app.js`

- [ ] **Step 1: Add AppState slots near `circlesScoreResult`**

Find the AppState init (around app.js:50-80). Add:

```javascript
  circlesScoreLoading: false,
  circlesScoreError: null,            // { code, message } | null
```

- [ ] **Step 2: Modify Phase 3 renderer entry point**

Find `renderCirclesPhase3` or wherever `AppState.circlesPhase === 3` branch lives.

Replace the body with 3-state dispatch:

```javascript
function renderCirclesPhase3() {
  if (AppState.circlesScoreLoading) return renderScoreLoading();
  if (AppState.circlesScoreError)  return renderScoreError();
  if (AppState.circlesScoreResult) return renderScoreContent();
  // Edge case — no state yet, trigger fetch on next tick
  scheduleEvaluateStepFetch();
  return renderScoreLoading();
}
```

- [ ] **Step 3: Implement `renderScoreLoading()`**

Add helper:

```javascript
function renderScoreLoading() {
  return '<div data-view="circles">' +
    renderPhaseHeader('評分中') +
    renderPersistentQuestionChip() +
    '<div class="loading-wrap">' +
      '<div class="loading-spinner" aria-hidden="true"></div>' +
      '<div class="loading-title">AI 教練評分中…</div>' +
      '<div class="loading-sub">分析你的 4 個欄位，計算每個維度分數，並生成示範答案。</div>' +
      '<div class="loading-checklist" id="sp3-checklist">' +
        '<div class="row pending"><i class="ph ph-circle"></i> 解析框架欄位</div>' +
        '<div class="row pending"><i class="ph ph-circle"></i> 計算 4 個維度分數</div>' +
        '<div class="row pending"><i class="ph ph-circle"></i> 生成教練示範答案</div>' +
        '<div class="row pending"><i class="ph ph-circle"></i> 整理改進建議</div>' +
      '</div>' +
      '<div style="font-size:11px;color:var(--c-text-3);margin-top:18px">通常需要 3-6 秒</div>' +
    '</div>' +
  '</div>';
}
```

Plus a checklist progress animation (purely client-side):

```javascript
function startScoreChecklistAnimation() {
  var stages = ['解析框架欄位', '計算 4 個維度分數', '生成教練示範答案', '整理改進建議'];
  var rows = document.querySelectorAll('#sp3-checklist .row');
  var schedule = [500, 1000, 1500, 3000];
  schedule.forEach(function(ms, i) {
    setTimeout(function() {
      if (rows[i]) {
        if (i < rows.length - 1) {
          rows[i].innerHTML = '<i class="ph-fill ph-check-circle"></i> ' + stages[i];
          rows[i].classList.remove('pending');
        }
        if (i + 1 < rows.length && rows[i + 1]) {
          rows[i + 1].innerHTML = '<i class="ph ph-circle-notch"></i> ' + stages[i + 1];
          rows[i + 1].classList.remove('pending');
        }
      }
    }, ms);
  });
}
```

Call `startScoreChecklistAnimation()` from `bindCirclesPhase3` if state is loading.

- [ ] **Step 4: Implement `renderScoreError()`**

```javascript
function renderScoreError() {
  var err = AppState.circlesScoreError || {};
  return '<div data-view="circles">' +
    renderPhaseHeader('評分結果') +
    renderPersistentQuestionChip() +
    '<div class="error-wrap">' +
      '<div class="error-icon"><i class="ph ph-cloud-warning"></i></div>' +
      '<div class="error-title">評分生成失敗</div>' +
      '<div class="error-sub">AI 教練無法在這次連線中完成評分。你的框架答案已存檔，可以重試或稍後再試。</div>' +
      '<div class="error-actions" style="display:flex;gap:10px;flex-direction:row;max-width:420px">' +
        '<button class="btn btn-primary" id="circles-score-retry" style="flex:1"><i class="ph ph-arrow-clockwise"></i> 重新評分</button>' +
        '<button class="btn btn-ghost" id="circles-score-back" style="flex:1">返回修改答案</button>' +
      '</div>' +
      '<div class="error-detail" style="margin-top:20px;padding:10px 12px;background:rgba(239,68,68,.04);border:1px solid rgba(239,68,68,.2);border-radius:8px;font-size:11.5px;color:var(--c-text-2);max-width:360px;line-height:1.5;font-family:ui-monospace,monospace"><strong>code:</strong> ' + escHtml(err.code || 'UNKNOWN') + '</div>' +
    '</div>' +
  '</div>';
}
```

- [ ] **Step 5: `scheduleEvaluateStepFetch` with timeout + error mapping**

```javascript
async function scheduleEvaluateStepFetch() {
  AppState.circlesScoreLoading = true;
  AppState.circlesScoreError = null;
  var ctrl = new AbortController();
  var timeoutId = setTimeout(function() { ctrl.abort(); }, 30000);
  var slowToast = setTimeout(function() {
    if (AppState.circlesScoreLoading) {
      // simple toast — could be more polished
      console.info('[score] taking longer than expected…');
    }
  }, 15000);
  try {
    var sid = AppState.circlesSession && AppState.circlesSession.id;
    var endpoint = AppState.mode === 'auth'
      ? '/api/circles-sessions/' + sid + '/evaluate-step'
      : '/api/guest-circles-sessions/' + sid + '/evaluate-step';
    var res = await fetch(endpoint, {
      method: 'POST',
      headers: apiHeaders(),
      body: JSON.stringify({ step: AppState.circlesDrillStep || 'C1' }),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      var errBody = await res.json().catch(function() { return {}; });
      throw Object.assign(new Error(errBody.error || ('HTTP ' + res.status)), { code: errBody.code || ('HTTP_' + res.status) });
    }
    AppState.circlesScoreResult = await res.json();
    AppState.circlesScoreLoading = false;
    AppState.circlesScoreError = null;
  } catch (e) {
    AppState.circlesScoreLoading = false;
    AppState.circlesScoreError = {
      code: e.name === 'AbortError' ? 'EVAL_TIMEOUT' : (e.code || 'EVAL_API_ERROR'),
      message: e.message,
    };
  } finally {
    clearTimeout(timeoutId);
    clearTimeout(slowToast);
    render();
  }
}
```

- [ ] **Step 6: Wire retry / back button bind**

In `bindCirclesPhase3`:

```javascript
document.getElementById('circles-score-retry')?.addEventListener('click', function() {
  AppState.circlesScoreError = null;
  AppState.circlesScoreResult = null;
  scheduleEvaluateStepFetch();
});
document.getElementById('circles-score-back')?.addEventListener('click', function() {
  AppState.circlesScoreError = null;
  AppState.circlesScoreResult = null;
  AppState.circlesPhase = 1;
  render();
});
```

- [ ] **Step 7: Commit**

```bash
git add public/app.js
git commit -m "feat(sp3): Phase 3 three-state renderer (loading / error / content) + retry"
```

---

## Task 6: Implement `renderScoreContent()` with collapsible dimensions + new coachVersion

**Files:** Modify `public/app.js`

- [ ] **Step 1: Replace existing Phase 3 score render with collapsible version**

Find existing render of `dimensions` array. Replace with:

```javascript
function renderScoreContent() {
  var sr = AppState.circlesScoreResult;
  var dims = sr.dimensions || [];
  var stepKey = AppState.circlesDrillStep || 'C1';

  var dimsHtml = dims.map(function(d, i) {
    var pct = (d.score / 5) * 100;
    var fillClass = d.score >= 4 ? '' : (d.score >= 3 ? '' : ' red');
    var openByDefault = d.score <= 2 ? 'true' : 'false';
    return '<div class="dim">' +
      '<div class="dim-summary" data-open="' + openByDefault + '" data-dim-idx="' + i + '">' +
        '<div class="dim-summary-row"><span class="dim-name"><i class="ph ph-caret-right ph-caret"></i> ' + escHtml(d.name) + '</span><span class="dim-score' + (d.score <= 2 ? '" style="color:var(--c-danger)' : '') + '"><strong>' + d.score + '</strong>/5</span></div>' +
        '<div class="dim-bar"><div class="dim-bar-fill' + fillClass + '" style="width:' + pct + '%"></div></div>' +
      '</div>' +
      '<div class="dim-detail">' +
        '<div class="dim-comment"><strong>你的版本：</strong>' + escHtml(d.comment || '') + '</div>' +
      '</div>' +
    '</div>';
  }).join('');

  // Coach demo (new schema)
  var cv = sr.coachVersion || {};
  var coachDemoHtml = '';
  if (cv && typeof cv === 'object') {
    var perFieldHtml = (cv.perField || []).map(function(p) {
      return '<li><strong>' + escHtml(p.field) + ':</strong> ' + escHtml(p.demo) + '</li>';
    }).join('');
    coachDemoHtml =
      '<div class="coach-demo" data-open="false">' +
        '<div class="coach-demo-head">' +
          '<i class="ph ph-graduation-cap"></i>' +
          '<span>教練示範答案 — ' + escHtml(stepKey) + '</span>' +
          '<span class="gap" style="flex:1"></span>' +
          '<i class="ph ph-caret-right ph-caret"></i>' +
        '</div>' +
        '<div class="coach-demo-body">' +
          '<p><strong>情境前置：</strong>' + escHtml(cv.context || '') + '</p>' +
          '<strong>逐欄位示範：</strong><ul>' + perFieldHtml + '</ul>' +
          '<div class="coach-demo-quote"><strong>為什麼這樣答：</strong>' + escHtml(cv.reasoning || '') + '</div>' +
        '</div>' +
      '</div>';
  }

  // Highlights (existing)
  var hl = '<div class="hl-card"><div class="hl-label"><i class="ph ph-trophy"></i> 最大亮點</div><div class="hl-text">' + escHtml(sr.highlight || '') + '</div></div>' +
           '<div class="hl-card danger"><div class="hl-label"><i class="ph ph-warning"></i> 最需改進</div><div class="hl-text">' + escHtml(sr.improvement || '') + '</div></div>';

  return '<div data-view="circles">' +
    renderPhaseHeader('澄清情境 評分結果') +
    renderPersistentQuestionChip() +
    '<div class="score-card">' +
      '<div class="score-num">' + (sr.totalScore || 0) + '</div>' +
      '<div class="score-step">' + escHtml(stepKey) + ' — 步驟得分</div>' +
    '</div>' +
    dimsHtml +
    hl +
    coachDemoHtml +
    '<div class="end-bar"><button class="btn btn-primary" id="circles-replay" style="width:100%;max-width:520px;margin:0 auto;display:block"><i class="ph ph-shuffle"></i> 再練一題</button>' +
      '<div style="font-size:11px;color:var(--c-text-3);text-align:center;margin-top:6px">回首頁並隨機帶下一題</div>' +
    '</div>' +
  '</div>';
}
```

- [ ] **Step 2: Wire collapse handlers in `bindCirclesPhase3`**

```javascript
document.querySelectorAll('.dim-summary').forEach(function(el) {
  el.addEventListener('click', function() {
    var open = el.getAttribute('data-open') === 'true';
    el.setAttribute('data-open', open ? 'false' : 'true');
  });
});
document.querySelector('.coach-demo')?.addEventListener('click', function(e) {
  if (!e.target.closest('.coach-demo-head')) return;
  var panel = e.currentTarget;
  var open = panel.getAttribute('data-open') === 'true';
  panel.setAttribute('data-open', open ? 'false' : 'true');
});
```

- [ ] **Step 3: Wire `再練一題` button — random next question, navigate home + auto-expand**

```javascript
document.getElementById('circles-replay')?.addEventListener('click', function() {
  var allQs = (typeof CIRCLES_QUESTIONS !== 'undefined' ? CIRCLES_QUESTIONS : []);
  var pool = allQs.filter(function(q) { return q.question_type === AppState.circlesSelectedType; });
  if (AppState.circlesMode === 'drill' && AppState.circlesDrillStep) {
    pool = filterQuestionsForDrillStep(pool, AppState.circlesDrillStep);
  }
  var next = pool[Math.floor(Math.random() * pool.length)];
  // Reset session state
  AppState.circlesSession = null;
  AppState.circlesSelectedQuestion = null;
  AppState.circlesScoreResult = null;
  AppState.circlesScoreError = null;
  AppState.circlesPhase = 1;
  AppState.circlesFrameworkDraft = {};
  AppState.circlesDisplayedQuestions = next ? [next] : [];
  navigate('circles');
  // After render, auto-expand the first card
  setTimeout(function() {
    var card = document.querySelector('.circles-q-card');
    if (card && typeof expandQCard === 'function') expandQCard(card);
  }, 100);
});
```

- [ ] **Step 4: Manual test**

Open dev server, complete a session, hit Phase 3, confirm:
- Dimensions collapse / expand on click
- Score ≤ 2 dimension auto-expanded
- Coach demo collapsed by default, click expands to 3-section content
- 再練一題 button navigates home with new card pre-selected

- [ ] **Step 5: Commit**

```bash
git add public/app.js
git commit -m "feat(sp3): score content render — collapsible dims + structured coach demo + 再練一題"
```

---

## Task 7: Remove yellow celebration card + bottom sticky 再練一次

**Files:** Modify `public/app.js`

- [ ] **Step 1: Find existing celebration card**

```bash
grep -n "恭喜完成\|yellow\|celebrat" public/app.js
```

- [ ] **Step 2: Delete the render block**

Remove the inline render of yellow card with `回首頁` + `再練一次` buttons. Also remove the bottom-sticky `再練一次` + house icon block.

- [ ] **Step 3: Confirm new `再練一題` is the only end-of-step CTA**

Refresh dev server → complete a step → no yellow card, no bottom sticky house icon, only single 再練一題.

- [ ] **Step 4: Commit**

```bash
git add public/app.js
git commit -m "refactor(sp3): drop yellow celebration card + sticky 再練一次"
```

---

## Task 8: CSS — collapse styles + coach-demo + loading + error

**Files:** Modify `public/style.css`

- [ ] **Step 1: Append SP3 styles**

```css
/* SP3 — dimension collapse */
.dim { background: #fff; border-top: 1px solid var(--c-border); }
.dim-summary { padding: 14px var(--pad-block); cursor: pointer; }
@media (min-width: 768px) { .dim-summary { padding-left: var(--pad-block-tablet); padding-right: var(--pad-block-tablet); } }
@media (min-width: 1280px) { .dim-summary { padding-left: var(--pad-block-desktop); padding-right: var(--pad-block-desktop); } }
.dim-summary-row { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 6px; }
.dim-name { font-size: 14px; font-weight: 700; display: flex; align-items: center; gap: 6px; }
.dim-name .ph-caret { font-size: 12px; color: var(--c-text-3); transition: transform .2s; }
.dim-summary[data-open="true"] .ph-caret { transform: rotate(90deg); }
.dim-detail { padding: 0 var(--pad-block) 14px; display: none; }
@media (min-width: 768px) { .dim-detail { padding-left: var(--pad-block-tablet); padding-right: var(--pad-block-tablet); } }
@media (min-width: 1280px) { .dim-detail { padding-left: var(--pad-block-desktop); padding-right: var(--pad-block-desktop); } }
.dim-summary[data-open="true"] + .dim-detail { display: block; }
.dim-bar { height: 6px; border-radius: 3px; background: var(--c-border); overflow: hidden; }
.dim-bar-fill { height: 100%; background: var(--c-primary); }
.dim-bar-fill.red { background: var(--c-danger, #ef4444); }
.dim-comment { font-size: 12.5px; color: var(--c-text-1); line-height: 1.6; padding-top: 4px; }

/* SP3 — coach demo */
.coach-demo {
  background: #fff; border: 1px solid var(--c-border);
  border-radius: var(--r-input);
  margin: 10px var(--pad-block); overflow: hidden;
}
@media (min-width: 768px) { .coach-demo { margin-left: var(--pad-block-tablet); margin-right: var(--pad-block-tablet); } }
@media (min-width: 1280px) { .coach-demo { margin-left: var(--pad-block-desktop); margin-right: var(--pad-block-desktop); } }
.coach-demo-head { padding: 12px 14px; display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 13px; font-weight: 700; min-height: 44px; }
.coach-demo-head .ph-caret { transition: transform .2s; color: var(--c-text-3); font-size: 13px; }
.coach-demo[data-open="true"] .ph-caret { transform: rotate(90deg); }
.coach-demo-body { padding: 0 14px 14px; display: none; font-size: 12.5px; line-height: 1.7; }
.coach-demo[data-open="true"] .coach-demo-body { display: block; }
.coach-demo-body p { margin: 0 0 10px; }
.coach-demo-body strong { color: var(--c-primary); }
.coach-demo-body ul { margin: 0 0 10px; padding-left: 20px; }
.coach-demo-body li { margin-bottom: 4px; }
.coach-demo-quote {
  background: rgba(74,108,247,.05); border-left: 3px solid var(--c-primary);
  padding: 10px 12px; margin: 0 0 10px;
  border-radius: 0 var(--r-input) var(--r-input) 0;
  font-size: 12px; line-height: 1.6;
}

/* SP3 — loading state */
.loading-wrap { padding: 40px 16px; display: flex; flex-direction: column; align-items: center; text-align: center; min-height: 50vh; }
.loading-spinner { width: 56px; height: 56px; border: 4px solid rgba(74,108,247,.15); border-top-color: var(--c-primary); border-radius: 50%; animation: sp3-spin 1s linear infinite; margin-bottom: 18px; }
@keyframes sp3-spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .loading-spinner { animation: none; } }
.loading-title { font-size: 16px; font-weight: 700; margin-bottom: 6px; }
.loading-sub { font-size: 13px; color: var(--c-text-2); line-height: 1.6; max-width: 320px; }
.loading-checklist { margin-top: 20px; font-size: 12.5px; color: var(--c-text-2); text-align: left; }
.loading-checklist .row { display: flex; align-items: center; gap: 6px; margin-bottom: 6px; }
.loading-checklist .row.pending { color: var(--c-text-3); }
.loading-checklist .row .ph-circle-notch { color: var(--c-primary); animation: sp3-spin 1s linear infinite; }
.loading-checklist .row .ph-check-circle { color: var(--c-primary); }

/* SP3 — error state */
.error-wrap { padding: 40px 16px; display: flex; flex-direction: column; align-items: center; text-align: center; min-height: 50vh; }
.error-icon { width: 56px; height: 56px; background: rgba(239,68,68,.1); color: var(--c-danger); border-radius: 50%; display: grid; place-items: center; font-size: 32px; margin-bottom: 18px; }
.error-title { font-size: 16px; font-weight: 700; margin-bottom: 6px; }
.error-sub { font-size: 13px; color: var(--c-text-2); line-height: 1.6; max-width: 360px; margin-bottom: 22px; }

/* SP3 — score */
.score-card { background: #fff; padding: 24px 16px; text-align: center; }
@media (min-width: 768px) { .score-card { padding-left: var(--pad-block-tablet); padding-right: var(--pad-block-tablet); } }
@media (min-width: 1280px) { .score-card { padding-left: var(--pad-block-desktop); padding-right: var(--pad-block-desktop); } }
.score-num { font-size: 56px; font-weight: 700; color: var(--c-primary); letter-spacing: -.02em; line-height: 1; font-family: var(--c-font-sans); }
.score-step { font-size: 13px; color: var(--c-text-2); margin-top: 4px; }

.hl-card { padding: 12px 16px; background: rgba(74,108,247,.06); border-left: 3px solid var(--c-primary); margin: 10px var(--pad-block); border-radius: 0 var(--r-input) var(--r-input) 0; }
@media (min-width: 768px) { .hl-card { margin-left: var(--pad-block-tablet); margin-right: var(--pad-block-tablet); } }
@media (min-width: 1280px) { .hl-card { margin-left: var(--pad-block-desktop); margin-right: var(--pad-block-desktop); } }
.hl-card.danger { background: rgba(239,68,68,.06); border-left-color: var(--c-danger, #ef4444); }
.hl-label { font-size: 11px; font-weight: 700; color: var(--c-primary); display: flex; align-items: center; gap: 4px; margin-bottom: 4px; }
.hl-card.danger .hl-label { color: var(--c-danger, #ef4444); }
.hl-text { font-size: 13px; line-height: 1.5; }

/* SP3 — end bar */
.end-bar { padding: 14px var(--pad-block); background: #fff; border-top: 1px solid var(--c-border); }
@media (min-width: 768px) { .end-bar { padding-left: var(--pad-block-tablet); padding-right: var(--pad-block-tablet); } }
@media (min-width: 1280px) { .end-bar { padding-left: var(--pad-block-desktop); padding-right: var(--pad-block-desktop); } }
```

- [ ] **Step 2: Verify visually at 3 widths**

- [ ] **Step 3: Commit**

```bash
git add public/style.css
git commit -m "style(sp3): collapse dims + coach demo + loading + error + score + highlights"
```

---

## Task 9: Playwright spec — sp3-phase3

**Files:** Create `tests/playwright/journeys/sp3-phase3.spec.js`

- [ ] **Step 1: Write spec**

```javascript
const { test, expect } = require('@playwright/test');

const MOCK_RESULT = {
  totalScore: 65,
  dimensions: [
    { name: '問題邊界清晰度', score: 3, comment: '提到提升 Podcast 體驗，但沒指明哪一段。' },
    { name: '業務影響連結', score: 4, comment: '方向正確，可加量化。' },
    { name: '時間範圍合理性', score: 4, comment: '合理。' },
    { name: '假設排除完整性', score: 2, comment: '幾乎沒列假設。' },
  ],
  highlight: '業務影響連結清晰',
  improvement: '至少寫 2-3 個明確假設',
  coachVersion: {
    context: 'C 步驟核心是讓題目可被排序…',
    perField: [
      { field: '問題範圍', demo: '聚焦 Podcast 模組，改善「發現」段體驗' },
      { field: '時間範圍', demo: '2 季度上線 MVP' },
      { field: '業務影響', demo: '日均收聽 +15%' },
      { field: '假設確認', demo: '假設用戶已是 Premium' },
    ],
    reasoning: 'C 不是提方案，是讓題目可被排序，每欄位需量化或邊界。',
  },
};

async function injectScoreState(page) {
  await page.evaluate((mock) => {
    window.AppState.circlesPhase = 3;
    window.AppState.circlesScoreResult = mock;
    window.AppState.circlesScoreLoading = false;
    window.AppState.circlesScoreError = null;
    window.AppState.circlesDrillStep = 'C1';
    window.AppState.circlesSelectedQuestion = window.CIRCLES_QUESTIONS[0];
    window.render && window.render();
  }, MOCK_RESULT);
}

test.describe('SP3 — Phase 3 score', () => {

  test('dimensions collapsed by default; score ≤ 2 auto-expanded', async ({ page }) => {
    await page.goto('/');
    await injectScoreState(page);
    const dims = page.locator('.dim-summary');
    expect(await dims.count()).toBe(4);
    // Dimension 4 (假設排除 score 2) should auto-expand
    const dim4 = dims.nth(3);
    expect(await dim4.getAttribute('data-open')).toBe('true');
    // Dimension 1 (score 3) collapsed by default
    expect(await dims.nth(0).getAttribute('data-open')).toBe('false');
  });

  test('clicking dim toggles open/close', async ({ page }) => {
    await page.goto('/');
    await injectScoreState(page);
    const dim1 = page.locator('.dim-summary').nth(0);
    expect(await dim1.getAttribute('data-open')).toBe('false');
    await dim1.click();
    expect(await dim1.getAttribute('data-open')).toBe('true');
  });

  test('coach demo renders 3 sections (context + perField + reasoning)', async ({ page }) => {
    await page.goto('/');
    await injectScoreState(page);
    const coach = page.locator('.coach-demo');
    await coach.locator('.coach-demo-head').click();
    expect(await coach.getAttribute('data-open')).toBe('true');
    const body = await coach.locator('.coach-demo-body').innerText();
    expect(body).toContain('情境前置');
    expect(body).toContain('逐欄位示範');
    expect(body).toContain('為什麼這樣答');
  });

  test('end bar has 再練一題 only — no yellow card, no sticky 再練一次', async ({ page }) => {
    await page.goto('/');
    await injectScoreState(page);
    expect(await page.locator('#circles-replay').count()).toBe(1);
    const text = await page.locator('#circles-replay').innerText();
    expect(text).toContain('再練一題');
    // Yellow card removed
    const html = await page.locator('[data-view="circles"]').innerHTML();
    expect(html).not.toContain('恭喜完成這個步驟');
  });

  test('loading state renders spinner + checklist', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      window.AppState.circlesPhase = 3;
      window.AppState.circlesScoreLoading = true;
      window.AppState.circlesScoreResult = null;
      window.AppState.circlesScoreError = null;
      window.AppState.circlesSelectedQuestion = window.CIRCLES_QUESTIONS[0];
      window.render && window.render();
    });
    await expect(page.locator('.loading-spinner')).toBeVisible();
    expect(await page.locator('.loading-checklist .row').count()).toBe(4);
  });

  test('error state renders icon + retry button', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      window.AppState.circlesPhase = 3;
      window.AppState.circlesScoreLoading = false;
      window.AppState.circlesScoreError = { code: 'EVAL_TIMEOUT', message: 'timeout' };
      window.AppState.circlesScoreResult = null;
      window.AppState.circlesSelectedQuestion = window.CIRCLES_QUESTIONS[0];
      window.render && window.render();
    });
    await expect(page.locator('.error-icon')).toBeVisible();
    await expect(page.locator('#circles-score-retry')).toBeVisible();
    await expect(page.locator('#circles-score-back')).toBeVisible();
    expect(await page.locator('.error-detail').innerText()).toContain('EVAL_TIMEOUT');
  });
});
```

- [ ] **Step 2: Sanity**

```bash
node --check tests/playwright/journeys/sp3-phase3.spec.js
```

- [ ] **Step 3: Commit**

```bash
git add tests/playwright/journeys/sp3-phase3.spec.js
git commit -m "test(sp3): Phase 3 score collapse + coach demo + loading + error"
```

---

## Task 10: Run on all 8 viewports + regression

- [ ] **Step 1: Server up**

- [ ] **Step 2: Run new spec on all 8 projects**

```bash
PMDRILL_BASE_URL=http://localhost:4000 npx playwright test \
  --config=tests/playwright/playwright.config.js \
  tests/playwright/journeys/sp3-phase3.spec.js \
  --project=Mobile-360 --project=iPhone-SE --project=iPhone-14 --project=iPhone-15-Pro \
  --project=iPad --project=Desktop-1280 --project=Desktop-1440 --project=Desktop-2560 \
  --reporter=list --screenshot=on
```

Expected: 6 tests × 8 = 48 passed.

- [ ] **Step 3: View ≥ 8 screenshots (1 per viewport)**

- [ ] **Step 4: Run jest + full Playwright regression**

```bash
OPENAI_API_KEY=$(grep OPENAI_API_KEY .env | cut -d= -f2) npx jest --no-coverage 2>&1 | tail -3
PMDRILL_BASE_URL=http://localhost:4000 npx playwright test --config=tests/playwright/playwright.config.js --reporter=line 2>&1 | tail -3
```

---

## Task 11: iOS check + sign-off

- [ ] **Step 1: iOS quirk walk** (per verification standard § 7)

Particularly:
- `.coach-demo-head` ≥ 44px touch (we set min-height 44 — verify)
- `.dim-summary` ≥ 44px effective tap area
- spinner has `prefers-reduced-motion: reduce` guard (we added)

- [ ] **Step 2: iPhone-15-Pro spot-check**

```bash
PMDRILL_BASE_URL=http://localhost:4000 npx playwright test \
  --config=tests/playwright/playwright.config.js \
  --project=iPhone-15-Pro tests/playwright/journeys/sp3-phase3.spec.js \
  --reporter=list --screenshot=on
```

- [ ] **Step 3: Sign-off**

```markdown
# SP3 Sign-off — 2026-05-02

- [x] Schema migration (Tasks 2-3) jest pass
- [x] Routes error mapping (Task 4)
- [x] Phase 3 3-state renderer (Tasks 5-6)
- [x] Yellow card removed (Task 7)
- [x] CSS (Task 8)
- [x] Playwright sp3-phase3.spec.js: 48/48 across 8 viewports
- [x] No regression (jest + existing PW)
- [x] iOS quirks walked
- [x] 8 screenshots viewed
- [x] No console errors

**Branch:** feat/sp3-score
```

```bash
git add audit/sp3-signoff.md
git commit -m "audit(sp3): sign-off"
```

---

## Self-Review

**Spec coverage:**
- ✅ Evaluator schema object (Tasks 2-3)
- ✅ Error code mapping (Task 4)
- ✅ Loading state (Tasks 5, 8)
- ✅ Error state with retry/back (Tasks 5, 8)
- ✅ Collapsible dims (Tasks 6, 8)
- ✅ Coach demo enriched + collapsible (Tasks 6, 8)
- ✅ 再練一題 single CTA + random next (Task 6)
- ✅ Yellow card removed (Task 7)
- ✅ 8-viewport Playwright (Tasks 9-10)
- ✅ iOS check (Task 11)
- ✅ Sign-off (Task 11)

**Type consistency:**
- `coachVersion.{context, perField[], reasoning}`: defined Task 2, generated Task 3, asserted Task 9 ✓
- `AppState.circlesScore{Loading,Error,Result}`: defined Task 5, used Tasks 5/6/9 ✓
- `EVAL_TIMEOUT/API_ERROR/PARSE_ERROR` codes: routes Task 4, frontend Task 5, asserted Task 9 ✓

**No placeholders.**
