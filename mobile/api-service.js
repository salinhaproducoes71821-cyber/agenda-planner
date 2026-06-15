import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

const API_BASE = 'https://agenda-planner-production-392f.up.railway.app';

// O access token vem da sessão do Supabase (renovada automaticamente pelo SDK).
const getAccessToken = async () => {
  const { data } = await supabase.auth.getSession();
  return data?.session?.access_token || null;
};

// ── Cache helpers ─────────────────────────────────────────────────────────────
const getCached = async (key) => {
  try { const r = await AsyncStorage.getItem(key); return r ? JSON.parse(r) : null; } catch { return null; }
};
const setCached = async (key, data) => {
  try { await AsyncStorage.setItem(key, JSON.stringify(data)); } catch {}
};

// ── Offline queue ─────────────────────────────────────────────────────────────
const QUEUE_KEY = '@ag_offline_queue';

const enqueueOp = async (op) => {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    const q = raw ? JSON.parse(raw) : [];
    q.push({ ...op, _qid: `${Date.now()}_${Math.random()}` });
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(q));
  } catch {}
};

const getQueue = async () => {
  try { const r = await AsyncStorage.getItem(QUEUE_KEY); return r ? JSON.parse(r) : []; } catch { return []; }
};

const dequeueOp = async (qid) => {
  try {
    const q = await getQueue();
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(q.filter(o => o._qid !== qid)));
  } catch {}
};

function isNetworkError(e) {
  const msg = e?.message || '';
  return (
    msg === 'Network request failed' ||
    msg.includes('Failed to fetch') ||
    msg.includes('Network Error') ||
    msg.includes('fetch failed') ||
    msg.includes('Could not connect')
  );
}

// ── Core HTTP ─────────────────────────────────────────────────────────────────
async function request(method, path, body, auth = true) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth) {
    const token = await getAccessToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }
  const opts = { method, headers };
  if (body !== undefined) opts.body = JSON.stringify(body);

  let res = await fetch(`${API_BASE}${path}`, opts);

  if (res.status === 401 && auth) {
    try {
      // Força a renovação da sessão pelo Supabase e repete a requisição.
      const { data, error } = await supabase.auth.refreshSession();
      const token = data?.session?.access_token;
      if (error || !token) throw new Error('refresh falhou');
      res = await fetch(`${API_BASE}${path}`, {
        ...opts,
        headers: { ...headers, Authorization: `Bearer ${token}` },
      });
    } catch {
      await supabase.auth.signOut();
      throw new Error('Sessão expirada. Faça login novamente.');
    }
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Erro ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

// Processa fila de operações pendentes. Chame quando souber que está online.
async function flushQueue(onFlushed) {
  const q = await getQueue();
  if (!q.length) return;
  let flushed = 0;
  for (const op of q) {
    try {
      await request(op.method, op.path, op.body);
      await dequeueOp(op._qid);
      flushed++;
    } catch (e) {
      // Erro não-rede (ex: 404, 422) — remove da fila para não travar
      if (!isNetworkError(e)) await dequeueOp(op._qid);
      break; // Para no primeiro erro de rede
    }
  }
  if (flushed > 0 && onFlushed) onFlushed();
}

// ── API ───────────────────────────────────────────────────────────────────────
const api = {
  // Perfil do usuário autenticado (cria no backend na 1ª chamada)
  getMe: () => request('GET', '/api/users/me'),

  // Eventos — com cache e fila offline
  getEvents: async (mes) => {
    const cacheKey = `@ag_events_${mes || 'all'}`;
    const data = await request('GET', mes ? `/api/events?mes=${mes}` : '/api/events');
    await setCached(cacheKey, data);
    return data;
  },

  getCachedEvents: (mes) => getCached(`@ag_events_${mes || 'all'}`),

  createEvent: async (data) => {
    try { return await request('POST', '/api/events', data); }
    catch (e) {
      if (isNetworkError(e)) {
        const temp = { ...data, id: `temp_${Date.now()}`, _offline: true };
        await enqueueOp({ method: 'POST', path: '/api/events', body: data });
        return temp;
      }
      throw e;
    }
  },

  updateEvent: async (id, data) => {
    try { return await request('PUT', `/api/events/${id}`, data); }
    catch (e) {
      if (isNetworkError(e)) {
        if (!String(id).startsWith('temp_'))
          await enqueueOp({ method: 'PUT', path: `/api/events/${id}`, body: data });
        return { ...data, id, _offline: true };
      }
      throw e;
    }
  },

  deleteEvent: async (id) => {
    try { return await request('DELETE', `/api/events/${id}`); }
    catch (e) {
      if (isNetworkError(e)) {
        if (!String(id).startsWith('temp_'))
          await enqueueOp({ method: 'DELETE', path: `/api/events/${id}` });
        return null;
      }
      throw e;
    }
  },

  // Notas — com cache e fila offline
  getNotes: async (q, tag) => {
    const p = new URLSearchParams();
    if (q)   p.append('q', q);
    if (tag) p.append('tag', tag);
    const qs = p.toString();
    const path = `/api/notes${qs ? '?' + qs : ''}`;
    try {
      const data = await request('GET', path);
      if (!q && !tag) await setCached('@ag_notes_cache', data);
      return data;
    } catch (e) {
      if (isNetworkError(e)) {
        return await getCached('@ag_notes_cache') || [];
      }
      throw e;
    }
  },

  createNote: async (data) => {
    try { return await request('POST', '/api/notes', data); }
    catch (e) {
      if (isNetworkError(e)) {
        const temp = {
          ...data, id: `temp_${Date.now()}`,
          tags: data.tags || [],
          updatedAt: new Date().toISOString().split('T')[0],
          _offline: true,
        };
        await enqueueOp({ method: 'POST', path: '/api/notes', body: data });
        return temp;
      }
      throw e;
    }
  },

  updateNote: async (id, data) => {
    try { return await request('PUT', `/api/notes/${id}`, data); }
    catch (e) {
      if (isNetworkError(e)) {
        if (!String(id).startsWith('temp_'))
          await enqueueOp({ method: 'PUT', path: `/api/notes/${id}`, body: data });
        return { ...data, id, _offline: true };
      }
      throw e;
    }
  },

  deleteNote: async (id) => {
    try { return await request('DELETE', `/api/notes/${id}`); }
    catch (e) {
      if (isNetworkError(e)) {
        if (!String(id).startsWith('temp_'))
          await enqueueOp({ method: 'DELETE', path: `/api/notes/${id}` });
        return null;
      }
      throw e;
    }
  },

  // Humor — com cache e fila offline
  getMoods: async (days = 14) => {
    try {
      const data = await request('GET', `/api/moods?days=${days}`);
      await setCached('@ag_moods_cache', data);
      return data;
    } catch (e) {
      if (isNetworkError(e)) return await getCached('@ag_moods_cache') || [];
      throw e;
    }
  },
  saveMood: async (nivel, data) => {
    try { return await request('POST', '/api/moods', { nivel, data }); }
    catch (e) {
      if (isNetworkError(e)) {
        await enqueueOp({ method: 'POST', path: '/api/moods', body: { nivel, data } });
        return { nivel, data, _offline: true };
      }
      throw e;
    }
  },

  // Perfil
  updateProfile: (name) => request('PUT', '/api/users/profile', { name }),
  updateAvatar:  (uri)  => request('PUT', '/api/users/avatar',  { uri }),

  // Helpers
  flushQueue,
  getQueue,
};

export default api;
