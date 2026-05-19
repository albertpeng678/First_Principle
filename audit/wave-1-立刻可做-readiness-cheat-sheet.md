# Wave 1「立刻可做」Dispatch Readiness Cheat-Sheet

> Director 寫的 pre-dispatch self-assessment，供 quiz reviewer 評估
> Date: 2026-05-17 PM
> Wave: 6 task（5 並行 + 1 second wave）

---

## 6 Tasks scope summary

| # | Task | File | E2E 涵蓋鏈條 | Baseline 來源 | RITUAL § |
|---|---|---|---|---|---|
| 1 | B13 adversarial 3 prompt | `tests/adversarial/` 3 新 spec | 不適用（jest adversarial IS the test；real OpenAI calls） | N/A（非 visual） | §3.9 / `feedback_adversarial_review_testing` |
| 2 | F-CT2.1 q3 卡片延後 session | `app.js:6270` + 新 e2e spec | click card → wait 2s → service-role SELECT count = 0 → navigate Step 2 → fill + PATCH → SELECT count = 1 → reload → state persists | 無 visual baseline | §3.8 service-role / Pitfall 11 carve-out (read-only seed) |
| 3 | F-CT1.3 CIRCLES gate backoff | `prompts/circles-gate.js:117` + jest unit test | 不需 Playwright e2e（純 backend prompt retry timing）；jest test 模擬 attempt counter + assert setTimeout delay | 無 | §3.9 error response / `feedback_adversarial_review_testing` |
| 4 | F-CT1.4 NSM gate i18n（Wave 2）| `routes/nsm-sessions.js` + `app.js` FE error display | server 503 → e2e assert FE 顯示中文「審核服務暫時無法使用」+ error code visible + 重試按鈕 + reload state preserved | 無 visual baseline；DOM assert only | §3.10 network-mocking 503 / Pitfall 11 carve-out |
| 5 | B6 D-1..D-11 mockup 04 drift | `app.js:5082-5198` `renderCirclesGate/renderGateResult` + `style.css` | drive to gate state per dim → assert DOM text/class match mockup 04 + visual regression × 3 vp | **MUST be mockup-source baseline** (capture mockup 04 HTML render → save baseline → diff production)；per new STANDING `feedback_visual_baseline_from_mockup_not_production` | §3.13 visual-regression / §3.11 cross-vp |
| 6 | NEW-Test-Debt nsm-step-2-3 dim count | `tests/visual/nsm-step-2-3.spec.js` line 109/127/191/214 | test-only fix（4 → 3 dim assertion）；read `NSM_DIMENSION_CONFIGS.attention/saas` for ground truth | 無新 baseline | 無 e2e（純 test 修正）|

---

## Pitfall mapping per task

- #1 B13: Pitfall 19 (test.step) — adversarial test logical grouping
- #2 F-CT2.1: Pitfall 11 (real backend; service-role seed for verify SELECT) + Pitfall 14 (test-local sessionId) + Pitfall 18 (page.evaluate AppState read) + Pitfall 19 (test.step phase) + Pitfall 3 (data-attr locator on card)
- #3 F-CT1.3: Pitfall 14 (test-local attempt counter)
- #4 F-CT1.4: Pitfall 11 carve-out (503 simulation OK) + Pitfall 18 (page.evaluate) + Pitfall 3 (role-based locator)
- #5 B6: Pitfall 11 carve-out (service-role seed to drive gate state deterministically) + Pitfall 18 (boundingRect via page.evaluate) + Pitfall 3 (data-attr) + §3.13 visual-regression
- #6 NEW-Test-Debt: 無 e2e

---

## 並行衝突 map（檔級）

```
#1 B13       → tests/adversarial/                      （隔離 ✓）
#2 F-CT2.1   → public/app.js:6270 ± 30 行              （隔離 ✓）
#3 F-CT1.3   → prompts/circles-gate.js:117             （隔離 ✓）
#5 B6        → public/app.js:5082-5198 + style.css      （與 #2 同檔不同區段；style.css 隔離）
#6 Test-Debt → tests/visual/nsm-step-2-3.spec.js        （隔離 ✓）

Wave 2:
#4 F-CT1.4   → routes/nsm-sessions.js + public/app.js   （等 #2/#5 stage 完才動）
```

#2 + #5 同檔 app.js 不同區段（6270 vs 5082-5198）— 各 sub-agent 必 Read fresh + 5+ 行 unique context Edit；Director 階段必 verify `git diff public/app.js` 只見對應區段。

