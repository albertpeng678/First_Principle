# Path 2 — Frontend Rewrite · 接手 Handoff

> **下個 session / 接手 Claude 必讀**。先讀本檔（5 分鐘 orient）→ 然後 `audit/e2e-master-tracker.md`（單一 source of truth）→ 然後 `CLAUDE.md`（即時 state board）。
>
> **Last updated:** 2026-05-17 ~05:30 Taipei（chat-drift 全 ship + Plan #194 T3/T6 ship + jest 5 fail 重分類發現 lifecycle gate→gated P0 bug + master tracker §1-11 完整版）
>
> **Top priority post-compact**: ① P0 lifecycle gate→gated wiring fix ② P0 iOS Safari Phase 3 restore fallback fix ③ Bug 1 Gate 全 Y 重驗

---

## §A 0-Minute TL;DR

User 用「**首要綱領：所有修復與優化都要經過 e2e 整合測試，不能僅測單元，以確保不見樹不見林**」要求 e2e integration test 為頂層紀律。並行上限 3 個 sub-agent，opus 為 director + 稽核（cold-Read PNG / 親跑 5x），sonnet 為 implementer。

過去 24 小時完成：
- ✅ Chat-drift plan FULLY SHIPPED end-to-end（10 commits + push origin/main）— qchip 4-block + lock-on-back + cross-vp 全綠
- ✅ Plan #194 T3 await fix（data loss critical）+ T6 NSM evaluate checkpoint ship + 全 GREEN
- ✅ Bug 4 NOT_REPRODUCIBLE audit（7 scenarios + 12 PNG），need user clarify
- ⚠️ Plan #194 T4 partial ship（TC1 pending diagnose）
- ⚠️ Bug 3 INCONCLUSIVE（test window too short）
- 🔴 **新揪 P0 bug**：lifecycle gate→gated wire 漏（4 routes，user-visible session list filter 錯）
- 🔴 **新揪 P0 bug**：iOS Safari Phase 3 restore fallback「待 Plan B 實作」（對應 user PNG-23）
- 🟡 **新揪 P1 infra**：auth.setup.js parallel race（atomic rename `313b4fd` 沒解 burst load）

**Single source of truth**: `audit/e2e-master-tracker.md`（11 sections，living document，永遠最新）

---

## §A.5 Phase 1-4 計畫 — B+C 全收（user 立 2026-05-17 PM）

> **下個 session 接手照這 4 phase 順序動工**。
>
> **規矩 STANDING**（每 task 必走）：
> - **find-first → log tracker → user brainstorm → 才 fix**（per memory `feedback_find_first_fix_later_via_tracker.md`）
> - **Live demo gate**：所有 production / mockup 變動 stage 不 commit → 截 PNG → user 親眼「對」→ 才 commit（per `feedback_live_demo_gate_protocol.md`）
> - **每需 user 確認時必發聲音**：`afplay /System/Library/Sounds/Hero.aiff` + macOS notification（per `feedback_sound_ping_on_confirmation.md`）
> - **報告白話文不用 jargon**（per `feedback_plain_language_report.md`）

### Phase 1 🔴 商業最痛（~1-2 天） — ✅ **全 ship 2026-05-17 PM**

| Task | 性質 | 狀態 |
|---|---|---|
| **C-T1 find** | AI 4 surface error audit (5 findings F-CT1.1~1.5) | ✅ DONE — tracker §3；F-CT1.1 + F-CT1.2 已 fix；F-CT1.3/1.4/1.5 backlog |
| **C-T2 find** | NSM 99.9% conversion 線上深挖 (4 findings F-CT2.1~2.4) | ✅ DONE — tracker §2；q3 卡片即建 session 5487 噪音 / 真實 S2→S3 42.9% drop |
| **B10 / O-6 fix** | `_doOffcanvasDelete` invalidate cache | ✅ SHIPPED `e811378` |
| **B6 / #21** | mockup 04 audit (11 drift 找到 vs 估 9) + D-4 fix | ✅ FIND DONE / D-4 ship `1b75c0f`；D-1/2/3/5/6/7/8/9/10/11 backlog |
| **B13 / O-11** | adversarial 擴 3 prompt | ⚠️ Sub-agent silently failed (0 檔 disk) — **re-dispatch needed**；視為 IL-2 違反案例已 log |

