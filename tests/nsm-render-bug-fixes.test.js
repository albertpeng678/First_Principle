/**
 * TDD tests for NSM render bug fixes:
 * - Fix 1 (P0-1): renderNSMDim always renders 範例答案 button (disabled when no data)
 * - Fix 2 (P1-2): renderNSMField handles missing example gracefully (disabled button)
 * - Fix 3 (P1-3): renderNSMContextCard shows fallback when ctx data is all empty
 */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

/**
 * Extract a named function from source using brace counting.
 * Finds `function <name>(` and extracts until matching closing brace.
 */
function extractFunction(src, name) {
  const marker = 'function ' + name + '(';
  const start = src.indexOf(marker);
  if (start === -1) return null;
  // Find the opening brace
  let braceStart = src.indexOf('{', start);
  if (braceStart === -1) return null;
  let depth = 0;
  let i = braceStart;
  while (i < src.length) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') {
      depth--;
      if (depth === 0) return src.slice(start, i + 1);
    }
    i++;
  }
  return null;
}

function loadRenderFunctions() {
  const src = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');

  const escHtmlSrc = extractFunction(src, 'escHtml');
  const markdownSrc = extractFunction(src, 'markdownBulletsToHtml');
  const fieldMinSrc = extractFunction(src, 'fieldMinLengthOk');
  const getNsmCtxSrc = extractFunction(src, 'getNsmContextSource');
  const renderFieldSrc = extractFunction(src, 'renderNSMField');
  const renderCtxSrc = extractFunction(src, 'renderNSMContextCard');
  const renderDimSrc = extractFunction(src, 'renderNSMDim');

  if (!escHtmlSrc) throw new Error('escHtml not found in app.js');
  if (!renderFieldSrc) throw new Error('renderNSMField not found in app.js');
  if (!renderCtxSrc) throw new Error('renderNSMContextCard not found in app.js');
  if (!renderDimSrc) throw new Error('renderNSMDim not found in app.js');

  // Build a sandbox with AppState mock
  const ctx = vm.createContext({
    window: {},
    document: { addEventListener: () => {} },
    console,
    AppState: {},
    _nsmContextQid: null,
  });

  const code = [
    escHtmlSrc,
    markdownSrc,
    fieldMinSrc,
    getNsmCtxSrc,
    renderFieldSrc,
    renderCtxSrc,
    renderDimSrc,
    // Export all to sandbox
    'this.renderNSMDim = renderNSMDim;',
    'this.renderNSMField = renderNSMField;',
    'this.renderNSMContextCard = renderNSMContextCard;',
  ].filter(Boolean).join('\n');

  vm.runInContext(code, ctx);
  return ctx;
}

// ─── Fix 1 tests: renderNSMDim ───────────────────────────────────────────────

describe('renderNSMDim — Fix 1 (P0-1): 範例答案 button always rendered', () => {
  let ctx;
  const dim = { id: 'reach', label: '觸及', desc: '觸及描述', coachQ: 'coach 問題' };

  beforeEach(() => {
    ctx = loadRenderFunctions();
    ctx.AppState = {
      nsmSelectedQuestion: {},
      nsmDimExampleExpanded: {},
      nsmBreakdown: {},
    };
  });

  test('when q.field_examples.step3[dim.id] is undefined → button rendered + disabled attr + title attr', () => {
    // Vintage B: no field_examples at all
    ctx.AppState.nsmSelectedQuestion = {};
    const html = ctx.renderNSMDim(dim, '', 'attention');

    expect(html).toContain('data-nsm-dim-example-toggle="reach"');
    expect(html).toContain('disabled');
    expect(html).toContain('此題暫無範例答案');
  });

  test('when q.field_examples.step3[dim.id] is non-empty string → button rendered + NO disabled attr', () => {
    ctx.AppState.nsmSelectedQuestion = {
      field_examples: {
        step3: { reach: '範例答案：60% MAU' },
      },
    };
    const html = ctx.renderNSMDim(dim, '', 'attention');

    expect(html).toContain('data-nsm-dim-example-toggle="reach"');
    expect(html).not.toContain('disabled');
  });
});

// ─── Fix 2 tests: renderNSMField ────────────────────────────────────────────

describe('renderNSMField — Fix 2 (P1-2): 範例答案 button always rendered', () => {
  let ctx;

  beforeEach(() => {
    ctx = loadRenderFunctions();
    ctx.AppState = {
      nsmSelectedQuestion: {},
      nsmExampleExpanded: {},
    };
  });

  test('when q.field_examples.step2[fieldId] is undefined → button rendered + disabled attr', () => {
    // Vintage B: no field_examples at all
    ctx.AppState.nsmSelectedQuestion = {};
    const html = ctx.renderNSMField('nsm', '北極星指標', '', true);

    expect(html).toContain('data-nsm-example-toggle="nsm"');
    expect(html).toContain('disabled');
    expect(html).toContain('此題暫無範例答案');
  });

  test('when q.field_examples.step2[fieldId] is non-empty string → button rendered + NO disabled attr', () => {
    ctx.AppState.nsmSelectedQuestion = {
      field_examples: {
        step2: { nsm: '每月活躍發言工作區數' },
      },
    };
    const html = ctx.renderNSMField('nsm', '北極星指標', '', true);

    expect(html).toContain('data-nsm-example-toggle="nsm"');
    expect(html).not.toContain('disabled');
  });
});

// ─── Fix 3 tests: renderNSMContextCard ──────────────────────────────────────

describe('renderNSMContextCard — Fix 3 (P1-3): fallback when ctx all empty', () => {
  let ctx;
  const q = { company: 'Slack', industry: '協作軟體', scenario: '企業協作場景' };
  const typeCfg = { typeClass: 'type--attention', typeIcon: 'ph-chart-line', label: '注意力型' };

  beforeEach(() => {
    ctx = loadRenderFunctions();
    ctx._nsmContextQid = null;
    ctx.AppState = {
      nsmContextExpanded: true,
      nsmContext: null,
    };
  });

  test('when q.context is undefined and expanded=true → renders .nsm-context-card__ana-empty fallback, NOT 4 cards', () => {
    // Vintage B: q has no context
    const qNoCtx = { ...q };
    ctx.AppState.nsmContextExpanded = true;
    ctx.AppState.nsmContext = null;

    const html = ctx.renderNSMContextCard(qNoCtx, typeCfg);

    expect(html).toContain('nsm-context-card__ana-empty');
    expect(html).toContain('此題暫無深入背景資料');
    // Should NOT render 4 blocks
    expect(html).not.toContain('nsm-context-card__ana-block');
  });

  test('when q.context has data and expanded=true → renders 4 cards (商業模式/使用者/常見陷阱/破題切入), NO fallback', () => {
    const qWithCtx = {
      ...q,
      context: {
        model: '訂閱制 SaaS',
        users: '知識工作者',
        traps: '虛榮 DAU 陷阱',
        insight: '從 AHA 時刻反推',
      },
    };
    ctx.AppState.nsmContextExpanded = true;
    ctx.AppState.nsmContext = null;

    const html = ctx.renderNSMContextCard(qWithCtx, typeCfg);

    expect(html).toContain('商業模式');
    expect(html).toContain('使用者');
    expect(html).toContain('常見陷阱');
    expect(html).toContain('破題切入');
    expect(html).not.toContain('nsm-context-card__ana-empty');
  });
});
