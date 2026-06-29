// Thin fetch wrapper. Attaches the auth token from the stored session.
const BASE = '/api';
const STORE_KEY = 'lt_session';

function token() {
  try {
    const raw = localStorage.getItem(STORE_KEY) || sessionStorage.getItem(STORE_KEY);
    return raw ? JSON.parse(raw).token : null;
  } catch {
    return null;
  }
}

async function req(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const t = token();
  if (t) headers.Authorization = `Bearer ${t}`;
  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    // Session expired/invalid: clear and bounce to login (except on the login call itself).
    if (res.status === 401 && path !== '/login') {
      localStorage.removeItem(STORE_KEY);
      sessionStorage.removeItem(STORE_KEY);
      window.location.reload();
    }
    let msg = res.statusText;
    try { msg = (await res.json()).error || msg; } catch {}
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

export const api = {
  login: (identifier, password) =>
    req('/login', { method: 'POST', body: JSON.stringify({ identifier, password }) }),
  me: () => req('/me'),
  dashboard: () => req('/dashboard'),
  clients: () => req('/clients'),
  client: (id) => req(`/clients/${id}`),
  addClient: (body) => req('/clients', { method: 'POST', body: JSON.stringify(body) }),
  editClient: (id, body) => req(`/clients/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  changePassword: (currentPassword, newPassword) =>
    req('/change-password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) }),
  requests: (status) => req(`/requests${status ? `?status=${status}` : ''}`),
  createRequest: (body) => req('/requests', { method: 'POST', body: JSON.stringify(body) }),
  updateRequest: (id, status) =>
    req(`/requests/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  outbox: () => req('/outbox'),
};
