# SP4 Backend Implementation Plan — NSM Context 預生成

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 為 NSM 題庫（103 題）預生成 `context = { model, users, traps, insight }` 4 欄並把資料持久化到 `public/nsm-db.js`，前端優先讀 `q.context` 命中即不打 OpenAI／不打 fallback API；fallback `routes/nsm-context.js` 保留給未來新題 lazy 補。

**Architecture:**
- 將原本內嵌在 `public/app.js` 的 `NSM_QUESTIONS` 抽出到 `public/nsm-db.js` 作為 `window.NSM_QUESTIONS`（mirror CIRCLES 的 `circles-db.js` 模式）。
- 新增 `scripts/backfill-nsm-context.js`：載入 `public/nsm-db.js` → 對每題呼叫 `prompts/nsm-context.js#generateNSMContext` → 寫回 `public/nsm-db.js`，idempotent（已有完整 4 欄跳過）。
- `public/app.js` 的 NSM Step 1 fetch 邏輯改為：「優先讀 `q.context`，沒有才打 `/api/nsm-context`」。前端 renderer 結構不動。
- `routes/nsm-context.js` 不動（保留作 lazy fallback）。

**Tech Stack:** Node.js + jest 30 + OpenAI gpt-4o + 同 CIRCLES backfill 既有模式。

**Scope（鐵範圍）：** 只做 spec § A。**完全不碰** § B（Step 1 卡片 UI）/ § C（Step 4 4-tab UI）/ § D（前端 padding）。任何 CSS / mockup / renderer DOM 結構改動 = 退回。

---

## File Structure

| 檔案 | 動作 | 責任 |
|---|---|---|
| `public/nsm-db.js` | **新檔（derived）** | `window.NSM_QUESTIONS = [...]` — backfill script 唯一寫入處，含 `context` 欄位 |
| `public/index.html` | **Modify** | 加 `<script src="/nsm-db.js">`（在 app.js 之前） |
| `public/app.js` | **Modify** | (1) 刪除內嵌 `NSM_QUESTIONS` array（行 185-290）改成 `var NSM_QUESTIONS = window.NSM_QUESTIONS \|\| [];` (2) `selectNSMQuestion` 的 fetch 邏輯改成 context-from-q-first |
| `scripts/backfill-nsm-context.js` | **新檔** | 載入 nsm-db.js → 對每題呼叫 generateNSMContext → 寫回 nsm-db.js；idempotent；分批處理 |
| `tests/sp4-nsm-context-backfill.test.js` | **新檔** | jest：(1) 103 題都有 context 4 欄 (2) nsm-db.js 解析後與題數一致 (3) 第二次跑 idempotent skip |
| `tests/sp4-nsm-db-extraction.test.js` | **新檔** | jest：(1) `public/app.js` 不再內嵌完整 NSM_QUESTIONS array（保留小 stub OK）(2) `public/nsm-db.js` 可被 vm 載入並產生 `window.NSM_QUESTIONS`，length === 103 |

---

## Task 1：抽 NSM_QUESTIONS 到 public/nsm-db.js（不含 context，純搬家 + 對齊 schema）

**目標：** 把現有 103 題從 `public/app.js` 行 185-290 搬到新檔 `public/nsm-db.js`，並在 `public/index.html` 引入。**這一 task 不打 OpenAI**，只做機械式搬家。task 完成後 jest 應仍 142 綠（純結構不變）。

**Files:**
- Create: `public/nsm-db.js`
- Modify: `public/app.js:184-290`
- Modify: `public/index.html`（在 `<script src="app.js">` 之前加 nsm-db.js）
- Create: `tests/sp4-nsm-db-extraction.test.js`

- [ ] **Step 1: 寫 failing test — extraction sanity**

