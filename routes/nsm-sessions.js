const express = require('express');
const router = express.Router();
const db = require('../db/client');
const { requireAuth } = require('../middleware/auth');
const { evaluateNSM } = require('../prompts/nsm-evaluator');
const { generateNSMHints } = require('../prompts/nsm-hints');
const { reviewNSMGate } = require('../prompts/nsm-gate');
const { generateNSMContext } = require('../prompts/nsm-context');
const { guessProductType } = require('../prompts/utils/product-type');
const { rehydrateMany, rehydrateQuestionJson } = require('../lib/session-rehydrate');
const cache = require('../lib/session-cache');
const { dedupSessions } = require('../lib/session-dedup');
const { computeLifecycle } = require('../lib/session-lifecycle');

const CACHE_KIND = 'nsm-auth';

// POST /api/nsm-sessions
router.post('/', requireAuth, async (req, res) => {
  const { questionId, questionJson } = req.body;
  if (!questionId || !questionJson) return res.status(400).json({ error: 'missing_fields' });
  try {
    const { data, error } = await db
      .from('nsm_sessions')
      .insert({ user_id: req.user.id, question_id: questionId, question_json: questionJson, status: 'active' })
      .select('id')
      .single();
    if (error) throw error;
    cache.invalidate(CACHE_KIND, req.user.id);
    res.json({ sessionId: data.id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/nsm-sessions
router.get('/', requireAuth, async (req, res) => {
  const owner = req.user.id;

  // Operator gate for include_empty flag (SLC-AC13/AC14)
  const wantsEmpty = req.query.include_empty === 'true';
  const isOperator = (req.user.email || '').toLowerCase() === (process.env.OPERATOR_EMAIL || '').toLowerCase();
  if (wantsEmpty && !isOperator) {
    return res.status(403).json({ error: 'forbidden' });
  }

  // Cache only for default (no include_empty) requests to keep invalidation simple.
  if (!wantsEmpty) {
    const cached = cache.get(CACHE_KIND, owner);
    if (cached) return res.json(cached);
  }

  // Block 2: include progress_json + updated_at so FE can restore step/tab/gateResult
  const { data, error } = await db
    .from('nsm_sessions')
    .select('id, question_id, question_json, status, scores_json, user_nsm, user_breakdown, progress_json, lifecycle, created_at, updated_at')
    .eq('user_id', owner)
    .order('updated_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });

  // Default-exclude lifecycle='created' rows; operator with include_empty=true sees all.
  const rows = wantsEmpty ? (data || []) : (data || []).filter(r => r.lifecycle !== 'created');
  const deduped = dedupSessions(rows);
  const rehydrated = rehydrateMany(deduped, 'nsm');
  if (!wantsEmpty) cache.set(CACHE_KIND, owner, rehydrated);
  res.json(rehydrated);
});

// GET /api/nsm-sessions/:id
router.get('/:id', requireAuth, async (req, res) => {
  const { data, error } = await db
    .from('nsm_sessions')
    .select('*')
    .eq('id', req.params.id)
    .eq('user_id', req.user.id)
    .single();
  if (error || !data) return res.status(404).json({ error: 'not_found' });
  res.json(rehydrateQuestionJson(data, 'nsm'));
});

// DELETE /api/nsm-sessions/:id
router.delete('/:id', requireAuth, async (req, res) => {
  const { data, error } = await db
    .from('nsm_sessions')
    .delete()
    .eq('id', req.params.id)
    .eq('user_id', req.user.id)
    .select('id')
    .single();
  if (error && error.code !== 'PGRST116') return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'not_found' });
  cache.invalidate(CACHE_KIND, req.user.id);
  res.json({ ok: true });
});

// POST /api/nsm-sessions/:id/evaluate
// Plan #194 T6 (RES-AC7 + RES-AC8 / F-14): pre-write `evaluating=true` checkpoint
// to `progress_json` BEFORE the 3-5s AI call so that a mid-evaluate process crash
// is recoverable (FE sees the checkpoint older than 60s → renders recovery banner).
// Lifecycle wire (commit b42aac0) preserved verbatim — only progress_json shape
// gained 2 new keys: `evaluating` (bool) + `evaluating_started_at` (ISO string).
router.post('/:id/evaluate', requireAuth, async (req, res) => {
  const { userNsm, userBreakdown } = req.body;
  const { data: session, error } = await db
    .from('nsm_sessions')
    .select('*')
    .eq('id', req.params.id)
    .eq('user_id', req.user.id)
    .single();
  if (error || !session) return res.status(404).json({ error: 'not_found' });

  // L19 lifecycle gate guard — mirror of CIRCLES L5 fix (commit 93b1b26).
  // Reject /evaluate unless session has passed the gate (lifecycle in ['gated','completed']).
  if (!['gated', 'completed'].includes(session.lifecycle)) {
    return res.status(403).json({ error: 'gate_required', message: 'Session must pass gate before evaluation.' });
  }

  // T6 step 1 — pre-write checkpoint. Tolerate error (log + continue) because the
  // checkpoint is best-effort; if the UPDATE fails the worst case is we lose
  // crash-recovery for this request but the user still gets a normal eval cycle.
  const prevProgress = session.progress_json || {};
  const checkpointAt = new Date().toISOString();
  {
    const { error: cpErr } = await db.from('nsm_sessions').update({
      progress_json: { ...prevProgress, evaluating: true, evaluating_started_at: checkpointAt },
      updated_at: checkpointAt
    }).eq('id', req.params.id).eq('user_id', req.user.id);
    if (cpErr) console.error('[nsm-evaluate] checkpoint write failed', cpErr);
  }

  try {
    const result = await evaluateNSM({
      question_json: session.question_json,
      user_nsm: userNsm,
      user_breakdown: userBreakdown
    });
    // B6-1 — defense-in-depth: scope the UPDATE to the authenticated owner
    // so a TOCTOU race or future regression in the SELECT guard above can't
    // let one user mutate another's session row.
    const nextLifecycle = computeLifecycle(session, {}, 'nsm', 'analysis_done');
    // T6 step 2 — final UPDATE clears `evaluating` checkpoint alongside scores.
    const { error: upErr } = await db.from('nsm_sessions').update({
      user_nsm: userNsm,
      user_breakdown: userBreakdown,
      scores_json: result,
      coach_tree_json: result.coachTree,
      status: 'completed',
      lifecycle: nextLifecycle,
      progress_json: { ...prevProgress, evaluating: false },
      updated_at: new Date().toISOString()
    }).eq('id', req.params.id).eq('user_id', req.user.id);
    if (upErr) throw upErr;
    cache.invalidate(CACHE_KIND, req.user.id);
    res.json(result);
  } catch (e) {
    // T6 step 3 — on AI throw, clear `evaluating` + record `evaluation_error`
    // so FE recovery banner does not appear (no stuck checkpoint).
    const { error: errUpErr } = await db.from('nsm_sessions').update({
      progress_json: { ...prevProgress, evaluating: false, evaluation_error: e.message },
      updated_at: new Date().toISOString()
    }).eq('id', req.params.id).eq('user_id', req.user.id);
    if (errUpErr) console.error('[nsm-evaluate] error checkpoint clear failed', errUpErr);
    res.status(500).json({ error: e.message });
  }
});

// POST /api/nsm-sessions/:id/gate
const NSM_GATE_MAX = 2000; // protect against runaway token cost
router.post('/:id/gate', requireAuth, async (req, res) => {
  const { nsm, rationale } = req.body;
  if (typeof nsm !== 'string' || typeof rationale !== 'string') return res.status(400).json({ error: 'invalid_body' });
  if (!nsm.trim() || !rationale.trim()) return res.status(400).json({ error: 'empty_body' });
  if (nsm.length > NSM_GATE_MAX || rationale.length > NSM_GATE_MAX) return res.status(400).json({ error: 'input_too_long' });
  const { data: session, error } = await db
    .from('nsm_sessions')
    .select('question_json, lifecycle')
    .eq('id', req.params.id)
    .eq('user_id', req.user.id)
    .single();
  if (error || !session) return res.status(404).json({ error: 'not_found' });
  try {
    const result = await reviewNSMGate({
      question: session.question_json,
      nsm,
      rationale,
    });
    const route = result && result.canProceed && (result.overallStatus === 'ok' || result.overallStatus === 'warn') ? 'gate_ok' : 'gate_fail';
    const nextLifecycle = computeLifecycle(session, { nsm, rationale }, 'nsm', route);
    const { error: upErr } = await db.from('nsm_sessions').update({ lifecycle: nextLifecycle }).eq('id', req.params.id).eq('user_id', req.user.id);
    if (upErr) throw upErr;
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/nsm-sessions/:id/context
router.post('/:id/context', requireAuth, async (req, res) => {
  const { data: session, error } = await db
    .from('nsm_sessions')
    .select('question_json')
    .eq('id', req.params.id)
    .eq('user_id', req.user.id)
    .single();
  if (error || !session) return res.status(404).json({ error: 'not_found' });
  try {
    const context = await generateNSMContext({ question_json: session.question_json });
    res.json(context);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH /api/nsm-sessions/:id/progress — auth sibling of guest variant.
// Requires migrations/2026-04-29-nsm-progress-json.sql.
router.patch('/:id/progress', requireAuth, async (req, res) => {
  // Strip FE-supplied lifecycle — server always computes it (SLC-AC10)
  delete req.body.lifecycle;
  const { currentStep, userNsm, userBreakdown, gateResult, reportTab, progress, userExplanation, userBusinessLink } = req.body || {};
  const patch = {};
  if (userNsm       !== undefined) patch.user_nsm       = userNsm;
  if (userBreakdown !== undefined) patch.user_breakdown = userBreakdown;
  if (userExplanation  !== undefined) patch.user_explanation  = userExplanation;
  if (userBusinessLink !== undefined) patch.user_business_link = userBusinessLink;
  let priorSession = { lifecycle: 'created' }; // default; overwritten by fetches below
  let existingProgress = {};
  if (currentStep !== undefined || gateResult !== undefined || reportTab !== undefined) {
    const { data: current } = await db
      .from('nsm_sessions')
      .select('progress_json, lifecycle')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .maybeSingle();
    existingProgress = (current && current.progress_json) || {};
    if (current) priorSession = current;
  }
  // When userNsm or userBreakdown present but no DB read has captured lifecycle yet,
  // do a targeted lifecycle fetch for the monotone promotion check (SLC-AC5/AC9).
  if ((userNsm !== undefined || userBreakdown !== undefined || userExplanation !== undefined || userBusinessLink !== undefined) &&
      priorSession.lifecycle === 'created' && currentStep === undefined && gateResult === undefined && reportTab === undefined) {
    const { data: prior } = await db
      .from('nsm_sessions')
      .select('lifecycle')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .maybeSingle();
    if (prior) priorSession = prior;
  }
  const merged = { ...existingProgress, ...(progress && typeof progress === 'object' ? progress : {}) };
  if (currentStep !== undefined) merged.currentStep = currentStep;
  if (gateResult  !== undefined) merged.gateResult  = gateResult;
  if (reportTab   !== undefined) merged.reportTab   = reportTab;
  if (Object.keys(merged).length > 0) patch.progress_json = merged;
  // Compute next lifecycle from content in req.body (monotone — never demotes)
  const nextLifecycle = computeLifecycle(priorSession, req.body, 'nsm', 'patch');
  const currentLc = priorSession.lifecycle || 'created';
  if (nextLifecycle !== currentLc) patch.lifecycle = nextLifecycle;
  if (Object.keys(patch).length === 0) return res.status(400).json({ error: 'nothing_to_update' });
  patch.updated_at = new Date().toISOString();

  const { data, error } = await db
    .from('nsm_sessions')
    .update(patch)
    .eq('id', req.params.id)
    .eq('user_id', req.user.id)
    .select('id')
    .maybeSingle();
  if (error) {
    console.error('[nsm-sessions] PATCH /progress db error:', error);
    return res.status(500).json({ error: 'db_error' });
  }
  if (!data) return res.status(404).json({ error: 'not_found' });
  cache.invalidate(CACHE_KIND, req.user.id);
  res.json({ ok: true });
});

// POST /api/nsm-sessions/:id/hints
router.post('/:id/hints', requireAuth, async (req, res) => {
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
      product_type: guessProductType(session.question_json),
    });
    res.json(hints);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
