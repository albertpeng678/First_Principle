# PM Drill Mega Rollout — Live State Checkpoint

**Last updated:** 2026-04-29 — Phase 0 ✅ done. Phases 1-4 partial: org monthly usage limit hit on all 4 background agents.

This file is the source of truth if my conversation context is lost. **New sessions: read this end-to-end first**, then read the plan, then resume.

---

## 🔁 Resume prompt (copy-paste this to start a new session)

```
請接手 PM Drill 全面 rollout 計畫的 controller 工作。

第一步：讀以下檔案（按順序）—
1. docs/superpowers/test-agents/ROLLOUT-STATE.md（本檔，live state checkpoint）
2. docs/superpowers/plans/2026-04-28-pm-drill-mega-rollout.md（完整計畫）

第二步：用 superpowers:subagent-driven-development skill 接手繼續執行。

四個背景 agent 還在跑（如果還在）：
- Phase 1 bullet examples: ae6fce19502b1ffc0
- Phase 2 progress save: a3f5decccb375d40d
- Phase 3 rich text toolbar: aa288be19d65b5224
- Phase 4 desktop layouts: a6df15d1e67ff466e

用 SendMessage 查詢它們狀態。如果已完成或不可達，從各自 worktree 看 git log：
- ../pm-drill-phase-1
- ../pm-drill-phase-2
- ../pm-drill-phase-3
- ../pm-drill-phase-4

接續流程：
1. 每個 Phase agent 回報 DONE → 跑 spec compliance review subagent → 跑 code quality review subagent → fix loop 直到 APPROVED → push branch
2. Phase 4 在 4.1 完成時要 dispatch Phase 5（onboarding tour）平行；4.6 完成時 dispatch Phase 6（NSM 對比 mobile bottom sheet）平行
3. 全 6 個 phase APPROVED 後 → Phase 7 integration（建 ../pm-drill-phase-X-integration worktree off main，按依賴順序 merge 所有 phase branch，解 conflict）
4. Round 1 SIT：dispatch 8 個 SIT agent 平行（用 docs/superpowers/test-agents/sit-prompts.md），loop 修到 8/8 PASS
5. Round 2 UAT：dispatch 7 個 UAT persona agent（用 uat-prompts.md）
6. Round 3 UI/UX：dispatch 2 個 auditor agent（用 uiux-prompts.md）
7. Fix Round（零延後）：所有 SIT failure + UAT 摩擦 + UI/UX 痛點全部修完
8. Round 4 regression：17 agents 全跑，全 PASS 才 merge to main

最終 merge gate（all must hold）：
- 8/8 SIT PASS
- 7/7 UAT 摩擦點 = 0
- 2/2 UI/UX BLOCKER + MAJOR + MINOR = 0
- Lighthouse mobile + desktop ≥ 90 a11y/best practices, ≥ 85 perf
- axe-core 0 critical
- console 0 errors
- Round 4 regression 全 PASS

過程嚴格使用所有 superpower skill（subagent-driven-development、using-git-worktrees、test-driven-development、systematic-debugging、code-reviewer、verification-before-completion、dispatching-parallel-agents、finishing-a-development-branch）。

模式：auto mode，繼續自主執行，遇到衝突或設計判斷再問我。

備註：
- gh CLI 沒裝，PR 要從 GitHub 網頁開
- step_drafts JSONB column 可能要 migration（Phase 2 agent 應該已處理，review 時確認）
- 隨時更新 ROLLOUT-STATE.md
```

---

## Plan source-of-truth

`docs/superpowers/plans/2026-04-28-pm-drill-mega-rollout.md` (1512 lines, 7 phases + 17 test agents).

## Specs

- `docs/superpowers/specs/2026-04-28-circles-examples-bullet-format-design.md`
- `docs/superpowers/specs/2026-04-28-circles-progress-save-design.md`
- `docs/superpowers/specs/2026-04-28-desktop-rwd-direction-c-design.md`
- `docs/superpowers/specs/2026-04-28-rich-text-input-design.md`

## Test agent prompts (pre-written)

- `docs/superpowers/test-agents/sit-prompts.md` (8 SIT)
- `docs/superpowers/test-agents/uat-prompts.md` (7 UAT)
- `docs/superpowers/test-agents/uiux-prompts.md` (2 UI/UX)

---

## Current state (as of last update)

### Worktrees on disk

