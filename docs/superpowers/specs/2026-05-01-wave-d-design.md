# Wave D 修復設計 — Audit Cycle 2026-04-30 Phase 5 使用者新需求

**Status:** 待使用者覆核（已逐項放行 mockup）
**Date:** 2026-05-01
**Cycle:** `audit/cycles/2026-04-30/issues-master.md`
**Director:** main thread
**Base:** Wave C 完工後的 main HEAD（C1 commit `1060bea` 已收，等 C2/C3）

## 範圍

使用者在 Wave C 跑期間新報的 5 個需求，全部 mockup 已放行。

| ID | 內容 | 視覺策略 |
|---|---|---|
| D-1 | 首頁 simulation 卡片 copy「無提示」改正向 | 文字改 |
| D-2 | 行動版送出錯誤訊息破版 — alert 卡放 sticky 上方 | DOM 結構小調 |
| D-3 | drill mode 移除 上一步按鈕（A 案）+ 完成個別步驟後 encourage card | A 案 + 鼓勵卡 |
| D-4 | 對話練習頁 home icon 視覺修（margin-left:auto + 圓底）— 全 nav 統一 | CSS |
| D-5 | 全站中文字型統一 system-ui | --c-font-sans token 改寫 |

## 測試門檻

延續共通標準：jest + audit-master × 8 viewport + rwd-visual-gate × 8 viewport 全綠。**D-5 字型修動 director 必親跑**（記憶有規範）。

---

## D-1 · simulation 卡片 copy

### Bug
`public/app.js:2149` simulation mode card：
```js
'<div class="circles-mode-card-desc">25-35 分鐘 · 全 7 步 · 無提示</div>'
```
「無提示」實際不真，且嚇退使用者。

### 修
改成：
```js
'<div class="circles-mode-card-desc">25-35 分鐘 · 全 7 步 · 提示與範例隨時可看</div>'
```

---

## D-2 · 錯誤訊息 alert 卡

### Bug
`public/app.js:3219-3234` 把 errEl div `insertBefore(errEl, btn)` 進 `.circles-submit-bar`（flex sticky row），mobile-360 上錯誤訊息與按鈕擠在一行破版。

### 修
1. errEl 改 insert 進 submit-bar **上方**（同層父 container 的 sticky bar 之前）。
2. errEl 樣式改：
   ```js
   errEl.style.cssText = 'background: #fef2f2; border: 1px solid #fecaca; border-left: 3px solid #ef4444; color: #991b1b; font-size: 12px; padding: 8px 12px; margin: 0 8px 6px; border-radius: 6px; line-height: 1.6; word-break: break-word;';
   ```
3. innerHTML 結構：
   ```html
   <i class="ph ph-warning"></i> <strong>還有 N 個欄位需要填寫</strong><br><span style="font-size:11px;color:#7f1d1d">label1 · label2 · ...</span>
   ```
4. insert 點：找 submit-bar 父層，把 errEl insert 在 submit-bar 之前（`btn.parentNode.parentNode.insertBefore(errEl, btn.parentNode)`）。

---

## D-3 · drill 移除 上一步 + 完成鼓勵

### A 案 — 移除 drill 上一步
Wave A fix-A3 在 submit bar 加的 `#circles-p1-prev` 邏輯裡：
```js
var showPrev = !isFirstDrillStep && stepIdx > 0;
```

改：
```js
// drill mode 是個別步驟訓練，不允許跨步
var showPrev = AppState.circlesSession?.mode === 'simulation' && stepIdx > 0;
```

drill mode 全部不顯示 上一步；simulation 維持。

### Drill 完成鼓勵卡
完成 drill mode 該步、看到 step-score 評分頁時，加 encourage card。

找 `renderCirclesStepScore` 函式（約 line 3854 附近），在 step-score 內容下方插：

```js
function buildDrillCompleteEncourageHtml() {
  if (AppState.circlesSession?.mode !== 'drill') return '';
  return '<div class="drill-encourage-card">' +
    '<h4>🎯 想要完整體驗 PM 思考流程？</h4>' +
    '<p>你剛完成單一步驟，做得不錯！要不要試試 <strong>完整步驟訓練</strong>？25-35 分鐘走完 7 步驟，看完整框架如何串成一個解決方案。</p>' +
    '<div class="encourage-actions">' +
      '<button id="drill-encourage-go" type="button">試試完整步驟訓練 →</button>' +
      '<button id="drill-encourage-dismiss" type="button">下次再說</button>' +
    '</div>' +
  '</div>';
}
```

handler：
```js
document.getElementById('drill-encourage-go')?.addEventListener('click', function() {
  // 用同一題開新 simulation session
  var q = AppState.circlesSelectedQuestion;
  localStorage.setItem('circlesMode', 'simulation');
  AppState.circlesMode = 'simulation';
  AppState.circlesSession = null;
  AppState.circlesPhase = 1;
  AppState.circlesSimStep = 0;
  AppState.circlesStepDrafts = {};
  AppState.circlesFrameworkDraft = {};
  if (q) {
    AppState.circlesSelectedQuestion = q;
    // 直接開始 simulation
    triggerCirclesAutoSave();
    render();
  } else {
    AppState.view = 'circles';
    render();
  }
});
document.getElementById('drill-encourage-dismiss')?.addEventListener('click', function() {
  document.querySelector('.drill-encourage-card')?.remove();
});
```

