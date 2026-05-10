# Master Pixel-Diff Report — 16 Mockups Cross-Viewport (11 original + 5 new)

_Generated: 2026-05-10T05:23:58.990Z_

## Coverage

- Original 11 mockups (01/02/03/04/05/06/07/09/10/11/13): §A first-section baseline × 3 vp
- New 5 mockups (2026-05-09 extension): 02/08/12/14/16-D — all sections × 3 vp = 60 new cases
- Total new cases: 15+12+9+15+9 = 60

## 結果摘要

| Mockup | Mobile-360 | iPad-768 | Desktop-1280 |
|---|---|---|---|
| 01 home | 🔴 20.06% | 🟠 14.62% | 🟠 12.93% |
| 02 auth (§A login-default) | 🔴 15.42% | 🟠 11.20% | 🟠 9.17% |
| 03 phase1 form | 🟠 7.04% | 🟡 3.27% | 🟡 3.59% |
| 04 gate | 🟠 9.40% | 🟠 5.31% | 🟡 3.49% |
| 05 phase2 chat | 🟠 5.59% | 🟡 3.49% | 🟡 2.59% |
| 06 nsm step1 | 🟠 13.41% | 🟠 5.20% | 🟡 3.37% |
| 07 nsm step2 | 🟠 8.05% | 🟡 4.75% | 🟡 2.86% |
| 09 offcanvas | 🟠 12.06% | 🟠 9.95% | 🟠 9.83% |
| 10 onboarding | 🟠 13.77% | 🟠 10.20% | 🟠 8.88% |
| 11 phase3 score | 🟠 8.42% | 🟠 6.26% | 🟡 4.74% |
| 13 phase4 final | 🟠 13.88% | 🟠 9.39% | 🟠 8.96% |
| 02 auth §A login-default | 🟡 4.29% | 🟡 3.14% | 🟡 1.92% |
| 02 auth §B login-filled | 🟠 10.78% | 🟠 5.37% | 🟡 2.73% |
| 02 auth §C login-error | 🟠 14.85% | 🟠 9.25% | 🟡 3.80% |
| 02 auth §D register | 🟠 6.58% | 🟠 9.10% | 🟡 3.56% |
| 02 auth §E token-expiry | 🟠 10.36% | 🟠 6.39% | 🟡 4.39% |
| 08 nsm-gate §A ok | 🟠 9.01% | 🟠 5.03% | 🟡 2.71% |
| 08 nsm-gate §B warn | 🟠 10.37% | 🟠 6.26% | 🟡 3.55% |
| 08 nsm-gate §C error | 🟠 11.32% | 🟠 7.13% | 🟡 3.72% |
| 08 nsm-gate §D loading | 🟡 1.25% | 🟡 0.70% | ✅ 0.45% |
| 12 phase3 §A loading-slow | 🟡 2.15% | 🟡 1.03% | 🟡 0.65% |
| 12 phase3 §B api-error | 🟡 1.07% | 🟡 0.66% | ✅ 0.48% |
| 12 phase3 §C parse-error | 🟡 2.73% | 🟡 1.49% | 🟡 1.00% |
| 14 nsm-step4 §A overview | 🟠 9.45% | 🟠 7.38% | 🟠 5.59% |
| 14 nsm-step4 §B comparison | 🟠 5.72% | 🟡 3.58% | 🟡 2.27% |
| 14 nsm-step4 §B' coach-expand | 🟠 6.71% | 🟠 8.36% | 🟠 5.70% |
| 14 nsm-step4 §C highlights | 🟠 10.11% | 🟡 3.21% | 🟡 2.38% |
| 14 nsm-step4 §D done | 🟠 6.29% | 🟡 3.22% | 🟡 2.11% |
| 16 resume §D circles-eval | 🟠 11.10% | 🟠 9.30% | 🟠 5.67% |
| 16 resume §D nsm-gate | 🟠 14.55% | 🟠 11.33% | 🟠 8.99% |
| 16 resume §D phase4-report | 🟠 11.40% | 🟠 9.12% | 🟠 5.55% |

## 詳細 verdict per case

### Mockup 01-home · mobile-360: 🔴 ≥ 15%

- mockup 358×1285 / production 360×1703 / padded 360×1703 / mismatched 122971px / **20.06%**
- mockup PNG: `tests/visual/diffs/master/01-home-mobile-360-mockup.png`
- production PNG: `tests/visual/diffs/master/01-home-mobile-360-production.png`
- diff PNG: `tests/visual/diffs/master/01-home-mobile-360-diff.png`

### Mockup 01-home · tablet-768: 🟠 < 15% (state diff 預期)

- mockup 766×1092 / production 768×1483 / padded 768×1483 / mismatched 166558px / **14.62%**
- mockup PNG: `tests/visual/diffs/master/01-home-tablet-768-mockup.png`
- production PNG: `tests/visual/diffs/master/01-home-tablet-768-production.png`
- diff PNG: `tests/visual/diffs/master/01-home-tablet-768-diff.png`

### Mockup 01-home · desktop-1280: 🟠 < 15% (state diff 預期)

- mockup 1278×1090 / production 1280×1503 / padded 1280×1503 / mismatched 248811px / **12.93%**
- mockup PNG: `tests/visual/diffs/master/01-home-desktop-1280-mockup.png`
- production PNG: `tests/visual/diffs/master/01-home-desktop-1280-production.png`
- diff PNG: `tests/visual/diffs/master/01-home-desktop-1280-diff.png`

