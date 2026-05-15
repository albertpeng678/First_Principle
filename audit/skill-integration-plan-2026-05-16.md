# Skill 完整整合計畫（全部 skill，非只 playwright-skill）

> **目的：** 把 16+ 個既有 skill 內化為「第一性原理訓練器」**所有 workflow** 的標準綱要。
> **Date:** 2026-05-16
> **Status:** 等 user review

---

## 1. 為什麼必須整合（不只「參考」）

過去 3 週 18 個 fix commits + 7 輪 UAT 反映的根本失敗：

| 失敗模式 | skill 已點名對應原則 |
|---|---|
| jest 全綠 + cross-device round-trip 全爆 | playwright `test-architecture.md:3`「**cheapest test that gives confidence**」+ `common-pitfalls.md:599`「**All tests pass but the app is broken**」 |
| 用 `fetch PATCH` 繞過 FE save layer | playwright `third-party-integrations.md:27`「**mock the external service, not your own application**」 |
| Bug 出現馬上 patch 沒先 root cause | `superpowers:systematic-debugging` Iron Law：「**NO FIXES WITHOUT ROOT CAUSE INVESTIGATION FIRST**」 |
| 沒看 verification output 就喊「done」 | `superpowers:verification-before-completion` Iron Law：「**NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE**」 |
| 寫完 code 才補 test | `superpowers:test-driven-development` Iron Law：「**NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST**」 |
| `e2e-r2-B4-…` stub 寫進 prod | playwright `test-data-management.md:1153`「**Using production data in tests**」 |
| 跳階段直接 dispatch implementer | `feedback_phase_discipline_mandatory.md`（剛存）|

**結論：** 不是「採用一堆 skill」，而是**承認過去 workflow 違反這些 skill 的 Iron Laws 與第一原則**，重寫契約。

---

## 2. 13 條 STANDING RULES（違反 = 退件）

### 2A. 三條 Iron Laws（superpowers — 比 Golden Rules 更基本）

| # | Iron Law | Source skill | 我們違反過嗎？ |
|---|---|---|---|
| **IL-1** | **NO FIXES WITHOUT ROOT CAUSE INVESTIGATION FIRST** — 不准未 root cause 直接 patch | `superpowers:systematic-debugging` | 過去 Bug H 直接加 PATCH 沒先 trace data flow → reviewer 抓到 |
| **IL-2** | **NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE** — 不准沒 run 過 verification command 就喊「done」 | `superpowers:verification-before-completion` | 過去 sonnet 報「DONE」我沒 cross-check 就上 main，被 user 抓到 |
| **IL-3** | **NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST** — 不准先寫 code 後補 test | `superpowers:test-driven-development` | 過去 Bug 修完才補 test、test 馬上綠（證明不了什麼） |

### 2B. 10 條 Playwright Golden Rules（測試層 — `playwright-skill/SKILL.md`）

1. `getByRole()` 優先於 CSS / XPath
2. 禁用 `page.waitForTimeout()`
3. Web-first assertions（`expect(locator)` auto-retry）
4. 每 test 完全 isolated
5. `baseURL` 在 config，test 內零 hardcoded URL
6. Retries `2` in CI / `0` locally
7. Traces `on-first-retry`（或 1.59+ `retain-on-failure-and-retries`）
8. Fixtures > globals（`test.extend()`）
9. One behavior per test
10. **只 mock 外部 service，永遠不 mock 自家 app**

### 2C. 其他 STANDING（既有，保留升級）

| # | Rule | Source |
|---|---|---|
| 11 | 階段紀律不可省略（brainstorming → writing-plans → implementation） | `feedback_phase_discipline_mandatory.md` |
| 12 | Karpathy 4 條（Think Before / Simplicity First / Surgical Changes / Goal-Driven） | `feedback_karpathy_guidelines_standard.md` |
| 13 | Mockup-as-Spec 嚴格遵守（pixel-diff 0.5%） | `feedback_mockup_strict_compliance.md` |

---

## 3. 16+ 個可用 skill 全盤點（按角色分類）

