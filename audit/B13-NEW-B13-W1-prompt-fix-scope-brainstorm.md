# B13 NEW-B13-W1 — `circles-final-report` Prompt Hallucination Fix Scope Brainstorm

> **Output type**: Research / fix-scope brainstorm only.
> **Status**: FIND-PHASE — 不改 prompt / 不改 spec / 不 stage / 不 commit.
> **Date**: 2026-05-18 (Wave 1 follow-up)
> **Tracker entry**: `audit/e2e-master-tracker.md` §2 `NEW-B13-W1` (line 108-117)
> **Bug source**: `tests/adversarial/circles-final-report-adversarial.test.js` variant `d-mixed-one-good`
> **Severity**: P2 (grade/score numbers correct; only coachVerdict 措辭 drift)

---

## Karpathy 4 條 prepend（per `feedback_karpathy_guidelines_standard` STANDING）

1. **Think Before** — 在動手前列出 prompt 既有 guard、實際 LLM 輸出、blocklist 漏洞，不假設 root cause；本 doc §2 全列。
2. **Simplicity First** — 兩個方案都僅 1-3 行 prompt 加減，禁止重寫 system prompt；不引入新 OpenAI 參數、不加 function-calling、不加 second-pass LLM。
3. **Surgical Changes** — 改動只觸及 `prompts/circles-final-report.js` 的 system prompt 文字 + adversarial spec 加變體；jest/Playwright 套件、API contract、DB schema 全不動。
4. **Goal-Driven** — 目的是讓 `d-mixed-one-good` variant 從 RED → GREEN，並保護其餘 9 variant 不 regress；不擴大到「重新設計 final-report UX」這類 scope creep。

---

## STANDING rules 引用

- `feedback_adversarial_review_testing` — 5+1 stage × 10 case adversarial sweep 是 prompt 改動的 ship-gate；本 doc §4 列出修完後該加多少新 variant。
- `feedback_find_first_fix_later_via_tracker` — Phase A find-only：本 doc 只 propose，不擅自 dispatch implementer；user 看完才決定 A/B。
- `feedback_two_stage_review_mandatory` — 將來 dispatch 修 prompt 的 sonnet implementer 必跟 2-stage review，不在本 doc scope。
- `feedback_subagent_self_report_unverifiable` — implement 後 director 必 git -S cross-check 該行真的進 prompt，不可信 sub-agent 自報。

---

## Section 1 — 讀 + Quote 證據

### 1.1 `prompts/circles-final-report.js` 整段 system prompt（line 30-81）

```js
const systemPrompt = `你是 PM 面試教練，正在為學員生成「完整模擬面試」的總結報告。學員剛走完 CIRCLES 7 個步驟，每步都有 AI 評分。你的任務是給出整體評估與下一步建議。

格式要求：
• 回傳合法 JSON（不加 markdown wrapper）
• 全部繁體中文
• 各欄位字數限制要嚴格遵守
• 報告必須具體針對這道題的分析過程，不要寫空泛廢話

評分等級：
• A：85 分以上 — 框架完整、邏輯嚴密、有獨到洞察
• B：70-84 分 — 整體合格，個別環節有提升空間
• C：55-69 分 — 框架走完了，但深度不足或邏輯有跳躍
• D：54 分以下 — 多個環節未到位，需要重新練習基礎

## 輸入品質檢查（最高優先級）

若 stepScores 中任一 step 的 totalScore < 30（代表該 step 學員填寫的是 garbage 或極短內容），則：

- coachVerdict 必須具體點出「N 個 step 字數不足，無法有效評分」（使用「有效評分」不用「完整評估」）
- **嚴禁** hallucinate「扎實」「清楚」「不錯」「優秀」「清晰」「思路清楚」「分析佳」「表現好」等正面語
- coachVerdict 和 headline 均不得使用「完整」「清晰」這類中性偏正面詞彙；改用「有效」「足夠」等中性詞
- headline 必須反映實況，嚴格使用下列模板之一：「多步輸入不足，需重練基礎」「欄位填寫過短，評分無效」「各步驟內容匱乏，難以有效評估」
- strengths 陣列若沒真實亮點 → 留空陣列或填「本次表現不足以列出強項」
- improvements 必須具體指出「字數不足」「內容過短」「未具體分析」這類根因
- nextSteps 必須建議「重練基礎欄位填寫」而非進階建議
- grade 嚴格依 overallScore 映射，不准看其他因素加分

