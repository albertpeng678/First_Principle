// ── 常數 ─────────────────────────────────────────
const SUPABASE_URL = 'https://klvlizxmvzfpvfgswmfk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtsdmxpenhtdnpmcHZmZ3N3bWZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2NjcyNDIsImV4cCI6MjA5MjI0MzI0Mn0.KOF72gPKbllpYq7t3ny21HBEScUlj2diSl47oNyhJTY';

// ── AppState ──────────────────────────────────────
const AppState = {
  mode: 'loading',
  accessToken: null,
  guestId: null,
  user: null,
  currentSession: null,
  isStreaming: false,
  theme: localStorage.getItem('theme') || 'light',
  view: 'home',
};

// ── Supabase ──────────────────────────────────────
let supabase;

async function initSupabase() {
  const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  supabase.auth.onAuthStateChange((event, session) => {
    if (session) {
      AppState.mode = 'auth';
      AppState.accessToken = session.access_token;
      AppState.user = session.user;
      if (event === 'SIGNED_IN') migrateGuestSessions();
    } else {
      AppState.mode = 'guest';
      AppState.accessToken = null;
      AppState.user = null;
    }
    render();
  });
}

// ── API helpers ───────────────────────────────────
function apiHeaders() {
  if (AppState.mode === 'auth') {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${AppState.accessToken}`,
    };
  }
  return {
    'Content-Type': 'application/json',
    'X-Guest-ID': AppState.guestId,
  };
}

function sessionRoute(path = '') {
  return (AppState.mode === 'auth' ? '/api/sessions' : '/api/guest/sessions') + path;
}

async function migrateGuestSessions() {
  const guestId = localStorage.getItem('guestId');
  const lastSessionId = localStorage.getItem('lastSessionId');
  if (!guestId || !lastSessionId) return;

  try {
    const { data: session } = await supabase.auth.getSession();
    await fetch('/api/migrate-guest', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.session.access_token}`,
        'X-Guest-ID': guestId,
      },
      body: JSON.stringify({ guestSessionIds: [lastSessionId] }),
    });
    localStorage.removeItem('guestId');
  } catch (_) {}
}

// ── Theme ─────────────────────────────────────────
function applyTheme(theme) {
  AppState.theme = theme;
  document.documentElement.dataset.theme = theme;
  localStorage.setItem('theme', theme);
}

// ── Render ────────────────────────────────────────
function render() {
  renderNavbar();
  const main = document.getElementById('main');
  switch (AppState.view) {
    case 'home':     main.innerHTML = renderHome(); bindHome(); break;
    case 'login':    main.innerHTML = renderLogin(); bindLogin(); break;
    case 'register': main.innerHTML = renderRegister(); bindRegister(); break;
    case 'practice': main.innerHTML = renderPractice(); bindPractice(); break;
    case 'report':   main.innerHTML = renderReport(); bindReport(); break;
    case 'history':  main.innerHTML = renderHistory(); bindHistory(); break;
  }
}

function navigate(view) {
  AppState.view = view;
  document.body.dataset.view = view;
  render();
}

function renderNavbar() {
  const el = document.getElementById('navbar-actions');
  const themeIcon = AppState.theme === 'dark'
    ? '<i class="ph ph-sun"></i>'
    : '<i class="ph ph-moon"></i>';
  const homeBtn = AppState.view === 'report'
    ? `<button class="btn-icon" title="返回首頁" onclick="navigate('home')"><i class="ph ph-house"></i></button>`
    : '';

  if (AppState.mode === 'auth') {
    el.innerHTML = `
      ${homeBtn}
      <span style="color:var(--text-secondary);font-size:0.85rem">${AppState.user?.email}</span>
      <button class="btn btn-ghost" id="btn-logout">登出</button>
      <button class="btn-icon" title="切換主題" onclick="applyTheme(AppState.theme==='dark'?'light':'dark')">${themeIcon}</button>
    `;
    document.getElementById('btn-logout')?.addEventListener('click', () => supabase.auth.signOut());
  } else if (AppState.mode === 'guest') {
    el.innerHTML = `
      ${homeBtn}
      <button class="btn btn-ghost" onclick="navigate('login')">登入</button>
      <button class="btn-icon" title="切換主題" onclick="applyTheme(AppState.theme==='dark'?'light':'dark')">${themeIcon}</button>
    `;
  } else {
    el.innerHTML = '';
  }

  const hamburger = document.getElementById('btn-hamburger');
  if (hamburger) hamburger.onclick = openOffcanvas;
}

