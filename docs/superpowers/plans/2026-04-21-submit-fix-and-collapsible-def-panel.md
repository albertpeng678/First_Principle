# Submit Fix + Collapsible Definition Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修正提交後狀態不更新導致重複評分的 bug，並重新設計 Practice 底部欄位為折疊式定義面板，同時消除 navbar 無效間距。

**Architecture:** 所有變更集中於 `public/app.js`、`public/style.css`、`routes/sessions.js`、`routes/guest-sessions.js`。無新增檔案。Bug Fix 修正 backend update query 缺少 owner filter 與 frontend 沒有清除 lastSessionId；UI 重構將定義 textarea 與提交按鈕同列折疊，以「更新定義」按鈕兼任 toggle。

**Tech Stack:** Vanilla JavaScript, CSS Flexbox, Express.js, Supabase JS SDK

---

## File Map

| File | 變更 |
|------|------|
| `routes/guest-sessions.js` | submit handler：update query 加 `.eq('guest_id', req.guestId)` + 加 error throw |
| `routes/sessions.js` | submit handler：update query 加 `.eq('user_id', req.user.id)` + 加 error throw |
| `public/app.js` | `submitDefinition`：成功後清除 `lastSessionId` |
| `public/app.js` | `renderPractice`：`showSubmit` 排除 `done`；`done` session 直接 redirect |
| `public/app.js` | `renderPractice` HTML：重構底部欄位（外露 toolbar、折疊 def-panel、同列 textarea+submit） |
| `public/app.js` | `bindPractice`：更新定義按鈕承擔 toggle + focus 邏輯，含 caret 切換 |
| `public/style.css` | 新增 `.def-panel`、`.btn-tool.active`；修正 practice navbar margin |

---

## Task 1：Backend — 修正 guest-sessions submit update query

**Files:**
- Modify: `routes/guest-sessions.js:134`

- [ ] **Step 1：定位 submit update**

`routes/guest-sessions.js` 第 134 行：

```js
await db.from('guest_sessions').update({
  final_definition: finalDefinition,
  scores_json: scores,
  coach_demo_json: coachDemo,
  status: 'completed',
  current_phase: 'done'
}).eq('id', req.params.id);
```

- [ ] **Step 2：替換為加 guest_id filter + error handling**

```js
const { error: updateError } = await db.from('guest_sessions').update({
  final_definition: finalDefinition,
  scores_json: scores,
  coach_demo_json: coachDemo,
  status: 'completed',
  current_phase: 'done'
}).eq('id', req.params.id).eq('guest_id', req.guestId);
if (updateError) throw updateError;
```

- [ ] **Step 3：執行現有測試確認不破壞**

```bash
npm test
```

Expected: 所有測試通過（middleware tests）

- [ ] **Step 4：Commit**

```bash
git add routes/guest-sessions.js
git commit -m "fix: add guest_id filter to submit update, throw on DB error"
```

---

## Task 2：Backend — 修正 sessions submit update query

**Files:**
- Modify: `routes/sessions.js:120`

- [ ] **Step 1：定位 submit update**

`routes/sessions.js` 第 120 行：

```js
await db.from('practice_sessions').update({
  final_definition: finalDefinition,
  scores_json: scores,
  coach_demo_json: coachDemo,
  status: 'completed',
  current_phase: 'done'
}).eq('id', req.params.id);
```

- [ ] **Step 2：替換為加 user_id filter + error handling**

```js
const { error: updateError } = await db.from('practice_sessions').update({
  final_definition: finalDefinition,
  scores_json: scores,
  coach_demo_json: coachDemo,
  status: 'completed',
  current_phase: 'done'
}).eq('id', req.params.id).eq('user_id', req.user.id);
if (updateError) throw updateError;
```

- [ ] **Step 3：執行測試**

```bash
npm test
```

Expected: PASS

- [ ] **Step 4：Commit**

```bash
git add routes/sessions.js
git commit -m "fix: add user_id filter to submit update, throw on DB error"
```

---

## Task 3：Frontend — submitDefinition 成功後清除 lastSessionId

**Files:**
- Modify: `public/app.js:707`（`submitDefinition` success block）

- [ ] **Step 1：定位 success block**

第 707–712 行：

```js
AppState.currentSession.scores_json = data.scores;
AppState.currentSession.coach_demo_json = data.coachDemo || null;
AppState.currentSession.final_definition = def;
AppState.currentSession.current_phase = 'done';
AppState.activeReportTab = 'overview';
navigate('report');
```

- [ ] **Step 2：加入 lastSessionId 清除**

替換為：

```js
AppState.currentSession.scores_json = data.scores;
AppState.currentSession.coach_demo_json = data.coachDemo || null;
AppState.currentSession.final_definition = def;
AppState.currentSession.current_phase = 'done';
localStorage.removeItem('lastSessionId');
AppState.activeReportTab = 'overview';
navigate('report');
```

- [ ] **Step 3：Commit**

