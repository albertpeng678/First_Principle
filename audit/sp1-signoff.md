# SP1 Sign-off — 2026-05-02

## Gates

- [x] All TDD tasks committed (T2 / T3 / T4 / T4-followup / T5 / T6 / T7 / T8 / T9-test-fix)
- [x] Playwright `sp1-edge-alignment.spec.js`: 40/40 passed across 8 viewport projects (Mobile-360 / iPhone-SE / iPhone-14 / iPhone-15-Pro / iPad / Desktop-1280 / Desktop-1440 / Desktop-2560)
- [x] Existing Playwright suite: 1527 passed / 559 skipped / 0 failed (no regression, 52.4 min full run)
- [x] Jest: 109/109 passed (7 suites)
- [x] iOS Safari static review: iPhone-15-Pro spot-check screenshot reviewed, no overflow / no serif / clean layout
- [x] No console errors during walkthrough
- [x] Verification grep:
  - `grep -rE "font-family.*(Serif|serif|Georgia|Times)" public/` → 0
  - `grep -rE "需要修正|gate-error-message|class=\"error-bar\"" public/` → 0 (only the unrelated gate result label "需要修正方向" remains, which is intentional UI copy not a removed component)

## Commits (feat/sp1-visual)

```
e8eb9c1 test(sp1): edge-alignment / serif-free / no-error-bar invariants
a0f797a test(sp1): tighten serif check + scope wrapper paddingLeft to rendered nodes
5d8352c feat(sp1): replace gate error bar with field-level red border
3e25faf style(sp1): unify border-radius via --r-input / --r-pill / --r-card tokens
e7b9217 style(sp1): unify block horizontal padding via --pad-block tokens
e523095 style(sp1): also neutralize horizontal padding on phase2/3/review desktop wrappers
4f4d1ed style(sp1): page wrappers go edge-to-edge (horizontal padding 0)
812142e style(sp1): replace all Instrument Serif with system-ui (incl grade letter)
6de8970 style(sp1): add pad-block / r-input / r-pill tokens
```

## Notable

- 145 hard-coded radius values unified into 99 r-input + 7 r-pill + 39 r-card refs (8 legitimate one-offs preserved: chat bubble shapes, navbar icons, RT toolbar architectural pairings).
- 5 Instrument Serif sites replaced with `var(--c-font-sans)`.
- 9 page wrappers' horizontal padding set to 0 (mobile + tablet + desktop variants).
- 6 internal block selectors token-ized (circles-nav / progress / submit-bar / action-row / nsm-navbar / nsm-progress) with tablet (18px) + desktop (22px) media query overrides.
- Error bar component fully removed; field-level red border (`.has-error` 1.5px solid red + 3% red bg) replaces it.

## Branch

`feat/sp1-visual` ready for merge to main.

**Director:** Claude Code controller (autonomous subagent-driven execution)
