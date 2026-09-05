const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { randomUUID } = require('node:crypto');

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const tick = () => new Promise(resolve => setImmediate(resolve));
const plain = value => JSON.parse(JSON.stringify(value));
const reply = (status, value) => ({ status, ok: status >= 200 && status < 300, json: async () => value });

function load(file, bindings, expose) {
  const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8')
    .replace(/^import\s+[^;]+;\s*/gm, '')
    .replace(/export default api;?/, '')
    .replace(/export (const|function|async function) /g, '$1 ')
    .replace(/return <AuthContext.Provider[^\n]+/, 'return {login,logout};');
  const context = vm.createContext({ console, setTimeout, clearTimeout, URLSearchParams, AbortController,
    Crypto: { randomUUID }, API_BASE: 'https://test.invalid', ...bindings });
  vm.runInContext(`${source}\nglobalThis.result = ${expose};`, context, { filename: file });
  return context.result;
}

function service(storage = new Map()) {
  let user = 'A', failWrites = false;
  let beforeRead = async () => {};
  let handler = async () => { throw new Error('Network request failed'); };
  const api = load('api-service.js', {
    AsyncStorage: {
      async getItem(key) { await beforeRead(key); return storage.get(key) ?? null; },
      async setItem(key, value) { if (failWrites) throw new Error('Disk full'); storage.set(key, value); },
      async getAllKeys() { return [...storage.keys()]; },
      async multiRemove(keys) { keys.forEach(key => storage.delete(key)); },
    },
    supabase: { auth: { async getSession() { return { data: { session: { user: { id: user }, access_token: user } } }; } } },
    fetch: (url, opts) => handler({ url, method: opts.method, body: opts.body && JSON.parse(opts.body), token: opts.headers.Authorization }),
  }, 'api');
  return { api, storage,
    async login(uid) { user = uid; if (uid) await api.setSession(uid); else await api.clearSession(); },
    network(fn) { handler = fn; },
    failWrites() { failWrites = true; },
    beforeRead(fn) { beforeRead = fn; },
  };
}

test('a delayed account A response cannot contaminate account B state', async () => {
  const f = service(); await f.login('A');
  const started = deferred(), response = deferred();
  f.network(() => { started.resolve(); return response.promise; });
  const pending = f.api.getNotes();
  const rejection = assert.rejects(pending, error => error.status === 401);
  await started.promise;
  await f.login('B');
  response.resolve(reply(200, [{ id: 'secret-A', titulo: 'Private' }]));
  await rejection;
  assert.deepEqual(plain(await f.api.getLocal('notes')), []);
});

test('a list response started before a successful creation cannot erase that creation', async () => {
  const f = service(); await f.login('A');
  const started = deferred(), oldResponse = deferred();
  f.network(request => {
    if (request.method === 'GET') { started.resolve(); return oldResponse.promise; }
    return reply(200, request.body);
  });
  const listing = f.api.getNotes();
  await started.promise;
  const created = await f.api.createNote({ titulo: 'Just saved' });
  await f.api.flushQueue();
  assert.equal((await f.api.getQueue()).length, 0);
  oldResponse.resolve(reply(200, []));
  await listing;
  assert.ok((await f.api.getLocal('notes')).some(note => note.id === created.id), 'An older server snapshot erased a confirmed local write');
});

test('parallel event and note loads both populate their independent caches', async () => {
  const f = service(); await f.login('A');
  const eventsStarted = deferred(), notesStarted = deferred();
  const eventsResponse = deferred(), notesResponse = deferred();
  f.network(request => {
    if (request.url.includes('/events?')) { eventsStarted.resolve(); return eventsResponse.promise; }
    notesStarted.resolve(); return notesResponse.promise;
  });
  const events = f.api.getEvents(), notes = f.api.getNotes();
  await Promise.all([eventsStarted.promise, notesStarted.promise]);
  eventsResponse.resolve(reply(200, [{ id: 'event-1', titulo: 'Event', data: '2026-09-05' }]));
  await events;
  notesResponse.resolve(reply(200, [{ id: 'note-1', titulo: 'Note', conteudo: '', tags: [] }]));
  await notes;
  assert.equal((await f.api.getLocal('events')).length, 1);
  assert.equal((await f.api.getLocal('notes')).length, 1, 'An unrelated event fetch invalidated the note fetch');
});
test('legacy unowned pending work is quarantined without being sent or erased', async () => {
  const raw = JSON.stringify([{method:'POST',path:'/api/notes',body:{conteudo:'legacy'}}]);
  const storage = new Map([['@ag_offline_queue',raw]]);
  const f = service(storage); await f.login('B');
  assert.equal(storage.get('@ag_legacy_unowned_queue'),raw);
  assert.deepEqual(plain(await f.api.getQueue()),[]);
  assert.equal(storage.has('@ag_offline_queue'),false);
});

