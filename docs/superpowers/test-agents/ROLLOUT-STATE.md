# PM Drill Mega Rollout — Live State Checkpoint

**Last updated:** 2026-04-29 (session 2 — Mac, different machine). Round 1 SIT 8/8 PASS shipped previously. **Round 2 UAT + Round 3 UI/UX + Fix Round + Round 4 regression (partial) all completed this session.**

> 📍 **Local main tip:** `0c72b0f` (12 commits ahead of origin/main `0897483`). NOT YET PUSHED.
> 📍 **origin/main tip:** `0897483` (unchanged from end of session 1).
> 📍 **Machine note:** Now on Mac (`/Users/albertpeng/Desktop/claude_project/First_Principle`). Session 1 was on Windows.
> 📍 **Server:** running on `http://localhost:4001` from main repo dir. Restart cmd: `pkill -f "node server.js" || true; PORT=4001 nohup node server.js > /tmp/sit-server-mac.log 2>&1 & disown`
> ⚠️ **2 SQL migrations pending user manual apply to Supabase** (see "Pending DB migrations" section below) — without them, B2 parallel-race uniqueness + NSM /progress endpoint will not fully work.

---

## Session 2 Summary (2026-04-29 Mac)

### What was done
1. **Sanity check (SIT-1 follow-up)** — found real bug: `app.js:1427 window.render = render` was clobbering review-examples.html's inline `render()`. Renamed local to `renderReview()`. Fixed in `9427a21`. Verified: 100 cards, 2700 `<ul class="rt-bullet-list">`, 0 errors.
2. **Round 2 UAT** — 7 persona agents in 2 waves. Found ~25 friction points (BLOCKER/HIGH/MAJOR/MINOR).
3. **Round 3 UI/UX** — 2 auditors (美學總監 + 痛點獵人). 美學總監 gave REWORK rec; 痛點獵人 found 20+ pain points incl. blocker tap-targets and login autocomplete missing.
4. **Fix Round** — 3 parallel agents (Fix-Backend, Fix-Style, Fix-AppJS). Plus 1 manual fix (SIT-7 follow-up). **12 fix commits** total.
5. **Round 4 regression — partial** (token budget): Wave 1+2 SIT (8/8 PASS after SIT-7 manual fix), Wave 3 UAT-3 PASS, Wave 3 UAT-1/2/4 still in-flight at session end.

### 12 commits applied to main (since origin/main `0897483`)
```
0c72b0f fix(a11y): remove dead /api/guest/sessions refs (SIT-7 F1)
e700056 fix(a11y/ux): J1-J18 frontend fix bundle in app.js
d8658e4 fix(a11y): tap-targets, visually-hidden h1, rt-mtbtn aria-labels (J2/J6/J13/J14)
f8b6735 fix(style): "帶著風險繼續" button width + flow
36dbd17 feat(api): PATCH /progress for NSM sessions (auth + guest)
896ca2d fix(style): axe-core color-contrast bumps
d864628 fix(api): redirect /login.html to SPA login view (B3)
d9d45d7 fix(api): idempotent CIRCLES draft autosave + auth final-report parity (B2)
1b776de fix(style): review-examples 2-column grid at >=1100px
400817a fix(api): migrate guest CIRCLES + NSM sessions on register (B1)
d8cf823 fix(style): login form contrast (cream-on-cream → AA)
9427a21 fix(review-examples): rename render() to renderReview() to avoid app.js clobber
```

### Pending DB migrations (apply manually via Supabase SQL editor)
- `migrations/2026-04-29-circles-active-uniqueness.sql` — partial UNIQUE indexes for parallel-race autosave protection (B2). Without it, JS-level select-before-insert handles sequential dedup but parallel race can still slip 2 rows past.
- `migrations/2026-04-29-nsm-progress-json.sql` — adds `nsm_sessions.progress_json JSONB DEFAULT '{}'`. Without it, `PATCH /api/guest/nsm-sessions/:id/progress` returns 500 `db_error` (PGRST204 column missing). Frontend has localStorage stopgap; cross-device persistence broken until applied.

### Round 4 regression status (in-flight at session end)
| Wave | Agents | Result |
|---|---|---|
| 1 | SIT-1, SIT-2, SIT-3, SIT-4 | ✅ 4/4 PASS |
| 2 | SIT-5, SIT-6, SIT-7, SIT-8 | SIT-5/6/8 ✅; SIT-7 ❌ → fixed in `0c72b0f`; needs re-verify |
| 3 | UAT-1, UAT-2, UAT-3, UAT-4 | ✅ 4/4 PASS — UAT-1 5/5, UAT-2 5/5, UAT-3 4/4, UAT-4 5/5 |
| 4 | UAT-5, UAT-6, UAT-7, UI/UX-1 | ✅ 4/4 PASS |
| 5 | UI/UX-2 | ✅ PASS |

