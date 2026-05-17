# Session Start Ritual — PM Drill / Path 2 + E2E Integration Bible

> **SessionStart hook 自動注入本檔到每次 Claude context。**
> 讀完這 1 份 → 你成為 e2e 整合測試專家 + 知道全部 Standing Rules + 知道接手節點。不依靠模型既有知識。
> **最後更新：** 2026-05-17

---

## §0 開工 30 秒 Read 順序

1. **本檔（SESSION-START-RITUAL.md）** — 你正在讀
2. **`docs/PATH-2-HANDOFF.md`** — 接手 1 分鐘 orient（§A-§N）
3. **`audit/e2e-master-tracker.md`** — 所有 issue/optimization living single source of truth（§1-§11）
4. **`CLAUDE.md`** — 即時 state board
5. **memory `~/.claude/projects/.../memory/MEMORY.md`** — 30+ STANDING memories auto-loaded

開工第一句必說：「Ritual 走完。當前 state：[一句話]。下一步：[A 或 B]？」

---

## §1 首要綱領（2026-05-17 user 立，覆蓋全部紀律）

> **所有修復與優化都要經過 e2e 整合測試，不能僅測單元，以確保不見樹不見林。**

對應 memory `feedback_e2e_integration_supreme.md`。違反 = 退件。

任何 fix/feature 完成前必須有 real Playwright E2E 跑「user action → DB persist → reload → visible」整段，5x consecutive 0 flake 才算 GREEN。Unit test 過 ≠ e2e 過。

---

## §2 Iron Laws（最頂層 STANDING — `feedback_three_iron_laws.md`）

- **IL-1 Root Cause**：解 root cause 不 hide symptom
- **IL-2 Verification**：跑驗證親證實有效（不是 grep claim it should work）
- **IL-3 TDD**：red → green（先寫 fail test，再寫 production code）

違反任一 = 退件。Director cold-Read 證據（PNG / log）才算 IL-2 達標。

---

## §3 E2E Integration Testing Bible（Playwright-skill inline 注入）

> **快速版見下** — 載重 patterns 全 inline。
> **完整深度版**：`audit/playwright-e2e-bible.md`（§0-§26，涵蓋 24 md ~23k lines 提煉，含 20 條 Pitfall 全表 + authentication.md / accessibility.md / error-and-edge-cases.md / test-data-management.md 等深度章節）。
> **遇到不確定的 e2e 場景必查 bible 對應 § + line refs**。
>
> 基於 `/Users/albertpeng/.claude/skills/playwright-skill/core/` 24 個 md 提煉（總 23,210 lines）。本檔 inline 為日常常用 patterns；bible 為完整索引。

### §3.1 Testing Trophy 分佈目標（test-architecture.md）

```
            🏆 Static (lint+type)
           ↑
    Unit (pure logic)
   ↑
  Integration / API ← 60% target
 ↑
E2E (full browser) ← 10% target（critical path only）
```

當前專案 trophy-inverted（95 E2E vs 18 API），漸進改善中（Group A V1-V8 已加 8 real API spec）。

### §3.2 Pitfall 11 — 禁 mock 自家 backend（common-pitfalls.md 597-661）

**最重要紀律。**
- ❌ 禁 `page.route('**/api/circles-sessions/**', route.fulfill 200 mock body)` 自家 endpoint
- ✅ 允許 carve-out：**error state** (503 / timeout / abort) 模擬 — production 真實 5xx 場景無法穩定 reproduce
- ✅ 允許 mock 第三方：`**/api.openai.com/**`（但 server-side OpenAI page.route 擋不到，需 backend test）
- ✅ 允許 service-role 直 Supabase seed（api-testing.md 783-848 data seeding carve-out）— 寫入 fixture row 不是 mock API

理由：mock own backend = test 永遠不會抓真 backend bug + stub shape 容易跟 real response drift。

### §3.3 Pitfall 14 — 禁 module-level shared state（common-pitfalls.md 802-858）

- ❌ 禁 spec 檔頂端 `let sessionId; before(() => sessionId = ...)` 模式跨 test 共用
- ✅ test-local 變數 + 每 test 自 seed + cleanup fixture 自動清

