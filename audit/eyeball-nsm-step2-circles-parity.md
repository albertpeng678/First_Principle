# NSM Step 2 ↔ CIRCLES 規格對齊（hint dynamic + example pre-generated + question expand）

**Date:** 2026-05-09
**User directive:** 「我想要和 CIRCLES 規格完全對齊：提示動態、範例答案預生成」+ 「為什麼北極星指標沒有可以展開的問題說明」
**Carve-out:** User 親准動 prompts / DB / new route — 比照 CIRCLES SB6 + SB8 + Combo C / Stats fix / config 三個前例 carve-out 模式

---

## 3 個 Gap（全在 NSM Step 2 / mockup 07）

| # | Gap | CIRCLES 對應 | 修法 |
|---|---|---|---|
| **A** | 範例答案 hardcode 為 Spotify generic（所有題都看到同句）| circles_database.json `field_examples` per-question pre-generated | 加 `field_examples` 到 nsm-db.js，one-shot 生成 100 × 3 = 300 cells |
| **B** | 完全沒有「查看提示」按鈕，只有「查看範例」 | mockup 03 SB8 hint-row + `POST /api/circles-public/hint` runtime AI | 新 `prompts/nsm-step2-hint.js` + 新 route + 「查看提示」button 並排 |
| **C** | Step 2 nsm-context-card 只顯示 scenario，無法展開看深入分析 | mockup 03 SB6 qchip-expand 4 blocks（商業背景/用戶輪廓/常見誤區/破題切入）| 加 expand toggle，data 已存在 `q.context.{model,users,traps,insight}`（無 backend 改動） |

---

## 視覺契約（mirror CIRCLES patterns）

### Gap A — Pre-generated examples
```
[查看範例 ▶]    ← 點開折疊
↓ expand
例：每月實際完成至少 3 部 Netflix 自製內容觀看的訂閱用戶數
```
- 內容 per-question 不同，題目 q1 (Netflix) ≠ q2 (蝦皮) ≠ q3 (Slack)
- 已生成完畢 = 載入頁面瞬間可見，不依賴 click time 跑 AI

### Gap B — Dynamic hint
```
[查看提示]  [查看範例 ▶]    ← hint button 並排
↓ click → modal
[標題：北極星指標 (NSM) 提示]
- AI loading spinner
- AI 內容（per-question 客製）
- [關閉] / ESC / backdrop / 4 close paths
```
- 動態 = 每次 click 即時 fetch（mirror CIRCLES `openHintModal`）
- 重用 `renderHintModalShell` + `_hintCache` per (qid, fieldId)

### Gap C — Question expand (qchip-expand pattern)
```
nsm-context-card
├─ company · industry · type-badge
├─ scenario (現有 1 行)
└─ [深入了解問題 ▼] ← 新 toggle button
   ↓ expand
   ├─ <i ph-buildings>商業模式：…
   ├─ <i ph-users>使用者：…
   ├─ <i ph-warning>常見陷阱：…  ← warn 橘色 (mirror qchip-ana__block--trap)
   └─ <i ph-lightbulb>破題切入：…
```
- Data source: `q.context.{model,users,traps,insight}` — already pre-generated in nsm-db.js by SP4 backfill
- Reuse existing `renderNSMContextBlock(q)` helper

---

## 後端 Carve-out 範圍（user 親准）

| 檔案 | 動作 | 用途 |
|---|---|---|
| `prompts/nsm-step2-hint.js` | NEW | runtime AI hint per (questionId, field) |
| `prompts/nsm-step2-example.js` | NEW | one-shot pre-gen example per (qid, field) |
| `routes/nsm-public.js` | NEW | `POST /api/nsm-public/step2-hint` session-less |
| `server.js` | +1 line | mount `/api/nsm-public` |
| `scripts/backfill-nsm-step2-examples.js` | NEW | idempotent vm-load → AI gen 300 cells → save back |
| `public/nsm-db.js` | data write | populate `field_examples` per question (auto via script) |
| `nsm_plan/nsm_database.json` | data write | source of truth update（同步 nsm-db.js） |
| `tests/adversarial/nsm-step2-hint.test.js` | NEW | 10-case sweep per memory standing rule |

**保留 jest 不動鐵則**：所有新檔的 unit test 走 Playwright + adversarial，不加 jest spec。

---

## Frontend 改動（純 Path 2 spirit — surgical）

| 改動 | 位置 | 範圍 |
|---|---|---|
| Remove hardcoded Spotify | `public/app.js:1240-1242` | 3 lines |
| `renderNSMField()` 加 hint button | `public/app.js:1436-1455` | ~10 lines |
| `renderNSMContextCard()` 加 expand toggle | `public/app.js:1466-1474` | ~15 lines |
| `openNSMStep2HintModal()` 新 helper | `public/app.js` | ~30 lines（mirror `openHintModal`） |
| AppState `nsmContextExpanded` + `nsmStep2HintCache` | top | 2 fields |
| Click handlers wire | bind section | ~20 lines |
| CSS reuse `qchip-ana` from CIRCLES | likely 0 new CSS | reuse |

---

## 驗收 criteria（karpathy §4 — verifiable goals）

1. **Gap A 通過**：選 q3 (Slack) → Step 2 → 「查看範例」展開 → 看到的範例提到「Slack」或「企業」或「訊息」（不是 Spotify 曲目）
2. **Gap B 通過**：點 「查看提示」 → modal 開 → loading spinner → AI 回應 per-question
3. **Gap C 通過**：Step 2 nsm-context-card「深入了解問題」按鈕 → 展開 4 blocks 全顯（model/users/traps/insight）
4. **Mockup 對齊**：mockup 07 update 加 hint-row 並排（per CIRCLES mockup 03 line 803）+ context-card expand
5. **8-vp Playwright** all green chromium
6. **Adversarial sweep** 10 cases nsm-step2-hint full green
7. **iOS 15-item static** 通過
8. **Director cold review** Read 12+ PNG (4 states × 3 vp baseline) 對齊 mockup 0 drift
9. **jest 160/160 baseline 不破**（不動 jest 鐵則保留）
10. **CLAUDE.md** state board 即時 update 收尾

---

## 預計 cost / 時間

- OpenAI cost: backfill 100 × 3 = 300 calls × $0.005 (gpt-4o) ≈ $1.5；retry buffer $1 → **total ≤ $3**
- Adversarial sweep: 10 calls × $0.005 ≈ $0.05
- Time: ~4-6 小時 implement + verify