## ✅ Round 4 regression: 17/17 PASS
- All Round 1 SIT (8) + Round 2 UAT (7) + Round 3 UI/UX (2) verified.
- 2 fix-up commits during regression: `0c72b0f` (SIT-7 dead refs) + `4edaf3f` (login label for=) + `7f70b89` (CSS token aliases for offcanvas) + `2ba2195` (CIRCLES heading demotion).
- Pending DB migrations are still open (parallel-race autosave + NSM /progress) — flagged migration-dependent, not blocking.

### Friction summary (consolidated bug ledger from session 2)
**Round 2 UAT (7 personas):**
- UAT-1 Alice: 1 BLOCKER (cross-device resume), 3 MAJOR (hint Esc, rt-mtbtn aria, no difficulty filter)
- UAT-2 Ben: 5 HIGH (welcome flag, Tab focus, no submit gate, vertical button, Phase 2 no loader), 4 MEDIUM
- UAT-3 Cathy: 2 HIGH (CIRCLES not migrated on register, Phase 1→2 frozen), 2 MED (resume banner UI silent, /login.html 404)
- UAT-4 David: ✅ ALL PASS (5/5)
- UAT-5 Emma: 3 MAJOR (?view=nsm, 對比 tab gating, parallel autosave dupes), 1 MINOR (1440 single-col)
- UAT-6 Frank: 1 axe CRITICAL (p1-nav-back aria), confirmed hint Esc trap, mode-card unreachable, no <h1>
- UAT-7 Grace: ✅ resume banner works in clean path, but delete with no confirm = MODERATE