```javascript
// tests/sp4-nsm-db-extraction.test.js
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

describe('NSM_QUESTIONS extracted to public/nsm-db.js', () => {
  const NSM_DB_PATH = path.join(__dirname, '..', 'public', 'nsm-db.js');
  const APP_PATH = path.join(__dirname, '..', 'public', 'app.js');

  test('public/nsm-db.js exists and exposes window.NSM_QUESTIONS with 103 entries', () => {
    expect(fs.existsSync(NSM_DB_PATH)).toBe(true);
    const src = fs.readFileSync(NSM_DB_PATH, 'utf8');
    const sandbox = { window: {} };
    vm.createContext(sandbox);
    vm.runInContext(src, sandbox);
    expect(Array.isArray(sandbox.window.NSM_QUESTIONS)).toBe(true);
    expect(sandbox.window.NSM_QUESTIONS.length).toBe(103);
  });

  test('every NSM question has core fields id/company/industry/scenario/coach_nsm/anti_patterns', () => {
    const src = fs.readFileSync(NSM_DB_PATH, 'utf8');
    const sandbox = { window: {} };
    vm.createContext(sandbox);
    vm.runInContext(src, sandbox);
    sandbox.window.NSM_QUESTIONS.forEach(q => {
      expect(typeof q.id).toBe('string');
      expect(typeof q.company).toBe('string');
      expect(typeof q.industry).toBe('string');
      expect(typeof q.scenario).toBe('string');
      expect(typeof q.coach_nsm).toBe('string');
      expect(Array.isArray(q.anti_patterns)).toBe(true);
    });
  });

  test('public/app.js no longer embeds the 103-element NSM_QUESTIONS literal', () => {
    const src = fs.readFileSync(APP_PATH, 'utf8');
    // 應該只有一處宣告，且為 fallback 形式
    const fallbackPattern = /var\s+NSM_QUESTIONS\s*=\s*(?:window\.NSM_QUESTIONS|\(typeof window).*\|\|\s*\[\s*\]/;
    expect(src).toMatch(fallbackPattern);
    // 不應再出現 q1...q100 的內嵌定義（簡單 heuristic：偵測 100+ 條 id:'qN' 內嵌）
    const inlineMatches = src.match(/id\s*:\s*['"]q\d+['"]/g) || [];
    expect(inlineMatches.length).toBeLessThan(10); // app.js 可能有少數測試用 ID 但絕對 < 100
  });
});
```

- [ ] **Step 2: Run failing test**

Run: `npx jest tests/sp4-nsm-db-extraction.test.js`
Expected: FAIL（檔案不存在 / app.js 仍內嵌）

- [ ] **Step 3: 抽出 array — 用 node 一次性產生 nsm-db.js**

執行下列 node 腳本（**不要手抄 103 題**）；它會 parse 出原本的 array 並寫到新檔：

```bash
node -e "
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync('public/app.js', 'utf8');
const start = src.indexOf('const NSM_QUESTIONS = [');
if (start < 0) throw new Error('NSM_QUESTIONS literal not found');
// 從 const NSM_QUESTIONS = 之後的 [ 開始，找對應結束的 ];
const arrStart = src.indexOf('[', start);
let depth = 0, i = arrStart;
for (; i < src.length; i++) {
  if (src[i] === '[') depth++;
  else if (src[i] === ']') { depth--; if (depth === 0) break; }
}
const arrLiteral = src.slice(arrStart, i + 1);
// 用 Function 求值（沒有外部依賴變數）
const arr = (new Function('return ' + arrLiteral))();
if (!Array.isArray(arr) || arr.length !== 103) {
  throw new Error('expected 103 entries, got ' + arr.length);
}
const header = '// Auto-generated — do not edit manually\n// Run: node -r dotenv/config scripts/backfill-nsm-context.js to regenerate context fields\n';
const body = 'window.NSM_QUESTIONS = ' + JSON.stringify(arr, null, 2) + ';\n';
fs.writeFileSync('public/nsm-db.js', header + body, 'utf8');
console.log('Wrote public/nsm-db.js with', arr.length, 'questions');
"
```

Expected: console 印 `Wrote public/nsm-db.js with 103 questions`

- [ ] **Step 4: 改 public/app.js — 刪除內嵌 array，改用 fallback**

`public/app.js` 行 184-290 整段（從 `// ── NSM 題庫（100 題 database + 3 計畫獨有）────────` 到 `];`）替換為：

```javascript
// ── NSM 題庫（從 public/nsm-db.js 載入，含預生成 context）────────
const NSM_QUESTIONS = (typeof window !== 'undefined' && Array.isArray(window.NSM_QUESTIONS))
  ? window.NSM_QUESTIONS
  : [];
```

