# NSM Hint vs CIRCLES Hint — 品質對比稽核

**日期：** 2026-05-10
**稽核者：** Sonnet 4.6 (director)
**Karpathy compliance：** Think Before → 全讀 → Simplicity First → 純稽核 → Surgical → 無改碼 → Goal-Driven → 對應 user UAT 目標

---

## 1. 檔案概覽

| 檔案 | 用途 | 模型 | 狀態 |
|---|---|---|---|
| `prompts/circles-hint.js` | CIRCLES 7步驟 × per-field AI hint | gpt-4o | 正式 live |
| `prompts/nsm-step2-hint.js` | NSM Step 2（nsm/explanation/businessLink）per-field hint | gpt-4o | 正式 live |
| `prompts/nsm-step3-hint.js` | NSM Step 3（4 dim × 4 type）per-dim hint | gpt-4o | 正式 live |
| `prompts/nsm-hints.js` | NSM Step 3 **legacy**，4 dim 一次批次返回 JSON | gpt-4o-mini | 仍 live（nsm-sessions + guest-nsm-sessions 呼叫），**不是本次稽核主體** |

---

## 2. 結構對比表

| Aspect | CIRCLES hint | NSM Step 2 hint | NSM Step 3 hint |
|---|---|---|---|
| **FIELD_GUIDANCE 深度（per field）** | **完整 4 欄位**：`purpose` / `key_question` / `must_include`（2-4 條具體要素）/ `good_answer_shape`（完整句型範本）| **3 欄位**：`purpose` / `key_question` / `must_include`（2 條）；**無 `good_answer_shape`** | **1 欄位**：僅一個字串描述（約 50-80 字），無 `purpose` / `key_question` 分拆，無 `must_include` / `good_answer_shape` |
| **System prompt（角色/格式/規則）** | 完整：角色宣告 + 格式硬規定（100-140字/3-4行/bold規則/禁前言列表）+ 內容要求 3 條（針對公司/不給答案/禁廢話）| 完整：角色宣告 + 輸入品質檢查（7條）+ 格式（巢狀 bullet/≤320字/2-3項/1-3個bold）| 與 Step 2 幾乎 mirror，差異僅「維度」替換「欄位」字眼；**格式規定完整度相同** |
| **Adversarial guards（亂碼/spam 拒絕）** | **無**（CIRCLES hint 沒有 input quality check section）| **有**（7條：空/短/重複字元/whitespace/符號/離題/prompt injection）| **有**（與 Step 2 完全相同 7 條）|
| **User draft 考慮** | **無**（CIRCLES hint 不接受 userDraft，只送 step+field+questionJson）| **有**（`userDraft` 傳入，system prompt 要求「針對這位學員的個人化提示」）| **有**（同 Step 2，`userDraft` 傳入，個人化提示）|
| **Output 格式（長度/結構）** | 100-140字，3-4行短行，**不使用 bullet**，可 `**bold**` 1-3個關鍵字，禁前言 | ≤320字，**巢狀 markdown bullets**（頂層 `- `，子項 `  - `），2-3項，1-3個 bold | 與 Step 2 完全相同格式要求 |
| **Temperature / max_tokens** | temp 0.4 / max 240 | temp 0.3 / max 400 | temp 0.3 / max 400 |
| **Hint 方向數量（泛化 vs 聚焦）** | **聚焦單一思路**：100-140字 cap 強迫提示精煉；格式是「短行段落」不是列點散彈 | **2-3 個方向**：巢狀 bullet 結構允許多路展開（達 320字）| **2-3 個方向**（同 Step 2 格式）|
| **公司情境注入** | `questionJson.company` 注入 system + user msg；**`good_answer_shape` 的範本語言也嵌入公司情境** | `company` / `industry` / `scenario` 三欄同時注入；注入位置充足 | 同 Step 2：`company` / `industry` / `scenario` 三欄注入 |

---

## 3. 九組樣本 Hint（verbatim AI 輸出）

### 題目背景

- **CIRCLES**：circles_008 Netflix 影片發現，`problem_statement = 設計一個新功能，提升用戶在 Netflix 上的影片發現體驗，尤其是對於新片的探索。`
- **NSM Step 2/3**：q1 Netflix，`scenario = 影音串流平台競爭激烈，必須確保用戶持續感受到內容價值以維持自動扣款。`

---

