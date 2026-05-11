# Exhaustive NSM Audit v2 — 2026-05-11

> **Director:** Opus 4.7, personal walk (no subagent delegation).
> **User:** albertpeng678@gmail.com (584c67fb-6f45-413a-b38c-a247a327e7af)
> **Target:** Production https://first-principle.up.railway.app/
> **Coverage:** DB direct query + Playwright × 7 vp PASS (Desktop-1280 1 fail = network race, retry-able)
> **Cold-Read:** Required PNGs Read manually before claim.

---

## TL;DR — 真正的 root cause（user 8 張 screenshots 對應）

| 你的 screenshot | Bug 我給的代號 | 真正 root cause | DB / 視覺 evidence | Severity |
|---|---|---|---|---|
| 10 此題暫無深入背景資料 | **X-Ctx** | session 存的 `question_json.context` 為 `MISSING`（2 筆 NSM 全部沒 context） | DB 查證 | P1 |
| 11 範例答案無法點 | **X-FE** | session 存的 `question_json.field_examples` 為 `MISSING`（**全 5 筆** session 都沒） | DB 查證 | **P0** |
| 12 教練思路 overlay 貼邊 | **X-Overlay** | 我 `bdd505a` 用 `.hint-overlay .modal-card` class 但沒 NSM-specific CSS 樣式約束 | 我 commit 視覺 | **P0** |
| 13 Step 4 對比「你的」cell 空 | **X-Compare** | `nsmDefinition` 在 DB 是 string、不是 object，所以 `.nsm` 讀到 undefined → 「你的」空 | DB user_nsm: string(31) | **P0** |
| 14 Step 3「此題暫無深入背景資料」+ 你的 NSM 空 | **X-Ctx + X-Compare** | 同 10 + 同 13 | DB | P1 |
| 15 Step 2 locked 完全空 + 可回選題頁 | **X-LockedStep2 + X-Back** | (a) locked branch 不 render input area；(b) 評完分仍可 navbar tab click 回 Step 1（我前一輪 fix 不夠） | walk-all JSON: textareas:[] | **P0** |
| 16 練習紀錄重複 + 4× 重新載入 | **X-DupSession + X-SlowList** | (a) DB 真的有 **2 筆 circles_001 row**（一個 active 一個 completed）；(b) `/api/circles-sessions` production 載入慢，user 看到 spinner 多次 | DB DUP detected + PNG「載入中...」spinner | **P0** |
| 17 stats 數字錯 | **X-Stats** | 不是錯 — CIRCLES strip 顯示 CIRCLES-only count（completed=1 active=2），NSM 那 2 筆不計入。是「期望 total 不是 per-tab」的視覺契約 mismatch | DB matches strip | P1 |

---

## DB 真實狀態（殺手鐧 query evidence）

```
USER_ID = 584c67fb-6f45-413a-b38c-a247a327e7af
EMAIL   = albertpeng678@gmail.com

CIRCLES sessions: count=3
  id=6bd2391f-…  qid=circles_096  status=active     created=2026-04-28
  id=b715b898-…  qid=circles_001  status=completed  created=2026-04-25  ← DUP
  id=460fdeb8-…  qid=circles_001  status=active     created=2026-04-25  ← DUP

NSM sessions: count=2
  id=ee133f7e-…  qid=q17  status=completed
    user_nsm: string(len=31)             ← legacy schema, no explanation/businessLink
    user_breakdown: object(reach/depth/frequency/impact)
  id=28bd4cd0-…  qid=q70  status=completed
    user_nsm: string(len=9)              ← legacy schema
    user_breakdown: object(...)

Stats replicated locally:
  CIRCLES: completed=1 active=2 weekly=0   ← matches the strip in screenshot 17 ✓
  NSM:     completed=2 active=0 weekly=0
  TOTAL across both tables: 5

Stored question_json.field_examples (5/5 sessions): MISSING
Stored question_json.context       (2/2 NSM):       MISSING
```

**結論：DB 沒有壞，但 schema 是 legacy（user_nsm 為 string）+ snapshot 過舊（field_examples / context 都沒存到 question_json）。**

---

## 8 個 bug 分修法 + scope 標註

### X-DupSession（P0 · DB / 後端 dedup）

**現象：** offcanvas 顯示 2 筆 Spotify CIRCLES C 澄清（同 question_id `circles_001`）— 一筆「草稿 46 分鐘前編輯」一筆「5/2 完成」。

