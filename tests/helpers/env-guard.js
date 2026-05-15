const PROD_HOSTS = ['first-principle.up.railway.app'];

function isProdBaseUrl(baseUrl) {
  if (!baseUrl) return false;
  const raw = String(baseUrl);
  const withProto = /:\/\//.test(raw) ? raw : `http://${raw}`;
  try {
    const u = new URL(withProto);
    return PROD_HOSTS.includes(u.hostname);
  } catch {
    return false;
  }
}

function assertNotProdWithRealAccount({ baseUrl, email }) {
  if (!email) {
    throw new Error('env-guard: email is required');
  }
  const isTestEmail = email.endsWith('@first-principle.test');
  if (isProdBaseUrl(baseUrl) && !isTestEmail) {
    throw new Error(
      `BLOCKED: e2e spec hitting prod with real account "${email}". ` +
      `Either set BASE_URL=http://localhost:3000 OR set TEST_EMAIL=e2e@first-principle.test`
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
