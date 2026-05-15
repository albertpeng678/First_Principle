# Playwright-Skill 完整整合計畫

> **目的：** 把 testdino/playwright-skill 50+ guide 內化為「第一性原理訓練器」**所有測試 + 所有實作 workflow** 的標準綱要，取代我目前手刻的 `loginFresh()` / e2e timestamp stub / 純單元 UAT。
> **Date:** 2026-05-16
> **Author:** opus (director)
> **Status:** 等 user review

---

## 1. 為什麼這個 skill 必須整合（不只是「參考」）

過去 3 週 18 個 fix commits 的根因，skill 在 5 個地方直接點名：

| 來源 | 引文 | 對應我犯的錯 |
|---|---|---|
| `core/test-architecture.md:3` | 「**What is the cheapest test that gives me confidence this works?**」「**Smoke tests validating the entire stack is wired together**」 | jest 單元 162/162 pass，cross-device round-trip 全爆 |
| `core/common-pitfalls.md:599` Pitfall 11 | 「**All tests pass but the app is broken in production**. Mocked responses drift. **False confidence**.」 | 用 `fetch PATCH` 直接打 API，繞過 FE save layer |
| `core/third-party-integrations.md:27` | 「In E2E tests, **mock the external service, not your own application**. Your code should run as-is」 | 同上 — mock 自家 app |
| `core/flaky-tests.md` Anti-Patterns | 「**Over-mocking removes confidence that the real system works**. Tests pass but the app is broken.」 | 同上 |
| `core/test-data-management.md:1153-1158` | 「**Using production data in tests** ← Fix: Create synthetic test data. Never point test suites at production databases or use real customer identifiers.」 | **B7 污染根因：用真帳號跑 prod e2e** |

**結論：** 不是「採用 skill」，是**承認過去 workflow 違反 skill 核心原則**，重寫測試契約。

---

## 2. 10 Golden Rules → 永久 Standing Rules

升為與 `CLAUDE.md` standing rules 平級（違反 = bundle 退件）。

| # | Rule | 我們的對應做法 |
|---|---|---|
| 1 | **`getByRole()` 優先於 CSS / XPath** | 既有 spec 90% 用 `data-nav` / class selector → 漸進改寫；新 spec 強制 `getByRole`+`getByLabel`+`getByText` |
| 2 | **禁用 `page.waitForTimeout()`** | 既有 spec 大量 `waitForTimeout(2500)` 等待 login → 改 `waitForURL` / `expect(locator).toBeVisible()` |
| 3 | **Web-first assertions**（`expect(locator)` auto-retry）| 既有 `expect(await el.textContent()).toBe(...)` 全改 `expect(el).toHaveText(...)` |
| 4 | **每 test 完全 isolated** | 用 fixture API seeding + teardown 取代手動 cleanup |
| 5 | **`baseURL` 在 config，test 內零 hardcoded URL** | 既有 spec hardcode `https://first-principle.up.railway.app/` → 移到 `.env.{env}` |
| 6 | **Retries: `2` in CI, `0` locally** | playwright.config 加 `retries: process.env.CI ? 2 : 0` |
| 7 | **Traces `on-first-retry`** | 既有 trace off → 改 `on-first-retry`（或 1.59+ `retain-on-failure-and-retries`） |
| 8 | **Fixtures > globals**（`test.extend()`） | 既有 module-level `EMAIL` `PASSWORD` 常數 → 改 fixture |
| 9 | **One behavior per test** | 既有單一 test 走 25 個 verification 步驟 → 拆 |
| 10 | **只 mock 外部 service，永遠不 mock 自家 app** | E2E spec 禁用 `page.route('**/api/...', fulfill)` 對自家 endpoint；只准 mock OpenAI / Stripe / 分析 SDK |

---

## 3. workflow 每階段映射 skill guide

