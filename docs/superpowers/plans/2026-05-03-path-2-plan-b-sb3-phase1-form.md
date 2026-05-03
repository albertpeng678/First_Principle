# Plan B Sub-bundle 3 — Phase 1 Form 標準 4-field 結構（mockup 03 Section A） Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`).

**Goal:** Render CIRCLES Phase 1 Form 4-field standard structure（C1 / I / R / C2 通用 schema）對齊 mockup 03 Section A，drill mode + simulation mode 兩變體 + 3-viewport BEM contract 1:1。

**Scope（窄）：** Section A only — line 789-1219。defer：B（L solution-multi）/ C（S 3+4 tracking）/ D（hint overlay）/ E（locked-stale）/ F（save 細節）/ G（qchip 展開）→ 後續 SB。

**Architecture:** 在 `renderView()` dispatch 補 phase 1 路徑，新增 `renderCirclesPhase1() + bindCirclesPhase1()` + helpers。讀 `CIRCLES_STEP_CONFIG`（後寫到 app.js），含 C1/I/R/C2 4 step 各 4 field 配置。Backend 不動。

---

## Source of Truth

- **Mockup:** `docs/superpowers/specs/mockups/2026-05-02-frontend-rewrite/03-phase-1-form.html` Section A line 789-1219
- **Spec:** master spec §2.1.1（drill vs simulation）/ §2.5（rt-field BEM）/ §3.1（C1/I/R/C2 fields）
- **Question schema:** `q.field_examples[step][fieldKey]`（spec §1.8）
- **Standing rule:** 「100% 比照 mockup, 偏離就是錯誤」（user 2026-05-03）

---

## 視覺契約 — Mockup 03 Section A 嵌入（implementer 必 1:1）

### A1. simulation mode mobile（line 794-949）

```html
<!-- progress 7-step (sim 才顯) -->
<div class="progress">
  <span class="progress__step is-active"><span class="step-letter">C</span>澄清</span>
  <span class="progress__step"><span class="step-letter">I</span>用戶</span>
  <span class="progress__step"><span class="step-letter">R</span>需求</span>
  <span class="progress__step"><span class="step-letter">C</span>排序</span>
  <span class="progress__step"><span class="step-letter">L</span>方案</span>
  <span class="progress__step"><span class="step-letter">E</span>取捨</span>
  <span class="progress__step"><span class="step-letter">S</span>總結</span>
</div>

<!-- phase-head: simulation 變體 -->
<div class="phase-head">
  <span class="phase-head__num">01</span>
  <div class="phase-head__main">
    <div class="phase-head__eyebrow">Phase 1 · 寫框架</div>
    <div class="phase-head__title">C · 澄清情境</div>
  </div>
  <span class="phase-head__meta">
    <span class="save-indicator save-indicator--saved"><i class="ph ph-check"></i>已儲存</span>
  </span>
</div>

<!-- qchip persistent: mobile/tablet 簡版 -->
<div class="qchip">
  <span class="qchip__icon"><i class="ph ph-info"></i></span>
  <div class="qchip__main">
    <div class="qchip__company">Spotify · Spotify Podcast</div>
    <div class="qchip__title">如何提升 Spotify Podcast 的用戶留存率？</div>
  </div>
  <i class="ph ph-caret-down qchip__caret"></i>
</div>

<!-- phase-body 4 fields stacked -->
<div class="phase-body">
  <div class="field">
    <div class="field__label-row">
      <label class="field__label">問題範圍</label>
      <div class="field__hint-row">
        <button class="field__hint-link"><i class="ph ph-lightbulb"></i>提示</button>
        <button class="field-example-toggle" aria-expanded="false"><i class="ph ph-quotes"></i>範例答案<i class="ph ph-caret-down toggle-caret"></i></button>
      </div>
    </div>
    <div class="rt-field">
      <div class="rt-field__toolbar">
        <button class="rt-tbtn"><i class="ph ph-text-b"></i></button>
        <button class="rt-tbtn"><i class="ph ph-list-bullets"></i></button>
        <button class="rt-tbtn"><i class="ph ph-text-indent"></i></button>
      </div>
      <textarea class="rt-textarea" rows="3"></textarea>
    </div>
    <div class="field__meta">
      <span>建議 50-120 字</span>
      <span class="char-counter">0 / 120</span>
    </div>
  </div>
  <!-- field × 4: 問題範圍 / 時間範圍 / 業務影響 / 假設確認 (C1) -->
</div>

<!-- submit-bar mobile: 只 下一步 (無上一步) -->
<div class="submit-bar">
  <div class="submit-bar__left"></div>
  <div class="submit-bar__right">
    <button class="btn btn--primary">下一步<i class="ph ph-arrow-right"></i></button>
  </div>
</div>
```

