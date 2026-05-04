# SB9b Section E pixel-diff report

_Generated: 2026-05-04T09:00:54.852Z_

## SB9b Section E · Mobile · locked: 🟠 < 15% (state diff 預期)

- mockup 358×651 / production 360×1700 / padded 360×1700 / mismatched 33097px / **5.41%**
- mockup PNG: `tests/visual/diffs/sb9b/mobile-360-mockup.png`
- production PNG: `tests/visual/diffs/sb9b/mobile-360-production.png`
- diff PNG: `tests/visual/diffs/sb9b/mobile-360-diff.png`

## SB9b Section E · Tablet · stale: 🟡 < 5%

- mockup 766×720 / production 768×1700 / padded 768×1700 / mismatched 41345px / **3.17%**
- mockup PNG: `tests/visual/diffs/sb9b/tablet-768-mockup.png`
- production PNG: `tests/visual/diffs/sb9b/tablet-768-production.png`
- diff PNG: `tests/visual/diffs/sb9b/tablet-768-diff.png`

## SB9b Section E · Desktop · save-error: 🟡 < 5%

- mockup 1278×679 / production 1280×1700 / padded 1280×1700 / mismatched 54449px / **2.50%**
- mockup PNG: `tests/visual/diffs/sb9b/desktop-1280-mockup.png`
- production PNG: `tests/visual/diffs/sb9b/desktop-1280-production.png`
- diff PNG: `tests/visual/diffs/sb9b/desktop-1280-diff.png`

---

## 解讀說明

- 對應 mockup 03 Section E HTML line 1953-2106，CSS line 711-715 + 1981-1988 (rt-field disabled inline)
- 三 frame：Mobile locked / Tablet stale / Desktop save-error
- 預期 diff 來源：
  1. mockup hardcoded textarea content (e.g. line 1986 「聚焦免費版的廣告體驗...」) vs production empty placeholder
  2. mockup hardcoded company/題目 vs production 隨機題
  3. navbar 登入態：mockup desktop frame logged-in (email + sign-out) / production guest
  4. mockup 用 textarea / production 用 contenteditable div — 字體 metrics 些微差
- 0.5% 嚴格門檻只在「兩端同 state 同 content」可達；本 SB 結構契約驗證為主，diff% 範圍 3-15% 視為結構正確
