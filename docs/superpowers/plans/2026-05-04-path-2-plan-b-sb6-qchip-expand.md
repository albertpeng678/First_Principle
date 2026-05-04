# Path 2 — Plan B SB6 · qchip 題目展開（mockup 03 Section G）

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development。
>
> **嚴格鐵則（Opus director 親 enforce）：** mockup 03 Section G 是視覺契約。任何 drift = bundle 重做。
> - mockup HTML：line 2229-2390（3 viewport frames + 註解）
> - mockup CSS：line 94-172（qchip-expand / qchip-ana / qchip-ana__block / __head / __body / __block--trap / qchip-collapse-btn）— **整段 copy 不准重定義**

**Goal：** 在 CIRCLES Phase 1（C1/I/R/C2/L/S 全變體）qchip click → 展開 qchip-expand panel：完整題目 statement + 「深入分析」section label + 4 ana-block (商業背景 / 用戶輪廓 / 常見誤區 trap / 破題切入) + 「收合」ghost btn。caret 隨展開 ph-caret-down ↔ ph-caret-up。

**Architecture：**
- AppState `circlesChipExpanded` (boolean, 已存在 line 35) 控制狀態
- 新增 helper `renderQchipExpand(q)` — qchip-expand HTML
- Modify 既有 3 個 qchip 渲染點（renderCirclesPhase1 / renderCirclesPhase1Lstep / renderCirclesPhase1Sstep）：
  1. qchip 加 `is-expanded` class（when expanded）
  2. caret 改 `ph-caret-up`（when expanded）
  3. qchip 後 append `<div class="qchip-expand">...</div>`（when expanded）
- bindCirclesPhase1：
  1. `.qchip` click → toggle `circlesChipExpanded` + renderApp
  2. `.qchip-collapse-btn` click → close + renderApp（注意 stopPropagation 避免冒泡）

**Tech Stack：** vanilla JS + CSS + AppState；jest 不動；Playwright chromium+webkit。

---

## 0. Pre-flight（implementer 必跑，違反退件）

- [ ] **Read mockup HTML** — `docs/superpowers/specs/mockups/2026-05-02-frontend-rewrite/03-phase-1-form.html` line 2229-2390 全段一字不漏
- [ ] **Read mockup CSS** — 同檔 line 94-172（qchip-expand / qchip-ana / 4 變體）
- [ ] **Read production qchip 既存渲染** — `public/app.js` line 643-649（renderCirclesPhase1 內）/ 742-748（Lstep）/ 837-843（Sstep）
- [ ] **Read production existing analog** — line 1225-1234 `qcard-analysis + ana-block`（mockup 01 q-card 展開）— **參考但不複用 class**（mockup 03 G 用 qchip-* 不用 ana-* class）
- [ ] **Confirm AppState slot** — line 35 `circlesChipExpanded: false` 已在
- [ ] **Confirm question schema** — `q.analysis.business / users / traps / insight` 4 fields；`q.problem_statement` 作 statement

---

## Mockup CSS（line 94-172）— 整段 copy 進 public/style.css，不准衍生