### A2. simulation mode tablet（line 951-1070）

差異：
- navbar 含 `<nav class="navbar__tabs">` (CIRCLES / 北極星指標)
- phase-head__meta 多 sep + 「完整模擬 · 1 / 7 步」: `<span class="phase-head__meta-sep">·</span>完整模擬 · 1 / 7 步`
- submit-bar 含「上一步」: `<button class="btn btn--ghost"><i class="ph ph-arrow-left"></i>上一步</button>`

### A3. drill mode desktop（line 1072-1216）

差異：
- 無 progress bar
- phase-head 加 inline style `background: var(--c-navy-lt);` （drill 變體 — 改用 modifier class `.phase-head--drill`）
- phase-head__eyebrow:「Phase 1 · 個別步驟練習」
- phase-head__title:「C · 澄清情境（題目邊界 / 業務影響 / 假設）」(後綴含 fields summary)
- phase-head__meta:「已儲存 · drill 模式 · 此步驟結束即完成」
- qchip__company:「Spotify · Spotify Podcast · 設計題 · 難度 中」(加題型 + 難度)
- phase-body 加 modifier `phase-body--with-rail`（desktop 含右側 rail 200-220px）
- 右側 `<aside class="rail">` 含 __title「本步重點」+ paragraph + hr + __title「時間範圍提示」+ paragraph
- submit-bar 沒「上一步」(drill 該步結束即整 session 完成)
- field 1 rt-field__toolbar 4 button (text-b / list-bullets / text-indent / text-outdent)
- field__meta hint 加長:「建議 50-120 字 · 寫具體的功能或場景邊界」

---

## 13 條 viewport-conditional contract（implementer 必照）

| # | 元素 | mobile (line) | tablet (line) | desktop (line) |
|---|---|---|---|---|
| 1 | progress bar | sim 顯（801-809）| sim 顯（958-966）| drill 隱（1072+ 無）|
| 2 | navbar tabs nav | 無（798）| 顯（956）| 顯（1077）|
| 3 | phase-head bg variant | 預設（811）| 預設（968）| drill `--c-navy-lt`（1080）|
| 4 | phase-head__eyebrow | 「Phase 1 · 寫框架」(814) | 同 mobile | drill「Phase 1 · 個別步驟練習」(1083) |
| 5 | phase-head__title 後綴 | 無 (815) | 無 (972) | drill 含 fields summary parens (1084) |
| 6 | phase-head__meta | 只「已儲存」(818) | + 「· 完整模擬 · 1 / 7 步」(974) | + 「· drill 模式 · 此步驟結束即完成」(1086) |
| 7 | qchip__company 後綴 | 簡版（824）| 簡版（980）| drill 加「· 設計題 · 難度 中」(1092) |
| 8 | phase-body modifier | 無（830）| 無（986）| `--with-rail`（1098）|
| 9 | rail aside | 無 | 無 | 顯（1197-1205）|
| 10 | submit-bar 上一步 btn | 無（942-946）| 顯 ghost「上一步」(1063-1067) | drill 無 (1208-1213) |
| 11 | rt-field__toolbar | 3 btn (text-b / list-bullets / text-indent) | 3 btn 同 mobile | field 1 加第 4 btn `text-outdent`（drill desktop 1118）|
| 12 | rt-field active border | field 1 inline `border-color: var(--c-primary); box-shadow: var(--shadow-focus);` | 不顯 | field 1 顯（1113）|
| 13 | example-expand inline panel | field 1 顯（is-active 837 / 開展 858-873）| 不顯 | field 1 顯（1127-1142）|

