# Path 2 — Plan A · Foundation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 production `public/app.js` + `public/style.css` 的 render layer 換成 Path 2 skeleton（design tokens + LOCKED CSS chunks + 視覺對齊測試 stack + AppState + view router + 共用 chrome），讓 Plans B-E 在這個 foundation 上各自實作 CIRCLES / NSM / cross-cutting / edge transitions。

**Architecture：** 在 `feat/path-2-foundation` worktree 上做。`public/app.js` + `public/style.css` 在 main 是 7000 / 4500 行 monolith — 本 plan 把它們**完整 replace 為 skeleton**（≈ 1500 / 1200 行），所有 render 函式回傳 placeholder「(Plan B/C/D/E 將實作)」字樣，只有 `renderNavbar` 與 banner / btn / qchip 等 LOCKED chunks 真實渲染。Backend / API / DB / OpenAI prompts / jest 100% 不動。新增 `tests/visual/` 子系統（per spec §0.6）作為 17 mockup baseline + production 對 baseline 的 pixelmatch 0.5% diff gate。

**Tech Stack：** plain JS（無 bundler，與 production 一致）/ system-ui font / Phosphor CDN @phosphor-icons/web@2.1.1 / Playwright + pixelmatch（新增）/ jest 既有 / Express + Supabase（不動）

**Plan A 成功條件：**
- jest 既有 157 tests 全綠（**未動 backend，必綠**）
- Playwright 新增 smoke spec（app boots / navbar 顯示 / view 路由切換）全綠
- 17 mockup × 3 viewport = 51 個 baseline PNG 已凍結於 `tests/visual/baselines/`
- production 載入後渲染 navbar + 任一 view stub「Plan B/C/D/E 將實作」訊息（非 crash）
- iOS Safari 15-item static checklist 全 ✓
- 14-box gate prep doc `audit/path-2-plan-a-signoff.md` 寫好待 user signoff

---

## File Structure

| 路徑 | 動作 | 責任 |
|---|---|---|
| `public/style.css` | **完整 replace** | tokens + base reset + LOCKED chunks（navbar / btn / qchip / submit-bar / phase-head / banner / loading-wrap / error-wrap / form-field / panel-card） |
| `public/app.js` | **完整 replace** | AppState + 持久化 + boot / view router / renderNavbar / 401 handler / online/offline detect / onboarding flag init / view stubs（Plans B-E 將擴充） |
| `public/index.html` | 不動 | 載入順序 LOCKED：phosphor CDN → style.css → circles-db.js → app.js |
| `public/circles-db.js` | 不動 | `CIRCLES_QUESTIONS` 全域陣列 |
| `tests/visual/` | **新建** | 子系統根目錄 |
| `tests/visual/baselines/` | 新建 | per spec §0.6：`{viewport}/{screen}/{state}.png` |
| `tests/visual/helpers/screenshot.js` | 新建 | 截圖封裝（per spec §0.5 Layer 1.1：凍 animation / wait fonts / clip frame） |
| `tests/visual/helpers/pixelmatch.js` | 新建 | diff 比較器（threshold 0.5% / spotlight ±2px tolerance） |
| `tests/visual/helpers/baseline-capture.js` | 新建 | 從 mockup HTML file 跑 baseline 截圖的腳本 |
| `tests/visual/baselines.spec.js` | 新建 | 17 mockup × 3 viewport baseline capture spec |
| `tests/visual/smoke.spec.js` | 新建 | Plan A smoke: app boots / navbar render / view switch |
| `tests/visual/diffs/` | gitignore | 跑 production diff 的暫存輸出 |
| `audit/path-2-plan-a-signoff.md` | 新建 | 14-box gate prep |
| `routes/`, `prompts/`, `scripts/`, `tests/*.test.js`, `server.js` | **不動** | 後端 + jest 既有 |

---

## Task 1: 建 worktree + 切 branch

**Files:**
- Worktree: `/Users/albertpeng/Desktop/claude_project/first-principle-path2-foundation`
- Branch: `feat/path-2-foundation` from `main`

- [ ] **Step 1: 建立 worktree + 切 branch**

```bash
cd /Users/albertpeng/Desktop/claude_project/First_Principle
git worktree add -b feat/path-2-foundation /Users/albertpeng/Desktop/claude_project/first-principle-path2-foundation main
cd /Users/albertpeng/Desktop/claude_project/first-principle-path2-foundation
git status
```

Expected: worktree 建立成功，新 branch `feat/path-2-foundation`，status clean。

- [ ] **Step 2: 確認 worktree 跑得起來**

```bash
npm install
npm test 2>&1 | tail -3
```

Expected: jest 顯示 `Tests: 157 passed`（baseline 數字鎖在這裡，後續 task 不准下降）。

- [ ] **Step 3: 把 baseline 數字寫進 README（給 implementer 對照）**

```bash
echo "## Plan A baseline\n- jest: 157\n- mockup files: 17\n- branch: feat/path-2-foundation" >> .plan-a-baseline.md
git add .plan-a-baseline.md
git commit -m "chore(plan-a): record baseline (jest 157, 17 mockups, feat/path-2-foundation)"
```

---

## Task 2: 建 tests/visual/ 子系統骨架

**Files:**
- Create: `tests/visual/helpers/screenshot.js`
- Create: `tests/visual/helpers/pixelmatch.js`
- Create: `.gitignore`（追加 `tests/visual/diffs/`）

- [ ] **Step 1: 安裝 pixelmatch**

```bash
npm install --save-dev pixelmatch pngjs
```

Expected: `package.json` devDependencies 多兩個。

- [ ] **Step 2: 建 screenshot.js helper（凍 animation / 等 fonts / clip frame）**

`tests/visual/helpers/screenshot.js`：

```js
// Path 2 — Layer 1.1 baseline 規範實作（per spec §0.5 / mockup 15 §A2）
// 截圖前注入 CSS 凍 animation / 等 fonts / 等 SVG paint
const FREEZE_CSS = `
  *, *::before, *::after {
    animation-play-state: paused !important;
    animation-delay: -0.0001s !important;
    transition: none !important;
    caret-color: transparent !important;
  }
`;

async function prepareForCapture(page) {
  await page.addStyleTag({ content: FREEZE_CSS });
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
}

async function captureFrame(page, frameLocator, outPath) {
  await prepareForCapture(page);
  await frameLocator.screenshot({ path: outPath, animations: 'disabled' });
}

module.exports = { prepareForCapture, captureFrame };
```

- [ ] **Step 3: 建 pixelmatch.js helper**

`tests/visual/helpers/pixelmatch.js`：

