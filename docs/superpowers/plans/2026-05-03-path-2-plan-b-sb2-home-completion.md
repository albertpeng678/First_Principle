# Plan B Sub-bundle 2 — CIRCLES Home 收尾（mockup 01 完整契約） Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** 把 mockup 01（CONTRACT-LOCKED v5）裡 SB1 沒實作的 4 條 carry-forward 做完 — mode-card body desktop 長版 / drill-rail UI / recent-rail 真實 history / qcard expanded state with analysis blocks。

**Architecture:** 全部展開 `renderCirclesHome()` + `bindCirclesHome()` 既有結構，不開新 view。1:1 對映 mockup HTML BEM。CSS 幾乎已備齊（B1 commits 帶過），主要是 JS render 接 + 少量 CSS 增補。

**Tech Stack:** vanilla JS（既有 Path 2 模式），Phosphor icons，design tokens，無新依賴。

---

## Mockup line 範圍（Source of Truth — 完全比照、沒有妥協）

| 主題 | mockup 01 line | 視覺契約 |
|---|---|---|
| mode-card body desktop 長版 | **1019-1024** | `<div class="mode-card__body">7 步循序（C → I → R → C → L → E → S）。可隨時上一步 / 下一步調整。最完整的訓練。</div>` 與 `單練 C / I / R 三步任一。專注練好其中一步。該步結束即整 session 完成。` |
| drill-rail desktop（200px aside）| **1293-1306** | `<aside class="drill-rail"><div class="drill-rail__title">練習步驟</div><div class="drill-rail__list">3 × .drill-pill (.is-active for 當前 step)</div><div class="drill-rail__lock"><i ph-lock-key>...其他步驟需依序解鎖（C2/L/E/S 依賴前步輸出）</div></aside>` |
| drill-rail mobile / tablet（horizontal pill row）| **1147-1158, 1224-1230** | mockup HTML 用 `style` inline + `.drill-pill-row` wrapping (CSS line 479-482 已有) |
| recent-rail item × 3 | **1061-1092** | `.recent-item` 含 `__head`(mode-tag + `__time`) + `__title` + `__phase` |
| qcard.is-expanded（completed contract）| **1801-1836** | `__head + __meta + .qcard__expand` 含：`__section-label`「完整題目」+ `__full-statement`、`__section-label`「深入分析」+ `.qcard-analysis` 4 ana-block (1×`--trap`) + `__action-row`（取消 ghost / 確認，開始練習 primary）|
| qcard expanded action btn 文案 | line 1832-1833 | ghost「取消」+ primary「**確認，開始練習**」（**不**是「進入 Phase 1」）|

**ana-block icon 對應**（per mockup line 1814-1827）：

| ana-block 類型 | icon | head label | 資料來源 (per spec §1.8) |
|---|---|---|---|
| 商業背景 | `ph-buildings` | 商業背景 | `q.analysis.business` |
| 用戶輪廓 | `ph-users` | 用戶輪廓 | `q.analysis.users` |
| 常見誤區（**`--trap` warn 色**）| `ph-warning` | 常見誤區 | `q.analysis.traps` |
| 破題切入 | `ph-lightbulb` | 破題切入 | `q.analysis.insight` |

---

## 視覺契約 — Mockup HTML 1:1（implementer 必比照、文案 verbatim）

下面 5 段是 mockup 01 真實 HTML 抄錄（含 line 起始）。implementer 寫 render 函式 = **產出對應 DOM 與這幾段相同** — class 名、文字、icon、巢狀結構全 1:1。

### A. mode-card body desktop 長版（mockup 01 line 1018-1024 / desktop frame）

```html
<button class="mode-card is-active">
  <div class="mode-card__head"><i class="ph ph-list-checks"></i><span class="mode-card__title">完整模擬</span></div>
  <div class="mode-card__body">7 步循序（C → I → R → C → L → E → S）。可隨時上一步 / 下一步調整。最完整的訓練。</div>
</button>
<button class="mode-card">
  <div class="mode-card__head"><i class="ph ph-target"></i><span class="mode-card__title">步驟加練</span></div>
  <div class="mode-card__body">單練 C / I / R 三步任一。專注練好其中一步。該步結束即整 session 完成。</div>
</button>
```
（mobile / tablet 版的短版 body 在 line 833、837：「7 步循序練習」/「單練 C / I / R」— 兩個 body 並存、用 `@media (min-width: 1024px)` 切顯示）

### B. drill-rail desktop（mockup 01 line 1293-1304）

```html
<aside class="drill-rail">
  <div class="drill-rail__title">練習步驟</div>
  <div class="drill-rail__list">
    <button class="drill-pill is-active"><span class="step-letter">C</span>澄清情境</button>
    <button class="drill-pill"><span class="step-letter">I</span>定義用戶</button>
    <button class="drill-pill"><span class="step-letter">R</span>發掘需求</button>
  </div>
  <div class="drill-rail__lock">
    <i class="ph ph-lock-simple"></i>
    <span>C2、L、E、S 需在<strong style="color:var(--c-ink-2);">完整模擬</strong>中練習 — 因為它們依賴前步輸出</span>
  </div>
</aside>
```

### C. drill horizontal pills（mobile / tablet — mockup 01 line 1148-1160）

