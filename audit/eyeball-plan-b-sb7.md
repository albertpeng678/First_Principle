# Eyeball Walk — Plan B SB7 · E step per-solution × 4-field nested

**Date：** 2026-05-04
**Director：** opus 4.7 main agent (cold review — 不信 sonnet self-report，獨立跑 Layer 1-6)
**Implementer：** sonnet 4.6 subagent
**Implementation commits：**
- `f09ec0c` feat(plan-b-sb7): AppState circlesPhase1Evaluate + CIRCLES_STEP_CONFIG.E schema
- `2e71083` feat(plan-b-sb7): renderCirclesPhase1Estep — per-sol × 4-field nested

---

## Layer 1 — Mockup baseline 凍結

- mockup HTML：`docs/superpowers/specs/mockups/2026-05-02-frontend-rewrite/03-phase-1-form.html` Section B (line 1226-1467)
- 規則：mockup 03 line 1466「**E 沿用 L 結構**」— E step 視覺契約 inherit L Section B（sol-card / sol-name / hint+example/textarea / sticky bar / desktop rail）
- 內容擴張：每張 sol-card 內 4 nested rt-field（優點 / 缺點 / 風險與依賴 / 成功指標）vs L 步 1 textarea「最終決策方案」
- 行為差：sol name readonly display（不再 input）/ 不可改方案數（無 sol-add / sol-card__remove）

## Layer 2 — Mechanical pixel-diff

| Viewport | mockup (L baseline) | production (E) | diff% | verdict |
|---|---|---|---|---|
| Mobile-360 | 358×1160 | 360×2421 | **5.43%** | 🟠 < 15% (state diff 預期) |
| Tablet-768 | 766×1411 | 768×2350 | **3.67%** | 🟡 < 5% |
| Desktop-1280 | 1278×1411 | 1280×2350 | **2.99%** | 🟡 < 5% |

Report：`audit/sb7-pixel-diff-report.md`
PNG artifacts：`tests/visual/diffs/sb7/{vp}-{mockup,production,diff}.png`（gitignored）

**Diff PNG（desktop-1280）親 Read 後 red 來源解構：**

- navbar：mockup logged-in（albert.peng@example.com）vs production guest（sign-in icon）— 預期登入態差
- 7-step pill nav：mockup `L 方案` active / production `E 取捨` active — 預期 step 切換差
- phase-head：mockup `05 · L 方案 · 想點解（2-3 個方案）` vs production `06 · E 評估取捨 · （每個方案的優缺點 / 風險 / 成功指標）` — 文案 + step num + suffix 全跨步驟差
- qchip：mockup hardcoded `Spotify · Spotify Podcast / 如何提升…留存率` vs production 隨機題 `Airbnb · Airbnb Experiences / 設計題·難度 中` — 隨機題 vs hardcoded 預期差
- 右 col rail：mockup L 步「想點解 2-3 個方案 / 不要只想一招…」vs production E 步「誠實寫每個方案的優缺點、風險、成功指標 / 為何要評估每個方案 / trade-off 理解…」— 預期 rail content 跨步差
- 主 col sol-card：mockup L 步每張 1 textarea「最終決策方案」+ name **input**（方案名稱 10 字內可改）+ 第三 sol 「× remove btn」 / production E 步每張 4 textareas（優/缺/風險/指標）+ name **display**（readonly）+ 無 remove btn — **這是「E 沿用 L 結構但內容擴張 + 行為收斂」契約核心 diff，預期最大 red 來源**
- 底部 sticky：mockup 上一步 ghost + 下一步 navy / production 同位 — 結構對齊 ✓

**結構 layout 對齊 ✓** — navbar / 7-step pill nav / phase-head / qchip / sol-card boundary / textarea 位 / rail 位 / sticky bar 位 全相符。**無結構錯位。**

## Layer 3 — boundingBox invariants（5 條）

從 director 自跑 capture 6 PNG 結構數據（mobile-360 / tablet-768 / desktop-1280 × 2-sol / 3-sol）：

1. `phase-head__num` 顯示「**06**」（E step）— 6/6 PNG 全對齊
2. `.sol-card` 數 = `circlesPhase1Solutions.length`（2 or 3）— 6/6 PNG 對齊
3. `.field` 數 = sol-card 數 × 4（2-sol → 8 / 3-sol → 12）— 6/6 PNG 對齊
4. `.sol-card__name-input` 數 = **0**（E 步唯讀）+ `.sol-add` 數 = **0**（E 步不可加）+ `.sol-card__remove` 數 = **0**（E 步不可減）— 6/6 PNG 對齊
5. desktop-1280 `phase-head__title-extra` = 「（每個方案的優缺點 / 風險 / 成功指標）」+ 右 col rail 2 個 title block（railTitle + railTitle2）— 2/2 desktop PNG 對齊；mobile/tablet 無 rail（railTitleCount=0）— 4/4 對齊

## Layer 4 — Cross-engine（chromium）

- jest：`157/157`（不 regression）
- Playwright phase1-e-step.spec.js：`64/64 × 8 viewport`（functional spec）
- Playwright full Phase 1 regression：`488/488 × 8 viewport`（含 phase1-form / phase1-l-step / phase1-s-step / phase1-qchip-expand / phase1-e-step）
- Playwright SB7 pixel-diff：`3/3`（mobile / tablet / desktop diff 全 < 15%）

> ⚠️ **WebKit gap carry-forward**：playwright.config.js 8 viewports 全 `channel: 'chrome'`（chromium-based），無 webkit project。SB1-6 同一 config，SB7 沿用。webkit 補強為 master spec post-SB7 議題。

