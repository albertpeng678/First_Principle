# Audit Acceptance Criteria — 2026-04-30

This document defines observable, testable acceptance criteria for every P0 and P1 issue in `audit/issues-master.md`.
Each section maps to ONE `test()` in `tests/playwright/journeys/audit/audit-master.spec.js`.

P2 entries are documented for traceability but have no associated spec.
P3-runner-artefact rows are skipped — they are runner changes, not product fixes.

---

## CLUSTER-A — Wide-monitor layout (>=1440 fluid grid)

### AUD-000-A — Desktop home cramped at >=1440
**Severity:** P0
**Acceptance:**
- At Desktop-1440 and Desktop-2560, `.circles-home-desktop` content occupies >=70% of viewport width.
- No `.circles-q-card-company` line wraps to >2 lines at >=1440.
**Out of scope:** Mobile / tablet home layout, content copy.
**Fix-cluster:** CLUSTER-A
**Test ID:** AUD-000-A

### AUD-003 — CIRCLES Step C single narrow column at >=1440
**Severity:** P0
**Acceptance:**
- At Desktop-2560, the CIRCLES Step C content area (form wrapper) is >=1600px wide.
- Form uses 2-column grid (>=2 textareas per row visible) at >=1440px.
**Out of scope:** Mobile / tablet column behaviour.
**Fix-cluster:** CLUSTER-A
**Test ID:** AUD-003

### AUD-004 — NSM Step 1 single-column at >=1440
**Severity:** P0
**Acceptance:**
- At Desktop-1440 / Desktop-2560, `.nsm-question-list` lays out >=3 cards per row (computed grid OR cards on same y-line).
**Out of scope:** Card content, copy.
**Fix-cluster:** CLUSTER-A
**Test ID:** AUD-004

### AUD-005 — review-examples cramped at >=1440
**Severity:** P0
**Acceptance:**
- At Desktop-2560, `/review-examples.html` lays out >=3 cards per row.
- Card body text computed font-size >=16px.
**Out of scope:** Mobile cramping (covered by AUD-030/AUD-048).
**Fix-cluster:** CLUSTER-A
**Test ID:** AUD-005

### AUD-006 — Login page small card with empty space on desktop
**Severity:** P0
**Acceptance:**
- At Desktop-1280 / Desktop-1440 / Desktop-2560, login card is vertically centred (top edge >= 20% of viewport height) OR layout switches to 2-column hero+form.
**Out of scope:** Login form content.
**Fix-cluster:** CLUSTER-A
**Test ID:** AUD-006

### AUD-013 — CIRCLES home middle column squeezed at 1280
**Severity:** P1
**Acceptance:**
- At Desktop-1280 and Desktop-1440, no `.circles-q-card-company` line wraps (offsetHeight roughly equals 1 line-height).
**Out of scope:** Card body description.
**Fix-cluster:** CLUSTER-A
**Test ID:** AUD-013

### AUD-031 — iPad home phone-stretched
**Severity:** P1
**Acceptance:**
- At iPad (768x1024), `.circles-home-desktop` or its inner grid uses >=2 columns of question cards.
**Out of scope:** Phone layout.
**Fix-cluster:** CLUSTER-A
**Test ID:** AUD-031

### AUD-030 — review-examples on iPad squeezed
**Severity:** P1
**Acceptance:**
- At iPad portrait (768), `/review-examples.html` cards have computed font-size >=15px AND >=2 cards per row.
**Out of scope:** Phone layout.
**Fix-cluster:** CLUSTER-A
**Test ID:** AUD-030

---

## CLUSTER-B — Sticky bar / header collisions

### AUD-001 — CIRCLES Step C bottom sticky bar covers textarea
**Severity:** P0
**Acceptance:**
- After scrolling to bottom of CIRCLES Step C, the last textarea bottom y is above the `.circles-submit-bar` top y.
- Body computed `padding-bottom` (or main scroll container) >= height of `.circles-submit-bar`.
**Out of scope:** NSM (covered by AUD-054).
**Fix-cluster:** CLUSTER-B
**Test ID:** AUD-001

### AUD-002 — CIRCLES Step C top sticky header overlaps labels on iPhone-SE
**Severity:** P0
**Acceptance:**
- At iPhone-SE, scrolling to a section heading inside Step C does not place the heading under the sticky `.navbar` (heading top y >= navbar bottom y).
**Out of scope:** Other viewports.
**Fix-cluster:** CLUSTER-B
**Test ID:** AUD-002

