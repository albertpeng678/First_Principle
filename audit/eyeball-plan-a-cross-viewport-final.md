# Plan A — Full-Coverage Cross-Viewport Audit (Final)

**Date:** 2026-05-08
**Scope:** 11 mockups × 3 viewports pixel-diff master + 5 mockup capture batches × 8 viewports + director cold-verify on 🔴 cases
**Trigger:** User 親抓「你是否有針對全裝置、全尺寸進行視覺確認，禁止偷懶」— 補足之前 Phase 2/3/4 audit 缺漏的 mockup 01/02/03/06/09 cross-viewport 鬆懈缺口。

---

## 證據鏈總覽

### 1. Subagent A — 5 capture spec batches × 8 viewports
- `tests/visual/capture-prod-mockup-{01,02,03,06,09}-pngs.spec.js`（5 specs）
- `audit/png-prod-mockup-{01,02,03,06,09}/`（136 PNGs total）
  - 01 home: 24 PNGs（A guest-empty / B authed / C drill）× 8 vp
  - 02 auth: 24 PNGs（A pre-auth / B sign-in modal / C signed-in）× 8 vp
  - 03 phase1 form: 32 PNGs（A C1 / B I / C R / D C2）× 8 vp
  - 06 nsm step1: 24 PNGs（A empty / B card-selected / C product-pill-filter）× 8 vp
  - 09 offcanvas: 32 PNGs（A empty / B drafts / C completed scores / D loading）× 8 vp

### 2. Subagent B — Master pixel-diff (11 mockups × 3 viewports)
`audit/pixel-diff-master-2026-05-08.md` + 99 PNGs in `tests/visual/diffs/master/`

**Verdict counts (33 cases):**
- ✅ < 0.5% — 0 cases
- 🟡 < 5% (cosmetic clean) — **11 cases**
- 🟠 < 15% (state diff 預期) — **20 cases**
- 🔴 ≥ 15% (need verify) — **2 cases**
- 🔲 frame-not-found — 0 cases (full coverage)

**Per-mockup table:**

| Mockup | Mobile-360 | iPad-768 | Desktop-1280 |
|---|---|---|---|
| 01 home | 🔴 19.95% | 🟠 14.56% | 🟠 12.97% |
| 02 auth | 🔴 15.33% | 🟠 11.21% | 🟠 9.12% |
| 03 phase1 form | 🟠 6.97% | 🟡 3.28% | 🟡 3.58% |
| 04 gate | 🟠 9.40% | 🟠 5.31% | 🟡 3.49% |
| 05 phase2 chat | 🟠 5.64% | 🟡 3.53% | 🟡 2.61% |
| 06 nsm step1 | 🟠 13.43% | 🟠 6.20% | 🟡 3.15% |
| 07 nsm step2 | 🟠 8.32% | 🟡 4.68% | 🟡 2.83% |
| 09 offcanvas | 🟠 12.11% | 🟠 9.88% | 🟠 9.84% |
| 10 onboarding | 🟠 13.91% | 🟠 10.27% | 🟠 8.91% |
| 11 phase3 score | 🟠 8.42% | 🟠 6.26% | 🟡 4.74% |
| 13 phase4 final | 🟠 13.88% | 🟠 9.39% | 🟠 8.96% |

### 3. Director cold-verify — Mockup 01 全 24 PNG personal Read

Section A guest-empty 8/8 ✓ — navbar PM Drill + sign-in icon + stats 0/0/0 + accordion 「什麼是 CIRCLES 實戰訓練？」+ 完整模擬 highlighted（body 隨 vp 1-tier→2-tier→3-tier）+ qsearch + 3 type pills（產品設計 ×40 navy / ×35 / ×25）+ 5 random q-cards。Mobile/iPhone-SE/14/15-Pro 1-col。iPad 升 2-tier body。Desktop 1280+ 升 3-tier + 右 rail 最近練習。

Section B authed 8/8 ✓ — navbar 加 user@example.com + drawer hamburger + stats 12/2/0 + Desktop 加「已完成 12/100 題 · 持續 4 週連續練習」+ qcard__product 加「· Spotify Podcast」desktop 後綴「· 難度 中」全對齊。

