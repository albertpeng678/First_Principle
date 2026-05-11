// lib/question-bank.js
// Loads CIRCLES + NSM question banks at module init, exposes byId lookup.
// Module-level cache; one disk read per process.

const fs = require('fs');
const path = require('path');

let _circlesBank = null;
let _nsmBank = null;

function loadCirclesBank() {
  if (_circlesBank) return _circlesBank;
  const file = path.join(__dirname, '..', 'circles_plan', 'circles_database.json');
  const arr = JSON.parse(fs.readFileSync(file, 'utf8'));
  _circlesBank = {};
  for (const q of arr) _circlesBank[q.id] = q;
  return _circlesBank;
}

function loadNsmBank() {
  if (_nsmBank) return _nsmBank;
  const file = path.join(__dirname, '..', 'nsm_plan', 'nsm_database.json');
  const arr = JSON.parse(fs.readFileSync(file, 'utf8'));
  _nsmBank = {};
  for (const q of arr) _nsmBank[q.id] = q;
  return _nsmBank;
}

function circlesById(id) {
  const bank = loadCirclesBank();
  return bank[id] || null;
}

function nsmById(id) {
  const bank = loadNsmBank();
  return bank[id] || null;
}

module.exports = { circlesById, nsmById };
