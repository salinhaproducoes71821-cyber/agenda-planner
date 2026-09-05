'use strict';
const {spawnSync} = require('node:child_process');
// Reassess these upstream advisories by 2026-10-05; no blanket severity exemption.
const accepted = new Map([
  ['https://github.com/advisories/GHSA-w5hq-g745-h8pq', 'uuid'],
  ['https://github.com/advisories/GHSA-w3rx-r6r6-pgpr', 'image-size'],
  ['https://github.com/advisories/GHSA-5p2g-fcmc-qvqq', 'image-size'],
]);
const result = spawnSync('npm', ['audit','--json','--ignore-scripts'], {encoding:'utf8',shell:process.platform === 'win32',maxBuffer:10*1024*1024});
if (result.error || ![0,1].includes(result.status)) throw new Error('npm audit não concluiu: ' + (result.error?.message || result.stderr));
const audit = JSON.parse(result.stdout);
if (!audit.metadata?.vulnerabilities || audit.error) throw new Error('Resposta de auditoria indisponível.');
let rejected = false;
const reported = new Set();
for (const value of Object.values(audit.vulnerabilities || {})) {
  for (const advisory of value.via.filter(v => typeof v === 'object')) {
    if (reported.has(advisory.url)) continue;
    reported.add(advisory.url);
    const allowed = accepted.get(advisory.url) === advisory.name && new Date() < new Date('2026-10-06T00:00:00Z');
    console.log(`${allowed ? 'TRIAGED' : 'REVIEW REQUIRED'} ${advisory.severity} ${advisory.name} ${advisory.url}`);
    if (!allowed) rejected = true;
  }
}
console.log(JSON.stringify(audit.metadata.vulnerabilities));
if (rejected) process.exitCode = 1;
