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

This is the canonical list of every user-facing scenario in PM Drill. Each step
agent picks the rows that touch their step; the two UI/UX auditors apply their
lens to every row. The director cross-checks at consolidation that every row
has at least one piece of evidence (screenshot, console log, Playwright run).

### A. Identity & session
- A1. Guest first-visit lands on `/` with `x-guest-id` cookie minted; no login wall.
- A2. Register via `POST /api/register` (email + password) — happy path + invalid email + weak password + duplicate email.
- A3. Login via Supabase auth — success, wrong password, unknown email.
- A4. Logout from navbar — clears state, returns to `/` as guest, no half-saved drafts visible.
- A5. Guest → Auth migration: guest with progress signs in → `migrateGuestSessions()` calls `/api/migrate-guest` → all guest CIRCLES + NSM sessions appear under the auth account, no duplicate, no data loss.
- A6. Session-expired (401) mid-typing — UI surfaces a non-destructive prompt, draft not lost.

### B. Onboarding & navigation
- B1. First-time user (localStorage `circles_onboarding_done` unset) sees onboarding welcome card on `/`.
- B2. Coachmark tour walks through CIRCLES home → step list → submit; user can skip / complete.
- B3. `?onboarding=1` query forces replay even after the flag is set (dev hook).
- B4. `?onboarding=0` query suppresses welcome.
- B5. Navbar logo (`#navbar-home-btn`) from any phase returns to question picker, wiping practice state.
- B6. Navbar tabs (CIRCLES / 北極星指標) switch view with active state synced.
- B7. Hamburger opens offcanvas (`#offcanvas`); overlay click + close button + Esc close it.

### C. Question picker & resume
- C1. CIRCLES home renders question cards: tags row, company / product / difficulty, line-clamped brief, **看完整題目** expand-in-place, **確認，開始練習** sticky submit at bottom.
- C2. Pick a question → land on Phase 1 step C1 with empty fields.
- C3. Resume banner: returning user with an unfinished session sees a banner on `/` with **繼續上次練習** CTA → restores phase + step + drafts.
- C4. **沒有更多題目** state when all questions exhausted (or filtered out).

### D. CIRCLES Phase 1 (drill mode, per step C1/I/R/C2/L/E/S)
- D1. Each field renders: label, 提示 button, 查看範例 button, textarea / rich-text editor.
- D2. Rich-text toolbar: Bold, bullet list, indent, outdent — both desktop top toolbar and mobile sticky bottom toolbar (`.rt-toolbar-mobile`).
- D3. Rich-text **IME 組字** (Chinese composition): typing zhuyin / pinyin does not commit half-formed text; toolbar buttons disabled mid-composition; commits on Enter.
- D4. Hint button → calls `/hint` (auth) or `/api/circles-public/hint` (guest), renders hint card; same field again returns cached.
- D5. 查看範例 button → calls `/example` or `/api/circles-public/example`, renders example card.
- D6. Autosave: every keystroke debounced → `PATCH /:id/progress`; save indicator transitions saving → saved.
- D7. Mid-step refresh restores all field text + caret position acceptably.
- D8. **下一步** advances; **上一步** returns; progress bar reflects current step.

### E. CIRCLES Phase 1.5 — gate review
- E1. From step C1 click **送出** → `POST /:id/gate` → renders pass / warn / error card with rationale.
- E2. **修改** returns to Phase 1 with drafts intact; **繼續** advances to Phase 2.

### F. CIRCLES Phase 2 — chat (interview practice on R)
- F1. Render conversation bubbles (user / 被訪談者 / 教練點評).
- F2. Send message → `POST /:id/message` → both interviewee + coaching bubbles append.
- F3. Phase 2 結論 expanded view (route `09-phase2-conclusion-expanded`) renders correctly.
- F4. **繼續對話** stays in Phase 2; **進入下一階段** runs `conclusion-check` then advances.

### G. CIRCLES Phase 3 — per-step score
- G1. `POST /:id/evaluate-step` returns score breakdown; radar chart renders correctly.
- G2. Re-evaluate path works (no stale render).

