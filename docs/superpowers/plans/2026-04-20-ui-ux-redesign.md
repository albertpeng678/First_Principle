# PM Drill UI/UX Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement 11 UX improvements: Phosphor icon system, default light theme, offcanvas session history, collapsible issue banner, coach hint mechanism, persistent essence textarea, fixed practice bottom bar, 4-tab report layout, RWD, and back-to-home button.

**Architecture:** All changes are in 4 files — `public/index.html`, `public/style.css`, `public/app.js`, `prompts/coach.js`. No new API endpoints or DB schema changes. Offcanvas and tab switching use pure CSS transform + vanilla JS. Coach hint is a new `【教練提示】` section in the system prompt, parsed client-side and stored in `coachReply.hint`. Essence textarea persists via `AppState.essenceDraft` captured before each re-render.

**Tech Stack:** Vanilla JS (ES modules), CSS custom properties, Phosphor Icons v2.1.1 (CDN font), Supabase Auth, OpenAI GPT-4o SSE streaming.

---

## File Map

| File | Changes |
|------|---------|
| `public/index.html` | Add Phosphor CDN, change `data-theme`, add offcanvas HTML, restructure navbar |
| `public/style.css` | Add: navbar-left, offcanvas, issue-banner, practice-bottom-bar, hint-card, tab-bar, score-bar, difficulty-grid. Rename `.difficulty-cards` → `.difficulty-grid`. Update `.btn-icon`. |
| `public/app.js` | Update AppState defaults, navigate(), renderNavbar(), renderHome(), renderPractice(), bindPractice(), sendChat(), parseCoachReply(), renderReport(), bindReport(), exportPNG(). Add: openOffcanvas(), closeOffcanvas(), loadOffcanvasSessions(), showHintCard(). |
| `prompts/coach.js` | Add `【教練提示】` to system prompt format + role instructions. Update buildMessages() to include hint in history. |

---

### Task 1: Phosphor Icons CDN + default light theme + offcanvas HTML shell

**Files:**
- Modify: `public/index.html`
- Modify: `public/app.js` (AppState line 13)

- [ ] **Step 1: Rewrite index.html**

```html
<!DOCTYPE html>
<html lang="zh-TW" data-theme="light">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>PM Drill — 第一性原理訓練器</title>
  <link rel="stylesheet" href="/style.css" />
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@phosphor-icons/web@2.1.1/src/regular/style.css">
</head>
<body>
  <div id="app">
    <nav class="navbar">
      <div class="navbar-left">
        <button class="btn-icon" id="btn-hamburger" aria-label="開啟選單"><i class="ph ph-list"></i></button>
        <span class="navbar-logo">PM Drill</span>
      </div>
      <div class="navbar-actions" id="navbar-actions"></div>
    </nav>
    <div id="offcanvas-overlay" class="offcanvas-overlay"></div>
    <div id="offcanvas" class="offcanvas" role="dialog" aria-label="練習記錄">
      <div class="offcanvas-header">
        <span style="font-weight:700">練習記錄</span>
        <button class="btn-icon" id="btn-offcanvas-close" aria-label="關閉"><i class="ph ph-x"></i></button>
      </div>
      <div id="offcanvas-list" class="offcanvas-list">載入中…</div>
    </div>
    <main id="main"></main>
  </div>
  <script type="module" src="/app.js"></script>
</body>
</html>
```

- [ ] **Step 2: Fix default theme in app.js**

Find in `public/app.js` line 13:
```javascript
  theme: localStorage.getItem('theme') || 'dark',
```
Replace with:
```javascript
  theme: localStorage.getItem('theme') || 'light',
```

- [ ] **Step 3: Verify** — Open app in browser (clear localStorage first). Confirm white background (light theme). Confirm no JS errors in console.

- [ ] **Step 4: Commit**

```bash
git add public/index.html public/app.js
git commit -m "feat: add Phosphor Icons CDN, default light theme, offcanvas HTML shell"
```

---

### Task 2: CSS — all new component styles

**Files:**
- Modify: `public/style.css`

- [ ] **Step 1: Update `.btn-icon` (line 75) and rename `.difficulty-cards` (line 145)**

Find:
```css
.btn-icon { background: transparent; border: none; cursor: pointer; font-size: 1.2rem; padding: 4px 8px; }
```
Replace with:
```css
.btn-icon { background: transparent; border: none; cursor: pointer; font-size: 1.3rem; padding: 4px 8px; color: var(--text-secondary); display: flex; align-items: center; }
.btn-icon:hover { color: var(--text-primary); }
```

Find:
```css
/* Difficulty Cards */
.difficulty-cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-top: 24px; }
```
Replace with:
```css
/* Difficulty Grid */
.difficulty-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-top: 24px; }
```

Find in the `@media (max-width: 600px)` block:
```css
  .difficulty-cards { grid-template-columns: 1fr; }
```
Replace with (remove it — auto-fit handles mobile):
```css
  .review-table { display: none; }
```

Wait — the existing media block is:
```css
@media (max-width: 600px) {
  .difficulty-cards { grid-template-columns: 1fr; }
  .score-cards { grid-template-columns: 1fr; }
  .bubble { max-width: 95%; }
}
```

Replace the entire block with:
```css
@media (max-width: 600px) {
  .score-cards { grid-template-columns: 1fr; }
  .bubble { max-width: 95%; }
  .review-table { display: none; }
  .review-cards { display: flex; flex-direction: column; }
}
@media (min-width: 601px) {
  .review-cards { display: none; }
}
```

- [ ] **Step 2: Append new CSS at end of style.css**

