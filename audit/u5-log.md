# U5 — 休學青年 (iPhone-SE 375×667 ≈ low-end Android, impatient) audit log

> 幹我只是上廁所滑一下，怎麼一打開就一堆字一堆框框，誰要寫四段啊？

## Issues

| # | Step / screen | Severity | Category | Title | Repro | Persona reaction |
|---|---|---|---|---|---|---|
| 1 | CIRCLES 步驟 C 表單 | P0 | Layout / overlap | Sticky header 整條疊在表單欄位上面 | `03-circles-step-C.png` 中段，「PM Drill / 北極星指標 / 登入」那條 header 直接蓋住「時間範圍」label 和輸入框上半截 | 「靠這是壞掉吧？字疊在一起我看不到要填啥，閃人。」 |
| 2 | CIRCLES 步驟 C → I/R/CUT/L/E/S/Summary | P0 | Flow blocker | 走完整個流程都卡在 step 1，下一步沒反應 | `03`→`04`→`05`→`06`→`07`→`08`→`09`→`10` 8 張截圖 progress 全是 1/7「C · 澄清情境」沒前進過 | 「我按送出評分按了 N 次，畫面都不變，這 app 是不是死了？」 |
| 3 | 步驟 C 驗證錯誤 toast | P0 | Modal trap | 「請至少填寫 2 個欄位再送出評分」浮窗卡在畫面中間，蓋住表單而且不會自動關 | `04-circles-I.png` 中央那條米色 toast 跟「返回選題 / 送出評分」按鈕黏在一起，後續每張都還在 | 「這提示不會消欸？？我滑也滑不掉，上面下面都被擋住，我哪知道要填啥。」 |
| 4 | CIRCLES home 題目卡 | P1 | Copy wall | 每張題目卡都是兩行說明 + 標題，5 張連在一起就是一面牆 | `01-landing-circles-home.png` 從 Spotify Wrapped 到 Shopee Shopping App 五題說明每題都 2 行 | 「我才看一行就累，下面還四題？我點隨機選題就好，不想讀。」 |
| 5 | CIRCLES home 「什麼是 CIRCLES 實戰訓練？」 | P1 | Hidden content | 第一螢只看到標題和 chevron，不知道點下去會發生啥 | `01-landing-circles-home.png` 該 row 在歡迎卡下方，沒任何預覽 | 「點了會展開還是會跳走？我不想被導去新頁面，跳過。」 |
| 6 | CIRCLES home 開始引導 / 直接自己選題 | P1 | Decision paralysis | 兩顆 CTA 並排，下面又有「完整模擬 / 步驟加練」兩張卡，再下面又有三個分類 chip — 一上來就要我做 4 個決定 | `01-landing-circles-home.png` 上半部 | 「啊到底要我點哪一個？算了我直接拉到下面看題目。」 |
| 7 | CIRCLES 表單欄位「查看範例」 | P1 | Hidden help | `> 查看範例` 是個小箭頭文字，不像可以按 | `03-circles-step-C.png` 每個欄位上方都有 `> 查看範例`，灰灰一行，沒框 | 「範例藏起來幹嘛，你直接放給我看不行？我才不會去點。」 |
| 8 | CIRCLES 表單 placeholder | P1 | No quick-fill | 4 個欄位都是「說明…」、「設定…」、「列出…」這種開放題，沒模板沒下拉 | `03-circles-step-C.png` 四個 textarea | 「四個都要我自己想？我休學欸我不會寫，給我選項打勾啊。」 |
| 9 | 「提示」按鈕 | P1 | Tap target | 右上小燈泡 icon + 「提示」文字看起來不到 32px 高 | `03-circles-step-C.png` 每個 section 右側 | 「這字小到我手指按下去都點到旁邊的輸入框。」 |
| 10 | 進度條 1/7 | P1 | Demoralizing | 第一螢就告訴我有 7 步，每步都要寫一堆 | `03-circles-step-C.png` 上方 1/7 進度 | 「七步？？我以為兩三步就完事了，掰。」 |
| 11 | 練習記錄 off-canvas | P1 | Empty state | 打開 hamburger 看到三個 skeleton 灰塊就停在那，沒「你還沒開始練習」之類的話 | `11-offcanvas-open.png` 左側 panel | 「載入中？還是壞了？我等 3 秒沒變化就關掉。」 |
| 12 | 北極星指標頁（NSM tab not found 那張） | P1 | Routing weird | 點「北極星指標」沒跳新頁，回到首頁變成多一個「未完成練習 · Spotify Wrapped」黃條 | `12-nsm-tab-not-found.png` 最上方那條 + 下面「繼續上次練習」 | 「我點北極星指標啊，怎麼回到首頁，是當機了還是？」 |
| 13 | NSM step 1 表單（同 issue 1） | P0 | Layout / overlap | 跟 CIRCLES 一樣，sticky header 蓋住「時間範圍」section | `13-nsm-step-1.png` 中段疊圖 | 「又來？整個 app 都是這個 bug 喔？」 |
| 14 | NSM step 2 sticky bar | P0 | Layout / overlap | 「返回選題 / 送出評分」sticky bottom bar 飄在頁面中間，把「業務影響」section 蓋掉 | `14-nsm-step-2.png` 中段 | 「按鈕怎麼浮在中間，下面還有東西我看不到，超亂。」 |
| 15 | Rich text toolbar (B / list / quote) | P1 | Useless on mobile | textarea 上方塞 4 個格式化 icon，375px 寬已經很擠還佔空間 | `14-nsm-step-2.png` 第一個輸入框上方 toolbar | 「我手機打字誰用粗體啊，浪費空間。」 |
| 16 | review-examples 頁面 | P0 | Horizontal-equiv / 無限長 | 整頁高度 12792px（系統提示），一頁有幾十題範例堆在一起，沒搜尋沒分頁 | `17-review-examples.png` 元數據 375×12792 | 「我滑到大姆指抽筋還沒到底，誰會看完？直接回。」 |
| 17 | review-examples 卡片密度 | P1 | Tap targets | 每張範例卡擠在一起、字小、之間沒間距，按錯機率高 | `17-review-examples.png` 整片密集排版 | 「全部黏在一起，我點哪張都不知道有沒有點到。」 |
| 18 | 登入頁 | P2 | Friction | 沒 Google / Apple 一鍵登入，要打 email + 密碼 | `18-login-screen.png` 只有 email/密碼/登入/註冊 | 「打 email 打密碼？算了我不登入。」 |
| 19 | header 三個按鈕同寬 | P2 | Tap target | 「北極星指標」「登入」按鈕看起來高度不到 36px | `01-landing-circles-home.png` 頂部 | 「icon 跟登入擠成一團，手指粗一點根本按不準。」 |
| 20 | 載入沒 spinner | P1 | No feedback | 切到 step C 表單時沒看到 loading 指示，也沒看到題目載入動畫；「儲存中…」字超小 | `04-circles-I.png` 右上「儲存中…」灰字 | 「儲存中？我以為當機，按了好幾下送出。」 |

## Console errors observed

- `iPhone-SE.json`: 1 條 404 — `Failed to load resource: the server responded with a status of 404 (Not Found)`（timestamp 1777508678285）。沒 page error。
  - 對 U5 而言這就是「某個東西沒載到」，可能就是步驟 C 卡住的原因之一。

## Persona summary

幹這 app 字也太多了吧？我打開首頁就看到一面牆的題目卡，五題每題都兩行字我頭已經痛了。然後我點開 CIRCLES，表單一打開那個藍色 header 直接蓋在輸入框上面，我以為是壞掉，按送出又跳一個米色提示卡死在中間關不掉，我按 N 次「送出評分」進度都還停在 1/7，靠 7 步是要我寫到死喔。北極星指標那邊更扯，按鈕浮在頁面中間擋住下面內容，範例頁滑下去是無底洞。我才花 3 分鐘就想關 app 去買菸，這誰設計的啦。