for (const action of ['edit', 'delete']) {
  test(`lost POST response followed by ${action} converges after restart`, async () => {
    const f = service(); await f.login('A');
    const remote = new Map();
    f.network(request => {
      remote.set(request.body.id, request.body);
      throw new Error('Network request failed');
    });
    const note = await f.api.createNote({ titulo: 'Original' });
    await f.api.flushQueue();
    f.network(async () => { throw new Error('Network request failed'); });
    if (action === 'edit') await f.api.updateNote(note.id, { titulo: 'Latest' });
    else await f.api.deleteNote(note.id);
    await f.api.flushQueue();
    const restarted = service(f.storage); await restarted.login('A');
    restarted.network(request => {
      const id = request.body?.id || request.url.split('/').pop();
      if (request.method === 'POST') {
        if (!remote.has(id)) remote.set(id, request.body);
        return reply(200, remote.get(id));
      }
      if (request.method === 'PUT') { remote.set(id, request.body); return reply(200, request.body); }
      if (request.method === 'DELETE') { remote.delete(id); return reply(204, null); }
      return reply(200, [...remote.values()]);
    });
    await restarted.api.flushQueue();
    assert.equal((await restarted.api.getQueue()).length, 0);
    if (action === 'edit') assert.equal(remote.get(note.id).titulo, 'Latest');
    else assert.equal(remote.has(note.id), false);
  });
}

test('a failed durable write rejects mutation and leaves the previous snapshot intact', async () => {
  const f = service(); await f.login('A');
  const note = await f.api.createNote({ titulo: 'Keep me' });
  await f.api.flushQueue();
  f.failWrites();
  await assert.rejects(f.api.updateNote(note.id, { titulo: 'Not persisted' }), /Disk full/);
  assert.equal((await f.api.getLocal('notes'))[0].titulo, 'Keep me');
});

for (const method of ['getQueue', 'getLocal', 'getCachedEvents']) {
  test(`${method} retains its original session when waiting behind another storage read`, async () => {
    const f = service(); await f.login('A');
    const blocked = deferred(), started = deferred();
    let once = true;
    f.beforeRead(async () => { if (once) { once = false; started.resolve(); await blocked.promise; } });
    const first = f.api.getLocal('notes');
    const firstRejected = assert.rejects(first, error => error.status === 401);
    await started.promise;
    const queued = f.api[method]('notes');
    const rejected = assert.rejects(queued, error => error.status === 401);
    const login = f.login('B');
    blocked.resolve();
    await Promise.all([firstRejected, rejected, login]);
  });
}

function notifications(initial = []) {
  let scheduled = initial, failCancel = false;
  const api = load('notifications.js', {
    Platform: { OS: 'android' }, validDate: () => true, validTime: () => true,
    Notifications: {
      SchedulableTriggerInputTypes: { DATE: 'date' },
      async cancelAllScheduledNotificationsAsync() { if (failCancel) throw new Error('Native cancel failed'); scheduled = []; },
      async getAllScheduledNotificationsAsync() { return scheduled; },
      async cancelScheduledNotificationAsync(id) { scheduled = scheduled.filter(item => item.identifier !== id); },
      async scheduleNotificationAsync(item) { scheduled.push(item); },
    },
  }, '({setNotificationSession,reconcileNotifications})');
  return { ...api, scheduled: () => scheduled, failCancel(value) { failCancel = value; } };
}

test('signed-out startup cancels reminders persisted by an earlier account', async () => {
  const f = notifications([{ identifier: 'A:private', content: { title: 'Private reminder', data: { userId: 'A' } } }]);
  await f.setNotificationSession(null);
  assert.equal(f.scheduled().length, 0);
});

test('a failed notification cleanup can be retried for the same session', async () => {
  const f = notifications([{ identifier: 'A:private' }]);
  f.failCancel(true);
  await assert.rejects(f.setNotificationSession('B'), /Native cancel failed/);
  f.failCancel(false);
  await f.setNotificationSession('B');
  assert.equal(f.scheduled().length, 0);
});

function secure() {
  const encrypted = new Map(), legacy = new Map();
  let failChunk = false;
  const api = load('secure-storage.js', {
    SecureStore: {
      WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'device-only',
      async getItemAsync(key) { return encrypted.get(key) ?? null; },
      async setItemAsync(key, value) { if (failChunk && key.endsWith('.1')) throw new Error('SecureStore full'); encrypted.set(key, value); },
      async deleteItemAsync(key) { encrypted.delete(key); },
    },
    AsyncStorage: {
      async getItem(key) { return legacy.get(key) ?? null; },
      async removeItem(key) { legacy.delete(key); },
    },
  }, 'secureStorage');
  return { api, encrypted, legacy, failChunk() { failChunk = true; } };
}

test('failed secure chunk replacement preserves the previously published session', async () => {
  const f = secure();
  await f.api.setItem('auth', 'old-session');
  f.failChunk();
  await assert.rejects(f.api.setItem('auth', 'x'.repeat(1000)), /SecureStore full/);
  assert.equal(await f.api.getItem('auth'), 'old-session');
});

