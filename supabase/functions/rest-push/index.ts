// Gym Log: sends "Rest over" push notifications.
// Called only by the database scheduler (see supabase/push.sql), which proves itself with a shared secret.
// Deploy in Supabase → Edge Functions as "rest-push" with JWT verification turned OFF.
// Secrets needed (Edge Functions → Secrets): VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, PUSH_SECRET.

import webpush from 'npm:web-push@3.6.7';

const PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY') ?? '';
const PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY') ?? '';
const SECRET = Deno.env.get('PUSH_SECRET') ?? '';

webpush.setVapidDetails('https://divireon.github.io/gym-log/', PUBLIC_KEY, PRIVATE_KEY);

type Alert = { endpoint: string; p256dh: string; auth: string; title?: string; body?: string };

Deno.serve(async (req) => {
  if (!SECRET || req.headers.get('x-push-secret') !== SECRET) {
    return new Response('forbidden', { status: 403 });
  }
  let alerts: Alert[] = [];
  try { alerts = (await req.json()).alerts ?? []; } catch { return new Response('bad request', { status: 400 }); }

  const results = await Promise.all(alerts.map(async (a) => {
    try {
      await webpush.sendNotification(
        { endpoint: a.endpoint, keys: { p256dh: a.p256dh, auth: a.auth } },
        JSON.stringify({ title: a.title ?? 'Rest over', body: a.body ?? 'Time for your next set' }),
        { TTL: 60, urgency: 'high' },
      );
      return { ok: true };
    } catch (err) {
      const e = err as { statusCode?: number; body?: string; message?: string };
      return { ok: false, status: e.statusCode ?? null, error: (e.body || e.message || '').slice(0, 200) };
    }
  }));

  return Response.json({ sent: results.filter((r) => r.ok).length, results });
});
