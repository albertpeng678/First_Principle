---
date: 2026-05-16
stage: 1C
status: ready-for-implementation
scope: Phase 2 chat UI fix — qchip caret semantics + 上一步 inline
linked-mockup: docs/superpowers/specs/mockups/2026-05-16-stage-1c-phase2-chat-fix.md
linked-mockup-commit: 418900a
---

# Stage 1C — Phase 2 Chat UI Fix Design Spec (B5)

---

## §1 Context

### 症狀來源

2026-05-16 user PNG 22 report 指出 Phase 2 chat surface 兩個視覺 / 互動 drift：

**B5-BUG-1 — qchip caret 語意錯誤，無法展開**

`renderPhase2QchipHtml`（`public/app.js` line 791–798）目前輸出 `ph-caret-right` icon，語意為「跳頁 / 導覽」，而非「展開在地」。`data-phase2="qchip"` 事件在 `bindCirclesPhase2` 中未連接任何 handler，點擊無效。使用者預期的行為（對齊 Phase 1 q-card 全文可見）未被滿足。

Mockup 05 §A contract 已定義 qchip 為 compact bar；但 B5 mockup（commit `418900a`）依 user 回報 amend：改用 `ph-caret-down`，`.is-open` CSS rotate 180deg，新增 `.qchip-panel` 展開面板顯示 type badge + 完整 `problem_statement`。

**B5-BUG-2 — 上一步 button 渲染在 input bar 上方（生產漂移）**

`renderCirclesPhase2`（`public/app.js` lines 1005–1008, 1044）目前將 `backRowHtml`（`.phase-back-row` div）作為獨立 sibling 插在 `qchipHtml` 與 `inputBarHtml` 之間（line 1044），並由 `public/style.css` line 2007 獨立 block 排列。Mockup 05 §A 原始合約（`05-phase-2-chat.html` line 728）規定 `上一步` = `.input-bar__row` 的第一個子元素，與 textarea + send 同行。此為**還原生產漂移**，非新增設計。

### 修正摘要（3 項）

| # | 對象 | 修正方向 |
|---|---|---|
| Fix 1 | `renderPhase2QchipHtml` app.js ~797 | `ph-caret-right` → `ph-caret-down`；返回值後面緊接 `renderQchipPanelHtml` 產出的面板 HTML |
| Fix 2 | `renderCirclesPhase2` app.js ~1005–1044 | 移除 `backRowHtml` / `.phase-back-row`；將上一步 button 移入 `input-bar__row` 第一子元素 |
| Fix 3 | `public/style.css` | 新增 `.qchip-panel` / `.qchip-panel__type` / `.qchip-panel__body` / `.qchip-panel__close` 規則；移除 `.phase-back-row` block |

**範圍：** `renderCirclesPhase2` 是所有 7 個 CIRCLES drill/sim 步驟共用的唯一 Phase 2 render 路徑 → 修一次全步驟 (C1 / I / R / C2 / L / E / S) 都對齊。

---

## §2 Architecture

### 技術層級

純前端 CSS + render（無 API、無 fetch、無 AppState 欄位新增）：

```
app.js (public/)          style.css (public/)
├── renderPhase2QchipHtml    ├── .qchip (LOCKED — extend only)
│   └── [amended] caret-down │   └── .qchip__caret (LOCKED)
├── renderQchipPanelHtml     ├── .qchip-panel [NEW]
│   (new helper)             │   ├── .qchip-panel__type [NEW]
├── renderCirclesPhase2      │   ├── .qchip-panel__body [NEW]
│   └── [amended] inline     │   └── .qchip-panel__close [NEW]
│       back button          ├── .phase-back-row [REMOVE]
└── bindCirclesPhase2        └── .input-bar (LOCKED)
    └── [add] qchip toggle       └── .input-bar__row (LOCKED)
```

### 約束

- `feedback_locked_components_reuse`：qchip base class 已 LOCKED（mockup 05 放行）。本次只新增 `.qchip-panel` 系列與修改 icon；不重定義 `.qchip` 既有規則。
- `feedback_mockup_strict_compliance`：pixel-diff 0.5% 對 B5 mockup baseline（closed + open 兩狀態 × 3 vp = 6 snapshots）。
- `feedback_no_emoji`：icon 全用 Phosphor `ph-*`，無 emoji。
- `feedback_typography_system_ui`：字型 stack 延用既有 CSS variable `--font-sans`，不引入新字型。

