import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import * as Crypto from 'expo-crypto';
import { API_BASE } from './config';

// One atomic snapshot per account contains both the local data and its outbox.
let owner = null, generation = 0, tail = Promise.resolve(), flushing = null;
let syncTimer = null;
const listeners = new Set();
const empty = () => ({ version: 1, revision: 0, events: [], notes: [], moods: [], queue: [] });
const key = uid => '@ag_v4_' + uid;
const serial = fn => {
  const result = tail.then(fn);
  tail = result.catch(() => {});
  return result;
};
const notify = () => listeners.forEach(fn => { try { fn(); } catch {} });
const current = context => context.uid === owner && context.generation === generation;
const changedSession = () => Object.assign(new Error('A sessão mudou. Entre novamente.'), { status: 401 });
function context() {
  if (!owner) throw changedSession();
  return { uid: owner, generation };
}
async function read(ctx) {
  const raw = await AsyncStorage.getItem(key(ctx.uid));
  if (!current(ctx)) throw changedSession();
  if (!raw) return empty();
  const data = JSON.parse(raw);
  if (data.version !== 1 || !['events','notes','moods','queue'].every(k => Array.isArray(data[k]))) {
    throw new Error('Dados locais inválidos. Não foi possível abrir o armazenamento.');
  }
  return data;
}
async function change(ctx, fn, kind) {
  return serial(async () => {
    const state = await read(ctx);
    const result = fn(state);
    state.revision = (state.revision || 0) + 1;
    state.revisions ||= {};
    if (kind) state.revisions[kind] = (state.revisions[kind] || 0) + 1;
    if (!current(ctx)) throw changedSession();
    await AsyncStorage.setItem(key(ctx.uid), JSON.stringify(state));
    if (!current(ctx)) throw changedSession();
    notify();
    return result;
  });
}
async function request(ctx, method, path, body) {
  const session = (await supabase.auth.getSession()).data.session;
  if (!current(ctx) || session?.user?.id !== ctx.uid) throw changedSession();
  async function send(token) {
    if (!current(ctx)) throw changedSession();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      return await fetch(API_BASE + path, { method, signal: controller.signal,
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    } finally { clearTimeout(timeout); }
  }
  let response = await send(session.access_token);
  if (response.status === 401) {
    const result = await supabase.auth.refreshSession();
    if (result.error || result.data.session?.user?.id !== ctx.uid || !current(ctx)) throw changedSession();
    response = await send(result.data.session.access_token);
  }
  if (!current(ctx)) throw changedSession();
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw Object.assign(new Error(error.error || error.errors?.map(e => e.message).join('; ') || 'Erro ' + response.status), { status: response.status });
  }
  return response.status === 204 ? null : response.json();
}
const transient = e => !e.status || e.status === 408 || e.status === 429 || e.status >= 500;
const identity = (kind, value) => kind === 'moods' ? value.data : value.id;
const replace = (items, kind, item) => [...items.filter(v => identity(kind,v) !== identity(kind,item)), item];

async function flushQueue(onFlushed) {
  clearTimeout(syncTimer);
  syncTimer = null;
  const ctx = context();
  if (flushing?.generation === ctx.generation) return flushing.promise;
  const promise = (async () => {
    let count = 0;
    for (;;) {
      if (!current(ctx)) return;
      const state = await serial(() => read(ctx));
      const op = state.queue.find(item => !item.error);
      if (!op) break;
      try {
        let result = await request(ctx, op.method, op.path, op.body);
        // A previous POST may have committed while its response was lost.
        // Reconcile the latest desired data after the idempotent creation.
        if (op.method === 'POST' && op.kind !== 'moods' && result?.id &&
            Object.keys(op.body).some(k => JSON.stringify(result[k]) !== JSON.stringify(op.body[k]))) {
          result = await request(ctx, 'PUT', op.path + '/' + op.id, op.body);
        }
        await change(ctx, latest => {
          latest.queue = latest.queue.filter(item => item.qid !== op.qid);
          const hasNewer = latest.queue.some(item => item.kind === op.kind && item.id === op.id);
          if (!hasNewer && op.method !== 'DELETE') {
            const clean = { ...op.body, ...result, _offline: false };
            latest[op.kind] = replace(latest[op.kind], op.kind, clean);
          }
        }, op.kind);
        count++;
      } catch (error) {
        if (!current(ctx)) return;
        if (op.method === 'DELETE' && error.status === 404) {
          await change(ctx, latest => { latest.queue = latest.queue.filter(item => item.qid !== op.qid); }, op.kind);
          continue;
        }
        if (!transient(error) && error.status !== 401) {
          await change(ctx, latest => { const found = latest.queue.find(item => item.qid === op.qid); if (found) found.error = error.message; });
        }
        break;
      }
    }
    if (count && current(ctx)) onFlushed?.();
  })();
  flushing = { generation: ctx.generation, promise };
  try { await promise; } finally { if (flushing?.promise === promise) flushing = null; }
}

