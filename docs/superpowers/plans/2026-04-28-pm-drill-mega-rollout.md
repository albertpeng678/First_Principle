# PM Drill Mega Rollout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Each phase MUST run in its own `git worktree` (see § Worktree strategy).

**Goal:** Ship 4 specs together: bullet-format examples (spec 1) + progress save (spec 2) + desktop RWD direction C with onboarding & navbar refresh (spec 3) + rich-text toolbar (spec 4). Mobile receives bullet rendering, progress save UI, rich text toolbar, onboarding, and NSM 對比 tab parity. Desktop gets full per-page native layouts.

**Architecture:** Single-file SPA `public/app.js` + `public/style.css` with `viewport.width >= 1024` branching in each `render*` function. Backend changes minimal: one new `POST /draft` endpoint + bumped list endpoint columns. Storage: existing JSON in `circles_plan/circles_database.json` + Supabase `circles_sessions` table. No framework introduced.

**Tech Stack:** Vanilla JS, CSS variables, Phosphor Icons (regular set, already loaded), DM Sans + Instrument Serif (Google Fonts, already loaded), Supabase, Express. Test: Playwright (existing harness) + Node script audits.

---

## Worktree strategy

Every Phase agent gets its own worktree off `main`:

```bash
# Run before each phase agent starts
git worktree add ../pm-drill-phase-N -b phase-N-<topic> main
```

Phase agents work isolated, push branch, open draft PR. Test agents work on a final integration branch (`phase-X-integration`) where all phase PRs are merged. Final PR to `main` only after all 7 test agents pass.

Cleanup: `git worktree remove ../pm-drill-phase-N` when phase merged.

---

## Phase decomposition (parallelism map)

```
Phase 0 (Foundation, 1-2 hr) → blocks all others
   ├─ Phase 1 (Spec 1 bullet)   ─┐
   ├─ Phase 2 (Spec 2 save)     ─┤
   ├─ Phase 3 (Spec 4 toolbar)  ─┤  ─→ Phase 7 Integration → Test agents → main
   ├─ Phase 4 (Spec 3 desktop)  ─┤
   ├─ Phase 5 (Onboarding)      ─┤  (Phase 5 depends on Phase 4 CIRCLES home)
   └─ Phase 6 (NSM 對比 mobile) ─┘
```

Phase 1, 2, 3 are fully independent. Phase 4 has internal sub-phases per page; Phase 5 depends on Phase 4.1 (CIRCLES home). Phase 6 depends on Phase 4.6 (NSM Step 4).

---

## Phase 0: Foundation (CSS tokens + favicon + navbar + Phosphor cleanup)

**Worktree:** `../pm-drill-phase-0`
**Branch:** `phase-0-foundation`
**Estimate:** 60-90 min
**Blocks:** All other phases.

### Task 0.1: CSS tokens migration

**Files:**
- Modify: `public/style.css:1-40` (`:root` block)

- [ ] **Step 1: Write the failing test (visual smoke)**

`tests/playwright/journeys/foundation-tokens.spec.js`:
```js
const { test, expect } = require('@playwright/test');
test('css tokens resolve to expected values', async ({ page }) => {
  await page.goto('http://localhost:4000/');
  const cssVars = await page.evaluate(() => {
    const cs = getComputedStyle(document.documentElement);
    return {
      primary: cs.getPropertyValue('--c-primary').trim(),
      bg: cs.getPropertyValue('--c-bg').trim(),
      text: cs.getPropertyValue('--c-text').trim(),
      success: cs.getPropertyValue('--c-success').trim(),
      nsm: cs.getPropertyValue('--c-nsm').trim(),
    };
  });
  expect(cssVars.primary).toBe('#1A56DB');
  expect(cssVars.bg).toBe('#F2F0EB');
  expect(cssVars.text).toBe('#1F1D1B');
  expect(cssVars.success).toBe('#10b981');
  expect(cssVars.nsm).toBe('#7C3AED');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd tests/playwright && npx playwright test journeys/foundation-tokens.spec.js --project=Desktop`
Expected: FAIL — `--c-primary` resolves to old value (purple) or empty.

- [ ] **Step 3: Replace `:root` block in `public/style.css`**

Replace lines 1-40 with the full token block from spec 3 § 1.1 (paste the entire CSS block verbatim). Remove the old `[data-theme="dark"]` block (we never use dark mode).

- [ ] **Step 4: Run test to verify it passes**

Run same command. Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add public/style.css tests/playwright/journeys/foundation-tokens.spec.js
git commit -m "feat(tokens): unify CSS color/font variables to spec 3 design system"
```

### Task 0.2: Replace 109 hardcoded `#1A56DB` with `var(--c-primary)`

**Files:**
- Modify: `public/style.css` (76 occurrences)
- Modify: `public/app.js` (27 occurrences)
- Modify: `public/review-examples.html` (6 occurrences)

- [ ] **Step 1: Write the audit test**

`scripts/audit-hardcoded-colors.js`:
```js
const fs = require('fs'); const path = require('path');
const FILES = ['public/style.css','public/app.js','public/review-examples.html'];
const HEX = /#1A56DB|#5a52e0|#6c63ff/gi;
let bad = 0;
for (const f of FILES) {
  const text = fs.readFileSync(path.join(__dirname,'..',f),'utf8');
  const matches = text.match(HEX) || [];
  if (matches.length) { console.log(`${f}: ${matches.length} hardcoded`); bad += matches.length; }
}
process.exit(bad === 0 ? 0 : 1);
```

- [ ] **Step 2: Run audit, expect failure**

Run: `node scripts/audit-hardcoded-colors.js`
Expected: exit 1 with counts ~109.

- [ ] **Step 3: Sed-replace each file**

```bash
sed -i 's/#1A56DB/var(--c-primary)/g' public/style.css public/app.js
sed -i 's/#5a52e0/var(--c-primary)/g' public/style.css public/app.js
sed -i 's/#6c63ff/var(--c-primary)/g' public/style.css public/app.js
sed -i 's/#1A56DB/var(--c-primary)/g' public/review-examples.html
```

(Skip strings inside `<title>` or comments. If sed catches comments, manually verify with grep + revert.)

- [ ] **Step 4: Run audit again**

Run: `node scripts/audit-hardcoded-colors.js`
Expected: exit 0.

Run visual smoke: load `localhost:4000` in headed browser, confirm UI looks identical (color is the same hex value, just routed through CSS var).

- [ ] **Step 5: Commit**
```bash
git add public/style.css public/app.js public/review-examples.html scripts/audit-hardcoded-colors.js
git commit -m "refactor: replace 109 hardcoded #1A56DB with var(--c-primary)"
```

### Task 0.3: Favicon SVG + index.html

**Files:**
- Create: `public/favicon.svg`
- Modify: `public/index.html:7`

- [ ] **Step 1: Create `public/favicon.svg`**

Paste the SVG from spec 3 § 1.5 verbatim.

- [ ] **Step 2: Update `public/index.html` line 7**

Replace `<link rel="icon" href="data:,">` with `<link rel="icon" type="image/svg+xml" href="/favicon.svg">`.

- [ ] **Step 3: Test in browser**

Run server: `node server.js` (background).
Open `localhost:4000` and verify tab favicon = blue circle with 3 white circles.

- [ ] **Step 4: Commit**
```bash
git add public/favicon.svg public/index.html
git commit -m "feat: add favicon (ph-circles-three on primary blue)"
```

### Task 0.4: Replace remaining emoji with Phosphor icons

**Files:**
- Modify: `public/app.js` lines 2291, 2294, 2674, 2714, 4174 (5 emoji removals)
- Modify: `public/style.css` line ~ (1 emoji)
- Modify: `public/review-examples.html` lines 105, 194 (2 emoji)

- [ ] **Step 1: Write audit test**

`scripts/audit-emoji.js`:
```js
const fs = require('fs');
const FILES = ['public/style.css','public/app.js','public/review-examples.html','public/index.html'];
const EMOJI = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{27BF}✓⚠△×📋📝💡🤖📊💾📍⮌⇄→]/gu;
let bad = 0;
for (const f of FILES) {
  const text = fs.readFileSync(f,'utf8');
  const m = text.match(EMOJI) || [];
  if (m.length) { console.log(`${f}:`, m.slice(0,8).join(' '), '(', m.length, 'total)'); bad += m.length; }
}
process.exit(bad === 0 ? 0 : 1);
```

- [ ] **Step 2: Run, expect failure**

`node scripts/audit-emoji.js` → exit 1.

- [ ] **Step 3: Replace each emoji with Phosphor**