| Stage | 我們既有 skill / 工具 | playwright-skill 補強 / 替代 |
|---|---|---|
| **0 Triage / Repro** | playwright + `superpowers:systematic-debugging` | `playwright-cli/core-commands` + `playwright-cli/tracing-and-debugging` 抓 trace |
| **1 Root cause** | `superpowers:systematic-debugging` | `core/debugging.md`（UI mode + Inspector）+ `core/error-index.md`（具體錯誤訊息）+ `core/flaky-tests.md` |
| **2 Mockup（B5）** | `frontend-design` + `feedback_mockup_3_viewports` | `core/visual-regression.md` 定義 pixel-diff threshold（0.5%）+ baseline 路徑 |
| **3 Spec / Brainstorm** | `superpowers:brainstorming` + visual companion | （流程不變，但 acceptance criteria 必涵蓋 e2e round-trip） |
| **4 Plan** | `superpowers:writing-plans` | `core/test-architecture.md` 決定每個 task 屬 E2E / Component / API 哪層；`core/test-organization.md` 決定 spec 放哪 |
| **5 Implement** | `superpowers:subagent-driven-development` + `superpowers:test-driven-development` + Karpathy 4 條 | implementer 必先讀 `core/locators.md` `core/assertions-and-waiting.md` `core/fixtures-and-hooks.md`；TDD 紅燈 spec 必符合 10 Golden Rules |
| **6 測試契約**（新階段）| —（過去沒這層） | **`core/test-data-management.md`** API seeding + factory + faker + cleanup；**`core/authentication.md`** storage state；**`ci/global-setup-teardown.md`** afterAll DELETE；**`core/multi-context-and-popups.md`** dual-context 跨裝置；**`core/mobile-and-responsive.md`** 8 viewport device emulation |
| **7 Review** | `superpowers:requesting-code-review` 2-stage | spec reviewer 對 `pom/pom-vs-fixtures-vs-helpers.md` decision；code quality reviewer 查 anti-pattern checklist |
| **8 UAT** | playwright × 8 vp + `superpowers:verification-before-completion` | trace `retain-on-failure-and-retries`（1.59+）→ flaky 自動暴露；`core/visual-regression.md` pixel-diff master |
| **9 Ship** | `superpowers:finishing-a-development-branch` | （流程不變，但 push 前必跑 burn-in `--repeat-each=10` 對該 PR 改的 spec） |
| **跨切：CI** | manual jest + playwright | `ci/ci-github-actions.md` workflow；`ci/parallel-and-sharding.md` × 4 worker；`ci/reporting-and-artifacts.md` HTML report + trace upload |
| **跨切：iOS Safari 15-item** | `feedback_ios_review_before_ship` | `core/mobile-and-responsive.md` 補 device emulation + WebKit project |
| **跨切：對抗測試** | `feedback_adversarial_review_testing` | `core/test-data-management.md` faker realistic data + `expect.poll()` 對 SSE/AI 終態 |

---

## 4. 新測試契約（取代既有 timestamp stub）

### 4.1 檔案結構（新）

```
tests/
├── fixtures/
│   ├── index.js            # mergeTests({ auth, apiData })
│   ├── auth.fixture.js     # storage state + per-worker scope
│   └── api-data.fixture.js # API seeding NSM/CIRCLES session + auto-teardown
├── factories/
│   ├── nsm-session.factory.js     # 真實長度中文 + 4 dim breakdown
│   ├── circles-step.factory.js    # 7 step framework_draft
│   └── user-typed-strings.js      # ≥30 字 fixture pool（fakerwithlocale='zh_TW')
├── page-objects/
│   ├── LoginPage.js
│   ├── NsmStep1Page.js / NsmStep2Page.js / ...
│   └── CirclesDrillPage.js / CirclesSimulationPage.js
├── e2e/                    # 跨頁 critical paths
│   ├── cross-device-sync.spec.js   # B2 dual-context 真實 round-trip
│   ├── gate-validation.spec.js     # B1 全 Y 必擋
│   ├── delete-and-cache.spec.js    # B4 DELETE → GET 驗 cache
│   ├── phase3-loading.spec.js      # B3 loading 終態
│   ├── skip-gate-race.spec.js      # B6 race repro × repeat-each=20
│   └── onboarding-tooltip.spec.js  # carry over
├── api/                    # 純後端契約（不開 browser）
│   ├── nsm-progress.spec.js
│   └── circles-progress.spec.js
└── visual/                 # mockup ↔ production pixel-diff
    └── mockup-vs-prod.spec.js
```

