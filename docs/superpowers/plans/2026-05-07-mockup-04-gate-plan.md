# Mockup 04 Phase 1.5 Gate Implementation Plan (Plan B SB10)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:test-driven-development. Steps use checkbox `- [ ]` syntax. Director cold-reviews each commit; sonnet implements; merge to main on green.

**Goal:** Implement `renderCirclesGate()` for `circlesPhase === 1.5` view with 4 states (ok / warn / error / loading), exact mockup 04 alignment, no simulation override.

**Architecture:** New render branch in app.js + new POST flow `submitFrameworkToGate()` + new bindings `bindCirclesGate()`. CSS additions in style.css. No backend changes.

**Tech Stack:** Vanilla JS / Express / Playwright / jest.

**Spec:** `docs/superpowers/specs/2026-05-07-mockup-04-gate-design.md`
**Mockup:** `docs/superpowers/specs/mockups/2026-05-02-frontend-rewrite/04-phase-1-5-gate.html` (lines 583-1670 for 4 states)
**Branch:** `feat/path-2-circles-core` (existing worktree)

---

## Task 1 — TDD RED: gate render + actions specs

**Files:**
- Create: `tests/visual/circles-gate.spec.js` (11 specs)

- [ ] **Step 1: Write failing specs**

Create `tests/visual/circles-gate.spec.js` with 11 specs from spec §8 — paste exact code:

