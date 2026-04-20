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
  theme: localStorage.getItem('theme') || 'dark',
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
  render();
}

function renderNavbar() {
  const el = document.getElementById('navbar-actions');
  const themeIcon = AppState.theme === 'dark' ? '☀️' : '🌙';
  if (AppState.mode === 'auth') {
    el.innerHTML = `
      <span style="color:var(--text-secondary);font-size:0.85rem">${AppState.user?.email}</span>
      <button class="btn btn-ghost" onclick="navigate('history')">歷史記錄</button>
      <button class="btn btn-ghost" id="btn-logout">登出</button>
      <button class="btn-icon" onclick="applyTheme(AppState.theme==='dark'?'light':'dark')">${themeIcon}</button>
    `;
    document.getElementById('btn-logout')?.addEventListener('click', () => supabase.auth.signOut());
  } else if (AppState.mode === 'guest') {
    el.innerHTML = `
      <button class="btn btn-ghost" onclick="navigate('login')">登入</button>
      <button class="btn-icon" onclick="applyTheme(AppState.theme==='dark'?'light':'dark')">${themeIcon}</button>
    `;
  } else {
    el.innerHTML = '';
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

// ── Task 18 & 19: Stub Views ──────────────────────
function renderReport() { return '<p>Report View — Task 18</p>'; }
function bindReport() {}
function renderHistory() { return '<p>History View — Task 19</p>'; }
function bindHistory() {}
