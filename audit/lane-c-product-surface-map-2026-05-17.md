# Lane C — Product Surface Map (2026-05-17)

> Denominator document for the e2e integration audit.
> All entries have file:line citations. Nothing invented.

---

## FE Surfaces (render functions in app.js)

| Surface name | render function | line | When shown | AppState deps | DOM key elements |
|---|---|---|---|---|---|
| Top-level dispatcher | renderView | 314 | every render cycle | view, circlesPhase, circlesSession, circlesSelectedQuestion, nsmStep | — |
| CIRCLES Home | renderCirclesHome | 5371 | view=circles, phase=1, no question selected, no session | circlesMode, circlesDisplayedQuestions, circlesTypeFilter, circlesSearchText, circlesQaOpen, circlesExpandedQid, circlesRecentSessions | .circles-home, .mode-card, .q-list, .q-card |
| CIRCLES Phase 1 Form (drill/sim) | renderCirclesPhase1 | 5012 | view=circles, phase=1, circlesSelectedQuestion set | circlesDrillStep, circlesMode, circlesFrameworkDraft, circlesPhase1SaveState, circlesPhase1EmptyHint, circlesPhase1Solutions, circlesPhase1Evaluate, circlesPhase1S | .phase-1-form, .rt-field, .submit-bar, .progress-bar |
| CIRCLES Phase 1 L-step | renderCirclesPhase1Lstep | 4414 | sub-renderer for phase 1, step=L | circlesDrillStep | .sol-card |
| CIRCLES Phase 1 E-step | renderCirclesPhase1Estep | 4532 | sub-renderer for phase 1, step=E | circlesPhase1Evaluate | .esol-card |
| CIRCLES Phase 1 S-step | renderCirclesPhase1Sstep | 4688 | sub-renderer for phase 1, step=S | circlesPhase1S | .tracking-section |
| CIRCLES Phase 1.5 Gate | renderCirclesGate | 4875 | view=circles, phase=1.5 | circlesGateResult, circlesGateLoading, circlesGateError, circlesDrillStep, gateInflight | .gate-wrap, .gate-item, .gate-summary |
| CIRCLES Phase 2 Chat | renderCirclesPhase2 | 862 | view=circles, phase=2, session+question set | circlesConversation, circlesPhase2Streaming, circlesPhase2StreamingTurn, circlesPhase2StreamError, circlesPhase2ConclusionMode, circlesPhase2ConclusionDraft, circlesPhase2ExampleOpen | .chat-wrap, .bubble, .conclusion-box |
| CIRCLES Phase 2 Locked | renderCirclesPhase2Locked | 1062 | phase=2, step already scored | circlesStepScores | .locked-banner, .bubble |
| CIRCLES Phase 3 Score | renderCirclesPhase3 | 6420 | view=circles, phase=3, session set | circlesScoreResult, circlesPhase3LoadingStep, circlesPhase3LoadingSlow, circlesPhase3Error, circlesPhase3DimExpanded, circlesPhase3CoachDemoOpen | .phase-3-score, .dim-card, .coach-demo |
| CIRCLES Phase 3 Loading | renderPhase3Loading | 6188 | phase=3, score not yet loaded | circlesPhase3LoadingStep, circlesPhase3LoadingSlow | .loading-wrap |
| CIRCLES Phase 3 Error | renderPhase3Error | 6233 | phase=3, circlesPhase3Error set | circlesPhase3Error | .error-wrap |
| CIRCLES Phase 4 Final Report | renderCirclesPhase4 | 645 | view=circles, phase=4, session set | circlesFinalReport, circlesPhase4LoadingStep, circlesPhase4Error | .phase-4-wrap, radar SVG |
| CIRCLES Phase 4 Loading | renderPhase4Loading | 457 | phase=4, report not loaded | circlesPhase4LoadingStep | .loading-wrap |
| CIRCLES Phase 4 Error | renderPhase4Error | 491 | phase=4, circlesPhase4Error set | circlesPhase4Error | .error-wrap |
| CIRCLES Phase 4 Success | renderPhase4Success | 519 | phase=4, report loaded | circlesFinalReport | .phase-4-success, .radar-svg |
| NSM Step 1 (question picker) | renderNSMStep1 | 5947 | view=nsm, nsmStep=1 | nsmDisplayedQuestions, nsmSearchText, nsmTypeFilter, nsmSelectedQuestion | .nsm-step1, .nsm-q-card, .nsm-filter-rail |
| NSM Step 2 (define NSM) | renderNSMStep2 | 1290 | view=nsm, nsmStep=2 | nsmDefinition, nsmSession, nsmSubTab, nsmContext, nsmHintExpanded, nsmExampleExpanded | .nsm-step2, .nsm-field, .nsm-context-card |
| NSM Step 2 Gate | renderNSMGate | 1399 | nsmSubTab=nsm-gate | nsmGateResult, nsmGateLoading, nsmGateError, nsmGateLoadingStep | .nsm-gate-wrap, .nsm-gate-item |
| NSM Step 3 (breakdown) | renderNSMStep3 | 1649 | view=nsm, nsmStep=3 | nsmBreakdown, nsmSession, nsmEvalLoading, nsmDimExampleExpanded | .nsm-step3, .nsm-dim-card |
| NSM Step 4 Report | renderNSMStep4 | 2409 | view=nsm, nsmStep=4 | nsmEvalResult, nsmReportTab, nsmActiveCompareNode, nsmEvalLoading, nsmEvalError | .nsm-step4, .nsm-radar, .nsm-step4-tab |
| NSM Step 4 Overview Tab | renderNSMStep4OverviewTab | 2188 | nsmReportTab=overview | nsmEvalResult | .nsm-step4-overview |
| NSM Step 4 Comparison Tab | renderNSMStep4ComparisonTab | 2259 | nsmReportTab=comparison | nsmEvalResult, nsmActiveCompareNode | .nsm-step4-comparison |
| NSM Step 4 Highlights Tab | renderNSMStep4HighlightsTab | 2348 | nsmReportTab=highlights | nsmEvalResult | .nsm-step4-highlights |
| NSM Step 4 Done Tab | renderNSMStep4DoneTab | 2377 | nsmReportTab=done | nsmEvalResult | .nsm-step4-done |
| Auth (login / register) | renderAuth | 2571 | view=auth | authTab, authLoading, authError, userEmail | .auth-wrap, .auth-tab, .auth-form |
| Navbar | renderNavbar | 2968 | always (part of render shell) | view, userEmail, accessToken, circlesPhase | .navbar |
| Resume toast | renderResumeToast | 3019 | _resumeToastShow=true | _resumeToastShow, _resumeToastMsg, evalToastDismissed | .resume-toast |
| Global banners | renderGlobalBanners | 3058 | always; conditionally shows sub-banners | migrationBanner, circlesStale, circlesPhase1SaveState | .banner--info, .banner--warn |
| Offcanvas history drawer | renderOffcanvas | 7592 | offcanvasOpen=true | offcanvasOpen, historyList, historyLoading, historyError | .offcanvas, .offcanvas-item |
| Onboarding overlay | renderOnboardingOverlay | 8279 | onboardingActive=true | onboardingStep, onboardingActive | .onb-tooltip, .onb-spotlight |
| Onboarding welcome card | renderOnbWelcome | 8268 | onboardingActive=false, onboardingComplete=false | onboardingComplete | .onb-welcome |
| Hint modal shell | renderHintModalShell | 3834 | triggered by hint button click | — (inline render) | .hint-overlay |
| Locked banner | renderLockedBanner | 3474 | step locked (circlesLocked) | circlesLocked | .locked-banner |
| Stale banner | renderStaleBanner | 3488 | circlesStale=true | circlesStale | .banner--warn |
| CIRCLES stub | renderCirclesStub | 351 | view=circles, no phase matched | — | fallback stub |

