# PM Drill — 專案狀態看板

> 即時狀態 single source of truth。**不放歷史（git log 有）**。重大事件即時 Edit。
> **Last updated:** 2026-05-22 — **Wave 1.5 hint-modal ship `0776f7b` push origin/main**

## 當前狀態（30 秒讀完 — 2026-05-22）

### 🟢 Wave 1.5 共用層 refactor — 8 commits 上 origin/main

| Component | Commit | inline → helper |
|---|---|---|
| gate-transition | `348cf49` | 2 → renderGateTransition |
| gate-item (含 mockup 08 unify) | `05ef606` | 2 helper 合一 + mockup 04 canonical |
| phase-head | `baa8e78` | 8 → renderPhaseHead |
| submit-bar | `0aa43a4` | 12 → renderSubmitBar |
| qchip (2026-05-22 ship) | `de1ceba` | 6 → renderQchipShell |
| error-wrap (2026-05-22 ship) | `85e8a5e` | 5 → renderErrorWrap |
| banner (2026-05-22 ship) | `a8b478f` | 4 → renderBanner |
| **hint-modal** (2026-05-22 ship) | **`0776f7b`** | **3 → renderHintModal** |

**累計 42 inline call sites → 8 helpers**。全 byte-perfect equivalent (banner offline caller 是 whitespace-equivalent)，Plan A 結構性 only，0 user-visible UX 變動。

### Wave 1.5 hint-modal 驗證（本次 ship）
- Mechanical byte-equivalence: **3/3 PASS** (/tmp/verify-hint-modal.js)
- Cross-vp 5× serial × nsm-hint-ui-flow.spec.js: **70/70 GREEN (14 × 5) 0 flake** across e2e-desktop + e2e-mobile-chrome + e2e-mobile-safari
- NSM step 1 教練思路 modal skip (extra aria-label per Karpathy §4.2)
- Pre-commit race regression: 13/13 PASS

### Wave 1.5 banner 驗證（前次 ship）
- Mechanical 4/4 PASS, 190/220 cross-vp GREEN, 6 fail = pre-existing nsm-checkpoint (tracker P2-NCK-1)
- gate-loading ⏭ skip (drift 太多 ROI 差，tracker P2-GL-1)

### Wave 1.5 error-wrap 驗證（前次 ship）
- Mechanical byte-equivalence: **6/6 PASS** (/tmp/verify-error-wrap.js)
- 15 PNG cold-Read × 5 surface × 3 vp (audit/error-wrap-refactor-2026-05-22/)
- **5 e2e specs × 5 consecutive runs × 3 viewport = 175/175 GREEN, 0 flake**:
  - wave1-fct1.3 CIRCLES gate: real gate → result → reload DB 持久化 verified
  - wave1-fct1.4 NSM gate i18n × 3 AC (429 / 503 / network abort)
  - circles-phase3-restore-real / nsm-evaluator-error / circles-phase2-evaluator-error
- Pre-commit race regression: 13/13 PASS

### Wave 1.5 qchip 驗證（前次 ship）
- 機械等價: **7/7 byte-perfect** (`/tmp/verify-qchip-equivalence.js`)
- 18 PNG cold-Read × 6 surface × 3 vp: 全綠 (`audit/qchip-refactor-2026-05-21/`)
- Opus 嚴審 reviewer (`a845836158ab29ace`): **APPROVED**（引 mockup 03/04/05 line cross-check）
- e2e-desktop wave1-b6 5× serial: **8/8 every run**
- e2e-mobile-chrome/safari 6 fail = pre-existing（stash 對照同 fail）→ tracker P2-Q-3
- N1 (caret-right pre-existing drift) → tracker P2-Q-1；N2 helper comment + N3 JSDoc safety contract 已修
- Pre-commit hook race regression: 13/13 PASS

### Wave 1.5 earlier 驗證
- 機械字串等價: 29/29 byte-perfect (gate-transition 6+gate-item 5+phase-head 8+submit-bar 10)
- jest baseline: 607/624 (17 skip, 0 fail)
- iOS Safari 15-item: N/A (HTML-string only refactor)

### ⏸ 下次接手 priorities

per `audit/wave-component-inventory-spec.md` §D:
- **Batch 2 剩餘**: field (qchip ✓ ship 2026-05-22)
- **Batch 3**: error-wrap / gate-loading / banner
- **Batch 4**: bubble / modal / circles-nav drift / mode-tag / type-tabs
- **Batch 5 (defer)**: toast (mockup 有 production 0) / mode-card

### 🟢 Wave 1 完成 (2026-05-19/20) — 7 commits

