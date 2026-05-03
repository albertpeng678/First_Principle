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
      if (AppState.circlesPhase === 1 && AppState.circlesSelectedQuestion) {
        return renderCirclesPhase1();
      }
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

  // ── renderNavbar (per spec §2.10 + mockup 01 / 03 / 06 contract) ──────────
  // Actions rule:
  //   CIRCLES home guest:  mobile = nothing / tablet+ = sign-in        (mockup 01 line 803/894-896)
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
    const signInBtnHomeOnly = '<button class="navbar__icon-btn navbar__icon-btn--auth-only" data-nav="auth" aria-label="登入"><i class="ph ph-sign-in"></i></button>';
    const signOutBtn = '<button class="navbar__icon-btn" data-nav="logout" aria-label="登出"><i class="ph ph-sign-out"></i></button>';
    const emailSpan = `<span class="navbar__email">${escHtml(AppState.userEmail || '')}</span>`;

    let actions;
    if (AppState.accessToken) {
      actions = emailSpan + signOutBtn + (isCirclesHome ? '' : homeBtn);
    } else if (isCirclesHome) {
      actions = signInBtnHomeOnly; // CSS hides on mobile per mockup 01 line 803
    } else {
      actions = signInBtn + homeBtn; // deep view guest: both visible all viewports
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

  // ── CIRCLES_STEP_CONFIG (Plan B SB3 — mockup 03 + spec §3.1) ─────────────
  // C1 / I / R / C2 4 step × 4 field complete schema.
  // L / E / S deferred to SB4.
  var CIRCLES_STEP_CONFIG = {
    C1: {
      eyebrow: { sim: 'Phase 1 · 寫框架', drill: 'Phase 1 · 個別步驟練習' },
      title: 'C · 澄清情境',
      titleDrillSuffix: '（題目邊界 / 業務影響 / 假設）',
      progressLabel: '澄清',
      stepLetter: 'C',
      stepNum: '01',
      railTitle: '本步重點',
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
      titleDrillSuffix: '（分群 / 焦點 / 動機 / 排除）',
      progressLabel: '用戶',
      stepLetter: 'I',
      stepNum: '02',
      railTitle: '本步重點',
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
      titleDrillSuffix: '（功能性 / 情感性 / 社交性 / 核心痛點）',
      progressLabel: '需求',
      stepLetter: 'R',
      stepNum: '03',
      railTitle: '本步重點',
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
      titleDrillSuffix: '（取捨標準 / 優先 / 暫緩 / 理由）',
      progressLabel: '排序',
      stepLetter: 'C',
      stepNum: '04',
      railTitle: '本步重點',
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
  };

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
    // field 1 (idx===0) only: char-counter, field__meta hint suffix for drill desktop
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
    var toolbarHtml;
    if (idx === 0) {
      toolbarHtml = '<div class="rt-field__toolbar">'
        + '<button class="rt-tbtn"><i class="ph ph-text-b"></i></button>'
        + '<button class="rt-tbtn"><i class="ph ph-list-bullets"></i></button>'
        + '<button class="rt-tbtn"><i class="ph ph-text-indent"></i></button>'
        + '<button class="rt-tbtn rt-tbtn--outdent"><i class="ph ph-text-outdent"></i></button>'
        + '</div>';
    } else {
      toolbarHtml = '<div class="rt-field__toolbar">'
        + '<button class="rt-tbtn"><i class="ph ph-text-b"></i></button>'
        + '<button class="rt-tbtn"><i class="ph ph-list-bullets"></i></button>'
        + '</div>';
    }

    var metaSpan = minMax ? '<span>建議 ' + minMax + ' 字' + (idx === 0 && hint ? ' · ' + hint : '') + '</span>' : '';
    var counterSpan = idx === 0 ? '<span class="char-counter">0 / ' + max + '</span>' : '';
    var metaHtml = (metaSpan || counterSpan)
      ? '<div class="field__meta">' + metaSpan + counterSpan + '</div>'
      : '';

    return '<div class="field" data-field-key="' + escHtml(key) + '" data-field-idx="' + idx + '">'
      + '<div class="field__label-row">'
      + '<label class="field__label">' + escHtml(key) + '</label>'
      + '<div class="field__hint-row">'
      + '<button class="field__hint-link" data-phase1="hint" data-field-idx="' + idx + '"><i class="ph ph-lightbulb"></i>提示</button>'
      + '<button class="field-example-toggle" aria-expanded="false" data-phase1="example-toggle" data-field-idx="' + idx + '">'
      + '<i class="ph ph-quotes"></i>範例答案<i class="ph ph-caret-down toggle-caret"></i>'
      + '</button>'
      + '</div>'
      + '</div>'
      + '<div class="rt-field" data-field-idx="' + idx + '">'
      + toolbarHtml
      + '<textarea class="rt-textarea" rows="' + rows + '" placeholder="' + escHtml(placeholder) + '" data-phase1="textarea" data-field-idx="' + idx + '" data-max="' + max + '"></textarea>'
      + '</div>'
      + metaHtml
      + '<div class="example-expand" aria-hidden="true" data-field-idx="' + idx + '">'
      + '<div class="example-expand__head">'
      + '<div class="example-expand__title"><i class="ph ph-quotes"></i>範例答案</div>'
      + '<button class="example-expand__close" aria-label="收合" data-phase1="example-close" data-field-idx="' + idx + '"><i class="ph ph-x"></i></button>'
      + '</div>'
      + '<ul class="example-list"><li>（範例由題目資料提供）</li></ul>'
      + '</div>'
      + '</div>';
  }

  function renderRail(stepCfg) {
    // mockup 03 line 1197-1205 — desktop only aside.rail
    return '<aside class="rail">'
      + '<div class="rail__title">' + escHtml(stepCfg.railTitle) + '</div>'
      + '<p style="margin-bottom: var(--s-3); color: var(--c-ink); font-weight: 500;">' + escHtml(stepCfg.railIntro) + '</p>'
      + '<p style="line-height: 1.7;">' + escHtml(stepCfg.railBody) + '</p>'
      + '<hr style="border: 0; border-top: 1px solid var(--c-rule); margin: var(--s-4) 0;">'
      + '<div class="rail__title">' + escHtml(stepCfg.railTitle2 || '') + '</div>'
      + '<p style="line-height: 1.7;">' + escHtml(stepCfg.railBody2 || '') + '</p>'
      + '</aside>';
  }

  function renderCirclesPhase1() {
    // mockup 03 Section A line 794-1216 — sim mobile / sim tablet / drill desktop
    var q = AppState.circlesSelectedQuestion;
    var mode = AppState.circlesMode || 'simulation';
    var isDrill = mode === 'drill';
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

    // ── progress bar (sim only) ──
    var progressHtml = isDrill ? '' : renderProgressBar(stepKey);

    // ── phase-head (drill variant: .phase-head--drill) ──
    var eyebrow = isDrill ? stepCfg.eyebrow.drill : stepCfg.eyebrow.sim;
    var title = isDrill
      ? (stepCfg.title + stepCfg.titleDrillSuffix)
      : stepCfg.title;
    var stepNum = stepCfg.stepNum;
    // save-indicator
    var saveHtml = '<span class="save-indicator save-indicator--saved"><i class="ph ph-check"></i>已儲存</span>';
    // phase-head__meta: sim mobile = save only; sim tablet+ = save + 完整模擬 N/7步; drill = save + drill note
    // We render two spans and use CSS @media to swap:
    //   .phase-head__meta--mobile: only save-indicator
    //   .phase-head__meta--tablet: save + sep + 完整模擬 · N / 7 步
    //   .phase-head__meta--drill: save + sep + drill 模式 · 此步驟結束即完成
    // Since tablet shows extra info vs mobile, we render the full meta always
    // and use CSS to hide the sep+text on mobile via @media.
    var metaHtml;
    if (isDrill) {
      metaHtml = '<span class="phase-head__meta">'
        + '<span class="save-indicator save-indicator--saved"><i class="ph ph-check"></i>已儲存</span>'
        + '<span class="phase-head__meta-sep">·</span>'
        + 'drill 模式 · 此步驟結束即完成'
        + '</span>';
    } else {
      // sim: mobile shows save only; tablet+ shows save + sep + 完整模擬
      metaHtml = '<span class="phase-head__meta">'
        + '<span class="save-indicator save-indicator--saved"><i class="ph ph-check"></i>已儲存</span>'
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
    if (isDrill) {
      var diff = (q && q.difficulty) === 'high' ? '高' : (q && q.difficulty) === 'low' ? '低' : '中';
      var qType = (q && q.question_type) === 'improve' ? '改善題' : (q && q.question_type) === 'strategy' ? '策略題' : '設計題';
      companyDisplay += ' · ' + qType + ' · 難度 ' + diff;
    }
    var qTitle = (q && q.problem_statement) ? q.problem_statement : '';
    var qchipHtml = '<div class="qchip">'
      + '<span class="qchip__icon"><i class="ph ph-info"></i></span>'
      + '<div class="qchip__main">'
      + '<div class="qchip__company">' + escHtml(companyDisplay) + '</div>'
      + '<div class="qchip__title">' + escHtml(qTitle) + '</div>'
      + '</div>'
      + '<i class="ph ph-caret-down qchip__caret"></i>'
      + '</div>';

    // ── phase-body with 4 fields ──
    // desktop drill: phase-body--with-rail (grid) + aside.rail
    var phaseBodyClass = 'phase-body' + (isDrill ? ' phase-body--with-rail' : '');
    var fieldsHtml = stepCfg.fields.map(function (f, i) {
      return renderPhase1Field(f, i, isDrill);
    }).join('');
    var phaseBodyHtml = '<div class="' + phaseBodyClass + '">'
      + '<div>' + fieldsHtml + '</div>'
      + (isDrill ? renderRail(stepCfg) : '')
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

    return '<div data-view="circles" data-circles-phase="1">'
      + progressHtml
      + phaseHeadHtml
      + qchipHtml
      + phaseBodyHtml
      + submitBarHtml
      + '</div>';
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
    var qaOpen = AppState.circlesQaOpen !== false; // default open

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
    var modeSelectorHtml = '<div class="mode-selector">'
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
    if (AppState.view === 'circles'
        && AppState.circlesPhase === 1
        && AppState.circlesSelectedQuestion) {
      bindCirclesPhase1();
    }
  }

  // ── bindCirclesPhase1 (Plan B SB3 — mockup 03 Section A interactions) ────
  var _phase1CharDebounce = null;

  function bindCirclesPhase1() {
    // ── example-toggle: toggle aria-expanded + show/hide example-expand ──
    document.querySelectorAll('[data-phase1="example-toggle"]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var idx = btn.dataset.fieldIdx;
        var isActive = btn.getAttribute('aria-expanded') === 'true';
        var newState = !isActive;
        btn.setAttribute('aria-expanded', String(newState));
        btn.classList.toggle('is-active', newState);
        // rotate caret
        var caret = btn.querySelector('.toggle-caret');
        if (caret) caret.style.transform = newState ? 'rotate(180deg)' : '';
        // show/hide example-expand
        var expand = document.querySelector('.example-expand[data-field-idx="' + idx + '"]');
        if (expand) {
          expand.setAttribute('aria-hidden', String(!newState));
          expand.style.display = newState ? '' : 'none';
        }
      });
    });

    // ── example-close: collapse example-expand ──
    document.querySelectorAll('[data-phase1="example-close"]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var idx = btn.dataset.fieldIdx;
        var expand = document.querySelector('.example-expand[data-field-idx="' + idx + '"]');
        if (expand) {
          expand.setAttribute('aria-hidden', 'true');
          expand.style.display = 'none';
        }
        var toggle = document.querySelector('[data-phase1="example-toggle"][data-field-idx="' + idx + '"]');
        if (toggle) {
          toggle.setAttribute('aria-expanded', 'false');
          toggle.classList.remove('is-active');
          var caret = toggle.querySelector('.toggle-caret');
          if (caret) caret.style.transform = '';
        }
      });
    });

    // ── hint button: SB5 will implement full overlay; here just noop / console ──
    document.querySelectorAll('[data-phase1="hint"]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        // SB5 will implement hint overlay; placeholder
      });
    });

    // ── textarea input: debounce 200ms → update char-counter + draft ──
    document.querySelectorAll('[data-phase1="textarea"]').forEach(function (ta) {
      ta.addEventListener('input', function () {
        if (_phase1CharDebounce) clearTimeout(_phase1CharDebounce);
        _phase1CharDebounce = setTimeout(function () {
          var idx = parseInt(ta.dataset.fieldIdx, 10);
          var max = parseInt(ta.dataset.max, 10) || 200;
          var val = ta.value;
          // update char-counter for field 0 only (mockup shows counter only on field 1)
          if (idx === 0) {
            var counter = ta.closest('.field') && ta.closest('.field').querySelector('.char-counter');
            if (counter) counter.textContent = val.length + ' / ' + max;
          }
          // update draft in AppState
          var stepKey = AppState.circlesMode === 'drill'
            ? (AppState.circlesDrillStep || 'C1')
            : (['C1', 'I', 'R', 'C2', 'L', 'E', 'S'][AppState.circlesSimStep || 0] || 'C1');
          var cfg = CIRCLES_STEP_CONFIG[stepKey] || CIRCLES_STEP_CONFIG.C1;
          if (cfg && cfg.fields[idx]) {
            var fieldKey = cfg.fields[idx].key;
            if (!AppState.circlesFrameworkDraft) AppState.circlesFrameworkDraft = {};
            if (!AppState.circlesFrameworkDraft[stepKey]) AppState.circlesFrameworkDraft[stepKey] = {};
            AppState.circlesFrameworkDraft[stepKey][fieldKey] = val;
          }
        }, 200);
      });
    });

    // ── rt-tbtn: rich text toolbar actions ──
    document.querySelectorAll('.rt-tbtn').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        var icon = btn.querySelector('i');
        if (!icon) return;
        var cls = icon.className;
        if (cls.indexOf('ph-text-b') >= 0) document.execCommand('bold', false, null);
        else if (cls.indexOf('ph-list-bullets') >= 0) document.execCommand('insertUnorderedList', false, null);
        else if (cls.indexOf('ph-text-indent') >= 0) document.execCommand('indent', false, null);
        else if (cls.indexOf('ph-text-outdent') >= 0) document.execCommand('outdent', false, null);
      });
    });

    // ── submit 下一步 ──
    var submitBtn = document.querySelector('[data-phase1="submit"]');
    if (submitBtn) {
      submitBtn.addEventListener('click', function () {
        var mode = AppState.circlesMode || 'simulation';
        if (mode === 'drill') {
          // drill: single step done → go to Phase 1.5 Gate (stub for now)
          // SB4 will implement Gate; for now stub phase transition
          AppState.circlesPhase = 1.5;
          render();
        } else {
          // sim: advance to next step (if at last sim step, go Phase 1.5)
          var stepOrder = ['C1', 'I', 'R', 'C2', 'L', 'E', 'S'];
          var nextIdx = (AppState.circlesSimStep || 0) + 1;
          if (nextIdx >= stepOrder.length) {
            // all 7 steps done in Phase 1 — go to Phase 1.5
            AppState.circlesPhase = 1.5;
          } else {
            AppState.circlesSimStep = nextIdx;
          }
          render();
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
