# PM Drill — NSM Workshop + UX Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all 31 UX issues (4 CRITICAL + 10 HIGH priority) and add the NSM (North Star Metric) Workshop wizard as a new practice mode, with mandatory strict UI/UX final audit.

**Architecture:** Vanilla JS SPA — add `view: 'nsm'` + `AppState.nsmStep` (1–4) wizard; fix mobile layout using `position: fixed` bottom bar + `visualViewport` API; new Express routes + Supabase table for NSM sessions; all emoji replaced with Phosphor Icons.

**Tech Stack:** Vanilla JS, CSS custom properties, Express.js, Supabase (`@supabase/supabase-js@2`), OpenAI GPT-4o (JSON mode for evaluation), Phosphor Icons CDN

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `public/style.css` | All UX CSS fixes (touch targets, dvh, tab scroll, fixed bar, bubble, toolbar) |
| Modify | `public/app.js` | UX JS fixes + Home restructure + full NSM wizard frontend |
| Create | `prompts/nsm-evaluator.js` | GPT-4o evaluator for 5-dimension NSM scoring |
| Create | `routes/nsm-sessions.js` | Auth user NSM CRUD + evaluate endpoint |
| Create | `routes/guest-nsm-sessions.js` | Guest NSM CRUD + evaluate endpoint |
| Modify | `server.js` | Register 2 new NSM route modules |

---

## Phase 1 — CSS UX Fixes

### Task 1: Touch targets, dvh, tab scroll, bubble, toolbar

**Files:**
- Modify: `public/style.css`

- [ ] **Step 1: Fix all touch targets to ≥44px**

In `public/style.css`, find and update:
```css
/* BEFORE */
.btn-icon { padding: 4px 8px; }
.btn-tool { padding: 6px 12px; }

/* AFTER */
.btn-icon  { min-width: 44px; min-height: 44px; padding: 10px; display: inline-flex; align-items: center; justify-content: center; }
.btn-tool  { min-height: 44px; padding: 10px 14px; }
.send-btn  { width: 44px; height: 44px; }
.tab-btn   { min-height: 44px; }
.diff-card { min-height: 56px; }
```

- [ ] **Step 2: Fix iOS Safari address bar jumping (dvh) + prevent body overflow hack**

```css
/* Replace 100vh with 100dvh for all full-height views */
body[data-view="practice"] #app { height: 100dvh; }
body[data-view="nsm"]      #app { height: 100dvh; }
#app { min-height: 100dvh; }
```

- [ ] **Step 3: Fix Report Tab Bar horizontal scroll on mobile**

```css
.tab-bar {
  display: flex;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}
.tab-bar::-webkit-scrollbar { display: none; }
.tab-btn { min-width: 72px; white-space: nowrap; }
```

- [ ] **Step 4: Fix chat bubble width and toolbar wrap**

```css
/* Bubble: 95% → 88% */
.bubble { max-width: 88%; }

/* Toolbar: prevent wrap */
.bottom-toolbar { flex-wrap: nowrap; overflow: hidden; }

/* Error bubble distinct styling */
.bubble.bubble-error {
  border-left: 3px solid var(--danger, #ef4444);
  background: rgba(239,68,68,0.06);
}
```

- [ ] **Step 5: Fix multi-line textarea placeholder**

```css
/* Ensure placeholder stays on one line */
textarea::placeholder { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
```

- [ ] **Step 6: Add active/hover feedback for mobile**

```css
@media (hover: none) {
  .diff-card:active,
  .btn-icon:active,
  .btn-primary:active { opacity: 0.7; transform: scale(0.97); }
}
```

- [ ] **Step 7: Commit**

```bash
git add public/style.css
git commit -m "fix: CSS UX — touch targets ≥44px, dvh, tab scroll, bubble width, toolbar nowrap"
```

---

### Task 2: Practice bottom bar — fixed position + visualViewport keyboard fix

**Files:**
- Modify: `public/style.css`
- Modify: `public/app.js`

- [ ] **Step 1: Change .practice-bottom-bar from sticky to fixed**

In `public/style.css`:
```css
/* BEFORE */
.practice-bottom-bar { position: sticky; bottom: 0; }

/* AFTER */
.practice-bottom-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding-bottom: max(12px, env(safe-area-inset-bottom));
  z-index: 100;
  background: var(--bg-primary);
  border-top: 1px solid var(--border);
}

/* Chat area must have dynamic padding-bottom to avoid overlap */
.chat-area {
  overflow-y: auto;
  /* padding-bottom set dynamically by JS */
}
```

- [ ] **Step 2: Add visualViewport listener in bindPractice()**

In `public/app.js`, inside `bindPractice()` after the existing event listeners:
```javascript
// Adjust fixed bottom bar when mobile keyboard opens/closes
function adjustForKeyboard() {
  if (!window.visualViewport) return;
  const bar = document.querySelector('.practice-bottom-bar');
  const chatArea = document.querySelector('.chat-area');
  if (!bar) return;
  const keyboardHeight = window.innerHeight - window.visualViewport.height;
  bar.style.bottom = keyboardHeight + 'px';
  if (chatArea) chatArea.style.paddingBottom = (bar.offsetHeight + keyboardHeight) + 'px';
  if (keyboardHeight > 100) scrollChatToBottom();
}
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', adjustForKeyboard);
  adjustForKeyboard(); // init
}
```

- [ ] **Step 3: Set initial chat-area padding-bottom on render**

In `renderPractice()`, after building the HTML, ensure `.chat-area` gets initial padding. Add after the `main.innerHTML = ...` line:
```javascript
// Will be refined by adjustForKeyboard once DOM is ready
requestAnimationFrame(() => {
  const bar = document.querySelector('.practice-bottom-bar');
  const chatArea = document.querySelector('.chat-area');
  if (bar && chatArea) chatArea.style.paddingBottom = bar.offsetHeight + 'px';
});
```

- [ ] **Step 4: Commit**

```bash
git add public/style.css public/app.js
git commit -m "fix: practice bottom bar fixed position + visualViewport keyboard adjustment"
```

---

### Task 3: Def panel close button + error bubbles + empty state + Issue Banner

**Files:**
- Modify: `public/app.js`
- Modify: `public/style.css`

- [ ] **Step 1: Add max-height + close button to def panel**

In `public/style.css`:
```css
.def-panel {
  max-height: 140px;
  overflow: hidden;
  transition: max-height 0.2s ease;
}
.def-panel.open { max-height: 300px; }
.def-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}
```

In `renderPractice()` inside `public/app.js`, update the def panel HTML to add a close button in the header:
```html
<div class="def-panel-header">
  <label class="def-label">問題本質定義</label>
  <button class="btn-icon" id="btn-close-def" aria-label="關閉定義面板">
    <i class="ph ph-x"></i>
  </button>
</div>
```

- [ ] **Step 2: Bind close button in bindPractice()**

```javascript
const btnCloseDef = document.getElementById('btn-close-def');
if (btnCloseDef) {
  btnCloseDef.addEventListener('click', () => {
    const defPanel = document.querySelector('.def-panel');
    if (defPanel) defPanel.style.display = 'none';
  });
}
```

- [ ] **Step 3: Fix API error bubble styling**

In `sendChat()` (or wherever error bubbles are appended), change error message bubble:
```javascript
// BEFORE: chatArea.innerHTML += `<div class="bubble bubble-ai">連線中斷，請重試</div>`
// AFTER:
chatArea.innerHTML += `<div class="bubble bubble-ai bubble-error">
  <i class="ph ph-warning-circle"></i> 連線中斷
  <button class="btn-retry" onclick="sendChat()">重試</button>
</div>`;
```

- [ ] **Step 4: Add chat empty state guidance**

In `renderPractice()`, when `session.conversation` is empty (turn_count === 0), render a guidance card inside `.chat-area`:
```javascript
const emptyState = session.turn_count === 0
  ? `<div class="chat-empty-state">
       <i class="ph ph-chat-teardrop-text"></i>
       <p>向被訪談者提問吧！<br>試著先了解他的角色與情況。</p>
     </div>`
  : '';
```

- [ ] **Step 5: Add Issue Banner interaction hint + hover state**

In `public/style.css`:
```css
.issue-banner { cursor: pointer; transition: background 0.15s; }
.issue-banner:hover { background: var(--bg-surface-2); }
.issue-banner:active { opacity: 0.85; }
.issue-banner-hint { font-size: 11px; color: var(--text-tertiary); margin-left: auto; }
```

In the Issue Banner HTML in `renderPractice()`, add a hint span:
```html
<span class="issue-banner-hint">點擊展開 / 收合</span>
```

- [ ] **Step 6: Fix navigate() — always close offcanvas first (body overflow fix)**

At the top of `navigate(view)` in `public/app.js`:
```javascript
function navigate(view) {
  closeOffcanvas(); // always reset body overflow before navigating
  AppState.view = view;
  render();
}
```

- [ ] **Step 7: Commit**

```bash
git add public/app.js public/style.css
git commit -m "fix: def panel close btn + error bubble + chat empty state + issue banner hint + navigate overflow fix"
```

---

### Task 4: Loading states for all API calls

**Files:**
- Modify: `public/app.js`
- Modify: `public/style.css`

- [ ] **Step 1: Add loading CSS**

```css
.btn-loading { position: relative; pointer-events: none; opacity: 0.75; }
.btn-loading::after {
  content: '';
  width: 16px; height: 16px;
  border: 2px solid transparent;
  border-top-color: currentColor;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
  display: inline-block;
  margin-left: 8px;
  vertical-align: middle;
}
@keyframes spin { to { transform: rotate(360deg); } }

.card-overlay {
  position: absolute; inset: 0;
  background: rgba(255,255,255,0.6);
  border-radius: inherit;
  display: flex; align-items: center; justify-content: center;
  z-index: 10;
}
```

- [ ] **Step 2: Add loading state to difficulty card click**

In `bindHome()`, when a difficulty card is clicked:
```javascript
diffCard.addEventListener('click', async () => {
  // Add overlay spinner
  diffCard.style.position = 'relative';
  diffCard.insertAdjacentHTML('beforeend', '<div class="card-overlay"><i class="ph ph-spinner" style="animation: spin 0.7s linear infinite; font-size:24px"></i></div>');
  diffCard.style.pointerEvents = 'none';
  try {
    // existing fetch logic ...
  } finally {
    // overlay removed by navigate() → re-render
  }
});
```

- [ ] **Step 3: Add loading state to sendChat()**

