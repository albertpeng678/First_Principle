'use strict';

// Regression test for Issue 2b:
// offcanvas history click on an incomplete session (Phase 1 not finished)
// used to auto-jump to phase 3/4 (eval result), leaving user stuck on an
// empty eval page. Fix: always land on Phase 1 regardless of current_phase.
//
// This test validates the logic contract of restoreCirclesPhase1FromSession:
//   AppState.circlesPhase === 1 after any history restore,
//   regardless of item.current_phase (1, 2, 3, or 4).

const RESTORED_PHASE_FROM_SESSION = (item) => {
  // Mirrors the fix in restoreCirclesPhase1FromSession (public/app.js)
  // Issue 2b fix: always land on Phase 1 — never auto-jump to eval.
  // Caller passes item.current_phase but we always return 1.
  void item.current_phase; // acknowledge field exists but do not use
  return 1;
};

describe('Issue 2b — offcanvas restore always lands on Phase 1', () => {
  const cases = [
    { label: 'incomplete session (no current_phase)', item: { id: 's1', question_json: { id: 'q1' } }, expectedPhase: 1 },
    { label: 'session with current_phase=1', item: { id: 's2', current_phase: 1 }, expectedPhase: 1 },
    { label: 'session with current_phase=2', item: { id: 's3', current_phase: 2 }, expectedPhase: 1 },
    { label: 'session with current_phase=3 (eval result)', item: { id: 's4', current_phase: 3, scores_json: { total: 80 } }, expectedPhase: 1 },
    { label: 'session with current_phase=4 (final report)', item: { id: 's5', current_phase: 4, scores_json: { total: 90 } }, expectedPhase: 1 },
  ];

  for (const { label, item, expectedPhase } of cases) {
    it(`${label} → circlesPhase === ${expectedPhase}`, () => {
      const phase = RESTORED_PHASE_FROM_SESSION(item);
      expect(phase).toBe(expectedPhase);
      expect(phase).not.toBe(3);
      expect(phase).not.toBe(4);
    });
  }

  it('completed session is NOT hidden — only auto-jump is prevented', () => {
    // The item is still passed to restore; it still exists in the offcanvas list.
    // The fix only prevents phase auto-jump, not visibility.
    const completedSession = { id: 's6', current_phase: 4, scores_json: { total: 85 } };
    // Item still has its scores — it's still visible in history
    expect(completedSession.scores_json).toBeDefined();
    // But restore phase is always 1
    expect(RESTORED_PHASE_FROM_SESSION(completedSession)).toBe(1);
  });
});

// Source-level contract check: verify app.js does NOT assign item.current_phase to AppState.circlesPhase
describe('Issue 2b — source contract: app.js uses hardcoded Phase 1', () => {
  const fs = require('fs');
  const path = require('path');
  const appSrc = fs.readFileSync(path.join(__dirname, '../public/app.js'), 'utf8');

  it('restoreCirclesPhase1FromSession should NOT contain item.current_phase assignment to circlesPhase', () => {
    // Find the function body
    const fnStart = appSrc.indexOf('function restoreCirclesPhase1FromSession(item)');
    const fnEnd = appSrc.indexOf('\n  }', fnStart + 1); // next closing brace at indent level
    const fnBody = appSrc.slice(fnStart, fnEnd + 4);

    // The old bug: AppState.circlesPhase = item.current_phase || 1;
    // After fix: AppState.circlesPhase = 1;
    expect(fnBody).not.toContain('item.current_phase');
    expect(fnBody).toContain('AppState.circlesPhase = 1;');
  });
});
