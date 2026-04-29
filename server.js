require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// Handle malformed JSON bodies before they reach route handlers. Without this,
// Express's default error handler returns an HTML stack trace that leaks
// absolute filesystem paths.
app.use((err, req, res, next) => {
  if (err && (err.type === 'entity.parse.failed' || err instanceof SyntaxError)) {
    return res.status(400).json({ error: 'invalid_json' });
  }
  return next(err);
});

// Legacy URL: /login.html is rendered as a SPA view by app.js, not a real file.
// Redirect so shared links don't 404. (B3 from UAT-3.)
app.get('/login.html', (req, res) => res.redirect(302, '/?view=login'));

app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/migrate-guest', require('./routes/migrate'));

app.use('/api/nsm-context', require('./routes/nsm-context'));
app.use('/api/nsm-sessions', require('./routes/nsm-sessions'));
app.use('/api/circles-sessions', require('./routes/circles-sessions'));
app.use('/api/guest-circles-sessions', require('./routes/guest-circles-sessions'));
app.use('/api/circles-public', require('./routes/circles-public'));
app.use('/api/guest/nsm-sessions', require('./routes/guest-nsm-sessions'));

app.get('/health', (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
