# Wave 1 C1-C6 — 每批要 stage 哪些檔案（D0 hand work）

> Director 親手分類，避免 sub-agent 分錯。等 user 回 Supabase 截圖後，按此 plan 一批一批 `git add` + `git commit` + user gate。

---

## 目前狀況

- 共 214 個檔案改動
- 92 個已存在檔案被修改
- 120 個新增檔案
- 已分類好：2 個（屬於第 4 批 B13）

---

## 第 1 批 C1 — q3 卡片不再悄悄建空白 session

**主題**：用戶點 NSM 題目卡片時，不再立刻建立空白資料庫紀錄。

**檔案清單**：
- `public/app.js` （只動 line 6394 附近，移除 `ensureNsmDraftSession().catch(...)`）
- `tests/e2e/nsm-step1-card-click-no-session.spec.js` （新增測試）
- `audit/F-CT2.1-evidence/` 整個資料夾（新增 30 張截圖）
- `audit/補修-fct2.1-findings.md` （新增 audit 文件）

**為什麼這批**：解 NSM 99.9% 空殼資料的主因（q3 卡片 click 立刻 INSERT 5487 個空 row）

---

## 第 2 批 C2 — 設計稿 mockup 04 跟產品 11 個不一致 + Bug B 邊距

**主題**：審核頁的 11 個小細節跟設計稿不一樣，全部對齊。

**檔案清單**：
- `public/app.js` （只動 line 5136-5240，renderCirclesGate 區段）
- `public/style.css` （加 `.gate-item__suggestion-body` 規則）
- `tests/visual/wave1-b6-mockup04-drift-fix.spec.js` （新增）
- `tests/visual/wave1-b6-mockup04-drift-fix.spec.js-snapshots/` （44 張新基準圖）
- `tests/visual/circles-gate.spec.js` （line 88+105 從 4 改 5）
- `scripts/capture-mockup-04-baselines.js` （新工具腳本）
- `audit/known-fail-registry.md` （新）
- `audit/wave1-task-5-findings.md` （新）
- `audit/補修-b6-findings.md` （新）
- `audit/B6-mockup04-audit/` 整個資料夾（新）
- `tests/e2e/wave1-b6-circles-phase1-to-gate-real-flow.spec.js` （新）

**Commit message 必含**：`known-skip: AC-3 (O-13 backlog)` 註記（暫時跳過 1 個視覺測試，已 logged）

---

## 第 3 批 C3 — 審核服務遇 429 加重試間隔

**主題**：當 OpenAI 連續打不通時，間隔 800ms / 1600ms 重試。

**檔案清單**：
- `prompts/circles-gate.js` （line 119 加 1 行）
- `tests/circles-gate-backoff.test.js` （新增單元測試）
- `tests/e2e/wave1-fct1.3-circles-gate-backoff-real-flow.spec.js` （新增 e2e 測試）
- `audit/補洞-fct1.3-e2e-findings.md` （新）

---

## 第 4 批 C4 — 教練評語不再誇爛學員（B13 prompt fix）

**主題**：學員分數低於 60 時，教練不准用「良好/亮點/可圈可點」等讚美詞。

**檔案清單**（部分已 staged，需補 untracked）：
- `prompts/circles-final-report.js` ✅ 已分類好
- `tests/adversarial/circles-final-report-adversarial.test.js` ✅ 已分類好
- `tests/adversarial/circles-conclusion-check-adversarial.test.js` （新增，需補 add）
- `tests/adversarial/circles-coach-version-adversarial.test.js` （新增，需補 add）
- `tests/e2e/wave1-b13-prompt-regression-smoke.spec.js` （新增）
- `audit/B13-NEW-B13-W1-prompt-fix-scope-brainstorm.md` （新）

---

## 第 5 批 C5 — NSM 審核錯誤中文化 + offcanvas 跨瀏覽器修

**主題**：3 個 bug 一次修：
1. NSM 審核失敗時顯示中文錯誤訊息 + 重試按鈕
2. iPhone Safari 在 offcanvas 抽屜偶爾卡住
3. 測試文件預期 4 個維度但產品已剩 3 個

**檔案清單**：
- `public/app.js` （line 2027 + line 1463-1465 + line 1682-1684 + 約 200 行中文錯誤介面）
- `routes/nsm-sessions.js` （後端錯誤碼分類）
- `tests/e2e/wave1-fct1.4-nsm-gate-error-i18n.spec.js` （新增，含 4 個 page.reload 修正）
- `tests/visual/nsm-gate-inline.spec.js` （line 213 NIT）
- `tests/visual/nsm-step-2-3.spec.js` （4→3 維度修正）
- `tests/e2e/offcanvas-delete.spec.js` （加 waitForResponse + 拉長 timeout）
- `tests/e2e/offcanvas-delete-invalidates-recent-sessions.spec.js` （drainSessions 助手）
- `audit/補修-offcanvas-flake-fix-findings.md` （新）
- `audit/F-CT1.4-evidence/` 整個資料夾（新）

