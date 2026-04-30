# Home Question Card + Mobile Truncation + Phase 2 Conclusion Sticky — Design

**Date:** 2026-04-30
**Author:** session 5 (Windows)
**Scope:** Three small UI fixes raised together because the user reviewed the post-redesign live build and caught them in one screenshot pass.

## Background

After commit `4c62c12` shipped the new CIRCLES progress bar, field affordance row, and navbar fixes, the user reported three more issues:

1. **Home question card** — the collapsed preview text and the expanded "full" text are identical, so the "看更多" reveal feels redundant. The user wants the card's brief preview to carry distinct, useful detail (company / product / question type / difficulty), and the full problem statement to appear only after expansion in a clearly framed block.
2. **Mobile question text truncation** — the JS `slice(0, 60) + '…'` cuts mid-character on Chinese viewports, producing visually awkward line breaks. The user wants natural truncation that respects the rendering width.
3. **Phase 2 desktop conclusion box** — when the conclusion box expands, the textarea + 確認提交 / ← 繼續對話 buttons fall below the viewport on shorter desktops. Submit is reachable only by scrolling inside the conclusion box, which the user did not realise was scrollable.

User explicitly chose options **A1 + B1 + C1** from the visual mockups.

## Out of scope

- Editing the 100-question JSON DB to add a `summary` field — the brief is derived from existing fields (`company`, `product`, `question_type`, `difficulty`, `problem_statement`).
- The "教練點評 → 查看教練提示" inline-onclick fix and the "繼續對話 → null state" fix are already shipped in commit `4c62c12`. Not redone here.
- Phase 1.5 gate / Phase 3 score conclusion-style boxes — different markup, no reported issue.

## Approach

### A1 — Home question card: company / product / type / difficulty + line-clamp brief

Replace the current `renderQCardHtml` markup so the collapsed preview shows distinct chrome from the expanded view:

```html
<div class="circles-q-card" data-qid="…">
  <div class="circles-q-card-tags">
    <span class="circles-q-card-company">Spotify</span>
    <span class="circles-q-card-product">Spotify Podcast</span>
    <span class="circles-q-card-tag">產品設計</span>
    <span class="circles-q-card-tag">中等難度</span>
  </div>
  <div class="circles-q-card-stmt">
    設計一個新功能，提升用戶在 Spotify 上的 Podcast 體驗，並增加用戶的黏著度。
  </div>
  <div class="circles-q-card-more-wrap">
    <span class="circles-q-card-more">看完整題目 ▾</span>
  </div>
  <div class="circles-q-card-expand-area" hidden>
    <div class="circles-q-card-full-block">
      <div class="circles-q-card-full-label">完整題目</div>
      <div class="circles-q-card-full-text">設計一個新功能，提升用戶在 Spotify 上的 Podcast 體驗，並增加用戶的黏著度。</div>
    </div>
    <!-- drillPracticeHtml + 確認 / 取消 buttons (unchanged) -->
  </div>
</div>
```

Key differences from the current implementation:

- Top tags: `company` (filled badge), `product` (outline badge if present), `question_type` (translated 產品設計 / 產品改進 / 產品策略), `difficulty` (translated 簡單 / 中等難度 / 困難).
- The `.circles-q-card-stmt` is no longer mutated by `expandQCard` — it always renders the full `problem_statement` clamped via CSS to 2 lines (B1 below). No JS substring.
- The expand area now uses a clearly framed `.circles-q-card-full-block` wrapping the full text under a "完整題目" label so the expanded text feels like a separate section rather than a duplicate of the collapsed text.

`question_type` to label map (already exists in app.js but only as 產品設計 / 改進 / 策略 — confirm):
- `design` → 產品設計
- `improve` → 產品改進
- `strategy` → 產品策略
- `unknown` → fallback hidden

`difficulty` to label map:
- `easy` → 簡單
- `medium` → 中等難度
- `hard` → 困難
- missing/unknown → tag hidden

CSS additions (see `public/style.css`):

