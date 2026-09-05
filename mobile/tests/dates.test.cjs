const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {execFileSync} = require('node:child_process');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname,'../dates.js'),'utf8').replace(/export /g,'');
test('civil dates use the device timezone near midnight and across months', () => {
  const script = `${source}; console.log(localDate(new Date('2026-10-01T01:30:00Z')));`;
  const result = execFileSync(process.execPath,['-e',script], {env:{...process.env,TZ:'America/Sao_Paulo'},encoding:'utf8'});
  assert.equal(result.trim(),'2026-09-30');
});
test('date and time validation rejects rollover and accepts leap days', () => {
  const f = vm.runInNewContext(`${source}; ({validDate,validTime});`);
  assert.equal(f.validDate('2026-02-30'),false);
  assert.equal(f.validDate('2024-02-29'),true);
  assert.equal(f.validDate('2026-13-01'),false);
  assert.equal(f.validTime('24:00'),false);
  assert.equal(f.validTime('23:59'),true);
});