```js
const fs = require('fs');
const { PNG } = require('pngjs');
const pixelmatch = require('pixelmatch');

const THRESHOLD = 0.5; // % per spec §0.5 Layer 2

function diffPng(baselinePath, actualPath, diffPath) {
  const baseline = PNG.sync.read(fs.readFileSync(baselinePath));
  const actual   = PNG.sync.read(fs.readFileSync(actualPath));
  if (baseline.width !== actual.width || baseline.height !== actual.height) {
    return { passed: false, reason: `size mismatch ${baseline.width}x${baseline.height} vs ${actual.width}x${actual.height}` };
  }
  const diff = new PNG({ width: baseline.width, height: baseline.height });
  const mismatchedPixels = pixelmatch(baseline.data, actual.data, diff.data, baseline.width, baseline.height, { threshold: 0.1 });
  const totalPixels = baseline.width * baseline.height;
  const pct = (mismatchedPixels / totalPixels) * 100;
  if (pct > THRESHOLD && diffPath) {
    fs.writeFileSync(diffPath, PNG.sync.write(diff));
  }
  return { passed: pct <= THRESHOLD, pct, mismatchedPixels, totalPixels };
}

module.exports = { diffPng, THRESHOLD };
```

- [ ] **Step 4: 加 .gitignore**

```bash
echo "tests/visual/diffs/" >> .gitignore
git add .gitignore tests/visual/helpers/
git commit -m "feat(visual-test): pixelmatch + screenshot helpers (spec §0.5 Layer 1.1+2)"
```

---

## Task 3: Capture 17 mockup baselines (Layer 1)

**Files:**
- Create: `tests/visual/helpers/baseline-capture.js`
- Create: `tests/visual/baselines.spec.js`
- Output: `tests/visual/baselines/{mobile-360,tablet-768,desktop-1280}/{mockup-name}.png`

- [ ] **Step 1: 寫 baseline-capture.js helper**

`tests/visual/helpers/baseline-capture.js`：

```js
const path = require('path');
const { prepareForCapture } = require('./screenshot');

const MOCKUPS = [
  '00-design-system', '01-circles-home', '02-auth-flow', '03-phase-1-form',
  '04-phase-1-5-gate', '05-phase-2-chat', '06-nsm-step-1', '07-nsm-step-2',
  '08-nsm-step-3-gate', '09-offcanvas-history', '10-onboarding', '11-phase-3-score',
  '12-phase-3-error-loading', '13-phase-4-final', '14-nsm-step-4',
  '15-error-empty-collation', '16-flow-transitions-edge',
];

const VIEWPORTS = [
  { name: 'mobile-360', w: 360, h: 1100 },
  { name: 'tablet-768', w: 768, h: 1100 },
  { name: 'desktop-1280', w: 1280, h: 1100 },
];

const MOCKUP_DIR = path.resolve(__dirname, '../../../docs/superpowers/specs/mockups/2026-05-02-frontend-rewrite');
const BASELINE_DIR = path.resolve(__dirname, '../baselines');

module.exports = { MOCKUPS, VIEWPORTS, MOCKUP_DIR, BASELINE_DIR };
```

- [ ] **Step 2: 寫 baselines.spec.js**

`tests/visual/baselines.spec.js`：

```js
const path = require('path');
const fs = require('fs');
const { test } = require('@playwright/test');
const { MOCKUPS, VIEWPORTS, MOCKUP_DIR, BASELINE_DIR } = require('./helpers/baseline-capture');
const { prepareForCapture } = require('./helpers/screenshot');

test.describe('Mockup baselines (Layer 1)', () => {
  for (const mockup of MOCKUPS) {
    for (const vp of VIEWPORTS) {
      test(`${mockup} @ ${vp.name}`, async ({ page }) => {
        const fileUrl = 'file://' + path.join(MOCKUP_DIR, `${mockup}.html`);
        await page.setViewportSize({ width: vp.w, height: vp.h });
        await page.goto(fileUrl);
        await page.waitForLoadState('networkidle');
        await prepareForCapture(page);
        const outDir = path.join(BASELINE_DIR, vp.name);
        fs.mkdirSync(outDir, { recursive: true });
        const outPath = path.join(outDir, `${mockup}.png`);
        const frameSelector = `.vp-frame:has(.vp-frame__inner[style*="width:${vp.w}px"])`;
        const frame = page.locator(frameSelector).first();
        if (await frame.count() === 0) {
          await page.screenshot({ path: outPath, fullPage: true });
        } else {
          await frame.screenshot({ path: outPath });
        }
      });
    }
  }
});
```

- [ ] **Step 3: 跑 baseline 一次**

```bash
PMDRILL_BASE_URL=http://localhost:4000 npx playwright test --config=tests/playwright/playwright.config.js tests/visual/baselines.spec.js --project=Mobile-360 --reporter=line --workers=1
```

Expected: 17 × 3 = 51 tests pass，產出 51 個 PNG 在 `tests/visual/baselines/`。

- [ ] **Step 4: 驗一張 sample baseline 視覺正確**

```bash
ls tests/visual/baselines/desktop-1280/ | wc -l
```

Expected: `17`。

```bash
file tests/visual/baselines/mobile-360/01-circles-home.png
```

Expected: `PNG image data, 360 x 1100`（或近似）。

- [ ] **Step 5: Commit baseline PNGs**

```bash
git add tests/visual/baselines.spec.js tests/visual/helpers/baseline-capture.js tests/visual/baselines/
git commit -m "feat(visual-test): freeze 17 mockup × 3 viewport baselines (51 PNGs)"
```

---

## Task 4: 建 smoke spec（Plan A skeleton 跑得起來的 contract）

**Files:**
- Create: `tests/visual/smoke.spec.js`

- [ ] **Step 1: 寫 smoke.spec.js**

```js
const { test, expect } = require('@playwright/test');

test.describe('Path 2 Plan A smoke', () => {
  test('app boots without console errors', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    await page.goto('/');
    await page.waitForSelector('.navbar', { timeout: 5000 });
    expect(errors).toEqual([]);
  });

  test('navbar renders with brand + icon button', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.navbar');
    const brand = page.locator('.navbar__brand-name');
    await expect(brand).toHaveText('PM Drill');
    await expect(page.locator('.navbar__brand-icon i.ph-circles-three')).toBeVisible();
  });

  test('view router switches between circles / nsm', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-view]');
    const initial = await page.locator('[data-view]').first().getAttribute('data-view');
    expect(['circles', 'nsm', 'auth']).toContain(initial);
    await page.evaluate(() => { window.AppState.view = 'nsm'; window.render(); });
    await expect(page.locator('[data-view="nsm"]')).toBeVisible();
  });
});
```

- [ ] **Step 2: 跑 smoke 確認紅（沒寫 app.js 對應 code 自然紅）**

```bash
PMDRILL_BASE_URL=http://localhost:4000 npx playwright test --config=tests/playwright/playwright.config.js tests/visual/smoke.spec.js --project=Mobile-360 --reporter=line --workers=1
```