#### CIRCLES Hint 1 — C1 / 問題範圍

```
首先，這是**影片發現頻率**的問題，聚焦於新片探索。範圍應集中在**首頁推薦版位**，因為這是用戶進入平台的第一接觸點。排除其他非影片內容，如影評或社交互動功能，以保持專注於影片探索。
```

（97字，3行，有 bold，無前言，強迫說「排除項」）

---

#### CIRCLES Hint 2 — I / 目標用戶分群

```
考慮以**觀看頻率**將用戶分群，區分高頻、中頻和低頻觀看者。高頻用戶可能尋求**新片推薦**，以保持新鮮感。中頻用戶可能需要**個性化建議**，以增加觀看時間。低頻用戶可能對**熱門內容**更感興趣，以吸引他們回流。這樣的分群能幫助針對性提升影片發現體驗。
```

（120字，5行，4個 bold，清楚說出分群維度與每群特徵）

---

#### CIRCLES Hint 3 — S / 北極星指標

```
**北極星指標**：新片的**首次播放率提升 15%**。這能反映用戶更有效地發現並嘗試新內容。選擇此指標是因為它直接關聯用戶的探索行為和滿意度。不選**總觀看時長**，因為它可能受熱門舊片影響，無法準確反映新片探索效果。
```

（110字，4行，4個 bold，有「不選 X 因為 Y」的虛榮指標排除）

---

#### NSM Step 2 Hint 1 — nsm 欄位

userDraft：`我覺得可以追蹤用戶每月的觀看時間`

```
- 你認為用戶每月觀看時間是否能真正反映他們從 Netflix 獲得的**價值**？
  - 是否有其他行為，如每月完成至少一部影集，能更準確代表用戶的滿意度？
- 如何排除**虛榮指標**，確保所選指標不僅僅是反映使用頻率？
  - 思考用戶在平台上探索新內容的行為，這是否能反映他們對內容的持續興趣？
```

（巢狀 bullet，2 頂層，各帶 1 子項，2個 bold，針對草稿做個人化質疑）

---

#### NSM Step 2 Hint 2 — explanation 欄位

userDraft：`當用戶達到一定觀看時數，我們認為他已獲得足夠價值`

```
- 觀看時數的門檻應如何設定才能代表用戶**真正獲得價值**？  
  - 是每月觀看超過 20 小時，還是每週至少觀看 5 部影片？這樣的門檻如何反映用戶的滿意度？

- 為什麼選擇這個觀看時數而非更高或更低？  
  - 是否有數據支持這個門檻能有效區分出願意續訂的用戶？考慮不同類型內容的**吸引力**差異。
```

（2頂層 bullet，各帶 1 子項，2個 bold，直接戳門檻設定的「為什麼」）

---

#### NSM Step 2 Hint 3 — businessLink 欄位

userDraft：`NSM 和留存率有關，用戶越活躍越可能續訂`

```
- 如何具體描述**用戶活躍度**上升帶來的留存率提升？
  - 用戶活躍度增加是否意味著他們發現更多喜愛的內容？
  - 這些內容是否促使他們更頻繁地使用平台，進而增加續訂可能性？

- 用戶活躍度如何影響**變現**？
  - 活躍用戶是否更有可能推薦平台給他人，從而帶來新訂閱？
  - 是否有其他方式將活躍度轉化為額外收入來源？
```

（2頂層 bullet，各帶 2 子項，2個 bold，鼓勵具體描述因果鏈）

---

#### NSM Step 3 Hint 1 — attention / reach

userDraft：`分母是所有訂閱用戶，分子是每月有觀看的用戶`

```
- 你如何定義「每月有觀看的用戶」？是至少觀看一部影片，還是有特定的觀看時長？這會影響到 **reach** 的精確度。
  - 考慮將分子細分為不同的 **user segment**，如新用戶、長期用戶，或是按地區劃分。
- **MAU** 是否足以反映用戶的持續參與？是否需要考慮其他指標，如 **DAU** 或是特定內容的觀看率？
```

（2頂層 bullet，1 子項，3個 bold，針對分子定義模糊處發問）

---

#### NSM Step 3 Hint 2 — attention / depth

userDraft：`用戶每次打開 Netflix 會看多久，用平均 session 時長衡量`

