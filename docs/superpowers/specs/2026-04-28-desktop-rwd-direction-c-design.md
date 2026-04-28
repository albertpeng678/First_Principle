# Desktop RWD Direction C + Onboarding + Misc Design Spec

**Date:** 2026-04-28
**Scope:** PM Drill 的桌面 (≥1024px) 大規模重排，採用 direction C「每頁原生佈局」，搭配新使用者 onboarding（coachmark tour）、navbar 清理、NSM Step 4 對比 tab、手機版 parity 對 onboarding/對比 tab 的相應補齊。
**Authoritative mockup folder:** `.superpowers/brainstorm/70171-1777356961/content/`

---

## 0. Decisions log（brainstorm 階段拍板）

| 決策 | 結論 |
|---|---|
| 美學方向 | Clean SaaS warm v2（沿用現有 #F2F0EB cream + #1A56DB primary，dial-up Instrument Serif、降噪、暖系次文字） |
| 桌面方向 | C — 每頁原生佈局（非統一 sidebar pattern） |
| Onboarding | B — Coachmark spotlight tour，4 步指認真實 UI |
| Mobile 範圍 | 手機**主要保持現狀**，僅在以下情況補齊：onboarding tour、NSM 對比 tab、navbar 移除 dev tool tab |
| Icon 家族 | Phosphor regular（120 處已用），全站禁 emoji |
| Favicon | F4 — `ph-circles-three` 白色 on #1A56DB 圓底 |
| Container | desktop ≥1024px → max-width 1180px（部分頁 920px），tablet 720-1023 → 720px，mobile <720 → 100% |
| 字型 | DM Sans（body）+ Instrument Serif（hero 數字 / 大字 italic 強調） |

---

## 1. Design tokens（CSS variables）

### 1.1 Colors（修改 `public/style.css` 頂層）

```css
:root, [data-theme="light"] {
  /* Primary */
  --c-primary: #1A56DB;          /* 統一 (原 hardcode 109 處 + var 設紫色衝突) */
  --c-primary-lt: rgba(26,86,219,0.08);
  --c-primary-mid: rgba(26,86,219,0.18);

  /* NSM secondary (purple, used only for NSM banners/labels) */
  --c-nsm: #7C3AED;
  --c-nsm-lt: rgba(124,58,237,0.06);

  /* Surface */
  --c-bg: #F2F0EB;               /* 主背景，已存在 */
  --c-bg-alt: #F4F1EB;           /* desktop 細暖底 */
  --c-card: #fff;
  --c-surface: #fafaf8;

  /* Text */
  --c-text: #1F1D1B;             /* 暖深棕，比 #1a1a1a 更柔 */
  --c-text-2: #5a5046;
  --c-text-3: #8a7e6f;
  --c-text-4: #a89d8e;

  /* Border */
  --c-border: rgba(60,45,30,0.08);
  --c-border-mid: rgba(60,45,30,0.12);
  --c-border-strong: rgba(60,45,30,0.15);

  /* Status */
  --c-success: #10b981;
  --c-success-lt: #D1FAE5;
  --c-success-fg: #065F46;
  --c-warn: #D97706;
  --c-warn-lt: #FEF3C7;
  --c-warn-fg: #92400E;
  --c-danger: #DC2626;
  --c-danger-lt: #FEE2E2;
  --c-danger-fg: #991B1B;

  /* Score dim colors (固定，不改) */
  --c-dim-reach: #3b82f6;
  --c-dim-depth: #8b5cf6;
  --c-dim-frequency: #10b981;
  --c-dim-retention: #f59e0b;
}
```

**遷移規則：** 全站 hex 改成 var()。Grep `#1A56DB` 109 處全部改回 `var(--c-primary)`；`#5a5a5a` → `var(--c-text-2)`；`#8a8a8a` → `var(--c-text-3)`；`rgba(0,0,0,0.08)` → `var(--c-border)`。

### 1.2 Typography

```css
body {
  font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  font-size: 13px;
  line-height: 1.55;
  color: var(--c-text);
}

.serif-display { font-family: 'Instrument Serif', serif; letter-spacing: -0.5px; }
.label-uppercase { font-size: 11px; font-weight: 600; letter-spacing: 0.5px; text-transform: uppercase; color: var(--c-text-3); }
```

**Instrument Serif 使用範圍**（不要濫用）：
- Phase 3 score-total `.score-number` (54-72px)
- NSM Step 4 `.nsm-total-score` (54px)
- 其他全部 DM Sans

### 1.3 Spacing（沿用現有 4-8-12-16-24 grid，不引入新系統）

### 1.4 Breakpoints

```css
/* mobile-first, desktop overrides */
@media (min-width: 1024px) { /* desktop */ }
@media (min-width: 720px) and (max-width: 1023px) { /* tablet */ }
```

