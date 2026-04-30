# U4 — 文組求職者 (iPad 768×1024, Safari, jargon-shy) audit log

> Persona note: 我中文系畢業，朋友傳連結叫我練 PM 面試。打開來滿滿英文縮寫跟「業務影響」「假設確認」這種詞，第一個反應是想關掉去 Google 翻譯。

## Issues
| # | Step / screen | Severity | Category | Title | Repro | Persona reaction |
|---|---|---|---|---|---|---|
| 1 | 01-landing-circles-home.png | P1 | Jargon / copy | 「CIRCLES」七個字母在首頁完全沒展開 | 首頁寫「CIRCLES 是 PM 面試常用的七步框架」但沒列出 C/I/R/C/L/E/S 各代表什麼字 (見 01-landing-circles-home.png) | 七步是哪七步？我點「開始引導」前完全不知道要做什麼。第一印象就想關掉。 |
| 2 | 01-landing-circles-home.png | P1 | Jargon / copy | 「NSM / 北極星指標」對非 PM 是天書 | 右上角按鈕「北極星指標」、底部卡片「S 步驟含北極星指標練習」「前往 NSM」三個詞混用 (見 01-landing-circles-home.png) | 北極星跟工作有什麼關係？NSM 又是哪三個英文？沒人解釋。 |
| 3 | 01-landing-circles-home.png | P1 | Layout (iPad portrait) | 768 寬左右大量留白、卡片擠在中間 | iPad 直立 768 寬，內容容器看起來像手機版直接放大，左右各約 60-80px 灰色空白 (見 01-landing-circles-home.png) | 看起來像沒做平板版，是手機畫面硬撐開的。 |
| 4 | 01-landing-circles-home.png | P1 | Affordance | 「完整模擬 / 步驟加練」沒解釋差別給新手 | 兩張卡片只有「25-35 分鐘」「5-10 分鐘」差別，沒說新手該選哪個 (見 01-landing-circles-home.png) | 我第一次來，要選哪個？引導文案應該推薦一個。 |
| 5 | 03-circles-step-C.png | P0 | Jargon / 沒展開 letter | C 步驟頁面從不告訴使用者 C 代表什麼英文字 | 標題只寫「C – 澄清情境」、副標「Grab · GrabPay」、進度條「C · 澄清情境 · 1/7」。整頁看不到 C 代表 Comprehend / Clarify 之類的原文 (見 03-circles-step-C.png) | 既然要用英文字母當招牌，為什麼不告訴我 C 是哪個英文單字？ |
| 6 | 03-circles-step-C.png | P1 | Field copy 不清楚 | 「問題範圍 / 時間範圍 / 業務影響 / 假設確認」四個欄位 placeholder 太抽象 | 四個 textarea 的 placeholder 是「說明討論的問題範圍與問題類型...」「設定時間範圍並說明理由...」等抽象語句 (見 03-circles-step-C.png) | 「問題範圍」是要我寫多寬？「業務影響」我哪知道？需要一句白話例子。 |
| 7 | 04-circles-I.png ~ 09-circles-S.png | P0 | Navigation / auto-advance | 連續六張截圖卡在 C 同一畫面，I/R/C/U/T/L/E/S 步驟疑似無法前進 | 04-09 檔名標 I, R, CUT, L, E, S 但畫面與 03 完全相同（依舊「C – 澄清情境」「1/7」「請至少填寫 2 個欄位再送出評分」）(見 04-circles-I.png ~ 09-circles-S.png) | 我送出之後沒反應，也不知道要往哪按。是壞掉了還是我哪裡沒填？iPad 上完全卡住。 |
| 8 | 04-circles-I.png | P1 | Inline error | 紅字錯誤「請至少填寫 2 個欄位再送出評分」沒指哪兩個 | 送出後左下出現紅字，但沒標哪兩欄位是必填、未填欄位也無紅框 (見 04-circles-I.png) | 我以為填一欄就好，原來要兩欄？那為什麼不一開始說？四個欄位裡哪兩個是必填？ |
| 9 | 03-circles-step-C.png | P1 | Jargon | 「送出評分」按鈕語意混亂 | 主 CTA 寫「送出評分」、頂端寫「儲存中 / 已儲存」、進度條 1/7 (見 03-circles-step-C.png, 04-circles-I.png) | 「評分」是誰評誰？我才填一格而已要評什麼分？這詞比「下一步」可怕多了。 |
| 10 | 03-circles-step-C.png | P1 | Tablet hover-only | 燈泡「提示」icon 在平板上不知道能不能點 | 每個欄位右上角有小燈泡 + 「提示」字，看起來像 hover 才會展開的 tooltip。iPad 沒 hover (見 03-circles-step-C.png) | 我點了不知道有沒有反應；按鈕也沒外框，看起來不像可以按。 |
| 11 | 04-circles-I.png | P1 | Tablet keyboard | 編輯器 toolbar (B、清單、縮排) 圖示太小、平板手指難按 | 富文本工具列四個 icon button 約 28×28px，靠在輸入框上方很窄 (見 04-circles-I.png) | iPad 用手指點，常常按錯成旁邊那個。建議至少 44×44。 |
| 12 | 04-circles-I.png | P2 | 自動儲存提示 | 「儲存中 / 已儲存」綠點藏在進度條右側很容易忽略 | 進度條同一行右側出現「● 儲存中…」「● 已儲存」(見 04-circles-I.png, 05-circles-R.png) | 訊息太小聲，我在打字根本看不到，會懷疑沒存到。 |
| 13 | 11-offcanvas-open.png | P1 | Affordance | 左側「練習記錄」抽屜的觸發點不明顯 | 三條線漢堡 icon 點開後出現「練習記錄」側欄，但漢堡 icon 旁邊沒文字提示 (見 11-offcanvas-open.png) | 我以為漢堡是選單，沒想到是「我的紀錄」。應該寫「紀錄」兩個字。 |
| 14 | 12-nsm-tab-not-found.png | P1 | Navigation | 點「北極星指標」後跳回首頁、看不出有切到 NSM 模式 | 12-nsm-tab-not-found.png 與 01-landing-circles-home.png 幾乎一樣，多一張「未完成練習」卡，但沒看到 NSM 專屬入口或 tab 高亮 (見 12-nsm-tab-not-found.png) | 我按「北極星指標」想看 NSM，結果跳回原本同一頁，是壞了嗎？ |
| 15 | 13-nsm-step-1.png ~ 16-nsm-step-4.png | P0 | Jargon / 沒展開 letter | NSM 流程從頭到尾還是顯示「C – 澄清情境」、沒看到 N/S/M 三個字代表什麼 | NSM 模式四個步驟截圖標題仍寫「C – 澄清情境 · 1/7」(見 13-nsm-step-1.png ~ 16-nsm-step-4.png) | 點進「北極星指標」進來看的還是 CIRCLES 的 C？那 NSM 是什麼意思？我已經迷路。 |
| 16 | 15-nsm-step-3.png | P1 | Jargon | 「代理變數」「核心價值的代理變數」對非技術背景太硬 | 範例輸入「訂閱用戶每月活躍觀看時長影片是訂閱制核心價值的代理變數」(見 15-nsm-step-3.png) | 「代理變數」是統計詞嗎？文組不會這樣講話，需要白話翻譯。 |
| 17 | 17-review-examples.png | P1 | Layout (iPad portrait) | 範例頁字體在 iPad 縮得很小、像被壓扁 | 17-review-examples.png 整頁文字很小、卡片擠成窄條，閱讀困難 (見 17-review-examples.png) | 在 iPad 上完全要瞇眼睛看。手機應該不會這樣，是 iPad 寬度沒被處理。 |
| 18 | 18-login-screen.png | P1 | Copy | 登入頁「Email」是英文、其它都中文 | 表單兩個 label 一個「Email」一個「密碼」(見 18-login-screen.png) | 為什麼一個英文一個中文？要嘛兩個都中（電子郵件），要嘛都英。混搭看起來像沒做完。 |
| 19 | 18-login-screen.png | P1 | Auth flow | 沒有「忘記密碼」、沒有「顯示密碼」、沒第三方登入 | 18-login-screen.png 只有 Email、密碼、登入 (見 18-login-screen.png) | iPad 鍵盤打密碼很容易打錯，沒有眼睛 icon 可以看一下；忘記密碼也沒有按鈕。 |
| 20 | 03-circles-step-C.png | P2 | Sticky footer | 底部「返回選題 / 送出評分」sticky 條在 iPad 直立佔很高 | 底部固定條約 76px、占畫面 7%，再加上 Safari 底部工具列空間更擠 (見 03-circles-step-C.png) | 已經要捲很久才看到第四個欄位，底部又被佔掉一塊，畫面真的不夠用。 |

## Console errors observed
- 1 個 404 (Failed to load resource)、無 pageError。雖然數量少但代表有檔案遺失，可能是某張圖或 icon 沒載到。

## Persona summary (3-5 sentences in U4's voice)
我是中文系剛畢業在準備轉 PM 的朋友推給我的，打開第一頁看到「CIRCLES」「NSM」「北極星指標」三個詞同時轟炸，已經想關掉。點進去之後每一頁都用「業務影響」「假設確認」「代理變數」這種我要查 Google 的詞，按鈕還寫「送出評分」——是要我評誰？最慘的是我送出第一步之後 iPad 上好像就卡住了，連續六張都還在 C，我根本不知道 I 跟 R 跟 S 長什麼樣子。如果要做給新手，至少首頁要把七個英文字母翻成白話、每一步進來告訴我這個 letter 是哪個字、所有錯誤訊息要直接指出哪個欄位沒填。
