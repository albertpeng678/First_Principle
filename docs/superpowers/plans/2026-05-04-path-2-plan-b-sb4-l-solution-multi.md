# Path 2 — Plan B SB4 · L 步 solution-multi 實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development。所有步驟用 checkbox `- [ ]` 追蹤。
>
> **嚴格鐵則：** 此 plan 視 mockup 03 Section B（line 1230-1467）為視覺契約。implementer 必先打開該段 line range 對著做；任何 drift（class 名 / 文案 / icon / margin / padding / placeholder）= bundle 重做。

**Goal：** 把 CIRCLES Phase 1 L 步 (sim 模式 5/7) 實作起來——sol-card 多方案結構 (2-3 張)、rt-field 核心機制、sol-add 加方案三、sol-card__remove 移除方案三。

**Mockup：** `docs/superpowers/specs/mockups/2026-05-02-frontend-rewrite/03-phase-1-form.html` Section B (line 1230-1467)

**Architecture：** 在 `renderCirclesPhase1()` 增加 L step branch；新加 `renderCirclesLSolCards()` 與 `bindLStepHandlers()`；新加 AppState slot `circlesPhase1Solutions`。CSS 新加 `.sol-card / .sol-card__num / .sol-card__name-row / .sol-card__name-input / .sol-card__optional / .sol-card__remove / .sol-add`；既存 LOCKED class（navbar/progress/phase-head/qchip/rt-field/rt-tbtn/rt-textarea/field/field__hint-row/field__hint-link/field-example-toggle/submit-bar/btn）整段 copy 不准 redefine。

**Tech Stack：** vanilla JS + CSS Grid + AppState；jest 不動；Playwright chromium+webkit。

---

## 0. Pre-flight（implementer 開工必跑）

- [ ] **Read mockup Section B** — `docs/superpowers/specs/mockups/2026-05-02-frontend-rewrite/03-phase-1-form.html` line 1230-1467 全段一字不漏
- [ ] **Read current Phase 1 render** — `public/app.js` line 260-557（CIRCLES_STEP_CONFIG / renderCirclesPhase1 / renderProgressBar / renderPhase1Field / renderRail）
- [ ] **Confirm LOCKED class set** — 不准重定義：navbar / progress / progress__step / step-letter / phase-head / phase-head--drill / phase-head__num / phase-head__main / phase-head__eyebrow / phase-head__title / phase-head__meta / save-indicator / qchip / qchip__icon / qchip__main / qchip__company / qchip__title / qchip__caret / phase-body / phase-body--with-rail / field / field__label-row / field__label / field__hint-row / field__hint-link / field-example-toggle / toggle-caret / rt-field / rt-field__toolbar / rt-tbtn / rt-textarea / submit-bar / submit-bar__left / submit-bar__right / btn / btn--primary / btn--ghost / rail / rail__title

---

## Mockup 03 Section B 完整 HTML（implementer 直接對照）

### Mobile · L step (line 1234-1307)

