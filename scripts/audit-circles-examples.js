// Heuristic audit of field_examples in circles_database.json.
//   node scripts/audit-circles-examples.js [--json] [--limit N]
//
// Flags entries that violate machine-checkable rules:
//   - bold applied to "structural label" words (e.g. **問題類型**, **核心痛點**)
//   - too short (< 80) or too long (> 200) chars
//   - banned prefix labels ("方案一是...", "核心機制：...", "我會...", "例：...")
//   - no bold markers at all (we want 1-3 per entry)
//   - too many bold markers (> 4)
//   - missing example for a known field
//   - leftover markdown (#, leading -, leading *)

const fs = require('fs');
const path = require('path');

const JSON_PATH = path.join(__dirname, '..', 'circles_plan', 'circles_database.json');

const STEP_FIELDS = {
  C1: ['問題範圍', '時間範圍', '業務影響', '假設確認'],
  I:  ['目標用戶分群', '選定焦點對象', '用戶動機假設', '排除對象'],
  R:  ['功能性需求', '情感性需求', '社交性需求', '核心痛點'],
  C2: ['取捨標準', '最優先項目', '暫緩項目', '排序理由'],
  L:  ['方案一', '方案二', '方案三（可選）'],
  E:  ['優點', '缺點', '風險與依賴', '成功指標'],
  S:  ['推薦方案', '選擇理由', '北極星指標', '追蹤指標'],
};

// Bold tokens that are "structural labels" — generic to every question, not
// load-bearing. Bolding these is a no-no per the new style guide.
const BANNED_BOLD = [
  '問題類型', '問題範圍', '時間範圍', '業務影響', '假設確認',
  '目標用戶', '目標用戶分群', '選定焦點', '選定焦點對象', '用戶動機', '用戶動機假設', '排除對象',
  '功能性需求', '情感性需求', '社交性需求', '核心痛點',
  '取捨標準', '最優先項目', '暫緩項目', '排序理由',
  '方案一', '方案二', '方案三', '方案三（可選）',
  '優點', '缺點', '風險與依賴', '成功指標',
  '推薦方案', '選擇理由', '北極星指標', '追蹤指標',
  '主指標', '次指標', '核心', '關鍵', '主要',
  'JTBD', 'jobs to be done',
];

const BANNED_PREFIX_RE = /^(例[：:]|範例[：:]|以下是|這是|我會|我的答案是|首先|方案[一二三][是:：]|核心機制[:：是]|目標是|功能名稱[:：是])/;

function getBolds(text) {
  const out = [];
  const re = /\*\*([^*]+?)\*\*/g;
  let m;
  while ((m = re.exec(text))) out.push(m[1].trim());
  return out;
}

