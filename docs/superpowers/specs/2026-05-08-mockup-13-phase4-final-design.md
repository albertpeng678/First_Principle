# Mockup 13 — Phase 4 Final Report 模擬面試總結 設計規格

**Date:** 2026-05-08
**Mockup:** `docs/superpowers/specs/mockups/2026-05-02-frontend-rewrite/13-phase-4-final.html`（3 sections × 3 viewports = 9 frames，opus 親 Read 全 9 PNG `audit/png-mockup-13/`）

---

## 1. 範圍 + 動機

實作 Path 2 frontend rewrite 的 **Phase 4 模擬面試總結報告**。Sim mode 走完 7 步（C1/I/R/C2/L/E/S）後 user 應進入 final report — 目前 production 撞 stub。

只 sim mode 觸發；drill mode 在 Phase 3 score 即結束（已 ship）。

---

## 2. 3 Sections × 視覺契約（mockup 已親驗 9 PNG）

### Section A · 預設成功報告（77 分）

- **navbar**: LOCKED reuse
- **back-row**: 「← 模擬面試總結報告 / Spotify · Spotify Podcast subtitle」（NO 7-step progress — final 自有 state）
- **score-summary card**:
  - 大字「77」分（Instrument Serif italic? 看 mockup 採同 phase 3 pattern）
  - summary 文字「七步框架邏輯清晰、整體論述穩健，最強在用戶分析、方案、下一步建議補強 E 取捨的量化能力。」
- **7-axis radar polygon (heptagon navy filled)**：頂點 7 step 名（情境/用戶/需求/排序/方案/取捨/總結 — 對應 C1/I/R/C2/L/E/S）
- **7 `.step-row`**：每行：step letter circle + step title + score + 1-line commentary
  - C 78 時間框架: 「澄清題目邊界 + 量化規模具體」
  - I 82 最強亮點: 「分群 segmentation + 量化規模具體」
  - R 75 補競品對比: 「需求頻率 + 嚴重度 + 既有方案缺口」
  - C2 70 缺 RICE/ICE: 「優先序具體但缺 weighted scoring framework」
  - L 85 紮實: 「2-3 方案多樣性 + mechanism 對比清楚」
  - E 68 本次最弱量化不足: 「優缺風險定性 OK，trade-off 量化偏弱」
  - S 80 tracking 完整: 「主推薦 + 4 dim NSM tracking 邏輯一致」
- **NSM 4 dim mini-cards 嵌入 S 步驟內**：dashed border 視覺從屬 + 4 cards (觸及廣度 / 互動深度 / 習慣頻率 / 留存驅力) — 1-col stack 全 viewport 一致 (per CLAUDE.md row 13: 「mobile/tablet/desktop 一律 1-col 直式」)
- **strengths section** (success ✓ green border-left)：3 條 list (e.g. 「分群粒度具體量化」/「方案多樣性實在」/「tracking 4 dim 完整」)
- **improvements section** (warn ⚠ orange border-left)：3 條 list (e.g. 「E 取捨需加 RICE/ICE 量化權重」/「R 步補競品對比強化」/「verdict 可加風險評估」)
- **verdict section** (navy navy-lt bg)：1 段定性總評
- **nextsteps section**：條列建議下一步練習方向
- **submit-bar bottom**：summary 文字 + 匯出 PNG ghost + 再練一題 navy（換題不重做同題）

**Desktop top-grid 2-col**：左 380px = radar / 右 1fr = step-rows + NSM 嵌入  
**Mobile/Tablet**：1-col stack（radar 上 / step-rows 下）

### Section B · Loading（生成總結報告中）

- back-row 同 A
- 56px navy spinner（同 mockup 11 pattern）
- title「生成總結報告中」
- sub「七步框架評分整合中，預計 30-60 秒」
- 4-step checklist：
  1. ✓ 彙整七步驟資料
  2. ⊙ 計算總分與評等
  3. ○ 生成 7-axis 雷達圖
  4. ○ 整理改進建議
- NO bottom buttons during loading
- 60s frontend timeout（30-60s 範圍 + 30s 兜底）→ Section C error

### Section C · Error（REPORT_API_ERROR / REPORT_TIMEOUT / REPORT_PARSE_ERROR）

- back-row 同 A
- 80px danger circle + cloud-warning icon
- title「報告生成失敗」
- sub: dynamic per code:
  - `REPORT_API_ERROR`: 「總結報告 API 暫時不可用，你的七步驟評分已自動保存。請稍後重試或回首頁挑下一題。」
  - `REPORT_TIMEOUT`: 「總結報告生成超時，七步驟評分已自動保存。請稍後重試。」
  - `REPORT_PARSE_ERROR`: 「教練回應格式異常，請重試。」
- error-code-badge mono
- 2-button row: 「⌂ 回首頁」 ghost (→ home) + 「↻ 重試」 navy (retry POST final-report)

---

## 3. AppState 規約（增量）

