# NSM 教練思路 + 維度提示 + 情境導讀 + Session 狀態即時更新 實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 四項強化：(1) Step 1 選題後即顯示靜態類型框架 + 背景 AI 生成公司專屬破題提示；(2) Step 3 每個維度有 AI 依題目/NSM 生成的可展開提示；(3) Step 4 教練版拆解點擊後顯示「設計思路」說明；(4) Home session 列表在 NSM 進行中/完成後即時反映正確狀態。最後經極度嚴苛的 UI/UX 稽核員審查所有問題並全部修復。

**Architecture:**
- `prompts/nsm-context.js`：新輕量 AI 模組，接受 question_json 輸出公司破題導讀（gpt-4o-mini，~1s）。
- `prompts/nsm-hints.js`：新輕量 AI 模組，接受 question_json + user_nsm 輸出 4 維度可展開提示（gpt-4o-mini）。
- 兩個新無狀態端點 `POST /api/nsm-context`（不需要 session）和路由中的 `POST /:id/hints`，guest/auth 兩版。
- `nsm-evaluator.js` 擴充輸出 `coachRationale`，存入 scores_json（JSONB，無需 DB migration）。
- 前端：AppState 加 `nsmContext`、`nsmContextLoading`、`nsmHints`、`nsmHintsLoading`；navigate 改 async 以在切回首頁時重新載入 sessions。

**Tech Stack:** Vanilla JS (AppState + render)、Express.js、OpenAI GPT-4o / gpt-4o-mini (JSON mode)、Supabase JSONB

---

## 檔案影響範圍

| 檔案 | 操作 | 說明 |
|------|------|------|
| `prompts/nsm-context.js` | **新增** | 公司情境破題導讀生成器 |
| `prompts/nsm-hints.js` | **新增** | 維度輸入提示生成器 |
| `prompts/nsm-evaluator.js` | 修改 | 新增 `coachRationale` 欄位 |
| `routes/nsm-context.js` | **新增** | `POST /api/nsm-context` 無狀態端點 |
| `routes/nsm-sessions.js` | 修改 | 新增 `POST /:id/hints` |
| `routes/guest-nsm-sessions.js` | 修改 | 新增 `POST /:id/hints`（guest） |
| `server.js` | 修改 | 掛載 `/api/nsm-context` 路由 |
| `public/app.js` | 修改 | AppState、Step1/3/4 render+bind、navigate、loadRecentSessions |
| `public/style.css` | 修改 | 情境導讀卡、hint 按鈕、rationale 區塊樣式 |

---

## Task 1：公司情境破題導讀——後端（無狀態端點）

**Files:**
- Create: `prompts/nsm-context.js`
- Create: `routes/nsm-context.js`
- Modify: `server.js`

- [ ] **Step 1：建立 `prompts/nsm-context.js`**

```javascript
const OpenAI = require('openai');
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function generateNSMContext({ question_json }) {
  const { company, industry, scenario } = question_json;

  const prompt = `你是一位 PM 教練，正在為學員提供情境導讀，幫助不熟悉此產品的學員快速理解如何切入北極星指標。

公司：${company}
行業：${industry}
情境：${scenario}

請提供以下內容，幫助學員破題：

1. 一句話說明這家公司的核心商業模式（讓完全不熟悉的人也能理解）
2. 指出這家公司的主要「使用者類型」（誰在用、用來做什麼）
3. 點出這類產品在定義 NSM 時最常犯的 1 個陷阱
4. 給出 1 個思考切入點（不是答案，是方向）

回傳 JSON（繁體中文）：
{
  "businessModel": "<一句話：這家公司如何賺錢、核心服務是什麼>",
  "userTypes": "<主要用戶群是誰，用來做什麼事>",
  "commonTrap": "<這類產品最常見的虛榮指標陷阱>",
  "thinkingAngle": "<給學員的破題切入角度，一句話方向性指引>"
}`;

  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.3,
    response_format: { type: 'json_object' },
    messages: [{ role: 'user', content: prompt }]
  });
  return JSON.parse(response.choices[0].message.content);
}

module.exports = { generateNSMContext };
```

- [ ] **Step 2：建立 `routes/nsm-context.js`**

```javascript
const express = require('express');
const router = express.Router();
const { generateNSMContext } = require('../prompts/nsm-context');

// POST /api/nsm-context
// 無狀態端點，不需要 session ID，接受 question_json 直接生成導讀
router.post('/', async (req, res) => {
  const { questionJson } = req.body;
  if (!questionJson || !questionJson.company) {
    return res.status(400).json({ error: 'missing_question_json' });
  }
  try {
    const context = await generateNSMContext({ question_json: questionJson });
    res.json(context);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
```