CSS：
```css
.drill-encourage-card {
  background: linear-gradient(135deg, #ede9fe 0%, #fef3c7 100%);
  border: 1px solid #c4b5fd;
  border-radius: 12px;
  padding: 16px;
  margin: 16px 0;
}
.drill-encourage-card h4 { margin: 0 0 6px; font-size: 14px; color: #4c1d95; }
.drill-encourage-card p { margin: 0 0 12px; font-size: 12.5px; color: var(--c-text-2); line-height: 1.6; }
.drill-encourage-card .encourage-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.drill-encourage-card .encourage-actions button {
  min-height: 44px; padding: 10px 14px; border-radius: 8px;
  font-size: 12px; cursor: pointer; box-sizing: border-box;
}
.drill-encourage-card #drill-encourage-go {
  background: var(--c-primary); color: #fff; border: none;
}
.drill-encourage-card #drill-encourage-dismiss {
  background: #fff; color: var(--c-text-2); border: 1px solid #d4d4d8;
}
```

---

## D-4 · home icon 視覺修（全站 nav）

### Bug
`.circles-nav` flex row 沒給 home icon `margin-left: auto`，標題短時 icon 緊貼 turn-counter，Phase-1/2/3/4 + NSM step 都中招。

### 修
`public/style.css`：
```css
/* 讓 nav title block 撐到底，把 home icon 推到右 */
[data-view="circles"] .circles-nav > div:first-of-type {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
}
[data-view="circles"] .circles-nav .circles-nav-title,
[data-view="circles"] .circles-nav .circles-nav-sub {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* home icon 視覺強化：圓底 + primary 色 */
.btn-home-icon {
  margin-left: auto;
  background: rgba(91, 33, 182, 0.06);
  border: 1px solid rgba(91, 33, 182, 0.18);
  border-radius: 50%;
  color: var(--c-primary);
}
.btn-home-icon:hover {
  background: rgba(91, 33, 182, 0.12);
  border-color: rgba(91, 33, 182, 0.32);
}
.btn-home-icon:focus-visible {
  outline: 2px solid var(--c-primary);
  outline-offset: 2px;
}
```

涵蓋 Phase-1 / Phase-2 chat / Phase-3 score / Phase-4 final report / NSM 各 sub-tab navbar。

---

## D-5 · 全站中文字型 system-ui

### 修
`public/style.css` :root token：
```css
:root {
  /* Wave D — system-ui CJK chain (替換 wave-c-fix-C1 的 'DM Sans' first stack) */
  --c-font-sans: system-ui, -apple-system, BlinkMacSystemFont, 'PingFang TC', 'Microsoft JhengHei', 'Heiti TC', 'Noto Sans TC', sans-serif;
}
```

**保留例外**：Phase-4 grade letter 仍用 `'Instrument Serif', serif`（刻意 serif 對比）。

### 全站清掃
- grep 殘留 `'DM Sans'` 字串，全改 `var(--c-font-sans)`。
- inline `font-family:` 改 `font-family: inherit`。
- 注意 Wave C-1 1060bea 已把 113 處 font-family 收成 token；本次只動 token 內容。

### Director 親驗
記憶 `feedback_typography_system_ui.md` 規定：
1. 8 viewport project 截圖 spot-check
2. macOS Safari + iOS Safari + Windows Chrome（user-agent simulate）至少各 sample 一次
3. 注音 / 全形標點 / 中英混排測試
4. Grade letter 仍 Instrument Serif 不被覆蓋

---

## 實作分配

| Agent | Cluster | 主要檔案 |
|---|---|---|
| fix-D1 | D-1 + D-2 + D-5 | `public/app.js` (copy + error toast) + `public/style.css` (system-ui token) |
| fix-D2 | D-3 + D-4 | `public/app.js` (drill 移 prev + encourage card) + `public/style.css` (encourage + home icon nav) |

**派 2 個 implementer 並行**（worktree 隔離）。fix 範圍互不重疊。

## TDD spec 落點

- `tests/playwright/journeys/audit/master-D1-D5-mocked.spec.js`
  - D-1：simulation 卡 desc 含「提示與範例隨時可看」
  - D-2：mobile-360 fill 不完整 textarea，submit，斷言 `.circles-form-error-card` 在 submit-bar 上方且不擠在 flex row
  - D-3：drill mode step I 沒有 `#circles-p1-prev`；simulation step 1 有
  - D-3：drill 完成 step-score 頁有 `.drill-encourage-card`
  - D-4：phase-2 chat navbar `.btn-home-icon` 有 `margin-left: auto` computed
  - D-5：`getComputedStyle(body).fontFamily` 含 'system-ui' 不含 'DM Sans'

## 全套 verification（director 親跑）

```bash
npm test 2>&1 | tail -5
PMDRILL_BASE_URL=http://localhost:4000 npx playwright test \
  --config=tests/playwright/playwright.config.js \
  journeys/audit/ \
  --workers=4 --reporter=line 2>&1 | tail -10
```

## 完工門檻

- [ ] 三層測試（SIT / UAT / UI-UX）全綠
- [ ] D-5 字型 director 親跑 8 viewport 截圖比對
- [ ] D-3 drill 移 prev + 完成鼓勵 click 流程驗證
- [ ] D-4 home icon 在 4+ navbar 都靠右且有圓底
- [ ] D-1 D-2 copy / error 更新確認
