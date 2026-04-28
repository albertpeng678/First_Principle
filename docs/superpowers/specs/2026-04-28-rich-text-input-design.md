# Rich Text Input Design Spec

**Date:** 2026-04-28
**Scope:** 把所有用戶答題的純 textarea 升級成支援 **bullet（巢狀列點）+ bold** 的輕量 markdown 編輯器。手機與桌面共用同一格式，差別只在 toolbar 呈現方式。
**Authoritative mockup folder:** `.superpowers/brainstorm/70171-1777356961/content/`

---

## 1. Decision summary

| 決策 | 結論 |
|---|---|
| Rich features | B — bullet + bold 兩個（不含標題、斜體、code 等） |
| 儲存格式 | markdown-ish 文字（`- `頂層、`  - `子項、`**bold**`）— 與 spec 1 範例格式一致 |
| 桌面 toolbar | inline 在 textarea 上方（4 顆按鈕：B 粗體 / • 列點 / ⇥ 縮排 / ⇤ 退縮） |
| 手機 toolbar | sticky-bottom on focus（黏在虛擬鍵盤上方） |
| 編輯器類型 | 純 textarea + JS 操作 selection（不引入 contenteditable / WYSIWYG / 第三方 lib） |
| 影響範圍 | 所有 user-input textarea：CIRCLES Phase 1 各步驟、conclusion box、NSM Step 2 / Step 3、Phase 2 chat input（不含 chat input — 對話格式不需 markdown） |

**確認的 Mockup files：**
- `mobile-toolbar-options.html`（4 種手機方案 → 選 B）
- `final-2-phase1-all-states.html` State 4（saving 狀態 toolbar）
- `final-2c-S-full-page.html`（S 步驟所有 textarea 含 toolbar 含 4 維度 sub-textarea）
- `final-2b-LES-examples-hints.html`（L/E 各欄位 toolbar）

---

## 2. Storage format

純字串，與 spec 1 範例渲染格式 100% 一致：

```
- 頂層第一點
- 頂層第二點
  - 子項 a
  - 子項 b
- 頂層第三點，含 **bold** 強調
```

**規則：**
- 頂層列點：行首 `- `（dash + space）
- 子項：行首 2 個空白 + `- `
- bold：`**X**` 雙星號包圍
- 換行：`\n`
- 空行（`\n\n`）一律標準化為單個 `\n`（toolbar 寫入時保證）

---

## 3. Toolbar UI

### 3.1 Buttons（4 顆）

| Icon / Label | Action | Keyboard shortcut |
|---|---|---|
| **B** | Bold（包圍/解除選取文字 `**X**`） | Ctrl/Cmd + B |
| `ph-list-bullets` `•` | List item（在游標所在行頭加 `- `；若已有則移除） | Ctrl/Cmd + L |
| `ph-text-indent` `⇥` | Indent（行首 +2 空白；只對已是 bullet 的行有效，否則忽略） | Tab |
| `ph-text-outdent` `⇤` | Outdent（行首 -2 空白） | Shift + Tab |

### 3.2 Desktop toolbar HTML

```html
<div class="rt-toolbar">
  <button class="rt-tbtn" data-rt-action="bold" title="粗體 (Ctrl+B)">
    <strong>B</strong>
  </button>
  <button class="rt-tbtn" data-rt-action="bullet" title="列點 (Ctrl+L)">
    <i class="ph ph-list-bullets"></i>
  </button>
  <button class="rt-tbtn" data-rt-action="indent" title="縮排 (Tab)">
    <i class="ph ph-text-indent"></i>
  </button>
  <button class="rt-tbtn" data-rt-action="outdent" title="退縮 (Shift+Tab)">
    <i class="ph ph-text-outdent"></i>
  </button>
</div>
<textarea class="rt-textarea" ...></textarea>
```

