---
name: audit-cycle
description: Run the complete multi-agent UI/UX + functional audit on PM Drill — dispatches 11 parallel agents (8 step coverage [C1/I/R/C2/L/E/S/NSM] + 2 UI/UX auditors + 1 test director persona). The director (you) consolidates issues, drives fix loop using superpowers:test-driven-development + systematic-debugging + verification-before-completion, requires brainstorming + visual-companion mockup approval before any UI/UX change, and signs off only when 0 P0 / 0 P1 across all 8 viewport projects. Trigger when the user says any of "跑審查", "全套測試", "全套 audit", "audit cycle", "audit 一輪", "/audit", "做完整檢查", or after a major UI/feature change that needs cross-step + cross-device validation before ship.
---

# PM Drill Audit Cycle

You are the **Test Director (測試總負責人)** — a senior, perfectionist QA lead. Your job is to run the audit end-to-end and not let any P0/P1 ship. All eleven agents below report to you. Your word is law: when you say "fix", they fix; when you say "re-test", they re-test; you do not sign off until evidence is in.

**Announce at start:** "I'm using the audit-cycle skill. I'll act as the test director and dispatch 11 agents in parallel."

---

## Hard requirements (from the user)

1. Eight step-coverage agents — one per CIRCLES letter + one for NSM workshop. Each fully covers their step's UI/UX and user flow.
2. Two UI/UX auditors — one aesthetics (美學總監), one RWD pain-point hunter (痛點獵人). They apply the **strictest** UI/UX bar.
3. All user scenarios must be covered. The full enumeration lives in **§ "User scenarios universe"** below — every item there is the director's responsibility. Highlights (non-exhaustive): guest mode AND auth mode in parallel, register / login / logout, guest→auth migration on sign-in, onboarding welcome (first-time + replay via `?onboarding=1`), resume banner on home, offcanvas (練習記錄) open / load / delete / empty, history view (chart + list + delete + empty), CIRCLES Phase 1 fields × hint × 查看範例 × autosave × rich-text toolbar × IME 組字, Phase 1.5 gate review (pass/warn/error), Phase 2 chat (interview practice + conclusion expanded), Phase 3 step score, Phase 4 final report (radar + scores), CIRCLES simulation mode, NSM workshop (steps 1-4 + gate between 2 and 3 + hints + dimension breakdown), conclusion-check API, review-examples standalone page, network/error fallbacks (401 expired, 500 LLM down, offline). Anything in § universe that goes unexercised is a director failure.
4. All eight viewport projects must be exercised: Mobile-360 / iPhone-SE / iPhone-14 / iPhone-15-Pro / iPad / Desktop-1280 / Desktop-1440 / Desktop-2560.
5. **Any UI/UX change** discovered through the audit MUST be presented as a mockup via `superpowers:brainstorming` + visual companion before coding. The user must eyeball-approve.
6. All agents report to you (the director). You file the consolidated issues. Fix agents must close every assigned issue, then hand back to the original test agent for re-verification before the issue is closed.
7. Every step uses superpower skills — see § "Required superpower skills" below.

---

## Required superpower skills (invoke in order)

| Phase | Skill | Why |
|---|---|---|
| Activation | `superpowers:using-superpowers` (already loaded by virtue of being here) | Confirms skill discipline |
| Wave 1 dispatch | `superpowers:dispatching-parallel-agents` | 11 independent test agents in one batch |
| Issue triage / fix design | `superpowers:brainstorming` (with visual companion when UI/UX) | Mandatory mockup approval gate |
| Implementation plan | `superpowers:writing-plans` | After brainstorming, write the plan |
| Fix execution | `superpowers:subagent-driven-development` (preferred) or `superpowers:executing-plans` | Plan execution |
| Per-fix discipline | `superpowers:test-driven-development` + `superpowers:systematic-debugging` + `superpowers:verification-before-completion` | Red→green→evidence on every fix |
| Final hand-off | `superpowers:finishing-a-development-branch` | Push / tag / done |

If any of these is absent at the moment of need, invoke it explicitly via the `Skill` tool before proceeding.

---

## User scenarios universe (ground truth — must all be covered)

Every row below was verified against the **current** code (`public/app.js`,
`server.js`, `routes/*`, `public/style.css`, `public/review-examples.html`,
`tests/playwright/**`) on the date the skill was last updated. Removed:
legacy `home` view + `practice` / `report` views (default view is `circles`,
home view is never set, server no longer mounts `/api/sessions` or
`/api/guest-sessions`); dark mode (deleted from CSS); "沒有更多題目" copy
(no longer in code). If you find a row here that no longer matches code,
fix the universe in the same audit cycle — do not silently skip.

Each step agent picks the rows that touch their step; the two UI/UX
auditors apply their lens to every row. The director cross-checks at
consolidation that every row has at least one piece of evidence
(screenshot, console log, Playwright run).

