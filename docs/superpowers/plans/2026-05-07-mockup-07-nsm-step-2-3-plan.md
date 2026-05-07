# Mockup 07 NSM Step 2 + Step 3 Implementation Plan (Plan C SB2)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:test-driven-development. Steps use checkbox `- [ ]` syntax.

**Goal:** Replace `renderNSMStub()` (line 205) with full Step 2 + Step 3 renderers; build sub-tabs; wire NSM_DIMENSION_CONFIGS for dynamic 4-dim labels per product type; integrate save cycle to existing PATCH endpoint.

**Architecture:** New render branches in `public/app.js` for Step 2 (`renderNSMStep2`) and Step 3 (`renderNSMStep3`); shared sub-tabs chrome; NSM_DIMENSION_CONFIGS module exports the 16-cell dim definitions; save cycle mirrors CIRCLES `triggerSaveCycle()` pattern. CSS additions in `style.css`. **No backend changes.**

**Tech Stack:** Vanilla JS / Express / Playwright / jest.

**Spec:** `docs/superpowers/specs/2026-05-07-mockup-07-nsm-step-2-3-design.md`
**Mockup:** `docs/superpowers/specs/mockups/2026-05-02-frontend-rewrite/07-nsm-step-2.html` (lines 660-1640 for Step 2 §A + Step 3 §B + variants)
**Branch:** `feat/path-2-nsm` (existing worktree)

---

## Task 1 — Extract `NSM_DIMENSION_CONFIGS` 16 cells verbatim

**Files:**
- Modify: `public/app.js` — add config object near `NSM_TYPE_LABEL` (~line 2291)

- [ ] **Step 1: Read mockup line 1052-1228 + master spec §3.4 + spec §3**

Open `docs/superpowers/specs/mockups/2026-05-02-frontend-rewrite/07-nsm-step-2.html` line 1052-1228 (Step 3 §B for attention) and search for the SaaS / transaction / creator variants throughout the file.

- [ ] **Step 2: Add config object**

```js
  var NSM_DIMENSION_CONFIGS = {
    attention: {
      label: '注意力型',
      typeIcon: 'ph-play-circle',
      typeClass: 'nsm-context-card__type--attention',
      dims: [
        { id: 'reach',     label: '觸及廣度', desc: '有多少用戶真正觸碰到核心功能（非僅登入）',     coachQ: 'AHA 時刻是什麼動作？做到這個動作的人有多少？' },
        { id: 'depth',     label: '互動深度', desc: '每位用戶每次使用的品質與投入程度',             coachQ: '用戶停得夠深嗎？時長、完播率、互動次數哪個更能反映價值？' },
        { id: 'frequency', label: '習慣頻率', desc: '用戶是否形成定期回訪的使用習慣',               coachQ: '每週/每月回來幾次？DAU/MAU 比越高代表黏性越強' },
        { id: 'retention', label: '留存驅力', desc: '什麼讓用戶持續回訪而非逐漸流失',               coachQ: '社交關係？個人化推薦？收藏習慣？找出最強的留存槓桿' },
      ],
    },
    transaction: {
      label: '交易量型',
      typeIcon: 'ph-shopping-cart',
      typeClass: 'nsm-context-card__type--transaction',
      dims: [
        { id: 'reach',     label: '供給廣度', desc: '有多少符合需求的供給方在平台',                 coachQ: '供給端的廣度與覆蓋率是否充足？' },
        { id: 'depth',     label: '需求深度', desc: '每筆需求的訂單規模與複雜度',                   coachQ: '單筆訂單金額或訂單複雜度是否能反映價值？' },
        { id: 'frequency', label: '匹配效率', desc: '需求成功匹配到供給的速度與比例',               coachQ: '從搜尋到成交的轉換率與時間？' },
        { id: 'retention', label: '復購留存', desc: '完成首次交易後再次回購的比例',                 coachQ: '哪一段時間內復購比例最能反映平台健康？' },
      ],
    },
    creator: {
      label: '創造力型',
      typeIcon: 'ph-pencil-simple',
      typeClass: 'nsm-context-card__type--creator',
      dims: [
        { id: 'reach',     label: '創造廣度', desc: '有多少創作者持續產出內容',                     coachQ: '活躍創作者數與內容產出量哪個更代表平台活力？' },
        { id: 'depth',     label: '成果品質', desc: '創作者產出內容的品質與互動量',                 coachQ: '每件作品平均互動量、停留時間怎樣最能反映品質？' },
        { id: 'frequency', label: '採用廣度', desc: '創作者作品被消費端採用的比例',                 coachQ: '消費者觸及創作者作品的比例與深度？' },
        { id: 'retention', label: '商業轉化', desc: '創作行為轉化為持續商業價值的能力',             coachQ: '創作者收入或商業轉化指標如何衡量？' },
      ],
    },
    saas: {
      label: 'SaaS 型',
      typeIcon: 'ph-buildings',
      typeClass: 'nsm-context-card__type--saas',
      dims: [
        { id: 'reach',     label: '啟用廣度', desc: '組織內部署席次與啟用比例',                     coachQ: '購買的席次中真正活躍使用的比例？' },
        { id: 'depth',     label: '席次深度', desc: '每個活躍席次的功能採用深度',                   coachQ: '使用者使用幾項核心功能、進階模組？' },
        { id: 'frequency', label: '黏著頻率', desc: '工作流嵌入企業日常程度',                       coachQ: '每週使用天數、整合到工作流的程度？' },
        { id: 'retention', label: '擴張信號', desc: '擴張席次或加購模組的客戶比例',                 coachQ: '淨留存收入 (NRR)、加購速度怎樣最能反映擴張？' },
      ],
    },
  };

  function getNsmDimConfig(productType) {
    return NSM_DIMENSION_CONFIGS[productType] || NSM_DIMENSION_CONFIGS.attention;
  }
```

