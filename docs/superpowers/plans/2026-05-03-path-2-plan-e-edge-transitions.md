# Path 2 — Plan E · Edge & Transitions (STUB — 最後 plan)

> **Stub status：** Plans A+B+C+D merged 後最終一輪收尾，補 edge cases + cross-screen flow polish。

**Goal：** 把 readiness review 抓出的 cross-screen transition + edge state 全部 wire-up，並做最終 8 viewport × 全 plan 完整 regression，準備 ship。

**Mockups covered：** 16（drill 跳轉 / sim transition / SSE 重發 / Phase 3 切離）+ 15 §C banner edges

**Dependencies：**
- Plans A + B + C + D 全部 merged
- 新建 worktree `first-principle-path2-edge` from main

**Major sub-bundles：**

| # | Sub-bundle | 來源 | 內容 |
|---|---|---|---|
| E1 | Drill「再練一題」跳轉 wire-up | mockup 16 §A / spec §2.14 button 跳轉表 | reset CIRCLES session + pickRandom5 + auto-select + navigate home |
| E2 | Simulation 步驟間 transition + done step 可回看 | mockup 16 §B / spec §2.4 | progress bar 推進 / qchip 持續 / done step click → read-only + locked banner |
| E3 | Phase 2 SSE 中斷 + 重新發送 | mockup 16 §C / spec §1.5.1 | bubble--reconnect + 重新發送 button + 3 次失敗 → EVAL_API_ERROR |
| E4 | Phase 3 loading 中切離 in-flight 不 abort | mockup 16 §D / spec §1.5.1 | circlesEvaluating 持續 / 切回後 3 種 render（loading / done / error）/ resume-toast 在別 view 顯 |
| E5 | 401 mid-action 全站 wire-up | spec §1.5.1 + Plan A apiFetch wrapper | banner-session + returnPath + auth 後 restore |
| E6 | Network offline 全站 wire-up | mockup 15 §C B1 / spec §1.5.1 | sticky-top banner + form draft 存本機 + auto-resume 連線恢復 |
| E7 | iOS Safari 全程動態 review（不只 static） | spec §0.2 | 真機抽驗 60fps 滾動 / chat 串流 / sticky bar / 軟鍵盤 |
| E8 | Final 8 viewport 全 plan regression | spec §0.5 Layer 8 | jest + Playwright 8 viewport 全 spec + 17 mockup baseline diff 全綠 |
| E9 | Final 14-box gate + user signoff + merge main | spec §6.2 | 全 plan 整合 ship-ready |

**估計 task 量：** 9 sub-bundles × 6-8 = 50-70 tasks（含完整 8 viewport regression 跑時較久）。

**Working state at end：** 全 Path 2 完工 — 17 mockup → production 全 < 0.5% diff，jest + Playwright × 8 viewport 全綠，iOS 60fps，user 真機放行。

**Final handoff：** merge 5 plans 成果 → main → user 真機驗 → ship。

---

## 完整 Plan 順序總覽

| Plan | 估 tasks | 估時間 | 完工指標 |
|---|---|---|---|
| **A · Foundation** | 18（已寫完整版）| 1-2 天 | navbar 渲染 / view 路由 / LOCKED chunks / baselines 凍 |
| B · CIRCLES Core | ~70 | 1-1.5 週 | drill + sim 兩 happy path 跑通 |
| C · NSM | ~55 | 1 週 | NSM 4 步跑通 |
| D · Cross-cutting | ~50 | 5-7 天 | offcanvas / onboarding / toast / modal 全在 |
| E · Edge & Transitions | ~60 | 1 週 + 真機驗 | 全部 edge + ship-ready |

**總計 ≈ 250-300 tasks / 4-5 週 / 5 次 14-box gate**。每個 plan 結束都可獨立 ship（功能可降級），不會互卡。
