# Plan B SB9b — Locked / Stale / Save-error Audit

**Date:** 2026-05-04
**Plan:** `docs/superpowers/plans/2026-05-04-plan-b-sb9b-locked-stale.md`
**Mockup ref:** 03-phase-1-form.html Section E line 1953-2106

## State × viewport matrix（9 PNG — 全 Read 過）

`/tmp/sb9b-states/{vp}-{state}.png`

| viewport | locked | stale | save-error |
|---|---|---|---|
| mobile-360  | ✓ navy banner+lock-key+76/100 / 看評分結果 / rt-field disabled | ✓ red banner+octagon / 用最新題目重練 / rt-field disabled | ✓ red save-error banner+cloud-warning+立即重試 / 下一步請先恢復連線 disabled / rt-field 仍可編輯 |
| tablet-768  | ✓ Read 過 | ✓ Read 過 | ✓ Read 過 |
| desktop-1280 | ✓ Read 過 | ✓ Read 過 | ✓ Read 過 |

**9/9 PNG 親 Read 全對齊 mockup Section E**（不只看 console log）。

## 7 步 × 3 state cross-step 驗證（21 case）

額外確認 rt-field--locked count 在不同 step 結構下都正確：

| state | C1 | I | R | C2 | L | E | S | CTA |
|---|---|---|---|---|---|---|---|---|
| locked | rt-locked=4 | =4 | =4 | =4 | =2 (sol-card mechanism) | =8 (2sol×4nested) | =3 (3 main + 4 input readonly) | 看評分結果 |
| stale | =4 | =4 | =4 | =4 | =2 | =8 | =3 | 用最新題目重練 |
| save-error | =0 (不鎖) | =0 | =0 | =0 | =0 | =0 | =0 | 下一步（請先恢復連線）disabled |

**21/21 case 全 banner=1 + rt-field--locked count 對 step 結構** + L step locked.png 親 Read（rt-toolbar opacity 0.5 + sol-card 整張卡視覺正常）+ S step locked.png 親 Read（3 main + 4 tracking-card readonly）。

## Director eyeball walk

3 desktop PNG 親 Read：

1. **desktop-1280-locked**: navy banner 顯「已評分鎖定·76/100」+ lock-key icon + 副文「只鎖定編輯,答案仍可閱讀」/ 4 fields rt-field 全 bg-soft + opacity faded / rt-toolbar opacity 0.5 / submit-bar primary 「看評分結果 →」 — 對齊 mockup line 1967-2003
2. **desktop-1280-stale**: red banner 顯「題庫已更新 — 顯示為唯讀」+ warning-octagon icon + 副文「problem_statement 與資料庫目前版本不同」/ rt-field 全 disabled / submit-bar primary 「↻ 用最新題目重練」 — 對齊 mockup line 2018-2050
3. **desktop-1280-save-error**: red banner-save-error 顯「離線中·已存於本機」+ cloud-warning icon + 副文「你的修改已保存到瀏覽器」+ 「立即重試」link / rt-field NOT disabled（placeholder 顯示且 contenteditable）/ phase-head meta save-indicator 顯「離線中·點擊重試」/ submit-bar primary disabled「下一步（請先恢復連線）」 — 對齊 mockup line 2067-2092

## Mockup-as-Spec drift

**0 條 drift**。三狀態完整對齊 mockup line 1953-2106 規格。

## Mockup ↔ production pixel-diff（mockup-as-Spec Layer 2）

`tests/visual/sb9b-section-pixel-diff.spec.js` 跑 3 frames vs mockup line 1957-2095:

| frame | diff% | verdict |
|---|---|---|
| Mobile · locked     | **5.38%** | 🟠 < 15% (state diff 預期 — mockup hardcoded textarea content vs production empty) |
| Tablet · stale      | **3.14%** | 🟡 < 5% |
| Desktop · save-error | **2.49%** | 🟡 < 5% |

