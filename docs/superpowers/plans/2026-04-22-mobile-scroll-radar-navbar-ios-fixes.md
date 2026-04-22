# Mobile UX Fixes: Scroll / Radar / Navbar / iOS Bounce Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 5 mobile UX regressions: navbar email compresses logo, NSM can't scroll, NSM radar never updates, both radar charts clip labels, iOS browser bounces during load.

**Architecture:** All fixes are pure frontend — `public/app.js` (JS logic) and `public/style.css` (CSS). No backend changes. Each task is independent and self-verifiable by visual inspection on a mobile viewport (or DevTools device emulation).

**Tech Stack:** Vanilla JS, SVG, CSS custom properties, iOS Safari dvh/overscroll APIs.

---

## File Map

| File | Changes |
|---|---|
| `public/style.css` | Task 1 (navbar email), Task 2 (nsm-body min-height), Task 4 (radar SVG sizing), Task 5 (overscroll) |
| `public/app.js` | Task 1 (email span class), Task 3 (renderNSMRadar), Task 4 (renderRadar sizing) |

---

### Task 1: Fix navbar email compression on mobile

**Files:**
- Modify: `public/style.css` — add `.navbar-logo` flex-shrink and `.navbar-email` truncation
- Modify: `public/app.js:311` — add class to email span

**Root cause:** The email `<span>` in `renderNavbar()` has no `max-width` or `overflow: hidden`, so when the email is long (e.g. `111464029@g.nccu.edu.tw`) it pushes everything left and the logo flex-item shrinks vertically.

- [ ] **Step 1: Add CSS for navbar email truncation**

In `public/style.css`, find the block starting at line 63:
```css
.navbar-logo { font-size: 1.1rem; font-weight: 700; color: var(--accent); }
.navbar-actions { display: flex; gap: 8px; align-items: center; }
```

Replace with:
```css
.navbar-logo { font-size: 1.1rem; font-weight: 700; color: var(--accent); flex-shrink: 0; }
.navbar-actions { display: flex; gap: 8px; align-items: center; min-width: 0; }
.navbar-email {
  color: var(--text-secondary); font-size: 0.85rem;
  max-width: 120px; overflow: hidden; text-overflow: ellipsis;
  white-space: nowrap; flex-shrink: 1; min-width: 0;
}
@media (min-width: 480px) {
  .navbar-email { max-width: 220px; }
}
```

- [ ] **Step 2: Update renderNavbar() to use the new class**

In `public/app.js`, find line 311:
```js
      <span style="color:var(--text-secondary);font-size:0.85rem">${AppState.user?.email}</span>
```

Replace with:
```js
      <span class="navbar-email" title="${AppState.user?.email || ''}">${AppState.user?.email || ''}</span>
```

- [ ] **Step 3: Visual verify**

Open DevTools → Toggle device toolbar → select iPhone 12 Pro (390px wide). Log in with a long email. Confirm the logo stays on one line and the email truncates with `…`.

- [ ] **Step 4: Commit**

```bash
git add public/style.css public/app.js
git commit -m "fix(navbar): truncate long email, prevent logo compression on mobile"
```

---

### Task 2: Fix NSM body scroll on mobile (min-height: 0)

**Files:**
- Modify: `public/style.css:740` — add `min-height: 0` to `.nsm-body`

**Root cause:** `.nsm-body` is `flex: 1; overflow-y: auto` but without `min-height: 0`. In a flex container, the default `min-height: auto` lets the child expand to fit content — the `overflow-y: auto` never activates. Adding `min-height: 0` forces the flex child to respect the parent constraint and enables scroll.

`.nsm-report-body` already has `min-height: 0` (correct) — `.nsm-body` does not.

- [ ] **Step 1: Add min-height: 0 and -webkit-overflow-scrolling to .nsm-body**

In `public/style.css`, find line 740:
```css
.nsm-body { flex: 1; overflow-y: auto; padding: 16px; }
```