**NOTE — Auth flow has NO standalone render function for individual states (forgot-password, token-expiry redirect). They are handled as conditional branches inside `renderAuth` (line 2571) and `renderAuthErrorBanner` (line 2680). There is no `renderForgotPassword` surface.**

---

## BE Endpoints

| Method | Path | File:line | Auth | Purpose | Mutates state |
|---|---|---|---|---|---|
| GET | /api/config | server.js — inline (routes/config.js:6) | none | Serve Supabase URL + anon key | no |
| POST | /api/auth/register | routes/auth.js:6 | none | Create confirmed user account | yes (Supabase) |
| POST | /api/migrate-guest | routes/migrate.js:15 | auth + guestId | Migrate all guest data to auth user | yes (circles_sessions, nsm_sessions, guest_sessions) |
| POST | /api/circles-sessions | routes/circles-sessions.js:27 | auth | Create new circles session | yes |
| POST | /api/circles-sessions/draft | routes/circles-sessions.js:46 | auth | Lazy-create session on first keystroke | yes |
| GET | /api/circles-sessions | routes/circles-sessions.js:109 | auth | List sessions (exclude empty by default) | no |
| GET | /api/circles-sessions/:id | routes/circles-sessions.js:149 | auth | Fetch single session detail | no |
| DELETE | /api/circles-sessions/:id | routes/circles-sessions.js:162 | auth | Delete session | yes |
| POST | /api/circles-sessions/:id/gate | routes/circles-sessions.js:177 | auth | Phase 1.5 AI gate review | yes (gate_result) |
| POST | /api/circles-sessions/:id/message | routes/circles-sessions.js:202 | auth | Phase 2 SSE streaming chat | yes (conversation) |
| POST | /api/circles-sessions/:id/evaluate-step | routes/circles-sessions.js:253 | auth | Score one CIRCLES step | yes (step_scores) |
| POST | /api/circles-sessions/:id/conclusion-check | routes/circles-sessions.js:275 | auth | Conclusion quality check | no (advisory) |
| PATCH | /api/circles-sessions/:id/progress | routes/circles-sessions.js:294 | auth | Save phase/step/draft without AI | yes (progress_json, current_phase) |
| POST | /api/circles-sessions/:id/final-report | routes/circles-sessions.js:372 | auth | Generate Phase 4 final report | yes (final_report) |
| POST | /api/circles-sessions/:id/hint | routes/circles-sessions.js:411 | auth | AI hint for a CIRCLES field | no |
| POST | /api/circles-sessions/:id/example | routes/circles-sessions.js:430 | auth | Curated example for a CIRCLES field | no |
| POST | /api/guest-circles-sessions | routes/guest-circles-sessions.js:131 | guestId | Guest: create circles session | yes |
| POST | /api/guest-circles-sessions/draft | routes/guest-circles-sessions.js:65 | guestId | Guest: lazy-create session | yes |
| GET | /api/guest-circles-sessions | routes/guest-circles-sessions.js:27 | guestId | Guest: list sessions | no |
| GET | /api/guest-circles-sessions/:id | routes/guest-circles-sessions.js:147 | guestId | Guest: fetch session | no |
| DELETE | /api/guest-circles-sessions/:id | routes/guest-circles-sessions.js:160 | guestId | Guest: delete session | yes |
| POST | /api/guest-circles-sessions/:id/gate | routes/guest-circles-sessions.js:175 | guestId | Guest: Phase 1.5 gate | yes |
| POST | /api/guest-circles-sessions/:id/message | routes/guest-circles-sessions.js:200 | guestId | Guest: Phase 2 SSE chat | yes |
| POST | /api/guest-circles-sessions/:id/evaluate-step | routes/guest-circles-sessions.js:245 | guestId | Guest: score step | yes |
| POST | /api/guest-circles-sessions/:id/conclusion-check | routes/guest-circles-sessions.js:267 | guestId | Guest: conclusion check | no |
| PATCH | /api/guest-circles-sessions/:id/progress | routes/guest-circles-sessions.js:284 | guestId | Guest: save progress | yes |
| POST | /api/guest-circles-sessions/:id/final-report | routes/guest-circles-sessions.js:353 | guestId | Guest: final report | yes |
| POST | /api/guest-circles-sessions/:id/hint | routes/guest-circles-sessions.js:393 | guestId | Guest: CIRCLES field hint | no |
| POST | /api/guest-circles-sessions/:id/example | routes/guest-circles-sessions.js:412 | guestId | Guest: CIRCLES field example | no |
| POST | /api/circles-public/hint | routes/circles-public.js:48 | none | Session-less AI hint | no |
| GET | /api/circles-public/all-examples | routes/circles-public.js:65 | none | Dump all curated examples | no |
| POST | /api/circles-public/example | routes/circles-public.js:76 | none | Curated example by field | no |
| GET | /api/circles-stats | routes/circles-stats.js:10 | auth | Auth user CIRCLES stats summary | no |
| GET | /api/guest-circles-stats | routes/guest-circles-stats.js:9 | guestId | Guest CIRCLES stats summary | no |
| POST | /api/nsm-sessions | routes/nsm-sessions.js:18 | auth | Create NSM session | yes |
| GET | /api/nsm-sessions | routes/nsm-sessions.js:34 | auth | List NSM sessions | no |
| GET | /api/nsm-sessions/:id | routes/nsm-sessions.js:67 | auth | Fetch single NSM session | no |
| DELETE | /api/nsm-sessions/:id | routes/nsm-sessions.js:79 | auth | Delete NSM session | yes |
| POST | /api/nsm-sessions/:id/evaluate | routes/nsm-sessions.js:94 | auth | NSM Step 3→4 full evaluation | yes (eval_result) |
| POST | /api/nsm-sessions/:id/gate | routes/nsm-sessions.js:130 | auth | NSM Step 2 gate check | yes (gate_result) |
| POST | /api/nsm-sessions/:id/context | routes/nsm-sessions.js:157 | auth | Generate NSM question context | yes (context_json) |
| PATCH | /api/nsm-sessions/:id/progress | routes/nsm-sessions.js:173 | auth | Save NSM step/draft | yes (progress_json) |
| POST | /api/nsm-sessions/:id/hints | routes/nsm-sessions.js:235 | auth | AI hints for NSM Step 1 | no |
| POST | /api/guest/nsm-sessions | routes/guest-nsm-sessions.js:18 | guestId | Guest: create NSM session | yes |
| GET | /api/guest/nsm-sessions | routes/guest-nsm-sessions.js:34 | guestId | Guest: list NSM sessions | no |
| GET | /api/guest/nsm-sessions/:id | routes/guest-nsm-sessions.js:62 | guestId | Guest: fetch NSM session | no |
| DELETE | /api/guest/nsm-sessions/:id | routes/guest-nsm-sessions.js:74 | guestId | Guest: delete NSM session | yes |
| POST | /api/guest/nsm-sessions/:id/evaluate | routes/guest-nsm-sessions.js:89 | guestId | Guest: NSM evaluate | yes |
| POST | /api/guest/nsm-sessions/:id/gate | routes/guest-nsm-sessions.js:123 | guestId | Guest: NSM gate | yes |
| POST | /api/guest/nsm-sessions/:id/context | routes/guest-nsm-sessions.js:150 | guestId | Guest: NSM context | yes |
| PATCH | /api/guest/nsm-sessions/:id/progress | routes/guest-nsm-sessions.js:169 | guestId | Guest: save NSM progress | yes |
| POST | /api/guest/nsm-sessions/:id/hints | routes/guest-nsm-sessions.js:233 | guestId | Guest: NSM Step 1 hints | no |
| POST | /api/nsm-public/step2-hint | routes/nsm-public.js:25 | none | Session-less NSM Step 2 field hint | no |
| POST | /api/nsm-public/step3-hint | routes/nsm-public.js:52 | none | Session-less NSM Step 3 dim hint | no |
| POST | /api/nsm-context | routes/nsm-context.js:7 | none | Stateless NSM context generation | no |
| GET | /api/nsm-stats | routes/nsm-stats.js:11 | auth | Auth user NSM stats summary | no |
| GET | /api/guest-nsm-stats | routes/guest-nsm-stats.js:9 | guestId | Guest NSM stats summary | no |
| GET | /health | server.js:52 | none | Health check | no |