---

## CIRCLES_STEP_CONFIG（4 step × 4 field）

讀 spec §3.1 + production constants（如已有）：

```js
// C1 / I / R / C2 各 4 fields. L / E / S 不在 SB3 scope.
const CIRCLES_STEP_CONFIG = {
  C1: {
    eyebrow: { sim: 'Phase 1 · 寫框架', drill: 'Phase 1 · 個別步驟練習' },
    title: 'C · 澄清情境',
    titleDrillSuffix: '（題目邊界 / 業務影響 / 假設）',
    progressLabel: '澄清', stepLetter: 'C', stepNum: '01',
    railTitle: '本步重點',
    railIntro: '確認題目邊界',
    railBody: '先把題目本身定義清楚 — 它的具體類型是什麼？涵蓋哪些場景？哪些明確排除？沒釐清這層，後面分析會在錯的邊界上展開。',
    fields: [
      { key: '問題範圍', placeholder: '聚焦免費版的廣告體驗，排除付費方案', minMax: '50-120', max: 120, rows: 3, hint: '寫具體的功能或場景邊界' },
      { key: '時間範圍', placeholder: '60 天，因為廣告活動以月為週期', minMax: '30-100', max: 100, rows: 2 },
      { key: '業務影響', placeholder: '廣告收入和免費→付費轉換率不能下降超過 3%', minMax: '40-120', max: 120, rows: 2 },
      { key: '假設確認', placeholder: '用戶廣告負感主要來自時段而非廣告本身', minMax: '30-100', max: 100, rows: 2 },
    ],
  },
  I: { /* I · 定義用戶 4 fields per spec §3.1 */ },
  R: { /* R · 發掘需求 4 fields */ },
  C2: { /* C2 · 優先排序 4 fields */ },
  // L / E / S — defer to SB4
};
```

完整 4 step config 由 implementer 從 spec §3.1 + 既有 production app.js (line 309-624 if existed) 抄出。

---

## Working directory
`/Users/albertpeng/Desktop/claude_project/first-principle-path2-b-circles`（branch `feat/path-2-circles-core`）

---

## Tasks

### Task 1: TDD 紅燈 — `tests/visual/phase1-form.spec.js`

**Files:** Create `tests/visual/phase1-form.spec.js`

- [ ] **Step 1: 寫 8 個 RED test 蓋 13 條 contract**

