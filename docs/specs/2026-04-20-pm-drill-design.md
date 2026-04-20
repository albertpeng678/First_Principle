# PM Drill 第一性原理訓練器 — 設計文件

**日期：** 2026-04-20  
**版本：** v1.0  
**基礎規格：** PM_DRILL_PLAN_V3.md

---

## 產品定位

供 PM 日常練習「第一性原理拆解 issue」的互動工具。完全免費，無功能鎖定。  
核心流程：出題 → 對話式追問引導 → 即時回饋 → 視覺化評分報告 + 練習回顧表匯出。

支援兩種模式：
- **訪客模式**：無需帳號，sessionId 存 localStorage，7 天過期
- **登入模式**：Supabase Auth，練習記錄永久儲存，支援中途離開繼續

---

## 技術選型

| 層次 | 選擇 |
|------|------|
| 後端 | Node.js (Express) |
| 資料庫 + 認證 | Supabase (PostgreSQL + Auth) |
| AI | OpenAI API (gpt-4o) |
| 前端 | 單頁 HTML + Vanilla JS（無框架） |
| 部署 | Railway |

---

## 整體架構

### 後端檔案結構

```
pm-drill/
├── server.js
├── package.json
├── .env / .env.example
├── .gitignore
├── db/
│   ├── client.js          # Supabase service role client（唯一初始化點）
│   └── schema.sql
├── middleware/
│   ├── auth.js            # 驗證 Supabase JWT
│   └── guest.js           # 驗證 X-Guest-ID header
├── routes/
│   ├── sessions.js        # 登入用戶 CRUD
│   ├── guest-sessions.js  # 訪客 session
│   └── migrate.js         # guest → user 資料遷移
├── prompts/
│   ├── issue-generator.js
│   ├── coach.js
│   └── evaluator.js
└── public/
    ├── index.html         # 單頁殼層（僅結構 + script 掛載）
    ├── app.js             # AppState + render() + 所有 View 邏輯
    └── style.css          # 雙主題 CSS custom properties
```

### 前端架構模式

View-Renderer 單頁架構：AppState 驅動單一 `render()` 函式，狀態變化時重新渲染對應 View。

```javascript
const AppState = {
  mode: 'loading',        // 'loading' | 'guest' | 'auth'
  accessToken: null,      // Supabase JWT
  guestId: null,          // localStorage UUID
  user: null,
  currentSession: null,   // 當前練習完整資料
  isStreaming: false,
  theme: 'dark',          // 'dark' | 'light'，存 localStorage
  view: 'home',           // 'home'|'practice'|'report'|'history'|'login'|'register'
};
```

---

## UI/UX 設計

### 色彩系統

| CSS Variable | 深色值 | 淺色值 |
|-------------|--------|--------|
| `--bg-primary` | `#0f1117` | `#ffffff` |
| `--bg-surface` | `#1a1d27` | `#f5f5f5` |
| `--text-primary` | `#e8eaf0` | `#1a1d27` |
| `--accent` | `#6c63ff` | `#5a52e0` |
| `--success` | `#4caf7d` | `#2e7d52` |
| `--warning` | `#f0a04b` | `#d4821a` |

主題切換：`document.documentElement.dataset.theme = 'light'/'dark'`，偏好存 `localStorage.theme`。

### 頁面清單

#### Home View
- 難度選擇卡片（入門 / 進階 / 困難）
- 右上角：登入/登出按鈕 + 主題切換 icon
- 訪客直接點選難度即可開始

#### Login / Register View
- 極簡表單，email + password
- Tab 切換「登入」/「註冊」

#### Practice View
- **頂部**：4 步驟進度條（重構問題 → 深度追問 → 提交定義 → 完成）
- **中間**：聊天氣泡區
  - 學員訊息：右側，紫色（`--accent`）背景
  - AI 回覆：左側，灰色背景，內部結構：
    ```
    【被訪談者】
    （口語回答）
    ──────────
    【教練點評】
    （2-3 句評語）
    ```
- **底部**：輸入框 + 送出按鈕 + 串流中顯示 typing 動畫

#### Report View
1. SVG 雷達圖（五維度：roleClarity / taskBreakpoint / workaround / lossQuantification / definitionQuality）
2. 五維度明細卡片（did / missed / tip 各一行）
3. 亮點摘要（bestMove / mainTrap / summary）
4. **練習回顧表**（見下方詳細說明）
5. 匯出按鈕（PDF / PNG）

