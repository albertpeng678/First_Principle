const express = require('express');
const router = express.Router();
const db = require('../db/client');
const { requireGuestId } = require('../middleware/guest');
const { evaluateNSM } = require('../prompts/nsm-evaluator');
const { generateNSMHints } = require('../prompts/nsm-hints');
const { reviewNSMGate } = require('../prompts/nsm-gate');
const { generateNSMContext } = require('../prompts/nsm-context');
const { guessProductType } = require('../prompts/utils/product-type');
const { rehydrateMany, rehydrateQuestionJson } = require('../lib/session-rehydrate');
const cache = require('../lib/session-cache');
const { dedupSessions } = require('../lib/session-dedup');
const { computeLifecycle } = require('../lib/session-lifecycle');

const CACHE_KIND = 'nsm-guest';

// POST /api/guest/nsm-sessions
router.post('/', requireGuestId, async (req, res) => {
  const { questionId, questionJson } = req.body;
  if (!questionId || !questionJson) return res.status(400).json({ error: 'missing_fields' });
  try {
    const { data, error } = await db
      .from('nsm_sessions')
      .insert({ guest_id: req.guestId, question_id: questionId, question_json: questionJson, status: 'active' })
      .select('id')
      .single();
    if (error) throw error;
    cache.invalidate(CACHE_KIND, req.guestId);
    res.json({ sessionId: data.id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/guest/nsm-sessions
router.get('/', requireGuestId, async (req, res) => {
  const owner = req.guestId;

  // Guest endpoints have no authenticated user — include_empty is always rejected (SLC-AC13).
  const wantsEmpty = req.query.include_empty === 'true';
  if (wantsEmpty) {
    return res.status(403).json({ error: 'forbidden' });
  }

  const cached = cache.get(CACHE_KIND, owner);
  if (cached) return res.json(cached);

  const { data, error } = await db
    .from('nsm_sessions')
    .select('id, question_id, question_json, status, scores_json, user_nsm, user_breakdown, lifecycle, created_at')
    .eq('guest_id', owner)
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });

  // Default-exclude lifecycle='created' rows (guest endpoints never allow include_empty).
  const rows = (data || []).filter(r => r.lifecycle !== 'created');
  const deduped = dedupSessions(rows);
  const rehydrated = rehydrateMany(deduped, 'nsm');
  cache.set(CACHE_KIND, owner, rehydrated);
  res.json(rehydrated);
});

// GET /api/guest/nsm-sessions/:id
router.get('/:id', requireGuestId, async (req, res) => {
  const { data, error } = await db
    .from('nsm_sessions')
    .select('*')
    .eq('id', req.params.id)
    .eq('guest_id', req.guestId)
    .single();
  if (error || !data) return res.status(404).json({ error: 'not_found' });
  res.json(rehydrateQuestionJson(data, 'nsm'));
});

// DELETE /api/guest/nsm-sessions/:id
router.delete('/:id', requireGuestId, async (req, res) => {
  const { data, error } = await db
    .from('nsm_sessions')
    .delete()
    .eq('id', req.params.id)
    .eq('guest_id', req.guestId)
    .select('id')
    .single();
  if (error && error.code !== 'PGRST116') return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'not_found' });
  cache.invalidate(CACHE_KIND, req.guestId);
  res.json({ ok: true });
});

// POST /api/guest/nsm-sessions/:id/evaluate
router.post('/:id/evaluate', requireGuestId, async (req, res) => {
  const { userNsm, userBreakdown } = req.body;
  const { data: session, error } = await db
    .from('nsm_sessions')
    .select('*')
    .eq('id', req.params.id)
    .eq('guest_id', req.guestId)
    .single();
  if (error || !session) return res.status(404).json({ error: 'not_found' });
  try {
    const result = await evaluateNSM({
      question_json: session.question_json,
      user_nsm: userNsm,
      user_breakdown: userBreakdown
    });
    // B6-1 — defense-in-depth: scope to guest owner.
    const nextLifecycle = computeLifecycle(session, {}, 'nsm', 'analysis_done');
    const { error: upErr } = await db.from('nsm_sessions').update({
      user_nsm: userNsm,
      user_breakdown: userBreakdown,
      scores_json: result,
      coach_tree_json: result.coachTree,
      status: 'completed',
      lifecycle: nextLifecycle,
      updated_at: new Date().toISOString()
    }).eq('id', req.params.id).eq('guest_id', req.guestId);
    if (upErr) throw upErr;
    cache.invalidate(CACHE_KIND, req.guestId);
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/guest/nsm-sessions/:id/gate
const NSM_GATE_MAX = 2000; // protect against runaway token cost
router.post('/:id/gate', requireGuestId, async (req, res) => {
  const { nsm, rationale } = req.body;
  if (typeof nsm !== 'string' || typeof rationale !== 'string') return res.status(400).json({ error: 'invalid_body' });
  if (!nsm.trim() || !rationale.trim()) return res.status(400).json({ error: 'empty_body' });
  if (nsm.length > NSM_GATE_MAX || rationale.length > NSM_GATE_MAX) return res.status(400).json({ error: 'input_too_long' });
  const { data: session, error } = await db
    .from('nsm_sessions')
    .select('question_json, lifecycle')
    .eq('id', req.params.id)
    .eq('guest_id', req.guestId)
    .single();
  if (error || !session) return res.status(404).json({ error: 'not_found' });
  try {
    const result = await reviewNSMGate({
      question: session.question_json,
      nsm,
      rationale,
    });
    const route = result && result.ok ? 'gate_ok' : 'gate_fail';
    const nextLifecycle = computeLifecycle(session, { nsm, rationale }, 'nsm', route);
    const { error: upErr } = await db.from('nsm_sessions').update({ lifecycle: nextLifecycle }).eq('id', req.params.id).eq('guest_id', req.guestId);
    if (upErr) throw upErr;
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/guest/nsm-sessions/:id/context
router.post('/:id/context', requireGuestId, async (req, res) => {
  const { data: session, error } = await db
    .from('nsm_sessions')
    .select('question_json')
    .eq('id', req.params.id)
    .eq('guest_id', req.guestId)
    .single();
  if (error || !session) return res.status(404).json({ error: 'not_found' });
  try {
    const context = await generateNSMContext({ question_json: session.question_json });
    res.json(context);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH /api/guest/nsm-sessions/:id/progress
// Mirror of CIRCLES /progress: persist partial state (currentStep, userNsm,
// userBreakdown, gateResult, etc.) into progress_json so the user can resume.
// Requires migrations/2026-04-29-nsm-progress-json.sql to be applied.
// Bug 6 fix: also accepts userExplanation + userBusinessLink (mirrors auth sibling).
router.patch('/:id/progress', requireGuestId, async (req, res) => {
  // Strip FE-supplied lifecycle — server always computes it (SLC-AC10)
  delete req.body.lifecycle;
  const { currentStep, userNsm, userBreakdown, gateResult, progress, userExplanation, userBusinessLink } = req.body || {};
  const patch = {};
  if (userNsm       !== undefined) patch.user_nsm       = userNsm;
  if (userBreakdown !== undefined) patch.user_breakdown = userBreakdown;
  if (userExplanation  !== undefined) patch.user_explanation  = userExplanation;
  if (userBusinessLink !== undefined) patch.user_business_link = userBusinessLink;
  let priorSession = { lifecycle: 'created' }; // default; overwritten by fetches below
  // Fetch lifecycle + existing progress when needed for progress_json merge or lifecycle check
  let lifecycleFetched = false;
  if (currentStep !== undefined || gateResult !== undefined) {
    const { data: current } = await db
      .from('nsm_sessions')
      .select('progress_json, lifecycle')
      .eq('id', req.params.id)
      .eq('guest_id', req.guestId)
      .maybeSingle();
    if (current) priorSession = current;
    lifecycleFetched = true;
  }
  // When userNsm or userBreakdown present but no DB read has captured lifecycle yet,
  // do a targeted lifecycle fetch for the monotone promotion check (SLC-AC5/AC9).
  if (!lifecycleFetched &&
      (userNsm !== undefined || userBreakdown !== undefined || userExplanation !== undefined || userBusinessLink !== undefined)) {
    const { data: prior } = await db
      .from('nsm_sessions')
      .select('lifecycle')
      .eq('id', req.params.id)
      .eq('guest_id', req.guestId)
      .maybeSingle();
    if (prior) priorSession = prior;
  }
  // Coalesce step + gate + free-form progress into progress_json
  const existingProgress = (priorSession && priorSession.progress_json) || {};
  const merged = { ...existingProgress, ...(progress && typeof progress === 'object' ? progress : {}) };
  if (currentStep !== undefined) merged.currentStep = currentStep;
  if (gateResult  !== undefined) merged.gateResult  = gateResult;
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
    .eq('guest_id', req.guestId)
    .select('id')
    .maybeSingle();
  if (error) {
    console.error('[guest-nsm-sessions] PATCH /progress db error:', error);
    return res.status(500).json({ error: 'db_error' });
  }
  if (!data) return res.status(404).json({ error: 'not_found' });
  cache.invalidate(CACHE_KIND, req.guestId);
  res.json({ ok: true });
});

// POST /api/guest/nsm-sessions/:id/hints
router.post('/:id/hints', requireGuestId, async (req, res) => {
  const { userNsm } = req.body;
  const { data: session, error } = await db
    .from('nsm_sessions')
    .select('question_json')
    .eq('id', req.params.id)
    .eq('guest_id', req.guestId)
    .single();
  if (error || !session) return res.status(404).json({ error: 'not_found' });
  try {
    const hints = await generateNSMHints({
      question_json: session.question_json,
      user_nsm: userNsm || '',
      product_type: guessProductType(session.question_json),
    });
    res.json(hints);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
