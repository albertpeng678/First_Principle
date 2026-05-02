// SP3 — shared helper for /:id/evaluate-step routes.
//
// Both routes/circles-sessions.js and routes/guest-circles-sessions.js had a
// 1:1 copy of: AbortController + 30s timeout + evaluator call + step_scores
// merge + completion derivation + error code mapping. Future fixes had to
// touch two places. This helper centralises the body so the routes only
// differ in (a) the owner column (`user_id` vs `guest_id`) and (b) ownership
// loading — passed in via the `session` and `ownerFilter` arguments.
//
// Contract:
//   runEvaluateStep({ session, supabase, ownerFilter }) → { result }
//   Throws { status, body } on failure (route just relays).
//
// NOTE: M1 (this commit) is a pure extract — no behaviour change. Subsequent
// commits layer on M2 (typed errors), M3 (schema validation), and Mi cleanup.

const { evaluateCirclesStep } = require('../prompts/circles-evaluator');

const EVALUATE_TIMEOUT_MS = 30000;

/**
 * Run the evaluator + persist results. Routes pass the loaded session row and
 * an ownerFilter `(query) => query.eq('user_id', x)` so the helper stays
 * agnostic of auth scheme.
 *
 * On success: returns { result } and the route does res.json(result).
 * On failure: throws { status, body } — the route does res.status(...).json(...).
 */
async function runEvaluateStep({ session, supabase, ownerFilter }) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), EVALUATE_TIMEOUT_MS);
  try {
    const result = await evaluateCirclesStep({
      step: session.drill_step || 'C1',
      frameworkDraft: session.framework_draft || {},
      conversation: session.conversation || [],
      questionJson: session.question_json,
      mode: session.mode,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const stepKey = session.drill_step || 'C1';
    const updatedScores = { ...(session.step_scores || {}), [stepKey]: result };
    // B4-1 — derive completion from server-side step_scores (not client idx).
    const isLastStep = Object.keys(updatedScores).length === 7;

    let updateQuery = supabase
      .from('circles_sessions')
      .update({
        step_scores: updatedScores,
        current_phase: 3,
        status: (session.mode === 'drill' || isLastStep) ? 'completed' : 'active',
      })
      .eq('id', session.id);
    updateQuery = ownerFilter(updateQuery);
    await updateQuery;

    return { result };
  } catch (e) {
    clearTimeout(timeoutId);
    let code = 'EVAL_API_ERROR';
    if (e.name === 'AbortError' || /timeout|aborted/i.test(e.message || '')) code = 'EVAL_TIMEOUT';
    else if (/JSON|parse/i.test(e.message || '')) code = 'EVAL_PARSE_ERROR';
    else if (e.status === 401 || /401|auth/i.test(e.message || '')) code = 'EVAL_AUTH_ERROR';
    console.warn('[evaluate-step]', code, e.message);
    // eslint-disable-next-line no-throw-literal
    throw { status: 500, body: { error: e.message, code } };
  }
}

module.exports = {
  runEvaluateStep,
  EVALUATE_TIMEOUT_MS,
};
