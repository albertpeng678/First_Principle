# PM Drill UX Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure PM Drill so CIRCLES is the default home, remove PM訪談 entirely, unify all UI to CIRCLES blue+beige style, add navigation back buttons, AI hint system per field, and NSM entry points.

**Architecture:** Single-file SPA (`public/app.js` + `public/style.css`). All changes are isolated edits to these two files plus new backend route endpoints and a new prompt file. No new pages or routing infrastructure needed.

**Tech Stack:** Vanilla JS (ES5-compatible), Node/Express, Supabase, OpenAI gpt-4o, Phosphor Icons, DM Sans + Instrument Serif

**Spec:** `docs/superpowers/specs/2026-04-25-pm-drill-ux-overhaul-design.md`

---

## File Map

| Action | File | Change |
|--------|------|--------|
| Modify | `public/app.js` | 9 targeted edits (see tasks below) |
| Modify | `public/style.css` | Replace CSS token blocks, remove dark mode |
| Modify | `server.js` | Remove 2 PM route registrations |
| Delete | `routes/sessions.js` | PM訪談 auth routes |
| Delete | `routes/guest-sessions.js` | PM訪談 guest routes |
| Create | `db/migrations/drop-pm-interview.sql` | Manual-run Supabase cleanup |
| Modify | `routes/circles-sessions.js` | Add `/hint` endpoint |
| Modify | `routes/guest-circles-sessions.js` | Add `/hint` endpoint |
| Create | `prompts/circles-hint.js` | Hint generation prompt |

---

## Task 1: Default View → CIRCLES + Remove PM Views from render()

**Files:**
- Modify: `public/app.js`

- [ ] **Step 1: Change AppState default view from 'home' to 'circles'**

In `public/app.js` line 18, change:
```javascript
  view: 'home',
```
to:
```javascript
  view: 'circles',
```

- [ ] **Step 2: Remove PM cases from render() switch (lines 374, 377–378)**

Replace these three lines in `render()`:
```javascript
    case 'home':     main.innerHTML = renderHome(); bindHome(); break;
    case 'practice': main.innerHTML = renderPractice(); bindPractice(); break;
    case 'report':   main.innerHTML = renderReport(); bindReport(); break;
```
with nothing (delete them entirely). The switch should now only have: `login`, `register`, `history`, `nsm`, `circles`.

- [ ] **Step 3: Update init() to navigate to 'circles' instead of triggering home load**

In `init()` (~line 639), replace:
```javascript
    await loadRecentSessions();
    render();
```
with:
```javascript
    render();
```

Also in init() ~line 412–415, delete the `if (view === 'home')` block inside `navigate()`:
```javascript
  if (view === 'home') {
    render();
    await loadRecentSessions();
    if (AppState.view === 'home') render();
  } else {
    render();
  }
```
Replace with just:
```javascript
  render();
```

