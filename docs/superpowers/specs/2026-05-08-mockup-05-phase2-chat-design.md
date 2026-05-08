# Mockup 05 — Phase 2 Chat 對話練習 設計規格

**Date:** 2026-05-08
**Branch:** `feat/path-2-circles-core`（Plan B 平行 worktree 或主 repo）
**Mockup:** `docs/superpowers/specs/mockups/2026-05-02-frontend-rewrite/05-phase-2-chat.html`（1953 行 / 6 sections × 3 viewports = 18 frames，已 opus 親 Read 全 18 PNG `audit/png-mockup-05/`）
**Master Spec：** `docs/superpowers/specs/2026-05-02-frontend-rewrite-master-spec.md`

---

## 1. 範圍

實作 Path 2 frontend rewrite 的 **Phase 2 對話練習（CIRCLES 7 步每步皆走）**。目前 production 為 stub `renderCirclesStub()`（`public/app.js:223`）— 完全空白。Phase 2 是 Plan B 之後最大未實作的 view。

每個 CIRCLES 步驟（C1/I/R/C2/L/E/S）進入 Phase 2：
- User 與「被訪談者」進行 5-10 輪對話（建議）
- 每輪：user 送出 → 被訪談者回應 + 教練點評 + 教練提示
- 達到 turns ≥ 3 後，user 可主動提交「對話足夠了」進入結論填寫
- 填結論 + AI conclusion-check + AI evaluate-step → 進 Phase 3 score

---

## 2. 6 Sections × 視覺契約（mockup 已親驗）

### Section A · 對話開頭（empty chat）

- **navbar**: 共用既有 LOCKED component（mockup 03 / 04 / 06 / 07 / 09 / 10 全 sync）
- **drill-pill 7 步 row**: 共用既有 `.drill-pill` rail（active 為當前 step；前面已通過 step ghost；後面 step 灰）
- **phase-head**: `.phase-head__num` Instrument Serif italic「2」+ eyebrow「PHASE 2 · 對話練習」+ title「{step letter} · {step name}」（例如「C · 澄清情境」）+ desktop 多 meta「建議 5-10 輪對話 · 隨時可暫停」
- **`.qchip__compact`**（折疊題目卡）: bookmark icon + 公司·產品（mobile 簡 / desktop 含 mode·type 後綴）+ title clamp + chevron right
- **icebreaker hint box**（灰底 `.bubble__section` 或新 class）: compass icon + bold title「開始提問方向」+ step-specific body 文案
- **chat-body** empty
- **bottom**: `.btn--ghost` 「← 上一步」（mobile only）+ `.chat-input-bar`（textarea + paper-plane navy send icon）

### Section B · 中段對話（normal flow）

- **navbar 加 turn-counter pill**: navy lt 圓 pill「N 輪」（右上 hamburger 對稱位置）
- **chat-body 3 種 bubble 交錯**:
  - `.bubble--user` 右對齊灰底
  - `.bubble--interviewee` 左對齊灰邊框 + `.bubble__section`「被訪談者」 label 上方
  - `.bubble--coach` 左對齊 navy left-border + `.bubble__section`「教練點評」 chat-dots icon + body + `.bubble--coach__hint-toggle`「查看教練提示 ›」
- **`.bubble--coach__hint-content`**（展開狀態）: 灰底 indent + 提示 body + 「收起教練提示 ▴」 toggle
- **desktop phase-head meta**: 「N 輪對話 · 已用 N 分鐘」+「建議 5-10 輪」

### Section C · Streaming AI（送出後等待回應）

- **chat-input bar**:
  - placeholder 改「等待回應中…」
  - send icon 變灰 disabled
