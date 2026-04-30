# 7-Agent Audit & Fix Cycle — Design

> Date: 2026-04-30
> Status: Approved (brainstorming gate)
> Owner: albertpeng678
> Mandate: User explicitly required all 14 superpower skills be exercised in process.

## 1 · Goal

Run a deep usability audit of PM-Drill by dispatching **5 newbie-persona user agents** through the entire product flow on `http://localhost:4000`, while **2 UI/UX recorder agents** capture, dedupe, and triage every issue. **All P0 + P1 issues must be fixed and re-verified before the build is considered ship-ready.**

## 2 · Editorial Roster (7 agents total)

### Wave 1 — 5 newbie user agents (parallel)

| # | Persona | Device / Browser | Playwright project | Personality lens |
|---|---|---|---|---|
| **U1** | 大三學生 · 老師推薦 · 邊看 YT 分心 | MacBook + Chrome | `Desktop` (1280×800) | Distractible — flips tabs, returns, looks for "where was I" |
| **U2** | 應屆畢業生 · 通勤練 · 單手握 | iPhone Safari | `iPhone-15-Pro` (430×932) | Thumb-only, portrait, gesture-first |
| **U3** | 轉職者 · 自己 Google · 認真讀字 | Windows + Edge | `Desktop` (UA spoof) | Reads every word; will spot copy contradictions |
| **U4** | 文組求職者 · 不熟英文術語 | iPad Safari | `iPad` (768×1024) | Stuck on Goal/Constraint/Hypothesis/CIRCLES jargon |
| **U5** | 休學打工青年 · 耐心極低 | 老 Android Chrome | `iPhone-SE` (375×667 low-end) | Skips after 3 sentences, mashes buttons |

### Wave 2 — 2 UI/UX recorder agents (after Wave 1 finishes)

- **R1 — Severity Classifier**: ingest U1–U5 issue logs → dedupe → assign **P0 / P1 / P2** → output `audit/issues-master.md`.
- **R2 — Acceptance & Test Writer**: for every P0/P1, write acceptance criteria + skeleton Playwright test → `audit/acceptance.md` + `tests/playwright/journeys/audit-*.spec.js`.

### Severity definitions

- **P0** — Blocks core flow / data loss / a11y violation / desktop layout broken / cannot complete CIRCLES or NSM
- **P1** — Major UX friction (confusing copy, broken sticky/modal, tap targets <44px on mobile, contrast, broken resume)
- **P2** — Polish (visual nit, minor wording, non-blocking)

## 3 · User Journey (each of U1–U5 must complete identically)

1. Visit `/` as guest → see question list
2. Pick a question → CIRCLES full 7 steps (C → I → R → C → L → E → S)
3. AI evaluation → Summary
4. Register account → guest→user `migrate` upgrade
5. Open new question → NSM Workshop 4 steps
6. CIRCLES Drill mode — pick **2** single-step deep practices
7. Visit `/review-examples.html`
8. Resume a saved draft after page reload
9. Delete one session
10. Logout

Each agent **must**:
- Run via Playwright with `trace: 'on'` and per-step screenshots
- Submit real Chinese answers (no blank submissions)
- Log per step: `{step, friction, copy_issue, visual_issue, a11y_issue, severity_guess}`
- Save to `audit/u<n>-log.md`

## 4 · Pre-Audit Known Issue (Issue #0)

User-observed before audit started:

- **Desktop home (`/`) on wide monitor (≥1440px) shows the CIRCLES list crammed into a narrow center column, leaving huge empty bands of background on left and right. Cards inside `選擇題目` are so narrow that "Meta — Facebook Marketplace" wraps to three lines.**
- **Top nav shows `北極星指標` twice — once as a `.navbar-tab` (left) and once as a `.navbar-actions` button (right).**

Likely root: `.circles-home-desktop { max-width: 1180px }` is too narrow for ≥1440 viewports, AND the `.ch-grid: 230px 1fr 240px` middle column ends up cramped because the rails take fixed widths against an under-budgeted total. Plus the right-side action button is rendering an NSM CTA that duplicates the left-tab label.

Issue #0 is logged into the master list before agents run, so its fix is part of the same cycle.

## 5 · Process — mapping to all 14 superpower skills

| # | Skill | Where it appears in this audit |
|---|---|---|
| 1 | `using-superpowers` | Session start (already invoked) |
| 2 | `brainstorming` | This design doc |
| 3 | `writing-plans` | Next step → produces implementation plan |
| 4 | `executing-plans` | Run that plan with checkpoints |
| 5 | `using-git-worktrees` | Each fix batch in isolated worktree off `main` |
| 6 | `dispatching-parallel-agents` | Wave 1: U1–U5 launched simultaneously |
| 7 | `subagent-driven-development` | Wave 2 + each P0/P1 fix dispatched to its own subagent |
| 8 | `systematic-debugging` | Every issue: reproduce → hypothesis → root cause → minimal fix |
| 9 | `test-driven-development` | Failing Playwright test written **before** the fix lands |
| 10 | `verification-before-completion` | No fix is "done" without a passing trace artifact |
| 11 | `requesting-code-review` | After fixes batched, request review |
| 12 | `receiving-code-review` | Apply / push back on review feedback rigorously |
| 13 | `writing-skills` | Any reusable QA pattern surfaced → distilled into a skill |
| 14 | `finishing-a-development-branch` | Final gate: merge / PR / cleanup decision |