### 4.2 .env 環境隔離

```
.env.local       # BASE_URL=http://localhost:3000  TEST_EMAIL=e2e-local@example.com
.env.test        # BASE_URL=http://localhost:3000  TEST_EMAIL=e2e@first-principle.test
.env.prod-uat    # BASE_URL=https://first-principle.up.railway.app/  TEST_EMAIL=e2e@first-principle.test
                 # ALLOW_PROD_TEST=1（明示 opt-in，缺則 spec assert 失敗）
```

`.env.*` 全進 `.gitignore`，creds 由 user 一次性建立 + 給我 `.env.test` 內容。

### 4.3 帳號 + cleanup 雙保險

1. **獨立 test 帳號** `e2e@first-principle.test`（不是 user 真帳號）
2. **`assertNotProdAccount()` helper**：偵測 BASE_URL contains `railway.app` + email 是 user 真帳號 → throw（強制 fail）
3. **`afterAll` cleanup hook**：DELETE all sessions created during spec via `apiContext.delete`
4. **Global teardown**：`ci/global-setup-teardown.md` pattern — 全域 sweep `e2e-*` prefix
5. **Fixture teardown**：`core/test-data-management.md` API seeding pattern — 每個 fixture 有自己的 cleanup

### 4.4 Acceptance criteria 升級

每個 bug fix task **完工標準**從「unit test green」升為三件套：

```
✅ API contract test pass    (tests/api/*.spec.js)
✅ E2E user journey pass     (tests/e2e/*.spec.js) — 真實人寫的 fixture，走完整 UI
✅ Visual pixel-diff < 0.5%  (tests/visual/*.spec.js) — 8 vp × mockup
```

三者缺一不能 ship。

---

## 5. 8 Bug 各自對應 skill pattern

| Bug | 主要 guide | 次要 guide | 新 spec 路徑 |
|---|---|---|---|
| **B1** 全 Y 過 Gate | `core/forms-and-validation.md` — semantic validation testing | `core/assertions-and-waiting.md` web-first | `tests/e2e/gate-validation.spec.js` |
| **B2** 對話練習憑空有內容 | `core/multi-context-and-popups.md` — dual-context for cross-device | `core/test-data-management.md` API seeding | `tests/e2e/cross-device-sync.spec.js` |
| **B3** loading 卡 | `core/flaky-tests.md` — `expect.poll()` + `toPass()` | `core/websockets-and-realtime.md`（SSE 等同 WebSocket）+ `playwright-cli/tracing-and-debugging.md` | `tests/e2e/phase3-loading.spec.js` |
| **B4** offcanvas cache | `core/api-testing.md` DELETE→GET round-trip | `core/network-mocking.md`（如需 mock external） | `tests/api/circles-progress.spec.js` + `tests/e2e/delete-and-cache.spec.js` |
| **B5** UI 不符 mockup | `core/visual-regression.md` mockup ↔ production pixel-diff | `core/mobile-and-responsive.md` 8 vp | `tests/visual/mockup-vs-prod.spec.js` |
| **B6** 跳 Gate race | `core/flaky-tests.md` Strategy 1 `--repeat-each=20` burn-in | `core/multi-context-and-popups.md` dual-context | `tests/e2e/skip-gate-race.spec.js` |
| **B7** prod 污染 | `core/test-data-management.md` § Anti-Pattern「Using production data in tests」 | `ci/global-setup-teardown.md` cleanup hook | （無新 spec — 改既有 spec 結構 + audit report） |
| **B8** 方法論 | `core/test-data-management.md` factory + faker | `core/authentication.md` storage state | （所有新 spec 都套此 pattern） |

---

## 6. 預防機制（B7+B8 制度修正 — STANDING 永久）