- [ ] **Step 3：在 `server.js` 掛載路由**

在 `app.use('/api/nsm-sessions', ...)` 之前加入：
```javascript
app.use('/api/nsm-context', require('./routes/nsm-context'));
```

- [ ] **Step 4：驗證語法**

```bash
node --check prompts/nsm-context.js && node --check routes/nsm-context.js && echo "OK"
```

- [ ] **Step 5：Commit**

```bash
git add prompts/nsm-context.js routes/nsm-context.js server.js
git commit -m "feat(context): add NSM company context generation endpoint"
```

---

## Task 2：Step 1 選題後顯示情境導讀（前端）

**Files:**
- Modify: `public/app.js`（AppState、`renderNSMStep1`、`bindNSM`）
- Modify: `public/style.css`

- [ ] **Step 1：在 AppState 新增三個欄位**

找到 `const AppState = {` 並在 `nsmOpenNode: null,` 之後加入：

```javascript
  nsmContext: null,        // { businessModel, userTypes, commonTrap, thinkingAngle }
  nsmContextLoading: false,
  nsmContextQuestionId: null, // 記錄最後一次為哪個 question 生成 context
```

- [ ] **Step 2：更新 `renderNSMStep1` 在選中卡片時顯示情境導讀**

找到 `renderNSMStep1()` 中的 `const cards = questions.map(q => ...)` 並替換：

```javascript
  const cards = questions.map(q => {
    const isSelected = selected && selected.id === q.id;
    const productType = detectProductType(q);
    const typeMeta = NSM_TYPE_META[productType];

    // 情境導讀區塊（僅選中時顯示）
    let contextHtml = '';
    if (isSelected) {
      if (AppState.nsmContextLoading) {
        contextHtml = `
          <div class="nsm-context-preview loading">
            <i class="ph ph-circle-notch" style="animation:spin 0.8s linear infinite"></i>
            <span>分析情境中…</span>
          </div>`;
      } else if (AppState.nsmContext && AppState.nsmContextQuestionId === q.id) {
        const ctx = AppState.nsmContext;
        contextHtml = `
          <div class="nsm-context-preview">
            <div class="nsm-ctx-row"><span class="nsm-ctx-label"><i class="ph ph-buildings"></i> 商業模式</span><span class="nsm-ctx-val">${escHtml(ctx.businessModel)}</span></div>
            <div class="nsm-ctx-row"><span class="nsm-ctx-label"><i class="ph ph-users"></i> 使用者</span><span class="nsm-ctx-val">${escHtml(ctx.userTypes)}</span></div>
            <div class="nsm-ctx-row nsm-ctx-trap"><span class="nsm-ctx-label"><i class="ph ph-warning"></i> 常見陷阱</span><span class="nsm-ctx-val">${escHtml(ctx.commonTrap)}</span></div>
            <div class="nsm-ctx-row nsm-ctx-angle"><span class="nsm-ctx-label"><i class="ph ph-lightbulb"></i> 破題切入</span><span class="nsm-ctx-val">${escHtml(ctx.thinkingAngle)}</span></div>
          </div>`;
      }
    }

    return `
    <div class="nsm-question-card ${isSelected ? 'selected' : ''}" data-qid="${q.id}">
      <div class="nsm-q-header">
        <span class="nsm-company-badge">${escHtml(q.company)}</span>
        <span class="nsm-industry">${escHtml(q.industry)}</span>
        ${isSelected ? `<span class="nsm-type-badge" style="background:${typeMeta.color}18;color:${typeMeta.color};border:1px solid ${typeMeta.color}38"><i class="ph ${typeMeta.icon}"></i> ${typeMeta.label}</span>` : ''}
      </div>
      <p class="nsm-scenario">${escHtml(q.scenario)}</p>
      ${contextHtml}
    </div>`;
  }).join('');
```

- [ ] **Step 3：在 `bindNSM` 的 Step 1 card click handler 中加入背景 context 載入**

找到 `// Step 1: question selection` 並替換整個 forEach：