若所有 7 step totalScore ≥ 70（代表學員全程認真）→ 正常評分流程，可給 A/B/strengths 等正面評語。

回傳 JSON 結構：
{
  "overallScore": <整數，已預先計算為各步驟平均分>,
  "grade": "A" | "B" | "C" | "D",
  "headline": "<10字內，一句話定調這次表現，例如「框架完整，洞察突出」「思路清楚，深度待強化」>",
  "strengths": [
    "<強項1，20字內，必須具體指出哪個步驟的什麼表現好>",
    "<強項2>",
    "<強項3>"
  ],
  "improvements": [
    "<改進點1，25字內，必須具體指出哪個步驟的什麼缺陷與如何改>",
    "<改進點2>",
    "<改進點3>"
  ],
  "nextSteps": "<下一步練習建議，40字內，要具體：例如「先用 drill 模式單練 R 步驟 3 次，重點是把痛點分到三個層次」>",
  "coachVerdict": "<教練總評，60-80字，必須具體針對這道題的分析過程，包含：一個讚賞的關鍵亮點 + 一個直接的批判 + 一句鼓勵>"
}

禁止寫的廢話：
• 「整體表現不錯」「分析還可以」「繼續加油」（沒有資訊量）
• 「需要更深入思考」（不具體）
• 「邏輯需要更嚴謹」（沒指出哪裡）`;
```

### 1.2 `tests/adversarial/circles-final-report-adversarial.test.js` variant `d-mixed-one-good`（line 128-150）

```js
{
  id: 'd-mixed-one-good',
  desc: '6步 totalScore=15 + 1步 totalScore=90 — 整體應 grade D，不因1個好步驟hallucinate讚美',
  buildStepScores: () => {
    const garbage = {
      dimensions: [{ name: 'd1', score: 1, comment: '不足' }],
      totalScore: 15,
      highlight: '無',
      improvement: '補充內容',
    };
    const strong = {
      dimensions: [{ name: 'd1', score: 5, comment: '優秀' }],
      totalScore: 90,
      highlight: '分析深入',
      improvement: '略',
    };
    return { C1: garbage, I: garbage, R: garbage, C2: garbage, L: garbage, E: garbage, S: strong };
  },
  expectations: {
    gradeIn: ['D'],
    overallScoreLt: 40,
    noHallucinatedPraise: true,
  },
},
```

### 1.3 `noHallucinatedPraise` assertion 規則（line 315-331）

```js
if (noHallucinatedPraise) {
  if (HALLUCINATED_PRAISE.test(result.coachVerdict)) {
    throw new Error(
      `[BUG — HALLUCINATION] variant "${id}": coachVerdict contains hallucinated praise.\n` +
      `coachVerdict: "${result.coachVerdict}"`,
    );
  }
  expect(result.coachVerdict).not.toMatch(HALLUCINATED_PRAISE);

  if (HALLUCINATED_PRAISE.test(result.headline)) { /* … */ }
  expect(result.headline).not.toMatch(HALLUCINATED_PRAISE);
}
```

### 1.4 `HALLUCINATED_PRAISE` regex（line 52）

```js
const HALLUCINATED_PRAISE = /扎實|不錯|優秀|(?<!不)清楚(?!的|地)|(?<!不)清晰(?!的|地)|思路.{0,5}清晰|分析.{0,5}佳|論述.{0,5}強|表現.{0,5}好|整體.{0,5}合格|整體.{0,5}不錯/;
```

### 1.5 觀察到的 fail message（`audit/wave1-task-1-findings.md` line 39-45）

> **行為**：6步 totalScore=15 + 1步 totalScore=90 的混合輸入，coachVerdict 含讚美詞「**學員在總結推薦步驟表現良好**，展現出深入分析的能力」。
>
> **預期**：coachVerdict 不應出現正面讚美；整體 grade 應 D（實際 overallScore=23 grade=D 正確）。
>
> **根因**：OpenAI GPT-4o 在 coachVerdict 段落看到 1 個高分步驟後，對整體做出不對稱讚美 — 即使大多數步驟極差。

抓到的 regex 命中：`表現.{0,5}好` 命中 `表現良好`。

---

## Section 2 — Root Cause 分析

### 2.1 既有 guard 為什麼漏？