**NOTE — `routes/sessions.js` and `routes/guest-sessions.js` exist on disk (legacy SP2/SP3 endpoints: POST/GET/DELETE sessions, POST chat SSE, POST submit) but are NOT mounted in server.js. They are dead code.**

---

## Prompts

| Prompt file | Surface served | Auth variant | Guest variant |
|---|---|---|---|
| prompts/circles-gate.js | CIRCLES Phase 1.5 gate (`/gate`) | yes | yes (same logic, different route) |
| prompts/circles-evaluator.js | CIRCLES Phase 2→3 step scoring (`/evaluate-step`) | yes | yes |
| prompts/circles-hint.js | CIRCLES Phase 1 per-field hint (`/hint`) | yes | yes |
| prompts/circles-example.js | CIRCLES Phase 1 per-field example (`/example`) | yes | yes |
| prompts/circles-conclusion-check.js | CIRCLES Phase 2 conclusion quality check (`/conclusion-check`) | yes | yes |
| prompts/circles-final-report.js | CIRCLES Phase 4 final report (`/final-report`) | yes | yes |
| prompts/circles-coach.js | CIRCLES Phase 2 SSE streaming chat (`/message`) | yes | yes |
| prompts/coach-demo.js | Phase 3 score page coach-demo accordion | yes | yes |
| prompts/coach.js | Legacy SP2/SP3 chat (unmounted) | — | — |
| prompts/evaluator.js | Legacy SP2/SP3 submit evaluation (unmounted) | — | — |
| prompts/issue-generator.js | Legacy SP2/SP3 question generator (unmounted) | — | — |
| prompts/nsm-gate.js | NSM Step 2 gate check (`/:id/gate`) | yes | yes |
| prompts/nsm-evaluator.js | NSM Step 3→4 full evaluation (`/:id/evaluate`) | yes | yes |
| prompts/nsm-hints.js | NSM Step 1 AI hints (`/:id/hints`) | yes | yes |
| prompts/nsm-context.js | NSM question context (`/:id/context`, `/api/nsm-context`) | yes | stateless public route |
| prompts/nsm-step2-hint.js | NSM Step 2 per-field hint (`/step2-hint`) | yes (via session route) | stateless public route |
| prompts/nsm-step3-hint.js | NSM Step 3 per-dim hint (`/step3-hint`) | yes (via session route) | stateless public route |
| prompts/nsm-step2-example.js | NSM Step 2 per-field example | referenced by nsm-public | stateless |
| prompts/nsm-step3-example.js | NSM Step 3 per-dim example | referenced by nsm-public | stateless |
| prompts/nsm-coherent-example.js | NSM coherent all-field example (Step 2) | referenced by nsm-public | stateless |