| Commit | 內容 |
|---|---|
| `1826cfc` C1 | F-CT2.1 q3 卡片不再建空白 session（NSM 99.9% lifecycle='created' 主因） |
| `3dcd285` C2 | B6 mockup 04 11 處 drift 對齊 |
| `d1045d3` C3 | F-CT1.3 backoff 800/1600ms + 5 spec wire testMatch |
| `9c2173d` C4 | B13 prompt 學員低分禁讚美詞 (37/37 adversarial) |
| `91061d3` C5 | W1-補.7 NSM 錯誤中文化 + offcanvas WebKit |
| `50d37f2` C6 | Phase A infra (4 c-drift accounts + AppState 4 keys) |
| `5547081` C0 | 736 files audit 文件批次封存 |

### 🔴 既有 P0/P1 其他線 (active，未動)

**Phase 2 Wave 2 BLOCKED 2026-05-19** — quiz reviewer 抓 **7 critical gap**：

**Phase 2 Wave 2 BLOCKED 2026-05-19** — quiz reviewer 抓 **7 critical gap**：
- 4 implementer parallel 違反 RITUAL §7.3 上限 3
- drainSessions 跨 commit user 互殺（共用 test user）
- AppState 3 commit 衝突（`nsmRecentSessions` / `nsmGateInflight` / `nsmPhase2SaveState` 跨 C-Drift-2/3/4）
- HITL 16 review (4 commit × 4 review) 過載 → 8 hr budget overrun
- D-11/D-12 mockup 06+07 未準備違反 `feedback_mockup_first`
- 加上 fixture contamination 風險 + cleanup 順序 race（GAP-1/5）

**Phase A prep 進度**:
- ✅ **GAP-2 解** — 4 unique test users provisioned (`scripts/register-c-drift-test-accounts.js`, `tests/setup/auth.setup.js` +98 lines, `C_DRIFT_LANES` array, 4 storageState path)
- 🟡 **GAP-3 plan** — `audit/phase-a-prep-appstate-atomic-commit-plan.md`（4 AppState keys 拆 commit 邊界 + namespace lock，~30 min ship）
- 🟡 **GAP-6 mockup 06+07 draft** — in flight (sub-agent `acf745cb`)
- 🟡 **GAP-1/4/5/7 mitigation** — in flight (sub-agent `ab6d77c5`) → `audit/phase-a-prep-gaps-1-4-5-7-mitigation.md`
- ✅ **Mockup decision A** (2026-05-19): C-Drift-3/4 不再 mockup-blocked，直接 reuse 既有 design contract（mockup 06 `.nsm-recent` line 483-518 + mockup 03 `.save-indicator` LOCKED cross-mockup reuse）
- 📌 **STANDING 升級**: mockup 工作全 opus，禁 sonnet（per `feedback_uiux_visual_only` 親 cold-Read mandate）

**下一步**: Phase A prep 4 task 全 ship → re-quiz reviewer → 7 GAP 全 PASS → Wave 2 dispatch（**2a: C-1+C-2 parallel** → **2b: C-3+C-4**；限 ≤ 3 implementer 同時跑）

**🔥 Wave 2 重大 finding (drift scan 2026-05-19)**: D-2 NSM localStorage 寫但 0 處讀 → **可能解釋 NSM 99.9% lifecycle='created' drop 主因**；D-1 NSM PATCH 無 persistRetry（同 P0-#266 CIRCLES shape）

### ⚠️ Sub-agent self-report fake history (本 session 4 次命中)
- D 自報 50/50 → reviewer 真 26/50
- a77f08b8 W1-補.7 fix 自報 50/50 → reviewer 真 49/50
- B6 5x verifier monitor timeout 無驗
- 第一輪 F1 fix 範圍判斷錯（只改 1 reload 漏 3 個）— 但**誠實 STOP 沒 cherry-pick**（強 prompt 終於奏效）
- **HITL 必須 paste 完整 stdout × 5 run**（per `feedback_subagent_self_report_unverifiable` STANDING 強化）

### Historical ship summary (上一輪 session，詳見 git log + tracker §5)

