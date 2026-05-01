const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const BATCHES = [
  { type: 'design', count: 40, label: '產品設計題' },
  { type: 'improve', count: 35, label: '產品改進題' },
  { type: 'strategy', count: 25, label: '產品策略題' },
];

const SYSTEM_PROMPT = `你是 PM 面試題庫生成器。回傳格式必須是 {"questions": [...]}，不加任何說明或 markdown。

每道題的格式：
{
  "id": "circles_001",
  "company": "真實企業名",
  "product": "具體產品名（非僅公司名）",
  "question_type": "design" | "improve" | "strategy",
  "difficulty": "easy" | "medium" | "hard",
  "problem_statement": "題目陳述（給學員看，50-100字，繁體中文）",
  "hidden_context": "被訪談者知道但 PM 不知道的資訊（30-60字）",
  "coach_circles": {
    "C1": "澄清情境示範（100-150字）",
    "I": "定義用戶示範（100-150字）",
    "R": "發掘需求示範（100-150字）",
    "C2": "優先排序示範（100-150字）",
    "L": "提出方案示範（150-200字）",
    "E": "評估取捨示範（100-150字）",
    "S": "總結推薦示範（100-150字）"
  },
  "common_wrong_directions": ["錯誤方向1", "錯誤方向2", "錯誤方向3"],
  "anti_patterns": ["常見錯誤指標或假設1", "常見錯誤指標或假設2"],
  "analysis": {
    "business": "商業背景：這家公司靠什麼賺錢、本題情境如何嵌入商業模式（1-2 句、繁體中文，60-100字）",
    "users": "用戶輪廓：典型用戶分群與情境動機，不洩漏 hidden_context（1-2 句，60-100字）",
    "insight": "破題切入：學員應該優先思考哪個 CIRCLES 步驟、用什麼角度切入；不洩漏答案（1-2 句，60-120字）"
  }
}

要求：
- company 必須是真實企業（Spotify, Meta, Grab, LINE, Shopee 等）
- 每道題情境獨特，不重複
- hidden_context 設計讓好問題才能挖出的資訊
- coach_circles 示範要真實可用，非通用廢話
- 全部繁體中文`;

function isQuestionFullyAnalyzed(q) {
  return q.analysis && q.analysis.business && q.analysis.users && q.analysis.insight;
}

function postProcessQuestion(q) {
  q.analysis = q.analysis || {};
  q.analysis.traps = (q.common_wrong_directions || []).join('、');
  return q;
}

async function generateBatch(type, startId, count) {
  const label = BATCHES.find(b => b.type === type).label;
  const prompt = `生成 ${count} 道「${label}」，id 從 circles_${String(startId).padStart(3,'0')} 開始連續編號。回傳 JSON 陣列。`;

  const resp = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: prompt },
    ],
    temperature: 0.8,
    max_tokens: 16000,
    response_format: { type: 'json_object' },
  });

  const raw = resp.choices[0].message.content;
  if (!raw) {
    throw new Error(`Empty response for type=${type} startId=${startId} (finish_reason: ${resp.choices[0].finish_reason})`);
  }
  const parsed = JSON.parse(raw);
  let arr;
  if (Array.isArray(parsed)) arr = parsed;
  else {
    // Find the key whose value is an array of objects (not strings)
    arr = Object.values(parsed).find(v => Array.isArray(v) && v.length > 0 && typeof v[0] === 'object');
  }
  arr = arr ?? [];
  return arr.map(postProcessQuestion);
}

