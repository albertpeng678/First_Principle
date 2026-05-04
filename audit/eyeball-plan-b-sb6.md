# Eyeball Walk — Plan B SB6 · qchip 題目展開 (mockup 03 Section G)

**Date：** 2026-05-04
**Director：** opus 4.7 main agent (cold review — 不信 sonnet self-report，獨立跑 Layer 1-6)
**Implementer：** sonnet 4.6 subagent (commit 51fd4a0)
**Cold-review fix commit：** （無 — sonnet 實作對齊度高，drift 都是 mockup 跨 section ambiguity 屬 carry-forward）

---

## Layer 1 — Mockup baseline 凍結

- mockup HTML：`docs/superpowers/specs/mockups/2026-05-02-frontend-rewrite/03-phase-1-form.html` line 2229-2390
- mockup CSS：line 94-172（qchip-expand / qchip-ana / 4 變體 / qchip-collapse-btn）— **整段 copy 進 public/style.css，無衍生**

## Layer 2 — Mechanical pixel-diff

| Viewport | mockup | production | diff% | verdict |
|---|---|---|---|---|
| Mobile-360 | 358×997 | 360×2207 | **7.01%** | 🟠 < 15% state diff |
| Tablet-768 | 766×920 | 768×1935 | **4.75%** | 🟡 < 5% |
| Desktop-1280 | 1278×873 | 1280×1887 | **3.47%** | 🟡 < 5% |

Report：`audit/sb6-pixel-diff-report.md`
PNG artifacts：`tests/visual/diffs/sb6/{vp}-{mockup,production,diff}.png`（gitignored）

**Diff PNG 親 Read 確認 red 來源：**
1. navbar 登入態：mockup logged-in (email + sign-out + home) / production guest (sign-in + home)
2. textarea / statement filled：mockup hardcoded Spotify Podcast / production 隨機 Grab/Apple/Microsoft etc
3. statement strong markup：mockup `<strong>不能影響廣告收入或訂閱轉換率</strong>` 加粗 / production `escHtml(plain text)` 不加粗
4. 4 ana-block 內文：mockup hardcoded Spotify-specific / production `q.analysis.{business,users,traps,insight}` 隨題目
5. 頁面高度差：mockup capture 873 高（只到 qchip-expand 結束）/ production 1887 高（含 4 form fields + submit-bar）
6. phase-head__meta：production 加「完整模擬 · 1/7 步」suffix / mockup 只 「已儲存」

**結構 layout 對齊 ✓** — navbar / progress / phase-head / qchip / qchip-expand panel position / statement padding / 深入分析 navy bar / 4 ana-block y 位 / collapse btn 位置 全相符。**無結構錯位。**

## Layer 3 — boundingBox invariant（5 條）

1. **qchip-expand 寬 = qchip 寬 = phase-body 寬**：3 viewport 都 align（mobile/tablet/desktop 內距一致）— PASS
2. **statement max-width 64ch + 內距 padding s-3 s-4**：mockup CSS line 99-108 — PASS
3. **4 ana-block 等寬 + flex column gap s-3**：mockup CSS line 128-138 — PASS
4. **section-label::before 24×2px navy bar**：mockup CSS line 121-127 — PASS
5. **collapse-btn padding 6px 12px + radius --r-input + border --c-rule**：mockup CSS line 161-172 — PASS

## Layer 4 — WebKit + Chromium 雙引擎

`phase1-qchip-expand.spec.js` 8 project（chromium + webkit × 4 mobile + 2 tablet/iPad + 4 desktop）= 56/56 PASS

## Layer 5 — State matrix

| Viewport | collapsed | expanded | total |
|---|---|---|---|
| Mobile-360 | ✓ /tmp/sb6-cr-mobile-360-collapsed.png | ✓ /tmp/sb6-cr-mobile-360-expanded.png | 2 PNG |
| iPad-768 | ✓ /tmp/sb6-cr-ipad-collapsed.png | ✓ /tmp/sb6-cr-ipad-expanded.png | 2 PNG |
| Desktop-1280 | ✓ /tmp/sb6-cr-desktop-1280-collapsed.png | ✓ /tmp/sb6-cr-desktop-1280-expanded.png | 2 PNG |

6 PNG 全 director Read。

## Layer 6 — Director eyeball walk（每張 PNG ≥ 1 句評論）

