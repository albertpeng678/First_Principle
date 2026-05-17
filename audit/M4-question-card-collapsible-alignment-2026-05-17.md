# M4 — NSM 題目說明卡片折疊對齊稽核

**Date:** 2026-05-17
**Scope:** Mockup 07 (`07-nsm-step-2.html`) 全 section × 3 viewport
**Issue:** §D (步驟 2 locked) 與 §E (步驟 3 locked) 的 context card 缺少 `nsm-context-card__expand-toggle` 按鈕，「深入了解問題」折疊功能完全遺漏，導致 LOCKED 態呈現時 context card 無法展開深入分析面板。

---

## §1 Phase 1 稽核表

| Section | Step | State | Mobile 360 | Tablet 768 | Desktop 1280 | Was | Now |
|---|---|---|---|---|---|---|---|
| A | Step 2 | empty | caret-up + 收合 (expanded demo) | caret-up + 收合 (expanded demo) | caret-up + 收合 (expanded demo) | 有 toggle（展開為視覺契約） | 不變（展開 demo 保留） |
| B | Step 3 attention | empty | caret-up + 收合 (expanded demo) | caret-up + 收合 (expanded demo) | caret-up + 收合 (expanded demo) | 有 toggle（展開為視覺契約） | 不變 |
| C | Step 3 saas | filled + coach | caret-up + 收合 (expanded demo) | caret-up + 收合 (expanded demo) | caret-up + 收合 (expanded demo) | 有 toggle（展開為視覺契約） | 不變 |
| D | Step 2 | LOCKED | 無 toggle | 無 toggle | 無 toggle | 缺漏 | 補 caret-down + 深入了解問題 |
| E | Step 3 | LOCKED | 無 hint + 無 toggle | 無 hint + 無 toggle | 無 hint + 無 toggle | 缺漏 | 補 hint + caret-down + 深入了解問題 |

**修正總計：** 6 instances（§D × 3 + §E × 3）

---

## §2 Canonical Collapsible Pattern Reference

來源：Mockup 07 §A Mobile `07-nsm-step-2.html` line 868–892 (展開態) + `renderNSMContextCard` in `public/app.js` line 1582–1633。

**Collapsed state（預設）：**
```html
<div class="nsm-context-card">
  <div class="nsm-context-card__top">...</div>
  <p class="nsm-context-card__scenario">...</p>
  <span class="nsm-context-card__hint"><i class="ph ph-info"></i>...</span>
  <button class="nsm-context-card__expand-toggle">
    <i class="ph ph-caret-down"></i>深入了解問題
  </button>
  <!-- NO expand panel rendered -->
</div>
```

**Expanded state（點擊後）：**
```html
<button class="nsm-context-card__expand-toggle">
  <i class="ph ph-caret-up"></i>收合
</button>
<div class="nsm-context-card__expand">
  <div class="nsm-context-card__expand-label">深入分析</div>
  <div class="nsm-context-card__ana">
    <!-- 4 blocks: 商業模式 / 使用者 / 常見陷阱 / 破題切入 -->
  </div>
</div>
```

**Production toggle handler:** `data-nsm="context-toggle"` → toggles `AppState.nsmContextExpanded` → re-renders.

---

## §3 逐行修改索引

| Location | Line範圍 (修改後) | 修改說明 |
|---|---|---|
| §D Mobile context card | ~2305-2308 | 補 `<button class="nsm-context-card__expand-toggle"><i class="ph ph-caret-down"></i>深入了解問題</button>` + 更新 comment |
| §D Tablet context card | ~2401-2404 | 同上 |
| §D Desktop context card | ~2494-2497 | 同上 |
| §E Mobile context card | ~2601-2607 | 補 hint `<span class="nsm-context-card__hint">...</span>` + toggle 按鈕 |
| §E Tablet context card | ~2709-2715 | 同上 |
| §E Desktop context card | ~2816-2822 | 同上 |

**CSS (`public/style.css`):** 無需修改，`.nsm-context-card__expand-toggle` 樣式 line 3482–3494 已存在。

**Production (`public/app.js`):** 無需修改，`renderNSMContextCard` line 1582–1633 已正確讀取 `AppState.nsmContextExpanded`（default=false → collapsed）並渲染「深入了解問題」toggle。

---

## §4 Mockup 06 Cross-check

Mockup 06 (`06-nsm-step-1.html`) 使用 `nsm-q-card` 元件（5-card 選題 rail），非 `nsm-context-card`，設計語言不同，無折疊 expand-toggle pattern，不在本次修正範圍。

---

## §5 Constraints Compliance

- 只碰 question/problem-statement context card → PASS（未動 nsm banner / dim cards / 4-block content）
- 3 viewport 全對齊 → PASS（Mobile / Tablet / Desktop 各補齊）
- LOCKED class names 保留 → PASS
- Canonical pattern strict mirror → PASS（`ph-caret-down` + 「深入了解問題」）
- Production app.js sync → PASS（production 已正確，mockup 補齊）