- **🏆 本 session Phase 1 + Phase 1B Wave a/b 全 ship (2026-05-17 PM)**：
  - `b126937` **Wave 1B-b**: NEW-Bug-A NSM 切題 ghost content (mirror CIRCLES #252 c156c6b 10-line reset) + NEW-Bug-B PNG-31 NSM hint+example position (mockup 07 line 1355-1384 canonical pattern) + F-CT1.2 CIRCLES Phase 2 silent fail (fetch→apiFetch+circlesPhase3Error setter) + **7 個 reviewer-caught Critical 補修**（2 cross-spec drift + 2 untracked spec + 1 dead var + 1 missing auto-cleanup + 1 comment line# error）
  - `1b75c0f` **Wave 1B-a**: F-CT1.1 NSM evaluator spinner 卡死 (1 line) + B6 D-4 warn icon 顏色相反 (1 char swap `ph-warning`→`ph-check-circle`)
  - `e811378` **Wave 1 B10 / O-6**: `_doOffcanvasDelete` invalidate `circlesRecentSessions` cache (2 lines)
  - 前序 Phase 1 find 完成：C-T1 (4 AI surface error audit, 5 findings P1-P3) / C-T2 (NSM 99.9% drop 線上深挖 — q3 卡片即建 session 5487 噪音 + 真實 S2→S3 42.9% drop) / B6 mockup 04 pixel-diff (11 drift vs 估 9) / B13 adversarial 擴 3 prompt (sub-agent silently failed — re-dispatch needed)
- **舊 Live-demo-gate session 上一輪 (2026-05-17 PM)** — 7 commits：
  - `c70b8e9` mockup-07 砍 9 行 orphan hint（align production renderNSMContextCard）
  - `a221cf0` **F-2 prod CSS bug** — `.nsm-body` padding-bottom 修 sticky bar 蓋 mobile first field（director walk 3 vp 確認）
  - `d2d1d2f` **F-1 test fixture** — walk spec 換真 Netflix q1 shape
  - `e883eb8` **C fix 401 auto-logout** — apiFetch refreshSession→retry + onAuthStateChange TOKEN_REFRESHED sync（Supabase canonical pattern via WebSearch）
  - 配套：director walk infra (27 PNG × 3 vp) + apiFetch-401-refresh-retry spec (6/6 × 3 vp GREEN) + tracker §5 sweep + 3 STANDING memory (plain-language / sound-ping / live-demo-gate) + UserPromptSubmit hook inject ritual-mini per 7 messages
- **Live Supabase insight (2026-05-17 PM)**: nsm_sessions 6500 rows, lifecycle 'created':999 vs 'gated':1 = **99.9% NSM 沒完成** — F-2 修了應該大幅改善 conversion，可追蹤
- **🏆 7/7 P0 RESOLVED 上一輪 session ship (2026-05-17)** — 4 user-reported + 3 e2e-discovered，全 commit GREEN：
  - #251 Bug 1 全 Y 過審 → L2 backend + L10 LEAK-A + L13 fix `85f0039`
  - #252 Bug 2 ghost content → L4 RED + L11 reset `c156c6b`
  - #255 Bug 6 沒審核放行 → L3 RED + L5 8 handler guards `93b1b26`
  - #263 iOS Safari Phase 3 → L1 already-shipped `654d0e8`
  - **NEW #266** persistRetry session-object → L14+L16 dual fix `91fb2ad`（同解 Plan #194 T4 TC1 timeout）
  - **NEW #267** Bug 3 spinner stuck (reclass P2→P0) → L13b RED + L16+L17 fix `2aa8fd5`
  - **NEW #268** NSM /evaluate bypass → L18 RED + L19 fix `9142eef`
- **4-pillar preventive sweep COMPLETE (2026-05-17 PM)** — L2 CIRCLES gate + L9 NSM gate + L12 CIRCLES evaluator + L15 NSM evaluator 全綠（adversarial 7-10 變體 max totalScore=40 < 60）
- **O-7 closed**：L20 NSM seed helper unblock B4-E3 + 確認 NSM delete cache **無 leak** (`f292a22`+`961cb09`)
- **O-9 closed**：L23 orphan renderQchipPanelHtml 15 lines delete `f2a3d58`
- **P1-#264 reclassified**：L22 audit `36f4ba2` — 非 auth race，**Supabase DB session collision** under concurrent CLI burst；L25 fix in flight
- **🚨 PUSH BLOCKED (P0-NEW-6)**：cross-plan smoke 抓 5 API + 7 e2e test fixture drift（L5+L19 lifecycle guard 加完沒同步部分 spec）；L24 fix in flight
- **本 session 累計 commits**: `069986e..f2a3d58`（37+ commits 待 push origin/main）
- **CIRCLES chat drift + lock-on-back ship (2026-05-17 AM)**：早 ship。UAT SOP `audit/sop-2026-05-17-circles-lock-and-qchip-uat.md`
- **Stage 0 ship (2026-05-16)**：B7 prod 污染清理 + prevention infra（env-guard / auto-cleanup fixture / pre-commit hook / 3-env split / `e2e@first-principle.test`）+ 2 條 STANDING memory（three_iron_laws / e2e_real_data_only）+ skill 整合 plan ship。15 commits `4dba816..1ba062e`；jest 45/45；V2 security-review PASS WITH NOTES。
- **Stage 1A gate cluster (B1+B6) ship (2026-05-16)**：T1-T12 implementer 完成，T13 jest 410/428（1 pre-existing fail，無 regression）；T14 + T15 收尾待跑。
- **Stage 1B CLOSED (L29 2026-05-17)**：B3 (Phase 3 spinner stuck on restore) + B4 (offcanvas delete cache race) 全船；B3-R1 parallel flake 修 via per-project question ID map；audit `audit/L29-1b-state-cache-completion-2026-05-17.md`；closes #191。
- **Stage 1C/1D specs (2026-05-16)**：brainstorm 完 → `8ca4b81`（1C）/ `93d2695`（1D）— 等 user 放行才 dispatch impl。
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

### Phase 計畫 — B+C 全收（user 立 2026-05-17 PM Live-demo-gate session）

> **規矩**：所有新 task 一律 **find-first → log tracker → user brainstorm → 才 fix**（per `feedback_find_first_fix_later_via_tracker.md`）。
> **完整 task 描述** + 規格 → `docs/PATH-2-HANDOFF.md` §A.5。

| Phase | 範圍 | 工時 | 任務 |
|---|---|---|---|
| **🔴 P1 ✅ DONE** | 商業最痛 | ~1-2 天 | C-T1 ✅ find / C-T2 ✅ find / B10 ✅ ship / B6 ✅ find (D-4 ship; 10 drift backlog) / B13 ⚠️ re-dispatch needed |
| **🟠 P2** 覆蓋率擴張 | ~2-3 天 | C-T3 CIRCLES director walk / C-T4 find (新用戶 journey 斷點 log) / C-T6 8 vp 擴 e2e config / B1 #257 F-007 wave Phase A (20 specs) |
| **🟡 P3** Robust 防護 | ~2-3 天 | C-T5 iOS Safari 15-item 自動化 / C-T10 cross-tab+device race / C-T11 a11y baseline / B1 #257 F-007 wave Phase B (30 specs) / B2 F-001 Trophy +30 API specs |
| **🟢 P4** Polish + debt | ~1-2 天 | C-T12 perf budget gate (LCP/TTI/3G) / B7-B14 雜項 (dead code/O-5/fallback flag/refactor/O-8 process) / B3 #207 B5 decision / B4 #199 dup close / B5 #205 Retrofit G |
| **🔴 P1B 加碼 ✅ ship** | user-reported + reviewer-caught | 半天 | NEW-Bug-A ✅ / NEW-Bug-B ✅ / F-CT1.1 ✅ / F-CT1.2 ✅ / B6 D-4 ✅ + 2-stage review × 3 × 7 Critical 補修 |

**Director 接手節點**（compact 後直接照 phase 動工）：
1. 開 session 讀本檔 + PATH-2-HANDOFF.md §A.5 + tracker §1-§3
2. 從當前 phase 第 1 個 task 起跑
3. find-phase task → 不 commit production，只 append tracker
4. fix-phase task → Live demo gate（stage → PNG → user 對 → commit）

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
| 主 repo | main | Phase 1 + 1B Wave a/b 全 ship (b126937 / 706d26c / 1b75c0f / e811378); jest 562/579 (0 fail) |
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

- **jest 基線 (2026-05-17 PM post Wave 1B-b)：** **562/579**（17 skipped，0 fail；前序 Wave 1B-a 跑 593/610 含本批新 spec）
- **API integration tier：** 180 specs，post-L24 expected 全綠（current 5 fail = test fixture drift, L24 in flight）
- **E2E projects：** 3（e2e-desktop / e2e-mobile-chrome / e2e-mobile-safari）+ 11 api projects + visual specs
- **4-pillar adversarial preventive sweep (NEW 2026-05-17)：** ✅ L2 CIRCLES gate + L9 NSM gate + L12 CIRCLES evaluator + L15 NSM evaluator 全綠 — 所有 AI prompt 抗 low-quality + meaningless input proven robust
- **Adversarial sweep (jest)：** `npm run test:adversarial` — 5 + 1 stages × 10 cases，所有新 AI 審核/gate/評分 ship 前必跑
- **Cross-plan smoke (per memory `feedback_cross_plan_smoke_after_each_ship`)：** 每次 major ship 必跑 — 本 session 抓出 P0-NEW-6 regression cluster 證明此 gate 不可省

---

## 文件索引

- **Master Spec：** `docs/superpowers/specs/2026-05-02-frontend-rewrite-master-spec.md`
- **接手 Handoff：** `docs/PATH-2-HANDOFF.md`
- **UI 覆蓋盤點：** `docs/superpowers/specs/path-2-ui-coverage-audit.md`
- **CIRCLES DB：** `circles_plan/circles_database.json`（103 題）
- **NSM 規格：** `nsm_plan/nsm_trainer_full_spec.md`
- **Plugins：** superpowers v5.1.0 / **frontend-design (取代 ui-ux-pro-max 2026-05-17)** / code-review / playwright / context7 / karpathy-skills / **ruflo**（core/swarm/autopilot/federation）/ **addyosmani/agent-skills**（23 skills + 7 commands + 3 personas）
