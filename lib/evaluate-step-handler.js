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

// M2 — typed error classification. Replaces brittle regex on e.message which
// false-positives on OpenAI errors mentioning `json_object`, `auth`, etc.
//   - AbortError  → EVAL_TIMEOUT (controller.abort() triggers this name)
//   - SyntaxError → EVAL_PARSE_ERROR (JSON.parse failures inside evaluator)
//   - status 401  → EVAL_AUTH_ERROR (OpenAI v6 SDK exposes e.status)
//   - everything else → EVAL_API_ERROR
function classifyEvaluatorError(e) {
  if (!e) return 'EVAL_API_ERROR';
  if (e.name === 'AbortError') return 'EVAL_TIMEOUT';
  if (e instanceof SyntaxError) return 'EVAL_PARSE_ERROR';
  if (e.status === 401) return 'EVAL_AUTH_ERROR';
  return 'EVAL_API_ERROR';
}

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
    const code = classifyEvaluatorError(e);
    console.warn('[evaluate-step]', code, e && e.message);
    // eslint-disable-next-line no-throw-literal
    throw { status: 500, body: { error: e && e.message, code } };
  }
}

module.exports = {
  runEvaluateStep,
  classifyEvaluatorError,
  EVALUATE_TIMEOUT_MS,
};