- [ ] **Step 3: Commit**

```bash
git add public/app.js
git commit -m "feat(plan-c-sb2-1): NSM_DIMENSION_CONFIGS 4 type × 4 dim verbatim"
```

---

## Task 2 — TDD RED: NSM Step 2/3 + sub-tab specs

**Files:**
- Create: `tests/visual/nsm-step-2-3.spec.js` (12 specs)

- [ ] **Step 1: Write failing specs**

```js
const { test, expect } = require('@playwright/test');

async function setupNSMStep2(page, q) {
  await page.route('**/api/(guest-)?circles-stats**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await page.route('**/api/(guest/)?nsm-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/(guest-)?circles-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.goto('/');
  await page.waitForSelector('.qcard');
  await page.evaluate(({ q }) => {
    window.AppState.view = 'nsm';
    window.AppState.nsmStep = 2;
    window.AppState.nsmSubTab = 'nsm-step2';
    window.AppState.nsmSelectedQuestion = q;
    window.render();
  }, { q });
  await page.waitForSelector('.nsm-sub-tabs', { timeout: 3000 });
}

const Q_ATTENTION = { id: 'q-att', company: 'Spotify', industry: '音樂串流', scenario: 'Podcast NSM', product: 'Spotify Podcast' };
const Q_SAAS      = { id: 'q-saas', company: 'Slack', industry: 'B2B SaaS', scenario: 'Workspace activation', product: 'Slack' };

test.describe('NSM Step 2 + Step 3 (mockup 07)', () => {
  test('Step 2 renders sub-tabs + 3-step guide + 3 fields', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await setupNSMStep2(page, Q_ATTENTION);
    expect(await page.locator('.nsm-sub-tab').count()).toBe(3);
    await expect(page.locator('.nsm-sub-tab.is-active')).toHaveText(/步驟 2/);
    expect(await page.locator('.nsm-guide__step').count()).toBe(3);
    expect(await page.locator('.nsm-field').count()).toBe(3);
  });

  test('Step 2 example-toggle expands example', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await setupNSMStep2(page, Q_ATTENTION);
    var firstToggle = page.locator('[data-nsm-example-toggle]').first();
    await firstToggle.click();
    await expect(page.locator('.nsm-field__example.is-open').first()).toBeVisible();
  });

  test('Step 2 NSM input typing updates AppState.nsmDefinition.nsm', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await setupNSMStep2(page, Q_ATTENTION);
    await page.locator('[data-nsm-field="nsm"]').fill('每月活躍聆聽用戶數');
    var v = await page.evaluate(() => window.AppState.nsmDefinition && window.AppState.nsmDefinition.nsm);
    expect(v).toBe('每月活躍聆聽用戶數');
  });

  test('Step 2 提交審核 disabled when nsm or businessLink empty', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await setupNSMStep2(page, Q_ATTENTION);
    var btn = page.locator('[data-nsm-submit]');
    await expect(btn).toBeDisabled();
  });

  test('Step 2 提交審核 enabled when both filled', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await setupNSMStep2(page, Q_ATTENTION);
    await page.evaluate(() => {
      window.AppState.nsmDefinition = { nsm: 'A', explanation: '', businessLink: 'B' };
      window.render();
    });
    await expect(page.locator('[data-nsm-submit]')).toBeEnabled();
  });

  test('Step 3 attention type renders 4 dim labels: 觸及/互動/習慣/留存', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.route('**/api/(guest-)?circles-stats**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
    await page.route('**/api/(guest/)?nsm-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.route('**/api/(guest-)?circles-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.goto('/');
    await page.evaluate(({ q }) => {
      window.AppState.view = 'nsm';
      window.AppState.nsmStep = 3;
      window.AppState.nsmSubTab = 'nsm-step3';
      window.AppState.nsmSelectedQuestion = q;
      window.AppState.nsmDefinition = { nsm: 'X', explanation: 'Y', businessLink: 'Z' };
      window.AppState.nsmGateResult = { overall_status: 'ok' }; // unlock step3 sub-tab
      window.render();
    }, { q: Q_ATTENTION });
    await page.waitForSelector('.nsm-dim');
    var labels = await page.locator('.nsm-dim__label').allTextContents();
    expect(labels).toEqual(['觸及廣度', '互動深度', '習慣頻率', '留存驅力']);
  });

  test('Step 3 saas type renders 4 dim labels: 啟用/席次/黏著/擴張', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.route('**/api/(guest-)?circles-stats**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
    await page.route('**/api/(guest/)?nsm-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.route('**/api/(guest-)?circles-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.goto('/');
    await page.evaluate(({ q }) => {
      window.AppState.view = 'nsm';
      window.AppState.nsmStep = 3;
      window.AppState.nsmSubTab = 'nsm-step3';
      window.AppState.nsmSelectedQuestion = q;
      window.AppState.nsmDefinition = { nsm: 'X', explanation: 'Y', businessLink: 'Z' };
      window.AppState.nsmGateResult = { overall_status: 'ok' };
      window.render();
    }, { q: Q_SAAS });
    await page.waitForSelector('.nsm-dim');
    var labels = await page.locator('.nsm-dim__label').allTextContents();
    expect(labels).toEqual(['啟用廣度', '席次深度', '黏著頻率', '擴張信號']);
  });

  test('Step 3 dim hint-toggle expands hint', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.route('**/api/(guest-)?circles-stats**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
    await page.route('**/api/(guest/)?nsm-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.route('**/api/(guest-)?circles-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.goto('/');
    await page.evaluate(({ q }) => {
      window.AppState.view = 'nsm';
      window.AppState.nsmStep = 3;
      window.AppState.nsmSubTab = 'nsm-step3';
      window.AppState.nsmSelectedQuestion = q;
      window.AppState.nsmGateResult = { overall_status: 'ok' };
      window.render();
    }, { q: Q_ATTENTION });
    await page.waitForSelector('.nsm-dim__hint-btn');
    await page.locator('.nsm-dim__hint-btn').first().click();
    await expect(page.locator('.nsm-dim__hint.is-open').first()).toBeVisible();
  });

  test('Step 3 dim textarea typing updates AppState.nsmBreakdown', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.route('**/api/(guest-)?circles-stats**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
    await page.route('**/api/(guest/)?nsm-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.route('**/api/(guest-)?circles-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.goto('/');
    await page.evaluate(({ q }) => {
      window.AppState.view = 'nsm';
      window.AppState.nsmStep = 3;
      window.AppState.nsmSubTab = 'nsm-step3';
      window.AppState.nsmSelectedQuestion = q;
      window.AppState.nsmGateResult = { overall_status: 'ok' };
      window.render();
    }, { q: Q_ATTENTION });
    await page.waitForSelector('[data-nsm-dim="reach"]');
    await page.locator('[data-nsm-dim="reach"]').first().fill('reach-test-content');
    await page.waitForTimeout(100);
    var v = await page.evaluate(() => window.AppState.nsmBreakdown && window.AppState.nsmBreakdown.reach);
    expect(v).toContain('reach-test-content');
  });

  test('Step 3 提交審核 disabled when any dim empty', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.route('**/api/(guest-)?circles-stats**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
    await page.route('**/api/(guest/)?nsm-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.route('**/api/(guest-)?circles-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.goto('/');
    await page.evaluate(({ q }) => {
      window.AppState.view = 'nsm';
      window.AppState.nsmStep = 3;
      window.AppState.nsmSubTab = 'nsm-step3';
      window.AppState.nsmSelectedQuestion = q;
      window.AppState.nsmGateResult = { overall_status: 'ok' };
      window.AppState.nsmBreakdown = { reach: 'A', depth: '', frequency: '', retention: '' };
      window.render();
    }, { q: Q_ATTENTION });
    await expect(page.locator('[data-nsm-submit]')).toBeDisabled();
  });

  test('Sub-tab disabled when no gate result', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await setupNSMStep2(page, Q_ATTENTION);
    await expect(page.locator('[data-nsm-subtab="nsm-step3"]')).toBeDisabled();
  });

  test('Sub-tab click switches nsmSubTab + render', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.route('**/api/(guest-)?circles-stats**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
    await page.route('**/api/(guest/)?nsm-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.route('**/api/(guest-)?circles-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.goto('/');
    await page.evaluate(({ q }) => {
      window.AppState.view = 'nsm';
      window.AppState.nsmStep = 2;
      window.AppState.nsmSubTab = 'nsm-step2';
      window.AppState.nsmSelectedQuestion = q;
      window.AppState.nsmGateResult = { overall_status: 'ok' };
      window.AppState.nsmDefinition = { nsm: 'X', explanation: 'Y', businessLink: 'Z' };
      window.render();
    }, { q: Q_ATTENTION });
    await page.locator('[data-nsm-subtab="nsm-step3"]').click();
    var st = await page.evaluate(() => window.AppState.nsmSubTab);
    expect(st).toBe('nsm-step3');
  });
});
```