### 3A. 流程主幹（每次 task 必經）

| Skill | Iron Law / 用法 | 我們的 stage |
|---|---|---|
| `superpowers:using-superpowers` | 起手必載；違反一律退件 | Session start |
| `superpowers:brainstorming` | 需求釐清（HARD-GATE：no impl without approved design） | Stage 3 — 需求定義 |
| `superpowers:writing-plans` | TDD bite-sized task plan | Stage 4 — 規劃 |
| `superpowers:subagent-driven-development` | 主流 implementer 模式（fresh subagent per task + 2-stage review） | Stage 5 — 實作 |
| `superpowers:executing-plans` | 同 session inline 替代方案（少用） | Stage 5 — alternative |
| `superpowers:test-driven-development` | **IL-3** 紅綠循環 | Stage 5 內每 task |
| `superpowers:systematic-debugging` | **IL-1** 4 phase（root cause → pattern → hypothesis → impl） | Stage 1 — root cause |
| `superpowers:verification-before-completion` | **IL-2** 任何 success 主張前 run verification | 每 stage 結尾 |
| `superpowers:requesting-code-review` | 2-stage review template | Stage 7 |
| `superpowers:receiving-code-review` | 收 reviewer feedback：verify > 盲信；no performative agreement | Stage 7 內反饋 |
| `superpowers:dispatching-parallel-agents` | 2+ 獨立任務並行 dispatch | 多處（repro / fix / audit）|
| `superpowers:using-git-worktrees` | 隔離 workspace；新 branch / impl plan 前必創 | Stage 5 開工前 |
| `superpowers:finishing-a-development-branch` | 4 選項終局（merge / PR / keep / discard）+ test 必 verify | Stage 9 — Ship |
| `superpowers:writing-skills` | 形式化我們重複的 pattern（如 future「nsm-ship-pipeline」skill） | 任意（少用） |

### 3B. 領域 / 工具型 skill（按需 invoke）

| Skill | 用途 | 我們 stage |
|---|---|---|
| `playwright-skill`（testdino，全 50+ guide） | **測試聖經** — 10 Golden Rules + fixtures + auth + flaky + visual + a11y + CI + CLI | Stage 5 / 6 / 8 |
| `frontend-design`（plugin） | **mockup / UI 實作唯一工具** — typography / color / motion / spatial / backgrounds 5 軸精修；但**必受限於我們既有 LOCKED contract**（system-ui / Phosphor / 17 mockup 視覺契約 / 無 emoji）| Stage 2 — Mockup + Stage 5 — UI implementation |
| `code-review:code-review`（plugin） | PR review baseline | Stage 7 |
| `superpowers:audit-cycle`（project-local） | **11-agent UI/UX + functional audit**（8 step coverage + 2 UI/UX auditor + 1 director）| Stage 8 — UAT（大 ship 前必跑）|
| `railway-deploy-prep`（user-built） | Railway 部署前 5 phase 審查（PORT / host / CORS / env / secret）| Stage 9 — pre-deploy |
| `context7` (MCP) | 查最新 library docs（Supabase / Express / Playwright / Phosphor 等） | 任何 Stage 寫程式碰到 library API 不確定時 |
| `security-review`（CC built-in） | 安全審查 pending changes | Stage 7（+ B7 cleanup 後必跑 1 次） |
| `claude-api` | Claude API / Anthropic SDK 相關 prompt 工程 | **不用** — 本專案 prompt 鎖死 carve-out |
| `init` / `review`（CC built-in） | CLAUDE.md / PR review | session 起手 / 偶用 |
| `simplify`（CC built-in） | Review changed code for reuse / efficiency | Stage 7 補強 |
| `fewer-permission-prompts` / `update-config` / `keybindings-help` | 設定面工具 | 偶用 |
| `schedule` / `loop` | 排程 / 重複任務 | UAT poll / long-wait test |

### 3C. 自家 Karpathy 4 條（每次 implementer prepend）