- [ ] **Step 5: 改 public/index.html — 在 app.js 之前載入 nsm-db.js**

找到 `<script src="circles-db.js"></script>` 那一行（或同等位置），在 `<script src="app.js">` 之前加：

```html
<script src="nsm-db.js"></script>
```

- [ ] **Step 6: Run all tests**

Run: `npx jest`
Expected: 145 passed（142 baseline + 3 new tests in sp4-nsm-db-extraction），0 failed

- [ ] **Step 7: Commit**

```bash
git add public/nsm-db.js public/index.html public/app.js tests/sp4-nsm-db-extraction.test.js
git commit -m "refactor(nsm): 抽 NSM_QUESTIONS 至 public/nsm-db.js（同 circles-db.js 模式）"
```

---

## Task 2：寫 backfill 腳本（idempotent，不打 OpenAI 的單元邏輯先驗）

**目標：** 寫 `scripts/backfill-nsm-context.js`，模仿 `scripts/backfill-circles-analysis.js`，但目標檔是 `public/nsm-db.js`（而非 JSON 為 truth）。本 task 先寫腳本骨架 + idempotent 邏輯 + jest unit test 驗證 schema check / completeness check 函式（不打 OpenAI）。

**Files:**
- Create: `scripts/backfill-nsm-context.js`
- Modify: `tests/sp4-nsm-context-backfill.test.js`（新檔）

- [ ] **Step 1: 寫 failing test — script structure & helpers**

```javascript
// tests/sp4-nsm-context-backfill.test.js
'use strict';

const path = require('path');
const fs = require('fs');

describe('scripts/backfill-nsm-context.js', () => {
  const SCRIPT_PATH = path.join(__dirname, '..', 'scripts', 'backfill-nsm-context.js');

  test('script file exists', () => {
    expect(fs.existsSync(SCRIPT_PATH)).toBe(true);
  });

  test('exposes isContextComplete + loadQuestions + saveQuestions for testability', () => {
    const mod = require(SCRIPT_PATH);
    expect(typeof mod.isContextComplete).toBe('function');
    expect(typeof mod.loadQuestions).toBe('function');
    expect(typeof mod.saveQuestions).toBe('function');
  });

  test('isContextComplete returns true only when all 4 fields present and non-empty', () => {
    const { isContextComplete } = require(SCRIPT_PATH);
    expect(isContextComplete({})).toBe(false);
    expect(isContextComplete({ context: {} })).toBe(false);
    expect(isContextComplete({ context: { model: 'a', users: 'b', traps: 'c' } })).toBe(false);
    expect(isContextComplete({ context: { model: 'a', users: 'b', traps: 'c', insight: '' } })).toBe(false);
    expect(isContextComplete({ context: { model: 'a', users: 'b', traps: 'c', insight: 'd' } })).toBe(true);
  });

  test('loadQuestions reads public/nsm-db.js and returns array of 103', () => {
    const { loadQuestions } = require(SCRIPT_PATH);
    const qs = loadQuestions();
    expect(Array.isArray(qs)).toBe(true);
    expect(qs.length).toBe(103);
  });

  test('saveQuestions roundtrip preserves length and id order', () => {
    const { loadQuestions, saveQuestions } = require(SCRIPT_PATH);
    const original = loadQuestions();
    saveQuestions(original);
    const reloaded = loadQuestions();
    expect(reloaded.length).toBe(original.length);
    expect(reloaded.map(q => q.id)).toEqual(original.map(q => q.id));
  });
});
```

- [ ] **Step 2: Run failing test**

Run: `npx jest tests/sp4-nsm-context-backfill.test.js`
Expected: FAIL（script 不存在）

- [ ] **Step 3: 寫 scripts/backfill-nsm-context.js**

