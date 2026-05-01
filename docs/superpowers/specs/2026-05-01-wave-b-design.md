# Wave B 修復設計 — Audit Cycle 2026-04-30

**Status:** 待使用者覆核
**Date:** 2026-05-01
**Cycle:** `audit/cycles/2026-04-30/issues-master.md`
**Director:** main thread
**Base:** `647d5b0` (Wave A 已合進 main)

## 範圍

7 個視覺重設計 issue，分 3 個合併 cluster：

| Cluster | Issues | 視覺策略 |
|---|---|---|
| B-1 設計 tokens | M-008 / M-013 / M-014 | 一套 token 全站套用 |
| B-2 Sticky / fold | M-002 / M-003 | 共用 `position: sticky; bottom: 0` pattern |
| B-3 Phase-4 final report 重建 | M-004 / M-005 | SVG radar + tracking 4-dim 卡 |

## 測試門檻（director 標準）

**完工前必須跑滿三層測試 × 8 個 Playwright project**：
1. **SIT** — jest 全綠（≥104 pass / 0 fail）
2. **UAT** — `audit-master.spec.js` 8 project 全綠（≥434 pass / 0 fail）
3. **UI-UX** — `rwd-visual-gate.spec.js` 8 project 全綠（≥64 pass / 0 fail）+ PNG 肉眼比對

8 個 viewport project：Mobile-360 / iPhone-SE / iPhone-14 / iPhone-15-Pro / iPad / Desktop-1280 / Desktop-1440 / Desktop-2560。**B-3 Phase-4 重建範疇最大，director 自己親跑整合測試一次再放行**。

---

## B-1 · 設計 Tokens（M-008 / M-013 / M-014）

### 觸控目標 token（M-008）
```css
:root {
  --btn-touch-min: 44px;
  --btn-pad-x: 16px;
  --btn-pad-y: 10px;
  --btn-radius: 8px;
  --btn-font: 14px;
}
.btn,
.btn-ghost,
.circles-btn-primary,
.circles-btn-secondary,
.circles-btn-ghost,
.circles-q-confirm-btn,
.circles-q-cancel-btn,
.nsm-banner-btn,
.btn-home-icon,
button[id^="btn-export-png"] {
  min-height: var(--btn-touch-min);
  min-width: var(--btn-touch-min);
  padding: var(--btn-pad-y) var(--btn-pad-x);
  border-radius: var(--btn-radius);
  font-size: var(--btn-font);
  box-sizing: border-box;
}
```
全站掃描 grep：`min-height:\s*[0-9]\d?px|height:\s*[1-3]\dpx`，把所有 < 44px 的 button 列出，逐個確認是否要套 token（icon-only 仍 44×44）。

### 對比 token（M-013）
```css
:root {
  --c-text-3: #525252;            /* 原 #a1a1aa, AA 對比 5.74:1 */
  --c-chip-bg: #ede9fe;
  --c-chip-text: #5b21b6;         /* 對比 5.93:1 */
  --c-pill-active-bg: #ddd6fe;
  --c-pill-active-text: #4c1d95;  /* 對比 7.21:1 */
}
```
全站 grep `color:\s*var\(--c-text-3\)` 與所有 `.chip*` / `.pill*` 用 token 替代硬編色。

### Focus rings（M-014）
```css
:root { --c-focus-ring: #7c3aed; }

.circles-q-card,
.circles-mode-card,
.circles-type-tab,
.navbar-tab,
.offcanvas-item,
.history-item,
button {
  &:focus-visible {
    outline: 2px solid var(--c-focus-ring);
    outline-offset: 2px;
  }
}
```
（如果 codebase 不接受 nested syntax，展開成 `.circles-q-card:focus-visible { ... }`）。

---

## B-2 · Sticky / fold pattern（M-002 / M-003）

```css
/* 任何「主要動作行 + 上方可滾動長內容」場景 */
.scroll-container {
  display: flex;
  flex-direction: column;
  max-height: 100dvh;
}
.scroll-container .scroll-body {
  flex: 1;
  overflow-y: auto;
  padding-bottom: var(--circles-stickybar-pad);   /* Wave A 加過 96px */
}
.scroll-container .action-row {
  position: sticky;
  bottom: 0;
  background: var(--c-bg-1, #fff);
  border-top: 1px solid var(--c-bg-3);
  padding: 12px 16px env(safe-area-inset-bottom);
  z-index: 10;
}
```

**M-002 套用**：`.circles-q-card-full-block` 展開的題目卡，內側用 `.scroll-container` 結構，「取消／確認，開始練習」這條 action row 改 `position: sticky; bottom: 0`。

**M-003 套用**：`.circles-conclusion-box` 結論預覽，「← 繼續對話／確認提交」改 sticky；外層父需要 `display: flex; flex-direction: column; max-height` 讓 sticky 能 anchor。

確認：
- iPhone-SE 375×667 + iPad 768×1024 + Desktop-1280 × 800 都可 sticky 不被推出 fold。
- safe-area-inset-bottom（iOS bottom bar）有預留。
- box-shadow 用既有 `0 -2px 8px rgba(0,0,0,0.04)` 強化分隔，不過度突出。