- [ ] **Step 2: Run RED**

```bash
npx playwright test --config=tests/visual/playwright.config.js --project=Desktop-1280 tests/visual/nsm-step-2-3.spec.js --reporter=line
```

Expected: ≥10/12 fail (no `.nsm-sub-tabs`, no `.nsm-field`, no `.nsm-dim`).

- [ ] **Step 3: Commit RED**

```bash
git add tests/visual/nsm-step-2-3.spec.js
git commit -m "test(nsm-step2-3): RED — sub-tabs + Step 2 form + Step 3 4-dim 12 specs"
```

---

## Task 3 — GREEN: replace `renderNSMStub` with full Step 2 + Step 3

**Files:**
- Modify: `public/app.js` — replace `renderNSMStub` (line 205) and add helpers
- Modify: `public/style.css` — append CSS

- [ ] **Step 1: Add AppState fields + helpers**

```js
    nsmDefinition: { nsm: '', explanation: '', businessLink: '' },
    nsmBreakdown: { reach: '', depth: '', frequency: '', retention: '' },
    nsmExampleExpanded: {},
    nsmHintExpanded: {},
    nsmGateResult: null,        // step 3 unlocked when overall_status === 'ok' or 'warn'
```

- [ ] **Step 2: Replace `renderNSMStub` (line 205)**