- [ ] **Step 4: Replace all navigate('home') calls (that aren't in dead PM code) with navigate('circles')**

Find every remaining `navigate('home')` in app.js and change to `navigate('circles')`. Key locations:
- Line 427: `onclick="navigate('home')"` in renderNavbar homeBtn — also **delete** the entire homeBtn variable and its use, since circles is always home
- Line 519: offcanvas delete handler — change to `navigate('circles')`
- Line 749: `circles-home-back` click handler — **delete** this handler entirely (circles home has no back button)
- Line 1297: `circles-score-home` click — already says 'home', change to `navigate('circles')`
- Line 1559: auth form back link `onclick="navigate('home')"` → `navigate('circles')`
- Line 2177: `btn-practice-again` click — this is in dead PM code, will be deleted in Task 2
- Line 2213: report view back button — dead PM code, deleted in Task 2
- Line 2307: history delete confirm — change to `navigate('circles')`
- Line 2845: NSM step 1/4 back — change step-1 branch to `navigate('circles')`, step-4 branch to reset NSM and `navigate('nsm')` (see Task 6)
- Line 3116: `btn-nsm-home` — change to reset NSM state and `navigate('nsm')` (see Task 6)

- [ ] **Step 5: Remove renderCirclesHome back button entirely**

In `renderCirclesHome()` (line 711–714), change the nav bar from:
```javascript
    '<div class="circles-nav">' +
      '<button class="circles-nav-back" id="circles-home-back"><i class="ph ph-arrow-left"></i></button>' +
      '<div><div class="circles-nav-title">CIRCLES 訓練</div></div>' +
    '</div>'
```
to:
```javascript
    '<div class="circles-nav">' +
      '<div><div class="circles-nav-title">CIRCLES 訓練</div></div>' +
    '</div>'
```

- [ ] **Step 6: Remove PM render/bind functions and related helpers**

Delete the following function blocks from app.js:
- `renderHome()` and `bindHome()` (lines ~1333–1516)
- `loadRecentSessions()` (lines ~1518–1535)
- `PHASE_STEPS`, `renderSteps()` (lines ~1612–1630)
- `renderPractice()`, `bindPractice()` (lines ~1632–~1882)
- `parseCoachReply()`, `submitDefinition()` (lines ~1883–1919)
- `renderReport()`, `bindReport()`, `renderRadar()`, `DIM_STATIC`, `DIM_LABELS` (lines ~1921–~2270)
- Remove from globals at bottom: `window.submitDefinition = submitDefinition;`

- [ ] **Step 7: Simplify loadOffcanvasSessions() to only load NSM sessions**

Replace the function body of `loadOffcanvasSessions()` (~line 532) to remove PM session fetching:
```javascript
async function loadOffcanvasSessions() {
  const listEl = document.getElementById('offcanvas-list');
  if (!listEl) return;
  listEl.innerHTML = '<div style="padding:16px;color:var(--text-secondary);font-size:14px">載入中…</div>';
  try {
    const headers = AppState.accessToken
      ? { 'Authorization': `Bearer ${AppState.accessToken}` }
      : { 'X-Guest-ID': AppState.guestId };
    const nsmUrl = AppState.accessToken ? '/api/nsm-sessions' : '/api/guest/nsm-sessions';
    const res = await fetch(nsmUrl, { headers });
    const sessions = res.ok ? await res.json() : [];

    if (!sessions.length) {
      listEl.innerHTML = '<div style="padding:16px;color:var(--text-secondary);font-size:14px">尚無練習記錄</div>';
      return;
    }
    listEl.innerHTML = sessions.map(s => {
      const label = `NSM · ${s.question_json?.company || ''}`;
      const date = new Date(s.created_at).toLocaleString('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      const badge = s.status === 'completed'
        ? (s.scores_json ? Math.round(s.scores_json.totalScore ?? s.scores_json.total ?? 0) + ' 分' : '完成')
        : '進行中';
      return `<div class="offcanvas-item" data-id="${s.id}" data-status="${s.status}" data-type="nsm" style="position:relative">
        <div style="display:flex;align-items:center;gap:6px;padding-right:28px">
          <span class="badge badge-nsm">${badge}</span>
          <span style="font-size:0.8rem;color:var(--text-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(label)}</span>
        </div>
        <div style="font-size:0.75rem;color:var(--text-secondary);margin-top:4px">${date}</div>
        <button class="btn-icon offcanvas-delete-btn" title="刪除" style="position:absolute;top:6px;right:4px;font-size:1rem;padding:2px 6px" data-id="${s.id}" data-type="nsm">
          <i class="ph ph-trash"></i>
        </button>
      </div>`;
    }).join('');

    listEl.querySelectorAll('.offcanvas-item').forEach(item => {
      item.addEventListener('click', async () => {
        closeOffcanvas();
        AppState.nsmSession = { id: item.dataset.id };
        AppState.nsmStep = 4;
        navigate('nsm');
      });
    });
    attachOffcanvasDeleteListeners(listEl);
  } catch (_) {
    listEl.innerHTML = '<div style="padding:16px;color:var(--text-secondary)">載入失敗</div>';
  }
}
```

- [ ] **Step 8: Commit**
```bash
git add public/app.js
git commit -m "feat: set CIRCLES as default view, remove PM訪談 render/bind functions"
```

---

## Task 2: Remove PM Routes from Server

**Files:**
- Modify: `server.js`
- Delete: `routes/sessions.js`, `routes/guest-sessions.js`
- Create: `db/migrations/drop-pm-interview.sql`

- [ ] **Step 1: Remove PM route registrations from server.js**

In `server.js`, delete lines 12–13:
```javascript
app.use('/api/sessions', require('./routes/sessions'));
app.use('/api/guest/sessions', require('./routes/guest-sessions'));
```

- [ ] **Step 2: Delete the PM route files**
```bash
rm routes/sessions.js routes/guest-sessions.js
```

- [ ] **Step 3: Create migration SQL file**

Create `db/migrations/drop-pm-interview.sql`:
```sql
-- Drop PM Interview tables
-- Run manually in Supabase SQL editor after confirming no active users need this data.
DROP TABLE IF EXISTS practice_sessions;
DROP TABLE IF EXISTS guest_sessions;
```

- [ ] **Step 4: Verify server starts without errors**
```bash
node server.js &
sleep 2
curl -s http://localhost:3000/health
# Expected: {"ok":true}
kill %1
```

- [ ] **Step 5: Commit**
```bash
git add server.js db/migrations/drop-pm-interview.sql
git rm routes/sessions.js routes/guest-sessions.js
git commit -m "feat: remove PM訪談 routes, add migration SQL for table cleanup"
```

---

## Task 3: CSS Global Style Unification + Remove Dark Mode

**Files:**
- Modify: `public/style.css`

- [ ] **Step 1: Replace the entire `:root` / dark theme block (lines 1–39) with single light theme**

Delete lines 1–39 (the combined `:root,[data-theme="dark"]` block and the `[data-theme="light"]` block) and replace with:
```css
:root {
  --bg-primary: #F2F0EB;
  --bg-surface: #ffffff;
  --bg-surface-2: #f0ede6;
  --text-primary: #1a1a1a;
  --text-secondary: #5a5a5a;
  --text-tertiary: rgba(0,0,0,0.35);
  --accent: #1A56DB;
  --accent-hover: #1446b8;
  --success: #137A3D;
  --warning: #B85C00;
  --danger: #D92020;
  --border: #e8e5de;
  --shadow: 0 4px 24px rgba(0,0,0,0.08);
  --bubble-user-bg: #1A56DB;
  --bubble-user-text: #ffffff;
  --bubble-ai-bg: #f0ede6;
  --bubble-ai-text: #1a1a1a;
}
```

- [ ] **Step 2: Search for any remaining `[data-theme="dark"]` blocks in style.css and delete them**

Run:
```bash
grep -n 'data-theme' public/style.css
```
Delete every CSS block that starts with `[data-theme="dark"]`. There should be none left after Step 1, but confirm.

- [ ] **Step 3: Remove applyTheme() and AppState.theme from app.js**

In `public/app.js`:
- Delete `applyTheme()` function (lines 362–366)
- Delete `AppState.theme` property (line 17: `theme: localStorage.getItem('theme') || 'light',`)
- Delete `window.applyTheme = applyTheme;` from the globals section (~line 650)
- In `init()`, delete `applyTheme(AppState.theme);` (~line 612)

- [ ] **Step 4: Verify the app looks correct visually**
```bash
node server.js &
```
Open http://localhost:3000 and confirm: warm beige background (`#F2F0EB`), blue primary (`#1A56DB`), no dark mode toggle.

- [ ] **Step 5: Commit**
```bash
git add public/style.css public/app.js
git commit -m "feat: unify global CSS to CIRCLES blue+beige theme, remove dark mode"
```

---

## Task 4: Navbar — NSM Link + Remove Theme Toggle

**Files:**
- Modify: `public/app.js` — `renderNavbar()` function (lines 421–450)

- [ ] **Step 1: Rewrite renderNavbar() to remove theme toggle and add NSM link**

Replace the entire `renderNavbar()` function with:
```javascript
function renderNavbar() {
  const el = document.getElementById('navbar-actions');
  const nsmLink = `<button class="btn btn-ghost" onclick="navigate('nsm')" style="font-size:13px;font-weight:500">北極星指標</button>`;

  if (AppState.mode === 'auth') {
    el.innerHTML = `
      ${nsmLink}
      <span class="navbar-email" title="${AppState.user?.email || ''}">${AppState.user?.email || ''}</span>
      <button class="btn-icon" id="btn-logout" aria-label="登出" title="登出"><i class="ph ph-sign-out"></i></button>
    `;
    document.getElementById('btn-logout')?.addEventListener('click', () => supabase.auth.signOut());
  } else if (AppState.mode === 'guest') {
    el.innerHTML = `
      ${nsmLink}
      <button class="btn btn-ghost" onclick="navigate('login')">登入</button>
    `;
  } else {
    el.innerHTML = '';
  }

  const hamburger = document.getElementById('btn-hamburger');
  if (hamburger) hamburger.onclick = openOffcanvas;
}
```

- [ ] **Step 2: Update navbar-logo link in index.html to navigate to circles**

In `public/index.html`, find the navbar logo element and ensure clicking it calls `navigate('circles')` instead of `navigate('home')`. Search for:
```bash
grep -n "navigate.*home\|navbar-logo" public/index.html
```
Update any `navigate('home')` to `navigate('circles')`.

- [ ] **Step 3: Verify NSM link appears in header and theme toggle is gone**
Open http://localhost:3000 — confirm header shows "北極星指標" link, no moon icon.

- [ ] **Step 4: Commit**
```bash
git add public/app.js public/index.html
git commit -m "feat: add NSM link to navbar, remove theme toggle"
```

---

## Task 5: Navigation — 回首頁 Button in All CIRCLES Training Phases

**Files:**
- Modify: `public/app.js`

- [ ] **Step 1: Add CSS class for the home button to style.css**

In `public/style.css`, find the `.circles-nav` block (~line 1194+) and add:
```css
.circles-nav-home-btn {
  font-size: 12px;
  color: var(--c-primary, #1A56DB);
  border-bottom: 1px solid var(--c-primary, #1A56DB);
  background: none;
  border-top: none;
  border-left: none;
  border-right: none;
  padding: 2px 0;
  cursor: pointer;
  font-family: 'DM Sans', sans-serif;
  white-space: nowrap;
  flex-shrink: 0;
}
```

- [ ] **Step 2: Add 回首頁 button to renderCirclesPhase1() nav bar**

In `renderCirclesPhase1()`, replace (lines 829–835):
```javascript
  return '<div data-view="circles">' +
    '<div class="circles-nav">' +
      '<button class="circles-nav-back" id="circles-p1-back"><i class="ph ph-arrow-left"></i></button>' +
      '<div>' +
        '<div class="circles-nav-title">' + step.label + '</div>' +
        '<div class="circles-nav-sub">' + q.company + ' · ' + (q.product || '') + '</div>' +
      '</div>' +
    '</div>' +
```
with:
```javascript
  return '<div data-view="circles">' +
    '<div class="circles-nav">' +
      '<button class="circles-nav-back" id="circles-p1-back"><i class="ph ph-arrow-left"></i></button>' +
      '<div>' +
        '<div class="circles-nav-title">' + step.label + '</div>' +
        '<div class="circles-nav-sub">' + q.company + ' · ' + (q.product || '') + '</div>' +
      '</div>' +
      '<button class="circles-nav-home-btn" id="circles-p1-home">回首頁</button>' +
    '</div>' +
```

In `bindCirclesPhase1()`, add after the existing back listener:
```javascript
  document.getElementById('circles-p1-home')?.addEventListener('click', function() {
    AppState.circlesSelectedQuestion = null;
    AppState.circlesPhase = 1;
    navigate('circles');
  });
```

- [ ] **Step 3: Add 回首頁 button to renderCirclesGate() nav bar**

In `renderCirclesGate()`, replace the non-loading nav bar (line 978–985):
```javascript
  return '<div data-view="circles">' +
    '<div class="circles-nav">' +
      '<button class="circles-nav-back" id="circles-gate-back"><i class="ph ph-arrow-left"></i></button>' +
      '<div>' +
        '<div class="circles-nav-title">框架審核結果</div>' +
        '<div class="circles-nav-sub">' + step.label + ' · ' + (q ? q.company : '') + '</div>' +
      '</div>' +
    '</div>' +
```
with:
```javascript
  return '<div data-view="circles">' +
    '<div class="circles-nav">' +
      '<button class="circles-nav-back" id="circles-gate-back"><i class="ph ph-arrow-left"></i></button>' +
      '<div>' +
        '<div class="circles-nav-title">框架審核結果</div>' +
        '<div class="circles-nav-sub">' + step.label + ' · ' + (q ? q.company : '') + '</div>' +
      '</div>' +
      '<button class="circles-nav-home-btn" id="circles-gate-home">回首頁</button>' +
    '</div>' +
```

In `bindCirclesGate()`, add:
```javascript
  document.getElementById('circles-gate-home')?.addEventListener('click', function() {
    AppState.circlesSelectedQuestion = null;
    AppState.circlesPhase = 1;
    navigate('circles');
  });
```

- [ ] **Step 4: Add 回首頁 button to renderCirclesPhase2() nav bar**

In `renderCirclesPhase2()`, replace (lines 1044–1051):
```javascript
  return '<div data-view="circles" class="circles-chat-wrap">' +
    '<div class="circles-nav">' +
      '<button class="circles-nav-back" id="circles-p2-back"><i class="ph ph-arrow-left"></i></button>' +
      '<div>' +
        '<div class="circles-nav-title">' + step.label + ' — 對話練習</div>' +
        '<div class="circles-nav-sub">' + (q ? q.company : '') + '</div>' +
      '</div>' +
      (turnCount > 0 ? '<div class="circles-nav-right">' + turnCount + ' 輪</div>' : '') +
    '</div>' +
```
with:
```javascript
  return '<div data-view="circles" class="circles-chat-wrap">' +
    '<div class="circles-nav">' +
      '<button class="circles-nav-back" id="circles-p2-back"><i class="ph ph-arrow-left"></i></button>' +
      '<div>' +
        '<div class="circles-nav-title">' + step.label + ' — 對話練習</div>' +
        '<div class="circles-nav-sub">' + (q ? q.company : '') + '</div>' +
      '</div>' +
      '<button class="circles-nav-home-btn" id="circles-p2-home">回首頁</button>' +
    '</div>' +
```

In `bindCirclesPhase2()`, add after the existing back listener (~line 1063):
```javascript
  document.getElementById('circles-p2-home')?.addEventListener('click', function() {
    AppState.circlesSelectedQuestion = null;
    AppState.circlesPhase = 1;
    AppState.circlesConversation = [];
    navigate('circles');
  });
```

- [ ] **Step 5: Add 回首頁 button to renderCirclesStepScore() nav bar**

In `renderCirclesStepScore()`, replace (lines 1250–1255):
```javascript
  return '<div data-view="circles">' +
    '<div class="circles-nav">' +
      '<button class="circles-nav-back" id="circles-score-back"><i class="ph ph-arrow-left"></i></button>' +
      '<div>' +
        '<div class="circles-nav-title">步驟評分 — ' + step.label + '</div>' +
        '<div class="circles-nav-sub">' + (q ? q.company : '') + '</div>' +
      '</div>' +
    '</div>' +
```
with:
```javascript
  return '<div data-view="circles">' +
    '<div class="circles-nav">' +
      '<button class="circles-nav-back" id="circles-score-back"><i class="ph ph-arrow-left"></i></button>' +
      '<div>' +
        '<div class="circles-nav-title">步驟評分 — ' + step.label + '</div>' +
        '<div class="circles-nav-sub">' + (q ? q.company : '') + '</div>' +
      '</div>' +
      '<button class="circles-nav-home-btn" id="circles-score-home-btn">回首頁</button>' +
    '</div>' +
```

Note: the existing `id="circles-score-home"` is on a button in the submit bar area (line 1270). The new nav-bar button uses `id="circles-score-home-btn"` to avoid conflict. In `bindCirclesStepScore()`, both the existing `circles-score-home` and new `circles-score-home-btn` should navigate to circles:
```javascript
  document.getElementById('circles-score-home-btn')?.addEventListener('click', function() {
    AppState.circlesSelectedQuestion = null;
    AppState.circlesPhase = 1;
    navigate('circles');
  });
  // Existing circles-score-home (submit bar) - update to navigate('circles')
  document.getElementById('circles-score-home')?.addEventListener('click', function() {
    AppState.circlesSelectedQuestion = null;
    AppState.circlesPhase = 1;
    navigate('circles');
  });
```

- [ ] **Step 6: Commit**
```bash
git add public/app.js public/style.css
git commit -m "feat: add 回首頁 button to all CIRCLES training phases"
```

---

## Task 6: Navigation — NSM 回首頁 Fix

**Files:**
- Modify: `public/app.js`

- [ ] **Step 1: Update bindNSM() back button logic for step 1 and step 4**

In `bindNSM()` at line 2844–2847, replace:
```javascript
  document.getElementById('btn-nsm-back')?.addEventListener('click', () => {
    if (AppState.nsmStep === 1 || AppState.nsmStep === 4) navigate('home');
    else { AppState.nsmStep--; render(); }
  });
```
with:
```javascript
  document.getElementById('btn-nsm-back')?.addEventListener('click', () => {
    if (AppState.nsmStep === 1) {
      navigate('circles');
    } else if (AppState.nsmStep === 4) {
      AppState.nsmStep = 1;
      AppState.nsmSession = null;
      AppState.nsmSelectedQuestion = null;
      AppState.nsmNsmDraft = '';
      AppState.nsmBreakdownDraft = {};
      AppState.nsmVanityWarning = null;
      navigate('nsm');
    } else {
      AppState.nsmStep--;
      render();
    }
  });
```

- [ ] **Step 2: Add 回首頁 button to NSM step navbars (steps 2, 3)**

In `renderNSMStep2()`, find the nsm-navbar div:
```javascript
      <div class="nsm-navbar">
        <button class="btn-icon" id="btn-nsm-back" aria-label="返回上一步"><i class="ph ph-arrow-left"></i></button>
        <span class="nsm-title">定義 NSM</span>
        <div class="nsm-navbar-spacer"></div>
      </div>
```
Replace `<div class="nsm-navbar-spacer"></div>` with:
```html
<button id="btn-nsm-home-step2" style="font-size:12px;color:var(--accent);border-bottom:1px solid var(--accent);background:none;border-top:none;border-left:none;border-right:none;padding:2px 0;cursor:pointer;font-family:DM Sans,sans-serif;white-space:nowrap;flex-shrink:0">回首頁</button>
```

Do the same for `renderNSMStep3()` navbar, using id `btn-nsm-home-step3`.

- [ ] **Step 3: Update btn-nsm-home in Step 4 report**

In `bindNSM()` at line 3116, replace:
```javascript
  document.getElementById('btn-nsm-home')?.addEventListener('click', function() { navigate('home'); });
```
with:
```javascript
  document.getElementById('btn-nsm-home')?.addEventListener('click', function() {
    AppState.nsmStep = 1;
    AppState.nsmSession = null;
    AppState.nsmSelectedQuestion = null;
    AppState.nsmNsmDraft = '';
    AppState.nsmBreakdownDraft = {};
    AppState.nsmVanityWarning = null;
    navigate('nsm');
  });
```

- [ ] **Step 4: Bind the new step 2/3 home buttons in bindNSM()**

In `bindNSM()`, add after the existing `btn-nsm-again` listener block:
```javascript
  var _resetNsm = function() {
    AppState.nsmStep = 1;
    AppState.nsmSession = null;
    AppState.nsmSelectedQuestion = null;
    AppState.nsmNsmDraft = '';
    AppState.nsmBreakdownDraft = {};
    AppState.nsmVanityWarning = null;
    navigate('nsm');
  };
  document.getElementById('btn-nsm-home-step2')?.addEventListener('click', _resetNsm);
  document.getElementById('btn-nsm-home-step3')?.addEventListener('click', _resetNsm);
```

- [ ] **Step 5: Commit**
```bash
git add public/app.js
git commit -m "feat: fix NSM navigation — step 1 back→circles, step 4 home→NSM step 1"
```

---

## Task 7: NSM Entry Points (Banner + S Step Annotation)

**Files:**
- Modify: `public/app.js`

- [ ] **Step 1: Add NSM banner to renderCirclesHome()**

In `renderCirclesHome()`, after the `</div>` closing `circles-q-list` div and before the final closing `</div>`, add the banner. Find line 739–741:
```javascript
      '<div class="circles-q-list">' + (qCards || '<div style="color:var(--c-text-3);...">暫無題目...</div>') + '</div>' +
    '</div>' +
  '</div>';
```
Change to:
```javascript
      '<div class="circles-q-list">' + (qCards || '<div style="color:var(--c-text-3);font-size:13px;text-align:center;padding:24px 0">暫無題目，請先執行題庫生成腳本</div>') + '</div>' +
      '<div style="background:#EEF3FF;border:1px solid #C5D5FF;border-radius:10px;padding:14px 16px;display:flex;align-items:center;justify-content:space-between;margin-top:16px">' +
        '<div>' +
          '<div style="font-size:12px;color:#1A56DB;font-weight:600;margin-bottom:2px;font-family:DM Sans,sans-serif">S 步驟含北極星指標練習</div>' +
          '<div style="font-size:12px;color:#5a7ab5;font-family:DM Sans,sans-serif">想做最完整的 NSM 定義訓練？</div>' +
        '</div>' +
        '<button id="circles-nsm-banner-btn" style="background:#1A56DB;color:#fff;border:none;padding:7px 12px;border-radius:8px;font-size:12px;font-weight:600;white-space:nowrap;cursor:pointer;font-family:DM Sans,sans-serif">前往 NSM →</button>' +
      '</div>' +
    '</div>' +
  '</div>';
```

In `bindCirclesHome()`, add:
```javascript
  document.getElementById('circles-nsm-banner-btn')?.addEventListener('click', function() {
    navigate('nsm');
  });
```

- [ ] **Step 2: Add S step annotation to renderCirclesPhase1()**

In `renderCirclesPhase1()`, after the `fields` variable is built (~line 827), add S-step annotation above the fields. Find:
```javascript
    '<div class="circles-phase1-wrap">' +
      '<div style="font-size:13px;color:var(--c-text-2,#5a5a5a);line-height:1.6;margin-bottom:16px;...>' + q.problem_statement + '</div>' +
      fields +
    '</div>' +
```
Change to:
```javascript
    '<div class="circles-phase1-wrap">' +
      '<div style="font-size:13px;color:var(--c-text-2,#5a5a5a);line-height:1.6;margin-bottom:16px;font-family:DM Sans,sans-serif;padding:12px 14px;background:#fff;border-radius:10px;border:1px solid rgba(0,0,0,0.08)">' + q.problem_statement + '</div>' +
      (stepKey === 'S' ? '<div style="background:#EEF3FF;border:1px solid #C5D5FF;border-radius:10px;padding:12px 14px;margin-bottom:16px;font-size:13px;color:#1A56DB;font-family:DM Sans,sans-serif;line-height:1.6">此步驟的北極星指標欄位是 NSM 訓練的濃縮版。想深入練習？<button id="circles-s-nsm-link" style="background:none;border:none;color:#1A56DB;font-size:13px;cursor:pointer;text-decoration:underline;font-family:DM Sans,sans-serif;padding:0">前往 NSM 訓練 →</button></div>' : '') +
      fields +
    '</div>' +
```

In `bindCirclesPhase1()`, add:
```javascript
  document.getElementById('circles-s-nsm-link')?.addEventListener('click', function() {
    navigate('nsm');
  });
```

- [ ] **Step 3: Commit**
```bash
git add public/app.js
git commit -m "feat: add NSM banner to CIRCLES home, S step annotation"
```

---

## Task 8: AI Hint Backend — circles-hint.js + /hint Endpoints

**Files:**
- Create: `prompts/circles-hint.js`
- Modify: `routes/circles-sessions.js`
- Modify: `routes/guest-circles-sessions.js`

- [ ] **Step 1: Create prompts/circles-hint.js**

```javascript
// prompts/circles-hint.js
const OpenAI = require('openai');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const STEP_LABELS = {
  C1: '澄清情境', I: '定義用戶', R: '發掘需求',
  C2: '優先排序', L: '提出方案', E: '評估取捨', S: '總結推薦'
};

async function generateCirclesHint(questionJson, step, field) {
  const stepLabel = STEP_LABELS[step] || step;
  const prompt = `你是一位 PM 面試教練，正在協助學生練習 CIRCLES Method 框架。

題目公司：${questionJson.company}
題目產品：${questionJson.product || questionJson.company}
題目情境：${questionJson.problem_statement}

學生正在填寫「${stepLabel}」步驟中的「${field}」欄位。

請給出 60-100 字的分析思路引導，要求：
1. 針對上方這個具體題目，不要給通用建議
2. 解釋如何思考這個欄位，不要直接給出答案
3. 最後一句說明為什麼這個欄位的判斷會影響後續的 CIRCLES 步驟
4. 語氣溫暖清楚，像教練在側邊引導
5. 純中文，不使用 Markdown 格式，只輸出引導文字本身`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 200,
    temperature: 0.7,
  });

  return completion.choices[0].message.content.trim();
}

module.exports = { generateCirclesHint };
```

- [ ] **Step 2: Add /hint endpoint to routes/circles-sessions.js**

At the top of `routes/circles-sessions.js`, add import after existing imports:
```javascript
const { generateCirclesHint } = require('../prompts/circles-hint');
```

Before `module.exports = router;`, add:
```javascript
// POST /api/circles-sessions/:id/hint
router.post('/:id/hint', requireAuth, async (req, res) => {
  const { step, field } = req.body;
  if (!step || !field) return res.status(400).json({ error: 'missing_fields' });
  try {
    const { data, error } = await db
      .from('circles_sessions')
      .select('question_json')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single();
    if (error || !data) return res.status(404).json({ error: 'session_not_found' });
    const hint = await generateCirclesHint(data.question_json, step, field);
    res.json({ hint });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
```

- [ ] **Step 3: Add /hint endpoint to routes/guest-circles-sessions.js**

Read `routes/guest-circles-sessions.js` to understand its auth pattern (uses `req.guestId` from X-Guest-ID header), then add the same hint endpoint using guest auth:

At the top, add:
```javascript
const { generateCirclesHint } = require('../prompts/circles-hint');
```

Before `module.exports = router;`, add:
```javascript
// POST /api/guest-circles-sessions/:id/hint
router.post('/:id/hint', async (req, res) => {
  const { step, field } = req.body;
  if (!step || !field) return res.status(400).json({ error: 'missing_fields' });
  const guestId = req.headers['x-guest-id'];
  if (!guestId) return res.status(401).json({ error: 'missing_guest_id' });
  try {
    const { data, error } = await db
      .from('circles_sessions')
      .select('question_json')
      .eq('id', req.params.id)
      .eq('guest_id', guestId)
      .single();
    if (error || !data) return res.status(404).json({ error: 'session_not_found' });
    const hint = await generateCirclesHint(data.question_json, step, field);
    res.json({ hint });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
```

- [ ] **Step 4: Verify hint endpoint works**
```bash
node server.js &
# Test requires a real session ID — just check 400 on missing fields:
curl -s -X POST http://localhost:3000/api/guest-circles-sessions/fake-id/hint \
  -H "Content-Type: application/json" \
  -H "X-Guest-ID: test-guest" \
  -d '{}'
# Expected: {"error":"missing_fields"}
kill %1
```

- [ ] **Step 5: Commit**
```bash
git add prompts/circles-hint.js routes/circles-sessions.js routes/guest-circles-sessions.js
git commit -m "feat: add AI hint endpoint for CIRCLES step fields"
```

---

## Task 9: AI Hint Frontend — 💡 Buttons + Overlay

**Files:**
- Modify: `public/app.js`
- Modify: `public/style.css`

- [ ] **Step 1: Add hint overlay CSS to style.css**

In `public/style.css`, inside the `[data-view="circles"]` section (or at the end of the CIRCLES CSS block), add:
```css
/* Hint overlay */
.circles-hint-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.45);
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}
.circles-hint-card {
  background: #fff;
  border-radius: 16px;
  padding: 20px;
  max-width: 480px;
  width: 100%;
  box-shadow: 0 8px 40px rgba(0,0,0,0.18);
  position: relative;
}
.circles-hint-card-title {
  font-size: 13px;
  font-weight: 700;
  color: #1A56DB;
  margin-bottom: 4px;
  font-family: 'DM Sans', sans-serif;
}
.circles-hint-card-sub {
  font-size: 12px;
  color: #8a8a8a;
  margin-bottom: 12px;
  font-family: 'DM Sans', sans-serif;
}
.circles-hint-card-body {
  font-size: 14px;
  color: #1a1a1a;
  line-height: 1.7;
  background: #F6F8FF;
  border-left: 3px solid #1A56DB;
  padding: 12px;
  border-radius: 0 8px 8px 0;
  font-family: 'DM Sans', sans-serif;
}
.circles-hint-card-footer {
  font-size: 12px;
  color: #aaa;
  text-align: center;
  margin-top: 12px;
  font-family: 'DM Sans', sans-serif;
}
.circles-hint-close {
  position: absolute;
  top: 12px;
  right: 14px;
  background: none;
  border: none;
  font-size: 20px;
  color: #aaa;
  cursor: pointer;
  line-height: 1;
  padding: 0;
}
.circles-hint-loading {
  text-align: center;
  padding: 24px;
  font-size: 13px;
  color: #5a5a5a;
  font-family: 'DM Sans', sans-serif;
}
```

- [ ] **Step 2: Add 💡 buttons to each field in renderCirclesPhase1()**

In `renderCirclesPhase1()`, update the `fields` map (~line 821–827). Replace:
```javascript
  var fields = step.fields.map(function(field, i) {
    var hint = (!isSimulation && CIRCLES_STEP_HINTS[stepKey]) ? CIRCLES_STEP_HINTS[stepKey][i] : '';
    return '<div class="circles-field-group">' +
      '<div class="circles-field-label">' + field + '</div>' +
      (hint ? '<div class="circles-field-hint">例：' + hint + '</div>' : '') +
      '<textarea class="circles-field-input" data-field="' + field + '" rows="2" placeholder="' + (isSimulation ? '' : '填寫你的分析...') + '">' + (draft[field] || '') + '</textarea>' +
    '</div>';
  }).join('');
```
with:
```javascript
  var fields = step.fields.map(function(field, i) {
    var hint = (!isSimulation && CIRCLES_STEP_HINTS[stepKey]) ? CIRCLES_STEP_HINTS[stepKey][i] : '';
    var hintBtn = '<button class="circles-hint-trigger" data-step="' + stepKey + '" data-field="' + field + '" type="button">💡 提示</button>';
    return '<div class="circles-field-group">' +
      '<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:2px">' +
        '<div class="circles-field-label" style="margin-bottom:0">' + field + '</div>' +
        hintBtn +
      '</div>' +
      (hint ? '<div class="circles-field-hint">例：' + hint + '</div>' : '') +
      '<textarea class="circles-field-input" data-field="' + field + '" rows="2" placeholder="' + (isSimulation ? '' : '填寫你的分析...') + '">' + (draft[field] || '') + '</textarea>' +
    '</div>';
  }).join('');
```

- [ ] **Step 3: Add CSS for .circles-hint-trigger button**

In `style.css`, add:
```css
.circles-hint-trigger {
  background: none;
  border: none;
  font-size: 12px;
  color: #1A56DB;
  cursor: pointer;
  padding: 0;
  font-family: 'DM Sans', sans-serif;
  white-space: nowrap;
  flex-shrink: 0;
}
```

- [ ] **Step 4: Add showCirclesHint() function and overlay logic to app.js**

In `public/app.js`, before `window.navigate = navigate;` (~line 648), add:
```javascript
async function showCirclesHint(step, field) {
  var q = AppState.circlesSelectedQuestion;
  var session = AppState.circlesSession;
  if (!q || !session) return;

  // Show overlay with loading state
  var overlay = document.createElement('div');
  overlay.className = 'circles-hint-overlay';
  overlay.id = 'circles-hint-overlay';
  overlay.innerHTML = '<div class="circles-hint-card">' +
    '<button class="circles-hint-close" id="circles-hint-close-btn">×</button>' +
    '<div class="circles-hint-card-title">💡 ' + field + ' — 分析思路</div>' +
    '<div class="circles-hint-card-sub">' + q.company + ' · ' + (q.product || '') + ' · ' + step + '</div>' +
    '<div class="circles-hint-loading" id="circles-hint-body"><i class="ph ph-circle-notch" style="animation:spin 0.8s linear infinite;display:inline-block;margin-right:6px"></i>生成中…</div>' +
  '</div>';
  document.body.appendChild(overlay);

  document.getElementById('circles-hint-close-btn').addEventListener('click', function() {
    overlay.remove();
  });
  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) overlay.remove();
  });

  // Fetch hint
  try {
    var headers = { 'Content-Type': 'application/json' };
    if (AppState.accessToken) headers['Authorization'] = 'Bearer ' + AppState.accessToken;
    else headers['X-Guest-ID'] = AppState.guestId;
    var baseUrl = AppState.accessToken
      ? '/api/circles-sessions/' + session.id + '/hint'
      : '/api/guest-circles-sessions/' + session.id + '/hint';
    var res = await fetch(baseUrl, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({ step: step, field: field })
    });
    var data = await res.json();
    var bodyEl = document.getElementById('circles-hint-body');
    if (!bodyEl) return; // overlay was closed
    if (!res.ok) throw new Error(data.error);
    bodyEl.outerHTML = '<div class="circles-hint-card-body">' + escHtml(data.hint) + '</div>' +
      '<div class="circles-hint-card-footer">閱讀後關閉，自行填寫你的分析</div>';
  } catch (e) {
    var bodyEl2 = document.getElementById('circles-hint-body');
    if (bodyEl2) bodyEl2.textContent = '生成失敗，請重試';
  }
}
window.showCirclesHint = showCirclesHint;
```

- [ ] **Step 5: Bind 💡 buttons in bindCirclesPhase1()**

In `bindCirclesPhase1()`, add after the textarea input listeners:
```javascript
  document.querySelectorAll('.circles-hint-trigger').forEach(function(btn) {
    btn.addEventListener('click', function() {
      showCirclesHint(btn.dataset.step, btn.dataset.field);
    });
  });
```

- [ ] **Step 6: Verify overlay appears and closes correctly**

Start server, open app, navigate to CIRCLES → select question → Phase 1. Click a 💡 button. Expect:
- Overlay appears with loading spinner
- After ~2s, hint text appears (contextual to the question)
- Click × or outside → overlay closes
- Form is still intact underneath

- [ ] **Step 7: Commit**
```bash
git add public/app.js public/style.css
git commit -m "feat: add 💡 per-field AI hint system with overlay to CIRCLES Phase 1"
```

---

## Task 10: Playwright UIUX Audit

**Files:**
- Read: `docs/superpowers/plans/2026-04-22-mobile-smoothness.md` before starting — all criteria in that doc apply here
- Modify: `tests/` — add or update Playwright test files

All verification in this task MUST use Playwright browser automation (via Playwright MCP tools). No manual-only checks.

- [ ] **Step 1: Run existing Playwright test suite and fix any regressions**

```bash
npx playwright test --reporter=list 2>&1 | tail -50
```

Fix any failing tests caused by the IA changes (views renamed, PM routes gone, `navigate('home')` → `navigate('circles')`).

- [ ] **Step 2: Verify PM routes return 404 via Playwright**

Write a Playwright test that confirms:
```typescript
// tests/pm-routes-removed.spec.ts
import { test, expect } from '@playwright/test';
test('PM routes return 404', async ({ request }) => {
  const r1 = await request.get('/api/sessions');
  expect(r1.status()).toBe(404);
  const r2 = await request.get('/api/guest/sessions');
  expect(r2.status()).toBe(404);
});
```

Run: `npx playwright test tests/pm-routes-removed.spec.ts`

- [ ] **Step 3: RWD audit at all 5 breakpoints via Playwright**

For each breakpoint — 320px, 375px, 430px, 768px, 1280px — use Playwright to navigate to the app and take a screenshot, then assert no horizontal scrollbar and no element overflow:

```typescript
// tests/rwd-audit.spec.ts
import { test, expect } from '@playwright/test';
const BREAKPOINTS = [320, 375, 430, 768, 1280];
for (const width of BREAKPOINTS) {
  test(`RWD: no overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 812 });
    await page.goto('http://localhost:3000');
    // Check no horizontal scrollbar
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(width + 1);
    // Check no console errors
    const errors: string[] = [];
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    await page.waitForTimeout(500);
    expect(errors).toHaveLength(0);
    await page.screenshot({ path: `test-results/rwd-${width}.png` });
  });
}
```

Run: `npx playwright test tests/rwd-audit.spec.ts`

- [ ] **Step 4: User journey tests via Playwright**

Write and run Playwright tests for all 9 journeys:

```typescript
// tests/user-journeys.spec.ts
import { test, expect } from '@playwright/test';

