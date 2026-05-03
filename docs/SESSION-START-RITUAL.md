# Session Start Ritual — PM Drill / Path 2

> 每次 session 開始 SessionStart hook 自動把本檔注入 Claude context。
> Claude 開工 BEFORE 任何 tool call 必走這份。

---

## 0. Read 順序（30 秒）

1. `docs/PATH-2-HANDOFF.md` — 接手節點 + 已知 issue carry-forward + 加速策略
2. `CLAUDE.md` — 即時 state board（哪個 plan 跑到哪、哪些 commit）
3. `~/.claude/projects/.../memory/MEMORY.md` — auto-loaded，照其中 standing rules

開工第一句必說：「Ritual 走完。當前 state：[一句話]。下一步：[A 或 B]？」

---

## 1. Standing Rules（違反 = 退件）

1. **後端 / API / DB / OpenAI prompts / jest 100% 不動** — Path 2 鐵則
2. **17 mockups 是 CONTRACT-LOCKED 視覺契約**（spec §5.2）— implementer 必對 / auditor PNG pixel-diff 0.5%
3. **無紫色 / 無黃色 toast / 無 emoji** — icons 一律 Phosphor `ph-*`
4. **字型 system-ui stack** — grade letter A/B/C/D 例外 Instrument Serif italic
5. **mockup-as-Spec class names LOCKED** — 03+ 起既存 class 後續 copy 不准重定義
6. **Phase 1.5 Gate red item 一律擋路** — 無 simulation override
7. **設計前必先驗證現有產品** — Read production code + Playwright 截 PNG + 抓 constants
8. **CLAUDE.md 即時更新** — 每次重大事件即時 Edit（single source of truth）
9. **驗收必開 port** — 不只貼 PNG，要起 dev server 給 user 親跑 + SOP
10. **直推 main 不走 PR branch** — solo workflow，hook 擋就請 user 手動或改 settings

---

## 2. Ship/Commit 前必走（缺一 = bundle 重來）

每個 sub-bundle / plan / fix commit 前都要走：

- [ ] **TDD 紅綠** — 先寫紅燈 spec，watch fail，再寫 code，watch green（不能寫 code 前不寫 test）
- [ ] **jest log** — 不 regression，貼 pass/skip/total 數字
- [ ] **Playwright log × 多 viewport** — chromium + webkit，至少 mobile-360 / iPad / Desktop-1280
- [ ] **Read PNG × 3 viewport** — 每張 ≥ 1 句評論（Layer 6 eyeball walk，spec §0.5）
- [ ] **mockup ↔ production pixel-diff** — threshold 0.5%，引 report 路徑
- [ ] **iOS Safari 15-item 靜檢**（spec §0.2）— 任何 mobile UX 改動必走
- [ ] **eyeball walk doc** 寫到 `audit/eyeball-{name}.md`
- [ ] **live port 給 user 親跑 + SOP**

---

## 3. User 殺手鐧 3 問（隨時可打 — 任一答不出 = bundle 重做）

1. 「Read 過 PNG 沒？貼 viewport + 評論」
2. 「5 條 boundingBox invariant 數字」
3. 「mockup ↔ production pixel-diff 結果？引 report 路徑」

---

## 4. Anti-patterns（自動扣分）

- ❌ subagent 自己寫 spec 自己過 — 必須 director cold review，不能信 agent self-report
- ❌ 用「看起來對齊 / 大致一致」當判斷 — 視覺契約用 PNG 機械 diff
- ❌ test fixture 與 production schema 不符（曾踩過 `step_scores.S` 物件 vs number 漏 bug）
- ❌ 把 `[object Object]` 漏到 production
- ❌ 自動把 push origin main 改成 PR branch（user solo dev，問再改）
- ❌ 跳 brainstorming → writing-plans → subagent → verification 鏈條
- ❌ commit 前不跑 jest / Playwright / Read PNG 三件套
- ❌ 主動 `git reset --hard` / `git push --force` 沒問

---

## 5. Subagent dispatch 紀律

派 implementer subagent 必含：
- Mockup 路徑 + 對應 section anchor
- Plan 範圍清單（具體 task / 預期產出）
- 完工 criteria（jest 數字 / PW 數字 / Read PNG 證據 / eyeball walk doc）
- 「director 會 cold review，self-report 不算數」明說

派完不是放生 — agent DONE 後**必須 director 跑同樣驗證流程獨立確認**（cold review）。