### A. Identity & session
- A1. Guest first-visit lands on `/` (default `AppState.view = 'circles'`); `x-guest-id` UUIDv4 minted client-side and sent in the `X-Guest-ID` header. Middleware at `middleware/guest.js` rejects missing/invalid IDs with 400.
- A2. Register via `POST /api/auth/register` (email + password). `routes/auth.js` calls Supabase `admin.createUser({ email_confirm: true })` — there is **no email-verification step**; happy path returns `{ ok:true, userId }`, errors return `{ error: <supabase msg> }` with 400.
- A3. Login via Supabase client SDK — success, wrong password, unknown email.
- A4. Logout: `#btn-logout` calls `supabase.auth.signOut()` → `SIGNED_OUT` event → state cleared, returns to `/` as guest.
- A5. Guest → Auth migration: `SIGNED_IN` event triggers `migrateGuestSessions()` → `POST /api/migrate-guest` with `Authorization: Bearer …` + `X-Guest-ID: <guestId>`. Body sends `{ guestSessionIds: [lastSessionId] }`. Verify all three buckets:
  - **CIRCLES** (`circles_sessions`): rows with `guest_id=<gid>` and `user_id IS NULL` are claimed in-place (`guest_id → null`, `user_id → req.user.id`).
  - **NSM** (`nsm_sessions`): same in-place claim.
  - **Legacy** (`guest_sessions` → `practice_sessions`): rows in `guestSessionIds` are copied (without `id`/`guest_id`/`expires_at`) and the original guest rows deleted.
- A5-conflict. **23505 path**: when the auth user already has an active row for the same `(question_id, mode, drill_step)` tuple, the per-row claim swallows the unique-violation, deletes the guest orphan, and increments `result.conflicts`. Confirm a follow-up audit shows no orphan guest row and no duplicate auth row.
- A6. Mid-call 401: app.js currently has no 401 interceptor — exercise this path and **file a P1 if a fetch fails silently and the draft is lost**. Director should treat any silent loss as a real bug.

### B. Onboarding & navigation
- B1. First-time visit (localStorage `circles_onboarding_done` !== '1' AND no `?onboarding=0`) injects the onboarding welcome card into the CIRCLES home wrap.
- B2. Multi-step coachmark tour with arrow positions (`top` / `bottom`) walks: 挑題目 → 開始練習 → … `#onb-skip` aborts; `#onb-start` advances. After completion, `circles_onboarding_done` flips to `'1'`.
- B3. `?onboarding=1` forces replay even after the flag is set (dev hook).
- B4. `?onboarding=0` suppresses welcome (used by Playwright fixtures).
- B5. Navbar logo (`#navbar-home-btn`) from any phase wipes `circlesSession`, `circlesSelectedQuestion`, `circlesPhase=1` and returns to the question picker.
- B6. Navbar tabs (`CIRCLES` / `北極星指標`) switch view; `aria-current="page"` synced via `syncNavbarTab()`.
- B7. Hamburger (`#btn-hamburger`) opens offcanvas (`#offcanvas`); overlay click + `#btn-offcanvas-close` close it.
- B8. Legacy URL relink: `GET /login.html` returns `302 → /?view=login` (server.js line ~22). `?view=<X>` query is read at boot and applied to `AppState.view`.

### C. Question picker & resume (CIRCLES home)
- C1. Mode picker: two `.circles-mode-card[data-mode]` cards (`drill` / `simulation`) on home — clicking persists `localStorage.circlesMode`, default `'simulation'`.
- C2. Question-type tabs: `.circles-type-tab[data-type]` × 3 — `產品設計` / `產品改進` / `產品策略` with live counts (`×N`). Active tab persists in `AppState.circlesSelectedType` (default `'design'`).
- C3. Random-5 + 換一批: `pickRandom5(filteredQs)` shows 5 cards; refresh button announces `'已隨機重新選 5 題'` to an `aria-live="polite"` region (AUD-039).
- C4. Question card: tag row, company / product, difficulty badge (`DIFF_LABEL`: `easy → 簡單` / `medium → 中等難度` / `hard → 困難`), line-clamped brief, **看完整題目** expand-in-place, **確認，開始練習** sticky submit at the bottom.
- C5. Pick a question → Phase 1 step C1 (drill) or simulation step 0, fields empty.
- C6. Resume banner: when active drafts exist, `renderResumeBanner()` shows one card per session (CIRCLES + NSM mixed). Each card has `.resume-go` (繼續 →) and `.dismiss` (X). Confirm a session is dismissable without deleting the row in DB.
- C7. Boot-time auto-resume prompt: if `lastSessionId` is set and a draft exists, `confirm('繼續上次的練習？')` is shown; OK → `AppState.view='practice'` is set on the legacy path **but** for CIRCLES drafts the resume banner is the live path. Verify CIRCLES does not regress into the legacy practice view.

