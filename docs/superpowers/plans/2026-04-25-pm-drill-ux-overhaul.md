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

- [ ] **Step 8: Final commit**

```bash
git add tests/ test-results/
git commit -m "test: Playwright UIUX audit — all journeys, RWD, tap targets, console errors green"
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
11. Playwright tests all pass
