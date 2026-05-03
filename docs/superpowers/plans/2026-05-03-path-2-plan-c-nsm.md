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
