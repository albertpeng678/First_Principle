'use strict';

/**
 * backfill-circles-analysis.js
 *
 * 為 circles_plan/circles_database.json 中既有的 CIRCLES 題目補填 analysis 欄位，
 * 不重新生成題目本身，只 patch { business, users, traps, insight }。
 *
 * 用法：
 *   node -r dotenv/config scripts/backfill-circles-analysis.js
 *   node -r dotenv/config scripts/backfill-circles-analysis.js --dry-run
 *
 * 冪等：已有完整 analysis 的題目直接跳過，不呼叫 OpenAI。
 */

const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');

// ── 設定 ──────────────────────────────────────────────────────────────────────

const DB_PATH = path.join(__dirname, '..', 'circles_plan', 'circles_database.json');
const MODEL = 'gpt-4o-mini';
const MAX_RETRIES = 3;
const CHUNK_SIZE = 5; // 同時送出的最大平行數

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ── 輔助函式 ──────────────────────────────────────────────────────────────────

function isAnalysisComplete(q) {
  return (
    q.analysis &&
    q.analysis.business &&
    q.analysis.users &&
    q.analysis.insight
  );
}

/**
 * 從 circles_database.json 載入題目陣列。
 */
function loadQuestions() {
  const json = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  if (!Array.isArray(json) || json.length === 0) {
    throw new Error('載入失敗：JSON 為空或非陣列');
  }
  return json;
}

/**
 * 針對單一題目，呼叫 OpenAI 取得 { business, users, insight }。
 * 最多重試 MAX_RETRIES 次。
 */
async function fetchAnalysis(q) {
  const userMsg = [
    `公司：${q.company}`,
    `產品：${q.product}`,
    `題型：${q.question_type}`,
    `題目：${q.problem_statement}`,
    `常見錯誤方向：${(q.common_wrong_directions || []).join('、')}`,
  ].join('\n');

  const systemMsg = `你是 PM 教練。為一道既定的 PM 設計面試題提供 3 個欄位的破題分析（繁體中文）。
回傳合法 JSON，不加 markdown：
{
  "business": "商業背景：這家公司靠什麼賺錢、本題情境如何嵌入商業模式（1-2 句、60-100字）",
  "users": "用戶輪廓：典型用戶分群與情境動機，不洩漏 hidden_context（1-2 句、60-100字）",
  "insight": "破題切入：學員應該優先思考哪個 CIRCLES 步驟、用什麼角度切入；不洩漏答案（1-2 句、60-120字）"
}`;

  let lastError;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const resp = await openai.chat.completions.create({
        model: MODEL,
        messages: [
          { role: 'system', content: systemMsg },
          { role: 'user', content: userMsg },
        ],
        temperature: 0.7,
        max_tokens: 512,
        response_format: { type: 'json_object' },
      });

      const raw = resp.choices[0].message.content;
      if (!raw) throw new Error('OpenAI 回傳空內容');

      const parsed = JSON.parse(raw);
      if (!parsed.business || !parsed.users || !parsed.insight) {
        throw new Error(`回傳 JSON 缺少必要欄位：${JSON.stringify(parsed)}`);
      }
      return parsed;
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

/**
 * 把更新後的題目陣列寫回 circles_database.json。
 */
function saveQuestions(questions) {
  fs.writeFileSync(DB_PATH, JSON.stringify(questions, null, 2) + '\n', 'utf8');
}

// ── 主流程 ────────────────────────────────────────────────────────────────────

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  if (dryRun) console.log('[DRY RUN] OpenAI calls will run; results NOT saved.');

  if (!process.env.OPENAI_API_KEY) {
    console.error('錯誤：請設定環境變數 OPENAI_API_KEY（或用 node -r dotenv/config 載入 .env）');
    process.exit(1);
  }

  // 載入題目
  let questions;
  try {
    questions = loadQuestions();
  } catch (e) {
    console.error('載入 circles_database.json 失敗：', e.message);
    process.exit(1);
  }

  console.log(`載入完成：共 ${questions.length} 道題目`);

  // 依 id 排序（保險起見）
  questions.sort((a, b) => a.id.localeCompare(b.id));

  const total = questions.length;
  let backfilled = 0;
  let skipped = 0;
  const failed = [];

  // 分批處理（CHUNK_SIZE 題一批，批內循序，批間也循序，避免 rate limit）
  for (let i = 0; i < total; i += CHUNK_SIZE) {
    const chunk = questions.slice(i, Math.min(i + CHUNK_SIZE, total));

    for (let j = 0; j < chunk.length; j++) {
      const q = chunk[j];
      const idx = i + j + 1; // 1-based
      const tag = `[${String(idx).padStart(3, ' ')}/${total}] ${q.id}`;

      // 永遠重算 traps（不依賴 OpenAI）
      q.analysis = q.analysis || {};
      q.analysis.traps = (q.common_wrong_directions || []).join('、');

      if (isAnalysisComplete(q)) {
        console.log(`${tag} — 已有分析，跳過`);
        skipped++;
        continue;
      }

      console.log(`${tag} — 生成 analysis...`);
      try {
        const result = await fetchAnalysis(q);
        // 精準 patch：只寫入 business / users / insight，不動其他欄位
        q.analysis.business = result.business;
        q.analysis.users = result.users;
        q.analysis.insight = result.insight;
        // traps 已在上方設定
        backfilled++;
      } catch (err) {
        console.error(`  FAILED: ${q.id} — ${err.message}`);
        failed.push(q.id);
        // 繼續處理下一題（保留部分進度）
      }
    }

    // 每批結束後立即寫回，保留部分進度
    if (!dryRun) saveQuestions(questions);
  }

  // ── 摘要 ────────────────────────────────────────────────────────────────────
  console.log('\n完成！');
  console.log(`  補填：${backfilled} 道`);
  console.log(`  跳過：${skipped} 道`);
  console.log(`  失敗：${failed.length} 道${failed.length > 0 ? '（' + failed.join(', ') + '）' : ''}`);

  if (failed.length > 0) {
    console.error('\n有題目失敗，請重跑腳本補齊。');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('未預期錯誤：', err);
  process.exit(1);
});