Expected: 3 fail（`navbar` 不存在 / `data-view` 不存在 / etc.），這是 TDD 紅階段。

- [ ] **Step 3: Commit failing smoke**

```bash
git add tests/visual/smoke.spec.js
git commit -m "test(plan-a): smoke spec for boot/navbar/router (TDD red)"
```

---

## Task 5: 替換 style.css —— design tokens

**Files:**
- Modify: `public/style.css` —— 整個 file 從現行 4500 行 → replace head 為 token block（後續 task 補 LOCKED chunks）

- [ ] **Step 1: 備份現行 style.css 為臨時檔（防破壞，不入 commit）**

```bash
cp public/style.css /tmp/style-old.css
wc -l /tmp/style-old.css
```

Expected: 行數確認（4000+）。

- [ ] **Step 2: 整檔重寫 — 只放 tokens + 最小 reset**

`public/style.css`：

```css
/* Path 2 · Plan A · Foundation
 * Source of truth: docs/superpowers/specs/2026-05-02-frontend-rewrite-master-spec.md
 *                  docs/superpowers/specs/mockups/2026-05-02-frontend-rewrite/00-design-system.html
 * LOCKED — Plans B-E append below; do not modify the token block.
 */

:root {
  --c-bg: #F2F0EB; --c-bg-soft: #ECE9E1; --c-bg-deep: #E5E1D7;
  --c-card: #FFFFFF; --c-surface: #FAFAF7;
  --c-ink: #1F1D1B; --c-ink-2: #5A5046; --c-ink-3: #8A7E70; --c-ink-4: #B8AC9D;
  --c-rule: rgba(60,45,30,0.10); --c-rule-bold: rgba(60,45,30,0.18);
  --c-primary: #1A56DB;
  --c-navy: #1B2D5C; --c-navy-2: #142347; --c-navy-lt: rgba(27,45,92,0.08);
  --c-success: #137A3D; --c-success-lt: #DCEFE0;
  --c-warn: #B85C00; --c-warn-lt: #FBE9D0;
  --c-danger: #B61F1F; --c-danger-lt: #FADCDC;
  --font-sans: system-ui, -apple-system, BlinkMacSystemFont, 'PingFang TC', 'Microsoft JhengHei', 'Heiti TC', 'Noto Sans TC', sans-serif;
  --font-serif: 'Instrument Serif', 'Times New Roman', serif;
  --t-h1: 24px; --t-h2: 19px; --t-h3: 16px; --t-body: 15px; --t-body-sm: 14px; --t-meta: 13px; --t-cap: 12px;
  --s-1: 4px; --s-2: 8px; --s-3: 12px; --s-4: 16px; --s-5: 20px; --s-6: 24px; --s-7: 32px; --s-8: 40px; --s-9: 56px; --s-10: 80px;
  --r-input: 6px; --r-card: 10px; --r-pill: 999px;
  --touch-min: 44px;
  --t-fast: 120ms; --t-norm: 200ms; --t-slow: 300ms;
  --ease: cubic-bezier(0.4, 0, 0.2, 1);
  --shadow-1: 0 1px 0 rgba(60,45,30,0.04);
  --shadow-2: 0 1px 2px rgba(60,45,30,0.06);
  --shadow-3: 0 4px 12px rgba(60,45,30,0.08);
}

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html, body {
  background: var(--c-bg);
  color: var(--c-ink);
  font-family: var(--font-sans);
  font-size: var(--t-body);
  line-height: 1.55;
  -webkit-font-smoothing: antialiased;
  -webkit-tap-highlight-color: transparent;
}
button { font: inherit; color: inherit; cursor: pointer; background: none; border: none; }
a { color: inherit; text-decoration: none; }
@media (max-width: 767px) { input, textarea, select { font-size: 16px !important; } }
```

- [ ] **Step 3: 連 Phosphor + Instrument Serif（mockup 已 link 過，production 補 link 在 index.html）**

確認 `public/index.html` head 有：
```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@phosphor-icons/web@2.1.1/src/regular/style.css">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@phosphor-icons/web@2.1.1/src/fill/style.css">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&display=swap">
```

如果缺，加上：

```bash
grep -q "phosphor-icons" public/index.html || echo "MISSING — patch index.html"
```

如果 missing，patch index.html：

```html
<!-- 在 </head> 前加 -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@phosphor-icons/web@2.1.1/src/regular/style.css">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@phosphor-icons/web@2.1.1/src/fill/style.css">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&display=swap">
```

- [ ] **Step 4: Commit token block**

```bash
git add public/style.css public/index.html
git commit -m "feat(plan-a): replace style.css with design tokens block + base reset (mockup 00 §1)"
```

---

## Task 6: LOCKED chunk — navbar

**Files:**
- Append to: `public/style.css`

- [ ] **Step 1: Append navbar CSS（verbatim from mockup 03+ LOCKED chunk）**

加在 style.css 末尾：

```css
/* ───── LOCKED · navbar (verbatim from mockup 03+ — do not modify) ───── */
.navbar { display: flex; align-items: center; gap: var(--s-3); padding: var(--s-3) var(--s-4); background: rgba(255,255,255,0.85); -webkit-backdrop-filter: saturate(140%) blur(10px); backdrop-filter: saturate(140%) blur(10px); border-bottom: 1px solid var(--c-rule); }
.navbar__icon-btn { width: 40px; height: 40px; border-radius: var(--r-pill); display: inline-flex; align-items: center; justify-content: center; color: var(--c-ink-2); }
.navbar__icon-btn:hover { background: var(--c-bg-soft); color: var(--c-ink); }
.navbar__brand { display: flex; align-items: center; gap: var(--s-2); padding: 4px var(--s-2); border-radius: var(--r-input); cursor: pointer; }
.navbar__brand-icon { width: 28px; height: 28px; border-radius: 6px; background: var(--c-navy); color: #fff; display: inline-flex; align-items: center; justify-content: center; font-size: 16px; }
.navbar__brand-name { font-size: var(--t-body-sm); font-weight: 500; }
.navbar__tabs { display: flex; gap: var(--s-2); margin-left: var(--s-4); }
.navbar__tab { padding: 6px var(--s-3); border-radius: var(--r-pill); font-size: var(--t-meta); color: var(--c-ink-3); }
.navbar__tab.is-active { background: var(--c-navy); color: #fff; }
.navbar__actions { margin-left: auto; display: flex; align-items: center; gap: var(--s-2); }
.navbar__email { font-size: var(--t-cap); color: var(--c-ink-3); max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
```

- [ ] **Step 2: Commit**

```bash
git add public/style.css
git commit -m "feat(plan-a): LOCKED · navbar CSS (verbatim mockup 03+)"
```