```css
/* ── qchip-expand (Plan B SB6 — mockup 03 Section G line 94-172) ─────────── */
.qchip-expand {
  padding: var(--s-5);
  background: var(--c-card);
  border-bottom: 1px solid var(--c-rule);
}
.qchip-expand__statement {
  font-size: 16px;
  line-height: 1.8;
  color: var(--c-ink);
  max-width: 64ch;
  margin: 0 0 var(--s-6);
  padding: var(--s-3) var(--s-4);
  background: var(--c-surface);
  border: 1px solid var(--c-rule);
  border-radius: var(--r-input);
}
.qchip-expand__statement strong { font-weight: 600; color: var(--c-navy); }
.qchip-expand__section-label {
  display: flex;
  align-items: center;
  gap: var(--s-3);
  margin: 0 0 var(--s-4);
  font-size: var(--t-h3);
  font-weight: 600;
  color: var(--c-navy);
  letter-spacing: -0.005em;
}
.qchip-expand__section-label::before {
  content: '';
  width: 24px;
  height: 2px;
  background: var(--c-navy);
  flex: 0 0 auto;
}
.qchip-ana {
  display: flex;
  flex-direction: column;
  gap: var(--s-3);
}
.qchip-ana__block {
  padding: var(--s-3) var(--s-4);
  background: var(--c-card);
  border: 1px solid var(--c-rule);
  border-radius: var(--r-input);
}
.qchip-ana__head {
  display: flex;
  align-items: center;
  gap: var(--s-2);
  font-size: var(--t-body-sm);
  font-weight: 600;
  color: var(--c-ink);
  margin-bottom: var(--s-2);
}
.qchip-ana__head i { font-size: 18px; color: var(--c-navy); flex: 0 0 auto; width: 24px; text-align: center; }
.qchip-ana__body {
  font-size: var(--t-body-sm);
  line-height: 1.7;
  color: var(--c-ink-2);
  padding-left: 32px;
}
.qchip-ana__block--trap {
  background: linear-gradient(0deg, rgba(184,92,0,0.04), rgba(184,92,0,0.04)), var(--c-card);
  border-color: rgba(184,92,0,0.18);
}
.qchip-ana__block--trap .qchip-ana__head,
.qchip-ana__block--trap .qchip-ana__head i { color: var(--c-warn); }
.qchip-collapse-btn {
  margin-top: var(--s-4);
  padding: 6px 12px;
  font-size: var(--t-meta);
  color: var(--c-ink-3);
  border: 1px solid var(--c-rule);
  border-radius: var(--r-input);
  display: inline-flex;
  align-items: center;
  gap: var(--s-1);
  background: transparent;
  cursor: pointer;
}
.qchip-collapse-btn:hover { background: var(--c-bg-soft); color: var(--c-ink); }

/* qchip is-expanded — caret flip handled in JS (render ph-caret-up vs ph-caret-down) */
.qchip { cursor: pointer; }
```

**注意：mockup CSS 沒有 `.qchip { cursor: pointer }`** — 我加這條是因為「整個 collapsed qchip 任意處」是觸發點（mockup 註解 line 2388：「點整個 collapsed qchip 任意處 → toggle 展開」）。否則無 cursor 提示 = a11y 缺失。**這是唯一補進去的 CSS，其餘 line 94-172 整段 copy。**

---

## Mockup HTML 結構（line 2245-2278 mobile / 2293-2326 tablet / 2339-2372 desktop）

3 viewport 結構**幾乎一致**：

```html
<div class="qchip is-expanded">
  <span class="qchip__icon"><i class="ph ph-info"></i></span>
  <div class="qchip__main">
    <div class="qchip__company">{company · product · type · difficulty 後綴}</div>
    <div class="qchip__title">{problem_title}</div>
  </div>
  <i class="ph ph-caret-up qchip__caret"></i>  <!-- expanded = up; collapsed = down -->
</div>

<div class="qchip-expand">
  <p class="qchip-expand__statement">{problem_statement}</p>

  <h4 class="qchip-expand__section-label">深入分析</h4>
  <div class="qchip-ana">
    <div class="qchip-ana__block">
      <div class="qchip-ana__head"><i class="ph ph-buildings"></i>商業背景</div>
      <div class="qchip-ana__body">{q.analysis.business}</div>
    </div>
    <div class="qchip-ana__block">
      <div class="qchip-ana__head"><i class="ph ph-users"></i>用戶輪廓</div>
      <div class="qchip-ana__body">{q.analysis.users}</div>
    </div>
    <div class="qchip-ana__block qchip-ana__block--trap">
      <div class="qchip-ana__head"><i class="ph ph-warning"></i>常見誤區</div>
      <div class="qchip-ana__body">{q.analysis.traps}</div>
    </div>
    <div class="qchip-ana__block">
      <div class="qchip-ana__head"><i class="ph ph-lightbulb"></i>破題切入</div>
      <div class="qchip-ana__body">{q.analysis.insight}</div>
    </div>
  </div>

  <button class="qchip-collapse-btn" data-phase1="qchip-collapse">
    <i class="ph ph-caret-up" style="font-size:12px;"></i>收合
  </button>
</div>
```

