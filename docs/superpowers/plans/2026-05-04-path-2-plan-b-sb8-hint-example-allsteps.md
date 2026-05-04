# Plan B SB8 — 全 7 步 hint modal + example expand 補齊

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:test-driven-development。每 task TDD 紅綠。

**Goal：** 全 7 步（C1/I/R/C2/L/E/S）所有 hint「提示」+「範例答案」按鈕綁 click handler；hint 開 Tier-1 modal（hardcoded text from config）；範例答案 inline expand `q.field_examples[step][fieldName]` markdown。LINE-BY-LINE 嚴格 copy mockup 03 Section D（line 1760-1949）。

**鐵則：**
- mockup-as-Spec：modal-card / overlay-frame 結構整段 verbatim copy mockup line 1795-1812
- DB key alias：I/R/C2 步 config field key vs DB field_examples key 不同（config 「最優先」vs DB 「最優先項目」），需 mapping helper
- 後端 100% 不動：Tier-2 AI hint API（POST /api/.../hint）defer 到 SB9；本 SB Tier-1 only
- 全 zh-TW，無 emoji，icons Phosphor ph-*
- TDD 紅綠強制（每 click handler 先寫紅燈 spec）
- Director cold review 含 click-driven Playwright（不只 visual）

---

## §0 PROJECT 鐵則 + 殺手鐧

**24 standing rules**（與 SB7 plan §0.0 同 — 略不重列，opener 必讀 SB7 plan §0.0 全文）

**4 樣產出（缺一不過）：**
1. jest log（不 regression）
2. Playwright log × 8 viewport
3. **Click-driven Playwright spec**：每個 hint button click → 驗 modal 開；每個 example-toggle click → 驗 panel expand；每個 close → 驗 collapse
4. eyeball walk doc：3 viewport × 7 step × 2 button = 42 互動點 director Read PNG

**殺手鐧 3 問** + **9 anti-patterns** 同 SB7 plan §0.0。

---

## §1 LOCKED chunks（不准重定義）

| Chunk | Defined in | 規約 |
|---|---|---|
| `.example-expand`, `.example-expand__head`, `.example-expand__title`, `.example-expand__close` | style.css line 752-758（SB3 LOCKED） | sol-card / 4-field 都 reuse |
| `.example-list`, `.example-sub` | style.css line ~760-770（SB3） | bullet 渲染用 |
| `.field__hint-link`, `.field-example-toggle` | style.css（SB3） | hint+example button class |
| renderPhase1Field（line 549-572） | C1/I/R/C2 步用 — 已有 `data-phase1="hint"`/`"example-toggle"` | 不動 |
| renderEsolCard（line 895-935） | E 步 sol-card | 改：補 data-phase1 attrs + inline example-expand |
| renderSolCard（line 586-685） | L 步 sol-card | 改：補 data-phase1 attrs + inline example-expand |
| renderCirclesPhase1Sstep（line 938-1115） | S 步 3 main + 4 tracking | 改：補 data-phase1 attrs + inline example-expand |

---

## §2 新增 CSS（modal-card / overlay-frame）— mockup line 1795-1812 verbatim

新增到 style.css 末尾，section header `/* ───── LOCKED · hint modal (mockup 03 Section D line 1760-1815) ───── */`：

