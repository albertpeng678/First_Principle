# SP1 — 視覺基礎清理（貼齊兩側 / 字型 / radius / error UI）

**Date:** 2026-05-02
**Mockup（必看，照做不偏離）：** `docs/superpowers/specs/mockups/2026-05-02-pm-drill-overhaul/sp1-visual-baseline.html`

> **實作 AI 注意：** 本 spec 的所有視覺決策都已在 mockup 中定案。實作時必須先打開上述 mockup HTML 檔案，逐一比對 padding / radius / 字型 / error UI 的呈現，**完全照做**。任何偏離 mockup 的決定都需要先回頭跟使用者確認。

## 鎖定決策

1. **Page outer wrapper：0 horizontal padding** — 所有頁面區塊（navbar / header / progress / chip / form / submit-bar）寬度 = viewport 寬度，貼齊兩側
2. **Block 內部 padding：** mobile `14px` / tablet `18px` / desktop `22px`（左右）
3. **Border-radius：**
   - input / button / 內部小卡：`8px`（var: `--r-input`）
   - pill / step circle / tag：`999px`（var: `--r-pill`）
   - 外層 block：**不需要** border-radius（觸到 viewport 邊緣，視覺看不到）
4. **字型：** 全站 `var(--c-font-sans)` system-ui stack。**完全清除** Instrument Serif / serif / Georgia / Times — 含 grade letter、score 數字、login h2、welcome card title、NSM total score
5. **錯誤狀態：** 僅在錯誤欄位加 `border: 1.5px solid var(--c-danger); background: rgba(239,68,68,.03);` — 移除底部「需要修正以下問題」紅字提示條

### 例外（保留 radius + margin）
modal / offcanvas / login-card / welcome-card / qchip-panel / 任何 `position: absolute|fixed` overlay — 屬「飄起來的卡片」，保留 12px radius + 與 viewport 的 margin。

## 影響檔案

| 檔案 | 動作 |
|---|---|
| `public/style.css` | 大量 sweep — 加 token vars、刪所有 `Instrument Serif` rule、把所有 page-wrapper 的 padding 改 0、block horizontal padding 改 var |
| `public/app.js` | 找 gate-result 內 error message bar 相關 render code 刪除（搜尋「需要修正」/ `error-bar` / `gate-error-message`） |

預估：style.css 動 ~80 處 / app.js 刪 ~20 行。

## 驗收 grep（皆需回 0）

```bash
# 任何 Serif
grep -rE "font-family.*(Serif|serif|Georgia|Times)" public/

# 錯誤訊息條
grep -rn "需要修正\|gate-error-message\|error-bar" public/
```

## RWD 驗收（per `feedback_test_all_devices_visual.md`）

8 個 Playwright project 全跑現有 spec + 截圖親看：
- Mobile-360, iPhone-SE, iPhone-14, iPhone-15-Pro, iPad, Desktop-1280, Desktop-1440, Desktop-2560

新加 spec：`tests/playwright/journeys/sp1-edge-alignment.spec.js`
- 驗 `.circles-home-wrap` / `.phase1-wrap` / `.nsm-view` 等 outer wrapper computed `padding-left/right` === `'0px'`
- 驗任意 navbar / header / progress / chip 的 `getBoundingClientRect().left === 0`
- 驗任意 element computed `font-family` 不含 `Serif`
- 驗 error 欄位 border-color 接近 `rgb(239, 68, 68)`，且 DOM 不存在 `.error-bar` / `.gate-error-message`

## 後續

下一步：用 superpowers writing-plans 寫 implementation plan。