```js
  function renderNSM() {
    if (AppState.nsmStep === 1) return renderNSMStep1();
    if (AppState.nsmStep === 2) return renderNSMStep2();
    if (AppState.nsmStep === 3) return renderNSMStep3();
    if (AppState.nsmStep === 4) return renderNSMStep4 ? renderNSMStep4() : '<div>NSM Step 4 not yet implemented</div>';
    return renderNSMStep1();
  }

  function renderNSMSubTabs() {
    var st = AppState.nsmSubTab || 'nsm-step2';
    var gateOk = AppState.nsmGateResult && (AppState.nsmGateResult.overall_status === 'ok' || AppState.nsmGateResult.overall_status === 'warn');
    var step2HasContent = !!(AppState.nsmDefinition && AppState.nsmDefinition.nsm && AppState.nsmDefinition.businessLink);
    return '<div class="nsm-sub-tabs">'
      + '<button class="nsm-sub-tab' + (st === 'nsm-step2' ? ' is-active' : '') + '" data-nsm-subtab="nsm-step2">步驟 2：定義 NSM</button>'
      + '<button class="nsm-sub-tab' + (st === 'nsm-gate' ? ' is-active' : '') + '"' + (step2HasContent ? '' : ' disabled') + ' data-nsm-subtab="nsm-gate">NSM 審核</button>'
      + '<button class="nsm-sub-tab' + (st === 'nsm-step3' ? ' is-active' : '') + '"' + (gateOk ? '' : ' disabled') + ' data-nsm-subtab="nsm-step3">步驟 3：拆解</button>'
      + '</div>';
  }

  function renderNSMStep2() {
    var q = AppState.nsmSelectedQuestion || {};
    var ptype = nsmGuessProductType(q);
    var typeCfg = getNsmDimConfig(ptype);
    var def = AppState.nsmDefinition || { nsm: '', explanation: '', businessLink: '' };
    var canSubmit = !!(def.nsm && def.nsm.trim() && def.businessLink && def.businessLink.trim());
    return '<div data-view="nsm">'
      + renderNavbar()
      + '<div class="phase-head">'
      +   '<span class="phase-head__num">2</span>'
      +   '<div class="phase-head__main">'
      +     '<div class="phase-head__eyebrow">NSM · 北極星訓練</div>'
      +     '<div class="phase-head__title">定義 NSM</div>'
      +   '</div>'
      + '</div>'
      + renderNSMSubTabs()
      + renderNSMProgress('指標')
      + '<div class="nsm-body">'
      +   renderNSMContextCard(q, typeCfg)
      +   renderNSMGuide()
      +   renderNSMField('nsm', '北極星指標 (NSM)', def.nsm, '<strong>例：</strong>每月完成至少一首完整曲目播放的活躍月用戶數', /*single*/ true)
      +   renderNSMField('explanation', '定義說明', def.explanation, '<strong>例：</strong>說明 NSM 的具體量化定義與行為閾值', false)
      +   renderNSMField('businessLink', '與業務目標連結', def.businessLink, '<strong>例：</strong>NSM 上升直接對應廣告營收上升或留存率提升', false)
      + '</div>'
      + '<div class="submit-bar">'
      +   '<div class="submit-bar__left"><button class="btn btn--ghost" data-nsm-action="back"><i class="ph ph-arrow-left"></i>上一步</button></div>'
      +   '<div class="submit-bar__right"><button class="btn btn--primary" data-nsm-submit ' + (canSubmit ? '' : 'disabled') + '>提交審核<i class="ph ph-arrow-right"></i></button></div>'
      + '</div></div>';
  }

  function renderNSMField(fieldId, label, value, exampleHtml, isSingle) {
    var isOpen = !!AppState.nsmExampleExpanded[fieldId];
    var caret = isOpen ? 'ph-caret-down' : 'ph-caret-right';
    var inputHtml = isSingle
      ? '<input class="nsm-input" data-nsm-field="' + fieldId + '" placeholder="..." value="' + escHtml(value || '') + '">'
      : '<div class="nsm-rt-field"><div class="nsm-rt-toolbar">'
        + '<button class="nsm-rt-tbtn" data-rt-cmd="bold"><strong>B</strong></button>'
        + '<button class="nsm-rt-tbtn" data-rt-cmd="insertUnorderedList"><i class="ph ph-list-bullets"></i></button>'
        + '</div><div class="nsm-rt-textarea" contenteditable="true" data-nsm-field="' + fieldId + '">' + (value || '') + '</div></div>';
    return '<div class="nsm-field">'
      + '<div class="nsm-field__head">'
      +   '<label class="nsm-field__label">' + escHtml(label) + '</label>'
      +   '<button class="nsm-field__example-toggle" data-nsm-example-toggle="' + fieldId + '"><i class="ph ' + caret + '"></i>查看範例</button>'
      + '</div>'
      + '<div class="nsm-field__example' + (isOpen ? ' is-open' : '') + '">' + exampleHtml + '</div>'
      + inputHtml
      + '</div>';
  }

  function renderNSMGuide() {
    return '<div class="nsm-guide">'
      + '<div class="nsm-guide__title"><i class="ph ph-path"></i>3 步定義法</div>'
      + '<div class="nsm-guide__step"><span class="nsm-guide__num">1</span><div class="nsm-guide__body"><strong>找 AHA 時刻</strong><p>用戶第一次真正感受到產品價值的那個動作是什麼？</p></div></div>'
      + '<div class="nsm-guide__step"><span class="nsm-guide__num">2</span><div class="nsm-guide__body"><strong>轉成可量化指標</strong><p>把那個動作表達成「誰 × 做了什麼行為 × 多少量/頻率」的具體數字。</p></div></div>'
      + '<div class="nsm-guide__step"><span class="nsm-guide__num">3</span><div class="nsm-guide__body"><strong>做虛榮指標檢驗</strong><p>問自己：如果這個數字翻倍，產品的商業收益一定增加嗎？</p></div></div>'
      + '</div>';
  }

  function renderNSMContextCard(q, typeCfg) {
    return '<div class="nsm-context-card">'
      + '<div class="nsm-context-card__top">'
      +   '<span class="nsm-context-card__company">' + escHtml(q.company || '') + '</span>'
      +   '<span class="nsm-context-card__industry">' + escHtml(q.industry || '') + '</span>'
      +   '<span class="nsm-context-card__type ' + typeCfg.typeClass + '"><i class="ph ' + typeCfg.typeIcon + '"></i>' + escHtml(typeCfg.label) + '</span>'
      + '</div>'
      + '<p class="nsm-context-card__scenario">' + escHtml(q.scenario || '') + '</p>'
      + '</div>';
  }

  function renderNSMStep3() {
    var q = AppState.nsmSelectedQuestion || {};
    var ptype = nsmGuessProductType(q);
    var typeCfg = getNsmDimConfig(ptype);
    var br = AppState.nsmBreakdown || {};
    var canSubmit = typeCfg.dims.every(function (d) { return br[d.id] && String(br[d.id]).trim(); });
    return '<div data-view="nsm">'
      + renderNavbar()
      + '<div class="phase-head">'
      +   '<span class="phase-head__num">3</span>'
      +   '<div class="phase-head__main">'
      +     '<div class="phase-head__eyebrow">NSM · 北極星訓練</div>'
      +     '<div class="phase-head__title">拆解輸入指標</div>'
      +   '</div>'
      + '</div>'
      + renderNSMSubTabs()
      + renderNSMProgress('拆解')
      + '<div class="nsm-body">'
      +   '<div class="step3-banner"><i class="ph ph-target"></i><strong>你的 NSM：</strong>' + escHtml((AppState.nsmDefinition || {}).nsm || '') + '</div>'
      +   '<div class="step3-intro"><span class="nsm-context-card__type ' + typeCfg.typeClass + '"><i class="ph ' + typeCfg.typeIcon + '"></i>' + escHtml(typeCfg.label) + '</span> 4-dim 拆解：</div>'
      +   typeCfg.dims.map(function (d) { return renderNSMDim(d, br[d.id] || ''); }).join('')
      + '</div>'
      + '<div class="submit-bar">'
      +   '<div class="submit-bar__left"><button class="btn btn--ghost" data-nsm-action="back-to-step2"><i class="ph ph-arrow-left"></i>上一步</button></div>'
      +   '<div class="submit-bar__right"><button class="btn btn--primary" data-nsm-submit ' + (canSubmit ? '' : 'disabled') + '>提交審核<i class="ph ph-arrow-right"></i></button></div>'
      + '</div></div>';
  }

  function renderNSMDim(dim, value) {
    var isHintOpen = !!AppState.nsmHintExpanded[dim.id];
    return '<div class="nsm-dim">'
      + '<div class="nsm-dim__head">'
      +   '<div class="nsm-dim__label">' + escHtml(dim.label) + '</div>'
      +   '<div class="nsm-dim__desc">' + escHtml(dim.desc) + '</div>'
      + '</div>'
      + '<div class="nsm-dim__body">'
      +   '<div class="nsm-dim__coach"><i class="ph ph-chat-dots"></i>' + escHtml(dim.coachQ) + '</div>'
      +   '<button class="nsm-dim__hint-btn" data-nsm-hint-toggle="' + dim.id + '"><i class="ph ph-lightbulb"></i>查看教練提示</button>'
      +   '<div class="nsm-dim__hint' + (isHintOpen ? ' is-open' : '') + '">提示：以可量化、可操作、領先的標準衡量「' + escHtml(dim.label) + '」。</div>'
      +   '<div class="nsm-rt-field"><div class="nsm-rt-toolbar">'
      +     '<button class="nsm-rt-tbtn" data-rt-cmd="bold"><strong>B</strong></button>'
      +     '<button class="nsm-rt-tbtn" data-rt-cmd="insertUnorderedList"><i class="ph ph-list-bullets"></i></button>'
      +   '</div><textarea class="nsm-rt-textarea" data-nsm-dim="' + dim.id + '">' + escHtml(value) + '</textarea></div>'
      + '</div></div>';
  }

  // expose
  window.renderNSMStep2 = renderNSMStep2;
  window.renderNSMStep3 = renderNSMStep3;
```

