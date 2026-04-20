# Report Enhancements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add dimension example questions, coach demo conversation, coach problem essence, and full-page PDF print to the PM Drill report.

---

## Completed Pre-work (2026-04-21)

These tasks were completed before executing this plan:

- [x] **Practice View UI Fixes** — removed accent progress bar from practice view, fixed negative-margin elements not reaching viewport edges (removed `overflow:hidden` from `main#main`), made `.btn-tool` use accent purple color, added inline hint feedback when "更新定義" clicked while disabled. Commits: `fix: resolve 4 practice view UI issues`, `fix: remove dead progressPct variable, minor css cleanup`

- [x] **Home Page Onboarding** — added onboarding section to `renderHome()` explaining First Principles thinking, 5 training dimensions (with Phosphor icons), and PM benefits. Added corresponding `.onboarding-*` CSS classes. Commit: `feat: add home page onboarding section for new users`

**Architecture:** Four backend changes (evaluator extended, new coach-demo module, both submit routes updated, DB column added) and four frontend changes (submitDefinition updated, renderReport 5-tab layout, review two-column layout, print CSS). Coach demo runs synchronously at submit time after evaluation. All coach data flows through `coach_demo_json` stored on the session. Visibility is automatic — coach content only renders when `coach_demo_json` is present.

**Tech Stack:** Vanilla JS (ES modules), Node.js/Express, Supabase (Postgres/JSONB), OpenAI GPT-4o JSON mode.

---

## File Map

| File | Change |
|------|--------|
| `prompts/coach-demo.js` | **New** — generates coach demo conversation + essence |
| `prompts/evaluator.js` | Add `exampleQuestion` per dimension + `essenceExample` top-level to prompt/output |
| `routes/guest-sessions.js` | Submit route: call `generateCoachDemo`, store `coach_demo_json`, return both |
| `routes/sessions.js` | Same for auth users |
| `public/app.js` | `submitDefinition()` store coachDemo; `renderReport()` 5 tabs, exampleQuestion, coach review column; remove idealFocus |
| `public/style.css` | Print CSS, `.review-two-col` layout |

**DB prerequisite (manual, before running):** Add column `coach_demo_json jsonb` to both `guest_sessions` and `practice_sessions` tables in Supabase. Default null. No migration script needed.

---

### Task 1: New backend module — `prompts/coach-demo.js` ✅ DONE (commit 71e4aac)

**Files:**
- Create: `prompts/coach-demo.js`

- [x] **Step 1: Create the file**

```javascript
const OpenAI = require('openai');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM = `
你是「完美學員」的示範者。你針對一個模糊的工作問題，以追問的方式挖掘問題本質。

規則：
1. 扮演優秀的 PM 學員向受訪者提問
2. 每輪只問一個聚焦的問題，從不同維度切入：角色定位、任務卡點、替代行為、損失量化
3. 同時模擬受訪者的回答（口語、2-4 句、只說自己知道的事）
4. 問 3-5 輪後，若已收集足夠資訊就停止
5. 最後提交一個中性問句的問題本質定義，並說明思路

輸出純 JSON，不要任何其他文字：
{
  "conversation": [
    {
      "coachQuestion": "向受訪者的提問（一句話）",
      "intervieweeReply": "受訪者回答（口語、2-4 句）"
    }
  ],
  "coachEssence": "問題本質定義（一句中性問句，不預設解法）",
  "coachReasoning": "為什麼這樣定義（2-3 句說明追問後的推論）"
}
`.trim();

async function generateCoachDemo(session) {
  const { issue_json: issue } = session;
  const userPrompt = `
原始 issue：
${issue.issueText}

來源角色：${issue.source}
產業：${issue.industry || ''}

請示範如何追問來找出問題本質。
`.trim();

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 1200,
      });
      return JSON.parse(response.choices[0].message.content);
    } catch (e) {
      if (attempt === 2) throw new Error('教練示範生成失敗');
    }
  }
}

module.exports = { generateCoachDemo };
```