```javascript
'use strict';

/**
 * backfill-nsm-context.js
 *
 * 為 public/nsm-db.js 中的 NSM 題目補填 context 欄位 { model, users, traps, insight }。
 * Idempotent：已有完整 context 4 欄的題目跳過，不呼叫 OpenAI。
 *
 * 用法：
 *   node -r dotenv/config scripts/backfill-nsm-context.js
 *   node -r dotenv/config scripts/backfill-nsm-context.js --dry-run
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const NSM_DB_PATH = path.join(__dirname, '..', 'public', 'nsm-db.js');
const MAX_RETRIES = 3;
const CHUNK_SIZE = 5;

function isContextComplete(q) {
  if (!q || !q.context) return false;
  const c = q.context;
  return ['model', 'users', 'traps', 'insight'].every(
    k => typeof c[k] === 'string' && c[k].trim().length > 0
  );
}

function loadQuestions() {
  const src = fs.readFileSync(NSM_DB_PATH, 'utf8');
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  if (!Array.isArray(sandbox.window.NSM_QUESTIONS)) {
    throw new Error('public/nsm-db.js 未產生 window.NSM_QUESTIONS array');
  }
  return sandbox.window.NSM_QUESTIONS;
}

function saveQuestions(questions) {
  const header = '// Auto-generated — do not edit manually\n// Run: node -r dotenv/config scripts/backfill-nsm-context.js to regenerate context fields\n';
  const body = 'window.NSM_QUESTIONS = ' + JSON.stringify(questions, null, 2) + ';\n';
  fs.writeFileSync(NSM_DB_PATH, header + body, 'utf8');
}

async function fetchContext(q) {
  // Lazy require：jest unit tests 不需要載入 prompts（避免讀環境變數）
  const { generateNSMContext } = require('../prompts/nsm-context');
  let lastError;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const ctx = await generateNSMContext({ question_json: q });
      // schema check
      for (const k of ['model', 'users', 'traps', 'insight']) {
        if (typeof ctx[k] !== 'string' || !ctx[k].trim()) {
          throw new Error('schema: missing or empty field "' + k + '"');
        }
      }
      return ctx;
    } catch (err) {
      lastError = err;
      if (attempt < MAX_RETRIES) {
        const delay = 1000 * attempt;
        console.log(`  第 ${attempt} 次失敗，${delay}ms 後重試：${err.message}`);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
  throw lastError;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  if (dryRun) console.log('[DRY RUN] OpenAI calls will run; results NOT saved.');

  if (!process.env.OPENAI_API_KEY) {
    console.error('錯誤：請設定環境變數 OPENAI_API_KEY（或用 node -r dotenv/config 載入 .env）');
    process.exit(1);
  }

  let questions;
  try {
    questions = loadQuestions();
  } catch (e) {
    console.error('載入 public/nsm-db.js 失敗：', e.message);
    process.exit(1);
  }

  console.log(`載入完成：共 ${questions.length} 道 NSM 題目`);

  const total = questions.length;
  let backfilled = 0;
  let skipped = 0;
  const failed = [];

  for (let i = 0; i < total; i += CHUNK_SIZE) {
    const chunk = questions.slice(i, Math.min(i + CHUNK_SIZE, total));

    for (let j = 0; j < chunk.length; j++) {
      const q = chunk[j];
      const idx = i + j + 1;
      const tag = `[${String(idx).padStart(3, ' ')}/${total}] ${q.id} (${q.company})`;

      if (isContextComplete(q)) {
        console.log(`${tag} — 已有 context，跳過`);
        skipped++;
        continue;
      }

      console.log(`${tag} — 生成 context...`);
      try {
        const ctx = await fetchContext(q);
        q.context = {
          model: ctx.model,
          users: ctx.users,
          traps: ctx.traps,
          insight: ctx.insight,
        };
        backfilled++;
      } catch (err) {
        console.error(`  FAILED: ${q.id} — ${err.message}`);
        failed.push(q.id);
      }
    }

    // 每批結束後立即寫回，保留部分進度
    if (!dryRun) saveQuestions(questions);
  }

  console.log('\n完成！');
  console.log(`  補填：${backfilled} 道`);
  console.log(`  跳過：${skipped} 道`);
  console.log(`  失敗：${failed.length} 道${failed.length > 0 ? '（' + failed.join(', ') + '）' : ''}`);

  if (failed.length > 0) {
    console.error('\n有題目失敗，請重跑腳本補齊。');
    process.exit(1);
  }
}

module.exports = { isContextComplete, loadQuestions, saveQuestions, fetchContext };

// 只有當被直接執行時才跑 main（require 時不跑，方便 jest）
if (require.main === module) {
  main().catch(err => {
    console.error('未預期錯誤：', err);
    process.exit(1);
  });
}
```