function openOffcanvas() {
  document.getElementById('offcanvas').classList.add('open');
  document.getElementById('offcanvas-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
  loadOffcanvasSessions();
  const closeBtn = document.getElementById('btn-offcanvas-close');
  if (closeBtn) closeBtn.onclick = closeOffcanvas;
  document.getElementById('offcanvas-overlay')?.addEventListener('click', closeOffcanvas, { once: true });
}

function closeOffcanvas() {
  document.getElementById('offcanvas').classList.remove('open');
  document.getElementById('offcanvas-overlay').classList.remove('open');
  document.body.style.overflow = '';
}

async function loadOffcanvasSessions() {
  const listEl = document.getElementById('offcanvas-list');
  listEl.innerHTML = '載入中…';
  try {
    const res = await fetch(sessionRoute(), { headers: apiHeaders() });
    if (!res.ok) throw new Error('failed');
    const sessions = await res.json();
    if (!sessions.length) {
      listEl.innerHTML = '<p style="color:var(--text-secondary);padding:8px 0">還沒有練習記錄</p>';
      return;
    }
    listEl.innerHTML = sessions.map(s => {
      const date = new Date(s.created_at).toLocaleString('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      const badge = s.status === 'in_progress'
        ? `<span class="badge badge-blue">進行中</span>`
        : `<span class="badge badge-green">${s.scores_json?.totalScore ?? '—'}分</span>`;
      return `<div class="offcanvas-item" data-id="${s.id}" data-status="${s.status}">
        <div style="display:flex;align-items:center;justify-content:space-between">
          ${badge}<span style="font-size:0.75rem;color:var(--text-secondary)">${s.difficulty || ''}</span>
        </div>
        <div style="font-size:0.8rem;color:var(--text-secondary);margin-top:4px">${date}</div>
      </div>`;
    }).join('');

    listEl.querySelectorAll('.offcanvas-item').forEach(item => {
      item.addEventListener('click', async () => {
        closeOffcanvas();
        const id = item.dataset.id;
        const status = item.dataset.status;
        if (AppState.currentSession?.id === id) {
          navigate(status === 'completed' ? 'report' : 'practice');
          return;
        }
        const r = await fetch(sessionRoute(`/${id}`), { headers: apiHeaders() });
        if (!r.ok) return;
        const session = await r.json();
        AppState.currentSession = session;
        navigate(status === 'completed' ? 'report' : 'practice');
      });
    });
  } catch (_) {
    listEl.innerHTML = '<p style="color:var(--text-secondary);padding:8px 0">載入失敗</p>';
  }
}

// ── Init ──────────────────────────────────────────
async function init() {
  applyTheme(AppState.theme);

  if (!localStorage.getItem('guestId')) {
    localStorage.setItem('guestId', crypto.randomUUID());
  }
  AppState.guestId = localStorage.getItem('guestId');

  await initSupabase();

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    AppState.mode = 'guest';

    const lastId = localStorage.getItem('lastSessionId');
    if (lastId) {
      const res = await fetch(sessionRoute(`/${lastId}`), { headers: apiHeaders() });
      if (res.ok) {
        const s = await res.json();
        if (s.status === 'in_progress') {
          if (confirm('繼續上次的練習？')) {
            AppState.currentSession = s;
            AppState.view = 'practice';
          }
        }
      }
    }
    render();
  }
  // auth mode 由 onAuthStateChange 觸發 render()
}

init();

// 暴露至全域，讓 HTML inline onclick 可使用
window.navigate = navigate;
window.applyTheme = applyTheme;
window.AppState = AppState;
window.submitDefinition = submitDefinition;

// ── View stubs（後續 Task 填入）────────────────────

// ── Task 15: Home View ────────────────────────────
function renderHome() {
  const issuePreview = AppState.currentSession
    ? `<div class="card" style="margin-bottom:16px">
        <p style="color:var(--text-secondary);font-size:0.85rem">上次練習</p>
        <p style="margin-top:6px">${AppState.currentSession.issue_json?.issueText?.slice(0, 80)}...</p>
        <button class="btn btn-primary" style="margin-top:12px" id="btn-continue">繼續練習</button>
      </div>` : '';

  return `
    <div style="text-align:center;padding:40px 0 24px">
      <h1 style="font-size:1.8rem;font-weight:800;margin-bottom:8px">第一性原理拆解訓練</h1>
      <p style="color:var(--text-secondary)">選擇難度，開始一輪 PM 思維練習</p>
    </div>
    ${issuePreview}
    <div class="difficulty-cards">
      ${['入門','進階','困難'].map(d => `
        <div class="difficulty-card" data-difficulty="${d}">
          <div style="font-size:2rem;margin-bottom:8px">${d==='入門'?'🌱':d==='進階'?'🔥':'⚡'}</div>
          <div style="font-weight:700;font-size:1.1rem">${d}</div>
          <div style="color:var(--text-secondary);font-size:0.8rem;margin-top:6px">
            ${d==='入門'?'單一角色，問題明顯':d==='進階'?'多角色交錯，需多層追問':'表象與本質落差大'}
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function bindHome() {
  document.getElementById('btn-continue')?.addEventListener('click', () => navigate('practice'));
  document.querySelectorAll('.difficulty-card').forEach(card => {
    card.addEventListener('click', async () => {
      const difficulty = card.dataset.difficulty;
      card.style.opacity = '0.6';
      try {
        const res = await fetch(sessionRoute(), {
          method: 'POST',
          headers: apiHeaders(),
          body: JSON.stringify({ difficulty }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        AppState.currentSession = { id: data.sessionId, issue_json: { issueText: data.issueText, source: data.source }, conversation: [], turn_count: 0, current_phase: 'reframe' };
        localStorage.setItem('lastSessionId', data.sessionId);
        navigate('practice');
      } catch (e) {
        alert('出題失敗：' + e.message);
        card.style.opacity = '1';
      }
    });
  });
}

// ── Task 16: Login / Register View ─────────────────
function renderAuth(isLogin) {
  return `
    <div style="max-width:400px;margin:60px auto">
      <div class="card">
        <div style="display:flex;gap:8px;margin-bottom:24px">
          <button class="btn ${isLogin?'btn-primary':'btn-ghost'}" onclick="navigate('login')">登入</button>
          <button class="btn ${!isLogin?'btn-primary':'btn-ghost'}" onclick="navigate('register')">註冊</button>
        </div>
        <form id="auth-form">
          <div style="margin-bottom:12px">
            <label style="font-size:0.85rem;color:var(--text-secondary)">Email</label>
            <input id="email" type="email" required class="chat-input" style="width:100%;margin-top:4px" />
          </div>
          <div style="margin-bottom:20px">
            <label style="font-size:0.85rem;color:var(--text-secondary)">密碼</label>
            <input id="password" type="password" required class="chat-input" style="width:100%;margin-top:4px" />
          </div>
          <p id="auth-error" style="color:var(--danger);font-size:0.85rem;margin-bottom:12px;display:none"></p>
          <button type="submit" class="btn btn-primary" style="width:100%">${isLogin?'登入':'建立帳號'}</button>
        </form>
        <p style="margin-top:16px;text-align:center">
          <a href="#" style="color:var(--accent)" onclick="navigate('home')">← 返回首頁</a>
        </p>
      </div>
    </div>
  `;
}

function renderLogin() { return renderAuth(true); }
function renderRegister() { return renderAuth(false); }

function bindAuthForm(isLogin) {
  document.getElementById('auth-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const errEl = document.getElementById('auth-error');
    errEl.style.display = 'none';

    const { error } = isLogin
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password });

    if (error) {
      errEl.textContent = error.message;
      errEl.style.display = 'block';
    }
    // 成功時 onAuthStateChange 觸發 render()
  });
}

function bindLogin() { bindAuthForm(true); }
function bindRegister() { bindAuthForm(false); }

// ── Task 17: Practice View ────────────────────────
const PHASE_STEPS = [
  { key: 'reframe', label: '重構問題' },
  { key: 'drill',   label: '深度追問' },
  { key: 'submit',  label: '提交定義' },
  { key: 'done',    label: '完成'     },
];

function renderSteps(currentPhase) {
  const phases = ['reframe','drill','submit','done'];
  const idx = phases.indexOf(currentPhase);
  return `<div class="steps">
    ${PHASE_STEPS.map((s, i) => `
      <div class="step ${i < idx ? 'done' : i === idx ? 'active' : ''}">
        <div class="step-dot">${i < idx ? '✓' : i + 1}</div>
        <span>${s.label}</span>
      </div>
    `).join('')}
  </div>`;
}

function renderPractice() {
  const s = AppState.currentSession;
  if (!s) return '<p>沒有進行中的練習</p>';

  const bubbles = s.conversation.map(t => `
    <div class="bubble bubble-user">${escHtml(t.userMessage)}</div>
    <div class="bubble bubble-ai">${formatCoachReply(t.coachReply)}</div>
  `).join('');

  const submitSection = s.current_phase === 'submit' || s.turn_count >= 3 ? `
    <div class="card" style="margin-top:16px">
      <p style="font-weight:600;margin-bottom:8px">提交你的問題定義</p>
      <textarea id="final-def" class="chat-input" rows="3" style="width:100%" placeholder="用一句中性問句描述這個問題的本質…"></textarea>
      <button class="btn btn-primary" style="margin-top:8px" id="btn-submit">提交定義</button>
    </div>
  ` : '';

  return `
    ${renderSteps(s.current_phase)}
    <div class="card" style="margin-bottom:16px">
      <p style="font-size:0.8rem;color:var(--text-secondary)">${s.issue_json?.source || ''}</p>
      <p style="margin-top:6px;font-weight:500">${escHtml(s.issue_json?.issueText || '')}</p>
    </div>
    <div class="chat-area" id="chat-area">${bubbles}</div>
    <div class="chat-input-area">
      <textarea id="chat-input" class="chat-input" rows="2" placeholder="輸入你的問題或觀察…" ${AppState.isStreaming ? 'disabled' : ''}></textarea>
      <button class="btn btn-primary" id="btn-send" ${AppState.isStreaming ? 'disabled' : ''}>送出</button>
    </div>
    ${submitSection}
  `;
}

function bindPractice() {
  document.getElementById('btn-send')?.addEventListener('click', sendChat);
  document.getElementById('chat-input')?.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); }
  });
  document.getElementById('btn-submit')?.addEventListener('click', submitDefinition);
  scrollChatToBottom();
}

