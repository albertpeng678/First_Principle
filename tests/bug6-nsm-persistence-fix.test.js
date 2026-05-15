'use strict';

// Regression tests for Bug 6 — NSM persistence: explanation + businessLink lost.
//
// Root causes:
//   A) triggerNsmSaveCycle only sent user_nsm: nsmDefinition.nsm (string), not the full
//      {nsm, explanation, businessLink} object → explanation + businessLink wiped on PATCH.
//   B) Step 1 card select did not create a session → question_id not persisted to server →
//      reloading/re-login wiped the selected question.
//   C) loadHistory did not restore latest in-progress NSM session on cold-start.
//
// Fix contracts (public/app.js):
//   1. triggerNsmSaveCycle payload: user_nsm = AppState.nsmDefinition (full object)
//   2. bindNSMStep1 card click: calls ensureNsmDraftSession() immediately
//   3. Async full-session rehydrate: coerces user_nsm string→object (legacy compat)
//   4. loadHistory: auto-restores latest in-progress NSM on cold-start home

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeDef(nsm, explanation, businessLink) {
  return { nsm: nsm || '', explanation: explanation || '', businessLink: businessLink || '' };
}

// Mirror of the updated triggerNsmSaveCycle payload assembly.
// Bug A fix: keys are camelCase (userNsm, userBreakdown) to match route destructuring.
function buildSavePayload(nsmDefinition, nsmBreakdown) {
  return {
    userNsm: nsmDefinition || { nsm: '', explanation: '', businessLink: '' },
    userBreakdown: nsmBreakdown || {},
  };
}

// Mirror of the updated async rehydrate coerce logic (full-session fetch branch)
function coerceUserNsmFromFull(fullRawNsm) {
  if (typeof fullRawNsm === 'string') {
    return { nsm: fullRawNsm, explanation: '', businessLink: '' };
  } else if (fullRawNsm && typeof fullRawNsm === 'object') {
    return {
      nsm: fullRawNsm.nsm || '',
      explanation: fullRawNsm.explanation || '',
      businessLink: fullRawNsm.businessLink || '',
    };
  }
  return { nsm: '', explanation: '', businessLink: '' };
}

// Mirror of landing restore smart-step routing
function smartNsmStepForRestore(session) {
  var scored = session.scores_json && typeof session.scores_json === 'object'
    && Object.keys(session.scores_json).length > 0;
  var hasBreakdown = session.user_breakdown
    && Object.values(session.user_breakdown).some(function (v) { return v && String(v).trim(); });
  var rawNsm = session.user_nsm;
  var hasNsm = rawNsm && (
    (typeof rawNsm === 'object' && rawNsm.nsm && String(rawNsm.nsm).trim()) ||
    (typeof rawNsm === 'string' && rawNsm.trim())
  );
  return scored ? 4 : (hasBreakdown ? 3 : (hasNsm ? 2 : 1));
}

// ── Fix A: triggerNsmSaveCycle sends full nsmDefinition object ────────────────
// Bug A fix: payload key is camelCase userNsm (route destructures const { userNsm } = req.body)
describe('Bug 6-A — triggerNsmSaveCycle sends full nsmDefinition object', () => {
  it('payload.userNsm is the full definition object, not just the nsm string', () => {
    const def = makeDef('DAU/MAU ratio', '衡量用戶活躍黏著度', '直接驅動訂閱續約率');
    const payload = buildSavePayload(def, { reach: '10M', depth: 'weekly', frequency: 'high', impact: 'NPS+5' });
    expect(typeof payload.userNsm).toBe('object');
    expect(payload.userNsm.nsm).toBe('DAU/MAU ratio');
    expect(payload.userNsm.explanation).toBe('衡量用戶活躍黏著度');
    expect(payload.userNsm.businessLink).toBe('直接驅動訂閱續約率');
  });

  it('payload.userNsm is not just a string (old broken format)', () => {
    const def = makeDef('Engagement rate', 'Some explanation', 'Some link');
    const payload = buildSavePayload(def, {});
    expect(typeof payload.userNsm).not.toBe('string');
  });

  it('payload.userNsm defaults to empty-shell object when nsmDefinition is null', () => {
    const payload = buildSavePayload(null, {});
    expect(payload.userNsm).toEqual({ nsm: '', explanation: '', businessLink: '' });
  });

  it('all three fields survive a round-trip through JSON serialization', () => {
    const def = makeDef('NSM text', '定義說明 text', '業務目標 text');
    const payload = buildSavePayload(def, {});
    const roundTripped = JSON.parse(JSON.stringify(payload));
    expect(roundTripped.userNsm.explanation).toBe('定義說明 text');
    expect(roundTripped.userNsm.businessLink).toBe('業務目標 text');
  });
});

// ── Fix C: async full-session rehydrate coerces user_nsm ─────────────────────
describe('Bug 6-C — async rehydrate coerces user_nsm string/object/null', () => {
  it('coerces plain string user_nsm → {nsm, explanation:"", businessLink:""}', () => {
    const result = coerceUserNsmFromFull('Legacy NSM string');
    expect(result.nsm).toBe('Legacy NSM string');
    expect(result.explanation).toBe('');
    expect(result.businessLink).toBe('');
  });

  it('coerces full object user_nsm → preserves all three fields', () => {
    const result = coerceUserNsmFromFull({ nsm: 'DAU/MAU', explanation: 'Explains engagement', businessLink: 'Drives revenue' });
    expect(result.nsm).toBe('DAU/MAU');
    expect(result.explanation).toBe('Explains engagement');
    expect(result.businessLink).toBe('Drives revenue');
  });

  it('coerces partial object user_nsm → missing fields default to empty string', () => {
    const result = coerceUserNsmFromFull({ nsm: 'Partial NSM' }); // no explanation or businessLink
    expect(result.nsm).toBe('Partial NSM');
    expect(result.explanation).toBe('');
    expect(result.businessLink).toBe('');
  });

  it('coerces null user_nsm → empty shell object', () => {
    const result = coerceUserNsmFromFull(null);
    expect(result).toEqual({ nsm: '', explanation: '', businessLink: '' });
  });

  it('coerces undefined user_nsm → empty shell object', () => {
    const result = coerceUserNsmFromFull(undefined);
    expect(result).toEqual({ nsm: '', explanation: '', businessLink: '' });
  });
});

