# PM Drill — 專案狀態看板

> 即時狀態 single source of truth。重大事件即時 Edit。不放歷史（git log 有）。
> **Last updated:** 2026-05-03（04 放行 + SP4 backend 完成停 worktree）

---

## 當前主路線：Path 2 — Frontend Rewrite

**範圍：** 後端 / API / DB / OpenAI prompts / 商業邏輯 / jest 100% 不動。前端 CSS + render 結構從 0 重寫。
**標竿：** iOS Safari 滑順度 ≥ aistockmap.com（手機 web）
**Master Spec：** `docs/superpowers/specs/2026-05-02-frontend-rewrite-master-spec.md`

### 進度狀態

| 階段 | 狀態 |
|---|---|
| 全盤掃描（122 項 UI / 47% baseline）| ✅ 完成 — `path-2-ui-coverage-audit.md` |
| Master Spec 凍結 | ✅ 完成 |
| SP3 backend 並行 | ✅ Merged 到 main（13 commits / jest 142 綠 / 兩階段 review × 2 round 全綠）|
| SP4 backend 並行 | ✅ Merged 到 main（jest 142 → 157 / 103 題 NSM context 預生成 idempotent 雙跑驗證）|
| Mockup（共 16 張）| 🟡 6/16 放行，下一張 06 |
| writing-plans → CSS rewrite plan | ⏳ 待 mockup 全完 |
| subagent-driven-development | ⏳ 待 plan |
| 14-box gate → merge main | ⏳ 待全綠 |

---

## Mockup Index（視覺契約 — CONTRACT-LOCKED 完整路徑）

| # | 狀態 | 完整路徑 | 內容 |
|---|---|---|---|
| 00 | ✅ 放行 | `docs/superpowers/specs/mockups/2026-05-02-frontend-rewrite/00-design-system.html` | Design system 21 sections |
| 01 | ✅ 放行 v4 | `docs/superpowers/specs/mockups/2026-05-02-frontend-rewrite/01-circles-home.html` | CIRCLES Home A-G 7 sections |
| 02 | ✅ 放行 | `docs/superpowers/specs/mockups/2026-05-02-frontend-rewrite/02-auth-flow.html` | 登入登出 A-E 5 sections |
| 03 | ✅ 放行 | `docs/superpowers/specs/mockups/2026-05-02-frontend-rewrite/03-phase-1-form.html` | Phase 1 表單 A-G 7 sections |
| 04 | ✅ 放行 | `docs/superpowers/specs/mockups/2026-05-02-frontend-rewrite/04-phase-1-5-gate.html` | Phase 1.5 Gate 三態 ok/warn/error（紅 = 必擋，drill+sim 一致）+ loading |
| 05 | ✅ 放行 | `docs/superpowers/specs/mockups/2026-05-02-frontend-rewrite/05-phase-2-chat.html` | Phase 2 對話三角色 bubble + 4 種底部狀態（input / submit-row / streaming / conclusion / locked）|
| 06 | 待畫（NEXT）| `docs/superpowers/specs/mockups/2026-05-02-frontend-rewrite/06-nsm-step-1.html` | NSM Step 1 |
| 07 | 待畫 | `docs/superpowers/specs/mockups/2026-05-02-frontend-rewrite/07-nsm-step-2.html` | NSM Step 2（4-dim 動態 label）|
| 08 | 待畫 | `docs/superpowers/specs/mockups/2026-05-02-frontend-rewrite/08-nsm-step-3-gate.html` | NSM Step 3 Gate |
| 09 | 待畫 | `docs/superpowers/specs/mockups/2026-05-02-frontend-rewrite/09-offcanvas-history.html` | Offcanvas 歷史 |
| 10 | 待畫 | `docs/superpowers/specs/mockups/2026-05-02-frontend-rewrite/10-onboarding.html` | Onboarding spotlight |
| 11 | 待畫 | `docs/superpowers/specs/mockups/2026-05-02-frontend-rewrite/11-phase-3-score.html` | Phase 3 步驟分數 |
| 12 | 待畫 | `docs/superpowers/specs/mockups/2026-05-02-frontend-rewrite/12-phase-3-error-loading.html` | Phase 3 error + loading |
| 13 | 待畫 | `docs/superpowers/specs/mockups/2026-05-02-frontend-rewrite/13-phase-4-final.html` | Phase 4 報告（7-axis radar）|
| 14 | 待畫 | `docs/superpowers/specs/mockups/2026-05-02-frontend-rewrite/14-nsm-step-4.html` | NSM Step 4（4 tabs）|
| 15 | 待畫 | `docs/superpowers/specs/mockups/2026-05-02-frontend-rewrite/15-error-empty-collation.html` | Error / Empty / Loading 全集 |

