// Per-viewport probe for step L (提出方案) — Desktop-1280
// Run: node audit/cycles/2026-04-30/probes/step-l-Desktop-1280.js
const { run } = require('./step-l-shared');
const VP = { name: 'Desktop-1280', width: 0, height: 0, isMobile: false };
const map = {
  'Mobile-360':    { name: 'Mobile-360',    width: 360,  height: 780,  isMobile: true },
  'iPhone-SE':     { name: 'iPhone-SE',     width: 375,  height: 667,  isMobile: true },
  'iPhone-14':     { name: 'iPhone-14',     width: 390,  height: 844,  isMobile: true },
  'iPhone-15-Pro': { name: 'iPhone-15-Pro', width: 430,  height: 932,  isMobile: true },
  'iPad':          { name: 'iPad',          width: 768,  height: 1024, isMobile: true },
  'Desktop-1280':  { name: 'Desktop-1280',  width: 1280, height: 800,  isMobile: false },
  'Desktop-1440':  { name: 'Desktop-1440',  width: 1440, height: 900,  isMobile: false },
  'Desktop-2560':  { name: 'Desktop-2560',  width: 2560, height: 1440, isMobile: false },
};
run(map['Desktop-1280']).then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1);});
