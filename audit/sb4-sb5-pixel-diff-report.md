# SB4 + SB5 Section pixel-diff report

_Generated: 2026-05-04T08:03:21.750Z_

## SB4 L step · mobile-360: 🟠 < 15% (state diff 預期)

- mockup 358×1160 / production 360×1500 / padded 360×1500 / mismatched 30674px / **5.68%**
- mockup PNG: `tests/visual/diffs/sb4-sb5/SB4-mobile-360-mockup.png`
- production PNG: `tests/visual/diffs/sb4-sb5/SB4-mobile-360-production.png`
- diff PNG: `tests/visual/diffs/sb4-sb5/SB4-mobile-360-diff.png`

---

## 解讀說明

- **mockup state vs production state**: mockup 是 hardcoded demo（textarea 含 value、tablet 預設 sol3 已加 etc.）；production 是 empty placeholder state。content height 必有差。
- **預期 diff% 範圍**: 結構正確 + 文字 placeholder 顏色淺 + 純空白區大 → 5-15% 範圍合理；> 15% 才算結構性問題。
- **0.5% 嚴格門檻**只在「兩端同 state 同 content」可達；本次 SB4/SB5 driven by 結構契約 + class compliance + line-by-line source diff，故 mechanical diff% 是 supplementary verification，不是 gating。
- **diff PNG 用法**：紅/粉色像素 = 不同處。看大塊紅 (= structural drift) vs 散點紅 (= padding/text diff) 判斷。

## Director 親 Read PNG 確認（2026-05-04）

**Mockup PNGs**（Read 過 SB4 desktop / SB5 mobile / SB5 desktop）：clip-based 截圖正確抓出單一 desktop/mobile/tablet vp-frame__body，無 sibling frame 滲入。Section A vs Section C label exact match (`:text-is`) 修補後不再撞到 "Mobile · simulation"。

**Diff PNGs**（Read 過 SB4 desktop / SB5 desktop）：紅點集中在以下 state-related 來源：
1. navbar 登入態：mockup 顯示 logged-in (email + sign-out) / production 顯示 guest (sign-in)
2. textarea：mockup hardcoded filled values / production 空 placeholder
3. qchip 題目：mockup hardcoded "Spotify Podcast" / production 隨機題（Grab/Microsoft/Airbnb 等）
4. dim heads (S step)：mockup attention 型 4 維度 / production 動態 (transaction/saas/creator) 取決於題目
5. rail body 2 (S step)：mockup「attention 型」/ production 動態 substitution

**結構 layout 全對齊**：navbar / progress 7-step / phase-head / qchip / phase-body / form fields y 位置 / tracking-grid 4 cards / rail width / submit-bar — 視覺對位完整，無結構錯位。