```javascript
  // Step 1: question selection
  document.querySelectorAll('.nsm-question-card[data-qid]').forEach(function(card) {
    card.addEventListener('click', async function() {
      var q = NSM_QUESTIONS.find(function(q) { return q.id === card.dataset.qid; }) || null;
      AppState.nsmSelectedQuestion = q;

      // 若切換到不同題目，重置 context
      if (q && AppState.nsmContextQuestionId !== q.id) {
        AppState.nsmContext = null;
        AppState.nsmContextQuestionId = null;
      }

      render();

      // 背景呼叫 AI 生成情境導讀
      if (q && !AppState.nsmContext && !AppState.nsmContextLoading) {
        AppState.nsmContextLoading = true;
        AppState.nsmContextQuestionId = q.id;
        render(); // 顯示 loading 狀態
        try {
          var res = await fetch('/api/nsm-context', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ questionJson: q })
          });
          if (res.ok) {
            AppState.nsmContext = await res.json();
          }
        } catch (_) {}
        AppState.nsmContextLoading = false;
        if (AppState.nsmSelectedQuestion && AppState.nsmSelectedQuestion.id === q.id) {
          render(); // 只有在仍選著同一題時才 re-render
        }
      }
    });
  });
```

- [ ] **Step 4：Step 1 next（進入 Step 2）時重置 context 相關狀態（改題時清除）**

找到 `// Step 1: next` 中 btnStep1Next click handler，在最後 `render()` 之前確認無需額外清除（context 保留到換題時才清，不影響 Step 2）。

- [ ] **Step 5：在 `style.css` 加入情境導讀 CSS**

在 `.nsm-question-card` 相關樣式之後加入：

```css
.nsm-context-preview {
  margin-top: 10px; padding: 12px; border-radius: 10px;
  background: var(--bg-surface); border: 1px solid var(--border);
  display: flex; flex-direction: column; gap: 8px;
}
.nsm-context-preview.loading {
  display: flex; flex-direction: row; align-items: center;
  gap: 8px; color: var(--text-secondary); font-size: 13px;
}
.nsm-ctx-row {
  display: flex; flex-direction: column; gap: 2px;
}
.nsm-ctx-label {
  font-size: 10.5px; font-weight: 700; color: var(--text-secondary);
  text-transform: uppercase; letter-spacing: 0.05em;
  display: flex; align-items: center; gap: 4px;
}
.nsm-ctx-val {
  font-size: 12.5px; color: var(--text-primary); line-height: 1.5;
}
.nsm-ctx-trap .nsm-ctx-label { color: var(--danger); }
.nsm-ctx-trap .nsm-ctx-val { color: var(--danger); opacity: 0.85; }
.nsm-ctx-angle .nsm-ctx-label { color: var(--accent); }
.nsm-ctx-angle .nsm-ctx-val { color: var(--accent); font-weight: 600; }
```

- [ ] **Step 6：驗證語法**

```bash
node --check public/app.js && echo "OK"
```

- [ ] **Step 7：Commit**

```bash
git add public/app.js public/style.css
git commit -m "feat(step1): show AI-generated company context after question selection"
```

---

## Task 3：新增 Hints 生成器（後端）

**Files:**
- Create: `prompts/nsm-hints.js`
- Modify: `routes/nsm-sessions.js`
- Modify: `routes/guest-nsm-sessions.js`

- [ ] **Step 1：建立 `prompts/nsm-hints.js`**

```javascript
const OpenAI = require('openai');
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function generateNSMHints({ question_json, user_nsm, product_type }) {
  const { company, scenario } = question_json;

  const typeHints = {
    attention:   '注意力型（媒體/社交/遊戲）',
    transaction: '交易量型（電商/共享平台/O2O）',
    creator:     '創造力型（UGC/知識/內容平台）',
    saas:        'SaaS 型（B2B/訂閱服務）',
  };

  const prompt = `你是一位 PM 教練，正在引導學員拆解北極星指標的輸入指標。

公司：${company}
情境：${scenario}
產品類型：${typeHints[product_type] || '注意力型'}
學員定義的 NSM：${user_nsm || '（尚未定義）'}

請為學員提供 4 個維度的引導提示。每個提示需要：
1. 針對「${company}」這個具體公司的情境
2. 以一個啟發性問題開頭（讓學員主動思考）
3. 接著給出 1 個具體的參考方向（不是答案，是思考方向）

回傳 JSON（繁體中文）：
{
  "reach": "<針對${company}的廣度維度：啟發性問題 + 參考方向，2-3句>",
  "depth": "<針對${company}的深度維度：啟發性問題 + 參考方向，2-3句>",
  "frequency": "<針對${company}的頻率維度：啟發性問題 + 參考方向，2-3句>",
  "impact": "<針對${company}的業務影響維度：啟發性問題 + 參考方向，2-3句>"
}`;

  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.4,
    response_format: { type: 'json_object' },
    messages: [{ role: 'user', content: prompt }]
  });
  return JSON.parse(response.choices[0].message.content);
}

module.exports = { generateNSMHints };
```

- [ ] **Step 2：定義共用 `guessProductType` 工具函數（避免重複）**

