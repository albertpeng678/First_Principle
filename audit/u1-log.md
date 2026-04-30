# U1 — 大三學生 (Desktop 1280×800, Chrome, distracted) audit log

> Persona note: 老師說這個叫 PM Drill 很適合面試練習，我邊看 YouTube 邊點開，結果第一眼就一堆我看不懂的詞，每次切回來這個 tab 都不知道自己剛才在哪。

## Issues (one row per finding)

| # | Step / screen | Severity | Category | Title | Repro / where to look | Persona reaction |
|---|---|---|---|---|---|---|
| 1 | 01-landing-circles-home.png | P0 | layout | 1280 寬度版面整個塞在中間左側、右側 ~500px 完全空白 | 看 `01-landing-circles-home.png` 的右半邊：「選擇題目」搜尋列右側到視窗邊緣是純空地，題目卡卻被擠成 ~140px 寬一欄 | 這 layout 看起來像手機版被硬塞到電腦上，第一印象就覺得不專業，跟 Notion / Linear 差很多 |
| 2 | 01-landing-circles-home.png | P0 | layout | 題目卡片擠成單欄、品牌名跟標題斷成 2-3 行 | `01-landing-circles-home.png` 中欄：「Shopee — Shopee Loyalty Program」、「Meta — Facebook Marketplace」品牌名跟標題斷在不同行，閱讀很卡 | 我根本不想 hover 看哪張卡，因為標題都被切碎了 |
| 3 | 01-landing-circles-home.png | P0 | layout/visual | 「S 步驟含北極星指標練習」卡片：藍色「前往 NSM →」按鈕直接壓在卡片內文上方 | 看 `01-landing-circles-home.png` 最後一張卡，按鈕跟「想做最完整的 NSM 定義訓練？」這行字重疊 | 我以為是 bug，按鈕浮在內文上面看起來很 cheap |
| 4 | 01-landing-circles-home.png | P0 | flow/copy | 主視覺塞滿 jargon：CIRCLES、完整模擬、步驟加練、北極星指標、NSM 都沒解釋 | `01-landing-circles-home.png` 練習模式區塊跟頂部歡迎卡片 | 我是新手，第一螢幕就 5 個沒看過的縮寫，要我去 Google 查 5 次才能開始？ |
| 5 | 01-landing-circles-home.png | P1 | visual | 「CIRCLES 訓練」標題用 serif 但其他地方都 sans-serif，font 風格不一致 | `01-landing-circles-home.png` 主標題 vs 「練習模式」「題型」等標籤 | 看起來像兩個設計師沒溝通好，介面不像同一個產品 |
| 6 | 01-landing-circles-home.png | P1 | layout | Top nav 同時出現左側 `北極星指標` tab 跟右上 `北極星指標` 按鈕，重複且讓 1280 寬度更擠 | `01-landing-circles-home.png` 頂部 nav | 我以為是兩個不同東西，點進去才發現一樣，浪費我時間 — 也會在更寬的螢幕重現 (Issue #0-B) |
| 7 | 02-no-more-button.png | P1 | flow | 隨機選題按鈕看起來只是 reshuffle 5 張卡，但旁邊 ~500px 空白搜尋框沒任何 placeholder 提示能搜什麼 | `02-no-more-button.png` 右側搜尋輸入框 | 我不知道那個白色長方形是搜尋還是 input，沒有 icon 沒有 placeholder |
| 8 | 03-circles-step-C.png | P0 | layout | CIRCLES 步驟頁：表單只佔左半、右半 ~600px 只放一張小小「題目脈絡」卡，剩下全空 | `03-circles-step-C.png` 整頁右 60% 是空地 | 1280 螢幕應該是兩欄並排好用空間，怎麼跟手機一樣窄欄？ |
| 9 | 03-circles-step-C.png | P0 | layout/bug | 底部 sticky 操作列「送出評分」直接蓋住「業務影響」欄位 textarea | `03-circles-step-C.png` `送出評分` bar 之下可以看到「說明業務影響與核心約束…」被切一半 | 我滾下去填業務影響的時候會一直被那條藍 bar 擋住，超煩 |
| 10 | 04-circles-I.png ~ 10-circles-summary.png | P0 | flow/bug | 整個 walkthrough 卡在 step C：04-I、05-R、06-CUT、07-L、08-E、09-S、10-summary 全都顯示「C – 澄清情境 1/7」沒前進 | 對比 `04-circles-I.png` ~ `10-circles-summary.png` 的標題列 | 表單驗證「請至少填寫 2 個欄位」擋住下一步，但我只填了 1 個就被卡死 — 而且 13~16 NSM 中段截圖完全 missing，代表流程在那邊也斷了 |
| 11 | 04-circles-I.png | P1 | copy | 「問題範圍」答案區出現的 placeholder 範例講 Netflix，但題目是 Shopee Loyalty — 範例與題目錯配 | `04-circles-I.png` 「問題範圍」欄底下的範例 bullet 提到 Netflix 「找不到自己想看內容」 | 啊？範例不是要對應這題嗎？我以為是不是答錯題目了 |
| 12 | 03-circles-step-C.png | P1 | copy/a11y | 7 步驟進度條只有顏色條沒有文字標籤，1/7 標示在右側很小 | `03-circles-step-C.png` 標題下方 7 條 progress bar | 我切回 tab 完全忘了現在在第幾步、後面還有什麼，沒有「下一步是 I 步」這種提示 |
| 13 | 03-circles-step-C.png | P1 | copy | 欄位 placeholder 是同義反覆「說明討論的問題範圍與問題類型…」、「列出你的關鍵假設，並標註哪些待確認…」 — 沒範例、沒長度提示 | `03-circles-step-C.png` 4 個 textarea | 對新手等於沒幫助，我只想看一句範例答案 |
| 14 | 11-offcanvas-open.png | P1 | layout | 練習記錄 drawer 打開後關閉 X 跟「未完成練習」横條 banner 在內容區疊在一起，視覺擁擠 | `11-offcanvas-open.png` drawer 右上 X 跟主內容區的 banner | 不確定 X 是關 drawer 還是關 banner，第一次看會點錯 |
| 15 | 12-nsm-home.png | P1 | flow | NSM 第 1 步應顯示 5 張題目卡 (依專案規格)，這裡只有 4 張：ElevenLabs、ClassPass、Duolingo、Attentive | `12-nsm-home.png` 「選擇題目」list | 不確定是少 load 一張還是隨機就只給 4，反正跟 CIRCLES home 5 張不一致 |
| 16 | 12-nsm-home.png | P1 | visual | 底部 CTA「開始 NSM 訓練 →」呈淡藍 disabled 樣式，但用戶其實沒選任何卡也看不出該怎樣 enable | `12-nsm-home.png` 底部 sticky 按鈕 | 我以為按鈕壞了，沒看出要先選一張卡才會亮起來 |
| 17 | 13-nsm-no-card.png | P0 | bug | 13 跟 12 看起來幾乎一模一樣 — 應該是「按下隨機選題」或「沒有可選卡」的狀態，但 UI 完全沒回饋 | 對比 `12-nsm-home.png` 跟 `13-nsm-no-card.png` | 我點按鈕都沒反應，下次直接離開 |
| 18 | (13~16 missing) | P0 | flow | 流程跑到 NSM 中段就缺截圖 14、15、16 — 表示自動化跑到那段也跑不過去 | `audit/screenshots/Desktop-1280/` 目錄沒有 14-16 | 真的使用者大概在這邊就放棄了 |
| 19 | 17-review-examples.png | P1 | layout | 範例審閱頁是密集的小卡 grid，每張卡字小到要 zoom，1280 寬度沒善用空間 | `17-review-examples.png` 整頁佈局 | 在筆電上看就一片密麻麻文字，我不會想滾完 |
| 20 | 18-login-screen.png | P1 | a11y/visual | 登入畫面：登入/註冊 tab 用色塊區分但沒 underline 或 active state 文字差異，新手看不出哪個 active | `18-login-screen.png` 表單上方的 `登入` (藍) / `註冊` (白) 按鈕 | 我以為兩個都可以按，分不出哪個是當前狀態 |
| 21 | 18-login-screen.png | P2 | layout | 登入卡片 max-width 約 320px 置中，1280 螢幕兩側超大空白 | `18-login-screen.png` 登入卡片 | 不致命但又是「為什麼像手機版」的感覺 |
| 22 | 01-landing-circles-home.png | P2 | copy | 歡迎卡 CTA「直接自己選題」對新手太大膽 — 還沒看過引導就先選題等於完全跳過教學 | `01-landing-circles-home.png` 頂部歡迎卡片 | 我按了之後完全不知道在做什麼，應該預設 disabled 或 secondary style |

## Console errors observed
- 1 個 `Failed to load resource: 404 (Not Found)`（`audit/console/Desktop-1280.json`）。沒有 stack trace 不知是哪個 asset，但意味著有死連結或舊路徑沒清掉。對使用者影響可能小（也可能是字型或 icon 缺失，這會放大「介面 cheap」的感覺），但 P0 應修復避免衍生樣式 fallback。
- 沒有 pageError，至少沒崩。

## Persona summary (3-5 sentences in U1's voice)

老實講第一螢幕我就快關掉了 — CIRCLES、完整模擬、步驟加練、北極星指標、NSM 一次塞 5 個我沒聽過的詞，根本不知道自己要做什麼。1280 螢幕上 layout 像手機版被硬塞進電腦，右半邊空地大到像 demo 還沒做完，題目卡又擠到品牌名斷行，視覺上完全不像 Notion / Figma 那種現代產品。我邊看 YouTube 邊切回來，每次切回來都要花 3 秒重新搞清楚自己在哪一步，因為 7 步進度條沒文字、步驟欄位的 placeholder 又只是同義反覆。最致命的是底部 sticky bar 直接蓋住表單欄位，加上自動化跑到 step C 就被「請至少填寫 2 個欄位」鎖死、NSM 中段截圖直接 missing — 這代表真正使用者也會卡在這。會回來嗎？老師硬要交作業才會，自己選的話不會。

— U1 (sign-off)