---

## B-3 · Phase-4 Final Report 重建（M-004 / M-005）

### 段落順序（重建後）

1. **Grade 卡**（保留）— letter / overallScore / headline。
2. **新：CIRCLES 7 軸雷達圖**（M-004）— SVG `viewBox="0 0 240 220"`，中心 (120,110)、半徑 92。7 軸對應 `stepScores[k].totalScore` (0-100 → 0-1 → 92px)。標籤雙字「C 澄清 / I 用戶 / R 需求 / C2 排序 / L 方案 / E 取捨 / S 總結」。Polygon `fill: rgba(91,33,182,0.18)`、`stroke: var(--c-primary)`、stroke-width 2。
3. **各步驟分數明細**（保留 + token 顏色）— `class="step-rows"`，使用 token `--c-text-3` for label、score 顏色用 high/mid/low 三段 (≥70 / ≥50 / <50)。
4. **新：NSM tracking 4-dim 卡**（M-005）— 從 `circlesFrameworkDraft.tracking[dimKey]` 讀使用者填入文字。4 dim 各一張子卡，left border + dim 顏色（藍 #3b82f6 / 紫 #8b5cf6 / 綠 #10b981 / 橘 #f59e0b），label 用 `CIRCLES_TRACKING_DIMS` 的 `label / desc`。沒填的 dim 顯示 `<span class="dim-placeholder">（未填寫）</span>` 不省略。
5. **Strengths**（保留）。
6. **Improvements**（保留）。
7. **Coach verdict**（保留）。
8. **Submit bar**（Wave A 已加 PNG）— 重練這道題 / 匯出 PNG / 回首頁 icon。

### RWD 切點

```css
.circles-final-report { display: flex; flex-direction: column; gap: 12px; }

@media (min-width: 1024px) {
  .circles-final-report .top-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }
  /* radar 在左 / step rows 在右 */
}
```
其他卡片（tracking / strengths / improvements / verdict）仍直排。

### SVG radar 渲染

```js
function renderCirclesRadarSvg(stepScores) {
  var keys = ['C1','I','R','C2','L','E','S'];
  var labels = { C1:'C 澄清', I:'I 用戶', R:'R 需求', C2:'C2 排序', L:'L 方案', E:'E 取捨', S:'S 總結' };
  var cx = 120, cy = 110, R = 92;
  var pts = keys.map(function(k, i) {
    var raw = (stepScores && stepScores[k] && stepScores[k].totalScore) || 0;
    var v = Math.max(0, Math.min(100, raw)) / 100;
    var ang = -Math.PI / 2 + (Math.PI * 2 * i / keys.length);
    var x = cx + R * v * Math.cos(ang);
    var y = cy + R * v * Math.sin(ang);
    return { x: x, y: y, ang: ang, k: k, label: labels[k] };
  });
  var poly = pts.map(function(p) { return p.x.toFixed(1) + ',' + p.y.toFixed(1); }).join(' ');
  var grids = [0.75, 0.5, 0.25].map(function(scale) {
    var gp = keys.map(function(_, i) {
      var ang = -Math.PI / 2 + (Math.PI * 2 * i / keys.length);
      return (cx + R * scale * Math.cos(ang)).toFixed(1) + ',' + (cy + R * scale * Math.sin(ang)).toFixed(1);
    }).join(' ');
    return '<polygon class="radar-grid" points="' + gp + '"/>';
  }).join('');
  var axes = pts.map(function(p) {
    var x2 = cx + R * Math.cos(p.ang), y2 = cy + R * Math.sin(p.ang);
    return '<line class="radar-axis" x1="' + cx + '" y1="' + cy + '" x2="' + x2.toFixed(1) + '" y2="' + y2.toFixed(1) + '"/>';
  }).join('');
  var dots = pts.map(function(p) { return '<circle class="radar-dot" cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="3"/>'; }).join('');
  var labelEls = pts.map(function(p) {
    var lx = cx + (R + 16) * Math.cos(p.ang);
    var ly = cy + (R + 16) * Math.sin(p.ang);
    var anchor = lx > cx + 1 ? 'start' : (lx < cx - 1 ? 'end' : 'middle');
    return '<text class="radar-label" x="' + lx.toFixed(1) + '" y="' + ly.toFixed(1) + '" text-anchor="' + anchor + '">' + escHtml(p.label) + '</text>';
  }).join('');
  return '<svg class="radar-svg" viewBox="0 0 240 220" preserveAspectRatio="xMidYMid meet" role="img" aria-label="CIRCLES 七步驟分數雷達圖">' +
    grids + axes +
    '<polygon class="radar-poly" points="' + poly + '"/>' +
    dots + labelEls +
  '</svg>';
}
```

### Tracking block 渲染