```css

/* ── Navbar ── */
.navbar-left { display: flex; align-items: center; gap: 8px; }

/* ── Offcanvas ── */
.offcanvas-overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.4);
  opacity: 0; pointer-events: none;
  transition: opacity 0.25s ease;
  z-index: 100;
}
.offcanvas-overlay.open { opacity: 1; pointer-events: all; }
.offcanvas {
  position: fixed; top: 0; left: 0; bottom: 0;
  width: 280px; max-width: 80vw;
  background: var(--bg-surface);
  border-right: 1px solid var(--border);
  box-shadow: 4px 0 16px rgba(0,0,0,0.2);
  transform: translateX(-100%);
  transition: transform 0.25s ease;
  z-index: 101;
  display: flex; flex-direction: column;
}
.offcanvas.open { transform: translateX(0); }
.offcanvas-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 16px; border-bottom: 1px solid var(--border); flex-shrink: 0;
}
.offcanvas-list { flex: 1; overflow-y: auto; padding: 12px; display: flex; flex-direction: column; gap: 8px; }
.offcanvas-item {
  padding: 12px; border-radius: 10px;
  background: var(--bg-surface-2); cursor: pointer;
  border: 1px solid var(--border);
}
.offcanvas-item:hover { border-color: var(--accent); }

/* ── Badges ── */
.badge { display: inline-block; padding: 2px 8px; border-radius: 20px; font-size: 0.75rem; font-weight: 600; }
.badge-blue { background: rgba(108,99,255,0.15); color: var(--accent); }
.badge-green { background: rgba(76,175,125,0.15); color: var(--success); }

/* ── Practice Layout ── */
.issue-banner {
  background: var(--bg-surface);
  border-left: 3px solid var(--accent);
  border-bottom: 1px solid var(--border);
  padding: 10px 16px;
  margin: 0 -16px;
}
.issue-banner-header {
  display: flex; justify-content: space-between; align-items: center;
  cursor: pointer; user-select: none;
}
.issue-banner-header h4 { font-size: 0.8rem; color: var(--text-secondary); font-weight: 600; margin: 0; }
.issue-banner-body { margin-top: 8px; font-size: 0.9rem; line-height: 1.5; }
.issue-banner.collapsed .issue-banner-body { display: none; }
.issue-banner-summary {
  font-size: 0.82rem; color: var(--text-secondary);
  display: none; white-space: nowrap; overflow: hidden;
  text-overflow: ellipsis; max-width: 55%;
}
.issue-banner.collapsed .issue-banner-summary { display: block; }

.chat-scroll { display: flex; flex-direction: column; gap: 12px; padding: 16px 0; min-height: 200px; }

.hint-card {
  background: #fffbe6; border-left: 3px solid #f0a04b;
  border-radius: 8px; padding: 10px 14px;
  color: #7a5c1a; font-size: 0.9rem;
  display: flex; align-items: flex-start; gap: 8px;
}
[data-theme="dark"] .hint-card { background: rgba(240,160,75,0.1); color: var(--warning); }

.practice-bottom-bar {
  position: sticky; bottom: 0;
  background: var(--bg-surface);
  border-top: 1px solid var(--border);
  padding: 10px 16px;
  padding-bottom: max(10px, env(safe-area-inset-bottom));
  margin: 0 -16px;
  display: flex; flex-direction: column; gap: 8px;
}
.bottom-toolbar { display: flex; gap: 8px; flex-wrap: wrap; }
.btn-tool {
  padding: 6px 12px; border-radius: 8px; border: 1px solid var(--border);
  background: var(--bg-surface-2); color: var(--text-secondary);
  cursor: pointer; font-size: 0.85rem; display: flex; align-items: center; gap: 6px;
  transition: border-color 0.15s, color 0.15s;
}
.btn-tool:hover { border-color: var(--accent); color: var(--accent); }
.essence-label { font-size: 0.78rem; color: var(--text-secondary); }
.essence-textarea {
  width: 100%; padding: 8px 12px;
  border-radius: 8px; border: 1px solid var(--border);
  background: var(--bg-surface-2); color: var(--text-primary);
  font-size: 0.9rem; resize: none; font-family: inherit;
}
.essence-textarea:focus { outline: none; border-color: var(--accent); }
.essence-textarea:disabled { opacity: 0.5; cursor: not-allowed; }
.chat-send-row { display: flex; gap: 8px; }

/* ── Report Layout ── */
.score-summary-bar {
  padding: 12px 16px;
  background: var(--bg-surface);
  border-bottom: 1px solid var(--border);
  display: flex; align-items: center; gap: 16px;
}
.score-big { font-size: 2.2rem; font-weight: 900; color: var(--accent); line-height: 1; }
.score-meta { font-size: 0.8rem; color: var(--text-secondary); margin-top: 2px; }
.score-progress { flex: 1; height: 8px; background: var(--bg-surface-2); border-radius: 4px; overflow: hidden; }
.score-progress-fill { height: 100%; background: var(--accent); border-radius: 4px; }
.tab-bar { display: flex; border-bottom: 1px solid var(--border); background: var(--bg-surface); }
.tab-btn {
  flex: 1; padding: 10px 4px; border: none; background: none;
  color: var(--text-secondary); cursor: pointer; font-size: 0.85rem;
  border-bottom: 2px solid transparent; transition: color 0.15s;
  white-space: nowrap;
}
.tab-btn.active { color: var(--accent); border-bottom-color: var(--accent); font-weight: 600; }
.tab-content { padding: 16px; }
.tab-pane { display: none; }
.tab-pane.active { display: block; }

/* Score Bars */
.score-bar-row { margin-bottom: 14px; }
.score-bar-label { display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 5px; }
.score-bar-track { height: 8px; background: var(--bg-surface-2); border-radius: 4px; overflow: hidden; }
.score-bar-fill { height: 100%; background: var(--accent); border-radius: 4px; transition: width 0.6s ease; }

/* Score Detail Cards */
.score-detail-card { background: var(--bg-surface-2); border-radius: 10px; padding: 12px 14px; margin-bottom: 10px; }
.score-detail-row { display: flex; align-items: flex-start; gap: 8px; font-size: 0.85rem; margin-top: 6px; color: var(--text-secondary); }
.score-detail-row i { margin-top: 2px; flex-shrink: 0; }

/* Review Cards (mobile) */
.review-card { background: var(--bg-surface-2); border-radius: 10px; padding: 14px; margin-bottom: 12px; }
.review-card-round { font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 8px; font-weight: 600; }
.review-card-section { margin-top: 8px; font-size: 0.875rem; }
.review-card-section-label { font-size: 0.75rem; color: var(--accent); font-weight: 600; margin-bottom: 3px; }

/* Tab label responsive */
@media (max-width: 480px) {
  .tab-label-full { display: none; }
  .tab-label-short { display: inline; }
}
@media (min-width: 481px) {
  .tab-label-full { display: inline; }
  .tab-label-short { display: none; }
}

/* Highlight Cards */
.highlight-card {
  background: var(--bg-surface-2); border-radius: 10px;
  padding: 16px; margin-bottom: 12px;
  display: flex; align-items: flex-start; gap: 12px;
}
.highlight-icon { font-size: 1.4rem; flex-shrink: 0; margin-top: 2px; }
.highlight-icon.trophy { color: #f0a04b; }
.highlight-icon.warning-icon { color: var(--danger); }
.highlight-summary {
  background: var(--bg-surface-2); border-radius: 10px; padding: 16px;
  font-style: italic; color: var(--text-secondary); border-left: 3px solid var(--accent);
}

/* Export Tab */
.export-tab-actions { display: flex; flex-direction: column; gap: 12px; max-width: 300px; margin: 24px auto 0; }
.export-tab-actions .btn { display: flex; align-items: center; justify-content: center; gap: 8px; }
.export-hint { font-size: 0.8rem; color: var(--text-secondary); text-align: center; margin: 4px 0; }

/* Difficulty Card Icon */
.difficulty-icon { font-size: 1.6rem; margin-bottom: 8px; color: var(--accent); display: flex; justify-content: center; }
```