```html
<div class="navbar">
  <button class="navbar__icon-btn"><i class="ph ph-list"></i></button>
  <div class="navbar__brand">
    <span class="navbar__brand-icon"><i class="ph ph-circles-three"></i></span>
    <span class="navbar__brand-name">PM Drill</span>
  </div>
  <div class="navbar__actions">
    <button class="navbar__icon-btn" aria-label="回首頁"><i class="ph ph-house"></i></button>
  </div>
</div>
<div class="progress">
  <span class="progress__step is-done"><span class="step-letter">C</span>澄清</span>
  <span class="progress__step is-done"><span class="step-letter">I</span>用戶</span>
  <span class="progress__step is-done"><span class="step-letter">R</span>需求</span>
  <span class="progress__step is-done"><span class="step-letter">C</span>排序</span>
  <span class="progress__step is-active"><span class="step-letter">L</span>方案</span>
  <span class="progress__step"><span class="step-letter">E</span>取捨</span>
  <span class="progress__step"><span class="step-letter">S</span>總結</span>
</div>
<div class="phase-head">
  <span class="phase-head__num">05</span>
  <div class="phase-head__main">
    <div class="phase-head__eyebrow">Phase 1 · 寫框架</div>
    <div class="phase-head__title">L · 提出方案</div>
  </div>
  <span class="phase-head__meta">
    <span class="save-indicator save-indicator--saved"><i class="ph ph-check"></i>已儲存</span>
  </span>
</div>
<div class="qchip">
  <span class="qchip__icon"><i class="ph ph-info"></i></span>
  <div class="qchip__main">
    <div class="qchip__company">Spotify · Spotify Podcast</div>
    <div class="qchip__title">如何提升 Spotify Podcast 的用戶留存率？</div>
  </div>
  <i class="ph ph-caret-down qchip__caret"></i>
</div>
<div class="phase-body">
  <div class="sol-card">
    <div class="sol-card__num">方案一</div>
    <div class="sol-card__name-row">
      <input class="sol-card__name-input" type="text" value="主動廣告排程" placeholder="方案名稱（10 字內）">
    </div>
    <div class="field" style="margin-bottom:0;">
      <div class="field__label-row">
        <label class="field__label">核心機制</label>
        <div class="field__hint-row">
          <button class="field__hint-link"><i class="ph ph-lightbulb"></i>提示</button>
          <button class="field-example-toggle" aria-expanded="false"><i class="ph ph-quotes"></i>範例答案<i class="ph ph-caret-down toggle-caret"></i></button>
        </div>
      </div>
      <div class="rt-field">
        <div class="rt-field__toolbar">
          <button class="rt-tbtn"><i class="ph ph-text-b"></i></button>
          <button class="rt-tbtn"><i class="ph ph-list-bullets"></i></button>
        </div>
        <textarea class="rt-textarea" rows="3">讓 ML 偵測「情緒高潮段落」自動避開插廣告，改在過場處插。</textarea>
      </div>
    </div>
  </div>
  <div class="sol-card">
    <div class="sol-card__num">方案二</div>
    <div class="sol-card__name-row">
      <input class="sol-card__name-input" type="text" placeholder="方案名稱（10 字內）">
    </div>
    <div class="field" style="margin-bottom:0;">
      <div class="field__label-row">
        <label class="field__label">核心機制</label>
        <div class="field__hint-row">
          <button class="field__hint-link"><i class="ph ph-lightbulb"></i>提示</button>
          <button class="field-example-toggle" aria-expanded="false"><i class="ph ph-quotes"></i>範例答案<i class="ph ph-caret-down toggle-caret"></i></button>
        </div>
      </div>
      <div class="rt-field">
        <div class="rt-field__toolbar">
          <button class="rt-tbtn"><i class="ph ph-text-b"></i></button>
          <button class="rt-tbtn"><i class="ph ph-list-bullets"></i></button>
        </div>
        <textarea class="rt-textarea" rows="3" placeholder="與方案一在「方向」上有本質差異 — 不是更多，而是不同"></textarea>
      </div>
    </div>
  </div>
  <button class="sol-add"><i class="ph ph-plus"></i>加方案三（選擇性）</button>
</div>
<div class="submit-bar">
  <div class="submit-bar__left"></div>
  <div class="submit-bar__right">
    <button class="btn btn--primary">下一步<i class="ph ph-arrow-right"></i></button>
  </div>
</div>
```

**Mobile 注意：**
- 無 navbar tabs（line 1237 只有 list+brand+home）
- phase-head__meta 只有 save-indicator（無「完整模擬 5/7 步」）
- 無 sol-card 第三張（sol-add 按鈕在底部）
- submit-bar 左側 empty（無「上一步」ghost btn）
- field 有 `style="margin-bottom:0;"` inline

---

### Tablet · L step (line 1309-1378)

差異點 vs mobile：
- navbar 含 `<nav class="navbar__tabs"><span class="navbar__tab is-active">CIRCLES</span><span class="navbar__tab">北極星指標</span></nav>`
- phase-head__meta 多 `<span class="phase-head__meta-sep">·</span>完整模擬 · 5 / 7 步`
- sol-card 已展示**三張**（sol-card 三 已加；sol-card num 帶 `<span class="sol-card__optional">（選擇性）</span>`；__name-row 有 `<button class="sol-card__remove" aria-label="移除方案三"><i class="ph ph-x"></i></button>`）
- 方案二 name input 已填值「廣告獎勵聽完」
- submit-bar 左側 ghost「上一步」btn

