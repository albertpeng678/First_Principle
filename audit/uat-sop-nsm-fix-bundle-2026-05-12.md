# UAT SOP — NSM Fix Bundle (2026-05-12)

**目的：** User 自行在 production / dev server 驗證 8 個 NSM bug 全已修正。

**環境：** Production `https://first-principle.up.railway.app` 或本地 `http://localhost:4000`

**Bundle commits：** 762a8ab → 45867f7 → 8f4c1fa → 914adb5 → ccec6dc → 462678f → 4e408fb → eeb3fec → d668c26

---

## §A 開啟系統 + 登入

1. 開啟瀏覽器，進入 `https://first-principle.up.railway.app`（或 `http://localhost:4000`）
2. 點右上角 [登入] — 輸入 Google 帳號登入
3. 確認頂部 navbar 顯示「CIRCLES」+ 「北極星指標」兩個 tab
4. 如已有舊 NSM session，點「北極星指標」確認能看到歷史列表

---

## §B Bug X-Compare 驗證

**Bug：** Step 4 對比 tab「你的」欄位空白（NSM rows — 舊 schema string 未 coerce）

**前置：** 需要一個已評分完成的 NSM session（若沒有，先走完 Step 1-4 並評分）

**步驟：**
1. 在 NSM session 列表，點擊任一「已完成」session
2. 系統應直接跳到 Step 4（總結）
3. 點「對比」tab
4. 找「北極星指標」row，「你的」那欄應顯示你當初填入的 NSM 定義文字
5. 點「拆解」tab，「你的」欄同樣應有內容
6. 點「亮點」tab，確認評語存在

**預期：** 「你的」欄位全部有內容，不空白。

---

## §C Bug X-Back 驗證

**Bug：** 已評分 session 點 navbar NSM tab 或 CIRCLES→NSM CTA，會被 reset 到 Step 1

**步驟（T1 — navbar tab）：**
1. 進入任一已評分完成的 NSM session（Step 4 視圖）
2. 點 navbar 頂部「北極星指標」tab
3. 預期：系統保持在 Step 4（或 session 列表），不應跳回 Step 1 選題

**步驟（T2 — CIRCLES→NSM CTA）：**
1. 切到「CIRCLES」tab
2. 在頁面底部找「開始 NSM 北極星訓練」CTA button
3. 點擊 — 預期：進入新的 NSM Step 1 選題（clean state，無舊 session 資料外洩）

**步驟（T3 — CIRCLES home CTA 清除所有 NSM state）：**
1. 在有評分 session 時，點 CIRCLES CTA 進入新 NSM
2. 完成選題後確認 Step 2 顯示的是新問題，非舊 session 內容

---

## §D Bug X-LockedStep2 驗證

**Bug：** 已評分 Step 2 未 lock，仍可編輯 + 有「回首頁」button，不應有

**步驟：**
1. 進入任一已評分完成的 NSM session
2. 點 Step progress bar 上的「2 指標」step（或 session 應自動顯示 locked Step 2）
3. 驗證：
   - 頂部出現「已評分完成 — 內容鎖定，可繼續查看提示與範例」banner
   - 三個 NSM 欄位（北極星指標 / 定義說明 / 與業務目標連結）文字框為 readonly 淡灰色，無法編輯
   - 底部 submit-bar 只有「查看評分結果」一個 CTA，左側顯示「已評分完成」icon + 文字
   - 無「回首頁」button
4. 點「提示」按鈕 — 預期：提示 modal 正常彈出（不因 locked 而失效）
5. 點「99 範例答案」— 預期：範例答案下拉展開，有真實 Zoom/Spotify 等公司的 NSM 範例

**重點：** locked 狀態下提示 + 範例必須仍可用。

---

## §E Bug X-Overlay 驗證（mobile only）

**Bug：** NSM Step 4「教練思路」在 mobile 開啟的是全頁 modal 而非 bottom-sheet