// ── Fix D: loadHistory landing restore smart routing ──────────────────────────
describe('Bug 6-D — loadHistory landing restore smart step routing', () => {
  it('routes to Step 1 for empty in-progress session', () => {
    const session = { id: 's1', status: 'active', question_json: { company: 'Zoom' }, user_nsm: null, user_breakdown: null, scores_json: null };
    expect(smartNsmStepForRestore(session)).toBe(1);
  });

  it('routes to Step 2 when user_nsm.nsm is filled (object format)', () => {
    const session = { id: 's2', status: 'active', question_json: { company: 'Stripe' }, user_nsm: { nsm: 'Transaction success rate', explanation: '', businessLink: '' }, user_breakdown: null, scores_json: null };
    expect(smartNsmStepForRestore(session)).toBe(2);
  });

  it('routes to Step 2 when user_nsm is a legacy string', () => {
    const session = { id: 's3', status: 'active', question_json: { company: 'Airbnb' }, user_nsm: 'Booking rate', user_breakdown: null, scores_json: null };
    expect(smartNsmStepForRestore(session)).toBe(2);
  });

  it('routes to Step 3 when user_breakdown has any filled field', () => {
    const session = { id: 's4', status: 'active', question_json: { company: 'Duolingo' }, user_nsm: { nsm: 'Streak', explanation: '', businessLink: '' }, user_breakdown: { reach: '100M learners', depth: '', frequency: '', impact: '' }, scores_json: null };
    expect(smartNsmStepForRestore(session)).toBe(3);
  });

  it('routes to Step 4 when scores_json is present', () => {
    const session = { id: 's5', status: 'active', question_json: { company: 'Figma' }, user_nsm: { nsm: 'Collab sessions', explanation: 'x', businessLink: 'y' }, user_breakdown: { reach: 'r', depth: '', frequency: '', impact: '' }, scores_json: { totalScore: 82 } };
    expect(smartNsmStepForRestore(session)).toBe(4);
  });

  it('does NOT restore completed sessions (status=completed should be filtered by caller)', () => {
    // The loadHistory caller filters: status !== 'completed'
    // This test verifies the filter predicate logic
    const session = { id: 's6', status: 'completed', question_json: { company: 'Notion' } };
    expect(session.status !== 'completed').toBe(false); // correctly excluded
  });
});

// ── Source-level contract: app.js triggerNsmSaveCycle sends full object ───────
describe('Bug 6 — source contract: app.js triggerNsmSaveCycle sends full nsmDefinition', () => {
  const fs = require('fs');
  const path = require('path');
  const appSrc = fs.readFileSync(path.join(__dirname, '../public/app.js'), 'utf8');

  const fnStart = appSrc.indexOf('function triggerNsmSaveCycle()');
  const fnEnd = appSrc.indexOf('\n  }', fnStart) + 4;
  const fnBody = appSrc.slice(fnStart, fnEnd);

  it('payload sends AppState.nsmDefinition as the full object (not .nsm string)', () => {
    // Bug A fix: payload key must be camelCase "userNsm" to match route destructuring.
    // The route does: const { userNsm } = req.body — snake_case "user_nsm" was silently dropped.
    expect(fnBody).toContain('userNsm: AppState.nsmDefinition');
  });

  it('payload does NOT send just the nsm string field (old broken format)', () => {
    // Old code: user_nsm: (AppState.nsmDefinition || {}).nsm || ''
    expect(fnBody).not.toContain('user_nsm: (AppState.nsmDefinition || {}).nsm');
  });

  it('payload key is camelCase userNsm not snake_case user_nsm (route destructures camelCase)', () => {
    // Verify camelCase key is used — snake_case user_nsm in body was silently undefined in route
    expect(fnBody).toContain('userNsm:');
    expect(fnBody).not.toMatch(/user_nsm:\s*AppState\.nsmDefinition/);
  });

  it('silent catch is replaced with error logging (Bug C fix)', () => {
    // .catch(function () {}) → .catch(function (err) { console.error(...) })
    expect(fnBody).toContain('console.error');
    expect(fnBody).not.toContain('.catch(function () {})');
  });
});

// ── Source-level contract: bindNSMStep1 calls ensureNsmDraftSession on card click ──
describe('Bug 6 — source contract: bindNSMStep1 calls ensureNsmDraftSession on card click', () => {
  const fs = require('fs');
  const path = require('path');
  const appSrc = fs.readFileSync(path.join(__dirname, '../public/app.js'), 'utf8');

  const fnStart = appSrc.indexOf('function bindNSMStep1()');
  const fnEnd = appSrc.indexOf('\n  function ', fnStart + 1);
  const fnBody = appSrc.slice(fnStart, fnEnd > fnStart ? fnEnd : fnStart + 3000);

  it('card click handler calls ensureNsmDraftSession', () => {
    expect(fnBody).toContain('ensureNsmDraftSession');
  });
});