### AUD-029 — iOS keyboard occludes bottom sticky bar
**Severity:** P1
**Acceptance:**
- Programmatic surrogate: when a Step C textarea is focused, the `.circles-submit-bar` either gets a `data-kb-open` / `keyboard-open` attribute OR its bottom y is above visualViewport.height (no sticky bar overlapping focused textarea).
**Out of scope:** Real iOS device; using viewport surrogate.
**Fix-cluster:** CLUSTER-B
**Test ID:** AUD-029

### AUD-054 — NSM Step 2 sticky bar overlaps content
**Severity:** P1
**Acceptance:**
- At iPhone-SE on NSM Step 2, the form scroll-padding-bottom equals or exceeds the sticky bottom bar height (no content occluded).
**Out of scope:** CIRCLES (AUD-001).
**Fix-cluster:** CLUSTER-B
**Test ID:** AUD-054

### AUD-060 — iPad sticky footer too tall (P2 polish)
**Severity:** P2
**Acceptance (no test):** Sticky footer condenses or hides on scroll-down at iPad portrait.
**Fix-cluster:** CLUSTER-B

---

## CLUSTER-C — Nav consistency

### AUD-000-B — Top nav `北極星指標` duplicated
**Severity:** P1
**Acceptance:**
- Across all routes, the top navbar contains exactly ONE element whose visible text equals `北極星指標`.
**Out of scope:** Side menu / offcanvas.
**Fix-cluster:** CLUSTER-C
**Test ID:** AUD-000-B

### AUD-007 — review-examples missing app top nav
**Severity:** P0
**Acceptance:**
- `/review-examples.html` renders a `.navbar` element identical in structure to `/` (logo button visible AND `北極星指標` reachable).
**Out of scope:** Sidebar.
**Fix-cluster:** CLUSTER-C
**Test ID:** AUD-007

### AUD-033 — Step pages lose top-nav active state
**Severity:** P1
**Acceptance:**
- Inside CIRCLES Step C, exactly one `.navbar-tab` carries the `active` class AND has `aria-current="page"` (or equivalent).
**Out of scope:** Visual styling.
**Fix-cluster:** CLUSTER-C
**Test ID:** AUD-033

### AUD-034 — Login page still shows `登入` in nav
**Severity:** P1
**Acceptance:**
- On `/?login=1`, the navbar primary CTA is hidden OR its text is `建立帳號` (not `登入`).
**Out of scope:** Login form content.
**Fix-cluster:** CLUSTER-C
**Test ID:** AUD-034

---

## CLUSTER-D — NSM mode routing & headers

### AUD-008 — NSM tab routing fails on mobile/iPad
**Severity:** P0
**Acceptance:**
- After clicking the visible `北極星指標` nav element on iPhone-SE / iPad, the URL or DOM shows NSM mode (a `.nsm-question-list` exists OR `body[data-view="nsm"]`).
**Out of scope:** Visual highlight.
**Fix-cluster:** CLUSTER-D
**Test ID:** AUD-008

### AUD-009 — NSM steps reuse CIRCLES C header
**Severity:** P0
**Acceptance:**
- Within `?mode=nsm` step screens, no element contains the literal text `C - 澄清情境` or `C · 澄清情境`.
- A NSM-specific progress label (e.g. `情境` / `指標` / `拆解`) is present.
**Out of scope:** CIRCLES headers.
**Fix-cluster:** CLUSTER-D
**Test ID:** AUD-009

### AUD-040 — NSM Step 1 shows only 4 cards
**Severity:** P1
**Acceptance:**
- `.nsm-question-card` count on Step 1 equals exactly 5.
**Out of scope:** Reshuffle behaviour.
**Fix-cluster:** CLUSTER-D
**Test ID:** AUD-040

### AUD-016 — NSM 4-step indicator missing labels
**Severity:** P1
**Acceptance:**
- Each `.nsm-progress-step` element has a sibling/inside text label among (情境 / 指標 / 拆解 / 總結), OR an `aria-label` containing one of those words.
**Fix-cluster:** CLUSTER-D
**Test ID:** AUD-016