**步驟（需用手機或 Chrome DevTools 切換到 Mobile 模擬，寬度 ≤ 480px）：**
1. 進入已評分的 NSM session → Step 4 → 「對比」tab
2. 找任一「教練思路」按鈕（帶 graduation cap icon）
3. 點擊
4. 驗證：
   - 畫面底部升起一個 bottom-sheet（非全頁跳轉）
   - sheet 頂部有一個 36px 灰色 handle pill
   - sheet 有 16px 上圓角
   - 後方畫面有半透明 backdrop dim
   - sheet 內含「教練思路」標題 + 內容 + 為什麼這樣拆解段落
   - 底部全寬「了解了」button（高度 ≥ 44px）
   - 點「了解了」或 backdrop — sheet 收起

**桌面模式（≥ 768px）：** 教練思路應改為 accordion 展開（非 bottom-sheet）。

---

## §F Bug X-FE 驗證（範例答案 clickable + 有真實內容）

**Bug：** 範例答案按鈕可點但無內容，或點了無反應

**步驟：**
1. 在 NSM Step 2（無論 locked 或未評分）
2. 任一欄位右側點「99 範例答案」chevron
3. 驗證：
   - 下拉展開，顯示真實公司範例（如 Zoom、Spotify、Airbnb、Notion 等）
   - 每個範例有公司名 + NSM 定義文字
   - 多筆範例可滾動瀏覽

**亦在 Step 3 驗證：**
4. 進到 NSM Step 3 拆解
5. 各個拆解欄位的「範例答案」同樣點擊展開，有真實內容

---

## §G Bug X-Ctx 驗證（深入了解問題 expand 有 4 blocks 真實 context）

**Bug：** 「深入了解問題」展開後是空的或 undefined

**步驟：**
1. 在 NSM Step 2（或 Step 3）
2. 找「深入了解問題」chevron link（位於問題描述 card 底部）
3. 點擊展開
4. 驗證出現 4 個內容區塊：
   - 商業模式背景
   - 使用者角度
   - 常見陷阱
   - 破題切入方向
5. 確認每個區塊都有真實段落文字，非空白或佔位符

---

## §H Bug X-DupSession 驗證（Spotify 只顯示 1 row）

**Bug：** 同一題目有多筆重複 session，list 顯示多行

**步驟：**
1. 點頂部「北極星指標」tab 進入 NSM session 列表
2. 若過去曾對同一問題（如 Spotify 北極星指標）做過多次練習，list 中應只出現 1 筆（取最後完成或最進階的那筆）
3. 不應出現 2+ 筆同一問題的 row

**若無重複 session 可驗：** 確認 list 整體呈現乾淨，無明顯重複項目。

---

## §I Bug X-SlowList 驗證（offcanvas 第 2 次開啟快速）

**Bug：** offcanvas 歷史 drawer 第 2 次開啟仍觸發 API 請求，有明顯 loading delay

**步驟：**
1. 點 navbar 左側 menu 圖示開啟 offcanvas 歷史 drawer
2. 確認 session list 載入完成，關閉 drawer
3. 立刻再次開啟 drawer
4. 驗證：第 2 次開啟幾乎即時顯示（< 200ms），不出現 loading spinner 再次旋轉

**注意：** 30 秒後 cache 過期，第 2 次開啟才會重新打 API。在 30 秒內驗即可。

---

## 驗收標準

| Bug | 驗收條件 |
|---|---|
| X-Compare | 對比 tab「你的」欄位全部有內容 |
| X-Back | navbar NSM tab 不 reset 已評分 session；CIRCLES CTA 帶 clean state |
| X-LockedStep2 | Locked banner + readonly fields + 單一 CTA；提示/範例仍可用 |
| X-Overlay | Mobile bottom-sheet 帶 handle/圓角/backdrop；桌面 accordion |
| X-FE | 範例答案展開有真實公司內容（Step 2 + Step 3）|
| X-Ctx | 深入了解問題展開 4 blocks 真實文字 |
| X-DupSession | 同題只顯示 1 row |
| X-SlowList | 30s 內第 2 次開啟 offcanvas 即時無 loading |

全部 8 項通過 = Bundle UAT PASS。

---

*Director cold-Read 16 PNG (T3 8vp + T4 4vp) — PASS*
*iOS 15-item — 15/15 PASS*
*Playwright — 64 pass / 8 skip*
*jest — 214/232 + 17 skip + 1 pre-existing fail (baseline 不破)*