**Prompt line 46-55 有完整的「輸入品質檢查（最高優先級）」block**，明確說：
- 若任一 step `totalScore < 30` → 觸發 guard
- 嚴禁 hallucinate「表現好」等正面語
- coachVerdict 必須點出「N 個 step 字數不足」

`d-mixed-one-good` case：6 個 step 是 `totalScore=15`（< 30），1 個 step 是 `totalScore=90`。**Guard 條件成立 → 應該觸發**。但 GPT-4o 仍然吐出「學員在總結推薦步驟表現良好」。

**為什麼 LLM 違反 guard？三個結構性矛盾：**

**矛盾 1（最關鍵）：JSON schema 自相矛盾 — coachVerdict 字段定義要求「讚賞」**

Line 75 的 schema：
```
"coachVerdict": "<教練總評，60-80字，必須具體針對這道題的分析過程，
                 包含：一個讚賞的關鍵亮點 + 一個直接的批判 + 一句鼓勵>"
```

這個 schema 在 `d-mixed-one-good` 場景把 LLM 推進兩難：guard 說「嚴禁讚美」，但 schema 說「必須包含一個讚賞」。LLM 看到 S step `totalScore=90 / highlight=分析深入` 就抓住這個「真實亮點」去履行 schema 的「讚賞」義務 → 寫出「總結推薦步驟表現良好」。LLM 內部解釋為「我有單獨指名某個 step，不是讚美全體，guard 不適用」。

**矛盾 2：guard 的 blocklist 是字面 token，不是語義 token**

Line 49 的禁詞：「扎實／清楚／不錯／優秀／清晰／思路清楚／分析佳／表現好」。
- 真實輸出「**表現良好**」(`表現良好` ≠ `表現好`，差一字)。
- HALLUCINATED_PRAISE regex 用 `表現.{0,5}好` 才抓到，但 prompt 本身的禁詞沒列「良好」。

LLM 在 token 層面遵守 prompt 黑名單後仍可從近義詞庫中採取繞道（「良好／佳好／不俗／可圈可點」均不在 prompt 名單）。

**矛盾 3：guard 的 trigger 含糊 — 「任一 step < 30」未指明 dominant pattern**

Line 46：`若 stepScores 中任一 step 的 totalScore < 30 → …觸發…`。
LLM 可能解讀成：「有的 step 是 garbage，但**有的 step 不是**；coachVerdict 描述非 garbage 那個 step 不算違規」。
Prompt 沒有顯式說「即便只有 1 個 step 高分，整體基調仍須以 garbage majority 為準」。

### 2.2 是 prompt 給 LLM 過大 freedom 嗎？

是的，schema 的 `coachVerdict` 描述是 free-form 60-80 字，且**主動要求**「讚賞 + 批判 + 鼓勵」三件套。在 garbage majority 場景下，這三件套互斥（沒可讚的東西就不該讚）。Prompt 沒有 case-split schema —「garbage 場景 schema = 批判 + 重練建議；good 場景 schema = 讚賞 + 批判 + 鼓勵」。

### 2.3 是 prompt 沒明確指示「coachVerdict 必須描述 dominant pattern」嗎？

是的。Prompt 從未出現「dominant pattern」「majority」「整體基調」這類詞。輸入品質檢查 block 只條列「不准用 X 詞」，沒指出「整體基調必須對齊 majority pattern」這個語義原則。

---

## Section 3 — 兩個 Fix 方案

### 方案 A — coachVerdict 措辭極性必須對齊 `overallScore`

**改動位置**：`prompts/circles-final-report.js` line 46-55 的「輸入品質檢查」block 末尾 + line 75 的 schema 字段描述。

**Prompt 加文範本**（建議插在 line 55 後 + line 75 改寫）：

