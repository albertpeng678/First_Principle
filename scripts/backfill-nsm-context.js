'use strict';

/**
 * backfill-nsm-context.js
 *
 * 為 public/nsm-db.js 中的 NSM 題目補填 context 欄位 { model, users, traps, insight }。
 * Idempotent：已有完整 context 4 欄的題目跳過，不呼叫 OpenAI。
 *
 * 用法：
 *   node -r dotenv/config scripts/backfill-nsm-context.js
 *   node -r dotenv/config scripts/backfill-nsm-context.js --dry-run
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const NSM_DB_PATH = path.join(__dirname, '..', 'public', 'nsm-db.js');
const MAX_RETRIES = 3;
const CHUNK_SIZE = 5;

function isContextComplete(q) {
  if (!q || !q.context) return false;
  const c = q.context;
  return ['model', 'users', 'traps', 'insight'].every(
    k => typeof c[k] === 'string' && c[k].trim().length > 0
  );
}

function loadQuestions() {
  const src = fs.readFileSync(NSM_DB_PATH, 'utf8');
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  if (!Array.isArray(sandbox.window.NSM_QUESTIONS)) {
    throw new Error('public/nsm-db.js 未產生 window.NSM_QUESTIONS array');
  }
  return sandbox.window.NSM_QUESTIONS;
}

function saveQuestions(questions) {
  const header = '// Auto-generated — do not edit manually\n// Run: node -r dotenv/config scripts/backfill-nsm-context.js to regenerate context fields\n';
  const body = 'window.NSM_QUESTIONS = ' + JSON.stringify(questions, null, 2) + ';\n';
  fs.writeFileSync(NSM_DB_PATH, header + body, 'utf8');
}

async function fetchContext(q) {
  // Lazy require：jest unit tests 不需要載入 prompts（避免讀環境變數）
  const { generateNSMContext } = require('../prompts/nsm-context');
  let lastError;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const ctx = await generateNSMContext({ question_json: q });
      // schema check
      for (const k of ['model', 'users', 'traps', 'insight']) {
        if (typeof ctx[k] !== 'string' || !ctx[k].trim()) {
          throw new Error('schema: missing or empty field "' + k + '"');
        }
      }
      return ctx;
    } catch (err) {
      lastError = err;
      if (attempt < MAX_RETRIES) {
        const delay = 1000 * attempt;
        console.log(`  第 ${attempt} 次失敗，${delay}ms 後重試：${err.message}`);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
  throw lastError;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  if (dryRun) console.log('[DRY RUN] OpenAI calls will run; results NOT saved.');

  if (!process.env.OPENAI_API_KEY) {
    console.error('錯誤：請設定環境變數 OPENAI_API_KEY（或用 node -r dotenv/config 載入 .env）');
    process.exit(1);
  }

  let questions;
  try {
    questions = loadQuestions();
  } catch (e) {
    console.error('載入 public/nsm-db.js 失敗：', e.message);
    process.exit(1);
  }

  console.log(`載入完成：共 ${questions.length} 道 NSM 題目`);

  const total = questions.length;
  let backfilled = 0;
  let skipped = 0;
  const failed = [];

  for (let i = 0; i < total; i += CHUNK_SIZE) {
    const chunk = questions.slice(i, Math.min(i + CHUNK_SIZE, total));

    for (let j = 0; j < chunk.length; j++) {
      const q = chunk[j];
      const idx = i + j + 1;
      const tag = `[${String(idx).padStart(3, ' ')}/${total}] ${q.id} (${q.company})`;

      if (isContextComplete(q)) {
        console.log(`${tag} — 已有 context，跳過`);
        skipped++;
        continue;
      }

      console.log(`${tag} — 生成 context...`);
      try {
        const ctx = await fetchContext(q);
        q.context = {
          model: ctx.model,
          users: ctx.users,
          traps: ctx.traps,
          insight: ctx.insight,
        };
        backfilled++;
      } catch (err) {
        console.error(`  FAILED: ${q.id} — ${err.message}`);
        failed.push(q.id);
      }
    }

    // 每批結束後立即寫回，保留部分進度
    if (!dryRun) saveQuestions(questions);
  }

  console.log('\n完成！');
  console.log(`  補填：${backfilled} 道`);
  console.log(`  跳過：${skipped} 道`);
  console.log(`  失敗：${failed.length} 道${failed.length > 0 ? '（' + failed.join(', ') + '）' : ''}`);

  if (failed.length > 0) {
    console.error('\n有題目失敗，請重跑腳本補齊。');
    process.exit(1);
  }
}

module.exports = { isContextComplete, loadQuestions, saveQuestions, fetchContext };

// 只有當被直接執行時才跑 main（require 時不跑，方便 jest）
if (require.main === module) {
  main().catch(err => {
    console.error('未預期錯誤：', err);
    process.exit(1);
  });
}
