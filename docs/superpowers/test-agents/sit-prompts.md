# SIT (System Integration Test) Agent Prompts — 8 agents

Dispatched in parallel after Phase 7 integration. Each agent runs against the integration branch worktree.

**Common preamble** (paste at top of every SIT agent's prompt):

```
You are running SIT-N system integration test on the PM Drill mega rollout integration branch.

## Working directory
`/Users/albertpeng/Desktop/claude_project/pm-drill-phase-X-integration` (branch `phase-X-integration`).

Start the dev server in background: `node server.js` (port 4000). Stop it cleanly when done.

## Source-of-truth
- Plan: `docs/superpowers/plans/2026-04-28-pm-drill-mega-rollout.md` (your specific SIT-N section).
- Specs: `docs/superpowers/specs/2026-04-28-*.md` (4 docs).

## Your job
Run every test scenario in your SIT-N task list. For each: capture pass/fail, evidence, screenshots if helpful.

## Pass criteria
Per your SIT-N section. ANY scenario fail = AGENT FAIL.

## Report format
- Status: PASS | FAIL
- Per-scenario result table (✅/❌)
- For each fail: file:line + reproduction steps + screenshot path if captured
- Console errors observed
- Total scenarios run vs passed
```

## SIT-1 — Bullet rendering & content quality (Spec 1)

**Tasks:**
1. `node scripts/audit-circles-examples.js` → < 1% violation rate
2. Visually verify all 100 questions × 27 fields at desktop 1280 + mobile 375 in `/review-examples.html`
3. Verify HTML structure `<ul class="rt-bullet-list"><li>...<ul class="rt-bullet-sub">...</ul></li></ul>`
4. Bold renders `<strong>` with `color: var(--c-primary)` resolved blue
5. No orphan `**` markers
6. circles_002 anchor 27 fields match spec § 3.2 skeleton
7-10. Every「查看範例」toggle on Phase 1 / Phase 3 教練示範 / NSM Step 2 / NSM Step 3 — open & collapse correctly (~600 toggles)
11. Edge cases: empty / single bullet / no children / deeply nested
12. `window.renderBulletText` exposed
13. `\n\n` collapsed; tab characters rejected
14. Long-line wrap doesn't break layout
15. review-examples.html step filter dropdown options work
16. `node scripts/retry-flagged-circles-examples.js` converges in ≤2 iterations

## SIT-2 — Progress save behavior (Spec 2)

17 scenarios — see plan lines 1034-1053. Key checks:
1. Every textarea triggers PATCH after 1.5s debounce (Phase 1 C1/I/R/C2/L/E/S, NSM 4 dim sub-textareas, sol-name-input)
2. Reload restores all typed text
3. Offcanvas badge "進行中" yellow when active+drafts
4. Homepage banner relative time: <5min "剛剛", <60min "N分鐘前", else date
5. 繼續 button → loads correct step
6. X dismiss → localStorage `dismiss-resume-{id}` set
7. Network down → "儲存失敗，重試" with red dot
8. Click retry → recovers
9. State transitions: idle → saving → saved → "saved · N分鐘前"
10. Rapid typing across textareas — pending flag works
11. Backend POST /draft returns valid session
12. PATCH /progress is merge-not-overwrite
13. Guest mode X-Guest-ID works for /draft and /progress
14. Cron cleanup: empty session >24hr deleted; non-empty preserved
15. Edge: close tab before debounce → no orphan empty session
16. sol-name-input triggers save
17. NSM 4 dim sub-textareas trigger save with correct nested key

## SIT-3 — Desktop responsive (Spec 3)

18 scenarios — see plan lines 1059-1087. Key:
1. Full-page screenshots every screen × every state at 1280×800 + 1440×900 (~30 screenshots)
2. Pixel diff vs mockup files within ±10px
3. Per-page max-width: 1180/920/720/420 verified
4. `var(--c-primary)` resolves to `#1A56DB` on 30 elements
5. Cross-breakpoint resize 1024↔1023 — smooth, no flash, AppState preserved
6. Instrument Serif on Phase 3 score-number 84px desktop, NSM-total 54px
7. All `<i class="ph ph-*">` render (no missing-glyph ∎)
8. Navbar 2 tabs visible ≥1024, hidden <1024
9. Favicon link rel=icon href=/favicon.svg
10-18. Interactive coverage on every page (CIRCLES home / Phase 1 / Phase 2 / Phase 3 / NSM 1-4 / review-examples)

## SIT-4 — Onboarding tour (Spec 3)

10 scenarios — plan lines 1094-1106:
1. Clear localStorage → welcome card shows
2. 開始引導 → step 1 coachmark
3. 下一步 ×3 → reach step 4
4. 開始練習 on step 4 → ends, navigates to Phase 1
5. Reload → no welcome (flag set)
6. 略過引導 mid-tour → ends, flag set
7. `?onboarding=1` → tour starts despite flag
8. Resize 1280→375 mid-tour → re-positions to mobile sheet
9. Mobile: ring shadow only, bottom-sheet tooltip
10. Returning user with sessions → no welcome

## SIT-5 — Rich text toolbar (Spec 4)

14 scenarios — plan lines 1112-1127:
1-2. Desktop B click + Ctrl+B
3. 列點 button add/remove `- `
4. Tab/Shift+Tab indent
5. Enter on bullet → next line `- ` (or 4-space indent)
6. Enter on empty bullet → exits bullet mode
7. Mobile focus → toolbar at bottom
8. Mobile blur → 200ms hide
9. visualViewport keyboard show/hide reposition
10. IME composition active → shortcuts don't fire
11. Multi-textarea: focused one's toolbar relevant
12. Phase 1 / NSM 2-3 / E sub-textareas / S 4-dim all have toolbars
13. B active state in `**...**` region
14. Rapid bold→bullet→indent doesn't break selection

## SIT-6 — Cross-spec integration

8 scenarios — plan lines 1134-1144:
1. Full simulation flow: select → P1 (bullets+bold) → submit → P2 chat → P3 score
2. Simulation 7 steps → final report
3. Spec 1+2+3+4 coexist
4. Auto-save preserves `\n` and indent
5. Reload → bullet text intact in textarea
6. Example expanded inside Phase 1 form: bullet HTML renders, no toolbar conflict
7. Save indicator updates as toolbar inserts bold (input event dispatched)
8. Onboarding doesn't trigger if active session exists

## SIT-7 — A11y, browser compat, console clean

12 checks — plan lines 1150-1163:
1. axe-core 0 critical violations every screen
2. Keyboard nav reaches all interactive elements
3. aria-label on icon-only buttons (hamburger, signout, X close)
4. Chrome / Firefox / Safari desktop + iOS Safari + Chrome Android
5. Console 0 errors during all flows
6. No 404/500 on initial load
7. Lighthouse mobile ≥85 (perf+a11y+bp)
8. Phosphor Icons load (no FOUC)
9. DM Sans + Instrument Serif preload (no flash)
10. No `!important` overuse beyond baseline
11. Resume banner localStorage dismiss persists per session id
12. Progress save handles X-Guest-ID

## SIT-8 — Backend API contract

13 scenarios — plan lines 1170-1184:
1. POST /api/circles-sessions/draft: auth happy / missing auth / missing fields / invalid question_id
2. POST /api/guest-circles-sessions/draft: same matrix with X-Guest-ID
3. GET /api/circles-sessions: auth, pagination, status filter
4. GET /api/circles-sessions/:id: auth, owner check, not_found
5. PATCH /api/circles-sessions/:id/progress: partial merge, wrong owner, large payload
6. POST /api/circles-sessions/:id/evaluate-step: drill / sim / S → completes
7. POST /api/circles-sessions/:id/final-report: incomplete / complete / cached
8. DELETE /api/circles-sessions/:id: auth, cascade
9. NSM equivalents `/api/nsm-sessions/*`
10. Public POST /api/circles-public/{hint,example}, GET /all-examples — input validation, 404 not_curated, rate limit
11. Schema validation: malformed JSON → 400
12. CSRF cookie/auth header pattern
13. Race: 5 parallel PATCH /progress to same session → last-write-wins per spec 2 § 9
