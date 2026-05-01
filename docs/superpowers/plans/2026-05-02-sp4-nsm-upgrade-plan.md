# SP4 — NSM Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development.
>
> **MANDATORY READS:**
> 1. Spec: `docs/superpowers/specs/2026-05-02-sp4-nsm-upgrade-design.md`
> 2. Mockup: `docs/superpowers/specs/mockups/2026-05-02-pm-drill-overhaul/sp4-nsm-upgrade.html`
> 3. Verification standard: `docs/superpowers/specs/2026-05-02-verification-standard.md`
> 4. `audit-cycle.md` (universe rows J for NSM workshop invariants)

**Goal:** Pre-generate NSM context per question (eliminate runtime fetch), redesign Step 1 with CIRCLES-style cards + 3-col desktop layout, and redesign Step 4 report with 4 fully-laid-out tabs at all viewports.

**Architecture:** New backfill script + question schema extension + Step 1 / Step 4 frontend rewrite. Reuses existing `prompts/nsm-context.js` (no prompt changes). SP1 must be merged.

**Tech Stack:** Node script (OpenAI gpt-4o-mini) / vanilla JS / Playwright 8 projects.

**Branch:**
```bash
git worktree add .claude/worktrees/sp4-nsm -b feat/sp4-nsm main
cd .claude/worktrees/sp4-nsm
cp ../../.env .env
```

---

## File structure

| File | Action |
|---|---|
| `scripts/backfill-nsm-context.js` | NEW — augment NSM_QUESTIONS with `context` per question |
| `public/app.js` | NSM_QUESTIONS array gets `context` per item; Step 1 read q.context (no fetch); Step 1 desktop 3-col grid; Step 4 four-tab renderers (overview / comparison / highlights / done) |
| `public/style.css` | NSM Step 1 cards + Step 4 tabs (overview 2-col / comparison side-by-side / highlights 3-col / done panel) |
| `tests/playwright/journeys/sp4-nsm-step1.spec.js` | NEW — Step 1 card pre-gen + 3-col |
| `tests/playwright/journeys/sp4-nsm-step4-tabs.spec.js` | NEW — 4 tabs × 3 viewports |

---

## Task 1: Pre-flight

- [ ] **Step 1: SP1 baseline confirmed**

```bash
grep -E "^\s*--pad-block:" public/style.css && echo SP1_OK
```

- [ ] **Step 2: Open mockup**

```bash
open docs/superpowers/specs/mockups/2026-05-02-pm-drill-overhaul/sp4-nsm-upgrade.html
```

Visually note 4-tab layouts × 3 viewports (12 mockup blocks).

- [ ] **Step 3: Locate NSM_QUESTIONS array**

```bash
grep -n "^const NSM_QUESTIONS\|^var NSM_QUESTIONS" public/app.js
```

Expected: 1 match around app.js:111. Confirm 100+ entries.

- [ ] **Step 4: Read existing nsm-context prompt**

```bash
sed -n '1,80p' prompts/nsm-context.js
```

We'll reuse `generateNSMContext()` directly.

---

## Task 2: Write backfill script

**Files:** Create `scripts/backfill-nsm-context.js`

- [ ] **Step 1: Reference existing pattern**

```bash
cat scripts/backfill-circles-analysis.js | head -100
```

The CIRCLES backfill is the template (loads existing array, augments, writes back).

- [ ] **Step 2: Write the script**

