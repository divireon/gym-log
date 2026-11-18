// Local-first data store.
// Every record lives in localStorage and carries an `updatedAt` timestamp.
// Changed records are queued in an "outbox" so a sync layer can push them to the cloud later.
// Deletes are soft (deleted: true) so they can sync too.

const DATA_KEY = 'gym.data.v1';
const META_KEY = 'gym.meta.v1';
export const COLLS = ['exercises', 'routines', 'workouts', 'runs', 'bodyweights', 'goals', 'settings'];

let db = {};
let meta = {};
const listeners = new Set();

function load() {
  try { db = JSON.parse(localStorage.getItem(DATA_KEY)) || {}; } catch { db = {}; }
  for (const c of COLLS) if (!db[c] || typeof db[c] !== 'object') db[c] = {};
  try { meta = JSON.parse(localStorage.getItem(META_KEY)) || {}; } catch { meta = {}; }
  if (!meta.outbox) meta.outbox = {};
}
load();

let warned = false;
function saveData() {
  try { localStorage.setItem(DATA_KEY, JSON.stringify(db)); }
  catch (err) {
    console.error(err);
    if (!warned) { warned = true; alert('Could not save: device storage may be full. Export a backup from Settings.'); }
  }
}
function saveMeta() { try { localStorage.setItem(META_KEY, JSON.stringify(meta)); } catch {} }
function emit(c) { for (const fn of listeners) { try { fn(c); } catch (e) { console.error(e); } } }

export function uid() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
}

/** Non-deleted records in a collection. */
export const all = c => Object.values(db[c]).filter(r => !r.deleted);
/** A record by id (including soft-deleted ones, so history can still show names). */
export const get = (c, id) => (id ? db[c][id] : undefined);

export function put(c, rec) {
  if (!rec.id) rec.id = uid();
  rec.updatedAt = Date.now();
  db[c][rec.id] = rec;
  meta.outbox[c + ':' + rec.id] = rec.updatedAt;
  saveData(); saveMeta(); emit(c);
  return rec;
}

export function remove(c, id) {
  const r = db[c][id];
  if (r) { r.deleted = true; put(c, r); }
}

/** Insert a built-in record only if it has never existed. Call commit() afterwards. */
export function seed(c, rec) {
  if (db[c][rec.id]) return false;
  db[c][rec.id] = { ...rec, updatedAt: 0 };
  meta.outbox[c + ':' + rec.id] = 0;
  return true;
}
export function commit() { saveData(); saveMeta(); emit(); }

// ---- settings (stored as a synced record) ----
const DEFAULT_SETTINGS = { id: 'main', defaultRest: 90, vibrate: true, wakeLock: true };
export function settings() { return { ...DEFAULT_SETTINGS, ...(db.settings.main || {}) }; }
export function setSettings(patch) { put('settings', { ...settings(), ...patch, id: 'main' }); }

// ---- device-only state (never synced) ----
export const getMeta = k => meta[k];
export function setMeta(k, v) { meta[k] = v; saveMeta(); }

// ---- sync hooks (used by the cloud sync layer) ----
export function pending() {
  return Object.entries(meta.outbox).map(([key, at]) => {
    const i = key.indexOf(':');
    const c = key.slice(0, i), id = key.slice(i + 1);
    return { key, at, c, rec: db[c] && db[c][id] };
  }).filter(p => p.rec);
}
/** Clear outbox entries, but only if the record hasn't changed again since it was read. */
export function clearPending(items) {
  for (const { key, at } of items) if (meta.outbox[key] === at) delete meta.outbox[key];
  saveMeta();
}
export const pendingCount = () => Object.keys(meta.outbox).length;

/** Merge a record from elsewhere; newest updatedAt wins. Returns true if applied. */
export function applyRemote(c, rec) {
  if (!db[c] || !rec || !rec.id) return false;
  const cur = db[c][rec.id];
  if (cur && (cur.updatedAt || 0) >= (rec.updatedAt || 0)) return false;
  db[c][rec.id] = rec;
  return true;
}

export function onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }

// ---- backup ----
export function exportAll() {
  return { app: 'gym-log', version: 1, exportedAt: Date.now(), data: db };
}
export function importAll(obj) {
  const data = obj && obj.data;
  if (!data || typeof data !== 'object') throw new Error('That file is not a Gym Log backup.');
  let n = 0;
  for (const c of COLLS) {
    for (const rec of Object.values(data[c] || {})) {
      if (applyRemote(c, rec)) { meta.outbox[c + ':' + rec.id] = rec.updatedAt || 0; n++; }
    }
  }
  commit();
  return n;
}
