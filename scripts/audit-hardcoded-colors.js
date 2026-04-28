const fs = require('fs'); const path = require('path');
const FILES = ['public/style.css','public/app.js','public/review-examples.html'];
const HEX = /#1A56DB|#5a52e0|#6c63ff/gi;
// Allow hex inside the CSS variable DEFINITION line (e.g. `--c-primary: #1A56DB;`).
// Everything else (usages) must use var(--c-primary).
const DEF_LINE = /--c-primary\s*:/;
let bad = 0;
for (const f of FILES) {
  const text = fs.readFileSync(path.join(__dirname,'..',f),'utf8');
  let count = 0;
  for (const line of text.split('\n')) {
    if (DEF_LINE.test(line)) continue;
    const matches = line.match(HEX) || [];
    count += matches.length;
  }
  if (count) { console.log(`${f}: ${count} hardcoded`); bad += count; }
}
process.exit(bad === 0 ? 0 : 1);
