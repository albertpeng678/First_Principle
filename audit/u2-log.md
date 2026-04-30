# U2 — 應屆畢業生 (iPhone 15 Pro 430×932, Safari, single-thumb commute) audit log

> Persona note: 捷運上一手拿咖啡一手滑，看到字小、按鈕在頂端、走一半卡住就直接關 App。

## Issues

| # | Step / screen | Severity | Category | Title | Repro | Persona reaction |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | All screens / top nav | P1 | tap-target / reachability | 頂端三顆按鈕（漢堡、北極星指標、登入）全在 top 60px，單手拇指根本碰不到 | `01-landing-circles-home.png`, `12-nsm-tap-not-found.png`, `18-login-screen.png` — header bar 固定在最上面 | 「我手要爬到最上面才按得到登入？站著搖晃中超危險」 |
| 2 | Top nav | P1 | duplication / IA | `北極星指標` 跟 `登入` 在頂端，但底下又有「前往 NSM →」卡片，導航重複又遠 | `01-landing-circles-home.png` 頂端 vs. 底部 NSM CTA | 「兩個入口我到底要按哪個？」 |
| 3 | Step C (03–10 都卡在 C) | P0 | flow blocker | 走完整模擬點「送出評分」後沒有真正前進到 I/R/C/U/T/L/E/S，截圖 03 到 10 全部都是 C 步驟，walkthrough 卡死 | `03-circles-step-C.png` … `10-circles-summary.png` 全是 `C - 澄清情境 · 1/7` | 「我已經填了還按了送出，怎麼還在第一步？以為當機就關了」 |
| 4 | Step C 表單 | P0 | sticky bar collision | 底部 sticky 的「返回選題 / 送出評分」中間夾警告 `請至少填寫 2 個欄位再送出評分`，文字被兩顆按鈕擠成兩行，且整條會擋到「假設確認」textarea | `04-circles-I.png`, `05-circles-R.png`, `15-nsm-step-3.png` — 紅字夾在兩顆按鈕中間 | 「字小到看不清楚，又怕誤觸送出」 |
| 5 | Step C textarea 工具列 | P1 | tap-target | 文字框上方 B / 清單 / 縮排四個 icon 看起來都 <44px，且貼在 input 左上邊緣 | `04-circles-I.png`, `15-nsm-step-3.png` 工具列 icon | 「捷運晃一下就點到 B 變粗體，我又不是要排版」 |
| 6 | Step C — 「提示」與「查看範例」 | P1 | tap-target | 每個欄位右上角的 `提示`（燈泡 icon + 文字）跟左邊的 `> 查看範例` 都是小字小 icon，密集排在同一列 | `03-circles-step-C.png` 每個欄位右上 | 「燈泡那麼小，我點下去誤開到別的東西」 |
| 7 | Step C 進度條 | P2 | legibility | 7 步驟的橫條進度只顯示一條藍 + 一條深灰，沒有文字標示哪一步是哪個字母（要看右邊小字 `C · 澄清情境 · 1/7`） | `03-circles-step-C.png` 進度條 | 「我以為走到第三步了，結果只是兩個 segment 顏色不同」 |
| 8 | Resume card (12) | P1 | tap-target | 「未完成練習」卡上「繼續 →」旁邊的關閉 `×` 看起來明顯 <30px，誤觸關閉很容易 | `12-nsm-tap-not-found.png` 關閉 × 在 `繼續→` 下面 | 「想點繼續結果手滑點到叉叉，整張卡消失」 |
| 9 | NSM 入口尋找 | P1 | IA / discoverability | 想去 NSM 練習，頂端的 `北極星指標` tab 在最上方按不到，最後得整頁滾到底點 `前往 NSM →` 卡片 | `01-landing-circles-home.png` 頂端 vs. 底部 NSM 卡片；檔名 `12-nsm-tab-not-found.png` 也在暗示 | 「我為什麼要捲一整頁才找得到入口？」 |
| 10 | Offcanvas 練習記錄 (11) | P1 | sheet / a11y | 漢堡選單拉出 sheet 寬度不到一半，右邊大片半透明遮罩，但 sheet 本身內容是三條 skeleton（疑似還在 loading），看不出狀態與結束關閉手勢 | `11-offcanvas-open.png` | 「打開 sheet 一片空白還以為當掉，沒有 loading 文字」 |
| 11 | NSM step 1 (13) | P1 | reused header | NSM 第一步畫面 header 居然顯示 `C - 澄清情境 · Grab · GrabFood`、進度條 1/7，跟 CIRCLES 完全一樣，看不出我是在 NSM | `13-nsm-step-1.png` header | 「咦我不是要做 NSM？怎麼又是 C？」 |
| 12 | review-examples (17) | P0 | legibility / horizontal scroll | 範例頁是一片密密麻麻文字、字級極小、沒有搜尋/分類/篩選，捷運上完全讀不下去；版面有壓縮成 narrow column 的痕跡 | `17-review-examples.png` 整頁 | 「字比螞蟻還小，我絕對直接返回」 |
| 13 | Login (18) | P2 | input UX | Email / 密碼欄沒有看到 `inputmode=email` 或 show-password toggle 的痕跡，登入鍵盤體驗一般 | `18-login-screen.png` Email + 密碼欄 | 「打 email 不會自動變 @ 鍵盤就煩」 |
| 14 | All Step C 截圖 | P1 | virtual keyboard | 文字框聚焦時（05–09 看到藍框 + 工具列），sticky 底部 bar 仍然在最下面，預期會被 iOS 軟鍵盤蓋住，看不到「送出評分」 | `05-circles-R.png` 聚焦狀態 | 「鍵盤跳出來我就找不到送出鈕了」 |
| 15 | Home 練習模式選擇 (01) | P2 | tap-target | `產品設計 ×40 / 產品改進 ×35 / 產品策略 ×25` 三顆 chip 高度看起來只有 32–36px，邊距小 | `01-landing-circles-home.png` chip row | 「拇指晃一下就點錯類別」 |
| 16 | Home 隨機選題 (01) | P2 | feedback | 點「隨機選題」沒有視覺回饋（loading、shuffle 動畫），不確定是否真的洗過 | `01-landing-circles-home.png` `隨機選題` 按鈕 | 「按了沒反應就會懷疑壞掉再按一次」 |
| 17 | Console | P0 | console error | `Failed to load resource: the server responded with a status of 404 (Not Found)` 一筆 | `audit/console/iPhone-15-Pro.json` | 「網頁有 404 通常我就不信任了」 |

## Console errors observed

- `Failed to load resource: the server responded with a status of 404 (Not Found)` × 1 (`audit/console/iPhone-15-Pro.json` @ 1777508678325) — 來源未標註，疑似 favicon 或某張靜態資源。

## Persona summary

整體第一印象就是「這 App 是給桌機做的硬塞到手機」。所有主要操作（漢堡、登入、北極星指標）擠在頂端，我單手在捷運根本碰不到，得整支手往上爬。最讓我想關掉的是 walkthrough 從 03 到 10 全卡在同一個 C 步驟——點了「送出評分」之後沒前進，紅字警告又卡在底部兩顆按鈕中間，文字小、誤觸機率高。範例頁（17）是一片螞蟻字海，捷運晃動下根本不可能讀完。再加上一個 console 404，整體信任感直接打折。如果要我給三件事優先修：(1) 修 walkthrough 卡 C 不前進的 bug，(2) 把頂端三個 tab 移到底部 tab bar，(3) 範例頁加搜尋與字級放大。