### D. CIRCLES Phase 1 (drill mode, per step C1/I/R/C2/L/E/S)
- D1. Each field renders: label, **提示** button, **查看範例** button, textarea / rich-text editor.
- D2. Rich-text toolbar: bold (`Ctrl+B`), bullet list (`Ctrl+L`), indent (`Tab`), outdent — desktop top toolbar (`.rt-tbtn`) AND mobile sticky bottom toolbar (`.rt-toolbar-mobile` `.rt-mtbtn`, hidden via CSS on ≥1024px).
- D3. IME 組字: textarea has `compositionstart` / `compositionend` listeners that flip `ta._rtComposing`; events with `e.isComposing` (or keyCode 229) are skipped. Verify zhuyin / pinyin composition does not commit partial text and toolbar shortcuts no-op mid-composition.
- D4. Hint button → `POST /api/circles-sessions/:id/hint` (auth) or `POST /api/circles-public/hint` (guest); response cached in-memory per field; second click on same field reuses cache without network.
- D5. 查看範例 → same auth/guest split (`/example` vs `/api/circles-public/example`); cached.
- D6. Autosave: debounced `PATCH /:id/progress` on every textarea input; save indicator (`.save-indicator`, `aria-live="polite"`) transitions saving → saved.
- D7. Mid-step refresh: text content restored. (Caret position is **not** restored — do not file P1 for that.)
- D8. **下一步** advances; **上一步** returns; progress bar reflects current step (`buildCirclesProgressBar(stepIdx, { includeSaveIndicator })`).
- D9. Hint card toggle: collapsed shows `查看教練提示`; expanded shows `收起提示`.
- D10. Loading & retry: gate / evaluate / final-report show `'AI 審核中...'` while in flight; on failure the bottom bar surfaces a `.btn-retry` (`重試`) button.

### E. CIRCLES Phase 1.5 — gate review
- E1. From step C1 click **送出** → `POST /:id/gate` → pass / warn / error card with rationale.
- E2. **修改** returns to Phase 1 with drafts intact; **繼續** advances to Phase 2.
- E3. Simulation override: in simulation mode a fail-state gate **still** shows a bottom-bar `#circles-gate-continue` (繼續) so the run is not blocked. In drill mode, fail blocks the advance — verify both branches.

### F. CIRCLES Phase 2 — chat (interview practice on R)
- F1. Render bubbles: user message → 被訪談者 reply → 教練點評 reply (single LLM response is parsed by matching `【被訪談者】` and `【教練點評】` headers — see `app.js:3812`).
- F2. Send message → `POST /:id/message` → all three bubbles append.
- F3. **Conclusion-expanded** state: when `AppState.circlesSubmitState = 'expanded'` (Playwright fixture `09-phase2-conclusion-expanded`), the conclusion box expands and the sticky action row (← 繼續對話 / 確認提交) must remain reachable on every desktop height.
- F4. **繼續對話** stays in Phase 2; **進入下一階段** runs `POST /:id/conclusion-check` then advances.

### G. CIRCLES Phase 3 — per-step score
- G1. `POST /:id/evaluate-step` → score breakdown card; radar chart (`renderRadar`) renders.
- G2. Re-evaluate path works (no stale render).
- G3. Simulation only: score nav `◀` / `▶` switches displayed score for prev/next step using the in-memory cache without re-fetching.

### H. CIRCLES Phase 4 — final report
- H1. From step S **送出最終報告** → `POST /:id/final-report` → renders `renderCirclesFinalReport`.
- H2. CIRCLES radar (per letter) + NSM 4-dimension scores correct.
- H3. **回首頁** returns to `/`; session marked completed in offcanvas + history.
- H4. Step S sub-tabs: `S-1 摘要` and `S-2 追蹤指標` (4-dim NSM tracking-block) — both must render and switch correctly via `.s-step-tab[data-s-step]`.
- H5. **匯出 PNG** (`#btn-export-png`): dynamic-import `html2canvas@1.4.1` from esm.sh, capture the report, download as PNG. Verify produces a non-blank image at every viewport (esm.sh CDN may be blocked → expect a graceful failure with no console explosion).
- H6. Simulation last-step S also offers `看完整總結報告` to enter Phase 4.

### I. CIRCLES simulation mode
- I1. Simulation walks all 7 letters via `circlesSimStep` (0-6), advancing through `saveCirclesProgress({ currentPhase:1, simStepIndex: stepIdx + 1 })` instead of phase transitions.
- I2. Simulation final state lands on `H6` (Phase 4 final report) without broken transitions.

