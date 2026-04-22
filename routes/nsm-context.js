const express = require('express');
const router = express.Router();
const { generateNSMContext } = require('../prompts/nsm-context');

// POST /api/nsm-context
// 無狀態端點，不需要 session ID，接受 question_json 直接生成導讀
router.post('/', async (req, res) => {
  const { questionJson } = req.body;
  if (!questionJson || !questionJson.company) {
    return res.status(400).json({ error: 'missing_question_json' });
  }
  try {
    const context = await generateNSMContext({ question_json: questionJson });
    res.json(context);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