### Mockup 02-auth · mobile-360: 🔴 ≥ 15%

- mockup 358×744 / production 360×1703 / padded 360×1703 / mismatched 94533px / **15.42%**
- mockup PNG: `tests/visual/diffs/master/02-auth-mobile-360-mockup.png`
- production PNG: `tests/visual/diffs/master/02-auth-mobile-360-production.png`
- diff PNG: `tests/visual/diffs/master/02-auth-mobile-360-diff.png`

### Mockup 02-auth · tablet-768: 🟠 < 15% (state diff 預期)

- mockup 766×648 / production 768×1483 / padded 768×1483 / mismatched 127558px / **11.20%**
- mockup PNG: `tests/visual/diffs/master/02-auth-tablet-768-mockup.png`
- production PNG: `tests/visual/diffs/master/02-auth-tablet-768-production.png`
- diff PNG: `tests/visual/diffs/master/02-auth-tablet-768-diff.png`

### Mockup 02-auth · desktop-1280: 🟠 < 15% (state diff 預期)

- mockup 1278×635 / production 1280×1503 / padded 1280×1503 / mismatched 176322px / **9.17%**
- mockup PNG: `tests/visual/diffs/master/02-auth-desktop-1280-mockup.png`
- production PNG: `tests/visual/diffs/master/02-auth-desktop-1280-production.png`
- diff PNG: `tests/visual/diffs/master/02-auth-desktop-1280-diff.png`

### Mockup 03-phase1 · mobile-360: 🟠 < 15% (state diff 預期)

- mockup 358×1585 / production 360×1700 / padded 360×1700 / mismatched 43068px / **7.04%**
- mockup PNG: `tests/visual/diffs/master/03-phase1-mobile-360-mockup.png`
- production PNG: `tests/visual/diffs/master/03-phase1-mobile-360-production.png`
- diff PNG: `tests/visual/diffs/master/03-phase1-mobile-360-diff.png`

### Mockup 03-phase1 · tablet-768: 🟡 < 5%

- mockup 766×1278 / production 768×1700 / padded 768×1700 / mismatched 42728px / **3.27%**
- mockup PNG: `tests/visual/diffs/master/03-phase1-tablet-768-mockup.png`
- production PNG: `tests/visual/diffs/master/03-phase1-tablet-768-production.png`
- diff PNG: `tests/visual/diffs/master/03-phase1-tablet-768-diff.png`

### Mockup 03-phase1 · desktop-1280: 🟡 < 5%

- mockup 1278×1529 / production 1280×1700 / padded 1280×1700 / mismatched 78098px / **3.59%**
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

- mockup 360×880 / production 360×900 / padded 360×900 / mismatched 18117px / **5.59%**
- mockup PNG: `tests/visual/diffs/master/05-phase2-mobile-360-mockup.png`
- production PNG: `tests/visual/diffs/master/05-phase2-mobile-360-production.png`
- diff PNG: `tests/visual/diffs/master/05-phase2-mobile-360-diff.png`

### Mockup 05-phase2 · tablet-768: 🟡 < 5%

- mockup 768×880 / production 768×900 / padded 768×900 / mismatched 24150px / **3.49%**
- mockup PNG: `tests/visual/diffs/master/05-phase2-tablet-768-mockup.png`
- production PNG: `tests/visual/diffs/master/05-phase2-tablet-768-production.png`
- diff PNG: `tests/visual/diffs/master/05-phase2-tablet-768-diff.png`

### Mockup 05-phase2 · desktop-1280: 🟡 < 5%

- mockup 1280×880 / production 1280×900 / padded 1280×900 / mismatched 29827px / **2.59%**
- mockup PNG: `tests/visual/diffs/master/05-phase2-desktop-1280-mockup.png`
- production PNG: `tests/visual/diffs/master/05-phase2-desktop-1280-production.png`
- diff PNG: `tests/visual/diffs/master/05-phase2-desktop-1280-diff.png`

### Mockup 06-nsm1 · mobile-360: 🟠 < 15% (state diff 預期)

- mockup 360×1068 / production 360×1052 / padded 360×1068 / mismatched 51574px / **13.41%**
- mockup PNG: `tests/visual/diffs/master/06-nsm1-mobile-360-mockup.png`
- production PNG: `tests/visual/diffs/master/06-nsm1-mobile-360-production.png`
- diff PNG: `tests/visual/diffs/master/06-nsm1-mobile-360-diff.png`

### Mockup 06-nsm1 · tablet-768: 🟠 < 15% (state diff 預期)

- mockup 768×880 / production 768×900 / padded 768×900 / mismatched 35924px / **5.20%**
- mockup PNG: `tests/visual/diffs/master/06-nsm1-tablet-768-mockup.png`
- production PNG: `tests/visual/diffs/master/06-nsm1-tablet-768-production.png`
- diff PNG: `tests/visual/diffs/master/06-nsm1-tablet-768-diff.png`

### Mockup 06-nsm1 · desktop-1280: 🟡 < 5%

