# Gym Log — notes for Claude

Personal, single-user, phone-first workout tracker (PWA). Built with the owner in Claude Code over
several sessions; this file carries that context to any new session or computer. **The repo is
public: never put secrets, emails or other personal details in committed files.**

Live app: https://divireon.github.io/gym-log/ (GitHub Pages from `main`, folder `/`).
The owner uses it as an installed home-screen app on an iPhone 18 Pro and syncs with a desktop browser.

## Stack and files

Vanilla JS ES modules, no build step, no dependencies. Dark UI (pure black, teal accent), compact.
Units: lb and miles.

- `index.html`, `css/styles.css`, `manifest.webmanifest`, `icons/`
- `js/app.js` — all views, navigation, actions (big file; sections marked `// ---------- name ----------`)
- `js/store.js` — local-first store in localStorage (`gym.data.v1` data, `gym.meta.v1` device-only meta).
  Records carry `updatedAt`, deletes are soft, changes go into an outbox for sync. Demo mode
  (`enterDemo`/`exitDemo`) swaps in in-memory sample data and writes nothing.
- `js/sync.js` — Supabase sync over plain REST (email+password sign-in, push outbox, pull by `synced_at`,
  newer `updatedAt` wins; a DB trigger refuses older copies). Skips while in demo mode.
- `js/push.js` + push handler in `sw.js` — lock-screen "Rest over" Web Push alerts.
- `js/seed.js` (built-in exercises, fixed ids `ex_<slug>`), `js/charts.js` (SVG charts),
  `js/demo.js` (tutorial sample data), `js/tour.js` (spotlight tour engine; steps are `TOUR_STEPS` in app.js).
- `js/config.js` — Supabase URL, publishable key, VAPID public key (all public by design).
- `sw.js` — offline cache (stale-while-revalidate, always fetches fresh with no-cache/reload).
- `version.json` — read live by the app's update check ("Update available" banner).
- `supabase/setup.sql` (sync table + RLS + guard trigger), `supabase/push.sql` (rest_alerts,
  push_subscriptions, pg_cron every 2 s + pg_net → Edge Function), `supabase/functions/rest-push/index.ts`
  (deployed in the dashboard as `rest-push`, JWT verification OFF, secrets VAPID_PUBLIC_KEY /
  VAPID_PRIVATE_KEY / PUSH_SECRET).
- `SETUP.md` — the owner's original setup guide.

Secret files `supabase/*.local.*` are gitignored and exist only on the owner's machines / password manager.
They are only needed to redo the push setup; their values already live in Supabase.

## Features (current: v1.7.0)

Lifting / bodyweight / timed sets; routines + freestyle; runs (stopwatch or manual); auto-start
per-exercise rest timer; lock-screen push buzz when rest ends (the in-app beep was removed on
purpose: the phone stays locked in a pocket); double-progression suggestions ("add a rep" / "add
weight", per-exercise rep range + weight jump); PRs; goals; strength charts; workout length;
consistency heatmap; body weight; history; cloud sync; backup export/import; in-app updates;
guided tour with sample data (Settings → Take the tour).

Set logging is "✓ first, adjust after": ✓ always logs and starts rest (empty boxes take the
targets; if none, the set is logged blank and highlighted, Finish warns). Number cells open a
+/− panel instead of the keyboard. Exercise search is a fixed-height panel pinned to the top.

## Publishing a change

1. Bump **all three**: `VERSION` in `js/app.js`, `version.json`, and `CACHE` in `sw.js`.
   If you add a JS file, add it to `ASSETS` in `sw.js` and `APP_FILES` in `js/app.js`.
2. Commit with the owner's GitHub noreply identity (set per clone):
   `git config user.name divireon` and
   `git config user.email 357460019+divireon@users.noreply.github.com`.
   On Windows PowerShell 5.1, pass multi-line messages with `git commit -F <file>`.
3. `git push origin main`, then poll `https://divireon.github.io/gym-log/version.json` until it shows
   the new version. The owner's phone picks it up via the "Update available" banner.
4. If you add a feature, add a step for it to `TOUR_STEPS`.

## Testing

- Preview: `.claude/launch.json` runs `python -m http.server 5173 --bind 127.0.0.1`.
  The service worker is skipped on localhost/127.0.0.1 unless the URL has `?sw=1`.
- Test on `http://127.0.0.1:5173` (a different origin from `localhost`), so the owner's own
  preview data on `localhost` isn't wiped. Clear test data afterwards.
- Use phone size (375×812). When the preview pane is hidden it pauses CSS animations/transitions
  and screenshots can be stale or cropped: measure layout with `offsetTop` / element styles
  instead of trusting screenshots.
- iPhone specifics learned the hard way: home-screen apps with a translucent status bar size the
  page short (fixed with `html { min-height: calc(100% + env(safe-area-inset-top)) }`); the keyboard
  overlays the page, so sheets are sized from `window.visualViewport` (`--vv-h` / `--vv-top`);
  web apps can't vibrate or lower other apps' audio.

## Working with the owner

- Likes to "vibe code": ask clarifying questions (multiple choice works well) before building.
- Wants a clean, compact, dark look; plain-language explanations; short status updates.
- Claude must not type secrets (keys, the push secret, SQL containing it) into websites; the owner
  pastes those. SQL meant for pasting must be UTF-8 **without BOM**.
- The Supabase dashboard is operated through the owner's browser with the Claude extension when needed.
