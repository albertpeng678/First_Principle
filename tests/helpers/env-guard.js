function assertNotProdWithRealAccount({ baseUrl, email }) {
  if (!email) {
    throw new Error('env-guard: email is required');
  }
  const isProd = String(baseUrl || '').includes('railway.app');
  const isTestEmail = email.endsWith('@first-principle.test');
  if (isProd && !isTestEmail) {
    throw new Error(
      `BLOCKED: e2e spec hitting prod with real account "${email}". ` +
      `Either set BASE_URL to local OR use TEST_EMAIL ending in @first-principle.test`
    );
  }
}

function assertActingOnBehalfOfPollutionTarget(targetEmail) {
  const realEmail = process.env.USER_REAL_EMAIL;
  if (!realEmail) {
    throw new Error(
      'env-guard: USER_REAL_EMAIL not set in env; cleanup mode requires explicit opt-in'
    );
  }
  if (targetEmail !== realEmail) {
    throw new Error(
      `BLOCKED: cleanup mode is only for the polluted real account ` +
      `(USER_REAL_EMAIL=${realEmail}). Got: ${targetEmail}`
    );
  }
}

module.exports = {
  assertNotProdWithRealAccount,
  assertActingOnBehalfOfPollutionTarget,
};
