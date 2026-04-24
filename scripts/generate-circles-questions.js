const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const BATCHES = [
  { type: 'design', count: 40, label: '產品設計題' },
  { type: 'improve', count: 35, label: '產品改進題' },
  { type: 'strategy', count: 25, label: '產品策略題' },
];

const SYSTEM_PROMPT = `你是 PM 面試題庫生成器。生成嚴格符合格式的 JSON 陣列，不加任何說明或 markdown。

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
  "anti_patterns": ["常見錯誤指標或假設1", "常見錯誤指標或假設2"]
}

要求：
- company 必須是真實企業（Spotify, Meta, Grab, LINE, Shopee 等）
- 每道題情境獨特，不重複
- hidden_context 設計讓好問題才能挖出的資訊
- coach_circles 示範要真實可用，非通用廢話
- 全部繁體中文`;

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

  const parsed = JSON.parse(resp.choices[0].message.content);
  return Array.isArray(parsed) ? parsed : parsed.questions || parsed.data || [];
}

async function main() {
  const outDir = path.join(__dirname, '..', 'circles_plan');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  let allQuestions = [];
  let currentId = 1;

  for (const { type, count } of BATCHES) {
    console.log(`Generating ${count} ${type} questions...`);
    // Generate in chunks of 15 to stay within token limits
    const chunkSize = 15;
    for (let i = 0; i < count; i += chunkSize) {
      const batchCount = Math.min(chunkSize, count - i);
      const questions = await generateBatch(type, currentId, batchCount);
      allQuestions = allQuestions.concat(questions);
      currentId += questions.length;
      console.log(`  Generated ${questions.length} (total: ${allQuestions.length})`);
    }
  }

  const outPath = path.join(outDir, 'circles_database.json');
  fs.writeFileSync(outPath, JSON.stringify(allQuestions, null, 2), 'utf8');
  console.log(`\nDone! ${allQuestions.length} questions saved to ${outPath}`);
}

main().catch(console.error);
