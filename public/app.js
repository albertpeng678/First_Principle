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
    onboardingComplete: localStorage.getItem('circles_onboarding_done') === '1',
    onboardingActive: false,    // Plan D SB2 — true while tour running
    onboardingStep: 0,          // Plan D SB2 — 0 = welcome, 1-4 = tour steps

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
    circlesGateLoading: false,
    circlesGateError: null,
    circlesScoreResult: null,
    circlesStepScores: {},
    circlesEvaluating: false,
    circlesEvaluateError: null,
    circlesFinalReport: null,
    circlesStale: false,
    circlesLocked: false,
    circlesChipExpanded: false,
    circlesDisplayedQuestions: [],

    // Plan B SB4 additions
    circlesPhase1Solutions: [
      { name: '', mechanism: '' },
      { name: '', mechanism: '' },
    ],

    // Plan B SB7 additions
    circlesPhase1Evaluate: [
      { advantages: '', disadvantages: '', risks: '', metrics: '' },
      { advantages: '', disadvantages: '', risks: '', metrics: '' },
    ],

    // Plan B SB9a additions — save indicator 4-state visual cycle (mockup 03 Section F line 2160-2174)
    // states: 'idle' (已暫存) | 'saving' (儲存中) | 'saved' (已儲存到雲端) | 'error' (離線中·點擊重試)
    circlesPhase1SaveState: 'idle',

    // Plan B SB10 — empty-draft inline hint banner (GAP 1)
    circlesPhase1EmptyHint: false,

    // Plan B SB5 additions
    circlesPhase1S: {
      recommendation: '',
      reasoning: '',
      nsm: '',
      tracking: { reach: '', depth: '', frequency: '', impact: '' },
    },

    // Plan B additions
    circlesTypeFilter: 'design',        // 'design' | 'improve' | 'strategy'
    circlesSearchText: '',
    circlesQaOpen: false,               // qa-row default closed (user 2026-05-04)
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
    nsmGateError: null,
    nsmGateLoading: false,
    nsmGateLoadingStep: 0,
    nsmEvalLoading: false,           // mirror nsmGateLoading for Step 3 evaluate inflight tracking
    nsmEvalResult: null,
    nsmEvalError: null,
    nsmActiveCompareNode: null,
    nsmDisplayedQuestions: [],
    nsmSearchText: '',
    nsmTypeFilter: 'all',
    nsmDefinition: { nsm: '', explanation: '', businessLink: '' },
    nsmBreakdown: { reach: '', depth: '', frequency: '', impact: '' },
    nsmExampleExpanded: {},
    nsmHintExpanded: {},
    nsmDimExampleExpanded: {},
    nsmContextExpanded: false,         // Step 2/3 context-card 4-block expand toggle (Gap C)

    // Plan B Phase 2 Chat additions (mockup 05)
    circlesPhase2Streaming: false,
    circlesPhase2StreamingTurn: null,        // { userMessage, deltaText }
    circlesPhase2StreamError: false,         // true when SSE fails → show 重新發送
    circlesPhase2ConclusionMode: false,
    circlesPhase2ConclusionDraft: '',
    circlesPhase2ExampleOpen: false,
    circlesPhase2CoachHintExpanded: {},      // { turnIdx: boolean }

    // chat
    streamingActive: false,

    // Offcanvas / History (Plan D)
    offcanvasOpen: false,
    historyList: null,       // null = not loaded yet; [] = empty; [...] = items
    historyLoading: false,
    historyError: null,

    // R3: loading state for session detail fetch (Option B)
    circlesSessionLoading: false,

    // Plan B Phase 3 — score view (mockup 11/12)
    circlesPhase3LoadingStep: 1,         // 0-3 — Loading checklist current active step (starts at 1: 解析框架 done)
    circlesPhase3LoadingSlow: false,     // true after 60s in loading state (mockup 12 Section A slow variant)
    circlesPhase3Error: null,            // null | { code: string, message: string }
    circlesPhase3DimExpanded: {},        // Record<dimIndex, boolean> — user manual expand
    circlesPhase3CoachDemoOpen: false,   // coach-demo accordion user toggle

    // Plan B Phase 4 — final report (mockup 13)
    circlesPhase4LoadingStep: 0,         // 0-3 — Loading checklist current active step
    circlesPhase4Error: null,            // null | { code: string, message: string }

    // Mockup 02 — Auth flow (login / register / logout / migration / token expiry)
    authTab: 'login',                    // 'login' | 'register'
    authLoading: false,                  // true while Supabase call in flight
    authError: null,                     // null | { code: string, message: string }
    userEmail: null,                     // authed user email (null = guest)
    migrationBanner: null,               // null | 'showing' | 'dismissed' — post-login success

    // Mockup 16 §D — cross-tab resume-toast (Phase 3 / Phase 4 / NSM gate in-flight)
    evalToastDismissed: false,           // user clicked X on resume-toast
  };
  window.AppState = AppState;

  // ── Persistence (per spec §2.1 — localStorage keys) ───────────────────────
  const PERSISTED_KEYS = ['view', 'accessToken', 'guestId', 'circlesMode', 'circlesPhase', 'circlesDrillStep', 'circlesSelectedQuestion', 'userEmail'];
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

  // ── Supabase SDK dynamic load + init ─────────────────────────────────────────
  // Dynamic script load to avoid console errors when CDN is unreachable (test env).
  // Fetch /api/config to get anon key, then init window.supabaseClient.
  // Falls back silently to no-op if anything fails.
  function loadSupabaseAndInit() {
    // First fetch config (may 404 in old-server envs — silent on error)
    fetch('/api/config')
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (cfg) {
        if (!cfg || !cfg.supabaseUrl || !cfg.supabaseAnonKey) {
          // config not available — no supabase client, guest-only mode
          window.supabaseClient = null;
          return;
        }
        // Dynamically load Supabase CDN script
        var script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js';
        script.onload = function () {
          initSupabase(cfg.supabaseUrl, cfg.supabaseAnonKey);
        };
        script.onerror = function () {
          window.supabaseClient = null;
          _supabaseInitDone = true;
        };
        document.head.appendChild(script);
      })
      .catch(function () {
        window.supabaseClient = null;
        _supabaseInitDone = true;
      });
  }

  // ── Supabase client init — async, fires before first render ─────────────────
  // Fetches /api/config to get anon key (public by Supabase design), then inits
  // window.supabaseClient. Falls back to no-op if CDN script not loaded or env missing.
  var _supabaseInitDone = false;
  function initSupabase(url, anonKey) {
    try {
      if (window.supabase && window.supabase.createClient && url && anonKey) {
        window.supabaseClient = window.supabase.createClient(url, anonKey, {
          auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
        });
        // Sync existing session from Supabase (handles page reload with existing token)
        window.supabaseClient.auth.getSession().then(function (result) {
          var session = result && result.data && result.data.session;
          if (session && session.access_token) {
            AppState.accessToken = session.access_token;
            AppState.userEmail = (session.user && session.user.email) || AppState.userEmail || null;
            render();
          }
        }).catch(function () {});
      } else {
        window.supabaseClient = null;
      }
      _supabaseInitDone = true;
    } catch (e) {
      window.supabaseClient = null;
      _supabaseInitDone = true;
    }
  }

  // ── Boot (Plan A skeleton; Plans B/C/D/E hook into render dispatch) ───────
  document.addEventListener('DOMContentLoaded', function () {
    restore();
    AppState.guestId = ensureGuestId();
    bindGlobalListeners();
    render();
    // Plan D SB2: background history load on boot so onboarding trigger can
    // determine if user is first-time (no sessions) or returning (has sessions).
    // loadHistory → maybeStartOnboarding → render() with onboarding if needed.
    loadHistory();
    // Mockup 02: load Supabase JS SDK dynamically + fetch config + init client
    // Dynamic script loading prevents console errors when CDN or config endpoint is unavailable.
    loadSupabaseAndInit();
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
    app.innerHTML = navbar + banners + renderOffcanvas() + view + renderOnboardingOverlay();
    if (AppState.offcanvasOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    bindAll();
    if (AppState.view === 'nsm' && AppState.nsmStep === 1) bindNSMStep1();
    if (AppState.view === 'nsm' && (AppState.nsmStep === 2 || AppState.nsmStep === 3)) bindNSMStep2And3();
    if (AppState.view === 'nsm' && AppState.nsmStep === 4) bindNSMStep4();
  }
  window.render = render;
  window.renderApp = render; // alias for test scripts

  function renderView() {
    const v = AppState.view;
    if (v === 'circles') {
      // R3-B: loading state while fetching session detail (Option B)
      if (AppState.circlesSessionLoading) {
        return '<div class="loading-wrap">'
          + '<div class="loading-spinner"></div>'
          + '<div class="loading-title">載入練習中…</div>'
          + '</div>';
      }
      if (AppState.circlesPhase === 1.5) {
        return renderCirclesGate();
      }
      if (AppState.circlesPhase === 1 && AppState.circlesSelectedQuestion) {
        return renderCirclesPhase1();
      }
      if (AppState.circlesPhase === 1 && !AppState.circlesSession && !AppState.circlesSelectedQuestion) {
        return renderCirclesHome();
      }
      if (AppState.circlesPhase === 2 && AppState.circlesSession && AppState.circlesSelectedQuestion) {
        return renderCirclesPhase2();
      }
      if (AppState.circlesPhase === 3 && AppState.circlesSession) {
        return renderCirclesPhase3();
      }
      if (AppState.circlesPhase === 4 && AppState.circlesSession) {
        return renderCirclesPhase4();
      }
      return renderCirclesStub();
    }
    if (v === 'nsm') {
      return renderNSM();
    }
    if (v === 'auth')    return renderAuthStub();
    return renderCirclesHome();
  }

  function renderCirclesStub() {
    return '<div data-view="circles" style="padding:24px;color:var(--c-ink-3);text-align:center">CIRCLES view — 待 Plan B 實作</div>';
  }

  // ── renderCirclesPhase4 (Plan B Phase 4 — mockup 13) ──────────────────────
  // Phase 4 state matrix:
  //   1. circlesPhase4Error set         → Section C Error
  //   2. !circlesFinalReport            → Section B Loading (auto-trigger POST final-report)
  //   3. circlesFinalReport exists      → Section A success report

  // Timers for Phase 4 loading state
  var _phase4LoadingInterval = null;
  var _phase4LoadingTimeout  = null;

  function clearPhase4Timers() {
    if (_phase4LoadingInterval) { clearInterval(_phase4LoadingInterval); _phase4LoadingInterval = null; }
    if (_phase4LoadingTimeout)  { clearTimeout(_phase4LoadingTimeout);   _phase4LoadingTimeout  = null; }
  }

  function renderPhase4Nav() {
    var q = AppState.circlesSelectedQuestion || {};
    var company = escHtml(q.company || '');
    var product = escHtml(q.product  || '');
    var sub = company && product ? (company + ' · ' + product) : (company || product);
    return '<div class="circles-nav">'
      + '<button class="circles-nav__back" data-phase4="nav-back" aria-label="返回"><i class="ph ph-arrow-left"></i></button>'
      + '<div class="circles-nav__main">'
      + '<div class="circles-nav__title">模擬面試總結報告</div>'
      + (sub ? '<div class="circles-nav__sub">' + escHtml(sub) + '</div>' : '')
      + '</div>'
      + '</div>';
  }

  // Radar SVG helper — 7-axis heptagon from circlesStepScores
  function renderPhase4RadarSVG() {
    var stepKeys  = ['C1', 'I', 'R', 'C2', 'L', 'E', 'S'];
    var stepLabels = { C1: 'C 澄清', I: 'I 用戶', R: 'R 需求', C2: 'C2 排序', L: 'L 方案', E: 'E 取捨', S: 'S 總結' };
    var scores = AppState.circlesStepScores || {};

    // SVG geometry — centre (120, 110), max-radius 92
    var cx = 120, cy = 110, maxR = 92;
    // For ring reference polygon we use a 5-sided ring drawn as 2 rings; simplified: just draw 3 concentric
    // 7 axes at angle: -π/2 + 2π*i/7 starting from top (C1 = top)
    var n = 7;
    var angles = stepKeys.map(function (_, i) {
      return -Math.PI / 2 + (2 * Math.PI * i) / n;
    });

    // Outer vertices (maxR)
    var outerPts = angles.map(function (a) {
      return { x: cx + maxR * Math.cos(a), y: cy + maxR * Math.sin(a) };
    });

    // Data polygon — scale score/100 within maxR
    var dataPts = stepKeys.map(function (k, i) {
      var score = (scores[k] && scores[k].totalScore != null) ? scores[k].totalScore : 0;
      var r = maxR * Math.max(0, Math.min(100, score)) / 100;
      return { x: cx + r * Math.cos(angles[i]), y: cy + r * Math.sin(angles[i]) };
    });

    function ptsStr(pts) {
      return pts.map(function (p) { return p.x.toFixed(1) + ',' + p.y.toFixed(1); }).join(' ');
    }

    // Rings at 25/50/75% of maxR
    var rings = [0.75, 0.5, 0.25].map(function (frac) {
      var rPts = angles.map(function (a) {
        var r = maxR * frac;
        return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
      });
      return '<polygon class="ring" points="' + ptsStr(rPts) + '"/>';
    }).join('');

    // Axis lines
    var axes = outerPts.map(function (p) {
      return '<line class="axis" x1="' + cx + '" y1="' + cy + '" x2="' + p.x.toFixed(1) + '" y2="' + p.y.toFixed(1) + '"/>';
    }).join('');

    // Labels — positioned just beyond outerPts with anchor logic
    var labelOffset = 20;
    var labels = stepKeys.map(function (k, i) {
      var a = angles[i];
      var lx = cx + (maxR + labelOffset) * Math.cos(a);
      var ly = cy + (maxR + labelOffset) * Math.sin(a);
      // text-anchor: if near left → end, near right → start, else middle
      var anchor = Math.cos(a) < -0.3 ? 'end' : (Math.cos(a) > 0.3 ? 'start' : 'middle');
      // vertical adjust: top labels shift up, bottom labels shift down
      var dy = Math.sin(a) < -0.3 ? 0 : (Math.sin(a) > 0.3 ? 12 : 4);
      return '<text class="label" x="' + lx.toFixed(1) + '" y="' + (ly + dy).toFixed(1) + '" text-anchor="' + anchor + '">'
        + escHtml(stepLabels[k]) + '</text>';
    }).join('');

    // Data dots
    var dots = dataPts.map(function (p) {
      return '<circle class="dot" cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="3"/>';
    }).join('');

    return '<svg class="radar-svg" viewBox="0 0 240 240" preserveAspectRatio="xMidYMid meet" role="img" aria-label="七步驟雷達圖">'
      + rings
      + axes
      + '<polygon class="poly" points="' + ptsStr(dataPts) + '"/>'
      + dots
      + labels
      + '</svg>';
  }

  function renderPhase4Loading() {
    var steps = [
      '彙整七步驟資料',
      '計算總分與評等',
      '生成 7-axis 雷達圖',
      '整理改進建議',
    ];
    var currentStep = AppState.circlesPhase4LoadingStep || 0;
    var stepHtml = steps.map(function (label, idx) {
      var cls, icon;
      if (idx < currentStep) {
        cls = 'loading-step is-done';
        icon = '<i class="ph ph-check-circle"></i>';
      } else if (idx === currentStep) {
        cls = 'loading-step is-active';
        icon = '<i class="ph ph-circle-notch"></i>';
      } else {
        cls = 'loading-step is-pending';
        icon = '<i class="ph ph-circle"></i>';
      }
      return '<div class="' + cls + '"><span class="loading-step__icon">' + icon + '</span>' + escHtml(label) + '</div>';
    }).join('');

    return '<div data-view="circles" data-phase="4">'
      + renderPhase4Nav()
      + '<div class="loading-wrap">'
      + '<div class="loading-spinner"></div>'
      + '<div class="loading-title">生成總結報告中</div>'
      + '<div class="loading-sub">七步框架評分整合中，預計 30-60 秒</div>'
      + '<div class="loading-checklist">' + stepHtml + '</div>'
      + '</div>'
      + '</div>';
  }

  function renderPhase4Error() {
    var err = AppState.circlesPhase4Error || {};
    var code = err.code || 'REPORT_API_ERROR';
    var subCopy;
    if (code === 'REPORT_API_ERROR') {
      subCopy = '總結報告 API 暫時不可用，你的七步驟評分已自動保存。請稍後重試或回首頁挑下一題。';
    } else if (code === 'REPORT_TIMEOUT') {
      subCopy = '總結報告生成超時，七步驟評分已自動保存。請稍後重試。';
    } else if (code === 'REPORT_PARSE_ERROR') {
      subCopy = '教練回應格式異常，請重試。';
    } else {
      subCopy = '報告生成發生錯誤，請重試。';
    }
    return '<div data-view="circles" data-phase="4">'
      + renderPhase4Nav()
      + '<div class="error-wrap">'
      + '<div class="error-wrap__icon"><i class="ph-fill ph-cloud-warning"></i></div>'
      + '<div class="error-wrap__title">報告生成失敗</div>'
      + '<div class="error-wrap__sub">' + escHtml(subCopy) + '</div>'
      + '<code class="error-wrap__code">' + escHtml(code) + '</code>'
      + '<div class="error-wrap__actions">'
      + '<button class="btn btn--ghost" data-phase4="go-home"><i class="ph ph-house"></i>回首頁</button>'
      + '<button class="btn btn--primary" data-phase4="retry"><i class="ph ph-arrow-clockwise"></i>重試</button>'
      + '</div>'
      + '</div>'
      + '</div>';
  }

  function renderPhase4Success() {
    var report = AppState.circlesFinalReport || {};
    var stepScores = AppState.circlesStepScores || {};
    var q = AppState.circlesSelectedQuestion || {};

    // Step rows config
    var stepOrder  = ['C1', 'I', 'R', 'C2', 'L', 'E', 'S'];
    var stepConfig = [
      { key: 'C1',  letterKey: 'C',  title: '澄清' },
      { key: 'I',   letterKey: 'I',  title: '用戶' },
      { key: 'R',   letterKey: 'R',  title: '需求' },
      { key: 'C2',  letterKey: 'C2', title: '排序' },
      { key: 'L',   letterKey: 'L',  title: '方案' },
      { key: 'E',   letterKey: 'E',  title: '取捨' },
      { key: 'S',   letterKey: 'S',  title: '總結' },
    ];

    // ── Grade card ──────────────────────────────────────────────────────────
    var overallScore = report.overallScore != null ? report.overallScore : '—';
    var headline = report.headline || '';
    var gradeCardHtml = '<div class="grade-card">'
      + '<div class="grade-card__score-row">'
      + '<span class="grade-card__score-num">' + escHtml(String(overallScore)) + '</span>'
      + '<span class="grade-card__score-unit">分</span>'
      + '</div>'
      + (headline ? '<div class="grade-card__headline">' + escHtml(headline) + '</div>' : '')
      + '</div>';

    // ── Radar panel ─────────────────────────────────────────────────────────
    var radarHtml = '<div class="panel-card">'
      + '<div class="panel-card__title"><i class="ph ph-radio-button"></i>各步驟雷達圖</div>'
      + renderPhase4RadarSVG()
      + '</div>';

    // ── Step rows panel ──────────────────────────────────────────────────────
    var stepRowsHtml = '<div class="step-rows__list">';
    stepConfig.forEach(function (sc) {
      var sd = stepScores[sc.key] || {};
      var score = sd.totalScore != null ? Math.round(sd.totalScore) : null;
      var scoreCls = score == null ? '' : (score >= 80 ? ' step-rows__score--high' : (score <= 69 ? ' step-rows__score--low' : ' step-rows__score--mid'));
      var scoreStr = score != null ? String(score) : '—';
      // commentary: use highlight from phase 3 score
      var commentary = sd.highlight || '';
      stepRowsHtml += '<div class="step-rows__row">'
        + '<div class="step-rows__head">'
        + '<span class="step-rows__name"><span class="step-rows__name-key">' + escHtml(sc.letterKey) + '</span>' + escHtml(sc.title) + '</span>'
        + '<span class="step-rows__score' + scoreCls + '">' + escHtml(scoreStr) + '</span>'
        + '</div>'
        + (commentary ? '<div class="step-rows__note">' + escHtml(commentary) + '</div>' : '')
        + '</div>';
    });
    stepRowsHtml += '</div>';

    var stepRowsPanelHtml = '<div class="panel-card">'
      + '<div class="panel-card__title"><i class="ph ph-list-numbers"></i>各步驟分數（明細）</div>'
      + stepRowsHtml
      + '</div>';

    // Desktop 2-col: top-grid + top-grid--desktop modifier on desktop
    var isDesktop = window.innerWidth >= 1024;
    var topGridCls = 'top-grid' + (isDesktop ? ' top-grid--desktop' : '');
    var topGridHtml = '<div class="' + topGridCls + '">' + radarHtml + stepRowsPanelHtml + '</div>';

    // ── Feedback cards ───────────────────────────────────────────────────────
    var strengths = Array.isArray(report.strengths) ? report.strengths : [];
    var improvements = Array.isArray(report.improvements) ? report.improvements : [];
    var coachVerdict = report.coachVerdict || '';
    var nextSteps = report.nextSteps || '';

    var strengthsHtml = strengths.length > 0
      ? '<div class="feedback-card feedback-card--strengths">'
        + '<div class="feedback-card__title"><i class="ph-fill ph-check-circle"></i>表現優秀</div>'
        + '<ul class="feedback-card__list">'
        + strengths.map(function (s) { return '<li>' + escHtml(s) + '</li>'; }).join('')
        + '</ul></div>'
      : '';

    var improvementsHtml = improvements.length > 0
      ? '<div class="feedback-card feedback-card--improvements">'
        + '<div class="feedback-card__title"><i class="ph-fill ph-warning-circle"></i>需要改進</div>'
        + '<ul class="feedback-card__list">'
        + improvements.map(function (s) { return '<li>' + escHtml(s) + '</li>'; }).join('')
        + '</ul></div>'
      : '';

    var verdictHtml = coachVerdict
      ? '<div class="feedback-card feedback-card--verdict">'
        + '<div class="feedback-card__title"><i class="ph-fill ph-graduation-cap"></i>教練總評</div>'
        + '<p class="feedback-card__text">' + escHtml(coachVerdict) + '</p>'
        + '</div>'
      : '';

    var nextStepsHtml = nextSteps
      ? '<div class="nextsteps-card"><span class="nextsteps-card__label">建議下一步：</span>' + escHtml(nextSteps) + '</div>'
      : '';

    // ── Report body ──────────────────────────────────────────────────────────
    var reportBodyHtml = '<div class="report-body">'
      + gradeCardHtml
      + topGridHtml
      + strengthsHtml
      + improvementsHtml
      + verdictHtml
      + nextStepsHtml
      + '</div>';

    // ── Submit bar ───────────────────────────────────────────────────────────
    var submitBarHtml = '<div class="submit-bar">'
      + '<div class="submit-bar__left"><button class="btn btn--ghost btn--icon" data-phase4="go-home"><i class="ph ph-house"></i></button></div>'
      + '<div class="submit-bar__right">'
      + '<button class="btn btn--ghost" data-phase4="export-png"><i class="ph ph-download-simple"></i>匯出 PNG</button>'
      + '<button class="btn btn--primary" data-phase4="retry-question"><i class="ph ph-shuffle"></i>再練一題</button>'
      + '</div>'
      + '</div>';

    return '<div data-view="circles" data-phase="4">'
      + renderPhase4Nav()
      + reportBodyHtml
      + submitBarHtml
      + '</div>';
  }

  // _phase4FinalReportFired exposed on AppState._phase4FinalReportFired for testability
  function getPhase4Fired() { return AppState._phase4FinalReportFired || false; }
  function setPhase4Fired(v) { AppState._phase4FinalReportFired = v; }

  function renderCirclesPhase4() {
    if (AppState.circlesPhase4Error) {
      clearPhase4Timers();
      return renderPhase4Error();
    }
    if (!AppState.circlesFinalReport) {
      // Auto-fire POST final-report exactly once per Phase 4 entry
      if (!getPhase4Fired()) {
        setPhase4Fired(true);
        triggerFinalReport();
      }
      // Start loading timers if not already running
      if (!_phase4LoadingInterval) {
        _phase4LoadingInterval = setInterval(function () {
          if (AppState.circlesPhase4LoadingStep < 3) {
            AppState.circlesPhase4LoadingStep++;
            render();
          }
        }, 7000);
      }
      if (!_phase4LoadingTimeout) {
        _phase4LoadingTimeout = setTimeout(function () {
          clearPhase4Timers();
          AppState.circlesPhase4Error = { code: 'REPORT_TIMEOUT', message: '總結報告生成超時' };
          render();
        }, 60000);
      }
      return renderPhase4Loading();
    }
    clearPhase4Timers();
    return renderPhase4Success();
  }

  async function triggerFinalReport() {
    var sessionId = AppState.circlesSession && AppState.circlesSession.id;
    if (!sessionId) {
      AppState.circlesPhase4Error = { code: 'REPORT_API_ERROR', message: 'no session' };
      render();
      return;
    }
    var basePath = AppState.accessToken
      ? '/api/circles-sessions/'
      : '/api/guest-circles-sessions/';
    try {
      var res = await window.apiFetch(basePath + sessionId + '/final-report', {
        method: 'POST',
        body: '{}',
      });
      if (res.ok) {
        var data = await res.json();
        AppState.circlesFinalReport = data;
        clearPhase4Timers();
        render();
      } else {
        var errData = await res.json().catch(function () { return {}; });
        var errCode = errData.code || 'REPORT_API_ERROR';
        clearPhase4Timers();
        AppState.circlesPhase4Error = { code: errCode, message: errData.error || 'API error' };
        render();
      }
    } catch (e) {
      if (e && e.code === 'SESSION_EXPIRED') return;
      clearPhase4Timers();
      AppState.circlesPhase4Error = { code: 'REPORT_API_ERROR', message: e.message || 'network error' };
      render();
    }
  }

  // ── renderCirclesPhase2 (Plan B Phase 2 — mockup 05) ──────────────────────

  // Step-specific Phase 2 copy tables (mockup 05 + spec §2)
  var PHASE2_STEP_CONFIG = {
    C1: {
      title: 'C · 澄清情境',
      icebreakerText: '先與被訪談者澄清題目本身的邊界 — 具體在問什麼問題、涵蓋哪些功能或場景、有哪些業務限制不能突破。',
      conclusionSub: '說明問題範圍、時間框架、業務約束，以及你確認或待確認的假設。',
      conclusionSubDesktop: '說明問題範圍、時間框架、業務約束，以及你確認或待確認的假設。建議 80-120 字。',
      conclusionPlaceholder: '針對這題，整理你澄清的問題範圍、時間框架、業務約束，以及假設確認...',
      conclusionExample: '問題範圍：聚焦免費 podcast 用戶在新用戶階段的 7 日留存（不含付費 / 不含音樂類）；時間框架：H2 內看到 18%→25% 提升；業務約束：不可動付費機制 / 預算彈性 / Q3 上線為 stretch；假設：留存提升受 onboarding 動線影響大於內容推薦演算法本身（待 Phase 2 驗證）。',
    },
    I: {
      title: 'I · 定義用戶',
      icebreakerText: '了解目標用戶 — 他們是誰、什麼情境下會使用、目前如何解決問題。',
      conclusionSub: '描述目標用戶輪廓、使用情境、現有解法。',
      conclusionSubDesktop: '描述目標用戶輪廓、使用情境、現有解法。建議 60-100 字。',
      conclusionPlaceholder: '針對這題，整理目標用戶是誰、使用情境、現有解法...',
      conclusionExample: '目標用戶：30 天內新註冊但未養成每週收聽習慣的免費用戶（DAU < 2）；情境：零碎時間（通勤 / 睡前）想找內容消磨時間但不知從何開始；現有解法：主要靠首頁推薦但點擊率低（CTR 約 8%）。',
    },
    R: {
      title: 'R · 發掘需求',
      icebreakerText: '挖掘真實需求 — 痛點頻率、嚴重度、現有方案的不足。',
      conclusionSub: '列出關鍵需求並標註頻率/嚴重度/現有方案不足。',
      conclusionSubDesktop: '列出關鍵需求並標註頻率/嚴重度/現有方案不足。建議 60-100 字。',
      conclusionPlaceholder: '針對這題，整理關鍵需求 + 頻率/嚴重度/現有方案的不足...',
      conclusionExample: '最高頻痛點（每週觸發）：找不到感興趣的 podcast 主題（嚴重度高）；次高頻：訂閱的節目更新不穩定導致失聯（嚴重度中）；現有方案不足：首頁推薦過廣、缺乏基於收聽歷史的個人化。',
    },
    C2: {
      title: 'C · 優先排序',
      icebreakerText: '排序需求 — RICE / ICE / 戰略對齊。',
      conclusionSub: '排序 + RICE/ICE/戰略對齊摘要。',
      conclusionSubDesktop: '排序 + RICE/ICE/戰略對齊摘要。建議 60-100 字。',
      conclusionPlaceholder: '針對這題，整理排序邏輯 + 主要依據...',
      conclusionExample: '最優先（RICE 最高）：onboarding 個人化主題選擇流程（觸及全部新用戶 × 留存影響大 × 3 週可上線）；暫緩：下載離線功能（僅付費用戶受益，不符合本次範圍）。',
    },
    L: {
      title: 'L · 提出方案',
      icebreakerText: '列方案 — 至少 2-3 個獨立方案，包含明顯不同 mechanism。',
      conclusionSub: '列方案 + 每個方案核心 mechanism。',
      conclusionSubDesktop: '列方案 + 每個方案核心 mechanism。建議 80-120 字。',
      conclusionPlaceholder: '針對這題，整理你提出的方案 + 各方案核心機制...',
      conclusionExample: '方案 A：onboarding 主題問卷 — 新用戶首次開啟立即填 3 個興趣，系統生成專屬播放清單（mechanism：興趣信號冷啟動）；方案 B：社群跟隨機制 — 邀請好友或 influencer 的收聽清單（mechanism：social proof）；方案 C：週報推播 — 每週一封「你可能感興趣的 5 集」（mechanism：主動觸達）。',
    },
    E: {
      title: 'E · 評估取捨',
      icebreakerText: '評估每個方案 — 優點 / 缺點 / 風險 / 成功指標。',
      conclusionSub: '每個方案的優缺點/風險/成功指標摘要。',
      conclusionSubDesktop: '每個方案的優缺點/風險/成功指標摘要。建議 80-120 字。',
      conclusionPlaceholder: '針對這題，整理每個方案的優點、缺點、風險與成功指標...',
      conclusionExample: '方案 A 優：冷啟動立即有個人化；缺：問卷完成率可能低；風險：回答不誠實導致推薦偏差；成功指標：7 日留存 +7pp。方案 B 優：病毒擴散；缺：需要社群網路密度；風險：好友圈品味差異大。',
    },
    S: {
      title: 'S · 總結追蹤',
      icebreakerText: '總結並設定 tracking — 主推薦方案 + 4 維度追蹤。',
      conclusionSub: '主推薦方案 + 4 維度追蹤摘要。',
      conclusionSubDesktop: '主推薦方案 + 4 維度追蹤摘要。建議 80-120 字。',
      conclusionPlaceholder: '針對這題，整理主推薦方案 + 4 維度 tracking...',
      conclusionExample: '主推方案 A（onboarding 問卷）× 方案 C（週報推播）搭配。追蹤：(1) 留存 — 7 日 18%→25%；(2) 參與 — 問卷完成率 > 60%；(3) 轉化 — 播放清單播放率；(4) 健康 — podcast 取消訂閱率不上升。',
    },
  };

  // ── renderPhase2QchipHtml (shared helper) ─────────────────────────────────
  function renderPhase2QchipHtml(q) {
    var company = q.company || '';
    var product = q.product || '';
    var isDesktop = window.innerWidth >= 1024;
    var isDrill = AppState.circlesMode === 'drill';
    var companyBase = escHtml(company) + (product ? ' · ' + escHtml(product) : '');
    var qType = q.question_type === 'improve' ? '改善題' : q.question_type === 'strategy' ? '策略題' : '設計題';
    var companyDisplay;
    if (isDesktop) {
      companyDisplay = companyBase + '（Drill mode · ' + escHtml(qType) + '）';
    } else if (window.innerWidth >= 768) {
      companyDisplay = companyBase + (isDrill ? '（Drill · ' + escHtml(qType) + '）' : '');
    } else {
      companyDisplay = companyBase;
    }
    var qTitle = q.problem_statement || '';
    return '<button class="qchip" data-phase2="qchip">'
      + '<span class="qchip__icon"><i class="ph ph-bookmark-simple"></i></span>'
      + '<div class="qchip__main">'
      + '<div class="qchip__company">' + companyDisplay + '</div>'
      + '<div class="qchip__title">' + escHtml(qTitle) + '</div>'
      + '</div>'
      + '<i class="ph ph-caret-right qchip__caret"></i>'
      + '</button>';
  }

  // ── renderConclusionBox (Section E — mockup 05 line 1553-1575) ───────────
  function renderConclusionBox(stepKey) {
    var cfg = PHASE2_STEP_CONFIG[stepKey] || PHASE2_STEP_CONFIG.C1;
    var draft = AppState.circlesPhase2ConclusionDraft || '';
    var isOpen = AppState.circlesPhase2ExampleOpen;
    var isDesktop = window.innerWidth >= 1024;
    var subText = isDesktop ? escHtml(cfg.conclusionSubDesktop) : escHtml(cfg.conclusionSub);
    var meetsFloor = draft.trim().length >= 30;

    var exampleHtml = '<div class="conclusion-box__example' + (isOpen ? ' is-open' : '') + '">'
      + '<div class="conclusion-box__example-head" data-phase2="example-toggle">'
      + '<span class="conclusion-box__example-label">範例（不同題目）</span>'
      + '<span class="conclusion-box__example-toggle">' + (isOpen ? '收起 ▴' : '展開 ▾') + '</span>'
      + '</div>'
      + '<div class="conclusion-box__example-body">' + escHtml(cfg.conclusionExample) + '</div>'
      + '</div>';

    var rtFieldHtml = '<div class="rt-field">'
      + '<div class="rt-toolbar">'
      + '<button class="rt-tbtn" aria-label="粗體"><strong>B</strong></button>'
      + '<button class="rt-tbtn" aria-label="列點"><i class="ph ph-list-bullets"></i></button>'
      + '<button class="rt-tbtn" aria-label="增加縮排"><i class="ph ph-text-indent"></i></button>'
      + '<button class="rt-tbtn" aria-label="減少縮排"><i class="ph ph-text-outdent"></i></button>'
      + '</div>'
      + '<textarea class="rt-textarea" rows="4" placeholder="' + escHtml(cfg.conclusionPlaceholder) + '" data-phase2="conclusion-textarea">'
      + escHtml(draft)
      + '</textarea>'
      + '</div>';

    var actionsHtml = '<div class="conclusion-actions">'
      + '<button class="conclusion-actions__back" data-phase2="conclusion-back"><i class="ph ph-arrow-left"></i>繼續對話</button>'
      + '<button class="conclusion-actions__submit' + (meetsFloor ? '' : ' is-disabled') + '"'
      + (meetsFloor ? '' : ' disabled')
      + ' data-phase2="conclusion-submit">確認提交</button>'
      + '</div>';

    return '<div class="conclusion-box">'
      + '<div class="conclusion-box__title">整理你這個步驟確認了什麼</div>'
      + '<div class="conclusion-box__sub">' + subText + '</div>'
      + exampleHtml
      + rtFieldHtml
      + actionsHtml
      + '</div>';
  }

  function renderCirclesPhase2() {
    var q = AppState.circlesSelectedQuestion || {};
    var stepKey = AppState.circlesMode === 'drill'
      ? (AppState.circlesDrillStep || 'C1')
      : (['C1', 'I', 'R', 'C2', 'L', 'E', 'S'][AppState.circlesSimStep || 0] || 'C1');
    var phase2Cfg = PHASE2_STEP_CONFIG[stepKey] || PHASE2_STEP_CONFIG.C1;
    var conversation = AppState.circlesConversation || [];
    var turnCount = conversation.length;

    // ── Section F: locked (current step already scored) ──────────────────────
    var stepScores = AppState.circlesStepScores || {};
    if (stepScores[stepKey] && stepScores[stepKey].totalScore != null) {
      return renderCirclesPhase2Locked(q, stepKey, phase2Cfg, conversation, stepScores[stepKey]);
    }

    // ── progress bar (always visible in Phase 2 — mockup 05 shows it) ──
    var progressHtml = renderProgressBar(stepKey);
    var qchipHtml = renderPhase2QchipHtml(q);

    // ── Section E: conclusion mode (dim chat + conclusion box) ───────────────
    if (AppState.circlesPhase2ConclusionMode) {
      var metaHtmlE = '<div class="phase-head__meta">'
        + '<span class="phase-head__meta-extra--tablet-plus">' + turnCount + ' 輪 · 邊界已釐清</span>'
        + '<span class="phase-head__meta-sep phase-head__meta-extra--desktop">·</span>'
        + '<span class="phase-head__meta-extra--desktop">填完即進評分</span>'
        + '</div>';
      var phaseHeadHtmlE = '<div class="phase-head">'
        + '<span class="phase-head__num">2</span>'
        + '<div class="phase-head__main">'
        + '<div class="phase-head__eyebrow">Phase 2 · 整理結論</div>'
        + '<div class="phase-head__title">' + escHtml(phase2Cfg.title) + '</div>'
        + '</div>'
        + metaHtmlE
        + '</div>';

      // chat body dimmed
      var bubblesHtmlE = conversation.map(function (turn, idx) {
        return renderChatBubble(turn, idx);
      }).join('');
      var dimmedChatHtml = '<div class="chat-content chat-content--dimmed">'
        + '<div class="chat-body">' + bubblesHtmlE + '</div>'
        + '</div>';

      return '<div data-view="circles" data-phase="2">'
        + progressHtml
        + phaseHeadHtmlE
        + qchipHtml
        + dimmedChatHtml
        + renderConclusionBox(stepKey)
        + '</div>';
    }

    // ── Section C: streaming state ────────────────────────────────────────────
    var streaming = AppState.circlesPhase2Streaming;
    var streamTurn = AppState.circlesPhase2StreamingTurn;
    var streamError = AppState.circlesPhase2StreamError;

    // ── phase-head meta ──────────────────────────────────────────────────────
    var metaHtml;
    if (streaming) {
      metaHtml = '<div class="phase-head__meta">'
        + '<span class="phase-head__meta-extra--tablet-plus">' + (turnCount + 1) + ' 輪 · 等待回應中</span>'
        + '<span class="phase-head__meta-sep phase-head__meta-extra--desktop">·</span>'
        + '<span class="phase-head__meta-extra--desktop">已用 ' + Math.max(1, Math.round(turnCount * 3)) + ' 分鐘</span>'
        + '<span class="phase-head__meta-sep phase-head__meta-extra--desktop">·</span>'
        + '<span class="phase-head__meta-extra--desktop">等待被訪談者回應...</span>'
        + '</div>';
    } else if (turnCount >= 3) {
      metaHtml = '<div class="phase-head__meta">'
        + '<span class="phase-head__meta-extra--tablet-plus">' + turnCount + ' 輪 · 可結束</span>'
        + '<span class="phase-head__meta-sep phase-head__meta-extra--desktop">·</span>'
        + '<span class="phase-head__meta-extra--desktop">已用 ' + Math.max(1, Math.round(turnCount * 3)) + ' 分鐘</span>'
        + '<span class="phase-head__meta-sep phase-head__meta-extra--desktop">·</span>'
        + '<span class="phase-head__meta-extra--desktop">邊界已釐清，可進結論</span>'
        + '</div>';
    } else if (turnCount > 0) {
      metaHtml = '<div class="phase-head__meta">'
        + '<span class="phase-head__meta-extra--tablet-plus">' + turnCount + ' 輪對話</span>'
        + '<span class="phase-head__meta-sep phase-head__meta-extra--desktop">·</span>'
        + '<span class="phase-head__meta-extra--desktop">已用 ' + Math.max(1, Math.round(turnCount * 3)) + ' 分鐘</span>'
        + '<span class="phase-head__meta-sep phase-head__meta-extra--desktop">·</span>'
        + '<span class="phase-head__meta-extra--desktop">建議 5-10 輪</span>'
        + '</div>';
    } else {
      metaHtml = '<div class="phase-head__meta">'
        + '<span class="phase-head__meta-extra--desktop">建議 5-10 輪對話 · 隨時可暫停</span>'
        + '</div>';
    }

    var phaseHeadHtml = '<div class="phase-head">'
      + '<span class="phase-head__num">2</span>'
      + '<div class="phase-head__main">'
      + '<div class="phase-head__eyebrow">PHASE 2 · 對話練習</div>'
      + '<div class="phase-head__title">' + escHtml(phase2Cfg.title) + '</div>'
      + '</div>'
      + metaHtml
      + '</div>';

    // ── chat-body ─────────────────────────────────────────────────────────────
    var chatBodyHtml;
    if (turnCount === 0 && !streaming) {
      // Section A: empty + icebreaker
      chatBodyHtml = '<div class="chat-content">'
        + '<div class="chat-body">'
        + '<div class="icebreaker">'
        + '<div class="icebreaker__label"><i class="ph ph-compass"></i>開始提問方向</div>'
        + '<div class="icebreaker__text">' + escHtml(phase2Cfg.icebreakerText) + '</div>'
        + '</div>'
        + '</div>'
        + '</div>';
    } else {
      // Section B/C/D: conversation bubbles
      var bubblesHtml = conversation.map(function (turn, idx) {
        return renderChatBubble(turn, idx);
      }).join('');

      // Section C: append streaming bubble at end (B2 typewriter — mockup 05 §G LOCKED)
      if (streaming && streamTurn) {
        var userStreamBubble = '<div class="bubble bubble--user">' + escHtml(streamTurn.userMessage || '') + '</div>';
        // Show interviewee 3-dot while no chars received yet; switch to coach typewriter once chars flow
        var displayedChars = streamTurn.displayedChars || 0;
        var streamingBubble;
        if (displayedChars === 0) {
          // Pre-text: interviewee 3-dot waiting indicator
          streamingBubble = '<div class="bubble bubble--interviewee">'
            + '<div class="bubble__section">被訪談者</div>'
            + '<span class="bubble__streaming"><span></span><span></span><span></span></span>'
            + '</div>';
        } else {
          // Typewriter coach bubble: partial deltaText + cursor
          var visibleText = escHtml((streamTurn.deltaText || '').slice(0, displayedChars));
          var cursorClass = streamTurn.isDone ? ' is-done' : '';
          streamingBubble = '<div class="bubble bubble--coach">'
            + '<div class="bubble__section"><i class="ph ph-graduation-cap"></i>教練點評</div>'
            + '<div class="bubble__body">'
            + visibleText
            + '<span class="bubble-coach__cursor' + cursorClass + '"></span>'
            + '</div>'
            + '</div>';
        }
        bubblesHtml += userStreamBubble + streamingBubble;
      }

      // Section C error: inline error banner
      var errorBannerHtml = '';
      if (streamError && streamTurn) {
        errorBannerHtml = '<div class="phase2-stream-error">'
          + '<i class="ph ph-warning-circle"></i>'
          + '<span>回應失敗，請重新發送。</span>'
          + '<button class="phase2-stream-error__retry" data-phase2="retry">重新發送</button>'
          + '</div>';
      }

      chatBodyHtml = '<div class="chat-content">'
        + '<div class="chat-body">' + bubblesHtml + '</div>'
        + errorBannerHtml
        + '</div>';
    }

    // ── back button row ──────────────────────────────────────────────────────
    var backRowHtml = '<div class="phase-back-row">'
      + '<button class="btn btn--ghost" data-phase2="back"><i class="ph ph-arrow-left"></i>上一步</button>'
      + '</div>';

    // ── input bar ─────────────────────────────────────────────────────────────
    // Section D: turns ≥ 3 + not streaming → show submit pill above input
    var suggestHtml = '';
    if (turnCount >= 3 && !streaming && !AppState.circlesPhase2ConclusionMode) {
      suggestHtml = '<div class="input-bar__suggest">'
        + '<button class="submit-row__btn" data-phase2="conclude">對話足夠了，提交這個步驟 <i class="ph ph-arrow-right"></i></button>'
        + '</div>';
    }

    // Section C: disabled input placeholder changes
    var minTipHtml = '';
    var inputDisabled = streaming ? ' disabled' : '';
    var inputPlaceholder = streaming ? '等待回應中...' : '輸入你的問題...';
    var sendDisabled = streaming ? ' disabled' : '';
    var sendClass = streaming ? ' is-locked' : '';

    var inputBarHtml = '<div class="input-bar">'
      + suggestHtml
      + '<div class="input-bar__row">'
      + '<textarea class="input-bar__textarea" placeholder="' + inputPlaceholder + '" rows="1"'
      + inputDisabled
      + ' data-phase2="message-input"></textarea>'
      + '<button class="input-bar__send' + sendClass + '" aria-label="' + (streaming ? '等待中' : '送出') + '"'
      + sendDisabled
      + ' data-phase2="send"><i class="ph ph-paper-plane-tilt"></i></button>'
      + '</div>'
      + '<div class="phase2-min-tip" style="display:none" data-phase2="min-tip">至少 5 字</div>'
      + '</div>';

    return '<div data-view="circles" data-phase="2">'
      + progressHtml
      + phaseHeadHtml
      + qchipHtml
      + chatBodyHtml
      + backRowHtml
      + inputBarHtml
      + '</div>';
  }
  window.renderCirclesPhase2 = renderCirclesPhase2;

  // ── renderCirclesPhase2Locked (Section F — mockup 05 line 1740-1943) ──────
  function renderCirclesPhase2Locked(q, stepKey, phase2Cfg, conversation, scoreData) {
    var progressHtml = renderProgressBar(stepKey);
    var qchipHtml = renderPhase2QchipHtml(q);
    var totalScore = scoreData && scoreData.totalScore;

    // phase-head with 已評分 suffix
    var metaHtml = '<div class="phase-head__meta">'
      + '<span class="phase-head__meta-extra--tablet-plus">' + (conversation.length) + ' 輪對話 · 已評分</span>'
      + (totalScore != null
        ? '<span class="phase-head__meta-sep phase-head__meta-extra--desktop">·</span>'
          + '<span class="phase-head__meta-extra--desktop">當次得分 ' + totalScore + '</span>'
        : '')
      + '</div>';
    var phaseHeadHtml = '<div class="phase-head">'
      + '<span class="phase-head__num">2</span>'
      + '<div class="phase-head__main">'
      + '<div class="phase-head__eyebrow">Phase 2 · 對話練習（已評分）</div>'
      + '<div class="phase-head__title">' + escHtml(phase2Cfg.title) + '</div>'
      + '</div>'
      + metaHtml
      + '</div>';

    // locked-banner (mockup 05 line 1767-1770)
    var isDesktop = window.innerWidth >= 1024;
    var lockedBody = '<strong>此步驟已評分。</strong>對話保留供 review，無法繼續'
      + (isDesktop ? ' — 想重練請從首頁選同類題目重新開始。' : '。');
    var lockedBannerHtml = '<div class="locked-banner">'
      + '<i class="ph ph-lock-simple"></i>'
      + '<div>' + lockedBody + '</div>'
      + '</div>';

    // chat body — read-only (no editing affordance)
    var bubblesHtml = conversation.map(function (turn, idx) {
      return renderChatBubble(turn, idx);
    }).join('');
    var chatBodyHtml = '<div class="chat-content">'
      + '<div class="chat-body">' + bubblesHtml + '</div>'
      + '</div>';

    // 2-button submit-bar (mockup 05 line 1792-1799)
    var submitBarHtml = '<div class="submit-bar">'
      + '<div class="submit-bar__left">'
      + '<button class="btn btn--ghost" data-phase2="go-phase1"><i class="ph ph-arrow-left"></i>上一步（看框架）</button>'
      + '</div>'
      + '<div class="submit-bar__right">'
      + '<button class="btn btn--primary" data-phase2="go-phase3">回評分</button>'
      + '</div>'
      + '</div>';

    return '<div data-view="circles" data-phase="2">'
      + progressHtml
      + phaseHeadHtml
      + lockedBannerHtml
      + qchipHtml
      + chatBodyHtml
      + submitBarHtml
      + '</div>';
  }

  // ── renderChatBubble (Phase 2 — 3 role types per turn) ───────────────────
  function renderChatBubble(turn, idx) {
    var hintExpanded = AppState.circlesPhase2CoachHintExpanded && AppState.circlesPhase2CoachHintExpanded[idx];
    var hintToggleText = hintExpanded
      ? '<i class="ph ph-caret-down"></i>收起教練提示'
      : '<i class="ph ph-caret-right"></i>查看教練提示';
    var hintContentHtml = hintExpanded && turn.hint
      ? '<div class="bubble--coach__hint-content">' + escHtml(turn.hint) + '</div>'
      : '';

    var userBubble = '<div class="bubble bubble--user">' + escHtml(turn.userMessage || '') + '</div>';
    var intervieweeBubble = '<div class="bubble bubble--interviewee">'
      + '<div class="bubble__section">被訪談者</div>'
      + escHtml(turn.interviewee || '')
      + '</div>';
    var coachBubble = '<div class="bubble bubble--coach">'
      + '<div class="bubble__section"><i class="ph ph-graduation-cap"></i>教練點評</div>'
      + escHtml(turn.coaching || '')
      + (turn.hint
          ? '<button class="bubble--coach__hint-toggle" data-phase2="hint-toggle" data-turn-idx="' + idx + '" aria-expanded="' + (hintExpanded ? 'true' : 'false') + '">'
            + hintToggleText
            + '</button>'
          : '')
      + hintContentHtml
      + '</div>';

    return userBubble + intervieweeBubble + coachBubble;
  }
  window.renderChatBubble = renderChatBubble;

  // ── B2 typewriter char-queue (mockup 05 §G LOCKED contract) ─────────────
  // 30-40 chars/sec throttle: ~28ms per char using plain setTimeout.
  // Simple queue: advance displayedChars one step, re-render, schedule next tick.
  var _b2QueueTimer = null;

  function _b2TickCharQueue() {
    if (!AppState.circlesPhase2StreamingTurn || !AppState.circlesPhase2Streaming) { _b2QueueTimer = null; return; }
    var turn = AppState.circlesPhase2StreamingTurn;
    var fullLen = (turn.deltaText || '').length;
    var displayed = turn.displayedChars || 0;
    if (displayed >= fullLen) { _b2QueueTimer = null; return; } // wait for more deltas
    turn.displayedChars = displayed + 1;
    render();
    _b2QueueTimer = setTimeout(_b2TickCharQueue, 28);
  }

  // Exposed for tests: allow external code to kick-start the queue
  window._b2StartCharQueue = function () {
    if (!_b2QueueTimer) _b2QueueTimer = setTimeout(_b2TickCharQueue, 28);
  };

  // ── streamCirclesMessage (SSE wire-up — Task B1) ──────────────────────────
  // Uses fetch + ReadableStream (not EventSource) to allow POST body + auth headers.
  window._phase2AbortController = null;

  async function streamCirclesMessage(userMessage) {
    var sessionId = AppState.circlesSession && AppState.circlesSession.id;
    if (!sessionId) return;

    // Abort any previous in-flight stream
    if (window._phase2AbortController) {
      try { window._phase2AbortController.abort(); } catch (_) {}
    }
    var ctrl = new AbortController();
    window._phase2AbortController = ctrl;

    var basePath = AppState.accessToken
      ? '/api/circles-sessions/'
      : '/api/guest-circles-sessions/';
    var url = basePath + sessionId + '/message';

    var headers = { 'Content-Type': 'application/json' };
    if (AppState.accessToken) headers['Authorization'] = 'Bearer ' + AppState.accessToken;
    else if (AppState.guestId) headers['X-Guest-ID'] = AppState.guestId;

    try {
      var response = await fetch(url, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({ userMessage: userMessage }),
        signal: ctrl.signal,
      });

      if (!response.ok) {
        throw new Error('HTTP ' + response.status);
      }

      var reader = response.body.getReader();
      var decoder = new TextDecoder();
      var buffer = '';

      while (true) {
        var result = await reader.read();
        if (result.done) break;

        buffer += decoder.decode(result.value, { stream: true });

        // Process complete SSE lines from buffer
        var lines = buffer.split('\n');
        buffer = lines.pop(); // keep incomplete last line

        for (var i = 0; i < lines.length; i++) {
          var line = lines[i].trim();
          if (!line.startsWith('data: ')) continue;
          var jsonStr = line.slice(6);
          if (!jsonStr) continue;

          var parsed;
          try { parsed = JSON.parse(jsonStr); } catch (_) { continue; }

          if (parsed.delta !== undefined) {
            // accumulate delta text
            if (!AppState.circlesPhase2StreamingTurn) {
              AppState.circlesPhase2StreamingTurn = { userMessage: userMessage, deltaText: '', displayedChars: 0 };
            }
            AppState.circlesPhase2StreamingTurn.deltaText = (AppState.circlesPhase2StreamingTurn.deltaText || '') + parsed.delta;
            // B2: kick off per-char throttle queue (28ms/char ≈ 35 chars/sec)
            if (!_b2QueueTimer) _b2QueueTimer = setTimeout(_b2TickCharQueue, 28);
          } else if (parsed.done && parsed.turn) {
            // SSE complete — flush remaining chars instantly, then commit turn
            if (_b2QueueTimer) { clearTimeout(_b2QueueTimer); _b2QueueTimer = null; }
            if (AppState.circlesPhase2StreamingTurn) {
              AppState.circlesPhase2StreamingTurn.displayedChars = (AppState.circlesPhase2StreamingTurn.deltaText || '').length;
              AppState.circlesPhase2StreamingTurn.isDone = true;
              render(); // show full text + cursor.is-done briefly
            }
            // Small delay so user sees cursor.is-done before bubble transitions
            setTimeout(function () {
              AppState.circlesConversation = (AppState.circlesConversation || []).concat([parsed.turn]);
              AppState.circlesPhase2Streaming = false;
              AppState.circlesPhase2StreamingTurn = null;
              AppState.circlesPhase2StreamError = false;
              render();
              // Scroll chat body to bottom
              setTimeout(function () {
                var chatBody = document.querySelector('.chat-body');
                if (chatBody) chatBody.lastElementChild && chatBody.lastElementChild.scrollIntoView({ block: 'end' });
              }, 50);
            }, 300);
            return;
          } else if (parsed.error !== undefined) {
            AppState.circlesPhase2Streaming = false;
            AppState.circlesPhase2StreamError = true;
            render();
            return;
          }
        }
      }
    } catch (e) {
      if (e.name === 'AbortError') {
        // Clean up typewriter timer on abort (iOS Safari: prevent stale timer firing after navigation)
        if (_b2QueueTimer) { clearTimeout(_b2QueueTimer); _b2QueueTimer = null; }
        return;
      }
      AppState.circlesPhase2Streaming = false;
      AppState.circlesPhase2StreamError = true;
      render();
    }
  }
  window.streamCirclesMessage = streamCirclesMessage;

  function renderNSM() {
    if (AppState.nsmStep === 1) return renderNSMStep1();
    if (AppState.nsmStep === 2) return renderNSMStep2();
    if (AppState.nsmStep === 3) return renderNSMStep3();
    if (AppState.nsmStep === 4) return renderNSMStep4();
    return renderNSMStep1();
  }

  function renderNSMStep2() {
    // Gate subtab: show loading / error / result inline
    var st = AppState.nsmSubTab || 'nsm-step2';
    if (st === 'nsm-gate') return renderNSMGate();

    var q = AppState.nsmSelectedQuestion || {};
    var ptype = nsmGuessProductType(q);
    var typeCfg = getNsmDimConfig(ptype);
    var def = AppState.nsmDefinition || { nsm: '', explanation: '', businessLink: '' };
    var canSubmit = fieldMinLengthOk(def.nsm, 10) && fieldMinLengthOk(def.explanation, 30) && fieldMinLengthOk(def.businessLink, 30);
    var html = '<div data-view="nsm">'
      + '<div class="phase-head">'
      +   '<span class="phase-head__num">2</span>'
      +   '<div class="phase-head__main">'
      +     '<div class="phase-head__eyebrow">NSM · 北極星訓練</div>'
      +     '<div class="phase-head__title">定義 NSM</div>'
      +   '</div>'
      + '</div>'
      + renderNSMProgress(2)
      + '<div class="nsm-body">'
      +   renderNSMContextCard(q, typeCfg)
      +   renderNSMGuide()
      +   renderNSMField('nsm', '北極星指標 (NSM)', def.nsm, /*isSingle*/ true)
      +   renderNSMField('explanation', '定義說明', def.explanation, false)
      +   renderNSMField('businessLink', '與業務目標連結', def.businessLink, false)
      + '</div>'
      + '<div class="submit-bar">'
      +   '<div class="submit-bar__left"><button class="btn btn--ghost" data-nsm-action="back"><i class="ph ph-arrow-left"></i>上一步</button></div>'
      +   '<div class="submit-bar__right"><button class="btn btn--primary" data-nsm-submit ' + (canSubmit ? '' : 'disabled') + '>提交審核<i class="ph ph-arrow-right"></i></button></div>'
      + '</div></div>';
    return applyNSMStateOverlay(html, 2);
  }

  // Loading checklist steps — mockup 08 §D verbatim
  var NSM_GATE_LOADING_STEPS = [
    '解析 NSM 語意',
    '對齊產品價值',
    '檢查領先性',
    '評估操作性',
  ];

  function renderNSMGateItem(item) {
    var statusIcon, cls;
    if (item.status === 'ok') {
      cls = 'gate-item--ok';
      statusIcon = '<i class="ph-fill ph-check-circle gate-item__icon"></i>';
    } else if (item.status === 'warn') {
      cls = 'gate-item--warn';
      statusIcon = '<i class="ph-fill ph-warning gate-item__icon"></i>';
    } else {
      cls = 'gate-item--error';
      statusIcon = '<i class="ph-fill ph-x-circle gate-item__icon"></i>';
    }
    var suggestionHtml = '';
    if (item.suggestion) {
      var suggestLabel = item.status === 'error' ? '修正方向：' : '建議：';
      suggestionHtml = '<div class="gate-item__suggestion"><strong>' + escHtml(suggestLabel) + '</strong>'
        + '<span class="gate-item__suggestion-body">' + escHtml(item.suggestion) + '</span></div>';
    }
    return '<div class="gate-item ' + cls + '">'
      + statusIcon
      + '<div class="gate-item__main">'
      +   '<div class="gate-item__field">' + escHtml(item.criterion) + '</div>'
      +   '<div class="gate-item__title">' + escHtml(item.title || '') + '</div>'
      +   '<div class="gate-item__reason">' + escHtml(item.feedback || item.comment || '') + '</div>'
      +   suggestionHtml
      + '</div>'
      + '</div>';
  }

  function renderNSMGateCountLabel(items) {
    var errCount = 0, warnCount = 0, okCount = 0;
    (items || []).forEach(function (it) {
      if (it.status === 'error') errCount++;
      else if (it.status === 'warn') warnCount++;
      else okCount++;
    });
    var total = (items || []).length;
    if (errCount === 0 && warnCount === 0) return total + ' / ' + total + ' OK';
    var parts = [];
    if (errCount > 0) parts.push(errCount + ' ERROR');
    if (warnCount > 0) parts.push(warnCount + ' WARN');
    if (okCount > 0) parts.push(okCount + ' OK');
    return parts.join(' · ');
  }

  function renderNSMGate() {
    var q = AppState.nsmSelectedQuestion || {};
    var def = AppState.nsmDefinition || {};
    var result = AppState.nsmGateResult;
    var isLoading = AppState.nsmGateLoading;
    var gateError = AppState.nsmGateError;
    var loadingStep = AppState.nsmGateLoadingStep || 0;

    var phaseNumHtml = '<span class="phase-head__num">2.5</span>';
    var phaseMainHtml = '<div class="phase-head__main">'
      + '<div class="phase-head__eyebrow">NSM · 北極星訓練</div>'
      + '<div class="phase-head__title">NSM 品質審核</div>'
      + '</div>';

    var html = '<div data-view="nsm">'
      + '<div class="phase-head">'
      +   phaseNumHtml
      +   phaseMainHtml
      + '</div>'
      + '<div class="gate-content">';

    // Loading state
    if (isLoading) {
      html += '<div class="gate-loading-wrap">'
        + '<div class="gate-spinner"></div>'
        + '<div class="gate-loading-title">AI 正在審核你的 NSM 定義</div>'
        + '<div class="gate-loading-sub">4 維度全檢核中，需要約 8-12 秒。請勿關閉本頁。</div>'
        + '<div class="gate-loading-checklist">';
      NSM_GATE_LOADING_STEPS.forEach(function (label, idx) {
        var stepCls, iconHtml;
        if (idx < loadingStep) {
          stepCls = 'is-done';
          iconHtml = '<span class="gate-loading-step__icon"><i class="ph ph-check"></i></span>';
        } else if (idx === loadingStep) {
          stepCls = 'is-active';
          iconHtml = '<span class="gate-loading-step__icon"><i class="ph ph-circle-notch ph-spin"></i></span>';
        } else {
          stepCls = 'is-pending';
          iconHtml = '<span class="gate-loading-step__icon"><i class="ph ph-circle"></i></span>';
        }
        html += '<div class="gate-loading-step ' + stepCls + '">' + iconHtml + escHtml(label) + '</div>';
      });
      html += '</div></div></div></div>';
      return html;
    }

    // Gate API error state
    if (gateError && !result) {
      html += '<div class="gate-wrap">'
        + '<div class="nsm-gate-error-wrap">'
        +   '<div class="banner banner--save-error">'
        +     '<i class="ph ph-cloud-warning"></i>'
        +     '<span>審核服務暫時無法使用，請重試。</span>'
        +   '</div>'
        + '</div>'
        + '</div></div>'
        + '<div class="submit-bar">'
        +   '<div class="submit-bar__left"><button class="btn btn--ghost" data-nsm-gate-action="back-to-step2"><i class="ph ph-arrow-left"></i>返回修改</button></div>'
        + '</div>'
        + '</div>';
      return html;
    }

    // Gate result state (ok / warn / error)
    if (result) {
      var os = result.overall_status || result.overallStatus || 'error';
      var items = result.items || [];
      var canProceed = result.canProceed !== false && (os === 'ok' || os === 'warn');

      // transition bar
      var transitionCls, transitionIcon, transitionTitle, transitionSub;
      var okCount = items.filter(function (i) { return i.status === 'ok'; }).length;
      var errCount = items.filter(function (i) { return i.status === 'error'; }).length;
      if (os === 'ok') {
        transitionCls = 'gate-transition--ok';
        transitionIcon = '<i class="ph-fill ph-check-circle gate-transition__icon"></i>';
        transitionTitle = 'NSM 定義通過審核';
        transitionSub = items.length + ' / ' + items.length + ' 條件達標 — 可以進入拆解指標';
      } else if (os === 'warn') {
        transitionCls = 'gate-transition--warn';
        transitionIcon = '<i class="ph-fill ph-check-circle gate-transition__icon"></i>';
        transitionTitle = '通過審核（附提醒）';
        var warnCount = items.filter(function (i) { return i.status === 'warn'; }).length;
        transitionSub = okCount + ' / ' + items.length + ' 達標 · ' + warnCount + ' 項可優化 — 可以進入拆解指標';
      } else {
        transitionCls = 'gate-transition--error';
        transitionIcon = '<i class="ph-fill ph-x-circle gate-transition__icon"></i>';
        transitionTitle = '需要修正方向';
        transitionSub = errCount + ' 項根本性問題 — 請回上一步重新定義 NSM';
      }

      var countLabel = renderNSMGateCountLabel(items);

      html += '<div class="gate-wrap">'
        + '<div class="gate-transition ' + transitionCls + '">'
        +   transitionIcon
        +   '<div class="gate-transition__main">'
        +     '<div class="gate-transition__title">' + transitionTitle + '</div>'
        +     '<div class="gate-transition__sub">' + transitionSub + '</div>'
        +   '</div>'
        + '</div>'
        + '<div class="gate-summary">'
        +   '<div class="gate-summary__row"><strong>公司：</strong><span>' + escHtml((q.company || '') + (q.industry ? ' · ' + q.industry : '')) + '</span></div>'
        +   '<div class="gate-summary__row"><strong>你的 NSM：</strong><span>' + escHtml(def.nsm || '') + '</span></div>'
        + '</div>'
        + '<div class="gate-section-label">' + items.length + ' 維度檢核<span class="gate-section-label__count">' + countLabel + '</span></div>'
        + '<div class="gate-list">'
        +   items.map(renderNSMGateItem).join('')
        + '</div>'
        + '</div></div>';

      // submit-bar
      if (canProceed) {
        html += '<div class="submit-bar">'
          + '<div class="submit-bar__left"><button class="btn btn--ghost" data-nsm-gate-action="back-to-step2"><i class="ph ph-arrow-left"></i>上一步</button></div>'
          + '<div class="submit-bar__right"><button class="btn btn--primary" data-nsm-gate-action="proceed">繼續到 步驟 3<i class="ph ph-arrow-right"></i></button></div>'
          + '</div>';
      } else {
        // error —唯一動作「上一步修改」（無 ghost、無繼續、無 override）
        html += '<div class="submit-bar" style="justify-content:flex-end">'
          + '<div class="submit-bar__right"><button class="btn btn--primary" data-nsm-gate-action="back-to-step2"><i class="ph ph-arrow-left"></i>上一步修改</button></div>'
          + '</div>';
      }
      html += '</div>';
      return html;
    }

    // Fallback: no result, no loading, no error — shouldn't normally hit this
    html += '</div></div>';
    return html;
  }

  function renderNSMField(fieldId, label, value, isSingle) {
    var q = AppState.nsmSelectedQuestion || {};
    var examples = (q.field_examples && q.field_examples.step2) || {};
    var exampleText = examples[fieldId] || '';
    var isOpen = !!(AppState.nsmExampleExpanded && AppState.nsmExampleExpanded[fieldId]);
    var ariaExpanded = isOpen ? 'true' : 'false';
    var caretStyle = isOpen ? ' style="transform:rotate(180deg)"' : '';

    var inputHtml = isSingle
      ? '<input class="nsm-input" data-nsm-field="' + fieldId + '" placeholder="..." value="' + escHtml(value || '') + '">'
      : '<div class="nsm-rt-field"><div class="nsm-rt-toolbar">'
        + '<button class="nsm-rt-tbtn" data-rt-cmd="bold" title="粗體"><strong>B</strong></button>'
        + '<button class="nsm-rt-tbtn" data-rt-cmd="insertUnorderedList" title="列點"><i class="ph ph-list-bullets"></i></button>'
        + '</div><div class="nsm-rt-textarea" contenteditable="true" data-nsm-field="' + fieldId + '">' + (value || '') + '</div></div>';

    var expandHtml = '';
    if (isOpen && exampleText) {
      expandHtml = '<div class="example-expand" aria-hidden="false" data-nsm-example-key="' + escHtml(fieldId) + '">'
        + '<div class="example-expand__head">'
        +   '<div class="example-expand__title"><i class="ph ph-quotes"></i>範例答案</div>'
        +   '<button class="example-expand__close" data-nsm-example-close="' + escHtml(fieldId) + '" aria-label="收合"><i class="ph ph-x"></i></button>'
        + '</div>'
        + '<ul class="example-list">' + markdownBulletsToHtml(exampleText) + '</ul>'
        + '</div>';
    }

    var exampleBtnHtml = exampleText
      ? '<button class="field-example-toggle" type="button" data-nsm-example-toggle="' + escHtml(fieldId) + '" aria-expanded="' + ariaExpanded + '">'
        + '<i class="ph ph-quotes"></i>範例答案<i class="ph ph-caret-down toggle-caret"' + caretStyle + '></i>'
        + '</button>'
      : '<button class="field-example-toggle" type="button" data-nsm-example-toggle="' + escHtml(fieldId) + '" aria-expanded="false" disabled title="此題暫無範例答案">'
        + '<i class="ph ph-quotes"></i>範例答案'
        + '</button>';

    return '<div class="nsm-field">'
      + '<div class="field__label-row">'
      +   '<label class="field__label">' + escHtml(label) + '</label>'
      +   '<div class="field__hint-row">'
      +     '<button class="field__hint-link" type="button" data-nsm-hint="' + escHtml(fieldId) + '">'
      +       '<i class="ph ph-lightbulb"></i>提示'
      +     '</button>'
      +     exampleBtnHtml
      +   '</div>'
      + '</div>'
      + inputHtml
      + expandHtml
      + '</div>';
  }

  function renderNSMGuide() {
    return '<div class="nsm-guide">'
      + '<div class="nsm-guide__title"><i class="ph ph-path"></i>3 步定義法</div>'
      + '<div class="nsm-guide__step"><span class="nsm-guide__num">1</span><div class="nsm-guide__body"><strong>找 AHA 時刻</strong><p>用戶第一次真正感受到產品價值的那個動作是什麼？</p></div></div>'
      + '<div class="nsm-guide__step"><span class="nsm-guide__num">2</span><div class="nsm-guide__body"><strong>轉成可量化指標</strong><p>把那個動作表達成「誰 × 做了什麼行為 × 多少量/頻率」的具體數字。</p></div></div>'
      + '<div class="nsm-guide__step"><span class="nsm-guide__num">3</span><div class="nsm-guide__body"><strong>做虛榮指標檢驗</strong><p>問自己：這個指標是否真的能如實反映「用戶體會到產品價值」？</p></div></div>'
      + '</div>';
  }

  function renderNSMContextCard(q, typeCfg) {
    // Bug A fix: fall back to AppState.nsmContext when q.context lacks pregenerated data
    var ctxSrc = getNsmContextSource(q, AppState.nsmContext, _nsmContextQid);
    var ctx = ctxSrc === 'pregenerated' ? (q.context || {})
            : ctxSrc === 'cached'      ? (AppState.nsmContext || {})
            : {};
    var expanded = !!AppState.nsmContextExpanded;
    var caret = expanded ? 'ph-caret-up' : 'ph-caret-down';
    var toggleLabel = expanded ? '收合' : '深入了解問題';

    var expandBlock = '';
    if (expanded) {
      var hasCtxData = !!(ctx.model || ctx.users || ctx.traps || ctx.insight);
      var anaHtml = hasCtxData
        ? '<div class="nsm-context-card__ana">'
          +   '<div class="nsm-context-card__ana-block">'
          +     '<div class="nsm-context-card__ana-head"><i class="ph ph-buildings"></i>商業模式</div>'
          +     '<div class="nsm-context-card__ana-body">' + escHtml(ctx.model || '') + '</div>'
          +   '</div>'
          +   '<div class="nsm-context-card__ana-block">'
          +     '<div class="nsm-context-card__ana-head"><i class="ph ph-users"></i>使用者</div>'
          +     '<div class="nsm-context-card__ana-body">' + escHtml(ctx.users || '') + '</div>'
          +   '</div>'
          +   '<div class="nsm-context-card__ana-block nsm-context-card__ana-block--trap">'
          +     '<div class="nsm-context-card__ana-head"><i class="ph ph-warning"></i>常見陷阱</div>'
          +     '<div class="nsm-context-card__ana-body">' + escHtml(ctx.traps || '') + '</div>'
          +   '</div>'
          +   '<div class="nsm-context-card__ana-block">'
          +     '<div class="nsm-context-card__ana-head"><i class="ph ph-lightbulb"></i>破題切入</div>'
          +     '<div class="nsm-context-card__ana-body">' + escHtml(ctx.insight || '') + '</div>'
          +   '</div>'
          + '</div>'
        : '<div class="nsm-context-card__ana-empty">此題暫無深入背景資料</div>';
      expandBlock = '<div class="nsm-context-card__expand">'
        + '<div class="nsm-context-card__expand-label">深入分析</div>'
        + anaHtml
        + '</div>';
    }

    return '<div class="nsm-context-card">'
      + '<div class="nsm-context-card__top">'
      +   '<span class="nsm-context-card__company">' + escHtml(q.company || '') + '</span>'
      +   '<span class="nsm-context-card__industry">' + escHtml(q.industry || '') + '</span>'
      +   '<span class="nsm-context-card__type ' + typeCfg.typeClass + '"><i class="ph ' + typeCfg.typeIcon + '"></i>' + escHtml(typeCfg.label) + '</span>'
      + '</div>'
      + '<p class="nsm-context-card__scenario">' + escHtml(q.scenario || '') + '</p>'
      + '<button class="nsm-context-card__expand-toggle" data-nsm="context-toggle">'
      +   '<i class="ph ' + caret + '"></i>' + toggleLabel
      + '</button>'
      + expandBlock
      + '</div>';
  }

  function renderNSMStep3() {
    var q = AppState.nsmSelectedQuestion || {};
    var ptype = nsmGuessProductType(q);
    var typeCfg = getNsmDimConfig(ptype);
    var br = AppState.nsmBreakdown || {};
    var canSubmit = typeCfg.dims.every(function (d) { return fieldMinLengthOk(br[d.id], 20); });
    var html = '<div data-view="nsm">'
      + '<div class="phase-head">'
      +   '<span class="phase-head__num">3</span>'
      +   '<div class="phase-head__main">'
      +     '<div class="phase-head__eyebrow">NSM · 北極星訓練</div>'
      +     '<div class="phase-head__title">拆解輸入指標</div>'
      +   '</div>'
      + '</div>'
      + renderNSMProgress(3)
      + '<div class="nsm-body">'
      +   renderNSMContextCard(q, typeCfg)
      +   '<div class="nsm-step3-banner"><i class="ph ph-target"></i><strong>你的 NSM：</strong>' + escHtml((AppState.nsmDefinition || {}).nsm || '') + '</div>'
      +   '<div class="nsm-step3-intro">'
      +     '<div class="nsm-step3-intro__top">'
      +       '<span class="nsm-step3-intro__type nsm-step3-intro__type--' + ptype + '"><i class="ph ' + typeCfg.typeIcon + '"></i>' + escHtml(typeCfg.label) + '</span>'
      +     '</div>'
      +     '<p>輸入指標是驅動 NSM 的<strong>領先訊號</strong>——這些指標翻倍，NSM 應該跟著成長。以下 4 個維度依 <strong>' + escHtml(typeCfg.label) + '</strong> 產品特性設計。</p>'
      +   '</div>'
      +   typeCfg.dims.map(function (d) { return renderNSMDim(d, br[d.id] || '', ptype); }).join('')
      + '</div>'
      + '<div class="submit-bar">'
      +   '<div class="submit-bar__left"><button class="btn btn--ghost" data-nsm-action="back-to-step2"><i class="ph ph-arrow-left"></i>上一步</button></div>'
      +   '<div class="submit-bar__right"><button class="btn btn--primary" data-nsm-submit ' + (canSubmit ? '' : 'disabled') + '>送出，取得 AI 評分<i class="ph ph-arrow-right"></i></button></div>'
      + '</div></div>';
    return applyNSMStateOverlay(html, 3);
  }

  function renderNSMDim(dim, value, ptype) {
    // Example expand from q.field_examples.step3[dim.id]
    var q = AppState.nsmSelectedQuestion || {};
    var step3Examples = (q.field_examples && q.field_examples.step3) || {};
    var exampleText = step3Examples[dim.id] || '';
    var isDimExOpen = !!(AppState.nsmDimExampleExpanded && AppState.nsmDimExampleExpanded[dim.id]);
    var dimExAriaExpanded = isDimExOpen ? 'true' : 'false';
    var dimExCaretStyle = isDimExOpen ? ' style="transform:rotate(180deg)"' : '';

    var dimExpandHtml = '';
    if (isDimExOpen && exampleText) {
      dimExpandHtml = '<div class="example-expand" aria-hidden="false" data-nsm-dim-example-key="' + escHtml(dim.id) + '">'
        + '<div class="example-expand__head">'
        +   '<div class="example-expand__title"><i class="ph ph-quotes"></i>範例答案</div>'
        +   '<button class="example-expand__close" data-nsm-dim-example-close="' + escHtml(dim.id) + '" aria-label="收合"><i class="ph ph-x"></i></button>'
        + '</div>'
        + '<ul class="example-list">' + markdownBulletsToHtml(exampleText) + '</ul>'
        + '</div>';
    }

    var dimExampleBtnHtml = exampleText
      ? '<button class="field-example-toggle" type="button" data-nsm-dim-example-toggle="' + escHtml(dim.id) + '" aria-expanded="' + dimExAriaExpanded + '">'
        + '<i class="ph ph-quotes"></i>範例答案<i class="ph ph-caret-down toggle-caret"' + dimExCaretStyle + '></i>'
        + '</button>'
      : '<button class="field-example-toggle" type="button" data-nsm-dim-example-toggle="' + escHtml(dim.id) + '" aria-expanded="false" disabled title="此題暫無範例答案">'
        + '<i class="ph ph-quotes"></i>範例答案'
        + '</button>';

    return '<div class="nsm-dim">'
      + '<div class="nsm-dim__head">'
      +   '<div class="nsm-dim__label">' + escHtml(dim.label) + '</div>'
      +   '<div class="nsm-dim__desc">' + escHtml(dim.desc) + '</div>'
      + '</div>'
      + '<div class="nsm-dim__body">'
      +   '<div class="nsm-dim__coach"><i class="ph ph-chat-dots"></i>' + escHtml(dim.coachQ) + '</div>'
      +   '<div class="field__hint-row">'
      +     '<button class="field__hint-link" type="button" data-nsm-step3-hint="' + escHtml(dim.id) + '" data-nsm-dim-type="' + escHtml(ptype || 'attention') + '">'
      +       '<i class="ph ph-lightbulb"></i>提示'
      +     '</button>'
      +     dimExampleBtnHtml
      +   '</div>'
      +   '<div class="nsm-rt-field"><div class="nsm-rt-toolbar">'
      +     '<button class="nsm-rt-tbtn" data-rt-cmd="bold" title="粗體"><strong>B</strong></button>'
      +     '<button class="nsm-rt-tbtn" data-rt-cmd="insertUnorderedList" title="列點"><i class="ph ph-list-bullets"></i></button>'
      +   '</div><textarea class="nsm-rt-textarea" data-nsm-dim="' + escHtml(dim.id) + '">' + escHtml(value) + '</textarea></div>'
      +   dimExpandHtml
      + '</div></div>';
  }

  // Module-scope dedupe per qid (mirrors CIRCLES 9d92656 _phase1PreflightInFlightForQid).
  var _nsmPreflightInFlightForQid = null;

  async function ensureNsmDraftSession() {
    if (AppState.nsmSession && AppState.nsmSession.id) return AppState.nsmSession.id;
    var qid = (AppState.nsmSelectedQuestion || {}).id;
    if (!qid) return null;
    if (_nsmPreflightInFlightForQid === qid) return null;
    _nsmPreflightInFlightForQid = qid;
    try {
      var basePath = AppState.accessToken ? '/api/nsm-sessions' : '/api/guest/nsm-sessions';
      var res = await window.apiFetch(basePath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId: qid, questionJson: AppState.nsmSelectedQuestion }),
      });
      if (!res.ok) throw new Error('session_create_failed');
      var data = await res.json();
      AppState.nsmSession = { id: data.sessionId || data.id };
      return AppState.nsmSession.id;
    } finally {
      if (_nsmPreflightInFlightForQid === qid) _nsmPreflightInFlightForQid = null;
    }
  }

  function bindNSMStep2And3() {
    // Preflight session creation on Step 2/3 mount — eliminates draft race window.
    // Mirrors CIRCLES preflightDraftSession pattern (commit 9d92656).
    (function preflightNsmDraftSession() {
      if (AppState.nsmStep === 2 || AppState.nsmStep === 3) {
        ensureNsmDraftSession().catch(function (e) {
          console.warn('[nsm preflight]', e && e.message);
        });
      }
    })();

    document.querySelectorAll('[data-nsm="context-toggle"]').forEach(function (el) {
      el.addEventListener('click', function () {
        AppState.nsmContextExpanded = !AppState.nsmContextExpanded;
        render();
      });
    });

    document.querySelectorAll('[data-nsm-example-toggle]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var fid = btn.dataset.nsmExampleToggle;
        AppState.nsmExampleExpanded[fid] = !AppState.nsmExampleExpanded[fid];
        render();
      });
    });
    document.querySelectorAll('[data-nsm-hint-toggle]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var did = btn.dataset.nsmHintToggle;
        AppState.nsmHintExpanded[did] = !AppState.nsmHintExpanded[did];
        render();
      });
    });

    // ── NSM Step 2 hint modal open — [data-nsm-hint] ─────────────────────────
    document.querySelectorAll('[data-nsm-hint]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        openNSMStep2HintModal(btn.dataset.nsmHint);
      });
    });

    // ── NSM Step 3 AI hint modal open — [data-nsm-step3-hint] ────────────────
    document.querySelectorAll('[data-nsm-step3-hint]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        openNSMStep3HintModal(btn.dataset.nsmStep3Hint, btn.dataset.nsmDimType);
      });
    });

    // ── NSM Step 2 field example expand/collapse — [data-nsm-example-close] ──
    document.querySelectorAll('[data-nsm-example-close]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var fid = btn.dataset.nsmExampleClose;
        if (AppState.nsmExampleExpanded) AppState.nsmExampleExpanded[fid] = false;
        render();
      });
    });

    // ── NSM Step 3 dim example expand/collapse ────────────────────────────────
    document.querySelectorAll('[data-nsm-dim-example-toggle]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var did = btn.dataset.nsmDimExampleToggle;
        if (!AppState.nsmDimExampleExpanded) AppState.nsmDimExampleExpanded = {};
        AppState.nsmDimExampleExpanded[did] = !AppState.nsmDimExampleExpanded[did];
        render();
      });
    });
    document.querySelectorAll('[data-nsm-dim-example-close]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var did = btn.dataset.nsmDimExampleClose;
        if (AppState.nsmDimExampleExpanded) AppState.nsmDimExampleExpanded[did] = false;
        render();
      });
    });

    document.querySelectorAll('[data-nsm-field]').forEach(function (el) {
      el.addEventListener('input', function () {
        var fid = el.dataset.nsmField;
        var v = el.tagName === 'INPUT' ? el.value : el.innerHTML;
        if (!AppState.nsmDefinition) AppState.nsmDefinition = { nsm: '', explanation: '', businessLink: '' };
        AppState.nsmDefinition[fid] = v;
        triggerNsmSaveCycle();
        // In-place submit update — mirror CIRCLES Phase 1 line 6956+
        if (_nsmSubmitDebounce) clearTimeout(_nsmSubmitDebounce);
        _nsmSubmitDebounce = setTimeout(function () {
          var submitBtn = document.querySelector('[data-nsm-submit]');
          if (!submitBtn || AppState.nsmEvalResult) return;
          var def = AppState.nsmDefinition || {};
          var canSubmit = fieldMinLengthOk(def.nsm, 10) && fieldMinLengthOk(def.explanation, 30) && fieldMinLengthOk(def.businessLink, 30);
          submitBtn.disabled = !canSubmit;
        }, 200);
      });
    });
    document.querySelectorAll('[data-nsm-dim]').forEach(function (el) {
      el.addEventListener('input', function () {
        var did = el.dataset.nsmDim;
        if (!AppState.nsmBreakdown) AppState.nsmBreakdown = {};
        AppState.nsmBreakdown[did] = el.value;
        triggerNsmSaveCycle();
        // In-place submit update — mirror CIRCLES Phase 1 line 6956+
        if (_nsmSubmitDebounce) clearTimeout(_nsmSubmitDebounce);
        _nsmSubmitDebounce = setTimeout(function () {
          var submitBtn = document.querySelector('[data-nsm-submit]');
          if (!submitBtn || AppState.nsmEvalResult) return;
          var q = AppState.nsmSelectedQuestion || {};
          var ptype = nsmGuessProductType(q);
          var typeCfg = getNsmDimConfig(ptype);
          var br = AppState.nsmBreakdown || {};
          var canSubmit = typeCfg.dims.every(function (d) { return fieldMinLengthOk(br[d.id], 20); });
          submitBtn.disabled = !canSubmit;
        }, 200);
      });
    });
    var backBtn = document.querySelector('[data-nsm-action="back"]');
    if (backBtn) {
      backBtn.addEventListener('click', function () {
        // Bug 3 fix (2026-05-11): Step 2 back must NOT route to Step 1 question
        // selection — that visually orphans the user's already-selected question.
        // Route to home (CIRCLES default landing). nsmSelectedQuestion preserved
        // so user can resume via offcanvas (Task 2 smart routing lands at Step 2).
        AppState.view = 'circles';
        AppState.nsmStep = 1; // reset for next NSM session entry
        render();
      });
    }
    var backToStep2Btn = document.querySelector('[data-nsm-action="back-to-step2"]');
    if (backToStep2Btn) {
      backToStep2Btn.addEventListener('click', function () {
        AppState.nsmStep = 2;
        AppState.nsmSubTab = 'nsm-step2';
        render();
      });
    }
    // ── [data-nsm-action="view-eval-result"] — locked overlay → jump to Step 4 report ──
    var viewEvalBtn = document.querySelector('[data-nsm-action="view-eval-result"]');
    if (viewEvalBtn) {
      viewEvalBtn.addEventListener('click', function () {
        AppState.nsmStep = 4;
        render();
      });
    }

    // ── [data-nsm-gate-action] — gate result navigation ────────────────────
    document.querySelectorAll('[data-nsm-gate-action]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var action = btn.dataset.nsmGateAction;
        if (action === 'back-to-step2') {
          // Clear gate result and return to step 2 form
          AppState.nsmGateResult = null;
          AppState.nsmGateError = null;
          AppState.nsmGateLoading = false;
          AppState.nsmGateLoadingStep = 0;
          AppState.nsmStep = 2;
          AppState.nsmSubTab = 'nsm-step2';
          render();
        } else if (action === 'proceed') {
          // ok/warn — advance to step 3
          AppState.nsmSubTab = 'nsm-step3';
          AppState.nsmStep = 3;
          render();
        }
      });
    });

    // ── [data-nsm-submit] — Step 2 gate + Step 3 evaluate ──────────────────
    var nsmSubmitBtn = document.querySelector('[data-nsm-submit]');
    if (nsmSubmitBtn) {
      nsmSubmitBtn.addEventListener('click', async function () {
        if (nsmSubmitBtn.disabled) return;
        var subTab = AppState.nsmSubTab || 'nsm-step2';

        // Helper: lazy-create NSM session if needed
        async function ensureNsmSession() {
          if (AppState.nsmSession && AppState.nsmSession.id) return AppState.nsmSession.id;
          var q = AppState.nsmSelectedQuestion || {};
          var basePath = AppState.accessToken ? '/api/nsm-sessions' : '/api/guest/nsm-sessions';
          var res = await window.apiFetch(basePath, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ questionId: q.id, questionJson: q }),
          });
          if (!res.ok) throw new Error('session_create_failed');
          var data = await res.json();
          var sessionId = data.sessionId || data.id;
          AppState.nsmSession = { id: sessionId };
          return sessionId;
        }

        if (subTab === 'nsm-step2') {
          // Step 2 → Gate — show loading state + route to nsm-gate subtab
          AppState.nsmGateError = null;
          AppState.nsmGateResult = null;
          AppState.nsmGateLoading = true;
          AppState.nsmGateLoadingStep = 0;
          AppState.nsmSubTab = 'nsm-gate';
          render();

          // Tick loading steps every 2.5 s while waiting
          var _nsmGateLoadingTimer = setInterval(function () {
            if (!AppState.nsmGateLoading) { clearInterval(_nsmGateLoadingTimer); return; }
            if (AppState.nsmGateLoadingStep < NSM_GATE_LOADING_STEPS.length - 1) {
              AppState.nsmGateLoadingStep++;
              render();
            }
          }, 2500);

          try {
            var sessionId = await ensureNsmSession();
            var def = AppState.nsmDefinition || {};
            var rationale = [def.explanation || '', def.businessLink || ''].filter(Boolean).join('\n\n');
            var basePath = AppState.accessToken ? '/api/nsm-sessions/' : '/api/guest/nsm-sessions/';
            var res = await window.apiFetch(basePath + sessionId + '/gate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ nsm: def.nsm || '', rationale: rationale }),
            });
            clearInterval(_nsmGateLoadingTimer);
            AppState.nsmGateLoading = false;
            if (!res.ok) {
              var err = await res.json().catch(function () { return {}; });
              AppState.nsmGateError = err.error || 'gate_error';
              render();
              return;
            }
            var result = await res.json();
            AppState.nsmGateResult = result;
            var os = result.overall_status || result.overallStatus || 'error';
            if (os === 'error') {
              // keep on nsm-gate subtab, gate result inline (mockup 08 rendering)
              render();
            } else {
              // ok or warn → advance to Step 3
              AppState.nsmSubTab = 'nsm-step3';
              AppState.nsmStep = 3;
              render();
            }
          } catch (e) {
            clearInterval(_nsmGateLoadingTimer);
            AppState.nsmGateLoading = false;
            AppState.nsmGateError = e.message || 'gate_error';
            render();
          }
        } else if (subTab === 'nsm-step3') {
          // Step 3 → Evaluate
          nsmSubmitBtn.disabled = true;
          nsmSubmitBtn.innerHTML = '<i class="ph ph-circle-notch"></i>評分中…';
          AppState.nsmEvalError = null;
          AppState.nsmEvalLoading = true;
          try {
            var sessionId = await ensureNsmSession();
            var basePath = AppState.accessToken ? '/api/nsm-sessions/' : '/api/guest/nsm-sessions/';
            var res = await window.apiFetch(basePath + sessionId + '/evaluate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                userNsm: (AppState.nsmDefinition || {}).nsm || '',
                userBreakdown: AppState.nsmBreakdown || {},
              }),
            });
            if (!res.ok) {
              var err = await res.json().catch(function () { return {}; });
              AppState.nsmEvalError = err.error || 'eval_error';
              render();
              return;
            }
            var result = await res.json();
            AppState.nsmEvalResult = result;
            // Step 4 rendering deferred to bundle 14
            console.info('NSM eval done', result);
            render();
          } catch (e) {
            AppState.nsmEvalError = e.message || 'eval_error';
            render();
          } finally {
            AppState.nsmEvalLoading = false;
          }
        }
      });
    }
  }

  var _nsmSaveTimer = null;
  var _nsmSubmitDebounce = null;
  function triggerNsmSaveCycle() {
    if (_nsmSaveTimer) clearTimeout(_nsmSaveTimer);
    _nsmSaveTimer = setTimeout(function () {
      try {
        var qid = (AppState.nsmSelectedQuestion || {}).id || 'unknown';
        var payload = {
          user_nsm: (AppState.nsmDefinition || {}).nsm || '',
          user_breakdown: AppState.nsmBreakdown || {},
        };
        localStorage.setItem('pmdrill:nsm:draft:' + qid, JSON.stringify(Object.assign({}, payload, { ts: Date.now() })));
        var sessionId = AppState.nsmSession && AppState.nsmSession.id;
        if (sessionId) {
          var path = (AppState.accessToken ? '/api/nsm-sessions/' : '/api/guest/nsm-sessions/') + sessionId + '/progress';
          window.apiFetch(path, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          }).catch(function () {});
        }
      } catch (_) {}
    }, 800);
  }

  window.renderNSMStep2 = renderNSMStep2;
  window.renderNSMStep3 = renderNSMStep3;

  // ── NSM Step 4 · Final Report (mockup 14) ────────────────────────────────
  // AppState.nsmReportTab: 'overview' | 'comparison' | 'highlights' | 'done'
  // AppState.nsmActiveCompareNode: null | dim key string (one of 5)

  // 5 NSM evaluation dims mapping evaluator keys → display labels
  var NSM_SCORE_DIMS = [
    { key: 'alignment',    label: '價值關聯' },
    { key: 'leading',      label: '領先指標' },
    { key: 'actionability',label: '操作性'   },
    { key: 'simplicity',   label: '可理解性' },
    { key: 'sensitivity',  label: '週期敏感' },
  ];

  // 5-axis pentagon radar: axes at angles -90°, -18°, 54°, 126°, 198° (top, top-right, bottom-right, bottom-left, top-left)
  // matches mockup 14 verbatim
  var NSM_RADAR_CX = 120, NSM_RADAR_CY = 110;
  var NSM_RADAR_R_OUTER = 92;  // full radius (score 5)

  function computeRadarPoint(angleRad, score) {
    var r = (score / 5) * NSM_RADAR_R_OUTER;
    return {
      x: NSM_RADAR_CX + r * Math.cos(angleRad),
      y: NSM_RADAR_CY + r * Math.sin(angleRad),
    };
  }

  function renderNSMRadarSVG(scores) {
    // 5 axes at: -90° (top / 價值關聯), -18° (top-right / 領先指標),
    //             54° (bottom-right / 操作性), 126° (bottom-left / 可理解性),
    //            198° (top-left / 週期敏感)
    var angles = [-90, -18, 54, 126, 198].map(function (d) { return d * Math.PI / 180; });
    var dimKeys = ['alignment', 'leading', 'actionability', 'simplicity', 'sensitivity'];
    var dimLabels = ['價值關聯', '領先指標', '操作性', '可理解性', '週期敏感'];
    var dimLabelAnchors = ['middle', 'start', 'middle', 'middle', 'end'];
    var dimLabelOffsets = [
      { x: 0, y: -4 },     // 價值關聯 — top
      { x: 4, y: 0 },      // 領先指標 — right
      { x: 0, y: 8 },      // 操作性 — bottom-right
      { x: 0, y: 8 },      // 可理解性 — bottom-left
      { x: -4, y: 0 },     // 週期敏感 — left
    ];

    // Outer ring (score=5) and mid ring (score=2.5) at 50%
    var outerPts = angles.map(function (a) {
      return (NSM_RADAR_CX + NSM_RADAR_R_OUTER * Math.cos(a)).toFixed(1) + ','
           + (NSM_RADAR_CY + NSM_RADAR_R_OUTER * Math.sin(a)).toFixed(1);
    }).join(' ');
    var midPts = angles.map(function (a) {
      var r = NSM_RADAR_R_OUTER * 0.5;
      return (NSM_RADAR_CX + r * Math.cos(a)).toFixed(1) + ','
           + (NSM_RADAR_CY + r * Math.sin(a)).toFixed(1);
    }).join(' ');

    // Data polygon
    var dataPts = angles.map(function (a, i) {
      var score = (scores && scores[dimKeys[i]]) || 1;
      return computeRadarPoint(a, score);
    });
    var polyPts = dataPts.map(function (p) { return p.x.toFixed(1) + ',' + p.y.toFixed(1); }).join(' ');

    // Axes lines
    var axesHtml = angles.map(function (a) {
      var tip = computeRadarPoint(a, 5);
      return '<line class="axis" x1="' + NSM_RADAR_CX + '" y1="' + NSM_RADAR_CY
        + '" x2="' + tip.x.toFixed(1) + '" y2="' + tip.y.toFixed(1) + '"/>';
    }).join('');

    // Dots at each data point
    var dotsHtml = dataPts.map(function (p) {
      return '<circle class="dot" cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="3"/>';
    }).join('');

    // Labels — positioned slightly beyond the outer ring
    var labelsHtml = angles.map(function (a, i) {
      var lp = computeRadarPoint(a, 5.8);
      var ox = dimLabelOffsets[i].x, oy = dimLabelOffsets[i].y;
      return '<text class="label" x="' + (lp.x + ox).toFixed(1) + '" y="' + (lp.y + oy).toFixed(1)
        + '" text-anchor="' + dimLabelAnchors[i] + '">' + escHtml(dimLabels[i]) + '</text>';
    }).join('');

    return '<svg class="nsm-radar-svg" viewBox="0 0 240 220" preserveAspectRatio="xMidYMid meet"'
      + ' role="img" aria-label="NSM 5 維度雷達圖">'
      + '<polygon class="ring" points="' + outerPts + '"/>'
      + '<polygon class="ring" points="' + midPts + '"/>'
      + axesHtml
      + '<polygon class="poly" points="' + polyPts + '"/>'
      + dotsHtml
      + labelsHtml
      + '</svg>';
  }

  function renderNSMStep4OverviewTab(evalResult, q) {
    var isDesktop = window.innerWidth >= 1024;
    var scores = (evalResult && evalResult.scores) || {};
    var comments = (evalResult && evalResult.coachComments) || {};
    var overviewCls = 'nsm-overview' + (isDesktop ? ' nsm-overview--desktop' : '');

    var scoreRowsHtml = NSM_SCORE_DIMS.map(function (dim) {
      var score = scores[dim.key] || 1;
      var pct = (score / 5 * 100).toFixed(0) + '%';
      var scoreCls = score >= 4 ? 'nsm-score-row__score--high' : (score <= 2 ? 'nsm-score-row__score--low' : 'nsm-score-row__score--mid');
      var barFillCls = score <= 2 ? 'nsm-score-row__bar-fill nsm-score-row__bar-fill--low' : 'nsm-score-row__bar-fill';
      var comment = escHtml(comments[dim.key] || '');
      return '<div class="nsm-score-row">'
        + '<div class="nsm-score-row__head">'
        +   '<span class="nsm-score-row__name">' + escHtml(dim.label) + '</span>'
        +   '<span class="nsm-score-row__score ' + scoreCls + '">' + score
        +     '<span class="nsm-score-row__score-max">/5</span>'
        +   '</span>'
        + '</div>'
        + '<div class="nsm-score-row__bar-wrap"><div class="' + barFillCls + '" style="width:' + pct + '"></div></div>'
        + (comment ? '<div class="nsm-score-row__comment">' + comment + '</div>' : '')
        + '</div>';
    }).join('');

    return '<div class="' + overviewCls + '">'
      + '<div class="panel-card">'
      +   '<div class="panel-card__title"><i class="ph ph-radio-button"></i>5 維度雷達圖</div>'
      +   renderNSMRadarSVG(scores)
      + '</div>'
      + '<div class="panel-card">'
      +   '<div class="panel-card__title"><i class="ph ph-list-numbers"></i>5 維度分數明細</div>'
      +   '<div class="nsm-score-rows">' + scoreRowsHtml + '</div>'
      + '</div>'
      + '</div>';
  }

  function renderNSMStep4CoachDetail(dimKey, evalResult) {
    var q = AppState.nsmSelectedQuestion || {};
    var ptype = nsmGuessProductType(q);
    var typeCfg = getNsmDimConfig(ptype);
    var rationale = (evalResult && evalResult.coachRationale) || {};
    var coachTree = (evalResult && evalResult.coachTree) || {};

    // Map dimKey to display label + numeric key
    var DIM_MAP = {
      nsm:       { label: '北極星指標 (NSM)', key: 'NSM' },
      reach:     { label: typeCfg.dims[0].label, key: '1' },
      depth:     { label: typeCfg.dims[1].label, key: '2' },
      frequency: { label: typeCfg.dims[2].label, key: '3' },
      impact:    { label: typeCfg.dims[3].label, key: '4' },
    };
    var dimInfo = DIM_MAP[dimKey] || { label: dimKey, key: '' };
    // Bug D fix: "教練思路" = coach's actual answer (coachTree); "為什麼這樣拆解" = explanation (coachRationale)
    var thinking = escHtml(coachTree[dimKey] || '');
    var reason = escHtml(rationale[dimKey] || '');

    return '<div class="nsm-coach-detail__head">'
      +   '<span class="nsm-coach-detail__icon"><i class="ph ph-graduation-cap"></i></span>'
      +   '<span class="nsm-coach-detail__title"><span class="nsm-coach-detail__title-key">' + escHtml(dimInfo.key) + '</span>' + escHtml(dimInfo.label) + ' · 教練思路</span>'
      +   '<button class="nsm-coach-detail__close" data-nsm4-action="close-coach"><i class="ph ph-x"></i></button>'
      + '</div>'
      + '<div class="nsm-coach-detail__section">'
      +   '<div class="nsm-coach-detail__label">教練思路</div>'
      +   '<div class="nsm-coach-detail__text">' + thinking + '</div>'
      + '</div>'
      + '<div class="nsm-coach-detail__section">'
      +   '<div class="nsm-coach-detail__label">為什麼這樣拆解</div>'
      +   '<div class="nsm-coach-detail__quote">' + reason + '</div>'
      + '</div>';
  }

  function renderNSMStep4ComparisonTab(evalResult, q) {
    var isDesktop = window.innerWidth >= 1024;
    var isTabletPlus = window.innerWidth >= 768;
    var activeNode = AppState.nsmActiveCompareNode;
    var ptype = nsmGuessProductType(q || {});
    var typeCfg = getNsmDimConfig(ptype);
    var coachTree = (evalResult && evalResult.coachTree) || {};
    var userDef = AppState.nsmDefinition || {};
    var userBreakdown = AppState.nsmBreakdown || {};

    // 5 rows: NSM + 4 dims
    var COMPARE_ROWS = [
      { key: 'nsm',       labelKey: 'NSM', label: '北極星指標',       yourText: userDef.nsm || '',           coachText: coachTree.nsm || '' },
      { key: 'reach',     labelKey: '1',   label: typeCfg.dims[0].label, yourText: userBreakdown.reach || '',     coachText: coachTree.reach || '' },
      { key: 'depth',     labelKey: '2',   label: typeCfg.dims[1].label, yourText: userBreakdown.depth || '',     coachText: coachTree.depth || '' },
      { key: 'frequency', labelKey: '3',   label: typeCfg.dims[2].label, yourText: userBreakdown.frequency || '', coachText: coachTree.frequency || '' },
      { key: 'impact',    labelKey: '4',   label: typeCfg.dims[3].label, yourText: userBreakdown.impact || '',    coachText: coachTree.impact || '' },
    ];

    if (!isTabletPlus) {
      // Mobile: vertical stack per dim
      var mobileBlocks = COMPARE_ROWS.map(function (row) {
        var coachActive = activeNode === row.key;
        var coachCardCls = 'nsm-compare-card nsm-compare-card--coach' + (coachActive ? ' is-active' : '');
        var detailSheet = '';
        if (coachActive) {
          detailSheet = '<div class="nsm-detail-sheet">'
            + '<div class="nsm-detail-sheet__handle"></div>'
            + renderNSMStep4CoachDetail(row.key, evalResult)
            + '</div>';
        }
        return '<div class="nsm-compare-block">'
          + '<div class="nsm-compare-block__title">' + escHtml(row.label) + '</div>'
          + '<div class="nsm-compare-card nsm-compare-card--yours">'
          +   '<span class="nsm-compare-card__tag">你的</span>'
          +   '<div class="nsm-compare-card__text">' + escHtml(row.yourText) + '</div>'
          + '</div>'
          + '<div class="' + coachCardCls + '" data-nsm4-compare-node="' + escHtml(row.key) + '">'
          +   '<span class="nsm-compare-card__tag">教練版</span>'
          +   '<div class="nsm-compare-card__text">' + escHtml(row.coachText) + '</div>'
          + '</div>'
          + detailSheet
          + '</div>';
      }).join('');
      return '<div class="nsm-compare nsm-compare--stack">' + mobileBlocks + '</div>';
    } else {
      // Tablet/Desktop: grid layout
      var headerRow = '<div class="nsm-compare-grid__header">'
        + '<div></div>'
        + '<div>你的拆解</div>'
        + '<div class="nsm-compare-grid__header-coach">教練版本<span class="nsm-compare-grid__header-coach-hint">點擊看思路</span></div>'
        + '</div>';

      var gridRows = '';
      COMPARE_ROWS.forEach(function (row) {
        var coachActive = activeNode === row.key;
        var coachCardCls = 'nsm-compare-card nsm-compare-card--coach' + (coachActive ? ' is-active' : '');
        gridRows += '<div class="nsm-compare-grid__row">'
          + '<div class="nsm-compare-grid__label"><span class="nsm-compare-grid__label-key">' + escHtml(row.labelKey) + '</span>' + escHtml(row.label) + '</div>'
          + '<div class="nsm-compare-card nsm-compare-card--yours"><div class="nsm-compare-card__text">' + escHtml(row.yourText) + '</div></div>'
          + '<div class="' + coachCardCls + '" data-nsm4-compare-node="' + escHtml(row.key) + '">'
          +   '<div class="nsm-compare-card__text">' + escHtml(row.coachText) + '</div>'
          + '</div>'
          + '</div>';
        // Inline coach detail panel after coach-active row
        if (coachActive) {
          gridRows += '<div class="nsm-coach-detail">'
            + renderNSMStep4CoachDetail(row.key, evalResult)
            + '</div>';
        }
      });

      return '<div class="nsm-compare nsm-compare--grid">' + headerRow + gridRows + '</div>';
    }
  }

  function renderNSMStep4HighlightsTab(evalResult) {
    var isDesktop = window.innerWidth >= 1024;
    var isTabletPlus = window.innerWidth >= 768;
    var highlightsCls = 'nsm-highlights'
      + (isDesktop ? ' nsm-highlights--desktop' : (isTabletPlus ? ' nsm-highlights--tablet' : ''));
    var bestMove = escHtml((evalResult && evalResult.bestMove) || '');
    var mainTrap = escHtml((evalResult && evalResult.mainTrap) || '');
    var summary  = escHtml((evalResult && evalResult.summary) || '');

    return '<div class="' + highlightsCls + '">'
      + '<div class="nsm-highlight nsm-highlight--best">'
      +   '<div class="nsm-highlight__title"><i class="ph-fill ph-trophy"></i>最大亮點</div>'
      +   '<div class="nsm-highlight__text">' + bestMove + '</div>'
      + '</div>'
      + '<div class="nsm-highlight nsm-highlight--trap">'
      +   '<div class="nsm-highlight__title"><i class="ph-fill ph-warning-circle"></i>主要陷阱</div>'
      +   '<div class="nsm-highlight__text">' + mainTrap + '</div>'
      + '</div>'
      + '<div class="nsm-highlight nsm-highlight--next">'
      +   '<div class="nsm-highlight__title"><i class="ph-fill ph-arrow-right"></i>下一步建議</div>'
      +   '<div class="nsm-highlight__text">補上 30/60/90 day milestone 與虛榮指標檢驗清單；建議再加練一道不同類型題目，強化多維度指標拆解經驗。</div>'
      + '</div>'
      + '<div class="nsm-highlight nsm-highlight--summary">'
      +   '<div class="nsm-highlight__title"><i class="ph-fill ph-chat-text"></i>總評</div>'
      +   '<div class="nsm-highlight__text">' + summary + '</div>'
      + '</div>'
      + '</div>';
  }

  function renderNSMStep4DoneTab(evalResult) {
    var isDesktop = window.innerWidth >= 1024;
    var totalScore = (evalResult && evalResult.totalScore) || 0;
    var gap = 100 - totalScore;
    var passDims = NSM_SCORE_DIMS.filter(function (d) {
      return evalResult && evalResult.scores && evalResult.scores[d.key] >= 3;
    }).length;

    var homeBtn = isDesktop
      ? '<button class="btn btn--ghost" data-nsm4-action="home"><i class="ph ph-house"></i>回首頁</button>'
      : '';

    return '<div class="done-panel">'
      +   '<div class="done-panel__icon"><i class="ph-fill ph-check-circle"></i></div>'
      +   '<div class="done-panel__title">完成這次 NSM 訓練</div>'
      +   '<div class="done-panel__body">本次得分 <strong>' + totalScore + ' 分</strong>，距離滿分還差 ' + gap + ' 分；'
      +     '表現扎實，' + passDims + '/5 個維度達標，繼續練其他題型強化指標思考。</div>'
      +   '<div class="done-panel__actions">'
      +     homeBtn
      +     '<button class="btn btn--primary" data-nsm4-action="retry"><i class="ph ph-shuffle"></i>再練一題</button>'
      +   '</div>'
      + '</div>'
      + '<div class="done-secondary">'
      +   '<div class="done-secondary__title"><i class="ph ph-lightbulb"></i>NSM 練習小技巧</div>'
      +   '<ul class="done-secondary__list">'
      +     '<li>每練一題後，回頭看「對比」tab 找出與教練版差距最大的維度</li>'
      +     '<li>注意指標是否能被「廣告觸及」這類虛榮數據拉高</li>'
      +     '<li>把 NSM 拆成 2 階段（啟用 → 留存），通常更能反映漏斗本質</li>'
      +   '</ul>'
      + '</div>';
  }

  function renderNSMStep4() {
    var evalResult = AppState.nsmEvalResult || {};
    var q = AppState.nsmSelectedQuestion || {};
    var tab = AppState.nsmReportTab || 'overview';
    var totalScore = evalResult.totalScore || 0;
    var ptype = nsmGuessProductType(q);
    var typeCfg = getNsmDimConfig(ptype);
    var typeLabelShort = typeCfg ? typeCfg.label : '';

    // nsm-summary company info
    var companyName = escHtml(q.company || '');
    var companyProduct = escHtml(q.product || '');
    var companySub = escHtml(typeLabelShort) + (window.innerWidth >= 1024 && companyProduct ? ' · 模擬完成' : '');
    var companyDisplayName = window.innerWidth >= 1024 && companyProduct
      ? (companyName + ' · ' + companyProduct)
      : companyName;

    // Tab bar
    var TABS = [
      { key: 'overview',    label: '總覽' },
      { key: 'comparison',  label: '對比' },
      { key: 'highlights',  label: '亮點' },
      { key: 'done',        label: '完成' },
    ];
    var tabBarHtml = '<div class="tab-bar">'
      + TABS.map(function (t) {
          return '<button class="tab-bar__btn' + (tab === t.key ? ' is-active' : '') + '" data-nsm4-tab="' + t.key + '">' + t.label + '</button>';
        }).join('')
      + '</div>';

    // Tab body
    var bodyHtml;
    if (tab === 'overview') {
      bodyHtml = renderNSMStep4OverviewTab(evalResult, q);
    } else if (tab === 'comparison') {
      bodyHtml = renderNSMStep4ComparisonTab(evalResult, q);
    } else if (tab === 'highlights') {
      bodyHtml = renderNSMStep4HighlightsTab(evalResult);
    } else {
      bodyHtml = renderNSMStep4DoneTab(evalResult);
    }

    // qchip 題目情境 — mockup 14 §A LOCKED (pill NSM + scenario truncated)
    var qchipHtml = '<div class="qchip">'
      + '<span class="qchip__pill">NSM</span>'
      + '<span class="qchip__title">' + escHtml(q.scenario || '') + '</span>'
      + '</div>';

    // Bug C fix: on 完成 tab, 「上一步」back button is hidden — celebration page has no back flow
    var backBtnHtml = tab !== 'done'
      ? '<button class="nsm-nav__back" data-nsm4-action="back"><i class="ph ph-arrow-left"></i></button>'
      : '';

    return '<div data-view="nsm" data-nsm-step4>'
      + '<div class="nsm-nav">'
      +   backBtnHtml
      +   '<div class="nsm-nav__main">'
      +     '<div class="nsm-nav__title">NSM 報告</div>'
      +     '<div class="nsm-nav__sub">' + companyDisplayName + '</div>'
      +   '</div>'
      + '</div>'
      + qchipHtml
      + '<div class="nsm-summary">'
      +   '<span class="nsm-summary__score">' + totalScore + '</span>'
      +   '<span class="nsm-summary__unit">/ 100</span>'
      +   '<div class="nsm-summary__company">'
      +     '<div class="nsm-summary__company-name">' + companyDisplayName + '</div>'
      +     '<div class="nsm-summary__company-sub">' + companySub + '</div>'
      +   '</div>'
      + '</div>'
      + tabBarHtml
      + '<div class="nsm-body">'
      +   bodyHtml
      + '</div>'
      + '</div>';
  }

  function bindNSMStep4() {
    // Tab switching
    document.querySelectorAll('[data-nsm4-tab]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        AppState.nsmReportTab = btn.dataset.nsm4Tab;
        AppState.nsmActiveCompareNode = null;
        render();
      });
    });

    // Coach card click → show thinking panel
    document.querySelectorAll('[data-nsm4-compare-node]').forEach(function (card) {
      card.addEventListener('click', function () {
        var node = card.dataset.nsm4CompareNode;
        if (AppState.nsmActiveCompareNode === node) {
          AppState.nsmActiveCompareNode = null;
        } else {
          AppState.nsmActiveCompareNode = node;
        }
        render();
      });
    });

    // Close coach detail
    document.querySelectorAll('[data-nsm4-action="close-coach"]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        AppState.nsmActiveCompareNode = null;
        render();
      });
    });

    // Back button
    document.querySelectorAll('[data-nsm4-action="back"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        AppState.nsmStep = 3;
        AppState.nsmSubTab = 'nsm-step3';
        render();
      });
    });

    // 再練一題 — reset to step 1, pick new questions
    document.querySelectorAll('[data-nsm4-action="retry"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        AppState.nsmStep = 1;
        AppState.nsmReportTab = 'overview';
        AppState.nsmEvalResult = null;
        AppState.nsmGateResult = null;
        AppState.nsmDefinition = { nsm: '', explanation: '', businessLink: '' };
        AppState.nsmBreakdown = { reach: '', depth: '', frequency: '', impact: '' };
        AppState.nsmActiveCompareNode = null;
        AppState.nsmSelectedQuestion = null;
        nsmPickDisplayed(true);
        render();
      });
    });

    // 回首頁 — Bug E fix: reset both NSM + CIRCLES state so home renders correctly
    document.querySelectorAll('[data-nsm4-action="home"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        // Reset NSM state
        AppState.nsmStep = 1;
        AppState.nsmSubTab = null;
        AppState.nsmReportTab = 'overview';
        AppState.nsmEvalResult = null;
        AppState.nsmGateResult = null;
        AppState.nsmActiveCompareNode = null;
        AppState.nsmSession = null;
        AppState.nsmSelectedQuestion = null;
        AppState.nsmDefinition = { nsm: '', explanation: '', businessLink: '' };
        AppState.nsmBreakdown = { reach: '', depth: '', frequency: '', impact: '' };
        // Reset CIRCLES state so renderView() lands on home grid, not Phase 1 form
        resetCirclesToHome();
        AppState.view = 'circles';
        render();
      });
    });
  }

  window.renderNSMStep4 = renderNSMStep4;

  // ── Auth render (Mockup 02 — §A Login / §D Register / §E Token expiry) ──────
  function renderAuthStub() { return renderAuth(); } // alias kept for dispatch compatibility

  function renderAuth() {
    var tab = AppState.authTab || 'login';
    var isLogin = tab === 'login';
    var html = '<div data-view="auth">';
    // Token expiry card (non-blocking, floats at top of auth view)
    if (AppState.sessionExpired) {
      html += renderTokenExpiryCard();
    }
    html += '<div class="auth-page"><div class="auth-card">';
    // Brand mark
    html += '<div class="auth-card__brand">'
      + '<span class="auth-card__brand-icon"><i class="ph ph-circles-three"></i></span>'
      + '<span class="auth-card__brand-name">PM Drill</span>'
      + '</div>';
    // Title + sub
    if (isLogin) {
      html += '<h1 class="auth-card__title">歡迎回來</h1>'
        + '<p class="auth-card__sub">' + (AppState.authLoading ? '登入中…' : '登入後練習記錄會自動同步到雲端，可在任何裝置接續練習') + '</p>';
    } else {
      html += '<h1 class="auth-card__title">建立帳號</h1>'
        + '<p class="auth-card__sub">免費 — 100 題情境模擬訓練</p>';
    }
    // Tabs
    var loginTabCls = 'auth-tab' + (isLogin ? ' is-active' : '');
    var regTabCls   = 'auth-tab' + (!isLogin ? ' is-active' : '');
    var tabDisabled = AppState.authLoading ? ' disabled' : '';
    html += '<div class="auth-tabs">'
      + '<button class="' + loginTabCls + '" data-auth-tab="login"' + tabDisabled + '>登入</button>'
      + '<button class="' + regTabCls + '" data-auth-tab="register"' + tabDisabled + '>註冊</button>'
      + '</div>';
    // Error banner (form-level)
    if (AppState.authError) {
      html += renderAuthErrorBanner(AppState.authError);
    }
    if (isLogin) {
      html += renderAuthLoginFields();
    } else {
      html += renderAuthRegisterFields();
    }
    html += '</div></div></div>';
    return html;
  }

  function renderAuthLoginFields() {
    var loading = AppState.authLoading;
    var emailVal = escHtml(AppState._authEmail || '');
    var pwVal = AppState._authPw ? '••••••••' : '';
    var submitCls = 'auth-submit' + (loading ? ' auth-submit--loading' : '');
    var submitDisabled = loading ? ' disabled' : '';
    var submitLabel = (AppState.authError && AppState.authError.code === 'NETWORK_ERROR') ? '<i class="ph ph-arrow-clockwise"></i>重試' : '登入';
    var inputDisabled = loading ? ' disabled' : '';

    var html = '';
    // Email field
    html += '<div class="auth-field">'
      + '<label class="auth-field__label">Email</label>'
      + '<input class="auth-field__input" id="auth-email" type="email" placeholder="you@example.com"'
      + ' autocomplete="email" value="' + emailVal + '"' + inputDisabled + '>'
      + '</div>';
    // Password field
    html += '<div class="auth-field">'
      + '<label class="auth-field__label"><span>密碼</span><a class="auth-field__hint-link" data-auth-action="forgot-pw">忘記密碼？</a></label>'
      + '<input class="auth-field__input" id="auth-pw" type="password" placeholder="••••••••"'
      + ' autocomplete="current-password"' + inputDisabled + '>'
      + '</div>';
    // Submit
    html += '<button class="' + submitCls + '" id="auth-submit" type="button"' + submitDisabled + '>' + submitLabel + '</button>';
    // Divider + switch
    html += '<hr class="auth-divider">'
      + '<p class="auth-switch">還沒有帳號？<a data-auth-tab="register">立即註冊</a></p>'
      + '<p class="auth-guest-bypass"><a data-auth-action="guest-bypass">先以遊客模式試用 — 練習記錄存於本機 7 天，登入後自動合併</a></p>';
    return html;
  }

  function renderAuthRegisterFields() {
    var loading = AppState.authLoading;
    var emailVal = escHtml(AppState._authEmail || '');
    var submitCls = 'auth-submit' + (loading ? ' auth-submit--loading' : '');
    var submitDisabled = loading ? ' disabled' : '';
    var inputDisabled = loading ? ' disabled' : '';

    // Check if password too short (< 6 chars) to disable submit
    var pwLen = (AppState._authPw || '').length;
    if (pwLen > 0 && pwLen < 6) {
      submitDisabled = ' disabled';
    }

    var html = '';
    // Email field — add error class if email-already-registered
    var emailErrCls = (AppState.authError && AppState.authError.code === 'EMAIL_EXISTS') ? ' auth-field--error' : '';
    html += '<div class="auth-field' + emailErrCls + '">'
      + '<label class="auth-field__label">Email</label>'
      + '<input class="auth-field__input" id="auth-email" type="email" placeholder="you@example.com"'
      + ' autocomplete="email" value="' + emailVal + '"' + inputDisabled + '>'
      + '</div>';
    // Password field
    var pwErrCls = (AppState.authError && AppState.authError.code === 'WEAK_PASSWORD') ? ' auth-field--error' : '';
    var pwHintText = (AppState.authError && AppState.authError.code === 'WEAK_PASSWORD') ? '<span style="font-size:var(--t-cap);color:var(--c-danger);">過短</span>' : '<span style="font-size:var(--t-cap);color:var(--c-ink-3);">至少 6 字</span>';
    html += '<div class="auth-field' + pwErrCls + '">'
      + '<label class="auth-field__label"><span>密碼</span>' + pwHintText + '</label>'
      + '<input class="auth-field__input" id="auth-pw" type="password" placeholder="設定密碼"'
      + ' autocomplete="new-password"' + inputDisabled + '>';
    if (AppState.authError && AppState.authError.code === 'WEAK_PASSWORD') {
      html += '<div class="auth-field__error"><i class="ph ph-warning-circle"></i>密碼至少 6 字。建議用記得住但別人猜不到的句子，例如「我家狗叫小白」。</div>';
    }
    html += '</div>';
    // Submit
    html += '<button class="' + submitCls + '" id="auth-submit" type="button"' + submitDisabled + '>註冊並開始練習</button>';
    html += '<hr class="auth-divider">'
      + '<p class="auth-switch">已經有帳號？<a data-auth-tab="login">直接登入</a></p>';
    return html;
  }

  function renderAuthErrorBanner(err) {
    var icon, title, body;
    switch (err.code) {
      case 'INVALID_CREDENTIALS':
        icon = 'ph-warning-circle';
        title = '帳號或密碼錯誤';
        body = '請再確認，或點下方「忘記密碼」重設。';
        break;
      case 'USER_NOT_FOUND':
        icon = 'ph-user-minus';
        title = '找不到此 email 對應的帳號';
        body = '還沒註冊嗎？<a data-auth-tab="register" style="color:var(--c-danger);text-decoration:underline;">直接註冊</a>，或<a data-auth-action="guest-bypass" style="color:var(--c-danger);text-decoration:underline;">先以遊客模式試用</a>。';
        break;
      case 'NETWORK_ERROR':
        icon = 'ph-cloud-warning';
        title = '連線失敗';
        body = '請檢查網路或稍後再試。你的草稿已存於本機，不會遺失。';
        break;
      case 'EMAIL_EXISTS':
        icon = 'ph-info';
        title = '這個 email 已經註冊過';
        body = '改<a data-auth-tab="login" style="color:var(--c-danger);text-decoration:underline;">登入</a>，或<a data-auth-action="forgot-pw" style="color:var(--c-danger);text-decoration:underline;">忘記密碼</a> 重設。';
        break;
      case 'WEAK_PASSWORD':
        // field-level error is shown inline; no separate banner
        return '';
      default:
        icon = 'ph-warning-circle';
        title = '操作失敗';
        body = escHtml(err.message || '請稍後再試。');
    }
    return '<div class="auth-error-banner">'
      + '<i class="ph ' + icon + '"></i>'
      + '<div><strong>' + title + '</strong>' + body + '</div>'
      + '</div>';
  }

  function renderTokenExpiryCard() {
    return '<div class="token-expiry">'
      + '<span class="token-expiry__icon"><i class="ph ph-clock-countdown"></i></span>'
      + '<div class="token-expiry__main">'
      +   '<div class="token-expiry__title">登入逾期，請重新登入</div>'
      +   '<div class="token-expiry__body">為保護帳號安全，登入狀態定期失效。你的草稿已存於本機，重新登入後會接續到剛才的位置。</div>'
      +   '<button class="token-expiry__btn" data-auth-action="relogin"><i class="ph ph-arrow-right" style="font-size:14px;"></i>重新登入</button>'
      + '</div>'
      + '</div>';
  }

  // ── bindAuth — wires auth view interactions ───────────────────────────────
  function bindAuth() {
    // Tab switches (login ↔ register) — delegated via data-auth-tab
    document.querySelectorAll('[data-auth-tab]').forEach(function (el) {
      el.addEventListener('click', function () {
        var tab = el.getAttribute('data-auth-tab');
        AppState.authTab = tab;
        AppState.authError = null;
        // preserve email across tab switch for UX continuity
        var emailInput = document.getElementById('auth-email');
        if (emailInput) AppState._authEmail = emailInput.value.trim();
        AppState._authPw = '';
        render();
      });
    });

    // Guest bypass link
    document.querySelectorAll('[data-auth-action="guest-bypass"]').forEach(function (el) {
      el.addEventListener('click', function () {
        AppState.sessionExpired = false;
        AppState.authError = null;
        resetCirclesToHome();
        AppState.view = 'circles';
        render();
      });
    });

    // Forgot password stub (no production impl — show info)
    document.querySelectorAll('[data-auth-action="forgot-pw"]').forEach(function (el) {
      el.addEventListener('click', function (e) {
        e.preventDefault();
        alert('密碼重設功能尚未開放，請聯繫客服。');
      });
    });

    // Re-login link (from token expiry card)
    document.querySelectorAll('[data-auth-action="relogin"]').forEach(function (el) {
      el.addEventListener('click', function () {
        AppState.sessionExpired = false;
        AppState.authError = null;
        AppState.view = 'auth';
        render();
      });
    });

    // Email / password inputs — live track to AppState for re-render
    var emailInput = document.getElementById('auth-email');
    var pwInput    = document.getElementById('auth-pw');
    if (emailInput) {
      emailInput.addEventListener('input', function () {
        AppState._authEmail = emailInput.value.trim();
        AppState.authError = null;
        // no re-render needed for simple tracking
      });
    }
    if (pwInput) {
      pwInput.addEventListener('input', function () {
        AppState._authPw = pwInput.value;
        AppState.authError = null;
        // trigger re-render only to update disabled state on register (weak pw)
        if (AppState.authTab === 'register') {
          var pwLen = (AppState._authPw || '').length;
          var submitBtn = document.getElementById('auth-submit');
          if (submitBtn) {
            submitBtn.disabled = (pwLen > 0 && pwLen < 6);
          }
        }
      });
    }

    // Submit button
    var submitBtn = document.getElementById('auth-submit');
    if (submitBtn) {
      submitBtn.addEventListener('click', function () {
        var email = (AppState._authEmail || (emailInput && emailInput.value.trim()) || '').trim();
        var pw    = AppState._authPw    || (pwInput    && pwInput.value)            || '';
        if (!email || !pw) return;
        if (AppState.authTab === 'login') {
          doAuthLogin(email, pw);
        } else {
          doAuthRegister(email, pw);
        }
      });
      // also allow Enter key in password field
      if (pwInput) {
        pwInput.addEventListener('keydown', function (e) {
          if (e.key === 'Enter') submitBtn.click();
        });
      }
    }
  }

  function doAuthLogin(email, pw) {
    if (!window.supabaseClient) {
      AppState.authError = { code: 'NETWORK_ERROR', message: '服務暫不可用，請重試' };
      render();
      return;
    }
    AppState.authLoading = true;
    AppState.authError = null;
    render();
    window.supabaseClient.auth.signInWithPassword({ email: email, password: pw })
      .then(function (result) {
        AppState.authLoading = false;
        if (result.error) {
          var msg = result.error.message || '';
          var code = 'INVALID_CREDENTIALS';
          if (/not found|no user/i.test(msg) || result.error.status === 404) code = 'USER_NOT_FOUND';
          else if (/network|fetch|connection/i.test(msg)) code = 'NETWORK_ERROR';
          AppState.authError = { code: code, message: msg };
          render();
          return;
        }
        var session = result.data && result.data.session;
        if (!session) {
          AppState.authError = { code: 'NETWORK_ERROR', message: '無法取得登入憑證，請重試' };
          render();
          return;
        }
        // Login success
        AppState.accessToken = session.access_token;
        AppState.userEmail = (session.user && session.user.email) || email;
        AppState.sessionExpired = false;
        AppState.authError = null;
        AppState._authEmail = '';
        AppState._authPw = '';
        // Migration — if guest had sessions, migrate them
        var guestId = AppState.guestId || localStorage.getItem('guestId');
        if (guestId) {
          doMigration(guestId);
        }
        // Navigate to circles home
        resetCirclesToHome();
        AppState.view = 'circles';
        // Restore return path if session expired redirect
        try {
          var ret = JSON.parse(localStorage.getItem('pmDrillReturnPath') || 'null');
          if (ret && ret.view && Date.now() - ret.ts < 30 * 60 * 1000) {
            AppState.view = ret.view;
            localStorage.removeItem('pmDrillReturnPath');
          }
        } catch (_) {}
        render();
      })
      .catch(function (e) {
        AppState.authLoading = false;
        AppState.authError = { code: 'NETWORK_ERROR', message: '連線失敗，請稍後再試' };
        render();
      });
  }

  function doAuthRegister(email, pw) {
    if (pw.length < 6) {
      AppState.authError = { code: 'WEAK_PASSWORD', message: '密碼至少 6 字' };
      render();
      return;
    }
    AppState.authLoading = true;
    AppState.authError = null;
    render();
    // POST /api/auth/register → backend creates user with email_confirm:true
    fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email, password: pw }),
    }).then(function (r) {
      return r.json().then(function (body) { return { ok: r.ok, body: body }; });
    }).then(function (result) {
      if (!result.ok) {
        AppState.authLoading = false;
        var msg = (result.body && result.body.error) || '註冊失敗，請重試';
        var code = 'REGISTER_ERROR';
        if (/already registered|duplicate|exists/i.test(msg)) code = 'EMAIL_EXISTS';
        else if (/password|密碼/i.test(msg)) code = 'WEAK_PASSWORD';
        AppState.authError = { code: code, message: msg };
        render();
        return;
      }
      // Registration succeeded → auto sign-in
      if (!window.supabaseClient) {
        AppState.authLoading = false;
        AppState.authError = { code: 'NETWORK_ERROR', message: '服務暫不可用，請手動登入' };
        AppState.authTab = 'login';
        render();
        return;
      }
      return window.supabaseClient.auth.signInWithPassword({ email: email, password: pw });
    }).then(function (signInResult) {
      if (!signInResult) return; // already handled above
      AppState.authLoading = false;
      if (signInResult.error) {
        // Registration OK but auto-login failed — redirect to login tab
        AppState.authTab = 'login';
        AppState.authError = null;
        render();
        return;
      }
      var session = signInResult.data && signInResult.data.session;
      if (session) {
        AppState.accessToken = session.access_token;
        AppState.userEmail = (session.user && session.user.email) || email;
        AppState.sessionExpired = false;
        AppState.authError = null;
        AppState._authEmail = '';
        AppState._authPw = '';
        // New user — no migration needed (no prior guest sessions of significance)
        resetCirclesToHome();
        AppState.view = 'circles';
        render();
      }
    }).catch(function () {
      AppState.authLoading = false;
      AppState.authError = { code: 'NETWORK_ERROR', message: '連線失敗，請稍後再試' };
      render();
    });
  }

  function doMigration(guestId) {
    if (!guestId || !AppState.accessToken) return;
    // Best-effort migration — fire-and-forget, no error blocks user
    fetch('/api/migrate-guest', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + AppState.accessToken,
        'X-Guest-ID': guestId,
      },
      body: JSON.stringify({}),
    }).then(function (r) {
      return r.json();
    }).then(function (result) {
      var total = (result.circles || 0) + (result.nsm || 0) + (result.legacy || 0);
      if (total > 0) {
        AppState.migrationBanner = 'showing';
        render();
        // Auto-dismiss after 5s
        setTimeout(function () {
          AppState.migrationBanner = 'dismissed';
          render();
        }, 5000);
      }
    }).catch(function (e) {
      // Migration failed — log warn, don't block user
      console.warn('[migration] failed:', e);
    });
  }

  // ── renderNavbar (per spec §2.10 + mockup 01 / 03 / 06 contract) ──────────
  // Actions rule:
  //   CIRCLES home guest:  sign-in (all viewports — user 2026-05-04 親要求 override mockup line 803)
  //   CIRCLES home authed: email + sign-out                            (mockup 01 line 986-989, no home — already at home)
  //   Deep view  guest:    sign-in + home (both visible all viewports) — user functional requirement
  //   Deep view  authed:   email + sign-out + home                     (mockup 03 line 1077)
  function renderNavbar() {
    const view = AppState.view;
    const isCirclesHome = (
      view === 'circles' && AppState.circlesPhase === 1
      && !AppState.circlesSelectedQuestion && !AppState.circlesSession
    );

    const tabs = (view === 'circles' || view === 'nsm') ?
      `<div class="navbar__tabs">
         <button class="navbar__tab ${view==='circles'?'is-active':''}" data-nav="circles">CIRCLES</button>
         <button class="navbar__tab ${view==='nsm'?'is-active':''}" data-nav="nsm">北極星指標</button>
       </div>` : '';

    const homeBtn = '<button class="navbar__icon-btn" data-nav="home" aria-label="回首頁"><i class="ph ph-house"></i></button>';
    const signInBtn = '<button class="navbar__icon-btn" data-nav="auth" aria-label="登入"><i class="ph ph-sign-in"></i></button>';

    const signOutBtn = '<button class="navbar__icon-btn" data-nav="logout" aria-label="登出"><i class="ph ph-sign-out"></i></button>';
    const emailSpan = `<span class="navbar__email">${escHtml(AppState.userEmail || '')}</span>`;

    // Phase 2: turn counter badge in navbar (mockup 05 line 865-866)
    const isPhase2WithTurns = view === 'circles'
      && AppState.circlesPhase === 2
      && AppState.circlesConversation
      && AppState.circlesConversation.length > 0;
    const turnBadge = isPhase2WithTurns
      ? `<span class="turn-badge">${AppState.circlesConversation.length} 輪</span>`
      : '';

    let actions;
    if (AppState.accessToken) {
      actions = emailSpan + turnBadge + signOutBtn + (isCirclesHome ? '' : homeBtn);
    } else if (isCirclesHome) {
      actions = signInBtn; // mobile + tablet + desktop 都顯示（user 2026-05-04 親要求）
    } else {
      actions = turnBadge + signInBtn + homeBtn; // deep view guest: both visible all viewports
    }

    return `<header class="navbar">
      <button class="navbar__icon-btn" data-nav="offcanvas" aria-label="練習記錄"><i class="ph ph-list"></i></button>
      <div class="navbar__brand" data-nav="home">
        <span class="navbar__brand-icon"><i class="ph ph-circles-three"></i></span>
        <span class="navbar__brand-name">PM Drill</span>
      </div>
      ${tabs}
      <div class="navbar__actions">${actions}</div>
    </header>`;
  }

  // ── renderResumeToast — Mockup 16 §D cross-tab in-flight notification ───────
  // Shows when a background API call is in-flight and user has navigated away.
  // Three variants: CIRCLES evaluate-step / NSM gate / Phase 4 final-report.
  function renderResumeToast() {
    if (AppState.evalToastDismissed) return '';

    var circlesEvalAway = AppState.circlesEvaluating
      && !(AppState.view === 'circles' && AppState.circlesPhase === 3);

    var nsmGateAway = AppState.nsmGateLoading
      && !(AppState.view === 'nsm');

    var phase4Away = AppState._phase4FinalReportFired
      && !AppState.circlesFinalReport
      && !AppState.circlesPhase4Error
      && !(AppState.view === 'circles' && AppState.circlesPhase === 4);

    var toastCopy = null;
    var toastNav  = null;
    if (circlesEvalAway) {
      toastCopy = 'CIRCLES 評分仍在背景進行中';
      toastNav  = 'circles-phase3';
    } else if (nsmGateAway) {
      toastCopy = 'NSM 審核仍在背景進行中';
      toastNav  = 'nsm';
    } else if (phase4Away) {
      toastCopy = '總結報告生成中';
      toastNav  = 'circles-phase4';
    }

    if (!toastCopy) return '';

    return '<div class="resume-toast" role="status" aria-live="polite" data-resume-toast-wrap>'
      + '<span class="resume-toast__icon"><i class="ph ph-circle-notch"></i></span>'
      + '<div class="resume-toast__body" data-resume-toast="navigate" data-resume-nav="' + toastNav + '">'
      +   escHtml(toastCopy)
      +   '<span class="resume-toast__hint">完成時切回自動顯示</span>'
      + '</div>'
      + '<button class="resume-toast__close" data-resume-toast="dismiss" aria-label="關閉提示"><i class="ph ph-x"></i></button>'
      + '</div>';
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
    if (AppState.sessionExpired && AppState.view !== 'auth') {
      banners.push(`<div class="banner banner--session">
        <span class="banner__icon"><i class="ph ph-info"></i></span>
        <div class="banner__main"><div class="banner__title">登入逾時</div>
          <div class="banner__sub">為了保護你的資料，已登出。</div></div>
        <button class="banner__action" data-nav="auth">重新登入</button>
      </div>`);
    }
    // Migration success banner (post-login guest→authed merge)
    if (AppState.migrationBanner === 'showing') {
      banners.push('<div class="migration-banner" style="margin:0;">'
        + '<i class="ph ph-cloud-arrow-up"></i>'
        + '<div><strong>練習記錄已合併</strong>你之前以遊客模式練的紀錄，現在永久保留在雲端。</div>'
        + '</div>');
    }
    // Resume-toast — cross-tab in-flight notification (mockup 16 §D)
    banners.push(renderResumeToast());
    return banners.join('');
  }

  // Reset CIRCLES sub-state so home renderer shows mockup 01 home (mode-cards + qcards)
  // 而非繼續停在 Phase 1 form / qchip-expand / Phase 2 chat 等深層 state。
  // user 2026-05-04: 「點擊回首頁、icon 都無法回首頁」— 原本 home nav 只切 view 不 reset
  // sub-state，導致 renderView() 仍命中 renderCirclesPhase1()。
  function resetCirclesToHome() {
    AppState.circlesPhase = 1;
    AppState.circlesMode = null;
    AppState.circlesDrillStep = null;
    AppState.circlesSimStep = 0;
    AppState.circlesSelectedQuestion = null;
    AppState.circlesSession = null;
    AppState.circlesFrameworkDraft = {};
    AppState.circlesConversation = [];
    AppState.circlesGateResult = null;
    AppState.circlesScoreResult = null;
    AppState.circlesStepScores = {};
    AppState.circlesEvaluating = false;
    AppState.circlesEvaluateError = null;
    AppState.circlesFinalReport = null;
    AppState.circlesStale = false;
    AppState.circlesLocked = false;
    AppState.circlesChipExpanded = false;
    AppState.circlesPhase1Solutions = [
      { name: '', mechanism: '' },
      { name: '', mechanism: '' },
    ];
    AppState.circlesPhase1S = {
      recommendation: '',
      reasoning: '',
      nsm: '',
      tracking: { reach: '', depth: '', frequency: '', impact: '' },
    };
    AppState.circlesExpandedQid = null;
    // Phase 3 state reset
    AppState.circlesPhase3Error = null;
    AppState.circlesPhase3LoadingStep = 0;
    AppState.circlesPhase3LoadingSlow = false;
    AppState.circlesPhase3DimExpanded = {};
    AppState.circlesPhase3CoachDemoOpen = false;
    AppState._phase3CoachDemoInitialized = false;
    // Phase 4 state reset
    AppState.circlesPhase4Error = null;
    AppState.circlesPhase4LoadingStep = 0;
    clearPhase4Timers();
    setPhase4Fired(false);
    // Resume-toast reset
    AppState.evalToastDismissed = false;
  }

  function bindNavbar() {
    document.querySelectorAll('[data-nav]').forEach(function (el) {
      el.addEventListener('click', function () {
        const target = el.dataset.nav;
        if (target === 'home') {
          // home always resets (intent: go back to CIRCLES home)
          resetCirclesToHome(); AppState.view = 'circles'; render();
        } else if (target === 'circles') {
          // If CIRCLES evaluation is in-flight, switch view without resetting session
          if (AppState.circlesEvaluating) {
            AppState.evalToastDismissed = false; // clear dismissed when returning
            AppState.view = 'circles';
            render();
          } else {
            resetCirclesToHome(); AppState.view = 'circles'; render();
          }
        } else if (target === 'nsm') {
          AppState.evalToastDismissed = false; // clear dismissed on explicit tab switch
          // User-requested 2026-05-11: do NOT auto-reset mid-flow user back to the
          // question-selection page (Step 1). Only reset when there's no active session.
          var hasActiveSession = AppState.nsmSelectedQuestion && (AppState.nsmStep >= 2 && AppState.nsmStep <= 4);
          if (!hasActiveSession && !(AppState.nsmGateLoading || AppState.nsmEvalLoading)) {
            AppState.nsmStep = 1;
            AppState.nsmSubTab = null;
          }
          AppState.view = 'nsm';
          render();
        } else if (target === 'auth')    { AppState.authError = null; AppState.view = 'auth'; render(); }
        else if (target === 'offcanvas') {
          AppState.offcanvasOpen = true;
          AppState.historyList = null;
          render();
          loadHistory();
        } else if (target === 'logout') {
          doLogout();
        }
      });
    });

    // ── Resume-toast event delegation ────────────────────────────────────────
    document.addEventListener('click', function (e) {
      var dismissBtn = e.target.closest('[data-resume-toast="dismiss"]');
      if (dismissBtn) {
        AppState.evalToastDismissed = true;
        render();
        return;
      }
      var navBody = e.target.closest('[data-resume-toast="navigate"]');
      if (navBody) {
        var dest = navBody.dataset.resumeNav;
        AppState.evalToastDismissed = false;
        if (dest === 'circles-phase3') {
          AppState.view = 'circles';
          // phase already 3, don't reset
          render();
        } else if (dest === 'circles-phase4') {
          AppState.view = 'circles';
          // phase already 4, don't reset
          render();
        } else if (dest === 'nsm') {
          AppState.view = 'nsm';
          render();
        }
      }
    }, { capture: false });
  }

  function doLogout() {
    // Clear AppState
    AppState.accessToken = null;
    AppState.userEmail = null;
    AppState.sessionExpired = false;
    AppState.migrationBanner = null;
    AppState.authError = null;
    // Clear localStorage token entries
    try {
      const raw = localStorage.getItem('pmDrillState');
      if (raw) {
        const snap = JSON.parse(raw);
        snap.accessToken = null;
        snap.userEmail = null;
        localStorage.setItem('pmDrillState', JSON.stringify(snap));
      }
    } catch (_) {}
    // Sign out from Supabase (fire-and-forget)
    if (window.supabaseClient) {
      window.supabaseClient.auth.signOut().catch(function () {});
    }
    // Return to circles home as guest
    resetCirclesToHome();
    AppState.view = 'circles';
    render();
  }

  // ── CIRCLES_STEP_CONFIG (Plan B SB3 — mockup 03 + spec §3.1) ─────────────
  // C1 / I / R / C2 4 step × 4 field complete schema.
  // L / E / S deferred to SB4.
  var CIRCLES_STEP_CONFIG = {
    C1: {
      eyebrow: { sim: 'Phase 1 · 寫框架', drill: 'Phase 1 · 個別步驟練習' },
      title: 'C · 澄清情境',
      titleDrillSuffix: '',
      progressLabel: '澄清',
      stepLetter: 'C',
      stepNum: '01',
      railTitle: 'C 步重點',
      railIntro: '確認題目邊界',
      railBody: '先把題目本身定義清楚 — 它的具體類型是什麼？涵蓋哪些場景？哪些明確排除？沒釐清這層，後面分析會在錯的邊界上展開。',
      railTitle2: '時間範圍提示',
      railBody2: '設定一個合理的觀察期，並說明為什麼這個時長對應業務節奏。「X 天，因為這個業務以 Y 為週期」比丟個數字更有說服力。',
      fields: [
        { key: '問題範圍', placeholder: '聚焦免費版的廣告體驗，排除付費方案', minMax: '50-120', max: 120, rows: 3, hint: '寫具體的功能或場景邊界' },
        { key: '時間範圍', placeholder: '60 天，因為廣告活動以月為週期', minMax: '30-100', max: 100, rows: 2, hint: '說明為什麼這個時長對應業務節奏' },
        { key: '業務影響', placeholder: '廣告收入和免費→付費轉換率不能下降超過 3%', minMax: '40-120', max: 120, rows: 2, hint: '列出量化紅線 — 哪些指標不能下降' },
        { key: '假設確認', placeholder: '用戶廣告負感主要來自時段而非廣告本身', minMax: '30-100', max: 100, rows: 2, hint: '寫 2-3 條後續分析會依賴的假設' },
      ],
    },
    I: {
      eyebrow: { sim: 'Phase 1 · 寫框架', drill: 'Phase 1 · 個別步驟練習' },
      title: 'I · 定義用戶',
      titleDrillSuffix: '',
      progressLabel: '用戶',
      stepLetter: 'I',
      stepNum: '02',
      railTitle: 'I 步重點',
      railIntro: '鎖定目標用戶',
      railBody: '用戶分群不是列舉所有人，而是找出「最值得為誰解決」的那群。分群依據要可操作，焦點選定要有理由。',
      railTitle2: '動機假設提示',
      railBody2: 'JTBD（Jobs to Be Done）不是描述用戶是誰，而是他們雇用這個產品「完成什麼工作」。用「當 X 發生時，我想要 Y，以便 Z」的格式思考。',
      fields: [
        { key: '目標用戶分群', placeholder: '免費版通勤 / 運動 / 開車三類重度聽眾', minMax: '40-120', max: 120, rows: 3, hint: '依行為或使用情境分群，不只人口統計' },
        { key: '選定焦點對象', placeholder: '通勤族：每天 30-60 分鐘，廣告打斷影響最大', minMax: '30-100', max: 100, rows: 2, hint: '說明為什麼選這群，而不是其他群' },
        { key: '用戶動機假設(JTBD)', placeholder: '我想在通勤時不被干擾地完整聽完一集 podcast', minMax: '30-100', max: 100, rows: 2, hint: '用「當 X 時，我想要 Y，以便 Z」格式' },
        { key: '排除對象', placeholder: '付費訂閱者：已沒廣告；創作者：需求不同', minMax: '20-80', max: 80, rows: 2, hint: '說明為什麼排除，讓邊界更清楚' },
      ],
    },
    R: {
      eyebrow: { sim: 'Phase 1 · 寫框架', drill: 'Phase 1 · 個別步驟練習' },
      title: 'R · 發掘需求',
      titleDrillSuffix: '',
      progressLabel: '需求',
      stepLetter: 'R',
      stepNum: '03',
      railTitle: 'R 步重點',
      railIntro: '三層需求框架',
      railBody: '功能性（要完成什麼）→ 情感性（感覺如何）→ 社交性（在他人眼中如何）。三層缺一不完整，核心痛點是三層需求未被滿足的交集。',
      railTitle2: '痛點層次提示',
      railBody2: '核心痛點不只是「不方便」，而是用戶已嘗試繞路但仍無解的問題。描述時帶入場景會比抽象說明更有力。',
      fields: [
        { key: '功能性', placeholder: '可跳過廣告 / 廣告頻率可控 / 廣告時機可選', minMax: '40-120', max: 120, rows: 3, hint: '列出用戶想完成的具體任務或操作' },
        { key: '情感性', placeholder: '聽 podcast 的沉浸感不被打斷 / 不感到被强迫', minMax: '30-100', max: 100, rows: 2, hint: '用戶在使用過程中希望有什麼感受' },
        { key: '社交性', placeholder: '能向朋友分享不被廣告打斷的好體驗', minMax: '20-80', max: 80, rows: 2, hint: '用戶如何在社交場合中展示或使用這個產品' },
        { key: '核心痛點', placeholder: '通勤聽到一半被廣告打斷，回不到剛才的心流狀態', minMax: '30-100', max: 100, rows: 2, hint: '最根本的、用戶已嘗試但未能解決的問題' },
      ],
    },
    C2: {
      eyebrow: { sim: 'Phase 1 · 寫框架', drill: 'Phase 1 · 個別步驟練習' },
      title: 'C · 優先排序',
      titleDrillSuffix: '',
      progressLabel: '排序',
      stepLetter: 'C',
      stepNum: '04',
      railTitle: 'C 步重點',
      railIntro: '顯性化取捨邏輯',
      railBody: '排序不是列清單，而是說明「用什麼標準決定先後」。取捨標準要與業務目標和用戶痛點連結，理由要可被質疑。',
      railTitle2: '排序理由提示',
      railBody2: '避免只說「影響最大」— 要說明影響了什麼、為什麼這個影響比其他的更重要、為什麼現在是做它的時機。',
      fields: [
        { key: '取捨標準', placeholder: '用戶衝擊 × 廣告收入影響 × 實作複雜度的 3×3 矩陣', minMax: '40-120', max: 120, rows: 3, hint: '列出 2-3 個判斷優先級的明確標準' },
        { key: '最優先', placeholder: '廣告時機控制：高衝擊、低廣告損失、實作中等', minMax: '30-100', max: 100, rows: 2, hint: '說明為什麼這個最優先，連結取捨標準' },
        { key: '暫緩', placeholder: '廣告跳過：收入影響難量化，需先測試', minMax: '20-80', max: 80, rows: 2, hint: '說明暫緩的邏輯，不是說它不重要' },
        { key: '排序理由', placeholder: '聚焦廣告時機可立即改善通勤族體驗，又不破壞收入模式', minMax: '30-100', max: 100, rows: 2, hint: '用一句話說明整體排序的核心考量' },
      ],
    },
    L: {
      eyebrow: { sim: 'Phase 1 · 寫框架', drill: 'Phase 1 · 個別步驟練習' },
      title: 'L · 提出方案',
      titleDrillSuffix: '',
      progressLabel: '方案',
      stepLetter: 'L',
      stepNum: '05',
      railTitle: 'L 步重點',
      railIntro: '提出 2-3 個有方向差異的方案',
      railBody: '方案二要和方案一在「方向」上有本質差異 — 不是更多，而是不同。例如方案一是系統主動，方案二可以是用戶主動；或方案一是短期戰術，方案二是長期重設計。',
      railTitle2: '方案三是加分項',
      railBody2: '湊數寧可不填 — 說明「前兩個已涵蓋主要可能性」也是有效回答。',
      isSolMulti: true,
      isLstep: true,
      solCardField: {
        label: '核心機制',
        placeholders: {
          sol1: '描述方案一的核心機制（與目標連結）',
          sol2: '與方案一在「方向」上有本質差異 — 不是更多，而是不同',
          sol3Mobile: '加分項 — 第三個真正不同的思路（更激進、更長線）',
          sol3Desktop: '第三個真正不同的思路 — 例如：把廣告變成內容（品牌 podcast）；或從供給端切（廣告主競價）',
        },
        nameInputPlaceholders: {
          default: '方案名稱（10 字內）',
          sol3Desktop: '方案名稱（10 字內）— 加分項，更激進或長線',
        },
      },
    },
    E: {
      // Plan B SB7 — E step (mockup 03 line 1466 規則 — 沿用 L 結構，per-solution × 4 nested fields)
      eyebrow: { sim: 'Phase 1 · 寫框架', drill: 'Phase 1 · 個別步驟練習' },
      title: 'E · 評估取捨',
      titleSimDesktopSuffix: '',
      progressLabel: '取捨',
      stepLetter: 'E',
      stepNum: '06',
      isEstep: true,
      railTitle: 'E 步重點',
      railIntro: '誠實寫每個方案的優缺點、風險、成功指標',
      railBody: '不要只挑優點 — 寫缺點和風險才能看出對 trade-off 的理解。風險與依賴要具體（不是「可能會失敗」這種空話）；成功指標必須量化可測。',
      railTitle2: '為何要評估每個方案',
      railBody2: '面試官不是在看你選哪個 — 是看你怎麼判斷取捨。寫得越誠實，越能展現產品 sense。',
      perSolFields: [
        { key: 'advantages',    label: '優點',       placeholder: '本方案最強的 1-2 個優勢，能解決什麼用戶痛點',                 minMax: '40-150', max: 150, rows: 3 },
        { key: 'disadvantages', label: '缺點',       placeholder: '本方案的限制或副作用 — 哪些用戶體驗會變差，哪些情況不適用', minMax: '40-150', max: 150, rows: 3 },
        { key: 'risks',         label: '風險與依賴', placeholder: '技術 / 人力 / 時程 / 第三方依賴 — 具體列出，不要寫「可能會失敗」', minMax: '40-150', max: 150, rows: 3 },
        { key: 'metrics',       label: '成功指標',   placeholder: '如何驗證方案有效 — 定量指標 + 觀察期（如：30 天內 +5pp 留存）', minMax: '30-100', max: 100, rows: 2 },
      ],
      fields: [],  // legacy compat — renderCirclesPhase1 base 路徑不會走到這
    },
    S: {
      // Plan B SB5 — S step (mockup 03 Section C line 1469-1758)
      eyebrow: { sim: 'Phase 1 · 寫框架（最後一步）', drill: 'Phase 1 · 個別步驟練習' },
      title: 'S · 總結推薦',
      titleSimDesktopSuffix: '',
      progressLabel: '總結',
      stepLetter: 'S',
      stepNum: '07',
      isSstep: true,
      cta: '完成測驗',
      fields: [
        { key: '推薦方案',   placeholder: '推薦哪個方案 + 一句話總判斷',                          rows: 2 },
        { key: '選擇理由',   placeholder: '引用 E 結論的 3 個面向 / 對比放棄方案 / 回應最大缺點', rows: 3 },
        { key: '北極星指標', placeholder: 'NSM 定義含行為門檻 / 為什麼能反映成效',               rows: 2 },
      ],
      trackingDimsByType: {
        attention:   { reach: '觸及廣度', depth: '互動深度', frequency: '習慣頻率', impact: '留存驅力' },
        transaction: { reach: '供給廣度', depth: '需求深度', frequency: '匹配效率', impact: '復購留存' },
        creator:     { reach: '創造廣度', depth: '成果品質', frequency: '採用廣度', impact: '商業轉化' },
        saas:        { reach: '啟用廣度', depth: '席次深度', frequency: '黏著頻率', impact: '擴張信號' },
      },
      trackingPlaceholders: {
        reach: '例：MAU ≥ 1.2M',
        depth: '例：avg 25 min/session',
        frequency: '例：65% 用戶 weekly ≥ 3 days',
        impact: '例：70% retention',
      },
      trackingSubsByType: {
        attention: {
          reach: '每月至少播放 1 首歌的 MAU 數',
          depth: '每 session 平均聆聽時長（分鐘）',
          frequency: '每週使用 ≥ 3 天的用戶佔比',
          impact: '擁有 ≥ 5 首收藏歌曲的 30 日留存率',
        },
      },
      railTitle: 'S 步重點',
      railIntro: '總結推薦 + NSM + 4 維度追蹤',
      railBody: '推薦方案要可操作，NSM 必須含「行為門檻 + 為什麼能反映成效」。4 維度排除虛榮指標。',
      railTitle2: '產業類型動態 label',
      railBody2Dynamic: true, // rendered with type substitution
    },
  };

  // ── getHintApiField: UI field label → backend FIELD_GUIDANCE key (POST /api/circles-public/hint) ──
  // backend prompts/circles-hint.js FIELD_GUIDANCE keys 與 UI config 微差異，需 alias
  function getHintApiField(stepKey, fieldKey) {
    var aliasMap = {
      I: { '選定焦點對象': '選定焦點', '用戶動機假設(JTBD)': '用戶動機假設' },
      R: { '功能性': '功能性需求', '情感性': '情感性需求', '社交性': '社交性需求' },
      C2: { '最優先': '最優先項目', '暫緩': '暫緩項目' },
      L: { '方案三': '方案三（可選）' },
      E: { '優點': '方案優點', '缺點': '方案缺點' }
    };
    if (aliasMap[stepKey] && aliasMap[stepKey][fieldKey]) return aliasMap[stepKey][fieldKey];
    // S step tracking dim：直接送 dimZh 給 backend
    // backend FIELD_GUIDANCE 沒對應 → 落到 fallback prompt「步驟 S 中『dimZh』的面向」
    // → AI 看到 dim 名稱 + 題目 context，生成 dim-specific 個人化 hint（非通用 4-dim）
    return fieldKey;
  }

  // ── getFieldExampleKey: 把 config field key 轉成 DB field_examples key ──
  // DB schema 與 config schema 微差異：I (JTBD) / R (需求 suffix) / C2 (項目 suffix)
  function getFieldExampleKey(stepKey, fieldKey) {
    var aliasMap = {
      I: { '用戶動機假設(JTBD)': '用戶動機假設' },
      R: { '功能性': '功能性需求', '情感性': '情感性需求', '社交性': '社交性需求' },
      C2: { '最優先': '最優先項目', '暫緩': '暫緩項目' },
      L: { '方案三': '方案三（可選）' }
    };
    if (aliasMap[stepKey] && aliasMap[stepKey][fieldKey]) return aliasMap[stepKey][fieldKey];
    return fieldKey;
  }

  // filterTrackingExampleByDim — DB「追蹤指標」單一 entry 含完整 4-dim markdown,
  // 用 top-level bullet 開頭的關鍵字（廣度／深度／頻率／留存或業務影響等）擷取對應 dim 段落。
  // user 2026-05-04: 4 個 tracking-card 的範例答案要 per-dim,不是全部共享同一份。
  function filterTrackingExampleByDim(md, dimKey) {
    if (!md) return '';
    var dimMarkers = {
      reach:     ['廣度', '觸及', '啟用', '覆蓋', '影響範圍', 'reach'],
      depth:     ['深度', '互動', '席次', '專注', 'depth'],
      frequency: ['頻率', '習慣', '黏著', 'frequency'],
      impact:    ['留存', '影響', '驅力', '擴張', 'impact', 'MAU', '業務']
    };
    var markers = dimMarkers[dimKey] || [];
    var lines = md.split('\n');
    var blocks = [];
    var cur = [];
    lines.forEach(function (ln) {
      if (/^- /.test(ln)) {
        if (cur.length) blocks.push(cur);
        cur = [ln];
      } else if (cur.length) {
        cur.push(ln);
      }
    });
    if (cur.length) blocks.push(cur);
    var found = blocks.find(function (b) {
      return markers.some(function (m) { return b[0].indexOf(m) !== -1; });
    });
    return found ? found.join('\n') : '';
  }

  // ── Plan B SB9b: locked / stale / save-error banner + variants (mockup 03 Section E line 1953-2106) ──
  function renderLockedBanner(score) {
    var subText = '只鎖定編輯,答案仍可閱讀;要修改請從首頁開新場練習。';
    var titleHtml = score != null
      ? '已評分鎖定 · ' + score + ' / 100'
      : '已評分鎖定';
    return '<div class="banner banner--locked">'
      + '<span class="banner__icon"><i class="ph ph-lock-key"></i></span>'
      + '<div class="banner__main">'
      + '<div class="banner__title">' + escHtml(titleHtml) + '</div>'
      + '<div class="banner__sub">' + escHtml(subText) + '</div>'
      + '</div>'
      + '</div>';
  }

  function renderStaleBanner() {
    return '<div class="banner banner--stale">'
      + '<span class="banner__icon"><i class="ph ph-warning-octagon"></i></span>'
      + '<div class="banner__main">'
      + '<div class="banner__title">題庫已更新 — 顯示為唯讀</div>'
      + '<div class="banner__sub">這份紀錄的題目陳述（problem_statement）與資料庫目前版本不同。為避免分析錯亂,整份練習轉為唯讀;可回首頁用最新題目重練。</div>'
      + '</div>'
      + '</div>';
  }

  function renderSaveErrorBanner() {
    return '<div class="banner banner--save-error">'
      + '<i class="ph ph-cloud-warning"></i>'
      + '<div>'
      + '<strong>離線中 · 已存於本機</strong>'
      + '你的修改已保存到瀏覽器,等網路恢復會自動同步到雲端。也可<a href="#" data-phase1="save-retry">立即重試</a>。'
      + '</div>'
      + '</div>';
  }

  // applyPhase1StateOverlay — post-render transform: inject banner + rt-field--locked + submit-bar variant
  // 用 post-process 不污染 4 個 phase-1 renderer (base / L / E / S)
  function applyPhase1StateOverlay(html) {
    var locked = AppState.circlesLocked;
    var stale = AppState.circlesStale;
    var saveError = AppState.circlesPhase1SaveState === 'error';
    var emptyHint = AppState.circlesPhase1EmptyHint;

    // Empty-draft inline hint banner (GAP 1 — spec §6 visible signal)
    if (emptyHint) {
      var emptyBannerHtml = '<div class="banner banner--warn" data-banner="empty-hint">請至少填寫一個欄位再提交審核</div>';
      var emptyIdx = html.indexOf('<div class="phase-body');
      if (emptyIdx === -1) emptyIdx = html.indexOf('<div class="submit-bar"');
      if (emptyIdx !== -1) {
        html = html.slice(0, emptyIdx) + emptyBannerHtml + html.slice(emptyIdx);
      }
    }

    // Layer 1: minLength gate — disable submit when any standard field below floor
    // (Defer minLength replacement until AFTER locked/stale/saveError swap their button HTML;
    //  otherwise their regex (which matches a bare data-phase1="submit"> with no attrs) won't fire.)
    var minLengthBlocked = !locked && !stale && computePhase1MinLengthBlocked();

    if (!locked && !stale && !saveError) {
      if (minLengthBlocked) {
        html = html.replace(
          /<button class="btn btn--primary" data-phase1="submit">/,
          '<button class="btn btn--primary" data-phase1="submit" disabled>'
        );
      }
      return html;
    }

    // 1) inject banner: before first .phase-body OR before .submit-bar (S step has tracking-section before phase-body)
    var bannerHtml = '';
    if (locked) {
      var score = (AppState.circlesScoreResult && AppState.circlesScoreResult.totalScore) || null;
      bannerHtml = renderLockedBanner(score);
    } else if (stale) {
      bannerHtml = renderStaleBanner();
    } else if (saveError) {
      bannerHtml = renderSaveErrorBanner();
    }
    // inject after phase-head close (look for first '</div>' that closes a div with class containing 'phase-head')
    // simpler: insert before first occurrence of '<div class="phase-body' or 'class="submit-bar"'
    var injectMarker = '<div class="phase-body';
    var idx = html.indexOf(injectMarker);
    if (idx === -1) {
      injectMarker = '<div class="submit-bar"';
      idx = html.indexOf(injectMarker);
    }
    if (idx !== -1) {
      html = html.slice(0, idx) + bannerHtml + html.slice(idx);
    }

    // 2) rt-field--locked: only locked + stale (save-error 不鎖,user 仍可改草稿)
    if (locked || stale) {
      html = html.split('class="rt-field"').join('class="rt-field rt-field--locked"');
      html = html.split('class="rt-field rt-field__solo"').join('class="rt-field rt-field__solo rt-field--locked"');
      // contenteditable="true" → "false"
      html = html.split('contenteditable="true"').join('contenteditable="false"');
      // sol-card name input + S tracking input → readonly
      html = html.replace(/<input([^>]*?)data-s-tracking=/g, '<input$1 readonly data-s-tracking=');
      html = html.replace(/<input class="sol-card__name-input"/g, '<input class="sol-card__name-input" readonly');
    }

    // 3) submit-bar primary 變體
    if (locked) {
      // 看評分結果
      html = html.replace(
        /<button class="btn btn--primary" data-phase1="submit">[^<]*<i class="ph ph-arrow-right"><\/i><\/button>/,
        '<button class="btn btn--primary" data-phase1="view-score">看評分結果<i class="ph ph-arrow-right"></i></button>'
      );
    } else if (stale) {
      html = html.replace(
        /<button class="btn btn--primary" data-phase1="submit">[^<]*<i class="ph ph-arrow-right"><\/i><\/button>/,
        '<button class="btn btn--primary" data-phase1="restart-fresh"><i class="ph ph-arrow-clockwise"></i>用最新題目重練</button>'
      );
    } else if (saveError) {
      html = html.replace(
        /<button class="btn btn--primary" data-phase1="submit">[^<]*<i class="ph ph-arrow-right"><\/i><\/button>/,
        '<button class="btn btn--primary" data-phase1="submit" disabled>下一步（請先恢復連線）</button>'
      );
    }

    return html;
  }

  // applyNSMStateOverlay — post-render transform: inject banner + rt-field--locked + submit-bar variant
  // Per UNIVERSAL standing rule feedback_lock_state_hint_example_always_available.md:
  //   only lock textarea inputs + submit; NEVER touch .field__hint-row / .field__hint-link / .field-example-toggle
  // step === 2: lock nsm-input + nsm-rt-field (3 fields) + submit-bar → 「查看評分結果」
  // step === 3: lock nsm-rt-field.nsm-rt-textarea (4 dim textareas) + submit-bar → 「查看評分結果」
  function applyNSMStateOverlay(html, step) {
    if (!AppState.nsmEvalResult) return html;

    // 1) inject banner before <div class="nsm-body"
    var bannerHtml = '<div class="banner banner--locked">'
      + '<span class="banner__icon"><i class="ph ph-lock-key"></i></span>'
      + '<div class="banner__main">'
      + '<div class="banner__title">已評分完成</div>'
      + '<div class="banner__sub">內容鎖定，可繼續查看提示與範例</div>'
      + '</div>'
      + '</div>';
    var injectMarker = '<div class="nsm-body"';
    var idx = html.indexOf(injectMarker);
    if (idx !== -1) {
      html = html.slice(0, idx) + bannerHtml + html.slice(idx);
    }

    // 2) add rt-field--locked class to NSM input fields
    if (step === 2) {
      // NSM single-line input (Step 2 first field: nsm-input)
      html = html.split('class="nsm-input"').join('class="nsm-input rt-field--locked"');
      html = html.replace(/class="nsm-input rt-field--locked"([^>]*)data-nsm-field/g,
        'class="nsm-input rt-field--locked" readonly$1data-nsm-field');
      // rich-text div fields (explanation + businessLink)
      html = html.split('class="nsm-rt-field"').join('class="nsm-rt-field rt-field--locked"');
      // contenteditable="true" → "false" for div-based rt-textarea
      html = html.split('contenteditable="true"').join('contenteditable="false"');
    } else if (step === 3) {
      // dim textarea fields — nsm-rt-field wrapper
      html = html.split('class="nsm-rt-field"').join('class="nsm-rt-field rt-field--locked"');
      // <textarea class="nsm-rt-textarea" → add readonly
      html = html.replace(/<textarea class="nsm-rt-textarea"/g, '<textarea class="nsm-rt-textarea" readonly');
    }

    // 3) replace primary submit button with 「查看評分結果 →」
    // Step 2: button text is 提交審核
    // Step 3: button text is 送出，取得 AI 評分
    // data-nsm-submit may be followed by ' disabled' or ' ' (trailing space from ternary)
    html = html.replace(
      /<button class="btn btn--primary" data-nsm-submit[^>]*>[^<]*<i class="ph ph-arrow-right"><\/i><\/button>/,
      '<button class="btn btn--primary" data-nsm-action="view-eval-result">下一步<i class="ph ph-arrow-right"></i></button>'
    );

    return html;
  }

  // ── Plan B SB9a: save-indicator 4-state helper (mockup 03 Section F line 2160-2174) ──
  // 後端不動 — visual cycle only + localStorage 草稿（無 PATCH /progress）
  function renderSaveIndicator(state) {
    state = state || (AppState.circlesPhase1SaveState || 'idle');
    if (state === 'saving') {
      return '<span class="save-indicator save-indicator--saving">儲存中</span>';
    }
    if (state === 'saved') {
      return '<span class="save-indicator save-indicator--saved"><i class="ph ph-check"></i>已儲存到雲端</span>';
    }
    if (state === 'error') {
      return '<span class="save-indicator save-indicator--error" data-phase1="save-retry"><i class="ph ph-warning-circle"></i>離線中 · 點擊重試</span>';
    }
    // idle (default)
    return '<span class="save-indicator save-indicator--idle">已暫存</span>';
  }

  // setPhase1SaveState — update AppState + in-place swap all .save-indicator HTML
  // 不走 renderApp() 避免重置 contenteditable focus / cursor 位置
  function setPhase1SaveState(s) {
    AppState.circlesPhase1SaveState = s;
    document.querySelectorAll('.save-indicator').forEach(function (el) {
      var wrapper = document.createElement('span');
      wrapper.innerHTML = renderSaveIndicator(s);
      el.replaceWith(wrapper.firstChild);
    });
  }

  // global delegation: error state click → retry save cycle
  // 用 document-level delegation 避免 in-place swap 後失去 listener
  if (typeof document !== 'undefined' && !document._sb9aRetryBound) {
    document.addEventListener('click', function (e) {
      var t = e.target.closest('[data-phase1="save-retry"]');
      if (t) triggerSaveCycle();
    });
    document._sb9aRetryBound = true;
  }

  // Layer 1: click on disabled [data-phase1="submit"] → show inline tip near submit-bar
  // (click events don't fire on disabled buttons but DO bubble from parent elements)
  if (typeof document !== 'undefined' && !document._minLengthTipBound) {
    document.addEventListener('click', function (e) {
      var btn = e.target.closest && e.target.closest('[data-phase1="submit"]');
      if (!btn || !btn.disabled) return;
      var stepKey = AppState.circlesMode === 'drill'
        ? AppState.circlesDrillStep
        : (['C1', 'I', 'R', 'C2', 'L', 'E', 'S'][AppState.circlesSimStep || 0] || 'C1');
      var stepCfg = CIRCLES_STEP_CONFIG[stepKey];
      if (!stepCfg || !stepCfg.fields || !stepCfg.fields.length) return;
      var draft = (AppState.circlesFrameworkDraft && AppState.circlesFrameworkDraft[stepKey]) || {};
      var blocked = stepCfg.fields.find(function (f) {
        return !fieldMinLengthOk(draft[f.key], parseFloor(f.minMax));
      });
      if (blocked) {
        showSubmitBlockTip('「' + blocked.key + '」至少需要 ' + parseFloor(blocked.minMax) + ' 字');
      }
    });
    document._minLengthTipBound = true;
  }

  function showSubmitBlockTip(msg) {
    var existing = document.querySelector('.submit-block-tip');
    if (existing) existing.remove();
    var tip = document.createElement('div');
    tip.className = 'submit-block-tip';
    tip.textContent = msg;
    document.body.appendChild(tip);
    setTimeout(function () { if (tip && tip.parentNode) tip.remove(); }, 4000);
  }

  var _saveDebounce = null;
  var _saveCycleT2 = null;
  var EMPTY_HINT_VISIBLE_MS = 3500;
  var emptyHintTimerId = null;

  // ensureCirclesDraftSession — lazy-create backend session row on first save.
  // idempotent: same user×question×mode active session is returned if already exists.
  // Returns session object (with .id) or null on failure.
  async function ensureCirclesDraftSession() {
    if (AppState.circlesSession && AppState.circlesSession.id) return AppState.circlesSession;
    var q = AppState.circlesSelectedQuestion;
    if (!q || !q.id) return null;
    var mode = AppState.circlesMode === 'drill' ? 'drill' : 'simulation';
    var drillStep = mode === 'drill' ? AppState.circlesDrillStep : undefined;
    var path = AppState.accessToken ? '/api/circles-sessions/draft' : '/api/guest-circles-sessions/draft';
    var body = { question_id: q.id, mode: mode };
    if (drillStep) body.drill_step = drillStep;
    try {
      var res = await window.apiFetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) return null;
      var session = await res.json();
      AppState.circlesSession = session;
      return session;
    } catch (e) {
      return null;
    }
  }

  // triggerSaveCycle: input → 800ms debounce → saving → 600ms write → saved → 2000ms idle
  // localStorage write 失敗 → error state（user 點 retry 才重跑）
  // 新增：saving phase 內 lazy-create backend session + fire-and-forget PATCH progress
  function triggerSaveCycle() {
    if (_saveDebounce) clearTimeout(_saveDebounce);
    if (_saveCycleT2) clearTimeout(_saveCycleT2);
    _saveDebounce = setTimeout(function () {
      setPhase1SaveState('saving');
      var qid = (AppState.circlesSelectedQuestion || {}).id || 'unknown';
      var payload = {
        P1: AppState.circlesPhase1 || null,
        P1S: AppState.circlesPhase1S || null,
        P1L: AppState.circlesPhase1Solutions || null,
        P1E: AppState.circlesPhase1Evaluate || null,
        framework: AppState.circlesFrameworkDraft || null,
        ts: Date.now()
      };
      // 1. localStorage IMMEDIATELY (sync, never blocked by network race)
      try {
        localStorage.setItem('pmdrill:circles:draft:' + qid, JSON.stringify(payload));
      } catch (e) {
        setPhase1SaveState('error');
        return;
      }
      // 2. Backend persistence — AWAIT session creation BEFORE PATCH so first-save
      //    POST /draft latency cannot cause PATCH to be skipped (root cause of P0
      //    user-reported "draft disappeared" — backend step_drafts left at {}).
      (async function persistBackend() {
        try {
          if (!AppState.circlesSession || !AppState.circlesSession.id) {
            await ensureCirclesDraftSession();
          }
          if (AppState.circlesSession && AppState.circlesSession.id) {
            var sid = AppState.circlesSession.id;
            var patchPath = AppState.accessToken
              ? '/api/circles-sessions/' + sid + '/progress'
              : '/api/guest-circles-sessions/' + sid + '/progress';
            await window.apiFetch(patchPath, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                stepDrafts: payload,
                frameworkDraft: AppState.circlesFrameworkDraft || null
              }),
            });
          }
        } catch (_) { /* network error — local cache remains source of truth */ }
      })();
      // 3. Visual cycle (600ms saving spinner — preserve UX, parallel to backend)
      setTimeout(function () {
        setPhase1SaveState('saved');
        _saveCycleT2 = setTimeout(function () { setPhase1SaveState('idle'); }, 2000);
      }, 600);
    }, 800);
  }

  // markdownBulletsToHtml — 簡易 markdown bullet→<li> 轉換（mockup 03 line 1942-1944 example-bullet 規格）
  // 支援：- top, **bold**, 縮排子項（  - sub）
  function markdownBulletsToHtml(md) {
    if (!md) return '<li>（無內容）</li>';
    var lines = md.split('\n');
    var html = '';
    var inSub = false;
    lines.forEach(function (line) {
      if (/^\s*$/.test(line)) return;
      var indent = (line.match(/^\s*/) || [''])[0].length;
      var content = line.replace(/^\s*-\s*/, '').trim();
      if (!content) return;
      // bold
      content = content.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
      if (indent >= 2) {
        if (!inSub) { html += '<ul class="example-sub">'; inSub = true; }
        html += '<li>' + content + '</li>';
      } else {
        if (inSub) { html += '</ul>'; inSub = false; }
        html += '<li>' + content + '</li>';
      }
    });
    if (inSub) html += '</ul>';
    return html;
  }

  // renderHintModalShell — mockup 03 line 1795-1812 verbatim shell；body 由 state 切換 loading/content/error
  // state: 'loading' | 'content' | 'error'
  function renderHintModalShell(stepKey, fieldKey, bodyInnerHtml, isLoading) {
    var qName = (AppState.circlesSelectedQuestion && AppState.circlesSelectedQuestion.company)
      ? AppState.circlesSelectedQuestion.company + '·' + (AppState.circlesSelectedQuestion.product || '')
      : '本題';
    var footHtml = isLoading
      ? '<button class="btn btn--ghost" data-hint-action="close" style="font-size:var(--t-meta); min-height:36px;">關閉</button>'
      : '<button class="btn btn--primary" data-hint-action="close" style="font-size:var(--t-meta); min-height:36px;">了解了</button>';
    var iconHtml = isLoading ? '<i class="ph ph-sparkle"></i>' : '<i class="ph ph-lightbulb"></i>';
    return '<div class="hint-overlay" aria-hidden="false">'
      + '<div class="hint-overlay__backdrop" data-hint-action="close"></div>'
      + '<div class="modal-card" role="dialog" aria-modal="true">'
      +   '<div class="modal__head">'
      +     '<span class="modal__head-icon">' + iconHtml + '</span>'
      +     '<div style="flex:1;">'
      +       '<div class="modal__sub">提示 · ' + escHtml(stepKey) + '</div>'
      +       '<h3 class="modal__title">' + escHtml(fieldKey) + '</h3>'
      +     '</div>'
      +     '<button class="modal__close" data-hint-action="close" aria-label="關閉"><i class="ph ph-x"></i></button>'
      +   '</div>'
      +   '<div class="modal__body" data-hint-body>' + bodyInnerHtml + '</div>'
      +   '<div class="modal__foot" data-hint-foot>' + footHtml + '</div>'
      + '</div>'
      + '</div>';
  }

  function _hintLoadingHtml() {
    var qName = (AppState.circlesSelectedQuestion && AppState.circlesSelectedQuestion.company)
      ? AppState.circlesSelectedQuestion.company + (AppState.circlesSelectedQuestion.product ? ' · ' + AppState.circlesSelectedQuestion.product : '')
      : '本題';
    return '<div style="padding: var(--s-5) 0; display: flex; flex-direction: column; align-items: center; gap: var(--s-3); color: var(--c-ink-3);">'
      +   '<div class="hint-spinner" style="width:32px; height:32px; border:2px solid var(--c-rule-bold); border-top-color:var(--c-navy); border-radius:50%; animation: spin 0.8s linear infinite;"></div>'
      +   '<div style="font-size: var(--t-body-sm); color: var(--c-ink);">教練思考中…</div>'
      +   '<div style="font-size: var(--t-cap); text-align: center;">針對 ' + escHtml(qName) + ' 題目產生個人化提示</div>'
      + '</div>';
  }

  function _hintErrorHtml(msg) {
    return '<div style="padding: var(--s-4) 0; display: flex; flex-direction: column; align-items: center; gap: var(--s-3); color: var(--c-ink-3); text-align:center;">'
      +   '<i class="ph ph-cloud-warning" style="font-size: 32px; color: var(--c-error);"></i>'
      +   '<div style="font-size: var(--t-body-sm); color: var(--c-ink);">提示生成失敗</div>'
      +   '<div style="font-size: var(--t-cap);">' + escHtml(msg || '請稍後再試') + '</div>'
      +   '<button class="btn btn--ghost" data-hint-action="retry" style="font-size:var(--t-meta); min-height:36px; margin-top: var(--s-2);"><i class="ph ph-arrow-clockwise"></i>重試</button>'
      + '</div>';
  }

  function _markdownHintToHtml(md) {
    if (!md) return '<p>（提示為空）</p>';
    var paras = md.split(/\n\n+/).filter(Boolean);
    return paras.map(function(p, i) {
      // simple bold
      var safe = escHtml(p).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
      return '<p' + (i > 0 ? ' style="margin-top: var(--s-3);"' : '') + '>' + safe + '</p>';
    }).join('');
  }

  function _hintEscHandler(e){ if (e.key === 'Escape') closeHintModal(); }

  // _hintAbortController — 允許 close 時 abort in-flight fetch
  var _hintAbortController = null;
  // _hintCache — { stepKey:fieldKey:questionId : hint } 已 fetch 過不重打
  var _hintCache = {};

  function openHintModal(stepKey, fieldKey) {
    closeHintModal(); // single-instance
    var host = document.createElement('div');
    host.id = '__hint_overlay_host__';
    host.dataset.stepKey = stepKey;
    host.dataset.fieldKey = fieldKey;
    document.body.appendChild(host);
    document.addEventListener('keydown', _hintEscHandler);
    _renderHintState(stepKey, fieldKey);
  }

  function _renderHintState(stepKey, fieldKey) {
    var host = document.getElementById('__hint_overlay_host__');
    if (!host) return;
    var q = AppState.circlesSelectedQuestion;
    var questionId = q && q.id;
    var cacheKey = stepKey + ':' + fieldKey + ':' + (questionId || 'none');

    if (_hintCache[cacheKey]) {
      // Cache hit — render content immediately
      host.innerHTML = renderHintModalShell(stepKey, fieldKey, _markdownHintToHtml(_hintCache[cacheKey]), false);
      _bindHintHostEvents(host, stepKey, fieldKey);
      return;
    }

    // Render loading shell
    host.innerHTML = renderHintModalShell(stepKey, fieldKey, _hintLoadingHtml(), true);
    _bindHintHostEvents(host, stepKey, fieldKey);

    if (!questionId) {
      // 無 questionId（未選題）→ show error
      _swapHintBody(host, _hintErrorHtml('找不到題目，請重新選題'), false);
      return;
    }

    // POST /api/circles-public/hint with field alias
    var apiField = getHintApiField(stepKey, fieldKey);
    if (_hintAbortController) try { _hintAbortController.abort(); } catch (e) {}
    _hintAbortController = new AbortController();
    fetch('/api/circles-public/hint', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ step: stepKey, field: apiField, questionId: questionId }),
      signal: _hintAbortController.signal
    }).then(function(r){
      if (!r.ok) return r.json().then(function(j){ throw new Error(j.error || ('HTTP ' + r.status)); });
      return r.json();
    }).then(function(j){
      _hintCache[cacheKey] = j.hint || '';
      // Only update if modal still open and same field
      var current = document.getElementById('__hint_overlay_host__');
      if (current && current.dataset.stepKey === stepKey && current.dataset.fieldKey === fieldKey) {
        _swapHintBody(current, _markdownHintToHtml(j.hint || ''), false);
      }
    }).catch(function(err){
      if (err.name === 'AbortError') return;
      var current = document.getElementById('__hint_overlay_host__');
      if (current && current.dataset.stepKey === stepKey && current.dataset.fieldKey === fieldKey) {
        _swapHintBody(current, _hintErrorHtml(err.message), false);
      }
    });
  }

  function _swapHintBody(host, bodyHtml, isLoading) {
    var bodyEl = host.querySelector('[data-hint-body]');
    var footEl = host.querySelector('[data-hint-foot]');
    if (bodyEl) bodyEl.innerHTML = bodyHtml;
    if (footEl) {
      footEl.innerHTML = isLoading
        ? '<button class="btn btn--ghost" data-hint-action="close" style="font-size:var(--t-meta); min-height:36px;">關閉</button>'
        : '<button class="btn btn--primary" data-hint-action="close" style="font-size:var(--t-meta); min-height:36px;">了解了</button>';
    }
    _bindHintHostEvents(host, host.dataset.stepKey, host.dataset.fieldKey);
  }

  function _bindHintHostEvents(host, stepKey, fieldKey) {
    host.querySelectorAll('[data-hint-action="close"]').forEach(function(el){
      el.onclick = function(){ closeHintModal(); };
    });
    host.querySelectorAll('[data-hint-action="retry"]').forEach(function(el){
      el.onclick = function(){ _renderHintState(stepKey, fieldKey); };
    });
  }

  function closeHintModal() {
    if (_hintAbortController) {
      try { _hintAbortController.abort(); } catch (e) {}
      _hintAbortController = null;
    }
    var host = document.getElementById('__hint_overlay_host__');
    if (host) host.remove();
    document.removeEventListener('keydown', _hintEscHandler);
  }

  // ── NSM Step 2 Hint Modal — mirrors CIRCLES openHintModal pattern ──────────
  // 3-state: loading → content → error. AbortController in-flight cancel.
  // 4 close paths: ESC / backdrop / X / 「了解了」.
  // Document delegation registered once; retry path included.

  var _nsmHintCache = {};
  var _nsmHintAbortController = null;

  function _renderNSMHintModalShell(field, bodyHtml, isLoading, isError) {
    var labelMap = { nsm: '北極星指標 (NSM)', explanation: '定義說明', businessLink: '與業務目標連結' };
    var label = labelMap[field] || field;
    var footHtml;
    if (isLoading) {
      footHtml = '<button class="btn btn--ghost" type="button" data-nsm-modal-close="ok">關閉</button>';
    } else if (isError) {
      footHtml = '<button class="btn btn--ghost" type="button" data-nsm-modal-close="ok">關閉</button>'
        + '<button class="btn btn--primary" type="button" data-nsm-modal-retry="' + escHtml(field) + '">重試</button>';
    } else {
      footHtml = '<button class="btn btn--primary" type="button" data-nsm-modal-close="ok">了解了</button>';
    }
    var headIcon = isError
      ? '<i class="ph-fill ph-warning-circle" style="color:var(--c-danger);"></i>'
      : '<i class="ph ph-sparkle"></i>';
    return '<div class="hint-overlay" aria-hidden="false">'
      + '<div class="hint-overlay__backdrop" data-nsm-modal-close="backdrop"></div>'
      + '<div class="modal-card" role="dialog" aria-modal="true">'
      +   '<div class="modal__head">'
      +     '<span class="modal__head-icon">' + headIcon + '</span>'
      +     '<div style="flex:1;">'
      +       '<div class="modal__sub">提示 · 個人化</div>'
      +       '<h3 class="modal__title">' + escHtml(label) + '</h3>'
      +     '</div>'
      +     '<button class="modal__close" type="button" data-nsm-modal-close="x" aria-label="關閉"><i class="ph ph-x"></i></button>'
      +   '</div>'
      +   '<div class="modal__body">' + bodyHtml + '</div>'
      +   '<div class="modal__foot">' + footHtml + '</div>'
      + '</div>'
      + '</div>';
  }

  function openNSMStep2HintModal(field) {
    var q = AppState.nsmSelectedQuestion || {};
    var qid = q.id;
    if (!qid) return;
    var cacheKey = qid + ':' + field;

    // Ensure host element exists (create once, reuse across openings)
    var host = document.getElementById('nsm-hint-modal-host');
    if (!host) {
      host = document.createElement('div');
      host.id = 'nsm-hint-modal-host';
      document.body.appendChild(host);
    }

    // Cache hit — immediate content state
    if (_nsmHintCache[cacheKey]) {
      var cachedHtml = markdownBulletsToHtml(_nsmHintCache[cacheKey]);
      host.innerHTML = _renderNSMHintModalShell(field, '<ul class="example-list">' + cachedHtml + '</ul>', false, false);
      return;
    }

    // Loading state
    var qName = escHtml(q.company || '本題');
    var loadingBody = '<div style="padding:var(--s-5) 0;display:flex;flex-direction:column;align-items:center;gap:var(--s-3);color:var(--c-ink-3);">'
      + '<div class="hint-spinner" style="width:32px;height:32px;border:2px solid var(--c-rule-bold);border-top-color:var(--c-navy);border-radius:50%;animation:spin 0.8s linear infinite;"></div>'
      + '<div style="font-size:var(--t-body-sm);color:var(--c-ink);">教練思考中…</div>'
      + '<div style="font-size:var(--t-cap);text-align:center;">針對 ' + qName + ' 題目產生個人化提示</div>'
      + '</div>';
    host.innerHTML = _renderNSMHintModalShell(field, loadingBody, true, false);

    // Cancel previous in-flight + start new fetch
    if (_nsmHintAbortController) { try { _nsmHintAbortController.abort(); } catch (e) {} }
    _nsmHintAbortController = new AbortController();
    var draft = ((AppState.nsmDefinition || {})[field]) || '';

    fetch('/api/nsm-public/step2-hint', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionId: qid, field: field, userDraft: draft }),
      signal: _nsmHintAbortController.signal,
    }).then(function (res) {
      if (!res.ok) throw new Error('hint_fetch_failed_' + res.status);
      return res.json();
    }).then(function (data) {
      _nsmHintCache[cacheKey] = data.hint || '';
      // Only update if host is still showing this modal
      var current = document.getElementById('nsm-hint-modal-host');
      if (current && current.innerHTML) {
        var contentHtml = '<ul class="example-list">' + markdownBulletsToHtml(data.hint || '') + '</ul>';
        current.innerHTML = _renderNSMHintModalShell(field, contentHtml, false, false);
      }
    }).catch(function (e) {
      if (e && e.name === 'AbortError') return;
      var current = document.getElementById('nsm-hint-modal-host');
      if (current && current.innerHTML) {
        var errBody = '<div style="text-align:center;padding:var(--s-4) 0;">'
          + '<i class="ph ph-cloud-warning" style="font-size:32px;color:var(--c-danger);"></i>'
          + '<div style="margin-top:var(--s-2);font-size:var(--t-body-sm);color:var(--c-ink);">提示生成失敗</div>'
          + '<div style="font-size:var(--t-cap);margin-top:var(--s-2);">教練回應暫時不可用，請稍後再試。</div>'
          + '</div>';
        current.innerHTML = _renderNSMHintModalShell(field, errBody, false, true);
      }
    });
  }

  function closeNSMStep2HintModal() {
    if (_nsmHintAbortController) { try { _nsmHintAbortController.abort(); } catch (e) {} _nsmHintAbortController = null; }
    var host = document.getElementById('nsm-hint-modal-host');
    if (host) host.innerHTML = '';
  }

  // ── NSM Step 3 Hint Modal — mirrors openNSMStep2HintModal ──────────────────
  // Params: dimId (reach/depth/frequency/impact), dimType (attention/saas/…)
  var _nsmStep3HintCache = {};
  var _nsmStep3HintAbortController = null;

  function _renderNSMStep3HintModalShell(dimId, dimType, bodyHtml, isLoading, isError) {
    var q = AppState.nsmSelectedQuestion || {};
    var ptype = dimType || nsmGuessProductType(q);
    var dimCfg = getNsmDimConfig(ptype);
    var dimEntry = (dimCfg.dims || []).filter(function (d) { return d.id === dimId; })[0] || {};
    var label = dimEntry.label || dimId;
    var footHtml;
    if (isLoading) {
      footHtml = '<button class="btn btn--ghost" type="button" data-nsm-modal-close="ok">關閉</button>';
    } else if (isError) {
      footHtml = '<button class="btn btn--ghost" type="button" data-nsm-modal-close="ok">關閉</button>'
        + '<button class="btn btn--primary" type="button" data-nsm-step3-modal-retry="' + escHtml(dimId) + '" data-nsm-dim-type="' + escHtml(ptype) + '">重試</button>';
    } else {
      footHtml = '<button class="btn btn--primary" type="button" data-nsm-modal-close="ok">了解了</button>';
    }
    var headIcon = isError
      ? '<i class="ph-fill ph-warning-circle" style="color:var(--c-danger);"></i>'
      : '<i class="ph ph-sparkle"></i>';
    return '<div class="hint-overlay" aria-hidden="false">'
      + '<div class="hint-overlay__backdrop" data-nsm-modal-close="backdrop"></div>'
      + '<div class="modal-card" role="dialog" aria-modal="true">'
      +   '<div class="modal__head">'
      +     '<span class="modal__head-icon">' + headIcon + '</span>'
      +     '<div style="flex:1;">'
      +       '<div class="modal__sub">提示 · 個人化</div>'
      +       '<h3 class="modal__title">' + escHtml(label) + '</h3>'
      +     '</div>'
      +     '<button class="modal__close" type="button" data-nsm-modal-close="x" aria-label="關閉"><i class="ph ph-x"></i></button>'
      +   '</div>'
      +   '<div class="modal__body">' + bodyHtml + '</div>'
      +   '<div class="modal__foot">' + footHtml + '</div>'
      + '</div>'
      + '</div>';
  }

  function openNSMStep3HintModal(dimId, dimType) {
    var q = AppState.nsmSelectedQuestion || {};
    var qid = q.id;
    if (!qid) return;
    var ptype = dimType || nsmGuessProductType(q);
    var cacheKey = qid + ':' + ptype + ':' + dimId;

    // Ensure host element exists (create once, reuse across openings)
    var host = document.getElementById('nsm-hint-modal-host');
    if (!host) {
      host = document.createElement('div');
      host.id = 'nsm-hint-modal-host';
      document.body.appendChild(host);
    }

    // Cache hit — immediate content state
    if (_nsmStep3HintCache[cacheKey]) {
      var cachedHtml = markdownBulletsToHtml(_nsmStep3HintCache[cacheKey]);
      host.innerHTML = _renderNSMStep3HintModalShell(dimId, ptype, '<ul class="example-list">' + cachedHtml + '</ul>', false, false);
      return;
    }

    // Loading state
    var qName = escHtml(q.company || '本題');
    var loadingBody = '<div style="padding:var(--s-5) 0;display:flex;flex-direction:column;align-items:center;gap:var(--s-3);color:var(--c-ink-3);">'
      + '<div class="hint-spinner" style="width:32px;height:32px;border:2px solid var(--c-rule-bold);border-top-color:var(--c-navy);border-radius:50%;animation:spin 0.8s linear infinite;"></div>'
      + '<div style="font-size:var(--t-body-sm);color:var(--c-ink);">教練思考中…</div>'
      + '<div style="font-size:var(--t-cap);text-align:center;">針對 ' + qName + ' 題目產生個人化提示</div>'
      + '</div>';
    host.innerHTML = _renderNSMStep3HintModalShell(dimId, ptype, loadingBody, true, false);

    // Cancel previous in-flight + start new fetch
    if (_nsmStep3HintAbortController) { try { _nsmStep3HintAbortController.abort(); } catch (e) {} }
    _nsmStep3HintAbortController = new AbortController();
    var draft = ((AppState.nsmBreakdown || {})[dimId]) || '';

    fetch('/api/nsm-public/step3-hint', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionId: qid, dimId: dimId, dimType: ptype, userDraft: draft }),
      signal: _nsmStep3HintAbortController.signal,
    }).then(function (res) {
      if (!res.ok) throw new Error('hint_fetch_failed_' + res.status);
      return res.json();
    }).then(function (data) {
      _nsmStep3HintCache[cacheKey] = data.hint || '';
      var current = document.getElementById('nsm-hint-modal-host');
      if (current && current.innerHTML) {
        var contentHtml = '<ul class="example-list">' + markdownBulletsToHtml(data.hint || '') + '</ul>';
        current.innerHTML = _renderNSMStep3HintModalShell(dimId, ptype, contentHtml, false, false);
      }
    }).catch(function (e) {
      if (e && e.name === 'AbortError') return;
      var current = document.getElementById('nsm-hint-modal-host');
      if (current && current.innerHTML) {
        var errBody = '<div style="text-align:center;padding:var(--s-4) 0;">'
          + '<i class="ph ph-cloud-warning" style="font-size:32px;color:var(--c-danger);"></i>'
          + '<div style="margin-top:var(--s-2);font-size:var(--t-body-sm);color:var(--c-ink);">提示生成失敗</div>'
          + '<div style="font-size:var(--t-cap);margin-top:var(--s-2);">教練回應暫時不可用，請稍後再試。</div>'
          + '</div>';
        current.innerHTML = _renderNSMStep3HintModalShell(dimId, ptype, errBody, false, true);
      }
    });
  }

  // Document-level delegation for NSM hint modal close paths (registered once).
  // 4 close paths: backdrop / X / 「了解了」 → data-nsm-modal-close=* ; retry → data-nsm-modal-retry / data-nsm-step3-modal-retry
  if (!window._nsmHintModalDelegateRegistered) {
    window._nsmHintModalDelegateRegistered = true;
    document.addEventListener('click', function (e) {
      if (e.target.closest('[data-nsm-modal-close]')) {
        closeNSMStep2HintModal();
        return;
      }
      var retry = e.target.closest('[data-nsm-modal-retry]');
      if (retry) {
        var f = retry.dataset.nsmModalRetry;
        closeNSMStep2HintModal();
        setTimeout(function () { openNSMStep2HintModal(f); }, 100);
        return;
      }
      var retry3 = e.target.closest('[data-nsm-step3-modal-retry]');
      if (retry3) {
        var did = retry3.dataset.nsmStep3ModalRetry;
        var dt = retry3.dataset.nsmDimType;
        closeNSMStep2HintModal();
        setTimeout(function () { openNSMStep3HintModal(did, dt); }, 100);
      }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        var host = document.getElementById('nsm-hint-modal-host');
        if (host && host.innerHTML) closeNSMStep2HintModal();
      }
    });
  }

  // renderExampleExpand — mockup 03 line 1905-1920 verbatim
  // dataKey 用於 unique data-attr（E 步用 sol-N-fieldKey；其他步用 fieldKey）
  function renderExampleExpand(stepKey, fieldKey, dataKey) {
    return '<div class="example-expand" aria-hidden="true" data-example-key="' + escHtml(dataKey) + '">'
      + '<div class="example-expand__head">'
      +   '<div class="example-expand__title"><i class="ph ph-quotes"></i>範例答案</div>'
      +   '<button class="example-expand__close" data-phase1="example-close" data-example-key="' + escHtml(dataKey) + '" aria-label="收合"><i class="ph ph-x"></i></button>'
      + '</div>'
      + '<ul class="example-list" data-example-content-key="' + escHtml(dataKey) + '"><li>（載入中...）</li></ul>'
      + '</div>';
  }

  // ── CIRCLES Phase 1 Form (Plan B SB3 — mockup 03 Section A) ─────────────
  // renderCirclesPhase1 + helpers: renderProgressBar / renderPhase1Field / renderRail

  function renderProgressBar(activeStep) {
    // mockup 03 line 801-809 (sim only — drill mode does NOT render this)
    var steps = [
      { letter: 'C', label: '澄清', key: 'C1' },
      { letter: 'I', label: '用戶', key: 'I'  },
      { letter: 'R', label: '需求', key: 'R'  },
      { letter: 'C', label: '排序', key: 'C2' },
      { letter: 'L', label: '方案', key: 'L'  },
      { letter: 'E', label: '取捨', key: 'E'  },
      { letter: 'S', label: '總結', key: 'S'  },
    ];
    var stepOrder = ['C1', 'I', 'R', 'C2', 'L', 'E', 'S'];
    var activeIdx = stepOrder.indexOf(activeStep);
    var html = '<div class="progress">';
    steps.forEach(function (s, idx) {
      var cls = 'progress__step' + (idx === activeIdx ? ' is-active' : (idx < activeIdx ? ' is-done' : ''));
      html += '<span class="' + cls + '"><span class="step-letter">' + escHtml(s.letter) + '</span>' + escHtml(s.label) + '</span>';
    });
    return html + '</div>';
  }

  function renderPhase1Field(fieldCfg, idx, isDrill) {
    // mockup 03 Section A field structure (line 832-873 for field 1 open; 876-898 fields 2-4)
    var key = fieldCfg.key;
    var minMax = fieldCfg.minMax || '';
    var max = fieldCfg.max || 200;
    var rows = fieldCfg.rows || 3;
    var placeholder = fieldCfg.placeholder || '';
    var hint = fieldCfg.hint || '';

    // toolbar buttons per mockup 03 Section A:
    //   field 1 mobile/tablet (line 847-850, 1002): text-b / list-bullets / text-indent (3 btn)
    //   field 1 desktop drill  (line 1114-1118):    text-b / list-bullets / text-indent / text-outdent (4 btn)
    //   field 2/3/4 all viewports (line 887-893, 911-915, 931-935, 1023, 1040, 1057, 1157, 1174, 1191):
    //                                              text-b / list-bullets (2 btn — NO indent/outdent)
    // user 要求全 field toolbar 一致 — 統一 2 button (B + list-bullets)，移除 indent/outdent
    var toolbarHtml = '<div class="rt-field__toolbar">'
      + '<button class="rt-tbtn" type="button" aria-label="粗體"><i class="ph ph-text-b"></i></button>'
      + '<button class="rt-tbtn" type="button" aria-label="項目符號"><i class="ph ph-list-bullets"></i></button>'
      + '</div>';

    var metaHtml = '';

    return '<div class="field" data-field-key="' + escHtml(key) + '" data-field-idx="' + idx + '">'
      + '<div class="field__label-row">'
      + '<label class="field__label">' + escHtml(key) + '</label>'
      + '<div class="field__hint-row">'
      + '<button class="field__hint-link" data-phase1="hint" data-field-key="' + escHtml(key) + '" data-field-idx="' + idx + '"><i class="ph ph-lightbulb"></i>提示</button>'
      + '<button class="field-example-toggle" aria-expanded="false" data-phase1="example-toggle" data-example-key="' + escHtml(key) + '" data-field-key="' + escHtml(key) + '" data-field-idx="' + idx + '">'
      + '<i class="ph ph-quotes"></i>範例答案<i class="ph ph-caret-down toggle-caret"></i>'
      + '</button>'
      + '</div>'
      + '</div>'
      + '<div class="rt-field" data-field-idx="' + idx + '">'
      + toolbarHtml
      + '<div class="rt-textarea" contenteditable="true" data-rows="' + rows + '" data-placeholder="' + escHtml(placeholder) + '" data-phase1="textarea" data-field-idx="' + idx + '" data-max="' + max + '" style="min-height:' + (rows * 1.6 + 1) + 'em;"></div>'
      + '</div>'
      + metaHtml
      + renderExampleExpand('', key, key)
      + '</div>';
  }

  function renderRail(stepCfg) {
    // mockup 03 line 1197-1205 — desktop only aside.rail
    // user 2026-05-04: rail 只保留 X 步重點，下方第 2 格已拿掉
    return '<aside class="rail">'
      + '<div class="rail__title">' + escHtml(stepCfg.railTitle) + '</div>'
      + '<p style="margin-bottom: var(--s-3); color: var(--c-ink); font-weight: 500;">' + escHtml(stepCfg.railIntro) + '</p>'
      + '<p style="line-height: 1.7;">' + escHtml(stepCfg.railBody) + '</p>'
      + '</aside>';
  }

  // ── renderSolCard: render a single sol-card (Plan B SB4 — mockup 03 Section B) ──
  function renderSolCard(idx, isDesktop) {
    var solCfg = CIRCLES_STEP_CONFIG.L.solCardField;
    var isOptional = idx === 2; // only 3rd card is optional
    var numLabel = idx === 0 ? '方案一' : idx === 1 ? '方案二' : '方案三';
    var numHtml = isOptional
      ? numLabel + ' <span class="sol-card__optional">（選擇性）</span>'
      : numLabel;

    // name input placeholder: desktop sol3 differs
    var namePlaceholder = (isDesktop && isOptional)
      ? solCfg.nameInputPlaceholders.sol3Desktop
      : solCfg.nameInputPlaceholders.default;

    // textarea placeholder per idx and viewport
    var taPlaceholder;
    if (idx === 0) taPlaceholder = solCfg.placeholders.sol1;
    else if (idx === 1) taPlaceholder = solCfg.placeholders.sol2;
    else taPlaceholder = isDesktop ? solCfg.placeholders.sol3Desktop : solCfg.placeholders.sol3Mobile;

    // name-row: sol3 has remove button
    var nameRowHtml = '<div class="sol-card__name-row">'
      + '<input class="sol-card__name-input" type="text" placeholder="' + escHtml(namePlaceholder) + '" data-sol-idx="' + idx + '">'
      + (isOptional ? '<button class="sol-card__remove" aria-label="移除方案三"><i class="ph ph-x"></i></button>' : '')
      + '</div>';

    // dataKey for this sol-card's example expand: 'sol-N' (one example per sol)
    var solDataKey = 'sol-' + idx;

    // field: mobile has label-row; tablet+ label hidden via CSS
    var fieldHtml = '<div class="field" style="margin-bottom:0;">'
      + '<div class="field__label-row">'
      + '<label class="field__label">' + escHtml(solCfg.label) + '</label>'
      + '<div class="field__hint-row">'
      + '<button class="field__hint-link" data-phase1="hint" data-field-key="方案"><i class="ph ph-lightbulb"></i>提示</button>'
      + '<button class="field-example-toggle" aria-expanded="false" data-phase1="example-toggle" data-example-key="' + escHtml(solDataKey) + '" data-field-key="' + escHtml(numLabel) + '"><i class="ph ph-quotes"></i>範例答案<i class="ph ph-caret-down toggle-caret"></i></button>'
      + '</div>'
      + '</div>'
      + '<div class="rt-field">'
      + '<div class="rt-field__toolbar">'
      + '<button class="rt-tbtn" type="button" aria-label="粗體"><i class="ph ph-text-b"></i></button>'
      + '<button class="rt-tbtn" type="button" aria-label="項目符號"><i class="ph ph-list-bullets"></i></button>'
      + '</div>'
      + '<div class="rt-textarea" contenteditable="true" data-placeholder="' + escHtml(taPlaceholder) + '" data-sol-idx="' + idx + '" style="min-height:5.8em;"></div>'
      + '</div>'
      + renderExampleExpand('L', numLabel, solDataKey)
      + '</div>';

    return '<div class="sol-card sol-card--l">'
      + '<div class="sol-card__num">' + numHtml + '</div>'
      + nameRowHtml
      + fieldHtml
      + '</div>';
  }

  // ── renderQchipExpand: qchip 題目展開 panel (Plan B SB6 — mockup 03 Section G) ──
  function renderQchipExpand(q) {
    if (!q) return '';
    // Stale snapshot fallback: when session.question_json lacks analysis,
    // look up fresh CIRCLES_QUESTIONS by id (data-only救援, 0 視覺 change).
    var fresh = (q.id && window.CIRCLES_QUESTIONS) ?
      window.CIRCLES_QUESTIONS.find(function (x) { return x.id === q.id; }) : null;
    var an = (q.analysis && q.analysis.business) ? q.analysis : ((fresh && fresh.analysis) || {});
    var statement = q.problem_statement || (fresh && fresh.problem_statement) || '';
    return '<div class="qchip-expand">'
      + '<p class="qchip-expand__statement">' + escHtml(statement) + '</p>'
      + '<h4 class="qchip-expand__section-label">深入分析</h4>'
      + '<div class="qchip-ana">'
      +   '<div class="qchip-ana__block">'
      +     '<div class="qchip-ana__head"><i class="ph ph-buildings"></i>商業背景</div>'
      +     '<div class="qchip-ana__body">' + escHtml(an.business || '') + '</div>'
      +   '</div>'
      +   '<div class="qchip-ana__block">'
      +     '<div class="qchip-ana__head"><i class="ph ph-users"></i>用戶輪廓</div>'
      +     '<div class="qchip-ana__body">' + escHtml(an.users || '') + '</div>'
      +   '</div>'
      +   '<div class="qchip-ana__block qchip-ana__block--trap">'
      +     '<div class="qchip-ana__head"><i class="ph ph-warning"></i>常見誤區</div>'
      +     '<div class="qchip-ana__body">' + escHtml(an.traps || '') + '</div>'
      +   '</div>'
      +   '<div class="qchip-ana__block">'
      +     '<div class="qchip-ana__head"><i class="ph ph-lightbulb"></i>破題切入</div>'
      +     '<div class="qchip-ana__body">' + escHtml(an.insight || '') + '</div>'
      +   '</div>'
      + '</div>'
      + '<button class="qchip-collapse-btn" data-phase1="qchip-collapse">'
      +   '<i class="ph ph-caret-up" style="font-size:12px;"></i>收合'
      + '</button>'
      + '</div>';
  }

  // ── renderCirclesPhase1Lstep: L step sol-multi renderer (Plan B SB4) ──────
  function renderCirclesPhase1Lstep(q, stepKey, stepCfg, currentStepNum) {
    var mode = AppState.circlesMode || 'simulation';
    var isDrill = mode === 'drill';
    var isDesktop = window.innerWidth >= 1024;
    var isTabletPlus = window.innerWidth >= 768;

    // progress bar (sim only)
    var progressHtml = isDrill ? '' : renderProgressBar(stepKey);

    // phase-head
    var eyebrow = isDrill ? stepCfg.eyebrow.drill : stepCfg.eyebrow.sim;
    // User-requested 2026-05-11: no parenthesised subtitle on any CIRCLES step.
    var titleHtml = escHtml(stepCfg.title);
    var metaHtml;
    if (isDrill) {
      metaHtml = '<span class="phase-head__meta">'
        + renderSaveIndicator()
        + '</span>';
    } else {
      metaHtml = '<span class="phase-head__meta">'
        + renderSaveIndicator()
        + '<span class="phase-head__meta-sep phase-head__meta-extra">·</span>'
        + '<span class="phase-head__meta-extra">完整模擬 · ' + currentStepNum + ' / 7 步</span>'
        + '</span>';
    }
    var phaseHeadClass = 'phase-head' + (isDrill ? ' phase-head--drill' : '');
    var phaseHeadHtml = '<div class="' + phaseHeadClass + '">'
      + '<span class="phase-head__num">' + escHtml(stepCfg.stepNum) + '</span>'
      + '<div class="phase-head__main">'
      + '<div class="phase-head__eyebrow">' + escHtml(eyebrow) + '</div>'
      + '<div class="phase-head__title">' + titleHtml + '</div>'
      + '</div>'
      + metaHtml
      + '</div>';

    // qchip: desktop sim adds question type + difficulty suffix
    var company = (q && q.company) ? q.company : '';
    var product = (q && q.product) ? q.product : '';
    var companyBaseHtml = escHtml(company) + (product ? ' · ' + escHtml(product) : '');
    var diff = (q && q.difficulty) === 'high' ? '高' : (q && q.difficulty) === 'low' ? '低' : '中';
    var qType = (q && q.question_type) === 'improve' ? '改善題' : (q && q.question_type) === 'strategy' ? '策略題' : '設計題';
    var companyDisplayHtml;
    if (isDesktop) {
      // desktop: always show type+difficulty inline (matches mockup line 1388)
      companyDisplayHtml = companyBaseHtml + ' · ' + escHtml(qType) + ' · 難度 ' + escHtml(diff);
    } else if (isDrill) {
      companyDisplayHtml = companyBaseHtml + ' · ' + escHtml(qType) + ' · 難度 ' + escHtml(diff);
    } else {
      companyDisplayHtml = companyBaseHtml;
    }
    var qTitle = (q && q.problem_statement) ? q.problem_statement : '';
    var chipExpanded = AppState.circlesChipExpanded === true;
    var qchipClass = 'qchip' + (chipExpanded ? ' is-expanded' : '');
    var caretIcon = chipExpanded ? 'ph-caret-up' : 'ph-caret-down';
    var qchipHtml = '<div class="' + qchipClass + '" data-phase1="qchip-toggle">'
      + '<span class="qchip__icon"><i class="ph ph-info"></i></span>'
      + '<div class="qchip__main">'
      + '<div class="qchip__company">' + companyDisplayHtml + '</div>'
      + '<div class="qchip__title">' + escHtml(qTitle) + '</div>'
      + '</div>'
      + '<i class="ph ' + caretIcon + ' qchip__caret"></i>'
      + '</div>'
      + (chipExpanded ? renderQchipExpand(q) : '');

    // sol-cards
    var solutions = AppState.circlesPhase1Solutions;
    var solCardsHtml = '';
    for (var i = 0; i < solutions.length; i++) {
      solCardsHtml += renderSolCard(i, isDesktop);
    }

    // sol-add button: hidden when 3 cards added
    var solAddHtml = solutions.length < 3
      ? '<button class="sol-add"><i class="ph ph-plus"></i>加方案三（選擇性）</button>'
      : '<button class="sol-add" style="display:none;"><i class="ph ph-plus"></i>加方案三（選擇性）</button>';

    // phase-body: desktop sim uses phase-body--with-rail
    var useRail = !isDrill && isDesktop;
    var phaseBodyClass = 'phase-body' + (useRail ? ' phase-body--with-rail' : '');
    var phaseBodyHtml;
    if (useRail) {
      phaseBodyHtml = '<div class="' + phaseBodyClass + '">'
        + '<div>' + solCardsHtml + solAddHtml + '</div>'
        + renderRail(stepCfg)
        + '</div>';
    } else {
      phaseBodyHtml = '<div class="' + phaseBodyClass + '">'
        + solCardsHtml
        + solAddHtml
        + '</div>';
    }

    // submit-bar: sim tablet+ shows 上一步 ghost; mobile empty left; drill no back
    var ghostHtml = '';
    if (!isDrill) {
      ghostHtml = '<button class="btn btn--ghost submit-bar__back" data-phase1="back">'
        + '<i class="ph ph-arrow-left"></i>上一步'
        + '</button>';
    }
    var submitBarHtml = '<div class="submit-bar">'
      + '<div class="submit-bar__left">' + ghostHtml + '</div>'
      + '<div class="submit-bar__right">'
      + '<button class="btn btn--primary" data-phase1="submit">下一步<i class="ph ph-arrow-right"></i></button>'
      + '</div>'
      + '</div>';

    return applyPhase1StateOverlay(
        '<div data-view="circles" data-circles-phase="1" data-circles-l-step="true">'
      + progressHtml
      + phaseHeadHtml
      + qchipHtml
      + phaseBodyHtml
      + submitBarHtml
      + '</div>'
    );
  }

  // ── renderCirclesPhase1Estep: E step (Plan B SB7 — mockup 03 Section B 沿用 / line 1466) ──
  function renderCirclesPhase1Estep(q, stepKey, stepCfg, currentStepNum) {
    var mode = AppState.circlesMode || 'simulation';
    var isDrill = mode === 'drill';  // E step 不 drill 但保留 guard
    var isDesktop = window.innerWidth >= 1024;

    var progressHtml = isDrill ? '' : renderProgressBar(stepKey);

    // phase-head — sim mobile = save only / tablet+ = save + 完整模擬 N/7
    var eyebrow = isDrill ? stepCfg.eyebrow.drill : stepCfg.eyebrow.sim;
    var titleHtml = escHtml(stepCfg.title);
    if (isDesktop && !isDrill && stepCfg.titleSimDesktopSuffix) {
      titleHtml = escHtml(stepCfg.title) + '<span class="phase-head__title-extra">' + escHtml(stepCfg.titleSimDesktopSuffix) + '</span>';
    }
    var metaHtml;
    if (isDrill) {
      metaHtml = '<span class="phase-head__meta">'
        + renderSaveIndicator()
        + '</span>';
    } else {
      metaHtml = '<span class="phase-head__meta">'
        + renderSaveIndicator()
        + '<span class="phase-head__meta-sep phase-head__meta-extra">·</span>'
        + '<span class="phase-head__meta-extra">完整模擬 · ' + currentStepNum + ' / 7 步</span>'
        + '</span>';
    }
    var phaseHeadHtml = '<div class="phase-head">'
      + '<span class="phase-head__num">' + escHtml(stepCfg.stepNum) + '</span>'
      + '<div class="phase-head__main">'
      + '<div class="phase-head__eyebrow">' + escHtml(eyebrow) + '</div>'
      + '<div class="phase-head__title">' + titleHtml + '</div>'
      + '</div>'
      + metaHtml
      + '</div>';

    // qchip — desktop sim 加 suffix（對齊 L 步 / SB6 cold-review fix）
    var company = (q && q.company) ? q.company : '';
    var product = (q && q.product) ? q.product : '';
    var companyBaseHtml = escHtml(company) + (product ? ' · ' + escHtml(product) : '');
    var diff = (q && q.difficulty) === 'high' ? '高' : (q && q.difficulty) === 'low' ? '低' : '中';
    var qType = (q && q.question_type) === 'improve' ? '改善題' : (q && q.question_type) === 'strategy' ? '策略題' : '設計題';
    var companyDisplayHtml = (isDesktop || isDrill)
      ? companyBaseHtml + ' · ' + escHtml(qType) + ' · 難度 ' + escHtml(diff)
      : companyBaseHtml;
    var qTitle = (q && q.problem_statement) ? q.problem_statement : '';
    var chipExpanded = AppState.circlesChipExpanded === true;
    var qchipClass = 'qchip' + (chipExpanded ? ' is-expanded' : '');
    var caretIcon = chipExpanded ? 'ph-caret-up' : 'ph-caret-down';
    var qchipHtml = '<div class="' + qchipClass + '" data-phase1="qchip-toggle">'
      + '<span class="qchip__icon"><i class="ph ph-info"></i></span>'
      + '<div class="qchip__main">'
      + '<div class="qchip__company">' + companyDisplayHtml + '</div>'
      + '<div class="qchip__title">' + escHtml(qTitle) + '</div>'
      + '</div>'
      + '<i class="ph ' + caretIcon + ' qchip__caret"></i>'
      + '</div>'
      + (chipExpanded ? renderQchipExpand(q) : '');

    // sol-cards — 數量 = circlesPhase1Solutions.length
    var solutions = AppState.circlesPhase1Solutions || [];
    // ensure circlesPhase1Evaluate length matches solutions
    if (!Array.isArray(AppState.circlesPhase1Evaluate)) AppState.circlesPhase1Evaluate = [];
    while (AppState.circlesPhase1Evaluate.length < solutions.length) {
      AppState.circlesPhase1Evaluate.push({ advantages: '', disadvantages: '', risks: '', metrics: '' });
    }
    while (AppState.circlesPhase1Evaluate.length > solutions.length) {
      AppState.circlesPhase1Evaluate.pop();
    }

    var solCardsHtml = solutions.map(function (sol, solIdx) {
      return renderEsolCard(solIdx, sol, stepCfg.perSolFields);
    }).join('');

    // phase-body — desktop sim 用 --with-rail
    var useRail = !isDrill && isDesktop;
    var phaseBodyClass = 'phase-body' + (useRail ? ' phase-body--with-rail' : '');
    var phaseBodyHtml;
    if (useRail) {
      phaseBodyHtml = '<div class="' + phaseBodyClass + '">'
        + '<div>' + solCardsHtml + '</div>'
        + renderRail(stepCfg)
        + '</div>';
    } else {
      phaseBodyHtml = '<div class="' + phaseBodyClass + '">' + solCardsHtml + '</div>';
    }

    // submit-bar
    var ghostHtml = '';
    if (!isDrill) {
      ghostHtml = '<button class="btn btn--ghost submit-bar__back" data-phase1="back">'
        + '<i class="ph ph-arrow-left"></i>上一步'
        + '</button>';
    }
    var submitBarHtml = '<div class="submit-bar">'
      + '<div class="submit-bar__left">' + ghostHtml + '</div>'
      + '<div class="submit-bar__right">'
      + '<button class="btn btn--primary" data-phase1="submit">下一步<i class="ph ph-arrow-right"></i></button>'
      + '</div>'
      + '</div>';

    return applyPhase1StateOverlay(
        '<div data-view="circles" data-circles-phase="1" data-circles-e-step="true">'
      + progressHtml
      + phaseHeadHtml
      + qchipHtml
      + phaseBodyHtml
      + submitBarHtml
      + '</div>'
    );
  }

  // ── renderEsolCard: E 步 per-sol card with 4 nested fields (Plan B SB7) ──
  function renderEsolCard(solIdx, sol, perSolFields) {
    var isOptional = solIdx === 2;
    var numLabel = solIdx === 0 ? '方案一' : solIdx === 1 ? '方案二' : '方案三';
    var numHtml = isOptional
      ? numLabel + ' <span class="sol-card__optional">（選擇性）</span>'
      : numLabel;
    var solName = (sol && sol.name) ? sol.name : '';
    // E 步：sol name 唯讀展示（不再 input — name 在 L 步定）
    var nameDisplayHtml = solName
      ? '<div class="sol-card__name-display" style="font-size: var(--t-body); font-weight: 500; color: var(--c-ink); margin-bottom: var(--s-3);">' + escHtml(solName) + '</div>'
      : '<div class="sol-card__name-display" style="font-size: var(--t-meta); color: var(--c-ink-3); margin-bottom: var(--s-3); font-style: italic;">（未命名方案）</div>';

    // 4 nested fields per sol-card
    var fieldsHtml = perSolFields.map(function (f) {
      var dataKey = solIdx + '-' + f.label;  // composite: 0-優點 / 0-缺點 / 1-優點 ...
      return ''
        + '<div class="field" data-field-key="' + escHtml(f.label) + '" data-sol-idx="' + solIdx + '" style="margin-bottom: var(--s-4);">'
        +   '<div class="field__label-row">'
        +     '<label class="field__label">' + escHtml(f.label) + '</label>'
        +     '<div class="field__hint-row">'
        +       '<button class="field__hint-link" data-phase1="hint" data-field-key="' + escHtml(f.label) + '"><i class="ph ph-lightbulb"></i>提示</button>'
        +       '<button class="field-example-toggle" aria-expanded="false" data-phase1="example-toggle" data-example-key="' + escHtml(dataKey) + '" data-field-key="' + escHtml(f.label) + '">'
        +         '<i class="ph ph-quotes"></i>範例答案<i class="ph ph-caret-down toggle-caret"></i>'
        +       '</button>'
        +     '</div>'
        +   '</div>'
        +   '<div class="rt-field">'
        +     '<div class="rt-field__toolbar">'
        +       '<button class="rt-tbtn" type="button" aria-label="粗體"><i class="ph ph-text-b"></i></button>'
        +       '<button class="rt-tbtn" type="button" aria-label="項目符號"><i class="ph ph-list-bullets"></i></button>'
        +     '</div>'
        +     '<div class="rt-textarea" contenteditable="true" data-placeholder="' + escHtml(f.placeholder) + '" data-circles-e-sol-idx="' + solIdx + '" data-circles-e-field-key="' + f.key + '" data-max="' + f.max + '" style="min-height:' + (f.rows * 1.6 + 1) + 'em;"></div>'
        +   '</div>'
        +   renderExampleExpand('E', f.label, dataKey)
        + '</div>';
    }).join('');

    return '<div class="sol-card sol-card--e">'
      + '<div class="sol-card__num">' + numHtml + '</div>'
      + nameDisplayHtml
      + fieldsHtml
      + '</div>';
  }

  // ── renderCirclesPhase1Sstep: S step (Plan B SB5 — mockup 03 Section C) ────
  function renderCirclesPhase1Sstep(q, stepKey, stepCfg, currentStepNum) {
    var mode = AppState.circlesMode || 'simulation';
    var isDrill = mode === 'drill';
    var isDesktop = window.innerWidth >= 1024;

    // Determine product type for dynamic labels
    var productType = (q && typeof nsmGuessProductType === 'function') ? nsmGuessProductType(q) : 'attention';
    var dimLabels = (stepCfg.trackingDimsByType[productType] || stepCfg.trackingDimsByType.attention);
    var dimPlaceholders = stepCfg.trackingPlaceholders;
    var dimSubs = (stepCfg.trackingSubsByType[productType] || stepCfg.trackingSubsByType.attention);
    var NSM_TYPE_LABEL_LOCAL = { attention: 'attention 型', transaction: 'transaction 型', creator: 'creator 型', saas: 'saas 型' };
    var typeLabelDisplay = NSM_TYPE_LABEL_LOCAL[productType] || 'attention 型';

    // progress bar (sim only)
    var progressHtml = isDrill ? '' : renderProgressBar(stepKey);

    // phase-head
    var eyebrow = isDrill ? stepCfg.eyebrow.drill : stepCfg.eyebrow.sim;
    // desktop sim: append suffix
    var titleHtml = escHtml(stepCfg.title);
    if (!isDrill && isDesktop && stepCfg.titleSimDesktopSuffix) {
      titleHtml += '<span class="phase-head__title-s-suffix">' + escHtml(stepCfg.titleSimDesktopSuffix) + '</span>';
    }
    var metaHtml;
    if (isDrill) {
      metaHtml = '<span class="phase-head__meta">'
        + renderSaveIndicator()
        + '</span>';
    } else {
      metaHtml = '<span class="phase-head__meta">'
        + renderSaveIndicator()
        + '<span class="phase-head__meta-sep phase-head__meta-extra">·</span>'
        + '<span class="phase-head__meta-extra">完整模擬 · ' + currentStepNum + ' / 7 步</span>'
        + '</span>';
    }
    var phaseHeadHtml = '<div class="phase-head">'
      + '<span class="phase-head__num">' + escHtml(stepCfg.stepNum) + '</span>'
      + '<div class="phase-head__main">'
      + '<div class="phase-head__eyebrow">' + escHtml(eyebrow) + '</div>'
      + '<div class="phase-head__title">' + titleHtml + '</div>'
      + '</div>'
      + metaHtml
      + '</div>';

    // qchip: desktop sim adds question type + difficulty suffix
    var company = (q && q.company) ? q.company : '';
    var product = (q && q.product) ? q.product : '';
    var companyBaseHtml = escHtml(company) + (product ? ' · ' + escHtml(product) : '');
    var diff = (q && q.difficulty) === 'high' ? '高' : (q && q.difficulty) === 'low' ? '低' : '中';
    var qType = (q && q.question_type) === 'improve' ? '改善題' : (q && q.question_type) === 'strategy' ? '策略題' : '設計題';
    var companyDisplayHtml;
    if (isDesktop) {
      companyDisplayHtml = companyBaseHtml + ' · ' + escHtml(qType) + ' · 難度 ' + escHtml(diff);
    } else if (isDrill) {
      companyDisplayHtml = companyBaseHtml + ' · ' + escHtml(qType) + ' · 難度 ' + escHtml(diff);
    } else {
      companyDisplayHtml = companyBaseHtml;
    }
    var qTitle = (q && q.problem_statement) ? q.problem_statement : '';
    var chipExpanded = AppState.circlesChipExpanded === true;
    var qchipClass = 'qchip' + (chipExpanded ? ' is-expanded' : '');
    var caretIcon = chipExpanded ? 'ph-caret-up' : 'ph-caret-down';
    var qchipHtml = '<div class="' + qchipClass + '" data-phase1="qchip-toggle">'
      + '<span class="qchip__icon"><i class="ph ph-info"></i></span>'
      + '<div class="qchip__main">'
      + '<div class="qchip__company">' + companyDisplayHtml + '</div>'
      + '<div class="qchip__title">' + escHtml(qTitle) + '</div>'
      + '</div>'
      + '<i class="ph ' + caretIcon + ' qchip__caret"></i>'
      + '</div>'
      + (chipExpanded ? renderQchipExpand(q) : '');

    // 3 main rt-fields (reuse renderPhase1Field but S step uses 2-button toolbar for all fields)
    var fieldsHtml = '';
    stepCfg.fields.forEach(function (fieldCfg, i) {
      var key = fieldCfg.key;
      var rows = fieldCfg.rows || 2;
      var placeholder = fieldCfg.placeholder || '';
      // S step: 2-button toolbar but mobile hides list-bullets via CSS @media
      // (mockup line 1493 mobile shows ph-text-b only; line 1581/1670 tablet+ shows both)
      var toolbarHtml = '<div class="rt-field__toolbar rt-field__toolbar--s">'
        + '<button class="rt-tbtn" type="button" aria-label="粗體"><i class="ph ph-text-b"></i></button>'
        + '<button class="rt-tbtn" type="button" aria-label="項目符號"><i class="ph ph-list-bullets"></i></button>'
        + '</div>';
      fieldsHtml += '<div class="field" data-s-field-key="' + escHtml(key) + '" data-s-field-idx="' + i + '">'
        + '<div class="field__label-row">'
        + '<label class="field__label">' + escHtml(key) + '</label>'
        + '<div class="field__hint-row">'
        + '<button class="field__hint-link" data-phase1="hint" data-field-key="' + escHtml(key) + '"><i class="ph ph-lightbulb"></i>提示</button>'
        + '<button class="field-example-toggle" aria-expanded="false" data-phase1="example-toggle" data-example-key="' + escHtml(key) + '" data-field-key="' + escHtml(key) + '">'
        + '<i class="ph ph-quotes"></i>範例答案<i class="ph ph-caret-down toggle-caret"></i>'
        + '</button>'
        + '</div>'
        + '</div>'
        + '<div class="rt-field">'
        + toolbarHtml
        + '<div class="rt-textarea" contenteditable="true" data-placeholder="' + escHtml(placeholder) + '" data-s-textarea="' + escHtml(key) + '" style="min-height:' + (rows * 1.6 + 1) + 'em;"></div>'
        + '</div>'
        + renderExampleExpand('S', key, key)
        + '</div>';
    });

    // tracking-section with 4 tracking-cards
    var dimKeys = ['reach', 'depth', 'frequency', 'impact'];
    var dimNums = ['01', '02', '03', '04'];
    var dimEnLabels = { reach: 'reach', depth: 'depth', frequency: 'frequency', impact: 'impact' };
    var trackingCardsHtml = '';
    dimKeys.forEach(function (dimKey, i) {
      var dimZh = dimLabels[dimKey];
      var dimEn = dimEnLabels[dimKey];
      var dimSub = dimSubs ? (dimSubs[dimKey] || '') : '';
      var dimPlaceholder = dimPlaceholders[dimKey] || '';
      // user 2026-05-04: 範例答案要分開——每張 tracking-card 各自一顆按鈕 + 各自 expand,
      // populate 時用 dim filter 抓 DB「追蹤指標」單一 entry 內對應段落
      var exKey = 's-tracking-' + dimKey;
      trackingCardsHtml += '<div class="tracking-card" data-dim="' + dimKey + '">'
        + '<span class="tracking-card__num">' + dimNums[i] + '</span>'
        + '<div>'
        + '<div style="display:flex; justify-content:space-between; align-items:baseline; gap:var(--s-3); margin-bottom:var(--s-1);">'
        + '<div class="tracking-card__head">' + escHtml(dimZh) + '（' + escHtml(dimEn) + '）</div>'
        + '<div class="field__hint-row" style="font-size: var(--t-cap); display:flex; gap:var(--s-3);">'
        + '<button class="field__hint-link" data-phase1="hint" data-field-key="' + escHtml(dimZh) + '"><i class="ph ph-lightbulb"></i>提示</button>'
        + '<button class="field-example-toggle" aria-expanded="false" data-phase1="example-toggle" data-example-key="' + exKey + '" data-field-key="追蹤指標" data-tracking-dim="' + dimKey + '"><i class="ph ph-quotes"></i>範例答案<i class="ph ph-caret-down toggle-caret"></i></button>'
        + '</div>'
        + '</div>'
        + '<div class="tracking-card__sub">' + escHtml(dimSub) + '</div>'
        + '<input type="text" placeholder="' + escHtml(dimPlaceholder) + '" data-s-tracking="' + dimKey + '">'
        + renderExampleExpand('S', '追蹤指標', exKey)
        + '</div>'
        + '</div>';
    });

    // industry text for sub line (removed per 2026-05-10 inline coaching cleanup)
    var industry = (q && q.industry) ? q.industry : '';

    var trackingSectionHtml = '<div class="tracking-section">'
      + '<h3 class="tracking-section__head">追蹤指標 · 4 個維度</h3>'
      + '<div class="tracking-grid">' + trackingCardsHtml + '</div>'
      + '</div>';

    // desktop rail — user 2026-05-04: 只保留 S 步重點,type-specific note 拿掉
    var railHtml = '<aside class="rail">'
      + '<div class="rail__title">' + escHtml(stepCfg.railTitle) + '</div>'
      + '<p style="margin-bottom: var(--s-3); color: var(--c-ink); font-weight: 500;">' + escHtml(stepCfg.railIntro) + '</p>'
      + '<p style="line-height: 1.7;">' + escHtml(stepCfg.railBody) + '</p>'
      + '</aside>';

    // phase-body: desktop sim uses phase-body--with-rail
    var useRail = !isDrill && isDesktop;
    var phaseBodyClass = 'phase-body' + (useRail ? ' phase-body--with-rail' : '');
    var mainContentHtml = fieldsHtml + trackingSectionHtml;
    var phaseBodyHtml;
    if (useRail) {
      phaseBodyHtml = '<div class="' + phaseBodyClass + '">'
        + '<div>' + mainContentHtml + '</div>'
        + railHtml
        + '</div>';
    } else {
      phaseBodyHtml = '<div class="' + phaseBodyClass + '">' + mainContentHtml + '</div>';
    }

    // submit-bar: CTA = 「完成 Phase 1」; sim shows 上一步; drill no back
    var ghostHtml = '';
    if (!isDrill) {
      ghostHtml = '<button class="btn btn--ghost submit-bar__back" data-phase1="back">'
        + '<i class="ph ph-arrow-left"></i>上一步'
        + '</button>';
    }
    var submitBarHtml = '<div class="submit-bar">'
      + '<div class="submit-bar__left">' + ghostHtml + '</div>'
      + '<div class="submit-bar__right">'
      + '<button class="btn btn--primary" data-phase1="submit">' + escHtml(stepCfg.cta) + '<i class="ph ph-arrow-right"></i></button>'
      + '</div>'
      + '</div>';

    return applyPhase1StateOverlay(
        '<div data-view="circles" data-circles-phase="1" data-circles-s-step="true">'
      + progressHtml
      + phaseHeadHtml
      + qchipHtml
      + phaseBodyHtml
      + submitBarHtml
      + '</div>'
    );
  }

  // ── renderCirclesGate (Plan B SB10 — mockup 04 Phase 1.5 Gate) ──────────────
  function renderCirclesGate() {
    var q = AppState.circlesSelectedQuestion || {};
    var stepKey = AppState.circlesMode === 'drill'
      ? (AppState.circlesDrillStep || 'C1')
      : (['C1','I','R','C2','L','E','S'][AppState.circlesSimStep || 0] || 'C1');
    var stepCfg = CIRCLES_STEP_CONFIG[stepKey] || CIRCLES_STEP_CONFIG.C1;
    // chrome (navbar rendered externally by render(); only progress + phase-head + qchip here)
    var progressHtml = renderProgressBar(stepKey);
    var phaseHeadHtml = '<div class="phase-head">'
      + '<span class="phase-head__num">1.5</span>'
      + '<div class="phase-head__main">'
      +   '<div class="phase-head__eyebrow">Phase 1.5 · 框架審核</div>'
      +   '<div class="phase-head__title">' + escHtml(stepCfg.title) + '</div>'
      + '</div></div>';
    var qTitle = (q && q.problem_statement) ? q.problem_statement : '';
    var qCompany = (q && q.company) ? escHtml(q.company) : '';
    var qProduct = (q && q.product) ? escHtml(q.product) : '';
    var qCompanyLine = qProduct ? (qCompany + ' · ' + qProduct) : qCompany;
    var chipExpanded = AppState.circlesChipExpanded === true;
    var qchipClass = 'qchip' + (chipExpanded ? ' is-expanded' : '');
    var caretIcon = chipExpanded ? 'ph-caret-up' : 'ph-caret-down';
    var qchipHtml = '<div class="' + qchipClass + '" data-phase1="qchip-toggle">'
      + '<span class="qchip__icon"><i class="ph ph-info"></i></span>'
      + '<div class="qchip__main">'
      +   '<div class="qchip__company">' + qCompanyLine + '</div>'
      +   '<div class="qchip__title">' + escHtml(qTitle) + '</div>'
      + '</div>'
      + '<i class="ph ' + caretIcon + ' qchip__caret"></i>'
      + '</div>'
      + (chipExpanded ? renderQchipExpand(q) : '');
    // body
    var bodyHtml;
    if (AppState.circlesGateError) {
      bodyHtml = renderGateError(AppState.circlesGateError);
    } else if (AppState.circlesGateLoading) {
      bodyHtml = renderGateLoading(stepCfg);
    } else if (AppState.circlesGateResult) {
      bodyHtml = renderGateResult(AppState.circlesGateResult, stepCfg);
    } else {
      bodyHtml = renderGateLoading(stepCfg); // fallback if 1.5 entered without state
    }
    // sticky submit-bar only on error overall_status
    var stickyBar = '';
    var st = AppState.circlesGateResult && AppState.circlesGateResult.overallStatus;
    if (st === 'error') {
      stickyBar = '<div class="submit-bar">'
        + '<div class="submit-bar__left"></div>'
        + '<div class="submit-bar__right">'
        +   '<button class="btn btn--primary" data-gate-action="back"><i class="ph ph-arrow-left"></i>返回修改</button>'
        + '</div></div>';
    }
    return '<div data-view="circles" data-circles-phase="1.5">'
      + progressHtml + phaseHeadHtml + qchipHtml + bodyHtml + stickyBar
      + '</div>';
  }

  function renderGateResult(result, stepCfg) {
    var status = result.overallStatus;
    var transitionTitle = status === 'ok'    ? '框架完整'
                        : status === 'warn'  ? '框架可通過'
                        :                       '方向需修正';
    var transitionSub = status === 'ok'   ? '所有欄位都對齊到 ' + escHtml(stepCfg.stepLetter) + ' 步核心定義'
                      : status === 'warn' ? '可繼續但有 ' + countByStatus(result.items, 'warn') + ' 個建議優化點'
                      :                     '有 ' + countByStatus(result.items, 'error') + ' 個方向性問題需修正';
    var iconCls = status === 'ok'   ? 'ph-check-circle'
                : status === 'warn' ? 'ph-warning'
                :                     'ph-x-circle';
    var actionHtml = (status === 'ok' || status === 'warn')
      ? '<button class="gate-transition__action" data-gate-action="proceed">繼續 <i class="ph ph-arrow-right"></i></button>'
      : '';
    var okCount = countByStatus(result.items, 'ok');
    var totalCount = result.items.length;
    var itemsHtml = (result.items || []).map(renderGateItem).join('');
    return '<div class="gate-content"><div class="gate-wrap">'
      + '<div class="gate-transition gate-transition--' + status + '">'
      +   '<i class="ph-fill ' + iconCls + ' gate-transition__icon"></i>'
      +   '<div class="gate-transition__main">'
      +     '<div class="gate-transition__title">' + escHtml(transitionTitle) + '</div>'
      +     '<div class="gate-transition__sub">' + escHtml(transitionSub) + '</div>'
      +   '</div>'
      +   actionHtml
      + '</div>'
      + '<div class="gate-section-label">逐欄位回饋 <span class="gate-section-label__count">' + okCount + ' / ' + totalCount + ' 通過</span></div>'
      + '<div class="gate-list">' + itemsHtml + '</div>'
      + '</div></div>';
  }

  function renderGateItem(item) {
    var iconName = item.status === 'ok' ? 'ph-check-circle'
                 : item.status === 'warn' ? 'ph-warning'
                 :                          'ph-x-circle';
    var suggestionHtml = item.suggestion
      ? '<div class="gate-item__suggestion"><strong>修正方向：</strong>' + escHtml(item.suggestion) + '</div>'
      : '';
    return '<div class="gate-item gate-item--' + item.status + '">'
      + '<i class="ph-fill ' + iconName + ' gate-item__icon"></i>'
      + '<div class="gate-item__main">'
      +   '<div class="gate-item__field">' + escHtml(item.field) + '</div>'
      +   '<div class="gate-item__title">' + escHtml(item.title) + '</div>'
      +   '<div class="gate-item__reason">' + escHtml(item.reason) + '</div>'
      +   suggestionHtml
      + '</div></div>';
  }

  function renderGateLoading(stepCfg) {
    return '<div class="gate-content"><div class="gate-loading-wrap">'
      + '<div class="gate-spinner"></div>'
      + '<div class="gate-loading-title">正在審核框架</div>'
      + '<div class="gate-loading-sub">教練閱讀你的回答中…</div>'
      + '<ul class="gate-loading-checklist">'
      +   '<li class="gate-loading-step is-done"><span class="gate-loading-step__icon"><i class="ph ph-check"></i></span>解析欄位內容</li>'
      +   '<li class="gate-loading-step is-active"><span class="gate-loading-step__icon"><i class="ph ph-circle-notch"></i></span>對照 ' + escHtml(stepCfg.stepLetter) + ' 步重點</li>'
      +   '<li class="gate-loading-step is-pending"><span class="gate-loading-step__icon"><i class="ph ph-circle"></i></span>檢查方向性</li>'
      +   '<li class="gate-loading-step is-pending"><span class="gate-loading-step__icon"><i class="ph ph-circle"></i></span>整理回饋</li>'
      + '</ul></div></div>';
  }

  function renderGateError(errorCode) {
    var sub = errorCode === 'GATE_TIMEOUT'     ? '審核逾時，請稍後重試'
            : errorCode === 'GATE_PARSE_ERROR' ? '教練回應格式異常，請重試'
            :                                    '審核服務暫時無法使用，請重試';
    return '<div class="gate-content"><div class="error-wrap">'
      + '<i class="ph ph-cloud-warning error-wrap__icon"></i>'
      + '<div class="error-wrap__title">框架審核失敗</div>'
      + '<div class="error-wrap__sub">' + escHtml(sub) + '</div>'
      + '<div class="error-wrap__code">' + escHtml(errorCode || 'GATE_API_ERROR') + '</div>'
      + '<div class="error-wrap__actions">'
      +   '<button class="btn btn--primary" data-gate-action="retry">重新審核</button>'
      +   '<button class="btn btn--ghost" data-gate-action="back">返回修改</button>'
      + '</div></div></div>';
  }

  function countByStatus(items, st) { return (items || []).filter(function (i) { return i.status === st; }).length; }

  // expose for tests
  window.renderCirclesGate = renderCirclesGate;

  function renderCirclesPhase1() {
    // mockup 03 Section A line 794-1216 — sim mobile / sim tablet / drill desktop
    var q = AppState.circlesSelectedQuestion;
    var mode = AppState.circlesMode || 'simulation';
    var isDrill = mode === 'drill';
    var isDesktop = window.innerWidth >= 1024;
    var stepKey = isDrill ? (AppState.circlesDrillStep || 'C1') : 'C1'; // SB3 scope: C1 only; I/R/C2 same schema
    var stepCfg = CIRCLES_STEP_CONFIG[stepKey] || CIRCLES_STEP_CONFIG.C1;
    var simStepIdx = AppState.circlesSimStep || 0; // 0-based sim step index
    var stepOrder = ['C1', 'I', 'R', 'C2', 'L', 'E', 'S'];
    var currentStepNum = simStepIdx + 1; // 1-based for display

    // Resolve stepKey for sim mode based on simStepIdx
    if (!isDrill) {
      stepKey = stepOrder[simStepIdx] || 'C1';
      stepCfg = CIRCLES_STEP_CONFIG[stepKey] || CIRCLES_STEP_CONFIG.C1;
    }

    // ── L step branch (Plan B SB4) — sol-card multi structure ──
    if (stepCfg && stepCfg.isSolMulti) {
      return renderCirclesPhase1Lstep(q, stepKey, stepCfg, currentStepNum);
    }

    // ── E step branch (Plan B SB7) — per-sol × 4-field nested ──
    if (stepCfg && stepCfg.isEstep) {
      return renderCirclesPhase1Estep(q, stepKey, stepCfg, currentStepNum);
    }

    // ── S step branch (Plan B SB5) — 3 main + 4 tracking ──
    if (stepCfg && stepCfg.isSstep) {
      return renderCirclesPhase1Sstep(q, stepKey, stepCfg, currentStepNum);
    }

    // ── progress bar (sim only) ──
    var progressHtml = isDrill ? '' : renderProgressBar(stepKey);

    // ── phase-head (drill variant: .phase-head--drill) ──
    var eyebrow = isDrill ? stepCfg.eyebrow.drill : stepCfg.eyebrow.sim;
    // User-requested 2026-05-11: remove drill parenthesis subtitle on all 7 CIRCLES
    // steps × all viewports — title shows clean step name only ("C · 澄清情境" etc).
    var title = stepCfg.title;
    var stepNum = stepCfg.stepNum;
    // save-indicator
    var saveHtml = renderSaveIndicator();
    // phase-head__meta: sim mobile = save only; sim tablet+ = save + 完整模擬 N/7步; drill = save + drill note
    // We render two spans and use CSS @media to swap:
    //   .phase-head__meta--mobile: only save-indicator
    //   .phase-head__meta--tablet: save + sep + 完整模擬 · N / 7 步
    //   .phase-head__meta--drill: save + sep + drill 模式 · 此步驟結束即完成
    // Since tablet shows extra info vs mobile, we render the full meta always
    // and use CSS to hide the sep+text on mobile via @media.
    var metaHtml;
    if (isDrill) {
      // drill: save-indicator 永遠顯示;sep + 「drill 模式 · 此步驟結束即完成」
      // 在 mobile (≤ 767px) 用 phase-head__meta-extra 隱藏(對齊 mockup line 254-258)
      metaHtml = '<span class="phase-head__meta">'
        + renderSaveIndicator()
        + '<span class="phase-head__meta-sep phase-head__meta-extra">·</span>'
        + '<span class="phase-head__meta-extra">drill 模式 · 此步驟結束即完成</span>'
        + '</span>';
    } else {
      // sim: mobile shows save only; tablet+ shows save + sep + 完整模擬
      metaHtml = '<span class="phase-head__meta">'
        + renderSaveIndicator()
        + '<span class="phase-head__meta-sep phase-head__meta-extra">·</span>'
        + '<span class="phase-head__meta-extra">完整模擬 · ' + currentStepNum + ' / 7 步</span>'
        + '</span>';
    }

    var phaseHeadClass = 'phase-head' + (isDrill ? ' phase-head--drill' : '');
    var phaseHeadHtml = '<div class="' + phaseHeadClass + '">'
      + '<span class="phase-head__num">' + escHtml(stepNum) + '</span>'
      + '<div class="phase-head__main">'
      + '<div class="phase-head__eyebrow">' + escHtml(eyebrow) + '</div>'
      + '<div class="phase-head__title">' + escHtml(title) + '</div>'
      + '</div>'
      + metaHtml
      + '</div>';

    // ── qchip ──
    var company = (q && q.company) ? q.company : '';
    var product = (q && q.product) ? q.product : '';
    var companyDisplay = company + (product ? ' · ' + product : '');
    // mockup 03 Section B/C/G desktop sim base 全有 suffix；Section A/B/C tablet 無；
    // 與 renderCirclesPhase1Lstep line 666 對齊（isDesktop || isDrill）
    if (isDrill || isDesktop) {
      var diff = (q && q.difficulty) === 'high' ? '高' : (q && q.difficulty) === 'low' ? '低' : '中';
      var qType = (q && q.question_type) === 'improve' ? '改善題' : (q && q.question_type) === 'strategy' ? '策略題' : '設計題';
      companyDisplay += ' · ' + qType + ' · 難度 ' + diff;
    }
    var qTitle = (q && q.problem_statement) ? q.problem_statement : '';
    var chipExpanded = AppState.circlesChipExpanded === true;
    var qchipClass = 'qchip' + (chipExpanded ? ' is-expanded' : '');
    var caretIcon = chipExpanded ? 'ph-caret-up' : 'ph-caret-down';
    var qchipHtml = '<div class="' + qchipClass + '" data-phase1="qchip-toggle">'
      + '<span class="qchip__icon"><i class="ph ph-info"></i></span>'
      + '<div class="qchip__main">'
      + '<div class="qchip__company">' + escHtml(companyDisplay) + '</div>'
      + '<div class="qchip__title">' + escHtml(qTitle) + '</div>'
      + '</div>'
      + '<i class="ph ' + caretIcon + ' qchip__caret"></i>'
      + '</div>'
      + (chipExpanded ? renderQchipExpand(q) : '');

    // ── phase-body with 4 fields ──
    // desktop（sim 與 drill 都顯示 rail — user 親要求 7 步全 rail 一致）
    var useRail = isDesktop;
    var phaseBodyClass = 'phase-body' + (useRail ? ' phase-body--with-rail' : '');
    var fieldsHtml = stepCfg.fields.map(function (f, i) {
      return renderPhase1Field(f, i, isDrill);
    }).join('');
    var phaseBodyHtml = '<div class="' + phaseBodyClass + '">'
      + '<div>' + fieldsHtml + '</div>'
      + (useRail ? renderRail(stepCfg) : '')
      + '</div>';

    // ── submit-bar ──
    // sim tablet+: show 上一步 ghost (mobile: no ghost)
    // drill: no 上一步 at all
    // We render the ghost btn conditionally:
    //   - drill: empty left
    //   - sim: ghost btn in left (CSS hides on mobile via .submit-bar__left--sim-only)
    var ghostHtml = '';
    if (!isDrill) {
      // sim: tablet+ shows 上一步; mobile: hide via CSS
      ghostHtml = '<button class="btn btn--ghost submit-bar__back" data-phase1="back">'
        + '<i class="ph ph-arrow-left"></i>上一步'
        + '</button>';
    }
    var submitBarHtml = '<div class="submit-bar">'
      + '<div class="submit-bar__left">' + ghostHtml + '</div>'
      + '<div class="submit-bar__right">'
      + '<button class="btn btn--primary" data-phase1="submit">下一步<i class="ph ph-arrow-right"></i></button>'
      + '</div>'
      + '</div>';

    return applyPhase1StateOverlay(
        '<div data-view="circles" data-circles-phase="1">'
      + progressHtml
      + phaseHeadHtml
      + qchipHtml
      + phaseBodyHtml
      + submitBarHtml
      + '</div>'
    );
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
    // mockup 01 viewport-conditional contract:
    //   mobile  (≤767px,  line 855):  mode-tag「完整」短 / 隱 product / 隱 難度
    //   tablet  (768-1023, line 947):  mode-tag「完整模擬」長 / 顯 product / 隱 難度
    //   desktop (≥1024,    line 1042): mode-tag「完整模擬」長 / 顯 product / 顯 難度
    // We render all three forms in DOM and use CSS @media to swap visibility.
    var isSim = (mode === 'simulation');
    var tagClass = isSim ? 'mode-tag--sim' : 'mode-tag--drill';
    var tagIcon  = isSim ? 'ph-list-checks' : 'ph-target';
    var tagShort = isSim ? '完整' : '步驟練';
    var tagLong  = isSim ? '完整模擬' : '步驟加練';
    var num = String(idx + 1).padStart(2, '0');
    var diff = q.difficulty === 'high' ? '高' : q.difficulty === 'low' ? '低' : '中';
    var title = escHtml(q.company) + (q.product ? ' · ' + escHtml(q.product) : '');
    var meta = '<div class="qcard__meta">'
      + '<span class="mode-tag ' + tagClass + '">'
      +   '<i class="ph ' + tagIcon + '"></i>'
      +   '<span class="mode-tag__text mode-tag__text--short">' + tagShort + '</span>'
      +   '<span class="mode-tag__text mode-tag__text--long">' + tagLong + '</span>'
      + '</span>'
      + '<span class="qcard__meta-sep">·</span>'
      + escHtml(q.company)
      + (q.product ? '<span class="qcard__meta-product"><span class="qcard__meta-sep">·</span>' + escHtml(q.product) + '</span>' : '')
      + '<span class="qcard__meta-difficulty"><span class="qcard__meta-sep">·</span><span style="color:var(--c-ink-4);">難度 ' + diff + '</span></span>'
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
    // outer wrapper carries .drill-pill-row class so existing
    // @media (min-width: 1024px) { .drill-pill-row { display:none } } hides
    // the pill row on desktop where .drill-rail aside takes over.
    return '<div class="drill-pill-row" style="margin-bottom:var(--s-4);">'
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
    var qaOpen = AppState.circlesQaOpen === true; // default closed (user 2026-05-04)

    // ── stats-strip (mockup viewport-conditional hint suffix) ──
    //   mobile  (≤767, line 808-815):  no hint
    //   tablet  (768-1023, line 906):  「已完成 12 / 100 題」short
    //   desktop (≥1024, line 999):     「已完成 12 / 100 題 · 持續 4 週連續練習」long
    // Two hint spans rendered, CSS @media swaps. Streaks placeholder until backend supports.
    var statsHtml = '<div class="stats-strip">'
      + '<i class="ph ph-chart-bar stats-strip__icon"></i>'
      + '<span class="stats-strip__item"><span class="stats-strip__num" data-stat="completed">0</span>已完成</span>'
      + '<span class="stats-strip__sep">·</span>'
      + '<span class="stats-strip__item"><span class="stats-strip__num" data-stat="active">0</span>進行中</span>'
      + '<span class="stats-strip__sep">·</span>'
      + '<span class="stats-strip__item"><span class="stats-strip__num" data-stat="weekly">0</span>本週</span>'
      + '<span class="stats-strip__hint stats-strip__hint--tablet" data-stat="hint-short"></span>'
      + '<span class="stats-strip__hint stats-strip__hint--desktop" data-stat="hint-long"></span>'
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

    // ── mode-selector (mockup viewport-conditional bodies — 3-tier) ──
    //   mobile  (≤767, line 833/837):     short
    //   tablet  (768-1023, line 925/929):  medium
    //   desktop (≥1024, line 1020/1024):   long
    var modeSelectorHtml = '<div class="mode-selector mode-section">'
      + '<button class="mode-card' + (mode === 'simulation' ? ' is-active' : '') + '" data-circles="mode" data-mode="simulation" data-circles-mode="simulation">'
      + '<div class="mode-card__head"><i class="ph ph-list-checks"></i><span class="mode-card__title">完整模擬</span></div>'
      + '<div class="mode-card__body mode-card__body--mobile">7 步循序練習</div>'
      + '<div class="mode-card__body mode-card__body--tablet">7 步循序練習，最完整。可上一步 / 下一步</div>'
      + '<div class="mode-card__body mode-card__body--desktop">7 步循序（C → I → R → C → L → E → S）。可隨時上一步 / 下一步調整。最完整的訓練。</div>'
      + '</button>'
      + '<button class="mode-card' + (mode === 'drill' ? ' is-active' : '') + '" data-circles="mode" data-mode="drill" data-circles-mode="drill">'
      + '<div class="mode-card__head"><i class="ph ph-target"></i><span class="mode-card__title">步驟加練</span></div>'
      + '<div class="mode-card__body mode-card__body--mobile">單練 C / I / R</div>'
      + '<div class="mode-card__body mode-card__body--tablet">單練 C / I / R 三步。該步結束即整 session 完成</div>'
      + '<div class="mode-card__body mode-card__body--desktop">單練 C / I / R 三步任一。專注練好其中一步。該步結束即整 session 完成。</div>'
      + '</button>'
      + '</div>';

    // ── search-wrap (mockup line 843 mobile / 935 tablet / 1030 desktop) ──
    // placeholder is HTML attribute (CSS can't swap); pick desktop-long as it
    // covers tablet/desktop and is more informative on mobile too. Tradeoff
    // accepted per spec §0.7 美學判斷只能 user 看 — single-pick is honest.
    var searchHtml = '<div class="search-wrap">'
      + '<i class="ph ph-magnifying-glass search-wrap__icon"></i>'
      + '<input type="search" placeholder="搜尋題目（公司 / 產品 / 主題關鍵字）— 不分大小寫" value="' + escHtml(AppState.circlesSearchText || '') + '">'
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

    // ── reshuffle (mockup viewport-conditional suffix) ──
    //   mobile/tablet (line 870, 962):  「隨機抽 5 題（不含目前的題）」 base
    //   desktop (line 1057): 「...— 重抽不會打斷你的滾動位置」 desktop suffix
    var reshuffleHtml = '<button class="reshuffle" data-circles="reshuffle">'
      + '<i class="ph ph-shuffle"></i>'
      + '隨機抽 5 題（不含目前的題）'
      + '<span class="reshuffle__hint">— 重抽不會打斷你的滾動位置</span>'
      + '</button>';

    // ── home wrapper center content ──
    // drill mode → mobile/tablet: prepend drill-pill-row above mode-selector
    // Plan D SB2: prepend onboarding welcome card (step 0) if active
    var isDrill = mode === 'drill';
    var onbWelcomeHtml = (AppState.onboardingActive && AppState.onboardingStep === 0)
      ? renderOnbWelcome() : '';
    var centerHtml = onbWelcomeHtml
      + (isDrill ? renderDrillPillRow() : '')
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
      var path = AppState.accessToken ? '/api/circles-stats' : '/api/guest-circles-stats';
      var headers = {};
      if (AppState.accessToken) headers['Authorization'] = 'Bearer ' + AppState.accessToken;
      else if (AppState.guestId) headers['X-Guest-ID'] = AppState.guestId;
      headers['Content-Type'] = 'application/json';
      var res = await fetch(path, { headers: headers, signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) return;
      var data = await res.json();
      var numEls = document.querySelectorAll('[data-stat]');
      var streakWeeks = (data.streakWeeks != null) ? data.streakWeeks : 4; // backend not exposing yet — placeholder default
      numEls.forEach(function (el) {
        var stat = el.dataset.stat;
        if (stat === 'completed' && data.completed != null) el.textContent = data.completed;
        if (stat === 'active'    && data.active != null)    el.textContent = data.active;
        if (stat === 'weekly'    && data.weeklyCompleted != null) el.textContent = data.weeklyCompleted;
        // mockup line 906 tablet:「已完成 N / 100 題」/ line 999 desktop: 加「· 持續 X 週連續練習」
        if (stat === 'hint-short' && data.completed != null) el.textContent = '已完成 ' + data.completed + ' / 100 題';
        if (stat === 'hint-long'  && data.completed != null) el.textContent = '已完成 ' + data.completed + ' / 100 題 · 持續 ' + streakWeeks + ' 週連續練習';
      });
    } catch (_) { /* stats are non-critical — abort / network errors silently swallowed */ }
  }

  // loadNsmStats — Bug 4 fix 2026-05-11. Populates [data-stats-strip="nsm"] after NSM home render.
  // Parallel to loadCirclesStats — no abstraction to avoid coupling / CIRCLES regression risk.
  async function loadNsmStats() {
    try {
      var controller = new AbortController();
      var timer = setTimeout(function () { controller.abort(); }, 5000);
      var path = AppState.accessToken ? '/api/nsm-stats' : '/api/guest-nsm-stats';
      var headers = {};
      if (AppState.accessToken) headers['Authorization'] = 'Bearer ' + AppState.accessToken;
      else if (AppState.guestId) headers['X-Guest-ID'] = AppState.guestId;
      headers['Content-Type'] = 'application/json';
      var res = await fetch(path, { headers: headers, signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) return;
      var data = await res.json();
      var strip = document.querySelector('[data-stats-strip="nsm"]');
      if (!strip) return;
      var c = strip.querySelector('[data-stat="completed"]'); if (c) c.textContent = data.completed != null ? data.completed : 0;
      var a = strip.querySelector('[data-stat="active"]');    if (a) a.textContent = data.active != null ? data.active : 0;
      var w = strip.querySelector('[data-stat="weekly"]');    if (w) w.textContent = data.weeklyCompleted != null ? data.weeklyCompleted : 0;
    } catch (_) { /* stats are non-critical — abort / network errors silently swallowed */ }
  }

  var _circlesSearchDebounce = null;

  function bindCirclesHome() {
    // mode-card clicks
    document.querySelectorAll('[data-circles-mode]').forEach(function (el) {
      el.addEventListener('click', function () {
        var newMode = el.dataset.circlesMode;
        AppState.circlesMode = newMode;
        // Drill mode requires a specific step pointer for backend session row.
        // If user enters drill mode without prior drill-pill selection, default
        // to 'C1'. This prevents POST /draft from sending body without drill_step,
        // which produces backend rows with drill_step=null. Such rows render as
        // generic「步驟加練」 in offcanvas instead of specific「C 澄清」, AND get
        // treated as a different (qid, mode, drill_step) tuple by the backend
        // idempotent guard — so a follow-up drill-pill selection creates a
        // SECOND session for the same question (user-reported: 4 drill sessions
        // for 2 questions due to drill_step null vs 'C1' divergence).
        // User-selected drill-pill is preserved across mode toggles.
        if (newMode === 'drill' && !AppState.circlesDrillStep) {
          AppState.circlesDrillStep = 'C1';
        }
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
    // 不重抽 5 題（user 確認 2026-05-04: 每題 7 步通用,不需要切 step 換題;
    // 切 step 是讓 user 想練不同 step 時 hint+範例答案自動切 step-specific 內容,題目可同）
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
    // P0: must restore existing draft (in_progress session OR localStorage cache)
    // for this qid — previously this path skipped both, wiping user's saved work.
    document.querySelectorAll('[data-circles="qcard-confirm"]').forEach(function (el) {
      el.addEventListener('click', function (e) {
        e.stopPropagation();
        var qid = el.dataset.qid;
        var q = (window.CIRCLES_QUESTIONS || []).find(function (x) { return x.id === qid; });
        if (!q) return;
        var mode = AppState.circlesMode === 'drill' ? 'drill' : 'simulation';
        var drillStep = mode === 'drill' ? AppState.circlesDrillStep : null;
        // Resume already-loaded session if recent rail / history list contains a
        // matching in-progress draft. Use the shared restore helper which fetches
        // session detail + populates frameworkDraft + step_drafts.
        var pools = [
          AppState.circlesRecentSessions || [],
          AppState.historyList || [],
        ];
        var existing = null;
        for (var pi = 0; pi < pools.length && !existing; pi++) {
          existing = pools[pi].find(function (s) {
            if (!s || s.question_id !== qid) return false;
            if (s.status && s.status !== 'active' && s.status !== 'in_progress') return false;
            if (s.mode && s.mode !== mode) return false;
            if (mode === 'drill' && drillStep && s.drill_step !== drillStep) return false;
            return true;
          });
        }
        if (existing) {
          loadCirclesSessionFromHistory(existing);
          return;
        }
        // No live session — seed AppState from localStorage cache so user's
        // typed-but-not-yet-synced draft is not silently dropped.
        AppState.circlesSelectedQuestion = q;
        AppState.circlesPhase = 1;
        AppState.circlesSimStep = 0;
        AppState.circlesExpandedQid = null;
        AppState.circlesPhase1Solutions = [{ name: '', mechanism: '' }, { name: '', mechanism: '' }];
        try {
          var raw = localStorage.getItem('pmdrill:circles:draft:' + qid);
          if (raw) {
            var local = JSON.parse(raw);
            if (local && typeof local === 'object') {
              if (local.framework) AppState.circlesFrameworkDraft = local.framework;
              if (local.P1) AppState.circlesPhase1 = local.P1;
              if (local.P1S) AppState.circlesPhase1S = local.P1S;
              if (Array.isArray(local.P1L) && local.P1L.length) AppState.circlesPhase1Solutions = local.P1L;
              if (local.P1E) AppState.circlesPhase1Evaluate = local.P1E;
            }
          }
        } catch (_) { /* localStorage unreadable — fresh start */ }
        render();
      });
    });

    // recent-item click → resume session via shared restore helper (B5 — mockup 01 line 1061-1092)
    document.querySelectorAll('[data-circles="recent-item"]').forEach(function (el) {
      el.addEventListener('click', function () {
        var id = el.dataset.id;
        var list = AppState.circlesRecentSessions || [];
        var item = list.find(function (i) { return String(i.id) === String(id); });
        if (!item) return;
        loadCirclesSessionFromHistory(item);
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

  var NSM_DIMENSION_CONFIGS = {
    attention: {
      label: '注意力型',
      typeIcon: 'ph-play-circle',
      typeClass: 'nsm-context-card__type--attention',
      dims: [
        { id: 'reach',     label: '觸及廣度', desc: '有多少用戶真正觸碰到核心功能（非僅登入）',     coachQ: 'AHA 時刻是什麼動作？做到這個動作的人有多少？',           hint: '' },
        { id: 'depth',     label: '互動深度', desc: '每位用戶每次使用的品質與投入程度',             coachQ: '用戶停得夠深嗎？時長、完播率、互動次數哪個更能反映價值？', hint: '' },
        { id: 'frequency', label: '習慣頻率', desc: '用戶是否形成定期回訪的使用習慣',               coachQ: '每週/每月回來幾次？DAU/MAU 比越高代表黏性越強',           hint: '' },
        { id: 'impact', label: '留存驅力', desc: '什麼讓用戶持續回訪而非逐漸流失',               coachQ: '社交關係？個人化推薦？收藏習慣？找出最強的留存槓桿',     hint: '' },
      ],
    },
    transaction: {
      label: '交易量型',
      typeIcon: 'ph-shopping-cart',
      typeClass: 'nsm-context-card__type--transaction',
      dims: [
        { id: 'reach',     label: '供給廣度', desc: '有多少符合需求的供給方在平台',                 coachQ: '供給端的廣度與覆蓋率是否充足？',                         hint: '' },
        { id: 'depth',     label: '需求深度', desc: '每筆需求的訂單規模與複雜度',                   coachQ: '單筆訂單金額或訂單複雜度是否能反映價值？',               hint: '' },
        { id: 'frequency', label: '匹配效率', desc: '需求成功匹配到供給的速度與比例',               coachQ: '從搜尋到成交的轉換率與時間？',                           hint: '' },
        { id: 'impact', label: '復購留存', desc: '完成首次交易後再次回購的比例',                 coachQ: '哪一段時間內復購比例最能反映平台健康？',                 hint: '' },
      ],
    },
    creator: {
      label: '創造力型',
      typeIcon: 'ph-pencil-simple',
      typeClass: 'nsm-context-card__type--creator',
      dims: [
        { id: 'reach',     label: '創造廣度', desc: '有多少創作者持續產出內容',                     coachQ: '活躍創作者數與內容產出量哪個更代表平台活力？',           hint: '' },
        { id: 'depth',     label: '成果品質', desc: '創作者產出內容的品質與互動量',                 coachQ: '每件作品平均互動量、停留時間怎樣最能反映品質？',         hint: '' },
        { id: 'frequency', label: '採用廣度', desc: '創作者作品被消費端採用的比例',                 coachQ: '消費者觸及創作者作品的比例與深度？',                     hint: '' },
        { id: 'impact', label: '商業轉化', desc: '創作行為轉化為持續商業價值的能力',             coachQ: '創作者收入或商業轉化指標如何衡量？',                     hint: '' },
      ],
    },
    saas: {
      label: 'SaaS 型',
      typeIcon: 'ph-buildings',
      typeClass: 'nsm-context-card__type--saas',
      dims: [
        { id: 'reach',     label: '啟用廣度', desc: '新客戶中有多少真正完成啟用',                   coachQ: '注意是 activation，不是 signup——誰真正跑完了核心工作流？', hint: '' },
        { id: 'depth',     label: '席次深度', desc: '每個帳號內有多少人在真正使用核心功能',           coachQ: '企業付費，但有幾個人實際在用？席次利用率多高？',             hint: '席次利用率拆法：分母用「已開通席次數」、分子用「過去 30 天有登入並完成核心動作的人數」。注意排除 admin、IT、純 viewer 角色 — 那些是「被動觀察」非「主動使用」。例如：100 席的客戶若 60 人活躍，席次利用率 = 60%；低於 40% 通常代表續約風險。' },
        { id: 'frequency', label: '黏著頻率', desc: '使用頻率是否顯示產品已嵌入日常工作流',           coachQ: '每天都用 vs 偶爾用——是剛需工具嗎？DAU/MAU 比多高？',         hint: '' },
        { id: 'impact', label: '擴張信號', desc: '現有客戶是否在增加使用',                         coachQ: 'NRR > 100% 代表客戶在擴張——多少比例帳號在 90 天內擴展？',   hint: '' },
      ],
    },
  };

  function getNsmDimConfig(productType) {
    return NSM_DIMENSION_CONFIGS[productType] || NSM_DIMENSION_CONFIGS.attention;
  }

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
    var cards;
    if ((AppState.nsmDisplayedQuestions || []).length === 0 && AppState.nsmSearchText) {
      cards = '<div class="nsm-empty-search">'
        + '<div class="nsm-empty-search__icon"><i class="ph ph-magnifying-glass"></i></div>'
        + '<div class="nsm-empty-search__title">沒有符合「' + escHtml(AppState.nsmSearchText) + '」的題目</div>'
        + '<div class="nsm-empty-search__sub">試試其他關鍵字或'
        + '<button class="link-btn" data-action="clear-search">清除搜尋</button></div>'
        + '</div>';
    } else {
      cards = (AppState.nsmDisplayedQuestions || []).map(function (q) {
        return renderNSMQCard(q, !!(sel && sel.id === q.id));
      }).join('');
    }
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
    // NSM home stats strip (Bug 4 fix 2026-05-11) — mirror CIRCLES stats strip at line ~5274
    // Numbers populated by async loadNsmStats() after render. data-stats-strip="nsm"
    // distinguishes from CIRCLES strip so CIRCLES fetch logic is untouched.
    var nsmStatsHtml = '<div class="stats-strip" data-stats-strip="nsm">'
      + '<i class="ph ph-chart-bar stats-strip__icon"></i>'
      + '<span class="stats-strip__item"><span class="stats-strip__num" data-stat="completed">0</span>已完成</span>'
      + '<span class="stats-strip__sep">·</span>'
      + '<span class="stats-strip__item"><span class="stats-strip__num" data-stat="active">0</span>進行中</span>'
      + '<span class="stats-strip__sep">·</span>'
      + '<span class="stats-strip__item"><span class="stats-strip__num" data-stat="weekly">0</span>本週</span>'
      + '<span class="stats-strip__hint stats-strip__hint--tablet" data-stat="hint-short"></span>'
      + '<span class="stats-strip__hint stats-strip__hint--desktop" data-stat="hint-long"></span>'
      + '</div>';
    return '<div data-view="nsm" data-nsm-step="1"' + selAttr + '>'
      + '<div class="phase-head"><span class="phase-head__num">1</span>'
      + '<div class="phase-head__main">'
      + '<div class="phase-head__eyebrow">NSM · 北極星訓練</div>'
      + '<div class="phase-head__title">選擇企業情境</div>'
      + '</div>'
      + '<div class="phase-head__meta">' + metaContent + '</div>'
      + '</div>'
      + renderNSMProgress(1)
      + nsmStatsHtml
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
        var caret = searchInput.selectionStart;
        AppState.nsmSearchText = searchInput.value;
        nsmPickDisplayed(false);
        render();
        var newInput = document.querySelector('[data-nsm="search"]');
        if (newInput) {
          newInput.focus();
          try { newInput.setSelectionRange(caret, caret); } catch (_) {}
        }
      });
    }
    var step1El = document.querySelector('[data-nsm-step="1"]');
    if (step1El) {
      step1El.addEventListener('click', function (e) {
        if (e.target.closest('[data-action="clear-search"]')) {
          AppState.nsmSearchText = '';
          var si = document.querySelector('[data-nsm="search"]');
          if (si) si.value = '';
          nsmPickDisplayed(false);
          render();
        }
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
    // Load NSM stats async (non-blocking) — Bug 4 fix 2026-05-11
    loadNsmStats();
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

  // ── renderCirclesPhase3 (Plan B Phase 3 — mockup 11) ─────────────────────────
  // Phase 3 state matrix:
  //   1. circlesPhase3Error set        → Section D Error
  //   2. !circlesScoreResult           → Section C Loading
  //   3. circlesScoreResult exists     → Section A/B (data-driven)

  // Timers for loading state — stored on window to allow cleanup
  var _phase3LoadingInterval = null;
  var _phase3LoadingTimeout = null;
  var _phase3SlowTimeout = null;    // mockup 12: 60s slow variant timer

  function clearPhase3Timers() {
    if (_phase3LoadingInterval) { clearInterval(_phase3LoadingInterval); _phase3LoadingInterval = null; }
    if (_phase3LoadingTimeout)  { clearTimeout(_phase3LoadingTimeout);   _phase3LoadingTimeout  = null; }
    if (_phase3SlowTimeout)     { clearTimeout(_phase3SlowTimeout);      _phase3SlowTimeout     = null; }
    AppState.circlesPhase3LoadingSlow = false;
  }

  function renderCirclesProgressBar(activeStepKey) {
    // mockup 11 — .circles-progress (larger dots, labels below)
    var steps = [
      { letter: 'C', label: '釐清', key: 'C1' },
      { letter: 'I', label: '用戶', key: 'I'  },
      { letter: 'R', label: '需求', key: 'R'  },
      { letter: 'C', label: '排序', key: 'C2' },
      { letter: 'L', label: '方案', key: 'L'  },
      { letter: 'E', label: '取捨', key: 'E'  },
      { letter: 'S', label: '總結', key: 'S'  },
    ];
    var stepOrder = ['C1', 'I', 'R', 'C2', 'L', 'E', 'S'];
    var activeIdx = stepOrder.indexOf(activeStepKey);
    var html = '<div class="circles-progress">';
    steps.forEach(function (s, idx) {
      var isDone   = idx < activeIdx;
      var isActive = idx === activeIdx;
      var stepCls  = 'circles-progress__step' + (isDone ? ' is-done' : '') + (isActive ? ' is-active' : '');
      var lineCls  = 'circles-progress__line' + (isDone ? ' is-done' : '');
      html += '<div class="' + stepCls + '">'
            + '<div class="circles-progress__dot">' + escHtml(s.letter) + '</div>'
            + '<div class="circles-progress__label">' + escHtml(s.label) + '</div>'
            + '</div>';
      if (idx < steps.length - 1) {
        html += '<div class="' + lineCls + '"></div>';
      }
    });
    return html + '</div>';
  }

  function renderCirclesNav(stepKey) {
    // mockup 11 circles-nav (back row + title + subtitle)
    var q = AppState.circlesSelectedQuestion || {};
    var company = escHtml(q.company || '');
    var product = escHtml(q.product  || '');
    var stepTitles = { C1: '澄清情境', I: '用戶分析', R: '需求分析', C2: '方案排序', L: '方案列舉', E: '方案取捨', S: 'NSM 總結' };
    var stepTitle = escHtml((stepTitles[stepKey] || stepKey) + ' 評分結果');
    var sub = company && product ? (company + ' · ' + product) : (company || product);
    return '<div class="circles-nav">'
      + '<button class="circles-nav__back" data-phase3="nav-back" aria-label="返回"><i class="ph ph-arrow-left"></i></button>'
      + '<div class="circles-nav__main">'
      + '<div class="circles-nav__title">' + stepTitle + '</div>'
      + (sub ? '<div class="circles-nav__sub">' + escHtml(sub) + '</div>' : '')
      + '</div>'
      + '</div>';
  }

  function renderPhase3Loading() {
    // Section C — 4-step checklist driven by AppState.circlesPhase3LoadingStep (0-3)
    var steps = [
      { label: '解析框架' },
      { label: '計算分數' },
      { label: '生成示範答案' },
      { label: '整理建議' },
    ];
    var currentStep = AppState.circlesPhase3LoadingStep || 0;
    var stepHtml = steps.map(function (s, idx) {
      var cls, icon;
      if (idx < currentStep) {
        cls = 'loading-step is-done';
        icon = '<i class="ph ph-check"></i>';
      } else if (idx === currentStep) {
        cls = 'loading-step is-active';
        icon = '<i class="ph ph-circle-notch"></i>';
      } else {
        cls = 'loading-step is-pending';
        icon = '<i class="ph ph-circle"></i>';
      }
      return '<div class="' + cls + '"><span class="loading-step__icon">' + icon + '</span>' + escHtml(s.label) + '</div>';
    }).join('');

    var stepKey = AppState.circlesMode === 'drill'
      ? (AppState.circlesDrillStep || 'C1')
      : (['C1', 'I', 'R', 'C2', 'L', 'E', 'S'][AppState.circlesSimStep || 0] || 'C1');

    // mockup 12 Section A: 60s+ → loading-sub switches to warn slow variant (inline, no toast)
    var loadingSubHtml = AppState.circlesPhase3LoadingSlow
      ? '<div class="loading-sub loading-sub--slow"><i class="ph ph-clock-countdown"></i>比預期慢一些…AI 深度分析中，偶而會需要比較久時間，請再等等。</div>'
      : '<div class="loading-sub">AI 正在評估你的回答，請勿關閉本頁。</div>';

    return '<div data-view="circles" data-phase="3">'
      + renderCirclesNav(stepKey)
      + renderCirclesProgressBar(stepKey)
      + '<div class="loading-wrap">'
      + '<div class="loading-spinner"></div>'
      + '<div class="loading-title">正在生成評分</div>'
      + loadingSubHtml
      + '<div class="loading-checklist">' + stepHtml + '</div>'
      + '</div>'
      + '</div>';
  }

  function renderPhase3Error() {
    // Section D (mockup 11) / B / C (mockup 12) — error state
    // Error titles and sub-copy are code-specific per mockup 12 verbatim
    var err = AppState.circlesPhase3Error || {};
    var code = err.code || 'EVAL_TIMEOUT';
    var titleCopy, subCopy;
    if (code === 'EVAL_TIMEOUT') {
      titleCopy = '評分生成失敗';
      subCopy   = 'AI 服務暫時無法回應，請稍後再試。你的答案已自動保存。';
    } else if (code === 'EVAL_API_ERROR') {
      titleCopy = '評分服務暫時不可用';
      subCopy   = '我們的伺服器忙線中，請稍候片刻。你的答案已自動保存。';
    } else if (code === 'EVAL_PARSE_ERROR') {
      titleCopy = '教練回應格式異常';
      subCopy   = 'AI 回傳的內容無法正確解析。重試通常能解決，或返回修改答案。';
    } else {
      titleCopy = '評分服務發生錯誤';
      subCopy   = '評分服務發生錯誤，請重試。';
    }
    var stepKey = AppState.circlesMode === 'drill'
      ? (AppState.circlesDrillStep || 'C1')
      : (['C1', 'I', 'R', 'C2', 'L', 'E', 'S'][AppState.circlesSimStep || 0] || 'C1');

    return '<div data-view="circles" data-phase="3">'
      + renderCirclesNav(stepKey)
      + renderCirclesProgressBar(stepKey)
      + '<div class="error-wrap">'
      + '<div class="error-wrap__icon"><i class="ph-fill ph-cloud-warning"></i></div>'
      + '<div class="error-wrap__title">' + escHtml(titleCopy) + '</div>'
      + '<div class="error-wrap__sub">' + escHtml(subCopy) + '</div>'
      + '<code class="error-wrap__code">' + escHtml(code) + '</code>'
      + '<div class="error-wrap__actions">'
      + '<button class="btn btn--ghost" data-phase3="back-to-phase1"><i class="ph ph-arrow-left"></i>返回修改答案</button>'
      + '<button class="btn btn--primary" data-phase3="retry"><i class="ph ph-arrow-clockwise"></i>重新評分</button>'
      + '</div>'
      + '</div>'
      + '</div>';
  }

  function renderPhase3Score() {
    // Section A (high score) / Section B (low score, data-driven)
    var result = AppState.circlesScoreResult || {};
    var dims = result.dimensions || [];
    var cv = result.coachVersion || {};
    var stepKey = AppState.circlesMode === 'drill'
      ? (AppState.circlesDrillStep || 'C1')
      : (['C1', 'I', 'R', 'C2', 'L', 'E', 'S'][AppState.circlesSimStep || 0] || 'C1');
    var stepTitles = { C1: 'C — 澄清情境', I: 'I — 用戶分析', R: 'R — 需求分析', C2: 'C — 方案排序', L: 'L — 方案列舉', E: 'E — 方案取捨', S: 'S — NSM 總結' };
    var stepSub = stepTitles[stepKey] || stepKey;

    // Determine if ANY dim has score ≤ 2 (auto-expand rule)
    var hasLowDim = dims.some(function (d) { return (d.score || 0) <= 2; });
    // Auto-open coach-demo on first render if any low dim (unless user already set it)
    if (hasLowDim && AppState.circlesPhase3CoachDemoOpen === false && !AppState._phase3CoachDemoInitialized) {
      AppState.circlesPhase3CoachDemoOpen = true;
    }
    AppState._phase3CoachDemoInitialized = true;

    var isDesktop = window.innerWidth >= 1024;

    // ── dim-row HTML ─────────────────────────────────────────────────────────
    var dimListHtml = '<div class="dim-list">';
    dims.forEach(function (dim, idx) {
      var score = dim.score || 0;
      var isLow = score <= 2;
      // auto-expand logic: low dim always open; non-low dim: desktop → open, mobile/tablet → check user toggle
      var userToggled = AppState.circlesPhase3DimExpanded[idx];
      var isOpen;
      if (isLow) {
        isOpen = true; // always open for low score
      } else if (userToggled !== undefined) {
        isOpen = userToggled;
      } else {
        isOpen = isDesktop; // desktop auto-expand all
      }
      var dimCls = 'dim-row' + (isLow ? ' is-low' : '') + (isOpen ? ' is-open' : '');
      var barPct = Math.round((score / 5) * 100);
      var dimCv = dim.coachVersion || {};
      var cvText = dimCv.text || '';

      var bodyHtml = '';
      if (isOpen) {
        bodyHtml = '<div class="dim-row__body">'
          + (dim.comment ? '<div class="dim-row__comment">' + escHtml(dim.comment) + '</div>' : '')
          + (cvText ? '<div class="dim-row__coach-version"><div class="dim-row__coach-version-label">教練版本</div><div class="dim-row__coach-version-text">' + escHtml(cvText) + '</div></div>' : '')
          + (dim.suggestion ? '<div class="dim-row__tip"><i class="ph ph-lightbulb"></i>' + escHtml(dim.suggestion) + '</div>' : '')
          + '</div>';
      }

      dimListHtml += '<div class="' + dimCls + '" data-dim-idx="' + idx + '">'
        + '<div class="dim-row__head" data-phase3="dim-toggle" data-dim-idx="' + idx + '">'
        + '<div class="dim-row__main">'
        + '<div class="dim-row__head-row">'
        + '<span class="dim-row__name">' + escHtml(dim.name || '') + '</span>'
        + '<span class="dim-row__score">' + score + '<span class="dim-row__score-max"> / 5</span></span>'
        + '</div>'
        + '<div class="dim-row__bar-wrap"><div class="dim-row__bar-fill" style="width:' + barPct + '%"></div></div>'
        + '</div>'
        + '<i class="ph ph-caret-right dim-row__caret"></i>'
        + '</div>'
        + bodyHtml
        + '</div>';
    });
    dimListHtml += '</div>';

    // ── highlight-grid HTML ──────────────────────────────────────────────────
    var highlightHtml = '<div class="highlight-grid">'
      + '<div class="highlight-card highlight-card--good">'
      + '<div class="highlight-card__label"><i class="ph-fill ph-check-circle"></i>最強表現</div>'
      + '<div class="highlight-card__text">' + escHtml(result.strengths || '') + '</div>'
      + '</div>'
      + '<div class="highlight-card highlight-card--improve">'
      + '<div class="highlight-card__label"><i class="ph-fill ph-warning-circle"></i>最需改進</div>'
      + '<div class="highlight-card__text">' + escHtml(result.improvements || '') + '</div>'
      + '</div>'
      + '</div>';

    // ── coach-demo HTML ──────────────────────────────────────────────────────
    var coachOpen = AppState.circlesPhase3CoachDemoOpen;
    var coachCls = 'coach-demo' + (coachOpen ? ' is-open' : '');
    var coachBodyHtml = '';
    if (coachOpen) {
      var section1 = cv.context
        ? '<div class="coach-section"><div class="coach-section__title"><i class="ph ph-flag"></i>為什麼這個步驟重要</div><div class="coach-section__body">' + escHtml(cv.context) + '</div></div>'
        : '';
      var perFieldHtml = '';
      var perField = cv.perField || [];
      if (perField.length > 0) {
        perFieldHtml = '<div class="coach-section"><div class="coach-section__title"><i class="ph ph-list-numbers"></i>逐欄位示範</div>'
          + '<div class="coach-fields">'
          + perField.map(function (f) {
              return '<div class="coach-field">'
                + '<div class="coach-field__label">' + escHtml(f.label || '') + '</div>'
                + '<div class="coach-field__text">' + escHtml(f.text || '') + '</div>'
                + '</div>';
            }).join('')
          + '</div></div>';
      }
      var section3 = cv.reasoning
        ? '<div class="coach-section"><div class="coach-section__title"><i class="ph ph-quotes"></i>為什麼這樣答</div><div class="coach-reasoning">' + escHtml(cv.reasoning) + '</div></div>'
        : '';
      coachBodyHtml = '<div class="coach-demo__body">'
        + section1
        + perFieldHtml
        + section3
        + '</div>';
    }
    var coachDemoHtml = '<div class="' + coachCls + '">'
      + '<div class="coach-demo__head" data-phase3="coach-demo-toggle">'
      + '<span class="coach-demo__icon"><i class="ph-fill ph-graduation-cap"></i></span>'
      + '<span class="coach-demo__title">教練示範答案</span>'
      + '<i class="ph ph-caret-right coach-demo__caret"></i>'
      + '</div>'
      + coachBodyHtml
      + '</div>';

    // ── score-total HTML ─────────────────────────────────────────────────────
    var scoreTotalHtml = '<div class="score-total">'
      + '<div class="score-total__num">' + escHtml(String(result.totalScore || 0)) + '</div>'
      + '<div class="score-total__sub"><strong>' + escHtml(stepSub) + '</strong> 步驟得分</div>'
      + '</div>';

    // ── submit-bar ────────────────────────────────────────────────────────────
    var submitBarHtml = '<div class="submit-bar">'
      + '<div class="submit-bar__left"><button class="btn btn--ghost" data-phase3="go-home"><i class="ph ph-house"></i>回首頁</button></div>'
      + '<div class="submit-bar__right"><button class="btn btn--primary" data-phase3="retry-question"><i class="ph ph-shuffle"></i>再練一題</button></div>'
      + '</div>';

    // ── layout: mobile/tablet flat, desktop 2-col ────────────────────────────
    var desktopCls = isDesktop ? ' score-body--desktop' : '';
    var scoreBodyHtml = '<div class="score-body' + desktopCls + '">'
      + '<div class="score-col-left">'
      + scoreTotalHtml
      + highlightHtml
      + coachDemoHtml
      + '</div>'
      + dimListHtml
      + '</div>';

    return '<div data-view="circles" data-phase="3">'
      + renderCirclesNav(stepKey)
      + renderCirclesProgressBar(stepKey)
      + scoreBodyHtml
      + submitBarHtml
      + '</div>';
  }

  function renderCirclesPhase3() {
    // State matrix (spec §5)
    if (AppState.circlesPhase3Error) {
      clearPhase3Timers();
      return renderPhase3Error();
    }
    if (!AppState.circlesScoreResult) {
      // Start loading timers if not already running
      if (!_phase3LoadingInterval) {
        _phase3LoadingInterval = setInterval(function () {
          if (AppState.circlesPhase3LoadingStep < 3) {
            AppState.circlesPhase3LoadingStep++;
            render();
          }
        }, 5000);
      }
      // mockup 12 Section A: 60s → slow variant (inline warn text, no toast)
      if (!_phase3SlowTimeout) {
        _phase3SlowTimeout = setTimeout(function () {
          _phase3SlowTimeout = null;
          AppState.circlesPhase3LoadingSlow = true;
          render();
        }, 60000);
      }
      // Actual timeout: 300s (5 min) per mockup 12 spec — internal, not shown to user
      if (!_phase3LoadingTimeout) {
        _phase3LoadingTimeout = setTimeout(function () {
          clearPhase3Timers();
          AppState.circlesPhase3Error = { code: 'EVAL_TIMEOUT', message: 'AI 服務暫時無法回應' };
          render();
        }, 300000);
      }
      return renderPhase3Loading();
    }
    // Score result exists — Section A or B (data-driven)
    clearPhase3Timers();
    return renderPhase3Score();
  }

  function bindCirclesPhase3() {
    // ── dim-row toggle ────────────────────────────────────────────────────────
    document.querySelectorAll('[data-phase3="dim-toggle"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var idx = parseInt(btn.getAttribute('data-dim-idx'), 10);
        var current = AppState.circlesPhase3DimExpanded[idx];
        // Current open state: was it open? (account for low-score always-open)
        var dimRow = btn.closest('.dim-row');
        var wasOpen = dimRow && dimRow.classList.contains('is-open');
        AppState.circlesPhase3DimExpanded[idx] = !wasOpen;
        render();
      });
    });

    // ── coach-demo toggle ─────────────────────────────────────────────────────
    var coachHead = document.querySelector('[data-phase3="coach-demo-toggle"]');
    if (coachHead) {
      coachHead.addEventListener('click', function () {
        AppState.circlesPhase3CoachDemoOpen = !AppState.circlesPhase3CoachDemoOpen;
        render();
      });
    }

    // ── nav-back (circles-nav back arrow) ─────────────────────────────────────
    var navBackBtn = document.querySelector('[data-phase3="nav-back"]');
    if (navBackBtn) {
      navBackBtn.addEventListener('click', function () {
        clearPhase3Timers();
        AppState.circlesPhase = 1;
        AppState.circlesPhase3Error = null;
        AppState.circlesPhase3LoadingStep = 1;
        AppState._phase3CoachDemoInitialized = false;
        render();
      });
    }

    // ── back-to-phase1 ────────────────────────────────────────────────────────
    document.querySelectorAll('[data-phase3="back-to-phase1"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        clearPhase3Timers();
        AppState.circlesPhase = 1;
        AppState.circlesPhase3Error = null;
        AppState.circlesPhase3LoadingStep = 1;
        AppState._phase3CoachDemoInitialized = false;
        render();
      });
    });

    // ── retry (重新評分) ──────────────────────────────────────────────────────
    var retryBtn = document.querySelector('[data-phase3="retry"]');
    if (retryBtn) {
      retryBtn.addEventListener('click', function () {
        clearPhase3Timers();
        AppState.circlesPhase3Error = null;
        AppState.circlesPhase3LoadingStep = 1;
        AppState.circlesScoreResult = null;
        AppState._phase3CoachDemoInitialized = false;
        render();
        // Fire evaluate-step API
        retryEvaluateStep();
      });
    }

    // ── go-home ───────────────────────────────────────────────────────────────
    var goHomeBtn = document.querySelector('[data-phase3="go-home"]');
    if (goHomeBtn) {
      goHomeBtn.addEventListener('click', function () {
        clearPhase3Timers();
        resetCirclesToHome();
        AppState.view = 'circles';
        render();
      });
    }

    // ── retry-question (再練一題) ─────────────────────────────────────────────
    var retryQBtn = document.querySelector('[data-phase3="retry-question"]');
    if (retryQBtn) {
      retryQBtn.addEventListener('click', function () {
        clearPhase3Timers();
        resetCirclesToHome();
        AppState.view = 'circles';
        // Re-shuffle displayed questions so user gets a new set
        AppState.circlesDisplayedQuestions = [];
        render();
      });
    }
  }

  async function retryEvaluateStep() {
    // Re-invoke evaluate-step for the current session + step (mockup 16 §D: set circlesEvaluating)
    var sessionId = AppState.circlesSession && AppState.circlesSession.id;
    if (!sessionId) {
      AppState.circlesPhase3Error = { code: 'EVAL_API_ERROR', message: 'no session' };
      render();
      return;
    }
    AppState.circlesEvaluating = true;
    AppState.evalToastDismissed = false;
    var basePath = AppState.accessToken
      ? '/api/circles-sessions/'
      : '/api/guest-circles-sessions/';
    try {
      var res = await window.apiFetch(basePath + sessionId + '/evaluate-step', {
        method: 'POST',
        body: '{}',
      });
      if (res.ok) {
        var data = await res.json();
        var stepKey = AppState.circlesMode === 'drill'
          ? (AppState.circlesDrillStep || 'C1')
          : (['C1', 'I', 'R', 'C2', 'L', 'E', 'S'][AppState.circlesSimStep || 0] || 'C1');
        if (!AppState.circlesStepScores) AppState.circlesStepScores = {};
        AppState.circlesStepScores[stepKey] = data;
        AppState.circlesScoreResult = data;
        AppState.circlesEvaluating = false;
        AppState.evalToastDismissed = false;
        clearPhase3Timers();
        render();
      } else {
        var errData = await res.json().catch(function () { return {}; });
        var errCode = errData.code || 'EVAL_API_ERROR';
        AppState.circlesEvaluating = false;
        clearPhase3Timers();
        AppState.circlesPhase3Error = { code: errCode, message: errData.error || 'API error' };
        render();
      }
    } catch (e) {
      if (e && e.code === 'SESSION_EXPIRED') return;
      AppState.circlesEvaluating = false;
      clearPhase3Timers();
      AppState.circlesPhase3Error = { code: 'EVAL_API_ERROR', message: e.message || 'network error' };
      render();
    }
  }

  function bindAll() {
    bindNavbar();
    bindOffcanvas();
    if (AppState.view === 'auth') {
      bindAuth();
    }
    if (AppState.view === 'circles'
        && AppState.circlesPhase === 1
        && !AppState.circlesSession
        && !AppState.circlesSelectedQuestion) {
      bindCirclesHome();
      bindOnboarding();
    }
    if (AppState.view === 'circles'
        && AppState.circlesPhase === 1
        && AppState.circlesSelectedQuestion) {
      bindCirclesPhase1();
    }
    if (AppState.view === 'circles' && AppState.circlesPhase === 1.5) {
      bindCirclesGate();
    }
    if (AppState.view === 'circles' && AppState.circlesPhase === 2) {
      bindCirclesPhase2();
    }
    if (AppState.view === 'circles' && AppState.circlesPhase === 3) {
      bindCirclesPhase3();
    }
    if (AppState.view === 'circles' && AppState.circlesPhase === 4) {
      bindCirclesPhase4();
    }
  }

  // ── bindCirclesPhase4 (Plan B Phase 4 — mockup 13) ───────────────────────
  function bindCirclesPhase4() {
    // nav-back
    var navBackBtn = document.querySelector('[data-phase4="nav-back"]');
    if (navBackBtn) {
      navBackBtn.addEventListener('click', function () {
        clearPhase4Timers();
        // Go back to Phase 3 score (sim), or home
        AppState.circlesPhase = AppState.circlesScoreResult ? 3 : 1;
        render();
      });
    }

    // go-home
    document.querySelectorAll('[data-phase4="go-home"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        clearPhase4Timers();
        resetCirclesToHome();
        AppState.view = 'circles';
        render();
      });
    });

    // retry
    var retryBtn = document.querySelector('[data-phase4="retry"]');
    if (retryBtn) {
      retryBtn.addEventListener('click', function () {
        clearPhase4Timers();
        AppState.circlesPhase4Error = null;
        AppState.circlesPhase4LoadingStep = 0;
        AppState.circlesFinalReport = null;
        setPhase4Fired(false);
        render();
      });
    }

    // retry-question (再練一題 — go home, reshuffle)
    var retryQBtn = document.querySelector('[data-phase4="retry-question"]');
    if (retryQBtn) {
      retryQBtn.addEventListener('click', function () {
        clearPhase4Timers();
        resetCirclesToHome();
        AppState.view = 'circles';
        AppState.circlesDisplayedQuestions = [];
        render();
      });
    }

    // export-png (stub)
    var exportBtn = document.querySelector('[data-phase4="export-png"]');
    if (exportBtn) {
      exportBtn.addEventListener('click', function () {
        console.log('export PNG TBD');
      });
    }
  }

  // ── bindCirclesPhase2 (Plan B Phase 2 — mockup 05) ───────────────────────
  function bindCirclesPhase2() {
    // ── coach hint toggle — data-phase2="hint-toggle" data-turn-idx="N" ──
    document.querySelectorAll('[data-phase2="hint-toggle"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var idx = parseInt(btn.getAttribute('data-turn-idx'), 10);
        if (!AppState.circlesPhase2CoachHintExpanded) AppState.circlesPhase2CoachHintExpanded = {};
        AppState.circlesPhase2CoachHintExpanded[idx] = !AppState.circlesPhase2CoachHintExpanded[idx];
        render();
      });
    });

    // ── back button (go to Phase 1) ──
    var backBtn = document.querySelector('[data-phase2="back"]');
    if (backBtn) {
      backBtn.addEventListener('click', function () {
        AppState.circlesPhase = 1;
        render();
      });
    }

    // ── Section F: locked nav buttons ──
    var goPhase1Btn = document.querySelector('[data-phase2="go-phase1"]');
    if (goPhase1Btn) {
      goPhase1Btn.addEventListener('click', function () {
        AppState.circlesPhase = 1;
        render();
      });
    }
    var goPhase3Btn = document.querySelector('[data-phase2="go-phase3"]');
    if (goPhase3Btn) {
      goPhase3Btn.addEventListener('click', function () {
        AppState.circlesPhase = 3;
        render();
      });
    }

    // ── Section D: conclude pill ──
    var concludeBtn = document.querySelector('[data-phase2="conclude"]');
    if (concludeBtn) {
      concludeBtn.addEventListener('click', function () {
        AppState.circlesPhase2ConclusionMode = true;
        AppState.circlesPhase2ExampleOpen = window.innerWidth >= 768; // tablet+ default open
        render();
      });
    }

    // ── Section E: example toggle ──
    var exampleHead = document.querySelector('[data-phase2="example-toggle"]');
    if (exampleHead) {
      exampleHead.addEventListener('click', function () {
        AppState.circlesPhase2ExampleOpen = !AppState.circlesPhase2ExampleOpen;
        render();
      });
    }

    // ── Section E: conclusion textarea — persist draft + update submit btn ──
    var conclusionTextarea = document.querySelector('[data-phase2="conclusion-textarea"]');
    if (conclusionTextarea) {
      conclusionTextarea.addEventListener('input', function () {
        var val = conclusionTextarea.value;
        AppState.circlesPhase2ConclusionDraft = val;
        // Update submit button enabled state without full re-render
        var submitBtn = document.querySelector('.conclusion-actions__submit');
        if (submitBtn) {
          var meetsFloor = val.trim().length >= 30;
          if (meetsFloor) {
            submitBtn.disabled = false;
            submitBtn.classList.remove('is-disabled');
          } else {
            submitBtn.disabled = true;
            submitBtn.classList.add('is-disabled');
          }
        }
        // Persist to localStorage for crash recovery
        var sessionId = AppState.circlesSession && AppState.circlesSession.id;
        var stepKey = AppState.circlesMode === 'drill'
          ? (AppState.circlesDrillStep || 'C1')
          : (['C1', 'I', 'R', 'C2', 'L', 'E', 'S'][AppState.circlesSimStep || 0] || 'C1');
        if (sessionId) {
          try {
            localStorage.setItem('pmdrill:phase2:conclusion:' + sessionId + ':' + stepKey, val);
          } catch (_) {}
        }
      });
    }

    // ── Section E: back to conversation ──
    var conclusionBackBtn = document.querySelector('[data-phase2="conclusion-back"]');
    if (conclusionBackBtn) {
      conclusionBackBtn.addEventListener('click', function () {
        // preserve draft — do not clear circlesPhase2ConclusionDraft
        AppState.circlesPhase2ConclusionMode = false;
        render();
      });
    }

    // ── Section E: confirm submit → POST conclusion-check → evaluate-step ──
    var conclusionSubmitBtn = document.querySelector('[data-phase2="conclusion-submit"]');
    if (conclusionSubmitBtn) {
      conclusionSubmitBtn.addEventListener('click', async function () {
        if (conclusionSubmitBtn.disabled || conclusionSubmitBtn.classList.contains('is-disabled')) return;
        var draft = AppState.circlesPhase2ConclusionDraft || '';
        if (draft.trim().length < 30) return;

        var sessionId = AppState.circlesSession && AppState.circlesSession.id;
        if (!sessionId) return;

        var basePath = AppState.accessToken ? '/api/circles-sessions/' : '/api/guest-circles-sessions/';
        var headers = { 'Content-Type': 'application/json' };
        if (AppState.accessToken) headers['Authorization'] = 'Bearer ' + AppState.accessToken;
        else if (AppState.guestId) headers['X-Guest-ID'] = AppState.guestId;

        // Disable button during submit
        conclusionSubmitBtn.disabled = true;
        conclusionSubmitBtn.classList.add('is-disabled');

        try {
          // Step 1: conclusion-check
          var checkRes = await fetch(basePath + sessionId + '/conclusion-check', {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({ conclusionText: draft }),
          });
          var checkData = await checkRes.json().catch(function () { return {}; });

          // On ok (or if ok field is absent but no error), proceed to evaluate
          if (checkRes.ok && (checkData.ok !== false)) {
            // Step 2: evaluate-step — set circlesEvaluating before fire (mockup 16 §D)
            AppState.circlesEvaluating = true;
            AppState.evalToastDismissed = false;
            AppState.circlesPhase = 3; // advance view to phase 3 loading before fetch
            render();
            var evalRes = await fetch(basePath + sessionId + '/evaluate-step', {
              method: 'POST',
              headers: headers,
              body: '{}',
            });
            if (evalRes.ok) {
              var evalData = await evalRes.json().catch(function () { return {}; });
              // Store score result
              var stepKey = AppState.circlesMode === 'drill'
                ? (AppState.circlesDrillStep || 'C1')
                : (['C1', 'I', 'R', 'C2', 'L', 'E', 'S'][AppState.circlesSimStep || 0] || 'C1');
              if (!AppState.circlesStepScores) AppState.circlesStepScores = {};
              AppState.circlesStepScores[stepKey] = evalData;
              AppState.circlesScoreResult = evalData;
              // Clear conclusion draft + mode
              AppState.circlesPhase2ConclusionDraft = '';
              AppState.circlesPhase2ConclusionMode = false;
              // Mark evaluating done — toast auto-hides on next render
              AppState.circlesEvaluating = false;
              AppState.evalToastDismissed = false;
              render();
            } else {
              // evaluate-step failed — re-enable button
              AppState.circlesEvaluating = false;
              conclusionSubmitBtn.disabled = false;
              conclusionSubmitBtn.classList.remove('is-disabled');
            }
          } else {
            // conclusion-check warn/error — log and re-enable (future improvement: inline guidance)
            console.warn('[Phase 2] conclusion-check returned:', checkData);
            conclusionSubmitBtn.disabled = false;
            conclusionSubmitBtn.classList.remove('is-disabled');
          }
        } catch (e) {
          console.error('[Phase 2] conclusion submit error:', e);
          conclusionSubmitBtn.disabled = false;
          conclusionSubmitBtn.classList.remove('is-disabled');
        }
      });
    }

    // ── Section C: send button + Enter key ──────────────────────────────────
    var sendBtn = document.querySelector('[data-phase2="send"]');
    var messageInput = document.querySelector('[data-phase2="message-input"]');
    var minTip = document.querySelector('[data-phase2="min-tip"]');

    if (sendBtn && messageInput) {
      function doSend() {
        var msg = messageInput.value.trim();
        if (msg.length < 5) {
          // show min tip
          if (minTip) minTip.style.display = '';
          return;
        }
        if (minTip) minTip.style.display = 'none';
        if (AppState.circlesPhase2Streaming) return;

        // Set streaming state
        AppState.circlesPhase2Streaming = true;
        AppState.circlesPhase2StreamError = false;
        AppState.circlesPhase2StreamingTurn = { userMessage: msg, deltaText: '' };
        messageInput.value = '';
        render();

        // Start SSE stream
        streamCirclesMessage(msg);
      }

      sendBtn.addEventListener('click', doSend);
      messageInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          doSend();
        }
      });
      // Show/hide min-tip as user types
      messageInput.addEventListener('input', function () {
        var len = messageInput.value.trim().length;
        if (minTip) minTip.style.display = len > 0 && len < 5 ? '' : 'none';
      });
    }

    // ── Section C: retry button (error state) ────────────────────────────────
    var retryBtn = document.querySelector('[data-phase2="retry"]');
    if (retryBtn) {
      retryBtn.addEventListener('click', function () {
        var streamTurn = AppState.circlesPhase2StreamingTurn;
        if (!streamTurn || !streamTurn.userMessage) return;
        var msg = streamTurn.userMessage;
        AppState.circlesPhase2Streaming = true;
        AppState.circlesPhase2StreamError = false;
        render();
        streamCirclesMessage(msg);
      });
    }
  }

  // ── bindCirclesPhase1 (Plan B SB3 — mockup 03 Section A interactions) ────
  var _phase1CharDebounce = null;
  // P1 永久解：track per-qid in-flight pre-flight to dedupe rapid re-renders.
  // Module-scope (not AppState) to avoid leaking into save payload / restore shape.
  var _phase1PreflightInFlightForQid = null;

  function bindCirclesPhase1() {
    // ── PRE-FLIGHT: ensure backend session exists at Phase 1 mount, before any
    // user input. Closes the saveCycle race window permanently — by the time
    // user types, session.id is already set. Idempotent on backend (POST /draft
    // dedups on (user|guest, qid, mode, drillStep)). De-duped here per-qid so
    // rapid re-renders don't pile up requests; switching question allows a new
    // fire for the new qid. Skipped when session already exists (restored or
    // q-card-confirm matched a pool item).
    (function preflightDraftSession() {
      if (AppState.circlesSession && AppState.circlesSession.id) return;
      var qid = AppState.circlesSelectedQuestion && AppState.circlesSelectedQuestion.id;
      if (!qid) return;
      if (_phase1PreflightInFlightForQid === qid) return;
      _phase1PreflightInFlightForQid = qid;
      ensureCirclesDraftSession()
        .catch(function () { /* network error — local cache covers offline */ })
        .finally(function () {
          if (_phase1PreflightInFlightForQid === qid) _phase1PreflightInFlightForQid = null;
        });
    })();

    // ── restore textareas from circlesFrameworkDraft (after render, on session restore) ──
    // When a session is loaded from history, AppState.circlesFrameworkDraft is populated
    // but the textareas are blank contenteditable divs. Populate them now.
    (function populateTextareasFromDraft() {
      // ── C/I/R/C2 step: [data-phase1="textarea"] from circlesFrameworkDraft ──
      // Canonical lookup uses Chinese keys from CIRCLES_STEP_CONFIG.fields[i].key.
      // ENGLISH_ALIAS provides read-only compatibility for sessions saved before
      // the Chinese-key migration (legacy data + older test fixtures).
      // No positional Object.values() fallback — that caused Bug B mapping drift.
      var ENGLISH_ALIAS = {
        '問題範圍': 'boundaryScope', '時間範圍': 'timeWindow',
        '業務影響': 'businessImpact', '假設確認': 'assumption',
        '目標用戶分群': 'targetSegment', '選定焦點對象': 'focusGroup',
        '用戶動機假設(JTBD)': 'jtbd', '排除對象': 'excluded',
        '功能性': 'functional', '情感性': 'emotional', '社交性': 'social', '核心痛點': 'corePain',
        '取捨標準': 'criteria', '最優先': 'priority', '暫緩': 'defer', '排序理由': 'rationale',
      };
      var stepKey = AppState.circlesMode === 'drill'
        ? (AppState.circlesDrillStep || 'C1')
        : (['C1', 'I', 'R', 'C2', 'L', 'E', 'S'][AppState.circlesSimStep || 0] || 'C1');
      var draftForStep = AppState.circlesFrameworkDraft && AppState.circlesFrameworkDraft[stepKey];
      if (draftForStep) {
        var cfg = CIRCLES_STEP_CONFIG[stepKey];
        if (cfg && cfg.fields) {
          var textareas = document.querySelectorAll('[data-phase1="textarea"]');
          textareas.forEach(function (ta, idx) {
            if (ta.innerHTML && ta.innerHTML.trim()) return;
            var fieldIdx = parseInt(ta.dataset.fieldIdx, 10);
            if (isNaN(fieldIdx)) fieldIdx = idx;
            var fieldKey = cfg.fields[fieldIdx] && cfg.fields[fieldIdx].key;
            if (!fieldKey) return;
            // canonical Chinese-key lookup
            var value = draftForStep[fieldKey];
            // legacy English-alias fallback (read-only; does not affect saves)
            if (value == null || value === '') {
              var alias = ENGLISH_ALIAS[fieldKey];
              if (alias) value = draftForStep[alias];
            }
            if (value) {
              ta.innerHTML = value;
            }
          });
        }
      }

      // ── R1: L step — .rt-textarea[data-sol-idx] (mechanism) + input[data-sol-idx] (name) ──
      var solutions = AppState.circlesPhase1Solutions;
      if (Array.isArray(solutions)) {
        document.querySelectorAll('.rt-textarea[data-sol-idx]').forEach(function (ta) {
          if (ta.innerHTML && ta.innerHTML.trim()) return;
          var idx = parseInt(ta.getAttribute('data-sol-idx'), 10);
          if (isNaN(idx) || !solutions[idx]) return;
          var val = solutions[idx].mechanism || '';
          if (val) ta.innerHTML = val;
        });
        document.querySelectorAll('input.sol-card__name-input[data-sol-idx]').forEach(function (input) {
          if (input.value && input.value.trim()) return;
          var idx = parseInt(input.getAttribute('data-sol-idx'), 10);
          if (isNaN(idx) || !solutions[idx]) return;
          var val = solutions[idx].name || '';
          if (val) input.value = val;
        });
      }

      // ── R1: E step — .rt-textarea[data-circles-e-sol-idx][data-circles-e-field-key] ──
      var evalData = AppState.circlesPhase1Evaluate;
      if (Array.isArray(evalData)) {
        document.querySelectorAll('.rt-textarea[data-circles-e-sol-idx]').forEach(function (ta) {
          if (ta.innerHTML && ta.innerHTML.trim()) return;
          var solIdx = parseInt(ta.getAttribute('data-circles-e-sol-idx'), 10);
          var fieldKey = ta.getAttribute('data-circles-e-field-key');
          if (isNaN(solIdx) || !fieldKey || !evalData[solIdx]) return;
          var val = evalData[solIdx][fieldKey] || '';
          if (val) ta.innerHTML = val;
        });
      }

      // ── R1: S step — .rt-textarea[data-s-textarea="key"] ──
      // key values: '推薦方案' → recommendation, '選擇理由' → reasoning, '北極星指標' → nsm
      var sData = AppState.circlesPhase1S;
      if (sData && typeof sData === 'object') {
        var sKeyMap = { '推薦方案': 'recommendation', '選擇理由': 'reasoning', '北極星指標': 'nsm' };
        document.querySelectorAll('.rt-textarea[data-s-textarea]').forEach(function (ta) {
          if (ta.innerHTML && ta.innerHTML.trim()) return;
          var key = ta.getAttribute('data-s-textarea');
          var stateKey = sKeyMap[key];
          if (!stateKey) return;
          var val = sData[stateKey] || '';
          if (val) ta.innerHTML = val;
        });
      }

      // ── R3-C: S step tracking inputs — input[data-s-tracking] ──
      document.querySelectorAll('input[data-s-tracking]').forEach(function (input) {
        var dimKey = input.dataset.sTracking;
        if (!dimKey) return;
        if (input.value && input.value.trim()) return; // already has content
        if (!AppState.circlesPhase1S || !AppState.circlesPhase1S.tracking) return;
        var v = AppState.circlesPhase1S.tracking[dimKey];
        if (v) input.value = v;
      });
    })();

    // ── example-toggle: toggle aria-expanded + show/hide example-expand by example-key ──
    document.querySelectorAll('[data-phase1="example-toggle"]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var key = btn.dataset.exampleKey || btn.dataset.fieldIdx;
        var fieldKey = btn.dataset.fieldKey;
        var isActive = btn.getAttribute('aria-expanded') === 'true';
        var newState = !isActive;
        btn.setAttribute('aria-expanded', String(newState));
        btn.classList.toggle('is-active', newState);
        // rotate caret
        var caret = btn.querySelector('.toggle-caret');
        if (caret) caret.style.transform = newState ? 'rotate(180deg)' : '';
        // find expand by example-key (preferred) or field-idx (legacy)
        var expand = document.querySelector('.example-expand[data-example-key="' + key + '"]')
          || document.querySelector('.example-expand[data-field-idx="' + key + '"]');
        if (expand) {
          expand.setAttribute('aria-hidden', String(!newState));
          expand.style.display = newState ? '' : 'none';
          // lazy populate content
          if (newState) {
            var contentList = expand.querySelector('.example-list');
            if (contentList && contentList.dataset.populated !== '1') {
              var stepKey = AppState.circlesMode === 'drill'
                ? (AppState.circlesDrillStep || 'C1')
                : (['C1','I','R','C2','L','E','S'][AppState.circlesSimStep || 0] || 'C1');
              var dbKey = getFieldExampleKey(stepKey, fieldKey || key);
              var q = AppState.circlesSelectedQuestion || {};
              var md = (q.field_examples && q.field_examples[stepKey] && q.field_examples[stepKey][dbKey]) || '';
              // user 2026-05-04: S 步 tracking 4 維度 per-dim filter
              var trackingDim = btn.dataset.trackingDim;
              if (stepKey === 'S' && trackingDim && md) {
                var perDim = filterTrackingExampleByDim(md, trackingDim);
                md = perDim || md;
              }
              contentList.innerHTML = md ? markdownBulletsToHtml(md) : '<li>(此題尚無範例答案)</li>';
              contentList.dataset.populated = '1';
            }
          }
        }
      });
    });

    // ── example-close: collapse example-expand by example-key ──
    document.querySelectorAll('[data-phase1="example-close"]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var key = btn.dataset.exampleKey || btn.dataset.fieldIdx;
        var expand = document.querySelector('.example-expand[data-example-key="' + key + '"]')
          || document.querySelector('.example-expand[data-field-idx="' + key + '"]');
        if (expand) {
          expand.setAttribute('aria-hidden', 'true');
          expand.style.display = 'none';
        }
        var toggle = document.querySelector('[data-phase1="example-toggle"][data-example-key="' + key + '"]')
          || document.querySelector('[data-phase1="example-toggle"][data-field-idx="' + key + '"]');
        if (toggle) {
          toggle.setAttribute('aria-expanded', 'false');
          toggle.classList.remove('is-active');
          var caret = toggle.querySelector('.toggle-caret');
          if (caret) caret.style.transform = '';
        }
      });
    });

    // ── hint button: open Tier-1 modal with hardcoded text ──
    document.querySelectorAll('[data-phase1="hint"]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var stepKey = AppState.circlesMode === 'drill'
          ? (AppState.circlesDrillStep || 'C1')
          : (['C1','I','R','C2','L','E','S'][AppState.circlesSimStep || 0] || 'C1');
        var fieldKey = btn.dataset.fieldKey || btn.dataset.fieldIdx;
        // 若 fieldKey 是 idx (數字)，從 stepCfg.fields 找 key
        if (fieldKey && /^\d+$/.test(fieldKey)) {
          var cfg = CIRCLES_STEP_CONFIG[stepKey];
          if (cfg && cfg.fields && cfg.fields[parseInt(fieldKey, 10)]) {
            fieldKey = cfg.fields[parseInt(fieldKey, 10)].key;
          }
        }
        openHintModal(stepKey, fieldKey || '提示');
      });
    });

    // ── contenteditable input: debounce 200ms → update draft ──
    // 改 textarea → contenteditable 後改用 input event + textContent / innerHTML
    document.querySelectorAll('[data-phase1="textarea"]').forEach(function (el) {
      el.addEventListener('input', function () {
        triggerSaveCycle();
        if (_phase1CharDebounce) clearTimeout(_phase1CharDebounce);
        _phase1CharDebounce = setTimeout(function () {
          var idx = parseInt(el.dataset.fieldIdx, 10);
          var stepKey = AppState.circlesMode === 'drill'
            ? (AppState.circlesDrillStep || 'C1')
            : (['C1', 'I', 'R', 'C2', 'L', 'E', 'S'][AppState.circlesSimStep || 0] || 'C1');
          var cfg = CIRCLES_STEP_CONFIG[stepKey] || CIRCLES_STEP_CONFIG.C1;
          if (cfg && cfg.fields[idx]) {
            var fieldKey = cfg.fields[idx].key;
            if (!AppState.circlesFrameworkDraft) AppState.circlesFrameworkDraft = {};
            if (!AppState.circlesFrameworkDraft[stepKey]) AppState.circlesFrameworkDraft[stepKey] = {};
            // 存 innerHTML 保留 <strong>/<ul>/<li> 等格式
            AppState.circlesFrameworkDraft[stepKey][fieldKey] = el.innerHTML;
          }
          // Layer 1: update submit button disabled state in-place (no full re-render)
          var submitBtn = document.querySelector('[data-phase1="submit"]');
          if (submitBtn && !AppState.circlesLocked && !AppState.circlesStale) {
            var blocked = computePhase1MinLengthBlocked();
            submitBtn.disabled = blocked;
          }
        }, 200);
      });
    });

    // ── rt-tbtn: contenteditable-native via execCommand (B / list-bullets) ──
    // contenteditable 直接支援 document.execCommand — bold 變 <strong>，list 變 <ul><li>
    document.querySelectorAll('.rt-tbtn').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        var icon = btn.querySelector('i');
        if (!icon) return;
        var cls = icon.className;
        var rtField = btn.closest('.rt-field');
        var editor = rtField ? rtField.querySelector('.rt-textarea[contenteditable="true"]') : null;
        if (!editor) return;
        editor.focus();
        if (cls.indexOf('ph-text-b') >= 0) {
          document.execCommand('bold', false, null);
        } else if (cls.indexOf('ph-list-bullets') >= 0) {
          document.execCommand('insertUnorderedList', false, null);
        }
        // 觸發 input event → 同步 AppState debounce
        editor.dispatchEvent(new Event('input', { bubbles: true }));
      });
    });

    // ── nsm-rt-tbtn: NSM Step 2 contenteditable + Step 3 textarea toolbar ──
    // NSM Step 2 fields use contenteditable; Step 3 dims use <textarea>.
    // execCommand works for contenteditable (Step 2); for textarea (Step 3)
    // bold/indent are no-ops but the click is wired (not dead).
    document.querySelectorAll('.nsm-rt-tbtn').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        var icon = btn.querySelector('i');
        var rtField = btn.closest('.nsm-rt-field');
        if (!rtField) return;
        // contenteditable path (Step 2 nsm-rt-textarea div)
        var ceEditor = rtField.querySelector('[contenteditable="true"]');
        if (ceEditor) {
          ceEditor.focus();
          if (icon) {
            var cls = icon.className;
            if (cls.indexOf('ph-list-bullets') >= 0) document.execCommand('insertUnorderedList', false, null);
            else if (cls.indexOf('ph-text-indent') >= 0) document.execCommand('indent', false, null);
            else if (cls.indexOf('ph-text-outdent') >= 0) document.execCommand('outdent', false, null);
          }
          // bold: check <strong>B</strong> button (no icon)
          var strong = btn.querySelector('strong');
          if (strong) document.execCommand('bold', false, null);
          ceEditor.dispatchEvent(new Event('input', { bubbles: true }));
          return;
        }
        // textarea path (Step 3 dims) — focus only, no execCommand
        var textarea = rtField.querySelector('textarea');
        if (textarea) textarea.focus();
      });
    });

    // ── submit 下一步 ──
    var submitBtn = document.querySelector('[data-phase1="submit"]');
    if (submitBtn) {
      submitBtn.addEventListener('click', function () {
        var mode = AppState.circlesMode || 'simulation';
        if (mode === 'drill') {
          // drill: single step done → go to Phase 1.5 Gate
          submitFrameworkToGate();
        } else {
          // sim: advance to next step (if at last sim step, go Phase 1.5)
          var stepOrder = ['C1', 'I', 'R', 'C2', 'L', 'E', 'S'];
          var nextIdx = (AppState.circlesSimStep || 0) + 1;
          if (nextIdx >= stepOrder.length) {
            // all 7 steps done in Phase 1 — go to Phase 1.5
            submitFrameworkToGate();
          } else {
            AppState.circlesSimStep = nextIdx;
            render();
          }
        }
      });
    }

    // ── 上一步 back button (sim only, tablet+) ──
    var backBtn = document.querySelector('[data-phase1="back"]');
    if (backBtn) {
      backBtn.addEventListener('click', function () {
        var mode = AppState.circlesMode || 'simulation';
        if (mode === 'simulation') {
          var prevIdx = (AppState.circlesSimStep || 0) - 1;
          if (prevIdx < 0) {
            // back to home (deselect question)
            AppState.circlesSelectedQuestion = null;
            AppState.circlesSimStep = 0;
          } else {
            AppState.circlesSimStep = prevIdx;
          }
          render();
        }
      });
    }

    // ── L step: sol-add click — add 3rd solution card ──
    document.querySelectorAll('.sol-add').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (AppState.circlesPhase1Solutions.length < 3) {
          AppState.circlesPhase1Solutions.push({ name: '', mechanism: '' });
          render();
        }
      });
    });

    // ── L step: sol-card__remove click — remove 3rd solution card ──
    document.querySelectorAll('.sol-card__remove').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (AppState.circlesPhase1Solutions.length > 2) {
          AppState.circlesPhase1Solutions.pop();
          render();
        }
      });
    });

    // ── L step: sol-card name-input — persist to state ──
    document.querySelectorAll('.sol-card__name-input').forEach(function (input) {
      var idx = parseInt(input.dataset.solIdx || '0', 10);
      input.addEventListener('input', function (e) {
        triggerSaveCycle();
        if (AppState.circlesPhase1Solutions[idx] !== undefined) {
          AppState.circlesPhase1Solutions[idx].name = e.target.value;
        }
      });
    });

    // ── L step: sol-card textarea — persist mechanism to state (E step textareas skipped via guard) ──
    document.querySelectorAll('.sol-card .rt-textarea').forEach(function (ta) {
      // E step textareas 有 data-circles-e-sol-idx，跳過避免誤寫 L step state
      if (ta.hasAttribute('data-circles-e-sol-idx')) return;
      var idx = parseInt(ta.dataset.solIdx || '0', 10);
      ta.addEventListener('input', function (e) {
        triggerSaveCycle();
        if (AppState.circlesPhase1Solutions[idx] !== undefined) {
          AppState.circlesPhase1Solutions[idx].mechanism = e.target.innerHTML;
        }
      });
    });

    // ── S step: 3 main rt-textarea → AppState.circlesPhase1S ──
    document.querySelectorAll('[data-s-textarea]').forEach(function (ta) {
      ta.addEventListener('input', function (e) {
        triggerSaveCycle();
        var key = ta.dataset.sTextarea;
        if (!AppState.circlesPhase1S) return;
        // contenteditable: 用 innerHTML 保留 bold/list 格式
        var v = e.target.innerHTML;
        if (key === '推薦方案') AppState.circlesPhase1S.recommendation = v;
        else if (key === '選擇理由') AppState.circlesPhase1S.reasoning = v;
        else if (key === '北極星指標') AppState.circlesPhase1S.nsm = v;
      });
    });

    // ── S step: 4 tracking-card input → AppState.circlesPhase1S.tracking ──
    document.querySelectorAll('[data-s-tracking]').forEach(function (input) {
      input.addEventListener('input', function (e) {
        triggerSaveCycle();
        var dimKey = input.dataset.sTracking;
        if (!AppState.circlesPhase1S || !AppState.circlesPhase1S.tracking) return;
        AppState.circlesPhase1S.tracking[dimKey] = e.target.value;
      });
    });

    // ── E step: textarea input → AppState.circlesPhase1Evaluate (Plan B SB7) ──
    document.querySelectorAll('[data-circles-e-sol-idx]').forEach(function (el) {
      el.addEventListener('input', function () {
        triggerSaveCycle();
        var solIdx = parseInt(el.getAttribute('data-circles-e-sol-idx'), 10);
        var key = el.getAttribute('data-circles-e-field-key');
        if (!AppState.circlesPhase1Evaluate[solIdx]) {
          AppState.circlesPhase1Evaluate[solIdx] = { advantages: '', disadvantages: '', risks: '', metrics: '' };
        }
        AppState.circlesPhase1Evaluate[solIdx][key] = el.innerHTML;
      });
    });

    // ── qchip-toggle: click collapsed qchip → expand (Plan B SB6) ──
    document.querySelectorAll('[data-phase1="qchip-toggle"]').forEach(function (chip) {
      chip.addEventListener('click', function (e) {
        // 排除 collapse-btn 冒泡（雖然 collapse-btn 有 stopPropagation，雙保險）
        if (e.target.closest('[data-phase1="qchip-collapse"]')) return;
        AppState.circlesChipExpanded = !AppState.circlesChipExpanded;
        render();
      });
    });

    // ── qchip-collapse: collapse btn click → close panel ──
    document.querySelectorAll('[data-phase1="qchip-collapse"]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        AppState.circlesChipExpanded = false;
        render();
      });
    });
  }

  // ── bindCirclesGate (Plan B SB10 — mockup 04 gate actions) ──────────────
  function bindCirclesGate() {
    document.querySelectorAll('[data-gate-action]').forEach(function (el) {
      el.addEventListener('click', function () {
        var act = el.dataset.gateAction;
        if (act === 'proceed') {
          AppState.circlesPhase = 2;
          clearGateState();
          render();
        } else if (act === 'back') {
          AppState.circlesPhase = 1;
          clearGateState();
          render();
        } else if (act === 'retry') {
          submitFrameworkToGate();
        }
      });
    });
  }
  function clearGateState() {
    AppState.circlesGateResult = null;
    AppState.circlesGateLoading = false;
    AppState.circlesGateError = null;
  }

  async function submitFrameworkToGate() {
    var stepKey = AppState.circlesMode === 'drill'
      ? (AppState.circlesDrillStep || 'C1')
      : (['C1','I','R','C2','L','E','S'][AppState.circlesSimStep || 0] || 'C1');
    var draft = (AppState.circlesFrameworkDraft && AppState.circlesFrameworkDraft[stepKey]) || {};
    var hasContent = Object.values(draft).some(function (v) { return v && String(v).trim(); });
    if (!hasContent) {
      console.warn('[gate] empty draft — skipping submit');
      AppState.circlesPhase1EmptyHint = true;
      render();
      clearTimeout(emptyHintTimerId);
      emptyHintTimerId = setTimeout(function () { AppState.circlesPhase1EmptyHint = false; render(); }, EMPTY_HINT_VISIBLE_MS);
      return;
    }
    AppState.circlesPhase = 1.5;
    AppState.circlesGateLoading = true;
    AppState.circlesGateResult = null;
    AppState.circlesGateError = null;
    render();
    try {
      await ensureCirclesDraftSession();
    } catch (_) {}
    var sid = AppState.circlesSession && AppState.circlesSession.id;
    if (!sid) {
      AppState.circlesGateError = '無法建立 session，請重試';
      AppState.circlesGateLoading = false;
      render();
      return;
    }
    var path = (AppState.accessToken ? '/api/circles-sessions/' : '/api/guest-circles-sessions/') + sid + '/gate';
    try {
      var res = await window.apiFetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: stepKey, frameworkDraft: draft }),
      });
      if (!res.ok) {
        AppState.circlesGateError = 'GATE_API_ERROR';
        AppState.circlesGateLoading = false;
        render();
        return;
      }
      var result;
      try { result = await res.json(); } catch (_) { result = null; }
      if (!result || !result.items) {
        AppState.circlesGateError = 'GATE_PARSE_ERROR';
        AppState.circlesGateLoading = false;
        render();
        return;
      }
      AppState.circlesGateResult = result;
      AppState.circlesGateLoading = false;
      render();
    } catch (e) {
      // 401 → apiFetch throws SESSION_EXPIRED; multi-tab+401 banner already rendered by apiFetch
      if (e && e.code === 'SESSION_EXPIRED') {
        AppState.circlesGateLoading = false;
        render();
        return;
      }
      var gateErrCode = (e && (e.name === 'AbortError' || (typeof e.message === 'string' && e.message.toLowerCase().includes('timeout'))))
        ? 'GATE_TIMEOUT'
        : 'GATE_API_ERROR';
      AppState.circlesGateError = gateErrCode;
      AppState.circlesGateLoading = false;
      render();
    }
  }
  window.submitFrameworkToGate = submitFrameworkToGate;

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
        <div class="offcanvas-empty__sub">進行中與已完成的 CIRCLES、NSM 練習都會出現在這裡。</div>
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

    // active 變體：meta 加「· 草稿」或「· 進行中」後綴
    if (item.status === 'active') {
      if (item.mode === 'drill' || item.drill_step) {
        const stepMap = { C1: 'C 澄清', I: 'I 用戶洞察', R: 'R 重新定義', C2: 'C2 重新定義', L: 'L 解決方案', E: 'E 評估方案', S: 'S 量化策略' };
        const stepLabel = stepMap[item.drill_step] || item.drill_step || '步驟加練';
        metaLabel = 'CIRCLES · ' + stepLabel + ' · 草稿';
      } else if (item.mode === 'simulation') {
        metaLabel = 'CIRCLES · 完整 7 步 · 進行中';
      } else {
        metaLabel = 'NSM · 4 步 · 進行中';
      }
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
        scoreHtml = '<span class="offcanvas-item__score">' + score + ' 分</span>';
      }
    }

    // formatRelativeOrAbsolute — active sessions: 相對時間「N 分鐘前編輯」
    // completed/scored: 絕對時間 M/D 格式
    function formatRelativeOrAbsolute(item) {
      var dateStr = item.updated_at || item.created_at || '';
      if (!dateStr) return '';
      if (item.status === 'active') {
        var diff = Date.now() - new Date(dateStr).getTime();
        var sec = Math.floor(diff / 1000);
        var min = Math.floor(sec / 60);
        var hr  = Math.floor(min / 60);
        var day = Math.floor(hr / 24);
        if (sec < 60)  return '剛剛編輯';
        if (min < 60)  return min + ' 分鐘前編輯';
        if (hr  < 24)  return hr  + ' 小時前編輯';
        if (day < 7)   return day + ' 天前編輯';
        // ≥ 7 天 → 絕對時間
        return new Date(dateStr).toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' });
      }
      return new Date(dateStr).toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' });
    }

    const dateFormatted = formatRelativeOrAbsolute(item);

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
      maybeStartOnboarding();
      render();
    } catch (e) {
      if (e.code === 'SESSION_EXPIRED') return;
      AppState.historyLoading = false;
      AppState.historyError = e.message || 'LOAD_ERROR';
      render();
    }
  }

  // ── restoreCirclesPhase1FromSession: reverse-transform session → AppState (mockup 09 line 296) ──
  // Matches triggerSaveCycle() payload shape exactly (P1/P1S/P1L/P1E/framework/ts).
  function restoreCirclesPhase1FromSession(item) {
    // Question
    AppState.circlesSelectedQuestion = item.question_json || item.currentQuestion || null;
    // Session pointer
    AppState.circlesSession = item;
    // Mode + drill step
    AppState.circlesMode = item.mode === 'simulation' ? 'sim' : 'drill';
    AppState.circlesDrillStep = item.drill_step || 'C1';
    // Phase + sim step pointer
    // Issue 2b fix: always land on Phase 1 (safe landing for offcanvas restore).
    // If session was completed (current_phase 3/4), user can still navigate forward via
    // existing navigation buttons after landing — but we never auto-jump to eval result
    // on history click. This prevents incomplete sessions from landing on an empty eval
    // page (卡死). Completed sessions are still visible in offcanvas (not hidden).
    AppState.circlesPhase = 1;
    AppState.circlesSimStep = item.sim_step_index || 0;
    // Step drafts reverse-transform — match triggerSaveCycle payload shape
    var sd = item.step_drafts || {};
    AppState.circlesPhase1 = sd.P1 || null;
    AppState.circlesPhase1S = sd.P1S || null;
    AppState.circlesPhase1Solutions = sd.P1L || null;
    AppState.circlesPhase1Evaluate = sd.P1E || null;
    // Framework draft (contenteditable C/I/R/C2 fields source of truth)
    AppState.circlesFrameworkDraft = item.framework_draft || {};
    // R3: restore Phase 2/3/4 sub-state (conversation + step_scores)
    AppState.circlesConversation = item.conversation || [];
    AppState.circlesStepScores = item.step_scores || {};
    // localStorage cache merge — prefer newer ts OR fall back to local when the
    // backend session row carries no draft content (e.g. very first PATCH lost
    // to a race / transient network failure). Without this fallback the user's
    // typed-but-not-yet-synced work would be irrecoverably hidden.
    try {
      var qid = (AppState.circlesSelectedQuestion || {}).id;
      if (qid) {
        var raw = localStorage.getItem('pmdrill:circles:draft:' + qid);
        if (raw) {
          var local = JSON.parse(raw);
          var serverTs = sd.ts || new Date(item.updated_at || item.created_at || 0).getTime();
          var sdEmpty = !sd.P1 && !sd.P1S && !sd.P1L && !sd.P1E && !sd.framework;
          var fdEmpty = !item.framework_draft || Object.keys(item.framework_draft || {}).length === 0;
          var backendEmpty = sdEmpty && fdEmpty;
          var localFresher = local && local.ts && local.ts > serverTs;
          if (local && (localFresher || backendEmpty)) {
            if (local.P1) AppState.circlesPhase1 = local.P1;
            if (local.P1S) AppState.circlesPhase1S = local.P1S;
            if (Array.isArray(local.P1L) && local.P1L.length) AppState.circlesPhase1Solutions = local.P1L;
            if (local.P1E) AppState.circlesPhase1Evaluate = local.P1E;
            if (local.framework) AppState.circlesFrameworkDraft = local.framework;
          }
        }
      }
    } catch (_) {}
    // Switch view
    AppState.view = 'circles';
  }

  // ── loadCirclesSessionFromHistory: routes item to circles or nsm restore ──
  // R3-A: async + Option B (GET /:id) + AbortController + dedup
  var _circlesFetchAbort = null;
  var _circlesFetchInFlight = null; // session id currently fetching

  async function loadCirclesSessionFromHistory(item) {
    if (!item || !item.id) return;

    // NSM path — restore all fields needed by renderNSMStep* before render()
    var isNsm = !item.mode && !item.drill_step;
    if (isNsm) {
      AppState.offcanvasOpen = false;
      // Bug B fix: list endpoint omits user_nsm/user_breakdown/scores_json/coach_tree_json.
      // Seed with partial list data first so UI renders immediately, then fetch full session.
      AppState.nsmSession = item;
      AppState.nsmSelectedQuestion = item.question_json || null;
      // User-reported 2026-05-11: legacy sessions may have user_nsm stored as a string
      // (not the {nsm, explanation, businessLink} object). Coerce so form fields can populate.
      var rawNsm = item.user_nsm;
      if (typeof rawNsm === 'string') {
        AppState.nsmDefinition = { nsm: rawNsm, explanation: '', businessLink: '' };
      } else if (rawNsm && typeof rawNsm === 'object') {
        AppState.nsmDefinition = {
          nsm: rawNsm.nsm || '',
          explanation: rawNsm.explanation || '',
          businessLink: rawNsm.businessLink || '',
        };
      } else {
        AppState.nsmDefinition = { nsm: '', explanation: '', businessLink: '' };
      }
      AppState.nsmBreakdown = item.user_breakdown || { reach: '', depth: '', frequency: '', impact: '' };
      AppState.nsmEvalResult = item.scores_json || null;
      // Bug 1 fix (2026-05-11): smart routing per spec — restore lands at
      // the saved checkpoint inferred from session data presence.
      var _scored = item.scores_json && typeof item.scores_json === 'object'
        && Object.keys(item.scores_json).length > 0;
      var _hasBreakdown = item.user_breakdown
        && Object.values(item.user_breakdown).some(function (v) { return v && String(v).trim(); });
      var _hasNsm = item.user_nsm && item.user_nsm.nsm && String(item.user_nsm.nsm).trim();
      AppState.nsmStep = _scored ? 4 : (_hasBreakdown ? 3 : (_hasNsm ? 2 : 1));
      AppState.view = 'nsm';
      render();

      // Async: fetch full session to populate user_nsm + user_breakdown + coach_tree_json
      var nsmFullPath = (AppState.accessToken ? '/api/nsm-sessions/' : '/api/guest/nsm-sessions/') + item.id;
      window.apiFetch(nsmFullPath).then(function (res) {
        if (!res.ok) return;
        return res.json();
      }).then(function (full) {
        if (!full || !full.id) return;
        AppState.nsmSession = full;
        AppState.nsmSelectedQuestion = full.question_json || AppState.nsmSelectedQuestion;
        AppState.nsmDefinition = full.user_nsm || { nsm: '', explanation: '', businessLink: '' };
        AppState.nsmBreakdown = full.user_breakdown || { reach: '', depth: '', frequency: '', impact: '' };
        AppState.nsmEvalResult = full.scores_json || null;
        render();
      }).catch(function () {
        // fallback: partial list data already rendered — silent fail
      });
      return;
    }

    // CIRCLES path: dedup — already fetching same id
    if (_circlesFetchInFlight === item.id) return;
    // already in same form? no-op
    if (AppState.circlesSession && AppState.circlesSession.id === item.id && AppState.view === 'circles' && AppState.circlesPhase) return;

    // Cancel previous fetch if any
    if (_circlesFetchAbort) {
      try { _circlesFetchAbort.abort(); } catch (_) {}
    }
    _circlesFetchAbort = new AbortController();
    _circlesFetchInFlight = item.id;

    // Close offcanvas + show loading state
    AppState.offcanvasOpen = false;
    AppState.circlesSessionLoading = true;
    AppState.view = 'circles';
    render();

    // Fetch full session detail (Option B — REST detail endpoint pattern)
    var path = (AppState.accessToken ? '/api/circles-sessions/' : '/api/guest-circles-sessions/') + item.id;
    var fullItem = item; // fallback to list partial
    try {
      var res = await window.apiFetch(path, { signal: _circlesFetchAbort.signal });
      if (res.ok) {
        fullItem = await res.json();
      } else {
        console.warn('[loadCirclesSessionFromHistory] GET', path, 'returned', res.status, '— using partial list item');
      }
    } catch (e) {
      if (e && e.name === 'AbortError') {
        // user clicked another item — abort silently, do not restore
        _circlesFetchInFlight = null;
        return;
      }
      console.warn('[loadCirclesSessionFromHistory] fetch failed', e, '— using partial list item');
    }

    _circlesFetchInFlight = null;
    _circlesFetchAbort = null;
    AppState.circlesSessionLoading = false;

    restoreCirclesPhase1FromSession(fullItem);
    render();
  }
  // Expose for Playwright test access (Bug 1 TDD)
  window._loadCirclesSessionItem = loadCirclesSessionFromHistory;

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
          // route to correct endpoint based on session kind (mirror loadCirclesSessionFromHistory heuristic)
          const item = (AppState.historyList || []).find(function (i) { return String(i.id) === String(id); });
          const isNsm = item && !item.mode && !item.drill_step;
          AppState.historyList = AppState.historyList.filter(function (i) { return i.id !== id; });
          render();
          var path;
          if (isNsm) {
            path = AppState.accessToken ? '/api/nsm-sessions/' + id : '/api/guest/nsm-sessions/' + id;
          } else {
            path = AppState.accessToken ? '/api/circles-sessions/' + id : '/api/guest-circles-sessions/' + id;
          }
          window.apiFetch(path, { method: 'DELETE' }).catch(function () {});
        } else if (action === 'item') {
          // Guard: don't trigger if delete button was clicked (delete is nested inside item div)
          if (e.target.closest('[data-offcanvas="delete"]')) return;
          var id = el.dataset.id;
          var item = (AppState.historyList || []).find(function (i) { return String(i.id) === String(id); });
          if (!item) return;
          // Close offcanvas first
          AppState.offcanvasOpen = false;
          loadCirclesSessionFromHistory(item);
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

  // ── Plan D SB2 — Onboarding (mockup 10) ─────────────────────────────────

  // Step targets — selector / title / body / arrow direction
  var ONBOARDING_TARGETS = {
    1: { selector: '.mode-section', title: '選擇練習模式', body: '建議首次選「完整模擬」走完整流程，熟悉後再用「步驟加練」針對弱點刻意練習。', arrow: 'top' },
    2: { selector: '.type-tabs',    title: '選擇題型',     body: '三類題型各有特色：產品設計重發散、產品改進重診斷、產品策略重格局。', arrow: 'top' },
    3: { selector: '.qcard',        title: '看題目卡',     body: '每張卡片附帶業界場景，點開可預覽題目背景與分析框架。', arrow: 'top' },
    4: { selector: '.qcard.is-expanded, .qcard:first-child', title: '開始練習', body: '先讀題目說明再決定：合適就點「確認，開始練習」進入 Phase 1，不合適可上一步換題。', arrow: 'top' },
  };

  // Trigger: show onboarding only when historyList is loaded AND empty, no flag, home view
  function maybeStartOnboarding() {
    if (AppState.onboardingComplete) return;
    if (AppState.onboardingActive) return;
    // historyList === null means "not loaded yet" — wait until loaded to avoid false-positive
    if (AppState.historyList === null) return;
    var hasHistory = AppState.historyList.length > 0;
    if (hasHistory) return;
    if (AppState.view !== 'circles') return;
    if (AppState.circlesPhase !== 1) return;
    if (AppState.circlesSelectedQuestion) return;
    AppState.onboardingActive = true;
    AppState.onboardingStep = 0;
  }

  function renderOnbWelcome() {
    return '<div class="onb-welcome">'
      + '<div class="onb-welcome__icon"><i class="ph-fill ph-hand-waving"></i></div>'
      + '<div class="onb-welcome__title">歡迎來到 PM Drill</div>'
      + '<p class="onb-welcome__body">CIRCLES 是 PM 面試常用的七步框架。第一次使用？建議跟著引導跑一輪，5 分鐘內了解整個流程。</p>'
      + '<div class="onb-welcome__actions">'
      +   '<button class="btn btn--primary" data-onb-action="start">開始引導<i class="ph ph-arrow-right"></i></button>'
      +   '<button class="btn btn--ghost" data-onb-action="skip">直接自己選題</button>'
      + '</div></div>';
  }

  function renderOnboardingOverlay() {
    if (!AppState.onboardingActive) return '';
    var step = AppState.onboardingStep;
    if (step === 0) return '';   // welcome is inline, not overlay
    var t = ONBOARDING_TARGETS[step];
    if (!t) return '';
    var nextOrFinish = step < 4
      ? '<button class="onb-tooltip__next" data-onb-action="next">下一步<i class="ph ph-arrow-right"></i></button>'
      : '<button class="onb-tooltip__next" data-onb-action="finish">開始練習<i class="ph ph-check"></i></button>';
    return '<div class="onb-overlay">'
      +    '<div class="onb-tooltip onb-tooltip--' + t.arrow + '" data-onb-step="' + step + '">'
      +      '<div class="onb-tooltip__arrow onb-tooltip__arrow--' + t.arrow + '"></div>'
      +      '<div class="onb-tooltip__step">第 ' + step + ' 步 / 共 4 步</div>'
      +      '<div class="onb-tooltip__title">' + escHtml(t.title) + '</div>'
      +      '<p class="onb-tooltip__body">' + escHtml(t.body) + '</p>'
      +      '<div class="onb-tooltip__actions">'
      +        '<span class="onb-tooltip__skip" data-onb-action="skip">略過引導</span>'
      +        nextOrFinish
      +      '</div>'
      +    '</div>'
      + '</div>';
  }

  function applyOnboardingTargetClass() {
    document.querySelectorAll('.onb-targeted').forEach(function (el) { el.classList.remove('onb-targeted'); });
    if (!AppState.onboardingActive || AppState.onboardingStep === 0) return;
    var t = ONBOARDING_TARGETS[AppState.onboardingStep];
    if (!t) return;
    var el = document.querySelector(t.selector);
    if (el) el.classList.add('onb-targeted');
    positionOnboardingTooltip();
  }

  // Positions the .onb-tooltip near its spotlight target using getBoundingClientRect.
  // Mobile (<=480px): place tooltip below the target with a 16px gap, clamped to viewport.
  // Desktop/tablet: place tooltip to the right of the target; fall back to left if it would overflow.
  function positionOnboardingTooltip() {
    var tooltip = document.querySelector('.onb-tooltip');
    if (!tooltip) return;
    var t = ONBOARDING_TARGETS[AppState.onboardingStep];
    if (!t) return;
    var target = document.querySelector(t.selector);
    if (!target) return;

    var rect = target.getBoundingClientRect();
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    var tooltipW = 300;
    var tooltipH = tooltip.offsetHeight || 180;
    var gap = 16;
    var edgePad = 12;

    var top, left;

    if (vw <= 480) {
      // Mobile: position below target, arrow pointing up, left-aligned with target
      top = rect.bottom + gap;
      left = Math.max(edgePad, Math.min(rect.left, vw - tooltipW - edgePad));
      // If tooltip would overflow bottom, place above target
      if (top + tooltipH > vh - edgePad) {
        top = Math.max(edgePad, rect.top - tooltipH - gap);
      }
    } else {
      // Desktop/tablet: prefer right of target; fall back to left if overflow
      var rightStart = rect.right + gap;
      if (rightStart + tooltipW <= vw - edgePad) {
        left = rightStart;
      } else {
        left = Math.max(edgePad, rect.left - tooltipW - gap);
      }
      // Vertically align top of tooltip with top of target, clamped to viewport
      top = Math.max(edgePad, Math.min(rect.top, vh - tooltipH - edgePad));
    }

    tooltip.style.top = top + 'px';
    tooltip.style.left = left + 'px';
    tooltip.style.right = 'auto';
    tooltip.style.bottom = 'auto';
  }

  function bindOnboarding() {
    document.querySelectorAll('[data-onb-action]').forEach(function (el) {
      el.addEventListener('click', function (e) {
        e.stopPropagation();
        var act = el.dataset.onbAction;
        if (act === 'start') {
          AppState.onboardingStep = 1;
          render();
          applyOnboardingTargetClass();
        } else if (act === 'next') {
          AppState.onboardingStep++;
          render();
          applyOnboardingTargetClass();
        } else if (act === 'skip' || act === 'finish') {
          localStorage.setItem('circles_onboarding_done', '1');
          AppState.onboardingComplete = true;
          AppState.onboardingActive = false;
          AppState.onboardingStep = 0;
          document.querySelectorAll('.onb-targeted').forEach(function (el) { el.classList.remove('onb-targeted'); });
          render();
        }
      });
    });
    if (AppState.onboardingActive && AppState.onboardingStep > 0) {
      applyOnboardingTargetClass();
    }
    // Esc handler (one-shot bound per page lifecycle)
    if (!window._onbEscBound) {
      document.addEventListener('keydown', function escSkip(e) {
        if (e.key === 'Escape' && AppState.onboardingActive) {
          localStorage.setItem('circles_onboarding_done', '1');
          AppState.onboardingComplete = true;
          AppState.onboardingActive = false;
          AppState.onboardingStep = 0;
          document.querySelectorAll('.onb-targeted').forEach(function (el) { el.classList.remove('onb-targeted'); });
          render();
        }
      });
      window._onbEscBound = true;
    }
  }

  // ── Layer 1 Combo C: frontend minLength gate ──────────────────────────────
  // Prevents obvious garbage from reaching AI gate / evaluator.
  // Called at render time to compute disabled state + warn class.
  function fieldMinLengthOk(value, floor) {
    if (!floor || floor <= 0) return true;
    var v = String(value == null ? '' : value).replace(/<[^>]*>/g, '').trim();
    var nonWhitespace = v.replace(/\s/g, '');
    if (nonWhitespace.length < floor) return false;
    // reject single repeated character (e.g. "AAAA...")
    if (nonWhitespace.length >= 3 && new Set(nonWhitespace.split('')).size === 1) return false;
    return true;
  }

  function parseFloor(minMax) {
    if (!minMax || typeof minMax !== 'string') return 0;
    var m = minMax.match(/^(\d+)/);
    return m ? parseInt(m[1], 10) : 0;
  }

  // Returns true when any required Phase 1 C1/I/R/C2 field is below its minMax floor.
  // L/E/S steps rely on Layer 2 (prompt guard) — documented gap.
  function computePhase1MinLengthBlocked() {
    var stepKey = AppState.circlesMode === 'drill'
      ? AppState.circlesDrillStep
      : (['C1', 'I', 'R', 'C2', 'L', 'E', 'S'][AppState.circlesSimStep || 0] || 'C1');
    if (!stepKey) return false;
    var stepCfg = CIRCLES_STEP_CONFIG[stepKey];
    if (!stepCfg) return false;
    // Only enforce on 4-field standard steps (C1/I/R/C2); L/E/S have nested structures
    if (!stepCfg.fields || !stepCfg.fields.length || stepCfg.isSolMulti || stepCfg.isEstep || stepCfg.isSstep) return false;
    var draft = (AppState.circlesFrameworkDraft && AppState.circlesFrameworkDraft[stepKey]) || {};
    return stepCfg.fields.some(function (f) {
      var floor = parseFloor(f.minMax);
      return !fieldMinLengthOk(draft[f.key], floor);
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
