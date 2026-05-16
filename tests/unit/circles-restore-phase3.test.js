// tests/unit/circles-restore-phase3.test.js
// Stage 1B B3 — restore-phase3 score derivation unit specs.
// Spec ref: docs/superpowers/specs/2026-05-16-stage-1b-state-cache-design.md §6 B3-U1..U5.
// Pattern: mirror sp1.5-bugfix-helpers.test.js — extract restoreCirclesPhase1FromSession
// from app.js source text, wrap it with a minimal AppState + localStorage stub,
// and execute via vm so tests call the real production function.

'use strict';

const path = require('path');
const fs = require('fs');
const vm = require('vm');

function makeItem(overrides) {
  return Object.assign({
    id: 'sess-test-1',
    mode: 'drill',
    drill_step: 'C1',
    sim_step_index: 0,
    step_scores: {},
    framework_draft: {},
    step_drafts: {},
    conversation: [],
    gate_result: null,
    progress_json: {},
    question_json: { id: 'q-test', body: 'Q' },
  }, overrides || {});
}

// loadAppForTest: extracts restoreCirclesPhase1FromSession from app.js source and
// returns { restoreFn, AppState } using a vm context with mocked globals.
// Mirrors sp1.5-bugfix-helpers.test.js (vm.createContext + vm.runInContext pattern).
function loadAppForTest() {
  const appSrc = fs.readFileSync(
    path.join(__dirname, '../../public/app.js'),
    'utf8'
  );

  // Extract the function body from app.js source text.
  const fnStart = appSrc.indexOf('function restoreCirclesPhase1FromSession(item)');
  if (fnStart === -1) throw new Error('restoreCirclesPhase1FromSession not found in app.js');

  // Find the closing brace: next line that starts with "  }" after fnStart
  // (two-space indent closing brace = end of function at IIFE-level indentation)
  const fnEnd = appSrc.indexOf('\n  }', fnStart + 1);
  if (fnEnd === -1) throw new Error('Could not find closing brace of restoreCirclesPhase1FromSession');

  const fnBodySrc = appSrc.slice(fnStart, fnEnd + 4); // include closing "  }"

  // Build a minimal AppState matching the fields touched by the function.
  const AppState = {
    circlesSelectedQuestion: null,
    circlesSession: null,
    circlesMode: null,
    circlesDrillStep: null,
    circlesPhase: 1,
    circlesSimStep: 0,
    circlesPhase1: null,
    circlesPhase1S: null,
    circlesPhase1Solutions: null,
    circlesPhase1Evaluate: null,
    circlesFrameworkDraft: {},
    circlesConversation: [],
    circlesStepScores: {},
    circlesGateResult: null,
    circlesPhase2ConclusionDraft: '',
    circlesScoreResult: null, // <-- field B3 must populate; currently missing
    view: 'circles',
  };

  // Stub localStorage to return null (no local cache — isolates restore logic).
  const localStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  };

  // Wrap the extracted function so it can reference AppState + localStorage from
  // the vm context, then expose it as a callable.
  const wrapperSrc = `
    ${fnBodySrc}
    // Expose for test consumption
    __restoreFn = restoreCirclesPhase1FromSession;
  `;

  const ctx = {
    AppState,
    localStorage,
    console: { log: () => {}, warn: () => {}, error: () => {} },
    __restoreFn: null,
  };
  vm.createContext(ctx);
  vm.runInContext(wrapperSrc, ctx);

  return { restoreFn: ctx.__restoreFn, AppState };
}

describe('Stage 1B B3 — restoreCirclesPhase1FromSession populates circlesScoreResult', () => {
  let restoreFn;
  let AppState;

  beforeEach(() => {
    ({ restoreFn, AppState } = loadAppForTest());
  });

  test('B3-U1: drill C1 with step_scores.C1.totalScore=72 → circlesScoreResult.totalScore===72', () => {
    const item = makeItem({ mode: 'drill', drill_step: 'C1', step_scores: { C1: { totalScore: 72, axisScores: {} } } });
    restoreFn(item);
    expect(AppState.circlesScoreResult).not.toBeNull();
    expect(AppState.circlesScoreResult.totalScore).toBe(72);
  });

  test('B3-U2: sim mode sim_step_index=3 → uses step_scores.C2', () => {
    const item = makeItem({ mode: 'simulation', drill_step: null, sim_step_index: 3, step_scores: { C2: { totalScore: 81 } } });
    restoreFn(item);
    expect(AppState.circlesScoreResult).not.toBeNull();
    expect(AppState.circlesScoreResult.totalScore).toBe(81);
  });

  test('B3-U3: empty step_scores → circlesScoreResult === null (spinner correct)', () => {
    const item = makeItem({ step_scores: {} });
    restoreFn(item);
    expect(AppState.circlesScoreResult).toBeNull();
  });

  test('B3-U4: step_scores.C1.totalScore === null → circlesScoreResult === null (partial eval)', () => {
    const item = makeItem({ mode: 'drill', drill_step: 'C1', step_scores: { C1: { totalScore: null } } });
    restoreFn(item);
    expect(AppState.circlesScoreResult).toBeNull();
  });

  test('B3-U5: sim_step_index 0..6 maps to C1/I/R/C2/L/E/S correctly', () => {
    const STEPS = ['C1', 'I', 'R', 'C2', 'L', 'E', 'S'];
    STEPS.forEach((stepKey, i) => {
      const fresh = loadAppForTest();
      const item = makeItem({
        mode: 'simulation',
        drill_step: null,
        sim_step_index: i,
        step_scores: { [stepKey]: { totalScore: 50 + i } },
      });
      fresh.restoreFn(item);
      expect(fresh.AppState.circlesScoreResult).not.toBeNull();
      expect(fresh.AppState.circlesScoreResult.totalScore).toBe(50 + i);
    });
  });
});
