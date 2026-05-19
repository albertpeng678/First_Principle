# D-2 NSM localStorage 99.9% drop 假說驗證計畫

> **Purpose**: D-2 (NSM `pmdrill:nsm:draft:` localStorage 寫不讀) 已 plan 在 `audit/p2-c-drift-2-plan.md`，ship 前後如何**證明**它真的解了 NSM lifecycle='created' 99.9% drop？quiz reviewer NC-C 抓到的 gap：**沒有 real user 人口可拿 telemetry，那 ship 完怎麼說「有用」？**
>
> **Trigger**: 2026-05-19 quiz reviewer NC-C — 「假設驗證 vs production impact 驗證」不可混。本 plan 補洞。
>
> **Scope**: RESEARCH ONLY — 純 plan，不 implement、不改 production、不 git stage / commit。
>
> **Skills cited**:
> - Karpathy §4.1 Think Before — 列 competing hypothesis 與假說失效情境，先想再動；§4.4 Goal-Driven Execution — verifiable success criteria (測得到的 PASS 條件)
> - RITUAL service-role seed carve-out — 無 real user 人口情境下用 backend seed + Playwright e2e 模擬 user 互動
> - RITUAL 5x consecutive 0 flake — verification run 必跑 5 次穩定才算驗到
> - `feedback_three_iron_laws` IL-2 verification — claim "有效" 必有具體 verification command + 數字，不准 narrative
> - `feedback_e2e_real_data_only` — e2e 一律真資料、禁 stub timestamp / 禁 mock 自家 API
>
> **Karpathy 4 條 prepend** (per `feedback_karpathy_guidelines_standard`):
> 1. **Think Before** — 列出 D-2 假說、competing hypothesis (F-2)、measurement noise sources
> 2. **Simplicity First** — 用既存 `scripts/audit-nsm-conversion-funnel.js` baseline，不重寫 telemetry
> 3. **Surgical Changes** — verification 只加 1 個 e2e spec + 2 個 audit snapshot；不改 production
> 4. **Goal-Driven** — 每個 verification step 必有 PASS/FAIL 數字 + 「測到什麼 user-visible 行為」

---

## §1 Hypothesis statement

### Drift scan §3 D-2 完整引述

來源：`audit/nsm-circles-drift-scan-2026-05-19.md` §3 D-2 (P0)

> **Location write**: `app.js:2144` (`triggerNsmSaveCycle`)
> **Location read**: **0 處**
> **CIRCLES counterpart**: 寫 `app.js:3892`；讀 3 處 `app.js:6057 (qcard click) / 8356 (boot resume) / 8510 (restoreCirclesPhase1FromSession)`，每處都 merge local fresher / backend empty fallback。
>
> **Predicted bug**: 後端首次 PATCH 因為 race（card click → submit before debounce fires）→ NSM session row 仍是空 stub；用戶 reload → CIRCLES 用 local 恢復、**NSM 顯示空表單**。Live Supabase 觀察「`nsm_sessions` lifecycle 'created':999 vs 'gated':1 = 99.9%」可能部分被此 drift 放大。

### Improvement metric prediction

| Metric | Pre-ship baseline (假設 D-2 為 amplifier) | Post-D-2 expected | Confidence |
|---|---|---|---|
| `lifecycle='created'` % of all rows | ~99.9% (live 觀察) | **不能直接證明降到 N%**（無 user 流量） | **LOW** — 無人口時不可直接驗 |
| Step 1→2 drop (never typed NSM def) | 高 | 不會因 D-2 改善（D-2 是 restore 路徑，不影響第一次輸入） | HIGH |
| **「曾輸入過字、reload 後仍見到」success rate** | **0%** (write only no read) | **100%** (mirror CIRCLES) | **HIGH** — e2e 可直接驗 |
| Step 2→3 drop (after NSM def, no breakdown) | 真實 drop（C-T2 觀察 42.9%） | 可能改善 5-15%（如果 drop 部分是用戶 reload 後看空表氣餒） | **MEDIUM** |

