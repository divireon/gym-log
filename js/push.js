// Lock-screen rest alerts via Web Push.
// When rest starts, this device asks Supabase to push "Rest over" at the end time. That works even
// when the phone is locked and Gym Log is closed, because Apple/Google deliver it, not the app.

import * as S from './store.js';
import * as Sync from './sync.js';
import { VAPID_PUBLIC_KEY } from './config.js';

const ENDPOINT_KEY = 'pushEndpoint';

export const supported = () =>
  !!VAPID_PUBLIC_KEY && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

/** iPhone only allows push for apps opened from the home screen. */
export const needsHomeScreen = () =>
  /iPhone|iPad|iPod/.test(navigator.userAgent) && !window.navigator.standalone && !('PushManager' in window);

export const permission = () => ('Notification' in window ? Notification.permission : 'unsupported');
export const enabled = () => !!S.getMeta(ENDPOINT_KEY) && permission() === 'granted';

function keyBytes(b64u) {
  const b64 = b64u.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - b64u.length % 4) % 4);
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0));
}

// Requests go out one at a time, in order, so "cancel" can never overtake "schedule".
let queue = Promise.resolve();
const enqueue = fn => (queue = queue.then(fn, fn).catch(err => console.warn('push', err)));

/** Turn alerts on for this device. Must be called from a tap. Throws with a friendly message. */
export async function enable() {
  if (!supported()) throw new Error(needsHomeScreen() ? 'Open Gym Log from your home screen to turn this on.' : 'This browser can’t show lock-screen alerts.');
  const u = Sync.user();
  if (!u) throw new Error('Sign in to cloud sync first (below).');
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('Notifications are off. Turn them on in iPhone Settings → Notifications → Gym Log.');
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC_KEY) });
  const j = sub.toJSON();
  await Sync.api('POST', '/rest/v1/push_subscriptions?on_conflict=endpoint',
    [{ user_id: u.id, endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth, user_agent: navigator.userAgent.slice(0, 200) }],
    { Prefer: 'resolution=merge-duplicates,return=minimal' });
  S.setMeta(ENDPOINT_KEY, j.endpoint);
}

export async function disable() {
  const endpoint = S.getMeta(ENDPOINT_KEY);
  S.setMeta(ENDPOINT_KEY, null);
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) await sub.unsubscribe();
  } catch {}
  if (endpoint && Sync.user()) {
    await Sync.api('DELETE', `/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(endpoint)}`).catch(() => {});
  }
}

/** Ask the server to buzz this device at endAt (ms). Replaces any pending alert. */
export function scheduleAt(endAt, body) {
  const endpoint = S.getMeta(ENDPOINT_KEY), u = Sync.user();
  if (!endpoint || !u || permission() !== 'granted') return;
  enqueue(() => Sync.api('POST', '/rest/v1/rest_alerts?on_conflict=endpoint',
    [{ endpoint, user_id: u.id, fire_at: new Date(endAt).toISOString(), body: String(body || 'Time for your next set').slice(0, 120) }],
    { Prefer: 'resolution=merge-duplicates,return=minimal' }));
}

/** Cancel this device's pending alert (rest skipped, workout finished...). */
export function cancel() {
  const endpoint = S.getMeta(ENDPOINT_KEY);
  if (!endpoint || !Sync.user()) return;
  enqueue(() => Sync.api('DELETE', `/rest/v1/rest_alerts?endpoint=eq.${encodeURIComponent(endpoint)}`));
}
