# Master Pixel-Diff Report — 16 Mockups Cross-Viewport (11 original + 5 new)

_Generated: 2026-05-09T13:25:29.838Z_

## Coverage

- Original 11 mockups (01/02/03/04/05/06/07/09/10/11/13): §A first-section baseline × 3 vp
- New 5 mockups (2026-05-09 extension): 02/08/12/14/16-D — all sections × 3 vp = 60 new cases
- Total new cases: 15+12+9+15+9 = 60

## 結果摘要

| Mockup | Mobile-360 | iPad-768 | Desktop-1280 |
|---|---|---|---|
| 01 home | 🔴 19.93% | 🟠 14.51% | 🟠 12.96% |
| 02 auth (§A login-default) | 🔴 15.26% | 🟠 11.24% | 🟠 9.07% |
| 03 phase1 form | 🟠 7.02% | 🟡 3.26% | 🟡 3.58% |
| 04 gate | 🟠 9.40% | 🟠 5.31% | 🟡 3.49% |
| 05 phase2 chat | 🟠 5.64% | 🟡 3.53% | 🟡 2.61% |
| 06 nsm step1 | 🟠 12.17% | 🟠 5.49% | 🟡 3.97% |
| 07 nsm step2 | 🟠 8.32% | 🟡 4.68% | 🟡 2.83% |
| 09 offcanvas | 🟠 11.53% | 🟠 9.91% | 🟠 9.83% |
| 10 onboarding | 🟠 13.83% | 🟠 10.24% | 🟠 8.84% |
| 11 phase3 score | 🟠 8.42% | 🟠 6.26% | 🟡 4.74% |
| 13 phase4 final | 🟠 13.88% | 🟠 9.39% | 🟠 8.96% |
| 02 auth §A login-default | 🟡 4.28% | 🟡 3.14% | 🟡 1.92% |
| 02 auth §B login-filled | 🟠 10.77% | 🟠 5.37% | 🟡 2.72% |
| 02 auth §C login-error | 🟠 14.84% | 🟠 9.25% | 🟡 3.79% |
| 02 auth §D register | 🟠 6.58% | 🟠 9.10% | 🟡 3.56% |
| 02 auth §E token-expiry | 🟠 10.36% | 🟠 6.38% | 🟡 4.39% |
| 08 nsm-gate §A ok | 🟠 9.14% | 🟡 4.89% | 🟡 2.30% |
| 08 nsm-gate §B warn | 🟠 10.30% | 🟠 6.12% | 🟡 3.15% |
| 08 nsm-gate §C error | 🟠 10.90% | 🟠 6.90% | 🟡 3.67% |
| 08 nsm-gate §D loading | 🟡 1.84% | 🟡 0.85% | 🟡 0.54% |
| 12 phase3 §A loading-slow | 🟡 2.15% | 🟡 1.03% | 🟡 0.65% |
| 12 phase3 §B api-error | 🟡 1.07% | 🟡 0.66% | ✅ 0.48% |
| 12 phase3 §C parse-error | 🟡 2.73% | 🟡 1.49% | 🟡 1.00% |
| 14 nsm-step4 §A overview | 🟠 10.63% | 🟠 7.58% | 🟠 5.07% |
| 14 nsm-step4 §B comparison | 🟠 6.23% | 🟡 3.98% | 🟡 2.96% |
| 14 nsm-step4 §B' coach-expand | 🟠 10.08% | 🟠 6.35% | 🟡 4.05% |
| 14 nsm-step4 §C highlights | 🟠 7.72% | 🟠 5.63% | 🟡 4.78% |
| 14 nsm-step4 §D done | 🟠 8.44% | 🟡 4.29% | 🟡 3.22% |
| 16 resume §D circles-eval | 🟠 11.00% | 🟠 9.07% | 🟠 5.62% |
| 16 resume §D nsm-gate | 🟠 14.71% | 🟠 11.36% | 🟠 9.01% |
| 16 resume §D phase4-report | 🟠 11.10% | 🟠 9.44% | 🟠 5.67% |

## 詳細 verdict per case

### Mockup 01-home · mobile-360: 🔴 ≥ 15%

- mockup 358×1285 / production 360×1725 / padded 360×1725 / mismatched 123778px / **19.93%**
- mockup PNG: `tests/visual/diffs/master/01-home-mobile-360-mockup.png`
- production PNG: `tests/visual/diffs/master/01-home-mobile-360-production.png`
- diff PNG: `tests/visual/diffs/master/01-home-mobile-360-diff.png`

### Mockup 01-home · tablet-768: 🟠 < 15% (state diff 預期)

- mockup 766×1092 / production 768×1483 / padded 768×1483 / mismatched 165255px / **14.51%**
- mockup PNG: `tests/visual/diffs/master/01-home-tablet-768-mockup.png`
- production PNG: `tests/visual/diffs/master/01-home-tablet-768-production.png`
- diff PNG: `tests/visual/diffs/master/01-home-tablet-768-diff.png`

### Mockup 01-home · desktop-1280: 🟠 < 15% (state diff 預期)

- mockup 1278×1090 / production 1280×1503 / padded 1280×1503 / mismatched 249320px / **12.96%**
- mockup PNG: `tests/visual/diffs/master/01-home-desktop-1280-mockup.png`
- production PNG: `tests/visual/diffs/master/01-home-desktop-1280-production.png`
- diff PNG: `tests/visual/diffs/master/01-home-desktop-1280-diff.png`

### Mockup 02-auth · mobile-360: 🔴 ≥ 15%

- mockup 358×744 / production 360×1703 / padded 360×1703 / mismatched 93532px / **15.26%**
- mockup PNG: `tests/visual/diffs/master/02-auth-mobile-360-mockup.png`
- production PNG: `tests/visual/diffs/master/02-auth-mobile-360-production.png`
- diff PNG: `tests/visual/diffs/master/02-auth-mobile-360-diff.png`

### Mockup 02-auth · tablet-768: 🟠 < 15% (state diff 預期)

- mockup 766×648 / production 768×1483 / padded 768×1483 / mismatched 128016px / **11.24%**
- mockup PNG: `tests/visual/diffs/master/02-auth-tablet-768-mockup.png`
- production PNG: `tests/visual/diffs/master/02-auth-tablet-768-production.png`
- diff PNG: `tests/visual/diffs/master/02-auth-tablet-768-diff.png`

### Mockup 02-auth · desktop-1280: 🟠 < 15% (state diff 預期)

- mockup 1278×635 / production 1280×1503 / padded 1280×1503 / mismatched 174571px / **9.07%**
- mockup PNG: `tests/visual/diffs/master/02-auth-desktop-1280-mockup.png`
- production PNG: `tests/visual/diffs/master/02-auth-desktop-1280-production.png`
- diff PNG: `tests/visual/diffs/master/02-auth-desktop-1280-diff.png`