function auditEntry(qid, step, field, text) {
  const issues = [];
  if (!text) {
    issues.push({ kind: 'missing', detail: '欄位無內容' });
    return issues;
  }
  const len = text.length;
  const lines = text.split('\n');

  // ─── Bullet-format structural rules (spec 1 § 6) ────────────────────────
  const topBullets = lines.filter(l => /^- /.test(l));
  const subBullets = lines.filter(l => /^  - /.test(l));

  if (topBullets.length === 0) {
    issues.push({ kind: 'no_bullets', detail: '沒有任何「- 」開頭的頂層 bullet' });
  } else {
    if (topBullets.length < 2) {
      issues.push({ kind: 'top_level_count', detail: `頂層 bullet 數 ${topBullets.length}（< 2）` });
    }
    if (topBullets.length > 4) {
      issues.push({ kind: 'top_level_count', detail: `頂層 bullet 數 ${topBullets.length}（> 4）` });
    }
  }

  // bad_indent: any non-empty line whose leading whitespace is not 0 or 2 spaces
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (!l.trim()) continue;
    const m = l.match(/^( *)/);
    const indent = m ? m[1].length : 0;
    if (indent !== 0 && indent !== 2) {
      issues.push({ kind: 'bad_indent', detail: `第 ${i + 1} 行縮排 ${indent} 空白（只允許 0 或 2）` });
      break;
    }
  }

  // line_too_long: warn-level
  const longLines = lines.filter(l => l.length > 60);
  if (longLines.length > 0) {
    issues.push({ kind: 'line_too_long', severity: 'warn', detail: `${longLines.length} 行超過 60 字（最長 ${Math.max(...longLines.map(l => l.length))}）` });
  }

  // total_too_long: fail
  if (len > 320) {
    issues.push({ kind: 'total_too_long', detail: `總長 ${len}（> 320）` });
  }

  // ─── Retained checks ────────────────────────────────────────────────────
  if (BANNED_PREFIX_RE.test(text)) {
    const m = text.match(BANNED_PREFIX_RE);
    issues.push({ kind: 'bad_prefix', detail: `以「${m[0]}」開頭` });
  }
  if (/^#+\s/m.test(text)) issues.push({ kind: 'heading_markdown', detail: '有 # 標題' });

  // no_terminal_punct: spec § 3.1 — 句尾標點完整；最後一個 bullet 不一定要句號
  // Only flag if the last line is mid-sentence truncated (ends with … or trailing comma).
  const lastLine = [...lines].reverse().find(l => l.trim());
  if (lastLine) {
    const stripped = lastLine.trim();
    if (/[，、,]$/.test(stripped) || stripped.endsWith('…') || stripped.endsWith('...')) {
      issues.push({ kind: 'no_terminal_punct', severity: 'warn', detail: '最後一個 bullet 句尾被截斷' });
    }
  }

  const bolds = getBolds(text);
  if (bolds.length > 4) issues.push({ kind: 'too_many_bold', detail: `${bolds.length} 處粗體（> 4）` });

  for (const b of bolds) {
    const norm = b.toLowerCase().replace(/[（）()「」"'\s]/g, '');
    for (const banned of BANNED_BOLD) {
      const bnorm = banned.toLowerCase().replace(/[（）()「」"'\s]/g, '');
      if (norm === bnorm || (norm.length <= 8 && norm.includes(bnorm) && bnorm.length >= 3)) {
        issues.push({ kind: 'banned_bold', detail: `bold 用在結構性 label：「${b}」` });
        break;
      }
    }
  }
  return issues;
}

function main() {
  const args = new Set(process.argv.slice(2));
  const all = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));

  const flags = []; // { id, step, field, issues, text }
  const stats = {
    questions: all.length,
    questions_with_examples: 0,
    total_fields: 0,
    fields_with_issues: 0,
    fields_with_failures: 0, // failures only (excludes warn-level)
    by_kind: {},
  };

  for (const q of all) {
    if (!q.field_examples) continue;
    stats.questions_with_examples++;
    for (const [step, fields] of Object.entries(STEP_FIELDS)) {
      const stepData = q.field_examples[step] || {};
      for (const f of fields) {
        const text = stepData[f];
        stats.total_fields++;
        const issues = auditEntry(q.id, step, f, text);
        if (issues.length > 0) {
          stats.fields_with_issues++;
          const hasFailure = issues.some(i => i.severity !== 'warn');
          if (hasFailure) stats.fields_with_failures++;
          for (const iss of issues) {
            stats.by_kind[iss.kind] = (stats.by_kind[iss.kind] || 0) + 1;
          }
          flags.push({ id: q.id, company: q.company, product: q.product, step, field: f, issues, text: text || '' });
        }
      }
    }
  }

  if (args.has('--json')) {
    console.log(JSON.stringify({ stats, flags }, null, 2));
    return;
  }

  console.log('═══ AUDIT SUMMARY ═══');
  console.log(`Questions with field_examples: ${stats.questions_with_examples}/${stats.questions}`);
  console.log(`Total fields evaluated:        ${stats.total_fields}`);
  console.log(`Fields with ≥1 issue:          ${stats.fields_with_issues}  (${((stats.fields_with_issues / stats.total_fields) * 100).toFixed(1)}%)`);
  console.log(`Fields with ≥1 FAILURE:        ${stats.fields_with_failures}  (${((stats.fields_with_failures / stats.total_fields) * 100).toFixed(1)}%)  ← violation rate`);
  console.log('\nIssue counts by kind:');
  for (const [k, v] of Object.entries(stats.by_kind).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k.padEnd(20)} ${v}`);
  }

  const limit = (() => {
    for (const a of args) {
      const m = a.match(/^--limit=(\d+)$/);
      if (m) return parseInt(m[1], 10);
    }
    return 30;
  })();

  console.log(`\n═══ FIRST ${Math.min(limit, flags.length)} FLAGGED ENTRIES ═══`);
  for (const f of flags.slice(0, limit)) {
    console.log(`\n[${f.id}] ${f.company} · ${f.product}`);
    console.log(`  ${f.step}.${f.field}`);
    for (const iss of f.issues) console.log(`    ⚠ ${iss.kind}: ${iss.detail}`);
    console.log(`    text: ${f.text.slice(0, 100)}${f.text.length > 100 ? '…' : ''}`);
  }
}

main();
