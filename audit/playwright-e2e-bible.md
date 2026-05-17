# Playwright E2E Integration Testing Bible

> **Deep extract** from 24 playwright-skill core md files (~23k lines total) → distilled patterns + load-bearing code + line refs for instant reference.
> **Read this whenever 寫 spec / dispatch sonnet / cold-Review test code**.
> Per 首要綱領「所有修復必過 e2e 整合測試」.
>
> **Source**: `/Users/albertpeng/.claude/skills/playwright-skill/core/`
> **Last updated**: 2026-05-17

---

## §0 Quick Decision Tree

| 場景 | Section | Source md |
|---|---|---|
| 開新 spec | §1 + §2 + §3 + §15 | test-architecture / test-organization / fixtures-and-hooks |
| 寫 assert | §4 | assertions-and-waiting |
| Auth + token | §5 | auth-flows / authentication |
| Real Supabase seed | §6 | api-testing |
| 503 / timeout simulate | §7 | network-mocking |
| Visual snapshot | §8 | visual-regression |
| Cross-tab / multi-user | §9 | multi-user-and-collaboration |
| iOS Safari / mobile | §10 | mobile-and-responsive |
| Locator (avoid CSS chain) | §11 | locator-strategy / locators |
| Flake diagnose | §12 | flaky-tests / debugging |
| Time / clock mock | §13 | clock-and-time-mocking |
| When NOT to mock | §14 | when-to-mock |
| All 20 Pitfalls 排除 | §16 | common-pitfalls |
| Accessibility a11y | §17 | accessibility |
| CRUD pattern | §18 | crud-testing |
| Test data factory | §19 | test-data-management |
| Error / edge / 5xx | §20 | error-and-edge-cases |
| Performance | §21 | performance-testing |
| Security | §22 | security-testing |

---

## §1 Testing Trophy（test-architecture.md, 569 lines）

Kent C. Dodds Testing Trophy 分佈：

```
       🏆 Static (lint + type)  ← 5%
        ↓
       Unit (pure logic)         ← 5%
        ↓
       Integration / API         ← 60% target ★
        ↓
       E2E (full browser)        ← 10% target ★
        ↓
       Manual / Exploratory     ← 20%
```

**為什麼 API/Integration > E2E**：
- E2E 慢 + flake 高 + setup 複雜
- API/Integration 快 + 可靠 + 覆蓋 backend contract
- 真實 user bug 80% 在 contract / state mgmt，可用 API test 抓

**Path 2 現況**：95 E2E vs 18 API（trophy-inverted），漸進改善中。

---

## §2 Test Organization（test-organization.md, 946 lines）

### 大專案 layout（200+ specs）
```
tests/
├── api/              # 60% — real backend contract tests
│   ├── fixtures/     # api-cleanup, helpers
│   ├── helpers/      # getE2eToken, etc
│   ├── playwright.config.js
│   └── *-contract.spec.js
├── e2e/              # 10% — critical-path full browser
│   ├── playwright.config.js
│   └── *.spec.js
├── visual/           # 30% — pixel-diff snapshots
│   ├── playwright.config.js
│   └── *.spec.js
├── unit/             # pure logic
├── adversarial/      # AI prompt quality (carve-out)
└── setup/            # auth.setup.js
```

**Naming**: `<feature>-<scenario>-<approach>.spec.js`（e.g. `circles-back-nav-lock.spec.js`, `circles-gate-await-patch-real.spec.js`）

**Spec file structure**：
```js
// File header (always):
// - Skill citations: <md>:line-range "Pattern Name"
// - REAL-DATA DISCIPLINE notes
// - test.use({ storageState })
// - require helpers / fixtures
// - describe groups by feature
// - test.step() per phase
```

---

## §3 Fixtures + Hooks（fixtures-and-hooks.md, 1014 lines）