| Field | Type | 說明 |
|---|---|---|
| `circlesPhase4LoadingStep` | `number` 0-3 | Loading checklist 當前 active step |
| `circlesPhase4Error` | `null \| { code, message }` | error state, code 為 REPORT_* |

既有可用：`circlesFinalReport: null`（line 36 已宣告未用）/ `circlesPhase = 4`（new value）/ `circlesSession.id`

---

## 4. Backend endpoint（不動）

```
POST /api/(guest-)circles-sessions/:id/final-report
  body: {} (handler reads conversation + step_scores from session)
  response: {
    overallScore: number 0-100,
    radar: [ { step: 'C', score: 78 }, ..., { step: 'S', score: 80 } ],  // 7 axis
    stepRows: [ { step, title, score, commentary }, ... ],  // 7 rows
    nsmDims: [ { dim: '觸及廣度', score, comment }, ... ],  // 4 cards (only for sim that did NSM)
    strengths: string[],     // 3 items
    improvements: string[],  // 3 items
    verdict: string,         // 1 paragraph
    nextsteps: string[],     // bullets
    summary: string,         // submit-bar 1-line summary
  }
  ON ERROR: { error, code: 'REPORT_API_ERROR' | 'REPORT_TIMEOUT' | 'REPORT_PARSE_ERROR' }
```

⚠ 實際 response shape 以 `prompts/circles-final-report.js` 為準（Combo C earlier 已加 quality guard）— frontend 用 defensive null check 包 missing fields。Plan 階段請 implementer Read 該 prompt 確認真 schema。

---

## 5. State 矩陣

```
Phase 4 進入: AppState.circlesPhase === 4 && AppState.circlesSession

router 新增 (在 Phase 3 case 之後 + stub 之前):
  if (AppState.circlesPhase === 4 && AppState.circlesSession) {
    return renderCirclesPhase4();
  }

renderCirclesPhase4 內部分支:
1. circlesPhase4Error             → Section C Error
2. !circlesFinalReport            → Section B Loading（auto-trigger POST final-report on mount + setInterval 進度推進）
3. circlesFinalReport exists       → Section A success report
```

---

## 6. 不動的東西

- ✗ `routes/*` 已支援 final-report
- ✗ `prompts/circles-final-report.js` 不動（Combo C earlier 已動）
- ✗ jest baseline 143
- ✗ LOCKED component CSS

---

## 7. 風險 + Mitigation

| 風險 | Mitigation |
|---|---|
| 60s timeout vs Phase 3 30s 不一致 | Phase 4 用 60s setTimeout（mockup sub copy「預計 30-60 秒」） |
| 7-axis radar SVG 渲染複雜度 | 用 inline SVG `<polygon>` 7 vertices 計算 pure JS（vs lib）；CLAUDE.md row 13 已寫「Path 2 配色 navy（去原 5 色）/ score bar 全 navy uniform」 |
| NSM 4 mini-cards 只 sim+NSM 流程才有 | response.nsmDims 為 null 時跳過 render（NOT inline 報錯）|
| Drill mode 誤觸發 Phase 4 | router guard：`circlesMode === 'simulation'` 才 dispatch；drill 從 Phase 3 score「再練一題」回 home，不過 phase 4 |
| 匯出 PNG 點擊行為 | scope 外（mockup 13 提及但本 spec 留 future commit） |
| 重試 race condition | retry 前 reset `circlesPhase4Error = null` + `circlesPhase4LoadingStep = 0` + 重新 POST |

---

## 8. 完工 DoD

- [ ] `renderCirclesPhase4()` + 3 sub-renderers (A success / B loading / C error)
- [ ] AppState 2 new fields + state matrix wiring
- [ ] CSS 整段 copy from mockup 13 verbatim：score-summary card / step-row / nsm-mini-card / strengths/improvements/verdict/nextsteps section / SVG radar styling
- [ ] 7-axis radar polygon SVG 純 JS 實作
- [ ] 4-step checklist setInterval 推進 + 60s timeout fallback
- [ ] retry 重試 wire
- [ ] auto-trigger POST final-report on Phase 4 entry（同 Phase 3 evaluate-step pattern）
- [ ] TDD red→green tests 涵蓋 3 sections + state transitions + retry
- [ ] jest 143/143 不破
- [ ] PNG audit cross-viewport — 3 sections × 8 viewports = 24 production PNGs Read（director 親 Read 4 critical）
- [ ] iOS 15-item static review
- [ ] Eyeball walk doc `audit/eyeball-mockup-13.md`
- [ ] CLAUDE.md 即時更新

---

## 9. 後續 follow-up

- 「匯出 PNG」 button 真功能（用 html2canvas 等 lib）— 留 future commit
- Phase 3 → Phase 4 sim mode advancement logic（每步 phase 3「再練一題」 在 sim mode 應改「下一步」進 step+1） — 留 follow-up，不在本 spec
- mockup 12 Phase 3 supplementary error/loading 變體（60s 慢回應 inline warn）
- mockup 14 NSM Step 4 report