```html
<!-- drill horizontal pills (mobile/tablet) -->
<div style="margin-bottom:var(--s-4);">
  <div style="font-size:var(--t-cap); letter-spacing:0.08em; text-transform:uppercase; color:var(--c-ink-3); margin-bottom:var(--s-2);">練習步驟</div>
  <div class="type-tabs">
    <button class="drill-pill is-active" style="width:auto; padding:var(--s-2) var(--s-3);"><span class="step-letter">C</span>澄清</button>
    <button class="drill-pill" style="width:auto; padding:var(--s-2) var(--s-3);"><span class="step-letter">I</span>用戶</button>
    <button class="drill-pill" style="width:auto; padding:var(--s-2) var(--s-3);"><span class="step-letter">R</span>需求</button>
  </div>
  <div class="drill-rail__lock" style="margin-top:var(--s-2);">
    <i class="ph ph-lock-simple"></i>
    <span>C2 / L / E / S 需在完整模擬中練習</span>
  </div>
</div>
```
（注意：mobile pill label 短版「澄清/用戶/需求」、desktop 長版「澄清情境/定義用戶/發掘需求」）

### D. recent-rail × 3 items（mockup 01 line 1061-1092）

```html
<aside class="recent-rail">
  <div class="recent-rail__title">
    <span>最近練習</span>
    <a href="#" class="recent-rail__see-all">看全部 →</a>
  </div>
  <div class="recent-rail__list">
    <div class="recent-item">
      <div class="recent-item__head">
        <span class="mode-tag mode-tag--sim"><i class="ph ph-list-checks"></i>完整</span>
        <span class="recent-item__time">2 小時前</span>
      </div>
      <div class="recent-item__title">如何重設 Slack 的通知策略？</div>
      <div class="recent-item__phase">Phase 2 · 第 3 步 · 進行中</div>
    </div>
    <div class="recent-item">
      <div class="recent-item__head">
        <span class="mode-tag mode-tag--drill"><i class="ph ph-target"></i>個別 R</span>
        <span class="recent-item__time">昨天</span>
      </div>
      <div class="recent-item__title">Spotify Podcast 留存</div>
      <div class="recent-item__phase">Phase 3 · 76 / 100 · 已完成</div>
    </div>
    <div class="recent-item">
      <div class="recent-item__head">
        <span class="mode-tag mode-tag--sim"><i class="ph ph-list-checks"></i>完整</span>
        <span class="recent-item__time">3 天前</span>
      </div>
      <div class="recent-item__title">Discord 如何降低青少年濫用率</div>
      <div class="recent-item__phase">Phase 4 · 報告 82 / 100</div>
    </div>
  </div>
</aside>
```

### E. qcard.is-expanded — 完整題目 + 4 ana-block + action-row（mockup 01 line 1801-1836）

```html
<div class="qcard is-expanded">
  <div class="qcard__head"><span class="qcard__num">01</span><h3 class="qcard__title">Spotify · Spotify Podcast</h3></div>
  <div class="qcard__meta"><span class="mode-tag mode-tag--sim"><i class="ph ph-list-checks"></i>完整模擬</span><span class="qcard__meta-sep">·</span>Spotify<span class="qcard__meta-sep">·</span>難度 中</div>

  <div class="qcard__expand">
    <h4 class="qcard__section-label">完整題目</h4>
    <p class="qcard__full-statement">
      既有用戶聽 Podcast 的留存比聽音樂低（30 天留存 35% vs 音樂 62%）；產品經理需要找出主因並提出策略，但<strong>不能影響廣告收入或訂閱轉換率</strong>。
    </p>

    <h4 class="qcard__section-label">深入分析</h4>
    <div class="qcard-analysis">
      <div class="ana-block">
        <div class="ana-block__head"><i class="ph ph-buildings"></i>商業背景</div>
        <div class="ana-block__body">Spotify 廣告收入仰賴 ad-supported tier；Podcast 與音樂共享聽眾池但商業模型不同。Podcast 留存低 → 壓縮整體 ARPU。</div>
      </div>
      <div class="ana-block">
        <div class="ana-block__head"><i class="ph ph-users"></i>用戶輪廓</div>
        <div class="ana-block__body">免費 + 訂閱混合的通勤 / 運動 / 開車場景用戶。多數人訂閱後 7 天內未開啟單集。</div>
      </div>
      <div class="ana-block ana-block--trap">
        <div class="ana-block__head"><i class="ph ph-warning"></i>常見誤區</div>
        <div class="ana-block__body">直接套用音樂留存策略 — 但<strong>「subscribe → listen」漏斗本質不同</strong>：音樂是 mood-driven，Podcast 是 content-driven。</div>
      </div>
      <div class="ana-block">
        <div class="ana-block__head"><i class="ph ph-lightbulb"></i>破題切入</div>
        <div class="ana-block__body">先界定「留存」具體指什麼：訂閱留存、播放留存還是回流留存？</div>
      </div>
    </div>

    <div class="qcard__action-row">
      <button class="qcard__btn qcard__btn--ghost">取消</button>
      <button class="qcard__btn qcard__btn--primary">確認，開始練習</button>
    </div>
  </div>
</div>
```