In `sendChat()`:
```javascript
async function sendChat() {
  const sendBtn = document.getElementById('btn-send');
  const textarea = document.getElementById('chat-input');
  if (!sendBtn || !textarea || AppState.isStreaming) return;
  const message = textarea.value.trim();
  if (!message) return;

  // Disable UI
  AppState.isStreaming = true;
  sendBtn.classList.add('btn-loading');
  sendBtn.disabled = true;
  textarea.disabled = true;
  textarea.value = '';

  // ... existing SSE streaming logic ...

  // Re-enable on complete or error
  AppState.isStreaming = false;
  sendBtn.classList.remove('btn-loading');
  sendBtn.disabled = false;
  textarea.disabled = false;
  textarea.focus();
}
```

- [ ] **Step 4: Add loading state to submitDefinition()**

In `submitDefinition()`:
```javascript
async function submitDefinition() {
  const btn = document.getElementById('btn-submit-def');
  if (!btn || btn.disabled) return;
  btn.classList.add('btn-loading');
  btn.disabled = true;
  try {
    // existing fetch logic...
  } finally {
    btn.classList.remove('btn-loading');
    btn.disabled = false;
  }
}
```

- [ ] **Step 5: Commit**

```bash
git add public/app.js public/style.css
git commit -m "feat: add loading states — difficulty card spinner, sendChat disable, submitDefinition disable"
```

---

## Phase 2 — Home Page Restructure

### Task 5: Tab Toggle + vertical difficulty list + recent sessions (PM + NSM mixed)

**Files:**
- Modify: `public/app.js`
- Modify: `public/style.css`

- [ ] **Step 1: Add Tab Toggle CSS**

```css
.home-tab-toggle {
  display: flex;
  background: var(--bg-surface);
  border-radius: 12px;
  padding: 4px;
  margin-bottom: 20px;
  gap: 4px;
}
.home-tab-btn {
  flex: 1;
  border: none;
  background: transparent;
  border-radius: 9px;
  padding: 10px 8px;
  min-height: 44px;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.15s;
  display: flex; align-items: center; justify-content: center; gap: 6px;
}
.home-tab-btn.active {
  background: var(--bg-primary);
  color: var(--accent);
  box-shadow: 0 1px 4px rgba(0,0,0,0.1);
}
```

- [ ] **Step 2: Add vertical difficulty list CSS**

```css
.diff-list { display: flex; flex-direction: column; gap: 10px; margin-bottom: 24px; }
.diff-item {
  background: var(--bg-primary);
  border: 1.5px solid var(--border);
  border-radius: 14px;
  padding: 14px 16px;
  min-height: 56px;
  display: flex; align-items: center; gap: 12px;
  cursor: pointer; transition: all 0.15s;
}
.diff-item:active { transform: scale(0.98); }
.diff-item-icon {
  width: 40px; height: 40px;
  border-radius: 10px;
  display: flex; align-items: center; justify-content: center;
  font-size: 20px; flex-shrink: 0;
}
.diff-item-info { flex: 1; }
.diff-item-info h4 { font-size: 15px; font-weight: 600; color: var(--text-primary); margin-bottom: 2px; }
.diff-item-info p  { font-size: 12px; color: var(--text-secondary); }
.diff-arrow { color: var(--text-tertiary); }

/* NSM intro card */
.nsm-intro-card {
  background: linear-gradient(135deg, rgba(108,99,255,0.08), rgba(108,99,255,0.04));
  border: 1.5px solid rgba(108,99,255,0.25);
  border-radius: 14px;
  padding: 16px;
  margin-bottom: 16px;
}
.nsm-stats-row {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 16px;
}
.nsm-stat {
  background: var(--bg-primary);
  border: 1.5px solid var(--border);
  border-radius: 12px;
  padding: 12px 8px; text-align: center;
}
.nsm-stat .num { font-size: 20px; font-weight: 700; color: var(--accent); }
.nsm-stat .lbl { font-size: 11px; color: var(--text-secondary); margin-top: 2px; }

/* Recent sessions on home */
.home-recent-label {
  font-size: 11px; font-weight: 600; color: var(--text-secondary);
  letter-spacing: 0.8px; text-transform: uppercase; margin-bottom: 10px;
}
.home-session-item {
  background: var(--bg-primary); border: 1.5px solid var(--border);
  border-radius: 12px; padding: 12px 14px;
  display: flex; align-items: center; gap: 10px; margin-bottom: 8px;
  cursor: pointer;
}
.badge-nsm { background: #ede9fe; color: #5b21b6; }
```

- [ ] **Step 3: Rewrite renderHome() in app.js**

Replace the existing `renderHome()` function body:

```javascript
function renderHome() {
  const activeTab = AppState.homeTab || 'pm'; // 'pm' | 'nsm'
  const recentSessions = AppState.recentSessions || []; // pre-loaded mixed list (max 3)

  const pmTab = activeTab === 'pm' ? `
    <div class="section-label">選擇難度</div>
    <div class="diff-list">
      <div class="diff-item" data-difficulty="入門">
        <div class="diff-item-icon" style="background:#d1fae5"><i class="ph ph-leaf" style="color:#059669"></i></div>
        <div class="diff-item-info"><h4>入門</h4><p>消費性 App 場景</p></div>
        <i class="ph ph-caret-right diff-arrow"></i>
      </div>
      <div class="diff-item" data-difficulty="進階">
        <div class="diff-item-icon" style="background:#ffedd5"><i class="ph ph-flame" style="color:#ea580c"></i></div>
        <div class="diff-item-info"><h4>進階</h4><p>B2B / 雙邊平台</p></div>
        <i class="ph ph-caret-right diff-arrow"></i>
      </div>
      <div class="diff-item" data-difficulty="困難">
        <div class="diff-item-icon" style="background:#fee2e2"><i class="ph ph-lightning" style="color:#dc2626"></i></div>
        <div class="diff-item-info"><h4>困難</h4><p>策略 / 多方利害關係人</p></div>
        <i class="ph ph-caret-right diff-arrow"></i>
      </div>
    </div>
  ` : '';

  const nsmTab = activeTab === 'nsm' ? `
    <div class="nsm-intro-card">
      <p style="font-size:13px;color:var(--accent);line-height:1.6">
        <strong>北極星指標工作坊</strong> — 選一個真實企業情境，定義 NSM、拆解 4 個維度，獲得 AI 教練點評。
      </p>
    </div>
    <div class="nsm-stats-row">
      <div class="nsm-stat"><div class="num">24</div><div class="lbl">題庫</div></div>
      <div class="nsm-stat"><div class="num">5</div><div class="lbl">評分維度</div></div>
      <div class="nsm-stat"><div class="num">4</div><div class="lbl">步驟</div></div>
    </div>
    <button class="btn-primary" id="btn-nsm-start" style="width:100%;margin-bottom:12px">
      <i class="ph ph-shuffle"></i> 隨機抽題開始
    </button>
  ` : '';

  const recentHtml = recentSessions.length > 0 ? `
    <div class="home-recent-label">最近練習</div>
    ${recentSessions.slice(0, 3).map(s => {
      const isNSM = s.type === 'nsm';
      const badgeClass = s.status === 'completed'
        ? (isNSM ? 'badge-nsm' : 'badge-score')
        : 'badge-progress';
      const badgeText = s.status === 'completed'
        ? (s.scores_json ? Math.round(s.scores_json.totalScore ?? s.scores_json.total ?? 0) + ' 分' : '完成')
        : '進行中';
      const title = isNSM
        ? (s.question_json?.company || 'NSM 練習')
        : `${s.difficulty} · ${s.issue_json?.issueText?.slice(0, 18) || ''}…`;
      return `<div class="home-session-item" data-session-id="${s.id}" data-session-type="${isNSM ? 'nsm' : 'pm'}">
        <span class="session-badge ${badgeClass}">${badgeText}</span>
        <div class="session-info" style="flex:1;min-width:0">
          <h4 style="font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(title)}</h4>
        </div>
        <i class="ph ph-caret-right" style="color:var(--text-tertiary)"></i>
      </div>`;
    }).join('')}
  ` : '';

  return `
    <div class="home-tab-toggle">
      <button class="home-tab-btn ${activeTab === 'pm' ? 'active' : ''}" data-tab="pm">
        <i class="ph ph-microphone"></i> PM 訪談
      </button>
      <button class="home-tab-btn ${activeTab === 'nsm' ? 'active' : ''}" data-tab="nsm">
        <i class="ph ph-star"></i> 北極星指標
      </button>
    </div>
    ${pmTab}
    ${nsmTab}
    ${recentHtml}
  `;
}
```

- [ ] **Step 4: Rewrite bindHome() in app.js**

```javascript
function bindHome() {
  // Tab toggle
  document.querySelectorAll('.home-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      AppState.homeTab = btn.dataset.tab;
      const main = document.getElementById('home-content') || document.querySelector('.main-content');
      // re-render just home content area
      render();
    });
  });

  // Difficulty cards
  document.querySelectorAll('.diff-item[data-difficulty]').forEach(card => {
    card.addEventListener('click', async () => {
      const difficulty = card.dataset.difficulty;
      card.style.position = 'relative';
      card.insertAdjacentHTML('beforeend', '<div class="card-overlay"><i class="ph ph-circle-notch" style="font-size:24px;animation:spin 0.7s linear infinite"></i></div>');
      card.style.pointerEvents = 'none';
      try {
        const url = AppState.accessToken ? '/api/sessions' : '/api/guest/sessions';
        const headers = { 'Content-Type': 'application/json' };
        if (AppState.accessToken) headers['Authorization'] = `Bearer ${AppState.accessToken}`;
        const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify({ difficulty }) });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed');
        AppState.currentSession = { id: data.sessionId, difficulty, issue: data.issueText, source: data.source };
        navigate('practice');
      } catch (e) {
        card.querySelector('.card-overlay')?.remove();
        card.style.pointerEvents = '';
        alert('無法建立練習，請稍後再試：' + e.message);
      }
    });
  });

  // NSM start button
  const btnNsmStart = document.getElementById('btn-nsm-start');
  if (btnNsmStart) {
    btnNsmStart.addEventListener('click', () => {
      AppState.nsmStep = 1;
      AppState.nsmSession = null;
      AppState.nsmSelectedQuestion = null;
      navigate('nsm');
    });
  }

  // Recent session items
  document.querySelectorAll('.home-session-item[data-session-id]').forEach(item => {
    item.addEventListener('click', () => {
      const id = item.dataset.sessionId;
      const type = item.dataset.sessionType;
      if (type === 'nsm') {
        AppState.nsmStep = 4; // go to report if completed, else resume
        AppState.nsmSession = { id };
        navigate('nsm');
      } else {
        AppState.currentSession = { id };
        navigate('practice');
      }
    });
  });
}
```