test('J1: Guest → CIRCLES → Phase 1 → Phase 2 → Score → 回首頁', async ({ page }) => {
  await page.goto('http://localhost:3000');
  // App lands on CIRCLES selection (not a tabbed homepage)
  await expect(page.locator('[data-view="circles"]')).toBeVisible();
  // Select mode, step, question, fill Phase 1, submit, navigate through phases, click 回首頁
  // ... (fill in each interaction step)
  await expect(page.locator('[data-view="circles"]')).toBeVisible();
});

test('J2: Guest → click 北極星指標 → NSM selection screen', async ({ page }) => {
  await page.goto('http://localhost:3000');
  await page.click('button:has-text("北極星指標")');
  await expect(page.locator('[data-view="nsm"]')).toBeVisible();
});

test('J3: NSM complete → 回首頁 → back at NSM step 1', async ({ page }) => {
  await page.goto('http://localhost:3000');
  await page.click('button:has-text("北極星指標")');
  // Complete NSM session, click 回首頁, confirm NSM step 1 shown
});

test('J4: CIRCLES NSM banner → navigate to NSM', async ({ page }) => {
  await page.goto('http://localhost:3000');
  await page.click('button:has-text("前往 NSM")');
  await expect(page.locator('[data-view="nsm"]')).toBeVisible();
});

test('J5: CIRCLES Phase 2 → 回首頁 → CIRCLES selection', async ({ page }) => {
  // Navigate to Phase 2, click 回首頁
});

test('J6: Guest → 登入 → back link → CIRCLES selection', async ({ page }) => {
  await page.goto('http://localhost:3000');
  await page.click('button:has-text("登入")');
  await page.click('a[onclick*="circles"], button[onclick*="circles"]');
  await expect(page.locator('[data-view="circles"]')).toBeVisible();
});

test('J7: 💡 hint overlay opens and closes', async ({ page }) => {
  // Navigate to Phase 1, click 💡, confirm overlay, close, confirm form intact
});

test('J8: History page renders, back returns to CIRCLES', async ({ page }) => {
  await page.goto('http://localhost:3000');
  // Open offcanvas or navigate to history, verify items render, back → circles
});

test('J9: Offcanvas open/close', async ({ page }) => {
  await page.goto('http://localhost:3000');
  await page.click('#btn-hamburger');
  await expect(page.locator('.offcanvas')).toBeVisible();
  await page.click('.offcanvas-overlay');
  await expect(page.locator('.offcanvas')).not.toBeVisible();
});
```

Run: `npx playwright test tests/user-journeys.spec.ts --reporter=list`

Fix any failures before proceeding.

- [ ] **Step 5: Tap target size audit via Playwright**

```typescript
// tests/tap-targets.spec.ts
import { test, expect } from '@playwright/test';
test('All buttons meet 44×44px tap target', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('http://localhost:3000');
  const violations = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('button, a, [role="button"]'))
      .filter(el => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && (r.width < 44 || r.height < 44);
      })
      .map(el => ({ text: el.textContent?.trim().slice(0, 40), w: Math.round(el.getBoundingClientRect().width), h: Math.round(el.getBoundingClientRect().height) }));
  });
  if (violations.length) console.log('Tap target violations:', JSON.stringify(violations, null, 2));
  expect(violations).toHaveLength(0);
});
```

Run: `npx playwright test tests/tap-targets.spec.ts`

For any violation found: fix the element's CSS min-width/min-height/padding, then re-run until clean.

- [ ] **Step 6: Console error audit via Playwright across all views**

```typescript
// tests/console-errors.spec.ts
import { test, expect } from '@playwright/test';
const VIEWS = ['/', '/?view=nsm', '/?view=login', '/?view=history'];
for (const path of VIEWS) {
  test(`No console errors on ${path}`, async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', err => errors.push(err.message));
    await page.goto(`http://localhost:3000${path}`);
    await page.waitForTimeout(1000);
    expect(errors).toHaveLength(0);
  });
}
```

Run: `npx playwright test tests/console-errors.spec.ts`

- [ ] **Step 7: Run full Playwright suite — all tests must be green**

```bash
npx playwright test --reporter=list
```

Expected: 0 failures. Fix any remaining failures before marking this task done.

- [ ] **Step 7b: Task 11–13 Playwright checks**

Add to `tests/user-journeys.spec.ts`:

```typescript
test('T11: CIRCLES default mode is 完整模擬 on fresh load', async ({ page }) => {
  await page.goto('http://localhost:3000');
  // 完整模擬 card should have .selected class by default
  const simCard = page.locator('.circles-mode-card[data-mode="simulation"]');
  await expect(simCard).toHaveClass(/selected/);
  const drillCard = page.locator('.circles-mode-card[data-mode="drill"]');
  await expect(drillCard).not.toHaveClass(/selected/);
});