test('secure storage migrates a multi-chunk legacy session and removes plaintext', async () => {
  const f = secure();
  const token = JSON.stringify({ access_token: 'jwt'.repeat(3000), profile: 'João 🎵'.repeat(500) });
  f.legacy.set('auth', token);
  assert.equal(await f.api.getItem('auth'), token);
  assert.equal(f.legacy.has('auth'), false);
  const manifest = JSON.parse(f.encrypted.get('auth'));
  assert.ok(manifest.count > 1);
  await f.api.removeItem('auth');
  assert.equal(f.encrypted.size, 0);
  assert.equal(await f.api.getItem('auth'), null);
});

test('secure storage fails closed if one published chunk is missing', async () => {
  const f = secure();
  await f.api.setItem('auth', 'x'.repeat(1200));
  const manifest = JSON.parse(f.encrypted.get('auth'));
  f.encrypted.delete(`auth.${manifest.id}.1`);
  f.legacy.set('auth', 'stale-plaintext');
  await assert.rejects(f.api.getItem('auth'), /incompleta/);
});

test('logout removes secure credentials even when the chunk manifest is corrupted', async () => {
  const f = secure();
  f.encrypted.set('auth', '{bad json');
  f.legacy.set('auth', 'legacy-token');
  await f.api.removeItem('auth');
  assert.equal(f.encrypted.has('auth'), false);
  assert.equal(f.legacy.has('auth'), false);
});

test('initial getSession completion cannot replace a newer auth-state event', async () => {
  const initial = deferred(), timers = [], effects = [];
  let authChange, owner = null;
  const session = id => ({ user: { id, email: `${id}@test.invalid` } });
  const Provider = load('auth-context.js', {
    createContext: () => ({}), useContext: () => null,
    useState: initialValue => [initialValue, () => {}], useRef: value => ({ current: value }),
    useCallback: fn => fn, useEffect: effect => effects.push(effect),
    setTimeout: fn => timers.push(fn),
    AppState: { addEventListener: () => ({ remove() {} }) }, Alert: { alert() {} },
    AsyncStorage: { getItem: async () => null, setItem: async () => {} },
    getAvatar: async () => null, setNotificationSession: async () => {},
    api: { async setSession(id) { owner = id; }, async clearSession() { owner = null; }, async getMe() { return { id: owner }; } },
    supabase: { auth: {
      getSession: () => initial.promise,
      onAuthStateChange(fn) { authChange = fn; return { data: { subscription: { unsubscribe() {} } } }; },
    } },
  }, 'AuthProvider');
  Provider({ children: null }); effects[0]();
  authChange('SIGNED_IN', session('B'));
  timers.splice(0).forEach(fn => fn());
  await tick();
  assert.equal(owner, 'B');
  initial.resolve({ data: { session: session('A') } });
  await tick();
  assert.equal(owner, 'B', 'Stale initial session replaced the newer signed-in account');
});

test('signed-out INITIAL_SESSION finishes initial loading', async () => {
  const initial = deferred(), effects = [], states = [], timers = [];
  let authChange;
  const Provider = load('auth-context.js', {
    createContext: () => ({}), useContext: () => null,
    useState(value) { const index = states.length; states.push(value); return [value, next => { states[index] = next; }]; },
    useRef: value => ({ current: value }), useCallback: fn => fn, useEffect: effect => effects.push(effect),
    setTimeout: fn => timers.push(fn),
    AppState: { addEventListener: () => ({ remove() {} }) }, Alert: { alert() {} },
    setNotificationSession: async () => {},
    api: { async clearSession() {} },
    supabase: { auth: {
      getSession: () => initial.promise,
      onAuthStateChange(fn) { authChange = fn; return { data: { subscription: { unsubscribe() {} } } }; },
    } },
  }, 'AuthProvider');
  Provider({ children: null }); effects[0]();
  authChange('INITIAL_SESSION', null);
  initial.resolve({ data: { session: null } });
  timers.splice(0).forEach(fn => fn());
  await tick();
  assert.equal(states[1], false, 'Loading remains true because both the auth event and the stale initial read were ignored');
});

test('login can reactivate the same account after profile authorization expires', async () => {
  let owner = null, rejectProfile = true;
  const Provider = load('auth-context.js', {
    createContext: () => ({}), useContext: () => null,
    useState: value => [value, () => {}], useRef: value => ({ current: value }),
    useCallback: fn => fn, useEffect() {}, Alert: { alert() {} },
    AsyncStorage: { getItem: async () => null, setItem: async () => {} },
    getAvatar: async () => null, setNotificationSession: async () => {},
    api: {
      async setSession(id) { owner = id; }, async clearSession() { owner = null; },
      async getMe() { if (rejectProfile) throw Object.assign(new Error('Expired'), { status: 401 }); return { id: 'A' }; },
    },
    supabase: { auth: { async signInWithPassword() { return { data: { session: { user: { id: 'A' } } } }; } } },
  }, 'AuthProvider');
  const provider = Provider({ children: null });
  await provider.login('a@test.invalid', 'password');
  assert.equal(owner, null);
  rejectProfile = false;
  await provider.login('a@test.invalid', 'password');
  assert.equal(owner, 'A', 'The completed activation promise prevents a fresh login after a 401');
});
