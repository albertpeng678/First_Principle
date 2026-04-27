// Shared product-type classifier used by every NSM-related prompt and route.
// Keeps the classification consistent across context generation, evaluation, and hints.
//
// Returns one of: 'attention' | 'transaction' | 'creator' | 'saas'

const PATTERNS = {
  transaction: /電商|marketplace|外賣|美食|叫車|打車|共享|租車|預訂|配送|撮合|airbnb|uber|grab|foodpanda|wolt|booking/,
  saas:        /saas|企業|b2b|crm|協作|辦公|工具|管理|自動化|zendesk|slack|notion|figma|datadog|zoom|intercom|twilio|stripe|shopify/,
  creator:     /教育|學習|課程|語言|創作|ugc|知識|部落|newsletter|podcast|直播|duolingo|coursera|creator/,
};

function guessProductType(question_json = {}) {
  const text = [
    question_json.company,
    question_json.industry,
    question_json.scenario,
  ].filter(Boolean).join(' ').toLowerCase();

  if (PATTERNS.transaction.test(text)) return 'transaction';
  if (PATTERNS.saas.test(text))        return 'saas';
  if (PATTERNS.creator.test(text))     return 'creator';
  return 'attention';
}

const PRODUCT_TYPE_LABELS = {
  attention:   '注意力型（媒體/社交/訂閱制）',
  transaction: '交易量型（電商/共享/O2O）',
  creator:     '創造力型（UGC/教育/知識平台）',
  saas:        'SaaS 型（B2B/訂閱工具）',
};

module.exports = { guessProductType, PRODUCT_TYPE_LABELS };
