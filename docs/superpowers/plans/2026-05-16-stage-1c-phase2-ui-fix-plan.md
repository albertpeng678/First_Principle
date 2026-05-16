# Stage 1C — Phase 2 Chat UI Fix (B5) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix B5-BUG-1（qchip caret semantics 錯 + 無 expand handler）+ B5-BUG-2（上一步 button 從 input bar 上方還原到 `.input-bar__row` 第一個子元素），purely 前端，覆蓋全 3 個 render path（normal / locked / conclusion）以避免 lock state caret regression。

**Architecture:** 純前端 DOM toggle — 新 helper `renderQchipPanelHtml`、改 `renderPhase2QchipHtml` icon、把 `backRowHtml` 移除並 inline 進 `.input-bar__row`、在 `bindCirclesPhase2` 加 toggle handler。CSS 新增 `.qchip-panel*` + 移除 `.phase-back-row`。**禁止觸碰** `.example-list` / `.hint-content` line-height（Stage 1D 範圍，避免 merge 衝突）。

**Tech Stack:** Vanilla JS + Playwright (E2E + visual regression) + `pom/page-object-model.md` skill 為主指引（多 render path 共用 component 適用 POM 模式）。

**Branch:** `main`（per memory `feedback_push_directly_to_main`）

**Spec reference:** `docs/superpowers/specs/2026-05-16-stage-1c-phase2-ui-fix-design.md`（commit `8f7eaca`，含 B5-AC6 三路徑要求）

**Playwright skill picked:** `pom/page-object-model.md` — 三 render path（normal `app.js:~1044` / locked `~1053` / conclusion `~892`）共用同一個 qchip+panel component。Component POM 把「open / close / 讀 caret 方向 / 讀 panel 可見性」收斂成 4 個 method，三 spec 重用同 POM，避免 selector drift；同時 lock state regression spec 只需切換到 locked branch URL + 用同一個 POM 跑 `expectCaretDown()`，保證 caret-right regression 必被抓。

---

## File Structure

### New files

- `tests/page-objects/circles-phase2-qchip.component.js` — qchip + panel POM (component-level)
- `tests/e2e/phase2-ui-fix.spec.js` — 3 test suites (qchip toggle / back inline / 3-site regression)
- `tests/visual/phase2-qchip.spec.js` — 6 snapshot baseline（closed/open × mobile 360 / tablet 768 / desktop 1280）
- `audit/eyeball-stage-1c-2026-05-16.md` — Director cold-Read PNG 評註

### Modified files

- `public/app.js` — `renderPhase2QchipHtml`（caret + aria-expanded）+ 新 `renderQchipPanelHtml` helper + `renderCirclesPhase2` 全 3 site 改寫 + `bindCirclesPhase2` 加 toggle handler
- `public/style.css` — 新 `.qchip-panel` / `.qchip-panel__type` / `.qchip-panel__body` / `.qchip-panel__close` + `.qchip.is-open .qchip__caret` rotate；移除 `.phase-back-row`
- `CLAUDE.md` — state board 更新

---

## Execution Order

```
Phase 1: TDD red — failing E2E + visual specs（Tasks 1–3）
Phase 2: Implementation — app.js + style.css（Tasks 4–5）
Phase 3: TDD green — re-run specs, capture baseline（Task 6）
Phase 4: Cross-vp + iOS + 2-stage review + ship（Tasks 7–9）
```

Tasks 1–3 必須 RED first（spec written + run + FAIL captured）才能進 Phase 2。Tasks 4–5 sequential（CSS 依賴 app.js 產出新 class）。

---

## Task 1: Component POM — `tests/page-objects/circles-phase2-qchip.component.js`

**Files:**
- Create: `tests/page-objects/circles-phase2-qchip.component.js`

**Why:** 三 render path（normal/locked/conclusion）共用 qchip+panel component。POM 收斂 selector + 4 action method，三 spec 重用，避免 selector drift（per playwright-skill `pom/page-object-model.md`：「component is touched by more than one test file」門檻）。

- [ ] **Step 1: Create POM 檔案**