- [x] **Step 2: Verify the module loads**

```bash
node -e "const {generateCoachDemo} = require('./prompts/coach-demo'); console.log('ok')"
```
Expected: `ok` with no errors.

- [x] **Step 3: Commit**

```bash
git add prompts/coach-demo.js
git commit -m "feat: add coach-demo module for generating coach demonstration conversation"
```

---

### Task 2: Extend evaluator — `exampleQuestion` + `essenceExample` ✅ DONE (commit 11ef5fb)

**Files:**
- Modify: `prompts/evaluator.js`

- [x] **Step 1: Update the SYSTEM prompt**

Find the `const SYSTEM` string. Replace the output format section with:

```javascript
const SYSTEM = `
你是嚴格的 PM 評審。輸出純 JSON，不要任何其他文字。

評分維度（各 20 分）：
- roleClarity：角色定位是否具體
- taskBreakpoint：任務卡點是否描述出行為斷點
- workaround：是否挖出用戶的替代行為
- lossQuantification：損失是否有具體維度或量級感
- definitionQuality：最終問題定義是否中性、不預設解法

輸出格式：
{
  "scores": {
    "roleClarity":        { "score": 0-20, "did": "...", "missed": "...", "tip": "...", "exampleQuestion": "如果是優秀學員，這個維度他會怎麼問（一句話）" },
    "taskBreakpoint":     { "score": 0-20, "did": "...", "missed": "...", "tip": "...", "exampleQuestion": "..." },
    "workaround":         { "score": 0-20, "did": "...", "missed": "...", "tip": "...", "exampleQuestion": "..." },
    "lossQuantification": { "score": 0-20, "did": "...", "missed": "...", "tip": "...", "exampleQuestion": "..." },
    "definitionQuality":  { "score": 0-20, "did": "...", "missed": "...", "tip": "...", "exampleQuestion": "..." }
  },
  "totalScore": 0-100,
  "essenceExample": "針對這個 issue，一個優質問題本質定義的範例（中性問句）",
  "highlights": {
    "bestMove": "這次練習最亮的一個動作（具體）",
    "mainTrap": "最容易掉進的陷阱（具體）",
    "summary": "一句話：這次練習讓問題從 X 變成了 Y"
  },
  "turnAnalysis": [
    { "turn": 1, "idealFocus": "這輪應該聚焦挖掘的面向（一句話）" }
  ]
}
`;
```

- [x] **Step 2: Verify the module still loads**

```bash
node -e "const {evaluate} = require('./prompts/evaluator'); console.log('ok')"
```
Expected: `ok`

- [x] **Step 3: Commit**

```bash
git add prompts/evaluator.js
git commit -m "feat: add exampleQuestion per dimension and essenceExample to evaluator output"
```

---

### Task 3: Submit routes — add coach demo, update response

**Files:**
- Modify: `routes/guest-sessions.js`
- Modify: `routes/sessions.js`

- [ ] **Step 1: Update `routes/guest-sessions.js` — add import and update submit route**

Add at top of file (after existing requires):
```javascript
const { generateCoachDemo } = require('../prompts/coach-demo');
```

Find the submit route body:
```javascript
  try {
    const scores = await evaluate({ ...session, final_definition: finalDefinition });
    await db.from('guest_sessions').update({
      final_definition: finalDefinition,
      scores_json: scores,
      status: 'completed',
      current_phase: 'done'
    }).eq('id', req.params.id);
    res.json(scores);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
```

Replace with:
```javascript
  try {
    const scores = await evaluate({ ...session, final_definition: finalDefinition });

    let coachDemo = null;
    try {
      coachDemo = await generateCoachDemo(session);
    } catch (e) {
      console.error('coach-demo failed:', e.message);
    }

    await db.from('guest_sessions').update({
      final_definition: finalDefinition,
      scores_json: scores,
      coach_demo_json: coachDemo,
      status: 'completed',
      current_phase: 'done'
    }).eq('id', req.params.id);

    res.json({ scores, coachDemo });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
```