---

## §3 Components

### 3.1 `renderPhase2QchipHtml(q)` — app.js ~774–799

**現狀（BEFORE）：**
```js
return '<button class="qchip" data-phase2="qchip">'
  + ...
  + '<i class="ph ph-caret-right qchip__caret"></i>'
  + '</button>';
```

**修正後（AFTER）：**
```js
return '<button class="qchip" data-phase2="qchip" aria-expanded="false">'
  + '<span class="qchip__icon"><i class="ph ph-bookmark-simple"></i></span>'
  + '<div class="qchip__main">'
  + '<div class="qchip__company">' + companyDisplay + '</div>'
  + '<div class="qchip__title">' + escHtml(qTitle) + '</div>'
  + '</div>'
  + '<i class="ph ph-caret-down qchip__caret"></i>'
  + '</button>';
```

變更點：`ph-caret-right` → `ph-caret-down`；補 `aria-expanded="false"`（toggle 時切換為 `"true"`）。

---

### 3.2 `renderQchipPanelHtml(q)` — 新 helper，插在 `renderPhase2QchipHtml` 之後定義

```js
function renderQchipPanelHtml(q) {
  var typeMap = { improve: '改善題', strategy: '策略題', design: '設計題' };
  var typeLabel = typeMap[q.question_type] || '設計題';
  var body = q.problem_statement || '';
  return '<div class="qchip-panel" data-phase2="qchip-panel">'
    + '<div class="qchip-panel__type"><i class="ph ph-tag"></i>' + escHtml(typeLabel) + '</div>'
    + '<div class="qchip-panel__body">' + escHtml(body) + '</div>'
    + '<button class="qchip-panel__close" data-phase2="qchip-panel-close">'
    + '<i class="ph ph-caret-up"></i>收合題目'
    + '</button>'
    + '</div>';
}
```

呼叫方式：在 `renderCirclesPhase2` 中，`renderPhase2QchipHtml(q)` 後緊接 `renderQchipPanelHtml(q)`，合成為：

```js
var qchipHtml = renderPhase2QchipHtml(q) + renderQchipPanelHtml(q);
```

同樣套用在 `renderCirclesPhase2Locked`（line 1053）與結論模式分支（line 892）的 `qchipHtml` 賦值。

---

### 3.3 `renderCirclesPhase2` — 移除 `.phase-back-row`，上一步移入 `input-bar__row`

**現狀（BEFORE）：**
```js
// line 1006-1008
var backRowHtml = '<div class="phase-back-row">'
  + '<button class="btn btn--ghost" data-phase2="back"><i class="ph ph-arrow-left"></i>上一步</button>'
  + '</div>';

// line 1028 inside inputBarHtml
var inputBarHtml = '<div class="input-bar">'
  + suggestHtml
  + '<div class="input-bar__row">'
  + '<textarea ...></textarea>'
  + '<button ...send...></button>'
  + '</div>'
  + ...
  + '</div>';

// line 1039-1046 return
return '<div data-view="circles" data-phase="2">'
  + progressHtml
  + phaseHeadHtml
  + qchipHtml
  + chatBodyHtml
  + backRowHtml   // ← 獨立 div 在 input-bar 前
  + inputBarHtml
  + '</div>';
```

**修正後（AFTER）：**
```js
// backRowHtml 變數整段刪除

var inputBarHtml = '<div class="input-bar">'
  + suggestHtml
  + '<div class="input-bar__row">'
  + '<button class="btn btn--ghost" data-phase2="back"><i class="ph ph-arrow-left"></i>上一步</button>'  // ← first child
  + '<textarea class="input-bar__textarea" placeholder="' + inputPlaceholder + '" rows="1"'
  + inputDisabled
  + ' data-phase2="message-input"></textarea>'
  + '<button class="input-bar__send' + sendClass + '" aria-label="' + (streaming ? '等待中' : '送出') + '"'
  + sendDisabled
  + ' data-phase2="send"><i class="ph ph-paper-plane-tilt"></i></button>'
  + '</div>'
  + '<div class="phase2-min-tip" style="display:none" data-phase2="min-tip">至少 5 字</div>'
  + '</div>';

// return 去掉 backRowHtml
return '<div data-view="circles" data-phase="2">'
  + progressHtml
  + phaseHeadHtml
  + qchipHtml       // qchip button + qchip-panel
  + chatBodyHtml
  + inputBarHtml    // 上一步 now inside input-bar__row
  + '</div>';
```