> Implementer: 上面 5 段是視覺契約 source of truth。production data（題目 / 分析）從 `CIRCLES_QUESTIONS[].analysis` 動態填入；class 名 / icon / 文案 / 巢狀結構 100% 比照。任何「我覺得這樣比較好」= bundle 不過。

---

## Working directory
`/Users/albertpeng/Desktop/claude_project/first-principle-path2-b-circles` (branch `feat/path-2-circles-core`)

## CSS 既有 / 待補

- ✅ 已在 style.css（B1 CSS 5 commits）：`.drill-rail` `__title` `__list` `__lock` / `.drill-pill` `__step-letter` `.is-active` / `.drill-pill-row` (mobile) / `.qcard__expand` `__section-label` `__full-statement` `__action-row` `__btn` `__btn--primary` `__btn--ghost` / `.qcard-analysis` / `.ana-block` `__head` `__body` `--trap` / `.recent-rail` `__title` `__see-all` `__list` / `.recent-item` `__head` `__time` `__title` `__phase`
- ❌ 待補：mode-card body desktop 長版（用兩個 body 元素 + `@media (min-width: 1024px)` 切顯示）

---

## Tasks

### Task 1: 擴充 TDD spec — 紅燈先寫滿

**Files:**
- Modify: `tests/visual/circles-home.spec.js` (append after existing 10 tests)

- [ ] **Step 1: 加 8 個 RED test** describing the contract（mockup line numbers in comments）

```javascript
  // ── SB2 carry-forward tests ──────────────────────────────────

  test('drill mode renders .drill-rail with title 練習步驟 + 3 drill-pill C/I/R', async ({ page }) => {
    await page.goto('/');
    await page.locator('.mode-card').nth(1).click(); // switch to drill
    await page.waitForSelector('.drill-rail');
    await expect(page.locator('.drill-rail__title')).toHaveText('練習步驟');
    const pills = page.locator('.drill-pill');
    expect(await pills.count()).toBe(3);
    await expect(pills.nth(0).locator('.step-letter')).toHaveText('C');
    await expect(pills.nth(1).locator('.step-letter')).toHaveText('I');
    await expect(pills.nth(2).locator('.step-letter')).toHaveText('R');
    await expect(page.locator('.drill-rail__lock')).toBeVisible();
  });

  test('drill-pill click sets active and AppState.circlesDrillStep', async ({ page }) => {
    await page.goto('/');
    await page.locator('.mode-card').nth(1).click();
    await page.waitForSelector('.drill-pill');
    await page.locator('.drill-pill').nth(1).click(); // I
    await expect(page.locator('.drill-pill').nth(1)).toHaveClass(/is-active/);
    const state = await page.evaluate(() => window.AppState.circlesDrillStep);
    expect(state).toBe('I');
  });

  test('qcard click toggles is-expanded', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.qcard');
    const first = page.locator('.qcard').first();
    await expect(first).not.toHaveClass(/is-expanded/);
    await first.click();
    await expect(first).toHaveClass(/is-expanded/);
    await first.click();
    await expect(first).not.toHaveClass(/is-expanded/);
  });

  test('expanded qcard renders __full-statement + 4 ana-block (1 trap) + action-row', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.qcard');
    await page.locator('.qcard').first().click();
    await expect(page.locator('.qcard.is-expanded .qcard__full-statement')).toBeVisible();
    const blocks = page.locator('.qcard.is-expanded .ana-block');
    expect(await blocks.count()).toBe(4);
    expect(await page.locator('.qcard.is-expanded .ana-block--trap').count()).toBe(1);
    await expect(page.locator('.qcard.is-expanded .qcard__action-row')).toBeVisible();
    await expect(page.locator('.qcard.is-expanded .qcard__btn--ghost')).toContainText('取消');
    await expect(page.locator('.qcard.is-expanded .qcard__btn--primary')).toContainText('確認，開始練習');
  });

  test('expanded qcard primary btn → enters Phase 1 form (sets circlesSelectedQuestion + phase=1)', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.qcard');
    await page.locator('.qcard').first().click();
    await page.locator('.qcard__btn--primary').click();
    const state = await page.evaluate(() => ({
      view: window.AppState.view,
      phase: window.AppState.circlesPhase,
      hasQuestion: !!window.AppState.circlesSelectedQuestion,
    }));
    expect(state.view).toBe('circles');
    expect(state.phase).toBe(1);
    expect(state.hasQuestion).toBe(true);
  });

  test('recent-rail loads from history API and renders 5 .recent-item', async ({ page }) => {
    const fakeC = Array.from({ length: 4 }, (_, i) => ({
      id: 'c' + i, mode: i % 2 === 0 ? 'simulation' : 'drill', drill_step: i % 2 === 0 ? null : 'C1',
      question_json: { id: 'q'+i, company: 'Co'+i, product: 'P'+i },
      currentQuestion: { id: 'q'+i, company: 'Co'+i, product: 'P'+i },
      status: i === 0 ? 'completed' : 'active',
      step_scores: i === 0 ? { S: { totalScore: 78 } } : {},
      current_phase: 2 + (i % 3),
      updated_at: new Date(Date.now() - i * 3600000).toISOString(),
      created_at: new Date(Date.now() - i * 3600000).toISOString(),
    }));
    const fakeN = [{
      id: 'n0', question_json: { id: 'nq0', company: 'Asana', product: '工作協作' },
      currentQuestion: { id: 'nq0', company: 'Asana', product: '工作協作' },
      status: 'completed', scores_json: { totalScore: 92 },
      updated_at: new Date(Date.now() - 24 * 3600000).toISOString(),
      created_at: new Date(Date.now() - 24 * 3600000).toISOString(),
    }];
    await page.route('**/api/circles-sessions**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fakeC) }));
    await page.route('**/api/guest-circles-sessions**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fakeC) }));
    await page.route('**/api/nsm-sessions**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fakeN) }));
    await page.route('**/api/guest/nsm-sessions**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fakeN) }));
    await page.goto('/');
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.waitForSelector('.recent-rail');
    await page.waitForFunction(() => document.querySelectorAll('.recent-item').length === 5, null, { timeout: 5000 });
    const items = page.locator('.recent-item');
    expect(await items.count()).toBe(5);
    // each item must contain mode-tag + __title + __phase
    await expect(items.first().locator('.mode-tag')).toBeVisible();
    await expect(items.first().locator('.recent-item__title')).toBeVisible();
    await expect(items.first().locator('.recent-item__phase')).toBeVisible();
  });

  test('mode-card body desktop shows long-form text (≥30 chars)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/');
    await page.waitForSelector('.mode-card');
    const visibleBody = await page.locator('.mode-card').nth(0).locator('.mode-card__body:not([hidden]):not([style*="display: none"])').textContent();
    // long form per mockup line 1020 contains "C → I → R → C → L → E → S"
    expect(visibleBody).toMatch(/C\s*[→]\s*I\s*[→]\s*R/);
  });

  test('mode-card body mobile shows short-form text', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await page.goto('/');
    await page.waitForSelector('.mode-card');
    const visibleBody = await page.locator('.mode-card').nth(0).locator('.mode-card__body').first().textContent();
    expect(visibleBody.trim()).toBe('7 步循序練習');
  });
```

