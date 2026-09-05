const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname,'../api-url.js'),'utf8').replace(/export /g,'');
const normalize = vm.runInNewContext(`${source}; normalizeHttpsBase`,{URL});
test('Lambda Function URL trailing slash does not create double-slash API routes', () => {
  assert.equal(normalize('https://example.lambda-url.us-east-1.on.aws/')+'/api/events','https://example.lambda-url.us-east-1.on.aws/api/events');
});
test('host configuration rejects HTTP, credentials, queries and fragments', () => {
  for (const value of ['http://example.com','https://user:pass@example.com','https://example.com?token=abc','https://example.com/#fragment']) assert.throws(()=>normalize(value));
});
test('existing HTTPS host remains valid', () => {
  assert.equal(normalize('https://agenda-planner-production-392f.up.railway.app'),'https://agenda-planner-production-392f.up.railway.app');
});