- mockup 1280×880 / production 1280×900 / padded 1280×900 / mismatched 38806px / **3.37%**
- mockup PNG: `tests/visual/diffs/master/06-nsm1-desktop-1280-mockup.png`
- production PNG: `tests/visual/diffs/master/06-nsm1-desktop-1280-production.png`
- diff PNG: `tests/visual/diffs/master/06-nsm1-desktop-1280-diff.png`

### Mockup 07-nsm2 · mobile-360: 🟠 < 15% (state diff 預期)

- mockup 360×2473 / production 360×1352 / padded 360×2473 / mismatched 71647px / **8.05%**
- mockup PNG: `tests/visual/diffs/master/07-nsm2-mobile-360-mockup.png`
- production PNG: `tests/visual/diffs/master/07-nsm2-mobile-360-production.png`
- diff PNG: `tests/visual/diffs/master/07-nsm2-mobile-360-diff.png`

### Mockup 07-nsm2 · tablet-768: 🟡 < 5%

- mockup 768×2004 / production 768×1267 / padded 768×2004 / mismatched 73133px / **4.75%**
- mockup PNG: `tests/visual/diffs/master/07-nsm2-tablet-768-mockup.png`
- production PNG: `tests/visual/diffs/master/07-nsm2-tablet-768-production.png`
- diff PNG: `tests/visual/diffs/master/07-nsm2-tablet-768-diff.png`

### Mockup 07-nsm2 · desktop-1280: 🟡 < 5%

- mockup 1280×2004 / production 1280×1267 / padded 1280×2004 / mismatched 73483px / **2.86%**
- mockup PNG: `tests/visual/diffs/master/07-nsm2-desktop-1280-mockup.png`
- production PNG: `tests/visual/diffs/master/07-nsm2-desktop-1280-production.png`
- diff PNG: `tests/visual/diffs/master/07-nsm2-desktop-1280-diff.png`

### Mockup 09-offcanvas · mobile-360: 🟠 < 15% (state diff 預期)

- mockup 360×880 / production 360×1424 / padded 360×1424 / mismatched 61822px / **12.06%**
- mockup PNG: `tests/visual/diffs/master/09-offcanvas-mobile-360-mockup.png`
- production PNG: `tests/visual/diffs/master/09-offcanvas-mobile-360-production.png`
- diff PNG: `tests/visual/diffs/master/09-offcanvas-mobile-360-diff.png`

### Mockup 09-offcanvas · tablet-768: 🟠 < 15% (state diff 預期)

- mockup 768×880 / production 768×1228 / padded 768×1228 / mismatched 93846px / **9.95%**
- mockup PNG: `tests/visual/diffs/master/09-offcanvas-tablet-768-mockup.png`
- production PNG: `tests/visual/diffs/master/09-offcanvas-tablet-768-production.png`
- diff PNG: `tests/visual/diffs/master/09-offcanvas-tablet-768-diff.png`

### Mockup 09-offcanvas · desktop-1280: 🟠 < 15% (state diff 預期)

- mockup 1280×880 / production 1280×1248 / padded 1280×1248 / mismatched 157088px / **9.83%**
- mockup PNG: `tests/visual/diffs/master/09-offcanvas-desktop-1280-mockup.png`
- production PNG: `tests/visual/diffs/master/09-offcanvas-desktop-1280-production.png`
- diff PNG: `tests/visual/diffs/master/09-offcanvas-desktop-1280-diff.png`

### Mockup 10-onboarding · mobile-360: 🟠 < 15% (state diff 預期)

- mockup 360×880 / production 360×1718 / padded 360×1718 / mismatched 85138px / **13.77%**
- mockup PNG: `tests/visual/diffs/master/10-onboarding-mobile-360-mockup.png`
- production PNG: `tests/visual/diffs/master/10-onboarding-mobile-360-production.png`
- diff PNG: `tests/visual/diffs/master/10-onboarding-mobile-360-diff.png`

### Mockup 10-onboarding · tablet-768: 🟠 < 15% (state diff 預期)

- mockup 768×880 / production 768×1483 / padded 768×1483 / mismatched 116173px / **10.20%**
- mockup PNG: `tests/visual/diffs/master/10-onboarding-tablet-768-mockup.png`
- production PNG: `tests/visual/diffs/master/10-onboarding-tablet-768-production.png`
- diff PNG: `tests/visual/diffs/master/10-onboarding-tablet-768-diff.png`

### Mockup 10-onboarding · desktop-1280: 🟠 < 15% (state diff 預期)

- mockup 1280×880 / production 1280×1503 / padded 1280×1503 / mismatched 170837px / **8.88%**
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

- mockup 358×744 / production 360×900 / padded 360×900 / mismatched 13914px / **4.29%**
- mockup PNG: `tests/visual/diffs/master/02-auth-ext-A-login-default-mobile-360-mockup.png`
- production PNG: `tests/visual/diffs/master/02-auth-ext-A-login-default-mobile-360-production.png`
- diff PNG: `tests/visual/diffs/master/02-auth-ext-A-login-default-mobile-360-diff.png`

### Mockup 02-auth-ext-A-login-default · tablet-768: 🟡 < 5%

- mockup 766×744 / production 768×900 / padded 768×900 / mismatched 21707px / **3.14%**
- mockup PNG: `tests/visual/diffs/master/02-auth-ext-A-login-default-tablet-768-mockup.png`
- production PNG: `tests/visual/diffs/master/02-auth-ext-A-login-default-tablet-768-production.png`
- diff PNG: `tests/visual/diffs/master/02-auth-ext-A-login-default-tablet-768-diff.png`