### §3.4 Pitfall 18 — `page.evaluate` 只能調 true JS APIs（common-pitfalls.md）

- ✅ `page.evaluate(() => window.apiFetch('/api/...'))` — apiFetch 是 prod code 的真 JS API
- ✅ `page.evaluate(() => window.AppState.circlesSession.id)` — 讀 真 state
- ❌ 禁 `page.evaluate(() => /* big test logic */)` — 改用 page.locator / request fixture

### §3.5 Pitfall 19 — `test.step()` for 多階段 flow（common-pitfalls.md 1099-1185）

```js
test('full flow', async ({ page }) => {
  await test.step('Phase 1: form fill', async () => { ... });
  await test.step('Phase 1.5: gate', async () => { ... });
  await test.step('Phase 2: chat', async () => { ... });
});
```
fail message 含 step name，trace report 清楚。

### §3.6 Pitfall 3 — Role-based locator > CSS chain（common-pitfalls.md, locators.md）

- ✅ `page.getByRole('button', { name: '完成 Phase 1' })`
- ✅ `page.locator('[data-phase2="back"]')`（data attr 是 prod 設計）
- ❌ 禁 `.submit-bar > .btn:nth-child(2)` chain
- ❌ 禁 `page.mouse.click(x, y)` 座標
- ❌ 禁 mobile selector 用 desktop-only class（如 `.navbar__email` 在 mobile CSS hide）

### §3.7 Auth seed via API（auth-flows.md 928-949）

```js
// In setup project (auth.setup.js):
await page.goto('/');
await page.getByRole('button', { name: '登入' }).click();
await page.fill('#auth-email', 'e2e@first-principle.test');
await page.fill('#auth-pw', process.env.TEST_PASSWORD);
await page.getByRole('button', { name: '登入' }).click();
await page.context().storageState({ path: 'playwright/.auth/user.json' });

// In every other spec:
test.use({ storageState: 'playwright/.auth/user.json' });
// → AppState.accessToken automatically restored
```

Plus per-spec API seed via `page.evaluate(() => window.apiFetch(...))` to get auth header.

### §3.8 Data seeding via service-role（api-testing.md 783-848）

```js
const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
// Seed test state without going through OpenAI:
await admin.from('circles_sessions').update({ step_scores: {...} }).eq('id', sid);
```
**Carve-out**: only for seeding test fixtures, not for mocking. Real GET endpoint still reads same DB row.

### §3.9 Error response testing（api-testing.md 1023-1166）

```js
const res = await request.post(`${BASE_URL}/api/...`, { headers, data });
expect(res.status()).toBe(422);  // status first
const body = await res.json();
expect(body).toMatchObject({ error: 'step_already_scored', stepKey });  // body shape
```

### §3.10 Network mocking — error state only（network-mocking.md 839-933）

```js
// Intermittent failure pattern with counter:
let attempts = 0;
await page.route('**/api/.../draft', (route) => {
  attempts++;
  if (attempts === 1) return route.fulfill({ status: 503 });
  return route.continue(); // 2nd attempt → real backend
});
// ...trigger action...
expect(attempts).toBe(2); // proves retry happened
```

### §3.11 Cross-viewport（mobile-and-responsive.md 49-71, 279-322）

3 e2e projects baseline：
- `e2e-desktop`（chromium 1280×720）
- `e2e-mobile-chrome`（Pixel 5）
- `e2e-mobile-safari`（iPhone 14, WebKit — 抓 iOS-specific bug）

每 spec 必跑 3 projects 才算 cross-vp GREEN。`.tap()` 需 `hasTouch:true`（device profile 自動帶）。

### §3.12 Multi-context cross-tab（multi-user-and-collaboration.md 27-58, 306-343）

```js
// Two-tab cache invalidation test:
const ctxA = await browser.newContext({ storageState });
const ctxB = await browser.newContext({ storageState });
const pageA = await ctxA.newPage();
const pageB = await ctxB.newPage();
// Tab A delete → Tab B reload → assert item gone

// Race assertion:
const [r1, r2] = await Promise.all([
  page1.click('[data-action="submit"]'),
  page2.click('[data-action="submit"]'),
]);
// Then verify mutex behavior
```

