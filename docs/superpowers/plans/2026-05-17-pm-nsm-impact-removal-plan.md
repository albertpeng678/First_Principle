# NSM impact 維度移除 + frequency label 統一 — Impl Plan

> **Priority**: USER URGENT (2026-05-17 PM)
> **Scope**: 全產品移除 `impact` dim (4→3 dim) + frequency label 統一含「頻率」中文
> **User decision basis**: "我覺得 impact 可以都拿掉" + "frequency 有不少都沒有 frequency 的說明，應該全部都要有中文頻率"
> **Mockup-first carve-out**: subtractive change (delete 1 dim + rename label)，非新設計 — sonnet 做 mechanical mockup deltas，user 視認即放行
> **DB strategy**: Option (a) backward compat — JSONB column 保留 `impact` 不刪，新 session 不寫此欄；舊 session graceful load (impact ignored)
> **User approval (2026-05-17 PM "ok 現在啟動")**: scope + spec + e2e + DB strategy 全 approved。並行 M1 + R-BE + R-FE-Tests 3 lane。

---

## §A 改動清單

### A.1 全 type 移除 `impact` dim
**之前**: 4 dims (reach / depth / frequency / impact) × 4 product types
**之後**: 3 dims (reach / depth / frequency) × 4 product types

### A.2 frequency label 統一含「頻率」
| product type | 之前 | 之後 |
|---|---|---|
| attention | 習慣頻率 ✓ | 習慣頻率 |
| transaction | 匹配效率 ✗ | **匹配頻率** |
| creator | 採用廣度 ✗ | **採用頻率** |
| saas | 黏著頻率 ✓ | 黏著頻率 |

---

## §B 3 並行 lane scope

### Lane R1 — Backend (routes + prompts + DB migration consideration)
**Files**:
- `routes/nsm-sessions.js` /evaluate handler — accept 3-dim userBreakdown
- `routes/guest-nsm-sessions.js` 同上
- `routes/nsm-sessions.js` /progress PATCH — accept 3-dim userBreakdown
- `prompts/nsm-evaluator.js` — remove impact 從 prompt body + schema
- `prompts/nsm-hints.js` — remove impact 從 hint generation
- `lib/session-lifecycle.js` `collectNsmStrings` — drop impact key
- jest contracts — update fixtures
- DB migration: **遺留 `impact` 欄位 in JSONB 不刪**（backward compat — 舊 session 可讀; 新 session 不寫）

**Tests**: api/nsm-* specs update fixtures + assertions

### Lane R2 — Frontend (app.js + CSS)
**Files**:
- `public/app.js` — 6+ sites: dim init / label map / form render / Step 2/3 / Step 4 render
- `public/style.css` — 4-dim grid 改 3-dim grid (4-col → 3-col), pentagon radar 變 quadrilateral

**Tests**: e2e/nsm-* specs update fixtures + selectors

### Lane R3 — Mockup deltas + visual baselines
**Files**:
- `docs/superpowers/specs/mockups/2026-05-02-frontend-rewrite/07-nsm-step-2.html` — 拆解 form 4-dim → 3-dim
- `docs/superpowers/specs/mockups/2026-05-02-frontend-rewrite/08-nsm-step-3-gate.html` — gate 5 維度 (NSM+4dim) → 4 維度 (NSM+3dim)
- `docs/superpowers/specs/mockups/2026-05-02-frontend-rewrite/13-phase-4-final.html` — CIRCLES Phase 4 含 NSM dim — 視覺改
- `docs/superpowers/specs/mockups/2026-05-02-frontend-rewrite/14-nsm-step-4.html` — pentagon radar 5 軸 → 4 軸 quadrilateral
- `tests/visual/baselines/*` — re-baseline 受影響的 visual specs

---

## §C E2E integration test 強制覆蓋（per 首要綱領）

1. **新 session 3-dim e2e**: step 1 → 2 → gate → 3 → 4 → DB 寫入 3 dim → reload 正確 → final report 4-axis radar 顯示
2. **舊 session migration smoke**: 含 impact 的歷史 session 載入時 — 應該 graceful 顯示（impact 欄位被 ignore，不 break UI）
3. **Adversarial 重跑**: nsm-evaluator 3-dim 計分結果合理（無 impact 影響）
4. **Cross-vp 3 e2e projects** 全 GREEN
5. **5x consecutive 0 flake**

---

## §D Director ship gate

每 lane 完成後 cold-verify + cross-suite smoke + push origin/main + CLAUDE.md update。