- [ ] **Step 3: Verify CSS parses** — open app, check no CSS errors in browser DevTools console.

- [ ] **Step 4: Commit**

```bash
git add public/style.css
git commit -m "feat: add CSS for offcanvas, practice layout, report tabs, RWD, difficulty grid"
```

---

### Task 3: Backend — coach hint section

**Files:**
- Modify: `prompts/coach.js`

- [ ] **Step 1: Update buildSystemPrompt — add 【教練提示】 format and role**

Find the return template string in `buildSystemPrompt`. The current format section (lines 10-17):
```javascript
你在這個對話中同時扮演兩個角色，每次回覆格式固定如下：

【被訪談者】
（你的回答）

【教練點評】
（你的點評）

---
```

Replace with:
```javascript
你在這個對話中同時扮演三個角色，每次回覆格式固定如下：

【被訪談者】
（你的回答）

【教練點評】
（你的點評）

【教練提示】
（你的提示）

---
```

Find the "角色 B（教練）" block (lines 28-31):
```javascript
角色 B（教練）：
- 點評這一輪追問的品質
- 指出：問到了什麼層次、還缺什麼、可以往哪個方向問
- 最多 2-3 句，簡短
```

Replace with:
```javascript
角色 B（教練）：
- 點評這一輪追問的品質
- 指出：問到了什麼層次、還缺什麼、可以往哪個方向問
- 最多 2-3 句，簡短

角色 C（提示）：
- 【教練提示】每次必填，一句話
- 引導學員下一輪可以從哪個方向探索，不直接給答案
- 例：「試著問問看他在做這件事之前，通常用什麼方法？」
```

- [ ] **Step 2: Update buildMessages to include hint in assistant history**

Find the `buildMessages` function (lines 41-53):
```javascript
function buildMessages(session, newMessage) {
  const history = session.conversation.slice(-8);
  return [
    ...history.flatMap(t => [
      { role: 'user', content: t.userMessage },
      {
        role: 'assistant',
        content: `【被訪談者】\n${t.coachReply?.interviewee || ''}\n\n【教練點評】\n${t.coachReply?.coaching || ''}`
      }
    ]),
    { role: 'user', content: newMessage }
  ];
}
```

Replace with:
```javascript
function buildMessages(session, newMessage) {
  const history = session.conversation.slice(-8);
  return [
    ...history.flatMap(t => [
      { role: 'user', content: t.userMessage },
      {
        role: 'assistant',
        content: `【被訪談者】\n${t.coachReply?.interviewee || ''}\n\n【教練點評】\n${t.coachReply?.coaching || ''}\n\n【教練提示】\n${t.coachReply?.hint || ''}`
      }
    ]),
    { role: 'user', content: newMessage }
  ];
}
```

- [ ] **Step 3: Commit**

```bash
git add prompts/coach.js
git commit -m "feat: add coach hint section to system prompt and message history"
```

---

### Task 4: Navbar — hamburger, Phosphor icons, offcanvas functions

**Files:**
- Modify: `public/app.js`

- [ ] **Step 1: Update navigate() to set body data-view**

Find:
```javascript
function navigate(view) {
  AppState.view = view;
  render();
}
```

Replace with:
```javascript
function navigate(view) {
  AppState.view = view;
  document.body.dataset.view = view;
  render();
}
```

- [ ] **Step 2: Replace renderNavbar()**

