'use strict';
const fs = require('node:fs');
const path = require('node:path');
const {execFileSync} = require('node:child_process');
const root = execFileSync('git',['rev-parse','--show-toplevel'],{encoding:'utf8'}).trim();
const files = execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{cwd:root,encoding:'utf8'}).split('\0').filter(Boolean);
let failed = false;
for (const name of new Set(files)) {
  if (!fs.existsSync(path.join(root,name))) continue;
  const forbiddenName = /(^|\/)\.env(?:\.|$)/.test(name) && !name.endsWith('.example') || /\.(pem|key|p12|pfx|jks|keystore)$/.test(name);
  const data = fs.readFileSync(path.join(root,name));
  if (data.includes(0)) continue;
  const text = data.toString('utf8');
  const privateKey = /-----BEGIN (?:RSA |EC |OPENSSH |ENCRYPTED )?PRIVATE KEY-----/.test(text);
  const secretKey = /\bsb_secret_[A-Za-z0-9_-]{20,}/.test(text);
  const adminJwt = [...text.matchAll(/\beyJ[A-Za-z0-9_-]+\.([A-Za-z0-9_-]+)\.[A-Za-z0-9_-]+/g)].some(match => {
    try { return JSON.parse(Buffer.from(match[1],'base64url').toString()).role === 'service_role'; }
    catch { return false; }
  });
  if (forbiddenName || privateKey || secretKey || adminJwt) {
    console.error(`Possível segredo em ${name}; conteúdo omitido.`);
    failed = true;
  }
}
if (failed) process.exitCode = 1;
else console.log('Nenhum padrão de segredo detectado nos arquivos atuais.');
