const { spawn } = require('child_process');
const { setTimeout: delay } = require('timers/promises');

class CdpPipe {
  constructor(command, args) {
    this.command = command;
    this.args = args;
    this.child = null;
    this.nextId = 0;
    this.pending = new Map();
    this.buffer = '';
  }

  async start() {
    this.child = spawn(this.command, this.args, {
      stdio: ['ignore', 'ignore', 'pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });

    this.writer = this.child.stdio[3];
    this.reader = this.child.stdio[4];

    this.reader.on('data', (chunk) => this.handleData(chunk));
    this.child.stderr.on('data', () => {});
    this.child.on('exit', (code) => {
      for (const [, pending] of this.pending) {
        pending.reject(new Error(`Chrome exited before response (code ${code})`));
      }
      this.pending.clear();
    });

    await delay(1200);
  }

  handleData(chunk) {
    this.buffer += chunk.toString('utf8');
    let boundary = this.buffer.indexOf('\0');
    while (boundary !== -1) {
      const payload = this.buffer.slice(0, boundary);
      this.buffer = this.buffer.slice(boundary + 1);
      boundary = this.buffer.indexOf('\0');
      if (!payload) continue;
      const message = JSON.parse(payload);
      if (message.id && this.pending.has(message.id)) {
        const pending = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) pending.reject(new Error(message.error.message));
        else pending.resolve(message.result);
      }
    }
  }

  send(method, params = {}, sessionId) {
    const id = ++this.nextId;
    const payload = JSON.stringify({
      id,
      method,
      params,
      sessionId,
    });
    this.writer.write(`${payload}\0`);
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`Timeout: ${method}`));
        }
      }, 10000);
    });
  }

  async close() {
    if (!this.child) return;
    this.child.kill('SIGTERM');
    await delay(300);
    if (!this.child.killed) this.child.kill('SIGKILL');
  }
}

async function evalExpr(cdp, sessionId, expression) {
  const res = await cdp.send(
    'Runtime.evaluate',
    { expression, awaitPromise: true, returnByValue: true },
    sessionId
  );
  if (res.result && res.result.subtype === 'error') {
    throw new Error(res.result.description || 'Runtime error');
  }
  return res.result ? res.result.value : undefined;
}

async function setViewport(cdp, sessionId, width, height, mobile) {
  await cdp.send(
    'Emulation.setDeviceMetricsOverride',
    {
      width,
      height,
      deviceScaleFactor: mobile ? 3 : 1,
      mobile,
      screenWidth: width,
      screenHeight: height,
    },
    sessionId
  );
}

async function waitForReady(cdp, sessionId) {
  for (let i = 0; i < 40; i += 1) {
    const ready = await evalExpr(cdp, sessionId, 'document.readyState');
    if (ready === 'complete') return;
    await delay(250);
  }
  throw new Error('Page did not reach readyState=complete');
}

async function setupStep3(cdp, sessionId) {
  await evalExpr(
    cdp,
    sessionId,
    `(async () => {
      await navigate('nsm');
      await new Promise((r) => setTimeout(r, 200));
      AppState.nsmSelectedQuestion = AppState.nsmStep1Questions && AppState.nsmStep1Questions[0]
        ? AppState.nsmStep1Questions[0]
        : AppState.nsmSelectedQuestion;
      AppState.nsmStep = 3;
      AppState.nsmNsmDraft = 'Weekly active teams creating at least one shared doc';
      AppState.nsmBreakdownDraft = {};
      await navigate('nsm');
      return { view: document.body.dataset.view, step: AppState.nsmStep };
    })()`
  );
  await delay(300);
}

async function setupStep4(cdp, sessionId, tab) {
  await evalExpr(
    cdp,
    sessionId,
    `(async () => {
      await navigate('nsm');
      await new Promise((r) => setTimeout(r, 100));
      AppState.nsmSelectedQuestion = AppState.nsmStep1Questions && AppState.nsmStep1Questions[0]
        ? AppState.nsmStep1Questions[0]
        : AppState.nsmSelectedQuestion;
      AppState.nsmNsmDraft = 'Weekly active teams creating at least one shared doc';
      AppState.nsmBreakdownDraft = { retention: '7-day returning teams', depth: '2 docs per week' };
      AppState.nsmSession = {
        id: 'uat-session',
        user_nsm: AppState.nsmNsmDraft,
        user_breakdown: AppState.nsmBreakdownDraft,
        scores_json: {
          totalScore: 78,
          scores: { alignment: 4, leading: 4, actionability: 3, simplicity: 4, sensitivity: 4 },
          coachComments: {
            alignment: 'Tracks core team collaboration well.',
            actionability: 'Still needs clearer sub-metrics.',
          },
          coachTree: {
            nsm: 'Weekly active teams completing a shared workflow',
            alignment: 'Shared workflow completion rate',
            leading: 'Activated teams in first 7 days',
            actionability: 'Docs per active team',
            simplicity: 'Single weekly team metric',
            sensitivity: 'Week-over-week change in active teams',
          },
          coachRationale: {
            nsm: 'Closer to value creation than raw usage.',
            alignment: 'Directly maps to collaboration value.',
          },
          bestMove: 'Anchor the metric on shared team outcomes.',
          mainTrap: 'Do not fall back to generic MAU.',
          summary: 'This NSM is directionally strong and coachable.',
        },
      };
      AppState.nsmReportTab = '${tab}';
      AppState.nsmStep = 4;
      await navigate('nsm');
      return { view: document.body.dataset.view, step: AppState.nsmStep, tab: AppState.nsmReportTab };
    })()`
  );
  await delay(300);
}