Find (lines 102-121):
```javascript
function renderNavbar() {
  const el = document.getElementById('navbar-actions');
  const themeIcon = AppState.theme === 'dark' ? '☀️' : '🌙';
  if (AppState.mode === 'auth') {
    el.innerHTML = `
      <span style="color:var(--text-secondary);font-size:0.85rem">${AppState.user?.email}</span>
      <button class="btn btn-ghost" onclick="navigate('history')">歷史記錄</button>
      <button class="btn btn-ghost" id="btn-logout">登出</button>
      <button class="btn-icon" onclick="applyTheme(AppState.theme==='dark'?'light':'dark')">${themeIcon}</button>
    `;
    document.getElementById('btn-logout')?.addEventListener('click', () => supabase.auth.signOut());
  } else if (AppState.mode === 'guest') {
    el.innerHTML = `
      <button class="btn btn-ghost" onclick="navigate('login')">登入</button>
      <button class="btn-icon" onclick="applyTheme(AppState.theme==='dark'?'light':'dark')">${themeIcon}</button>
    `;
  } else {
    el.innerHTML = '';
  }
}
```

Replace with:
```javascript
function renderNavbar() {
  const el = document.getElementById('navbar-actions');
  const themeIcon = AppState.theme === 'dark'
    ? '<i class="ph ph-sun"></i>'
    : '<i class="ph ph-moon"></i>';
  const homeBtn = AppState.view === 'report'
    ? `<button class="btn-icon" title="返回首頁" onclick="navigate('home')"><i class="ph ph-house"></i></button>`
    : '';

  if (AppState.mode === 'auth') {
    el.innerHTML = `
      ${homeBtn}
      <span style="color:var(--text-secondary);font-size:0.85rem">${AppState.user?.email}</span>
      <button class="btn btn-ghost" id="btn-logout">登出</button>
      <button class="btn-icon" title="切換主題" onclick="applyTheme(AppState.theme==='dark'?'light':'dark')">${themeIcon}</button>
    `;
    document.getElementById('btn-logout')?.addEventListener('click', () => supabase.auth.signOut());
  } else if (AppState.mode === 'guest') {
    el.innerHTML = `
      ${homeBtn}
      <button class="btn btn-ghost" onclick="navigate('login')">登入</button>
      <button class="btn-icon" title="切換主題" onclick="applyTheme(AppState.theme==='dark'?'light':'dark')">${themeIcon}</button>
    `;
  } else {
    el.innerHTML = '';
  }

  document.getElementById('btn-hamburger')?.addEventListener('click', openOffcanvas);
}
```

- [ ] **Step 3: Add offcanvas functions after renderNavbar()**

Insert after the closing `}` of `renderNavbar()`:

```javascript
function openOffcanvas() {
  document.getElementById('offcanvas').classList.add('open');
  document.getElementById('offcanvas-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
  loadOffcanvasSessions();
  document.getElementById('btn-offcanvas-close')?.addEventListener('click', closeOffcanvas, { once: true });
  document.getElementById('offcanvas-overlay')?.addEventListener('click', closeOffcanvas, { once: true });
}

function closeOffcanvas() {
  document.getElementById('offcanvas').classList.remove('open');
  document.getElementById('offcanvas-overlay').classList.remove('open');
  document.body.style.overflow = '';
}

async function loadOffcanvasSessions() {
  const listEl = document.getElementById('offcanvas-list');
  listEl.innerHTML = '載入中…';
  try {
    const res = await fetch(sessionRoute(), { headers: apiHeaders() });
    if (!res.ok) throw new Error('failed');
    const sessions = await res.json();
    if (!sessions.length) {
      listEl.innerHTML = '<p style="color:var(--text-secondary);padding:8px 0">還沒有練習記錄</p>';
      return;
    }
    listEl.innerHTML = sessions.map(s => {
      const date = new Date(s.created_at).toLocaleString('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      const badge = s.status === 'in_progress'
        ? `<span class="badge badge-blue">進行中</span>`
        : `<span class="badge badge-green">${s.scores_json?.totalScore ?? '—'}分</span>`;
      return `<div class="offcanvas-item" data-id="${s.id}" data-status="${s.status}">
        <div style="display:flex;align-items:center;justify-content:space-between">
          ${badge}<span style="font-size:0.75rem;color:var(--text-secondary)">${s.difficulty || ''}</span>
        </div>
        <div style="font-size:0.8rem;color:var(--text-secondary);margin-top:4px">${date}</div>
      </div>`;
    }).join('');

    listEl.querySelectorAll('.offcanvas-item').forEach(item => {
      item.addEventListener('click', async () => {
        closeOffcanvas();
        const id = item.dataset.id;
        const status = item.dataset.status;
        if (AppState.currentSession?.id === id) {
          navigate(status === 'completed' ? 'report' : 'practice');
          return;
        }
        const r = await fetch(sessionRoute(`/${id}`), { headers: apiHeaders() });
        const session = await r.json();
        AppState.currentSession = session;
        navigate(status === 'completed' ? 'report' : 'practice');
      });
    });
  } catch (_) {
    listEl.innerHTML = '<p style="color:var(--text-secondary);padding:8px 0">載入失敗</p>';
  }
}
```

- [ ] **Step 4: Verify** — Click hamburger → offcanvas slides in from left. Session list loads. Click overlay or X → closes.

- [ ] **Step 5: Commit**

```bash
git add public/app.js
git commit -m "feat: navbar with hamburger, Phosphor theme toggle, report home button, offcanvas"
```

---

### Task 5: AppState additions + parseCoachReply + sendChat fix

**Files:**
- Modify: `public/app.js`

- [ ] **Step 1: Add essenceDraft and activeReportTab to AppState**

Find (after Task 1 change, theme is now 'light'):
```javascript
const AppState = {
  mode: 'loading',
  accessToken: null,
  guestId: null,
  user: null,
  currentSession: null,
  isStreaming: false,
  theme: localStorage.getItem('theme') || 'light',
  view: 'home',
};
```