### Mockup 03-phase1 · mobile-360: 🟠 < 15% (state diff 預期)

- mockup 358×1585 / production 360×1700 / padded 360×1700 / mismatched 42967px / **7.02%**
- mockup PNG: `tests/visual/diffs/master/03-phase1-mobile-360-mockup.png`
- production PNG: `tests/visual/diffs/master/03-phase1-mobile-360-production.png`
- diff PNG: `tests/visual/diffs/master/03-phase1-mobile-360-diff.png`

### Mockup 03-phase1 · tablet-768: 🟡 < 5%

- mockup 766×1278 / production 768×1700 / padded 768×1700 / mismatched 42511px / **3.26%**
- mockup PNG: `tests/visual/diffs/master/03-phase1-tablet-768-mockup.png`
- production PNG: `tests/visual/diffs/master/03-phase1-tablet-768-production.png`
- diff PNG: `tests/visual/diffs/master/03-phase1-tablet-768-diff.png`

### Mockup 03-phase1 · desktop-1280: 🟡 < 5%

- mockup 1278×1529 / production 1280×1700 / padded 1280×1700 / mismatched 77811px / **3.58%**
- mockup PNG: `tests/visual/diffs/master/03-phase1-desktop-1280-mockup.png`
- production PNG: `tests/visual/diffs/master/03-phase1-desktop-1280-production.png`
- diff PNG: `tests/visual/diffs/master/03-phase1-desktop-1280-diff.png`

### Mockup 04-gate · mobile-360: 🟠 < 15% (state diff 預期)

- mockup 360×1200 / production 360×939 / padded 360×1200 / mismatched 40605px / **9.40%**
- mockup PNG: `tests/visual/diffs/master/04-gate-mobile-360-mockup.png`
- production PNG: `tests/visual/diffs/master/04-gate-mobile-360-production.png`
- diff PNG: `tests/visual/diffs/master/04-gate-mobile-360-diff.png`

### Mockup 04-gate · tablet-768: 🟠 < 15% (state diff 預期)

- mockup 768×1037 / production 768×885 / padded 768×1037 / mismatched 42292px / **5.31%**
- mockup PNG: `tests/visual/diffs/master/04-gate-tablet-768-mockup.png`
- production PNG: `tests/visual/diffs/master/04-gate-tablet-768-production.png`
- diff PNG: `tests/visual/diffs/master/04-gate-tablet-768-diff.png`

### Mockup 04-gate · desktop-1280: 🟡 < 5%

- mockup 1280×1037 / production 1280×901 / padded 1280×1037 / mismatched 46297px / **3.49%**
- mockup PNG: `tests/visual/diffs/master/04-gate-desktop-1280-mockup.png`
- production PNG: `tests/visual/diffs/master/04-gate-desktop-1280-production.png`
- diff PNG: `tests/visual/diffs/master/04-gate-desktop-1280-diff.png`

### Mockup 05-phase2 · mobile-360: 🟠 < 15% (state diff 預期)

- mockup 360×880 / production 360×900 / padded 360×900 / mismatched 18274px / **5.64%**
- mockup PNG: `tests/visual/diffs/master/05-phase2-mobile-360-mockup.png`
- production PNG: `tests/visual/diffs/master/05-phase2-mobile-360-production.png`
- diff PNG: `tests/visual/diffs/master/05-phase2-mobile-360-diff.png`

### Mockup 05-phase2 · tablet-768: 🟡 < 5%

- mockup 768×880 / production 768×900 / padded 768×900 / mismatched 24431px / **3.53%**
- mockup PNG: `tests/visual/diffs/master/05-phase2-tablet-768-mockup.png`
- production PNG: `tests/visual/diffs/master/05-phase2-tablet-768-production.png`
- diff PNG: `tests/visual/diffs/master/05-phase2-tablet-768-diff.png`

### Mockup 05-phase2 · desktop-1280: 🟡 < 5%

- mockup 1280×880 / production 1280×900 / padded 1280×900 / mismatched 30108px / **2.61%**
- mockup PNG: `tests/visual/diffs/master/05-phase2-desktop-1280-mockup.png`
- production PNG: `tests/visual/diffs/master/05-phase2-desktop-1280-production.png`
- diff PNG: `tests/visual/diffs/master/05-phase2-desktop-1280-diff.png`

### Mockup 06-nsm1 · mobile-360: 🟠 < 15% (state diff 預期)

- mockup 360×1068 / production 360×1147 / padded 360×1147 / mismatched 50259px / **12.17%**
- mockup PNG: `tests/visual/diffs/master/06-nsm1-mobile-360-mockup.png`
- production PNG: `tests/visual/diffs/master/06-nsm1-mobile-360-production.png`
- diff PNG: `tests/visual/diffs/master/06-nsm1-mobile-360-diff.png`

### Mockup 06-nsm1 · tablet-768: 🟠 < 15% (state diff 預期)

- mockup 768×880 / production 768×900 / padded 768×900 / mismatched 37960px / **5.49%**
- mockup PNG: `tests/visual/diffs/master/06-nsm1-tablet-768-mockup.png`
- production PNG: `tests/visual/diffs/master/06-nsm1-tablet-768-production.png`
- diff PNG: `tests/visual/diffs/master/06-nsm1-tablet-768-diff.png`

### Mockup 06-nsm1 · desktop-1280: 🟡 < 5%

- mockup 1280×880 / production 1280×900 / padded 1280×900 / mismatched 45735px / **3.97%**
- mockup PNG: `tests/visual/diffs/master/06-nsm1-desktop-1280-mockup.png`
- production PNG: `tests/visual/diffs/master/06-nsm1-desktop-1280-production.png`
- diff PNG: `tests/visual/diffs/master/06-nsm1-desktop-1280-diff.png`

### Mockup 07-nsm2 · mobile-360: 🟠 < 15% (state diff 預期)

- mockup 360×1470 / production 360×1314 / padded 360×1470 / mismatched 44055px / **8.32%**
- mockup PNG: `tests/visual/diffs/master/07-nsm2-mobile-360-mockup.png`
- production PNG: `tests/visual/diffs/master/07-nsm2-mobile-360-production.png`
- diff PNG: `tests/visual/diffs/master/07-nsm2-mobile-360-diff.png`

### Mockup 07-nsm2 · tablet-768: 🟡 < 5%

- mockup 768×1339 / production 768×1229 / padded 768×1339 / mismatched 48131px / **4.68%**
- mockup PNG: `tests/visual/diffs/master/07-nsm2-tablet-768-mockup.png`
- production PNG: `tests/visual/diffs/master/07-nsm2-tablet-768-production.png`
- diff PNG: `tests/visual/diffs/master/07-nsm2-tablet-768-diff.png`

### Mockup 07-nsm2 · desktop-1280: 🟡 < 5%