| Path | Branch | Pushed | Commits done | Status |
|---|---|---|---|---|
| `pm-drill-phase-0` | `phase-0-foundation` | ✅ | 11 | ✅ COMPLETE — both reviews APPROVED |
| `pm-drill-phase-1` | `phase-1-bullet-examples` | ✅ | 4 | 🟠 PARTIAL — Tasks 1.1, 1.2, 1.3, 1.5 done. Task 1.4 (regenerate 99 questions via Claude API) **NOT done**. Task 1.6 push **DONE by controller**. Uncommitted: `circles_plan/circles_database.json` modified, `tmp/update-circles-002.js` untracked — likely mid-Task-1.2/1.4 state, do NOT commit blindly, inspect first. |
| `pm-drill-phase-2` | `phase-2-progress-save` | ✅ | 4 | 🟠 PARTIAL — Tasks 2.1 (POST /draft), 2.2 (auto-save), 2.3 (indicator), 2.4 (badge), 2.5 (banner) done. Tests **NOT done** (Task 2.6) — `tests/playwright/journeys/circles-progress-save.spec.js` is untracked but unfinished. Push **DONE by controller**. Migration for `step_drafts` JSONB column status: agent's last commit accepts `stepDrafts` in PATCH — verify column exists in Supabase before merge. |
| `pm-drill-phase-3` | `phase-3-rich-text` | ✅ | 3 | 🟠 PARTIAL — Tasks 3.1 (CSS), 3.2 (actions), 3.3 (IME-safe shortcuts) done. Tasks 3.4 (mobile visualViewport), 3.5 (`.rt-textarea` opt-in across forms), 3.6 (test pass-through) **NOT done**. 5 test specs are written but failing (TDD red state). Modified test files uncommitted. Push **DONE by controller**. |
| `pm-drill-phase-4` | `phase-4-desktop-layouts` | ✅ | 1 | 🟠 PARTIAL — Only Task 4.1 (CIRCLES home desktop) done. Tasks 4.2-4.7 **NOT done**. Uncommitted Task 4.2 work in progress: `public/app.js` modified, `tests/playwright/journeys/desktop-phase1.spec.js` untracked. Push **DONE by controller**. |

### Background agent IDs (NO LONGER ALIVE — all hit org monthly usage limit)

These agents stopped on 2026-04-29 with `You've hit your org's monthly usage limit`. They are **not resumable**. New session must dispatch fresh agents (after billing resets) to finish each phase.

| Phase | Old Agent ID (dead) |
|---|---|
| Phase 1 | `ae6fce19502b1ffc0` (1422s, 70 tool uses) |
| Phase 2 | `a3f5decccb375d40d` (1085s, 82 tool uses) |
| Phase 3 | `aa288be19d65b5224` (996s, 63 tool uses) |
| Phase 4 | `a6df15d1e67ff466e` (953s, 55 tool uses) |

### Phase 0 commit hashes (Phase 1-4 are branched off this)

Tip of `phase-0-foundation` branch: `06acaa8 test(tokens): assert navbar favicon resolves to primary blue at runtime`

11 commits on `phase-0-foundation` (already pushed to origin). PR not opened (no `gh` CLI installed) — open manually at https://github.com/albertpeng678/First_Principle/pull/new/phase-0-foundation.

---

## Next steps (in order) — UPDATED for partial state