async function measureStep3(cdp, sessionId, label) {
  return evalExpr(
    cdp,
    sessionId,
    `(() => {
      const el = document.querySelector('.nsm-body');
      const view = document.querySelector('.nsm-view');
      if (!el || !view) return { label: '${label}', error: 'nsm-body missing' };
      const before = el.scrollTop;
      el.scrollTop = 160;
      const after = el.scrollTop;
      return {
        label: '${label}',
        bodyView: document.body.dataset.view,
        scrollClient: el.clientHeight,
        scrollHeight: el.scrollHeight,
        scrollChanged: after > before,
        overflowX: document.documentElement.scrollWidth > window.innerWidth,
        appWidth: document.getElementById('app')?.getBoundingClientRect().width || 0,
        viewportWidth: window.innerWidth,
        fixedBottomExists: !!document.querySelector('.nsm-fixed-bottom'),
      };
    })()`
  );
}

async function measureStep4(cdp, sessionId, label) {
  return evalExpr(
    cdp,
    sessionId,
    `(() => {
      const el = document.querySelector('.nsm-report-body');
      const comparison = document.querySelector('.nsm-comparison');
      if (!el) return { label: '${label}', error: 'nsm-report-body missing' };
      const before = el.scrollTop;
      el.scrollTop = 160;
      const after = el.scrollTop;
      return {
        label: '${label}',
        bodyView: document.body.dataset.view,
        scrollClient: el.clientHeight,
        scrollHeight: el.scrollHeight,
        scrollChanged: after > before,
        overflowX: document.documentElement.scrollWidth > window.innerWidth,
        comparisonColumns: comparison ? getComputedStyle(comparison).gridTemplateColumns : null,
        viewportWidth: window.innerWidth,
      };
    })()`
  );
}

async function waitUntil(cdp, sessionId, expression, timeoutMs = 30000, intervalMs = 250) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const value = await evalExpr(cdp, sessionId, expression);
    if (value) return value;
    await delay(intervalMs);
  }
  throw new Error(`Condition timed out: ${expression}`);
}

async function click(cdp, sessionId, selector) {
  const ok = await evalExpr(
    cdp,
    sessionId,
    `(() => {
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) return false;
      el.click();
      return true;
    })()`
  );
  if (!ok) throw new Error(`Element not found for click: ${selector}`);
}

async function setValue(cdp, sessionId, selector, value) {
  const ok = await evalExpr(
    cdp,
    sessionId,
    `(() => {
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) return false;
      el.value = ${JSON.stringify(value)};
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    })()`
  );
  if (!ok) throw new Error(`Element not found for input: ${selector}`);
}