**Tablet sol-card 三 結構（line 1354-1370）：**
```html
<div class="sol-card">
  <div class="sol-card__num">方案三 <span class="sol-card__optional">（選擇性）</span></div>
  <div class="sol-card__name-row">
    <input class="sol-card__name-input" type="text" placeholder="方案名稱（10 字內）">
    <button class="sol-card__remove" aria-label="移除方案三"><i class="ph ph-x"></i></button>
  </div>
  <div class="field" style="margin-bottom:0;">
    <div class="field__hint-row">
      <button class="field__hint-link"><i class="ph ph-lightbulb"></i>提示</button>
      <button class="field-example-toggle" aria-expanded="false"><i class="ph ph-quotes"></i>範例答案<i class="ph ph-caret-down toggle-caret"></i></button>
    </div>
    <div class="rt-field">
      <div class="rt-field__toolbar"><button class="rt-tbtn"><i class="ph ph-text-b"></i></button><button class="rt-tbtn"><i class="ph ph-list-bullets"></i></button></div>
      <textarea class="rt-textarea" rows="3" placeholder="加分項 — 第三個真正不同的思路（更激進、更長線）"></textarea>
    </div>
  </div>
</div>
```

**注意：tablet+ field 無 field__label-row（無 label「核心機制」）只有 field__hint-row** — vs mobile 有 label。Implementer 必處理：
- mobile: render `field__label-row` (含 label「核心機制」)
- tablet+: 不 render label-row 只 render hint-row 直接

---

### Desktop · L step (line 1380-1460)

差異點 vs tablet：
- navbar 多 `<div class="navbar__actions"><span class="navbar__email">albert.peng@example.com</span><button class="navbar__icon-btn"><i class="ph ph-sign-out"></i></button><button class="navbar__icon-btn" aria-label="回首頁"><i class="ph ph-house"></i></button></div>` — 已登入態 email + sign-out + home 三件
- qchip__company 多後綴：`Spotify · Spotify Podcast · 設計題 · 難度 中`
- phase-head__title 多後綴：`L · 提出方案（2-3 個方案）`
- phase-body 加 class `phase-body--with-rail`，內含 sol-card list 包在 `<div>` + `<aside class="rail">` 並排
- sol-card 三 input placeholder 改為 `方案名稱（10 字內）— 加分項，更激進或長線`
- sol-card 三 textarea placeholder 改為 `第三個真正不同的思路 — 例如：把廣告變成內容（品牌 podcast）；或從供給端切（廣告主競價）`

**Desktop rail (line 1445-1452)：**
```html
<aside class="rail">
  <div class="rail__title">L 步重點</div>
  <p style="margin-bottom: var(--s-3); color: var(--c-ink); font-weight: 500;">提出 2-3 個有方向差異的方案</p>
  <p style="line-height: 1.7;">方案二要和方案一在「方向」上有本質差異 — 不是更多，而是不同。例如方案一是系統主動，方案二可以是用戶主動；或方案一是短期戰術，方案二是長期重設計。</p>
  <hr style="border: 0; border-top: 1px solid var(--c-rule); margin: var(--s-4) 0;">
  <div class="rail__title">方案三是加分項</div>
  <p style="line-height: 1.7;">湊數寧可不填 — 說明「前兩個已涵蓋主要可能性」也是有效回答。</p>
</aside>
```

---

### Mockup 註解 (line 1463-1467)

> **B · L 步 solution-multi 結構：**每方案是獨立 sol-card（white bg + 1px rule + radius）— 套 §0.7.1 card-based block pattern。
> **結構：**每張卡含 sol-card num（navy 標籤 + 24px bar）+ name input（10 字內 placeholder）+ rt-field（核心機制）；方案三 optional → 顯示「（選擇性）」+ 移除按鈕；底部 dashed「加方案三」按鈕（如果還沒加）。

---