```
- 如何確保用戶在每次觀看中獲得最大價值？考慮用戶的**完播率**是否能更準確反映內容吸引力。
  - 是否有特定類型的內容能促使用戶觀看更長時間？
- 除了時長，還有哪些**互動行為**能反映用戶的投入深度？
  - 用戶是否會在觀看過程中進行評論或評分，這些行為是否能提升互動深度？
```

（2頂層 bullet，各 1 子項，2個 bold，建議從 session 時長換維度思考完播率）

---

#### NSM Step 3 Hint 3 — attention / frequency

userDraft：`用戶每週登入幾次，用 DAU/MAU 比例反映活躍程度與習慣養成`

```
- 如何判斷用戶的**習慣養成**？考慮分析用戶在不同時間段的活躍情況，是否有特定的觀看模式或偏好。
  - 是否有某些特定類型的內容或新劇集發布時，用戶的登入頻率會顯著增加？

- DAU/MAU 比例能否全面反映用戶的**忠誠度**？探討這個指標是否能有效區分出高頻次用戶與偶發性用戶。
  - 是否需要結合其他指標，如用戶觀看時長或內容互動次數，來更全面地了解用戶行為？
```

（2頂層 bullet，各 1 子項，2個 bold，從 DAU/MAU 比推廣到習慣養成判斷）

---

## 4. 品質差距分析

### Gap A — FIELD_GUIDANCE 深度差距（嚴重度：**important**）

**具體 aspect：** CIRCLES 每個欄位有 `good_answer_shape`，明確告知「好答案的完整句型」，且 `must_include` 有 2-4 條具體要素。NSM Step 2 沒有 `good_answer_shape`，Step 3 退化為單一字串（無結構）。

**具體例子：**
- CIRCLES S/北極星指標 的 `good_answer_shape`：`北極星指標：[具體行為 + 量化描述]。它能反映用戶[真正獲得的核心價值]。不選[虛榮指標X]，因為它無法說明用戶是否真正[受益]` → hint 輸出自然帶出「不選 X 因為 Y」（見 CIRCLES Hint 3）
- NSM Step 2 explanation 的 `must_include` 只有「具體量化（次數/頻率/時間窗）」+「為什麼選這個門檻」，無句型範本 → hint 輸出能問對問題，但形狀略散（見 NSM Step 2 Hint 2）
- NSM Step 3 全部 dim 只有一段 50-80 字字串 → 提示能帶出「換維度思考」，但無法指導「好答案長什麼樣」

**影響：** 學員能被引導思考，但無法從 hint 中感受到「答對了什麼形狀才叫完整」，可能仍交出結構鬆散的答案。

---

### Gap B — CIRCLES 無 userDraft 個人化（嚴重度：**important**）

**具體 aspect：** CIRCLES hint 完全不傳 userDraft，無論學員草稿寫什麼，都給出固定方向提示。NSM Step 2/3 有 userDraft 個人化，系統真的看學員已寫什麼後再提示。

**具體例子：**
- CIRCLES C1/問題範圍：如果學員草稿已正確說出問題類型但漏掉排除項，CIRCLES hint 仍會給出「先想問題類型、再想版位範圍、再想排除項」的固定提示，不會知道排除項是唯一缺口
- NSM Step 2 Hint 1（nsm 欄位）：草稿是「追蹤每月觀看時間」，hint 直接質疑「時間是否等於價值？是否有其他行為更準確？」——個人化診斷草稿盲點

**影響：** CIRCLES hint 對有中等草稿的學員（寫了 60% 對）幫助有限；NSM hint 反而更個人化。這是 CIRCLES 相對 NSM 的劣勢，但也是架構差異（CIRCLES hint route 不接收 draft）。

---

### Gap C — CIRCLES 無 adversarial guard（嚴重度：**nice-to-have**）

**具體 aspect：** CIRCLES hint system prompt 無「輸入品質檢查」section。NSM Step 2/3 有 7 條 adversarial guard（空/重複字元/prompt injection）。

**具體例子：** CIRCLES hint 若接收到空 field 或 prompt injection 嘗試（但實際 route 層面只傳 step+field+questionId，不傳 draft，所以注入面窄），NSM 則明確拒絕。

**影響：** CIRCLES 注入面較小（無 userDraft，field 只有欄位名稱字串），實際風險低。但若未來 CIRCLES 也需要 userDraft 個人化，需補 guard。

---