```css
/* hint modal overlay — 浮在 form 上方 backdrop dim；mobile bottom-sheet / desktop centered */
.hint-overlay { display: none; position: fixed; inset: 0; z-index: 100; }
.hint-overlay[aria-hidden="false"] { display: block; }
.hint-overlay__backdrop { position: absolute; inset: 0; background: rgba(15, 23, 42, 0.45); }
.modal-card {
  position: absolute; left: 50%; transform: translateX(-50%);
  background: var(--c-card); border-radius: var(--r-card);
  box-shadow: 0 20px 60px rgba(15,23,42,0.18);
  width: calc(100% - var(--s-5)); max-width: 480px;
  display: flex; flex-direction: column;
}
@media (max-width: 767px) {
  /* mobile: bottom sheet up-slide — 拇指可達 */
  .modal-card {
    bottom: 0; transform: translateX(-50%);
    border-bottom-left-radius: 0; border-bottom-right-radius: 0;
    width: 100%; max-width: 100%;
    padding-bottom: max(var(--s-3), env(safe-area-inset-bottom));
  }
}
@media (min-width: 768px) {
  /* tablet+desktop: centered fade-in */
  .modal-card { top: 50%; transform: translate(-50%, -50%); }
}
.modal__head { display: flex; align-items: flex-start; gap: var(--s-3); padding: var(--s-4) var(--s-5); border-bottom: 1px solid var(--c-rule); }
.modal__head-icon { display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 50%; background: rgba(15,23,42,0.04); color: var(--c-navy); font-size: 16px; flex-shrink: 0; }
.modal__sub { font-size: var(--t-cap); color: var(--c-ink-3); margin-bottom: 2px; }
.modal__title { font-size: var(--t-h3); font-weight: 600; color: var(--c-ink); margin: 0; }
.modal__close { width: 28px; height: 28px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; color: var(--c-ink-3); cursor: pointer; flex-shrink: 0; }
.modal__close:hover { background: var(--c-bg-deep); color: var(--c-ink); }
.modal__body { padding: var(--s-4) var(--s-5); font-size: var(--t-body-sm); line-height: 1.7; color: var(--c-ink); }
.modal__body p { margin: 0; }
.modal__body p + p { margin-top: var(--s-3); }
.modal__foot { padding: var(--s-3) var(--s-5) var(--s-4); display: flex; justify-content: flex-end; gap: var(--s-2); border-top: 1px solid var(--c-rule); }
```

---

## §3 新增 HINT_OVERLAY_TEXT config — `app.js` 結構

每個 (stepKey, fieldKey) 的 hint text。**80-100 字 zh-TW per cell**（mockup line 1933 規約）。

放在 CIRCLES_STEP_CONFIG 之後（line ~480 附近），作為獨立 const：