### Auto-cleanup fixture pattern (lines 19-60)
```js
const base = require('@playwright/test').test;
const test = base.extend({
  cleanupTracker: async ({}, use) => {
    const tracker = { circles: [], nsm: [] };
    await use(tracker);
    // Teardown
    for (const id of tracker.circles) {
      await deleteCirclesSession(id).catch(() => {});
    }
  },
});
module.exports = { test };
```

### `before`/`after` semantics (lines 110-175)
- `test.beforeAll`: 1× per worker — for token cache warm-up, NOT for per-test setup
- `test.beforeEach`: per test — heavy isolation
- `test.afterEach`: cleanup local state
- `test.afterAll`: clearTokenCache, close connections

### Anti-pattern
- ❌ `beforeAll` to seed shared session — workers race
- ✅ Per-test seed via factory + cleanup fixture

---

## §4 Assertions + Waiting（assertions-and-waiting.md, 661 lines）

### 鐵則：禁 hard sleep
- ❌ `await page.waitForTimeout(5000)` — flaky guarantee
- ✅ `await expect(locator).toBeVisible({ timeout: 15000 })` — web-first auto-retry
- ✅ `await expect.poll(() => fetchSomething()).toBe(expected)`

### Web-first assertions（auto-retry）
```js
await expect(page.getByRole('button')).toHaveText('Submit');
await expect(page.locator('[data-state]')).toHaveAttribute('aria-disabled', 'true');
await expect(page.locator('.card')).toHaveCount(4);
await expect(page.locator('[data-loading]')).not.toBeVisible({ timeout: 30000 });
```

### Waiting for network
```js
await page.waitForResponse((r) =>
  /\/api\/circles-sessions\/.+\/gate$/.test(r.url())
    && r.request().method() === 'POST'
    && r.status() === 200,
  { timeout: 60_000 }
);
```

### Poll for DB state
```js
await expect.poll(async () => {
  const row = await request.get(`/api/circles-sessions/${sid}`).then(r => r.json());
  return row.step_scores?.C1?.totalScore;
}, { timeout: 30000, intervals: [500, 1000, 2000] }).toBeGreaterThan(0);
```

---

## §5 Auth Flows + Authentication（auth-flows.md 1030 lines + authentication.md 1409 lines）

### Pattern 1: storageState setup once（auth-flows.md:928-949）
```js
// tests/setup/auth.setup.js
const { test: setup } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const AUTH_FILE = path.join('playwright', '.auth', 'user.json');

setup('authenticate', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '登入' }).click();
  await page.fill('#auth-email', 'e2e@first-principle.test');
  await page.fill('#auth-pw', process.env.TEST_PASSWORD);
  await page.click('#auth-submit');
  await expect(page.getByRole('button', { name: /登出/ })).toBeVisible();
  // Atomic rename (avoid race with downstream workers reading storageState)
  const tempFile = AUTH_FILE + '.tmp';
  await page.context().storageState({ path: tempFile });
  fs.renameSync(tempFile, AUTH_FILE);
});
```

### Pattern 2: API seed auth (faster, no UI)（auth-flows.md:928-949）
```js
// In every spec:
test.use({ storageState: 'playwright/.auth/user.json' });

// Then inside test:
const session = await page.evaluate(() =>
  window.apiFetch('/api/circles-sessions/draft', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question_id: 'circles_001' }),
  })
);
// AppState.accessToken 自動帶 Bearer
```

### Pattern 3: Per-worker scope（authentication.md:238-267）
```js
// For parallel suite where each worker needs own user:
const test = base.extend({
  storageState: [async ({}, use) => {
    const stateFile = `playwright/.auth/worker-${test.info().workerIndex}.json`;
    if (!fs.existsSync(stateFile)) {
      await seedNewUserAndSave(stateFile);
    }
    await use(stateFile);
  }, { scope: 'worker' }],
});
```

### Token expiry mid-flow
```js
// Simulate expired JWT mid-test:
await page.context().clearCookies();
await page.evaluate(() => localStorage.removeItem('sb-...-auth-token'));
// → next request should 401 → redirect
```

