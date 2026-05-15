const {
  assertNotProdWithRealAccount,
  assertActingOnBehalfOfPollutionTarget,
} = require('./env-guard');

describe('assertNotProdWithRealAccount', () => {
  test('throws when prod URL + real account email', () => {
    expect(() =>
      assertNotProdWithRealAccount({
        baseUrl: 'https://first-principle.up.railway.app/',
        email: 'albertpeng678@gmail.com',
      })
    ).toThrow(/BLOCKED.*real account/);
  });

  test('passes when prod URL + test account email', () => {
    expect(() =>
      assertNotProdWithRealAccount({
        baseUrl: 'https://first-principle.up.railway.app/',
        email: 'e2e@first-principle.test',
      })
    ).not.toThrow();
  });

  test('passes when local URL + real account email', () => {
    expect(() =>
      assertNotProdWithRealAccount({
        baseUrl: 'http://localhost:3000',
        email: 'albertpeng678@gmail.com',
      })
    ).not.toThrow();
  });

  test('passes when local URL + test account email', () => {
    expect(() =>
      assertNotProdWithRealAccount({
        baseUrl: 'http://localhost:3000',
        email: 'e2e@first-principle.test',
      })
    ).not.toThrow();
  });

  test('throws with clear message when email is missing', () => {
    expect(() =>
      assertNotProdWithRealAccount({
        baseUrl: 'https://first-principle.up.railway.app/',
        email: undefined,
      })
    ).toThrow(/email is required/);
  });

  // Defense-in-depth: substring-unanchored prod check vulnerability
  test('passes when URL contains "railway.app" as a sub-domain of an attacker host', () => {
    expect(() =>
      assertNotProdWithRealAccount({
        baseUrl: 'http://attacker-railway.app.evil.com/',
        email: 'albertpeng678@gmail.com',
      })
    ).not.toThrow();
  });

  // Defense-in-depth: undefined / null / empty baseUrl treated as non-prod
  test.each([undefined, null, ''])('passes when baseUrl is %p (treated as local)', (baseUrl) => {
    expect(() =>
      assertNotProdWithRealAccount({
        baseUrl,
        email: 'albertpeng678@gmail.com',
      })
    ).not.toThrow();
  });

  // Defense-in-depth: empty / null email blocks alongside undefined
  test.each([null, ''])('throws when email is %p', (email) => {
    expect(() =>
      assertNotProdWithRealAccount({
        baseUrl: 'https://first-principle.up.railway.app/',
        email,
      })
    ).toThrow(/email is required/);
  });
});

describe('assertActingOnBehalfOfPollutionTarget', () => {
  const ORIGINAL_USER_REAL_EMAIL = process.env.USER_REAL_EMAIL;
  beforeEach(() => {
    process.env.USER_REAL_EMAIL = 'albertpeng678@gmail.com';
  });
  afterAll(() => {
    if (ORIGINAL_USER_REAL_EMAIL !== undefined) {
      process.env.USER_REAL_EMAIL = ORIGINAL_USER_REAL_EMAIL;
    } else {
      delete process.env.USER_REAL_EMAIL;
    }
  });

  test('passes when target matches USER_REAL_EMAIL', () => {
    expect(() =>
      assertActingOnBehalfOfPollutionTarget('albertpeng678@gmail.com')
    ).not.toThrow();
  });

  test('throws when target is the test account email (cleanup mode is opt-in for real account only)', () => {
    expect(() =>
      assertActingOnBehalfOfPollutionTarget('e2e@first-principle.test')
    ).toThrow(/cleanup mode is only for the polluted real account/);
  });

  test('throws when target is a third-party email', () => {
    expect(() =>
      assertActingOnBehalfOfPollutionTarget('someone-else@gmail.com')
    ).toThrow(/cleanup mode is only for the polluted real account/);
  });
});
