---
date: 2026-05-17
status: draft — pending user review
scope: CIRCLES 對話練習 qchip drift + 已評分 step 鎖死防重新評分
sub-spec-of: docs/superpowers/specs/2026-05-17-e2e-integration-coverage-master-plan.md (SP-A subset)
linked-bugs: Bug 5 (PNG 22 — qchip 不對齊) + 完整步驟 lock requirement (early morning ask #2)
---

# CIRCLES 對話練習 qchip drift + 已評分 step 鎖死 — Design Spec

## §1 Background

User 早上交付 3 條（重排後）：
1. **對話練習修法套到所有 CIRCLES** — `(A) CIRCLES only (7 step + locked + drill/sim)` confirmed
2. **完整步驟已評分 step 鎖死** — 為避免觸發重新評分。「完整步驟」澄清 = user 點「上一步」回到之前已評分的 step / 環節
3. **E2E 完整覆蓋** — 必須有 real Playwright integration test，不只 unit

Production audit (2026-05-17 director cold-Read 3 PNG + sonnet 21 PNG)：
- **Phase 1 qchip 展開 (`renderQchipExpand` app.js:4379)** 有完整 4-block 分析（商業背景 / 用戶輪廓 / 常見誤區 / 破題切入）
- **Phase 2 qchip 展開 (`renderQchipPanelHtml` app.js:804)** 只有 type pill + statement 重述 + 收合 button，無分析 block
- **Phase 2 「上一步」 (app.js:6727-6733)** 裸切 `circlesPhase=1`，**0 lock check / 0 step_scores 檢查**
- **Phase 3 「重新評分」 (app.js:6268)** explicit retry button → triggers `/evaluate-step` API
- 全 7 CIRCLES step（C1/I/R/C2/L/E/S）共用 `renderCirclesPhase2` + `renderCirclesPhase2Locked` → 改 1 處套全部

## §2 Scope

In-scope：
- CIRCLES drill mode (7 step) + simulation mode + Phase 2 locked state
- BE guard on `/evaluate-step` route to reject re-scoring
- FE: 上一步 back-navigation lock detection + Phase 3 重新評分 button disable
- Real Playwright integration test covering full flow

Out-of-scope：
- NSM 對話練習（user 選 A: CIRCLES only）
- Mockup 重寫（reuse 既有 `renderQchipExpand` 不需新 mockup）
- Phase 3/4 其他 surface

## §3 Architecture（單元拆解）

### 3.1 FE qchip 統一（Bug 5 drift fix）

**Affected files**: `public/app.js`

| 改動點 | 現況 | 改動 |
|---|---|---|
| `renderCirclesPhase2` line 879 | `qchipHtml = renderPhase2QchipHtml(q) + renderQchipPanelHtml(q)` | `qchipHtml = renderPhase2QchipHtml(q) + renderQchipExpand(q)` |
| `renderCirclesPhase2Locked` line 1064 | 同上 | 同上 |
| `renderQchipPanelHtml` line 804 | （keep for now，最後 dead-code cleanup）| 留著或刪 — 由 plan 決定 |
| `bindPhase2` qchip click line 6710 附近 | toggle `.qchip-panel` | 改 toggle `.qchip-expand` |

**CSS**: 確認 `.qchip-expand` 等 class 在 `style.css` 已存在（mockup 03 LOCKED）；Phase 2 容器需確保 grid 容得下 4-block panel。

**單元邊界**：
- `renderQchipExpand(q)` 是純 HTML 生成 fn，沒副作用 — 共用安全
- 點擊 toggle 邏輯改成 `data-phase2="qchip-expand"` selector

### 3.2 BE guard — `/evaluate-step` route 守門

**Affected file**: `routes/circles-sessions.js`（`/api/circles-sessions/:id/evaluate-step` handler，line 253 附近）

**改動**：
```js
// after fetching session row + before AI call
if (session.step_scores && session.step_scores[stepKey] != null) {
  return res.status(422).json({
    error: 'step_already_scored',
    stepKey,
    message: 'This step has already been scored; re-scoring is not allowed.'
  });
}
```

**Trade-off**: 422 vs 409 — 用 422（Unprocessable Entity，符合「請求本身合法但 business rule 拒絕」），跟 master plan F-N-003 一致。

**Operator override**: 若未來要允許 operator 強制重評，加 `?force=true` 並檢查 operator email — 本 spec out of scope。

### 3.3 FE 上一步 lock 檢測（app.js:6727-6733）

**改動**：
```js
backBtn.addEventListener('click', function () {
  // Lock detection: if THIS step was already scored, lock the Phase 1 form
  var stepKey = AppState.circlesDrillStep;
  if (stepKey && AppState.circlesStepScores && AppState.circlesStepScores[stepKey]) {
    AppState.circlesLocked = true;
  }
  AppState.circlesPhase = 1;
  render();
});
```

`renderCirclesPhase1` 已有 `circlesLocked` 處理（app.js:3511 etc.），確認 locked 狀態下：
- form fields readonly + 提交 button 隱藏
- 「查看提示」「查看範例」永遠可用（per STANDING `feedback_lock_state_hint_example_always_available`）

### 3.4 Phase 3 「重新評分」 button — 條件 disable

**Affected file**: `public/app.js` line 6268（`renderPhase3Error` 或類似）

**改動**：
```js
var canRetry = !AppState.circlesStepScores || !AppState.circlesStepScores[stepKey];
var retryBtnHtml = canRetry
  ? '<button class="btn btn--primary" data-phase3="retry">...重新評分</button>'
  : '<button class="btn btn--primary" disabled title="此步已評分，不可重評">...重新評分</button>';
```

並在 click handler `data-phase3="retry"` (app.js:6509 附近) 加 guard：若已 scored → 不發 API。

## §4 E2E Integration Test 設計

**Required skill citations**（必引用且實際應用）：
- `playwright-skill/core/auth-flows.md:928-949` — API seed auth via `request.post('/api/auth/...')`
- `playwright-skill/core/common-pitfalls.md` Pitfall 11 — **禁 mock 自家 API**；只 mock `**/api.openai.com/**`（且 server-side OpenAI 也擋不到）
- `playwright-skill/core/common-pitfalls.md` Pitfall 19 — `test.step()` for multi-phase
- `playwright-skill/core/network-mocking.md:839-933` — `route.fulfill` 只用於 error state mock，不用於成功路徑
- `playwright-skill/core/multi-user-and-collaboration.md:306-343` — `Promise.all` race assertion if needed

**New spec**: `tests/e2e/circles-back-nav-lock.spec.js`

**Test matrix**（minimum, in 1 spec file）：

| TC | Scenario | Asserts |
|---|---|---|
| TC1 | Happy path lock-on-back | full Phase 1 → Gate → Phase 2 → submit conclusion → step scored → click 上一步 → Phase 1 form is readonly + submit button absent + hint/example button still works |
| TC2 | Re-scoring API rejection | Same as TC1, then attempt `/evaluate-step` via direct `request.post()` with same stepKey → expect 422 `step_already_scored` |
| TC3 | Phase 3 retry button disabled when scored | Reach Phase 3 → if any step is scored, retry button is disabled |
| TC4 | qchip 4-block 內容驗證 | Phase 2 點 qchip 展開 → assert 4 個 `.qchip-ana__block` 出現 + 內容跟 Phase 1 展開一致（用 `expect.toEqual` 對 textContent） |
| TC5 | Cross-step independence | Step C1 scored locked + Step I not yet scored → 進入 I 時 form 仍可編輯 |

**Counter assertion pattern** (per network-mocking.md 906-933)：
```js
let evaluateStepCallCount = 0;
await page.route('**/evaluate-step', async (route) => {
  evaluateStepCallCount++;
  await route.continue();
});
// ...run test...
expect(evaluateStepCallCount).toBe(1); // 不能呼第 2 次
```

**Real data only** (per STANDING `feedback_e2e_real_data_only`)：
- Real Supabase test DB seed via `getE2eToken()` from `tests/api/helpers/auth.js`
- 真實 OpenAI call for Phase 2 conclusion submit（test.slow()，~3-8s）
- No `jest.mock`, no stub timestamps, no `vm.createContext`

**Cross-viewport**: 3 projects (e2e-desktop, e2e-mobile-chrome, e2e-mobile-safari)。

## §5 Cross-surface Dependency Map (per master plan §5 pattern)

1. `/evaluate-step` BE guard depends on `session.step_scores` JSONB column 存在 — already shipped (Stage 1B)
2. FE lock detection depends on `AppState.circlesStepScores` 已從 session restore — already shipped (Stage 1B B3 retrofit C, commit 72e7797)
3. Phase 2 qchip-expand visual depends on `q.analysis` JSON 已 hydrate — already in `circles_database.json` 103 題

→ **0 新 dependency 引入**，純 fix。

## §6 Risk Assessment

| Risk | Severity | Mitigation |
|---|---|---|
| Phase 1 locked form 可能漏 readonly attribute 在某些 sub-renderer（L/E/S step）| P1 | E2E TC1 cover desktop + mobile + 7 step variants |
| BE 422 改動破壞既有 client 解錯（誤把 422 當 success）| P1 | 加 jest unit test for handler; 確認 FE error path 處理 422 顯示 friendly toast |
| qchip-expand 4-block 在 Phase 2 容器溢出（高度問題）| P2 | E2E visual snapshot cross-vp; mobile 360 特別 cover |
| Operator override 未來需求 | P2 | 留 BE comment 標 future hook，本 spec out of scope |

## §7 Out of Scope（顯式排除）

1. NSM 對話練習 qchip 統一（user 選 A）
2. Phase 4 final-report step rows lock（本來就 read-only，無 edit）
3. Operator force-rescore endpoint
4. `renderQchipPanelHtml` dead-code 刪除（plan 後續決定）
5. mockup 重寫（reuse 既有 `renderQchipExpand`）

## §8 Acceptance Criteria

1. **AC-1** (qchip drift): 全 7 CIRCLES drill step + locked state，Phase 2 qchip 展開後顯示 4 block（商業/用戶/誤區/破題），內容跟 Phase 1 一致；mobile/tablet/desktop layout 不爆。
2. **AC-2** (BE guard): `POST /api/circles-sessions/:id/evaluate-step` with already-scored stepKey → 422 with `error: 'step_already_scored'`. Real Supabase + real session test.
3. **AC-3** (FE lock-on-back): click 上一步 from Phase 2 (scored) → Phase 1 readonly + submit hidden + hint/example clickable + DB step_scores 不被覆寫.
4. **AC-4** (Phase 3 retry disable): scored step 的 retry button disabled + click no-op.
5. **AC-5** (E2E coverage): `tests/e2e/circles-back-nav-lock.spec.js` 5 TC 全 GREEN × 3 e2e projects × 5 consecutive runs (no flake).
6. **AC-6** (no regression): existing jest + Playwright suite no regression.

## §9 Implementation Phasing（for writing-plans skill）

建議 4 phase：
- **P1** BE guard + jest unit test for 422 (TDD red-green) — 最小可獨立 ship 防 re-scoring
- **P2** FE lock-on-back + Phase 3 retry disable
- **P3** qchip-expand 統一 + visual snapshot
- **P4** E2E spec full 5 TC + cross-vp verify + commit + cross-plan smoke

每 phase 都用 sub-agent (sonnet implementer + opus director cold-review) per `feedback_two_stage_review_mandatory`.

## §11 Frontend Verification Flow (per playwright-skill)

**目的**：BE guard + API test 證後端，FE 完整測試流程證使用者眼見為憑。每個 fix 都要走完 6 層 FE 驗證，缺一不能 ship。

### 11.1 Visual Regression — Pixel-diff snapshot
**Required skill**: `playwright-skill/core/visual-regression.md` 全篇

- `toHaveScreenshot()` baseline per state × per viewport
- Threshold 0.5% per project standard
- Cross-state:
  - `qchip-collapsed` × 3 vp × 3 e2e projects = 9 snapshot
  - `qchip-expanded` × 3 vp × 3 e2e projects = 9 snapshot
  - `phase1-locked-from-back` × 3 vp × 3 projects = 9 snapshot
  - `phase3-retry-disabled` × 3 vp × 3 projects = 9 snapshot
- Snapshot 路徑：`tests/visual/circles-back-nav-lock.spec.js-snapshots/`
- Diff fail → 必須 cold-Read PNG + commit 解釋 / 更新 baseline；禁靜默 update-snapshots

### 11.2 Cross-viewport coverage — 8 vp full sweep
**Required skill**: `playwright-skill/core/mobile-and-responsive.md:49-71`（device profiles）+ `279-322`（touch / `.tap()`）

- **8 device profiles**（per STANDING `feedback_test_all_devices_visual`）：
  - iPhone-SE / iPhone-14 / iPhone-15-Pro（webkit）
  - Mobile-360（chromium mobile small）
  - iPad（tablet）
  - Desktop-1280 / 1440 / 2560
- 每 viewport 必跑 happy + sad path
- iOS Safari project 用 `devices['iPhone 14']` (WebKit) — 別用 chromium mobile 偽裝 iOS

### 11.3 Locator Strategy — role-based 禁 CSS coord
**Required skill**: `playwright-skill/core/common-pitfalls.md` Pitfall 3 + `locator-strategy.md`

- 優先 `getByRole` / `getByLabel` / `getByTestId`
- 必要時 `data-*` selector（如 `[data-phase2="back"]`）
- 禁：`page.mouse.click(coords)` / 純 CSS class chain / index-based locator
- Lock state assert：`getByRole('button', { name: '繼續' }).toBeHidden()` 而不是 `.submit-btn.is-disabled`

### 11.4 Animation / Toggle / Interaction
**Required skill**: `playwright-skill/core/assertions-and-waiting.md` + `common-pitfalls.md` Pitfall 6（race）

- qchip click → 4-block expand animation 完成才 assert
- Use `expect.poll` or `expect(locator).toBeVisible({ timeout })` — 禁 `page.waitForTimeout(ms)`
- Phase 2 → Phase 1 transition 後等 `[data-phase1]` 出現再 assert lock state
- Network race：lock detection 必須在 step_scores rehydrate 完成後測 — 用 `expect.poll` 而非固定 sleep

### 11.5 Multi-context / Multi-tab（cache invalidation 驗證）
**Required skill**: `playwright-skill/core/multi-user-and-collaboration.md:27-58` + `306-343`

- 2 個 `browser.newContext()` 模擬 user 開 2 tab：
  - Tab A 完成 Phase 2 → step scored
  - Tab B（另一 context）打開 → 預期看到 lock state
- Storage event：lock 狀態跨 tab 同步驗證（localStorage `circlesStale` 觸發）

### 11.6 Accessibility check
**Required skill**: `playwright-skill/core/accessibility.md`

- Locked form：所有 input 有 `aria-disabled="true"` 或 `readonly` attribute
- Disabled retry button：`aria-disabled="true"` + 螢幕閱讀器友善 `title` 解釋為何 disabled
- 不只視覺隱藏 — 鍵盤 tab 不能聚焦

### 11.7 Director cold-Read PNG（強制紀律）
**STANDING memory**: `feedback_uiux_visual_only` + `feedback_two_stage_review_mandatory`

每 fix ship 前必走：
1. Playwright 截 6 state × 3 vp = 18 PNG
2. Director（opus）親 Read 全 18 PNG，每張 ≥ 1 句評論寫進 `audit/eyeball-{fix-name}.md`
3. Sonnet self-Read **不算數** — director cross-check
4. PNG 看到問題 → 直接退件，禁口頭描述代替

### 11.8 iOS Safari 15-item static review
**STANDING memory**: `feedback_ios_review_before_ship` + Master Spec §0.2

任何 mobile UX 改動（lock state 影響輸入 / qchip touch / Phase 2 transition）必走：
- focus / blur / touch / scroll / sticky / modal / SSE 15 項 checklist
- 對應 iPhone-SE 最小寬度 + safe-area

### 11.9 Pre-commit + CI gate
**Required skill**: `playwright-skill/ci/` + STANDING `feedback_cross_plan_smoke_after_each_ship`

- pre-commit hook：lint + jest 不過 → 擋 commit
- ship gate：full jest + Playwright × 8 vp 全綠才 push
- Cross-plan smoke：merge 後跑 critical-path + B5 lock 不破

### 11.10 Production walk（user 親跑 SOP）
**STANDING memory**: `feedback_verify_with_live_port`

- Dev server `localhost:4000` 開
- 寫 `audit/sop-2026-05-17-circles-lock-and-qchip-uat.md` 給 user 走：
  1. 登入 → 進 CIRCLES drill C1
  2. 完成 Phase 1 → Gate → Phase 2 對話 → submit conclusion
  3. 點「上一步」→ 確認 form readonly + hint/example 可用
  4. 點 qchip → 確認 4-block 展開
  5. 開第 2 個 tab → 確認 stale banner
  6. 全跑完每步截圖回報

---

## §12 Sub-agent Workflow（per user 4 條流程要求）

- **Opus director (me)**：
  - 寫 spec / writing-plans / dispatch / cold-review PNG / cross-vp gate / ship
  - cold-Read 不信 sonnet self-report
- **Sonnet implementer**（per phase dispatch）：
  - P1 BE guard: TDD red → green → jest unit + jest integration
  - P2 FE lock: TDD spec → impl → 自跑 5x verify
  - P3 qchip-expand: surgical change to renderCirclesPhase2/Locked → 自截 PNG
  - P4 E2E: 5 TC spec + 3 projects × 5 runs no flake
- **2-stage review per commit**: spec-compliance reviewer (opus) → code-quality reviewer (opus) per `feedback_two_stage_review_mandatory`
- Karpathy guidelines 4 條 prepend 每 dispatch

## §10 Self-review Checklist

- [x] Placeholder scan: 無 TBD/TODO
- [x] Internal consistency: §3 改動點 vs §4 E2E vs §8 AC 對應
- [x] Scope check: 5 個改動點 + 5 個 TC，1 plan 內可完成
- [x] Ambiguity check: qchip-expand 是 reuse 既有不重寫；lock 用 `AppState.circlesLocked` flag；retry button 用 disabled attribute
- [x] Skill citations 全引 line range：auth-flows 928-949 / pitfalls 11+19 / network-mocking 906-933 / multi-user 306-343
- [x] STANDING memories 對齊：feedback_lock_state_hint_example_always_available / feedback_e2e_real_data_only / feedback_two_stage_review_mandatory
- [x] User 3 條交付對映：(1) AC-1 / (2) AC-2+3+4 / (3) AC-5