**結論**: D-2 假說 **無法在 production metric 層級驗到 99.9% drop 改善**（因為沒人口）；但**可在 e2e simulation 層級驗到 100% draft-restore success rate**（從 0% pre-fix → 100% post-fix）。**那才是 D-2 的真實 success criteria**。

### Competing hypothesis: F-2 (sticky bar 蓋 mobile 第一欄)

**Background**: F-2 已 ship `a221cf0` (2026-05-17 PM) — `.nsm-body` padding-bottom 修 sticky bar 蓋住 mobile first field。

**F-2 vs D-2 attribution problem**:

| Hypothesis | 解釋 99.9% drop 的機制 | 預期改善的 funnel step |
|---|---|---|
| **F-2** (sticky bar 蓋第一欄) | 用戶在 mobile 上看不到/碰不到第一欄 → 根本沒輸入 → lifecycle 停 'created' | **Step 1→2 drop** (從未輸入) |
| **D-2** (localStorage 寫不讀) | 用戶輸入了但 reload 後看空表 → 氣餒不再輸入 → lifecycle 停 'created' | **Step 1→2 重複入場 drop** + **Step 2→3 drop** (輸過一次後不繼續) |

**Attribution 策略**: F-2 ship `a221cf0` 是 2026-05-17 PM，距今 ~2 日（2026-05-19 PM 寫此 plan）。
- **F-2 attribution 視窗**: 2026-05-17 ~ 2026-05-19 vs 2026-05-15 ~ 2026-05-17 比較（F-2 ship 後 2 日 vs ship 前 2 日）
- **D-2 attribution 視窗**: D-2 ship 後 2 日 vs D-2 ship 前 2 日（要求 ≥ 100 sessions per window 才有統計意義）
- **若 D-2 ship 時 2 日視窗仍 < 100 sessions**: attribution 不可靠 → 只用 e2e simulation 驗，標 "production-impact unverified"

**Note**: F-2 ship 時 baseline 沒先存 → F-2 attribution **已永久 lost**（學到的教訓：**ship 前必先存 baseline snapshot**，本 plan §2 設這個 ritual）

---

## §2 Pre-ship baseline metric

> **Mandatory before C-Drift-2 dispatch**: 跑 baseline；無 baseline = D-2 ship 後無 attribution 可能。

### §2.1 跑 baseline script

```bash
# 從 repo root
node scripts/audit-nsm-conversion-funnel.js > audit/d-2-baseline-2026-05-19.md
```

### §2.2 baseline 必含 9 個數字（從 script output 抽）

| # | Metric | Source (line in audit-nsm-conversion-funnel.js) |
|---|---|---|
| 1 | Total nsm_sessions rows | line 62-63 |
| 2 | Lifecycle distribution（4 個 bucket: created / editing / gated / completed） | line 67-75 |
| 3 | Step 1→2 drop % (never typed NSM def) | line 104, 109 |
| 4 | Step 2→3 drop % (after NSM def, no breakdown) | line 105, 110 |
| 5 | Step 3→4 drop % (after breakdown, no eval) | line 106, 111 |
| 6 | Time-to-drop median (created/editing 從 created_at → updated_at) | line 117-127 |
| 7 | < 1 min "bounced immediately" % | line 119, 128 |
| 8 | Recent 7 days S2 / S4 rate | line 137-152 |
| 9 | progress_json key distribution（看 stuck sessions 走到哪步驟） | line 186-201 |

### §2.3 baseline doc format

`audit/d-2-baseline-2026-05-19.md`:

```markdown
# D-2 Pre-ship Baseline (2026-05-19, PRE C-Drift-2 dispatch)

> Snapshot taken: <ISO timestamp from script line 64>
> Purpose: D-2 ship 後 post-snapshot 比這份 → attribution

## Raw output
<paste full stdout from `node scripts/audit-nsm-conversion-funnel.js`>

## 9 baseline numbers
1. Total: N
2. Lifecycle: created=X / editing=Y / gated=Z / completed=W
3. Step 1→2 drop: P%
4. Step 2→3 drop: Q%
5. Step 3→4 drop: R%
6. Time-to-drop median: M min
7. < 1 min bounced: B%
8. Recent 7d S2: S2_recent% / S4: S4_recent%
9. progress_json keys: { ... }

## F-2 retroactive comparison (best effort)
- F-2 shipped 2026-05-17 PM (`a221cf0`)
- F-2 ship 前 baseline: NONE (lost — 教訓)
- Post F-2 snapshot 2 日 (this baseline) = mixed-signal — can't isolate F-2 from natural noise

## What this baseline can support
- D-2 ship after this date → 2 日後跑 post snapshot → 差異即 D-2 contribution
- 「D-2 改善 N% lifecycle='created'」claim 必引這個 baseline + post 數字
```

### §2.4 baseline timing rule

- **必 ≥ 24hr before C-Drift-2 commit** — 避免 D-2 自己的 dev / e2e seed sessions 污染 baseline
- **跑 baseline 後** 確保 NSM staging / dev 用 `e2e@first-principle.test` 帳號 → auto-cleanup hook 不污染 production
- **baseline run 必 commit (git add audit/d-2-baseline-2026-05-19.md)** — 否則丟失就是 second loss

---

## §3 Post-ship verification（沒人口情境）

> Real user telemetry 沒辦法等到（user 流量 ~0/day）→ 改用 **e2e simulation + service-role seed test** 證明假說。

### §3.1 verification path 三層

| Layer | 證明什麼 | 工具 | 可信度 |
|---|---|---|---|
| **L1 Hypothesis layer** | D-2 修正方案 reverts 已知 bug shape | Playwright e2e simulation | HIGH (95%) |
| **L2 Mechanism layer** | localStorage merge 邏輯與 CIRCLES 等價（無 race） | Service-role seed + reload assert | HIGH (90%) |
| **L3 Production impact layer** | 99.9% drop 真的因 D-2 改善 | post-ship telemetry (需 ≥ 100 sessions / 2 weeks) | **LOW until pop > 0** |

### §3.2 L1 Hypothesis layer — Playwright e2e simulation

**新 spec**: `tests/e2e/d-2-localStorage-restore-verification.spec.js`

#### Test case TC-1: 標準 D-2 repro path

```js
// Karpathy §4.4: Goal-Driven — assertions 必 mirror 真 user 觀察
test('TC-1 NSM Step 2 fill → close tab before debounce → reload → draft restored', async ({ page }) => {
  // Setup: login real test user, navigate to NSM Step 2 fresh question
  await page.goto('/');
  // ... use `tests/setup/auth.setup.js` C_DRIFT_LANES storageState
  await page.click('[data-nsm="start"]');
  await page.click(SOME_QUESTION_CARD);
  // 進入 Step 2
  await page.waitForSelector('.nsm-rt-textarea[name="nsmDefinition"]');

  // ACTION: 輸 100 字 NSM definition
  const draftText = '每月活躍用戶數 (MAU) 為核心衡量 ...';
  await page.fill('[name="nsmDefinition"]', draftText);

  // CRITICAL: 在 800ms debounce 過完前 close tab → backend PATCH 不會 fire
  // 用 page.evaluate 在 debounce timer 還沒到時直接觸發 beforeunload + 寫 localStorage 已發生（input handler 即寫）
  await page.evaluate(() => {
    const raw = localStorage.getItem('pmdrill:nsm:draft:' + (window.AppState.nsmSelectedQuestion || {}).id);
    if (!raw) throw new Error('localStorage was not written — input handler broken');
  });

  // Close 模擬: 開新 page、舊 page close
  await page.close();
  const page2 = await context.newPage();

  // Reload + restore via offcanvas / history
  await page2.goto('/');
  await page2.click('[data-action="open-offcanvas"]');
  await page2.click('[data-session-id="' + sessionId + '"]'); // 觸發 loadCirclesSessionFromHistory NSM branch

  // ASSERT: NSM Step 2 textarea contains draftText (post-D-2 fix; pre-fix → empty)
  await expect(page2.locator('[name="nsmDefinition"]')).toHaveValue(draftText);
});
```