```diff
  - nextSteps 必須建議「重練基礎欄位填寫」而非進階建議
  - grade 嚴格依 overallScore 映射，不准看其他因素加分
+ - **coachVerdict / headline 措辭極性必須對齊 overallScore**：
+   - overallScore < 60 → coachVerdict / headline 嚴禁出現任何正面或中性偏正面詞彙（包含但不限於：扎實／不錯／優秀／清楚／清晰／思路清楚／分析佳／論述強／表現好／**表現良好**／**表現尚可**／**亮點**／**可圈可點**／**有基礎**／**展現**）；只允許用「不足／未達／不到位／需重練／待補強／字數過短／內容過淺」這類陰性詞。
+   - 即使 stepScores 中有 1-2 個 step totalScore ≥ 70，只要 overallScore < 60，仍以陰性語為主；可在 improvements 陣列具體點名「S 步驟有局部嘗試但整體未達」，但 coachVerdict 不准用讚美句式。

  若所有 7 step totalScore ≥ 70（代表學員全程認真）→ 正常評分流程，可給 A/B/strengths 等正面評語。

  …

- "coachVerdict": "<教練總評，60-80字，必須具體針對這道題的分析過程，包含：一個讚賞的關鍵亮點 + 一個直接的批判 + 一句鼓勵>"
+ "coachVerdict": "<教練總評，60-80字，必須具體針對這道題的分析過程。措辭極性嚴格依 overallScore 切換：
+    若 overallScore ≥ 60 → 結構為『一個讚賞的關鍵亮點 + 一個直接的批判 + 一句鼓勵』；
+    若 overallScore < 60 → 結構為『一個具體缺陷 + 一個根因說明 + 一句重練建議』，全段不准出現任何正面詞>"
```

**優點**：
1. 對齊 user 的 UX 目標：grade=D + coachVerdict 措辭 = 「不通過」基調一致。
2. Test assertion 容易寫：`overallScore < 60 → coachVerdict 不命中 positive regex`，binary check。
3. Reuse 既有 HALLUCINATED_PRAISE regex，只擴禁詞清單即可。
4. 對「全好」case（variant j）零影響：`overallScore=100 ≥ 60` → 走原本讚賞 schema。

**缺點**：
1. 高分學員（variant i `borderline-55` overallScore≈55）會被歸入「不准讚美」陣營；對 borderline C 學員心情衝擊大（「都到 55 了還是被罵」）。可在 60 / 55 / 50 之間調 threshold。
2. 過度僵化：失去「老師對 borderline 學員溫和鼓勵」的彈性；若 user 想保留「教練調性溫和」風格，方案 A 不適合。
3. 「不准出現正面詞」黑名單永遠列不完；LLM 可能繞道用「展現潛力」這類新組合詞。需要長期擴 regex。

**對應 unit test 加 5 個變體**：
| variant id | totalScore 分布 | overallScore | 預期 grade | 預期 coachVerdict polarity |
|---|---|---|---|---|
| `k-polarity-20` | 7 × 20 | 20 | D | 全 neg，0 pos token |
| `l-polarity-40` | 7 × 40 | 40 | D | 全 neg，0 pos token |
| `m-polarity-55` | 7 × 55 | 55 | C | 全 neg（< 60 threshold） |
| `n-polarity-70` | 7 × 70 | 70 | B | 允許 pos / 必含批判 |
| `o-polarity-90` | 7 × 90 | 90 | A | 允許 pos / 必含 1 個 strengths |

5 個 variant 共同 assertion：`overallScore < 60` 時 `expect(coachVerdict).not.toMatch(HALLUCINATED_PRAISE_EXTENDED)`。

---

### 方案 B — coachVerdict 必須描述 dominant pattern

**改動位置**：同上 line 46-55 + line 75。

**Prompt 加文範本**：

```diff
  - grade 嚴格依 overallScore 映射，不准看其他因素加分
+ - **coachVerdict / headline 必須描述 dominant pattern**：
+   - 「dominant pattern」= 7 個 step 中超過半數（≥ 4 個）所呈現的水準。
+   - 若 ≥ 4 個 step totalScore < 60 → coachVerdict 整段基調必須以「整體不足」為主軸，可單獨點名某一 step 的局部亮點，但**不可**用作整段定調。
+   - 範例（dominant=garbage）：「七個步驟中六個欄位內容過短、未到位，僅 S 步驟有局部嘗試但整體基礎不穩，建議重練基礎欄位填寫」。
+   - 反例：「學員在 S 步驟表現良好」← 違規，未描述 majority pattern。

  若所有 7 step totalScore ≥ 70（代表學員全程認真）→ 正常評分流程，可給 A/B/strengths 等正面評語。

  …

- "coachVerdict": "<教練總評，60-80字，必須具體針對這道題的分析過程，包含：一個讚賞的關鍵亮點 + 一個直接的批判 + 一句鼓勵>"
+ "coachVerdict": "<教練總評，60-80字，必須具體針對這道題的分析過程。整段必須以 dominant pattern（≥ 4 步的共同水準）為主軸；可選擇點名 1 個局部亮點或缺陷作對照，但主軸不得被局部蓋過>"
```