- mockup 1280×1339 / production 1280×1229 / padded 1280×1339 / mismatched 48502px / **2.83%**
- mockup PNG: `tests/visual/diffs/master/07-nsm2-desktop-1280-mockup.png`
- production PNG: `tests/visual/diffs/master/07-nsm2-desktop-1280-production.png`
- diff PNG: `tests/visual/diffs/master/07-nsm2-desktop-1280-diff.png`

### Mockup 09-offcanvas · mobile-360: 🟠 < 15% (state diff 預期)

- mockup 360×880 / production 360×1439 / padded 360×1439 / mismatched 59736px / **11.53%**
- mockup PNG: `tests/visual/diffs/master/09-offcanvas-mobile-360-mockup.png`
- production PNG: `tests/visual/diffs/master/09-offcanvas-mobile-360-production.png`
- diff PNG: `tests/visual/diffs/master/09-offcanvas-mobile-360-diff.png`

### Mockup 09-offcanvas · tablet-768: 🟠 < 15% (state diff 預期)

- mockup 768×880 / production 768×1228 / padded 768×1228 / mismatched 93483px / **9.91%**
- mockup PNG: `tests/visual/diffs/master/09-offcanvas-tablet-768-mockup.png`
- production PNG: `tests/visual/diffs/master/09-offcanvas-tablet-768-production.png`
- diff PNG: `tests/visual/diffs/master/09-offcanvas-tablet-768-diff.png`

### Mockup 09-offcanvas · desktop-1280: 🟠 < 15% (state diff 預期)

- mockup 1280×880 / production 1280×1248 / padded 1280×1248 / mismatched 156987px / **9.83%**
- mockup PNG: `tests/visual/diffs/master/09-offcanvas-desktop-1280-mockup.png`
- production PNG: `tests/visual/diffs/master/09-offcanvas-desktop-1280-production.png`
- diff PNG: `tests/visual/diffs/master/09-offcanvas-desktop-1280-diff.png`

### Mockup 10-onboarding · mobile-360: 🟠 < 15% (state diff 預期)

- mockup 360×880 / production 360×1725 / padded 360×1725 / mismatched 85889px / **13.83%**
- mockup PNG: `tests/visual/diffs/master/10-onboarding-mobile-360-mockup.png`
- production PNG: `tests/visual/diffs/master/10-onboarding-mobile-360-production.png`
- diff PNG: `tests/visual/diffs/master/10-onboarding-mobile-360-diff.png`

### Mockup 10-onboarding · tablet-768: 🟠 < 15% (state diff 預期)

- mockup 768×880 / production 768×1483 / padded 768×1483 / mismatched 116629px / **10.24%**
- mockup PNG: `tests/visual/diffs/master/10-onboarding-tablet-768-mockup.png`
- production PNG: `tests/visual/diffs/master/10-onboarding-tablet-768-production.png`
- diff PNG: `tests/visual/diffs/master/10-onboarding-tablet-768-diff.png`

### Mockup 10-onboarding · desktop-1280: 🟠 < 15% (state diff 預期)

- mockup 1280×880 / production 1280×1503 / padded 1280×1503 / mismatched 169997px / **8.84%**
- mockup PNG: `tests/visual/diffs/master/10-onboarding-desktop-1280-mockup.png`
- production PNG: `tests/visual/diffs/master/10-onboarding-desktop-1280-production.png`
- diff PNG: `tests/visual/diffs/master/10-onboarding-desktop-1280-diff.png`

### Mockup 11-phase3 · mobile-360: 🟠 < 15% (state diff 預期)

- mockup 360×1100 / production 360×1100 / padded 360×1100 / mismatched 33326px / **8.42%**
- mockup PNG: `tests/visual/diffs/master/11-phase3-mobile-360-mockup.png`
- production PNG: `tests/visual/diffs/master/11-phase3-mobile-360-production.png`
- diff PNG: `tests/visual/diffs/master/11-phase3-mobile-360-diff.png`

### Mockup 11-phase3 · tablet-768: 🟠 < 15% (state diff 預期)

- mockup 768×1100 / production 768×1100 / padded 768×1100 / mismatched 52924px / **6.26%**
- mockup PNG: `tests/visual/diffs/master/11-phase3-tablet-768-mockup.png`
- production PNG: `tests/visual/diffs/master/11-phase3-tablet-768-production.png`
- diff PNG: `tests/visual/diffs/master/11-phase3-tablet-768-diff.png`

### Mockup 11-phase3 · desktop-1280: 🟡 < 5%

- mockup 1280×1356 / production 1280×1259 / padded 1280×1356 / mismatched 82338px / **4.74%**
- mockup PNG: `tests/visual/diffs/master/11-phase3-desktop-1280-mockup.png`
- production PNG: `tests/visual/diffs/master/11-phase3-desktop-1280-production.png`
- diff PNG: `tests/visual/diffs/master/11-phase3-desktop-1280-diff.png`

### Mockup 13-phase4 · mobile-360: 🟠 < 15% (state diff 預期)

- mockup 360×3002 / production 360×2052 / padded 360×3002 / mismatched 150052px / **13.88%**
- mockup PNG: `tests/visual/diffs/master/13-phase4-mobile-360-mockup.png`
- production PNG: `tests/visual/diffs/master/13-phase4-mobile-360-production.png`
- diff PNG: `tests/visual/diffs/master/13-phase4-mobile-360-diff.png`

### Mockup 13-phase4 · tablet-768: 🟠 < 15% (state diff 預期)

- mockup 768×2491 / production 768×1917 / padded 768×2491 / mismatched 179653px / **9.39%**
- mockup PNG: `tests/visual/diffs/master/13-phase4-tablet-768-mockup.png`
- production PNG: `tests/visual/diffs/master/13-phase4-tablet-768-production.png`
- diff PNG: `tests/visual/diffs/master/13-phase4-tablet-768-diff.png`

### Mockup 13-phase4 · desktop-1280: 🟠 < 15% (state diff 預期)

- mockup 1280×2147 / production 1280×1612 / padded 1280×2147 / mismatched 246132px / **8.96%**
- mockup PNG: `tests/visual/diffs/master/13-phase4-desktop-1280-mockup.png`
- production PNG: `tests/visual/diffs/master/13-phase4-desktop-1280-production.png`
- diff PNG: `tests/visual/diffs/master/13-phase4-desktop-1280-diff.png`

### Mockup 02-auth-ext-A-login-default · mobile-360: 🟡 < 5%

- mockup 358×744 / production 360×900 / padded 360×900 / mismatched 13881px / **4.28%**
- mockup PNG: `tests/visual/diffs/master/02-auth-ext-A-login-default-mobile-360-mockup.png`
- production PNG: `tests/visual/diffs/master/02-auth-ext-A-login-default-mobile-360-production.png`
- diff PNG: `tests/visual/diffs/master/02-auth-ext-A-login-default-mobile-360-diff.png`

