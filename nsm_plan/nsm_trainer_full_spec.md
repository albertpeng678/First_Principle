# 產品需求與實作規格書 (PRD)：北極星指標 (NSM) 拆解工作坊

## 1. 產品定位與核心目標
本專案為一個互動式的 Web 應用，旨在訓練產品經理（PM）建立數據驅動的邏輯，精準定義並拆解「北極星指標 (North Star Metric)」。
- **反面教材防範：** 系統必須能嚴格揪出並痛批「虛榮指標」（如單純的 DAU、註冊數、總下載量），拒絕沒有業務價值的「水豚 PM」思維。
- **核心機制：** 透過情境帶入、引導式拆解、以及 AI 即時的五大維度點評，建立學員的指標拆解肌肉記憶。

## 2. 技術棧建議 (Tech Stack)
- **Frontend Framework:** React (Next.js 建議, App Router)
- **Styling:** Tailwind CSS + Shadcn UI (或類似的 headless UI 庫以求快速開發)
- **State Management:** Zustand (需管理使用者在「選擇題目 -> 定義指標 -> 拆解指標」跨步驟的狀態)
- **Visualization:** `reactflow` 或 `mermaid.js` (用於繪製指標拆解樹狀圖)
- **AI Integration:** OpenAI 或 Anthropic SDK (用於串接系統內的「AI 教練點評引擎」與「題庫擴展」)

---

## 3. 核心練習流程與 UI/UX 狀態機 (State Machine)

### 3.1 Stage 1: 情境抽選 (Context Initialization)
- **UI:** 網格卡片佈局 (Grid Cards)。
- **邏輯:** 系統從內建的 JSON 題庫（見第 5 節）中隨機抽取 3 題供學員選擇，或讓學員點擊「隨機盲抽」。
- **輸出:** 確立當次練習的 `company`, `industry`, `scenario`。

### 3.2 Stage 2: 定義北極星指標 (Define the North Star)
- **UI:** 置頂顯示商業情境 (Scenario) 作為常駐提示。中央為大型 Input Field。
- **邏輯:** 學員輸入他們認為的 NSM。
- **AI 攔截機制:** - 提交後，系統背景比對題庫的 `anti_patterns`。
  - 若命中虛榮指標，跳出 Modal 阻擋進入下一關，並提示：「這似乎是虛榮指標，如果這個數字翻倍，公司一定會更賺錢嗎？請重新思考。」

### 3.3 Stage 3: 指標樹拆解 (Input Metrics Breakdown)
- **UI:** 提供四個輸入區塊，分別對應寬度 (Reach)、深度 (Depth)、頻率 (Frequency)、效率 (Efficiency)。
- **邏輯:** 要求學員將剛剛定義的 NSM 拆解為具備 MECE 原則的先行指標。

### 3.4 Stage 4: 教練點評與視覺化對比 (Evaluation & Visualization)
- **UI:** 左右雙欄對比 (Split View)。左側為學員的拆解樹，右側為系統底牌的教練拆解樹。
- **邏輯:** 渲染 AI 教練根據「五大面向」產出的雷達圖與具體評語（見第 4 節）。

---

## 4. AI 教練點評引擎 (Evaluation Engine Prompts)

在 Stage 4 結算時，系統需調用 LLM 生成專屬點評。請在後端實作此 Prompt 結構：

```text
[System Prompt]
你是一位嚴格且經驗豐富的產品總監，專門指導初階 PM 拆解北極星指標。
請根據學員的答案與標準答案，給予 1-5 分的評分，並輸出 JSON 格式的評語。

[Input Data]
商業情境: {scenario}
標準 NSM 關鍵字: {target_nsm_keywords}
虛榮指標陷阱: {anti_patterns}
學員定義的 NSM: {user_nsm}
學員拆解的維度: {user_breakdown}

[Evaluation Criteria - 五大面向]
1. 價值關聯性 (Alignment): 學員指標是否反映商業價值？
2. 領先指標性 (Leading): 該指標是否能預測未來營收？
3. 操作性 (Actionability): 開發團隊能否透過功能改動影響此指標？
4. 可理解性 (Simplicity): 指標是否直觀易懂？
5. 週期敏感度 (Sensitivity): 變化是否能即時觀測？

[Output Format Requirement]
請輸出包含 "radar_scores" (5個維度的1-5分) 與 "coach_comments" (針對每個維度的一句話犀利點評) 的 JSON。若學員命中 anti_patterns，請在評語中嚴厲指出。