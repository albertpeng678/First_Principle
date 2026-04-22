# Mobile Smoothness & Difficulty Lock — Design Spec
**Date:** 2026-04-22  
**Status:** Approved

---

## Context

使用者在手機上感受到兩個問題：
1. 整體操作卡頓，尤其鍵盤彈起/縮回時畫面抖動，按鈕點擊有明顯延遲感
2. 首頁難度卡片點一個後，其餘兩張仍可點擊，會建立多個無用 session

目標：讓網站在手機上達到接近原生 app 的滑順度，並封鎖重複建立 session 的漏洞。

---

## 問題根因

| # | 問題 | 根因 |
|---|------|------|
| 1 | 每次 tap 有 300ms 延遲 | 所有互動元素缺 `touch-action: manipulation` |
| 2 | Tap 閃灰/藍框 | 缺 `-webkit-tap-highlight-color: transparent` |
| 3 | 鍵盤彈起抖動 | `bar.style.bottom = X` 觸發 Layout Reflow；缺 `will-change: transform` |
| 4 | `transition: all` 浪費 | 監聽所有屬性含 layout-triggering 屬性 |
| 5 | `.def-panel` 動畫卡 | `max-height` transition 每幀觸發完整 layout |
| 6 | 動畫元素無 GPU layer | `.offcanvas`、bottom bars 缺 `will-change: transform` |
| 7 | 捲動邊界彈跳 | scroll 區域缺 `overscroll-behavior: contain` |
| 8 | 難度按鈕未全鎖 | 點擊只鎖被點那張，其餘可繼續點 |

---

## 設計

### A. CSS 變更（`public/style.css`）

**A1. 全域 tap 優化（加在 `* { box-sizing }` 之後）**
```css
* { -webkit-tap-highlight-color: transparent; }
button, a, [role="button"],
.diff-item, .diff-card, .nsm-question-card,
.offcanvas-item, .home-session-item, .history-item,
.nsm-tree-node, .issue-banner, .home-tab-btn,
.tab-btn, .btn-tool, .nsm-hint-btn {
  touch-action: manipulation;
}
```

**A2. 修正 `transition: all`（4 個選擇器）**
```css
.home-tab-btn    { transition: background 0.15s, color 0.15s, box-shadow 0.15s; }
.diff-item       { transition: border-color 0.15s, transform 0.15s; }
.nsm-question-card { transition: border-color 0.15s, background 0.15s, transform 0.15s; }
.nsm-tree-node   { transition: border-color 0.15s, background 0.15s, transform 0.15s; }
```

**A3. GPU layer 預備**
```css
.offcanvas         { will-change: transform; }
.offcanvas-overlay { will-change: opacity; }
.practice-bottom-bar, .nsm-fixed-bottom { will-change: transform; }
```

**A4. 捲動區域邊界**
```css
.chat-scroll, .offcanvas-list, .nsm-body, .nsm-report-body {
  overscroll-behavior: contain;
}
```

**A5. `.def-panel` 動畫從 `max-height` 改為 `opacity + scaleY`（GPU composited）**
```css
.def-panel {
  overflow: hidden;
  opacity: 0;
  transform: scaleY(0);
  transform-origin: top;
  transition: opacity 0.18s ease, transform 0.18s ease;
  pointer-events: none;
  display: flex !important;
}
.def-panel.open {
  opacity: 1;
  transform: scaleY(1);
  pointer-events: auto;
}
```

**A6. 字體平滑**
```css
body { -webkit-font-smoothing: antialiased; }
```

---

### B. JS 變更（`public/app.js`）

**B1. `adjustForKeyboard`（practice view，約 L906）**

把 `bar.style.bottom = keyboardHeight + 'px'` 改為：
```js
bar.style.transform = `translateY(-${keyboardHeight}px)`;
```
paddingBottom 更新保留（影響 chat scroll 高度）。
整個函式包在 `requestAnimationFrame` 內，確保每幀只執行一次。

**B2. `_adjustNsmKeyboardFn`（nsm view，約 L2172）**

同上，改 `bar.style.bottom` → `bar.style.transform = 'translateY(-Xpx)'`，加 rAF wrapper。

**B3. 難度按鈕全鎖（`bindHome`，約 L612）**

```js
document.querySelectorAll('.diff-item[data-difficulty]').forEach(card => {
  card.addEventListener('click', async () => {
    // 立刻鎖定全部卡片
    document.querySelectorAll('.diff-item[data-difficulty]').forEach(c => {
      c.style.pointerEvents = 'none';
      if (c !== card) c.style.opacity = '0.45';
    });
    // 被點的那張加 loading overlay（原有邏輯）
    ...
  });
});
```
失敗時恢復全部卡片的 `pointerEvents` 和 `opacity`。

---

### C. HTML 變更（`public/index.html`）

在 `<head>` 加 PWA meta tags：
```html
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="theme-color" content="#0f1117" media="(prefers-color-scheme: dark)">
<meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)">
```

---

## 不在此次範圍

- Service Worker / offline cache（另一個 spec）
- 頁面切換動畫（navigate transition）
- 圖片 lazy loading（目前無圖片）

---

## Verification

實作完成後，派遣**極度嚴苛的 UI/UX 稽核員**（Playwright agent）針對以下做飽和測試：

### 稽核範圍
1. **RWD**：320px / 375px / 430px / 768px / 1280px 各斷點排版正確
2. **首頁流程**：難度卡片點擊後全鎖 → loading → 進入練習頁
3. **練習頁**：鍵盤彈起/縮回 bottom bar 位置正確；chat scroll 可用
4. **NSM 流程**：Step 1-4 完整走完
5. **Offcanvas**：開啟/關閉動畫順暢，Overlay 點擊關閉正常
6. **Def panel**：展開/收合動畫順暢
7. **深/淺色主題**：全頁元素在兩個主題下正常顯示
8. **History / Report**：Tab 切換、匯出按鈕可用
9. **錯誤狀態**：API 失敗時 UI 恢復正常（卡片解鎖）

稽核員發現任何問題須立即列出清單並修復，不接受「看起來還好」的報告。