```bash
git add public/app.js
git commit -m "fix: clear lastSessionId after successful submit"
```

---

## Task 4：Frontend — renderPractice guard against done sessions

**Files:**
- Modify: `public/app.js:503`

- [ ] **Step 1：定位 renderPractice 開頭**

第 499–504 行：

```js
function renderPractice() {
  const s = AppState.currentSession;
  if (!s) return '<p style="padding:16px">沒有進行中的練習</p>';

  const turnCount = s.turn_count || 0;
  const showSubmit = s.current_phase === 'submit' || turnCount >= 3;
```

- [ ] **Step 2：加入 done redirect + 修正 showSubmit**

替換為：

```js
function renderPractice() {
  const s = AppState.currentSession;
  if (!s) return '<p style="padding:16px">沒有進行中的練習</p>';
  if (s.current_phase === 'done') {
    setTimeout(() => navigate('report'), 0);
    return '';
  }

  const turnCount = s.turn_count || 0;
  const showSubmit = turnCount >= 3;
```

- [ ] **Step 3：Commit**

```bash
git add public/app.js
git commit -m "fix: redirect done sessions from practice to report, exclude done from showSubmit"
```

---

## Task 5：CSS — 修正 practice navbar margin + 新增 def-panel 樣式

**Files:**
- Modify: `public/style.css`

- [ ] **Step 1：在 practice 全螢幕 block 加入 navbar margin 覆寫**

找到：

```css
body[data-view="practice"] .practice-bottom-bar {
  position: static;
}
```

在其前面插入（約第 143 行前）：

```css
body[data-view="practice"] .navbar { margin-bottom: 0; }
```

- [ ] **Step 2：在 `.chat-send-row` 之後加入 def-panel 樣式**

找到 `.chat-send-row { display: flex; gap: 8px; }` 後，新增：

```css
.def-panel {
  display: none;
  gap: 8px;
  align-items: flex-start;
}
.def-panel.open { display: flex; }
.def-panel .essence-textarea { flex: 1; margin: 0; }
.btn-tool.active { background: rgba(108,99,255,0.12); border-color: var(--accent); }
[data-theme="light"] .btn-tool.active { background: rgba(90,82,224,0.1); }
```

- [ ] **Step 3：Commit**

```bash
git add public/style.css
git commit -m "style: remove practice navbar margin gap, add def-panel and btn-tool.active styles"
```

---

## Task 6：Frontend — 重構 renderPractice HTML（折疊式底部欄）

**Files:**
- Modify: `public/app.js:525`（practice-bottom-bar 內容）

- [ ] **Step 1：定位整個 bottom-bar 區塊**

第 525–543 行（`<div class="practice-bottom-bar">` 到最後的 `</div>`）：

```js
    <div class="practice-bottom-bar">
      <div class="bottom-toolbar">
        <button class="btn-tool" id="btn-hint"><i class="ph ph-lightbulb"></i> 本輪提示</button>
        <button class="btn-tool" id="btn-update-def"><i class="ph ph-note-pencil"></i> 更新定義</button>
      </div>
      <div id="def-hint" class="essence-label" style="display:none;">完成 3 輪對話後即可編輯定義</div>
      ${showSubmit ? `
  <label class="essence-label" for="final-def">問題本質定義（提交前可隨時更新）</label>
  <textarea id="final-def" class="essence-textarea" rows="2"
    placeholder="用中性問句描述問題本質…&#10;例：如何讓 [角色] 在 [情境] 下更有效率達成 [目標]？"></textarea>
` : ''}
      <div class="chat-send-row">
        <textarea id="chat-input" class="chat-input" style="flex:1" rows="2"
          placeholder="輸入你的問題或觀察…"
          ${AppState.isStreaming ? 'disabled' : ''}></textarea>
        <button class="btn btn-primary" id="btn-send" ${AppState.isStreaming ? 'disabled' : ''}>送出</button>
      </div>
      ${showSubmit ? '<button class="btn btn-primary" style="align-self:flex-start" id="btn-submit">提交定義</button>' : ''}
    </div>
```

- [ ] **Step 2：替換為新的折疊式底部欄**

```js
    <div class="practice-bottom-bar">
      <div class="bottom-toolbar">
        <button class="btn-tool" id="btn-hint"><i class="ph ph-lightbulb"></i> 本輪提示</button>
        <button class="btn-tool" id="btn-update-def">
          <i class="ph ph-note-pencil"></i> 更新定義${showSubmit ? ' <i class="ph ph-caret-up" id="def-caret" style="font-size:0.7rem;margin-left:2px"></i>' : ''}
        </button>
      </div>
      <div id="def-hint" class="essence-label" style="display:none;">完成 3 輪對話後即可編輯定義</div>
      ${showSubmit ? `
      <div class="def-panel" id="def-panel">
        <textarea id="final-def" class="essence-textarea" rows="2"
          placeholder="用中性問句描述問題本質…&#10;例：如何讓 [角色] 在 [情境] 下更有效率達成 [目標]？" style="flex:1"></textarea>
        <button class="btn btn-primary" id="btn-submit" style="flex-shrink:0;align-self:flex-start">提交定義</button>
      </div>` : ''}
      <div class="chat-send-row">
        <textarea id="chat-input" class="chat-input" style="flex:1" rows="2"
          placeholder="輸入你的問題或觀察…"
          ${AppState.isStreaming ? 'disabled' : ''}></textarea>
        <button class="btn btn-primary" id="btn-send" ${AppState.isStreaming ? 'disabled' : ''}>送出</button>
      </div>
    </div>
```