function formatCoachReply(coachReply) {
  if (!coachReply) return '';
  return `<strong>【被訪談者】</strong><br>${escHtml(coachReply.interviewee)}<hr><strong>【教練點評】</strong><br>${escHtml(coachReply.coaching)}`;
}

function escHtml(str) {
  return (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>');
}

function scrollChatToBottom() {
  const area = document.getElementById('chat-area');
  if (area) area.scrollTop = area.scrollHeight;
}

async function sendChat() {
  const input = document.getElementById('chat-input');
  const message = input?.value?.trim();
  if (!message || AppState.isStreaming) return;
  input.value = '';

  AppState.isStreaming = true;
  AppState.currentSession.conversation.push({ userMessage: message, coachReply: null });
  render();

  const coachEl = document.querySelector('.chat-area .bubble-ai:last-child') || (() => {
    const el = document.createElement('div');
    el.className = 'bubble bubble-ai typing';
    document.getElementById('chat-area').appendChild(el);
    return el;
  })();
  coachEl.className = 'bubble bubble-ai typing';

  try {
    const res = await fetch(sessionRoute(`/${AppState.currentSession.id}/chat`), {
      method: 'POST',
      headers: apiHeaders(),
      body: JSON.stringify({ message }),
    });

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullText = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6);
        if (data === '[DONE]') break;
        try {
          const { text } = JSON.parse(data);
          fullText += text;
          coachEl.className = 'bubble bubble-ai';
          coachEl.innerHTML = formatCoachReply(parseCoachReply(fullText));
        } catch (_) {}
      }
    }

    const parsed = parseCoachReply(fullText);
    AppState.currentSession.conversation[AppState.currentSession.conversation.length - 1].coachReply = parsed;
    AppState.currentSession.turn_count++;
    if (AppState.currentSession.current_phase === 'reframe') AppState.currentSession.current_phase = 'drill';

  } catch (e) {
    coachEl.textContent = '連線中斷，請重試';
  }

  AppState.isStreaming = false;
  render();
  scrollChatToBottom();
}