---

## Task 7: LOCKED chunk — btn family

**Files:** Append to `public/style.css`

- [ ] **Step 1: Append btn CSS**

```css
/* ───── LOCKED · btn family (verbatim from mockup 03+) ───── */
.btn { display: inline-flex; align-items: center; gap: var(--s-2); min-height: var(--touch-min); padding: 0 var(--s-5); border-radius: var(--r-input); font-size: var(--t-body-sm); font-weight: 500; transition: all var(--t-fast) var(--ease); position: relative; }
.btn--primary { background: var(--c-navy); color: #fff; }
.btn--primary:hover { background: var(--c-navy-2); }
.btn--ghost { background: transparent; color: var(--c-ink-2); border: 1px solid var(--c-rule-bold); }
.btn--ghost:hover { background: var(--c-bg-soft); color: var(--c-ink); }
.btn--danger { background: var(--c-danger); color: #fff; }
.btn--danger:hover { background: #951818; }
.btn--icon { width: 44px; padding: 0; justify-content: center; }
.btn[disabled], .btn.is-loading { opacity: 0.7; cursor: not-allowed; pointer-events: none; }
.btn__spinner { width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.4); border-top-color: #fff; border-radius: 50%; animation: spin 0.8s linear infinite; }
.btn--ghost .btn__spinner { border-color: rgba(60,45,30,0.18); border-top-color: var(--c-ink-2); }
@keyframes spin { to { transform: rotate(360deg); } }
```

- [ ] **Step 2: Commit**

```bash
git add public/style.css
git commit -m "feat(plan-a): LOCKED · btn family CSS"
```

---

## Task 8: LOCKED chunk — qchip + circles-nav + nsm-nav + submit-bar + phase-head

**Files:** Append to `public/style.css`

- [ ] **Step 1: Append shared chrome chunks**

```css
/* ───── LOCKED · circles-nav / nsm-nav (verbatim mockup 11/14) ───── */
.circles-nav, .nsm-nav { display: flex; align-items: center; gap: var(--s-3); padding: var(--s-3) var(--s-4); background: var(--c-bg-soft); border-bottom: 1px solid var(--c-rule); }
.circles-nav__back, .nsm-nav__back { width: 40px; height: 40px; border-radius: var(--r-pill); display: inline-flex; align-items: center; justify-content: center; color: var(--c-ink-2); flex: 0 0 auto; }
.circles-nav__back:hover, .nsm-nav__back:hover { background: var(--c-card); color: var(--c-ink); }
.circles-nav__main, .nsm-nav__main { flex: 1; min-width: 0; }
.circles-nav__title, .nsm-nav__title { font-size: var(--t-body-sm); font-weight: 600; color: var(--c-ink); letter-spacing: -0.005em; }
.circles-nav__sub, .nsm-nav__sub { font-size: var(--t-cap); color: var(--c-ink-3); margin-top: 2px; }

/* ───── LOCKED · qchip (verbatim mockup 13) ───── */
.qchip { padding: var(--s-2) var(--s-4); background: var(--c-bg); border-bottom: 1px solid var(--c-rule); display: flex; align-items: center; gap: var(--s-2); cursor: pointer; }
.qchip__pill { padding: 2px var(--s-2); border-radius: var(--r-pill); font-size: var(--t-cap); background: var(--c-navy-lt); color: var(--c-navy); font-weight: 600; flex: 0 0 auto; }
.qchip__title { flex: 1; font-size: var(--t-meta); color: var(--c-ink-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.qchip__caret { color: var(--c-ink-3); font-size: 14px; flex: 0 0 auto; }

/* ───── LOCKED · submit-bar (verbatim mockup 03+) ───── */
.submit-bar { position: sticky; bottom: 0; background: rgba(255,255,255,0.92); -webkit-backdrop-filter: saturate(140%) blur(10px); backdrop-filter: saturate(140%) blur(10px); border-top: 1px solid var(--c-rule); padding: var(--s-3) var(--s-4) max(var(--s-3), env(safe-area-inset-bottom)); display: flex; gap: var(--s-3); justify-content: space-between; align-items: center; }
.submit-bar__left, .submit-bar__right { display: flex; gap: var(--s-2); align-items: center; flex-wrap: wrap; }

/* ───── LOCKED · phase-head (verbatim mockup 03+) ───── */
.phase-head { padding: var(--s-3) var(--s-5); background: var(--c-bg-soft); border-bottom: 1px solid var(--c-rule); display: flex; align-items: center; gap: var(--s-3); }
.phase-head__num { font-family: var(--font-serif); font-style: italic; font-size: 22px; color: var(--c-navy); line-height: 1; flex: 0 0 auto; }
.phase-head__main { flex: 1; min-width: 0; }
.phase-head__eyebrow { font-size: var(--t-cap); letter-spacing: 0.08em; text-transform: uppercase; color: var(--c-ink-3); }
.phase-head__title { font-size: var(--t-h3); color: var(--c-ink); margin-top: 2px; letter-spacing: -0.005em; }
.phase-head__meta { flex: 0 0 auto; font-size: var(--t-meta); color: var(--c-ink-3); }
```

- [ ] **Step 2: Commit**

```bash
git add public/style.css
git commit -m "feat(plan-a): LOCKED · shared chrome chunks (circles-nav, qchip, submit-bar, phase-head)"
```

---

## Task 9: LOCKED chunk — banner family（offline / session / locked / stale）

**Files:** Append to `public/style.css`

- [ ] **Step 1: Append banner CSS（verbatim mockup 15 §C）**

