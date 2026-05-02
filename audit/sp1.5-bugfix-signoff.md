# SP1.5-bugfix 14-box Sign-off Gate

**Date:** 2026-05-02
**Branch:** `feat/sp1.5-bugfix` (worktree at `/Users/albertpeng/Desktop/claude_project/first-principle-sp1.5-bugfix`)
**HEAD:** `a1a5bfe audit(sp1.5-bugfix): mockup vs production visual diff (12/12 PASS)` (16 commits ahead of main)
**Spec:** [`docs/superpowers/specs/2026-05-02-sp1.5-stale-bugfix-design.md`](../docs/superpowers/specs/2026-05-02-sp1.5-stale-bugfix-design.md)
**Plan:** [`docs/superpowers/plans/2026-05-02-sp1.5-stale-bugfix-plan.md`](../docs/superpowers/plans/2026-05-02-sp1.5-stale-bugfix-plan.md)
**Mockup:** [`docs/superpowers/specs/mockups/2026-05-02-sp1.5-stale-bugfix/F-stale-bugfix.html`](../docs/superpowers/specs/mockups/2026-05-02-sp1.5-stale-bugfix/F-stale-bugfix.html)

## Gate matrix

| # | Item | Evidence | Status |
|---|------|----------|--------|
| 1 | Spec 完整性 (design doc with §3 design rules + §6 testing) | `docs/superpowers/specs/2026-05-02-sp1.5-stale-bugfix-design.md` (committed `d338ccb`) | ✅ |
| 2 | Mockup vs production 視覺一致 | `audit/sp1.5-bugfix-mockup-diff.md` (12/12 PASS) | ✅ |
| 3 | Jest 全綠 | 131/131 incl. new sp1.5-bugfix-helpers (3) + sp1.5-bugfix-action-bar (3); pre-existing 2 OpenAI suite failures unrelated to changes | ✅ |
| 4 | Playwright 8-viewport 全綠 | 126/126 sp1.5-bugfix-*.spec.js + sp1.5-stale-session.spec.js across all 8 viewports (1.3m run) | ✅ |
| 5 | iOS Safari 15-item static checklist | `audit/sp1.5-bugfix-ios-checklist.md` (15/15 PASS or N/A) | ✅ |
| 6 | Console clean (no warn / error) | Verified during PW runs — no new console output introduced | ✅ |
| 7 | SP1 + SP1.5 baseline regression | 34/34 SP1 + SP1.5 specs PASS on Mobile-360 + Desktop-1280 (no regression) | ✅ |
| 8 | Mockup-spec-plan-impl 對齊 | All 4 docs cross-reference each other; mockup uses production CSS via `<link>` for 1:1 fidelity; plan tasks T1-T22 trace to spec §3 + §5 + §6 | ✅ |
| 9 | Guest + auth parity | All PW tests use `window.AppState` direct seeding (mode-agnostic — works for both guest/auth flows). No backend coupling changed. | ✅ |
| 10 | Desktop / mobile / tablet 三裝置 covered | 8 viewport classes cover Mobile-360 / iPhone-SE/14/15-Pro / iPad / Desktop-1280/1440/2560 — all 126 PW pass | ✅ |
| 11 | Stale + non-stale 雙模式驗證 | PW specs assert both: stale (banner-merged, action-bar, button-style, scroll-clearance) and non-stale (desktop-layout test 1 covers normal phase 2 chrome+body); jest covers stale flag both true and false in helpers | ✅ |
| 12 | F-1 / F-2 / F-3 / D-1 四個修正逐項驗收 | F-1 = banner-merged + scroll-clearance + action-bar specs; F-2 = button-style spec; F-3 = action-bar test 3 (回首頁 → CIRCLES home); D-1 = desktop-layout spec | ✅ |
| 13 | Director (albertpeng678) 親自簽收 | `audit/sp1.5-bugfix-eyeball-log.md` checklist prepared; director to walk through and check all items | ⏳ pending |
| 14 | Merge to main + push | Awaiting box 13 + explicit user "ship it" approval | ⏳ pending |

