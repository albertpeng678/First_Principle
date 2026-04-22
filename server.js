require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/sessions', require('./routes/sessions'));
app.use('/api/guest/sessions', require('./routes/guest-sessions'));
app.use('/api/migrate-guest', require('./routes/migrate'));

app.use('/api/nsm-context', require('./routes/nsm-context'));
app.use('/api/nsm-sessions', require('./routes/nsm-sessions'));
app.use('/api/guest/nsm-sessions', require('./routes/guest-nsm-sessions'));

app.get('/health', (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