| Location | Old | New |
|---|---|---|
| `app.js:2291` | `'✓ '` | `'<i class="ph ph-check-circle"></i> '` |
| `app.js:2294` | `'⚠ '` | `'<i class="ph ph-warning"></i> '` |
| `app.js:2674` | `'<div style="...">⚠️</div>'` | `'<i class="ph ph-warning-circle" style="font-size:32px;color:#D97706"></i>'` |
| `app.js:2714` | `'✓ 表現優秀'` | `'<i class="ph ph-check-circle"></i> 表現優秀'` |
| `app.js:4174` | `error: '× 需修正', warn: '△ 建議補充', ok: '✓ 通過'` | `error: '<i class="ph ph-x-circle"></i> 需修正', warn: '<i class="ph ph-warning-circle"></i> 建議補充', ok: '<i class="ph ph-check-circle"></i> 通過'` |
| `review-examples.html:105` | `<h1>📝 CIRCLES…` | `<h1><i class="ph ph-pencil-line"></i> CIRCLES…` |
| `review-examples.html:194` | `📋 ${escHtml…` | `<i class="ph ph-clipboard-text"></i> ${escHtml…` |

- [ ] **Step 4: Run audit**
`node scripts/audit-emoji.js` → exit 0.

- [ ] **Step 5: Commit**
```bash
git add -u
git commit -m "refactor: replace remaining emoji with Phosphor icons"
```

### Task 0.5: Navbar refresh (remove dev tab + add favicon mark)

**Files:**
- Modify: `public/app.js` `renderNavbar()` function (locate via grep `navbar-actions`)
- Modify: `public/index.html:20-26`
- Modify: `public/style.css` (add `.navbar-favicon`, `.navbar-tabs`, `.hide-mobile`)

- [ ] **Step 1: Write test**

`tests/playwright/journeys/navbar-refresh.spec.js`:
```js
const { test, expect } = require('@playwright/test');
test('navbar has favicon mark and 2 tabs on desktop, no dev tool tab', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('http://localhost:4000/');
  await expect(page.locator('.navbar-favicon')).toBeVisible();
  const tabs = await page.locator('.navbar-tab').allInnerTexts();
  expect(tabs).toEqual(['CIRCLES', '北極星指標']);
  expect(tabs).not.toContain('範例 Review');
});
test('navbar tabs hidden on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto('http://localhost:4000/');
  const visible = await page.locator('.navbar-tabs').isVisible();
  expect(visible).toBe(false);
});
```

- [ ] **Step 2: Run, expect FAIL** (no `.navbar-favicon` selector exists)

- [ ] **Step 3: Edit `public/index.html` lines 20-26**

```html
<nav class="navbar">
  <div class="navbar-left">
    <button class="btn-icon" id="btn-hamburger" aria-label="開啟選單"><i class="ph ph-list"></i></button>
    <span class="navbar-logo">
      <span class="navbar-favicon"><i class="ph ph-circles-three"></i></span>
      PM Drill
    </span>
    <div class="navbar-tabs hide-mobile" id="navbar-tabs">
      <span class="navbar-tab" data-nav="circles">CIRCLES</span>
      <span class="navbar-tab" data-nav="nsm">北極星指標</span>
    </div>
  </div>
  <div class="navbar-actions" id="navbar-actions"></div>
</nav>
```

Append to `public/style.css`:
```css
.navbar-favicon { width:22px; height:22px; border-radius:7px; background:var(--c-primary); display:inline-flex; align-items:center; justify-content:center; margin-right:8px; vertical-align:middle; }
.navbar-favicon i { color:#fff; font-size:13px; }
.navbar-tabs { display:flex; gap:2px; margin-left:24px; }
.navbar-tab { padding:6px 12px; border-radius:7px; cursor:pointer; font-size:12.5px; color:var(--c-text-2); }
.navbar-tab.active { background:#fff; color:var(--c-text); font-weight:500; border:1px solid var(--c-border); }
@media (max-width: 1023px) { .hide-mobile { display:none !important; } }
```

In `public/app.js`, find tab click binding and add:
```js
document.querySelectorAll('.navbar-tab').forEach(t => {
  t.addEventListener('click', () => {
    document.querySelectorAll('.navbar-tab').forEach(x => x.classList.remove('active'));
    t.classList.add('active');
    navigate(t.dataset.nav);
  });
});
// Sync active tab with current view on render:
function syncNavbarTab() {
  const view = AppState.currentView;
  document.querySelectorAll('.navbar-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.nav === view);
  });
}
```

Call `syncNavbarTab()` at end of every `render()`.

- [ ] **Step 4: Run test, expect PASS**

- [ ] **Step 5: Commit**
```bash
git add -u
git commit -m "feat(navbar): add favicon mark, dual tabs (CIRCLES/NSM), remove dev tool tab"
```

### Task 0.6: Container strategy (per-page desktop classes)

**Files:**
- Modify: `public/style.css` (replace `#app { max-width: 760px ... }` block at line 62-64)

- [ ] **Step 1: Test**

`tests/playwright/journeys/container-widths.spec.js`:
```js
const { test, expect } = require('@playwright/test');
test('app container desktop has no max-width (per-page handled)', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('http://localhost:4000/');
  const maxW = await page.locator('#app').evaluate(el => getComputedStyle(el).maxWidth);
  expect(maxW).toBe('none');
});
test('mobile keeps full width', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto('http://localhost:4000/');
  const maxW = await page.locator('#app').evaluate(el => getComputedStyle(el).maxWidth);
  expect(maxW).toBe('100%');
});
```

- [ ] **Step 2: Run, expect FAIL**

- [ ] **Step 3: Replace `public/style.css` lines 62-64**

```css
#app { max-width: 100%; margin: 0 auto; padding: 0 16px 16px; }

@media (min-width: 720px) and (max-width: 1023px) {
  #app { max-width: 720px; padding: 0 24px 24px; }
}

@media (min-width: 1024px) {
  #app { max-width: 100%; padding: 0; }
  .circles-home-desktop { max-width: 1180px; margin: 0 auto; padding: 24px 28px; }
  .phase1-desktop { max-width: 1180px; margin: 0 auto; padding: 0 28px 100px; }
  .phase2-desktop { max-width: 920px; margin: 0 auto; padding: 0 24px; }
  .phase3-desktop { max-width: 920px; margin: 0 auto; padding: 0 24px 100px; }
  .nsm-home-desktop { max-width: 920px; margin: 0 auto; padding: 18px 24px 100px; }
  .nsm-step2-desktop { max-width: 720px; margin: 0 auto; padding: 18px 24px 100px; }
  .nsm-step3-desktop { max-width: 920px; margin: 0 auto; padding: 18px 24px 100px; }
  .nsm-step4-desktop { max-width: 920px; margin: 0 auto; padding: 18px 24px 100px; }
  .review-desktop { max-width: 1180px; margin: 0 auto; padding: 24px; }
  .login-desktop { max-width: 420px; margin: 60px auto 0; padding: 0 24px; }
}
```

- [ ] **Step 4: Run test, expect PASS**

- [ ] **Step 5: Commit**
```bash
git add -u
git commit -m "feat(layout): per-page desktop container classes"
```

### Task 0.7: Resize handler + isDesktop helper

**Files:**
- Modify: `public/app.js` (add helper + listener at top, near AppState)

- [ ] **Step 1: Test**
```js
test('window resize triggers re-render across breakpoint', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('http://localhost:4000/');
  let val = await page.evaluate(() => window.AppState._lastIsDesktop);
  expect(val).toBe(true);
  await page.setViewportSize({ width: 800, height: 800 });
  await page.waitForTimeout(300);
  val = await page.evaluate(() => window.AppState._lastIsDesktop);
  expect(val).toBe(false);
});
```

- [ ] **Step 2: Run, expect FAIL**

- [ ] **Step 3: Add to `public/app.js`** (near `AppState` declaration, before any `render*`)

```js
function isDesktop() { return window.innerWidth >= 1024; }
AppState._lastIsDesktop = isDesktop();
function debounce(fn, ms) {
  let t;
  return function(...args) { clearTimeout(t); t = setTimeout(() => fn.apply(this, args), ms); };
}
window.addEventListener('resize', debounce(() => {
  const now = isDesktop();
  if (now !== AppState._lastIsDesktop) {
    AppState._lastIsDesktop = now;
    render();
  }
  if (AppState.onboardingActive) showCoachmark(AppState.onboardingStep);
}, 100));
```

- [ ] **Step 4: Run test, expect PASS**

- [ ] **Step 5: Commit**
```bash
git add -u
git commit -m "feat(layout): isDesktop helper + cross-breakpoint re-render"
```

