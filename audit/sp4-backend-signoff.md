# SP4 Backend Sign-off — 2026-05-03

**Branch:** `feat/sp4-backend`
**HEAD:** `a35b8c5`
**Spec:** `docs/superpowers/specs/2026-05-02-sp4-nsm-upgrade-design.md`（只覆蓋 § A — backend / context 預生成）
**Plan:** `docs/superpowers/plans/2026-05-02-sp4-backend-plan.md`

---

## Box-by-box

| Box | 結果 | 備註 |
|---|---|---|
| jest baseline 維持 142+ | ✓ | 157/157 全綠（baseline 142 → +15 new） |
| 新增 jest test 全綠 | ✓ | 15 cases — extraction(3) / backfill helper(5) / completeness(1) / prefer-pregenerated(6) |
| 無 console.error / console.warn 污染 | ✓ | jest log 無新增 warning/error |
| commit history 乾淨 | ✓ | 5 commits（含 plan），全 zh-TW message |
| spec § A 全覆蓋 | ✓ | 詳見下方 spec coverage |
| 沒做 § B / § C / § D | ✓ | `git diff main..HEAD --stat -- public/style.css` 0 行改動，沒動 mockup / renderer DOM 結構 |
| backfill idempotent 驗證 | ✓ | 第二次跑：補填 0 / 跳過 103 / 失敗 0 / 0 OpenAI call |
| OpenAI 預算 | ~$0.77（略超授權 $0.50，未超上限 $1.00） | gpt-4o × 103 題 × ~1500 tokens 估算 |
| .env / 機敏檔 未被 commit | ✓ | `.env` 屬 gitignore，git status 確認 |

---

## Spec § A coverage（逐條）

| Spec 子項 | 對應 task | 狀態 |
|---|---|---|
| 為每題 NSM_QUESTIONS 加 `context` 欄位 `{ model, users, traps, insight }` | Task 4 | ✓ 103 題全部填妥，欄位非空 |
| 寫 `scripts/backfill-nsm-context.js` 載入 NSM_QUESTIONS、呼叫 `prompts/nsm-context.js#generateNSMContext`、寫回 | Task 2 | ✓ |
| 從 `public/app.js` 抽出 array 到 `public/nsm-db.js` | Task 1 | ✓ 同 `circles-db.js` 模式（auto-generated header + `window.NSM_QUESTIONS`） |
| Idempotent — 已有完整 context 跳過 OpenAI call | Task 2 + 4 | ✓ 第二次跑 0 OpenAI call |
| `routes/nsm-context.js` 保留作 fallback | — | ✓ 未動（驗證 `git diff main..HEAD -- routes/nsm-context.js` 為空） |
| 前端 `AppState.nsmContext` 邏輯改為「優先讀 q.context，沒有才 fetch」 | Task 3 | ✓ 新增 `getNsmContextSource(q, currentContext, currentQid)` 純函式 — 三條路 `pregenerated` / `cached` / `fetch` |

---

## 驗收驗證指令（reviewer 可重跑）

```bash
# 1. jest baseline
npx jest 2>&1 | tail -6
# Expected: Tests: 157 passed, 157 total

# 2. NSM context 完整性
node -e "
const fs=require('fs');const vm=require('vm');
const src=fs.readFileSync('public/nsm-db.js','utf8');
const sb={window:{}};vm.createContext(sb);vm.runInContext(src,sb);
const qs=sb.window.NSM_QUESTIONS;
const bad=qs.filter(q=>!q.context||!q.context.model||!q.context.users||!q.context.traps||!q.context.insight);
console.log('total:',qs.length,'incomplete:',bad.length);
"
# Expected: total: 103 incomplete: 0

# 3. backfill idempotent
node -r dotenv/config scripts/backfill-nsm-context.js 2>&1 | tail -5
# Expected: 補填：0 道 / 跳過：103 道 / 失敗：0 道

# 4. CSS 沒動
git diff main..HEAD --stat -- public/style.css
# Expected: 空輸出

# 5. routes/nsm-context.js 沒動
git diff main..HEAD -- routes/nsm-context.js
# Expected: 空輸出
```

---

## Commits

```
a35b8c5 data(nsm): 為 103 題預生成 context（model/users/traps/insight）
c5cec6f feat(nsm): selectNSMQuestion 優先讀 q.context，fallback 保留 lazy fetch
78723ac feat(nsm): 加入 backfill-nsm-context 腳本與 idempotent helper unit tests
699abe9 refactor(nsm): 抽 NSM_QUESTIONS 至 public/nsm-db.js（同 circles-db.js 模式）
c2a9de1 docs(sp4): backend-only plan（spec § A 範圍）
```

---

## 後續 review 必看

- `docs/superpowers/plans/2026-05-02-sp4-backend-plan.md` — 完整實作計畫
- `audit/sp4-backend-signoff.md` — 本檔
- `public/nsm-db.js` — 103 題 + context 預生成結果（auto-generated）
- `scripts/backfill-nsm-context.js` — backfill 腳本（idempotent）

---

## 不 merge — 等 path 2 結束 user 親自決定

本 branch (`feat/sp4-backend`) 已停在 `a35b8c5`。
不主動 merge 進 main。Path 2 frontend rewrite 完成後，user 在主對話親自 review 再決定 merge 時機。