```js
// @ts-check
const { expect } = require('@playwright/test');

class CirclesPhase2QchipComponent {
  /** @param {import('@playwright/test').Page} page */
  constructor(page) {
    this.page = page;
    this.qchipBtn   = page.locator('[data-phase2="qchip"]').first();
    this.qchipCaret = this.qchipBtn.locator('.qchip__caret');
    this.qchipPanel = page.locator('[data-phase2="qchip-panel"]').first();
    this.panelType  = this.qchipPanel.locator('.qchip-panel__type');
    this.panelBody  = this.qchipPanel.locator('.qchip-panel__body');
    this.closeBtn   = page.locator('[data-phase2="qchip-panel-close"]').first();
    // 上一步 button — 必須在 input-bar__row 的第一個子元素
    this.inputBarRow      = page.locator('.input-bar__row').first();
    this.inputBarBackBtn  = this.inputBarRow.locator('button[data-phase2="back"]').first();
    this.inputBarTextarea = this.inputBarRow.locator('textarea[data-phase2="message-input"]').first();
  }

  async open() {
    await this.qchipBtn.click();
    await expect(this.qchipPanel).toBeVisible({ timeout: 2000 });
  }

  async close() {
    await this.closeBtn.click();
    await expect(this.qchipPanel).toBeHidden({ timeout: 2000 });
  }

  async toggleViaCaret() {
    await this.qchipBtn.click();
  }

  // Returns 'down' | 'right' | 'up' | 'unknown' based on Phosphor class
  async caretDirection() {
    const cls = await this.qchipCaret.getAttribute('class') || '';
    if (/\bph-caret-down\b/.test(cls)) return 'down';
    if (/\bph-caret-right\b/.test(cls)) return 'right';
    if (/\bph-caret-up\b/.test(cls)) return 'up';
    return 'unknown';
  }

  async ariaExpanded() {
    return this.qchipBtn.getAttribute('aria-expanded');
  }

  async isPhaseBackRowAbsent() {
    return (await this.page.locator('.phase-back-row').count()) === 0;
  }

  // Returns boundingBox Y delta between back btn and textarea
  async backButtonYDelta() {
    const a = await this.inputBarBackBtn.boundingBox();
    const b = await this.inputBarTextarea.boundingBox();
    if (!a || !b) return null;
    return Math.abs(a.y - b.y);
  }
}

module.exports = { CirclesPhase2QchipComponent };
```

**Zero assertions inside POM**（per `pom/page-object-model.md` rule）— `open()` 用的 `expect(...).toBeVisible` 是 web-first 等待，不是 spec-level assertion；getter 回 raw value。

- [ ] **Step 2: Smoke parse**

```bash
node -e "const { CirclesPhase2QchipComponent } = require('./tests/page-objects/circles-phase2-qchip.component'); console.log(typeof CirclesPhase2QchipComponent);"
```
Expected: `function`.

- [ ] **Step 3: Commit**

```bash
git add tests/page-objects/circles-phase2-qchip.component.js
git commit -m "feat(stage-1c): qchip+panel component POM for 3-site reuse

Encapsulates qchip btn + panel + close btn + input-bar inline back btn.
Methods: open/close/toggleViaCaret/caretDirection/ariaExpanded/
isPhaseBackRowAbsent/backButtonYDelta. Zero assertions inside per
pom/page-object-model.md. Reused across normal/locked/conclusion
specs to prevent lock-state caret regression."
```

---

## Task 2: E2E spec (RED) — `tests/e2e/phase2-ui-fix.spec.js`

**Files:**
- Create: `tests/e2e/phase2-ui-fix.spec.js`

**Why:** TDD RED — covers B5-AC1..6（含 AC6 三 site regression）+ IL-3 red-first.

- [ ] **Step 1: Read existing test factory / fixture infra（Stage 0 + 1A 留下）**

```bash
ls tests/factories/circles-phase1.factory.js tests/fixtures/auto-cleanup.fixture.js tests/setup/auth.setup.js 2>&1
```
Expected: all 3 exist（Stage 1A ship 已建）。若缺，BLOCK + 回 director。

- [ ] **Step 2: 寫 RED spec — 3 test suites**