function parseCoachReply(fullText) {
  const intervieweeMatch = fullText.match(/【被訪談者】\s*([\s\S]*?)(?=【教練點評】|$)/);
  const coachingMatch = fullText.match(/【教練點評】\s*([\s\S]*?)$/);
  return {
    interviewee: intervieweeMatch?.[1]?.trim() || fullText,
    coaching: coachingMatch?.[1]?.trim() || '',
  };
}

async function submitDefinition() {
  const def = document.getElementById('final-def')?.value?.trim();
  if (!def) return;
  document.getElementById('btn-submit').disabled = true;
  document.getElementById('btn-submit').textContent = '評分中…';
  try {
    const res = await fetch(sessionRoute(`/${AppState.currentSession.id}/submit`), {
      method: 'POST',
      headers: apiHeaders(),
      body: JSON.stringify({ finalDefinition: def }),
    });
    const scores = await res.json();
    if (!res.ok) throw new Error(scores.error);
    AppState.currentSession.scores_json = scores;
    AppState.currentSession.final_definition = def;
    AppState.currentSession.current_phase = 'done';
    navigate('report');
  } catch (e) {
    alert('評分失敗：' + e.message);
    document.getElementById('btn-submit').disabled = false;
    document.getElementById('btn-submit').textContent = '提交定義';
  }
}