### Guest mode
```js
const guestId = crypto.randomUUID();
await page.evaluate((id) => {
  localStorage.setItem('guestId', id);
}, guestId);
// API calls send X-Guest-ID header
```

---

## §6 API Testing（api-testing.md, 1617 lines）

### Real backend contract tests
```js
const { test, expect } = require('@playwright/test');
const { getE2eToken } = require('./helpers/auth');

test('GET /api/circles-sessions — F-N-005', async ({ request }) => {
  const token = await getE2eToken();
  const res = await request.get(`${BASE_URL}/api/circles-sessions`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(res.status()).toBe(200);
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  expect(Array.isArray(body)).toBe(true);
  for (const row of body) {
    expect(row).toMatchObject({
      id: expect.any(String),
      question_id: expect.any(String),
      lifecycle: expect.any(String),
    });
  }
});
```

### Data seeding via service-role（783-848 — Pitfall 11 carve-out）
```js
const { createClient } = require('@supabase/supabase-js');
const admin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

// Seed test state without going through OpenAI:
await admin.from('circles_sessions').update({
  step_scores: { C1: { totalScore: 75, ... } },
  current_phase: 3,
}).eq('id', sessionId);
```
**Why carve-out**: writing fixture row != mocking API. Real GET reads same DB row through real `requireAuth` middleware.

### Error response testing（1023-1166）
```js
// Status first, then body shape
expect(res.status()).toBe(422);
const body = await res.json();
expect(body).toMatchObject({
  error: 'step_already_scored',
  stepKey: 'C1',
});
expect(body.message).toContain('cannot');
```

### Schema validation Option B (no Zod)（903-1021）
```js
expect(row).toMatchObject({
  id: expect.any(String),
  created_at: expect.any(String),
  status: expect.any(String),
});
expect(['active', 'completed', 'archived']).toContain(row.status);
expect(new Date(row.created_at).toString()).not.toBe('Invalid Date');
```

### List response patterns（496-565）
```js
expect(res.status()).toBe(200);
expect(res.ok()).toBeTruthy();
const body = await res.json();
expect(Array.isArray(body)).toBe(true);
// Every item conforms:
for (const item of body) assertItemShape(item);
```

---

## §7 Network Mocking（network-mocking.md, 1329 lines）

### Intermittent failure pattern（839-933）
```js
let attempts = 0;
await page.route('**/api/circles-sessions/draft', async (route) => {
  if (route.request().method() !== 'POST') return route.continue();
  attempts++;
  if (attempts === 1) {
    // 1st attempt fault
    return route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Service Unavailable' }),
    });
  }
  // 2nd onward → real backend
  return route.continue();
});

// Trigger action
await page.locator('[data-action]').click();

// Verify retry happened
expect(attempts).toBe(2);
```

### Counter assertion for "never re-fired"
```js
let callCount = 0;
await page.route('**/evaluate-step', async (route) => {
  callCount++;
  await route.continue();
});
// ...run test...
expect(callCount).toBe(1); // 防 re-trigger
```

### Cleanup mid-test
```js
await page.unrouteAll({ behavior: 'ignoreErrors' });
```

### Sustained 503 (exhaust retries)
```js
await page.route('**/api/circles-sessions/draft', (route) => {
  return route.fulfill({ status: 503, body: JSON.stringify({ error: 'down' }) });
});
// Test that retry exhausts + UI shows error banner
await expect(page.locator('[data-error]')).toBeVisible();
```

### Carve-out boundary
- ✅ Error sim (503/timeout/abort) — production 真實 5xx 場景無法 reproduce
- ❌ Success path mock — defeats e2e purpose
- ✅ Third-party (OpenAI, Stripe) — cost/quota/non-deterministic
- ✅ Boot empty-list stub — bypass first-run history pollution

---

## §8 Visual Regression（visual-regression.md, 1006 lines）

