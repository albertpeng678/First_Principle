# CIRCLES 範例 Bullet Format Design Spec

**Date:** 2026-04-28
**Scope:** 把 `circles_database.json` 中 100 道題 × 27 欄位 = 2700 條 `field_examples` 從整段流暢敘述（100-220 字）改成「巢狀列點 + 縮排」的結構化排版，並更新前端渲染、prompt、audit 規則。

---

## 1. 背景

目前 `field_examples` 是流暢中文段落，含 `**bold**` 標記。閱讀效率低 — junior PM 看完一段才能拆解出「主項—子項」的關係。改成結構化列點後，使用者掃過去一眼就能看到「聚焦／環節／排除」這種骨架。

不改 schema、不改 API contract，只改：
- 範例文字的格式與內容（資料）
- prompt 規則（生成器）
- 前端渲染（解析 + 樣式）
- audit 規則（檢查器）

---

## 2. 儲存格式

### 2.1 資料形態
仍是純字串（`field_examples[step][field]: string`），用「markdown-ish 縮排規則」：

- 頂層列點：行首 `- `（dash + space）
- 子項：行首 **2 個空格** + `- `（即 `  - `）
- 換行用 `\n`
- 保留 `**bold**` 標記

### 2.2 範例（circles_002 C1.問題範圍）
```
- 聚焦：個人對個人的二手交易（不是商家對買家）
- 3 個關鍵環節：
  - 交易前：看不出對方靠不靠譜
  - 面交時：現場人身與付款風險
  - 交易後：出問題沒地方申訴
- 排除：粉專認證商家，聚焦**同城個人賣家**
```

### 2.3 為什麼不用 JSON
- 不改 schema，現有 API/audit/curl 一致
- prompt 比較好控制（LLM 寫 markdown 比寫嚴格 JSON 穩）
- 簡單 parser 就能渲染

---

## 3. 內容規則（每欄位半固定骨架）

### 3.1 通用規則
- 頂層列點：**2-4 項**
- 子項：可選，每個頂層下 **0-5 個**
- 每行（含 `- `）：**≤ 60 字**
- 整段總長：**≤ 320 字**
- bold 紀律不變：load-bearing 才 bold（具體場景／量化／方案名），禁止 bold 結構性 label
- 不要 emoji
- 句尾標點完整（`。` `」` `）`等）；最後一個 bullet 不一定要句號

### 3.2 每欄位建議骨架（寫進 `FIELD_GUIDE`）

| Step | Field | 主項建議 |
|---|---|---|
| C1 | 問題範圍 | 聚焦 / 關鍵環節 / 排除 |
| C1 | 時間範圍 | 觀察期長度 / 對應業務節奏 / 太短或太長的影響 |
| C1 | 業務影響 | 主要指標 / 兩個利益方拉鋸 / 量化紅線 |
| C1 | 假設確認 | 2-3 條假設（每條為頂層）/ 都待後續驗證 |
| I | 目標用戶分群 | 分群維度 / 3-4 群定義 / 為什麼用這把尺 |
| I | 選定焦點對象 | 選誰 / 體量理由 / 戰略理由 |
| I | 用戶動機假設 | 表面動機 / 深層動機 / 一個有洞察的觀察 |
| I | 排除對象 | 2-3 個排除（每個為頂層含理由）/ 收斂目的 |
| R | 功能性需求 | 場景 / 需要做到什麼 / 目前卡點 |
| R | 情感性需求 | 想感受到什麼 / 怕失去什麼 / 觸發場景 |
| R | 社交性需求 | 想被怎麼看 / 對焦點用戶為何重要 |
| R | 核心痛點 | 哪一層最根本 / 具體場景描繪 / 為什麼比其他層核心 |
| C2 | 取捨標準 | 量化目標 / 硬性底線 / 哪類優先哪類後 |
| C2 | 最優先項目 | 優先項 / 命中哪個痛點 / 開發週期 |
| C2 | 暫緩項目 | 1-2 個暫緩 / 各自理由 / 不是不重要而是時機 |
| C2 | 排序理由 | 為什麼最優先不能暫緩 / 為什麼暫緩不能優先 / 整體邏輯 |
| L | 方案一 | 名稱 / 核心機制 / 打到哪個痛點 |
| L | 方案二 | 名稱 / 機制 / 與方案一的本質差異 |
| L | 方案三（可選） | 名稱 / 機制 / 為什麼是更激進或長線 / 啟動成本 |
| E | 優點 | 2-3 個優點（每個為頂層）/ 至少 1 連結業務或痛點 |
| E | 缺點 | 2-3 個缺點（每個為頂層）/ 影響哪些用戶 / 緩解 |
| E | 風險與依賴 | 2-3 個依賴 / 失效會怎樣 / 誰能解 |
| E | 成功指標 | 主指標 / 次指標 / 不退步底線 |
| S | 推薦方案 | 選定方案 / 一句話最終判斷 / 其他方案的角色 |
| S | 選擇理由 | 引用 E 結論的 3 個面向 / 對比放棄方案 / 回應最大缺點 |
| S | 北極星指標 | NSM 定義含行為門檻 / 為什麼能反映成效 / 排除虛榮指標 |
| S | 追蹤指標 | 廣度 / 深度 / 頻率 / 留存或業務影響 — 4 個維度（每個為頂層） |

