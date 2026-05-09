const express = require('express');
const router = express.Router();

// GET /api/config — returns public Supabase credentials for browser client init
// Supabase anon key is designed for browser exposure (RLS enforced on server side)
router.get('/', function (req, res) {
  res.json({
    supabaseUrl: process.env.SUPABASE_URL || '',
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
  });
});

module.exports = router;