`feedback_karpathy_guidelines_standard.md`：
1. **Think Before** — 先讀再寫
2. **Simplicity First** — 反過度設計
3. **Surgical Changes** — 只動該動的
4. **Goal-Driven** — 終態驅動

---

## 4. workflow 12 階段 × skill 對映（總表）

| Stage | 動作 | 必 invoke skill | 必驗 Iron Law / Golden Rule |
|---|---|---|---|
| **0 Session start** | 載入 CLAUDE.md + memory + ritual | `using-superpowers` | — |
| **1 Triage / Repro / Root Cause** | 看 trace、grep production code、cross-component evidence | `systematic-debugging`（4-phase）+ `playwright-cli/tracing-and-debugging` + `playwright-cli/core-commands` | **IL-1** |
| **2 Mockup（如需 UI 改動）** | 開工前對齊既有 LOCKED 視覺契約（17 mockup + design tokens） → 三 viewport 並排 HTML（mobile 360 / tablet 768 / desktop 1280）+ Phosphor icons + system-ui + 無 emoji | `frontend-design`（5 軸精修：typography / color / motion / spatial / backgrounds）+ `feedback_mockup_3_viewports` + `feedback_locked_components_reuse`（既有 LOCKED CSS 直接 copy 不准 drift） | Karpathy + `feedback_mockup_strict_compliance` |
| **3 Brainstorming（需求定義）** | clarifying Q × 多輪 + visual companion + propose 2-3 approaches + design + spec doc + user gate | `brainstorming`（HARD-GATE） | **Standing #11** |
| **4 Writing Plan** | TDD bite-sized task + e2e 整合驗收 + 真實 fixture | `writing-plans` + `playwright-skill/core/test-architecture.md`（決定 task 屬 E2E/Component/API）| — |
| **5 Worktree + Implementer** | 創 isolated worktree + dispatch fresh subagent per task | `using-git-worktrees` → `subagent-driven-development` → implementer prompt prepend Karpathy 4 + 必 invoke `test-driven-development` + 寫 spec 必對 `playwright-skill/core/locators.md` / `assertions-and-waiting.md` / `fixtures-and-hooks.md` | **IL-3** + 10 Golden Rules |
| **6 測試契約 setup**（B7+B8 修補階段） | factory / API seeding fixture / storage state / .env × 3 / cleanup hook / 8 vp project | `playwright-skill/core/test-data-management.md` + `authentication.md` + `multi-context-and-popups.md` + `mobile-and-responsive.md` + `ci/global-setup-teardown.md` + `ci/projects-and-dependencies.md` | Golden Rule 4/5/8 |
| **7 2-stage Review** | spec reviewer → code quality reviewer；reviewer feedback handling | `requesting-code-review`（dispatch） + `receiving-code-review`（implementer 處理 feedback）+ `code-review:code-review`（plugin）+ `simplify`（補強）+ 14 條 anti-pattern checklist | **IL-2** |
| **8 UAT / 全裝置 audit** | 8 vp Playwright + 親 Read PNG + 對 mockup pixel-diff + 11-agent full audit（大 ship 才跑） | `audit-cycle`（大 ship）+ `playwright-skill/core/mobile-and-responsive.md` + `visual-regression.md` + `flaky-tests.md`（`--repeat-each=20` burn-in） | **IL-2** + Golden Rule 6/7 |
| **9 Security + Deploy prep** | scan secrets、CORS、env vars、PORT / host | `security-review` + `railway-deploy-prep`（5 phase） | — |
| **10 Ship** | merge / PR / push 4 選項 + 必 verify tests on result | `finishing-a-development-branch` + `verification-before-completion` | **IL-2** |
| **11 Memory / Doc 收尾** | mirror state 到 CLAUDE.md + 更新 memory + write skill（如該 pattern 重複出現） | `feedback_claude_md_live_state` + `writing-skills`（rare）| — |
| **跨切：Library docs** | 任 stage 碰到 framework / SDK API 不確定 | `context7`（MCP query-docs） | — |
| **跨切：並行多 task** | 2+ 獨立任務 | `dispatching-parallel-agents`（一次 message 多 Agent calls） | — |
| **跨切：iOS Safari 15-item** | 任何 mobile UX 改動 | `feedback_ios_review_before_ship`（既有） | — |
| **跨切：對抗測試** | 5 AI 審核 stage ship 前 | `feedback_adversarial_review_testing`（既有）+ `playwright-skill/core/flaky-tests.md` `expect.poll()` | — |