### 1.5 Favicon

新增 `public/favicon.svg`：
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <circle cx="32" cy="32" r="32" fill="#1A56DB"/>
  <!-- ph-circles-three 白色 28px，置中 -->
  <g transform="translate(32 32) scale(0.45)" fill="#fff">
    <circle cx="0" cy="-18" r="11" fill="none" stroke="#fff" stroke-width="3"/>
    <circle cx="-15" cy="9" r="11" fill="none" stroke="#fff" stroke-width="3"/>
    <circle cx="15" cy="9" r="11" fill="none" stroke="#fff" stroke-width="3"/>
  </g>
</svg>
```

更新 `public/index.html` 第 7 行：
```html
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
```

---

## 2. Container & layout strategy

### 2.1 Mobile (<720px)：完全沿用現有

```css
#app { max-width: 100%; padding: 0 16px 16px; }
```

### 2.2 Tablet (720-1023px)：略加寬

```css
@media (min-width: 720px) {
  #app { max-width: 720px; padding: 0 24px 24px; }
}
```

### 2.3 Desktop (≥1024px)：每頁自己決定

不再用全域 `#app max-width`。改成：
- 各 `render*` 函式內部的根容器用 page-specific class（`.circles-home-desktop`、`.phase1-desktop` 等）
- 每個 class 設定該頁面的 max-width（1180 / 920 / 1180）

```css
@media (min-width: 1024px) {
  #app { max-width: 100%; padding: 0; }   /* 解除全域限制 */

  /* per-page desktop containers */
  .circles-home-desktop { max-width: 1180px; margin: 0 auto; padding: 24px 28px; }
  .phase1-desktop { max-width: 1180px; margin: 0 auto; padding: 0 28px 100px; }
  .phase2-desktop { max-width: 920px; margin: 0 auto; padding: 0 24px; }
  .phase3-desktop { max-width: 920px; margin: 0 auto; padding: 0 24px 100px; }
  .nsm-home-desktop { max-width: 920px; margin: 0 auto; padding: 18px 24px 100px; }
  .nsm-step2-desktop { max-width: 720px; margin: 0 auto; padding: 18px 24px 100px; }
  .nsm-step3-desktop { max-width: 920px; margin: 0 auto; padding: 18px 24px 100px; }
  .review-desktop { max-width: 1180px; margin: 0 auto; padding: 24px; }
  .login-desktop { max-width: 420px; margin: 60px auto 0; padding: 0 24px; }
}
```

---

## 3. Per-page desktop layouts（mockup → 實作對應）

每頁的 mockup HTML 都在 brainstorm session：`.superpowers/brainstorm/70171-1777356961/content/`。實作時逐個 `render*` 函式以 `viewport.width >= 1024` 條件分支。

### 3.1 Page 1: CIRCLES home `renderCirclesHome`

**Mockup file:** `final-1-onboarding-circles-home.html` (states 1, 6, 7) + `clean-saas-warmer-v2.html`（最終美學）

**Desktop layout:**

```
┌─────────────────────────────────────────────────────────────┐
│ navbar (sticky, glassmorphism, 1180px wide)                 │
│   [logo] [tab CIRCLES active] [tab 北極星指標]              │
│   [search 🔍] [email] [signout]                              │
├─────────────────────────────────────────────────────────────┤
│ page header (max-w 1180, padding 36px 28px 18px)            │
│   H1 "CIRCLES 訓練"   right: "100 題 · 7 步驟框架"           │
│   subtitle                                                   │
├─────────────────────────────────────────────────────────────┤
│ resume banner（spec 2，含「未完成練習」 / 進行中）           │
├─────────────────────────────────────────────────────────────┤
│ 3-column grid (230 + 1fr + 240, gap 24)                     │
│ ┌───────────┬──────────────────────┬──────────────┐         │
│ │ Left rail │ Center               │ Right rail   │         │
│ │           │                      │              │         │
│ │ 練習模式  │ 題目 · {N}           │ 近期練習     │         │
│ │ - 完整    │ [列表/網格 · 排序]   │ [recent x 2] │         │
│ │ - 加練    │                      │              │         │
│ │           │ ┌──────────────────┐ │ 推薦         │         │
│ │ 題型      │ │ #001 ... Easy    │ │ [NSM card]   │         │
│ │ - 設計 40 │ │ #002 ... Medium  │ │              │         │
│ │ - 改進 35 │ │ ...              │ │              │         │
│ │ - 策略 25 │ └──────────────────┘ │              │         │
│ │ 隨機選題  │                      │              │         │
│ └───────────┴──────────────────────┴──────────────┘         │
└─────────────────────────────────────────────────────────────┘
```

**Key components 對應現有 JS：**