```js
function renderCirclesTrackingBlock(tracking) {
  tracking = tracking || {};
  var dims = CIRCLES_TRACKING_DIMS;  // 既有 array
  var rows = dims.map(function(dim) {
    var v = tracking[dim.key];
    var content = (typeof v === 'string' && v.trim())
      ? '<div class="dim-content">' + escHtml(v) + '</div>'
      : '<div class="dim-content dim-placeholder">（未填寫）</div>';
    return '<div class="tracking-dim ' + dim.key + '">' +
      '<div class="dim-head">' +
        '<span class="dim-dot" style="background:' + dim.dotColor + '"></span>' +
        '<span class="dim-label">' + escHtml(dim.label) + ' · ' + escHtml(dim.desc) + '</span>' +
      '</div>' +
      content +
    '</div>';
  }).join('');
  return '<div class="tracking-card">' +
    '<h4>NSM 追蹤指標</h4>' +
    rows +
  '</div>';
}
```

### 對 PNG export 的影響

`html2canvas` 會把整個 `.circles-final-report` 抓進 canvas。SVG radar + tracking block 都是純 DOM，無外部 lib，可正確匯出。CDN blocked 時 fallback toast 仍可用（A5 已實作）。

---

## 實作分配（fix agent 對應 plan）

| Agent | Cluster | 主要檔案 |
|---|---|---|
| fix-B1 | B-1 設計 tokens | `public/style.css`（新 :root tokens + selector 統一） |
| fix-B2 | B-2 Sticky / fold | `public/app.js` 兩處 (展開卡 / 結論盒) + `public/style.css` |
| fix-B3 | B-3 Phase-4 重建 | `public/app.js` (radar + tracking 渲染 + integrate to renderCirclesFinalReport) + `public/style.css` (radar / tracking / RWD top-grid) |

**B-3 範疇大、涉及 LLM 回傳資料結構（stepScores / tracking）+ SVG 渲染 + RWD + PNG export**，director 收 implementer commit 後親自跑全 SIT/UAT/UI-UX × 8 viewport 才放行。

## TDD spec 落點

- `tests/playwright/journeys/audit/master-008-013-014-tokens.spec.js` — 量幾顆代表性按鈕的 boundingBox 高度 ≥44；量 chip / pill / text-3 的 contrast；focus 後檢查 outline。
- `tests/playwright/journeys/audit/master-002-003-sticky.spec.js` — iPhone-SE 展開題目卡 + Phase-2 結論預覽 sticky 鈕在 fold 內。
- `tests/playwright/journeys/audit/master-004-005-final-report.spec.js` — Phase-4 final report 有 `.radar-svg`（viewBox 240 220、7 個 axis、7 個 dot）+ `.tracking-card` 4 個 `.tracking-dim` + tracking 沒填顯示 `（未填寫）`。

每個 spec 必跑 8 個 viewport project（在 spec 內 `for (const vp of [...])` 或讓 spec 不指定 viewport 而由 project config 各自跑一遍）。

## 全套 verification（director 親跑）

```bash
# SIT
npm test 2>&1 | tail -5

# UAT
PMDRILL_BASE_URL=http://localhost:4000 npx playwright test \
  --config=tests/playwright/playwright.config.js \
  journeys/audit/audit-master.spec.js \
  --workers=4 --reporter=line 2>&1 | tail -5

# UI-UX
PMDRILL_BASE_URL=http://localhost:4000 npx playwright test \
  --config=tests/playwright/playwright.config.js \
  journeys/audit/rwd-visual-gate.spec.js \
  --workers=4 --reporter=line 2>&1 | tail -5

# 新 spec 三支
PMDRILL_BASE_URL=http://localhost:4000 npx playwright test \
  --config=tests/playwright/playwright.config.js \
  journeys/audit/master-008-013-014-tokens.spec.js \
  journeys/audit/master-002-003-sticky.spec.js \
  journeys/audit/master-004-005-final-report.spec.js \
  --workers=4 --reporter=line 2>&1 | tail -10
```

期望：jest 104/0；audit-master ≥434/0；rwd-visual-gate ≥64/0；新 3 spec 全綠（依 viewport 數量會有 24-72 不等的 case 數）。

## Wave B 完工門檻

- [ ] 三層測試（SIT / UAT / UI-UX）全綠
- [ ] 8 viewport project 都跑過
- [ ] PNG snapshot 肉眼比對 final report 重建後 vs 重建前的位移可接受
- [ ] M-004 雷達圖在所有 8 viewport 都可讀（標籤不被截）
- [ ] M-005 tracking 4 dim 卡在 Mobile-360 / Desktop-2560 都正常排版
- [ ] M-008 全站按鈕 ≥44×44（grep 殘餘 < 44px button）
- [ ] M-013 chip / pill / text-3 對比過 AA
- [ ] M-014 focus-visible 在所有 audit auditor 列出的元素都見

## 後續

Wave B 完成後 → Phase 6 sign-off → 提交 PR。剩餘 P2 與 coverage gaps（A3 / A5 / A6 / C7 / D3 IME）依 director 決定是否進 Wave C 或 defer。
