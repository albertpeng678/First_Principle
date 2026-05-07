# Adversarial Input Quality + Combo C — 設計規格

**Date:** 2026-05-08
**Author:** director (opus 4.7) + user pair-review
**Approved direction:** Combo C（前端 minLength + 後端 prompt 強化 + adversarial test infra）
**Path 2 carve-out:** User 親准 override 「後端 prompts 100% 不動」鐵則 — 限本 spec 範圍 5 個 prompt 檔輸入品質檢查段

---

## 1. 問題

User 親抓 bug（2026-05-08）：CIRCLES Phase 1.5 Gate，4 欄全打單字元「A」，AI 卻回 1 ok（「時間範圍合理」hallucination）+ 2 warn + 1 error。

**根因 2 條：**
1. **`prompts/circles-gate.js` 缺 input quality guard** — 只送 step 名稱 / problem / 4 fields / common_wrong_directions，沒告訴 AI「字數太短 / 單字元 / 重複字元 = 必 error」
2. **`public/app.js` 缺 minLength 守門** — 顯示「建議 50-120 字」是文案，submit 不 disable

**Audit 結構性盲點：**
- `tests/visual/capture-mockup-04-pngs.spec.js` 用 `mockApis()` 餵假 gate result fixture
- 我 Read 32 PNG 對的是「render UI 對不對」，**完全沒驗實際 AI gate 判斷邏輯**
- 真機 user-input → 真 OpenAI → 真 gate 這條從來沒 audit

**User standing rule（2026-05-08）：**
> 「所有階段審核都要經過極端情境測試，因為使用者會使用各種手段寫答案」

---

## 2. 範圍

**5 個 AI 審核階段（必修）：**

| # | 階段 | Prompt 檔 | Route | 輸出 |
|---|---|---|---|---|
| 1 | CIRCLES Phase 1.5 Gate | `prompts/circles-gate.js` | `POST /api/circles-sessions/:id/gate` | items[] + canProceed + overallStatus |
| 2 | CIRCLES Phase 3 Step Evaluator | `prompts/circles-evaluator.js` | `POST .../evaluate-step` | dimensions[] + totalScore + coachVersion |
| 3 | CIRCLES Phase 4 Final Report | `prompts/circles-final-report.js` | `POST .../final-report` | overallScore + grade + strengths/improvements |
| 4 | NSM Step 2 Gate | `prompts/nsm-gate.js` | `POST .../gate` | items[] (4) + canProceed + overallStatus |
| 5 | NSM Step 3 Evaluator | `prompts/nsm-evaluator.js` | `POST .../evaluate` | scores + totalScore + coachTree |

**3 個前端表單入口（必加 minLength 守門）：**
- CIRCLES Phase 1（7 步表單，全 4-field 表單；L 步 sol-cards 每張 2 fields；E 步 per-sol × 4 fields；S 步 3 主 + 4 tracking）
- NSM Step 2（3 fields：nsm / explanation / businessLink）
- NSM Step 3（4 dim textareas）

**範圍外（不動）：**
- `routes/*` 全部不動
- DB schema / migrations 不動
- prompts 中的核心評分維度 / 評分公式 / system prompt 主體不動 — 只在每個 prompt 加「## 輸入品質檢查」segment
- jest baseline 143/143 不破

---

## 3. 設計：3 層守門

### Layer 1 — Frontend minLength 守門

**規則：**
- 每個 rt-field 用既有 `minMax` 下限（例：`'50-120'` → 50 字）做 floor
- 任一 field 字數 < floor → submit-bar primary disabled + `[data-min-length-blocked]` attr
- 點 disabled button → inline tip 顯示「請補滿『XX 欄位』(至少 N 字)」
- char-counter 在 < floor 時用 `--c-warn` 字色 + `(至少 N 字)` suffix
- 全形空白 / 重複字元 → 視為 0 有效字元（用既有 `.trim()` + 重複偵測）

**為什麼足夠：**
- 擋掉 90% 懶輸入（單字元 / 全空白）
- 擋不掉「AAAAAAA × 50」式長度型 garbage — Layer 2 接

**為什麼不過嚴：**
- 不檢查語意 / 領域（純客戶端 heuristic）
- 不擋已通過 floor 的「文不對題」內容 — Layer 2/3 接

### Layer 2 — Backend Prompt 輸入品質檢查段

每個 prompt system message 加：

```
## 輸入品質檢查（最高優先級，先於評分維度）
- 任一欄位字數 < 10 → status="error", title="欄位內容不足", reason="字數不足以判斷"
- 重複單一字元（如「aaa」「1111」）→ status="error", title="輸入無意義"
- 純 whitespace / 全形空白 → status="error", title="未填寫"
- 內容語意與本 step 完全無關 → status="error", title="離題"
- **嚴禁** hallucinate「合理 / 完整 / 通過」對 < 10 字輸入
- 上述任一觸發 → overallStatus="error" + canProceed=false
```

