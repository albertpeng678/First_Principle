# Wave 1.5 qchip Refactor — Eyeball Walk (2026-05-22)

> Director cold-Read 18 PNGs + Opus strict UI/UX reviewer 平行驗證。
> RITUAL §6 #4 (cold-Read PNG) + §6 #5 (mockup pixel-diff) + §7.4 (2-stage review) 全走完。

## Refactor 一句話

`public/app.js` 6 個 qchip inline render block 抽成 `renderQchipShell` 共用 helper（Plan A 結構性、byte-perfect equivalent、0 視覺變動）。

## Surface map（驗 6 caller × 3 vp = 18 PNG）

| Caller line | Surface | Icon (mockup canonical) | Wrapper |
|---|---|---|---|
| 822  | Phase 2 chat | `ph-bookmark-simple` (mockup 05) | button |
| 4665 | Phase 1 L step sol-multi | `ph-info` (mockup 03) | div |
| 4775 | Phase 1 E step sol-multi | `ph-info` (mockup 03) | div |
| 4944 | Phase 1 S step multi-input | `ph-info` (mockup 03) | div |
| 5126 | Phase 1.5 gate result | `ph-bookmark-simple` (mockup 04) + short/long spans | div |
| 5448 | Phase 1 drill modifier | `ph-info` (mockup 03) | div |

NSM Step 4 `qchip__pill` (line 2475) **不 migrate** — 不同 shape，mockup 14 LOCKED。

## Director cold-Read 18 PNGs

`audit/qchip-refactor-2026-05-21/{01..06}-{Mobile-360,iPad,Desktop-1280}.png`

| PNG | Icon | Company text | Caret | Verdict |
|---|---|---|---|---|
| 01-phase2 Mobile | bookmark | Spotify · Spotify Podcast (short) | down | ✓ |
| 01-phase2 iPad | bookmark | Spotify · Spotify Podcast（Drill · 設計題） | down | ✓ |
| 01-phase2 Desktop | bookmark | Spotify · Spotify Podcast（Drill mode · 設計題） | down | ✓ |
| 02-Lstep Mobile | info | Spotify · Spotify Podcast | down | ✓ |
| 02-Lstep iPad | info | Spotify · Spotify Podcast | down | ✓ |
| 02-Lstep Desktop | info | Spotify · Spotify Podcast · 設計題 · 難度 中 | down | ✓ |
| 03-Estep Mobile | info | Spotify · Spotify Podcast | down | ✓ |
| 03-Estep iPad | info | Spotify · Spotify Podcast | down | ✓ |
| 03-Estep Desktop | info | Spotify · Spotify Podcast · 設計題 · 難度 中 | down | ✓ |
| 04-Sstep Mobile | info | Spotify · Spotify Podcast | down | ✓ |
| 04-Sstep iPad | info | Spotify · Spotify Podcast | down | ✓ |
| 04-Sstep Desktop | info | Spotify · Spotify Podcast · 設計題 · 難度 中 | down | ✓ |
| 05-gate Mobile | bookmark | Spotify · Spotify Podcast (short) | down | ✓ short span @media correct |
| 05-gate iPad | bookmark | Spotify · Spotify Podcast（Drill mode） | down | ✓ long span correct |
| 05-gate Desktop | bookmark | Spotify · Spotify Podcast（Drill mode） | down | ✓ long span + 審核耗時 meta |
| 06-drill Mobile | info | Spotify · Spotify Podcast · 設計題 · 難度 中 | down | ✓ drill mobile shows suffix per `isDrill || isDesktop` |
| 06-drill iPad | info | Spotify · Spotify Podcast · 設計題 · 難度 中 | down | ✓ + drill 模式 meta |
| 06-drill Desktop | info | Spotify · Spotify Podcast · 設計題 · 難度 中 | down | ✓ + rail |

**18/18 PNG 全綠**。CSS `.qchip__company-short/-long` @media 在 5126 caller (Phase 1.5 gate) 正常工作。drill `isDrill || isDesktop` 行為保留正確。

## Mockup contract 對照

| Mockup | Quote | Production caller | Verdict |
|---|---|---|---|
| `mockups/.../03-phase-1-form.html:1245` | `<div class="qchip"><span class="qchip__icon"><i class="ph ph-info">` | 4 個 Phase 1 caller 都傳 `iconName: 'ph-info'` | ✓ |
| `mockups/.../04-phase-1-5-gate.html:576-1388` | 9 × `ph-bookmark-simple` | 5126 傳 `iconName: 'ph-bookmark-simple'` | ✓ |
| `mockups/.../05-phase-2-chat.html:711-1904` | 18 × `ph-bookmark-simple` | 822 傳 `iconName: 'ph-bookmark-simple'` | ✓ |

## 機械等價測試

`/tmp/verify-qchip-equivalence.js`：7 cases (5 caller × 1 + 2 expanded 變體)，**7/7 PASS byte-perfect**。Helper output 與 pre-refactor inline 字串完全一致。

## Cross-spec stash 對照

`git stash push public/app.js` + `npx playwright test phase2-ui-fix.spec.js`：pre-refactor baseline 跑出 **同 5 fail** (qchip-panel selector 已 L23 `f2a3d58` 刪除)。確認非 regression，logged 進 tracker §3 P2-Q-2。

## RITUAL ship checklist 對照

| § | 項目 | 證據 |
|---|---|---|
| §1 e2e supreme | wave1-b6 5× serial × 3 project | 跑中 (background bfijdmn3p) |
| §2 IL-1 root cause | 共用 helper 真消除 6 處重複 | ✓ |
| §2 IL-2 verification | 18 PNG cold-Read + 7/7 mechanical + reviewer cross-check | ✓ |
| §2 IL-3 TDD | 機械等價 test 寫在 fix 前 | ✓ |
| §3.13 visual regression | 18 PNG 對 mockup 03/04/05 canonical | ✓ |
| §3.11 cross-vp | 3 project × Mobile-360/iPad/Desktop-1280 | ✓ (capture) + 5× e2e 跑中 |
| §6 #4 cold-Read PNG | Director + Opus reviewer 都 Read 全 18 PNG | ✓ |
| §6 #5 mockup pixel-diff | reviewer 引 mockup line + 數圖示出現次數 | ✓ |
| §6 #6 iOS 15-item | HTML-string refactor only，no JS event/timing change | ⏭ N/A |
| §7.4 2-stage review | spec-compliance 內含於機械 test + UI/UX reviewer | ✓ |
| §8 anti-patterns | byte-equivalent + mockup contract preserved | ✓ |
| §9 殺手鐧 5 問 | 全有對應證據 | ✓ |

## Reviewer verdict

Opus strict reviewer：**APPROVED**（3 nit 全非 blocker）：

- **N1**: Phase 2 caret-right pre-existing drift (mockup 05 line 716 vs production ph-caret-down) — `tracker §3 P2-Q-1` logged
- **N2**: Helper comment 寫「5 inline」應為「6 inline」 — **本 commit 已修**
- **N3**: companyHtml safety contract not documented in helper JSDoc — **本 commit 已修**

## 觀察到的副作用 / 風險

無。Helper output 機械等價、6 個 caller dataAttr + iconName 正確、click handler `[data-phase2="qchip"]` (line 7061) 與 `[data-phase1="qchip-toggle"]` (line 7796) 對應 selector 不變、NSM Step 4 carve-out 文件化、CSS `.qchip__company-short/-long` @media 正常。