### Mockup 02-auth-ext-A-login-default · tablet-768: 🟡 < 5%

- mockup 766×744 / production 768×900 / padded 768×900 / mismatched 21670px / **3.14%**
- mockup PNG: `tests/visual/diffs/master/02-auth-ext-A-login-default-tablet-768-mockup.png`
- production PNG: `tests/visual/diffs/master/02-auth-ext-A-login-default-tablet-768-production.png`
- diff PNG: `tests/visual/diffs/master/02-auth-ext-A-login-default-tablet-768-diff.png`

### Mockup 02-auth-ext-A-login-default · desktop-1280: 🟡 < 5%

- mockup 1278×744 / production 1280×900 / padded 1280×900 / mismatched 22093px / **1.92%**
- mockup PNG: `tests/visual/diffs/master/02-auth-ext-A-login-default-desktop-1280-mockup.png`
- production PNG: `tests/visual/diffs/master/02-auth-ext-A-login-default-desktop-1280-production.png`
- diff PNG: `tests/visual/diffs/master/02-auth-ext-A-login-default-desktop-1280-diff.png`

### Mockup 02-auth-ext-B-login-filled · mobile-360: 🟠 < 15% (state diff 預期)

- mockup 358×627 / production 360×900 / padded 360×900 / mismatched 34907px / **10.77%**
- mockup PNG: `tests/visual/diffs/master/02-auth-ext-B-login-filled-mobile-360-mockup.png`
- production PNG: `tests/visual/diffs/master/02-auth-ext-B-login-filled-mobile-360-production.png`
- diff PNG: `tests/visual/diffs/master/02-auth-ext-B-login-filled-mobile-360-diff.png`

### Mockup 02-auth-ext-B-login-filled · tablet-768: 🟠 < 15% (state diff 預期)

- mockup 766×648 / production 768×900 / padded 768×900 / mismatched 37086px / **5.37%**
- mockup PNG: `tests/visual/diffs/master/02-auth-ext-B-login-filled-tablet-768-mockup.png`
- production PNG: `tests/visual/diffs/master/02-auth-ext-B-login-filled-tablet-768-production.png`
- diff PNG: `tests/visual/diffs/master/02-auth-ext-B-login-filled-tablet-768-diff.png`

### Mockup 02-auth-ext-B-login-filled · desktop-1280: 🟡 < 5%

- mockup 1278×635 / production 1280×900 / padded 1280×900 / mismatched 31382px / **2.72%**
- mockup PNG: `tests/visual/diffs/master/02-auth-ext-B-login-filled-desktop-1280-mockup.png`
- production PNG: `tests/visual/diffs/master/02-auth-ext-B-login-filled-desktop-1280-production.png`
- diff PNG: `tests/visual/diffs/master/02-auth-ext-B-login-filled-desktop-1280-diff.png`

### Mockup 02-auth-ext-C-login-error · mobile-360: 🟠 < 15% (state diff 預期)

- mockup 358×720 / production 360×900 / padded 360×900 / mismatched 48088px / **14.84%**
- mockup PNG: `tests/visual/diffs/master/02-auth-ext-C-login-error-mobile-360-mockup.png`
- production PNG: `tests/visual/diffs/master/02-auth-ext-C-login-error-mobile-360-production.png`
- diff PNG: `tests/visual/diffs/master/02-auth-ext-C-login-error-mobile-360-diff.png`

### Mockup 02-auth-ext-C-login-error · tablet-768: 🟠 < 15% (state diff 預期)

- mockup 766×730 / production 768×900 / padded 768×900 / mismatched 63923px / **9.25%**
- mockup PNG: `tests/visual/diffs/master/02-auth-ext-C-login-error-tablet-768-mockup.png`
- production PNG: `tests/visual/diffs/master/02-auth-ext-C-login-error-tablet-768-production.png`
- diff PNG: `tests/visual/diffs/master/02-auth-ext-C-login-error-tablet-768-diff.png`

### Mockup 02-auth-ext-C-login-error · desktop-1280: 🟡 < 5%

- mockup 1278×802 / production 1280×900 / padded 1280×900 / mismatched 43692px / **3.79%**
- mockup PNG: `tests/visual/diffs/master/02-auth-ext-C-login-error-desktop-1280-mockup.png`
- production PNG: `tests/visual/diffs/master/02-auth-ext-C-login-error-desktop-1280-production.png`
- diff PNG: `tests/visual/diffs/master/02-auth-ext-C-login-error-desktop-1280-diff.png`

### Mockup 02-auth-ext-D-register · mobile-360: 🟠 < 15% (state diff 預期)

- mockup 358×692 / production 360×900 / padded 360×900 / mismatched 21321px / **6.58%**
- mockup PNG: `tests/visual/diffs/master/02-auth-ext-D-register-mobile-360-mockup.png`
- production PNG: `tests/visual/diffs/master/02-auth-ext-D-register-mobile-360-production.png`
- diff PNG: `tests/visual/diffs/master/02-auth-ext-D-register-mobile-360-diff.png`

### Mockup 02-auth-ext-D-register · tablet-768: 🟠 < 15% (state diff 預期)

- mockup 766×730 / production 768×900 / padded 768×900 / mismatched 62898px / **9.10%**
- mockup PNG: `tests/visual/diffs/master/02-auth-ext-D-register-tablet-768-mockup.png`
- production PNG: `tests/visual/diffs/master/02-auth-ext-D-register-tablet-768-production.png`
- diff PNG: `tests/visual/diffs/master/02-auth-ext-D-register-tablet-768-diff.png`

### Mockup 02-auth-ext-D-register · desktop-1280: 🟡 < 5%

- mockup 1278×737 / production 1280×900 / padded 1280×900 / mismatched 40958px / **3.56%**
- mockup PNG: `tests/visual/diffs/master/02-auth-ext-D-register-desktop-1280-mockup.png`
- production PNG: `tests/visual/diffs/master/02-auth-ext-D-register-desktop-1280-production.png`
- diff PNG: `tests/visual/diffs/master/02-auth-ext-D-register-desktop-1280-diff.png`

### Mockup 02-auth-ext-E-token-expiry · mobile-360: 🟠 < 15% (state diff 預期)

- mockup 358×474 / production 360×940 / padded 360×940 / mismatched 35054px / **10.36%**
- mockup PNG: `tests/visual/diffs/master/02-auth-ext-E-token-expiry-mobile-360-mockup.png`
- production PNG: `tests/visual/diffs/master/02-auth-ext-E-token-expiry-mobile-360-production.png`
- diff PNG: `tests/visual/diffs/master/02-auth-ext-E-token-expiry-mobile-360-diff.png`

### Mockup 02-auth-ext-E-token-expiry · tablet-768: 🟠 < 15% (state diff 預期)