- [ ] **Step 5: Add AppState.homeTab and load recentSessions on init**

In `AppState` definition at top of `app.js`, add:
```javascript
homeTab: 'pm',
recentSessions: [],
nsmStep: 1,
nsmSession: null,
nsmSelectedQuestion: null,
```

Add a helper to load mixed recent sessions after auth check:
```javascript
async function loadRecentSessions() {
  try {
    const pmUrl = AppState.accessToken ? '/api/sessions' : '/api/guest/sessions';
    const nsmUrl = AppState.accessToken ? '/api/nsm-sessions' : '/api/guest/nsm-sessions';
    const headers = {};
    if (AppState.accessToken) headers['Authorization'] = `Bearer ${AppState.accessToken}`;

    const [pmRes, nsmRes] = await Promise.all([
      fetch(pmUrl, { headers }),
      fetch(nsmUrl, { headers })
    ]);
    const pmSessions = pmRes.ok ? await pmRes.json() : [];
    const nsmSessions = nsmRes.ok ? await nsmRes.json() : [];
    const mixed = [
      ...pmSessions.map(s => ({ ...s, type: 'pm' })),
      ...nsmSessions.map(s => ({ ...s, type: 'nsm' }))
    ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    AppState.recentSessions = mixed;
  } catch { AppState.recentSessions = []; }
}
```

Call `loadRecentSessions()` inside the existing init/auth-check flow, before `render()`.

- [ ] **Step 6: Commit**

```bash
git add public/app.js public/style.css
git commit -m "feat: home page restructure — tab toggle PM/NSM, vertical diff list, recent sessions mixed"
```

---

## Phase 3 — NSM Backend

### Task 6: Database migration (manual Supabase step)

**Files:**
- Reference only — run SQL in Supabase Dashboard SQL Editor

- [ ] **Step 1: Run the following SQL in Supabase Dashboard → SQL Editor**

```sql
CREATE TABLE nsm_sessions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid REFERENCES auth.users(id),
  guest_id        text,
  question_id     text NOT NULL,
  question_json   jsonb NOT NULL,
  status          text DEFAULT 'in_progress',
  user_nsm        text,
  user_breakdown  jsonb,
  scores_json     jsonb,
  coach_tree_json jsonb,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE nsm_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_nsm_sessions" ON nsm_sessions
  FOR ALL USING (
    auth.uid() = user_id
    OR guest_id = current_setting('request.headers', true)::jsonb->>'x-guest-id'
  );
```

- [ ] **Step 2: Verify table exists in Supabase Table Editor**

Confirm `nsm_sessions` table appears with all 11 columns.

---

### Task 7: NSM Evaluator prompt

**Files:**
- Create: `prompts/nsm-evaluator.js`

- [ ] **Step 1: Create prompts/nsm-evaluator.js**

```javascript
const OpenAI = require('openai');
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function evaluateNSM({ question_json, user_nsm, user_breakdown }) {
  const company = question_json.company;
  const scenario = question_json.scenario;
  const coachNSM = question_json.coach_nsm;

  const prompt = `你是一位嚴格的 PM 教練，正在評估學員定義北極星指標（NSM）的能力。

公司情境：
公司：${company}
情境：${scenario}
參考 NSM：${coachNSM}

學員的回答：
北極星指標定義：${user_nsm}

學員的 4 維度拆解：
- 觸及廣度 (Reach)：${user_breakdown?.reach || '（未填寫）'}
- 使用深度 (Depth)：${user_breakdown?.depth || '（未填寫）'}
- 使用頻率 (Frequency)：${user_breakdown?.frequency || '（未填寫）'}
- 轉換效率 (Efficiency)：${user_breakdown?.efficiency || '（未填寫）'}

請評分（各維度 1–5 分）並給出具體教練點評。

評分維度說明：
- alignment（價值關聯性）：指標是否反映真實商業價值，而非虛榮指標
- leading（領先指標性）：能否預測未來營收或留存
- actionability（操作性）：開發團隊能否透過功能直接影響此指標
- simplicity（可理解性）：指標是否直觀，全公司都能理解
- sensitivity（週期敏感度）：變化能否在 1–2 週內觀測到

totalScore = (alignment + leading + actionability + simplicity + sensitivity) * 4（滿分 100）

請以繁體中文回覆，回傳合法 JSON，格式如下：
{
  "scores": {
    "alignment": <1-5>,
    "leading": <1-5>,
    "actionability": <1-5>,
    "simplicity": <1-5>,
    "sensitivity": <1-5>
  },
  "totalScore": <20-100>,
  "coachComments": {
    "alignment": "<具體評語，2-3 句>",
    "leading": "<具體評語>",
    "actionability": "<具體評語>",
    "simplicity": "<具體評語>",
    "sensitivity": "<具體評語>"
  },
  "coachTree": {
    "nsm": "<教練版 NSM>",
    "reach": "<教練版 Reach 指標>",
    "depth": "<教練版 Depth 指標>",
    "frequency": "<教練版 Frequency 指標>",
    "efficiency": "<教練版 Efficiency 指標>"
  },
  "bestMove": "<學員最大亮點，1-2 句>",
  "mainTrap": "<學員主要陷阱，1-2 句>",
  "summary": "<整體總評，3-4 句>"
}`;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await client.chat.completions.create({
        model: 'gpt-4o',
        temperature: 0.3,
        response_format: { type: 'json_object' },
        messages: [{ role: 'user', content: prompt }]
      });
      const result = JSON.parse(response.choices[0].message.content);
      // Compute totalScore defensively
      if (!result.totalScore) {
        const s = result.scores;
        result.totalScore = (s.alignment + s.leading + s.actionability + s.simplicity + s.sensitivity) * 4;
      }
      return result;
    } catch (e) {
      if (attempt === 2) throw e;
      await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
}

module.exports = { evaluateNSM };
```

- [ ] **Step 2: Commit**

```bash
git add prompts/nsm-evaluator.js
git commit -m "feat: nsm-evaluator — GPT-4o 5-dimension scoring with coach tree"
```

---

### Task 8: NSM sessions route (auth users)

**Files:**
- Create: `routes/nsm-sessions.js`

- [ ] **Step 1: Create routes/nsm-sessions.js**

```javascript
const express = require('express');
const router = express.Router();
const db = require('../db/client');
const { requireAuth } = require('../middleware/auth');
const { evaluateNSM } = require('../prompts/nsm-evaluator');

// POST /api/nsm-sessions
router.post('/', requireAuth, async (req, res) => {
  const { questionId, questionJson } = req.body;
  if (!questionId || !questionJson) return res.status(400).json({ error: 'missing_fields' });
  try {
    const { data, error } = await db
      .from('nsm_sessions')
      .insert({ user_id: req.user.id, question_id: questionId, question_json: questionJson })
      .select('id')
      .single();
    if (error) throw error;
    res.json({ sessionId: data.id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/nsm-sessions
router.get('/', requireAuth, async (req, res) => {
  const { data, error } = await db
    .from('nsm_sessions')
    .select('id, question_id, question_json, status, scores_json, created_at')
    .eq('user_id', req.user.id)
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

// GET /api/nsm-sessions/:id
router.get('/:id', requireAuth, async (req, res) => {
  const { data, error } = await db
    .from('nsm_sessions')
    .select('*')
    .eq('id', req.params.id)
    .eq('user_id', req.user.id)
    .single();
  if (error || !data) return res.status(404).json({ error: 'not_found' });
  res.json(data);
});

// DELETE /api/nsm-sessions/:id
router.delete('/:id', requireAuth, async (req, res) => {
  const { data, error } = await db
    .from('nsm_sessions')
    .delete()
    .eq('id', req.params.id)
    .eq('user_id', req.user.id)
    .select('id')
    .single();
  if (error && error.code !== 'PGRST116') return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'not_found' });
  res.json({ ok: true });
});

// POST /api/nsm-sessions/:id/evaluate
router.post('/:id/evaluate', requireAuth, async (req, res) => {
  const { userNsm, userBreakdown } = req.body;
  const { data: session, error } = await db
    .from('nsm_sessions')
    .select('*')
    .eq('id', req.params.id)
    .eq('user_id', req.user.id)
    .single();
  if (error || !session) return res.status(404).json({ error: 'not_found' });
  try {
    const result = await evaluateNSM({
      question_json: session.question_json,
      user_nsm: userNsm,
      user_breakdown: userBreakdown
    });
    const { error: upErr } = await db.from('nsm_sessions').update({
      user_nsm: userNsm,
      user_breakdown: userBreakdown,
      scores_json: result,
      coach_tree_json: result.coachTree,
      status: 'completed',
      updated_at: new Date().toISOString()
    }).eq('id', req.params.id);
    if (upErr) throw upErr;
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
```

- [ ] **Step 2: Commit**

```bash
git add routes/nsm-sessions.js
git commit -m "feat: nsm-sessions route — auth user CRUD + GPT-4o evaluate endpoint"
```

---

### Task 9: Guest NSM sessions route

**Files:**
- Create: `routes/guest-nsm-sessions.js`

- [ ] **Step 1: Create routes/guest-nsm-sessions.js**