```js
// ── HINT_OVERLAY_TEXT — 27 cells: 7 step × 各步驟 fields ──
// mockup 03 Section D line 1804-1807 規約：80-100 字 zh-TW，第 1 層 hardcoded（0ms 載入）
var HINT_OVERLAY_TEXT = {
  C1: {
    '問題範圍': '先把題目的問題本身定義清楚 — 它的具體類型是什麼（行為層 / 情感層 / 系統層）？涵蓋哪些功能或場景？哪些明確排除？沒釐清這層，後面的分析會在錯的邊界上展開。',
    '時間範圍': '為什麼是 X 天？對應的業務節奏是什麼（廣告週期 / 留存窗口 / 季度回檢）？時間框架要支撐你後面講的指標觀察期。',
    '業務影響': '列出這題不能傷到的量化紅線 — 哪些指標不能下降、降多少視為失敗。沒有紅線 = 沒有 trade-off 判準。',
    '假設確認': '寫 2-3 條「如果這個假設不成立，整個分析就垮」的關鍵假設。讓 reviewer 知道你哪裡有風險，而不是假裝什麼都確定。'
  },
  I: {
    '目標用戶分群': '依「行為 / 情境」分群，不只人口統計。列 2-4 個具體子群，每群有清楚的觸發場景或使用習慣。',
    '選定焦點對象': '說明為什麼選這群、不選其他群 — 痛點最集中？商業價值最高？樣本量足夠？要寫得讓 reviewer 看得出 trade-off。',
    '用戶動機假設(JTBD)': '用「當 X 時，我想要 Y，以便 Z」格式 — X 是情境、Y 是任務、Z 是更深層 outcome。聚焦 outcome 而不是 feature。',
    '排除對象': '寫清楚誰不在這次的範圍內 + 為什麼排除 — 不是看不起，是聚焦。明確排除可幫 reviewer 看出你的邊界判斷。'
  },
  R: {
    '功能性': '用戶想完成的具體任務或操作 — 用動詞列。例：「可跳過廣告 / 廣告頻率可控 / 廣告時機可選」。',
    '情感性': '用戶在使用過程中希望有什麼感受 — 沉浸 / 不被打斷 / 有掌控感。情感性常被忽略但決定留存。',
    '社交性': '用戶如何在社交場合中展示或使用這個產品 — 分享、討論、認同感。',
    '核心痛點': '寫「最根本的、用戶已嘗試但未能解決的問題」— 已試 workaround 表示需求真實。'
  },
  C2: {
    '取捨標準': '列 2-3 個判斷優先級的明確標準（用戶衝擊 × 商業影響 × 實作複雜度），讓你後面的排序站得住腳。',
    '最優先': '說明為什麼這個最優先 — 連結你前面定的取捨標準，給出量化或半量化判斷。',
    '暫緩': '說明暫緩的邏輯 — 不是「不重要」，是「現在做風險或代價不對等」。',
    '排序理由': '用一句話說明整體排序的核心考量 — 幫 reviewer 快速看到你的判斷主軸。'
  },
  L: {
    '方案': '想 2-3 個「機制差異本質不同」的方案 — 不是同一招的小變體。每個方案要有清楚的：機制 / 為什麼這個機制能解 / 與其他方案的本質差異。'
  },
  E: {
    '優點': '誠實寫每個方案最強的 1-2 個優勢 — 對應前面定的核心痛點，量化越好。不要只寫一招很棒，要寫「為什麼這招對這群人這時候特別有效」。',
    '缺點': '寫每個方案的限制或副作用 — 哪些用戶體驗會變差、哪些情況不適用。誠實寫缺點才能看出 trade-off 理解。',
    '風險與依賴': '具體列出技術 / 人力 / 時程 / 第三方依賴 — 不要寫「可能會失敗」這種空話。要寫「依賴 X，X 風險在 Y」。',
    '成功指標': '量化定義方案有效 — 主指標 + 觀察期。例：「30 天內留存 +5pp」。沒量化的成功指標 = 沒辦法驗證。'
  },
  S: {
    '推薦方案': '一句話總判斷 — 推薦哪個方案、為什麼這是最終選擇。要呼應你前面定的 NSM 與取捨標準。',
    '選擇理由': '引用 E 結論的 3 個面向 — 對比放棄方案 / 回應最大缺點 / 解釋為何取捨值得。讓 reviewer 看到你的決策邏輯。',
    '北極星指標': 'NSM 定義含行為門檻 + 為什麼能反映成效。例：「每月活躍 ≥ 1 次完整收聽的用戶數」— 動詞 + 門檻 + 理由。',
    '觸及廣度': '產品被多少人觸及 — 用 MAU、WAU、reach 量化。對應 NSM 的「廣度」維度。',
    '互動深度': '用戶單次或週期內互動深度 — sessions/user、minutes/session 等。對應 NSM 的「深度」維度。',
    '習慣頻率': '用戶回訪頻率 — 7-day return、days/month。對應 NSM 的「頻率」維度。',
    '留存驅力': '哪個行為驅動長期留存 — D30 / W4 retention 等。對應 NSM 的「留存」維度。'
  }
};
```

---

## §4 新增 getFieldExampleKey helper — DB alias mapping

```js
// ── getFieldExampleKey: 把 config field key 轉成 DB field_examples key ──
// DB schema 與 config schema 微差異：I (JTBD) / R (需求 suffix) / C2 (項目 suffix)
function getFieldExampleKey(stepKey, fieldKey) {
  var aliasMap = {
    I: { '用戶動機假設(JTBD)': '用戶動機假設' },
    R: { '功能性': '功能性需求', '情感性': '情感性需求', '社交性': '社交性需求' },
    C2: { '最優先': '最優先項目', '暫緩': '暫緩項目' }
  };
  if (aliasMap[stepKey] && aliasMap[stepKey][fieldKey]) return aliasMap[stepKey][fieldKey];
  return fieldKey;
}
```

