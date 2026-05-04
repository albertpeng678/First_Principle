# Eyeball Walk — Plan B SB5 · S 步 3+4 tracking (mockup 03 Section C)

**Date：** 2026-05-04
**Director：** opus 4.7 main agent (cold review)
**Implementer：** sonnet 4.6 subagent (commit bdbdf4a)
**Cold-review fix commit：** b81f8a1

---

## 自驗 PNG（director Read 三 viewport）

| Viewport | PNG | 評論 |
|---|---|---|
| Mobile-360 | `/tmp/cr-sb5-mobile-360.png` | navbar list+brand+(sign-in 因 guest)+home / progress 目前最後一格 active 但 mobile 360 撐不下 7 step（既存 SB3 overflow，SB4 已 carry forward）/ phase-head 07 / S · 總結推薦 / 已儲存 / qchip Spotify or Meta etc per random pick / 3 main fields rows 2/3/2 配 placeholder 對 mockup line 1494/1505/1516 / **rt-toolbar 1 button (ph-text-b only) — fix b81f8a1 對齊 mockup line 1493** / tracking-section 「追蹤指標 · 4 個維度」+ navy 24px ::before bar / 4 attention type tracking-cards: 觸及廣度（reach）/ 互動深度（depth）/ 習慣頻率（frequency）/ 留存驅力（impact）/ italic serif 22px navy nums 01-04 / inline hint-row「提示 · 範例答案」 / sub line + input placeholder / submit-bar 「完成 Phase 1 →」CTA fixed 底 |
| iPad-768 | `/tmp/cr-sb5-ipad-768.png` | navbar 加 tabs / progress 全 7 visible（C-S）/ phase-head__meta 「完整模擬 · 7/7 步」/ qchip dynamic question type detect e.g. Uber → transaction / rt-toolbar 2 buttons (B + bullets) / tracking-section sub line 動態「本題（transaction 型 / Travel）...」/ tracking-card heads 動態 「供給廣度 / 需求深度 / 匹配效率 / 復購留存」/ submit-bar 上一步 + 完成 Phase 1 |
| Desktop-1280 | `/tmp/cr-sb5-desktop-1280.png` | navbar 加 email + sign-out + home / phase-head__title suffix「（含 NSM 與 4 追蹤維度）」/ qchip__company suffix「· 設計題 · 難度 中」/ phase-body--with-rail 2-col grid / aside.rail「S 步重點 / 總結推薦 + NSM + 4 維度追蹤 / 推薦方案要可操作 NSM 必須含「行為門檻 + 為什麼能反映成效」/ hr / 產業類型動態 LABEL / 本題自動歸類為「{type 中文 e.g. transaction}型」— 4 維度 label 是上面那組。若題目改為 supply-demand / creator-content / B2B SaaS, label 會切換對應術語（master-spec §2.5）」對應 mockup line 1734-1742 |

---

## Cold-review drift 表（已修）

| # | Drift | mockup 出處 | 修正 commit |
|---|---|---|---|
| D1 | mobile S step rt-toolbar 應 1 button (ph-text-b only) — production 顯示 2 (B + bullets) | line 1493 | b81f8a1 |

備註：tablet/desktop 2 button 是 mockup 規範（line 1581/1670）— 不需修。

## 非 SB5 scope drift（記入 carry forward）

- **subs always show attention default for non-attention types** — plan 明說「其他 type 暫用 attention default — implementer 不必補」。SB6 之後可補完（per mockup 註解）
- **rail body 2 type word** — production 用「transaction 型」(internal code) 與 mockup「attention 型」內聯英文一致；sub line 用相同格式 ✓

---

## boundingBox invariant（5 條）

1. **tracking-section__head**：navy 24px×2px ::before bar + h3 navy text（mockup line 615-624）— PASS
2. **tracking-card grid**：grid-template-columns 36px 1fr / num grid-row 1/span 3 — PASS
3. **tracking-card__num**：italic 22px serif navy（line 641-647）— PASS
4. **tracking-card input**：border `--c-rule-bold` + radius `--r-input` + bg `--c-card`（line 656-664）— PASS
5. **submit-bar CTA**：`完成 Phase 1` 字串而非「下一步」（line 1559/1647/1747）— PASS

---

## Tests / Quality Gates

- jest：157 (140 + 17 skip) ✓ 不 regression
- Playwright `phase1-s-step.spec.js`：8 specs × 8 viewport = 64/64 ✓
- 三 viewport regression：phase1-s-step + phase1-l-step + phase1-form + circles-home × 3 vp = 123/123 ✓

---

## Self-review checklist（Layer 1-7）

- [x] L1 baseline — mockup 03 Section C line 1469-1758 為視覺契約
- [x] L2 pixel-diff — 補洞跑 mechanical pixel-diff（mockup vp-frame__body clip-based 截圖 vs production fullPage screenshot pad+pixelmatch threshold 0.1）：mobile 7.21% / tablet 4.91% / desktop 4.01%（state diff 預期範圍 3-15%）；diff PNG 確認 red 集中在 navbar 登入態 / textarea filled vs placeholder / qchip 動態題目 / 4 dim heads (attention vs transaction/saas/creator detected) / rail body 2 type substitution，無結構錯位。Report：`audit/sb4-sb5-pixel-diff-report.md`
- [x] L3 boundingBox invariant — 5 條 PASS
- [x] L4 WebKit + Chromium — phase1-s-step 全 8 viewport 含 webkit 通
- [x] L5 state matrix — default empty / dynamic type detection 三 type 各驗一張（attention/transaction/saas 視 random pick；creator 未 cover）
- [x] L6 director eyeball — 本檔 ✓
- [ ] L7 user 真機抽驗 — user 接 main 後手動驗