#### History View（登入用戶）
- 總分折線圖（SVG，橫軸時間，縱軸分數）
- Session 列表（點擊展開，可跳回完整 Report View）

---

## 練習回顧表設計

### 目的

讓學員對照每輪表現與理想拆解方向，理解自己的思維缺口。

### 表格結構

| 輪次 | 學員提問 | 本輪預期拆解重點 | 被訪談者回答 | 教練點評 |
|------|---------|----------------|-------------|---------|
| 第 1 輪 | 學員的問題文字 | AI 評分時補全 | 被訪談者回答 | 教練即時點評 |
| 第 N 輪 | ... | ... | ... | ... |

### 「本輪預期拆解重點」來源

Evaluator 在最終評分時，同步對每一輪標注「這一輪理想上應該挖到什麼」，存入 `scores_json.turnAnalysis[]`。不改動 coach 串流邏輯。

Evaluator 輸出新增欄位：
```json
{
  "scores": { ... },
  "totalScore": 0-100,
  "highlights": { ... },
  "turnAnalysis": [
    {
      "turn": 1,
      "idealFocus": "這輪應該聚焦挖掘的面向（一句話）"
    }
  ]
}
```

### 匯出

- **PDF**：`window.print()` + 專屬 `@media print` CSS，隱藏非報告元素
- **PNG**：`html2canvas`（從 CDN 載入），截取報告容器 DOM 存圖

---

## 資料流

### 核心練習流程

```
選難度 → POST /api/(guest/)sessions
  → DB 建立 session，回傳 issueText, source, industry

輸入訊息 → POST /api/(guest/)sessions/:id/chat
  → SSE 串流 AI 回覆 → 串流結束後 DB 更新 conversation + turn_count

提交最終定義 → POST /api/(guest/)sessions/:id/submit
  → OpenAI 評分（含 turnAnalysis）→ DB 儲存 scores_json
  → 前端跳至 Report View
```

### Session 恢復

- 每次 chat 成功後：`localStorage.setItem('lastSessionId', id)`
- 頁面載入時：若有 `lastSessionId` 且 status 為 `in_progress`，彈出「繼續上次練習？」

### 訪客資料遷移

訪客登入或註冊成功後，前端自動靜默呼叫 `POST /api/migrate-guest`，將 localStorage 中的 guestId 對應的所有 session 遷移至帳號。無需用戶操作，無任何提示或彈窗。遷移完成後清除 localStorage 的 guestId。

---

## 錯誤處理

| 情境 | 處理方式 |
|------|---------|
| OpenAI 呼叫失敗 | Evaluator 重試 3 次；Coach 串流中斷回傳 `event: error` |
| Supabase JWT 過期 | `onAuthStateChange` 自動刷新，每次請求取最新 token |
| 訪客 guestId 遺失 | 重新生成新 guestId，舊 session 無法恢復（設計限制） |
| 對話歷史過長 | 只保留最近 8 輪送 OpenAI，DB 保留完整記錄 |
| 串流中途斷線 | 顯示「連線中斷，請重試」，保留已輸出文字 |
| 提交時評分失敗 | 顯示 inline 錯誤，保留輸入，可重試 |
| PNG 截圖失敗 | 降級為 PDF 列印，不阻斷流程 |

---

## 安全原則

- `SUPABASE_SERVICE_ROLE_KEY` 只存後端 `.env`，絕不出現在 `public/` 下任何檔案
- 前端只用 `SUPABASE_ANON_KEY`，受 RLS 保護
- 所有資料庫操作一律透過 `db/client.js`，不在 routes 直接初始化 client

---

## 驗收標準

| 項目 | 驗收方式 |
|------|---------|
| 後端 middleware | curl 測試：無 token → 401，有效 token → 通過，無效 guestId → 400 |
| Prompt 模組 | 連續產生 5 題格式穩定；coach 雙角色正確；evaluator 五維度有差異 |
| 完整流程（curl）| 建立 session → 3 輪 chat → submit → 確認 DB 有資料 |
| 前端主題切換 | 深色/淺色切換，localStorage 持久化 |
| 練習回顧表 | 每輪資料正確對應，turnAnalysis 有內容 |
| 匯出 PDF | `window.print()` 產出乾淨報告頁 |
| 匯出 PNG | `html2canvas` 截圖成功，失敗時降級 PDF |
| 手機瀏覽器 | 跑完完整流程不破版 |
