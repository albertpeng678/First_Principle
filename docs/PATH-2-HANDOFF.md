# Path 2 — Frontend Rewrite · 接手 Handoff

> 下個 session / 帳號接手用。**先讀本檔再讀 CLAUDE.md**。
> **Last updated:** 2026-05-03（Plan A Sub-bundle 1 完成 / 4 commits）

---

## 0. 30 秒進入狀態

User 是 PM Drill 專案 owner（zh-TW 母語、product/design sense 重、不寫程式但讀得懂）。當前在 **Path 2 — Frontend Rewrite**：把 production 前端 CSS + render 結構從 0 重寫，視覺對標 aistockmap.com（手機 web 滑順度）。**後端 / API / DB / OpenAI prompts / jest 100% 不動。**

進度：✅ Mockup phase 全完工（17 mockups + spec + 5 plan 寫好）／ ⏳ **Plan A 執行中**：Sub-bundle 1 完成（Tasks 1-4），Sub-bundle 2 待跑（Tasks 5-10：CSS tokens + 9 LOCKED chunks）。

**Worktree：** `/Users/albertpeng/Desktop/claude_project/first-principle-path2-foundation`
**Branch：** `feat/path-2-foundation`（4 commits ahead of main）

---

## ⚡ 加速策略（current — 5x faster than原估）

| 槓桿 | 作法 |
|---|---|
| Plan 平行 | A 序列；B/C/D 三 worktree **同時跑**（render 函式互不重疊）|
| Task 顆粒 | 4-8 task 一綑 sub-bundle 一次 dispatch（非 per-task）|
| Review | 機械 CSS 單階段；複雜 render 才雙階段 |
| Visual gate | 自動 pixel-diff CI；只 failure 才人工 |
| jest cadence | plan 起始 + 結束 + push（非 per-task）|
| iOS 真機 | 只 Plan E 結束驗一次 |

**新估時：** Plan A 1 天 / B+C+D 平行 4-5 天 / E 2-3 天 = **8-10 天總計**（vs 原 4-5 週）。

---

## 1. 你接手的當下要做什麼

```bash
cd /Users/albertpeng/Desktop/claude_project/First_Principle
git status              # 看當下 branch + working tree
git log --oneline -10   # 看最近 10 個 commit
cat CLAUDE.md           # 即時狀態看板
ls docs/superpowers/plans/2026-05-03-path-2-plan-*.md   # 5 個 plan
```

接手後**先做這三件事**：
1. 讀 `CLAUDE.md`（state board）+ 本檔
2. 讀 user 最近一則訊息（看當下要繼續哪個 plan / sub-bundle）
3. 用 Read 看實際工作中的檔案 1-2 個（不要憑記憶寫）

---

## 2. 現在 user 期待你做什麼

**進度：Plan A 全 5 sub-bundle 完成（18 commits）。** 等 user 做 director eyeball walk + signoff 後 merge → 開 B/C/D 三 worktree 平行跑。

接手第一步：
1. `cd /Users/albertpeng/Desktop/claude_project/first-principle-path2-foundation`
2. `git log --oneline main..HEAD` 確認 18 commits
3. 讀 `audit/path-2-plan-a-signoff.md`（14-box gate doc）
4. 跑 director eyeball walk（signoff doc §Director eyeball walk SOP）
5. user signoff → merge feat/path-2-foundation → main → 開 Plan B/C/D 三 worktree

### 14-box gate 狀態
- 13/14 ✓
- Box #11（director eyeball walk）= 待 user 跑

### Plan A 最終 SHA
```
3347c16 docs(plan-a): self-verify + user notify
fb0cba1 docs(plan-a): 14-box gate signoff prep
bf290a1 test(plan-a): jest 157 baseline regression
3d528f9 docs(plan-a): iOS Safari static checklist
502df3a test(plan-a): mark Playwright .skip
c655d6c feat(plan-a): renderNavbar + banners; smoke green
627fccf feat(plan-a): render dispatch + apiFetch 401
e84ba24 feat(plan-a): app.js skeleton AppState
a733a76 feat(plan-a): LOCKED · loading/error/form/panel
9b51d33 feat(plan-a): LOCKED · banner family
903ed3f feat(plan-a): LOCKED · circles-nav/qchip/submit-bar/phase-head
ae67a54 feat(plan-a): LOCKED · btn family
c41623f feat(plan-a): LOCKED · navbar
07bbae0 feat(plan-a): style.css tokens + base reset
ca806bb test(plan-a): smoke spec TDD red
c776159 feat(visual-test): 51 baseline PNGs
9d05a7b feat(visual-test): pixelmatch + screenshot helpers
602ef07 chore(plan-a): record baseline
```