```javascript
const express = require('express');
const router = express.Router();
const db = require('../db/client');
const { requireGuestId } = require('../middleware/guest');
const { evaluateNSM } = require('../prompts/nsm-evaluator');

// POST /api/guest/nsm-sessions
router.post('/', requireGuestId, async (req, res) => {
  const { questionId, questionJson } = req.body;
  if (!questionId || !questionJson) return res.status(400).json({ error: 'missing_fields' });
  try {
    const { data, error } = await db
      .from('nsm_sessions')
      .insert({ guest_id: req.guestId, question_id: questionId, question_json: questionJson })
      .select('id')
      .single();
    if (error) throw error;
    res.json({ sessionId: data.id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/guest/nsm-sessions
router.get('/', requireGuestId, async (req, res) => {
  const { data, error } = await db
    .from('nsm_sessions')
    .select('id, question_id, question_json, status, scores_json, created_at')
    .eq('guest_id', req.guestId)
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

// GET /api/guest/nsm-sessions/:id
router.get('/:id', requireGuestId, async (req, res) => {
  const { data, error } = await db
    .from('nsm_sessions')
    .select('*')
    .eq('id', req.params.id)
    .eq('guest_id', req.guestId)
    .single();
  if (error || !data) return res.status(404).json({ error: 'not_found' });
  res.json(data);
});

// DELETE /api/guest/nsm-sessions/:id
router.delete('/:id', requireGuestId, async (req, res) => {
  const { data, error } = await db
    .from('nsm_sessions')
    .delete()
    .eq('id', req.params.id)
    .eq('guest_id', req.guestId)
    .select('id')
    .single();
  if (error && error.code !== 'PGRST116') return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'not_found' });
  res.json({ ok: true });
});

// POST /api/guest/nsm-sessions/:id/evaluate
router.post('/:id/evaluate', requireGuestId, async (req, res) => {
  const { userNsm, userBreakdown } = req.body;
  const { data: session, error } = await db
    .from('nsm_sessions')
    .select('*')
    .eq('id', req.params.id)
    .eq('guest_id', req.guestId)
    .single();
  if (error || !session) return res.status(404).json({ error: 'not_found' });
  try {
    const result = await evaluateNSM({
      question_json: session.question_json,
      user_nsm: userNsm,
      user_breakdown: userBreakdown
    });
    const { error: upErr } = await db.from('nsm_sessions').update({
      user_nsm: userNsm,
      user_breakdown: userBreakdown,
      scores_json: result,
      coach_tree_json: result.coachTree,
      status: 'completed',
      updated_at: new Date().toISOString()
    }).eq('id', req.params.id);
    if (upErr) throw upErr;
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
```

- [ ] **Step 2: Commit**

```bash
git add routes/guest-nsm-sessions.js
git commit -m "feat: guest-nsm-sessions route — guest CRUD + evaluate endpoint"
```

---

### Task 10: Register NSM routes in server.js

**Files:**
- Modify: `server.js`

- [ ] **Step 1: Add two new route registrations to server.js**

After the existing session route lines, add:
```javascript
app.use('/api/nsm-sessions', require('./routes/nsm-sessions'));
app.use('/api/guest/nsm-sessions', require('./routes/guest-nsm-sessions'));
```

- [ ] **Step 2: Verify server starts without error**

```bash
node server.js
```
Expected: Server listening on port (no crash, no missing module error).

- [ ] **Step 3: Commit**

```bash
git add server.js
git commit -m "feat: register /api/nsm-sessions and /api/guest/nsm-sessions routes"
```

---

## Phase 4 — NSM Frontend Wizard

### Task 11: NSM question bank + helpers

**Files:**
- Modify: `public/app.js`

- [ ] **Step 1: Add NSM_QUESTIONS array at top of app.js (after AppState)**

```javascript
const NSM_QUESTIONS = [
  // --- Existing 12 ---
  { id: 'netflix', company: 'Netflix', industry: '影音串流', scenario: 'Netflix 需要追蹤用戶是否真正投入平台，而非只是開著不看。廣告層訂閱需要確保真實觀看行為。', coach_nsm: '訂閱用戶每月完整觀看集數', anti_patterns: ['下載次數','app開啟','用戶數','MAU','DAU','頁面瀏覽'] },
  { id: 'shopee', company: 'Shopee', industry: '電商平台', scenario: 'Shopee 作為雙邊平台，買家和賣家黏著度都很重要，但最終要追蹤真正交易行為。', coach_nsm: '每月成功完成訂單 GMV', anti_patterns: ['商品上架數','搜尋次數','收藏數','曝光次數','瀏覽量'] },
  { id: 'slack', company: 'Slack', industry: 'B2B 協作工具', scenario: 'Slack 的競爭優勢在於團隊真正在平台上協作，而非只是登入後沒有互動。', coach_nsm: '每週發送訊息的活躍工作區數', anti_patterns: ['工作區總數','帳號數','登入次數','訊息總數'] },
  { id: 'uber', company: 'Uber', industry: 'O2O 出行', scenario: 'Uber 需要確保媒合品質，空車率和取消率都會影響司機留存和乘客體驗。', coach_nsm: '每週完成行程數（司機與乘客雙端活躍）', anti_patterns: ['司機數量','app下載','搜尋次數','預估報價次數'] },
  { id: 'tinder', company: 'Tinder', industry: '交友社交', scenario: 'Tinder 靠訂閱盈利，核心要讓用戶真正配對成功，而非只是無意義滑動。', coach_nsm: '每日雙向配對後成功啟動對話數', anti_patterns: ['滑動次數','超讚次數','下載數','帳號註冊數'] },
  { id: 'chatgpt', company: 'ChatGPT', industry: 'AI 助理', scenario: 'OpenAI 需要追蹤 ChatGPT 對用戶的真實生產力價值，而非單純的好奇心驅動的短暫使用。', coach_nsm: '每週完成有效多輪對話的活躍用戶數', anti_patterns: ['訊息發送總數','帳號數','DAU','app開啟次數'] },
  { id: 'strava', company: 'Strava', industry: '運動社群', scenario: 'Strava 的社群黏著性來自於運動記錄與互動，訂閱轉換依賴真實運動習慣養成。', coach_nsm: '每月上傳運動記錄且有社群互動的用戶數', anti_patterns: ['下載數','帳號數','總里程','Kudos 次數'] },
  { id: 'github', company: 'GitHub', industry: '開發者協作', scenario: 'GitHub 的核心護城河在於開發者真正在平台上協作和貢獻，而非只是託管靜態程式碼。', coach_nsm: '每月有 commit 且有 PR review 的活躍開發者數', anti_patterns: ['repo數量','star數','clone次數','帳號總數'] },
  { id: 'duolingo', company: 'Duolingo', industry: '語言學習', scenario: 'Duolingo 的留存策略依賴每日習慣，但需確認用戶真正在學而非只為了維持連續天數。', coach_nsm: '每週完成 3 堂以上課程的活躍學習者數', anti_patterns: ['下載數','連續天數','Streak 總數','帳號數'] },
  { id: 'gogoro', company: 'Gogoro', industry: '電動機車', scenario: 'Gogoro 的能源網路商業模式關鍵在換電站使用率和電池訂閱活躍度，而非新車銷量。', coach_nsm: '每月活躍換電用戶數 × 平均換電次數', anti_patterns: ['車輛銷量','換電站數量','app下載','會員數'] },
  { id: 'binance', company: 'Binance', industry: '加密貨幣交易所', scenario: 'Binance 在加密市場波動中需要追蹤真正有交易行為的用戶，而非投機性帳號開設。', coach_nsm: '每月完成現貨或合約交易的活躍交易者數', anti_patterns: ['帳號數','KYC通過數','app下載','入金次數'] },
  { id: 'notion', company: 'Notion', industry: '知識協作工具', scenario: 'Notion 的 PLG 模式依賴個人用戶帶動團隊採用，協作深度是付費轉換的關鍵。', coach_nsm: '每週有協作行為（分享/評論）的工作區數', anti_patterns: ['頁面建立數','模板使用次數','下載數','帳號數'] },
  // --- New 12 ---
  { id: 'spotify', company: 'Spotify', industry: '音樂串流', scenario: 'Spotify 有廣告和訂閱雙收入模式，需確保用戶真實深度收聽而非被動背景播放。', coach_nsm: '付費用戶每月完整播放曲目的收聽時長', anti_patterns: ['DAU','app開啟','歌曲收藏數','播放清單數','總用戶數'] },
  { id: 'airbnb', company: 'Airbnb', industry: '雙邊住宿平台', scenario: 'Airbnb 需要讓房客和房東雙邊都保持黏著，但真實價值只在訂單成功完成時才實現。', coach_nsm: '每月成功完成入住的訂單數（無取消）', anti_patterns: ['房源上架數','搜尋次數','心願清單數','頁面瀏覽'] },
  { id: 'linkedin', company: 'LinkedIn', industry: '職業社群', scenario: 'LinkedIn 的商業模式依賴媒合，但大量用戶只被動瀏覽內容，真實連結與對話才有價值。', coach_nsm: '每月成功媒合後啟動對話的活躍用戶數', anti_patterns: ['個人資料瀏覽量','連結總數','貼文瀏覽','帳號數'] },
  { id: 'figma', company: 'Figma', industry: '設計協作工具', scenario: 'Figma 的護城河在於協作，個人使用容易被替代，但有多人同時編輯記錄的檔案才難以遷移。', coach_nsm: '每月有 2 人以上協作的活躍設計檔案數', anti_patterns: ['檔案建立數','登入次數','元件使用次數','帳號數'] },
  { id: 'grab', company: 'Grab', industry: 'O2O 超級 App', scenario: 'Grab 在東南亞擴張中需要追蹤跨服務的真實使用，而非只是某一垂直類別的短暫活躍。', coach_nsm: '每月同時使用 2 種以上服務並完成交易的活躍用戶數', anti_patterns: ['app安裝數','騎手上線時數','總訂單量（含取消）','帳號數'] },
  { id: 'miro', company: 'Miro', industry: '視覺協作白板', scenario: 'Miro 的遠距協作工具中有大量沉默用戶，真正的黏著來自於定期多人協作工作階段。', coach_nsm: '每週有 2 人以上參與的活躍協作白板 session 數', anti_patterns: ['白板建立數','貼紙使用次數','模板使用次數','帳號數'] },
  { id: 'canva', company: 'Canva', industry: '設計民主化', scenario: 'Canva 的免費轉付費策略依賴用戶真正完成並分享設計，而非只是開啟範本後放棄。', coach_nsm: '每月發布或分享設計的活躍用戶數', anti_patterns: ['範本使用次數','總設計數（含草稿）','登入次數','帳號數'] },
  { id: 'coursera', company: 'Coursera', industry: '線上學習', scenario: 'Coursera 的核心問題是中途棄課率極高，只有完成課程的用戶才會帶來口碑和回購。', coach_nsm: '每月完成課程並取得證書的學習者數', anti_patterns: ['課程報名數','影片播放次數','帳號數','DAU'] },
  { id: 'shopify', company: 'Shopify', industry: '電商基礎設施', scenario: 'Shopify 的商業模式是商家成功才能留存，衡量的是商家的電商健康度而非開店動作。', coach_nsm: '每月 GMV 持續成長的活躍商家數', anti_patterns: ['商家開店數','app安裝數','帳號數','試用啟動數'] },
  { id: 'discord', company: 'Discord', industry: '遊戲社群', scenario: 'Discord 依賴社群黏著帶動 Nitro 訂閱，活躍發言的伺服器才有付費意願。', coach_nsm: '每週有活躍文字或語音發言的獨立伺服器數', anti_patterns: ['總伺服器數','語音連線次數','帳號數','訊息總數'] },
  { id: 'klook', company: 'Klook', industry: '旅遊體驗預訂', scenario: 'Klook 的口碑和留存依賴旅客真正完成體驗，而非只是瀏覽或加入心願清單。', coach_nsm: '每月成功完成體驗訂單並提交評分的用戶數', anti_patterns: ['搜尋次數','心願清單數','頁面瀏覽','app下載'] },
  { id: 'waze', company: 'Waze', industry: '社群導航', scenario: 'Waze 的護城河在於社群回報路況數據，沒有活躍回報的用戶等同只是普通地圖軟體。', coach_nsm: '每月主動回報路況且完成導航的活躍用戶數', anti_patterns: ['導航啟動次數','app下載','帳號數','總導航里程'] },
];
```