---

### 3.4 `bindCirclesPhase2` — 新增 qchip toggle handler

在現有 `backBtn` handler 之前插入：

```js
// ── qchip 展開面板 toggle ──
var qchipBtn = document.querySelector('[data-phase2="qchip"]');
var qchipPanel = document.querySelector('[data-phase2="qchip-panel"]');
function toggleQchipPanel(open) {
  if (!qchipBtn || !qchipPanel) return;
  if (open) {
    qchipBtn.classList.add('is-open');
    qchipBtn.setAttribute('aria-expanded', 'true');
    qchipPanel.classList.add('is-open');
  } else {
    qchipBtn.classList.remove('is-open');
    qchipBtn.setAttribute('aria-expanded', 'false');
    qchipPanel.classList.remove('is-open');
  }
}
if (qchipBtn) {
  qchipBtn.addEventListener('click', function () {
    toggleQchipPanel(!qchipBtn.classList.contains('is-open'));
  });
}
var qchipCloseBtn = document.querySelector('[data-phase2="qchip-panel-close"]');
if (qchipCloseBtn) {
  qchipCloseBtn.addEventListener('click', function (e) {
    e.stopPropagation();  // 避免冒泡觸發 qchipBtn click
    toggleQchipPanel(false);
  });
}
```

---

### 3.5 `public/style.css` — 新增 `.qchip-panel` 規則；移除 `.phase-back-row`

**移除**（line 2007–2014）：

```css
/* phase-back row (上一步) */
.phase-back-row {
  padding: var(--s-2) var(--s-4);
  background: transparent;
  max-width: 920px;
  margin: 0 auto;
  width: 100%;
  display: flex;
}
```

**新增**（緊接在現有 `.qchip__caret` 規則之後）：

```css
/* qchip caret rotate on open (Stage 1C B5 fix) */
.qchip.is-open .qchip__caret { transform: rotate(180deg); }

/* qchip expand panel */
.qchip-panel {
  display: none;
  background: var(--c-surface);
  border-bottom: 1px solid var(--c-rule);
  padding: var(--s-3) var(--s-5);
}
.qchip-panel.is-open { display: block; }
.qchip-panel__type {
  display: inline-flex;
  align-items: center;
  gap: var(--s-1);
  padding: 2px var(--s-2);
  background: var(--c-navy-lt);
  color: var(--c-navy);
  font-size: var(--t-cap);
  font-weight: 600;
  border-radius: var(--r-pill);
  letter-spacing: 0.04em;
  margin-bottom: var(--s-3);
}
.qchip-panel__body {
  font-size: var(--t-body-sm);
  color: var(--c-ink);
  line-height: 1.7;
}
.qchip-panel__close {
  margin-top: var(--s-3);
  display: inline-flex;
  align-items: center;
  gap: var(--s-1);
  font-size: var(--t-cap);
  color: var(--c-ink-3);
  cursor: pointer;
}
.qchip-panel__close:hover { color: var(--c-ink); }
```

---

## §4 Data Flow

### qchip toggle（純 DOM 操作，無 AppState mutation）

```
使用者點擊 .qchip[data-phase2="qchip"]
  │
  ▼
bindCirclesPhase2: qchipBtn click handler
  │  toggleQchipPanel(!isOpen)
  ▼
classList.toggle('is-open') on qchipBtn + qchipPanel
aria-expanded 切換 "true" / "false"
  │
  ▼ CSS
.qchip.is-open .qchip__caret { transform: rotate(180deg) }
.qchip-panel.is-open { display: block }
  │
  ▼
panel 展開顯示 type badge + problem_statement 全文
```

```
使用者點擊 .qchip-panel__close[data-phase2="qchip-panel-close"]
  │  e.stopPropagation()
  ▼
toggleQchipPanel(false) → 收合
```

