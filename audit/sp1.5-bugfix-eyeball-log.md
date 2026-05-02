# SP1.5-bugfix Director Eyeball Log

**Date:** 2026-05-02
**Director:** albertpeng678 (pending personal walk-through)
**Mockup ref:** [`docs/superpowers/specs/mockups/2026-05-02-sp1.5-stale-bugfix/F-stale-bugfix.html`](../docs/superpowers/specs/mockups/2026-05-02-sp1.5-stale-bugfix/F-stale-bugfix.html)
**Production:** http://localhost:4000 (worktree `feat/sp1.5-bugfix` HEAD = a1a5bfe)

## Pre-walk state

| Item | Status |
|---|---|
| Spec | ✅ docs/superpowers/specs/2026-05-02-sp1.5-stale-bugfix-design.md |
| Mockup | ✅ F-stale-bugfix.html v4.x (production CSS via link) |
| Plan | ✅ docs/superpowers/plans/2026-05-02-sp1.5-stale-bugfix-plan.md (22 tasks) |
| Implementation | ✅ T1-T16 + 2 follow-ups (16 commits) |
| Jest | ✅ 131/131 (incl. 6 sp1.5-bugfix-* tests) |
| Playwright | ✅ 126/126 sp1.5-bugfix specs across 8 viewports + 34/34 SP1/SP1.5 regression |
| iOS checklist | ✅ 15/15 PASS or N/A |
| Mockup diff | ✅ 12/12 PASS |
| Console clean | ✅ verified mid-development (no new warn/error introduced) |

## Walk-through checklist (director to mark)

### Mobile-360 (iPhone simulator or real device)

- [ ] Login `albertpeng678@gmail.com` / `21345678`
- [ ] Restore stale session b715898 (Spotify Podcast snapshot)
- [ ] **F-1 P1**: Confirm single 1-line `.stale-locked-bar` (no separate locked-banner + stale-banner)
- [ ] **F-1 P2**: Confirm chat-body has more vertical room than before
- [ ] **F-1 P3**: Scroll to bottom of chat — last bubble fully visible above sticky bar
- [ ] **F-1 P3'**: Tap question chip to expand — full content (商業背景 / 用戶輪廓 / 常見誤區 / 破題切入) scrollable, last section visible
- [ ] **F-1 UX**: Tap 上一步 → lands on phase 1 read-only (with original framework draft)
- [ ] **F-3**: From phase 2 stale, tap 回首頁 → lands on CIRCLES home (question grid), NOT legacy PM 思維訓練 (入門/進階/困難)

### Phase 3 stale (drill mode)

- [ ] Open phase 3 score result (where stale flag is set)
- [ ] **F-2 button**: Bottom 回首頁 button is solid blue with white text (NOT round grey-circle)
- [ ] **F-2 drill-encourage**: No 「再練一次」 鼓勵卡 visible (suppressed in stale)
- [ ] Tap 上一步 → returns to phase 2 read-only
- [ ] Tap 回首頁 → CIRCLES home

### Desktop-1280 (Chrome / Safari)

- [ ] **D-1 chrome**: navbar / circles-nav / progress / banner all extend to viewport edges (no left/right beige bg)
- [ ] **D-1 body**: chat-body / score-wrap / form-body centered with max 920px
- [ ] Phase 1 normal: same chrome-full / body-centered layout
- [ ] Phase 2 normal: same
- [ ] Phase 3 normal: same

### Desktop-1440 + Desktop-2560

- [ ] **D-1 >=1440 extension**: Confirm phase 2/3 chrome STILL full-width (not reverted to old 1180 max-width)
- [ ] body-centered still 920 in middle

### Cross-cut

- [ ] No JS console errors
- [ ] No CSS errors / undefined variables
- [ ] Feels visually consistent with mockup F-stale-bugfix.html
- [ ] Stale + non-stale both work; toggle via session restore behaves correctly

## Verdict

(To be filled in by director after walk-through. If all items checked: `## VERDICT: ✅ APPROVED — proceed to 14-box gate`)

## Notes
(Free-form findings — file follow-up issues if any)