- [ ] **Step 3：Commit**

```bash
git add public/app.js
git commit -m "feat: restructure practice bottom bar - collapsible def panel, textarea+submit same row"
```

---

## Task 7：Frontend — 更新 bindPractice 的 btn-update-def handler

**Files:**
- Modify: `public/app.js:569`（`btn-update-def` addEventListener block）

- [ ] **Step 1：定位 btn-update-def handler**

第 569–581 行：

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

- [ ] **Step 2：替換為 toggle + focus 邏輯**

```js
  document.getElementById('btn-update-def')?.addEventListener('click', () => {
    const panel = document.getElementById('def-panel');
    if (!panel) {
      const hint = document.getElementById('def-hint');
      if (hint) {
        hint.style.display = 'block';
        setTimeout(() => { hint.style.display = 'none'; }, 2500);
      }
      return;
    }
    const isOpen = panel.classList.toggle('open');
    const caret = document.getElementById('def-caret');
    const btn = document.getElementById('btn-update-def');
    if (caret) caret.className = isOpen ? 'ph ph-caret-down' : 'ph ph-caret-up';
    if (btn) btn.classList.toggle('active', isOpen);
    if (isOpen) document.getElementById('final-def')?.focus();
  });
```

- [ ] **Step 3：確認 finalDefEl 初始化不受影響**

`bindPractice` 第 548–551 行應保持：

```js
  const finalDefEl = document.getElementById('final-def');
  if (finalDefEl) {
    finalDefEl.value = AppState.essenceDraft;
    finalDefEl.addEventListener('input', e => { AppState.essenceDraft = e.target.value; });
  }
```

這段不需修改，因為 `finalDefEl` 為 null 時已有 `if` guard。

- [ ] **Step 4：Commit**

```bash
git add public/app.js
git commit -m "feat: btn-update-def toggles def panel with caret + active state"
```

---

## Task 8：手動驗證整合測試

- [ ] **Step 1：重複評分 bug 驗證**

1. 開始新練習（guest mode）→ 完成 3 輪 → 提交定義 → 看到 report
2. 重新整理瀏覽器
3. 確認：不再出現「繼續上次的練習？」 → 直接進首頁
4. DevTools → Application → localStorage：`lastSessionId` 應為 `null`

- [ ] **Step 2：practice 頁面導向 done session**

1. 在 AppState 手動設 `AppState.currentSession.current_phase = 'done'`（DevTools console）
2. 執行 `navigate('practice')`
3. 確認：立即跳轉至 report 頁，不停在 practice

- [ ] **Step 3：navbar 間距確認**

在 practice 頁面：DevTools 選取 `.navbar` → 確認 `margin-bottom: 0px`（被覆寫）

- [ ] **Step 4：底部欄 < 3 輪**

1. 新練習 0 輪時：底部只有 [本輪提示][更新定義] + chat row
2. 點「更新定義」→ def-hint 出現（「完成 3 輪對話後即可編輯定義」）
3. 確認沒有 caret 出現在「更新定義」按鈕上

- [ ] **Step 5：底部欄 ≥ 3 輪**

1. 達到 3 輪後：「更新定義」按鈕出現 ▲ caret
2. 點「更新定義」→ def-panel 展開，textarea 自動 focus，caret 變 ▼，按鈕變 active 樣式
3. textarea 與「提交定義」在同一列
4. 再點「更新定義」→ def-panel 收起，caret 變 ▲

- [ ] **Step 6：提交定義 flow**

1. 開 def-panel → 填入定義 → 點「提交定義」
2. 看到 report → `localStorage.lastSessionId` 已清除
3. 重新整理 → 首頁（無「繼續練習」prompt）

---

## 預期行為總結

| 情況 | Before | After |
|------|--------|-------|
| submit 後重新整理 | 重新出現「繼續練習？」→ 重複評分 | 直接進首頁，lastSessionId 已清除 |
| done session 進入 practice | 可見提交按鈕，可重複評分 | 立即跳轉 report |
| practice navbar 下方空白 | margin-bottom: 24px 浪費空間 | margin-bottom: 0，空間還給 chat |
| < 3 輪底部欄 | disabled textarea 佔位 | 只有 toolbar + chat row |
| ≥ 3 輪底部欄 | textarea + submit 佔據固定空間 | 預設收起，點更新定義才展開 |
| 提交定義位置 | chat row 下方，不直覺 | 與 textarea 同列，在 chat row 上方 |