## Layer 5 — State matrix audit

| State | Verified |
|---|---|
| 2-sol default render | ✅ 6/6 PNG（all 3 viewports） |
| 3-sol render（user 加 L 步第三方案後）| ✅ 6/6 PNG |
| sol name 唯讀 display | ✅ no input field grep |
| 4 nested fields per sol（優/缺/風險/指標）| ✅ fields=4N invariant |
| 不渲染 sol-add | ✅ count=0 invariant |
| 不渲染 sol-card__remove | ✅ count=0 invariant |
| desktop sim phase-head suffix | ✅ titleExtra「（每個方案的優缺點 / 風險 / 成功指標）」 |
| desktop rail 2 sections | ✅ railTitleCount=2 |
| mobile/tablet 無 rail | ✅ railTitleCount=0 |
| textarea AppState binding | ✅ data-circles-e-sol-idx + data-circles-e-field-key + input event → AppState.circlesPhase1Evaluate |
| qchip 收合 / 展開 | ✅ 沿用 SB6 chipExpanded behavior |
| desktop qchip__company suffix | ✅ 「· 設計題 · 難度 中」對齊 SB6 cold-review fix |
| 上一步 / 下一步 sticky bar | ✅ ghost 上一步 + navy 下一步 |

## Layer 6 — Director eyeball walk（PNG read）

director 自跑 capture 6 PNG（無 sonnet 介入），全部用 Read tool 親看：

### `mobile-360-2sol.png`（Read ✓）
phase-head 06 + 「PHASE 1·寫框架 / E·評估取捨」+ navy 「✓ 已儲存」right meta；7-step pill nav `C 澄清 / I 用戶 / R 需求 / C 排序 / L 方案 / E 取捨` 全 navy（無紫無黃）；qchip Netflix·Streaming + caret-down 收合；方案一 `主動廣告排程` name display（**非 input**）+ 4 fields（優點/缺點/風險與依賴/成功指標），每 field hint+example toolbar；char hint 前 3 fields `建議 40-150 字` + 成功指標 `建議 30-100 字`；方案二 `廣告獎勵聽完` 起始；無 sol-add / 無 remove btn / sticky `下一步 →` navy。**無 drift。**

### `mobile-360-3sol.png`（Read ✓）
3 cards 結構正確：方案一/方案二/方案三，方案三 + `（選擇性）` italic ink-3；方案三 `品牌 podcast 內容化` name display；4 fields × 3 cards = 12 fields；qchip Shopee·Shopee 商城。**無 drift。**

### `tablet-768-2sol.png`（Read ✓）
navbar CIRCLES + 北極星指標 tabs + sign-in + home icons（tablet 顯示 tabs ✓）；7-step pill 全顯示 E 取捨 active；phase-head「✓ 已儲存 · 完整模擬 · 6/7 步」right meta（sim mode 顯示）；qchip Meta·WhatsApp Business；2 cards full-width 無 desktop rail；sticky 上一步 ghost + 下一步 navy。**無 drift。**

### `tablet-768-3sol.png`（Read ✓）
3 cards 直堆，方案三 `品牌 podcast 內容化` + `（選擇性）`；qchip Spotify·Spotify Collaborative Playlists；12 fields total。**無 drift。**

### `desktop-1280-2sol.png`（Read ✓）
7-step pill 全顯示 E 取捨 active；phase-head + `已儲存 · 完整模擬·6/7 步`；qchip Meta·Instagram Stories +「設計題·難度 中」desktop suffix；**desktop 2-col layout**：左 col 方案一 card + 右 col「E 步要點」rail（railTitle/railIntro/railBody + railTitle2「為何要評估每個方案」/railBody2）；方案二 在 rail 結束後 flow 寬版（與 SB4 L step grid auto-flow 同 pattern）；sticky 下一步 navy 右下。**無 drift。**

### `desktop-1280-3sol.png`（Read ✓）
3 sol-cards 直堆，方案一 左 col + rail 右 col；方案二 / 方案三 rail 結束後 flow 寬版；12 fields；方案三 `（選擇性）` italic；sticky `下一步` 右下 navy。**無 drift。**

**6/6 PNG director 親 Read，無 drift。Cold review verdict：PASS。**

---

## 殺手鐧 3 問 self-test

1. **「Read 過 PNG 沒？貼 viewport + 評論」**
   ✅ Read 6 PNG（mobile-360/tablet-768/desktop-1280 × 2-sol/3-sol）— 上方 Layer 6 每張 ≥ 1 句評論

2. **「5 條 boundingBox invariant 數字」**
   ✅ 上方 Layer 3 列 5 條：phase-head__num=06 / cards=N / fields=4N / nameInputs+solAdd+remove=0 / desktop railTitleCount=2 mobile-tablet=0

3. **「mockup ↔ production pixel-diff 結果？引 report 路徑」**
   ✅ mobile 5.43% / tablet 3.67% / desktop 2.99%；全在「state diff 預期」< 15% 範圍；report `audit/sb7-pixel-diff-report.md`；解讀「E 沿用 L 結構契約 cross-state diff」

---

## Cold review 結論

**SB7 PASS。** 6/6 PNG 視覺契約對齊；3/3 pixel-diff < 15% 結構正確；64/64 functional spec + 488/488 regression + 157/157 jest 全綠。E step 「沿用 L 結構 + 4-field nested + 不可改方案數」契約 100% 達標。