- [ ] **Step 4: Run unit tests**

Run: `npx jest tests/sp4-nsm-context-backfill.test.js`
Expected: 5 passed

- [ ] **Step 5: Run all tests（驗證沒有 regress baseline）**

Run: `npx jest`
Expected: 150 passed（142 baseline + 3 extraction + 5 backfill helper unit tests）

- [ ] **Step 6: Commit**

```bash
git add scripts/backfill-nsm-context.js tests/sp4-nsm-context-backfill.test.js
git commit -m "feat(nsm): 加入 backfill-nsm-context 腳本與 idempotent helper unit tests"
```

---

## Task 3：前端優先讀 q.context（fallback 保留）

**目標：** 改 `public/app.js` 的 `selectNSMQuestion`：若 `q.context` 已存在（4 欄齊全），直接寫入 `AppState.nsmContext` 不打 fetch；否則走原本 fetch fallback。**不動 renderer DOM 結構、不動 CSS。**

**Files:**
- Modify: `public/app.js:6125-6168`（`selectNSMQuestion` 的 needFetch 區塊）
- Create: `tests/sp4-nsm-context-prefer-pregenerated.test.js`

- [ ] **Step 1: 寫 failing test — pure-function form of "context-from-q-first"**

`selectNSMQuestion` 是 DOM 互動函式，難在 jest 純跑。改採以下策略：將判斷邏輯抽成可測純函式 `getNsmContextSource(q, currentContext, currentQid)`，在 jest 中驗 truth table。前端 selectNSMQuestion 內呼叫此函式決定走哪條路。

```javascript
// tests/sp4-nsm-context-prefer-pregenerated.test.js
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

describe('NSM context source selection (prefer q.context over fetch)', () => {
  // 把 app.js 載到 sandbox 是過大；改用 grep + 直接驗純函式被引用
  const APP_PATH = path.join(__dirname, '..', 'public', 'app.js');
  const src = fs.readFileSync(APP_PATH, 'utf8');

  test('app.js exposes / defines getNsmContextSource helper', () => {
    expect(src).toMatch(/function\s+getNsmContextSource\s*\(/);
  });

  test('getNsmContextSource returns "pregenerated" when q.context has all 4 fields', () => {
    // 把單一函式 eval 出來測
    const m = src.match(/function\s+getNsmContextSource\s*\([^)]*\)\s*\{[\s\S]*?\n\}/);
    expect(m).not.toBeNull();
    const fnSrc = m[0];
    const fn = (new Function(fnSrc + '\nreturn getNsmContextSource;'))();
    const q = { id: 'q1', context: { model: 'm', users: 'u', traps: 't', insight: 'i' } };
    expect(fn(q, null, null)).toBe('pregenerated');
  });

  test('getNsmContextSource returns "cached" when AppState already has context for this qid', () => {
    const m = src.match(/function\s+getNsmContextSource\s*\([^)]*\)\s*\{[\s\S]*?\n\}/);
    const fn = (new Function(m[0] + '\nreturn getNsmContextSource;'))();
    const q = { id: 'q1' }; // 沒有 q.context
    expect(fn(q, { model: 'x', users: 'y', traps: 'z', insight: 'w' }, 'q1')).toBe('cached');
  });

  test('getNsmContextSource returns "fetch" when no q.context and no cache', () => {
    const m = src.match(/function\s+getNsmContextSource\s*\([^)]*\)\s*\{[\s\S]*?\n\}/);
    const fn = (new Function(m[0] + '\nreturn getNsmContextSource;'))();
    expect(fn({ id: 'q1' }, null, null)).toBe('fetch');
  });

  test('getNsmContextSource returns "fetch" when q.context exists but is incomplete', () => {
    const m = src.match(/function\s+getNsmContextSource\s*\([^)]*\)\s*\{[\s\S]*?\n\}/);
    const fn = (new Function(m[0] + '\nreturn getNsmContextSource;'))();
    const q = { id: 'q1', context: { model: 'm', users: 'u' } }; // 缺 traps + insight
    expect(fn(q, null, null)).toBe('fetch');
  });
});
```

