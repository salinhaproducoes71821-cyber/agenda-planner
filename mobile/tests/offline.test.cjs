const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { randomUUID, webcrypto } = require('node:crypto');

// Exercise the real service in isolation from React Native and all live services.
function fixture() {
  const storage = new Map();
  let userId = 'account-A';
  let online = true;
  let responder = () => response(200, []);
  const requests = [];
  const session = () => userId ? { user: { id: userId }, access_token: `token-${userId}` } : null;
  const AsyncStorage = {
    async getItem(key) { return storage.get(key) ?? null; },
    async setItem(key, value) { storage.set(key, value); },
    async removeItem(key) { storage.delete(key); },
    async getAllKeys() { return [...storage.keys()]; },
    async multiRemove(keys) { keys.forEach(key => storage.delete(key)); },
  };
  const supabase = { auth: {
    async getSession() { return { data: { session: session() }, error: null }; },
    async refreshSession() { return { data: { session: session() }, error: null }; },
    async signOut() { userId = null; return { error: null }; },
  } };
  const source = fs.readFileSync(path.join(__dirname, '..', 'api-service.js'), 'utf8')
    .replace(/^import\s+[^;]+;\s*/gm, '')
    .replace(/export default api;?/, 'globalThis.testApi = api;');
  const context = vm.createContext({
    AsyncStorage, supabase, URLSearchParams, console, setTimeout, clearTimeout,
    Crypto: {randomUUID}, API_BASE: "https://test.invalid", AbortController, crypto: webcrypto, v4: randomUUID, uuidv4: randomUUID,
    fetch: async (url, options) => {
      if (!online) throw new TypeError('Network request failed');
      const request = { url, method: options.method, headers: options.headers,
        body: options.body === undefined ? undefined : JSON.parse(options.body) };
      requests.push(request);
      return responder(request);
    },
  });
  vm.runInContext(source, context, { filename: 'api-service.js' });
  const api = context.testApi;
  return {
    api, requests,
    async login(id) {
      userId = id;
      if (id && api.setSession) await api.setSession(id);
      if (!id && api.clearSession) await api.clearSession();
    },
    offline() { online = false; },
    online(handler = () => response(200, {})) { online = true; responder = handler; },
  };
}

function response(status, data) {
  return { status, ok: status >= 200 && status < 300, async json() { return data; } };
}

const plain = value => JSON.parse(JSON.stringify(value));

for (const resource of ['notes', 'moods', 'events']) {
  test(`${resource}: account B cannot read account A cache`, async () => {
    const f = fixture();
    await f.login('account-A');
    f.online(() => response(200, [{ id: 'private-A', title: 'Private data' }]));
    if (resource === 'notes') await f.api.getNotes();
    if (resource === 'moods') await f.api.getMoods();
    if (resource === 'events') await f.api.getEvents('2026-09');
    await f.login('account-B');
    f.offline();
    const cached = resource === 'notes' ? await f.api.getNotes()
      : resource === 'moods' ? await f.api.getMoods()
      : await f.api.getCachedEvents('2026-09');
    assert.deepEqual(plain(cached || []), []);
  });
}

test('account B cannot submit queued writes belonging to account A', async () => {
  const f = fixture();
  await f.login('account-A');
  f.offline();
  await f.api.createNote({ title: 'Private A' });
  await f.login('account-B');
  f.online();
  await f.api.flushQueue();
  assert.equal(f.requests.length, 0, 'No A write may be sent with B credentials');
});

test('concurrent offline creations retain every operation', async () => {
  const f = fixture();
  await f.login('account-A');
  f.offline();
  await Promise.all(Array.from({ length: 12 }, (_, n) => f.api.createNote({ title: `Note ${n}` })));
  const queue = await f.api.getQueue();
  assert.equal(queue.length, 12);
  assert.equal(new Set(queue.map(op => op.body.title)).size, 12);
});

test('concurrent flushes send each pending creation only once', async () => {
  const f = fixture();
  await f.login('account-A');
  f.offline();
  await f.api.createNote({ title: 'Create once' });
  f.online();
  await Promise.all([f.api.flushQueue(), f.api.flushQueue(), f.api.flushQueue()]);
  assert.equal(f.requests.filter(r => r.method === 'POST').length, 1);
  assert.equal((await f.api.getQueue()).length, 0);
});

for (const status of [500, 429]) {
  test(`HTTP ${status} during flush preserves the pending operation for retry`, async () => {
    const f = fixture();
    await f.login('account-A');
    f.offline();
    await f.api.createNote({ title: 'Keep until accepted' });
    await f.api.flushQueue(); // settle the automatic attempt while still offline
    const before = plain(await f.api.getQueue());
    f.online(() => response(status, { error: 'Temporary failure' }));
    await f.api.flushQueue();
    assert.deepEqual(plain(await f.api.getQueue()), before);
    f.online();
    await f.api.flushQueue();
    assert.equal((await f.api.getQueue()).length, 0);
    assert.equal(f.requests.length, 2);
  });
}

for (const kind of ['Note', 'Event']) {
  test(`editing an offline ${kind.toLowerCase()} sends the latest content when creation syncs`, async () => {
    const f = fixture();
    await f.login('account-A');
    f.offline();
    const created = await f.api[`create${kind}`]({ title: 'Before', titulo: 'Before' });
    await f.api[`update${kind}`](created.id, { title: 'After', titulo: 'After' });
    f.online();
    await f.api.flushQueue();
    const creation = f.requests.find(r => r.method === 'POST');
    assert.ok(creation, 'Pending creation must sync');
    assert.equal(creation.body.title, 'After');
    assert.equal(creation.body.titulo, 'After');
    assert.equal(creation.body.id, created.id, 'Client identity must survive synchronization');
  });

  test(`deleting an offline ${kind.toLowerCase()} cancels its pending creation`, async () => {
    const f = fixture();
    await f.login('account-A');
    f.offline();
    const created = await f.api[`create${kind}`]({ title: 'Discard me' });
    await f.api[`delete${kind}`](created.id);
    f.online();
    await f.api.flushQueue();
    assert.equal(f.requests.filter(r => r.method === 'POST').length, 0, 'A deleted draft must not be created; DELETE also cleans up a lost POST response');
    assert.equal((await f.api.getQueue()).length, 0);
  });
}
