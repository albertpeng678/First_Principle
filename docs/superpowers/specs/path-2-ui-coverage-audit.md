# Path 2 UI 覆蓋率盤點（全盤掃描）

**Date:** 2026-05-02
**Trigger:** Frontend rewrite design system mockup 完成第一版後，user 抓到 (1) drill 模式只 C1/I/R、(2) 範例答案 bullet 縮排格式 兩個漏掉的規格 → 要求徹底掃描以避免持續被動補洞
**Source:** Explore agent 全盤掃 15 份 design docs + style.css 4892 行 + app.js 7159 行 + index.html

---

## 結論：**122 個 UI 項目 / 47% 覆蓋率**

| 狀態 | 數量 |
|---|---|
| ✅ Fully Covered | 29 |
| ⚠ Partial | 43 |
| ❌ Missing | 50 |
| **TOTAL** | **122** |

---

## 覆蓋率分類詳表

| Category | Items | Covered | Partial | Missing | % |
|---|---|---|---|---|---|
| A. 範例答案 bullet 格式 | 4 | 0 | 2 | 2 | 50% |
| B. Phase 2 三角色 bubble | 8 | 4 | 3 | 1 | 63% |
| C. Onboarding / Coachmark | 7 | 3 | 2 | 2 | 57% |
| D. Persistent qchip | 6 | 1 | 3 | 2 | 33% |
| E. Save indicator state matrix | 5 | 1 | 2 | 2 | 40% |
| F. Stats strip（CIRCLES home）| 4 | 1 | 2 | 1 | 50% |
| G. Recent sessions rail | 4 | 1 | 2 | 1 | 50% |
| H. Search input | 4 | 0 | 1 | 3 | 25% |
| I. NSM-specific UI | 8 | 2 | 4 | 2 | 50% |
| J. Score reveal / Phase 3 | 8 | 1 | 3 | 4 | 38% |
| K. Phase 4 final report | 5 | 1 | 2 | 2 | 40% |
| L. Char counter / textarea length | 3 | 0 | 0 | 3 | 0% |
| M. Toast / snackbar | 3 | 0 | 1 | 2 | 17% |
| N. iOS 鍵盤 sticky 行為 | 5 | 4 | 1 | 0 | 100% |
| O. Resume session（offcanvas click）| 4 | 2 | 1 | 1 | 75% |
| P. 5-random reshuffle button | 4 | 0 | 2 | 2 | 25% |
| Q. Migration flow（guest→authed）| 3 | 0 | 1 | 2 | 17% |
| R. Auth form variants | 4 | 0 | 2 | 2 | 25% |
| S. Empty / loading / error states | 6 | 1 | 2 | 3 | 50% |
| T. Overflow / long-content 處理 | 5 | 0 | 0 | 5 | 0% |
| U. 其他細節（phase head / mode-tag / radar / grade letter etc）| 14 | 2 | 6 | 6 | 43% |

---

## 重點 50 個 Missing 項目

### 🔴 Foundation 缺漏（必須補進 design system mockup — 因為跨多畫面共用）

1. **範例答案 bullet 縮排 rendering**（A — user 親自抓到）
   - Parser：`- xxx\n  - yyy` → `<ul class="example-list"><li>...<ul class="example-sub"><li>...</li></ul></li></ul>`
   - CSS：disc / circle marker / 18px padding / 13px font / 1.7 line-height / strong color #1A56DB
   - Spec：`docs/superpowers/specs/2026-04-28-circles-examples-bullet-format-design.md`

2. **Save indicator 4 狀態矩陣**（E）
   - idle / saving（spinner）/ saved（ph-check）/ error（紅 + retry click）
   - 「離線中 · 已存於本機，點擊重試」訊息 hardcoded（app.js:594, 639）
   - CSS class：`.save-indicator.save-{idle,saving,saved,error}`

3. **Toast / Snackbar 系統**（M）
   - 目前 production 沒有 floating toast，只有 inline `.save-indicator`
   - Path 2 應引入：底部 toast slide-up 300ms / 自動 dismiss 4s / 右上角桌面版
   - 4 種 severity：info / success / warning / error