- **被訪談者 bubble** 顯示 `.bubble__streaming` 3-dot animation（3 顆灰圓點 0.15s/0.3s 階梯延遲）
- **phase-head meta**: 「N 輪 · 等待回應中」（tablet）/「N 輪 · 已用 N 分鐘 · 等待被訪談者回應…」（desktop）
- streaming 結束（SSE `done:true`）→ delta concatenated text 解析成 interviewee+coaching+hint 3 段，replace 3-dot bubble 為實際 bubbles

### Section D · 對話足夠（turns ≥ 3 trigger）

- chat-input bar 仍可用（user 仍可繼續對話）
- chat-input bar **上方多一條 navy filled rounded pill**（居中，touch-min 44px）「對話足夠了，提交這個步驟 →」
- 點擊 → 進入 Section E（conclusion 展開填寫）
- desktop phase-head meta 「N 輪 · 已用 N 分鐘 · 邊界已釐清，可進結論」

### Section E · 結論展開填寫（sticky bottom overlay）

- **phase-head 副標 改「整理結論」**（原為「對話練習」）
- **chat-body dim 45% opacity + `pointer-events: none`** 讓 focus 集中
- **2px navy 頂線 divider** 上方（`.conclusion-box` 上方視覺分隔）
- **`.conclusion-box`**:
  - `.conclusion-box__title`「整理你這個步驟確認了什麼」
  - `.conclusion-box__sub` step-specific（C1：「說明問題範圍、時間框架、業務約束，以及你確認或待確認的假設。」+ desktop「建議 80-120 字。」）
  - `.conclusion-box__example`（默認 collapsed mobile / `.is-open` tablet+desktop）:
    - `.conclusion-box__example-head` + `.conclusion-box__example-label`「範例（不同題目）」+ `.conclusion-box__example-toggle`「展開 ▾」 ↔「收起 ▴」
    - `.conclusion-box__example-body` 灰底 example text
  - rt-field with toolbar (B / list / numbered / outdent — 4 buttons) + textarea placeholder「針對這題，整理你澄清的問題範圍、時間框架、業務約束，以及假設確認...」
- **`.conclusion-actions`** sticky bottom:
  - `.conclusion-actions__back`「← 繼續對話」 ghost left → 回 Section B/D
  - `.conclusion-actions__submit`「確認提交」 navy filled right + `.is-disabled`/`disabled` attr 當 textarea 空
- 點 確認提交 → POST `/conclusion-check` → 若 ok → POST `/evaluate-step` → 進 Phase 3 score
- 若 conclusion-check 回 warn/error → 顯 inline guidance（同 Phase 1.5 gate UX，TBD detail）

### Section F · 已評分唯讀（locked）

- **7-step pill row**: active step 跳到下一個 step（例如 C1 已評 → I 用戶 active）
- **phase-head 副標**: 「PHASE 2 · 對話練習（已評分）」
- **`.locked-banner`**（新 class，mockup line 621+）: lock icon + bold「此步驟已評分」+「對話保留供 review，無法繼續。」（desktop 多「— 想重練請從首頁選同類題目重新開始。」）
- chat-body 顯示歷史 bubble 不可編輯
- **NO chat-input** — bottom 改 2-button row:
  - 「← 上一步（看框架）」 ghost left → 回 Phase 1 form readonly
  - 「回評分」 navy filled right → 回 Phase 3 score view
- desktop phase-head meta「N 輪對話 · 已評分 · 當次得分 N」

---

## 3. AppState 規約（增量）

新增 fields（不破壞 jest）:

| Field | Type | 說明 |
|---|---|---|
| `circlesPhase2Streaming` | `boolean` | streaming active flag — drives Section C UI（disabled input + 3-dot bubble） |
| `circlesPhase2StreamingTurn` | `{ userMessage, deltaText }` | partial accumulator during stream |
| `circlesPhase2ConclusionMode` | `boolean` | true 時展開 Section E（dim chat + show conclusion-box） |
| `circlesPhase2ConclusionDraft` | `string` | conclusion textarea draft（autosave to localStorage 同 Phase 1） |
| `circlesPhase2ExampleOpen` | `boolean` | conclusion-box 範例展開 toggle |
| `circlesPhase2CoachHintExpanded` | `Record<turnIdx, boolean>` | 每輪 coach bubble 「查看教練提示」 toggle state |