- [ ] **Step 2: Update `routes/sessions.js` — same pattern for auth users**

Add at top of file:
```javascript
const { generateCoachDemo } = require('../prompts/coach-demo');
```

Find the submit route body in `sessions.js`:
```javascript
  try {
    const scores = await evaluate({ ...session, final_definition: finalDefinition });
    await db.from('practice_sessions').update({
      final_definition: finalDefinition,
      scores_json: scores,
      status: 'completed',
      current_phase: 'done'
    }).eq('id', req.params.id);
    res.json(scores);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
```

Replace with:
```javascript
  try {
    const scores = await evaluate({ ...session, final_definition: finalDefinition });

    let coachDemo = null;
    try {
      coachDemo = await generateCoachDemo(session);
    } catch (e) {
      console.error('coach-demo failed:', e.message);
    }

    await db.from('practice_sessions').update({
      final_definition: finalDefinition,
      scores_json: scores,
      coach_demo_json: coachDemo,
      status: 'completed',
      current_phase: 'done'
    }).eq('id', req.params.id);

    res.json({ scores, coachDemo });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
```

- [ ] **Step 3: Verify server still starts**

```bash
node -e "require('./routes/guest-sessions'); require('./routes/sessions'); console.log('ok')"
```
Expected: `ok`

- [ ] **Step 4: Commit**

```bash
git add routes/guest-sessions.js routes/sessions.js
git commit -m "feat: submit routes call generateCoachDemo and return {scores, coachDemo}"
```

---

### Task 4: Frontend — update `submitDefinition` to store coachDemo

**Files:**
- Modify: `public/app.js`

- [ ] **Step 1: Read app.js** (required before editing)

- [ ] **Step 2: Update `submitDefinition()`**

Find:
```javascript
    const scores = await res.json();
    if (!res.ok) throw new Error(scores.error);
    AppState.currentSession.scores_json = scores;
    AppState.currentSession.final_definition = def;
    AppState.currentSession.current_phase = 'done';
    AppState.activeReportTab = 'overview';
    navigate('report');
```

Replace with:
```javascript
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    AppState.currentSession.scores_json = data.scores;
    AppState.currentSession.coach_demo_json = data.coachDemo || null;
    AppState.currentSession.final_definition = def;
    AppState.currentSession.current_phase = 'done';
    AppState.activeReportTab = 'overview';
    navigate('report');
```

- [ ] **Step 3: Commit**

```bash
git add public/app.js
git commit -m "feat: submitDefinition stores coachDemo from updated API response"
```

---

### Task 5: CSS — print media query + review two-column layout

**Files:**
- Modify: `public/style.css`

- [ ] **Step 1: Read style.css** (required before editing)

- [ ] **Step 2: Append new styles at end of file**

```css

/* ── Review Two-Column Layout ── */
.review-two-col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  align-items: start;
}
.review-col-header {
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 12px;
  padding-bottom: 6px;
  border-bottom: 2px solid var(--border);
}
.review-col-header.coach { color: var(--accent); border-bottom-color: var(--accent); }
.coach-round {
  background: var(--bg-surface);
  border-radius: 10px;
  padding: 14px;
  margin-bottom: 10px;
  border-left: 3px solid var(--accent);
}
.coach-round-label { font-size: 0.78rem; font-weight: 600; color: var(--accent); margin-bottom: 6px; }
.coach-question { font-size: 0.875rem; color: var(--accent); margin-bottom: 6px; font-weight: 500; }
.coach-reply { font-size: 0.875rem; color: var(--text-secondary); }

@media (max-width: 600px) {
  .review-two-col { grid-template-columns: 1fr; }
}

/* ── 問題本質 Tab ── */
.essence-section {
  background: var(--bg-surface);
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 14px;
}
.essence-section-label {
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 8px;
}
.essence-text {
  font-size: 1rem;
  font-weight: 600;
  line-height: 1.5;
  color: var(--text-primary);
}
.essence-format {
  font-size: 0.85rem;
  color: var(--text-secondary);
  font-style: italic;
  border-left: 3px solid var(--border);
  padding-left: 10px;
  margin-top: 8px;
}
.essence-coach-text { color: var(--accent); }
.essence-reasoning {
  font-size: 0.875rem;
  color: var(--text-secondary);
  line-height: 1.6;
  margin-top: 8px;
}

/* ── Print CSS ── */
@media print {
  .navbar, .offcanvas, .offcanvas-overlay,
  .practice-bottom-bar, .tab-bar,
  .export-tab-actions { display: none !important; }

  .tab-pane { display: block !important; }
  .tab-pane + .tab-pane { page-break-before: always; }

  #app { max-width: 100% !important; padding: 8px 24px !important; }
  .score-summary-bar { padding: 12px 0; }
  .score-progress { display: none; }
}
```

