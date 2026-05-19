# SOP — Wave 1B-b UAT (Bug A + Bug B + Wave 1B-a #2)

> **For user 親跑驗收 per RITUAL Standing Rule #9「驗收必開 port」**
> Date: 2026-05-17 PM Taipei
> 3 fix staged, commit pending user signoff

---

## §0 開 dev server

```bash
cd /Users/albertpeng/Desktop/claude_project/First_Principle
npm run dev  # 起 :4000
```

開瀏覽器：
- 桌機: http://localhost:4000
- 手機（同網段）: http://<your-mac-ip>:4000

登入：用你自己的帳號（不要用 `e2e@first-principle.test`）

---

## §1 Bug A UAT — NSM 切題不清舊答案

### Steps
1. 進入 NSM Step 1（北極星指標訓練）
2. 點選任何一題卡片（例如 WeWork）
3. 點「開始練習」進 Step 2
4. 在「北極星指標 (NSM)」/「定義說明」/「與業務目標連結」三欄位**隨便輸入文字**（例如「測試 1」）
5. 點左下「上一步」返回 Step 1
6. 點**不同**的題目卡片（例如 Netflix）
7. 點「開始練習」進 Step 2

### Expected
- **新題的三個欄位應該全空**（沒有剛剛輸入的「測試 1」殘留）

### 如果還是有殘留
- 回我「Bug A 不對」+ 截圖
- 我會 `git restore public/app.js` 砍掉 Bug A 區段

---

## §2 Bug B UAT — NSM dim card 提示按鈕位置

### Steps
1. 進入 NSM Step 3（完成 Step 2 後到 Step 3，或直接點訪問已建立 session 的 Step 3）
2. 看「觸及廣度」/「席次深度」/「使用頻率」三張 dim card

### Expected
- 每張卡片**上方**：左邊是 dim label（「觸及廣度」），右邊**同一行**並排「💡 提示  99 範例答案 ▼」按鈕（右對齊）
- desc 文字（「有多少用戶...」）在 label row **下方**一行
- textarea body 在最底

### 如果還是按鈕獨占一行
- 回「Bug B 不對」+ 截圖
- 我會 `git restore public/app.js public/style.css` 砍掉 Bug B 區段

---

## §3 Wave 1B-a #2 UAT — CIRCLES Phase 2 評分失敗顯示

### Steps（複雜，可選擇跳過 — 已有 e2e 自動驗）
1. 進入任一 CIRCLES 題目走完 Phase 1 + 1.5 gate 過關 → 進 Phase 2 對話練習
2. 在 Phase 2 結尾按「送出結論」
3. （需要伺服器側 503 觸發 — 不易 manual reproduce）

### Expected
- 若評分服務 503 / timeout / parse error / 401，畫面應該顯示「評分服務暫時不可用」error UI + 重試按鈕，不是靜默回到 Phase 2

### Manual verify alternative
- 跑 e2e: `npx playwright test --config tests/e2e/playwright.config.js circles-phase2-evaluator-error-shown --reporter=list`
- 應 6/6 PASS（3 vp × 2 AC）

---

## §4 RWD 全裝置驗收

### Mobile 360 (iPhone SE-like)
1. Chrome DevTools → Device Mode → iPhone SE
2. 走 §1 Bug A + §2 Bug B
3. 應該都正常

### Tablet 768 (iPad)
1. Chrome DevTools → iPad
2. 走 §1 + §2

### Desktop 1280
1. 桌機原生
2. 走 §1 + §2

---

## §5 iOS Safari 真機（如果手邊有 iPhone）

1. iPhone 連 mac 同 wifi
2. 開 http://<mac-ip>:4000
3. 走 §1 + §2

特別注意（iOS Safari 15-item per Master Spec §0.2）：
- 切題後欄位 reset 是否同步（無 cache stale）
- dim card hint button tap 是否流暢無 300ms delay
- 上一步返回是否流暢無 sticky bar 蓋住

---

## §6 通過 = 回我「對」

- 「**對**」= 我 commit batch + push origin/main + 更新 tracker §5
- 「**全對但 Wave #2 不接受 Pitfall 11 bootApp stub**」= 我先 commit Bug A + Bug B，Wave #2 退回讓 sonnet 修 bootApp 後再 commit
- 「**X 不對**」+ 描述 = 我 `git restore` 砍掉 X 區段，重派修
- 「**全部 reject 重做**」= `git restore` 全部砍，重 plan

---

## §7 Cross-references

- Eyeball walk: `audit/eyeball-wave1b-b.md`
- 2-stage reviewer reports: pending (3 background agents 跑中)
- Spec headers: 3 specs Director 親 Read 驗 skill citations ✓
- Tracker: §1 NEW-Bug-A / §3 NEW-Bug-B / §3 C-T1 F-CT1.2