既有可用 fields:
- `circlesConversation: []` — array of `{ userMessage, interviewee, coaching, hint }` 已宣告（line 28）
- `streamingActive: false` — 已宣告（line 98）但目前未用，可重用為 `circlesPhase2Streaming` 或保留與此並行
- `circlesSession.id` — for endpoint URL
- `circlesPhase = 2` — entry condition
- `circlesDrillStep` — 'C1' | 'I' | 'R' | 'C2' | 'L' | 'E' | 'S' for step-specific copy
- `circlesPhase1.locked` / step_scores — for Section F locked render

---

## 4. Backend endpoints（不動，純 frontend 接）

```
POST /api/(guest-)circles-sessions/:id/message
  body: { userMessage }
  response: SSE stream
    data: { delta: chunk }   ← repeated
    data: { done: true, turn: { userMessage, interviewee, coaching, hint } }   ← final
    OR data: { error: 'parse_failed', raw: '...' }
    OR data: { error: <message> }

POST /api/(guest-)circles-sessions/:id/conclusion-check
  body: { conclusionText }
  response: { ok, suggestion?, ... }   (TBD — 看 prompts/circles-coach 實際格式)

POST /api/(guest-)circles-sessions/:id/evaluate-step
  body: {} (handler 從 session 取 conclusion + conversation)
  response: { totalScore, dimensions, coachVersion, ... }

PATCH /api/(guest-)circles-sessions/:id/progress
  body: { currentPhase, ... }
  寫入後續 phase 切換時呼叫
```

**zh-TW 路徑下有效**：guest path 用 `requireGuestId` middleware；用 `AppState.accessToken` 是否存在切換 `/api/circles-sessions` ↔ `/api/guest-circles-sessions`（已有 prior art `app.js:2109` for stats）。

---

## 5. 5 Layer Combo C 守門（沿用）

**Layer 1 frontend minLength（重要）**:
- `userMessage` minLength 5 字元（避免「.」、「啊」這種 garbage 觸發 SSE）
- `conclusionText` minLength 30 字元（建議 80-120，符合 mockup line 1706 desktop sub copy）
- 不滿足 → send icon disabled + 「（至少 N 字）」 hint

**Layer 2 backend prompt**: `prompts/circles-coach.js` 加 `## 輸入品質檢查` 段（與 Combo C 5 prompts 一致，Path 2 carve-out 已 user 親准）。Phase 2 message 同樣會收到單字元 / 重複字元 / unicode garbage / 離題散文等 adversarial 輸入。

**Layer 3 adversarial sweep**: 新增 `tests/adversarial/circles-coach.spec.js`，10 cases × 1 stage = 10 cell。Sweep 在 ship 前必跑（standing rule `feedback_adversarial_review_testing.md`）。

⚠ **此規格 Combo C Layer 2/3 不在本 spec 範圍** — 留 follow-up commit。本 spec 只實作 Layer 1（minLength）+ render + SSE wire-up。

---

## 6. 不動的東西

- ✗ `routes/circles-sessions.js` / `routes/guest-circles-sessions.js` — 後端 100% 不動
- ✗ DB schema / migrations
- ✗ `prompts/circles-coach.js` — 不在本 spec 動（留給後續 Layer 2 commit）
- ✗ jest baseline 143 不破
- ✗ Mockup 03 LOCKED component CSS（navbar / phase-head / drill-pill / qchip__compact / btn / submit-bar pattern）— 整段 copy 不准重定義

---

## 7. State 矩陣（render switching）