---

## §5 Tasks（TDD 紅綠強制）

### Task 1：renderHintModal helper + binder

**Files:**
- Modify: `public/app.js`（line ~2095 附近 — bindCirclesPhase1 hint binder placeholder 換成完整實作）
- Modify: `public/app.js`（新增 `renderHintModal(stepKey, fieldKey)` helper）
- Test: `tests/visual/phase1-hint-modal.spec.js`（NEW）

- [ ] **Step 1：寫紅燈 spec**

```js
// tests/visual/phase1-hint-modal.spec.js
const { test, expect } = require('@playwright/test');
test.use({ baseURL: 'http://localhost:4000' });

function stub(page) {
  return Promise.all([
    page.route('**/api/circles-stats**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' })),
    page.route('**/api/circles-sessions**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' })),
    page.route('**/api/guest-circles-sessions**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' })),
    page.route('**/api/nsm-sessions**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' })),
    page.route('**/api/guest/nsm-sessions**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' })),
  ]);
}

async function gotoStep(page, simStepIdx) {
  await page.goto('/');
  await page.waitForSelector('.qcard');
  await page.locator('.mode-card').nth(0).click();
  await page.locator('.qcard').first().click();
  await page.locator('.qcard__btn--primary').click();
  await page.waitForSelector('.phase-head');
  await page.evaluate(idx => { window.AppState.circlesSimStep = idx; window.renderApp(); }, simStepIdx);
}

test('C1 提示 click 開 modal', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await stub(page);
  await gotoStep(page, 0);
  await page.locator('.field__hint-link').first().click();
  await expect(page.locator('.modal-card')).toBeVisible();
  await expect(page.locator('.modal__title')).toHaveText('問題範圍');
  await expect(page.locator('.modal__body p').first()).toContainText('問題本身定義清楚');
});

test('hint modal close button 收合', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await stub(page);
  await gotoStep(page, 0);
  await page.locator('.field__hint-link').first().click();
  await page.locator('.modal__close').click();
  await expect(page.locator('.modal-card')).not.toBeVisible();
});

test('hint modal 「了解了」CTA 收合', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await stub(page);
  await gotoStep(page, 0);
  await page.locator('.field__hint-link').first().click();
  await page.locator('.modal__foot .btn--primary').click();
  await expect(page.locator('.modal-card')).not.toBeVisible();
});

test('hint modal backdrop click 收合', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await stub(page);
  await gotoStep(page, 0);
  await page.locator('.field__hint-link').first().click();
  await page.locator('.hint-overlay__backdrop').click();
  await expect(page.locator('.modal-card')).not.toBeVisible();
});

// 7 step × 至少 1 hint 開 modal smoke
['C1','I','R','C2','L','E','S'].forEach((step, idx) => {
  test(`${step} step 提示 click 開 modal`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await stub(page);
    await gotoStep(page, idx);
    await page.locator('.field__hint-link').first().click();
    await expect(page.locator('.modal-card')).toBeVisible();
    await expect(page.locator('.modal__sub')).toContainText('提示');
  });
});
```

- [ ] **Step 2：跑紅燈確認 fail**
- [ ] **Step 3：實作 renderHintModal + binder**