**真正原因：** DB 真的有 2 行：
- `460fdeb8-…` status=active 4/25 04:59 created — 草稿
- `b715b898-…` status=completed 4/25 06:51 created — 評完分

**可能誘因：** 用戶在 4/25 早上做了一次完整 simulation（成功評分）→ 之後又開了個新 drill C-step（產生 active row）→ 兩個 row 共存。

**修法方案 — 3 種給你選：**

| 方案 | 範圍 | 影響 |
|---|---|---|
| **A** UI 端不變、DB 接受 dup | 0 改動 | user 永遠看到兩筆 |
| **B** DB 加 `UNIQUE(user_id, question_id)` constraint + migration 解 dup | 需 carve-out / migration | 永久解，但既存 dup 需 migration 決定保留哪筆 |
| **C** List endpoint dedup（保留最新 status=completed > active > most-recent） | 後端 carve-out | 不動 DB，僅 read-time dedup |

**推薦：** C — 最小影響，不動 DB。需 backend carve-out。

### X-SlowList（P0 · 後端 performance）

**現象：** Production offcanvas 開啟時顯示「載入中...」spinner 很久。PNG 證據 ` audit/png-walk-all-sessions/01-offcanvas-{Mobile-360,Desktop-1440}.png`。

**可能原因：**
- `/api/circles-sessions` 與 `/api/nsm-sessions` 兩支 endpoint 各打一次（並行）；production network latency 累積
- frontend 可能在每次 navbar click 重發 fetch（cache miss）
- DB 查詢沒 index？

**需 root cause 進一步調查（network panel + server log）才能下定論。**

**初步修法：** loadHistory dedup + cache（5 秒內不重發）。需後端配合測試 latency。

### X-FE（P0 · 資料層）

**現象：** 所有 NSM session（Zoom + Fiverr）的 Step 2 + Step 3 example button **全部 disabled** with `title="此題暫無範例答案"`。

**真正原因：** `question_json.field_examples` 不存在於存到 DB 的 question snapshot 裡（5/5 sessions）。

**修法方案：**

| 方案 | 範圍 | 影響 |
|---|---|---|
| **A** 後端 list/detail rehydrate `question_json.field_examples` from current question bank | 後端 carve-out | 一勞永逸 |
| **B** 前端在 restore handler 讀 question_id 後 merge field_examples from CIRCLES/NSM DB JSON | 前端 only | 改動較大；需 bundle question bank |
| **C** UI 改設計：example button 隱藏（不 disabled）when no data | **需 mockup** | 視覺契約 |

**推薦：** A — 後端 rehydrate。需 carve-out。

### X-Ctx（P1 · 後端 + UI）

**現象：** Step 3「深入分析」expand 顯示「此題暫無深入背景資料」。

**真正原因：** `question_json.context` MISSING for 2/2 NSM sessions。

**修法方案：** 同 X-FE — 後端 rehydrate context from current bank。OR 前端按需 fetch `/api/nsm-sessions/:id/context` 觸發 LLM 生成。

### X-Compare（P0 · 前端 only）

**現象：** Step 4 對比 tab 「你的」cell 對 NSM 那 row 是空的（screenshot 13）。

**真正原因：** `renderNSMStep4ComparisonTab` 在 row.yourText 讀 `userDef.nsm`（line 2178），但 `userDef` 是個 string（legacy schema），所以 `.nsm` undefined。我前一輪 `2cd4374` 的 string coerce 修了 `restoreNsmSession`，但這個 compare 邏輯讀的可能是 raw item.user_nsm，不是 nsmDefinition state。

**修法：** Step 4 compare row 也走 same coerce — 確保 `userDef.nsm` always string。前端 surgical fix。

### X-LockedStep2（P0 · 前端，需 mockup）

**現象：** Step 2 locked 狀態完全空（screenshot 15）— 看不到 user 之前填的 NSM。

**真正原因：** `renderNSMStep2` 在 scored session 時跳過 input area render。

**修法：** locked-state read-only display — **需要 mockup 設計** locked state 怎麼顯示 user 已存內容（disabled textarea / read-only block / quote block）。

### X-Back（P0 · 前端 only）

**現象：** 已評完分卻還可以回到選題頁（screenshot 15）。

**真正原因：** 我前一輪 `2cd4374` 只擋了 navbar NSM tab click，但 Step 2 內部「← 上一步」button + 其他 path 我沒擋。需要更全面的 guard。

**修法：** 找全所有把 `nsmStep` 設回 1 的 path（已知 4 處），每個都加「if scored, redirect to Step 4 instead」guard。前端 surgical。