### 上一步 button（行為不變，只搬位置）

```
使用者點擊 [data-phase2="back"]
  │  (現有 handler 不動)
  ▼
AppState.circlesPhase = 1
render()
```

### render() 呼叫時 qchip panel 狀態重置

由於 `qchip-panel` 的 `is-open` 狀態**不存在 AppState**，每次 `render()` 重繪後 panel 預設收合（`display: none`）。此為預期行為：換步驟後 panel 不保留展開狀態，使用者需重新點擊展開。若未來需要跨 render 保留展開狀態，可加 `AppState.circlesPhase2QchipOpen` boolean（屬 Stage 1D 後續決策，本次 out of scope）。

---

## §5 Error Handling

本次修正為純前端 DOM toggle，無 fetch / SSE / async：

| 情境 | 處理方式 |
|---|---|
| `qchipBtn` 或 `qchipPanel` 為 null（例如在 locked / conclusion 分支）| `toggleQchipPanel` 開頭 null guard：`if (!qchipBtn \|\| !qchipPanel) return;` |
| `qchipCloseBtn` 為 null（理論上不應發生）| `if (qchipCloseBtn)` guard 保護 |
| `e.stopPropagation` 需要防止雙觸發 | close button 內含，已在 handler 實作 |
| streaming 中使用者展開 qchip panel | 允許（panel toggle 不影響 streaming）；back button 照舊 disabled 判斷靠 streaming state（現有邏輯不動）|
| `problem_statement` 缺值（空字串）| `renderQchipPanelHtml` 以空字串渲染，`.qchip-panel__body` 顯示空白但 panel 仍可展開，不 crash |

---

## §6 Testing

### 6.1 Visual regression（Playwright snapshot diff，0.5% 容忍）

測試檔位置：`tests/visual/`（visual config，排除 `_quarantine_prod_legacy/`）

| Snapshot 名稱 | Viewport | 狀態 | 驗證重點 |
|---|---|---|---|
| `phase2-qchip-closed-mobile` | 360 × 880 | qchip 收合（預設）| caret-down 可見，panel 不可見（display:none），上一步在 input-bar__row 第一位 |
| `phase2-qchip-open-mobile` | 360 × 880 | qchip 展開 | caret rotate 180deg，panel 可見，type badge + body 文字 |
| `phase2-qchip-closed-tablet` | 768 × 880 | qchip 收合 | 同 mobile closed，tablet 寬度 |
| `phase2-qchip-open-tablet` | 768 × 880 | qchip 展開 | 同 mobile open，tablet 寬度 |
| `phase2-qchip-closed-desktop` | 1280 × 880 | qchip 收合 | desktop companyDisplay suffix 顯示（Drill mode · 設計題）|
| `phase2-qchip-open-desktop` | 1280 × 880 | qchip 展開 | panel 展開，全文可見 |

Baseline 從 B5 mockup commit `418900a` 截圖產生。

### 6.2 E2E tests（Stage 1A config `tests/e2e/playwright.config.js`）

測試檔：`tests/e2e/phase2-ui-fix.spec.js`（新建）

**Test suite 1 — qchip 展開 / 收合**

```
describe('Phase 2 qchip expand panel', () => {
  // 前置：login + 選題 + 進入 Phase 2
  test('qchip 預設收合，panel display:none', async ({ page }) => { ... })
  test('點擊 qchip → panel 出現，caret 旋轉，aria-expanded=true', async ({ page }) => { ... })
  test('點擊「收合題目」→ panel 消失，caret 還原，aria-expanded=false', async ({ page }) => { ... })
  test('再次點擊 qchip → 收合（toggle back）', async ({ page }) => { ... })
  test('render() 後 panel 回到預設收合狀態', async ({ page }) => {
    // 觸發 render（例如送出一條訊息）→ qchipPanel 不再有 is-open
  })
})
```

**Test suite 2 — 上一步 button inline**