| PNG | Director 評論 |
|---|---|
| Mobile-360 collapsed | navbar list+brand+(sign-in 因 guest)+home / phase-head 01 / Phase 1 寫框架 / C 澄清情境 / 已儲存 / qchip 完整 + ph-caret-down / 4 fields render below — 與 mockup line 2238-2252 collapsed-state 相符（但 progress S 總結 mobile-360 overflow 為 carry-forward） |
| Mobile-360 expanded | qchip is-expanded + ph-caret-up / qchip-expand panel 出現：statement on surface bg「設計一個新功能...」/「— 深入分析」navy 24px bar + label / 4 ana-block 全 render: 商業背景 (ph-buildings navy)、用戶輪廓 (ph-users navy)、**常見誤區 (ph-warning warn 橘色 + 橘色 trap bg)**、破題切入 (ph-lightbulb navy) / 收合 ghost btn / 4 fields render below qchip-expand — 完全對齊 mockup line 2245-2278 |
| iPad-768 collapsed | navbar 加 tabs CIRCLES(active)/北極星指標 + sign-in icon + home / phase-head 1/7 步 sim 標 / qchip ph-caret-down / 4 fields render — 對齊 mockup line 2287-2300（**注意：tablet qchip__company 不顯 「· 設計題 · 難度 中」suffix，與 mockup 03 Section A/B/C 的 tablet 一致，但 Section G mockup line 2296 顯示 suffix — 為 mockup 跨 section ambiguity，非 SB6 scope drift**） |
| iPad-768 expanded | 完整 4-block 展開 / trap 橘色 / 收合 btn / submit-bar 上一步+下一步 sticky 底 — 對齊 mockup line 2293-2326 |
| Desktop-1280 collapsed | navbar 加 sign-in（guest mode）+ home / qchip ph-caret-down / 4 fields + rail（drill 模式才有 rail，sim base 無）— 對齊 mockup line 2333-2346 collapsed |
| Desktop-1280 expanded | qchip is-expanded + ph-caret-up / 完整 statement on surface / 「— 深入分析」navy bar / 4 ana-block 包含 trap 橘色 / 收合 btn / 4 fields below + submit-bar — 對齊 mockup line 2339-2372 |

## Layer 7 — User 真機抽驗

待 user 接 main 後手動驗。

---

## Cross-mockup section ambiguity（記入 carry-forward — 非 SB6 scope）

| 議題 | 影響 mockup | production 行為 | carry-forward 處理 |
|---|---|---|---|
| Tablet sim qchip__company 是否含「· 設計題 · 難度 中」suffix | Section A/B/C tablet **無** vs Section G tablet **有**（line 2296）| 跟 majority no-suffix | 後續 user 可指示對齊 G or 維持現狀 |
| Desktop sim qchip__company suffix 在 base C1/I/R/C2 renderer | Section A 沒提供 desktop sim frame；B/C/G desktop sim 都有 suffix | renderCirclesPhase1 sim mode 不加 suffix（只 drill 加）| 後續可改 renderCirclesPhase1 加 desktop sim suffix 對齊 B/C/G pattern |

兩條都是 SB1-5 既有行為，SB6 沒動到 qchip company logic（git diff 只動了 qchip class + caret + append qchip-expand），因此**非 SB6 scope 內 drift**。

---

## 4 樣強制產出物（spec §6.2）

| # | 產出 | 路徑 / 數字 |
|---|---|---|
| 1 | jest log | 157/157（140 pass + 17 skip）— 不 regression ✓ |
| 2 | Playwright log | `phase1-qchip-expand.spec.js` 56/56 × 8 viewport（含 webkit）；regression `circles-home + phase1-form + phase1-l-step + phase1-s-step` × 8 viewport 328/328 ✓ |
| 3 | pixel-diff report | `audit/sb6-pixel-diff-report.md`（mobile 7.01% / tablet 4.75% / desktop 3.47%）✓ |
| 4 | eyeball walk doc | 本檔 ✓ |

## 殺手鐧 3 問自抽

1. **「Read 過 PNG 沒？」** → 6 PNG（3 vp × 2 state）+ 3 mockup capture + 3 diff PNG 全 director Read，每張 ≥ 1 句評論記在 Layer 6 表
2. **「5 條 boundingBox invariant」** → 列在 Layer 3：qchip-expand 寬 / statement 64ch / 4 ana-block 等寬 / section-label::before 24×2 / collapse-btn padding 6/12 — 全對 mockup CSS line ranges
3. **「mockup ↔ production pixel-diff？」** → `audit/sb6-pixel-diff-report.md`，3 vp diff% 3.47-7.01% 全 < 15% 結構正確；diff PNG 紅點來自 navbar 登入態 / textarea filled / hardcoded vs random 題目 / 頁面高度差，無結構錯位

---

## Self-review checklist

- [x] L1 Mockup baseline freeze — line 2229-2390 + line 94-172
- [x] L2 Pixel diff — `audit/sb6-pixel-diff-report.md` + diff PNG director Read
- [x] L3 boundingBox invariant — 5 條 PASS
- [x] L4 WebKit + Chromium — 56/56 × 8 viewport
- [x] L5 State matrix — 6 PNG（3 vp × 2 state collapsed/expanded）+ 收合動作驗 1 spec test
- [x] L6 Director eyeball walk — 本檔
- [ ] L7 User 真機抽驗 — pending user signoff