### Basic snapshot
```js
await expect(page.locator('[data-phase1]')).toHaveScreenshot(
  `phase1-locked-${test.info().project.name}.png`,
  { maxDiffPixelRatio: 0.005 } // 0.5% threshold
);
```

### Snapshot generation
```bash
npx playwright test --update-snapshots
# Baselines auto-generated in <spec>.spec.js-snapshots/
```

### Per-project baselines
- File naming: `<name>-<project>-darwin.png`
- 3 e2e projects + 3 desktop visual projects = 6 baseline per state

### Full-page vs element
- `page.screenshot({ fullPage: true })` — whole viewport
- `locator.toHaveScreenshot()` — just element bbox + padding

### Dynamic content masking
```js
await expect(page).toHaveScreenshot({
  mask: [page.locator('[data-timestamp]')], // ignore changing parts
});
```

### Director cold-Read mandate（STANDING `feedback_uiux_visual_only`）
Sonnet self-Read 不算數。Director 親 Read 每張 PNG ≥ 1 句評論，寫入 `audit/eyeball-{name}.md`。

---

## §9 Multi-User + Cross-tab（multi-user-and-collaboration.md, 477 lines）

### Two-tab cache invalidation (27-58)
```js
const ctxA = await browser.newContext({ storageState });
const ctxB = await browser.newContext({ storageState });
const pageA = await ctxA.newPage();
const pageB = await ctxB.newPage();

await pageA.goto('/');
await pageB.goto('/');

// Tab A delete
await pageA.locator('[data-delete]').click();

// Tab B reload + assert item gone
await pageB.reload();
await expect(pageB.locator('[data-item="' + id + '"]')).not.toBeVisible();
```

### Race assertion (306-343)
```js
const [r1, r2] = await Promise.all([
  page1.evaluate(() => window.apiFetch('/api/circles-sessions/:id/gate', { method: 'POST' })),
  page2.evaluate(() => window.apiFetch('/api/circles-sessions/:id/gate', { method: 'POST' })),
]);
// Mutex behavior: only 1 should succeed; other gets 409 or queued
expect([r1.status, r2.status].sort()).toEqual([200, 409]);
```

### Storage event propagation
```js
// Tab A writes to localStorage
await pageA.evaluate(() => localStorage.setItem('circlesStale', 'true'));
// Tab B detects via storage event → stale banner appears
await expect(pageB.locator('.stale-banner')).toBeVisible();
```

---

## §10 Mobile + Responsive（mobile-and-responsive.md, 1669 lines）

### Device profiles (49-71)
```js
// playwright.config.js
projects: [
  { name: 'e2e-desktop', use: { ...devices['Desktop Chrome'] } },
  { name: 'e2e-mobile-chrome', use: { ...devices['Pixel 5'] } },
  { name: 'e2e-mobile-safari', use: { ...devices['iPhone 14'] } }, // WebKit!
]
```

### Touch + tap (279-322)
```js
// .tap() requires hasTouch:true (device profile sets it)
await page.locator('[data-action]').tap();
// vs .click() which works without touch
```

### Viewport-specific tests
```js
test.skip(testInfo.project.name.includes('mobile'), 'desktop-only feature');
test.skip(!testInfo.project.name.includes('mobile'), 'mobile-only feature');
```

### iOS Safari quirks（per Master Spec §0.2 15-item checklist）
- focus / blur events differ
- safe-area-inset-bottom
- position:sticky in flex container
- ReadableStream cancel on navigation
- :active state on touch
- 100vh ≠ visual viewport
- WebKit storage events delay

### WebKit-only bugs（如 Bug 7 iOS Safari Phase 3 restore P0-#263）
Mobile-safari project 抓 desktop + mobile-chrome 都過、唯獨 WebKit 失敗的 timing race。

---

## §11 Locator Strategy（locator-strategy.md 586 + locators.md 713）