### J. NSM workshop (北極星指標)
- J1. Sub-tab nav (`AppState.nsmSubTab`): `nsm-step2` (定義 NSM) → gate → `nsm-step3` (拆解指標, disabled until `gatePassed`). Step 4 (總結) is its own screen.
- J2. NSM home → step 1 (情境) → step 2 → **gate** (`POST /api/nsm-sessions/:id/gate` or `…/guest/nsm-sessions/:id/gate`) → step 3 (4 dim) → step 4.
- J3. Step 2 has `#btn-nsm-redefine` (重新定義 NSM) — clicking resets step 3 state.
- J4. NSM hints API: `POST /:id/hints` (plural) per dimension.
- J5. NSM context API: `POST /api/nsm-context` for context generation.
- J6. NSM evaluate API: `POST /:id/evaluate` produces the 4-dim breakdown for the radar.
- J7. Step 4 mobile vs desktop layout parity (NSM-specific subtab row + radar size).
- J8. Per-screen back / home: `#btn-nsm-back` (← 返回上一步) and `#btn-nsm-home-nav` (回首頁) appear on steps 2/3/4.

### K. History & offcanvas
- K1. Offcanvas list shows CIRCLES + NSM sessions interleaved with correct timestamps; click loads the session into the right view (CIRCLES → `circles`, NSM → `nsm` step 4).
- K2. Offcanvas delete: `.offcanvas-delete-btn` → `confirm('確定刪除這次練習？此操作無法復原。')` → `DELETE /:id` → row removed locally; no console error.
- K3. Offcanvas empty state: `'尚無練習記錄'`.
- K4. History view (`renderHistory`): list with `.history-delete-btn` → inline `'確定刪除嗎？'` confirm + `.btn-danger.history-confirm-delete`. Empty list shows `'還沒有練習記錄'`.
- K5. History chart (`renderHistoryChart`): only renders 總分趨勢 once **≥2 completed** sessions exist; otherwise shows `'完成至少 2 次練習後顯示進步曲線'`. Loading errors show `'載入失敗'`.

### L. review-examples (standalone)
- L1. `/review-examples.html` loads as a static SPA with its own search input (`#review-examples-search` / `#search`) and step filter (`#filter-step` select). `#filter-step` is `aria-label="步驟篩選"`. Verify keyword filter (公司／產品／題目) and step filter both narrow the list with no JS errors.

### M. Cross-cutting
- M1. Network / error envelope: server returns `{ error: 'invalid_json' }` 400 on malformed JSON bodies (`server.js`); LLM 500 surfaces `重試` (D10); 401 path is currently uninstrumented — file gaps as P1 if drafts are lost.
- M2. Console: zero errors / zero unhandled rejections on every audited route.
- M3. Mobile keyboard (`interactive-widget=resizes-visual` in `<meta name=viewport>`): focusing a textarea must not push the sticky `.rt-toolbar-mobile` or sticky **確認，開始練習** off-screen.
- M4. iOS safe-area-insets: `env(safe-area-inset-bottom)` is consumed in style.css (sticky bottom bars, mobile rt-toolbar, etc.); confirm rendering on iPhone-SE / iPhone-14 / iPhone-15-Pro.
- M5. Tap targets ≥44×44 logical px on every touch viewport.
- M6. Focus rings visible on keyboard nav; tab order sane; no focus traps.
- M7. aria-live announcements: save-indicator (`polite`), hint loader (`polite`), shuffle counter (`'已隨機重新選 5 題'`).
- M8. Server hardening: malformed JSON body returns the JSON error envelope, not the HTML stack trace (would leak filesystem paths).

---

## Phase 0 — Director set-up

1. Verify environment baseline:
   ```bash
   curl -fsS http://localhost:4000/ -o /dev/null -w "HTTP %{http_code}\n"
   git status --short && git log --oneline -3
   node -e "require('dotenv').config(); console.log(['SUPABASE_URL','SUPABASE_ANON_KEY','OPENAI_API_KEY'].every(k=>!!process.env[k]))"
   ```
   All three must succeed (HTTP 200, clean tree, env vars present). If not, fix before dispatching.

2. Create the audit cycle workspace:
   ```bash
   AUDIT_DATE=$(date -u +%Y-%m-%d)
   mkdir -p audit/cycles/$AUDIT_DATE/{logs,screenshots,issues}
   ```
   Save `$AUDIT_DATE` mentally — every agent writes its output under that folder.

3. Capture baseline test counts (so the director can compare post-fix):
   ```bash
   PMDRILL_BASE_URL=http://localhost:4000 npx playwright test \
     --config=tests/playwright/playwright.config.js journeys/audit/ \
     --workers=4 --reporter=line 2>&1 | tail -3
   ```
   Record `<N passed / 0 failed / M skipped>` as the baseline.

---

## Phase 1 — Wave 1: dispatch 11 agents in parallel

**Use `superpowers:dispatching-parallel-agents`.** Send all 11 `Agent` tool calls in a single message so they run concurrently. Each agent gets its own self-contained prompt — they do not share conversation history with you or with each other.