### Mockup-as-Spec 嚴格規則
- **Implementer：** 開工前必先打開對應 mockup；mockup 是 source of truth；偏離 = bundle 不過
- **Auditor：** PNG pixel-diff（threshold 0.5%）對 mockup baseline 跑；**禁止自然語言判斷**；diff > threshold = BLOCK
- **完整規則：** Master Spec §5.2

---

## Active Branches / Worktrees

| 路徑 | branch | 狀態 |
|---|---|---|
| `/Users/albertpeng/Desktop/claude_project/First_Principle` | main | 主 repo（SP3 + SP4 backend 已 merge / jest 157）|
| `/Users/albertpeng/Desktop/claude_project/first-principle-sp2` | feat/sp2-drill | 暫不 merge — JS 改動可 cherry-pick，CSS 廢棄 |
| `/Users/albertpeng/Desktop/claude_project/first-principle-sp3-backend` | feat/sp3-backend | 已 merge 進 main，可 cleanup |
| 主 repo | revise/sp3-alignment | 4 commits — Path 2 結束再評估 |

---

## Pending Workstreams（Path 2 之後）

### SP3 frontend tasks（Path 2 期間 mockup 11/12 處理）
- Phase 3 三狀態 renderer / collapsible / coach demo / loading checklist
- Spec：`docs/superpowers/specs/2026-05-02-sp3-score-coach-end-design.md`

### SP4 frontend tasks（Path 2 期間 mockup 06-08, 14 處理）
- Step 1 卡片 UI parity / Step 4 全 4 tab 重設計 / 統一 padding
- Spec：`docs/superpowers/specs/2026-05-02-sp4-nsm-upgrade-design.md`（Task A backend 已 merge）

---

## 視覺對齊測試 Stack（防 SP2 5 輪重做）

8 層防禦（完整 Master Spec §0.5）：
1. Mockup-as-Spec baseline 凍結 → 2. Pixel diff 0.5% → 3. boundingBox invariant → 4. WebKit+Chromium → 5. State matrix audit → 6. Director eyeball walk → 7. User 真機抽驗 → 8. Pre-commit+CI gate

**Bundle PR 必出 4 樣產出（缺一不過）：** jest log / Playwright log / `tests/visual/diffs/bundle-N-report.md` / `audit/eyeball-bundle-N.md`

**User 殺手鐧 3 問（隨時可打）：**
1. 「你 Read 過 PNG 沒？貼 viewport + 評論」
2. 「5 條 boundingBox invariant 數字」
3. 「mockup ↔ production diff 結果？引 report 路徑」

任一答不出 = 該 bundle 重來。

---

## Standing Rules（核心 7 條 — 完整版見 memory）

1. CLAUDE.md 即時更新（本檔）
2. Mockup 三裝置並排（mobile 360 / tablet 768 / desktop 1280）+ user 放行才實作
3. 全 zh-TW / 無 emoji / 字型 system-ui（grade letter A/B/C/D 例外 Instrument Serif）/ icons Phosphor ph-*
4. UI/UX 稽核必須親看 PNG（Playwright 截圖 + Read tool）
5. iOS Safari 15-item checklist（Master Spec §0.2）每次 ship 前必走
6. Pitch-ready standard：1px 對齊嚴格 / 4-grid 間距 / 無 magic 數值
7. Path 2 期間不動 backend / API / prompts / DB / jest

---

## Tests / Quality Gates

- jest 基線：157/157（main 含 SP3 + SP4 backend merge）
- Playwright：91/91 × 8 viewport（iPhone-SE / iPhone-14 / iPhone-15-Pro / iPad / Mobile-360 / Desktop-1280 / Desktop-1440 / Desktop-2560）

---

## 文件索引

- **Master Spec：** `docs/superpowers/specs/2026-05-02-frontend-rewrite-master-spec.md`
- **UI 覆蓋盤點：** `docs/superpowers/specs/path-2-ui-coverage-audit.md`
- **SP3 / SP4 specs：** `docs/superpowers/specs/2026-05-02-sp3-*.md` / `2026-05-02-sp4-*.md`
- **CIRCLES DB：** `circles_plan/circles_database.json`（103 題）
- **NSM 規格：** `nsm_plan/nsm_trainer_full_spec.md`
- **Plugins：** superpowers v5.0.7 / frontend-design / code-review / playwright / context7