### Priority order
1. **role-based** — `page.getByRole('button', { name: '登入' })`
2. **label** — `page.getByLabel('Email')`
3. **placeholder** — `page.getByPlaceholder('your@email.com')`
4. **test-id** — `page.getByTestId('submit-btn')`
5. **data attr** — `page.locator('[data-phase2="back"]')`（prod 設計用 data-* OK）
6. **CSS chain** — ❌ 最後手段
7. **xpath / coords** — ❌ 禁

### Strict mode
```js
const btn = page.getByRole('button', { name: 'Submit' });
// Throws if multiple match — explicit .first() / .nth() / better selector
```

### Chaining
```js
await page.locator('.qchip-expand').locator('[data-action="collapse"]').click();
// vs hidden CSS chain — 易讀 + 容錯
```

### Negative
```js
await expect(page.getByRole('button', { name: '提交' })).toBeHidden();
await expect(page.locator('[data-error]')).toHaveCount(0);
```

---

## §12 Flaky Tests + Debugging（flaky-tests.md 860 + debugging.md 756）

### Flake taxonomy
1. **Time race** — fix via `expect.poll` / `waitForResponse` / `waitForFunction`
2. **Order dependency** — fix via per-test seed + cleanup
3. **Test data collision** — per-test/project unique question_id, drill_step
4. **Network nondeterminism** — mock error states / retry retry
5. **Element mount timing** — wait for visible before interact

### 5x consecutive 0 flake gate
```bash
for i in 1 2 3 4 5; do
  echo "=== Run $i ==="
  npx playwright test --config tests/e2e/playwright.config.js [spec] --reporter=list 2>&1 | tail -10
done
```
任 1 flake → diagnose root cause（不 retry hack）。

### Debug tools
```bash
npx playwright test --debug         # step-through
npx playwright test --headed        # browser visible
npx playwright test --trace on      # record trace
npx playwright show-trace trace.zip # view trace
```

### Trace viewer
- DOM snapshots per step
- Network log
- Console log
- Screenshots
- Action timing

### Error context
- `test-results/<spec>/error-context.md` — auto-generated on fail
- `test-results/<spec>/test-failed-1.png` — failure screenshot

---

## §13 Clock + Time Mocking（clock-and-time-mocking.md, 427 lines）

### Mock Date.now
```js
await page.clock.install({ time: new Date('2026-05-17T12:00:00Z') });
await page.clock.fastForward('5m');
```

### Test time-dependent UI
```js
// 60s checkpoint stuck recovery
await admin.from('nsm_sessions').update({
  progress_json: {
    evaluating: true,
    evaluating_started_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
  },
}).eq('id', sid);
// → FE detects 5-min-old checkpoint → recovery banner
```

### Avoid Date.now stub
```js
// ❌ jest.fn().mockReturnValue(123)
// ✅ admin.from().update({ created_at: realISOTimestamp })
```

---

## §14 When to Mock — Decision Tree（when-to-mock.md, 827 lines）

| Scenario | Mock? | Why |
|---|---|---|
| Own backend success | ❌ NO | Real backend or no test value |
| Own backend error (503/timeout) | ✅ OK | Real 5xx hard to reproduce |
| OpenAI / 3rd-party paid API | ✅ OK | Cost / quota / non-deterministic |
| Auth login API | ❌ NO | Use real test DB user |
| Database | ❌ NO | Real test DB + service-role seed |
| Time / clock | ✅ OK | Reproducible time-dependent UI |
| File system | Depends | Read-only OK; write may need real |
| WebSockets | ❌ NO usually | Real WS server unless flaky |
| Email send | ✅ OK | Don't actually send |
| Geolocation | ✅ OK | `context.setGeolocation()` |
| Network offline | ✅ OK | `context.setOffline(true)` |

### Real Service Strategies
- Local test DB clone（this project: Supabase test instance）
- Docker compose for full stack
- Test-mode third-party (Stripe test keys)

---

## §15 CRUD Testing（crud-testing.md, 945 lines）