---

## 5. 新測試契約（取代既有 timestamp stub UAT）

### 5.1 檔案結構

```
tests/
├── fixtures/
│   ├── index.js                    # mergeTests({ auth, apiData, autoCleanup })
│   ├── auth.fixture.js             # storage state worker-scoped
│   ├── api-data.fixture.js         # API seed NSM/CIRCLES + auto-teardown
│   └── auto-cleanup.fixture.js     # auto fixture：crash 也清
├── factories/
│   ├── nsm-session.factory.js      # 真實長度中文（≥30 字）4 dim breakdown
│   ├── circles-step.factory.js     # 7 step framework_draft
│   └── user-typed-strings.js       # faker zh_TW pool
├── page-objects/
│   ├── LoginPage.js / NsmStep1Page / ...
├── helpers/
│   ├── env-guard.js                # assertNotProdWithRealAccount()
│   └── totp.js                     # 預留
├── e2e/                            # critical paths（含 8-bug fix）
├── api/                            # 純後端契約
└── visual/                         # mockup ↔ production pixel-diff
```

### 5.2 .env × 3 隔離

```
.env.local       # BASE_URL=http://localhost:3000   TEST_EMAIL=e2e-local@example.com
.env.test        # BASE_URL=http://localhost:3000   TEST_EMAIL=e2e@first-principle.test
.env.prod-uat    # BASE_URL=https://first-principle.up.railway.app/   TEST_EMAIL=e2e@first-principle.test
                 # ALLOW_PROD_TEST=1 （明示 opt-in）
```

`.env.*` 全 gitignored。

### 5.3 三件套 ship gate（取代「jest 162/162 = ship」）

每 task 完工標準：

```
✅ API contract test pass        (tests/api/*.spec.js)
✅ E2E user journey pass         (tests/e2e/*.spec.js — 真實 typed fixture)
✅ Visual pixel-diff < 0.5%      (tests/visual/*.spec.js — 8 vp)
+ IL-2 verification evidence     （run command output 貼上）
+ IL-3 red-green-revert-red 完整 cycle 記錄
```

---

## 6. 8 Bug 各自對應 pattern（補上 IL）

| Bug | 主 guide | Iron Law | spec |
|---|---|---|---|
| B1 全 Y 過 Gate | `forms-and-validation` + `assertions-and-waiting` | **IL-3** TDD 紅燈先寫「全 Y 必擋」test | `tests/e2e/gate-validation.spec.js` |
| B2 對話練習憑空有內容 | `multi-context-and-popups` dual-context + `test-data-management` API seeding | **IL-1** 先 trace data flow 找 restore 源頭 | `tests/e2e/cross-device-sync.spec.js` |
| B3 loading 卡 | `flaky-tests` `expect.poll()` + `websockets-and-realtime`（SSE） | **IL-1** Phase 1 evidence gather：log SSE stream events | `tests/e2e/phase3-loading.spec.js` |
| B4 cache stale | `api-testing` DELETE→GET + cache invalidate assertion | **IL-3** + **IL-2** | `tests/api/circles-progress.spec.js` + `tests/e2e/delete-and-cache.spec.js` |
| B5 UI 不符 mockup | `visual-regression` + `mobile-and-responsive` + `frontend-design`（LOCKED 邊界內 5 軸精修） | Karpathy + Standing #13 | `tests/visual/mockup-vs-prod.spec.js` |
| B6 跳 Gate race | `flaky-tests` `--repeat-each=20` + dual-context | **IL-1** 先 burn-in repro 100 次抓 race | `tests/e2e/skip-gate-race.spec.js` |
| **B7** prod 污染 | `test-data-management` § Anti-Pattern + `ci/global-setup-teardown` cleanup | **IL-1**（cleanup 不是 patch，是 incident response）+ `security-review`（後續驗）| audit report + helper |
| **B8** 方法論 | `test-data-management` factory + faker + storage state + env-specific | Standing：全 spec 套此 contract | 所有新 spec |