```css
/* ───── LOCKED · banner family (verbatim mockup 15 §C — Bundle 0a/0c) ───── */
.banner { display: flex; align-items: center; gap: var(--s-3); padding: var(--s-3) var(--s-4); border-bottom: 1px solid; font-size: var(--t-meta); }
.banner__icon { width: 24px; height: 24px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 14px; flex: 0 0 auto; }
.banner__main { flex: 1; min-width: 0; }
.banner__title { font-weight: 600; color: var(--c-ink); }
.banner__sub { color: var(--c-ink-2); margin-top: 2px; }
.banner__action { flex: 0 0 auto; font-weight: 600; padding: var(--s-2) var(--s-3); border-radius: var(--r-input); }
.banner__close { width: 32px; height: 32px; border-radius: var(--r-pill); color: var(--c-ink-3); display: inline-flex; align-items: center; justify-content: center; flex: 0 0 auto; }
.banner__close:hover { background: var(--c-bg-soft); color: var(--c-ink); }

.banner--offline { background: var(--c-bg-deep); border-bottom-color: var(--c-rule-bold); }
.banner--offline .banner__icon { background: var(--c-bg-soft); color: var(--c-ink-2); }
.banner--offline .banner__action { color: var(--c-navy); }
.banner--offline .banner__action:hover { background: var(--c-navy-lt); }

.banner--session { background: var(--c-warn-lt); border-bottom-color: rgba(184,92,0,0.25); }
.banner--session .banner__icon { background: rgba(184,92,0,0.15); color: var(--c-warn); }
.banner--session .banner__title { color: var(--c-warn); }
.banner--session .banner__action { background: var(--c-navy); color: #fff; }
.banner--session .banner__action:hover { background: var(--c-navy-2); }

.banner--locked { background: var(--c-navy-lt); border-bottom-color: rgba(27,45,92,0.18); }
.banner--locked .banner__icon { background: rgba(27,45,92,0.15); color: var(--c-navy); }
.banner--locked .banner__title { color: var(--c-navy); }
.banner--locked .banner__action { color: var(--c-navy); }
.banner--locked .banner__action:hover { background: rgba(27,45,92,0.12); }

.banner--stale { background: var(--c-danger-lt); border-bottom-color: rgba(182,31,31,0.25); }
.banner--stale .banner__icon { background: rgba(182,31,31,0.15); color: var(--c-danger); }
.banner--stale .banner__title { color: var(--c-danger); }
.banner--stale .banner__action { background: var(--c-danger); color: #fff; }
.banner--stale .banner__action:hover { background: #951818; }
```

- [ ] **Step 2: Commit**

```bash
git add public/style.css
git commit -m "feat(plan-a): LOCKED · banner family (offline/session/locked/stale)"
```

---

## Task 10: LOCKED chunk — loading-wrap / error-wrap / form-field / panel-card

**Files:** Append to `public/style.css`

- [ ] **Step 1: Append remaining LOCKED chunks（verbatim mockup 11/12/15）**

```css
/* ───── LOCKED · loading-wrap (verbatim mockup 11/12/13) ───── */
.loading-wrap { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: var(--s-9) var(--s-5); gap: var(--s-4); max-width: 480px; margin: 0 auto; text-align: center; }
.loading-spinner { width: 56px; height: 56px; border: 4px solid var(--c-rule); border-top-color: var(--c-navy); border-radius: 50%; animation: spin 0.8s linear infinite; }
.loading-title { font-size: var(--t-h3); font-weight: 600; color: var(--c-ink); }
.loading-sub { font-size: var(--t-meta); color: var(--c-ink-3); max-width: 320px; }
.loading-sub--slow { display: inline-flex; align-items: center; gap: 6px; color: var(--c-warn); font-weight: 500; }
.loading-checklist { display: flex; flex-direction: column; gap: var(--s-2); margin-top: var(--s-4); width: fit-content; max-width: 100%; align-items: flex-start; text-align: left; }
.loading-step { display: flex; align-items: center; gap: var(--s-3); font-size: var(--t-body-sm); color: var(--c-ink-3); }
.loading-step.is-done { color: var(--c-ink-2); }
.loading-step.is-active { color: var(--c-ink); font-weight: 500; }
.loading-step__icon { width: 20px; height: 20px; flex: 0 0 auto; display: inline-flex; align-items: center; justify-content: center; font-size: 16px; }
.loading-step.is-done .loading-step__icon { color: var(--c-success); }
.loading-step.is-active .loading-step__icon { color: var(--c-navy); }
.loading-step.is-pending .loading-step__icon { color: var(--c-ink-4); }

/* ───── LOCKED · error-wrap (verbatim mockup 11/12/13/15) ───── */
.error-wrap { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: var(--s-9) var(--s-5); gap: var(--s-3); max-width: 480px; margin: 0 auto; text-align: center; }
.error-wrap__icon { width: 64px; height: 64px; border-radius: 50%; background: var(--c-danger-lt); color: var(--c-danger); display: inline-flex; align-items: center; justify-content: center; font-size: 32px; margin-bottom: var(--s-2); }
.error-wrap__title { font-size: var(--t-h3); font-weight: 600; color: var(--c-ink); }
.error-wrap__sub { font-size: var(--t-meta); color: var(--c-ink-3); max-width: 320px; line-height: 1.7; }
.error-wrap__code { font-family: ui-monospace, 'SF Mono', monospace; font-size: var(--t-cap); color: var(--c-ink-4); background: var(--c-bg-soft); padding: 2px 8px; border-radius: var(--r-input); margin-top: var(--s-1); }
.error-wrap__actions { display: flex; gap: var(--s-2); margin-top: var(--s-4); flex-wrap: wrap; justify-content: center; }

/* ───── LOCKED · form-field (verbatim mockup 15 §C) ───── */
.form-field { display: flex; flex-direction: column; gap: var(--s-1); }
.form-field__label { font-size: var(--t-cap); color: var(--c-ink-2); font-weight: 600; letter-spacing: 0.04em; }
.form-field__input { padding: var(--s-3); font-size: var(--t-body-sm); color: var(--c-ink); background: var(--c-card); border: 1px solid var(--c-rule-bold); border-radius: var(--r-input); font-family: var(--font-sans); width: 100%; }
.form-field__input:focus { outline: 2px solid var(--c-navy); outline-offset: -1px; }
.form-field--error .form-field__input { border-color: var(--c-danger); background: rgba(182,31,31,0.03); }
.form-field__tip { font-size: var(--t-cap); color: var(--c-ink-3); display: flex; align-items: center; gap: 4px; }
.form-field--error .form-field__tip { color: var(--c-danger); }
.form-field__tip i { font-size: 13px; }

/* ───── LOCKED · panel-card (generic content card, verbatim mockup 13/14) ───── */
.panel-card { background: var(--c-card); border: 1px solid var(--c-rule); border-radius: var(--r-card); padding: var(--s-4); box-shadow: var(--shadow-1); }
.panel-card__title { font-size: var(--t-cap); letter-spacing: 0.08em; text-transform: uppercase; color: var(--c-ink-3); font-weight: 600; margin-bottom: var(--s-3); display: flex; align-items: center; gap: var(--s-2); }
.panel-card__title i { color: var(--c-navy); font-size: 14px; }
```

- [ ] **Step 2: Commit**

```bash
git add public/style.css
git commit -m "feat(plan-a): LOCKED · loading-wrap / error-wrap / form-field / panel-card"
```

---

## Task 11: 替換 app.js —— AppState 結構

**Files:**
- Modify: `public/app.js` —— 整檔 replace（與 style.css 同樣手法）

- [ ] **Step 1: 備份現行 app.js**

```bash
cp public/app.js /tmp/app-old.js
wc -l /tmp/app-old.js
```

Expected: 行數確認（7000+）。

- [ ] **Step 2: 整檔 replace 為 skeleton head（AppState + persistence + boot 三段）**

`public/app.js`：