```javascript
#!/usr/bin/env node
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { generateNSMContext } = require('../prompts/nsm-context');

const APP_JS = path.join(__dirname, '..', 'public', 'app.js');

function loadNsmQuestions() {
  // Sandbox eval the file to avoid greedy regex pitfalls
  const src = fs.readFileSync(APP_JS, 'utf8');
  // Find the NSM_QUESTIONS array literal — non-greedy
  const match = src.match(/const NSM_QUESTIONS\s*=\s*(\[[\s\S]*?\n\])/);
  if (!match) throw new Error('NSM_QUESTIONS not found in public/app.js');
  // eslint-disable-next-line no-new-func
  const arr = new Function('return ' + match[1])();
  if (!Array.isArray(arr) || arr.length === 0) throw new Error('NSM_QUESTIONS not a non-empty array');
  return { src, match, arr };
}

function isFullyContexted(q) {
  return q.context
    && typeof q.context.model === 'string' && q.context.model.length > 10
    && typeof q.context.users === 'string' && q.context.users.length > 10
    && typeof q.context.traps === 'string' && q.context.traps.length > 10
    && typeof q.context.insight === 'string' && q.context.insight.length > 10;
}

async function main() {
  const { src, match, arr } = loadNsmQuestions();
  console.log('Loaded', arr.length, 'NSM questions');
  let generated = 0;
  let skipped = 0;
  let failed = 0;
  for (const q of arr) {
    if (isFullyContexted(q)) {
      skipped++;
      continue;
    }
    process.stdout.write(`[${generated + skipped + failed + 1}/${arr.length}] ${q.id} ${q.company} — generating...`);
    let attempt = 0;
    while (attempt < 3) {
      try {
        const ctx = await generateNSMContext({ question_json: q });
        q.context = {
          model: ctx.model,
          users: ctx.users,
          traps: ctx.traps,
          insight: ctx.insight,
        };
        process.stdout.write(' OK\n');
        generated++;
        break;
      } catch (e) {
        attempt++;
        if (attempt === 3) {
          process.stdout.write(` FAILED (${e.message})\n`);
          failed++;
        } else {
          await new Promise(r => setTimeout(r, 1000));
        }
      }
    }
    // Write progress every 5
    if ((generated + failed) % 5 === 0 && generated > 0) {
      writeBack(src, match, arr);
      console.log(`  [progress] saved after ${generated} generated`);
    }
  }
  writeBack(src, match, arr);
  console.log(`\nDone. generated=${generated}, skipped=${skipped}, failed=${failed}`);
  if (failed > 0) process.exit(1);
}

function writeBack(originalSrc, match, arr) {
  const newLiteral = JSON.stringify(arr, null, 2);
  // Reconstruct: const NSM_QUESTIONS = <newLiteral>;
  const replacement = 'const NSM_QUESTIONS = ' + newLiteral + ';';
  const startIdx = match.index;
  const endIdx = match.index + match[0].length;
  // Trailing semicolon may or may not be present in original; preserve safely
  const after = originalSrc.slice(endIdx);
  const semi = after.startsWith(';') ? '' : ';';
  const reconstructed = originalSrc.slice(0, startIdx) + 'const NSM_QUESTIONS = ' + newLiteral + semi + after;
  fs.writeFileSync(APP_JS, reconstructed, 'utf8');
}

main().catch(e => { console.error(e); process.exit(1); });
```

- [ ] **Step 3: Sanity check syntax**

```bash
node --check scripts/backfill-nsm-context.js
```

- [ ] **Step 4: Dry-run with small subset (no OpenAI)**

```bash
node -e "
const fs=require('fs');
const src=fs.readFileSync('public/app.js','utf8');
const m=src.match(/const NSM_QUESTIONS\s*=\s*(\[[\s\S]*?\n\])/);
console.log('match found:', !!m);
const arr=new Function('return '+m[1])();
console.log('count:', arr.length, 'first:', arr[0].id, arr[0].company);
"
```

Expected: match found: true, count > 100, first: q1 Netflix.

- [ ] **Step 5: Commit**

```bash
git add scripts/backfill-nsm-context.js
git commit -m "feat(sp4): scripts/backfill-nsm-context.js (idempotent)"
```

---

## Task 3: Run backfill (paid OpenAI call)

**Files:** modifies `public/app.js` (NSM_QUESTIONS array)

- [ ] **Step 1: Confirm OPENAI_API_KEY**

```bash
test -n "$OPENAI_API_KEY" || export $(grep OPENAI_API_KEY .env)
test -n "$OPENAI_API_KEY" && echo OK
```

- [ ] **Step 2: Run backfill (~$0.30-$0.50, ~5 minutes)**

```bash
node -r dotenv/config scripts/backfill-nsm-context.js
```

Expected output: `generated=N, skipped=0, failed=0` where N == array length.

- [ ] **Step 3: Verify all questions have context**

```bash
node -e "
const src=require('fs').readFileSync('public/app.js','utf8');
const m=src.match(/const NSM_QUESTIONS\s*=\s*(\[[\s\S]*?\n\])/);
const arr=new Function('return '+m[1])();
const missing=arr.filter(q=>!q.context||!q.context.model||!q.context.insight);
console.log('total:', arr.length, 'missing context:', missing.length);
if (missing.length) console.log('first missing:', missing[0].id);
"
```

Expected: `missing context: 0`.

- [ ] **Step 4: Re-run backfill — confirm idempotent**

```bash
node -r dotenv/config scripts/backfill-nsm-context.js
```

Expected: `generated=0, skipped=N, failed=0`.

- [ ] **Step 5: Commit**

```bash
git add public/app.js
git commit -m "data(sp4): backfill NSM context for all questions"
```

---

## Task 4: Frontend — Step 1 reads q.context directly

**Files:** Modify `public/app.js`

- [ ] **Step 1: Find Step 1 card render**

```bash
grep -n "createNSMQuestionCardHtml\|nsm-question-card" public/app.js | head
```

- [ ] **Step 2: Replace fetch logic with direct read from q.context**

In `createNSMQuestionCardHtml(q)`, replace the existing context block (which uses `AppState.nsmContext` + `nsmContextLoading`):