---

## 7. B7+B8 預防機制（STANDING 永久）

1. **獨立 test 帳號** `e2e@first-principle.test`
2. **`assertNotProdWithRealAccount()` helper**：BASE_URL contains `railway.app` + email != test → throw
3. **`afterAll` cleanup hook**：DELETE all created sessions
4. **Global teardown**：sweep `e2e-*` prefix
5. **Auto-cleanup fixture**：每 spec `cleanupTracker.track(kind, id)` — crash 也清
6. **Pre-commit hook**：擋 hardcoded prod URL + 真帳號
7. **Storage state worker-scoped fixture**：取代手刻 `loginFresh()`

---

## 8. 20 條 anti-pattern checklist（spec PR review 必走）

**Iron Law 違反**：

- [ ] **無未 root cause 直接 patch**（IL-1）
- [ ] **無未跑 verification command 就喊「done」**（IL-2）
- [ ] **無寫完 code 才補 test**（IL-3）

**Playwright Golden Rule 違反**：

- [ ] 無 `page.waitForTimeout()`（除非 trace 證明）
- [ ] 無 hardcoded URL（用 baseURL）
- [ ] 無 hardcoded 真帳號
- [ ] 無 `page.route('**/api/...自家')` mock
- [ ] 無 `expect(await ...textContent())`
- [ ] 無 module-level mutable state
- [ ] 無 shared account across parallel workers
- [ ] 無 try/catch swallow expect failures
- [ ] 無 `test.fixme` without ticket
- [ ] 無 cleanup-less data creation
- [ ] 無 hardcoded session ID
- [ ] 無 god fixture
- [ ] 無 `--retries` 用來掩蓋 flake
- [ ] 無 `networkidle` 等自家 endpoint

**Process 違反**：

- [ ] 無跳 brainstorming 直接 dispatch implementer
- [ ] 無 sonnet「DONE」沒 git -S cross-check
- [ ] 無 reviewer feedback 用「You're absolutely right」回應（receiving-code-review 禁）

---

## 9. playwright.config.js 重寫（同 §8 前版，已涵蓋）

詳見 audit/playwright-skill-integration-plan-2026-05-16.md §8。多 add：

```js
// playwright.config.js 加 globalSetup / globalTeardown
globalSetup: require.resolve('./tests/global-setup.js'),     // ci/global-setup-teardown.md pattern
globalTeardown: require.resolve('./tests/global-teardown.js'), // sweep e2e-* prefix
```

---

## 10. audit-cycle 整合（大 ship 必走）

`audit-cycle.md` 已存在於 repo + 已寫好 11-agent flow。整合位置：

- **小 fix（1-3 bug）**：跳過 audit-cycle，走 Stage 1-10 normal flow
- **大 ship（5+ bug bundle / 跨步驟改動 / phase 完工）**：**Stage 8 必跑** audit-cycle
  - 11 個 agent 並行：8 step coverage + 2 UI/UX auditor + 1 director
  - 0 P0 / 0 P1 才能 ship
  - 自動 invoke：brainstorming（任何 UI 改動）+ TDD + systematic-debugging + verification-before-completion

**這次 8-bug bundle = 大 ship**，所以 Stage 8 必跑 audit-cycle。

---

## 11. frontend-design 整合（Stage 2 Mockup + Stage 5 UI implementation）

**重要邊界：** 我們專案 design 已 LOCKED（17 mockup 視覺契約 + system-ui font stack + Phosphor icons + 無 emoji + Instrument Serif italic 只給 grade letter）。`frontend-design` 在 plan 內**只用在 LOCKED contract 範圍內精修**，**不准**重新挑「bold maximalist / retro-futuristic / 等」aesthetic — 那違反 Standing rule `feedback_mockup_strict_compliance` + `feedback_locked_components_reuse`。

