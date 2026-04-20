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
function renderHome() { return '<p>Home View — Task 15</p>'; }
function bindHome() {}
function renderLogin() { return '<p>Login View — Task 16</p>'; }
function bindLogin() {}
function renderRegister() { return '<p>Register View — Task 16</p>'; }
function bindRegister() {}
function renderPractice() { return '<p>Practice View — Task 17</p>'; }
function bindPractice() {}
function renderReport() { return '<p>Report View — Task 18</p>'; }
function bindReport() {}
function renderHistory() { return '<p>History View — Task 19</p>'; }
function bindHistory() {}