async function runActualGuestFlow(cdp, sessionId) {
  await cdp.send('Page.navigate', { url: 'http://127.0.0.1:4000/' }, sessionId);
  await waitForReady(cdp, sessionId);
  await waitUntil(cdp, sessionId, "document.body.dataset.view === 'home'");
  await waitUntil(cdp, sessionId, "document.querySelectorAll('.home-tab-btn').length >= 2");

  await click(cdp, sessionId, '.home-tab-btn[data-tab="nsm"]');
  await waitUntil(cdp, sessionId, "!!document.getElementById('btn-nsm-start')");
  await click(cdp, sessionId, '#btn-nsm-start');

  await waitUntil(cdp, sessionId, "document.body.dataset.view === 'nsm' && AppState.nsmStep === 1");
  await waitUntil(cdp, sessionId, "document.querySelectorAll('.nsm-question-card[data-qid]').length >= 1");
  await click(cdp, sessionId, '.nsm-question-card[data-qid]');
  await waitUntil(cdp, sessionId, "!document.getElementById('btn-nsm-step1-next').disabled");
  await click(cdp, sessionId, '#btn-nsm-step1-next');

  await waitUntil(cdp, sessionId, "AppState.nsmStep === 2 && !!document.getElementById('nsm-nsm-input')", 30000);
  await setValue(cdp, sessionId, '#nsm-nsm-input', 'Weekly active teams completing one shared workflow');
  await click(cdp, sessionId, '#btn-nsm-step2-next');

  await waitUntil(cdp, sessionId, "AppState.nsmStep === 3 && document.querySelectorAll('.nsm-dim-input').length >= 1", 30000);
  const fillRes = await evalExpr(
    cdp,
    sessionId,
    `(() => {
      const vals = [
        'New teams reaching first shared outcome within 7 days',
        'Average shared workflows completed per active team each week',
        'Teams returning weekly to complete at least one workflow',
        'Higher workflow completion raises retained team count'
      ];
      const inputs = [...document.querySelectorAll('.nsm-dim-input')];
      inputs.forEach((el, idx) => {
        el.value = vals[idx] || ('Dimension answer ' + (idx + 1));
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      });
      return inputs.length;
    })()`
  );
  if (!fillRes) throw new Error('No step 3 inputs filled');
  await click(cdp, sessionId, '#btn-nsm-step3-submit');

  await waitUntil(
    cdp,
    sessionId,
    "AppState.nsmStep === 4 && !!AppState.nsmSession && !!AppState.nsmSession.scores_json && !!AppState.nsmSession.scores_json.totalScore",
    120000,
    500
  );

  const result = await evalExpr(
    cdp,
    sessionId,
    `(() => {
      const score = AppState.nsmSession && AppState.nsmSession.scores_json;
      const sessionId = AppState.nsmSession && AppState.nsmSession.id;
      return {
        bodyView: document.body.dataset.view,
        step: AppState.nsmStep,
        sessionId,
        totalScore: score && score.totalScore,
        hasCoachTree: !!(score && score.coachTree && score.coachTree.nsm),
        hasSummary: !!(score && score.summary),
        reportScrollHeight: document.querySelector('.nsm-report-body')?.scrollHeight || 0,
        reportClientHeight: document.querySelector('.nsm-report-body')?.clientHeight || 0,
        hasError: !!document.getElementById('nsm-step3-error')?.textContent,
        recentSessionCount: Array.isArray(AppState.recentSessions) ? AppState.recentSessions.length : 0,
      };
    })()`
  );

  if (result && result.sessionId) {
    await evalExpr(
      cdp,
      sessionId,
      `(async () => {
        const sid = ${JSON.stringify(result.sessionId)};
        const headers = { 'X-Guest-ID': AppState.guestId };
        await fetch('/api/guest/nsm-sessions/' + sid, { method: 'DELETE', headers });
        return true;
      })()`
    );
  }

  return result;
}

async function main() {
  const chromePath = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const userDataDir = process.env.CHROME_USER_DATA_DIR || 'C:\\side\\first_principle\\pm-drill\\.tmp-chrome-profile';

  const cdp = new CdpPipe(chromePath, [
    '--headless=new',
    '--remote-debugging-pipe',
    `--user-data-dir=${userDataDir}`,
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    'about:blank',
  ]);

  await cdp.start();
  try {
    await cdp.send('Target.setDiscoverTargets', { discover: true });
    const { targetId } = await cdp.send('Target.createTarget', { url: 'http://127.0.0.1:4000/' });
    const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });

    await cdp.send('Page.enable', {}, sessionId);
    await cdp.send('Runtime.enable', {}, sessionId);
    await waitForReady(cdp, sessionId);

    const results = [];

    await setViewport(cdp, sessionId, 1440, 1024, false);
    await setupStep3(cdp, sessionId);
    results.push(await measureStep3(cdp, sessionId, 'desktop-step3'));
    await setupStep4(cdp, sessionId, 'comparison');
    results.push(await measureStep4(cdp, sessionId, 'desktop-step4-comparison'));

    await setViewport(cdp, sessionId, 390, 844, true);
    await setupStep3(cdp, sessionId);
    results.push(await measureStep3(cdp, sessionId, 'mobile-step3'));
    await setupStep4(cdp, sessionId, 'comparison');
    results.push(await measureStep4(cdp, sessionId, 'mobile-step4-comparison'));

    await setViewport(cdp, sessionId, 1440, 1024, false);
    results.push({
      label: 'desktop-actual-guest-flow',
      ...(await runActualGuestFlow(cdp, sessionId)),
    });

    console.log(JSON.stringify(results, null, 2));
  } finally {
    await cdp.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
