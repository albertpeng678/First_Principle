# PM Drill — 專案狀態看板

> 即時狀態 single source of truth。每次重大事件就 Edit 這份文件。不放歷史（git log 有）—只放「現在」。

**Last updated:** 2026-05-02

---

## 當前主路線：Frontend Rewrite (Path 2)

**決策：** 後端 / API / DB / OpenAI prompts / 商業邏輯 / jest 測試 100% 不動。前端 CSS + render 結構從 0 重寫。
**原因：** SP1 / SP1.5 / SP1.5-bugfix / SP2 累積的 layered CSS overrides 導致對齊 / 邊界 / sticky 行為互相打架；SP2 v2 視覺修正歷經 5+ 輪未過 user 驗收。
**標竿：** iOS Safari 滑順度 ≥ https://aistockmap.com（手機 web）

### Master Spec
**檔案：** `docs/superpowers/specs/2026-05-02-frontend-rewrite-master-spec.md`
**內容：** NFR (15-item iOS checklist) / Backend contract (CONTRACT-LOCKED) / 全畫面 14 個 / 全 render 函式 / Domain logic / Dead code 清單 / Mockup checklist / 重寫 gate

### Path 2 Skill Chain（已盤點 plugin 後正式版）
```
frontend-design (獨立 plugin) → writing-plans → using-git-worktrees
   → subagent-driven-development (impl + spec-review + quality-review × bundle)
   → verification-before-completion → finishing-a-development-branch
```

### 並行執行順序鎖定（2026-05-02 決策）
**選項 A：SP3 backend 先做** + 與 mockup 設計**並行**（user 確認）

```
[T0]                    [SP3 backend 並行]                  [Master Spec 更新]   [Phase 3/4/error mockup 解鎖]
  │                            │                                    │                          │
  ├─ 啟 SP3 backend subagent  ─→ Task 2-4 完成 + jest 全綠 ─→ merge main + §1.4 更新 ─→ 開 Phase 3/4 mockup
  │
  └─ 啟 frontend-design skill ─→ design system mockup ─→ 11 張不受 SP3 影響的 mockup（逐張放行）
                                                              │
                                                              └─ 此期間 SP3 不需阻擋
```

**硬性順序（不准違反）：**
1. SP3 backend merge **必須早於** Phase 3 / Phase 4 / Phase 3 error/loading 這 3 張 mockup 開畫
2. 11 張並行 mockup 不依賴 SP3，與 backend 工作完全解耦
3. 任何 SP3 backend bundle 失敗 → 暫停 mockup（避免畫了又改）

### Path 2 進度
- [x] 三個 Explore agent 全盤掃描完成
- [x] Master spec 合成 + 寫入 docs/specs
- [x] Plugin / skill 盤點（frontend-design 確認可用）
- [x] SP3 / SP4 後端待辦盤點完成
- [x] 並行執行順序鎖定 + 兩份文件更新
- [x] 視覺對齊測試 Stack 8 層 + 紀律強制機制寫入 Master Spec §0.5/§6.5/§6.6
- [x] **SP3 backend 已 merge 到 main**（13 commits / jest 142/142 綠 / 兩階段 review × 2 round 全綠 + EvaluatorError subclass + EVAL_PARSE_ERROR shape-drift 註記）
- [x] Master Spec §1.4 ⚠ 提示框移除 + 新增 evaluateCirclesStep schema 表 + 4 個 error code 表
- [x] **批次 B（Phase 3 / 4 / error）mockup 解鎖**
- [x] Design system mockup v1 完成（13 sections）→ user 抓到漏洞 → 全盤掃描 122 項 UI（覆蓋率 47%）→ 擴充到 **21 sections**（補 example-bullet / save-indicator / toast / overflow / char-counter / phase-head / mode-tag / onboarding-coachmark），覆蓋率 ~85%
- [x] UI 覆蓋盤點存到 `docs/superpowers/specs/path-2-ui-coverage-audit.md`
- [x] **批次 A 01 — CIRCLES Home mockup 完成**（v2 — 7 sections × 3 viewport = 21 變化，新增 G 題目展開 + Q1 recent rail vs offcanvas 註解）
- [x] SP3 backend 兩階段 review 完成 → 找到 2 critical + 4 major + 3 minor 問題 → fix subagent 在背景跑（agentId `aa807c0e7618aa574`，自動通知完成）
- [ ] **NEXT — 雙軌等 user：** ①SP3 backend merge ②design system 放行
- [ ] SP3 backend merge → 更新 Master Spec §1.4 ⚠ 提示框移除
- [ ] design system 放行 → 開始批次 A 11 張畫面 mockup
- [ ] 14 張 mockup 全完成 + 逐張 user 放行
- [ ] `writing-plans` 產 CSS rewrite plan
- [ ] `using-git-worktrees` 開隔離分支（path-2-frontend）
- [ ] `subagent-driven-development` bundle-by-bundle 執行
- [ ] 每 bundle：webkit + chromium × 8 viewport 親看 PNG
- [ ] `finishing-a-development-branch` 14-box gate
- [ ] Merge to main

