# E2E Master Tracker — Unresolved Hub

> **Single source of truth for ACTIVE unresolved issues.** Per STANDING `feedback_tracker_unresolved_hub`: §1-§3 only list真正待處理 items；resolved 立即剪貼移 §5。User 掃 §1-§3 = brainstorming 清單。
>
> **Last updated:** 2026-05-17 PM Taipei — full refactor per new STANDING
> **Update protocol:** new finding → append §1-§3；fix shipped → cut & paste 整段 → §5 with commit + verify。**禁留 ~~strikethrough~~ 在 §1-§3**。
> **Read order**: §1 → §2 → §3 → §6 → §7。歷史 audit trail 看 §5 / §9。

---

## §1 Active P0 Bugs (user-visible / data integrity)

### P0-NEW-7 NSM gate ok/warn 結果直接跳 Step 3，**略過 gate 結果 UI** — DISCOVERED 2026-05-17 PM (user manual report)

- **User report**: "nsm 指標填答完畢，送交審核的時候，會直接略過審核結果頁，跳到下一個步驟（拆解）"
- **Reproduce path**: NSM Step 2 (拆解) → click `[data-nsm-submit]` (`提交審核`) → POST /api/nsm-sessions/:id/gate → if response `overall_status` is `ok` or `warn` → **immediately skips gate result UI, jumps to nsm-step3**
- **Symptom**: user 看不到 gate AI 評估的 ok/warn 反饋（mockup 08 「三態 gate」契約規定 ok/warn/error 三者都該顯示）
- **Root cause** (3 evidence pieces, code reading + existing spec self-documentation + mockup spec):
  1. **Code**: `public/app.js:1973-1978` — for ok/warn case immediately `nsmSubTab = 'nsm-step3'; nsmStep = 3; render()` (bypasses gate UI)
  2. **Existing spec自承**: `tests/e2e/nsm-full-flow.spec.js:211-212` comment: *"Either gate passes (ok/warn → Step 3 auto-advance) or gate fails (error → shows gate UI)"* — test author documented this behavior but didn't question if mockup contract permitted it
  3. **Mockup contract violation**: CLAUDE.md mockup index "08 nsm-step-3-gate v2: 5 維度 gate **三態** + loading" — ok/warn/error 三態必顯
- **Comparison to CIRCLES Phase 1.5 (mockup 04)**: CIRCLES gate ALWAYS shows result UI before user clicks "繼續" (per mockup 04 ok/warn/error 三態 + loading), even for ok case. NSM should mirror but doesn't.
- **Why missed by previous e2e coverage** (e2e integration testing gap):
  - L9 NSM gate adversarial — only API response assert
  - L18 NSM bypass enumeration — only security assert
  - L19 NSM /evaluate guard fix — only API guard assert
  - L26 NSM /context+/hints+/progress — endpoint state mutation
  - L29 1B state/cache — state machine
  - **NONE asserted "gate result UI visible after submit" for ok/warn path**