- [ ] **Step 2: Add helper functions below NSM_QUESTIONS**

```javascript
function isVanityMetric(input, antiPatterns) {
  if (!input || !antiPatterns) return false;
  const lower = input.toLowerCase();
  return antiPatterns.some(p => lower.includes(p.toLowerCase()));
}

function nsmRoute(path) {
  const base = AppState.accessToken ? '/api/nsm-sessions' : '/api/guest/nsm-sessions';
  return base + (path ? '/' + path : '');
}

function getRandomNSMQuestions(count = 3) {
  const shuffled = [...NSM_QUESTIONS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}
```

- [ ] **Step 3: Commit**

```bash
git add public/app.js
git commit -m "feat: NSM_QUESTIONS array (24 questions) + isVanityMetric + nsmRoute helpers"
```

---

### Task 12: renderNSM router + renderNSMStep1 (scenario selection)

**Files:**
- Modify: `public/app.js`
- Modify: `public/style.css`

- [ ] **Step 1: Add renderNSM() router function**

```javascript
function renderNSM() {
  switch (AppState.nsmStep) {
    case 1: return renderNSMStep1();
    case 2: return renderNSMStep2();
    case 3: return renderNSMStep3();
    case 4: return renderNSMStep4();
    default: return renderNSMStep1();
  }
}
```

- [ ] **Step 2: Add renderNSMStep1()**

```javascript
function renderNSMStep1() {
  const questions = AppState.nsmStep1Questions || getRandomNSMQuestions(3);
  AppState.nsmStep1Questions = questions;
  const selected = AppState.nsmSelectedQuestion;

  const progressBar = `
    <div class="nsm-progress">
      <div class="nsm-progress-step active">1</div>
      <div class="nsm-progress-line"></div>
      <div class="nsm-progress-step">2</div>
      <div class="nsm-progress-line"></div>
      <div class="nsm-progress-step">3</div>
      <div class="nsm-progress-line"></div>
      <div class="nsm-progress-step">4</div>
    </div>`;

  const cards = questions.map(q => `
    <div class="nsm-question-card ${selected?.id === q.id ? 'selected' : ''}" data-qid="${q.id}">
      <div class="nsm-q-header">
        <span class="nsm-company-badge">${escHtml(q.company)}</span>
        <span class="nsm-industry">${escHtml(q.industry)}</span>
        ${selected?.id === q.id ? '<i class="ph ph-check-circle nsm-check"></i>' : ''}
      </div>
      <p class="nsm-scenario">${escHtml(q.scenario)}</p>
    </div>`).join('');

  return `
    <div class="nsm-view">
      <div class="nsm-navbar">
        <button class="btn-icon" id="btn-nsm-back" aria-label="返回"><i class="ph ph-arrow-left"></i></button>
        <span class="nsm-title">選擇情境</span>
        <div style="width:44px"></div>
      </div>
      ${progressBar}
      <div class="nsm-body">
        <p class="nsm-instruction">選擇一個企業情境，開始定義北極星指標</p>
        <div class="nsm-question-list">${cards}</div>
        <div style="height:80px"></div>
      </div>
      <div class="nsm-fixed-bottom">
        <button class="btn-primary nsm-next-btn" id="btn-nsm-step1-next" ${selected ? '' : 'disabled'}>
          確認，開始定義 <i class="ph ph-arrow-right"></i>
        </button>
      </div>
    </div>`;
}
```

- [ ] **Step 3: Add NSM Step 1 CSS**

```css
/* NSM shared */
.nsm-view { display: flex; flex-direction: column; height: 100dvh; background: var(--bg-primary); }
.nsm-navbar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 16px; border-bottom: 1px solid var(--border);
  background: var(--bg-primary); position: sticky; top: 0; z-index: 10;
}
.nsm-title { font-size: 16px; font-weight: 700; color: var(--text-primary); }
.nsm-body { flex: 1; overflow-y: auto; padding: 16px; }
.nsm-fixed-bottom {
  position: fixed; bottom: 0; left: 0; right: 0;
  padding: 12px 16px max(12px, env(safe-area-inset-bottom));
  background: var(--bg-primary); border-top: 1px solid var(--border);
  z-index: 100;
}

/* Progress */
.nsm-progress {
  display: flex; align-items: center; padding: 12px 16px; gap: 4px;
  background: var(--bg-primary);
}
.nsm-progress-step {
  width: 28px; height: 28px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 12px; font-weight: 700; flex-shrink: 0;
  background: var(--bg-surface); color: var(--text-secondary);
  border: 2px solid var(--border);
}
.nsm-progress-step.active { background: var(--accent); color: #fff; border-color: var(--accent); }
.nsm-progress-step.done { background: var(--accent); color: #fff; border-color: var(--accent); }
.nsm-progress-line { flex: 1; height: 2px; background: var(--border); }

/* Step 1 */
.nsm-instruction { font-size: 14px; color: var(--text-secondary); margin-bottom: 14px; }
.nsm-question-card {
  background: var(--bg-surface); border: 2px solid var(--border);
  border-radius: 14px; padding: 16px; margin-bottom: 10px;
  cursor: pointer; transition: all 0.15s;
}
.nsm-question-card:active { transform: scale(0.98); }
.nsm-question-card.selected { border-color: var(--accent); background: rgba(108,99,255,0.05); }
.nsm-q-header { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.nsm-company-badge {
  background: var(--accent); color: #fff;
  font-size: 12px; font-weight: 700;
  padding: 3px 10px; border-radius: 99px;
}
.nsm-industry { font-size: 12px; color: var(--text-secondary); }
.nsm-check { color: var(--accent); font-size: 20px; margin-left: auto; }
.nsm-scenario { font-size: 13px; color: var(--text-primary); line-height: 1.6; }

/* Next button */
.nsm-next-btn { width: 100%; }
.nsm-next-btn:disabled { opacity: 0.45; pointer-events: none; }
```

- [ ] **Step 4: Commit**

```bash
git add public/app.js public/style.css
git commit -m "feat: NSM Step 1 — scenario selection with progress bar and question cards"
```

---

### Task 13: renderNSMStep2 — define NSM + vanity warning modal

**Files:**
- Modify: `public/app.js`
- Modify: `public/style.css`

- [ ] **Step 1: Add renderNSMStep2()**

```javascript
function renderNSMStep2() {
  const q = AppState.nsmSelectedQuestion;
  const draft = AppState.nsmNsmDraft || '';
  const warning = AppState.nsmVanityWarning || null; // { coachHint }

  const warningHtml = warning ? `
    <div class="nsm-vanity-warning">
      <div class="nsm-vanity-header">
        <i class="ph ph-warning" style="color:#f59e0b;font-size:20px"></i>
        <strong>這可能是虛榮指標</strong>
      </div>
      <p class="nsm-vanity-body">如果這個指標翻倍，公司一定更賺錢嗎？虛榮指標容易讓團隊努力方向錯誤。</p>
      <div class="nsm-coach-hint">
        <i class="ph ph-lightbulb" style="color:var(--accent)"></i>
        <span>${escHtml(warning.coachHint)}</span>
      </div>
      <div class="nsm-warning-actions">
        <button class="btn-primary" id="btn-nsm-redefine">重新定義</button>
        <button class="btn-ghost" id="btn-nsm-proceed-anyway">我知道風險，繼續</button>
      </div>
    </div>` : '';

  return `
    <div class="nsm-view">
      <div class="nsm-navbar">
        <button class="btn-icon" id="btn-nsm-back" aria-label="返回上一步"><i class="ph ph-arrow-left"></i></button>
        <span class="nsm-title">定義 NSM</span>
        <div style="width:44px"></div>
      </div>
      <div class="nsm-progress">
        <div class="nsm-progress-step done">1</div>
        <div class="nsm-progress-line" style="background:var(--accent)"></div>
        <div class="nsm-progress-step active">2</div>
        <div class="nsm-progress-line"></div>
        <div class="nsm-progress-step">3</div>
        <div class="nsm-progress-line"></div>
        <div class="nsm-progress-step">4</div>
      </div>
      <div class="nsm-body">
        <div class="nsm-context-card">
          <div class="nsm-context-company">${escHtml(q.company)}</div>
          <p class="nsm-context-scenario">${escHtml(q.scenario)}</p>
        </div>
        <label class="nsm-field-label">你認為 ${escHtml(q.company)} 的北極星指標是？</label>
        <textarea
          id="nsm-nsm-input"
          class="nsm-textarea"
          placeholder="一句話描述核心指標，例如：每月付費用戶完整收聽時長"
          rows="4"
        >${escHtml(draft)}</textarea>
        ${warningHtml}
        <div style="height:80px"></div>
      </div>
      <div class="nsm-fixed-bottom">
        <button class="btn-primary nsm-next-btn" id="btn-nsm-step2-next">
          確認，拆解維度 <i class="ph ph-arrow-right"></i>
        </button>
      </div>
    </div>`;
}
```

- [ ] **Step 2: Add Step 2 CSS**