```js
// renderHintModal — mockup 03 line 1795-1812 verbatim
function renderHintModal(stepKey, fieldKey) {
  var text = (HINT_OVERLAY_TEXT[stepKey] && HINT_OVERLAY_TEXT[stepKey][fieldKey]) || '提示內容稍後提供。';
  var paras = text.split(/\n\n|。\s*(?=\S)/).filter(Boolean).map(function(p){ return p.replace(/。$/,'') + '。'; });
  if (paras.length === 0) paras = [text];
  var bodyHtml = paras.map(function(p, i){
    return '<p' + (i > 0 ? ' style="margin-top: var(--s-3);"' : '') + '>' + escHtml(p) + '</p>';
  }).join('');
  return '<div class="hint-overlay" aria-hidden="false">'
    + '<div class="hint-overlay__backdrop" data-hint-action="close"></div>'
    + '<div class="modal-card" role="dialog" aria-modal="true">'
    +   '<div class="modal__head">'
    +     '<span class="modal__head-icon"><i class="ph ph-lightbulb"></i></span>'
    +     '<div style="flex:1;">'
    +       '<div class="modal__sub">提示 · ' + escHtml(stepKey) + '</div>'
    +       '<h3 class="modal__title">' + escHtml(fieldKey) + '</h3>'
    +     '</div>'
    +     '<button class="modal__close" data-hint-action="close" aria-label="關閉"><i class="ph ph-x"></i></button>'
    +   '</div>'
    +   '<div class="modal__body">' + bodyHtml + '</div>'
    +   '<div class="modal__foot">'
    +     '<button class="btn btn--primary" data-hint-action="close" style="font-size:var(--t-meta); min-height:36px;">了解了</button>'
    +   '</div>'
    + '</div>'
    + '</div>';
}

function openHintModal(stepKey, fieldKey) {
  closeHintModal(); // single-instance
  var host = document.createElement('div');
  host.id = '__hint_overlay_host__';
  host.innerHTML = renderHintModal(stepKey, fieldKey);
  document.body.appendChild(host);
  // bind close
  host.querySelectorAll('[data-hint-action="close"]').forEach(function(el){
    el.addEventListener('click', function(){ closeHintModal(); });
  });
  // ESC key
  document.addEventListener('keydown', _hintEscHandler);
}
function closeHintModal() {
  var host = document.getElementById('__hint_overlay_host__');
  if (host) host.remove();
  document.removeEventListener('keydown', _hintEscHandler);
}
function _hintEscHandler(e){ if (e.key === 'Escape') closeHintModal(); }
```

- [ ] **Step 4：bindCirclesPhase1 hint binder 改寫**（line 2095-2101）

```js
// ── hint button: open Tier-1 modal with hardcoded text ──
document.querySelectorAll('[data-phase1="hint"]').forEach(function (btn) {
  btn.addEventListener('click', function (e) {
    e.stopPropagation();
    var stepKey = AppState.circlesMode === 'drill'
      ? (AppState.circlesDrillStep || 'C1')
      : (['C1','I','R','C2','L','E','S'][AppState.circlesSimStep || 0] || 'C1');
    var fieldKey = btn.dataset.fieldKey || btn.dataset.fieldIdx;
    // 若 fieldKey 是 idx (數字)，從 stepCfg.fields 找 key
    if (fieldKey && /^\d+$/.test(fieldKey)) {
      var cfg = CIRCLES_STEP_CONFIG[stepKey];
      if (cfg && cfg.fields && cfg.fields[parseInt(fieldKey, 10)]) {
        fieldKey = cfg.fields[parseInt(fieldKey, 10)].key;
      }
    }
    openHintModal(stepKey, fieldKey || '提示');
  });
});
```

- [ ] **Step 5：跑綠燈**

```bash
npx playwright test tests/visual/phase1-hint-modal.spec.js --reporter=line
```
Expected: 10 pass

- [ ] **Step 6：commit**

```bash
git add public/app.js public/style.css tests/visual/phase1-hint-modal.spec.js
git commit -m "feat(plan-b-sb8): hint modal Tier-1 hardcoded — 7 step × 27 fields"
```

### Task 2：Field renderers 補 data-phase1 attrs + inline example-expand

**Files:**
- Modify: `public/app.js` renderEsolCard（line 909-928）— 補 `data-phase1="hint" data-field-key="..."` + `data-phase1="example-toggle" data-field-key="..."` + render `.example-expand` panel
- Modify: `public/app.js` renderSolCard（line 615-650 附近 — sol-name 區）— 同樣補
- Modify: `public/app.js` renderCirclesPhase1Sstep（line 1024-1056）— 同樣補（3 main + 4 tracking）
- Test: `tests/visual/phase1-example-expand.spec.js`（NEW）