**優點**：
1. 保留教練對「局部亮點」的描述空間（user 體驗較溫和）；不會因為 1 個 step 高分被完全壓抑。
2. 對「borderline 全 55」case 友善：dominant 是 55 → coachVerdict 可說「整體中等，有 framework，深度不足」，不被強制陰性。
3. 概念上比方案 A 「更教練化」：對齊「老師看一份卷子先抓 main pattern 再講細節」的自然 reasoning。

**缺點**：
1. 「dominant pattern」是抽象概念，LLM 可能誤解（什麼叫「主軸不得被局部蓋過」？）。需要 ≥ 1 個 in-context example 才穩。
2. Test assertion 比方案 A 難寫：要驗「主軸 = majority」是語義級判斷，不是 regex binary check。可能要用第二個 LLM call 做 grading（這違反「禁加第二次 LLM call」的 simplicity 原則）。退而求次：用「coachVerdict 整段字數比例」估算（陰性詞 occurrence ≥ 陽性詞 occurrence × 2），但這 heuristic 易破。
3. `d-mixed-one-good` 6 garbage + 1 good 屬於 dominant=garbage（6 ≥ 4），但若 user 設計 `4 good + 3 garbage` case，dominant=good，prompt 又允許讚美 → 跟 overallScore=avg 可能不對齊（4×80 + 3×20 = 80×4/7+20×3/7 ≈ 54 → grade D，但 dominant=good 又允許讚美）。**這是方案 B 的核心 inconsistency**：dominant pattern 跟 overallScore 不必然對齊。

**對應 unit test 加 4 個變體**：
| variant id | 7 step 分布 | overallScore | dominant | 預期 coachVerdict 描述 |
|---|---|---|---|---|
| `k-dominant-garbage` | 6×15 + 1×90 | 25 | garbage | 主軸 = garbage / majority |
| `l-dominant-good` | 1×15 + 6×85 | 75 | good | 主軸 = good majority + 點名 1 個低分 |
| `m-balanced-3-4` | 3×20 + 4×80 | 54 | good (4/7) | 主軸 = good，但 overallScore < 60 → conflict case，需 user 決定行為 |
| `n-balanced-4-3` | 4×20 + 3×80 | 46 | garbage | 主軸 = garbage |

`m-balanced-3-4` 是方案 B 的 stress test — 若兩個原則衝突（dominant vs score）以哪個為主？方案 B 沒回答。

---

### 推薦：**方案 A**

**三軸對比**：

| 軸 | 方案 A | 方案 B | 勝出 |
|---|---|---|---|
| **產品 UX 一致性** | grade=D + coachVerdict 全 neg → user 訊號 100% 對齊 | dominant=good 但 score<60 (`m-balanced` case) → 用戶看 D 但聽到讚美，仍混淆 | **A** |
| **Prompt 簡潔性** | 加 1 個 if/else schema + 擴禁詞清單；LLM 易遵守 | 引入抽象詞「dominant pattern」，需 in-context example；LLM 易誤解 | **A** |
| **Test 覆蓋難度** | binary regex check，5 variant 全部 mechanical assertion | 需語義級 assertion 或 LLM-as-judge；4 variant 中 1 個 unresolvable conflict | **A** |

**結論建議方案 A**。理由：
1. **NEW-B13-W1 的 user-facing 痛點**就是「grade=D 但見讚美 → 混淆」。方案 A 直接綁定 `overallScore < 60 → 不准讚美`，根除 user 痛點。
2. 既有 prompt 已有 `輸入品質檢查（最高優先級）` block + HALLUCINATED_PRAISE regex 黑名單；方案 A 是「延伸既有設計」，方案 B 是「引入新原則」。Simplicity First 偏方案 A。
3. Test 可 mechanical 驗證 → 對 adversarial sweep 友善（jest 每 nightly 跑），方案 B 需 LLM-as-judge 違反禁加 LLM 原則。

**保留方案 B 的部分價值**：若 user 想保留教練「點名局部亮點」溫度，可在方案 A 基礎上額外加一句「improvements 陣列可指名局部嘗試（例：『S 步驟有嘗試但整體未達』），但 coachVerdict 不准」。這把「點名局部」流到 improvements，coachVerdict 仍維持極性對齊。

---

## Section 4 — 對應 Adversarial Test 該加多少變體

> 採方案 A → 加 5 個變體（覆蓋 score band × polarity matrix）+ 2 個守 mixed-input edge case = **共 7 個新 variant**