- mockup 766×352 / production 768×900 / padded 768×900 / mismatched 44128px / **6.38%**
- mockup PNG: `tests/visual/diffs/master/02-auth-ext-E-token-expiry-tablet-768-mockup.png`
- production PNG: `tests/visual/diffs/master/02-auth-ext-E-token-expiry-tablet-768-production.png`
- diff PNG: `tests/visual/diffs/master/02-auth-ext-E-token-expiry-tablet-768-diff.png`

### Mockup 02-auth-ext-E-token-expiry · desktop-1280: 🟡 < 5%

- mockup 1278×554 / production 1280×900 / padded 1280×900 / mismatched 50570px / **4.39%**
- mockup PNG: `tests/visual/diffs/master/02-auth-ext-E-token-expiry-desktop-1280-mockup.png`
- production PNG: `tests/visual/diffs/master/02-auth-ext-E-token-expiry-desktop-1280-production.png`
- diff PNG: `tests/visual/diffs/master/02-auth-ext-E-token-expiry-desktop-1280-diff.png`

### Mockup 08-nsm-gate-A-ok · mobile-360: 🟠 < 15% (state diff 預期)

- mockup 360×1437 / production 360×1100 / padded 360×1437 / mismatched 47262px / **9.14%**
- mockup PNG: `tests/visual/diffs/master/08-nsm-gate-A-ok-mobile-360-mockup.png`
- production PNG: `tests/visual/diffs/master/08-nsm-gate-A-ok-mobile-360-production.png`
- diff PNG: `tests/visual/diffs/master/08-nsm-gate-A-ok-mobile-360-diff.png`

### Mockup 08-nsm-gate-A-ok · tablet-768: 🟡 < 5%

- mockup 768×1272 / production 768×1100 / padded 768×1272 / mismatched 47759px / **4.89%**
- mockup PNG: `tests/visual/diffs/master/08-nsm-gate-A-ok-tablet-768-mockup.png`
- production PNG: `tests/visual/diffs/master/08-nsm-gate-A-ok-tablet-768-production.png`
- diff PNG: `tests/visual/diffs/master/08-nsm-gate-A-ok-tablet-768-diff.png`

### Mockup 08-nsm-gate-A-ok · desktop-1280: 🟡 < 5%

- mockup 1280×1272 / production 1280×1100 / padded 1280×1272 / mismatched 37473px / **2.30%**
- mockup PNG: `tests/visual/diffs/master/08-nsm-gate-A-ok-desktop-1280-mockup.png`
- production PNG: `tests/visual/diffs/master/08-nsm-gate-A-ok-desktop-1280-production.png`
- diff PNG: `tests/visual/diffs/master/08-nsm-gate-A-ok-desktop-1280-diff.png`

### Mockup 08-nsm-gate-B-warn · mobile-360: 🟠 < 15% (state diff 預期)

- mockup 360×1543 / production 360×1100 / padded 360×1543 / mismatched 57187px / **10.30%**
- mockup PNG: `tests/visual/diffs/master/08-nsm-gate-B-warn-mobile-360-mockup.png`
- production PNG: `tests/visual/diffs/master/08-nsm-gate-B-warn-mobile-360-production.png`
- diff PNG: `tests/visual/diffs/master/08-nsm-gate-B-warn-mobile-360-diff.png`

### Mockup 08-nsm-gate-B-warn · tablet-768: 🟠 < 15% (state diff 預期)

- mockup 768×1263 / production 768×1100 / padded 768×1263 / mismatched 59323px / **6.12%**
- mockup PNG: `tests/visual/diffs/master/08-nsm-gate-B-warn-tablet-768-mockup.png`
- production PNG: `tests/visual/diffs/master/08-nsm-gate-B-warn-tablet-768-production.png`
- diff PNG: `tests/visual/diffs/master/08-nsm-gate-B-warn-tablet-768-diff.png`

### Mockup 08-nsm-gate-B-warn · desktop-1280: 🟡 < 5%

- mockup 1280×1239 / production 1280×1100 / padded 1280×1239 / mismatched 49937px / **3.15%**
- mockup PNG: `tests/visual/diffs/master/08-nsm-gate-B-warn-desktop-1280-mockup.png`
- production PNG: `tests/visual/diffs/master/08-nsm-gate-B-warn-desktop-1280-production.png`
- diff PNG: `tests/visual/diffs/master/08-nsm-gate-B-warn-desktop-1280-diff.png`

### Mockup 08-nsm-gate-C-error · mobile-360: 🟠 < 15% (state diff 預期)

- mockup 360×1654 / production 360×1175 / padded 360×1654 / mismatched 64886px / **10.90%**
- mockup PNG: `tests/visual/diffs/master/08-nsm-gate-C-error-mobile-360-mockup.png`
- production PNG: `tests/visual/diffs/master/08-nsm-gate-C-error-mobile-360-production.png`
- diff PNG: `tests/visual/diffs/master/08-nsm-gate-C-error-mobile-360-diff.png`

### Mockup 08-nsm-gate-C-error · tablet-768: 🟠 < 15% (state diff 預期)

- mockup 768×1372 / production 768×1100 / padded 768×1372 / mismatched 72671px / **6.90%**
- mockup PNG: `tests/visual/diffs/master/08-nsm-gate-C-error-tablet-768-mockup.png`
- production PNG: `tests/visual/diffs/master/08-nsm-gate-C-error-tablet-768-production.png`
- diff PNG: `tests/visual/diffs/master/08-nsm-gate-C-error-tablet-768-diff.png`

### Mockup 08-nsm-gate-C-error · desktop-1280: 🟡 < 5%

- mockup 1280×1348 / production 1280×1100 / padded 1280×1348 / mismatched 63239px / **3.67%**
- mockup PNG: `tests/visual/diffs/master/08-nsm-gate-C-error-desktop-1280-mockup.png`
- production PNG: `tests/visual/diffs/master/08-nsm-gate-C-error-desktop-1280-production.png`
- diff PNG: `tests/visual/diffs/master/08-nsm-gate-C-error-desktop-1280-diff.png`

### Mockup 08-nsm-gate-D-loading · mobile-360: 🟡 < 5%

- mockup 360×1100 / production 360×1100 / padded 360×1100 / mismatched 7275px / **1.84%**
- mockup PNG: `tests/visual/diffs/master/08-nsm-gate-D-loading-mobile-360-mockup.png`
- production PNG: `tests/visual/diffs/master/08-nsm-gate-D-loading-mobile-360-production.png`
- diff PNG: `tests/visual/diffs/master/08-nsm-gate-D-loading-mobile-360-diff.png`

### Mockup 08-nsm-gate-D-loading · tablet-768: 🟡 < 5%