- [ ] **Step 2: Run failing test**

Run: `npx jest tests/sp4-nsm-context-prefer-pregenerated.test.js`
Expected: FAIL（getNsmContextSource 不存在）

- [ ] **Step 3: 在 public/app.js 加入 getNsmContextSource 並改 selectNSMQuestion**

在 `selectNSMQuestion` 函式之前（建議放 6115 行附近，在 `function getQuestionById` 旁邊），加入：

```javascript
function getNsmContextSource(q, currentContext, currentQid) {
  if (!q) return 'fetch';
  // 1. 若 q.context 4 欄齊全，直接用預生成
  var c = q.context;
  if (c &&
      typeof c.model === 'string' && c.model.trim() &&
      typeof c.users === 'string' && c.users.trim() &&
      typeof c.traps === 'string' && c.traps.trim() &&
      typeof c.insight === 'string' && c.insight.trim()) {
    return 'pregenerated';
  }
  // 2. 否則若 AppState 已有同 qid 的 cached context，沿用
  if (currentContext && currentQid === q.id) {
    return 'cached';
  }
  // 3. 否則走 fetch fallback
  return 'fetch';
}
```

接著改 `selectNSMQuestion` 中 `var needFetch = !AppState.nsmContext || AppState.nsmContextQuestionId !== q.id;` 該段（行 6131-6167）為：

```javascript
  // 決定 context 來源：優先預生成，再 cache，再 fetch
  var source = getNsmContextSource(q, AppState.nsmContext, AppState.nsmContextQuestionId);

  if (source === 'pregenerated') {
    AppState.nsmContext = {
      model: q.context.model,
      users: q.context.users,
      traps: q.context.traps,
      insight: q.context.insight,
    };
    AppState.nsmContextQuestionId = q.id;
    AppState.nsmContextLoading = false;
    refreshNSMStep1List();
  } else if (source === 'cached') {
    refreshNSMStep1List();
  } else {
    // source === 'fetch' — 走原本 lazy fallback
    AppState.nsmContextLoading = true;
    AppState.nsmContextQuestionId = q.id;
    refreshNSMStep1List();
    var ctx = null;
    try {
      var res = await fetch('/api/nsm-context', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionJson: q }),
      });
      if (res.ok) ctx = await res.json();
    } catch (_) { /* swallow; ctx stays null */ }

    if (!document.querySelector('.nsm-question-list')) return;
    if (!AppState.nsmSelectedQuestion || AppState.nsmSelectedQuestion.id !== q.id) return;
    if (AppState.nsmContextQuestionId !== q.id) return;

    AppState.nsmContextLoading = false;
    if (ctx) {
      AppState.nsmContext = ctx;
    } else {
      AppState.nsmContext = null;
      AppState.nsmContextQuestionId = null;
    }
    refreshNSMStep1List();
  }
}
```

- [ ] **Step 4: Run all tests**

Run: `npx jest`
Expected: 155 passed（150 + 5 new prefer-pregenerated tests）

- [ ] **Step 5: Commit**

```bash
git add public/app.js tests/sp4-nsm-context-prefer-pregenerated.test.js
git commit -m "feat(nsm): selectNSMQuestion 優先讀 q.context，fallback 保留 lazy fetch"
```

---

## Task 4：執行 backfill（OpenAI 真跑）+ idempotent 驗證

**目標：** 真的跑 backfill 把 103 題 context 填滿，並驗 idempotent。**user 已預先批准 OpenAI ~$0.50 預算。**

**Files:**
- Modify: `public/nsm-db.js`（被 backfill 寫入 context 欄位）

- [ ] **Step 1: 第一次跑 backfill**

Run: `node -r dotenv/config scripts/backfill-nsm-context.js 2>&1 | tee /tmp/backfill-nsm-1.log`
Expected: 最後一行 `補填：103 道` `跳過：0 道` `失敗：0 道`

