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

## §B 接手 1 分鐘必讀順序

1. **本檔（PATH-2-HANDOFF.md）** — 你現在讀的
2. **`audit/e2e-master-tracker.md`** — §1 P0 / §2 P1 / §3 P2 / §4 verification matrix / §7 paused plans / §9 cross-references
3. **`CLAUDE.md`** — 即時 state board，當前狀態 30 秒讀完
4. **`SESSION-START-RITUAL.md`** — 開工 ritual + 10 條 Standing Rules（違反退件）
5. **memory MEMORY.md** at `/Users/albertpeng/.claude/projects/-Users-albertpeng-Desktop-claude-project-First-Principle/memory/MEMORY.md` — 30+ STANDING memories

讀完這 5 個就 fully orient。**禁止**先動手才讀。

---

## §C 當前 in-flight / 未解 work（必修順序）

### P0 排序

| # | Issue | 來源 | Action |
|---|---|---|---|
| 1 | **Lifecycle gate→gated wire broken** | jest re-audit 2026-05-17 (4 fail) | Locate gate handler `routes/circles-sessions.js` + `routes/nsm-sessions.js`，當 `gateResult.canProceed === true` 必 fire `setLifecycle('gated')` |
| 2 | **iOS Safari Phase 3 restore fallback** | task #263 (`circles-phase3-restore-real.spec.js` B3-R1 mobile-safari) | 查 `restoreCirclesPhase1FromSession` + `tryResumeLatestSession` WebKit async ordering |
| 3 | **Bug 1 Gate 全 Y 過審 re-verify** | task #251 user re-report | 寫 e2e spec 用 literal "Y" answers，驗證 adversarial sweep tightening 是否真擋 |
| 4 | **Bug 6 沒審核直接放行** | task #255 user re-report | 列舉全 gate→advance code paths，每個必有 guard |
| 5 | **Bug 2 ghost content re-report** | task #252 | 真 user flow reproduce + 查 localStorage / draft restore |

### P1 排序

| # | Issue | Action |
|---|---|---|
| 1 | Plan #194 T4 TC1 happy retry timeout | 查 ensureCirclesDraftSession internal state pollution from preflight 503 (line 7099) |
| 2 | Auth setup race (parallel burst load) | lower workers config OR retry helper OR keep-alive |
| 3 | Bug 7 已填內容消失 = 同 P0-#263 iOS Safari | 跟著 P0-#263 一起修 |
| 4 | Critical-path mobile flake (.navbar__email) | apply V7 fix 9b41bee pattern — replace selector |

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
