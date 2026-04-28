// Deterministic post-processor for circles examples:
//   1. Strip **...** wrapping when content matches BANNED_BOLD label list
//   2. If still > 3 bolds, keep first 3, unwrap the rest
//
// No AI calls. Idempotent.

const fs = require('fs');
const path = require('path');

const JSON_PATH = path.join(__dirname, '..', 'circles_plan', 'circles_database.json');

const BANNED_BOLD = [
  '問題類型', '問題範圍', '時間範圍', '業務影響', '假設確認',
  '目標用戶', '目標用戶分群', '選定焦點', '選定焦點對象', '用戶動機', '用戶動機假設', '排除對象',
  '功能性需求', '情感性需求', '社交性需求', '核心痛點',
  '取捨標準', '最優先項目', '暫緩項目', '排序理由',
  '方案一', '方案二', '方案三', '方案三（可選）',
  '優點', '缺點', '風險與依賴', '成功指標',
  '推薦方案', '選擇理由', '北極星指標', '追蹤指標',
  '主指標', '次指標', '核心', '關鍵', '主要',
  '功能層', '情感層', '社交層',
  'JTBD', 'jobs to be done',
];

function normalize(s) {
  return s.toLowerCase().replace(/[（）()「」"'\s]/g, '');
}

function isBanned(content) {
  const norm = normalize(content);
  for (const banned of BANNED_BOLD) {
    const bnorm = normalize(banned);
    if (norm === bnorm) return true;
    if (norm.length <= 8 && norm.includes(bnorm) && bnorm.length >= 3) return true;
  }
  return false;
}

function stripBannedBolds(text) {
  return text.replace(/\*\*([^*]+?)\*\*/g, (m, inner) => {
    return isBanned(inner.trim()) ? inner : m;
  });
}

function capBoldCount(text, max = 3) {
  let count = 0;
  return text.replace(/\*\*([^*]+?)\*\*/g, (m, inner) => {
    count++;
    return count <= max ? m : inner;
  });
}

const STEP_FIELDS = {
  C1: ['問題範圍', '時間範圍', '業務影響', '假設確認'],
  I:  ['目標用戶分群', '選定焦點對象', '用戶動機假設', '排除對象'],
  R:  ['功能性需求', '情感性需求', '社交性需求', '核心痛點'],
  C2: ['取捨標準', '最優先項目', '暫緩項目', '排序理由'],
  L:  ['方案一', '方案二', '方案三（可選）'],
  E:  ['優點', '缺點', '風險與依賴', '成功指標'],
  S:  ['推薦方案', '選擇理由', '北極星指標', '追蹤指標'],
};

const all = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
let bannedStripped = 0;
let bannedFields = 0;
let cappedFields = 0;

for (const q of all) {
  if (!q.field_examples) continue;
  for (const [step, fields] of Object.entries(STEP_FIELDS)) {
    const stepData = q.field_examples[step];
    if (!stepData) continue;
    for (const f of fields) {
      const text = stepData[f];
      if (!text) continue;
      const before = text;
      let after = stripBannedBolds(text);
      const beforeBoldCount = (before.match(/\*\*[^*]+?\*\*/g) || []).length;
      const afterBannedBoldCount = (after.match(/\*\*[^*]+?\*\*/g) || []).length;
      if (after !== before) {
        bannedStripped += (beforeBoldCount - afterBannedBoldCount);
        bannedFields++;
      }
      const before2 = after;
      after = capBoldCount(after, 3);
      if (after !== before2) cappedFields++;
      stepData[f] = after;
    }
  }
}

fs.writeFileSync(JSON_PATH, JSON.stringify(all, null, 2), 'utf8');
console.log(`Stripped banned bolds: ${bannedStripped} markers across ${bannedFields} fields.`);
console.log(`Capped bold count (>3 → 3) on: ${cappedFields} fields.`);