```css
.rt-toolbar {
  display:flex;
  gap:5px;
  padding:5px 6px;
  background:var(--c-surface);
  border:1px solid var(--c-border-mid);
  border-bottom:none;
  border-radius:6px 6px 0 0;
}
.rt-tbtn {
  padding:3px 8px;
  font-size:10.5px;
  border:1px solid var(--c-border-mid);
  background:#fff;
  border-radius:4px;
  cursor:pointer;
  color:var(--c-text-2);
  min-width:24px;
  display:inline-flex;
  align-items:center;
  justify-content:center;
}
.rt-tbtn:hover { background:var(--c-bg-alt); }
.rt-tbtn.active {
  background:var(--c-primary);
  color:#fff;
  border-color:var(--c-primary);
}
.rt-tbtn i { font-size:13px; }
.rt-textarea {
  border-radius:0 0 6px 6px;
  border-top:none;
  /* other styles inherited from existing .circles-field-input */
}
```

### 3.3 Mobile toolbar — sticky-bottom on focus

**結構：**

```html
<!-- 默認所有 toolbar 隱藏 -->
<div class="rt-toolbar-mobile" id="rt-toolbar-mobile" style="display:none">
  <button class="rt-mtbtn" data-rt-action="bold"><strong>B</strong> 粗體</button>
  <button class="rt-mtbtn" data-rt-action="bullet"><i class="ph ph-list-bullets"></i> 列點</button>
  <button class="rt-mtbtn" data-rt-action="indent"><i class="ph ph-text-indent"></i></button>
  <button class="rt-mtbtn" data-rt-action="outdent"><i class="ph ph-text-outdent"></i></button>
</div>
```

```css
@media (max-width: 1023px) {
  .rt-toolbar { display:none; }  /* 桌面 inline toolbar 隱藏 */
  .rt-toolbar-mobile {
    position:fixed;
    left:0; right:0;
    bottom:0;  /* 動態調整以避開鍵盤 */
    background:rgba(255,255,255,0.95);
    backdrop-filter:blur(8px);
    border-top:1px solid var(--c-border);
    padding:8px 12px;
    display:flex;
    gap:6px;
    z-index:200;
    padding-bottom:env(safe-area-inset-bottom, 8px);
  }
  .rt-mtbtn {
    flex:1;
    padding:8px 0;
    background:#fff;
    border:1px solid var(--c-border-mid);
    border-radius:6px;
    font-size:11px;
    min-height:36px;
    cursor:pointer;
    color:var(--c-text);
  }
  .rt-mtbtn i { font-size:13px; }
  .rt-mtbtn:active { background:var(--c-bg-alt); }
  .rt-mtbtn.active {
    background:var(--c-primary);
    color:#fff;
    border-color:var(--c-primary);
  }
}
```

**JS（focus / blur 控制）：**

```js
// Single global mobile toolbar that follows focused textarea
let _activeRtTextarea = null;
const mobileToolbar = document.getElementById('rt-toolbar-mobile');

function attachMobileToolbar() {
  document.addEventListener('focusin', (e) => {
    if (!e.target.classList?.contains('rt-textarea')) return;
    _activeRtTextarea = e.target;
    if (window.innerWidth >= 1024) return;  // desktop uses inline
    mobileToolbar.style.display = 'flex';
    // optional: scroll textarea into view above toolbar
    setTimeout(() => e.target.scrollIntoView({ block:'center', behavior:'smooth' }), 100);
  });

  document.addEventListener('focusout', (e) => {
    if (!e.target.classList?.contains('rt-textarea')) return;
    // delay close so toolbar tap doesn't fire before action
    setTimeout(() => {
      if (document.activeElement === e.target) return;
      if (mobileToolbar.contains(document.activeElement)) return;
      mobileToolbar.style.display = 'none';
      _activeRtTextarea = null;
    }, 200);
  });
}
```

**Visual viewport handling（避免被鍵盤遮）：**

```js
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', () => {
    if (mobileToolbar.style.display === 'flex') {
      mobileToolbar.style.bottom = `${window.innerHeight - window.visualViewport.height}px`;
    }
  });
}
```

### 3.4 Active 狀態

當游標在 bold 區域內時，B 按鈕 `.active` 顯示藍底白字。每次 `selectionchange` 事件偵測 `**` 之間。

