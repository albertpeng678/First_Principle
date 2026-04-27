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
    const { error: upErr } = await db.from('nsm_sessions').update({
      user_nsm: userNsm,
      user_breakdown: userBreakdown,
      scores_json: result,
      coach_tree_json: result.coachTree,
      status: 'completed',
      updated_at: new Date().toISOString()
    }).eq('id', req.params.id);
    if (upErr) throw upErr;
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/guest/nsm-sessions/:id/gate
router.post('/:id/gate', requireGuestId, async (req, res) => {
  const { nsm, rationale } = req.body;
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
      nsm: nsm || '',
      rationale: rationale || '',
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
