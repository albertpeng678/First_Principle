const express = require('express');
const router = express.Router();
const db = require('../db/client');
const { requireAuth } = require('../middleware/auth');
const { reviewFramework } = require('../prompts/circles-gate');
const { streamCirclesReply } = require('../prompts/circles-coach');
const { evaluateCirclesStep } = require('../prompts/circles-evaluator');

// POST /api/circles-sessions
router.post('/', requireAuth, async (req, res) => {
  const { questionId, questionJson, mode, drillStep } = req.body;
  if (!questionId || !questionJson || !mode) return res.status(400).json({ error: 'missing_fields' });
  try {
    const { data, error } = await db
      .from('circles_sessions')
      .insert({ user_id: req.user.id, question_id: questionId, question_json: questionJson, mode, drill_step: drillStep || null })
      .select('id')
      .single();
    if (error) throw error;
    res.json({ sessionId: data.id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/circles-sessions
router.get('/', requireAuth, async (req, res) => {
  const { data, error } = await db
    .from('circles_sessions')
    .select('id, question_id, question_json, mode, drill_step, status, step_scores, created_at')
    .eq('user_id', req.user.id)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

// GET /api/circles-sessions/:id
router.get('/:id', requireAuth, async (req, res) => {
  const { data, error } = await db
    .from('circles_sessions')
    .select('*')
    .eq('id', req.params.id)
    .eq('user_id', req.user.id)
    .single();
  if (error || !data) return res.status(404).json({ error: 'not_found' });
  res.json(data);
});

// DELETE /api/circles-sessions/:id
router.delete('/:id', requireAuth, async (req, res) => {
  const { data, error } = await db
    .from('circles_sessions')
    .delete()
    .eq('id', req.params.id)
    .eq('user_id', req.user.id)
    .select('id')
    .single();
  if (error && error.code !== 'PGRST116') return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'not_found' });
  res.json({ ok: true });
});

// POST /api/circles-sessions/:id/gate — Phase 1.5 AI review
router.post('/:id/gate', requireAuth, async (req, res) => {
  const { frameworkDraft } = req.body;
  if (!frameworkDraft) return res.status(400).json({ error: 'missing frameworkDraft' });
  const { data: session, error } = await db
    .from('circles_sessions')
    .select('*')
    .eq('id', req.params.id)
    .eq('user_id', req.user.id)
    .single();
  if (error || !session) return res.status(404).json({ error: 'not_found' });
  try {
    const gateResult = await reviewFramework({
      step: session.drill_step || 'C1',
      frameworkDraft,
      questionJson: session.question_json,
      mode: session.mode,
    });
    await db.from('circles_sessions').update({ framework_draft: frameworkDraft, gate_result: gateResult }).eq('id', req.params.id).eq('user_id', req.user.id);
    res.json(gateResult);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/circles-sessions/:id/message — Phase 2 SSE streaming
router.post('/:id/message', requireAuth, async (req, res) => {
  const { userMessage } = req.body;
  if (!userMessage) return res.status(400).json({ error: 'missing userMessage' });
  const { data: session, error } = await db
    .from('circles_sessions')
    .select('*')
    .eq('id', req.params.id)
    .eq('user_id', req.user.id)
    .single();
  if (error || !session) return res.status(404).json({ error: 'not_found' });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  let fullText = '';
  try {
    for await (const chunk of streamCirclesReply(session, userMessage)) {
      fullText += chunk;
      res.write(`data: ${JSON.stringify({ delta: chunk })}\n\n`);
    }

    // Parse 3-role reply
    const interviewee = fullText.match(/【被訪談者】\n([\s\S]*?)(?=【教練點評】|$)/)?.[1]?.trim() || '';
    const coaching   = fullText.match(/【教練點評】\n([\s\S]*?)(?=【教練提示】|$)/)?.[1]?.trim() || '';
    const hint       = fullText.match(/【教練提示】\n([\s\S]*?)$/)?.[1]?.trim() || '';

    const newTurn = { userMessage, interviewee, coaching, hint };
    const updated = [...(session.conversation || []), newTurn];
    await db.from('circles_sessions').update({ conversation: updated }).eq('id', req.params.id).eq('user_id', req.user.id);

    res.write(`data: ${JSON.stringify({ done: true, turn: newTurn })}\n\n`);
    res.end();
  } catch (e) {
    res.write(`data: ${JSON.stringify({ error: e.message })}\n\n`);
    res.end();
  }
});

// POST /api/circles-sessions/:id/evaluate-step
router.post('/:id/evaluate-step', requireAuth, async (req, res) => {
  const { data: session, error } = await db
    .from('circles_sessions')
    .select('*')
    .eq('id', req.params.id)
    .eq('user_id', req.user.id)
    .single();
  if (error || !session) return res.status(404).json({ error: 'not_found' });
  try {
    const result = await evaluateCirclesStep({
      step: session.drill_step || 'C1',
      frameworkDraft: session.framework_draft || {},
      conversation: session.conversation || [],
      questionJson: session.question_json,
      mode: session.mode,
    });
    const stepKey = session.drill_step || 'C1';
    const updatedScores = { ...(session.step_scores || {}), [stepKey]: result };
    const isLastStep = session.sim_step_index === 6;
    await db.from('circles_sessions').update({
      step_scores: updatedScores,
      current_phase: 3,
      status: (session.mode === 'drill' || isLastStep) ? 'completed' : 'active',
    }).eq('id', req.params.id).eq('user_id', req.user.id);
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH /api/circles-sessions/:id/progress — save phase/step without AI call
// Called on every phase transition so the session can be resumed after page close.
router.patch('/:id/progress', requireAuth, async (req, res) => {
  const { currentPhase, simStepIndex, frameworkDraft, gateResult } = req.body;
  const patch = {};
  if (currentPhase   !== undefined) patch.current_phase    = currentPhase;
  if (simStepIndex   !== undefined) patch.sim_step_index   = simStepIndex;
  if (frameworkDraft !== undefined) patch.framework_draft  = frameworkDraft;
  if (gateResult     !== undefined) patch.gate_result      = gateResult;
  if (Object.keys(patch).length === 0) return res.status(400).json({ error: 'nothing_to_update' });

  const { error } = await db
    .from('circles_sessions')
    .update(patch)
    .eq('id', req.params.id)
    .eq('user_id', req.user.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

module.exports = router;