### Sub-bundle 切分計畫（5 綑加速版）

| # | 範圍 | Tasks | 估時 | 狀態 |
|---|---|---|---|---|
| **SB1** | Setup + visual test infra + 51 baseline + smoke red | 1-4 | 30-60 min | ✅ DONE (4 commits) |
| **SB2** | style.css 全替換（tokens + 9 LOCKED chunks）| 5-10 | 45-60 min | ✅ DONE (6 commits, 4892→166 lines) |
| **SB3** | app.js skeleton（AppState + persistence + boot + listeners + render dispatch + renderNavbar + view stubs）| 11-13 | 60-90 min | ✅ DONE (3 commits, 7089→213 lines, smoke 3/3 綠) |
| **SB4** | jest + Playwright regression + iOS checklist | 14-16 | 30-45 min | ✅ DONE (3 commits, jest 133+24 skip = 157, iOS 11/15) |
| **SB5** | 14-box gate signoff doc + 自我檢查 | 17-18 | 15-30 min | ✅ DONE (2 commits) — **Plan A 整體完成** |

每 SB 結束後：spec compliance 自驗 → 進下一 SB。SB5 結束 → 等 user signoff merge。

---

## 3. Path 2 鐵則（違反就 BLOCK）

從 `CLAUDE.md` Standing Rules + memory 提煉：

1. **CLAUDE.md 即時更新** —— 每次重大事件即時 Edit，single source of truth
2. **後端 / API / DB / OpenAI prompts / jest 100% 不動** —— Path 2 範圍鎖死
3. **17 mockups 是 CONTRACT-LOCKED 視覺契約** —— implementer 開工必對 mockup；auditor PNG pixel-diff 0.5% threshold
4. **全 zh-TW，無 emoji，icons 用 Phosphor `ph-*`** —— mockup 15 §A3 凍結 icon 字典
5. **字型 system-ui stack**，grade letter 例外 Instrument Serif italic
6. **無紫色 `#5b21b6`** —— Path 2 用 navy `#1B2D5C`（mockup 15 audit 已掃過、5 既有檔已 patch）
7. **無黃色 toast / banner `#FFF8E7`** —— 警示用 navy 或 warn `#B85C00`
8. **mockup-as-Spec 嚴格遵守** —— mockup 偏離即 bundle 不過（spec §5.2）
9. **mockup 並排 frame 用 modifier class**（`.is-mobile/tablet/desktop`），**不用 @media**（mockup 14 揭示的 bug）
10. **每張 PNG ≥ 1 句評論** —— Director eyeball walk Layer 6（spec §0.5）

---

## 4. 5 plans 順序（不能跳）

| # | Plan | 狀態 | 路徑 |
|---|---|---|---|
| **A** | Foundation（tokens + LOCKED chunks + AppState + router）| ✅ **完整 18 tasks** | `docs/superpowers/plans/2026-05-03-path-2-plan-a-foundation.md` |
| B | CIRCLES Core（home / phase 1-4）| 📋 stub，待 A merge 後展開 | `..../path-2-plan-b-circles-core.md` |
| C | NSM（step 1-4）| 📋 stub，待 B merge 後展開 | `..../path-2-plan-c-nsm.md` |
| D | Cross-cutting（offcanvas / onboarding / toast / modal）| 📋 stub，待 C merge 後展開 | `..../path-2-plan-d-cross-cutting.md` |
| E | Edge & Transitions（drill 跳轉 / sim transition / SSE 重發 / 401 / 8 viewport regression）| 📋 stub，最後 plan | `..../path-2-plan-e-edge-transitions.md` |

每個 plan **獨立 worktree、獨立 14-box gate、獨立 merge**。Plans B-E 的 stub 寫好 scope/dependencies/sub-bundle 大綱；要展開為完整 ~50-70 task 版時，**對著 user 跑一輪 brainstorming → 再寫**。

**估計：250-300 tasks 總計 / 110-130 hr 真實工時 / 2-7 週日曆時間（取決於 user 投入頻率）**

---

## 5. 17 mockups 索引（CONTRACT-LOCKED）