**Viewport 差異（既有，不在 SB6 scope 改）：**
- mobile: qchip__company 不含「· 設計題 · 難度 中」suffix
- tablet+/desktop: qchip__company 含 suffix
- mobile: navbar 無 tabs；tablet+: 有 tabs；desktop: 加 email + sign-out

mockup statement 的 `<strong>` 是 hardcoded demo 強調（mockup 的編輯器在 statement 中加粗某段）。`q.problem_statement` 是 plain text，**production 渲染時用 escHtml 不解析 strong** — 與 mockup demo 不同處屬 state diff，cold review 不算 drift。

---

## Task 1: Helper `renderQchipExpand(q)`

**Files：** `public/app.js`（在 renderCirclesPhase1 前插入）

- [ ] **Step 1.1** 紅燈 spec：

  Create `tests/visual/phase1-qchip-expand.spec.js`：

```js
const { test, expect } = require('@playwright/test');
test.use({ baseURL: 'http://localhost:4000' });

function stub(page) {
  return Promise.all([
    page.route('**/api/circles-stats**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"completed":0,"active":0,"weeklyCompleted":0}' })),
    page.route('**/api/circles-sessions**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' })),
    page.route('**/api/guest-circles-sessions**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' })),
    page.route('**/api/nsm-sessions**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' })),
    page.route('**/api/guest/nsm-sessions**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' })),
  ]);
}

async function gotoPhase1(page) {
  await page.goto('/');
  await page.waitForSelector('.qcard');
  await page.locator('.mode-card').first().click();
  await page.locator('.qcard').first().click();
  await page.locator('.qcard__btn--primary').click();
  await page.waitForSelector('.qchip');
}

test('qchip default has caret-down + no qchip-expand', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1100 });
  await stub(page);
  await gotoPhase1(page);
  await expect(page.locator('.qchip__caret.ph-caret-down')).toBeVisible();
  await expect(page.locator('.qchip-expand')).toHaveCount(0);
  await expect(page.locator('.qchip.is-expanded')).toHaveCount(0);
});

test('qchip click → expand panel + caret-up', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1100 });
  await stub(page);
  await gotoPhase1(page);
  await page.locator('.qchip').click();
  await expect(page.locator('.qchip.is-expanded')).toBeVisible();
  await expect(page.locator('.qchip__caret.ph-caret-up')).toBeVisible();
  await expect(page.locator('.qchip-expand')).toBeVisible();
  await expect(page.locator('.qchip-expand__section-label')).toHaveText('深入分析');
  await expect(page.locator('.qchip-ana__block')).toHaveCount(4);
  await expect(page.locator('.qchip-ana__block--trap')).toHaveCount(1);
});

test('4 ana-block heads correct text + icons', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1100 });
  await stub(page);
  await gotoPhase1(page);
  await page.locator('.qchip').click();
  const heads = page.locator('.qchip-ana__head');
  await expect(heads.nth(0)).toContainText('商業背景');
  await expect(heads.nth(0).locator('i.ph-buildings')).toBeVisible();
  await expect(heads.nth(1)).toContainText('用戶輪廓');
  await expect(heads.nth(1).locator('i.ph-users')).toBeVisible();
  await expect(heads.nth(2)).toContainText('常見誤區');
  await expect(heads.nth(2).locator('i.ph-warning')).toBeVisible();
  await expect(heads.nth(3)).toContainText('破題切入');
  await expect(heads.nth(3).locator('i.ph-lightbulb')).toBeVisible();
});

test('collapse btn → panel disappears + caret-down', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1100 });
  await stub(page);
  await gotoPhase1(page);
  await page.locator('.qchip').click();
  await page.locator('.qchip-collapse-btn').click();
  await expect(page.locator('.qchip-expand')).toHaveCount(0);
  await expect(page.locator('.qchip__caret.ph-caret-down')).toBeVisible();
});

test('collapse btn click does not bubble to qchip', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1100 });
  await stub(page);
  await gotoPhase1(page);
  await page.locator('.qchip').click();
  await page.locator('.qchip-collapse-btn').click();
  // Should be collapsed (single click cycle, not double via bubble)
  await expect(page.locator('.qchip-expand')).toHaveCount(0);
});

test('qchip-expand applies to L step', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1100 });
  await stub(page);
  await gotoPhase1(page);
  await page.evaluate(() => { window.AppState.circlesSimStep = 4; window.renderApp(); });
  await page.waitForSelector('.sol-card');
  await page.locator('.qchip').click();
  await expect(page.locator('.qchip-expand')).toBeVisible();
  await expect(page.locator('.qchip-ana__block')).toHaveCount(4);
});

test('qchip-expand applies to S step', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1100 });
  await stub(page);
  await gotoPhase1(page);
  await page.evaluate(() => { window.AppState.circlesSimStep = 6; window.renderApp(); });
  await page.waitForSelector('.tracking-section');
  await page.locator('.qchip').click();
  await expect(page.locator('.qchip-expand')).toBeVisible();
  await expect(page.locator('.qchip-ana__block')).toHaveCount(4);
});
```

