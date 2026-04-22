# Session Delete Fix + Practice Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修正刪除 session 後「上次練習」仍殘留的 bug，並優化練習頁面底部欄位佈局以增大聊天空間。

**Architecture:** 所有變更集中在 `public/app.js` 單一檔案，無需新增檔案或修改後端。Feature 1 修正事件冒泡與 localStorage 清除邏輯；Feature 2 改為條件渲染定義區塊，僅在 `showSubmit` 為 true 時顯示。

**Tech Stack:** Vanilla JavaScript, localStorage API, DOM Event API

---

## File Map

| File | 變更 |
|------|------|
| `public/app.js` | 修改 `attachOffcanvasDeleteListeners`：confirm-delete handler 加 `e.stopPropagation()` + `localStorage.removeItem` |
| `public/app.js` | 修改 `attachHistoryDeleteListeners`：confirm-delete handler 加 `e.stopPropagation()` + `localStorage.removeItem` |
| `public/app.js` | 修改 `renderHome`：`issuePreview` 條件加 `current_phase !== 'done'` |
| `public/app.js` | 修改 `renderPractice`：條件渲染 label + textarea，保留 `#def-hint` 恆常存在 |
| `public/app.js` | 修改 `bindPractice`：`btn-update-def` 的條件改為 `!defEl \|\| defEl.disabled` |

---

## Task 1：Offcanvas confirm-delete — 加 stopPropagation 與清除 localStorage

**Files:**
- Modify: `public/app.js:174`

- [ ] **Step 1：定位 offcanvas confirm-delete handler**

在 `app.js` 第 174 行找到：

```js
item.querySelector('.offcanvas-confirm-delete').addEventListener('click', async () => {
```

- [ ] **Step 2：修改 handler 加入 `e.stopPropagation()` 與 localStorage 清除**

將第 174–192 行整段替換為：

```js
item.querySelector('.offcanvas-confirm-delete').addEventListener('click', async (e) => {
  e.stopPropagation();
  try {
    const res = await fetch(sessionRoute(`/${id}`), { method: 'DELETE', headers: apiHeaders() });
    if (!res.ok) {
      item.innerHTML = originalHTML;
      attachOffcanvasDeleteListeners(item);
      return;
    }
    if (localStorage.getItem('lastSessionId') === id) {
      localStorage.removeItem('lastSessionId');
    }
    if (AppState.currentSession?.id === id) {
      AppState.currentSession = null;
      navigate('home');
    } else {
      item.remove();
    }
  } catch (_) {
    item.innerHTML = originalHTML;
    attachOffcanvasDeleteListeners(item);
  }
});
```

- [ ] **Step 3：手動驗證**

打開瀏覽器，在 offcanvas 側欄刪除「目前的 currentSession」：
1. 刪除確認後，頁面應導回 home
2. `localStorage.getItem('lastSessionId')` 應為 `null`
3. home 頁面「上次練習」區塊不應出現

---

## Task 2：History confirm-delete — 加 stopPropagation 與清除 localStorage

**Files:**
- Modify: `public/app.js:1049`

- [ ] **Step 1：定位 history confirm-delete handler**

在 `app.js` 第 1049 行找到：

```js
item.querySelector('.history-confirm-delete').addEventListener('click', async () => {
```

- [ ] **Step 2：修改 handler**

將第 1049–1067 行整段替換為：

```js
item.querySelector('.history-confirm-delete').addEventListener('click', async (e) => {
  e.stopPropagation();
  try {
    const res = await fetch(`/api/sessions/${id}`, { method: 'DELETE', headers: apiHeaders() });
    if (!res.ok) {
      item.innerHTML = originalHTML;
      attachHistoryDeleteListeners(item);
      return;
    }
    if (localStorage.getItem('lastSessionId') === id) {
      localStorage.removeItem('lastSessionId');
    }
    if (AppState.currentSession?.id === id) {
      AppState.currentSession = null;
      navigate('home');
    } else {
      item.remove();
    }
  } catch (_) {
    item.innerHTML = originalHTML;
    attachHistoryDeleteListeners(item);
  }
});
```

- [ ] **Step 3：手動驗證**

在 History 頁面刪除目前 currentSession：
1. 刪除後頁面導回 home
2. `localStorage.getItem('lastSessionId')` 為 `null`
3. 「上次練習」不顯示

---

## Task 3：renderHome — 過濾已完成 session 的「上次練習」

**Files:**
- Modify: `public/app.js:302`

- [ ] **Step 1：定位 issuePreview 判斷式**

第 302 行：

```js
const issuePreview = AppState.currentSession
```

- [ ] **Step 2：修改條件加入 `current_phase !== 'done'`**

將第 302 行改為：

```js
const issuePreview = (AppState.currentSession && AppState.currentSession.current_phase !== 'done')
```

完整段落變為：