Mobile-locked diff PNG 親 Read：紅點全是 mockup 651px 短/production 1700px 長 padding mismatch + textarea content state diff，**無 structural drift**（navbar / phase-head / banner / 看評分結果 CTA 全位置正確）。

`audit/sb9b-pixel-diff-report.md` 完整 report 含 mockup/production/diff 三 PNG 路徑。

## iOS Safari 15-item 靜檢（master-spec §0.2）

walk SB9a + SB9b 改動：

| # | 項目 | 結果 |
|---|---|---|
| 1 | 100vh 不跳 | ✓ 無 100vh 新增 |
| 2 | safe-area-inset | ✓ 沒改 submit-bar padding |
| 3 | input ≥ 16px | ✓ 沒新增 input；tracking-card input readonly attr 不改字體 |
| 4 | tap-highlight 透明 | ✓ 沿用 global `*` rule |
| 5 | 動畫 GPU-accelerated | ✓ save-indicator--saving 用 `transform: rotate()`（spin keyframes line 74） |
| 6 | sticky 行為穩定 | ✓ banner 是 normal flow 非 sticky；submit-bar 沿用 |
| 7 | momentum scroll | ✓ 沒改 overflow |
| 8 | 鍵盤彈出不亂跳 | ✓ contenteditable=false 在 locked 時 user 不會 focus 喚鍵盤 |
| 9 | modal focus trap | ✓ SB9a/9b 沒動 modal（hint modal 沿用 SB8） |
| 10 | 無 FOUC | ✓ 沒加新 CSS load |
| 11 | touch target ≥ 44px | ⚠ `.save-indicator--error` cursor:pointer 但 padding 4px 8px → ~22px 高 < 44px。**mockup-faithful**（mockup line 306 也只給 4px 8px），記錄為已知 design constraint |
| 12 | long content 不爆版 | ✓ banner__main 既有 `min-width: 0`；save-indicator 文字短 |
| 13 | backdrop-filter 雙前綴 | ✓ 沒新加 |
| 14 | 滾動性能 | ✓ 沒改 scroll 容器 |
| 15 | layout thrashing | ✓ `setPhase1SaveState` outerHTML swap 限 phase-head 小區，不高頻 |

**14/15 PASS + 1 mockup-faithful design constraint 記錄**。

## Tests / regression

- jest: 進行中
- Playwright phase1-locked-stale Desktop-1280: 10/10 ✓ TDD red→green
  - locked: banner / rt-field disabled / 看評分結果 CTA ✓
  - stale: banner / rt-field disabled / 用最新題目重練 CTA ✓
  - save-error: banner / disabled CTA / rt-field NOT disabled ✓
  - default: no banners ✓
- 8 viewport regression: 進行中

## How wired

- `AppState.circlesLocked` / `circlesStale` / `circlesPhase1SaveState='error'` 三 flag 任一 truthy → trigger overlay
- 3 banner render helper（renderLockedBanner / renderStaleBanner / renderSaveErrorBanner）
- `applyPhase1StateOverlay(html)` post-process：
  1. inject banner before first `.phase-body` or `.submit-bar`
  2. locked/stale only: `rt-field` → `rt-field rt-field--locked` + `contenteditable="true"` → `"false"` + sol-name/tracking input readonly
  3. submit-bar primary CTA 字串替換對應狀態
- CSS：
  - `.banner--locked` (navy-lt, mockup 15 collation existing)
  - `.banner--stale` (danger-lt, mockup 15 collation existing)
  - `.banner--save-error` (新加, danger-lt + cloud-warning)
  - `.rt-field--locked` (新加, bg-soft + opacity 0.85 + toolbar opacity 0.5)
- 4 phase-1 renderer return 全 wrap `applyPhase1StateOverlay(...)`：
  - base `renderCirclesPhase1`（C1/I/R/C2）
  - `renderCirclesPhase1Lstep`
  - `renderCirclesPhase1Estep`
  - `renderCirclesPhase1Sstep`
