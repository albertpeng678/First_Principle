# Eyeball Walk — C-Drift-4 (TEMPLATE, to be filled post-implement)

> **Purpose**: RITUAL §6 ship checklist evidence for Wave 2 commit C-Drift-4 (functional gap + maint debt: D-12 + D-13 + STANDING memory).
> **Plan ref**: `audit/p2-c-drift-4-plan.md`
> **Implementer fills**: §1-§5 below. **Director cold-Reads**: §3 PNG comments. **User**: §4 UAT walk + §5 signoff.
> **Source**: GAP-7 mitigation per `audit/phase-a-prep-gaps-1-4-5-7-mitigation.md` §D.
> **Note**: NSM home recent rail is a NEW visible feature. Plan recommends DEFER hint modal unify (row 26-30) to C-Drift-5; this template covers D-12 + D-13 + STANDING memory only.

---

## §1 Behavior coverage matrix

| # | Audit ref | Behavior under test | PNG row in §3 |
|---|---|---|---|
| 1 | D-12 (P1 gap) | NSM home right rail shows recent NSM practices (desktop only) | row 1 |
| 2 | D-12 click-restore | Click recent rail item → restore that NSM session | (UAT walk only — uses same restore path as D-2) |
| 3 | D-13 (P2 latent) | Delete NSM session in offcanvas → home rail refreshes, item gone | row 2 |
| 4 | STANDING memory | New `feedback_nsm_circles_shared_helper_mandate.md` file added | (no PNG — file presence check) |

---

## §2 Screenshot capture commands (implementer pastes output)

```bash
# 3 viewport × 2 visible behavior rows = 6 PNGs total
# NOTE: NSM recent rail is desktop-only per mockup 06 (3-col 200/1fr/220 desktop, single col mobile)
# Mobile viewports SKIP row 1 (rail hidden). Mobile row 2 captures cache invalidation via re-navigate.

npx playwright test --config tests/e2e/playwright.config.js tests/visual/capture-c-drift-4-pngs.spec.js --reporter=list

# Expected PNG count:
# Row 1: desktop only (mobile hides rail) = 1 PNG
# Row 2: desktop + mobile-chrome + mobile-safari = 3 PNGs
# Plus mockup ref shot of mockup 06 recent rail = 1 PNG
# Total: 5 PNGs
```

Output paste (implementer):
```
<paste 5 PNG paths here>
```

---

## §3 Director cold-Read (≥1 sentence per PNG)

### Row 1 — NSM home recent rail (desktop only)

| Viewport | PNG path | Director comment |
|---|---|---|
| desktop | `audit/c-drift-4-evidence/row1-desktop.png` | <fill: right rail visible 220px wide, shows ≤5 NSM session cards, each card has title + timestamp + score badge> |
| mobile-chrome | (rail hidden — skip per mockup 06) | n/a |
| mobile-safari | (rail hidden — skip) | n/a |

### Row 2 — Delete NSM session → rail refreshes

| Viewport | PNG path | Director comment |
|---|---|---|
| desktop | `audit/c-drift-4-evidence/row2-desktop.png` | <fill: deleted item NO LONGER in rail after offcanvas delete confirm> |
| mobile-chrome | `audit/c-drift-4-evidence/row2-mobile-chrome.png` | <fill: rail not visible BUT after toggle to desktop viewport mid-session, deleted item gone> |
| mobile-safari | `audit/c-drift-4-evidence/row2-mobile-safari.png` | <fill> |

### Mockup baseline

| Mockup | PNG path | Director comment |
|---|---|---|
| 06 desktop recent rail | `docs/superpowers/specs/mockups/.../06-nsm-step-1.html` (rendered) | <fill: confirms rail position + card shape matches production row 1> |

---

## §4 User UAT SOP

```
1. Start dev server: npm run dev (port 4000)
2. Login: e2e@first-principle.test
3. Pre-condition: practice at least 3 NSM sessions to populate recent rail

Test D-12 NSM recent rail display:
4. Open desktop viewport (≥1024px wide)
5. Navigate to NSM tab (home)
6. EXPECT: right column shows "近期 NSM 練習" header + ≤5 session cards
7. EXPECT: each card shows question title, score badge (if scored), updated_at timestamp
8. EXPECT: cards sorted by updated_at DESC (newest first)

Test D-12 click-restore:
9. Click any session card in the rail
10. EXPECT: navigates to that NSM session (Step 2 or Step 3 based on session state)
11. EXPECT: session content matches the card (verify question title in Step 2 head)

Test D-12 empty state:
12. Logout → login as new user (e.g. e2e+empty@first-principle.test)
13. Open NSM tab on desktop
14. EXPECT: rail shows "尚無 NSM 練習" placeholder (per plan §2 Fix 1 renderer)

Test D-13 cache invalidation:
15. As main test user, NSM home → note 1st card in rail (let's call it session X)
16. Open offcanvas → find session X → click delete icon → confirm
17. EXPECT: toast "已刪除"
18. Without reloading, navigate back to NSM home
19. EXPECT: session X is NO LONGER in the rail
20. EXPECT: 2nd-most-recent session moved up to position 1

Test mobile rail hidden (mockup 06 contract):
21. Resize browser to ≤767px wide
22. EXPECT: rail not visible (hidden via CSS media query)
23. EXPECT: NSM home main content fills full width
24. UAT confirms no horizontal scroll, no layout broken
```

