# Path 2 — Plan B SB5 · S 步 3+4 tracking 實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development。
>
> **嚴格鐵則：** mockup 03 Section C（line 1469-1758）為視覺契約。implementer 必對著做；任何 drift = bundle 重做。

**Goal：** CIRCLES Phase 1 S 步 (sim 7/7) 實作——3 main rt-fields（推薦方案 / 選擇理由 / 北極星指標）+ tracking-section + 4 tracking-card + 動態 dim labels per product type。CTA 顯「完成 Phase 1」。

**Mockup：** `docs/superpowers/specs/mockups/2026-05-02-frontend-rewrite/03-phase-1-form.html` Section C (line 1469-1758)

**Mockup CSS：** line 609-664（tracking-section / tracking-grid / tracking-card / tracking-card__num italic serif / tracking-card__head / tracking-card__sub / tracking-card input）

---

## 0. Pre-flight

- [ ] Read mockup line 1469-1758 + line 609-664（tracking-* CSS）
- [ ] Read `public/app.js` line 260-708（CIRCLES_STEP_CONFIG / renderCirclesPhase1 / renderPhase1Field / renderRail / renderCirclesPhase1Lstep / renderSolCard）
- [ ] Confirm existing `nsmGuessProductType(q)` (line 1289-1295) reusable
- [ ] LOCKED class set 同 SB4 + 加入 SB4 新增 `.sol-card / .sol-add` 也視為 LOCKED

---

## Mockup CSS（implementer 必整段 copy 不准 redefine — 對應 mockup line 609-664）

```css
/* S step — tracking 4-dim grid */
.tracking-section {
  margin-top: var(--s-7);
  padding-top: var(--s-6);
  border-top: 1px solid var(--c-rule);
}
.tracking-section__head {
  display: flex;
  align-items: center;
  gap: var(--s-3);
  font-size: var(--t-h3);
  color: var(--c-navy);
  font-weight: 600;
  margin-bottom: var(--s-2);
}
.tracking-section__head::before { content: ''; width: 24px; height: 2px; background: var(--c-navy); flex: 0 0 auto; }
.tracking-section__sub { font-size: var(--t-meta); color: var(--c-ink-3); margin-bottom: var(--s-5); }
.tracking-grid {
  display: flex;
  flex-direction: column;
  gap: var(--s-3);
}
.tracking-card {
  padding: var(--s-4) var(--s-5);
  background: var(--c-card);
  border: 1px solid var(--c-rule);
  border-radius: var(--r-input);
  display: grid;
  grid-template-columns: 36px 1fr;
  gap: var(--s-3);
  align-items: start;
}
.tracking-card__num {
  font-family: var(--font-serif);
  font-style: italic;
  font-size: 22px;
  line-height: 1;
  color: var(--c-navy);
  grid-row: 1 / span 3;
}
.tracking-card__head {
  font-size: var(--t-body-sm);
  font-weight: 600;
  color: var(--c-ink);
  margin-bottom: var(--s-1);
}
.tracking-card__sub { font-size: var(--t-cap); color: var(--c-ink-3); margin-bottom: var(--s-3); }
.tracking-card input {
  width: 100%;
  padding: var(--s-2) var(--s-3);
  background: var(--c-card);
  border: 1px solid var(--c-rule-bold);
  border-radius: var(--r-input);
  font-size: var(--t-body-sm);
  color: var(--c-ink);
}
```

**注意 token：**
- `--font-serif` — 必確認 production style.css 有定義；若無，用 `'Instrument Serif', serif`（grade letter 既有 stack）

---

## 動態 label per product type（master-spec §2.5 + production NSM_DIMENSION_CONFIGS）

```js
TRACKING_DIM_CONFIG = {
  attention:   { reach: '觸及廣度', depth: '互動深度', frequency: '習慣頻率', impact: '留存驅力' },
  transaction: { reach: '供給廣度', depth: '需求深度', frequency: '匹配效率', impact: '復購留存' },
  creator:     { reach: '創造廣度', depth: '成果品質', frequency: '採用廣度', impact: '商業轉化' },
  saas:        { reach: '啟用廣度', depth: '席次深度', frequency: '黏著頻率', impact: '擴張信號' },
};
```