- [ ] **Step 2: 跑 RED 確認 8 個 fail**

```bash
PORT=4001 node server.js > /tmp/sv-b.log 2>&1 &
sleep 2
PMDRILL_BASE_URL=http://localhost:4001 npx playwright test -c tests/visual/playwright.config.js tests/visual/circles-home.spec.js --project=Desktop-1280 --reporter=list
```
Expected: original 10 pass, **8 new fail**.

- [ ] **Step 3: Commit**

```bash
git add tests/visual/circles-home.spec.js
git commit -m "test(plan-b-sb2): RED — 8 carry-forward tests for mockup 01 contract"
```

---

### Task 2: mode-card body desktop 長版（mockup line 1019-1024）

**Files:**
- Modify: `public/app.js` (renderCirclesHome → mode-selector HTML)
- Modify: `public/style.css` (add @media display swap)

- [ ] **Step 1: 改 mode-selector HTML — 兩個 body 並排 + modifier class**

在 `renderCirclesHome` 內找 mode-selector 區段，改成：

```javascript
var modeSelectorHtml = '<div class="mode-selector">'
  + '<button class="mode-card' + (mode === 'simulation' ? ' is-active' : '') + '" data-circles="mode" data-mode="simulation">'
  + '<div class="mode-card__head"><i class="ph ph-list-checks"></i><span class="mode-card__title">完整模擬</span></div>'
  + '<div class="mode-card__body mode-card__body--mobile">7 步循序練習</div>'
  + '<div class="mode-card__body mode-card__body--desktop">7 步循序（C → I → R → C → L → E → S）。可隨時上一步 / 下一步調整。最完整的訓練。</div>'
  + '</button>'
  + '<button class="mode-card' + (mode === 'drill' ? ' is-active' : '') + '" data-circles="mode" data-mode="drill">'
  + '<div class="mode-card__head"><i class="ph ph-target"></i><span class="mode-card__title">步驟加練</span></div>'
  + '<div class="mode-card__body mode-card__body--mobile">單練 C / I / R</div>'
  + '<div class="mode-card__body mode-card__body--desktop">單練 C / I / R 三步任一。專注練好其中一步。該步結束即整 session 完成。</div>'
  + '</button>'
  + '</div>';
```

- [ ] **Step 2: 加 CSS @media swap — style.css 加在 mode-card 既有規則後**

```css
/* mode-card body responsive (mockup 01 line 833 short / line 1020 long) */
.mode-card__body--desktop { display: none; }
@media (min-width: 1024px) {
  .mode-card__body--mobile { display: none; }
  .mode-card__body--desktop { display: block; }
}
```

- [ ] **Step 3: 跑兩個 mode-card body test，確認 GREEN**

```bash
PMDRILL_BASE_URL=http://localhost:4001 npx playwright test -c tests/visual/playwright.config.js tests/visual/circles-home.spec.js --project=Mobile-360 --project=Desktop-1280 -g "mode-card body" --reporter=list
```
Expected: 4/4 (mobile + desktop × 2 tests)

- [ ] **Step 4: Commit**

