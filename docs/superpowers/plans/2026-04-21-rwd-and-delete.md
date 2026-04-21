# RWD Layout Fix + Session Delete Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix large-screen layout by constraining `#app` width per view, and add inline-confirmation delete for sessions in both the offcanvas sidebar and the history page.

**Architecture:** Three independent changes — (1) two-line CSS edit for per-view max-widths, (2) one new Express route in `routes/guest-sessions.js`, (3) UI additions to `loadOffcanvasSessions` and `renderHistoryList` in `public/app.js` with a shared delete helper. No new files needed.

**Tech Stack:** Vanilla CSS, Vanilla JS (ES modules, no bundler), Node.js/Express, Supabase (Postgres). Phosphor Icons for the trash icon (`ph-trash`).

---

## Task 1: Per-View Max-Width CSS

**Files:**
- Modify: `public/style.css:51`

- [ ] **Step 1: Replace the global `#app` max-width rule**

  Open `public/style.css`. Line 51 currently reads:

  ```css
  #app { max-width: 100%; margin: 0 auto; padding: 16px 24px; }
  ```

  Replace it with:

  ```css
  #app { max-width: 760px; margin: 0 auto; padding: 16px 24px; }
  body[data-view="report"]  #app { max-width: 1100px; }
  body[data-view="history"] #app { max-width: 860px; }
  ```

  The existing `body[data-view="practice"] #app` rule (elsewhere in the file) and the `@media print { #app { max-width: 100% !important } }` block are intentionally left unchanged.

- [ ] **Step 2: Verify print override is still present**

  Search `public/style.css` for `max-width: 100% !important`. Confirm this line still exists inside the `@media print` block. If it is missing, add it back under `@media print { #app { max-width: 100% !important; padding: 8px 24px !important; } }`.

- [ ] **Step 3: Manual smoke test**

  Start the dev server (`npm run dev`). Open the app at a wide viewport (resize browser to >1200px wide):
  - Home / login / register: content should be centred with whitespace on both sides (≤760px).
  - Navigate to history view (`body[data-view="history"]`): content centred, slightly wider (≤860px).
  - Navigate to a report (`body[data-view="report"]`): content wider still (≤1100px).
  - Navigate to practice (`body[data-view="practice"]`): full-width, no change.

- [ ] **Step 4: Commit**

  ```bash
  git add public/style.css
  git commit -m "feat: per-view responsive max-width for large screens"
  ```

---

## Task 2: Guest Session DELETE Route (Backend)

**Files:**
- Modify: `routes/guest-sessions.js` — add DELETE route after the existing GET `/:id` route (currently line 51)

- [ ] **Step 1: Add the DELETE route**

  In `routes/guest-sessions.js`, after the `GET /:id` handler (line ~51), insert:

  ```js
  // DELETE /api/guest/sessions/:id
  router.delete('/:id', requireGuestId, async (req, res) => {
    const { data, error } = await db
      .from('guest_sessions')
      .delete()
      .eq('id', req.params.id)
      .eq('guest_id', req.guestId)
      .select('id')
      .single();
    if (error || !data) return res.status(404).json({ error: 'not_found' });
    res.json({ ok: true });
  });
  ```

- [ ] **Step 2: Manual smoke test**

  With the server running, use curl (or the browser dev tools) to confirm the route responds correctly.

  **Success case** (replace `<SESSION_ID>` and `<GUEST_ID>` with real values from DB):
  ```bash
  curl -X DELETE http://localhost:4000/api/guest/sessions/<SESSION_ID> \
    -H "X-Guest-ID: <GUEST_ID>"
  # Expected: {"ok":true}
  ```

  **Missing ID case:**
  ```bash
  curl -X DELETE http://localhost:4000/api/guest/sessions/00000000-0000-0000-0000-000000000000 \
    -H "X-Guest-ID: <GUEST_ID>"
  # Expected: 404 {"error":"not_found"}
  ```

  **Missing header case:**
  ```bash
  curl -X DELETE http://localhost:4000/api/guest/sessions/<SESSION_ID>
  # Expected: 401 or 400 (whatever requireGuestId returns)
  ```

