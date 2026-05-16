# PM Drill — 專案狀態看板

> 即時狀態 single source of truth。**不放歷史（git log 有）**。重大事件即時 Edit。
> **Last updated:** 2026-05-17（CIRCLES chat drift + lock-on-back ship + Stage 0 + Stage 1A T1-T13 + 1B/1C/1D specs awaiting 放行 + 13 sessions cleanup + lifecycle spec PAUSED）

## 當前狀態（30 秒讀完）

- **CIRCLES chat drift + lock-on-back ship (2026-05-17)**：spec `b2ca935` + 7-task plan `4a01550` + commits `d8e4814`/`3a61489`/`49d00ba`/`d930159`/`24c2ac6`/`34c1361`/`c3bc286`/`313b4fd`/`32d348e`/`217c342`/`8e51b8f` + Director cold-Read 6 PNG + E2E 5 TC × 3 projects 16/16 GREEN × 10 runs no flake。AC-1/2/3/4/5/6 全綠；jest 530/552（5 pre-existing fails 全為 lifecycle wiring，未觸我 Task 1-7 範圍）；Task 5 back-nav spec 16/16 GREEN。UAT SOP `audit/sop-2026-05-17-circles-lock-and-qchip-uat.md`。
- **Stage 0 ship (2026-05-16)**：B7 prod 污染清理 + prevention infra（env-guard / auto-cleanup fixture / pre-commit hook / 3-env split / `e2e@first-principle.test`）+ 2 條 STANDING memory（three_iron_laws / e2e_real_data_only）+ skill 整合 plan ship。15 commits `4dba816..1ba062e`；jest 45/45；V2 security-review PASS WITH NOTES。
- **Stage 1A gate cluster (B1+B6) ship (2026-05-16)**：T1-T12 implementer 完成，T13 jest 410/428（1 pre-existing fail，無 regression）；T14 + T15 收尾待跑。
- **Stage 1B/1C/1D specs ship (2026-05-16)**：brainstorm 完 → `2c6fa51`（1B）/ `8ca4b81`（1C）/ `93d2695`（1D）— 等 user 放行才 dispatch impl。
- **Production data cleanup (2026-05-16)**：13 sessions DELETE（7 circles 污染 + 4 nsm 污染 + 2 nsm empty-stub）via `scripts/execute-cleanup.js`；receipt `audit/data-pollution-executed-2026-05-16.md`。
- **scan-pollution.js patch (2026-05-16)** `e34d825`：修 `repro-bug1-*` + 廣義化 timestamp-suffix shape，jest 15→31 specs。
- **Lifecycle state-machine spec (2026-05-16)** `33d5bf9`：`docs/superpowers/specs/2026-05-16-session-lifecycle-state-machine-design.md` — **PAUSED** 等 holistic persistence audit 結果。
- **Stage 1D B-Hint inventory**：發現 1 條 spec gap（NSM step1 hint location）；agent running 確認中。
- **Path 2 Frontend Rewrite ✅ 17/17 mockup 全 ship**（Layer 2 pixel-diff `ba6c49f` 機械驗證 60 cases × 3 vp，0 structural drift）
- **NSM 2026-05-12 ship**：總驗收 8 vp UAT 3 bug 全修 → `3344a95` / `b15eee6` / `e1f53be`；同日早 ship NSM bundle 8 bugs `762a8ab` → `a44f67d` + 100 NSM 題 content backfill
- **Baseline 不破：** jest 530/552（5 pre-existing lifecycle fails，無新 regression）+ Playwright NSM specs 64/64 pass × 8 vp + Playwright `circles-back-nav-lock` 16/16 × 3 projects
- **接手 Handoff：** `docs/PATH-2-HANDOFF.md` + memory `project_pending_followups_2026-05-10.md`

---

## 主路線：Path 2 — Frontend Rewrite

**範圍：** 後端 / API / DB / OpenAI prompts / 商業邏輯 / jest 100% 不動
**標竿：** iOS Safari 滑順度 ≥ aistockmap.com（手機 web）
**Master Spec：** `docs/superpowers/specs/2026-05-02-frontend-rewrite-master-spec.md`

### 進行中 / 待收尾

| 項目 | 狀態 |
|---|---|
| Stage 1A T14 + T15 收尾 | 🔧 T1-T13 已 ship；T14（Playwright e2e）+ T15（director sign-off）等跑 |
| Stage 1B/1C/1D impl | 📋 specs `2c6fa51` / `8ca4b81` / `93d2695` — 等 user 放行 dispatch |
| Lifecycle state-machine impl | ⏸ spec `33d5bf9` PAUSED；holistic persistence audit running → `audit/persistence-comprehensive-audit-2026-05-16.md` |
| Holistic persistence audit | 🏃 background；audit 結果出來再決定 lifecycle spec 是否補 |
| Stage 1D B-Hint cluster | 🔍 inventory agent running（NSM step1 hint location 1 條 spec gap 待確認）|
| Phase A + B Final Ship Readiness | ✅ Layer 1-6 + 8 全綠；Layer 7 等 user 真機 UAT |
| P3 follow-ups（8 條） | 📋 memory `project_pending_followups_2026-05-09.md` |

> 已完成的 plans（A / B SB1-10 + Phase 2-4 / C SB1-3 / D SB1-2 / Combo C / 多輪 hotfix）見 `git log`

---

## Mockup Index（CONTRACT-LOCKED · 17/17 全放行）

`docs/superpowers/specs/mockups/2026-05-02-frontend-rewrite/`