test('T11: CIRCLES mode persists across page reload', async ({ page }) => {
  await page.goto('http://localhost:3000');
  await page.click('.circles-mode-card[data-mode="drill"]');
  await page.reload();
  await expect(page.locator('.circles-mode-card[data-mode="drill"]')).toHaveClass(/selected/);
});

test('T12: CIRCLES sessions appear in offcanvas history', async ({ page }) => {
  await page.goto('http://localhost:3000');
  await page.click('#btn-hamburger');
  // After loading, offcanvas should show at least an empty state or records
  const list = page.locator('#offcanvas-list');
  await expect(list).toBeVisible();
  // Should NOT show 載入失敗
  await expect(list).not.toContainText('載入失敗');
});

test('T13: Offcanvas second open is instant (no skeleton flicker)', async ({ page }) => {
  await page.goto('http://localhost:3000');
  // First open — wait for list to render
  await page.click('#btn-hamburger');
  await page.waitForSelector('#offcanvas-list .offcanvas-item, #offcanvas-list div');
  await page.click('.offcanvas-overlay');
  // Second open — skeleton should NOT appear (cached)
  const start = Date.now();
  await page.click('#btn-hamburger');
  const skeleton = page.locator('.offcanvas-skeleton');
  await expect(skeleton).not.toBeVisible();
  const elapsed = Date.now() - start;
  expect(elapsed).toBeLessThan(200); // instant render
});

test('T13: Delete record is optimistic (item disappears immediately)', async ({ page }) => {
  await page.goto('http://localhost:3000');
  await page.click('#btn-hamburger');
  await page.waitForSelector('#offcanvas-list .offcanvas-item');
  const deleteBtn = page.locator('.offcanvas-delete-btn').first();
  const item = page.locator('.offcanvas-item').first();
  await deleteBtn.click();
  // Item should be gone immediately (no wait for API)
  await expect(item).not.toBeAttached({ timeout: 300 });
});
```

Run: `npx playwright test tests/user-journeys.spec.ts --reporter=list`

- [ ] **Step 8: Final commit**

```bash
git add tests/ test-results/
git commit -m "test: Playwright UIUX audit — all journeys, RWD, tap targets, console errors green"
```

---

## Task 11: CIRCLES Default Mode → 完整模擬 + localStorage Persistence

**Files:**
- Modify: `public/app.js`

- [ ] **Step 1: Change AppState default circlesMode from 'drill' to 'simulation'**

In `public/app.js` line 33, change:
```javascript
  circlesMode: 'drill',
```
to:
```javascript
  circlesMode: localStorage.getItem('circlesMode') || 'simulation',
```

- [ ] **Step 2: Persist mode selection to localStorage in bindCirclesHome()**

In `bindCirclesHome()`, inside the `.circles-mode-card` click handler (where `AppState.circlesMode = el.dataset.mode` is set), add immediately after:
```javascript
    AppState.circlesMode = el.dataset.mode;
    localStorage.setItem('circlesMode', el.dataset.mode);
    render();
```

- [ ] **Step 3: Verify default is 完整模擬**

Open http://localhost:3000 in an incognito window (no localStorage). Confirm the "完整模擬" card is selected by default, not "步驟加練".

- [ ] **Step 4: Commit**
```bash
git add public/app.js
git commit -m "feat: default CIRCLES mode to 完整模擬, persist selection to localStorage"
```

---

## Task 12: CIRCLES Sessions in Offcanvas History

**Files:**
- Modify: `public/app.js` — `loadOffcanvasSessions()`

- [ ] **Step 1: Add CIRCLES sessions to loadOffcanvasSessions()**

In `loadOffcanvasSessions()`, replace the current fetch logic (fetches PM + NSM) with:
```javascript
async function loadOffcanvasSessions() {
  const listEl = document.getElementById('offcanvas-list');
  if (!listEl) return;
  listEl.innerHTML = '<div style="padding:16px;color:var(--text-secondary);font-size:14px">載入中…</div>';
  try {
    const headers = AppState.accessToken
      ? { 'Authorization': `Bearer ${AppState.accessToken}` }
      : { 'X-Guest-ID': AppState.guestId };
    const nsmUrl = AppState.accessToken ? '/api/nsm-sessions' : '/api/guest/nsm-sessions';
    const circlesUrl = AppState.accessToken ? '/api/circles-sessions' : '/api/guest-circles-sessions';

    const [nsmRes, circlesRes] = await Promise.all([
      fetch(nsmUrl, { headers }),
      fetch(circlesUrl, { headers })
    ]);
    const nsmSessions = nsmRes.ok ? await nsmRes.json() : [];
    const circlesSessions = circlesRes.ok ? await circlesRes.json() : [];

    const all = [
      ...nsmSessions.map(s => ({ ...s, _type: 'nsm' })),
      ...circlesSessions.map(s => ({ ...s, _type: 'circles' }))
    ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    AppState.offcanvasCache = all;

    if (!all.length) {
      listEl.innerHTML = '<div style="padding:16px;color:var(--text-secondary);font-size:14px">尚無練習記錄</div>';
      return;
    }
    renderOffcanvasList(listEl, all);
  } catch (_) {
    listEl.innerHTML = '<div style="padding:16px;color:var(--text-secondary)">載入失敗</div>';
  }
}
```

- [ ] **Step 2: Extract renderOffcanvasList() helper**

Add this function before `loadOffcanvasSessions()`:
```javascript
function renderOffcanvasList(listEl, all) {
  listEl.innerHTML = all.map(s => {
    const isNSM = s._type === 'nsm';
    const isCircles = s._type === 'circles';
    let label;
    if (isNSM) {
      label = 'NSM · ' + (s.question_json?.company || '');
    } else if (isCircles) {
      const company = s.question_json?.company || '';
      label = s.mode === 'drill'
        ? (s.drill_step || 'C') + ' · 步驟加練 · ' + company
        : 'CIRCLES · ' + company;
    } else {
      label = s.difficulty || '';
    }
    const date = new Date(s.created_at).toLocaleString('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    const score = s.scores_json
      ? Math.round(s.scores_json.totalScore ?? s.scores_json.total ?? 0) + ' 分'
      : null;
    const badge = s.status === 'completed' ? (score || '完成') : '進行中';
    const badgeClass = s.status === 'completed'
      ? (isNSM ? 'badge-nsm' : isCircles ? 'badge-circles' : 'badge-green')
      : 'badge-blue';
    return `<div class="offcanvas-item" data-id="${s.id}" data-status="${s.status}" data-type="${s._type}" style="position:relative">
      <div style="display:flex;align-items:center;gap:6px;padding-right:28px">
        <span class="badge ${badgeClass}">${badge}</span>
        <span style="font-size:0.8rem;color:var(--text-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(label)}</span>
      </div>
      <div style="font-size:0.75rem;color:var(--text-secondary);margin-top:4px">${date}</div>
      <button class="btn-icon offcanvas-delete-btn" title="刪除" style="position:absolute;top:6px;right:4px;font-size:1rem;padding:2px 6px" data-id="${s.id}" data-type="${s._type}">
        <i class="ph ph-trash"></i>
      </button>
    </div>`;
  }).join('');

  listEl.querySelectorAll('.offcanvas-item').forEach(item => {
    item.addEventListener('click', async (e) => {
      if (e.target.closest('.offcanvas-delete-btn')) return;
      closeOffcanvas();
      const id = item.dataset.id;
      const status = item.dataset.status;
      const type = item.dataset.type;
      if (type === 'nsm') {
        AppState.nsmSession = { id };
        AppState.nsmStep = 4;
        navigate('nsm');
        return;
      }
      if (type === 'circles') {
        await loadCirclesSession(id);
        navigate('circles');
        return;
      }
    });
  });
  attachOffcanvasDeleteListeners(listEl);
}
```

- [ ] **Step 3: Add .badge-circles CSS**

In `public/style.css`, find where `.badge-nsm` is defined and add:
```css
.badge-circles {
  background: #EEF3FF;
  color: #1A56DB;
  border: 1px solid #C5D5FF;
}
```

- [ ] **Step 4: Verify CIRCLES sessions appear in offcanvas**

Start server, do a CIRCLES drill or simulation session, open the hamburger menu. Confirm the session appears with the correct label and badge.

- [ ] **Step 5: Commit**
```bash
git add public/app.js public/style.css
git commit -m "feat: show CIRCLES sessions in offcanvas history with drill/simulation labels"
```

---

## Task 13: Records Performance — Cache + Optimistic Updates

**Files:**
- Modify: `public/app.js`

- [ ] **Step 1: Add offcanvasCache to AppState**

In `public/app.js`, in the `AppState` object, add:
```javascript
  offcanvasCache: null,  // cached offcanvas session list for instant render
```

- [ ] **Step 2: Rewrite loadOffcanvasSessions() for instant cache render**

Replace the opening of `loadOffcanvasSessions()` — show cached data immediately if available, then refresh in background:
```javascript
async function loadOffcanvasSessions() {
  const listEl = document.getElementById('offcanvas-list');
  if (!listEl) return;

  // Show cached data instantly if available (no spinner)
  if (AppState.offcanvasCache && AppState.offcanvasCache.length) {
    renderOffcanvasList(listEl, AppState.offcanvasCache);
  } else {
    listEl.innerHTML = '<div class="offcanvas-skeleton">' +
      ['80%','60%','70%'].map(w =>
        '<div style="height:48px;background:var(--bg-surface-2);border-radius:8px;margin-bottom:8px;opacity:0.6;animation:pulse 1.2s ease-in-out infinite"></div>'
      ).join('') +
    '</div>';
  }

  // Background fetch — silently update
  try {
    const headers = AppState.accessToken
      ? { 'Authorization': `Bearer ${AppState.accessToken}` }
      : { 'X-Guest-ID': AppState.guestId };
    const nsmUrl = AppState.accessToken ? '/api/nsm-sessions' : '/api/guest/nsm-sessions';
    const circlesUrl = AppState.accessToken ? '/api/circles-sessions' : '/api/guest-circles-sessions';

    const [nsmRes, circlesRes] = await Promise.all([
      fetch(nsmUrl, { headers }),
      fetch(circlesUrl, { headers })
    ]);
    const nsmSessions = nsmRes.ok ? await nsmRes.json() : [];
    const circlesSessions = circlesRes.ok ? await circlesRes.json() : [];

    const all = [
      ...nsmSessions.map(s => ({ ...s, _type: 'nsm' })),
      ...circlesSessions.map(s => ({ ...s, _type: 'circles' }))
    ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    AppState.offcanvasCache = all;

    // Only re-render if list is still open
    if (!document.getElementById('offcanvas-list')) return;
    if (!all.length) {
      listEl.innerHTML = '<div style="padding:16px;color:var(--text-secondary);font-size:14px">尚無練習記錄</div>';
      return;
    }
    renderOffcanvasList(listEl, all);
  } catch (_) {
    if (!AppState.offcanvasCache) {
      listEl.innerHTML = '<div style="padding:16px;color:var(--text-secondary)">載入失敗</div>';
    }
  }
}
```

- [ ] **Step 3: Add skeleton pulse animation to style.css**

In `public/style.css`, add:
```css
@keyframes pulse {
  0%, 100% { opacity: 0.6; }
  50% { opacity: 0.3; }
}
```

- [ ] **Step 4: Optimistic deletion in attachOffcanvasDeleteListeners()**

Find `attachOffcanvasDeleteListeners()` and replace its delete handler with optimistic logic:
```javascript
function attachOffcanvasDeleteListeners(listEl) {
  listEl.querySelectorAll('.offcanvas-delete-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      const type = btn.dataset.type;

      // Optimistic: remove from cache and UI immediately
      const itemEl = btn.closest('.offcanvas-item');
      const prevCache = AppState.offcanvasCache ? [...AppState.offcanvasCache] : null;
      if (AppState.offcanvasCache) {
        AppState.offcanvasCache = AppState.offcanvasCache.filter(s => s.id !== id);
      }
      itemEl?.remove();
      if (listEl.children.length === 0) {
        listEl.innerHTML = '<div style="padding:16px;color:var(--text-secondary);font-size:14px">尚無練習記錄</div>';
      }

      // Background DELETE
      try {
        const headers = AppState.accessToken
          ? { 'Authorization': `Bearer ${AppState.accessToken}`, 'Content-Type': 'application/json' }
          : { 'X-Guest-ID': AppState.guestId, 'Content-Type': 'application/json' };
        let deleteUrl;
        if (type === 'nsm') deleteUrl = (AppState.accessToken ? '/api/nsm-sessions/' : '/api/guest/nsm-sessions/') + id;
        else if (type === 'circles') deleteUrl = (AppState.accessToken ? '/api/circles-sessions/' : '/api/guest-circles-sessions/') + id;
        const res = await fetch(deleteUrl, { method: 'DELETE', headers });
        if (!res.ok) throw new Error('delete failed');
      } catch (_) {
        // Restore on failure
        if (prevCache) AppState.offcanvasCache = prevCache;
        loadOffcanvasSessions();
      }
    });
  });
}
```

- [ ] **Step 5: Optimistic CIRCLES record entry — navigate first, load in background**

In `renderOffcanvasList()`, for the `type === 'circles'` click handler, replace the `await loadCirclesSession(id)` with optimistic navigation using cached data:
```javascript
      if (type === 'circles') {
        // Try to use cached session data for instant navigation
        const cached = AppState.offcanvasCache?.find(s => s.id === id);
        if (cached) {
          AppState.circlesSelectedQuestion = cached.question_json;
          AppState.circlesSession = { id: cached.id, mode: cached.mode, drill_step: cached.drill_step };
          AppState.circlesMode = cached.mode || 'simulation';
          AppState.circlesDrillStep = cached.drill_step || 'C1';
          AppState.circlesPhase = cached.current_phase || 1;
          AppState.circlesSimStep = cached.sim_step_index || 0;
          navigate('circles');
        } else {
          await loadCirclesSession(id);
          navigate('circles');
        }
        return;
      }