### 1a. Step coverage agents (8)

Use `subagent_type: "general-purpose"` for each. Identical prompt template, with `<STEP>` substituted per agent. The 8 substitutions are:

| Agent ID | STEP_KEY | LETTER | LABEL | FIELDS |
|---|---|---|---|---|
| step-c1 | C1 | C | 澄清情境 | 問題範圍 / 時間範圍 / 業務影響 / 假設確認 |
| step-i  | I  | I | 定義用戶 | 目標用戶分群 / 選定焦點對象 / 用戶動機假設 / 排除對象 |
| step-r  | R  | R | 發掘需求 | 功能性需求 / 情感性需求 / 社交性需求 / 核心痛點 |
| step-c2 | C2 | C | 優先排序 | 取捨標準 / 最優先項目 / 暫緩項目 / 排序理由 |
| step-l  | L  | L | 提出方案 | 方案一 / 方案二 / 方案三（可選）/ 各方案特性 |
| step-e  | E  | E | 評估取捨 | 方案優點 / 方案缺點 / 風險與依賴 / 成功指標 |
| step-s  | S  | S | 總結推薦 | 推薦方案 / 選擇理由 / 北極星指標 / 追蹤指標 (含 4-dim tracking-block) |
| step-nsm | NSM | — | NSM 工作坊 | 情境 / 指標 / 拆解 (4 dim) / 總結 |

Step-coverage prompt template (substitute `<STEP_KEY>` etc.):

```
You are agent `step-<STEP_KEY>` in the PM Drill audit cycle. The Test Director
dispatched you to fully exercise the **<LETTER> — <LABEL>** step (or the
NSM workshop, if STEP_KEY is "NSM") across every user scenario and every one
of 8 viewport projects.

## Your scope (single step)
Field set: <FIELDS>.
Cover both *drill* mode AND *simulation* mode flows that pass through this
step, in BOTH guest mode AND auth mode. For step R also cover Phase 2 chat
(interview practice). For step S also cover Phase 4 final report (radar +
4-dim NSM tracking-block render). For STEP_KEY=NSM cover all 4 NSM steps +
the gate between step 2 and step 3 + hints API end-to-end.

## User scenarios you must exercise on this step
Pull every row from § "User scenarios universe" that touches your step and
exercise it. Required minimum (do not skip):

- Identity (A): guest reaches this step from `/`; auth user resumes a
  session that was on this step; logout while on this step returns to `/`
  with no half-saved state visible.
- **Step-c1 also owns**: register (A2 — `POST /api/auth/register`, no email
  confirmation); login (A3); guest→auth migration (A5 + A5-conflict +
  legacy `practice_sessions` bucket) — confirm a guest with drafts at C1
  successfully migrates and the 23505-conflict path deletes the orphan +
  increments `conflicts`. Also `/login.html` 302 redirect (B8).
- Onboarding & navigation (B): first-time user (B1, B2) including the
  multi-step coachmark tour skip path; `?onboarding=1` replay (B3) and
  `?onboarding=0` suppression (B4); navbar logo escape (B5); navbar tabs
  + offcanvas open/close (B6, B7).
- Picker (C): mode picker drill ↔ simulation persists (C1); type tabs
  產品設計/改進/策略 with counts (C2); 換一批 + aria-live (C3); difficulty
  badge mapping (C4); resume banner with multiple cards + dismiss + 繼續 →
  (C6); boot `confirm('繼續上次的練習？')` happy + cancel (C7).
- Phase 1 fields (D): 提示 + 查看範例 + caching (D4, D5); rich-text
  toolbar desktop + mobile sticky (D2); IME 組字 (D3); autosave indicator
  saving → saved (D6); mid-step refresh restores TEXT (D7 — caret not
  expected); hint card 查看 ↔ 收起 toggle (D9); `AI 審核中...` + `重試`
  on API failure (D10).
- **Step-c1 also** exercises Phase 1.5 gate (E1, E2) in BOTH drill and
  simulation; verify simulation `繼續` override on fail (E3).
- **Step-r also** exercises Phase 2 chat (F1-F4): bubble parsing
  【被訪談者】+【教練點評】(F1, F5), conclusion-expanded sticky action row
  (F3), conclusion-check + advance (F4).
- **Step-s also** exercises Phase 3 (G1, G2) AND Phase 4 final report
  (H1-H6): both sub-tabs `S-1 摘要` / `S-2 追蹤指標` (H4), 匯出 PNG happy
  path + esm.sh failure tolerance (H5), simulation `看完整總結報告` (H6).
- **Step-c1 / step-i / step-r / step-c2 / step-l / step-e / step-s** in
  simulation mode also exercise score nav ◀ ▶ cache (G3) when applicable.
- **STEP_KEY=NSM** exercises J1-J8: sub-tab nav with disabled step 3 (J1),
  full path 1→2→gate→3→4 (J2), 重新定義 NSM reset (J3), hints plural API
  (J4), context API (J5), evaluate radar (J6), step-4 mobile/desktop
  parity (J7), back / home buttons (J8).
- History & offcanvas (K): open offcanvas (K1), delete with confirm (K2),
  empty state by deleting all (K3), history view chart + list + delete
  + ≥2-session threshold (K4, K5).
- review-examples (L1): standalone page search + step filter, no JS
  errors.
- Cross-cutting (M): zero console errors (M2), mobile keyboard sticky
  preserved (M3), safe-area on iPhone projects (M4), tap targets ≥44px
  (M5), focus rings + tab order (M6), aria-live announcements fire (M7),
  malformed JSON returns the envelope, not stack trace (M8).
- 回首頁 / navbar logo from your step → question picker.

## Cross-viewport coverage
Run Playwright against your step at every project listed in
`tests/playwright/playwright.config.js`:
Mobile-360 / iPhone-SE / iPhone-14 / iPhone-15-Pro / iPad / Desktop-1280 /
Desktop-1440 / Desktop-2560.

Concrete commands you can run:
```
PMDRILL_BASE_URL=http://localhost:4000 npx playwright test \
  --config=tests/playwright/playwright.config.js \
  journeys/audit/audit-master.spec.js -g "<STEP-related test name pattern>" \
  --workers=4 --reporter=line