```js
// @ts-check
const { test, expect } = require('../fixtures/auto-cleanup.fixture');
const { CirclesPhase2QchipComponent } = require('../page-objects/circles-phase2-qchip.component');
const factory = require('../factories/circles-phase1.factory');

// Helper: drive a session from Phase 1 quality submit → gate ok → Phase 2 normal branch
async function enterPhase2Normal(page, cleanupTracker) {
  // Implementer: adapt selectors to actual app. Reuse CirclesPhase1Page if helpful.
  await page.goto('/?circles=circles_001');
  // ... fill quality + submit + wait gate ok + proceed to Phase 2 ...
  // ... track sessionId via cleanupTracker.track('circles', id) ...
}

async function enterPhase2Locked(page) {
  // Implementer: navigate to a session that already has Phase 2 score → locked branch (~app.js:1053)
  // Typical pattern: tryResume of a session with circlesScoreResult set
}

async function enterPhase2Conclusion(page) {
  // Implementer: navigate to conclusion mode（drill_step=null + circlesPhase=2.5 or similar; per spec §3.3 ref to app.js:892）
}

test.describe('B5 — qchip expand panel (normal Phase 2)', () => {
  test('default closed: panel hidden, caret-down, aria-expanded=false', async ({ page, cleanupTracker }) => {
    await enterPhase2Normal(page, cleanupTracker);
    const q = new CirclesPhase2QchipComponent(page);
    await expect(q.qchipPanel).toBeHidden();
    expect(await q.caretDirection()).toBe('down');
    expect(await q.ariaExpanded()).toBe('false');
  });

  test('click qchip → panel visible, caret rotates (still ph-caret-down + .is-open), aria=true', async ({ page, cleanupTracker }) => {
    await enterPhase2Normal(page, cleanupTracker);
    const q = new CirclesPhase2QchipComponent(page);
    await q.open();
    expect(await q.ariaExpanded()).toBe('true');
    await expect(q.qchipBtn).toHaveClass(/is-open/);
    await expect(q.panelType).toBeVisible();
    await expect(q.panelBody).toBeVisible();
  });

  test('click close → panel hidden again, aria=false', async ({ page, cleanupTracker }) => {
    await enterPhase2Normal(page, cleanupTracker);
    const q = new CirclesPhase2QchipComponent(page);
    await q.open();
    await q.close();
    expect(await q.ariaExpanded()).toBe('false');
  });

  test('toggle: second click on qchip collapses panel', async ({ page, cleanupTracker }) => {
    await enterPhase2Normal(page, cleanupTracker);
    const q = new CirclesPhase2QchipComponent(page);
    await q.toggleViaCaret();   // open
    await q.toggleViaCaret();   // close
    await expect(q.qchipPanel).toBeHidden();
  });

  test('render() after sending message resets panel to closed', async ({ page, cleanupTracker }) => {
    await enterPhase2Normal(page, cleanupTracker);
    const q = new CirclesPhase2QchipComponent(page);
    await q.open();
    // Send a message → render() re-fires → panel should re-collapse
    await q.inputBarTextarea.fill('測試訊息（≥ 5 字）');
    await page.locator('[data-phase2="send"]').click();
    await expect(q.qchipPanel).toBeHidden({ timeout: 5000 });
  });
});

test.describe('B5 — 上一步 button inline in input-bar__row', () => {
  test('上一步 button 是 .input-bar__row 第一個子元素，且無 .phase-back-row', async ({ page, cleanupTracker }) => {
    await enterPhase2Normal(page, cleanupTracker);
    const q = new CirclesPhase2QchipComponent(page);
    expect(await q.isPhaseBackRowAbsent()).toBe(true);
    // first child is the back button
    const firstChild = q.inputBarRow.locator('> *').first();
    await expect(firstChild).toHaveAttribute('data-phase2', 'back');
  });

  test('上一步 button Y 與 textarea Y 差 ≤ 4px（同行對齊）', async ({ page, cleanupTracker }) => {
    await enterPhase2Normal(page, cleanupTracker);
    const q = new CirclesPhase2QchipComponent(page);
    const delta = await q.backButtonYDelta();
    expect(delta).not.toBeNull();
    expect(delta).toBeLessThanOrEqual(4);
  });

  test('click 上一步 → 回 Phase 1', async ({ page, cleanupTracker }) => {
    await enterPhase2Normal(page, cleanupTracker);
    const q = new CirclesPhase2QchipComponent(page);
    await q.inputBarBackBtn.click();
    // Phase 1 marker visible（用 framework form 出現為驗證點，selectors 由 implementer 確認）
    await expect(page.locator('[data-view="circles"][data-phase="1"]')).toBeVisible({ timeout: 5000 });
  });
});

test.describe('B5-AC6 — qchip + panel wired in ALL 3 render paths', () => {
  test('locked branch: caret stays caret-down (NOT caret-right regression) + panel toggles', async ({ page }) => {
    await enterPhase2Locked(page);
    const q = new CirclesPhase2QchipComponent(page);
    expect(await q.caretDirection()).toBe('down');   // hard regression guard
    await q.open();
    await expect(q.qchipPanel).toBeVisible();
  });

  test('conclusion branch: qchip + panel render + toggle', async ({ page }) => {
    await enterPhase2Conclusion(page);
    const q = new CirclesPhase2QchipComponent(page);
    expect(await q.caretDirection()).toBe('down');
    await q.open();
    await expect(q.qchipPanel).toBeVisible();
  });
});
```

NOTE：`enterPhase2Locked` / `enterPhase2Conclusion` 為 implementer 補完的 helper（前者需要 fixture 種一筆已 scored session，後者需 conclusion route fixture）。**這是 RED 階段允許的 TODO**——helper 必須在 Task 2 step 4（RED run）之前補完，否則無法 verify red。

- [ ] **Step 3: Compile parse smoke**

```bash
npx playwright test --config tests/e2e/playwright.config.js --list 2>&1 | tail -20
```
Expected：spec 列出 ~10 cases（5 + 3 + 2）；無 syntax error.