```

- [ ] **Step 6: Invalidate cache after creating a new session**

After any new CIRCLES or NSM session is created (in the respective `bindCircles*` and `bindNSM*` handlers where `AppState.circlesSession` or `AppState.nsmSession` is set), add:
```javascript
AppState.offcanvasCache = null; // force fresh fetch on next offcanvas open
```

- [ ] **Step 7: Verify performance feel**

Open the app, do a session, open offcanvas:
- First open: skeleton animation appears briefly → list renders
- Close and re-open immediately: list renders instantly (no spinner at all)
- Delete a record: item disappears instantly, no wait
- Click a CIRCLES record: navigates immediately to correct phase, no wait

- [ ] **Step 8: Commit**
```bash
git add public/app.js public/style.css
git commit -m "perf: instant offcanvas render from cache, optimistic delete, optimistic CIRCLES resume"
```

---

---

## Task 14: 題庫生成 — 執行 generate-circles-questions.js

**Spec:** `docs/superpowers/specs/2026-04-26-circles-ux-polish-design.md` §7

**Files:**
- Run: `scripts/generate-circles-questions.js`
- Verify: `public/circles-db.js`

- [ ] **Step 1: Check current question count**

```bash
node -e "const q = require('./public/circles-db.js'); console.log(q.CIRCLES_QUESTIONS.length, 'questions');"
```
Expected: 3 questions (only seed data)

- [ ] **Step 2: Run the generation script**

```bash
node scripts/generate-circles-questions.js
```
Expected: script runs and overwrites or appends to `public/circles-db.js` with ~100 questions.
If the script requires env vars, ensure `.env` is loaded: `node -r dotenv/config scripts/generate-circles-questions.js`

- [ ] **Step 3: Verify question counts by type**

```bash
node -e "
const q = require('./public/circles-db.js');
const qs = q.CIRCLES_QUESTIONS;
const d = qs.filter(x => x.question_type === 'design').length;
const i = qs.filter(x => x.question_type === 'improve').length;
const s = qs.filter(x => x.question_type === 'strategy').length;
console.log('design:', d, '| improve:', i, '| strategy:', s, '| total:', qs.length);
"
```
Expected: design ≥ 30, improve ≥ 25, strategy ≥ 20, total ≥ 75.

- [ ] **Step 4: Spot-check a question has all required fields**

```bash
node -e "
const q = require('./public/circles-db.js');
const first = q.CIRCLES_QUESTIONS[0];
['id','company','product','question_type','problem_statement','hidden_context'].forEach(f => {
  if (!first[f]) console.error('MISSING:', f);
  else console.log('ok:', f);
});
"
```
Expected: all 6 fields print `ok`.

- [ ] **Step 5: Commit**

```bash
git add public/circles-db.js
git commit -m "feat: generate CIRCLES question bank (100 questions)"
```

---

## Task 15: CIRCLES 首頁重設計 — 說明區塊 + 隨機選題 + 看更多

**Spec:** `docs/superpowers/specs/2026-04-26-circles-ux-polish-design.md` §1

**Files:**
- Modify: `public/app.js` — `renderCirclesHome()` (line 659), `bindCirclesHome()` (line 744)

- [ ] **Step 1: Add explainer block and random button to `renderCirclesHome()`**

In `renderCirclesHome()`, replace the current `return` statement (starting at line 710) with:

```javascript
  return '<div data-view="circles">' +
    '<div class="circles-nav">' +
      '<button class="circles-nav-back" id="circles-home-back"><i class="ph ph-arrow-left"></i></button>' +
      '<div><div class="circles-nav-title">CIRCLES 訓練</div></div>' +
    '</div>' +
    '<div class="circles-home-wrap">' +
      recentHtml +

      // Explainer block
      '<div style="background:#fff;border:1px solid #e8e5de;border-radius:10px;padding:12px 14px;margin-bottom:16px;font-family:DM Sans,sans-serif">' +
        '<div style="font-size:12px;font-weight:700;color:#1a1a1a;margin-bottom:6px">什麼是 CIRCLES 實戰訓練？</div>' +
        '<div style="font-size:11px;color:#5a5a5a;line-height:1.7;margin-bottom:8px">用結構化框架拆解 PM 設計面試題，模擬真實利害關係人訪談，並在每個步驟收到 AI 教練評分與回饋。</div>' +
        '<div style="display:flex;gap:4px;flex-wrap:wrap">' +
          CIRCLES_STEPS.map(function(s) {
            return '<span style="background:#EEF3FF;color:#1A56DB;border-radius:4px;padding:2px 7px;font-size:10px;font-weight:600">' + s.short + ' ' + s.label + '</span>';
          }).join('') +
        '</div>' +
      '</div>' +

      '<div class="circles-step-select-label">練習模式</div>' +
      '<div class="circles-mode-row">' +
        '<div class="circles-mode-card ' + (mode === 'drill' ? 'selected' : '') + '" data-mode="drill">' +
          '<div class="circles-mode-card-title"><i class="ph ph-target"></i> 步驟加練</div>' +
          '<div class="circles-mode-card-desc">5-10 分鐘 · 針對單一步驟 · 全引導</div>' +
        '</div>' +
        '<div class="circles-mode-card ' + (mode === 'simulation' ? 'selected' : '') + '" data-mode="simulation">' +
          '<div class="circles-mode-card-title"><i class="ph ph-video-camera"></i> 完整模擬</div>' +
          '<div class="circles-mode-card-desc">25-35 分鐘 · 全 7 步 · 無提示</div>' +
        '</div>' +
      '</div>' +

      (mode === 'drill' ? '<div class="circles-step-select-label">練習步驟</div><div class="circles-step-pills">' + stepPills + '</div>' : '') +

      '<div class="circles-type-tabs">' +
        '<button class="circles-type-tab ' + (type === 'design' ? 'active' : '') + '" data-type="design">產品設計 ×' + designCount + '</button>' +
        '<button class="circles-type-tab ' + (type === 'improve' ? 'active' : '') + '" data-type="improve">產品改進 ×' + improveCount + '</button>' +
        '<button class="circles-type-tab ' + (type === 'strategy' ? 'active' : '') + '" data-type="strategy">產品策略 ×' + strategyCount + '</button>' +
      '</div>' +

      // Random button + question list header
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">' +
        '<div style="font-size:11px;font-weight:600;color:#5a5a5a;font-family:DM Sans,sans-serif">選擇題目</div>' +
        '<button id="circles-random-btn" style="font-size:11px;color:#1A56DB;background:none;border:none;cursor:pointer;font-family:DM Sans,sans-serif;padding:0">隨機選題</button>' +
      '</div>' +

      '<div class="circles-q-list">' + (qCards || '<div style="color:var(--c-text-3);font-size:13px;text-align:center;padding:24px 0">暫無題目，請先執行題庫生成腳本</div>') + '</div>' +
    '</div>' +
  '</div>';
```

- [ ] **Step 2: Update `qCards` to support "看更多" expand**

In `renderCirclesHome()`, replace the `qCards` variable (~line 670–675):

```javascript
  var qCards = questions.slice(0, 20).map(function(q) {
    var shortStmt = q.problem_statement.length > 60
      ? q.problem_statement.slice(0, 60) + '…'
      : q.problem_statement;
    return '<div class="circles-q-card" data-qid="' + q.id + '">' +
      '<div class="circles-q-card-company">' + q.company + ' — ' + (q.product || '') + '</div>' +
      '<div class="circles-q-card-stmt" data-full="' + escHtml(q.problem_statement) + '" data-short="' + escHtml(shortStmt) + '">' + escHtml(shortStmt) + '</div>' +
      (q.problem_statement.length > 60 ? '<div class="circles-q-card-more" data-expanded="false">看更多 ▾</div>' : '') +
    '</div>';
  }).join('');
```

- [ ] **Step 3: Bind random button and "看更多" in `bindCirclesHome()`**

In `bindCirclesHome()`, add after the existing mode-card click listener block:

```javascript
  // Random question
  document.getElementById('circles-random-btn')?.addEventListener('click', function() {
    var questions = (typeof CIRCLES_QUESTIONS !== 'undefined' ? CIRCLES_QUESTIONS : [])
      .filter(function(q) { return q.question_type === AppState.circlesSelectedType; });
    if (!questions.length) return;
    var picked = questions[Math.floor(Math.random() * questions.length)];
    AppState.circlesSelectedQuestion = picked;
    AppState.circlesPhase = 1;
    AppState.circlesFrameworkDraft = {};
    AppState.circlesGateResult = null;
    AppState.circlesConversation = [];
    AppState.circlesSession = null;
    AppState.circlesSimStep = 0;
    AppState.circlesDrillStep = CIRCLES_STEPS[0].key;
    render();
  });

  // "看更多" expand/collapse
  document.querySelectorAll('.circles-q-card-more').forEach(function(btn) {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      var stmtEl = btn.previousElementSibling;
      var expanded = btn.dataset.expanded === 'true';
      if (expanded) {
        stmtEl.textContent = stmtEl.dataset.short;
        btn.textContent = '看更多 ▾';
        btn.dataset.expanded = 'false';
      } else {
        stmtEl.textContent = stmtEl.dataset.full;
        btn.textContent = '收起 ▴';
        btn.dataset.expanded = 'true';
      }
    });
  });