Replace with:
```css
.nsm-body { flex: 1; overflow-y: auto; padding: 16px; min-height: 0; -webkit-overflow-scrolling: touch; }
```

- [ ] **Step 2: Boundary check — verify practice scroll still works**

The practice view already has:
```css
body[data-view="practice"] .chat-scroll { flex: 1; overflow-y: auto; min-height: 0; }
```
This is correct. No change needed.

- [ ] **Step 3: Boundary check — home / history views**

Home (`renderHome`) and history (`renderHistory`) do NOT use a flex scroll pattern — they rely on normal document scroll (`#app` uses `min-height: 100dvh` + `overflow: visible`). These do not need `min-height: 0`.

- [ ] **Step 4: Visual verify**

DevTools → iPhone → NSM wizard Step 1. Select a question card that shows a long context preview. Confirm the body area scrolls (drag up) and the fixed bottom button stays pinned.

- [ ] **Step 5: Commit**

```bash
git add public/style.css
git commit -m "fix(nsm): add min-height:0 to nsm-body to enable flex scroll on iOS"
```

---

### Task 3: Fix NSM radar chart (create renderNSMRadar)

**Files:**
- Modify: `public/app.js:1077` region — add `renderNSMRadar` function
- Modify: `public/app.js:1720` — call `renderNSMRadar` instead of `renderRadar`

**Root cause:** `renderRadar(scores)` iterates `Object.keys(DIM_LABELS)` which are the PM practice keys (`roleClarity, taskBreakpoint, workaround, lossQuantification, definitionQuality`). NSM scores use keys `alignment, leading, actionability, simplicity, sensitivity`. Also, `renderRadar` reads `scores[d]?.score` (expecting an object with `.score`) but NSM scores are plain integers. So every NSM radar renders a zero-sized polygon.

- [ ] **Step 1: Add NSM_DIM_LABELS constant and renderNSMRadar function**

In `public/app.js`, immediately **after** the closing `}` of `renderRadar` function (around line 1110), insert:

```js
const NSM_DIM_LABELS = {
  alignment:     '價值關聯',
  leading:       '領先指標',
  actionability: '操作性',
  simplicity:    '可理解性',
  sensitivity:   '週期敏感',
};

function renderNSMRadar(scores) {
  const dims = Object.keys(NSM_DIM_LABELS);
  const size = 260;
  const cx = size / 2, cy = size / 2, r = 80;
  const n = dims.length;
  const toXY = (i, val) => {
    const angle = (Math.PI * 2 * i / n) - Math.PI / 2;
    const rv = (val / 5) * r;
    return [cx + rv * Math.cos(angle), cy + rv * Math.sin(angle)];
  };
  const labelXY = (i) => {
    const angle = (Math.PI * 2 * i / n) - Math.PI / 2;
    return [cx + (r + 32) * Math.cos(angle), cy + (r + 32) * Math.sin(angle)];
  };
  const circles = [0.25, 0.5, 0.75, 1].map(f =>
    `<circle cx="${cx}" cy="${cy}" r="${r*f}" fill="none" stroke="var(--border)" stroke-width="1"/>`
  ).join('');
  const axes = dims.map((_, i) => {
    const [x, y] = toXY(i, 5);
    return `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="var(--border)" stroke-width="1"/>`;
  }).join('');
  const points = dims.map((d, i) => toXY(i, scores[d] || 0).join(',')).join(' ');
  const polygon = `<polygon points="${points}" fill="var(--accent)" fill-opacity="0.25" stroke="var(--accent)" stroke-width="2"/>`;
  const labels = dims.map((d, i) => {
    const [x, y] = labelXY(i);
    return `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="middle" font-size="10" fill="var(--text-secondary)">${NSM_DIM_LABELS[d]}</text>`;
  }).join('');
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${circles}${axes}${polygon}${labels}</svg>`;
}
```

- [ ] **Step 2: Replace renderRadar call in renderNSMStep4**

In `public/app.js`, find line 1720:
```js
  const radarSvg = scores.scores ? renderRadar(scores.scores) : '';
