# Eyeball Walk — Stats 0/0/0 + Restore Drift Hotfix

**Date:** 2026-05-07
**Reviewer:** Opus (director, cold review)
**Spec:** `docs/superpowers/specs/2026-05-07-stats-and-restore-fix-design.md`
**Plan:** `docs/superpowers/plans/2026-05-07-stats-and-restore-fix.md`
**Commits under review:** `e01dcc0` → `ee7975f` (8 commits — Bundle 1 Bug A + Bundle 2 Bug B)
**Mockup contracts:** `01-circles-home.html` §A stats-strip, `03-phase-1-form.html` §A four-field form

---

## 0. Verification matrix (8-viewport Playwright sweep)

| Spec | Viewports | Result |
|---|---|---|
| `tests/visual/home-stats-guest.spec.js` (4 specs) | Mobile-360 / iPhone-SE / iPhone-14 / iPhone-15-Pro / iPad / Desktop-1280 / Desktop-1440 / Desktop-2560 | **32/32 ✓** |
| `tests/visual/restore-no-drift.spec.js` (11 specs) | same 8 viewports | **88/88 ✓** |
| `tests/visual/offcanvas-item-click-restore.spec.js` (15 specs) regression baseline | Desktop-1280 | **15/15 ✓** |
| `npm test` jest | n/a | **160/160 ✓** (157 baseline + 3 new from `tests/guest-circles-stats.test.js`) |

---

## 1. Stats-strip × 3 viewport (Bug A repro state)

Setup: guest user, `/api/circles-stats` returns 401, `/api/guest-circles-stats` stubbed to `{completed:5, active:2, weeklyCompleted:3}`. Backend pre-fix would render `0 已完成 · 0 進行中 · 0 本週`.

### 1.1 `stats-Mobile-360.png`
Mobile-360 — top of viewport renders **「5 已完成 · 2 進行中 · 3 本週」** with chart icon prefix. Numerals navy, labels muted greyscale, dot separator centered. Layout matches mockup `01-circles-home.html` line 856-872 mobile variant; long hint suppressed at this width per CSS.

### 1.2 `stats-iPad.png`
iPad — stats-strip renders **「5 已完成 · 2 進行中 · 3 本週」** plus the tablet short hint suffix **「已完成 5 / 100 題」** on the right side, matching mockup line 906 tablet rule. Both columns inline on the same row, baseline aligned, no overflow.

