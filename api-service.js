import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE = 'http://10.0.0.165:3000';

const getToken   = () => AsyncStorage.getItem('@ag_token');
const getRefresh = () => AsyncStorage.getItem('@ag_refresh');

const saveTokens = (access, refresh) =>
  Promise.all([
    AsyncStorage.setItem('@ag_token',   access),
    AsyncStorage.setItem('@ag_refresh', refresh),
  ]);

const clearTokens = () =>
  AsyncStorage.multiRemove(['@ag_token', '@ag_refresh', '@ag_user']);

async function request(method, path, body, auth = true) {
  const headers = { 'Content-Type': 'application/json' };

  if (auth) {
    const token = await getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }

  const opts = { method, headers };
  if (body !== undefined) opts.body = JSON.stringify(body);

  let res = await fetch(`${API_BASE}${path}`, opts);

  // Token expirado — tenta renovar automaticamente
  if (res.status === 401 && auth) {
    try {
      const refreshToken = await getRefresh();
      if (!refreshToken) throw new Error('sem refresh');

      const rRes = await fetch(`${API_BASE}/api/auth/refresh`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ refreshToken }),
      });

      if (!rRes.ok) throw new Error('refresh falhou');

      const { accessToken, refreshToken: newRefresh } = await rRes.json();
      await saveTokens(accessToken, newRefresh);

      res = await fetch(`${API_BASE}${path}`, {
        ...opts,
        headers: { ...headers, Authorization: `Bearer ${accessToken}` },
      });
    } catch {
      await clearTokens();
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

const api = {
  // ── Auth ──────────────────────────────────────────────────────────────────
  login:    (email, password) =>
    request('POST', '/api/auth/login', { email, password }, false),

  register: (name, email, password, confirmPassword) =>
    request('POST', '/api/auth/register', { name, email, password, confirmPassword }, false),

  logout: (refreshToken) =>
    request('POST', '/api/auth/logout', { refreshToken }),

  // ── Eventos ───────────────────────────────────────────────────────────────
  getEvents:   (mes)     => request('GET',    mes ? `/api/events?mes=${mes}` : '/api/events'),
  createEvent: (data)    => request('POST',   '/api/events', data),
  updateEvent: (id, data)=> request('PUT',    `/api/events/${id}`, data),
  deleteEvent: (id)      => request('DELETE', `/api/events/${id}`),

  // ── Notas ─────────────────────────────────────────────────────────────────
  getNotes: (q, tag) => {
    const p = new URLSearchParams();
    if (q)   p.append('q',   q);
    if (tag) p.append('tag', tag);
    const qs = p.toString();
    return request('GET', `/api/notes${qs ? '?' + qs : ''}`);
  },
  createNote: (data)     => request('POST',   '/api/notes', data),
  updateNote: (id, data) => request('PUT',    `/api/notes/${id}`, data),
  deleteNote: (id)       => request('DELETE', `/api/notes/${id}`),

  // ── Humor ─────────────────────────────────────────────────────────────────
  getMoods: (days = 14) => request('GET',  `/api/moods?days=${days}`),
  saveMood: (nivel, data) => request('POST', '/api/moods', { nivel, data }),

  // ── Perfil ────────────────────────────────────────────────────────────────
  updateProfile: (name) => request('PUT', '/api/users/profile', { name }),
  updateAvatar:  (uri)  => request('PUT', '/api/users/avatar',  { uri }),

  // ── Helpers ───────────────────────────────────────────────────────────────
  saveTokens,
  clearTokens,
};

export default api;
