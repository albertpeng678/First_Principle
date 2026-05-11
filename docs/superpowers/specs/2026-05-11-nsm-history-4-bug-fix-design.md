# NSM History 4-Bug Fix — Design

**Date:** 2026-05-11
**Status:** Spec — awaiting user review
**User authorization:** Backend carve-out granted（只動 NSM list/stats API，不碰 prompts/DB schema/jest）

---

## Goal

修 user 實機回報的 4 個 NSM history bug：

1. **Bug 1**：點 NSM 紀錄落地頁變選題頁（應該回到上次停下來的步驟 / 已評分的看報告）
2. **Bug 2**：點開的紀錄欄位空白（user 之前的定義 / 拆解內容沒回來）
3. **Bug 3**：在 Step 2/3 form 按「上一步」會回到 Step 1 選題頁（等於選的題目作廢）
4. **Bug 4**：4 筆紀錄首頁只算到 2 筆（NSM 那 2 筆完全沒被計入 stats）

---

## Architecture decisions

| 決定 | 理由 |
|---|---|
| Bug 1 用「智能落地」routing（有 score → Step 4 / 有 breakdown → Step 3 / 有 nsm → Step 2 / else → Step 1）| User Q2=A — 對應 mockup 09 §I-296 spec + matches user mental model |
| Bug 2 直接在 list endpoint SELECT 加 `user_nsm, user_breakdown` 兩欄 | 最小改動、不動 DB schema、`UPDATE` write 端已正確（line 83）、只是 read 端漏 |
| Bug 3 改 back handler routing：Step 3 back → Step 2；Step 2 back → home（不是 Step 1 選題頁）| 避免「選的題目作廢」問題 + Step 1 沒有 back button 維持現狀 |
| Bug 4 NSM home 加同款 stats strip（前端 mirror CIRCLES 排版）+ 後端新增 `/api/nsm-stats` endpoint（CIRCLES 一致 pattern）| CIRCLES + NSM 兩邊各算各的（user 確認）= 不混合 |

---

## File-by-file change list

### 後端（carve-out 准）

**新檔** — `routes/nsm-stats.js`（auth）+ `routes/guest-nsm-stats.js`（guest）：
- `GET /api/nsm-stats` 回 `{ completed, active, thisWeek }`
- SQL：count `nsm_sessions` group by status；`thisWeek` filter `created_at >= now() - 7 days`
- mirror `routes/circles-stats.js` 結構（如果存在）

**修改** — `routes/nsm-sessions.js:30`（auth list endpoint）：
```diff
- .select('id, question_id, question_json, status, scores_json, created_at')
+ .select('id, question_id, question_json, status, scores_json, user_nsm, user_breakdown, created_at')
```

**修改** — `routes/guest-nsm-sessions.js:30`（guest list endpoint）：同上 diff。

**註冊** — `index.js`（或 server entry）把 nsm-stats route mount 上。

### 前端

**修改** — `public/app.js:7539-7542`（NSM restore handler）：智能 routing 取代硬寫 `nsmStep=1`：
```javascript
// 取代 AppState.nsmStep = 1
if (item.scores_json && Object.keys(item.scores_json).length) {
  AppState.nsmStep = 4;
} else if (item.user_breakdown && Object.values(item.user_breakdown).some(v => v && String(v).trim())) {
  AppState.nsmStep = 3;
} else if (item.user_nsm && item.user_nsm.nsm && String(item.user_nsm.nsm).trim()) {
  AppState.nsmStep = 2;
} else {
  AppState.nsmStep = 1;
}
```

**修改** — `public/app.js:1808-1814`（Step 2/3 back handler）：根據當前 step 決定目標：
```javascript
// 取代「nsmStep -> 1」
if (AppState.nsmStep === 3) {
  AppState.nsmStep = 2;        // Step 3 back → Step 2
} else if (AppState.nsmStep === 2) {
  AppState.view = 'circles';   // Step 2 back → home，不回選題頁
  AppState.nsmStep = 1;        // reset for next time
}
```

**修改** — `public/app.js` NSM home render（找 Step 1 question selection 區塊上方）：注入 stats strip。
- Reuse CIRCLES 那條 strip 的 HTML/CSS class（locked component）
- AJAX fetch `/api/nsm-stats` 或 `/api/guest-nsm-stats` 依 auth state
- Cache 同 CIRCLES stats pattern

**修改** — `public/app.js` NSM list 接收 handler（hydration 處）：把 list 回來的 `user_nsm` / `user_breakdown` 寫進 `AppState.nsmDefinition` / `AppState.nsmBreakdown`（不依賴 detail fetch）。

---

## Testing strategy（TDD discipline — RED → GREEN）

### Red tests（先寫，必須先看到失敗）