```bash
git add public/app.js public/style.css
git commit -m "feat(plan-b-sb2): mode-card body desktop 長版（mockup 01 line 1019-1024）"
```

---

### Task 3: drill-rail render branch（drill mode 顯）

**Files:**
- Modify: `public/app.js` (renderCirclesHome — drill mode 加 .drill-rail aside / mobile .drill-pill-row)

- [ ] **Step 1: 新增 helper `renderDrillRail()` + `renderDrillPillRow()`**

加在 `renderCirclesHome` 之前：

```javascript
function renderDrillRail() {
  // mockup 01 line 1293-1306
  var step = AppState.circlesDrillStep || 'C1';
  var pills = [
    { key: 'C1', letter: 'C', label: '澄清情境' },
    { key: 'I',  letter: 'I', label: '定義用戶' },
    { key: 'R',  letter: 'R', label: '發掘需求' },
  ];
  var pillsHtml = pills.map(function (p) {
    return '<button class="drill-pill' + (p.key === step ? ' is-active' : '') + '" data-circles="drill-pill" data-step="' + p.key + '">'
      + '<span class="step-letter">' + p.letter + '</span>' + escHtml(p.label)
      + '</button>';
  }).join('');
  return '<aside class="drill-rail">'
    + '<div class="drill-rail__title">練習步驟</div>'
    + '<div class="drill-rail__list">' + pillsHtml + '</div>'
    + '<div class="drill-rail__lock"><i class="ph ph-lock-key"></i>'
    + '<span>其他步驟需依序解鎖（C2 / L / E / S 依賴前步輸出，需走完整模擬）</span>'
    + '</div></aside>';
}

function renderDrillPillRow() {
  // mockup 01 line 1147-1158 / 1224-1230 — mobile/tablet horizontal pills inside center column
  var step = AppState.circlesDrillStep || 'C1';
  var pills = [
    { key: 'C1', letter: 'C', label: '澄清' },
    { key: 'I',  letter: 'I', label: '用戶' },
    { key: 'R',  letter: 'R', label: '需求' },
  ];
  var pillsHtml = pills.map(function (p) {
    return '<button class="drill-pill' + (p.key === step ? ' is-active' : '') + '" data-circles="drill-pill" data-step="' + p.key + '">'
      + '<span class="step-letter">' + p.letter + '</span>' + escHtml(p.label)
      + '</button>';
  }).join('');
  return '<div class="drill-pill-row">'
    + '<div class="drill-pill-row__title">個別步驟練習</div>'
    + '<div class="drill-pill-row__pills">' + pillsHtml + '</div>'
    + '</div>';
}
```

- [ ] **Step 2: 改 home grid 在 drill mode 用 `.home--desktop`（含 200px 左 aside）+ inject drill-rail**

`renderCirclesHome` 的 `homeClass` 區段改：

```javascript
// drill mode → 3-col grid (drill-rail 200px / center 1fr / recent-rail 220px)
// sim mode  → 2-col grid (center 1fr / recent-rail 220px)
var isDrill = mode === 'drill';
var homeClass = 'home home--desktop' + (isDrill ? '' : ' home--desktop-no-drill');

// mobile/tablet drill 在 center column 頂部插 drill-pill-row
var centerHtml = (isDrill ? renderDrillPillRow() : '')
  + modeSelectorHtml + searchHtml + typeTabsHtml + qListHtml + reshuffleHtml;

var homeHtml = '<div class="' + homeClass + '">'
  + (isDrill ? renderDrillRail() : '')
  + '<div>' + centerHtml + '</div>'
  + recentRailHtml
  + '</div>';
```

- [ ] **Step 3: 跑 drill-rail tests，確認 GREEN**

```bash
PMDRILL_BASE_URL=http://localhost:4001 npx playwright test -c tests/visual/playwright.config.js tests/visual/circles-home.spec.js --project=Desktop-1280 -g "drill" --reporter=list
```
Expected: 2 drill tests pass.

- [ ] **Step 4: Commit**

```bash
git add public/app.js
git commit -m "feat(plan-b-sb2): drill-rail aside + drill-pill-row（mockup 01 line 1147 / 1293）"
```

---

### Task 4: bindCirclesHome — drill-pill click handler

**Files:**
- Modify: `public/app.js` (bindCirclesHome 加 drill-pill 事件)

- [ ] **Step 1: bindCirclesHome 加：**

```javascript
document.querySelectorAll('[data-circles="drill-pill"]').forEach(function (el) {
  el.addEventListener('click', function () {
    AppState.circlesDrillStep = el.dataset.step;
    render();
  });
});
```

- [ ] **Step 2: 跑 drill-pill click test，確認 GREEN**

```bash
PMDRILL_BASE_URL=http://localhost:4001 npx playwright test -c tests/visual/playwright.config.js tests/visual/circles-home.spec.js --project=Desktop-1280 -g "drill-pill click" --reporter=list
```

- [ ] **Step 3: Commit**

```bash
git add public/app.js
git commit -m "feat(plan-b-sb2): bind drill-pill click → set circlesDrillStep"
```

---

### Task 5: qcard expanded render — `.qcard__expand` block + analysis 4 ana-block + action-row