- [ ] **Step 1.2** 跑紅燈確認 fail：
```bash
npx playwright test tests/visual/phase1-qchip-expand.spec.js --config=tests/visual/playwright.config.js --project=Mobile-360
# Expected: 7 tests fail (qchip-expand not rendered)
```

- [ ] **Step 1.3** 寫 helper：
```js
// (在 renderCirclesPhase1 前插入)
function renderQchipExpand(q) {
  if (!q) return '';
  var an = q.analysis || {};
  var statement = q.problem_statement || '';
  return '<div class="qchip-expand">'
    + '<p class="qchip-expand__statement">' + escHtml(statement) + '</p>'
    + '<h4 class="qchip-expand__section-label">深入分析</h4>'
    + '<div class="qchip-ana">'
    +   '<div class="qchip-ana__block">'
    +     '<div class="qchip-ana__head"><i class="ph ph-buildings"></i>商業背景</div>'
    +     '<div class="qchip-ana__body">' + escHtml(an.business || '') + '</div>'
    +   '</div>'
    +   '<div class="qchip-ana__block">'
    +     '<div class="qchip-ana__head"><i class="ph ph-users"></i>用戶輪廓</div>'
    +     '<div class="qchip-ana__body">' + escHtml(an.users || '') + '</div>'
    +   '</div>'
    +   '<div class="qchip-ana__block qchip-ana__block--trap">'
    +     '<div class="qchip-ana__head"><i class="ph ph-warning"></i>常見誤區</div>'
    +     '<div class="qchip-ana__body">' + escHtml(an.traps || '') + '</div>'
    +   '</div>'
    +   '<div class="qchip-ana__block">'
    +     '<div class="qchip-ana__head"><i class="ph ph-lightbulb"></i>破題切入</div>'
    +     '<div class="qchip-ana__body">' + escHtml(an.insight || '') + '</div>'
    +   '</div>'
    + '</div>'
    + '<button class="qchip-collapse-btn" data-phase1="qchip-collapse">'
    +   '<i class="ph ph-caret-up" style="font-size:12px;"></i>收合'
    + '</button>'
    + '</div>';
}
```

---

## Task 2: 修 3 個 qchip 渲染點 — 加 `is-expanded` class、caret 反轉、append qchip-expand

