# UAT SOP — Phase A + B Final Ship Readiness

**Date:** 2026-05-10
**Tester:** user (director real-device walk)
**Dev server:** http://localhost:4000 (live)
**Scope:** All Phase A + B production wire changes

---

## Pre-flight

開瀏覽器到 http://localhost:4000，登入 user account（or guest mode）。

---

## Path A — CIRCLES drill (Phase 2 typewriter)

**Test B2 typewriter:**

1. Home → 選一題 CIRCLES → 進 Phase 1 → 填 4 fields → 提交審核 → Gate pass → 進 Phase 2 chat
2. **觀察 chat:** 教練第一輪開場 bubble 應該 char-by-char 出現（不是整段瞬間 pop）
3. **觀察 cursor:** 文字尾應有 navy 細直線 `▍` 1Hz 閃爍；done 後 cursor 消失
4. **打一個問題給被訪談者** → 等被訪談者回應，再等教練點評 → 兩個 bubble 都應 char-by-char
5. **觀察速度:** 30-40 chars/sec；不能太快（瞬出）也不能太慢（卡頓）
6. **iOS 滑順度:** 同時往上滾動 chat history → 滾動 fps 不能掉（≥60fps target）
7. **驗 conversation persistence:** 按「← 上一步」回 Phase 1 → 再「下一步 →」回 Phase 2 → 對話 history 應全保留

**Pass criteria:** 字流暢逐字出現 / cursor 閃 / 滾動不卡 / 對話不掉

---

## Path B — NSM trainer (Step 4 qchip + Step 2/3 lock + Step 3 hint)

**Test B1 Step 4 qchip:**

1. Home tab nav → 點 NSM → Step 1 選 question → Step 2 填 3 fields → Step 3 填 4-dim → Step 3 Gate pass → Step 4 報告
2. **觀察 Step 4 頂部:** 應有 navy `[NSM]` pill + 題目情境 text（mockup 14 §A LOCKED contract）
3. 切 4 tabs（總覽 / 對比 / 亮點 / 完成）qchip 都應持續顯示

**Test B5 Step 3 dynamic hint:**

1. 從 Step 4 按「← 上一步」回 Step 3
2. 4 個 dim cards 每個都應有「💡 提示」button + 「99 範例答案」button + `查看數據提示`（既有）
3. **點任一個「提示」button** → modal 應彈出，loading state 1-2 秒，AI 回應 hint
4. **觀察:** modal 內容 markdown bullet 格式 / 字數 ≤ 320 / 不主動給範例答案
5. close modal → focus return to button

**Test B3+B4 Step 2/3 lock state:**

1. 仍在 Step 3，看 form 是否進入 lock state（因為 Step 3 已評分過）
2. **驗 banner:** 頂部 grey banner 顯「⊕ 已評分完成 — 內容鎖定，可繼續查看提示與範例」+ check-circle icon
3. **驗 form fields:** 4 個 textareas 應 grey background + readonly cursor + 不能編輯
4. **驗 submit-bar:** 沒有原「送出評分」button；改顯「← 上一步」+「查看評分結果 →」navy
5. **驗 hint+example 仍可用:** 點任一「💡 提示」+「99 範例答案」應正常 open（UNIVERSAL standing rule）
6. **點「查看評分結果 →」** → 應跳到 Step 4 報告
7. **回 Step 2** → 同樣驗 lock state（banner / 3 fields readonly / submit-bar variant / hint+example 可用）

---

## Path C — 整合 regression sanity check

**Test 跨 phase 切換:**

1. Phase 2 chat 中途按 navbar tab 切 NSM → 應正確 reset NSM 狀態（不殘留 chat）
2. NSM Step 2 中途切 CIRCLES → 應正確 resume Phase 2 chat 進度
3. 重新整理 page → 進度應正確 resume

**Test offcanvas history:**

1. 打開 offcanvas history drawer（漢堡 button）→ 應看到 sessions list
2. 切換 sessions → 對應狀態 load 正確（drill_step 預設 fix 已 ship）

---

## iOS Safari 真機抽驗（Layer 7）

如有 iPhone：

1. 接同 Wi-Fi → 開 http://[mac-ip]:4000（或 localhost.run tunnel）
2. 走 Path A + B + C
3. **重點驗 3 個 yellow item** (per `audit/ios-safari-static-review-phase-b-2026-05-10.md`):
   - **#11 Touch target ≥ 44px:** B3「查看評分結果」+ B5「提示」button 點擊區域夠大
   - **#14 60fps:** B2 typewriter streaming 時滾 chat 不掉幀（Safari Devtools Performance）
   - **#15 Layout thrash:** iPhone-SE (oldest device) typewriter 時 paint 時間 ≤16ms

---

## Pass / Fail Verdict

回報格式：
- ✅ Path A B2 typewriter: <observation>
- ✅ Path B B1 qchip: <observation>
- ✅ Path B B3+B4 lock state: <observation>
- ✅ Path B B5 dynamic hint: <observation>
- ✅ Path C integration: <observation>
- ✅/🟡 iOS Safari touch + perf: <observation>

任一 🔴 → 回報 director 處理；🟡 → 看 trade-off 是否 acceptable；全 ✅ → READY TO SHIP。

---

## Dev server reset

UAT 完成後若要 stop server:
```bash
lsof -i :4000 | awk 'NR==2 {print $2}' | xargs kill
```
