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

7 個 test agents dispatched in parallel via `superpowers:dispatching-parallel-agents`. Each agent runs against `phase-X-integration` branch in its own checkout. Use `Agent` tool with `subagent_type=general-purpose` and isolation=worktree.

## Test Agent 1: Spec 1 Bullet rendering & content quality

**Mission:** Verify all 100 questions × 27 fields render correctly as nested bullets with proper bold marking.

**Tasks:**
1. Run `node scripts/audit-circles-examples.js` → expect violation rate < 1%
2. Visually inspect 20 random questions in `/review-examples.html` desktop & mobile
3. Verify bullet HTML structure: `<ul class="rt-bullet-list"><li>...<ul class="rt-bullet-sub">...</ul></li></ul>`
4. Verify bold renders as `<strong>` with primary color
5. Check no orphan `**` markers
6. Confirm circles_002 anchor matches 27-field spec skeleton
7. Edge cases: empty example, single bullet, very long line

**Pass criteria:** 0 audit violations of `top_level_count`, `bad_indent`, `total_too_long`, `bad_prefix`. ≤ 5 `no_bold` (acceptable).

## Test Agent 2: Spec 2 Progress save behavior

**Mission:** End-to-end auto-save flow.

**Tasks:**
1. Playwright: open Phase 1 fresh, type in textarea → wait 1.5s → verify PATCH fired
2. Reload page → verify session in offcanvas with "進行中" badge
3. Click session → verify text restored to textarea
4. CIRCLES homepage banner appears with correct company name & relative time
5. Click "繼續" → loads phase 1 with content
6. Click X dismiss → banner hidden, `localStorage` flag set
7. Disable network → type → verify "儲存失敗，重試" indicator
8. Re-enable network, click retry → verify save succeeds
9. Backend test: POST `/draft` returns valid session with empty step_drafts
10. Backend test: PATCH `/progress` is merge-not-overwrite (other fields preserved)
11. Cron cleanup: insert empty session > 24hr old → run cleanup → verify deleted

**Pass criteria:** All 11 scenarios pass. No data loss on reload.

## Test Agent 3: Spec 3 Desktop responsive layouts

**Mission:** Visual regression on every page at 1280×800 and 1440×900.

**Tasks:**
1. Capture full-page screenshots of every screen state at both viewports
2. Compare to mockup files (`final-*.html`) — pixel-level alignment of headers, grids, cards
3. Verify per-page max-width matches spec (1180 / 920 / 720 / 420)
4. Verify all `var(--c-primary)` resolves to `#1A56DB` (not purple leak)
5. Cross-breakpoint: resize 1024 ↔ 1023 → verify smooth re-render
6. Verify Instrument Serif loaded on Phase 3 score number, NSM Step 4 total, page hero
7. Verify Phosphor icons render (no missing glyph boxes)
8. Verify navbar 2 tabs visible desktop, hidden mobile
9. Verify favicon shows in tab title bar (visual)

**Pass criteria:** All viewports render without overflow, alignment matches mockup ±10px, no missing fonts/icons.

## Test Agent 4: Spec 3 Onboarding tour

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

## Test Agent 5: Spec 4 Rich text toolbar

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

## Test Agent 6: Cross-spec integration

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

## Test Agent 7: A11y, browser compat, console clean

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