- mode selector: 改 `CIRCLES_MODE_CARDS` render，左 rail 用 `.mode-card` 樣式（spec 1.1）
- 題型 filter: 改 type tabs render 在左 rail（垂直清單 + count）
- 題目列表: 改 question card 為 list row（grid `64px 1fr 96px 76px`）— 含 # 編號（mono）+ 標題副標 + 分類 chip + 難度 dot
- recent rail: `AppState.circlesRecentSessions` filter 顯示最多 3 筆（進行中／完成／其他）
- 「步驟加練」模式選擇後：左 rail 模式區下方多一段「選擇步驟」（C/I/R 可選；C2/L/E/S 鎖 + ph-lock-simple）

**inline expand 題目卡:**
- 點題目 row → row 變藍邊白底（border 2px var(--c-primary)），下方 inline 出現新區塊（同 row container 內）：完整 problem_statement + 確認/取消 buttons
- expand 後 row 不擠掉其他 row（grid 跨 4 columns / `grid-column: 1/-1` 顯示 detail）

**Sticky NSM banner（底部）:**
- 主欄底部，紫色 themed（var(--c-nsm)），「想做最完整的 NSM 定義訓練？」+ 前往 NSM 按鈕

**Mobile（<1024）:**
- 維持現狀，所有變更僅在 desktop class
- resume banner 維持手機既有寬度
- mode card 仍用現有 grid-template-columns: 1fr 1fr

### 3.2 Page 2: Phase 1 form `renderCirclesPhase1`

**Mockup file:** `final-2-phase1-all-states.html` + `final-2c-S-full-page.html` + `final-2d-S-split-examples-hints.html`

**Desktop layout:**

- container `.phase1-desktop` max-width 1180
- top bar 行：`← 步驟名 · 公司·產品 ___ 已儲存 indicator | 回首頁`
- progress segment bar 整行（白卡 padding 14 18，flex segment 6px height + label）
- 主區 grid `1fr 280px gap 14`，左主表單，右 rail（題目脈絡 + 上一步重點）
- 表單卡 .field-row 結構：`field-head（label + 提示）/ ex-toggle / toolbar / textarea`
- L 步驟特殊：`方案名稱 input`（tag icon + 10 字內）+ 機制 textarea；「+ 新增方案三」虛線按鈕
- E 步驟特殊：per-solution 區塊（2x2 grid）+ 上一步方案參考收合卡
- **S 步驟拆兩頁**：
  - S-1（推薦方案 + 選擇理由 + 北極星指標）— progress 第 7 段半填 partial gradient
  - S-2（追蹤指標 4 維度）— progress 第 7 段全填、底部「← 返回 S-1 摘要」按鈕
- sticky footer：`返回選題 / 提交審核 →`

**Mobile:** 沿用現有 vertical stack。Toolbar sticky-bottom on focus（spec 4）。

### 3.3 Page 3: Phase 2 chat `renderCirclesPhase2`

**Mockup file:** `final-3-redo-spec-aligned.html` (states 1-5)

**規格已存在於 `2026-04-26-circles-nsm-ux-mockup-spec.md` Screen 5（5 sub-states），desktop 改動只有：**

- container `.phase2-desktop` max-width 920px（沉浸式對話寬度）
- 其餘 5 sub-states (chat / chat3 / strip / expand / pass) 的 flex 結構、bubble 三段、教練提示永遠折疊、conclusion box 8 秒偵測 — **完全不改**
- pinned question card 改 desktop 寬度
- chat-body padding 改 18 24

**Mobile:** 完全沿用現有實作（spec 1 bullet 渲染只影響範例渲染，不影響 chat structure）。

### 3.4 Page 4: Phase 3 score `renderCirclesStepScore`

**Mockup file:** `final-3-redo-spec-aligned.html` (P3 drill / sim mid / sim final / coach demo expanded)

**Desktop layout:**

- container `.phase3-desktop` max-width 920px
- score-total padding 24 24 16，center align：`<div class="score-number">{total}</div><div class="score-sub">...</div>`
  - score-number font-size 84px on desktop（手機原本是某個更小尺寸，desktop 加大）
- score-breakdown：白卡內 4 dim-row（`flex` row：name+comment / bar 100px / score）
- highlight cards (good / improve)：grid 1fr 1fr 並排（手機是 stacking）
- coach-toggle：collapsed by default → expand 顯示 4 個欄位範例（spec 1 bullet 渲染，每欄位 step chip + bullet）
- submit-bar 變體：drill / sim mid (with 步驟 ◀▶) / sim final
- circles-nav 步驟切換 ◀▶（simulation only，drill 不顯示）

**Mobile:** 沿用現有，只 score-number 改 Instrument Serif（已存在）。

### 3.5 Page 5: NSM home (Step 1) `renderNSMStep1`