---

## AppState Fields (declared in app.js top)

| Field | Default | Purpose | Mutation entry points |
|---|---|---|---|
| view | 'circles' | 'circles' \| 'nsm' \| 'auth' — top-level tab | navbar handler (bindNavbar), 401 intercept, restore() |
| accessToken | null | Supabase JWT for auth headers | Supabase signIn callback, 401 handler, restore() |
| guestId | null | UUIDv4 for X-Guest-ID header | ensureGuestId() on boot |
| isOnline | navigator.onLine | offline banner trigger | online/offline event listeners |
| onboardingComplete | localStorage | whether onboarding tour is done | bindOnboarding dismiss handler |
| onboardingActive | false | true while tour running | loadHistory → maybeStartOnboarding |
| onboardingStep | 0 | 0=welcome, 1-4=tour steps | bindOnboarding next/prev handlers |
| circlesPhase | 1 | 1 \| 1.5 \| 2 \| 3 \| 4 | gate response, evaluate response, submit bar, offcanvas resume |
| circlesMode | null | 'drill' \| 'simulation' | mode card click (bindCirclesHome) |
| circlesDrillStep | null | 'C1'\|'I'\|'R'\|'C2'\|'L'\|'E'\|'S' | step nav, gate pass, restore() |
| circlesSimStep | 0 | simulation sub-step counter | sim nav handlers |
| circlesSelectedQuestion | null | currently selected Q object | qcard click, offcanvas item click |
| circlesSession | null | { id, ... } backend session | draft/POST session response, resume |
| circlesFrameworkDraft | {} | per-step text map | rt-field input handler (autosave) |
| circlesConversation | [] | Phase 2 chat turns | /message SSE response |
| circlesGateResult | null | Phase 1.5 gate response payload | /gate response handler |
| circlesGateLoading | false | Phase 1.5 gate in-flight | gate submit handler |
| circlesGateError | null | Phase 1.5 gate error | gate error handler |
| circlesScoreResult | null | Phase 3 overall score object | /evaluate-step accumulation |
| circlesStepScores | {} | per-step score map | /evaluate-step response, restore() |
| circlesEvaluating | false | step evaluation in-flight | evaluate-step handler |
| circlesEvaluateError | null | step evaluation error | evaluate-step error handler |
| circlesFinalReport | null | Phase 4 report payload | /final-report response |
| circlesStale | false | true when session may be out of date | multi-tab storage event |
| circlesLocked | false | step locked (already scored) | phase transition logic |
| circlesChipExpanded | false | qchip panel open/closed | qchip click (bindCirclesPhase2) |
| circlesDisplayedQuestions | [] | current filtered Q list | search/filter/reshuffle handlers |
| circlesPhase1Solutions | [{name,mechanism}×2] | L-step solution cards | sol-card input handlers |
| circlesPhase1Evaluate | [{advantages,...}×2] | E-step evaluation fields | esol-card input handlers |
| circlesPhase1SaveState | 'idle' | 'idle'\|'saving'\|'saved'\|'error' | autosave cycle |
| circlesPhase1EmptyHint | false | empty-draft warning shown | submit guard |
| circlesPhase1S | {recommendation,...} | S-step recommendation fields | S-step input handlers |
| circlesTypeFilter | 'design' | Q filter pill | filter pill click |
| circlesSearchText | '' | Q search box value | search input handler |
| circlesQaOpen | false | Q&A row open/closed | toggle click |
| circlesExpandedQid | null | single qcard expanded | qcard click |
| circlesRecentSessions | null | recent sessions list | loadHistory() response |
| circlesPhase2Streaming | false | SSE stream in-flight | streamCirclesMessage |
| circlesPhase2StreamingTurn | null | {userMessage, deltaText} partial turn | SSE delta handler |
| circlesPhase2StreamError | false | SSE failure flag | SSE error handler |
| circlesPhase2ConclusionMode | false | conclusion panel open | conclusion button click |
| circlesPhase2ConclusionDraft | '' | conclusion text draft | conclusion textarea input |
| circlesPhase2ExampleOpen | false | example panel open | example toggle |
| circlesPhase2CoachHintExpanded | {} | {turnIdx: boolean} coach hint expand | hint toggle (bindCirclesPhase2) |
| circlesPhase3LoadingStep | 1 | 0-3 loading checklist active step | Phase 3 loading animation |
| circlesPhase3LoadingSlow | false | slow-load warning (>60s) | Phase 3 timeout handler |
| circlesPhase3Error | null | Phase 3 error payload | Phase 3 fetch error |
| circlesPhase3DimExpanded | {} | per-dim accordion state | dim card click |
| circlesPhase3CoachDemoOpen | false | coach-demo accordion open | coach-demo toggle |
| circlesPhase4LoadingStep | 0 | 0-3 Phase 4 loading step | Phase 4 loading animation |
| circlesPhase4Error | null | Phase 4 error payload | Phase 4 fetch error |
| nsmStep | 1 | 1\|2\|3\|4 | NSM step nav, gate pass, evaluate response |
| nsmSubTab | 'nsm-step2' | 'nsm-step2'\|'nsm-gate' | sub-tab click (bindNSMStep2And3) |
| nsmReportTab | 'overview' | 'overview'\|'comparison'\|'highlights'\|'done' | tab click (bindNSMStep4) |
| nsmSession | null | { id } backend NSM session | POST /nsm-sessions response |
| nsmSelectedQuestion | null | selected NSM Q object | NSM qcard click |
| nsmContext | null | AI-generated context payload | /context response |
| nsmContextLoading | false | context fetch in-flight | context fetch handler |
| nsmGateResult | null | NSM gate response payload | /gate response, restore() |
| nsmGateError | null | NSM gate error | gate error handler |
| nsmGateLoading | false | NSM gate in-flight | gate submit handler |
| nsmGateLoadingStep | 0 | gate loading animation step | gate loading timer |
| nsmEvalLoading | false | NSM eval in-flight | eval submit handler |
| nsmEvalResult | null | NSM evaluation result | /evaluate response |
| nsmEvalError | null | NSM eval error | eval error handler |
| nsmActiveCompareNode | null | selected dim in comparison tab | dim node click (bindNSMStep4) |
| nsmDisplayedQuestions | [] | current filtered NSM Q list | filter/search/reshuffle |
| nsmSearchText | '' | NSM search box value | search input |
| nsmTypeFilter | 'all' | NSM type filter | filter pill click |
| nsmDefinition | {nsm,explanation,businessLink} | Step 2 form draft | nsm-field input handlers |
| nsmBreakdown | {reach,depth,frequency,impact} | Step 3 form draft | dim-field input handlers |
| nsmExampleExpanded | {} | {fieldKey: boolean} example open state | example toggle, restore() |
| nsmHintExpanded | {} | {fieldKey: boolean} hint open state | hint toggle, restore() |
| nsmDimExampleExpanded | {} | {dimKey: boolean} Step 3 dim example open | dim example toggle |
| nsmContextExpanded | false | Step 2/3 context-card 4-block expand | context expand toggle, restore() |
| streamingActive | false | legacy streaming flag | chat handlers |
| offcanvasOpen | false | history drawer visible | navbar history icon, outside-click close |
| historyList | null | null\|[]\|[...] session list | loadHistory() |
| historyLoading | false | history fetch in-flight | loadHistory() |
| historyError | null | history fetch error | loadHistory() error |
| circlesSessionLoading | false | session detail fetch in-flight | offcanvas item click |
| authTab | 'login' | 'login'\|'register' | tab switch, restore() |
| authLoading | false | Supabase call in-flight | login/register submit |
| authError | null | auth error payload | login/register error handler |
| userEmail | null | authed user email | Supabase session callback, restore() |
| migrationBanner | null | null\|'showing'\|'dismissed' | migrate-guest success handler |
| gateInflight | false | B6 mutex for concurrent gate calls | gate submit/complete |
| evalToastDismissed | false | resume-toast dismiss state | X button click |
| _resumeToastShow | false | auto-resume banner visible | tryResumeLatestSession() |
| _resumeToastMsg | '' | resume-toast copy | tryResumeLatestSession() |