### 11.1 開工前 alignment（每 Stage 2 必走）

新 UI 出來之前必對齊既有契約：

1. **Read 對應 LOCKED mockup** PNG + HTML（`docs/superpowers/specs/mockups/2026-05-02-frontend-rewrite/`）
2. **抓 design tokens**：color / spacing / font stack（從 `00-design-system.html`）
3. **抓 LOCKED component CSS**：03 以後 navbar / progress / phase-head / qchip 等已鎖死 → 直接 copy 不准重定義
4. **Playwright 截 production**（既有狀態）+ Read PNG — 確認改動點

### 11.2 frontend-design 用法（5 軸精修）

對齊後，用 frontend-design 5 軸**在 LOCKED 範圍內**精修：

| 軸 | LOCKED 邊界 | 容許精修空間 |
|---|---|---|
| **Typography** | system-ui stack（Instrument Serif italic 只給 grade letter） | font-weight / line-height / letter-spacing 微調；hierarchy 層次（h1/h2/h3 對比）|
| **Color** | design system 8 token | hover / focus state；mockup 已定狀態的細部色階 |
| **Motion** | 無花俏動畫；reducedMotion 友善 | 載入 stagger / button press feedback / sheet slide-in（CSS-only 優先）|
| **Spatial** | 4-grid 間距 / 1px 對齊 / 8 viewport 一致 | 卡片 padding / gap / 內部 hierarchy；不准改總體 grid |
| **Backgrounds** | 白底為主（bg-muted #f7f7f7）| `feedback_card_based_analysis_layout` 既有 pattern；warn 4% bg trap 不准紅底 |

### 11.3 B5「對話練習 UI 不符 mockup」具體應用

走法：

1. Read mockup 05（phase-2-chat）+ 06（nsm-step-1 chat 模式）對齊 layout
2. Read 截圖 22.png 找 production drift（題目區無展開 / 上一步不與輸入框同列）
3. 用 frontend-design 5 軸精修「題目卡」expand+collapse motion + bottom bar「上一步 / 輸入框 / 送出」sticky row（保留 mockup 05 LOCKED structure）
4. 三 viewport 並排（mobile 360 / tablet 768 / desktop 1280）
5. user 「放行」前不准 ship

### 11.4 4 條禁忌

- ❌ 用 frontend-design 開新 aesthetic direction（bold / brutal / retro 等都違反 LOCKED）
- ❌ 用 frontend-design 換字型（system-ui 鎖死）
- ❌ 用 frontend-design 加 emoji / 改 icon library（Phosphor 鎖死）
- ❌ 用 frontend-design 改 design token 色票
- ✅ 用 frontend-design 在既有 token 內把 motion / spacing / hierarchy 精修到 pitch-ready

---

## 12. railway-deploy-prep 整合（Stage 9 deploy 前必跑）

每次 ship 大 bundle 前跑 railway-deploy-prep 5-phase audit：

1. **B1-B7 Backend**：PORT / host `0.0.0.0` / start command / deps / CORS / secrets / env vars
2. **F1-F5 Frontend**：API URL env var / 前綴 / no secret in client / build script / env list
3. **G1-G3 Git hygiene**：.gitignore / history 掃 secret
4. **Phase 5 Handoff**：產 deploy checklist

**B7 之後特別重要** — 確認沒 prod URL hardcode 進 spec。

---

## 13. context7 整合（library docs lookup）

寫程式碰到任何 library / SDK API 不確定時 **必查 context7**（MCP query-docs），不憑訓練資料猜：

- Supabase JS SDK / RLS / auth
- Express 5.x route handlers
- Playwright 1.59+ new APIs
- Phosphor Icons class names

寫 prompt：「**Use context7 to fetch Supabase upsert API docs**」。

---

## 14. security-review 整合（B7 後必跑 1 次）