**Mockup file:** `final-4a-nsm-step1-2-gate.html` (states A / B / C)

**Desktop layout:**

- container `.nsm-home-desktop` max-width 920px
- type tabs row：`pill 全部 active | SaaS x8 | 電商 x6 | 內容媒體 x5 | B2B x5` + 右側「⇄ 隨機選題」連結
- 5 question cards 單列（不是手機那樣間隙窄、寬度滿；desktop 卡片 max-width 920、padding 14 16、margin-bottom 10）
- 點卡 → `.selected` 狀態：藍色雙邊框 (2px var(--c-primary)) + var(--c-primary-lt) 背景
- 內嵌 context preview：3 sub-states（loading row / loaded 4-row card with buildings/users/warning red/lightbulb blue icons）
- sticky CTA：「開始練習」全寬按鈕（State A/B disabled，State C enabled）

**Mobile:** 沿用現有，只 selected card border 樣式統一。

### 3.6 Page 6: NSM Step 2 `renderNSMStep2`

**Mockup file:** `final-4a-nsm-step1-2-gate.html` + `final-4c-nsm-step2-nsm-field-example-hint.html`

**Desktop layout:**

- container `.nsm-step2-desktop` max-width 720px（單欄表單）
- pinned context card 黃底（var(--c-warn-lt)）顯示題目情境
- 3 個 nsm-field：
  - 北極星指標（NSM）— single line input
  - 定義說明 — textarea
  - 與業務目標的連結 — textarea
- 每欄位含：
  - field label（uppercase 10px）+ 右側 lightbulb hint button（**新增，spec 沒寫但 UX 一致性 — 已 brainstorm 確認**）
  - 「查看範例」collapsible button（caret-right → caret-down 開後）
  - example body（spec 1 bullet 渲染版本 — Spotify 範例避免抄 Duolingo）
  - input/textarea
- sticky CTA：「提交審核 →」

**Mobile:** 同 desktop layout 但寬度滿欄。

### 3.7 Page 7: NSM Gate `renderNSMGate`

**Mockup file:** `final-4a-nsm-step1-2-gate.html` (pass / fail)

- container 與 Step 2 同寬 720px
- 頂部 gate-bar（pass 綠 / fail 紅 / warn 黃）+ 標題文字
- 4 個 gate-item，每個含左側狀態色 border（ok 綠 / warn 黃 / error 紅）+ icon + field 名 + reason + suggestion（warn 才有）
- sticky CTA：pass 顯示「繼續：拆解指標 →」/ fail 顯示「返回修改」(secondary 樣式)

### 3.8 Page 8: NSM Step 3 `renderNSMStep3`

**Mockup file:** `final-4b-nsm-step3-step4.html` (default / loading / revealed)

- container `.nsm-step3-desktop` max-width 920
- NSM summary card 頂部（藍底 var(--c-primary-lt)，「你的 NSM：...」）
- 4 個 dimension cards（觸及廣度藍 / 互動深度紫 / 習慣頻率綠 / 留存驅力橘）
- 每個 dim card 結構：
  - dim-header（border-left 3px 該維度色 + label + desc）
  - coach-q（斜體 + chat-dots icon 該維度色）
  - 「查看範例」collapsible（Figma 範例避免抄 Duolingo）
  - **3-state hint button**（default → loading → revealed）：
    - default: dashed border + 「查看教練提示」+ lightbulb icon
    - loading: spinner + 「生成提示中…」disabled
    - revealed: hint card（淡底 + 該維度色 left-border + bold 標 load-bearing）+ 「收起提示」按鈕
  - textarea
- sticky CTA：「提交：查看 NSM 評分 →」

### 3.9 Page 9: NSM Step 4 (含對比 tab) `renderNSMStep4`

**Mockup file:** `final-4d-nsm-step4-review-login.html` + `final-fix-nav-and-coach.html`

**4 tabs：總覽 / 對比 / 亮點 / 完成**

- container `.nsm-step4-desktop` max-width 920
- nsm-summary-bar：Instrument Serif 54px 數字 + / 100 + company
- tab-bar：4 個 tab-btn（active 藍底線）

**Tab 1 總覽：**
- radar SVG（5 軸：價值關聯 / 領先指標 / 操作性 / 可理解性 / 週期敏感）
- 5 dim rows（label + bar + score + comment）

**Tab 2 對比（spec 既有 + mobile parity）：**
- 標題提示「左側是你的版本，右側是教練版」
- NSM 主指標對比 row（grid 1fr 1fr）：
  - 你的 card：prefix「你的」(灰)、text
  - 教練版 card：prefix「教練版」(綠)、text
