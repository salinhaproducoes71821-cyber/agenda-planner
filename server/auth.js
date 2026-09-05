'use strict';
const crypto = require('node:crypto');
const jwt = require('jsonwebtoken');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function createAuthenticator(env = process.env, fetchKeys = fetch) {
  const secret = env.SUPABASE_JWT_SECRET || '';
  const url = (env.SUPABASE_URL || '').replace(/\/+$/, '');
  if (!url || new URL(url).protocol !== 'https:' || /SEU_PROJETO/i.test(url)) {
    throw new Error('Configure SUPABASE_URL com a URL HTTPS do projeto.');
  }
  if (secret && (secret.length < 32 || /COLE_AQUI|CHANGE_ME|YOUR_SECRET/i.test(secret))) {
    throw new Error('SUPABASE_JWT_SECRET inválido; deixe vazio para usar somente JWKS.');
  }
  let keys = [], fetchedAt = 0, attemptedAt = -Infinity, pending;
  async function publicKey(kid) {
    if (typeof kid !== 'string' || !kid || kid.length > 200) throw new Error('kid inválido');
    const now = Date.now();
    let key = now - fetchedAt < 600000 && keys.find(k => k.kid === kid);
    if (key) return crypto.createPublicKey({ key, format: 'jwk' });
    if (!pending && now - attemptedAt >= 30000) {
      attemptedAt = now;
      pending = (async () => {
        const response = await fetchKeys(`${url}/auth/v1/.well-known/jwks.json`, { signal: AbortSignal.timeout(5000), redirect: 'error' });
        if (!response.ok) throw new Error('JWKS indisponível');
        const reader = response.body.getReader();
        let size = 0; const chunks = [];
        try {
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            size += value.length;
            if (size > 65536) throw new Error('JWKS excede limite');
            chunks.push(Buffer.from(value));
          }
        } finally { await reader.cancel(); }
        const data = JSON.parse(Buffer.concat(chunks).toString());
        if (!Array.isArray(data.keys) || data.keys.length > 20) throw new Error('JWKS inválido');
        keys = data.keys; fetchedAt = Date.now();
      })().finally(() => { pending = null; });
    }
    if (pending) await pending;
    key = keys.find(k => k.kid === kid);
    if (!key || Date.now() - fetchedAt >= 600000) throw new Error('Chave desconhecida');
    return crypto.createPublicKey({ key, format: 'jwk' });
  }
  return async (req, res, next) => {
    try {
      const authorization = req.headers.authorization || '';
      if (!authorization.startsWith('Bearer ') || authorization.length > 16384) throw new Error('Token ausente');
      const token = authorization.slice(7);
      const decoded = jwt.decode(token, { complete: true });
      const alg = decoded?.header?.alg;
      let key;
      if (alg === 'HS256' && secret) key = secret;
      else if (alg === 'RS256' || alg === 'ES256') key = await publicKey(decoded.header.kid);
      else throw new Error('Algoritmo inválido');
      const payload = jwt.verify(token, key, { algorithms: [alg], audience: 'authenticated', issuer: `${url}/auth/v1` });
      if (!UUID.test(payload.sub || '') || !Number.isInteger(payload.exp)) throw new Error('Claims inválidos');
      req.userId = payload.sub;
      req.userEmail = typeof payload.email === 'string' ? payload.email.slice(0, 255) : '';
      req.userName = typeof payload.user_metadata?.name === 'string' ? payload.user_metadata.name.trim().slice(0, 80) : '';
      next();
    } catch {
      res.status(401).json({ error: 'Sessão inválida ou expirada. Faça login novamente.' });
    }
  };
}
module.exports = { createAuthenticator };
