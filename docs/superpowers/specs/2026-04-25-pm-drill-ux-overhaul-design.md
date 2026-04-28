# PM Drill UX Overhaul — Design Spec

**Date:** 2026-04-25
**Scope:** Homepage IA restructure, full UI style unification, navigation fixes, AI hint system, NSM entry point, PM訪談 removal, question bank expansion, UIUX audit

---

## Context

The app currently has three training modules on a tabbed homepage (PM訪談, NSM, CIRCLES). Several UX issues were identified:

1. No way to return to the homepage once inside a quiz
2. Question bank shows only 1 question per category (only Spotify), giving the illusion of no real choice
3. The CIRCLES selection page doesn't surface the North Star metric training connection
4. The clarification step (C) is the highest drop-off point — users have no guidance when stuck
5. All pages outside CIRCLES use a purple/dark theme inconsistent with CIRCLES' warm light aesthetic
6. PM訪談 is being sunset — it should be removed from the product entirely
7. Dark mode creates tonal dissonance with the warm, editorial feel of CIRCLES

---

## 1. IA Restructure

**New entry point:** App loads directly into the CIRCLES selection page (previously `data-view="circles"`). Change `navigate('home')` throughout `app.js` to navigate to `'circles'` instead.  `renderHome()` is removed entirely — it previously managed the 3-tab dashboard, which no longer exists.

**Header (all pages):**
- Left: "PM Drill" wordmark (Instrument Serif, `#1A56DB`)
- Right: "北極星指標" text link → navigates to `data-view="nsm"` (NSM question selection screen), plus Login/Account button
- Remove: dark mode moon toggle

**Remove PM訪談 completely:**
- Remove `renderHome()`, `bindHome()`, `renderPractice()`, `bindPractice()`, `renderReport()`, `bindReport()` and all related AppState keys
- Remove routes: `routes/sessions.js`, `routes/guest-sessions.js`
- Remove route registrations in `server.js`
- Provide Supabase migration SQL (manual execution by developer)

**NSM entry page:** The first screen of the NSM flow (`data-view="nsm"`, renders `renderNSM()`) — the question selection screen. "回首頁" within NSM navigates here.

**Navigation rules:**
- From any CIRCLES training phase (1 / 1.5 / 2 / 3): "← 返回" goes to previous phase; "回首頁" navigates to `'circles'`
- From any NSM phase: "← 返回" goes to previous step; "回首頁" navigates to `'nsm'`
- CIRCLES selection page (`data-view="circles"`) has no "回首頁" — it is home
- `history` page: keep as-is, back button returns to `'circles'`

---

## 2. UI Style Unification

Apply the CIRCLES visual language globally — every page, every component.

**Color tokens (replace existing purple system globally):**

| Token | Value | Usage |
|-------|-------|-------|
| `--bg-primary` | `#F2F0EB` | Page background |
| `--bg-card` | `#ffffff` | Cards, inputs |
| `--accent` | `#1A56DB` | Primary buttons, links, active states |
| `--text-primary` | `#1a1a1a` | Body text |
| `--text-2` | `#5a5a5a` | Secondary text |
| `--text-3` | `#8a8a8a` | Placeholders, captions |
| `--border` | `#e8e5de` | Borders, dividers |

**Remove dark mode entirely:** Delete all `[data-theme="dark"]` CSS blocks and the theme toggle JS logic. Remove moon icon from header.

**Typography (already loaded, apply globally):**
- Headings / page titles: `Instrument Serif`
- All UI text (buttons, labels, body): `DM Sans`

**Pages to update:** CIRCLES (already correct), NSM wizard, login, register, history — all adopt the above tokens. Remove all `--bg-surface: #f5f5f5` and `--accent: #5a52e0` references.

---

## 3. Navigation Fixes

**"回首頁" button placement:**
- In CIRCLES nav bar (all phases): right side of the nav, text link style (`font-size: 12px; color: #1A56DB; border-bottom: 1px solid`)
- In NSM nav bar (all phases): same placement, links to NSM entry page

**Existing "← 返回" button:** Already present in all CIRCLES phases — no change needed to back logic.

---

## 4. AI Hint System (All 7 CIRCLES Steps)

**Trigger:** Each field in `renderCirclesPhase1()` gets a `💡 提示` text link at the top-right of its label row.

**Behavior:**
1. User clicks `💡 提示` on a specific field
2. POST to new endpoint `/api/circles-sessions/:id/hint` with `{ step, field }` (or guest equivalent)
3. Overlay appears: background dims, centered white card shows:
   - Title: `💡 {fieldName} — 分析思路`
   - Subtitle: `{company} · {product} · {step label}`
   - Hint text: short paragraph (2-4 sentences), question-specific, guidance-oriented, no answers
   - Bottom note: "閱讀後關閉，自行填寫你的分析"
   - × close button (top right)
