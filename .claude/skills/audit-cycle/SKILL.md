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
3. All user scenarios must be covered: login/logout, view question, answer question, view examples, hint, autosave, gate review, score, NSM dimension breakdown, etc. Anything unexercised is a director failure.
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
Cover both *drill* mode and *simulation* mode flows that pass through this
step. For step R also cover Phase 2 chat (interview practice for this step).
For step S also cover the tracking-block (4 NSM dims). For STEP_KEY=NSM cover
all 4 NSM steps end-to-end.

## User scenarios you must exercise on this step
- Login flow that lands on this step (resume an active session that was on
  this step) AND guest flow that reaches this step from `/`.
- Logout while on this step (return to /, no half-saved state visible).
- View the question card on home, expand 看完整題目, click 確認，開始練習.
- Walk to your step (clicking 下一步 from previous steps if needed).
- Inspect every field: label, 提示 button, 查看範例 button, textarea, rich-text
  toolbar (B / list / indent / outdent). Fill each, hit autosave, observe
  save-indicator transitions (saving → saved). Mid-step refresh — should
  resume.
- For step C1 only: click 送出 to enter Phase 1.5 gate review, observe
  pass/warn/error states. For step S only: cover the final submit → final
  report flow.
- Click 回首頁 / navbar logo from your step — must reach the question picker.

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
- Routes: `/`, every CIRCLES step page (1-7) in drill mode, gate review,
  Phase 2 chat, Phase 3 score, NSM steps 1-4, login, register, review-examples.
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
Same routes + 8 viewports as the aesthetics auditor.

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
