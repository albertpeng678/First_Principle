# Plan B SB9a — Save Indicator 4 狀態 Visual Cycle

> Mockup source: `docs/superpowers/specs/mockups/2026-05-02-frontend-rewrite/03-phase-1-form.html` Section F line 2109-2186
> Backend rule: 後端 100% 不動。Save indicator 是純前端 visual state — input → debounce → saving → saved → idle 循環,搭配 localStorage 草稿。**不打 PATCH /progress**（mockup 提到的 backend 端點忽略,當作 visual mock）。

## Goal

Production 6 處 phase-head save-indicator 目前 hardcoded `--saved` 「已儲存」。改為動態 4 狀態：
- `idle` — 「已暫存」（grey）
- `saving` — 「儲存中」（spinner）
- `saved` — 「已儲存到雲端」（green check + 2s 後 fade 回 idle）
- `error` — 「離線中 · 點擊重試」（red warning + click 重試）

## Architecture

- AppState 加 `circlesPhase1SaveState: 'idle' | 'saving' | 'saved' | 'error'` （default `idle`）
- Helper `renderSaveIndicator(state)` 取代 6 處 hardcoded HTML
- contenteditable / sol-name / tracking-input change → debounce 800ms → setState `saving` → 200ms → setState `saved` + localStorage 寫 → 2000ms → setState `idle`
- error 模擬：localStorage 寫失敗 (try/catch) → setState `error` → click 重試
- localStorage key: `pmdrill:circles:draft:{questionId}` JSON serialize AppState.circlesPhase1*

## Files

- Modify: `public/app.js`
  - `AppState` init 加 `circlesPhase1SaveState`
  - 6 處 `save-indicator save-indicator--saved` → call helper
  - 加 `renderSaveIndicator(state)` helper（line ~1410）
  - 加 `setPhase1SaveState(s)` + debounce timer manager
  - input listener (contenteditable/input/sol-name/tracking) 觸發 debounce
  - error retry binder
- Modify: `public/style.css` — add `@keyframes spin` if not exists (mockup line 303 spinner)
- Test: `tests/visual/phase1-save-indicator.spec.js`

## Mockup-as-Spec line refs

- L226-303: `.save-indicator` base + 4 modifiers
- L2160-2174: 4-state semantics
- L2105: 草稿存 localStorage
- L2178: floating top-right + submit-bar 內鏡像同步（**phase-head 已含,不另加 floating**）

## Tasks

### Task 1: AppState + helper

- [ ] **Step 1: Write the failing spec**

`tests/visual/phase1-save-indicator.spec.js`:
```js
test('default state is idle (已暫存)', async ({ page }) => {
  // ...gotoSimC1
  await expect(page.locator('.save-indicator')).toHaveText('已暫存');
  await expect(page.locator('.save-indicator')).toHaveClass(/save-indicator--idle/);
});
```

- [ ] **Step 2: Verify red**: spec fails because production renders `--saved` not `--idle`.

- [ ] **Step 3: Add AppState + helper**

In `app.js` AppState init block:
```js
circlesPhase1SaveState: 'idle',
```

Helper near other render helpers (~line 1410):
```js
function renderSaveIndicator(state) {
  state = state || (AppState.circlesPhase1SaveState || 'idle');
  if (state === 'saving') {
    return '<span class="save-indicator save-indicator--saving">儲存中</span>';
  }
  if (state === 'saved') {
    return '<span class="save-indicator save-indicator--saved" data-phase1="save-retry"><i class="ph ph-check"></i>已儲存到雲端</span>';
  }
  if (state === 'error') {
    return '<span class="save-indicator save-indicator--error" data-phase1="save-retry"><i class="ph ph-warning-circle"></i>離線中 · 點擊重試</span>';
  }
  return '<span class="save-indicator save-indicator--idle">已暫存</span>';
}
```

Replace 6 hardcoded sites with `renderSaveIndicator()`.

- [ ] **Step 4: Verify green**.

### Task 2: Debounce save cycle

- [ ] **Step 1: Spec**

```js
test('typing triggers saving → saved → idle cycle', async ({ page }) => {
  await page.locator('.rt-textarea').first().click();
  await page.keyboard.type('test');
  await expect(page.locator('.save-indicator--saving')).toBeVisible({ timeout: 1500 });
  await expect(page.locator('.save-indicator--saved')).toBeVisible({ timeout: 2000 });
  await expect(page.locator('.save-indicator--idle')).toBeVisible({ timeout: 5000 });
});
```

- [ ] **Step 2: Verify red**.

- [ ] **Step 3: Implement**

```js
var _saveDebounce = null;
var _saveCycleT2 = null;
function triggerSaveCycle() {
  clearTimeout(_saveDebounce);
  clearTimeout(_saveCycleT2);
  _saveDebounce = setTimeout(function () {
    setPhase1SaveState('saving');
    setTimeout(function () {
      try {
        var qid = (AppState.circlesSelectedQuestion || {}).id || 'unknown';
        localStorage.setItem('pmdrill:circles:draft:' + qid, JSON.stringify({
          P1: AppState.circlesPhase1, P1S: AppState.circlesPhase1S,
          P1L: AppState.circlesPhase1Solutions, P1E: AppState.circlesPhase1Evaluate,
          ts: Date.now()
        }));
        setPhase1SaveState('saved');
        _saveCycleT2 = setTimeout(function () { setPhase1SaveState('idle'); }, 2000);
      } catch (e) {
        setPhase1SaveState('error');
      }
    }, 200);
  }, 800);
}
function setPhase1SaveState(s) {
  AppState.circlesPhase1SaveState = s;
  document.querySelectorAll('.save-indicator').forEach(function (el) {
    el.outerHTML = renderSaveIndicator(s);
  });
  // re-bind retry
  document.querySelectorAll('[data-phase1="save-retry"]').forEach(function (b) {
    b.addEventListener('click', function () { triggerSaveCycle(); });
  });
}
```

Wire `triggerSaveCycle()` into existing `input` listeners (contenteditable, sol-name, tracking-input).

- [ ] **Step 4: Verify green**.

### Task 3: Error retry

- [ ] **Step 1: Spec**

```js
test('error state has clickable retry that returns to saving', async ({ page }) => {
  // force error by stubbing localStorage to throw
  await page.evaluate(() => {
    const orig = localStorage.setItem.bind(localStorage);
    localStorage.setItem = () => { throw new Error('quota'); };
  });
  // ...trigger save cycle
  await expect(page.locator('.save-indicator--error')).toBeVisible();
  // restore + click retry
  // ...
});
```

- [ ] **Step 2-4: TDD red-green**.

### Task 4: Audit + commit

- [ ] Capture 21 PNG with each save state forced (idle/saving/saved/error)
- [ ] Read PNGs vs mockup F line 2160-2174
- [ ] Write `audit/eyeball-plan-b-sb9a.md`
- [ ] jest 157/157 + Playwright 全 8 viewport regression
- [ ] Commit `feat(plan-b-sb9a): save indicator 4 狀態 visual cycle + localStorage 草稿`
- [ ] Update CLAUDE.md / PATH-2-HANDOFF.md / master spec