**Files：** `public/app.js` line 643-649 / 742-748 / 837-843（renderCirclesPhase1 / Lstep / Sstep）

- [ ] **Step 2.1** 三處改寫 pattern：

把：
```js
var qchipHtml = '<div class="qchip">'
  + '<span class="qchip__icon"><i class="ph ph-info"></i></span>'
  + ...
  + '<i class="ph ph-caret-down qchip__caret"></i>'
  + '</div>';
```

改為：
```js
var chipExpanded = AppState.circlesChipExpanded === true;
var qchipClass = 'qchip' + (chipExpanded ? ' is-expanded' : '');
var caretIcon = chipExpanded ? 'ph-caret-up' : 'ph-caret-down';
var qchipHtml = '<div class="' + qchipClass + '" data-phase1="qchip-toggle">'
  + '<span class="qchip__icon"><i class="ph ph-info"></i></span>'
  + ...
  + '<i class="ph ' + caretIcon + ' qchip__caret"></i>'
  + '</div>'
  + (chipExpanded ? renderQchipExpand(q) : '');
```

3 處都改一致（renderCirclesPhase1 line ~643 / renderCirclesPhase1Lstep line ~742 / renderCirclesPhase1Sstep line ~837）。

---

## Task 3: bind handlers — qchip click + collapse-btn

**Files：** `public/app.js` `bindCirclesPhase1` 內

- [ ] **Step 3.1** Add toggle handler:

```js
document.querySelectorAll('[data-phase1="qchip-toggle"]').forEach(function (chip) {
  chip.addEventListener('click', function (e) {
    // 排除 collapse-btn 冒泡（雖然 collapse-btn 有 stopPropagation，雙保險）
    if (e.target.closest('[data-phase1="qchip-collapse"]')) return;
    AppState.circlesChipExpanded = !AppState.circlesChipExpanded;
    renderApp();
  });
});

document.querySelectorAll('[data-phase1="qchip-collapse"]').forEach(function (btn) {
  btn.addEventListener('click', function (e) {
    e.stopPropagation();
    AppState.circlesChipExpanded = false;
    renderApp();
  });
});
```

---

## Task 4: 加 CSS — copy mockup line 94-172 整段 + `.qchip { cursor: pointer; }`

**Files：** `public/style.css`（在 SB5 tracking-section block 之後新加）

- [ ] **Step 4.1** Append CSS exactly per mockup line 94-172（含 `.qchip-expand` / `.qchip-expand__statement` / `.qchip-expand__statement strong` / `.qchip-expand__section-label` / `.qchip-expand__section-label::before` / `.qchip-ana` / `.qchip-ana__block` / `.qchip-ana__head` / `.qchip-ana__head i` / `.qchip-ana__body` / `.qchip-ana__block--trap` / `.qchip-ana__block--trap .qchip-ana__head` / `.qchip-collapse-btn` / `.qchip-collapse-btn:hover`）

- [ ] **Step 4.2** Append `.qchip { cursor: pointer; }`（點擊 hint）

---

## Task 5: 跑綠燈

- [ ] **Step 5.1** `npm test` — jest 必為 157（不 regression）
- [ ] **Step 5.2** `npx playwright test tests/visual/phase1-qchip-expand.spec.js --project=chromium` 全綠
- [ ] **Step 5.3** `npx playwright test tests/visual/phase1-qchip-expand.spec.js --project=webkit` 全綠
- [ ] **Step 5.4** Regression check：`circles-home + phase1-form + phase1-l-step + phase1-s-step` × 3 vp 全綠
- [ ] **Step 5.5** 截 mobile-360 / iPad / Desktop-1280 各 collapsed + expanded 共 6 PNG 到 `/tmp/sb6-{vp}-{state}.png` + Read 自驗

---

## Task 6: Commit

- [ ] **Step 6.1** Commit on worktree：