### §3.13 Visual regression（visual-regression.md）

```js
await expect(page.locator('[data-phase1]')).toHaveScreenshot(
  `phase1-locked-${test.info().project.name}.png`,
  { maxDiffPixelRatio: 0.005 }
);
```
Baseline 自動生於 `*.spec.js-snapshots/`. Threshold 0.005 = 0.5%.

### §3.14 Assertions + waiting（assertions-and-waiting.md）

- ✅ `await expect(locator).toBeVisible({ timeout: 15000 })`
- ✅ `await expect.poll(() => fetchSomething(), { timeout: 30000 }).toBe(expected)`
- ❌ 禁 `await page.waitForTimeout(5000)` hard sleep
- ✅ `await page.waitForResponse((r) => r.url().includes('/api/X') && r.status() === 200)`

### §3.15 Fixtures + hooks（fixtures-and-hooks.md 19-60, 110-175）

```js
// Auto-cleanup fixture pattern:
const test = base.extend({
  cleanupTracker: async ({}, use) => {
    const tracker = { circles: [], nsm: [] };
    await use(tracker);
    // teardown: DELETE all tracked
    for (const id of tracker.circles) await deleteCirclesSession(id);
  },
});
```

### §3.16 when-to-mock decision tree（when-to-mock.md）

| Scenario | Mock? |
|---|---|
| 自家 backend success path | ❌ NO — real backend |
| 自家 backend error state (503/timeout) | ✅ OK carve-out |
| 第三方 API (OpenAI/Stripe) | ✅ OK if cost/quota/non-deterministic |
| auth (login API) | ❌ NO — real Supabase test DB |
| DB | ❌ NO — real test DB + service-role seed |
| time / clock | ✅ OK `clock-and-time-mocking.md` pattern |

### §3.17 Real Data Only（memory `feedback_e2e_real_data_only.md`）

- 禁 stub timestamp（`Date.now() = 12345`）— 用真 timestamp
- 禁 mock 自家 API（同 Pitfall 11）
- 禁 prod URL + 真帳號（用 `e2e@first-principle.test` 測 test DB only）

### §3.18 5x Consecutive 0 Flake 才 GREEN

```bash
for i in 1 2 3 4 5; do
  echo "=== Run $i ==="
  npx playwright test --config tests/e2e/playwright.config.js [spec] --reporter=list 2>&1 | tail -10
done
```
全 5/5 GREEN 才算過。任 1 flake → diagnose root cause（flaky-tests.md）— 不 retry hack。

### §3.19 Skill citation 紀律（memory `feedback_playwright_skill_cited_application`）

Spec header 必引段落號 + pattern name：
```js
// Skills applied:
//   auth-flows.md:928-949 "Login via API for Speed"
//   common-pitfalls.md Pitfall 11 "Over-Mocking"
//   network-mocking.md:839-933 "Intermittent Failure Pattern"
```
Sonnet 不可引而不用。Director cross-check spec 真有 apply 該 pattern。

---

## §4 Karpathy 4 Guidelines（必套於每次 dispatch + 每次寫 code）

來源 `~/.claude/plugins/cache/karpathy-skills/.../skills/karpathy-guidelines/SKILL.md`

### §4.1 Think Before Coding
- State assumptions explicitly. If uncertain, ask.
- Multiple interpretations → present them, don't pick silently.
- Simpler approach exists → say so. Push back when warranted.
- Unclear → stop, name confusion, ask.

### §4.2 Simplicity First
- Minimum code that solves problem. Nothing speculative.
- No features beyond ask.
- No abstractions for single-use.
- No "flexibility" not requested.
- No error handling for impossible scenarios.
- 200 lines doable in 50 → rewrite.

### §4.3 Surgical Changes
- Touch only what you must.
- Don't "improve" adjacent code/comments/formatting.
- Don't refactor things that aren't broken.
- Match existing style.
- Unrelated dead code → mention, don't delete.
- Every changed line traces to user's request.

### §4.4 Goal-Driven Execution
- Verifiable success criteria — "Add validation" → "Write tests for invalid inputs, then make pass"
- Multi-step → state brief plan with verify per step
- Strong criteria let you loop independently