`docs/superpowers/specs/mockups/2026-05-02-frontend-rewrite/`

| # | 檔案 | 內容 |
|---|---|---|
| 00 | design-system | 21 sections design tokens + LOCKED chunks |
| 01 | circles-home | A-G 7 sections + v5 對齊缺口 |
| 02 | auth-flow | 登入登出 |
| 03 | phase-1-form | 4-field form + hint overlay + 7 sections |
| 04 | phase-1-5-gate | 三態 gate + loading |
| 05 | phase-2-chat | 三角色 bubble + 4 底部 state |
| 06 | nsm-step-1 | 5 卡 + 4-欄 context + 3-col rail |
| 07 | nsm-step-2 | 步驟 2/3 sub-tabs + 4-dim 動態 label |
| 08 | nsm-step-3-gate | 5 維度檢核三態 + loading |
| 09 | offcanvas-history | drawer 280px + 4 狀態 |
| 10 | onboarding | welcome + 4-step coachmark tour |
| 11 | phase-3-score | 評分頁 4 sections + coach demo |
| 12 | phase-3-error-loading | error 變體 + slow loading |
| 13 | phase-4-final | grade + 7-axis radar + step-rows + nested NSM 4 dim |
| 14 | nsm-step-4 | 4 tabs + 教練思路展開 panel（5 sections）|
| 15 | error-empty-collation | §A 規約字典 6 表 + §B-D 全集 |
| 16 | flow-transitions-edge | drill 跳轉 / sim transition / SSE 重發 / Phase 3 切離（4 sections）|

---

## 6. 關鍵 spec 章節（implementer 開工前必讀）

`docs/superpowers/specs/2026-05-02-frontend-rewrite-master-spec.md`

| 章節 | 重點 |
|---|---|
| §0.2 | iOS Safari 15-item checklist |
| §0.5 | 8 層視覺對齊測試 stack（含 Layer 1.1 baseline 截圖規範）|
| §0.6 | tests/visual/ 子系統規範 |
| §1.1-1.8 | Backend contract（CONTRACT-LOCKED 不准改）|
| §1.5.1 | Multi-tab + 401 mid-action（已對齊：SSE **無 resume**，重發是新一輪）|
| §1.7 | Static asset paths LOCKED（`/index.html /app.js /style.css`）|
| §2.1 | AppState 結構 |
| §2.10 | Navbar CONTRACT-LOCKED 結構 |
| §2.12 | Design tokens |
| §2.14 | **State ↔ Mockup CSS class 映射表**（implementer 寫 render 必查）|
| §3.x | Domain logic（CIRCLES 7 步 / NSM / 評分公式 / magic numbers）|
| §4 | 清理候選（**`renderHistory` 已 deprecate**，全頁 history view 砍）|
| §5.1 | Mockup index 含完整每張 mockup spec 描述 |
| §5.2 | Mockup-as-Spec 嚴格遵守規則 |
| §6.2 | Bundle 完工 14-box gate 強制產出 |

---

## 7. User 工作模式（觀察累積）

- **語言：** 全 zh-TW，技術詞穿插英文 OK
- **節奏：** 一張 mockup 一張 mockup 過，習慣「go」開工 + 「通過」放行 + 具體修改意見
- **review 嚴格度：**
  - 喜歡親看 PNG（會直接貼圖回 issue）
  - 對「奇怪顏色 / 太多色」敏感（→ navy 中性原則）
  - 不喜歡虛構（mockup 16 §E migration 因為 production 沒功能就刪掉，不畫不存在的東西）
  - 「設計前必須驗證現有產品」的 standing rule（memory：`feedback_design_after_verifying_product.md`）
- **抽問 SOP（user 殺手鐧 3 問）：**
  1. 「你 Read 過 PNG 沒？」
  2. 「5 條 boundingBox invariant 數字」
  3. 「mockup ↔ production diff 結果？」
  任一答不出 = bundle 重來
- **commit message 風格：** zh-TW 主標題 + bullet 列表，含 Co-Authored-By

---

## 8. Memory 必讀（接手後立刻載入）

`/Users/albertpeng/.claude/projects/-Users-albertpeng-Desktop-claude-project-First-Principle/memory/`