B7 prod 污染本質是 **security incident**（測試環境直接寫 prod DB），不只是 bug。
B7 cleanup 完成後 **強制 invoke** `security-review` 對 pending changes 跑一次，確認沒留下後門 / 沒 leak 任何 cred / `.env.*` 全 gitignored。

---

## 15. 對既有 standing memory 的影響

| Memory | 動作 | 變更 |
|---|---|---|
| `feedback_full_sit_uat_uiux.md` | **更新** | 加「三件套 ship gate」+ audit-cycle for big ship |
| `feedback_test_all_devices_visual.md` | **更新** | 補 device emulation 用 Playwright `devices[]` |
| `feedback_adversarial_review_testing.md` | **更新** | + `expect.poll()` for SSE/AI 終態 |
| `feedback_discipline_enforcement.md` | **更新** | 加 20 條 anti-pattern checklist + 3 Iron Laws |
| `feedback_two_stage_review_mandatory.md` | **保留** | + receiving-code-review handling rule |
| `feedback_phase_discipline_mandatory.md` | **保留** | （剛建立） |
| `reference_playwright_skill_testing_bible.md` | **保留** | （剛建立） |

**新增 2 條 memory**：

- `feedback_three_iron_laws.md` — IL-1 / IL-2 / IL-3 升 STANDING；每次 implementer / reviewer dispatch 必 prepend
- `feedback_e2e_real_data_only.md` — 禁 stub timestamp / 禁 mock 自家 API / 禁 prod URL + 真帳號

---

## 16. YAGNI（短期不導入）

| Skill | 暫不用原因 |
|---|---|
| `claude-api` | Prompt 鎖死 carve-out |
| `ui-ux-pro-max-skill` | **本次拿掉** — 設計已 LOCKED 不需再查 design DB；改用 frontend-design 在 LOCKED 範圍內精修 |
| `superpowers:writing-skills` | 尚無重複 pattern 該形式化 |
| playwright `core/canvas-and-webgl` / `electron-testing` / `browser-extensions` / `i18n` / `component-testing`（mount） | 無對應需求 |
| `migration/from-cypress` / `from-selenium` | 無遷移 |
| `core/auth-flows.md` Auth0/Okta/Firebase | 我們用 Supabase |
| `core/clock-and-time-mocking` | 無時間敏感邏輯 |
| `keybindings-help` / `update-config` 多餘 | 偶用 |

---

## 17. 落地節奏（建議 6 Phase）

| Phase | 範圍 | 預估 |
|---|---|---|
| **P0** | B7 cleanup + `security-review` 補強 + 環境隔離 setup + `assertNotProd` helper | 1 session |
| **P1** | playwright.config 重寫 + auth-setup project + global-setup-teardown + 既有 spec 抽 fixture | 1 session |
| **P2** | 8-bug TDD 紅燈 → 綠（必含 IL-1/2/3 evidence + Karpathy 4 prepend） | 2-3 sessions |
| **P3** | 既有 spec 漸進改寫到 10 Golden Rules（不一次性） | 3-5 sessions 背景跑 |
| **P4** | audit-cycle 跑 1 輪確認大 ship 可放行 | 1 session |
| **P5** | CI GitHub Actions（sharding + reporting + artifact upload）+ railway-deploy-prep checklist 自動化 | 1 session |

---

## 18. 結論

整合不只「採用 skill」 — 是**重寫 workflow 契約**。

**13 STANDING RULES**（3 Iron Laws + 10 Golden Rules + 3 process rules）+ **16 skill 各自定位**到 12 個 workflow stage，加上 **20 條 anti-pattern checklist** 構成 PR / ship gate。

過去 7 輪 UAT 反覆挖出 18 個 bug 的 root cause（systematic-debugging Phase 4.5 講的「architectural problem」）就是 workflow 違反這些 Iron Laws。**整合後同一條 root cause 不會再發生**。

下一步：等 user 放行此 plan → 進 P0 B7 cleanup → 回到 brainstorm Q5 完成 Stage 0 spec → writing-plans → implementation。