// ── Task 18: Report View (雷達圖 + 練習回顧表) ────
const DIM_LABELS = {
  roleClarity: '角色定位',
  taskBreakpoint: '任務卡點',
  workaround: '替代行為',
  lossQuantification: '損失量化',
  definitionQuality: '定義品質',
};

function renderRadar(scores) {
  const dims = Object.keys(DIM_LABELS);
  const size = 220;
  const cx = size / 2, cy = size / 2, r = 80;
  const n = dims.length;
  const toXY = (i, val) => {
    const angle = (Math.PI * 2 * i / n) - Math.PI / 2;
    const rv = (val / 20) * r;
    return [cx + rv * Math.cos(angle), cy + rv * Math.sin(angle)];
  };
  const labelXY = (i) => {
    const angle = (Math.PI * 2 * i / n) - Math.PI / 2;
    return [cx + (r + 24) * Math.cos(angle), cy + (r + 24) * Math.sin(angle)];
  };

  const circles = [0.25, 0.5, 0.75, 1].map(f =>
    `<circle cx="${cx}" cy="${cy}" r="${r*f}" fill="none" stroke="var(--border)" stroke-width="1"/>`
  ).join('');

  const axes = dims.map((_, i) => {
    const [x, y] = toXY(i, 20);
    return `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="var(--border)" stroke-width="1"/>`;
  }).join('');

  const points = dims.map((d, i) => toXY(i, scores[d]?.score || 0).join(',')).join(' ');
  const polygon = `<polygon points="${points}" fill="var(--accent)" fill-opacity="0.25" stroke="var(--accent)" stroke-width="2"/>`;

  const labels = dims.map((d, i) => {
    const [x, y] = labelXY(i);
    return `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="middle" font-size="10" fill="var(--text-secondary)">${DIM_LABELS[d]}</text>`;
  }).join('');

  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${circles}${axes}${polygon}${labels}</svg>`;
}

function renderReport() {
  const s = AppState.currentSession;
  const scores = s?.scores_json;
  if (!scores) return '<p>沒有評分資料</p>';

  const dims = Object.keys(DIM_LABELS);
  const scoreCards = dims.map(d => `
    <div class="score-card">
      <div class="score-card-title">${DIM_LABELS[d]}</div>
      <div class="score-card-score" style="color:${(scores.scores[d]?.score||0)>=14?'var(--success)':'var(--warning)'}">
        ${scores.scores[d]?.score || 0} <span style="font-size:0.9rem;color:var(--text-secondary)">/20</span>
      </div>
      <div class="score-label">✅ ${escHtml(scores.scores[d]?.did || '')}</div>
      <div class="score-label" style="margin-top:4px">❌ ${escHtml(scores.scores[d]?.missed || '')}</div>
      <div class="score-label" style="margin-top:4px;color:var(--accent)">💡 ${escHtml(scores.scores[d]?.tip || '')}</div>
    </div>
  `).join('');

  const turnAnalysis = scores.turnAnalysis || [];
  const reviewRows = s.conversation.map((t, i) => {
    const ideal = turnAnalysis[i]?.idealFocus || '—';
    return `
      <tr>
        <td style="white-space:nowrap;color:var(--text-secondary)">第 ${i+1} 輪</td>
        <td>${escHtml(t.userMessage)}</td>
        <td style="color:var(--accent)">${escHtml(ideal)}</td>
        <td>${escHtml(t.coachReply?.interviewee || '')}</td>
        <td style="color:var(--text-secondary)">${escHtml(t.coachReply?.coaching || '')}</td>
      </tr>
    `;
  }).join('');

  return `
    <div id="report-content">
      <div style="text-align:center;margin-bottom:24px">
        <div style="font-size:3rem;font-weight:900;color:var(--accent)">${scores.totalScore}</div>
        <div style="color:var(--text-secondary)">總分 / 100</div>
      </div>

      <div class="radar-container">${renderRadar(scores.scores)}</div>

      <div class="score-cards">${scoreCards}</div>

      <div class="card" style="margin-top:16px">
        <p style="font-weight:700;margin-bottom:8px">練習亮點</p>
        <p>🏆 ${escHtml(scores.highlights?.bestMove || '')}</p>
        <p style="margin-top:6px">⚠️ ${escHtml(scores.highlights?.mainTrap || '')}</p>
        <p style="margin-top:8px;color:var(--text-secondary);font-style:italic">${escHtml(scores.highlights?.summary || '')}</p>
      </div>

      <div class="card" style="margin-top:16px;overflow-x:auto">
        <p style="font-weight:700;margin-bottom:12px">練習回顧表</p>
        <table class="review-table">
          <thead>
            <tr>
              <th>輪次</th><th>學員提問</th><th>本輪預期拆解重點</th><th>被訪談者回答</th><th>教練點評</th>
            </tr>
          </thead>
          <tbody>${reviewRows}</tbody>
        </table>
      </div>
    </div>

    <div class="export-actions">
      <button class="btn btn-ghost" id="btn-export-pdf">📄 匯出 PDF</button>
      <button class="btn btn-ghost" id="btn-export-png">🖼️ 匯出 PNG</button>
      <button class="btn btn-primary" onclick="navigate('home')">再練一次</button>
    </div>
  `;
}

function bindReport() {
  document.getElementById('btn-export-pdf')?.addEventListener('click', exportPDF);
  document.getElementById('btn-export-png')?.addEventListener('click', exportPNG);
}

function exportPDF() {
  window.print();
}

async function exportPNG() {
  const btn = document.getElementById('btn-export-png');
  btn.disabled = true;
  btn.textContent = '截圖中…';
  try {
    const { default: html2canvas } = await import('https://esm.sh/html2canvas@1.4.1');
    const el = document.getElementById('report-content');
    const canvas = await html2canvas(el, { backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--bg-primary').trim() });
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `pm-drill-report-${Date.now()}.png`;
    a.click();
  } catch (e) {
    alert('截圖失敗，改用 PDF 列印');
    window.print();
  }
  btn.disabled = false;
  btn.textContent = '🖼️ 匯出 PNG';
}

// ── Task 19: History View (登入用戶) ──────────────
function renderHistory() {
  return `
    <div style="margin-bottom:24px;display:flex;justify-content:space-between;align-items:center">
      <h2 style="font-weight:700">練習歷史</h2>
      <button class="btn btn-ghost" onclick="navigate('home')">← 返回</button>
    </div>
    <div id="history-chart" style="margin-bottom:24px">載入中…</div>
    <div id="history-list" class="history-list">載入中…</div>
  `;
}

function bindHistory() {
  loadHistory();
}

async function loadHistory() {
  if (AppState.mode !== 'auth') return;
  try {
    const res = await fetch('/api/sessions', { headers: apiHeaders() });
    const sessions = await res.json();
    renderHistoryChart(sessions);
    renderHistoryList(sessions);
  } catch (e) {
    document.getElementById('history-list').textContent = '載入失敗';
  }
}

function renderHistoryChart(sessions) {
  const completed = sessions.filter(s => s.status === 'completed' && s.scores_json?.totalScore != null)
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    .slice(-10);

  if (completed.length < 2) {
    document.getElementById('history-chart').innerHTML = '<p style="color:var(--text-secondary)">完成至少 2 次練習後顯示進步曲線</p>';
    return;
  }

  const w = 600, h = 160, padL = 40, padB = 30, padT = 10, padR = 20;
  const scores = completed.map(s => s.scores_json.totalScore);
  const minS = Math.min(...scores) - 5;
  const maxS = Math.max(...scores) + 5;
  const toX = i => padL + (i / (completed.length - 1)) * (w - padL - padR);
  const toY = v => padT + (1 - (v - minS) / (maxS - minS)) * (h - padT - padB);

  const points = completed.map((_, i) => `${toX(i)},${toY(scores[i])}`).join(' ');
  const dots = completed.map((_, i) => `
    <circle cx="${toX(i)}" cy="${toY(scores[i])}" r="4" fill="var(--accent)"/>
    <text x="${toX(i)}" y="${toY(scores[i]) - 8}" text-anchor="middle" font-size="10" fill="var(--text-primary)">${scores[i]}</text>
  `).join('');

  document.getElementById('history-chart').innerHTML = `
    <div class="card">
      <p style="font-weight:700;margin-bottom:12px">總分趨勢</p>
      <svg width="100%" viewBox="0 0 ${w} ${h}">
        <polyline points="${points}" fill="none" stroke="var(--accent)" stroke-width="2"/>
        ${dots}
        <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${h - padB}" stroke="var(--border)" stroke-width="1"/>
        <line x1="${padL}" y1="${h - padB}" x2="${w - padR}" y2="${h - padB}" stroke="var(--border)" stroke-width="1"/>
      </svg>
    </div>
  `;
}

function renderHistoryList(sessions) {
  const el = document.getElementById('history-list');
  if (!sessions.length) { el.textContent = '還沒有練習記錄'; return; }

  el.innerHTML = sessions.map(s => `
    <div class="history-item" data-id="${s.id}">
      <div style="display:flex;justify-content:space-between">
        <span>${s.difficulty} · ${s.status === 'completed' ? '已完成' : '進行中'}</span>
        <span style="color:${s.scores_json?.totalScore >= 70 ? 'var(--success)' : 'var(--warning)'}">
          ${s.scores_json?.totalScore != null ? s.scores_json.totalScore + ' 分' : '—'}
        </span>
      </div>
      <div style="color:var(--text-secondary);font-size:0.8rem;margin-top:4px">
        ${new Date(s.created_at).toLocaleString('zh-TW')}
      </div>
    </div>
  `).join('');

  el.querySelectorAll('.history-item').forEach(item => {
    item.addEventListener('click', async () => {
      const res = await fetch(`/api/sessions/${item.dataset.id}`, { headers: apiHeaders() });
      const session = await res.json();
      AppState.currentSession = session;
      navigate(session.status === 'completed' ? 'report' : 'practice');
    });
  });
}