```css
[data-view="circles"] .circles-q-card-tags {
  display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px;
}
[data-view="circles"] .circles-q-card-company {
  /* existing primary badge style — re-applied here */
}
[data-view="circles"] .circles-q-card-product {
  display: inline-flex; align-items: center;
  padding: 3px 10px; border-radius: 14px;
  background: #fff; border: 1px solid rgba(26,86,219,0.3);
  color: var(--c-primary); font-size: 11.5px;
}
[data-view="circles"] .circles-q-card-tag {
  display: inline-flex; align-items: center;
  padding: 3px 8px; border-radius: 4px;
  background: var(--c-bg, #f7f5f0);
  color: var(--c-text-2); font-size: 11px;
}
[data-view="circles"] .circles-q-card-full-block {
  background: var(--c-bg, #f7f5f0);
  border-radius: 8px;
  padding: 10px 12px; margin-top: 6px;
}
[data-view="circles"] .circles-q-card-full-label {
  font-size: 10.5px; color: var(--c-text-2); font-weight: 600;
  text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;
}
[data-view="circles"] .circles-q-card-full-text {
  font-size: 13px; color: var(--c-text); line-height: 1.7;
}
```

`expandQCard` simplifies — only toggle the expand area + hide 看完整題目 prompt. No `dataset.full` swap needed.

### B1 — CSS line-clamp for the brief

Replace the current 60-char JS truncation with CSS:

```css
[data-view="circles"] .circles-q-card-stmt {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  /* font / colour rules from existing block */
}
```

Drop the `data-full / data-short / shortStmt / slice(0, 60)` logic from `renderQCardHtml`. The card always renders the full statement; CSS clips to 2 lines with native ellipsis. On wider desktop layouts, the clamp still applies (2 lines is the chosen density regardless of viewport — keeps the cards uniform height in the question grid).

### C1 — Phase 2 conclusion: sticky-bottom action row

Wrap `.conclusion-actions` in a sticky-bottom container inside `.circles-conclusion-box`:

```css
[data-view="circles"] .circles-conclusion-box .conclusion-actions {
  position: sticky;
  bottom: 0;
  margin: 0 -14px -14px;          /* extend over .circles-conclusion-box padding */
  padding: 10px 14px;
  background: #fff;               /* opaque so scrolled textarea text doesn't bleed */
  border-top: 1px solid var(--c-border);
}
```

Result: when `circles-conclusion-box` overflow scrolls (textarea content tall + short viewport), the action row stays pinned at the box's bottom edge so 確認提交 is always one click away. No change to JS; the `id` and click handlers already work.

The existing `.circles-conclusion-box { max-height: 65vh; overflow-y: auto }` stays in place — it bounds the box to a sane size and lets internal scroll do its job.

## Testing

### Failing tests (TDD red phase)

Add to `tests/playwright/journeys/audit/audit-master.spec.js`:

- **AUD-058 [P1]** Home question card has company + product + question_type + difficulty tags.
  Asserts `.circles-q-card-company`, `.circles-q-card-product` (when q.product present), and ≥ 1 `.circles-q-card-tag` (question_type or difficulty) in the FIRST card.

- **AUD-059 [P1]** Collapsed `.circles-q-card-stmt` uses CSS line-clamp 2 (no JS substring).
  `getComputedStyle(stmt).webkitLineClamp === '2'` (or `display === '-webkit-box'`); `stmt.dataset.full` should NOT exist; `stmt.textContent === q.problem_statement` (full text, untrimmed).

- **AUD-060 [P1]** Expanded card shows full text in a labelled "完整題目" block, separate from the (still-clamped) brief.
  After clicking 看完整題目: `.circles-q-card-full-block` is visible; its label is "完整題目"; its text content is `q.problem_statement`. The original `.circles-q-card-stmt` keeps clamp-2 styling (i.e. brief + full block both visible — but the brief never duplicates the full text in the SAME formatting).

- **AUD-061 [P1]** Phase 2 conclusion-actions are sticky-bottom inside the conclusion box.
  Force into `submitState='expanded'`, screenshot at Desktop-1280 with viewport height 700px. Compute `getBoundingClientRect()` of `.conclusion-actions`: `bottom <= conclusionBox.bottom + 1` AND `getComputedStyle(actions).position === 'sticky'`.