- [ ] **Step 4: Run RED — capture failure（IL-3 第 1 拍）**

```bash
PORT=3000 node server.js &
SERVER_PID=$!
sleep 3
npx playwright test --config tests/e2e/playwright.config.js -g "B5" 2>&1 | tail -25
kill $SERVER_PID
```
Expected：FAIL —  panel locator `count=0`（panel 還沒實作）+ `.phase-back-row` 還在 + caret 是 `ph-caret-right`。**全部 RED 為合格**。capture log 入 commit message。

- [ ] **Step 5: Commit RED**

```bash
git add tests/e2e/phase2-ui-fix.spec.js
git commit -m "test(stage-1c): RED — phase2-ui-fix.spec.js 3 suites

- Suite 1 (5 cases): qchip toggle expand/close/aria/render-reset
- Suite 2 (3 cases): 上一步 inline + boundingBox Y delta + click → Phase 1
- Suite 3 (2 cases): B5-AC6 lock-state + conclusion 3-site regression

All RED as expected:
- panel locator count=0
- .phase-back-row still present
- caret is ph-caret-right (B5-BUG-1)
Captured failure log proves specs catch the bugs spec promises to fix."
```

---

## Task 3: Visual regression spec (RED) — `tests/visual/phase2-qchip.spec.js`

**Files:**
- Create: `tests/visual/phase2-qchip.spec.js`

**Why:** B5-AC5 — 6 snapshot（closed/open × 3 vp）pixel-diff 0.5% baseline.

- [ ] **Step 1: 寫 spec**

```js
// @ts-check
const { test, expect, devices } = require('@playwright/test');
const { CirclesPhase2QchipComponent } = require('../page-objects/circles-phase2-qchip.component');

// Reuse navigation helper from e2e/phase2-ui-fix.spec.js if exported; else inline a thin one here.
async function enterPhase2Normal(page) {
  await page.goto('/?circles=circles_001');
  // ... implementer adapts ...
}

const VIEWPORTS = [
  { name: 'mobile',  width: 360,  height: 880 },
  { name: 'tablet',  width: 768,  height: 880 },
  { name: 'desktop', width: 1280, height: 880 },
];

for (const vp of VIEWPORTS) {
  test.describe(`phase2 qchip — ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test(`closed snapshot — ${vp.name}`, async ({ page }) => {
      await enterPhase2Normal(page);
      await expect(page).toHaveScreenshot(`phase2-qchip-closed-${vp.name}.png`, {
        maxDiffPixelRatio: 0.005,
        animations: 'disabled',
        fullPage: false,
      });
    });

    test(`open snapshot — ${vp.name}`, async ({ page }) => {
      await enterPhase2Normal(page);
      const q = new CirclesPhase2QchipComponent(page);
      await q.open();
      await expect(page).toHaveScreenshot(`phase2-qchip-open-${vp.name}.png`, {
        maxDiffPixelRatio: 0.005,
        animations: 'disabled',
        fullPage: false,
      });
    });
  });
}
```

- [ ] **Step 2: Compile + list smoke**

```bash
npx playwright test --config tests/visual/playwright.config.js --list 2>&1 | grep -i "phase2-qchip" | head -10
```
Expected：列出 6 cases。

- [ ] **Step 3: Run RED — no baseline yet**

```bash
PORT=3000 node server.js &
SERVER_PID=$!
sleep 3
npx playwright test --config tests/visual/playwright.config.js -g "phase2 qchip" 2>&1 | tail -15
kill $SERVER_PID
```
Expected：FAIL with `Error: A snapshot doesn't exist` — symptomatic of RED；不要 `--update-snapshots` 直到 Phase 3 GREEN.

- [ ] **Step 4: Commit RED**

```bash
git add tests/visual/phase2-qchip.spec.js
git commit -m "test(stage-1c): RED — visual snapshot scaffold for qchip closed/open × 3 vp

6 cases (mobile 360 / tablet 768 / desktop 1280 × closed + open).
maxDiffPixelRatio 0.005 per B5-AC5. Snapshots NOT generated yet (RED).
Baseline will be captured against B5 mockup commit 418900a in Task 6 GREEN."
```

---

## Task 4: Implementation — `public/app.js`（renderPhase2QchipHtml + renderQchipPanelHtml + renderCirclesPhase2 × 3 sites + bindCirclesPhase2 handler）

**Files:**
- Modify: `public/app.js`

**Why:** Spec §3.1–§3.4 全部 FE 改動。**B5-AC6 強制 3 site**（normal ~1044 / locked ~1053 / conclusion ~892）。

- [ ] **Step 1: Grep 3 sites 確認 line numbers**

```bash
grep -n "var qchipHtml = renderPhase2QchipHtml" public/app.js
```
Expected：3 hit（~892 / ~1044 / ~1053）。若不是 3，**BLOCK** + 回 director（spec assumption broken）。