---

## RITUAL 要求 per task

每 task 必含：
- ✅ TDD red → green log
- ✅ Karpathy 4 prepend in dispatch prompt
- ✅ Skill citations in spec header (per RITUAL §3.19)
- ✅ Live demo gate: stage NOT commit
- ✅ Director cold-Read self-report 不算數 warning
- ✅ Plain zh-TW report
- ✅ Real Data Only (`e2e@first-principle.test`)
- ✅ 5x consecutive 0 flake（jest 對 #1/#3；Playwright 對 #2/#4/#5；test-only 對 #6）
- ✅ Auto-cleanup fixture for any Supabase-creating spec (Bug A reviewer Critical lesson)
- ✅ For #5: baseline-from-mockup per new STANDING（不可 --update-snapshots from production）

每 task 完成後：
- 2-stage reviewer (spec compliance + code quality)
- Director cold-Read PNG / log
- User gate「對」才 commit

---

## 風險 + Mitigation

| 風險 | 機率 | Mitigation |
|---|---|---|
| #5 B6 sub-agent 又用 --update-snapshots 鎖 broken production baseline | 高（上次案例） | Prompt 明文禁；要求 baseline 必 mockup HTML capture |
| #1 B13 sub-agent 又自報 DONE 但檔在隔離 worktree 0 產出 | 中（上次案例） | Foreground dispatch + Director `git ls-files` cross-check post-report |
| #2/#5 同檔 app.js race lost-update | 低（不同區段，Edit 5+ 行 context） | 要求 stage 後 `git diff public/app.js` 只見自己區段 |
| Bug A spec 啟發的 leak：sub-agent 沒接 auto-cleanup | 中 | Prompt 明文要求 + reviewer 必驗 |
| F-CT2.1 改 session 建立時機，可能影響既有 NSM specs | 中 | 必跑 nsm-no-bypass + nsm-gate-result + audit-nsm-conversion-funnel no-regression |

---

## Director 自確 7 條（per RITUAL §13）

未 verify 前不算數。等 quiz reviewer 過關。

- [ ] 首要綱領 e2e integration test mandate
- [ ] IL-1 root cause / IL-2 verification / IL-3 TDD
- [ ] Pitfall 11/14/18/19/3
- [ ] Karpathy 4 條（Think Before / Simplicity First / Surgical Changes / Goal-Driven）
- [ ] 並行 5 上限 + opus/sonnet 分工
- [ ] Master tracker `audit/e2e-master-tracker.md` §1-§5 conventions
- [ ] User 殺手鐧 5 問（含 Q3 mockup ↔ production pixel-diff + Q4 skill citation + Q5 action→DB→reload→visible）

---

## 等 quiz reviewer 出題評估

---

# v2 補洞（per quiz reviewer FAIL — 5 critical + 3 次要）

> Quiz #1 (`agent a81264e1`) verdict: NOT READY。補完下面 8 條後重 quiz。

## Critical #1 — 並行衝突 map 補完（grep 後 facts）

**檔級實際衝突（已 grep verify）**:
```
#1 B13       → tests/adversarial/                          （隔離 ✓）
#2 F-CT2.1   → public/app.js:1779/4418/6280 (ensureNsmDraftSession callers)
              + 新 e2e spec                                  （style.css 未動 ✓）
#3 F-CT1.3   → prompts/circles-gate.js（self-contained, no shared import）（隔離 ✓）
#5 B6        → public/app.js:5082-5198 (renderCirclesGate) + style.css (gate area)
              + 新 visual spec                              （與 #2 同檔不同區段 ~1000 行 gap）
#6 Test-Debt → tests/visual/nsm-step-2-3.spec.js            （隔離 ✓）

Wave 2:
#4 F-CT1.4   → routes/nsm-sessions.js (imports nsm-evaluator/nsm-gate/nsm-hints；不 import circles-gate.js)
              + public/app.js FE error 區段（與 #2/#5 不同 region）
              （等 #2/#5 stage 完才動，避 same-file 三 agent 同時寫）
```

**並行隔離 strategy**:
- `public/app.js`: 3 task 動同檔但 3 個 region（5082-5198 / 6280 / 7158）— 每 sub-agent prompt 要求 `Read fresh + 5+ 行 unique old_string`；改後 `git diff public/app.js | grep '^@@'` 必只顯示自己 region
- `style.css`: 只 #5 動
- `tests/adversarial/` `tests/visual/` `prompts/` `routes/` 全隔離