**Pre-D-2 expected (RED)**: textarea is empty (backend stub empty, no localStorage read)
**Post-D-2 expected (GREEN)**: textarea contains `draftText`

**Verification command**:
```bash
# 跑 5x consecutive per RITUAL 5x consecutive 0 flake
for i in 1 2 3 4 5; do
  npx playwright test tests/e2e/d-2-localStorage-restore-verification.spec.js --project=e2e-mobile-chrome
done | tee /tmp/d-2-l1.log
grep -c "passed" /tmp/d-2-l1.log  # must == 5
```

#### Test case TC-2: chaos engineering — backend 5xx

```js
test('TC-2 NSM PATCH 5xx race → localStorage still has draft → reload restores', async ({ page, context }) => {
  // 注意: per `feedback_e2e_real_data_only` 不可 mock 自家 success path，
  //       但 error state mock 是允許 carve-out (Pitfall 11)
  await context.route('**/api/nsm-sessions/*/progress', (route) => route.fulfill({ status: 503, body: '' }));

  // ... fill draft, wait 1000ms (past debounce, PATCH fails)
  // reload via history offcanvas
  // ASSERT: draft restored from localStorage even though backend has stub
});
```

#### Test case TC-3: D-6 partial coverage (切題 restore)

```js
test('TC-3 NSM A → fill draft → back to Step 1 → pick B → back to A → draft restored', async ({ page }) => {
  // Mirror drift scan §3 D-6 repro
  // ...
});
```

### §3.3 L2 Mechanism layer — service-role seed test

**Goal**: 證明 D-2 merge 邏輯與 CIRCLES line 8503-8527 行為等價（local fresher / backend empty fallback both work）

**Test case TC-4: service-role seed empty backend + populated localStorage**

```js
// Setup phase via service-role (per RITUAL service-role seed carve-out):
// 1. INSERT nsm_sessions row with user_nsm = null, user_breakdown = null, lifecycle='created'
// 2. evaluate (within Playwright): set localStorage 'pmdrill:nsm:draft:<qid>' = { userNsm: {...}, ts: Date.now() }
// 3. trigger loadCirclesSessionFromHistory(item) for this session
// 4. assert AppState.nsmDefinition merged from local
```

**Test case TC-5: backend has data + localStorage stale**

```js
// Setup:
// 1. INSERT nsm_sessions row with user_nsm = { def: 'BACKEND' }, updated_at = NOW
// 2. evaluate: set localStorage with older ts (NOW - 1 hour)
// 3. trigger restore
// 4. assert AppState.nsmDefinition = 'BACKEND' (server wins because newer + non-empty)
```

**Test case TC-6: backend empty + localStorage older**

```js
// Setup:
// 1. INSERT nsm_sessions row with user_nsm = null
// 2. evaluate: set localStorage with old ts
// 3. trigger restore
// 4. assert AppState.nsmDefinition merged from local (backendEmpty wins)
```

### §3.4 L3 Production impact layer

**Cannot verify until population > 0.** 預備：

- 2 weeks post D-2 ship → 跑 `audit-nsm-conversion-funnel.js` 存 `audit/d-2-post-2026-06-02.md`
- 比 `audit/d-2-baseline-2026-05-19.md` 數字 1-9 → 算 lifecycle='created' % delta
- **必須說「2 weeks 樣本 N=??」**；若 N < 100 → 標 "inconclusive"

**Telemetry instrumentation hook (preparatory)**:

- D-2 ship 時可同步加 1 行 console.info:
  ```js
  // 在 NSM merge 後加
  console.info('[d-2-telemetry] nsm draft restored from local', { qid: nsmQid, hadLocal: !!nsmRaw });
  ```
- 後續加 backend logging path（**不在 D-2 commit 範圍**；獨立 follow-up）

---

## §4 F-2 vs D-2 attribution split

### §4.1 F-2 retroactive comparison