```bash
git add public/app.js public/style.css tests/visual/phase1-qchip-expand.spec.js
git commit -m "$(cat <<'EOF'
feat(plan-b-sb6): qchip 題目展開 4-block 分析 (mockup 03 Section G)

- renderQchipExpand(q) — qchip-expand panel: statement / 深入分析 section label / 4 qchip-ana__block (商業背景 ph-buildings / 用戶輪廓 ph-users / 常見誤區 ph-warning trap / 破題切入 ph-lightbulb) / 收合 btn
- 3 處 qchip 渲染點 (renderCirclesPhase1 / Lstep / Sstep) 加 is-expanded class + caret 反轉 (ph-caret-down ↔ ph-caret-up) + append qchip-expand panel when expanded
- bindCirclesPhase1: data-phase1=qchip-toggle click → toggle AppState.circlesChipExpanded; data-phase1=qchip-collapse click → close (with stopPropagation 防冒泡)
- CSS line 94-172 整段 copy from mockup 03 Section G + 加 .qchip { cursor: pointer } 點擊提示

驗收：jest 157 / PW phase1-qchip-expand × 8 viewport 全綠 / 6 PNG self-Read 對 mockup line 2245-2372

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Cold Review SOP（opus director — implementer 完工後我自己跑）

- [ ] **R1** 起 dev server `node server.js` on :4000
- [ ] **R2** 自跑 Playwright 截 6 PNG（3 vp × {collapsed, expanded}）
- [ ] **R3** Read 6 PNG，line-by-line vs mockup line 2245-2372：
   - mobile collapsed：default qchip + ph-caret-down
   - mobile expanded：is-expanded class + ph-caret-up + qchip-expand panel + 4 ana-block + 收合 btn
   - tablet collapsed/expanded：同 mobile + tabs
   - desktop collapsed/expanded：同 + email/sign-out
   - 4 ana-block icons：buildings / users / warning（trap warn 色）/ lightbulb
   - statement padding + bg surface
   - section label「深入分析」+ ::before 24px navy bar
- [ ] **R4** Layer 2 mechanical pixel-diff（**必跑、缺不commit**）：寫 `tests/visual/sb6-section-pixel-diff.spec.js` 對 mockup 03 Section G vs production 跑 6 case，產出 `audit/sb6-pixel-diff-report.md`
- [ ] **R5** 寫 `audit/eyeball-plan-b-sb6.md`：3 PNG path + 評論 + Layer 1-7 checklist
- [ ] **R6** 自抽殺手鐧 3 問：
   - Q1「Read 過 PNG 沒？貼 viewport + 評論」→ 答：6 PNG paths + 各 1 句評論
   - Q2「5 條 boundingBox invariant」→ 答：qchip-expand 寬 = qchip 寬 / statement max-width 64ch / 4 ana-block 等寬 / collapse-btn 高度 ≥ 28px / section-label::before 24×2px
   - Q3「mockup ↔ production pixel diff？」→ 答：sb6 pixel-diff report 路徑 + diff%
- [ ] **R7** 4 樣產出 commit message 列數字+路徑

---

## Self-Review checklist

- [ ] L1 Mockup baseline freeze — mockup 03 Section G line 2229-2390（HTML）+ line 94-172（CSS）為視覺契約
- [ ] L2 Pixel diff — `audit/sb6-pixel-diff-report.md` 產出 + Read diff PNG 確認 red 集中在 state 而非結構
- [ ] L3 boundingBox invariant — 5 條
- [ ] L4 WebKit + Chromium — phase1-qchip-expand × 8 viewport 全綠
- [ ] L5 State matrix — collapsed / expanded / collapse-btn-clicked 3 state 各 mobile+tablet+desktop = 9 state PNG
- [ ] L6 Director eyeball walk — `audit/eyeball-plan-b-sb6.md`
- [ ] L7 User 真機抽驗 — user 接 main 後手動驗

---

## Execution

**Mode：** Subagent-Driven（sonnet 4.6 implementer × 1 → opus cold review）。
