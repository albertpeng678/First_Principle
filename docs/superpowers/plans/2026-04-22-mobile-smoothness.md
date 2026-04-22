# Mobile Smoothness & Difficulty Lock Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 消除手機操作卡頓（300ms tap 延遲、鍵盤彈起 jank、無 GPU layer）並鎖定難度按鈕防止重複建立 session，最後派遣嚴苛 UI/UX 稽核員做飽和測試。

**Architecture:** 純 CSS + Vanilla JS 修改，不引入任何新依賴。CSS 改動集中在 `public/style.css` 末尾新增覆蓋區塊；JS 改動針對 `public/app.js` 中三個明確位置（practice keyboard handler、nsm keyboard handler、bindHome difficulty click）；HTML 加四行 meta tags。

**Tech Stack:** Vanilla JS, plain CSS, Express static server (`node server.js`)

---

## Files

| 動作 | 路徑 | 變更內容 |
|------|------|---------|
| Modify | `public/style.css` | 新增 Task 1-3 的 CSS 區塊 |
| Modify | `public/app.js` | Task 4 鍵盤 handler × 2、Task 5 難度按鈕鎖定 |
| Modify | `public/index.html` | Task 6 PWA meta tags |

---

## Task 1: 全域 Tap 優化（touch-action + tap-highlight）

**Files:**
- Modify: `public/style.css`（在檔案最末尾新增）

消除 300ms tap delay 與 iOS tap 閃框——這是最高優先級的修改，影響全站每一次點擊的體感。

- [ ] **Step 1: 在 style.css 末尾新增以下完整區塊**

```css
/* ══════════════════════════════════════════════════
   PERF — Task 1: Global tap optimisation
   ══════════════════════════════════════════════════ */

/* 消除 iOS/Android tap 時閃現的藍/灰高亮框 */
* { -webkit-tap-highlight-color: transparent; }

/* 消除所有互動元素的 300ms tap delay；
   manipulation = allow pan + pinch-zoom, but skip double-tap-to-zoom delay */
button,
a,
[role="button"],
.diff-item,
.diff-card,
.nsm-question-card,
.offcanvas-item,
.home-session-item,
.history-item,
.nsm-tree-node,
.issue-banner,
.home-tab-btn,
.tab-btn,
.btn-tool,
.nsm-hint-btn,
.nsm-question-card,
label[for] {
  touch-action: manipulation;
}

/* iOS 字體平滑 — 讓文字更銳利，接近 native app */
body { -webkit-font-smoothing: antialiased; }
```

- [ ] **Step 2: 啟動 dev server 並在手機瀏覽器（或 Chrome DevTools 手機模擬）點擊難度卡片**

```bash
npm run dev
# 開啟 http://localhost:3000，切換到 手機模擬模式（F12 → Toggle device toolbar）
```

預期：點擊後幾乎即時回應，不再有明顯的「等一下」感。

- [ ] **Step 3: Commit**

```bash
git add public/style.css
git commit -m "perf: add touch-action manipulation + tap-highlight-color globally"
```

---

## Task 2: 修正 `transition: all`（4 個選擇器）

**Files:**
- Modify: `public/style.css`（在 Task 1 區塊之後新增）

`transition: all` 會攔截所有 CSS 屬性的變化，包括會觸發 layout 的屬性（如 width、height、padding）。只 transition GPU-safe 屬性即可。

- [ ] **Step 1: 在 Task 1 區塊之後繼續新增以下區塊**

```css
/* ══════════════════════════════════════════════════
   PERF — Task 2: Fix transition:all → scoped transitions
   ══════════════════════════════════════════════════ */

/* 覆蓋原有的 transition: all 0.15s，只保留安全屬性 */
.home-tab-btn {
  transition: background 0.15s, color 0.15s, box-shadow 0.15s;
}
.diff-item {
  transition: border-color 0.15s, transform 0.15s, opacity 0.15s;
}
.nsm-question-card {
  transition: border-color 0.15s, background 0.15s, transform 0.15s;
}
.nsm-tree-node {
  transition: border-color 0.15s, background 0.15s, transform 0.15s;
}
```

- [ ] **Step 2: 在瀏覽器點擊 Home Tab Toggle（PM / NSM）、難度卡片、NSM tree nodes，確認 hover/active 視覺效果仍然存在**

預期：視覺效果不變，但 transitions 不再捕捉無關屬性。

- [ ] **Step 3: Commit**

```bash
git add public/style.css
git commit -m "perf: scope transition:all to GPU-safe properties on 4 selectors"
```

---

## Task 3: GPU Layer 準備 + Scroll 優化

**Files:**
- Modify: `public/style.css`（在 Task 2 區塊之後新增）

`will-change: transform` 告訴瀏覽器預先把這個元素提升到獨立 GPU layer，讓動畫不影響主 layer 的 compositing。`overscroll-behavior: contain` 防止 scroll chaining（捲到底部時觸發整頁 bounce）。

- [ ] **Step 1: 繼續新增以下區塊**