**為什麼這樣設計：**
- 「最高優先級」明確 override step-specific 評分邏輯
- 「嚴禁 hallucinate」白紙黑字寫入 prompt — AI 較難違反明文指令
- 字數閾值 10：低於 floor 範圍（30/40/50）的 1/3，即使 floor 改變仍是 garbage 判定線
- error code 與既有 schema 相容，不破 frontend render

### Layer 3 — Adversarial Test Suite（真 OpenAI 驗證）

**位置：** `tests/adversarial/{stage}.spec.js`
**Runner：** Playwright（直接 require prompt module + run real OpenAI）
**npm script：** `test:adversarial`（不入 default CI，避免 PR 跑爆 token）
**Cost：** ~$0.01-0.05 / case × 50 cell ≈ $0.50-2.50 / sweep

**10 標準 adversarial cases：**

| # | Case | 輸入 | 期望最低 status |
|---|---|---|---|
| 1 | 單字元 | `"A"` | error |
| 2 | 重複字元 | `"AAAAA × 100"` | error |
| 3 | 純 whitespace | `"   "` 或 `"　　　"` | error |
| 4 | 隨機 unicode | `"☃️🌟🎲"` | error |
| 5 | 語言錯誤 | 西班牙文塞 zh-TW 欄位 | error |
| 6 | 離題流利散文 | `"我喜歡吃蘋果，今天天氣很好"` | error |
| 7 | 直接 paste placeholder | mockup placeholder 文 | warn 至少 |
| 8 | 極長 garbage | `"A".repeat(2000)` | error |
| 9 | HTML/JS injection | `"<script>alert(1)</script>"` | escHtml 阻擋 + error |
| 10 | 邊界正向 | 短但專業 `"用戶 30 天留存 ≥ 60%"` | warn 或 ok |

**Sweep matrix：** 5 階段 × 10 case = 50 cell。每 cell 跑 1 次真 OpenAI call，記 actual status，與期望比對。

---

## 4. 不動的東西（明列）

- ✗ 任何 `routes/*` 檔案（純前端 + prompt 變更可達成 Combo C）
- ✗ DB schema / migrations
- ✗ `lib/evaluate-step-handler.js`（共用 schema validation 不動）
- ✗ `circles_database.json`（題庫 103 題不動）
- ✗ jest 既有 143 測試（不准 break baseline）
- ✗ Production CSS class names（mockup-as-Spec LOCKED）

## 5. 風險 + Mitigation

| 風險 | Mitigation |
|---|---|
| Prompt 強化過度 → 邊界正常輸入被誤判 error | adversarial case #10「邊界正向」必須 pass — 不 pass = prompt 加太緊，rollback |
| OpenAI cost 失控 | npm script 隔離；不入 PR CI；ship-time 一次性 sweep |
| Frontend minLength 影響既有 happy path | TDD 紅綠：紅燈先驗 garbage 被擋；綠燈再驗 mockup 03 placeholder-length 答案能正常 submit |
| Schema drift（新 prompt 段改變回傳） | 每 prompt 加段後跑既有 jest evaluator unit test；不破才 commit |
| User 看到 disabled submit 不知為何 | inline tip 寫「請補滿『XX 欄位』(至少 N 字)」具體指出哪欄缺 |

## 6. 驗收 SOP

User 親跑：
1. 開 `npm start` (port 4000)
2. 任意題目進 Phase 1 → 4 欄全打「A」 → 確認 submit-bar 「下一步」disabled + char-counter 警示色 + tip
3. 4 欄填合理長度（≥ 50 字）→ submit 可送 → AI gate 仍能正常運作
4. 重複「AAAAA × 100」（長度過 floor）→ submit 通過 → AI gate **必擋全 4 為 error**
5. 走完整 7 步 sim mode → Phase 4 final report 對 garbage 不應 hallucinate 高分
6. 對應 NSM step 2 / 3 同樣 SOP

---

## 7. 完工 DoD

- [ ] 5 prompt 檔加 ## 輸入品質檢查 段（明文不准 hallucinate）
- [ ] 前端 3 個表單入口（Phase 1 7 步 / NSM step 2 / NSM step 3）minLength 守門
- [ ] `tests/adversarial/` infra：helper + 10 case fixtures + 5 stage spec 各 10 case = 50 cell
- [ ] 50-cell sweep 全綠（adversarial verdict 與期望符合）
- [ ] jest 143/143 仍綠（既有 unit/route 不破）
- [ ] Playwright 既有 critical specs 仍綠（minLength 不擋 happy path）
- [ ] `audit/adversarial-sweep-2026-05-08.md` 50 cell 表
- [ ] CLAUDE.md 即時更新
- [ ] User 親跑 SOP 1-6 簽收