在 `routes/nsm-sessions.js` 頂部 require 區段之後，加入：

```javascript
const { generateNSMHints } = require('../prompts/nsm-hints');

function guessProductType(question_json) {
  const t = ((question_json.industry || '') + ' ' + (question_json.scenario || '') + ' ' + (question_json.company || '')).toLowerCase();
  if (/電商|marketplace|外賣|美食|租車|共享|打車|預訂|配送|撮合/.test(t)) return 'transaction';
  if (/saas|企業|b2b|crm|協作|辦公|工具|管理系統|自動化/.test(t)) return 'saas';
  if (/創作|creator|ugc|知識|課程|部落|newsletter|直播|podcast/.test(t)) return 'creator';
  return 'attention';
}
```

- [ ] **Step 3：在 `routes/nsm-sessions.js` 加入 `POST /:id/hints`**

在 `POST /:id/evaluate` 路由之後加入：

```javascript
// POST /api/nsm-sessions/:id/hints
router.post('/:id/hints', requireAuth, async (req, res) => {
  const { userNsm } = req.body;
  const { data: session, error } = await db
    .from('nsm_sessions')
    .select('question_json')
    .eq('id', req.params.id)
    .eq('user_id', req.user.id)
    .single();
  if (error || !session) return res.status(404).json({ error: 'not_found' });
  try {
    const hints = await generateNSMHints({
      question_json: session.question_json,
      user_nsm: userNsm || '',
      product_type: guessProductType(session.question_json),
    });
    res.json(hints);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
```

- [ ] **Step 4：在 `routes/guest-nsm-sessions.js` 加入相同路由（guest 版）**

在 `guest-nsm-sessions.js` 頂部加入：
```javascript
const { generateNSMHints } = require('../prompts/nsm-hints');

function guessProductType(question_json) {
  const t = ((question_json.industry || '') + ' ' + (question_json.scenario || '') + ' ' + (question_json.company || '')).toLowerCase();
  if (/電商|marketplace|外賣|美食|租車|共享|打車|預訂|配送|撮合/.test(t)) return 'transaction';
  if (/saas|企業|b2b|crm|協作|辦公|工具|管理系統|自動化/.test(t)) return 'saas';
  if (/創作|creator|ugc|知識|課程|部落|newsletter|直播|podcast/.test(t)) return 'creator';
  return 'attention';
}
```

在 `POST /:id/evaluate` 之後加入：

```javascript
// POST /api/guest/nsm-sessions/:id/hints
router.post('/:id/hints', requireGuestId, async (req, res) => {
  const { userNsm } = req.body;
  const { data: session, error } = await db
    .from('nsm_sessions')
    .select('question_json')
    .eq('id', req.params.id)
    .eq('guest_id', req.guestId)
    .single();
  if (error || !session) return res.status(404).json({ error: 'not_found' });
  try {
    const hints = await generateNSMHints({
      question_json: session.question_json,
      user_nsm: userNsm || '',
      product_type: guessProductType(session.question_json),
    });
    res.json(hints);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
```

- [ ] **Step 5：驗證語法**

```bash
node --check prompts/nsm-hints.js && node --check routes/nsm-sessions.js && node --check routes/guest-nsm-sessions.js && echo "All OK"
```

- [ ] **Step 6：Commit**

```bash
git add prompts/nsm-hints.js routes/nsm-sessions.js routes/guest-nsm-sessions.js
git commit -m "feat(hints): add per-dimension AI hint generation endpoint"
```

---

## Task 4：Step 3 維度可展開教練提示（前端）

**Files:**
- Modify: `public/app.js`（AppState、`renderNSMStep3`、`bindNSM`）
- Modify: `public/style.css`

- [ ] **Step 1：在 AppState 新增 hint 相關欄位**

在 `nsmContextQuestionId: null,` 之後加入：

```javascript
  nsmHints: null,          // { reach, depth, frequency, impact }
  nsmHintsLoading: false,
```

- [ ] **Step 2：更新 `renderNSMStep3` 在每個維度欄位加入可展開提示按鈕**

找到 `renderNSMStep3()` 中的 `const fields = dimensions.map(d => ...)` 並替換：

