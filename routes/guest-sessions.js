const express = require('express');
const router = express.Router();
const db = require('../db/client');
const { requireGuestId } = require('../middleware/guest');
const { generateIssue } = require('../prompts/issue-generator');
const { streamCoachReply } = require('../prompts/coach');
const { evaluate } = require('../prompts/evaluator');
const { generateCoachDemo } = require('../prompts/coach-demo');

// POST /api/guest/sessions
router.post('/', requireGuestId, async (req, res) => {
  const { difficulty } = req.body;
  if (!['入門', '進階', '困難'].includes(difficulty)) {
    return res.status(400).json({ error: 'invalid_difficulty' });
  }
  try {
    const issue = await generateIssue(difficulty);
    const { data, error } = await db
      .from('guest_sessions')
      .insert({ guest_id: req.guestId, difficulty, issue_json: issue })
      .select('id')
      .single();
    if (error) throw error;
    res.json({ sessionId: data.id, issueText: issue.issueText, source: issue.source, industry: issue.industry });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/guest/sessions — list all sessions for this guest
router.get('/', requireGuestId, async (req, res) => {
  const { data, error } = await db
    .from('guest_sessions')
    .select('id, difficulty, status, current_phase, turn_count, scores_json, created_at')
    .eq('guest_id', req.guestId)
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

// GET /api/guest/sessions/:id
router.get('/:id', requireGuestId, async (req, res) => {
  const { data, error } = await db
    .from('guest_sessions')
    .select('*')
    .eq('id', req.params.id)
    .eq('guest_id', req.guestId)
    .single();
  if (error || !data) return res.status(404).json({ error: 'not_found' });
  res.json(data);
});

// POST /api/guest/sessions/:id/chat
router.post('/:id/chat', requireGuestId, async (req, res) => {
  const { message } = req.body;
  const { data: session, error } = await db
    .from('guest_sessions')
    .select('*')
    .eq('id', req.params.id)
    .eq('guest_id', req.guestId)
    .single();
  if (error || !session) return res.status(404).json({ error: 'not_found' });
  if (session.status !== 'in_progress') return res.status(400).json({ error: 'session_not_active' });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  let fullText = '';
  try {
    for await (const text of streamCoachReply(session, message)) {
      fullText += text;
      res.write(`data: ${JSON.stringify({ text })}\n\n`);
    }
    res.write('data: [DONE]\n\n');
  } catch (e) {
    res.write(`event: error\ndata: ${JSON.stringify({ error: e.message })}\n\n`);
  }
  res.end();

  const intervieweeMatch = fullText.match(/【被訪談者】\s*([\s\S]*?)(?=【教練點評】|$)/);
  const coachingMatch = fullText.match(/【教練點評】\s*([\s\S]*?)$/);
  const newTurn = {
    userMessage: message,
    coachReply: {
      interviewee: intervieweeMatch?.[1]?.trim() || '',
      coaching: coachingMatch?.[1]?.trim() || ''
    }
  };

  const newPhase = session.current_phase === 'reframe' ? 'drill' : session.current_phase;
  await db.from('guest_sessions').update({
    conversation: [...session.conversation, newTurn],
    turn_count: session.turn_count + 1,
    current_phase: newPhase
  }).eq('id', req.params.id);
});

// POST /api/guest/sessions/:id/submit
router.post('/:id/submit', requireGuestId, async (req, res) => {
  const { finalDefinition } = req.body;
  const { data: session, error } = await db
    .from('guest_sessions')
    .select('*')
    .eq('id', req.params.id)
    .eq('guest_id', req.guestId)
    .single();
  if (error || !session) return res.status(404).json({ error: 'not_found' });

  try {
    const scores = await evaluate({ ...session, final_definition: finalDefinition });

    let coachDemo = null;
    try {
      coachDemo = await generateCoachDemo(session);
    } catch (e) {
      console.error('coach-demo failed:', e.message);
    }

    await db.from('guest_sessions').update({
      final_definition: finalDefinition,
      scores_json: scores,
      coach_demo_json: coachDemo,
      status: 'completed',
      current_phase: 'done'
    }).eq('id', req.params.id);

    res.json({ scores, coachDemo });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