## Task 1: AppState.circlesPhase1Solutions schema

**Files：**
- Modify: `public/app.js` AppState 初始化區塊

- [ ] **Step 1.1**: 在 AppState 加 `circlesPhase1Solutions`，初始 `[{name:'',mechanism:''},{name:'',mechanism:''}]`（兩張預設，不含第三）。reset on view change to circles home。

```js
// (在 AppState 初始化處新增)
circlesPhase1Solutions: [
  { name: '', mechanism: '' },
  { name: '', mechanism: '' },
],
```

---

## Task 2: 紅燈 spec — sol-card 結構（TDD red）

**Files：**
- Create: `tests/visual/phase1-l-step.spec.js`

- [ ] **Step 2.1：紅燈 spec — 不 render L step 時應失敗**

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

async function gotoLStep(page) {
  await page.goto('/');
  await page.waitForSelector('.qcard');
  // pick simulation mode (mode-card[1] = sim)
  await page.locator('.mode-card').nth(0).click();
  await page.locator('.qcard').first().click();
  await page.locator('.qcard__btn--primary').click();
  await page.waitForSelector('.phase-head');
  // skip C1/I/R/C2 to reach L (set state directly via injection)
  await page.evaluate(() => { window.AppState.circlesSimStep = 4; window.renderApp(); });
  await page.waitForSelector('.sol-card');
}

test('L step renders 2 sol-cards by default', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await stub(page);
  await gotoLStep(page);
  await expect(page.locator('.sol-card')).toHaveCount(2);
  await expect(page.locator('.sol-card__num').nth(0)).toHaveText('方案一');
  await expect(page.locator('.sol-card__num').nth(1)).toHaveText('方案二');
  await expect(page.locator('.sol-add')).toBeVisible();
});

test('L step phase-head__num is 05 and progress L is active', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await stub(page);
  await gotoLStep(page);
  await expect(page.locator('.phase-head__num')).toHaveText('05');
  await expect(page.locator('.progress__step.is-active .step-letter')).toHaveText('L');
});

test('sol-add adds 3rd card with optional + remove btn', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await stub(page);
  await gotoLStep(page);
  await page.locator('.sol-add').click();
  await expect(page.locator('.sol-card')).toHaveCount(3);
  await expect(page.locator('.sol-card__num').nth(2)).toContainText('方案三');
  await expect(page.locator('.sol-card__optional')).toBeVisible();
  await expect(page.locator('.sol-card__remove')).toBeVisible();
  // sol-add hidden after 3rd added
  await expect(page.locator('.sol-add')).toBeHidden();
});

test('sol-card__remove removes 3rd card', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await stub(page);
  await gotoLStep(page);
  await page.locator('.sol-add').click();
  await page.locator('.sol-card__remove').click();
  await expect(page.locator('.sol-card')).toHaveCount(2);
  await expect(page.locator('.sol-add')).toBeVisible();
});

test('desktop renders rail with L 步重點', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1100 });
  await stub(page);
  await gotoLStep(page);
  await expect(page.locator('.rail')).toBeVisible();
  await expect(page.locator('.rail__title').first()).toHaveText('L 步重點');
});