```javascript
  const fields = dimensions.map(d => {
    const hint = (AppState.nsmHints || {})[d.key] || '';
    return `
    <div class="nsm-dim-section">
      <div class="nsm-dim-header" style="border-left-color:${d.color}">
        <div class="nsm-dim-label">${escHtml(d.label)}</div>
        <div class="nsm-dim-desc">${escHtml(d.subtitle)}</div>
      </div>
      <div class="nsm-coach-q"><i class="ph ph-chat-dots" style="color:${d.color}"></i> ${escHtml(d.coachQ)}</div>
      <button class="nsm-hint-btn" data-dim="${d.key}" type="button">
        <i class="ph ph-lightbulb"></i> 查看教練提示
      </button>
      <div class="nsm-hint-content" id="nsm-hint-${d.key}" style="display:none">
        ${hint ? `<div class="nsm-hint-revealed">${escHtml(hint)}</div>` : ''}
      </div>
      <textarea class="nsm-textarea nsm-dim-input" id="nsm-dim-${d.key}" placeholder="${escHtml(d.placeholder)}" rows="2">${escHtml(breakdown[d.key] || '')}</textarea>
    </div>`;
  }).join('');
```

- [ ] **Step 3：在 `bindNSM` 的 Step 3 區段（dimension inputs listener 之後）加入 hint 按鈕 handler**

```javascript
  // Step 3: hint buttons — reveal on tap, AI-generated on first click
  document.querySelectorAll('.nsm-hint-btn[data-dim]').forEach(function(btn) {
    btn.addEventListener('click', async function() {
      var dim = btn.dataset.dim;
      var contentEl = document.getElementById('nsm-hint-' + dim);
      if (!contentEl) return;

      // 若 hints 已載入，直接 toggle
      if (AppState.nsmHints) {
        var isVisible = contentEl.style.display !== 'none';
        if (!isVisible) {
          var hintText = AppState.nsmHints[dim] || '暫無此維度提示';
          contentEl.innerHTML = '<div class="nsm-hint-revealed">' + escHtml(hintText) + '</div>';
        }
        contentEl.style.display = isVisible ? 'none' : 'block';
        return;
      }

      // 第一次點擊：觸發 AI 生成（全部 4 維度同時）
      if (AppState.nsmHintsLoading) return;
      AppState.nsmHintsLoading = true;

      document.querySelectorAll('.nsm-hint-btn').forEach(function(b) {
        b.innerHTML = '<i class="ph ph-circle-notch" style="animation:spin 0.8s linear infinite"></i> 生成提示中…';
        b.disabled = true;
      });

      try {
        var sessionId = AppState.nsmSession ? AppState.nsmSession.id : '';
        var headers = { 'Content-Type': 'application/json' };
        if (AppState.accessToken) headers['Authorization'] = 'Bearer ' + AppState.accessToken;
        else headers['X-Guest-ID'] = AppState.guestId;
        var hintBase = AppState.accessToken ? '/api/nsm-sessions' : '/api/guest/nsm-sessions';
        var res = await fetch(hintBase + '/' + sessionId + '/hints', {
          method: 'POST',
          headers: headers,
          body: JSON.stringify({ userNsm: AppState.nsmNsmDraft || '' })
        });
        if (res.ok) AppState.nsmHints = await res.json();
      } catch (_) {}

      AppState.nsmHintsLoading = false;

      document.querySelectorAll('.nsm-hint-btn').forEach(function(b) {
        b.innerHTML = '<i class="ph ph-lightbulb"></i> 查看教練提示';
        b.disabled = false;
      });

      // 展開觸發 dim 的內容
      if (AppState.nsmHints && AppState.nsmHints[dim]) {
        contentEl.innerHTML = '<div class="nsm-hint-revealed">' + escHtml(AppState.nsmHints[dim]) + '</div>';
        contentEl.style.display = 'block';
      }
    });
  });
```

- [ ] **Step 4：Step 2 → Step 3 跳轉時清除舊 hints（換題後重新生成）**

找到 `bindNSM` 中 `// Step 2: next` 的 btnStep2Next click handler，在 `AppState.nsmStep = 3; render();` 之前加入：
```javascript
      AppState.nsmHints = null;
      AppState.nsmHintsLoading = false;
```

- [ ] **Step 5：在 `style.css` 加入 hint 按鈕與展開內容樣式**

在 `.nsm-coach-q` 樣式之後加入：

```css
.nsm-hint-btn {
  display: flex; align-items: center; gap: 6px; width: 100%;
  background: transparent; border: 1.5px dashed var(--accent);
  border-radius: 8px; padding: 7px 12px; margin-bottom: 8px;
  font-size: 12.5px; font-weight: 600; color: var(--accent);
  cursor: pointer; min-height: 36px; transition: background 0.15s;
  font-family: inherit;
}
.nsm-hint-btn:hover { background: rgba(108,99,255,0.07); }
.nsm-hint-btn:disabled { opacity: 0.6; cursor: not-allowed; }
.nsm-hint-content { margin-bottom: 8px; }
.nsm-hint-revealed {
  background: rgba(108,99,255,0.06); border-radius: 8px;
  padding: 10px 12px; font-size: 13px; color: var(--text-primary);
  line-height: 1.6; border-left: 3px solid var(--accent);
}
```

