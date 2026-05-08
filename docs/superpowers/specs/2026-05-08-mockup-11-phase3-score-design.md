# Mockup 11 — Phase 3 Score 評分結果 設計規格

**Date:** 2026-05-08
**Mockup:** `docs/superpowers/specs/mockups/2026-05-02-frontend-rewrite/11-phase-3-score.html`（4 sections × 3 viewports = 12 frames，opus 親 Read 全 12 PNG `audit/png-mockup-11/`）
**Master Spec：** `docs/superpowers/specs/2026-05-02-frontend-rewrite-master-spec.md`

---

## 1. 範圍 + 動機

實作 Path 2 frontend rewrite 的 **Phase 3 步驟分數**。Phase 2 對話練習剛 ship（commit `4786f3a..5710754`），user 送出結論後 `circlesPhase=3` 卻撞 stub `renderCirclesStub()`（`public/app.js:215`）— 這是 user-facing 流程的直接 blocker。

每個 CIRCLES 步驟（C1/I/R/C2/L/E/S）在 Phase 2 conclusion 送出後進入 Phase 3：
- 顯 step 得分（如 78、52）+ 4 dim 細評（清晰度 / 邏輯性 / 完整度 / 洞察力）
- 含教練示範答案（multi-section）
- Loading / Error 狀態完整覆蓋 30 秒 timeout 內 UX

---

## 2. 4 Sections × 視覺契約（mockup 已親驗 12 PNG）

### Section A · 預設狀態（drill 模式 I 步驟完成 78 分）

- **navbar**: LOCKED component reuse（mockup 03+）
- **back-row**: `<button class="back-row">← 用戶分析 評分結果 / Spotify · Spotify Podcast subtitle</button>` — 點 ← 回 Phase 1 form readonly
- **7-step progress**: same `.drill-pill` rail pattern；當前 step 為 active outline + 已通過 step 為 done navy filled + 未來 step grey
- **`.score-card`**: large `.score-card__num` Instrument Serif italic「78」+ `.score-card__sub`「I — 用戶分析 步驟得分」
- **4 `.dim-row`**:
  - mobile/tablet: collapsed — title + progress-bar + score N/5 + chevron-right
  - desktop: 全展開 inline — body comment + 教練版本 block + 「進一步：補一句…」suggestion
  - 4 dims: 清晰度 / 邏輯性 / 完整度 / 洞察力（fixed names per existing CIRCLES rubric）
- **2-col `.highlights`**:
  - `.highlight--strong` (success ✓ green border-left)「最強表現」+ body
  - `.highlight--weak` (warn ⚠ orange border-left)「最需改進」+ body
- **`.coach-demo`** accordion (collapsed by default in Section A)：graduation-cap icon + 「教練示範答案」+ chevron right
- **bottom 2-button row**: 回首頁 ghost left + 再練一題 navy right

### Section B · 低分維度自動展開（52 分 + 邏輯性 1/5 自動展開 + 教練示範 全展開）

- 同 Section A 結構，差異：
- **score**: 52（Instrument Serif italic）
- **highlights**: 「識別了「30 歲女性」這個明確分群，命名清楚不模糊」/ 「缺少「為什麼選這群」的論述邏輯與量化依據，這是邏輯性低分主因。」
- **`.coach-demo` 全展開**（`.is-open`）+ multi-section content：
  1. 候選分群 — 列出 4 個分群（付費 / 免費 / 新註冊未養成 / 既有但流失）
  2. 焦點分群 — 「新註冊但 30 天內未養成日常收聽習慣的免費用戶」
  3. 選擇理由 — 商業重要 + 可解性
  4. 用戶動機假設 — 「假設「用戶想要每日通勤時段的背景音」」+ 可被驗證 / 數據驗證
