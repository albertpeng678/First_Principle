# Mockup 04 — Phase 1.5 Gate Implementation Design

**Date:** 2026-05-07
**Path 2 sub-project:** Plan B SB10
**Worktree:** `feat/path-2-circles-core`
**Mockup contract:** `docs/superpowers/specs/mockups/2026-05-02-frontend-rewrite/04-phase-1-5-gate.html`
**Master Spec ref:** §2.4 (Stale/Locked/Gate) + §1.5.1 (Multi-tab+401) + memory `feedback_gate_red_blocks_always`

---

## 0. Scope

Build Phase 1.5 Gate screen (between Phase 1 form submit and Phase 2 chat). Renders AI framework-review result from `POST /:id/gate` in 4 states: ok / warn / error / loading. Drill + simulation behaviour identical (per memory standing rule — frontend ignores backend `canProceed` field).

**Out of scope:** backend `routes/circles-sessions.js` `POST /:id/gate` route + `prompts/circles-gate.js` are CONTRACT-LOCKED (already exist; do not modify).

## 1. Entry / exit flow

### 1.1 Entry — Phase 1 form submit

`public/app.js` Phase 1 submit handler currently sets `AppState.circlesPhase = 1.5` at lines 2794 / 2802 but no render path exists for `circlesPhase === 1.5`. This spec adds the render path.

On submit click:
1. Validate frameworkDraft non-empty (≥ 1 field of current step has content). Empty submission → keep on Phase 1 with toast.
2. Set `circlesPhase = 1.5`, `circlesGateLoading = true`, `circlesGateResult = null`, `circlesGateError = null`. `render()`.
3. Fire `POST /api/(guest-)circles-sessions/:id/gate` body `{ step: stepKey, frameworkDraft: AppState.circlesFrameworkDraft[stepKey] }` (auth/guest path branch).
4. Response 200 → `circlesGateResult = json` (`{items:[], canProceed:bool, overallStatus:'ok'|'warn'|'error'}`); `circlesGateLoading = false`; `render()`.
5. Response 401 → trigger Multi-tab+401 banner flow per master spec §1.5.1; do not show error overlay.
6. Response 500 / network → `circlesGateError = error.message`; `circlesGateLoading = false`; `render()`.

### 1.2 Exit — three paths

- **ok / warn → 繼續到 Phase 2:** `circlesPhase = 2`, clear gate state, `render()`. (Phase 2 render is mockup 05 — out of scope; Plan B SB11.)
- **error → 返回修改:** `circlesPhase = 1`, keep `circlesFrameworkDraft` (form data persists), clear gate state, `render()`.
- **error retry from EVAL_API_ERROR-style server error:** re-fire same gate call.

## 2. AppState additions

Add to AppState init (`public/app.js:1-110` area):
```js
circlesGateResult: null,        // already exists at line 27
circlesGateLoading: false,      // NEW
circlesGateError: null,         // NEW
```

Both are cleared on `circlesPhase` transition out of 1.5.

## 3. Render — `renderCirclesGate(stepKey, q)`

New function. Returns full HTML string for `circlesPhase === 1.5`.

### 3.1 Common chrome (all 4 states)

Lines 559-582 of mockup 04 confirm:
- `.navbar` (LOCKED copy from mockup 01/03)
- `.progress` 7-step bar with current step `.is-active`, prior steps `.is-done`
- `.phase-head` with `phase-head__num="1.5"` + eyebrow「Phase 1.5 · 框架審核」+ title 動態（C1 → "C · 澄清情境" / I → "I · 定義用戶" / etc per `CIRCLES_STEP_CONFIG[stepKey].title`）
- `.qchip` collapsed (re-use existing renderer; respect `circlesChipExpanded` toggle)

### 3.2 State A — `overallStatus === 'ok'` (mockup line 583-630)