---

## §5 Standing Rules（10 條 — 違反 = 退件）

1. **後端 / API / DB / OpenAI prompts / jest 不可主動動** — Path 2 鐵則（明確 user carve-out 才能）
2. **17 mockups CONTRACT-LOCKED** — implementer 對 mockup / auditor PNG pixel-diff 0.5%
3. **無紫色 / 無黃色 toast / 無 emoji** — icons 一律 Phosphor `ph-*`
4. **字型 system-ui stack** — grade letter A/B/C/D 例外 Instrument Serif italic
5. **mockup class names LOCKED** — 03+ 起後續 copy 不准重定義
6. **Phase 1.5 Gate red item 一律擋路** — 無 simulation override
7. **設計前必先驗證現有產品** — Read production + Playwright capture + Read PNG + 抓 constants
8. **CLAUDE.md 即時更新** — 每次重大事件 mirror state
9. **驗收必開 port** — 不只貼 PNG，要起 dev server + UAT SOP
10. **直推 main 不走 PR branch** — solo workflow，hook 擋請 user 手動

---

## §6 Ship/Commit 前必走（缺一 = bundle 重來）

- [ ] **TDD 紅綠** — 先寫 fail spec → fail log → 寫 code → green log
- [ ] **jest log** — 0 new regression（pass/skip/total 數字）
- [ ] **Playwright cross-vp** — 3 e2e projects + 5x consecutive 0 flake
- [ ] **Read PNG × 3 vp** — Director 親 cold-Read 每張 ≥ 1 句評論
- [ ] **mockup ↔ production pixel-diff** — 0.5% threshold
- [ ] **iOS Safari 15-item 靜檢** — 任何 mobile UX 改動
- [ ] **eyeball walk doc** `audit/eyeball-{name}.md`
- [ ] **live port + SOP** 給 user 親跑
- [ ] **2-stage review per commit** — spec compliance + code quality reviewer
- [ ] **Master tracker append** — `audit/e2e-master-tracker.md` §1-§3 update + §8 timestamp bump

---

## §7 Sub-agent Dispatch 紀律（並行上限 3）

### §7.1 Model selection
- **Opus** = director / cold reviewer / cold-Read PNG / spec writer
- **Sonnet** = implementer / TDD red→green / 5x consecutive verify

### §7.2 Dispatch prompt 必含
- Plan/spec 路徑 + 對應 task ID
- Files: Create / Modify / Test 明確
- Karpathy 4 條 prepend
- E2E Bible relevant §3.x 段落引用
- 完工 criteria（jest 數字 / Playwright 數字 / Read PNG path / commit SHA）
- 「Director cold-Read，self-report 不算數」明說

### §7.3 並行紀律
- 上限 3 個 sub-agent，任 1 return 立刻補下一個
- 不同檔/不同區段隔開，避免 git conflict
- Director 不夾雜 implementation — 只 review + coordinate

### §7.4 2-stage review per commit
- **Spec-compliance reviewer**（opus）：對照 spec 看 code 100% match
- **Code-quality reviewer**（opus）：對照 Karpathy + STANDING + skill
- 兩 reviewer 都 APPROVED 才算 ship

---

## §8 Anti-Patterns（自動扣分）

- ❌ Subagent 自己 self-approve — Director 必 cold review
- ❌ 「看起來對齊 / 大致一致」當判斷 — 視覺契約用 PNG 機械 diff
- ❌ Test fixture 與 production schema 不符
- ❌ `[object Object]` 漏到 production
- ❌ 自動 `git push --force` / `git reset --hard` 沒問
- ❌ 跳 brainstorming → writing-plans → subagent 鏈條
- ❌ Commit 前不跑 jest / Playwright / Read PNG 三件套
- ❌ Mock 自家 backend success path（Pitfall 11）
- ❌ 把 jest fail 標 "pre-existing acceptable" 而不調查（**真實案例**：2026-05-17 lifecycle gate→gated 4 fail 被誤分類藏住 P0 bug）
- ❌ 只測 unit 沒 e2e integration → 不見樹不見林
- ❌ 用 desktop selector 在 mobile（如 `.navbar__email` mobile hidden）
- ❌ Visual snapshot 沒 cold-Read 就 update baselines