```js
function updateToolbarState() {
  if (!_activeRtTextarea) return;
  var ta = _activeRtTextarea;
  var pos = ta.selectionStart;
  var text = ta.value;
  var inBold = isPositionInsideBold(text, pos);
  toolbar.querySelectorAll('[data-rt-action="bold"]').forEach(b => b.classList.toggle('active', inBold));
}
```

---

## 4. Action implementations

### 4.1 Bold

```js
function applyBold(ta) {
  var s = ta.selectionStart, e = ta.selectionEnd;
  var text = ta.value;
  var selected = text.slice(s, e);
  if (s === e) {
    // No selection: insert **|** with cursor in middle
    var inserted = '****';
    ta.value = text.slice(0, s) + inserted + text.slice(e);
    ta.selectionStart = ta.selectionEnd = s + 2;
  } else if (selected.startsWith('**') && selected.endsWith('**')) {
    // Selection already wraps **X** — unwrap
    ta.value = text.slice(0, s) + selected.slice(2, -2) + text.slice(e);
    ta.selectionStart = s; ta.selectionEnd = e - 4;
  } else {
    // Wrap
    ta.value = text.slice(0, s) + '**' + selected + '**' + text.slice(e);
    ta.selectionStart = s + 2; ta.selectionEnd = e + 2;
  }
  ta.dispatchEvent(new Event('input', { bubbles:true }));
}
```

### 4.2 Bullet toggle

```js
function applyBullet(ta) {
  var s = ta.selectionStart;
  var text = ta.value;
  // Find current line
  var lineStart = text.lastIndexOf('\n', s - 1) + 1;
  var lineEnd = text.indexOf('\n', s); if (lineEnd < 0) lineEnd = text.length;
  var line = text.slice(lineStart, lineEnd);
  var newLine;
  // Already has "- " prefix (with optional 2-space indent) — remove it
  var m = line.match(/^( {0,2})- (.*)$/);
  if (m) {
    newLine = m[1] + m[2];
  } else {
    newLine = '- ' + line;
  }
  ta.value = text.slice(0, lineStart) + newLine + text.slice(lineEnd);
  // adjust caret
  var diff = newLine.length - line.length;
  ta.selectionStart = ta.selectionEnd = s + diff;
  ta.dispatchEvent(new Event('input', { bubbles:true }));
}
```

### 4.3 Indent / outdent

```js
function applyIndent(ta, delta) {  // delta = +2 or -2
  var s = ta.selectionStart;
  var text = ta.value;
  var lineStart = text.lastIndexOf('\n', s - 1) + 1;
  var lineEnd = text.indexOf('\n', s); if (lineEnd < 0) lineEnd = text.length;
  var line = text.slice(lineStart, lineEnd);
  // only operate on bullet lines
  var m = line.match(/^( *)- /);
  if (!m) return;
  var currentIndent = m[1].length;
  var newIndent;
  if (delta > 0) newIndent = Math.min(currentIndent + 2, 4);  // max 2 levels (4 spaces)
  else newIndent = Math.max(currentIndent - 2, 0);
  if (newIndent === currentIndent) return;
  var newLine = ' '.repeat(newIndent) + line.trimStart();
  ta.value = text.slice(0, lineStart) + newLine + text.slice(lineEnd);
  ta.selectionStart = ta.selectionEnd = s + (newIndent - currentIndent);
  ta.dispatchEvent(new Event('input', { bubbles:true }));
}
```

### 4.4 Auto-bullet on Enter

當游標在 bullet 行末尾按 Enter，自動加 `- `：

```js
ta.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' || e.shiftKey) return;
  var s = ta.selectionStart;
  var text = ta.value;
  var lineStart = text.lastIndexOf('\n', s - 1) + 1;
  var line = text.slice(lineStart, s);
  var m = line.match(/^( *)- /);
  if (!m) return;
  // If current bullet line is empty (just "- "), exit bullet mode
  if (line.trim() === '-') {
    e.preventDefault();
    ta.value = text.slice(0, lineStart) + '\n' + text.slice(s);
    ta.selectionStart = ta.selectionEnd = lineStart + 1;
    ta.dispatchEvent(new Event('input', { bubbles:true }));
    return;
  }
  e.preventDefault();
  var indent = m[1];
  var insert = '\n' + indent + '- ';
  ta.value = text.slice(0, s) + insert + text.slice(s);
  ta.selectionStart = ta.selectionEnd = s + insert.length;
  ta.dispatchEvent(new Event('input', { bubbles:true }));
});
```

