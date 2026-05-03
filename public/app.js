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

    // Plan B additions
    circlesTypeFilter: 'design',        // 'design' | 'improve' | 'strategy'
    circlesSearchText: '',
    circlesQaOpen: true,                // qa-row default open per mockup
    circlesExpandedQid: null,           // single qcard expanded (SB2 — mockup 01 line 1801)
    circlesRecentSessions: null,        // null = not loaded; [] = empty; [...] = items (SB2)

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
    nsmSearchText: '',
    nsmTypeFilter: 'all',

    // chat
    streamingActive: false,

    // Offcanvas / History (Plan D)
    offcanvasOpen: false,
    historyList: null,       // null = not loaded yet; [] = empty; [...] = items
    historyLoading: false,
    historyError: null,
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
    app.innerHTML = navbar + banners + renderOffcanvas() + view;
    if (AppState.offcanvasOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    bindAll();
    if (AppState.view === 'nsm' && AppState.nsmStep === 1) bindNSMStep1();
  }
  window.render = render;

  function renderView() {
    const v = AppState.view;
    if (v === 'circles') {
      if (AppState.circlesPhase === 1 && !AppState.circlesSession && !AppState.circlesSelectedQuestion) {
        return renderCirclesHome();
      }
      return renderCirclesStub();
    }
    if (v === 'nsm') {
      if (AppState.nsmStep === 1) return renderNSMStep1();
      return renderNSMStub();
    }
    if (v === 'auth')    return renderAuthStub();
    return renderCirclesHome();
  }

  function renderCirclesStub() {
    return '<div data-view="circles" style="padding:24px;color:var(--c-ink-3);text-align:center">CIRCLES view — 待 Plan B 實作</div>';
  }
  function renderNSMStub() {
    return '<div data-view="nsm" style="padding:24px;color:var(--c-ink-3);text-align:center">NSM view — Plan C SB2+ 實作中</div>';
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
        else if (target === 'offcanvas') {
          AppState.offcanvasOpen = true;
          AppState.historyList = null;
          render();
          loadHistory();
        }
      });
    });
  }

  // ── CIRCLES Home (Plan B SB1 — mockup 01) ────────────────────────────────
  var CIRCLES_QUESTIONS = window.CIRCLES_QUESTIONS || [];

  // Per spec §3.7 + memory feedback_5_random_questions:
  // AppState.circlesDisplayedQuestions persists; reshuffle = re-pick in-place, no nav.
  function circlesFilterQuestions() {
    var pool = CIRCLES_QUESTIONS.slice();
    var filter = AppState.circlesTypeFilter || 'design';
    pool = pool.filter(function (q) { return q.question_type === filter; });
    if (AppState.circlesSearchText) {
      var s = AppState.circlesSearchText.toLowerCase();
      pool = pool.filter(function (q) {
        return ((q.company || '').toLowerCase().indexOf(s) >= 0)
            || ((q.product || '').toLowerCase().indexOf(s) >= 0)
            || ((q.problem_statement || '').toLowerCase().indexOf(s) >= 0);
      });
    }
    return pool;
  }

  function circlesPickDisplayed(excludeCurrent) {
    var pool = circlesFilterQuestions();
    if (excludeCurrent && AppState.circlesDisplayedQuestions && AppState.circlesDisplayedQuestions.length) {
      var curIds = AppState.circlesDisplayedQuestions.map(function (q) { return q.id; });
      var excluded = pool.filter(function (q) { return curIds.indexOf(q.id) < 0; });
      if (excluded.length >= 5) pool = excluded;
    }
    // Fisher-Yates shuffle
    for (var i = pool.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = pool[i]; pool[i] = pool[j]; pool[j] = t;
    }
    AppState.circlesDisplayedQuestions = pool.slice(0, 5);
  }

  function circlesEnsureDisplayed() {
    if (!AppState.circlesDisplayedQuestions || !AppState.circlesDisplayedQuestions.length) {
      circlesPickDisplayed(false);
    }
  }

  function circlesCountByType(type) {
    return CIRCLES_QUESTIONS.filter(function (q) { return q.question_type === type; }).length;
  }

  async function loadHistoryForRail() {
    // Fetch recent CIRCLES + NSM sessions, merge + sort, keep top 5
    try {
      var circlesPath = AppState.accessToken ? '/api/circles-sessions' : '/api/guest-circles-sessions';
      var nsmPath     = AppState.accessToken ? '/api/nsm-sessions'     : '/api/guest/nsm-sessions';
      var results = await Promise.all([
        window.apiFetch(circlesPath),
        window.apiFetch(nsmPath),
      ]);
      if (!results[0].ok || !results[1].ok) throw new Error('history_load_error');
      var circles = await results[0].json();
      var nsm     = await results[1].json();
      var merged = [].concat(circles || [], (nsm || []).map(function (n) { n._isNsm = true; return n; }));
      merged.sort(function (a, b) {
        return new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at);
      });
      AppState.circlesRecentSessions = merged.slice(0, 5);
      render();
    } catch (e) {
      if (e.code === 'SESSION_EXPIRED') return;
      AppState.circlesRecentSessions = [];
      render();
    }
  }

  function renderRecentItem(item) {
    // mockup 01 line 1067-1090
    var isNsm = !!(item._isNsm || (!item.mode && !item.drill_step && item.scores_json));
    var modeTag = isNsm
      ? '<span class="mode-tag mode-tag--sim"><i class="ph ph-list-checks"></i>NSM</span>'
      : (item.mode === 'drill' || item.drill_step
          ? '<span class="mode-tag mode-tag--drill"><i class="ph ph-target"></i>個別 ' + escHtml(item.drill_step || '') + '</span>'
          : '<span class="mode-tag mode-tag--sim"><i class="ph ph-list-checks"></i>完整</span>');
    var ts = new Date(item.updated_at || item.created_at).getTime();
    var diff = Date.now() - ts;
    var time = diff < 3600000 ? Math.floor(diff / 60000) + ' 分鐘前'
             : diff < 86400000 ? Math.floor(diff / 3600000) + ' 小時前'
             : diff < 7 * 86400000 ? Math.floor(diff / 86400000) + ' 天前'
             : new Date(ts).toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' });
    var q = item.currentQuestion || item.question_json || {};
    var titleStr = (q.company || '') + (q.product ? ' · ' + q.product : '') || '練習題目';
    var phaseStr = isNsm
      ? ('NSM · ' + (item.status === 'completed' ? '已完成' : '進行中'))
      : ('Phase ' + (item.current_phase || 1) + ' · ' + (item.status === 'completed' ? '已完成' : '進行中'));
    return '<div class="recent-item" data-circles="recent-item" data-id="' + escHtml(item.id) + '" data-isnsm="' + (isNsm ? '1' : '0') + '">'
      + '<div class="recent-item__head">' + modeTag + '<span class="recent-item__time">' + escHtml(time) + '</span></div>'
      + '<div class="recent-item__title">' + escHtml(titleStr) + '</div>'
      + '<div class="recent-item__phase">' + escHtml(phaseStr) + '</div>'
      + '</div>';
  }

  function renderCirclesQCard(q, idx, mode) {
    var isSim = (mode === 'simulation');
    var tagClass = isSim ? 'mode-tag--sim' : 'mode-tag--drill';
    var tagIcon  = isSim ? 'ph-list-checks' : 'ph-target';
    var tagLabel = isSim ? '完整' : '步驟練';
    var num = String(idx + 1).padStart(2, '0');
    var diff = q.difficulty === 'high' ? '高' : q.difficulty === 'low' ? '低' : '中';
    var title = escHtml(q.company) + (q.product ? ' · ' + escHtml(q.product) : '');
    var meta = '<div class="qcard__meta">'
      + '<span class="mode-tag ' + tagClass + '"><i class="ph ' + tagIcon + '"></i>' + tagLabel + '</span>'
      + '<span class="qcard__meta-sep">·</span>'
      + escHtml(q.company)
      + (q.product ? '<span class="qcard__meta-sep">·</span>' + escHtml(q.product) : '')
      + '<span class="qcard__meta-sep">·</span><span style="color:var(--c-ink-4);">難度 ' + diff + '</span>'
      + '</div>';

    var isExpanded = AppState.circlesExpandedQid === q.id;
    var expandHtml = '';
    if (isExpanded) {
      // mockup 01 line 1801-1836
      var an = q.analysis || {};
      expandHtml = '<div class="qcard__expand">'
        + '<h4 class="qcard__section-label">完整題目</h4>'
        + '<p class="qcard__full-statement">' + escHtml(q.problem_statement || '') + '</p>'
        + '<h4 class="qcard__section-label">深入分析</h4>'
        + '<div class="qcard-analysis">'
        + '<div class="ana-block"><div class="ana-block__head"><i class="ph ph-buildings"></i>商業背景</div>'
        + '<div class="ana-block__body">' + escHtml(an.business || '') + '</div></div>'
        + '<div class="ana-block"><div class="ana-block__head"><i class="ph ph-users"></i>用戶輪廓</div>'
        + '<div class="ana-block__body">' + escHtml(an.users || '') + '</div></div>'
        + '<div class="ana-block ana-block--trap"><div class="ana-block__head"><i class="ph ph-warning"></i>常見誤區</div>'
        + '<div class="ana-block__body">' + escHtml(an.traps || '') + '</div></div>'
        + '<div class="ana-block"><div class="ana-block__head"><i class="ph ph-lightbulb"></i>破題切入</div>'
        + '<div class="ana-block__body">' + escHtml(an.insight || '') + '</div></div>'
        + '</div>'
        + '<div class="qcard__action-row">'
        + '<button class="qcard__btn qcard__btn--ghost" data-circles="qcard-cancel">取消</button>'
        + '<button class="qcard__btn qcard__btn--primary" data-circles="qcard-confirm" data-qid="' + escHtml(q.id) + '">確認，開始練習</button>'
        + '</div></div>';
    }

    return '<div class="qcard' + (isExpanded ? ' is-expanded' : '') + '" data-circles="qcard" data-qid="' + escHtml(q.id) + '">'
      + '<div class="qcard__head"><span class="qcard__num">' + num + '</span><h3 class="qcard__title">' + title + '</h3></div>'
      + meta
      + '<p class="qcard__body">' + escHtml(q.problem_statement) + '</p>'
      + expandHtml
      + '</div>';
  }

  function renderDrillRail() {
    // mockup 01 line 1293-1306 — desktop 200px aside
    var step = AppState.circlesDrillStep || 'C1';
    var pills = [
      { key: 'C1', letter: 'C', label: '澄清情境' },
      { key: 'I',  letter: 'I', label: '定義用戶' },
      { key: 'R',  letter: 'R', label: '發掘需求' },
    ];
    var pillsHtml = pills.map(function (p) {
      return '<button class="drill-pill' + (p.key === step ? ' is-active' : '') + '" data-circles="drill-pill" data-step="' + p.key + '">'
        + '<span class="step-letter">' + p.letter + '</span>' + escHtml(p.label)
        + '</button>';
    }).join('');
    return '<aside class="drill-rail">'
      + '<div class="drill-rail__title">練習步驟</div>'
      + '<div class="drill-rail__list">' + pillsHtml + '</div>'
      + '<div class="drill-rail__lock"><i class="ph ph-lock-simple"></i>'
      + '<span>C2、L、E、S 需在<strong style="color:var(--c-ink-2);">完整模擬</strong>中練習 — 因為它們依賴前步輸出</span>'
      + '</div></aside>';
  }

  function renderDrillPillRow() {
    // mockup 01 line 1147-1158 / 1224-1230 — mobile/tablet horizontal pills
    var step = AppState.circlesDrillStep || 'C1';
    var pills = [
      { key: 'C1', letter: 'C', label: '澄清' },
      { key: 'I',  letter: 'I', label: '用戶' },
      { key: 'R',  letter: 'R', label: '需求' },
    ];
    var pillsHtml = pills.map(function (p) {
      return '<button class="drill-pill' + (p.key === step ? ' is-active' : '') + '" style="width:auto; padding:var(--s-2) var(--s-3);" data-circles="drill-pill" data-step="' + p.key + '">'
        + '<span class="step-letter">' + p.letter + '</span>' + escHtml(p.label)
        + '</button>';
    }).join('');
    return '<div style="margin-bottom:var(--s-4);">'
      + '<div style="font-size:var(--t-cap); letter-spacing:0.08em; text-transform:uppercase; color:var(--c-ink-3); margin-bottom:var(--s-2);">練習步驟</div>'
      + '<div class="type-tabs">' + pillsHtml + '</div>'
      + '<div class="drill-rail__lock" style="margin-top:var(--s-2);"><i class="ph ph-lock-simple"></i>'
      + '<span>C2 / L / E / S 需在完整模擬中練習</span>'
      + '</div></div>';
  }

  function renderCirclesHome() {
    // Default circlesMode to 'simulation' if not set (per scope note)
    if (!AppState.circlesMode) AppState.circlesMode = 'simulation';
    circlesEnsureDisplayed();

    var mode = AppState.circlesMode;
    var filter = AppState.circlesTypeFilter || 'design';
    var qaOpen = AppState.circlesQaOpen !== false; // default open

    // ── stats-strip (mockup line 808-815) ──
    var statsHtml = '<div class="stats-strip">'
      + '<i class="ph ph-chart-bar stats-strip__icon"></i>'
      + '<span class="stats-strip__item"><span class="stats-strip__num" data-stat="completed">0</span>已完成</span>'
      + '<span class="stats-strip__sep">·</span>'
      + '<span class="stats-strip__item"><span class="stats-strip__num" data-stat="active">0</span>進行中</span>'
      + '<span class="stats-strip__sep">·</span>'
      + '<span class="stats-strip__item"><span class="stats-strip__num" data-stat="weekly">0</span>本週</span>'
      + '<span class="stats-strip__hint" data-stat="hint"></span>'
      + '</div>';

    // ── qa-row accordion (mockup line 817-826) ──
    var qaRowHtml = '<div class="qa-row' + (qaOpen ? ' is-open' : '') + '">'
      + '<div class="qa-row__head">'
      + '<span class="qa-row__title">什麼是 CIRCLES 實戰訓練？</span>'
      + '<i class="ph ph-caret-right qa-row__caret"></i>'
      + '</div>'
      + '<div class="qa-row__body">'
      + '<p><strong>CIRCLES</strong>（七步框架）：釐清題目 → 鎖定用戶 → 列舉需求 → 排序聚焦 → 提出方案 → 取捨評估 → 總結結論。每一步都有 AI 即時點評。</p>'
      + '<p><strong>完整模擬</strong> 25-35 分鐘走全 7 步；<strong>步驟加練</strong> 5-10 分鐘專注單練弱點。</p>'
      + '</div>'
      + '</div>';

    // ── mode-selector (mockup line 830-839 / 1019-1024 desktop long) ──
    var modeSelectorHtml = '<div class="mode-selector">'
      + '<button class="mode-card' + (mode === 'simulation' ? ' is-active' : '') + '" data-circles="mode" data-mode="simulation" data-circles-mode="simulation">'
      + '<div class="mode-card__head"><i class="ph ph-list-checks"></i><span class="mode-card__title">完整模擬</span></div>'
      + '<div class="mode-card__body mode-card__body--mobile">7 步循序練習</div>'
      + '<div class="mode-card__body mode-card__body--desktop">7 步循序（C → I → R → C → L → E → S）。可隨時上一步 / 下一步調整。最完整的訓練。</div>'
      + '</button>'
      + '<button class="mode-card' + (mode === 'drill' ? ' is-active' : '') + '" data-circles="mode" data-mode="drill" data-circles-mode="drill">'
      + '<div class="mode-card__head"><i class="ph ph-target"></i><span class="mode-card__title">步驟加練</span></div>'
      + '<div class="mode-card__body mode-card__body--mobile">單練 C / I / R</div>'
      + '<div class="mode-card__body mode-card__body--desktop">單練 C / I / R 三步任一。專注練好其中一步。該步結束即整 session 完成。</div>'
      + '</button>'
      + '</div>';

    // ── search-wrap (mockup line 841-844) ──
    var searchHtml = '<div class="search-wrap">'
      + '<i class="ph ph-magnifying-glass search-wrap__icon"></i>'
      + '<input type="search" placeholder="搜尋題目（公司 / 產品 / 主題）" value="' + escHtml(AppState.circlesSearchText || '') + '">'
      + '</div>';

    // ── type-tabs (mockup line 846-850) — counts from CIRCLES_QUESTIONS ──
    var dCount = circlesCountByType('design');
    var iCount = circlesCountByType('improve');
    var sCount = circlesCountByType('strategy');
    var typeTabsHtml = '<div class="type-tabs">'
      + '<button class="type-tab' + (filter === 'design' ? ' is-active' : '') + '" data-circles-type="design">產品設計 ×' + dCount + '</button>'
      + '<button class="type-tab' + (filter === 'improve' ? ' is-active' : '') + '" data-circles-type="improve">產品改進 ×' + iCount + '</button>'
      + '<button class="type-tab' + (filter === 'strategy' ? ' is-active' : '') + '" data-circles-type="strategy">產品策略 ×' + sCount + '</button>'
      + '</div>';

    // ── q-list (mockup line 852-868) ──
    var qs = AppState.circlesDisplayedQuestions;
    var qListInner;
    if (!qs || qs.length === 0) {
      qListInner = '<div class="empty-wrap"><div class="empty-wrap__title">找不到符合條件的題目</div>'
        + '<div class="empty-wrap__body">請調整搜尋或切換題型。</div></div>';
    } else {
      qListInner = qs.map(function (q, i) { return renderCirclesQCard(q, i, mode); }).join('');
    }
    var qListHtml = '<div class="q-list">' + qListInner + '</div>';

    // ── reshuffle (mockup line 870) ──
    var reshuffleHtml = '<button class="reshuffle" data-circles="reshuffle"><i class="ph ph-shuffle"></i>隨機抽 5 題（不含目前的題）</button>';

    // ── home wrapper center content ──
    // drill mode → mobile/tablet: prepend drill-pill-row above mode-selector
    var isDrill = mode === 'drill';
    var centerHtml = (isDrill ? renderDrillPillRow() : '')
      + modeSelectorHtml + searchHtml + typeTabsHtml + qListHtml + reshuffleHtml;

    // ── recent-rail from AppState.circlesRecentSessions (mockup 01 line 1061-1092) ──
    // Kick async fetch if not yet loaded
    if (AppState.circlesRecentSessions === null) {
      setTimeout(loadHistoryForRail, 0);
    }
    var recentItemsHtml;
    if (AppState.circlesRecentSessions === null) {
      recentItemsHtml = '<div class="recent-rail__placeholder" style="font-size:var(--t-cap);color:var(--c-ink-3);">載入中…</div>';
    } else if (AppState.circlesRecentSessions.length === 0) {
      recentItemsHtml = '<div class="recent-rail__placeholder" style="font-size:var(--t-cap);color:var(--c-ink-3);">尚無近期練習</div>';
    } else {
      recentItemsHtml = AppState.circlesRecentSessions.map(renderRecentItem).join('');
    }
    var recentRailHtml = '<aside class="recent-rail">'
      + '<div class="recent-rail__title"><span>最近練習</span>'
      + '<a href="#" class="recent-rail__see-all" data-circles="see-all">看全部 →</a></div>'
      + '<div class="recent-rail__list">' + recentItemsHtml + '</div></aside>';

    // ── home wrapper with desktop modifier ──
    // drill mode  → 3-col grid (drill-rail 200px / center 1fr / recent-rail 220px)
    // sim mode    → 2-col grid (center 1fr / recent-rail 220px)
    var homeClass = 'home home--desktop' + (isDrill ? '' : ' home--desktop-no-drill');
    var homeHtml = '<div class="' + homeClass + '">'
      + (isDrill ? renderDrillRail() : '')
      + '<div>' + centerHtml + '</div>'
      + recentRailHtml
      + '</div>';

    // ── nsm-promo (mockup line 872-878) ──
    var nsmPromoHtml = '<div class="nsm-promo">'
      + '<div class="nsm-promo__main">'
      + '<div class="nsm-promo__title">S 步驟含北極星指標練習</div>'
      + '<div class="nsm-promo__sub">想做最完整的 NSM 定義訓練？單獨進入北極星指標訓練器拆解 4 個維度的輸入指標。</div>'
      + '</div>'
      + '<a href="#" class="nsm-promo__cta" data-circles="nsm-promo">前往 NSM<i class="ph ph-arrow-right"></i></a>'
      + '</div>';

    return '<div data-view="circles">'
      + statsHtml
      + qaRowHtml
      + homeHtml
      + nsmPromoHtml
      + '</div>';
  }

  // Async stats fetch — called after render to populate stats-strip.
  // Uses AbortController with 5s timeout so it never hangs the page / tests.
  async function loadCirclesStats() {
    try {
      var controller = new AbortController();
      var timer = setTimeout(function () { controller.abort(); }, 5000);
      var path = '/api/circles-stats';
      var headers = {};
      if (AppState.accessToken) headers['Authorization'] = 'Bearer ' + AppState.accessToken;
      else if (AppState.guestId) headers['X-Guest-ID'] = AppState.guestId;
      headers['Content-Type'] = 'application/json';
      var res = await fetch(path, { headers: headers, signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) return;
      var data = await res.json();
      var numEls = document.querySelectorAll('[data-stat]');
      numEls.forEach(function (el) {
        var stat = el.dataset.stat;
        if (stat === 'completed' && data.completed != null) el.textContent = data.completed;
        if (stat === 'active'    && data.active != null)    el.textContent = data.active;
        if (stat === 'weekly'    && data.weeklyCompleted != null) el.textContent = data.weeklyCompleted;
        if (stat === 'hint'      && data.completed != null) el.textContent = '已完成 ' + data.completed + ' / 100 題';
      });
    } catch (_) { /* stats are non-critical — abort / network errors silently swallowed */ }
  }

  var _circlesSearchDebounce = null;

  function bindCirclesHome() {
    // mode-card clicks
    document.querySelectorAll('[data-circles-mode]').forEach(function (el) {
      el.addEventListener('click', function () {
        AppState.circlesMode = el.dataset.circlesMode;
        render();
      });
    });

    // qa-row toggle
    var qaHead = document.querySelector('.qa-row__head');
    if (qaHead) {
      qaHead.addEventListener('click', function () {
        AppState.circlesQaOpen = !AppState.circlesQaOpen;
        var row = document.querySelector('.qa-row');
        if (row) row.classList.toggle('is-open', AppState.circlesQaOpen);
      });
    }

    // type-tab clicks — switch type + re-pick 5
    document.querySelectorAll('[data-circles-type]').forEach(function (el) {
      el.addEventListener('click', function () {
        AppState.circlesTypeFilter = el.dataset.circlesType;
        AppState.circlesSearchText = '';
        circlesPickDisplayed(false);
        render();
      });
    });

    // reshuffle button
    var reshuffleBtn = document.querySelector('[data-circles="reshuffle"]');
    if (reshuffleBtn) {
      reshuffleBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        circlesPickDisplayed(true);
        render();
      });
    }

    // drill-pill click → set circlesDrillStep + re-render
    document.querySelectorAll('[data-circles="drill-pill"]').forEach(function (el) {
      el.addEventListener('click', function () {
        AppState.circlesDrillStep = el.dataset.step;
        render();
      });
    });

    // qcard click → toggle expanded (mockup 01 line 1801-1836)
    document.querySelectorAll('[data-circles="qcard"]').forEach(function (el) {
      el.addEventListener('click', function (e) {
        // ignore if click landed on a button inside the expand block
        if (e.target.closest('[data-circles="qcard-cancel"]')) return;
        if (e.target.closest('[data-circles="qcard-confirm"]')) return;
        var qid = el.dataset.qid;
        AppState.circlesExpandedQid = (AppState.circlesExpandedQid === qid) ? null : qid;
        render();
      });
    });
    // cancel — collapse
    document.querySelectorAll('[data-circles="qcard-cancel"]').forEach(function (el) {
      el.addEventListener('click', function (e) {
        e.stopPropagation();
        AppState.circlesExpandedQid = null;
        render();
      });
    });
    // confirm — enter Phase 1 with selected question
    document.querySelectorAll('[data-circles="qcard-confirm"]').forEach(function (el) {
      el.addEventListener('click', function (e) {
        e.stopPropagation();
        var qid = el.dataset.qid;
        var q = (window.CIRCLES_QUESTIONS || []).find(function (x) { return x.id === qid; });
        if (!q) return;
        AppState.circlesSelectedQuestion = q;
        AppState.circlesPhase = 1;
        AppState.circlesExpandedQid = null;
        render();
      });
    });

    // recent-item click → resume session (mockup 01 line 1061-1092)
    document.querySelectorAll('[data-circles="recent-item"]').forEach(function (el) {
      el.addEventListener('click', function () {
        var id = el.dataset.id;
        var isNsm = el.dataset.isnsm === '1';
        var list = AppState.circlesRecentSessions || [];
        var item = list.find(function (i) { return i.id === id; });
        if (!item) return;
        if (isNsm) {
          AppState.view = 'nsm';
          AppState.nsmStep = 4;
          AppState.nsmSession = item;
        } else {
          AppState.view = 'circles';
          AppState.circlesPhase = item.current_phase || 1;
          AppState.circlesSession = item;
          AppState.circlesSelectedQuestion = item.currentQuestion || item.question_json || null;
          AppState.circlesMode = item.mode || (item.drill_step ? 'drill' : 'simulation');
          AppState.circlesDrillStep = item.drill_step || null;
        }
        render();
      });
    });
    // see-all → open offcanvas history
    document.querySelectorAll('[data-circles="see-all"]').forEach(function (el) {
      el.addEventListener('click', function (e) {
        e.preventDefault();
        AppState.offcanvasOpen = true;
        AppState.historyList = null;
        render();
        if (typeof loadHistory === 'function') loadHistory();
      });
    });

    // nsm-promo CTA — navigate to NSM view
    var nsmCta = document.querySelector('[data-circles="nsm-promo"]');
    if (nsmCta) {
      nsmCta.addEventListener('click', function (e) {
        e.preventDefault();
        AppState.view = 'nsm';
        AppState.nsmStep = 1;
        render();
      });
    }

    // search input — debounced 100ms, re-pick 5 with filter
    var searchInput = document.querySelector('[data-view="circles"] .search-wrap input[type="search"]');
    if (searchInput) {
      searchInput.addEventListener('input', function () {
        if (_circlesSearchDebounce) clearTimeout(_circlesSearchDebounce);
        var val = searchInput.value;
        _circlesSearchDebounce = setTimeout(function () {
          AppState.circlesSearchText = val;
          circlesPickDisplayed(false);
          render();
        }, 100);
      });
    }

    // Load stats async (non-blocking)
    loadCirclesStats();
  }

  // ── NSM Step 1 (Plan C SB1 — mockup 06) ─────────────────────────────────
  var NSM_QUESTIONS = window.NSM_QUESTIONS || [];
  var _nsmContextQid = null;

  function nsmGuessProductType(q) {
    var text = [q.company, q.industry, q.scenario].filter(Boolean).join(' ').toLowerCase();
    if (/電商|marketplace|外賣|美食|叫車|打車|共享|租車|預訂|配送|撮合|airbnb|uber|grab|foodpanda|wolt|booking/.test(text)) return 'transaction';
    if (/saas|企業|b2b|crm|協作|辦公|工具|管理|自動化|zendesk|slack|notion|figma|datadog|zoom|intercom|twilio|stripe|shopify/.test(text)) return 'saas';
    if (/教育|學習|課程|語言|創作|ugc|知識|部落|newsletter|podcast|直播|duolingo|coursera|creator/.test(text)) return 'creator';
    return 'attention';
  }

  function getNsmContextSource(q, cachedContext, cachedQid) {
    var ctx = q && q.context;
    if (ctx && ctx.model && ctx.users && ctx.traps && ctx.insight) return 'pregenerated';
    if (cachedContext && cachedContext.model && cachedContext.users && cachedContext.traps && cachedContext.insight
        && q && cachedQid === q.id) return 'cached';
    return 'fetch';
  }
  window.getNsmContextSource = getNsmContextSource;

  var NSM_TYPE_ICON  = { attention: 'ph-play-circle', transaction: 'ph-shopping-cart', creator: 'ph-pencil-simple', saas: 'ph-buildings' };
  var NSM_TYPE_LABEL = { attention: '注意力型', transaction: '交易量型', creator: '創造力型', saas: 'SaaS 型' };

  function nsmPickDisplayed(clearSelection) {
    var pool = NSM_QUESTIONS.slice();
    if (AppState.nsmTypeFilter && AppState.nsmTypeFilter !== 'all') {
      pool = pool.filter(function (q) { return nsmGuessProductType(q) === AppState.nsmTypeFilter; });
    }
    if (AppState.nsmSearchText) {
      var s = AppState.nsmSearchText.toLowerCase();
      pool = pool.filter(function (q) {
        return ((q.company || '').toLowerCase().indexOf(s) >= 0)
            || ((q.industry || '').toLowerCase().indexOf(s) >= 0);
      });
    }
    if (clearSelection) AppState.nsmSelectedQuestion = null;
    for (var i = pool.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = pool[i]; pool[i] = pool[j]; pool[j] = t;
    }
    AppState.nsmDisplayedQuestions = pool.slice(0, 5);
  }

  function renderNSMProgress(activeStep) {
    var steps = [{ n: 1, label: '情境' }, { n: 2, label: '指標' }, { n: 3, label: '拆解' }, { n: 4, label: '總結' }];
    var html = '<div class="nsm-progress">';
    steps.forEach(function (s, idx) {
      var cls = s.n === activeStep ? 'is-active' : (s.n < activeStep ? 'is-done' : '');
      html += '<div class="nsm-progress__step' + (cls ? ' ' + cls : '') + '">'
        + '<div class="nsm-progress__dot">' + s.n + '</div>'
        + '<div class="nsm-progress__label">' + escHtml(s.label) + '</div>'
        + '</div>';
      if (idx < steps.length - 1)
        html += '<div class="nsm-progress__line' + (s.n < activeStep ? ' is-done' : '') + '"></div>';
    });
    return html + '</div>';
  }

  function renderNSMContextBlock(q) {
    var src = getNsmContextSource(q, AppState.nsmContext, _nsmContextQid);
    if (src === 'fetch') {
      return '<div class="nsm-context is-loading"><i class="ph ph-circle-notch"></i><span>分析情境中…</span></div>';
    }
    var ctx = src === 'pregenerated' ? q.context : AppState.nsmContext;
    return '<div class="nsm-context">'
      + '<div class="nsm-ctx-row"><span class="nsm-ctx-row__label"><i class="ph ph-buildings"></i>商業模式</span>'
      + '<span class="nsm-ctx-row__val">' + escHtml(ctx.model) + '</span></div>'
      + '<div class="nsm-ctx-row"><span class="nsm-ctx-row__label"><i class="ph ph-users"></i>使用者</span>'
      + '<span class="nsm-ctx-row__val">' + escHtml(ctx.users) + '</span></div>'
      + '<div class="nsm-ctx-row nsm-ctx-row--trap"><span class="nsm-ctx-row__label"><i class="ph ph-warning"></i>常見陷阱</span>'
      + '<span class="nsm-ctx-row__val">' + escHtml(ctx.traps) + '</span></div>'
      + '<div class="nsm-ctx-row nsm-ctx-row--insight"><span class="nsm-ctx-row__label"><i class="ph ph-lightbulb"></i>破題切入</span>'
      + '<span class="nsm-ctx-row__val">' + escHtml(ctx.insight) + '</span></div>'
      + '</div>';
  }

  function renderNSMQCard(q, isSelected) {
    var type = nsmGuessProductType(q);
    var typeHtml = isSelected
      ? '<span class="nsm-q-card__type nsm-q-card__type--' + type + '">'
        + '<i class="ph ' + NSM_TYPE_ICON[type] + '"></i>'
        + escHtml(NSM_TYPE_LABEL[type]) + '</span>'
      : '';
    return '<div class="nsm-q-card' + (isSelected ? ' is-selected' : '') + '" data-qid="' + escHtml(q.id) + '">'
      + '<div class="nsm-q-card__head">'
      + '<span class="nsm-q-card__company">' + escHtml(q.company) + '</span>'
      + '<span class="nsm-q-card__industry">' + escHtml(q.industry) + '</span>'
      + typeHtml + '</div>'
      + '<p class="nsm-q-card__scenario">' + escHtml(q.scenario) + '</p>'
      + (isSelected ? renderNSMContextBlock(q) : '')
      + '</div>';
  }

  function renderNSMFilterRail() {
    var counts = { attention: 0, transaction: 0, creator: 0, saas: 0 };
    NSM_QUESTIONS.forEach(function (q) { counts[nsmGuessProductType(q)]++; });
    var f = AppState.nsmTypeFilter || 'all';
    var typeRows = [
      { key: 'attention',   label: '注意力型', icon: 'ph-play-circle',   ic: 'nsm-filter-row__icon--attention' },
      { key: 'transaction', label: '交易量型', icon: 'ph-shopping-cart', ic: 'nsm-filter-row__icon--transaction' },
      { key: 'creator',     label: '創造力型', icon: 'ph-pencil-simple', ic: 'nsm-filter-row__icon--creator' },
      { key: 'saas',        label: 'SaaS 型',  icon: 'ph-buildings',     ic: 'nsm-filter-row__icon--saas' },
    ];
    var html = '<aside class="nsm-filter-rail"><div class="nsm-filter-rail__label">產業類型</div>'
      + '<div class="nsm-filter-row' + (f === 'all' ? ' is-active' : '') + '" data-nsm-filter="all">'
      + '<span>全部</span><span class="nsm-filter-row__count">' + NSM_QUESTIONS.length + '</span></div>';
    typeRows.forEach(function (row) {
      html += '<div class="nsm-filter-row' + (f === row.key ? ' is-active' : '') + '" data-nsm-filter="' + row.key + '">'
        + '<span><i class="ph ' + row.icon + ' nsm-filter-row__icon ' + row.ic + '"></i>' + escHtml(row.label) + '</span>'
        + '<span class="nsm-filter-row__count">' + counts[row.key] + '</span></div>';
    });
    return html + '</aside>';
  }

  function renderNSMRecentRail() {
    return '<aside class="nsm-recent"><div class="nsm-recent__label">近期練習</div></aside>';
  }

  function renderNSMStep1() {
    if (!AppState.nsmDisplayedQuestions || !AppState.nsmDisplayedQuestions.length) nsmPickDisplayed(false);
    var sel = AppState.nsmSelectedQuestion;
    var listLabel = sel ? '選擇題目（已選 1）' : '選擇題目';
    var cards = (AppState.nsmDisplayedQuestions || []).map(function (q) {
      return renderNSMQCard(q, !!(sel && sel.id === q.id));
    }).join('');
    var selType = sel ? nsmGuessProductType(sel) : null;
    var metaContent = sel
      ? '<span>已選：' + escHtml(sel.company) + ' · ' + escHtml(NSM_TYPE_LABEL[selType]) + '</span>'
        + '<span class="phase-head__meta-sep">·</span>'
        + '<span>共 ' + NSM_QUESTIONS.length + ' 題</span>'
      : '<span>共 ' + NSM_QUESTIONS.length + ' 題 · 隨機抽 5</span>';
    var instrMobile  = sel ? '' : '<p class="nsm-instruction">選一個企業情境，開始定義它的北極星指標。 5 題從 100+ 題庫中隨機抽選。</p>';
    var instrDesktop = sel ? '' : '<p class="nsm-instruction">選一個企業情境，開始定義它的北極星指標。 5 題從 100+ 題庫中隨機抽選 — 可用左側產業 filter 或上方搜尋縮窄。</p>';
    var mobileBody = '<div class="nsm-body">'
      + instrMobile
      + '<div class="nsm-list-head"><span class="nsm-list-head__label">' + listLabel + '</span>'
      + '<button class="nsm-shuffle" data-nsm="shuffle"><i class="ph ph-shuffle"></i>隨機選題</button></div>'
      + '<div class="nsm-q-list">' + cards + '</div>'
      + '</div>';
    var desktopShell = '<div class="nsm-desktop-shell">'
      + renderNSMFilterRail()
      + '<div class="nsm-center">'
      + instrDesktop
      + '<div class="nsm-search"><i class="ph ph-magnifying-glass"></i>'
      + '<input type="text" placeholder="搜尋公司或產業關鍵字..." value="'
      + escHtml(AppState.nsmSearchText || '') + '" data-nsm="search"></div>'
      + '<div class="nsm-list-head"><span class="nsm-list-head__label">' + listLabel + '</span>'
      + '<button class="nsm-shuffle" data-nsm="shuffle"><i class="ph ph-shuffle"></i>隨機選題</button></div>'
      + '<div class="nsm-q-list">' + cards + '</div>'
      + '</div>'
      + renderNSMRecentRail()
      + '</div>';
    var submitEnabled = !!sel;
    var submitBar = '<div class="submit-bar">'
      + '<div class="submit-bar__left">'
      + (submitEnabled ? '' : '<span style="font-size:var(--t-meta);color:var(--c-ink-3)">請先選擇一個情境</span>')
      + '</div><div class="submit-bar__right">'
      + '<button class="btn btn--primary' + (submitEnabled ? '' : ' is-disabled') + '"'
      + (submitEnabled ? '' : ' disabled')
      + ' data-nsm="start">開始 NSM 訓練 <i class="ph ph-arrow-right"></i></button>'
      + '</div></div>';
    var selAttr = sel ? ' data-nsm-selected' : '';
    return '<div data-view="nsm" data-nsm-step="1"' + selAttr + '>'
      + '<div class="phase-head"><span class="phase-head__num">1</span>'
      + '<div class="phase-head__main">'
      + '<div class="phase-head__eyebrow">NSM · 北極星訓練</div>'
      + '<div class="phase-head__title">選擇企業情境</div>'
      + '</div>'
      + '<div class="phase-head__meta">' + metaContent + '</div>'
      + '</div>'
      + renderNSMProgress(1)
      + '<div class="nsm-content">' + mobileBody + desktopShell + '</div>'
      + submitBar
      + '</div>';
  }

  function bindNSMStep1() {
    document.querySelectorAll('[data-nsm-step="1"] .nsm-q-card[data-qid]').forEach(function (card) {
      card.addEventListener('click', function () {
        var qid = card.dataset.qid;
        var q = NSM_QUESTIONS.find(function (x) { return x.id === qid; });
        if (!q) return;
        AppState.nsmSelectedQuestion = q;
        var src = getNsmContextSource(q, AppState.nsmContext, _nsmContextQid);
        if (src === 'fetch') {
          AppState.nsmContextLoading = true;
          render();
          loadNSMContext(q);
        } else { render(); }
      });
    });
    document.querySelectorAll('[data-nsm="shuffle"]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        nsmPickDisplayed(true);
        render();
      });
    });
    document.querySelectorAll('[data-nsm-filter]').forEach(function (row) {
      row.addEventListener('click', function () {
        AppState.nsmTypeFilter = row.dataset.nsmFilter;
        nsmPickDisplayed(false);
        render();
      });
    });
    var searchInput = document.querySelector('[data-nsm="search"]');
    if (searchInput) {
      searchInput.addEventListener('input', function () {
        AppState.nsmSearchText = searchInput.value;
        nsmPickDisplayed(false);
        render();
      });
    }
    var startBtn = document.querySelector('[data-nsm="start"]');
    if (startBtn && !startBtn.disabled) {
      startBtn.addEventListener('click', function () {
        if (!AppState.nsmSelectedQuestion) return;
        AppState.nsmStep = 2;
        render();
      });
    }
  }

  async function loadNSMContext(q) {
    try {
      var res = await window.apiFetch('/api/nsm-context', {
        method: 'POST',
        body: JSON.stringify({ questionJson: q }),
      });
      if (!res.ok) throw new Error('context_load_error');
      var ctx = await res.json();
      AppState.nsmContext = ctx;
      _nsmContextQid = q.id;
      AppState.nsmContextLoading = false;
      render();
    } catch (e) {
      if (e.code === 'SESSION_EXPIRED') return;
      AppState.nsmContextLoading = false;
      AppState.nsmContext = null;
      _nsmContextQid = null;
      render();
      throw e;
    }
  }

  function bindAll() {
    bindNavbar();
    bindOffcanvas();
    if (AppState.view === 'circles'
        && AppState.circlesPhase === 1
        && !AppState.circlesSession
        && !AppState.circlesSelectedQuestion) {
      bindCirclesHome();
    }
  }

  // ── Offcanvas History (Plan D SB1 — mockup 09) ───────────────────────────

  function renderOffcanvas() {
    if (!AppState.offcanvasOpen) return '';
    return `<div class="offcanvas-backdrop" data-offcanvas="close"></div>
    <aside class="offcanvas-drawer" role="dialog" aria-modal="true" aria-label="練習記錄">
      <div class="offcanvas-head">
        <span class="offcanvas-head__title">練習記錄</span>
        <button class="offcanvas-head__close" data-offcanvas="close" aria-label="關閉"><i class="ph ph-x"></i></button>
      </div>
      <div class="offcanvas-body">${renderOffcanvasContent()}</div>
    </aside>`;
  }

  function renderOffcanvasContent() {
    if (AppState.historyError) {
      return `<div class="offcanvas-error">
        <div class="offcanvas-error__icon"><i class="ph ph-warning-circle"></i></div>
        <div class="offcanvas-error__title">載入失敗</div>
        <div class="offcanvas-error__sub">請檢查網路連線後再試。</div>
        <button class="btn btn--ghost" data-offcanvas="retry"><i class="ph ph-arrow-clockwise"></i>重試</button>
      </div>`;
    }
    if (AppState.historyLoading || AppState.historyList === null) {
      return `<div class="offcanvas-loading">
        <div class="offcanvas-spinner"></div>
        <div class="offcanvas-loading__text">載入中…</div>
      </div>`;
    }
    if (AppState.historyList.length === 0) {
      return `<div class="offcanvas-empty">
        <div class="offcanvas-empty__icon"><i class="ph ph-folder-open"></i></div>
        <div class="offcanvas-empty__title">尚無練習記錄</div>
        <div class="offcanvas-empty__sub">練習完成的 CIRCLES 題目與 NSM 訓練會出現在這裡。</div>
        <button class="btn btn--ghost offcanvas-empty__cta" data-offcanvas="close"><i class="ph ph-arrow-right"></i>開始第一題</button>
      </div>`;
    }
    return renderOffcanvasList(AppState.historyList);
  }

  function renderOffcanvasList(items) {
    const now = Date.now();
    const DAY = 86400000;
    const todayItems = items.filter(function (i) { return now - new Date(i.updated_at || i.created_at).getTime() < DAY; });
    const week7Items = items.filter(function (i) { const age = now - new Date(i.updated_at || i.created_at).getTime(); return age >= DAY && age < 7 * DAY; });
    const olderItems = items.filter(function (i) { return now - new Date(i.updated_at || i.created_at).getTime() >= 7 * DAY; });

    var html = '';
    if (todayItems.length) {
      html += '<div class="offcanvas-section">今天</div>';
      todayItems.forEach(function (item) { html += renderOffcanvasItem(item); });
    }
    if (week7Items.length) {
      html += '<div class="offcanvas-section">過去 7 天</div>';
      week7Items.forEach(function (item) { html += renderOffcanvasItem(item); });
    }
    if (olderItems.length) {
      html += '<div class="offcanvas-section">更早</div>';
      olderItems.forEach(function (item) { html += renderOffcanvasItem(item); });
    }
    return html;
  }

  function renderOffcanvasItem(item) {
    // Determine title and meta label
    var title = '';
    var metaLabel = '';
    var scoreHtml = '';
    var isNsm = !item.mode && !item.drill_step;

    // Title helper — backend enriches each session row with currentQuestion (object,
    // routes/circles-sessions.js:111) AND keeps question_json column. Both are objects
    // shaped { company, product, ... } per spec §1.8.
    function questionTitle(item) {
      const q = (item.question_json && item.question_json.company) ? item.question_json
              : (item.currentQuestion && item.currentQuestion.company) ? item.currentQuestion
              : null;
      if (!q) return '';
      return q.product ? (q.company + ' · ' + q.product) : q.company;
    }

    if (item.mode === 'drill' || item.drill_step) {
      const stepMap = { C1: 'C 澄清', I: 'I 用戶洞察', R: 'R 重新定義' };
      const stepLabel = stepMap[item.drill_step] || item.drill_step || '步驟加練';
      metaLabel = 'CIRCLES · ' + stepLabel;
      title = questionTitle(item) || '練習題目';
    } else if (item.mode === 'simulation') {
      metaLabel = 'CIRCLES · 完整 7 步';
      title = questionTitle(item) || '練習題目';
    } else {
      // NSM session (no mode field)
      metaLabel = 'NSM · 4 步';
      title = questionTitle(item) || '北極星指標練習';
    }

    // Score badge — navy, only for completed sessions with a score.
    // step_scores values are EvaluatorResponse objects { totalScore, dimensions, ... } per spec §1.4.
    // NSM scores_json shape is { totalScore, scores } per prompts/nsm-evaluator.js:48.
    if (item.status === 'completed' || item.status === 'scored') {
      var score = null;
      if (isNsm && item.scores_json && item.scores_json.totalScore != null) {
        score = item.scores_json.totalScore;
      } else if (item.step_scores && item.step_scores.S && item.step_scores.S.totalScore != null) {
        score = item.step_scores.S.totalScore;
      } else {
        score = item.total_score || item.score || null;
      }
      if (score != null) {
        scoreHtml = '<span class="offcanvas-item__score">' + score + '</span>';
      }
    }

    const dateStr = item.updated_at || item.created_at || '';
    const dateFormatted = dateStr ? new Date(dateStr).toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' }) : '';

    return `<div class="offcanvas-item" data-offcanvas="item" data-id="${escHtml(item.id)}">
      <div class="offcanvas-item__title-row">
        <span class="offcanvas-item__title">${escHtml(title)}</span>
        ${scoreHtml}
      </div>
      <div class="offcanvas-item__meta">${escHtml(metaLabel)}</div>
      <div class="offcanvas-item__date">${escHtml(dateFormatted)}</div>
      <button class="offcanvas-item__delete" data-offcanvas="delete" data-id="${escHtml(item.id)}" aria-label="刪除"><i class="ph ph-trash"></i></button>
    </div>`;
  }

  async function loadHistory() {
    AppState.historyLoading = true;
    AppState.historyError = null;
    render();
    try {
      const circlesPath = AppState.accessToken ? '/api/circles-sessions' : '/api/guest-circles-sessions';
      const nsmPath = AppState.accessToken ? '/api/nsm-sessions' : '/api/guest/nsm-sessions';
      const [circlesRes, nsmRes] = await Promise.all([
        window.apiFetch(circlesPath),
        window.apiFetch(nsmPath),
      ]);
      if (!circlesRes.ok) throw new Error('CIRCLES_LOAD_ERROR');
      if (!nsmRes.ok) throw new Error('NSM_LOAD_ERROR');
      const circles = await circlesRes.json();
      const nsm = await nsmRes.json();
      AppState.historyList = [].concat(circles, nsm).sort(function (a, b) {
        return new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at);
      });
      AppState.historyLoading = false;
      render();
    } catch (e) {
      if (e.code === 'SESSION_EXPIRED') return;
      AppState.historyLoading = false;
      AppState.historyError = e.message || 'LOAD_ERROR';
      render();
    }
  }

  function bindOffcanvas() {
    if (!AppState.offcanvasOpen) return;
    document.querySelectorAll('[data-offcanvas]').forEach(function (el) {
      el.addEventListener('click', function (e) {
        e.stopPropagation();
        const action = el.dataset.offcanvas;
        if (action === 'close') {
          AppState.offcanvasOpen = false;
          render();
        } else if (action === 'retry') {
          AppState.historyList = null;
          loadHistory();
        } else if (action === 'delete') {
          const id = el.dataset.id;
          AppState.historyList = AppState.historyList.filter(function (i) { return i.id !== id; });
          render();
          const path = AppState.accessToken ? '/api/circles-sessions/' + id : '/api/guest-circles-sessions/' + id;
          window.apiFetch(path, { method: 'DELETE' }).catch(function () {});
        }
      });
    });
    // ESC closes
    function escHandler(e) {
      if (e.key === 'Escape' && AppState.offcanvasOpen) {
        AppState.offcanvasOpen = false;
        render();
        document.removeEventListener('keydown', escHandler);
      }
    }
    document.addEventListener('keydown', escHandler);
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
