// Audit for graphical emoji in UI code. Excludes typographic symbols that
// legitimately appear inside Chinese content data (× as multiplication, △ as
// triangle/symbol, → as arrow in non-emoji ranges). The intent is to keep
// graphical icons (Phosphor) consistent and not regress to emoji-as-icon.
const fs = require('fs');
const FILES = ['public/style.css','public/app.js','public/review-examples.html','public/index.html'];
const EMOJI = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{27BF}✓⚠📋📝💡🤖📊💾📍⮌⇄]/gu;
let bad = 0;
for (const f of FILES) {
  const text = fs.readFileSync(f,'utf8');
  const m = text.match(EMOJI) || [];
  if (m.length) { console.log(`${f}:`, m.slice(0,8).join(' '), '(', m.length, 'total)'); bad += m.length; }
}
process.exit(bad === 0 ? 0 : 1);