- [ ] **Step 6：驗證語法**

```bash
node --check public/app.js && echo "OK"
```

- [ ] **Step 7：Commit**

```bash
git add public/app.js public/style.css
git commit -m "feat(step3): add contextual AI hints per dimension, reveal on tap"
```

---

## Task 5：Step 4 教練版拆解顯示設計思路

**Files:**
- Modify: `prompts/nsm-evaluator.js`（擴充 coachRationale）
- Modify: `public/app.js`（renderNSMStep4 comparisonTab、bindNSM tree click）
- Modify: `public/style.css`

- [ ] **Step 1：在 `nsm-evaluator.js` 的 prompt 中新增 `coachRationale` 欄位**

找到 prompt 中 `"coachTree": { ... }` 結尾的逗號，在其後加入：

```
  "coachRationale": {
    "nsm": "<2-3 句：教練為何這樣定義 NSM——從 AHA 時刻切入、排除哪些虛榮指標、如何預測商業結果>",
    "reach": "<2-3 句：廣度指標選擇邏輯——對應哪個核心行為、為何不選登入數或 DAU>",
    "depth": "<2-3 句：深度指標設計邏輯——如何衡量互動品質、與 NSM 的數學關係>",
    "frequency": "<2-3 句：頻率指標選擇依據——如何體現習慣養成、與長期留存的關聯>",
    "impact": "<2-3 句：業務影響指標邏輯——如何連結用戶行為與商業變現>"
  },
```

完整替換 prompt 中從 `"coachTree":` 到 `"summary":` 的區段：

```javascript
  "coachTree": {
    "nsm": "<教練版 NSM，一句話，包含量化描述>",
    "reach": "<教練版廣度指標，依產品類型詮釋，一句話>",
    "depth": "<教練版深度指標，依產品類型詮釋，一句話>",
    "frequency": "<教練版頻率指標，依產品類型詮釋，一句話>",
    "impact": "<教練版業務影響指標，依產品類型詮釋，一句話>"
  },
  "coachRationale": {
    "nsm": "<2-3 句：教練為何這樣定義 NSM——從 AHA 時刻切入、排除哪些虛榮指標、如何直接預測商業結果>",
    "reach": "<2-3 句：廣度指標選擇邏輯——對應哪個核心用戶行為、為何不選登入數或 DAU>",
    "depth": "<2-3 句：深度指標設計邏輯——如何衡量互動品質、與 NSM 的數學關係>",
    "frequency": "<2-3 句：頻率指標選擇依據——如何體現習慣養成、與長期留存的關聯>",
    "impact": "<2-3 句：業務影響指標邏輯——如何連結用戶行為與商業變現、為何優先選這個>"
  },
  "bestMove": "<學員最大亮點，1-2 句>",
  "mainTrap": "<學員主要陷阱，1-2 句>",
  "summary": "<整體總評，3-4 句>"
```

- [ ] **Step 2：更新 `renderNSMStep4` comparisonTab 的教練欄標題加「點擊查看思路」提示**

找到 `comparisonTab` 中教練欄標題，替換為：

```javascript
        <div class="nsm-tree-title"><i class="ph ph-graduation-cap"></i> 教練版本 <span class="nsm-tree-hint-tip">點擊查看思路</span></div>
```

教練節點加上 `data-is-coach="1"`：

```javascript
        <div class="nsm-tree-node nsm-tree-root nsm-tree-coach" data-node="coach-nsm" data-label="NSM" data-is-coach="1">${escHtml(coachTree.nsm || '')}</div>
        ${cmpDims.map(d => `<div class="nsm-tree-node nsm-tree-coach" data-node="coach-${d.key}" data-label="${escHtml(d.label)}" data-is-coach="1">${escHtml(coachTree[d.key] || '')}</div>`).join('')}
```

- [ ] **Step 3：更新 `bindNSM` 的 tree click handler 顯示 rationale**

找到 `// Step 4: comparison tree tap`，替換整個 handler：