### AUD-037 — NSM Step 1 disabled CTA gives no hint
**Severity:** P1
**Acceptance:**
- While `#btn-nsm-step1-next` is disabled, a helper text element is visible on the page containing `請先選擇` (any phrasing of "please select first").
**Fix-cluster:** CLUSTER-D
**Test ID:** AUD-037

---

## CLUSTER-E — Jargon expansion (CIRCLES letters, glossary)

### AUD-011 — First-screen jargon dump on home
**Severity:** P0
**Acceptance:**
- The first viewport of `/` contains visible text expanding both `CIRCLES` (with C/I/R/C/U/T/L/E/S letter map) AND `NSM` (N/S/M expansion or `北極星指標` plain explanation).
**Out of scope:** Content style.
**Fix-cluster:** CLUSTER-E
**Test ID:** AUD-011

### AUD-012 — CIRCLES step pages never expand the letter
**Severity:** P0
**Acceptance:**
- On CIRCLES Step C entry, the page contains visible text matching either `Comprehend` or `Clarify` (English origin) AND the Chinese gloss `澄清情境`.
**Fix-cluster:** CLUSTER-E
**Test ID:** AUD-012

### AUD-035 — `代理變數` jargon
**Severity:** P1
**Acceptance:**
- On NSM Step 3 page (where the term appears), if `代理變數` is rendered, an inline glossary tooltip / explanation containing `可量化` or `代表` is rendered nearby (within 200px of the term).
**Fix-cluster:** CLUSTER-E
**Test ID:** AUD-035

---

## CLUSTER-F — Tap targets <44px on mobile/touch

### AUD-020 — Step C rich-text toolbar icons
**Severity:** P1
**Acceptance:**
- At iPhone-SE / iPhone-15-Pro / iPad, every visible toolbar button inside Step C (e.g. `.rt-mtbtn`) has bounding-box width >=44 AND height >=44.
**Fix-cluster:** CLUSTER-F
**Test ID:** AUD-020

### AUD-021 — `提示` lightbulb tap target
**Severity:** P1
**Acceptance:**
- On touch viewports inside Step C, every `提示` button has bounding-box height >=44 and is spaced >=8px from the adjacent `查看範例` element.
**Fix-cluster:** CLUSTER-F
**Test ID:** AUD-021

### AUD-022 — Top nav buttons <44px
**Severity:** P1
**Acceptance:**
- At iPhone-SE / iPhone-15-Pro, `#btn-hamburger` and the navbar primary CTA each have width >=44 AND height >=44.
**Fix-cluster:** CLUSTER-F
**Test ID:** AUD-022

### AUD-023 — Resume card close button
**Severity:** P1
**Acceptance:**
- When a resume card is shown on iPhone-15-Pro, its `.dismiss` button has width >=44 AND height >=44 AND distance from `.resume-go` >=12px.
**Fix-cluster:** CLUSTER-F
**Test ID:** AUD-023

### AUD-024 — Mode chips <44px
**Severity:** P1
**Acceptance:**
- At iPhone-15-Pro, `.circles-mode-card` (or chip elements) each have height >=44.
**Fix-cluster:** CLUSTER-F
**Test ID:** AUD-024

### AUD-051 — `查看範例` not tappable-looking
**Severity:** P1
**Acceptance:**
- At iPhone-SE inside Step C, every `查看範例` element has height >=44 AND has either a visible border OR a chevron icon child.
**Fix-cluster:** CLUSTER-F
**Test ID:** AUD-051

### AUD-055 — Hamburger no label
**Severity:** P1
**Acceptance:**
- `#btn-hamburger` has aria-label containing `練習記錄` OR an adjacent visible text label (e.g. `紀錄`).
**Fix-cluster:** CLUSTER-F
**Test ID:** AUD-055

### AUD-062 — Header buttons borderline (P2 dup)
**Severity:** P2
**Note:** Covered by AUD-022 acceptance.

---

## CLUSTER-G — Copy consistency

### AUD-017 — Step C placeholders tautological
**Severity:** P1
**Acceptance:**
- Each Step C textarea placeholder contains either `例如` / `例：` (concrete example) AND a length hint (`句` or digits like `2-3` / `30-50字`).
**Fix-cluster:** CLUSTER-G
**Test ID:** AUD-017

### AUD-018 — Intermediate step CTA still says `送出評分`
**Severity:** P1
**Acceptance:**
- On a CIRCLES intermediate step (not 7/7), the primary submit CTA text is `下一步` (or contains it). The string `送出評分` only appears on step 7/7.
**Fix-cluster:** CLUSTER-G
**Test ID:** AUD-018

