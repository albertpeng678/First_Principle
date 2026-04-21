const express = require('express');
const router = express.Router();
const db = require('../db/client');

// POST /api/auth/register — 建立已確認的使用者，不需 email 確認信
router.post('/register', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: '請填寫 email 和密碼' });
  }

  const { data, error } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  res.json({ ok: true, userId: data.user.id });
});

module.exports = router;