| # | variant id | 7 step 分布 | overallScore | 預期 grade | 預期 coachVerdict polarity | 用途 |
|---|---|---|---|---|---|---|
| 1 | `k-polarity-20` | 7 × 20 | 20 | D | 全 neg（0 pos token） | 守 score<60 純 neg |
| 2 | `l-polarity-40` | 7 × 40 | 40 | D | 全 neg | 守 score<60 純 neg |
| 3 | `m-polarity-55` | 7 × 55 | 55 | C | 全 neg | borderline 守 threshold |
| 4 | `n-polarity-70` | 7 × 70 | 70 | B | 允許 pos / 必含批判 | 守 score≥60 可讚美 |
| 5 | `o-polarity-90` | 7 × 90 | 90 | A | 允許 pos / 必含 1 個 strengths | 守高分 case 不被誤殺 |
| 6 | `p-mixed-4good-3bad` | 4×80 + 3×20 | 54 | D | 全 neg（score<60 優先於 4/7 good majority） | **直接守方案 A 與方案 B 衝突點**，證明 score 是 single source of truth |
| 7 | `q-mixed-1good-6bad-extended` | 6×15 + 1×90 | 25 | D | 全 neg（變體 d 的 stronger 版） | 守原 NEW-B13-W1 bug 不 regress |

**Test code skeleton（不真的寫，僅供 user 參考）**：

```js
// Extend HALLUCINATED_PRAISE regex first:
const HALLUCINATED_PRAISE_EXTENDED = /扎實|不錯|優秀|良好|尚可|亮點|可圈可點|有基礎|展現|.../; // + 既有

// Then in each new variant:
expectations: {
  gradeIn: ['D'],
  overallScoreLt: 60,
  noHallucinatedPraise: true, // existing assertion auto-fires regex check
}
```

**HALLUCINATED_PRAISE regex 必須同步擴充**（這是方案 A 的相對成本）：
- 既有 regex 漏「良好」「尚可」「亮點」「可圈可點」「有基礎」「展現」。
- 建議加：`/良好|尚可|亮點|可圈可點|有基礎|展現/`。
- 注意：「展現」可能在 neg 句中合法出現（「未能展現深度」），需 negative lookbehind 處理或接受 false positive 一次。

---

## Section 5 — Risk / 風險評估

### 5.1 既有 9 個 adversarial variant regression 預測

| variant id | 場景 | 既有 expectation | 方案 A 改後預期 | regression risk |
|---|---|---|---|---|
| `a-all-zero-scores` | 7×0 | grade=D, score<40, no praise | 同 — schema 切到 neg-only | **LOW** — 既有 guard 已抓 |
| `b-all-20-scores` | 7×20 | grade=D, score<40, no praise | 同 | **LOW** |
| `c-single-step-only` | 只 C1 step | grade ∈ [D,C,B,A], no assertion on praise | LLM 可能因 overallScore=40 (single step) 被切到 neg-only schema → headline 可能變「不足」型 | **MEDIUM** — 該 variant 沒鎖 praise，所以實際 不會 fail；但語氣會變陰性，需 user 確認可接受 |
| `d-mixed-one-good` | 6×15 + 1×90 | grade=D, score<40, no praise | overallScore=25 < 60 → 切 neg-only schema → 不再 hallucinate 讚美 → **FIX target** | **N/A — 這是要修的 case** |
| `e-empty-highlights` | 7×40 空欄位 | grade ∈ [D,C], score<60, no assertion | 切 neg-only → headline 變陰性；assertion 不抓 praise 所以 PASS | **LOW** |
| `f-injection-in-highlight` | 7×10 + injection | grade=D, score<40, no praise | 既有 injection 防護不變；neg-only schema 額外保險 | **LOW** |
| `g-extreme-long-improvement` | 7×20 超長字段 | grade=D, score<40, no praise | 同 | **LOW** |
| `h-zero-dimensions` | 7×10 empty dims | grade ∈ [D,C], score<40, no assertion | 同；schema 切 neg-only | **LOW** |
| `i-borderline-55` | 7×55 borderline | grade ∈ [C,B], score<70, no assertion | overallScore=55 < 60 → 切 neg-only → coachVerdict 必全 neg → 若舊行為是 mixed/positive，**這個 variant 可能 fail** | **MEDIUM-HIGH** — 需 user 確認 borderline 55 是否要強制陰性；可考慮 threshold 60→55 或 60→50 |
| `j-perfect-all-100` | 7×100 完美 | grade=A, score≥85, no assertion | overallScore=100 ≥ 60 → 走原讚賞 schema → 零變動 | **LOW** |