**Phase 1B 加碼 ship**:
- F-CT1.1 NSM evaluator spinner 卡死 `1b75c0f`
- F-CT1.2 CIRCLES Phase 2 silent fail `b126937`
- B6 D-4 warn icon 顏色相反 `1b75c0f`
- NEW-Bug-A NSM 切題 ghost content `b126937` (mirror CIRCLES #252)
- NEW-Bug-B NSM hint-row position `b126937` (mockup 07 line 1355-1384 canonical)

**Phase 1 出口條件**: ✅ tracker §2-§3 多筆 finding + 5 fix shipped + reviewer 抓到 7 Critical 全補修

### Phase 2 🟠 覆蓋率擴張（~2-3 天）

| Task | 性質 | 工時 |
|---|---|---|
| **C-T3** | CIRCLES director walk + PNG cold-Read（仿 audit-nsm-director-walk pattern 寫 CIRCLES：home → Phase 1 → 1.5 gate → Phase 2 chat → Phase 3 score → Phase 4 final × 3 vp） | 3h |
| **C-T4 find** | 完整新用戶 e2e journey（註冊 → onboarding → 第 1 個 CIRCLES → 完成 → 第 1 個 NSM → 完成 → history）+ 訪客 → 註冊 migration 子 case | 5h |
| **C-T6** | 8 viewport 擴 e2e config（從 3 projects → 加 iPad / iPhone-SE/14/15Pro / desktop 1440/2560 = 8）+ 跑 NSM full + CIRCLES full × 8 | 3h |
| **B1 / #257 Phase A** | F-007 wave 第 1-2 batch（~20 specs route.fulfill → real Supabase） | 5h |

**Phase 2 出口條件**: CIRCLES PNG walk 完整 + new user journey 找到 N 個斷點 + 8 vp baseline + 20 specs 已 refactor。

### Phase 3 🟡 Robust 防護（~2-3 天）

| Task | 性質 | 工時 |
|---|---|---|
| **C-T5** | iOS Safari 15-item 自動化（focus / sticky / modal / SSE / scroll restoration — 把 RITUAL §6 manual checklist 變 spec） | 6h |
| **C-T10** | cross-tab + cross-device race（2 tab newContext 同時改同 session / 桌機開 → 手機看到 sync） | 4h |
| **C-T11** | a11y baseline e2e（@axe-core/playwright 跑 NSM + CIRCLES 全步驟） | 3h |
| **B1 / #257 Phase B** | F-007 wave 第 3-5 batch（~30 specs） | 6h |
| **B2 / F-001** | Trophy 加 30-40 API tier specs（從 95 E2E vs 18 API 改善往 60% API target） | 6h |

### Phase 4 🟢 Polish + debt（~1-2 天）

| Task | 性質 | 工時 |
|---|---|---|
| **C-T12** | Performance budget gate（Lighthouse CI 或 playwright-test-perf；LCP < 2.5s / TTI < 3.5s / 慢 3G < 8s） | 4h |
| **B7 / O-2** | Delete 5 vm.createContext app.js helper specs（after F-007 wave） | 1-2h |
| **B8 / O-3** | Unmount stale routes/prompts dead code（`routes/sessions.js` / `prompts/coach.js` 等） | 1h |
| **B9 / O-5** | Plan #194 T7/T8/T9 remaining（spec reorg + adversarial 5 + final regression cold-Read 4 toast PNG） | medium |
| **B11 / O-8** | jest "pre-existing fails" reclassification policy（process change，已 informally 執行）| process |
| **B12 / O-10** | Extract `_doOffcanvasDelete` / `bindOffcanvas` helper（app.js ~8200 LOC large refactor） | large |
| **B14 / O-12** | `auth.setup.js` `:3000` fallback flag 改正（~1 line） | tiny |
| **B3 / #207** | B5 decision — Stage 1C revert vs keep | user owned |
| **B4 / #199** | Trophy Step 4 cross-verify duplicate with #212 → close | 30min |
| **B5 / #205** | Retrofit G — delete hollow tests + test-supabase mock library（after F-007） | 2-3h |

### Director 接手節點（compact 後直接照 phase 動工）

1. 讀 `CLAUDE.md`（30 秒）+ 本檔 §A.5（這段）+ `audit/e2e-master-tracker.md` §1-§3
2. 當前在哪個 phase = CLAUDE.md Phase 表 + 看 tracker §5 已 close 的 item
3. 從未完成的第 1 個 task 起跑
4. **find-phase task**：跑 e2e walk / 程式 audit / 查線上資料 → finding append tracker §1-§3 → **NO commit production**
5. **fix-phase task**：user 看完 finding → 決定優先 → Live demo gate（stage → PNG → user 「對」→ commit）
6. 每 commit push origin/main（直推 main）
7. 每 phase 完 → CLAUDE.md mirror + tracker §5 sweep

---

## §B 接手 1 分鐘必讀順序

1. **本檔（PATH-2-HANDOFF.md）** — 你現在讀的
2. **`audit/e2e-master-tracker.md`** — §1 P0 / §2 P1 / §3 P2 / §4 verification matrix / §7 paused plans / §9 cross-references
3. **`CLAUDE.md`** — 即時 state board，當前狀態 30 秒讀完
4. **`SESSION-START-RITUAL.md`** — 開工 ritual + 10 條 Standing Rules（違反退件）
5. **memory MEMORY.md** at `/Users/albertpeng/.claude/projects/-Users-albertpeng-Desktop-claude-project-First-Principle/memory/MEMORY.md` — 30+ STANDING memories

讀完這 5 個就 fully orient。**禁止**先動手才讀。

### Visual-regression baseline 紀律（2026-05-17 PM 立）
**每個 visual spec 的 baseline 必須 source from mockup HTML，不可 `--update-snapshots` 從 production**（per STANDING `feedback_visual_baseline_from_mockup_not_production`）。違反案例：Bug B 2026-05-17 PM baseline 自 production 生 → padding 漏 user 親眼抓到。
- 新 spec：先 Playwright render mockup HTML → 截圖 → 存 baseline → production diff against mockup
- 既有 spec：tracker §6 O-13 backlog「scan all visual baselines + tag mockup-sourced vs production-sourced + migrate」
- CSS 大改前：必跑 `page.evaluate getComputedStyle padding/background/border` 對比 mockup spec 數字

---

## §C 當前 in-flight / 未解 work（必修順序）

**注**：原本 P0 排序的 5 項 + P1 排序的 4 項全部已 closed (2026-05-17 PM session)，詳見 `audit/e2e-master-tracker.md` §5。當前未解事項見 tracker §1-§3。

### P0 排序

✅ **0 items active** — 上一輪 5 個全 closed (§5)

### P1 排序

| # | Issue | Source | Action |
|---|---|---|---|
| 1 | **F-CT1.3** CIRCLES gate prompt 無 backoff | tracker §3 C-T1 finding | `prompts/circles-gate.js:117` 前加 1 行 `await new Promise(r => setTimeout(r, 800*(attempt+1)))` |
| 2 | **F-CT1.4** NSM gate error message leak + 缺中文分類 | tracker §3 C-T1 | route catch 統一 `{error:'ai_service_error', code:'GATE_TIMEOUT/GATE_API_ERROR'}` + FE 中文對應 |
| 3 | **B6 D-1/D-2/D-3/D-5/D-6/D-7/D-8/D-9/D-10/D-11** | tracker §3 B6 finding | 10 個 mockup 04 drift（copy / icon / count 格式）可批次走 visual regression spec |
| 4 | **F-CT2.1** q3 卡片即建 session 5487 噪音 | tracker §2 C-T2 | `app.js:6270` 延後 `ensureNsmDraftSession()` 到 Step 2 first PATCH |
| 5 | **B13 re-dispatch** | tracker §6 O-11 | 上次 sub-agent 自報 DONE 但 0 檔產出（IL-2 violation）— 重派需明確 git -S verify |
| 6 | **P1-#257** F-007 wave ~65 hollow API specs | tracker §2 | 8-15h parallel 5-7 batch × 3 lane |
| 7 | **P1 F-001** Trophy inversion 95 E2E vs ~18 API | tracker §2 | 加 ~30 API tier specs 往 60% target |

### P2 排序

| # | Issue | Source |
|---|---|---|
| 1 | NEW-Test-Debt `nsm-step-2-3.spec.js` 4 dim → 3 dim (impact removal) | tracker §3 |
| 2 | F-CT2.3 12 sessions pre-L19 scores 但 lifecycle=created | tracker §2 |
| 3 | F-CT2.4 q3 視覺權重 UX 調整 | tracker §2 |
| 4 | #207 B5 decision / #199 Trophy Step 4 / #205 Retrofit G | tracker §3 |

詳細看 master tracker §1-§3。

---

## §D 過去 24h 主要 commits（按時序）

```
7d71e13  audit(master-tracker): full §1-11 rewrite — P0 lifecycle bug + paused plans + xref
4f55b22  audit(master-tracker): expand to full 8-section living doc
569782f  audit(master-tracker): living e2e issue + optimization single source of truth
536a1e9  audit(bug3): spinner-stuck reproduce INCONCLUSIVE — 12 PNG evidence
87e1999  feat(persistence): Plan #194 T6 ship + T4 partial (TC1 pending diagnose)
3af488d  audit(bug4): offcanvas delete cache NOT_REPRODUCIBLE — 7 scenarios GREEN
ab28219  chore(claude-md): mirror CIRCLES chat drift + lock ship 2026-05-17
8e51b8f  docs(audit): UAT SOP for circles lock + qchip 4-block ship
34c1361  test(e2e): T4 SSE qchip persistence — real Playwright verification
217c342  test(visual): chat-drift Task 6 — 6 baseline snapshots + Director cold-Read
313b4fd  fix(e2e-infra): atomic storageState write + T5 cleanup remove test.slow()
c3bc286  test(e2e): T5 5 TC integration — chat-drift Wave 2
49d00ba  feat(fe): Phase 2 qchip reuse Phase 1 renderQchipExpand (AC-1)
3a61489  feat(fe): Phase 3 retry button disabled when step scored (AC-4)
d8e4814  feat(fe): Phase 2 上一步 → lock Phase 1 if step scored (AC-3)
24c2ac6  fix(fe): T2/T3 follow-up — canonical lock derive + rehydrate
d930159  feat(routes): /evaluate-step 422 guard reject re-score (AC-2)
32d348e  fix(circles-gate): await gateResult PATCH before render (T3 RES-AC4) [Plan #194]
4a01550  docs(plan): CIRCLES chat drift + lock plan — 7 task bite-sized TDD
b2ca935  docs(spec): CIRCLES chat drift + lock-on-back design — user approved
```

Full git log via `git log --oneline -50`。

---

## §E 8 個 user-reported bugs 狀態

| # | Bug | Status | Commits / Audit |
|---|---|---|---|
| 1 | Gate 全 Y 過審 | ⚠️ ship 後 user re-report，need re-verify | `ae270f3` `f53038e` |
| 2 | PNG-20 ghost content | ⚠️ ship 後 user re-report | task #209 closed, re-investigate |
| 3 | PNG-21 回評分卡轉圈 | ⚠️ INCONCLUSIVE | spec `tests/e2e/bug3-spinner-stuck-reproduce.spec.js` `536a1e9` |
| 4 | Offcanvas delete cache | ⚠️ NOT_REPRODUCIBLE | spec `tests/e2e/bug4-offcanvas-delete-cache-reproduce.spec.js` `3af488d` |
| 5 | PNG-22 對話練習 qchip 對齊 | ✅ SHIPPED via chat-drift | `49d00ba` + `34c1361` |
| 6 | 沒審核直接放行 | ✅ Phase 4 422 VERIFIED, 其他 path 待 enumerate | `611a677` |
| 7 | PNG-23 已填內容消失 | ⚠️ partial — iOS Safari fail (P0-#263) | desktop+mobile-chrome GREEN |
| 8 | PNG-24 test fake data | ✅ Group A V1-V8 + retrofit C/D/E/F shipped | many commits |

---

## §F 早上 user 交付 3 條 requirements 狀態

1. **對話練習修法套到所有 CIRCLES 7 step** ✅ chat-drift ship 涵蓋（renderCirclesPhase2 + Locked shared helper）
2. **完整步驟已評分 step 鎖死防重新評分** ✅ AC-2 BE 422 + AC-3 FE lock-on-back + AC-4 Phase 3 retry disable
3. **E2E 完整覆蓋** ✅ TC1-TC5 × 3 e2e projects × 10 runs no flake

---

## §G 紀律總綱（Iron Laws + Standing Rules）

### 首要綱領（2026-05-17 user 立，覆蓋全部）
**所有修復與優化都要經過 e2e 整合測試，不能僅測單元，以確保不見樹不見林。**
→ memory `feedback_e2e_integration_supreme.md`

### Iron Laws (memory `feedback_three_iron_laws.md`)
- **IL-1**: 解 root cause 不 hide symptom
- **IL-2**: 跑驗證親證實有效
- **IL-3**: TDD red → green

### E2E 紀律 (memory `feedback_e2e_real_data_only.md`)
- 禁 stub timestamp
- 禁 mock 自家 API（Pitfall 11；carve-out 只有 error-state 503/timeout）
- 禁 prod URL + 真帳號

### 並行 / Sub-agent 紀律
- 並行上限 3 個 agent，任一 return 立刻補下一個
- Opus = director + cold reviewer + cold-Read PNG
- Sonnet = implementer + spec-cited skill application
- Director cold-Read PNG，sonnet self-Read 不算數（memory `feedback_uiux_visual_only`）
- 每 commit 2-stage review（spec compliance + code quality）（memory `feedback_two_stage_review_mandatory`）
- Karpathy guidelines 4 條 prepend 每 dispatch（memory `feedback_karpathy_guidelines_standard`）

### 階段紀律
- brainstorming → writing-plans → subagent-driven implementation 三階段必走（memory `feedback_phase_discipline_mandatory`）
- 對話一律 zh-TW
- 設計前必先驗證現有產品（Read production + Playwright capture + Read PNG）
- mockup 三 viewport 並排（mobile 360 / tablet 768 / desktop 1280）
- 完成後必開 dev server :4000 給 user UAT + SOP

---

## §H Skill citations 必引（每 spec / 每 dispatch）

playwright-skill at `/Users/albertpeng/.claude/skills/playwright-skill/core/`：
- `common-pitfalls.md` Pitfall 11 / 14 / 18 / 19 / 3
- `auth-flows.md:928-949` API seed auth
- `api-testing.md:783-848` data seeding (service-role carve-out)
- `api-testing.md:1023-1166` error response testing
- `network-mocking.md:839-933` intermittent failure pattern
- `mobile-and-responsive.md:49-71` device profiles
- `multi-user-and-collaboration.md:27-58` newContext cross-tab
- `visual-regression.md` toHaveScreenshot pixel-diff 0.005
- `assertions-and-waiting.md` expect.poll，禁 page.waitForTimeout

karpathy-guidelines at `/Users/albertpeng/.claude/plugins/cache/karpathy-skills/.../karpathy-guidelines/SKILL.md`

Per memory `feedback_playwright_skill_cited_application`: 每 spec 內 comment 必引段落號 + pattern name，不只引 file ref。

---

## §I 環境 + 重要路徑

- **dev server**: `http://localhost:4000`（npm run dev）
- **test account**: `e2e@first-principle.test`（password 在 `.env.local` `TEST_PASSWORD`）
- **storageState**: `playwright/.auth/user.json`（auth.setup.js 自動建立）
- **Supabase**: real test DB via `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`
- **e2e projects**: `e2e-desktop` / `e2e-mobile-chrome` / `e2e-mobile-safari`（3 vp）
- **api projects**: 11 個（lifecycle / final-report / sessions-list / evaluate-step / score-sequence / nsm-gate / guest-crud / etc.）
- **jest baseline**: 530/552（**5 fail 已重新分類為 real bug，見 P0**，17 skip）
- **dotenv**: `.env.local` (override) + `.env` (defaults)

---

## §J 接手 1 句話 instruction template

「Read `docs/PATH-2-HANDOFF.md` + `audit/e2e-master-tracker.md` + `CLAUDE.md` first。立刻挑 P0 #1 (lifecycle gate→gated wire) 開始：dispatch sonnet implementer 修 `routes/circles-sessions.js` + `routes/nsm-sessions.js` gate handler 加 setLifecycle('gated')，TDD red→green，跑 4 jest specs 全 PASS 後 commit。並行也派 P0 #2 (iOS Safari Phase 3 restore) 診斷 lane。並行上限 3 個 sub-agent。」

---

## §K 待派 work queue（usage cap reset 後）

1. P0 lifecycle gate→gated fix（4 routes）
2. P0 iOS Safari Phase 3 restore diagnose + fix
3. Bug 1 Gate 全 Y 重驗 deterministic e2e
4. Bug 6 沒審核放行 enumerate paths
5. T4 TC1 diagnose
6. Plan #194 T7 reorg / T8 adversarial / T9 final regression
7. Auth race burst-load fix
8. O-6 ~ O-10（master tracker §6）

---

## §L Cross-references

| 用途 | 路徑 |
|---|---|
| Single source truth | `audit/e2e-master-tracker.md` |
| Master plan E2E coverage | `docs/superpowers/specs/2026-05-17-e2e-integration-coverage-master-plan.md` |
| 4 findings slices | `audit/findings-slice-{circles,nsm,cross,edge}-2026-05-17.md` |
| Chat-drift spec + plan | `docs/superpowers/specs/2026-05-17-circles-chat-drift-and-lock-design.md` + `docs/superpowers/plans/2026-05-17-circles-chat-drift-and-lock-plan.md` |
| Plan #194 spec + plan | `docs/superpowers/specs/2026-05-16-persistence-resilience-design.md` + `docs/superpowers/plans/2026-05-16-persistence-resilience-plan.md` |
| Plan #190 lifecycle | `docs/superpowers/plans/2026-05-16-session-lifecycle-state-machine-plan.md` |
| 17 mockups (CONTRACT-LOCKED) | `docs/superpowers/specs/mockups/2026-05-02-frontend-rewrite/` |
| Live state board | `CLAUDE.md` |
| Session ritual | `SESSION-START-RITUAL.md` |
| User memory | `~/.claude/projects/-Users-albertpeng-Desktop-claude-project-First-Principle/memory/MEMORY.md` |
| Playwright skill | `~/.claude/skills/playwright-skill/core/` |
| Karpathy skill | `~/.claude/plugins/cache/karpathy-skills/.../skills/karpathy-guidelines/SKILL.md` |

---

## §M 已 ship + push origin/main commits 完整 list

過去 24 小時 push 上 main：
```
ab28219..7d71e13 main -> main  (chat-drift ship + T3/T6 ship + audit tracker)
```

過去 commits via `git log --oneline origin/main`。

---

## §N 不准忘 — 接手檢查清單

- [ ] 讀完 §A-§M
- [ ] 開 `audit/e2e-master-tracker.md` 看 §1-§4
- [ ] 開 `CLAUDE.md` 看當前 state
- [ ] 確認 dev server `:4000` health（`curl http://localhost:4000/health`）
- [ ] 確認 git status clean OR uncommitted work 可 commit
- [ ] 任一 user message 來：用首要綱領 + IL-1/2/3 + sub-agent 並行 3 紀律處理
- [ ] 發現新 bug → 立刻 append `audit/e2e-master-tracker.md` §1/§2/§3 + bump §8 timestamp
- [ ] 每 commit 必 dispatch 2-stage reviewer
- [ ] 每次 PNG 必 Director cold-Read 親確認
- [ ] Cap reset 7:20am Taipei — 之前可用 main agent bash 跑 test，不能 dispatch sub-agent

接手 Claude：你看完這份就 fully orient。go.