### AUD-019 — Validation message doesn't name fields
**Severity:** P1
**Acceptance:**
- After submitting Step C with empty fields, the error message text contains a specific field label name (e.g. `問題範圍` / `業務影響`).
**Fix-cluster:** CLUSTER-G
**Test ID:** AUD-019

### AUD-041 — Placeholder mentions Netflix when seed is Shopee
**Severity:** P1
**Acceptance:**
- When the seed question company is NOT `Netflix`, the rendered Step C placeholders do NOT contain the literal text `Netflix`.
**Fix-cluster:** CLUSTER-G
**Test ID:** AUD-041

### AUD-042 — No first-timer recommendation
**Severity:** P1
**Acceptance:**
- The home contains a `新手推薦` (or `Recommended`) badge somewhere on a mode card.
**Fix-cluster:** CLUSTER-G
**Test ID:** AUD-042

### AUD-043 — Mixed `Email` + `密碼` labels
**Severity:** P1
**Acceptance:**
- On `/?login=1`, the email field label is `電子郵件` (not literal `Email`).
**Fix-cluster:** CLUSTER-G
**Test ID:** AUD-043

### AUD-058 — `提示` repeated 4 times (P2)
**Severity:** P2
**Note:** No spec; copy polish.

### AUD-057 — Welcome CTA aggressive (P2)
**Severity:** P2
**Note:** No spec; copy polish.

### AUD-059 — `全 7 步` claim unverified (P2)
**Severity:** P2
**Note:** No spec.

---

## CLUSTER-H — Progress bar labels & a11y

### AUD-015 — CIRCLES progress segments lack letter labels
**Severity:** P1
**Acceptance:**
- Each `.circles-progress-seg` either has visible text content matching one of `C/I/R/U/T/L/E/S`, or an `aria-label` containing one of those letters / step Chinese gloss.
**Fix-cluster:** CLUSTER-H
**Test ID:** AUD-015

### AUD-052 — `1/7` progress demoralising
**Severity:** P1
**Acceptance:**
- Step C header area contains visible text containing `25-35` (estimate) AND either `自動儲存` or `暫停`.
**Fix-cluster:** CLUSTER-H
**Test ID:** AUD-052

### AUD-046 — Auto-save indicator too small
**Severity:** P1
**Acceptance:**
- The auto-save indicator (text containing `儲存中` or `已儲存`) has computed font-size >=14px AND aria-live attribute on its container.
**Fix-cluster:** CLUSTER-H
**Test ID:** AUD-046

---

## CLUSTER-I — Misc per-issue

### AUD-014 — `前往 NSM →` button overlaps card body
**Severity:** P1
**Acceptance:**
- At Desktop-1280 and Desktop-1440, `.nsm-banner-btn` (or the `前往 NSM` button) bounding box does not overlap with sibling text elements; full label visible (text equals `前往 NSM →` or `前往 NSM 訓練`).
**Fix-cluster:** CLUSTER-I
**Test ID:** AUD-014

### AUD-025 — Login tab a11y
**Severity:** P1
**Acceptance:**
- On `/?login=1`, the active tab has `aria-selected="true"` AND a non-fill differentiator (font-weight or text-decoration: underline).
**Fix-cluster:** CLUSTER-I
**Test ID:** AUD-025

### AUD-026 — Offcanvas perpetual skeleton
**Severity:** P1
**Acceptance:**
- After clicking `#btn-hamburger`, within 1500ms the offcanvas-list contains either text `載入中…`, an empty-state copy (`你還沒` or `尚未`), or actual list items — not bare skeletons.
**Fix-cluster:** CLUSTER-I
**Test ID:** AUD-026

### AUD-027 — Offcanvas backdrop too light
**Severity:** P1
**Acceptance:**
- After opening offcanvas, `.offcanvas-overlay` computed background-color alpha >=0.5 OR `<main>` has `inert` attribute.
**Fix-cluster:** CLUSTER-I
**Test ID:** AUD-027

### AUD-028 — Offcanvas X overlaps banner
**Severity:** P1
**Acceptance:**
- After opening offcanvas at Desktop-1280, `#btn-offcanvas-close` bounding box does not intersect any element with class containing `banner` or `notice`.
**Fix-cluster:** CLUSTER-I
**Test ID:** AUD-028