### Mockup 02-auth-ext-A-login-default · desktop-1280: 🟡 < 5%

- mockup 1278×744 / production 1280×900 / padded 1280×900 / mismatched 22130px / **1.92%**
- mockup PNG: `tests/visual/diffs/master/02-auth-ext-A-login-default-desktop-1280-mockup.png`
- production PNG: `tests/visual/diffs/master/02-auth-ext-A-login-default-desktop-1280-production.png`
- diff PNG: `tests/visual/diffs/master/02-auth-ext-A-login-default-desktop-1280-diff.png`

### Mockup 02-auth-ext-B-login-filled · mobile-360: 🟠 < 15% (state diff 預期)

- mockup 358×627 / production 360×900 / padded 360×900 / mismatched 34936px / **10.78%**
- mockup PNG: `tests/visual/diffs/master/02-auth-ext-B-login-filled-mobile-360-mockup.png`
- production PNG: `tests/visual/diffs/master/02-auth-ext-B-login-filled-mobile-360-production.png`
- diff PNG: `tests/visual/diffs/master/02-auth-ext-B-login-filled-mobile-360-diff.png`

### Mockup 02-auth-ext-B-login-filled · tablet-768: 🟠 < 15% (state diff 預期)

- mockup 766×648 / production 768×900 / padded 768×900 / mismatched 37114px / **5.37%**
- mockup PNG: `tests/visual/diffs/master/02-auth-ext-B-login-filled-tablet-768-mockup.png`
- production PNG: `tests/visual/diffs/master/02-auth-ext-B-login-filled-tablet-768-production.png`
- diff PNG: `tests/visual/diffs/master/02-auth-ext-B-login-filled-tablet-768-diff.png`

### Mockup 02-auth-ext-B-login-filled · desktop-1280: 🟡 < 5%

- mockup 1278×635 / production 1280×900 / padded 1280×900 / mismatched 31396px / **2.73%**
- mockup PNG: `tests/visual/diffs/master/02-auth-ext-B-login-filled-desktop-1280-mockup.png`
- production PNG: `tests/visual/diffs/master/02-auth-ext-B-login-filled-desktop-1280-production.png`
- diff PNG: `tests/visual/diffs/master/02-auth-ext-B-login-filled-desktop-1280-diff.png`

### Mockup 02-auth-ext-C-login-error · mobile-360: 🟠 < 15% (state diff 預期)

- mockup 358×720 / production 360×900 / padded 360×900 / mismatched 48115px / **14.85%**
- mockup PNG: `tests/visual/diffs/master/02-auth-ext-C-login-error-mobile-360-mockup.png`
- production PNG: `tests/visual/diffs/master/02-auth-ext-C-login-error-mobile-360-production.png`
- diff PNG: `tests/visual/diffs/master/02-auth-ext-C-login-error-mobile-360-diff.png`

### Mockup 02-auth-ext-C-login-error · tablet-768: 🟠 < 15% (state diff 預期)

- mockup 766×730 / production 768×900 / padded 768×900 / mismatched 63951px / **9.25%**
- mockup PNG: `tests/visual/diffs/master/02-auth-ext-C-login-error-tablet-768-mockup.png`
- production PNG: `tests/visual/diffs/master/02-auth-ext-C-login-error-tablet-768-production.png`
- diff PNG: `tests/visual/diffs/master/02-auth-ext-C-login-error-tablet-768-diff.png`

### Mockup 02-auth-ext-C-login-error · desktop-1280: 🟡 < 5%

- mockup 1278×802 / production 1280×900 / padded 1280×900 / mismatched 43728px / **3.80%**
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

- mockup 358×474 / production 360×940 / padded 360×940 / mismatched 35068px / **10.36%**
- mockup PNG: `tests/visual/diffs/master/02-auth-ext-E-token-expiry-mobile-360-mockup.png`
- production PNG: `tests/visual/diffs/master/02-auth-ext-E-token-expiry-mobile-360-production.png`
- diff PNG: `tests/visual/diffs/master/02-auth-ext-E-token-expiry-mobile-360-diff.png`

### Mockup 02-auth-ext-E-token-expiry · tablet-768: 🟠 < 15% (state diff 預期)

- mockup 766×352 / production 768×900 / padded 768×900 / mismatched 44142px / **6.39%**
- mockup PNG: `tests/visual/diffs/master/02-auth-ext-E-token-expiry-tablet-768-mockup.png`
- production PNG: `tests/visual/diffs/master/02-auth-ext-E-token-expiry-tablet-768-production.png`
- diff PNG: `tests/visual/diffs/master/02-auth-ext-E-token-expiry-tablet-768-diff.png`

### Mockup 02-auth-ext-E-token-expiry · desktop-1280: 🟡 < 5%

- mockup 1278×554 / production 1280×900 / padded 1280×900 / mismatched 50584px / **4.39%**
- mockup PNG: `tests/visual/diffs/master/02-auth-ext-E-token-expiry-desktop-1280-mockup.png`
- production PNG: `tests/visual/diffs/master/02-auth-ext-E-token-expiry-desktop-1280-production.png`
- diff PNG: `tests/visual/diffs/master/02-auth-ext-E-token-expiry-desktop-1280-diff.png`

