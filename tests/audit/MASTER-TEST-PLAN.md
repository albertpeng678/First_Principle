# PM Drill — Rigorous Audit Test Plan
**Date:** 2026-04-27
**Scope:** 1000 test cases across 20 batches × 50 tests each
**Distribution:** 20 parallel agents, one batch per agent
**Target:** http://localhost:4000 (local dev server with .env)
**Spec source:** `docs/superpowers/plans/2026-04-26-circles-nsm-ux-mockup-spec.md`

## Standards (apply to ALL batches)

Every test MUST:
1. Cite spec line refs when verifying spec compliance
2. Use Playwright with `@playwright/test`
3. Test ACTUAL behavior, not implementation
4. Record exact reproduction steps for failures
5. Categorize bugs as Critical / Important / Minor (see Severity below)

### Severity rubric
- **Critical:** Page crashes, data loss, user cannot proceed, security issue, complete feature failure
- **Important:** Spec deviation that affects UX, broken state, AI returns garbage, layout broken on common breakpoint
- **Minor:** Cosmetic issue, non-blocking warning, edge case rare-path bug

### Test environment per agent
- Use unique guest ID: `audit-batch-{NN}` (NN = batch number)
- Run headless: `npx playwright test --headed=false`
- Each test should clean up its own state (don't depend on prior test)
- Set realistic timeouts (30s) — fail fast if hung

### Output format per agent
Each agent must write `tests/audit/results/batch-{NN}.md` with:
```
## Batch {NN}: {category name}
### Summary
- Tests written: N
- Tests passed: N
- Tests failed: N
- Critical bugs: N
- Important bugs: N
- Minor bugs: N

### Bug list (one entry per failed test)
#### BUG-{NN}-{seq}: {one-line title}
- **Severity:** Critical | Important | Minor
- **Category:** {area}
- **Spec line ref:** {file:line or N/A}
- **Reproduction:**
  1. {step}
  2. {step}
- **Expected:** {per spec}
- **Actual:** {observed behavior}
- **Suggested fix:** {if obvious; else "needs investigation"}
```

---

## BATCH 01 — CIRCLES Home: Render + RWD

**Spec lines:** 425-821 of master spec
**Focus:** Initial render correctness across 5 breakpoints (320, 390, 480, 768, 1024)
**Guest ID:** `audit-batch-01`

### Tests (50)

**Render structure (10):**
1. Page title is "PM Drill — 第一性原理訓練器"
2. Navbar shows "PM Drill" logo + hamburger button
3. Main content has `[data-view="circles"]` wrapper
4. `.circles-home-title` exists with text "CIRCLES 訓練"
5. `.circles-home-title` has `font-family: "DM Sans"` (NOT Instrument Serif) — spec line 7556
6. NO `circles-home-back` button in DOM — spec line 7557
7. Info card exists (`.circles-info-card`)
8. Info card body is collapsed by default (`display: none`)
9. Mode selector renders 2 cards (`.circles-mode-card`)
10. Type tabs render 3 tabs (產品設計/產品改進/產品策略)

**RWD at 320px iPhone SE (10):**
11. No horizontal overflow at 320px
12. Navbar fits at 320px (no element clipped)
13. Question cards width ≤ viewport at 320px
14. Mode cards stack or shrink properly at 320px
15. Type tabs scrollable or fit at 320px
16. Touch targets ≥ 44×44px at 320px
17. Font ≥ 11px at 320px (no unreadable text)
18. NSM banner button visible at 320px
19. Random button (`#circles-random-btn`) visible + clickable at 320px
20. No text overflow on company badges at 320px

**RWD at 390px iPhone 14 Pro (10):**
21-30. Repeat 11-20 at 390px

**RWD at 768px iPad portrait (10):**
31-40. Repeat 11-20 at 768px

**RWD at 1024px desktop (10):**
41-50. Repeat 11-20 at 1024px

---

## BATCH 02 — CIRCLES Home: Interactions

**Spec lines:** 425-821 of master spec, especially Tasks A/B/C (lines 7545-7572)
**Focus:** Click behaviors, mode/type switching, random button
**Guest ID:** `audit-batch-02`

### Tests (50)

**Mode selector (10):**
1. Default mode is `simulation` (or whatever localStorage has)
2. Click 完整模擬 card sets `circlesMode = 'simulation'`
3. Click 步驟加練 card sets `circlesMode = 'drill'`
4. Active mode card has `.selected` class
5. Mode change persists to localStorage
6. Mode change re-renders home (no full page reload)
7. Step pills appear when drill mode selected
8. Step pills disappear when simulation mode selected
9. Step pills only show C1/I/R (3 buttons)
10. Lock note "C2、L、E、S 需在完整模擬中練習" visible in drill mode

**Type tabs (10):**
11. Click 產品設計 sets `circlesSelectedType = 'design'`
12. Click 產品改進 sets `circlesSelectedType = 'improve'`
13. Click 產品策略 sets `circlesSelectedType = 'strategy'`
14. Active tab has `.active` class
15. Type tab change re-picks 5 random questions (different set)
16. Type tab count shows correct number (e.g., "產品設計 ×N")
17. Tab change does NOT navigate (still on home view)
18. Tab change does NOT reset mode selection
19. Tab change does NOT collapse info card
20. Tab change does NOT close any expanded question card

**Random button (10):**
21. `#circles-random-btn` exists and labeled "隨機選題"
22. Click 隨機選題 picks 5 different random questions
23. Click 隨機選題 does NOT navigate
24. Click 隨機選題 does NOT change mode
25. Click 隨機選題 does NOT change type
26. Click 隨機選題 collapses any expanded question card
27. Random selection respects current type filter
28. Multiple consecutive clicks always show 5 cards
29. Random doesn't fail on empty filtered set (graceful)
30. Random button keyboard accessible (Tab + Enter)

**Info card toggle (10):**
31. Info card header click expands body
32. Click again collapses body
33. Caret icon flips on toggle (right ↔ down)
34. Toggle does NOT navigate
35. Toggle does NOT affect other UI state
36. Body content includes "什麼是 CIRCLES 實戰訓練？" text
37. Body content shows 7-step badges
38. Body styled with proper background + border
39. Header keyboard accessible
40. Smooth animation (no abrupt jump)

**Step pills in drill mode (10):**
41. Step pills only render when mode === drill
42. Click C1 pill sets `circlesDrillStep = 'C1'`
43. Click I pill sets `circlesDrillStep = 'I'`
44. Click R pill sets `circlesDrillStep = 'R'`
45. Active pill has `.active` class
46. Pill change does NOT navigate
47. Pill change does NOT close info card
48. Pill change does NOT collapse expanded question card
49. Tooltip on hover shows step description
50. Default drill step is C1 (or whatever's in AppState)

---

## BATCH 03 — CIRCLES Home: Accordion + Resume

**Spec lines:** 709-797 (cards) + 994-1067 (resume) of master spec, plus Task C
**Focus:** Question card expand/collapse, resume cards, navigation
**Guest ID:** `audit-batch-03`

### Tests (50)

**Question card structure (10):**
1. Render shows max 5 question cards
2. Each card has `data-qid` attribute
3. Each card has `.circles-q-card-company` (company badge)
4. Each card has `.circles-q-card-stmt` with truncated text
5. Stmt text ≤ 60 chars + "…" if original > 60
6. "看更多 ▾" link visible when text > 60 chars
7. NO "看更多" link when text ≤ 60 chars
8. Expand area `.circles-q-card-expand-area` exists with `display:none`
9. Expand area contains 確認 button + 取消 button
10. Drill mode shows "練習步驟：{step}" inside expand area

**Accordion expand (10):**
11. Click on collapsed card expands it (`expand-area` display: block)
12. Border color changes to primary on expand
13. "看更多" hides on expand
14. Stmt text changes from short to full on expand
15. Expanding one card auto-collapses others (accordion)
16. Expanded card stays open after async fetch completes (REGRESSION)
17. Click on expanded card body does NOT collapse (only 取消 collapses)
18. Click outside expanded card does NOT collapse
19. Multiple rapid clicks don't break expand/collapse cycle
20. Expanded card scroll into view on small screen

**Confirm flow (10):**
21. Click 確認，開始練習 sets `circlesSelectedQuestion`
22. Confirm clears `circlesFrameworkDraft`
23. Confirm clears `circlesGateResult`
24. Confirm clears `circlesConversation`
25. Confirm clears `circlesScoreResult`
26. Confirm clears `circlesSimStep` to 0
27. Confirm sets `circlesPhase` to 1
28. Confirm renders Phase 1 form (not still on home)
29. Confirm in drill mode passes drillStep correctly
30. Confirm in simulation mode passes mode correctly

**Cancel flow (5):**
31. Click 取消 collapses card
32. Cancel restores short stmt text
33. Cancel hides expand area
34. Cancel removes border-primary
35. Cancel does NOT navigate or reset other state

**Resume cards (15):**
36. Resume cards only render if `circlesRecentSessions` non-empty
37. Resume slot is `<div id="circles-recent-slot">`
38. Resume cards show company name
39. Resume cards show mode label (步驟加練 / 完整模擬)
40. Resume cards show phase label (填寫框架/等待審核/...)
41. Resume cards show step (Step N/7 or step name)
42. Click resume card calls `loadCirclesSession`
43. Click resume card shows loading state (opacity 0.6)
44. Successful load sets pointer-events back if fail
45. Resume click navigates into the saved phase
46. Resume from phase 3 restores `circlesScoreResult` from cache (REGRESSION)
47. Resume from phase 3 with no cached score downgrades to phase 2 (REGRESSION)
48. Resume slot doesn't trigger render() — only itself updates (REGRESSION)
49. Resume card "繼續練習 →" button visible
50. Multiple resume cards render in correct order (most recent first)

---

## BATCH 04 — Phase 1 Form: C1 Step

**Spec lines:** 823-922 (Screen 2) + 1625-1701 (C1 content)
**Focus:** C1-specific form rendering and interactions
**Guest ID:** `audit-batch-04`

### Tests (50)

**Setup all C1 tests:** Click confirm on first design-type question in drill mode with `circlesDrillStep='C1'`.

**C1 form structure (10):**
1. Navbar shows "C — 澄清情境"
2. Navbar shows company · product
3. Navbar has 回首頁 button
4. Navbar has back arrow button
5. Progress bar shows 7 segments, first segment active
6. Progress label shows "C · 澄清情境 · 1/7"
7. Step pills visible (drill mode)
8. Problem card shows full question text
9. NO `.prev-step-card` (only on E/S)
10. NO `.nsm-annotation` (only on S)

**C1 fields (10):**
11. 4 field groups render (problem range, time range, business impact, hypothesis)
12. Each field has `.circles-field-label` with correct text
13. Each field has 提示 (hint) button with lightbulb icon
14. Each field has textarea with placeholder
15. Field 1 label is "問題範圍"
16. Field 2 label is "時間範圍"
17. Field 3 label is "業務影響"
18. Field 4 label is "假設確認"
19. All textareas are empty initially
20. Each field has collapsible "查看範例" toggle (REGRESSION — was always-visible, now collapsible)

**Field example toggle (10):**
21. Default state: all 4 examples collapsed
22. Click toggle 1 expands body
23. Open body shows AI-fetched example (not static Facebook example) (REGRESSION)
24. Body initially shows static fallback + spinner while AI loads
25. AI example specific to current question's company
26. Click toggle when open collapses
27. Caret icon swaps between right/down
28. Button text swaps between "查看範例" / "收起範例"
29. Cache: re-open instantly shows previous AI result (no refetch)
30. Failed AI fetch shows fallback + error note

**Hint button + overlay (10):**
31. Click 提示 button on field 1 opens overlay
32. Overlay has `.hint-overlay` class with `.visible`
33. Overlay shows loading spinner first
34. Overlay loads AI hint via POST /:id/hint
35. Hint title shows "{field} — 分析思路"
36. Hint sub shows "{company} · {product} · {step}"
37. Hint body shows AI text (not garbage prefix like "以下是" or "首先")
38. Hint length 100-140 chars (not 400+)
39. Click × closes overlay
40. Click outside overlay closes it
41. Hint card has display: block (NOT flex) — REGRESSION layout fix
42. Title renders horizontally not vertically

**Form input + submit (8):**
42. Type in field 1 saves to `circlesFrameworkDraft`
43. Type in field 1 calls /progress endpoint
44. Empty form submit shows error or disabled button
45. Filled form submit calls /:id/gate endpoint
46. Submit sets phase to 1.5 (gate)
47. Submit shows loading state on button
48. Failed gate shows error message
49. 返回選題 button navigates back to home
50. 回首頁 button navigates to home (without losing draft)

---

## BATCH 05 — Phase 1 Form: I + R Steps

**Spec lines:** 1703-1786 (I) + 1786-1878 (R)
**Focus:** I and R step specific behaviors
**Guest ID:** `audit-batch-05`

### Tests (50)

**Setup:** Drill mode, switch between I and R steps.

**I step structure (15):**
1. Navbar title "I — 定義用戶"
2. Progress label "I · 定義用戶 · 2/7"
3. Field 1 label "目標用戶分群"
4. Field 2 label "選定焦點"
5. Field 3 label "用戶動機假設"
6. Field 4 label "排除對象"
7-10. All 4 fields have placeholders matching spec lines 247-258 (CIRCLES_STEP_CONFIG)
11-15. All 4 fields have collapsible 查看範例 with AI-fetched content

**R step structure (15):**
16. Navbar title "R — 發掘需求"
17. Progress label "R · 發掘需求 · 3/7"
18. Field 1 label "功能性需求"
19. Field 2 label "情感性需求"
20. Field 3 label "社交性需求"
21. Field 4 label "核心痛點"
22-25. All 4 fields have placeholders matching spec
26-30. All 4 fields have collapsible 查看範例

**Cross-step (10):**
31. Switching from I to R clears `circlesFrameworkDraft`
32. Switching from C1 to I clears draft
33. Returning to home from I preserves nothing (clean slate)
34. AI examples cached per (sessionId, step, field) — switching steps preserves cache
35. Hint overlay step badge updates correctly between I/R
36. /progress endpoint called with correct step when switching
37. Submit on I goes to gate, then to Phase 2 (I)
38. Submit on R goes to gate, then to Phase 2 (R)
39. Drill step 1.5 gate items reflect correct step
40. Phase 2 icebreaker matches step (different text per step)

**RWD (10):**
41-45. I step renders correctly at 320/390/480/768/1024
46-50. R step renders correctly at 320/390/480/768/1024

---

## BATCH 06 — Phase 1 Form: C2 + L Steps

**Spec lines:** 4644-4712 (C2) + 5607-5711 (L)
**Focus:** C2 and L step specific behaviors. L step has special sol-name-input pattern.
**Guest ID:** `audit-batch-06`

### Tests (50)

**Setup:** Use simulation mode to reach C2 and L steps.

**C2 step structure (10):**
1. Navbar title "C — 優先排序"
2. Progress label "C · 優先排序 · 4/7"
3. Field 1 label "取捨標準"
4. Field 2 label "最優先項目"
5. Field 3 label "暫緩項目"
6. Field 4 label "排序理由"
7-10. Placeholder + collapsible example for each

**L step special pattern (10):**
11. Field 1 has `.sol-name-row` with `.sol-name-input`
12. sol-name-input has maxlength=10
13. sol-name-input placeholder "方案名稱（10 字內）"
14. sol1 input + textarea both render
15. sol2 input + textarea both render
16. sol3 group has `id="l-sol3-group"` and `display:none` initially
17. sol3 group displays only if name OR body filled
18. Tag icon next to each sol-name-input
19. Solution name saves to `circlesStepDrafts['L'][solKey]`
20. Solution body saves to `circlesFrameworkDraft[fieldKey]`

**L solution interactions (10):**
21. Type in sol1 name updates UI immediately
22. Type in sol1 name persists via /progress
23. Empty sol1 name still allows submit (warn maybe)
24. Type in sol2 name + body
25. Filling sol3 name reveals sol3 body
26. sol3 has visible "（可選）" label
27. Switching from L back to C2 preserves L data via stepDrafts
28. Returning to L re-renders sol1/sol2/sol3 with previous values
29. Maxlength enforced on sol-name-input (typing 11 chars truncates)
30. Special chars in sol name don't break (test: <script>, emoji, &)

**C2/L navigation + submit (10):**
31. C2 submit goes to gate, then Phase 2 of C2
32. L submit goes to gate, then Phase 2 of L
33. C2 gate result schema includes 4 items
34. L gate result schema includes 3-4 items
35. Submit button disabled while saving
36. Failed submit shows retry option
37. 回首頁 from C2 goes to home
38. 回首頁 from L goes to home
39. Back arrow from C2 goes to home (or last step in sim)
40. Back arrow from L goes to home (or last step in sim)

**RWD (10):**
41-45. C2 renders correctly at all 5 breakpoints
46-50. L renders correctly at all 5 breakpoints

---

## BATCH 07 — Phase 1 Form: E Step (Per-Solution Matrix)

**Spec lines:** 5742-6114 (E)
**Focus:** E step's unique per-solution matrix pattern + prev-step-card
**Guest ID:** `audit-batch-07`

### Tests (50)

**Setup:** Reach E step in simulation mode (after L).

**E step structure (10):**
1. Navbar title "E — 評估取捨"
2. Progress label "E · 評估取捨 · 6/7"
3. `.prev-step-card` visible at top
4. Prev-step-card collapsible (default expanded on desktop)
5. Prev-step-card shows L step's solution names
6. Prev-step-card shows C1/R drafts as referenced rows
7. NO standard 4 field groups (replaced by per-solution blocks)
8. 3 `.e-solution-block` containers render (sol1, sol2, sol3)
9. sol3 block has `id="e-sol3-block"`, hidden by default if no L sol3
10. "+新增方案三" button (`#e-sol3-add-btn`) shows if no sol3

**Per-solution block structure (10):**
11. Each block has `.e-sol-header` with `.e-sol-badge` + `.e-sol-name`
12. Badge shows "方案一" / "方案二" / "方案三"
13. Name reads from `circlesStepDrafts['L'].sol1/sol2/sol3`
14. Each block has 4 sub-fields (優點/缺點/風險與依賴/成功指標)
15. Each sub-field has 提示 button
16. Each sub-field has textarea
17. ONLY sol1's first sub-field has 查看範例 (per spec)
18. Sub-fields save to `circlesFrameworkDraft.perSolution[solKey][fieldKey]`
19. Optional sol3 has dimmed styling
20. Optional sol3's hint says "（未命名）" if not named

**Sol3 add button (10):**
21. Click +新增方案三 reveals sol3 block
22. Click hides the add button
23. Sol3 reveal does NOT navigate
24. Sol3 reveal preserves other state
25. After reveal, sol3's 4 sub-fields editable
26. Save sol3 data persists via /progress
27. Re-entering E step shows sol3 if it was saved
28. Add button doesn't show if sol3 already has data
29. Reveal animation smooth (no jump)
30. Add button has dashed border (CSS)

**Prev-step-card (10):**
31. Prev-step-card shows clock icon
32. Title says "前步驟重點參考"
33. Caret toggles right/down
34. Click header collapses/expands
35. Default state: expanded on first entry
36. Saved expand state preserved on switch
37. Rows show label + value
38. C1 row shows problem range + time + impact summary
39. R row shows pain point summary
40. L row shows sol1/sol2/sol3 names

**Submit + RWD (10):**
41. Submit on E goes to gate, then Phase 2 of E
42. Gate items reflect E criteria
43. Per-solution data sent to evaluate-step endpoint
44. 4 sub-fields per solution all evaluated
45. Submit button disabled with no perSolution data
46-50. E renders at 320/390/480/768/1024

---

## BATCH 08 — Phase 1 Form: S Step (Tracking + NSM)

**Spec lines:** 6116-6584 (S)
**Focus:** S step's tracking-block + NSM annotation + prev-step-card
**Guest ID:** `audit-batch-08`

### Tests (50)

**Setup:** Reach S step (last step) in simulation mode.

**S step structure (10):**
1. Navbar title "S — 總結推薦"
2. Progress label "S · 總結推薦 · 7/7"
3. `.prev-step-card` visible (E + L + R drafts)
4. `.nsm-annotation` visible (S step only)
5. NSM annotation text mentions "北極星指標"
6. NSM annotation has clickable link "前往 NSM 訓練"
7. Click link calls `navigate('nsm')`
8. 3 standard textarea fields (推薦方案/選擇理由/北極星指標)
9. 4th field is `.tracking-block` (NOT a textarea)
10. NO standard textarea for "追蹤指標"

**Tracking block structure (10):**
11. Tracking block header shows "追蹤指標"
12. Tracking block has 提示 button
13. Tracking block sub-text mentions "NSM 4 個拆解維度"
14. 4 dimension sub-blocks (廣度/深度/頻率/業務影響)
15. Each dim has color dot + label
16. Each dim has description text
17. Each dim has its own textarea (not single textarea)
18. Dim textareas are 1-row by default
19. Filled dim has `.filled` class for visual emphasis
20. Dim placeholder text matches spec

**Tracking block interactions (10):**
21. Type in 廣度 dim saves to `circlesFrameworkDraft.tracking.reach`
22. Type in 深度 dim saves to `tracking.depth`
23. Type in 頻率 dim saves to `tracking.frequency`
24. Type in 業務影響 dim saves to `tracking.impact`
25. Submit sends nested tracking object
26. Empty tracking dims still allow submit
27. .filled class added when textarea has content
28. .filled class removed when textarea cleared
29. Per-dim 提示 from header opens hint overlay
30. Tracking inputs have proper font-size on iOS (≥16px to avoid zoom)

**NSM annotation (5):**
31. NSM annotation has blue background (primary-lt)
32. Annotation appears between problem-card and field 1
33. Annotation NOT shown on any other step
34. Click 前往 NSM 訓練 link does NOT submit form
35. Annotation text wraps correctly at 320px

**Prev-step-card S (5):**
36. Prev-step-card shows L step's recommended solution
37. Prev-step-card shows R step's core pain point
38. Prev-step-card shows E step's evaluation summary
39. Prev-step-card collapsible
40. Empty drafts show "—" placeholder

**Final report transition (5):**
41. Submit on S in simulation mode goes to gate
42. After S gate pass + score, "看完整總結報告" button shows
43. Click final report button calls /final-report endpoint
44. Final report renders with overallScore + grade A/B/C/D
45. Final report shows strengths/improvements/coachVerdict

**RWD (5):**
46-50. S renders at 320/390/480/768/1024

---

## BATCH 09 — Hint Overlay (Screen 3): All States

**Spec lines:** 923-1030
**Focus:** Hint overlay rendering, AI fetch, error handling, layout
**Guest ID:** `audit-batch-09`

### Tests (50)

**Setup:** Open Phase 1 form in any step.

**Overlay open/close (10):**
1. Click 提示 opens overlay with `.visible` class
2. Backdrop has `rgba(0,0,0,0.45)` color
3. Overlay z-index 200 (above content)
4. Click × button closes overlay
5. Click backdrop (outside card) closes overlay
6. Click inside card does NOT close
7. Press ESC closes overlay (if implemented)
8. Open overlay locks body scroll (overscroll-behavior: contain)
9. Multiple opens/closes don't accumulate listeners
10. Reopen after close works correctly

**Loading state (10):**
11. On open: spinner shown
12. Spinner uses `@keyframes spin`
13. Loading text says "生成中" (or similar)
14. Title shown immediately ("{field} — 分析思路")
15. Sub line shown immediately ("{company} · {product} · {step}")
16. Loading state disappears when AI returns
17. Loading state shows on slow network (verify with throttling)
18. Loading does NOT block close button
19. Hidden close button while loading
20. Loading max ~10s before showing timeout error

**Loaded state (10):**
21. Hint body fills with AI text
22. Hint body has `white-space: pre-wrap` for line breaks
23. Hint body has `word-break: break-word` for long words
24. Footer shows "閱讀後自行填寫" (or similar)
25. "收起提示" button at footer
26. Hint length 100-140 chars (REGRESSION fix)
27. NO leading "以下是" / "首先" / "這是" prefix (REGRESSION fix)
28. NO bullet points or markdown in hint
29. AI hint specific to current question (not generic)
30. Multi-step hints have proper formatting

**Layout (10):**
31. Hint card has `display: block` (NOT flex) — REGRESSION fix
32. Title NOT rotated 90 degrees (single line horizontal) — REGRESSION fix
33. Sub line NOT rotated
34. Body NOT rotated
35. Card max-width 360px on mobile
36. Card max-height 75vh / 75dvh
37. Card has overflow-y: auto when content too long
38. Card scroll inside (not outer page) when content too long
39. Card has rounded corners
40. Card has box-shadow

**Error handling (5):**
41. AI 500 error shows "生成失敗，請重試"
42. Network failure shows error
43. AI 401 (auth fail) shows error
44. Empty response shows error
45. Error state has retry option (if implemented)

**Multiple fields (5):**
46. Open hint for field 1, close, open field 2 — different content
47. Hint reflects field name correctly
48. Cached hint not used (each field calls fresh AI)
49. Step badge updates per field (e.g., C1 → I)
50. Hint text different for different steps

---

## BATCH 10 — Field Example Collapsible (Cross-cutting)

**Spec lines:** 1825 + 3682 + C1 mockup 2148-2192
**Focus:** Collapsible example pattern across all 7 steps
**Guest ID:** `audit-batch-10`

### Tests (50)

**Pattern verification (10):**
1. C1 step uses `.field-example-toggle` (NOT `.circles-field-hint`)
2. I step uses `.field-example-toggle`
3. R step uses `.field-example-toggle`
4. C2 step uses `.field-example-toggle`
5. L step uses `.field-example-toggle`
6. E step uses `.field-example-toggle` (sol1 only)
7. S step uses `.field-example-toggle` (3 standard fields)
8. NO `.circles-field-hint` rendered in production (legacy)
9. Toggle button has caret-right icon by default
10. Toggle button text "查看範例"

**Default state (5):**
11. Default closed: body has NO `.open` class
12. Default closed: body `display: none`
13. Caret right icon when closed
14. Button reads "查看範例" when closed
15. Multiple field examples on same page all default closed

**Open state (10):**
16. Click toggle adds `.open` class
17. Open: body `display: block`
18. Caret swaps to caret-down icon
19. Button text swaps to "收起範例"
20. AI fetch starts on first open
21. Spinner + fallback shown while loading
22. AI text replaces fallback when loaded
23. Result cached in `AppState.circlesExamplesCache`
24. Cache key: `sessionId|step|field`
25. Subsequent opens use cache (instant)

**Close + reopen (5):**
26. Click toggle when open closes (caret right, text "查看範例")
27. Body classes back to no `.open`
28. Reopen does NOT trigger refetch
29. Reopen instantly displays cached AI result
30. Switching steps does NOT clear cache (until new session)

**AI content quality (10):**
31. AI example specific to current company
32. Example length 50-90 chars
33. Example does NOT start with "例：" or "範例："
34. Example does NOT have markdown bullets
35. Example does NOT have "首先" / "我會" prefix
36. Example reflects field-specific shape (per FIELD_SHAPES table)
37. AI failure: shows fallback hint + error note
38. AI failure: cache NOT populated (so retry works)
39. No-session case: shows fallback only
40. Each (step, field) gets unique example

**RWD + accessibility (10):**
41. Toggle button keyboard accessible (Tab focus)
42. Enter key activates toggle
43. Space key activates toggle
44. Toggle has visible focus outline
45. Touch target ≥ 44px height
46. Body text readable on small screens
47. Body padding adequate
48. Body background distinct from form
49. Border-left visual cue (per CSS)
50. No text overflow on long examples

---

## BATCH 11 — Phase 1.5 Gate (Screen 4)

**Spec lines:** 1031-1127 + Task D
**Focus:** Pass/fail UI, drill vs simulation, gate items
**Guest ID:** `audit-batch-11`

### Tests (50)

**Setup:** Submit Phase 1 form to reach gate.

**Common structure (10):**
1. Navbar shows "框架審核中" or "框架審核結果"
2. Navbar has back arrow
3. Navbar has 回首頁 button (REGRESSION — was missing)
4. Loading state shows spinner during AI gate
5. Loading state max ~30s
6. After load: gate result displays
7. Result has transition bar at top (color-coded)
8. Result has gate items list
9. Result has action buttons at bottom
10. Failed AI gate shows error + retry

**Pass state (10):**
11. Green transition bar with ✓ icon
12. Bar text "可以進入 Phase 2" or similar
13. Each item has status badge (ok/warn)
14. Item shows criterion + reason + suggestion
15. 繼續 button (primary blue)
16. Click 繼續 sets phase to 2
17. Click 繼續 navigates to Phase 2 dialogue
18. Drill mode: 繼續 always available on pass
19. Simulation mode: 繼續 always available on pass
20. NO 返回修改 button on pass

**Fail state — drill (10):**
21. Red transition bar with ✗ icon
22. Bar text "需要修正方向" or similar
23. Error items have red border
24. Error items show feedback + suggestion
25. Drill mode + canProceed=false shows ONLY 返回修改 button
26. NO 繼續 button visible (drill + error)
27. 返回修改 button is primary
28. Click 返回修改 sets phase back to 1
29. Form draft preserved on return
30. Error items list scrollable on small screens

**Fail state — simulation (10):**
31. Simulation mode + errors: BOTH 繼續 + 返回修改 buttons
32. 繼續 in sim with errors labeled "帶著風險繼續" or similar
33. Click 繼續 in sim with errors still advances to Phase 2
34. Warning items distinguished from errors visually
35. Mixed warn/error/ok statuses render correctly
36. Suggestion only shown for warn/error (not ok)
37. Suggestion text trimmed at reasonable length
38. Items numbered or sequenced clearly
39. Item count matches expected (4 for most steps, 3 for L)
40. Status colors: green=ok, yellow=warn, red=error

**Schema validation (5):**
41. Frontend handles missing items gracefully
42. Frontend handles unknown status values
43. Frontend handles null suggestion
44. Frontend handles empty feedback
45. Frontend handles items count != 4 (warn/error log)

**RWD (5):**
46-50. Gate renders at 320/390/480/768/1024 without overflow

---

## BATCH 12 — Phase 2 Dialogue: States 1-3

**Spec lines:** 1128-1310
**Focus:** Chat states (waiting, active, collapsed strip), icebreaker, bubbles
**Guest ID:** `audit-batch-12`

### Tests (50)

**Setup:** Pass gate to reach Phase 2.

**Initial state (10):**
1. Navbar shows "{step} — 對話練習"
2. Navbar has back arrow + 回首頁 button (REGRESSION)
3. Icebreaker card shown first (`.circles-icebreaker`)
4. Icebreaker text matches CIRCLES_STEP_CONFIG[step].icebreaker
5. NO chat bubbles initially
6. Input bar visible at bottom
7. Send button disabled when input empty
8. Send button enabled when input has text
9. NO submit row (turns < 3)
10. NO conclusion box

**State 1 — turn 1-2 (10):**
11. Type in input + send → user bubble appears
12. AI bubble appears with streaming text
13. AI response parses 【被訪談者】 / 【教練點評】 / 【教練提示】
14. 教練提示 collapsed by default (toggle button)
15. Click 查看教練提示 expands
16. Click again collapses
17. Multiple turns stack chronologically
18. Auto-scroll to latest message
19. Send during streaming disables input
20. Streaming error shows "連線錯誤，請重試"

**State 2 — turn ≥3 (10):**
21. After 3 turns, submit row appears
22. Submit row has "對話足夠了，提交這個步驟" pill
23. Pill click does NOT submit immediately
24. Pill click expands conclusion box (state 4)
25. Pill is sticky/visible above input
26. Pill text doesn't break on small screen
27. Pill has primary background
28. Click pill while typing in input doesn't submit text
29. Pill keyboard accessible
30. Multiple turns past 3 don't dup the pill

**State 3 — collapsed strip (10):**
31. Choose collapsed strip path (after pill click maybe)
32. Strip shows label + sub-text + expand button
33. Strip more compact than full conclusion box
34. Click expand transitions to state 4
35. Strip preserves any draft text
36. Strip shown when AppState.circlesSubmitState = 'collapsed'
37. Strip hides when expanded
38. Strip visible at all 5 breakpoints
39. Strip touch target ≥ 44px
40. Strip animation smooth (no jump)

**Icebreaker per step (10):**
41. C1 icebreaker mentions "廣告過多"
42. I icebreaker mentions "用戶分群"
43. R icebreaker mentions "三層需求"
44. C2 icebreaker mentions "業務限制"
45. L icebreaker mentions "方案方向"
46. E icebreaker mentions "風險" or "顧慮"
47. S icebreaker mentions "推薦邏輯" or "指標"
48. Icebreaker rendered ONLY once at top
49. Icebreaker NOT duplicated after turns
50. Icebreaker text non-empty for all 7 steps

---

## BATCH 13 — Phase 2 Dialogue: Submit + AI Detection

**Spec lines:** 1311-1405
**Focus:** Conclusion box, 8s AI detection, submit flow
**Guest ID:** `audit-batch-13`

### Tests (50)

**Conclusion box state 4 (15):**
1. Conclusion box appears after pill click
2. Title text matches CIRCLES_STEP_CONFIG[step].conclusionSub
3. Sub-text + placeholder per step
4. Textarea rows ≥ 5
5. Submit button shown
6. Submit button disabled by default
7. Cancel/back button collapses to strip (state 3)
8. Background dimming on chat behind (`opacity: 0.45`)
9. Chat has `pointer-events: none` (not clickable behind box)
10. Click outside box does NOT close
11. Conclusion textarea autofocuses
12. Conclusion text saves to `circlesConclusionText`
13. Saved text persists if user closes + reopens
14. Conclusion example block visible (collapsible)
15. Example shows step-specific example text

**8-second AI detection (15):**
16. Type in textarea + wait 8s → AI detection fires
17. Detection calls /:id/conclusion-check
18. While waiting: no hint shown
19. Pass detection: green hint "✓ 結論完整..."
20. Pass detection: submit button enabled
21. Warn detection: yellow hint "⚠ 結論缺..."
22. Warn detection: submit button disabled
23. Editing text resets the 8s timer (debounce)
24. Detection only fires after 8s of inactivity
25. Detection failure: shows error
26. Detection result step-specific (mentions correct dimensions)
27. Hint specifies WHICH dimension is missing (warn case)
28. Pass conditions per step (e.g., S checks NSM definition)
29. Empty textarea does NOT trigger detection
30. Very short text (< 30 chars) shows warn

**Submit flow (10):**
31. Click submit calls /:id/evaluate-step
32. Submit button shows loading state
33. Submit disabled during request
34. On success: phase → 3, show step score
35. On success: `circlesScoreResult` populated
36. On success: `circlesStepScores[stepKey]` cached
37. On failure: error shown, button re-enabled
38. Failure preserves conclusion text
39. Submit clears `circlesConclusionText` on success
40. Submit clears `circlesSubmitState` on success

**Cross-step (5):**
41. Different steps have different example texts in conclusion
42. Conclusion box title varies per step
43. Submit different step → different evaluator response
44. Submit on last step (S) sets up final report
45. Submit on non-last step (sim) advances simStep

**Edge cases (5):**
46. Type then delete back to empty: detection clears hint
47. Very long conclusion (1000+ chars): submit still works
48. Special chars / emoji: handled correctly
49. Submit during streaming: blocked or queued
50. Network failure during submit: clear error message

---

## BATCH 14 — Step Score (Screen 6)

**Spec lines:** 1406-1618
**Focus:** Score display, dim bars, score nav, coach toggle, continue button
**Guest ID:** `audit-batch-14`

### Tests (50)

**Setup:** Complete Phase 1 + Phase 2 to reach step score.

**Score header (10):**
1. Navbar shows "{step} 評分結果"
2. Navbar has 回首頁 button
3. Score number uses Instrument Serif font
4. Score number 64px+ size
5. Score is integer 0-100
6. "/100" label next to score
7. Score subtext shows step name
8. Header has card styling
9. Header centered
10. Loading state if score not yet loaded

**4-dimension breakdown (10):**
11. 4 dimension rows render
12. Each row has dimension name (per STEP_RUBRICS)
13. Each row has visual bar
14. Bar fill width = score/5 × 100%
15. Bar fill color = primary blue
16. Bar background = light gray
17. Score "X/5" displayed
18. Comment text ≤ 20 chars per spec
19. Comment specific to user's response (not generic)
20. All 4 dimensions for current step (vary by step)

**Highlight cards (5):**
21. Best move card (green border)
22. Best move text from `result.highlight`
23. Improvement card (orange border)
24. Improvement text from `result.improvement`
25. Both cards visible side-by-side or stacked

**Coach toggle (10):**
26. 教練解說 button visible
27. Default state: collapsed
28. Click toggle expands coach content
29. Caret swaps direction
30. Coach content from `result.coachVersion`
31. Drill mode: short hint (not full answer)
32. Simulation mode: full demo answer
33. Toggle state persisted across re-renders
34. Coach content scrollable if long
35. Coach content has line-height 1.6+

**Score nav (simulation only) (10):**
36. Score nav visible only in simulation mode
37. ◀ button shows prev step name
38. ▶ button shows next step name
39. Click ◀ switches to prev step's cached score
40. Click ▶ switches to next step's cached score
41. ◀ disabled at first step (C1)
42. ▶ disabled at last cached step
43. Score nav switches WITHOUT refetch
44. Score nav preserves coach toggle state
45. Drill mode: NO score nav row

**Continue button (5):**
46. Drill mode: button text "再練一次"
47. Drill mode click resets phase to 1
48. Simulation mode + non-last: button text "繼續下一步：{next}"
49. Simulation last step (S): button text "看完整總結報告"
50. Click final report fetches /:id/final-report

---

## BATCH 15 — NSM Step 1: Selection + Context

**Spec lines:** 6584-6693 + Task F frontend
**Focus:** NSM home, 5 random questions, AI context card, navigation
**Guest ID:** `audit-batch-15`

### Tests (50)

**Setup:** Click 北極星指標 in navbar OR NSM banner on circles home.

**NSM home structure (10):**
1. Navbar shows "北極星指標 (NSM) 訓練"
2. Back arrow on navbar (returns to circles)
3. Title "選一題開始 NSM 訓練"
4. Sub-text mentions "情境導讀"
5. 隨機選題 button visible
6. 5 NSM question cards rendered
7. Cards from NSM_QUESTIONS array
8. Cards show company + industry + scenario
9. CTA button "開始 NSM 訓練" disabled initially
10. NO context card shown initially

**Random questions (10):**
11. Default render: 5 random NSM_QUESTIONS
12. Click 隨機選題 picks new 5
13. New 5 different from old 5 (probabilistic, but expected)
14. 隨機選題 does NOT navigate
15. 隨機選題 clears any selected question
16. 隨機選題 clears any loaded context
17. 隨機選題 disables CTA again
18. Cards render in same DOM position (no flicker)
19. Cards keyboard accessible
20. Cards touch target ≥ 44px

**Question selection (10):**
21. Click question card sets `nsmSelectedQuestion`
22. Selected card has visual highlight
23. Click triggers context API call
24. Loading state shows in card area
25. Loading text "分析情境中…" or similar
26. Context fetches from /api/nsm-context (or session-scoped)
27. Failed fetch shows error in card
28. Subsequent click re-fetches (or uses cache)
29. Click different card cancels prior fetch
30. CTA enables only after context loaded

**Context card content (10):**
31. Context card shows 4 rows
32. Row 1: 商業模式 (label + value)
33. Row 2: 使用者 (label + value)
34. Row 3: 常見陷阱 (red text)
35. Row 4: 破題切入 (blue bold)
36. Trap row uses RED color (var(--c-text) or similar)
37. Insight row uses PRIMARY color (BLUE)
38. Insight row bold
39. Each row has icon prefix
40. Field names match API response (model/users/traps/insight) — REGRESSION

**CTA + nav (10):**
41. Click 開始 NSM 訓練 advances to NSM Step 2
42. Advance creates NSM session
43. Advance preserves selected question + context
44. Advance navigates to step 2 sub-tab
45. Back arrow returns to circles home
46. Back clears NSM state
47. RWD: 320px renders without overflow
48. RWD: 768px renders correctly
49. RWD: 1024px desktop layout OK
50. Multiple sessions don't interfere (use unique guestId)

---

## BATCH 16 — NSM Steps 2-3 + Gate

**Spec lines:** 6694-6875 + Task D
**Focus:** NSM define, gate review, breakdown, sub-tabs, 回首頁
**Guest ID:** `audit-batch-16`

### Tests (50)

**Setup:** Complete NSM Step 1 to reach Step 2.

**Sub-tabs (10):**
1. 3 sub-tabs visible at top
2. Tab 1: "步驟 2：定義 NSM"
3. Tab 2: "NSM 審核"
4. Tab 3: "步驟 3：拆解指標"
5. Default active: 步驟 2
6. NSM 審核 disabled until step 2 submitted
7. 步驟 3 disabled until gate passed
8. Click active tab does nothing
9. Click disabled tab does nothing
10. Switch tab does NOT lose current draft

**Step 2 form (15):**
11. Navbar shows "定義 NSM"
12. Navbar has 回首頁 button (REGRESSION)
13. Problem card shows question
14. Field 1: 北極星指標 (single-line input)
15. Field 1 placeholder mentions "一句話定義"
16. Field 2: 量化描述 / 定義說明 (textarea)
17. Field 3: 與業務目標的連結 (textarea)
18. Each field has 查看範例 toggle
19. Examples specific to current question
20. Submit button at bottom
21. Submit disabled when fields empty
22. Submit calls /:id/gate
23. Gate request includes nsm + rationale
24. Loading state during gate
25. After response: switches to NSM 審核 tab

**Gate result (15):**
26. Pass: green header "可以進入下一步" or similar
27. Pass: 4 gate items with status badges
28. Pass: 繼續到 步驟3 button
29. Pass click navigates to 步驟 3 sub-tab
30. Fail: red header "需要修正"
31. Fail: error items with feedback + suggestion
32. Fail: 返回修改 button only
33. Fail click switches back to 步驟 2
34. Form draft preserved on return
35. Gate item suggestion shown for warn/error only
36. 4 criteria: NSM定義清晰度 / 業務連結 / 可測量性 / 非虛榮指標
37. Each criterion with status icon
38. canProceed=false ONLY when any error
39. Schema valid (4 items, each with required fields)
40. Failed AI returns user-friendly error

**Step 3 form (10):**
41. Navbar shows "拆解指標"
42. Navbar has 回首頁 button
43. NSM summary card visible at top
44. 4 dimension inputs (廣度/深度/頻率/業務影響)
45. Each saves to nsmBreakdownDraft[dim]
46. Submit calls /:id/evaluate
47. After eval: navigates to NSM Step 4
48. Loading state during eval
49. Empty inputs allowed (warn maybe)
50. RWD all breakpoints

---

## BATCH 17 — NSM Step 4 Result

**Spec lines:** 6876-7206
**Focus:** Score display, 4 tabs, radar, comparison, highlights
**Guest ID:** `audit-batch-17`

### Tests (50)

**Setup:** Complete NSM 1-3 to reach Step 4.

**Header (10):**
1. Navbar shows "NSM 報告"
2. House icon back button
3. Score summary bar at top
4. Total score (Instrument Serif large)
5. "/100" label
6. Company name displayed
7. Score = (alignment + leading + actionability + simplicity + sensitivity) × 4
8. Score range 20-100
9. Loading state if scores undefined
10. Error state if eval failed

**Tab bar (10):**
11. 4 tabs: 總覽 / 對比 / 亮點 / 完成
12. Default active: 總覽
13. Click tab switches content
14. Active tab styled distinct
15. Tab persists in `AppState.nsmReportTab`
16. Reload preserves active tab? (depends on impl)
17. Each tab has unique content
18. Tabs scrollable on small screen if needed
19. Tab keyboard accessible
20. Tab touch target ≥ 44px

**Overview tab (10):**
21. Radar SVG renders
22. Radar shows 5 axes (alignment/leading/actionability/simplicity/sensitivity)
23. Radar values match scores
24. 5 dimension rows below radar
25. Each row: name + bar + score
26. Each row has expandable comment
27. Comment text from coachComments[dim]
28. Comments specific to user's NSM
29. RWD: radar scales correctly
30. NO console errors

**Comparison tab (10):**
31. Header "對比" shown
32. Coach NSM tree node visible
33. Click node toggles detail
34. 4 dim children of NSM node
35. Each child shows coach value
36. Each child expandable (shows rationale)
37. User's input shown alongside coach
38. Toggle state in `nsmOpenNode`
39. Default expanded node (NSM root)
40. RWD: tree readable on mobile

**Highlights + Export (10):**
41. Highlights tab shows best move + main trap
42. Best move card (green) with text
43. Main trap card (orange) with text
44. Summary card with overall verdict
45. Each card has clear visual separation
46. Export tab shows action buttons
47. 再練一次 button resets NSM state
48. 回首頁 button navigates to circles
49. NO 去 CIRCLES 練習 button (per spec — was prescribed wrong)
50. RWD all breakpoints

---

## BATCH 18 — Auth + Offcanvas History

**Spec lines:** 7207-7237 + Task E
**Focus:** Auth screens, offcanvas, history, navigation
**Guest ID:** `audit-batch-18`

### Tests (50)

**Auth screens (15):**
1. Click 登入 in navbar opens auth screen
2. Auth screen has email + password fields
3. Email field type="email"
4. Password field type="password"
5. Submit button labeled appropriately
6. Toggle between login/register
7. Back link navigates to circles (NOT home) — REGRESSION
8. Failed login shows error
9. Successful login navigates to circles
10. Register flow creates user
11. Logout button visible when authenticated
12. Logout clears session
13. Logout returns to circles
14. Auth state persists across reloads
15. Email visible in navbar when authenticated

**Offcanvas open/close (10):**
16. Click hamburger button opens offcanvas
17. Offcanvas slides in from left (or right)
18. Backdrop overlay shown
19. Click backdrop closes offcanvas
20. Click X button closes offcanvas
21. ESC closes offcanvas
22. Open offcanvas locks body scroll
23. Multiple opens/closes work
24. Offcanvas keyboard accessible
25. Tab focus trapped inside open offcanvas

**Offcanvas list (15):**
26. Empty state if no sessions
27. List shows guest sessions (if guest)
28. List shows user sessions (if auth)
29. Each item shows company / type
30. Each item shows date (NOT "Invalid Date") — REGRESSION
31. Date uses created_at OR updated_at fallback — REGRESSION
32. Date format zh-TW
33. Sessions sorted by date descending
34. Click session loads + navigates
35. Click session shows loading state
36. Click session opacity 0.6 during load
37. Successful load navigates to saved phase
38. Failed load restores opacity
39. Multiple sessions render correctly
40. List scrollable if > viewport

**Delete session (5):**
41. Long-press or button to delete (per UI)
42. Delete confirms before action
43. Confirmed delete removes from list
44. Delete error shows message
45. Confirm dialog navigates to circles (NOT home) — REGRESSION

**RWD (5):**
46-50. Offcanvas at 320/390/480/768/1024 (full-width on small, partial on large)

---

## BATCH 19 — Cross-Screen Navigation + State Persistence

**Spec lines:** 7596-7606 + various
**Focus:** Navigation between screens, state preservation, edge cases
**Guest ID:** `audit-batch-19`

### Tests (50)

**Navigation rules (15):**
1. Auth back → navigate('circles') NOT 'home'
2. Offcanvas delete → navigate('circles')
3. NSM step 1 back → navigate('circles')
4. NSM step 1 back also clears circlesSession (REGRESSION)
5. CIRCLES home: NO back button
6. NSM step 4 home → navigate('nsm') (resets NSM state)
7. NSM step 2 home → navigate('nsm') (resets state)
8. NSM step 3 home → navigate('nsm')
9. CIRCLES gate home → navigate('circles')
10. CIRCLES phase 2 home → navigate('circles')
11. CIRCLES step score home → navigate('circles')
12. Phase 1 form 回首頁 → circles
13. Phase 1 form 返回選題 → circles
14. NO `navigate('home')` calls anywhere in app.js (REGRESSION)
15. Hash/route updates correctly per navigation

**State preservation (15):**
16. Phase 1 draft preserved on 提示 overlay open/close
17. Phase 1 draft preserved on 查看範例 toggle
18. Phase 2 conversation preserved on conclusion box open
19. Phase 2 conclusion text preserved on collapse/expand
20. Step pills selection preserved on type tab change
21. Mode selection preserved across page reloads (localStorage)
22. circlesStepScores persisted to backend (PATCH /progress)
23. circlesStepDrafts persisted (E/S need it)
24. circlesFrameworkDraft persisted on each input
25. Resume after reload restores all draft fields
26. Resume after reload restores circlesScoreResult (REGRESSION)
27. Resume from phase 3 with no cache → phase 2 fallback (REGRESSION)
28. NSM context cached in AppState (refresh = refetch)
29. Examples cache persists per session
30. Logout clears all sensitive state

**Async race conditions (10):**
31. Click resume → click another card immediately → 1st cancelled or both work
32. Click 隨機選題 → click question → no broken state
33. Submit form → click back → form not double-submitted
34. Hint open → switch step → hint closes properly
35. Multiple tab opens (browser tabs) → independent state
36. Network slow + click navigation → graceful loading
37. AI response slow + user navigates away → no stale render
38. Streaming SSE + navigation → connection closed
39. Phase 2 stream + close conclusion box → stream still works
40. Page reload during AI fetch → no stuck state

**Deep link / URL (5):**
41. Direct URL to /circles works
42. Direct URL to /nsm works
43. Refresh on Phase 1 keeps user on Phase 1 (if session)
44. Refresh without session goes to home
45. Bookmark + revisit works

**Multiple sessions (5):**
46. Create 2+ circles sessions: each independent
47. Switch between sessions via offcanvas works
48. Old session preserved after switching
49. Concurrent edits in 2 tabs (last write wins)
50. Guest mode + auth: separate sessions

---

## BATCH 20 — Errors, Edge Cases, Accessibility

**Focus:** Error handling, edge inputs, accessibility, performance
**Guest ID:** `audit-batch-20`

### Tests (50)

**Error handling (15):**
1. AI 401 → shows "請重新登入" or auth required
2. AI 429 (rate limit) → shows backoff message
3. AI 500 → shows "暫時失敗，請重試"
4. AI timeout (>30s) → shows timeout
5. Network offline → shows offline indicator
6. Backend 404 (session not found) → shows "找不到 session"
7. Backend 403 (forbidden) → shows access denied
8. Bad JSON response → shows parse error
9. Empty AI response → shows generic error
10. Malformed step in /hint request → 400 invalid_step
11. Field too long (>40 chars) → 400 invalid_field
12. NSM length cap (>2000) → 400 input_too_long
13. Cancelled fetch (user navigated) → no error toast
14. Concurrent identical requests → deduped or both succeed
15. Backend down (no response) → graceful loading state ends

**Edge cases — input (10):**
16. Empty textarea + submit → blocked or warned
17. 1000+ char textarea → truncated or accepted
18. Special chars (<, >, &, ', ") → escaped, no XSS
19. Emoji in input → stored + displayed correctly
20. RTL text → stored + displayed
21. Newlines in input → stored as \n
22. Whitespace-only input → trimmed or blocked
23. Paste large text → handled
24. Type very fast → no input lost
25. Type while saving → debounced save

**Edge cases — display (10):**
26. Very long company name → truncated with ellipsis
27. Very long question text → wraps or truncates
28. Score = 0 → renders "0" not blank
29. Score = 100 → renders "100"
30. Score = NaN (bad data) → renders "—" or fallback
31. Empty step_scores → no error
32. Missing question_json → graceful fallback
33. Missing user → guest mode
34. Old session schema → migrated or fallback
35. Future session schema → forwards-compat

**Accessibility (10):**
36. Lang attribute on <html> = "zh-TW"
37. Title attribute on icon-only buttons
38. Aria-label on icon-only buttons
39. Form labels associated (for/id)
40. Focus visible on all interactive
41. Tab order logical
42. Skip-to-content link (if applicable)
43. Color contrast WCAG AA (text vs background)
44. No info conveyed by color alone
45. Screen reader announces dynamic updates (aria-live)

**Performance (5):**
46. First paint < 2s on local
47. Interactive < 3s on local
48. CLS < 0.1 (no layout shift)
49. No console errors on initial load
50. Memory leak check (open + close 50 hint overlays)

---

## END OF MASTER PLAN

Total tests: 1000
Coverage areas: 20
Spec line refs: ~150
Estimated execution time per agent: 30-60 min
Critical bugs expected to be found: 10-30