### Standard CRUD spec template
```js
test.describe('Sessions CRUD', () => {
  test('CREATE — POST returns 201 + id', async ({ request, cleanupTracker }) => {
    const res = await request.post('/api/...', { data: {...} });
    expect(res.status()).toBe(201);
    const { id } = await res.json();
    cleanupTracker.track('sessions', id);
  });

  test('READ — GET by id returns row', async ({ request, cleanupTracker }) => {
    const id = await seedSession(request, cleanupTracker);
    const res = await request.get(`/api/.../${id}`);
    expect(res.status()).toBe(200);
  });

  test('UPDATE — PATCH partial succeeds + row reflects', async ({ ... }) => { ... });

  test('DELETE — DELETE returns 204 + row absent', async ({ ... }) => {
    await request.delete(`/api/.../${id}`);
    expect((await request.get(`/api/.../${id}`)).status()).toBe(404);
  });
});
```

### List filter
```js
const res = await request.get('/api/sessions?status=archived&limit=50');
const list = await res.json();
expect(list.every(r => r.status === 'archived')).toBe(true);
```

### Idempotency
- Same payload submitted twice → same id (no duplicate row)
- Test by issuing 2 POST + verify 1 row

---

## §16 Test Data Management（test-data-management.md, 1209 lines）

### Factory pattern
```js
// tests/api/factories/session.factory.js
function quality(overrides = {}) {
  return {
    questionId: 'circles_001',
    mode: 'drill',
    drill_step: 'C1',
    framework: {
      C1: {
        問題範圍: '提升 Spotify Podcast 用戶週活躍率',
        ...
      },
    },
    ...overrides,
  };
}
module.exports = { quality };
```

### Per-project unique data
```js
// Prevent cross-project DB collision
function projectQuestionBase(testInfo) {
  const map = { 'e2e-desktop': 'circles_011', 'e2e-mobile-chrome': 'circles_012', 'e2e-mobile-safari': 'circles_013' };
  return map[testInfo.project.name];
}
```

### Cleanup tracker
```js
const tracker = { sessions: [] };
// Each test:
tracker.sessions.push(sid);
// Fixture afterAll:
for (const id of tracker.sessions) await deleteSession(id);
```

### Avoid stub timestamps
- ❌ `created_at: '1234567890'` — defeats real time logic
- ✅ Use real `Date.now().toISOString()` or service-role with real DB default

---

## §17 Error + Edge Cases（error-and-edge-cases.md, 1137 lines）

### Network error simulation
```js
// Total network failure
await page.context().setOffline(true);
// Test offline banner / queue
```

### 4xx / 5xx response
```js
await page.route('**/api/...', (route) => route.fulfill({ status: 500 }));
await expect(page.locator('[data-error="500"]')).toBeVisible();
```

### Browser back / forward
```js
await page.goBack();
await page.goForward();
```

### Tab close mid-action
```js
const page2 = await context.newPage();
await page2.goto('/');
await page2.locator('[data-submit]').click();
await page2.close(); // mid-flight
// Verify other tab handles gracefully
```

### Memory exhaustion / large payload
```js
await page.route('**/api/...', (route) => route.fulfill({
  body: 'x'.repeat(10_000_000), // 10MB
}));
```

---

## §18 Accessibility（accessibility.md, 1473 lines）

### aria attributes
```js
await expect(page.getByRole('button', { name: '重新評分' })).toHaveAttribute('aria-disabled', 'true');
await expect(page.getByRole('textbox', { name: 'Email' })).toHaveAttribute('required', '');
```

### Keyboard navigation
```js
await page.keyboard.press('Tab');
await page.keyboard.press('Enter');
```

### Screen-reader友善
- 所有 button 有 name（via text content or aria-label）
- 所有 input 有 label
- focus indicator 不可隱藏

### Color contrast
- Manual check or axe-core integration
- Path 2 mockup-as-spec 提供 design tokens 保證對比度

---