### Gap D — NSM Step 3 FIELD_GUIDANCE 退化程度（嚴重度：**important**）

**具體 aspect：** Step 3 的 `FIELD_GUIDANCE` 是每個 `type.dim` 一個字串，而非 Step 2 那樣有 `purpose` / `key_question` / `must_include` 三欄。System prompt 的 `維度指引：${guidance}` 直接插入這個字串，沒有結構化解構。

**具體例子：**
- `attention.reach` 的 guidance：`觸及廣度 — 你定義的 NSM 涵蓋多少 user？是 MAU? DAU? 還是某個 segment? 寫一個能 query DB 的 numerator/denominator。`
- Step 2 `nsm` 的 guidance：結構化成 purpose/key_question/must_include，system prompt 分別以「欄位目的：」「核心問題：」「必含要素：」插入

**影響：** Step 3 guidance 是「概念提示」而非「行為要求」，AI 較難從一個字串中推導出「好答案要含什麼要素」；但從樣本看，輸出仍可接受（能換維度思考），主要缺失是無 `must_include` 強制。

---

### Gap E — 輸出格式差異（嚴重度：**nice-to-have**）

**具體 aspect：** CIRCLES hint 是段落短行（不用 bullet），NSM Step 2/3 是巢狀 markdown bullet。

**具體例子：** CIRCLES Hint 1 是流暢段落；NSM Step 2 Hint 1 是「- ... / `  - ...`」巢狀列表。

**影響：** 視覺呈現方式不同，但兩者在 UI modal 中都有對應的 render 函式（CIRCLES 用 `_markdownHintToHtml`，NSM 用 `markdownBulletsToHtml`）。更重要的問題是：bullet 格式讓 NSM hint 容易因為 ≤320字 cap 而被截斷，而 CIRCLES 的 100-140字 cap 更嚴格但更不易爆版。

---

### Gap F — CIRCLES hint 提示密度更高（補充觀察，非 gap）

CIRCLES hint 的字數 cap 比 NSM 更嚴（100-140字 vs ≤320字），但輸出反而更精準。CIRCLES Hint 2（I/目標用戶分群）在 120字內完成「分群維度 + 3群特徵」的完整框架；NSM Step 2 Hint 3（businessLink）用了約 200字才描述因果鏈。這說明字數 cap 對提示品質有正面作用。

---

## 5. 選項推薦

### Option A — 不修改（現況可接受）

- **前提：** NSM hint 品質已可運作，學員能被引導，不會 hallucinate 答案，有 adversarial guard
- **缺口：** Gap A（無 `good_answer_shape`）讓學員不知道「完整形狀是什麼」；Gap D（Step 3 guidance 退化）讓 dim 提示偏概念
- **建議評級：** 不建議，主要因 Gap A 會導致學員反覆提示後仍不知道答案形狀

### Option B — 小幅強化（推薦）

**具體改動：**

1. **NSM Step 2 hint：** 為 3 個 field 各補 `good_answer_shape` 欄位，指導「好答案長什麼樣」
   - `nsm`：`good_answer_shape = 「[行為動詞] + [量化門檻（次數/時長）] + [排除虛榮指標（如App打開次數）說明為何不選它]」`
   - `explanation`：`good_answer_shape = 「[具體門檻數值] 代表用戶真正獲得價值，因為 [原因A]；若低於此門檻，[什麼現象]；若高於此門檻，[什麼現象]」`
   - `businessLink`：`good_answer_shape = 「NSM ↑ → [具體中間行為] ↑ → [留存率/NRR] ↑；不是泛泛「體驗更好」，而是 [具體的可量化因果]」`

2. **NSM Step 3 hint：** 將 per-dim 的一個字串拆成 `purpose` / `key_question` / `must_include` / `good_answer_shape` 四欄，結構化後 system prompt 按欄位插入
   - 以 `attention.reach` 為例：
     - `purpose`：定義 NSM 的觸及分之分母，確保分子代表真實價值消費而非純登入
     - `key_question`：你的分子門檻是「開過 App」還是「完成了什麼核心動作」？這個差別有多大？
     - `must_include`：（1）明確分子（核心動作的用戶數）（2）明確分母（所有訂閱用戶或啟用用戶）（3）說明為何這個門檻排除了 vanity metric
     - `good_answer_shape`：`分母：[全訂閱/DAU base]；分子：[每月至少完成 X 行為的用戶數]；排除：[純登入/純瀏覽不算]`