- **99 為什麼這樣** reasoning section（lightbulb icon + body 解釋分群必須附量化規模 / 商業重要性，否則只是描述...）
- **dim-row 自動展開規則**：分數 ≤ 2 → `.is-open`（auto-expand）— 此 case 邏輯性 1/5 自動展開 inline body + 教練版本 + 進一步
- 其他 dim（清晰度 3 / 完整度 3 / 洞察力 3） — collapsed（mobile/tablet）/ expanded（desktop 仍依 viewport rule 全開）

### Section C · Loading 評分中（POST evaluate-step in flight）

- 全頁 centered:
- **56px navy spinner** (`.score-loading-spinner` — circular outline animation)
- title「正在生成評分」
- sub「AI 正在評估你的回答，需要約 5-10 秒。請勿關閉本頁。」
- **4-step checklist** `.score-loading-step` (4 items):
  1. ✓ 解析框架 (done — green check icon)
  2. ⊙ 計算分數 (active — small navy spinning ring)
  3. ○ 生成示範答案 (pending — grey empty circle)
  4. ○ 整理建議 (pending — grey empty circle)
- 步驟順序自動推進（依 timer：< 5s → step 1, 5-10s → step 2, 10-15s → step 3, 15-30s → step 4）
- 15s slow toast / 內部 30s timeout → 進 Section D Error
- NO bottom buttons during loading

### Section D · Error 評分生成失敗（EVAL_TIMEOUT / EVAL_API_ERROR / EVAL_PARSE_ERROR）

- 全頁 centered:
- **80px danger circle bg**（red lt） + cloud-warning icon `ph ph-cloud-warning` (red filled)
- title「評分生成失敗」
- sub: dynamic per error code:
  - `EVAL_TIMEOUT`: 「AI 服務暫時無法回應，請稍後再試。你的答案已自動保存。」
  - `EVAL_API_ERROR`: 「評分服務暫時不可用，請稍後再試。你的答案已自動保存。」
  - `EVAL_PARSE_ERROR`: 「教練回應格式異常，請重試。」
- **error code badge** mono-font `<span class="error-code-badge">EVAL_TIMEOUT</span>` (灰底 lt + 等寬字)
- **2-button row**: 「← 返回修改答案」 ghost left（→ Phase 1 form 同 step） + 「↻ 重新評分」 navy right（→ retry POST evaluate-step）

---

## 3. AppState 規約（增量）

新增 fields:

| Field | Type | 說明 |
|---|---|---|
| `circlesPhase3LoadingStep` | `number` | 0-3，Loading checklist 當前 active step |
| `circlesPhase3Error` | `null \| { code: string, message: string }` | error state，code 為 EVAL_*  |
| `circlesPhase3DimExpanded` | `Record<dimKey, boolean>` | 用戶手動展開 dim row |
| `circlesPhase3CoachDemoOpen` | `boolean` | coach-demo accordion 用戶手動展開 |

既有可用:
- `circlesScoreResult: null` — set after evaluate-step response（Phase 2 SB-B 已實作，line 3825）
- `circlesPhase = 3` — entry
- `circlesDrillStep` — current step letter
- `circlesSelectedQuestion` — for company / product subtitle

---

## 4. Backend endpoint（不動，純 frontend 接）

```
POST /api/(guest-)circles-sessions/:id/evaluate-step
  body: {} (handler reads conclusion + conversation from session)
  response: {
    totalScore: number (0-100),
    dimensions: [
      { name: '清晰度', score: 4, comment: '...', coachVersion: { ... }, suggestion: '...' },
      ...
    ],
    coachVersion: {
      context: string,         // section 1: 為什麼這個分群重要
      perField: array,         // section 2: 候選分群 / 焦點分群 / 選擇理由 / 用戶動機假設
      reasoning: string,       // section 3: 99 為什麼這樣
    },
    strengths: string,         // 最強表現 body
    improvements: string,      // 最需改進 body
  }
  ON ERROR: { error: string, code: 'EVAL_TIMEOUT' | 'EVAL_API_ERROR' | 'EVAL_PARSE_ERROR' | 'EVAL_AUTH_ERROR' }
```

