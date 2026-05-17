# M1 — NSM Impact Dim Removal · Mockup Deltas

**Date:** 2026-05-17
**Scope:** 4 mockup HTML files — purely subtractive + label rename
**Decision origin:** User session 2026-05-17 PM

---

## §1 Changes per Mockup

### Mockup 07 (`07-nsm-step-2.html`)

**Removed blocks (留存驅力 / 擴張信號 — the 4th dim / impact):**

| Section | Viewport | Removed block |
|---|---|---|
| B (attention blank) | Mobile 360 | `<div class="nsm-dim">` 留存驅力 full block (multi-line) |
| B (attention blank) | Tablet 768 | `<div class="nsm-dim">` 留存驅力 single-line format |
| B (attention blank) | Desktop 1280 | `<div class="nsm-dim">` 留存驅力 single-line format |
| C (saas filled) | Mobile 360 | `<div class="nsm-dim">` 擴張信號 full block |
| C (saas filled) | Tablet 768 | `<div class="nsm-dim">` 擴張信號 single-line format |
| C (saas filled) | Desktop 1280 | `<div class="nsm-dim">` 擴張信號 single-line format |
| E (attention locked) | Mobile 360 | `<div class="nsm-dim">` 留存驅力 rt-field--locked block |
| E (attention locked) | Tablet 768 | `<div class="nsm-dim">` 留存驅力 rt-field--locked block |
| E (attention locked) | Desktop 1280 | `<div class="nsm-dim">` 留存驅力 rt-field--locked block |

**Annotation / header text updates:**
- Title: `4-dim 拆解` → `3-dim 拆解`
- Section B header/subtitle: `4-dim 空白` → `3-dim 空白`, dim list drops `留存驅力`
- Section B anno: `NSM_DIMENSION_CONFIGS.attention` dim list drops `/ 留存驅力（impact）`; `4 張 nsm-dim card` → `3 張`; `4-dim 隨產品特性說明` → `3-dim`
- Section C header/subtitle: `4-dim 已填` → `3-dim 已填`, dim list drops `擴張信號`
- Section C anno: dim list drops `/ 擴張信號`; `第 3-4 dim 空白` → `第 3 dim 空白`
- Section E header: `4 dim cards 全 rt-field--locked` → `3 dim cards`
- Section E anno: `4 nsm-dim cards` → `3 nsm-dim cards`; dim list drops `/ 留存驅力`
- CSS comment `4-dim section card` → `3-dim section card`
- HTML comment `4-dim 空白` → `3-dim 空白`
- Combo count `4 type × 4 dim = 16` → `4 type × 3 dim = 12`

### Mockup 08 (`08-nsm-step-3-gate.html`)

**No structural changes made.**

Rationale: Mockup 08 is the NSM Definition Quality Gate. Its 5 gate items (價值關聯性 / 領先指標性 / 操作性 / 可理解性 / 週期敏感) evaluate the NSM metric definition quality — they are NOT the product input dimensions (觸及廣度/互動深度/習慣頻率). The "impact" removal applies to Step 3 product dims only, not the NSM quality evaluation criteria. The 5 NSM quality criteria remain unchanged.

### Mockup 13 (`13-phase-4-final.html`)

**Removed blocks:**
- 3 instances of `<div class="tracking-mini">` for dim 4 留存驅力 (one per viewport: Mobile/Tablet/Desktop), each containing:
  - `tracking-mini__head`: `4 留存驅力`
  - `tracking-mini__sub`: 推動用戶留下的核心機制
  - `tracking-mini__content`: 試用到期後 30 日內完成訂閱的轉換率 ≥ 12%