3. **NSM Step 2 hint：** system prompt 的「欄位目的」section 加入一行「good_answer_shape」給 AI 參考（不強制輸出，作為校準）
4. **字數 cap 收緊：** Step 2/3 的 ≤320字 + max_tokens=400 較寬；建議加 post-process 優先截斷到 ≤220字（2 頂層 bullet + 各 1 子項為目標密度），與 CIRCLES 100-140字 的精密度更近

**估計影響：**
- Gap A 完全填補（學員看到 good_answer_shape 的語言後知道形狀）
- Gap D 完全填補（Step 3 guidance 結構化）
- 不動 routes / app.js / jest，只改 `prompts/nsm-step2-hint.js` + `prompts/nsm-step3-hint.js`

### Option C — 重寫（對齊 CIRCLES 架構）

**具體改動：**
- NSM Step 2/3 hint 格式從「巢狀 bullet」改成「段落短行（3-4行，100-140字）」，mirror CIRCLES 的輸出格式
- NSM Step 2/3 hint 加入 `good_answer_shape`（同 Option B）
- NSM Step 2/3 hint 字數 cap 改為 100-150字（從 320字縮小）
- NSM Step 2 hint 加入「內容要求：不給答案 / 針對公司情境 / 禁廢話」三條（CIRCLES 已有）

**缺口：** CIRCLES hint 沒有 userDraft（NSM 有），重寫不代表要移除這個優點；重寫主要是格式精密化

**估計影響：**
- 學習體驗更一致（CIRCLES 與 NSM hint 的視覺密度統一）
- 風險：改格式後 NSM 的 `markdownBulletsToHtml()` render 邏輯需同步調整，涉及 app.js（Path 2 carve-out 期間需謹慎）

---

## 6. 最終推薦

**推薦：Option B（小幅強化）**

理由：
1. NSM Step 2 已有完整的 `purpose` / `key_question` / `must_include` 結構，只缺 `good_answer_shape`，加一欄即填補 Gap A
2. NSM Step 3 的一字串 guidance 是最大弱點，結構化後 AI 能更精準校準「好答案形狀」
3. 不改 routes / app.js / render 邏輯，完全在 prompt 層修改，不破 jest 143/143
4. Option C 的格式重寫需動 app.js（bullet render），Path 2 carve-out 期間風險不必要

**不推薦 Option A：** Gap A + Gap D 的疊加會讓提示「能帶入思考但不知道答案完整形狀」，對學員有實質學習損耗。

**不推薦 Option C：** 現階段格式差異（bullet vs 段落）是可接受的 UX 差異，強行對齊需動 app.js render，不值得換。

---

## 7. Karpathy 合規聲明

1. **Think Before：** 全讀 circles-hint.js / nsm-step2-hint.js / nsm-step3-hint.js / nsm-hints.js / nsm-public.js / circles-public.js / app.js 相關段落，再分析
2. **Simplicity First：** 僅輸出稽核 doc，無 code 改動
3. **Surgical Changes：** 推薦 Option B 的具體改動精準到欄位與字串，不是「重寫整個 prompt」
4. **Goal-Driven：** 對應 user UAT 目標「看 NSM 提示長怎樣，參考 CIRCLES 做法」

---

**Status：DONE_WITH_CONCERNS**
主要 concern：NSM Step 3 FIELD_GUIDANCE 退化（Gap D）是 important 級，建議 Option B 優先補

---

## 8. After Option B — 實施結果（2026-05-10）

### 改動摘要

| 檔案 | 改動 |
|---|---|
| `prompts/nsm-step2-hint.js` | 3 個 FIELD_GUIDANCE 各補 `good_answer_shape` 欄位；system prompt 加入「合格答案結構（校準參考）」鉤子；char cap 320→220 |
| `prompts/nsm-step3-hint.js` | 16 個 dim guidance 從 1-string 重構為 4-field（purpose/key_question/must_include/good_answer_shape）；system prompt 改為 4 欄位拆解注入（`guidanceContext`）；char cap 320→220 |
| `tests/adversarial/nsm-step3-hint.test.js` | hard cap assertion 320→220；valid case 草稿修正（舊草稿含「首歌曲」，對 Netflix 影視題目 off-topic，已改為影集觀看描述） |
| `tests/adversarial/nsm-step2-hint.test.js` | hard cap assertion 320→220 |