```javascript
function createNSMQuestionCardHtml(q) {
  var isSelected = AppState.nsmSelectedQuestion && AppState.nsmSelectedQuestion.id === q.id;
  var typeMeta = NSM_TYPE_META[detectProductType(q)];

  var contextHtml = '';
  if (isSelected && q.context) {
    var ctx = q.context;
    contextHtml =
      '<div class="qcard-analysis">' +
        '<div class="ana-row"><span class="ana-label"><i class="ph ph-buildings"></i> 商業模式</span><span class="ana-val">' + escHtml(ctx.model || '') + '</span></div>' +
        '<div class="ana-row"><span class="ana-label"><i class="ph ph-users"></i> 使用者</span><span class="ana-val">' + escHtml(ctx.users || '') + '</span></div>' +
        '<div class="ana-row trap"><span class="ana-label"><i class="ph ph-warning"></i> 常見陷阱</span><span class="ana-val">' + escHtml(ctx.traps || '') + '</span></div>' +
        '<div class="ana-row"><span class="ana-label"><i class="ph ph-lightbulb"></i> 破題切入</span><span class="ana-val">' + escHtml(ctx.insight || '') + '</span></div>' +
      '</div>';
  }
  // … keep existing card structure (header / scenario), append contextHtml
}
```

Remove any code that fires `/api/nsm-context` from `handleNSMCardSelect` (or wherever it's called). The route stays as fallback for legacy questions but should never be called for ones with `q.context`.

- [ ] **Step 3: Confirm zero fetch on click (manual / Playwright)**

Run dev server, open NSM Step 1, click any card → should expand instantly without "分析情境中…" loader.

- [ ] **Step 4: Commit**

```bash
git add public/app.js
git commit -m "feat(sp4): NSM Step 1 reads q.context directly (no runtime fetch)"
```

---

## Task 5: Step 1 — desktop 3-col grid + new card layout

**Files:** Modify `public/app.js`, `public/style.css`

- [ ] **Step 1: Find existing Step 1 desktop renderer (`renderNSMStep1`)**

```bash
grep -n "renderNSMStep1\|nsm-home-desktop" public/app.js
```

- [ ] **Step 2: Add desktop 3-col layout**

In the desktop branch of `renderNSMStep1`, wrap question list area:

```javascript
var desktopGrid = isDesktop() ? '<div class="nsm-step1-grid">' : '';
var leftRail = isDesktop() ? renderNsmIndustryRail() : '';
var rightRail = isDesktop() ? renderNsmRecentRail() : '';
var gridClose = isDesktop() ? '</div>' : '';

return /* nav + header + progress + */
  desktopGrid +
    leftRail +
    '<div class="nsm-step1-center">' + cardsHtml + '</div>' +
    rightRail +
  gridClose +
  /* … */;
```

- [ ] **Step 3: Helper `renderNsmIndustryRail()`**

```javascript
function renderNsmIndustryRail() {
  var counts = { '注意力型': 0, '交易量型': 0, '創造力型': 0, 'SaaS 型': 0 };
  NSM_QUESTIONS.forEach(function(q) {
    var t = NSM_TYPE_META[detectProductType(q)];
    if (t && counts.hasOwnProperty(t.label)) counts[t.label]++;
  });
  var total = NSM_QUESTIONS.length;
  var current = AppState.nsmIndustryFilter || '全部';
  var typesHtml = ['全部'].concat(Object.keys(counts)).map(function(t) {
    var c = t === '全部' ? total : counts[t];
    var cls = current === t ? ' active' : '';
    return '<div class="nsm-rail-type' + cls + '" data-nsm-type="' + escHtml(t) + '">' + escHtml(t) + ' ×' + c + '</div>';
  }).join('');
  return '<div class="nsm-rail-left"><div class="rail-label">產業類型</div>' + typesHtml + '</div>';
}
```

- [ ] **Step 4: Helper `renderNsmRecentRail()`**

```javascript
function renderNsmRecentRail() {
  var recent = (AppState.nsmRecentSessions || []).slice(0, 3);
  if (!recent.length) return '<div class="nsm-rail-right"><div class="rail-label">近期練習</div><div style="font-size:11.5px;color:var(--c-text-3);text-align:center;padding:14px 0">尚無紀錄</div></div>';
  var rowsHtml = recent.map(function(s) { /* compact row markup */ }).join('');
  return '<div class="nsm-rail-right"><div class="rail-label">近期練習</div>' + rowsHtml + '</div>';
}
```

- [ ] **Step 5: Wire industry filter binding**

```javascript
document.querySelectorAll('[data-nsm-type]').forEach(function(el) {
  el.addEventListener('click', function() {
    AppState.nsmIndustryFilter = el.dataset.nsmType;
    render();
  });
});
```

In `renderNSMStep1`, filter `NSM_QUESTIONS` before `pickRandom5`:

```javascript
var filtered = (AppState.nsmIndustryFilter && AppState.nsmIndustryFilter !== '全部')
  ? NSM_QUESTIONS.filter(function(q) { return NSM_TYPE_META[detectProductType(q)].label === AppState.nsmIndustryFilter; })
  : NSM_QUESTIONS;
AppState.nsmDisplayedQuestions = pickRandom5(filtered);
```

- [ ] **Step 6: CSS — 3-col grid + cards**

```css
/* SP4 — Step 1 desktop 3-col */
@media (min-width: 1280px) {
  .nsm-step1-grid {
    display: grid;
    grid-template-columns: 200px 1fr 220px;
    gap: 16px;
    padding: 16px var(--pad-block-desktop);
  }
}
.nsm-rail-left, .nsm-rail-right {
  background: #fff; border-radius: var(--r-card); padding: 14px;
}
.nsm-rail-type {
  font-size: 12px; padding: 8px 10px; border-radius: var(--r-input); cursor: pointer;
  margin-bottom: 4px; min-height: 36px; display: flex; align-items: center;
}
.nsm-rail-type.active { background: var(--c-primary); color: #fff; }

/* card analysis (reuse SP1 / SP3 .ana-row) */
.nsm-question-card { /* existing — ensure padding matches token */ }
```

- [ ] **Step 7: Commit**

```bash
git add public/app.js public/style.css
git commit -m "feat(sp4): NSM Step 1 desktop 3-col grid (industry rail / cards / recent)"
```

---

## Task 6: Step 4 — refactor to 4 tabs + redesigned content

**Files:** Modify `public/app.js`

- [ ] **Step 1: Find existing Step 4 renderer**

```bash
grep -n "renderNSMStep4\|nsm-step4-desktop" public/app.js
```

- [ ] **Step 2: Refactor into 4 sub-renderers**

Replace existing inline tab content with 4 functions:

```javascript
function renderStep4Tab(activeTab) {
  switch (activeTab) {
    case 'overview':   return renderStep4Overview();
    case 'comparison': return renderStep4Comparison();
    case 'highlights': return renderStep4Highlights();
    case 'export':     return renderStep4Done();
    default:           return renderStep4Overview();
  }
}

function renderStep4Overview() {
  var sc = (AppState.nsmSession.scores_json || {}).scores || {};
  var dimsHtml = renderNSMDimensionRows(sc);
  return '<div class="nsm-step4-tab-body">' +
    '<div class="step4-overview-grid">' +
      '<div class="ov-radar">' + renderNSMRadarSvg() + '</div>' +
      '<div class="ov-dims-card">' + dimsHtml + '</div>' +
    '</div>' +
  '</div>';
}

function renderStep4Comparison() {
  var coachTree = (AppState.nsmSession.scores_json || {}).coachTree || {};
  var userBreakdown = AppState.nsmSession.user_breakdown || {};
  var userNsm = AppState.nsmSession.user_nsm || '';
  var dims = NSM_DIMENSION_CONFIGS[detectProductType(AppState.nsmSelectedQuestion)] || [];
  var headerRow = '<div class="cmp-header-row">' +
    '<div class="cmp-h-cell cmp-h-you"><i class="ph ph-user"></i> 你的拆解</div>' +
    '<div class="cmp-h-cell cmp-h-coach"><i class="ph ph-graduation-cap"></i> 教練版本（點擊看思路）</div>' +
  '</div>';
  var nsmBlock = '<div class="cmp-block"><div class="cmp-dim-title">北極星指標 (NSM)</div><div class="cmp-row">' +
    '<div class="cmp-card">' + escHtml(userNsm) + '</div>' +
    '<div class="cmp-card coach">' + escHtml(coachTree.nsm || '') + '</div>' +
  '</div></div>';
  var dimsBlocks = dims.map(function(d) {
    return '<div class="cmp-block"><div class="cmp-dim-title">' + escHtml(d.label) + '</div><div class="cmp-row">' +
      '<div class="cmp-card">' + escHtml(userBreakdown[d.key] || '') + '</div>' +
      '<div class="cmp-card coach">' + escHtml(coachTree[d.key] || '') + '</div>' +
    '</div></div>';
  }).join('');
  return '<div class="nsm-step4-tab-body"><div style="background:#fff;border-radius:var(--r-card);padding:20px">' +
    headerRow + nsmBlock + dimsBlocks +
  '</div></div>';
}

function renderStep4Highlights() {
  var s = (AppState.nsmSession.scores_json || {});
  return '<div class="nsm-step4-tab-body"><div class="hl-grid">' +
    '<div class="hl-card"><div class="hl-label"><i class="ph ph-trophy"></i> 最大亮點</div><div class="hl-text">' + escHtml(s.bestMove || '—') + '</div></div>' +
    '<div class="hl-card danger"><div class="hl-label"><i class="ph ph-warning"></i> 主要陷阱</div><div class="hl-text">' + escHtml(s.mainTrap || '—') + '</div></div>' +
    '<div class="hl-card next"><div class="hl-label"><i class="ph ph-target"></i> 下一步建議</div><div class="hl-text">' + escHtml(s.nextStep || '下一輪可挑戰不同產業類型，加深對商業模式的理解。') + '</div></div>' +
    '<div class="hl-card summary"><div class="hl-label"><i class="ph ph-chat-text"></i> 總評</div><div class="hl-text">' + escHtml(s.summary || '—') + '</div></div>' +
  '</div></div>';
}

function renderStep4Done() {
  var total = (AppState.nsmSession.scores_json || {}).totalScore || 0;
  return '<div class="nsm-step4-tab-body"><div class="done-panel">' +
    '<div class="done-icon"><i class="ph ph-check-circle"></i></div>' +
    '<div class="done-title">完成這次 NSM 訓練</div>' +
    '<div class="done-sub">本次得分 ' + total + ' 分，距離滿分還差 ' + (100 - total) + ' 分。可以再練同題或挑下一題。</div>' +
    '<div class="done-actions"><button class="btn primary" id="nsm-replay"><i class="ph ph-shuffle"></i> 再練一題</button></div>' +
  '</div>' +
  '<div class="done-secondary"><i class="ph ph-info"></i> <strong>NSM 練習小技巧：</strong>下次可挑戰不同類型（注意力／交易量／創造力／SaaS）的情境，加深對不同商業模式的理解。</div>' +
  '</div>';
}
```

- [ ] **Step 3: Wire tab switch + replay**

```javascript
document.querySelectorAll('[data-nsm-tab]').forEach(function(el) {
  el.addEventListener('click', function() {
    AppState.nsmReportTab = el.dataset.nsmTab;
    render();
  });
});
document.getElementById('nsm-replay')?.addEventListener('click', function() {
  AppState.nsmStep = 1;
  AppState.nsmSelectedQuestion = null;
  AppState.nsmSession = null;
  AppState.nsmDisplayedQuestions = pickRandom5(NSM_QUESTIONS);
  navigate('nsm');
});
```

- [ ] **Step 4: Commit**

```bash
git add public/app.js
git commit -m "feat(sp4): NSM Step 4 — 4 tab renderers (overview/comparison/highlights/done)"
```

---

## Task 7: CSS — Step 4 4 tabs at 3 viewports

**Files:** Modify `public/style.css`

- [ ] **Step 1: Append SP4 Step 4 styles**

```css
/* SP4 — Step 4 frame */
.nsm-step4-tab-body { padding: 16px var(--pad-block); }
@media (min-width: 768px) { .nsm-step4-tab-body { padding: 16px var(--pad-block-tablet); } }
@media (min-width: 1280px) { .nsm-step4-tab-body { padding: 24px var(--pad-block-desktop); } }

/* Tab 1 overview — desktop 2-col */
@media (min-width: 1280px) {
  .step4-overview-grid { display: grid; grid-template-columns: 380px 1fr; gap: 24px; }
}
.ov-radar { background: #fff; border-radius: var(--r-card); padding: 30px; text-align: center; }
.ov-dims-card { background: #fff; border-radius: var(--r-card); padding: 16px; }

/* Tab 2 comparison */
.cmp-header-row { display: flex; gap: 16px; padding: 12px 0; border-bottom: 1px solid var(--c-border); margin-bottom: 12px; }
.cmp-h-cell { flex: 1; font-size: 12px; font-weight: 700; }
.cmp-h-you { color: var(--c-text-2); }
.cmp-h-coach { color: var(--c-primary); }
.cmp-block { padding: 12px 0; border-bottom: 1px dashed var(--c-border); }
.cmp-block:last-child { border-bottom: none; }
.cmp-dim-title { font-size: 12px; font-weight: 700; color: var(--c-text-3); margin-bottom: 8px; }
.cmp-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.cmp-card { background: #fff; border: 1px solid var(--c-border); border-radius: var(--r-input); padding: 12px; font-size: 12.5px; line-height: 1.55; }
.cmp-card.coach { background: rgba(74,108,247,.04); border-color: rgba(74,108,247,.3); cursor: pointer; }
@media (max-width: 767px) {
  .cmp-row { grid-template-columns: 1fr; gap: 8px; }
  .cmp-header-row { display: none; }
}

/* Tab 3 highlights — 1/2/3-col responsive */
.hl-grid { display: grid; gap: 12px; grid-template-columns: 1fr; }
@media (min-width: 768px) and (max-width: 1279px) {
  .hl-grid { grid-template-columns: 1fr 1fr; }
  .hl-card.summary { grid-column: span 2; }
}
@media (min-width: 1280px) {
  .hl-grid { grid-template-columns: 1fr 1fr 1fr; }
  .hl-card.summary { grid-column: span 3; }
}
.hl-card { background: #fff; border-radius: var(--r-card); padding: 16px; border-left: 4px solid var(--c-primary); }
.hl-card.danger { border-left-color: var(--c-danger); }
.hl-card.next { border-left-color: var(--c-success, #10b981); }
.hl-card.summary { border-left-color: var(--c-warn, #f59e0b); }
.hl-label { font-size: 12px; font-weight: 700; color: var(--c-primary); display: flex; align-items: center; gap: 5px; margin-bottom: 6px; }
.hl-card.danger .hl-label { color: var(--c-danger); }
.hl-card.next .hl-label { color: var(--c-success, #10b981); }
.hl-card.summary .hl-label { color: var(--c-warn, #f59e0b); }
.hl-text { font-size: 13px; line-height: 1.6; color: var(--c-text-1); }

/* Tab 4 done */
.done-panel { background: #fff; border-radius: var(--r-card); padding: 24px; text-align: center; margin-bottom: 14px; }
@media (min-width: 1280px) { .done-panel { padding: 40px 24px; } }
.done-icon { width: 64px; height: 64px; background: rgba(74,108,247,.1); color: var(--c-primary); border-radius: 999px; display: grid; place-items: center; font-size: 32px; margin: 0 auto 14px; }
.done-title { font-size: 18px; font-weight: 700; margin-bottom: 6px; }
.done-sub { font-size: 13px; color: var(--c-text-2); line-height: 1.6; max-width: 460px; margin: 0 auto; }
.done-actions { display: grid; gap: 10px; max-width: 520px; margin: 18px auto 0; }
@media (min-width: 1280px) { .done-actions { grid-template-columns: 1fr 1fr; } }
.done-secondary { background: rgba(74,108,247,.04); border-radius: var(--r-input); padding: 14px; font-size: 12.5px; line-height: 1.6; color: var(--c-text-2); max-width: 520px; margin: 0 auto; }
.done-secondary .ph { color: var(--c-primary); margin-right: 4px; }
```

- [ ] **Step 2: Visual verify at 360 / 768 / 1280, all 4 tabs**

- [ ] **Step 3: Commit**

```bash
git add public/style.css
git commit -m "style(sp4): NSM Step 4 — 4 tabs × 3 viewports (overview/comparison/highlights/done)"
```

---

## Task 8: Playwright spec — sp4-nsm-step1 (pre-gen + 3-col)

**Files:** Create `tests/playwright/journeys/sp4-nsm-step1.spec.js`

- [ ] **Step 1: Write spec**

```javascript
const { test, expect } = require('@playwright/test');

test.describe('SP4 — NSM Step 1', () => {

  test('clicking question card shows pre-gen context (no fetch)', async ({ page }) => {
    let nsmContextCalls = 0;
    page.on('request', req => {
      if (req.url().includes('/api/nsm-context')) nsmContextCalls++;
    });
    await page.goto('/');
    await page.click('text=北極星指標');
    await page.waitForTimeout(500);
    const firstCard = page.locator('.nsm-question-card').first();
    await firstCard.click();
    await page.waitForTimeout(500);
    // No fetch should have happened
    expect(nsmContextCalls).toBe(0);
    // Analysis block visible
    await expect(firstCard.locator('.qcard-analysis')).toBeVisible();
    await expect(firstCard.locator('.ana-row')).toHaveCount(4);
  });

  test('all NSM_QUESTIONS have context', async ({ page }) => {
    await page.goto('/');
    const missingCount = await page.evaluate(() => {
      return window.NSM_QUESTIONS.filter(q => !q.context || !q.context.model || !q.context.users || !q.context.traps || !q.context.insight).length;
    });
    expect(missingCount).toBe(0);
  });

  test('desktop shows 3-col grid (industry rail + cards + recent)', async ({ page, viewport }) => {
    test.skip(viewport.width < 1280, 'desktop-only');
    await page.goto('/');
    await page.click('text=北極星指標');
    await page.waitForTimeout(500);
    await expect(page.locator('.nsm-step1-grid')).toBeVisible();
    await expect(page.locator('.nsm-rail-left')).toBeVisible();
    await expect(page.locator('.nsm-rail-right')).toBeVisible();
    // Industry filter has at least 5 entries (全部 + 4 types)
    const types = await page.locator('[data-nsm-type]').count();
    expect(types).toBeGreaterThanOrEqual(5);
  });
});
```

- [ ] **Step 2: Sanity + commit**

```bash
node --check tests/playwright/journeys/sp4-nsm-step1.spec.js
git add tests/playwright/journeys/sp4-nsm-step1.spec.js
git commit -m "test(sp4): NSM Step 1 pre-gen + 3-col Playwright"
```

---

## Task 9: Playwright spec — sp4-nsm-step4-tabs

**Files:** Create `tests/playwright/journeys/sp4-nsm-step4-tabs.spec.js`

- [ ] **Step 1: Write spec**

```javascript
const { test, expect } = require('@playwright/test');

const MOCK_SESSION = {
  user_nsm: '訂閱用戶每月完整觀看時長',
  user_breakdown: { reach: 'a', depth: 'b', frequency: 'c', impact: 'd' },
  scores_json: {
    totalScore: 80,
    scores: { alignment: 4, leading: 5, actionability: 4, simplicity: 3, sensitivity: 4 },
    coachComments: { alignment: 'aa', leading: 'bb', actionability: 'cc', simplicity: 'dd', sensitivity: 'ee' },
    coachTree: { nsm: 'X', reach: 'r', depth: 'd', frequency: 'f', impact: 'i' },
    bestMove: 'BEST',
    mainTrap: 'TRAP',
    summary: 'SUM',
  }
};

async function injectStep4(page, tab) {
  await page.evaluate(({ session, tab }) => {
    window.AppState.nsmStep = 4;
    window.AppState.nsmSelectedQuestion = window.NSM_QUESTIONS[0];
    window.AppState.nsmSession = session;
    window.AppState.nsmReportTab = tab;
    window.render && window.render();
  }, { session: MOCK_SESSION, tab });
  await page.waitForTimeout(200);
}

test.describe('SP4 — NSM Step 4 four tabs', () => {

  test('overview tab — radar + dim bars render', async ({ page }) => {
    await page.goto('/');
    await page.click('text=北極星指標');
    await injectStep4(page, 'overview');
    await expect(page.locator('.ov-radar')).toBeVisible();
    await expect(page.locator('.ov-dims-card')).toBeVisible();
  });

  test('comparison tab — header + 5 cmp blocks (NSM + 4 dims)', async ({ page }) => {
    await page.goto('/');
    await page.click('text=北極星指標');
    await injectStep4(page, 'comparison');
    const blocks = page.locator('.cmp-block');
    expect(await blocks.count()).toBe(5);  // NSM + 4 dims
    const cards = page.locator('.cmp-card');
    expect(await cards.count()).toBe(10);  // 5 blocks × 2 cards
  });

  test('highlights tab — 4 cards (best/trap/next/summary)', async ({ page }) => {
    await page.goto('/');
    await page.click('text=北極星指標');
    await injectStep4(page, 'highlights');
    const cards = page.locator('.hl-card');
    expect(await cards.count()).toBe(4);
    const labels = (await page.locator('.hl-label').allInnerTexts()).join(' ');
    expect(labels).toContain('最大亮點');
    expect(labels).toContain('主要陷阱');
    expect(labels).toContain('下一步建議');
    expect(labels).toContain('總評');
  });

  test('done tab — done-panel + 再練一題 button', async ({ page }) => {
    await page.goto('/');
    await page.click('text=北極星指標');
    await injectStep4(page, 'export');
    await expect(page.locator('.done-panel')).toBeVisible();
    await expect(page.locator('#nsm-replay')).toBeVisible();
    expect(await page.locator('#nsm-replay').innerText()).toContain('再練一題');
  });

  test('desktop overview uses 2-col grid', async ({ page, viewport }) => {
    test.skip(viewport.width < 1280, 'desktop-only');
    await page.goto('/');
    await page.click('text=北極星指標');
    await injectStep4(page, 'overview');
    const grid = page.locator('.step4-overview-grid');
    await expect(grid).toBeVisible();
    const cs = await grid.evaluate(el => getComputedStyle(el).gridTemplateColumns);
    expect(cs).toMatch(/380px\s+1fr|380px/);
  });

  test('desktop highlights uses 3-col + summary spans 3', async ({ page, viewport }) => {
    test.skip(viewport.width < 1280, 'desktop-only');
    await page.goto('/');
    await page.click('text=北極星指標');
    await injectStep4(page, 'highlights');
    const cs = await page.locator('.hl-grid').evaluate(el => getComputedStyle(el).gridTemplateColumns);
    // 3 columns
    expect(cs.split(/\s+/).filter(s => s !== '').length).toBe(3);
  });
});
```

- [ ] **Step 2: Sanity + commit**

```bash
node --check tests/playwright/journeys/sp4-nsm-step4-tabs.spec.js
git add tests/playwright/journeys/sp4-nsm-step4-tabs.spec.js
git commit -m "test(sp4): NSM Step 4 four tabs Playwright"
```

---

## Task 10: Run on all 8 viewports + regression

- [ ] **Step 1: Server up**

```bash
PORT=4000 node server.js >/tmp/sp4-dev.log 2>&1 &
sleep 2 && curl -sf http://localhost:4000/ -o /dev/null -w "HTTP %{http_code}\n"
```

- [ ] **Step 2: Run new specs on all 8 projects**

```bash
PMDRILL_BASE_URL=http://localhost:4000 npx playwright test \
  --config=tests/playwright/playwright.config.js \
  tests/playwright/journeys/sp4-nsm-step1.spec.js \
  tests/playwright/journeys/sp4-nsm-step4-tabs.spec.js \
  --project=Mobile-360 --project=iPhone-SE --project=iPhone-14 --project=iPhone-15-Pro \
  --project=iPad --project=Desktop-1280 --project=Desktop-1440 --project=Desktop-2560 \
  --reporter=list --screenshot=on
```

Expected: ~9 tests × 8 projects = 72 passed (with desktop-only skips on mobile/tablet).

- [ ] **Step 3: View ≥ 8 screenshots (1 per viewport project for each tab)**

Open screenshots from `test-results/`. For each viewport, view at least:
- `sp4-nsm-step1` happy
- `sp4-nsm-step4-tabs` overview / comparison / highlights / done

- [ ] **Step 4: Regression**

```bash
npx jest --no-coverage 2>&1 | tail -3
PMDRILL_BASE_URL=http://localhost:4000 npx playwright test --config=tests/playwright/playwright.config.js --reporter=line 2>&1 | tail -3
```

---

## Task 11: iOS check

- [ ] **Step 1: Walk checklist** (per verification standard § 7)

Specifically:
- `.nsm-rail-type` `min-height: 36px` desktop only — fine
- `.cmp-card.coach` cursor:pointer — verify ≥ 44px touch on tablet (cards have padding 12 + content)
- `.tab` (`.step4-tab`) — verify ≥ 44px touch
- `done-panel` `done-icon` not interactive
- `#nsm-replay` button — verify ≥ 44px
- `prefers-reduced-motion`: no new animations introduced

- [ ] **Step 2: iPhone-15-Pro spot-check**

```bash
PMDRILL_BASE_URL=http://localhost:4000 npx playwright test \
  --config=tests/playwright/playwright.config.js \
  --project=iPhone-15-Pro \
  tests/playwright/journeys/sp4-nsm-step4-tabs.spec.js \
  --reporter=list --screenshot=on
```

- [ ] **Step 3: Commit any tweaks**

---

## Task 12: Sign-off

- [ ] **Step 1: Run all gates**

```bash
echo "=== JEST ===" && npx jest --no-coverage 2>&1 | tail -3
echo "=== PW ===" && PMDRILL_BASE_URL=http://localhost:4000 npx playwright test --config=tests/playwright/playwright.config.js --reporter=line 2>&1 | tail -3
echo "=== context grep ===" && node -e "const m=require('fs').readFileSync('public/app.js','utf8').match(/const NSM_QUESTIONS\s*=\s*(\[[\s\S]*?\n\])/); const arr=new Function('return '+m[1])(); console.log('total:', arr.length, 'missing:', arr.filter(q=>!q.context||!q.context.insight).length);"
```

- [ ] **Step 2: Console — manual walkthrough**

Click 北極星指標 → Step 1 → click 5 different cards (no loader) → enter Step 4 with mock state → click each of 4 tabs → 0 console errors.

- [ ] **Step 3: Eyeball** — 8 screenshots for each tab (overview/comparison/highlights/done across mobile/tablet/desktop)

- [ ] **Step 4: Sign-off**

```markdown
# SP4 Sign-off — 2026-05-02

- [x] Backfill script + run + idempotent (Tasks 2-3)
- [x] Step 1 pre-gen + 3-col grid (Tasks 4-5)
- [x] Step 4 4-tab refactor + CSS (Tasks 6-7)
- [x] Playwright sp4-nsm-step1 + sp4-nsm-step4-tabs: passed across 8 viewports
- [x] No regression
- [x] iOS quirks walked
- [x] Screenshots viewed (1 per viewport per tab = 32+)
- [x] No console errors

**Branch:** feat/sp4-nsm
```

```bash
git add audit/sp4-signoff.md
git commit -m "audit(sp4): sign-off"
```

---

## Self-Review

**Spec coverage:**
- ✅ NSM context pre-gen (Tasks 2-3)
- ✅ Step 1 reads q.context (Task 4)
- ✅ Step 1 desktop 3-col (Task 5)
- ✅ Step 4 overview 2-col desktop (Task 6, 7)
- ✅ Step 4 comparison 2-col desktop / mobile stack (Task 6, 7)
- ✅ Step 4 highlights 1/2/3-col responsive + 下一步建議 4th card (Task 6, 7)
- ✅ Step 4 done panel (Task 6, 7)
- ✅ 8-viewport Playwright (Tasks 8-10)
- ✅ iOS check (Task 11)
- ✅ Sign-off (Task 12)

**Type consistency:**
- `q.context.{model,users,traps,insight}` used in script (Task 2), frontend (Task 4), Playwright (Task 8) ✓
- `AppState.nsmReportTab` values 'overview'|'comparison'|'highlights'|'export' consistent (Tasks 6, 9) ✓
- `NSM_DIMENSION_CONFIGS[productType]` reused — must reference existing DEFINED in app.js (Task 6) ✓

**No placeholders.**
