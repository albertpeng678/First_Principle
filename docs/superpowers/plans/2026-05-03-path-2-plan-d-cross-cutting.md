# Path 2 — Plan D · Cross-cutting (STUB — 待 Plans A+B+C 完成後展開)

> **Stub status：** 全站共用元件 — Offcanvas / Onboarding / Toast / Modal。Plans A+B+C 結束後展開。

**Goal：** 把 cross-screen UI（offcanvas history / onboarding tour / toast / confirm modal / inline btn loading / streaming dots / skeleton）統一收整套，讓全站體感一致。

**Mockups covered：** 09 / 10 / 15

**Dependencies：**
- Plans A + B + C merged（CIRCLES + NSM 都有實內容才能驗 offcanvas list / onboarding 走遍 home）
- 新建 worktree `first-principle-path2-cross-cutting` from main

**Major sub-bundles：**

| # | Sub-bundle | Mockups | 內容 |
|---|---|---|---|
| D1 | Offcanvas History（drawer 280px + 4 狀態 list / empty / loading / error / drill vs sim 區分）| 09 | `renderOffcanvas` `renderOffcanvasList` `renderOffcanvasItem` |
| D2 | Onboarding tour（welcome card + 4-step coachmark spotlight `.onb-targeted`）| 10 | `renderOnboarding` `bindOnboardingTour` |
| D3 | Toast notifications（4 變體 info/success/warn/error + auto-dismiss + 堆疊）| 15 §D | `renderToastStack` `pushToast` |
| D4 | Confirm modal（destructive 用 danger primary）| 15 §D | `renderConfirmModal` `confirmDestructive` |
| D5 | Inline button loading（`btn--loading` + `btn__spinner`）+ streaming dots + skeleton | 15 §B | utility classes / helper |
| D6 | Empty wrap（list / search / filter empty）| 15 §D | `renderEmptyState` |
| D7 | Visual diff + iOS + 14-box | all | new |

**估計 task 量：** 7 sub-bundles × 6-10 = 40-60 tasks。

**Working state at end：** offcanvas 全 4 狀態跑、onboarding 從 home 觸發 4-step tour、所有 toast / modal / inline loading / streaming / skeleton 元件都有 binder helper 可被 Plans B/C 已存在 render 函式 import；mockup 09/10/15 baseline diff 全 < 0.5%。

**Plan D handoff criteria：** spec §0.5 全綠 + 14-box → merge → 開 Plan E。