Replace with:
```javascript
const AppState = {
  mode: 'loading',
  accessToken: null,
  guestId: null,
  user: null,
  currentSession: null,
  isStreaming: false,
  theme: localStorage.getItem('theme') || 'light',
  view: 'home',
  essenceDraft: '',
  activeReportTab: 'overview',
};
```

- [ ] **Step 2: Update parseCoachReply to extract hint**

Find:
```javascript
function parseCoachReply(fullText) {
  const intervieweeMatch = fullText.match(/【被訪談者】\s*([\s\S]*?)(?=【教練點評】|$)/);
  const coachingMatch = fullText.match(/【教練點評】\s*([\s\S]*?)$/);
  return {
    interviewee: intervieweeMatch?.[1]?.trim() || fullText,
    coaching: coachingMatch?.[1]?.trim() || '',
  };
}
```

Replace with:
```javascript
function parseCoachReply(fullText) {
  const intervieweeMatch = fullText.match(/【被訪談者】\s*([\s\S]*?)(?=【教練點評】|$)/);
  const coachingMatch = fullText.match(/【教練點評】\s*([\s\S]*?)(?=【教練提示】|$)/);
  const hintMatch = fullText.match(/【教練提示】\s*([\s\S]*?)$/);
  return {
    interviewee: intervieweeMatch?.[1]?.trim() || fullText,
    coaching: coachingMatch?.[1]?.trim() || '',
    hint: hintMatch?.[1]?.trim() || '',
  };
}
```

- [ ] **Step 3: Fix sendChat to save essenceDraft before re-render**

Find in `sendChat()`:
```javascript
  AppState.isStreaming = true;
  AppState.currentSession.conversation.push({ userMessage: message, coachReply: null });
  render();
```

Replace with:
```javascript
  AppState.isStreaming = true;
  AppState.essenceDraft = document.getElementById('final-def')?.value ?? AppState.essenceDraft;
  AppState.currentSession.conversation.push({ userMessage: message, coachReply: null });
  render();
```

- [ ] **Step 4: Commit**

```bash
git add public/app.js
git commit -m "feat: AppState essenceDraft/activeReportTab, hint parsing, preserve essence on send"
```

---

### Task 6: Practice View — full layout restructure

**Files:**
- Modify: `public/app.js`

- [ ] **Step 1: Replace renderPractice()**

Find the entire `renderPractice()` function (lines 296-326):
```javascript
function renderPractice() {
  const s = AppState.currentSession;
  if (!s) return '<p>沒有進行中的練習</p>';

  const bubbles = s.conversation.map(t => `
    <div class="bubble bubble-user">${escHtml(t.userMessage)}</div>
    <div class="bubble bubble-ai">${formatCoachReply(t.coachReply)}</div>
  `).join('');

  const submitSection = s.current_phase === 'submit' || s.turn_count >= 3 ? `
    <div class="card" style="margin-top:16px">
      <p style="font-weight:600;margin-bottom:8px">提交你的問題定義</p>
      <textarea id="final-def" class="chat-input" rows="3" style="width:100%" placeholder="用一句中性問句描述這個問題的本質…"></textarea>
      <button class="btn btn-primary" style="margin-top:8px" id="btn-submit">提交定義</button>
    </div>
  ` : '';

  return `
    ${renderSteps(s.current_phase)}
    <div class="card" style="margin-bottom:16px">
      <p style="font-size:0.8rem;color:var(--text-secondary)">${s.issue_json?.source || ''}</p>
      <p style="margin-top:6px;font-weight:500">${escHtml(s.issue_json?.issueText || '')}</p>
    </div>
    <div class="chat-area" id="chat-area">${bubbles}</div>
    <div class="chat-input-area">
      <textarea id="chat-input" class="chat-input" rows="2" placeholder="輸入你的問題或觀察…" ${AppState.isStreaming ? 'disabled' : ''}></textarea>
      <button class="btn btn-primary" id="btn-send" ${AppState.isStreaming ? 'disabled' : ''}>送出</button>
    </div>
    ${submitSection}
  `;
}
```

Replace with:
```javascript
function renderPractice() {
  const s = AppState.currentSession;
  if (!s) return '<p style="padding:16px">沒有進行中的練習</p>';

  const turnCount = s.turn_count || 0;
  const progressPct = Math.min(100, Math.round((turnCount / 7) * 100));
  const showSubmit = s.current_phase === 'submit' || turnCount >= 3;

  const bubbles = s.conversation.map(t => `
    <div class="bubble bubble-user">${escHtml(t.userMessage)}</div>
    <div class="bubble bubble-ai">${formatCoachReply(t.coachReply)}</div>
  `).join('');

  const issueSummary = escHtml((s.issue_json?.issueText || '').slice(0, 55)) + '…';

  return `
    <div style="height:4px;background:var(--bg-surface-2);margin:0 -16px">
      <div style="height:100%;width:${progressPct}%;background:var(--accent);transition:width 0.3s"></div>
    </div>
    <div class="issue-banner" id="issue-banner">
      <div class="issue-banner-header" id="issue-banner-header">
        <h4><span class="badge badge-blue" style="margin-right:6px">${escHtml(s.issue_json?.source || '')}</span>抱怨內容</h4>
        <div style="display:flex;align-items:center;gap:8px">
          <span class="issue-banner-summary">${issueSummary}</span>
          <i class="ph ph-caret-up" id="issue-caret" style="font-size:1rem;color:var(--text-secondary)"></i>
        </div>
      </div>
      <div class="issue-banner-body">${escHtml(s.issue_json?.issueText || '')}</div>
    </div>
    <div class="chat-scroll" id="chat-area">${bubbles}</div>
    <div class="practice-bottom-bar">
      <div class="bottom-toolbar">
        <button class="btn-tool" id="btn-hint"><i class="ph ph-lightbulb"></i> 本輪提示</button>
        <button class="btn-tool" id="btn-update-def"><i class="ph ph-note-pencil"></i> 更新定義</button>
      </div>
      <label class="essence-label" for="final-def">問題本質定義（提交前可隨時更新）</label>
      <textarea id="final-def" class="essence-textarea" rows="2"
        placeholder="用中性問句描述問題本質…&#10;例：如何讓 [角色] 在 [情境] 下更有效率達成 [目標]？"
        ${!showSubmit ? 'disabled' : ''}></textarea>
      <div class="chat-send-row">
        <textarea id="chat-input" class="chat-input" style="flex:1" rows="2"
          placeholder="輸入你的問題或觀察…"
          ${AppState.isStreaming ? 'disabled' : ''}></textarea>
        <button class="btn btn-primary" id="btn-send" ${AppState.isStreaming ? 'disabled' : ''}>送出</button>
      </div>
      ${showSubmit ? '<button class="btn btn-primary" style="align-self:flex-start" id="btn-submit">提交定義</button>' : ''}
    </div>
  `;
}
```