如果失敗 < 10%（< 10 題），重跑一次（idempotent 會跳過已成功的）。
如果失敗率 >= 10%，停下來回報 controller。

- [ ] **Step 2: 驗證 — grep 每題都有 4 欄非空**

```bash
node -e "
const path = require('path');
const fs = require('fs');
const vm = require('vm');
const src = fs.readFileSync('public/nsm-db.js', 'utf8');
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(src, sandbox);
const qs = sandbox.window.NSM_QUESTIONS;
const bad = qs.filter(q => !q.context || !q.context.model || !q.context.users || !q.context.traps || !q.context.insight);
console.log('total:', qs.length, 'incomplete:', bad.length);
if (bad.length > 0) { console.log('failed ids:', bad.map(q => q.id)); process.exit(1); }
"
```

Expected: `total: 103 incomplete: 0`，exit 0

- [ ] **Step 3: 第二次跑 backfill（驗證 idempotent — 0 OpenAI call）**

Run: `node -r dotenv/config scripts/backfill-nsm-context.js 2>&1 | tee /tmp/backfill-nsm-2.log`
Expected: 最後一行 `補填：0 道` `跳過：103 道` `失敗：0 道`

驗證 log：
```bash
grep -c "已有 context" /tmp/backfill-nsm-2.log
```
Expected: `103`

```bash
grep -c "生成 context" /tmp/backfill-nsm-2.log
```
Expected: `0`

- [ ] **Step 4: 加 jest 驗收 test — 103 題 context 完整性**

把以下 test case append 到 `tests/sp4-nsm-context-backfill.test.js`：

```javascript
describe('NSM context completeness post-backfill', () => {
  const path = require('path');
  const fs = require('fs');
  const vm = require('vm');
  const NSM_DB_PATH = path.join(__dirname, '..', 'public', 'nsm-db.js');

  test('all 103 questions have non-empty context.{model,users,traps,insight}', () => {
    const src = fs.readFileSync(NSM_DB_PATH, 'utf8');
    const sandbox = { window: {} };
    vm.createContext(sandbox);
    vm.runInContext(src, sandbox);
    const qs = sandbox.window.NSM_QUESTIONS;
    expect(qs.length).toBe(103);
    const bad = qs.filter(q => {
      if (!q.context) return true;
      const c = q.context;
      return !(typeof c.model === 'string' && c.model.trim()) ||
             !(typeof c.users === 'string' && c.users.trim()) ||
             !(typeof c.traps === 'string' && c.traps.trim()) ||
             !(typeof c.insight === 'string' && c.insight.trim());
    });
    if (bad.length > 0) {
      throw new Error('Incomplete context: ' + bad.map(q => q.id).join(', '));
    }
    expect(bad.length).toBe(0);
  });
});
```

- [ ] **Step 5: Run all tests**

Run: `npx jest`
Expected: 156 passed（前一輪 155 + 1 new completeness assertion）

- [ ] **Step 6: Commit**

```bash
git add public/nsm-db.js tests/sp4-nsm-context-backfill.test.js
git commit -m "data(nsm): 為 103 題預生成 context（model/users/traps/insight）"
```

---

## Task 5：最終 sign-off — 14-box（簡化 backend-only 版本）

**目標：** 結尾盤點，把結果寫入 `audit/sp4-backend-signoff.md`。

**Files:**
- Create: `audit/sp4-backend-signoff.md`

- [ ] **Step 1: 跑全套 jest 並收集結果**

Run: `npx jest 2>&1 | tail -20 | tee /tmp/sp4-final-jest.log`
Expected: 156 passed total

- [ ] **Step 2: 確認 git history 乾淨**

Run: `git log --oneline main..HEAD`
Expected: 4 commits（refactor/feat/feat/data 順序），全 zh-TW commit message

- [ ] **Step 3: 確認 spec coverage**

對 spec § A 四個 sub-bullet 逐條 ✓：
- [x] 每題 NSM_QUESTIONS 加 `context` 4 欄 — Task 4 完成
- [x] `scripts/backfill-nsm-context.js` 載入 + 呼叫 generateNSMContext + 寫回 + idempotent — Task 2/4
- [x] `routes/nsm-context.js` 保留作 fallback — 不動（驗證未刪除）
- [x] 前端優先讀 q.context — Task 3