**`tests/visual/nsm-restore-routing.spec.js`**（新）：
1. fixture：scored session（has `scores_json`） → 點 → assert lands Step 4
2. fixture：breakdown-only session → 點 → assert lands Step 3
3. fixture：nsm-only session → 點 → assert lands Step 2
4. fixture：empty session → 點 → assert lands Step 1

**`tests/visual/nsm-back-button.spec.js`**（新）：
1. setup Step 3 → click back → assert Step 2
2. setup Step 2 with nsmDefinition filled → click back → assert `view='circles'`（home）
3. setup Step 2 → click back → assert nsmSelectedQuestion 保留（沒清掉）

**`tests/visual/nsm-list-payload.spec.js`**（新）：
1. mock list response with `user_nsm` + `user_breakdown` → restore → assert form fields populated

**`tests/visual/nsm-home-stats.spec.js`**（新）：
1. mock `/api/nsm-stats` returning `{completed:2, active:0, thisWeek:1}` → assert strip renders "已完成 2 · 進行中 0 · 本週 1"
2. assert 3 vp 排版（mobile 360 / iPad / Desktop 1280）

### Green criteria

- 上述新 spec 全 pass
- 既存 jest 197/214 (17 skipped) 不 regression
- 既存 Playwright master pixel-diff 不增 🔴
- iOS Safari 15-item static review 走完

### Visual verification

- Director cold-Read 全新 capture PNG（× 3 vp）
- Cross-vp consistency check
- Eyeball walk doc：`audit/eyeball-nsm-4-bug-fix-2026-05-11.md`

---

## Standing rule compliance check

| Rule | Status |
|---|---|
| #1 後端不動 | ✗ → ✓ carve-out（user 已准） |
| #2 mockup 三 vp 對齊 | ✓ NSM home stats strip mirror CIRCLES locked component |
| #3 zh-TW / 無 emoji / ph-* icons | ✓ |
| #4 PNG 親 Read | ✓ TDD + cold-Read |
| #5 iOS 15-item | ✓ 必跑（Step 2 back 改 nav 為 mobile UX 影響） |
| #6 pitch-ready 1px | ✓ stats strip 複用 CIRCLES locked component |
| #7 設計前驗產品 | ✓ 已 explore + Playwright login + 4 PNG cold-Read |
| #8 Karpathy 4 條 | implementer dispatch 必 prepend |

---

## Out of scope

- DB schema 不動（user_nsm / user_breakdown 欄位已存在）
- prompts 不動
- OpenAI API 不動
- jest 17 skipped 不動
- mockup 內容不動（只 reuse CSS class）
- CIRCLES 那邊 stats 邏輯不動
- NSM Step 4 內容 render 不動
- Phase 1.5 Gate 邏輯不動
- ⚠️ Stream B（NSM 全流程 exhaustive scan）發現的 additional bug 不在本 spec 範圍，等 audit doc 出來再決定後續

---

## Risks

| Risk | Mitigation |
|---|---|
| Bug 1 智能 routing 邊界 case（`scores_json` 空物件 vs null） | TDD case 1 + 4 涵蓋；`Object.keys().length` check |
| Bug 2 backend SELECT 改動可能漏掉某些 frontend 解碼路徑 | Restore handler 同步加 hydration（兩道防線） |
| Bug 3 home redirect 可能與 user 一個既存「想留在 NSM tab」期望衝突 | toast 提示「草稿已自動保存」；fallback：可在 spec 補一個「Step 2 back 顯示確認 dialog」變體（如 user 喜歡） |
| Bug 4 新 endpoint `nsm-stats` 上 production 後 cache invalidation | 同 CIRCLES stats pattern — 每次 NSM session POST/UPDATE 後 invalidate frontend cache |

---

## Karpathy 4 條（implementer dispatch 必 prepend）

1. **Think Before**：先確認 root cause 是 list endpoint 漏欄位（已 verify），不是 hydration race
2. **Simplicity First**：4 bug 各 1 個 surgical 修改點，不重構整個 restore flow
3. **Surgical Changes**：每 bug ≤ 20 行 diff；不順手「也順便」改別的
4. **Goal-Driven**：success = user 點任一筆紀錄看到正確的步驟 + 自己填的內容回來 + NSM home 顯示 stats + Step 2/3 back 不擾人

---

## Next step

1. User review 此 spec doc → 放行
2. 我 invoke `superpowers:writing-plans` 把 spec 拆成 bite-sized TDD 任務
3. 拆好 plan 後 invoke `superpowers:subagent-driven-development` 派 implementer subagent 逐 task 修 + 兩階段 review（spec compliance + code quality）
4. 全 task 修完跑 full SIT/UAT/UI-UX × 8 vp，director cold-Read PNG
5. 與 Stream B audit 結果合併評估後續