- [ ] **Step 2: 改 `renderPhase2QchipHtml`（spec §3.1）**

依 spec §3.1 AFTER section：把 `ph-caret-right` 改成 `ph-caret-down`，補 `aria-expanded="false"`。

- [ ] **Step 3: 新增 `renderQchipPanelHtml(q)`（spec §3.2）**

緊接在 `renderPhase2QchipHtml` 之後定義；body 用 `escHtml(q.problem_statement || '')`，type 用 `typeMap[q.question_type] || '設計題'`。

- [ ] **Step 4: 改 `renderCirclesPhase2` — 3 site qchipHtml 賦值（spec §3.3）**

3 個 site 全部改為：
```js
var qchipHtml = renderPhase2QchipHtml(q) + renderQchipPanelHtml(q);
```

- [ ] **Step 5: 改 normal site：移除 `backRowHtml` div + 把上一步 button 移入 `input-bar__row` 第一子元素（spec §3.3 AFTER block）**

- [ ] **Step 6: 改 locked site (~1053) 與 conclusion site (~892) — 確認 panel render + 不破壞既有 button layout**

- locked branch: panel render；caret 必須 `caret-down`；既有 `go-phase1`/`go-phase3` button layout 不動（spec §8 註明 locked back layout 獨立）
- conclusion branch: panel render；既有 conclusion 後 button 不動

- [ ] **Step 7: 加 `bindCirclesPhase2` toggle handler（spec §3.4）**

完整 paste spec §3.4 程式碼；確認 `e.stopPropagation()` 在 close handler。

- [ ] **Step 8: Manual smoke（Karpathy Verification）**

```bash
PORT=3000 node server.js &
SERVER_PID=$!
sleep 3
```
瀏覽器 http://localhost:3000 → 登入 → 開 CIRCLES → 進 Phase 2 → 點 qchip → 應展開 → 點「收合題目」應收合。**Director 親 Read 截圖 1 張存進 audit 暫存**。

```bash
kill $SERVER_PID
```

- [ ] **Step 9: Commit**

```bash
git add public/app.js
git commit -m "feat(stage-1c): qchip expand panel + 上一步 inline (3 sites)

§3.1 renderPhase2QchipHtml: ph-caret-right → ph-caret-down + aria-expanded
§3.2 renderQchipPanelHtml: new helper (type badge + body + close btn)
§3.3 renderCirclesPhase2:
  - all 3 sites (normal ~1044 / locked ~1053 / conclusion ~892) emit
    qchipHtml = renderPhase2QchipHtml(q) + renderQchipPanelHtml(q)
  - normal branch: remove backRowHtml, inline 上一步 into input-bar__row
    as first child
§3.4 bindCirclesPhase2: add toggle handler with aria-expanded sync +
  stopPropagation on close

Per spec B5-AC1..6. Backend/prompts/CSS-other-rules NOT touched (Path 2
+ Stage 1D carve-outs respected)."
```

---

## Task 5: Implementation — `public/style.css`（新 .qchip-panel*；移除 .phase-back-row；caret rotate）

**Files:**
- Modify: `public/style.css`

**Why:** Spec §3.5 完整內容。**禁止觸碰 `.example-list` line-height 或加 `.hint-content`**（Stage 1D 範圍，spec §8 已 carve-out）。

- [ ] **Step 1: Grep + read .phase-back-row 區塊**

```bash
grep -n "\.phase-back-row\|\.qchip__caret" public/style.css | head
```

- [ ] **Step 2: 移除 `.phase-back-row` 整段（spec §3.5 line 2007-2014）**

- [ ] **Step 3: 在現有 `.qchip__caret` 規則之後 append 新規則（spec §3.5 NEW block）**

完整 paste spec §3.5：
- `.qchip.is-open .qchip__caret { transform: rotate(180deg); }`
- `.qchip-panel` + `.is-open` open state
- `.qchip-panel__type` / `__body` / `__close` + hover

**禁區檢查**：grep 確認本次 commit diff 不含 `.example-list` 或 `.hint-content`：

```bash
git diff --cached public/style.css | grep -E "example-list|hint-content"
```
Expected：empty output（無 collision）.

- [ ] **Step 4: Smoke (CSS parse via browser dev server)**

```bash
PORT=3000 node server.js &
SERVER_PID=$!
sleep 2
curl -s http://localhost:3000/style.css | grep -c "qchip-panel"
kill $SERVER_PID
```
Expected：≥ 4（4 個新 class 出現至少各 1 次）.

- [ ] **Step 5: Commit**