- 點任一節點 → 下方 detail panel：
  - 教練版完整文字
  - 「教練設計思路」rationale 卡（米黃底 + 藍 left-border + bold 標 load-bearing）
- 4 維度對比區（每維度一段，行內 grid 1fr 1fr 並排你的/教練版）

**Tab 3 亮點：**
- 3 個 highlight cards（最大亮點 trophy icon / 主要陷阱 warning-circle / 總評 chat-text）

**Tab 4 完成：**
- 兩個 button（再練一次 / 回首頁）

**Mobile parity for 對比 tab（NEW）：**
- 對比 tab 在手機上原本不存在（spec 沒寫對比 mobile layout）
- **新增 mobile 規格**：
  - tab-bar 維持 4 tab 橫向 scroll
  - 對比區改 vertical stack（不是 grid 1fr 1fr）：每維度先顯示「你的」card，再顯示「教練版」card
  - detail panel 用 bottom sheet 樣式（slide up from bottom）
  - rationale 卡內容相同

### 3.10 Page 10: review-examples `/review-examples.html`

**Mockup file:** `final-4d-nsm-step4-review-login.html` (review section)

**Desktop layout:**
- container `.review-desktop` max-width 1180px
- search bar：input + step filter dropdown + 全展開/收起 buttons
- grid `300px 1fr gap 14`：
  - 左 list：`q-list-item` × N（id mono / company · product / desc 截斷），active 卡藍邊淡藍底，max-height 600 overflow-y auto
  - 右 detail：題目敘述黃底 callout + 7 步驟 sections（step chip + 各欄位 block + bullet 渲染）

**Mobile:** 維持現狀（折疊式 card list）。

### 3.11 Page 11: Login `/auth-form`

**Mockup file:** `final-4d-nsm-step4-review-login.html` (login section)

- container `.login-desktop` max-width 420 margin-top 60
- 白卡 padding 28 + box-shadow
- H2「歡迎回來」+ sub
- segmented toggle（登入 / 註冊）
- email + password input + 忘記密碼連結
- 「登入」主按鈕
- 「或」divider
- 「先試試看（不註冊）」guest mode 按鈕

**Mobile:** 沿用現有 form。

### 3.12 Navbar（**所有頁面共用，重要修改**）

**修改點：**
1. 移除「範例 Review」 tab（dev tool 不曝光）
2. 加 favicon 圓 icon
3. desktop 維持 glassmorphism + sticky

**Final structure:**
```html
<nav class="navbar">
  <div class="navbar-left">
    <button class="btn-icon" id="btn-hamburger"><i class="ph ph-list"></i></button>
    <span class="navbar-logo">
      <span class="navbar-favicon"><i class="ph ph-circles-three"></i></span>
      PM Drill
    </span>
    <!-- desktop only -->
    <div class="navbar-tabs hide-mobile">
      <span class="navbar-tab active">CIRCLES</span>
      <span class="navbar-tab">北極星指標</span>
    </div>
  </div>
  <div class="navbar-actions" id="navbar-actions">
    <i class="ph ph-magnifying-glass hide-mobile"></i>
    <span class="navbar-email">{email}</span>
    <button class="btn-icon" id="btn-logout"><i class="ph ph-sign-out"></i></button>
  </div>
</nav>
```

```css
.navbar-favicon { width:22px; height:22px; border-radius:7px; background:var(--c-primary); display:inline-flex; align-items:center; justify-content:center; margin-right:8px; }
.navbar-favicon i { color:#fff; font-size:13px; }
.navbar-tabs { display:flex; gap:2px; margin-left:24px; }
.navbar-tab { padding:6px 12px; border-radius:7px; cursor:pointer; font-size:12.5px; color:var(--c-text-2); }
.navbar-tab.active { background:#fff; color:var(--c-text); font-weight:500; border:1px solid var(--c-border); }

@media (max-width: 1023px) {
  .hide-mobile { display:none; }
}
```

**注意：「北極星指標」入口在手機上維持原樣（現有的「北極星指標」按鈕）。**

---

## 4. Onboarding tour（NEW feature）

**Mockup file:** `final-1-onboarding-circles-home.html` (states 1-5)

**Trigger conditions:**
- localStorage `circles_onboarding_done !== '1'` AND user 是新登入（`AppState.circlesRecentSessions.length === 0`）
- 第一次進入 CIRCLES home 顯示「歡迎卡片」（State 1）
- 點「開始引導」→ 啟動 coachmark tour（State 2-5）
- 點「直接自己選題」/ tour 結束 / 略過 → set `circles_onboarding_done = '1'`，再不出現

### 4.1 Welcome card（State 1）