```js
const { test, expect } = require('@playwright/test');

const SAMPLE_GATE_OK = {
  items: [
    { field: '問題範圍', status: 'ok', title: '邊界清晰', reason: '聚焦免費版廣告' },
    { field: '時間範圍', status: 'ok', title: '週期合理', reason: '60 天對應月節奏' },
    { field: '業務影響', status: 'ok', title: '量化紅線', reason: '收入 3% 不能下降' },
    { field: '假設確認', status: 'ok', title: '可驗證', reason: '時段假設清晰' },
  ],
  canProceed: true,
  overallStatus: 'ok',
};
const SAMPLE_GATE_WARN = {
  items: [
    { field: '問題範圍', status: 'ok', title: '邊界清晰', reason: 'OK' },
    { field: '時間範圍', status: 'warn', title: '可更具體', reason: '為何 60 天', suggestion: '解釋週期理由' },
    { field: '業務影響', status: 'ok', title: '量化紅線', reason: 'OK' },
    { field: '假設確認', status: 'warn', title: '需補假設', reason: '只有 1 條', suggestion: '補 2-3 條' },
  ],
  canProceed: true,
  overallStatus: 'warn',
};
const SAMPLE_GATE_ERROR = {
  items: [
    { field: '問題範圍', status: 'error', title: '邊界錯誤', reason: '範圍太廣', suggestion: '聚焦單一場景' },
    { field: '時間範圍', status: 'ok', title: 'OK', reason: 'OK' },
    { field: '業務影響', status: 'ok', title: 'OK', reason: 'OK' },
    { field: '假設確認', status: 'ok', title: 'OK', reason: 'OK' },
  ],
  canProceed: true, // sim mode allows but FE ignores
  overallStatus: 'error',
};

async function setupGateMode(page, mode, gateResult) {
  await page.route('**/api/(guest-)?circles-stats**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await page.route('**/api/(guest-)?circles-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/(guest/)?nsm-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.goto('/');
  await page.waitForSelector('.qcard');
  await page.evaluate(({ mode, gateResult }) => {
    window.AppState.circlesMode = mode;
    window.AppState.circlesDrillStep = 'C1';
    window.AppState.circlesSelectedQuestion = { id: 'q1', company: 'Spotify', product: 'Spotify Podcast' };
    window.AppState.circlesPhase = 1.5;
    window.AppState.circlesGateResult = gateResult;
    window.AppState.circlesGateLoading = false;
    window.AppState.circlesGateError = null;
    window.render();
  }, { mode, gateResult });
  await page.waitForSelector('.gate-content', { timeout: 3000 });
}

test.describe('Phase 1.5 Gate (mockup 04)', () => {
  test('OK state — 繼續 button visible, 4 ok items', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await setupGateMode(page, 'drill', SAMPLE_GATE_OK);
    await expect(page.locator('.gate-transition--ok')).toBeVisible();
    await expect(page.locator('[data-gate-action="proceed"]')).toBeVisible();
    expect(await page.locator('.gate-item--ok').count()).toBe(4);
  });

  test('WARN state — 繼續 button + warn suggestions', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await setupGateMode(page, 'drill', SAMPLE_GATE_WARN);
    await expect(page.locator('.gate-transition--warn')).toBeVisible();
    await expect(page.locator('[data-gate-action="proceed"]')).toBeVisible();
    expect(await page.locator('.gate-item__suggestion').count()).toBeGreaterThanOrEqual(2);
  });

  test('ERROR state drill — sticky 返回修改 only, no proceed', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await setupGateMode(page, 'drill', SAMPLE_GATE_ERROR);
    await expect(page.locator('.gate-transition--error')).toBeVisible();
    expect(await page.locator('[data-gate-action="proceed"]').count()).toBe(0);
    await expect(page.locator('[data-gate-action="back"]')).toBeVisible();
    expect(await page.locator('.btn').filter({ hasText: '帶風險繼續' }).count()).toBe(0);
  });

  test('ERROR state simulation — same as drill (no override)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await setupGateMode(page, 'simulation', SAMPLE_GATE_ERROR);
    expect(await page.locator('[data-gate-action="proceed"]').count()).toBe(0);
    await expect(page.locator('[data-gate-action="back"]')).toBeVisible();
    expect(await page.locator('.btn').filter({ hasText: '帶風險繼續' }).count()).toBe(0);
  });

  test('Loading state — spinner + 4-step checklist', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.route('**/api/(guest-)?circles-stats**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
    await page.route('**/api/(guest-)?circles-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.route('**/api/(guest/)?nsm-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.goto('/');
    await page.waitForSelector('.qcard');
    await page.evaluate(() => {
      window.AppState.circlesMode = 'drill';
      window.AppState.circlesDrillStep = 'C1';
      window.AppState.circlesSelectedQuestion = { id: 'q1', company: 'X', product: 'Y' };
      window.AppState.circlesPhase = 1.5;
      window.AppState.circlesGateLoading = true;
      window.render();
    });
    await expect(page.locator('.gate-loading__spinner')).toBeVisible();
    expect(await page.locator('.gate-loading__checklist li').count()).toBe(4);
  });

  test('OK 繼續 click → circlesPhase = 2', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await setupGateMode(page, 'drill', SAMPLE_GATE_OK);
    await page.locator('[data-gate-action="proceed"]').click();
    const phase = await page.evaluate(() => window.AppState.circlesPhase);
    expect(phase).toBe(2);
  });

  test('ERROR 返回修改 click → circlesPhase = 1, draft preserved', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await setupGateMode(page, 'drill', SAMPLE_GATE_ERROR);
    await page.evaluate(() => { window.AppState.circlesFrameworkDraft = { C1: { '問題範圍': 'preserved-content' } }; });
    await page.locator('[data-gate-action="back"]').click();
    const r = await page.evaluate(() => ({ phase: window.AppState.circlesPhase, draft: window.AppState.circlesFrameworkDraft }));
    expect(r.phase).toBe(1);
    expect(r.draft.C1['問題範圍']).toBe('preserved-content');
  });

  test('Server 500 → error-wrap with retry button', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.route('**/api/(guest-)?circles-stats**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
    await page.route('**/api/(guest-)?circles-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.route('**/api/(guest/)?nsm-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.goto('/');
    await page.waitForSelector('.qcard');
    await page.evaluate(() => {
      window.AppState.circlesMode = 'drill';
      window.AppState.circlesDrillStep = 'C1';
      window.AppState.circlesSelectedQuestion = { id: 'q1', company: 'X', product: 'Y' };
      window.AppState.circlesPhase = 1.5;
      window.AppState.circlesGateError = 'Server returned 500';
      window.AppState.circlesGateLoading = false;
      window.render();
    });
    await expect(page.locator('.error-wrap')).toBeVisible();
    await expect(page.locator('[data-gate-action="retry"]')).toBeVisible();
  });

  test('Phase head shows correct step title for I step', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.route('**/api/(guest-)?circles-stats**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
    await page.route('**/api/(guest-)?circles-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.route('**/api/(guest/)?nsm-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.goto('/');
    await page.waitForSelector('.qcard');
    await page.evaluate(({ ok }) => {
      window.AppState.circlesMode = 'drill';
      window.AppState.circlesDrillStep = 'I';
      window.AppState.circlesSelectedQuestion = { id: 'q1', company: 'X', product: 'Y' };
      window.AppState.circlesPhase = 1.5;
      window.AppState.circlesGateResult = ok;
      window.render();
    }, { ok: SAMPLE_GATE_OK });
    await expect(page.locator('.phase-head__title')).toContainText('I · 定義用戶');
    await expect(page.locator('.phase-head__num')).toHaveText('1.5');
  });

  test('Empty draft submit → toast, no API call', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    let postCount = 0;
    await page.route('**/api/(guest-)?circles-stats**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
    await page.route('**/api/(guest-)?circles-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.route('**/api/(guest/)?nsm-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.route('**/api/**/gate', r => { postCount++; r.fulfill({ status: 200, body: '{}' }); });
    await page.goto('/');
    await page.waitForSelector('.qcard');
    await page.evaluate(() => {
      window.AppState.circlesMode = 'drill';
      window.AppState.circlesDrillStep = 'C1';
      window.AppState.circlesSelectedQuestion = { id: 'q1', company: 'X', product: 'Y' };
      window.AppState.circlesPhase = 1;
      window.AppState.circlesFrameworkDraft = {};
      window.render();
      window.submitFrameworkToGate && window.submitFrameworkToGate();
    });
    await page.waitForTimeout(300);
    expect(postCount).toBe(0);
  });

  test('Mobile-360 layout — phase-head + gate-list visible', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await setupGateMode(page, 'drill', SAMPLE_GATE_OK);
    await expect(page.locator('.phase-head')).toBeVisible();
    await expect(page.locator('.gate-list')).toBeVisible();
    expect(await page.locator('.gate-item').count()).toBe(4);
  });
});
```