---

## Cross-surface Dependencies

1. **CIRCLES Phase 2 unlock** depends on: `circlesGateResult` being set (Phase 1.5 gate pass), which requires `circlesPhase === 1.5` and a green gate response. If gate has any red item the phase stays at 1.5 — no override path exists.

2. **CIRCLES Phase 3 score** depends on: all 7 step evaluations (`circlesStepScores` fully populated from `/evaluate-step`). Phase 3 loading animation is gated on `circlesScoreResult` arriving after all steps evaluated.

3. **NSM Step 2 → Gate → Step 3** depends on: `nsmDefinition.nsm` being filled (non-empty) before the gate call; gate result stored in `nsmGateResult` must show pass before `nsmStep` advances to 3.

4. **NSM Step 4 report** depends on: `nsmBreakdown` all 4 dims filled + `/evaluate` returning `nsmEvalResult`; tab render dispatches on `nsmReportTab` which defaults to `'overview'`.

5. **Onboarding trigger** depends on: `historyList` loaded (via `loadHistory()`) to detect first-time user (empty list = start tour). `onboardingActive` only becomes `true` after boot history check.

6. **Auth → session resume** depends on: Supabase `getSession()` resolving with a token, then `tryResumeLatestSession()` calling `GET /api/circles-sessions` or `GET /api/nsm-sessions` to find latest in-progress session; sets `circlesPhase`, `nsmStep` accordingly.