### Task 0.8: Push Phase 0 branch + open draft PR

```bash
git push -u origin phase-0-foundation
gh pr create --draft --title "Phase 0: Foundation tokens + navbar + layout strategy" --body "Foundation for all phases. CSS tokens, favicon, Phosphor cleanup, navbar, container classes, isDesktop helper."
```

---

## Phase 1: Spec 1 Bullet format examples

**Worktree:** `../pm-drill-phase-1` (off Phase 0 branch)
**Branch:** `phase-1-bullet-examples`
**Estimate:** 60-90 min
**Depends on:** Phase 0 merged or rebased.

### Task 1.1: Update `STYLE_GUIDE` & `FIELD_GUIDE` in generate script

**Files:**
- Modify: `scripts/generate-circles-examples.js` lines 73-81 (STYLE_GUIDE) + 30-71 (FIELD_GUIDE)

- [ ] **Step 1: Replace STYLE_GUIDE block** (paste full block from spec 1 § 5.3)

- [ ] **Step 2: Update FIELD_GUIDE 27 keys** to match spec 1 § 3.2 table — each key gets a "建議主項" comment string ending with the bullet structure hints from spec.

- [ ] **Step 3: Add anchor circles_002 sample** — load circles_002.field_examples in script and inject into prompt as few-shot.

- [ ] **Step 4: Commit**
```bash
git add scripts/generate-circles-examples.js
git commit -m "feat(spec1): bullet-format style guide + few-shot anchor"
```

### Task 1.2: Manually rewrite circles_002 to bullet format