```css
/* ══════════════════════════════════════════════════
   PERF — Task 3: will-change + overscroll containment
   ══════════════════════════════════════════════════ */

/* 預先準備 GPU layer：offcanvas 用 transform 動畫，bottom bars 用 transform 做鍵盤調整 */
.offcanvas          { will-change: transform; }
.offcanvas-overlay  { will-change: opacity; }
.practice-bottom-bar,
.nsm-fixed-bottom   { will-change: transform; }

/* 防止 scroll 區域的彈跳傳遞到上層，讓各區域獨立捲動 */
.chat-scroll,
.offcanvas-list,
.nsm-body,
.nsm-report-body    { overscroll-behavior: contain; }
```

- [ ] **Step 2: 在瀏覽器開啟 Offcanvas（漢堡選單），確認 slide-in 動畫順暢**

預期：offcanvas 開啟/關閉動畫無閃爍。

- [ ] **Step 3: Commit**

```bash
git add public/style.css
git commit -m "perf: add will-change to animated elements, overscroll-behavior to scroll containers"
```

---

## Task 4: 鍵盤 Handler 改用 Transform（2 處）

**Files:**
- Modify: `public/app.js` — `adjustForKeyboard`（約 L906）和 `_adjustNsmKeyboardFn`（約 L2172）

**根本原因：** `bar.style.bottom = X + 'px'` 改變 position 屬性，瀏覽器每幀都必須做 Layout → Paint → Composite 完整三步。改為 `transform: translateY(-Xpx)` 後只需 Composite 一步，完全在 GPU 上執行，鍵盤動畫期間不再卡頓。

### 4a. Practice View

- [ ] **Step 1: 找到 practice 的 `adjustForKeyboard` 函式（約 L905-919），將整個函式替換為：**

```js
  // visualViewport keyboard adjustment — transform only, no layout-triggering bottom changes
  let _practiceKbRaf = null;
  function adjustForKeyboard() {
    if (!window.visualViewport) return;
    if (_practiceKbRaf) return;
    _practiceKbRaf = requestAnimationFrame(() => {
      _practiceKbRaf = null;
      const bar = document.querySelector('.practice-bottom-bar');
      const chatArea = document.getElementById('chat-area');
      if (!bar) return;
      const keyboardHeight = Math.max(0, window.innerHeight - window.visualViewport.offsetTop - window.visualViewport.height);
      bar.style.transform = `translateY(-${keyboardHeight}px)`;
      if (chatArea) chatArea.style.paddingBottom = (bar.offsetHeight + keyboardHeight) + 'px';
      if (keyboardHeight > 100) scrollChatToBottom();
    });
  }
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', adjustForKeyboard);
    adjustForKeyboard();
  }
```

注意：`bar.style.bottom` 這行要完全移除，替換為 `bar.style.transform`。`practice-bottom-bar` 在 CSS 中已有 `bottom: 0`，transform 只是在此基礎上做視覺位移。

- [ ] **Step 2: 確認 CSS 裡 `.practice-bottom-bar` 保有 `bottom: 0`（已存在，不需改）**

```bash
grep -n "practice-bottom-bar" public/style.css | grep "bottom"
```

預期輸出應包含 `bottom: 0`。

### 4b. NSM View

- [ ] **Step 3: 找到 `_adjustNsmKeyboardFn` 賦值（約 L2172-2183），替換整個函式體為：**

```js
  _adjustNsmKeyboardFn = function() {
    if (!window.visualViewport) return;
    let nsmKbRaf = null;
    return function() {
      if (nsmKbRaf) return;
      nsmKbRaf = requestAnimationFrame(() => {
        nsmKbRaf = null;
        var bar = document.querySelector('.nsm-fixed-bottom');
        var body = document.querySelector('.nsm-body');
        if (!bar) {
          if (body) body.style.paddingBottom = '';
          return;
        }
        var keyboardHeight = Math.max(0, window.innerHeight - window.visualViewport.offsetTop - window.visualViewport.height);
        bar.style.transform = `translateY(-${keyboardHeight}px)`;
        if (body) body.style.paddingBottom = (bar.offsetHeight + keyboardHeight) + 'px';
      });
    };
  }();
```

NSM 的 `_adjustNsmKeyboardFn` 會被 `addEventListener` 引用並在 `removeEventListener` 時使用，需確保它仍是一個函式（用 IIFE 包住確保 rAF state 不洩漏）。

- [ ] **Step 4: 啟動 server，在手機模擬器打開練習頁，點擊文字輸入框讓鍵盤彈起，再縮回**

```bash
npm run dev
```

預期：鍵盤彈起/縮回時 bottom bar 平順移動，無抖動、無跳位。

- [ ] **Step 5: Commit**

```bash
git add public/app.js
git commit -m "perf: keyboard adjustment use transform instead of bottom — eliminate layout reflow"
```

---

## Task 5: 難度按鈕全鎖

**Files:**
- Modify: `public/app.js` — `bindHome` 內的 `.diff-item[data-difficulty]` click handler（約 L612-635）

**根本原因：** 目前只鎖被點那張卡，其他兩張仍可點擊，在 API 回應前快速連點會建立多個 session。

- [ ] **Step 1: 找到 L612 附近的 `document.querySelectorAll('.diff-item[data-difficulty]').forEach(card => {`，將整個 handler 替換為：**