### 6.1 環境守門 helper

```js
// tests/helpers/env-guard.js
function assertNotProdWithRealAccount(email) {
  const baseURL = process.env.BASE_URL || '';
  if (baseURL.includes('railway.app') && !email.endsWith('@first-principle.test')) {
    throw new Error(
      `BLOCKED: e2e spec hitting prod with non-test account "${email}". ` +
      `Either set BASE_URL to local OR use TEST_EMAIL ending in @first-principle.test`
    );
  }
}
module.exports = { assertNotProdWithRealAccount };
```

每個 e2e spec `beforeAll` 必 call。

### 6.2 Auto fixture：cleanup tracker

```js
// tests/fixtures/auto-cleanup.fixture.js
const test = base.extend({
  cleanupTracker: [async ({ request }, use) => {
    const created = [];
    await use({ track: (kind, id) => created.push({ kind, id }) });
    for (const { kind, id } of created) {
      await request.delete(`/api/${kind}-sessions/${id}`).catch(() => {});
    }
  }, { auto: true }],
});
```

任何 spec 創 session 必 `cleanupTracker.track('nsm', sessionId)` — 確保 spec crash 也清。

### 6.3 Pre-commit hook 補強

`.husky/pre-commit` 加：

```bash
# Block hardcoded prod URL in test specs
if git diff --cached --name-only | grep -E "^tests/.*\.(spec|test)\.js$" | xargs grep -l "railway.app" 2>/dev/null; then
  echo "ERROR: hardcoded prod URL in spec file. Use BASE_URL env var."
  exit 1
fi

# Block hardcoded user real email in test specs
if git diff --cached --name-only | grep -E "^tests/.*\.(spec|test)\.js$" | xargs grep -l "albertpeng678@gmail.com" 2>/dev/null; then
  echo "ERROR: hardcoded real account in spec. Use TEST_EMAIL env var."
  exit 1
fi
```

---

## 7. Anti-pattern checklist（給 implementer + reviewer）

每個 spec PR review 必 走完這 14 條（任一勾不掉 = 退件）：

- [ ] 無 `page.waitForTimeout()`（除非 trace 證明 race）
- [ ] 無 hardcoded URL（用 baseURL）
- [ ] 無 hardcoded 真帳號 email
- [ ] 無 `page.route('**/api/...自家 endpoint`')` mock
- [ ] 無 `expect(await ...textContent())` —改 `expect(locator).toHaveText()`
- [ ] 無 module-level mutable state
- [ ] 無 shared user account across parallel workers
- [ ] 無 try/catch swallow expect failures
- [ ] 無 `test.fixme` without ticket reference
- [ ] 無 cleanup-less data creation
- [ ] 無 hardcoded session ID
- [ ] 無 fixture 做超過 1 件事
- [ ] 無 `--retries` 用來掩蓋 flake（要 fix root cause）
- [ ] 無 `networkidle` 等待自家 endpoint

---

## 8. playwright.config 更新（重寫）

```js
// playwright.config.js — flake-resistant
const { defineConfig, devices } = require('@playwright/test');
const dotenv = require('dotenv');
const path = require('path');

const envFile = process.env.TEST_ENV || 'local';
dotenv.config({ path: path.resolve(__dirname, `.env.${envFile}`) });

module.exports = defineConfig({
  globalSetup: require.resolve('./tests/global-setup.js'),
  globalTeardown: require.resolve('./tests/global-teardown.js'),
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    trace: process.env.CI ? 'retain-on-failure-and-retries' : 'on-first-retry',
    contextOptions: { reducedMotion: 'reduce' },
    storageState: '.auth/user.json',  // 由 auth.setup 產
  },
  projects: [
    { name: 'auth-setup', testMatch: /auth\.setup\.js/ },
    { name: 'Mobile-360',     dependencies: ['auth-setup'], use: { ...devices['Pixel 5'], viewport: { width: 360, height: 800 } } },
    { name: 'iPhone-SE',      dependencies: ['auth-setup'], use: { ...devices['iPhone SE'] } },
    { name: 'iPhone-14',      dependencies: ['auth-setup'], use: { ...devices['iPhone 14'] } },
    { name: 'iPhone-15-Pro',  dependencies: ['auth-setup'], use: { ...devices['iPhone 15 Pro'] } },
    { name: 'iPad',           dependencies: ['auth-setup'], use: { ...devices['iPad (gen 7)'] } },
    { name: 'Desktop-1280',   dependencies: ['auth-setup'], use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
    { name: 'Desktop-1440',   dependencies: ['auth-setup'], use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'Desktop-2560',   dependencies: ['auth-setup'], use: { ...devices['Desktop Chrome'], viewport: { width: 2560, height: 1440 } } },
    { name: 'WebKit',         dependencies: ['auth-setup'], use: { ...devices['Desktop Safari'] } },
  ],
});
```