## §19 Performance Testing（performance-testing.md, 608 lines）

### LCP / FCP / TTI
```js
const metrics = await page.evaluate(() => ({
  fcp: performance.getEntriesByName('first-contentful-paint')[0]?.startTime,
  lcp: performance.getEntriesByType('largest-contentful-paint').pop()?.startTime,
}));
expect(metrics.lcp).toBeLessThan(2500);
```

### SSE / WebSocket throughput
```js
const start = Date.now();
let chunks = 0;
await page.evaluate(() => {
  const reader = new EventSource('/api/.../message');
  reader.onmessage = () => window.__chunks = (window.__chunks || 0) + 1;
});
await page.waitForTimeout(5000); // exception: perf test
chunks = await page.evaluate(() => window.__chunks);
expect(chunks).toBeGreaterThan(10);
```

### Lighthouse audit (CI)
```js
const { playAudit } = require('playwright-lighthouse');
await playAudit({ page, thresholds: { performance: 80, accessibility: 90 } });
```

---

## §20 Security Testing（security-testing.md, 624 lines）

### XSS prevention
```js
await page.fill('#input', '<script>alert(1)</script>');
await page.click('[data-submit]');
// Assert rendered as text, not executed
await expect(page.locator('text=<script>')).toBeVisible();
```

### CSRF token
```js
const csrf = await page.evaluate(() => document.querySelector('meta[name=csrf]').content);
await request.post('/api/...', { headers: { 'X-CSRF': csrf }, data: {} });
```

### Auth bypass
```js
// Request protected endpoint without token
const res = await request.get('/api/circles-sessions'); // no Authorization
expect(res.status()).toBe(401);
```

### Rate limit
```js
const promises = Array(100).fill(0).map(() => request.post('/api/...'));
const results = await Promise.all(promises);
const limited = results.filter(r => r.status() === 429);
expect(limited.length).toBeGreaterThan(0);
```

---

## §21 Common Pitfalls — 全 20 條（common-pitfalls.md, 1318 lines）

| # | Pitfall | Fix |
|---|---|---|
| 1 | `page.waitForTimeout()` 而非 assertions | `expect(locator).toBeVisible({ timeout })` |
| 2 | 不 await async 操作 | 永遠 await — eslint rule |
| 3 | CSS selector 而非 role-based | `getByRole` / `getByLabel` / `getByTestId` |
| 4 | `isVisible()` return 值 assert（而非 `expect().toBeVisible()`） | always web-first `await expect(...).toBeVisible()` |
| 5 | Sharing mutable state between parallel tests | per-test seed + cleanup fixture |
| 6 | Not using `baseURL`（hardcoding full URLs） | playwright.config.js `use.baseURL` |
| 7 | `page.$()` 而非 `page.locator()` | locator API only |
| 8 | Not handling navigation after form submission | `await Promise.all([page.waitForNavigation(), page.click()])` |
| 9 | Testing localhost in CI without `webServer` config | playwright.config.js `webServer` block |
| 10 | `innerHTML` for text assertions | `await expect(locator).toHaveText('...')` |
| 11 | **Over-mocking (mocking own API)** ★ | real backend + carve-out for error states only |
| 12 | Not using `test.describe` for grouping | always group by feature/surface |
| 13 | `beforeAll` for per-test setup | `beforeEach` for per-test, `beforeAll` for token cache only |
| 14 | **Storing test data in vars shared between tests** ★ | per-test scope only |
| 15 | Deep nesting of `test.describe` | max 2-3 levels |
| 16 | Not configuring retries differently for local vs CI | `retries: process.env.CI ? 2 : 0` |
| 17 | Running all browsers in every CI run | grep filter / project filter / matrix strategy |
| 18 | **`page.evaluate()` for things locators can do** ★ | locators preferred; evaluate for true JS APIs only |
| 19 | **Not using `test.step()` for complex flows** ★ | every multi-phase test wraps in `test.step` |
| 20 | Catching errors from assertions (try/catch around expect) | let test framework handle — never catch expect |

