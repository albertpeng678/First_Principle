# NSM Example Pilot v3.1 — Reasoning Depth Audit
> Date: 2026-05-10  
> Scope: q1 Netflix / q3 Slack / q9 Duolingo (3 × 7 = 21 cells)  
> Prompt file: `prompts/nsm-coherent-example.js` v3.1  
> Script: `scripts/backfill-nsm-pilot-coherent.js`

---

## v3 vs v3.1 Key Diff (prompt changes)

| Dimension | v3 | v3.1 |
|---|---|---|
| 縮排 sub-bullets | 0-1 個（可選） | 2-3 個（必須） |
| 縮排內容 | 簡短排除說明 | 為何選此門檻 + 排除邊界 + 具體例子 |
| 術語規定 | 無限制 | pp / NRR / DAU / MAU / LTV / churn 禁用或必解釋 |
| max_tokens Step 2 | 600 | 1200 |
| max_tokens Step 3 | 400 | 900 |
| 字元上限 Step 2 欄位 | 150 chars | 300 chars |
| 字元上限 Step 3 維度 | 120 chars | 260 chars |
| Few-shot example | Toast 1 sub-bullet/field | Toast 2-3 sub-bullets/field |

---

## Q1 Netflix — v3 vs v3.1 Side-by-Side

### step2.nsm

**v3 (前):**
```
- 月活躍觀看用戶數：月內至少觀看 1 部影片的訂閱用戶數
  - 排除免費試用未轉正用戶
```

**v3.1 (後):**
```
- 月活躍訂閱用戶數：每月至少觀看 1 小時內容的訂閱用戶數量
  - 1 小時門檻顯示用戶對內容有基本興趣
  - 排除僅登入未觀看者（不算真正活躍）
  - 例：用戶每月觀看 1 小時，顯示持續使用意圖
```

差異：0→1 sub-bullet 升為 3 sub-bullets；門檻從「1 部影片」改為「1 小時」（更精準量化）；加入具體例子

### step2.explanation

**v3 (前):**
```
- 設定 1 部影片門檻是因為用戶跨過此線即代表持續感受到內容價值
  - 連 1 部都沒看 = 可能流失風險
```

**v3.1 (後):**
```
- 1 小時觀看門檻代表用戶對內容持續感興趣
  - 未達 1 小時 = 可能對內容失去興趣
  - 達 1 小時顯示用戶願意投入時間，增加續訂可能
```

差異：1→2 sub-bullets；加入「達門檻的正向意義」

### step2.businessLink

**v3 (前):**
```
- 月活躍觀看用戶數 ↑ → 訂閱續訂率 ↑（粗估 +10% 活躍 → 留存 +4-6pp）
```

**v3.1 (後):**
```
- 月活躍訂閱用戶數 ↑ → 續訂率 ↑ → 公司穩定收入
  - 預估每多 10% 活躍用戶，續訂率上升 2-4 個百分點
  - 例：1000 用戶 → 1100 用戶，續訂從 80% → 82-84%
```

差異：「+4-6pp」術語消失 → 改為「百分點」；0→2 sub-bullets 含量化估算 + 具體數字例子

---

## Q1 Netflix — 21 cells 完整 v3.1 驗收

### anchor_nsm: 月活躍訂閱用戶數

**step2.nsm:**
```
- 月活躍訂閱用戶數：每月至少觀看 1 小時內容的訂閱用戶數量
  - 1 小時門檻顯示用戶對內容有基本興趣
  - 排除僅登入未觀看者（不算真正活躍）
  - 例：用戶每月觀看 1 小時，顯示持續使用意圖
```

**step2.explanation:**
```
- 1 小時觀看門檻代表用戶對內容持續感興趣
  - 未達 1 小時 = 可能對內容失去興趣
  - 達 1 小時顯示用戶願意投入時間，增加續訂可能
```

**step2.businessLink:**
```
- 月活躍訂閱用戶數 ↑ → 續訂率 ↑ → 公司穩定收入
  - 預估每多 10% 活躍用戶，續訂率上升 2-4 個百分點
  - 例：1000 用戶 → 1100 用戶，續訂從 80% → 82-84%
```

**step3.reach:**
```
- 分母為所有訂閱用戶，分子為當月至少觀看一部影片的用戶數
  - 為何用此分母：所有訂閱用戶都有潛在觀看可能
  - 排除：未觀看任何影片的用戶不算活躍
```

**step3.depth:**
```
- 每月觀看時長超過 20 小時視為深度使用
  - 20 小時顯示用戶對內容有高度黏著
  - 低於 20 小時可能是偶爾使用，黏著度低
```

**step3.frequency:**
```
- 每週至少 3 天有觀看行為
  - 3 天確保用戶持續接觸內容，形成觀看習慣
  - 低於 3 天可能是非核心用戶，需進一步激勵
```

**step3.impact:**
```
- 月活躍訂閱用戶數 ↑ 驅動訂閱收入增長，提升年度營收
  - 每增加 10% 活躍用戶，訂閱收入增長約 5-7%
  - 例：原本 1000 萬活躍 → 1100 萬，收入從 10 億 → 10.5-10.7 億
```

---

## Q3 Slack — 完整 v3.1 驗收

### anchor_nsm: 每月活躍發言用戶數

**step2.nsm:**
```
- 每月活躍發言用戶數：每月至少發送 1 則訊息的用戶數量
  - 為何選 1 則：發送訊息代表用戶已開始有效使用 Slack
  - 排除：僅登入未發言用戶（這些不算真實參與）
```

**step2.explanation:**
```
- 1 則訊息門檻聚焦在「真實參與」而非「僅註冊」
  - 僅註冊未發言 = 可能只是試用，不算成功轉化
  - 發送 1 則代表用戶已融入團隊溝通，是使用里程碑
```