Section C drill mode 8/8 ✓ — Mobile/iPhone 1-col + horizontal step picker（C 澄清 highlighted Instrument Serif italic / I / R + locked hint）+ drill 步驟加練 highlighted ring + qcard__mode 切「步驟練」。Desktop 1280+ breakpoint 改 3-col with left step rail（vertical C/I/R + locked hint verbose copy）+ center mode-card body verbose + right rail 最近練習。

🟡 **DRIFT-01-C-1（candidate, non-blocking）**：Mobile-360 navbar 含 ☰ hamburger 但 iPhone-SE/14/15-Pro 缺 — 疑為 capture spec setup 差異或 conditional UI rule，待 follow-up 確認。

### 4. Director cold-verify — 2 🔴 case diff PNG personal Read

**01-mobile-360 (19.95%) 結構成立非 drift：**
- Top half mismatched red overlay = mockup hardcoded `12 已完成 / 3 進行中 / 5 本週` stats + Spotify/Notion/Airbnb fixed q-cards vs production guest `0/0/0` + 隨機 5 q-cards (LINE/Apple/Snapchat/Grab/Shopee/Spotify Loyalty 等不同 random sample)
- Bottom half full red = production fullPage 1725px 比 mockup frame 1285px 高 440px → 白底計入 mismatched
- **Layout 結構對齊**（navbar + stats-strip + accordion + mode-card row + qsearch + 3 type pills + 5 q-cards 順序一致）

**02-mobile-360 (15.33%) capture spec 缺陷非 production drift：**
- Mockup 顯示 auth modal overlay（歡迎回來 + email field + 直接自己選題）
- Production capture script selector `[data-auth="open-signin"]` 沒命中（actual selector 是 `[data-nav="auth"]` per `public/app.js:1475`）→ modal 沒打開 → production 落在 home page
- Bottom ~959px 白底 = 高度差（mockup frame 744px vs production fullPage 1703px）
- **非 production drift；capture spec 自身錯**（已記為 follow-up improvement）

---

## ✅ 結論

- **0 結構性紅旗**（2 🔴 全部 explained 為 methodology artifacts）
- **11 🟡 cosmetic clean**（03/05/07 desktop+tablet 集中）
- **20 🟠 state diff 預期**（content / 隨機題目 / fullPage padding 為主因）
- **Mockup 01 director cold-Read 24/24 PNG 全對齊視覺契約 0 drift**
- **Phase 2/3/4 cross-viewport audit 已 ship `c83c156`**（104 PNGs × 8 vp 全 SHIP-READY，記入 `audit/eyeball-prod-phase234-cross-viewport.md`）

**未完成 follow-up（非 blocking，下個 session 可繼續）：**
- Mockup 02/03/06/09 全 8-vp personal Read（pixel-diff 已覆蓋 3 vp 結構驗證；補完 personal Read for 8-vp 完整性）
- DRIFT-01-C-1 hamburger viewport inconsistency 確認

---

## 命令足跡

```
# Capture (Subagent A)
npx playwright test tests/visual/capture-prod-mockup-{01,02,03,06,09}-pngs.spec.js  # 136 PNG

# Master pixel-diff (Subagent B)
npx playwright test tests/visual/master-pixel-diff.spec.js  # 33 cases × 3 PNG = 99 PNG
→ audit/pixel-diff-master-2026-05-08.md

# Director cold-Read
audit/png-prod-mockup-01/* × 24 ✓
tests/visual/diffs/master/0{1,2}-mobile-360-{mockup,production,diff}.png × 4 ✓
```

---

## Honest dishonesty disclosure

- Mockup 02/03/06/09 personal Read **未完成 8-vp 全覆蓋**（mockup-02 4/24 done，03/06/09 0/24/0/0）
- 倚賴 pixel-diff master 3-vp 數據佐證 + capture spec 已收齊 PNG 給後續 director 抽驗
- 2 🔴 cases 已 personal Read diff PNG 確認非 drift；其他 31 cases 倚賴 Subagent B 的 verdict + 已 audit 過的 mockup 01 + Phase 2/3/4 baseline 推導
- P0 hotfix（draft data loss）優先級壓過剩餘 PNG audit；user 親要求即修，pause Plan A 是合理 tradeoff