```html
<div class="gate-content">
  <div class="gate-wrap">
    <div class="gate-transition gate-transition--ok">
      <i class="ph-fill ph-check-circle gate-transition__icon"></i>
      <div class="gate-transition__main">
        <div class="gate-transition__title">框架完整</div>
        <div class="gate-transition__sub">所有欄位都對齊到 {stepName} 步核心定義</div>
      </div>
      <button class="gate-transition__action" data-gate-action="proceed">繼續 <i class="ph ph-arrow-right"></i></button>
    </div>
    <div class="gate-section-label">逐欄位回饋 <span class="gate-section-label__count">{ok-count} / {total} 通過</span></div>
    <div class="gate-list">
      {items.map(item => renderGateItem(item))}
    </div>
  </div>
</div>
```

No sticky bottom submit-bar in ok state — `gate-transition__action` is the only proceed CTA.

### 3.3 State B — `overallStatus === 'warn'`

Same shell as ok but:
- `gate-transition--warn` class (yellow theme per mockup §B)
- `gate-transition__title` 「框架可通過」+ subtitle reflecting count of warns
- gate-list contains mix of `gate-item--ok` + `gate-item--warn` items
- Each warn item shows additional `gate-item__suggestion` div (orange tip)
- Same inline `gate-transition__action` 「繼續」 button

### 3.4 State C — `overallStatus === 'error'`

- `gate-transition--error` class (red theme)
- `gate-transition__title` 「方向需修正」+ subtitle of error count
- **NO inline `gate-transition__action` button** — error blocks proceed inline
- gate-list contains mix of `gate-item--error` + maybe ok/warn items
- Each error item shows `gate-item__suggestion` div (red tip)
- **Sticky bottom submit-bar**:
  ```html
  <div class="submit-bar">
    <div class="submit-bar__left"></div>
    <div class="submit-bar__right">
      <button class="btn btn--primary" data-gate-action="back">
        <i class="ph ph-arrow-left"></i>返回修改
      </button>
    </div>
  </div>
  ```
- **No 「帶風險繼續」 button. No simulation override.** Frontend ignores `canProceed`. (Master spec §2.4)

### 3.5 State D — Loading (`circlesGateLoading === true`)

```html
<div class="gate-content">
  <div class="gate-loading">
    <div class="gate-loading__spinner"></div>
    <div class="gate-loading__title">正在審核框架</div>
    <div class="gate-loading__sub">教練閱讀你的回答中…</div>
    <ul class="gate-loading__checklist">
      <li class="is-done"><i class="ph ph-check"></i>解析欄位內容</li>
      <li class="is-active"><i class="ph ph-circle-notch"></i>對照 {stepName} 步重點</li>
      <li><i class="ph ph-circle"></i>檢查方向性</li>
      <li><i class="ph ph-circle"></i>整理回饋</li>
    </ul>
  </div>
</div>
```

Checklist progresses via timer: step 1 done immediately, step 2 active 0-3s, step 3 active 3-7s, step 4 active 7s+. Real backend latency typically 2-8s; `setTimeout` ladder OK.

### 3.6 Error overlay (`circlesGateError` truthy, server 5xx not 401)

Shows mockup 15 §C E1 error-wrap (shared component):
```html
<div class="error-wrap">
  <i class="ph ph-cloud-warning error-wrap__icon"></i>
  <div class="error-wrap__title">框架審核失敗</div>
  <div class="error-wrap__sub">{error message}</div>
  <div class="error-wrap__code">GATE_API_ERROR</div>
  <div class="error-wrap__actions">
    <button class="btn btn--primary" data-gate-action="retry">重新審核</button>
    <button class="btn btn--ghost" data-gate-action="back">返回修改</button>
  </div>
</div>
```

## 4. `renderGateItem(item)` helper