```javascript
const { test, expect } = require('@playwright/test');

test.describe('B SB3 Phase 1 Form — mockup 03 Section A', () => {

  async function gotoSimC1(page) {
    // Stub stats so home doesn't error
    await page.route('**/api/circles-stats**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"completed":0,"active":0,"weeklyCompleted":0}' }));
    await page.route('**/api/circles-sessions**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.route('**/api/guest-circles-sessions**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.route('**/api/nsm-sessions**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.route('**/api/guest/nsm-sessions**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.goto('/');
    await page.waitForSelector('.qcard');
    // Click first qcard → expand → primary 確認 → enter Phase 1
    await page.locator('.qcard').first().click();
    await page.locator('.qcard__btn--primary').click();
    await page.waitForSelector('.phase-head', { timeout: 5000 });
  }

  async function gotoDrillC1(page) {
    await page.route('**/api/circles-stats**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
    await page.route('**/api/circles-sessions**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.route('**/api/guest-circles-sessions**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.route('**/api/nsm-sessions**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.route('**/api/guest/nsm-sessions**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.goto('/');
    await page.waitForSelector('.mode-card');
    await page.locator('.mode-card').nth(1).click(); // drill mode
    await page.locator('.drill-pill:visible').first().click(); // C1 drill-pill (must be visible)
    await page.locator('.qcard').first().click();
    await page.locator('.qcard__btn--primary').click();
    await page.waitForSelector('.phase-head', { timeout: 5000 });
  }

  test('simulation phase-head: eyebrow「Phase 1 · 寫框架」+ title「C · 澄清情境」', async ({ page }) => {
    await gotoSimC1(page);
    await expect(page.locator('.phase-head__eyebrow')).toHaveText('Phase 1 · 寫框架');
    await expect(page.locator('.phase-head__title')).toHaveText('C · 澄清情境');
  });

  test('simulation shows progress bar with 7 step pills (C/I/R/C/L/E/S)', async ({ page }) => {
    await gotoSimC1(page);
    await expect(page.locator('.progress')).toBeVisible();
    const pills = page.locator('.progress__step');
    await expect(pills).toHaveCount(7);
    await expect(pills.nth(0)).toHaveClass(/is-active/);
    const letters = await page.locator('.progress__step .step-letter').allTextContents();
    expect(letters).toEqual(['C', 'I', 'R', 'C', 'L', 'E', 'S']);
  });

  test('drill phase-head: eyebrow「Phase 1 · 個別步驟練習」+ title 含 fields summary', async ({ page }) => {
    await gotoDrillC1(page);
    await expect(page.locator('.phase-head__eyebrow')).toHaveText('Phase 1 · 個別步驟練習');
    await expect(page.locator('.phase-head__title')).toContainText('C · 澄清情境');
    await expect(page.locator('.phase-head__title')).toContainText('題目邊界');
    await expect(page.locator('.phase-head')).toHaveClass(/phase-head--drill/);
  });

  test('drill mode hides progress bar', async ({ page }) => {
    await gotoDrillC1(page);
    await expect(page.locator('.progress')).toHaveCount(0);
  });

  test('renders 4 fields with 問題範圍 / 時間範圍 / 業務影響 / 假設確認 labels (C1)', async ({ page }) => {
    await gotoSimC1(page);
    const labels = await page.locator('.field__label').allTextContents();
    expect(labels).toEqual(['問題範圍', '時間範圍', '業務影響', '假設確認']);
  });

  test('each field has rt-field with toolbar + textarea + meta', async ({ page }) => {
    await gotoSimC1(page);
    const fields = page.locator('.field');
    expect(await fields.count()).toBe(4);
    for (let i = 0; i < 4; i++) {
      await expect(fields.nth(i).locator('.rt-field__toolbar')).toBeVisible();
      await expect(fields.nth(i).locator('.rt-textarea')).toBeVisible();
    }
    // field 1 has char-counter
    await expect(fields.nth(0).locator('.char-counter')).toBeVisible();
  });

  test('submit-bar mobile-only: 下一步 primary; tablet adds 上一步 ghost; drill: only 下一步', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await gotoSimC1(page);
    await expect(page.locator('.submit-bar__right .btn--primary')).toContainText('下一步');
    expect(await page.locator('.submit-bar__left .btn--ghost').count()).toBe(0);
    // tablet
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(200);
    await expect(page.locator('.submit-bar__left .btn--ghost')).toContainText('上一步');
    // drill (mode separate path)
    await page.setViewportSize({ width: 360, height: 780 });
    await gotoDrillC1(page);
    expect(await page.locator('.submit-bar__left .btn--ghost').count()).toBe(0);
  });

  test('desktop drill phase-body has --with-rail + rail aside「本步重點」', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await gotoDrillC1(page);
    await expect(page.locator('.phase-body--with-rail')).toBeVisible();
    await expect(page.locator('.rail')).toBeVisible();
    await expect(page.locator('.rail__title').first()).toHaveText('本步重點');
  });
});
```

- [ ] **Step 2: 跑 RED 確認 8 fail**

