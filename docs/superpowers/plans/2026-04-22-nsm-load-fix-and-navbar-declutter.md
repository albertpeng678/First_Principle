# NSM In-Progress Load Fix & Navbar Declutter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix two bugs: (1) clicking an in-progress NSM session from history shows an infinite loading spinner, and (2) the mobile navbar is visually cramped because the email + 登出 button + theme icon overflow on narrow screens.

**Architecture:** Both fixes are pure frontend — `public/app.js` (JS logic) and `public/style.css` (CSS). No backend changes. Task 1 patches one callback in `bindNSM`. Task 2 changes the logout button to an icon-only button and hides the email on narrow viewports with CSS.

**Tech Stack:** Vanilla JS SPA, Phosphor Icons, CSS custom properties.

---

## File Map

| File | Changes |
|---|---|
| `public/app.js` | Task 1 (bindNSM step redirect), Task 2 (logout icon button) |
| `public/style.css` | Task 2 (hide email on < 480px) |

---

### Task 1: Fix in-progress NSM session stuck on infinite loading spinner

**Files:**
- Modify: `public/app.js:2197-2202`

**Root cause:**
When the user clicks an in-progress NSM session from history (offcanvas or home page), the code sets `AppState.nsmStep = 4` and navigates. `bindNSM` detects no `scores_json` and fetches from the server. The server returns the session with `scores_json: null` (because the user never submitted). `renderNSMStep4` checks `if (!scores.scores)` and shows the "載入報告中…" spinner forever — because `scores_json` is null.

**Fix:** After the server response arrives in `bindNSM`, check `data.scores_json`. If it's falsy (session is in-progress, not evaluated), redirect to step 3 (the evaluation step) so the user can continue filling in their answer. Completed sessions already have `scores_json` and will stay on step 4.

- [ ] **Step 1: Update the bindNSM fetch callback**

In `public/app.js`, find lines 2197-2202:
```js
      .then(function(data) {
        AppState.nsmSession = data;
        AppState.nsmSelectedQuestion = NSM_QUESTIONS.find(function(q) { return q.id === data.question_id; }) || data.question_json;
        AppState.nsmNsmDraft = data.user_nsm || '';
        AppState.nsmBreakdownDraft = data.user_breakdown || {};
        render();
      }).catch(function() {});
```

Replace with:
```js
      .then(function(data) {
        AppState.nsmSession = data;
        AppState.nsmSelectedQuestion = NSM_QUESTIONS.find(function(q) { return q.id === data.question_id; }) || data.question_json;
        AppState.nsmNsmDraft = data.user_nsm || '';
        AppState.nsmBreakdownDraft = data.user_breakdown || {};
        if (!data.scores_json) AppState.nsmStep = 3;
        render();
      }).catch(function() {});
```

- [ ] **Step 2: Visual verify — completed session**

Open the app and log in with `albertpeng678@gmail.com`. Click a **completed** NSM session from the history sidebar (offcanvas). Confirm it goes directly to the Step 4 report view with the radar chart and scores visible.

- [ ] **Step 3: Visual verify — in-progress session**

Click the **in-progress** NSM session from 4/22 14:57 in the history sidebar. Confirm it lands on Step 3 (the NSM definition + breakdown evaluation form), NOT a loading spinner. Confirm the question context is loaded and the user's previous draft (if any) is pre-filled.

- [ ] **Step 4: Commit**

```bash
git add public/app.js
git commit -m "fix(nsm): redirect in-progress sessions to step 3 instead of infinite loading spinner"
```

---

### Task 2: Declutter mobile navbar — icon-only logout + hide email on mobile

**Files:**
- Modify: `public/app.js:312` — change logout to icon button
- Modify: `public/style.css:70-77` — add mobile hide rule for email

**Root cause:**
On 320–390px viewports the `.navbar-actions` contains three items in a row:
- `.navbar-email` up to 120px
- `btn btn-ghost` "登出" with `padding: 8px 16px` ≈ 60px wide
- `btn-icon` theme toggle ≈ 40px

Total right side ≈ 228px + gaps. With the left side (hamburger + logo ≈ 110px), the total exceeds most narrow phone widths and looks visually cramped.

**Fix A:** Replace the "登出" text button with an icon-only `btn-icon` (using the `ph-sign-out` phosphor icon, already loaded). This saves ~45px.

**Fix B:** Add `@media (max-width: 479px) { .navbar-email { display: none; } }` to hide the email entirely on narrow screens. On ≥480px it stays visible with the existing `max-width: 220px` rule. The email is only informational (account identification) and is implicitly visible to the authenticated user.

- [ ] **Step 1: Replace text logout button with icon logout button in renderNavbar()**

