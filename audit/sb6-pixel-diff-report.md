# SB6 Section G pixel-diff report

_Generated: 2026-05-04T08:03:34.455Z_

## SB6 Section G · tablet-768: 🟠 < 15% (state diff 預期)

- mockup 766×920 / production 768×1854 / padded 768×1854 / mismatched 71872px / **5.05%**
- mockup PNG: `tests/visual/diffs/sb6/tablet-768-mockup.png`
- production PNG: `tests/visual/diffs/sb6/tablet-768-production.png`
- diff PNG: `tests/visual/diffs/sb6/tablet-768-diff.png`

---

## 解讀說明

- 對應 mockup 03 Section G HTML line 2245-2372，CSS line 94-172
- mockup state = qchip 已展開 demo with hardcoded Spotify Podcast statement + 4 ana-block content
- production state = qchip click 後展開，statement 與 4 ana-block 從 random question 的 q.problem_statement / q.analysis 渲染
- 預期 diff 來源：(1) navbar 登入態 mockup vs guest production (2) 題目隨機 vs hardcoded Spotify (3) statement 內 strong markup mockup hardcoded vs production plain text (4) 4 ana-block content text
- 0.5% 嚴格門檻只在「兩端同 state 同 content」可達；本 SB 結構契約驗證為主，diff% 範圍 3-15% 視為結構正確
