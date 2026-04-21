# Session Delete Fix + Practice Layout Design

**Date:** 2026-04-21  
**Scope:** Two independent fixes — robust session delete state clearing and practice view bottom bar layout improvement.

---

## Feature 1: Session Delete — Robust State Clearing

### Problem

After deleting a session, the user navigates back to home and "上次練習" still shows the deleted session. Two root causes:

**A — Event bubbling on confirm delete buttons**  
The `.offcanvas-confirm-delete` and `.history-confirm-delete` buttons do not call `e.stopPropagation()`. When clicked, the event bubbles to the parent `.offcanvas-item` / `.history-item`, which has a click handler that re-fetches and re-sets `AppState.currentSession`. Under race conditions, `currentSession` may be re-populated before the delete handler clears it.

**B — `localStorage.lastSessionId` not cleared on delete**  
When a session is deleted, `localStorage.lastSessionId` is never cleared. Though the guest init already handles 404 gracefully, explicitly clearing it on delete is more robust and avoids edge-case state leaks.

### Solution

Three changes in `public/app.js`:

**1. `e.stopPropagation()` on confirm delete buttons (both offcanvas and history)**

In `attachOffcanvasDeleteListeners`:
```js
item.querySelector('.offcanvas-confirm-delete').addEventListener('click', async (e) => {
  e.stopPropagation();
  // ... existing delete logic
});
```

In `attachHistoryDeleteListeners`:
```js
item.querySelector('.history-confirm-delete').addEventListener('click', async (e) => {
  e.stopPropagation();
  // ... existing delete logic
});
```

**2. Clear `localStorage.lastSessionId` when matching session is deleted**

In both delete confirm handlers, after `res.ok` check, add:
```js
if (localStorage.getItem('lastSessionId') === id) {
  localStorage.removeItem('lastSessionId');
}
```

**3. Filter `renderHome()` — only show "上次練習" for in-progress sessions**

Currently `renderHome()` shows "上次練習" for any non-null `AppState.currentSession`, including completed sessions. Change the condition:

```js
// Before:
const issuePreview = AppState.currentSession ? `...` : '';

// After:
const issuePreview = (AppState.currentSession && AppState.currentSession.current_phase !== 'done') ? `...` : '';
```

This prevents completed sessions from persisting as "上次練習" after the user finishes a session and navigates home.

---

## Feature 2: Practice View — Compact Bottom Bar

### Problem

The bottom bar contains a "問題本質定義" `<textarea>` that is `disabled` for the first 3 turns (before `showSubmit` is true). This disabled textarea occupies significant vertical space, compressing the chat scroll area.

### Solution

Conditionally render the definition textarea and its label only when `showSubmit` is true. Keep `#def-hint` always rendered (hidden) so the "更新定義" tooltip continues to work.

**In `renderPractice()`:**

```js
// Before:
<label class="essence-label" for="final-def">問題本質定義（提交前可隨時更新）</label>
<div id="def-hint" class="essence-label" style="display:none;">完成 3 輪對話後即可編輯定義</div>
<textarea id="final-def" class="essence-textarea" rows="2"
  placeholder="用中性問句描述問題本質…&#10;例：如何讓 [角色] 在 [情境] 下更有效率達成 [目標]？"
  ${!showSubmit ? 'disabled' : ''}></textarea>

// After:
<div id="def-hint" class="essence-label" style="display:none;">完成 3 輪對話後即可編輯定義</div>
${showSubmit ? `
  <label class="essence-label" for="final-def">問題本質定義（提交前可隨時更新）</label>
  <textarea id="final-def" class="essence-textarea" rows="2"
    placeholder="用中性問句描述問題本質…&#10;例：如何讓 [角色] 在 [情境] 下更有效率達成 [目標]？"></textarea>
` : ''}
```

**In `bindPractice()` — update "更新定義" button handler:**

```js
// Before:
if (defEl?.disabled) { show hint } else { defEl?.focus(); }

// After:
if (!defEl || defEl.disabled) { show hint } else { defEl.focus(); }
```

**In `bindPractice()` — `finalDefEl` initialization guard:**

The current code reads `finalDefEl.value = AppState.essenceDraft` unconditionally. Since `#final-def` may not exist when `!showSubmit`, this must be guarded by `if (finalDefEl)` — which it already is (`if (finalDefEl) {`). No change needed.

### Behaviour After Fix

| Turns | Definition area | Chat area |
|-------|----------------|-----------|
| < 3   | Hidden         | Larger (full remaining space) |
| ≥ 3   | Visible + enabled | Slightly smaller |

The submit button already only renders when `showSubmit`, so no change needed there.

---

## Files Changed

| File | Change |
|------|--------|
| `public/app.js` | `attachOffcanvasDeleteListeners`: add `e.stopPropagation()` + `localStorage.removeItem` |
| `public/app.js` | `attachHistoryDeleteListeners`: add `e.stopPropagation()` + `localStorage.removeItem` |
| `public/app.js` | `renderHome`: add `current_phase !== 'done'` guard |
| `public/app.js` | `renderPractice`: conditionally render definition textarea |
| `public/app.js` | `bindPractice`: update `btn-update-def` condition to `!defEl \|\| defEl.disabled` |