```

- [ ] **Step 4: Add `.circles-q-card-more` CSS to `public/style.css`**

Find the `.circles-q-card-stmt` rule in `public/style.css` and add below it:

```css
.circles-q-card-more {
  font-size: 11px;
  color: var(--c-primary, #1A56DB);
  cursor: pointer;
  margin-top: 4px;
  font-family: 'DM Sans', sans-serif;
  display: block;
}
```

- [ ] **Step 5: Smoke-test in browser**

Start server and open app:
```bash
node server.js &
```
Open http://localhost:3000:
- Explainer block visible with 7 step badges
- "隨機選題" button in question area header
- Click 隨機選題 → goes directly to Phase 1 with a random question
- Click 看更多 on a card → full problem_statement shown → click 收起 → truncated again

- [ ] **Step 6: Commit**

```bash
git add public/app.js public/style.css
git commit -m "feat: CIRCLES home — explainer block, random question, 看更多 expand"
```

---

## Task 16: Phase 1 步驟 pill 加中文

**Spec:** `docs/superpowers/specs/2026-04-26-circles-ux-polish-design.md` §2.1

**Files:**
- Modify: `public/app.js` — `renderCirclesPhase1()` (~line 838), `renderCirclesGate()` (~line 986), `renderCirclesPhase2()` (~line 1053), `renderCirclesStepScore()` (~line 1259)

The progress label currently shows `step.short + ' · ' + (stepIdx + 1) + ' of 7'`. Update it to show the full Chinese step name.

- [ ] **Step 1: Update progress label in `renderCirclesPhase1()`**

At line ~838, replace:
```javascript
    '<div class="circles-progress">' + progressSegs + '<div class="circles-progress-label">' + step.short + ' · ' + (stepIdx + 1) + ' of 7</div></div>' +
```
with:
```javascript
    '<div class="circles-progress">' + progressSegs + '<div class="circles-progress-label">' + step.short + ' · ' + step.label + ' · ' + (stepIdx + 1) + '/7</div></div>' +
```

- [ ] **Step 2: Update progress label in `renderCirclesGate()`**

At line ~959 (loading state) and ~986 (result state), replace:
```javascript
'<div class="circles-progress-label">' + step.short + '</div>'
```
with:
```javascript
'<div class="circles-progress-label">' + step.short + ' · ' + step.label + '</div>'
```
(There are two occurrences — both in renderCirclesGate.)

- [ ] **Step 3: Update progress label in `renderCirclesPhase2()`**

At line ~1053, replace:
```javascript
    '<div class="circles-progress">' + progressSegs + '<div class="circles-progress-label">' + step.short + ' · ' + (stepIdx + 1) + ' of 7</div></div>' +
```
with:
```javascript
    '<div class="circles-progress">' + progressSegs + '<div class="circles-progress-label">' + step.short + ' · ' + step.label + ' · ' + (stepIdx + 1) + '/7</div></div>' +
```

- [ ] **Step 4: Update progress label in `renderCirclesStepScore()`**

At line ~1259, replace:
```javascript
    '<div class="circles-progress">' + progressSegs + '<div class="circles-progress-label">' + step.short + ' · ' + (stepIdx + 1) + ' of 7</div></div>' +
```
with:
```javascript
    '<div class="circles-progress">' + progressSegs + '<div class="circles-progress-label">' + step.short + ' · ' + step.label + ' · ' + (stepIdx + 1) + '/7</div></div>' +
```

- [ ] **Step 5: Verify in browser**

Navigate to any CIRCLES step → confirm progress label shows e.g. `C · 澄清情境 · 1/7`.

- [ ] **Step 6: Commit**

```bash
git add public/app.js
git commit -m "feat: phase progress label shows full Chinese step name"
```

---

## Task 17: Phase 1.5 過渡通知條

**Spec:** `docs/superpowers/specs/2026-04-26-circles-ux-polish-design.md` §3

**Files:**
- Modify: `public/app.js` — `renderCirclesGate()` (~line 978)

When gate passes (`canProceed === true` and no errors), add a blue inline notification banner above the proceed button.

- [ ] **Step 1: Add passage banner to `renderCirclesGate()`**

In `renderCirclesGate()`, replace the submit bar section (lines ~988–994):

```javascript
      '<div class="circles-submit-bar">' +
        (canProceed || !hasError
          ? '<button class="circles-btn-primary" id="circles-gate-proceed">' + (hasError ? '帶著問題進入對話（風險自負）' : '套用並進入對話 →') + '</button>'
          : '<button class="circles-btn-primary" id="circles-gate-fix">修正框架後重試</button>') +
        (!canProceed && hasError ? '' : '<button class="circles-btn-ghost" id="circles-gate-back-edit">重新編輯框架</button>') +
      '</div>' +
```

with:

```javascript
      (canProceed && !hasError
        ? '<div style="background:#EEF3FF;border:1px solid #C5D5FF;border-radius:10px;padding:12px 14px;margin-bottom:12px;font-family:DM Sans,sans-serif">' +
            '<div style="font-size:12px;font-weight:600;color:#1A56DB;margin-bottom:2px">框架審核通過</div>' +
            '<div style="font-size:11px;color:#5a7ab5">框架方向正確，進入對話練習階段繼續探索。</div>' +
          '</div>'
        : '') +
      '<div class="circles-submit-bar">' +
        (canProceed || !hasError
          ? '<button class="circles-btn-primary" id="circles-gate-proceed">' + (hasError ? '帶著問題進入對話（風險自負）' : '進入對話練習 →') + '</button>'
          : '<button class="circles-btn-primary" id="circles-gate-fix">修正框架後重試</button>') +
        (!canProceed && hasError ? '' : '<button class="circles-btn-ghost" id="circles-gate-back-edit">重新編輯框架</button>') +
      '</div>' +
```

- [ ] **Step 2: Verify in browser**

Submit a Phase 1 framework → gate passes → confirm blue banner "框架審核通過" appears above the button.

- [ ] **Step 3: Commit**

```bash
git add public/app.js
git commit -m "feat: Phase 1.5 gate shows passage notification banner"
```

---

## Task 18: Phase 2 對話練習 — 釘選題目卡 + 提交結論流程重設計

**Spec:** `docs/superpowers/specs/2026-04-26-circles-ux-polish-design.md` §4.1, §4.4, §4.5

**Files:**
- Modify: `public/app.js` — `renderCirclesPhase2()` (line 1017), `bindCirclesPhase2()` (line 1063)
- Modify: `public/style.css` — add `.circles-pinned-card`, `.circles-submit-strip`, `.circles-conclusion-box` CSS
- Create: `prompts/circles-conclusion-check.js`
- Modify: `routes/circles-sessions.js` — add `/conclusion-check` endpoint
- Modify: `routes/guest-circles-sessions.js` — add `/conclusion-check` endpoint

### Step 1–4: Add new AppState keys

- [ ] **Step 1: Add `circlesSubmitState` and `circlesConclusionText` to AppState**

In `public/app.js`, find the AppState definition and add after `circlesCoachOpen: false,` (~line 44):

```javascript
  circlesSubmitState: null,        // null | 'collapsed' | 'expanded'
  circlesConclusionText: '',       // user's conclusion textarea value
  circlesStepConclusions: {},      // { stepKey: 'conclusion text' } accumulated across steps
```

### Step 2–4: Rewrite renderCirclesPhase2

- [ ] **Step 2: Rewrite `renderCirclesPhase2()` to include pinned card + new submit strip**

Replace the entire `renderCirclesPhase2()` function (lines 1017–1061) with:

```javascript
function renderCirclesPhase2() {
  var q = AppState.circlesSelectedQuestion;
  var mode = AppState.circlesMode;
  var stepKey = AppState.circlesDrillStep;
  var stepIdx = CIRCLES_STEPS.findIndex(function(s) { return s.key === stepKey; });
  var step = CIRCLES_STEPS[stepIdx];
  var conv = AppState.circlesConversation;
  var turnCount = conv.length;
  var submitState = AppState.circlesSubmitState; // null | 'collapsed' | 'expanded'
  var conclusionText = AppState.circlesConclusionText || '';

  var progressSegs = CIRCLES_STEPS.map(function(s, i) {
    var cls = i < stepIdx ? 'done' : i === stepIdx ? 'active' : '';
    return '<div class="circles-progress-seg ' + cls + '"></div>';
  }).join('');

  var bubbles = conv.map(function(t) {
    return '<div class="circles-bubble-user">' + escHtml(t.userMessage) + '</div>' +
      (t.interviewee ? '<div class="circles-bubble-ai"><div class="circles-bubble-section">被訪談者</div>' + t.interviewee + '</div>' : '') +
      (t.coaching ? '<div class="circles-bubble-ai"><div class="circles-bubble-section">教練點評</div>' + t.coaching + '</div>' : '') +
      (t.hint ? '<div class="circles-bubble-ai"><div class="circles-bubble-section">教練提示</div>' + t.hint + '</div>' : '');
  }).join('');

  if (!bubbles) {
    bubbles = '<div class="circles-bubble-ai"><div class="circles-bubble-section">教練提示</div>' +
      (mode === 'drill' ? '準備好了嗎？針對「' + step.label + '」步驟，請開始探索題目。你可以從問問看情境的背景開始。' : '面試開始。請用「' + step.label + '」步驟的思路展開你的分析。') +
      '</div>';
  }

  // Pinned question card
  var pinnedCard = q ? (
    '<div class="circles-pinned-card" id="circles-pinned-card">' +
      '<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">' +
        '<span style="background:#EEF3FF;color:#1A56DB;border-radius:4px;padding:1px 6px;font-size:9px;font-weight:700">' + q.company + '</span>' +
      '</div>' +
      '<div style="font-size:11px;color:#1a1a1a;font-weight:600;line-height:1.4" id="circles-pinned-stmt">' + escHtml(q.problem_statement.slice(0, 80)) + (q.problem_statement.length > 80 ? '…' : '') + '</div>' +
      (q.problem_statement.length > 80 ? '<div id="circles-pinned-toggle" style="font-size:10px;color:#1A56DB;cursor:pointer;margin-top:2px">展開 ▾</div>' : '') +
    '</div>'
  ) : '';

  // Bottom section: input bar OR collapsed strip OR conclusion box
  var bottomSection;
  if (submitState === 'expanded') {
    // Conclusion box
    var detectionHtml = '<div id="circles-conclusion-hint" style="min-height:16px;font-size:10px;color:#8a8a8a;margin-top:6px"></div>';
    bottomSection = '<div class="circles-conclusion-box" id="circles-conclusion-box">' +
      '<div style="font-size:11px;font-weight:700;color:#1a1a1a;margin-bottom:2px">整理你這個步驟確認了什麼</div>' +
      '<div style="font-size:10px;color:#8a8a8a;margin-bottom:8px">1-2 句話說明範圍、時間、影響</div>' +
      '<div id="circles-example-block" style="border:1px solid #e8e5de;border-radius:8px;margin-bottom:8px;overflow:hidden">' +
        '<div id="circles-example-header" style="background:#f0ede6;padding:5px 9px;display:flex;justify-content:space-between;cursor:pointer">' +
          '<div style="font-size:9px;font-weight:700;color:#8a8a8a;text-transform:uppercase;letter-spacing:.4px">範例（不同題目）</div>' +
          '<div id="circles-example-toggle-label" style="font-size:10px;color:#8a8a8a">展開 ▾</div>' +
        '</div>' +
        '<div id="circles-example-content" style="display:none;padding:8px 10px;font-size:11px;color:#5a5a5a;line-height:1.6">問題集中在移動端搜尋功能，過去 90 天內轉換率下降 12%，主要影響首次訂房用戶，與近期過濾器 UI 改動時間吻合。</div>' +
      '</div>' +
      '<textarea id="circles-conclusion-input" style="width:100%;border:1px solid #ddd;border-radius:8px;padding:9px;font-size:11px;line-height:1.6;resize:none;height:60px;box-sizing:border-box;font-family:DM Sans,sans-serif" placeholder="針對這題，整理你確認的關鍵資訊...">' + escHtml(conclusionText) + '</textarea>' +
      detectionHtml +
      '<div style="margin-top:8px;display:flex;align-items:center;justify-content:space-between">' +
        '<button id="circles-conclusion-back" style="font-size:10px;color:#8a8a8a;background:none;border:none;cursor:pointer;font-family:DM Sans,sans-serif;padding:0">← 繼續對話</button>' +
        '<button id="circles-conclusion-submit" class="circles-btn-primary" disabled style="opacity:.45;cursor:not-allowed">確認提交</button>' +
      '</div>' +
    '</div>';
  } else if (submitState === 'collapsed') {
    // Collapsed strip
    bottomSection = '<div class="circles-submit-strip" id="circles-submit-strip">' +
      '<div>' +
        '<div style="font-size:11px;font-weight:600;color:#1A56DB;font-family:DM Sans,sans-serif">整理結論</div>' +
        '<div style="font-size:10px;color:#8a8a8a;font-family:DM Sans,sans-serif">翻閱完對話後，點右側展開填寫</div>' +
      '</div>' +
      '<button id="circles-strip-expand" style="background:#1A56DB;color:#fff;border:none;border-radius:8px;padding:7px 12px;font-size:11px;font-weight:600;cursor:pointer;font-family:DM Sans,sans-serif;white-space:nowrap">展開填寫 ▲</button>' +
    '</div>';
  } else {
    // Normal input bar
    bottomSection = '<div class="circles-input-bar" id="circles-input-bar">' +
      '<textarea class="circles-input" id="circles-msg-input" placeholder="輸入追問或回應..." rows="1"></textarea>' +
      '<button class="circles-send-btn" id="circles-send-btn"><i class="ph ph-paper-plane-tilt"></i></button>' +
    '</div>' +
    (turnCount >= 2
      ? '<div id="circles-submit-row" style="padding:6px 12px 10px;display:flex;justify-content:center">' +
          '<button id="circles-submit-step" style="font-size:11px;color:#5a5a5a;border:1px solid #e8e5de;border-radius:8px;padding:6px 16px;cursor:pointer;background:#fff;font-family:DM Sans,sans-serif">對話足夠了，提交這個步驟</button>' +
        '</div>'
      : '');
  }

  return '<div data-view="circles" class="circles-chat-wrap">' +
    '<div class="circles-nav">' +
      '<button class="circles-nav-back" id="circles-p2-back"><i class="ph ph-arrow-left"></i></button>' +
      '<div>' +
        '<div class="circles-nav-title">' + step.label + ' — 對話練習</div>' +
        '<div class="circles-nav-sub">' + (q ? q.company : '') + '</div>' +
      '</div>' +
      (turnCount > 0 && !submitState ? '<div class="circles-nav-right">' + turnCount + ' 輪</div>' : '') +
    '</div>' +
    '<div class="circles-progress">' + progressSegs + '<div class="circles-progress-label">' + step.short + ' · ' + step.label + ' · ' + (stepIdx + 1) + '/7</div></div>' +
    pinnedCard +
    '<div class="circles-chat-body" id="circles-chat-body">' + bubbles + '<div id="circles-streaming-bubble"></div></div>' +
    bottomSection +
  '</div>';
}
```

- [ ] **Step 3: Add CSS for new Phase 2 elements to `public/style.css`**

Find the `.circles-input-bar` rule block in `public/style.css` and add after it:

```css
.circles-pinned-card {
  background: #fff;
  border-bottom: 1px solid #e8e5de;
  padding: 8px 14px;
  flex-shrink: 0;
}

.circles-submit-strip {
  border-top: 1px solid #e8e5de;
  background: #fff;
  padding: 10px 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
}

.circles-conclusion-box {
  border-top: 2px solid #1A56DB;
  background: #fff;
  padding: 14px;
  flex-shrink: 0;
  overflow-y: auto;
  max-height: 65vh;
}
```

- [ ] **Step 4: Create `prompts/circles-conclusion-check.js`**

```javascript
// prompts/circles-conclusion-check.js
const OpenAI = require('openai');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const STEP_DIMENSIONS = {
  C1: ['問題範圍（地理/平台/功能）', '時間脈絡（何時開始）', '業務影響（量化）'],
  I:  ['目標用戶分群', '選定焦點對象的理由', '排除對象'],
  R:  ['功能性需求', '情感/社交需求', '核心痛點'],
  C2: ['取捨標準', '優先項目與理由', '暫緩項目'],
  L:  ['方案一', '方案二', '各方案核心差異'],
  E:  ['方案優缺點', '風險與依賴', '成功指標'],
  S:  ['推薦方案', '選擇理由', '北極星指標'],
};

async function checkConclusion(step, conclusionText, questionJson) {
  const dims = (STEP_DIMENSIONS[step] || []).join('、');
  const prompt = `你是 PM 面試教練，評估學員的步驟結論是否涵蓋關鍵維度。

題目：${questionJson.problem_statement}
步驟：${step}
應涵蓋維度：${dims}

學員結論：
${conclusionText}

請判斷結論是否已涵蓋主要維度。
- 若已涵蓋：只回覆一行 JSON：{"ok": true, "message": "範圍、時間脈絡、業務影響都涵蓋了。"}
- 若有缺漏：只回覆一行 JSON：{"ok": false, "message": "尚未提到[最重要的缺漏維度]——例如[一個具體例子]。"}
只輸出 JSON，不要其他文字。`;

  const res = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 100,
    temperature: 0.3,
  });
  try {
    return JSON.parse(res.choices[0].message.content.trim());
  } catch (_) {
    return { ok: true, message: '' };
  }
}