```js
function renderGateItem(item) {
  const cls = `gate-item gate-item--${item.status}`;
  const iconName = item.status === 'ok' ? 'ph-check-circle'
                 : item.status === 'warn' ? 'ph-warning'
                 : 'ph-x-circle';
  const suggestionHtml = item.suggestion
    ? `<div class="gate-item__suggestion"><strong>修正方向：</strong>${escHtml(item.suggestion)}</div>`
    : '';
  return `<div class="${cls}">
    <i class="ph-fill ${iconName} gate-item__icon"></i>
    <div class="gate-item__main">
      <div class="gate-item__field">${escHtml(item.field)}</div>
      <div class="gate-item__title">${escHtml(item.title)}</div>
      <div class="gate-item__reason">${escHtml(item.reason)}</div>
      ${suggestionHtml}
    </div>
  </div>`;
}
```

## 5. Binding — `bindCirclesGate()`

```js
function bindCirclesGate() {
  document.querySelectorAll('[data-gate-action]').forEach(el => {
    el.addEventListener('click', () => {
      const act = el.dataset.gateAction;
      if (act === 'proceed') {
        AppState.circlesPhase = 2;
        clearGateState();
        render();
      } else if (act === 'back') {
        AppState.circlesPhase = 1;
        clearGateState();
        render();
      } else if (act === 'retry') {
        submitFrameworkToGate(); // re-fire POST
      }
    });
  });
}
function clearGateState() {
  AppState.circlesGateResult = null;
  AppState.circlesGateLoading = false;
  AppState.circlesGateError = null;
}
```

Wire `bindCirclesGate()` into existing `bindCircles()` dispatcher when `circlesPhase === 1.5`.

## 6. Phase 1 submit handler — `submitFrameworkToGate()`

Replace existing line 2794 / 2802 handlers (which currently just set `circlesPhase = 1.5` without firing the API):

```js
async function submitFrameworkToGate() {
  const stepKey = currentStepKey();
  const draft = AppState.circlesFrameworkDraft[stepKey] || {};
  // Validate non-empty
  const hasContent = Object.values(draft).some(v => v && v.trim());
  if (!hasContent) {
    showToast('請至少填寫一個欄位再提交審核', 'warn');
    return;
  }
  AppState.circlesPhase = 1.5;
  AppState.circlesGateLoading = true;
  AppState.circlesGateResult = null;
  AppState.circlesGateError = null;
  render();

  // Ensure session exists (lazy-create per offcanvas hotfix pattern)
  await ensureCirclesDraftSession();
  const sessionId = AppState.circlesSession?.id;
  if (!sessionId) {
    AppState.circlesGateError = '無法建立 session，請重試';
    AppState.circlesGateLoading = false;
    render();
    return;
  }

  const path = (AppState.accessToken
    ? '/api/circles-sessions/'
    : '/api/guest-circles-sessions/'
  ) + sessionId + '/gate';

  try {
    const res = await window.apiFetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ step: stepKey, frameworkDraft: draft }),
    });
    if (res.status === 401) {
      // Master spec §1.5.1 multi-tab + 401 flow handles this elsewhere
      return;
    }
    if (!res.ok) {
      AppState.circlesGateError = `Server returned ${res.status}`;
      AppState.circlesGateLoading = false;
      render();
      return;
    }
    AppState.circlesGateResult = await res.json();
    AppState.circlesGateLoading = false;
    render();
  } catch (e) {
    AppState.circlesGateError = e.message || '網路錯誤';
    AppState.circlesGateLoading = false;
    render();
  }
}
```

## 7. CSS additions

Style additions for new classes (none of the LOCKED component CSS modified):
- `.gate-content` `.gate-wrap` `.gate-transition` `.gate-transition--{ok,warn,error}` `.gate-transition__icon/main/title/sub/action`
- `.gate-section-label` `.gate-section-label__count`
- `.gate-list` `.gate-item` `.gate-item--{ok,warn,error}` `.gate-item__icon/main/field/title/reason/suggestion`
- `.gate-loading` `.gate-loading__spinner/title/sub/checklist`
- `.error-wrap` (extract or copy from mockup 15 §C E1 if not already in `style.css`)