**規格（嚴格 verbatim mockup 03 line 1905-1920）：**

```js
function renderExampleExpand(stepKey, fieldKey, dataKey) {
  // dataKey 用於 unique data-attr（E 步用 sol-N-fieldKey；其他步用 fieldKey）
  return '<div class="example-expand" aria-hidden="true" data-example-key="' + escHtml(dataKey) + '">'
    + '<div class="example-expand__head">'
    +   '<div class="example-expand__title"><i class="ph ph-quotes"></i>範例答案 — 此題預先生成，不打 LLM（&lt; 50ms）</div>'
    +   '<button class="example-expand__close" data-phase1="example-close" data-example-key="' + escHtml(dataKey) + '" aria-label="收合"><i class="ph ph-x"></i></button>'
    + '</div>'
    + '<ul class="example-list" data-example-content-key="' + escHtml(dataKey) + '"><li>（載入中...）</li></ul>'
    + '</div>';
}
```

**E 步 renderEsolCard 改：**

```js
var fieldsHtml = perSolFields.map(function (f) {
  var dataKey = solIdx + '-' + f.key;  // composite: 0-優點 / 0-缺點 / 1-優點 ...
  return ''
    + '<div class="field" data-field-key="' + escHtml(f.key) + '" data-sol-idx="' + solIdx + '" style="margin-bottom: var(--s-4);">'
    +   '<div class="field__label-row">'
    +     '<label class="field__label">' + escHtml(f.label) + '</label>'
    +     '<div class="field__hint-row">'
    +       '<button class="field__hint-link" data-phase1="hint" data-field-key="' + escHtml(f.label) + '"><i class="ph ph-lightbulb"></i>提示</button>'
    +       '<button class="field-example-toggle" data-phase1="example-toggle" data-example-key="' + escHtml(dataKey) + '" data-field-key="' + escHtml(f.label) + '" aria-expanded="false">'
    +         '<i class="ph ph-quotes"></i>範例答案<i class="ph ph-caret-down toggle-caret"></i>'
    +       '</button>'
    +     '</div>'
    +   '</div>'
    +   '<div class="rt-field">'
    +     '<div class="rt-field__toolbar">'
    +       '<button class="rt-tbtn"><i class="ph ph-text-b"></i></button>'
    +       '<button class="rt-tbtn"><i class="ph ph-list-bullets"></i></button>'
    +     '</div>'
    +     '<textarea class="rt-textarea" rows="' + f.rows + '" placeholder="' + escHtml(f.placeholder) + '" data-circles-e-sol-idx="' + solIdx + '" data-circles-e-field-key="' + f.key + '" data-max="' + f.max + '"></textarea>'
    +   '</div>'
    +   '<div class="field__meta" style="font-size: var(--t-cap); color: var(--c-ink-3); margin-top: 2px;">建議 ' + f.minMax + ' 字</div>'
    +   renderExampleExpand('E', f.label, dataKey)
    + '</div>';
}).join('');
```

**S 步主 fields**（line ~1024）— 補 `data-phase1="hint" data-field-key="' + escHtml(key) + '"` 在 hint 按鈕；補 `data-phase1="example-toggle" data-example-key="..." data-field-key="..."` 在 example-toggle；append renderExampleExpand。

**S 步 tracking-cards**（line ~1054）— 同樣補（dataKey = `track-` + dimKey）。

**L 步 renderSolCard**（line 615-650 附近）— hint+example 在 sol-name 旁，dataKey = `sol-` + idx，fieldKey 用 sol-name (e.g. '方案一')。

**TDD spec：**