```bash
git add public/style.css
git commit -m "feat(stage-1c): style — .qchip-panel* + caret rotate; remove .phase-back-row

Adds .qchip.is-open .qchip__caret rotate(180deg) + .qchip-panel /
.qchip-panel__type / __body / __close per spec §3.5.
Removes .phase-back-row block (line 2007-2014) — back btn now inline
in .input-bar__row (Task 4).

Stage 1D carve-out enforced: NOT touching .example-list line-height
or .hint-content (those belong to Stage 1D hint cluster)."
```

---

## Task 6: GREEN — re-run E2E + visual; accept baseline

**Files:**
- Generate: `tests/visual/phase2-qchip.spec.js-snapshots/*.png`（6 baseline PNGs）

**Why:** TDD GREEN — RED specs from Tasks 2-3 必須現在全 PASS；visual baseline 首次 capture 並 commit.

- [ ] **Step 1: Re-run E2E（expect GREEN）**

```bash
PORT=3000 node server.js &
SERVER_PID=$!
sleep 3
npx playwright test --config tests/e2e/playwright.config.js -g "B5" 2>&1 | tail -25
kill $SERVER_PID
```
Expected：10 PASS（5 + 3 + 2）跨 desktop 預設 project。若任何 FAIL，**回 Task 4/5 root-cause**（per IL-1）—— 禁止 weaken assertion 救分。

- [ ] **Step 2: Re-run E2E across e2e-desktop + e2e-mobile-chrome + e2e-mobile-safari**

```bash
PORT=3000 node server.js &
SERVER_PID=$!
sleep 3
npx playwright test --config tests/e2e/playwright.config.js \
  --project=e2e-desktop --project=e2e-mobile-chrome --project=e2e-mobile-safari \
  -g "B5" 2>&1 | tail -25
kill $SERVER_PID
```
Expected：30 PASS（10 × 3 vp）.

- [ ] **Step 3: Capture visual baseline**

```bash
PORT=3000 node server.js &
SERVER_PID=$!
sleep 3
npx playwright test --config tests/visual/playwright.config.js -g "phase2 qchip" --update-snapshots 2>&1 | tail -10
kill $SERVER_PID
```
Expected：6 snapshots 寫入 `tests/visual/phase2-qchip.spec.js-snapshots/`.

- [ ] **Step 4: Re-run visual without --update-snapshots（驗 baseline 穩定）**

```bash
PORT=3000 node server.js &
SERVER_PID=$!
sleep 3
npx playwright test --config tests/visual/playwright.config.js -g "phase2 qchip" 2>&1 | tail -10
kill $SERVER_PID
```
Expected：6 PASS（0 pixel-diff，because 剛 update）.

- [ ] **Step 5: Director cold-Read 6 PNG**

對 6 個剛產生的 PNG 逐張 Read tool 看，與 B5 mockup commit `418900a` 比對。任何 drift → 回 Task 4/5 fix．評註存進 `audit/eyeball-stage-1c-2026-05-16.md`.

- [ ] **Step 6: Commit baseline + eyeball doc**

```bash
git add tests/visual/phase2-qchip.spec.js-snapshots/ audit/eyeball-stage-1c-2026-05-16.md
git commit -m "test(stage-1c): GREEN — 6 visual baselines + director cold-Read

6 PNGs (closed/open × mobile 360 / tablet 768 / desktop 1280) captured
against implementation. Director cold-Read all 6, no drift from B5
mockup commit 418900a per audit/eyeball-stage-1c-2026-05-16.md.

E2E: 30 PASS (10 cases × 3 vp) covering qchip toggle + 上一步 inline
+ B5-AC6 3-site regression (lock state caret-down preserved)."
```

---

## Task 7: Cross-vp full regression + iOS 15-item checklist

**Files:**
- Modify: `audit/eyeball-stage-1c-2026-05-16.md`（append iOS section）

**Why:** Per memory `feedback_full_sit_uat_uiux` + `feedback_ios_review_before_ship`.

- [ ] **Step 1: jest baseline check（不回歸）**

```bash
npx jest 2>&1 | tail -10
```
Expected：214/232 不變（17 skipped + 1 pre-existing fail）.

- [ ] **Step 2: full Playwright visual suite × 8 vp**

```bash
PORT=3000 node server.js &
SERVER_PID=$!
sleep 3
npx playwright test --config tests/visual/playwright.config.js 2>&1 | tail -20
kill $SERVER_PID
```
Expected：no NEW failures vs baseline. Phase 2-chat visual snapshots（mockup 05 baseline）需特別關注是否因 qchip layout 改變導致 fail；如有，逐張 Read PNG 確認是 expected drift（panel 新增、back btn 位置改）→ `--update-snapshots` 並 commit。

- [ ] **Step 3: iOS Safari 15-item static checklist（per master spec §0.2）**