```html
<div class="onboarding-welcome">
  <div class="onboarding-welcome-icon"><i class="ph ph-hand-waving"></i></div>
  <h2>歡迎來到 PM Drill</h2>
  <p>CIRCLES 是 PM 面試常用的七步框架。第一次使用？建議跟著引導跑一輪，5 分鐘內了解整個流程。</p>
  <div class="onboarding-welcome-actions">
    <button class="btn-primary" id="onb-start">開始引導 →</button>
    <button class="btn-ghost" id="onb-skip">直接自己選題</button>
  </div>
</div>
```

放置位置：CIRCLES home 主欄頂部，取代「未完成 banner」+「常駐說明卡」。

### 4.2 Coachmark structure

```html
<!-- Spotlight overlay (full page) -->
<div class="onboarding-overlay" id="onb-overlay"></div>

<!-- Spotlight cutout (pseudo-元素 box-shadow trick) -->
<div class="onboarding-spotlight" id="onb-spotlight"
     style="left:{x}px; top:{y}px; width:{w}px; height:{h}px"></div>

<!-- Tooltip with arrow -->
<div class="onboarding-tooltip" id="onb-tooltip"
     data-arrow="left|right|top|bottom"
     style="left:{x}px; top:{y}px">
  <div class="onb-step">第 {n} 步 / 共 4</div>
  <h4>{title}</h4>
  <p>{description}</p>
  <div class="onb-actions">
    <span class="onb-skip" id="onb-skip-tour">略過引導</span>
    <button class="onb-next" id="onb-next">下一步 →</button>
  </div>
  <div class="onb-arrow"></div>
</div>
```

```css
.onboarding-overlay { position:fixed; inset:0; background:rgba(20,15,10,0.45); z-index:9000; pointer-events:auto; }
.onboarding-spotlight { position:fixed; background:transparent; border-radius:10px; box-shadow:0 0 0 4px var(--c-primary), 0 0 0 9999px rgba(20,15,10,0.45); z-index:9001; pointer-events:none; transition:all 0.3s ease; }
.onboarding-tooltip { position:fixed; background:#1F1D1B; color:#fff; padding:14px 16px; border-radius:10px; width:300px; box-shadow:0 10px 30px rgba(20,15,10,0.25); z-index:9002; }
.onboarding-tooltip[data-arrow="left"]::before { content:''; position:absolute; left:-7px; top:24px; border:8px solid transparent; border-right-color:#1F1D1B; }
/* … 同樣 right / top / bottom 用 ::before */
.onb-step { font-size:10.5px; letter-spacing:0.5px; text-transform:uppercase; color:rgba(255,255,255,0.55); font-weight:600; margin-bottom:5px; }
.onboarding-tooltip h4 { margin:0 0 5px; font-size:13.5px; font-weight:600; }
.onboarding-tooltip p { margin:0 0 12px; font-size:12px; color:rgba(255,255,255,0.78); line-height:1.6; }
.onb-actions { display:flex; justify-content:space-between; align-items:center; }
.onb-skip { color:rgba(255,255,255,0.5); cursor:pointer; font-size:11.5px; }
.onb-next { background:#fff; color:#1F1D1B; border:none; padding:6px 14px; border-radius:7px; font-size:11.5px; font-weight:500; cursor:pointer; }
```

### 4.3 4 個 tour steps

| Step | Highlight target | Tooltip 位置 | Tooltip 文字 |
|---|---|---|---|
| 1 | `.mode-section`（左 rail 練習模式區） | 右側，arrow=left | **選擇練習模式** — 建議首次選「完整模擬」走完整流程，熟悉後再用「步驟加練」針對弱點刻意練習。 |
| 2 | `.type-section`（左 rail 題型區） | 右側，arrow=left | **選擇題型** — 三種題型對應不同 PM 能力。新手建議從「產品設計」開始，題目較具體、容易上手。 |
| 3 | `.q-list`（中欄題目列表前 3 行） | 下方，arrow=top | **挑一道題目** — 每題標難度（Easy / Medium / Hard）。新手建議先挑 Easy。點題目會展開完整描述與「開始練習」。 |
| 4 | `.q-row.expanded .btn-primary`（展開卡內的「確認，開始練習」按鈕） | 右側，arrow=left | **開始練習** — 點此進入 Phase 1 — 填寫框架。每個欄位都有「提示」與「查看範例」幫你思考。完成後會自動進入訪談階段。 |

### 4.4 計算 spotlight 位置（JS）

```js
function showCoachmark(step) {
  var targets = ['.mode-section', '.type-section', '.q-list', '.q-row.expanded .btn-primary'];
  var el = document.querySelector(targets[step - 1]);
  if (!el) return;
  var rect = el.getBoundingClientRect();
  var spotlight = document.getElementById('onb-spotlight');
  spotlight.style.left = (rect.left - 4) + 'px';
  spotlight.style.top = (rect.top - 4) + 'px';
  spotlight.style.width = (rect.width + 8) + 'px';
  spotlight.style.height = (rect.height + 8) + 'px';

  var tooltip = document.getElementById('onb-tooltip');
  // step-specific positioning logic, see mockup …
}

window.addEventListener('resize', () => { if (AppState.onboardingStep) showCoachmark(AppState.onboardingStep); });
```