- [ ] **Step 3: Add bindings**

```js
  function bindNSM() {
    document.querySelectorAll('[data-nsm-subtab]').forEach(function (el) {
      el.addEventListener('click', function () {
        if (el.disabled) return;
        AppState.nsmSubTab = el.dataset.nsmSubtab;
        if (AppState.nsmSubTab === 'nsm-step2') AppState.nsmStep = 2;
        else if (AppState.nsmSubTab === 'nsm-step3') AppState.nsmStep = 3;
        render();
      });
    });
    document.querySelectorAll('[data-nsm-example-toggle]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var fid = btn.dataset.nsmExampleToggle;
        AppState.nsmExampleExpanded[fid] = !AppState.nsmExampleExpanded[fid];
        render();
      });
    });
    document.querySelectorAll('[data-nsm-hint-toggle]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var did = btn.dataset.nsmHintToggle;
        AppState.nsmHintExpanded[did] = !AppState.nsmHintExpanded[did];
        render();
      });
    });
    document.querySelectorAll('[data-nsm-field]').forEach(function (el) {
      el.addEventListener('input', function () {
        var fid = el.dataset.nsmField;
        var v = el.tagName === 'INPUT' ? el.value : el.innerHTML;
        AppState.nsmDefinition[fid] = v;
        triggerNsmSaveCycle();
      });
    });
    document.querySelectorAll('[data-nsm-dim]').forEach(function (el) {
      el.addEventListener('input', function () {
        var did = el.dataset.nsmDim;
        AppState.nsmBreakdown[did] = el.value;
        triggerNsmSaveCycle();
      });
    });
  }

  var _nsmSaveTimer = null;
  function triggerNsmSaveCycle() {
    if (_nsmSaveTimer) clearTimeout(_nsmSaveTimer);
    _nsmSaveTimer = setTimeout(function () {
      try {
        var qid = (AppState.nsmSelectedQuestion || {}).id || 'unknown';
        var payload = {
          user_nsm: (AppState.nsmDefinition || {}).nsm || '',
          user_breakdown: AppState.nsmBreakdown || {},
        };
        localStorage.setItem('pmdrill:nsm:draft:' + qid, JSON.stringify({ ...payload, ts: Date.now() }));
        // PATCH defer (backend route exists; wire opportunistically)
        var sessionId = AppState.nsmSession && AppState.nsmSession.id;
        if (sessionId) {
          var path = (AppState.accessToken ? '/api/nsm-sessions/' : '/api/guest/nsm-sessions/') + sessionId + '/progress';
          window.apiFetch(path, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          }).catch(function () {});
        }
      } catch (_) {}
    }, 800);
  }
```

