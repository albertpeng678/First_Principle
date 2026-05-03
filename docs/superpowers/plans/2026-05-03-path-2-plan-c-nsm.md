# Path 2 — Plan C · NSM (STUB — 待 Plan B 完成後展開)

> **Stub status：** 此 plan 在 Plans A + B 都 merged 後才能展開為完整版。本 stub 鎖 scope。

**Goal：** NSM 4-step happy path — 從 Step 1 挑題到 Step 4 報告全部跑通。

**Mockups covered：** 06 / 07 / 08 / 14

**Dependencies：**
- Plans A + B merged
- 新建 worktree `first-principle-path2-nsm` from main
- Plan A 的 LOCKED chunks（navbar / btn / qchip / submit-bar / panel-card / loading-wrap / error-wrap）都在
- Plan B 的 `apiFetch` / SSE 處理範式可借（NSM gate / context API call 用同一 pattern）

**Major sub-bundles：**

| # | Sub-bundle | Mockups | render 函式 |
|---|---|---|---|
| C1 | NSM Step 1（5 卡 + 4-欄 context + filter + reshuffle / desktop 3-col rail）| 06 | `renderNSMStep1` `renderNSMQuestionCard` |
| C2 | NSM Step 2（定義 NSM 3 fields + 範例 toggle）+ Step 3（4-dim card 動態 label）| 07 | `renderNSMStep2` `renderNSMStep3` `renderNSMSubTabs` |
| C3 | NSM Gate（5 維度三態 + loading） | 08 | `renderNSMGate` |
| C4 | NSM Step 4（4 tabs：總覽 / 對比 / 亮點 / 完成 + 教練思路展開 panel）| 14 | `renderNSMStep4` `renderNSMRadar` `renderNSMCompareDetail` `renderNSMHighlights` `renderNSMDonePanel` |
| C5 | NSM dim 動態 label（attention / saas / transaction / creator 4 type）| 06 / 07 / 14 | `NSM_DIMENSION_CONFIGS` constant + render binding |
| C6 | Visual diff gate + iOS checklist + 14-box | all NSM | new |

**估計 task 量：** 6 sub-bundles × 8-10 = 50-60 tasks。

**Working state at end：** NSM 4 步從挑題到完成 done-panel 全跑；jest 不變；Playwright 全 8 viewport NSM spec 綠；mockup 06/07/08/14 baseline diff 全 < 0.5%。

**Plan C handoff criteria：** spec §0.5 全綠 + 14-box signoff → merge → 開 Plan D worktree。

---

## C1 · Sub-bundle 1 — NSM Step 1 (mockup 06) — scope note 2026-05-03

**Worktree：** `/Users/albertpeng/Desktop/claude_project/first-principle-path2-c-nsm` · branch `feat/path-2-nsm` from main 55f7051
**Dev port：** 4002（PORT=4002 npm start；Playwright 用 PMDRILL_BASE_URL=http://localhost:4002）
**Mockup baseline：** `tests/visual/baselines/{mobile-360,tablet-768,desktop-1280}/06-nsm-step-1.png`

### BEM map（自 mockup 06 抽出 — implementer 視覺契約）

| 元件 | class | 備註 |
|---|---|---|
| 4-step progress | `.nsm-progress` `.nsm-progress__step` `.nsm-progress__dot` `.nsm-progress__label` `.nsm-progress__line` | step 加 `is-active` / `is-done`；line 加 `is-done` |
| body container | `.nsm-body` `.nsm-instruction` `.nsm-content` | desktop 走 `.nsm-desktop-shell` 取代 `.nsm-body` |
| 列表頭 | `.nsm-list-head` `.nsm-list-head__label` `.nsm-shuffle` | shuffle button 隨機選題 |
| 題卡 | `.nsm-q-list` `.nsm-q-card` `.nsm-q-card__head` `.nsm-q-card__company` `.nsm-q-card__industry` `.nsm-q-card__type` `.nsm-q-card__scenario` | selected 加 `is-selected`，type 加 modifier `--attention` `--transaction` `--creator` `--saas` |
| 4-欄 context | `.nsm-context` `.nsm-ctx-row` `.nsm-ctx-row__label` `.nsm-ctx-row__val` | trap row 加 `--trap`，insight row 加 `--insight`；loading 加 `is-loading` |
| desktop shell | `.nsm-desktop-shell` `.nsm-filter-rail` `.nsm-filter-rail__label` `.nsm-filter-row` `.nsm-filter-row__count` `.nsm-search` `.nsm-recent` `.nsm-recent__item` `.nsm-recent__item-co` `.nsm-recent__item-meta` `.nsm-center` | 200px / 1fr / 220px |

### Type pill 配色（無紫色）

| product type | pill modifier | bg / text | filter rail icon color |
|---|---|---|---|
| 注意力型 | `--attention` | navy-lt / navy | `--c-navy` |
| 交易量型 | `--transaction` | success-lt / success | `--c-success` |
| 創造力型 | `--creator` | warn-lt / warn | `--c-warn` |
| SaaS 型 | `--saas` | primary-lt / primary | `--c-primary` |

### Helpers

- `detectProductType(q)` — 由 `q.industry` keyword 判斷（SaaS / 訂閱 → saas；外賣 / 電商 / 出行 / 平台 / 交易 → transaction；創作 / 內容 → creator；其餘 → attention）
- `NSM_TYPE_META` — { attention: { label, icon, color, modifier }, ... } 4 entries 全 LOCKED 配色
- `pickNSMRandom5(qs)` — Fisher-Yates 抽 5
- `filterNSMByType(qs, type)` — type='all' or product type
