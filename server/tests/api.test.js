process.env.NODE_ENV = 'test';
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_JWT_SECRET = 'test-only-secret-with-at-least-32-characters';
jest.mock('../database', () => ({
  connect: jest.fn(() => new Promise(() => {})),
  createEvent: jest.fn(async value => value),
  createNote: jest.fn(async value => value),
  getEventsByUser: jest.fn(async () => []),
  getEventById: jest.fn(async () => null),
  getNoteById: jest.fn(async () => null),
}));
const jwt = require('jsonwebtoken');
const app = require('../api');
const db = require('../database');
const uid = 'd53f23c6-d584-47bd-b21f-112cfb8db702';
let server, base;
beforeAll(async () => {
  server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
afterAll(() => new Promise(resolve => server.close(resolve)));
function token(claims = {}) {
  return jwt.sign(JSON.parse(JSON.stringify({ sub: uid, aud: 'authenticated', iss: `${process.env.SUPABASE_URL}/auth/v1`, exp: Math.floor(Date.now()/1000)+3600, ...claims })), process.env.SUPABASE_JWT_SECRET);
}
function call(path, body, claims) {
  return fetch(base+path, { method: body ? 'POST' : 'GET', headers: { authorization: `Bearer ${token(claims)}`, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
}
test('rejects signed tokens from another issuer', async () => {
  expect((await call('/api/events', null, {iss: 'https://other.invalid/auth/v1'})).status).toBe(401);
});
test('requires a UUID subject and expiry', async () => {
  expect((await call('/api/events', null, {sub: 'not-a-user'})).status).toBe(401);
  expect((await call('/api/events', null, {exp: undefined})).status).toBe(401);
});
test('rejects impossible dates and times', async () => {
  expect((await call('/api/events', {titulo:'Event',data:'2026-02-30',hora:'99:99'})).status).toBe(422);
});
test('preserves legitimate punctuation', async () => {
  const response = await call('/api/events', {titulo:'Revisar "A"',data:'2026-09-05',hora:'09:00'});
  expect((await response.json()).titulo).toBe('Revisar "A"');
});
test('accepts a note larger than 10KB within the character limit', async () => {
  expect((await call('/api/notes', {conteudo:'a'.repeat(11000)})).status).toBe(201);
});
test('returns 413 for oversized JSON instead of 500', async () => {
  expect((await call('/api/notes', {conteudo:'a'.repeat(400000)})).status).toBe(413);
});
test('requires string tags and string note content', async () => {
  expect((await call('/api/notes', {tags:[{}]})).status).toBe(422);
  expect((await call('/api/notes', {conteudo:{}})).status).toBe(422);
});
test('honors client IDs for retry-safe creation', async () => {
  const id = '9607146a-4594-4ac6-a304-e29e5f3c7605';
  const response = await call('/api/events', {id,titulo:'Event',data:'2026-09-05',hora:'09:00'});
  expect((await response.json()).id).toBe(id);
  expect(db.createEvent).toHaveBeenCalledWith(expect.objectContaining({id,userId:uid}));
});
test('requires JSON booleans instead of truthy strings for reminders', async () => {
  expect((await call('/api/events', {titulo:'Event',data:'2026-09-05',hora:'09:00',lembrete:'false'})).status).toBe(422);
});
test('rejects a nonexistent month', async () => {
  expect((await call('/api/events?mes=2026-99')).status).toBe(422);
});
test('rejects local and executable avatar URIs', async () => {
  for (const uri of ['file:///private/avatar.jpg','javascript:alert(1)']) {
    const response = await fetch(base+'/api/users/avatar', {method:'PUT',headers:{authorization:`Bearer ${token()}`,'content-type':'application/json'},body:JSON.stringify({uri})});
    expect(response.status).toBe(422);
  }
});