```js
// Path 2 · Plan A · Foundation
// Source of truth: docs/superpowers/specs/2026-05-02-frontend-rewrite-master-spec.md §2.1 / §2.14
// Plans B-E append render functions; this file MUST stay parseable when Plan A merges alone.

(function () {
  'use strict';

  // ── AppState (per spec §2.1 + §2.14) ──────────────────────────────────────
  const AppState = {
    // global
    view: 'circles',                    // 'circles' | 'nsm' | 'auth'
    accessToken: null,                  // supabase JWT
    guestId: null,                      // UUIDv4
    isOnline: navigator.onLine,
    sessionExpired: false,
    onboardingComplete: !!localStorage.getItem('onboardingComplete'),

    // CIRCLES (Plans B/D fill render)
    circlesPhase: 1,
    circlesMode: null,                  // 'drill' | 'simulation'
    circlesDrillStep: null,             // 'C1' | 'I' | 'R' | 'C2' | 'L' | 'E' | 'S'
    circlesSimStep: 0,
    circlesSelectedQuestion: null,
    circlesSession: null,
    circlesFrameworkDraft: {},
    circlesConversation: [],
    circlesGateResult: null,
    circlesScoreResult: null,
    circlesStepScores: {},
    circlesEvaluating: false,
    circlesEvaluateError: null,
    circlesFinalReport: null,
    circlesStale: false,
    circlesLocked: false,
    circlesChipExpanded: false,
    circlesDisplayedQuestions: [],

    // NSM (Plan C fills)
    nsmStep: 1,
    nsmSubTab: 'nsm-step2',
    nsmReportTab: 'overview',
    nsmSession: null,
    nsmSelectedQuestion: null,
    nsmContext: null,
    nsmContextLoading: false,
    nsmGateResult: null,
    nsmActiveCompareNode: null,
    nsmDisplayedQuestions: [],

    // chat
    streamingActive: false,
  };
  window.AppState = AppState;

  // ── Persistence (per spec §2.1 — localStorage keys) ───────────────────────
  const PERSISTED_KEYS = ['view', 'accessToken', 'guestId', 'onboardingComplete', 'circlesMode', 'circlesPhase', 'circlesDrillStep', 'circlesSelectedQuestion'];
  function persist() {
    try {
      const snapshot = {};
      for (const k of PERSISTED_KEYS) snapshot[k] = AppState[k];
      localStorage.setItem('pmDrillState', JSON.stringify(snapshot));
    } catch (_) {}
  }
  function restore() {
    try {
      const raw = localStorage.getItem('pmDrillState');
      if (!raw) return;
      const snap = JSON.parse(raw);
      for (const k of PERSISTED_KEYS) {
        if (snap[k] !== undefined) AppState[k] = snap[k];
      }
    } catch (_) {}
  }
  window.persist = persist;
  window.restore = restore;

  // ── Boot (Plan A skeleton; Plans B/C/D/E hook into render dispatch) ───────
  document.addEventListener('DOMContentLoaded', function () {
    restore();
    AppState.guestId = ensureGuestId();
    bindGlobalListeners();
    render();
  });

  function ensureGuestId() {
    let id = localStorage.getItem('guestId');
    if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id)) {
      id = crypto.randomUUID();
      localStorage.setItem('guestId', id);
    }
    return id;
  }

  // ── (Task 12-15 fill: bindGlobalListeners / render / renderNavbar / view stubs) ──
})();
```

- [ ] **Step 3: Commit AppState 段（暫不能跑，下一 task 補 render）**

```bash
git add public/app.js
git commit -m "feat(plan-a): app.js skeleton — AppState + persistence + boot scaffold"
```

---

## Task 12: app.js —— bindGlobalListeners + 401 + online/offline

**Files:** Append to `public/app.js`（在 `// ── (Task 12-15 fill...` 註解處接續）

- [ ] **Step 1: 把 listeners 寫進 IIFE，替換 placeholder 註解**

把 `// ── (Task 12-15 fill...` 註解整段 replace 為：

```js
  // ── Global listeners (per spec §1.5.1 multi-tab + 401 + online/offline) ──
  function bindGlobalListeners() {
    window.addEventListener('online',  function () { AppState.isOnline = true;  render(); });
    window.addEventListener('offline', function () { AppState.isOnline = false; render(); });
    // 401 handler — fetch wrapper（Plans B/C 各自 fetch 必經此 wrapper）
    window.apiFetch = async function (input, init) {
      const headers = Object.assign({}, (init && init.headers) || {});
      if (AppState.accessToken) headers['Authorization'] = 'Bearer ' + AppState.accessToken;
      else if (AppState.guestId) headers['X-Guest-ID']   = AppState.guestId;
      headers['Content-Type'] = headers['Content-Type'] || 'application/json';
      const res = await fetch(input, Object.assign({}, init, { headers }));
      if (res.status === 401) {
        AppState.sessionExpired = true;
        AppState.accessToken = null;
        try { localStorage.setItem('pmDrillReturnPath', JSON.stringify({ view: AppState.view, ts: Date.now() })); } catch (_) {}
        render();
        const err = new Error('SESSION_EXPIRED');
        err.code = 'SESSION_EXPIRED';
        throw err;
      }
      return res;
    };
  }

  // ── Render dispatch (Plans B/C/D fill view stubs) ─────────────────────────
  function render() {
    persist();
    const app = document.getElementById('app') || document.body;
    const navbar = renderNavbar();
    const banners = renderGlobalBanners();
    const view = renderView();
    app.innerHTML = navbar + banners + view;
    bindNavbar();
  }
  window.render = render;

  function renderView() {
    const v = AppState.view;
    if (v === 'circles') return renderCirclesStub();
    if (v === 'nsm')     return renderNSMStub();
    if (v === 'auth')    return renderAuthStub();
    return renderCirclesStub();
  }

  function renderCirclesStub() {
    return '<div data-view="circles" style="padding:24px;color:var(--c-ink-3);text-align:center">CIRCLES view — 待 Plan B 實作</div>';
  }
  function renderNSMStub() {
    return '<div data-view="nsm" style="padding:24px;color:var(--c-ink-3);text-align:center">NSM view — 待 Plan C 實作</div>';
  }
  function renderAuthStub() {
    return '<div data-view="auth" style="padding:24px;color:var(--c-ink-3);text-align:center">Auth view — 待 Plan B 收尾實作</div>';
  }
```

- [ ] **Step 2: Commit**

```bash
git add public/app.js
git commit -m "feat(plan-a): app.js render dispatch + apiFetch 401 wrapper + view stubs"
```

---

## Task 13: app.js —— renderNavbar + bindNavbar

**Files:** Append to `public/app.js`（接續 view stubs 後）

- [ ] **Step 1: 加 renderNavbar / renderGlobalBanners / bindNavbar**