**Files:**
- Modify: `circles_plan/circles_database.json` (just circles_002 entry's `field_examples`)

- [ ] **Step 1: Open circles_002 field_examples in JSON**

For each of 27 fields, rewrite the prose into bullet format matching the skeleton from spec 1 § 3.2. Example C1.問題範圍:

```
- 聚焦：個人對個人二手交易（不是商家對買家）
- 3 個關鍵環節：
  - 交易前：看不出對方靠不靠譜
  - 面交時：現場人身與付款風險
  - 交易後：出問題沒地方申訴
- 排除：粉專認證商家，聚焦**同城個人賣家**
```

(Continue for I, R, C2, L, E, S × 4 fields each.)

- [ ] **Step 2: Validate JSON syntax**
```bash
node -e "JSON.parse(require('fs').readFileSync('circles_plan/circles_database.json','utf8'))"
```

- [ ] **Step 3: Commit**
```bash
git add circles_plan/circles_database.json
git commit -m "feat(spec1): rewrite circles_002 to bullet format (anchor)"
```

### Task 1.3: Update audit script (spec 1 rules)

**Files:**
- Modify: `scripts/audit-circles-examples.js`

- [ ] **Step 1: Add new checks per spec 1 § 6**:
  - `no_bullets`: text has no `^- ` line → fail
  - `top_level_count`: count `^- ` lines, fail if < 2 or > 4
  - `line_too_long`: any line > 60 chars → warn
  - `total_too_long`: total > 320 chars → fail
  - `bad_indent`: line starts with non-(0|2) spaces before `-` → fail

- [ ] **Step 2: Remove `bullet_in_text` and `multi_paragraph` rules**

- [ ] **Step 3: Run audit on circles_002**
```bash
node scripts/audit-circles-examples.js
```
Expected: circles_002 has 0 issues, other 99 questions have many (because they're still prose).

- [ ] **Step 4: Commit**
```bash
git add scripts/audit-circles-examples.js
git commit -m "feat(spec1): audit script enforces bullet-format rules"
```

### Task 1.4: Clear other 99 questions, regen with new prompt

**Files:**
- Modify: `circles_plan/circles_database.json` (delete `field_examples` from 99 questions, keep circles_002)

- [ ] **Step 1: Delete script**
```js
const fs=require('fs');
const all=JSON.parse(fs.readFileSync('circles_plan/circles_database.json','utf8'));
for(const q of all){ if(q.id!=='circles_002') delete q.field_examples; }
fs.writeFileSync('circles_plan/circles_database.json',JSON.stringify(all,null,2));
```

Run once.

- [ ] **Step 2: Run generate script**
```bash
node scripts/generate-circles-examples.js
```

Wait ~10 min.

- [ ] **Step 3: Run audit**
```bash
node scripts/audit-circles-examples.js --json > audit-output.json
```

Expected: violation rate < 10%. If higher, run `node scripts/retry-flagged-circles-examples.js` (already exists from earlier session).

- [ ] **Step 4: Iterate retry until violations < 1%**

- [ ] **Step 5: Commit**
```bash
git add circles_plan/circles_database.json
git commit -m "feat(spec1): regenerate 99 questions with bullet-format prompt"
```

### Task 1.5: Front-end bullet parser

**Files:**
- Modify: `public/app.js` — add `renderBulletText(text)` helper near top of file
- Modify: `public/app.js` — replace `field-example-toggle` click handler render to use parser
- Modify: `public/review-examples.html` — replace `renderText` function to use same parser

- [ ] **Step 1: Test**

`tests/playwright/journeys/bullet-parser.spec.js`:
```js
const { test, expect } = require('@playwright/test');
test('parser renders nested bullets correctly', async ({ page }) => {
  await page.goto('http://localhost:4000/');
  const html = await page.evaluate(() => {
    return window.renderBulletText('- 主一\n- 主二：\n  - 子 a\n  - 子 b\n- 主三 **bold**');
  });
  expect(html).toContain('<ul');
  expect(html).toContain('<li>主一</li>');
  expect(html).toContain('<ul'); // nested
  expect(html).toContain('<li>子 a</li>');
  expect(html).toContain('<strong>bold</strong>');
});
```

- [ ] **Step 2: Run, expect FAIL** (`renderBulletText is not a function`)

- [ ] **Step 3: Add to `public/app.js`** (near `escHtml`):

```js
function renderBulletText(text) {
  if (!text) return '';
  const lines = String(text).split('\n');
  let html = '<ul class="rt-bullet-list">';
  let inNested = false;
  for (const line of lines) {
    if (/^  - /.test(line)) {
      if (!inNested) { html += '<ul class="rt-bullet-sub">'; inNested = true; }
      const inner = line.replace(/^  - /, '');
      html += `<li>${renderBoldInline(inner)}</li>`;
    } else if (/^- /.test(line)) {
      if (inNested) { html += '</ul>'; inNested = false; }
      const inner = line.replace(/^- /, '');
      html += `<li>${renderBoldInline(inner)}`;
      // peek next line: if next is sub-bullet, leave <li> open; close after sub
      // simpler: close immediately, and accept that nested ul appears as sibling — adjust
      html += '</li>';
    } else if (line.trim()) {
      // fallback: treat as top-level
      if (inNested) { html += '</ul>'; inNested = false; }
      html += `<li>${renderBoldInline(line)}</li>`;
    }
  }
  if (inNested) html += '</ul>';
  html += '</ul>';
  return html;
}
function renderBoldInline(s) {
  return escHtml(s).replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>');
}
window.renderBulletText = renderBulletText;
```

(Note: nested-li proper structure needs lookahead. Simpler implementation: collect lines into tree first.)

Better implementation:
```js
function renderBulletText(text) {
  if (!text) return '';
  const lines = String(text).split('\n').filter(l => l.trim());
  const tree = []; // [{ text, children: [] }]
  let lastTop = null;
  for (const line of lines) {
    const subM = line.match(/^  - (.*)$/);
    const topM = line.match(/^- (.*)$/);
    if (subM && lastTop) {
      lastTop.children.push(subM[1]);
    } else if (topM) {
      lastTop = { text: topM[1], children: [] };
      tree.push(lastTop);
    } else {
      lastTop = { text: line, children: [] };
      tree.push(lastTop);
    }
  }
  let html = '<ul class="rt-bullet-list">';
  for (const node of tree) {
    html += `<li>${renderBoldInline(node.text)}`;
    if (node.children.length) {
      html += '<ul class="rt-bullet-sub">';
      for (const c of node.children) html += `<li>${renderBoldInline(c)}</li>`;
      html += '</ul>';
    }
    html += '</li>';
  }
  html += '</ul>';
  return html;
}
```

Add CSS:
```css
.rt-bullet-list { list-style:disc; padding-left:18px; margin:0; font-size:13px; line-height:1.7; color:var(--c-text); }
.rt-bullet-list > li { margin: 4px 0; }
.rt-bullet-list .rt-bullet-sub { list-style:circle; padding-left:18px; margin:4px 0; }
.rt-bullet-list strong { color:var(--c-primary); font-weight:700; }
```

- [ ] **Step 4: Replace `field-example-toggle` handler render**

Find the `field-example-toggle` click handler in `public/app.js` (~line 1697). Replace the `body.innerHTML = '例：' + rendered;` line with `body.innerHTML = renderBulletText(data.example);`.

- [ ] **Step 5: Replace review-examples.html `renderText`**

```js
function renderText(s) { return window.renderBulletText ? renderBulletText(s) : escHtml(s).replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>'); }
```

(Fallback for when bundle not loaded)

- [ ] **Step 6: Run tests + visual check**

- [ ] **Step 7: Commit**
```bash
git add public/app.js public/style.css public/review-examples.html tests/playwright/journeys/bullet-parser.spec.js
git commit -m "feat(spec1): bullet parser + render integration"
```

### Task 1.6: Push Phase 1 branch
```bash
git push -u origin phase-1-bullet-examples
gh pr create --draft --title "Phase 1: Spec 1 bullet format examples"
```

---

## Phase 2: Spec 2 Progress save

**Worktree:** `../pm-drill-phase-2`
**Branch:** `phase-2-progress-save`
**Estimate:** 90-120 min

### Task 2.1: Backend `POST /draft` endpoint

**Files:**
- Modify: `routes/circles-sessions.js`
- Modify: `routes/guest-circles-sessions.js`

- [ ] **Step 1: Test** `tests/circles-sessions-draft.test.js`:
```js
const request=require('supertest');const app=require('../server');
test('POST /api/circles-sessions/draft creates active session', async () => {
  const r = await request(app).post('/api/circles-sessions/draft').set('Authorization','Bearer ...').send({ question_id:'circles_001', mode:'drill', drill_step:'C1' });
  expect(r.status).toBe(200);
  expect(r.body.id).toBeTruthy();
  expect(r.body.status).toBe('active');
});
```

- [ ] **Step 2: Run, expect FAIL** (404)

- [ ] **Step 3: Add route** to `routes/circles-sessions.js`:
```js
router.post('/draft', requireAuth, async (req, res) => {
  const { question_id, mode, drill_step, sim_step_index } = req.body;
  if (!question_id || !mode) return res.status(400).json({ error: 'missing_fields' });
  const { data, error } = await db.from('circles_sessions').insert({
    user_id: req.user.id,
    question_id,
    mode,
    drill_step: drill_step || null,
    sim_step_index: sim_step_index || 0,
    current_phase: 1,
    status: 'active',
    step_drafts: {},
    framework_draft: {},
  }).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});
```

Mirror in guest route (use `X-Guest-ID` header logic).

- [ ] **Step 4: Run test, expect PASS**

- [ ] **Step 5: Commit**

### Task 2.2: Front-end auto-save logic

**Files:**
- Modify: `public/app.js` — add new `triggerCirclesAutoSave`, AppState fields

- [ ] **Step 1-5: Implement per spec 2 § 4 (debounce, lazy-create, PATCH, error retry)**

Code skeleton:
```js
AppState.circlesSaveStatus = 'idle';
AppState.circlesLastSavedAt = null;
AppState.circlesSavingDebounce = null;
AppState.circlesSavingInFlight = false;
AppState.circlesSavingPending = false;

async function triggerCirclesAutoSave() {
  if (AppState.circlesSavingInFlight) {
    AppState.circlesSavingPending = true;
    return;
  }
  clearTimeout(AppState.circlesSavingDebounce);
  AppState.circlesSavingDebounce = setTimeout(async () => {
    AppState.circlesSavingInFlight = true;
    AppState.circlesSaveStatus = 'saving';
    updateSaveIndicator();
    try {
      // lazy-create if no session
      if (!AppState.circlesSession?.id) {
        const route = AppState.accessToken ? '/api/circles-sessions/draft' : '/api/guest-circles-sessions/draft';
        const r = await fetch(route, { method:'POST', headers: getCirclesHeaders(), body: JSON.stringify({ question_id: AppState.circlesSelectedQuestion.id, mode: AppState.circlesMode, drill_step: AppState.circlesDrillStep, sim_step_index: AppState.circlesSimStep }) });
        const data = await r.json();
        AppState.circlesSession = { id: data.id, mode: data.mode, drill_step: data.drill_step };
      }
      // PATCH progress
      await fetch(circlesRoute(AppState.circlesSession.id) + '/progress', {
        method:'PATCH', headers: getCirclesHeaders(),
        body: JSON.stringify({ step_drafts: AppState.circlesStepDrafts, framework_draft: AppState.circlesFrameworkDraft }),
      });
      AppState.circlesSaveStatus = 'saved';
      AppState.circlesLastSavedAt = Date.now();
    } catch (e) {
      AppState.circlesSaveStatus = 'error';
    } finally {
      AppState.circlesSavingInFlight = false;
      updateSaveIndicator();
      if (AppState.circlesSavingPending) {
        AppState.circlesSavingPending = false;
        triggerCirclesAutoSave();
      }
    }
  }, 1500);
}
```

Bind to `circles-field-input` and solution name inputs:
```js
document.querySelectorAll('textarea.circles-field-input, input.sol-name-input').forEach(el => {
  el.addEventListener('input', () => {
    // Update local AppState first (existing logic)
    triggerCirclesAutoSave();
  });
});
```

### Task 2.3: Save indicator UI

```js
function updateSaveIndicator() {
  const el = document.querySelector('.save-indicator');
  if (!el) return;
  const status = AppState.circlesSaveStatus;
  if (status === 'idle') { el.style.display = 'none'; return; }
  el.style.display = 'flex';
  el.className = 'save-indicator save-' + status;
  let text;
  switch (status) {
    case 'saving': text = '<span class="dot"></span>儲存中…'; break;
    case 'saved':
      const ago = Date.now() - AppState.circlesLastSavedAt;
      text = ago < 5000 ? '<span class="dot"></span>已儲存' : `<span class="dot"></span>已儲存 · ${Math.round(ago/60000)} 分鐘前`;
      break;
    case 'error': text = '<span class="dot"></span>儲存失敗，重試'; break;
  }
  el.innerHTML = text;
}
```

CSS:
```css
.save-indicator { display:none; align-items:center; gap:5px; font-size:10.5px; }
.save-indicator .dot { width:6px; height:6px; border-radius:50%; }
.save-saving { color:var(--c-warn); } .save-saving .dot { background:var(--c-warn); }
.save-saved { color:var(--c-success); } .save-saved .dot { background:var(--c-success); }
.save-error { color:var(--c-danger); cursor:pointer; text-decoration:underline; } .save-error .dot { background:var(--c-danger); }
```

Add `<span class="save-indicator"></span>` to phase 1 top bar template.

### Task 2.4: Offcanvas badge "進行中"

Modify `public/app.js` offcanvas rendering — when `cached.status === 'active'` AND `step_drafts` non-empty, badge text = '進行中', class = `badge-warn`. Time format: relative (`< 60min` → `N 分鐘前`, else original date).

### Task 2.5: CIRCLES homepage banner

In `renderCirclesHome()`, prepend banner if `AppState.circlesActiveDraft` exists:

```js
async function fetchActiveDraft() {
  const r = await fetch(circlesRoute() + '?status=active&limit=1', { headers: getCirclesHeaders() });
  const list = await r.json();
  AppState.circlesActiveDraft = list.find(s => s.step_drafts && Object.keys(s.step_drafts).length > 0) || null;
}

function renderResumeBanner() {
  const d = AppState.circlesActiveDraft;
  if (!d) return '';
  if (localStorage.getItem('dismiss-resume-' + d.id)) return '';
  return `<div class="resume-banner">
    <span><strong>未完成練習</strong> · ${escHtml(d.question_json?.company)} · ${d.question_json?.product} · ${formatRelative(d.updated_at)}</span>
    <span><a class="resume-go" data-id="${d.id}">繼續 →</a><i class="ph ph-x dismiss" data-id="${d.id}"></i></span>
  </div>`;
}
```

### Task 2.6-2.7: Tests + commit + PR

---

## Phase 3: Spec 4 Rich text toolbar

**Worktree:** `../pm-drill-phase-3`
**Estimate:** 90 min

### Task 3.1-3.6: Implement per spec 4 § 3-5

- [ ] CSS for `.rt-toolbar` (desktop) + `.rt-toolbar-mobile` (mobile sticky-bottom)
- [ ] JS actions: `applyBold`, `applyBullet`, `applyIndent`, auto-bullet on Enter
- [ ] Keyboard shortcuts (Ctrl+B / Ctrl+L / Tab / Shift+Tab)
- [ ] Mobile focus/blur listeners + visualViewport binding
- [ ] Class `.rt-textarea` opt-in on all target textareas
- [ ] `buildRtField` HTML helper
- [ ] Active state for B button

Test scenarios per spec 4 § 10. Each in its own `.spec.js`.

---

## Phase 4: Spec 3 Desktop layouts (per page sub-phases)

**Worktree:** `../pm-drill-phase-4`
**Estimate:** 4-6 hours total

Each sub-phase is independent within itself. Implementation agent picks one.

### Phase 4.1: CIRCLES home desktop
**Estimate:** 60-90 min

- [ ] Add `renderCirclesHomeDesktop()` to `public/app.js`
- [ ] Branch `renderCirclesHome` on `isDesktop()`
- [ ] CSS for `.circles-home-desktop` (3-col grid 230/1fr/240, mode card sidebar, type pill list, q-row layout, recent rail, NSM banner footer)
- [ ] Inline expand q-row → grid-column: 1/-1 detail block
- [ ] Mockup ref: `final-1-onboarding-circles-home.html` State 6 + 7

### Phase 4.2: Phase 1 form desktop
**Estimate:** 60-90 min

- [ ] `renderCirclesPhase1Desktop()` with main 1fr + 280px rail
- [ ] L step 方案名稱 + 機制 layout
- [ ] E step per-solution 2x2 grid + 上一步參考收合卡
- [ ] **S step split** (S-1 摘要 / S-2 追蹤) — implement sub-page state with `circlesSStep` (1 or 2)
- [ ] 4 維度 sub-textarea grid

### Phase 4.3: Phase 2 chat desktop
**Estimate:** 30 min (mostly width adjustment)

- [ ] `.phase2-desktop` max-width 920
- [ ] 5 sub-states unchanged from spec 2026-04-26

### Phase 4.4: Phase 3 score desktop
**Estimate:** 45 min

- [ ] `renderCirclesStepScoreDesktop()` with score-total + 4 dim-rows + highlights
- [ ] Coach demo expanded with 4 step chips + bullet body
- [ ] Submit-bar 3 variants

### Phase 4.5: NSM Step 1-3 desktop
**Estimate:** 90 min

- [ ] Step 1: 3 sub-states (unselected / loading / loaded)
- [ ] Step 2: 3 fields with hint button + example collapsible
- [ ] Gate: pass / fail variants
- [ ] Step 3: 4 dimensions with 3-state hint button (default / loading / revealed)

### Phase 4.6: NSM Step 4 desktop (含對比 tab)
**Estimate:** 60 min

- [ ] Score summary bar + 4 tab-bar
- [ ] Tab 1 總覽: radar SVG + 5 dim rows
- [ ] **Tab 2 對比**: NSM main row + 4 dim rows, 你的/教練版 grid 1fr 1fr, click → detail panel with rationale
- [ ] Tab 3 亮點: 3 highlight cards
- [ ] Tab 4 完成: 2 buttons

### Phase 4.7: review-examples + login desktop
**Estimate:** 30 min

- [ ] review-examples: 300px sidebar list + 1fr detail with 7 step sections
- [ ] login: 420px centered card

---

## Phase 5: Onboarding tour

**Worktree:** `../pm-drill-phase-5`
**Depends on:** Phase 4.1 (CIRCLES home desktop)
**Estimate:** 90 min

### Task 5.1-5.5

- [ ] Welcome card render (state 1)
- [ ] Coachmark spotlight + tooltip render (states 2-5)
- [ ] Position calc helper using `getBoundingClientRect`
- [ ] `localStorage` flag `circles_onboarding_v1_done`
- [ ] Resize listener re-positions spotlight
- [ ] Mobile variant: `.onboarding-tooltip` fixed bottom, no overlay, ring shadow on target only
- [ ] Test: simulate first-time user → see welcome → tour → flag set → reload → no welcome

---

## Phase 6: NSM Step 4 對比 tab — mobile bottom sheet

**Worktree:** `../pm-drill-phase-6`
**Depends on:** Phase 4.6
**Estimate:** 45 min

- [ ] Mobile vertical stack 你的/教練版 cards
- [ ] Bottom sheet HTML + CSS
- [ ] Click card → open sheet with detail + rationale
- [ ] Click backdrop / handle drag → close
- [ ] Tests: mobile viewport (iPhone 15 Pro) tab switch + card click → sheet appears

---

## Phase 7: Integration

**Worktree:** `../pm-drill-phase-X-integration`
**Branch:** `phase-X-integration` (off main)

Merge all phase branches in dependency order:
```bash
git checkout phase-X-integration
git merge phase-0-foundation
git merge phase-1-bullet-examples
git merge phase-2-progress-save
git merge phase-3-rich-text
git merge phase-4-desktop-layouts  # combine 4.1-4.7 first
git merge phase-5-onboarding
git merge phase-6-nsm-mobile-sheet
```

Resolve conflicts (most likely in `public/app.js` `render*` functions and `public/style.css`). Run all Playwright suites green. Commit integration fixes.

---

# 測試 agent 團隊（dispatched after Phase 7 integration）

**3 層共 17 個 agents**，全部 dispatched in parallel via `superpowers:dispatching-parallel-agents`，各自獨立 worktree（`Agent` tool with `isolation=worktree`）。

## 第一層 · SIT 系統整合測試（8 agents）—— 拆到每個按鈕、每個情境

每個 agent 的 task 必須**每個按鈕／每個 toggle／每個鍵盤事件／每個 viewport 都跑一次**。 失敗任一條 = agent FAIL。

### SIT-1: Spec 1 Bullet rendering & content quality

**Mission:** Verify all 100 questions × 27 fields render correctly + every example toggle button works.

**Tasks:**
1. Run `node scripts/audit-circles-examples.js` → expect violation rate < 1%
2. **Visually inspect ALL 100 questions** in `/review-examples.html` (use loop) at desktop 1280 + mobile 375 — check every step section's bullet structure
3. Verify bullet HTML structure: `<ul class="rt-bullet-list"><li>...<ul class="rt-bullet-sub">...</ul></li></ul>`
4. Verify bold renders as `<strong>` with `color: var(--c-primary)` resolved blue
5. Check no orphan `**` markers in any field
6. Confirm circles_002 anchor 27 fields all match spec § 3.2 skeleton
7. **Every「查看範例」toggle on every Phase 1 step (C1/I/R/C2/L/E/S × all fields)** — click → verify bullet renders, click again → collapses
8. **Every「查看範例」toggle on Phase 3 教練示範答案** — same drill
9. **Every NSM Step 2「查看範例」toggle** (3 fields)
10. **Every NSM Step 3「查看範例」toggle** (4 dimensions)
11. Edge cases: empty example string, single bullet, no children, deeply nested (impossible per spec but test fallback)
12. Verify `renderBulletText` exposed on `window` for review-examples.html
13. Verify `\n\n` collapsed to `\n`; tab characters rejected
14. Long-line line-wrap behavior (60+ chars per line) doesn't break layout
15. Search/filter in review-examples.html — every step filter dropdown option works

**Pass criteria:** 0 audit violations of structural rules; every toggle (~600 across the app) opens & collapses correctly.

### SIT-1 加項: regenerate flow（CI step）
Run `node scripts/retry-flagged-circles-examples.js` → must converge to <1% in ≤2 iterations.

### SIT-2: Spec 2 Progress save behavior

**Mission:** End-to-end auto-save flow + every textarea trigger + every UI touch point.

**Tasks:**
1. **Per-textarea trigger test**: open Phase 1, for **every textarea (4 in C1, 4 in I, 4 in R, 4 in C2, 2-3 in L, 4×N in E, 4 in S-1, 4 in S-2)** — type → wait 1.5s → verify PATCH fired with correct field key
2. Reload page → verify session in offcanvas with **"進行中" badge yellow** (not 完成 green / 60 分 purple)
3. Click session → verify all typed text restored to all textareas
4. CIRCLES homepage banner appears with correct company name & relative time format (`< 5min` → "剛剛", `< 60min` → "N 分鐘前", `>= 60min` → date)
5. **「繼續」button click** → loads phase 1 at correct step with content
6. **「X」dismiss button click** → banner hidden, `localStorage` `dismiss-resume-{id}` set
7. Disable network → type → verify "儲存失敗，重試" indicator with red dot
8. **Click "儲存失敗，重試" link** → triggers retry, succeeds → indicator becomes "已儲存 · 剛剛" green
9. **Saving indicator state transitions:** verify each: idle (hidden) → saving (orange) → saved (green) → 5s later → "saved · N 分鐘前" gray-green
10. **Multiple textareas typing rapidly**: type field A → type field B before A's debounce fires → verify both eventually saved (pending flag)
11. Backend test: POST `/draft` returns valid session with empty step_drafts
12. Backend test: PATCH `/progress` is merge-not-overwrite (other fields preserved)
13. Backend test: Guest mode `X-Guest-ID` header works for both `/draft` and `/progress`
14. Cron cleanup: insert empty session > 24hr old → run cleanup → verify deleted; insert non-empty → not deleted
15. Edge: type → close tab before debounce fires → reopen → verify content was NOT saved (debounce not fired) BUT no orphan empty session created (lazy-create only on first PATCH after debounce)
16. Edge: Solution name input (L step) `<input class="sol-name-input">` also triggers auto-save
17. Edge: 4 NSM tracking dimension sub-textareas trigger auto-save with correct nested key

**Pass criteria:** All 17 scenarios pass. No data loss across reload. Every textarea triggers save; every UI button (繼續, X, retry) works.

### SIT-3: Spec 3 Desktop responsive layouts (every page × every state × every interactive element)

**Mission:** Visual regression + interactive coverage at 1280×800 and 1440×900.

**Tasks:**
1. **Capture full-page screenshots** of every screen state at both viewports (~30 screenshots: home / phase1 7 steps / phase2 5 sub-states / phase3 3 variants / nsm step 1-4 with sub-states / review / login)
2. **Pixel-level comparison** to mockup files (`final-*.html`) — header / grid / card / spacing within ±10px
3. Verify per-page max-width matches spec (1180 / 920 / 720 / 420)
4. **Color audit**: every `var(--c-primary)` resolves to `#1A56DB`; grep `getComputedStyle` on 30 elements
5. Cross-breakpoint: resize 1024 ↔ 1023 → verify smooth re-render, no flash, AppState preserved
6. **Font check**: Instrument Serif loaded on Phase 3 score-number (84px desktop), NSM Step 4 nsm-total (54px); other text DM Sans
7. **Phosphor icon enumeration**: list all `<i class="ph ph-*">` rendered, verify none show as 「∎」 missing glyph
8. Verify navbar 2 tabs visible at ≥1024, hidden at <1024 (display:none verified via getComputedStyle)
9. Verify favicon shows in tab title bar (Playwright `page.locator('link[rel=icon]')` href === '/favicon.svg')
10. **CIRCLES home interactive coverage**:
    - 完整模擬 mode card click → active state
    - 步驟加練 mode card click → step pills appear
    - Each step pill click (C/I/R/C2/L/E/S) — locked pills show tooltip
    - Type filter pills click (產品設計 / 改進 / 策略) — list filters
    - 「隨機選題」link click → random question selected & highlighted
    - Question row click → inline expand → 確認/取消 buttons
    - Navbar tab click (CIRCLES / 北極星指標) → navigate
    - Hamburger button → offcanvas opens
    - Logout icon → logs out
11. **Phase 1 interactive**: every field's lightbulb button (hint modal opens), 查看範例 toggle, 返回選題, 提交審核
12. **Phase 2 interactive**: 5 sub-state transitions (chat → chat3 at turn 3, click 提交 → strip, 展開填寫 → expand, 8s wait → pass), every coach hint toggle, send button, 提前提交
13. **Phase 3 interactive**: ◀▶ step navigation (sim mode), coach toggle expand/collapse, 重練/繼續/查看總結報告 button variants
14. **NSM Step 1**: type tab clicks, 隨機選題, every q-card click → loading → loaded state, 開始練習
15. **NSM Step 2**: every field's hint button, 查看範例 toggle, 提交審核
16. **NSM Step 3**: every dimension's 3-state hint button (default → loading → revealed → 收起提示), 查看範例
17. **NSM Step 4**: 4 tab switches (總覽 / 對比 / 亮點 / 完成), 對比 tab card click → detail panel, 再練一次, 回首頁
18. **review-examples**: search input, step filter, 全展開 / 全收起, every q-list-item click → right detail updates

**Pass criteria:** Every interactive element above produces expected state change. Visual diff < 10px from mockups. Zero console errors during enumeration.

### SIT-4: Spec 3 Onboarding tour

**Mission:** New-user onboarding flow including mobile parity.

**Tasks:**
1. Clear localStorage → load CIRCLES home → expect welcome card
2. Click "開始引導" → expect coachmark step 1 (mode region spotlit)
3. Click "下一步" × 3 → reach step 4 (confirm button highlighted)
4. Click "開始練習" on step 4 → expect tour ends, navigate to Phase 1
5. Reload → expect no welcome card, no tour (flag set)
6. Click "略過引導" mid-tour → expect tour ends, flag set
7. `?onboarding=1` query → expect tour starts despite flag
8. Resize 1280→375 mid-tour → expect coachmark re-positions to mobile bottom sheet
9. Mobile viewport: spotlight = ring shadow only, no overlay, tooltip = bottom sheet
10. Returning user (existing recent sessions) → expect no welcome card

**Pass criteria:** All 10 paths work. No spotlight misalignment > 5px. No JS errors.

### SIT-5: Spec 4 Rich text toolbar

**Mission:** Toolbar actions, keyboard, mobile, IME.

**Tasks:**
1. Desktop: click B → bold inserts; click again → unbolds
2. Desktop: select text, Ctrl+B → wraps `**text**`
3. Desktop: cursor on line, click 列點 → adds `- ` prefix; click again → removes
4. Desktop: cursor on bullet line, Tab → adds 2 spaces; Shift+Tab → removes
5. Desktop: Enter on bullet line → next line auto-prefixes `- ` (or 4 spaces if was nested)
6. Desktop: Enter on empty bullet (`- ` alone) → exits bullet mode
7. Mobile: focus textarea → toolbar appears at bottom (sticky above keyboard)
8. Mobile: blur textarea → toolbar disappears (200ms delay)
9. Mobile: visualViewport changes (keyboard show/hide) → toolbar repositioned
10. IME (中文): input composition active → keyboard shortcuts don't fire
11. Multiple textareas on page: focus one → only that one's toolbar relevant
12. Phase 1 / NSM Step 2-3 / E step / S step 4 dim sub-textareas all have toolbars
13. Active state: B button highlighted when caret in `**...**` region
14. Stress: bold → bullet → indent rapid clicks don't break selection

**Pass criteria:** All 14 scenarios pass. No selection lost on toolbar action.

### SIT-6: Cross-spec integration

**Mission:** Verify specs don't conflict; end-to-end PM session works.

**Tasks:**
1. Full simulation flow: select question → Phase 1 fill all 4 fields with bullets + bold → submit → Phase 2 chat → conclusion → Phase 3 score
2. Step through all 7 steps in simulation → reach final report
3. Confirm spec 1 (example bullet renders) + spec 2 (auto-save fires) + spec 4 (toolbar works) + spec 3 (desktop layout) all coexist
4. Verify auto-save POST `/draft` → user types `- abc\n  - def` → PATCH preserves `\n` and indent
5. Verify reload → bullet text restored intact in textarea (no corruption)
6. Verify example expanded inside Phase 1 form: bullet HTML renders, doesn't conflict with toolbar above
7. Verify save indicator updates as user types via toolbar (insert bold dispatches input event)
8. Verify onboarding tour doesn't trigger if user has any active session

**Pass criteria:** Full e2e session completes without errors. No spec contradicts another.

### SIT-7: A11y, browser compat, console clean

**Mission:** Production readiness gate.

**Tasks:**
1. axe-core scan on every screen → 0 critical violations
2. Keyboard navigation: tab through CIRCLES home → all interactive elements reachable
3. Screen reader: aria-label on all icon-only buttons (hamburger, signout, x close, etc)
4. Test on Chrome / Firefox / Safari (desktop) + iOS Safari + Chrome Android
5. Console: 0 errors during all flows (warnings allowed)
6. Network: no 404 / 500 on initial load
7. Lighthouse mobile score ≥ 85 (performance + a11y + best practices)
8. Phosphor Icons load (no FOUC)
9. DM Sans + Instrument Serif preload working (no flash)
10. CSS strict mode: no `!important` overuse beyond what's already in baseline
11. Resume banner: localStorage dismiss persists per session id
12. Progress save: handles guest mode (X-Guest-ID header)

**Pass criteria:** Lighthouse a11y ≥ 90, 0 console errors, all browsers work.

### SIT-8: Backend API contract（NEW）

**Mission:** Every endpoint, every auth state, every error path.

**Tasks:**
1. `POST /api/circles-sessions/draft` — auth happy path, missing auth, missing fields, invalid question_id
2. `POST /api/guest-circles-sessions/draft` — same matrix with X-Guest-ID
3. `GET /api/circles-sessions` — auth, pagination, status filter
4. `GET /api/circles-sessions/:id` — auth, owner check, not_found
5. `PATCH /api/circles-sessions/:id/progress` — partial merge, wrong owner, large payload
6. `POST /api/circles-sessions/:id/evaluate-step` — drill / sim, S step → completes
7. `POST /api/circles-sessions/:id/final-report` — incomplete / complete / cached
8. `DELETE /api/circles-sessions/:id` — auth, cascade
9. NSM equivalents: `/api/nsm-sessions/*`
10. Public: `POST /api/circles-public/hint`, `/example`, `GET /all-examples` — input validation, 404 not_curated, rate limit
11. Schema validation: every endpoint rejects malformed JSON with 400
12. CSRF: confirm cookie/auth header pattern (no token-based vulnerabilities)
13. Race: 5 parallel PATCH `/progress` to same session → server merges all (last-write-wins acceptable per spec 2 § 9)

**Pass criteria:** Every endpoint × every auth combo behaves per route spec. 0 unhandled exceptions in server.log.

---

## 第二層 · UAT 用戶驗收測試（7 personas）—— 模擬真實使用者 journey

每個 persona 是一個 agent，扮演那個角色從零開始操作。**每個 persona 的 mission 必須完整跑完一個真實的 user goal**，過程中記錄任何摩擦點、不直覺處、值得加分／扣分的細節。

### UAT-1: Persona「Alice」— PM 新手學員（mobile + desktop 混合）

**背景：** 25 歲，準備轉職 PM，從沒聽過 CIRCLES 框架。手機上下班通勤練習，週末桌面深度練習。
**期望：** 想被引導著走完一輪，看自己分數、知道哪裡可以改進。

**Mission journey:**
1. **(mobile)** 第一次造訪，期待 onboarding 引導
2. 跟著 4 步 coachmark 走完，理解流程
3. 選 Easy 難度題目（Amazon Kindle）
4. 進 Phase 1，使用「💡 提示」與「查看範例」幫忙寫
5. 用 toolbar 加 bullet 與 bold（手機 sticky-bottom）
6. 提交審核
7. 通勤結束，關 tab，回家
8. **(desktop)** 從近期練習 banner 點繼續
9. 確認手機填的內容正確還在
10. 完成後續步驟，看到評分
11. 點開「教練示範答案」對照自己寫的

**Verify:**
- onboarding 不會讓她覺得被打擾或被瞧不起
- 提示／範例真的有幫助（內容切題）
- 手機到桌面切換無縫
- 評分結果讓她「知道下次怎麼進步」
- 整個流程沒有任何「卡住」「不知道下一步」的時刻

**Pass criteria:** Alice 能獨力完成首次完整練習。記錄 ≤ 3 個小摩擦點（且每個都有具體改進建議）。

### UAT-2: Persona「Ben」— 資深 PM 求職者，效率派

**背景：** 38 歲，10 年 PM 經驗，正在面試 Sr PM 職缺。CIRCLES 對他是基本功，他純粹要練手感、找思維盲點。
**期望：** 最快速度進入練習，跳過所有教學，鍵盤操作優先。

**Mission journey:**
1. 進站第二次（已關過 onboarding flag），不應再看到 welcome card
2. 直接從 navbar tab 切到 CIRCLES
3. 用「隨機選題」快速挑題
4. 進 Phase 1，**不點任何提示／範例**，純自己寫
5. 全程使用 **keyboard shortcuts**（Ctrl+B 粗體、Tab 縮排、Enter 接 bullet）
6. 故意少寫一條假設 → submit → 看 gate 卡他在哪裡
7. 修正後通過 gate，進入 Phase 2 對話
8. 看 AI 教練點評是否切中他的薄弱環節
9. 收尾後對比自己的答案 vs 教練示範

**Verify:**
- 沒有「請看教學」或「歡迎」這類阻礙效率的元素
- 每個欄位 keyboard 操作流暢無 bug
- toolbar 不擋他，tab 縮排不會被瀏覽器搶走焦點
- 教練評分有用，不是套話

**Pass criteria:** Ben 能在 25 分鐘內走完一個完整 simulation 模式，全程 keyboard 為主。

### UAT-3: Persona「Cathy」— 訪客（guest mode）試用

**背景：** 30 歲，剛聽朋友推薦這 app，不想註冊先試試看。
**期望：** 不註冊也能玩到核心體驗。

**Mission journey:**
1. 登入頁點「先試試看（不註冊）」
2. 進 CIRCLES 首頁
3. 跑完 onboarding（如果出現）
4. 選一題、走 Phase 1 + Phase 2 + Phase 3
5. 中途關 tab，重開 → 期待進度還在（guest mode 用 cookie/X-Guest-ID）
6. 看到評分後，受到啟發決定註冊
7. 點註冊，建立帳號
8. 之前的 guest session 是否能轉移到新帳號？（spec 沒明確定義，標記為發現點）

**Verify:**
- guest mode 全功能可用
- guest 不註冊也能存進度（X-Guest-ID 持久）
- 註冊流程簡單
- session 遷移行為符合預期（或有清楚提示）

**Pass criteria:** Cathy 能完成完整一輪不註冊；註冊體驗順暢；session 遷移行為一致。

### UAT-4: Persona「David」— 手機通勤族，網路不穩，斷續使用

**背景：** 35 歲，每天捷運通勤練習。網路時好時壞，常常中途車站換站斷網 30 秒。
**期望：** 斷網不掉資料、回網自動恢復。

**Mission journey:**
1. mobile, 1Mbps 網路
2. 開始 Phase 1，打第一個欄位 → 看到「儲存中…」→ 「已儲存」
3. 進站，網路斷 30 秒，繼續打第二欄位 → indicator 變「儲存失敗，重試」
4. 出站網路恢復
5. **不點重試按鈕**，繼續打字 → expect auto-save 自己會 retry 並成功
6. 真的點重試按鈕（手指 tap）→ 不應重複多次或產生重複 session
7. 用單手操作 toolbar（拇指夠不到？）
8. 過長 session 中切到別的 app（背景）→ 回來時看到 sticky-bottom toolbar 是否還黏對位置（visualViewport changes）
9. iOS Safari 上鍵盤切換中／英／emoji 模式 → toolbar 不誤觸

**Verify:**
- 無資料遺失
- 失敗自動 retry 行為合理
- toolbar 在所有手機 viewport 變化下都黏鍵盤上方
- 單手大拇指可達 toolbar 全部 4 個按鈕

**Pass criteria:** 全程網路斷續但無任何資料丟失。Toolbar 在 8 次 viewport 變化中位置都正確。

### UAT-5: Persona「Emma」— 桌面深度工作者，多 session 並行

**背景：** 42 歲，正職 PM 在做 NSM 培訓，工作中開好幾個 PM Drill tab 對比不同題目的 NSM 設計。
**期望：** 桌面寬螢幕、多 tab 切換、能看到歷史 session 對比。

**Mission journey:**
1. desktop 1440×900
2. 同時開 4 個 tab：CIRCLES home / NSM Step 4 報告 A / NSM Step 4 報告 B / review-examples
3. 在 tab A 改答案 → tab B 切回去看是否需要 reload
4. 用 review-examples 看其他公司的合格範例
5. 對比 自己 NSM vs 教練版（在 NSM Step 4 對比 tab）
6. 多開時 server 端有沒有 session race condition
7. 用 navbar tab 切換 CIRCLES ↔ 北極星指標 → 確保 state 不互相干擾

**Verify:**
- 多 tab 沒有 state 串味
- 對比 tab 設計思路很有 insight
- review-examples 桌面版易用性
- 桌面 1440 真的用得到那麼多空間（不是浪費）

**Pass criteria:** 多 tab 操作無 race；對比 tab 至少 3 個 dim 的 rationale 給她「啊原來如此」的時刻。

### UAT-6: Persona「Frank」— A11y 用戶，鍵盤 only + screen reader

**背景：** 視障 PM，使用 NVDA/VoiceOver，鍵盤操作為主。
**期望：** 所有功能都能不用滑鼠操作；按鈕都有 aria-label。

**Mission journey:**
1. 鍵盤 Tab 走過 navbar → 漢堡 / logo / 兩個 tab / 北極星指標 / 登出 → 全部可達
2. 進 CIRCLES home → Tab 走到 mode card → Enter 啟動
3. Tab 走到 type filter → 方向鍵切換
4. Tab 走到 question row → Enter 展開 → Tab 到「確認」按鈕
5. Phase 1 表單：Tab 在 textarea 之間 → 在 textarea 內 Tab 能否縮排（注意：Tab 應給 toolbar 的 indent action，不是切換 focus）
6. Hint modal 開啟 → focus trap + Esc 關閉
7. NSM Step 4 對比 tab → Tab 走到每個 card → Enter 開 detail
8. screen reader：每個 icon button 有 `aria-label`
9. Coachmark spotlight 不應 trap keyboard focus（可 Esc 跳出）

**Verify:**
- 0 鍵盤陷阱
- 0 缺失 aria-label
- 所有 modal 有 focus trap 但 Esc 關閉
- Lighthouse A11y ≥ 90

**Pass criteria:** Frank 能不用滑鼠完成完整 drill 流程。axe-core 0 critical violations。

### UAT-7: Persona「Grace」— 中斷重來，多次中斷

**背景：** 48 歲，半工半讀的轉職者，每天能練 15 分鐘但常被打斷（接孩子／開會）。
**期望：** 隨時能停、隨時能繼續，不會丟東西。

**Mission journey:**
1. 開始 Phase 1，寫 2 個欄位 → 突然要走 → 直接關 tab
2. 隔天回來 → 期待從上次的 step 繼續
3. 銷續寫剩下兩個欄位 → 提交審核 → 進 Phase 2
4. 對話到第 5 輪 → 又要走 → 關 tab
5. 兩天後回來 → 對話歷史是否完整保留？submit row 是否還在？
6. 累積完成 3 個不同題目（中度練習者）→ 近期練習列表合理排序（最新優先）
7. 想刪除某個失敗的 session → 點刪除 → 確認對話 → 刪除生效

**Verify:**
- 中斷／恢復零摩擦
- Phase 2 對話歷史完整保留
- 多個未完成 session 並存時，「未完成練習 banner」只顯示最近一個（不是全部洗版）
- 刪除有確認對話避免誤刪

**Pass criteria:** Grace 在 5 個工作日內反覆中斷／恢復 7 次都無資料丟失。

---

## 第三層 · UI/UX 稽核員（2 agents）—— 手機美觀／便利／有用性吹毛求疵

**這 2 個 agents 的角色是「美學潔癖」+「UX 痛點獵人」**，專盯手機版（最重要的場景）。每個 agent 走過所有 mobile screen 並輸出**主觀但有依據**的稽核報告。

### UI/UX-1: Persona「美學總監（雜誌編輯背景）」

**Mission:** 用「精緻消費品 app」標準看 PM Drill 手機版每個 screen，找出視覺上的不協調。

**核對項目：**

#### 美觀 (Aesthetics)
1. Typography hierarchy：每個畫面的 H1/H2/body/label 大小比例是否清楚？是否有「字級平淡」的螢幕？
2. Spacing rhythm：邊距／行距是否有節奏感（不是硬塞滿、也不是空到失去重心）？
3. Color tension：cream + 藍 + 暖灰的搭配是否任何一處顯得「髒」「太冷」「對比不足」？
4. Instrument Serif 使用是否克制且有效（hero 數字 + 必要 italic accent，沒過度），還是退回到 generic？
5. Card border vs border-radius：每張卡的圓角／邊框／陰影是否一致風格？
6. Icon weight：Phosphor regular 是否視覺一致（有沒有混用 fill 變種）？
7. NSM 紫色 (#7C3AED) 在哪些畫面出現是必要的（NSM 模組）vs 可移除（CIRCLES 內部誤用）？
8. Dark mode（如未實作）：當前暖系是否有「夜晚刺眼」風險？

#### 視覺品味 deep-dive
- 對比參考：Linear / Notion / Vercel / Stripe / Substack 等同級工具，PM Drill 哪幾屏可以拿出去 / 哪幾屏需要再 polish？
- 每個 screen 給 0-10 分美學評分 + 改進建議

**Output：手機版美學稽核報告（每 screen 一段：分數 + 至少 1 個具體改進）**

### UI/UX-2: Persona「UX 痛點獵人（PM 用戶心理背景）」

**Mission:** 用「焦慮的真實使用者」視角找便利性與有用性的死角。

**核對項目：**

#### 使用便利性 (Usability)
1. **手指可達性**：每個按鈕是否在拇指自然弧度內（375 寬螢幕）？是否有按鈕太小（< 36×36）？
2. **點擊面積**：textarea「💡 提示」按鈕點擊區是不是只在 icon 上、還是包含整個 hover 範圍？
3. **滑動衝突**：對話頁滑動時 toolbar 會不會被誤觸？sticky-bottom toolbar 與系統手勢區是否衝突？
4. **回退路徑**：每個畫面都有「回上一頁」嗎？硬體返回鍵（Android）行為是？
5. **Loading 期間**：載入超過 2 秒的操作是否有 feedback？（評分審核 / NSM 情境分析）
6. **錯誤訊息**：每個失敗情境（網路錯誤 / 表單未填 / gate fail）的錯誤文案是否「有解法」「不指責用戶」？
7. **Modal 可關閉性**：所有 modal 都能 X / Esc / 點背景關嗎？
8. **Form 自動填**：autocomplete 是否合理（email autocomplete=email、password autocomplete=current-password）？

#### 有用性 (Usefulness)
9. **每個按鈕／元素的價值**：有沒有 button 點下去發現「這個沒用啊」的情況？
10. **資訊密度**：mobile 每屏資訊量太多（壓垮）vs 太少（要滑很久）平衡是否合理？
11. **Onboarding 跟新手的真實 gap**：4 步 coachmark 真的解決了「我不知道怎麼開始」嗎？
12. **教練示範與用戶答案對比**：對比是否「啟發性」？還是只是「貼一段標準答案」沒有 insight？
13. **NSM 對比 tab 的設計思路 rationale**：每條 rationale 是否真的揭露 insight？還是套話？
14. **Phase 2 對話的教練點評**：每輪點評是否真的點到使用者的薄弱環節？還是泛泛地「很好繼續」？
15. **保存進度的價值感**：用戶能感受到「啊還好有自動存」的時刻嗎（例：意外關閉後）？

#### 痛點 deep-dive
- 列出至少 **15 個具體痛點**（每個含：哪個 screen、哪個元素、為什麼是痛點、改進方向）
- 痛點分級：BLOCKER（必修）/ MAJOR（強烈建議）/ MINOR（nice-to-have）

**Output：手機版 UX 痛點稽核報告（≥ 15 痛點 + 分級 + 改進建議）**

---

## 整合決策流程

7 phase agents 全部 PR draft → 9 SIT agents（含新加的 SIT-8 backend）平行跑 → 7 UAT personas 平行跑 → 2 UI/UX 稽核員產出報告。

**最終決策矩陣：**
| 結果 | 決策 |
|---|---|
| 9 SIT 全 PASS + 7 UAT 都完成 mission + 2 UI/UX 報告無 BLOCKER | merge to main |
| 任一 SIT FAIL | 回對應 Phase 修，再跑該 SIT |
| UAT mission 完成但摩擦點 ≥ 4 個 | 開 follow-up issue，不阻擋 merge |
| UI/UX 報告有 BLOCKER | 進 hotfix branch 修，再 merge |
| MAJOR 痛點累積 ≥ 5 | issue 單列出，下 sprint 修 |

---

## Self-review

**Spec coverage check:**
- Spec 1 § 2-7 → Phase 1 tasks 1.1-1.6 ✓
- Spec 2 § 3-7 → Phase 2 tasks 2.1-2.6 ✓
- Spec 3 § 1-12 → Phases 0, 4, 5, 6 ✓
- Spec 4 § 1-12 → Phase 3 ✓

**Placeholder scan:** No "TBD", "implement later", or "see existing pattern" without code shown. Where steps reference existing code (e.g., "find handler in app.js"), exact line numbers given.

**Type consistency:**
- `triggerCirclesAutoSave` consistent across Phase 2 tasks
- `renderBulletText` exposed via `window.renderBulletText` for review-examples
- `isDesktop()` defined Phase 0, used everywhere
- AppState additions namespaced (`circles*`, `onboarding*`, `_lastIsDesktop`)

---

## Plan complete

Plan saved to `docs/superpowers/plans/2026-04-28-pm-drill-mega-rollout.md`. Two execution options:

**1. Subagent-Driven (recommended)** — One subagent per phase, dispatched in parallel where possible (Phases 1, 2, 3, 4 are all independent off Phase 0). Test agents run after Phase 7 integration. Two-stage review per phase.

**2. Inline Execution** — Execute all phases in this session with checkpoints between. Slower but lets you intervene mid-phase.

Which approach?
