const {createAuthenticator} = require('../auth');
const {generateKeyPairSync} = require('node:crypto');
const jwt = require('jsonwebtoken');
const env = {SUPABASE_URL:'https://test.supabase.co'};
test('rejects public placeholder even when JWKS is configured', () => {
  expect(() => createAuthenticator({...env,SUPABASE_JWT_SECRET:'COLE_AQUI_O_JWT_SECRET_DO_SUPABASE'})).toThrow();
});
test('requires HTTPS for JWKS', () => {
  expect(() => createAuthenticator({SUPABASE_URL:'http://test.supabase.co'})).toThrow();
});
test('coalesces unknown-key refreshes and validates a known RSA key', async () => {
  const {publicKey,privateKey} = generateKeyPairSync('rsa',{modulusLength:2048});
  const key = {...publicKey.export({format:'jwk'}),kid:'known'};
  const fetchKeys = jest.fn(async () => new Response(JSON.stringify({keys:[key]})));
  const auth = createAuthenticator(env,fetchKeys);
  const run = async kid => {
    const token = jwt.sign({sub:'bb3c1d84-660a-43b3-82c8-6bb3b6392287',aud:'authenticated',iss:env.SUPABASE_URL+'/auth/v1'},privateKey,{algorithm:'RS256',keyid:kid,expiresIn:60});
    let status=200;
    const res={status(value){status=value;return this;},json(){}};
    await auth({headers:{authorization:'Bearer '+token}},res,()=>{});
    return status;
  };
  expect(await Promise.all(Array.from({length:8},(_,i)=>run('unknown-'+i)))).toEqual(Array(8).fill(401));
  expect(fetchKeys).toHaveBeenCalledTimes(1);
  expect(await run('known')).toBe(200);
  expect(fetchKeys).toHaveBeenCalledTimes(1);
});