**Constraint**: F-2 ship 前無 baseline → F-2 attribution **永久 lost**。最佳估：

- 跑 baseline `audit/d-2-baseline-2026-05-19.md`（2026-05-19）
- 與 historical script output 比較（若有 — 跨 git log 找）
- 標 "F-2 attribution: best-effort estimate, no proper baseline"

**Best-effort steps**:

```bash
# 找 F-2 ship 之前的 funnel snapshot（git log）
git log --all --oneline --grep="funnel\|conversion" | head -20

# 若無 → F-2 attribution = unrecoverable
# 教訓 → memory（建議補 STANDING: `feedback_baseline_before_ship_mandatory`）
```

### §4.2 D-2 attribution split

| 時間 | 動作 | 預期 |
|---|---|---|
| 2026-05-19 PM | 跑 baseline → `audit/d-2-baseline-2026-05-19.md` | snapshot A |
| 2026-05-19/20 | C-Drift-2 ship (D-2 + D-6) | new code live |
| 2026-06-02 (T+14d) | 跑 post snapshot → `audit/d-2-post-2026-06-02.md` | snapshot B |
| 2026-06-02 | Δ = B - A → lifecycle='created' % delta + S2→S3 drop delta | attribution |

**Attribution formula**:
```
D-2 contribution = (snapshot A 'created' %) - (snapshot B 'created' %)
                 - (other factors shipped between A and B)
```

`other factors` 必列：C-Drift-1 P0 D-1 persistRetry 也會降 'created' (PATCH retry → 後端落實 lifecycle='editing'). 因此 D-2 + D-1 attribution **耦合**；只有 ship interval 拆得開時才能分。

### §4.3 N < 100 sessions caveat

若 2 weeks 後 sessions < 100：

- **不 publish attribution claim**
- 改延長到 4 weeks
- 或改 publish "e2e simulation passed 100% (TC-1/2/3 × 5 consecutive 全 GREEN)" — 用 §3.2 數字代替

---

## §5 Risk + caveats

### §5.1 沒人口的 fundamental limitation

| Layer | 驗證可信度 | 為何 |
|---|---|---|
| L1 hypothesis (D-2 修法符合預期) | **95%** | e2e 直接 reproduce known bug shape，重複 5x 穩定即 PASS |
| L2 mechanism (merge 邏輯等價) | **90%** | service-role seed 控制變數；唯一 5% 留給「production race condition 與 e2e timing 不同」 |
| L3 production impact (真的解 99.9%) | **< 30% until N > 100** | 無人口 → 數字噪音壓過 signal；2 weeks N=2 vs N=100 完全不同等級 confidence |

### §5.2 「假設驗證」vs「production impact 驗證」

本 plan **明確區分**:

- **§3 layer L1+L2 = 假設驗證**（D-2 fix 程式正確、reverts known bug shape）→ ship 必過
- **§4 + §3 layer L3 = production impact 驗證**（真實 user metric 改善）→ ship 後 long-tail，**不 block ship**

**Ship gate decision**: L1+L2 全綠 → 放行 ship。L3 是 post-ship monitoring，不 gate。

### §5.3 假說失效情境（D-2 fix 卻沒見 metric 改善）

| 情境 | 解釋 | Mitigation |
|---|---|---|
| 99.9% drop **大部分是 F-2** | sticky bar 蓋第一欄是主因，D-2 只解次因 | 看 Step 1→2 drop pre F-2 vs post F-2 baseline（若無 baseline → lost） |
| 99.9% drop 是 **e2e dev pollution** | 過往 dev / e2e seed 跑 NSM 創 lifecycle='created' 但沒走完 | 跑 `scripts/scan-pollution.js` 看 created stale 比例 |
| 99.9% drop 是 **新用戶 onboard friction** | 用戶連 Step 1 都沒走進 Step 2（與 D-2 無關） | D-2 ship 後仍見高 created % → 改 dispatch C-T4 onboarding journey 斷點 find |
| D-2 fix 引入新 bug (race condition) | merge 邏輯 bug 反讓 user 看到 stale local 蓋新 backend | 跑 §3.3 TC-5 (server wins newer) — 必過 |