test('desktop qchip__company shows 設計題 · 難度 中 suffix', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1100 });
  await stub(page);
  await gotoLStep(page);
  // suffix appears only on desktop sim mode for L step (matches mockup line 1388)
  // implementation: append company suffix when simStep === 4 (L) and viewport >= desktop
  // OR always include in markup, hide via CSS @media. Implementer choose; test must pass.
  const company = await page.locator('.qchip__company').textContent();
  expect(company).toContain('設計題');
});
```

- [ ] **Step 2.2：跑紅燈確認失敗**

```bash
npx playwright test tests/visual/phase1-l-step.spec.js --project=chromium
# Expected: all tests FAIL (sol-card not rendered)
```

---

## Task 3: 加 .sol-card / .sol-add CSS

**Files：**
- Modify: `public/style.css` (在 SB3 既有 .field block 之後新加)

- [ ] **Step 3.1：CSS — 對應 mockup 03 line 191-220 範圍 (請 implementer 對照 mockup `<style>` 區塊)**

```css
/* ── sol-card (Plan B SB4 — mockup 03 Section B) ────────────────────── */
.sol-card {
  background: var(--c-bg);
  border: 1px solid var(--c-rule);
  border-radius: var(--r-md);
  padding: var(--s-4);
  margin-bottom: var(--s-4);
}
.sol-card__num {
  display: inline-block;
  background: var(--c-navy);
  color: #fff;
  font-size: var(--t-cap);
  font-weight: 600;
  padding: var(--s-1) var(--s-3);
  border-radius: var(--r-sm);
  margin-bottom: var(--s-3);
  position: relative;
}
.sol-card__num::after {
  content: '';
  position: absolute;
  left: -1px;
  bottom: -8px;
  width: 24px;
  height: 2px;
  background: var(--c-navy);
}
.sol-card__optional {
  display: inline-block;
  margin-left: var(--s-2);
  font-size: var(--t-cap);
  font-weight: 400;
  color: var(--c-ink-3);
  background: transparent;
  padding: 0;
}
.sol-card__name-row {
  display: flex;
  align-items: center;
  gap: var(--s-2);
  margin-bottom: var(--s-3);
}
.sol-card__name-input {
  flex: 1;
  height: var(--touch-min);
  padding: var(--s-2) var(--s-3);
  font-size: var(--t-body);
  border: 1px solid var(--c-rule);
  border-radius: var(--r-sm);
  background: #fff;
}
.sol-card__name-input:focus {
  outline: 2px solid var(--c-navy);
  outline-offset: -1px;
  border-color: var(--c-navy);
}
.sol-card__remove {
  width: var(--touch-min);
  height: var(--touch-min);
  border: 1px solid var(--c-rule);
  border-radius: var(--r-sm);
  background: #fff;
  color: var(--c-ink-3);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.sol-card__remove:hover { color: var(--c-danger); border-color: var(--c-danger); }

.sol-add {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--s-2);
  width: 100%;
  padding: var(--s-3);
  border: 1px dashed var(--c-rule);
  border-radius: var(--r-md);
  background: transparent;
  color: var(--c-ink-2);
  font-size: var(--t-body);
  cursor: pointer;
  margin-top: var(--s-2);
}
.sol-add:hover { border-color: var(--c-navy); color: var(--c-navy); }