Source mockup 04 line 1-510 of HTML for full CSS reference. Pixel-diff threshold 0.5%.

## 8. Tests (TDD red first)

`tests/visual/circles-gate.spec.js` — new file:

| # | Spec | State | Assertions |
|---|---|---|---|
| 1 | OK state renders 繼續 button + 4 ok items | ok | `.gate-transition--ok` visible / `[data-gate-action="proceed"]` enabled / 4 `.gate-item--ok` |
| 2 | WARN state renders 繼續 + warn items + suggestions | warn | `.gate-transition--warn` / mix items / 1+ suggestion div |
| 3 | ERROR state — sticky 「返回修改」 only, no proceed inline | error | NO `.gate-transition__action` / sticky `[data-gate-action="back"]` / NO 「帶風險繼續」 anywhere |
| 4 | ERROR state — drill mode same as sim | error | repeat #3 with `circlesMode='drill'` and `'simulation'` |
| 5 | Loading state — spinner + 4-step checklist | loading | `.gate-loading__spinner` / `.gate-loading__checklist` 4 li |
| 6 | Submit empty draft → toast, no API call | n/a | spy POST not called / toast visible |
| 7 | Submit fires POST gate with correct body | n/a | mock fetch / assert body `{step, frameworkDraft}` |
| 8 | OK 繼續 → circlesPhase = 2 | ok | post-click AppState.circlesPhase === 2 |
| 9 | ERROR 返回修改 → circlesPhase = 1 + draft preserved | error | AppState.circlesPhase === 1 / AppState.circlesFrameworkDraft.C1 unchanged |
| 10 | 401 from gate → does NOT show error-wrap | mock 401 | no `.error-wrap` / multi-tab+401 banner instead (out-of-scope assertion: just confirm gate doesn't show its own error) |
| 11 | Server 500 → error-wrap with retry button | mock 500 | `.error-wrap` visible / `[data-gate-action="retry"]` / re-click fires another POST |

Run on Desktop-1280 + Mobile-360 + iPad → 11 × 3 = 33 specs.

## 9. Visual verification (director cold review)

After sonnet ships, opus director:
1. Run 8-viewport Playwright on `circles-gate.spec.js` → 88 assertions green
2. Capture 12 PNGs: `gate-{ok,warn,error,loading} × {Mobile-360, iPad, Desktop-1280}`
3. Read each PNG, verify:
   - mockup 04 line 583+ structure 1:1 (`.gate-transition` + icon + title + sub + action)
   - colour: ok=success / warn=warn / error=danger
   - **error state has NO 繼續 button anywhere** (the kill criterion)
   - submit-bar sticky on error only
4. Pixel-diff vs mockup 04 baseline frame, threshold 0.5%
5. iOS 15-item static review for sticky submit-bar + button touch ≥ 44px
6. Eyeball walk doc `audit/eyeball-mockup-04.md` — ≥ 1 sentence per PNG

## 10. Out of scope

- Phase 2 chat (mockup 05) — Plan B SB11
- Backend gate route changes
- Multi-tab+401 banner — already handled per master spec §1.5.1 elsewhere
- gate-result persistence in DB — backend already writes via existing route

## 11. Risk + rollback

Risk: medium. New render branch + new POST flow. Failure mode: stuck on Phase 1.5 loading forever. Mitigation: timeout 30s on the fetch (master spec §3.5 says no explicit gate timeout but 30s sane default; if exceeded → GATE_API_ERROR). Rollback: revert single Plan B SB10 commit.

## 12. Success criteria

- [ ] 33+ Playwright specs green (Desktop + Mobile + iPad × 11)
- [ ] 8-viewport regression sweep stays green
- [ ] jest 160/160 unchanged (no backend touch)
- [ ] 12 PNGs read by opus director
- [ ] Pixel-diff < 0.5% vs mockup 04
- [ ] iOS 15-item check pass
- [ ] eyeball walk doc committed
- [ ] CLAUDE.md updated