- mockup 768×1100 / production 768×1100 / padded 768×1100 / mismatched 7187px / **0.85%**
- mockup PNG: `tests/visual/diffs/master/08-nsm-gate-D-loading-tablet-768-mockup.png`
- production PNG: `tests/visual/diffs/master/08-nsm-gate-D-loading-tablet-768-production.png`
- diff PNG: `tests/visual/diffs/master/08-nsm-gate-D-loading-tablet-768-diff.png`

### Mockup 08-nsm-gate-D-loading · desktop-1280: 🟡 < 5%

- mockup 1280×1100 / production 1280×1100 / padded 1280×1100 / mismatched 7621px / **0.54%**
- mockup PNG: `tests/visual/diffs/master/08-nsm-gate-D-loading-desktop-1280-mockup.png`
- production PNG: `tests/visual/diffs/master/08-nsm-gate-D-loading-desktop-1280-production.png`
- diff PNG: `tests/visual/diffs/master/08-nsm-gate-D-loading-desktop-1280-diff.png`

### Mockup 12-phase3-A-loading-slow · mobile-360: 🟡 < 5%

- mockup 360×880 / production 360×880 / padded 360×880 / mismatched 6814px / **2.15%**
- mockup PNG: `tests/visual/diffs/master/12-phase3-A-loading-slow-mobile-360-mockup.png`
- production PNG: `tests/visual/diffs/master/12-phase3-A-loading-slow-mobile-360-production.png`
- diff PNG: `tests/visual/diffs/master/12-phase3-A-loading-slow-mobile-360-diff.png`

### Mockup 12-phase3-A-loading-slow · tablet-768: 🟡 < 5%

- mockup 768×880 / production 768×880 / padded 768×880 / mismatched 6961px / **1.03%**
- mockup PNG: `tests/visual/diffs/master/12-phase3-A-loading-slow-tablet-768-mockup.png`
- production PNG: `tests/visual/diffs/master/12-phase3-A-loading-slow-tablet-768-production.png`
- diff PNG: `tests/visual/diffs/master/12-phase3-A-loading-slow-tablet-768-diff.png`

### Mockup 12-phase3-A-loading-slow · desktop-1280: 🟡 < 5%

- mockup 1280×880 / production 1280×880 / padded 1280×880 / mismatched 7273px / **0.65%**
- mockup PNG: `tests/visual/diffs/master/12-phase3-A-loading-slow-desktop-1280-mockup.png`
- production PNG: `tests/visual/diffs/master/12-phase3-A-loading-slow-desktop-1280-production.png`
- diff PNG: `tests/visual/diffs/master/12-phase3-A-loading-slow-desktop-1280-diff.png`

### Mockup 12-phase3-B-api-error · mobile-360: 🟡 < 5%

- mockup 360×880 / production 360×880 / padded 360×880 / mismatched 3399px / **1.07%**
- mockup PNG: `tests/visual/diffs/master/12-phase3-B-api-error-mobile-360-mockup.png`
- production PNG: `tests/visual/diffs/master/12-phase3-B-api-error-mobile-360-production.png`
- diff PNG: `tests/visual/diffs/master/12-phase3-B-api-error-mobile-360-diff.png`

### Mockup 12-phase3-B-api-error · tablet-768: 🟡 < 5%

- mockup 768×880 / production 768×880 / padded 768×880 / mismatched 4457px / **0.66%**
- mockup PNG: `tests/visual/diffs/master/12-phase3-B-api-error-tablet-768-mockup.png`
- production PNG: `tests/visual/diffs/master/12-phase3-B-api-error-tablet-768-production.png`
- diff PNG: `tests/visual/diffs/master/12-phase3-B-api-error-tablet-768-diff.png`

### Mockup 12-phase3-B-api-error · desktop-1280: ✅ < 0.5%

- mockup 1280×880 / production 1280×880 / padded 1280×880 / mismatched 5451px / **0.48%**
- mockup PNG: `tests/visual/diffs/master/12-phase3-B-api-error-desktop-1280-mockup.png`
- production PNG: `tests/visual/diffs/master/12-phase3-B-api-error-desktop-1280-production.png`
- diff PNG: `tests/visual/diffs/master/12-phase3-B-api-error-desktop-1280-diff.png`

### Mockup 12-phase3-C-parse-error · mobile-360: 🟡 < 5%

- mockup 360×880 / production 360×880 / padded 360×880 / mismatched 8649px / **2.73%**
- mockup PNG: `tests/visual/diffs/master/12-phase3-C-parse-error-mobile-360-mockup.png`
- production PNG: `tests/visual/diffs/master/12-phase3-C-parse-error-mobile-360-production.png`
- diff PNG: `tests/visual/diffs/master/12-phase3-C-parse-error-mobile-360-diff.png`

### Mockup 12-phase3-C-parse-error · tablet-768: 🟡 < 5%

- mockup 768×880 / production 768×880 / padded 768×880 / mismatched 10050px / **1.49%**
- mockup PNG: `tests/visual/diffs/master/12-phase3-C-parse-error-tablet-768-mockup.png`
- production PNG: `tests/visual/diffs/master/12-phase3-C-parse-error-tablet-768-production.png`
- diff PNG: `tests/visual/diffs/master/12-phase3-C-parse-error-tablet-768-diff.png`

### Mockup 12-phase3-C-parse-error · desktop-1280: 🟡 < 5%

- mockup 1280×880 / production 1280×880 / padded 1280×880 / mismatched 11208px / **1.00%**
- mockup PNG: `tests/visual/diffs/master/12-phase3-C-parse-error-desktop-1280-mockup.png`
- production PNG: `tests/visual/diffs/master/12-phase3-C-parse-error-desktop-1280-production.png`
- diff PNG: `tests/visual/diffs/master/12-phase3-C-parse-error-desktop-1280-diff.png`

### Mockup 14-nsm-step4-A-overview · mobile-360: 🟠 < 15% (state diff 預期)

- mockup 360×1348 / production 360×1329 / padded 360×1348 / mismatched 51581px / **10.63%**
- mockup PNG: `tests/visual/diffs/master/14-nsm-step4-A-overview-mobile-360-mockup.png`
- production PNG: `tests/visual/diffs/master/14-nsm-step4-A-overview-mobile-360-production.png`
- diff PNG: `tests/visual/diffs/master/14-nsm-step4-A-overview-mobile-360-diff.png`

### Mockup 14-nsm-step4-A-overview · tablet-768: 🟠 < 15% (state diff 預期)

- mockup 768×1284 / production 768×1294 / padded 768×1294 / mismatched 75319px / **7.58%**
- mockup PNG: `tests/visual/diffs/master/14-nsm-step4-A-overview-tablet-768-mockup.png`
- production PNG: `tests/visual/diffs/master/14-nsm-step4-A-overview-tablet-768-production.png`
- diff PNG: `tests/visual/diffs/master/14-nsm-step4-A-overview-tablet-768-diff.png`