**OpenAI rate limit budget**:
- #1 B13: 30 variants × 5 consecutive runs × 3 prompts = ~450 calls 真 OpenAI（gpt-4o-mini level）
- #2 F-CT2.1: e2e 新題卡片不調 OpenAI（純 session creation timing）— 0 calls
- #3 F-CT1.3: jest unit test 模擬 backoff timing（mock OpenAI）— 0 真 calls
- #4 F-CT1.4: e2e 503 simulation（page.route fulfill）— 0 真 calls
- #5 B6: service-role seed gate state（不調 OpenAI）— 0 真 calls
- **Risk**: #1 跑 450 calls 若 parallel 啟動可能 burst → rate limit 429
- **Mitigation**: dispatch #1 with `--maxWorkers=2` jest flag；其他 4 task 完全不調 OpenAI 故不衝突；若 #1 出 429，retry with backoff（B13 spec 本身就應該 build-in backoff for adversarial since prompt-circles-gate 也需 backoff）

**Tracker append conflict (critical)**:
- 5 sub-agent **不可** 同時寫 `audit/e2e-master-tracker.md` — git merge conflict 必然
- **Solution**: 每 sub-agent 寫自己 audit file `audit/wave1-task-{N}-findings.md`（隔離）；Director 等 5 個全 return 後 consolidate 進 tracker §1-§5 一次性寫入
- Sub-agent prompt 必明文：「**不可直接 append tracker.md**；寫 audit/wave1-task-{N}-findings.md 給 Director consolidate」

**任 1 return 立刻補下一個 (per RITUAL §7.3)**:
- 5 並行 Wave 1 跑時，若任 1 return → Director 立刻 dispatch #4（Wave 2）填空，維持 5 並行 throughput
- 若 #4 已 dispatch + 任 1 return → 不補（Wave 結束，等全收集完）

---

## Critical #2 — B13 不可豁免 §1 e2e integration mandate

**Reviewer 抓對**：我寫「不適用 e2e」=違反 §1 首要綱領「所有修復與優化必過 e2e」。

**修正**: B13 dispatch 必含 **2 leg**：
- (a) Jest adversarial spec：30 變體 × real OpenAI → assert robust threshold（原 plan）
- (b) **新增**: Playwright e2e regression `tests/e2e/wave1-b13-prompt-regression-smoke.spec.js`：
  - 真實 user 走 CIRCLES Phase 2 結論送出 → 觸發 `circles-conclusion-check` prompt → assert response shape 合 schema + advance Phase 3 OK
  - 真實 user 走 CIRCLES Phase 4 → 觸發 `circles-final-report` → assert 7-axis radar render
  - 真實 user 走 coach 思路展開 → 觸發 `circles-coach-version` → assert content non-empty
  - 3 vp × 3 prompt = 9 specs，5x consecutive
  - 這是 baseline regression — 若 B13 後 prompt 行為跟 ship 前 diff，紅燈
- 兩 leg 全綠才 b13 ship

---

## Critical #3 — #5 B6 必補 full-flow spec

**Reviewer 抓對**：用 service-role seed gate state 只測 DOM = short-circuit real flow，違反 §1。

**修正**: B6 dispatch 必含 **2 layer**：
- (a) **DOM/visual spec** (per dim per state): service-role seed `circles_sessions.step_scores` 到 ok/warn/error/loading state → render → DOM assert (D-1..D-11 drift fix) + visual regression
- (b) **新增 full-flow spec** `tests/e2e/wave1-b6-circles-phase1-to-gate-real-flow.spec.js`:
  - login → CIRCLES home → 選題 → Phase 1 form 填 → 送 → **真 OpenAI gate evaluator** → assert gate UI render with all D-1..D-11 fix correctness
  - 3 vp × ok/warn/error 3 states（用真實 input 觸發不同 evaluator output）
  - 1x baseline run（rate limit budget 控制；不跑 5x consecutive 因為 OpenAI cost）
  - 證明 full flow user → DB → reload → visible 沒破

---

## Critical #4 — Mockup baseline mitigation 升級（4 條 + STANDING §3/§4/§5 顯式 cite）

per STANDING `feedback_visual_baseline_from_mockup_not_production` 完整 5 條（cheat-sheet v1 只列 1 條）:

1. **Sub-agent prompt 明文禁** (cheat-sheet v1 已有):
   - 「**禁** `--update-snapshots` from production」一字不漏複製進 prompt
2. **Director 親跑 baseline-generation step** (補):
   - Sub-agent 寫 `scripts/capture-mockup-04-baselines.js`（Playwright render mockup 04 HTML → 截 3 vp PNG → save to spec snapshot folder）
   - **Sub-agent 不執行該 script** — 由 Director 親 run 確認 baseline 來源純粹 mockup
   - Sub-agent spec 文件指向已存在 baseline，不 trigger `--update-snapshots`
3. **2-stage reviewer 加 grep check** (補):
   - Reviewer prompt 必含：`git log -p tests/visual/*.spec.js-snapshots/ | grep '\-\-update-snapshots'` → 抓 commit history 有沒有偷用
   - `grep -rn 'updateSnapshots\|update-snapshots' tests/` → spec 本身有無誤觸 flag
4. **Director 並排 Read full-page mockup vs production PNG** (補):
   - 不只 Read sub-agent 單 dim card audit PNG
   - Director 自跑 `tests/visual/director-bug-b-3vp-verify.spec.js` 改 b6 變體 → capture **full functional area** (整段 phase 1.5 gate UI + 周邊 progress bar + context) × 3 vp
   - 並列 `audit/Bug-B-director-verify/` 跟 `audit/mockup-04-baseline/` 兩 dir 1:1 對照 Read
5. **`getComputedStyle()` padding/spacing 3 件 measurement diff** (補):
   - B6 spec 必 `page.evaluate(() => getComputedStyle(target).padding/background/border)` 抽數字
   - 對比 mockup 04 spec CSS 數字（手動讀 mockup HTML CSS 區段）
   - 若 diff > 1px tolerance → spec fail
   - 防 Bug B-style padding silent loss

---

## Critical #5 — Reviewer prompt template（4 staging hygiene + 7 anti-pattern）

per STANDING `feedback_two_stage_review_caught_critical.md` §2-§4。每 task 完成後 reviewer 必含 checklist:

**Staging hygiene 4 check**:
```bash
# 1. Staged stat sanity
git diff --cached --stat | head -10

# 2. Untracked spec file detect (case: Bug B/Wave#2 spec 沒 git add 漏接)
git ls-files --others --exclude-standard | grep -E '\.spec\.js$|\.test\.js$'

# 3. Deleted-class cross-spec reference (case: nsm-dim__label 砍掉但 2 specs 還在用)
for cls in $(removed_classes); do
  grep -rn "\.$cls" tests/ --include='*.spec.js' --include='*.test.js'
done

# 4. Dead var detect (case: app.js:7128 headers block 已沒 reader)
grep -rn 'var <removed-var>\|^let <removed-var>' production-file
```

