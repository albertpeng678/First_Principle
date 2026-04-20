const express = require('express');
const router = express.Router();
const db = require('../db/client');
const { requireAuth } = require('../middleware/auth');
const { generateIssue } = require('../prompts/issue-generator');
const { streamCoachReply } = require('../prompts/coach');
const { evaluate } = require('../prompts/evaluator');

// POST /api/sessions — 建立新 session
router.post('/', requireAuth, async (req, res) => {
  const { difficulty } = req.body;
  if (!['入門', '進階', '困難'].includes(difficulty)) {
    return res.status(400).json({ error: 'invalid_difficulty' });
  }
  try {
    const issue = await generateIssue(difficulty);
    const { data, error } = await db
      .from('practice_sessions')
      .insert({ user_id: req.user.id, difficulty, issue_json: issue })
      .select('id')
      .single();
    if (error) throw error;
    res.json({ sessionId: data.id, issueText: issue.issueText, source: issue.source, industry: issue.industry });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/sessions — 列出所有 session
router.get('/', requireAuth, async (req, res) => {
  const { data, error } = await db
    .from('practice_sessions')
    .select('id, difficulty, status, current_phase, turn_count, scores_json, created_at, updated_at')
    .eq('user_id', req.user.id)
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// GET /api/sessions/:id — 取得完整 session
router.get('/:id', requireAuth, async (req, res) => {
  const { data, error } = await db
    .from('practice_sessions')
    .select('*')
    .eq('id', req.params.id)
    .eq('user_id', req.user.id)
    .single();
  if (error || !data) return res.status(404).json({ error: 'not_found' });
  res.json(data);
});

// POST /api/sessions/:id/chat — 對話（SSE 串流）
router.post('/:id/chat', requireAuth, async (req, res) => {
  const { message } = req.body;
  const { data: session, error } = await db
    .from('practice_sessions')
    .select('*')
    .eq('id', req.params.id)
    .eq('user_id', req.user.id)
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
  await db.from('practice_sessions').update({
    conversation: [...session.conversation, newTurn],
    turn_count: session.turn_count + 1,
    current_phase: newPhase
  }).eq('id', req.params.id);
});

// POST /api/sessions/:id/submit — 提交最終定義並評分
router.post('/:id/submit', requireAuth, async (req, res) => {
  const { finalDefinition } = req.body;
  const { data: session, error } = await db
    .from('practice_sessions')
    .select('*')
    .eq('id', req.params.id)
    .eq('user_id', req.user.id)
    .single();
  if (error || !session) return res.status(404).json({ error: 'not_found' });

  try {
    const scores = await evaluate({ ...session, final_definition: finalDefinition });
    await db.from('practice_sessions').update({
      final_definition: finalDefinition,
      scores_json: scores,
      status: 'completed',
      current_phase: 'done'
    }).eq('id', req.params.id);
    res.json(scores);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/sessions/:id
router.delete('/:id', requireAuth, async (req, res) => {
  const { error } = await db
    .from('practice_sessions')
    .delete()
    .eq('id', req.params.id)
    .eq('user_id', req.user.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

module.exports = router;
