# L23 Orphan Cleanup — O-9: Delete `renderQchipPanelHtml`

**Date:** 2026-05-17
**Lane:** L23
**Closes:** O-9 (master tracker §6)

---

## Function Deleted

**File:** `public/app.js`
**Lines deleted:** 803–818 (original line numbers before deletion)
**Size:** 15 lines (3-line comment block + 12-line function body)

Deleted block:

```
// ── renderQchipPanelHtml (shared helper — Stage 1C B5 fix) ───────────────
// Panel is hidden by default (display:none inline); toggleQchipPanel controls visibility.
// CSS class .is-open is also added for caret rotate (via style.css T5).
function renderQchipPanelHtml(q) {
  var typeMap = { improve: '改善題', strategy: '策略題', design: '設計題' };
  var typeLabel = typeMap[q.question_type] || '設計題';
  var body = q.problem_statement || '';
  return '<div class="qchip-panel" data-phase2="qchip-panel" style="display:none">'
    + '<div class="qchip-panel__type"><i class="ph ph-tag"></i>' + escHtml(typeLabel) + '</div>'
    + '<div class="qchip-panel__body">' + escHtml(body) + '</div>'
    + '<button class="qchip-panel__close" data-phase2="qchip-panel-close">'
    + '<i class="ph ph-caret-up"></i>收合題目'
    + '</button>'
    + '</div>';
}
```

---

## Grep Verification — Zero Callers

```
grep -n "renderQchipPanelHtml" public/app.js
→ (no output — function fully removed)

grep -rn "renderQchipPanelHtml" tests/ public/ index.html
→ No matches in tests/ or index.html
```

Additional exhaustive search across all .js/.html/.json/.md files (excluding node_modules and .git):
- All remaining matches are in `docs/` (plan/spec documents) and `audit/` files — historical references only.
- Zero live callers in any executable code path.

**Background:** chat-drift Wave 1-4 (commit `49d00ba`) swapped Phase 2 rendering from `renderQchipPanelHtml` to `renderQchipExpand`. The old function became dead code with zero callers, as documented in `audit/e2e-master-tracker.md` O-9.

---

## Verification Results

### jest full suite
- **Result:** 535/552 passed
- **Baseline:** ≥ 535/552 required
- **Status:** PASS — no regression

### circles-back-nav-lock e2e (3 projects × 5 TC + setup = 16 total)
- **Result:** 16/16 passed
- **Projects:** e2e-desktop + e2e-mobile-chrome + e2e-mobile-safari
- **Config:** `tests/e2e/playwright.config.js`
- **Status:** PASS

### Server health
- `http://localhost:4000` responsive (dev server unchanged)

---

## Outcome

O-9 closed. Dead code removed. No regression. Pure deletion — no replacement, no refactor.