```bash
PORT=4001 node server.js > /tmp/sv-b.log 2>&1 &
sleep 2
PMDRILL_BASE_URL=http://localhost:4001 npx playwright test -c tests/visual/playwright.config.js tests/visual/phase1-form.spec.js --project=Desktop-1280 --reporter=list
```
Expected: 8 RED.

- [ ] **Step 3: Commit**
```bash
git add tests/visual/phase1-form.spec.js
git commit -m "test(plan-b-sb3): RED — 8 phase-1 form contract tests (mockup 03 Section A)"
```

---

### Task 2: CIRCLES_STEP_CONFIG + helpers

**Files:** Modify `public/app.js`

- [ ] **Step 1: 加 CIRCLES_STEP_CONFIG（C1/I/R/C2 4 step × 4 field 完整）**

C1 fields per spec §3.1: 問題範圍 / 時間範圍 / 業務影響 / 假設確認
I fields: 目標用戶分群 / 選定焦點對象 / 用戶動機假設(JTBD) / 排除對象
R fields: 功能性 / 情感性 / 社交性 / 核心痛點
C2 fields: 取捨標準 / 最優先 / 暫緩 / 排序理由

每 step 完整 config 含：eyebrow（sim/drill 兩版）/ title / titleDrillSuffix / progressLabel / stepLetter / stepNum / railTitle / railIntro / railBody / fields[]（key / placeholder / minMax / max / rows / hint）

完整資料從 mockup 03 Section A line 814（C1 sim eyebrow）/ 1083（C1 drill eyebrow）等位置 + spec §3.1 抄出。implementer 必對齊 mockup 文案。

- [ ] **Step 2: Commit**
```bash
git commit -m "feat(plan-b-sb3): CIRCLES_STEP_CONFIG — C1/I/R/C2 step + field schemas"
```

---

### Task 3: renderCirclesPhase1 + 子函式

**Files:** Modify `public/app.js`

- [ ] **Step 1: 改 `renderView()` 加 phase-1 路徑**

```js
function renderView() {
  const v = AppState.view;
  if (v === 'circles') {
    if (AppState.circlesPhase === 1 && AppState.circlesSelectedQuestion) {
      return renderCirclesPhase1();
    }
    if (AppState.circlesPhase === 1 && !AppState.circlesSession && !AppState.circlesSelectedQuestion) {
      return renderCirclesHome();
    }
    return renderCirclesStub();
  }
  // ...rest
}
```

- [ ] **Step 2: 加 `renderCirclesPhase1()` + `renderProgressBar()` + `renderPhase1Field(cfg, idx)` + `renderRail(cfg)`**

每 helper 對應 mockup line 範圍。文案 / icon / class 1:1。

drill 模式：
- 無 progress bar
- phase-head 加 modifier class `.phase-head--drill`（CSS 套 `background: var(--c-navy-lt)`）
- phase-head__eyebrow 用 step.eyebrow.drill
- phase-head__title 加 `(${step.titleDrillSuffix})`
- phase-head__meta 加 `· drill 模式 · 此步驟結束即完成`
- qchip__company 加 `· 設計題 · 難度 中`（per q.question_type / q.difficulty）
- submit-bar 不顯「上一步」

simulation 模式：
- 顯 progress bar
- phase-head 預設
- phase-head__meta 加 `· 完整模擬 · ${currentStep} / 7 步`
- qchip__company 簡版
- submit-bar tablet+ 顯「上一步」（mobile 不顯）

- [ ] **Step 3: 跑 PW 確認 GREEN**

- [ ] **Step 4: Commit**

---

### Task 4: bindCirclesPhase1 — submit / 上一步 / 範例 toggle / textarea input

**Files:** Modify `public/app.js`

- [ ] **Step 1: 加 bind 函式**
- 提示按鈕 click：本 SB 暫無 overlay，inline alert/console 即可（SB5 真實作）
- 範例答案 toggle：toggle aria-expanded + 下方 example-expand 顯隱
- textarea input：debounce 200ms 更新 char-counter + AppState.circlesFrameworkDraft
- submit「下一步」：sim → 進下一 step / drill → 進 phase 1.5 gate
- submit「上一步」：sim 回前一 step / drill 不顯
- rt-tbtn buttons：execCommand bold/insertUnorderedList/indent/outdent