### 4.5 Mobile tour（NEW — confirmed）

手機螢幕窄，coachmark 處理：
- spotlight 改 highlight 該元素 box-shadow ring，不蓋 overlay
- tooltip 永遠顯示在底部 (sticky bottom sheet 樣式)
- 4 步驟 tour 第 4 步因「展開卡」在手機是切到新頁面狀態，coachmark 改在「題目列表」末尾解釋「點任一題會展開」

```css
@media (max-width: 1023px) {
  .onboarding-tooltip { position:fixed; left:16px; right:16px; bottom:16px; width:auto; }
  .onboarding-tooltip[data-arrow]::before { display:none; }
  .onboarding-spotlight { box-shadow:0 0 0 3px var(--c-primary); /* no overlay */ }
  .onboarding-overlay { display:none; }
}
```

### 4.6 測試 hook

`localStorage.setItem('circles_onboarding_done','0')` → 重新登入會看到 onboarding。
`localStorage.removeItem('circles_onboarding_done')` 也可。
`?onboarding=1` query string 強制顯示（dev 工具）。

---

## 5. NSM Step 4 對比 tab — mobile parity（NEW）

### 5.1 mobile layout

- tab-bar 4 tab 維持，可橫向 scroll
- 點「對比」tab 後內容區：
  - 標題提示
  - NSM 主指標 — vertical stack（不是並排）：
    - 「你的」card 全寬
    - 「教練版」card 全寬
  - 點任一卡 → 滑入 bottom sheet（slide up，70% 高度）顯示 detail + 「教練設計思路」
  - 4 維度也是 vertical stack：每維度標題 + 你的卡 + 教練卡（直堆）

### 5.2 bottom sheet 樣式

```css
.nsm-detail-sheet {
  position:fixed; bottom:0; left:0; right:0;
  background:#fff;
  border-radius:16px 16px 0 0;
  padding:20px;
  max-height:70vh;
  overflow-y:auto;
  box-shadow:0 -8px 24px rgba(0,0,0,0.15);
  z-index:100;
  transform:translateY(100%);
  transition:transform 0.25s ease;
}
.nsm-detail-sheet.open { transform:translateY(0); }
.nsm-detail-sheet-handle { width:40px; height:4px; background:var(--c-border-mid); border-radius:2px; margin:0 auto 14px; }
```

```html
<div class="nsm-detail-sheet" id="nsm-detail-sheet">
  <div class="nsm-detail-sheet-handle"></div>
  <!-- detail content same as desktop -->
</div>
```

點 backdrop 或 sheet 外 → close。

---

## 6. CSS modifications inventory

**Files to modify:**
- `public/style.css`（主要）
- `public/index.html`（favicon + meta）
- `public/app.js`（render functions add desktop branches）

**Estimated CSS line additions:** ~600 lines (per-page desktop layouts + onboarding + bottom sheet)

**Key class additions:**
- `.circles-home-desktop` + sub-classes (`.mode-section`, `.type-section`, `.q-list`, `.q-row` row layout)
- `.phase1-desktop`（含 toolbar 整合 spec 4 的 sticky-bottom mobile）
- `.phase2-desktop`（max-width 重設）
- `.phase3-desktop`
- `.nsm-home-desktop`、`.nsm-step2-desktop`、`.nsm-step3-desktop`、`.nsm-step4-desktop`
- `.review-desktop`、`.login-desktop`
- `.onboarding-*`（welcome / spotlight / tooltip / mobile sheet）
- `.nsm-detail-sheet`（mobile 對比 tab）
- `.navbar-tabs`、`.navbar-favicon`
- `.q-list-item.active`、`.dim-row`、`.bar-fill.warn`

---

## 7. JS modifications inventory

### 7.1 Detection helper

```js
function isDesktop() { return window.innerWidth >= 1024; }
```

### 7.2 Render branches

每個 `render*` 函式檢查 `isDesktop()`：

```js
function renderCirclesHome() {
  return isDesktop() ? renderCirclesHomeDesktop() : renderCirclesHomeMobile();
}
```

新增的 `renderXxxDesktop` 函式對應 mockup 排版。

### 7.3 Onboarding state

