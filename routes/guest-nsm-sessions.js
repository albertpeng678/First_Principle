const express = require('express');
const router = express.Router();
const db = require('../db/client');
const { requireGuestId } = require('../middleware/guest');
const { evaluateNSM } = require('../prompts/nsm-evaluator');
const { generateNSMHints } = require('../prompts/nsm-hints');
const { reviewNSMGate } = require('../prompts/nsm-gate');
const { generateNSMContext } = require('../prompts/nsm-context');
const { guessProductType } = require('../prompts/utils/product-type');

// POST /api/guest/nsm-sessions
router.post('/', requireGuestId, async (req, res) => {
  const { questionId, questionJson } = req.body;
  if (!questionId || !questionJson) return res.status(400).json({ error: 'missing_fields' });
  try {
    const { data, error } = await db
      .from('nsm_sessions')
      .insert({ guest_id: req.guestId, question_id: questionId, question_json: questionJson })
      .select('id')
      .single();
    if (error) throw error;
    res.json({ sessionId: data.id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/guest/nsm-sessions
router.get('/', requireGuestId, async (req, res) => {
  const { data, error } = await db
    .from('nsm_sessions')
    .select('id, question_id, question_json, status, scores_json, created_at')
    .eq('guest_id', req.guestId)
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
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
  res.json(data);
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
    const { error: upErr } = await db.from('nsm_sessions').update({
      user_nsm: userNsm,
      user_breakdown: userBreakdown,
      scores_json: result,
      coach_tree_json: result.coachTree,
      status: 'completed',
      updated_at: new Date().toISOString()
    }).eq('id', req.params.id).eq('guest_id', req.guestId);
    if (upErr) throw upErr;
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
    .select('question_json')
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
router.patch('/:id/progress', requireGuestId, async (req, res) => {
  const { currentStep, userNsm, userBreakdown, gateResult, progress } = req.body || {};
  const patch = {};
  if (userNsm       !== undefined) patch.user_nsm       = userNsm;
  if (userBreakdown !== undefined) patch.user_breakdown = userBreakdown;
  // Coalesce step + gate + free-form progress into progress_json
  const merged = { ...(progress && typeof progress === 'object' ? progress : {}) };
  if (currentStep !== undefined) merged.currentStep = currentStep;
  if (gateResult  !== undefined) merged.gateResult  = gateResult;
  if (Object.keys(merged).length > 0) patch.progress_json = merged;
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
