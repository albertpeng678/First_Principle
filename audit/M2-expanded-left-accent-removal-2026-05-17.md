# M2-expanded — Left Accent Removal Audit
**Date:** 2026-05-17
**Scope:** Pure subtractive CSS — remove all navy `border-left` accent rules + `.nsm-dim__coach` block + coachQ chip render

---

## §1 — 7 CSS navy border-left rules cleaned (`public/style.css`)

| # | Selector | Before (line ref) | Change |
|---|---|---|---|
| 1 | `.nsm-field__example` | ~1546: `border-left: 2px solid var(--c-navy);` | Removed; `border-radius` changed to full `var(--r-input)` |
| 2 | `.nsm-dim__head` | ~1806: `border-left: 4px solid var(--c-navy);` | Removed |
| 3 | `.nsm-dim__hint` | ~1851: `border-left: 2px solid var(--c-navy);` | Removed; `border-radius` changed to full `var(--r-input)` |
| 4 | `.bubble--coach` | ~1976: `border-left: 2px solid var(--c-navy);` | Removed; comment updated |
| 5 | `.dim-row__coach-version` | ~2431: `border-left: 3px solid var(--c-navy);` | Removed; `border-radius` changed to full `var(--r-input)` |
| 6 | `.coach-reasoning` | ~2580: `border-left: 3px solid var(--c-navy);` | Removed; `border-radius` changed to full `var(--r-input)` |
| 7 | `.nsm-coach-detail` | ~3042: `border-left: 3px solid var(--c-navy);` | Removed |
| 8 | `.nsm-compare-card--coach` | ~2990: `border-left-color: var(--c-navy);` | Changed to `var(--c-ink-3)` (matches `--yours` variant) |

Note: item 8 is `border-left-color` (modifier), caught by the same grep pattern. Changed to neutral ink-3 to match peer `--yours` card.

---

## §2 — `.nsm-dim__coach` block + render line removed

### CSS (`public/style.css`)
- Removed `.nsm-dim__coach { ... }` block (was lines 1823-1833)
- Removed `.nsm-dim__coach i { ... }` companion rule (was line 1834)

### app.js (`public/app.js`)
- Removed line ~1703:
  ```
  '<div class="nsm-dim__coach"><i class="ph ph-chat-dots"></i>' + escHtml(dim.coachQ) + '</div>'
  ```
- `dim.coachQ` data property retained in definitions (still used for hints generation logic)

---

## §3 — Mockup 07 changes (`07-nsm-step-2.html`)

- Updated stale comment `/* nsm-dim head uses field__label-row — add border-left accent + bg */` → `/* nsm-dim head uses field__label-row */`
- No `nsm-dim__coach` divs existed in body (were not present — mockup was already clean)
- No navy `border-left` existed in inline `<style>` (all `border-left` in mockup 07 use `--c-ink-3`, not `--c-navy`)

---

## §4 — Semantic colors PRESERVED (danger / success)

| Selector | Rule | Status |
|---|---|---|
| `.banner--save-error` (~197) | `border-left: 2px solid var(--c-danger)` | PRESERVED |
| `.nsm-highlight--next` (~3125) | `border-left: 3px solid var(--c-success)` | PRESERVED |
| ~3329 | `border-left: 2px solid var(--c-danger)` | PRESERVED |
| ~3416 | `border-left: 2px solid var(--c-success)` | PRESERVED |

---

## §5 — Verification

```
grep -c "border-left.*var(--c-navy)" public/style.css
→ 0

grep -c "nsm-dim__coach" public/style.css public/app.js 07-nsm-step-2.html
→ 0 / 0 / 0
```
