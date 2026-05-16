// 3 input pools for Phase 1 form (8 fields = I.×4 + C1.×4).
// All values are realistic zh-TW content drawn from rotation pools (no stub timestamps).
//
// Per memory feedback_e2e_real_data_only:
//   - No `e2e-r${N}-${Date.now()}-fX` style stubs (the B7 incident pattern)
//   - Use realistic zh-TW that mirrors what real users would type
//
// Field schema verified against public/app.js lines 6947-6950 and 3243-3265:
//   I:  目標用戶分群 / 選定焦點對象 / 用戶動機假設(JTBD) / 排除對象
//   C1: 問題範圍 / 時間範圍 / 業務影響 / 假設確認

const I_FIELDS = ['目標用戶分群', '選定焦點對象', '用戶動機假設(JTBD)', '排除對象'];
const C1_FIELDS = ['問題範圍', '時間範圍', '業務影響', '假設確認'];

// Garbage: trips Layer 1 (FE pre-guard). Mix of all 3 fail modes.
const GARBAGE_POOL = ['Y', 'YYYY', 'asdf', '上班族', '....', '1111', 'aaaa', '   '];

// Thin: passes Layer 1 (≥ 4 chars + has Chinese), fails Layer 2 semantically.
const THIN_POOL = [
  '上班族男',
  '需要的事',
  '重要問題',
  '感覺很好',
  '應該注意',
  '可能會有',
  '這個那個',
  '某些事情',
];

// Quality: passes both layers. Realistic CIRCLES Phase 1 answers.
const QUALITY_POOL = [
  '20-35 歲都會區上班族女性，月薪 4-8 萬，每日通勤時間 40-90 分鐘',
  '通勤族：每天 30-60 分鐘，廣告打斷影響最大，對 podcast 黏著度最高',
  '當我在通勤時，我想不被廣告打斷地完整聽完一集 podcast，以便維持學習節奏',
  '付費訂閱者：已無廣告干擾；創作者：供給側需求不同，不在本次範圍',
  '聚焦免費版通勤用戶在新用戶階段（7 日內）的廣告體驗，排除付費方案與創作者後台',
  '60 天，因廣告活動以月為週期，2 個完整週期可觀察留存效應與廣告耐受度',
  '廣告收入和免費→付費轉換率不能下降超過 3%，次月留存目標提升 ≥ 5 個百分點',
  '假設：用戶廣告負感主要來自時段與頻率，而非廣告本身；通勤族願意接受每集 ≤ 2 則廣告',
];

function pick(pool, n) {
  return pool.slice(0, n);
}

function makePayload(values8) {
  return {
    I: Object.fromEntries(I_FIELDS.map((k, i) => [k, values8[i] || ''])),
    C1: Object.fromEntries(C1_FIELDS.map((k, i) => [k, values8[i + 4] || ''])),
  };
}

function garbage() { return makePayload(pick(GARBAGE_POOL, 8)); }
function thin()    { return makePayload(pick(THIN_POOL, 8)); }
function quality() { return makePayload(pick(QUALITY_POOL, 8)); }

module.exports = { garbage, thin, quality, I_FIELDS, C1_FIELDS };