4. **Overflow / long-content 處理矩陣**（T — 0% 覆蓋）
   - 公司名 truncate `text-overflow: ellipsis; white-space: nowrap;`
   - 題目陳述 wrap `word-break: break-word; overflow-wrap: anywhere;`
   - 中文 + 英文混排換行
   - Chat bubble max-width 規則
   - 例：`Spotify Podcast 3rd-party Integration` 換行行為

5. **Char counter / textarea length 反饋**（L — 0% 覆蓋）
   - 是否有字數計算？production 目前無
   - 紅色警告 threshold（建議 50-120 字、超過警告）
   - 動態色彩：剩餘 < 20% 變橘、超過變紅

6. **Phase head / breadcrumb 元件**（U.phase head）
   - "Phase 1 · 澄清情境" 文字 + step pill 整合 header
   - Phase 1 / 1.5 / 2 / 3 / 4 都用

7. **Mode-tag pill（drill vs simulation 區分）**（U.mode-tag）
   - 出現在 home / qchip / history / recent sessions
   - drill：`badge--drill` 暗色
   - simulation：標準 `badge--circles` 綠色

8. **Onboarding coachmark / spotlight cutout**（C）
   - `.onboarding-tooltip` + `box-shadow` cutout（style.css:3957）
   - 4 個方向 arrow（top / right / bottom / left）
   - mobile 改 bottom-pin（style.css:4023）
   - 多步進度（current / total）

### 🟡 Screen-specific 缺漏（在對應 per-screen mockup 補）

9. **Phase 2 三角色 bubble 視覺差異**（B）
   - 被訪談者 / 教練點評 / 教練提示 三角色用不同色 / icon / border 區分
   - production 目前沒有強差異 — 重寫時可加（user 偏好決定）

10. **qchip 展開分析 4 欄區塊**（D — 商業背景 / 用戶輪廓 / 常見誤區 / 破題切入）
    - mobile 上下堆疊
    - desktop 92px label + 1fr value grid

11. **NSM Step 1 卡片 4 欄分析**（I）
    - 同 qchip 但 NSM 題目專屬
    - 4 欄：商業模式 / 使用者 / 常見陷阱 / 破題切入
    - SP4 spec: `2026-05-02-sp4-nsm-upgrade-design.md` § A+B

12. **NSM Step 2 動態維度 label**（I）
    - reach/depth/frequency/impact 隨題目類型切換 label：
      - supply-demand：供給廣度 / 需求深度 / 匹配效率 / 復購留存
      - creator/content：創造廣度 / 成果品質 / 採用廣度 / 商業轉化
      - B2B SaaS：啟用廣度 / 席次深度 / 黏著頻率 / 擴張信號

13. **NSM Step 4 — 4 個 tab 設計**（I — 從 SP4 spec）
    - 總覽 / 對比 / 亮點 / 完成 — 各 tab × 3 viewport = 12 個 mockup 區塊
    - 完成 tab 取代現有「只有再練一次按鈕」空白頁

14. **Phase 3 評分頁**（J — blocked，等 SP3 backend merge）
    - 維度 collapsible（分數 ≤ 2 自動展開）
    - 教練示範 collapsible 三段：context / perField bullet list / reasoning quote-block
    - Loading checklist（解析框架 → 計算分數 → 生成示範 → 整理建議）4 步進度
    - 4 個 error code 對應視覺（EVAL_TIMEOUT / EVAL_API_ERROR / EVAL_PARSE_ERROR / EVAL_AUTH_ERROR）

15. **Phase 4 final report**（K）
    - 7-step radar SVG
    - Overview tab + Review tab
    - Tracking 4 維度 cards（reach/depth/frequency/impact 各左 border 色）
    - 重練 / 匯出 PNG / 回首頁 按鈕

16. **Stats strip 3-stat（home）**（F）
    - completed / active / weeklyCompleted
    - 3 viewport layout

17. **Recent sessions rail（home desktop right）**（G）
    - card structure
    - resume click

18. **Search input + empty state**（H）
    - 200ms debounce
    - 「找不到符合的題目」placeholder
    - empty state 視覺