---

## §5 Mockup ↔ production pixel-diff

```
Mockup ref: docs/superpowers/specs/mockups/2026-05-02-frontend-rewrite/06-nsm-step-1.html
  - 3-col layout 200/1fr/220 with recent rail in right column
  - Card shape: title (heading), eyebrow (timestamp), badge (score)

Pixel-diff command (desktop only — mobile rail hidden):
  npx playwright test --config tests/visual/playwright.config.js tests/visual/c-drift-4-pixel-diff.spec.js --project=visual-desktop --reporter=list

Threshold: 0.5%

Diff report: tests/visual/diffs/c-drift-4-report.md (NEW)

Result paste:
<paste threshold pass/fail per row>
```

---

## §6 Invariants (functional + maint)

```
Invariant 1: nsmRecentSessions state machine
- Initial: AppState.nsmRecentSessions === null (placeholder shows "載入中…")
- After loadNsmHistoryForRail success: === [] (empty user) OR === Array (≤5 items)
- After loadNsmHistoryForRail error: === [] (placeholder shows "尚無 NSM 練習")
- jest tests cover all 3 transitions

Invariant 2: cache invalidation on delete (D-13)
- _doOffcanvasDelete now sets AppState.nsmRecentSessions = null
- (Mirrors existing CIRCLES line in same function: AppState.circlesRecentSessions = null)
- After delete + render() → renderNSMRecentRail re-triggers loadNsmHistoryForRail
- EXPECT: deleted session not in returned list

Invariant 3: cache invalidation on auth change
- Logout: AppState.nsmRecentSessions = null (mirror existing logout handler)
- Login: AppState.nsmRecentSessions = null (mirror existing login handler)
- 3 sites total in app.js — implementer enumerates via grep "circlesRecentSessions = null"

Invariant 4: loadNsmHistoryForRail uses NSM-only endpoint
- Endpoint: /api/nsm-sessions (auth) OR /api/guest/nsm-sessions (guest)
- NOT /api/sessions (mixed) — NSM rail shows NSM only

Invariant 5: STANDING memory file exists
- Path: ~/.claude/projects/<project>/memory/feedback_nsm_circles_shared_helper_mandate.md
- Content: per plan §2 Fix 3
- Memory index updated: ~/.claude/projects/<project>/memory/MEMORY.md adds reference line
```

---

## §7 Scope boundary (DEFER hint modal unify)

```
DEFERRED to C-Drift-5 (NOT in this commit):
- Row 26-30 hint modal 4 shell → 1 unification (large refactor; plan §2 Fix 4)
  - app.js:3959 + 4124 + 4231 + 4373 — 4 hint modal shells
  - Requires param shape design ({ headIcon, labelText, bodyHtml, retryAttr, retryArgs, isLoading, isError, isStep1 })
  - Defer rationale: not P1; risk to ship velocity if bundled

OPTIONAL in this commit (implementer judgment):
- Row 31 progress class align (3 progress bar functions, app.js:4511 + 6515 + 6226)
  - S effort
  - If implementer has time budget: include; else defer
```

---

## §8 User signoff

```
Director cold-Read complete: <PASS / FAIL — fill>
User UAT walk complete: <PASS / FAIL — fill>
Pixel-diff under threshold: <PASS / FAIL — fill>
Invariants 1-5 verified: <PASS / FAIL — fill>
STANDING memory file present: <PASS / FAIL — fill>
Hint modal unify deferred to C-Drift-5: <CONFIRM — fill>

User signoff: "<對> @ <YYYY-MM-DD HH:MM>" or "<待修> + 1-line reason"

Tracker append: audit/e2e-master-tracker.md §5 — "<C-Drift-4> ship @ <SHA>"
Tracker move: §2 D-12 / D-13 entries → §5 resolved log; §3 COMMON design issue → §5 with STANDING memory ref
```