**7 anti-pattern checklist (本 session 真實案例)**:
1. Spec file untracked but testMatch regex includes it (Wave 1B-b Bug B / Wave #2 案例)
2. CSS class deleted but other specs still grep it (Bug B 案例)
3. Production dead var left after function call site changed (Wave #2 headers 案例)
4. Auto-cleanup fixture missing → Supabase session leak (Bug A 案例)
5. Comment line# inconsistent across files (Bug B style.css 720-721 vs app.js 1355-1384)
6. Baseline self-referential (Bug B `--update-snapshots` from production 案例)
7. Sub-agent reports DONE but files in isolated worktree not main repo (B13 案例)

---

## 次要 #6 — dispatch prompt 顯式禁令詞（複製 verbatim）

每 sub-agent prompt 必含此塊（複製不變）:

```
🚫 ABSOLUTE PROHIBITIONS (do not violate):
1. 禁用 `--update-snapshots` 從 production 自生 visual baseline (per STANDING feedback_visual_baseline_from_mockup_not_production)
   — 若 baseline missing → STOP，report blocker；不可自跑 `--update-snapshots`；Director 親跑 mockup capture
2. 禁 mock 自家 backend success path (Pitfall 11) — error state 503/401 carve-out OK
3. 禁 `await page.waitForTimeout(<ms>)` hard sleep (RITUAL §3.14) — 用 expect.poll / waitForResponse / waitForFunction
4. 禁 module-level shared state (Pitfall 14) — test-local fixture only
5. 禁直接 append `audit/e2e-master-tracker.md` (避並行 conflict) — 寫 `audit/wave1-task-<N>-findings.md` 給 Director consolidate
6. 禁 self-approve「DONE」without Director cross-check (per STANDING feedback_subagent_self_report_unverifiable) — report 必含 git ls-files 結果
7. 禁 commit (Live demo gate) — 只 stage，等 user 「對」
```

---

## 次要 #7 — #2 hard sleep 矯正

原 e2e plan: 「click card → wait 2s → SELECT count = 0」

**修正**: 改 `expect.poll`:
```js
// Bad (Hard sleep)
await page.waitForTimeout(2000);
const count = await admin.from('nsm_sessions').select('count').single();
expect(count).toBe(initialCount);

// Good (expect.poll, RITUAL §3.14)
await expect.poll(async () => {
  const { count } = await admin.from('nsm_sessions').select('*', { count: 'exact', head: true }).eq('user_id', testUser);
  return count;
}, { timeout: 5000, intervals: [500, 1000] }).toBe(initialCount);
```

---

## 次要 #8 — Director cross-check 5 步 checklist (per STANDING `feedback_subagent_self_report_unverifiable` §3)

Sub-agent 報 DONE 後 Director 必跑（complete 5 步，cheat-sheet v1 只列 2 步）:

```bash
# 1. File existence (主 repo)
find <expected-spec-path> -name '<spec-name>'

# 2. Disk content non-empty + skill citation 存在
grep -n 'Skills applied' <spec-path>
wc -l <spec-path>

# 3. Git tracked
git ls-files --error-unmatch <spec-path>

# 4. Git -S production diff verification
git diff --cached <production-file> | grep '^[-+]' | head -20

# 5. 5x consecutive 親跑（最低門檻 1x sanity）
npx playwright test <spec> --project=e2e-desktop --reporter=list 2>&1 | tail -10
```

任 1 步 fail → sub-agent retry / Director 人工調整。

---

## v2 補洞後並行 final plan

**Wave 1 (5 並行)**：
1. **#1 B13** — Foreground (no background worktree); + e2e regression smoke (Critical #2 leg b); rate limit `--maxWorkers=2`
2. **#2 F-CT2.1** — app.js:6280 region (logic only)；e2e 用 expect.poll 不 hard sleep（次要 #7）；spec 含 reload → state persists（RITUAL §1 完整）；auto-cleanup fixture
3. **#3 F-CT1.3** — prompts/circles-gate.js 1 行 + jest unit test
4. **#5 B6** — DOM/visual spec (seed-based, per dim per state) **+** full-flow spec (real OpenAI 1x baseline run, Critical #3 leg b)；baseline-from-mockup（Director 親跑 capture step, Critical #4）；4 個 measurement diff（Critical #4 升級）；auto-cleanup
5. **#6 NEW-Test-Debt** — test 修 4 → 3 dim assertion

**Wave 2 (1)** 跑完 #2/#5 stage 後：
6. **#4 F-CT1.4** — routes/nsm-sessions.js + app.js FE error display

**每 task 後 2-stage reviewer**（per Critical #5）含 4 staging hygiene + 7 anti-pattern check。

**Tracker append**: 每 sub-agent 寫 `audit/wave1-task-{N}-findings.md`；Director 等 5+1 全收完 consolidate 進 tracker §1-§5（避 6 並行 conflict）。

---

## Director 自確 7 條 (per RITUAL §13) — v2 補洞後

**禁** Director 自己打 ✓。等 quiz reviewer 重評。

- [ ] 首要綱領 e2e integration test mandate（**B13 含 e2e leg ✓ per Critical #2**）
- [ ] IL-1 root cause / IL-2 verification / IL-3 TDD（**5 步 cross-check ✓ per 次要 #8**）
- [ ] Pitfall 11/14/18/19/3（**禁令詞 verbatim ✓ per 次要 #6**）
- [ ] Karpathy 4 條
- [ ] 並行 5 上限 + opus/sonnet 分工（**tracker append 隔離 ✓ + OpenAI rate limit budget ✓ per Critical #1**）
- [ ] Master tracker `audit/e2e-master-tracker.md` §1-§5 conventions（**經 audit/wave1-task-N-findings.md 中介 ✓**）
- [ ] User 殺手鐧 5 問（**Q3 mockup vs production 4 條升級 ✓ per Critical #4 + Q5 action→DB→reload→visible ✓ per #2 spec**）