```
describe('Phase 2 上一步 button inline in input-bar__row', () => {
  test('上一步 button 是 .input-bar__row 的第一個子元素', async ({ page }) => {
    // 驗 .input-bar__row > button:first-child 有 data-phase2="back"
    // 驗 DOM 中不存在 .phase-back-row
  })
  test('上一步 button boundingBox Y 與 textarea Y 差 <= 4px（同行對齊）', async ({ page }) => { ... })
  test('點擊上一步 → 回到 Phase 1（AppState.circlesPhase = 1）', async ({ page }) => { ... })
})
```

Projects 匹配：`e2e-desktop`（Desktop Chrome）+ `e2e-mobile-chrome`（Pixel 5）+ `e2e-mobile-safari`（iPhone 14）。

### 6.3 jest 基線保護

本次修正不觸碰任何後端 / API / 商業邏輯，jest 214/232 基線不受影響。實作後跑 `npm test` 確認不回歸。

---

## §7 Acceptance Criteria

| ID | 標準 | 驗證方式 |
|---|---|---|
| B5-AC1 | `renderPhase2QchipHtml` 輸出 `ph-caret-down`；不含 `ph-caret-right` | grep + E2E DOM check |
| B5-AC2 | 點擊 qchip button → `.qchip-panel` 取得 `.is-open`，展開顯示 type badge + 完整 `problem_statement`；caret 旋轉 180deg；`aria-expanded="true"` | E2E suite 1 test 2 |
| B5-AC3 | 點擊「收合題目」或再次點擊 qchip → panel 收合，caret 還原，`aria-expanded="false"` | E2E suite 1 test 3 + 4 |
| B5-AC4 | DOM 中無 `.phase-back-row` 元素；`上一步` button 為 `.input-bar__row` 的第一個子元素，`boundingBox Y` 與 textarea 同行（差距 ≤ 4px） | E2E suite 2 test 1 + 2 |
| B5-AC5 | 6 viewport × 2 state snapshot（closed / open × mobile 360 / tablet 768 / desktop 1280）pixel diff ≤ 0.5%，對齊 B5 mockup commit `418900a` | Visual regression 6.1 |

---

## §8 Out of Scope

以下需求**不在**本次 Stage 1C 實作範圍：

| 項目 | 說明 | 預計階段 |
|---|---|---|
| 教練提示 hint markdown 渲染 | `bubble--coach__hint-toggle` 目前展開文字無 markdown 處理（code block、條列）；純文字渲染不變 | Stage 1D |
| qchip panel 展開狀態跨 render 保留 | 目前 render() 後 panel 重置收合；AppState 需新增 boolean 欄位才可保留 | Stage 1D |
| `renderCirclesPhase2Locked`（Section F）的 back button 行為 | Locked 分支使用 `go-phase1` / `go-phase3` 兩個 button，layout 獨立，不套用 input-bar__row 模式 | 不需改動 |
| NSM Phase 2（`renderNsmStep4` 等）qchip | NSM qchip 結構不同（pill + scenario），不共用 `renderPhase2QchipHtml` | 不在 CIRCLES Phase 2 範圍 |
| 任何後端 / API / prompt 更動 | Path 2 carve-out：backend / OpenAI prompts 鎖死 | 不適用 |

---

## §9 References

| 文件 | 說明 |
|---|---|
| `docs/superpowers/specs/mockups/2026-05-16-stage-1c-phase2-chat-fix.md` | B5 fix mockup（commit `418900a`）— 本 spec 的視覺合約 |
| `docs/superpowers/specs/mockups/2026-05-02-frontend-rewrite/05-phase-2-chat.html` | 原始 mockup 05 §A — `上一步` inline 原始合約（line 728） |
| `public/app.js` lines 774–799 | `renderPhase2QchipHtml` 現狀 |
| `public/app.js` lines 846–1048 | `renderCirclesPhase2` 現狀（含 `backRowHtml` line 1006） |
| `public/app.js` lines 6671–6900 | `bindCirclesPhase2` event handler 現狀 |
| `public/style.css` line 2007–2014 | `.phase-back-row` 現狀（待移除） |
| `tests/e2e/playwright.config.js` | Stage 1A E2E config — 本次新增 spec 置於 `tests/e2e/` |
| CLAUDE.md | Standing rules：feedback_locked_components_reuse / feedback_mockup_strict_compliance / feedback_no_emoji / feedback_typography_system_ui |