module.exports = { checkConclusion };
```

- [ ] **Step 5: Add `/conclusion-check` to `routes/circles-sessions.js`**

At the top of `routes/circles-sessions.js`, add after the existing requires:
```javascript
const { checkConclusion } = require('../prompts/circles-conclusion-check');
```

Before `module.exports = router;`, add:
```javascript
// POST /api/circles-sessions/:id/conclusion-check
router.post('/:id/conclusion-check', requireAuth, async (req, res) => {
  const { conclusionText } = req.body;
  if (!conclusionText || !conclusionText.trim()) return res.status(400).json({ error: 'missing_conclusion' });
  const { data: session, error } = await db
    .from('circles_sessions')
    .select('question_json, drill_step')
    .eq('id', req.params.id)
    .eq('user_id', req.user.id)
    .single();
  if (error || !session) return res.status(404).json({ error: 'not_found' });
  try {
    const result = await checkConclusion(session.drill_step || 'C1', conclusionText, session.question_json);
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
```

- [ ] **Step 6: Add `/conclusion-check` to `routes/guest-circles-sessions.js`**

At the top of `routes/guest-circles-sessions.js`, add:
```javascript
const { checkConclusion } = require('../prompts/circles-conclusion-check');
```

Before `module.exports = router;`, add:
```javascript
// POST /api/guest-circles-sessions/:id/conclusion-check
router.post('/:id/conclusion-check', requireGuestId, async (req, res) => {
  const { conclusionText } = req.body;
  if (!conclusionText || !conclusionText.trim()) return res.status(400).json({ error: 'missing_conclusion' });
  const { data: session, error } = await db
    .from('circles_sessions')
    .select('question_json, drill_step')
    .eq('id', req.params.id)
    .eq('guest_id', req.guestId)
    .single();
  if (error || !session) return res.status(404).json({ error: 'not_found' });
  try {
    const result = await checkConclusion(session.drill_step || 'C1', conclusionText, session.question_json);
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
```

- [ ] **Step 7: Rewrite `bindCirclesPhase2()` to handle all three states**

Replace the entire `bindCirclesPhase2()` function (lines 1063–1137) with:

```javascript
function bindCirclesPhase2() {
  // Keyboard avoidance (unchanged)
  if (_adjustCirclesKbFn && window.visualViewport) {
    window.visualViewport.removeEventListener('resize', _adjustCirclesKbFn);
    window.visualViewport.removeEventListener('scroll', _adjustCirclesKbFn);
  }
  _adjustCirclesKbFn = (function() {
    var _raf = null;
    return function() {
      if (!window.visualViewport) return;
      if (_raf) return;
      _raf = requestAnimationFrame(function() {
        _raf = null;
        var bar = document.getElementById('circles-input-bar') || document.getElementById('circles-submit-strip') || document.getElementById('circles-conclusion-box');
        var body = document.getElementById('circles-chat-body');
        if (!bar) return;
        var kbH = Math.max(0, window.innerHeight - window.visualViewport.offsetTop - window.visualViewport.height);
        bar.style.transform = 'translateY(-' + kbH + 'px)';
        if (body) body.style.paddingBottom = (bar.offsetHeight + kbH) + 'px';
      });
    };
  }());
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', _adjustCirclesKbFn);
    window.visualViewport.addEventListener('scroll', _adjustCirclesKbFn);
    _adjustCirclesKbFn();
  }

  // Back button
  document.getElementById('circles-p2-back')?.addEventListener('click', function() {
    AppState.circlesPhase = 1.5;
    AppState.circlesSubmitState = null;
    render();
  });

  // Auto-scroll chat
  var chatBody = document.getElementById('circles-chat-body');
  if (chatBody) chatBody.scrollTop = chatBody.scrollHeight;

  // Pinned card expand
  document.getElementById('circles-pinned-toggle')?.addEventListener('click', function() {
    var stmtEl = document.getElementById('circles-pinned-stmt');
    var q = AppState.circlesSelectedQuestion;
    if (!q) return;
    var expanded = this.dataset.expanded === 'true';
    if (expanded) {
      stmtEl.textContent = q.problem_statement.slice(0, 80) + '…';
      this.textContent = '展開 ▾';
      this.dataset.expanded = 'false';
    } else {
      stmtEl.textContent = q.problem_statement;
      this.textContent = '收起 ▴';
      this.dataset.expanded = 'true';
    }
  });

  // Submit step button (normal state → collapsed strip)
  document.getElementById('circles-submit-step')?.addEventListener('click', function() {
    AppState.circlesSubmitState = 'collapsed';
    render();
  });

  // Strip expand button (collapsed → expanded conclusion box)
  document.getElementById('circles-strip-expand')?.addEventListener('click', function() {
    AppState.circlesSubmitState = 'expanded';
    render();
  });

  // Back to chat (conclusion box → collapsed)
  document.getElementById('circles-conclusion-back')?.addEventListener('click', function() {
    AppState.circlesSubmitState = 'collapsed';
    render();
  });

  // Example block toggle
  document.getElementById('circles-example-header')?.addEventListener('click', function() {
    var content = document.getElementById('circles-example-content');
    var label = document.getElementById('circles-example-toggle-label');
    if (!content) return;
    var hidden = content.style.display === 'none';
    content.style.display = hidden ? 'block' : 'none';
    if (label) label.textContent = hidden ? '收起 ▴' : '展開 ▾';
  });

  // Conclusion textarea — 8 second debounce → AI detection
  var _conclusionTimer = null;
  var _lastChecked = '';
  document.getElementById('circles-conclusion-input')?.addEventListener('input', function() {
    var text = this.value;
    AppState.circlesConclusionText = text;
    var hintEl = document.getElementById('circles-conclusion-hint');
    var submitBtn = document.getElementById('circles-conclusion-submit');
    if (hintEl) hintEl.textContent = '';
    if (submitBtn) { submitBtn.disabled = true; submitBtn.style.opacity = '.45'; submitBtn.style.cursor = 'not-allowed'; }
    if (_conclusionTimer) clearTimeout(_conclusionTimer);
    if (!text.trim() || text.trim().length < 10) return;
    if (text === _lastChecked) return;
    _conclusionTimer = setTimeout(async function() {
      _lastChecked = text;
      var session = AppState.circlesSession;
      if (!session) return;
      if (hintEl) hintEl.textContent = '分析中…';
      try {
        var headers = { 'Content-Type': 'application/json' };
        if (AppState.accessToken) headers['Authorization'] = 'Bearer ' + AppState.accessToken;
        else headers['X-Guest-ID'] = AppState.guestId;
        var baseUrl = (AppState.accessToken ? '/api/circles-sessions/' : '/api/guest-circles-sessions/') + session.id + '/conclusion-check';
        var res = await fetch(baseUrl, { method: 'POST', headers: headers, body: JSON.stringify({ conclusionText: text }) });
        var data = await res.json();
        if (!document.getElementById('circles-conclusion-hint')) return; // user navigated away
        var hintEl2 = document.getElementById('circles-conclusion-hint');
        var submitBtn2 = document.getElementById('circles-conclusion-submit');
        if (data.ok) {
          if (hintEl2) { hintEl2.textContent = data.message || ''; hintEl2.style.color = '#137A3D'; }
          if (submitBtn2) { submitBtn2.disabled = false; submitBtn2.style.opacity = '1'; submitBtn2.style.cursor = 'pointer'; }
        } else {
          if (hintEl2) { hintEl2.textContent = data.message || ''; hintEl2.style.color = '#B85C00'; }
        }
      } catch (_) {
        var hintEl3 = document.getElementById('circles-conclusion-hint');
        if (hintEl3) hintEl3.textContent = '';
      }
    }, 8000);
  });

  // Confirm submit — save conclusion, trigger evaluation
  document.getElementById('circles-conclusion-submit')?.addEventListener('click', async function() {
    var btn = this;
    btn.disabled = true;
    btn.textContent = '評分中...';
    btn.style.opacity = '.65';

    var session = AppState.circlesSession;
    var conclusionText = AppState.circlesConclusionText;
    var stepKey = AppState.circlesDrillStep;
    if (!session || !session.id) { render(); return; }

    // Store conclusion locally for report page
    AppState.circlesStepConclusions[stepKey] = conclusionText;

    var headers = AppState.accessToken
      ? { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + AppState.accessToken }
      : { 'Content-Type': 'application/json', 'X-Guest-ID': AppState.guestId };

    var route = (AppState.accessToken ? '/api/circles-sessions/' : '/api/guest-circles-sessions/') + session.id + '/evaluate-step';
    try {
      var res = await fetch(route, { method: 'POST', headers: headers });
      var scoreData = await res.json();
      if (!res.ok) throw new Error(scoreData.error || res.status);
      AppState.circlesScoreResult = scoreData;
      AppState.circlesSubmitState = null;
      AppState.circlesConclusionText = '';
      AppState.circlesPhase = 3;
      render();
    } catch (e) {
      btn.disabled = false;
      btn.textContent = '確認提交';
      btn.style.opacity = '1';
    }
  });

  // Normal send message
  document.getElementById('circles-send-btn')?.addEventListener('click', sendCirclesMessage);
  document.getElementById('circles-msg-input')?.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendCirclesMessage(); }
  });
}
```

- [ ] **Step 8: Smoke-test in browser**

```bash
node server.js &
```
Go to Phase 2:
- After 2 turns, "對話足夠了，提交這個步驟" text row appears below input bar
- Click it → collapsed strip replaces input bar, chat is scrollable
- Click "展開填寫" → conclusion box appears
- Type <10 chars → no detection triggered
- Type 20+ chars, wait 8 seconds → "分析中…" → hint appears
- Click "← 繼續對話" → returns to collapsed strip
- Complete conclusion that passes detection → "確認提交" button activates → click → Phase 3 score page

- [ ] **Step 9: Commit**

```bash
git add public/app.js public/style.css prompts/circles-conclusion-check.js routes/circles-sessions.js routes/guest-circles-sessions.js
git commit -m "feat: Phase 2 — pinned question card, conclusion submit flow with 8s AI detection"
```

---

## Task 19: 被訪談者 Prompt 修正 — 拒答過度直接的提問

**Spec:** `docs/superpowers/specs/2026-04-26-circles-ux-polish-design.md` §4.3

**Files:**
- Modify: `prompts/circles-coach.js` — `buildSystemPrompt()` (line 14)

- [ ] **Step 1: Add vague-response instruction to 角色 A in `buildSystemPrompt()`**

In `prompts/circles-coach.js`, replace lines 45–50:

```javascript
角色 A（被訪談者）：
- 你是 ${q.company} 的產品負責人，被學員訪談
- 隱藏資訊（被訪談者知道但不主動說）：${hiddenCtx}
- 學員問得模糊 → 你給模糊答案
- 學員預設解法 → 你說「我說不清楚怎麼解，只知道遇到什麼問題」
- 回答口語、2-4 句
```

with:

```javascript
角色 A（被訪談者）：
- 你是 ${q.company} 的產品負責人，被學員訪談
- 隱藏資訊（被訪談者知道但不主動說）：${hiddenCtx}
- 學員問得模糊 → 你給模糊答案
- 學員預設解法 → 你說「我說不清楚怎麼解，只知道遇到什麼問題」
- 學員直接問核心業務指標、量化影響、或策略結論 → 給模糊的真實回應，例如「這個我們內部有一些數據，但你覺得應該先確認哪個面向？」或「我說不太準，你想從哪裡切入？」不要直接說出數字或答案
- 回答口語、2-4 句
```

- [ ] **Step 2: Verify behavior in browser**

Go to Phase 2 and type: "這個問題對公司的核心業務指標有什麼影響？請直接告訴我數字。"

Expected: 被訪談者 gives a vague, deflecting response rather than quoting exact numbers.

- [ ] **Step 3: Commit**

```bash
git add prompts/circles-coach.js
git commit -m "fix: 被訪談者 deflects overly direct questions with vague stakeholder responses"
```

---

## Task 20: Phase 3 評分頁 — 上下步導覽 + 完整模擬串連

**Spec:** `docs/superpowers/specs/2026-04-26-circles-ux-polish-design.md` §5

**Files:**
- Modify: `public/app.js` — `renderCirclesStepScore()` (~line 1251), `bindCirclesStepScore()` (~line 1281)

Currently the score page's submit bar only has "重練" and "回首頁" OR "繼續下一步". Add: explicit "上一步" back to Phase 2, and for the last step in simulation mode, show "查看總結報告" instead of "重練".

- [ ] **Step 1: Update submit bar in `renderCirclesStepScore()`**

Replace lines ~1272–1276:

```javascript
      '<div class="circles-submit-bar">' +
        (isLastStep || mode === 'drill'
          ? '<button class="circles-btn-primary" id="circles-score-again">重練這道題</button><button class="circles-btn-ghost" id="circles-score-home">回首頁</button>'
          : '<button class="circles-btn-primary" id="circles-score-next">繼續下一步：' + CIRCLES_STEPS[stepIdx + 1].label + ' →</button><button class="circles-btn-ghost" id="circles-score-home">回首頁</button>') +
      '</div>' +
```

with:

```javascript
      '<div class="circles-submit-bar">' +
        (isLastStep && mode === 'simulation'
          ? '<button class="circles-btn-primary" id="circles-score-report">查看總結報告 →</button>'
          : (mode === 'simulation'
            ? '<button class="circles-btn-primary" id="circles-score-next">繼續下一步：' + CIRCLES_STEPS[stepIdx + 1].label + ' →</button>'
            : '<button class="circles-btn-primary" id="circles-score-again">重練這道題</button>')) +
        '<button class="circles-btn-ghost" id="circles-score-home">回首頁</button>' +
      '</div>' +
```

- [ ] **Step 2: Add `circles-score-report` handler to `bindCirclesStepScore()`**

In `bindCirclesStepScore()`, after the existing `circles-score-next` handler (after line ~1329), add:

```javascript
  document.getElementById('circles-score-report')?.addEventListener('click', function() {
    AppState.circlesPhase = 4;
    AppState.circlesFinalReport = null;
    render();
  });
```

Also add `circlesFinalReport: null` to the AppState definition (~line 44) if not already there:
```javascript
  circlesFinalReport: null,          // { overallScore, overallCoach, stepScores } from /final-report endpoint
```

- [ ] **Step 3: Add `circlesPhase === 4` case to `render()`**

In `render()` (~line 381), replace:

```javascript
    case 'circles':
      if (!AppState.circlesSelectedQuestion) {
        main.innerHTML = renderCirclesHome(); bindCirclesHome();
      } else if (AppState.circlesPhase === 1) {
        main.innerHTML = renderCirclesPhase1(); bindCirclesPhase1();
      } else if (AppState.circlesPhase === 1.5) {
        main.innerHTML = renderCirclesGate(); bindCirclesGate();
      } else if (AppState.circlesPhase === 2) {
        main.innerHTML = renderCirclesPhase2(); bindCirclesPhase2();
      } else if (AppState.circlesPhase === 3) {
        main.innerHTML = renderCirclesStepScore(); bindCirclesStepScore();
      }
      break;
```

with:

```javascript
    case 'circles':
      if (!AppState.circlesSelectedQuestion) {
        main.innerHTML = renderCirclesHome(); bindCirclesHome();
      } else if (AppState.circlesPhase === 1) {
        main.innerHTML = renderCirclesPhase1(); bindCirclesPhase1();
      } else if (AppState.circlesPhase === 1.5) {
        main.innerHTML = renderCirclesGate(); bindCirclesGate();
      } else if (AppState.circlesPhase === 2) {
        main.innerHTML = renderCirclesPhase2(); bindCirclesPhase2();
      } else if (AppState.circlesPhase === 3) {
        main.innerHTML = renderCirclesStepScore(); bindCirclesStepScore();
      } else if (AppState.circlesPhase === 4) {
        main.innerHTML = renderCirclesFinalReport(); bindCirclesFinalReport();
      }
      break;
```

- [ ] **Step 4: Verify navigation**

In simulation mode, step through to the last (S) step and confirm "查看總結報告 →" button appears. In drill mode, confirm "重練這道題" appears as before.

- [ ] **Step 5: Commit**

```bash
git add public/app.js
git commit -m "feat: Phase 3 score page — simulation last step shows 查看總結報告 button"
```

---

## Task 21: 完整模擬總結報告頁

**Spec:** `docs/superpowers/specs/2026-04-26-circles-ux-polish-design.md` §6

**Files:**
- Modify: `public/app.js` — add `renderCirclesFinalReport()` and `bindCirclesFinalReport()`
- Create: `prompts/circles-final-report.js`
- Modify: `routes/circles-sessions.js` — add `/final-report` endpoint
- Modify: `routes/guest-circles-sessions.js` — add `/final-report` endpoint

- [ ] **Step 1: Create `prompts/circles-final-report.js`**

```javascript
// prompts/circles-final-report.js
const OpenAI = require('openai');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const STEP_LABELS = {
  C1: '澄清情境', I: '定義用戶', R: '發掘需求',
  C2: '優先排序', L: '提出方案', E: '評估取捨', S: '總結推薦',
};

async function generateFinalReport(questionJson, stepScores) {
  const scoreLines = Object.entries(stepScores).map(([k, v]) =>
    `${STEP_LABELS[k] || k}（${k}）：${Math.round(v.totalScore || 0)} 分 — ${v.improvement || ''}`
  ).join('\n');

  const overallScore = Math.round(
    Object.values(stepScores).reduce(function(sum, v) { return sum + (v.totalScore || 0); }, 0) /
    Math.max(Object.keys(stepScores).length, 1)
  );

  const prompt = `你是 PM 面試教練，為學員的完整模擬練習寫總結評語。

題目公司：${questionJson.company}
題目：${questionJson.problem_statement}

各步驟分數與主要改進點：
${scoreLines}

平均分：${overallScore}

請用 2-3 句話寫出整體教練評語：
1. 指出最強的 1-2 個步驟（以具體步驟名稱說明）
2. 指出最需要加強的 1 個面向（以具體行動建議說明）
3. 一句鼓勵性結語

純中文，不使用 Markdown，直接輸出評語文字。`;

  const res = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 200,
    temperature: 0.7,
  });

  return {
    overallScore,
    overallCoach: res.choices[0].message.content.trim(),
    stepScores,
  };
}