```js
// tests/visual/phase1-example-expand.spec.js
test('C1 範例答案 click → inline expand 顯示 markdown bullet', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await stub(page);
  await gotoStep(page, 0);
  await page.locator('.field-example-toggle').first().click();
  var firstExpand = page.locator('.example-expand').first();
  await expect(firstExpand).toBeVisible();
  await expect(firstExpand.locator('.example-list li')).not.toContainText('載入中');
});

test('範例答案 close button 收合', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await stub(page);
  await gotoStep(page, 0);
  await page.locator('.field-example-toggle').first().click();
  await page.locator('.example-expand__close').first().click();
  await expect(page.locator('.example-expand').first()).not.toBeVisible();
});

// E 步 sol-card × 4 fields × 範例答案 click
test('E step sol-1 advantage 範例答案 expand 顯示 q.field_examples.E.優點', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await stub(page);
  await gotoStep(page, 5);
  await page.evaluate(() => {
    window.AppState.circlesPhase1Solutions = [{name:'A',mechanism:''},{name:'B',mechanism:''}];
    window.renderApp();
  });
  await page.waitForSelector('.sol-card');
  await page.locator('.sol-card').first().locator('.field-example-toggle').first().click();
  var firstExpand = page.locator('.sol-card').first().locator('.example-expand').first();
  await expect(firstExpand).toBeVisible();
});

// 全 7 step × example smoke
['C1','I','R','C2','L','E','S'].forEach((step, idx) => {
  test(`${step} step 範例答案 click expand`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await stub(page);
    await gotoStep(page, idx);
    if (step === 'L' || step === 'E') {
      await page.evaluate(() => { window.AppState.circlesPhase1Solutions = [{name:'A',mechanism:''},{name:'B',mechanism:''}]; window.renderApp(); });
      await page.waitForSelector('.sol-card');
    }
    await page.locator('.field-example-toggle').first().click();
    await expect(page.locator('.example-expand').first()).toBeVisible();
  });
});
```

### Task 3：bindCirclesPhase1 example-toggle binder 改寫（用 dataKey）

**File:** `public/app.js` line 2055-2073（current example-toggle binder 用 `data-field-idx`，改成 `data-example-key`）

```js
// ── example-toggle: toggle aria-expanded + show/hide example-expand by example-key ──
document.querySelectorAll('[data-phase1="example-toggle"]').forEach(function (btn) {
  btn.addEventListener('click', function (e) {
    e.stopPropagation();
    var key = btn.dataset.exampleKey || btn.dataset.fieldIdx;
    var fieldKey = btn.dataset.fieldKey;
    var isActive = btn.getAttribute('aria-expanded') === 'true';
    var newState = !isActive;
    btn.setAttribute('aria-expanded', String(newState));
    btn.classList.toggle('is-active', newState);
    var caret = btn.querySelector('.toggle-caret');
    if (caret) caret.style.transform = newState ? 'rotate(180deg)' : '';
    // find expand by example-key (preferred) or field-idx (legacy)
    var expand = document.querySelector('.example-expand[data-example-key="' + key + '"]')
      || document.querySelector('.example-expand[data-field-idx="' + key + '"]');
    if (expand) {
      expand.setAttribute('aria-hidden', String(!newState));
      expand.style.display = newState ? '' : 'none';
      // lazy populate content
      if (newState) {
        var contentList = expand.querySelector('.example-list');
        if (contentList && contentList.dataset.populated !== '1') {
          var stepKey = AppState.circlesMode === 'drill'
            ? (AppState.circlesDrillStep || 'C1')
            : (['C1','I','R','C2','L','E','S'][AppState.circlesSimStep || 0] || 'C1');
          var dbKey = getFieldExampleKey(stepKey, fieldKey || key);
          var q = AppState.circlesSelectedQuestion || {};
          var md = (q.field_examples && q.field_examples[stepKey] && q.field_examples[stepKey][dbKey]) || '';
          contentList.innerHTML = md ? markdownBulletsToHtml(md) : '<li>（此題尚無範例答案）</li>';
          contentList.dataset.populated = '1';
        }
      }
    }
  });
});

// example-close binder（同樣 by example-key）
document.querySelectorAll('[data-phase1="example-close"]').forEach(function (btn) {
  btn.addEventListener('click', function (e) {
    e.stopPropagation();
    var key = btn.dataset.exampleKey || btn.dataset.fieldIdx;
    var expand = document.querySelector('.example-expand[data-example-key="' + key + '"]')
      || document.querySelector('.example-expand[data-field-idx="' + key + '"]');
    if (expand) { expand.setAttribute('aria-hidden', 'true'); expand.style.display = 'none'; }
    var toggle = document.querySelector('[data-phase1="example-toggle"][data-example-key="' + key + '"]')
      || document.querySelector('[data-phase1="example-toggle"][data-field-idx="' + key + '"]');
    if (toggle) {
      toggle.setAttribute('aria-expanded', 'false');
      toggle.classList.remove('is-active');
      var caret = toggle.querySelector('.toggle-caret');
      if (caret) caret.style.transform = '';
    }
  });
});
```