### 1.3 `stats-Desktop-1280.png`
Desktop-1280 — full strip renders **「5 已完成 · 2 進行中 · 3 本週」** plus the desktop long hint **「已完成 5 / 100 題 · 持續 4 週連續練習」** matching mockup line 999 desktop rule. The `streakWeeks` placeholder default value of 4 is shown (backend doesn't yet expose this field — pre-existing behaviour, unchanged by this hotfix).

**Pass.** Three-viewport responsive variants render identical numerical content with progressive enhancement of the hint suffix at tablet then desktop, exactly matching mockup 01.

---

## 2. C1 Phase 1 form partial-restore × 3 viewport (Bug B repro state)

Setup: `framework_draft.C1 = { '問題範圍': '聚焦免費版的廣告體驗，排除付費方案', '時間範圍': '測試' }`. Two of four fields populated; idx 2 and idx 3 deliberately empty to test the drift bait. Pre-fix would have shown 「測試」 in 業務影響 (idx 2) via the now-removed `Object.values(...)[fieldIdx]` positional fallback.

### 2.1 `restore-c1-Mobile-360.png`
Mobile-360 — Phase 1 form rendered post-restore. Four fields, top to bottom:
- **問題範圍:** 「聚焦免費版的廣告體驗，排除付費方案」 — restored, char-counter shows `17 / 120` correctly
- **時間範圍:** 「測試」 — restored to the correct slot (this is the exact text the user originally typed and reported drifting)
- **業務影響:** empty, placeholder text 「廣告收入和免費...付費轉換率不能下降超過 3%」 visible in light grey via `:empty::before`
- **假設確認:** empty, placeholder 「用戶廣告負感主要來自時段而非廣告本身」 visible in light grey

**No drift.** The fix prevents 「測試」 from leaking into idx 2 / idx 3. Submit-bar 「下一步」 sticky at bottom right, matching mockup 03 line 1055.

### 2.2 `restore-c1-iPad.png`
iPad — same content layout, tablet typography (slightly larger heading and body text, narrower gutters). No rail on tablet per mockup 03 §A. All four fields render with identical mapping to mobile — 問題範圍 + 時間範圍 filled; 業務影響 + 假設確認 placeholder. Submit-bar sticky bottom-right.

### 2.3 `restore-c1-Desktop-1280.png`
Desktop-1280 — same content + right-side rail. The rail card 「C 步重點」 shows 「確認題目邊界 / 先把題目本身定義清楚 — 它的具體類型是什麼？涵蓋哪些場景？...」 verbatim from `CIRCLES_STEP_CONFIG.C1.railBody`. Form column on the left, rail column on the right (~280px), no horizontal overflow. Submit-bar 「下一步」 floats above the form columns at bottom-right.

**Pass.** Three-viewport restore correctly maps 「測試」 to 時間範圍 (idx 1) on every layout. Empty fields show placeholder, not bleed-through content.

---

## 3. iOS Safari 15-item static review (Master Spec §0.2)

Walking the 15-item iOS quirk checklist against this hotfix's diff:

| # | Item | Hotfix relevance | Verdict |
|---|---|---|---|
| 1 | sticky position with `top:env(safe-area-inset-top)` | submit-bar already sticky; not modified | N/A pass |
| 2 | `min-height:44px` on tap targets | stats-strip is non-interactive; restore touches `.rt-textarea` (already `min-height` set per `data-rows`) | pass |
| 3 | `-webkit-tap-highlight-color:transparent` | not modified | N/A pass |
| 4 | momentum scroll on overflow lists | not modified | N/A pass |
| 5 | bottom-sheet drawer overscroll | not modified | N/A pass |
| 6 | `100vh` vs `100dvh` for full-screen modals | not modified | N/A pass |
| 7 | iOS focus zoom < 16px input font-size | contenteditable `.rt-textarea` already `font-size:16px` per design system | pass |
| 8 | input modes / autocomplete attrs | contenteditable, no input element | N/A pass |
| 9 | virtual keyboard pushing fixed elements | not modified | N/A pass |
| 10 | rubber-band overscroll on `body` | not modified | N/A pass |
| 11 | tap-to-focus on inputs after blur | restore writes `innerHTML` then no focus change — does not steal focus from user | pass |
| 12 | sticky `position:-webkit-sticky` fallback | not modified | N/A pass |
| 13 | font-feature-settings for Chinese stack | system-ui stack unchanged | pass |
| 14 | SSE reconnect on bg→fg transition | not modified | N/A pass |
| 15 | `event.preventDefault()` on form submit | not modified | N/A pass |

**Verdict: 15/15 pass / N/A.** Pure data-flow fix; no UX surface area touched. Mobile contenteditable + sticky submit-bar were last reviewed in Plan B SB9b — no regression here.

---

## 4. Cross-bug interaction smoke check

Both bugs ship in one branch. Cross-bug smoke:
- Bug A fix changes `loadCirclesStats` path. Bug B fix changes `populateTextareasFromDraft`. Different functions, different code paths, no shared mutable state.
- `tests/visual/restore-no-drift.spec.js` `stubAll()` helper stubs both `/api/circles-stats` and `/api/guest-circles-stats` (line 18-19) — confirming the offcanvas restore flow under both auth and guest stat paths.
- `tests/visual/offcanvas-item-click-restore.spec.js` (15 pre-existing specs) all green — the English-key fixtures used there continue working via the new ENGLISH_ALIAS read-only path (covers `boundaryScope`/`timeWindow`/`businessImpact`/`assumption`).

**No cross-bug regression.**

---

## 5. ENGLISH_ALIAS coverage cross-check (sonnet-reported, opus-verified)

`public/app.js` lines 2556-2563 ENGLISH_ALIAS map covers all 16 Chinese keys from `CIRCLES_STEP_CONFIG.{C1,I,R,C2}.fields[].key` (lines 346-407). Audit by direct read:

| Step | idx | Chinese key | ENGLISH_ALIAS value |
|---|---|---|---|
| C1 | 0/1/2/3 | 問題範圍 / 時間範圍 / 業務影響 / 假設確認 | boundaryScope / timeWindow / businessImpact / assumption |
| I  | 0/1/2/3 | 目標用戶分群 / 選定焦點對象 / 用戶動機假設(JTBD) / 排除對象 | targetSegment / focusGroup / jtbd / excluded |
| R  | 0/1/2/3 | 功能性 / 情感性 / 社交性 / 核心痛點 | functional / emotional / social / corePain |
| C2 | 0/1/2/3 | 取捨標準 / 最優先 / 暫緩 / 排序理由 | criteria / priority / defer / rationale |

16/16 keys covered. No gap.

---

## 6. Final verdict

**Ship-ready.** Both bugs fixed; 8 commits clean; 88+32+15+160 = 295 spec assertions green across viewports + jest; mockup alignment ✓; iOS 15-item ✓; cross-bug interaction ✓.

Pending: live port for user real-run + final CLAUDE.md update + final commit per Task 10.
