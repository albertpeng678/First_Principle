// Test that db/client.js is a true singleton
const db1 = require('./db/client.js');
const db2 = require('./db/client.js');

console.log('First require:', typeof db1);
console.log('Second require:', typeof db2);
console.log('Same instance?', db1 === db2);
console.log('Has from method?', typeof db1.from === 'function');
console.log('Has auth property?', typeof db1.auth === 'object');