`nsmGuessProductType(q)` 已存在（line 1289-1295）— 返回 `attention | transaction | creator | saas`。

---

## Mockup 03 Section C 結構（簡述 — implementer 對 mockup line 1469-1758 細跑）

### 共通結構（mobile/tablet/desktop 三 viewport 都有）
- progress：6 done（C/I/R/C/L/E）+ 1 active（S 總結）
- phase-head__num=07, eyebrow=「Phase 1 · 寫框架（最後一步）」
- phase-head__title:
   - mobile/tablet: `S · 總結推薦`
   - desktop: `S · 總結推薦（含 NSM 與 4 追蹤維度）`
- 3 main rt-fields（field 結構同 SB3 renderPhase1Field but rows 不同）：
   1. 推薦方案 — rows=2，placeholder「推薦哪個方案 + 一句話總判斷」
   2. 選擇理由 — rows=3，placeholder「引用 E 結論的 3 個面向 / 對比放棄方案 / 回應最大缺點」
   3. 北極星指標 — rows=2，placeholder「NSM 定義含行為門檻 / 為什麼能反映成效」

### tracking-section（4 tracking-card grid）
- head「追蹤指標 · 4 個維度」+ ::before navy 24px bar
- sub「分別說明北極星指標的 reach / depth / frequency / impact。本題（{type 中文} / {industry}）label 自動切換為對應產業術語。」
- 4 tracking-card（reach/depth/frequency/impact）每張：
  - num「01」-「04」（italic serif 22px navy）
  - head「{type-mapped 中文}（{en}）」
  - field__hint-row（提示 + 範例答案 toggle）— inline 嵌在 head 同行
  - sub「{範例 sub line — 由 mockup hardcoded 暫用 attention default}」
  - input placeholder「例：MAU ≥ 1.2M」(or value if filled)

### CTA（重要）
- mockup line 1755-1758 注解：「**完成 Phase 1：**S 是最後一步 → CTA 改顯「完成 Phase 1」（不是「下一步」）— 暗示用戶接下來會跳 Phase 1.5 gate。」
- submit-bar 右 primary btn 文案改為「完成 Phase 1」+ icon `ph-arrow-right`（或保留 arrow-right，重點是文案）

### viewport 差異
- mobile: navbar list+brand+home / 無 tabs / phase-head__meta only save / no 上一步
- tablet: 加 tabs / phase-head__meta + 完整模擬 7/7 / 上一步 ghost
- desktop: 加 email + sign-out + home / qchip__company suffix `· 設計題 · 難度 中` / phase-head__title suffix `（含 NSM 與 4 追蹤維度）` / phase-body--with-rail + aside.rail（S 步重點 / NSM + 4 維度追蹤 / 產業類型動態 label 說明）

---

## Task list

### Task 1: AppState `circlesPhase1S` schema

```js
circlesPhase1S: {
  recommendation: '',
  reasoning: '',
  nsm: '',
  tracking: { reach: '', depth: '', frequency: '', impact: '' },
},
```

### Task 2: 紅燈 spec — `tests/visual/phase1-s-step.spec.js`

至少 6 條：
- `default tracking labels = attention type`
- `phase-head__num=07 + S progress active`
- `tracking-grid renders 4 .tracking-card with __num 01-04`
- `desktop CTA reads「完成 Phase 1」`
- `desktop rail renders S 步重點`
- `tracking-card head 動態 — saas 題切換為「啟用廣度」`（手動 stub q.industry=saas keyword 觸發 nsmGuessProductType）

### Task 3: CSS — copy mockup line 609-664 整段

無 viewport-conditional CSS（mobile/tablet/desktop 共用 tracking-grid flex column 1-col；desktop 由 phase-body--with-rail 處理外層）。

### Task 4: CIRCLES_STEP_CONFIG.E + S entry + render branch

`E` entry：先用 isSolMulti=true（後續 SB6 改 per-sol nested 4-field）— **本 SB 不實作 E**，只新增 stepCfg 結構保 progress 渲染正確；E 點進去暫顯 placeholder「E 步功能即將上線」。

`S` entry：包含 isSstep=true 標記 + 3 fields config + tracking dim labels。