async function mutate(kind, method, id, payload) {
  const ctx = context();
  const item = await change(ctx, state => {
    const previous = state[kind].find(v => identity(kind,v) === id);
    const value = { ...previous, ...payload, ...(kind === 'moods' ? {data:id} : {id}), _offline: true };
    if (kind === 'notes') { value.tags ||= []; value.titulo ||= ''; value.conteudo ||= ''; }
    const pendingCreate = state.queue.find(op => op.kind === kind && op.id === id && op.method === 'POST');
    // Replace desired state, but preserve an in-flight snapshot until it is acknowledged.
    state.queue = state.queue.filter(op => !(op.kind === kind && op.id === id));
    const effectiveMethod = method === 'PUT' && pendingCreate ? 'POST' : method;
    const body = { ...value }; delete body._offline; delete body.userId; delete body.updatedAt;
    const path = '/api/' + kind + (effectiveMethod === 'POST' ? '' : '/' + id);
    state.queue.push({ qid: Crypto.randomUUID(), kind, id, method: effectiveMethod, path,
      ...(method === 'DELETE' ? {} : {body}) });
    state[kind] = method === 'DELETE' ? state[kind].filter(v => identity(kind,v) !== id) : replace(state[kind],kind,value);
    return value;
  }, kind);
  // The durable local write is the success boundary; network work never delays the editor.
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => { if (current(ctx)) flushQueue().catch(() => {}); }, 750);
  return item;
}
async function list(kind, parameters = {}) {
  const ctx = context();
  const revision = (await serial(() => read(ctx))).revisions?.[kind] || 0;
  try {
    const items = [];
    for (let offset = 0; ; offset += 200) {
      const query = new URLSearchParams({ ...parameters, limit: '200', offset: String(offset) });
      const batch = await request(ctx, 'GET', '/api/' + kind + '?' + query);
      if (!Array.isArray(batch)) throw new Error('Resposta inválida do servidor.');
      items.push(...batch);
      if (kind === 'moods' || batch.length < 200) break;
      if (offset >= 100000) throw new Error('Lista excedeu o limite de sincronização.');
    }
    await change(ctx, state => {
      if ((state.revisions?.[kind] || 0) !== revision) return; // a newer mutation of this resource wins over a stale GET
      const unrelated = kind === 'events' && parameters.mes ? state.events.filter(e => !e.data?.startsWith(parameters.mes)) : [];
      let merged = [...unrelated, ...items];
      for (const op of state.queue.filter(o => o.kind === kind)) {
        merged = merged.filter(v => identity(kind,v) !== op.id);
        if (op.method !== 'DELETE') merged.push({ ...op.body, _offline: true });
      }
      state[kind] = merged;
    }, kind);
  } catch (error) {
    if (!transient(error)) throw error;
  }
  const state = await serial(() => read(ctx));
  const values = state[kind];
  return kind === 'events' && parameters.mes ? values.filter(e => e.data?.startsWith(parameters.mes)) : values;
}
const api = {
  async setSession(uid) {
    if (uid !== owner) { clearTimeout(syncTimer); owner = uid; generation++; }
    // Legacy caches have no reliable owner. Never adopt them into an account.
    await serial(async () => {
      const keys = await AsyncStorage.getAllKeys();
      const legacyQueue = await AsyncStorage.getItem('@ag_offline_queue');
      if (legacyQueue) {
        const archive = '@ag_legacy_unowned_queue';
        const previous = await AsyncStorage.getItem(archive);
        await AsyncStorage.setItem(previous && previous !== legacyQueue ? archive + '_' + Crypto.randomUUID() : archive, legacyQueue);
      }
      await AsyncStorage.multiRemove(keys.filter(k => /^@ag_events_|^@ag_notes_cache$|^@ag_moods_cache$|^@ag_offline_queue$|^@ag_user$/.test(k)));
    });
  },
  async clearSession() { clearTimeout(syncTimer); owner = null; generation++; notify(); },
  subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  getMe: () => request(context(), 'GET', '/api/users/me'),
  updateProfile: name => request(context(), 'PUT', '/api/users/profile', {name}),
  getEvents: mes => list('events', mes ? {mes} : {}),
  getCachedEvents: async mes => { const ctx = context(); const state = await serial(() => read(ctx)); return state.events.filter(e => !mes || e.data?.startsWith(mes)); },
  getNotes: async (q, tag) => (await list('notes')).filter(n => (!q || (n.titulo+' '+n.conteudo).toLowerCase().includes(q.toLowerCase())) && (!tag || n.tags.includes(tag))),
  getMoods: days => list('moods', {days: String(days || 14)}),
  createEvent: data => mutate('events','POST',Crypto.randomUUID(),data),
  updateEvent: (id,data) => mutate('events','PUT',id,data),
  deleteEvent: id => mutate('events','DELETE',id),
  createNote: data => mutate('notes','POST',Crypto.randomUUID(),data),
  updateNote: (id,data) => mutate('notes','PUT',id,data),
  deleteNote: id => mutate('notes','DELETE',id),
  saveMood: (nivel,data) => mutate('moods','POST',data,{nivel,data}),
  getQueue: () => {const ctx = context(); return serial(async () => (await read(ctx)).queue);},
  getLocal: kind => {const ctx = context(); return serial(async () => (await read(ctx))[kind]);},
  flushQueue,
};
export default api;
