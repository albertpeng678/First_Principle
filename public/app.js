// Path 2 · Plan A · Foundation
// Source of truth: docs/superpowers/specs/2026-05-02-frontend-rewrite-master-spec.md §2.1 / §2.14
// Plans B-E append render functions; this file MUST stay parseable when Plan A merges alone.

(function () {
  'use strict';

  // ── AppState (per spec §2.1 + §2.14) ──────────────────────────────────────
  const AppState = {
    // global
    view: 'circles',                    // 'circles' | 'nsm' | 'auth'
    accessToken: null,                  // supabase JWT
    guestId: null,                      // UUIDv4
    isOnline: navigator.onLine,
    sessionExpired: false,
    onboardingComplete: !!localStorage.getItem('onboardingComplete'),

    // CIRCLES (Plans B/D fill render)
    circlesPhase: 1,
    circlesMode: null,                  // 'drill' | 'simulation'
    circlesDrillStep: null,             // 'C1' | 'I' | 'R' | 'C2' | 'L' | 'E' | 'S'
    circlesSimStep: 0,
    circlesSelectedQuestion: null,
    circlesSession: null,
    circlesFrameworkDraft: {},
    circlesConversation: [],
    circlesGateResult: null,
    circlesScoreResult: null,
    circlesStepScores: {},
    circlesEvaluating: false,
    circlesEvaluateError: null,
    circlesFinalReport: null,
    circlesStale: false,
    circlesLocked: false,
    circlesChipExpanded: false,
    circlesDisplayedQuestions: [],

    // NSM (Plan C fills)
    nsmStep: 1,
    nsmSubTab: 'nsm-step2',
    nsmReportTab: 'overview',
    nsmSession: null,
    nsmSelectedQuestion: null,
    nsmContext: null,
    nsmContextLoading: false,
    nsmGateResult: null,
    nsmActiveCompareNode: null,
    nsmDisplayedQuestions: [],

    // chat
    streamingActive: false,
  };
  window.AppState = AppState;

  // ── Persistence (per spec §2.1 — localStorage keys) ───────────────────────
  const PERSISTED_KEYS = ['view', 'accessToken', 'guestId', 'onboardingComplete', 'circlesMode', 'circlesPhase', 'circlesDrillStep', 'circlesSelectedQuestion'];
  function persist() {
    try {
      const snapshot = {};
      for (const k of PERSISTED_KEYS) snapshot[k] = AppState[k];
      localStorage.setItem('pmDrillState', JSON.stringify(snapshot));
    } catch (_) {}
  }
  function restore() {
    try {
      const raw = localStorage.getItem('pmDrillState');
      if (!raw) return;
      const snap = JSON.parse(raw);
      for (const k of PERSISTED_KEYS) {
        if (snap[k] !== undefined) AppState[k] = snap[k];
      }
    } catch (_) {}
  }
  window.persist = persist;
  window.restore = restore;

  // ── Boot (Plan A skeleton; Plans B/C/D/E hook into render dispatch) ───────
  document.addEventListener('DOMContentLoaded', function () {
    restore();
    AppState.guestId = ensureGuestId();
    bindGlobalListeners();
    render();
  });

  function ensureGuestId() {
    let id = localStorage.getItem('guestId');
    if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id)) {
      id = crypto.randomUUID();
      localStorage.setItem('guestId', id);
    }
    return id;
  }

  // ── Global listeners (per spec §1.5.1 multi-tab + 401 + online/offline) ──
  function bindGlobalListeners() {
    window.addEventListener('online',  function () { AppState.isOnline = true;  render(); });
    window.addEventListener('offline', function () { AppState.isOnline = false; render(); });
    // 401 handler — fetch wrapper（Plans B/C 各自 fetch 必經此 wrapper）
    window.apiFetch = async function (input, init) {
      const headers = Object.assign({}, (init && init.headers) || {});
      if (AppState.accessToken) headers['Authorization'] = 'Bearer ' + AppState.accessToken;
      else if (AppState.guestId) headers['X-Guest-ID']   = AppState.guestId;
      headers['Content-Type'] = headers['Content-Type'] || 'application/json';
      const res = await fetch(input, Object.assign({}, init, { headers }));
      if (res.status === 401) {
        AppState.sessionExpired = true;
        AppState.accessToken = null;
        try { localStorage.setItem('pmDrillReturnPath', JSON.stringify({ view: AppState.view, ts: Date.now() })); } catch (_) {}
        render();
        const err = new Error('SESSION_EXPIRED');
        err.code = 'SESSION_EXPIRED';
        throw err;
      }
      return res;
    };
  }

  // ── Render dispatch (Plans B/C/D fill view stubs) ─────────────────────────
  function render() {
    persist();
    const app = document.getElementById('app') || document.body;
    const navbar = renderNavbar();
    const banners = renderGlobalBanners();
    const view = renderView();
    app.innerHTML = navbar + banners + view;
    bindNavbar();
  }
  window.render = render;

  function renderView() {
    const v = AppState.view;
    if (v === 'circles') return renderCirclesStub();
    if (v === 'nsm')     return renderNSMStub();
    if (v === 'auth')    return renderAuthStub();
    return renderCirclesStub();
  }

  function renderCirclesStub() {
    return '<div data-view="circles" style="padding:24px;color:var(--c-ink-3);text-align:center">CIRCLES view — 待 Plan B 實作</div>';
  }
  function renderNSMStub() {
    return '<div data-view="nsm" style="padding:24px;color:var(--c-ink-3);text-align:center">NSM view — 待 Plan C 實作</div>';
  }
  function renderAuthStub() {
    return '<div data-view="auth" style="padding:24px;color:var(--c-ink-3);text-align:center">Auth view — 待 Plan B 收尾實作</div>';
  }

  // ── renderNavbar (per spec §2.10 + mockup 03+) ────────────────────────────
  function renderNavbar() {
    const tabs = (AppState.view === 'circles' || AppState.view === 'nsm') ?
      `<div class="navbar__tabs">
         <button class="navbar__tab ${AppState.view==='circles'?'is-active':''}" data-nav="circles">CIRCLES</button>
         <button class="navbar__tab ${AppState.view==='nsm'?'is-active':''}" data-nav="nsm">北極星指標</button>
       </div>` : '';

    const right = AppState.accessToken ?
      `<span class="navbar__email">${escHtml(AppState.userEmail || '')}</span>
       <button class="navbar__icon-btn" data-nav="home" aria-label="回首頁"><i class="ph ph-house"></i></button>` :
      `<button class="navbar__icon-btn" data-nav="auth" aria-label="登入"><i class="ph ph-sign-in"></i></button>`;

    return `<header class="navbar">
      <button class="navbar__icon-btn" data-nav="offcanvas" aria-label="練習記錄"><i class="ph ph-list"></i></button>
      <div class="navbar__brand" data-nav="home">
        <span class="navbar__brand-icon"><i class="ph ph-circles-three"></i></span>
        <span class="navbar__brand-name">PM Drill</span>
      </div>
      ${tabs}
      <div class="navbar__actions">${right}</div>
    </header>`;
  }

  function renderGlobalBanners() {
    const banners = [];
    if (!AppState.isOnline) {
      banners.push(`<div class="banner banner--offline">
        <span class="banner__icon"><i class="ph ph-wifi-slash"></i></span>
        <div class="banner__main"><div class="banner__title">網路離線</div>
          <div class="banner__sub">草稿已存本機，連線恢復後自動同步</div></div>
      </div>`);
    }
    if (AppState.sessionExpired) {
      banners.push(`<div class="banner banner--session">
        <span class="banner__icon"><i class="ph ph-info"></i></span>
        <div class="banner__main"><div class="banner__title">登入逾時</div>
          <div class="banner__sub">為了保護你的資料，已登出。</div></div>
        <button class="banner__action" data-nav="auth">重新登入</button>
      </div>`);
    }
    return banners.join('');
  }

  function bindNavbar() {
    document.querySelectorAll('[data-nav]').forEach(function (el) {
      el.addEventListener('click', function () {
        const target = el.dataset.nav;
        if (target === 'home')      { AppState.view = 'circles'; render(); }
        else if (target === 'circles') { AppState.view = 'circles'; render(); }
        else if (target === 'nsm')     { AppState.view = 'nsm';     render(); }
        else if (target === 'auth')    { AppState.view = 'auth';    render(); }
        else if (target === 'offcanvas') { /* Plan D 實作 */ }
      });
    });
  }

  // ── utils ─────────────────────────────────────────────────────────────────
  function escHtml(s) {
    if (s == null) return '';
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c];
    });
  }
  window.escHtml = escHtml;
})();