- [ ] **Step 3: Commit**

  ```bash
  git add routes/guest-sessions.js
  git commit -m "feat: add DELETE /api/guest/sessions/:id route"
  ```

---

## Task 3: Delete Button + Inline Confirm — Offcanvas Sidebar

**Files:**
- Modify: `public/app.js` — `loadOffcanvasSessions` function (line ~153) and `public/style.css` — add `.btn-danger` style

**Context:** `loadOffcanvasSessions` builds the sidebar list as raw HTML strings then attaches click listeners. We will (a) add a trash icon button to each item's rendered HTML, (b) stop click propagation on the trash button, and (c) attach a delete-with-inline-confirm handler.

The auth DELETE route already exists at `DELETE /api/sessions/:id`. Guest route was added in Task 2.

- [ ] **Step 1: Add `.btn-danger` style to `public/style.css`**

  At the end of the button styles section (around line 76, after `.btn-icon:hover`), add:

  ```css
  .btn-danger { background: var(--danger); color: #fff; border: none; border-radius: 6px; padding: 4px 10px; font-size: 0.8rem; cursor: pointer; }
  .btn-danger:hover { opacity: 0.85; }
  ```

- [ ] **Step 2: Add trash icon to each offcanvas item HTML**

  In `loadOffcanvasSessions`, the `.map(s => ...)` block (line ~164) currently returns:

  ```js
  return `<div class="offcanvas-item" data-id="${s.id}" data-status="${s.status}">
    <div style="display:flex;align-items:center;justify-content:space-between">
      ${badge}<span style="font-size:0.75rem;color:var(--text-secondary)">${s.difficulty || ''}</span>
    </div>
    <div style="font-size:0.8rem;color:var(--text-secondary);margin-top:4px">${date}</div>
  </div>`;
  ```

  Replace with:

  ```js
  return `<div class="offcanvas-item" data-id="${s.id}" data-status="${s.status}" style="position:relative">
    <div style="display:flex;align-items:center;justify-content:space-between">
      ${badge}<span style="font-size:0.75rem;color:var(--text-secondary)">${s.difficulty || ''}</span>
    </div>
    <div style="font-size:0.8rem;color:var(--text-secondary);margin-top:4px">${date}</div>
    <button class="btn-icon offcanvas-delete-btn" title="刪除" style="position:absolute;top:6px;right:4px;font-size:1rem;padding:2px 6px" data-id="${s.id}">
      <i class="ph ph-trash"></i>
    </button>
  </div>`;
  ```

- [ ] **Step 3: Add delete logic after the click-to-open listeners**

  After the `listEl.querySelectorAll('.offcanvas-item').forEach(item => { ... });` block (line ~192), add:

  ```js
  listEl.querySelectorAll('.offcanvas-delete-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const id = btn.dataset.id;
      const item = btn.closest('.offcanvas-item');
      const originalHTML = item.innerHTML;

      item.innerHTML = `
        <span style="font-size:0.85rem">確定刪除嗎？</span>
        <div style="display:flex;gap:6px;margin-top:6px">
          <button class="btn btn-ghost offcanvas-cancel-delete" style="font-size:0.8rem;padding:4px 10px">取消</button>
          <button class="btn-danger offcanvas-confirm-delete" style="font-size:0.8rem">刪除</button>
        </div>
      `;

      item.querySelector('.offcanvas-cancel-delete').addEventListener('click', () => {
        item.innerHTML = originalHTML;
        // Re-attach delete listener for the restored button
        const newBtn = item.querySelector('.offcanvas-delete-btn');
        if (newBtn) newBtn.addEventListener('click', arguments.callee.bind(null, { stopPropagation: () => {} }));
      });

      item.querySelector('.offcanvas-confirm-delete').addEventListener('click', async () => {
        const res = await fetch(sessionRoute(`/${id}`), { method: 'DELETE', headers: apiHeaders() });
        if (!res.ok) return;
        if (AppState.currentSession?.id === id) {
          AppState.currentSession = null;
          navigate('home');
        } else {
          item.remove();
        }
      });
    });
  });
  ```

  **Note:** The `arguments.callee` trick for re-attaching after cancel is fragile. Use a named function instead. Refactor the listener registration into a named `attachOffcanvasDeleteListeners(listEl)` function and call it in two places: after initial render AND after cancel restores HTML. See Step 4.