/* mobile: field 內仍 render label「核心機制」 */
/* tablet+: hide label-row inside sol-card field (per mockup line 1325-1335 vs 1259-1273) */
@media (min-width: 768px) {
  .sol-card .field__label-row { display: none; }
}
```

- [ ] **Step 3.2：用實際 token 對齊** — implementer 必確認 `--c-navy / --c-rule / --c-bg / --c-ink / --c-ink-2 / --c-ink-3 / --c-danger / --r-md / --r-sm / --s-1..--s-4 / --t-body / --t-cap / --touch-min` 在 SB1 token block 內已定義；缺哪個就 grep + 對 mockup 該段 inline style 翻譯回 token。

---

## Task 4: CIRCLES_STEP_CONFIG.L entry + render branch

**Files：**
- Modify: `public/app.js` line ~263 (CIRCLES_STEP_CONFIG block)

- [ ] **Step 4.1：加 L config**（drill 不練 L，所以 drill suffix 用 L 也保留結構但實際 render 不會用到）

```js
L: {
  eyebrow: { sim: 'Phase 1 · 寫框架', drill: 'Phase 1 · 個別步驟練習' },
  title: 'L · 提出方案',
  titleSimDesktopSuffix: '（2-3 個方案）',  // mockup line 1386
  progressLabel: '方案',
  stepLetter: 'L',
  stepNum: '05',
  railTitle: 'L 步重點',
  railIntro: '提出 2-3 個有方向差異的方案',
  railBody: '方案二要和方案一在「方向」上有本質差異 — 不是更多，而是不同。例如方案一是系統主動，方案二可以是用戶主動；或方案一是短期戰術，方案二是長期重設計。',
  railTitle2: '方案三是加分項',
  railBody2: '湊數寧可不填 — 說明「前兩個已涵蓋主要可能性」也是有效回答。',
  // L step 不用 fields（不是 4-field standard），用 sol-card multi 結構
  isSolMulti: true,
  solCardField: {
    label: '核心機制',
    placeholders: {
      sol1: '描述方案一的核心機制（與目標連結）',
      sol2: '與方案一在「方向」上有本質差異 — 不是更多，而是不同',
      sol3Mobile: '加分項 — 第三個真正不同的思路（更激進、更長線）',
      sol3Desktop: '第三個真正不同的思路 — 例如：把廣告變成內容（品牌 podcast）；或從供給端切（廣告主競價）',
    },
    nameInputPlaceholders: {
      default: '方案名稱（10 字內）',
      sol3Desktop: '方案名稱（10 字內）— 加分項，更激進或長線',
    },
  },
},
```

- [ ] **Step 4.2：在 renderCirclesPhase1() 加 L 分支**

```js
// (插入位置：renderCirclesPhase1 內 phaseBodyHtml 計算前)
if (stepCfg.isSolMulti) {
  // L step branch — sol-card multi (mockup 03 Section B)
  return renderCirclesPhase1Lstep(q, stepKey, stepCfg, currentStepNum);
}
```

- [ ] **Step 4.3：新加 `renderCirclesPhase1Lstep()`**

  保留 progress / phase-head（含 phase-head__title「L · 提出方案」desktop 加 `（2-3 個方案）`）/ qchip / submit-bar（sim mode：左 ghost「上一步」、右「下一步」）；phase-body 內 render N 張 sol-card + sol-add；desktop 包 phase-body--with-rail + aside.rail。

  qchip__company desktop 加 ` · 設計題 · 難度 中` 後綴 — 使用既存 q.question_type / q.difficulty mapping（同 isDrill 但用 sim 模式 desktop only：用 `data-circles-l-step` 屬性 + CSS @media 顯示 vs 隱藏 suffix span）。

  phase-head__title 桌面後綴：渲染 `<span class="phase-head__title-extra">（2-3 個方案）</span>` + CSS `@media (max-width: 1023px) { .phase-head__title-extra { display: none; } }`。

- [ ] **Step 4.4：新加 `renderSolCard(idx, sol, isOptional, viewport)`** — 但 viewport 不靠 JS 偵測，全 render markup 後用 CSS @media 控制 placeholder swap（兩個 placeholder span/data-attr，CSS @media 隱藏一個）。

實際做法（推薦）：用 `<input ... placeholder="X" data-placeholder-desktop="Y">` + JS 在 resize / mount 時動態 swap placeholder。或更穩妥的方式：render 時偵測 `window.innerWidth >= 1024` 一次性決定 placeholder（rerender 在 resize 時用 debounced listener）。

最簡單可接受方案：render 時 `var isDesktop = window.innerWidth >= 1024;` 決定 placeholder；resize 時 `renderApp()` 重 render 一次（既有 AppState 已存 user 輸入內容，不會丟）。Implementer 評估後選一。

---

## Task 5: bind handlers — sol-add / sol-card__remove / textarea / name-input

**Files：**
- Modify: `public/app.js` `bindCirclesPhase1` 區塊

- [ ] **Step 5.1：sol-add click**

```js
document.querySelectorAll('.sol-add').forEach(function (btn) {
  btn.addEventListener('click', function () {
    if (AppState.circlesPhase1Solutions.length < 3) {
      AppState.circlesPhase1Solutions.push({ name: '', mechanism: '' });
      renderApp();
    }
  });
});
```

- [ ] **Step 5.2：sol-card__remove click**

```js
document.querySelectorAll('.sol-card__remove').forEach(function (btn) {
  btn.addEventListener('click', function () {
    if (AppState.circlesPhase1Solutions.length > 2) {
      AppState.circlesPhase1Solutions.pop();
      renderApp();
    }
  });
});
```

- [ ] **Step 5.3：sol-card name-input + textarea — input listener**

```js
document.querySelectorAll('.sol-card__name-input').forEach(function (input, idx) {
  input.addEventListener('input', function (e) {
    if (AppState.circlesPhase1Solutions[idx]) {
      AppState.circlesPhase1Solutions[idx].name = e.target.value;
    }
  });
});
document.querySelectorAll('.sol-card .rt-textarea').forEach(function (ta, idx) {
  ta.addEventListener('input', function (e) {
    if (AppState.circlesPhase1Solutions[idx]) {
      AppState.circlesPhase1Solutions[idx].mechanism = e.target.value;
    }
  });
});
```

---

## Task 6: 跑綠燈

- [ ] **Step 6.1**：`npm test` — jest 不 regression，必為 157
- [ ] **Step 6.2**：`npx playwright test tests/visual/phase1-l-step.spec.js --project=chromium` 全綠
- [ ] **Step 6.3**：`npx playwright test tests/visual/phase1-l-step.spec.js --project=webkit` 全綠
- [ ] **Step 6.4**：`npx playwright test tests/visual/circles-home.spec.js tests/visual/phase1-form.spec.js --project=chromium` 不 regression
- [ ] **Step 6.5**：截圖 mobile-360 / iPad / Desktop-1280 三 viewport 存到 `/tmp/sb4-{vp}.png`，Read PNG 自驗

---

## Task 7: Commit

- [ ] **Step 7.1：implementer commit**

```bash
git add public/app.js public/style.css tests/visual/phase1-l-step.spec.js
git commit -m "feat(plan-b-sb4): L step solution-multi (mockup 03 Section B) — sol-card / sol-add / sol-remove / rail / sim-only"
```

---

## Cold Review (opus director — implementer 完工後執行)

- [ ] R1：起 dev server `npm run dev`（or `node server.js`）on :4000
- [ ] R2：自跑 Playwright 截 mobile-360 / iPad / Desktop-1280 三張 PNG
- [ ] R3：Read PNG，逐張對照 mockup 03 Section B line 1234-1460 line-by-line：
   - navbar 結構（mobile 無 tabs / tablet+ 有 tabs / desktop 多 email + sign-out）
   - progress 4 done + L active + E S unset
   - phase-head__num=05 / title「L · 提出方案」/ 桌面 suffix「（2-3 個方案）」
   - phase-head__meta：mobile only save / tablet+ 多 sep + 完整模擬 5/7
   - qchip__company：mobile/tablet `Spotify · Spotify Podcast` / desktop 加 `· 設計題 · 難度 中`
   - sol-card 數量：mobile/desktop 預設 2 / tablet 預設 3（mockup tablet 已展示加完狀態）
   - sol-card__num: 「方案一」「方案二」/ 三加「（選擇性）」
   - sol-card__name-input placeholder：default「方案名稱（10 字內）」/ desktop sol3「方案名稱（10 字內）— 加分項，更激進或長線」
   - sol-card field：mobile 有 label「核心機制」/ tablet+ 無 label
   - rt-field toolbar：2 buttons（text-b / list-bullets — NO indent/outdent）
   - textarea placeholder（mobile sol2 / tablet sol3 / desktop sol3 不同）
   - sol-add：mobile/desktop 顯示 / tablet 隱藏（已加滿）
   - submit-bar：mobile 左 empty / tablet+ 左 ghost「上一步」 / 右 primary「下一步」
   - desktop rail：「L 步重點 / 提出 2-3 個有方向差異的方案」+ hr + 「方案三是加分項 / 湊數寧可不填」
- [ ] R4：列 drift table，全部修
- [ ] R5：寫 `audit/eyeball-plan-b-sb4.md` 含 PNG 路徑 + 評論 + drift fix 紀錄

---

## Self-Review

1. **Spec coverage：** mockup line 1230-1467 每段對映任務 ✓
2. **Placeholder scan：** 無 TBD ✓
3. **Type consistency：** `circlesPhase1Solutions` schema 一致 (`{name,mechanism}`)  ✓
4. **LOCKED class respect：** navbar/progress/phase-head/qchip/field/rt-field/submit-bar/btn 都 reuse SB3 既存 class，sol-* 全新增 ✓

---

## Execution

**Mode：Subagent-Driven**（sonnet 4.6 implementer × 1 → opus cold review）。