### Task 4：markdownBulletsToHtml helper

```js
// markdownBulletsToHtml — 簡易 markdown bullet→<li> 轉換（mockup 03 line 1942-1944 example-bullet 規格）
// 支援：- top, **bold**, 縮排子項（  - sub）
function markdownBulletsToHtml(md) {
  if (!md) return '<li>（無內容）</li>';
  var lines = md.split('\n');
  var html = '';
  var inSub = false;
  lines.forEach(function (line) {
    if (/^\s*$/.test(line)) return;
    var indent = (line.match(/^\s*/) || [''])[0].length;
    var content = line.replace(/^\s*-\s*/, '').trim();
    if (!content) return;
    // bold
    content = content.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    if (indent >= 2) {
      if (!inSub) { html += '<ul class="example-sub">'; inSub = true; }
      html += '<li>' + content + '</li>';
    } else {
      if (inSub) { html += '</ul>'; inSub = false; }
      html += '<li>' + content + '</li>';
    }
  });
  if (inSub) html += '</ul>';
  return html;
}
```

### Task 5：Run full regression + cold review

- [ ] jest 全跑，必 157/157
- [ ] Playwright phase1-hint-modal.spec.js — 全 pass
- [ ] Playwright phase1-example-expand.spec.js — 全 pass
- [ ] Playwright Phase 1 full regression — 不 regression
- [ ] Director cold review：
  - 走 C1 → I → R → C2 → L（加 2-3 sol）→ E（4 sol-card 4-field nested）→ S 流程
  - 每步點「提示」每個 button → 截圖 + Read PNG → modal 內容對 HINT_OVERLAY_TEXT
  - 每步點「範例答案」每個 button → 截圖 + Read PNG → expand 內容從 q.field_examples
  - 確認 上一步 在 mobile/tablet/desktop 都顯示
  - 確認 S 步 CTA = 「完成測驗」

### Task 6：3-doc sync + commit + push + live SOP

CLAUDE.md / PATH-2-HANDOFF.md / master-spec.md last-updated 同步。push origin main。提供 dev URL + step-by-step SOP 給 user 親跑驗收。

---

## §6 完工 criteria

- [ ] jest 157/157
- [ ] Playwright phase1-hint-modal.spec.js × 8 viewport 全 pass（10+ specs）
- [ ] Playwright phase1-example-expand.spec.js × 8 viewport 全 pass（10+ specs）
- [ ] Phase 1 full regression × 8 viewport 全 pass（不 regression）
- [ ] director cold review 7 step × 各 ≥ 1 hint click + 1 example click PNG Read
- [ ] eyeball walk doc `audit/eyeball-plan-b-sb8.md`
- [ ] live URL SOP 給 user 親跑

---

## §7 Anti-pattern 提醒（subagent 必讀）

- ❌ subagent 自己宣稱通過 — director cold review 會獨立 click + Read PNG 對證
- ❌ 用 idx 而非 fieldKey 找 modal/expand — DB key 用 fieldKey，idx 在 sol-card 場景重複會撞
- ❌ 把 `[object Object]` 漏到 production
- ❌ 不寫 ESC + backdrop close
- ❌ modal 不 single-instance（多開導致 z-index 戰）
- ❌ 跳 TDD（先寫 code 再 retro 寫 test）