```

Replace with:
```js
  const radarSvg = scores.scores ? renderNSMRadar(scores.scores) : '';
```

- [ ] **Step 3: Visual verify**

Open an NSM session that has been evaluated. Go to Step 4 Overview tab. Confirm the radar chart shows a polygon that matches the scores (not a dot at the center). Check that all 5 dimension labels are visible and correct (價值關聯, 領先指標, 操作性, 可理解性, 週期敏感).

- [ ] **Step 4: Commit**

```bash
git add public/app.js
git commit -m "fix(nsm): add renderNSMRadar — correct dimensions and score format for NSM radar chart"
```

---

### Task 4: Fix radar chart label clipping (both PM and NSM)

**Files:**
- Modify: `public/app.js:1077-1109` — `renderRadar` function sizing
- (renderNSMRadar already uses correct sizing from Task 3)

**Root cause:** `renderRadar` uses `size=220`, `cx=cy=110`, `r=80`, label radius `r+24=104`. The top label sits at `y = 110 - 104 = 6` px from the SVG edge. With `font-size=10` and `dominant-baseline: middle`, the text extends from `y=1` to `y=11` — exactly at the clip boundary. The upper-left label at `x ≈ 11` clips for longer text. Increasing to `size=260` gives `cx=cy=130` and top label at `y=20`, upper-left at `x≈25` — safely padded.

- [ ] **Step 1: Update renderRadar to use size=260**

In `public/app.js`, find the `renderRadar` function starting at line 1077. Find the lines:
```js
  const size = 220;
  const cx = size / 2, cy = size / 2, r = 80;
```

Replace with:
```js
  const size = 260;
  const cx = size / 2, cy = size / 2, r = 80;
```

Then find:
```js
  const labelXY = (i) => {
    const angle = (Math.PI * 2 * i / n) - Math.PI / 2;
    return [cx + (r + 24) * Math.cos(angle), cy + (r + 24) * Math.sin(angle)];
  };
```

Replace with:
```js
  const labelXY = (i) => {
    const angle = (Math.PI * 2 * i / n) - Math.PI / 2;
    return [cx + (r + 32) * Math.cos(angle), cy + (r + 32) * Math.sin(angle)];
  };