- [ ] **Step 3: Commit**

```bash
git add public/style.css
git commit -m "feat: review two-column layout, essence tab styles, print CSS"
```

---

### Task 6: Frontend — `renderReport()` rebuild (5 tabs + all new content)

**Files:**
- Modify: `public/app.js`

This is the largest task. Replace the entire `renderReport()` function and update `bindReport()`.

- [ ] **Step 1: Add `DIM_STATIC` constant** — insert immediately before `const DIM_LABELS = {`

```javascript
const DIM_STATIC = {
  roleClarity:        '釐清抱怨者的實際角色、負責範圍與在流程中的位置',
  taskBreakpoint:     '找出具體的行為斷點——他在哪個步驟卡住、無法繼續',
  workaround:         '挖掘用戶現在怎麼繞過這個問題（暗示真正的痛點）',
  lossQuantification: '了解損失的維度與量級（時間、金錢、頻率、影響範圍）',
  definitionQuality:  '最終問句是否中性、不預設解法、聚焦在本質問題',
};
```

- [ ] **Step 2: Replace `renderReport()`**

Find the entire `renderReport()` function (from `function renderReport() {` to the closing `}`). Replace with:

```javascript
function renderReport() {
  const s = AppState.currentSession;
  const scores = s?.scores_json;
  if (!scores) return '<p style="padding:16px">沒有評分資料</p>';
  if (!scores.scores) return '<p style="padding:16px">評分資料不完整</p>';

  const coach = s.coach_demo_json;
  const dims = Object.keys(DIM_LABELS);
  const totalScore = scores.totalScore || 0;
  const turnCount = s.conversation?.length || s.turn_count || 0;
  const source = s.issue_json?.source || '';

  // ── Overview tab ──
  const scoreBars = dims.map(d => {
    const sc = scores.scores[d]?.score || 0;
    return `<div class="score-bar-row">
      <div class="score-bar-label">
        <span>${DIM_LABELS[d]}</span>
        <span style="color:${sc >= 14 ? 'var(--success)' : 'var(--warning)'}">${sc}/20</span>
      </div>
      <div class="score-bar-track"><div class="score-bar-fill" style="width:${sc / 20 * 100}%"></div></div>
    </div>`;
  }).join('');

  const scoreDetails = dims.map(d => {
    const dim = scores.scores[d] || {};
    const exQ = dim.exampleQuestion ? `
      <div class="score-detail-row" style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border)">
        <i class="ph ph-chat-circle-dots" style="color:var(--accent)"></i>
        <span><strong style="color:var(--accent)">示範問句：</strong>${escHtml(dim.exampleQuestion)}</span>
      </div>` : '';
    return `
    <div class="score-detail-card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
        <span style="font-weight:700;font-size:0.9rem;color:var(--accent)">${DIM_LABELS[d]}</span>
        <span style="font-size:0.75rem;color:var(--text-secondary)">${DIM_STATIC[d]}</span>
      </div>
      <div class="score-detail-row"><i class="ph ph-check-circle" style="color:var(--success)"></i><span>${escHtml(dim.did || '')}</span></div>
      <div class="score-detail-row"><i class="ph ph-x-circle" style="color:var(--danger)"></i><span>${escHtml(dim.missed || '')}</span></div>
      <div class="score-detail-row"><i class="ph ph-lightbulb" style="color:var(--accent)"></i><span>${escHtml(dim.tip || '')}</span></div>
      ${exQ}
    </div>`;
  }).join('');

  // ── Review tab ──
  const studentRounds = (s.conversation || []).map((t, i) => `
    <div class="review-card">
      <div class="review-card-round">第 ${i + 1} 輪</div>
      <div class="review-card-section"><div class="review-card-section-label">學員提問</div>${escHtml(t.userMessage)}</div>
      <div class="review-card-section"><div class="review-card-section-label">被訪談者</div>${escHtml(t.coachReply?.interviewee || '')}</div>
      <div class="review-card-section"><div class="review-card-section-label">教練點評</div>${escHtml(t.coachReply?.coaching || '')}</div>
    </div>`).join('');

  const coachRounds = coach ? coach.conversation.map((c, i) => `
    <div class="coach-round">
      <div class="coach-round-label">第 ${i + 1} 輪</div>
      <div class="coach-question">${escHtml(c.coachQuestion)}</div>
      <div class="coach-reply">${escHtml(c.intervieweeReply)}</div>
    </div>`).join('') : '';

  const reviewContent = `
    <div class="review-two-col">
      <div>
        <div class="review-col-header">學員練習</div>
        ${studentRounds}
      </div>
      <div>
        <div class="review-col-header coach">教練示範</div>
        ${coach ? coachRounds : '<p style="color:var(--text-secondary);font-size:0.875rem">（無示範資料）</p>'}
      </div>
    </div>`;

  // ── Highlights tab ──
  const highlights = scores.highlights || {};

  // ── Essence tab ──
  const essenceTab = `
    <div class="essence-section">
      <div class="essence-section-label">你的定義</div>
      <div class="essence-text">${escHtml(s.final_definition || '（未提交）')}</div>
    </div>
    <div class="essence-section">
      <div class="essence-section-label">優質格式範例</div>
      <div class="essence-format">如何讓 [具體角色] 在 [情境 / 流程節點] 降低 [可量化損失]？</div>
      ${scores.essenceExample ? `<div class="essence-text" style="margin-top:12px">${escHtml(scores.essenceExample)}</div>` : ''}
    </div>
    ${coach ? `
    <div class="essence-section" style="border-left:3px solid var(--accent)">
      <div class="essence-section-label" style="color:var(--accent)">教練的定義</div>
      <div class="essence-text essence-coach-text">${escHtml(coach.coachEssence || '')}</div>
      <div class="essence-reasoning">${escHtml(coach.coachReasoning || '')}</div>
    </div>` : ''}`;

  const tab = AppState.activeReportTab;
  const tabs = [
    { id: 'overview',   label: '評分總覽', short: '總覽' },
    { id: 'review',     label: '練習回顧', short: '回顧' },
    { id: 'highlights', label: '亮點摘要', short: '亮點' },
    { id: 'essence',    label: '問題本質', short: '本質' },
    { id: 'export',     label: '匯出',     short: '匯出' },
  ];

  return `
    <div class="score-summary-bar">
      <div>
        <div class="score-big">${totalScore}</div>
        <div class="score-meta">${escHtml(source)} · ${turnCount} 輪</div>
      </div>
      <div class="score-progress">
        <div class="score-progress-fill" style="width:${Math.min(100, totalScore)}%"></div>
      </div>
    </div>
    <div class="tab-bar">
      ${tabs.map(t => `
        <button class="tab-btn ${tab === t.id ? 'active' : ''}" data-tab="${t.id}">
          <span class="tab-label-full">${t.label}</span>
          <span class="tab-label-short">${t.short}</span>
        </button>`).join('')}
    </div>
    <div class="tab-content" id="report-content">
      <div class="tab-pane ${tab === 'overview' ? 'active' : ''}" id="tab-overview">
        <div class="radar-container">${renderRadar(scores.scores)}</div>
        ${scoreBars}
        ${scoreDetails}
      </div>
      <div class="tab-pane ${tab === 'review' ? 'active' : ''}" id="tab-review">
        ${reviewContent}
      </div>
      <div class="tab-pane ${tab === 'highlights' ? 'active' : ''}" id="tab-highlights">
        <div class="highlight-card">
          <i class="ph ph-trophy highlight-icon trophy"></i>
          <div><div style="font-weight:700;margin-bottom:4px">最佳亮點</div>${escHtml(highlights.bestMove || '')}</div>
        </div>
        <div class="highlight-card">
          <i class="ph ph-warning highlight-icon warning-icon"></i>
          <div><div style="font-weight:700;margin-bottom:4px">主要陷阱</div>${escHtml(highlights.mainTrap || '')}</div>
        </div>
        <div class="highlight-summary">${escHtml(highlights.summary || '')}</div>
      </div>
      <div class="tab-pane ${tab === 'essence' ? 'active' : ''}" id="tab-essence">
        ${essenceTab}
      </div>
      <div class="tab-pane ${tab === 'export' ? 'active' : ''}" id="tab-export">
        <div class="export-tab-actions">
          <button class="btn btn-ghost" id="btn-export-pdf"><i class="ph ph-file-pdf"></i> 匯出 PDF</button>
          <button class="btn btn-ghost" id="btn-export-png"><i class="ph ph-image"></i> 匯出 PNG</button>
          <p class="export-hint">PDF 使用瀏覽器列印；PNG 截取報告畫面</p>
          <button class="btn btn-primary" id="btn-practice-again">再練一次</button>
        </div>
      </div>
    </div>
  `;
}
```