## 6 · File / Artifact Layout

```
audit/
  README.md                    # this audit's index
  issues-master.md             # R1 output: deduped + triaged
  acceptance.md                # R2 output: AC + test plan per P0/P1
  u1-log.md … u5-log.md        # raw per-agent logs
  traces/                      # Playwright traces zipped per agent
  screenshots/u1/ … u5/        # step-by-step screenshots
tests/playwright/journeys/
  audit-issue-<id>.spec.js     # one spec per P0/P1, written first, must fail
docs/superpowers/specs/
  2026-04-30-7-agent-audit-design.md   # ← this file
docs/superpowers/plans/
  2026-04-30-7-agent-audit-plan.md     # writing-plans output (next step)
```

## 7 · Termination & Ship Criteria

The build is **ship-ready** only when ALL of the following hold:

1. Every P0 + P1 issue (Issue #0 included) has an associated `audit-issue-<id>.spec.js` that previously failed and now passes.
2. `npm test` (Jest) green.
3. `npm run test:e2e` green across all 4 Playwright projects (`Desktop`, `iPad`, `iPhone-15-Pro`, `iPhone-SE`).
4. No new console errors, no regressions in existing journey specs.
5. Code review (self via `code-review` or external) returns no blocking comments.
6. `finishing-a-development-branch` produces an explicit merge / PR decision.
7. **HARD RWD GATE — Visual walkthrough across every viewport** (see § 7.1).

P2 issues may be deferred to a follow-up — but only with the user's explicit OK.

### 7.1 · Hard RWD Gate (mandatory pre-ship)

The Issue #0 desktop disaster (1180px island in a 2000px viewport) shipped because tests were green but **nobody actually looked at the page on a wide monitor**. This gate exists so it cannot happen again.

Before any push to `main` / ship, an agent **must** capture full-page screenshots of **every key route × every breakpoint** and a recorder must visually OK each one.

**Required viewports (8):**

| Bucket | Viewport | Why |
|---|---|---|
| 超寬桌機 | 2560 × 1440 | Issue #0 victim — wide monitor empty bands |
| 標準桌機 | 1440 × 900 | Common laptop |
| 小桌機 / 大平板橫 | 1280 × 800 | Existing Playwright `Desktop` |
| 平板直 | 768 × 1024 | Existing `iPad` |
| 大手機 | 430 × 932 | Existing `iPhone-15-Pro` |
| 標準手機 | 390 × 844 | iPhone 14 / 15 base |
| 小手機 | 375 × 667 | Existing `iPhone-SE`, lowest common iOS |
| 窄安卓 | 360 × 780 | Common low-end Android |

**Required routes (per viewport):**

1. `/` (landing / CIRCLES home with question list)
2. CIRCLES step 1 (Comprehend) mid-flow
3. CIRCLES step 5 (List) — heaviest content
4. CIRCLES Summary
5. NSM Workshop step 1
6. NSM Workshop step 4
7. `/review-examples.html`
8. Auth / login screen

→ 8 viewports × 8 routes = **64 screenshots per pre-ship verification**.

**Pass criteria for each screenshot (recorder R1 checks):**

- No giant empty bands (content uses ≥ 70 % of viewport width on desktop, ≥ 92 % on mobile)
- No horizontal scroll at any width (except intentional carousels)
- No clipped text / cards / buttons
- Tap targets ≥ 44×44 px on touch viewports
- No duplicate nav items (Issue #0 nav-tab + nav-action duplication)
- Sticky / fixed elements don't overlap content
- All 8 routes look intentional, not "shrunk mobile" on desktop

If **any** screenshot fails, the offending issue is logged as P0 and fixed before re-running this gate. **No exceptions, no "it'll be fine".**

The gate is implemented as `tests/playwright/journeys/rwd-visual-gate.spec.js` (defined in plan Phase F) and produces `audit/rwd-grid/<viewport>/<route>.png`. R1 reviews the grid as the final pre-ship checkpoint.

## 8 · Risks & Out-of-Scope

- **OpenAI quota / latency** — CIRCLES `evaluate` step calls real LLM. If quota becomes a blocker, agents may stub responses and flag it; not counted as a P0 against the product.
- **Auth flow needs real Supabase** — agents will sign up with throwaway test emails (`agent-u1+<ts>@pmdrill.test`); cleanup script after audit.
- **Out-of-scope:** new features, redesigns, copy rewrites that don't trace to a P0/P1 issue.

## 9 · Approval

User-approved 2026-04-30 via brainstorming flow (sections § 1–§ 4 confirmed; § 5–§ 8 follow standard process).