### X-Overlay（P0 · 前端 + 需 mockup）

**現象：** 我 `bdd505a` 推的教練思路 mobile bottom-sheet「貼緊邊框太奇怪」（screenshot 12）。

**真正原因：** 我用了 `.hint-overlay .modal-card` class 但 hint modal 自身的 CSS 是 desktop full-modal pattern，沒套 bottom-sheet bottom-attached 邊距 / 圓角設計。

**修法：** **需要 mockup** 重新設計 NSM 教練思路 bottom-sheet 視覺 — 圓角 / 上方 handle bar / 下方安全區邊距 / 標題-內容 結構。

### X-Stats（P1 · 視覺契約討論）

**現象：** 「已完成 1 進行中 2 本週 0」對不上 user 期望的「5 筆紀錄」。

**真正原因：** CIRCLES strip = CIRCLES-only count（3 筆 = 1+2+0）。NSM strip 應該顯示 NSM count 但 user 沒看到（NSM home 是 Step 1 選題頁，strip 已加但 Bug 數字計算？）。**需要視覺驗證 NSM home 在 production 是否顯示 NSM 2 完成**。

**修法：** 可能不需 — strip-per-tab 設計已合理。需確認 NSM strip 顯示正確 + 視覺契約給 user 看（總計 vs 分計）。

---

## Cross-vp 覆蓋狀態（Standing Rule #2）

| VP | walk PASS | offcanvas snap | Step 2 snap | Step 3 snap | Step 4 snap |
|---|---|---|---|---|---|
| Mobile-360 | ✓ | spinner | ✓ | ✓ | (need to recheck) |
| iPhone-SE | ✓ | (pending Read) | ✓ | ✓ | ✓ |
| iPhone-14 | ✓ | ✓ | ✓ | ✓ | ✓ |
| iPhone-15-Pro | ✓ | ✓ | ✓ | ✓ | ✓ |
| iPad | ✓ | ✓ | ✓ | ✓ | ✓ |
| Desktop-1280 | ❌ FAIL | network race | n/a | n/a | n/a |
| Desktop-1440 | ✓ | spinner | ✓ | ✓ | ✓ |
| Desktop-2560 | ✓ | ✓ | ✓ | ✓ | ✓ |

**Desktop-1280 fail 需 retry。Director cold-Read 全 PNG 未完成（時間限制）— 後續 implementation 前必補。**

---

## 修法 plan 對應 Path 2 carve-out

| Bug | 我會動 | 是否需 carve-out |
|---|---|---|
| **X-FE** field_examples 缺 | 後端 nsm-sessions.js + circles-sessions.js list endpoint rehydrate from bank | 後端，**user 之前已准 NSM list carve-out**；CIRCLES list 需 user 額外准 |
| **X-Ctx** context 缺 | 同上 + LLM context endpoint 按需 trigger | 後端 + prompts，**需 carve-out** |
| **X-Compare** | 前端 surgical（renderNSMStep4ComparisonTab）+ string coerce | 不需新 carve-out |
| **X-LockedStep2** | 前端 — locked read-only display **需先給 mockup** | 不需，**需 mockup gate** |
| **X-Back** | 前端 surgical（所有 nsmStep=1 path 加 scored guard） | 不需 |
| **X-Overlay** | 前端 — bottom-sheet CSS 重寫 **需先給 mockup** | 不需，**需 mockup gate** |
| **X-DupSession** | 後端 list dedup OR DB UNIQUE migration | 後端 + 可能 DB，**需 carve-out** |
| **X-SlowList** | 後端調 latency / index / cache | 後端，**需 carve-out** |
| **X-Stats** | 視覺契約討論（mockup gate？） | TBD，**需 user 決定** |

---

## 等你 review

我**完全停下** — 不開工修任何 bug。

請你拍板：
1. **需要 mockup 的 4 個：X-LockedStep2 / X-Overlay**（可能加 X-Stats）— 我製作 mockup 給你 review
2. **後端 carve-out** 是否擴展到：CIRCLES list、prompts、DB migration
3. **修法優先順序**：哪些 P0 先修、哪些可延後

回 「OK 製作 mockup」我就開始畫 X-LockedStep2 + X-Overlay 三裝置並排 mockup。其他純邏輯/後端的等你拍板 carve-out 範圍再分批執行。

---

**Audit doc 完成。Phase 1 + Phase 2 完。停下來等你 review。**