```js
S: {
  eyebrow: { sim: 'Phase 1 · 寫框架（最後一步）', drill: 'Phase 1 · 個別步驟練習' },
  title: 'S · 總結推薦',
  titleSimDesktopSuffix: '（含 NSM 與 4 追蹤維度）',
  progressLabel: '總結',
  stepLetter: 'S',
  stepNum: '07',
  isSstep: true,
  cta: '完成 Phase 1',
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
    // 沿用 mockup attention default sub line（其他 type sub 留 SB6 補完）
    attention: {
      reach: '每月至少播放 1 首歌的 MAU 數',
      depth: '每 session 平均聆聽時長（分鐘）',
      frequency: '每週使用 ≥ 3 天的用戶佔比',
      impact: '擁有 ≥ 5 首收藏歌曲的 30 日留存率',
    },
    // 其他 type 暫用 attention default — implementer 不必補
  },
  railTitle: 'S 步重點',
  railIntro: '總結推薦 + NSM + 4 維度追蹤',
  railBody: '推薦方案要可操作，NSM 必須含「行為門檻 + 為什麼能反映成效」。4 維度排除虛榮指標。',
  railTitle2: '產業類型動態 label',
  railBody2: '本題自動歸類為「{type 中文}」— 4 維度 label 是上面那組。若題目改為其他類型，label 會切換對應術語（master-spec §2.5）。',
},
```

### Task 5: render branch + helpers

在 `renderCirclesPhase1()` 加：
```js
if (stepCfg.isSstep) return renderCirclesPhase1Sstep(q, stepKey, stepCfg, currentStepNum);
```

新加 `renderCirclesPhase1Sstep`：
- progress / phase-head（含 desktop suffix）/ qchip（含 desktop · 設計題 · 難度 中）
- phase-body 內：3 main fields（reuse `renderPhase1Field` — but field idx 對應 toolbar 規範可能需要 override 為「全 1 button」per mockup line 1493/1504/1515 mobile 的 toolbar 只一個 ph-text-b — 實際上實作只用 sb3 既有 2 button 即可，mockup 只是示意，視為 mockup error tolerated；OR 加 `singleToolbar: true` flag for S step, render 1 button only）
- tracking-section（heading + sub with dynamic type substitution + 4 tracking-card grid）
- tracking-card 各張：num「01」-「04」 + tracking-card__head（dim 中文 + en in parens）+ inline hint-row + sub line + input
- desktop rail（railTitle/railIntro/railBody/railTitle2/railBody2 with `{type 中文}` substitution）
- submit-bar：右 primary btn 文案=「完成 Phase 1」icon=ph-arrow-right；左 ghost「上一步」(sim only)

### Task 6: bind handlers

- 3 main textarea input → `AppState.circlesPhase1S.recommendation/reasoning/nsm`
- 4 tracking-card input → `AppState.circlesPhase1S.tracking[reach|depth|frequency|impact]`
- submit btn (`data-phase1="submit"` already wired in SB3) — 不額外處理（既有 submit handler 處理 next phase 路由）

### Task 7: 跑綠燈

- `npm test` — jest 必為 157
- `npx playwright test tests/visual/phase1-s-step.spec.js --project=chromium` 全綠
- `npx playwright test tests/visual/phase1-s-step.spec.js --project=webkit` 全綠
- regression check: `circles-home.spec.js + phase1-form.spec.js + phase1-l-step.spec.js` chromium 不 regression
- 截圖 mobile-360 / iPad / Desktop-1280 三張存 `/tmp/sb5-{vp}.png`

### Task 8: Commit

`feat(plan-b-sb5): S step 3 main + 4 tracking (mockup 03 Section C) — tracking-section + 動態 type label + CTA「完成 Phase 1」`

---

## Cold Review (opus director)

R1-R5 同 SB4 模式。重點對：
- tracking-card head：dim-zh + (dim-en) 格式
- tracking-card num：italic serif 22px navy ✓
- desktop rail：產業類型動態 label 段含「{type 中文}」實際 substitute（如 attention → 注意力型）
- CTA「完成 Phase 1」非「下一步」
- desktop phase-head__title suffix「（含 NSM 與 4 追蹤維度）」