### AUD-032 — Hint affordances hover-only on iPad
**Severity:** P1
**Acceptance:**
- At iPad inside Step C, every `提示` and `查看範例` element has either visible `border` (computed border-width > 0) or a visible icon child without requiring hover.
**Fix-cluster:** CLUSTER-I
**Test ID:** AUD-032

### AUD-036 — Search input no placeholder/icon
**Severity:** P1
**Acceptance:**
- At Desktop-1280 home, the search input element has a non-empty `placeholder` attribute AND a sibling/inner search icon (e.g. `i.ph-magnifying-glass`).
**Fix-cluster:** CLUSTER-I
**Test ID:** AUD-036

### AUD-038 — Collapsed `什麼是 CIRCLES` row gives no hint
**Severity:** P1
**Acceptance:**
- At iPhone-SE on home, the `什麼是 CIRCLES 實戰訓練?` row contains a chevron icon OR a `展開` text affordance.
**Fix-cluster:** CLUSTER-I
**Test ID:** AUD-038

### AUD-039 — Random shuffle gives no feedback
**Severity:** P1
**Acceptance:**
- After clicking `#circles-random-btn`, within 800ms the page contains an `aria-live` announcement OR a transient loading/animation indicator (class containing `loading` / `shuffling`).
**Fix-cluster:** CLUSTER-I
**Test ID:** AUD-039

### AUD-044 — Login lacks 忘記密碼 / show-toggle
**Severity:** P1
**Acceptance:**
- On `/?login=1`, the page contains a visible link/button with text `忘記密碼` AND a password toggle button (>=44x44).
**Fix-cluster:** CLUSTER-I
**Test ID:** AUD-044

### AUD-045 — Email/password input attrs missing
**Severity:** P1
**Acceptance:**
- The email input has `type=email`, `inputmode=email`, `autocomplete=email`. Password field has a show/hide toggle button.
**Fix-cluster:** CLUSTER-I
**Test ID:** AUD-045

### AUD-047 — Home decision overload
**Severity:** P1
**Acceptance:**
- At iPhone-SE, the first viewport (above 667px scroll) contains exactly ONE element with class containing `btn-primary` (the primary CTA), other primary buttons collapsed.
**Fix-cluster:** CLUSTER-I
**Test ID:** AUD-047

### AUD-048 — review-examples mobile cramped
**Severity:** P1
**Acceptance:**
- At iPhone-SE on `/review-examples.html`, gap between adjacent `.card` elements >=12px.
**Fix-cluster:** CLUSTER-I
**Test ID:** AUD-048

### AUD-049 — review-examples no pagination
**Severity:** P1
**Acceptance:**
- `/review-examples.html` provides a search input AND a step filter; OR initially renders <=20 cards (lazy/paginated).
**Fix-cluster:** CLUSTER-I
**Test ID:** AUD-049

### AUD-050 — Question card description wall on phone
**Severity:** P1
**Acceptance:**
- At iPhone-SE, every `.circles-q-card-stmt` is truncated (computed `-webkit-line-clamp: 1` OR scrollHeight ~ one line).
**Fix-cluster:** CLUSTER-I
**Test ID:** AUD-050

### AUD-053 — Loading transition into Step C lacks spinner
**Severity:** P1
**Acceptance:**
- During CIRCLES Step C entry navigation, a spinner element with class containing `spinner` / `loading` is briefly visible OR text `載入題目` appears.
**Fix-cluster:** CLUSTER-I
**Test ID:** AUD-053

### AUD-061 — Login lacks Apple/Google SSO (P2)
**Severity:** P2
**Note:** No spec.

### AUD-056 — Title font mismatch (P2)
**Severity:** P2
**Note:** No spec.

---

## CLUSTER-J — Console-error free

### AUD-010 — First-page-load 404
**Severity:** P0
**Acceptance:**
- Loading `/` produces zero console errors AND zero failed network requests (status >=400) on every viewport.
- Loading `/review-examples.html` produces zero console errors AND zero 404s.
**Out of scope:** Subsequent navigation errors.
**Fix-cluster:** CLUSTER-J
**Test ID:** AUD-010

---

## P3-runner-artefact rows
- **AUD-063** — fill all required textareas in `journey-runner.spec.js`. Runner change, not product.
- **AUD-064** — emit screenshots 13–16 reliably on every project. Runner change, not product.