**Files:**
- Modify: `public/app.js` (renderCirclesQCard — 加 expanded block）

- [ ] **Step 1: 改 `renderCirclesQCard(q, idx, mode)` 加 expanded 部分**

```javascript
function renderCirclesQCard(q, idx, mode) {
  var num = String(idx + 1).padStart(2, '0');
  var modeTagHtml = mode === 'drill'
    ? '<span class="mode-tag mode-tag--drill"><i class="ph ph-target"></i>步驟練</span>'
    : '<span class="mode-tag mode-tag--sim"><i class="ph ph-list-checks"></i>完整</span>';
  var diff = q.difficulty === 'high' ? '高' : q.difficulty === 'low' ? '低' : '中';
  var meta = '<div class="qcard__meta">' + modeTagHtml
    + '<span class="qcard__meta-sep">·</span>' + escHtml(q.company || '')
    + (q.product ? '<span class="qcard__meta-sep">·</span>' + escHtml(q.product) : '')
    + '<span class="qcard__meta-sep">·</span><span style="color:var(--c-ink-4);">難度 ' + diff + '</span>'
    + '</div>';

  var isExpanded = AppState.circlesExpandedQid === q.id;
  var expandHtml = '';
  if (isExpanded) {
    // mockup 01 line 1801-1836
    var an = q.analysis || {};
    expandHtml = '<div class="qcard__expand">'
      + '<h4 class="qcard__section-label">完整題目</h4>'
      + '<p class="qcard__full-statement">' + escHtml(q.problem_statement || '') + '</p>'
      + '<h4 class="qcard__section-label">深入分析</h4>'
      + '<div class="qcard-analysis">'
      + '<div class="ana-block"><div class="ana-block__head"><i class="ph ph-buildings"></i>商業背景</div>'
      + '<div class="ana-block__body">' + escHtml(an.business || '') + '</div></div>'
      + '<div class="ana-block"><div class="ana-block__head"><i class="ph ph-users"></i>用戶輪廓</div>'
      + '<div class="ana-block__body">' + escHtml(an.users || '') + '</div></div>'
      + '<div class="ana-block ana-block--trap"><div class="ana-block__head"><i class="ph ph-warning"></i>常見誤區</div>'
      + '<div class="ana-block__body">' + escHtml(an.traps || '') + '</div></div>'
      + '<div class="ana-block"><div class="ana-block__head"><i class="ph ph-lightbulb"></i>破題切入</div>'
      + '<div class="ana-block__body">' + escHtml(an.insight || '') + '</div></div>'
      + '</div>'
      + '<div class="qcard__action-row">'
      + '<button class="qcard__btn qcard__btn--ghost" data-circles="qcard-cancel">取消</button>'
      + '<button class="qcard__btn qcard__btn--primary" data-circles="qcard-confirm" data-qid="' + escHtml(q.id) + '">確認，開始練習</button>'
      + '</div></div>';
  }

  return '<div class="qcard' + (isExpanded ? ' is-expanded' : '') + '" data-circles="qcard" data-qid="' + escHtml(q.id) + '">'
    + '<div class="qcard__head"><span class="qcard__num">' + num + '</span><h3 class="qcard__title">' + escHtml((q.company || '') + (q.product ? ' · ' + q.product : '')) + '</h3></div>'
    + meta
    + '<p class="qcard__body">' + escHtml(q.problem_statement || '') + '</p>'
    + expandHtml
    + '</div>';
}
```

- [ ] **Step 2: AppState 加 `circlesExpandedQid: null`**

在 AppState block 加：
```javascript
circlesExpandedQid: null,
```

- [ ] **Step 3: 跑 expanded render tests，確認 GREEN（toggle 還沒做，先驗 render）**

設 AppState.circlesExpandedQid 然後手動 render — 暫無此 helper 跳過此 step，留 Task 6 後一起跑

- [ ] **Step 4: Commit**

```bash
git add public/app.js
git commit -m "feat(plan-b-sb2): qcard__expand block — full-statement + 4 ana-block + action-row（mockup 01 line 1801-1836）"
```

---

### Task 6: bind qcard expand toggle + cancel + confirm

**Files:**
- Modify: `public/app.js` (bindCirclesHome — 加 qcard 事件)

- [ ] **Step 1: bindCirclesHome 加：**

```javascript
// qcard click → toggle expanded
document.querySelectorAll('[data-circles="qcard"]').forEach(function (el) {
  el.addEventListener('click', function (e) {
    // ignore if click landed on a button inside the expand block
    if (e.target.closest('[data-circles="qcard-cancel"]')) return;
    if (e.target.closest('[data-circles="qcard-confirm"]')) return;
    var qid = el.dataset.qid;
    AppState.circlesExpandedQid = (AppState.circlesExpandedQid === qid) ? null : qid;
    render();
  });
});
// cancel — collapse
document.querySelectorAll('[data-circles="qcard-cancel"]').forEach(function (el) {
  el.addEventListener('click', function (e) {
    e.stopPropagation();
    AppState.circlesExpandedQid = null;
    render();
  });
});
// confirm — enter Phase 1 with selected question
document.querySelectorAll('[data-circles="qcard-confirm"]').forEach(function (el) {
  el.addEventListener('click', function (e) {
    e.stopPropagation();
    var qid = el.dataset.qid;
    var q = (window.CIRCLES_QUESTIONS || []).find(function (x) { return x.id === qid; });
    if (!q) return;
    AppState.circlesSelectedQuestion = q;
    AppState.circlesPhase = 1;
    AppState.circlesExpandedQid = null;
    render();
  });
});
```

- [ ] **Step 2: 跑 qcard 3 tests（toggle / expanded contract / primary→Phase1）確認 GREEN**

```bash
PMDRILL_BASE_URL=http://localhost:4001 npx playwright test -c tests/visual/playwright.config.js tests/visual/circles-home.spec.js --project=Desktop-1280 -g "qcard" --reporter=list
```

- [ ] **Step 3: Commit**

```bash
git add public/app.js
git commit -m "feat(plan-b-sb2): bind qcard expand/cancel/confirm — primary 確認，開始練習 → Phase 1"
```

---

### Task 7: recent-rail real history + bind item click

**Files:**
- Modify: `public/app.js` (renderCirclesHome — recent-rail 從 AppState 讀；新增 loadHistoryForRail；bindCirclesHome 加 item click)

- [ ] **Step 1: AppState 加 `circlesRecentSessions: null`**

- [ ] **Step 2: 新增 helper `loadHistoryForRail()` async**

```javascript
async function loadHistoryForRail() {
  try {
    var [circlesRes, nsmRes] = await Promise.all([
      window.apiFetch(AppState.accessToken ? '/api/circles-sessions' : '/api/guest-circles-sessions'),
      window.apiFetch(AppState.accessToken ? '/api/nsm-sessions' : '/api/guest/nsm-sessions'),
    ]);
    if (!circlesRes.ok || !nsmRes.ok) throw new Error('history_load_error');
    var circles = await circlesRes.json();
    var nsm = await nsmRes.json();
    var merged = [].concat(circles || [], (nsm || []).map(function (n) { n._isNsm = true; return n; }));
    merged.sort(function (a, b) { return new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at); });
    AppState.circlesRecentSessions = merged.slice(0, 5);
    render();
  } catch (e) {
    if (e.code === 'SESSION_EXPIRED') return;
    AppState.circlesRecentSessions = [];
    render();
  }
}
```

- [ ] **Step 3: 改 recent-rail render 從 `AppState.circlesRecentSessions` 讀**

```javascript
function renderRecentItem(item) {
  // mockup 01 line 1067-1090
  var isNsm = item._isNsm || (!item.mode && !item.drill_step);
  var modeTag = isNsm
    ? '<span class="mode-tag mode-tag--sim"><i class="ph ph-list-checks"></i>NSM</span>'
    : (item.mode === 'drill' || item.drill_step
        ? '<span class="mode-tag mode-tag--drill"><i class="ph ph-target"></i>個別 ' + escHtml(item.drill_step || '') + '</span>'
        : '<span class="mode-tag mode-tag--sim"><i class="ph ph-list-checks"></i>完整</span>');
  var ts = new Date(item.updated_at || item.created_at).getTime();
  var diff = Date.now() - ts;
  var time = diff < 3600000 ? Math.floor(diff/60000) + ' 分鐘前'
           : diff < 86400000 ? Math.floor(diff/3600000) + ' 小時前'
           : diff < 7 * 86400000 ? Math.floor(diff/86400000) + ' 天前'
           : new Date(ts).toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' });
  var q = item.currentQuestion || item.question_json || {};
  var titleStr = (q.company || '') + (q.product ? ' · ' + q.product : '') || '練習題目';
  var phaseStr = isNsm
    ? ('NSM · ' + (item.status === 'completed' ? '已完成' : '進行中'))
    : ('Phase ' + (item.current_phase || 1) + ' · ' + (item.status === 'completed' ? '已完成' : '進行中'));
  return '<div class="recent-item" data-circles="recent-item" data-id="' + escHtml(item.id) + '" data-isnsm="' + (isNsm ? '1' : '0') + '">'
    + '<div class="recent-item__head">' + modeTag + '<span class="recent-item__time">' + escHtml(time) + '</span></div>'
    + '<div class="recent-item__title">' + escHtml(titleStr) + '</div>'
    + '<div class="recent-item__phase">' + escHtml(phaseStr) + '</div>'
    + '</div>';
}

// in renderCirclesHome — recent-rail HTML
var recentItemsHtml = '';
if (AppState.circlesRecentSessions === null) {
  recentItemsHtml = '<div class="recent-rail__placeholder" style="font-size:var(--t-cap);color:var(--c-ink-3);">載入中…</div>';
} else if (AppState.circlesRecentSessions.length === 0) {
  recentItemsHtml = '<div class="recent-rail__placeholder" style="font-size:var(--t-cap);color:var(--c-ink-3);">尚無近期練習</div>';
} else {
  recentItemsHtml = AppState.circlesRecentSessions.map(renderRecentItem).join('');
}
var recentRailHtml = '<aside class="recent-rail"><div class="recent-rail__title"><span>最近練習</span><a href="#" class="recent-rail__see-all" data-circles="see-all">看全部 →</a></div>'
  + '<div class="recent-rail__list">' + recentItemsHtml + '</div></aside>';

// At top of renderCirclesHome, kick fetch if list still null
if (AppState.circlesRecentSessions === null) {
  setTimeout(loadHistoryForRail, 0);
}
```

- [ ] **Step 4: bindCirclesHome 加 recent-item click + see-all → offcanvas open**

```javascript
document.querySelectorAll('[data-circles="recent-item"]').forEach(function (el) {
  el.addEventListener('click', function () {
    var id = el.dataset.id;
    var isNsm = el.dataset.isnsm === '1';
    var list = AppState.circlesRecentSessions || [];
    var item = list.find(function (i) { return i.id === id; });
    if (!item) return;
    if (isNsm) {
      AppState.view = 'nsm';
      AppState.nsmStep = 4;       // completed → step 4 report; in-progress → step 1; minimal SB2 lands at step 4 if completed
      AppState.nsmSession = item;
    } else {
      AppState.view = 'circles';
      AppState.circlesPhase = item.current_phase || 1;
      AppState.circlesSession = item;
      AppState.circlesSelectedQuestion = item.currentQuestion || item.question_json || null;
      AppState.circlesMode = item.mode || (item.drill_step ? 'drill' : 'simulation');
      AppState.circlesDrillStep = item.drill_step || null;
    }
    render();
  });
});
document.querySelectorAll('[data-circles="see-all"]').forEach(function (el) {
  el.addEventListener('click', function (e) {
    e.preventDefault();
    AppState.offcanvasOpen = true;
    AppState.historyList = null;
    render();
    if (typeof loadHistory === 'function') loadHistory();
  });
});
```

- [ ] **Step 5: 跑 recent-rail test，確認 GREEN**

```bash
PMDRILL_BASE_URL=http://localhost:4001 npx playwright test -c tests/visual/playwright.config.js tests/visual/circles-home.spec.js --project=Desktop-1280 -g "recent-rail" --reporter=list
```

- [ ] **Step 6: Commit**

```bash
git add public/app.js
git commit -m "feat(plan-b-sb2): recent-rail loads from history API + bind item click（mockup 01 line 1061-1092）"
```

---

### Task 8: 主 agent cold review（並行 4 件）+ commit fix if any

> 這個 task **由主 agent (opus 4.7) 執行**，implementer 只跑前 7 task。

並行（同一 message 多 tool call）：
1. `npm test` — must stay 157
2. `npx playwright test ... circles-home.spec.js --project=Mobile-360 --project=iPad --project=Desktop-1280` — must 18 × 3 = 54 GREEN
3. `npx playwright test ... nsm-home.spec.js offcanvas.spec.js --project=Desktop-1280` — regression 9/9
4. 截圖矩陣 9 PNG（3 viewport × 3 state：default sim / drill mode / qcard expanded）→ Read PNG 每張 ≥ 1 句評論

iOS Safari 15-item 走過寫到 audit doc。

寫 `audit/eyeball-plan-b-sb2.md` 含 4 樣產出引用 + Read PNG 評論。

修任何 implementer 漏的 drift（直接 main agent 修，不重 dispatch）。

最後 commit：

```bash
git add audit/eyeball-plan-b-sb2.md  [+ any fix files]
git commit -m "docs(plan-b-sb2): eyeball walk + iOS checklist + cold-review fixes"
```

---

### Task 9: merge to main + push

> 主 agent 執行。

```bash
cd /Users/albertpeng/Desktop/claude_project/First_Principle
git merge --no-ff feat/path-2-circles-core -m "merge: Plan B SB2 — Home 收尾（drill-rail / recent-rail / qcard expanded / mode-card desktop body）"
npm test  # confirm green on main
git push origin main
```

---

## Acceptance Criteria（缺一 = bundle 不過）

- [ ] jest 157/157
- [ ] Playwright `circles-home.spec.js` 18 tests × 3 viewport = **54/54**（原 10 + 新 8）
- [ ] Playwright regression Desktop-1280: NSM 4/4 + offcanvas 5/5
- [ ] 9 PNG eyeball walk Read 過 + ≥ 1 句評論（3 viewport × 3 state）
- [ ] iOS Safari 15-item 靜檢走過
- [ ] mockup 01 line 1019-1024 / 1061-1092 / 1147-1158 / 1293-1306 / 1801-1836 BEM contract 100% 對齊
- [ ] `audit/eyeball-plan-b-sb2.md` 完整含 4 樣產出引用
- [ ] 不動 backend / API / DB / prompts / jest 邏輯
- [ ] commit 訊息含 mockup line 引用 + Co-Authored-By

---

## 不准做的事（Standing Rules）

- ❌ 不寫額外 mockup（一切 contract 在 mockup 01 已 LOCKED）
- ❌ 不偏離 mockup 文案（「確認，開始練習」/ 「練習步驟」/ 「商業背景」/「用戶輪廓」/「常見誤區」/「破題切入」全 verbatim）
- ❌ 不引入 emoji / 紫色 / 黃色
- ❌ qcard expanded 用 `circlesExpandedQid` (single id)，不要陣列（一次只展一張）
- ❌ recent-rail 在 mobile/tablet 不渲染（只 desktop grid 才出現，per mockup contract）
- ❌ implementer 不跑 commit + push 給 main（task 8/9 是主 agent）