- [ ] **Step 3: Update `bindReport()`** — add `btn-practice-again` listener and keep existing listeners

Find `function bindReport() {`. Replace the entire function:

```javascript
function bindReport() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      AppState.activeReportTab = btn.dataset.tab;
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`tab-${btn.dataset.tab}`)?.classList.add('active');
    });
  });
  document.getElementById('btn-export-pdf')?.addEventListener('click', exportPDF);
  document.getElementById('btn-export-png')?.addEventListener('click', exportPNG);
  document.getElementById('btn-practice-again')?.addEventListener('click', () => navigate('home'));
}
```

- [ ] **Step 4: Verify no JS errors** — open browser, navigate to a completed session's report. Check DevTools console for errors.

- [ ] **Step 5: Commit**

```bash
git add public/app.js
git commit -m "feat: 5-tab report with coach demo review, essence tab, dimension example questions"
```

---

### Task 7: Manual verification — end-to-end test

- [ ] **Step 1: Add `coach_demo_json` column in Supabase**

In Supabase table editor, add column `coach_demo_json` (type: jsonb, default: null) to both `guest_sessions` and `practice_sessions`.

- [ ] **Step 2: Complete a full practice session**

1. Open http://localhost:4000, select any difficulty
2. Send 3+ messages
3. Fill problem essence, click submit
4. Wait for loading (slightly longer than before — coach demo is generating)
5. Verify report page loads

- [ ] **Step 3: Verify each tab**

- **評分總覽**: Each dimension card shows 示範問句 below the tip row
- **練習回顧**: Two-column layout — student left (紫色教練示範), coach right
- **亮點摘要**: Unchanged
- **問題本質**: Student definition, static format example, coach definition in purple, reasoning
- **匯出**: PDF button → browser print dialog shows all 5 tab sections

- [ ] **Step 4: Verify print CSS**

Click PDF → browser print preview. Confirm all 5 sections appear on separate pages, navbar hidden.

- [ ] **Step 5: Commit if any minor fixes needed**

```bash
git add -A
git commit -m "fix: <describe fix>"
```
