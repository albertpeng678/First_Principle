# RWD Layout Fix + Session Delete Design

**Date:** 2026-04-21  
**Scope:** Two independent features — per-view responsive max-width and inline session deletion.

---

## Feature 1: Responsive Layout (Per-View Max-Width)

### Problem
`#app { max-width: 100% }` causes content to stretch across the full viewport on large screens (24"+). All elements look bloated and the whitespace is wasted.

### Solution
Replace the single global max-width with per-view overrides using `body[data-view]` selectors (already used in the codebase for practice view).

| View | Max-Width | Reason |
|------|-----------|--------|
| Default (home, login, register) | 760px | Single-column content; wider feels empty |
| `history` | 860px | Single-column list; slightly more breathing room |
| `report` | 1100px | Two-column review layout needs horizontal space |
| `practice` | unchanged | Already full-width with overflow:hidden |

### CSS Changes (`public/style.css`)
```css
/* Replace: */
#app { max-width: 100%; margin: 0 auto; padding: 16px 24px; }

/* With: */
#app { max-width: 760px; margin: 0 auto; padding: 16px 24px; }
body[data-view="report"]  #app { max-width: 1100px; }
body[data-view="history"] #app { max-width: 860px; }
```

The existing `body[data-view="practice"] #app` override and print CSS `#app { max-width: 100% !important }` are unaffected.

---

## Feature 2: Session Delete (Inline Confirmation)

### Scope
- Auth users: delete from **history page** and **offcanvas sidebar**
- Guest users: delete from **offcanvas sidebar** only (guests have no history page)
- Backend: auth DELETE route already exists; guest DELETE route needs to be added

### Backend

**New route:** `DELETE /api/guest/sessions/:id` in `routes/guest-sessions.js`
- Validates `X-Guest-ID` header via `requireGuestId`
- Deletes row where `id = :id AND guest_id = req.guestId`
- Returns `{ ok: true }` on success, 404 if not found

### Frontend — Inline Confirmation UX

**Trigger:** Trash icon (Phosphor `ph-trash`) in each session item, right-aligned.

**Flow:**
1. User clicks trash icon on a session item
2. That item's content is replaced in-place with:  
   `確定刪除嗎？ [取消] [刪除]`
3. **Cancel:** Restore the original item HTML
4. **Confirm:** Call DELETE API → on success, remove the DOM node

**State handling after delete:**
- If deleted session === `AppState.currentSession.id`: clear `AppState.currentSession`, navigate to `'home'`
- Otherwise: just remove the DOM node, no navigation

### Where Delete Appears

**Offcanvas sidebar** (`loadOffcanvasSessions` → `renderOffcanvasItem`):
- Each `.offcanvas-item` gets a trash icon button on the right
- Inline confirmation replaces the item row

**History page** (`renderHistoryList`):
- Each `.history-item` gets a trash icon button in the top-right corner
- Inline confirmation replaces the item card

### No Delete for Guest History Page
Guests don't have a history page — only auth users do. Guest deletion is only via offcanvas.

---

## Files Changed

| File | Change |
|------|--------|
| `public/style.css` | Replace `#app` max-width; add `.btn-danger` style |
| `public/app.js` | `loadOffcanvasSessions`, `renderHistoryList`: add trash icon + inline confirm logic |
| `routes/guest-sessions.js` | Add `DELETE /:id` route |