### Mockup 08-nsm-gate-A-ok · mobile-360: 🟠 < 15% (state diff 預期)

- mockup 360×1388 / production 360×1100 / padded 360×1388 / mismatched 45008px / **9.01%**
- mockup PNG: `tests/visual/diffs/master/08-nsm-gate-A-ok-mobile-360-mockup.png`
- production PNG: `tests/visual/diffs/master/08-nsm-gate-A-ok-mobile-360-production.png`
- diff PNG: `tests/visual/diffs/master/08-nsm-gate-A-ok-mobile-360-diff.png`

### Mockup 08-nsm-gate-A-ok · tablet-768: 🟠 < 15% (state diff 預期)

- mockup 768×1224 / production 768×1100 / padded 768×1224 / mismatched 47243px / **5.03%**
- mockup PNG: `tests/visual/diffs/master/08-nsm-gate-A-ok-tablet-768-mockup.png`
- production PNG: `tests/visual/diffs/master/08-nsm-gate-A-ok-tablet-768-production.png`
- diff PNG: `tests/visual/diffs/master/08-nsm-gate-A-ok-tablet-768-diff.png`

### Mockup 08-nsm-gate-A-ok · desktop-1280: 🟡 < 5%

- mockup 1280×1224 / production 1280×1100 / padded 1280×1224 / mismatched 42391px / **2.71%**
- mockup PNG: `tests/visual/diffs/master/08-nsm-gate-A-ok-desktop-1280-mockup.png`
- production PNG: `tests/visual/diffs/master/08-nsm-gate-A-ok-desktop-1280-production.png`
- diff PNG: `tests/visual/diffs/master/08-nsm-gate-A-ok-desktop-1280-diff.png`

### Mockup 08-nsm-gate-B-warn · mobile-360: 🟠 < 15% (state diff 預期)

- mockup 360×1494 / production 360×1100 / padded 360×1494 / mismatched 55767px / **10.37%**
- mockup PNG: `tests/visual/diffs/master/08-nsm-gate-B-warn-mobile-360-mockup.png`
- production PNG: `tests/visual/diffs/master/08-nsm-gate-B-warn-mobile-360-production.png`
- diff PNG: `tests/visual/diffs/master/08-nsm-gate-B-warn-mobile-360-diff.png`

### Mockup 08-nsm-gate-B-warn · tablet-768: 🟠 < 15% (state diff 預期)

- mockup 768×1214 / production 768×1100 / padded 768×1214 / mismatched 58379px / **6.26%**
- mockup PNG: `tests/visual/diffs/master/08-nsm-gate-B-warn-tablet-768-mockup.png`
- production PNG: `tests/visual/diffs/master/08-nsm-gate-B-warn-tablet-768-production.png`
- diff PNG: `tests/visual/diffs/master/08-nsm-gate-B-warn-tablet-768-diff.png`

### Mockup 08-nsm-gate-B-warn · desktop-1280: 🟡 < 5%

- mockup 1280×1190 / production 1280×1100 / padded 1280×1190 / mismatched 54079px / **3.55%**
- mockup PNG: `tests/visual/diffs/master/08-nsm-gate-B-warn-desktop-1280-mockup.png`
- production PNG: `tests/visual/diffs/master/08-nsm-gate-B-warn-desktop-1280-production.png`
- diff PNG: `tests/visual/diffs/master/08-nsm-gate-B-warn-desktop-1280-diff.png`

### Mockup 08-nsm-gate-C-error · mobile-360: 🟠 < 15% (state diff 預期)

- mockup 360×1605 / production 360×1126 / padded 360×1605 / mismatched 65395px / **11.32%**
- mockup PNG: `tests/visual/diffs/master/08-nsm-gate-C-error-mobile-360-mockup.png`
- production PNG: `tests/visual/diffs/master/08-nsm-gate-C-error-mobile-360-production.png`
- diff PNG: `tests/visual/diffs/master/08-nsm-gate-C-error-mobile-360-diff.png`

### Mockup 08-nsm-gate-C-error · tablet-768: 🟠 < 15% (state diff 預期)

- mockup 768×1323 / production 768×1100 / padded 768×1323 / mismatched 72410px / **7.13%**
- mockup PNG: `tests/visual/diffs/master/08-nsm-gate-C-error-tablet-768-mockup.png`
- production PNG: `tests/visual/diffs/master/08-nsm-gate-C-error-tablet-768-production.png`
- diff PNG: `tests/visual/diffs/master/08-nsm-gate-C-error-tablet-768-diff.png`

### Mockup 08-nsm-gate-C-error · desktop-1280: 🟡 < 5%

- mockup 1280×1300 / production 1280×1100 / padded 1280×1300 / mismatched 61984px / **3.72%**
- mockup PNG: `tests/visual/diffs/master/08-nsm-gate-C-error-desktop-1280-mockup.png`
- production PNG: `tests/visual/diffs/master/08-nsm-gate-C-error-desktop-1280-production.png`
- diff PNG: `tests/visual/diffs/master/08-nsm-gate-C-error-desktop-1280-diff.png`

### Mockup 08-nsm-gate-D-loading · mobile-360: 🟡 < 5%