LLM 大致照做，允許 ±1 主項彈性。骨架不適合的題目可以微調。

---

## 4. 前端渲染

### 4.1 影響範圍
- `public/app.js` `field-example-toggle` click handler（line ~1737-1758）— 渲染 `/api/circles-public/example` 回傳的字串
- `public/app.js` `renderHintBody`（如有渲染 bullet 需求 — 暫不改，hint 維持流暢敘述）
- `public/review-examples.html` `renderText` 函式

### 4.2 Parser 規格（vanilla JS，~30 行）
輸入：bullet text。輸出：HTML 字串。

演算法：
1. `escHtml(text)`
2. 按 `\n` 切行
3. 對每行：
   - `^- ` → 頂層 list item
   - `^  - ` → 子項 list item
   - 其他（罕見邊界） → 當頂層處理（兼容舊資料）
4. 子項依附在前一個頂層的下方，組成 `<ul class="example-sub"><li>...</li></ul>`
5. `\*\*([^*]+?)\*\*` → `<strong>$1</strong>`
6. 結果：`<ul class="example-list"><li>...<ul class="example-sub"><li>...</li></ul></li></ul>`

### 4.3 樣式
```css
.example-list {
  list-style: disc;
  padding-left: 18px;
  margin: 0;
  font-size: 13px;
  line-height: 1.7;
  color: #1a1a1a;
}
.example-list > li { margin: 4px 0; }
.example-list .example-sub {
  list-style: circle;
  padding-left: 18px;
  margin: 4px 0;
}
.example-list strong { color: #1A56DB; font-weight: 700; }
```

### 4.4 後相容性
新 parser 對「沒有 `- ` 開頭的舊段落字串」也要不爆 — fallback 是把整段當一個頂層 li 顯示。但因為我們會 regen 全部 99 題，這只是保險。

---

## 5. 內容轉換策略

### 5.1 circles_002 — 手動改寫
作為新 anchor，必須先手動寫好 27 個欄位的 bullet 版本（人類審美，當 LLM 範本）。

### 5.2 其他 99 題 — AI regen
1. 清空 99 題（保留 circles_002）
2. 跑 `scripts/generate-circles-examples.js`（更新 prompt 後）
3. 跑 audit
4. 跑 retry script 補殘餘

預估：~10 分鐘、~$0.30。

### 5.3 prompt 更新（`scripts/generate-circles-examples.js` 的 `STYLE_GUIDE`）
```
• 用「巢狀列點」格式，不要寫成一段：
  - 頂層列點以「- 」開頭（dash + 空白）
  - 子項以「  - 」開頭（2 空白縮排 + dash + 空白）
  - 用 \n 換行
• 頂層 2-4 項；子項可選，每個頂層下 0-5 個
• 每行 ≤ 60 字；整段 ≤ 320 字
• 保留 **bold** 標記 1-3 個 load-bearing 關鍵字（規則不變）
• 不要 emoji、不要編號（「①」「1.」都不要，主項就用「- 」）
• 句尾標點完整
```

附上 circles_002 的某個欄位作為 few-shot example。

---

## 6. Audit 規則改動

### 6.1 移除
- `bullet_in_text`（現在 bullet 是必須的，不再是 fail）
- `multi_paragraph`（巢狀 list 會有多行，不算違規）

### 6.2 新增
- `no_bullets`：完全沒有 `- ` 開頭的行 → fail
- `top_level_count`：頂層 bullet 數量 < 2 或 > 4 → fail
- `line_too_long`：任一行（含 `- ` 前綴）> 60 字 → warn
- `total_too_long`：總長 > 320 字 → fail
- `bad_indent`：行首縮排不是 0 或 2 個空白 → fail

### 6.3 保留
- `banned_bold`、`too_many_bold`、`bad_prefix`、`no_terminal_punct`（針對最後一個 bullet）

---

## 7. Implementation order

1. 手動改 circles_002（27 個欄位 bullet 版本）
2. 更新 `scripts/generate-circles-examples.js` 的 `STYLE_GUIDE` + `FIELD_GUIDE`（加 anchor）
3. 清空其他 99 題的 `field_examples`
4. 更新 `scripts/audit-circles-examples.js` 規則
5. 更新前端 parser（`public/app.js` 與 `public/review-examples.html`）
6. 跑 generate batch，跑 audit，跑 retry 補殘餘
7. 重啟 server，瀏覽 review-examples.html 抽查 5-10 題

---

## 8. 風險與緩解

- **Risk:** LLM 輸出不符合 markdown 縮排規則（用 tab、用 `*`、用「-」沒空白）
  - **Mitigation:** prompt 明確規定，retry 腳本檢測縮排異常的當作 retry 觸發
- **Risk:** 內容變得太短（每個 bullet 太精簡，失去資訊量）
  - **Mitigation:** prompt 設「整段 ≤ 320 字」上限但要求每個 bullet 至少 12 字、子項至少 8 字
- **Risk:** 巢狀 list 在 review-examples 老瀏覽器顯示異常
  - **Mitigation:** 用 `<ul>` `<li>` 是基礎標籤，無相容性問題
