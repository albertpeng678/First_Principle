# Eyeball Walk — User NSM 4-Bug Visual Evidence (2026-05-11)

**Setup:** logged into local dev (port 4000) as `albertpeng678@gmail.com` via spec `tests/visual/capture-user-nsm-bugs.spec.js`. 3 viewports × 4 evidence types = 12 canonical PNGs + 6 helper PNGs (separate `homepage-stats-circles-*` and `homepage-stats-nsm-*` views) in `audit/png-user-nsm-bugs/`.

---

## Bug 4 — Homepage 進行中 count (CIRCLES + NSM strips)

**CIRCLES home stats-strip (`homepage-stats-circles-{vp}.png`):**
- Desktop-1280 / iPad / Mobile-360 all show `已完成 1 · 進行中 1 · 本週 0` (chart-bar icon + 3 numeric cells).
- Mobile-360 truncates strip to 3 cells without hint suffix, layout intact.

**NSM home view (`homepage-stats-{vp}.png` and `homepage-stats-nsm-{vp}.png`):**
- All 3 vp land on NSM step 1 question-selection screen ("選擇企業情境"), 4-step progress (情境 / 指標 / 拆解 / 總結) visible.
- Desktop / iPad show right rail label "近期練習" but rail body is empty (no NSM session cards rendered).
- **No stats-strip is rendered in the NSM view at any vp** (NSM home omits the chart-bar `已完成 / 進行中 / 本週` strip entirely; only the question-picker shows).
- Desktop/iPad title-row shows "共 103 題 · 隨機抽 5"; Mobile shows "5 題從 100+ 題庫中隨機抽選".

**Verdict:** Visible CIRCLES strip says **進行中 = 1** while offcanvas (next section) lists 2 CIRCLES + 2 NSM = 4 records (of which Spotify-CIRCLES + Netflix-CIRCLES + Zoom-NSM + Fiverr-NSM appear). The "Zoom 80 分" and "Fiverr 60 分" badges imply both NSM sessions are completed; only the unscored "Netflix · R 重新定義 · 草稿" looks like an in-progress draft. NSM view shows no count at all (no strip).

## Offcanvas history list

**All 3 vp identical** (`nsm-history-offcanvas-{vp}.png` + `OFFCANVAS_ITEMS_JSON` from spec console):
Drawer title "練習記錄", date-group header "更早", 4 items:
1. `Spotify · Spotify播放列表推薦` — CIRCLES · C 澄清 — 5/2
2. `Zoom` — NSM · 4 步 — 5/1 — **80 分** badge
3. `Netflix · Netflix Originals` — CIRCLES · R 重新定義 · 草稿 — 5/1
4. `Fiverr` — NSM · 4 步 — 4/22 — **60 分** badge

Mobile drawer width ~280px, desktop/iPad same. No `進行中` suffix on any NSM entry; scores present → NSM rows render as completed.

## Bug 1 — Restore-click landing

Clicked the first NSM record (`Zoom`, id `ee133f7e…`). Landing state captured via `LANDING_STATE_JSON` and `nsm-restore-after-click-{vp}.png`:

- All 3 vp: `view = "nsm"`, `nsmStep = 1`, `data-nsm-step = "1"`, heading "選擇企業情境", url `http://localhost:4000/`.
- Top-right tag updated: "已選：Zoom · SaaS 型" (Desktop/iPad) — so the click loaded the session but landed on **step 1 question-picker with Zoom pre-selected**, not on phase 1 (定義) form or step 4 score for the existing record.
- Filter rail auto-jumped to "全部 (103)" highlight and 6 SaaS questions in grid; bottom CTA reads "開始 NSM 訓練" → fresh-start path.
- Mobile-360 left rail collapsed; "已選 1" subtitle shows under "選擇題目".

**Verdict:** Restore-click does NOT land on phase 1 of the original Zoom question — it lands on the NSM step 1 question-selection screen with that session merely flagged as "已選". Matches user's report.

## Bug 3 — Phase 1 back button presence

`nsm-phase1-back-button-{vp}.png` is identical to the restore-click PNG (we did not advance past step 1; assertion forced `nsmStep=1` re-render but state was already there).

`BACK_BTN_CANDIDATES_JSON` at all 3 vp returns exactly one match: `aria-label="回首頁"`, class `navbar__icon-btn`, `data-nav="home"` (the house icon in the navbar top-right).

- Desktop/iPad navbar shows: hamburger | logo · "PM Drill" | CIRCLES / 北極星指標 tabs | email | logout icon | **home icon**.
- Mobile-360: hamburger | logo · "PM Drill" | logout icon | **home icon**. No dedicated back chevron.
- No `data-nav="back"` element, no breadcrumb-back, no in-page "← 返回" button.

**Verdict:** Only "回首頁" home icon exists; no contextual back button on NSM step 1. Tapping it goes to CIRCLES home (default `view='circles'`), not to the prior screen.

## Cross-vp consistency

- All 3 vp render identical content and reach identical landing states (`view=nsm / nsmStep=1`).
- Stats-strip only on CIRCLES home; absent on NSM home at all vp (uniform absence, not a layout-collapse bug).
- Offcanvas drawer width and item order identical across vp; mobile drawer overlays the page same as iPad/desktop.

---

## Files

- Spec: `tests/visual/capture-user-nsm-bugs.spec.js`
- Run: `npx playwright test --config=tests/visual/playwright.config.js tests/visual/capture-user-nsm-bugs.spec.js --project=Mobile-360 --project=iPad --project=Desktop-1280` → 3/3 PASS in 8.8s.
- PNGs: `audit/png-user-nsm-bugs/` (18 files, 12 canonical + 6 helper).