確認沒做 § B（Step 1 卡片 UI）/ § C（4 tab UI）/ § D（padding）。
驗證：
```bash
git diff main..HEAD --stat -- public/style.css
# Expected: 沒有任何輸出（CSS 沒動）
```

- [ ] **Step 4: 寫 audit/sp4-backend-signoff.md**

```markdown
# SP4 Backend Sign-off — 2026-05-03

**Branch:** feat/sp4-backend
**HEAD:** <填 git rev-parse --short HEAD 的值>
**Spec:** docs/superpowers/specs/2026-05-02-sp4-nsm-upgrade-design.md（只覆蓋 § A）

## Box-by-box

| Box | 結果 |
|---|---|
| jest baseline 維持 142+ | ✓ 156/156 全綠 |
| 新增 jest test 全綠 | ✓ 14 個新增 cases（extraction 3 + backfill helper 5 + prefer-pregenerated 5 + completeness 1） |
| 無 console.error / console.warn 污染 | ✓ jest log 無新增 warning |
| commit history 乾淨 | ✓ 4 commits，全 zh-TW |
| spec § A 全覆蓋 | ✓（context 4 欄 / 腳本 idempotent / fallback 保留 / 前端優先讀 q.context） |
| 沒做 § B / § C / § D | ✓ public/style.css 0 行改動 |
| backfill idempotent 驗證 | ✓ 第二次跑 0 OpenAI call、103 跳過 |
| OpenAI 預算 | <填實際估算> 美元（授權 0.50） |
| .env / 機敏檔 未被 commit | ✓（git status 確認） |

## 後續 review 必看
- `docs/superpowers/plans/2026-05-02-sp4-backend-plan.md`
- `audit/sp4-backend-signoff.md`（本檔）
- `public/nsm-db.js`（103 題 + context 預生成結果）

## 不 merge — 等 path 2 結束 user 親自決定
```

- [ ] **Step 5: Commit signoff doc**

```bash
git add audit/sp4-backend-signoff.md
git commit -m "docs(sp4): backend sign-off 紀錄"
```

---

## Self-Review

### Spec coverage（against `docs/superpowers/specs/2026-05-02-sp4-nsm-upgrade-design.md` § A）

| Spec 項 | 對應 task |
|---|---|
| 為每題 NSM_QUESTIONS 加 `context` 4 欄 | Task 4 |
| 寫 backfill 腳本 + idempotent | Task 2 + 4 |
| 從 app.js 抽出到 nsm-db.js | Task 1 |
| 對每題呼叫 prompts/nsm-context.js | Task 2 |
| routes/nsm-context.js 保留作 fallback | 不動（task 5 驗證） |
| 前端優先讀 q.context | Task 3 |

§ B / § C / § D 不在 backend 軌範圍 — 已在 plan 開頭明示，task 5 sign-off 也驗證沒動 style.css。

### Placeholder scan
- 沒有 TBD / TODO / "implement later"。
- 所有 code block 都是完整可貼可跑。
- Task 1 Step 3 用 node 一次性 parse + 寫檔，避免手抄 103 題（避免人為複製失誤）。

### Type / signature consistency
- `isContextComplete(q)`（task 2）/ `getNsmContextSource(q, currentContext, currentQid)`（task 3）— 名稱在所有 task / test 一致。
- `loadQuestions / saveQuestions` signature 一致。
- AppState field 名沿用既有 `nsmContext / nsmContextQuestionId / nsmContextLoading`，沒有改名。
- `q.context.{model, users, traps, insight}` schema 四個欄位名在 prompt / backfill / 前端 / test 全部一致。

### Plan 完整性
- 4 個工作 task + 1 個 sign-off task = 5 個 task。
- 每 task 有 failing test → impl → run → commit 完整 TDD 迴路。
- 預期 jest 數列升序：142 → 145 → 150 → 155 → 156。

---

## 後續

Plan 寫完 → 進 Gate 2 — superpowers:subagent-driven-development。
不必 user review checkpoint（user 已預授權執行）。