- [ ] **Step 2: Run RED**

```bash
npx playwright test --config=tests/visual/playwright.config.js --project=Desktop-1280 tests/visual/circles-gate.spec.js --reporter=line
```

Expected: ≥10/11 fail (no `.gate-content` exists).

- [ ] **Step 3: Commit RED**

```bash
git add tests/visual/circles-gate.spec.js
git commit -m "test(gate): RED — Phase 1.5 Gate 11 specs (4 states + transitions)"
```

---

## Task 2 — GREEN: `renderCirclesGate()` + state branches

**Files:**
- Modify: `public/app.js` (insert new function before `renderCirclesPhase1`, ~line 1605)
- Modify: `public/app.js` (insert AppState additions ~line 27-30)
- Modify: `public/app.js` (extend `render()` switch to call `renderCirclesGate` when `circlesPhase === 1.5`)
- Modify: `public/style.css` (append gate CSS)

- [ ] **Step 1: Add AppState fields**

Find existing line ~27 `circlesGateResult: null,` and add right after:
```js
    circlesGateLoading: false,
    circlesGateError: null,
```

- [ ] **Step 2: Add `renderCirclesGate()` function**

Insert before `renderCirclesPhase1`:

```js
  function renderCirclesGate() {
    var q = AppState.circlesSelectedQuestion || {};
    var stepKey = AppState.circlesMode === 'drill'
      ? (AppState.circlesDrillStep || 'C1')
      : (['C1','I','R','C2','L','E','S'][AppState.circlesSimStep || 0] || 'C1');
    var stepCfg = CIRCLES_STEP_CONFIG[stepKey] || CIRCLES_STEP_CONFIG.C1;
    // chrome
    var navHtml = renderNavbar();
    var progressHtml = renderProgressBar(stepKey);
    var phaseHeadHtml = '<div class="phase-head">'
      + '<span class="phase-head__num">1.5</span>'
      + '<div class="phase-head__main">'
      +   '<div class="phase-head__eyebrow">Phase 1.5 · 框架審核</div>'
      +   '<div class="phase-head__title">' + escHtml(stepCfg.title) + '</div>'
      + '</div></div>';
    var qchipHtml = renderQchipCollapsed(q);
    // body
    var bodyHtml;
    if (AppState.circlesGateError) {
      bodyHtml = renderGateError(AppState.circlesGateError);
    } else if (AppState.circlesGateLoading) {
      bodyHtml = renderGateLoading(stepCfg);
    } else if (AppState.circlesGateResult) {
      bodyHtml = renderGateResult(AppState.circlesGateResult, stepCfg);
    } else {
      bodyHtml = renderGateLoading(stepCfg); // fallback if 1.5 entered without state
    }
    // sticky submit-bar only on error overall_status
    var stickyBar = '';
    var st = AppState.circlesGateResult && AppState.circlesGateResult.overallStatus;
    if (st === 'error') {
      stickyBar = '<div class="submit-bar">'
        + '<div class="submit-bar__left"></div>'
        + '<div class="submit-bar__right">'
        +   '<button class="btn btn--primary" data-gate-action="back"><i class="ph ph-arrow-left"></i>返回修改</button>'
        + '</div></div>';
    }
    return '<div data-view="circles" data-circles-phase="1.5">'
      + navHtml + progressHtml + phaseHeadHtml + qchipHtml + bodyHtml + stickyBar
      + '</div>';
  }

  function renderGateResult(result, stepCfg) {
    var status = result.overallStatus;
    var transitionTitle = status === 'ok'    ? '框架完整'
                        : status === 'warn'  ? '框架可通過'
                        :                       '方向需修正';
    var transitionSub = status === 'ok'   ? '所有欄位都對齊到 ' + stepCfg.stepLetter + ' 步核心定義'
                      : status === 'warn' ? '可繼續但有 ' + countByStatus(result.items, 'warn') + ' 個建議優化點'
                      :                     '有 ' + countByStatus(result.items, 'error') + ' 個方向性問題需修正';
    var iconCls = status === 'ok'   ? 'ph-check-circle'
                : status === 'warn' ? 'ph-warning'
                :                     'ph-x-circle';
    var actionHtml = (status === 'ok' || status === 'warn')
      ? '<button class="gate-transition__action" data-gate-action="proceed">繼續 <i class="ph ph-arrow-right"></i></button>'
      : '';
    var okCount = countByStatus(result.items, 'ok');
    var totalCount = result.items.length;
    var itemsHtml = (result.items || []).map(renderGateItem).join('');
    return '<div class="gate-content"><div class="gate-wrap">'
      + '<div class="gate-transition gate-transition--' + status + '">'
      +   '<i class="ph-fill ' + iconCls + ' gate-transition__icon"></i>'
      +   '<div class="gate-transition__main">'
      +     '<div class="gate-transition__title">' + escHtml(transitionTitle) + '</div>'
      +     '<div class="gate-transition__sub">' + escHtml(transitionSub) + '</div>'
      +   '</div>'
      +   actionHtml
      + '</div>'
      + '<div class="gate-section-label">逐欄位回饋 <span class="gate-section-label__count">' + okCount + ' / ' + totalCount + ' 通過</span></div>'
      + '<div class="gate-list">' + itemsHtml + '</div>'
      + '</div></div>';
  }

  function renderGateItem(item) {
    var iconName = item.status === 'ok' ? 'ph-check-circle'
                 : item.status === 'warn' ? 'ph-warning'
                 :                          'ph-x-circle';
    var suggestionHtml = item.suggestion
      ? '<div class="gate-item__suggestion"><strong>修正方向：</strong>' + escHtml(item.suggestion) + '</div>'
      : '';
    return '<div class="gate-item gate-item--' + item.status + '">'
      + '<i class="ph-fill ' + iconName + ' gate-item__icon"></i>'
      + '<div class="gate-item__main">'
      +   '<div class="gate-item__field">' + escHtml(item.field) + '</div>'
      +   '<div class="gate-item__title">' + escHtml(item.title) + '</div>'
      +   '<div class="gate-item__reason">' + escHtml(item.reason) + '</div>'
      +   suggestionHtml
      + '</div></div>';
  }

  function renderGateLoading(stepCfg) {
    return '<div class="gate-content"><div class="gate-loading">'
      + '<div class="gate-loading__spinner"></div>'
      + '<div class="gate-loading__title">正在審核框架</div>'
      + '<div class="gate-loading__sub">教練閱讀你的回答中…</div>'
      + '<ul class="gate-loading__checklist">'
      +   '<li class="is-done"><i class="ph ph-check"></i>解析欄位內容</li>'
      +   '<li class="is-active"><i class="ph ph-circle-notch"></i>對照 ' + escHtml(stepCfg.stepLetter) + ' 步重點</li>'
      +   '<li><i class="ph ph-circle"></i>檢查方向性</li>'
      +   '<li><i class="ph ph-circle"></i>整理回饋</li>'
      + '</ul></div></div>';
  }

  function renderGateError(msg) {
    return '<div class="gate-content"><div class="error-wrap">'
      + '<i class="ph ph-cloud-warning error-wrap__icon"></i>'
      + '<div class="error-wrap__title">框架審核失敗</div>'
      + '<div class="error-wrap__sub">' + escHtml(msg) + '</div>'
      + '<div class="error-wrap__code">GATE_API_ERROR</div>'
      + '<div class="error-wrap__actions">'
      +   '<button class="btn btn--primary" data-gate-action="retry">重新審核</button>'
      +   '<button class="btn btn--ghost" data-gate-action="back">返回修改</button>'
      + '</div></div></div>';
  }

  function countByStatus(items, st) { return (items || []).filter(function (i) { return i.status === st; }).length; }

  // expose for tests
  window.renderCirclesGate = renderCirclesGate;
```