### Cross-device / cross-size coverage (mandated by user)

After all four AUD-058..061 land green, re-run the full audit dir:

```
PMDRILL_BASE_URL=http://localhost:4000 npx playwright test \
  --config=tests/playwright/playwright.config.js journeys/audit/ --workers=4
```

Pass criterion: 0 failures across all 8 viewport projects (Mobile-360 / iPhone-SE / iPhone-14 / iPhone-15-Pro / iPad / Desktop-1280 / Desktop-1440 / Desktop-2560) plus the legacy Desktop alias.

`audit/rwd-grid/<project>/01-home-guest.png` PNGs regenerate to reflect the new card chrome — visually inspect the iPhone-SE and Desktop-2560 home views to confirm the brief reads cleanly at both ends of the viewport range.

Add a new route to `rwd-visual-gate.spec.js`:

- **`09-phase2-conclusion-expanded`** — entered by setting `AppState.circlesSubmitState = 'expanded'` after seeding Phase 2; full-page screenshot to verify the sticky action row at the bottom of the conclusion box.

## Risks

- **Question DB might lack `difficulty`** — the schema dump showed `"difficulty": "medium"`. Verify all 100 rows have it; if not, the `circles-q-card-tag` for difficulty is hidden when missing (defensive `if (q.difficulty) { ... }` guard).
- **product missing for some questions** — same defensive guard for `.circles-q-card-product`.
- **`question_type` enum drift** — dump showed `"design"`. Other rows might use 中文 strings directly (e.g. `"產品設計"`) or new keys. The mapping must fall back gracefully (no tag rendered) when key not in the map.
- **Sticky bottom in Safari iOS** — `position: sticky` on a flex parent works in modern Safari, but the existing `circles-conclusion-box` is also a flex item. If a regression appears on iPhone-SE, fall back to `position: absolute; bottom: 0; left: 0; right: 0` inside a `position: relative` wrapper.
- **Line-clamp display change** — if the brief is single-line on a very wide desktop, `-webkit-line-clamp:2` still reserves 2 lines worth of height, leaving an empty second line. Acceptable trade-off for uniform card height; cards visually match in the grid.

## Acceptance criteria

1. First-paint home: every visible question card shows at least company badge + product badge (if present) + at least one of { question_type, difficulty } tag.
2. Collapsed brief in `.circles-q-card-stmt` is the FULL `problem_statement`, clamped to 2 lines via CSS, ellipsis at line 2 end. No JS substring.
3. Clicking 看完整題目 reveals a "完整題目" labelled block whose contents are the full `problem_statement`. The clamped brief stays visible above it.
4. In Phase 2 expanded conclusion, the 確認提交 / ← 繼續對話 row is always within the conclusion box's visible scrollport at every viewport from 360 to 2560 with browser height ≥ 600px.
5. `audit-master` + `rwd-visual-gate` pass with 0 failures across all 8 viewport projects.

## Files to touch (summary)

- `public/app.js` — rewrite `renderQCardHtml`; remove `dataset.full / dataset.short` swap in `expandQCard`; ensure `expandQCard` only toggles the expand-area visibility now.
- `public/style.css` — add tag classes (`circles-q-card-tags / -product / -tag / -full-block / -full-label / -full-text`); add line-clamp on `.circles-q-card-stmt`; add sticky-bottom rule for `.circles-conclusion-box .conclusion-actions`.
- `tests/playwright/journeys/audit/audit-master.spec.js` — add AUD-058 / 059 / 060 / 061.
- `tests/playwright/journeys/audit/rwd-visual-gate.spec.js` — add `09-phase2-conclusion-expanded` route.
- `audit/rwd-grid/**` — regenerated PNGs (auto by spec run).

## Out-of-scope follow-ups

- Visual / motion polish on the expand-area (slide-down rather than abrupt show) — not blocking.
- Pagination / infinite-scroll for the question grid at 100+ items — separate feature ask.