### 4.5 Tab / Shift+Tab handling

```js
ta.addEventListener('keydown', (e) => {
  if (e.key !== 'Tab') return;
  var s = ta.selectionStart;
  var text = ta.value;
  var lineStart = text.lastIndexOf('\n', s - 1) + 1;
  var line = text.slice(lineStart, text.indexOf('\n', s) >= 0 ? text.indexOf('\n', s) : text.length);
  if (!/^ *- /.test(line)) return;  // only bullet lines
  e.preventDefault();
  applyIndent(ta, e.shiftKey ? -2 : +2);
});
```

---

## 5. Apply to existing textareas

### 5.1 Class-based opt-in

只在需要 rich text 的 textarea 加 `class="rt-textarea"`。其他（如 chat input）不加。

**目標 textarea：**
- `.circles-field-input`（Phase 1 各步驟欄位）
- `.conclusion-textarea`（Phase 2 conclusion box）
- `.nsm-textarea`（NSM Step 2 / Step 3）
- L 步驟方案機制 textarea
- E 步驟 per-solution 4 子欄位 textarea
- S 步驟 4 維度子 textarea

**不加的：**
- `.circles-input`（Phase 2 chat 輸入框）
- `.nsm-input`（NSM Step 2 北極星指標 single-line input）
- `#email`、`#password`（auth form）

### 5.2 Init helper

```js
function initRichTextarea(ta) {
  if (ta._rtInited) return;
  ta._rtInited = true;
  ta.addEventListener('keydown', handleRtKeydown);
  ta.addEventListener('input', updateToolbarState);
  ta.addEventListener('select', updateToolbarState);
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('textarea.rt-textarea').forEach(initRichTextarea);
});

// Re-init after re-renders
function bindAfterRender() {
  document.querySelectorAll('textarea.rt-textarea').forEach(initRichTextarea);
}
```

### 5.3 Toolbar wrapper

每個 `.rt-textarea` 上方自動插入 toolbar（在 `render*` 函式內手動寫入）：

```js
function buildRtField(opts) {
  return `
    <div class="rt-toolbar">
      <button class="rt-tbtn" data-rt-action="bold"><strong>B</strong></button>
      <button class="rt-tbtn" data-rt-action="bullet"><i class="ph ph-list-bullets"></i></button>
      <button class="rt-tbtn" data-rt-action="indent"><i class="ph ph-text-indent"></i></button>
      <button class="rt-tbtn" data-rt-action="outdent"><i class="ph ph-text-outdent"></i></button>
    </div>
    <textarea class="rt-textarea" data-field="${opts.key}" rows="${opts.rows||2}"
      placeholder="${opts.placeholder||''}">${opts.value||''}</textarea>
  `;
}
```

---

## 6. Render pipeline alignment with spec 1

存儲值、render 顯示流程：

1. 使用者輸入 → toolbar 操作或鍵盤 → textarea.value 變化
2. spec 2 自動儲存把 textarea.value 傳到 server（store as-is，包含 `**bold**` 與 `\n` 與 `  - ` 等）
3. 當需要 render（範例展開、教練示範、conclusion 預覽等）→ spec 1 parser 把字串轉成 `<ul>...</ul>` HTML

**Spec 1 parser 流程已在 spec 1 文件（`2026-04-28-circles-examples-bullet-format-design.md` 第 4.2 節）詳述，本 spec 不重複。**

---

## 7. Mobile-specific edge cases

### 7.1 iOS Safari keyboard 重疊

`visualViewport.height` 偵測鍵盤高度；toolbar `position:fixed; bottom:{kbHeight}px`。

### 7.2 Android Chrome `safe-area-inset`

```css
.rt-toolbar-mobile { padding-bottom: max(8px, env(safe-area-inset-bottom)); }
```