- [ ] **Step 3: Add `submitFrameworkToGate()`**

Insert near existing Phase 1 submit handler (find `circlesPhase = 1.5` at ~line 2794):

Replace the lines that just set `circlesPhase = 1.5` with a call to `submitFrameworkToGate()`. Add the function definition:

```js
  async function submitFrameworkToGate() {
    var stepKey = AppState.circlesMode === 'drill'
      ? (AppState.circlesDrillStep || 'C1')
      : (['C1','I','R','C2','L','E','S'][AppState.circlesSimStep || 0] || 'C1');
    var draft = (AppState.circlesFrameworkDraft && AppState.circlesFrameworkDraft[stepKey]) || {};
    var hasContent = Object.values(draft).some(function (v) { return v && String(v).trim(); });
    if (!hasContent) {
      console.warn('[gate] empty draft — skipping submit');
      // optional: showToast (defer if helper not yet built)
      return;
    }
    AppState.circlesPhase = 1.5;
    AppState.circlesGateLoading = true;
    AppState.circlesGateResult = null;
    AppState.circlesGateError = null;
    render();
    try {
      await ensureCirclesDraftSession();
    } catch (_) {}
    var sid = AppState.circlesSession && AppState.circlesSession.id;
    if (!sid) {
      AppState.circlesGateError = '無法建立 session，請重試';
      AppState.circlesGateLoading = false;
      render();
      return;
    }
    var path = (AppState.accessToken ? '/api/circles-sessions/' : '/api/guest-circles-sessions/') + sid + '/gate';
    try {
      var res = await window.apiFetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: stepKey, frameworkDraft: draft }),
      });
      if (res.status === 401) return; // multi-tab+401 banner handles it
      if (!res.ok) {
        AppState.circlesGateError = 'Server returned ' + res.status;
        AppState.circlesGateLoading = false;
        render();
        return;
      }
      AppState.circlesGateResult = await res.json();
      AppState.circlesGateLoading = false;
      render();
    } catch (e) {
      AppState.circlesGateError = (e && e.message) || '網路錯誤';
      AppState.circlesGateLoading = false;
      render();
    }
  }
  window.submitFrameworkToGate = submitFrameworkToGate;
```