對 qchip toggle + inline back btn 跑全 15 item：
- focus state on textarea（iOS keyboard 升起時 input-bar Y 不漂）
- touch hit-target on qchip btn（≥ 44×44）
- touch hit-target on close btn
- touch hit-target on inline back btn
- sticky input-bar 在 panel 展開時不被推離
- modal/overlay 與 qchip-panel 不互相 overlap
- ...（full 15）

每 item 寫 PASS / N/A / FAIL 入 `audit/eyeball-stage-1c-2026-05-16.md`.

- [ ] **Step 4: Commit eyeball / iOS appendix**

```bash
git add audit/eyeball-stage-1c-2026-05-16.md
# 若 visual baseline 有 expected drift update:
# git add tests/visual/<...>-snapshots/
git commit -m "verify(stage-1c): iOS 15-item PASS + full visual suite 8 vp regression

15 iOS Safari static items all PASS / N/A for qchip + inline back btn.
Full visual suite 8 vp: no NEW failures; mockup 05 phase-2 baselines
updated where qchip-panel layout change is expected."
```

---

## Task 8: 2-stage review（spec compliance + code quality）

**Files:**
- No new files; dispatch subagent reviewers per memory `feedback_two_stage_review_mandatory`.

**Why:** STANDING RULE — 2-stage review on every implementer ship.

- [ ] **Step 1: Dispatch spec-compliance reviewer**

Reviewer 收：
- Spec path: `docs/superpowers/specs/2026-05-16-stage-1c-phase2-ui-fix-design.md`
- Implementation commits: 從 Task 1 起的所有 commit
- 任務：對照 B5-AC1..6 逐條 verify；特別 check AC6 三 site（grep `renderPhase2QchipHtml(q) + renderQchipPanelHtml(q)` 必 ≥ 3 hit）

Reviewer 輸出 markdown report → director Read.

- [ ] **Step 2: Dispatch code-quality reviewer（superpowers:code-review:code-review skill）**

Reviewer 跑：
- Karpathy 4 條 check
- IL-1/IL-2/IL-3 compliance check
- DRY check on `renderQchipPanelHtml` 三 site call
- Selector stability（POM `data-phase2="*"` 與 DOM 一致）
- 禁區 check：`.example-list` / `.hint-content` 完全沒被改

Reviewer 輸出 markdown report → director Read.

- [ ] **Step 3: 處理 review findings**

任何 P0/P1 → 回對應 task fix；任何 sonnet「已修」聲明，**director 必 `git diff` cross-check**（per memory `feedback_two_stage_review_mandatory`）。

- [ ] **Step 4: Commit review docs**

```bash
mkdir -p audit
# 把 reviewer output 存到 audit/spec-compliance-1c-2026-05-16.md + audit/code-quality-1c-2026-05-16.md
git add audit/spec-compliance-1c-2026-05-16.md audit/code-quality-1c-2026-05-16.md
git commit -m "verify(stage-1c): 2-stage review PASS

Stage 1 (spec compliance): AC1..6 all verified; AC6 3-site qchip
wiring confirmed via grep (3 hits on renderQchipPanelHtml call).

Stage 2 (code quality): Karpathy 4 + IL-1/2/3 all green; selector
naming aligned to data-phase2 prefix; carve-out (.example-list /
.hint-content untouched) confirmed by git diff."
```

---

## Task 9: Update CLAUDE.md + push origin/main

**Files:**
- Modify: `CLAUDE.md`

**Why:** Per memory `feedback_claude_md_live_state` — single source of truth.

- [ ] **Step 1: Update Last updated 與 bullet**

`Last updated:` → `2026-05-16（Stage 1C Phase 2 UI fix ship — qchip caret-down expand + 上一步 inline；Stage 1B / 1D 待開）`

當前狀態 bullet 加：
```
- **Stage 1C ship (2026-05-16)**: B5 Phase 2 fix — qchip caret 語意修正 + expand panel + 上一步 inline 進 .input-bar__row（3 site：normal/locked/conclusion 全 wire）；前端 only，零 BE / prompt 改。Tests: 10 E2E × 3 vp = 30 PASS + 6 visual baseline (mockup 418900a)；iOS 15-item PASS；2-stage review PASS。
```

- [ ] **Step 2: Commit + push**

```bash
git add CLAUDE.md
git commit -m "chore(stage-1c): mark Stage 1C done in CLAUDE.md

B5 cluster ship complete. Stage 1B (B3 + B4) / Stage 1D (hint cluster)
remain queued."
git push origin main
```
Expected：commit lands on origin/main.

---

## Self-Review

（Inline per writing-plans skill — director self-review, not subagent.）

### 1. Spec coverage