---

## 9. 對既有 standing memory 的影響

| 既有 memory | 動作 | 變更 |
|---|---|---|
| `feedback_full_sit_uat_uiux.md` | **更新** | 加「e2e round-trip + visual pixel-diff 三件套」為 ship gate |
| `feedback_test_all_devices_visual.md` | **更新** | 補 device emulation 用 Playwright `devices[]` 標準 |
| `feedback_adversarial_review_testing.md` | **保留** | + 加「`expect.poll()` for SSE/AI 終態」做法 |
| `reference_playwright_skill_testing_bible.md` | **已建立** | 已存 |
| `feedback_discipline_enforcement.md` | **更新** | 加 14 條 anti-pattern checklist |
| `feedback_two_stage_review_mandatory.md` | **保留** | code quality reviewer 必查 anti-pattern checklist |

新增 1 條 memory：

- `feedback_e2e_real_data_only.md` — STANDING：禁 stub timestamp string、禁 mock 自家 API、禁 prod URL + 真帳號

---

## 10. 短期不導入（YAGNI）

以下 skill guide **目前不導入**，未來需求出現再評估：

- `core/canvas-and-webgl.md` — 沒 canvas / WebGL
- `core/electron-testing.md` — 沒桌面 app
- `core/browser-extensions.md` — 沒 extension
- `core/i18n-and-localization.md` — 單一語言 zh-TW
- `core/component-testing.md` 的 `@playwright/experimental-ct-*` — 我們無 framework 純 vanilla JS，不需 mount
- `migration/from-cypress.md` / `from-selenium.md` — 沒既有 Cypress / Selenium 要遷
- `core/auth-flows.md` 的 Auth0 / Okta / Firebase 部分 — 我們用 Supabase
- `core/clock-and-time-mocking.md` — 暫沒時間敏感邏輯
- `core/security-testing.md` — 已有 security-review skill 接這塊

---

## 11. 落地節奏建議

| Phase | 範圍 | 預估 |
|---|---|---|
| **Phase 0** | B7 cleanup + 環境隔離 setup + .env.test + assertNotProd helper | 1 session |
| **Phase 1** | playwright.config 重寫 + auth setup project + 既有 spec 抽 fixture | 1 session |
| **Phase 2** | 寫 8-bug fix 的 TDD 紅燈 spec（用新 contract）→ 紅 → 寫 fix → 綠 | 2-3 sessions |
| **Phase 3** | 既有 spec 漸進改寫到 10 Golden Rules（不一次性改全部） | 3-5 sessions（背景跑）|
| **Phase 4** | CI workflow 加上（GitHub Actions + sharding） | 1 session |

---

## 12. 結論

**整合不是「採用工具」是「承認過去測試策略違反第一原則」並重寫契約。**
過去 18 個 fix commits 跟 7 輪 UAT 的核心症狀（false confidence、prod 污染、cross-device round-trip 全爆）skill 已**逐條點名**對應原則和反 anti-pattern。

**Plan 終點：**
- 8 bug 全部走完新契約 ship
- 之後任何新 feature / bug 都走相同 pipeline
- 不再有「unit test 全綠 + prod 全爆」的 false confidence