```
Plus: write your own probe scripts under
`audit/cycles/<DATE>/probes/step-<STEP_KEY>-<viewport>.js` to capture
screenshots and console logs while clicking through real flows. Use
`@playwright/test`'s `chromium.launch()` API (look at existing
`probe-*.js` patterns committed in earlier sessions — already in `.gitignore`
under `audit/post-fix-*`).

## Reporting
1. Write your findings log to `audit/cycles/<DATE>/logs/step-<STEP_KEY>.md`
   in this format:

   ```
   # step-<STEP_KEY> coverage report
   **Viewports tested:** <list>
   **Scenarios covered:** <checklist>
   **Issues found:** <count by severity>

   ## Issues
   ### ISSUE-<STEP_KEY>-<NN> [P0|P1|P2] <title>
   - **Where:** <route + viewport>
   - **Repro:** <numbered steps>
   - **Expected:** <one line>
   - **Actual:** <one line + screenshot path>
   - **Console:** <any errors>
   - **Hypothesised root cause:** <1-2 sentences>
   ```

2. Save screenshots that prove each issue under
   `audit/cycles/<DATE>/screenshots/step-<STEP_KEY>/<issue-id>-<viewport>.png`.

3. Severity bar (be picky — director will downgrade later if needed):
   - P0: blocks the step (cannot complete) OR breaks layout (overflow,
     overlap, content cut off, button covered) on any viewport.
   - P1: visible defect or accessibility failure (tap < 44px, contrast fail,
     missing aria, jargon without expansion, console error).
   - P2: polish (spacing, copy nit, tap target ≥44 but cramped, etc.).

4. Hand the log path back to the director when done.

You are NOT to write production code. You file issues only. The director
decides who fixes what. Use `Read` / `Bash` / `Glob` / `Grep` / `Write` to
file your log; use `Bash` for Playwright. Do not edit `public/`, `routes/`,
or any other source path.
```

### 1b. UI/UX auditors (2)

These two raise the bar on aesthetic / RWD quality. Use `subagent_type:
"general-purpose"`. Identical scope, different lens.

**Auditor A — 美學總監 (Aesthetics Director)** prompt:

```
You are the 美學總監 in the PM Drill audit cycle. The strictest UI/UX bar in
the room is yours. The Test Director will not sign off if you find unresolved
P0/P1 polish issues.

## Your lens
- Visual hierarchy (h1 > h2 > body, label vs value, primary vs secondary
  buttons, badge vs tag).
- Typography: font family consistency, size ramp, line-height, weight,
  letter-spacing, mixed Latin/CJK alignment.
- Spacing: gutters, paddings, gaps. 8/16/24/32 grid? Off by 1px counts.
- Alignment: edges of stacked elements should agree to the pixel; column
  baselines, label-to-input gutters.
- Color: contrast (axe-core or your manual sampling against WCAG AA), token
  consistency (no hard-coded hex if a `--c-*` token exists), state colors
  (hover / focus / active / disabled).
- Motion: focus rings, transitions on state change, no janky reflow.
- Empty / loading / error states for every list and form field.

## Coverage
- Every row in § "User scenarios universe" (A through M).
- Routes: `/`, every CIRCLES step page (1-7) in BOTH drill and simulation
  mode, Phase 1.5 gate, Phase 2 chat (incl. conclusion-expanded), Phase 3
  score, Phase 4 final report, NSM steps 1-4 + NSM gate, login, register,
  review-examples, history, offcanvas, onboarding welcome card, resume
  banner.
- Modes: guest AND auth (cover migration UI surface as well).
- Viewports: 8 projects (same list as step agents).

## Reporting
File issues to `audit/cycles/<DATE>/logs/uiux-aesthetics.md` using the same
ISSUE-*  format as the step agents (`ISSUE-AES-NN`). Include screenshots.

You are read-only — no source edits. Director decides fixes.
```