| Spec section | Plan task |
|---|---|
| §1 Context（B5-BUG-1 + B5-BUG-2 + 3 修正項）| Tasks 4 + 5 collectively |
| §2 Architecture（render + bind + style 分層）| Task 4（render/bind）+ Task 5（style）|
| §3.1 renderPhase2QchipHtml | Task 4 Step 2 |
| §3.2 renderQchipPanelHtml | Task 4 Step 3 |
| §3.3 renderCirclesPhase2 × 3 site | Task 4 Steps 4-6（包 normal + locked + conclusion）|
| §3.4 bindCirclesPhase2 handler | Task 4 Step 7 |
| §3.5 style.css 新規則 + 移除 | Task 5 全 |
| §4 Data Flow（純 DOM toggle）| Task 4 Step 7 含 aria sync |
| §5 Error Handling（null guard / stopPropagation / 空 problem_statement）| Task 4 Step 7（null guard in handler）+ Task 4 Step 3（空 string fallback）|
| §6.1 Visual regression（6 snapshot）| Task 3 + Task 6 Steps 3-4 |
| §6.2 E2E suites | Task 2 + Task 6 Steps 1-2 |
| §6.3 jest 基線 | Task 7 Step 1 |
| §7 AC B5-AC1..AC5 | Task 2 cases + Task 6 baseline |
| §7 AC B5-AC6（3-site）| Task 2 Suite 3 + Task 4 Step 1 grep + Task 8 spec-compliance grep |
| §8 Out of scope — `.example-list` / `.hint-content` line-height | Task 5 Step 3 禁區 check |
| §9 References | implicit throughout |

**Gap audit:** §5 提到 streaming 中 user 展 panel = allowed，現有 spec 中 E2E 沒明 cover。Task 2 Suite 1 case 5「render reset」間接覆蓋（送 message 後 render → panel reset）；如 implementer 想加 explicit streaming-vs-panel-toggle case 可自由補（non-blocking）。

### 2. Placeholder scan

掃了 TBD / TODO / "later" / "appropriate" / "handle edge cases" / "similar to" / "fill in"。

Findings:
- Task 2 `enterPhase2Normal` / `enterPhase2Locked` / `enterPhase2Conclusion` 標註「implementer 補完」— 屬 known-unknown helper（reuse Stage 1A POM 不夠涵蓋 locked + conclusion）。**接受**，但 Task 2 Step 4（RED run）必須在 helper 補完後才驗，否則 spec 不能 fail-by-design。Implementer 若卡住 → BLOCK + 回 director（不準假裝 RED）。
- Task 7 Step 3 "...（full 15）"— 引用 master spec §0.2，非 vague。
- 其餘無 placeholder．

### 3. Type / interface consistency

- POM `caretDirection()` 返 `'down'|'right'|'up'|'unknown'` —— Task 2 Suite 3 比 `'down'`，match.
- POM `ariaExpanded()` 返 string `'true'|'false'` —— spec §3.1 `aria-expanded="false"`/`"true"` —— match.
- POM `backButtonYDelta()` 返 number|null —— Task 2 Suite 2 比 `<= 4`，match.
- `data-phase2="*"` attribute 命名（qchip / qchip-panel / qchip-panel-close / back / message-input / send / min-tip）—— 全部 spec §3.2 / §3.3 / §3.4 一致．

### 4. Karpathy 4 條（per memory `feedback_karpathy_guidelines_standard`）

- **Think Before**：3 site grep（Task 4 Step 1）BLOCK 條件 forced 在實作前 verify assumption.
- **Simplicity First**：純 DOM toggle + classList，沒搬 state 入 AppState（spec 已 noted future Stage 1C followup）.
- **Surgical Changes**：style.css 禁區 check（Task 5 Step 3）`git diff` grep `.example-list|.hint-content` 必 empty。
- **Goal-Driven**：所有 task 對應 B5-AC1..AC6；Task 8 spec-compliance reviewer 逐條 verify．

### 5. Cross-spec collision check

- 1B touches `app.js:7918-7975 + 8127-8140`；1C touches `~774-1048`。**Disjoint**.
- 1D touches `.example-list` (line ~813) / `.hint-content`；1C 在 Task 5 Step 3 grep gate 明擋。**Disjoint**.
- 1A 已 ship（`submitFrameworkToGate` ~7375-7443）；1C 不碰．**Disjoint**.

No 衝突.

---

## Execution Handoff

**Plan complete and saved to** `docs/superpowers/plans/2026-05-16-stage-1c-phase2-ui-fix-plan.md`.

**Two execution options:**

**1. Subagent-Driven（recommended）** — Director dispatch fresh subagent per task with 2-stage review checkpoints between Tasks 4-5 → 6 → 7-8. Sequential (no parallel — Task 5 deps on Task 4 class names; Task 6 deps on Tasks 4-5 implementation).

**2. Inline Execution** — Execute tasks in this session via executing-plans, batch checkpoints.

**Which approach?**