---

## 第 6 批 C6 — Wave 2 預備：4 個獨立測試帳號 + AppState 4 個新欄位

**主題**：未來大重構需要的基礎建設 — 給 4 個分散測試帳號避免互相污染，加 4 個前端狀態欄位。

**檔案清單**：
- `scripts/register-c-drift-test-accounts.js` （新建腳本）
- `tests/setup/auth.setup.js` （加 +98 行 4 帳號設定）
- `public/app.js` （加 4 個 AppState 欄位，僅宣告不接 logic）
- `tests/appstate-phase-a-prep.test.js` （新增單元測試驗 4 欄位存在）
- `audit/phase-a-prep-appstate-atomic-commit-plan.md` （新計畫文件）

---

## 第 0 批（額外）C0 — Session 過程文件整理

**主題**：這次 session 過程產生的所有 audit 報告、計畫、cheat-sheet 等文件，跟產品 bug 修法無關，獨立整理。

**檔案清單**（38 個 audit 文件 + 多個資料夾）：
- `CLAUDE.md` （session 狀態看板更新）
- `audit/e2e-master-tracker.md` （單一 source of truth 更新）
- `docs/PATH-2-HANDOFF.md` （接手文件更新）
- `audit/nsm-circles-drift-scan-2026-05-19.md`
- `audit/supabase-nsm-schema-data-audit-2026-05-19.md`
- `audit/supabase-full-schema-strict-audit-2026-05-19.md`
- `audit/wave-3-readiness-cheat-sheet.md` 跟 v2
- `audit/wave-3-readiness-quiz-2026-05-19.md`
- `audit/p1.1-step3-*.md` （多個 audit）
- `audit/p2-c-drift-{1,2,3,4}-plan.md`
- `audit/p2-c-drift-f-ct1.4b-circles-emessage-leak-plan.md`
- `audit/eyeball-c-drift-{1,2,3,4}-template.md`
- `audit/d-2-localStorage-hypothesis-verification-plan.md`
- `audit/F-CT1.4b-circles-emessage-leak-audit.md`
- `audit/diagnose-offcanvas-delete-flake-2026-05-18.md`
- `audit/offcanvas-delete-spec-2-prexisting-fails-rootcause.md`
- `audit/phase-a-prep-gaps-1-4-5-7-mitigation.md`
- `audit/wave-2-implementer-dispatch-prompt-template.md`
- `audit/wave-1-c1-c5-commit-messages-draft.md` 跟本檔
- `scripts/audit-supabase-schema-data.js` （audit 腳本）
- `scripts/audit-supabase-full-schema-strict.js` （audit 腳本）
- 其他 audit/*.md 文件
- `audit/B10-evidence/`, `audit/Bug-A-evidence/`, `audit/Bug-B-evidence/` 等 evidence 資料夾的 PNG 變動

**特別說明**：這批是「文件 only」commit，commit message 強調「無產品行為變動」。

---

## Memory 文件（不入這批 commit）

新增 / 修改的 memory files（在 `~/.claude/projects/.../memory/`）不放專案 commit：
- `feedback_schema_unification_commitment.md` （新增）
- `feedback_mockup_show_and_sonnet_make.md` （更新）
- `MEMORY.md` （索引更新）

這些屬於 user 個人 memory 不入專案 repo。

---

## 執行步驟

每批走相同流程：

1. 取消之前所有 stage：`git reset`
2. 加這批的檔案：`git add <file1> <file2> ...`
3. 確認 stage 結果：`git diff --cached --stat`
4. 給 user 看 stage 列表 + commit message draft
5. User 回「對」 → `git commit`
6. User 回「不對」→ `git reset` 重做
7. 進下一批

---

## 預估時間

- 第 1 批：5 min（簡單，少檔案）
- 第 2 批：10 min（44 PNG，需逐張看）
- 第 3 批：5 min（簡單）
- 第 4 批：5 min（已部分 staged）
- 第 5 批：10 min（多檔案多 hunk）
- 第 6 批：5 min（infra 簡單）
- 第 0 批：10 min（38 個 audit 文件）

**總計約 50 分鐘**（含 6 次 user gate 各 1 分鐘 = 56 分鐘）

---

## 待 user 回 Supabase 截圖

等你截圖回來，我們就從第 1 批開始一批一批 stage + 你看 + commit。