```js
const issuePreview = (AppState.currentSession && AppState.currentSession.current_phase !== 'done')
  ? `<div class="card" style="margin-bottom:16px">
      <p style="color:var(--text-secondary);font-size:0.85rem">上次練習</p>
      <p style="margin-top:6px">${escHtml(AppState.currentSession.issue_json?.issueText?.slice(0, 80))}…</p>
      <button class="btn btn-primary" style="margin-top:12px" id="btn-continue">繼續練習</button>
    </div>` : '';
```

- [ ] **Step 3：手動驗證**

完成一次練習（`current_phase === 'done'`），回到 home：
1. 「上次練習」卡片不應出現
2. 開始一個新練習（in_progress），回到 home：「上次練習」應出現

---

## Task 4：renderPractice — 條件渲染定義 textarea

**Files:**
- Modify: `public/app.js:526-530`

- [ ] **Step 1：定位定義區塊**

第 526–530 行（在 `practice-bottom-bar` 內）：

```js
<label class="essence-label" for="final-def">問題本質定義（提交前可隨時更新）</label>
<div id="def-hint" class="essence-label" style="display:none;">完成 3 輪對話後即可編輯定義</div>
<textarea id="final-def" class="essence-textarea" rows="2"
  placeholder="用中性問句描述問題本質…&#10;例：如何讓 [角色] 在 [情境] 下更有效率達成 [目標]？"
  ${!showSubmit ? 'disabled' : ''}></textarea>
```

- [ ] **Step 2：改為條件渲染**

替換為：

```js
<div id="def-hint" class="essence-label" style="display:none;">完成 3 輪對話後即可編輯定義</div>
${showSubmit ? `
  <label class="essence-label" for="final-def">問題本質定義（提交前可隨時更新）</label>
  <textarea id="final-def" class="essence-textarea" rows="2"
    placeholder="用中性問句描述問題本質…&#10;例：如何讓 [角色] 在 [情境] 下更有效率達成 [目標]？"></textarea>
` : ''}
```

- [ ] **Step 3：手動驗證**

在對話 < 3 輪時進入 practice 頁：
1. label 與 textarea 應不可見，聊天區域明顯較高
2. 滿 3 輪後：label 與 textarea 出現，佔用部分空間

---

## Task 5：bindPractice — 修正 btn-update-def 的 guard 條件

**Files:**
- Modify: `public/app.js:565-576`

- [ ] **Step 1：定位 btn-update-def handler**

第 565–576 行：

```js
document.getElementById('btn-update-def')?.addEventListener('click', () => {
  const defEl = document.getElementById('final-def');
  if (defEl?.disabled) {
    const hint = document.getElementById('def-hint');
    if (hint) {
      hint.style.display = 'block';
      setTimeout(() => { hint.style.display = 'none'; }, 2500);
    }
  } else {
    defEl?.focus();
  }
});
```

- [ ] **Step 2：修改條件為 `!defEl || defEl.disabled`**

替換整段 handler：

```js
document.getElementById('btn-update-def')?.addEventListener('click', () => {
  const defEl = document.getElementById('final-def');
  if (!defEl || defEl.disabled) {
    const hint = document.getElementById('def-hint');
    if (hint) {
      hint.style.display = 'block';
      setTimeout(() => { hint.style.display = 'none'; }, 2500);
    }
  } else {
    defEl.focus();
  }
});
```

- [ ] **Step 3：手動驗證**

在對話 < 3 輪時（`#final-def` 不存在）：
1. 點擊「更新定義」按鈕 → `#def-hint` 應短暫顯示「完成 3 輪對話後即可編輯定義」
2. 在 ≥ 3 輪時點擊 → focus 移至 textarea

---

## Task 6：整合測試 — 完整流程驗證

- [ ] **Step 1：刪除 currentSession — Offcanvas 路徑**

1. 開始新練習（取得一個 in_progress session）
2. 打開 offcanvas → 確認刪除該 session
3. 確認：回到 home、無「上次練習」、DevTools localStorage 無 `lastSessionId`

- [ ] **Step 2：刪除 currentSession — History 路徑**

1. 開始新練習
2. 進入 History 頁 → 刪除該 session
3. 確認：回到 home、無「上次練習」、`localStorage.lastSessionId` 已清除

- [ ] **Step 3：完成練習後回 home**

1. 走完一個完整 session（`current_phase === 'done'`）
2. 回到 home
3. 確認：「上次練習」不出現

- [ ] **Step 4：Practice 底部欄位佈局**

1. 新開練習，進入 practice 頁（0 輪）
2. 確認：定義 label/textarea 不可見；聊天區域更大
3. 點擊「更新定義」→ 確認 hint 短暫出現
4. 送出 3 輪後：label/textarea 出現；「提交定義」按鈕出現

---

## 預期行為總結

| 情況 | Before | After |
|------|--------|-------|
| 刪除 currentSession | localStorage 殘留，可能重現 | localStorage 清除，home 無殘留 |
| 已完成 session 回 home | 顯示「上次練習」 | 不顯示 |
| Practice < 3 輪 | textarea disabled，佔空間 | textarea 隱藏，聊天區更大 |
| 點「更新定義」(< 3 輪) | `defEl.disabled` check，若無 el 則 focus(null) | `!defEl` guard，正確顯示 hint |