```javascript
  // Step 4: comparison tree tap
  document.querySelectorAll('.nsm-tree-node[data-node]').forEach(function(node) {
    node.addEventListener('click', function() {
      var detailEl = document.getElementById('nsm-node-detail');
      if (!detailEl) return;
      var key = node.dataset.node;
      var isCoach = node.dataset.isCoach === '1';
      var dim = key.replace('coach-','').replace('user-','');
      var dimLabel = node.dataset.label || dim;
      var sc = AppState.nsmSession ? (AppState.nsmSession.scores_json || {}) : {};
      var ctree = sc.coachTree || {};
      var rationale = sc.coachRationale || {};
      var bd = (AppState.nsmSession && AppState.nsmSession.user_breakdown) || AppState.nsmBreakdownDraft || {};

      var metricText = isCoach
        ? (ctree[dim] || '—')
        : (dim === 'nsm' ? (AppState.nsmNsmDraft || '（未填寫）') : (bd[dim] || '（未填寫）'));
      var prefix = isCoach ? '教練版 ' : '你的 ';
      var rationaleText = isCoach ? (rationale[dim] || '') : '';

      if (AppState.nsmOpenNode === key) {
        AppState.nsmOpenNode = null;
        detailEl.style.display = 'none';
        detailEl.innerHTML = '';
      } else {
        AppState.nsmOpenNode = key;
        detailEl.style.display = 'block';
        detailEl.innerHTML =
          '<div class="nsm-detail-metric">' +
            '<span class="nsm-detail-prefix">' + escHtml(prefix + dimLabel) + '</span>' +
            '<p class="nsm-detail-value">' + escHtml(metricText) + '</p>' +
          '</div>' +
          (rationaleText
            ? '<div class="nsm-rationale">' +
                '<div class="nsm-rationale-head"><i class="ph ph-lightbulb"></i> 教練設計思路</div>' +
                '<p class="nsm-rationale-body">' + escHtml(rationaleText) + '</p>' +
              '</div>'
            : '');
      }
    });
  });
  // Restore open node if any
  if (AppState.nsmOpenNode) {
    var openNode = document.querySelector('.nsm-tree-node[data-node="' + AppState.nsmOpenNode + '"]');
    if (openNode) openNode.click();
  }
```

- [ ] **Step 4：在 `style.css` 加入 rationale 與 detail 樣式**

在 `.nsm-node-detail` 之後加入：

```css
.nsm-tree-hint-tip {
  font-size: 10px; font-weight: 400; color: var(--text-tertiary);
  margin-left: 4px; font-style: italic;
}
.nsm-detail-metric { margin-bottom: 10px; }
.nsm-detail-prefix {
  font-size: 11px; font-weight: 700; color: var(--text-secondary);
  text-transform: uppercase; letter-spacing: 0.04em; display: block;
}
.nsm-detail-value {
  font-size: 13px; color: var(--text-primary); line-height: 1.5; margin: 4px 0 0;
}
.nsm-rationale {
  background: rgba(108,99,255,0.07); border-radius: 10px;
  padding: 12px 14px; border-left: 3px solid var(--accent);
}
.nsm-rationale-head {
  display: flex; align-items: center; gap: 6px;
  font-size: 12px; font-weight: 700; color: var(--accent); margin-bottom: 6px;
}
.nsm-rationale-body {
  font-size: 12.5px; color: var(--text-primary); line-height: 1.6; margin: 0;
}
```

- [ ] **Step 5：驗證語法**

```bash
node --check prompts/nsm-evaluator.js && node --check public/app.js && echo "All OK"
```

- [ ] **Step 6：Commit**

```bash
git add prompts/nsm-evaluator.js public/app.js public/style.css
git commit -m "feat(step4): show coach design rationale in comparison tree"
```

---

## Task 6：Session 列表即時狀態更新

**Files:**
- Modify: `public/app.js`（`navigate`、Step 1 next、Step 3 submit 後更新邏輯）

- [ ] **Step 1：將 `navigate` 改為 async，切回首頁時重新載入 sessions**

找到 `function navigate(view) {` 並完整替換：

```javascript
async function navigate(view) {
  closeOffcanvas();
  AppState.view = view;
  document.body.dataset.view = view;
  if (view === 'home') {
    render();                      // 先 render 避免白屏
    await loadRecentSessions();
    if (AppState.view === 'home') render(); // sessions 載入後重繪
  } else {
    render();
  }
}
```

- [ ] **Step 2：NSM session 建立後（Step 1 next 成功）立即加入 AppState.recentSessions**

找到 `// Step 1: next` 的 try 區塊，在 `AppState.nsmSession = { id: data.sessionId };` 之後加入：

```javascript
        // 加入 recentSessions（進行中）
        if (AppState.nsmSelectedQuestion) {
          var newEntry = {
            id: data.sessionId,
            type: 'nsm',
            status: 'in_progress',
            scores_json: null,
            question_json: AppState.nsmSelectedQuestion,
            created_at: new Date().toISOString()
          };
          AppState.recentSessions = [newEntry].concat(
            AppState.recentSessions.filter(function(s) { return s.id !== data.sessionId; })
          );
        }
```

