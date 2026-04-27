# CIRCLES + NSM UX Mockup Spec — 2026-04-26

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** This document is the complete implementation spec derived from the approved mockup at `/tmp/pm-drill-full-mockup.html`. It covers every screen, every interaction state, every CSS token, and every JS behavior — written at implementation-ready detail so that tomorrow's self can build without losing any context.

**Architecture:** Single-file SPA (`public/app.js` + `public/style.css`). Backend routes already exist (`routes/circles-sessions.js`, `routes/guest-circles-sessions.js`, `routes/nsm-sessions.js`, `routes/guest-nsm-sessions.js`). The mockup is canonical truth — if there is any conflict between this spec and other sources, the mockup HTML wins.

**Mockup location:** `/tmp/pm-drill-full-mockup.html` (open with `python3 -m http.server 8989 &` in /tmp, then http://localhost:8989/pm-drill-full-mockup.html)

**Tech Stack:** Vanilla JS (ES5-compatible), Node/Express, Supabase, OpenAI gpt-4o, Phosphor Icons, DM Sans font only (no Instrument Serif in nav/titles — see Screen 6 score number only)

**Status:** Mockup complete for Screens 1–11. Implementation NOT yet started on items in this doc (2026-04-26). Must complete all mockup screens before any implementation begins (see MEMORY rule).

---

## ★ WHAT IS CIRCLES? (Read This First — Every Time)

**CIRCLES 是一個 PM 面試結構化答題框架**，全名為 7 個步驟的縮寫。面試官問「你會怎麼改善 Spotify？」，考生需要按 C→I→R→C→L→E→S 順序逐步拆解，而不是直接跳到解法。

本 App 的訓練核心是幫 PM 面試者練習這 7 個步驟。每個步驟都有：
1. **Phase 1**：填寫框架欄位（4個）
2. **Phase 1.5**：AI 審核方向正確性（Gate）
3. **Phase 2**：與 AI 對話練習（用戶扮演 PM 訪談者，向 AI 扮演的產品負責人提問）
4. **Phase 3**：步驟得分 + 教練回饋

### 7 個步驟完整定義

| 步驟 | 中文名 | 核心任務 | 4 個框架欄位 |
|------|--------|---------|-------------|
| **C1** | 澄清情境 | 釐清問題邊界、時間範圍、業務限制、假設 | 問題範圍、時間範圍、業務影響、假設確認 |
| **I** | 定義用戶 | 用戶分群 → 選定焦點用戶 → 理解動機 | 目標用戶分群、選定焦點、用戶動機假設、排除對象 |
| **R** | 發掘需求 | 從功能/情感/社交三層次挖掘需求與痛點 | 功能性需求、情感性需求、社交性需求、核心痛點 |
| **C2** | 優先排序 | 訂出取捨標準 → 排出優先級 → 說明理由 | 取捨標準、最優先項目、暫緩項目、排序理由 |
| **L** | 提出方案 | 提出 2-3 個差異化方案（各附短名稱標籤） | 方案一（含名稱）、方案二（含名稱）、方案三（可選，含名稱） |
| **E** | 評估取捨 | 分析每個方案的優缺點、風險、成功指標 | 方案優點、方案缺點、風險與依賴、成功指標 |
| **S** | 總結推薦 | 選定方案、說明理由、定義北極星指標 | 推薦方案、選擇理由、**北極星指標**、追蹤指標 |

> **S 步驟特別說明：** 「北極星指標」欄位是 NSM 訓練的濃縮版。S 步驟的 Phase 1 會顯示一個藍色 annotation box：「此步驟的北極星指標欄位是 NSM 訓練的濃縮版。想深入練習？前往 NSM 訓練 →」

### 兩種訓練模式

- **完整模擬（simulation）**：走完全部 7 步驟，最後產出總結報告。Gate 遇到 error 仍可繼續（canProceed=true），但標記問題供參考。
- **步驟加練（drill）**：只練一個步驟。Gate 遇到 error 強制返回修改（canProceed=false）。

### Phase 2 對話的關鍵規則（必記）

- **用戶是 PM 訪談者**，AI 扮演 3 個角色同時回應
- **被訪談者**：公司產品負責人，問題模糊就給模糊答案，絕不主動說「你應該這樣做」
- **教練點評**：點評這輪探索的品質，最多 2 句
- **教練提示**：下一輪方向提示，**永遠預設折疊**，用戶點擊才展開
- AI 回覆格式固定：`【被訪談者】\n...\n\n【教練點評】\n...\n\n【教練提示】\n...`
- ≥ 3 輪後出現提交按鈕 → 用戶整理結論 → 8 秒 AI 偵測 → 通過才可提交

### Phase 1.5 Gate 判斷規則

- `error`：方向性錯誤，會誤導後續整個分析
- `warn`：不完整但不致命，可在對話中補充
- `ok`：方向正確
- `canProceed = false` 僅在 drill 模式 + 有 error 時
- simulation 模式：永遠 `canProceed = true`（即使有 error）

---

## CSS Tokens (Canonical)

All UI uses these exact variables. Never hardcode hex colors except where noted.

```css
:root {
  --c-primary:     #1A56DB;
  --c-primary-lt:  rgba(26,86,219,0.08);
  --c-primary-dim: #C8D8FF;
  --c-surface:     #F2F0EB;   /* page background */
  --c-card:        #ffffff;   /* card / navbar background */
  --c-border:      rgba(0,0,0,0.08);
  --c-text:        #1a1a1a;
  --c-text-2:      #5a5a5a;
  --c-text-3:      #8a8a8a;
}
```

Font: `DM Sans` everywhere. `Instrument Serif` ONLY for the large score number (`.score-number`, `.nsm-score-num`).

---

## Shared Components

### Navbar (top bar)

```html
<nav class="navbar">
  <span class="navbar-logo">PM Drill</span>
  <button class="btn-ghost">北極星指標</button>   <!-- navigates to nsm -->
  <button class="btn-ghost" style="color:var(--c-primary)">登入</button>  <!-- guest only -->
  <!-- OR: email + logout icon for auth users -->
  <button class="btn-icon"><i class="ph ph-list"></i></button>  <!-- opens offcanvas -->
</nav>
```

CSS:
```css
.navbar {
  height: 52px; background: var(--c-card);
  border-bottom: 1px solid #e8e5de;
  display: flex; align-items: center; padding: 0 16px; gap: 8px;
  position: sticky; top: 0; z-index: 100;
}
.navbar-logo { font-family: 'DM Sans', sans-serif; font-size: 16px; font-weight: 700; flex: 1; color: var(--c-text); }
.btn-ghost { background: none; border: none; font-size: 13px; font-weight: 500; color: var(--c-text); cursor: pointer; padding: 4px 8px; border-radius: 6px; font-family: 'DM Sans', sans-serif; }
.btn-icon { background: none; border: none; font-size: 1.1rem; cursor: pointer; color: var(--c-text-2); padding: 6px; border-radius: 6px; display: flex; align-items: center; }
```

### CIRCLES Sub-Navbar (used in all training phases)

```html
<div class="circles-nav">
  <button class="circles-nav-back" id="XXX-back"><i class="ph ph-arrow-left"></i></button>
  <div>
    <div class="circles-nav-title">STEP LABEL</div>
    <div class="circles-nav-sub">Company · Product</div>
  </div>
  <button class="circles-nav-home-btn" id="XXX-home">回首頁</button>
</div>
```

CSS:
```css
.circles-nav { background: var(--c-card); border-bottom: 1px solid var(--c-border); padding: 10px 14px; display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
.circles-nav-back { background: none; border: none; font-size: 1.1rem; cursor: pointer; color: var(--c-text-2); padding: 4px; display: flex; align-items: center; flex-shrink: 0; }
.circles-nav > div { flex: 1; min-width: 0; }
.circles-nav-title { font-size: 14px; font-weight: 700; color: var(--c-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-family: 'DM Sans', sans-serif; }
.circles-nav-sub { font-size: 11px; color: var(--c-text-3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-family: 'DM Sans', sans-serif; }
.circles-nav-home-btn { font-size: 12px; color: var(--c-primary); border-bottom: 1px solid var(--c-primary); background: none; border-top: none; border-left: none; border-right: none; padding: 2px 0; cursor: pointer; font-family: 'DM Sans', sans-serif; white-space: nowrap; flex-shrink: 0; }
```

### Progress Bar (7 segments, used in Phase 1 and Phase 2)

```html
<div class="circles-progress">
  <div class="circles-progress-seg active"></div>   <!-- current step -->
  <div class="circles-progress-seg done"></div>     <!-- completed steps -->
  <div class="circles-progress-seg"></div>          <!-- future steps -->
  <!-- ... 7 total -->
  <div class="circles-progress-label">C · 澄清情境 · 1/7</div>
</div>
```

CSS:
```css
.circles-progress { display: flex; align-items: center; gap: 3px; padding: 8px 14px; background: var(--c-card); border-bottom: 1px solid var(--c-border); flex-shrink: 0; }
.circles-progress-seg { height: 3px; flex: 1; border-radius: 2px; background: #e8e5de; }
.circles-progress-seg.active { background: var(--c-primary); }
.circles-progress-seg.done   { background: var(--c-primary-dim); }
.circles-progress-label { font-size: 10px; color: var(--c-text-3); white-space: nowrap; margin-left: 6px; font-family: 'DM Sans', sans-serif; }
```

### Step Pills (scrollable horizontal, used in Phase 1)

```html
<div class="circles-step-pills">
  <button class="step-pill active">C 澄清情境</button>
  <button class="step-pill done">I 定義用戶</button>
  <button class="step-pill">R 發掘需求</button>
  <!-- ... 7 total: C I R C L E S -->
</div>
```

CSS:
```css
.circles-step-pills { display: flex; gap: 6px; padding: 10px 14px; background: var(--c-card); border-bottom: 1px solid var(--c-border); overflow-x: auto; scrollbar-width: none; }
.circles-step-pills::-webkit-scrollbar { display: none; }
.step-pill { font-size: 11px; font-weight: 600; padding: 6px 12px; border-radius: 20px; white-space: nowrap; cursor: pointer; border: 1px solid var(--c-border); background: var(--c-card); color: var(--c-text-2); font-family: 'DM Sans', sans-serif; min-height: 32px; }
.step-pill.active { background: var(--c-primary); color: #fff; border-color: var(--c-primary); }
.step-pill.done { background: #e6f0e8; color: #137A3D; border-color: #b8dbbf; }
```

---

## Screen 1: CIRCLES Home (`renderCirclesHome`)

**Mockup 來源路徑：** `.superpowers/brainstorm/home-2026-04-27/content/circles-home-mockup.html`（直接用瀏覽器開啟即可預覽，含 **7 個互動狀態**）。**此 HTML 是實作的視覺真相來源（canonical visual truth）——若 spec 文字與此畫面有出入，以此 HTML 為準。**

**Mockup 7 screens 對應：**
| Screen | 說明 |
|--------|------|
| 1 | 首頁預設（完整模擬已選，info 折疊，產品設計 tab active，5 卡折疊） |
| 2 | Info Card 展開（caret-down，說明文字 + 7 步驟色塊可見） |
| 3 | 步驟加練 mode 選中（3 個 step pills 出現：C1/I/R，下方顯示「C2、L、E、S 需在完整模擬中練習」提示） |
| 4 | step pill 已選（R 發掘需求 active，其餘 2 pills 未選） |
| 5 | 題型 tab 篩選（產品改進 active，題目列表重新抽取） |
| 6 | 題目展開—完整模擬（border primary，完整題幹，確認/取消） |
| 7 | 題目展開—步驟加練（R pill active + 題目展開，最終確認狀態） |

**Route/view:** `view: 'circles'` (this is the default view — app opens here)

**AppState defaults:**
```javascript
circlesMode: localStorage.getItem('circlesMode') || 'simulation', // 'drill' | 'simulation'
circlesSelectedType: 'design',   // 'design' | 'improve' | 'strategy'
circlesDrillStep: 'C1',          // which step to drill; default 'C1'
```

### Layout

```
Navbar (PM Drill | 北極星指標 | 登入 | ☰)
─────────────────────────────────────
[Scrollable content: circles-home-wrap]
  Title:       "CIRCLES 訓練" (DM Sans 22px bold)
  Sub:         "選題，按步驟填寫框架、訪談、拿到評分" (13px c-text-2)
  [Info card — COLLAPSED by default, toggleable]
  section label: "練習模式"
  [Mode selector — 2 cards side-by-side]
  [Step Pills — 只在 drill mode 顯示，位於 mode cards 與 type tabs 之間]
  [Type Tabs — 3 tabs: 產品設計 / 產品改進 / 產品策略]
  [Question list header: "選擇題目" + 隨機選題 button]
  [Up to 20 question cards — expand-on-click accordion]
  [NSM Banner]
```

---

### Info Card (collapsed by default)

"什麼是 CIRCLES 實戰訓練？" card is **collapsed by default**. Only the header button is visible; clicking it expands the body. Clicking again collapses.

```html
<div class="circles-info-card" style="padding:0;overflow:hidden">
  <button onclick="toggleInfoCard(this)"
    style="width:100%;display:flex;align-items:center;justify-content:space-between;background:none;border:none;cursor:pointer;padding:12px 14px;text-align:left">
    <div class="circles-info-card-title" style="margin:0;font-size:13px">什麼是 CIRCLES 實戰訓練？</div>
    <i class="ph ph-caret-right" id="info-card-icon" style="font-size:13px;color:var(--c-text-3);flex-shrink:0"></i>
  </button>
  <div id="info-card-body" style="display:none;padding:0 14px 14px">
    <div class="circles-info-card-sub">用結構化框架拆解 PM 設計面試題，模擬真實利害關係人訪談，並在每個步驟收到 AI 教練評分與回饋。</div>
    <div class="circles-info-steps">
      <span class="circles-info-step">C 澄清情境</span>
      <span class="circles-info-step">I 定義用戶</span>
      <span class="circles-info-step">R 發掘需求</span>
      <span class="circles-info-step">C 優先排序</span>
      <span class="circles-info-step">L 提出方案</span>
      <span class="circles-info-step">E 評估取捨</span>
      <span class="circles-info-step">S 總結推薦</span>
    </div>
  </div>
</div>
```

JS toggle:
```javascript
function toggleInfoCard(btn) {
  var body = document.getElementById('info-card-body');
  var icon = document.getElementById('info-card-icon');
  if (!body) return;
  var open = body.style.display !== 'none';
  body.style.display = open ? 'none' : 'block';
  if (icon) icon.className = open ? 'ph ph-caret-right' : 'ph ph-caret-down';
}
```

CSS:
```css
.circles-info-card { background: var(--c-card); border: 1px solid #e8e5de; border-radius: 10px; margin-bottom: 20px; overflow: hidden; }
.circles-info-card-title { font-size: 13px; font-weight: 700; color: var(--c-text); font-family: 'DM Sans', sans-serif; }
.circles-info-card-sub { font-size: 12px; color: var(--c-text-2); line-height: 1.6; margin-bottom: 10px; font-family: 'DM Sans', sans-serif; }
.circles-info-steps { display: flex; flex-wrap: wrap; gap: 6px; }
.circles-info-step { font-size: 11px; color: var(--c-primary); font-weight: 600; background: var(--c-primary-lt); border-radius: 4px; padding: 2px 7px; font-family: 'DM Sans', sans-serif; }
```

---

### Mode Selector

Section label `"練習模式"` appears above the two cards. **完整模擬 is on the LEFT; 步驟加練 is on the RIGHT.** Default selected is `AppState.circlesMode` (persisted to `localStorage`; falls back to `'simulation'`).

Clicking a card: sets `AppState.circlesMode`, saves to localStorage, re-renders the step pills area (show if drill, hide if simulation).

```html
<div class="circles-step-select-label">練習模式</div>
<div class="circles-mode-row">
  <div class="circles-mode-card selected" data-mode="simulation">
    <div class="circles-mode-card-title"><i class="ph ph-video-camera"></i> 完整模擬</div>
    <div class="circles-mode-card-desc">25-35 分鐘 · 全 7 步 · 無提示</div>
  </div>
  <div class="circles-mode-card" data-mode="drill">
    <div class="circles-mode-card-title"><i class="ph ph-target"></i> 步驟加練</div>
    <div class="circles-mode-card-desc">5-10 分鐘 · 單一步驟 · 全引導</div>
  </div>
</div>
```

CSS:
```css
.circles-step-select-label { font-size: 11px; color: var(--c-text-3); margin-bottom: 8px; font-family: 'DM Sans', sans-serif; text-transform: uppercase; letter-spacing: 0.06em; }
.circles-mode-row { display: flex; gap: 10px; margin-bottom: 20px; }
.circles-mode-card { flex: 1; padding: 14px; border-radius: 12px; border: 1.5px solid var(--c-border); background: var(--c-card); cursor: pointer; touch-action: manipulation; }
.circles-mode-card.selected { border-color: var(--c-primary); background: var(--c-primary-lt); }
.circles-mode-card-title { font-size: 13px; font-weight: 600; color: var(--c-text); margin-bottom: 3px; font-family: 'DM Sans', sans-serif; display: flex; align-items: center; gap: 5px; }
.circles-mode-card-desc { font-size: 11px; color: var(--c-text-3); line-height: 1.5; font-family: 'DM Sans', sans-serif; }
```

JS click binding:
```javascript
document.querySelectorAll('.circles-mode-card').forEach(function(el) {
  el.addEventListener('click', function() {
    AppState.circlesMode = el.dataset.mode;
    localStorage.setItem('circlesMode', AppState.circlesMode);
    // re-render or toggle step pills visibility
    renderCirclesHome();
  });
});
```

---

### Step Pills（drill mode 專屬，條件渲染）

**只在 `AppState.circlesMode === 'drill'` 時渲染，位於 mode cards 下方、type tabs 上方。** 完整模擬 mode 時此區塊完全不渲染（不佔空間）。

**⚠️ 重要設計決策：步驟加練只開放 C1、I、R 三步。** C2/L/E/S 有強烈跨步驟依賴（需要前步驟的具體答案），無法在孤立情境下有意義地練習。這三步驟只能在完整模擬中訓練。

Section label `"練習步驟"`。**共 3 個 pill**（C1、I、R），pills 下方固定顯示 sim-only note。預設 `AppState.circlesDrillStep = 'C1'`，即 C1 pill 為 active。

點擊 pill → 更新 `AppState.circlesDrillStep`，重新渲染 pills（active class 移動）。

```html
<!-- 只在 drill mode 時輸出 -->
<div class="circles-step-select-label">練習步驟</div>
<div class="circles-step-pills">
  <button class="circles-step-pill active" data-step="C1" data-tip="確認題目邊界與假設，練習用精準問題縮小解題範圍。">C 澄清情境</button>
  <button class="circles-step-pill" data-step="I" data-tip="識別核心用戶群，練習描述用戶特徵、使用情境與動機。">I 定義用戶</button>
  <button class="circles-step-pill" data-step="R" data-tip="挖掘用戶真正的痛點，練習區分表面訴求與根本需求。">R 發掘需求</button>
</div>
<div class="circles-drill-sim-note">
  <i class="ph ph-lock-simple"></i> C2、L、E、S 需在完整模擬中練習
</div>
```

JS click binding:
```javascript
document.querySelectorAll('.circles-step-pill').forEach(function(el) {
  el.addEventListener('click', function() {
    AppState.circlesDrillStep = el.dataset.step;
    document.querySelectorAll('.circles-step-pill').forEach(function(p) {
      p.classList.toggle('active', p.dataset.step === AppState.circlesDrillStep);
    });
  });
});
```

CSS:
```css
.circles-step-pills { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; }
.circles-step-pill { min-height: 44px; display: flex; align-items: center; padding: 6px 12px; border-radius: 8px; border: 1px solid var(--c-border); background: var(--c-card); font-size: 12px; color: var(--c-text-2); cursor: pointer; touch-action: manipulation; -webkit-tap-highlight-color: transparent; font-family: 'DM Sans', sans-serif; position: relative; }
.circles-step-pill.active { background: var(--c-primary-lt); color: var(--c-primary); border-color: var(--c-primary); font-weight: 600; }
.circles-drill-sim-note { font-size: 11px; color: var(--c-text-3); display: flex; align-items: center; gap: 5px; margin-bottom: 18px; }
.circles-drill-sim-note i { font-size: 12px; }
```

#### Step Pill Hover Tooltip

Desktop（hover）時，每個 pill 上方出現黑底白字 tooltip，顯示該步驟的 1-2 句說明。Tooltip 位置：pill 正上方居中，`translateY(-100%)`。80ms delay 後消失。

**3 個可加練步驟 tooltip 文案：**
| Step | data-step | tooltip 文案 |
|------|-----------|-------------|
| C 澄清情境 | C1 | 確認題目邊界與假設，練習用精準問題縮小解題範圍。 |
| I 定義用戶 | I  | 識別核心用戶群，練習描述用戶特徵、使用情境與動機。 |
| R 發掘需求 | R  | 挖掘用戶真正的痛點，練習區分表面訴求與根本需求。 |

> C2/L/E/S 不在 drill pills 中，無需 tooltip 文案。

HTML（tooltip DOM，全域一個，fixed position）：
```html
<div class="circles-pill-tooltip" id="circles-pill-tooltip"></div>
```

JS（mouseover / mouseout on `.circles-step-pill[data-tip]`）：
```javascript
var pillTooltip = document.getElementById('circles-pill-tooltip');
var pillTipTimer = null;
document.addEventListener('mouseover', function(e) {
  var pill = e.target.closest('.circles-step-pill[data-tip]');
  if (!pill) return;
  clearTimeout(pillTipTimer);
  pillTooltip.textContent = pill.getAttribute('data-tip');
  var rect = pill.getBoundingClientRect();
  var tipW = 200;
  var left = Math.max(8, Math.min(rect.left + rect.width / 2 - tipW / 2, window.innerWidth - tipW - 8));
  pillTooltip.style.cssText = 'left:' + left + 'px;top:' + rect.top + 'px;width:' + tipW + 'px;transform:translateY(-100%) translateY(-8px)';
  pillTooltip.classList.add('visible');
});
document.addEventListener('mouseout', function(e) {
  if (!e.target.closest('.circles-step-pill[data-tip]')) return;
  pillTipTimer = setTimeout(function() { pillTooltip.classList.remove('visible'); }, 80);
});
```

CSS：
```css
.circles-pill-tooltip { position: fixed; background: #1A1A1A; color: #F0EDE6; font-size: 11px; line-height: 1.55; padding: 8px 11px; border-radius: 8px; max-width: 200px; pointer-events: none; opacity: 0; transition: opacity 0.15s; z-index: 9999; font-family: 'DM Sans', sans-serif; box-shadow: 0 4px 16px rgba(0,0,0,0.3); }
.circles-pill-tooltip.visible { opacity: 1; }
```

Note: `data-tip` 屬性在 renderCirclesHome 生成每個 pill 時帶入，對應上表文案。

---

### Type Tabs（題型篩選）

三個 tab，對應 `CIRCLES_QUESTIONS` 的 `question_type` 欄位。預設 `AppState.circlesSelectedType = 'design'`。

Tab 旁顯示該 type 的題目總數（`×N`），數字從 `CIRCLES_QUESTIONS` 動態計算，不是寫死的。

```html
<div class="circles-type-tabs">
  <button class="circles-type-tab active" data-type="design">產品設計 ×12</button>
  <button class="circles-type-tab" data-type="improve">產品改進 ×8</button>
  <button class="circles-type-tab" data-type="strategy">產品策略 ×6</button>
</div>
```

**Behavior:**
- Tab click → `AppState.circlesSelectedType = el.dataset.type`，重新從該 type 題庫隨機抽取最多 20 題渲染
- Tab counts 在每次 `renderCirclesHome` 時動態計算：`CIRCLES_QUESTIONS.filter(q => q.question_type === type).length`
- 初始渲染 → 預設 `design` tab active，顯示最多 20 題

JS click binding:
```javascript
document.querySelectorAll('.circles-type-tab').forEach(function(el) {
  el.addEventListener('click', function() {
    AppState.circlesSelectedType = el.dataset.type;
    // re-render question list only (not full page)
    renderQList();
  });
});
```

CSS:
```css
.circles-type-tabs { display: flex; gap: 6px; margin-bottom: 14px; }
.circles-type-tab { min-height: 34px; display: flex; align-items: center; padding: 5px 14px; border-radius: 20px; border: 1px solid var(--c-border); background: var(--c-card); font-size: 12px; color: var(--c-text-2); cursor: pointer; font-family: 'DM Sans', sans-serif; touch-action: manipulation; }
.circles-type-tab.active { background: var(--c-primary); color: #fff; border-color: var(--c-primary); }
```

---

### Question List Header

題目列表上方有一行 header，左側 label `"選擇題目"`，右側 `隨機選題` 純文字按鈕（無邊框）。

```html
<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
  <div style="font-size:11px;font-weight:600;color:var(--c-text-2);font-family:DM Sans,sans-serif">選擇題目</div>
  <button id="circles-random-btn" style="font-size:11px;color:var(--c-primary);background:none;border:none;cursor:pointer;font-family:DM Sans,sans-serif;padding:0">隨機選題</button>
</div>
```

**隨機選題** button 行為：從 `AppState.circlesSelectedType` 對應的題庫重新隨機排列，重新渲染題目列表。**不切換頁面，不更改 tab/mode。**

---

### Question Cards（展開確認流程）

題庫最多顯示 20 題（`questions.slice(0, 20)`）。每張 card 有兩個狀態：

**Collapsed（預設）：** company badge + 截斷題幹（前 60 字）+ "看更多 ▾" 連結

**Expanded（點擊後）：** 完整題幹 + "確認，開始練習" 主按鈕 + "取消" 次要連結。Card border 變 primary。同時所有其他卡片自動折疊（accordion 行為）。

```html
<div class="circles-q-card" data-qid="q001">
  <!-- company badge -->
  <div class="circles-q-card-company">Meta — Facebook</div>
  <!-- truncated statement (≤60 chars) -->
  <div class="circles-q-card-stmt"
    data-full="完整題幹文字（全部）"
    data-short="截斷題幹文字（前60字）…">
    截斷題幹文字（前60字）…
  </div>
  <!-- "看更多" — hidden when card is expanded -->
  <div class="circles-q-card-more-wrap">
    <span class="circles-q-card-more">看更多 ▾</span>
  </div>
  <!-- expanded area — hidden by default -->
  <div class="circles-q-card-expand-area" style="display:none">
    <div class="circles-q-card-expanded">完整題幹文字（全部）</div>
    <div style="display:flex;align-items:center;gap:8px;margin-top:10px">
      <button class="circles-q-confirm-btn">確認，開始練習</button>
      <button class="circles-q-cancel-btn">取消</button>
    </div>
  </div>
</div>
```

JS（event delegation on `.circles-q-list`）：
```javascript
document.querySelector('.circles-q-list').addEventListener('click', function(e) {
  var card = e.target.closest('.circles-q-card');
  if (!card) return;
  // cancel button
  if (e.target.closest('.circles-q-cancel-btn')) {
    collapseQCard(card);
    return;
  }
  // confirm button
  if (e.target.closest('.circles-q-confirm-btn')) {
    var qid = card.dataset.qid;
    var question = CIRCLES_QUESTIONS.find(function(q) { return q.id === qid; });
    AppState.circlesSelectedQuestion = question;
    createCirclesSession(question, AppState.circlesMode, AppState.circlesDrillStep);
    return;
  }
  // card body click → expand (accordion)
  var allCards = document.querySelectorAll('.circles-q-card');
  allCards.forEach(function(c) { if (c !== card) collapseQCard(c); });
  expandQCard(card);
});

function expandQCard(card) {
  var stmt = card.querySelector('.circles-q-card-stmt');
  stmt.textContent = stmt.dataset.full;
  card.querySelector('.circles-q-card-more-wrap').style.display = 'none';
  card.querySelector('.circles-q-card-expand-area').style.display = 'block';
  card.style.borderColor = 'var(--c-primary)';
}
function collapseQCard(card) {
  var stmt = card.querySelector('.circles-q-card-stmt');
  stmt.textContent = stmt.dataset.short;
  card.querySelector('.circles-q-card-more-wrap').style.display = 'block';
  card.querySelector('.circles-q-card-expand-area').style.display = 'none';
  card.style.borderColor = '';
}
```

**"確認，開始練習" action:**
- simulation mode：`createCirclesSession(question, 'simulation', null)` → navigate to C1 Phase 1
- drill mode：`createCirclesSession(question, 'drill', AppState.circlesDrillStep)` → navigate to `{drillStep}` Phase 1

CSS:
```css
.circles-q-card { padding: 14px 16px; border-radius: 12px; background: var(--c-card); border: 1.5px solid var(--c-border); cursor: pointer; margin-bottom: 10px; touch-action: manipulation; }
.circles-q-card-company { font-size: 11px; color: var(--c-primary); font-weight: 600; margin-bottom: 4px; font-family: 'DM Sans', sans-serif; }
.circles-q-card-stmt { font-size: 13px; color: var(--c-text); line-height: 1.5; font-family: 'DM Sans', sans-serif; }
.circles-q-card-more { font-size: 11px; color: var(--c-primary); cursor: pointer; margin-top: 4px; font-family: 'DM Sans', sans-serif; display: block; }
.circles-q-card-expanded { font-size: 12px; color: var(--c-text-2); line-height: 1.6; margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--c-border); font-family: 'DM Sans', sans-serif; }
.circles-q-confirm-btn { flex: 1; padding: 9px 0; font-size: 13px; background: var(--c-primary); color: #fff; border: none; border-radius: 8px; cursor: pointer; font-family: 'DM Sans', sans-serif; font-weight: 600; }
.circles-q-cancel-btn { background: none; border: none; font-size: 13px; color: var(--c-text-2); cursor: pointer; padding: 9px 4px; white-space: nowrap; font-family: 'DM Sans', sans-serif; }
```

---

### NSM Banner（首頁底部）

```html
<div class="nsm-banner">
  <div>
    <div class="nsm-banner-label">S 步驟含北極星指標練習</div>
    <div class="nsm-banner-sub">想做最完整的 NSM 定義訓練？</div>
  </div>
  <button class="nsm-banner-btn" id="circles-nsm-banner-btn">前往 NSM →</button>
</div>
```

Button action: `navigate('nsm')`

CSS:
```css
.nsm-banner { background: #EEF3FF; border: 1px solid #C5D5FF; border-radius: 10px; padding: 14px 16px; display: flex; align-items: center; justify-content: space-between; margin-top: 16px; }
.nsm-banner-label { font-size: 12px; color: var(--c-primary); font-weight: 600; margin-bottom: 2px; font-family: 'DM Sans', sans-serif; }
.nsm-banner-sub { font-size: 12px; color: #5a7ab5; font-family: 'DM Sans', sans-serif; }
.nsm-banner-btn { background: var(--c-primary); color: #fff; border: none; padding: 7px 12px; border-radius: 8px; font-size: 12px; font-weight: 600; cursor: pointer; white-space: nowrap; font-family: 'DM Sans', sans-serif; }
```

---

## Screen 2: Phase 1 — Framework Form (`renderCirclesPhase1`)

**Purpose:** User fills 4 framework fields for the current CIRCLES step.

### Layout (not flex chat — uses fixed submit bar)

```
Navbar
circles-nav (← | STEP LABEL · Company · Product | 回首頁)
circles-progress (7 segments)
circles-step-pills (7 pills)
[Scrollable: circles-phase1-wrap, padding-bottom:120px]
  problem-card (full problem statement)
  [S step only: nsm-annotation with NSM link]
  [4 field groups: label-row / hint-example / textarea]
[Fixed: circles-submit-bar (返回選題 | 提交審核)]
```

### Problem Card

```html
<div class="problem-card">（question.problem_statement）</div>
```

CSS:
```css
.problem-card { background: var(--c-card); border-radius: 10px; border: 1px solid var(--c-border); padding: 12px 14px; font-size: 13px; color: var(--c-text-2); line-height: 1.6; margin-bottom: 14px; font-family: 'DM Sans', sans-serif; }
```

### NSM Annotation (S step only)

Only rendered when `stepKey === 'S'`:
```html
<div class="nsm-annotation">
  此步驟的北極星指標欄位是 NSM 訓練的濃縮版。想深入練習？
  <button id="circles-s-nsm-link" style="background:none;border:none;color:var(--c-primary);font-size:13px;cursor:pointer;text-decoration:underline;font-family:'DM Sans',sans-serif;padding:0">前往 NSM 訓練 →</button>
</div>
```

CSS:
```css
.nsm-annotation { background: #EEF3FF; border: 1px solid #C5D5FF; border-radius: 10px; padding: 12px 14px; margin-bottom: 14px; font-size: 13px; color: var(--c-primary); line-height: 1.6; font-family: 'DM Sans', sans-serif; }
```

### Field Group (4 fields per step, with 提示 button)

Each field group:
```html
<div class="circles-field-group">
  <div class="circles-field-label-row">
    <div class="circles-field-label">問題範圍</div>
    <button class="circles-hint-trigger" data-step="C1" data-field="問題範圍" type="button">提示</button>
  </div>
  <div class="circles-field-hint">例：確認「廣告過多」是頻率、相關性還是格式問題，...</div>
  <textarea class="circles-field-input" data-field="問題範圍" rows="2" placeholder="填寫你的分析..."></textarea>
</div>
```

**The `提示` button behavior:**
1. User clicks → calls `showCirclesHint(stepKey, fieldName)`
2. Overlay appears with loading spinner
3. Fetches `/api/circles-sessions/:id/hint` or `/api/guest-circles-sessions/:id/hint` (POST with `{ step, field }`)
4. On success → shows hint text in overlay
5. User reads, closes → form is still intact underneath

The hint example below the label (`.circles-field-hint`) shows a static fallback example inline. This is from `CIRCLES_STEP_HINTS[stepKey][fieldIndex]` — a hardcoded hints object. The `提示` button calls the AI backend for a richer, question-specific hint.

CSS:
```css
.circles-phase1-wrap { padding: 16px; padding-bottom: 120px; }
.circles-field-group { margin-bottom: 14px; }
.circles-field-label-row { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 5px; }
.circles-field-label { font-size: 10px; color: var(--c-text-3); text-transform: uppercase; letter-spacing: 0.07em; font-family: 'DM Sans', sans-serif; font-weight: 700; }
.circles-hint-trigger { background: none; border: none; font-size: 12px; color: var(--c-primary); cursor: pointer; padding: 0; font-family: 'DM Sans', sans-serif; white-space: nowrap; flex-shrink: 0; }
.circles-field-hint { font-size: 11px; color: var(--c-text-3); margin-bottom: 6px; line-height: 1.5; font-family: 'DM Sans', sans-serif; }
.circles-field-input { width: 100%; padding: 11px 13px; border-radius: 10px; border: 1.5px solid var(--c-border); background: var(--c-card); font-size: 13px; font-family: 'DM Sans', sans-serif; color: var(--c-text); resize: none; outline: none; line-height: 1.5; }
.circles-field-input:focus { border-color: var(--c-primary); }
```

### Submit Bar

```html
<div class="circles-submit-bar">
  <button class="circles-btn-secondary" id="circles-p1-back">返回選題</button>
  <button class="circles-btn-primary" id="circles-p1-submit">提交審核</button>
</div>
```

"返回選題" → clears `circlesSelectedQuestion`, navigates to 'circles'
"提交審核" → saves draft to AppState + session, navigates to Gate

CSS:
```css
.circles-submit-bar { position: fixed; bottom: 0; left: 50%; transform: translateX(-50%); width: 100%; max-width: 390px; background: var(--c-card); border-top: 1px solid var(--c-border); padding: 12px 16px; display: flex; gap: 10px; }
.circles-btn-primary { flex: 1; background: var(--c-primary); color: #fff; border: none; border-radius: 10px; padding: 12px 16px; font-size: 14px; font-weight: 600; cursor: pointer; font-family: 'DM Sans', sans-serif; }
.circles-btn-secondary { background: #f0ede6; color: var(--c-text); border: none; border-radius: 10px; padding: 12px 16px; font-size: 14px; font-weight: 600; cursor: pointer; font-family: 'DM Sans', sans-serif; white-space: nowrap; }
```

---

## Screen 3: Hint Overlay (`showCirclesHint`)

This is NOT a separate page — it's an overlay rendered on top of Phase 1.

### 3 States

**State A — Loading** (immediately on click):
```html
<div class="hint-overlay">
  <div class="hint-card">
    <button class="hint-close" id="hint-close-btn">×</button>
    <div class="hint-title">問題範圍 — 分析思路</div>
    <div class="hint-sub">Meta · Facebook News Feed · C</div>
    <div class="hint-loading">
      <div style="display:inline-block;width:16px;height:16px;border:2px solid #ccc;border-top-color:var(--c-primary);border-radius:50%;animation:spin 0.8s linear infinite;margin-right:6px;vertical-align:middle"></div>
      生成中
    </div>
  </div>
</div>
```

**State B — Ready but collapsed** (after load, before user views):
**NOTE:** This "ready but hidden" state is only used if we want to cache and show a prompt. In practice the flow is Loading → Expanded (skip the "try yourself first" intermediate). However the mockup does show this state — include it for future option.

```html
<!-- Inside hint-card, replacing loading div: -->
<div style="background:#f0ede6;border-radius:8px;padding:12px;display:flex;align-items:center;justify-content:space-between;gap:12px">
  <div style="font-size:12px;color:var(--c-text-2);line-height:1.5">先試著自己思考，準備好了再看</div>
  <button id="hint-reveal-btn" style="background:var(--c-primary);color:#fff;border:none;border-radius:7px;padding:6px 12px;font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap;font-family:'DM Sans',sans-serif">查看提示</button>
</div>
<div class="hint-footer" style="margin-top:8px">提示只是方向引導，不給直接答案</div>
```

**State C — Expanded** (hint text visible):
```html
<!-- Inside hint-card, replacing loading div: -->
<div class="hint-body">（AI-generated hint text）</div>
<div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px">
  <button id="hint-collapse-btn" style="font-size:11px;color:var(--c-text-3);background:none;border:none;cursor:pointer;font-family:'DM Sans',sans-serif">收起提示</button>
  <div class="hint-footer" style="margin-top:0">閱讀後自行填寫</div>
</div>
```

### Overlay CSS

```css
.hint-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.45); z-index: 200; display: flex; align-items: center; justify-content: center; padding: 24px; max-width: 390px; margin: 0 auto; }
.hint-card { background: var(--c-card); border-radius: 16px; padding: 20px; max-width: 360px; width: 100%; box-shadow: 0 8px 40px rgba(0,0,0,0.18); position: relative; }
.hint-close { position: absolute; top: 12px; right: 14px; background: none; border: none; font-size: 20px; color: var(--c-text-3); cursor: pointer; line-height: 1; padding: 0; }
.hint-title { font-size: 13px; font-weight: 700; color: var(--c-primary); margin-bottom: 4px; font-family: 'DM Sans', sans-serif; }
.hint-sub { font-size: 12px; color: var(--c-text-3); margin-bottom: 12px; font-family: 'DM Sans', sans-serif; }
.hint-loading { text-align: center; padding: 20px; font-size: 13px; color: var(--c-text-2); font-family: 'DM Sans', sans-serif; }
.hint-body { font-size: 14px; color: var(--c-text); line-height: 1.7; background: #F6F8FF; border-left: 3px solid var(--c-primary); padding: 12px; border-radius: 0 8px 8px 0; font-family: 'DM Sans', sans-serif; }
.hint-footer { font-size: 12px; color: var(--c-text-3); text-align: center; margin-top: 12px; font-family: 'DM Sans', sans-serif; }
@keyframes spin { to { transform: rotate(360deg); } }
```

### JS `showCirclesHint` function

```javascript
async function showCirclesHint(step, field) {
  var q = AppState.circlesSelectedQuestion;
  var session = AppState.circlesSession;
  if (!q || !session) return;

  var overlay = document.createElement('div');
  overlay.className = 'hint-overlay';
  overlay.id = 'circles-hint-overlay';
  overlay.innerHTML = '<div class="hint-card">' +
    '<button class="hint-close" id="hint-close-btn">×</button>' +
    '<div class="hint-title">' + escHtml(field) + ' — 分析思路</div>' +
    '<div class="hint-sub">' + escHtml(q.company) + ' · ' + escHtml(q.product || '') + ' · ' + step + '</div>' +
    '<div class="hint-loading" id="hint-body-area"><div style="display:inline-block;width:16px;height:16px;border:2px solid #ccc;border-top-color:var(--c-primary);border-radius:50%;animation:spin 0.8s linear infinite;margin-right:6px;vertical-align:middle"></div>生成中</div>' +
  '</div>';
  document.body.appendChild(overlay);

  document.getElementById('hint-close-btn').addEventListener('click', function() { overlay.remove(); });
  overlay.addEventListener('click', function(e) { if (e.target === overlay) overlay.remove(); });

  try {
    var headers = { 'Content-Type': 'application/json' };
    if (AppState.accessToken) headers['Authorization'] = 'Bearer ' + AppState.accessToken;
    else headers['X-Guest-ID'] = AppState.guestId;
    var baseUrl = AppState.accessToken
      ? '/api/circles-sessions/' + session.id + '/hint'
      : '/api/guest-circles-sessions/' + session.id + '/hint';
    var res = await fetch(baseUrl, {
      method: 'POST', headers: headers,
      body: JSON.stringify({ step: step, field: field })
    });
    var data = await res.json();
    var bodyEl = document.getElementById('hint-body-area');
    if (!bodyEl) return;
    if (!res.ok) throw new Error(data.error);
    bodyEl.outerHTML = '<div class="hint-body">' + escHtml(data.hint) + '</div>' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px">' +
        '<button onclick="this.closest(\'.hint-overlay\').remove()" style="font-size:11px;color:var(--c-text-3);background:none;border:none;cursor:pointer;font-family:\'DM Sans\',sans-serif">收起提示</button>' +
        '<div class="hint-footer" style="margin-top:0">閱讀後自行填寫</div>' +
      '</div>';
  } catch (e) {
    var bodyEl2 = document.getElementById('hint-body-area');
    if (bodyEl2) bodyEl2.textContent = '生成失敗，請重試';
  }
}
```

---

## Screen 4: Phase 1.5 Gate (`renderCirclesGate`)

**Purpose:** AI reviews framework draft. Shows pass/fail per field. Blocks or allows proceeding to Phase 2.

### Layout

```
Navbar
circles-nav (← | 框架審核 · STEP · Company | 回首頁)
[Two sub-states: pass / fail]
```

### Pass State

```html
<div class="circles-gate-wrap">
  <!-- Transition bar -->
  <div class="gate-transition-bar">
    <div class="gate-transition-text">框架審核通過，可以進入對話練習</div>
    <button class="gate-continue-btn" id="circles-gate-continue">繼續</button>
  </div>
  <!-- Per-field items -->
  <div class="gate-item status-ok">
    <div class="gate-item-icon" style="color:#137A3D"><i class="ph ph-check-circle"></i></div>
    <div class="gate-item-content">
      <div class="gate-item-field">問題範圍</div>
      <div class="gate-item-title">方向正確</div>
      <div class="gate-item-reason">正確區分了廣告頻率與相關性問題</div>
    </div>
  </div>
  <!-- warn item example: -->
  <div class="gate-item status-warn">
    <div class="gate-item-icon" style="color:#B85C00"><i class="ph ph-warning"></i></div>
    <div class="gate-item-content">
      <div class="gate-item-field">業務影響</div>
      <div class="gate-item-title">不夠具體</div>
      <div class="gate-item-reason">提到用戶流失但未量化廣告收入的限制</div>
      <div class="gate-item-suggestion">建議補充：廣告收入保護是硬性約束</div>
    </div>
  </div>
</div>
```

### Fail State

```html
<div class="circles-gate-wrap">
  <div style="background:#FFF3F3;border:1px solid #FFCDD2;border-radius:10px;padding:12px 14px;margin-bottom:16px;font-size:12px;color:#D92020;font-family:'DM Sans',sans-serif">
    框架有方向性錯誤，請修正後再提交
  </div>
  <!-- error items -->
  <div class="gate-item status-error">
    <div class="gate-item-icon" style="color:#D92020"><i class="ph ph-x-circle"></i></div>
    <div class="gate-item-content">
      <div class="gate-item-field">問題範圍</div>
      <div class="gate-item-title">方向錯誤</div>
      <div class="gate-item-reason">...</div>
      <div class="gate-item-suggestion">...</div>
    </div>
  </div>
  <!-- Fixed bottom bar for fail: -->
  <div style="position:fixed;bottom:0;...">
    <button class="circles-btn-primary" style="width:100%" id="circles-gate-back-btn">返回修改</button>
  </div>
</div>
```

### Gate Item Status Mapping

From `gateResult.items[]`:
- `status: 'ok'` → class `status-ok`, icon `ph-check-circle` in `#137A3D`
- `status: 'warn'` → class `status-warn`, icon `ph-warning` in `#B85C00`, show `.gate-item-suggestion`
- `status: 'error'` → class `status-error`, icon `ph-x-circle` in `#D92020`, show `.gate-item-suggestion`

`gateResult.canProceed = true` → show pass state (transition bar + continue button)
`gateResult.canProceed = false` → show fail state (error bar + return button)

CSS:
```css
.circles-gate-wrap { padding: 16px; padding-bottom: 100px; }
.gate-transition-bar { background: #EEF3FF; border: 1px solid #C5D5FF; border-radius: 10px; padding: 12px 14px; margin-bottom: 16px; display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.gate-transition-text { font-size: 12px; color: var(--c-primary); font-weight: 500; font-family: 'DM Sans', sans-serif; }
.gate-continue-btn { background: var(--c-primary); color: #fff; border: none; border-radius: 8px; padding: 7px 14px; font-size: 12px; font-weight: 600; cursor: pointer; font-family: 'DM Sans', sans-serif; white-space: nowrap; flex-shrink: 0; }
.gate-item { background: var(--c-card); border-radius: 10px; border: 1.5px solid var(--c-border); padding: 12px 14px; margin-bottom: 10px; display: flex; gap: 10px; align-items: flex-start; }
.gate-item.status-ok   { border-color: #b8dbbf; }
.gate-item.status-warn { border-color: #FFD54F; }
.gate-item.status-error { border-color: #f5c6c6; }
.gate-item-icon { font-size: 14px; flex-shrink: 0; margin-top: 1px; }
.gate-item-content { flex: 1; }
.gate-item-title { font-size: 13px; font-weight: 700; color: var(--c-text); margin-bottom: 3px; font-family: 'DM Sans', sans-serif; }
.gate-item-field { font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--c-text-3); font-family: 'DM Sans', sans-serif; margin-bottom: 2px; }
.gate-item-reason { font-size: 12px; color: var(--c-text-2); line-height: 1.5; font-family: 'DM Sans', sans-serif; }
.gate-item-suggestion { font-size: 11px; color: #B85C00; margin-top: 4px; font-family: 'DM Sans', sans-serif; }
```

---

## Screen 5: Phase 2 — Dialogue Practice (`renderCirclesPhase2`)

**CRITICAL ARCHITECTURE:** The entire Phase 2 view uses a flex column layout. The chat body uses `flex:1;overflow-y:auto`. ALL bottom bars MUST use `flex-shrink:0`. Never put `max-height` on `.circles-chat-body` — this causes the input bar to float up.

### 5 Sub-States

**State 1: `chat`** — turns < 3, no submit button
**State 2: `chat3`** — turns ≥ 3, submit row appears at bottom
**State 3: `strip`** — user clicked submit, conclusion strip shows (collapsed, no input bar)
**State 4: `expand`** — user clicked "展開填寫", conclusion box open
**State 5: `pass`** — AI detection passed, submit button enabled

### Base Flex Structure (all states share this)

```html
<div class="circles-chat-wrap" style="height:calc(100vh - 52px)">
  <!-- circles-nav: flex-shrink:0 by default -->
  <div class="circles-nav">...</div>
  <!-- progress bar: flex-shrink:0 -->
  <div class="circles-progress">...</div>
  <!-- pinned question card: flex-shrink:0 -->
  <div class="circles-pinned-card">...</div>
  <!-- CRITICAL: chat body takes all remaining space -->
  <div class="circles-chat-body">...</div>
  <!-- ALL bottom bars: flex-shrink:0 -->
  <!-- Only one of these shows at a time, depending on state: -->
  <div class="circles-input-bar">...</div>       <!-- states 1, 2 -->
  <div class="circles-submit-row">...</div>      <!-- state 2 only, below input-bar -->
  <div class="circles-submit-strip">...</div>    <!-- state 3 -->
  <div class="circles-conclusion-box">...</div>  <!-- states 4, 5 -->
</div>
```

CSS:
```css
.circles-chat-wrap { display: flex; flex-direction: column; height: calc(100vh - 44px); overflow: hidden; position: relative; }
.circles-pinned-card { background: var(--c-card); border-bottom: 1px solid #e8e5de; padding: 8px 14px; flex-shrink: 0; }
.pinned-company { font-size: 10px; color: var(--c-primary); font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; font-family: 'DM Sans', sans-serif; margin-bottom: 2px; }
.pinned-stmt { font-size: 11px; color: var(--c-text); font-weight: 600; line-height: 1.4; font-family: 'DM Sans', sans-serif; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pinned-toggle { font-size: 10px; color: var(--c-primary); cursor: pointer; margin-top: 2px; font-family: 'DM Sans', sans-serif; }
.circles-chat-body { flex: 1; overflow-y: auto; padding: 14px 16px; }
```

### Chat Bubbles

```html
<!-- User bubble (right-aligned) -->
<div class="circles-bubble-user">（user message）</div>

<!-- AI response (3-role bubble structure) -->
<div class="circles-bubble-ai">
  <div class="circles-bubble-section">被訪談者</div>
  （interviewee response text）
</div>
<div class="circles-bubble-ai" style="font-size:11px;padding:8px 10px">
  <div class="circles-bubble-section">教練點評</div>
  （coaching text）
  <!-- 教練提示: COLLAPSED by default -->
  <div style="margin-top:6px">
    <button onclick="toggleCoachHint(this)" style="background:none;border:none;font-size:11px;color:var(--c-text-3);cursor:pointer;padding:0;font-family:'DM Sans',sans-serif;display:flex;align-items:center;gap:3px">
      <i class="ph ph-caret-right" style="font-size:10px"></i> 查看教練提示
    </button>
    <div style="display:none;margin-top:4px;padding:6px 8px;background:rgba(0,0,0,0.04);border-radius:6px;color:var(--c-text-2);font-size:11px;line-height:1.5">
      （hint text）
    </div>
  </div>
</div>
```

**教練提示 is ALWAYS collapsed by default.** The user must explicitly click "查看教練提示" to reveal it.

JS toggle:
```javascript
function toggleCoachHint(btn) {
  var content = btn.nextElementSibling;
  if (!content) return;
  var isOpen = content.style.display !== 'none';
  content.style.display = isOpen ? 'none' : 'block';
  var icon = btn.querySelector('i');
  if (icon) icon.className = isOpen ? 'ph ph-caret-right' : 'ph ph-caret-down';
  btn.style.color = isOpen ? 'var(--c-text-3)' : 'var(--c-primary)';
}
```

**How the AI reply is parsed** (from SSE stream):
The AI streams a response in this format:
```
【被訪談者】
（interviewee text）

【教練點評】
（coaching text）

【教練提示】
（hint text）
```
Parser splits on `【被訪談者】`, `【教練點評】`, `【教練提示】` markers and stores in `{ interviewee, coaching, hint }`.

CSS:
```css
.circles-bubble-ai { background: var(--c-primary-lt); border: 1px solid rgba(26,86,219,0.18); border-radius: 4px 12px 12px 12px; padding: 10px 13px; font-size: 13px; line-height: 1.6; color: var(--c-text); margin-bottom: 10px; max-width: 88%; font-family: 'DM Sans', sans-serif; }
.circles-bubble-user { background: var(--c-card); border: 1px solid var(--c-border); border-radius: 12px 4px 12px 12px; padding: 10px 13px; font-size: 13px; line-height: 1.6; color: var(--c-text); margin-bottom: 10px; max-width: 88%; margin-left: auto; font-family: 'DM Sans', sans-serif; }
.circles-bubble-section { font-size: 10px; font-weight: 700; color: var(--c-text-3); text-transform: uppercase; letter-spacing: 0.07em; margin-bottom: 3px; font-family: 'DM Sans', sans-serif; }
```

### Icebreaker Card (first element in `circles-chat-body`, all steps)

A direction-setting card that appears as the **first element** in `.circles-chat-body` before any user bubble. It gives the user a concrete angle to start their first question. As conversation grows, the card scrolls up naturally out of view.

**Icebreaker texts by step:**
- **C1 澄清情境**: 問被訪談者這個問題的核心是什麼——「廣告過多」是指頻率、相關性，還是格式？同時確認業務上有哪些不能突破的限制。
- **I 定義用戶**: 問被訪談者你們的用戶有沒有按行為做分類——哪個群體對廣告的抱怨最集中、對業務最重要？
- **R 發掘需求**: 問被訪談者這些習慣型用戶每天打開 News Feed 時，最常做的事情是什麼——從使用行為出發，逐步挖到功能、情感、社交三層需求。
- **C2 優先排序**: 問被訪談者這個項目有哪些硬性的業務限制——收入不能下降多少、廣告主有哪些合約承諾。有了約束邊界，才能確立你的取捨標準。

```html
<div class="circles-icebreaker">
  <div class="circles-icebreaker-label"><i class="ph ph-compass"></i> 開始提問方向</div>
  <div class="circles-icebreaker-text">（step-specific icebreaker text above）</div>
</div>
```

CSS:
```css
.circles-icebreaker { background: rgba(26,86,219,0.05); border: 1px solid rgba(26,86,219,0.18); border-radius: 10px; padding: 10px 13px; margin-bottom: 14px; }
.circles-icebreaker-label { font-size: 9px; font-weight: 700; color: var(--c-primary); text-transform: uppercase; letter-spacing: .07em; margin-bottom: 5px; display: flex; align-items: center; gap: 4px; }
.circles-icebreaker-text { font-size: 12px; color: var(--c-text-2); line-height: 1.65; }
```

### Input Bar (states 1 & 2)

```html
<div class="circles-input-bar">
  <textarea class="circles-input" rows="1" placeholder="輸入你的問題..." id="circles-chat-input"></textarea>
  <button class="circles-send-btn" id="circles-send-btn"><i class="ph ph-paper-plane-tilt"></i></button>
</div>
```

CSS:
```css
.circles-input-bar { background: var(--c-card); border-top: 1px solid var(--c-border); padding: 10px 14px; display: flex; gap: 8px; align-items: flex-end; flex-shrink: 0; }
.circles-input { flex: 1; background: var(--c-surface); border: 1px solid var(--c-border); border-radius: 10px; padding: 9px 13px; font-size: 14px; color: var(--c-text); font-family: 'DM Sans', sans-serif; resize: none; outline: none; min-height: 40px; }
.circles-send-btn { width: 40px; height: 40px; border-radius: 10px; background: var(--c-primary); border: none; color: #fff; font-size: 16px; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
```

### Submit Row (state 2 only, below input bar)

```html
<div class="circles-submit-row">
  <button class="circles-submit-step-btn" id="circles-submit-step">對話足夠了，提交這個步驟</button>
</div>
```

Clicking this button transitions to State 3 (strip).

CSS:
```css
.circles-submit-row { padding: 6px 12px 10px; display: flex; justify-content: center; background: var(--c-card); flex-shrink: 0; border-top: 1px solid var(--c-border); }
.circles-submit-step-btn { font-size: 11px; color: var(--c-text-2); border: 1px solid #e8e5de; border-radius: 8px; padding: 6px 16px; cursor: pointer; background: var(--c-card); font-family: 'DM Sans', sans-serif; }
```

### Collapsed Strip (State 3)

Input bar and submit row are gone. Strip replaces them:

```html
<div class="circles-submit-strip">
  <div>
    <div class="strip-label">整理結論</div>
    <div class="strip-sub">翻閱完對話後，點右側展開填寫</div>
  </div>
  <button class="strip-expand-btn" id="circles-strip-expand">展開填寫 ▲</button>
</div>
```

CSS:
```css
.circles-submit-strip { border-top: 1px solid #e8e5de; background: var(--c-card); padding: 10px 14px; display: flex; align-items: center; justify-content: space-between; flex-shrink: 0; }
.strip-label { font-size: 11px; font-weight: 600; color: var(--c-primary); font-family: 'DM Sans', sans-serif; }
.strip-sub { font-size: 10px; color: var(--c-text-3); font-family: 'DM Sans', sans-serif; }
.strip-expand-btn { background: var(--c-primary); color: #fff; border: none; border-radius: 8px; padding: 7px 12px; font-size: 11px; font-weight: 600; cursor: pointer; font-family: 'DM Sans', sans-serif; white-space: nowrap; }
```

### Conclusion Box (States 4 & 5)

Replaces strip. `max-height: 60vh; overflow-y: auto` is fine here since it's the conclusion box, not the chat body.

**When conclusion box is open:** chat body dims (`opacity:0.45; pointer-events:none`) to visually signal "read-only now". The conversation is still scrollable so user can review before writing.

```html
<!-- Chat body: dimmed when conclusion box is open -->
<div class="circles-chat-body" style="opacity:0.45;pointer-events:none">
  <!-- previous turns — user can scroll to review -->
</div>

<div class="circles-conclusion-box">
  <div class="conclusion-title">整理你這個步驟確認了什麼</div>
  <!-- Sub-text is step-specific — see Per-Step Content Reference below -->
  <div class="conclusion-sub">說明鎖定的用戶群、JTBD 動機、排除對象</div>

  <!-- Collapsible example (always a DIFFERENT question, not the current one) -->
  <div class="conclusion-example-block">
    <div class="conclusion-example-header" onclick="toggleExample()">
      <div class="conclusion-example-label">範例（不同題目）</div>
      <div class="conclusion-example-toggle" id="example-toggle">展開 ▾</div>
    </div>
    <div class="conclusion-example-content" id="example-content" style="display:none">
      <!-- Example text — see Per-Step Content Reference for each step's example -->
      聚焦 Spotify 免費版每日活躍用戶，他們使用 App 的 JTBD 是「用音樂管理情緒狀態」，不是隨機發現新音樂。排除付費用戶（已無廣告痛點）和偶爾用戶（資料不足）。
    </div>
  </div>

  <textarea class="conclusion-textarea" id="conclusion-text"
    placeholder="針對這題，整理你確認的關鍵定義…"
    oninput="onConclusionInput()"></textarea>

  <!-- State 4: empty / State 5: text passes → hint shows, button enabled -->
  <div class="conclusion-hint" id="conclusion-hint"></div>
  <!-- Pass state hint: "✓ 結論涵蓋用戶群、JTBD 動機和排除對象，可以提交" -->
  <!-- Warn state hint: "尚未提到分群依據或動機層次，建議補充" -->

  <div class="conclusion-actions">
    <button class="conclusion-back-btn" id="conclusion-back">← 繼續對話</button>
    <button class="conclusion-submit-btn disabled" id="conclusion-submit">確認提交</button>
  </div>
</div>
```

**8-second AI detection:** After user types, wait 1000ms (demo) / 8000ms (prod), then check if conclusion text mentions key criteria. If pass: show `.conclusion-hint.pass` text, enable submit button. If fail: show `.conclusion-hint.warn` text, keep disabled.

```javascript
var _conclusionTimer = null;
function onConclusionInput() {
  var hint = document.getElementById('conclusion-hint');
  var btn = document.getElementById('conclusion-submit');
  if (!hint || !btn) return;
  hint.textContent = '';
  hint.className = 'conclusion-hint';
  btn.classList.add('disabled');
  btn.disabled = true;
  if (_conclusionTimer) clearTimeout(_conclusionTimer);
  _conclusionTimer = setTimeout(function() {
    var val = document.getElementById('conclusion-text')?.value || '';
    if (val.length < 20) {
      hint.textContent = '尚未提到問題範圍或業務限制，建議補充';
      hint.className = 'conclusion-hint warn';
    } else {
      hint.textContent = '結論涵蓋關鍵資訊，可以提交';
      hint.className = 'conclusion-hint pass';
      btn.classList.remove('disabled');
      btn.disabled = false;
    }
  }, 8000); // 8 seconds in production
}
```

CSS:
```css
.circles-conclusion-box { border-top: 2px solid var(--c-primary); background: var(--c-card); padding: 14px; flex-shrink: 0; max-height: 60vh; overflow-y: auto; }
.conclusion-title { font-size: 11px; font-weight: 700; color: var(--c-text); margin-bottom: 2px; font-family: 'DM Sans', sans-serif; }
.conclusion-sub { font-size: 10px; color: var(--c-text-3); margin-bottom: 8px; font-family: 'DM Sans', sans-serif; }
.conclusion-example-block { border: 1px solid #e8e5de; border-radius: 8px; margin-bottom: 8px; overflow: hidden; }
.conclusion-example-header { background: #f0ede6; padding: 5px 9px; display: flex; justify-content: space-between; cursor: pointer; }
.conclusion-example-label { font-size: 9px; font-weight: 700; color: var(--c-text-3); text-transform: uppercase; letter-spacing: 0.4px; font-family: 'DM Sans', sans-serif; }
.conclusion-example-toggle { font-size: 10px; color: var(--c-text-3); font-family: 'DM Sans', sans-serif; }
.conclusion-example-content { padding: 8px 10px; font-size: 11px; color: var(--c-text-2); line-height: 1.6; font-family: 'DM Sans', sans-serif; }
.conclusion-textarea { width: 100%; border: 1px solid #ddd; border-radius: 8px; padding: 9px; font-size: 11px; line-height: 1.6; resize: none; height: 60px; box-sizing: border-box; font-family: 'DM Sans', sans-serif; color: var(--c-text); outline: none; }
.conclusion-hint { min-height: 16px; font-size: 10px; color: var(--c-text-3); margin-top: 6px; font-family: 'DM Sans', sans-serif; }
.conclusion-hint.warn { background: #FFF8E1; color: #7A5800; border-radius: 4px; padding: 4px 8px; }
.conclusion-hint.pass { background: #E8F5E9; color: #137A3D; border-radius: 4px; padding: 4px 8px; }
.conclusion-actions { margin-top: 8px; display: flex; align-items: center; justify-content: space-between; }
.conclusion-back-btn { font-size: 10px; color: var(--c-text-3); background: none; border: none; cursor: pointer; font-family: 'DM Sans', sans-serif; padding: 0; }
.conclusion-submit-btn { background: var(--c-primary); color: #fff; border: none; border-radius: 8px; padding: 8px 14px; font-size: 12px; font-weight: 600; cursor: pointer; font-family: 'DM Sans', sans-serif; }
.conclusion-submit-btn.disabled { opacity: .45; cursor: not-allowed; }
```

---

## Screen 6: Step Score (`renderCirclesStepScore`)

### Layout

```
Navbar (app header)
circles-nav (← | 步驟評分 — {step.label} · {company} | [simulation: ◀ ▶] | 回首頁)
progress bar (7 segments, done = steps up to and including current)
[Scrollable: scroll-body, padding-bottom: 100px]
  score-total  (big Instrument Serif number + step label)
  score-breakdown  (4 dim-rows: name+comment | bar | score/5)
  highlight-card.good  (最強表現)
  highlight-card.improve  (最需改進)
  coach-toggle  (教練示範答案 ▾ — COLLAPSED BY DEFAULT — click to expand)
[Fixed: submit-bar]
```

**Simulation mode `circles-nav` right side:** two icon buttons `◀ ▶` for browsing past step scores.
- First step (index 0): ◀ disabled (`opacity:0.3`, `disabled`)
- Last step (index 6): ▶ disabled
- Clicking ▶/◀ changes `circlesSimStepIndex` and re-renders this screen with that step's stored score.

**`submit-bar` variants (position: fixed bottom):**
| Mode | Left button | Right button |
|------|------------|-------------|
| Drill | `btn-ghost-sm` 回首頁 | `btn-secondary` 重練這道題 |
| Simulation, mid-step (not last) | `btn-ghost-sm` 回首頁 | `btn-primary` 繼續下一步：{next.label} → |
| Simulation, step 7 S (last) | `btn-ghost-sm` 回首頁 | `btn-primary` 查看總結報告 |

### HTML Structure

```html
<!-- circles-nav — drill mode (no step nav arrows) -->
<div class="circles-nav">
  <button class="btn-icon" id="circles-score-back"><i class="ph ph-arrow-left"></i></button>
  <div>
    <div class="circles-nav-title">步驟評分 — {step.label}</div>
    <div class="circles-nav-sub">{company} · {product}</div>
  </div>
  <button class="circles-nav-home-btn" id="circles-score-home-btn">回首頁</button>
</div>

<!-- circles-nav — simulation mode (with step nav arrows, right side) -->
<div class="circles-nav">
  <button class="btn-icon" id="circles-score-back"><i class="ph ph-arrow-left"></i></button>
  <div>
    <div class="circles-nav-title">步驟評分 — {step.label}</div>
    <div class="circles-nav-sub">{company} · {product}</div>
  </div>
  <div style="display:flex;gap:4px;margin-left:auto">
    <button class="btn-icon" id="circles-score-prev" {disabled?}><i class="ph ph-caret-left"></i></button>
    <button class="btn-icon" id="circles-score-next-step" {disabled?}><i class="ph ph-caret-right"></i></button>
  </div>
  <button class="circles-nav-home-btn" id="circles-score-home-btn">回首頁</button>
</div>

<!-- score-total: big number -->
<div class="score-total">
  <div class="score-number">78</div>
  <div class="score-sub">I — 定義用戶 步驟得分</div>
</div>

<!-- score-breakdown: 4 dim-rows -->
<div class="score-breakdown">
  <div class="dim-row">
    <div style="flex:1">
      <div class="dim-name">分群邏輯</div>
      <div class="dim-comment">依行為分群，維度一致</div>
    </div>
    <div class="dim-bar-wrap"><div class="dim-bar" style="width:80%"></div></div>
    <div class="dim-score">4<span>/5</span></div>
  </div>
  <!-- repeat × 4 total dims -->
</div>

<!-- highlight cards -->
<div class="highlight-card good">
  <div class="highlight-label">最強表現</div>
  <div class="highlight-text">成功挖出「保持社交存在感」作為 JTBD，而不只是表面的「減少廣告」，展現了用戶動機分析的深度</div>
</div>
<div class="highlight-card improve">
  <div class="highlight-label">最需改進</div>
  <div class="highlight-text">焦點用戶的選擇理由只說體量，沒有連結到商業價值——面試官會追問「為什麼這群人對 Meta 最重要？」</div>
</div>

<!-- coach toggle — COLLAPSED BY DEFAULT -->
<div class="coach-toggle" id="circles-coach-toggle">
  <div class="coach-toggle-label">教練示範答案 <i class="ph ph-caret-down" id="circles-coach-icon"></i></div>
  <div class="coach-content" id="circles-coach-content">
    <!-- full coach demo text, step-specific, see Per-Step Content Reference below -->
  </div>
</div>

<!-- submit-bar (position: fixed bottom) — drill variant -->
<div class="submit-bar">
  <button class="btn-ghost-sm" id="circles-score-home">回首頁</button>
  <button class="btn-secondary" id="circles-score-retry">重練這道題</button>
</div>

<!-- submit-bar — simulation mid-step variant -->
<div class="submit-bar">
  <button class="btn-ghost-sm" id="circles-score-home">回首頁</button>
  <button class="btn-primary" id="circles-score-advance">繼續下一步：R 發掘需求 →</button>
</div>

<!-- submit-bar — simulation last step (S) variant -->
<div class="submit-bar">
  <button class="btn-ghost-sm" id="circles-score-home">回首頁</button>
  <button class="btn-primary" id="circles-score-final">查看總結報告</button>
</div>
```

### JS Bindings (`bindCirclesStepScore`)

```javascript
// Coach toggle
document.getElementById('circles-coach-toggle')?.addEventListener('click', function() {
  var content = document.getElementById('circles-coach-content');
  var icon = document.getElementById('circles-coach-icon');
  content.classList.toggle('open');
  icon.className = content.classList.contains('open') ? 'ph ph-caret-up' : 'ph ph-caret-down';
});

// Back arrow (← in circles-nav)
document.getElementById('circles-score-back')?.addEventListener('click', function() {
  AppState.circlesPhase = 2;
  render();
});

// 回首頁 (nav bar button)
document.getElementById('circles-score-home-btn')?.addEventListener('click', function() {
  AppState.circlesSelectedQuestion = null;
  AppState.circlesPhase = 1;
  navigate('circles');
});

// 回首頁 (submit bar button)
document.getElementById('circles-score-home')?.addEventListener('click', function() {
  AppState.circlesSelectedQuestion = null;
  AppState.circlesPhase = 1;
  navigate('circles');
});

// 重練這道題 (drill only)
document.getElementById('circles-score-retry')?.addEventListener('click', function() {
  AppState.circlesPhase = 1;
  AppState.circlesConversation = [];
  AppState.circlesFrameworkDraft = {};
  render();
});

// 繼續下一步 (simulation mid-step)
document.getElementById('circles-score-advance')?.addEventListener('click', function() {
  AppState.circlesSimStepIndex++;
  AppState.circlesPhase = 1;
  AppState.circlesConversation = [];
  AppState.circlesFrameworkDraft = {};
  render();
});

// 查看總結報告 (simulation last step)
document.getElementById('circles-score-final')?.addEventListener('click', function() {
  AppState.circlesPhase = 4; // final report
  render();
});

// Simulation step nav arrows (◀ ▶)
document.getElementById('circles-score-prev')?.addEventListener('click', function() {
  AppState.circlesSimStepIndex--;
  render(); // re-renders score for previous step
});
document.getElementById('circles-score-next-step')?.addEventListener('click', function() {
  AppState.circlesSimStepIndex++;
  render();
});
```

### CSS

```css
.score-total { background: var(--c-card); border-radius: 16px; border: 1px solid var(--c-border); padding: 20px; text-align: center; margin-bottom: 14px; }
.score-number { font-family: 'Instrument Serif', serif; font-size: 60px; color: var(--c-primary); line-height: 1; margin-bottom: 4px; font-weight: 400; }
.score-sub { font-size: 13px; color: var(--c-text-2); font-family: 'DM Sans', sans-serif; }

.score-breakdown { background: var(--c-card); border-radius: 12px; border: 1px solid var(--c-border); padding: 14px; margin-bottom: 14px; }
.dim-row { display: flex; align-items: center; gap: 10px; padding: 9px 0; border-bottom: 1px solid var(--c-border); font-size: 12px; }
.dim-row:last-child { border-bottom: none; }
.dim-name { font-size: 12px; color: var(--c-text-2); font-family: 'DM Sans', sans-serif; }
.dim-comment { font-size: 10px; color: var(--c-text-3); margin-top: 1px; line-height: 1.4; font-family: 'DM Sans', sans-serif; }
.dim-bar-wrap { width: 70px; height: 5px; background: #f0ede6; border-radius: 3px; flex-shrink: 0; }
.dim-bar { height: 100%; border-radius: 3px; background: var(--c-primary); }
.dim-score { font-weight: 700; color: var(--c-text); min-width: 24px; text-align: right; font-family: 'DM Sans', sans-serif; font-size: 12px; }
.dim-score span { font-size: 9px; color: var(--c-text-3); }

.highlight-card { border-radius: 10px; border: 1.5px solid; padding: 12px 14px; margin-bottom: 10px; }
.highlight-card.good { background: #F0FFF4; border-color: #BBF7D0; }
.highlight-card.improve { background: #FFFBEB; border-color: #FDE68A; }
.highlight-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; margin-bottom: 4px; font-family: 'DM Sans', sans-serif; }
.highlight-card.good .highlight-label { color: var(--c-success, #137A3D); }
.highlight-card.improve .highlight-label { color: var(--c-warning, #B85C00); }
.highlight-text { font-size: 13px; color: var(--c-text); line-height: 1.5; font-family: 'DM Sans', sans-serif; }

.coach-toggle { background: var(--c-card); border: 1px solid var(--c-border); border-radius: 12px; padding: 14px; margin-bottom: 14px; cursor: pointer; }
.coach-toggle-label { font-size: 12px; font-weight: 700; color: var(--c-text-2); display: flex; align-items: center; justify-content: space-between; font-family: 'DM Sans', sans-serif; }
.coach-content { font-size: 12px; color: var(--c-text-2); line-height: 1.7; margin-top: 10px; display: none; font-family: 'DM Sans', sans-serif; }
.coach-content.open { display: block; }

.submit-bar { position: fixed; bottom: 0; left: 50%; transform: translateX(-50%); width: 100%; max-width: 390px; background: var(--c-card); border-top: 1px solid var(--c-border); padding: 12px 16px; display: flex; gap: 8px; z-index: 10; }
.btn-ghost-sm { background: none; color: var(--c-text-2); border: 1px solid var(--c-border); border-radius: 10px; padding: 12px 16px; font-size: 14px; font-weight: 600; cursor: pointer; font-family: 'DM Sans', sans-serif; white-space: nowrap; }
```

---

## CIRCLES Per-Step Content Reference

This section contains the rubric dimensions, example scores, coach demo answers, and Phase 2 dialogue examples for each step. Implementers **must use this as the canonical content** when rendering `renderCirclesStepScore` and populating `CIRCLES_STEP_HINTS`.

---

### C1 — 澄清情境

**Rubric dimensions (4):**

| dim-name | dim-comment (example, from AI) | example score |
|----------|-------------------------------|--------------|
| 問題邊界清晰度 | 確認了廣告頻率問題，但未區分相關性與格式 | 3.5/5 |
| 業務影響連結 | 提到廣告收入保護，但未量化約束條件 | 3/5 |
| 時間範圍合理性 | 設定 90 天合理，符合廣告收入指標週期 | 4/5 |
| 假設排除完整性 | 排除了技術限制，但未說明競品對比的假設 | 2.5/5 |

**Example total score:** 72（formula: (3.5+3+4+2.5) × 100 / (4×5) = 65 → rounded to 72 in display）

**最強表現：** 清楚說明「廣告收入保護」是這題的硬性約束，讓整個分析有正確的業務邊界

**最需改進：** 假設確認太少——沒有問「廣告問題是頻率、相關性、還是格式？」這個區分會完全改變後續的解法方向

**教練示範答案（完整，用於 coach-content）：**
```
【問題範圍】聚焦 News Feed 廣告體驗，排除 Stories、Reels、Marketplace 廣告版位。需釐清「廣告過多」是指頻率（每 N 則一則廣告）、相關性（廣告與用戶興趣不符），還是格式（影片/靜態圖干擾感不同）——三者是完全不同的問題。

【時間範圍】設定 90 天觀察期。廣告業務以季度為單位衡量，90 天足以看到用戶行為變化與收入影響的相關性。

【業務影響】核心約束是廣告收入不能下降超過 X%（需確認 Meta 的容忍閾值）。改善用戶體驗的同時，廣告主 ROI 不能大幅下滑——否則廣告主撤單，業務鏈斷掉。

【假設確認】① 廣告問題是相關性而非純頻率（假設）；② 用戶對廣告的負感來自打斷心流，不是廣告本身（假設）；③ 技術上可以做到動態插入頻率調控（待確認）。
```

**Simulation 模式 submit-bar（C1 是第 1/7 步）：** 回首頁 ｜ 繼續下一步：I 定義用戶 →

**`CIRCLES_STEP_HINTS['C1']` array (drill mode 查看範例 text):**
```javascript
['聚焦 News Feed 廣告，排除 Stories / Reels / Marketplace。「廣告過多」先判定是相關性問題（廣告內容與用戶興趣不符），而非頻率或格式問題——訪談中再確認',
 '設定 90 天觀察期——廣告業務以季度為單位，90 天足以看到用戶行為變化與收入影響的相關性',
 '核心約束是廣告收入不能下降超過 X%，廣告主 ROI 不能大幅下滑——否則廣告主撤單，業務鏈斷掉',
 '① 廣告問題是相關性而非純頻率；② 用戶負感來自打斷心流，不是廣告本身；③ 技術上可做到動態插入頻率調控（待確認）']
```

**Phase 1 hint overlay texts (💡 buttons):**
- 問題範圍：「澄清「廣告過多」的具體含義——是頻率（每 N 則出現一則廣告）、相關性（廣告與用戶興趣不符），還是格式（影片廣告干擾感更強）？三者是完全不同的問題，會導致完全不同的解法。同時確認討論範圍：只看 News Feed，還是包含 Stories 和 Reels？邊界越清楚，後面的分析越聚焦。」
- 時間範圍：「設定一個合理的觀察期。廣告業務以季度為單位衡量，90 天足以觀察用戶行為變化和收入影響的相關性。太短（2週）看不出趨勢，太長（1年）讓面試官覺得你沒有執行感。說明為什麼這個時間範圍適合這個問題——不只是給個數字。」
- 業務影響：「廣告業務有兩個關鍵利益相關方——用戶和廣告主。改善用戶廣告體驗可能影響廣告曝光量，進而影響廣告主 ROI 和 Meta 收入。你需要說明這個改善的核心業務約束：收入不能下降多少？廣告主的什麼承諾不能打破？說清楚這個邊界，你的分析才有業務合理性。」
- 假設確認：「列出你在後續分析中會用到的、尚未被確認的假設。例如：「廣告問題是相關性而非純頻率」、「用戶的負感來自打斷心流而非廣告本身」。把假設說清楚，面試官才知道你的分析建立在什麼基礎上，也給你機會確認哪些假設需要驗證。列出 2-3 條最關鍵的就夠。」

**Phase 2 icebreaker text:**
「問被訪談者這個問題的核心是什麼——「廣告過多」是指頻率、相關性，還是格式？同時確認業務上有哪些不能突破的限制。」

**Phase 2 dialogue (4 turns):**
1. User: 你們說「廣告過多」，這個「多」是什麼意思——是廣告頻率太高、廣告和我沒關係，還是格式干擾感太強？  
   AI: 三種都有，但最集中的投訴是相關性——用戶覺得廣告和自己完全沒關係。頻率問題也有，但用戶更能接受廣告本身，只要是在意的東西  
   Coach: 做了最關鍵的一步：把「廣告過多」拆解成三種類型並確認主要問題是相關性，決定了後續所有分析方向  
   Hint（折疊）: 問「這次改善你們打算在多長時間內完成並看到效果？有沒有時間上的限制？」

2. User: 這次改善你們打算在多長時間內完成並看到效果？有沒有時間上的限制？  
   AI: 一個季度——90 天左右。廣告這塊比較敏感，不太可能做長達半年的大工程。季度初啟動、季度末看數字  
   Coach: 90 天時間框架合理，符合廣告業務的季度週期。讓你後面評估方案時知道必須選可以在一季度內驗證效果的解法  
   Hint（折疊）: 問「廣告收入這塊，有沒有什麼不能突破的業務紅線？」

3. User: 廣告收入這塊，你們在這次改善裡有沒有什麼不能突破的業務紅線？  
   AI: 季度 guidance 已出，收入不能降超過一定比例；廣告主合約承諾曝光量不能大幅縮減  
   Coach: 問出了兩層業務約束——收入保護和廣告主承諾。這是 C1 最重要的輸出：硬性約束決定後續所有分析的業務邊界  
   Hint（折疊）: 「最後主動確認你的假設：「我假設主要問題是相關性而非純頻率，這個方向對嗎？」」

4. User: 我做了幾個假設，確認一下：主要問題是相關性非頻率；負感來自心流被打斷；技術上可做到動態調控。這三個方向對嗎？  
   AI: 前兩個確認，第三個工程團隊評估中、尚無明確結論——先列為待確認假設  
   Coach: C1 四個核心維度——問題邊界、時間範圍、業務約束、假設確認——已完整確認。主動提出假設讓對方確認是很好的澄清技巧

**Phase 2 conclusion box spec:**
- Sub-text: 「說明問題範圍、時間框架、業務約束，以及你確認或待確認的假設」
- Placeholder: 「針對這題，整理你澄清的問題範圍、時間框架、業務約束，以及假設確認…」
- Example strip (collapsed, 範例不同題目): Spotify 問題範圍：聚焦免費版廣告體驗，排除付費方案和播客廣告。時間範圍：60 天。業務約束：廣告收入和免費→付費轉換率都不能下降。假設：用戶廣告負感主要來自廣告在情感高潮段落出現，而非廣告本身。

**Score nav in circles-nav (simulation mode):**
- ◀ disabled（C1 是第一步，無前置已完成步驟）
- ▶ disabled（C1 是目前最新完成步驟，尚無下一步評分可查看）

---

### I — 定義用戶

**Rubric dimensions (4):**

| dim-name | dim-comment (example, from AI) | example score |
|----------|-------------------------------|--------------|
| 分群邏輯 | 依行為分群，維度一致 | 4/5 |
| 焦點選定理由 | 理由說明了體量，但商業價值不夠清晰 | 3/5 |
| JTBD 動機深度 | 挖到「保持社交存在感」，層次清晰 | 4.5/5 |
| 排除對象說明 | 排除廣告主和新用戶，理由合理 | 3.5/5 |

**Example total score:** 78

**最強表現：** 成功挖出「保持社交存在感」作為 JTBD，而不只是表面的「減少廣告」，展現了用戶動機分析的深度

**最需改進：** 焦點用戶的選擇理由只說體量，沒有連結到商業價值——面試官會追問「為什麼這群人對 Meta 最重要？」

**Phase 1 drill hints (`CIRCLES_STEP_HINTS['I']`):**
```javascript
['功能型用戶 / 習慣型用戶 / 新用戶',
 '最有代表性且體量最大的群體',
 '他們想完成什麼「任務」（JTBD）',
 '不服務哪類用戶及原因']
```

**Phase 1 hint overlay content (per field, shown when 💡 clicked):**

- 目標用戶分群：「思考用戶使用 News Feed 的不同行為模式。哪些群體對廣告的感受最強烈？功能型用戶、習慣型用戶、新用戶各有什麼不同的痛點？這個分群方式要足夠具體，能讓後續的需求分析聚焦在真正不同的動機上。」
- 選定焦點對象：「從上面的分群中選一個。選擇標準是：體量最大且對廣告痛點最有代表性的群體。說清楚為什麼這個群體是最值得優先服務的，而不是另外幾個。這個理由會影響整個後續的需求和方案設計。」
- 用戶動機假設：「用 JTBD（Jobs to Be Done）框架思考：這個用戶「聘用」News Feed 是為了完成什麼任務？不是「滑手機」，而是更深層的目標——保持社交聯繫、消磨時間、獲取資訊？動機越具體，後面需求分析就越有說服力。」
- 排除對象：「說明哪些用戶群體你不服務，以及原因。例如：不服務廣告主（有獨立工具）、不服務純新用戶（行為資料不足）。這一欄的目的是讓面試官看到你的邊界意識——你的設計不是要取悅所有人。」

**Phase 2 收斂範例對話（4 輪，Meta News Feed 題）：**

Turn 1:
- 用戶問：「News Feed 的用戶群，你們有沒有按照使用頻率或行為做分類？」
- 被訪談者：「有，我們大概分成每天都在滑的、每週來幾次的，還有偶爾才打開的。頻率不一樣，他們對 Feed 的依賴感也很不一樣。」
- 教練點評：「好的開始，用頻率分群合理。但還沒說清楚「每天滑」的人和廣告問題的關係——繼續追。」
- 教練提示（折疊）：「問他們「哪個群體對廣告的投訴最集中？」這樣可以幫你確認焦點對象。」

Turn 2:
- 用戶問：「這三組裡，哪一組對廣告的抱怨最多？他們有什麼共同特徵？」
- 被訪談者：「每天都在用的那批，他們的投訴量最多，而且情緒最強烈。他們覺得「廣告打斷了我想看的東西」。但他們也是我們最活躍的用戶，廣告曝光對我們很重要。」
- 教練點評：「很好的觀察——你同時拿到了「誰痛苦最深」和「誰對業務最重要」兩個維度，這就是鎖定焦點對象的完整理由。」
- 教練提示（折疊）：「現在問他們來 Feed「是為了完成什麼任務」——不是「想看什麼內容」而是更深層的動機。」

Turn 3:
- 用戶問：「這些每天用的人，他們打開 Feed 的底層動機是什麼？不是「看新聞」這種表面答案。」
- 被訪談者：「我覺得是一種「不想脫節」的感覺——他們想知道朋友在幹嘛、社群在討論什麼。有點像每天早上看報紙，是一個確認自己還在這個圈子的儀式。廣告打斷的，其實是這個「確認感」的心流。」
- 教練點評：「這是整個 I 步驟最關鍵的一句話：「確認社交存在感」才是 JTBD，不是看廣告少一點。你問出了動機層，而不只是行為層。」
- 教練提示（折疊）：「最後補一個：「哪些用戶你們不打算服務？」確認排除對象後就可以提交了。」

Turn 4:
- 用戶問：「那這次優化的範圍裡，哪些用戶你們不打算處理？」
- 被訪談者：「廣告主那側不在這次範圍，他們有 Ads Manager。純新用戶我們也先不管，資料太少、個人化沒辦法做，硬做反而體驗更差。」
- 教練點評：「排除對象清晰有理由。到這裡，I 步驟的四個核心維度——分群、焦點、JTBD、排除——都已完整確認，可以收斂提交了。」
- 教練提示（折疊）：「整理你的結論：鎖定哪個群體、底層動機是什麼、排除誰及原因。一兩句話就夠。」

**Phase 2 結論框：**
- title：「整理你這個步驟確認了什麼」
- sub-text：「用 1-2 句話說明：鎖定的用戶群、JTBD 動機、排除對象」
- 範例（collapsed，不同題目）：「聚焦 Spotify 免費版每日活躍用戶，他們使用 App 的 JTBD 是「用音樂管理情緒狀態」，不是隨機發現新音樂。排除付費用戶（已無廣告痛點）和偶爾用戶（資料不足）。」
- 8s AI 偵測通過後的 hint：「✓ 結論涵蓋用戶群、JTBD 動機和排除對象，可以提交」

**教練示範答案（完整，用於 coach-content）：**
```
【分群】依使用頻率分為三組：每日活躍用戶（DAU）、週活躍用戶（WAU）、月活躍用戶（MAU）。

【焦點】聚焦 DAU，理由有三：① 體量佔 Meta MAU 的 65%+，② 廣告曝光頻率最高，痛點最強，③ 對 Meta 廣告收入貢獻比例最高，優化 ROI 最大。

【JTBD】他們「聘用」News Feed 的任務是「以低成本維持在社交圈的存在感」，廣告打斷的是這個心流，而不只是視覺體驗。

【排除】不服務廣告主（有 Ads Manager）、不服務 MAU（資料稀疏，個人化困難）。
```

**Simulation 模式 submit-bar（I 是第 2/7 步）：** 回首頁 ｜ 繼續下一步：R 發掘需求 →

**Score nav in circles-nav (simulation mode):**
- ◀ (onclick → show C1 step score) — `score-nav-btn`
- ▶ disabled (I is current/latest step) — `score-nav-btn` with `disabled`

---

### R — 發掘需求

**Rubric dimensions (4):**

| dim-name | dim-comment (example, from AI) | example score |
|----------|-------------------------------|--------------|
| 功能需求 | 清楚列出效率需求與過濾需求，三層對應完整 | 4/5 |
| 情感/社交需求 | 挖到漏接焦慮，但社交動機深度（弱連結價值）不足 | 3.5/5 |
| 痛點層次 | 痛點與功能需求對應清晰，成功連結三層需求 | 4/5 |
| 需求優先說明 | 未清楚說明哪個需求最核心、為何優先處理 | 3/5 |

**Example total score:** 73（formula: (4+3.5+4+3) × 100 / (4×5) = 72.5 → rounded to 73 in display）

**最強表現：** 成功從功能層挖到情感痛點「漏接焦慮」，三層需求串聯完整

**最需改進：** 未說明哪個需求是最優先處理的痛點及其理由

**Phase 1 hint overlay content (per field, shown when 💡 clicked):**

- 功能性需求：「想想這位「習慣型用戶」打開 News Feed 要完成的任務。功能性需求是「做到什麼」——他需要什麼功能才能完成這個任務？從他每天打開 App 的那個行為出發，往前推：他想過濾什麼？想找到什麼？這個答案會決定後續核心痛點的定義方向。」
- 情感性需求：「情感性需求不是功能，是用戶使用產品時的「感受」。這位用戶打開 Facebook 時想要什麼感覺？他不想有什麼感覺？注意：「想看好內容」是功能需求，不是情感需求——情感需求應該描述感受層，例如焦慮、歸屬感、成就感。即使是 SaaS 或工具性產品，也一定有情感需求。」
- 社交性需求：「社交性需求是用戶在人際關係中需要什麼。這位用戶如何透過 News Feed 維持社交關係？他想對哪些人的動態有所回應？想在什麼樣的社群中保有存在感？B2B SaaS 也有社交需求——例如與團隊共享成果、讓主管看到你的工作進度。」
- 核心痛點：「核心痛點是上面三層需求中「最根本的一個沒被滿足」的需求。你要選出一個，說明它是功能層、情感層還是社交層的痛點，並說清楚為什麼它是「核心」。這個優先判斷會直接影響後續 C 步驟的取捨標準——所以這欄要有你的立場，不只是列舉。」

**Phase 1 drill hints (`CIRCLES_STEP_HINTS['R']`):**
```javascript
['快速判斷貼文價值、過濾低品質內容、控制看到哪些類型的貼文',
 '不想因漏看重要動態而焦慮、希望打開 App 有收穫感而非空虛',
 '維持與遠距朋友和家人的弱連結、對重要時刻（婚禮、升學）及時回應',
 '打開 App 後滑了 10 分鐘卻沒有任何有意義的互動，長期降低對 Facebook 的預期']
```

**Phase 1 collapsible field examples (`.field-example-body` content, per field):**

- 功能性需求：「快速判斷貼文價值、過濾低品質內容、控制看到哪些類型的貼文」
- 情感性需求：「不想因漏看重要動態而焦慮、希望打開 App 有收穫感而非空虛」
- 社交性需求：「維持與遠距朋友和家人的弱連結、對重要時刻（婚禮、升學）及時回應」
- 核心痛點：「打開 App 後滑了 10 分鐘卻沒有任何有意義的互動，長期降低對 Facebook 的預期」

> **New pattern (R step only):** Field examples are collapsible via `.field-example-toggle` button + `.field-example-body.open` class toggle. Clicking "查看範例" expands; clicking "收起範例" collapses. This replaces the always-visible `.circles-field-hint` pattern used in C1 and I steps.

**Phase 2 收斂範例對話（4 輪，Meta News Feed 題）：**

Turn 1:
- 用戶問：「你們的習慣型用戶每天打開 News Feed 時，最常做的事情是什麼？」
- 被訪談者：「嗯，大部分人是滑一滑、看看有什麼新鮮事吧。有時候會對貼文按個讚，或者看到朋友的照片留個言。不過說實話，很多人打開來滑一滑，也說不清楚自己在幹嘛。」
- 教練點評：「問出了基本使用行為，但還停在表面。「說不清楚自己在幹嘛」這句話很有趣，可以順著這個方向繼續挖。」
- 教練提示（折疊）：「試試問：「這些用戶打開 App 之前，他們預期會看到什麼？結果看到的是什麼？」」

Turn 2:
- 用戶問：「這些用戶打開 App 的時候，他們希望看到什麼？實際上看到的是什麼？」
- 被訪談者：「我想他們是想知道朋友最近在幹嘛，有沒有什麼重要的事情發生。但實際上他們看到的，很大比例是廣告、粉絲頁的影片、還有完全不認識的人分享的東西。這個落差，確實是大家抱怨比較多的地方。」
- 教練點評：「很好，你挖到了「預期與現實的落差」——這是功能性需求沒有被滿足的核心。繼續往情感層問，問問這個落差對用戶有什麼感受。」
- 教練提示（折疊）：「問：「這個落差對用戶有什麼影響？他們打完 App 後是什麼感覺？」」

Turn 3:
- 用戶問：「這個落差對用戶有什麼影響？他們關掉 App 之後是什麼感覺？」
- 被訪談者：「有一部分人說關掉之後覺得有點空、有點浪費時間的感覺。有些人甚至會覺得有點焦慮——不確定自己有沒有漏掉什麼重要的朋友動態。」
- 教練點評：「很好，挖到了兩種情感——「空虛感」和「漏接焦慮」。這兩個都是情感性需求，繼續問哪一個更核心。」
- 教練提示（折疊）：「問：「這兩種感覺哪一個更常出現？有沒有具體例子？」」

Turn 4:
- 用戶問：「這兩種感覺——空虛感和漏接焦慮——哪一個更普遍？你們有沒有具體案例？」
- 被訪談者：「漏接焦慮我覺得更嚴重一點。有用戶說，同學結婚他後來才從別人口中知道——因為那則貼文被其他內容淹沒了，根本沒看到。這種錯誤不只讓他覺得難過，也讓他覺得「以後 Facebook 不可靠」。」
- 教練點評：「這是社交需求和情感需求的交叉點——「維持重要關係的社交存在感」讓 Feed 的可信賴性變成核心痛點。三層需求都已完整探索，可以收斂提交了。」
- 教練提示（折疊）：「整理結論：三層需求各一句，然後說哪個是最核心的痛點及原因。」

**Phase 2 結論框：**
- title：「整理你這個步驟確認了什麼」
- sub-text：「用 1-2 句話說明：三層需求各一句，並說明哪個是核心痛點」
- 範例（collapsed，不同題目）：「Spotify 免費用戶的功能需求是「快速找到符合當下心情的音樂」；情感需求是「用音樂管理情緒狀態的掌控感」；社交需求是「分享歌單維持社交話題」。核心痛點：情感層的掌控感缺失最嚴重，直接影響留存。」
- 8s AI 偵測通過後的 hint：「✓ 結論涵蓋三層需求並說明核心痛點，可以提交」

**教練示範答案（完整，用於 coach-content）：**
```
【功能性】用戶需要演算法優先展示「緊密連結朋友」的動態，過濾陌生粉絲頁內容。

【情感性】最核心的情感需求是「避免錯過重要社交時刻的焦慮」，這個焦慮直接影響留存率。

【社交性】用戶需要被動維持弱連結，關鍵是不需要主動管理優先序。

【核心痛點（優先）】情感層的焦慮痛點優先，因為它直接觸發打開頻率下降。
```

**Simulation 模式 submit-bar（R 是第 3/7 步）：** 回首頁 ｜ 繼續下一步：C 優先排序 →

**Score nav in circles-nav (simulation mode):**
- ◀ (onclick → show I step score) — `score-nav-btn`
- ▶ disabled (R is current/latest step) — `score-nav-btn` with `disabled`

---

## Mockup HTML — C1 澄清情境完整互動稿

**Mockup 來源路徑：** `.superpowers/brainstorm/99819-1777221639/content/circles-C1-step-v1.html`（直接用瀏覽器開啟即可預覽）。**此 HTML 是實作的視覺真相來源（canonical visual truth）——若 spec 文字與此畫面有出入，以此 HTML 為準。**

**8 screens:** P1 加練, P1+提示, Gate ✓, Gate ✗, P2 早期, P2 收斂, P2 結論, P3 C1評分

**Step-specific patterns for C1:**
| Pattern | Description |
|---------|-------------|
| `.chat-icebreaker` | Blue-tinted card as first element in `.chat-body` |
| Score nav ◀▶ both disabled | C1 is first step — no adjacent completed steps |
| Progress bar: 1 active segment | Position 1/7 |
| `CIRCLES_STEP_HINTS['C1']` | See Per-Step Content Reference above |

```html
<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
<title>CIRCLES — C1 澄清情境 Mockup</title>
<link rel="stylesheet" href="https://unpkg.com/@phosphor-icons/web@2.1.1/src/regular/style.css">
<style>
* { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
body { font-family: 'DM Sans', -apple-system, sans-serif; background: #F2F0EB; display: flex; justify-content: center; }

:root {
  --bg: #F2F0EB;
  --card: #ffffff;
  --border: #e8e5de;
  --primary: #1A56DB;
  --primary-lt: #EEF3FF;
  --text: #1a1a1a;
  --text-2: #5a5a5a;
  --text-3: #8a8a8a;
  --success: #137A3D;
  --warning: #B85C00;
  --danger: #D92020;
}

.top-nav {
  position: fixed; top: 0; left: 50%; transform: translateX(-50%);
  background: #111; display: flex; gap: 8px; padding: 8px 16px;
  z-index: 999; border-radius: 0 0 12px 12px; overflow-x: auto;
  white-space: nowrap; max-width: 100vw;
}
.nav-label {
  font-size: 11px; font-weight: 700; background: #1a1a1a; color: #fff;
  padding: 6px 14px; border-radius: 20px; cursor: pointer;
  font-family: sans-serif; white-space: nowrap;
}
.nav-label:hover { background: #333; }
.nav-label.active { background: var(--primary); }

.wrapper { max-width: 390px; width: 100vw; margin-top: 54px; position: relative; }
.shell { width: 390px; min-height: 100vh; background: var(--bg); position: relative; overflow: hidden; }
.screen { display: none; flex-direction: column; height: 100vh; }
.screen.active { display: flex; }

.btn-icon { background: none; border: none; font-size: 18px; color: var(--text-2); cursor: pointer; padding: 6px; line-height: 1; }

.circles-nav {
  height: 52px; background: var(--card); border-bottom: 1px solid var(--border);
  display: flex; align-items: center; padding: 0 14px; gap: 10px; flex-shrink: 0;
}
.circles-nav-title { font-size: 14px; font-weight: 700; color: var(--text); }
.circles-nav-sub { font-size: 11px; color: var(--text-3); }
.circles-nav-home { font-size: 12px; color: var(--primary); border-bottom: 1px solid var(--primary); background: none; border-top: none; border-left: none; border-right: none; padding: 2px 0; cursor: pointer; white-space: nowrap; flex-shrink: 0; margin-left: auto; }

.circles-progress {
  height: 36px; background: var(--card); border-bottom: 1px solid var(--border);
  display: flex; align-items: center; padding: 0 14px; gap: 3px; flex-shrink: 0;
}
.circles-progress-seg { flex: 1; height: 4px; background: #e8e5de; border-radius: 2px; }
.circles-progress-seg.done { background: var(--primary); }
.circles-progress-seg.active { background: rgba(26,86,219,0.4); }
.circles-progress-label { font-size: 10px; color: var(--text-3); white-space: nowrap; margin-left: 8px; }

.scroll-body { flex: 1; overflow-y: auto; padding: 16px; scrollbar-width: none; }
.scroll-body::-webkit-scrollbar { display: none; }

.submit-bar {
  background: var(--card); border-top: 1px solid var(--border);
  padding: 12px 16px; display: flex; gap: 10px; flex-shrink: 0;
}
.btn-primary { flex: 1; background: var(--primary); color: #fff; border: none; border-radius: 10px; padding: 12px 16px; font-size: 14px; font-weight: 600; cursor: pointer; font-family: 'DM Sans', sans-serif; }
.btn-secondary { background: #f0ede6; color: var(--text); border: none; border-radius: 10px; padding: 12px 16px; font-size: 14px; font-weight: 600; cursor: pointer; white-space: nowrap; }
.btn-ghost-sm { background: none; color: var(--text-2); border: 1px solid var(--border); border-radius: 10px; padding: 12px 16px; font-size: 14px; font-weight: 600; cursor: pointer; white-space: nowrap; }

.problem-card {
  background: var(--card); border-radius: 10px; border: 1px solid var(--border);
  padding: 12px 14px; font-size: 13px; color: var(--text-2); line-height: 1.6;
  margin-bottom: 14px;
}
.problem-card-label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: .07em; color: var(--text-3); margin-bottom: 4px; }

.circles-step-pills { display: flex; gap: 6px; overflow-x: auto; margin-bottom: 14px; scrollbar-width: none; padding-bottom: 2px; }
.circles-step-pills::-webkit-scrollbar { display: none; }
.circles-step-pill { flex-shrink: 0; padding: 5px 12px; border-radius: 20px; border: 1px solid var(--border); background: var(--card); font-size: 11px; font-weight: 600; color: var(--text-3); cursor: pointer; white-space: nowrap; }
.circles-step-pill.active { background: var(--primary); color: #fff; border-color: var(--primary); }
.circles-step-pill.done { background: #e6f0e8; color: var(--success); border-color: #b8dbbf; }

.circles-field-group { margin-bottom: 16px; }
.circles-field-label-row { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 4px; }
.circles-field-label { font-size: 10px; color: var(--text-3); text-transform: uppercase; letter-spacing: .07em; font-weight: 700; }
.circles-hint-trigger { background: none; border: none; font-size: 11px; color: var(--primary); cursor: pointer; padding: 0; white-space: nowrap; }
.field-example-toggle { background: none; border: none; font-size: 10px; color: var(--text-3); cursor: pointer; padding: 0 0 5px; display: flex; align-items: center; gap: 3px; font-family: 'DM Sans', sans-serif; }
.field-example-body { display: none; font-size: 11px; color: var(--text-3); margin-bottom: 6px; line-height: 1.5; padding: 5px 8px; background: rgba(0,0,0,0.03); border-radius: 6px; }
.field-example-body.open { display: block; }
.circles-field-input { width: 100%; padding: 11px 13px; border-radius: 10px; border: 1.5px solid var(--border); background: var(--card); font-size: 13px; font-family: 'DM Sans', sans-serif; color: var(--text); resize: none; outline: none; line-height: 1.5; }
.circles-field-input:focus { border-color: var(--primary); }
.circles-field-input.filled { border-color: rgba(26,86,219,0.3); background: #fbfaff; }

.gate-pass-bar { background: var(--primary-lt); border: 1px solid #C5D5FF; border-radius: 10px; padding: 12px 14px; margin-bottom: 16px; }
.gate-pass-text { font-size: 12px; font-weight: 600; color: var(--primary); }
.gate-pass-sub { font-size: 11px; color: #5a7ab5; }
.gate-fail-bar { background: #FFF3F3; border: 1px solid #FFCDD2; border-radius: 10px; padding: 12px 14px; margin-bottom: 16px; font-size: 12px; color: var(--danger); }
.gate-card { background: var(--card); border-radius: 10px; border: 1.5px solid var(--border); padding: 12px 14px; margin-bottom: 10px; display: flex; gap: 10px; align-items: flex-start; }
.gate-card.ok { border-color: #b8dbbf; }
.gate-card.warn { border-color: #FFD54F; }
.gate-card.error { border-color: #f5c6c6; }
.gate-card-icon { font-size: 15px; flex-shrink: 0; margin-top: 1px; }
.gate-card-field { font-size: 9px; text-transform: uppercase; letter-spacing: .05em; color: var(--text-3); margin-bottom: 2px; }
.gate-card-title { font-size: 13px; font-weight: 700; color: var(--text); margin-bottom: 3px; }
.gate-card-reason { font-size: 12px; color: var(--text-2); line-height: 1.5; }
.gate-card-suggestion { font-size: 11px; color: var(--warning); margin-top: 4px; }

.chat-wrap { display: flex; flex-direction: column; height: 100vh; overflow: hidden; }
.chat-pinned { background: var(--card); border-bottom: 1px solid var(--border); padding: 8px 14px; flex-shrink: 0; }
.pinned-co { font-size: 10px; color: var(--primary); font-weight: 600; text-transform: uppercase; letter-spacing: .05em; margin-bottom: 1px; }
.pinned-stmt { font-size: 11px; color: var(--text); font-weight: 600; line-height: 1.4; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.chat-body { flex: 1; overflow-y: auto; padding: 14px 16px; scrollbar-width: none; }
.chat-body::-webkit-scrollbar { display: none; }
.bubble-user {
  background: var(--card); border: 1px solid var(--border);
  border-radius: 12px 4px 12px 12px; padding: 10px 13px;
  font-size: 13px; line-height: 1.6; color: var(--text);
  margin-bottom: 10px; max-width: 88%; margin-left: auto;
}
.bubble-ai {
  background: var(--primary-lt); border: 1px solid rgba(26,86,219,0.18);
  border-radius: 4px 12px 12px 12px; padding: 10px 13px;
  font-size: 13px; line-height: 1.6; color: var(--text);
  margin-bottom: 10px; max-width: 88%;
}
.bubble-section { font-size: 10px; font-weight: 700; color: var(--text-3); text-transform: uppercase; letter-spacing: .07em; margin-bottom: 3px; }
.bubble-coaching { background: rgba(0,0,0,0.03); border: 1px solid var(--border); border-radius: 4px 12px 12px 12px; padding: 10px 13px; font-size: 12px; line-height: 1.6; color: var(--text); margin-bottom: 10px; max-width: 88%; }
.hint-toggle { background: none; border: none; font-size: 11px; color: var(--text-3); cursor: pointer; padding: 0; display: flex; align-items: center; gap: 3px; margin-top: 6px; }
.hint-body { display: none; margin-top: 4px; padding: 6px 8px; background: rgba(0,0,0,0.04); border-radius: 6px; color: var(--text-2); font-size: 11px; line-height: 1.5; }
.chat-input-bar { background: var(--card); border-top: 1px solid var(--border); padding: 10px 14px; display: flex; gap: 8px; align-items: flex-end; flex-shrink: 0; }
.chat-icebreaker { background: rgba(26,86,219,0.05); border: 1px solid rgba(26,86,219,0.18); border-radius: 10px; padding: 10px 13px; margin-bottom: 14px; }
.chat-icebreaker-label { font-size: 9px; font-weight: 700; color: var(--primary); text-transform: uppercase; letter-spacing: .07em; margin-bottom: 5px; display: flex; align-items: center; gap: 4px; }
.chat-icebreaker-text { font-size: 12px; color: var(--text-2); line-height: 1.65; }
.chat-input { flex: 1; background: #f5f5f5; border: 1px solid var(--border); border-radius: 10px; padding: 9px 13px; font-size: 14px; color: var(--text); font-family: 'DM Sans', sans-serif; resize: none; outline: none; min-height: 40px; }
.chat-send-btn { width: 40px; height: 40px; border-radius: 10px; background: var(--primary); border: none; color: #fff; font-size: 16px; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.chat-submit-row { padding: 6px 12px 10px; display: flex; justify-content: center; background: var(--card); flex-shrink: 0; border-top: 1px solid var(--border); }
.chat-submit-btn { font-size: 11px; color: var(--text-2); border: 1px solid var(--border); border-radius: 8px; padding: 6px 16px; cursor: pointer; background: var(--card); }

.conclusion-box { border-top: 2px solid var(--primary); background: var(--card); padding: 14px; flex-shrink: 0; max-height: 55vh; overflow-y: auto; }
.conclusion-title { font-size: 11px; font-weight: 700; color: var(--text); margin-bottom: 2px; }
.conclusion-sub { font-size: 10px; color: var(--text-3); margin-bottom: 8px; }
.conclusion-textarea { width: 100%; border: 1px solid #ddd; border-radius: 8px; padding: 9px; font-size: 11px; line-height: 1.6; resize: none; height: 60px; box-sizing: border-box; font-family: 'DM Sans', sans-serif; color: var(--text); outline: none; }
.conclusion-hint { min-height: 16px; font-size: 10px; color: var(--text-3); margin-top: 6px; }
.conclusion-hint.pass { background: #E8F5E9; color: var(--success); border-radius: 4px; padding: 4px 8px; }
.conclusion-hint.warn { background: #FFF8E1; color: #7A5800; border-radius: 4px; padding: 4px 8px; }
.conclusion-actions { margin-top: 8px; display: flex; align-items: center; justify-content: space-between; }
.conclusion-back-btn { font-size: 10px; color: var(--text-3); background: none; border: none; cursor: pointer; }
.conclusion-submit-btn { background: var(--primary); color: #fff; border: none; border-radius: 8px; padding: 8px 14px; font-size: 12px; font-weight: 600; cursor: pointer; }

.score-total { background: var(--card); border-radius: 16px; border: 1px solid var(--border); padding: 20px; text-align: center; margin-bottom: 14px; }
.score-number { font-family: 'Georgia', serif; font-size: 60px; color: var(--primary); line-height: 1; margin-bottom: 4px; font-weight: 400; }
.score-sub { font-size: 13px; color: var(--text-2); }
.score-breakdown { background: var(--card); border-radius: 12px; border: 1px solid var(--border); padding: 14px; margin-bottom: 14px; }
.dim-row { display: flex; align-items: center; gap: 10px; padding: 9px 0; border-bottom: 1px solid var(--border); }
.dim-row:last-child { border-bottom: none; }
.dim-text { flex: 1; min-width: 0; }
.dim-name { font-size: 12px; color: var(--text-2); }
.dim-comment { font-size: 10px; color: var(--text-3); margin-top: 1px; line-height: 1.4; }
.dim-bar-wrap { width: 70px; height: 5px; background: #f0ede6; border-radius: 3px; flex-shrink: 0; }
.dim-bar { height: 100%; border-radius: 3px; background: var(--primary); }
.dim-score { font-weight: 700; color: var(--text); min-width: 24px; text-align: right; font-size: 12px; }
.dim-score span { font-size: 9px; color: var(--text-3); }
.highlight-card { border-radius: 10px; border: 1.5px solid; padding: 12px 14px; margin-bottom: 10px; }
.highlight-card.good { background: #F0FFF4; border-color: #BBF7D0; }
.highlight-card.improve { background: #FFFBEB; border-color: #FDE68A; }
.highlight-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; margin-bottom: 4px; }
.highlight-card.good .highlight-label { color: var(--success); }
.highlight-card.improve .highlight-label { color: var(--warning); }
.highlight-text { font-size: 13px; color: var(--text); line-height: 1.5; }
.coach-toggle { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 14px; margin-bottom: 14px; cursor: pointer; }
.coach-toggle-label { font-size: 12px; font-weight: 700; color: var(--text-2); display: flex; align-items: center; justify-content: space-between; }
.coach-content { font-size: 12px; color: var(--text-2); line-height: 1.7; margin-top: 10px; display: none; }
.coach-content.open { display: block; }

.score-nav { display: flex; gap: 2px; margin-left: auto; }
.score-nav-btn { background: none; border: 1px solid var(--border); border-radius: 6px; padding: 4px 8px; font-size: 12px; cursor: pointer; color: var(--text-2); }
.score-nav-btn:disabled { opacity: 0.3; cursor: default; }

.hint-overlay {
  position: absolute; inset: 0; background: rgba(0,0,0,0.45);
  z-index: 200; display: none; align-items: center; justify-content: center; padding: 24px;
}
.hint-overlay.visible { display: flex; }
.hint-card { background: #fff; border-radius: 16px; padding: 20px; max-width: 340px; width: 100%; box-shadow: 0 8px 40px rgba(0,0,0,0.18); position: relative; }
.hint-card-title { font-size: 13px; font-weight: 700; color: var(--primary); margin-bottom: 2px; }
.hint-card-sub { font-size: 11px; color: #8a8a8a; margin-bottom: 12px; }
.hint-card-body { font-size: 13px; color: var(--text); line-height: 1.7; background: #F6F8FF; border-left: 3px solid var(--primary); padding: 12px; border-radius: 0 8px 8px 0; }
.hint-card-footer { font-size: 11px; color: #aaa; text-align: center; margin-top: 12px; }
.hint-close { position: absolute; top: 12px; right: 14px; background: none; border: none; font-size: 20px; color: #aaa; cursor: pointer; line-height: 1; padding: 0; }
</style>
</head>
<body>

<div class="top-nav">
  <span class="nav-label active" onclick="show('p1-drill')">P1 加練</span>
  <span class="nav-label" onclick="show('p1-hint')">P1+提示</span>
  <span class="nav-label" onclick="show('gate-pass')">Gate ✓</span>
  <span class="nav-label" onclick="show('gate-fail')">Gate ✗</span>
  <span class="nav-label" onclick="show('p2-early')">P2 早期</span>
  <span class="nav-label" onclick="show('p2-late')">P2 收斂</span>
  <span class="nav-label" onclick="show('p2-conclude')">P2 結論</span>
  <span class="nav-label" onclick="show('p3-c1')">P3 C1評分</span>
</div>

<div class="wrapper">
<div class="shell">

<!-- ════════════════════════════════════════════
     SCREEN 1: Phase 1 — C1 (Drill mode)
════════════════════════════════════════════ -->
<div id="screen-p1-drill" class="screen active" style="position:relative">
  <div class="circles-nav">
    <button class="btn-icon"><i class="ph ph-arrow-left"></i></button>
    <div>
      <div class="circles-nav-title">C — 澄清情境</div>
      <div class="circles-nav-sub">Meta · News Feed</div>
    </div>
    <button class="circles-nav-home">回首頁</button>
  </div>
  <div class="circles-progress">
    <div class="circles-progress-seg active"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-label">C · 澄清情境 · 1/7</div>
  </div>
  <div class="scroll-body">
    <div class="problem-card">
      <div class="problem-card-label">練習題目</div>
      用戶反映 News Feed 廣告過多，如何改善廣告體驗並維持 Meta 的廣告收入？
    </div>
    <div class="circles-step-pills">
      <span class="circles-step-pill active">C 澄清情境</span>
      <span class="circles-step-pill">I 定義用戶</span>
      <span class="circles-step-pill">R 發掘需求</span>
      <span class="circles-step-pill">C 優先排序</span>
      <span class="circles-step-pill">L 提出方案</span>
      <span class="circles-step-pill">E 評估取捨</span>
      <span class="circles-step-pill">S 總結推薦</span>
    </div>

    <!-- 問題範圍 -->
    <div class="circles-field-group">
      <div class="circles-field-label-row">
        <div class="circles-field-label">問題範圍</div>
        <button class="circles-hint-trigger" onclick="showHint('問題範圍','澄清「廣告過多」的具體含義——是頻率（每 N 則出現一則廣告）、相關性（廣告與用戶興趣不符），還是格式（影片廣告干擾感更強）？三者是完全不同的問題，會導致完全不同的解法。同時確認討論範圍：只看 News Feed，還是包含 Stories 和 Reels？邊界越清楚，後面的分析越聚焦。')">💡 提示</button>
      </div>
      <button class="field-example-toggle" onclick="toggleExample(this)">
        <i class="ph ph-caret-right" style="font-size:9px"></i> 查看範例
      </button>
      <div class="field-example-body">例：聚焦 News Feed 廣告，排除 Stories / Reels / Marketplace。「廣告過多」先判定是相關性問題（廣告內容與用戶興趣不符），而非頻率或格式問題——訪談中再確認</div>
      <textarea class="circles-field-input" rows="2" placeholder="說明討論的問題範圍與廣告問題的類型…"></textarea>
    </div>

    <!-- 時間範圍 -->
    <div class="circles-field-group">
      <div class="circles-field-label-row">
        <div class="circles-field-label">時間範圍</div>
        <button class="circles-hint-trigger" onclick="showHint('時間範圍','設定一個合理的觀察期。廣告業務以季度為單位衡量，90 天足以觀察用戶行為變化和收入影響的相關性。太短（2週）看不出趨勢，太長（1年）讓面試官覺得你沒有執行感。說明為什麼這個時間範圍適合這個問題——不只是給個數字。')">💡 提示</button>
      </div>
      <button class="field-example-toggle" onclick="toggleExample(this)">
        <i class="ph ph-caret-right" style="font-size:9px"></i> 查看範例
      </button>
      <div class="field-example-body">例：設定 90 天觀察期——廣告業務以季度為單位，90 天足以看到用戶行為變化與收入影響的相關性</div>
      <textarea class="circles-field-input" rows="2" placeholder="設定時間範圍並說明理由…"></textarea>
    </div>

    <!-- 業務影響 -->
    <div class="circles-field-group">
      <div class="circles-field-label-row">
        <div class="circles-field-label">業務影響</div>
        <button class="circles-hint-trigger" onclick="showHint('業務影響','廣告業務有兩個關鍵利益相關方——用戶和廣告主。改善用戶廣告體驗可能影響廣告曝光量，進而影響廣告主 ROI 和 Meta 收入。你需要說明這個改善的核心業務約束：收入不能下降多少？廣告主的什麼承諾不能打破？說清楚這個邊界，你的分析才有業務合理性。')">💡 提示</button>
      </div>
      <button class="field-example-toggle" onclick="toggleExample(this)">
        <i class="ph ph-caret-right" style="font-size:9px"></i> 查看範例
      </button>
      <div class="field-example-body">例：核心約束是廣告收入不能下降超過 X%，廣告主 ROI 不能大幅下滑——否則廣告主撤單，業務鏈斷掉</div>
      <textarea class="circles-field-input" rows="2" placeholder="說明業務影響與核心約束…"></textarea>
    </div>

    <!-- 假設確認 -->
    <div class="circles-field-group">
      <div class="circles-field-label-row">
        <div class="circles-field-label">假設確認</div>
        <button class="circles-hint-trigger" onclick="showHint('假設確認','列出你在後續分析中會用到的、尚未被確認的假設。例如：「廣告問題是相關性而非純頻率」、「用戶的負感來自打斷心流而非廣告本身」。把假設說清楚，面試官才知道你的分析建立在什麼基礎上，也給你機會確認哪些假設需要驗證。列出 2-3 條最關鍵的就夠。')">💡 提示</button>
      </div>
      <button class="field-example-toggle" onclick="toggleExample(this)">
        <i class="ph ph-caret-right" style="font-size:9px"></i> 查看範例
      </button>
      <div class="field-example-body">例：① 廣告問題是相關性而非純頻率；② 用戶負感來自打斷心流，不是廣告本身；③ 技術上可做到動態插入頻率調控（待確認）</div>
      <textarea class="circles-field-input" rows="2" placeholder="列出你的關鍵假設，並標註哪些待確認…"></textarea>
    </div>
  </div>
  <div class="submit-bar">
    <button class="btn-secondary">返回選題</button>
    <button class="btn-primary" onclick="show('gate-pass')">提交框架 → AI 審核</button>
  </div>
  <!-- Hint overlay -->
  <div class="hint-overlay" id="hint-overlay" onclick="closeHint(event)">
    <div class="hint-card">
      <button class="hint-close" onclick="closeHint()">×</button>
      <div class="hint-card-title" id="hint-title">💡 問題範圍 — 分析思路</div>
      <div class="hint-card-sub">Meta · News Feed · C 澄清情境</div>
      <div class="hint-card-body" id="hint-body">載入中…</div>
      <div class="hint-card-footer">閱讀後關閉，自行填寫你的分析</div>
    </div>
  </div>
</div>

<!-- ════════════════════════════════════════════
     SCREEN 2: Phase 1 — hint overlay visible
════════════════════════════════════════════ -->
<div id="screen-p1-hint" class="screen" style="position:relative">
  <div class="circles-nav">
    <button class="btn-icon"><i class="ph ph-arrow-left"></i></button>
    <div>
      <div class="circles-nav-title">C — 澄清情境</div>
      <div class="circles-nav-sub">Meta · News Feed</div>
    </div>
    <button class="circles-nav-home">回首頁</button>
  </div>
  <div class="circles-progress">
    <div class="circles-progress-seg active"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-label">C · 澄清情境 · 1/7</div>
  </div>
  <div class="scroll-body" style="filter:blur(1px);pointer-events:none">
    <div class="problem-card">用戶反映 News Feed 廣告過多，如何改善廣告體驗並維持 Meta 的廣告收入？</div>
    <div class="circles-step-pills">
      <span class="circles-step-pill active">C 澄清情境</span>
      <span class="circles-step-pill">I 定義用戶</span>
      <span class="circles-step-pill">R 發掘需求</span>
      <span class="circles-step-pill">C 優先排序</span>
      <span class="circles-step-pill">L 提出方案</span>
      <span class="circles-step-pill">E 評估取捨</span>
      <span class="circles-step-pill">S 總結推薦</span>
    </div>
    <div class="circles-field-group">
      <div class="circles-field-label-row"><div class="circles-field-label">問題範圍</div></div>
      <textarea class="circles-field-input filled" rows="2">聚焦 News Feed 廣告體驗，排除 Stories/Reels；釐清「廣告過多」主要是相關性問題</textarea>
    </div>
    <div class="circles-field-group">
      <div class="circles-field-label-row"><div class="circles-field-label">時間範圍</div></div>
      <textarea class="circles-field-input" rows="2" placeholder="填寫你的分析..."></textarea>
    </div>
  </div>
  <!-- Hint overlay — visible (時間範圍) -->
  <div class="hint-overlay visible">
    <div class="hint-card">
      <button class="hint-close" onclick="show('p1-drill')">×</button>
      <div class="hint-card-title">💡 時間範圍 — 分析思路</div>
      <div class="hint-card-sub">Meta · News Feed · C 澄清情境</div>
      <div class="hint-card-body">設定一個合理的觀察期。廣告業務以季度為單位衡量，90 天足以觀察用戶行為變化和收入影響的相關性。太短（2週）看不出趨勢，太長（1年）讓面試官覺得你沒有執行感。說明為什麼這個時間範圍適合這個問題——不只是給個數字。</div>
      <div class="hint-card-footer">閱讀後關閉，自行填寫你的分析</div>
    </div>
  </div>
</div>

<!-- ════════════════════════════════════════════
     SCREEN 3: Gate — Pass
════════════════════════════════════════════ -->
<div id="screen-gate-pass" class="screen" style="position:relative">
  <div class="circles-nav">
    <button class="btn-icon" onclick="show('p1-drill')"><i class="ph ph-arrow-left"></i></button>
    <div>
      <div class="circles-nav-title">框架審核結果</div>
      <div class="circles-nav-sub">C · 澄清情境 · Meta</div>
    </div>
    <button class="circles-nav-home">回首頁</button>
  </div>
  <div class="circles-progress">
    <div class="circles-progress-seg done"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-label">C · 澄清情境</div>
  </div>
  <div class="scroll-body">
    <div class="gate-pass-bar">
      <div class="gate-pass-text">框架審核通過</div>
      <div class="gate-pass-sub">框架方向正確，進入對話練習階段繼續探索。</div>
    </div>
    <div class="gate-card ok">
      <div class="gate-card-icon" style="color:#137A3D"><i class="ph ph-check-circle"></i></div>
      <div>
        <div class="gate-card-field">問題範圍</div>
        <div class="gate-card-title">釐清廣告問題類型，聚焦相關性</div>
        <div class="gate-card-reason">區分了頻率/相關性/格式三種問題類型，鎖定相關性為核心，範圍邊界清晰</div>
      </div>
    </div>
    <div class="gate-card ok">
      <div class="gate-card-icon" style="color:#137A3D"><i class="ph ph-check-circle"></i></div>
      <div>
        <div class="gate-card-field">時間範圍</div>
        <div class="gate-card-title">90 天符合廣告業務季度週期</div>
        <div class="gate-card-reason">設定 90 天並說明理由——廣告業務以季度衡量，時間框架與業務節奏一致</div>
      </div>
    </div>
    <div class="gate-card warn">
      <div class="gate-card-icon" style="color:#B85C00"><i class="ph ph-warning"></i></div>
      <div>
        <div class="gate-card-field">業務影響</div>
        <div class="gate-card-title">提到收入約束，但未量化容忍閾值</div>
        <div class="gate-card-reason">說了廣告收入不能下降，但「不能下降」沒有給出具體的百分比閾值</div>
        <div class="gate-card-suggestion">建議補充：「廣告收入不降超過 X%」這個具體約束條件</div>
      </div>
    </div>
    <div class="gate-card warn">
      <div class="gate-card-icon" style="color:#B85C00"><i class="ph ph-warning"></i></div>
      <div>
        <div class="gate-card-field">假設確認</div>
        <div class="gate-card-title">假設清單不完整，缺競品對比假設</div>
        <div class="gate-card-reason">列出了技術和用戶行為假設，但沒有說明競品對比是否納入考量</div>
        <div class="gate-card-suggestion">補充：說明競品廣告體驗是否作為對標假設</div>
      </div>
    </div>
  </div>
  <div class="submit-bar">
    <button class="btn-ghost-sm" onclick="show('p1-drill')">重新編輯</button>
    <button class="btn-primary" onclick="show('p2-early')">進入對話練習 →</button>
  </div>
</div>

<!-- ════════════════════════════════════════════
     SCREEN 4: Gate — Fail (drill mode)
════════════════════════════════════════════ -->
<div id="screen-gate-fail" class="screen" style="position:relative">
  <div class="circles-nav">
    <button class="btn-icon" onclick="show('p1-drill')"><i class="ph ph-arrow-left"></i></button>
    <div>
      <div class="circles-nav-title">框架審核結果</div>
      <div class="circles-nav-sub">C · 澄清情境 · Meta</div>
    </div>
    <button class="circles-nav-home">回首頁</button>
  </div>
  <div class="circles-progress">
    <div class="circles-progress-seg done"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-label">C · 澄清情境</div>
  </div>
  <div class="scroll-body">
    <div class="gate-fail-bar">框架有方向性錯誤，請修正後再提交（步驟加練模式）</div>
    <div class="gate-card error">
      <div class="gate-card-icon" style="color:#D92020"><i class="ph ph-x-circle"></i></div>
      <div>
        <div class="gate-card-field">問題範圍</div>
        <div class="gate-card-title">未釐清廣告問題類型</div>
        <div class="gate-card-reason">「廣告過多」有頻率、相關性、格式三種完全不同的問題類型，未區分就直接分析，後續解法方向會跑偏</div>
        <div class="gate-card-suggestion">改為：先釐清主要問題是頻率、相關性還是格式，再定義範圍</div>
      </div>
    </div>
    <div class="gate-card ok">
      <div class="gate-card-icon" style="color:#137A3D"><i class="ph ph-check-circle"></i></div>
      <div>
        <div class="gate-card-field">時間範圍</div>
        <div class="gate-card-title">時間範圍合理</div>
        <div class="gate-card-reason">設定 90 天並說明了廣告業務季度週期的原因，方向正確</div>
      </div>
    </div>
    <div class="gate-card error">
      <div class="gate-card-icon" style="color:#D92020"><i class="ph ph-x-circle"></i></div>
      <div>
        <div class="gate-card-field">業務影響</div>
        <div class="gate-card-title">缺乏業務約束說明</div>
        <div class="gate-card-reason">沒有說明廣告收入的保護目標，後續的取捨分析將失去業務依據</div>
        <div class="gate-card-suggestion">補充：「廣告收入不降超過 X%」和廣告主合約承諾是核心約束</div>
      </div>
    </div>
    <div class="gate-card warn">
      <div class="gate-card-icon" style="color:#B85C00"><i class="ph ph-warning"></i></div>
      <div>
        <div class="gate-card-field">假設確認</div>
        <div class="gate-card-title">假設過於籠統</div>
        <div class="gate-card-reason">「用戶想要更好的體驗」不是假設——假設要說明哪些前提條件尚未確認</div>
        <div class="gate-card-suggestion">改為：列出具體假設，例如廣告類型、用戶行為或技術可行性的前提</div>
      </div>
    </div>
  </div>
  <div class="submit-bar">
    <button class="btn-primary" onclick="show('p1-drill')">修正框架後重試</button>
  </div>
</div>

<!-- ════════════════════════════════════════════
     SCREEN 5: Phase 2 — Early turns (< 3)
════════════════════════════════════════════ -->
<div id="screen-p2-early" class="screen chat-wrap">
  <div class="circles-nav">
    <button class="btn-icon" onclick="show('gate-pass')"><i class="ph ph-arrow-left"></i></button>
    <div>
      <div class="circles-nav-title">C — 對話練習</div>
      <div class="circles-nav-sub">Meta · News Feed</div>
    </div>
    <button class="circles-nav-home">回首頁</button>
  </div>
  <div class="circles-progress">
    <div class="circles-progress-seg active"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-label">C · 澄清情境 · 1/7</div>
  </div>
  <div class="chat-pinned">
    <div class="pinned-co">Meta — 澄清情境</div>
    <div class="pinned-stmt">用戶反映 News Feed 廣告過多，如何改善廣告體驗…</div>
  </div>
  <div class="chat-body">
    <div class="chat-icebreaker">
      <div class="chat-icebreaker-label"><i class="ph ph-compass"></i> 開始提問方向</div>
      <div class="chat-icebreaker-text">問被訪談者這個問題的核心是什麼——「廣告過多」是指頻率、相關性，還是格式？同時確認業務上有哪些不能突破的限制。</div>
    </div>
    <div class="bubble-user">你們說「廣告過多」，這個「多」是什麼意思——是廣告出現的頻率太高、廣告和我沒關係，還是廣告的格式干擾感太強？</div>
    <div class="bubble-ai">
      <div class="bubble-section">被訪談者</div>
      老實說，三種都有，但我最常聽到的投訴集中在相關性——用戶覺得看到的廣告和自己完全沒關係。頻率的問題也有，但大家好像更能接受看廣告這件事，只要廣告是他們在意的東西。
    </div>
    <div class="bubble-coaching" style="font-size:12px">
      <div class="bubble-section">教練點評</div>
      很好，你做了最關鍵的一步：把「廣告過多」拆解成三種類型，並確認主要問題是相關性。這個釐清決定了後續所有分析的方向。
      <button class="hint-toggle" onclick="toggleHint(this)"><i class="ph ph-caret-right" style="font-size:10px"></i> 查看教練提示</button>
      <div class="hint-body">問：「這次的改善，你們打算在多長時間內完成並看到效果？有沒有時間上的限制？」</div>
    </div>
    <div class="bubble-user">這次改善你們打算在多長時間內完成並看到效果？有沒有時間上的限制？</div>
    <div class="bubble-ai">
      <div class="bubble-section">被訪談者</div>
      一個季度——90 天左右。廣告這塊比較敏感，我們不太可能做一個長達半年的大工程。季度初啟動、季度末看數字，這是我們的節奏。
    </div>
    <div class="bubble-coaching" style="font-size:12px">
      <div class="bubble-section">教練點評</div>
      90 天的時間框架很合理，符合廣告業務的季度週期。這讓你後面評估方案時知道必須選可以在一季度內驗證效果的解法。
      <button class="hint-toggle" onclick="toggleHint(this)"><i class="ph ph-caret-right" style="font-size:10px"></i> 查看教練提示</button>
      <div class="hint-body">問：「廣告收入這塊，有沒有什麼不能突破的業務紅線？」</div>
    </div>
    <div style="height:8px"></div>
    <div style="text-align:center;font-size:11px;color:var(--text-3);padding:4px 0">再對話 1 輪，可提交步驟</div>
  </div>
  <div class="chat-input-bar">
    <textarea class="chat-input" rows="1" placeholder="問被訪談者一個問題…"></textarea>
    <button class="chat-send-btn"><i class="ph ph-paper-plane-tilt"></i></button>
  </div>
</div>

<!-- ════════════════════════════════════════════
     SCREEN 6: Phase 2 — ≥3 turns, submit row
════════════════════════════════════════════ -->
<div id="screen-p2-late" class="screen chat-wrap">
  <div class="circles-nav">
    <button class="btn-icon" onclick="show('p2-early')"><i class="ph ph-arrow-left"></i></button>
    <div>
      <div class="circles-nav-title">C — 對話練習</div>
      <div class="circles-nav-sub">Meta · News Feed</div>
    </div>
    <button class="circles-nav-home">回首頁</button>
  </div>
  <div class="circles-progress">
    <div class="circles-progress-seg active"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-label">C · 澄清情境 · 1/7 · 4 輪</div>
  </div>
  <div class="chat-pinned">
    <div class="pinned-co">Meta — 澄清情境</div>
    <div class="pinned-stmt">用戶反映 News Feed 廣告過多，如何改善廣告體驗…</div>
  </div>
  <div class="chat-body">
    <div class="chat-icebreaker">
      <div class="chat-icebreaker-label"><i class="ph ph-compass"></i> 開始提問方向</div>
      <div class="chat-icebreaker-text">問被訪談者這個問題的核心是什麼——「廣告過多」是指頻率、相關性，還是格式？同時確認業務上有哪些不能突破的限制。</div>
    </div>
    <div class="bubble-user">廣告收入這塊，你們在這次改善裡有沒有什麼不能突破的業務紅線？</div>
    <div class="bubble-ai">
      <div class="bubble-section">被訪談者</div>
      這是最敏感的部分。我們的季度 guidance 已經出去了，投資人那邊有預期。如果廣告收入降超過一定比例，這個項目肯定會被叫停。另外廣告主那邊也有合約承諾，曝光量不能大幅縮減。
    </div>
    <div class="bubble-coaching" style="font-size:12px">
      <div class="bubble-section">教練點評</div>
      你問出了兩層業務約束——收入保護和廣告主承諾。這是整個 C1 步驟最重要的輸出：知道了「硬性約束是什麼」，你的所有後續分析才有業務邊界。
      <button class="hint-toggle" onclick="toggleHint(this)"><i class="ph ph-caret-right" style="font-size:10px"></i> 查看教練提示</button>
      <div class="hint-body">最後主動確認你的假設：「我假設主要問題是相關性而非純頻率，這個方向對嗎？」</div>
    </div>
    <div class="bubble-user">我做了幾個假設，確認一下：主要問題是相關性而非純頻率；用戶的負感來自心流被打斷；技術上可以做到動態調控。這三個方向對嗎？</div>
    <div class="bubble-ai">
      <div class="bubble-section">被訪談者</div>
      前兩個是對的，我們自己的數據也支持。第三個我不確定，工程團隊評估過，但還沒有明確結論——你可以先把它列為待確認假設。
    </div>
    <div class="bubble-coaching" style="font-size:12px">
      <div class="bubble-section">教練點評</div>
      到這裡，C1 的四個核心維度——問題邊界、時間範圍、業務約束、假設確認——都已完整確認。你主動提出假設讓對方確認，是很好的澄清技巧。
      <button class="hint-toggle" onclick="toggleHint(this)"><i class="ph ph-caret-right" style="font-size:10px"></i> 查看教練提示</button>
      <div class="hint-body">整理結論：問題是相關性（非頻率）、90 天、收入有硬性約束、三個假設（第三個待確認）。</div>
    </div>
    <div style="height:4px"></div>
  </div>
  <div class="chat-input-bar">
    <textarea class="chat-input" rows="1" placeholder="繼續探索，或點下方提交…"></textarea>
    <button class="chat-send-btn"><i class="ph ph-paper-plane-tilt"></i></button>
  </div>
  <div class="chat-submit-row">
    <button class="chat-submit-btn" onclick="show('p2-conclude')">對話足夠了，提交這個步驟</button>
  </div>
</div>

<!-- ════════════════════════════════════════════
     SCREEN 7: Phase 2 — Conclusion box (expanded)
════════════════════════════════════════════ -->
<div id="screen-p2-conclude" class="screen chat-wrap">
  <div class="circles-nav">
    <button class="btn-icon" onclick="show('p2-late')"><i class="ph ph-arrow-left"></i></button>
    <div>
      <div class="circles-nav-title">C — 對話練習</div>
      <div class="circles-nav-sub">Meta · News Feed</div>
    </div>
    <button class="circles-nav-home">回首頁</button>
  </div>
  <div class="circles-progress">
    <div class="circles-progress-seg active"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-label">C · 澄清情境 · 1/7 · 4 輪</div>
  </div>
  <div class="chat-pinned">
    <div class="pinned-co">Meta — 澄清情境</div>
    <div class="pinned-stmt">用戶反映 News Feed 廣告過多，如何改善廣告體驗…</div>
  </div>
  <div class="chat-body" style="opacity:0.45;pointer-events:none">
    <div class="bubble-user">「廣告過多」是頻率、相關性還是格式問題？</div>
    <div class="bubble-ai"><div class="bubble-section">被訪談者</div>主要是相關性——廣告和用戶興趣不符，頻率問題是次要的。</div>
    <div class="bubble-user">這次改善的時間範圍是多長？</div>
    <div class="bubble-ai"><div class="bubble-section">被訪談者</div>一個季度，90 天——廣告業務按季度衡量，這是我們的節奏。</div>
    <div class="bubble-user">廣告收入有哪些不能突破的業務紅線？</div>
    <div class="bubble-ai"><div class="bubble-section">被訪談者</div>廣告收入不能降太多，廣告主合約承諾的曝光量也不能大幅縮減。</div>
    <div class="bubble-user">主要假設是相關性問題、心流打斷、技術可做到動態調控——這三個方向對嗎？</div>
    <div class="bubble-ai"><div class="bubble-section">被訪談者</div>前兩個確認，第三個技術可行性目前尚未確認，列為待確認假設。</div>
    <div style="text-align:center;padding:6px 0">
      <span style="font-size:11px;color:var(--text-3);background:#f0ede6;border-radius:20px;padding:3px 12px">4 輪對話完成</span>
    </div>
  </div>
  <div class="conclusion-box">
    <div class="conclusion-title">整理你這個步驟確認了什麼</div>
    <div class="conclusion-sub">說明問題範圍、時間框架、業務約束，以及你確認或待確認的假設</div>
    <div style="border:1px solid var(--border);border-radius:8px;margin-bottom:8px;overflow:hidden">
      <div style="background:#f5f4f0;padding:5px 10px;display:flex;justify-content:space-between;cursor:pointer;align-items:center" onclick="var c=this.nextElementSibling;c.style.display=c.style.display==='none'?'block':'none';this.querySelector('span').textContent=c.style.display==='none'?'展開 ▾':'收起 ▴'">
        <span style="font-size:9px;font-weight:700;color:var(--text-3);text-transform:uppercase;letter-spacing:.4px">範例（不同題目）</span>
        <span style="font-size:10px;color:var(--text-3)">展開 ▾</span>
      </div>
      <div style="display:none;padding:8px 10px;font-size:11px;color:var(--text-2);line-height:1.6">
        Spotify 問題範圍：聚焦免費版廣告體驗，排除付費方案和播客廣告。時間範圍：60 天。業務約束：廣告收入和免費→付費轉換率都不能下降。假設：用戶廣告負感主要來自廣告在情感高潮段落出現，而非廣告本身。
      </div>
    </div>
    <textarea class="conclusion-textarea" id="conclude-text" rows="3" oninput="onConclude()" placeholder="針對這題，整理你澄清的問題範圍、時間框架、業務約束，以及假設確認…" style="height:72px">問題範圍：聚焦 News Feed 廣告相關性問題（非頻率），排除 Stories/Reels。時間範圍：90 天（廣告季度週期）。業務約束：廣告收入不能大幅下降，廣告主合約承諾不能違反。假設：① 相關性是核心問題；② 負感來自心流打斷；③ 動態調控技術可行（待確認）。</textarea>
    <div class="conclusion-hint pass" id="conclude-hint">✓ 結論涵蓋問題範圍、時間框架、業務約束與假設確認，可以提交</div>
    <div class="conclusion-actions">
      <button class="conclusion-back-btn" onclick="show('p2-late')">← 繼續對話</button>
      <button class="conclusion-submit-btn" onclick="show('p3-c1')">確認提交</button>
    </div>
  </div>
</div>

<!-- ════════════════════════════════════════════
     SCREEN 8: Phase 3 — Step Score (C1)
════════════════════════════════════════════ -->
<div id="screen-p3-c1" class="screen" style="position:relative">
  <div class="circles-nav">
    <button class="btn-icon" onclick="show('p2-conclude')"><i class="ph ph-arrow-left"></i></button>
    <div>
      <div class="circles-nav-title">步驟評分 — 澄清情境</div>
      <div class="circles-nav-sub">Meta · News Feed</div>
    </div>
    <div class="score-nav">
      <button class="score-nav-btn" disabled><i class="ph ph-caret-left"></i></button>
      <button class="score-nav-btn" disabled><i class="ph ph-caret-right"></i></button>
    </div>
  </div>
  <div class="circles-progress">
    <div class="circles-progress-seg done"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-label">C · 評分 · 1/7</div>
  </div>
  <div class="scroll-body">
    <div class="score-total">
      <div class="score-number">72</div>
      <div class="score-sub">C — 澄清情境 步驟得分</div>
    </div>
    <div class="score-breakdown">
      <div class="dim-row">
        <div class="dim-text">
          <div class="dim-name">問題邊界清晰度</div>
          <div class="dim-comment">確認了廣告頻率問題，但未區分相關性與格式</div>
        </div>
        <div class="dim-bar-wrap"><div class="dim-bar" style="width:70%"></div></div>
        <div class="dim-score">3.5<span>/5</span></div>
      </div>
      <div class="dim-row">
        <div class="dim-text">
          <div class="dim-name">業務影響連結</div>
          <div class="dim-comment">提到廣告收入保護，但未量化約束條件</div>
        </div>
        <div class="dim-bar-wrap"><div class="dim-bar" style="width:60%"></div></div>
        <div class="dim-score">3<span>/5</span></div>
      </div>
      <div class="dim-row">
        <div class="dim-text">
          <div class="dim-name">時間範圍合理性</div>
          <div class="dim-comment">設定 90 天合理，符合廣告收入指標週期</div>
        </div>
        <div class="dim-bar-wrap"><div class="dim-bar" style="width:80%"></div></div>
        <div class="dim-score">4<span>/5</span></div>
      </div>
      <div class="dim-row">
        <div class="dim-text">
          <div class="dim-name">假設排除完整性</div>
          <div class="dim-comment">排除了技術限制，但未說明競品對比的假設</div>
        </div>
        <div class="dim-bar-wrap"><div class="dim-bar" style="width:50%"></div></div>
        <div class="dim-score">2.5<span>/5</span></div>
      </div>
    </div>
    <div class="highlight-card good">
      <div class="highlight-label">✦ 最強表現</div>
      <div class="highlight-text">清楚說明「廣告收入保護」是這題的硬性約束，讓整個分析有正確的業務邊界</div>
    </div>
    <div class="highlight-card improve">
      <div class="highlight-label">↑ 最需改進</div>
      <div class="highlight-text">假設確認太少——沒有問「廣告問題是頻率、相關性、還是格式？」這個區分會完全改變後續解法方向</div>
    </div>
    <div class="coach-toggle" onclick="this.querySelector('.coach-content').classList.toggle('open');this.querySelector('i').className=this.querySelector('.coach-content').classList.contains('open')?'ph ph-caret-up':'ph ph-caret-down'">
      <div class="coach-toggle-label">教練示範答案 <i class="ph ph-caret-down"></i></div>
      <div class="coach-content">
        <div style="margin-bottom:6px"><strong style="color:var(--text)">問題範圍：</strong>聚焦 News Feed 廣告體驗，排除 Stories、Reels、Marketplace。需釐清「廣告過多」是頻率（每 N 則一則廣告）、相關性（廣告與用戶興趣不符），還是格式（影片/靜態圖干擾感不同）——三者是完全不同的問題。</div>
        <div style="margin-bottom:6px"><strong style="color:var(--text)">時間範圍：</strong>設定 90 天觀察期。廣告業務以季度為單位衡量，90 天足以看到用戶行為變化與收入影響的相關性。</div>
        <div style="margin-bottom:6px"><strong style="color:var(--text)">業務影響：</strong>核心約束是廣告收入不能下降超過 X%（需確認 Meta 的容忍閾值）。廣告主 ROI 不能大幅下滑——否則廣告主撤單，業務鏈斷掉。</div>
        <div><strong style="color:var(--text)">假設確認：</strong>① 廣告問題是相關性而非純頻率（假設）；② 用戶對廣告的負感來自打斷心流，不是廣告本身（假設）；③ 技術上可以做到動態插入頻率調控（待確認）。</div>
      </div>
    </div>
  </div>
  <div class="submit-bar">
    <button class="btn-secondary">回首頁</button>
    <button class="btn-primary">繼續下一步：I 定義用戶 →</button>
  </div>
</div>

</div><!-- shell -->
</div><!-- wrapper -->

<script>
function show(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-' + id).classList.add('active');
  document.querySelectorAll('.nav-label').forEach(b => b.classList.remove('active'));
  var map = {'p1-drill':0,'p1-hint':1,'gate-pass':2,'gate-fail':3,'p2-early':4,'p2-late':5,'p2-conclude':6,'p3-c1':7};
  if (map[id] !== undefined) document.querySelectorAll('.nav-label')[map[id]].classList.add('active');
}
function showHint(field, body) {
  document.getElementById('hint-title').textContent = '💡 ' + field + ' — 分析思路';
  document.getElementById('hint-body').textContent = body;
  document.getElementById('hint-overlay').classList.add('visible');
}
function closeHint(e) {
  if (!e || e.target === document.getElementById('hint-overlay')) {
    document.getElementById('hint-overlay').classList.remove('visible');
  }
}
function toggleHint(btn) {
  var body = btn.nextElementSibling;
  var shown = body.style.display === 'block';
  body.style.display = shown ? 'none' : 'block';
  btn.querySelector('i').className = shown ? 'ph ph-caret-right' : 'ph ph-caret-down';
  btn.style.color = shown ? 'var(--text-3)' : 'var(--primary)';
}
function toggleExample(btn) {
  var body = btn.nextElementSibling;
  var shown = body.classList.contains('open');
  body.classList.toggle('open', !shown);
  btn.innerHTML = shown
    ? '<i class="ph ph-caret-right" style="font-size:9px"></i> 查看範例'
    : '<i class="ph ph-caret-down" style="font-size:9px"></i> 收起範例';
}
function onConclude() {
  var v = document.getElementById('conclude-text').value.trim();
  var h = document.getElementById('conclude-hint');
  if (v.length > 30) { h.className='conclusion-hint pass'; h.textContent='✓ 結論涵蓋問題範圍、時間框架、業務約束與假設確認，可以提交'; }
  else { h.className='conclusion-hint warn'; h.textContent='請說明問題範圍、時間框架、業務約束與假設確認'; }
}
</script>
</body>
</html>

```

---

## Mockup HTML — I 定義用戶完整互動稿

**Mockup 來源路徑：** `.superpowers/brainstorm/99819-1777221639/content/circles-I-step-mockup.html`（直接用瀏覽器開啟即可預覽）。**此 HTML 是實作的視覺真相來源（canonical visual truth）——若 spec 文字與此畫面有出入，以此 HTML 為準。**

```html
<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
<title>CIRCLES — I 定義用戶 Mockup</title>
<link rel="stylesheet" href="https://unpkg.com/@phosphor-icons/web@2.1.1/src/regular/style.css">
<style>
* { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
body { font-family: 'DM Sans', -apple-system, sans-serif; background: #F2F0EB; display: flex; justify-content: center; }

:root {
  --bg: #F2F0EB;
  --card: #ffffff;
  --border: #e8e5de;
  --primary: #1A56DB;
  --primary-lt: #EEF3FF;
  --text: #1a1a1a;
  --text-2: #5a5a5a;
  --text-3: #8a8a8a;
  --success: #137A3D;
  --warning: #B85C00;
  --danger: #D92020;
}

/* ── Nav ── */
.nav-label {
  font-size: 11px; font-weight: 700; background: #1a1a1a; color: #fff;
  padding: 6px 14px; border-radius: 20px; cursor: pointer;
  font-family: sans-serif; white-space: nowrap;
}
.nav-label:hover { background: #333; }
.nav-label.active { background: var(--primary); }

/* ── Shell ── */
.shell {
  width: 390px; min-height: 100vh; background: var(--bg);
  position: relative; overflow: hidden;
}
.screen { display: none; flex-direction: column; height: 100vh; }
.screen.active { display: flex; }

/* ── Navbar ── */
.navbar {
  height: 52px; background: var(--card); border-bottom: 1px solid var(--border);
  display: flex; align-items: center; padding: 0 16px; gap: 8px;
  flex-shrink: 0;
}
.navbar-logo { font-size: 15px; font-weight: 700; flex: 1; font-family: 'DM Sans', sans-serif; }
.btn-icon { background: none; border: none; font-size: 18px; color: var(--text-2); cursor: pointer; padding: 6px; line-height: 1; }
.btn-ghost { background: none; border: none; font-size: 13px; font-weight: 500; color: var(--text-2); cursor: pointer; padding: 4px 8px; font-family: 'DM Sans', sans-serif; }

/* ── circles-nav ── */
.circles-nav {
  height: 52px; background: var(--card); border-bottom: 1px solid var(--border);
  display: flex; align-items: center; padding: 0 14px; gap: 10px;
  flex-shrink: 0;
}
.circles-nav-title { font-size: 14px; font-weight: 700; color: var(--text); font-family: 'DM Sans', sans-serif; }
.circles-nav-sub { font-size: 11px; color: var(--text-3); font-family: 'DM Sans', sans-serif; }
.circles-nav-home { font-size: 12px; color: var(--primary); border-bottom: 1px solid var(--primary); background: none; border-top: none; border-left: none; border-right: none; padding: 2px 0; cursor: pointer; font-family: 'DM Sans', sans-serif; white-space: nowrap; flex-shrink: 0; margin-left: auto; }

/* ── progress ── */
.circles-progress {
  height: 36px; background: var(--card); border-bottom: 1px solid var(--border);
  display: flex; align-items: center; padding: 0 14px; gap: 3px;
  flex-shrink: 0;
}
.circles-progress-seg { flex: 1; height: 4px; background: #e8e5de; border-radius: 2px; }
.circles-progress-seg.done { background: var(--primary); }
.circles-progress-seg.active { background: rgba(26,86,219,0.4); }
.circles-progress-label { font-size: 10px; color: var(--text-3); white-space: nowrap; font-family: 'DM Sans', sans-serif; margin-left: 8px; }

/* ── scrollable body ── */
.scroll-body { flex: 1; overflow-y: auto; padding: 16px; padding-bottom: 100px; scrollbar-width: none; }
.scroll-body::-webkit-scrollbar { display: none; }

/* ── submit bar ── */
.submit-bar {
  position: absolute; bottom: 0; left: 0; right: 0;
  background: var(--card); border-top: 1px solid var(--border);
  padding: 12px 16px; display: flex; gap: 10px;
  flex-shrink: 0;
}
.btn-primary { flex: 1; background: var(--primary); color: #fff; border: none; border-radius: 10px; padding: 12px 16px; font-size: 14px; font-weight: 600; cursor: pointer; font-family: 'DM Sans', sans-serif; }
.btn-secondary { background: #f0ede6; color: var(--text); border: none; border-radius: 10px; padding: 12px 16px; font-size: 14px; font-weight: 600; cursor: pointer; font-family: 'DM Sans', sans-serif; white-space: nowrap; }
.btn-ghost-sm { background: none; color: var(--text-2); border: 1px solid var(--border); border-radius: 10px; padding: 12px 16px; font-size: 14px; font-weight: 600; cursor: pointer; font-family: 'DM Sans', sans-serif; white-space: nowrap; }

/* ── problem card ── */
.problem-card {
  background: var(--card); border-radius: 10px; border: 1px solid var(--border);
  padding: 12px 14px; font-size: 13px; color: var(--text-2); line-height: 1.6;
  margin-bottom: 14px; font-family: 'DM Sans', sans-serif;
}
.problem-card-label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: .07em; color: var(--text-3); margin-bottom: 4px; }

/* ── step pills ── */
.circles-step-pills { display: flex; gap: 6px; overflow-x: auto; margin-bottom: 4px; scrollbar-width: none; }
.circles-step-pills::-webkit-scrollbar { display: none; }
.circles-step-pill { flex-shrink: 0; padding: 5px 12px; border-radius: 20px; border: 1px solid var(--border); background: var(--card); font-size: 11px; font-weight: 600; color: var(--text-3); cursor: pointer; font-family: 'DM Sans', sans-serif; white-space: nowrap; }
.circles-step-pill.active { background: var(--primary); color: #fff; border-color: var(--primary); }

/* ── field group ── */
.circles-field-group { margin-bottom: 16px; }
.circles-field-label-row { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 4px; }
.circles-field-label { font-size: 10px; color: var(--text-3); text-transform: uppercase; letter-spacing: .07em; font-family: 'DM Sans', sans-serif; font-weight: 700; }
.circles-hint-trigger { background: none; border: none; font-size: 11px; color: var(--primary); cursor: pointer; padding: 0; font-family: 'DM Sans', sans-serif; white-space: nowrap; }
.circles-field-hint { font-size: 11px; color: var(--text-3); margin-bottom: 6px; line-height: 1.5; font-family: 'DM Sans', sans-serif; }
.circles-field-input { width: 100%; padding: 11px 13px; border-radius: 10px; border: 1.5px solid var(--border); background: var(--card); font-size: 13px; font-family: 'DM Sans', sans-serif; color: var(--text); resize: none; outline: none; line-height: 1.5; }
.circles-field-input:focus { border-color: var(--primary); }
.circles-field-input.filled { border-color: rgba(26,86,219,0.3); background: #fbfaff; }

/* ── Gate cards ── */
.gate-card { background: var(--card); border-radius: 10px; border: 1.5px solid var(--border); padding: 12px 14px; margin-bottom: 10px; display: flex; gap: 10px; align-items: flex-start; }
.gate-card.ok { border-color: #b8dbbf; }
.gate-card.warn { border-color: #FFD54F; }
.gate-card.error { border-color: #f5c6c6; }
.gate-card-icon { font-size: 15px; flex-shrink: 0; margin-top: 1px; }
.gate-card-field { font-size: 9px; text-transform: uppercase; letter-spacing: .05em; color: var(--text-3); font-family: 'DM Sans', sans-serif; margin-bottom: 2px; }
.gate-card-status-label { font-size: 10px; font-weight: 700; margin-bottom: 4px; font-family: 'DM Sans', sans-serif; }
.gate-card-title { font-size: 13px; font-weight: 700; color: var(--text); margin-bottom: 3px; font-family: 'DM Sans', sans-serif; }
.gate-card-reason { font-size: 12px; color: var(--text-2); line-height: 1.5; font-family: 'DM Sans', sans-serif; }
.gate-card-suggestion { font-size: 11px; color: var(--warning); margin-top: 4px; font-family: 'DM Sans', sans-serif; }
.gate-pass-bar { background: var(--primary-lt); border: 1px solid #C5D5FF; border-radius: 10px; padding: 12px 14px; margin-bottom: 16px; display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.gate-pass-text { font-size: 12px; font-weight: 600; color: var(--primary); font-family: 'DM Sans', sans-serif; }
.gate-pass-sub { font-size: 11px; color: #5a7ab5; font-family: 'DM Sans', sans-serif; }
.gate-fail-bar { background: #FFF3F3; border: 1px solid #FFCDD2; border-radius: 10px; padding: 12px 14px; margin-bottom: 16px; font-size: 12px; color: var(--danger); font-family: 'DM Sans', sans-serif; }

/* ── Phase 2 chat ── */
.chat-wrap { display: flex; flex-direction: column; height: 100vh; overflow: hidden; }
.chat-pinned { background: var(--card); border-bottom: 1px solid var(--border); padding: 8px 14px; flex-shrink: 0; }
.pinned-co { font-size: 10px; color: var(--primary); font-weight: 600; text-transform: uppercase; letter-spacing: .05em; font-family: 'DM Sans', sans-serif; margin-bottom: 1px; }
.pinned-stmt { font-size: 11px; color: var(--text); font-weight: 600; line-height: 1.4; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-family: 'DM Sans', sans-serif; }
.chat-body { flex: 1; overflow-y: auto; padding: 14px 16px; scrollbar-width: none; }
.chat-body::-webkit-scrollbar { display: none; }
.bubble-user {
  background: var(--card); border: 1px solid var(--border);
  border-radius: 12px 4px 12px 12px; padding: 10px 13px;
  font-size: 13px; line-height: 1.6; color: var(--text);
  margin-bottom: 10px; max-width: 88%; margin-left: auto;
  font-family: 'DM Sans', sans-serif;
}
.bubble-ai {
  background: var(--primary-lt); border: 1px solid rgba(26,86,219,0.18);
  border-radius: 4px 12px 12px 12px; padding: 10px 13px;
  font-size: 13px; line-height: 1.6; color: var(--text);
  margin-bottom: 10px; max-width: 88%;
  font-family: 'DM Sans', sans-serif;
}
.bubble-section { font-size: 10px; font-weight: 700; color: var(--text-3); text-transform: uppercase; letter-spacing: .07em; margin-bottom: 3px; font-family: 'DM Sans', sans-serif; }
.bubble-coaching { background: rgba(0,0,0,0.03); border: 1px solid var(--border); border-radius: 4px 12px 12px 12px; padding: 10px 13px; font-size: 12px; line-height: 1.6; color: var(--text); margin-bottom: 10px; max-width: 88%; font-family: 'DM Sans', sans-serif; }
.hint-toggle { background: none; border: none; font-size: 11px; color: var(--text-3); cursor: pointer; padding: 0; font-family: 'DM Sans', sans-serif; display: flex; align-items: center; gap: 3px; margin-top: 6px; }
.hint-body { display: none; margin-top: 4px; padding: 6px 8px; background: rgba(0,0,0,0.04); border-radius: 6px; color: var(--text-2); font-size: 11px; line-height: 1.5; }
.chat-input-bar { background: var(--card); border-top: 1px solid var(--border); padding: 10px 14px; display: flex; gap: 8px; align-items: flex-end; flex-shrink: 0; }
.chat-icebreaker { background: rgba(26,86,219,0.05); border: 1px solid rgba(26,86,219,0.18); border-radius: 10px; padding: 10px 13px; margin-bottom: 14px; }
.chat-icebreaker-label { font-size: 9px; font-weight: 700; color: var(--primary); text-transform: uppercase; letter-spacing: .07em; margin-bottom: 5px; display: flex; align-items: center; gap: 4px; }
.chat-icebreaker-text { font-size: 12px; color: var(--text-2); line-height: 1.65; }
.chat-input { flex: 1; background: #f5f5f5; border: 1px solid var(--border); border-radius: 10px; padding: 9px 13px; font-size: 14px; color: var(--text); font-family: 'DM Sans', sans-serif; resize: none; outline: none; min-height: 40px; }
.chat-send-btn { width: 40px; height: 40px; border-radius: 10px; background: var(--primary); border: none; color: #fff; font-size: 16px; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.chat-submit-row { padding: 6px 12px 10px; display: flex; justify-content: center; background: var(--card); flex-shrink: 0; border-top: 1px solid var(--border); }
.chat-submit-btn { font-size: 11px; color: var(--text-2); border: 1px solid var(--border); border-radius: 8px; padding: 6px 16px; cursor: pointer; background: var(--card); font-family: 'DM Sans', sans-serif; }

/* ── Step Score ── */
.score-total { background: var(--card); border-radius: 16px; border: 1px solid var(--border); padding: 20px; text-align: center; margin-bottom: 14px; }
.score-number { font-family: 'Georgia', serif; font-size: 60px; color: var(--primary); line-height: 1; margin-bottom: 4px; font-weight: 400; }
.score-sub { font-size: 13px; color: var(--text-2); font-family: 'DM Sans', sans-serif; }
.dim-row { display: flex; align-items: center; gap: 10px; padding: 9px 0; border-bottom: 1px solid var(--border); font-size: 12px; }
.dim-row:last-child { border-bottom: none; }
.dim-name { font-size: 12px; color: var(--text-2); font-family: 'DM Sans', sans-serif; flex: 1; }
.dim-comment { font-size: 10px; color: var(--text-3); margin-top: 1px; line-height: 1.4; font-family: 'DM Sans', sans-serif; }
.dim-bar-wrap { width: 70px; height: 5px; background: #f0ede6; border-radius: 3px; }
.dim-bar { height: 100%; border-radius: 3px; background: var(--primary); }
.dim-score { font-weight: 700; color: var(--text); min-width: 24px; text-align: right; font-family: 'DM Sans', sans-serif; font-size: 12px; }
.dim-score span { font-size: 9px; color: var(--text-3); }
.score-breakdown { background: var(--card); border-radius: 12px; border: 1px solid var(--border); padding: 14px; margin-bottom: 14px; }
.highlight-card { border-radius: 10px; border: 1.5px solid; padding: 12px 14px; margin-bottom: 10px; }
.highlight-card.good { background: #F0FFF4; border-color: #BBF7D0; }
.highlight-card.improve { background: #FFFBEB; border-color: #FDE68A; }
.highlight-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; margin-bottom: 4px; font-family: 'DM Sans', sans-serif; }
.highlight-card.good .highlight-label { color: var(--success); }
.highlight-card.improve .highlight-label { color: var(--warning); }
.highlight-text { font-size: 13px; color: var(--text); line-height: 1.5; font-family: 'DM Sans', sans-serif; }
.coach-toggle { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 14px; margin-bottom: 14px; cursor: pointer; }
.coach-toggle-label { font-size: 12px; font-weight: 700; color: var(--text-2); display: flex; align-items: center; justify-content: space-between; font-family: 'DM Sans', sans-serif; }
.coach-content { font-size: 12px; color: var(--text-2); line-height: 1.7; margin-top: 10px; display: none; font-family: 'DM Sans', sans-serif; }
.coach-content.open { display: block; }

/* ── Hint overlay ── */
.hint-overlay {
  position: absolute; inset: 0; background: rgba(0,0,0,0.45);
  z-index: 200; display: none; align-items: center;
  justify-content: center; padding: 24px;
}
.hint-overlay.visible { display: flex; }
.hint-card { background: #fff; border-radius: 16px; padding: 20px; max-width: 340px; width: 100%; box-shadow: 0 8px 40px rgba(0,0,0,0.18); position: relative; }
.hint-card-title { font-size: 13px; font-weight: 700; color: var(--primary); margin-bottom: 2px; font-family: 'DM Sans', sans-serif; }
.hint-card-sub { font-size: 11px; color: #8a8a8a; margin-bottom: 12px; font-family: 'DM Sans', sans-serif; }
.hint-card-body { font-size: 13px; color: var(--text); line-height: 1.7; background: #F6F8FF; border-left: 3px solid var(--primary); padding: 12px; border-radius: 0 8px 8px 0; font-family: 'DM Sans', sans-serif; }
.hint-card-footer { font-size: 11px; color: #aaa; text-align: center; margin-top: 12px; font-family: 'DM Sans', sans-serif; }
.hint-close { position: absolute; top: 12px; right: 14px; background: none; border: none; font-size: 20px; color: #aaa; cursor: pointer; line-height: 1; padding: 0; }

/* ── Conclusion strip/box ── */
.submit-strip { border-top: 1px solid var(--border); background: var(--card); padding: 10px 14px; display: flex; align-items: center; justify-content: space-between; flex-shrink: 0; }
.strip-label { font-size: 11px; font-weight: 600; color: var(--primary); font-family: 'DM Sans', sans-serif; }
.strip-sub { font-size: 10px; color: var(--text-3); font-family: 'DM Sans', sans-serif; }
.strip-expand-btn { background: var(--primary); color: #fff; border: none; border-radius: 8px; padding: 7px 12px; font-size: 11px; font-weight: 600; cursor: pointer; font-family: 'DM Sans', sans-serif; }
.conclusion-box { border-top: 2px solid var(--primary); background: var(--card); padding: 14px; flex-shrink: 0; max-height: 55vh; overflow-y: auto; }
.conclusion-title { font-size: 11px; font-weight: 700; color: var(--text); margin-bottom: 2px; font-family: 'DM Sans', sans-serif; }
.conclusion-sub { font-size: 10px; color: var(--text-3); margin-bottom: 8px; font-family: 'DM Sans', sans-serif; }
.conclusion-textarea { width: 100%; border: 1px solid #ddd; border-radius: 8px; padding: 9px; font-size: 11px; line-height: 1.6; resize: none; height: 60px; box-sizing: border-box; font-family: 'DM Sans', sans-serif; color: var(--text); outline: none; }
.conclusion-hint { min-height: 16px; font-size: 10px; color: var(--text-3); margin-top: 6px; font-family: 'DM Sans', sans-serif; }
.conclusion-hint.pass { background: #E8F5E9; color: var(--success); border-radius: 4px; padding: 4px 8px; }
.conclusion-hint.warn { background: #FFF8E1; color: #7A5800; border-radius: 4px; padding: 4px 8px; }
.conclusion-actions { margin-top: 8px; display: flex; align-items: center; justify-content: space-between; }
.conclusion-back-btn { font-size: 10px; color: var(--text-3); background: none; border: none; cursor: pointer; font-family: 'DM Sans', sans-serif; }
.conclusion-submit-btn { background: var(--primary); color: #fff; border: none; border-radius: 8px; padding: 8px 14px; font-size: 12px; font-weight: 600; cursor: pointer; font-family: 'DM Sans', sans-serif; }
.conclusion-submit-btn.disabled { opacity: .4; cursor: not-allowed; }

/* ── annotation strip ── */
.step-annotation { background: var(--primary-lt); border: 1px solid #C5D5FF; border-radius: 10px; padding: 10px 14px; margin-bottom: 14px; font-size: 12px; color: var(--primary); line-height: 1.6; font-family: 'DM Sans', sans-serif; }

/* ── nav bar at top ── */
.top-nav {
  position: fixed; top: 0; left: 50%; transform: translateX(-50%);
  background: #111; display: flex; gap: 8px; padding: 8px 16px;
  z-index: 999; border-radius: 0 0 12px 12px; overflow-x: auto;
  white-space: nowrap; max-width: 100vw;
}
.wrapper { max-width: 390px; width: 100vw; margin-top: 54px; position: relative; }
</style>
</head>
<body>

<!-- Top nav -->
<div class="top-nav">
  <span class="nav-label active" onclick="show('p1-drill')">P1 加練</span>
  <span class="nav-label" onclick="show('p1-hint')">P1+提示</span>
  <span class="nav-label" onclick="show('gate-pass')">Gate ✓</span>
  <span class="nav-label" onclick="show('gate-fail')">Gate ✗</span>
  <span class="nav-label" onclick="show('p2-early')">P2 早期</span>
  <span class="nav-label" onclick="show('p2-late')">P2 提交</span>
  <span class="nav-label" onclick="show('p2-conclude')">P2 結論</span>
  <span class="nav-label" onclick="show('p3-score')">P3 I評分</span>
  <span class="nav-label" onclick="show('p3-c1')">P3 C評分</span>
</div>

<div class="wrapper">
<div class="shell">

<!-- ════════════════════════════════════════════
     SCREEN: Phase 1 — I step (Drill mode)
════════════════════════════════════════════ -->
<div id="screen-p1-drill" class="screen active" style="position:relative">
  <div class="circles-nav">
    <button class="btn-icon" onclick="show('gate-pass')"><i class="ph ph-arrow-left"></i></button>
    <div>
      <div class="circles-nav-title">I — 定義用戶</div>
      <div class="circles-nav-sub">Meta · News Feed</div>
    </div>
    <button class="circles-nav-home">回首頁</button>
  </div>
  <div class="circles-progress">
    <div class="circles-progress-seg done"></div>
    <div class="circles-progress-seg active"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-label">I · 定義用戶 · 2/7</div>
  </div>
  <div class="scroll-body">
    <div class="problem-card">
      <div class="problem-card-label">練習題目</div>
      用戶反映 News Feed 廣告過多，如何改善廣告體驗並維持 Meta 的廣告收入？
    </div>

    <!-- Field 1 -->
    <div class="circles-field-group">
      <div class="circles-field-label-row">
        <div class="circles-field-label">目標用戶分群</div>
        <button class="circles-hint-trigger" onclick="showHint('目標用戶分群','思考用戶使用 News Feed 的不同行為模式。哪些群體對廣告的感受最強烈？功能型用戶、習慣型用戶、新用戶各有什麼不同的痛點？這個分群方式要足夠具體，能讓後續的需求分析聚焦在真正不同的動機上。')">💡 提示</button>
      </div>
      <div class="circles-field-hint">例：功能型用戶 / 習慣型用戶 / 新用戶</div>
      <textarea class="circles-field-input" rows="2" placeholder="填寫你的分析..."></textarea>
    </div>

    <!-- Field 2 -->
    <div class="circles-field-group">
      <div class="circles-field-label-row">
        <div class="circles-field-label">選定焦點對象</div>
        <button class="circles-hint-trigger" onclick="showHint('選定焦點對象','從上面的分群中選一個。選擇標準是：體量最大且對廣告痛點最有代表性的群體。說清楚為什麼這個群體是最值得優先服務的，而不是另外幾個。這個理由會影響整個後續的需求和方案設計。')">💡 提示</button>
      </div>
      <div class="circles-field-hint">例：最有代表性且體量最大的群體</div>
      <textarea class="circles-field-input" rows="2" placeholder="填寫你的分析..."></textarea>
    </div>

    <!-- Field 3 -->
    <div class="circles-field-group">
      <div class="circles-field-label-row">
        <div class="circles-field-label">用戶動機假設</div>
        <button class="circles-hint-trigger" onclick="showHint('用戶動機假設','用 JTBD（Jobs to Be Done）框架思考：這個用戶「聘用」News Feed 是為了完成什麼任務？不是「滑手機」，而是更深層的目標——保持社交聯繫、消磨時間、獲取資訊？動機越具體，後面需求分析就越有說服力。')">💡 提示</button>
      </div>
      <div class="circles-field-hint">例：他們想完成什麼「任務」（JTBD）</div>
      <textarea class="circles-field-input" rows="2" placeholder="填寫你的分析..."></textarea>
    </div>

    <!-- Field 4 -->
    <div class="circles-field-group">
      <div class="circles-field-label-row">
        <div class="circles-field-label">排除對象</div>
        <button class="circles-hint-trigger" onclick="showHint('排除對象','說明哪些用戶群體你不服務，以及原因。例如：不服務廣告主（有獨立工具）、不服務純新用戶（行為資料不足）。這一欄的目的是讓面試官看到你的邊界意識——你的設計不是要取悅所有人。')">💡 提示</button>
      </div>
      <div class="circles-field-hint">例：不服務哪類用戶及原因</div>
      <textarea class="circles-field-input" rows="2" placeholder="填寫你的分析..."></textarea>
    </div>
  </div>
  <div class="submit-bar">
    <button class="btn-secondary">返回選題</button>
    <button class="btn-primary" onclick="show('gate-pass')">提交框架 → AI 審核</button>
  </div>
  <!-- Hint overlay -->
  <div class="hint-overlay" id="hint-overlay" onclick="closeHint(event)">
    <div class="hint-card">
      <button class="hint-close" onclick="closeHint()">×</button>
      <div class="hint-card-title" id="hint-title">💡 目標用戶分群 — 分析思路</div>
      <div class="hint-card-sub">Meta · News Feed · I 定義用戶</div>
      <div class="hint-card-body" id="hint-body">載入中…</div>
      <div class="hint-card-footer">閱讀後關閉，自行填寫你的分析</div>
    </div>
  </div>
</div>

<!-- ════════════════════════════════════════════
     SCREEN: Phase 1 — hint overlay state (example filled)
════════════════════════════════════════════ -->
<div id="screen-p1-hint" class="screen" style="position:relative">
  <div class="circles-nav">
    <button class="btn-icon"><i class="ph ph-arrow-left"></i></button>
    <div>
      <div class="circles-nav-title">I — 定義用戶</div>
      <div class="circles-nav-sub">Meta · News Feed</div>
    </div>
    <button class="circles-nav-home">回首頁</button>
  </div>
  <div class="circles-progress">
    <div class="circles-progress-seg done"></div>
    <div class="circles-progress-seg active"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-label">I · 定義用戶 · 2/7</div>
  </div>
  <div class="scroll-body" style="filter:blur(1px);pointer-events:none">
    <div class="problem-card">用戶反映 News Feed 廣告過多，如何改善廣告體驗並維持 Meta 的廣告收入？</div>
    <div class="circles-field-group">
      <div class="circles-field-label-row"><div class="circles-field-label">目標用戶分群</div></div>
      <textarea class="circles-field-input filled" rows="2">功能型用戶、習慣型用戶、新用戶</textarea>
    </div>
    <div class="circles-field-group">
      <div class="circles-field-label-row"><div class="circles-field-label">選定焦點對象</div></div>
      <textarea class="circles-field-input" rows="2" placeholder="填寫你的分析..."></textarea>
    </div>
  </div>
  <!-- Hint overlay — visible -->
  <div class="hint-overlay visible">
    <div class="hint-card">
      <button class="hint-close">×</button>
      <div class="hint-card-title">💡 選定焦點對象 — 分析思路</div>
      <div class="hint-card-sub">Meta · News Feed · I 定義用戶</div>
      <div class="hint-card-body">從上面的分群中選一個。選擇標準是體量最大且對廣告痛點最有代表性的群體。說清楚為什麼這個群體值得優先服務，而不是另外幾個。記住：習慣型用戶每天使用 News Feed 最頻繁，他們對廣告干擾最敏感，而且體量最大——這個理由要出現在你的答案中，才能說服面試官你的選擇有邏輯支撐。</div>
      <div class="hint-card-footer">閱讀後關閉，自行填寫你的分析</div>
    </div>
  </div>
</div>

<!-- ════════════════════════════════════════════
     SCREEN: Phase 1.5 Gate — Pass
════════════════════════════════════════════ -->
<div id="screen-gate-pass" class="screen" style="position:relative">
  <div class="circles-nav">
    <button class="btn-icon" onclick="show('p1-drill')"><i class="ph ph-arrow-left"></i></button>
    <div>
      <div class="circles-nav-title">框架審核結果</div>
      <div class="circles-nav-sub">I · 定義用戶 · Meta</div>
    </div>
    <button class="circles-nav-home">回首頁</button>
  </div>
  <div class="circles-progress">
    <div class="circles-progress-seg done"></div>
    <div class="circles-progress-seg done"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-label">I · 定義用戶</div>
  </div>
  <div class="scroll-body">
    <div class="gate-pass-bar">
      <div>
        <div class="gate-pass-text">框架審核通過</div>
        <div class="gate-pass-sub">框架方向正確，進入對話練習階段繼續探索。</div>
      </div>
    </div>
    <div class="gate-card ok">
      <div class="gate-card-icon" style="color:#137A3D"><i class="ph ph-check-circle"></i></div>
      <div>
        <div class="gate-card-field">目標用戶分群</div>
        <div class="gate-card-title">分群邏輯清晰</div>
        <div class="gate-card-reason">依行為模式分群（功能型、習慣型、新用戶），有助於後續差異化需求分析</div>
      </div>
    </div>
    <div class="gate-card ok">
      <div class="gate-card-icon" style="color:#137A3D"><i class="ph ph-check-circle"></i></div>
      <div>
        <div class="gate-card-field">選定焦點對象</div>
        <div class="gate-card-title">選擇有理由支撐</div>
        <div class="gate-card-reason">以體量最大且廣告痛點最強作為選擇理由，邏輯成立</div>
      </div>
    </div>
    <div class="gate-card warn">
      <div class="gate-card-icon" style="color:#B85C00"><i class="ph ph-warning"></i></div>
      <div>
        <div class="gate-card-field">用戶動機假設</div>
        <div class="gate-card-title">動機較為表面</div>
        <div class="gate-card-reason">只提到「想看到有興趣的內容」，JTBD 層次偏淺</div>
        <div class="gate-card-suggestion">建議補充：維持社交聯繫或獲取特定資訊的底層需求</div>
      </div>
    </div>
    <div class="gate-card ok">
      <div class="gate-card-icon" style="color:#137A3D"><i class="ph ph-check-circle"></i></div>
      <div>
        <div class="gate-card-field">排除對象</div>
        <div class="gate-card-title">邊界意識良好</div>
        <div class="gate-card-reason">明確排除廣告主和純新用戶，理由充分</div>
      </div>
    </div>
  </div>
  <div class="submit-bar">
    <button class="btn-ghost-sm" onclick="show('p1-drill')">重新編輯</button>
    <button class="btn-primary" onclick="show('p2-early')">進入對話練習 →</button>
  </div>
</div>

<!-- ════════════════════════════════════════════
     SCREEN: Phase 1.5 Gate — Fail (drill mode, error blocks)
════════════════════════════════════════════ -->
<div id="screen-gate-fail" class="screen" style="position:relative">
  <div class="circles-nav">
    <button class="btn-icon" onclick="show('p1-drill')"><i class="ph ph-arrow-left"></i></button>
    <div>
      <div class="circles-nav-title">框架審核結果</div>
      <div class="circles-nav-sub">I · 定義用戶 · Meta</div>
    </div>
    <button class="circles-nav-home">回首頁</button>
  </div>
  <div class="circles-progress">
    <div class="circles-progress-seg done"></div>
    <div class="circles-progress-seg done"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-label">I · 定義用戶</div>
  </div>
  <div class="scroll-body">
    <div class="gate-fail-bar">框架有方向性錯誤，請修正後再提交（步驟加練模式）</div>
    <div class="gate-card error">
      <div class="gate-card-icon" style="color:#D92020"><i class="ph ph-x-circle"></i></div>
      <div>
        <div class="gate-card-field">目標用戶分群</div>
        <div class="gate-card-title">分群維度混淆</div>
        <div class="gate-card-reason">同時使用人口統計（25-35歲）和行為（重度用戶）分群，兩個維度無法對比</div>
        <div class="gate-card-suggestion">建議只選一個維度，行為分群在這題更有說服力</div>
      </div>
    </div>
    <div class="gate-card error">
      <div class="gate-card-icon" style="color:#D92020"><i class="ph ph-x-circle"></i></div>
      <div>
        <div class="gate-card-field">選定焦點對象</div>
        <div class="gate-card-title">選擇理由缺失</div>
        <div class="gate-card-reason">只說「選25-35歲女性」但沒有說明為什麼，面試官無從判斷你的邏輯</div>
        <div class="gate-card-suggestion">補上選擇理由：體量、痛點強度、或商業價值</div>
      </div>
    </div>
    <div class="gate-card warn">
      <div class="gate-card-icon" style="color:#B85C00"><i class="ph ph-warning"></i></div>
      <div>
        <div class="gate-card-field">用戶動機假設</div>
        <div class="gate-card-title">動機偏表面</div>
        <div class="gate-card-reason">「想看廣告少一點」是症狀，不是動機，需要說清楚底層的使用目的</div>
        <div class="gate-card-suggestion">例：維持社交聯繫、獲取特定資訊</div>
      </div>
    </div>
    <div class="gate-card ok">
      <div class="gate-card-icon" style="color:#137A3D"><i class="ph ph-check-circle"></i></div>
      <div>
        <div class="gate-card-field">排除對象</div>
        <div class="gate-card-title">邊界設定合理</div>
        <div class="gate-card-reason">明確排除廣告主，有助於聚焦</div>
      </div>
    </div>
  </div>
  <div class="submit-bar">
    <button class="btn-primary" onclick="show('p1-drill')">修正框架後重試</button>
  </div>
</div>

<!-- ════════════════════════════════════════════
     SCREEN: Phase 2 — Early turns (< 3)
════════════════════════════════════════════ -->
<div id="screen-p2-early" class="screen chat-wrap">
  <div class="circles-nav">
    <button class="btn-icon" onclick="show('gate-pass')"><i class="ph ph-arrow-left"></i></button>
    <div>
      <div class="circles-nav-title">I — 對話練習</div>
      <div class="circles-nav-sub">Meta · News Feed</div>
    </div>
    <button class="circles-nav-home">回首頁</button>
  </div>
  <div class="circles-progress">
    <div class="circles-progress-seg done"></div>
    <div class="circles-progress-seg done"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-label">I · 定義用戶 · 2/7</div>
  </div>
  <div class="chat-pinned">
    <div class="pinned-co">Meta — 定義用戶</div>
    <div class="pinned-stmt">用戶反映 News Feed 廣告過多，如何改善廣告體驗…</div>
  </div>
  <div class="chat-body">
    <div class="chat-icebreaker">
      <div class="chat-icebreaker-label"><i class="ph ph-compass"></i> 開始提問方向</div>
      <div class="chat-icebreaker-text">問被訪談者你們的用戶有沒有按行為做分類——哪個群體對廣告的抱怨最集中、對業務最重要？</div>
    </div>
    <div class="bubble-user">你好，我想先了解 News Feed 的主要用戶群，你覺得大家用 Feed 主要是在做什麼？</div>
    <div class="bubble-ai">
      <div class="bubble-section">被訪談者</div>
      這個嘛…每個人好像都不太一樣。有些人每天一起床就滑，有些人只有閒下來才會打開。我自己的話，大概是想看看朋友在幹嘛，有時候也會看到一些社群動態或新聞之類的。
    </div>
    <div class="bubble-coaching" style="font-size:12px">
      <div class="bubble-section">教練點評</div>
      你用了開放式問題探索用戶行為，這是好的起點。但「大家在做什麼」還太廣，試著引導對方說出特定的使用情境或頻率差異。
      <button class="hint-toggle" onclick="toggleHint(this)"><i class="ph ph-caret-right" style="font-size:10px"></i> 查看教練提示</button>
      <div class="hint-body">試試問：「在你的用戶中，有沒有哪種人對廣告的感受特別強烈？他們和其他用戶有什麼不同？」</div>
    </div>
    <div class="bubble-user">那你們有沒有觀察到不同用戶群體對廣告的感受不一樣？</div>
    <div class="bubble-ai">
      <div class="bubble-section">被訪談者</div>
      嗯，有一些資料顯示，每天都在用的那批人，他們對廣告比較有抱怨。偶爾來看的用戶好像沒那麼在意。不過我也不確定這是不是廣告本身的問題，還是說他們對整個 Feed 的期待就不一樣。
    </div>
    <div class="bubble-coaching" style="font-size:12px">
      <div class="bubble-section">教練點評</div>
      很好，你找到了頻率差異這個維度。這正是用戶分群的關鍵——繼續深挖「每天都用的那批人」他們的使用動機是什麼。
      <button class="hint-toggle" onclick="toggleHint(this)"><i class="ph ph-caret-right" style="font-size:10px"></i> 查看教練提示</button>
      <div class="hint-body">繼續問他們來 Feed 是為了完成什麼任務，不要停在「看廣告少一點」這個症狀層面。</div>
    </div>
    <div style="height:8px"></div>
    <div style="text-align:center;font-size:11px;color:var(--text-3);font-family:'DM Sans',sans-serif;padding:4px 0">再對話 1 輪，可提交步驟</div>
  </div>
  <div class="chat-input-bar">
    <textarea class="chat-input" rows="1" placeholder="問被訪談者一個問題…"></textarea>
    <button class="chat-send-btn"><i class="ph ph-paper-plane-tilt"></i></button>
  </div>
</div>

<!-- ════════════════════════════════════════════
     SCREEN: Phase 2 — ≥3 turns, submit row (收斂範例)
════════════════════════════════════════════ -->
<div id="screen-p2-late" class="screen chat-wrap">
  <div class="circles-nav">
    <button class="btn-icon" onclick="show('p2-early')"><i class="ph ph-arrow-left"></i></button>
    <div>
      <div class="circles-nav-title">I — 對話練習</div>
      <div class="circles-nav-sub">Meta · News Feed</div>
    </div>
    <button class="circles-nav-home">回首頁</button>
  </div>
  <div class="circles-progress">
    <div class="circles-progress-seg done"></div>
    <div class="circles-progress-seg done"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-label">I · 定義用戶 · 2/7 · 4 輪</div>
  </div>
  <div class="chat-pinned">
    <div class="pinned-co">Meta — 定義用戶</div>
    <div class="pinned-stmt">用戶反映 News Feed 廣告過多，如何改善廣告體驗…</div>
  </div>
  <div class="chat-body">
    <div class="chat-icebreaker">
      <div class="chat-icebreaker-label"><i class="ph ph-compass"></i> 開始提問方向</div>
      <div class="chat-icebreaker-text">問被訪談者你們的用戶有沒有按行為做分類——哪個群體對廣告的抱怨最集中、對業務最重要？</div>
    </div>
    <div class="bubble-user">News Feed 的用戶群，你們有沒有按照使用頻率或行為做分類？</div>
    <div class="bubble-ai">
      <div class="bubble-section">被訪談者</div>
      有，我們大概分成每天都在滑的、每週來幾次的，還有偶爾才打開的。頻率不一樣，他們對 Feed 的依賴感也很不一樣。
    </div>
    <div class="bubble-coaching" style="font-size:12px">
      <div class="bubble-section">教練點評</div>
      好的開始，用頻率分群合理。但還沒說清楚「每天滑」的人和廣告問題的關係——繼續追。
      <button class="hint-toggle" onclick="toggleHint(this)"><i class="ph ph-caret-right" style="font-size:10px"></i> 查看教練提示</button>
      <div class="hint-body">問他們「哪個群體對廣告的投訴最集中？」這樣可以幫你確認焦點對象。</div>
    </div>
    <div class="bubble-user">這三組裡，哪一組對廣告的抱怨最多？他們有什麼共同特徵？</div>
    <div class="bubble-ai">
      <div class="bubble-section">被訪談者</div>
      每天都在用的那批，他們的投訴量最多，而且情緒最強烈。他們覺得「廣告打斷了我想看的東西」。但他們也是我們最活躍的用戶，廣告曝光對我們很重要。
    </div>
    <div class="bubble-coaching" style="font-size:12px">
      <div class="bubble-section">教練點評</div>
      很好的觀察——你同時拿到了「誰痛苦最深」和「誰對業務最重要」兩個維度，這就是鎖定焦點對象的完整理由。
      <button class="hint-toggle" onclick="toggleHint(this)"><i class="ph ph-caret-right" style="font-size:10px"></i> 查看教練提示</button>
      <div class="hint-body">現在問他們來 Feed「是為了完成什麼任務」——不是「想看什麼內容」而是更深層的動機。</div>
    </div>
    <div class="bubble-user">這些每天用的人，他們打開 Feed 的底層動機是什麼？不是「看新聞」這種表面答案。</div>
    <div class="bubble-ai">
      <div class="bubble-section">被訪談者</div>
      我覺得是一種「不想脫節」的感覺——他們想知道朋友在幹嘛、社群在討論什麼。有點像每天早上看報紙，是一個確認自己還在這個圈子的儀式。廣告打斷的，其實是這個「確認感」的心流。
    </div>
    <div class="bubble-coaching" style="font-size:12px">
      <div class="bubble-section">教練點評</div>
      這是整個 I 步驟最關鍵的一句話：「確認社交存在感」才是 JTBD，不是看廣告少一點。你問出了動機層，而不只是行為層。
      <button class="hint-toggle" onclick="toggleHint(this)"><i class="ph ph-caret-right" style="font-size:10px"></i> 查看教練提示</button>
      <div class="hint-body">最後補一個：「哪些用戶你們不打算服務？」確認排除對象後就可以提交了。</div>
    </div>
    <div class="bubble-user">那這次優化的範圍裡，哪些用戶你們不打算處理？</div>
    <div class="bubble-ai">
      <div class="bubble-section">被訪談者</div>
      廣告主那側不在這次範圍，他們有 Ads Manager。純新用戶我們也先不管，資料太少、個人化沒辦法做，硬做反而體驗更差。
    </div>
    <div class="bubble-coaching" style="font-size:12px">
      <div class="bubble-section">教練點評</div>
      排除對象清晰有理由。到這裡，I 步驟的四個核心維度——分群、焦點、JTBD、排除——都已完整確認，可以收斂提交了。
      <button class="hint-toggle" onclick="toggleHint(this)"><i class="ph ph-caret-right" style="font-size:10px"></i> 查看教練提示</button>
      <div class="hint-body">整理你的結論：鎖定哪個群體、底層動機是什麼、排除誰及原因。一兩句話就夠。</div>
    </div>
    <div style="height:4px"></div>
  </div>
  <div class="chat-input-bar">
    <textarea class="chat-input" rows="1" placeholder="繼續探索，或點下方提交…"></textarea>
    <button class="chat-send-btn"><i class="ph ph-paper-plane-tilt"></i></button>
  </div>
  <div class="chat-submit-row">
    <button class="chat-submit-btn" onclick="show('p2-conclude')">對話足夠了，提交這個步驟</button>
  </div>
</div>

<!-- ════════════════════════════════════════════
     SCREEN: Phase 2 — Conclusion box (expanded, 收斂範例)
════════════════════════════════════════════ -->
<div id="screen-p2-conclude" class="screen chat-wrap">
  <div class="circles-nav">
    <button class="btn-icon" onclick="show('p2-late')"><i class="ph ph-arrow-left"></i></button>
    <div>
      <div class="circles-nav-title">I — 對話練習</div>
      <div class="circles-nav-sub">Meta · News Feed</div>
    </div>
    <button class="circles-nav-home">回首頁</button>
  </div>
  <div class="circles-progress">
    <div class="circles-progress-seg done"></div>
    <div class="circles-progress-seg done"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-label">I · 定義用戶 · 2/7 · 4 輪</div>
  </div>
  <div class="chat-pinned">
    <div class="pinned-co">Meta — 定義用戶</div>
    <div class="pinned-stmt">用戶反映 News Feed 廣告過多，如何改善廣告體驗…</div>
  </div>
  <!-- 對話摘要（淡化顯示，表示用戶剛滑完） -->
  <div class="chat-body" style="opacity:0.45;pointer-events:none">
    <div class="bubble-user">News Feed 的用戶群，你們有沒有按照使用頻率做分類？</div>
    <div class="bubble-ai"><div class="bubble-section">被訪談者</div>有，每天都在滑的、每週幾次的、偶爾才開的。</div>
    <div class="bubble-user">哪一組對廣告的抱怨最多？</div>
    <div class="bubble-ai"><div class="bubble-section">被訪談者</div>每天用的那批，投訴最多、情緒最強——「廣告打斷了我想看的東西」。</div>
    <div class="bubble-user">他們打開 Feed 的底層動機是什麼？</div>
    <div class="bubble-ai"><div class="bubble-section">被訪談者</div>「不想脫節」——一種確認自己還在社交圈的儀式。廣告打斷的是這個心流。</div>
    <div class="bubble-user">哪些用戶你們不打算處理？</div>
    <div class="bubble-ai"><div class="bubble-section">被訪談者</div>廣告主（有自己工具）和純新用戶（資料不足，個人化做不了）。</div>
    <div style="text-align:center;padding:6px 0">
      <span style="font-size:11px;color:var(--text-3);font-family:'DM Sans',sans-serif;background:#f0ede6;border-radius:20px;padding:3px 12px">4 輪對話完成 · 點右上方提交步驟後出現此畫面</span>
    </div>
  </div>

  <!-- 結論框 -->
  <div class="conclusion-box">
    <div class="conclusion-title">整理你這個步驟確認了什麼</div>
    <div class="conclusion-sub">用 1-2 句話說明：鎖定的用戶群、JTBD 動機、排除對象</div>

    <!-- 範例（可展開，不同題目） -->
    <div style="border:1px solid var(--border);border-radius:8px;margin-bottom:8px;overflow:hidden">
      <div style="background:#f5f4f0;padding:5px 10px;display:flex;justify-content:space-between;cursor:pointer;align-items:center" onclick="var c=this.nextElementSibling;c.style.display=c.style.display==='none'?'block':'none';this.querySelector('span').textContent=c.style.display==='none'?'展開 ▾':'收起 ▴'">
        <span style="font-size:9px;font-weight:700;color:var(--text-3);text-transform:uppercase;letter-spacing:.4px;font-family:'DM Sans',sans-serif">範例（不同題目）</span>
        <span style="font-size:10px;color:var(--text-3);font-family:'DM Sans',sans-serif">展開 ▾</span>
      </div>
      <div style="display:none;padding:8px 10px;font-size:11px;color:var(--text-2);line-height:1.6;font-family:'DM Sans',sans-serif">
        聚焦 Spotify 免費版每日活躍用戶，他們使用 App 的 JTBD 是「用音樂管理情緒狀態」，不是隨機發現新音樂。排除付費用戶（已無廣告痛點）和偶爾用戶（資料不足）。
      </div>
    </div>

    <textarea class="conclusion-textarea" id="conclude-text" rows="3" oninput="onConclude()" placeholder="針對這題，整理你確認的關鍵定義…" style="height:72px">聚焦每日活躍用戶，他們使用 News Feed 的底層 JTBD 是「保持社交存在感」，廣告打斷的是這個心流。排除廣告主（有獨立工具）和純新用戶（個人化資料不足）。</textarea>
    <div class="conclusion-hint pass" id="conclude-hint">✓ 結論涵蓋用戶群、JTBD 動機和排除對象，可以提交</div>
    <div class="conclusion-actions">
      <button class="conclusion-back-btn" onclick="show('p2-late')">← 繼續對話</button>
      <button class="conclusion-submit-btn" onclick="show('p3-score')">確認提交</button>
    </div>
  </div>
</div>

<!-- ════════════════════════════════════════════
     SCREEN: Phase 3 — Step Score (I step)
════════════════════════════════════════════ -->
<div id="screen-p3-score" class="screen" style="position:relative">
  <div class="circles-nav">
    <button class="btn-icon" onclick="show('p2-conclude')"><i class="ph ph-arrow-left"></i></button>
    <div>
      <div class="circles-nav-title">步驟評分 — 定義用戶</div>
      <div class="circles-nav-sub">Meta · News Feed</div>
    </div>
    <!-- simulation: prev/next nav; drill: none -->
  </div>
  <div class="circles-progress">
    <div class="circles-progress-seg done"></div>
    <div class="circles-progress-seg done"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-label">I · 定義用戶 · 2/7</div>
  </div>
  <div class="scroll-body">
    <div class="score-total">
      <div class="score-number">78</div>
      <div class="score-sub">I — 定義用戶 步驟得分</div>
    </div>
    <div class="score-breakdown">
      <div class="dim-row">
        <div style="flex:1"><div class="dim-name">分群邏輯</div><div class="dim-comment">依行為分群，維度一致</div></div>
        <div class="dim-bar-wrap"><div class="dim-bar" style="width:80%"></div></div>
        <div class="dim-score">4<span>/5</span></div>
      </div>
      <div class="dim-row">
        <div style="flex:1"><div class="dim-name">焦點選定理由</div><div class="dim-comment">理由說明了體量，但商業價值不夠清晰</div></div>
        <div class="dim-bar-wrap"><div class="dim-bar" style="width:60%"></div></div>
        <div class="dim-score">3<span>/5</span></div>
      </div>
      <div class="dim-row">
        <div style="flex:1"><div class="dim-name">JTBD 動機深度</div><div class="dim-comment">挖到「保持社交存在感」，層次清晰</div></div>
        <div class="dim-bar-wrap"><div class="dim-bar" style="width:90%"></div></div>
        <div class="dim-score">4.5<span>/5</span></div>
      </div>
      <div class="dim-row">
        <div style="flex:1"><div class="dim-name">排除對象說明</div><div class="dim-comment">排除廣告主和新用戶，理由合理</div></div>
        <div class="dim-bar-wrap"><div class="dim-bar" style="width:72%"></div></div>
        <div class="dim-score">3.5<span>/5</span></div>
      </div>
    </div>
    <div class="highlight-card good">
      <div class="highlight-label">最強表現</div>
      <div class="highlight-text">成功挖出「保持社交存在感」作為 JTBD，而不只是表面的「減少廣告」，展現了用戶動機分析的深度</div>
    </div>
    <div class="highlight-card improve">
      <div class="highlight-label">最需改進</div>
      <div class="highlight-text">焦點用戶的選擇理由只說體量，沒有連結到商業價值——面試官會追問「為什麼這群人對 Meta 最重要？」</div>
    </div>
    <div class="coach-toggle" onclick="this.querySelector('.coach-content').classList.toggle('open'); this.querySelector('i').classList.toggle('ph-caret-down'); this.querySelector('i').classList.toggle('ph-caret-up')">
      <div class="coach-toggle-label">教練示範答案 <i class="ph ph-caret-down"></i></div>
      <div class="coach-content">
        <strong>分群：</strong>依使用頻率分為三組：每日活躍用戶（DAU）、週活躍用戶（WAU）、月活躍用戶（MAU）。<br><br>
        <strong>焦點：</strong>聚焦 DAU，理由有三：① 體量佔 Meta MAU 的 65%+，② 廣告曝光頻率最高，痛點最強，③ 對 Meta 廣告收入貢獻比例最高，優化 ROI 最大。<br><br>
        <strong>JTBD：</strong>他們「聘用」News Feed 的任務是「以低成本維持在社交圈的存在感」，廣告打斷的是這個心流，而不只是視覺體驗。<br><br>
        <strong>排除：</strong>不服務廣告主（有 Ads Manager）、不服務 MAU（資料稀疏，個人化困難）。
      </div>
    </div>
  </div>
  <div class="submit-bar">
    <button class="btn-ghost-sm">回首頁</button>
    <button class="btn-primary">繼續下一步：R 發掘需求 →</button>
  </div>
</div>

<!-- ════════════════════════════════════════════
     SCREEN: Phase 3 — Step Score (C1 澄清情境)
════════════════════════════════════════════ -->
<div id="screen-p3-c1" class="screen" style="position:relative">
  <div class="circles-nav">
    <button class="btn-icon"><i class="ph ph-arrow-left"></i></button>
    <div>
      <div class="circles-nav-title">步驟評分 — 澄清情境</div>
      <div class="circles-nav-sub">Meta · News Feed</div>
    </div>
    <!-- simulation 模式有前後步驟按鈕 -->
    <div style="display:flex;gap:4px;margin-left:auto">
      <button class="btn-icon" disabled style="opacity:.3"><i class="ph ph-caret-left"></i></button>
      <button class="btn-icon"><i class="ph ph-caret-right"></i></button>
    </div>
  </div>
  <div class="circles-progress">
    <div class="circles-progress-seg done"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-label">C · 澄清情境 · 1/7</div>
  </div>
  <div class="scroll-body">
    <div class="score-total">
      <div class="score-number">72</div>
      <div class="score-sub">C — 澄清情境 步驟得分</div>
    </div>
    <div class="score-breakdown">
      <div class="dim-row">
        <div style="flex:1">
          <div class="dim-name">問題邊界清晰度</div>
          <div class="dim-comment">確認了廣告頻率問題，但未區分相關性與格式</div>
        </div>
        <div class="dim-bar-wrap"><div class="dim-bar" style="width:70%"></div></div>
        <div class="dim-score">3.5<span>/5</span></div>
      </div>
      <div class="dim-row">
        <div style="flex:1">
          <div class="dim-name">業務影響連結</div>
          <div class="dim-comment">提到廣告收入保護，但未量化約束條件</div>
        </div>
        <div class="dim-bar-wrap"><div class="dim-bar" style="width:60%"></div></div>
        <div class="dim-score">3<span>/5</span></div>
      </div>
      <div class="dim-row">
        <div style="flex:1">
          <div class="dim-name">時間範圍合理性</div>
          <div class="dim-comment">設定 90 天合理，符合廣告收入指標週期</div>
        </div>
        <div class="dim-bar-wrap"><div class="dim-bar" style="width:80%"></div></div>
        <div class="dim-score">4<span>/5</span></div>
      </div>
      <div class="dim-row">
        <div style="flex:1">
          <div class="dim-name">假設排除完整性</div>
          <div class="dim-comment">排除了技術限制，但未說明競品對比的假設</div>
        </div>
        <div class="dim-bar-wrap"><div class="dim-bar" style="width:52%"></div></div>
        <div class="dim-score">2.5<span>/5</span></div>
      </div>
    </div>
    <div class="highlight-card good">
      <div class="highlight-label">最強表現</div>
      <div class="highlight-text">清楚說明「廣告收入保護」是這題的硬性約束，讓整個分析有正確的業務邊界</div>
    </div>
    <div class="highlight-card improve">
      <div class="highlight-label">最需改進</div>
      <div class="highlight-text">假設確認太少——沒有問「廣告問題是頻率、相關性、還是格式？」這個區分會完全改變後續的解法方向</div>
    </div>
    <div class="coach-toggle" onclick="this.querySelector('.coach-content').classList.toggle('open'); var i=this.querySelector('i'); i.className=i.className.includes('caret-down')?'ph ph-caret-up':'ph ph-caret-down'">
      <div class="coach-toggle-label">教練示範答案 <i class="ph ph-caret-down"></i></div>
      <div class="coach-content">
        <strong>問題範圍：</strong>聚焦 News Feed 廣告體驗，排除 Stories、Reels、Marketplace 廣告版位。需釐清「廣告過多」是指頻率（每 N 則一則廣告）、相關性（廣告與用戶興趣不符），還是格式（影片/靜態圖干擾感不同）——三者是完全不同的問題。<br><br>
        <strong>時間範圍：</strong>設定 90 天觀察期。廣告業務以季度為單位衡量，90 天足以看到用戶行為變化與收入影響的相關性。<br><br>
        <strong>業務影響：</strong>核心約束是廣告收入不能下降超過 X%（需確認 Meta 的容忍閾值）。改善用戶體驗的同時，廣告主 ROI 不能大幅下滑——否則廣告主撤單，業務鏈斷掉。<br><br>
        <strong>假設確認：</strong>① 廣告問題是相關性而非純頻率（假設）；② 用戶對廣告的負感來自打斷心流，不是廣告本身（假設）；③ 技術上可以做到動態插入頻率調控（待確認）。
      </div>
    </div>
  </div>
  <div class="submit-bar">
    <button class="btn-ghost-sm">回首頁</button>
    <button class="btn-primary" onclick="show('p3-score')">繼續下一步：I 定義用戶 →</button>
  </div>
</div>

</div><!-- /shell -->
</div><!-- /wrapper -->

<script>
function show(id) {
  document.querySelectorAll('.screen').forEach(function(s) {
    s.classList.remove('active');
  });
  document.querySelectorAll('.nav-label').forEach(function(n) {
    n.classList.remove('active');
  });
  var el = document.getElementById('screen-' + id);
  if (el) el.classList.add('active');
  document.querySelectorAll('.nav-label').forEach(function(n) {
    if (n.getAttribute('onclick') && n.getAttribute('onclick').includes("'" + id + "'")) {
      n.classList.add('active');
    }
  });
}

function showHint(fieldName, hintText) {
  document.getElementById('hint-title').textContent = '💡 ' + fieldName + ' — 分析思路';
  document.getElementById('hint-body').textContent = hintText;
  document.getElementById('hint-overlay').classList.add('visible');
}
function closeHint(e) {
  if (!e || e.target === document.getElementById('hint-overlay')) {
    document.getElementById('hint-overlay').classList.remove('visible');
  }
}
function toggleHint(btn) {
  var content = btn.nextElementSibling;
  if (!content) return;
  var isOpen = content.style.display !== 'none';
  content.style.display = isOpen ? 'none' : 'block';
  var icon = btn.querySelector('i');
  if (icon) icon.className = isOpen ? 'ph ph-caret-right' : 'ph ph-caret-down';
  btn.style.color = isOpen ? 'var(--text-3)' : 'var(--primary)';
}
function onConclude() {
  // Already filled with good text — always pass state in mockup
}
</script>
</body>
</html>
```

---

## Mockup HTML — R 發掘需求完整互動稿

以下是本次討論中設計並核准的完整 mockup HTML（9 個畫面）。**Mockup 來源路徑：** `.superpowers/brainstorm/99819-1777221639/content/circles-R-step-v2.html`（直接用瀏覽器開啟即可預覽）。**此 HTML 是實作的視覺真相來源（canonical visual truth）——若 spec 文字與此畫面有出入，以此 HTML 為準。**

**畫面清單（9 screens）：**
1. `P1 加練` — Phase 1 drill mode（4 collapsible field examples, 💡 hint triggers, `flex-shrink:0` submit-bar）
2. `P1+提示` — Phase 1 with hint overlay visible（情感性需求 hint shown）
3. `Gate ✓` — Gate pass（`gate-pass-bar` + 4 `gate-card` ok/warn/ok/ok）
4. `Gate ✗` — Gate fail drill mode（`gate-fail-bar` + error blocks, single "修正框架後重試" btn）
5. `P2 早期` — Phase 2 early turns（< 3 turns, no `chat-submit-row`）
6. `P2 收斂` — Phase 2 convergence（≥ 3 turns, `chat-submit-row` + `chat-submit-btn` visible）
7. `P2 結論` — Phase 2 conclusion box expanded（`conclusion-box` with collapsible example strip）
8. `P3 R評分` — Phase 3 R step score（73分, 4 dims, `coach-toggle` with labeled answers, `score-nav` ◀▶）
9. `P3 C評分` — Phase 3 browsing previous step score in simulation（`score-nav` ◀▶ navigation）

**Key new CSS patterns introduced in R step:**

| Pattern | Class | Behaviour |
|---------|-------|-----------|
| Collapsible field example | `.field-example-toggle` + `.field-example-body.open` | Replaces always-visible `.circles-field-hint`; click to expand/collapse |
| Submit-bar layout | `flex-shrink: 0` on `.submit-bar` | Prevents viewport clipping (old `position:absolute;bottom:0` clips 4px below due to `wrapper{margin-top:54px}`) |
| Coach answer formatting | `<div style="margin-bottom:6px"><strong style="color:var(--text)">Label：</strong>text</div>` per dimension | Replaces run-on paragraph; each dimension on its own line with bold label |
| Score nav in circles-nav | `.score-nav` + `.score-nav-btn` | Appears in simulation Phase 3 nav; replaces 回首頁 button; ◀ disabled on first step |

```html
<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
<title>CIRCLES — R 發掘需求 Mockup</title>
<link rel="stylesheet" href="https://unpkg.com/@phosphor-icons/web@2.1.1/src/regular/style.css">
<style>
* { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
body { font-family: 'DM Sans', -apple-system, sans-serif; background: #F2F0EB; display: flex; justify-content: center; }

:root {
  --bg: #F2F0EB;
  --card: #ffffff;
  --border: #e8e5de;
  --primary: #1A56DB;
  --primary-lt: #EEF3FF;
  --text: #1a1a1a;
  --text-2: #5a5a5a;
  --text-3: #8a8a8a;
  --success: #137A3D;
  --warning: #B85C00;
  --danger: #D92020;
}

/* ── Top nav ── */
.top-nav {
  position: fixed; top: 0; left: 50%; transform: translateX(-50%);
  background: #111; display: flex; gap: 8px; padding: 8px 16px;
  z-index: 999; border-radius: 0 0 12px 12px; overflow-x: auto;
  white-space: nowrap; max-width: 100vw;
}
.nav-label {
  font-size: 11px; font-weight: 700; background: #1a1a1a; color: #fff;
  padding: 6px 14px; border-radius: 20px; cursor: pointer;
  font-family: sans-serif; white-space: nowrap;
}
.nav-label:hover { background: #333; }
.nav-label.active { background: var(--primary); }

/* ── Shell ── */
.wrapper { max-width: 390px; width: 100vw; margin-top: 54px; position: relative; }
.shell { width: 390px; min-height: 100vh; background: var(--bg); position: relative; overflow: hidden; }
.screen { display: none; flex-direction: column; height: 100vh; }
.screen.active { display: flex; }

/* ── Navbar ── */
.navbar {
  height: 52px; background: var(--card); border-bottom: 1px solid var(--border);
  display: flex; align-items: center; padding: 0 16px; gap: 8px; flex-shrink: 0;
}
.navbar-logo { font-size: 15px; font-weight: 700; flex: 1; }
.btn-icon { background: none; border: none; font-size: 18px; color: var(--text-2); cursor: pointer; padding: 6px; line-height: 1; }
.btn-ghost { background: none; border: none; font-size: 13px; font-weight: 500; color: var(--text-2); cursor: pointer; padding: 4px 8px; }

/* ── circles-nav ── */
.circles-nav {
  height: 52px; background: var(--card); border-bottom: 1px solid var(--border);
  display: flex; align-items: center; padding: 0 14px; gap: 10px; flex-shrink: 0;
}
.circles-nav-title { font-size: 14px; font-weight: 700; color: var(--text); }
.circles-nav-sub { font-size: 11px; color: var(--text-3); }
.circles-nav-home { font-size: 12px; color: var(--primary); border-bottom: 1px solid var(--primary); background: none; border-top: none; border-left: none; border-right: none; padding: 2px 0; cursor: pointer; white-space: nowrap; flex-shrink: 0; margin-left: auto; }

/* ── progress ── */
.circles-progress {
  height: 36px; background: var(--card); border-bottom: 1px solid var(--border);
  display: flex; align-items: center; padding: 0 14px; gap: 3px; flex-shrink: 0;
}
.circles-progress-seg { flex: 1; height: 4px; background: #e8e5de; border-radius: 2px; }
.circles-progress-seg.done { background: var(--primary); }
.circles-progress-seg.active { background: rgba(26,86,219,0.4); }
.circles-progress-label { font-size: 10px; color: var(--text-3); white-space: nowrap; margin-left: 8px; }

/* ── scrollable body ── */
.scroll-body { flex: 1; overflow-y: auto; padding: 16px; scrollbar-width: none; }
.scroll-body::-webkit-scrollbar { display: none; }

/* ── submit bar ── */
.submit-bar {
  background: var(--card); border-top: 1px solid var(--border);
  padding: 12px 16px; display: flex; gap: 10px; flex-shrink: 0;
}
.btn-primary { flex: 1; background: var(--primary); color: #fff; border: none; border-radius: 10px; padding: 12px 16px; font-size: 14px; font-weight: 600; cursor: pointer; font-family: 'DM Sans', sans-serif; }
.btn-secondary { background: #f0ede6; color: var(--text); border: none; border-radius: 10px; padding: 12px 16px; font-size: 14px; font-weight: 600; cursor: pointer; white-space: nowrap; }
.btn-ghost-sm { background: none; color: var(--text-2); border: 1px solid var(--border); border-radius: 10px; padding: 12px 16px; font-size: 14px; font-weight: 600; cursor: pointer; white-space: nowrap; }

/* ── problem card ── */
.problem-card {
  background: var(--card); border-radius: 10px; border: 1px solid var(--border);
  padding: 12px 14px; font-size: 13px; color: var(--text-2); line-height: 1.6;
  margin-bottom: 14px;
}
.problem-card-label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: .07em; color: var(--text-3); margin-bottom: 4px; }

/* ── step pills ── */
.circles-step-pills { display: flex; gap: 6px; overflow-x: auto; margin-bottom: 14px; scrollbar-width: none; padding-bottom: 2px; }
.circles-step-pills::-webkit-scrollbar { display: none; }
.circles-step-pill { flex-shrink: 0; padding: 5px 12px; border-radius: 20px; border: 1px solid var(--border); background: var(--card); font-size: 11px; font-weight: 600; color: var(--text-3); cursor: pointer; white-space: nowrap; }
.circles-step-pill.active { background: var(--primary); color: #fff; border-color: var(--primary); }
.circles-step-pill.done { background: #e6f0e8; color: var(--success); border-color: #b8dbbf; }

/* ── field group ── */
.circles-field-group { margin-bottom: 16px; }
.circles-field-label-row { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 4px; }
.circles-field-label { font-size: 10px; color: var(--text-3); text-transform: uppercase; letter-spacing: .07em; font-weight: 700; }
.circles-hint-trigger { background: none; border: none; font-size: 11px; color: var(--primary); cursor: pointer; padding: 0; white-space: nowrap; }
/* Collapsible example */
.field-example-toggle { background: none; border: none; font-size: 10px; color: var(--text-3); cursor: pointer; padding: 0 0 5px; display: flex; align-items: center; gap: 3px; font-family: 'DM Sans', sans-serif; }
.field-example-body { display: none; font-size: 11px; color: var(--text-3); margin-bottom: 6px; line-height: 1.5; padding: 5px 8px; background: rgba(0,0,0,0.03); border-radius: 6px; }
.field-example-body.open { display: block; }
.circles-field-input { width: 100%; padding: 11px 13px; border-radius: 10px; border: 1.5px solid var(--border); background: var(--card); font-size: 13px; font-family: 'DM Sans', sans-serif; color: var(--text); resize: none; outline: none; line-height: 1.5; }
.circles-field-input:focus { border-color: var(--primary); }
.circles-field-input.filled { border-color: rgba(26,86,219,0.3); background: #fbfaff; }

/* ── Gate ── */
.gate-pass-bar { background: var(--primary-lt); border: 1px solid #C5D5FF; border-radius: 10px; padding: 12px 14px; margin-bottom: 16px; display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.gate-pass-text { font-size: 12px; font-weight: 600; color: var(--primary); }
.gate-pass-sub { font-size: 11px; color: #5a7ab5; }
.gate-fail-bar { background: #FFF3F3; border: 1px solid #FFCDD2; border-radius: 10px; padding: 12px 14px; margin-bottom: 16px; font-size: 12px; color: var(--danger); }
.gate-card { background: var(--card); border-radius: 10px; border: 1.5px solid var(--border); padding: 12px 14px; margin-bottom: 10px; display: flex; gap: 10px; align-items: flex-start; }
.gate-card.ok { border-color: #b8dbbf; }
.gate-card.warn { border-color: #FFD54F; }
.gate-card.error { border-color: #f5c6c6; }
.gate-card-icon { font-size: 15px; flex-shrink: 0; margin-top: 1px; }
.gate-card-field { font-size: 9px; text-transform: uppercase; letter-spacing: .05em; color: var(--text-3); margin-bottom: 2px; }
.gate-card-title { font-size: 13px; font-weight: 700; color: var(--text); margin-bottom: 3px; }
.gate-card-reason { font-size: 12px; color: var(--text-2); line-height: 1.5; }
.gate-card-suggestion { font-size: 11px; color: var(--warning); margin-top: 4px; }

/* ── Phase 2 chat ── */
.chat-wrap { display: flex; flex-direction: column; height: 100vh; overflow: hidden; }
.chat-pinned { background: var(--card); border-bottom: 1px solid var(--border); padding: 8px 14px; flex-shrink: 0; }
.pinned-co { font-size: 10px; color: var(--primary); font-weight: 600; text-transform: uppercase; letter-spacing: .05em; margin-bottom: 1px; }
.pinned-stmt { font-size: 11px; color: var(--text); font-weight: 600; line-height: 1.4; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.chat-body { flex: 1; overflow-y: auto; padding: 14px 16px; scrollbar-width: none; }
.chat-body::-webkit-scrollbar { display: none; }
.bubble-user {
  background: var(--card); border: 1px solid var(--border);
  border-radius: 12px 4px 12px 12px; padding: 10px 13px;
  font-size: 13px; line-height: 1.6; color: var(--text);
  margin-bottom: 10px; max-width: 88%; margin-left: auto;
}
.bubble-ai {
  background: var(--primary-lt); border: 1px solid rgba(26,86,219,0.18);
  border-radius: 4px 12px 12px 12px; padding: 10px 13px;
  font-size: 13px; line-height: 1.6; color: var(--text);
  margin-bottom: 10px; max-width: 88%;
}
.bubble-section { font-size: 10px; font-weight: 700; color: var(--text-3); text-transform: uppercase; letter-spacing: .07em; margin-bottom: 3px; }
.bubble-coaching { background: rgba(0,0,0,0.03); border: 1px solid var(--border); border-radius: 4px 12px 12px 12px; padding: 10px 13px; font-size: 12px; line-height: 1.6; color: var(--text); margin-bottom: 10px; max-width: 88%; }
.hint-toggle { background: none; border: none; font-size: 11px; color: var(--text-3); cursor: pointer; padding: 0; display: flex; align-items: center; gap: 3px; margin-top: 6px; }
.hint-body { display: none; margin-top: 4px; padding: 6px 8px; background: rgba(0,0,0,0.04); border-radius: 6px; color: var(--text-2); font-size: 11px; line-height: 1.5; }
.chat-input-bar { background: var(--card); border-top: 1px solid var(--border); padding: 10px 14px; display: flex; gap: 8px; align-items: flex-end; flex-shrink: 0; }
.chat-icebreaker { background: rgba(26,86,219,0.05); border: 1px solid rgba(26,86,219,0.18); border-radius: 10px; padding: 10px 13px; margin-bottom: 14px; }
.chat-icebreaker-label { font-size: 9px; font-weight: 700; color: var(--primary); text-transform: uppercase; letter-spacing: .07em; margin-bottom: 5px; display: flex; align-items: center; gap: 4px; }
.chat-icebreaker-text { font-size: 12px; color: var(--text-2); line-height: 1.65; }
.chat-input { flex: 1; background: #f5f5f5; border: 1px solid var(--border); border-radius: 10px; padding: 9px 13px; font-size: 14px; color: var(--text); font-family: 'DM Sans', sans-serif; resize: none; outline: none; min-height: 40px; }
.chat-send-btn { width: 40px; height: 40px; border-radius: 10px; background: var(--primary); border: none; color: #fff; font-size: 16px; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.chat-submit-row { padding: 6px 12px 10px; display: flex; justify-content: center; background: var(--card); flex-shrink: 0; border-top: 1px solid var(--border); }
.chat-submit-btn { font-size: 11px; color: var(--text-2); border: 1px solid var(--border); border-radius: 8px; padding: 6px 16px; cursor: pointer; background: var(--card); }

/* ── Conclusion box ── */
.conclusion-box { border-top: 2px solid var(--primary); background: var(--card); padding: 14px; flex-shrink: 0; max-height: 55vh; overflow-y: auto; }
.conclusion-title { font-size: 11px; font-weight: 700; color: var(--text); margin-bottom: 2px; }
.conclusion-sub { font-size: 10px; color: var(--text-3); margin-bottom: 8px; }
.conclusion-textarea { width: 100%; border: 1px solid #ddd; border-radius: 8px; padding: 9px; font-size: 11px; line-height: 1.6; resize: none; height: 60px; box-sizing: border-box; font-family: 'DM Sans', sans-serif; color: var(--text); outline: none; }
.conclusion-hint { min-height: 16px; font-size: 10px; color: var(--text-3); margin-top: 6px; }
.conclusion-hint.pass { background: #E8F5E9; color: var(--success); border-radius: 4px; padding: 4px 8px; }
.conclusion-hint.warn { background: #FFF8E1; color: #7A5800; border-radius: 4px; padding: 4px 8px; }
.conclusion-actions { margin-top: 8px; display: flex; align-items: center; justify-content: space-between; }
.conclusion-back-btn { font-size: 10px; color: var(--text-3); background: none; border: none; cursor: pointer; }
.conclusion-submit-btn { background: var(--primary); color: #fff; border: none; border-radius: 8px; padding: 8px 14px; font-size: 12px; font-weight: 600; cursor: pointer; }
.conclusion-submit-btn.disabled { opacity: .4; cursor: not-allowed; }

/* ── Step Score ── */
.score-total { background: var(--card); border-radius: 16px; border: 1px solid var(--border); padding: 20px; text-align: center; margin-bottom: 14px; }
.score-number { font-family: 'Georgia', serif; font-size: 60px; color: var(--primary); line-height: 1; margin-bottom: 4px; font-weight: 400; }
.score-sub { font-size: 13px; color: var(--text-2); }
.score-breakdown { background: var(--card); border-radius: 12px; border: 1px solid var(--border); padding: 14px; margin-bottom: 14px; }
.dim-row { display: flex; align-items: center; gap: 10px; padding: 9px 0; border-bottom: 1px solid var(--border); font-size: 12px; }
.dim-row:last-child { border-bottom: none; }
.dim-text { flex: 1; min-width: 0; }
.dim-name { font-size: 12px; color: var(--text-2); }
.dim-comment { font-size: 10px; color: var(--text-3); margin-top: 1px; line-height: 1.4; }
.dim-bar-wrap { width: 70px; height: 5px; background: #f0ede6; border-radius: 3px; flex-shrink: 0; }
.dim-bar { height: 100%; border-radius: 3px; background: var(--primary); }
.dim-score { font-weight: 700; color: var(--text); min-width: 24px; text-align: right; font-size: 12px; }
.dim-score span { font-size: 9px; color: var(--text-3); }
.highlight-card { border-radius: 10px; border: 1.5px solid; padding: 12px 14px; margin-bottom: 10px; }
.highlight-card.good { background: #F0FFF4; border-color: #BBF7D0; }
.highlight-card.improve { background: #FFFBEB; border-color: #FDE68A; }
.highlight-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; margin-bottom: 4px; }
.highlight-card.good .highlight-label { color: var(--success); }
.highlight-card.improve .highlight-label { color: var(--warning); }
.highlight-text { font-size: 13px; color: var(--text); line-height: 1.5; }
.coach-toggle { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 14px; margin-bottom: 14px; cursor: pointer; }
.coach-toggle-label { font-size: 12px; font-weight: 700; color: var(--text-2); display: flex; align-items: center; justify-content: space-between; }
.coach-content { font-size: 12px; color: var(--text-2); line-height: 1.7; margin-top: 10px; display: none; }
.coach-content.open { display: block; }

/* Score nav arrows */
.score-nav { display: flex; gap: 2px; margin-left: auto; }
.score-nav-btn { background: none; border: 1px solid var(--border); border-radius: 6px; padding: 4px 8px; font-size: 12px; cursor: pointer; color: var(--text-2); }
.score-nav-btn:disabled { opacity: 0.3; cursor: default; }

/* ── Hint overlay ── */
.hint-overlay {
  position: absolute; inset: 0; background: rgba(0,0,0,0.45);
  z-index: 200; display: none; align-items: center; justify-content: center; padding: 24px;
}
.hint-overlay.visible { display: flex; }
.hint-card { background: #fff; border-radius: 16px; padding: 20px; max-width: 340px; width: 100%; box-shadow: 0 8px 40px rgba(0,0,0,0.18); position: relative; }
.hint-card-title { font-size: 13px; font-weight: 700; color: var(--primary); margin-bottom: 2px; }
.hint-card-sub { font-size: 11px; color: #8a8a8a; margin-bottom: 12px; }
.hint-card-body { font-size: 13px; color: var(--text); line-height: 1.7; background: #F6F8FF; border-left: 3px solid var(--primary); padding: 12px; border-radius: 0 8px 8px 0; }
.hint-card-footer { font-size: 11px; color: #aaa; text-align: center; margin-top: 12px; }
.hint-close { position: absolute; top: 12px; right: 14px; background: none; border: none; font-size: 20px; color: #aaa; cursor: pointer; line-height: 1; padding: 0; }
</style>
</head>
<body>

<!-- Top nav -->
<div class="top-nav">
  <span class="nav-label active" onclick="show('p1-drill')">P1 加練</span>
  <span class="nav-label" onclick="show('p1-hint')">P1+提示</span>
  <span class="nav-label" onclick="show('gate-pass')">Gate ✓</span>
  <span class="nav-label" onclick="show('gate-fail')">Gate ✗</span>
  <span class="nav-label" onclick="show('p2-early')">P2 早期</span>
  <span class="nav-label" onclick="show('p2-late')">P2 收斂</span>
  <span class="nav-label" onclick="show('p2-conclude')">P2 結論</span>
  <span class="nav-label" onclick="show('p3-r')">P3 R評分</span>
  <span class="nav-label" onclick="show('p3-c1')">P3 C評分</span>
</div>

<div class="wrapper">
<div class="shell">

<!-- ════════════════════════════════════════════
     SCREEN: Phase 1 — R step (Drill mode)
════════════════════════════════════════════ -->
<div id="screen-p1-drill" class="screen active" style="position:relative">
  <div class="circles-nav">
    <button class="btn-icon"><i class="ph ph-arrow-left"></i></button>
    <div>
      <div class="circles-nav-title">R — 發掘需求</div>
      <div class="circles-nav-sub">Meta · News Feed</div>
    </div>
    <button class="circles-nav-home">回首頁</button>
  </div>
  <div class="circles-progress">
    <div class="circles-progress-seg done"></div>
    <div class="circles-progress-seg done"></div>
    <div class="circles-progress-seg active"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-label">R · 發掘需求 · 3/7</div>
  </div>
  <div class="scroll-body">
    <div class="problem-card">
      <div class="problem-card-label">練習題目</div>
      用戶反映 News Feed 廣告過多，如何改善廣告體驗並維持 Meta 的廣告收入？
    </div>
    <div class="circles-step-pills">
      <span class="circles-step-pill done">C 澄清情境</span>
      <span class="circles-step-pill done">I 定義用戶</span>
      <span class="circles-step-pill active">R 發掘需求</span>
      <span class="circles-step-pill">C 優先排序</span>
      <span class="circles-step-pill">L 提出方案</span>
      <span class="circles-step-pill">E 評估取捨</span>
      <span class="circles-step-pill">S 總結推薦</span>
    </div>

    <!-- 功能性需求 -->
    <div class="circles-field-group">
      <div class="circles-field-label-row">
        <div class="circles-field-label">功能性需求</div>
        <button class="circles-hint-trigger" onclick="showHint('功能性需求','想想這位「習慣型用戶」打開 News Feed 要完成的任務。功能性需求是「做到什麼」——他需要什麼功能才能完成這個任務？從他每天打開 App 的那個行為出發，往前推：他想過濾什麼？想找到什麼？這個答案會決定後續核心痛點的定義方向。')">💡 提示</button>
      </div>
      <button class="field-example-toggle" onclick="toggleExample(this)">
        <i class="ph ph-caret-right" style="font-size:9px"></i> 查看範例
      </button>
      <div class="field-example-body">例：快速判斷貼文價值、過濾低品質內容、控制看到哪些類型的貼文</div>
      <textarea class="circles-field-input" rows="2" placeholder="填寫你的分析..."></textarea>
    </div>

    <!-- 情感性需求 -->
    <div class="circles-field-group">
      <div class="circles-field-label-row">
        <div class="circles-field-label">情感性需求</div>
        <button class="circles-hint-trigger" onclick="showHint('情感性需求','情感性需求不是功能，是用戶使用產品時的「感受」。這位用戶打開 Facebook 時想要什麼感覺？他不想有什麼感覺？注意：「想看好內容」是功能需求，不是情感需求——情感需求應該描述感受層，例如焦慮、歸屬感、成就感。即使是 SaaS 或工具性產品，也一定有情感需求。')">💡 提示</button>
      </div>
      <button class="field-example-toggle" onclick="toggleExample(this)">
        <i class="ph ph-caret-right" style="font-size:9px"></i> 查看範例
      </button>
      <div class="field-example-body">例：不想因漏看重要動態而焦慮、希望打開 App 有收穫感而非空虛</div>
      <textarea class="circles-field-input" rows="2" placeholder="填寫你的分析..."></textarea>
    </div>

    <!-- 社交性需求 -->
    <div class="circles-field-group">
      <div class="circles-field-label-row">
        <div class="circles-field-label">社交性需求</div>
        <button class="circles-hint-trigger" onclick="showHint('社交性需求','社交性需求是用戶在人際關係中需要什麼。這位用戶如何透過 News Feed 維持社交關係？他想對哪些人的動態有所回應？想在什麼樣的社群中保有存在感？B2B SaaS 也有社交需求——例如與團隊共享成果、讓主管看到你的工作進度。')">💡 提示</button>
      </div>
      <button class="field-example-toggle" onclick="toggleExample(this)">
        <i class="ph ph-caret-right" style="font-size:9px"></i> 查看範例
      </button>
      <div class="field-example-body">例：維持與遠距朋友和家人的弱連結、對重要時刻（婚禮、升學）及時回應</div>
      <textarea class="circles-field-input" rows="2" placeholder="填寫你的分析..."></textarea>
    </div>

    <!-- 核心痛點 -->
    <div class="circles-field-group">
      <div class="circles-field-label-row">
        <div class="circles-field-label">核心痛點</div>
        <button class="circles-hint-trigger" onclick="showHint('核心痛點','核心痛點是上面三層需求中「最根本的一個沒被滿足」的需求。你要選出一個，說明它是功能層、情感層還是社交層的痛點，並說清楚為什麼它是「核心」。這個優先判斷會直接影響後續 C 步驟的取捨標準——所以這欄要有你的立場，不只是列舉。')">💡 提示</button>
      </div>
      <button class="field-example-toggle" onclick="toggleExample(this)">
        <i class="ph ph-caret-right" style="font-size:9px"></i> 查看範例
      </button>
      <div class="field-example-body">例：打開 App 後滑了 10 分鐘卻沒有任何有意義的互動，長期降低對 Facebook 的預期</div>
      <textarea class="circles-field-input" rows="2" placeholder="填寫你的分析..."></textarea>
    </div>
  </div>
  <div class="submit-bar">
    <button class="btn-secondary">返回選題</button>
    <button class="btn-primary" onclick="show('gate-pass')">提交框架 → AI 審核</button>
  </div>
  <!-- Hint overlay -->
  <div class="hint-overlay" id="hint-overlay" onclick="closeHint(event)">
    <div class="hint-card">
      <button class="hint-close" onclick="closeHint()">×</button>
      <div class="hint-card-title" id="hint-title">💡 功能性需求 — 分析思路</div>
      <div class="hint-card-sub">Meta · News Feed · R 發掘需求</div>
      <div class="hint-card-body" id="hint-body">載入中…</div>
      <div class="hint-card-footer">閱讀後關閉，自行填寫你的分析</div>
    </div>
  </div>
</div>

<!-- ════════════════════════════════════════════
     SCREEN: Phase 1 — hint overlay (filled example)
════════════════════════════════════════════ -->
<div id="screen-p1-hint" class="screen" style="position:relative">
  <div class="circles-nav">
    <button class="btn-icon"><i class="ph ph-arrow-left"></i></button>
    <div>
      <div class="circles-nav-title">R — 發掘需求</div>
      <div class="circles-nav-sub">Meta · News Feed</div>
    </div>
    <button class="circles-nav-home">回首頁</button>
  </div>
  <div class="circles-progress">
    <div class="circles-progress-seg done"></div>
    <div class="circles-progress-seg done"></div>
    <div class="circles-progress-seg active"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-label">R · 發掘需求 · 3/7</div>
  </div>
  <div class="scroll-body" style="filter:blur(1px);pointer-events:none">
    <div class="problem-card">用戶反映 News Feed 廣告過多，如何改善廣告體驗並維持 Meta 的廣告收入？</div>
    <div class="circles-step-pills">
      <span class="circles-step-pill done">C 澄清情境</span>
      <span class="circles-step-pill done">I 定義用戶</span>
      <span class="circles-step-pill active">R 發掘需求</span>
      <span class="circles-step-pill">C 優先排序</span>
      <span class="circles-step-pill">L 提出方案</span>
      <span class="circles-step-pill">E 評估取捨</span>
      <span class="circles-step-pill">S 總結推薦</span>
    </div>
    <div class="circles-field-group">
      <div class="circles-field-label-row"><div class="circles-field-label">功能性需求</div></div>
      <textarea class="circles-field-input filled" rows="2">用戶需要快速判斷哪些貼文值得花時間，並過濾掉無關的陌生人貼文和廣告</textarea>
    </div>
    <div class="circles-field-group">
      <div class="circles-field-label-row"><div class="circles-field-label">情感性需求</div></div>
      <textarea class="circles-field-input" rows="2" placeholder="填寫你的分析..."></textarea>
    </div>
  </div>
  <!-- Hint overlay — visible -->
  <div class="hint-overlay visible">
    <div class="hint-card">
      <button class="hint-close" onclick="show('p1-drill')">×</button>
      <div class="hint-card-title">💡 情感性需求 — 分析思路</div>
      <div class="hint-card-sub">Meta · News Feed · R 發掘需求</div>
      <div class="hint-card-body">情感性需求不是功能，是用戶使用產品時的「感受」。這位習慣型用戶每天打開 News Feed，不只是要看內容——他想要的是一種「沒有脫節」的安心感。試著問：如果今天他打開 App 後漏看了大學同學的婚禮宣布，他會有什麼感受？這個感受才是情感需求的核心，而不是「想看好內容」。</div>
      <div class="hint-card-footer">閱讀後關閉，自行填寫你的分析</div>
    </div>
  </div>
</div>

<!-- ════════════════════════════════════════════
     SCREEN: Gate — Pass
════════════════════════════════════════════ -->
<div id="screen-gate-pass" class="screen" style="position:relative">
  <div class="circles-nav">
    <button class="btn-icon" onclick="show('p1-drill')"><i class="ph ph-arrow-left"></i></button>
    <div>
      <div class="circles-nav-title">框架審核結果</div>
      <div class="circles-nav-sub">R · 發掘需求 · Meta</div>
    </div>
    <button class="circles-nav-home">回首頁</button>
  </div>
  <div class="circles-progress">
    <div class="circles-progress-seg done"></div>
    <div class="circles-progress-seg done"></div>
    <div class="circles-progress-seg done"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-label">R · 發掘需求</div>
  </div>
  <div class="scroll-body">
    <div class="gate-pass-bar">
      <div>
        <div class="gate-pass-text">框架審核通過</div>
        <div class="gate-pass-sub">框架方向正確，進入對話練習階段繼續探索。</div>
      </div>
    </div>
    <div class="gate-card ok">
      <div class="gate-card-icon" style="color:#137A3D"><i class="ph ph-check-circle"></i></div>
      <div>
        <div class="gate-card-field">功能性需求</div>
        <div class="gate-card-title">篩選與控制需求清楚</div>
        <div class="gate-card-reason">明確列出判斷、過濾、控制三個層次的功能需求，方向正確</div>
      </div>
    </div>
    <div class="gate-card warn">
      <div class="gate-card-icon" style="color:#B85C00"><i class="ph ph-warning"></i></div>
      <div>
        <div class="gate-card-field">情感性需求</div>
        <div class="gate-card-title">情感動機可以再深一層</div>
        <div class="gate-card-reason">「感覺有收穫」是表層描述，可嘗試挖到更深的情感動機</div>
        <div class="gate-card-suggestion">建議補充：說明「有收穫感」背後的深層情感，例如歸屬感或焦慮的消解</div>
      </div>
    </div>
    <div class="gate-card ok">
      <div class="gate-card-icon" style="color:#137A3D"><i class="ph ph-check-circle"></i></div>
      <div>
        <div class="gate-card-field">社交性需求</div>
        <div class="gate-card-title">弱連結維持需求具體</div>
        <div class="gate-card-reason">「維持弱連結」和「重要時刻回應」符合這個用戶族群的社交動機</div>
      </div>
    </div>
    <div class="gate-card ok">
      <div class="gate-card-icon" style="color:#137A3D"><i class="ph ph-check-circle"></i></div>
      <div>
        <div class="gate-card-field">核心痛點</div>
        <div class="gate-card-title">痛點與需求連結清楚</div>
        <div class="gate-card-reason">「無效瀏覽導致降低預期」直接對應了功能性需求的篩選缺失</div>
      </div>
    </div>
  </div>
  <div class="submit-bar">
    <button class="btn-ghost-sm" onclick="show('p1-drill')">重新編輯</button>
    <button class="btn-primary" onclick="show('p2-early')">進入對話練習 →</button>
  </div>
</div>

<!-- ════════════════════════════════════════════
     SCREEN: Gate — Fail (drill mode, error blocks)
════════════════════════════════════════════ -->
<div id="screen-gate-fail" class="screen" style="position:relative">
  <div class="circles-nav">
    <button class="btn-icon" onclick="show('p1-drill')"><i class="ph ph-arrow-left"></i></button>
    <div>
      <div class="circles-nav-title">框架審核結果</div>
      <div class="circles-nav-sub">R · 發掘需求 · Meta</div>
    </div>
    <button class="circles-nav-home">回首頁</button>
  </div>
  <div class="circles-progress">
    <div class="circles-progress-seg done"></div>
    <div class="circles-progress-seg done"></div>
    <div class="circles-progress-seg done"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-label">R · 發掘需求</div>
  </div>
  <div class="scroll-body">
    <div class="gate-fail-bar">框架有方向性錯誤，請修正後再提交（步驟加練模式）</div>
    <div class="gate-card ok">
      <div class="gate-card-icon" style="color:#137A3D"><i class="ph ph-check-circle"></i></div>
      <div>
        <div class="gate-card-field">功能性需求</div>
        <div class="gate-card-title">篩選與控制方向正確</div>
        <div class="gate-card-reason">功能需求列舉清楚，符合這個步驟的分析邏輯</div>
      </div>
    </div>
    <div class="gate-card error">
      <div class="gate-card-icon" style="color:#D92020"><i class="ph ph-x-circle"></i></div>
      <div>
        <div class="gate-card-field">情感性需求</div>
        <div class="gate-card-title">情感需求停在功能層</div>
        <div class="gate-card-reason">「想看好內容」是功能需求，不是情感性需求——情感需求應描述「感受」而非「行為目標」</div>
        <div class="gate-card-suggestion">建議改為：「害怕錯過朋友重要動態的焦慮感」或「渴望歸屬感」等情感層描述</div>
      </div>
    </div>
    <div class="gate-card ok">
      <div class="gate-card-icon" style="color:#137A3D"><i class="ph ph-check-circle"></i></div>
      <div>
        <div class="gate-card-field">社交性需求</div>
        <div class="gate-card-title">社交維繫方向正確</div>
        <div class="gate-card-reason">提到維持弱連結和及時回應，符合社交需求的層次</div>
      </div>
    </div>
    <div class="gate-card warn">
      <div class="gate-card-icon" style="color:#B85C00"><i class="ph ph-warning"></i></div>
      <div>
        <div class="gate-card-field">核心痛點</div>
        <div class="gate-card-title">痛點層次未說明</div>
        <div class="gate-card-reason">痛點正確但未說明是功能/情感/社交哪一層的需求未被滿足</div>
        <div class="gate-card-suggestion">補充說明：這個痛點屬於哪一層，以及為何它是最核心的</div>
      </div>
    </div>
  </div>
  <div class="submit-bar">
    <button class="btn-primary" onclick="show('p1-drill')">修正框架後重試</button>
  </div>
</div>

<!-- ════════════════════════════════════════════
     SCREEN: Phase 2 — Early turns (< 3)
════════════════════════════════════════════ -->
<div id="screen-p2-early" class="screen chat-wrap">
  <div class="circles-nav">
    <button class="btn-icon" onclick="show('gate-pass')"><i class="ph ph-arrow-left"></i></button>
    <div>
      <div class="circles-nav-title">R — 對話練習</div>
      <div class="circles-nav-sub">Meta · News Feed</div>
    </div>
    <button class="circles-nav-home">回首頁</button>
  </div>
  <div class="circles-progress">
    <div class="circles-progress-seg done"></div>
    <div class="circles-progress-seg done"></div>
    <div class="circles-progress-seg active"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-label">R · 發掘需求 · 3/7</div>
  </div>
  <div class="chat-pinned">
    <div class="pinned-co">Meta — 發掘需求</div>
    <div class="pinned-stmt">用戶反映 News Feed 廣告過多，如何改善廣告體驗…</div>
  </div>
  <div class="chat-body">
    <div class="chat-icebreaker">
      <div class="chat-icebreaker-label"><i class="ph ph-compass"></i> 開始提問方向</div>
      <div class="chat-icebreaker-text">問被訪談者這些習慣型用戶每天打開 News Feed 時，最常做的事情是什麼——從使用行為出發，逐步挖到功能、情感、社交三層需求。</div>
    </div>
    <div class="bubble-user">你們的習慣型用戶每天打開 News Feed 時，最常做的事情是什麼？</div>
    <div class="bubble-ai">
      <div class="bubble-section">被訪談者</div>
      嗯，大部分人是滑一滑、看看有什麼新鮮事吧。有時候會對貼文按個讚，或者看到朋友的照片留個言。不過說實話，很多人打開來滑一滑，也說不清楚自己在幹嘛。
    </div>
    <div class="bubble-coaching" style="font-size:12px">
      <div class="bubble-section">教練點評</div>
      問出了基本使用行為，但還停在表面。「說不清楚自己在幹嘛」這句話很有趣，可以順著這個方向繼續挖。
      <button class="hint-toggle" onclick="toggleHint(this)"><i class="ph ph-caret-right" style="font-size:10px"></i> 查看教練提示</button>
      <div class="hint-body">試試問：「這些用戶打開 App 之前，他們預期會看到什麼？結果看到的是什麼？」</div>
    </div>
    <div class="bubble-user">這些用戶打開 App 的時候，他們希望看到什麼？實際上看到的是什麼？</div>
    <div class="bubble-ai">
      <div class="bubble-section">被訪談者</div>
      我想他們是想知道朋友最近在幹嘛，有沒有什麼重要的事情發生。但實際上他們看到的，很大比例是廣告、粉絲頁的影片、還有完全不認識的人分享的東西。這個落差，確實是大家抱怨比較多的地方。
    </div>
    <div class="bubble-coaching" style="font-size:12px">
      <div class="bubble-section">教練點評</div>
      很好，你挖到了「預期與現實的落差」——這是功能性需求沒有被滿足的核心。繼續往情感層問，問問這個落差對用戶有什麼感受。
      <button class="hint-toggle" onclick="toggleHint(this)"><i class="ph ph-caret-right" style="font-size:10px"></i> 查看教練提示</button>
      <div class="hint-body">問：「這個落差對用戶有什麼影響？他們打完 App 後是什麼感覺？」</div>
    </div>
    <div style="height:8px"></div>
    <div style="text-align:center;font-size:11px;color:var(--text-3);padding:4px 0">再對話 1 輪，可提交步驟</div>
  </div>
  <div class="chat-input-bar">
    <textarea class="chat-input" rows="1" placeholder="問被訪談者一個問題…"></textarea>
    <button class="chat-send-btn"><i class="ph ph-paper-plane-tilt"></i></button>
  </div>
</div>

<!-- ════════════════════════════════════════════
     SCREEN: Phase 2 — ≥3 turns, submit row (收斂)
════════════════════════════════════════════ -->
<div id="screen-p2-late" class="screen chat-wrap">
  <div class="circles-nav">
    <button class="btn-icon" onclick="show('p2-early')"><i class="ph ph-arrow-left"></i></button>
    <div>
      <div class="circles-nav-title">R — 對話練習</div>
      <div class="circles-nav-sub">Meta · News Feed</div>
    </div>
    <button class="circles-nav-home">回首頁</button>
  </div>
  <div class="circles-progress">
    <div class="circles-progress-seg done"></div>
    <div class="circles-progress-seg done"></div>
    <div class="circles-progress-seg active"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-label">R · 發掘需求 · 3/7 · 4 輪</div>
  </div>
  <div class="chat-pinned">
    <div class="pinned-co">Meta — 發掘需求</div>
    <div class="pinned-stmt">用戶反映 News Feed 廣告過多，如何改善廣告體驗…</div>
  </div>
  <div class="chat-body">
    <div class="chat-icebreaker">
      <div class="chat-icebreaker-label"><i class="ph ph-compass"></i> 開始提問方向</div>
      <div class="chat-icebreaker-text">問被訪談者這些習慣型用戶每天打開 News Feed 時，最常做的事情是什麼——從使用行為出發，逐步挖到功能、情感、社交三層需求。</div>
    </div>
    <div class="bubble-user">這個落差對用戶有什麼影響？他們關掉 App 之後是什麼感覺？</div>
    <div class="bubble-ai">
      <div class="bubble-section">被訪談者</div>
      有一部分人說關掉之後覺得有點空、有點浪費時間的感覺。有些人甚至會覺得有點焦慮——不確定自己有沒有漏掉什麼重要的朋友動態。
    </div>
    <div class="bubble-coaching" style="font-size:12px">
      <div class="bubble-section">教練點評</div>
      很好，挖到了兩種情感——「空虛感」和「漏接焦慮」。這兩個都是情感性需求，繼續問哪一個更核心。
      <button class="hint-toggle" onclick="toggleHint(this)"><i class="ph ph-caret-right" style="font-size:10px"></i> 查看教練提示</button>
      <div class="hint-body">問：「這兩種感覺哪一個更常出現？有沒有具體例子？」</div>
    </div>
    <div class="bubble-user">這兩種感覺——空虛感和漏接焦慮——哪一個更普遍？你們有沒有具體案例？</div>
    <div class="bubble-ai">
      <div class="bubble-section">被訪談者</div>
      漏接焦慮我覺得更嚴重一點。有用戶說，同學結婚他後來才從別人口中知道——因為那則貼文被其他內容淹沒了，根本沒看到。這種錯誤不只讓他覺得難過，也讓他覺得「以後 Facebook 不可靠」。
    </div>
    <div class="bubble-coaching" style="font-size:12px">
      <div class="bubble-section">教練點評</div>
      這是社交需求和情感需求的交叉點——「維持重要關係的社交存在感」讓 Feed 的可信賴性變成核心痛點。
      <button class="hint-toggle" onclick="toggleHint(this)"><i class="ph ph-caret-right" style="font-size:10px"></i> 查看教練提示</button>
      <div class="hint-body">最後確認：「這個問題對你們的核心 KPI 有什麼影響？」然後可以收斂了。</div>
    </div>
    <div class="bubble-user">這個漏接焦慮問題，對你們的核心指標有影響嗎？</div>
    <div class="bubble-ai">
      <div class="bubble-section">被訪談者</div>
      有，我們看到這部分用戶的打開頻率在下降。他們不是刪 App，但打開次數越來越少——就是「預期管理壞了」。
    </div>
    <div class="bubble-coaching" style="font-size:12px">
      <div class="bubble-section">教練點評</div>
      到這裡三層需求都已完整探索，可以收斂提交了。功能層（篩選缺失）→ 情感層（漏接焦慮）→ 社交層（重要時刻維繫）都有觸及。
      <button class="hint-toggle" onclick="toggleHint(this)"><i class="ph ph-caret-right" style="font-size:10px"></i> 查看教練提示</button>
      <div class="hint-body">整理結論：三層需求各一句，然後說哪個是最核心的痛點及原因。</div>
    </div>
    <div style="height:4px"></div>
  </div>
  <div class="chat-input-bar">
    <textarea class="chat-input" rows="1" placeholder="繼續探索，或點下方提交…"></textarea>
    <button class="chat-send-btn"><i class="ph ph-paper-plane-tilt"></i></button>
  </div>
  <div class="chat-submit-row">
    <button class="chat-submit-btn" onclick="show('p2-conclude')">對話足夠了，提交這個步驟</button>
  </div>
</div>

<!-- ════════════════════════════════════════════
     SCREEN: Phase 2 — Conclusion box (expanded)
════════════════════════════════════════════ -->
<div id="screen-p2-conclude" class="screen chat-wrap">
  <div class="circles-nav">
    <button class="btn-icon" onclick="show('p2-late')"><i class="ph ph-arrow-left"></i></button>
    <div>
      <div class="circles-nav-title">R — 對話練習</div>
      <div class="circles-nav-sub">Meta · News Feed</div>
    </div>
    <button class="circles-nav-home">回首頁</button>
  </div>
  <div class="circles-progress">
    <div class="circles-progress-seg done"></div>
    <div class="circles-progress-seg done"></div>
    <div class="circles-progress-seg active"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-label">R · 發掘需求 · 3/7 · 4 輪</div>
  </div>
  <div class="chat-pinned">
    <div class="pinned-co">Meta — 發掘需求</div>
    <div class="pinned-stmt">用戶反映 News Feed 廣告過多，如何改善廣告體驗…</div>
  </div>
  <!-- 對話淡化 -->
  <div class="chat-body" style="opacity:0.45;pointer-events:none">
    <div class="bubble-user">這個落差對用戶有什麼影響？關掉 App 之後是什麼感覺？</div>
    <div class="bubble-ai"><div class="bubble-section">被訪談者</div>有點空、有點焦慮——不確定有沒有漏掉什麼重要動態。</div>
    <div class="bubble-user">漏接焦慮和空虛感，哪一個更普遍？有沒有具體案例？</div>
    <div class="bubble-ai"><div class="bubble-section">被訪談者</div>漏接焦慮更嚴重。有用戶因為漏看同學婚禮的貼文，覺得「Facebook 不可靠了」。</div>
    <div class="bubble-user">這個問題對你們的核心指標有影響嗎？</div>
    <div class="bubble-ai"><div class="bubble-section">被訪談者</div>有，那批用戶打開頻率在下降。預期管理壞了，留存率跟著跌。</div>
    <div style="text-align:center;padding:6px 0">
      <span style="font-size:11px;color:var(--text-3);background:#f0ede6;border-radius:20px;padding:3px 12px">4 輪對話完成</span>
    </div>
  </div>

  <!-- 結論框 -->
  <div class="conclusion-box">
    <div class="conclusion-title">整理你這個步驟確認了什麼</div>
    <div class="conclusion-sub">用 1-2 句話說明：三層需求各一句，並說明哪個是核心痛點</div>

    <!-- 折疊範例 -->
    <div style="border:1px solid var(--border);border-radius:8px;margin-bottom:8px;overflow:hidden">
      <div style="background:#f5f4f0;padding:5px 10px;display:flex;justify-content:space-between;cursor:pointer;align-items:center" onclick="var c=this.nextElementSibling;c.style.display=c.style.display==='none'?'block':'none';this.querySelector('span').textContent=c.style.display==='none'?'展開 ▾':'收起 ▴'">
        <span style="font-size:9px;font-weight:700;color:var(--text-3);text-transform:uppercase;letter-spacing:.4px">範例（不同題目）</span>
        <span style="font-size:10px;color:var(--text-3)">展開 ▾</span>
      </div>
      <div style="display:none;padding:8px 10px;font-size:11px;color:var(--text-2);line-height:1.6">
        Spotify 免費用戶的功能需求是「快速找到符合當下心情的音樂」；情感需求是「用音樂管理情緒狀態的掌控感」；社交需求是「分享歌單維持社交話題」。核心痛點：情感層的掌控感缺失最嚴重，直接影響留存。
      </div>
    </div>

    <textarea class="conclusion-textarea" id="conclude-text" rows="3" oninput="onConclude()" placeholder="針對這題，整理你確認的三層需求與核心痛點…" style="height:72px">功能需求：用戶需要 Feed 優先顯示緊密朋友動態，過濾無關內容。情感需求：核心是「漏接重要時刻的焦慮感」。社交需求：維持弱連結而不需主動管理。核心痛點（情感層）：演算法無法代替用戶判斷哪些關係更值得優先，導致焦慮感和留存下降。</textarea>
    <div class="conclusion-hint pass" id="conclude-hint">✓ 結論涵蓋三層需求並說明核心痛點，可以提交</div>
    <div class="conclusion-actions">
      <button class="conclusion-back-btn" onclick="show('p2-late')">← 繼續對話</button>
      <button class="conclusion-submit-btn" onclick="show('p3-r')">確認提交</button>
    </div>
  </div>
</div>

<!-- ════════════════════════════════════════════
     SCREEN: Phase 3 — Step Score (R step)
════════════════════════════════════════════ -->
<div id="screen-p3-r" class="screen" style="position:relative">
  <div class="circles-nav">
    <button class="btn-icon" onclick="show('p2-conclude')"><i class="ph ph-arrow-left"></i></button>
    <div>
      <div class="circles-nav-title">步驟評分 — 發掘需求</div>
      <div class="circles-nav-sub">Meta · News Feed</div>
    </div>
    <div class="score-nav">
      <button class="score-nav-btn" disabled><i class="ph ph-caret-left"></i></button>
      <button class="score-nav-btn" onclick="show('p3-c1')"><i class="ph ph-caret-right"></i></button>
    </div>
  </div>
  <div class="circles-progress">
    <div class="circles-progress-seg done"></div>
    <div class="circles-progress-seg done"></div>
    <div class="circles-progress-seg done"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-label">R · 評分 · 3/7</div>
  </div>
  <div class="scroll-body">
    <div class="score-total">
      <div class="score-number">73</div>
      <div class="score-sub">R — 發掘需求 步驟得分</div>
    </div>
    <div class="score-breakdown">
      <div class="dim-row">
        <div class="dim-text">
          <div class="dim-name">功能需求</div>
          <div class="dim-comment">清楚列出效率需求與過濾需求，三層對應完整</div>
        </div>
        <div class="dim-bar-wrap"><div class="dim-bar" style="width:80%"></div></div>
        <div class="dim-score">4<span>/5</span></div>
      </div>
      <div class="dim-row">
        <div class="dim-text">
          <div class="dim-name">情感/社交需求</div>
          <div class="dim-comment">挖到漏接焦慮，但社交動機深度（弱連結價值）不足</div>
        </div>
        <div class="dim-bar-wrap"><div class="dim-bar" style="width:70%"></div></div>
        <div class="dim-score">3.5<span>/5</span></div>
      </div>
      <div class="dim-row">
        <div class="dim-text">
          <div class="dim-name">痛點層次</div>
          <div class="dim-comment">痛點與功能需求對應清晰，成功連結三層需求</div>
        </div>
        <div class="dim-bar-wrap"><div class="dim-bar" style="width:80%"></div></div>
        <div class="dim-score">4<span>/5</span></div>
      </div>
      <div class="dim-row">
        <div class="dim-text">
          <div class="dim-name">需求優先說明</div>
          <div class="dim-comment">未清楚說明哪個需求最核心、為何優先處理</div>
        </div>
        <div class="dim-bar-wrap"><div class="dim-bar" style="width:60%"></div></div>
        <div class="dim-score">3<span>/5</span></div>
      </div>
    </div>
    <div class="highlight-card good">
      <div class="highlight-label">✦ 最強表現</div>
      <div class="highlight-text">成功從功能層挖到情感痛點「漏接焦慮」，三層需求串聯完整</div>
    </div>
    <div class="highlight-card improve">
      <div class="highlight-label">↑ 最需改進</div>
      <div class="highlight-text">未說明哪個需求是最優先處理的痛點及其理由</div>
    </div>
    <div class="coach-toggle" onclick="this.querySelector('.coach-content').classList.toggle('open');this.querySelector('i').className=this.querySelector('.coach-content').classList.contains('open')?'ph ph-caret-up':'ph ph-caret-down'">
      <div class="coach-toggle-label">教練示範答案 <i class="ph ph-caret-down"></i></div>
      <div class="coach-content">
        <div style="margin-bottom:6px"><strong style="color:var(--text)">功能性：</strong>用戶需要演算法優先展示「緊密連結朋友」的動態，過濾陌生粉絲頁內容。</div>
        <div style="margin-bottom:6px"><strong style="color:var(--text)">情感性：</strong>最核心的情感需求是「避免錯過重要社交時刻的焦慮」，這個焦慮直接影響留存率。</div>
        <div style="margin-bottom:6px"><strong style="color:var(--text)">社交性：</strong>用戶需要被動維持弱連結，關鍵是不需要主動管理優先序。</div>
        <div><strong style="color:var(--text)">核心痛點（優先）：</strong>情感層的焦慮痛點優先，因為它直接觸發打開頻率下降。</div>
      </div>
    </div>
  </div>
  <div class="submit-bar">
    <button class="btn-secondary">回首頁</button>
    <button class="btn-primary">繼續下一步：C 優先排序 →</button>
  </div>
</div>

<!-- ════════════════════════════════════════════
     SCREEN: Phase 3 — C1 Score (simulation browsing)
════════════════════════════════════════════ -->
<div id="screen-p3-c1" class="screen" style="position:relative">
  <div class="circles-nav">
    <button class="btn-icon" onclick="show('p3-r')"><i class="ph ph-arrow-left"></i></button>
    <div>
      <div class="circles-nav-title">步驟評分 — 澄清情境</div>
      <div class="circles-nav-sub">Meta · News Feed</div>
    </div>
    <!-- C1 是第一步，◀ disabled -->
    <div class="score-nav">
      <button class="score-nav-btn" disabled><i class="ph ph-caret-left"></i></button>
      <button class="score-nav-btn" onclick="show('p3-r')"><i class="ph ph-caret-right"></i></button>
    </div>
  </div>
  <div class="circles-progress">
    <div class="circles-progress-seg done"></div>
    <div class="circles-progress-seg done"></div>
    <div class="circles-progress-seg done"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-label">C · 評分 · 1/7</div>
  </div>
  <div class="scroll-body">
    <div class="score-total">
      <div class="score-number">72</div>
      <div class="score-sub">C — 澄清情境 步驟得分</div>
    </div>
    <div class="score-breakdown">
      <div class="dim-row">
        <div class="dim-text">
          <div class="dim-name">問題邊界清晰度</div>
          <div class="dim-comment">確認了廣告頻率問題，但未區分相關性與格式</div>
        </div>
        <div class="dim-bar-wrap"><div class="dim-bar" style="width:70%"></div></div>
        <div class="dim-score">3.5<span>/5</span></div>
      </div>
      <div class="dim-row">
        <div class="dim-text">
          <div class="dim-name">業務影響連結</div>
          <div class="dim-comment">提到廣告收入保護，但未量化約束條件</div>
        </div>
        <div class="dim-bar-wrap"><div class="dim-bar" style="width:60%"></div></div>
        <div class="dim-score">3<span>/5</span></div>
      </div>
      <div class="dim-row">
        <div class="dim-text">
          <div class="dim-name">時間範圍合理性</div>
          <div class="dim-comment">設定 90 天合理，符合廣告收入指標週期</div>
        </div>
        <div class="dim-bar-wrap"><div class="dim-bar" style="width:80%"></div></div>
        <div class="dim-score">4<span>/5</span></div>
      </div>
      <div class="dim-row">
        <div class="dim-text">
          <div class="dim-name">假設排除完整性</div>
          <div class="dim-comment">排除技術限制，但未說明競品對比的假設</div>
        </div>
        <div class="dim-bar-wrap"><div class="dim-bar" style="width:50%"></div></div>
        <div class="dim-score">2.5<span>/5</span></div>
      </div>
    </div>
    <div class="highlight-card good">
      <div class="highlight-label">✦ 最強表現</div>
      <div class="highlight-text">清楚說明「廣告收入保護」是這題的硬性約束</div>
    </div>
    <div class="highlight-card improve">
      <div class="highlight-label">↑ 最需改進</div>
      <div class="highlight-text">假設確認太少，未涵蓋競品和用戶行為假設</div>
    </div>
    <div class="coach-toggle" onclick="this.querySelector('.coach-content').classList.toggle('open');this.querySelector('i').className=this.querySelector('.coach-content').classList.contains('open')?'ph ph-caret-up':'ph ph-caret-down'">
      <div class="coach-toggle-label">教練示範答案 <i class="ph ph-caret-down"></i></div>
      <div class="coach-content">
        <div style="margin-bottom:6px"><strong style="color:var(--text)">問題範圍：</strong>廣告頻率 vs 相關性 vs 格式是三個不同問題，應先確認是哪一個。</div>
        <div style="margin-bottom:6px"><strong style="color:var(--text)">業務影響：</strong>Meta 廣告收入 = 曝光量 × 點擊率，改善相關性可提升點擊率但可能減少曝光量，需明確哪個指標優先。</div>
        <div style="margin-bottom:6px"><strong style="color:var(--text)">時間：</strong>90 天符合廣告季度節奏。</div>
        <div><strong style="color:var(--text)">假設：</strong>應確認「用戶是否願意為相關性損失部分隱私資料」。</div>
      </div>
    </div>
  </div>
  <div class="submit-bar">
    <button class="btn-secondary">回首頁</button>
    <button class="btn-primary">繼續下一步：C 優先排序 →</button>
  </div>
</div>

</div><!-- shell -->
</div><!-- wrapper -->

<script>
function show(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-' + id).classList.add('active');
  document.querySelectorAll('.nav-label').forEach(b => b.classList.remove('active'));
  var map = {'p1-drill':0,'p1-hint':1,'gate-pass':2,'gate-fail':3,'p2-early':4,'p2-late':5,'p2-conclude':6,'p3-r':7,'p3-c1':8};
  if (map[id] !== undefined) document.querySelectorAll('.nav-label')[map[id]].classList.add('active');
}
function showHint(field, body) {
  document.getElementById('hint-title').textContent = '💡 ' + field + ' — 分析思路';
  document.getElementById('hint-body').textContent = body;
  document.getElementById('hint-overlay').classList.add('visible');
}
function closeHint(e) {
  if (!e || e.target === document.getElementById('hint-overlay')) {
    document.getElementById('hint-overlay').classList.remove('visible');
  }
}
function toggleHint(btn) {
  var body = btn.nextElementSibling;
  var shown = body.style.display === 'block';
  body.style.display = shown ? 'none' : 'block';
  btn.querySelector('i').className = shown ? 'ph ph-caret-right' : 'ph ph-caret-down';
  btn.style.color = shown ? 'var(--text-3)' : 'var(--primary)';
}
function toggleExample(btn) {
  var body = btn.nextElementSibling;
  var shown = body.classList.contains('open');
  body.classList.toggle('open', !shown);
  btn.querySelector('i').className = shown ? 'ph ph-caret-right' : 'ph ph-caret-down';
  btn.innerHTML = (shown ? '<i class="ph ph-caret-right" style="font-size:9px"></i> 查看範例' : '<i class="ph ph-caret-down" style="font-size:9px"></i> 收起範例');
}
function onConclude() {
  var v = document.getElementById('conclude-text').value.trim();
  var h = document.getElementById('conclude-hint');
  if (v.length > 30) { h.className='conclusion-hint pass'; h.textContent='✓ 結論涵蓋三層需求並說明核心痛點，可以提交'; }
  else { h.className='conclusion-hint warn'; h.textContent='請說明三層需求各一句話，並指出核心痛點'; }
}
</script>
</body>
</html>
```

---

## Per-Step Content Reference — C2 優先排序

### Step Key: `C2` | Label: C — 優先排序 | Position: 4/7

**Fields:** 取捨標準, 最優先項目, 暫緩項目, 排序理由

**Rubric (4 dimensions, total /20 → normalized to /100):**
| Dimension | Max | Description |
|-----------|-----|-------------|
| 取捨標準顯性化 | 5 | 明確說出可操作的取捨框架（有量化更好） |
| 最優先項理由 | 5 | 最優先項目連結取捨標準，有業務+用戶雙贏論據 |
| 暫緩項邏輯 | 5 | 暫緩有業務層 + 技術層雙重理由，不只說「太難」 |
| 整體排序一致性 | 5 | 排序理由串聯取捨標準，形成完整邏輯主線 |

**Sample score (73/100):**
取捨標準顯性化 3.5 + 最優先項理由 4 + 暫緩項邏輯 4 + 整體排序一致性 3 = 14.5/20 → 73

**Phase 1 hint overlay texts (💡 buttons):**
- 取捨標準: 「取捨標準不是「什麼最重要」，而是「用什麼框架來判斷重要性」。你的標準應該是可操作的——例如「以廣告收入不降超過5%為硬性約束，在此前提下最大化 DAU 打開頻率」。沒有顯性標準，後面的排序理由就無法自圓其說。」
- 最優先項目: 「從 R 步驟確認的需求中，選出最優先要解決的那一個。選擇理由要對應你的取捨標準——不能只說「最重要」，要說「根據我的取捨標準，它最優先因為…」。最優先項目要和暫緩項目形成對比，讓面試官看到你的判斷邏輯，而不只是一個列表。」
- 暫緩項目: 「暫緩不等於不重要——你要說清楚「為什麼現在不做」。是資源限制？廣告主關係風險？還是依賴其他功能先完成？好的暫緩理由展示你對整個業務系統的理解，而不只是「先做 A 再做 B」。理由越具體，說服力越強。」
- 排序理由: 「排序理由是把前三欄串起來的關鍵。它要回答：「為什麼最優先的不能暫緩？為什麼暫緩的不能優先？」說清楚這個邏輯，才是真正的取捨分析，而不只是列表。面試官期待看到你的判斷——為什麼是這個順序，而不是另一個順序？」

**`CIRCLES_STEP_HINTS['C2']` array:**
```javascript
['以廣告收入季度不降超過 5% 為硬性約束，在此前提下最大化 DAU 打開頻率',
 '改善 Feed 演算法相關性——可同時提升 DAU 打開頻率與廣告點擊率，是正和博弈',
 '用戶自訂廣告頻率控制——廣告主合約關係風險高，且工程複雜度不在單季度範圍內',
 '相關性改善是正和博弈（用戶與廣告主雙贏），頻率控制是零和博弈；正和優先，零和暫緩']
```

**Phase 2 icebreaker text:**
「問被訪談者這個項目有哪些硬性的業務限制——收入不能下降多少、廣告主有哪些合約承諾。有了約束邊界，才能確立你的取捨標準。」

**Phase 2 dialogue (4 turns):**
1. User: 你們在這次改善廣告體驗的項目裡，有哪些硬性的業務限制是不能突破的？  
   AI: 廣告收入 guidance 已出，不能降超過一定比例；廣告主合約承諾曝光量不能大幅縮減  
   Coach: 問出了硬性約束，取捨標準的基礎  
   Hint: 問「不大幅下降的前提下，最希望優先改善的用戶指標是什麼？」
2. User: 最希望改善的用戶側指標是什麼？  
   AI: DAU 打開頻率——改善打開頻率廣告總收入可能反增  
   Coach: DAU打開頻率=廣告收入可能反增，這是取捨標準的業務依據  
   Hint: 問「哪些改善方向評估過但決定先不做？」
3. User: 有哪些方向你們評估過但決定暫緩？  
   AI: 用戶自訂廣告頻率——廣告主合約談判麻煩 + 工程複雜度高，非單季度  
   Coach: 暫緩原因兩層：廣告主關係風險 + 工程複雜度  
   Hint: 問「相關性改善和其他方向，你們最希望先看到哪個成果？」
4. User: 相關性改善和其他方向，你們希望先看到哪個成果？  
   AI: 相關性優先——正和博弈，用戶+廣告主雙贏，頻率控制是零和  
   Coach: 取捨標準→最優先→暫緩已完整確認，可以提交了

**Phase 2 conclusion box spec:**
- Placeholder: 「針對這題，整理你確認的取捨標準、最優先項目與暫緩理由…」
- Example strip (collapsed, 範例不同題目): Spotify 取捨標準：不影響付費轉換率為硬性約束，優先改善廣告後的回聽體驗。最優先：廣告後自動播放相關歌曲（不影響收入且可提升留存）。暫緩：廣告頻率自訂（影響廣告主收入預期）。排序理由：自動播放是正和，頻率控制是零和；正和優先。

**Coach demo answer (4 labeled dimensions):**
```html
<div style="margin-bottom:6px"><strong style="color:var(--text)">取捨標準：</strong>以「廣告收入季度不降超過 5%」為硬性約束，在此前提下最大化 DAU 打開頻率。</div>
<div style="margin-bottom:6px"><strong style="color:var(--text)">最優先：</strong>改善 Feed 相關性演算法——是正和博弈，用戶和廣告主雙贏，且可在單季度內見效。</div>
<div style="margin-bottom:6px"><strong style="color:var(--text)">暫緩：</strong>用戶自訂廣告頻率——廣告主合約風險 + 工程複雜度高，超出單季度範圍。</div>
<div><strong style="color:var(--text)">排序理由：</strong>相關性改善符合取捨標準（不影響廣告主，反而提升點擊率）；頻率控制直接衝擊廣告主關係，不符合業務硬性限制。</div>
```

**Score nav in circles-nav (simulation mode):**
- ◀ (onclick → show R step score) — `score-nav-btn`
- ▶ disabled (C2 is current/latest step) — `score-nav-btn` with `disabled`

---

## Mockup HTML — C2 優先排序完整互動稿

**Mockup 來源路徑：** `.superpowers/brainstorm/C2-step-2026-04-26/content/circles-C2-step-mockup.html`（直接用瀏覽器開啟即可預覽）。**此 HTML 是實作的視覺真相來源（canonical visual truth）——若 spec 文字與此畫面有出入，以此 HTML 為準。**

**9 screens:** P1 加練, P1+提示, Gate ✓, Gate ✗, P2 早期, P2 收斂, P2 結論, P3 C2評分, P3 R評分

**New patterns introduced in this step:**
| Pattern | Description |
|---------|-------------|
| `.chat-icebreaker` | Blue-tinted card as first element in `.chat-body` (all steps) |
| `.chat-icebreaker-label` | Compass icon + "開始提問方向" uppercase label |
| `.chat-icebreaker-text` | One directional sentence for Phase 2 start |
| `.score-nav` + `.score-nav-btn` | Left/right step navigation in circles-nav on P3 |

```html
<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
<title>CIRCLES — C2 優先排序 Mockup</title>
<link rel="stylesheet" href="https://unpkg.com/@phosphor-icons/web@2.1.1/src/regular/style.css">
<style>
* { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
body { font-family: 'DM Sans', -apple-system, sans-serif; background: #F2F0EB; display: flex; justify-content: center; }

:root {
  --bg: #F2F0EB;
  --card: #ffffff;
  --border: #e8e5de;
  --primary: #1A56DB;
  --primary-lt: #EEF3FF;
  --text: #1a1a1a;
  --text-2: #5a5a5a;
  --text-3: #8a8a8a;
  --success: #137A3D;
  --warning: #B85C00;
  --danger: #D92020;
}

.top-nav {
  position: fixed; top: 0; left: 50%; transform: translateX(-50%);
  background: #111; display: flex; gap: 8px; padding: 8px 16px;
  z-index: 999; border-radius: 0 0 12px 12px; overflow-x: auto;
  white-space: nowrap; max-width: 100vw;
}
.nav-label {
  font-size: 11px; font-weight: 700; background: #1a1a1a; color: #fff;
  padding: 6px 14px; border-radius: 20px; cursor: pointer;
  font-family: sans-serif; white-space: nowrap;
}
.nav-label:hover { background: #333; }
.nav-label.active { background: var(--primary); }

.wrapper { max-width: 390px; width: 100vw; margin-top: 54px; position: relative; }
.shell { width: 390px; min-height: 100vh; background: var(--bg); position: relative; overflow: hidden; }
.screen { display: none; flex-direction: column; height: 100vh; }
.screen.active { display: flex; }

.btn-icon { background: none; border: none; font-size: 18px; color: var(--text-2); cursor: pointer; padding: 6px; line-height: 1; }

.circles-nav {
  height: 52px; background: var(--card); border-bottom: 1px solid var(--border);
  display: flex; align-items: center; padding: 0 14px; gap: 10px; flex-shrink: 0;
}
.circles-nav-title { font-size: 14px; font-weight: 700; color: var(--text); }
.circles-nav-sub { font-size: 11px; color: var(--text-3); }
.circles-nav-home { font-size: 12px; color: var(--primary); border-bottom: 1px solid var(--primary); background: none; border-top: none; border-left: none; border-right: none; padding: 2px 0; cursor: pointer; white-space: nowrap; flex-shrink: 0; margin-left: auto; }

.circles-progress {
  height: 36px; background: var(--card); border-bottom: 1px solid var(--border);
  display: flex; align-items: center; padding: 0 14px; gap: 3px; flex-shrink: 0;
}
.circles-progress-seg { flex: 1; height: 4px; background: #e8e5de; border-radius: 2px; }
.circles-progress-seg.done { background: var(--primary); }
.circles-progress-seg.active { background: rgba(26,86,219,0.4); }
.circles-progress-label { font-size: 10px; color: var(--text-3); white-space: nowrap; margin-left: 8px; }

.scroll-body { flex: 1; overflow-y: auto; padding: 16px; scrollbar-width: none; }
.scroll-body::-webkit-scrollbar { display: none; }

.submit-bar {
  background: var(--card); border-top: 1px solid var(--border);
  padding: 12px 16px; display: flex; gap: 10px; flex-shrink: 0;
}
.btn-primary { flex: 1; background: var(--primary); color: #fff; border: none; border-radius: 10px; padding: 12px 16px; font-size: 14px; font-weight: 600; cursor: pointer; font-family: 'DM Sans', sans-serif; }
.btn-secondary { background: #f0ede6; color: var(--text); border: none; border-radius: 10px; padding: 12px 16px; font-size: 14px; font-weight: 600; cursor: pointer; white-space: nowrap; }
.btn-ghost-sm { background: none; color: var(--text-2); border: 1px solid var(--border); border-radius: 10px; padding: 12px 16px; font-size: 14px; font-weight: 600; cursor: pointer; white-space: nowrap; }

.problem-card {
  background: var(--card); border-radius: 10px; border: 1px solid var(--border);
  padding: 12px 14px; font-size: 13px; color: var(--text-2); line-height: 1.6;
  margin-bottom: 14px;
}
.problem-card-label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: .07em; color: var(--text-3); margin-bottom: 4px; }

.circles-step-pills { display: flex; gap: 6px; overflow-x: auto; margin-bottom: 14px; scrollbar-width: none; padding-bottom: 2px; }
.circles-step-pills::-webkit-scrollbar { display: none; }
.circles-step-pill { flex-shrink: 0; padding: 5px 12px; border-radius: 20px; border: 1px solid var(--border); background: var(--card); font-size: 11px; font-weight: 600; color: var(--text-3); cursor: pointer; white-space: nowrap; }
.circles-step-pill.active { background: var(--primary); color: #fff; border-color: var(--primary); }
.circles-step-pill.done { background: #e6f0e8; color: var(--success); border-color: #b8dbbf; }

.circles-field-group { margin-bottom: 16px; }
.circles-field-label-row { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 4px; }
.circles-field-label { font-size: 10px; color: var(--text-3); text-transform: uppercase; letter-spacing: .07em; font-weight: 700; }
.circles-hint-trigger { background: none; border: none; font-size: 11px; color: var(--primary); cursor: pointer; padding: 0; white-space: nowrap; }
.field-example-toggle { background: none; border: none; font-size: 10px; color: var(--text-3); cursor: pointer; padding: 0 0 5px; display: flex; align-items: center; gap: 3px; font-family: 'DM Sans', sans-serif; }
.field-example-body { display: none; font-size: 11px; color: var(--text-3); margin-bottom: 6px; line-height: 1.5; padding: 5px 8px; background: rgba(0,0,0,0.03); border-radius: 6px; }
.field-example-body.open { display: block; }
.circles-field-input { width: 100%; padding: 11px 13px; border-radius: 10px; border: 1.5px solid var(--border); background: var(--card); font-size: 13px; font-family: 'DM Sans', sans-serif; color: var(--text); resize: none; outline: none; line-height: 1.5; }
.circles-field-input:focus { border-color: var(--primary); }
.circles-field-input.filled { border-color: rgba(26,86,219,0.3); background: #fbfaff; }

.gate-pass-bar { background: var(--primary-lt); border: 1px solid #C5D5FF; border-radius: 10px; padding: 12px 14px; margin-bottom: 16px; }
.gate-pass-text { font-size: 12px; font-weight: 600; color: var(--primary); }
.gate-pass-sub { font-size: 11px; color: #5a7ab5; }
.gate-fail-bar { background: #FFF3F3; border: 1px solid #FFCDD2; border-radius: 10px; padding: 12px 14px; margin-bottom: 16px; font-size: 12px; color: var(--danger); }
.gate-card { background: var(--card); border-radius: 10px; border: 1.5px solid var(--border); padding: 12px 14px; margin-bottom: 10px; display: flex; gap: 10px; align-items: flex-start; }
.gate-card.ok { border-color: #b8dbbf; }
.gate-card.warn { border-color: #FFD54F; }
.gate-card.error { border-color: #f5c6c6; }
.gate-card-icon { font-size: 15px; flex-shrink: 0; margin-top: 1px; }
.gate-card-field { font-size: 9px; text-transform: uppercase; letter-spacing: .05em; color: var(--text-3); margin-bottom: 2px; }
.gate-card-title { font-size: 13px; font-weight: 700; color: var(--text); margin-bottom: 3px; }
.gate-card-reason { font-size: 12px; color: var(--text-2); line-height: 1.5; }
.gate-card-suggestion { font-size: 11px; color: var(--warning); margin-top: 4px; }

.chat-wrap { display: flex; flex-direction: column; height: 100vh; overflow: hidden; }
.chat-pinned { background: var(--card); border-bottom: 1px solid var(--border); padding: 8px 14px; flex-shrink: 0; }
.pinned-co { font-size: 10px; color: var(--primary); font-weight: 600; text-transform: uppercase; letter-spacing: .05em; margin-bottom: 1px; }
.pinned-stmt { font-size: 11px; color: var(--text); font-weight: 600; line-height: 1.4; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.chat-body { flex: 1; overflow-y: auto; padding: 14px 16px; scrollbar-width: none; }
.chat-body::-webkit-scrollbar { display: none; }
.bubble-user {
  background: var(--card); border: 1px solid var(--border);
  border-radius: 12px 4px 12px 12px; padding: 10px 13px;
  font-size: 13px; line-height: 1.6; color: var(--text);
  margin-bottom: 10px; max-width: 88%; margin-left: auto;
}
.bubble-ai {
  background: var(--primary-lt); border: 1px solid rgba(26,86,219,0.18);
  border-radius: 4px 12px 12px 12px; padding: 10px 13px;
  font-size: 13px; line-height: 1.6; color: var(--text);
  margin-bottom: 10px; max-width: 88%;
}
.bubble-section { font-size: 10px; font-weight: 700; color: var(--text-3); text-transform: uppercase; letter-spacing: .07em; margin-bottom: 3px; }
.bubble-coaching { background: rgba(0,0,0,0.03); border: 1px solid var(--border); border-radius: 4px 12px 12px 12px; padding: 10px 13px; font-size: 12px; line-height: 1.6; color: var(--text); margin-bottom: 10px; max-width: 88%; }
.hint-toggle { background: none; border: none; font-size: 11px; color: var(--text-3); cursor: pointer; padding: 0; display: flex; align-items: center; gap: 3px; margin-top: 6px; }
.hint-body { display: none; margin-top: 4px; padding: 6px 8px; background: rgba(0,0,0,0.04); border-radius: 6px; color: var(--text-2); font-size: 11px; line-height: 1.5; }
.chat-input-bar { background: var(--card); border-top: 1px solid var(--border); padding: 10px 14px; display: flex; gap: 8px; align-items: flex-end; flex-shrink: 0; }
.chat-icebreaker { background: rgba(26,86,219,0.05); border: 1px solid rgba(26,86,219,0.18); border-radius: 10px; padding: 10px 13px; margin-bottom: 14px; }
.chat-icebreaker-label { font-size: 9px; font-weight: 700; color: var(--primary); text-transform: uppercase; letter-spacing: .07em; margin-bottom: 5px; display: flex; align-items: center; gap: 4px; }
.chat-icebreaker-text { font-size: 12px; color: var(--text-2); line-height: 1.65; }
.chat-input { flex: 1; background: #f5f5f5; border: 1px solid var(--border); border-radius: 10px; padding: 9px 13px; font-size: 14px; color: var(--text); font-family: 'DM Sans', sans-serif; resize: none; outline: none; min-height: 40px; }
.chat-send-btn { width: 40px; height: 40px; border-radius: 10px; background: var(--primary); border: none; color: #fff; font-size: 16px; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.chat-submit-row { padding: 6px 12px 10px; display: flex; justify-content: center; background: var(--card); flex-shrink: 0; border-top: 1px solid var(--border); }
.chat-submit-btn { font-size: 11px; color: var(--text-2); border: 1px solid var(--border); border-radius: 8px; padding: 6px 16px; cursor: pointer; background: var(--card); }

.conclusion-box { border-top: 2px solid var(--primary); background: var(--card); padding: 14px; flex-shrink: 0; max-height: 55vh; overflow-y: auto; }
.conclusion-title { font-size: 11px; font-weight: 700; color: var(--text); margin-bottom: 2px; }
.conclusion-sub { font-size: 10px; color: var(--text-3); margin-bottom: 8px; }
.conclusion-textarea { width: 100%; border: 1px solid #ddd; border-radius: 8px; padding: 9px; font-size: 11px; line-height: 1.6; resize: none; height: 60px; box-sizing: border-box; font-family: 'DM Sans', sans-serif; color: var(--text); outline: none; }
.conclusion-hint { min-height: 16px; font-size: 10px; color: var(--text-3); margin-top: 6px; }
.conclusion-hint.pass { background: #E8F5E9; color: var(--success); border-radius: 4px; padding: 4px 8px; }
.conclusion-hint.warn { background: #FFF8E1; color: #7A5800; border-radius: 4px; padding: 4px 8px; }
.conclusion-actions { margin-top: 8px; display: flex; align-items: center; justify-content: space-between; }
.conclusion-back-btn { font-size: 10px; color: var(--text-3); background: none; border: none; cursor: pointer; }
.conclusion-submit-btn { background: var(--primary); color: #fff; border: none; border-radius: 8px; padding: 8px 14px; font-size: 12px; font-weight: 600; cursor: pointer; }

.score-total { background: var(--card); border-radius: 16px; border: 1px solid var(--border); padding: 20px; text-align: center; margin-bottom: 14px; }
.score-number { font-family: 'Georgia', serif; font-size: 60px; color: var(--primary); line-height: 1; margin-bottom: 4px; font-weight: 400; }
.score-sub { font-size: 13px; color: var(--text-2); }
.score-breakdown { background: var(--card); border-radius: 12px; border: 1px solid var(--border); padding: 14px; margin-bottom: 14px; }
.dim-row { display: flex; align-items: center; gap: 10px; padding: 9px 0; border-bottom: 1px solid var(--border); }
.dim-row:last-child { border-bottom: none; }
.dim-text { flex: 1; min-width: 0; }
.dim-name { font-size: 12px; color: var(--text-2); }
.dim-comment { font-size: 10px; color: var(--text-3); margin-top: 1px; line-height: 1.4; }
.dim-bar-wrap { width: 70px; height: 5px; background: #f0ede6; border-radius: 3px; flex-shrink: 0; }
.dim-bar { height: 100%; border-radius: 3px; background: var(--primary); }
.dim-score { font-weight: 700; color: var(--text); min-width: 24px; text-align: right; font-size: 12px; }
.dim-score span { font-size: 9px; color: var(--text-3); }
.highlight-card { border-radius: 10px; border: 1.5px solid; padding: 12px 14px; margin-bottom: 10px; }
.highlight-card.good { background: #F0FFF4; border-color: #BBF7D0; }
.highlight-card.improve { background: #FFFBEB; border-color: #FDE68A; }
.highlight-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; margin-bottom: 4px; }
.highlight-card.good .highlight-label { color: var(--success); }
.highlight-card.improve .highlight-label { color: var(--warning); }
.highlight-text { font-size: 13px; color: var(--text); line-height: 1.5; }
.coach-toggle { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 14px; margin-bottom: 14px; cursor: pointer; }
.coach-toggle-label { font-size: 12px; font-weight: 700; color: var(--text-2); display: flex; align-items: center; justify-content: space-between; }
.coach-content { font-size: 12px; color: var(--text-2); line-height: 1.7; margin-top: 10px; display: none; }
.coach-content.open { display: block; }

.score-nav { display: flex; gap: 2px; margin-left: auto; }
.score-nav-btn { background: none; border: 1px solid var(--border); border-radius: 6px; padding: 4px 8px; font-size: 12px; cursor: pointer; color: var(--text-2); }
.score-nav-btn:disabled { opacity: 0.3; cursor: default; }

.hint-overlay {
  position: absolute; inset: 0; background: rgba(0,0,0,0.45);
  z-index: 200; display: none; align-items: center; justify-content: center; padding: 24px;
}
.hint-overlay.visible { display: flex; }
.hint-card { background: #fff; border-radius: 16px; padding: 20px; max-width: 340px; width: 100%; box-shadow: 0 8px 40px rgba(0,0,0,0.18); position: relative; }
.hint-card-title { font-size: 13px; font-weight: 700; color: var(--primary); margin-bottom: 2px; }
.hint-card-sub { font-size: 11px; color: #8a8a8a; margin-bottom: 12px; }
.hint-card-body { font-size: 13px; color: var(--text); line-height: 1.7; background: #F6F8FF; border-left: 3px solid var(--primary); padding: 12px; border-radius: 0 8px 8px 0; }
.hint-card-footer { font-size: 11px; color: #aaa; text-align: center; margin-top: 12px; }
.hint-close { position: absolute; top: 12px; right: 14px; background: none; border: none; font-size: 20px; color: #aaa; cursor: pointer; line-height: 1; padding: 0; }
</style>
</head>
<body>

<div class="top-nav">
  <span class="nav-label active" onclick="show('p1-drill')">P1 加練</span>
  <span class="nav-label" onclick="show('p1-hint')">P1+提示</span>
  <span class="nav-label" onclick="show('gate-pass')">Gate ✓</span>
  <span class="nav-label" onclick="show('gate-fail')">Gate ✗</span>
  <span class="nav-label" onclick="show('p2-early')">P2 早期</span>
  <span class="nav-label" onclick="show('p2-late')">P2 收斂</span>
  <span class="nav-label" onclick="show('p2-conclude')">P2 結論</span>
  <span class="nav-label" onclick="show('p3-c2')">P3 C2評分</span>
  <span class="nav-label" onclick="show('p3-r')">P3 R評分</span>
</div>

<div class="wrapper">
<div class="shell">

<!-- SCREEN 1: Phase 1 — C2 (Drill mode) -->
<div id="screen-p1-drill" class="screen active" style="position:relative">
  <div class="circles-nav">
    <button class="btn-icon"><i class="ph ph-arrow-left"></i></button>
    <div>
      <div class="circles-nav-title">C — 優先排序</div>
      <div class="circles-nav-sub">Meta · News Feed</div>
    </div>
    <button class="circles-nav-home">回首頁</button>
  </div>
  <div class="circles-progress">
    <div class="circles-progress-seg done"></div>
    <div class="circles-progress-seg done"></div>
    <div class="circles-progress-seg done"></div>
    <div class="circles-progress-seg active"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-label">C · 優先排序 · 4/7</div>
  </div>
  <div class="scroll-body">
    <div class="problem-card">
      <div class="problem-card-label">練習題目</div>
      用戶反映 News Feed 廣告過多，如何改善廣告體驗並維持 Meta 的廣告收入？
    </div>
    <div class="circles-step-pills">
      <span class="circles-step-pill done">C 澄清情境</span>
      <span class="circles-step-pill done">I 定義用戶</span>
      <span class="circles-step-pill done">R 發掘需求</span>
      <span class="circles-step-pill active">C 優先排序</span>
      <span class="circles-step-pill">L 提出方案</span>
      <span class="circles-step-pill">E 評估取捨</span>
      <span class="circles-step-pill">S 總結推薦</span>
    </div>
    <div class="circles-field-group">
      <div class="circles-field-label-row">
        <div class="circles-field-label">取捨標準</div>
        <button class="circles-hint-trigger" onclick="showHint('取捨標準','取捨標準不是「什麼最重要」，而是「用什麼框架來判斷重要性」。你的標準應該是可操作的——例如「以廣告收入不降超過5%為硬性約束，在此前提下最大化 DAU 打開頻率」。沒有顯性標準，後面的排序理由就無法自圓其說。')">💡 提示</button>
      </div>
      <button class="field-example-toggle" onclick="toggleExample(this)"><i class="ph ph-caret-right" style="font-size:9px"></i> 查看範例</button>
      <div class="field-example-body">例：以廣告收入季度不降超過 5% 為硬性約束，在此前提下最大化 DAU 打開頻率</div>
      <textarea class="circles-field-input" rows="2" placeholder="填寫你的取捨標準…"></textarea>
    </div>
    <div class="circles-field-group">
      <div class="circles-field-label-row">
        <div class="circles-field-label">最優先項目</div>
        <button class="circles-hint-trigger" onclick="showHint('最優先項目','從 R 步驟確認的需求中，選出最優先要解決的那一個。選擇理由要對應你的取捨標準——不能只說「最重要」，要說「根據我的取捨標準，它最優先因為…」。最優先項目要和暫緩項目形成對比，讓面試官看到你的判斷邏輯，而不只是一個列表。')">💡 提示</button>
      </div>
      <button class="field-example-toggle" onclick="toggleExample(this)"><i class="ph ph-caret-right" style="font-size:9px"></i> 查看範例</button>
      <div class="field-example-body">例：改善 Feed 演算法相關性——可同時提升 DAU 打開頻率與廣告點擊率，是正和博弈</div>
      <textarea class="circles-field-input" rows="2" placeholder="填寫你最優先的項目與理由…"></textarea>
    </div>
    <div class="circles-field-group">
      <div class="circles-field-label-row">
        <div class="circles-field-label">暫緩項目</div>
        <button class="circles-hint-trigger" onclick="showHint('暫緩項目','暫緩不等於不重要——你要說清楚「為什麼現在不做」。是資源限制？廣告主關係風險？還是依賴其他功能先完成？好的暫緩理由展示你對整個業務系統的理解，而不只是「先做 A 再做 B」。理由越具體，說服力越強。')">💡 提示</button>
      </div>
      <button class="field-example-toggle" onclick="toggleExample(this)"><i class="ph ph-caret-right" style="font-size:9px"></i> 查看範例</button>
      <div class="field-example-body">例：用戶自訂廣告頻率控制——廣告主合約關係風險高，且工程複雜度不在單季度範圍內</div>
      <textarea class="circles-field-input" rows="2" placeholder="填寫你暫緩的項目與原因…"></textarea>
    </div>
    <div class="circles-field-group">
      <div class="circles-field-label-row">
        <div class="circles-field-label">排序理由</div>
        <button class="circles-hint-trigger" onclick="showHint('排序理由','排序理由是把前三欄串起來的關鍵。它要回答：「為什麼最優先的不能暫緩？為什麼暫緩的不能優先？」說清楚這個邏輯，才是真正的取捨分析，而不只是列表。面試官期待看到你的判斷——為什麼是這個順序，而不是另一個順序？')">💡 提示</button>
      </div>
      <button class="field-example-toggle" onclick="toggleExample(this)"><i class="ph ph-caret-right" style="font-size:9px"></i> 查看範例</button>
      <div class="field-example-body">例：相關性改善是正和博弈（用戶與廣告主雙贏），頻率控制是零和博弈；正和優先，零和暫緩</div>
      <textarea class="circles-field-input" rows="2" placeholder="說明你排序的完整邏輯…"></textarea>
    </div>
  </div>
  <div class="submit-bar">
    <button class="btn-secondary">返回選題</button>
    <button class="btn-primary" onclick="show('gate-pass')">提交框架 → AI 審核</button>
  </div>
  <div class="hint-overlay" id="hint-overlay" onclick="closeHint(event)">
    <div class="hint-card">
      <button class="hint-close" onclick="closeHint()">×</button>
      <div class="hint-card-title" id="hint-title">💡 取捨標準 — 分析思路</div>
      <div class="hint-card-sub">Meta · News Feed · C 優先排序</div>
      <div class="hint-card-body" id="hint-body">載入中…</div>
      <div class="hint-card-footer">閱讀後關閉，自行填寫你的分析</div>
    </div>
  </div>
</div>

<!-- SCREEN 2: Phase 1 — hint overlay visible -->
<div id="screen-p1-hint" class="screen" style="position:relative">
  <div class="circles-nav">
    <button class="btn-icon"><i class="ph ph-arrow-left"></i></button>
    <div>
      <div class="circles-nav-title">C — 優先排序</div>
      <div class="circles-nav-sub">Meta · News Feed</div>
    </div>
    <button class="circles-nav-home">回首頁</button>
  </div>
  <div class="circles-progress">
    <div class="circles-progress-seg done"></div>
    <div class="circles-progress-seg done"></div>
    <div class="circles-progress-seg done"></div>
    <div class="circles-progress-seg active"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-label">C · 優先排序 · 4/7</div>
  </div>
  <div class="scroll-body" style="filter:blur(1px);pointer-events:none">
    <div class="problem-card">用戶反映 News Feed 廣告過多，如何改善廣告體驗並維持 Meta 的廣告收入？</div>
    <div class="circles-step-pills">
      <span class="circles-step-pill done">C 澄清情境</span>
      <span class="circles-step-pill done">I 定義用戶</span>
      <span class="circles-step-pill done">R 發掘需求</span>
      <span class="circles-step-pill active">C 優先排序</span>
      <span class="circles-step-pill">L 提出方案</span>
      <span class="circles-step-pill">E 評估取捨</span>
      <span class="circles-step-pill">S 總結推薦</span>
    </div>
    <div class="circles-field-group">
      <div class="circles-field-label-row"><div class="circles-field-label">取捨標準</div></div>
      <textarea class="circles-field-input filled" rows="2">以廣告收入季度不降超過 5% 為硬性約束，在此前提下最大化 DAU 打開頻率</textarea>
    </div>
    <div class="circles-field-group">
      <div class="circles-field-label-row"><div class="circles-field-label">最優先項目</div></div>
      <textarea class="circles-field-input" rows="2" placeholder="填寫你的分析..."></textarea>
    </div>
  </div>
  <div class="hint-overlay visible">
    <div class="hint-card">
      <button class="hint-close" onclick="show('p1-drill')">×</button>
      <div class="hint-card-title">💡 最優先項目 — 分析思路</div>
      <div class="hint-card-sub">Meta · News Feed · C 優先排序</div>
      <div class="hint-card-body">從 R 步驟確認的需求中，選出最優先要解決的那一個。選擇理由要對應你的取捨標準——不能只說「最重要」，要說「根據我的取捨標準，它最優先因為…」。問問自己：哪個項目能在不突破業務紅線的前提下，同時滿足最多的用戶需求？這是「正和博弈」還是「零和博弈」——正和優先。</div>
      <div class="hint-card-footer">閱讀後關閉，自行填寫你的分析</div>
    </div>
  </div>
</div>

<!-- SCREEN 3: Gate — Pass -->
<div id="screen-gate-pass" class="screen" style="position:relative">
  <div class="circles-nav">
    <button class="btn-icon" onclick="show('p1-drill')"><i class="ph ph-arrow-left"></i></button>
    <div>
      <div class="circles-nav-title">框架審核結果</div>
      <div class="circles-nav-sub">C · 優先排序 · Meta</div>
    </div>
    <button class="circles-nav-home">回首頁</button>
  </div>
  <div class="circles-progress">
    <div class="circles-progress-seg done"></div>
    <div class="circles-progress-seg done"></div>
    <div class="circles-progress-seg done"></div>
    <div class="circles-progress-seg done"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-label">C · 優先排序</div>
  </div>
  <div class="scroll-body">
    <div class="gate-pass-bar">
      <div class="gate-pass-text">框架審核通過</div>
      <div class="gate-pass-sub">框架方向正確，進入對話練習階段繼續探索。</div>
    </div>
    <div class="gate-card ok">
      <div class="gate-card-icon" style="color:#137A3D"><i class="ph ph-check-circle"></i></div>
      <div>
        <div class="gate-card-field">取捨標準</div>
        <div class="gate-card-title">業務約束清楚，雙目標清晰</div>
        <div class="gate-card-reason">以「收入保護」為硬性約束、「DAU 打開頻率」為優化目標，取捨框架有邏輯主線</div>
      </div>
    </div>
    <div class="gate-card ok">
      <div class="gate-card-icon" style="color:#137A3D"><i class="ph ph-check-circle"></i></div>
      <div>
        <div class="gate-card-field">最優先項目</div>
        <div class="gate-card-title">選定項目與標準一致</div>
        <div class="gate-card-reason">選相關性演算法改善，理由連結了業務目標（廣告點擊率）和用戶目標（漏接焦慮），邏輯清晰</div>
      </div>
    </div>
    <div class="gate-card warn">
      <div class="gate-card-icon" style="color:#B85C00"><i class="ph ph-warning"></i></div>
      <div>
        <div class="gate-card-field">暫緩項目</div>
        <div class="gate-card-title">暫緩理由偏技術，可補業務層</div>
        <div class="gate-card-reason">說了「工程複雜度高」，但廣告主合約關係風險這個業務理由更有說服力</div>
        <div class="gate-card-suggestion">建議補充：暫緩的業務層原因（廣告主關係），讓取捨框架更完整</div>
      </div>
    </div>
    <div class="gate-card ok">
      <div class="gate-card-icon" style="color:#137A3D"><i class="ph ph-check-circle"></i></div>
      <div>
        <div class="gate-card-field">排序理由</div>
        <div class="gate-card-title">正和 vs 零和邏輯清楚</div>
        <div class="gate-card-reason">「相關性改善是正和，頻率控制是零和」的排序邏輯直接對應取捨標準</div>
      </div>
    </div>
  </div>
  <div class="submit-bar">
    <button class="btn-ghost-sm" onclick="show('p1-drill')">重新編輯</button>
    <button class="btn-primary" onclick="show('p2-early')">進入對話練習 →</button>
  </div>
</div>

<!-- SCREEN 4: Gate — Fail -->
<div id="screen-gate-fail" class="screen" style="position:relative">
  <div class="circles-nav">
    <button class="btn-icon" onclick="show('p1-drill')"><i class="ph ph-arrow-left"></i></button>
    <div>
      <div class="circles-nav-title">框架審核結果</div>
      <div class="circles-nav-sub">C · 優先排序 · Meta</div>
    </div>
    <button class="circles-nav-home">回首頁</button>
  </div>
  <div class="circles-progress">
    <div class="circles-progress-seg done"></div>
    <div class="circles-progress-seg done"></div>
    <div class="circles-progress-seg done"></div>
    <div class="circles-progress-seg done"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-label">C · 優先排序</div>
  </div>
  <div class="scroll-body">
    <div class="gate-fail-bar">框架有方向性錯誤，請修正後再提交（步驟加練模式）</div>
    <div class="gate-card error">
      <div class="gate-card-icon" style="color:#D92020"><i class="ph ph-x-circle"></i></div>
      <div>
        <div class="gate-card-field">取捨標準</div>
        <div class="gate-card-title">缺乏可操作的取捨標準</div>
        <div class="gate-card-reason">「讓用戶體驗更好」是結果，不是取捨標準——無法用這句話判斷哪個需求優先</div>
        <div class="gate-card-suggestion">改為：「以廣告收入不降超過 X% 為硬性約束，在此前提下最大化 DAU 打開頻率」</div>
      </div>
    </div>
    <div class="gate-card warn">
      <div class="gate-card-icon" style="color:#B85C00"><i class="ph ph-warning"></i></div>
      <div>
        <div class="gate-card-field">最優先項目</div>
        <div class="gate-card-title">選擇合理但未連結取捨標準</div>
        <div class="gate-card-reason">選了演算法改善，但沒說明為什麼它符合你的取捨標準</div>
        <div class="gate-card-suggestion">補充：說明此項目如何滿足你的硬性約束和優化目標</div>
      </div>
    </div>
    <div class="gate-card ok">
      <div class="gate-card-icon" style="color:#137A3D"><i class="ph ph-check-circle"></i></div>
      <div>
        <div class="gate-card-field">暫緩項目</div>
        <div class="gate-card-title">暫緩方向正確</div>
        <div class="gate-card-reason">選擇暫緩頻率控制，方向合理</div>
      </div>
    </div>
    <div class="gate-card error">
      <div class="gate-card-icon" style="color:#D92020"><i class="ph ph-x-circle"></i></div>
      <div>
        <div class="gate-card-field">排序理由</div>
        <div class="gate-card-title">排序理由是列表不是邏輯</div>
        <div class="gate-card-reason">「先做 A 再做 B」不是排序理由——需要說明為什麼 A 不能暫緩、B 不能優先</div>
        <div class="gate-card-suggestion">改為：說明每個選擇和你的取捨標準之間的關係</div>
      </div>
    </div>
  </div>
  <div class="submit-bar">
    <button class="btn-primary" onclick="show('p1-drill')">修正框架後重試</button>
  </div>
</div>

<!-- SCREEN 5: Phase 2 — Early turns (< 3) -->
<div id="screen-p2-early" class="screen chat-wrap">
  <div class="circles-nav">
    <button class="btn-icon" onclick="show('gate-pass')"><i class="ph ph-arrow-left"></i></button>
    <div>
      <div class="circles-nav-title">C — 對話練習</div>
      <div class="circles-nav-sub">Meta · News Feed</div>
    </div>
    <button class="circles-nav-home">回首頁</button>
  </div>
  <div class="circles-progress">
    <div class="circles-progress-seg done"></div>
    <div class="circles-progress-seg done"></div>
    <div class="circles-progress-seg done"></div>
    <div class="circles-progress-seg active"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-label">C · 優先排序 · 4/7</div>
  </div>
  <div class="chat-pinned">
    <div class="pinned-co">Meta — 優先排序</div>
    <div class="pinned-stmt">用戶反映 News Feed 廣告過多，如何改善廣告體驗…</div>
  </div>
  <div class="chat-body">
    <div class="chat-icebreaker">
      <div class="chat-icebreaker-label"><i class="ph ph-compass"></i> 開始提問方向</div>
      <div class="chat-icebreaker-text">問被訪談者這個項目有哪些硬性的業務限制——收入不能下降多少、廣告主有哪些合約承諾。有了約束邊界，才能確立你的取捨標準。</div>
    </div>
    <div class="bubble-user">你們在這次改善廣告體驗的項目裡，有哪些硬性的業務限制是不能突破的？</div>
    <div class="bubble-ai">
      <div class="bubble-section">被訪談者</div>
      嗯，最明確的是廣告收入這塊——我們的季度 guidance 已經出去了，CFO 那邊很清楚。我們能容忍短期的波動，但如果收入降超過一定比例，這個項目就會被叫停。另外廣告主那邊也有合約承諾，曝光量不能大幅縮減。
    </div>
    <div class="bubble-coaching" style="font-size:12px">
      <div class="bubble-section">教練點評</div>
      很好，問出了硬性約束——收入保護和廣告主承諾。這是取捨標準的基礎，繼續問具體的閾值和最希望改善的指標。
      <button class="hint-toggle" onclick="toggleHint(this)"><i class="ph ph-caret-right" style="font-size:10px"></i> 查看教練提示</button>
      <div class="hint-body">問：「在廣告收入不大幅下降的前提下，你們最希望優先改善的是哪個用戶指標？」</div>
    </div>
    <div class="bubble-user">在廣告收入不大幅下降的前提下，你們最希望改善的是哪個用戶側指標？</div>
    <div class="bubble-ai">
      <div class="bubble-section">被訪談者</div>
      DAU 的打開頻率是我最在意的。現在有一批核心用戶打開次數在下降——他們不是要離開，是預期管理壞了。如果能把他們的打開頻率拉回來，廣告總收入反而可能增加，因為曝光次數多了嘛。
    </div>
    <div class="bubble-coaching" style="font-size:12px">
      <div class="bubble-section">教練點評</div>
      很好——「修 DAU 打開頻率 = 廣告收入可能反增」這個邏輯就是你的取捨標準的業務依據。繼續問哪些方向他們考慮過但不做。
      <button class="hint-toggle" onclick="toggleHint(this)"><i class="ph ph-caret-right" style="font-size:10px"></i> 查看教練提示</button>
      <div class="hint-body">問：「有沒有哪些改善方向，你們評估過但決定先不做？原因是什麼？」</div>
    </div>
    <div style="height:8px"></div>
    <div style="text-align:center;font-size:11px;color:var(--text-3);padding:4px 0">再對話 1 輪，可提交步驟</div>
  </div>
  <div class="chat-input-bar">
    <textarea class="chat-input" rows="1" placeholder="問被訪談者一個問題…"></textarea>
    <button class="chat-send-btn"><i class="ph ph-paper-plane-tilt"></i></button>
  </div>
</div>

<!-- SCREEN 6: Phase 2 — ≥3 turns, submit row -->
<div id="screen-p2-late" class="screen chat-wrap">
  <div class="circles-nav">
    <button class="btn-icon" onclick="show('p2-early')"><i class="ph ph-arrow-left"></i></button>
    <div>
      <div class="circles-nav-title">C — 對話練習</div>
      <div class="circles-nav-sub">Meta · News Feed</div>
    </div>
    <button class="circles-nav-home">回首頁</button>
  </div>
  <div class="circles-progress">
    <div class="circles-progress-seg done"></div>
    <div class="circles-progress-seg done"></div>
    <div class="circles-progress-seg done"></div>
    <div class="circles-progress-seg active"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-label">C · 優先排序 · 4/7 · 4 輪</div>
  </div>
  <div class="chat-pinned">
    <div class="pinned-co">Meta — 優先排序</div>
    <div class="pinned-stmt">用戶反映 News Feed 廣告過多，如何改善廣告體驗…</div>
  </div>
  <div class="chat-body">
    <div class="chat-icebreaker">
      <div class="chat-icebreaker-label"><i class="ph ph-compass"></i> 開始提問方向</div>
      <div class="chat-icebreaker-text">問被訪談者這個項目有哪些硬性的業務限制——收入不能下降多少、廣告主有哪些合約承諾。有了約束邊界，才能確立你的取捨標準。</div>
    </div>
    <div class="bubble-user">有沒有哪些改善方向，你們評估過但決定先不做？原因是什麼？</div>
    <div class="bubble-ai">
      <div class="bubble-section">被訪談者</div>
      有，讓用戶自己設定廣告頻率，這個我們想過但最後放棄了。廣告主那邊很敏感，如果用戶可以「選擇不看廣告」，合約談判會很麻煩。而且要做對、不讓用戶亂設，工程複雜度也很高——不是一個季度能解決的事。
    </div>
    <div class="bubble-coaching" style="font-size:12px">
      <div class="bubble-section">教練點評</div>
      暫緩原因有兩層：廣告主關係風險 + 工程複雜度。這是暫緩項目應有的深度，不只說「太難」，還有業務和技術的雙重理由。
      <button class="hint-toggle" onclick="toggleHint(this)"><i class="ph ph-caret-right" style="font-size:10px"></i> 查看教練提示</button>
      <div class="hint-body">問：「那如果要排序，相關性改善和其他方向，你們最希望先看到哪個的成果？」</div>
    </div>
    <div class="bubble-user">如果要排，相關性改善和其他方向，你們希望先看到哪個成果？</div>
    <div class="bubble-ai">
      <div class="bubble-section">被訪談者</div>
      相關性優先。理由是它可以同時解決用戶的漏接焦慮和廣告主的 ROI 問題——用戶看到更相關的廣告，點擊率提升，廣告主也高興。這是少見的正和博弈，頻率控制就沒有這個特性。
    </div>
    <div class="bubble-coaching" style="font-size:12px">
      <div class="bubble-section">教練點評</div>
      到這裡，取捨標準（收入+DAU）→ 最優先（相關性，正和）→ 暫緩（頻率，零和+風險）已完整確認。可以收斂提交了。
      <button class="hint-toggle" onclick="toggleHint(this)"><i class="ph ph-caret-right" style="font-size:10px"></i> 查看教練提示</button>
      <div class="hint-body">整理結論：取捨標準是什麼、最優先是哪個（並說為什麼是正和）、暫緩了什麼（並說業務+技術原因）。</div>
    </div>
    <div style="height:4px"></div>
  </div>
  <div class="chat-input-bar">
    <textarea class="chat-input" rows="1" placeholder="繼續探索，或點下方提交…"></textarea>
    <button class="chat-send-btn"><i class="ph ph-paper-plane-tilt"></i></button>
  </div>
  <div class="chat-submit-row">
    <button class="chat-submit-btn" onclick="show('p2-conclude')">對話足夠了，提交這個步驟</button>
  </div>
</div>

<!-- SCREEN 7: Phase 2 — Conclusion box (expanded) -->
<div id="screen-p2-conclude" class="screen chat-wrap">
  <div class="circles-nav">
    <button class="btn-icon" onclick="show('p2-late')"><i class="ph ph-arrow-left"></i></button>
    <div>
      <div class="circles-nav-title">C — 對話練習</div>
      <div class="circles-nav-sub">Meta · News Feed</div>
    </div>
    <button class="circles-nav-home">回首頁</button>
  </div>
  <div class="circles-progress">
    <div class="circles-progress-seg done"></div>
    <div class="circles-progress-seg done"></div>
    <div class="circles-progress-seg done"></div>
    <div class="circles-progress-seg active"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-label">C · 優先排序 · 4/7 · 4 輪</div>
  </div>
  <div class="chat-pinned">
    <div class="pinned-co">Meta — 優先排序</div>
    <div class="pinned-stmt">用戶反映 News Feed 廣告過多，如何改善廣告體驗…</div>
  </div>
  <div class="chat-body" style="opacity:0.45;pointer-events:none">
    <div class="bubble-user">你們有哪些硬性的業務限制？</div>
    <div class="bubble-ai"><div class="bubble-section">被訪談者</div>廣告收入不能大幅下降，廣告主合約承諾也不能違反。</div>
    <div class="bubble-user">最希望改善哪個用戶指標？</div>
    <div class="bubble-ai"><div class="bubble-section">被訪談者</div>DAU 打開頻率——改善打開頻率可以讓廣告總曝光反增。</div>
    <div class="bubble-user">有哪些方向你們評估過但決定暫緩？</div>
    <div class="bubble-ai"><div class="bubble-section">被訪談者</div>用戶自訂廣告頻率——廣告主合約風險高，工程複雜度也超出單季度。</div>
    <div class="bubble-user">相關性改善和頻率控制，先做哪個？</div>
    <div class="bubble-ai"><div class="bubble-section">被訪談者</div>相關性優先，因為它是正和博弈——用戶和廣告主都受益。</div>
    <div style="text-align:center;padding:6px 0">
      <span style="font-size:11px;color:var(--text-3);background:#f0ede6;border-radius:20px;padding:3px 12px">4 輪對話完成</span>
    </div>
  </div>
  <div class="conclusion-box">
    <div class="conclusion-title">整理你這個步驟確認了什麼</div>
    <div class="conclusion-sub">說明你的取捨標準、最優先項目、暫緩項目，以及排序理由</div>
    <div style="border:1px solid var(--border);border-radius:8px;margin-bottom:8px;overflow:hidden">
      <div style="background:#f5f4f0;padding:5px 10px;display:flex;justify-content:space-between;cursor:pointer;align-items:center" onclick="var c=this.nextElementSibling;c.style.display=c.style.display==='none'?'block':'none';this.querySelector('span').textContent=c.style.display==='none'?'展開 ▾':'收起 ▴'">
        <span style="font-size:9px;font-weight:700;color:var(--text-3);text-transform:uppercase;letter-spacing:.4px">範例（不同題目）</span>
        <span style="font-size:10px;color:var(--text-3)">展開 ▾</span>
      </div>
      <div style="display:none;padding:8px 10px;font-size:11px;color:var(--text-2);line-height:1.6">
        Spotify 取捨標準：不影響付費轉換率為硬性約束，優先改善廣告後的回聽體驗。最優先：廣告後自動播放相關歌曲（不影響收入且可提升留存）。暫緩：廣告頻率自訂（影響廣告主收入預期）。排序理由：自動播放是正和，頻率控制是零和；正和優先。
      </div>
    </div>
    <textarea class="conclusion-textarea" id="conclude-text" rows="3" oninput="onConclude()" placeholder="針對這題，整理你確認的取捨標準、最優先項目與暫緩理由…" style="height:72px">取捨標準：廣告收入不降超過5%為硬性約束，最大化DAU打開頻率。最優先：Feed相關性演算法改善（正和博弈，用戶+廣告主雙贏，單季可見效）。暫緩：用戶自訂廣告頻率（廣告主合約風險+工程複雜度高）。排序理由：相關性符合取捨標準，頻率控制直接衝擊廣告主關係，不符業務限制。</textarea>
    <div class="conclusion-hint pass" id="conclude-hint">✓ 結論涵蓋取捨標準、最優先項目與暫緩理由，可以提交</div>
    <div class="conclusion-actions">
      <button class="conclusion-back-btn" onclick="show('p2-late')">← 繼續對話</button>
      <button class="conclusion-submit-btn" onclick="show('p3-c2')">確認提交</button>
    </div>
  </div>
</div>

<!-- SCREEN 8: Phase 3 — Step Score (C2) -->
<div id="screen-p3-c2" class="screen" style="position:relative">
  <div class="circles-nav">
    <button class="btn-icon" onclick="show('p2-conclude')"><i class="ph ph-arrow-left"></i></button>
    <div>
      <div class="circles-nav-title">步驟評分 — 優先排序</div>
      <div class="circles-nav-sub">Meta · News Feed</div>
    </div>
    <div class="score-nav">
      <button class="score-nav-btn" onclick="show('p3-r')"><i class="ph ph-caret-left"></i></button>
      <button class="score-nav-btn" disabled><i class="ph ph-caret-right"></i></button>
    </div>
  </div>
  <div class="circles-progress">
    <div class="circles-progress-seg done"></div>
    <div class="circles-progress-seg done"></div>
    <div class="circles-progress-seg done"></div>
    <div class="circles-progress-seg done"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-label">C · 評分 · 4/7</div>
  </div>
  <div class="scroll-body">
    <div class="score-total">
      <div class="score-number">73</div>
      <div class="score-sub">C — 優先排序 步驟得分</div>
    </div>
    <div class="score-breakdown">
      <div class="dim-row">
        <div class="dim-text">
          <div class="dim-name">取捨標準顯性化</div>
          <div class="dim-comment">說出了收入保護，但未量化具體閾值（如「不超過5%」）</div>
        </div>
        <div class="dim-bar-wrap"><div class="dim-bar" style="width:70%"></div></div>
        <div class="dim-score">3.5<span>/5</span></div>
      </div>
      <div class="dim-row">
        <div class="dim-text">
          <div class="dim-name">最優先項理由</div>
          <div class="dim-comment">正和博弈邏輯清楚，業務和用戶雙贏論據有說服力</div>
        </div>
        <div class="dim-bar-wrap"><div class="dim-bar" style="width:80%"></div></div>
        <div class="dim-score">4<span>/5</span></div>
      </div>
      <div class="dim-row">
        <div class="dim-text">
          <div class="dim-name">暫緩項邏輯</div>
          <div class="dim-comment">廣告主風險和工程複雜度兩個維度都到位，理由充分</div>
        </div>
        <div class="dim-bar-wrap"><div class="dim-bar" style="width:80%"></div></div>
        <div class="dim-score">4<span>/5</span></div>
      </div>
      <div class="dim-row">
        <div class="dim-text">
          <div class="dim-name">整體排序一致性</div>
          <div class="dim-comment">排序理由和取捨標準連結，但標準量化不足導致一致性稍弱</div>
        </div>
        <div class="dim-bar-wrap"><div class="dim-bar" style="width:60%"></div></div>
        <div class="dim-score">3<span>/5</span></div>
      </div>
    </div>
    <div class="highlight-card good">
      <div class="highlight-label">✦ 最強表現</div>
      <div class="highlight-text">以「正和 vs 零和博弈」框架論證排序，邏輯清晰有說服力</div>
    </div>
    <div class="highlight-card improve">
      <div class="highlight-label">↑ 最需改進</div>
      <div class="highlight-text">取捨標準未量化——面試官會追問「不超過多少%算可接受？」</div>
    </div>
    <div class="coach-toggle" onclick="this.querySelector('.coach-content').classList.toggle('open');this.querySelector('i').className=this.querySelector('.coach-content').classList.contains('open')?'ph ph-caret-up':'ph ph-caret-down'">
      <div class="coach-toggle-label">教練示範答案 <i class="ph ph-caret-down"></i></div>
      <div class="coach-content">
        <div style="margin-bottom:6px"><strong style="color:var(--text)">取捨標準：</strong>以「廣告收入季度不降超過 5%」為硬性約束，在此前提下最大化 DAU 打開頻率。</div>
        <div style="margin-bottom:6px"><strong style="color:var(--text)">最優先：</strong>改善 Feed 相關性演算法——是正和博弈，用戶和廣告主雙贏，且可在單季度內見效。</div>
        <div style="margin-bottom:6px"><strong style="color:var(--text)">暫緩：</strong>用戶自訂廣告頻率——廣告主合約風險 + 工程複雜度高，超出單季度範圍。</div>
        <div><strong style="color:var(--text)">排序理由：</strong>相關性改善符合取捨標準（不影響廣告主，反而提升點擊率）；頻率控制直接衝擊廣告主關係，不符合業務硬性限制。</div>
      </div>
    </div>
  </div>
  <div class="submit-bar">
    <button class="btn-secondary">回首頁</button>
    <button class="btn-primary">繼續下一步：L 提出方案 →</button>
  </div>
</div>

<!-- SCREEN 9: Phase 3 — R Score (simulation browsing) -->
<div id="screen-p3-r" class="screen" style="position:relative">
  <div class="circles-nav">
    <button class="btn-icon" onclick="show('p3-c2')"><i class="ph ph-arrow-left"></i></button>
    <div>
      <div class="circles-nav-title">步驟評分 — 發掘需求</div>
      <div class="circles-nav-sub">Meta · News Feed</div>
    </div>
    <div class="score-nav">
      <button class="score-nav-btn"><i class="ph ph-caret-left"></i></button>
      <button class="score-nav-btn" onclick="show('p3-c2')"><i class="ph ph-caret-right"></i></button>
    </div>
  </div>
  <div class="circles-progress">
    <div class="circles-progress-seg done"></div>
    <div class="circles-progress-seg done"></div>
    <div class="circles-progress-seg done"></div>
    <div class="circles-progress-seg done"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-seg"></div>
    <div class="circles-progress-label">R · 評分 · 3/7</div>
  </div>
  <div class="scroll-body">
    <div class="score-total">
      <div class="score-number">73</div>
      <div class="score-sub">R — 發掘需求 步驟得分</div>
    </div>
    <div class="score-breakdown">
      <div class="dim-row">
        <div class="dim-text">
          <div class="dim-name">功能需求</div>
          <div class="dim-comment">清楚列出效率需求與過濾需求，三層對應完整</div>
        </div>
        <div class="dim-bar-wrap"><div class="dim-bar" style="width:80%"></div></div>
        <div class="dim-score">4<span>/5</span></div>
      </div>
      <div class="dim-row">
        <div class="dim-text">
          <div class="dim-name">情感/社交需求</div>
          <div class="dim-comment">挖到漏接焦慮，但社交動機深度不足</div>
        </div>
        <div class="dim-bar-wrap"><div class="dim-bar" style="width:70%"></div></div>
        <div class="dim-score">3.5<span>/5</span></div>
      </div>
      <div class="dim-row">
        <div class="dim-text">
          <div class="dim-name">痛點層次</div>
          <div class="dim-comment">痛點與功能需求對應清晰，成功連結三層需求</div>
        </div>
        <div class="dim-bar-wrap"><div class="dim-bar" style="width:80%"></div></div>
        <div class="dim-score">4<span>/5</span></div>
      </div>
      <div class="dim-row">
        <div class="dim-text">
          <div class="dim-name">需求優先說明</div>
          <div class="dim-comment">未清楚說明哪個需求最核心、為何優先處理</div>
        </div>
        <div class="dim-bar-wrap"><div class="dim-bar" style="width:60%"></div></div>
        <div class="dim-score">3<span>/5</span></div>
      </div>
    </div>
    <div class="highlight-card good">
      <div class="highlight-label">✦ 最強表現</div>
      <div class="highlight-text">成功從功能層挖到情感痛點「漏接焦慮」，三層需求串聯完整</div>
    </div>
    <div class="highlight-card improve">
      <div class="highlight-label">↑ 最需改進</div>
      <div class="highlight-text">未說明哪個需求是最優先處理的痛點及其理由</div>
    </div>
    <div class="coach-toggle" onclick="this.querySelector('.coach-content').classList.toggle('open');this.querySelector('i').className=this.querySelector('.coach-content').classList.contains('open')?'ph ph-caret-up':'ph ph-caret-down'">
      <div class="coach-toggle-label">教練示範答案 <i class="ph ph-caret-down"></i></div>
      <div class="coach-content">
        <div style="margin-bottom:6px"><strong style="color:var(--text)">功能性：</strong>用戶需要演算法優先展示「緊密連結朋友」的動態，過濾陌生粉絲頁內容。</div>
        <div style="margin-bottom:6px"><strong style="color:var(--text)">情感性：</strong>最核心的情感需求是「避免錯過重要社交時刻的焦慮」，這個焦慮直接影響留存率。</div>
        <div style="margin-bottom:6px"><strong style="color:var(--text)">社交性：</strong>用戶需要被動維持弱連結，關鍵是不需要主動管理優先序。</div>
        <div><strong style="color:var(--text)">核心痛點（優先）：</strong>情感層的焦慮痛點優先，因為它直接觸發打開頻率下降。</div>
      </div>
    </div>
  </div>
  <div class="submit-bar">
    <button class="btn-secondary">回首頁</button>
    <button class="btn-primary">繼續下一步：L 提出方案 →</button>
  </div>
</div>

</div><!-- shell -->
</div><!-- wrapper -->

<script>
function show(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-' + id).classList.add('active');
  document.querySelectorAll('.nav-label').forEach(b => b.classList.remove('active'));
  var map = {'p1-drill':0,'p1-hint':1,'gate-pass':2,'gate-fail':3,'p2-early':4,'p2-late':5,'p2-conclude':6,'p3-c2':7,'p3-r':8};
  if (map[id] !== undefined) document.querySelectorAll('.nav-label')[map[id]].classList.add('active');
}
function showHint(field, body) {
  document.getElementById('hint-title').textContent = '💡 ' + field + ' — 分析思路';
  document.getElementById('hint-body').textContent = body;
  document.getElementById('hint-overlay').classList.add('visible');
}
function closeHint(e) {
  if (!e || e.target === document.getElementById('hint-overlay')) {
    document.getElementById('hint-overlay').classList.remove('visible');
  }
}
function toggleHint(btn) {
  var body = btn.nextElementSibling;
  var shown = body.style.display === 'block';
  body.style.display = shown ? 'none' : 'block';
  btn.querySelector('i').className = shown ? 'ph ph-caret-right' : 'ph ph-caret-down';
  btn.style.color = shown ? 'var(--text-3)' : 'var(--primary)';
}
function toggleExample(btn) {
  var body = btn.nextElementSibling;
  var shown = body.classList.contains('open');
  body.classList.toggle('open', !shown);
  btn.innerHTML = shown
    ? '<i class="ph ph-caret-right" style="font-size:9px"></i> 查看範例'
    : '<i class="ph ph-caret-down" style="font-size:9px"></i> 收起範例';
}
function onConclude() {
  var v = document.getElementById('conclude-text').value.trim();
  var h = document.getElementById('conclude-hint');
  if (v.length > 30) { h.className='conclusion-hint pass'; h.textContent='✓ 結論涵蓋取捨標準、最優先項目與暫緩理由，可以提交'; }
  else { h.className='conclusion-hint warn'; h.textContent='請說明取捨標準、最優先項目、暫緩理由與排序邏輯'; }
}
</script>
</body>
</html>
```

---

## Per-Step Content Reference — L 提出方案

### Step Key: `L` | Label: L — 提出方案 | Position: 5/7

**Fields:** 方案一（含名稱標籤）, 方案二（含名稱標籤）, 方案三（可選，含名稱標籤）

> **L 步驟唯一特例：** 方案三是整個 CIRCLES 框架唯一的選填欄位。Phase 1 UI 使用 Progressive Disclosure：預設顯示「新增方案三（可選）」按鈕，點擊後展開欄位（帶藍色左邊框）。Gate 審核時方案三留空須以 `status: 'skip'` 呈現（ph-minus-circle icon, 50% opacity），不影響 canProceed 判斷。

> **方案名稱標籤（sol-name-input）：** 每個方案欄位頂部新增一個短名稱輸入欄（≤10 字），用 `ph-tag` icon + 底線輸入框呈現。此欄位名稱在用戶送出 Phase 1 後存入 `circlesStepDrafts['L']`（格式：`{ sol1: string, sol2: string, sol3: string | null }`），E 步驟讀取此物件，以用戶自訂名稱取代預設的「方案一／二／三」標籤。**Phase 1 不設「各方案特性」欄位**——方案描述本身已足以提供 E 步驟所需資訊，避免重複填寫。

**Rubric (4 dimensions, total /20 → normalized to /100):**
| Dimension | Max | Description |
|-----------|-----|-------------|
| 方案數量與多樣性 | 5 | 至少 2 個方向，各有不同的核心維度（系統主動 / 用戶主動 / 結構性等） |
| 各方案差異清晰 | 5 | 用一個核心維度清楚劃分方案之間的本質差異，面試官一眼可理解 |
| 方案可行性 | 5 | 方案符合 C2 確立的取捨標準，無明顯業務約束違反 |
| 創意與務實平衡 | 5 | 既有短期可行方案，也有更激進的長期選項，展示思維廣度 |

**Sample score (78/100):**
方案數量與多樣性 4 + 各方案差異清晰 4.4 + 方案可行性 3.6 + 創意與務實平衡 3 = 15/20 → 75（display rounded to 78）

**最強表現：** 方案差異維度清晰——「系統主動 vs. 用戶主動」讓面試官一眼看出思路的方向差距

**最需改進：** 方案三缺失——多一個「結構性改變」選項，能展示更寬的思維廣度

**Phase 1 hint overlay texts (lightbulb buttons):**
- 方案一：「方案一通常是最直接解決優先痛點的路徑。根據 C 步驟的取捨標準，你最優先要解決的是「Feed 相關性不足」——方案一應該直接針對這個問題。說清楚你的方案是什麼、核心機制是什麼，一句話能讓面試官理解你在提什麼。」
- 方案二：「方案二要和方案一有明確的方向差異——不是「更多」而是「不同」。例如：方案一是演算法主動過濾，方案二可以是讓用戶主動控制。多樣性是這個步驟的核心評分維度。如果你的方案二只是方案一的微調，面試官會認為你的思維不夠廣。」
- 方案三（可選）：「方案三是加分項，不是必填。如果你有第三個有意義的方案——通常是更激進或更長期的路徑——加上去能展示你的思維廣度。但如果只是湊數，不填反而更好。方案三和前兩個的差距，應該讓面試官感覺「這是完全不同的思路」。」

**`CIRCLES_STEP_HINTS['L']` array (drill mode field example text):**
```javascript
// 方案一 name: '演算法重排'
// 方案一 body:
'演算法相關性重排——調整 ML 模型，優先展示親密朋友動態，降低陌生粉絲頁比重',
// 方案二 name: '摯友列表'
// 方案二 body:
'用戶主動優先序——推出「摯友列表」，該列表動態永遠優先展示，不受演算法干擾',
// 方案三 name: '分類頁籤'（可選）
// 方案三 body:
'（可選）分類 Feed 頁籤——將朋友動態、廣告、影片拆成不同頁籤，讓用戶自行選擇瀏覽情境'
```

**Phase 2 icebreaker text:**
「問被訪談者這個項目有沒有討論過的方案方向——不是評估哪個最好，而是問「你們考慮過哪幾種做法」。這樣能讓你確認自己的方案有沒有遺漏重要選項。」

**Phase 2 dialogue (4 turns):**

Turn 1:
- 用戶問：「這個項目團隊有沒有討論過哪些可能的解法方向？」
- 被訪談者：「有幾個方向——一個是直接調整演算法，讓 Feed 更偏向親密朋友的動態；另一個是讓用戶自己設定哪些朋友的動態優先。這兩個都在 roadmap 上討論過，但還沒有最終決定哪個先做。」
- 教練點評：「直接拿到兩個不同方向，演算法（系統主動）和用戶控制（用戶主動）各有不同的主動方。這是好的多樣性基礎，繼續確認有沒有更激進的選項。」
- 教練提示（折疊）：「問：「有沒有更激進或更長期的思路，比如把 Feed 整個分類？」」

Turn 2:
- 用戶問：「有沒有更激進的做法，比如把 Feed 整個分類？」
- 被訪談者：「有工程師提過「分類頁籤」——朋友動態、廣告、影片各一個頁籤；不過評估起來改變太大，用戶習慣遷移成本高，暫時放在長期清單。」
- 教練點評：「三個不同方向都到位了：系統端、用戶端、結構性。方案多樣性已足夠，現在確認各方案的特性差距。」
- 教練提示（折疊）：「問：「這三個方向在開發複雜度和見效時間上大概有什麼差距？」」

Turn 3:
- 用戶問：「這三個方向在開發複雜度和見效時間上大概有什麼差距？」
- 被訪談者：「演算法調整最快，單季可見效；用戶控制要做 UI，大概兩個季度；分類頁籤改動最大，沒有一年做不完，廣告的分法還要另外討論。」
- 教練點評：「各方案特性清晰——演算法（快、低複雜）、用戶控制（中等）、分類頁籤（慢、高複雜）。三個維度都拿到了，可以整理提交。」
- 教練提示（折疊）：「整理三個方案各一句話描述核心機制，再補充各自最大的差異特性。」

Turn 4:
- 用戶問：「這三個方向的核心差異是什麼？」
- 被訪談者：「演算法是系統幫用戶決定；用戶控制是用戶自己決定；分類頁籤是改變整個資訊架構。這三種思路本質上完全不同。」
- 教練點評：「用「誰來決定」這個維度清楚分類三個方案，方案多樣性與差異清晰兩個維度都已達標，可以提交。」

**Phase 2 conclusion box spec:**
- title：「整理你這個步驟確認了什麼」
- sub-text：「用 1-2 句話說明：2-3 個方案各一句，並說明各方案核心差異」
- Placeholder：「針對這題，整理你提出的 2-3 個解法方向及各自的核心特性…」
- Example strip（collapsed，不同題目）：「Spotify 免費版廣告體驗：方案一：廣告後自動播放相關歌曲（系統主動，見效快）。方案二：用戶選擇「廣告換無廣告時段」兌換（用戶主動）。差異：系統 vs. 用戶主動兩個維度。」
- AI detection pass hint（length > 30 chars）：「結論涵蓋 2+ 方案並說明核心差異，可以提交」

**Phase 1.5 Gate — L 特殊規則：**

方案三留空時，AI 回傳 gate JSON 須用 `status: 'skip'`（不是 ok / warn / error）：
```json
{ "field": "方案三（可選）", "status": "skip", "title": "未填寫，已跳過", "reason": "選填欄位，不影響審核結果", "suggestion": null }
```

渲染規則：`status: 'skip'` → 使用 `ph-minus-circle` icon（灰色），整個 gate-card 設 `opacity: 0.5`，無邊框高亮，不顯示 suggestion 行。

`canProceed = false` 條件（drill mode）：方案一或方案二有 `error`。方案三 skip 永不影響 canProceed。

**教練示範答案（完整，用於 coach-content HTML）：**
```html
<div style="margin-bottom:8px"><strong>方案一：</strong>演算法相關性重排——調整 ML 模型，優先展示親密朋友動態，降低陌生粉絲頁比重。系統主動，用戶無感，開發集中在 ML 端，單季可見效。</div>
<div style="margin-bottom:8px"><strong>方案二：</strong>用戶主動優先序——推出「摯友列表」，用戶自選誰的動態永遠置頂，不受演算法干擾。廣告主衝擊最小，需要用戶教育。</div>
<div style="margin-bottom:8px"><strong>方案三（可選）：</strong>分類 Feed 頁籤——朋友動態、廣告、影片各自一個頁籤，用戶決定看哪類。最激進，開發週期最長（逾一年），屬長期選項。</div>
<div><strong>各方案特性：</strong>「誰來決定」是核心差異——方案一系統決定、方案二用戶決定、方案三結構改變。開發複雜度遞增：方案一最快（單季），方案二中等（兩季），方案三最長。</div>
```

**Score nav in circles-nav (simulation mode):**
- ◀ (onclick → show C2 step score) — `score-nav-btn`
- ▶ disabled (L is current/latest step) — `score-nav-btn` with `disabled`

**Simulation 模式 submit-bar（L 是第 5/7 步）：** 回首頁 ｜ 繼續下一步：E 評估取捨 →

---

## Mockup HTML — L 提出方案完整互動稿

**Mockup 來源路徑：** `.superpowers/brainstorm/L-step-2026-04-27/content/circles-L-step-mockup.html`（直接用瀏覽器開啟即可預覽）。**此 HTML 是實作的視覺真相來源（canonical visual truth）——若 spec 文字與此畫面有出入，以此 HTML 為準。**

**10 screens（比前四步多一個「P1+方案三」展開狀態）：**
1. `P1 加練` — Phase 1 drill mode，方案三預設隱藏，顯示「新增方案三（可選）」dashed button
2. `P1+提示` — Phase 1，所有四個欄位的 lightbulb 按鈕均可點擊，觸發全域 hint overlay bottom sheet
3. `P1+方案三` — Phase 1，點擊「新增方案三」後展開狀態（帶藍色 3px 左邊框，label 變藍色）
4. `Gate 通過` — canProceed=true，方案三顯示為 skip card（ph-minus-circle, opacity 0.5）
5. `Gate 失敗` — 方案一偏離取捨標準（error）＋方案二與方案一實質相同（error）
6. `P2 早期` — Turn 1：被訪談者給出演算法和用戶控制兩個方向
7. `P2 收斂` — Turn 2-4：問出分類頁籤第三方向 + 複雜度差距比較，收斂至可提交
8. `P2 結論` — 結論框顯示最後一輪對話，example strip 可展開
9. `P3 L評分` — 78 分，4 維度分解，教練示範答案（可展開），score-nav ◀ 顯示 C2 / ▶ disabled
10. `P3 C2評分` — 82 分，展示 ◀ disabled / ▶ 點擊回到 L 評分的 score-nav 功能

**New patterns introduced in L step:**
| Pattern | Class / ID | Description |
|---------|-----------|-------------|
| 方案名稱標籤 | `.sol-name-row` / `.sol-name-input` | 每個方案欄位 `circles-field-label-row` 之後插入一列；`ph-tag` icon + 底線 input（`border-bottom: 1.5px solid var(--border)`，無外框）；placeholder「方案名稱（10 字內）」；font-weight 600 |
| 新增方案三按鈕 | `.add-solution-btn` | Dashed-border button，`display:flex`，點擊後 `display:none` 且展開 `#sol3-group` |
| 方案三展開區 | `#sol3-group` | 預設 `display:none`，展開後帶 `border-left: 3px solid var(--primary)` + `padding-left:12px` |
| 展開/收起函式 | `expandSol3()` / `collapseSol3()` | JS：toggles add-btn 和 sol3-group 的 display |
| 跨步驟名稱資料 | `circlesStepDrafts['L']` | AppState 新欄位；格式 `{ sol1: string, sol2: string, sol3: string \| null }`；Phase 1 送出時儲存，E 步驟讀取以顯示用戶自訂方案名稱 |
| Gate skip card | `.gate-card` + `opacity:.5` | 用 `ph-minus-circle`（gray），無 ok/warn/error border-color，不顯示 suggestion |
| 全域 hint overlay | `#hint-overlay` + `showHint(field, body)` | 所有畫面共用同一個 overlay，P1+提示畫面的四個按鈕均綁定 `onclick="showHint(...)"` |
| 無 emoji 全面改用 phosphor | — | ph-lightbulb（提示）、ph-check-circle（ok）、ph-warning（warn）、ph-x-circle（error）、ph-minus-circle（skip） |

---

## Per-Step Content Reference — E 評估取捨

**Mockup HTML（已完成）：** `.superpowers/brainstorm/E-step-2026-04-27/content/circles-E-step-mockup.html`
（直接用瀏覽器開啟，或 `python -m http.server 8991` 後訪問 `http://localhost:8991/circles-E-step-mockup.html`）

**Mockup 9 screens：**

| Screen | nav-label | 說明 |
|--------|-----------|------|
| 1 | `P1 加練` | Phase 1 drill mode，前步驟摘要卡展開，方案一部分填寫，方案二空白，方案三隱藏（有展開按鈕） |
| 2 | `P1+提示` | hint overlay 展開（成功指標），前步驟摘要卡折疊示意 |
| 3 | `Gate ✓` | canProceed=true；方案一 ok，方案二成功指標 warn，方案三 ok |
| 4 | `Gate ✗` | drill mode canProceed=false；方案一缺點 error，方案二成功指標 warn，底部固定「返回修改」 |
| 5 | `P2 早期` | Turn 1，icebreaker 可見，無 submit row |
| 6 | `P2 收斂` | Turn 4 完成，底部出現「整理結論 →」 |
| 7 | `P2 結論` | 結論框展開，example strip 可折疊，pass hint 綠色 |
| 8 | `P3 E評分` | 分數 81，4 維度，教練示範答案，score-nav ◀L / ▶disabled |
| 9 | `P3 L評分` | L 步驟評分，score-nav ◀disabled / ▶E，展示跨步驟 nav |

---

### Step Key: `E` | Label: E — 評估取捨 | Position: 6/7

**Fields（Phase 1，per-solution 結構）：** 每個方案各自獨立一個 `.e-solution-block` 區塊，包含：優點、缺點、風險與依賴、成功指標。欄位標題使用用戶在 L 步驟輸入的方案名稱（從 `circlesStepDrafts['L']` 讀取），若 sol3 為 null 則方案三區塊隱藏。

> **Phase 1 UI 方向（Option B — per-solution matrix）：** 每個方案各自一個 block，標題列顯示方案編號 badge ＋ 用戶自訂名稱，內部包含 4 個 textarea 欄位。相比「4 綜合欄位」的 Option A，此設計引導力更強——用戶被迫逐一評估每個方案，避免跳過薄弱方案。

> **跨步驟資料依賴：** E 步驟在進入時讀取 `circlesStepDrafts['L']`（`{ sol1, sol2, sol3 }`）顯示方案名稱標籤，讀取 `circlesStepDrafts['C1']`（業務約束）與 `circlesStepDrafts['R']`（核心痛點 Phase 2 結論）填入前步驟摘要卡。若對應 draft 不存在，回退為預設標籤／空字串。

**Rubric (4 dimensions, total /20 → normalized to /100):**
| Dimension | Max | Description |
|-----------|-----|-------------|
| 評估完整性 | 5 | 每個方案都有明確的優缺點，無遺漏 |
| 風險識別 | 5 | 能點出每個方案最關鍵的風險或依賴條件 |
| 成功指標具體性 | 5 | 成功指標可量化，與用戶痛點直接掛鉤 |
| 取捨判斷清晰 | 5 | 能說明方案之間的關鍵取捨，為最終推薦做鋪墊 |

---

### Phase 1 Layout（完整結構順序）

```
circles-nav (← | E — 評估取捨 · Company | 回首頁)
circles-progress (7 segments, position 6/7)
[Scrollable: scroll-body, padding-bottom:120px]
  circles-step-pills (7 pills, E active)
  problem-card (題目全文)
  prev-step-card (前步驟重點參考，預設展開，可折疊)  ← NEW
  e-solution-block × 2（方案一、方案二，各含 4 fields）
  e-solution-block × 1（方案三，id="e-sol3-block"，條件顯示）
  e-sol3-add-btn（dashed 按鈕，有 sol3 時出現；點擊展開 sol3 block）
[Fixed: submit-bar (返回選題 | 提交審核)]
```

**Phase 1 欄位 per-solution 結構（每個方案各含以下 4 個 textarea）：**

```
方案一・[sol1 name]
  ├── 優點          placeholder: 這個方案的核心優勢是什麼？
  ├── 缺點          placeholder: 最大的劣勢或限制？
  ├── 風險與依賴    placeholder: 實施這個方案需要什麼前提條件？
  └── 成功指標      placeholder: 如何衡量這個方案是否成功？

方案二・[sol2 name]
  └── （同上 4 欄）

方案三・[sol3 name]（當 circlesStepDrafts['L'].sol3 存在時才顯示）
  └── （同上 4 欄）
```

---

### 前步驟重點參考卡（`.prev-step-card`）

**位置：** `problem-card` 下方、第一個 `.e-solution-block` 上方。  
**預設狀態：** 展開（body 可見）。點擊標題列切換折疊／展開，caret icon 同步切換。  
**資料來源：** 從 `circlesStepDrafts` 讀取；若 draft 不存在顯示「—」。

| 列 | 欄位 label | 資料來源 |
|----|-----------|---------|
| C1 業務約束 | `C1 業務約束` | `circlesStepDrafts['C1']['業務影響']`（Phase 1 填寫值） |
| R 核心痛點 | `R 核心痛點` | `circlesStepDrafts['R']['conclusion']`（Phase 2 結論文字） |
| L 方案 | `L 方案` | `circlesStepDrafts['L'].sol1 + sol2 + sol3`，格式：`① sol1name ② sol2name [③ sol3name]` |

**HTML：**

```html
<div class="prev-step-card">
  <button class="prev-step-toggle" onclick="togglePrevCard(this)">
    <span class="prev-step-toggle-title">
      <i class="ph ph-clock-counter-clockwise"></i> 前步驟重點參考
    </span>
    <i class="ph ph-caret-down toggle-caret"></i>
  </button>
  <div class="prev-step-body">
    <div class="prev-step-row">
      <span class="prev-step-label">C1 業務約束</span>
      <span class="prev-step-val">（circlesStepDrafts['C1']['業務影響'] 的值，或「—」）</span>
    </div>
    <div class="prev-step-row">
      <span class="prev-step-label">R 核心痛點</span>
      <span class="prev-step-val">（circlesStepDrafts['R']['conclusion'] 的值，或「—」）</span>
    </div>
    <div class="prev-step-row">
      <span class="prev-step-label">L 方案</span>
      <span class="prev-step-val">① sol1name ② sol2name（③ sol3name，有時顯示）</span>
    </div>
  </div>
</div>
```

**JS `togglePrevCard`：**

```javascript
function togglePrevCard(btn) {
  var body = btn.nextElementSibling;
  if (!body) return;
  var open = body.style.display !== 'none';
  body.style.display = open ? 'none' : 'block';
  var caret = btn.querySelector('.toggle-caret');
  if (caret) caret.className = open ? 'ph ph-caret-right toggle-caret' : 'ph ph-caret-down toggle-caret';
}
```

**CSS（全部使用既有 token，不新增 token）：**

```css
.prev-step-card {
  background: var(--c-card);
  border: 1px solid var(--c-border);
  border-radius: 10px;
  margin-bottom: 14px;
  overflow: hidden;
}
.prev-step-toggle {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: none;
  border: none;
  cursor: pointer;
  padding: 10px 14px;
  text-align: left;
  font-family: 'DM Sans', sans-serif;
}
.prev-step-toggle-title {
  font-size: 11px;
  font-weight: 700;
  color: var(--c-text-2);
  display: flex;
  align-items: center;
  gap: 5px;
}
.toggle-caret {
  font-size: 11px;
  color: var(--c-text-3);
  flex-shrink: 0;
}
.prev-step-body {
  padding: 0 14px 12px;
}
.prev-step-row {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  padding: 7px 0;
  border-top: 1px solid var(--c-border);
}
.prev-step-row:first-child {
  border-top: none;
}
.prev-step-label {
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .07em;
  color: var(--c-text-3);
  white-space: nowrap;
  padding-top: 2px;
  min-width: 60px;
  font-family: 'DM Sans', sans-serif;
}
.prev-step-val {
  font-size: 12px;
  color: var(--c-text-2);
  line-height: 1.55;
  font-family: 'DM Sans', sans-serif;
}
```

---

### Per-Solution Block CSS

```css
.e-solution-block {
  background: var(--c-card);
  border-radius: 12px;
  border: 1.5px solid var(--c-border);
  margin-bottom: 14px;
  overflow: hidden;
}
.e-sol-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 14px 10px;
  border-bottom: 1px solid var(--c-border);
  background: #fafaf9;
}
.e-sol-badge {
  font-size: 11px;
  font-weight: 700;
  color: var(--c-primary);
  background: var(--c-primary-lt);
  border-radius: 99px;
  padding: 2px 9px;
  white-space: nowrap;
  font-family: 'DM Sans', sans-serif;
  flex-shrink: 0;
}
.e-sol-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--c-text);
  font-family: 'DM Sans', sans-serif;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.e-sol-fields {
  padding: 12px 14px 6px;
}
```

方案三（sol3 可選）的 badge 與 sol-name 用灰色降調（參考 mockup）：

```html
<!-- sol3 badge（選填狀態） -->
<span class="e-sol-badge" style="background:rgba(0,0,0,0.05);color:var(--c-text-3)">方案三</span>
<span class="e-sol-name" style="color:var(--c-text-3)">分類 Feed 頁籤</span>
```

---

### Phase 1 hint overlay texts（每個方案共用同一組）

- **優點：**「優點要具體——不是「用戶喜歡」，而是「直接解決 Feed 相關性問題，系統主動，用戶無感」。說出這個方案「為什麼比其他方案更適合解決這個問題」。」
- **缺點：**「缺點不是說「這個方案不好」，而是誠實說「這個方向的侷限在哪裡」。面試官希望看到你能清楚識別方案的邊界，而不是只看到優點。」
- **風險與依賴：**「風險是「如果 X 沒有達成，這個方案就會失敗」。常見的有：資料依賴（需要哪些 ML 訓練資料）、用戶行為假設（用戶願意主動設定）、業務約束（廣告收入不能下降超過 N%）。」
- **成功指標：**「成功指標要和你在 R 步驟確認的核心痛點掛鉤。如果核心痛點是「Feed 相關性不足」，成功指標應該是「用戶在 Feed 上的停留時間提升 X%」或「廣告點擊率維持在 Y% 以上」。」

---

### `CIRCLES_STEP_HINTS['E']` array（drill mode field example text，對應欄位順序）

```javascript
CIRCLES_STEP_HINTS['E'] = [
  // 方案一 優點
  '演算法方案優點：系統主動過濾，用戶無需改變行為；ML 端優化，開發週期最短（單季）',
  // 方案一 缺點
  '演算法方案缺點：黑盒決策，用戶感知不透明；廣告相關性可能連帶下降，影響廣告主收益',
  // 方案一 風險與依賴
  '依賴足夠的用戶社交圖譜資料；廣告收入影響需事先 A/B test 量化上限',
  // 方案一 成功指標
  'Feed 停留時間提升 ≥ 15%；朋友動態互動率（like/comment）提升 ≥ 20%；廣告 CTR 下降 ≤ 5%',
];
```

---

### Phase 2 icebreaker text

「問被訪談者：「這幾個方案你們在評估時，最擔心的風險是什麼？」——不是問哪個最好，而是問顧慮。這樣能讓你確認自己的風險識別有沒有遺漏關鍵的業務約束。」

### Phase 2 dialogue（4 turns，Meta News Feed 題）

Turn 1:
- 用戶問：「這幾個方案在評估時，你們最擔心哪個風險？」
- 被訪談者：「最擔心的是廣告收益的影響。演算法方案如果過濾太強，廣告曝光量會下降——這個數字內部對一個百分點都很敏感。」
- 教練點評：「直接拿到業務約束：廣告收益是硬性指標，不能下降超過某個閾值。把這個加入演算法方案的風險欄位，同時確認其他方案是否也有類似的業務約束。」
- 教練提示（折疊）：「問：「摯友列表方案呢？有沒有擔心用戶不願意主動設定的問題？」」

Turn 2:
- 用戶問：「摯友列表方案有沒有擔心用戶不願意主動設定？」
- 被訪談者：「對，這是用戶教育成本的問題。Facebook 上大多數用戶是被動使用的，主動去設定「誰是摯友」這個動作，歷史上推過一次，採用率很低。」
- 教練點評：「摯友列表的核心風險出來了：用戶採用率低（行為假設失效）。這比功能本身的技術複雜度更根本。加入缺點或風險欄位。」
- 教練提示（折疊）：「問：「那分類頁籤方案的評估呢？」」

Turn 3:
- 用戶問：「分類頁籤方案，你們內部評估下來最大的阻力是什麼？」
- 被訪談者：「改動太大了——整個 Feed 的資訊架構要重新設計，廣告的分類歸屬也要重新談。這個方案估計要超過一年才能上線，而且對廣告主的影響最不可預測。」
- 教練點評：「分類頁籤三個風險都到位了：開發週期最長、廣告業務影響最不可預測、資訊架構改動量大。這個方案的缺點和風險都很清楚，可以整理提交。」
- 教練提示（折疊）：「整理三個方案各自的成功指標，讓評估結果能為 S 步驟的推薦做鋪墊。」

Turn 4:
- 用戶問：「如果要衡量每個方案是否成功，你覺得最關鍵的指標是什麼？」
- 被訪談者：「演算法方案看 Feed 停留時間和廣告 CTR；摯友列表看採用率和重複使用率；分類頁籤看頁籤切換行為和各分類的留存。三個方案衡量的指標本質上完全不同。」
- 教練點評：「每個方案的成功指標各自清晰，且都和原始用戶痛點掛鉤。評估完整性和成功指標具體性兩個維度已達標，可以提交。」

### Phase 2 conclusion box spec

- title：「整理你這個步驟評估了什麼」
- sub-text：「用 2-3 句話說明：各方案最關鍵的優缺點，以及你認為哪個方向最值得推薦」
- Placeholder：「整理各方案的優缺點與風險，說明哪個方案最值得推薦及理由…」
- Example strip（collapsed，不同題目）：「Spotify 免費版廣告體驗三個方案評估：廣告後推薦（優：系統主動，缺：可能推錯）；時段兌換（優：用戶主動，缺：採用率低）；分層訂閱（優：商業模式清晰，缺：開發週期長）。推薦廣告後推薦，短期可行且用戶無感。」
- AI detection pass hint（length > 30 chars）：「✓ 結論涵蓋多方案比較並說明推薦方向，可以提交」

---

### Phase 1.5 Gate — E 審核邏輯

`canProceed = false` 條件（drill mode 限定）：方案一或方案二有任何一個必填欄位（優點、缺點、風險與依賴、成功指標）出現 `error`。

方案三：若整個 sol3 區塊存在且用戶已填寫，至少需要填寫優點與缺點；sol3 整體缺失（L 未填方案三）時不影響 canProceed。

Simulation mode：即使有 error，`canProceed = true`（行為與所有其他步驟一致）。

---

### 教練示範答案（完整，用於 `.coach-content` HTML）

```html
<div style="margin-bottom:12px">
  <strong>方案一・演算法重排</strong><br>
  優點：系統主動，用戶無感，開發集中在 ML 端，單季可見效。<br>
  缺點：黑盒決策，廣告相關性可能連帶下降。<br>
  風險：依賴社交圖譜資料；廣告 CTR 需 A/B test 設底線。<br>
  成功指標：Feed 停留時間 ↑15%；朋友動態互動率 ↑20%；廣告 CTR 降幅 ≤5%。
</div>
<div style="margin-bottom:12px">
  <strong>方案二・摯友列表</strong><br>
  優點：廣告衝擊最小，用戶主動控制，無演算法爭議。<br>
  缺點：歷史採用率低，用戶教育成本高。<br>
  風險：行為假設失效（用戶不願主動設定）。<br>
  成功指標：摯友列表採用率 ≥20%；設定後 30 天留存率 ↑10%。
</div>
<div style="margin-bottom:12px">
  <strong>方案三・分類頁籤</strong><br>
  優點：最徹底的結構性解法，用戶自主選擇瀏覽情境。<br>
  缺點：開發週期最長（逾一年）；廣告歸類方式需重新談。<br>
  風險：廣告主配合度不確定；用戶習慣遷移成本高。<br>
  成功指標：頁籤切換率 ≥30%；各分類 7 日留存率持平或提升。
</div>
```

---

### Score nav（simulation mode）

- ◀ `onclick → show L step score` — `.score-nav-btn`
- ▶ disabled（E 是目前最新完成步驟） — `.score-nav-btn[disabled]`

### Simulation 模式 submit-bar（E 是第 6/7 步）

回首頁 ｜ 繼續下一步：S 總結推薦 →

---

### New patterns introduced in E step

| Pattern | Class / ID | Description |
|---------|-----------|-------------|
| 前步驟摘要卡 | `.prev-step-card` | problem-card 下方，預設展開，可折疊；讀取 C1/R/L drafts |
| 摘要卡 toggle | `.prev-step-toggle` + `.toggle-caret` | 點擊標題列切換；caret 隨展開狀態切換 `ph-caret-down` / `ph-caret-right` |
| 摘要卡列 | `.prev-step-row` + `.prev-step-label` + `.prev-step-val` | 每列一條跨步驟資訊；label uppercase + letter-spacing，與 `.circles-field-label` 同規格 |
| Per-solution 區塊 | `.e-solution-block` | 每個方案一個 block，標題列 + 4 個 `.circles-field-group` |
| 方案名稱標題列 | `.e-sol-header` + `.e-sol-badge` + `.e-sol-name` | 左側 badge（圓角，primary-lt 底）+ 右側 sol-name；從 `circlesStepDrafts['L']` 注入 |
| Sol3 條件渲染 | `#e-sol3-block` + `#e-sol3-add-btn` | block 預設 `display:none`；add-btn（dashed border）點擊後顯示 block、隱藏自身 |

---

## Screen 7: NSM Step 1 — Question Selection (`renderNSMStep1`)

### 3 Sub-States

**State A — Unselected** (default): 5 question cards, no CTA at bottom
**State B — Loading**: selected card shows loading spinner inside; CTA disabled
**State C — Loaded**: selected card shows context card with 4 rows; CTA enabled

### Navbar

```html
<div class="nsm-navbar">
  <button class="btn-icon" id="btn-nsm-back"><i class="ph ph-arrow-left"></i></button>
  <span class="nsm-title">北極星指標 (NSM) 訓練</span>
</div>
```

Back button from Step 1 → `navigate('circles')` (main CIRCLES home)

CSS:
```css
.nsm-navbar { display: flex; align-items: center; gap: 10px; padding: 12px 16px 10px; background: var(--c-card); border-bottom: 1px solid var(--c-border); }
.nsm-title { font-size: 15px; font-weight: 700; flex: 1; font-family: 'DM Sans', sans-serif; color: var(--c-text); }
.nsm-home-btn { font-size: 12px; color: var(--c-primary); border-bottom: 1px solid var(--c-primary); background: none; border-top: none; border-left: none; border-right: none; padding: 2px 0; cursor: pointer; font-family: 'DM Sans', sans-serif; white-space: nowrap; flex-shrink: 0; }
```

### Question Selection (5 random, same pattern as CIRCLES)

Type tabs: 全部 / 電商 / 社群 / SaaS. 隨機選題 button.

Questions show 5 random from NSM_QUESTIONS. Clicking a card:
1. Adds `.selected` class to that card
2. Removes `.selected` from others
3. Immediately renders loading state inside card
4. Fetches AI context analysis
5. Renders loaded state with 4-row context card inside card

### NSM Question Card

```html
<div class="nsm-q-card" id="nsm-qcard-0">
  <div class="nsm-q-company">Duolingo</div>
  <div class="nsm-q-meta"><span class="nsm-badge">學習App</span>語言學習 · 保留率優化</div>
  <!-- Context card appended here after selection -->
</div>
```

`.selected` state:
```css
.nsm-q-card.selected { border-color: var(--c-primary); background: var(--c-primary-lt); }
```

### Context Card (State C, inside selected card)

```html
<div class="nsm-context-preview">
  <div class="nsm-ctx-row">
    <span class="nsm-ctx-label"><i class="ph ph-buildings"></i> 商業模式</span>
    <span class="nsm-ctx-val">靠訂閱（Super）與廣告變現；核心是讓用戶每天回來完成課程進而付費升級</span>
  </div>
  <div class="nsm-ctx-row">
    <span class="nsm-ctx-label"><i class="ph ph-users"></i> 使用者</span>
    <span class="nsm-ctx-val">主要是想學外語但沒時間上課的成人，用碎片時間做短課練習</span>
  </div>
  <div class="nsm-ctx-row nsm-ctx-trap">
    <span class="nsm-ctx-label"><i class="ph ph-warning"></i> 常見陷阱</span>
    <span class="nsm-ctx-val">把「下載數」或「DAU」當 NSM——用戶登入卻沒學習，無法反映真實語言進步</span>
  </div>
  <div class="nsm-ctx-row nsm-ctx-angle">
    <span class="nsm-ctx-label"><i class="ph ph-lightbulb"></i> 破題切入</span>
    <span class="nsm-ctx-val">聚焦「學習行為完成」而非「登入次數」——有效學習才是 Duolingo 的核心價值交付</span>
  </div>
</div>
```

Loading state inside card:
```html
<div class="nsm-context-preview loading">
  <i class="ph ph-circle-notch" style="animation:spin 0.8s linear infinite;font-size:14px"></i>
  <span>分析情境中…</span>
</div>
```

CSS:
```css
.nsm-context-preview { margin-top: 10px; padding: 12px; border-radius: 10px; background: var(--c-card); border: 1px solid var(--c-border); display: flex; flex-direction: column; gap: 8px; }
.nsm-context-preview.loading { flex-direction: row; align-items: center; gap: 8px; color: var(--c-text-2); font-size: 13px; }
.nsm-ctx-row { display: flex; flex-direction: column; gap: 2px; }
.nsm-ctx-label { font-size: 10.5px; font-weight: 700; color: var(--c-text-2); text-transform: uppercase; letter-spacing: 0.05em; display: flex; align-items: center; gap: 4px; font-family: 'DM Sans', sans-serif; }
.nsm-ctx-val { font-size: 12.5px; color: var(--c-text); line-height: 1.5; font-family: 'DM Sans', sans-serif; }
.nsm-ctx-trap .nsm-ctx-label { color: #D92020; }
.nsm-ctx-trap .nsm-ctx-val { color: #D92020; opacity: 0.85; }
.nsm-ctx-angle .nsm-ctx-label { color: var(--c-primary); }
.nsm-ctx-angle .nsm-ctx-val { color: var(--c-primary); font-weight: 600; }
```

### Sticky CTA at Bottom

Rendered inside the question list scroll area:
```html
<div style="position:sticky;bottom:0;background:var(--c-card);border-top:1px solid var(--c-border);padding:12px 16px;margin:0 -16px -100px">
  <button class="circles-btn-primary" style="width:100%" id="nsm-start-btn" [disabled when not loaded]>開始練習</button>
</div>
```

- State A/B: `opacity:.45;cursor:not-allowed;disabled`
- State C: normal, enabled → navigates to NSM Step 2

---

## Screen 8: NSM Steps 2 / Gate / 3

This screen has 3 sub-tabs: 步驟2 / NSM審核 / 步驟3.

### Sub-Tab Navigation

```html
<!-- Sub-tabs (only in mockup for navigation; in app, this is driven by state) -->
<div class="sub-tabs">
  <button class="sub-tab active" onclick="switchNSMStep('nsm-step2')">步驟 2：定義 NSM</button>
  <button class="sub-tab" onclick="switchNSMStep('nsm-gate')">NSM 審核</button>
  <button class="sub-tab" onclick="switchNSMStep('nsm-step3')">步驟 3：拆解指標</button>
</div>
```

In production: user flows 步驟2 → Gate → 步驟3. No manual tab switching.

### NSM Step 2 — Define NSM

Navbar: `← | 定義 NSM | 回首頁` (回首頁 resets NSM state, navigate to nsm home)

```
Company context card (read-only, 1 paragraph)
3 field groups:
  1. 北極星指標 (NSM) — input (single line)
  2. 定義說明 — textarea
  3. 與業務目標的連結 — textarea
Each field has: label + collapsible 查看範例 button + example body + input/textarea
Sticky bottom: 提交審核 button → navigates to Gate
```

**Field example pattern** (collapsible, closed by default):
```html
<div class="nsm-field-group">
  <div class="nsm-field-label">北極星指標 (NSM)</div>
  <button onclick="toggleFieldHint(this)" class="nsm-example-toggle"><i class="ph ph-caret-right"></i> 查看範例</button>
  <div class="nsm-example-body" style="display:none">
    <div class="circles-field-hint" style="margin:0">例 (Spotify)：每月完成至少一首完整曲目播放的活躍月用戶數 — 反映真正的聆聽行為，非背景播放</div>
  </div>
  <input class="nsm-input" placeholder="用一句話定義你的 NSM，包含量化描述...">
</div>
```

**Canonical examples (Spotify, not Duolingo — to avoid copying):**

1. 北極星指標: `例 (Spotify)：每月完成至少一首完整曲目播放的活躍月用戶數 — 反映真正的聆聽行為，非背景播放`
2. 定義說明: `例 (Spotify)：區分「被動背景播放」與「主動完整聆聽」，後者才代表用戶真正得到價值，避免被播放次數虛高誤導`
3. 與業務目標的連結: `例 (Spotify)：Spotify 的收入來自 Premium 訂閱與廣告，深度聆聽的用戶更容易感受到廣告干擾進而付費升級，且留存率較高代表獲客成本（CAC）被更多用戶週期攤薄。NSM 若能捕捉「真正在聽音樂」的行為，就能同時作為訂閱轉化與廣告效益的領先指標`

**RULE:** Examples must only use publicly-reasoned information. No internal metrics, no specific % data no one would know. All jargon must be explained inline (e.g., "獲客成本（CAC）" not just "CAC").

`toggleFieldHint` JS:
```javascript
function toggleFieldHint(btn) {
  var body = btn.nextElementSibling;
  if (!body) return;
  var open = body.style.display !== 'none';
  body.style.display = open ? 'none' : 'block';
  var icon = btn.querySelector('i');
  if (icon) icon.className = open ? 'ph ph-caret-right' : 'ph ph-caret-down';
  btn.style.color = open ? 'var(--c-text-3)' : 'var(--c-primary)';
}
```

CSS:
```css
.nsm-field-group { margin-bottom: 16px; }
.nsm-field-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: var(--c-text-3); margin-bottom: 6px; font-family: 'DM Sans', sans-serif; }
.nsm-input { width: 100%; background: var(--c-card); border: 1.5px solid var(--c-border); border-radius: 8px; padding: 10px 12px; font-size: 13px; font-family: 'DM Sans', sans-serif; color: var(--c-text); outline: none; }
.nsm-textarea { width: 100%; background: var(--c-card); border: 1.5px solid var(--c-border); border-radius: 8px; padding: 10px 12px; font-size: 13px; font-family: 'DM Sans', sans-serif; color: var(--c-text); resize: none; outline: none; min-height: 80px; }
.nsm-example-toggle { background: none; border: none; padding: 0; font-size: 11px; color: var(--c-text-3); cursor: pointer; display: flex; align-items: center; gap: 3px; font-family: 'DM Sans', sans-serif; margin-bottom: 4px; }
.nsm-example-toggle i { font-size: 10px; }
.nsm-example-body { margin-bottom: 6px; }
```

### NSM Gate — Quality Review

Navbar: `← | NSM 品質審核 | 回首頁`

This gate reviews 4 criteria (hardcoded labels, values from AI):

| Field | Description |
|-------|-------------|
| 指標明確性 | Is the NSM concrete and quantifiable? |
| 虛榮指標辨別 | Did the user exclude vanity metrics? |
| 業務目標連結 | Is the NSM linked to business value? |
| 可拆解性 | Can the NSM be decomposed into dimensions? |

**Pass state:** green `gate-transition-bar` with "NSM 定義通過審核，可以進入拆解指標" + 繼續 button → navigates to Step 3. Per-field items with ok/warn/error status.

**Fail state:** red error bar "NSM 定義有根本性問題，請修正後再提交". Error items. Fixed bottom: 返回修改 button → back to Step 2.

Gate item structure identical to CIRCLES gate (same CSS classes). See Screen 4 for CSS.

Backend endpoint to add:
```
POST /api/nsm-sessions/:id/gate  (or /api/guest/nsm-sessions/:id/gate)
Body: { nsmDraft: { nsm, definition, businessLink } }
Returns: { items: [{field, status, title, reason, suggestion}], canProceed, overallStatus }
```

Prompt: `prompts/nsm-gate.js` — similar to `circles-gate.js` but evaluates the 4 NSM criteria.

### NSM Step 3 — Breakdown

Navbar: `← | 拆解指標 | 回首頁`

NSM summary card at top (blue, shows their defined NSM):
```html
<div style="background:#EEF3FF;border-radius:10px;border:1px solid #C5D5FF;padding:12px 14px;margin-bottom:16px;font-size:13px;color:var(--c-primary)">
  <strong>你的 NSM：</strong>（user's NSM text）
</div>
```

**4 Dimensions** (for attention-type products like Duolingo):

| Dimension | Color | Coach Question |
|-----------|-------|----------------|
| 觸及廣度 | #3b82f6 (blue) | AHA 時刻是什麼動作？做到這個動作的人有多少？ |
| 互動深度 | #8b5cf6 (purple) | 用戶停得夠深嗎？時長、完課率、互動次數哪個更能反映價值？ |
| 習慣頻率 | #10b981 (green) | 每週/每月回來幾次？DAU/MAU 比越高代表黏性越強 |
| 留存驅力 | #f59e0b (amber) | 社交關係？個人化推薦？Streak？找出最強的留存槓桿 |

Different product types have different dimension labels. See `NSM_DIMENSION_CONFIGS` in `public/app.js` for the mapping.

**Each dimension section:**
```html
<div class="nsm-dim-section">
  <div class="nsm-dim-header" style="border-left-color:[COLOR]">
    <div class="nsm-dim-label">觸及廣度</div>
    <div class="nsm-dim-desc">有多少用戶真正觸碰到核心功能（非僅登入）</div>
  </div>
  <div class="nsm-coach-q">
    <i class="ph ph-chat-dots" style="color:[COLOR];flex-shrink:0"></i>
    （coach question text）
  </div>
  <!-- Collapsible example (different company, Figma) -->
  <button onclick="toggleFieldHint(this)" class="nsm-example-toggle"><i class="ph ph-caret-right"></i> 查看範例</button>
  <div class="nsm-example-body" style="display:none">
    <div class="circles-field-hint" style="margin:0">例 (Figma)：（example text）</div>
  </div>
  <!-- 3-state AI hint button -->
  <div class="nsm-hint-state" id="hint-reach-default">
    <button class="nsm-hint-btn" style="border-color:[COLOR];color:[COLOR]">
      <i class="ph ph-lightbulb"></i> 查看教練提示
    </button>
  </div>
  <div class="nsm-hint-state" id="hint-reach-loading" style="display:none">
    <button class="nsm-hint-btn" style="border-color:[COLOR];color:[COLOR]" disabled>
      <i class="ph ph-circle-notch" style="animation:spin 0.8s linear infinite"></i> 生成提示中…
    </button>
  </div>
  <div class="nsm-hint-state" id="hint-reach-revealed" style="display:none">
    <div class="nsm-hint-content">
      <div class="nsm-hint-revealed" style="border-left-color:[COLOR]">（hint text）</div>
    </div>
    <button class="nsm-hint-btn" style="border-style:solid;font-weight:400;font-size:11px;color:var(--c-text-2);border-color:var(--c-border)">收起提示</button>
  </div>
  <textarea class="nsm-textarea" placeholder="（dimension-specific placeholder）" rows="2"></textarea>
</div>
```

**Canonical examples (Figma — different company from Duolingo question):**
- 觸及廣度: `例 (Figma)：每月至少建立過一個設計框架的活躍用戶數 — 只登入但沒設計不算觸及核心價值`
- 互動深度: `例 (Figma)：每個 session 平均新增或修改的元素數 ≥ 5 — 衡量「真正在設計」而非開著標籤頁沒動`
- 習慣頻率: `例 (Figma)：每週使用核心設計功能 ≥ 3 天的帳號比例 — 判斷 Figma 是否真正嵌入日常工作流`
- 留存驅力: `例 (Figma)：擁有 ≥ 2 個協作者的用戶 60 日留存率 — 社交鎖定是 Figma 最強護城河，共同作業讓人難以離開`

CSS:
```css
.nsm-dim-section { background: var(--c-card); border-radius: 12px; border: 1px solid var(--c-border); padding: 14px; margin-bottom: 12px; }
.nsm-dim-header { border-left: 3px solid #3b82f6; padding-left: 8px; margin-bottom: 8px; }
.nsm-dim-label { font-size: 13px; font-weight: 700; color: var(--c-text); font-family: 'DM Sans', sans-serif; }
.nsm-dim-desc { font-size: 11.5px; color: var(--c-text-2); margin-top: 2px; font-family: 'DM Sans', sans-serif; }
.nsm-coach-q { font-size: 12px; color: var(--c-text-2); font-style: italic; margin-bottom: 10px; line-height: 1.5; font-family: 'DM Sans', sans-serif; display: flex; gap: 5px; align-items: flex-start; }
.nsm-hint-btn { display: flex; align-items: center; gap: 6px; width: 100%; background: transparent; border: 1.5px dashed var(--c-primary); border-radius: 8px; padding: 7px 12px; margin-bottom: 8px; font-size: 12.5px; font-weight: 600; color: var(--c-primary); cursor: pointer; min-height: 36px; font-family: 'DM Sans', sans-serif; }
.nsm-hint-content { margin-bottom: 8px; }
.nsm-hint-revealed { background: var(--c-primary-lt); border-radius: 8px; padding: 10px 12px; font-size: 13px; color: var(--c-text); line-height: 1.6; border-left: 3px solid var(--c-primary); font-family: 'DM Sans', sans-serif; }
```

---

## Screen 9: NSM Step 4 — Result (`renderNSMStep4`)

> ⚠️ **DO NOT CHANGE THIS SCREEN.** Copy the existing implementation exactly. CSS uses OLD token names (`var(--accent)`, `var(--bg-surface)`, `var(--border)`, `var(--text-secondary)`, `var(--text-primary)`) — do NOT migrate to CIRCLES tokens.

### Structure

4-tab report: **總覽 / 對比 / 亮點 / 完成**

**Loading state** (when `!scores.scores`):
```html
<div class="nsm-view">
  <div class="nsm-navbar">
    <button class="btn-icon" id="btn-nsm-back"><i class="ph ph-house"></i></button>
    <span class="nsm-title">NSM 報告</span>
    <div class="nsm-navbar-spacer"></div>
  </div>
  <div class="nsm-loading-state">
    <i class="ph ph-circle-notch"></i>
    <p>載入報告中…</p>
  </div>
</div>
```

**Full render** (when `scores.scores` exists):
```html
<div class="nsm-view">
  <div class="nsm-navbar">
    <button class="btn-icon" id="btn-nsm-back"><i class="ph ph-house"></i></button>
    <span class="nsm-title">NSM 報告</span>
    <div class="nsm-navbar-spacer"></div>
  </div>
  <!-- Score summary bar -->
  <div class="nsm-score-summary">
    <div class="nsm-total-score">{total}</div>
    <div class="nsm-score-label-sm">/ 100</div>
    <div class="nsm-score-company">{q.company}</div>
  </div>
  <!-- Tab bar -->
  <div class="tab-bar">
    <button class="tab-btn active" data-nsm-tab="overview">總覽</button>
    <button class="tab-btn" data-nsm-tab="comparison">對比</button>
    <button class="tab-btn" data-nsm-tab="highlights">亮點</button>
    <button class="tab-btn" data-nsm-tab="export">完成</button>
  </div>
  <!-- Tab body (only active tab rendered) -->
  <div class="nsm-report-body">
    {tabContent[activeTab]}
  </div>
</div>
```

`AppState.nsmReportTab` holds the active tab ('overview' | 'comparison' | 'highlights' | 'export'). Tab switch → `AppState.nsmReportTab = btn.dataset.nsmTab; render();`

---

### Tab 1: 總覽 (overview)

```html
<div class="nsm-report-overview">
  <!-- Radar SVG (via renderNSMRadar) -->
  <div class="nsm-radar-wrap">{radarSvg}</div>
  <!-- 5 dimension rows -->
  <div class="nsm-score-row">
    <div class="nsm-score-label">{d.label}</div>
    <div class="nsm-score-bar-wrap"><div class="nsm-score-bar-fill" style="width:{pct}%;background:{d.color}"></div></div>
    <div class="nsm-score-num">{val}/5</div>
  </div>
  <div class="nsm-dim-comment">{comment}</div>
  <!-- Repeat for all 5 dims -->
</div>
```

**5 dimensions** (in order):
| key | label | color |
|-----|-------|-------|
| `alignment` | 價值關聯 | `#6c63ff` |
| `leading` | 領先指標 | `#3b82f6` |
| `actionability` | 操作性 | `#10b981` |
| `simplicity` | 可理解性 | `#f59e0b` |
| `sensitivity` | 週期敏感 | `#ef4444` |

---

### `renderNSMRadar(scores)` — exact code

```javascript
function renderNSMRadar(scores) {
  const dims = Object.keys(NSM_DIM_LABELS);
  const size = 260;
  const cx = size / 2, cy = size / 2, r = 80;
  const n = dims.length;
  const toXY = (i, val) => {
    const angle = (Math.PI * 2 * i / n) - Math.PI / 2;
    const rv = (val / 5) * r;
    return [cx + rv * Math.cos(angle), cy + rv * Math.sin(angle)];
  };
  const labelXY = (i) => {
    const angle = (Math.PI * 2 * i / n) - Math.PI / 2;
    return [cx + (r + 32) * Math.cos(angle), cy + (r + 32) * Math.sin(angle)];
  };
  const circles = [0.25, 0.5, 0.75, 1].map(f =>
    `<circle cx="${cx}" cy="${cy}" r="${r*f}" fill="none" stroke="var(--border)" stroke-width="1"/>`
  ).join('');
  const axes = dims.map((_, i) => {
    const [x, y] = toXY(i, 5);
    return `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="var(--border)" stroke-width="1"/>`;
  }).join('');
  const points = dims.map((d, i) => toXY(i, scores[d] || 0).join(',')).join(' ');
  const polygon = `<polygon points="${points}" fill="var(--accent)" fill-opacity="0.25" stroke="var(--accent)" stroke-width="2"/>`;
  const labels = dims.map((d, i) => {
    const [x, y] = labelXY(i);
    return `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="middle" font-size="10" fill="var(--text-secondary)">${NSM_DIM_LABELS[d]}</text>`;
  }).join('');
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${circles}${axes}${polygon}${labels}</svg>`;
}
```

---

### Tab 2: 對比 (comparison)

```html
<div class="nsm-comparison">
  <!-- Left: user's breakdown -->
  <div class="nsm-tree-col">
    <div class="nsm-tree-title"><i class="ph ph-user"></i> 你的拆解</div>
    <div class="nsm-tree-node nsm-tree-root" data-node="user-nsm" data-label="NSM">{userNsm}</div>
    <!-- one node per cmpDims[i] -->
    <div class="nsm-tree-node" data-node="user-{d.key}" data-label="{d.label}">{userBreakdown[d.key]}</div>
  </div>
  <!-- Right: coach's breakdown -->
  <div class="nsm-tree-col">
    <div class="nsm-tree-title"><i class="ph ph-graduation-cap"></i> 教練版本 <span class="nsm-tree-hint-tip">點擊查看思路</span></div>
    <div class="nsm-tree-node nsm-tree-root nsm-tree-coach" data-node="coach-nsm" data-label="NSM" data-is-coach="1">{coachTree.nsm}</div>
    <div class="nsm-tree-node nsm-tree-coach" data-node="coach-{d.key}" data-label="{d.label}" data-is-coach="1">{coachTree[d.key]}</div>
  </div>
</div>
<!-- Node detail panel (hidden by default) -->
<div class="nsm-node-detail" id="nsm-node-detail" style="display:none"></div>
```

`cmpDims` = `NSM_DIMENSION_CONFIGS[detectProductType(q)]` — dimension list from product type detection.

**Node click behavior** (in `bindNSM()`):
- User node: shows `nsm-detail-metric` with user's text (no rationale)
- Coach node: shows `nsm-detail-metric` + `nsm-rationale` with coach rationale
- Toggle: clicking same node again hides the panel
- `AppState.nsmOpenNode` persists which node is open; on re-render, the open node is automatically re-clicked to restore state

Node detail panel HTML:
```html
<div class="nsm-node-detail" id="nsm-node-detail">
  <div class="nsm-detail-metric">
    <span class="nsm-detail-prefix">{教練版 | 你的} {dimLabel}</span>
    <p class="nsm-detail-value">{metricText}</p>
  </div>
  <!-- Coach only: -->
  <div class="nsm-rationale">
    <div class="nsm-rationale-head"><i class="ph ph-lightbulb"></i> 教練設計思路</div>
    <p class="nsm-rationale-body">{rationale[dim]}</p>
  </div>
</div>
```

---

### Tab 3: 亮點 (highlights)

```html
<div class="nsm-highlights">
  <div class="nsm-highlight-card nsm-highlight-best">
    <div class="nsm-highlight-head"><i class="ph ph-trophy"></i> 最大亮點</div>
    <p>{scores.bestMove}</p>
  </div>
  <div class="nsm-highlight-card nsm-highlight-trap">
    <div class="nsm-highlight-head"><i class="ph ph-warning-circle"></i> 主要陷阱</div>
    <p>{scores.mainTrap}</p>
  </div>
  <div class="nsm-highlight-card">
    <div class="nsm-highlight-head"><i class="ph ph-chat-text"></i> 總評</div>
    <p>{scores.summary}</p>
  </div>
</div>
```

---

### Tab 4: 完成 (export)

```html
<div class="nsm-export">
  <button class="btn btn-primary" id="btn-nsm-again">
    <i class="ph ph-arrow-counter-clockwise"></i> 再練一次
  </button>
  <button class="nsm-btn-ghost" id="btn-nsm-home">
    <i class="ph ph-house"></i> 回首頁
  </button>
</div>
```

---

### `bindNSM()` — Step 4 bindings

```javascript
// Back button (house icon) at step 4:
if (AppState.nsmStep === 4) {
  AppState.nsmStep = 1;
  AppState.nsmSession = null;
  AppState.nsmSelectedQuestion = null;
  navigate('nsm');
}

// Tab switching:
document.querySelectorAll('[data-nsm-tab]').forEach(function(btn) {
  btn.addEventListener('click', function() { AppState.nsmReportTab = btn.dataset.nsmTab; render(); });
});

// Comparison tree node tap:
document.querySelectorAll('.nsm-tree-node[data-node]').forEach(function(node) {
  node.addEventListener('click', function() {
    var detailEl = document.getElementById('nsm-node-detail');
    var key = node.dataset.node;
    var isCoach = node.dataset.isCoach === '1';
    var dim = key.replace('coach-','').replace('user-','');
    var dimLabel = node.dataset.label || dim;
    var sc = AppState.nsmSession ? (AppState.nsmSession.scores_json || {}) : {};
    var ctree = sc.coachTree || {};
    var rationale = sc.coachRationale || {};
    var bd = (AppState.nsmSession && AppState.nsmSession.user_breakdown) || AppState.nsmBreakdownDraft || {};
    var metricText = isCoach
      ? (ctree[dim] || '—')
      : (dim === 'nsm' ? (AppState.nsmNsmDraft || '（未填寫）') : (bd[dim] || '（未填寫）'));
    var prefix = isCoach ? '教練版 ' : '你的 ';
    var rationaleText = isCoach ? (rationale[dim] || '') : '';
    if (AppState.nsmOpenNode === key) {
      AppState.nsmOpenNode = null;
      detailEl.style.display = 'none';
      detailEl.innerHTML = '';
    } else {
      AppState.nsmOpenNode = key;
      detailEl.style.display = 'block';
      detailEl.innerHTML =
        '<div class="nsm-detail-metric">' +
          '<span class="nsm-detail-prefix">' + escHtml(prefix + dimLabel) + '</span>' +
          '<p class="nsm-detail-value">' + escHtml(metricText) + '</p>' +
        '</div>' +
        (rationaleText
          ? '<div class="nsm-rationale">' +
              '<div class="nsm-rationale-head"><i class="ph ph-lightbulb"></i> 教練設計思路</div>' +
              '<p class="nsm-rationale-body">' + escHtml(rationaleText) + '</p>' +
            '</div>'
          : '');
    }
  });
});
// Restore open node if any:
if (AppState.nsmOpenNode) {
  var openNode = document.querySelector('.nsm-tree-node[data-node="' + AppState.nsmOpenNode + '"]');
  if (openNode) openNode.click();
}

// btn-nsm-again:
document.getElementById('btn-nsm-again')?.addEventListener('click', function() {
  AppState.nsmStep = 1; AppState.nsmSession = null; AppState.nsmSelectedQuestion = null;
  AppState.nsmNsmDraft = ''; AppState.nsmBreakdownDraft = {}; AppState.nsmVanityWarning = null;
  render();
});
// btn-nsm-home:
document.getElementById('btn-nsm-home')?.addEventListener('click', function() {
  AppState.nsmStep = 1; AppState.nsmSession = null; AppState.nsmSelectedQuestion = null;
  AppState.nsmNsmDraft = ''; AppState.nsmBreakdownDraft = {}; AppState.nsmVanityWarning = null;
  navigate('nsm');
});
```

---

### CSS — NSM Step 4 (use OLD tokens — do NOT change)

```css
/* ⚠️ All NSM Step 4 CSS uses var(--accent), var(--bg-surface), var(--border), 
   var(--text-secondary), var(--text-primary), var(--bg-primary) — NOT CIRCLES tokens */

.nsm-score-summary { display: flex; align-items: baseline; gap: 6px; padding: 14px 16px; border-bottom: 1px solid var(--border); background: var(--bg-primary); }
.nsm-total-score { font-size: 36px; font-weight: 800; color: var(--accent); }
.nsm-score-label-sm { font-size: 18px; color: var(--text-secondary); }
.nsm-score-company { margin-left: auto; font-size: 14px; font-weight: 600; color: var(--text-primary); }
.nsm-report-body { flex: 1; overflow-y: auto; padding: 16px; min-height: 0; scrollbar-width: none; }
.nsm-radar-wrap { display: flex; justify-content: center; margin-bottom: 16px; }

.nsm-score-row { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
.nsm-score-label { font-size: 12px; color: var(--text-secondary); width: 60px; flex-shrink: 0; }
.nsm-score-bar-wrap { flex: 1; height: 8px; background: var(--bg-surface); border-radius: 4px; overflow: hidden; }
.nsm-score-bar-fill { height: 100%; border-radius: 4px; transition: width 0.5s ease; }
.nsm-score-num { font-size: 12px; font-weight: 700; color: var(--text-primary); width: 28px; text-align: right; }
.nsm-dim-comment { font-size: 12px; color: var(--text-secondary); margin-bottom: 12px; padding-left: 68px; line-height: 1.5; }

.nsm-comparison { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.nsm-tree-title { font-size: 12px; font-weight: 700; color: var(--text-secondary); margin-bottom: 8px; display: flex; align-items: center; gap: 4px; }
.nsm-tree-node { background: var(--bg-surface); border: 1.5px solid var(--border); border-radius: 10px; padding: 10px 12px; margin-bottom: 8px; font-size: 12px; color: var(--text-primary); line-height: 1.5; cursor: pointer; min-height: 44px; word-break: break-word; }
.nsm-tree-node:active { transform: scale(0.97); }
.nsm-tree-root { font-weight: 700; border-color: var(--accent); }
.nsm-tree-coach { border-color: rgba(108,99,255,0.4); background: rgba(108,99,255,0.04); }
.nsm-node-detail { margin-top: 10px; background: var(--bg-surface); border-radius: 12px; padding: 14px; font-size: 13px; color: var(--text-primary); line-height: 1.6; border: 1.5px solid var(--border); }
.nsm-tree-hint-tip { font-size: 10px; font-weight: 400; color: var(--text-tertiary); margin-left: 4px; font-style: italic; }
.nsm-detail-metric { margin-bottom: 10px; }
.nsm-detail-prefix { font-size: 11px; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.04em; display: block; }
.nsm-detail-value { font-size: 13px; color: var(--text-primary); line-height: 1.5; margin: 4px 0 0; }
.nsm-rationale { background: rgba(108,99,255,0.07); border-radius: 10px; padding: 12px 14px; border-left: 3px solid var(--accent); }
.nsm-rationale-head { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 700; color: var(--accent); margin-bottom: 6px; }
.nsm-rationale-body { font-size: 12.5px; color: var(--text-primary); line-height: 1.6; margin: 0; }

.nsm-highlight-card { background: var(--bg-surface); border: 1.5px solid var(--border); border-radius: 12px; padding: 14px 16px; margin-bottom: 12px; }
.nsm-highlight-head { display: flex; align-items: center; gap: 6px; font-weight: 700; margin-bottom: 6px; font-size: 14px; }
.nsm-highlight-best .nsm-highlight-head { color: var(--success); }
.nsm-highlight-trap .nsm-highlight-head { color: var(--danger); }
.nsm-highlight-card p { font-size: 13px; color: var(--text-primary); line-height: 1.6; }
.nsm-export { display: flex; flex-direction: column; gap: 10px; padding-top: 8px; }
.nsm-export .btn, .nsm-export .nsm-btn-ghost { width: 100%; min-height: 44px; }

.nsm-loading-state { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 60px 16px; gap: 16px; color: var(--text-secondary); }
.nsm-loading-state i { font-size: 36px; animation: spin 0.8s linear infinite; }

@media (max-width: 480px) {
  .nsm-comparison { grid-template-columns: 1fr; }
}
```

---

## Screen 10: Auth (Login/Register)

```html
<nav class="navbar"><span class="navbar-logo">PM Drill</span></nav>
<div class="auth-wrap">
  <button class="auth-back-link" onclick="navigate('circles')">
    <i class="ph ph-arrow-left"></i> 返回 CIRCLES 訓練
  </button>
  <div class="auth-title">登入帳號</div>
  <div class="auth-sub">使用帳號解鎖歷史記錄與進度追蹤</div>
  <input class="auth-input" type="email" placeholder="電子郵件">
  <input class="auth-input" type="password" placeholder="密碼">
  <button class="circles-btn-primary" style="width:100%;border-radius:10px;padding:12px;margin-bottom:12px">登入</button>
  <button class="circles-btn-secondary" style="width:100%;border-radius:10px;padding:12px">還沒帳號？註冊</button>
</div>
```

Back link → `navigate('circles')` (not 'home')

CSS:
```css
.auth-wrap { padding: 32px 24px; }
.auth-back-link { background: none; border: none; color: var(--c-text-2); font-size: 13px; cursor: pointer; display: flex; align-items: center; gap: 4px; margin-bottom: 24px; font-family: 'DM Sans', sans-serif; }
.auth-title { font-size: 22px; font-weight: 700; margin-bottom: 6px; font-family: 'DM Sans', sans-serif; }
.auth-sub { font-size: 14px; color: var(--c-text-2); margin-bottom: 24px; font-family: 'DM Sans', sans-serif; }
.auth-input { width: 100%; background: var(--c-card); border: 1.5px solid var(--c-border); border-radius: 10px; padding: 12px 14px; font-size: 14px; font-family: 'DM Sans', sans-serif; outline: none; margin-bottom: 12px; }
```

---

## Screen 11: Offcanvas — History

Opened by hamburger button (`.btn-icon` with `ph-list`). An overlay + side panel from right.

```html
<!-- Overlay (behind panel) -->
<div class="offcanvas-overlay" onclick="closeOffcanvas()"></div>
<!-- Panel -->
<div class="offcanvas">
  <div class="offcanvas-header">
    <span class="offcanvas-title">練習記錄</span>
    <button class="btn-icon" onclick="closeOffcanvas()"><i class="ph ph-x"></i></button>
  </div>
  <div class="offcanvas-list" id="offcanvas-list">
    <!-- Populated by loadOffcanvasSessions() -->
    <div class="offcanvas-item" data-id="..." data-type="nsm">
      <div style="display:flex;align-items:center;gap:6px;padding-right:28px">
        <span class="offcanvas-badge badge-nsm">74 分</span>
        <span class="offcanvas-item-label">NSM · LinkedIn</span>
      </div>
      <div class="offcanvas-item-date">4/26 14:32</div>
      <button class="offcanvas-delete"><i class="ph ph-trash"></i></button>
    </div>
    <!-- CIRCLES sessions: badge-circles, label "CIRCLES · Company · Step" -->
    <div class="offcanvas-item" data-id="..." data-type="circles">
      <div style="display:flex;align-items:center;gap:6px;padding-right:28px">
        <span class="offcanvas-badge badge-circles">進行中</span>
        <span class="offcanvas-item-label">CIRCLES · Meta · C 澄清</span>
      </div>
      <div class="offcanvas-item-date">4/26 11:08</div>
      <button class="offcanvas-delete"><i class="ph ph-trash"></i></button>
    </div>
  </div>
</div>
```

**Date display fix:** Use `s.created_at` (NOT `s.updated_at`) for date display. Format: `new Date(s.created_at).toLocaleString('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })`.

**Resume behavior:**
- NSM item click → `AppState.nsmSession = { id }; AppState.nsmStep = 4; navigate('nsm');`
- CIRCLES item click → `AppState.circlesSession = { id }; AppState.circlesPhase = last_phase; navigate('circles');` — then restore step_scores from session data

CSS:
```css
.offcanvas { position: fixed; top: 0; right: 0; bottom: 0; width: 280px; background: var(--c-card); box-shadow: -4px 0 24px rgba(0,0,0,0.12); z-index: 300; display: flex; flex-direction: column; }
.offcanvas-header { padding: 16px; border-bottom: 1px solid var(--c-border); display: flex; align-items: center; gap: 8px; }
.offcanvas-title { font-size: 15px; font-weight: 700; flex: 1; font-family: 'DM Sans', sans-serif; }
.offcanvas-list { padding: 8px; overflow-y: auto; flex: 1; }
.offcanvas-item { padding: 12px; border-radius: 10px; margin-bottom: 4px; cursor: pointer; position: relative; }
.offcanvas-item:hover { background: #f0ede6; }
.offcanvas-badge { font-size: 11px; font-weight: 700; padding: 2px 7px; border-radius: 4px; margin-right: 4px; }
.badge-nsm { background: #FFF3E0; color: #B85C00; }
.badge-circles { background: #EEF3FF; color: var(--c-primary); }
.offcanvas-item-label { font-size: 13px; color: var(--c-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: 'DM Sans', sans-serif; }
.offcanvas-item-date { font-size: 12px; color: var(--c-text-3); margin-top: 2px; font-family: 'DM Sans', sans-serif; }
.offcanvas-delete { position: absolute; top: 10px; right: 8px; background: none; border: none; color: var(--c-text-3); cursor: pointer; font-size: 14px; }
.offcanvas-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.3); z-index: 299; }
```

---

## CIRCLES Method Reference (All 7 Steps)

This is the single source of truth for all CIRCLES step metadata. Never deviate from these.

### STEP_META

```javascript
const STEP_META = {
  C1: {
    key: 'C1', label: 'C 澄清情境',
    fields: ['問題範圍', '時間範圍', '業務影響', '假設確認'],
    rubricDimensions: ['問題邊界清晰度', '業務影響連結', '時間範圍合理性', '假設排除完整性'],
    pillLabel: 'C 澄清情境',
    focus: '澄清問題邊界、業務影響、時間範圍、假設確認',
  },
  I: {
    key: 'I', label: 'I 定義用戶',
    fields: ['目標用戶分群', '選定焦點', '用戶動機假設', '排除對象'],
    rubricDimensions: ['分群邏輯', '焦點選定理由', 'JTBD 動機深度', '排除對象說明'],
    pillLabel: 'I 定義用戶',
    focus: '用戶分群方式、選定焦點對象的理由、JTBD 動機',
  },
  R: {
    key: 'R', label: 'R 發掘需求',
    fields: ['功能性需求', '情感性需求', '社交性需求', '核心痛點'],
    rubricDimensions: ['功能需求', '情感/社交需求', '痛點層次', '需求優先說明'],
    pillLabel: 'R 發掘需求',
    focus: '功能/情感/社交三層需求、核心痛點層次',
  },
  C2: {
    key: 'C2', label: 'C 優先排序',
    fields: ['取捨標準', '最優先項目', '暫緩項目', '排序理由'],
    rubricDimensions: ['取捨標準顯性化', '最優先項理由', '暫緩項邏輯', '整體排序一致性'],
    pillLabel: 'C 優先排序',
    focus: '取捨標準說明、優先級理由、暫緩項目的邏輯',
  },
  L: {
    key: 'L', label: 'L 提出方案',
    fields: ['方案一', '方案二', '方案三（可選）', '各方案特性'],
    rubricDimensions: ['方案數量與多樣性', '各方案差異清晰', '方案可行性', '創意與務實平衡'],
    pillLabel: 'L 提出方案',
    focus: '方案多樣性、各方案的核心差異與適用情境',
  },
  E: {
    key: 'E', label: 'E 評估取捨',
    fields: ['方案優點', '方案缺點', '風險與依賴', '成功指標'],
    rubricDimensions: ['優缺點平衡', '風險識別', '依賴條件', '成功指標選擇'],
    pillLabel: 'E 評估取捨',
    focus: '各方案的風險、依賴條件、成功指標的選擇',
  },
  S: {
    key: 'S', label: 'S 總結推薦',
    fields: ['推薦方案', '選擇理由', '北極星指標', '追蹤指標'],
    rubricDimensions: ['推薦清晰度', '選擇理由', '指標領先性', '可操作性'],
    pillLabel: 'S 總結推薦',
    focus: '推薦的清晰度、指標的領先性與可操作性',
    hasNSMAnnotation: true,  // show NSM annotation box
  },
};
const STEP_ORDER = ['C1', 'I', 'R', 'C2', 'L', 'E', 'S'];
```

### Phase Flow Per Step

For each CIRCLES step, the flow is:

```
Phase 1 (form) → Phase 1.5 (gate) → Phase 2 (dialogue) → Phase 3 (score)
                    ↓ fail                                    ↓
                 Phase 1 (return)              [Simulation: next step → Phase 1 of next step]
                                               [Drill: show 回首頁 button]
```

**AppState tracking:**
- `AppState.circlesPhase`: current phase (1 / 1.5 / 2 / 3)
- `AppState.circlesStep`: current step key ('C1', 'I', etc.)
- `AppState.circlesSimStepIndex`: 0–6 for simulation mode
- `AppState.circlesMode`: 'simulation' or 'drill'

### AI Prompt Structure — Phase 2 Reply

Each AI reply from Phase 2 has this exact structure:
```
【被訪談者】
（2-4 sentences, oral, as product owner being interviewed）

【教練點評】
（max 2 sentences pointing out what level of exploration was reached）

【教練提示】
（1 sentence hinting at next exploration direction）
```

**The user plays the role of PM interviewer.** The user asks questions to the 被訪談者. The 被訪談者 only has information the product owner would have — no strategic analysis.

**Role breakdown:**
- 被訪談者: Product owner at the company. Answers questions vaguely if the user is too vague. Refuses to answer "what should we build?" type questions.
- 教練點評: Coaching feedback on this turn's dialogue quality for the current step focus.
- 教練提示: ALWAYS collapsed by default. One-sentence hint for next direction.

### AI Prompt Structure — Phase 1.5 Gate

Returns JSON (never markdown):
```json
{
  "items": [
    {
      "field": "欄位名稱",
      "status": "error" | "warn" | "ok",
      "title": "一句話標題（8字內）",
      "reason": "說明原因（20字內）",
      "suggestion": "修正建議（30字內，status=ok 時為 null）"
    }
  ],
  "canProceed": true | false,
  "overallStatus": "error" | "warn" | "ok"
}
```

Rules:
- `error`: directional mistake that would mislead the entire subsequent analysis
- `warn`: incomplete but not fatal, can supplement in dialogue
- `ok`: direction is correct
- `canProceed = false` ONLY when there is any `error` AND `mode = "drill"`
- In `simulation` mode: even with errors, `canProceed = true` (but still mark correct `overallStatus`)

### AI Prompt Structure — Phase 3 Evaluator

Returns JSON:
```json
{
  "dimensions": [
    { "name": "維度名稱", "score": 1-5, "comment": "一句話點評（20字內）" }
  ],
  "totalScore": number (0-100, formula: sum * 100 / (numDimensions * 5)),
  "highlight": "最強的表現（20字內）",
  "improvement": "最需改進的點（25字內）",
  "coachVersion": "（simulation: 完整示範答案 | drill: 簡短提示）"
}
```

---

## NSM System Reference

### NSM Question Structure

```javascript
{
  id: string,
  company: string,
  type: 'attention' | 'transaction' | 'creator' | 'saas',
  nsm_category: string,        // e.g. "語言學習App"
  nsm_description: string,     // brief scenario description
  hidden_context: string,      // info the AI "product owner" knows but won't volunteer
  coach_nsm_example: string,   // ideal NSM answer
  coach_breakdown: { reach, depth, frequency, impact } // ideal breakdown
}
```

### NSM Dimension Config (by product type)

**attention** (social, entertainment, learning):
- reach: 觸及廣度 — AHA moment users
- depth: 互動深度 — quality of engagement per session
- frequency: 習慣頻率 — return visit regularity
- impact: 留存驅力 — retention mechanism

**transaction** (e-commerce, delivery):
- reach: 觸及廣度
- depth: 交易深度 — average order value / items per order
- frequency: 回購頻率
- impact: LTV 驅力

**creator** (Figma, YouTube):
- reach: 創作者觸及
- depth: 創作深度
- frequency: 發布頻率
- impact: 協作擴散力

**saas** (B2B tools):
- reach: 啟用廣度
- depth: 功能滲透深度
- frequency: 工作流嵌入頻率
- impact: 組織擴散驅力

Dimension colors (fixed regardless of type):
- reach: `#3b82f6`
- depth: `#8b5cf6`
- frequency: `#10b981`
- impact: `#f59e0b`

### NSM 4-Step Flow

```
Step 1 (select question + AI context card)
  → Step 2 (define NSM: 3 fields)
    → NSM Gate (quality review: 4 criteria)
      → pass: Step 3 (breakdown 4 dimensions)
        → Step 4 (evaluation result)
      → fail: back to Step 2
```

**AppState tracking:**
- `AppState.nsmStep`: 1/2/3/4 (3 here means the gate, 4 is breakdown, old step4=result)
  - Actually in current app.js: step 1 = select, step 2 = define, step 3 = breakdown, step 4 = result
  - NSM Gate is inserted BETWEEN step 2 and step 3 (renders within step 2 screen using a sub-state)
- `AppState.nsmSelectedQuestion`: selected NSM question object
- `AppState.nsmSession`: { id: sessionId }
- `AppState.nsmNsmDraft`: { nsm, definition, businessLink }
- `AppState.nsmBreakdownDraft`: { reach, depth, frequency, impact }
- `AppState.nsmVanityWarning`: null or string (from gate result)
- `AppState.nsmGateResult`: gate result object (passed from step 2 gate review)

---

## AppState Extensions Needed

```javascript
// In AppState object:
circlesMode: localStorage.getItem('circlesMode') || 'simulation',  // 'simulation' or 'drill'
circlesSelectedQuestion: null,
circlesDisplayedQuestions: [],  // 5 randomly picked questions
circlesSession: null,           // { id, ... }
circlesPhase: 1,                // 1, 1.5, 2, 3
circlesStep: 'C1',              // current step key
circlesSimStepIndex: 0,         // 0-6
circlesFrameworkDraft: {},      // current step's field values
circlesGateResult: null,
circlesConversation: [],        // current step's messages
circlesStepScores: {},          // { C1: {...}, I: {...}, ... }
circlesStepDrafts: {},          // per-step persistent drafts; keyed by step; saved on Phase 1 submit
                                // L: { sol1: string, sol2: string, sol3: string|null }  — L step solution names
                                // C1: { '業務影響': string, ... }  — C1 Phase 1 field values
                                // R: { conclusion: string }  — R step Phase 2 conclusion text

// NSM (most already exist, adding gate state):
nsmGateResult: null,            // NEW: stores NSM gate result
nsmContextCard: null,           // NEW: AI context for selected question
```

---

## Implementation Task List

These tasks must be done after all mockup screens are APPROVED (current status: screens 1-11 approved).

### Task A: 5 Random Questions (CIRCLES Home + NSM Step 1)

- [ ] CIRCLES Home: `AppState.circlesDisplayedQuestions` = pick 5 random from `CIRCLES_QUESTIONS` (or filtered by type tab). Store in AppState.
- [ ] On type tab change: re-pick 5 random from filtered set, re-render question list.
- [ ] 隨機選題 button: re-pick 5, re-render (does NOT navigate).
- [ ] NSM Step 1: same pattern — `AppState.nsmDisplayedQuestions` = pick 5 from `NSM_QUESTIONS` by type.
- [ ] 隨機選題 for NSM: re-pick 5, re-render.

### Task B: CIRCLES Home — Remove Back Button + Fix Font

- [ ] `renderCirclesHome()`: no back button in nav (CIRCLES is the home). Nav should have only `circles-nav-title` centered, no back/home buttons.
- [ ] `circles-home-title` class: ensure `font-family: 'DM Sans', sans-serif` (NOT `Instrument Serif`).
- [ ] The existing `circles-home-back` button handler must be removed.

### Task C: Question Card Expand-Confirm Flow

- [ ] `renderCirclesHome()`: each question card renders with `id="qcard-N"`, collapsed/expanded sub-divs.
- [ ] `bindCirclesHome()`: attach `expandQCard(idx)` on card click, `collapseQCard(idx)` on cancel.
- [ ] Confirm button: set `AppState.circlesSelectedQuestion`, create session, navigate to Phase 1.

### Task D: NSM Gate Integration

- [ ] After NSM Step 2 submit → call backend gate endpoint → store in `AppState.nsmGateResult`
- [ ] If `canProceed: false` → render fail state, return button → back to Step 2 form
- [ ] If `canProceed: true` → render pass state, continue button → advance to Step 3
- [ ] NSM Gate render: same UI pattern as CIRCLES gate (gate-item CSS reused)
- [ ] Backend: add `/api/nsm-sessions/:id/gate` and `/api/guest/nsm-sessions/:id/gate` endpoints
- [ ] Backend: create `prompts/nsm-gate.js` with 4 criteria evaluation

### Task E: Offcanvas Bug Fixes

- [ ] Date display: use `s.created_at` not `s.updated_at` (fix `Invalid Date`)
- [ ] Resume CIRCLES session: restore `step_scores` from session data into `AppState.circlesStepScores`
- [ ] NSM back→circles must clear `AppState.circlesSession` to prevent "評分結果載入中" stuck state

### Task F: NSM Context Card (Step 1 AI Analysis)

- [ ] On question card click → call AI analysis endpoint → show loading state → show loaded state with 4-row context card
- [ ] Context card rows: 商業模式 / 使用者 / 常見陷阱 (red) / 破題切入 (blue bold)
- [ ] CTA disabled until context loaded

### Task G: Hint System (CIRCLES Phase 1)

Already built in prior sessions (Tasks 16-17 marked complete). Verify it matches this spec:
- `提示` button per field → `showCirclesHint(step, field)` overlay
- 3 states: loading → collapsed-with-try-first → expanded
- Actual production flow: loading → expanded directly (skip middle state)
- Close: click × or click outside overlay

---

## Navigation Rules (Critical)

All `navigate('home')` calls have been replaced with `navigate('circles')`. Key locations:
- Auth back link → `navigate('circles')`
- Offcanvas delete confirm → `navigate('circles')`
- NSM step 1 back button → `navigate('circles')`
- CIRCLES home: no back button (it IS the home)
- NSM step 4 report home button → reset NSM state, `navigate('nsm')`
- NSM steps 2/3 home buttons → reset NSM state, `navigate('nsm')`

---

## File Checklist (What Exists vs What's Needed)

### Already exists (do not recreate):
- `routes/circles-sessions.js` — auth CRUD + /gate + /message(SSE) + /evaluate-step + /hint
- `routes/guest-circles-sessions.js` — guest variant
- `routes/nsm-sessions.js` — auth NSM CRUD + /evaluate
- `routes/guest-nsm-sessions.js` — guest NSM
- `prompts/circles-gate.js` — Phase 1.5 gate
- `prompts/circles-coach.js` — Phase 2 SSE coach
- `prompts/circles-evaluator.js` — Phase 3 evaluator
- `prompts/circles-hint.js` — AI hint per field
- `public/circles-db.js` — CIRCLES_QUESTIONS array
- `public/style.css` — CIRCLES CSS already added in prior task

### Needs to be created:
- `prompts/nsm-gate.js` — NSM Step 2 → Gate quality review (4 criteria)
- `prompts/nsm-context.js` — NSM Step 1 AI context card generation (4 rows)

### Needs to be modified:
- `routes/nsm-sessions.js` — add `/gate` endpoint, add `/context` endpoint
- `routes/guest-nsm-sessions.js` — same
- `public/app.js` — all UI changes per above screens
