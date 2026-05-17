// lib/session-lifecycle.js
// Single source of truth for session lifecycle state transitions.
// Used by both circles-sessions + nsm-sessions (auth + guest variants).
//
// State machine:
//   created → editing → gated → completed
//   Transitions are monotone in priority — a patch can only advance or stay.
//
// Routes recognised:
//   'patch'         — PATCH /:id/progress (lifecycle derived from payload content)
//   'gate_ok'       — POST /:id/gate that returned ok=true
//   'gate_fail'     — POST /:id/gate that returned ok=false / error (no promotion)
//   'analysis_done' — POST /:id/final-report (CIRCLES) or /:id/evaluate (NSM) success

const { isPolluted } = require('../scripts/scan-pollution');

const PRIORITY = { created: 0, editing: 1, gated: 2, completed: 3 };

function stripAndTrim(v) {
  if (typeof v !== 'string') return '';
  return v.replace(/<[^>]+>/g, '').trim();
}

function isMeaningful(v) {
  const s = stripAndTrim(v);
  if (!s) return false;
  if (isPolluted(s)) return false;
  return true;
}

// Walk a CIRCLES patch body and collect all user-editable string values.
function collectCirclesStrings(patch) {
  const out = [];
  const fd = patch && patch.frameworkDraft;
  if (fd && typeof fd === 'object') {
    for (const step of Object.values(fd)) {
      if (step && typeof step === 'object') {
        for (const v of Object.values(step)) {
          if (typeof v === 'string') out.push(v);
        }
      }
    }
  }
  const legacy = patch && patch.stepDrafts && patch.stepDrafts.framework;
  if (legacy && typeof legacy === 'object') {
    for (const step of Object.values(legacy)) {
      if (step && typeof step === 'object') {
        for (const v of Object.values(step)) {
          if (typeof v === 'string') out.push(v);
        }
      }
    }
  }
  // Phase 1 sub-steps + Phase 2 conclusion
  for (const k of ['P1', 'P1S', 'P1L', 'P1E']) {
    const v = patch && patch.stepDrafts && patch.stepDrafts[k];
    if (v && typeof v === 'object') {
      for (const inner of Object.values(v)) {
        if (typeof inner === 'string') out.push(inner);
      }
    }
  }
  if (typeof patch.phase2ConclusionDraft === 'string') out.push(patch.phase2ConclusionDraft);
  return out;
}

// Walk an NSM patch body and collect all user-editable string values.
function collectNsmStrings(patch) {
  const out = [];
  if (typeof patch.userNsm === 'string') out.push(patch.userNsm);
  if (patch.userNsm && typeof patch.userNsm === 'object') {
    for (const k of ['nsm', 'explanation', 'businessLink']) {
      if (typeof patch.userNsm[k] === 'string') out.push(patch.userNsm[k]);
    }
  }
  if (patch.userBreakdown && typeof patch.userBreakdown === 'object') {
    for (const k of ['reach', 'depth', 'frequency']) {
      if (typeof patch.userBreakdown[k] === 'string') out.push(patch.userBreakdown[k]);
    }
    // backward compat: `impact` key is silently ignored if present from old sessions
  }
  if (typeof patch.userExplanation === 'string') out.push(patch.userExplanation);
  if (typeof patch.userBusinessLink === 'string') out.push(patch.userBusinessLink);
  return out;
}

function hasSubstantiveContent(patch, kind, _route) {
  if (!patch || typeof patch !== 'object') return false;
  const strings =
    kind === 'nsm' ? collectNsmStrings(patch) : collectCirclesStrings(patch);
  return strings.some(isMeaningful);
}

function computeLifecycle(prior, patch, kind, route) {
  const priorLc = (prior && prior.lifecycle) || 'created';
  // Terminal
  if (priorLc === 'completed') return 'completed';
  // Route-driven advancement
  if (route === 'analysis_done') return 'completed';
  if (route === 'gate_ok') {
    return PRIORITY[priorLc] >= PRIORITY.gated ? priorLc : 'gated';
  }
  // 'patch' or 'gate_fail' or anything else — content-driven promotion only
  if (priorLc === 'created' && hasSubstantiveContent(patch, kind, route)) {
    return 'editing';
  }
  return priorLc;
}

module.exports = { hasSubstantiveContent, computeLifecycle, PRIORITY };