- mockup 360×1100 / production 360×1100 / padded 360×1100 / mismatched 4944px / **1.25%**
- mockup PNG: `tests/visual/diffs/master/08-nsm-gate-D-loading-mobile-360-mockup.png`
- production PNG: `tests/visual/diffs/master/08-nsm-gate-D-loading-mobile-360-production.png`
- diff PNG: `tests/visual/diffs/master/08-nsm-gate-D-loading-mobile-360-diff.png`

### Mockup 08-nsm-gate-D-loading · tablet-768: 🟡 < 5%

- mockup 768×1100 / production 768×1100 / padded 768×1100 / mismatched 5898px / **0.70%**
- mockup PNG: `tests/visual/diffs/master/08-nsm-gate-D-loading-tablet-768-mockup.png`
- production PNG: `tests/visual/diffs/master/08-nsm-gate-D-loading-tablet-768-production.png`
- diff PNG: `tests/visual/diffs/master/08-nsm-gate-D-loading-tablet-768-diff.png`

### Mockup 08-nsm-gate-D-loading · desktop-1280: ✅ < 0.5%

- mockup 1280×1100 / production 1280×1100 / padded 1280×1100 / mismatched 6341px / **0.45%**
- mockup PNG: `tests/visual/diffs/master/08-nsm-gate-D-loading-desktop-1280-mockup.png`
- production PNG: `tests/visual/diffs/master/08-nsm-gate-D-loading-desktop-1280-production.png`
- diff PNG: `tests/visual/diffs/master/08-nsm-gate-D-loading-desktop-1280-diff.png`

### Mockup 12-phase3-A-loading-slow · mobile-360: 🟡 < 5%

- mockup 360×880 / production 360×880 / padded 360×880 / mismatched 6813px / **2.15%**
- mockup PNG: `tests/visual/diffs/master/12-phase3-A-loading-slow-mobile-360-mockup.png`
- production PNG: `tests/visual/diffs/master/12-phase3-A-loading-slow-mobile-360-production.png`
- diff PNG: `tests/visual/diffs/master/12-phase3-A-loading-slow-mobile-360-diff.png`

### Mockup 12-phase3-A-loading-slow · tablet-768: 🟡 < 5%

- mockup 768×880 / production 768×880 / padded 768×880 / mismatched 6966px / **1.03%**
- mockup PNG: `tests/visual/diffs/master/12-phase3-A-loading-slow-tablet-768-mockup.png`
- production PNG: `tests/visual/diffs/master/12-phase3-A-loading-slow-tablet-768-production.png`
- diff PNG: `tests/visual/diffs/master/12-phase3-A-loading-slow-tablet-768-diff.png`

### Mockup 12-phase3-A-loading-slow · desktop-1280: 🟡 < 5%

- mockup 1280×880 / production 1280×880 / padded 1280×880 / mismatched 7274px / **0.65%**
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

- mockup 360×1388 / production 360×1295 / padded 360×1388 / mismatched 47210px / **9.45%**
- mockup PNG: `tests/visual/diffs/master/14-nsm-step4-A-overview-mobile-360-mockup.png`
- production PNG: `tests/visual/diffs/master/14-nsm-step4-A-overview-mobile-360-production.png`
- diff PNG: `tests/visual/diffs/master/14-nsm-step4-A-overview-mobile-360-diff.png`

### Mockup 14-nsm-step4-A-overview · tablet-768: 🟠 < 15% (state diff 預期)

- mockup 768×1324 / production 768×1260 / padded 768×1324 / mismatched 75067px / **7.38%**
- mockup PNG: `tests/visual/diffs/master/14-nsm-step4-A-overview-tablet-768-mockup.png`
- production PNG: `tests/visual/diffs/master/14-nsm-step4-A-overview-tablet-768-production.png`
- diff PNG: `tests/visual/diffs/master/14-nsm-step4-A-overview-tablet-768-diff.png`

### Mockup 14-nsm-step4-A-overview · desktop-1280: 🟠 < 15% (state diff 預期)

- mockup 1280×1100 / production 1280×1100 / padded 1280×1100 / mismatched 78692px / **5.59%**
- mockup PNG: `tests/visual/diffs/master/14-nsm-step4-A-overview-desktop-1280-mockup.png`
- production PNG: `tests/visual/diffs/master/14-nsm-step4-A-overview-desktop-1280-production.png`
- diff PNG: `tests/visual/diffs/master/14-nsm-step4-A-overview-desktop-1280-diff.png`

### Mockup 14-nsm-step4-B-comparison · mobile-360: 🟠 < 15% (state diff 預期)

- mockup 360×1498 / production 360×1444 / padded 360×1498 / mismatched 30853px / **5.72%**
- mockup PNG: `tests/visual/diffs/master/14-nsm-step4-B-comparison-mobile-360-mockup.png`
- production PNG: `tests/visual/diffs/master/14-nsm-step4-B-comparison-mobile-360-production.png`
- diff PNG: `tests/visual/diffs/master/14-nsm-step4-B-comparison-mobile-360-diff.png`

### Mockup 14-nsm-step4-B-comparison · tablet-768: 🟡 < 5%

- mockup 768×1100 / production 768×1100 / padded 768×1100 / mismatched 30263px / **3.58%**
- mockup PNG: `tests/visual/diffs/master/14-nsm-step4-B-comparison-tablet-768-mockup.png`
- production PNG: `tests/visual/diffs/master/14-nsm-step4-B-comparison-tablet-768-production.png`
- diff PNG: `tests/visual/diffs/master/14-nsm-step4-B-comparison-tablet-768-diff.png`

