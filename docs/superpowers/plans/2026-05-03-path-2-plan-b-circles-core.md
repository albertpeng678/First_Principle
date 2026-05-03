# Path 2 — Plan B · CIRCLES Core (STUB — 待 Plan A 完成後展開)

> **Stub status：** 此 plan 在 Plan A 完成 + merged 後才能展開為完整版（細節依 Plan A 實際 file structure 寫）。本 stub 鎖 scope / dependencies / handoff criteria。

**Goal：** 把 CIRCLES happy path（drill + simulation 雙模式）兩條從 home 到 final report 全部串起來。

**Mockups covered：** 01 / 03 / 04 / 05 / 11 / 12 / 13

**Dependencies：**
- Plan A 已 merge 到 main（tokens / LOCKED chunks / AppState / view router / `apiFetch` 401 wrapper 都在）
- Plan A worktree 收尾，新建 worktree `first-principle-path2-circles-core` from main

**Major sub-bundles（細節留 expand 時）：**

| # | Sub-bundle | Mockups | 主要 render 函式 |
|---|---|---|---|
| B1 | CIRCLES Home（含 drill rail / sim mode 卡 / 5 random / search / type tabs / q-card list / qchip persistent）| 01 | `renderCirclesHome` `renderQList` `renderQCardHtml` `renderPersistentQuestionChip` `renderStatsStripHtml` `renderOnboardingWelcomeHtml` |
| B2 | Phase 1 Form（4-field rt-textarea / hint overlay / save indicator / G qchip 展開）| 03 | `renderCirclesPhase1` `renderQuestionAnalysisBlock` rt-toolbar binders |
| B3 | Phase 1.5 Gate（5 dim 三態 + loading）| 04 | `renderCirclesGate` |
| B4 | Phase 2 Chat（三角色 bubble + 4 底部 state + 上一步 + locked / stale）| 05 | `renderCirclesPhase2` SSE handler + reconnect bubble per mockup 16 §C |
| B5 | Phase 3 Score（4 dim + coach demo + loading + error 4 codes）| 11 / 12 | `renderCirclesStepScore` |
| B6 | Phase 4 Final Report（grade / radar / step-rows + nested NSM 4 dim / strengths / improvements / verdict）| 13 | `renderCirclesFinalReport` `renderCirclesRadarSvg` |
| B7 | Auth flow（登入登出 / token expiry / migration silent fetch）| 02 | `renderAuth` |
| B8 | Visual diff gate + iOS checklist + 14-box signoff | all | new |

**估計 task 量：** 8 sub-bundles × 8-12 task / sub = 60-90 tasks。

**Working state at end：** drill 單步 + simulation 7 步 兩條 happy path 從 home 點題 → 完成 final report 全跑通；jest 157 不變；Playwright 全 8 viewport CIRCLES 相關 spec 綠；對 mockup 01/03/04/05/11/12/13 baseline pixel-diff 全 < 0.5%。

**Plan B handoff criteria：** spec §0.5 8 層全綠 + 14-box gate user signoff → merge → 開 Plan C worktree。