- [ ] **Step 2: 跑 PW + jest verify**

- [ ] **Step 3: Commit**

---

### Task 5: CSS — phase-1 form BEM + viewport rules

**Files:** Modify `public/style.css`

加 LOCKED block（mockup 03 Section A copy verbatim）：
- `.progress` `.progress__step.is-active` `.step-letter`
- `.phase-head` `.phase-head--drill` `.phase-head__num` `.phase-head__main` `.phase-head__eyebrow` `.phase-head__title` `.phase-head__meta` `.save-indicator.--saved`
- `.qchip` `__icon` `__main` `__company` `__title` `__caret`
- `.phase-body` `.phase-body--with-rail`（desktop grid 1fr 220px）
- `.field` `__label-row` `__label` `__hint-row` `__hint-link` `__meta`
- `.field-example-toggle` (含 `.is-active` + `.toggle-caret` rotate)
- `.rt-field` `__toolbar` `.rt-tbtn` `.rt-textarea`
- `.example-expand` `__head` `__title` `__close` `.example-list` `.example-sub`
- `.char-counter`
- `.rail` `__title`

@media swap：`.phase-body--with-rail` 只 ≥1024px 啟用 grid；submit-bar mobile 下一步 only / tablet+ 加上一步（用 `.submit-bar__left:empty { display: none }` mobile，或 ghost 在 drill 模式條件 render）。

- [ ] Commit

---

### Task 6: 主 agent (opus) cold review — line-by-line 比對 mockup 03 Section A

**By main agent only.** 並行：
1. jest（必 157）
2. PW phase1-form × 3 viewport 全綠（8 tests × 3 = 24+）
3. 既有 spec regression 不破（circles-home 54 / nsm-home 4 / offcanvas 5）
4. 截 6 PNG（3 viewport × 2 mode {sim, drill}）
5. **逐 line 比對 mockup 03 Section A line 794-1216 全文** vs production app.js render output
6. 列所有 drift（class 名 / 文案 / icon / 巢狀差異）
7. 若有 drift 立即修
8. iOS 15-item walk
9. 寫 `audit/eyeball-plan-b-sb3.md` 含 4 樣產出 + lessons

不准 self-claim done — drift 全清才能進 task 7。

---

### Task 7: 主 agent merge + push + 三份文件 update

```bash
cd /Users/albertpeng/Desktop/claude_project/First_Principle
# update CLAUDE.md / PATH-2-HANDOFF.md / master-spec.md Last updated + B SB3 entry
git commit -am "docs(state): Plan B SB3 完成"
git merge --no-ff feat/path-2-circles-core -m "merge: Plan B SB3 — Phase 1 Form 4-field standard"
npm test  # confirm 157
git push origin main
```

---

## Acceptance（缺一 = bundle 不過）

- [ ] jest 157/157
- [ ] Playwright phase1-form.spec.js 8 tests × 3 viewport = 24/24
- [ ] regression circles-home 54/54 + nsm-home 4/4 + offcanvas 5/5
- [ ] 6 PNG eyeball walk Read（3 viewport × 2 mode）對齊 mockup 03 Section A
- [ ] **逐 line 比對 mockup 03 Section A line 794-1216 vs production**，drift 0
- [ ] iOS 15-item 靜檢
- [ ] `audit/eyeball-plan-b-sb3.md` 含 4 樣產出 + lessons learned
- [ ] 三份文件即時更新

## 不准做的事

- ❌ 處理 hint overlay modal（SB5）
- ❌ 處理 L/E/S step（SB4）
- ❌ 處理 locked/stale（SB6）
- ❌ 處理 qchip 展開（SB5）
- ❌ 動 backend / API / DB / prompts / jest
- ❌ self-claim done 沒 line-by-line 比對 mockup