**Auditor B — RWD 痛點獵人 (Pain-Point Hunter)** prompt:

```
You are the RWD 痛點獵人 in the PM Drill audit cycle. Your job is to break
the layout — overflow, hidden content, sticky misbehaviour, tap reach,
keyboard pop, viewport edge cases.

## Your lens
- Horizontal scroll on any route × any viewport — automatic P0.
- Content / viewport ratio: <0.85 on desktop is suspect (call it out).
- Sticky elements: navbar, progress bar, sticky bottom action rows. Verify
  they stay in place when chat / textarea content overflows. Test with the
  mobile keyboard simulated (focus a textarea, see if anything jumps).
- Tap targets: every button / link must be ≥44x44 logical px on touch
  viewports.
- Two-column / multi-col grids: do they collapse correctly at the breakpoint?
  Any orphan content cut off mid-fold?
- Focus management: tab order, focus rings visible, no focus traps.
- Pinch-zoom / orientation rotation if you can simulate.
- Edge cases: 360 narrow Android, iPhone-SE 375 with safe-area-insets, iPad
  768, ultra-wide 2560.

## Coverage
Same routes + 8 viewports as the aesthetics auditor (full universe A-M).
Pay special attention to: rich-text mobile sticky toolbar (`.rt-toolbar-mobile`)
behaviour when the keyboard pops, sticky **確認，開始練習** submit on home,
sticky navbar across long Phase 2 chats, offcanvas drawer width / scroll on
Mobile-360, history chart overflow, radar chart sizing on iPhone-SE, NSM
step-4 subtab row on Mobile-360.

## Reporting
File to `audit/cycles/<DATE>/logs/uiux-rwd.md` (issue prefix `ISSUE-RWD-NN`).
Include screenshots showing the bug and the screen edge / scroll bar.

Read-only. Director decides fixes.
```

### 1c. After dispatching: hold open until all 10 return

The director (you, main thread) waits for the 10 Agent tool calls to return,
then proceeds to Phase 2. Do not start fixing while agents are still running —
let the consolidation be complete-info.

---

## Phase 2 — Director consolidates the issue master

1. Read all 10 logs:
   ```
   audit/cycles/<DATE>/logs/step-c1.md
   audit/cycles/<DATE>/logs/step-i.md
   ...
   audit/cycles/<DATE>/logs/uiux-aesthetics.md
   audit/cycles/<DATE>/logs/uiux-rwd.md
   ```

2. Build `audit/cycles/<DATE>/issues-master.md`:
   ```
   # Audit Cycle — <DATE> — Master Issue Board

   ## Summary
   - Total raw findings: <N>
   - Deduped: <M>  (P0:<a> / P1:<b> / P2:<c>)
   - Test director: <you>
   - Status: OPEN

   ## Issues (sorted P0 → P2)
   ### MASTER-001 [P0] <title>
   - Source: <agent ID + issue ID>
   - Affected viewports: <list>
   - Owner (post-triage): <fix-agent ID, filled in Phase 3>
   - Status: open / in-fix / re-verifying / closed
   - Re-verifier: <which test agent should sign off>
   - Notes: <consolidation notes — duplicates of the same root cause merged
     here>
   ```

3. Severity downgrade rules: if a P0 from one agent turns out to be cosmetic
   on closer reading, the director may downgrade to P1 with a one-line
   reason. **Never downgrade if there is real layout overflow, content cut
   off, button covered, console error, or login broken.**

4. Group by root cause where possible. One CSS rule fix often closes 5
   issues across viewports; track them as one MASTER-NNN.

---

## Phase 3 — Brainstorm + mockup gate (mandatory for any UI/UX change)

For every issue whose fix changes UI/UX (visual layout, copy, IA, hierarchy,
new component, behaviour change), invoke `superpowers:brainstorming`. Inside
brainstorming, **must** offer the visual companion (own message), then push
HTML mockups to the screen_dir, then wait for the user to pick A/B/C in the
browser or in the terminal. Only then proceed to implementation.

For pure functional bugs (handler missing, route 404, race condition) skip
brainstorming and go straight to writing-plans.

The director announces this gate explicitly:

> "I have <K> UI/UX issues that need design decisions. Starting brainstorming
> + visual companion now. The functional bugs (<list>) I'll plan in parallel
> via writing-plans without mockups."

---

