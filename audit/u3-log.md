# U3 — 轉職者 (Edge, Windows, 4K 2560×1440, careful reader) audit log

> Persona note: 我花了三年做行銷,終於下定決心轉 PM。坐在 4K 螢幕前打開 PM Drill,結果整個版面擠在中間一小條,左右兩邊大片空白能停一台車——我懷疑這個產品根本沒在 1440 以上的螢幕測試過。

## Issues

| # | Step / screen | Severity | Category | Title | Repro | Persona reaction |
|---|---|---|---|---|---|---|
| 1 | 03–10 全部 CIRCLES 步驟頁 (C/I/R/CUT/L/E/S/Summary) | P0 | walkthrough/regression | Playwright 走查在第 1 步就卡死,03–10 共 8 張截圖內容**完全相同**(都停在 C 步、進度條只到 1/7、右側題目脈絡只顯示 Grab GrabFood) | screenshots `03-circles-step-C.png` 與 `04-circles-I.png`、`05-circles-R.png`、`06-circles-CUT.png`、`07-circles-L.png`、`08-circles-E.png`、`09-circles-S.png`、`10-circles-summary.png` 像素級一致(進度條第 1 段 active、`C·澄清情境·1/7·已儲存`、底部紅字 `請至少填寫 2 個欄位再送出評分`) | 「等等,我不是按了下一步嗎?怎麼一連 8 張都長一樣?是 next button 沒接事件、還是 router 沒 push?無論是哪個,這條主流程都過不去。」 |
| 2 | 03 CIRCLES Step C (desktop 2560) | P0 | layout/wide-monitor | C 步驟頁中央輸入欄寬度 ~400px,左右各 1080px 純空白(內容只佔 ~16% viewport) | `03-circles-step-C.png`:`問題範圍 / 時間範圍 / 業務影響 / 假設確認` 四個 textarea 全擠在 x≈730–1130 中央窄條,右側 `題目脈絡` 卡片浮在 x≈1220 也只到 1380,2560px 螢幕剩下 1180px 空白 | 「我有 4K 螢幕,你給我一個比 iPad 還窄的輸入框?四個欄位明明可以兩兩並排,我可以一眼看完所有提示再寫。」 |
| 3 | 12 NSM 選擇情境頁 | P0 | layout/wide-monitor | NSM Step 1 同樣中央窄欄,5 張情境卡單欄垂直堆疊,左右各 ~750px 空白 | `12-nsm-home.png`:`DocuSign / Brex / Duolingo / GitHub / Canva` 五張卡片從 x≈760 到 x≈1230 一條直列,2560px 螢幕用了不到 480px(<19% viewport) | 「CIRCLES home 至少還會三欄,NSM 居然連一個 grid 都沒有,連視覺一致性都沒做。」 |
| 4 | 17 review-examples 頁 | P0 | layout/wide-monitor | 範例庫頁固定為 2 欄極窄卡片清單,2560px 下整個內容寬度只有 ~700px,左右大片空白 | `17-review-examples.png`:每行只有兩張卡片,文字 12–13px 左右,版面像 phone 的 2-up,但下面有 ~1800px 空畫布 | 「資料庫頁是最該利用寬螢幕的地方,這裡卻長得像我手機螢幕的 zoom-out。給我 3–4 欄好嗎?」 |
| 5 | 18 登入頁 | P1 | layout/wide-monitor | 登入卡片 ~270px 寬置中,2560px 螢幕剩 ~2290px 空白,卡片以下 1100px 純灰底 | `18-login-screen.png`:登入卡 x≈870–1130,y≈100–400,下方完全空白直到 viewport 底 | 「卡片這麼小、又貼在頂端,我的眼睛要先掃完一整片空白才看到表單。至少 vertical-center 一下吧。」 |
| 6 | 01 CIRCLES home + 03 step C | P1 | navigation/copy-redundancy | 頂部導航列同時出現左側 tab `北極星指標` 與右側 button `北極星指標`,而且**進入 step C 之後 tab 仍然存在卻沒有 active 狀態指示**(看不出我現在在 CIRCLES 還是 NSM) | `01`:左 `CIRCLES`(active 框)`北極星指標`(無框);右 `北極星指標` `登入`。`03`:進入練習後左 tab 變成 `CIRCLES` `北極星指標` 都無 active 指示 | 「同一個字出現兩次已經夠奇怪,進到 step C 還連 active 都沒了——我按返回的時候會猶豫到底是回首頁還是回題目選擇。」 |
| 7 | 01 CIRCLES home `.ch-grid` | P1 | layout/grid | 主格 `230 / 1fr / 240` 三欄裡中欄被夾成 ~290px,卡片標題 `Netflix — Netflix Streaming` `Shopee — Shopee Live` `LINE — LINE Messaging` 全部換到 2 行,正文每行只能塞 5–6 個字 | `01-landing-circles-home.png`:`產品名 — 品牌名` 一律斷行,卡片內 body 一行 6 字後換行,讀起來像詩 | 「這明明是介紹卡,標題怎麼會比正文還難讀?寬螢幕反而比窄螢幕難看,這個 grid 沒寫 max-width 的回歸測試。」 |
| 8 | 01 CIRCLES home 最後一張卡 | P1 | overlap/UI | `S 步驟含北極星指標練習 想做最完整的 NSM 定義訓練?` 卡片右側的 `前往 N…` 按鈕**重疊**在卡片邊緣,文字被截掉(`前往 NSM 訓練` 只剩 `前往 N`) | `01-landing-circles-home.png` 約 (x≈645, y≈690)`前往 N…` 藍色按鈕往卡片右側突出且 label 被裁 | 「這個 CTA 連完整字都顯示不出來,我以為 N 是 Netflix。」 |
| 9 | 03 step C 進度條 | P1 | a11y/copy | 7 段進度條沒有任何文字標籤(C/I/R/CUT/L/E/S),只有色塊;右下 `C·澄清情境·1/7` 字級 12px 太小 | `03-circles-step-C.png`:進度條 6 段灰 + 1 段藍,沒寫字 | 「我對 CIRCLES 還不熟,光看色塊我哪知道下一步是 I 還是 R?滑鼠 hover 也沒 tooltip 提示。」 |
| 10 | 03 step C 4 個欄位 placeholder vs 03→05 紅字 | P1 | copy/inconsistency | placeholder 寫 `說明...` `設定時間範圍並說明理由...`,但驗證錯誤改稱「**欄位**」(`請至少填寫 2 個欄位再送出評分`)——前後用語不統一 | `03` placeholder vs `05-circles-R.png` 底部紅字 | 「文案到底叫『說明』還是『欄位』?我只是隨手填一格,系統卻說我『欄位』不夠——然後 submit 按鈕又叫『送出評分』而不是『下一步』,我這是要送出整題還是只是這一步?」 |
| 11 | 03 step C 「送出評分」CTA | P1 | copy/flow | step 1/7 的主按鈕叫 `送出評分`,但根據 `1/7` 我顯然還有 6 步要寫;這個按鈕應該是 `下一步` 或 `送出 C` | `03-circles-step-C.png` 底部按鈕 `送出評分` | 「我才寫完第 1 步,你叫我送出評分?我會猶豫不敢按,以為按下去就直接給我打分數結束了。」 |
| 12 | 03 step C 提示 `提示` 連結重複 4 次 | P2 | copy/redundancy | 4 個欄位每個都掛一個藍字 `💡 提示`,但點擊後是不是 4 個不同提示?還是同一個?畫面沒有區別 | `03-circles-step-C.png`:`提示` 文字 4 次,均同樣樣式 | 「同一個字出現 4 次我會懷疑這是 placeholder bug。」 |
| 13 | 11 offcanvas 開啟 | P1 | layout/dimming | 左側練習記錄 offcanvas 寬 320px,右側主畫面變半透明灰且**不可點擊**,但題目卡仍然清晰可讀,讓我以為還能點 | `11-offcanvas-open.png`:右側 `Netflix Kids / LINE Pay / Shopee 商城 / LINE Messaging / GrabFood / S 步驟` 卡都還顯示且文字未模糊,只是疊了一層 ~50% 灰 | 「dim 這麼淺等於沒 dim,我會試圖點右邊。要嘛 backdrop 加深、要嘛主畫面 inert 屬性。」 |
| 14 | 12 NSM 步驟標 `1 / 2 / 3 / 4` | P1 | copy/missing-label | NSM Step 1 上方 4 個圓圈步驟指示器**完全沒有 label**(只有數字),不像 CIRCLES 至少有色塊 | `12-nsm-home.png`:四個圓圈標 1 2 3 4 並排,沒有 `情境/指標/拆解/總結` 等文字 | 「我點進來只看到 1234,完全不知道每一步要做什麼。CIRCLES 至少有 7 段顏色,NSM 連顏色都沒有。」 |
| 15 | 17 review-examples top bar | P1 | navigation/orphan | review-examples 頁**完全沒有頂部 nav**(沒有 PM Drill logo、CIRCLES tab、北極星指標 tab、登入按鈕),只有一行小字標題 + 篩選器 | `17-review-examples.png` 頂部:單行 `← CIRCLES 範例庫`,跟其他頁的雙列 nav 完全不同 | 「同一個 app 的不同頁面竟然有不同的導航——我點進範例,要回首頁要按瀏覽器返回鍵?這違反所有 SPA 慣例。」 |
| 16 | 18 login 頁 vs 01 home `登入` button | P1 | copy/state-cue | home 右上角寫 `登入`,點進去後 URL 變了,但 `登入` 按鈕**仍然存在於右上角**,沒有變成 `← 返回`;同時表單內又有「← 返回首頁」連結 | `01` 與 `18` 對比:右上 `登入` button 無變化 | 「我已經在登入頁了,你還告訴我去登入?CTA 應該變成『建立帳號』或被 hide。」 |
| 17 | 01 home 練習模式卡 | P2 | copy/spec-mismatch | `練習模式` 區寫 `完整模擬 25–35 分鐘 全 7 步` 與 `步驟加練 5–10 分鐘 單一步驟`——但 spec 提到 7-agent audit 走查只跑了 step 1,代表「全 7 步」實際無法導通(見 #1) | `01` 卡片文字 + #1 證據 | 「文案宣稱 7 步,Playwright 卻過不了第 1 步——產品宣稱與實際嚴重不符。」 |
| 18 | 全站 desktop ≥1440 | P0 | regression | Issue #0 的 `max-width:1180px` 病灶**蔓延到所有 route**(home / step-C / NSM Step1 / review-examples / login),不是 home 單獨問題,而是全站缺少 desktop layer | 證據合計 #2、#3、#4、#5 | 「這不是單頁 bug,這是一個 desktop breakpoint 從未存在過。整個 app 是 mobile-first,然後 1280–2560 全部用同一份 CSS 硬撐。」 |

## Console errors observed

- `Failed to load resource: the server responded with a status of 404 (Not Found)` @ 1777508987419 — 來源未指明 URL,但首頁初始載入就出 1 個 404,可能是某張圖、icon 或 manifest;在 4K 高解析設備上空 404 也會造成 perf 觀感差。

## Persona summary (3–5 sentences in U3's voice)

我是 U3,30 歲行銷轉 PM。坐在 2560×1440 的 4K 螢幕前打開 PM Drill,第一個反應是「這是手機網頁誤開到桌機嗎?」——CIRCLES 首頁、CIRCLES step、NSM step、範例庫、登入頁,**每一個 route 中央都只有一條 ~400–700px 的窄欄**,左右兩側合計 1500px 以上的純空白,版面浪費到我懷疑開發者根本沒在 ≥1440 螢幕上看過自己的產品。

更糟的是,Playwright 走查在 step C 就**徹底卡住**,03–10 共 8 張截圖完全相同——這代表「下一步 / 送出評分」沒有真的推進 router,主流程斷掉。即使能推進,我看到 `送出評分` 出現在 step 1/7 也會不敢按,因為文案叫我「送出」、不是「下一步」;進度條沒有文字 label、`提示` 連結重複 4 次、`登入` 按鈕在登入頁仍叫登入——這些都是 careful reader 一眼就會挑出的不一致。

最後,review-examples 頁直接**長得不像同一個 app**(沒有頂部 nav),NSM 的 4 步圓圈完全沒 label,top bar 上 `北極星指標` 出現兩次——這是一個 information architecture 還沒收斂的產品。建議:(1) 緊急修 step navigation regression;(2) 加 `@media (min-width:1440px)` 真正的 desktop layer,讓 grid 撐到至少 1600–2000px;(3) 統一 CTA 文案規則:中間步驟一律 `下一步`、最後一步才 `送出評分`;(4) review-examples 與 login 頁套用全站 nav。