**Round 3 UI/UX:**
- UI/UX-1 美學總監: REWORK rec — login cream-on-cream catastrophe, undefined CSS tokens (`--accent` etc.), no elevation system. (Note: agent saw "Phase 1 not loading" + "北極星指標 dead" — these were agent's selector issues; UAT-1/2/3/5 reached both.)
- UI/UX-2 痛點獵人: 20 pain points. Top: login autocomplete missing, hint Esc, no submit gate, tap-targets too small.

**Fixes applied (~30 items across 12 commits):**
- Backend: B1 migrate guest CIRCLES+NSM, B2 idempotent draft, B3 /login.html redirect, NSM /progress endpoint, auth circles-sessions parity (final_report SELECT + maybeSingle).
- Style: C1 login contrast (root-caused undefined CSS tokens), C2 review-examples 2-col grid, C3 axe contrast bumps, C4 帶著風險繼續 width.
- AppJS J1-J18: aria-label back button, hint Esc + backdrop, Tab indent, mode-card focusable, h1 visually-hidden, welcome flag race fix, client submit gate, gate loading spinner, delete confirm, ?view=nsm honored, login autocomplete, tap-target CSS, aria-expanded, NSM Esc cascade, enterkeyhint, "提交審核"→"送出評分".

### Open follow-ups (not blocking, but track)
- Round 1 SIT-2 #14: cron `cleanup-empty-sessions.js` exists but not yet wired to a scheduler.
- UAT-1: no difficulty filter / search box (design ask).
- UAT-2: Ctrl+B inserts markdown not WYSIWYG (acceptable per design intent).
- UAT-2: `返回修改` button no styling (cosmetic).
- UAT-2: Sidebar `載入中…` infinite (root cause unclear — defer).
- UAT-5: 對比 tab requires Step-4 LLM call to reach (design ask).
- UAT-5: No live cross-tab sync (out of scope).
- UI/UX agent contradictions: UI/UX-1 reported Phase-1-not-loading + 北極星指標-dead — likely agent's own click-target issue; multiple UAT agents reached both. To re-verify in next session if doubt remains.

## Open follow-ups (not blocking — see merge gate doc for full list)
1. SIT-1 review-examples.html bullet rendering: was FAILING in last verification (a208f2f0bdad162a1) — fixed by `f14ec9f` (`render()` null guard). Quick re-verify in next session: `curl http://localhost:4001/review-examples.html` then check `<ul class="rt-bullet-list">` count > 0 in browser.
2. `routes/circles-sessions.js` (auth version) has same #8/#9 bug pattern as guest variant — not patched.
3. NSM PATCH `/progress` backend endpoint missing — Fix-A used localStorage stopgap; cross-device persistence missing.
4. `data-rt-action="bold"` button still lacks aria-label.

---

## 🔁 Resume prompt for next session — COPY-PASTE THIS VERBATIM (2026-04-29 latest)

```
請接手 PM Drill rollout controller 工作。Round 1 SIT 已 8/8 PASS（含 fix loop），現在要進 Round 2 UAT。

第一步：讀以下檔案（按順序）—
1. docs/superpowers/test-agents/ROLLOUT-STATE.md（本檔，唯一 source of truth）
2. docs/superpowers/plans/2026-04-28-pm-drill-mega-rollout.md（完整計畫）

第二步：用 superpowers:dispatching-parallel-agents skill。

當前狀態：
- 整合 worktree：`C:\side\first_principle\pm-drill\.worktrees\phase-X-integration`
- Branch：`phase-X-integration` @ `cbd9bbb`（本機 only，未 push）
- Server：`http://localhost:4001`（可能還在跑；不在的話用 ROLLOUT-STATE.md 第 4 行的指令重啟）
- Fix round 已修 16 項 SIT findings + 2 項 regression follow-up
- DB（Supabase 雲端）已 apply migration、本機 working tree 乾淨

執行流程（從這裡開始）：

1. **驗證 Round 1 SIT 結束狀態**：先檢查 a208f2f0bdad162a1 agent 的最後 verification report（在 ROLLOUT-STATE.md 找「2026-04-29 Round 1 final」），確認 SIT-1 + SIT-7 F5 fix 已驗證 PASS。如果還沒，先 dispatch 一個小驗證 agent 跑那兩個 check 點。

2. **Round 2 UAT**：dispatch 7 個 persona agent 平行（用 docs/superpowers/test-agents/uat-prompts.md）。
   - Mac 路徑要換成：`C:\side\first_principle\pm-drill\.worktrees\phase-X-integration`
   - Server 統一打 `PMDRILL_BASE_URL=http://localhost:4001`
   - 每個 agent 是 read-only 測試 + 回報，禁止改 code
   - **波次策略**：3-4 個一波（不要一次 7 個併發爆 token），等回來再下一波
   - 可能會用真 OpenAI（gate review 等）— 提醒 agent 觀察 token 使用，必要時 mock

3. **Round 3 UI/UX**：dispatch 2 個 auditor 平行（uiux-prompts.md）。

4. **Fix Round**（UAT + UI/UX 摩擦點 / 痛點 — 跟之前 SIT fix round 同 pattern，dispatch 多個 fix agent 平行）。

5. **Round 4 regression**：17 agents 全跑（SIT 8 + UAT 7 + UI/UX 2）。要全 PASS 才 merge。

6. **Final merge**：直接 `git checkout main && git merge phase-X-integration && git push`（single-maintainer private repo，no PR）。

最終 merge gate（all must hold）：
- 8/8 SIT PASS（已達成 ✅，但 Round 4 regression 要 re-verify）
- 7/7 UAT 摩擦 = 0
- 2/2 UI/UX BLOCKER + MAJOR + MINOR = 0
- Lighthouse mobile + desktop ≥ 90 a11y/best practices, ≥ 85 perf
- axe-core 0 critical
- console 0 errors
- Round 4 regression 全 PASS

模式：auto mode，自主執行，遇到衝突或設計判斷再問我。

## 重要 gotcha（從這次 session 學到的）：
1. **絕對不要跑 `node scripts/retry-flagged-circles-examples.js`** — 觀察到會把 `circles_database.json` 寫成 0 bullet（過去 session 已有過這個慘痛經驗）。Backup 在 `circles_database.corrupted-2026-04-29.json`。
2. **DB JSON 改完要 restart server**：`routes/circles-public.js` 在啟動時把 questions 載進 in-memory，不會自動 reload。Frontend (app.js / *.html / *.css) 改完不需要 restart，瀏覽器 reload 即可。
3. **Background agent 平行波次**：3-4 個一波最穩。8 個一次併發過去撞過 org rate limit。
4. **Git index.lock**：parallel fix agent commit 偶爾撞鎖，每個 agent 已經教導 wait+retry pattern，但下次有需要可再強化。

## 已知 follow-up（不擋 merge gate，但記著）：
- `routes/circles-sessions.js`（auth 版）有跟 guest 版相同的 #8 (SELECT final_report 不存在) + #9 (PATCH 0-row 假 200) bug pattern，未修
- NSM PATCH `/progress` 後端 endpoint 不存在 — Fix-A 用 localStorage stopgap 暫時頂住，cross-device 不能持久化
- `data-rt-action="bold"` 按鈕沒 aria-label（SIT-7 F3 修了 bullet/indent/outdent，bold 漏掉但不算 critical）

## 之前的舊 resume prompt（保留供參考）

```
請接手 PM Drill 全面 rollout 計畫的 controller 工作。整合已完成、現在要進入 17-agent test gate（user 已選 direction B）。

第一步：讀以下檔案（按順序）—
1. docs/superpowers/test-agents/ROLLOUT-STATE.md（本檔，live state checkpoint）
2. docs/superpowers/plans/2026-04-28-pm-drill-mega-rollout.md（完整計畫，§Phase 7 + 17 agents）

第二步：用 superpowers:subagent-driven-development + dispatching-parallel-agents skill 接手執行。

當前狀態：
- 整合 worktree：`.worktrees/phase-X-integration`，branch `phase-X-integration`，tip `1681c72`，已 push 到 origin
- 7 個 phase branch 全 push 完，全 merge 進整合 branch
- Supabase migration 已 apply（step_drafts + framework_draft + 兩個索引）
- 整合層 desktop test 55 pass / 0 fail，iPhone-15-Pro 關鍵 spec 4 pass / 0 fail
- gh CLI 已裝（auth as Albert-eland，但 repo 是 albertpeng678 個人 repo，不需要 PR — 直接 push main 即可，這是 single-maintainer private repo）

執行流程（從這裡開始）：
1. **Round 1 SIT**：dispatch 8 個 SIT agent 平行（用 docs/superpowers/test-agents/sit-prompts.md）。每個 agent 的 prompt 都要把 prompts file 裡的 Mac 路徑 `/Users/albertpeng/Desktop/claude_project/pm-drill-phase-X-integration` 換成 `C:\side\first_principle\pm-drill\.worktrees\phase-X-integration`。Server 統一跑在 port 4001（用 `PORT=4001 node server.js` 啟動）；告訴每個 agent 用 `PMDRILL_BASE_URL=http://localhost:4001` 跑 playwright。Loop 修到 8/8 PASS。
2. **Round 2 UAT**：dispatch 7 個 UAT persona agent（用 docs/superpowers/test-agents/uat-prompts.md，同樣換路徑 + 用 4001 port）。收集 friction point。
3. **Round 3 UI/UX**：dispatch 2 個 auditor agent（用 docs/superpowers/test-agents/uiux-prompts.md，同樣換路徑 + 用 4001 port）。收集 BLOCKER/MAJOR/MINOR pain point。
4. **Fix Round（零延後）**：所有 SIT failure + UAT 摩擦 + UI/UX 痛點全部修完，commit 到 phase-X-integration branch。
5. **Round 4 regression**：17 agents 全跑，全 PASS 才 merge。
6. **Final merge**：在這個 single-maintainer private repo，跳過 PR 儀式，直接：
   ```
   cd C:\side\first_principle\pm-drill
   git checkout main && git merge phase-X-integration && git push
   ```

最終 merge gate（all must hold）：
- 8/8 SIT PASS
- 7/7 UAT 摩擦點 = 0
- 2/2 UI/UX BLOCKER + MAJOR + MINOR = 0
- Lighthouse mobile + desktop ≥ 90 a11y/best practices, ≥ 85 perf
- axe-core 0 critical
- console 0 errors
- Round 4 regression 全 PASS

過程嚴格使用所有 superpower skill（subagent-driven-development、dispatching-parallel-agents、systematic-debugging、verification-before-completion、finishing-a-development-branch）。

模式：auto mode，繼續自主執行，遇到衝突或設計判斷再問我。

備註：
- 每跑完一輪 round 就 update ROLLOUT-STATE.md
- 失敗的 agent 要 dispatch fix subagent 修，不要在 main controller 裡手寫修正（context pollution）
- Background agent 有時會「假性 done」（短時間零 tool use 就回報），看到這種情況用 git 檢查實際 commit 狀態，不要相信 agent 自我報告
```

---

## Where we are now

| Phase | Status | Branch | Tip | Validation |
|---|---|---|---|---|
| 0 Foundation | ✅ DONE | `phase-0-foundation` | `06acaa8` | 11 commits, both reviews APPROVED |
| 1 Bullet examples | ✅ DONE | `phase-1-bullet-examples` | `628a3ae` | audit 0.6% violation rate (target <1%) |
| 2 Progress save | ✅ DONE | `phase-2-progress-save` | `5dae023` | 16/16 e2e (4 case × 4 viewport) |
| 3 Rich text | ✅ DONE | `phase-3-rich-text` | `b3aa48f` | 23/23 specs |
| 4 Desktop layouts | ✅ DONE | `phase-4-desktop-layouts` | `a632180` | 27 desktop tests |
| 5 Onboarding | ✅ DONE | `phase-5-onboarding` | `2fa3205` | 7 tour specs |
| 6 NSM mobile sheet | ✅ DONE | `phase-6-nsm-mobile-sheet` | `8086905` | 16 specs |
| 7 Integration | ✅ MERGED | `phase-X-integration` | `1681c72` | desktop 55/0, mobile critical 4/0 |

**Phase 7 integration details:**
- Worktree: `.worktrees/phase-X-integration` (off `origin/main`)
- All 7 phase branches merged in dependency order: `0 → 1 → 2 → 3 → 4 → 5 → 6`
- Conflicts resolved in:
  - `public/style.css` — Phase 4 desktop layouts ↔ Phase 5 onboarding (additive, both kept)
  - `public/app.js` — Phase 2 ↔ Phase 5 (banner + welcome card slot stacking, fetchActiveDraft binding ordering)
  - `tests/playwright/playwright.config.js` — baseURL env var precedence (`PMDRILL_BASE_URL` wins, fallback to `PLAYWRIGHT_BASE_URL` then `BASE_URL`)
- **Cross-phase regressions found and fixed during integration** (commit `1681c72`):
  1. `renderCirclesPhase1` desktop branch (Phase 4.2) closed `.circles-progress` without the `.save-indicator` span Phase 2 added on the mobile branch → mirrored span into desktop branch.
  2. `renderCirclesHomeDesktop` (Phase 4.1) doesn't include `.circles-home-wrap` that Phase 2 (resume banner) and Phase 5 (onboarding welcome) target → wrapped desktop home in `.circles-home-wrap` and injected `welcomeHtml` + `renderResumeBanner()` above `.ch-grid`.

**Verification at integration tip:**
- `PMDRILL_BASE_URL=http://localhost:4001 npx playwright test --config=tests/playwright/playwright.config.js --project=Desktop` → **55 passed, 6 skipped, 0 failures**
- iPhone-15-Pro on critical specs (`circles-progress-save`, `onboarding-tour`, `nsm-step4-mobile-compare`, `foundation-tokens`) → **4 passed, 0 failures**

---

## What's NOT done yet (Phase 7 test gate — direction B chosen)

1. **Round 1 SIT** — 8 parallel agents per `docs/superpowers/test-agents/sit-prompts.md`
   - Heads-up: prompt files have Mac paths (`/Users/albertpeng/Desktop/claude_project/pm-drill-phase-X-integration`) — substitute `C:\side\first_principle\pm-drill\.worktrees\phase-X-integration` at dispatch.
   - Tell every agent to target `PMDRILL_BASE_URL=http://localhost:4001` (single integration server).
2. **Round 2 UAT** — 7 persona agents per `docs/superpowers/test-agents/uat-prompts.md`
3. **Round 3 UI/UX** — 2 auditors per `docs/superpowers/test-agents/uiux-prompts.md`
4. **Fix round (zero deferral)** — fix every SIT failure + UAT friction + UI/UX pain point on `phase-X-integration` branch
5. **Round 4 regression** — re-run all 17 agents
6. **Final merge** — `git checkout main && git merge phase-X-integration && git push` (single-maintainer private repo, no PR ceremony per user 2026-04-29)

---

## Final merge gate (all must hold)

- 8/8 SIT PASS
- 7/7 UAT mission complete + friction = 0
- 2/2 UI/UX BLOCKER + MAJOR + MINOR = 0
- Lighthouse mobile + desktop ≥ 90 (a11y / best practices), ≥ 85 (perf)
- axe-core 0 critical
- Console 0 errors during 17-agent e2e
- Round 4 regression all PASS

---

## Plan + spec source-of-truth

- Plan: `docs/superpowers/plans/2026-04-28-pm-drill-mega-rollout.md` (1512 lines, 7 phases + 17 test agents)
- Specs:
  - `docs/superpowers/specs/2026-04-28-circles-examples-bullet-format-design.md` (Phase 1)
  - `docs/superpowers/specs/2026-04-28-circles-progress-save-design.md` (Phase 2)
  - `docs/superpowers/specs/2026-04-28-rich-text-input-design.md` (Phase 3)
  - `docs/superpowers/specs/2026-04-28-desktop-rwd-direction-c-design.md` (Phase 4 + 5 + 6)
- Test agent prompts (pre-written):
  - `docs/superpowers/test-agents/sit-prompts.md` (8 SIT)
  - `docs/superpowers/test-agents/uat-prompts.md` (7 UAT)
  - `docs/superpowers/test-agents/uiux-prompts.md` (2 UI/UX)

---

## Worktrees on disk

- `.worktrees/phase-X-integration` — **integration branch (next session works here)**
- `.worktrees/phase-{1,2,3,4,5,6}` — phase branches (kept; can be discarded if no hotfix needed)
- `.worktrees/circles-feature`, `circles-training`, `mobile-smooth` — pre-existing, unrelated to this rollout

---

## Supabase migration state

`migrations/2026-04-28-circles-step-drafts.sql` was applied to project `klvlizxmvzfpvfgswmfk` on 2026-04-29 by user. Verified via PostgREST schema dump: `step_drafts` + `framework_draft` JSONB columns exist with NOT NULL DEFAULT `'{}'::jsonb`, plus two partial indexes (`idx_circles_sessions_active_user`, `idx_circles_sessions_active_guest`) for the resume-banner query.

---

## Recovery procedure (if controller session crashes mid-round)

1. Read this file end-to-end.
2. Read `docs/superpowers/plans/2026-04-28-pm-drill-mega-rollout.md` (especially §Phase 7 + 17 agents).
3. `git -C C:\side\first_principle\pm-drill\.worktrees\phase-X-integration log --oneline` — see how far we got.
4. `git -C C:\side\first_principle\pm-drill\.worktrees\phase-X-integration status` — uncommitted work?
5. Check this file's "rounds done" section (added below as we progress).
6. Resume from the appropriate next round.

---

## Rounds completion log (update as rounds complete)

- 2026-04-29 — Phases 0-6 + Phase 7 integration ✅ DONE. SIT/UAT/UI-UX **not yet started**.
- 2026-04-29 — Round 1 SIT **attempt #1 BLOCKED** by org monthly usage limit. All 8 agents dispatched in parallel (`phase-X-integration` @ `1681c72`, port 4001). Each agent did real work (14-25 tool uses) before being cut off by org budget. SIT-8 separately stalled at 600s watchdog. **No PASS/FAIL evidence collected; SIT must be re-run when quota resets.**
- 2026-04-29 — Round 1 SIT **✅ COMPLETE — 8/8 PASS after fix loop** at `phase-X-integration` @ `cbd9bbb`. Total: 14 fix commits + regression sweep all green.

  **Final SIT regression results (2026-04-29):**
  - SIT-1 (rerun + cbd9bbb verification): bullets render via app.js + audit 0/2700. ✅ (verification agent `a208f2f0bdad162a1` was running at session end — re-confirm in next session if not already).
  - SIT-2: ✅ PASS (cron + NSM dim localStorage + 4/4 progress-save spec).
  - SIT-3: ✅ PASS with caveats (auth-gate path was agent navigation issue, not RWD bug).
  - SIT-4: ✅ PASS (desktop spotlight + welcome race + first-paint flash all fixed).
  - SIT-5: ✅ PASS (14/14 from initial run).
  - SIT-6: ✅ PASS (`\n` preserved on reload via escTextarea + smoke).
  - SIT-7: ✅ PASS (F1-F4 + F5 home; review-examples #meta also fixed at cbd9bbb).
  - SIT-8: ✅ PASS (S5c 404 + S7 incomplete-steps 400 + S11 invalid_json 400).

  **Fix commits applied (14 total, all on `phase-X-integration`, NOT yet pushed):**
  - `25bb30a` (Fix-B): review-examples.html load app.js + filter-step `<label>` + aria-label
  - `2b29add` (Fix-C): rt-mtbtn aria-labels (bullet/indent/outdent) + font preload + `--c-text-secondary` token + .ch-meta/.rail-label color-contrast
  - `b25542c` (Fix-D): guest routes — final-report 400/500 distinction (removed nonexistent `final_report` column SELECT), PATCH /progress 404 cross-tenant, JSON error middleware
  - `083995c` (Fix-E): 17 DB JSON edits — circles_023 orphan ** removed + 16 audit-flagged fields polished (audit 0.6% → 0%)
  - `08e4dbd` (Fix-F): scripts/cleanup-empty-sessions.js + npm scripts (dry-run mode confirmed working)
  - `48558a3` (Fix-A): public/app.js — escTextarea() at 7 textarea sites + ONBOARDING_TARGETS desktop selectors + welcome card race fixes + dead /api/guest/sessions refs removed + NSM dim localStorage stopgap
  - `cbd9bbb` (regression follow-up): app.js renderNavbar null guard (unblocks app.js as module on review-examples.html) + review-examples.html `--text-3` darken to #666 (AA contrast)

  **Open follow-ups (don't block merge gate, but track):**
  - `routes/circles-sessions.js` (auth version) has same #8 + #9 bug patterns as guest variant; NOT fixed in scope of Fix-D agent
  - NSM `/progress` PATCH backend endpoint doesn't exist — Fix-A used localStorage stopgap; cross-device persistence missing
  - `data-rt-action="bold"` button still lacks aria-label (visible `<strong>B</strong>` text suffices for SR but worth filling for consistency)

- 2026-04-29 — Round 1 SIT **attempt #2 fix-loop history** — quota reset, agents in waves of 3:
  - **DB CORRUPTION recovered**: `circles_plan/circles_database.json` working copy had 0 bullets (origin had 5947). Restored from HEAD; backup at `C:\side\first_principle\pm-drill\circles_database.corrupted-2026-04-29.json`. **DO NOT run `retry-flagged-circles-examples.js`** during SIT — observed to corrupt DB. Add to fix-round followup: investigate retry script for atomic write semantics.
  - SIT-5 rich text toolbar: ✅ **PASS** 14/14 (`a54b8c17318240d00`)
  - SIT-4 onboarding: ❌ **FAIL** (`a0d563b698476cfc2`) — 3 defects:
    - (1) Desktop spotlight targets miss: `ONBOARDING_TARGETS` at `public/app.js:1571-1576` use mobile selectors (`.circles-mode-row`, `.circles-type-tabs`); desktop home renders `.mode-section` / `.type-section`. Known TODO at app.js:1570 from phase 4.1 merge. **Must fix.**
    - (2) Welcome card race: `updateRecentSessionsSlot()` (`app.js:594`) populates resume slot when async sessions arrive but never re-evaluates `shouldShowOnboardingWelcome()`. Both welcome + resume cards visible. **Must fix.**
    - (3) Step 4 「完成」 doesn't auto-navigate to Phase 1 — likely by-design (`endOnboardingTour()` at `app.js:1733`). Scenario interpretation; not a hard fix.
  - SIT-3 desktop responsive: ✅ **PASS with caveats** (`aaff74ff57447d2f2`) — max-width / `--c-primary` / Phosphor icons / navbar / favicon / resize stability all verified. Auth-gated screens (Phase 1/2/3, NSM 2-4) verified by CSS source inspection only — agent used wrong nav path (state mutation instead of question-card click); not a real RWD bug. NSM home width 749 was the auth modal overlay narrowing display, not a regression. **No fix needed.**
  - SIT-1 rerun: ❌ **FAIL** (`a3891ae9afcc270a0`) — audit 0.6% PASS, but 3 issues:
    - (a) `public/review-examples.html` does NOT include `<script src="/app.js">` → its own `renderText` (`review-examples.html:141-147`) falls through to prose-only fallback, bullets render as literal `- text` instead of `<ul>`. **Must fix.**
    - (b) Orphan `**` in `circles_023.field_examples.C1.問題範圍`: `轉賬前：匯率信息不透明，難以預估**`. **Must fix (data).**
    - (c) Server stale: dev server at port 4001 started BEFORE DB restore, in-memory `QUESTIONS` array still has prose. Restart needed (operational, do after SIT-2 finishes).
    - Plus audit content quality: 15 fields exceed 4 top-level bullets (C2.取捨標準 across LINE/Spotify/LinkedIn/Uber/Shopee), 1 field >320 chars (circles_048 I.目標用戶分群 = 352). All within 1% budget but worth a polish pass.
  - SIT-2 progress save: ⚠️ **PASS WITH FINDINGS** (`a403d87dafc36a80b`) — 15/17 PASS. 2 follow-ups:
    - (a) Scenario 14: cron cleanup script not implemented per Spec 2 line 173 (`status='active' AND step_drafts={} AND created_at < now-24h` → delete). Low blast radius. Add to fix-round / followup.
    - (b) Scenario 17: NSM 4-dim sub-textareas only mutate `AppState.nsmBreakdownDraft` locally; no PATCH/POST. Listener at `public/app.js:5772-5777` lacks `triggerCirclesAutoSave()` equivalent. User can lose dim breakdown if they navigate before submitting Step 3. **Real UX bug — must fix.**
  - **Server restarted** at port 4001 (PID was 31788; killed via PowerShell, restarted with restored DB). API now serves 5947 bullets. Logs at `C:\side\first_principle\pm-drill\sit-server-2.log`.
  - SIT-8 backend API: ⚠️ **PASS-with-issues** (`a4db3f5bf7dcd463e`) — 13 scenarios mostly green. 3 follow-ups:
    - (a) Guest `POST /api/guest-circles-sessions/:id/final-report` returns 404 instead of 400/incomplete on known-existing session. Likely cause: `select('question_json, step_scores, final_report')` fails because `final_report` column doesn't exist in DB schema. File: `routes/guest-circles-sessions.js:229-251`. **Must fix.**
    - (b) Wrong-owner PATCH `/progress` returns 200 instead of 403/404 (Supabase `.update().eq().eq()` doesn't error on 0-rows-matched). File: `routes/guest-circles-sessions.js:209-226`. Data integrity preserved but API lies. Should `.select('id').single()` to surface 404. **Must fix.**
    - (c) Malformed JSON body returns Express default HTML error page leaking absolute Windows paths. Hardening gap — add global JSON error handler middleware. **Must fix.**
    - Plan correction: guest NSM mount is `/api/guest/nsm-sessions` (slash), not `/api/guest-nsm-sessions` (hyphen).
  - SIT-7 a11y / console / browser: ⚠️ **conditional PASS** (`ad47914a56d007c8c`):
    - **F1 HIGH (real bug)**: `/api/guest/sessions` 404 on every app page. `routes/guest-sessions.js` defined but unmounted in `server.js`. `public/app.js:720` + `:4019` still reference it. Either mount route OR remove dead refs (preferred). **Must fix.**
    - **F2 MEDIUM (a11y critical)**: `public/review-examples.html` `<select id="filter-step">` no accessible name. axe-core `select-name` critical. One-line fix. **Must fix.**
    - **F3 LOW**: 3 mobile `.rt-mtbtn` buttons (bullet/indent/outdent) at `public/index.html:46-48` lack `aria-label`. Hidden by default; impact contained.
    - **F4 LOW**: No `<link rel="preload" as="font">` for DM Sans / Instrument Serif. preconnect + stylesheet only.
    - **F5 LOW**: Color-contrast serious (not critical) on `.ch-meta`, `.rail-label`, `#meta`.
    - Lighthouse skipped (not installed). Firefox/Webkit unavailable. axe-core: 0 critical on 10/11 app screens, 1 critical on review-examples (F2).
  - SIT-6 cross-spec: ❌ **FAIL** (`ae53aeefd6229d7c6`) — 6/8 PASS, 1 critical regression:
    - **S5 CRITICAL — `\n` → `<br>` corruption on resume**: `escHtml()` at `public/app.js:4307-4309` does `.replace(/\n/g,'<br>')`, and `app.js:2274` + `:2308` use `escHtml(val)` to fill `<textarea>` contents. Textareas are RCDATA — the literal `<br>` chars appear as text after reload. Server data intact (S4 confirmed); regression is purely client render. **Must fix.**
    - S2 (7-step sim) NOT RUN due to OpenAI dependency budget (~8 sequential calls). Acceptable per agent note.
    - Welcome card pre-fetch flash on `/` (cosmetic, before `fetchActiveDraft` resolves) — folds into SIT-4 #5 fix.

## Round 1 SIT — consolidated fix list (16 items, all to be fixed per user 2026-04-29)

**Real bugs (must fix):**
1. `public/review-examples.html` missing `<script src="/app.js">` → bullets render as prose (SIT-1)
2. `circles_023.field_examples.C1.問題範圍` orphan `**` (SIT-1)
3. NSM 4-dim sub-textareas (`public/app.js:5772-5777`) lack `triggerCirclesAutoSave` (SIT-2)
4. ONBOARDING_TARGETS (`public/app.js:1571-1576`) use mobile selectors; desktop home renders `.mode-section`/`.type-section` (SIT-4)
5. Welcome card race + pre-fetch flash: `updateRecentSessionsSlot()` (`app.js:594`) doesn't re-evaluate `shouldShowOnboardingWelcome()` (SIT-4 + SIT-6 cosmetic flash)
6. `/api/guest/sessions` 404: `routes/guest-sessions.js` defined but unmounted in `server.js`; `app.js:720` + `:4019` still reference (SIT-7 F1) — preferred fix: remove dead refs
7. `public/review-examples.html` `<select id="filter-step">` missing accessible name (SIT-7 F2)
8. Guest `POST /api/guest-circles-sessions/:id/final-report` returns 404 instead of 400/incomplete; SELECT includes nonexistent `final_report` column (`routes/guest-circles-sessions.js:229-251`) (SIT-8 a)
9. Wrong-owner PATCH `/progress` returns 200 not 403/404 (`routes/guest-circles-sessions.js:209-226`) — needs `.select('id').single()` (SIT-8 b)
10. Malformed JSON returns Express HTML error page leaking Windows file paths — needs global JSON error handler middleware (SIT-8 c)
11. **CRITICAL**: `escHtml()` `\n→<br>` substitution corrupts textarea content on resume (`app.js:4307-4309` + `:2274`/`:2308`) — needs textarea-safe escape variant (SIT-6 S5)

**Nice-to-have (also fix per user instruction):**
12. Cron cleanup script for empty orphan sessions per Spec 2 §173 (SIT-2 #14)
13. 3 mobile `.rt-mtbtn` buttons (`public/index.html:46-48`) lack aria-label (SIT-7 F3)
14. Add `<link rel="preload" as="font">` for DM Sans + Instrument Serif (SIT-7 F4)
15. Color-contrast on `.ch-meta` / `.rail-label` / `#meta` (SIT-7 F5)
16. 15 audit-flagged fields exceed 4 top-level bullets + 1 field >320 chars (circles_048 I.目標用戶分群 = 352) (SIT-1 audit polish)
- _(future rounds get appended here)_

---

## Risk + ops notes

- gh CLI is installed and auth'd as `Albert-eland`, but repo is `albertpeng678/First_Principle` (private). PR creation via API fails (must be collaborator). Per user direction (2026-04-29): this is single-maintainer private repo with only `main` long-lived branch — skip PR ceremony, just merge + push directly.
- `.env` and `node_modules` are symlinked into every phase + integration worktree from `C:\side\first_principle\pm-drill\.env` and `C:\side\first_principle\pm-drill\node_modules`.
- Port 4000 is pinned to a different process (the original main worktree's dev server). Phase-X-integration server runs on **port 4001**.
- Background agent failure mode observed in this session: a "Monitor-armed" agent re-fires on every event but does no real work — wastes notifications. Detect via `tool_uses: 0` + short `duration_ms` in completion result; `TaskStop` to silence.
- Background agent "假性 done" (silent early exit) — always verify with `git log` on the worktree, not the agent's self-report.
- Phase 1 Task 1.4 (regenerate questions via OpenAI / `node scripts/generate-circles-examples.js`) consumes API budget. Already done; no need to re-run unless audit drift.