### §5.4 telemetry instrumentation 預備（D-2 一起 ship？）

**Pro**:
- 加 console.info('[d-2-telemetry] ...') 1 行 → 未來有 user 時可直接 grep server logs
- Surgical change, low risk

**Con**:
- 違反 surgical scope（D-2 是 fix，加 telemetry 是 observability）
- console.info 在 production 還是 noise

**建議**: console.info 不加；改加 **independent follow-up commit** "feat(telemetry): instrument NSM draft restore observability hook" — 不耦合 D-2 ship。Tracker append §3 follow-up entry。

### §5.5 5x consecutive 不夠時加碼

L1 TC-1 / TC-2 / TC-3 跑 5x 是 minimum。若 5x 中有 1 flake → 加碼 10x（per RITUAL 5x consecutive 0 flake STANDING）。

---

## §6 執行 checklist (when C-Drift-2 dispatch)

### Pre-dispatch (now)
- [ ] **跑 baseline** `node scripts/audit-nsm-conversion-funnel.js > audit/d-2-baseline-2026-05-19.md`
- [ ] **commit baseline** `git add audit/d-2-baseline-2026-05-19.md && git commit -m "..."`
- [ ] **append tracker** §2 D-2 verification path 引此 plan

### During C-Drift-2 ship
- [ ] Implementer 必先 read 本 plan + `audit/p2-c-drift-2-plan.md`
- [ ] e2e spec `tests/e2e/d-2-localStorage-restore-verification.spec.js` ship 同 commit
- [ ] 5x consecutive 跑 TC-1/2/3 全綠才放 director review

### Post-ship verification
- [ ] D+1: rerun e2e 5x 確 stability
- [ ] D+14 (2 weeks): rerun `audit-nsm-conversion-funnel.js` → `audit/d-2-post-2026-06-02.md`
- [ ] D+14: write attribution para to tracker §5 historical (resolved) — 含 baseline vs post 數字

---

## §7 Verifiable success criteria（單行 summary）

**D-2 ship considered verified when**:
1. e2e TC-1/2/3 5x consecutive **全 GREEN** (L1+L2 hypothesis layer) — **ship gate**
2. service-role seed TC-4/5/6 5x consecutive **全 GREEN** (L2 mechanism layer) — **ship gate**
3. 2 weeks post-ship funnel snapshot **存在且 committed** (L3 production impact, monitoring only) — **NOT ship gate**
4. 若 2 weeks N ≥ 100: D-2 attribution Δ ≥ 5% lifecycle='created' drop reduction → **strong claim**；< 5% 或 N < 100 → **weak claim, e2e signal 為主**

**Risk verdict (驗證可信度)**:
- **e2e + service-role seed simulation 層**: **~92.5%**（L1 95% + L2 90% 平均）
- **production impact 層**: **< 30%** until user population > 100 over 14-day window
- **Combined ship-gate confidence**: **~92.5%**（不靠 L3 也能放行 ship，靠 L1+L2 是 acceptable per Karpathy §4.4 Goal-Driven）

---

## §8 References

- `audit/nsm-circles-drift-scan-2026-05-19.md` §3 D-2 (P0)
- `audit/p2-c-drift-2-plan.md` (C-Drift-2 implementation plan)
- `scripts/audit-nsm-conversion-funnel.js` (baseline + post script)
- `public/app.js:2144` (NSM localStorage write site)
- `public/app.js:8503-8527` (CIRCLES localStorage read pattern — D-2 mirror source)
- `tests/setup/auth.setup.js` C_DRIFT_LANES (e2e test accounts)
- `feedback_three_iron_laws` IL-2 verification
- `feedback_e2e_real_data_only`
- `feedback_karpathy_guidelines_standard`
- RITUAL service-role seed carve-out / 5x consecutive 0 flake

---

## §9 Production code changes

**ZERO** — this is a plan doc only. No production / spec / test file edits. No git stage / commit.