```
Phase 2 進入條件: AppState.circlesPhase === 2 && AppState.circlesSession

render path 決定（in renderView 路由 + new function renderCirclesPhase2）:
1. AppState.circlesPhase1.locked === true             → Section F locked
2. AppState.circlesPhase2ConclusionMode === true      → Section E conclusion
3. AppState.circlesPhase2Streaming === true           → Section C streaming
4. AppState.circlesConversation.length === 0          → Section A empty / icebreaker
5. AppState.circlesConversation.length >= 3           → Section D（chat + submit pill）
6. otherwise                                          → Section B normal
```

---

## 8. 風險 + Mitigation

| 風險 | Mitigation |
|---|---|
| SSE 中斷（網路/timeout）| 後端無 resume → frontend 顯 inline error + 「重新發送」 button（mockup 16 §C 規約）。Partial response 覆蓋舊 turn |
| 多輪對話 bubble 滾動失焦 | render 後 `scrollIntoView({ block: 'end' })` `.chat-body` 最後一個 bubble |
| Streaming 期間 user 切其他 view | abort SSE + 保 partial conversation；切回 view=circles+phase=2 時不 auto-resume（要顯 「上次中斷」 inline 提示）|
| Mobile keyboard 推開 chat-input | viewport-fit=cover + safe-area-inset-bottom；input bar `position: fixed` 配 `interactive-widget=resizes-visual`（mockup `<meta>` 已聲明）|
| Conclusion 展開時 user 連點「← 繼續對話」失焦 | back button 不 reset draft（draft saved to localStorage） |
| Coach hint 多輪同時展開塞滿畫面 | 各輪獨立 toggle，不互鎖；user 自選展開 |
| iOS Safari 16-pt-or-less input zoom | `@media (max-width: 767px) input, textarea { font-size: 16px !important; }` 已 lock 在 mockup line 53 |

---

## 9. 完工 DoD

- [ ] `renderCirclesPhase2()` + 5 sub-renderers（A/B/C/D/E/F）
- [ ] SSE wire-up via `EventSource` 或 `fetch` + `ReadableStream`（看 production 已有 helper）
- [ ] AppState 6 new fields + persist via PATCH `/progress`
- [ ] CSS 整段 copy from mockup 05（line 240-660 chat-body / bubble / conclusion-box / locked-banner / chat-input-bar / .pill—conclude / chat-input--disabled / phase-head__meta-extra…）
- [ ] Layer 1 minLength: userMessage ≥ 5 / conclusionText ≥ 30
- [ ] TDD 紅綠 — `tests/visual/phase2-chat.spec.js` covers:
  - Section A render
  - Section B 3-bubble pattern
  - Section C streaming bubble + disabled send
  - Section D submit pill on turns ≥ 3
  - Section E conclusion-box + textarea + dim chat
  - Section F locked banner + 2-button row
  - SSE happy path + error fallback
  - back-from-conclusion preserves draft
- [ ] jest 143/143 不破
- [ ] PNG audit cross-viewport — 6 sections × 3 viewports = 18 PNGs Read（director 親 Read）
- [ ] iOS 15-item static review 全 PASS（chat-input keyboard / safe-area / streaming bubble layout / scroll）
- [ ] Eyeball walk doc `audit/eyeball-mockup-05.md`
- [ ] CLAUDE.md 即時更新
- [ ] User 親跑 SOP（dev server live port）

---

## 10. 後續 follow-up（不在本 spec）

- **Combo C Layer 2/3 for circles-coach**: 加 `## 輸入品質檢查` block + `tests/adversarial/circles-coach.spec.js`
- **conclusion-check warn/error UI**: mockup 05 沒明確示意 conclusion-check 失敗時 UX，留待 follow-up（可能 inline banner over conclusion-box）
- **SSE resume**: 目前後端無 resume，frontend 顯 inline error。後續 backend 加 resume 後再補 frontend
- **9 Mockup 04 transition drifts**（Task 21 carry-forward）+ DRIFT-07-1 / 10-1 / 10-2 — 與本 spec 平行，可 bundle 到下個 polish commit