**總結 regression risk**：
- 7 個 variant 風險 LOW（多數因為 `noHallucinatedPraise: false` 沒鎖正面詞）。
- `c-single-step-only` 中度（可能語氣變陰性但 assertion 不抓）。
- `i-borderline-55` **MEDIUM-HIGH** — 需 user 決定：
  - **選項 i-a**：threshold = 60 → variant i 必須調整 expectation（強制 neg）。
  - **選項 i-b**：threshold = 55 → variant i 保持原樣，但喪失「borderline 也警示」的 UX value。
  - **選項 i-c**：threshold = 50 → 更寬鬆，「borderline 55」可保留教練溫和語氣；但 grade 仍 C，可能仍有些微訊號錯位。

**Director 建議**：threshold = **60**（對齊 prompt 既有等級表 C/D 分界），同步調整 variant i expectation 改為 `noHallucinatedPraise: true`。

### 5.2 Prompt 改後其他風險

| 風險類別 | 描述 | mitigation |
|---|---|---|
| **GPT-4o 模型 drift** | 新 prompt 在 gpt-4o-mini 或 gpt-4-turbo 上行為可能不同 | 本專案目前固定 `model: 'gpt-4o'`，drift 風險限於 OpenAI 更新該 model；ship 後 nightly adversarial sweep 即可監測 |
| **中文同義詞繞道** | LLM 可能用「具備一定潛質」「有見地」這類沒列禁詞 | 接受首次 ship 漏，後續 sweep 抓到再擴 regex；不可能 zero shot |
| **JSON schema 過載** | 加了 if/else 邏輯到 schema 描述，LLM 可能解析失敗 | 已有 `response_format: { type: 'json_object' }` 保險；最壞 case 是 fallback 到 generic 描述，仍合法 JSON |
| **production E2E spec 影響** | `tests/adversarial/circles-final-report.spec.js`（2-case 版）和 `wave1-b13-prompt-regression-smoke.spec.js` 是否受影響？ | 都是 happy path 驗 shape；不驗 coachVerdict 措辭極性 → **LOW**；但建議跑一次 verify |

### 5.3 Operational risk（process 面）

1. **此修改觸動 Path 2 carve-out**：per CLAUDE.md「Path 2 期間不動 prompts」+ `feedback_adversarial_review_testing` 「Path 2 prompts 鎖死有此 carve-out」。本 prompt 是 ship-time bug-fix carve-out，user 必須親准（簽 Iron Law 3 條 + Karpathy 4 條）。
2. **Live demo gate**（`feedback_live_demo_gate_protocol`）：prompt 修完必跑 production E2E 一次，user 親 Read 1 個 garbage walk-through 確認 coachVerdict 措辭符合預期，才能 commit。
3. **2-stage review**：將來 dispatch sonnet implementer 必跟 reviewer 1 (spec compliance) + reviewer 2 (regex coverage)。
4. **Cross-plan smoke**（`feedback_cross_plan_smoke_after_each_ship`）：ship 完跑 jest + Playwright + production smoke 三件套，commit message 含三組數字。

---

## Section 6 — 1 句話 Recommendation

> **採方案 A**（coachVerdict 措辭極性綁定 `overallScore < 60` 切 neg-only schema，配合 HALLUCINATED_PRAISE regex 擴禁詞清單），加 7 個新 adversarial variant，預期 `i-borderline-55` expectation 需同步調整為 `noHallucinatedPraise: true`；ship 走 Path 2 prompt carve-out + 2-stage review + live demo gate + cross-plan smoke。

---

## Section 7 — Sub-agent 自確不算數聲明

per `feedback_director_self_confirm_forbidden` STANDING：

本 doc 完成後 director **不自確** spec compliance。User 必：
1. Read 本 doc 全文
2. 決定方案 A / B / 混合
3. 決定 threshold (60 / 55 / 50)
4. 決定是否同步擴 HALLUCINATED_PRAISE regex
5. 簽核才能 dispatch implementer 改 prompt

本 doc 嚴格遵守：禁改 prompt 檔 / 禁改 spec / 禁 git stage / 禁 commit。僅 Read + Write brainstorm doc。