1. **Resume Phase 1** (when budget restored): dispatch new agent on worktree `../pm-drill-phase-1`. Inspect uncommitted state first (`circles_plan/circles_database.json` + `tmp/update-circles-002.js`); decide whether to keep or discard. Then complete Task 1.4 (regenerate 99 questions via Claude API, ~10 min), iterate audit until <1% violations, commit, push.
2. **Resume Phase 2**: dispatch new agent on `../pm-drill-phase-2`. Complete Task 2.6 (Playwright test for end-to-end auto-save). Verify Supabase `step_drafts` column exists or write migration. Push.
3. **Resume Phase 3**: dispatch new agent on `../pm-drill-phase-3`. Complete Tasks 3.4 (mobile visualViewport), 3.5 (`.rt-textarea` opt-in on Phase 1 + NSM 2/3 + E + S 4-dim textareas), 3.6 (make 5 failing TDD tests pass). Push.
4. **Resume Phase 4**: dispatch new agent on `../pm-drill-phase-4`. Inspect uncommitted Task 4.2 work first. Then complete 4.2 (Phase 1 form desktop), 4.3 (Phase 2 chat desktop, easy), 4.4 (Phase 3 score desktop), 4.5 (NSM Step 1-3 desktop), 4.6 (NSM Step 4 + 對比 tab), 4.7 (review-examples + login desktop). After 4.6, dispatch Phase 6.
5. **After Phase 4.1 already done** → dispatch Phase 5 onboarding agent in parallel (worktree `../pm-drill-phase-5` off `phase-0-foundation`).
6. **After Phase 4 reports 4.6 done** → dispatch Phase 6 NSM 對比 mobile bottom-sheet agent (worktree `../pm-drill-phase-6` off Phase 4 branch).
7. **Per phase DONE** → spec compliance review subagent → code quality review subagent → fix loop → APPROVED.
4. **Phase 7 integration**: create worktree `../pm-drill-phase-X-integration` off `main`, merge `phase-0-foundation` → `phase-1-bullet-examples` → `phase-2-progress-save` → `phase-3-rich-text` → `phase-4-desktop-layouts` → `phase-5-onboarding` → `phase-6-nsm-mobile-sheet`. Resolve conflicts (highest concentration in `public/app.js` + `public/style.css`).
5. **Round 1 SIT**: dispatch 8 SIT agents in parallel using `docs/superpowers/test-agents/sit-prompts.md`. Loop fix until 8/8 PASS.
6. **Round 2 UAT**: dispatch 7 UAT personas in parallel using `uat-prompts.md`. Collect friction points.
7. **Round 3 UI/UX**: dispatch 2 auditors using `uiux-prompts.md`. Collect BLOCKER/MAJOR/MINOR pain points.
8. **Fix round (zero deferral)**: Fix all SIT failures + UAT friction + UI/UX pain points. No "next sprint" allowed.
9. **Round 4 regression**: re-run all 17 agents. Merge to main only when all green.

## Final merge gate (all must hold)

- 8/8 SIT PASS
- 7/7 UAT mission complete + friction = 0
- 2/2 UI/UX BLOCKER + MAJOR + MINOR = 0
- Lighthouse mobile + desktop ≥ 90 (a11y/best practices), ≥ 85 (perf)
- axe-core 0 critical
- Console 0 errors during 17-agent e2e
- Round 4 regression all PASS

---

## Recovery procedure (if controller session crashes)

1. Read this file end-to-end.
2. Read `docs/superpowers/plans/2026-04-28-pm-drill-mega-rollout.md`.
3. Check `git worktree list` — confirm worktrees still present.
4. Check each phase branch: `cd ../pm-drill-phase-N && git log --oneline | head -10` — see how far the agent got.
5. If agent IDs above are still queryable: `SendMessage to: <agent-id>` to retrieve last status.
6. If agents not queryable, re-inspect each worktree's `git status` + last commit time. If working tree is clean and last commit message matches the plan's expected final message for that phase, the phase is DONE — proceed to review.
7. Resume from the appropriate "Next steps" item above.

## Risk notes

- `gh` CLI not installed — PRs can only be opened via GitHub web UI.
- `step_drafts` JSONB column may not exist in Supabase yet — Phase 2 agent will write a migration; review the migration before merge.
- Phase 1 Task 1.4 calls Claude API (regenerate 99 questions, ~10 min, costs API budget).
- Phases 1-4 all touch `public/app.js` + `public/style.css` — Phase 7 will have significant merge conflicts.
- `.env` is symlinked into Phase 1-4 worktrees from `First_Principle/.env`.
- `node_modules` is symlinked from `pm-drill-phase-0/node_modules` into Phase 1-4 worktrees.
- Auto mode is active (continuous autonomous execution).

## Phase 0 fix history (already resolved, for reference only)

Phase 0 implementer reported DONE_WITH_CONCERNS. Spec reviewer found 1 defect (`[data-view="circles"]` block at `public/style.css:1217+` was reverting the spec-3 palette inside the CIRCLES surface) — fixed by trimming the scoped overrides to only what's actually needed. Code quality reviewer found 3 Important issues — all fixed:
1. `var(--c-primary, var(--c-primary))` self-fallback dead code → removed
2. `scripts/audit-hardcoded-colors.js` regex narrow → expanded to full spec-3 palette (added `#7C3AED #1F1D1B #10b981 #F2F0EB #D92020 #B85C00`); side-effect: replaced literal hex usage in app.js dimension data, STATUS_COLOR, gradeColor with `var(--c-success/--c-warn-bold/--c-error/--c-ok-bold)`. Added 3 new `:root` tokens: `--c-error`, `--c-warn-bold`, `--c-ok-bold`.
3. `tests/playwright/journeys/foundation-tokens.spec.js` only checked CSS vars existence → added a runtime DOM color assertion on `.navbar-favicon`

Tip of `phase-0-foundation` after all fixes: 11 commits, all pushed to origin.