- **Lesson**: e2e specs must assert **FE flow narrative** (`toBeVisible` per phase), not just API contract. Existing `nsm-full-flow.spec.js` could have caught this if it asserted gate result UI before checking auto-advance.
- **Proposed fix direction** (待 user 決定):
  - **Option A (simplest)**: At app.js:1973-1978, change ok/warn branch to keep `nsmSubTab = 'nsm-gate'` (don't auto-advance); user must click `[data-nsm-gate-action="proceed"]` button (already exists at app.js:1500) to advance to step 3
  - **Option B**: Add intermediate state — show gate result for ~3 sec then auto-advance (preserves auto-flow but gives user feedback)
  - **Option C**: User config (always-show vs auto-advance preference) — overkill
- **TDD red spec needed**: write `tests/e2e/nsm-gate-result-ui-display.spec.js` that asserts gate result UI visible after submit (currently RED for ok/warn, GREEN for error) — flip to GREEN after fix
- **Skill citations applied** in investigation:
  - `common-pitfalls.md` Pitfall 19 (test.step per phase)
  - `assertions-and-waiting.md` Quick Reference (waitForFunction + toBeVisible)
  - `test-organization.md` Pattern 2 (multi-step describe pattern)

---

## §2 Active P1 Bugs

### P1-#257 Bug 8 / Master plan F-007 — ~65 hollow API specs refactor
- **Status**: partial done (retrofit C/D/E/F + Group A V1-V8 shipped)
- **Open**: ~65 specs partial-mock `/api/circles-sessions` list endpoint still hollow
- **Why P1 not P0**: production code OK，但 hollow specs 不抓真 regression（P0-NEW-6 cascade 證明）
- **Impact long-term**: 防止未來 ship 再撞同類 lifecycle-guard cascade
- **Effort**: 8-15h wall-clock parallel (Phase B 計畫 5-7 batch × 3 lane)
- **Cross-ref**: master plan `docs/superpowers/specs/2026-05-17-e2e-integration-coverage-master-plan.md` §7 F-007；多階段 ship plan `docs/superpowers/plans/2026-05-17-pm-multi-phase-ship-plan.md` §B

### P1 Master plan F-001 — Testing Trophy inversion
- **Status**: Group A V1-V8 added 8 real API specs，ratio 改善但未到 60% API target
- **Current state**: 95 E2E vs ~18 API (post Group A)
- **Open**: identify ~30-40 more E2E candidates to convert to API tier per surface
- **Effort**: medium-large；可隨 F-007 wave 一起做
- **Cross-ref**: `audit/testing-trophy-audit-2026-05-16.md`

---

## §3 Active P2 / Needs Decision

### #207 B5 decision — Stage 1C revert vs keep
- **Needs**: user 親自決定
- **Context**: Stage 1C qchip-panel ship (commits `f6b18fe` `a0e5531`) SUPERSEDED by chat-drift wave 1-4
- **Recommendation**: close as superseded (chat-drift `49d00ba` 已 swap Phase 2 + L23 已 delete orphan `renderQchipPanelHtml`)
- **Owner**: user

### #199 Trophy Step 4 — critical-path E2E
- **Status**: master plan F-006 partly satisfied by `9446ad2` critical-path-full-flow spec
- **Open**: spec partial coverage Phase 1→4 (gap on Phase 3→4 transition?)
- **Recommendation**: may overlap with task #212 critical-path E2E (completed)；可 close as duplicate
- **Owner**: needs Director cross-verify with #212 scope

### #205 Retrofit G — delete hollow tests + test-supabase mock library
- **Status**: backlog (low priority cleanup)
- **Trigger**: best done after F-007 wave (#257) — many hollow tests will become deletable once real api/ tier covers same surface
- **Effort**: medium

### #21 mockup 04 audit + 9 transition drift fixes
- **Status**: paused backlog — pixel-diff against mockup baseline + 9 transition drifts
- **Effort**: 2-4h

### #174 / #193 B-Hint cluster UI ship
- **Status**: L28 fix lane in flight (post-restart)
- **Will move**: §5 closed when L28 returns

---

## §4 Verification Matrix (latest pass/fail)

| Spec / Suite | Result | Last verified |
|---|---|---|
| **jest full** | ✅ **538/555** (best baseline ever; +8 from 530/552 session start) | post L29 `cac214c` |
| API integration full suite | ✅ 196/199 (3 are concurrent-load flakes in nsm-context-hints-progress-coverage; isolated 19/19 PASS) | post L24 `ca59bbd` |
| API lifecycle (CIRCLES+NSM) | ✅ 16/16 real OpenAI | post L19 |
| circles-no-bypass | ✅ 5/5 × 5 runs no flake | post L5 |
| nsm-no-bypass | ✅ 4/4 × 5 runs no flake | post L19 |
| circles-back-nav-lock | ✅ 16/16 × 3 vp | post L25 |
| circles-fe-gate-stale-state | ✅ 15/15 × 3 vp | post L13 |
| circles-fresh-form-no-ghost (Scen C mobile-chrome) | ✅ 30/30 × 5 runs no flake | post L11 |
| circles-phase3-restore-real | ✅ 10/10 + 50/50 × 5 runs post-L29 flake fix | post L29 `cac214c` |
| bug3-spinner-deep-investigation | ✅ 5/5 × 5 runs no flake | post L17 |
| 4-pillar adversarial sweep (CIRCLES gate / NSM gate / CIRCLES evaluator / NSM evaluator) | ✅ all robust; max totalScore=40 < 60 | L2 + L9 + L12 + L15 |
| Concurrent CLI burst load (3 × 16/16) | ✅ no DB session collision | post L25 |
| offcanvas-delete (incl B4-E3 NSM) | ✅ 15/15 (5 runs × 3 browsers) | post L20 |

---

## §5 Closed Issues (audit trail)

### P0 ship closures (本 session 7/7)
| # | Bug | Resolved via | Final commit |
|---|---|---|---|
| #251 | Bug 1 全 Y 過審 | L2 backend cleared + L10 LEAK-A + L13 F1+F2 | `85f0039` |
| #252 | Bug 2 ghost content | L4 RED + L11 reset | `c156c6b` |
| #255 | Bug 6 沒審核放行 | L3 RED + L5 8 BE+FE guards | `93b1b26` |
| #263 | iOS Safari Phase 3 (P1-#256 Bug 7 同) | L1 verified already shipped | `654d0e8` (2026-05-16) |
| P0-NEW-3 | persistRetry session-object | L14 + L16 dual fix | `91fb2ad` |
| P0-NEW-4 | Bug 3 spinner (reclass P2→P0) | L13b RED + L16 scope-leak + L17 spec flip | `2aa8fd5` |
| P0-NEW-5 | NSM /evaluate bypass | L18 RED + L19 fix | `9142eef` |
| P0-NEW-6 | Cross-plan smoke 5 API spec drift | L24 lifecycle seed | `ca59bbd` |

### P0 mis-diagnosis closures
| # | Resolution |
|---|---|
| P0-NEW Lifecycle gate→gated | TEST FIXTURE drift not prod bug；stubs `{ok}` → `{canProceed, overallStatus}` per task #208；commit `069986e` |
| P0-NEW-2 jest tests/circles-sessions.test.js cascade | Resolved in L5 commit `93b1b26` (3 spec updates included) + L8 makeSession seed `05025b9` |

### P1 closures
| # | Resolved via |
|---|---|
| P1-#256 Bug 7 已填內容消失 | Same root cause as P0-#263 commit `654d0e8` |
| P1-#264 Auth race (reclassified Supabase DB collision) | L22 audit `36f4ba2` + L25 fix `1e293b3` — waitForServer + tagSessionWithPid scoped cleanup |
| P1 Plan #194 T4 TC1 happy retry timeout | Same root cause as P0-NEW-3；L16 dual fix `91fb2ad` |
| P1 Critical-path mobile flake (.navbar__email) | L14 V7 pattern applied `2165c2a` |

### P2 closures
| # | Resolved via |
|---|---|
| #253 Bug 3 spinner stuck | Reclass P2→P0-NEW-4，then closed via L17 `2aa8fd5` |
| #254 Bug 4 offcanvas delete cache | NOT_REPRODUCIBLE verified (Bug 4 audit `3af488d` 7 scenarios GREEN) + L20 NSM coverage `f292a22` |
| F-P16 NSM session DELETE spec gap | L20 unblock B4-E3 + 確認 no cache leak (`f292a22` + `961cb09`) |
| #211 B3 retrofit C | Duplicate of #201 (commit `72e7797`) |

### Plan completions (paused → done)
| Plan | Closure |
|---|---|
| #190 Lifecycle plan | schema+lib+handler shipped；P0-NEW test drift closed |
| #191 1B state/cache plan | L29 close — 8/8 tasks shipped + B3-R1 flake fix `cac214c` |
| #192 1C Phase 2 UI plan | SUPERSEDED by chat-drift wave 1-4 + L23 orphan delete `f2a3d58` |
| #194 5 P0 resilience plan | T1/T2/T5 pre + T3 + T6 + T4 (via L16) all shipped |

### Optimization closures
| O | Closed |
|---|---|
| O-7 NSM seed helper for offcanvas-delete | L20 `f292a22` + audit `961cb09` |
| O-9 orphan renderQchipPanelHtml delete | L23 `f2a3d58` (15 lines, 0 callers verified) |

### Preventive sweep audits (NEGATIVE findings — confirmed solid)
| Lane | Audit |
|---|---|
| L2 CIRCLES gate adversarial 10 變體 | `f7a43ff` — 10/10 reject × 3 runs |
| L9 NSM gate adversarial 10 變體 | `322dfa8` — 10/10 reject |
| L12 CIRCLES evaluator adversarial 7 變體 | `0efe786` — totalScore=16 well < 60 |
| L15 NSM evaluator adversarial 7 變體 | `c853d93` — max totalScore=40 < 60 |
| L26 NSM /context+/hints+/progress audit | `4bdba5b` — 19/19 GREEN, 0 leak, 3 endpoint groups SAFE by-design |

---

## §6 Optimization Opportunities

### O-1 / F-007 wave — Refactor ~65 specs from route.fulfill stubs → real Supabase
**移到 §2 P1-#257**（已 elevated 為 active P1）

### O-2 Delete 5 vm.createContext app.js helper specs
- Master plan F-008
- Partly done via Retrofit C/D；待 F-007 wave 之後一起清

### O-3 Unmount stale routes/prompts dead code
- Master plan F-002 + F-003
- Files: `routes/sessions.js`, `routes/guest-sessions.js`, `prompts/coach.js`, `prompts/evaluator.js`, `prompts/issue-generator.js`
- Effort: small

### O-4 Mockup 04 audit + 9 transition drift
**移到 §3 #21**

### O-5 Plan #194 T7/T8/T9 remaining
- T7 spec reorg / T8 adversarial 5 specs / T9 final regression + cold-Read 4 toast PNGs
- Effort: medium

### O-6 Bug 4 cosmetic — `_doOffcanvasDelete` invalidate `circlesRecentSessions`
- Identified during Bug 4 audit `3af488d`
- Impact: home rail stale recent sessions briefly after delete
- Effort: tiny (~3 lines)

### O-8 jest "pre-existing fails" reclassification policy enforcement
- Discovery: 4 lifecycle wire fails were misclassified；本 session 抓 4 個真 bug 起源於 baseline 假綠燈
- Action: enforce policy — any NEW commit must show jest count ≥ baseline AND every fail must be tagged
- Effort: process change, already informally enforced post-2026-05-17

### O-10 Extract `_doOffcanvasDelete` / `bindOffcanvas` from app.js
- Note: app.js ~8200 LOC；many helpers extractable
- Effort: large

### O-11 Adversarial extension to remaining AI prompts
- `circles-conclusion-check` / `circles-final-report` / `circles-coach-version` 還沒 adversarial sweep
- 4-pillar → 7-pillar coverage
- Effort: 2-4h (mirror L2/L9/L12/L15 pattern)

### O-12 L25 :3000 fallback flag
- L25 commit `1e293b3` `auth.setup.js` waitForServer 用 `BASE_URL || 'localhost:3000'` 但專案 dev server 是 :4000
- 一般情況 BASE_URL env 設好不會踩，但 fallback misleading
- Effort: tiny (~1 line)

---

## §7 Paused Plans Status (#190-194)

✅ **全 closed** — 詳見 §5 plan completions。

---

## §8 Cross-references (audit doc map)

| Path | Purpose |
|---|---|
| `audit/findings-slice-{circles,nsm,cross,edge}-2026-05-17.md` | 82 findings on 4 surface clusters |
| `audit/lane-b-test-inventory-2026-05-17.md` | full test inventory (~210 specs) |
| `audit/lane-c-product-surface-map-2026-05-17.md` | 36 render fn + 57 endpoints + 20 prompts |
| `audit/lane-k-b2-ghost-content-investigation-2026-05-17.md` | Bug 2 prior investigation |
| `audit/lane-l-b7-data-loss-vectors-2026-05-17.md` | B7 data loss vectors |
| `audit/persistence-comprehensive-audit-2026-05-16.md` | Plan #194 baseline audit |
| `audit/testing-trophy-audit-2026-05-16.md` | Trophy reset baseline |
| `audit/bug3-deep-investigation-2026-05-17.md` + `audit/bug3-deep/` | Bug 3 BUG CONFIRMED 35 PNG |
| `audit/bug4-reproduce-2026-05-17.md` + `audit/bug4-reproduce/` | Bug 4 NOT_REPRODUCIBLE 7 scenarios |
| `audit/diagnose-iOS-safari-phase3-restore/diagnose-2026-05-17.md` + traces | L1 iOS Safari diagnose |
| `audit/repro-bug1-all-Y-adversarial-2026-05-17.md` | L2 adversarial sweep |
| `audit/bug6-bypass-path-enumeration-2026-05-17.md` | L3 Bug 6 enumeration |
| `audit/repro-bug2-ghost-content-2026-05-17.md` + PNGs | L4 Bug 2 RED evidence |
| `audit/bug1-fe-gate-stale-state-2026-05-17.md` + `audit/bug1-fe-gate-stale/` 24 PNG | L10 LEAK-A finding |
| `audit/critical-path-3-fails-investigation-2026-05-17.md` + `audit/L14-evidence/` | L14 critical-path triage |
| `audit/nsm-bypass-path-enumeration-2026-05-17.md` | L18 NSM enumeration |
| `audit/L22-auth-race-investigation-2026-05-17.md` | L22 auth race reclassification |
| `audit/L23-orphan-cleanup-2026-05-17.md` | L23 O-9 closure |
| `audit/L26-nsm-context-hints-progress-coverage-2026-05-17.md` | L26 negative finding |
| `audit/L29-1b-state-cache-completion-2026-05-17.md` | L29 Stage 1B closure |
| `audit/eyeball-2026-05-17-pm-7-p0-ship.md` | Director cold-Read for 7 P0 ship |
| `audit/sop-2026-05-17-circles-lock-and-qchip-uat.md` | UAT SOP chat-drift |
| `docs/superpowers/specs/2026-05-17-e2e-integration-coverage-master-plan.md` | Master plan F-001..F-014 |
| `docs/superpowers/plans/2026-05-17-pm-multi-phase-ship-plan.md` | Multi-phase ship roadmap (A/B/C/D) |
| `docs/superpowers/plans/2026-05-17-circles-chat-drift-and-lock-plan.md` | Chat-drift plan |
| `docs/superpowers/plans/2026-05-16-persistence-resilience-plan.md` | Plan #194 |
| `CLAUDE.md` | Live state board |

---

## §9 Skill Citation Reference

All e2e specs apply playwright-skill at `/Users/albertpeng/.claude/skills/playwright-skill/core/`:
- `common-pitfalls.md` Pitfall 11 (no own backend mock) — carve-out only for error-state simulation
- `common-pitfalls.md` Pitfall 14 (no module-level shared state)
- `common-pitfalls.md` Pitfall 18 (`page.evaluate` only for true JS APIs)
- `common-pitfalls.md` Pitfall 19 (`test.step()` for multi-phase)
- `common-pitfalls.md` Pitfall 3 (role-based locators)
- `api-testing.md:783-848` (data seeding via service-role)
- `api-testing.md:1023-1166` (error response testing)
- `auth-flows.md:928-949` (API seed auth)
- `mobile-and-responsive.md:49-71` (device profiles)
- `network-mocking.md:839-933` (intermittent failure pattern)
- `multi-user-and-collaboration.md:27-58` (cross-tab newContext)
- `visual-regression.md` (toHaveScreenshot pixel-diff)
- `assertions-and-waiting.md` (expect.poll / toBeVisible)

Per STANDING `feedback_e2e_integration_supreme`: 5x consecutive 0 flake gate.
Per `feedback_playwright_skill_cited_application`: spec cites segment + pattern name.
Per `feedback_two_stage_review_mandatory`: spec compliance + code quality reviewer per commit.
Per `feedback_uiux_visual_only`: Director cold-Read every PNG.
Per `feedback_tracker_unresolved_hub`: §1-§3 only active；resolved → §5.

---

## §10 How to Use This Tracker

**For Director (opus)**：
1. 開 session 立刻 Read §1 + §2 + §3 = action queue
2. 新 finding → append §1-§3
3. fix shipped → **剪貼整段 → §5**（不准留 strikethrough）
4. §4 matrix = check before claim GREEN

**For Implementers (sonnet)**：
1. Pick from §1 / §2 by priority
2. Cite related audit slice (§8) in spec header
3. Apply skill citations (§9) verbatim
4. Don't claim GREEN without 5x consecutive

**For User**：
1. Read §1 + §2 = 真正待處理 backlog（brainstorm 起點）
2. §3 = 需 user 決定 / 等 user 介入
3. §5 = 已完工歷史
4. §6 = 未來想做但非 bug