`MEMORY.md` 內容會自動載入。重點 memory：
- `feedback_mockup_first.md` — Every plan must embed mockup; get 「放行」 first
- `feedback_design_after_verifying_product.md` — 開工前必驗 production
- `feedback_locked_components_reuse.md` — 03 起 LOCKED CSS 不准重定義
- `feedback_mockup_self_verify_playwright.md` — Chrome 給 user 看是 user 評閱不是自驗，要 Playwright 截圖 + Read PNG 自驗
- `project_circles_methodology.md` — CIRCLES 7 步完整 reference
- `feedback_full_sit_uat_uiux.md` — director 簽收前必跑全 8 viewport
- `feedback_discipline_enforcement.md` — 強制產出物 + CI gate + 殺手鐧抽問三件套

---

## 8.5 Plan A 已知問題（carry forward — user 同意 2026-05-03）

| # | 問題 | 必修 Plan | 詳細 memory |
|---|---|---|---|
| 1 | Mobile-360 navbar tabs 擠壓（CIRCLES 變直立橢圓 / 北極星指標直排）| Plan B | `project_path2_known_issues.md` |

Plan B 開工前 implementer 必讀此節 + 對應 memory；Plan B merge 前必再開 port 給 user 親跑 mobile-360 確認修好。

---

## 9. Plan A SB1-4 完成（commit hashes）

`feat/path-2-foundation` 16 commits ahead of main：

| SB | Tasks | Commits |
|---|---|---|
| 1 | 1-4 setup + visual infra + 51 baselines + smoke red | 602ef07 / 9d05a7b / c776159 / ca806bb |
| 2 | 5-10 style.css tokens + 9 LOCKED chunks (4892→166) | 07bbae0 / c41623f / ae67a54 / 903ed3f / 9b51d33 / a733a76 |
| 3 | 11-13 app.js skeleton (7089→213) + smoke 3/3 綠 | e84ba24 / 627fccf / c655d6c |
| 4 | 14-16 jest 157 (133+24 skip) + Playwright .skip + iOS 11/15 | bf290a1 / 502df3a / 3d528f9 |

**Plan B/C 必須處理的 24 jest skip：**
- Plan B 接 4 檔（sp1.5-helpers / locked-banner / bugfix-helpers / bugfix-action-bar）
- Plan C 接 2 檔（sp4-nsm-context / sp4-nsm-db-extraction 1 test.skip）

詳：worktree 內 `.plan-a-baseline.md`

---

## 10. 最近重要決策（Bundle 0 補洞）

`commit f794a4c` Bundle 0 readiness：
- §1.5.1 multi-tab + 401 + SSE 重發（**無 resume**）+ Phase 3 loading 切離
- §0.5 Layer 1.1 baseline 截圖規範（凍 animation / wait fonts）
- §2.14 State ↔ Mockup CSS class 映射表（implementer 開工必查）
- §4 `renderHistory` 全頁 view 砍（offcanvas 取代）
- mockup 15 §A 擴張 6 表（A4 Class Naming / A5 Button → AppState / A6 Copy 常數規則）
- mockup 16 新建（drill 跳轉 / sim transition / SSE 重發 / Phase 3 切離 — **§E migration 已刪**）

`commit db9d105` 對齊 production：
- mockup 16 §C SSE：「繼續」→「重新發送」（後端無 resume）
- mockup 16 §E migration 整段刪（production silent fetch 無 UI 可 mockup）

---

## 11. 接手 checklist（你做這幾件就上手）

- [ ] 讀本檔（30 秒）
- [ ] 讀 `CLAUDE.md`（state board）
- [ ] 讀 `MEMORY.md` index
- [ ] `git log --oneline -20` 看最近 commit
- [ ] 看 user 最後一則訊息決定下一步
- [ ] 不確定的事先問 user，不要 fabricate
- [ ] 任何重大事件即時 update CLAUDE.md + 本檔
- [ ] 執行 plan 前先 `git status` 確認 branch + working tree
- [ ] 自驗 mockup：Playwright 截圖 + Read PNG，不只給 Chrome 看
- [ ] commit 用 HEREDOC + Co-Authored-By: Claude Opus 4.7 (1M context)

---

## 12. 隨時更新規則

當以下事件發生，立刻在本檔更新對應段落：
- 任何 plan merged → 更新 §4
- 任何 mockup 修改 → 更新 §5
- 任何 spec 章節修改 → 更新 §6
- 任何重大決策 → 寫入 §9（注意 commit hash）
- User 提出新 standing rule → 寫入 §3 + 新 memory file