**Verdict so far: 12 / 14 PASS. Boxes 13 + 14 gated by director eyeball walk-through and explicit approval.**

## Commits (16 in `feat/sp1.5-bugfix` since main `d338ccb`)

```
a1a5bfe audit(sp1.5-bugfix): mockup vs production visual diff (12/12 PASS)
7c0c1b9 audit(sp1.5-bugfix): iOS Safari 15-item checklist — all PASS or N/A
a7e7afd test(sp1.5-bugfix): update existing stale-session spec for new banner/handler ids
261d63e test(sp1.5-bugfix): PW D-1 desktop layout — chrome full-width / body 920
5342633 test(sp1.5-bugfix): PW scroll-clearance — last bubble visible above sticky
4c056c2 test(sp1.5-bugfix): PW button-style spec — phase 3 stale-home not icon-btn
d70589a test(sp1.5-bugfix): PW action-bar spec — 上一步 / 回首頁
2eee3ae test(sp1.5-bugfix): PW banner-merged spec
fc2827e fix(sp1.5-bugfix): preserve chat-body flex chain inside .circles-body-centered (T6 follow-up)
f7bc3ae feat(sp1.5-bugfix): phase 3 stale render — id fix + drill-encourage suppress + .circles-body-centered
4c8101d feat(sp1.5-bugfix): phase 1 stale render — compact banner + .stale-action-bar
09f5b53 feat(sp1.5-bugfix): phase 2 stale render — compact banner + .stale-action-bar + .circles-body-centered
35cd96f test(sp1.5-bugfix): bindStaleActionBar jest unit (3 tests)
caa5495 feat(sp1.5-bugfix): bindStaleActionBar shared handler for stale-prev/stale-home
a71df51 feat(sp1.5-bugfix): renderStaleLockedBar helper (jest TDD)
1f452d0 style(sp1.5-bugfix): extend D-1 chrome-full-width to >=1440 viewports (4155-4156 override)
52a385f style(sp1.5-bugfix): D-1 desktop layout split — top chrome full-width, body 920 centered
d5f4e7f style(sp1.5-bugfix): add .stale-mode wrapper for edge-to-edge stripes + scroll clearance
acd7cf5 style(sp1.5-bugfix): add .stale-action-bar sticky double-button row
a519308 style(sp1.5-bugfix): add .stale-locked-bar compact merged banner
```

## What ships

- **F-1 phase 2 stale UX**: compact merged banner (~44px), sticky double-button bar (上一步 + 回首頁), edge-to-edge stripes, chat-body padding-bottom 88px for sticky clearance
- **F-2 phase 3 stale**: button id `circles-stale-home` (no longer collides with navbar icon-btn round-grey rule); drill-encourage card suppressed
- **F-3 navigate target**: stale-home navigates to CIRCLES home (not legacy PM 思維訓練 入門/進階/困難)
- **D-1 desktop layout split**: phase 2/3 wrap full-width on desktop; body content uses `.circles-body-centered` (max-width: 920px centered) at all desktop breakpoints (1024+, 1280+, 1440+, 2560)

## Pending actions before merge (boxes 13 + 14)

1. Director walk-through per `audit/sp1.5-bugfix-eyeball-log.md` (mobile-360 + desktop-1280 + desktop-1440)
2. Director marks all checkboxes ✅ in eyeball log
3. Director gives explicit "ship it" / "可以 merge" approval
4. Run `git checkout main && git merge --no-ff feat/sp1.5-bugfix -m "Merge SP1.5-bugfix: stale UX fixes (F-1/F-2/F-3) + D-1 desktop layout split"`
5. `git push origin main` (only after explicit user approval)
6. `git worktree remove ../first-principle-sp1.5-bugfix && git branch -d feat/sp1.5-bugfix`