---

## Active Branches / Worktrees

| 路徑 | branch | 狀態 | 說明 |
|---|---|---|---|
| `/Users/albertpeng/Desktop/claude_project/First_Principle` | main | 主 repo | 已合併到 `05fee4f docs(audit): cycle 2026-04-30 Wave A+B+C+D 全收尾` |
| `/Users/albertpeng/Desktop/claude_project/first-principle-sp2` | feat/sp2-drill | **暫不 merge** | 28 commits，含功能改動（保留）+ CSS 反覆改動（廢棄） |
| 主 repo（已存在）| revise/sp3-alignment | 4 commits ready | SP3 spec/plan/mockup 對齊，等 Path 2 結束再評估 |
| **待建：first-principle-sp3-backend** | **feat/sp3-backend** | 待開 | SP3 Task 2-4：evaluator schema + routes timeout（與 mockup 並行）|

### SP2 worktree 處理計畫
**保留**：
- Phase undefined fallback / qchip step pill helper / drill rail / 題目過濾 / 搜尋 wire-up / mode-tag render / 新 jest 測試 / Phase 1 desktop max-width split

**廢棄**（會被 Path 2 新設計覆蓋）：
- chrome stripe padding 反覆改動
- offcanvas h-item / qchip step pill bg 顏色實驗

**最終策略**：Path 2 完成後從 main 重新長新 CSS；SP2 中的純 JS / jest 改動 cherry-pick 上 main，SP2 worktree 整支廢棄。

---

## Pending Workstreams

### Path 2 — Frontend Rewrite（in progress）
見上方 Path 2 進度區。

### SP3 — 評分深化 + 教練示範答案加深 + 結尾頁簡化
**Spec：** `docs/superpowers/specs/2026-05-02-sp3-score-coach-end-design.md`
**Plan：** `docs/superpowers/plans/2026-05-02-sp3-score-coach-end-plan.md`（11 tasks）

**決策：選項 A（後端先做）+ 與 mockup 並行**

**Backend bundle（in progress 待啟）— 在 worktree `feat/sp3-backend`：**
- Task 2 — jest 失敗測試（evaluator 新 schema）
- Task 3 — `prompts/circles-evaluator.js`：`coachVersion` string → `{ context, perField[], reasoning }`
- Task 4 — `routes/circles-sessions.js` + `routes/guest-circles-sessions.js`：error code (EVAL_TIMEOUT / EVAL_API_ERROR / EVAL_PARSE_ERROR / EVAL_AUTH_ERROR) + AbortController 30s timeout
- 完成 → merge main → 更新 Master Spec §1.4 + §2.9

**剩餘（Path 2 之後或合併進 Path 2 frontend bundle）：** Task 5-11（AppState / Phase 3 三分支 / collapsible / CSS / Playwright / iOS / sign-off）

### SP4 — NSM 升級（pre-gen + UI parity + Step 4 全 4 tab 重設計）
**Spec：** `docs/superpowers/specs/2026-05-02-sp4-nsm-upgrade-design.md`
**Plan：** `docs/superpowers/plans/2026-05-02-sp4-nsm-upgrade-plan.md`（12 tasks）

✅ **後端不衝突 — 可獨立早做：**
- Task 2 — 新檔 `scripts/backfill-nsm-context.js`（純寫 code，無花費）
- Task 3 — 跑 backfill（**一次性 OpenAI ~$0.30-0.50 / ~5min，不可逆，需 user 明確確認**），補 103 題 `q.context = {model, users, traps, insight}`