- [ ] **Step 2: Replace bindPractice()**

Find:
```javascript
function bindPractice() {
  document.getElementById('btn-send')?.addEventListener('click', sendChat);
  document.getElementById('chat-input')?.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); }
  });
  document.getElementById('btn-submit')?.addEventListener('click', submitDefinition);
  scrollChatToBottom();
}
```

Replace with:
```javascript
function bindPractice() {
  const finalDefEl = document.getElementById('final-def');
  if (finalDefEl) {
    finalDefEl.value = AppState.essenceDraft;
    finalDefEl.addEventListener('input', e => { AppState.essenceDraft = e.target.value; });
  }

  document.getElementById('btn-send')?.addEventListener('click', sendChat);
  document.getElementById('chat-input')?.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); }
  });
  document.getElementById('btn-submit')?.addEventListener('click', submitDefinition);

  document.getElementById('issue-banner-header')?.addEventListener('click', () => {
    const banner = document.getElementById('issue-banner');
    const caret = document.getElementById('issue-caret');
    const collapsed = banner.classList.toggle('collapsed');
    caret.className = collapsed ? 'ph ph-caret-down' : 'ph ph-caret-up';
  });

  document.getElementById('btn-hint')?.addEventListener('click', showHintCard);
  document.getElementById('btn-update-def')?.addEventListener('click', () => {
    document.getElementById('final-def')?.focus();
  });

  scrollChatToBottom();
}

function showHintCard() {
  const conv = AppState.currentSession?.conversation || [];
  const lastHint = conv[conv.length - 1]?.coachReply?.hint;
  const hint = lastHint || '請先進行至少一輪對話，再查看本輪提示。';

  const chatArea = document.getElementById('chat-area');
  if (!chatArea) return;
  chatArea.querySelector('.hint-card')?.remove();

  const card = document.createElement('div');
  card.className = 'hint-card';
  card.innerHTML = `<i class="ph ph-lightbulb" style="margin-top:2px;flex-shrink:0;color:#f0a04b"></i><span>${escHtml(hint)}</span>`;
  chatArea.appendChild(card);
  card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
```

- [ ] **Step 3: Update scrollChatToBottom** — it already uses `getElementById('chat-area')` so no change needed. Verify it still works (chat-scroll div has id="chat-area").

- [ ] **Step 4: Manual test** — Start a practice session:
  - Issue banner shows, caret toggles collapse/expand
  - Essence textarea is disabled until turn 3, then enables
  - Type in essence textarea, send a message → textarea keeps its value
  - After 1 turn, click hint → hint card appears (or first-turn message)
  - Progress bar increases with each turn
  - Bottom bar stays sticky when scrolling chat

- [ ] **Step 5: Commit**

```bash
git add public/app.js
git commit -m "feat: practice view — collapsible issue banner, hint card, persistent essence textarea"
```

---

### Task 7: Report View — 4-tab layout

**Files:**
- Modify: `public/app.js`

- [ ] **Step 1: Replace renderReport()**

Find the entire `renderReport()` function (lines 491-559). Replace with:

```javascript
function renderReport() {
  const s = AppState.currentSession;
  const scores = s?.scores_json;
  if (!scores) return '<p style="padding:16px">沒有評分資料</p>';

  const dims = Object.keys(DIM_LABELS);
  const totalScore = scores.totalScore || 0;
  const turnCount = s.conversation?.length || s.turn_count || 0;
  const source = s.issue_json?.source || '';

  const scoreBars = dims.map(d => {
    const sc = scores.scores[d]?.score || 0;
    return `<div class="score-bar-row">
      <div class="score-bar-label">
        <span>${DIM_LABELS[d]}</span>
        <span style="color:${sc >= 14 ? 'var(--success)' : 'var(--warning)'}">${sc}/20</span>
      </div>
      <div class="score-bar-track"><div class="score-bar-fill" style="width:${sc / 20 * 100}%"></div></div>
    </div>`;
  }).join('');

  const scoreDetails = dims.map(d => `
    <div class="score-detail-card">
      <div style="font-weight:700;font-size:0.9rem;color:var(--accent)">${DIM_LABELS[d]}</div>
      <div class="score-detail-row"><i class="ph ph-check-circle" style="color:var(--success)"></i><span>${escHtml(scores.scores[d]?.did || '')}</span></div>
      <div class="score-detail-row"><i class="ph ph-x-circle" style="color:var(--danger)"></i><span>${escHtml(scores.scores[d]?.missed || '')}</span></div>
      <div class="score-detail-row"><i class="ph ph-lightbulb" style="color:var(--accent)"></i><span>${escHtml(scores.scores[d]?.tip || '')}</span></div>
    </div>
  `).join('');

  const turnAnalysis = scores.turnAnalysis || [];
  const reviewRows = s.conversation.map((t, i) => `
    <tr>
      <td style="white-space:nowrap;color:var(--text-secondary)">第 ${i+1} 輪</td>
      <td>${escHtml(t.userMessage)}</td>
      <td style="color:var(--accent)">${escHtml(turnAnalysis[i]?.idealFocus || '—')}</td>
      <td>${escHtml(t.coachReply?.interviewee || '')}</td>
      <td style="color:var(--text-secondary)">${escHtml(t.coachReply?.coaching || '')}</td>
    </tr>
  `).join('');

  const reviewCards = s.conversation.map((t, i) => `
    <div class="review-card">
      <div class="review-card-round">第 ${i+1} 輪</div>
      <div class="review-card-section"><div class="review-card-section-label">學員提問</div>${escHtml(t.userMessage)}</div>
      <div class="review-card-section"><div class="review-card-section-label">預期重點</div>${escHtml(turnAnalysis[i]?.idealFocus || '—')}</div>
      <div class="review-card-section"><div class="review-card-section-label">被訪談者</div>${escHtml(t.coachReply?.interviewee || '')}</div>
      <div class="review-card-section"><div class="review-card-section-label">教練點評</div>${escHtml(t.coachReply?.coaching || '')}</div>
    </div>
  `).join('');

  const highlights = scores.highlights || {};
  const tab = AppState.activeReportTab;
  const tabs = [
    { id: 'overview',    label: '評分總覽', short: '總覽' },
    { id: 'review',      label: '練習回顧', short: '回顧' },
    { id: 'highlights',  label: '亮點摘要', short: '亮點' },
    { id: 'export',      label: '匯出',     short: '匯出' },
  ];

  return `
    <div class="score-summary-bar">
      <div>
        <div class="score-big">${totalScore}</div>
        <div class="score-meta">${escHtml(source)} · ${turnCount} 輪</div>
      </div>
      <div class="score-progress">
        <div class="score-progress-fill" style="width:${totalScore}%"></div>
      </div>
    </div>
    <div class="tab-bar">
      ${tabs.map(t => `
        <button class="tab-btn ${tab === t.id ? 'active' : ''}" data-tab="${t.id}">
          <span class="tab-label-full">${t.label}</span>
          <span class="tab-label-short">${t.short}</span>
        </button>
      `).join('')}
    </div>
    <div class="tab-content" id="report-content">
      <div class="tab-pane ${tab === 'overview' ? 'active' : ''}" id="tab-overview">
        <div class="radar-container">${renderRadar(scores.scores)}</div>
        ${scoreBars}
        ${scoreDetails}
      </div>
      <div class="tab-pane ${tab === 'review' ? 'active' : ''}" id="tab-review">
        <div class="review-cards">${reviewCards}</div>
        <div style="overflow-x:auto">
          <table class="review-table">
            <thead><tr><th>輪次</th><th>學員提問</th><th>本輪預期重點</th><th>被訪談者回答</th><th>教練點評</th></tr></thead>
            <tbody>${reviewRows}</tbody>
          </table>
        </div>
      </div>
      <div class="tab-pane ${tab === 'highlights' ? 'active' : ''}" id="tab-highlights">
        <div class="highlight-card">
          <i class="ph ph-trophy highlight-icon trophy"></i>
          <div><div style="font-weight:700;margin-bottom:4px">最佳亮點</div>${escHtml(highlights.bestMove || '')}</div>
        </div>
        <div class="highlight-card">
          <i class="ph ph-warning highlight-icon warning-icon"></i>
          <div><div style="font-weight:700;margin-bottom:4px">主要陷阱</div>${escHtml(highlights.mainTrap || '')}</div>
        </div>
        <div class="highlight-summary">${escHtml(highlights.summary || '')}</div>
      </div>
      <div class="tab-pane ${tab === 'export' ? 'active' : ''}" id="tab-export">
        <div class="export-tab-actions">
          <button class="btn btn-ghost" id="btn-export-pdf"><i class="ph ph-file-pdf"></i> 匯出 PDF</button>
          <button class="btn btn-ghost" id="btn-export-png"><i class="ph ph-image"></i> 匯出 PNG</button>
          <p class="export-hint">PDF 使用瀏覽器列印；PNG 截取報告畫面</p>
          <button class="btn btn-primary" onclick="navigate('home')">再練一次</button>
        </div>
      </div>
    </div>
  `;
}
```

- [ ] **Step 2: Replace bindReport()**

Find:
```javascript
function bindReport() {
  document.getElementById('btn-export-pdf')?.addEventListener('click', exportPDF);
  document.getElementById('btn-export-png')?.addEventListener('click', exportPNG);
}
```

Replace with:
```javascript
function bindReport() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      AppState.activeReportTab = btn.dataset.tab;
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`tab-${btn.dataset.tab}`)?.classList.add('active');
    });
  });
  document.getElementById('btn-export-pdf')?.addEventListener('click', exportPDF);
  document.getElementById('btn-export-png')?.addEventListener('click', exportPNG);
}
```

- [ ] **Step 3: Fix exportPNG button label (line ~588)**

Find:
```javascript
  btn.textContent = '🖼️ 匯出 PNG';
```

Replace with:
```javascript
  btn.innerHTML = '<i class="ph ph-image"></i> 匯出 PNG';
```

- [ ] **Step 4: Verify** — Navigate to a completed session's report:
  - Score bar and progress bar visible at top
  - 4 tabs render and switch
  - Mobile (<480px): tabs show short labels
  - Highlights tab: trophy and warning icons
  - Export tab: PDF/PNG buttons + re-practice
  - Navbar home icon (ph-house) navigates to home

- [ ] **Step 5: Commit**