```css
/* Context card */
.nsm-context-card {
  background: rgba(108,99,255,0.06); border: 1.5px solid rgba(108,99,255,0.2);
  border-radius: 12px; padding: 14px 16px; margin-bottom: 16px;
}
.nsm-context-company { font-size: 13px; font-weight: 700; color: var(--accent); margin-bottom: 4px; }
.nsm-context-scenario { font-size: 13px; color: var(--text-secondary); line-height: 1.6; }

.nsm-field-label { font-size: 14px; font-weight: 600; color: var(--text-primary); display: block; margin-bottom: 8px; }
.nsm-textarea {
  width: 100%; padding: 12px 14px;
  border: 1.5px solid var(--border); border-radius: 12px;
  background: var(--bg-surface); color: var(--text-primary);
  font-size: 15px; resize: none; line-height: 1.6;
  font-family: inherit;
}
.nsm-textarea:focus { outline: none; border-color: var(--accent); }

/* Vanity warning */
.nsm-vanity-warning {
  margin-top: 14px; background: rgba(245,158,11,0.08);
  border: 1.5px solid rgba(245,158,11,0.4); border-radius: 12px; padding: 16px;
}
.nsm-vanity-header { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.nsm-vanity-header strong { font-size: 14px; color: #b45309; }
.nsm-vanity-body { font-size: 13px; color: var(--text-secondary); line-height: 1.6; margin-bottom: 10px; }
.nsm-coach-hint {
  display: flex; gap: 8px; align-items: flex-start;
  background: rgba(108,99,255,0.07); border-radius: 10px;
  padding: 10px 12px; margin-bottom: 12px;
  font-size: 13px; color: var(--text-primary); line-height: 1.6;
}
.nsm-warning-actions { display: flex; gap: 8px; }
.nsm-warning-actions button { flex: 1; min-height: 44px; }
.btn-ghost {
  background: transparent; border: 1.5px solid var(--border);
  border-radius: 10px; padding: 10px 14px;
  font-size: 14px; font-weight: 600; color: var(--text-secondary);
  cursor: pointer; min-height: 44px;
}
```

- [ ] **Step 3: Commit**

```bash
git add public/app.js public/style.css
git commit -m "feat: NSM Step 2 — NSM definition textarea + vanity metric warning"
```

---

### Task 14: renderNSMStep3 — 4-dimension breakdown form

**Files:**
- Modify: `public/app.js`
- Modify: `public/style.css`

- [ ] **Step 1: Add renderNSMStep3()**

```javascript
function renderNSMStep3() {
  const q = AppState.nsmSelectedQuestion;
  const breakdown = AppState.nsmBreakdownDraft || {};
  const dimensions = [
    { key: 'reach', label: '觸及廣度 (Reach)', color: '#3b82f6', desc: '衡量你的 NSM 觸及多少獨立用戶', placeholder: '例：月啟動播放的 MAU 數量' },
    { key: 'depth', label: '使用深度 (Depth)', color: '#8b5cf6', desc: '衡量每次互動的品質', placeholder: '例：每次 session 平均收聽時長' },
    { key: 'frequency', label: '使用頻率 (Frequency)', color: '#10b981', desc: '衡量使用習慣是否形成', placeholder: '例：每週收聽天數' },
    { key: 'efficiency', label: '轉換效率 (Efficiency)', color: '#f59e0b', desc: '衡量行為是否帶來商業價值', placeholder: '例：試用轉付費率' },
  ];

  const fields = dimensions.map(d => `
    <div class="nsm-dim-section">
      <div class="nsm-dim-header" style="border-left-color:${d.color}">
        <div class="nsm-dim-label">${escHtml(d.label)}</div>
        <div class="nsm-dim-desc">${escHtml(d.desc)}</div>
      </div>
      <textarea
        class="nsm-textarea nsm-dim-input"
        id="nsm-dim-${d.key}"
        placeholder="${escHtml(d.placeholder)}"
        rows="2"
      >${escHtml(breakdown[d.key] || '')}</textarea>
    </div>`).join('');

  return `
    <div class="nsm-view">
      <div class="nsm-navbar">
        <button class="btn-icon" id="btn-nsm-back" aria-label="返回上一步"><i class="ph ph-arrow-left"></i></button>
        <span class="nsm-title">拆解維度</span>
        <div style="width:44px"></div>
      </div>
      <div class="nsm-progress">
        <div class="nsm-progress-step done">1</div>
        <div class="nsm-progress-line" style="background:var(--accent)"></div>
        <div class="nsm-progress-step done">2</div>
        <div class="nsm-progress-line" style="background:var(--accent)"></div>
        <div class="nsm-progress-step active">3</div>
        <div class="nsm-progress-line"></div>
        <div class="nsm-progress-step">4</div>
      </div>
      <div class="nsm-body">
        <div class="nsm-sticky-nsm">
          <span class="nsm-sticky-label">你的 NSM：</span>
          <span class="nsm-sticky-value">${escHtml(AppState.nsmNsmDraft || '')}</span>
        </div>
        ${fields}
        <div style="height:80px"></div>
      </div>
      <div class="nsm-fixed-bottom">
        <button class="btn-primary nsm-next-btn" id="btn-nsm-step3-submit">
          <span id="nsm-submit-label">送出，取得評分</span>
          <i class="ph ph-arrow-right"></i>
        </button>
      </div>
    </div>`;
}
```

- [ ] **Step 2: Add Step 3 CSS**

```css
.nsm-sticky-nsm {
  background: rgba(108,99,255,0.06); border-radius: 10px;
  padding: 10px 14px; margin-bottom: 16px;
  font-size: 13px;
}
.nsm-sticky-label { color: var(--text-secondary); margin-right: 4px; }
.nsm-sticky-value { color: var(--accent); font-weight: 600; }

.nsm-dim-section { margin-bottom: 16px; }
.nsm-dim-header {
  border-left: 3px solid var(--border);
  padding-left: 10px; margin-bottom: 8px;
}
.nsm-dim-label { font-size: 14px; font-weight: 700; color: var(--text-primary); }
.nsm-dim-desc  { font-size: 12px; color: var(--text-secondary); margin-top: 2px; }
```

- [ ] **Step 3: Commit**

```bash
git add public/app.js public/style.css
git commit -m "feat: NSM Step 3 — 4-dimension breakdown form with color-coded fields"
```

---

### Task 15: renderNSMStep4 — evaluation report (radar + comparison tree + highlights)

**Files:**
- Modify: `public/app.js`
- Modify: `public/style.css`

- [ ] **Step 1: Add renderNSMStep4()**

```javascript
function renderNSMStep4() {
  const session = AppState.nsmSession || {};
  const scores = session.scores_json || {};
  const q = AppState.nsmSelectedQuestion || {};
  const total = scores.totalScore || 0;
  const activeTab = AppState.nsmReportTab || 'overview';

  const dims = [
    { key: 'alignment',     label: '價值關聯', color: '#6c63ff' },
    { key: 'leading',       label: '領先指標', color: '#3b82f6' },
    { key: 'actionability', label: '操作性',   color: '#10b981' },
    { key: 'simplicity',    label: '可理解性', color: '#f59e0b' },
    { key: 'sensitivity',   label: '週期敏感', color: '#ef4444' },
  ];

  const radarSvg = scores.scores ? renderRadar(scores.scores) : '';

  const overviewTab = `
    <div class="nsm-report-overview">
      <div class="nsm-radar-wrap">${radarSvg}</div>
      ${dims.map(d => {
        const val = scores.scores?.[d.key] || 0;
        const pct = (val / 5) * 100;
        const comment = scores.coachComments?.[d.key] || '';
        return `<div class="nsm-score-row">
          <div class="nsm-score-label">${d.label}</div>
          <div class="nsm-score-bar-wrap">
            <div class="nsm-score-bar-fill" style="width:${pct}%;background:${d.color}"></div>
          </div>
          <div class="nsm-score-num">${val}/5</div>
        </div>
        ${comment ? `<div class="nsm-dim-comment">${escHtml(comment)}</div>` : ''}`;
      }).join('')}
    </div>`;

  const coachTree = scores.coachTree || {};
  const userNsm = session.user_nsm || '';
  const userBreakdown = session.user_breakdown || {};

  const comparisonTab = `
    <div class="nsm-comparison">
      <div class="nsm-tree-col">
        <div class="nsm-tree-title"><i class="ph ph-user"></i> 你的拆解</div>
        <div class="nsm-tree-node nsm-tree-root" data-node="user-nsm">${escHtml(userNsm || '（未填寫）')}</div>
        ${['reach','depth','frequency','efficiency'].map(k => `
          <div class="nsm-tree-node" data-node="user-${k}">${escHtml(userBreakdown[k] || '（未填寫）')}</div>`).join('')}
      </div>
      <div class="nsm-tree-col">
        <div class="nsm-tree-title"><i class="ph ph-graduation-cap"></i> 教練版本</div>
        <div class="nsm-tree-node nsm-tree-root nsm-tree-coach" data-node="coach-nsm">${escHtml(coachTree.nsm || '')}</div>
        ${['reach','depth','frequency','efficiency'].map(k => `
          <div class="nsm-tree-node nsm-tree-coach" data-node="coach-${k}">${escHtml(coachTree[k] || '')}</div>`).join('')}
      </div>
    </div>
    <div class="nsm-node-detail" id="nsm-node-detail" style="display:none"></div>`;

  const highlightsTab = `
    <div class="nsm-highlights">
      <div class="nsm-highlight-card nsm-highlight-best">
        <div class="nsm-highlight-head"><i class="ph ph-trophy"></i> 最大亮點</div>
        <p>${escHtml(scores.bestMove || '—')}</p>
      </div>
      <div class="nsm-highlight-card nsm-highlight-trap">
        <div class="nsm-highlight-head"><i class="ph ph-warning-circle"></i> 主要陷阱</div>
        <p>${escHtml(scores.mainTrap || '—')}</p>
      </div>
      <div class="nsm-highlight-card">
        <div class="nsm-highlight-head"><i class="ph ph-chat-text"></i> 總評</div>
        <p>${escHtml(scores.summary || '—')}</p>
      </div>
    </div>`;

  const exportTab = `
    <div class="nsm-export">
      <button class="btn-primary" id="btn-nsm-again" style="width:100%;margin-bottom:12px">
        <i class="ph ph-arrow-counter-clockwise"></i> 再練一次
      </button>
      <button class="btn-ghost" id="btn-nsm-home" style="width:100%">
        <i class="ph ph-house"></i> 回首頁
      </button>
    </div>`;

  const tabContent = {
    overview: overviewTab,
    comparison: comparisonTab,
    highlights: highlightsTab,
    export: exportTab,
  };

  return `
    <div class="nsm-view">
      <div class="nsm-navbar">
        <button class="btn-icon" id="btn-nsm-back" aria-label="回首頁"><i class="ph ph-house"></i></button>
        <span class="nsm-title">NSM 報告</span>
        <div style="width:44px"></div>
      </div>
      <div class="nsm-score-summary">
        <div class="nsm-total-score">${total}</div>
        <div class="nsm-score-label-sm">/ 100</div>
        <div class="nsm-score-company">${escHtml(q.company || '')}</div>
      </div>
      <div class="tab-bar">
        ${['overview','comparison','highlights','export'].map(tab => `
          <button class="tab-btn ${activeTab === tab ? 'active' : ''}" data-nsm-tab="${tab}">
            ${tab === 'overview' ? '總覽' : tab === 'comparison' ? '對比' : tab === 'highlights' ? '亮點' : '再練'}
          </button>`).join('')}
      </div>
      <div class="nsm-report-body">
        ${tabContent[activeTab] || overviewTab}
      </div>
    </div>`;
}
```