19. **5-random reshuffle button + animation**（P）
    - `ph-shuffle` icon
    - 卡片 swap / slide animation（reshuffle 時）

20. **Auth form 視覺**（R）
    - login / register 欄位 + 錯誤訊息
    - field-level error 樣式

21. **Migration flow UI**（Q）
    - guest → authed 後 session merge 提示
    - 成功 toast / banner

22. **Resume session loading state**（O）
    - offcanvas click 後到 phase 載入完成的中間 spinner

23. **Drill rail（desktop home）**（U.drill rail）
    - SP2 spec: 左 rail 顯示 C/I/R 三按鈕 + lock note
    - 已部分覆蓋於 §6（chip 區），但 desktop rail 整體 layout 沒畫

24. **Gate result 3 狀態（error / warn / ok）視覺**（U.gate states）
    - Phase 1.5 + NSM Step 3 共用

25. **Tracking dimension cards（4 色 left border）**（U.tracking）
    - reach blue / depth purple / frequency green / impact orange
    - placeholder for unfilled

26. **Radar SVG styling**（U.radar）
    - polygon fill / stroke / 軸標籤文字
    - 5 軸（practice / NSM）vs 7 軸（CIRCLES final）
    - 動畫進場（polygon scale-in？）

27. **Grade letter 動畫**（U.grade letter）
    - Instrument Serif italic A/B/C/D
    - scale-in / fade-in？尚未定

---

## 修正 Master Spec § 5 建議

原本 11 + 3 + 2 = 16 張 mockup 太精簡。建議調整為：

### 批次 0 — Foundation（design system，已有 + 補 8 sections）
- `00-design-system.html` — 13 個 sections + 補 §14-§21 共 21 sections

### 批次 A — 不依賴 SP3 backend，11 張
1. CIRCLES Home（含 stats strip / recent rail / search / type tabs / q-card list）
2. Drill Home（左 rail C/I/R + lock note）
3. Phase 1 表單（qchip + form fields + hint icons + save indicator + sticky bar + char counter）
4. Phase 1.5 Gate（3 狀態：error / warn / ok）
5. Phase 2 對話（三角色 bubble × streaming/done/error 狀態）
6. NSM Step 1（4 欄分析 context block）
7. NSM Step 2（4-dim form + 動態 label per type）
8. NSM Step 3 Gate
9. Offcanvas History
10. Onboarding 多步 spotlight
11. Login / Register（auth forms + 錯誤）

### 批次 B — 等 SP3 backend merge 後，3 張
12. Phase 3 步驟分數（grade letter + 維度 collapsible + coach demo 三段）
13. Phase 3 error / loading（4 error code 視覺 + loading checklist）
14. Phase 4 final report（overview / review tabs + tracking cards + 7-axis radar）

### 批次 C — 收尾，2 張
15. NSM Step 4（4 tabs × 3 viewport = 12 個區塊）
16. Migration flow + Empty/Error 全集

---

## Design System §14-§21 待補 sections 清單

| § | 名稱 | 三裝置覆蓋規則 | Spec source |
|---|---|---|---|
| 14 | Example bullet rendering | top-level + sub indent / strong / 3 line-length scenarios | 2026-04-28 bullet-format spec |
| 15 | Save indicator state matrix | idle / saving / saved / error 4 態 + click retry | master-spec §2.9 |
| 16 | Toast / snackbar | info / success / warn / error × 桌面右上 / mobile 底部 | 新規（production 目前無）|
| 17 | Overflow / long-content matrix | 公司名 truncate / 題目 wrap / 中英混排 / chat bubble max-width | 新規 |
| 18 | Char counter | 計數 / 警告 threshold / 超字符數 | 新規 |
| 19 | Phase head / breadcrumb | "Phase 1 · 澄清情境" 整合 header pattern | master-spec §2.2 |
| 20 | Mode-tag pill | drill vs simulation 視覺區分 | SP2 spec |
| 21 | Onboarding coachmark / spotlight | spotlight cutout + 4-direction arrow + mobile bottom-pin + step indicator | style.css:3957+ |