**Path 2 特別重視 Pitfall 3 / 11 / 14 / 18 / 19**（per 首要綱領）。

---

## §22 Real Data Discipline（per memory `feedback_e2e_real_data_only.md`）

3 條紅線：
1. **禁 stub timestamp** — 用真 timestamp 或 DB default
2. **禁 mock 自家 API** (Pitfall 11) — 只 carve-out error states
3. **禁 prod URL + 真帳號** — 只用 test DB + `e2e@first-principle.test`

---

## §23 5x Consecutive 0 Flake Gate

最終 ship gate：
```bash
for i in 1 2 3 4 5; do
  echo "=== Run $i ==="
  npx playwright test --config tests/e2e/playwright.config.js [spec] --reporter=list 2>&1 | tail -10
done
```

任 1 flake = 退件。fix root cause 不 retry hack。

---

## §24 Skill Citation Discipline（per memory `feedback_playwright_skill_cited_application`）

Spec header 必引段落 + pattern name：
```js
// tests/e2e/circles-back-nav-lock.spec.js
//
// Skills applied:
//   auth-flows.md:928-949        "Login via API for Speed"
//   common-pitfalls.md Pitfall 11 "Over-Mocking (Mocking Your Own API)"
//   common-pitfalls.md Pitfall 19 "Not Using test.step() for Complex Flows"
//   network-mocking.md:839-933   "Intermittent Failure Pattern"
//   visual-regression.md         "Per-project snapshot baseline"
```

Sonnet 不可引而不用。Director cross-check spec 內真有 apply 該 pattern。

---

## §25 Source Files Reference

| md | Lines | Use Case |
|---|---|---|
| common-pitfalls.md | 1318 | 20 anti-patterns — ALWAYS reference |
| api-testing.md | 1617 | API contract + service-role seed |
| auth-flows.md | 1030 | Login + storageState |
| authentication.md | 1409 | per-worker / token expiry / guest |
| network-mocking.md | 1329 | error sim / counter pattern |
| mobile-and-responsive.md | 1669 | device profiles / touch / iOS Safari |
| visual-regression.md | 1006 | snapshot + maxDiffPixelRatio |
| assertions-and-waiting.md | 661 | web-first + expect.poll |
| fixtures-and-hooks.md | 1014 | cleanup + per-test setup |
| test-architecture.md | 569 | Testing Trophy |
| test-organization.md | 946 | spec layout + naming |
| when-to-mock.md | 827 | decision tree |
| multi-user-and-collaboration.md | 477 | cross-tab + race |
| locator-strategy.md | 586 | priority order |
| locators.md | 713 | full API reference |
| flaky-tests.md | 860 | diagnose + fix root cause |
| debugging.md | 756 | trace viewer + headed |
| clock-and-time-mocking.md | 427 | time-dependent UI |
| error-and-edge-cases.md | 1137 | 5xx / offline / large payload |
| test-data-management.md | 1209 | factory + per-project unique |
| crud-testing.md | 945 | standard CRUD template |
| performance-testing.md | 608 | LCP / SSE throughput |
| security-testing.md | 624 | XSS / CSRF / auth bypass |
| accessibility.md | 1473 | aria / keyboard / contrast |
| **Total** | **23210** | — |

---

## §26 Path 2 Specific

- **Project**: `/Users/albertpeng/Desktop/claude_project/First_Principle`
- **Dev server**: `:4000` (Express + Supabase)
- **Test account**: `e2e@first-principle.test`（`TEST_PASSWORD` in `.env.local`）
- **storageState**: `playwright/.auth/user.json`
- **e2e projects**: e2e-desktop / e2e-mobile-chrome / e2e-mobile-safari
- **api projects**: 11 個 in `tests/api/playwright.config.js`
- **Master tracker**: `audit/e2e-master-tracker.md` — 所有 finding 在這