- [ ] **Step 2: Add Step 4 CSS**

```css
.nsm-score-summary {
  display: flex; align-items: baseline; gap: 6px;
  padding: 14px 16px; border-bottom: 1px solid var(--border);
  background: var(--bg-primary);
}
.nsm-total-score { font-size: 36px; font-weight: 800; color: var(--accent); }
.nsm-score-label-sm { font-size: 18px; color: var(--text-secondary); }
.nsm-score-company { margin-left: auto; font-size: 14px; font-weight: 600; color: var(--text-primary); }

.nsm-report-body { flex: 1; overflow-y: auto; padding: 16px; }
.nsm-radar-wrap { display: flex; justify-content: center; margin-bottom: 16px; }

/* Score bars */
.nsm-score-row { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
.nsm-score-label { font-size: 12px; color: var(--text-secondary); width: 60px; flex-shrink: 0; }
.nsm-score-bar-wrap { flex: 1; height: 8px; background: var(--bg-surface); border-radius: 4px; overflow: hidden; }
.nsm-score-bar-fill { height: 100%; border-radius: 4px; transition: width 0.5s ease; }
.nsm-score-num { font-size: 12px; font-weight: 700; color: var(--text-primary); width: 28px; text-align: right; }
.nsm-dim-comment { font-size: 12px; color: var(--text-secondary); margin-bottom: 12px; padding-left: 68px; line-height: 1.5; }

/* Comparison tree */
.nsm-comparison { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.nsm-tree-col {}
.nsm-tree-title { font-size: 12px; font-weight: 700; color: var(--text-secondary); margin-bottom: 8px; display: flex; align-items: center; gap: 4px; }
.nsm-tree-node {
  background: var(--bg-surface); border: 1.5px solid var(--border);
  border-radius: 10px; padding: 10px 12px; margin-bottom: 8px;
  font-size: 12px; color: var(--text-primary); line-height: 1.5;
  cursor: pointer; transition: all 0.15s;
}
.nsm-tree-node:active { transform: scale(0.97); }
.nsm-tree-root { font-weight: 700; border-color: var(--accent); }
.nsm-tree-coach { border-color: rgba(108,99,255,0.4); background: rgba(108,99,255,0.04); }
.nsm-node-detail {
  margin-top: 10px; background: var(--bg-surface); border-radius: 12px;
  padding: 14px; font-size: 13px; color: var(--text-primary); line-height: 1.6;
  border: 1.5px solid var(--border);
}

/* Highlights */
.nsm-highlight-card {
  background: var(--bg-surface); border: 1.5px solid var(--border);
  border-radius: 12px; padding: 14px 16px; margin-bottom: 12px;
}
.nsm-highlight-head { display: flex; align-items: center; gap: 6px; font-weight: 700; margin-bottom: 6px; font-size: 14px; }
.nsm-highlight-best .nsm-highlight-head { color: #059669; }
.nsm-highlight-trap .nsm-highlight-head { color: #dc2626; }
.nsm-highlight-card p { font-size: 13px; color: var(--text-primary); line-height: 1.6; }

/* Export */
.nsm-export { display: flex; flex-direction: column; gap: 10px; padding-top: 8px; }
```

- [ ] **Step 3: Commit**

```bash
git add public/app.js public/style.css
git commit -m "feat: NSM Step 4 — evaluation report with radar, comparison tree, highlights"
```

---

### Task 16: bindNSM() — all event handlers

**Files:**
- Modify: `public/app.js`

- [ ] **Step 1: Add bindNSM() function**

```javascript
function bindNSM() {
  // Back button
  const btnBack = document.getElementById('btn-nsm-back');
  if (btnBack) {
    btnBack.addEventListener('click', () => {
      if (AppState.nsmStep === 1) {
        navigate('home');
      } else if (AppState.nsmStep === 4) {
        navigate('home');
      } else {
        AppState.nsmStep--;
        render();
      }
    });
  }

  // Step 1: question selection + next
  document.querySelectorAll('.nsm-question-card[data-qid]').forEach(card => {
    card.addEventListener('click', () => {
      const qid = card.dataset.qid;
      AppState.nsmSelectedQuestion = NSM_QUESTIONS.find(q => q.id === qid);
      AppState.nsmStep1Questions = AppState.nsmStep1Questions; // preserve current list
      render();
    });
  });

  const btnStep1Next = document.getElementById('btn-nsm-step1-next');
  if (btnStep1Next) {
    btnStep1Next.addEventListener('click', async () => {
      if (!AppState.nsmSelectedQuestion) return;
      btnStep1Next.classList.add('btn-loading');
      btnStep1Next.disabled = true;
      try {
        const q = AppState.nsmSelectedQuestion;
        const res = await fetch(nsmRoute(''), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(AppState.accessToken ? { 'Authorization': `Bearer ${AppState.accessToken}` } : {})
          },
          body: JSON.stringify({ questionId: q.id, questionJson: q })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        AppState.nsmSession = { id: data.sessionId };
        AppState.nsmStep = 2;
        AppState.nsmVanityWarning = null;
        render();
      } catch (e) {
        btnStep1Next.classList.remove('btn-loading');
        btnStep1Next.disabled = false;
        alert('無法建立練習：' + e.message);
      }
    });
  }

  // Step 2: NSM input + next
  const nsmInput = document.getElementById('nsm-nsm-input');
  if (nsmInput) {
    nsmInput.addEventListener('input', () => { AppState.nsmNsmDraft = nsmInput.value; });
  }

  const btnStep2Next = document.getElementById('btn-nsm-step2-next');
  if (btnStep2Next) {
    btnStep2Next.addEventListener('click', () => {
      const val = (nsmInput?.value || AppState.nsmNsmDraft || '').trim();
      if (!val) return;
      AppState.nsmNsmDraft = val;
      const q = AppState.nsmSelectedQuestion;
      if (!AppState.nsmVanityWarning && isVanityMetric(val, q.anti_patterns)) {
        // Compute a simple coach hint
        AppState.nsmVanityWarning = {
          coachHint: `試著思考：這個指標如果翻倍，${q.company} 的核心商業價值會增加嗎？考慮從「用戶行為產生的業務影響」角度重新定義。`
        };
        render();
        return;
      }
      AppState.nsmVanityWarning = null;
      AppState.nsmStep = 3;
      render();
    });
  }

  const btnRedefine = document.getElementById('btn-nsm-redefine');
  if (btnRedefine) {
    btnRedefine.addEventListener('click', () => {
      AppState.nsmVanityWarning = null;
      AppState.nsmNsmDraft = '';
      render();
    });
  }

  const btnProceedAnyway = document.getElementById('btn-nsm-proceed-anyway');
  if (btnProceedAnyway) {
    btnProceedAnyway.addEventListener('click', () => {
      AppState.nsmVanityWarning = null;
      AppState.nsmStep = 3;
      render();
    });
  }

  // Step 3: breakdown inputs + submit
  ['reach','depth','frequency','efficiency'].forEach(k => {
    const inp = document.getElementById(`nsm-dim-${k}`);
    if (inp) {
      inp.addEventListener('input', () => {
        AppState.nsmBreakdownDraft = AppState.nsmBreakdownDraft || {};
        AppState.nsmBreakdownDraft[k] = inp.value;
      });
    }
  });

  const btnStep3Submit = document.getElementById('btn-nsm-step3-submit');
  if (btnStep3Submit) {
    btnStep3Submit.addEventListener('click', async () => {
      const breakdown = AppState.nsmBreakdownDraft || {};
      const userNsm = AppState.nsmNsmDraft || '';
      if (!userNsm) return;
      btnStep3Submit.classList.add('btn-loading');
      btnStep3Submit.disabled = true;
      const label = document.getElementById('nsm-submit-label');
      if (label) label.textContent = 'AI 評分中…';
      try {
        const sessionId = AppState.nsmSession?.id;
        const res = await fetch(nsmRoute(`${sessionId}/evaluate`), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(AppState.accessToken ? { 'Authorization': `Bearer ${AppState.accessToken}` } : {})
          },
          body: JSON.stringify({ userNsm, userBreakdown: breakdown })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        AppState.nsmSession = {
          ...AppState.nsmSession,
          scores_json: data,
          user_nsm: userNsm,
          user_breakdown: breakdown
        };
        AppState.nsmReportTab = 'overview';
        AppState.nsmStep = 4;
        render();
      } catch (e) {
        btnStep3Submit.classList.remove('btn-loading');
        btnStep3Submit.disabled = false;
        if (label) label.textContent = '送出，取得評分';
        alert('評分失敗：' + e.message);
      }
    });
  }

  // Step 4: tab switching + tree node tap + buttons
  document.querySelectorAll('[data-nsm-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      AppState.nsmReportTab = btn.dataset.nsmTab;
      render();
    });
  });

  document.querySelectorAll('.nsm-tree-node[data-node]').forEach(node => {
    node.addEventListener('click', () => {
      const detailEl = document.getElementById('nsm-node-detail');
      if (!detailEl) return;
      const key = node.dataset.node;
      const isCoach = key.startsWith('coach-');
      const dim = key.replace('coach-', '').replace('user-', '');
      const scores = AppState.nsmSession?.scores_json || {};
      let detail = '';
      if (dim === 'nsm') {
        detail = isCoach
          ? `教練 NSM：${scores.coachTree?.nsm || ''}`
          : `你的 NSM：${AppState.nsmNsmDraft || ''}`;
      } else {
        const dimLabel = { reach: '觸及廣度', depth: '使用深度', frequency: '使用頻率', efficiency: '轉換效率' };
        detail = isCoach
          ? `教練版 ${dimLabel[dim]}：${scores.coachTree?.[dim] || ''}`
          : `你的 ${dimLabel[dim]}：${AppState.nsmBreakdownDraft?.[dim] || '（未填寫）'}`;
      }
      if (detailEl.style.display === 'none' || detailEl._lastKey !== key) {
        detailEl.style.display = 'block';
        detailEl.textContent = detail;
        detailEl._lastKey = key;
      } else {
        detailEl.style.display = 'none';
        detailEl._lastKey = null;
      }
    });
  });

  const btnNsmAgain = document.getElementById('btn-nsm-again');
  if (btnNsmAgain) {
    btnNsmAgain.addEventListener('click', () => {
      AppState.nsmStep = 1;
      AppState.nsmSession = null;
      AppState.nsmSelectedQuestion = null;
      AppState.nsmStep1Questions = null;
      AppState.nsmNsmDraft = '';
      AppState.nsmBreakdownDraft = {};
      AppState.nsmVanityWarning = null;
      render();
    });
  }

  const btnNsmHome = document.getElementById('btn-nsm-home');
  if (btnNsmHome) {
    btnNsmHome.addEventListener('click', () => navigate('home'));
  }

  // visualViewport keyboard fix for fixed bottom bar (same as practice view)
  function adjustNsmKeyboard() {
    if (!window.visualViewport) return;
    const bar = document.querySelector('.nsm-fixed-bottom');
    const body = document.querySelector('.nsm-body');
    if (!bar) return;
    const keyboardHeight = window.innerHeight - window.visualViewport.height;
    bar.style.bottom = keyboardHeight + 'px';
    if (body) body.style.paddingBottom = (bar.offsetHeight + keyboardHeight) + 'px';
  }
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', adjustNsmKeyboard);
    adjustNsmKeyboard();
  }
}
```

