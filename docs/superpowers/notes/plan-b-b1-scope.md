# Plan B · Sub-bundle 1 — CIRCLES Home（mockup 01）scope note

> 工作期間私用 working note（不在主索引）。Sub-bundle merge 後可清。

## Source of truth
- Mockup HTML：`docs/superpowers/specs/mockups/2026-05-02-frontend-rewrite/01-circles-home.html`
- Spec §2.14：`docs/superpowers/specs/2026-05-02-frontend-rewrite-master-spec.md` (lines 437-495)
- 題庫：`public/circles-db.js`（global `CIRCLES_QUESTIONS`，100 題：design 40 / improve 35 / strategy 25）

## BEM contract（從 mockup 01 抄出）

| Section | 主 class | 內部 |
|---|---|---|
| A stats strip | `.stats-strip` | `__icon` `__item` `__num` `__sep` `__hint` |
| qa accordion | `.qa-row` `.is-open` | `__head` `__title` `__caret` `__body` |
| Mode cards | `.mode-selector` `.mode-card` `.is-active` | `__head` `__title` `__body` |
| Search | `.search-wrap` | `input[type="search"]` `__icon` `__clear` |
| Type tabs | `.type-tabs` `.type-tab` `.is-active` | — |
| Q-list | `.q-list` `.qcard` `.is-expanded` | `__head` `__num` `__title` `__meta` `__meta-sep` `__body` `__more` `__expand` `__section-label` `__full-statement` `__drill-hint` `__action-row` `__btn` `__btn--primary` `__btn--ghost` |
| Q-card analysis | `.qcard-analysis` `.ana-block` `.ana-block--trap` | `__head` `__body` |
| Mode tag | `.mode-tag` `.mode-tag--drill` `.mode-tag--sim` | — |
| Reshuffle | `.reshuffle` | — |
| Drill rail | `.drill-rail` `.drill-pill` `.is-active` | `__title` `__list` `__lock` `.step-letter` |
| Recent rail | `.recent-rail` `.recent-item` | `__title` `__see-all` `__list` `__head` `__time` `__title` `__phase` |
| Empty | `.empty-wrap` | `__title` `__body` |
| NSM promo | `.nsm-promo` | `__main` `__title` `__sub` `__cta` |
| Home wrapper | `.home` `.home--desktop` `.home--desktop-no-drill` | grid 1fr 220px (no drill) / 200px 1fr 220px (drill) |

## Layout breakpoints（per mockup）
- Mobile (<768px): single column, no rail, mode-selector 2-col grid (1fr 1fr), q-card list, drill mode displays horizontal pill row
- Tablet (768-1023px): same as mobile (no desktop grid)
- Desktop (≥1024px): `.home--desktop` 啟用 grid; drill mode = 200px / 1fr / 220px; sim = 1fr / 220px (+`.home--desktop-no-drill`)

## Mobile navbar tabs hide（carry-forward — Plan A 未做）
`@media (max-width: 480px) { .navbar__tabs { display: none; } }` — 對齊 mockup mobile frame 不顯示 nav tabs。

## Render dispatch
- `view==='circles' && circlesPhase===1 && !circlesSession` → `renderCirclesHome()`
- 其他 phase → 還是 stub（Plan B2+ 接手）

## 5 random q-card pick rule
- AppState.circlesDisplayedQuestions 持久（per spec）
- 首次 mount 若空：filterByType(QUESTIONS, 'design') → pickRandom5
- 換 type tab：filterByType + pickRandom5
- reshuffle：filterByType + pickRandom5（排除目前 5 題以外可能即可全洗）

## Visual diff baseline 注意
- `tests/visual/baselines/{vp}/01-circles-home.png` 是 mockup 整頁 fullpage 截圖（含 A-G 7 sections + ds-page header + footer + annotations）
- production 渲染 = 單頁 home view → **天然不可能 < 0.5%**
- 對策：spec 用 baseline 形狀對比。當前 sub-bundle 用 spec 規定的 pixelmatch 對比 + 若 % 過高，記錄並 DONE_WITH_CONCERNS（先做完 BEM contract 對齊，後續若 audit 發現視覺差再修）

## Tasks
1. scope note ✓
2. CSS BEGIN marker + mobile navbar tabs hide
3. CSS A: h-hero / stats-strip
4. CSS B: mode cards + drill rail + drill pill + drill rail lock
5. CSS C: q-list + qcard (collapsed + expanded + analysis blocks + section-label + full-statement + drill-hint + action-row + btn)
6. CSS D: reshuffle + search-wrap + type-tabs + recent-rail + empty-wrap + nsm-promo + qa-row + home-grid
7. CSS E: persistent qchip styling delta（已 LOCKED 但需新增 sticky + z-index 微調）+ onboarding-welcome banner
8. CSS END marker
9. tests/visual/circles-home.spec.js — TDD red
10. app.js: replace stub with real renderCirclesHome + helpers
11. bind handlers
12. final verify smoke + spec + visual diff