### Mockup 14-nsm-step4-A-overview · desktop-1280: 🟠 < 15% (state diff 預期)

- mockup 1280×1100 / production 1280×1100 / padded 1280×1100 / mismatched 71437px / **5.07%**
- mockup PNG: `tests/visual/diffs/master/14-nsm-step4-A-overview-desktop-1280-mockup.png`
- production PNG: `tests/visual/diffs/master/14-nsm-step4-A-overview-desktop-1280-production.png`
- diff PNG: `tests/visual/diffs/master/14-nsm-step4-A-overview-desktop-1280-diff.png`

### Mockup 14-nsm-step4-B-comparison · mobile-360: 🟠 < 15% (state diff 預期)

- mockup 360×1459 / production 360×1478 / padded 360×1478 / mismatched 33163px / **6.23%**
- mockup PNG: `tests/visual/diffs/master/14-nsm-step4-B-comparison-mobile-360-mockup.png`
- production PNG: `tests/visual/diffs/master/14-nsm-step4-B-comparison-mobile-360-production.png`
- diff PNG: `tests/visual/diffs/master/14-nsm-step4-B-comparison-mobile-360-diff.png`

### Mockup 14-nsm-step4-B-comparison · tablet-768: 🟡 < 5%

- mockup 768×1100 / production 768×1100 / padded 768×1100 / mismatched 33648px / **3.98%**
- mockup PNG: `tests/visual/diffs/master/14-nsm-step4-B-comparison-tablet-768-mockup.png`
- production PNG: `tests/visual/diffs/master/14-nsm-step4-B-comparison-tablet-768-production.png`
- diff PNG: `tests/visual/diffs/master/14-nsm-step4-B-comparison-tablet-768-diff.png`

### Mockup 14-nsm-step4-B-comparison · desktop-1280: 🟡 < 5%

- mockup 1280×1100 / production 1280×1100 / padded 1280×1100 / mismatched 41706px / **2.96%**
- mockup PNG: `tests/visual/diffs/master/14-nsm-step4-B-comparison-desktop-1280-mockup.png`
- production PNG: `tests/visual/diffs/master/14-nsm-step4-B-comparison-desktop-1280-production.png`
- diff PNG: `tests/visual/diffs/master/14-nsm-step4-B-comparison-desktop-1280-diff.png`

### Mockup 14-nsm-step4-Bprime-coach-expand · mobile-360: 🟠 < 15% (state diff 預期)

- mockup 360×1143 / production 360×1749 / padded 360×1749 / mismatched 63478px / **10.08%**
- mockup PNG: `tests/visual/diffs/master/14-nsm-step4-Bprime-coach-expand-mobile-360-mockup.png`
- production PNG: `tests/visual/diffs/master/14-nsm-step4-Bprime-coach-expand-mobile-360-production.png`
- diff PNG: `tests/visual/diffs/master/14-nsm-step4-Bprime-coach-expand-mobile-360-diff.png`

### Mockup 14-nsm-step4-Bprime-coach-expand · tablet-768: 🟠 < 15% (state diff 預期)

- mockup 768×1100 / production 768×1100 / padded 768×1100 / mismatched 53656px / **6.35%**
- mockup PNG: `tests/visual/diffs/master/14-nsm-step4-Bprime-coach-expand-tablet-768-mockup.png`
- production PNG: `tests/visual/diffs/master/14-nsm-step4-Bprime-coach-expand-tablet-768-production.png`
- diff PNG: `tests/visual/diffs/master/14-nsm-step4-Bprime-coach-expand-tablet-768-diff.png`

### Mockup 14-nsm-step4-Bprime-coach-expand · desktop-1280: 🟡 < 5%

- mockup 1280×1100 / production 1280×1100 / padded 1280×1100 / mismatched 57068px / **4.05%**
- mockup PNG: `tests/visual/diffs/master/14-nsm-step4-Bprime-coach-expand-desktop-1280-mockup.png`
- production PNG: `tests/visual/diffs/master/14-nsm-step4-Bprime-coach-expand-desktop-1280-production.png`
- diff PNG: `tests/visual/diffs/master/14-nsm-step4-Bprime-coach-expand-desktop-1280-diff.png`

### Mockup 14-nsm-step4-C-highlights · mobile-360: 🟠 < 15% (state diff 預期)

- mockup 360×1100 / production 360×1100 / padded 360×1100 / mismatched 30552px / **7.72%**
- mockup PNG: `tests/visual/diffs/master/14-nsm-step4-C-highlights-mobile-360-mockup.png`
- production PNG: `tests/visual/diffs/master/14-nsm-step4-C-highlights-mobile-360-production.png`
- diff PNG: `tests/visual/diffs/master/14-nsm-step4-C-highlights-mobile-360-diff.png`

### Mockup 14-nsm-step4-C-highlights · tablet-768: 🟠 < 15% (state diff 預期)

- mockup 768×1100 / production 768×1100 / padded 768×1100 / mismatched 47542px / **5.63%**
- mockup PNG: `tests/visual/diffs/master/14-nsm-step4-C-highlights-tablet-768-mockup.png`
- production PNG: `tests/visual/diffs/master/14-nsm-step4-C-highlights-tablet-768-production.png`
- diff PNG: `tests/visual/diffs/master/14-nsm-step4-C-highlights-tablet-768-diff.png`

### Mockup 14-nsm-step4-C-highlights · desktop-1280: 🟡 < 5%

- mockup 1280×1100 / production 1280×1100 / padded 1280×1100 / mismatched 67255px / **4.78%**
- mockup PNG: `tests/visual/diffs/master/14-nsm-step4-C-highlights-desktop-1280-mockup.png`
- production PNG: `tests/visual/diffs/master/14-nsm-step4-C-highlights-desktop-1280-production.png`
- diff PNG: `tests/visual/diffs/master/14-nsm-step4-C-highlights-desktop-1280-diff.png`

### Mockup 14-nsm-step4-D-done · mobile-360: 🟠 < 15% (state diff 預期)

- mockup 360×1100 / production 360×1100 / padded 360×1100 / mismatched 33405px / **8.44%**
- mockup PNG: `tests/visual/diffs/master/14-nsm-step4-D-done-mobile-360-mockup.png`
- production PNG: `tests/visual/diffs/master/14-nsm-step4-D-done-mobile-360-production.png`
- diff PNG: `tests/visual/diffs/master/14-nsm-step4-D-done-mobile-360-diff.png`

### Mockup 14-nsm-step4-D-done · tablet-768: 🟡 < 5%

- mockup 768×1100 / production 768×1100 / padded 768×1100 / mismatched 36265px / **4.29%**
- mockup PNG: `tests/visual/diffs/master/14-nsm-step4-D-done-tablet-768-mockup.png`
- production PNG: `tests/visual/diffs/master/14-nsm-step4-D-done-tablet-768-production.png`
- diff PNG: `tests/visual/diffs/master/14-nsm-step4-D-done-tablet-768-diff.png`