---

## §9 User 殺手鐧 3 問（隨時可打 — 任一答不出 = bundle 重做）

1. 「Read 過 PNG 沒？貼 viewport + 評論」
2. 「跑 5x consecutive 結果？每 run pass/total 數字」
3. 「mockup ↔ production pixel-diff 結果？引 report 路徑」

新增（2026-05-17）：
4. 「Skill citation 引哪段？應用 quote 給我看」
5. 「e2e 涵蓋 user action → DB → reload → visible 嗎？」

---

## §10 Path 2 Specific Context

- **Master Spec**: `docs/superpowers/specs/2026-05-02-frontend-rewrite-master-spec.md`
- **17 mockups CONTRACT-LOCKED**: `docs/superpowers/specs/mockups/2026-05-02-frontend-rewrite/00-16-*.html`
- **Dev server**: `npm run dev` on `:4000`
- **Test account**: `e2e@first-principle.test`（password in `.env.local TEST_PASSWORD`）
- **Supabase test DB**: real via `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`
- **storageState**: `playwright/.auth/user.json` (auth.setup.js 自動)
- **e2e projects**: e2e-desktop / e2e-mobile-chrome / e2e-mobile-safari
- **api projects**: 11 個 in `tests/api/playwright.config.js`
- **jest baseline (post 2026-05-17 reclass)**: 525/552 (5 fail 重歸 P0 lifecycle bug, 22 skip)

---

## §11 Quick Command Reference

```bash
# 跑單個 e2e spec
npx playwright test --config tests/e2e/playwright.config.js [spec] --project=e2e-desktop --reporter=list

# Cross-vp full
npx playwright test --config tests/e2e/playwright.config.js [spec] --reporter=list

# 5x consecutive
for i in 1 2 3 4 5; do echo "=== Run $i ==="; npx playwright test --config tests/e2e/playwright.config.js [spec] --reporter=list 2>&1 | tail -10; done

# API suite
npx playwright test --config tests/api/playwright.config.js --reporter=list

# jest
npx jest 2>&1 | tail -10

# Adversarial sweep (AI prompt quality)
npx jest tests/adversarial/ 2>&1 | tail -10

# Visual baseline update
npx playwright test --config tests/e2e/playwright.config.js [spec] --update-snapshots
```

---

## §12 Cross-References

| 用途 | 路徑 |
|---|---|
| Living tracker (此乃唯一 source of truth) | `audit/e2e-master-tracker.md` |
| Compact-ready handoff | `docs/PATH-2-HANDOFF.md` |
| Live state board | `CLAUDE.md` |
| User memory (auto-loaded) | `~/.claude/projects/.../memory/MEMORY.md` |
| Master spec Path 2 | `docs/superpowers/specs/2026-05-02-frontend-rewrite-master-spec.md` |
| E2E master plan | `docs/superpowers/specs/2026-05-17-e2e-integration-coverage-master-plan.md` |
| 17 mockups (LOCKED) | `docs/superpowers/specs/mockups/2026-05-02-frontend-rewrite/` |
| Playwright-skill (原檔，本檔已 inline 提煉) | `~/.claude/skills/playwright-skill/core/` |
| Karpathy guidelines | `~/.claude/plugins/cache/karpathy-skills/.../skills/karpathy-guidelines/SKILL.md` |

---

## §13 Ritual 結尾 — 自我確認 prompt

每次開工讀完本檔，內心自問：
- 我知道首要綱領 e2e integration test mandate 嗎？✓
- 我知道 IL-1/2/3 嗎？✓
- 我知道 Pitfall 11/14/18/19/3 嗎？✓
- 我知道 Karpathy 4 條嗎？✓
- 我知道並行 3 上限 + opus/sonnet 分工嗎？✓
- 我知道 master tracker 在哪 + 怎麼用嗎？✓
- 我知道 user 殺手鐧 5 問嗎？✓

全 ✓ → orient 完成，可以動工。任一 ✗ → 重讀對應 §。