- [ ] **Step 2: Add `case 'nsm'` to render() switch**

In the `render()` function, inside the switch statement:
```javascript
case 'nsm':
  main.innerHTML = renderNSM();
  bindNSM();
  break;
```

- [ ] **Step 3: Commit**

```bash
git add public/app.js
git commit -m "feat: bindNSM — all event handlers for NSM wizard steps 1-4"
```

---

## Phase 5 — Integration + Emoji Cleanup

### Task 17: Offcanvas — show NSM sessions mixed with PM sessions

**Files:**
- Modify: `public/app.js`

- [ ] **Step 1: Update loadOffcanvasSessions() to load both PM and NSM**

Find the existing `loadOffcanvasSessions()` function. Replace its fetch logic:
```javascript
async function loadOffcanvasSessions() {
  const listEl = document.getElementById('session-list');
  if (!listEl) return;
  listEl.innerHTML = '<div style="padding:16px;color:var(--text-secondary);font-size:14px">載入中…</div>';

  try {
    const headers = AppState.accessToken ? { 'Authorization': `Bearer ${AppState.accessToken}` } : {};
    const pmUrl = AppState.accessToken ? '/api/sessions' : '/api/guest/sessions';
    const nsmUrl = AppState.accessToken ? '/api/nsm-sessions' : '/api/guest/nsm-sessions';

    const [pmRes, nsmRes] = await Promise.all([
      fetch(pmUrl, { headers }),
      fetch(nsmUrl, { headers })
    ]);
    const pmSessions = pmRes.ok ? await pmRes.json() : [];
    const nsmSessions = nsmRes.ok ? await nsmRes.json() : [];

    const all = [
      ...pmSessions.map(s => ({ ...s, _type: 'pm' })),
      ...nsmSessions.map(s => ({ ...s, _type: 'nsm' }))
    ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    if (!all.length) {
      listEl.innerHTML = '<div style="padding:16px;color:var(--text-secondary);font-size:14px">尚無練習記錄</div>';
      return;
    }
    listEl.innerHTML = all.map(s => {
      const isNSM = s._type === 'nsm';
      const label = isNSM ? `NSM · ${s.question_json?.company || ''}` : `${s.difficulty}`;
      const badge = s.status === 'completed'
        ? (s.scores_json ? Math.round(s.scores_json.totalScore ?? s.scores_json.total ?? 0) + ' 分' : '完成')
        : '進行中';
      const badgeClass = s.status === 'completed' ? (isNSM ? 'badge-nsm' : 'badge-score') : 'badge-progress';
      return `<div class="session-item" data-id="${s.id}" data-type="${s._type}">
        <span class="session-badge ${badgeClass}">${badge}</span>
        <div class="session-info">
          <h4>${escHtml(label)}</h4>
        </div>
      </div>`;
    }).join('');

    listEl.querySelectorAll('.session-item[data-id]').forEach(item => {
      item.addEventListener('click', () => {
        const id = item.dataset.id;
        const type = item.dataset.type;
        closeOffcanvas();
        if (type === 'nsm') {
          AppState.nsmSession = { id };
          AppState.nsmStep = 4;
          navigate('nsm');
        } else {
          AppState.currentSession = { id };
          navigate('practice');
        }
      });
    });
    // Also update home recentSessions
    AppState.recentSessions = all.slice(0, 3);
  } catch (e) {
    listEl.innerHTML = `<div style="padding:16px;color:var(--text-secondary)">載入失敗</div>`;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add public/app.js
git commit -m "feat: offcanvas loads PM + NSM sessions mixed, sorted by created_at"
```

---

### Task 18: Full emoji cleanup — replace all Unicode emoji with Phosphor Icons

**Files:**
- Modify: `public/app.js`
- Modify: `public/style.css`

- [ ] **Step 1: Search for all emoji in app.js**

```bash
grep -n "[\x{1F300}-\x{1FAFF}]" public/app.js | head -50
grep -Pn "[\x{2600}-\x{26FF}]" public/app.js | head -50
```

- [ ] **Step 2: Replace common emoji with Phosphor Icons throughout app.js**

Replace these patterns systematically (use text editor find-and-replace):

| Emoji | Replacement |
|-------|-------------|
| `🌱` | `<i class="ph ph-leaf"></i>` |
| `🔥` | `<i class="ph ph-flame"></i>` |
| `⚡` | `<i class="ph ph-lightning"></i>` |
| `☰` | `<i class="ph ph-list"></i>` |
| `☀️` | `<i class="ph ph-sun"></i>` |
| `🌙` | `<i class="ph ph-moon"></i>` |
| `🏠` | `<i class="ph ph-house"></i>` |
| `📋` | `<i class="ph ph-clipboard-text"></i>` |
| `💡` | `<i class="ph ph-lightbulb"></i>` |
| `⚠️` | `<i class="ph ph-warning"></i>` |
| `✅` | `<i class="ph ph-check-circle"></i>` |
| `❌` | `<i class="ph ph-x-circle"></i>` |
| `📊` | `<i class="ph ph-chart-bar"></i>` |
| `🎯` | `<i class="ph ph-target"></i>` |
| `🔄` | `<i class="ph ph-arrow-counter-clockwise"></i>` |
| `➡️` | `<i class="ph ph-arrow-right"></i>` |
| `←` (arrow chars) | `<i class="ph ph-arrow-left"></i>` |

- [ ] **Step 3: Search for any remaining emoji**

```bash
grep -Pn "[^\x00-\x7F]" public/app.js | grep -v "//.*[^\x00-\x7F]" | head -30
```

Fix any remaining instances manually.

- [ ] **Step 4: Commit**

```bash
git add public/app.js public/style.css
git commit -m "fix: replace all emoji with Phosphor Icons throughout app.js"
```

---

## Phase 6 — Mandatory Final UI/UX Audit

### Task 19: Dispatch strict UI/UX auditor — findings are binding

**Files:**
- None directly (audit agent will flag specific files)

- [ ] **Step 1: Dispatch strict UI/UX auditor subagent**

After all previous tasks are complete, dispatch the strict UI/UX auditor using the `superpowers:code-reviewer` agent type with this prompt:

> "You are an extremely strict mobile-first UI/UX auditor. Your job is to audit the PM Drill app at `public/app.js` and `public/style.css`.
>
> Audit criteria — report every issue you find, no matter how small:
> 1. Mobile touch targets: every interactive element must be ≥44px in both dimensions
> 2. iOS keyboard: when soft keyboard opens, the chat/form input must remain visible and usable (check visualViewport + fixed positioning)
> 3. iOS Safari address bar: no layout jumping (must use dvh units, not vh)
> 4. Loading states: every API call must show feedback (disable button + spinner)
> 5. Error states: errors must be visually distinct from normal content
> 6. Empty states: every list/chat area must have guidance when empty
> 7. Horizontal overflow: no element should cause horizontal scroll on 375px width
> 8. Tab bar: must be horizontally scrollable when tabs overflow (overflow-x: auto)
> 9. All NSM wizard steps (1-4): must be usable on 375px screen without breaking layout
> 10. Dark theme: all new NSM components must look correct in dark theme
> 11. Emoji: no raw Unicode emoji should remain anywhere in the HTML output
> 12. Contrast: text must have sufficient contrast ratio in both light and dark themes
>
> For every issue found: report severity (CRITICAL/HIGH/MEDIUM/LOW), the exact file and line number, what's wrong, and exactly what to change. Your findings are binding — everything you flag will be fixed."

- [ ] **Step 2: Fix ALL issues found by the auditor**

Implement every fix flagged by the auditor. No exceptions.

- [ ] **Step 3: Commit after all auditor fixes**

```bash
git add public/app.js public/style.css
git commit -m "fix: all issues flagged by strict UI/UX auditor — mobile experience polish"
```

---

## Verification

After all tasks are complete, verify end-to-end:

1. **Mobile keyboard test:** Open app on iPhone SE (375px) or DevTools mobile emulation. Start a practice session, tap the input, verify the keyboard doesn't cover the bottom bar, and chat area remains scrollable.

2. **NSM full flow:** Home → 北極星指標 tab → 隨機抽題 → select question → define NSM (try "DAU" to trigger vanity warning) → 4-dimension breakdown → submit → view report with all 4 tabs.

3. **Touch targets:** In DevTools, inspect `.btn-icon`, `.diff-item`, `.home-tab-btn`, `.nsm-question-card`, `.tab-btn` — all must show ≥44px height.

4. **Dark theme:** Toggle dark theme, walk through home → practice → NSM report. All components must have correct contrast.

5. **Offcanvas:** Open sidebar. Verify PM and NSM sessions appear mixed, sorted by recency.

6. **No emoji:** `grep -Pn "[\x{1F300}-\x{1FAFF}]" public/app.js` must return nothing.
