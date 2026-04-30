// Load .env into process.env so Jest tests that require modules which read
// OPENAI_API_KEY / SUPABASE_URL at import time don't crash.
require('dotenv').config();