7. **Offcanvas resume** depends on: `historyList` pre-loaded; clicking an item triggers `GET /api/circles-sessions/:id` (or guest variant) then sets `circlesSession`, `circlesPhase`, `circlesSelectedQuestion`.

8. **Cross-tab stale detection** depends on: `localStorage` storage event (`circlesStale`) — another tab saving progress triggers a stale banner in this tab without a forced reload.

9. **SSE Phase 2 chat** depends on: `circlesSession.id` set (session must exist), `circlesConversation` seeded with prior turns. SSE uses `fetch` + `ReadableStream` (not `EventSource`) to allow POST body + auth headers. Failure sets `circlesPhase2StreamError`.

10. **Migration banner** depends on: `POST /api/migrate-guest` success after login flow; banner appears only once (`migrationBanner='showing'`), dismissed on X click or next navigation.

---

## index.html Structure

Single-page app. `<div id="app">` is the sole mount point. JS loaded:
- `/circles-db.js` — CIRCLES question bank (window.CIRCLES_QUESTIONS)
- `/nsm-db.js` — NSM question bank (window.NSM_QUESTIONS)
- `/lib/frameworkValidator.js` — shared validation lib
- `/app.js` — full FE app (~8500 lines)

No server-side rendering. No inline scripts. Two external font families (DM Sans, Instrument Serif). Phosphor icons CDN.

