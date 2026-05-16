// Layer 1 pre-guard for CIRCLES Phase 1 form gate.
// Pure functions, zero deps, jest-tested. Browser-loadable via <script>.

const I_FIELDS = ['目標用戶分群', '選定焦點對象', '用戶動機假設(JTBD)', '排除對象'];
const C1_FIELDS = ['問題範圍', '時間範圍', '業務影響', '假設確認'];

function minLength(value, n) {
  if (typeof value !== 'string') return false;
  return value.trim().length >= n;
}

function notAllSameChar(value) {
  if (typeof value !== 'string' || value.length === 0) return true;
  const trimmed = value.trim();
  if (trimmed.length === 0) return false; // all-whitespace = all same
  const first = trimmed[0];
  return !trimmed.split('').every((c) => c === first);
}

function notTrivialAsciiToken(value) {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (trimmed.length > 4) return true;             // long enough → not trivial
  if (/[一-鿿]/.test(trimmed)) return true; // has Chinese → not trivial
  if (/\s/.test(trimmed)) return true;             // has space → not trivial
  return false; // ≤ 4 ASCII chars, no Chinese, no space → trivial
}

function validateFrameworkInput(values) {
  const errors = [];
  if (!values || typeof values !== 'object') {
    return { ok: false, errors: [{ field: '_root', rule: 'shape', message: 'values is required' }] };
  }
  const sections = [['I', I_FIELDS], ['C1', C1_FIELDS]];
  for (const [section, fields] of sections) {
    const sectionVals = values[section] || {};
    for (const field of fields) {
      const v = sectionVals[field];
      if (typeof v !== 'string' || v.trim().length === 0) {
        errors.push({ field: `${section}.${field}`, rule: 'minLength', message: '此欄位為必填' });
        continue;
      }
      if (!minLength(v, 4)) {
        errors.push({ field: `${section}.${field}`, rule: 'minLength', message: '需 ≥ 4 字' });
        continue;
      }
      if (!notAllSameChar(v)) {
        errors.push({ field: `${section}.${field}`, rule: 'notAllSameChar', message: '不能全部同字元' });
        continue;
      }
      if (!notTrivialAsciiToken(v)) {
        errors.push({ field: `${section}.${field}`, rule: 'notTrivialAsciiToken', message: '請更具體（避免單字英數）' });
        continue;
      }
    }
  }
  return { ok: errors.length === 0, errors };
}

// CommonJS export for jest
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    minLength,
    notAllSameChar,
    notTrivialAsciiToken,
    validateFrameworkInput,
    I_FIELDS,
    C1_FIELDS,
  };
}

// Browser global for <script> tag in index.html (Task 6 will load this before app.js)
if (typeof window !== 'undefined') {
  window.frameworkValidator = {
    minLength,
    notAllSameChar,
    notTrivialAsciiToken,
    validateFrameworkInput,
    I_FIELDS,
    C1_FIELDS,
  };
}