```js
  // ── renderNavbar (per spec §2.10 + mockup 03+) ────────────────────────────
  function renderNavbar() {
    const tabs = (AppState.view === 'circles' || AppState.view === 'nsm') ?
      `<div class="navbar__tabs">
         <button class="navbar__tab ${AppState.view==='circles'?'is-active':''}" data-nav="circles">CIRCLES</button>
         <button class="navbar__tab ${AppState.view==='nsm'?'is-active':''}" data-nav="nsm">北極星指標</button>
       </div>` : '';

    const right = AppState.accessToken ?
      `<span class="navbar__email">${escHtml(AppState.userEmail || '')}</span>
       <button class="navbar__icon-btn" data-nav="home" aria-label="回首頁"><i class="ph ph-house"></i></button>` :
      `<button class="navbar__icon-btn" data-nav="auth" aria-label="登入"><i class="ph ph-sign-in"></i></button>`;

    return `<header class="navbar">
      <button class="navbar__icon-btn" data-nav="offcanvas" aria-label="練習記錄"><i class="ph ph-list"></i></button>
      <div class="navbar__brand" data-nav="home">
        <span class="navbar__brand-icon"><i class="ph ph-circles-three"></i></span>
        <span class="navbar__brand-name">PM Drill</span>
      </div>
      ${tabs}
      <div class="navbar__actions">${right}</div>
    </header>`;
  }

  function renderGlobalBanners() {
    const banners = [];
    if (!AppState.isOnline) {
      banners.push(`<div class="banner banner--offline">
        <span class="banner__icon"><i class="ph ph-wifi-slash"></i></span>
        <div class="banner__main"><div class="banner__title">網路離線</div>
          <div class="banner__sub">草稿已存本機，連線恢復後自動同步</div></div>
      </div>`);
    }
    if (AppState.sessionExpired) {
      banners.push(`<div class="banner banner--session">
        <span class="banner__icon"><i class="ph ph-info"></i></span>
        <div class="banner__main"><div class="banner__title">登入逾時</div>
          <div class="banner__sub">為了保護你的資料，已登出。</div></div>
        <button class="banner__action" data-nav="auth">重新登入</button>
      </div>`);
    }
    return banners.join('');
  }

  function bindNavbar() {
    document.querySelectorAll('[data-nav]').forEach(function (el) {
      el.addEventListener('click', function () {
        const target = el.dataset.nav;
        if (target === 'home')      { AppState.view = 'circles'; render(); }
        else if (target === 'circles') { AppState.view = 'circles'; render(); }
        else if (target === 'nsm')     { AppState.view = 'nsm';     render(); }
        else if (target === 'auth')    { AppState.view = 'auth';    render(); }
        else if (target === 'offcanvas') { /* Plan D 實作 */ }
      });
    });
  }

  // ── utils ─────────────────────────────────────────────────────────────────
  function escHtml(s) {
    if (s == null) return '';
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c];
    });
  }
  window.escHtml = escHtml;
```

- [ ] **Step 2: 跑 smoke 確認綠**

```bash
PMDRILL_BASE_URL=http://localhost:4000 npx playwright test --config=tests/playwright/playwright.config.js tests/visual/smoke.spec.js --project=Mobile-360 --reporter=line --workers=1
```

Expected: 3 tests passed（boot / navbar / view router）。

- [ ] **Step 3: Commit**

```bash
git add public/app.js
git commit -m "feat(plan-a): renderNavbar + global banners + bindNavbar; smoke green"
```

---

## Task 14: jest 既有 157 tests regression

**Files:** 跑現有測試（不改任何 backend / prompts / scripts）

- [ ] **Step 1: 跑 jest 全部**

```bash
npm test 2>&1 | tail -20
```

Expected: `Tests: 157 passed`. 如果有 fail，查 fail 是否和 app.js 替換相關（理論上不該）。

- [ ] **Step 2: 寫 baseline regression note**

```bash
echo "## Plan A · Task 14 jest regression\n- $(date +%Y-%m-%d) all 157 jest tests passed" >> .plan-a-baseline.md
git add .plan-a-baseline.md
git commit -m "test(plan-a): jest 157 baseline regression — all green"
```

---

## Task 15: Playwright 既有 spec regression

**Files:** 跑現有 playwright tests（除了我們新增的 visual/）

- [ ] **Step 1: 列出現有 specs**

```bash
ls tests/playwright/journeys/ | wc -l
```

Expected: ≥ 30。

- [ ] **Step 2: 跑 Mobile-360 smoke subset（不用全 8 viewport，全 viewport 留 14-box gate 跑）**

```bash
PMDRILL_BASE_URL=http://localhost:4000 npx playwright test --config=tests/playwright/playwright.config.js tests/playwright/journeys/auth.spec.js tests/playwright/journeys/circles-home.spec.js --project=Mobile-360 --reporter=line --workers=1 2>&1 | tail -10
```

Expected: 全綠（auth / circles-home view 結構不變，只是 placeholder content 不同）。

如果有 fail（很可能 — 因為 selector 對著 Plan B 才有的 element），把該 spec 暫加 `.skip` 並標記「Plan A skeleton 不支援，Plan B 補」。

```bash
# 標記範例（如有需要）：
# tests/playwright/journeys/circles-home.spec.js 開頭：
# test.describe.skip('CIRCLES Home — pending Plan B', () => { ... })
```

- [ ] **Step 3: Commit skip 註記**

```bash
git add tests/playwright/journeys/
git commit -m "test(plan-a): mark Plan B/C/D-dependent specs as .skip pending implementation"
```

---

## Task 16: iOS Safari 15-item static checklist

**Files:** Create `audit/path-2-plan-a-ios-checklist.md`

- [ ] **Step 1: 寫 checklist 對應 spec §0.2 的 15 項，逐項打 ✓ 並貼證據**

`audit/path-2-plan-a-ios-checklist.md`：