- [ ] **Step 4: Refactor delete listener into a named function (avoids arguments.callee)**

  Extract the delete button wiring into a standalone function placed just before `loadOffcanvasSessions`:

  ```js
  function attachOffcanvasDeleteListeners(listEl) {
    listEl.querySelectorAll('.offcanvas-delete-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const id = btn.dataset.id;
        const item = btn.closest('.offcanvas-item');
        const originalHTML = item.innerHTML;

        item.innerHTML = `
          <span style="font-size:0.85rem">確定刪除嗎？</span>
          <div style="display:flex;gap:6px;margin-top:6px">
            <button class="btn btn-ghost offcanvas-cancel-delete" style="font-size:0.8rem;padding:4px 10px">取消</button>
            <button class="btn-danger offcanvas-confirm-delete" style="font-size:0.8rem">刪除</button>
          </div>
        `;

        item.querySelector('.offcanvas-cancel-delete').addEventListener('click', () => {
          item.innerHTML = originalHTML;
          attachOffcanvasDeleteListeners(item.closest('#offcanvas-list') || item.parentElement);
        });

        item.querySelector('.offcanvas-confirm-delete').addEventListener('click', async () => {
          const res = await fetch(sessionRoute(`/${id}`), { method: 'DELETE', headers: apiHeaders() });
          if (!res.ok) return;
          if (AppState.currentSession?.id === id) {
            AppState.currentSession = null;
            navigate('home');
          } else {
            item.remove();
          }
        });
      });
    });
  }
  ```

  Then in `loadOffcanvasSessions`, replace the inline delete listener block (Step 3) with a single call:

  ```js
  attachOffcanvasDeleteListeners(listEl);
  ```

- [ ] **Step 5: Manual smoke test**

  Open offcanvas sidebar. Each session item should show a small trash icon in the top-right corner.
  - Click trash → item row is replaced by "確定刪除嗎？ [取消] [刪除]".
  - Click 取消 → original row is restored, trash icon still works.
  - Click 刪除 on a non-current session → item disappears, no navigation.
  - Click 刪除 on the session that is currently open (if any) → navigates to home.

- [ ] **Step 6: Commit**

  ```bash
  git add public/app.js public/style.css
  git commit -m "feat: delete with inline confirm in offcanvas sidebar"
  ```

---

## Task 4: Delete Button + Inline Confirm — History Page

**Files:**
- Modify: `public/app.js` — `renderHistoryList` function (line ~981)

**Context:** `renderHistoryList` is auth-only. The auth DELETE route is `DELETE /api/sessions/:id`. The `sessionRoute('/:id')` helper already returns the right path for auth users.

- [ ] **Step 1: Add trash icon to each history item HTML**

  In `renderHistoryList`, the `.map(s => ...)` block (line ~985) currently returns:

  ```js
  `<div class="history-item" data-id="${s.id}">
    <div style="display:flex;justify-content:space-between">
      <span>${s.difficulty} · ${s.status === 'completed' ? '已完成' : '進行中'}</span>
      <span style="color:${s.scores_json?.totalScore >= 70 ? 'var(--success)' : 'var(--warning)'}">
        ${s.scores_json?.totalScore != null ? s.scores_json.totalScore + ' 分' : '—'}
      </span>
    </div>
    <div style="color:var(--text-secondary);font-size:0.8rem;margin-top:4px">
      ${new Date(s.created_at).toLocaleString('zh-TW')}
    </div>
  </div>`
  ```

  Replace with:

  ```js
  `<div class="history-item" data-id="${s.id}" style="position:relative">
    <div style="display:flex;justify-content:space-between;padding-right:28px">
      <span>${s.difficulty} · ${s.status === 'completed' ? '已完成' : '進行中'}</span>
      <span style="color:${s.scores_json?.totalScore >= 70 ? 'var(--success)' : 'var(--warning)'}">
        ${s.scores_json?.totalScore != null ? s.scores_json.totalScore + ' 分' : '—'}
      </span>
    </div>
    <div style="color:var(--text-secondary);font-size:0.8rem;margin-top:4px">
      ${new Date(s.created_at).toLocaleString('zh-TW')}
    </div>
    <button class="btn-icon history-delete-btn" title="刪除" style="position:absolute;top:8px;right:8px;font-size:1rem;padding:2px 6px" data-id="${s.id}">
      <i class="ph ph-trash"></i>
    </button>
  </div>`
  ```

