const {
  minLength,
  notAllSameChar,
  notTrivialAsciiToken,
  validateFrameworkInput,
} = require('../../public/lib/frameworkValidator');

describe('minLength', () => {
  test.each([
    ['',        false],
    ['Y',       false],
    ['YY',      false],
    ['YYY',     false],
    ['YYYY',    true],
    ['上班族',  false],
    ['上班族男', true],
    ['  abc  ', false],
  ])('minLength(%j, 4) === %s', (v, expected) => {
    expect(minLength(v, 4)).toBe(expected);
  });
});

describe('notAllSameChar', () => {
  test.each([
    ['aaaa',  false],
    ['1111',  false],
    ['....',  false],
    ['    ',  false],
    ['aabb',  true],
    ['上班上', true],
    ['',      true],
  ])('notAllSameChar(%j) === %s', (v, expected) => {
    expect(notAllSameChar(v)).toBe(expected);
  });
});

describe('notTrivialAsciiToken', () => {
  test.each([
    ['Y',       false],
    ['asdf',    false],
    ['1234',    false],
    ['abcd',    false],
    ['上班族', true],
    ['ab cd',  true],
    ['hello',  true],
    ['上班族男', true],
    ['Y is a brand', true],
  ])('notTrivialAsciiToken(%j) === %s', (v, expected) => {
    expect(notTrivialAsciiToken(v)).toBe(expected);
  });
});

describe('validateFrameworkInput', () => {
  // Use I_FIELDS / C1_FIELDS from factory — single source of truth for field order/names.
  // T2 implementer noted the production order:
  //   I_FIELDS  = ['目標用戶分群', '選定焦點對象', '用戶動機假設(JTBD)', '排除對象']
  //   C1_FIELDS = ['問題範圍', '時間範圍', '業務影響', '假設確認']
  const goodValues = {
    I: {
      '目標用戶分群': '20-35 歲都會區上班族',
      '選定焦點對象': '通勤時段使用大眾運輸',
      '用戶動機假設(JTBD)': '希望利用零碎時間學新技能',
      '排除對象': '排除非智慧型手機用戶與長者',
    },
    C1: {
      '問題範圍': '近 6 個月活躍用戶留存率下降 12%',
      '時間範圍': '上線首月 + 後續 3 個月觀察',
      '業務影響': '提升次月留存率 ≥ 70%',
      '假設確認': '簡化 onboarding 可降低首日流失',
    },
  };

  test('all 8 quality values → ok=true, errors=[]', () => {
    const r = validateFrameworkInput(goodValues);
    expect(r.ok).toBe(true);
    expect(r.errors).toEqual([]);
  });

  test('one field with "Y" → ok=false, errors lists field with rule=minLength', () => {
    const v = JSON.parse(JSON.stringify(goodValues));
    v.I['排除對象'] = 'Y';
    const r = validateFrameworkInput(v);
    expect(r.ok).toBe(false);
    expect(r.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: 'I.排除對象', rule: 'minLength' }),
    ]));
  });

  test('one field with "aaaa" → fails notAllSameChar', () => {
    const v = JSON.parse(JSON.stringify(goodValues));
    v.C1['業務影響'] = 'aaaa';
    const r = validateFrameworkInput(v);
    expect(r.ok).toBe(false);
    expect(r.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: 'C1.業務影響', rule: 'notAllSameChar' }),
    ]));
  });

  test('one field with "asdf" → fails notTrivialAsciiToken', () => {
    const v = JSON.parse(JSON.stringify(goodValues));
    v.I['目標用戶分群'] = 'asdf';
    const r = validateFrameworkInput(v);
    expect(r.ok).toBe(false);
    expect(r.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: 'I.目標用戶分群', rule: 'notTrivialAsciiToken' }),
    ]));
  });

  test('all 8 fields with "Y" → 8 errors all minLength, ordered I.* then C1.*', () => {
    const allY = {
      I: { '目標用戶分群': 'Y', '選定焦點對象': 'Y', '用戶動機假設(JTBD)': 'Y', '排除對象': 'Y' },
      C1: { '問題範圍': 'Y', '時間範圍': 'Y', '業務影響': 'Y', '假設確認': 'Y' },
    };
    const r = validateFrameworkInput(allY);
    expect(r.ok).toBe(false);
    expect(r.errors).toHaveLength(8);
    expect(r.errors.every((e) => e.rule === 'minLength')).toBe(true);
    // Locked contract for T6 renderInlineFrameworkErrors top-down highlight order
    expect(r.errors.map((e) => e.field)).toEqual([
      'I.目標用戶分群', 'I.選定焦點對象', 'I.用戶動機假設(JTBD)', 'I.排除對象',
      'C1.問題範圍',   'C1.時間範圍',   'C1.業務影響',         'C1.假設確認',
    ]);
  });

  test.each([
    [42],
    [true],
    [['a', 'b']],
    [null],
  ])('non-string inner value (%j) → rejected as minLength (no crash)', (badValue) => {
    const v = JSON.parse(JSON.stringify(goodValues));
    v.I['排除對象'] = badValue;
    expect(() => validateFrameworkInput(v)).not.toThrow();
    const r = validateFrameworkInput(v);
    expect(r.ok).toBe(false);
    expect(r.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: 'I.排除對象', rule: 'minLength' }),
    ]));
  });

  test('values with extra unrecognized field → ignored, no error', () => {
    const v = JSON.parse(JSON.stringify(goodValues));
    v.I.junkField = 'Y';
    const r = validateFrameworkInput(v);
    expect(r.ok).toBe(true);
  });

  test('null / undefined / empty → ok=false', () => {
    expect(validateFrameworkInput(null).ok).toBe(false);
    expect(validateFrameworkInput(undefined).ok).toBe(false);
    expect(validateFrameworkInput({}).ok).toBe(false);
  });

  describe('opts.onlySection', () => {
    test('onlySection=C1 + only C1 filled with quality → ok=true', () => {
      const r = validateFrameworkInput(
        { I: {}, C1: goodValues.C1 },
        { onlySection: 'C1' }
      );
      expect(r.ok).toBe(true);
      expect(r.errors).toEqual([]);
    });

    test('onlySection=I + only I filled with quality → ok=true', () => {
      const r = validateFrameworkInput(
        { I: goodValues.I, C1: {} },
        { onlySection: 'I' }
      );
      expect(r.ok).toBe(true);
      expect(r.errors).toEqual([]);
    });

    test('onlySection=C1 + C1 has garbage Y → 4 errors all C1.*', () => {
      const r = validateFrameworkInput(
        { I: {}, C1: { '問題範圍': 'Y', '時間範圍': 'Y', '業務影響': 'Y', '假設確認': 'Y' } },
        { onlySection: 'C1' }
      );
      expect(r.ok).toBe(false);
      expect(r.errors).toHaveLength(4);
      expect(r.errors.every((e) => e.field.startsWith('C1.'))).toBe(true);
    });

    test('default (no opts) still validates both sections', () => {
      // sanity — existing behavior unchanged
      const r = validateFrameworkInput({ I: {}, C1: goodValues.C1 });
      expect(r.ok).toBe(false);
      expect(r.errors.filter((e) => e.field.startsWith('I.'))).toHaveLength(4);
    });
  });
});