### Mockup 14-nsm-step4-B-comparison · desktop-1280: 🟡 < 5%

- mockup 1280×1100 / production 1280×1100 / padded 1280×1100 / mismatched 31942px / **2.27%**
- mockup PNG: `tests/visual/diffs/master/14-nsm-step4-B-comparison-desktop-1280-mockup.png`
- production PNG: `tests/visual/diffs/master/14-nsm-step4-B-comparison-desktop-1280-production.png`
- diff PNG: `tests/visual/diffs/master/14-nsm-step4-B-comparison-desktop-1280-diff.png`

### Mockup 14-nsm-step4-Bprime-coach-expand · mobile-360: 🟠 < 15% (state diff 預期)

- mockup 360×1183 / production 360×1715 / padded 360×1715 / mismatched 41401px / **6.71%**
- mockup PNG: `tests/visual/diffs/master/14-nsm-step4-Bprime-coach-expand-mobile-360-mockup.png`
- production PNG: `tests/visual/diffs/master/14-nsm-step4-Bprime-coach-expand-mobile-360-production.png`
- diff PNG: `tests/visual/diffs/master/14-nsm-step4-Bprime-coach-expand-mobile-360-diff.png`

### Mockup 14-nsm-step4-Bprime-coach-expand · tablet-768: 🟠 < 15% (state diff 預期)

- mockup 768×1100 / production 768×1100 / padded 768×1100 / mismatched 70635px / **8.36%**
- mockup PNG: `tests/visual/diffs/master/14-nsm-step4-Bprime-coach-expand-tablet-768-mockup.png`
- production PNG: `tests/visual/diffs/master/14-nsm-step4-Bprime-coach-expand-tablet-768-production.png`
- diff PNG: `tests/visual/diffs/master/14-nsm-step4-Bprime-coach-expand-tablet-768-diff.png`

### Mockup 14-nsm-step4-Bprime-coach-expand · desktop-1280: 🟠 < 15% (state diff 預期)

- mockup 1280×1100 / production 1280×1100 / padded 1280×1100 / mismatched 80297px / **5.70%**
- mockup PNG: `tests/visual/diffs/master/14-nsm-step4-Bprime-coach-expand-desktop-1280-mockup.png`
- production PNG: `tests/visual/diffs/master/14-nsm-step4-Bprime-coach-expand-desktop-1280-production.png`
- diff PNG: `tests/visual/diffs/master/14-nsm-step4-Bprime-coach-expand-desktop-1280-diff.png`

### Mockup 14-nsm-step4-C-highlights · mobile-360: 🟠 < 15% (state diff 預期)

- mockup 360×1100 / production 360×1100 / padded 360×1100 / mismatched 40041px / **10.11%**
- mockup PNG: `tests/visual/diffs/master/14-nsm-step4-C-highlights-mobile-360-mockup.png`
- production PNG: `tests/visual/diffs/master/14-nsm-step4-C-highlights-mobile-360-production.png`
- diff PNG: `tests/visual/diffs/master/14-nsm-step4-C-highlights-mobile-360-diff.png`

### Mockup 14-nsm-step4-C-highlights · tablet-768: 🟡 < 5%

- mockup 768×1100 / production 768×1100 / padded 768×1100 / mismatched 27126px / **3.21%**
- mockup PNG: `tests/visual/diffs/master/14-nsm-step4-C-highlights-tablet-768-mockup.png`
- production PNG: `tests/visual/diffs/master/14-nsm-step4-C-highlights-tablet-768-production.png`
- diff PNG: `tests/visual/diffs/master/14-nsm-step4-C-highlights-tablet-768-diff.png`

### Mockup 14-nsm-step4-C-highlights · desktop-1280: 🟡 < 5%

- mockup 1280×1100 / production 1280×1100 / padded 1280×1100 / mismatched 33445px / **2.38%**
- mockup PNG: `tests/visual/diffs/master/14-nsm-step4-C-highlights-desktop-1280-mockup.png`
- production PNG: `tests/visual/diffs/master/14-nsm-step4-C-highlights-desktop-1280-production.png`
- diff PNG: `tests/visual/diffs/master/14-nsm-step4-C-highlights-desktop-1280-diff.png`

### Mockup 14-nsm-step4-D-done · mobile-360: 🟠 < 15% (state diff 預期)

- mockup 360×1100 / production 360×1100 / padded 360×1100 / mismatched 24917px / **6.29%**
- mockup PNG: `tests/visual/diffs/master/14-nsm-step4-D-done-mobile-360-mockup.png`
- production PNG: `tests/visual/diffs/master/14-nsm-step4-D-done-mobile-360-production.png`
- diff PNG: `tests/visual/diffs/master/14-nsm-step4-D-done-mobile-360-diff.png`

### Mockup 14-nsm-step4-D-done · tablet-768: 🟡 < 5%

- mockup 768×1100 / production 768×1100 / padded 768×1100 / mismatched 27162px / **3.22%**
- mockup PNG: `tests/visual/diffs/master/14-nsm-step4-D-done-tablet-768-mockup.png`
- production PNG: `tests/visual/diffs/master/14-nsm-step4-D-done-tablet-768-production.png`
- diff PNG: `tests/visual/diffs/master/14-nsm-step4-D-done-tablet-768-diff.png`

