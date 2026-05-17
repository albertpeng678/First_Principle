# M3 — nsm-step2 Section C context-card 補插 (2026-05-17)

## §1 Insertion Site Line References

三個 viewport 的插入點（均在 `<div class="nsm-body">` 開標後、`<div class="nsm-step3-banner">` 前）：

| Viewport | nsm-context-card 起始行 | nsm-step3-banner 行 |
|---|---|---|
| Mobile 360 | ~1694 | ~1725 (插入後) |
| Tablet 768 | ~1814 | ~1845 (插入後) |
| Desktop 1280 | ~1923 | ~1954 (插入後) |

## §2 Content Map (4 blocks — Datadog DevOps SaaS)

| Block | icon | head | body 摘要 |
|---|---|---|---|
| 1 | ph-buildings | 商業模式 | 按主機數與 Log 量計費；真正部署監控 + 接收警報才感受平台價值 |
| 2 | ph-user | 使用者 | DevOps / SRE 團隊；跨多服務監控基礎設施與應用層健康度 |
| 3 | ph-warning + --trap | 常見陷阱 | 登入次數 / dashboard 開啟次數只反映用戶來過，無法證明用到核心監控與警報功能 |
| 4 | ph-lightbulb | 破題切入 | 整合進日常 DevOps 工作流；NSM 應反映「監控部署 + 接收警報」行為 |

## §3 Visual Contract Preservation

- 結構完全 mirror Section B `.nsm-context-card` — 同 wrapper / 同 expand-label / 同 ana grid / 同 collapse-btn
- type badge 改為 `nsm-context-card__type--saas`（primary blue），與 Section C saas 型一致
- 全部三個 viewport 均展開（expand-toggle 顯示「收合」/ expand div 直接可見），同 Section B「三 viewport 全展開」規格
- 無 emoji；icon 全部 Phosphor ph-*
- `nsm-context-card__ana-block--trap` class 保留於「常見陷阱」block，維持 warn 色系樣式

## §4 驗證數字

- `nsm-context-card__ana-block` count before: 28
- `nsm-context-card__ana-block` count after: 40 (+12 = 4 blocks × 3 vp)
- 新增 Datadog context-card 位置：Section C mobile (line ~1694) / tablet (line ~1814) / desktop (line ~1923)
- 舊 Section B / Section A 內容完全未觸動