- [ ] **Step 4: Append CSS to `public/style.css`**

Append all `.nsm-sub-tabs`, `.nsm-sub-tab`, `.nsm-context-card`, `.nsm-guide*`, `.nsm-field*`, `.nsm-input`, `.nsm-rt-field*`, `.step3-banner`, `.step3-intro`, `.nsm-dim*` rules verbatim from mockup 07 lines 1-650.

- [ ] **Step 5: Run nsm-step-2-3 specs to verify GREEN**

```bash
npx playwright test --config=tests/visual/playwright.config.js --project=Desktop-1280 --project=Mobile-360 --project=iPad tests/visual/nsm-step-2-3.spec.js --reporter=line
```

Expected: 36/36 pass.

- [ ] **Step 6: Run regression sweep**

```bash
npx playwright test --config=tests/visual/playwright.config.js --project=Desktop-1280 tests/visual/restore-no-drift.spec.js tests/visual/offcanvas-item-click-restore.spec.js tests/visual/circles-gate.spec.js --reporter=line 2>&1 | tail -5
```

Expected: 11 + 15 + 11 = 37 specs pass (no NSM Step 1 regression — it's separate file `nsm-card-inplace-expand.spec.js`).

- [ ] **Step 7: Commit GREEN**

```bash
git add public/app.js public/style.css
git commit -m "feat(plan-c-sb2): GREEN — NSM Step 2 + Step 3 with sub-tabs + 4-dim dynamic labels (mockup 07)"
```

---

## Task 4 — 8-viewport regression sweep

- [ ] **Step 1: Full 8-viewport on nsm-step-2-3**

```bash
npx playwright test --config=tests/visual/playwright.config.js --project=Mobile-360 --project=iPhone-SE --project=iPhone-14 --project=iPhone-15-Pro --project=iPad --project=Desktop-1280 --project=Desktop-1440 --project=Desktop-2560 tests/visual/nsm-step-2-3.spec.js --reporter=line
```

Expected: 96/96 pass.

- [ ] **Step 2: NSM Step 1 regression**

```bash
npx playwright test --config=tests/visual/playwright.config.js --project=Desktop-1280 tests/visual/nsm-card-inplace-expand.spec.js --reporter=line
```

Expected: 6/6 pass (Plan C SB1 baseline preserved).

- [ ] **Step 3: jest baseline**

```bash
npm test
```

Expected: 160/160 unchanged.

- [ ] **Step 4: Self-review report**

Report DONE with:
- 4 commit SHAs
- Playwright 96/96 (8 vp × 12)
- jest 160/160
- Files changed
- Confirmation NO backend file touched