```

- [ ] **Step 2: Ensure SVG is responsive in CSS**

In `public/style.css`, find:
```css
.radar-container { ... }
```
(Search for `.radar-container` — it may be near line 1233 region or in the report section.)

Add or update to include:
```css
.radar-container svg,
.nsm-radar-wrap svg {
  max-width: 260px;
  width: 100%;
  height: auto;
  display: block;
  margin: 0 auto;
}
```

If `.radar-container` already sets a `width`, ensure `max-width: 260px` takes precedence. If the rule doesn't exist, add it near the existing `.radar-container` rule.

- [ ] **Step 3: Visual verify**

Open a PM practice Report (any completed session). Check the radar chart — all 5 labels should be fully visible on all sides. Repeat for NSM Step 4 Overview tab.

- [ ] **Step 4: Commit**

```bash
git add public/app.js public/style.css
git commit -m "fix(radar): increase SVG size to 260 and label radius to prevent clipping"
```

---

### Task 5: Fix iOS browser loading state overscroll bounce

**Files:**
- Modify: `public/style.css` — add overscroll-behavior and body/html height fix

**Root cause:** During page load on iOS Safari, `body { min-height: 100vh }` uses the "large viewport" height (before browser chrome collapses). This creates extra scroll space, enabling the rubber-band bounce. Additionally, there is no `overscroll-behavior: none` to suppress it. The page slides and shifts during the loading state.

- [ ] **Step 1: Add overscroll-behavior and height containment to html/body**

In `public/style.css`, find the `body` rule near line 44:
```css
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  background: var(--bg-primary);
  color: var(--text-primary);
  min-height: 100vh;
  transition: background 0.2s, color 0.2s;
}
```

Replace with:
```css
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  background: var(--bg-primary);
  color: var(--text-primary);
  min-height: 100vh;
  transition: background 0.2s, color 0.2s;
  overscroll-behavior: none;
}
```

Then find (or add right before the `body` rule) an `html` rule:
```css
html {
  overscroll-behavior: none;
}
```

If an `html` rule already exists in the file, add `overscroll-behavior: none` to it. If it doesn't exist, add it as a new rule before the `body` block.

- [ ] **Step 2: Add touch-action containment for fixed NSM view**

In `public/style.css`, find the NSM view rule (around line 733):
```css
.nsm-view { display: flex; flex-direction: column; height: 100%; overflow: hidden; background: var(--bg-primary); }
```

Replace with:
```css
.nsm-view { display: flex; flex-direction: column; height: 100%; overflow: hidden; background: var(--bg-primary); overscroll-behavior: contain; }
```

- [ ] **Step 3: Visual verify**

On iPhone (or Safari DevTools mobile emulation), load the site. Slowly drag the page — it should NOT bounce or shift. For NSM view, swipe within `.nsm-body` — the scroll area should scroll while the outer page stays locked.

- [ ] **Step 4: Commit**

```bash
git add public/style.css
git commit -m "fix(ios): add overscroll-behavior:none to prevent bounce during loading"
```

---

### Task 6: Strict UI/UX Auditor Review + Fix All Findings

**Files:** Whatever the auditor identifies.

**Purpose:** Dispatch the same rigorous auditor agent from the previous session to catch any remaining regressions or new issues introduced by Tasks 1-5.

- [ ] **Step 1: Dispatch superpowers:code-reviewer agent**

Invoke the `superpowers:code-reviewer` skill with the prompt:

> You are an extremely strict mobile UI/UX auditor with Apple HIG and Material You expertise. Review the changes made to `public/app.js` and `public/style.css` in the last 5 commits. Focus on:
> 1. Navbar: logo visible and not compressed on 320px wide viewport. Email correctly truncates.
> 2. NSM scroll: Steps 1-3 all scroll correctly. Fixed bottom bar stays pinned. No content hidden under bar.
> 3. Radar charts: All labels visible on both PM practice report and NSM Step 4 Overview. NSM radar polygon reflects actual scores.
> 4. iOS overscroll: No rubber-band bounce on page load. NSM scroll area scrolls; background stays fixed.
> 5. Any new regressions (broken layouts, invisible text, wrong colors, etc.)
> Output: PASS or FAIL for each item with specific selectors and line numbers for each failure.

- [ ] **Step 2: Fix ALL FAIL items**

For each FAIL item from the auditor, make the specific CSS/JS fix. No FAIL item is acceptable to ship.

- [ ] **Step 3: Re-verify all fixed items pass**

Manually verify in DevTools (iPhone 12 Pro 390px, and Galaxy S20 360px) that each previously-failed item now passes.

- [ ] **Step 4: Final commit**

```bash
git add public/style.css public/app.js
git commit -m "fix(uiux): apply all strict auditor recommendations — scroll, radar, navbar, ios"
```

---

## Self-Review Checklist

**Spec coverage:**
- ✅ Issue 1 (email compression) → Task 1
- ✅ Issue 2 (NSM can't scroll) → Task 2
- ✅ Issue 3 (NSM radar not updating) → Task 3
- ✅ Issue 4 (both radars clip labels) → Task 4
- ✅ Issue 5 (iOS bounce) → Task 5
- ✅ Strict auditor requirement → Task 6

**Placeholder scan:** All steps contain exact CSS/JS code or exact commands. No "TBD" or "handle appropriately" language.

**Type consistency:** `renderNSMRadar` is defined in Task 3 Step 1 and called in Task 3 Step 2. `NSM_DIM_LABELS` is defined before `renderNSMRadar`. Both `renderRadar` and `renderNSMRadar` use the same sizing parameters (size=260, r=80, labelRadius=r+32) — consistent.