- [ ] **Step 3：評分完成後（Step 3 submit 成功）立即更新對應 session 狀態**

找到 `// Step 3: submit` 的 try 區塊，在 `AppState.nsmStep = 4; render();` 之前加入：

```javascript
        // 即時更新 recentSessions 中對應 session
        var _sid = AppState.nsmSession ? AppState.nsmSession.id : null;
        if (_sid) {
          var _found = false;
          AppState.recentSessions = AppState.recentSessions.map(function(s) {
            if (s.id === _sid) { _found = true; return Object.assign({}, s, { status: 'completed', scores_json: data, type: 'nsm' }); }
            return s;
          });
          if (!_found && AppState.nsmSelectedQuestion) {
            AppState.recentSessions.unshift({
              id: _sid, type: 'nsm', status: 'completed',
              scores_json: data, question_json: AppState.nsmSelectedQuestion,
              created_at: new Date().toISOString()
            });
          }
        }
```

- [ ] **Step 4：驗證 `navigate` async 不影響現有 onclick 呼叫**

```bash
grep -n "navigate(" public/app.js | grep -v "^.*function navigate" | head -20
```

確認所有 `navigate(...)` 呼叫形式（onclick、addEventListener）均不依賴回傳值，async 變更不影響功能。

- [ ] **Step 5：驗證語法**

```bash
node --check public/app.js && echo "OK"
```

- [ ] **Step 6：Commit**

```bash
git add public/app.js
git commit -m "feat(home): instant session status update + refresh on navigate home"
```

---

## Task 7：極度嚴苛 UI/UX 稽核員審查 + 全部修復（聖旨）

**Files:** 依稽核員指令決定

- [ ] **Step 1：派遣嚴格 UI/UX 稽核員 agent**

以 `superpowers:code-reviewer` subagent 類型派遣，prompt 包含：
- 完整審查 `public/app.js`（NSM Step1/2/3/4 全部 render+bind 函數）
- 審查 `public/style.css`（所有 nsm- 前綴規則）
- 12 點稽核標準：觸控目標≥44px、iOS safe area、100dvh、鍵盤捲動、深色模式、完整使用者旅程（Home→Step1 選題→情境導讀出現→Step2 定義→Step3 拆解+提示→Step4 報告+思路→回首頁→列表更新）、錯誤狀態 inline 呈現、空狀態、無障礙性、文案一致性、新 UI 元件（情境導讀卡/hint 按鈕/rationale）可讀性、CSS 衝突
- 明確指示：所有意見為聖旨，全部修復

- [ ] **Step 2：根據稽核員所有意見全部修復**

無例外，每條 Critical/Major/Minor 問題均須修復，修復後再次確認：
```bash
node --check public/app.js && node --check prompts/nsm-evaluator.js && node --check prompts/nsm-hints.js && node --check prompts/nsm-context.js && echo "All syntax OK"
```

- [ ] **Step 3：Commit 全部稽核修復**

```bash
git add public/app.js public/style.css
git commit -m "fix(uiux): apply all strict auditor recommendations"
```

---

## 自我審查

**Spec 對應：**
- ✅ 選題後針對主題顯示破題提示 → Task 1（後端無狀態端點）+ Task 2（前端 Step1 情境導讀卡）
- ✅ Step 3 維度有題目針對性提示、點擊才顯示 → Task 3（後端 hints）+ Task 4（前端 hint 按鈕）
- ✅ Step 4 教練版本附設計思路 → Task 5（evaluator + 前端 rationale 展開）
- ✅ Session 列表進行中/完成狀態即時更新 → Task 6
- ✅ 嚴苛 UI/UX 稽核員 → Task 7

**Placeholder 掃描：** 無任何 TBD/TODO — 所有程式碼完整提供。

**型別一致性：**
- `coachRationale` 鍵名（nsm/reach/depth/frequency/impact）在 evaluator prompt、前端 bindNSM handler 一致
- `nsmHints`/`nsmHintsLoading`/`nsmContext`/`nsmContextLoading`/`nsmContextQuestionId` 均在 AppState 定義後使用
- `/api/nsm-context` 端點接受 `{ questionJson }` 在 routes 和前端 fetch 中一致

**潛在風險：**
- `navigate` 改 async 後，`onclick="navigate('home')"` 形式呼叫返回 Promise 但不影響功能（JS 忽略未 await 的 Promise）
- 舊 sessions 的 `scores_json` 無 `coachRationale`，前端已有 `sc.coachRationale || {}` fallback
- `nsm-context` 端點無認證保護（任何人可呼叫），可接受（只讀性操作，成本極低）