### 7.3 IME（中文輸入法）相容

- bold 操作不要在 `compositionupdate` 時觸發（避免破壞輸入候選字）
- 加 `compositionstart` flag：

```js
ta.addEventListener('compositionstart', () => ta._composing = true);
ta.addEventListener('compositionend', () => ta._composing = false);
// In keydown handlers, early return if ta._composing
```

### 7.4 iPad 尺寸（768-1023）

iPad 介於 mobile 與 desktop 之間，當前 spec 用 desktop inline toolbar。如果用戶反映 iPad 偏好 mobile sticky-bottom，未來可加 detection（user-agent + touch capability）。

---

## 8. Audit / lint

### 8.1 Format validation

新增 `scripts/validate-rich-text.js`：
- 檢查所有保存的 user input 是否符合格式（`- ` / `  - ` / `**X**`）
- 警告：tab 字元、3 個以上空白縮排、未閉合 `**`

### 8.2 Visual regression

Playwright e2e：
- desktop 桌面：toolbar 顯示、按 B 看反應、按列點看反應
- mobile：textarea focus → toolbar 出現、blur → 消失、Enter 連續產生 bullet
- IME：模擬中文輸入過程不被打斷

---

## 9. Risks & mitigations

| Risk | Mitigation |
|---|---|
| 使用者貼 markdown 含其他語法（如 `*斜體*`、`# 標題`） | 不解析，直接存原樣（spec 1 渲染只認 bullet + bold） |
| 連續 Enter 產生很多空 bullet | 第 4.4 節已處理（空 bullet → 退出 bullet 模式） |
| iOS `selectionchange` 事件不一致 | 用 `selectionchange` + `selection.toString()` polling fallback |
| Toolbar 鍵盤遮擋 | visualViewport API + safe-area-inset 雙保險 |
| 桌面 inline toolbar 破壞既有 textarea 樣式 | toolbar 用 `border-bottom:none` + textarea `border-radius:0 0 6px 6px` 接縫 |
| 手機 toolbar 被 sticky footer 遮 | toolbar `z-index:200`，sticky footer 設較低 |

---

## 10. Test scenarios（高層）

詳細逐項見 implementation plan 的 test agent 工作項。簡要：

1. 桌面 toolbar 4 button 各 action 行為正確
2. 桌面 keyboard shortcut（Ctrl+B / Ctrl+L / Tab / Shift+Tab）
3. 手機 focus → toolbar 出現、blur → 消失
4. 手機 visualViewport 變化時 toolbar 位置正確
5. IME 中文輸入時 toolbar 不誤觸發
6. Auto-bullet on Enter
7. 空 bullet 退出
8. Tab / Shift+Tab 縮排層級
9. Bold wrap / unwrap / 空選取插入 `****`
10. 多 textarea 切換 focus 時 toolbar 切換正確
11. 與 spec 2 自動儲存整合（toolbar 操作觸發 input 事件，自動存）
12. 與 spec 1 渲染整合（存的字串能 render 成 bullet HTML）

---

## 11. Mockup HTML reference

| File | 內容 |
|---|---|
| `mobile-toolbar-options.html` | 4 種手機方案 → 採用 B（sticky-bottom on focus） |
| `final-2-phase1-all-states.html` | Phase 1 toolbar 在 saving 狀態的視覺、focus 樣式 |
| `final-2c-S-full-page.html` | S 步驟所有 textarea（含 4 維度 sub-textarea）的 toolbar |
| `final-2b-LES-examples-hints.html` | L/E 步驟 toolbar |

---

## 12. Implementation order

1. CSS：`.rt-toolbar`、`.rt-tbtn`、`.rt-textarea`、mobile media query
2. HTML build helper `buildRtField` 在 `app.js`
3. Action JS（bold / bullet / indent / outdent）
4. Keyboard shortcut handler + composition guard
5. Mobile sticky-bottom toolbar + visualViewport binding
6. 將所有目標 textarea 加 `.rt-textarea` class + 用 toolbar wrapper
7. Bind active state（B 按鈕高亮）
8. Playwright e2e tests