---

## style.css Section Breakdown

| Section | Line range | Contents |
|---|---|---|
| Design tokens + foundation | 1–48 | CSS vars, reset, layout primitives |
| LOCKED shared components | 49–261 | navbar, btn, circles-nav/nsm-nav, qchip, submit-bar, phase-head, save-indicator, banner family, loading-wrap, error-wrap, form-field, panel-card |
| NSM Step 1 (mockup 06) | 262–368 | nsm-progress, nsm-body, nsm-context-card, nsm-type-pills, nsm-q-card, desktop 3-col shell |
| Offcanvas History (mockup 09) | 370–528 | drawer, backdrop, item, section divider, empty/loading/error states |
| CIRCLES Home (mockup 01) | 530–780 | stats strip, mode selector, drill-rail, drill-pill-row, q-list, qcard, qcard expanded |
| CIRCLES Phase 1 Form (mockup 03) | 783–1035 | progress, phase-body, field, rt-field, example-expand, rail, sol-card, tracking-section |
| qchip-expand (mockup 03 §G) | 1037–1123 | qchip expand panel, section label |
| Hint modal (mockup 03 §D) | 1125–1160 | hint-overlay, modal shell |
| Phase 1.5 Gate (mockup 04) | 1162–1399 | gate-wrap, gate-item, gate-summary, NSM gate recap |
| NSM Step 2/3 (mockup 07) | 1401–1855 | nsm-step2/3 shell, nsm-rt-field, nsm-guide, nsm-dim-card, lock states, step3 reminder banner |
| Onboarding (mockup 10) | 1661–1868 | welcome card, tooltip, spotlight ring |
| Phase 2 Chat (mockup 05) | 1870–2644 | chat-wrap, bubble (3 roles), conclusion sticky, coach-hint expand, conclusion-box, phase-3 score |
| Phase 3 Score (mockup 11/12) | 2299–2644 | score card, dim-card, coach-demo accordion, loading/error variants |
| Phase 4 Final Report (mockup 13) | 2646–2841 | phase4-wrap, radar SVG, step-rows, NSM 4-dim section |
| NSM Step 4 (mockup 14) | 3070–3207 | nsm-step4 tabs, coach-detail sections, pentagon radar |
| Auth screen (mockup 02) | 3210–3441 | auth-wrap, auth-tab, form fields, error banner |
| Resume-toast (mockup 16 §D) | 3443–3492 | toast banner |
| NSM context-card expand (Gap C) | 3494–3647 | 4-block expand toggle |