**剩餘（Path 2 之後）：** Task 4-12（Step 1 讀 q.context / desktop 3-col / Step 4 4-tab × 3 viewport = 12 區塊 / CSS / Playwright × 2 / iOS / sign-off）

### revise/sp3-alignment 分支
4 commits（59ee055 / f2bd7d8 / e5345ca / ec66220）— 全是 spec/plan/mockup HTML 對齊修訂、無生產 code。
**處理：** spec + plan 部分可 cherry-pick；mockup HTML 廢棄（Path 2 會重畫）。不急 merge。

---

## 視覺對齊測試 Stack（防止 SP2 那種 5 輪重做）

完整定義見 Master Spec §0.5 / §0.6 / §6.5 / §6.6。

8 層防禦：
1. Mockup-as-Spec baseline 凍結（per-state 矩陣 PNG）
2. Production ↔ Mockup pixel diff（threshold 0.5%）
3. Layout invariant assertion（boundingBox 數字級）
4. WebKit + Chromium 雙引擎
5. State matrix 覆蓋率自動 audit
6. Director eyeball walk（強制 `audit/eyeball-bundle-N.md`）
7. User 真機抽驗（最後守門）
8. Pre-commit + CI 機械擋 PR（連 user 不能 bypass）

**Bundle PR 必出 4 樣產出**（缺一不過）：jest log / Playwright log / `tests/visual/diffs/bundle-N-report.md` / `audit/eyeball-bundle-N.md`

**User 殺手鐧 3 問**（隨時可打）：
1. 「你 Read 過 PNG 沒？貼 viewport + 評論」
2. 「5 條 boundingBox invariant 數字」
3. 「mockup ↔ production diff 結果？引 report 路徑」

任一答不出 → 該 bundle 重來。

---

## Standing Rules（速查；完整版見 memory）

1. **CLAUDE.md 為即時狀態看板** — 變動即時 mirror（本檔）
2. **Mockup-first** — 所有 mockup 三裝置並排（mobile 360 / tablet 768 / desktop 1280）+ 真產品 CSS link + user 放行才實作
3. **無 emoji**，icons 用 Phosphor `ph-*`
4. **字型 system-ui**，grade letter A/B/C/D 例外用 Instrument Serif
5. **全 zh-TW** 對話與 UI 文案
6. **UI/UX 稽核必須親看 PNG**，不只 DOM assert
7. **iOS Safari 15-item checklist** 每次 ship 前必走（見 master spec §0.2）
8. **完工前必跑 jest + 全 8 Playwright viewport**，user 親驗
9. **Pitch-ready standard** — 1px 對齊嚴格、間距 4/8/12/16/24 倍數、無 magic top
10. **Path 2 期間不動 backend / API / prompts / DB / jest**

---

## Tests / Quality Gates

- jest 基線：146/146 passing（含 SP2 新增）
- Playwright：91/91 across 8 viewports（SP2 worktree 上）
- 8 viewport 列表：iPhone-SE / iPhone-14 / iPhone-15-Pro / iPad / Mobile-360 / Desktop-1280 / Desktop-1440 / Desktop-2560

---

## 已知 Open Issue / Blocker

- 無（等 user 審 Master spec）

---

## Plugin / Skill 盤點（2026-05-02 確認）

**superpowers** v5.0.7：using-superpowers / brainstorming / writing-plans / subagent-driven-development / executing-plans / using-git-worktrees / test-driven-development / systematic-debugging / requesting-code-review / receiving-code-review / finishing-a-development-branch / verification-before-completion / dispatching-parallel-agents / writing-skills

**frontend-design**（獨立 plugin）★ Path 2 主角 — 強制決定 bold aesthetic direction，排斥 AI-slop 通用美學

**code-review** plugin — `/ultrareview`（user 觸發）

**playwright** plugin — Playwright slash commands

**context7** MCP — 查最新官方 docs

---

## 文件索引

- **Master Spec：** `docs/superpowers/specs/2026-05-02-frontend-rewrite-master-spec.md`
- **歷史 specs：** `docs/superpowers/specs/2026-04-* / 2026-05-01-* / 2026-05-02-*`
- **歷史 plans：** `docs/superpowers/plans/`
- **CIRCLES DB：** `circles_plan/circles_database.json`（103 題）
- **NSM 規格：** `nsm_plan/nsm_trainer_full_spec.md`
- **Audit 截圖：** `audit/rwd-grid/<viewport>/`