Phase 2 SB-B 已串接此 endpoint。Phase 3 view 純讀 `AppState.circlesScoreResult`。

---

## 5. State 矩陣（render switching）

```
Phase 3 進入: AppState.circlesPhase === 3 && AppState.circlesSession

render path 決定（in renderView 路由 + new function renderCirclesPhase3）:
1. AppState.circlesPhase3Error             → Section D Error
2. !AppState.circlesScoreResult            → Section C Loading（waiting for evaluate-step）
3. AppState.circlesScoreResult exists      → Section A or B（同模板，B 是「資料 driven」變體不需 mode switch）
```

注意 Section A vs B：純資料驅動，不需 mode flag。Section A = 高分（all dim ≥ 3）`coachDemo` collapsed by default；Section B = 任 dim ≤ 2 → `coachDemo` auto-open + 該 dim auto-expand。Same renderer。

---

## 6. 不動的東西

- ✗ `routes/*` 已支援 evaluate-step + 已 Phase 2 SB-B 串接，Phase 3 純 frontend
- ✗ `prompts/circles-evaluator.js` 不動
- ✗ `lib/evaluate-step-handler.js` 不動
- ✗ jest baseline 143 不破
- ✗ Mockup LOCKED component CSS 不准重定義

---

## 7. 風險 + Mitigation

| 風險 | Mitigation |
|---|---|
| Loading 卡 30s 後仍未 timeout | frontend 自帶 30s `setTimeout` 兜底，過期 set `circlesPhase3Error = { code: 'EVAL_TIMEOUT', message: ... }` |
| 後端 response 缺欄位（如 dimensions undefined）| renderer 加 defensive null check：`(circlesScoreResult.dimensions || []).map(...)` |
| coach-demo perField 結構 drift | helper guard：`isValidEvaluatorResult` 已在 lib 端 throw EVAL_PARSE_ERROR；frontend 顯 error UI |
| 重新評分 retry race condition | retry 前 reset `circlesPhase3Error = null` + `circlesPhase3LoadingStep = 0` |
| 4-step checklist 進度 UX 模擬 | 用 `setInterval` 每 5s 推進 step（純視覺，不影響真實 API timing）|
| dim ≤ 2 auto-expand override 用戶手動 collapse | manual collapse 後優先 user state，但首次 render 自動套規則（`circlesPhase3DimExpanded[dim]` undefined → 用 auto rule） |

---

## 8. 完工 DoD

- [ ] `renderCirclesPhase3()` + 4 sub-renderers（Default / Loading / Error / 內部 dim-row × 4）
- [ ] AppState 4 new fields + state matrix wiring
- [ ] CSS 整段 copy from mockup 11（line ~120-460 — score-card / dim-row / highlights / coach-demo / score-loading-* / error-circle / error-code-badge）verbatim
- [ ] 4-step checklist setInterval 推進
- [ ] 30s frontend timeout fallback
- [ ] retry 重新評分 wire
- [ ] dim ≤ 2 auto-expand rule
- [ ] TDD red→green tests covering 4 sections + state transitions
- [ ] jest 143/143 不破
- [ ] PNG audit cross-viewport — 4 sections × 8 viewports = 32 production PNGs Read（director 親 Read）
- [ ] iOS 15-item static review
- [ ] Eyeball walk doc `audit/eyeball-mockup-11.md`
- [ ] CLAUDE.md 即時更新

---

## 9. 後續 follow-up（不在本 spec）

- Phase 3 Section B 教練示範答案的 inline `99 為什麼這樣` reasoning section（mockup line ~1067-1170）— 嵌在 coach-demo 內，純 multi-section 結構，本 spec 已涵蓋
- Phase 4 final report (mockup 13) — 7 步全跑完總結，下個 sub-bundle
- Mockup 12 Phase 3 error/loading 補充變體（如 60s slow inline warn）— 可獨立 commit