---

## iOS Safari Sensitive Areas

| Area | Risk | Location |
|---|---|---|
| `.submit-bar` (fixed bottom) | Overlaps safe-area-inset-bottom; uses `env(safe-area-inset-bottom)` | style.css:136 |
| `.hint-overlay` (fixed inset 0) | Scroll lock + touch passthrough when open | style.css:1127 |
| `.offcanvas` (fixed inset 0) | Same scroll/touch concerns as modal | style.css:375 |
| `.onb-tooltip` (fixed, positioned by JS) | `positionOnboardingTooltip()` runs after render; timing risk on iOS scroll | style.css:1724, app.js:8405 |
| Phase 2 SSE (fetch + ReadableStream) | `ReadableStream` cancel + `getReader()` teardown on iOS Safari 15 | app.js:1172 |
| `.conclusion-actions` (sticky) | `position: sticky` inside flex container — iOS quirk prone | style.css:2230 |
| rt-field `<textarea>` focus | Auto-scroll + keyboard-resize pushes fixed submit-bar; `interactive-widget=resizes-visual` in viewport meta mitigates | index.html:5, style.css:818 |

---

## Cited Summary

- **Total render functions:** 36 (top-level surfaces: 13 primary views + 9 sub-renderers + 8 shared UI components + 6 Phase 4 / NSM report tab renderers)
- **Total API endpoints:** 57 mounted (auth: 27, guestId: 26, none/public: 4) — plus 6 unmounted legacy endpoints in sessions.js / guest-sessions.js
- **Total prompts:** 20 files (17 active, 3 unmounted legacy: coach.js, evaluator.js, issue-generator.js)
- **Total AppState fields:** 72 declared fields
- **Persisted to localStorage:** 17 fields (PERSISTED_KEYS at app.js:153)
- **iOS Safari sensitive areas:** 7 (fixed submit-bar, hint-overlay, offcanvas, onboarding tooltip, SSE ReadableStream, sticky conclusion, textarea focus)