```js
  document.querySelectorAll('.diff-item[data-difficulty]').forEach(card => {
    card.addEventListener('click', async () => {
      const difficulty = card.dataset.difficulty;
      const allCards = document.querySelectorAll('.diff-item[data-difficulty]');

      // 鎖定全部卡片，防止重複點擊建立多個 session
      allCards.forEach(c => {
        c.style.pointerEvents = 'none';
        if (c !== card) c.style.opacity = '0.45';
      });

      // 被點的那張加 loading overlay
      card.style.position = 'relative';
      card.insertAdjacentHTML('beforeend', '<div class="card-overlay"><i class="ph ph-circle-notch" style="font-size:24px;animation:spin 0.7s linear infinite"></i></div>');

      try {
        const res = await fetch(sessionRoute(), {
          method: 'POST',
          headers: apiHeaders(),
          body: JSON.stringify({ difficulty }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        AppState.currentSession = { id: data.sessionId, issue_json: { issueText: data.issueText, source: data.source }, conversation: [], turn_count: 0, current_phase: 'reframe' };
        localStorage.setItem('lastSessionId', data.sessionId);
        navigate('practice');
      } catch (e) {
        // 失敗時解鎖全部卡片
        allCards.forEach(c => {
          c.style.pointerEvents = '';
          c.style.opacity = '';
        });
        card.querySelector('.card-overlay')?.remove();
        alert('出題失敗：' + e.message);
      }
    });
  });
```

- [ ] **Step 2: 在瀏覽器快速連點三張難度卡片，確認只有一個 session 被建立**

在 Chrome DevTools Network 面板觀察，應只出現一個 `POST /api/sessions` 請求。

- [ ] **Step 3: 模擬 API 失敗（暫時關閉 server），點擊難度卡片，確認失敗後三張卡片都恢復可點擊狀態**

```bash
# 先停止 server，在瀏覽器點難度卡片，確認 alert 出現且卡片解鎖
```

- [ ] **Step 4: Commit**

```bash
git add public/app.js
git commit -m "fix(home): lock all difficulty cards on click to prevent duplicate session creation"
```

---

## Task 6: PWA Meta Tags

**Files:**
- Modify: `public/index.html`（在 `<head>` 內 `</head>` 之前）

讓網站 Add to Home Screen 後隱藏瀏覽器 UI，提供最接近 native app 的體驗。

- [ ] **Step 1: 在 `public/index.html` 的 `<head>` 最後（`</head>` 之前）新增：**

```html
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="default">
  <meta name="theme-color" content="#0f1117" media="(prefers-color-scheme: dark)">
  <meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)">
```

- [ ] **Step 2: Commit**

```bash
git add public/index.html
git commit -m "feat: add PWA meta tags for home screen app experience"
```

---

## Task 7: UI/UX 飽和稽核（Playwright）

**Files:** 無新增檔案，讀取現有頁面

實作完成後，使用 Playwright 瀏覽器自動化對全部使用者流程與 RWD 做飽和測試。稽核員需**極度嚴苛**，不接受「看起來還好」的報告，所有問題須列清單並立即修復。

- [ ] **Step 1: 確認 server 在跑**

```bash
npm run dev
# 確認 http://localhost:3000 可訪問
```

- [ ] **Step 2: 派遣嚴苛 UI/UX 稽核員**

在此步驟，invoke `superpowers:dispatching-parallel-agents` skill，並以 Playwright agent 執行以下稽核清單：

**稽核清單 — RWD 斷點（每個斷點截圖對比）：**
- 320px（最小 iPhone SE）
- 375px（iPhone 14 標準）
- 430px（iPhone 14 Pro Max）
- 768px（iPad）
- 1280px（Desktop）

**稽核清單 — 使用者流程（每流程走完整路徑）：**
1. 訪客登入流程（Register → Login → Home）
2. 首頁難度選擇 → 練習頁進入
3. 練習頁：輸入訊息、送出、收到 AI 回覆、展開/關閉 def-panel、使用 Hint
4. 練習頁：Issue banner 展開/摺疊
5. 完成練習 → Report 頁，切換全部 Tab（分析/對話/重點/匯出）
6. History 頁：列表呈現、點進舊 session
7. NSM 流程：Step 1 選題 → Step 2 輸入 NSM → Step 3 拆解 → Step 4 報告
8. Offcanvas：開啟、點選歷史、關閉（背景 overlay 點擊）
9. 深色/淺色模式切換（如有）
10. 難度卡片連點測試（應只建立一個 session）
11. API 失敗狀態（network offline）→ 卡片應解鎖

**稽核標準：**
- 任何元素超出視窗邊界 → 缺陷
- 文字截斷/重疊 → 缺陷
- 按鈕小於 44×44px touch target → 缺陷
- 頁面無法捲動到底部 → 缺陷
- 鍵盤彈起後 bottom bar 位置錯誤 → 缺陷
- 任何 console error → 缺陷
- 任何流程卡住無法繼續 → 嚴重缺陷

稽核員發現問題後須在同一 session 修復，再重新跑該流程確認通過。