### Mockup 14-nsm-step4-D-done · desktop-1280: 🟡 < 5%

- mockup 1280×1100 / production 1280×1100 / padded 1280×1100 / mismatched 29727px / **2.11%**
- mockup PNG: `tests/visual/diffs/master/14-nsm-step4-D-done-desktop-1280-mockup.png`
- production PNG: `tests/visual/diffs/master/14-nsm-step4-D-done-desktop-1280-production.png`
- diff PNG: `tests/visual/diffs/master/14-nsm-step4-D-done-desktop-1280-diff.png`

### Mockup 16-resume-D-circles-eval · mobile-360: 🟠 < 15% (state diff 預期)

- mockup 360×700 / production 360×1223 / padded 360×1223 / mismatched 48870px / **11.10%**
- mockup PNG: `tests/visual/diffs/master/16-resume-D-circles-eval-mobile-360-mockup.png`
- production PNG: `tests/visual/diffs/master/16-resume-D-circles-eval-mobile-360-production.png`
- diff PNG: `tests/visual/diffs/master/16-resume-D-circles-eval-mobile-360-diff.png`

### Mockup 16-resume-D-circles-eval · tablet-768: 🟠 < 15% (state diff 預期)

- mockup 768×700 / production 768×888 / padded 768×888 / mismatched 63391px / **9.30%**
- mockup PNG: `tests/visual/diffs/master/16-resume-D-circles-eval-tablet-768-mockup.png`
- production PNG: `tests/visual/diffs/master/16-resume-D-circles-eval-tablet-768-production.png`
- diff PNG: `tests/visual/diffs/master/16-resume-D-circles-eval-tablet-768-diff.png`

### Mockup 16-resume-D-circles-eval · desktop-1280: 🟠 < 15% (state diff 預期)

- mockup 1215×700 / production 1280×934 / padded 1280×934 / mismatched 67761px / **5.67%**
- mockup PNG: `tests/visual/diffs/master/16-resume-D-circles-eval-desktop-1280-mockup.png`
- production PNG: `tests/visual/diffs/master/16-resume-D-circles-eval-desktop-1280-production.png`
- diff PNG: `tests/visual/diffs/master/16-resume-D-circles-eval-desktop-1280-diff.png`

### Mockup 16-resume-D-nsm-gate · mobile-360: 🟠 < 15% (state diff 預期)

- mockup 360×700 / production 360×1779 / padded 360×1779 / mismatched 93191px / **14.55%**
- mockup PNG: `tests/visual/diffs/master/16-resume-D-nsm-gate-mobile-360-mockup.png`
- production PNG: `tests/visual/diffs/master/16-resume-D-nsm-gate-mobile-360-production.png`
- diff PNG: `tests/visual/diffs/master/16-resume-D-nsm-gate-mobile-360-diff.png`

### Mockup 16-resume-D-nsm-gate · tablet-768: 🟠 < 15% (state diff 預期)

- mockup 768×700 / production 768×1540 / padded 768×1540 / mismatched 134027px / **11.33%**
- mockup PNG: `tests/visual/diffs/master/16-resume-D-nsm-gate-tablet-768-mockup.png`
- production PNG: `tests/visual/diffs/master/16-resume-D-nsm-gate-tablet-768-production.png`
- diff PNG: `tests/visual/diffs/master/16-resume-D-nsm-gate-tablet-768-diff.png`

### Mockup 16-resume-D-nsm-gate · desktop-1280: 🟠 < 15% (state diff 預期)

- mockup 1215×700 / production 1280×1560 / padded 1280×1560 / mismatched 179524px / **8.99%**
- mockup PNG: `tests/visual/diffs/master/16-resume-D-nsm-gate-desktop-1280-mockup.png`
- production PNG: `tests/visual/diffs/master/16-resume-D-nsm-gate-desktop-1280-production.png`
- diff PNG: `tests/visual/diffs/master/16-resume-D-nsm-gate-desktop-1280-diff.png`

### Mockup 16-resume-D-phase4-report · mobile-360: 🟠 < 15% (state diff 預期)

- mockup 360×700 / production 360×1156 / padded 360×1156 / mismatched 47455px / **11.40%**
- mockup PNG: `tests/visual/diffs/master/16-resume-D-phase4-report-mobile-360-mockup.png`
- production PNG: `tests/visual/diffs/master/16-resume-D-phase4-report-mobile-360-production.png`
- diff PNG: `tests/visual/diffs/master/16-resume-D-phase4-report-mobile-360-diff.png`

### Mockup 16-resume-D-phase4-report · tablet-768: 🟠 < 15% (state diff 預期)

- mockup 768×700 / production 768×912 / padded 768×912 / mismatched 63903px / **9.12%**
- mockup PNG: `tests/visual/diffs/master/16-resume-D-phase4-report-tablet-768-mockup.png`
- production PNG: `tests/visual/diffs/master/16-resume-D-phase4-report-tablet-768-production.png`
- diff PNG: `tests/visual/diffs/master/16-resume-D-phase4-report-tablet-768-diff.png`

### Mockup 16-resume-D-phase4-report · desktop-1280: 🟠 < 15% (state diff 預期)

- mockup 1215×700 / production 1280×934 / padded 1280×934 / mismatched 66395px / **5.55%**
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