```js
AppState.onboardingActive = false;
AppState.onboardingStep = 0;  // 0=welcome, 1-4=tour, 5=done

function maybeStartOnboarding() {
  if (localStorage.getItem('circles_onboarding_done') === '1') return;
  if (AppState.circlesRecentSessions && AppState.circlesRecentSessions.length > 0) return;
  AppState.onboardingActive = true;
  AppState.onboardingStep = 0;  // welcome card
}

function nextOnboardingStep() {
  AppState.onboardingStep++;
  if (AppState.onboardingStep > 4) finishOnboarding();
  else renderOnboarding();
}

function finishOnboarding() {
  localStorage.setItem('circles_onboarding_done', '1');
  AppState.onboardingActive = false;
  document.getElementById('onb-overlay')?.remove();
  document.getElementById('onb-spotlight')?.remove();
  document.getElementById('onb-tooltip')?.remove();
}
```

### 7.4 NSM Step 4 mobile sheet

```js
function openNSMDetailSheet(content) {
  var sheet = document.getElementById('nsm-detail-sheet');
  sheet.querySelector('.sheet-content').innerHTML = content;
  sheet.classList.add('open');
  // Add backdrop click handler
}
```

### 7.5 Resize handler

```js
window.addEventListener('resize', debounce(function() {
  if (AppState.onboardingActive) showCoachmark(AppState.onboardingStep);
  // re-render if crossing breakpoint
  var wasDesktop = AppState._lastIsDesktop;
  var isNowDesktop = isDesktop();
  if (wasDesktop !== isNowDesktop) {
    AppState._lastIsDesktop = isNowDesktop;
    render();
  }
}, 100));
```

---

## 8. Implementation order（建議）

1. CSS tokens：`:root` 顏色變數、字型變數
2. Favicon SVG 製作 + index.html 更新
3. Navbar 改造（移除 dev tab、新增 favicon、desktop tabs）+ 全 emoji 替換 Phosphor
4. Container strategy（`#app` 解除限制 + per-page desktop class）
5. Page CSS（順序：CIRCLES home → Phase 1 → Phase 3 → Phase 2 → NSM Step 1-4 → review → login）
6. Onboarding tour（welcome card + 4 coachmark steps + mobile sheet variant）
7. NSM Step 4 對比 tab mobile bottom sheet
8. Resize handler + cross-breakpoint re-render
9. Playwright e2e（每頁 desktop 1280x800 + 1440x900 + iPhone 15 Pro 視覺對齊）

---

## 9. Risks & mitigations

| Risk | Mitigation |
|---|---|
| 109 處 hardcode #1A56DB → var(--c-primary) 漏改 | 寫 grep 檢查腳本 + Playwright 視覺迴歸 |
| 桌面 layout 與手機交叉時錯位 | 嚴格 `@media` 分隔 + cross-breakpoint test |
| coachmark 元素位置因 layout 渲染慢算錯 | requestAnimationFrame 後算 + 0.3s transition |
| onboarding flag 不小心清掉影響老用戶 | 用 named key `circles_onboarding_v1_done`，未來改版用 v2 |
| spec 1（bullet）與本 spec textarea 結構衝突 | 先實作本 spec，spec 1 只改範例渲染（非 textarea） |
| NSM Step 4 對比 tab mobile 既不存在，新增可能引入 bug | 先 feature flag，逐步推 |
| Instrument Serif 在 Win Chrome 渲染粗 | `font-feature-settings: "liga" 1` + 預載 |

---

## 10. Mockup HTML files reference

實作時請對照以下 mockup（在 `.superpowers/brainstorm/70171-1777356961/content/`）：

| File | 內容 |
|---|---|
| `clean-saas-warmer-v2.html` | 美學基準（CIRCLES home 範例） |
| `final-1-onboarding-circles-home.html` | onboarding 4 step + CIRCLES home 7 sub-states |
| `final-2-phase1-all-states.html` | Phase 1 form 9 states |
| `final-2b-LES-examples-hints.html` | L/E/S 範例 + 提示 |
| `final-2c-S-full-page.html` | S 步驟完整頁含 4 維度 toolbar |
| `final-2d-S-split-examples-hints.html` | S 拆兩頁（S-1 摘要 + S-2 追蹤指標） |
| `final-3-redo-spec-aligned.html` | Phase 2 5 states + Phase 3 4 sub-mode |
| `final-4a-nsm-step1-2-gate.html` | NSM Step 1 (3 states) + Step 2 + Gate (pass/fail) |
| `final-4b-nsm-step3-step4.html` | NSM Step 3 (3 hint states, 4 dims) |
| `final-4c-nsm-step2-nsm-field-example-hint.html` | NSM Step 2 北極星指標 範例+提示 |
| `final-4d-nsm-step4-review-login.html` | NSM Step 4 總覽 + review-examples + login |
| `final-fix-nav-and-coach.html` | navbar 移除 dev tab + NSM 對比 tab |

每個檔案含完整 inline CSS 與 HTML 結構，實作時 1:1 對照。