- [ ] **Step 2: Add delete logic after the click-to-open listeners**

  After the `el.querySelectorAll('.history-item').forEach(item => { ... });` block (line ~1007), add a new named function call. First, define the function just above `renderHistoryList`:

  ```js
  function attachHistoryDeleteListeners(el) {
    el.querySelectorAll('.history-delete-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const id = btn.dataset.id;
        const item = btn.closest('.history-item');
        const originalHTML = item.innerHTML;

        item.innerHTML = `
          <span style="font-size:0.85rem">確定刪除嗎？</span>
          <div style="display:flex;gap:6px;margin-top:6px">
            <button class="btn btn-ghost history-cancel-delete" style="font-size:0.8rem;padding:4px 10px">取消</button>
            <button class="btn-danger history-confirm-delete" style="font-size:0.8rem">刪除</button>
          </div>
        `;

        item.querySelector('.history-cancel-delete').addEventListener('click', () => {
          item.innerHTML = originalHTML;
          attachHistoryDeleteListeners(item.closest('#history-list') || item.parentElement);
        });

        item.querySelector('.history-confirm-delete').addEventListener('click', async () => {
          const res = await fetch(`/api/sessions/${id}`, { method: 'DELETE', headers: apiHeaders() });
          if (!res.ok) return;
          if (AppState.currentSession?.id === id) {
            AppState.currentSession = null;
            navigate('home');
          } else {
            item.remove();
          }
        });
      });
    });
  }
  ```

  Then at the end of `renderHistoryList`, after the `.forEach` block, call:

  ```js
  attachHistoryDeleteListeners(el);
  ```

- [ ] **Step 3: Manual smoke test**

  Log in as an auth user, navigate to history page.
  - Each session card shows a small trash icon in the top-right corner.
  - Click trash → card content replaced by "確定刪除嗎？ [取消] [刪除]".
  - Click 取消 → original card restored with working trash icon.
  - Click 刪除 on a non-current session → card disappears from DOM, no navigation.
  - Click 刪除 on the currently active session → navigates to home.
  - Confirm the deleted session no longer appears after refreshing.

- [ ] **Step 4: Commit**

  ```bash
  git add public/app.js
  git commit -m "feat: delete with inline confirm in history page"
  ```

---

## Self-Review Checklist (controller runs this, not a subagent)

- [x] **Spec coverage**
  - Feature 1 (per-view max-width): covered in Task 1
  - Feature 2 guest DELETE backend: covered in Task 2
  - Offcanvas delete UI (guests + auth): covered in Task 3
  - History page delete UI (auth only): covered in Task 4
  - State handling (currentSession clear + navigate home): covered in Tasks 3 & 4
  - `.btn-danger` style: covered in Task 3 Step 1

- [x] **Placeholder scan**: No TBD/TODO/vague steps present

- [x] **Type consistency**
  - `attachOffcanvasDeleteListeners(listEl)` defined in Task 3 Step 4, called in Task 3 Step 4
  - `attachHistoryDeleteListeners(el)` defined in Task 4 Step 2, called in Task 4 Step 2
  - `sessionRoute()`, `apiHeaders()`, `AppState.currentSession`, `navigate()` — all existing app.js globals, referenced consistently

- [x] **Auth vs guest routes**
  - History page uses `fetch('/api/sessions/${id}', ...)` — auth only ✓
  - Offcanvas uses `sessionRoute('/${id}')` which resolves to `/api/sessions` for auth or `/api/guest/sessions` for guest ✓