### H. CIRCLES Phase 4 — final report
- H1. From step S **送出最終報告** → `POST /:id/final-report` → final report renders.
- H2. Radar (per CIRCLES letter) + NSM dimension scores correct.
- H3. **回首頁** returns to `/`; session marked completed in offcanvas + history.

### I. CIRCLES simulation mode
- I1. Simulation starts from a different entry → walks through the same step set with mode-specific copy.
- I2. Simulation final state lands somewhere sane (per current spec) — no broken transitions.

### J. NSM workshop (北極星指標)
- J1. NSM home → step 1 (情境) → step 2 (指標) → **gate** (`POST /:id/gate`) → step 3 (拆解, 4 dim) → step 4 (總結).
- J2. NSM hints API `POST /:id/hints` per step.
- J3. NSM context API (`POST /api/nsm-context`) for context generation.
- J4. NSM evaluate API `POST /:id/evaluate` produces the dimension breakdown radar.
- J5. Step 4 mobile vs desktop layout parity (subtabs render on mobile).

### K. History & offcanvas
- K1. Offcanvas list: shows recent sessions (CIRCLES + NSM mixed), correct timestamps, click loads the session into the right view.
- K2. Offcanvas delete: confirm dialog (`確定刪除這次練習？`) → `DELETE /:id` → row vanishes, no console error.
- K3. Offcanvas empty state: `尚無練習記錄`.
- K4. History view: chart over time + list, delete with inline confirm (`確定刪除嗎？`), empty state `還沒有練習記錄`.

### L. review-examples (standalone)
- L1. `/review-examples.html` loads, lists all CIRCLES letter examples, search / filter works, no JS errors.

### M. Cross-cutting
- M1. Network / error: 401 → re-auth prompt; 500 from LLM → user-facing retry; offline → queued or surfaced.
- M2. Console: zero errors / zero unhandled rejections on every audited route.
- M3. Mobile keyboard (interactive-widget=resizes-visual): focusing textarea does not push sticky elements off-screen.
- M4. iOS safe-area-insets respected on iPhone-SE / iPhone-14 / iPhone-15-Pro projects.
- M5. Tap targets ≥44×44 logical px on every touch viewport.
- M6. Focus rings visible on keyboard nav; tab order sane; no focus traps.

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

- Identity: guest reaches this step from `/`; auth user resumes a session
  that was on this step; logout while on this step returns to `/` with no
  half-saved state visible.
- Step-c1 also owns: register flow (A2), login flow (A3), guest→auth
  migration (A5) — confirm a guest with drafts at C1 successfully migrates
  on sign-in.
- Onboarding & resume: first-time user (B1, B2) and resume banner (C3) when
  the unfinished session was on your step.
- Question card on `/`: tags row, line-clamped brief, **看完整題目** expand,
  **確認，開始練習** sticky submit (C1, C2). Use `?onboarding=0` to suppress
  welcome when not testing onboarding.
- Walk to your step (click 下一步 from earlier steps as needed).
- Every field on your step: label, **提示** button (D4), **查看範例** button
  (D5), textarea / rich-text editor (D2), rich-text **IME 組字** at least
  once (D3). Fill each, watch autosave indicator (D6), then **mid-step
  refresh** to confirm restore (D7).
- Step-c1 also exercises Phase 1.5 gate (E1, E2): click **送出**, observe
  pass / warn / error, take both **修改** and **繼續** branches.
- Step-r also exercises Phase 2 chat (F1-F4) including conclusion-expanded.
- Step-s also exercises Phase 3 step score (G1) AND Phase 4 final report
  (H1-H3) — radar correctness, NSM dim scores, **回首頁** post-submit.
- STEP_KEY=NSM exercises J1-J5 (NSM home → 1 → 2 → gate → 3 → 4, hints,
  context, evaluate, mobile/desktop step-4 parity).
- Offcanvas (K1-K3) and History (K4) reachable from your step: open
  offcanvas, click an old session, delete one with confirm, observe empty
  state by deleting all.
- Network / error (M1): with devtools, simulate 500 on `/hint` and
  `/example`, confirm UI surfaces a non-destructive retry. Confirm zero
  console errors (M2).
- 回首頁 / navbar logo from your step → question picker.

## Cross-viewport coverage

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