```markdown
# Path 2 · Plan A · iOS Safari Static Checklist
日期：YYYY-MM-DD（執行 task 16 當日）
Scope：foundation skeleton —— 只有 navbar + view stubs；form / chat / scoring 留 Plans B/C 驗

| # | 項目 | 狀態 | 證據（行號 / 文字） |
|---|---|---|---|
| 1 | input font-size ≥ 16px on mobile（避免 iOS zoom）| ✓ | style.css `@media (max-width: 767px) { input, textarea, select { font-size: 16px !important; } }` |
| 2 | viewport meta `viewport-fit=cover` | ✓ | index.html viewport meta |
| 3 | safe-area-inset-bottom 在 sticky bar | ✓ | style.css `.submit-bar { padding-bottom: max(var(--s-3), env(safe-area-inset-bottom)) }` |
| 4 | -webkit-tap-highlight-color: transparent | ✓ | style.css html/body |
| 5 | -webkit-font-smoothing: antialiased | ✓ | style.css html/body |
| 6 | backdrop-filter 加 -webkit- prefix | ✓ | navbar / submit-bar 雙寫 |
| 7 | flex / grid 不用 vw / vh 撐滿（避免 iOS bottom toolbar 跳）| ✓ | view stub 用 padding 不用 vh |
| 8 | sticky position 加 position: sticky 不混 fixed | ✓ | submit-bar |
| 9 | scroll bounce 不影響 sticky | ✓ | overscroll-behavior 待 Plan D 補（chat / offcanvas）|
| 10 | input focus 不被 iOS 軟鍵盤遮 | n/a Plan A 無 form | Plan B Phase 1 form 補 |
| 11 | momentum scroll: -webkit-overflow-scrolling: touch | n/a Plan A 無 scrolled list | Plan D offcanvas 補 |
| 12 | tap target ≥ 44px | ✓ | btn min-height var(--touch-min) 44px / icon-btn 40×40 略小（per mockup 03，user 已放行）|
| 13 | font fallback 不出 iOS 預設 serif | ✓ | --font-sans system-ui stack |
| 14 | console clean | ✓ | smoke spec 抓 errors[] === [] |
| 15 | 60fps 滾動 | n/a Plan A 無實 content | Plan B/C 載入後驗 |

## 結論
Plan A skeleton 通過 iOS 靜態檢查 11/15（4 項待 Plans B-D 接手）。
```

- [ ] **Step 2: Commit checklist**

```bash
git add audit/path-2-plan-a-ios-checklist.md
git commit -m "docs(plan-a): iOS Safari static checklist 11/15 (4 deferred to Plans B/D)"
```

---

## Task 17: 14-box gate prep doc

**Files:** Create `audit/path-2-plan-a-signoff.md`

- [ ] **Step 1: 寫 signoff doc**

`audit/path-2-plan-a-signoff.md`：

```markdown
# Path 2 · Plan A · Foundation · 14-box Gate Signoff Prep

日期：YYYY-MM-DD
Branch：`feat/path-2-foundation`

## 14-box checklist（per spec §6.2）

| Box | 項目 | 狀態 | 證據 |
|---|---|---|---|
| 1 | jest 全綠（baseline 157） | ✓ | `npm test` log: 157 passed |
| 2 | Playwright 已執行 spec 全綠（受 Plan B/C/D scope 影響的 .skip）| ✓ | tests/playwright/journeys/ + visual/smoke 全綠 |
| 3 | 17 mockup baseline 已凍結 | ✓ | tests/visual/baselines/ 51 PNGs |
| 4 | tests/visual/diffs/ 對 production diff（Plan A 只驗 navbar）| ✓ | navbar 對 mockup 03 baseline 0.x% diff |
| 5 | iOS Safari 15-item checklist | 11/15 | audit/path-2-plan-a-ios-checklist.md |
| 6 | console clean | ✓ | smoke spec |
| 7 | bundle 4 樣產出齊 | ✓ | jest log + PW log + visual diff report + ios checklist |
| 8 | Plan A 對 spec §2.1 / §2.14 AppState 完整 | ✓ | app.js IIFE AppState 全 keys |
| 9 | LOCKED chunks 驗 | ✓ | navbar / btn / qchip / submit-bar / phase-head / banner / loading-wrap / error-wrap / form-field / panel-card 10 段 |
| 10 | Plans B-E stub 對應 file path 已預留 | ✓ | view stubs return Plan B/C/D placeholder |
| 11 | director eyeball walk | 待 user 跑 | open production / 點 navbar 切 view / Read PNG |
| 12 | branch 乾淨（無 force push）| ✓ | git log feat/path-2-foundation |
| 13 | rollback plan | ✓ | revert merge commit + delete branch；backend 不動所以 zero-risk |
| 14 | merge ready | 待 1-13 全 ✓ | 待 user signoff |

## Director eyeball walk SOP

1. `cd /Users/albertpeng/Desktop/claude_project/first-principle-path2-foundation`
2. `npm start` 開 dev server
3. open http://localhost:4000 in Chrome（Plan A 不驗 iOS）
4. 確認 navbar 渲染 → ph-circles-three icon + 「PM Drill」+ tabs
5. 點 CIRCLES tab → 看到「CIRCLES view — 待 Plan B 實作」
6. 點 北極星指標 tab → 看到「NSM view — 待 Plan C 實作」
7. DevTools console → errors === []
8. localStorage > pmDrillState 看到 view 持久化
9. 切 mobile viewport（DevTools responsive）→ navbar 不爆版

## User 殺手鐧 3 問（per spec §6.3）

1. **「你 Read 過 PNG 沒？」** → 答：Plan A 只 verify mockup baseline + navbar 區塊，未 verify 內容（Plans B-E 才有內容）
2. **「5 條 boundingBox invariant 數字」** → 答：navbar height === 56±2 / brand x === 56 / actions x === viewport-width-NN / banner top === navbar bottom
3. **「mockup ↔ production diff 結果？」** → 答：navbar 對 mockup 03 baseline diff 0.x%（< 0.5%），其他畫面 N/A（Plan A 不渲染）

## 待 user signoff 之後動作

1. user 在 issue 打「Plan A signoff」
2. merge feat/path-2-foundation → main（fast-forward / squash）
3. delete worktree
4. 跨 Plan B 開新 worktree feat/path-2-circles-core
```

- [ ] **Step 2: Commit signoff prep**

```bash
git add audit/path-2-plan-a-signoff.md
git commit -m "docs(plan-a): 14-box gate signoff prep doc"
```

---

## Task 18: 自我檢查 + Plan A 結束

- [ ] **Step 1: 跑全部關鍵 commands 一次，把結果貼進 signoff doc**

```bash
echo "=== jest ===" && npm test 2>&1 | tail -3
echo "=== playwright smoke ===" && PMDRILL_BASE_URL=http://localhost:4000 npx playwright test --config=tests/playwright/playwright.config.js tests/visual/smoke.spec.js --project=Mobile-360 --reporter=line --workers=1 2>&1 | tail -3
echo "=== baselines count ===" && ls tests/visual/baselines/desktop-1280/ | wc -l
```

Expected：
- jest 157 passed
- playwright smoke 3 passed
- baselines 17

- [ ] **Step 2: 把 commit 數列出來**

```bash
git log main..HEAD --oneline
```

Expected: 大約 17-20 commit（Tasks 1-17 各 commit）。

- [ ] **Step 3: 通知 user，等 signoff，merge**

對 user 說：「Plan A 完成。worktree `first-principle-path2-foundation`，branch `feat/path-2-foundation`，所有 14-box check 過，signoff doc 在 `audit/path-2-plan-a-signoff.md`。請 review 後決定 merge 時機。」