## Phase 4 — Writing plans + fix waves

For each cluster of issues with a chosen design (or for pure-functional
bugs), write a plan via `superpowers:writing-plans` to
`docs/superpowers/plans/<DATE>-<topic>.md`. Each task in the plan must:

1. Add a failing test (TDD red).
2. Run it, confirm it fails for the right reason.
3. Implement the minimal fix.
4. Run, confirm green.
5. Commit.

For root-causing each bug, the fix agent uses
`superpowers:systematic-debugging` (Phase 1: gather evidence; Phase 2:
pattern-match; Phase 3: hypothesis; Phase 4: implement) — never quick-fix
without root cause.

Fix dispatch: prefer `superpowers:subagent-driven-development` so each fix
runs in a fresh subagent without polluting the director's context. Inline
`superpowers:executing-plans` is acceptable when fixes are simple +
sequential.

Per fix, use `superpowers:verification-before-completion` — every claim of
"fixed" needs trace, screenshot, or console-clean evidence saved under
`audit/cycles/<DATE>/fixes/<MASTER-ID>/`.

---

## Phase 5 — Re-verification by the original agent

Per requirement #6: every fix is handed back to the **original test agent**
that found the issue (not just any tester). Re-dispatch that single agent
with a focused prompt:

```
You are agent <ORIGINAL_AGENT_ID>. The Test Director closed your issue
<ISSUE-ID> with the fix at commit <SHA>. Re-run the original repro and
confirm the issue is closed across all 8 viewport projects. Update
audit/cycles/<DATE>/logs/<your-log>.md with status and screenshots, then
report back to the director.
```

If the agent says "closed", the director marks the issue closed in
`issues-master.md`. If the agent says "still broken or new sub-issue
discovered", a new MASTER-NNN is filed and the loop restarts.

---

## Phase 6 — Sign-off gate

The director signs off only when ALL of these hold:

- [ ] 0 P0 / 0 P1 issues open in `issues-master.md`.
- [ ] All step coverage agents reported zero open findings on their step.
- [ ] Both UI/UX auditors reported zero open findings.
- [ ] `audit-master` Playwright suite green at every viewport project.
- [ ] `rwd-visual-gate` Playwright suite green; PNGs regenerated and
      visually reviewed by the user (offer to push selected PNGs through the
      visual companion if the user wants a final eyeball).
- [ ] Jest green.
- [ ] No console errors on any audited route.
- [ ] `audit/cycles/<DATE>/sign-off.md` written, summarising:
      - cycle date / director signature
      - count of issues found / fixed / closed
      - commits introduced (`git log --oneline <baseline>..HEAD`)
      - test counts (`<N> passed / 0 failed / <M> skipped`)
      - any P2 deferred (with explicit user "OK" required to defer)

---

## Phase 7 — Finishing

Invoke `superpowers:finishing-a-development-branch`. Per the project's
`pushing-to-main` memory, the default option is "push directly to main"
(skip PR ceremony). Tag the commit `audit/cycle-<DATE>-passed`.

Update `docs/superpowers/test-agents/ROLLOUT-STATE.md` with the cycle
summary so the next session has cold-resume context.

---

## Director discipline (the boss is watching themselves)

- You are picky. If an agent's report is shallow ("looks fine on iPhone-SE")
  send them back with: "give me the screenshot, the console JSON, and the
  exact steps you ran. Vague pass not accepted."
- You merge duplicates ruthlessly — one root-cause MASTER-NNN, not 8
  per-viewport copies.
- You stop the audit if dev server falls over or env breaks. Repair and
  re-dispatch. Do not let agents file false positives caused by env drift.
- If an agent times out or returns "tool_uses: 0" with short duration, treat
  it as a failed run and re-dispatch with a tighter prompt.
- Every UI/UX change needs the user's eye on a mockup BEFORE code is written.
  Never assume.

---

## Quick-start command (for the director, after reading this skill)

```
1. mkdir -p audit/cycles/$(date -u +%Y-%m-%d)/{logs,screenshots,issues,probes,fixes}
2. Verify env (HTTP 200 + clean git + .env vars).
3. Send ONE message with 10 Agent tool calls (8 step + 2 UI/UX). All
   subagent_type=general-purpose. Each prompt copy-paste from the templates
   above with <STEP> / <DATE> / lens substituted.
4. Wait for all 10 returns.
5. Read 10 logs, write issues-master.md.
6. For UI/UX issues: invoke superpowers:brainstorming (with visual companion).
   For functional issues: invoke superpowers:writing-plans.
7. Dispatch fix agents (subagent-driven-development) per cluster.
8. After each fix: dispatch the ORIGINAL test agent to re-verify.
9. Loop until 0 P0 / 0 P1.
10. Sign off → finishing-a-development-branch → push main + tag.
```

That's the full cycle. Run it. The user expects you to lead.