**Annotation/text updates:**
- Title: `tracking 4 dim` → `tracking 3 dim`
- H1: `NSM tracking 4 dim` → `NSM tracking 3 dim`
- Intro text: `4 個 tracking dimensions（reach / depth / frequency / impact）獨立為 4 張 card` → `3 個 tracking dimensions（reach / depth / frequency）獨立為 3 張 card`
- `NSM 區段與 4 dim cards` → `3 dim cards`; `4 dim 各為獨立 card` → `3 dim`
- `tracking 4 dim primary / navy / success / warn` → `tracking 3 dim primary / navy / success`
- Section A header subtitle: `4 dim 獨立 cards` → `3 dim 獨立 cards`
- Section A anno: `NSM 4 dim 細項 mini cards` → `3 dim`; `4 dim 全部統一中性樣式，僅用 Italic 1/2/3/4 編號` → `3 dim ... 1/2/3 編號`
- Section S `step-rows__note`: `4 dim 追蹤指標具體可操作` → `3 dim` (×3 viewports)
- `step-rows__detail-label`: `NSM 追蹤指標 4 dim 拆解` → `3 dim` (×3 viewports)
- CSS comment `nested 4 dim NSM tracking detail` → `3 dim`

### Mockup 14 (`14-nsm-step-4.html`)

**Removed blocks:**

| Section | Viewport | Removed block |
|---|---|---|
| B (Tab 2 對比) | Mobile 360 | `<div class="nsm-compare-block">` 留存驅力 (title + yours card + coach card) |
| B (Tab 2 對比) | Tablet 768 | `<div class="nsm-compare-grid__row">` label key 4 + 留存驅力 + yours + coach |
| B (Tab 2 對比) | Desktop 1280 | `<div class="nsm-compare-grid__row">` label key 4 + 留存驅力 + yours + coach |

**Section B' (教練思路展開) note:** B' only showed 觸及廣度 and 互動深度 blocks — no 留存驅力 block was present to remove.

**Pentagon radar (Tab 1 總覽):** The 5-axis pentagon radar in mockup 14 evaluates NSM definition quality (價值關聯/領先指標/操作性/可理解性/週期敏感) — it is NOT a product input dim radar. It remains unchanged.

**Annotation/text updates:**
- Section B header: `NSM + 4 dim 5 列` → `NSM + 3 dim 4 列`
- Section B anno: `5 列 = 北極星指標 + 觸及廣度 + 互動深度 + 習慣頻率 + 留存驅力` → `4 列 = 北極星指標 + 觸及廣度 + 互動深度 + 習慣頻率`
- Intro desc: `5 列 = NSM + reach/depth/frequency/impact` → `4 列 = NSM + reach/depth/frequency`

---

## §2 Visual Contract Preservation

- 3-viewport (Mobile 360 / Tablet 768 / Desktop 1280) structure intact in all 4 mockups
- LOCKED component CSS (navbar / phase-head / qchip / submit-bar / gate-item) unchanged
- All Phosphor `ph-*` icons preserved
- No emoji introduced
- System-ui font stack preserved
- Gate state contract (ok/warn/error) in mockup 08 unchanged
- No new design elements added — purely subtractive changes

---

## §3 Frequency Label Rename Map

| Product type | Old label | New label | Changed? |
|---|---|---|---|
| attention | 習慣頻率 | 習慣頻率 | No (already correct) |
| transaction | 匹配效率 | 匹配頻率 | **Yes** |
| creator | 採用廣度 | 採用頻率 | **Yes** |
| saas | 黏著頻率 | 黏著頻率 | No (already correct) |

**Note on transaction/creator label rename:** These types do not appear in the currently rendered mockup sections (Sections B, C, E of mockup 07 use attention and saas types only). The rename for transaction/creator types affects only annotation text and the conceptual `NSM_DIMENSION_CONFIGS` references — not any visible rendered dim cards in the existing mockup HTML. The frequency dim labels shown in the HTML (習慣頻率 for attention, 黏著頻率 for saas) are already correct per the rename table and required no changes.

Annotation references to transaction/creator dim configs have been updated in the heading text to reflect the new 3-dim paradigm. Implementation of the actual `匹配頻率` and `採用頻率` labels will appear in the production `NSM_DIMENSION_CONFIGS` object update (separate implementation task).