In `public/app.js`, find line 312:
```js
      <button class="btn btn-ghost" id="btn-logout">登出</button>
```

Replace with:
```js
      <button class="btn-icon" id="btn-logout" title="登出"><i class="ph ph-sign-out"></i></button>
```

- [ ] **Step 2: Add mobile email hide rule in CSS**

In `public/style.css`, find the existing media query block at lines 75-77:
```css
@media (min-width: 480px) {
  .navbar-email { max-width: 220px; }
}
```

Replace with:
```css
@media (max-width: 479px) {
  .navbar-email { display: none; }
}
@media (min-width: 480px) {
  .navbar-email { max-width: 220px; }
}
```

- [ ] **Step 3: Visual verify — narrow viewport (320px)**

DevTools → Toggle device toolbar → set width to **320px**. Log in with a long email (`111464029@g.nccu.edu.tw`). Confirm:
- Logo "PM Drill" is fully visible and not compressed
- Navbar-right shows ONLY the logout icon and theme icon — no email, no cramping
- Both icons have adequate tap targets (≥ 40px)

- [ ] **Step 4: Visual verify — wide viewport (480px+)**

Set DevTools width to **540px**. Confirm:
- Email is visible and truncated to ≤220px with `…`
- Logout icon and theme icon are both visible
- No overflow or cramping

- [ ] **Step 5: Commit**

```bash
git add public/app.js public/style.css
git commit -m "fix(navbar): icon-only logout button + hide email below 480px to eliminate mobile crowding"
```

---

### Task 3: Strict UIUX Auditor Review + Fix All Findings

**Files:** Whatever the auditor identifies.

**Purpose:** Dispatch an extremely strict mobile UIUX auditor to verify both fixes and catch any regressions.

- [ ] **Step 1: Dispatch superpowers:code-reviewer agent**

Invoke the `superpowers:code-reviewer` skill with this exact prompt:

> You are an extremely strict mobile UI/UX auditor with Apple HIG and Material You expertise. Review the changes made to `public/app.js` and `public/style.css` in the most recent 2 commits. Focus on:
>
> **A. NSM In-Progress Session Load (Bug 1 fix)**
> 1. In-progress NSM session from history → lands on Step 3 (not loading spinner). Step 3 shows the NSM definition form and breakdown fields.
> 2. Question context (`nsmSelectedQuestion`) is loaded correctly and shown at top of Step 3.
> 3. User's previous draft (if any) is pre-populated in the NSM field and breakdown fields.
> 4. Completed NSM session from history → still lands on Step 4 (report). Radar chart and scores are visible.
>
> **B. Navbar Declutter (Bug 2 fix)**
> 5. At 320px width: navbar shows ONLY hamburger | logo ... logout-icon | theme-icon. Email NOT visible. No overflow.
> 6. At 480px+ width: email IS visible, truncated with `…` if long. Logout icon and theme icon both visible.
> 7. Logout icon has `title="登出"` for accessibility.
> 8. No remaining cramping or overflow at any viewport 320px–768px.
>
> **C. Regression checks**
> 9. Guest mode (not logged in): navbar shows 登入 button (text, not icon) + theme icon — unchanged.
> 10. Report view: home icon still appears before logout icon in auth mode — unchanged.
> 11. NSM Step 1 (new session): selecting a question still navigates to Step 2 — unchanged.
> 12. NSM Step 4 (completed session): radar chart renders with all 5 labels — unchanged.
>
> Output: **PASS** or **FAIL** for each item with specific file path + line number for each failure.

- [ ] **Step 2: Fix ALL FAIL items**

For each FAIL item, make the specific CSS/JS fix. No FAIL item is acceptable to ship.

- [ ] **Step 3: Re-verify all fixed items pass**

Manually verify in DevTools (320px and 480px viewports) that each previously-failed item now passes.

- [ ] **Step 4: Final commit if any fixes were needed**

```bash
git add public/style.css public/app.js
git commit -m "fix(uiux): apply strict auditor recommendations — nsm load and navbar"
```

---

## Self-Review Checklist

**Spec coverage:**
- ✅ Bug 1 (in-progress NSM session shows infinite spinner) → Task 1
- ✅ Bug 2 (navbar cramped on mobile) → Task 2
- ✅ Strict UIUX auditor requirement → Task 3

**Placeholder scan:** All steps contain exact code or exact commands. No "TBD" or "handle appropriately" language.

**Type consistency:**
- `AppState.nsmStep` is set to `3` (integer) — consistent with all other `nsmStep` assignments in the file.
- `ph-sign-out` is a valid Phosphor icon (same icon set used throughout: `ph-sun`, `ph-moon`, `ph-house`, `ph-list`, `ph-circle-notch`).
- Media query breakpoint `479px / 480px` is consistent with existing breakpoint in the file.