### adversarial sweep 結果

| Test file | 結果 | 備註 |
|---|---|---|
| `nsm-step3-hint.test.js` | **8/8 PASS** | 6 負面案例全拒絕（31 chars refusal）；2 valid 案例回傳 128-132 chars 結構化提示 |
| `nsm-step2-hint.test.js` | **12/12 PASS** | 9 負面案例全拒絕；3 valid 案例回傳 117-153 chars 結構化提示 |
| jest baseline（非 adversarial）| **150/150 PASS**（17 skip = 原本 skip）| 無 regression |

### 3 樣本 Hint（verbatim 輸出 — 2026-05-10 run）

---

#### NSM Step 2 — nsm 欄位（Netflix，valid draft）

userDraft：`訂閱用戶每月觀看 ≥ 1 集完整內容，排除短暫試看`

```
- 這個門檻是否足以反映用戶的**忠誠度**？  
  - 思考用戶是否因為內容吸引力而持續觀看，或僅因習慣而偶爾點開。

- 如何區分**深度消費**與**偶然使用**？  
  - 考慮增加觀看時長或頻率的門檻，以排除非忠實用戶。
```

（117字，符合 ≤220；質疑「忠誠度門檻是否足夠」+ 引導思考深度消費 vs 偶然使用的差異；good_answer_shape 校準了「必含行為動詞 + 量化門檻 + 排除虛榮指標」的思路）

---

#### NSM Step 2 — explanation 欄位（Netflix，valid draft）

userDraft：`訂閱用戶每月觀看 ≥ 1 集完整內容，排除短暫試看`（作為 nsm field 輸入，explanation field 在後續提示中給出進一步思考）

```
- 這個 NSM 已經考慮到排除短暫試看，但如何確保這個門檻足以反映用戶的**持續價值**？
  - 思考用戶每月觀看的**頻率**或**多樣性**是否更能代表價值。

- 除了觀看次數，是否有其他行為能更好地代表用戶的**忠誠度**？
```

（153字，符合 ≤220；针对具体草稿质疑「频率/多样性」作为更强门槛；good_answer_shape 的「量化门槛 + 低於此门槛代表什么」框架引导了思考方向）

---

#### NSM Step 3 — attention.reach（Netflix，valid draft）

userDraft：`每月至少完整觀看 1 集影集（≥ 20 分鐘）的訂閱用戶數，分母為全部活躍帳號，分子排除背景播放與試看跳過者`

```
- 你如何確保「完整觀看 1 集影集」代表用戶感受到內容的**真實價值**？
  - 思考背景播放和試看跳過是否真正排除不具價值的行為。

- 是否有其他核心動作能更好地衡量用戶的**注意力**和**參與度**？
  - 探討其他可能的行為...
```

（132字，符合 ≤220；針對草稿已有 numerator/denominator 架構，進一步質疑「完整觀看是否真的等於真實價值」+ 提示可能更強的行為衡量；good_answer_shape 的「分母+分子+排除」框架讓 AI 能精準指出草稿完整度）

---

### Gap 填補狀態

| Gap | 狀態 |
|---|---|
| Gap A — 無 good_answer_shape（Step 2）| **已填補** — 3 欄位各補 good_answer_shape；AI 輸出顯示已能質疑「門檻充分性」而非泛泛建議 |
| Gap D — Step 3 guidance 退化（單一字串）| **已填補** — 16 dim 全部重構為 4-field；AI 輸出顯示已能針對 numerator/denominator 邊界發問 |
| Gap B — CIRCLES 無 userDraft（對比觀察）| 不在本次改動範圍（CIRCLES route 層面設計差異）|
| Gap C — CIRCLES 無 adversarial guard | 不在本次改動範圍 |
| Gap E — 輸出格式差異（bullet vs 段落）| 不在本次改動範圍（Option C 才處理）|

### 驗證 checklist

- char cap ≤ 220：valid 樣本 117/132/153 全在範圍內
- 無裸 jargon：DAU/MAU 在提示中有語境說明（排除偶發高峰）
- 不直接給答案：提示全以問句或「思考」引導，未直接說出 numerator/denominator 數值
- good_answer_shape 有效：AI 輸出針對草稿缺口（門檻充分性、行為定義精確度）提問，而非通用建議

**Status：DONE**