### Mockup 14-nsm-step4-D-done · desktop-1280: 🟡 < 5%

- mockup 1280×1100 / production 1280×1100 / padded 1280×1100 / mismatched 45380px / **3.22%**
- mockup PNG: `tests/visual/diffs/master/14-nsm-step4-D-done-desktop-1280-mockup.png`
- production PNG: `tests/visual/diffs/master/14-nsm-step4-D-done-desktop-1280-production.png`
- diff PNG: `tests/visual/diffs/master/14-nsm-step4-D-done-desktop-1280-diff.png`

### Mockup 16-resume-D-circles-eval · mobile-360: 🟠 < 15% (state diff 預期)

- mockup 360×700 / production 360×1175 / padded 360×1175 / mismatched 46540px / **11.00%**
- mockup PNG: `tests/visual/diffs/master/16-resume-D-circles-eval-mobile-360-mockup.png`
- production PNG: `tests/visual/diffs/master/16-resume-D-circles-eval-mobile-360-production.png`
- diff PNG: `tests/visual/diffs/master/16-resume-D-circles-eval-mobile-360-diff.png`

### Mockup 16-resume-D-circles-eval · tablet-768: 🟠 < 15% (state diff 預期)

- mockup 768×700 / production 768×912 / padded 768×912 / mismatched 63548px / **9.07%**
- mockup PNG: `tests/visual/diffs/master/16-resume-D-circles-eval-tablet-768-mockup.png`
- production PNG: `tests/visual/diffs/master/16-resume-D-circles-eval-tablet-768-production.png`
- diff PNG: `tests/visual/diffs/master/16-resume-D-circles-eval-tablet-768-diff.png`

### Mockup 16-resume-D-circles-eval · desktop-1280: 🟠 < 15% (state diff 預期)

- mockup 1215×700 / production 1280×910 / padded 1280×910 / mismatched 65436px / **5.62%**
- mockup PNG: `tests/visual/diffs/master/16-resume-D-circles-eval-desktop-1280-mockup.png`
- production PNG: `tests/visual/diffs/master/16-resume-D-circles-eval-desktop-1280-production.png`
- diff PNG: `tests/visual/diffs/master/16-resume-D-circles-eval-desktop-1280-diff.png`

### Mockup 16-resume-D-nsm-gate · mobile-360: 🟠 < 15% (state diff 預期)

- mockup 360×700 / production 360×1779 / padded 360×1779 / mismatched 94225px / **14.71%**
- mockup PNG: `tests/visual/diffs/master/16-resume-D-nsm-gate-mobile-360-mockup.png`
- production PNG: `tests/visual/diffs/master/16-resume-D-nsm-gate-mobile-360-production.png`
- diff PNG: `tests/visual/diffs/master/16-resume-D-nsm-gate-mobile-360-diff.png`

### Mockup 16-resume-D-nsm-gate · tablet-768: 🟠 < 15% (state diff 預期)

- mockup 768×700 / production 768×1540 / padded 768×1540 / mismatched 134321px / **11.36%**
- mockup PNG: `tests/visual/diffs/master/16-resume-D-nsm-gate-tablet-768-mockup.png`
- production PNG: `tests/visual/diffs/master/16-resume-D-nsm-gate-tablet-768-production.png`
- diff PNG: `tests/visual/diffs/master/16-resume-D-nsm-gate-tablet-768-diff.png`

### Mockup 16-resume-D-nsm-gate · desktop-1280: 🟠 < 15% (state diff 預期)

- mockup 1215×700 / production 1280×1560 / padded 1280×1560 / mismatched 179921px / **9.01%**
- mockup PNG: `tests/visual/diffs/master/16-resume-D-nsm-gate-desktop-1280-mockup.png`
- production PNG: `tests/visual/diffs/master/16-resume-D-nsm-gate-desktop-1280-production.png`
- diff PNG: `tests/visual/diffs/master/16-resume-D-nsm-gate-desktop-1280-diff.png`

### Mockup 16-resume-D-phase4-report · mobile-360: 🟠 < 15% (state diff 預期)

- mockup 360×700 / production 360×1156 / padded 360×1156 / mismatched 46206px / **11.10%**
- mockup PNG: `tests/visual/diffs/master/16-resume-D-phase4-report-mobile-360-mockup.png`
- production PNG: `tests/visual/diffs/master/16-resume-D-phase4-report-mobile-360-production.png`
- diff PNG: `tests/visual/diffs/master/16-resume-D-phase4-report-mobile-360-diff.png`

### Mockup 16-resume-D-phase4-report · tablet-768: 🟠 < 15% (state diff 預期)

- mockup 768×700 / production 768×888 / padded 768×888 / mismatched 64364px / **9.44%**
- mockup PNG: `tests/visual/diffs/master/16-resume-D-phase4-report-tablet-768-mockup.png`
- production PNG: `tests/visual/diffs/master/16-resume-D-phase4-report-tablet-768-production.png`
- diff PNG: `tests/visual/diffs/master/16-resume-D-phase4-report-tablet-768-diff.png`

### Mockup 16-resume-D-phase4-report · desktop-1280: 🟠 < 15% (state diff 預期)

- mockup 1215×700 / production 1280×910 / padded 1280×910 / mismatched 66010px / **5.67%**
- mockup PNG: `tests/visual/diffs/master/16-resume-D-phase4-report-desktop-1280-mockup.png`
- production PNG: `tests/visual/diffs/master/16-resume-D-phase4-report-desktop-1280-production.png`
- diff PNG: `tests/visual/diffs/master/16-resume-D-phase4-report-desktop-1280-diff.png`

---

## Verdict bands (per existing convention)

- ✅ < 0.5% — pixel 契約嚴格達標
- 🟡 < 5% — 結構 OK，cosmetic drift
- 🟠 < 15% — state diff 預期（題目隨機 vs hardcoded、登入態差異、content diff）
- 🔴 ≥ 15% — 結構偏離需排查
- 🔲 gap — frame label 未找到，已跳過

## 預期 diff 來源說明

對 mockup 與 production 不同 state 的預期差距：
1. navbar 登入態：mockup 部分 frame 顯示已登入 email / production 為 guest
2. 題目隨機 vs hardcoded：mockup 用 Spotify / Notion 固定，production 隨機
3. 文字 content diff：mockup hardcoded 填充文字 vs production empty placeholder
4. mockup vp-frame__body clip 為 Section 裁切，production 為 fullPage screenshot — 高度 padding 差異大
5. 綜合 diff 3-25% 視為結構正確（content state mismatch 為主因）

---

_Report generated by `tests/visual/master-pixel-diff.spec.js`_