4. No "套用" button — read-only guidance

**Hint generation prompt style:**
- Contextual to the specific question (company, product, problem_statement)
- Explains how to think about the field, not what to write
- Ends with why this scope/decision matters for subsequent CIRCLES steps
- ~60–100 words, Chinese, warm instructional tone

**New API endpoint:** `POST /api/circles-sessions/:id/hint` and `POST /api/guest-circles-sessions/:id/hint`
- Input: `{ step: "C1", field: "問題範圍" }`
- Output: `{ hint: "..." }` (non-streaming, single JSON response)
- Uses `question_json` from the session + step/field context to generate hint

**Applies to:** All 7 steps (C1, I, R, C2, L, E, S), all fields in each step.

---

## 5. NSM Entry Points

**① CIRCLES selection page — bottom banner:**
```
[S 步驟含北極星指標練習]  想做最完整的 NSM 定義訓練？  [前往 NSM →]
```
- Style: `background: #EEF3FF; border: 1px solid #C5D5FF; border-radius: 10px`
- Placed below the question card list, above the submit bar

**② S step annotation:**
In the CIRCLES step selector pills, the S pill gets a subtle label: `S 總結推薦 · 含 NSM`
In `renderCirclesPhase1()` for step S, add a small note above the fields:
> 「此步驟的北極星指標欄位是 NSM 訓練的濃縮版。想深入練習？前往 NSM 訓練 →」

---

## 6. Question Bank

`public/circles-db.js` pre-loaded with 100 questions (40 設計 / 35 改進 / 25 策略) across diverse companies. Developer generates via `node scripts/generate-circles-questions.js` before deploy. No user-facing UI for this — it's infrastructure.

The selection page type buttons update from `×1` to reflect actual counts (driven by filtering `CIRCLES_QUESTIONS` by `question_type`).

---

## 7. Supabase Migration (PM訪談 removal)

Provide the following SQL as a migration file `db/migrations/drop-pm-interview.sql` — **not auto-executed**, developer runs manually when ready:

```sql
-- Drop PM Interview tables (run only after confirming no active users)
DROP TABLE IF EXISTS practice_sessions;
DROP TABLE IF EXISTS guest_sessions;
```

---

## 8. UIUX Audit (Post-Implementation)

After all changes are complete, run a full Playwright audit covering:

**RWD breakpoints:** 375px (iPhone SE), 430px (iPhone Pro Max), 768px (iPad), 1280px (desktop)

**User journeys to validate:**
1. Guest opens app → lands on CIRCLES selection → selects mode/step/question → completes Phase 1 → Phase 1.5 → Phase 2 → Phase 3 → returns home
2. Guest clicks NSM from header → completes NSM session → returns to NSM home
3. Guest clicks NSM banner on CIRCLES page → lands on NSM
4. User clicks 💡 hint on C step field → overlay appears → closes → fills form
5. User in Phase 2 clicks 回首頁 → lands on CIRCLES selection
6. Login/register flow → lands on CIRCLES selection
7. All pages: no text overflow, no layout breaks, tap targets ≥ 44×44px

**Standard:** Must meet all criteria in `docs/superpowers/plans/2026-04-22-mobile-smoothness.md`

---

## Critical Files

| File | Changes |
|------|---------|
| `public/app.js` | Remove PM訪談 render/bind; add 回首頁 to all nav bars; add 💡 hint buttons + overlay; NSM banner + S annotation; update CIRCLES home as default view |
| `public/style.css` | Replace all purple tokens with CIRCLES blue+beige; remove dark mode blocks; apply globally |
| `public/circles-db.js` | Replace with 100-question bank |
| `routes/circles-sessions.js` | Add `/hint` endpoint |
| `routes/guest-circles-sessions.js` | Add `/hint` endpoint |
| `server.js` | Remove PM訪談 route registrations |
| `public/app.js` (NSM nav) | Add 回首頁 button to all NSM nav bars (`renderNSM`, `renderNSMStep1`–`renderNSMStep4`, results screen) |
| `routes/sessions.js` | Remove (PM訪談 auth routes) |
| `routes/guest-sessions.js` | Remove (PM訪談 guest routes) |
| `db/migrations/drop-pm-interview.sql` | New file — manual execution |
| `prompts/` | New `circles-hint.js` prompt file |

---

## Verification

1. Run `node scripts/generate-circles-questions.js` → confirm 100 questions in `circles-db.js`
2. Open app at all 4 breakpoints — confirm warm beige bg, blue primary, no dark mode toggle
3. Navigate all 7 user journeys above without layout breaks
4. Click 💡 on each CIRCLES step field → confirm overlay with contextual hint
5. Confirm PM訪談 tab/routes are fully gone (404 on old endpoints)
6. Run Playwright test suite → all tests green