module.exports = { generateFinalReport };
```

- [ ] **Step 2: Add `/final-report` endpoint to `routes/circles-sessions.js`**

At the top, add:
```javascript
const { generateFinalReport } = require('../prompts/circles-final-report');
```

Before `module.exports = router;`, add:
```javascript
// POST /api/circles-sessions/:id/final-report
router.post('/:id/final-report', requireAuth, async (req, res) => {
  const { data: session, error } = await db
    .from('circles_sessions')
    .select('question_json, step_scores, mode')
    .eq('id', req.params.id)
    .eq('user_id', req.user.id)
    .single();
  if (error || !session) return res.status(404).json({ error: 'not_found' });
  if (session.mode !== 'simulation') return res.status(400).json({ error: 'drill_mode_no_report' });
  const stepScores = session.step_scores || {};
  if (Object.keys(stepScores).length === 0) return res.status(400).json({ error: 'no_scores' });
  try {
    const report = await generateFinalReport(session.question_json, stepScores);
    res.json(report);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
```

- [ ] **Step 3: Add `/final-report` endpoint to `routes/guest-circles-sessions.js`**

At the top, add:
```javascript
const { generateFinalReport } = require('../prompts/circles-final-report');
```

Before `module.exports = router;`, add:
```javascript
// POST /api/guest-circles-sessions/:id/final-report
router.post('/:id/final-report', requireGuestId, async (req, res) => {
  const { data: session, error } = await db
    .from('circles_sessions')
    .select('question_json, step_scores, mode')
    .eq('id', req.params.id)
    .eq('guest_id', req.guestId)
    .single();
  if (error || !session) return res.status(404).json({ error: 'not_found' });
  if (session.mode !== 'simulation') return res.status(400).json({ error: 'drill_mode_no_report' });
  const stepScores = session.step_scores || {};
  if (Object.keys(stepScores).length === 0) return res.status(400).json({ error: 'no_scores' });
  try {
    const report = await generateFinalReport(session.question_json, stepScores);
    res.json(report);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
```

- [ ] **Step 4: Add `renderCirclesFinalReport()` to `public/app.js`**

Add this function after `bindCirclesStepScore()` (~line 1330):

```javascript
function renderCirclesFinalReport() {
  var report = AppState.circlesFinalReport;
  var q = AppState.circlesSelectedQuestion;
  var session = AppState.circlesSession;

  // Loading state — trigger fetch if report not yet loaded
  if (!report) {
    // Fetch will be triggered in bindCirclesFinalReport
    return '<div data-view="circles">' +
      '<div class="circles-nav">' +
        '<div><div class="circles-nav-title">CIRCLES 完整模擬 — 總結</div></div>' +
        '<button class="circles-nav-home-btn" id="circles-report-home">回首頁</button>' +
      '</div>' +
      '<div style="text-align:center;padding:60px 16px;font-family:DM Sans,sans-serif">' +
        '<i class="ph ph-circle-notch" style="font-size:28px;animation:spin 0.8s linear infinite;display:block;margin-bottom:12px;color:#1A56DB"></i>' +
        '<div style="font-size:13px;color:#5a5a5a">生成總結報告中…</div>' +
      '</div>' +
    '</div>';
  }

  var overallScore = report.overallScore || 0;
  var stepScores = report.stepScores || {};

  var pills = CIRCLES_STEPS.map(function(s) {
    var scoreData = stepScores[s.key];
    var score = scoreData ? Math.round(scoreData.totalScore || 0) : '—';
    var hasDot = typeof score === 'number' && score < 70;
    return '<div class="circles-report-pill" data-step="' + s.key + '" style="position:relative">' +
      (hasDot ? '<div style="position:absolute;top:4px;right:4px;width:5px;height:5px;border-radius:50%;background:#1A56DB;opacity:.5"></div>' : '') +
      '<div style="font-size:9px;font-weight:700;color:#1A56DB">' + s.short + '</div>' +
      '<div style="font-size:12px;font-weight:600;color:#1a1a1a">' + score + '</div>' +
      '<div style="font-size:8px;color:#5a5a5a;margin-top:1px">' + s.label.slice(0, 2) + '</div>' +
    '</div>';
  }).join('');

  var expandedStep = AppState.circlesReportExpandedStep || null;
  var expandedHtml = '';
  if (expandedStep) {
    var expandedStepDef = CIRCLES_STEPS.find(function(s) { return s.key === expandedStep; });
    var expandedScore = stepScores[expandedStep];
    var userConclusion = (AppState.circlesStepConclusions || {})[expandedStep] || '（未記錄）';
    expandedHtml = '<div class="circles-report-expand-card" id="circles-report-expand-card">' +
      '<div style="background:#EEF3FF;padding:10px 12px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #C5D5FF">' +
        '<div style="display:flex;align-items:center;gap:8px">' +
          '<div style="width:26px;height:26px;border-radius:50%;background:#1A56DB;color:#fff;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700">' + (expandedStepDef ? expandedStepDef.short : expandedStep) + '</div>' +
          '<div>' +
            '<div style="font-size:12px;font-weight:700;color:#1a1a1a">' + (expandedStepDef ? expandedStepDef.label : expandedStep) + '</div>' +
            '<div style="font-size:10px;color:#5a5a5a">' + (expandedScore ? Math.round(expandedScore.totalScore || 0) + ' 分' : '') + '</div>' +
          '</div>' +
        '</div>' +
        '<button id="circles-report-collapse" style="font-size:11px;color:#5a7ab5;background:none;border:none;cursor:pointer;font-family:DM Sans,sans-serif;padding:0">收起 ▲</button>' +
      '</div>' +
      '<div style="padding:12px;display:flex;flex-direction:column;gap:10px">' +
        '<div>' +
          '<div style="font-size:10px;font-weight:700;color:#5a5a5a;text-transform:uppercase;letter-spacing:.4px;margin-bottom:4px">你的步驟結論</div>' +
          '<div style="background:#f0ede6;border-radius:8px;padding:9px;font-size:11px;color:#5a5a5a;line-height:1.6">' + escHtml(userConclusion) + '</div>' +
        '</div>' +
        (expandedScore ? (
          '<div>' +
            '<div style="font-size:10px;font-weight:700;color:#5a5a5a;text-transform:uppercase;letter-spacing:.4px;margin-bottom:6px">教練點評</div>' +
            '<div style="font-size:11px;color:#1a1a1a;line-height:1.8">' +
              '<div style="margin-bottom:6px"><span style="font-weight:700">做得好：</span>' + escHtml(expandedScore.highlight || '—') + '</div>' +
              '<div><span style="font-weight:700">待加強：</span>' + escHtml(expandedScore.improvement || '—') + '</div>' +
            '</div>' +
          '</div>'
        ) : '') +
      '</div>' +
    '</div>';
  }

  return '<div data-view="circles">' +
    '<div class="circles-nav">' +
      '<div><div class="circles-nav-title">CIRCLES 完整模擬 — 總結</div></div>' +
      '<button class="circles-nav-home-btn" id="circles-report-home">回首頁</button>' +
    '</div>' +
    '<div class="circles-score-wrap">' +
      '<div style="font-size:11px;color:#5a5a5a;margin-bottom:10px;font-family:DM Sans,sans-serif">' + (q ? q.company + ' · ' + q.problem_statement.slice(0, 50) + (q.problem_statement.length > 50 ? '…' : '') : '') + '</div>' +

      '<div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:16px">' +
        '<div style="text-align:center;flex-shrink:0">' +
          '<div style="display:inline-flex;align-items:center;justify-content:center;width:64px;height:64px;border-radius:50%;background:#fff;border:3px solid #1A56DB;flex-direction:column">' +
            '<div style="font-size:20px;font-weight:700;color:#1A56DB;line-height:1">' + overallScore + '</div>' +
            '<div style="font-size:9px;color:#5a5a5a">總分</div>' +
          '</div>' +
        '</div>' +
        '<div style="background:#fff;border-radius:10px;border:1px solid #e8e5de;padding:10px;flex:1">' +
          '<div style="font-size:10px;font-weight:700;color:#5a5a5a;text-transform:uppercase;letter-spacing:.4px;margin-bottom:4px">AI 教練總評</div>' +
          '<div style="font-size:11px;color:#1a1a1a;line-height:1.6">' + escHtml(report.overallCoach || '') + '</div>' +
        '</div>' +
      '</div>' +

      '<div style="font-size:10px;color:#5a5a5a;margin-bottom:8px;font-family:DM Sans,sans-serif">點任一步驟查看詳細回饋</div>' +
      '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px" id="circles-report-pills">' + pills + '</div>' +

      expandedHtml +

      '<div style="display:flex;gap:8px;margin-top:8px">' +
        '<button class="circles-btn-primary" id="circles-report-again">換題再練</button>' +
        '<button class="circles-btn-ghost" id="circles-report-weak">針對弱項加練</button>' +
      '</div>' +
    '</div>' +
  '</div>';
}
```

- [ ] **Step 5: Add `.circles-report-pill` and `.circles-report-expand-card` CSS to `public/style.css`**

Add after the `.circles-score-wrap` rule block:

```css
.circles-report-pill {
  background: #fff;
  border-radius: 8px;
  padding: 6px 8px;
  border: 1px solid #e8e5de;
  text-align: center;
  min-width: 44px;
  cursor: pointer;
  transition: opacity 0.15s;
  font-family: 'DM Sans', sans-serif;
}
.circles-report-pill.dimmed { opacity: 0.4; }
.circles-report-pill.active { background: #1A56DB; border-color: #1A56DB; }
.circles-report-pill.active div { color: #fff !important; }
.circles-report-expand-card {
  background: #fff;
  border-radius: 10px;
  border: 1px solid #e8e5de;
  overflow: hidden;
  margin-bottom: 12px;
}
```

- [ ] **Step 6: Add `bindCirclesFinalReport()` to `public/app.js`**

Add after `renderCirclesFinalReport()`:

```javascript
function bindCirclesFinalReport() {
  // Home button
  document.getElementById('circles-report-home')?.addEventListener('click', function() {
    AppState.circlesSelectedQuestion = null;
    AppState.circlesSession = null;
    AppState.circlesPhase = 1;
    AppState.circlesScoreResult = null;
    AppState.circlesFinalReport = null;
    AppState.circlesReportExpandedStep = null;
    AppState.circlesStepConclusions = {};
    AppState.circlesSimStep = 0;
    navigate('circles');
  });

  // Fetch final report if not loaded
  if (!AppState.circlesFinalReport) {
    var session = AppState.circlesSession;
    if (!session || !session.id) return;
    var headers = AppState.accessToken
      ? { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + AppState.accessToken }
      : { 'Content-Type': 'application/json', 'X-Guest-ID': AppState.guestId };
    var url = (AppState.accessToken ? '/api/circles-sessions/' : '/api/guest-circles-sessions/') + session.id + '/final-report';
    fetch(url, { method: 'POST', headers: headers })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        AppState.circlesFinalReport = data;
        if (AppState.circlesPhase === 4) render();
      })
      .catch(function() {});
    return;
  }

  // Pill click → expand/collapse
  document.querySelectorAll('.circles-report-pill').forEach(function(pill) {
    pill.addEventListener('click', function() {
      var stepKey = pill.dataset.step;
      var allPills = document.querySelectorAll('.circles-report-pill');
      if (AppState.circlesReportExpandedStep === stepKey) {
        // Collapse
        AppState.circlesReportExpandedStep = null;
        allPills.forEach(function(p) { p.classList.remove('dimmed', 'active'); });
      } else {
        // Expand
        AppState.circlesReportExpandedStep = stepKey;
        allPills.forEach(function(p) {
          p.classList.toggle('active', p.dataset.step === stepKey);
          p.classList.toggle('dimmed', p.dataset.step !== stepKey);
        });
      }
      // Re-render to update expanded card
      var main = document.getElementById('main');
      if (main) { main.innerHTML = renderCirclesFinalReport(); bindCirclesFinalReport(); }
    });
  });

  // Collapse button
  document.getElementById('circles-report-collapse')?.addEventListener('click', function() {
    AppState.circlesReportExpandedStep = null;
    var main = document.getElementById('main');
    if (main) { main.innerHTML = renderCirclesFinalReport(); bindCirclesFinalReport(); }
  });

  // CTA buttons
  document.getElementById('circles-report-again')?.addEventListener('click', function() {
    AppState.circlesSession = null;
    AppState.circlesPhase = 1;
    AppState.circlesScoreResult = null;
    AppState.circlesFinalReport = null;
    AppState.circlesReportExpandedStep = null;
    AppState.circlesStepConclusions = {};
    AppState.circlesFrameworkDraft = {};
    AppState.circlesGateResult = null;
    AppState.circlesConversation = [];
    AppState.circlesSimStep = 0;
    AppState.circlesSelectedQuestion = null;
    navigate('circles');
  });

  document.getElementById('circles-report-weak')?.addEventListener('click', function() {
    // Switch to drill mode and navigate home so user can pick a step
    AppState.circlesMode = 'drill';
    localStorage.setItem('circlesMode', 'drill');
    AppState.circlesSession = null;
    AppState.circlesPhase = 1;
    AppState.circlesFinalReport = null;
    AppState.circlesReportExpandedStep = null;
    AppState.circlesStepConclusions = {};
    AppState.circlesSelectedQuestion = null;
    navigate('circles');
  });
}
```

- [ ] **Step 7: Add `circlesReportExpandedStep` to AppState**

In `public/app.js` AppState definition, add after `circlesFinalReport: null`:
```javascript
  circlesReportExpandedStep: null,   // step key currently expanded in final report
```

- [ ] **Step 8: Smoke-test in browser**

Complete a full simulation (7 steps) → click "查看總結報告 →":
- Loading spinner appears while AI generates
- Report loads: total score ring, AI 總評 text, 7 pills
- Click a low-score pill → expands below with 你的步驟結論 + 教練點評
- Click same pill again → collapses
- Click 換題再練 → returns to CIRCLES home (mode stays simulation)
- Click 針對弱項加練 → returns to CIRCLES home in drill mode

- [ ] **Step 9: Commit**

```bash
git add public/app.js public/style.css prompts/circles-final-report.js routes/circles-sessions.js routes/guest-circles-sessions.js
git commit -m "feat: CIRCLES完整模擬總結報告頁 — AI總評、步驟分數pill、回溯教練點評"
```

---

## Verification Summary

1. `node server.js` starts without errors
2. App loads directly to CIRCLES selection page (not a tabbed homepage)
3. Header shows "北極星指標" link and Login button — no moon toggle
4. Background is warm beige (`#F2F0EB`), buttons are blue (`#1A56DB`)
5. All CIRCLES training phases have ← and 回首頁 buttons in nav bar
6. NSM steps 2/3 have 回首頁 in nav; step 4 回首頁 resets to NSM step 1
7. CIRCLES selection page shows NSM banner at bottom
8. S step shows NSM annotation above fields
9. 💡 button on each Phase 1 field → overlay with contextual hint
10. `GET /api/sessions` returns 404
11. Default CIRCLES mode is 完整模擬; mode selection persists via localStorage
12. CIRCLES sessions (both drill and simulation) appear in offcanvas history with correct labels
13. Offcanvas opens instantly from cache on second open; skeleton on first open
14. Delete is instant (optimistic); CIRCLES record entry navigates immediately
15. CIRCLES home shows explainer block with 7 step badges
16. 隨機選題 button picks a random question and starts Phase 1
17. Question card 看更多 expands full problem_statement, 收起 truncates
18. Progress label shows `C · 澄清情境 · 1/7` format
19. Phase 1.5 gate pass shows blue "框架審核通過" inline banner
20. Phase 2 shows pinned question card above chat
21. After 2 turns, "對話足夠了，提交這個步驟" row appears below input bar
22. Clicking submit row → collapsed strip; clicking 展開填寫 → conclusion box
23. ← 繼續對話 returns to collapsed strip (textarea value preserved)
24. 8 seconds after stop typing → AI detection result appears; submit activates on pass
25. 被訪談者 gives vague deflecting answers to overly direct questions
26. In simulation mode, last step score page shows "查看總結報告 →"
27. Final report loads with total score, AI 總評, 7 step pills
28. Clicking a pill expands step detail (結論 + 教練點評); clicking again collapses
29. 換題再練 → CIRCLES home (simulation mode); 針對弱項加練 → CIRCLES home (drill mode)
15. Playwright tests all pass