```bash
git add public/app.js
git commit -m "feat: report view 4-tab layout with Phosphor icons and score summary bar"
```

---

### Task 8: Home View + Steps + global wiring

**Files:**
- Modify: `public/app.js`

- [ ] **Step 1: Replace renderHome()**

Find the entire `renderHome()` function (lines 167-193):
```javascript
function renderHome() {
  const issuePreview = AppState.currentSession
    ? `<div class="card" style="margin-bottom:16px">
        <p style="color:var(--text-secondary);font-size:0.85rem">上次練習</p>
        <p style="margin-top:6px">${AppState.currentSession.issue_json?.issueText?.slice(0, 80)}...</p>
        <button class="btn btn-primary" style="margin-top:12px" id="btn-continue">繼續練習</button>
      </div>` : '';

  return `
    <div style="text-align:center;padding:40px 0 24px">
      <h1 style="font-size:1.8rem;font-weight:800;margin-bottom:8px">第一性原理拆解訓練</h1>
      <p style="color:var(--text-secondary)">選擇難度，開始一輪 PM 思維練習</p>
    </div>
    ${issuePreview}
    <div class="difficulty-cards">
      ${['入門','進階','困難'].map(d => `
        <div class="difficulty-card" data-difficulty="${d}">
          <div style="font-size:2rem;margin-bottom:8px">${d==='入門'?'🌱':d==='進階'?'🔥':'⚡'}</div>
          <div style="font-weight:700;font-size:1.1rem">${d}</div>
          <div style="color:var(--text-secondary);font-size:0.8rem;margin-top:6px">
            ${d==='入門'?'單一角色，問題明顯':d==='進階'?'多角色交錯，需多層追問':'表象與本質落差大'}
          </div>
        </div>
      `).join('')}
    </div>
  `;
}
```

Replace with:
```javascript
function renderHome() {
  const DIFFICULTY_ICONS = { '入門': 'ph-leaf', '進階': 'ph-flame', '困難': 'ph-lightning' };
  const DIFFICULTY_DESC = {
    '入門': '單一角色，問題明顯',
    '進階': '多角色交錯，需多層追問',
    '困難': '表象與本質落差大',
  };

  const issuePreview = AppState.currentSession
    ? `<div class="card" style="margin-bottom:16px">
        <p style="color:var(--text-secondary);font-size:0.85rem">上次練習</p>
        <p style="margin-top:6px">${escHtml(AppState.currentSession.issue_json?.issueText?.slice(0, 80))}…</p>
        <button class="btn btn-primary" style="margin-top:12px" id="btn-continue">繼續練習</button>
      </div>` : '';

  return `
    <div style="text-align:center;padding:40px 0 24px">
      <h1 style="font-size:1.8rem;font-weight:800;margin-bottom:8px">第一性原理拆解訓練</h1>
      <p style="color:var(--text-secondary)">選擇難度，開始一輪 PM 思維練習</p>
    </div>
    ${issuePreview}
    <div class="difficulty-grid">
      ${['入門','進階','困難'].map(d => `
        <div class="difficulty-card" data-difficulty="${d}">
          <div class="difficulty-icon"><i class="ph ${DIFFICULTY_ICONS[d]}"></i></div>
          <div style="font-weight:700;font-size:1.1rem">${d}</div>
          <div style="color:var(--text-secondary);font-size:0.8rem;margin-top:6px">${DIFFICULTY_DESC[d]}</div>
        </div>
      `).join('')}
    </div>
  `;
}
```

- [ ] **Step 2: Update renderSteps() — replace ✓ with Phosphor check icon**

Find in `renderSteps()`:
```javascript
        <div class="step-dot">${i < idx ? '✓' : i + 1}</div>
```

Replace with:
```javascript
        <div class="step-dot">${i < idx ? '<i class="ph ph-check"></i>' : i + 1}</div>
```

- [ ] **Step 3: Expose new globals**

Find:
```javascript
// 暴露至全域，讓 HTML inline onclick 可使用
window.navigate = navigate;
window.applyTheme = applyTheme;
window.AppState = AppState;
window.submitDefinition = submitDefinition;
```

Replace with:
```javascript
// 暴露至全域，讓 HTML inline onclick 可使用
window.navigate = navigate;
window.applyTheme = applyTheme;
window.AppState = AppState;
window.submitDefinition = submitDefinition;
window.openOffcanvas = openOffcanvas;
window.closeOffcanvas = closeOffcanvas;
window.showHintCard = showHintCard;
```

- [ ] **Step 4: Set initial body data-view in init()**

Find in `init()`:
```javascript
  AppState.guestId = localStorage.getItem('guestId');
```

Add after it:
```javascript
  document.body.dataset.view = AppState.view;
```

- [ ] **Step 5: Full end-to-end test**

Run through the complete user flow:
1. Open app (clear localStorage) → light theme, Phosphor icons on difficulty cards
2. Click hamburger → offcanvas slides in, session list shows or "no sessions"
3. Click difficulty card → practice session starts
4. Verify: progress bar at 0%, issue banner expanded, essence disabled, hint shows first-turn message
5. Type a question, press Enter → sends, essence textarea preserved after re-render
6. Click hint button → hint card with lightbulb icon appears
7. Click issue banner → collapses to one-line summary
8. After 3 messages → essence textarea enables, submit button appears
9. Fill essence, click submit → navigates to report
10. Report: score bar + 4 tabs
11. Click each tab → content switches correctly
12. Navbar shows ph-house icon → click → back to home
13. Mobile (DevTools 375px): difficulty grid stacks, banner collapses cleanly, tab labels shorten

- [ ] **Step 6: Commit**

```bash
git add public/app.js
git commit -m "feat: home Phosphor icons, step check icons, expose globals, body data-view"
```