**step2.businessLink:**
```
- 每月活躍發言用戶數 ↑ → 企業續訂率 ↑ → 公司營收成長
  - 預估每多 10% 發言用戶，企業續訂率上升 4-6 個百分點
  - 例：原本 1000 人發言 → 1100 人，續訂從 80% → 84-86%
```

**step3.reach:**
```
- 分母為所有註冊帳號，分子為當月至少發言 1 次的用戶數
  - 註冊帳號代表潛在用戶，但需發言才算活躍
  - 排除未發言者，避免高退訂風險
  - 例：1000 註冊中 700 發言，活躍率 70%
```

**step3.depth:**
```
- 每月發言 ≥ 50 條視為深度使用
  - 50 條發言表示用戶已將 Slack 作為主要溝通工具
  - 排除偶爾發言者，確保黏著度
  - 例：用戶 A 每月發言 60 條，屬深度使用
```

**step3.frequency:**
```
- 每週至少 3 天發言
  - 3 天確保用戶在工作日頻繁使用，非偶爾登入
  - 低於 3 天可能是非核心用戶，需關注
  - 例：用戶 B 每週發言 4 天，屬頻繁使用
```

**step3.impact:**
```
- 每月活躍發言用戶數 ↑ 驅動客戶留存率提升，進而增加年度收入
  - 每多 10% 活躍發言用戶，留存率上升 5-7 個百分點
  - 例：原本 1000 活躍 → 1100 活躍，留存從 80% → 85-87%
```

---

## Q9 Duolingo — 完整 v3.1 驗收

### anchor_nsm: 每日活躍學習者數

**step2.nsm:**
```
- 每日活躍學習者數：每日至少完成 1 課的用戶數量
  - 完成 1 課代表用戶已投入學習，非僅打開應用
  - 排除：只打開未學習的用戶（這些不算真正活躍）
```

**step2.explanation:**
```
- 1 課門檻聚焦在「真實學習」而非「僅打開應用」
  - 連 1 課都沒完成 = 用戶未真正開始學習
  - 完成 1 課代表用戶已將學習納入日常，具備持續性
```

**step2.businessLink:**
```
- 每日活躍學習者數 ↑ → 用戶留存率 ↑ → 平台長期增長
  - 每多 10% 活躍學習者，留存率提升 2-4 個百分點
  - 例：原本 1000 人活躍 → 1100 人，留存從 60% → 62-64%
```

**step3.reach:**
```
- 分母為所有註冊用戶，分子為每日至少完成一課的用戶數量
  - 每日完成一課表示用戶真正參與學習
  - 排除未完成課程的用戶，確保數據準確
  - 例：1000 註冊用戶中有 200 每日學習
```

**step3.depth:**
```
- 每日學習時間 ≥ 15 分鐘視為深度學習
  - 15 分鐘足夠完成一個完整課程，促進知識吸收
  - 排除短暫登入者，確保學習質量
  - 例：用戶每天學習 20 分鐘，顯示高投入
```

**step3.frequency:**
```
- 每週至少 5 天進行學習
  - 5 天確保學習成為習慣，避免間歇性學習
  - 排除低於 5 天者，避免數據偏差
  - 例：用戶每週學習 6 天，顯示持續性
```

**step3.impact:**
```
- 每日活躍學習者數 ↑ 驅動訂閱轉化率提升，進而增加月度收入
  - 每多 10% 活躍學習者，訂閱轉化率提升約 2-4 個百分點
  - 例：原本 5000 活躍 → 5500，轉化率從 10% → 12-14%
```

---

## Jargon Audit

Grep pattern: `\bpp\b | NRR(?![=（]) | DAU(?![=（]) | MAU(?![=（]) | LTV | churn`

Result: **0 violations across 21 cells**

v3 had: `+4-6pp`（q1 businessLink）、`+5-7pp`（q9 businessLink）— both eliminated in v3.1.

---

## Checklist Verification (per field)

| 欄位 | top-bullet 收斂 | 2+ 縮排 sub-bullets | 0 未解釋術語 |
|---|:---:|:---:|:---:|
| q1 step2.nsm | OK | 3 bullets | OK |
| q1 step2.explanation | OK | 2 bullets | OK |
| q1 step2.businessLink | OK | 2 bullets | OK |
| q1 step3.reach | OK | 2 bullets | OK |
| q1 step3.depth | OK | 2 bullets | OK |
| q1 step3.frequency | OK | 2 bullets | OK |
| q1 step3.impact | OK | 2 bullets | OK |
| q3 step2.nsm | OK | 2 bullets | OK |
| q3 step2.explanation | OK | 2 bullets | OK |
| q3 step2.businessLink | OK | 2 bullets | OK |
| q3 step3.reach | OK | 3 bullets | OK |
| q3 step3.depth | OK | 3 bullets | OK |
| q3 step3.frequency | OK | 3 bullets | OK |
| q3 step3.impact | OK | 2 bullets | OK |
| q9 step2.nsm | OK | 2 bullets | OK |
| q9 step2.explanation | OK | 2 bullets | OK |
| q9 step2.businessLink | OK | 2 bullets | OK |
| q9 step3.reach | OK | 3 bullets | OK |
| q9 step3.depth | OK | 3 bullets | OK |
| q9 step3.frequency | OK | 3 bullets | OK |
| q9 step3.impact | OK | 2 bullets | OK |

All 21/21 pass.

---

## Quality Gates

- jest: 170/170 pass (baseline maintained)
- Cells written: 21/21 (3 questions × 7 fields)
- Jargon violations: 0
- Commit: none (director cold review pending)