Wire Phase 1 submit click to call `submitFrameworkToGate()` instead of just setting `circlesPhase = 1.5`.

- [ ] **Step 4: Extend `render()` switch**

Find render() main view router. Add branch for `circlesPhase === 1.5`:

```js
if (AppState.view === 'circles' && AppState.circlesPhase === 1.5) {
  return renderCirclesGate();
}
```

- [ ] **Step 5: Add `bindCirclesGate()`**

```js
  function bindCirclesGate() {
    document.querySelectorAll('[data-gate-action]').forEach(function (el) {
      el.addEventListener('click', function () {
        var act = el.dataset.gateAction;
        if (act === 'proceed') {
          AppState.circlesPhase = 2;
          clearGateState();
          render();
        } else if (act === 'back') {
          AppState.circlesPhase = 1;
          clearGateState();
          render();
        } else if (act === 'retry') {
          submitFrameworkToGate();
        }
      });
    });
  }
  function clearGateState() {
    AppState.circlesGateResult = null;
    AppState.circlesGateLoading = false;
    AppState.circlesGateError = null;
  }
```

Wire `bindCirclesGate()` into post-render bind dispatch when `circlesPhase === 1.5`.

- [ ] **Step 6: Append CSS to `public/style.css`**

Append entire CSS block from mockup 04 lines 1-510 (`.gate-content`, `.gate-wrap`, `.gate-transition`, `.gate-transition--{ok,warn,error}`, `.gate-transition__icon/main/title/sub/action`, `.gate-section-label`, `.gate-list`, `.gate-item`, `.gate-item--{ok,warn,error}`, `.gate-item__icon/main/field/title/reason/suggestion`, `.gate-loading`, `.gate-loading__spinner/title/sub/checklist`, `.error-wrap`).