| # | 檔名 | 一句話 |
|---|---|---|
| 00 | design-system | 21 sections design tokens + LOCKED chunks |
| 01 | circles-home v5 | A-G 7 sections（含 NSM cross-promo card + 公司·產品 title 格式）|
| 02 | auth-flow | 登入登出 A-E 5 sections |
| 03 | phase-1-form | 4-field form + hint overlay + 7 sections |
| 04 | phase-1-5-gate | 三態 ok/warn/error + loading（紅必擋，無 sim override）|
| 05 | phase-2-chat | 三角色 bubble + 4 種底部狀態 |
| 06 | nsm-step-1 | 5 卡 + 4-欄 context + 3-col rail（200/1fr/220）|
| 07 | nsm-step-2 v3 | 步驟 2/3 sub-tabs + 4-dim 動態 label per type |
| 08 | nsm-step-3-gate v2 | 5 維度 gate 三態 + loading |
| 09 | offcanvas-history | drawer 280px + 4 狀態 × 3 viewport |
| 10 | onboarding | welcome + 4-step coachmark + dual-ring spotlight |
| 11 | phase-3-score | 評分 4 sections + coach demo accordion |
| 12 | phase-3-error-loading | error 變體 + slow loading 60s+ inline warn |
| 13 | phase-4-final | 7-axis radar + step-rows + nested NSM 4 dim |
| 14 | nsm-step-4 | 4 tabs + 教練思路展開 panel + pentagon radar |
| 15 | error-empty-collation | §A 規約字典 6 表 + §B-D 全集 |
| 16 | flow-transitions-edge | drill 跳轉 / sim transition / SSE 重發 / Phase 3 切離 / §D 跨 tab resume-toast |

**Mockup-as-Spec 嚴格規則：** Implementer 開工必對 mockup；Auditor PNG pixel-diff 0.5% 對 baseline，禁止自然語言判斷；偏離 = bundle 不過。完整 §5.2。

---

## Active Branches / Worktrees

| 路徑 | branch | 狀態 |
|---|---|---|
| 主 repo | main | Stage 0 + Stage 1A T1-T13 ship / jest 410/428 (1 pre-existing fail) |
| `first-principle-path2-b-circles` | feat/path-2-circles-core | Plan B 平行 worktree |
| `first-principle-path2-c-nsm` | feat/path-2-nsm | Plan C 平行 worktree |
| `first-principle-path2-d-cross` | feat/path-2-cross-cutting | Plan D 平行 worktree |
| `first-principle-sp2` | feat/sp2-drill | 暫不 merge（CSS 廢棄 / JS cherry-pick）|
| `first-principle-sp3-backend` | feat/sp3-backend | 已 merge，可 cleanup |
| 主 repo | revise/sp3-alignment | 4 commits — Path 2 結束再評估 |

---

## 視覺對齊測試 Stack（8 層 — Master Spec §0.5）

1. Mockup-as-Spec baseline 凍結 → 2. Pixel diff 0.5% → 3. boundingBox invariant → 4. WebKit+Chromium → 5. State matrix audit → 6. Director eyeball walk → 7. User 真機抽驗 → 8. Pre-commit + CI gate

**Bundle PR 必出 4 樣產出：** jest log / Playwright log / `tests/visual/diffs/bundle-N-report.md` / `audit/eyeball-bundle-N.md`

**User 殺手鐧 3 問**（任一答不出 = bundle 重來）：
1. Read 過 PNG？貼 viewport + 評論
2. 5 條 boundingBox invariant 數字
3. mockup ↔ production diff？引 report 路徑

---

## Standing Rules（核心 8 條 — 完整版見 memory）

1. CLAUDE.md 即時更新（本檔）
2. Mockup 三裝置並排（mobile 360 / tablet 768 / desktop 1280）+ user 放行才實作
3. 全 zh-TW / 無 emoji / 字型 system-ui（grade letter A/B/C/D 例外 Instrument Serif）/ icons Phosphor `ph-*`
4. UI/UX 稽核必須親看 PNG（Playwright 截圖 + Read tool）
5. iOS Safari 15-item checklist（Master Spec §0.2）每次 ship 前必走
6. Pitch-ready standard：1px 對齊嚴格 / 4-grid 間距 / 無 magic 數值
7. Path 2 期間不動 backend / API / prompts / DB / jest（明確 carve-out 須 user 親准）
8. **Karpathy guidelines** 4 條（Think Before / Simplicity First / Surgical Changes / Goal-Driven）— implementer dispatch 必 prepend

---

## Tests / Quality Gates

- **jest 基線：** 410/428（17 skipped + 1 pre-existing fail；含 env-guard 14 + auto-cleanup 15 + scan-pollution 31 + Stage 1A T13 batch）
- **Playwright：** full suite × 8 viewport（iPhone-SE / iPhone-14 / iPhone-15-Pro / iPad / Mobile-360 / Desktop-1280 / 1440 / 2560）+ 3 Phase B specs（typewriter 4/4 / qchip 6/6 / lock state 6/6）
- **Adversarial sweep：** `npm run test:adversarial` — 5 + 1 stages × 10 cases (新加 circles-coach 9/9 + nsm-step3-hint 8/8)，所有新 AI 審核/gate/評分 ship 前必跑

---

## 文件索引

- **Master Spec：** `docs/superpowers/specs/2026-05-02-frontend-rewrite-master-spec.md`
- **接手 Handoff：** `docs/PATH-2-HANDOFF.md`
- **UI 覆蓋盤點：** `docs/superpowers/specs/path-2-ui-coverage-audit.md`
- **CIRCLES DB：** `circles_plan/circles_database.json`（103 題）
- **NSM 規格：** `nsm_plan/nsm_trainer_full_spec.md`
- **Plugins：** superpowers v5.1.0 / frontend-design / code-review / playwright / context7 / karpathy-skills / **ruflo**（core/swarm/autopilot/federation）