async function main() {
  const outDir = path.join(__dirname, '..', 'circles_plan');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  // Load existing questions to enable idempotent re-runs
  const jsPath = path.join(__dirname, '..', 'public', 'circles-db.js');
  let existingQuestions = [];
  const existingById = {};
  if (fs.existsSync(jsPath)) {
    try {
      const jsContent = fs.readFileSync(jsPath, 'utf8');
      // Sandbox eval to safely extract CIRCLES_QUESTIONS (avoids greedy regex pitfall)
      // This is robust when the file has multiple var declarations (CIRCLES_STEPS, CIRCLES_STEP_CONFIG, etc.)
      const sandbox = { CIRCLES_QUESTIONS: [], CIRCLES_STEPS: [], CIRCLES_STEP_CONFIG: {} };
      const fn = new Function('CIRCLES_QUESTIONS', 'CIRCLES_STEPS', 'CIRCLES_STEP_CONFIG',
        jsContent + '\nreturn CIRCLES_QUESTIONS;');
      existingQuestions = fn(sandbox.CIRCLES_QUESTIONS, sandbox.CIRCLES_STEPS, sandbox.CIRCLES_STEP_CONFIG) || [];

      if (Array.isArray(existingQuestions) && existingQuestions.length > 0) {
        existingQuestions.forEach(q => {
          existingById[q.id] = q;
          // Always recompute traps since common_wrong_directions may have changed
          if (q.common_wrong_directions) {
            postProcessQuestion(q);
          }
        });
      }
    } catch (e) {
      console.warn(`Warning: could not load existing questions from ${jsPath}: ${e.message}`);
    }
  }

  let allQuestions = [];
  let currentId = 1;

  for (const { type, count } of BATCHES) {
    console.log(`Generating ${count} ${type} questions...`);
    // Generate in chunks of 15 to stay within token limits
    const chunkSize = 15;
    for (let i = 0; i < count; i += chunkSize) {
      const batchCount = Math.min(chunkSize, count - i);
      const toGenerate = [];
      const toSkip = [];

      // Determine which questions to generate and which to skip
      for (let j = 0; j < batchCount; j++) {
        const qid = `circles_${String(currentId + j).padStart(3, '0')}`;
        const existing = existingById[qid];
        if (existing && isQuestionFullyAnalyzed(existing)) {
          toSkip.push(qid);
        } else {
          toGenerate.push(qid);
        }
      }

      if (toGenerate.length > 0) {
        const questions = await generateBatch(type, currentId, toGenerate.length);
        // Merge newly generated with existing
        const merged = [];
        let genIdx = 0;
        for (let j = 0; j < batchCount; j++) {
          const qid = `circles_${String(currentId + j).padStart(3, '0')}`;
          if (toSkip.includes(qid)) {
            merged.push(existingById[qid]);
          } else {
            if (genIdx < questions.length) {
              merged.push(questions[genIdx]);
              existingById[qid] = questions[genIdx];
              genIdx++;
            }
          }
        }
        allQuestions = allQuestions.concat(merged);
        if (questions.length !== toGenerate.length) {
          console.warn(`  ⚠️  WARNING: requested ${toGenerate.length}, got ${questions.length} (advancing currentId by actual generated count)`);
          // Advance only by the actual number of questions generated
          currentId += questions.length;
        } else {
          // All requested questions were returned, advance normally
          currentId += batchCount;
        }
      } else {
        // All questions in this batch are already analyzed, skip generation
        const skipped = [];
        for (const qid of toSkip) {
          skipped.push(existingById[qid]);
        }
        allQuestions = allQuestions.concat(skipped);
        currentId += batchCount;
      }

      const skipInfo = toSkip.length > 0 ? ` (skipped ${toSkip.length} existing)` : '';
      console.log(`  Generated/skipped ${batchCount}${skipInfo} (total: ${allQuestions.length})`);
    }
  }

  const outPath = path.join(outDir, 'circles_database.json');
  fs.writeFileSync(outPath, JSON.stringify(allQuestions, null, 2), 'utf8');

  // Write public/circles-db.js in the var format expected by the SPA
  const jsContent = '// Auto-generated — do not edit manually\n' +
    '// Run: node scripts/generate-circles-questions.js to regenerate\n' +
    'var CIRCLES_QUESTIONS = ' + JSON.stringify(allQuestions, null, 2) + ';\n';
  fs.writeFileSync(jsPath, jsContent, 'utf8');

  console.log(`\nDone! ${allQuestions.length} questions saved to ${outPath} and ${jsPath}`);
}

main().catch(console.error);
