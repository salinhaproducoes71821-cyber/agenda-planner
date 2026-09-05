'use strict';
const {isIP} = require('node:net');
// The pinned AWS Web Adapter overwrites this header with the invocation context.
// Trust it only inside Lambda and from the local adapter, never on a public Node server.
function lambdaClientIp(req, env = process.env) {
  const peer = req.socket.remoteAddress;
  if (!env.AWS_LAMBDA_FUNCTION_NAME || !['127.0.0.1','::1','::ffff:127.0.0.1'].includes(peer)) return req.ip;
  try {
    const context = JSON.parse(req.headers['x-amzn-request-context'] || '{}');
    const source = context.http?.sourceIp || context.identity?.sourceIp;
    if (typeof source === 'string' && isIP(source)) return source;
  } catch {}
  return peer;
}
module.exports = {lambdaClientIp};