- [ ] **Step 7: Run all gate specs to verify GREEN**

```bash
npx playwright test --config=tests/visual/playwright.config.js --project=Desktop-1280 --project=Mobile-360 --project=iPad tests/visual/circles-gate.spec.js --reporter=line
```

Expected: 33/33 pass.

- [ ] **Step 8: Run regression sweep**

```bash
npx playwright test --config=tests/visual/playwright.config.js --project=Desktop-1280 tests/visual/restore-no-drift.spec.js tests/visual/offcanvas-item-click-restore.spec.js tests/visual/home-stats-guest.spec.js --reporter=line
```

Expected: 11 + 15 + 4 = 30 specs pass.

- [ ] **Step 9: Commit GREEN**

```bash
git add public/app.js public/style.css
git commit -m "feat(plan-b-sb10): GREEN — Phase 1.5 Gate 4 states + submit flow (mockup 04)"
```

---

## Task 3 — 8-viewport regression sweep

- [ ] **Step 1: Full 8-viewport on circles-gate**

```bash
npx playwright test --config=tests/visual/playwright.config.js --project=Mobile-360 --project=iPhone-SE --project=iPhone-14 --project=iPhone-15-Pro --project=iPad --project=Desktop-1280 --project=Desktop-1440 --project=Desktop-2560 tests/visual/circles-gate.spec.js --reporter=line
```

Expected: 88/88 pass.

- [ ] **Step 2: jest baseline**

```bash
npm test
```

Expected: 160/160.

- [ ] **Step 3: Self-review report**

Report DONE with:
- 3 commit SHAs
- Playwright 88/88 (8 vp × 11)
- jest 160/160 (unchanged — no backend touch)
- Files changed: `tests/visual/circles-gate.spec.js` (new), `public/app.js` (+~150 lines), `public/style.css` (+~250 lines)
- Confirmation that NO file outside this list touched
