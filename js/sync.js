// Cloud sync with Supabase, using its REST API directly (no library, so the app stays fully offline-capable).
//
// How it works:
//  - Every change is saved on the device first (store.js) and queued in an outbox.
//  - push: upload queued records. The server keeps whichever copy has the newer updatedAt.
//  - pull: download every record the server stored since the last pull, and keep it if it's newer.
// Runs on launch, shortly after changes, when the app comes back to the foreground or online,
// and every minute while open.

import * as S from './store.js';
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

const BASE = (SUPABASE_URL || '').trim().replace(/\/+$/, '');
const KEY = (SUPABASE_KEY || '').trim();
const PAGE = 1000;

export const configured = () => !!(BASE && KEY);
const session = () => S.getMeta('auth') || null;
export const user = () => (session() ? session().user : null);

let status = { state: 'idle', msg: '' };
export const getStatus = () => status;
let hooks = { onRemote() {}, onStatus() {} };
function setStatus(state, msg = '') {
  status = { state, msg };
  try { hooks.onStatus(status); } catch (e) { console.error(e); }
}

// ---------- auth ----------
async function authRequest(grant, body) {
  const res = await fetch(`${BASE}/auth/v1/token?grant_type=${grant}`, {
    method: 'POST',
    headers: { apikey: KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(j.error_description || j.msg || j.message || `Sign-in failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return j;
}

function saveSession(j) {
  S.setMeta('auth', {
    access_token: j.access_token,
    refresh_token: j.refresh_token,
    expires_at: j.expires_at || Math.floor(Date.now() / 1000) + (j.expires_in || 3600),
    user: { id: j.user.id, email: j.user.email },
  });
}

export async function signIn(email, password) {
  const j = await authRequest('password', { email, password });
  saveSession(j);
  S.setMeta('lastPull', null); // download everything on first sign-in
  setStatus('idle');
  syncNow();
}

export function signOut() {
  const s = session();
  S.setMeta('auth', null);
  S.setMeta('lastPull', null);
  setStatus('idle');
  if (s) {
    fetch(`${BASE}/auth/v1/logout`, { method: 'POST', headers: { apikey: KEY, Authorization: 'Bearer ' + s.access_token } }).catch(() => {});
  }
}

let refreshing = null;
async function accessToken(force = false) {
  const s = session();
  if (!s) throw Object.assign(new Error('Signed out'), { signedOut: true });
  if (!force && s.expires_at - 60 > Date.now() / 1000) return s.access_token;
  if (!refreshing) {
    refreshing = authRequest('refresh_token', { refresh_token: s.refresh_token })
      .then(j => { saveSession(j); return j.access_token; })
      .catch(err => {
        if (err.status >= 400 && err.status < 500) {
          S.setMeta('auth', null);
          err.signedOut = true;
          err.message = 'Your session expired. Sign in again.';
        }
        throw err;
      })
      .finally(() => { refreshing = null; });
  }
  return refreshing;
}

export async function api(method, path, body, headers = {}, retry = true) {
  const res = await fetch(BASE + path, {
    method,
    headers: { apikey: KEY, Authorization: 'Bearer ' + await accessToken(), 'Content-Type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (res.status === 401 && retry) { await accessToken(true); return api(method, path, body, headers, false); }
  if (!res.ok) {
    const j = await res.json().catch(() => null);
    throw new Error((j && (j.message || j.hint || j.error)) || `Server error ${res.status}`);
  }
  return method === 'GET' ? res.json() : null;
}

// ---------- sync ----------
let running = false, again = false, timer = null;

export async function syncNow() {
  if (!configured() || !session() || S.isDemo()) return; // never sync while the tutorial's sample data is loaded
  if (running) { again = true; return; }
  if (navigator.onLine === false) { setStatus('offline'); return; }
  running = true;
  setStatus('syncing');
  try {
    await accessToken();
    const uid = session().user.id;

    // push
    const items = S.pending();
    for (let i = 0; i < items.length; i += 500) {
      const chunk = items.slice(i, i + 500);
      await api('POST', '/rest/v1/records?on_conflict=user_id,coll,id',
        chunk.map(p => ({ user_id: uid, coll: p.c, id: p.rec.id, data: p.rec, updated_at: p.rec.updatedAt || 0, deleted: !!p.rec.deleted })),
        { Prefer: 'resolution=merge-duplicates,return=minimal' });
      S.clearPending(chunk);
    }

    // pull (re-check the last minute too, in case a write landed just as we last looked)
    const last = S.getMeta('lastPull');
    let cursor = last ? new Date(Date.parse(last) - 60000).toISOString() : '1970-01-01T00:00:00Z';
    let newest = last, changed = 0;
    for (;;) {
      const rows = await api('GET', `/rest/v1/records?select=coll,id,data,synced_at&synced_at=gt.${encodeURIComponent(cursor)}&order=synced_at.asc&limit=${PAGE}`);
      for (const r of rows) if (r.data && S.applyRemote(r.coll, r.data)) changed++;
      if (rows.length) { cursor = rows[rows.length - 1].synced_at; if (!newest || Date.parse(cursor) > Date.parse(newest)) newest = cursor; }
      if (rows.length < PAGE) break;
    }
    if (changed) S.commit();
    S.setMeta('lastPull', newest);
    S.setMeta('lastSync', Date.now());
    setStatus('ok');
    if (changed) { try { hooks.onRemote(changed); } catch (e) { console.error(e); } }
  } catch (err) {
    console.warn('sync failed', err);
    if (err.signedOut) setStatus('signedout', err.message === 'Signed out' ? '' : err.message);
    else if (err instanceof TypeError || navigator.onLine === false) setStatus('offline');
    else setStatus('error', err.message);
  } finally {
    running = false;
    if (again) { again = false; setTimeout(syncNow, 300); }
  }
}

/** Sync a moment after the latest change, so a burst of edits goes up together. */
export function schedule(ms = 2500) {
  clearTimeout(timer);
  timer = setTimeout(syncNow, ms);
}

export function init(h) {
  hooks = { ...hooks, ...h };
  if (!configured()) return;
  S.onChange(() => { if (S.pendingCount()) schedule(); });
  window.addEventListener('online', () => syncNow());
  window.addEventListener('offline', () => setStatus('offline'));
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') syncNow(); });
  setInterval(() => { if (document.visibilityState === 'visible') syncNow(); }, 60000);
  syncNow();
}
