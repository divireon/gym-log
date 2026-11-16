import * as S from './store.js';
import { SEED_EXERCISES } from './seed.js';
import { lineChart, sparkline } from './charts.js';
import * as Sync from './sync.js';

const VERSION = '1.3.0'; // keep in step with version.json when publishing
const DAY = 86400000;
const app = document.getElementById('app');
const tabbar = document.getElementById('tabbar');
const restEl = document.getElementById('rest');
const sheetEl = document.getElementById('sheet');
const toastEl = document.getElementById('toast');

// ---------- first-run seed ----------
let added = false;
for (const e of SEED_EXERCISES) added = S.seed('exercises', e) || added;
if (added) S.commit();
try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch {}

// ---------- utils ----------
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = n => String(n).padStart(2, '0');
const clone = o => JSON.parse(JSON.stringify(o));
const fmtNum = (n, d = 0) => Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: d });

function fmtClock(sec) {
  sec = Math.max(0, Math.round(sec || 0));
  const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60;
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}
/** "1:02:03", "28:30", "28.30" -> seconds. A bare number counts as `bare` units ('sec' or 'min'). */
function parseClock(str, bare = 'sec') {
  const v = String(str ?? '').trim();
  if (!v) return null;
  const parts = v.split(/[:.]/).map(p => (p === '' ? 0 : Number(p)));
  if (parts.some(p => isNaN(p) || p < 0)) return null;
  if (parts.length === 1) return Math.round(bare === 'min' ? parts[0] * 60 : parts[0]);
  return Math.round(parts.reduce((a, p) => a * 60 + p, 0));
}
function fmtDur(sec) {
  const m = Math.max(1, Math.round(sec / 60));
  return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${pad(m % 60)}m`;
}
const startOfDay = t => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
function weekStart(t) { const d = new Date(t); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.getTime(); }
function shiftDays(t, n) { const d = new Date(t); d.setDate(d.getDate() + n); return d.getTime(); }
const isoDate = t => { const d = new Date(t); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
function fromIso(v) { const [y, m, d] = String(v).split('-').map(Number); return y ? new Date(y, m - 1, d, 12).getTime() : null; }
function dateLabel(t) {
  const diff = Math.round((startOfDay(Date.now()) - startOfDay(t)) / DAY);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  const d = new Date(t);
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', ...(d.getFullYear() !== new Date().getFullYear() ? { year: 'numeric' } : {}) });
}
function relDays(t) {
  const d = Math.round((startOfDay(Date.now()) - startOfDay(t)) / DAY);
  if (d <= 0) return 'today';
  if (d === 1) return 'yesterday';
  if (d < 7) return `${d} days ago`;
  if (d < 60) { const w = Math.floor(d / 7); return `${w} week${w > 1 ? 's' : ''} ago`; }
  return new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}
const timeOfDay = t => new Date(t).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
const e1rm = (lb, reps) => (lb > 0 && reps > 0 ? (reps === 1 ? lb : lb * (1 + reps / 30)) : 0);
const fmtPace = (sec, mi) => (mi > 0 && sec > 0 ? fmtClock(sec / mi) : '—');
const num = v => (v === '' || v == null ? '' : v);

// ---------- icons ----------
const P = {
  dumbbell: '<path d="M6.5 7v10M17.5 7v10M3.5 9.5v5M20.5 9.5v5M6.5 12h11"/>',
  history: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  chart: '<path d="M4 19.5h16M7 16v-4.5M12 16V7.5M17 16v-8"/>',
  sliders: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  chev: '<path d="M9.5 6l6 6-6 6"/>',
  x: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
  up: '<path d="M12 18.5V5.5M6.5 11L12 5.5l5.5 5.5"/>',
  down: '<path d="M12 5.5v13M6.5 13l5.5 5.5 5.5-5.5"/>',
  timer: '<circle cx="12" cy="13.5" r="7.5"/><path d="M12 10v3.5l2 1.5M9.5 2.5h5"/>',
  run: '<circle cx="15" cy="4.5" r="1.8"/><path d="M7 21l3.2-6.2L13.5 17v4M5.5 11.5l3-3.5 4.5 1 2 3.5 3.5 1M10.2 14.8l1.3-5.3"/>',
  trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0V4zM8 6H5v1.5A3 3 0 0 0 8 10.5M16 6h3v1.5a3 3 0 0 1-3 3M12 13v4M8.5 20h7M10 17h4"/>',
  cloud: '<path d="M7 18h10.5a3.5 3.5 0 0 0 .4-7A5.5 5.5 0 0 0 7.3 9.6 4.2 4.2 0 0 0 7 18z"/>',
};
const icon = (n, s = 22) => `<svg class="i" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n]}</svg>`;

// ---------- domain helpers ----------
const TYPES = { weight: 'Weight × reps', bodyweight: 'Bodyweight reps', time: 'Timed hold' };
const TYPE_SHORT = { weight: 'lb × reps', bodyweight: 'reps', time: 'time' };
const GROUPS = ['Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core', 'Other'];
const REST_OPTS = [0, 30, 45, 60, 75, 90, 120, 150, 180, 240, 300];

const ex = id => S.get('exercises', id);
const exName = id => (ex(id) ? ex(id).name : 'Unknown exercise');
const exType = id => (ex(id) ? ex(id).type : 'weight');
const finished = () => S.all('workouts').filter(w => w.endedAt).sort((a, b) => b.startedAt - a.startedAt);
const runList = () => S.all('runs').sort((a, b) => b.date - a.date);
const activities = () => [...finished().map(w => w.startedAt), ...S.all('runs').map(r => r.date)];
const newSet = () => ({ id: S.uid(), lb: '', reps: '', sec: '', done: false });

function activeWorkout() {
  const id = S.getMeta('activeWorkoutId');
  const w = id && S.get('workouts', id);
  return w && !w.deleted && !w.endedAt ? w : null;
}

/** Sets from the most recent finished workout that included this exercise. */
function lastSession(exId, excludeWid) {
  for (const w of finished()) {
    if (w.id === excludeWid) continue;
    for (const en of w.entries) {
      if (en.exId !== exId) continue;
      const sets = en.sets.filter(s => s.done);
      if (sets.length) return sets;
    }
  }
  return null;
}

/** Every finished session of an exercise, oldest first. */
function sessionsFor(exId) {
  const out = [];
  for (const w of finished()) for (const en of w.entries) {
    if (en.exId !== exId) continue;
    const sets = en.sets.filter(s => s.done);
    if (sets.length) out.push({ w, at: w.startedAt, sets });
  }
  return out.reverse();
}

function bests(exId, { skipSetId = null, excludeWorkout = null } = {}) {
  const b = { e1rm: 0, lb: 0, reps: 0, sec: 0, best: null, any: false };
  for (const w of S.all('workouts')) {
    if (w.id === excludeWorkout) continue;
    for (const en of w.entries) {
      if (en.exId !== exId) continue;
      for (const s of en.sets) {
        if (!s.done || s.id === skipSetId) continue;
        b.any = true;
        const lb = +s.lb || 0, reps = +s.reps || 0, sec = +s.sec || 0;
        const e = e1rm(lb, reps);
        if (e > b.e1rm) { b.e1rm = e; b.best = s; }
        b.lb = Math.max(b.lb, lb); b.reps = Math.max(b.reps, reps); b.sec = Math.max(b.sec, sec);
      }
    }
  }
  return b;
}

/** A set is a PR if it beats everything before it, and there IS history from other workouts. */
function isPR(exId, set, wid) {
  if (!bests(exId, { excludeWorkout: wid }).any) return false;
  const prev = bests(exId, { skipSetId: set.id });
  const t = exType(exId), lb = +set.lb || 0, reps = +set.reps || 0, sec = +set.sec || 0;
  if (t === 'weight') return e1rm(lb, reps) > prev.e1rm + 0.01 || lb > prev.lb;
  if (t === 'bodyweight') return reps > prev.reps || (lb > 0 && lb > prev.lb);
  return sec > prev.sec;
}

function wStats(w) {
  let sets = 0, vol = 0, prs = 0;
  for (const en of w.entries) for (const s of en.sets) {
    if (!s.done) continue;
    sets++;
    if (exType(en.exId) === 'weight') vol += (+s.lb || 0) * (+s.reps || 0);
    if (s.pr) prs++;
  }
  return { sets, vol, prs, dur: ((w.endedAt || Date.now()) - w.startedAt) / 1000 };
}

function weekStreak() {
  const weeks = new Set(activities().map(weekStart));
  let w = weekStart(Date.now());
  if (!weeks.has(w)) w = weekStart(shiftDays(w, -7)); // the current week isn't over yet
  let n = 0;
  while (weeks.has(w)) { n++; w = weekStart(shiftDays(w, -7)); }
  return n;
}

function fmtSetShort(t, s) {
  if (!s) return '—';
  if (t === 'time') return fmtClock(+s.sec);
  if (t === 'bodyweight') return (+s.lb > 0 ? `+${fmtNum(s.lb, 1)} × ` : '') + (s.reps || 0);
  return `${fmtNum(s.lb, 1)} × ${s.reps || 0}`;
}
function fmtSetLong(t, s) {
  if (t === 'time') return fmtClock(+s.sec);
  if (t === 'bodyweight') return (+s.lb > 0 ? `+${fmtNum(s.lb, 1)} lb × ${s.reps}` : `${s.reps} reps`);
  return `${fmtNum(s.lb, 1)} lb × ${s.reps}`;
}

// ---------- progression (double progression) ----------
// Work inside a rep range. Add reps at the same weight until every working set hits the top,
// then add weight and drop back to the bottom of the range.
const LOWER_BODY = new Set(['ex_squat_barbell', 'ex_front_squat', 'ex_deadlift', 'ex_romanian_deadlift', 'ex_leg_press', 'ex_hip_thrust']);

function progCfg(e) {
  let repMin = 8, repMax = 12, inc = 5;
  if (e.type === 'bodyweight') {
    const hard = /pull-up|chin-up|dip/i.test(e.name || '');
    repMin = hard ? 5 : 8; repMax = hard ? 10 : 15;
  } else if (e.type === 'weight') {
    if ((e.rest || 0) >= 150) { repMin = 5; repMax = 8; }
    if (LOWER_BODY.has(e.id)) inc = 10;
  }
  return { repMin: +e.repMin || repMin, repMax: +e.repMax || repMax, inc: +e.inc || inc };
}

/** What to aim for next session, based on the last one. Returns {mode, text (HTML), targets[]} */
function suggest(exId, wid) {
  const e = ex(exId);
  if (!e) return null;
  const c = progCfg(e);
  const last = lastSession(exId, wid);
  if (!last) {
    return {
      mode: 'new', targets: [],
      text: e.type === 'time' ? 'First time: hold as long as you can with good form.'
        : e.type === 'bodyweight' ? `First time: do as many clean reps as you can. Goal range is ${c.repMin}–${c.repMax}.`
          : `First time: pick a weight you can lift for ${c.repMin}–${c.repMax} reps.`,
    };
  }
  if (e.type === 'time') {
    return { mode: 'reps', targets: last.map(s => ({ sec: (+s.sec || 0) + 5 })), text: `Add 5 seconds: aim for <b>${last.map(s => fmtClock((+s.sec || 0) + 5)).join(' / ')}</b>.` };
  }
  const bw = e.type === 'bodyweight';
  const W = Math.max(...last.map(s => +s.lb || 0));
  const isWork = s => (+s.lb || 0) === W; // lighter sets are treated as warm-ups and left alone
  const work = last.filter(isWork);
  const fmtT = (lb, reps) => bw ? (lb > 0 ? `+${fmtNum(lb, 1)} lb × ${reps}` : `${reps} reps`) : `${fmtNum(lb, 1)} lb × ${reps}`;

  if (work.every(s => (+s.reps || 0) >= c.repMax)) {
    if (bw && !W) {
      return { mode: 'weight', targets: last.map(s => ({ lb: '', reps: s.reps })), text: `You hit ${c.repMax}+ reps on every set. Time to add weight (+${c.inc} lb with a belt or vest), or move to a harder variation.` };
    }
    const nw = W + c.inc;
    return {
      mode: 'weight',
      targets: last.map(s => isWork(s) ? { lb: nw, reps: c.repMin } : { lb: s.lb, reps: s.reps }),
      text: `You hit ${c.repMax} reps on every set. Add weight: <b>${fmtT(nw, c.repMin)}</b>.`,
    };
  }
  const targets = last.map(s => isWork(s) ? { lb: s.lb, reps: Math.min(c.repMax, (+s.reps || 0) + 1) } : { lb: s.lb, reps: s.reps });
  const reps = targets.filter((_, i) => isWork(last[i])).map(t => t.reps).join(' / ');
  if (work.some(s => (+s.reps || 0) < c.repMin)) {
    return { mode: 'hold', targets, text: `Same weight, build back up: <b>${fmtT(W, reps)}</b>. Aim for ${c.repMin}+ reps.` };
  }
  return { mode: 'reps', targets, text: `Add a rep: <b>${fmtT(W, reps)}</b>. Add weight once every set hits ${c.repMax}.` };
}

/** Values the set inputs suggest (and use when you tap ✓ with empty boxes). */
function targetsFor(exId, wid) {
  const s = suggest(exId, wid);
  return s && s.targets.length ? s.targets : (lastSession(exId, wid) || []);
}

// ---------- goals ----------
const GOAL_KINDS = { lift: 'Lift a weight', bodyweight: 'Reach a body weight', run_dist: 'Run a distance', run_pace: 'Hit a running pace', weekly: 'Workouts per week' };

function goalCurrent(g) {
  switch (g.kind) {
    case 'lift': { const b = bests(g.exId); return b.any ? b.lb : null; }
    case 'bodyweight': { const l = S.all('bodyweights').sort((a, b) => b.date - a.date)[0]; return l ? l.lb : null; }
    case 'run_dist': { const r = S.all('runs'); return r.length ? Math.max(...r.map(x => x.distance)) : null; }
    case 'run_pace': { const r = S.all('runs'); return r.length ? Math.min(...r.map(x => x.duration / x.distance)) : null; }
    case 'weekly': return activities().filter(t => t >= weekStart(Date.now())).length;
  }
  return null;
}
function goalStart(g) {
  if (g.start != null) return g.start;
  if (g.kind === 'bodyweight') { const f = S.all('bodyweights').sort((a, b) => a.date - b.date)[0]; return f ? f.lb : null; }
  if (g.kind === 'run_pace') { const r = runList(); const o = r[r.length - 1]; return o ? o.duration / o.distance : null; }
  return 0;
}
function goalProgress(g) {
  const cur = goalCurrent(g);
  if (g.kind === 'weekly') return { cur, frac: Math.min(1, cur / g.target), done: cur >= g.target };
  if (cur == null) return { cur, frac: 0, done: !!g.achievedAt };
  const start = goalStart(g);
  const lowerBetter = g.kind === 'run_pace' || (g.kind === 'bodyweight' && start != null && g.target < start);
  const done = lowerBetter ? cur <= g.target : cur >= g.target;
  if (done || g.achievedAt) return { cur, frac: 1, done: true };
  const s = start ?? cur, span = g.target - s;
  return { cur, frac: span === 0 ? 0 : Math.max(0, Math.min(1, (cur - s) / span)), done: false };
}
function goalFmt(g, v) {
  if (v == null) return '—';
  if (g.kind === 'run_dist') return `${fmtNum(v, 2)} mi`;
  if (g.kind === 'run_pace') return `${fmtClock(v)} /mi`;
  if (g.kind === 'weekly') return String(v);
  return `${fmtNum(v, 1)} lb`;
}
function goalTitle(g) {
  switch (g.kind) {
    case 'lift': return `${exName(g.exId)}: ${fmtNum(g.target, 1)} lb`;
    case 'bodyweight': return `Body weight ${fmtNum(g.target, 1)} lb`;
    case 'run_dist': return `Run ${fmtNum(g.target, 2)} miles`;
    case 'run_pace': return `Run a ${fmtClock(g.target)} /mi pace`;
    case 'weekly': return `${g.target} workouts a week`;
  }
  return 'Goal';
}
function checkGoals() {
  for (const g of S.all('goals')) {
    if (g.kind === 'weekly' || g.achievedAt) continue;
    if (goalProgress(g).done) {
      g.achievedAt = Date.now();
      S.put('goals', g);
      toast('Goal reached: ' + goalTitle(g), 'gold');
    }
  }
}

// ---------- navigation ----------
let nav = { tab: 'workout', screen: null, id: null, opts: {} };
const stack = [];
let ignorePop = false;
history.replaceState({ d: 0 }, '');

function go(tab) {
  const n = stack.length;
  stack.length = 0;
  nav = { tab, screen: null, id: null, opts: {} };
  render(true);
  if (n) { ignorePop = true; history.go(-n); }
}
function open(screen, id = null, opts = {}) {
  if (ON_OPEN[screen]) ON_OPEN[screen](id);
  stack.push(nav);
  nav = { tab: nav.tab, screen, id, opts };
  history.pushState({ d: stack.length }, '');
  render(true);
}
function back() {
  if (stack.length) history.back();
  else { nav = { ...nav, screen: null }; render(true); }
}
window.addEventListener('popstate', e => {
  if (!sheetEl.hidden) closeSheet();
  if (ignorePop) { ignorePop = false; return; }
  const d = (e.state && e.state.d) || 0;
  let changed = false;
  while (stack.length > d) { nav = stack.pop(); changed = true; }
  if (changed) render(true);
});

// ---------- render ----------
function render(top = false) {
  let html;
  try {
    html = nav.screen ? SCREENS[nav.screen](nav.id, nav.opts) : TABS[nav.tab]();
  } catch (err) {
    console.error(err);
    html = `${topBar('Something went wrong')}<div class="empty">${esc(err.message)}</div>`;
  }
  app.innerHTML = html;
  renderTabbar();
  tick();
  syncWakeLock();
  if (top) window.scrollTo(0, 0);
}

function renderTabbar() {
  const tabs = [['workout', 'Workout', 'dumbbell'], ['history', 'History', 'history'], ['progress', 'Progress', 'chart'], ['settings', 'Settings', 'sliders']];
  const live = !!activeWorkout();
  tabbar.innerHTML = tabs.map(([k, label, ic]) =>
    `<button class="tab ${nav.tab === k ? 'on' : ''}" data-act="tab" data-tab="${k}">${icon(ic)}<span>${label}</span>${k === 'workout' && live ? '<i class="live"></i>' : ''}</button>`
  ).join('');
}

const topBar = (title, right = '') =>
  `<header class="top bar"><button class="icon-btn" data-act="back" aria-label="Back">${icon('back')}</button><div class="bar-title">${title}</div><div class="bar-right">${right}</div></header>`;
const notFound = () => `${topBar('')}<div class="empty">This item no longer exists.</div>`;

// ---------- clocks & rest timer ----------
let rest = S.getMeta('rest') || null;
let restMode = null;

function tick() {
  const now = Date.now();
  const w = activeWorkout();
  document.querySelectorAll('[data-clock="workout"]').forEach(el => { el.textContent = w ? fmtClock((now - w.startedAt) / 1000) : ''; });
  const runEls = document.querySelectorAll('[data-clock="run"]');
  if (runEls.length) {
    const t = fmtClock(runElapsed() / 1000);
    runEls.forEach(el => { el.textContent = t; });
    updatePace();
  }
  renderRest(now);
}
setInterval(tick, 250);

function startRest(sec, label) {
  rest = { endAt: Date.now() + sec * 1000, total: sec, label, alerted: false };
  S.setMeta('rest', rest);
  restMode = null;
  renderRest();
}
function clearRest() { rest = null; S.setMeta('rest', null); restMode = null; renderRest(); }

function renderRest(now = Date.now()) {
  if (!rest) {
    if (!restEl.hidden) { restEl.hidden = true; restMode = null; }
    document.body.classList.remove('has-rest');
    return;
  }
  const left = (rest.endAt - now) / 1000;
  if (left <= 0 && !rest.alerted) { rest.alerted = true; S.setMeta('rest', rest); if (left > -3) restAlert(); }
  if (left < -8) { clearRest(); return; }
  const mode = left > 0 ? 'run' : 'done';
  if (mode !== restMode) {
    restMode = mode;
    restEl.className = 'rest ' + mode;
    restEl.innerHTML = mode === 'run'
      ? `<div class="rest-bar"><i></i></div><div class="rest-row"><div class="rest-info"><span class="rest-label">Rest · ${esc(rest.label)}</span><span class="rest-time"></span></div><div class="rest-btns"><button class="btn sm ghost" data-act="rest-adj" data-d="-15">−15</button><button class="btn sm ghost" data-act="rest-adj" data-d="15">+15</button><button class="btn sm" data-act="rest-skip">Skip</button></div></div>`
      : `<div class="rest-row"><div class="rest-info"><span class="rest-label">Rest over</span><span class="rest-time">Next set</span></div><button class="btn sm" data-act="rest-skip">Dismiss</button></div>`;
  }
  restEl.hidden = false;
  document.body.classList.add('has-rest');
  if (mode === 'run') {
    restEl.querySelector('.rest-time').textContent = fmtClock(Math.ceil(left));
    restEl.querySelector('.rest-bar i').style.width = Math.min(100, (1 - left / rest.total) * 100) + '%';
  }
}

let actx = null;
function unlockAudio() {
  try {
    if (!actx) { const C = window.AudioContext || window.webkitAudioContext; if (C) actx = new C(); }
    if (actx && actx.state === 'suspended') actx.resume();
  } catch {}
}
function beep() {
  if (!actx) return;
  const t = actx.currentTime;
  [0, 0.22, 0.44].forEach((d, i) => {
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = 'sine';
    o.frequency.value = i === 2 ? 1175 : 880;
    g.gain.setValueAtTime(0.0001, t + d);
    g.gain.exponentialRampToValueAtTime(0.3, t + d + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.17);
    o.connect(g).connect(actx.destination);
    o.start(t + d); o.stop(t + d + 0.2);
  });
}
function restAlert() {
  const st = S.settings();
  if (st.sound) beep();
  if (st.vibrate && navigator.vibrate) navigator.vibrate([250, 120, 250]);
}

let wakeLock = null, wakeBusy = false;
async function syncWakeLock() {
  if (!('wakeLock' in navigator) || wakeBusy) return;
  const want = !!activeWorkout() && S.settings().wakeLock && document.visibilityState === 'visible';
  wakeBusy = true;
  try {
    if (want && !wakeLock) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    } else if (!want && wakeLock) { await wakeLock.release(); wakeLock = null; }
  } catch {} finally { wakeBusy = false; }
}
document.addEventListener('visibilitychange', () => { tick(); syncWakeLock(); });

// ---------- toast & sheets ----------
let toastT;
function toast(msg, kind = '') {
  toastEl.textContent = msg;
  toastEl.className = 'toast show ' + kind;
  clearTimeout(toastT);
  toastT = setTimeout(() => { toastEl.className = 'toast'; }, 2400);
}

let sheetState = null;
function openSheet(html, state) {
  sheetState = state;
  sheetEl.innerHTML = `<div class="sheet-backdrop" data-act="close-sheet"></div><div class="sheet-panel">${html}</div>`;
  sheetEl.hidden = false;
  document.body.classList.add('no-scroll');
}
function closeSheet() {
  const s = sheetState;
  sheetState = null;
  sheetEl.hidden = true;
  sheetEl.innerHTML = '';
  document.body.classList.remove('no-scroll');
  if (s && s.kind === 'confirm') s.res(false);
}
function confirmBox(title, msg, ok = 'OK', danger = false) {
  return new Promise(res => {
    openSheet(`<div class="sheet-pad"><h3>${esc(title)}</h3>${msg ? `<p class="muted">${esc(msg)}</p>` : ''}
      <div class="row gap" style="margin-top:18px"><button class="btn block" data-act="close-sheet">Cancel</button>
      <button class="btn block ${danger ? 'danger' : 'primary'}" data-act="confirm-yes">${esc(ok)}</button></div></div>`, { kind: 'confirm', res });
  });
}

function openPicker(target) {
  openSheet(`<div class="sheet-head"><input id="pick-q" class="input" placeholder="Search or create exercise" autocomplete="off" enterkeyhint="search">
    <button class="btn ghost sm" data-act="close-sheet">Cancel</button></div><div class="sheet-body" id="pick-list"></div>`, { kind: 'picker', target });
  renderPickList('');
}
function renderPickList(q) {
  const list = document.getElementById('pick-list');
  if (!list) return;
  const qq = q.trim().toLowerCase();
  const items = S.all('exercises').filter(e => !qq || e.name.toLowerCase().includes(qq)).sort((a, b) => a.name.localeCompare(b.name));
  const groups = {};
  for (const e of items) (groups[GROUPS.includes(e.group) ? e.group : 'Other'] ||= []).push(e);
  let h = '';
  if (qq && !items.some(e => e.name.toLowerCase() === qq)) {
    h += `<button class="pick-item create" data-act="pick-create">${icon('plus', 18)}<span>Create “${esc(q.trim())}”</span></button>`;
  }
  for (const g of GROUPS) {
    if (!groups[g]) continue;
    h += `<div class="pick-group">${g}</div>` + groups[g].map(e =>
      `<button class="pick-item" data-act="pick" data-id="${e.id}"><span>${esc(e.name)}</span><small>${TYPE_SHORT[e.type]}</small></button>`).join('');
  }
  list.innerHTML = h || '<p class="muted" style="padding:16px">No exercises found.</p>';
}

function openRestSheet(exId) {
  const e = ex(exId);
  if (!e) return;
  openSheet(`<div class="sheet-pad"><h3>Rest timer</h3><p class="muted">${esc(e.name)}. Starts automatically each time you complete a set.</p>
    <div class="chips">${REST_OPTS.map(s => `<button class="chip ${(e.rest || 0) === s ? 'on' : ''}" data-act="set-rest" data-ex="${exId}" data-s="${s}">${s ? fmtClock(s) : 'Off'}</button>`).join('')}</div></div>`, { kind: 'rest' });
}

// ---------- workout flow ----------
function defaultWorkoutName() {
  const h = new Date().getHours();
  return h < 12 ? 'Morning workout' : h < 17 ? 'Afternoon workout' : 'Evening workout';
}
function makeEntry(exId, count) {
  const last = lastSession(exId);
  const n = count || (last ? last.length : 3);
  return { id: S.uid(), exId, sets: Array.from({ length: n }, newSet) };
}
function startWorkout(routine) {
  if (activeWorkout()) { toast('Finish your current workout first'); go('workout'); return; }
  const w = { id: S.uid(), name: routine ? routine.name : defaultWorkoutName(), routineId: routine ? routine.id : null, startedAt: Date.now(), endedAt: null, entries: [] };
  if (routine) for (const it of routine.items) if (ex(it.exId)) w.entries.push(makeEntry(it.exId, it.sets));
  S.put('workouts', w);
  S.setMeta('activeWorkoutId', w.id);
  go('workout');
}
function discardWorkout(w) {
  S.remove('workouts', w.id);
  S.setMeta('activeWorkoutId', null);
  clearRest();
  render(true);
}
/** Value to suggest for set j: same set last session, else last set last session, else the set above. */
function hintFor(en, j, prev) {
  const p = prev[j] || prev[prev.length - 1];
  if (p) return p;
  for (let k = j - 1; k >= 0; k--) {
    const s = en.sets[k];
    if (s.lb !== '' || s.reps !== '' || s.sec !== '') return s;
  }
  return {};
}
function findSet(w, el) {
  const card = el.closest('[data-entry]');
  const en = card && w.entries.find(x => x.id === card.dataset.entry);
  if (!en) return {};
  const row = el.closest('[data-set]');
  const j = row ? en.sets.findIndex(x => x.id === row.dataset.set) : -1;
  return { en, j, s: en.sets[j] };
}

// ---------- views: workout tab ----------
function viewHome() {
  const routines = S.all('routines').sort((a, b) => a.name.localeCompare(b.name));
  const wk = activities().filter(t => t >= weekStart(Date.now())).length;
  const fins = finished();
  return `<header class="top"><h1>Workout</h1></header>
    ${updateBanner()}
    <div class="stats3">
      <div class="stat"><b>${wk}</b><span>this week</span></div>
      <div class="stat"><b>${weekStreak()}</b><span>week streak</span></div>
      <div class="stat"><b>${fins.length + S.all('runs').length}</b><span>all time</span></div>
    </div>
    <div class="stack">
      <button class="btn primary big block" data-act="start">${icon('plus')} Start empty workout</button>
      <button class="btn big block" data-act="open" data-screen="run" data-id="new">${icon('run')} Log a run</button>
    </div>
    <div class="section-head"><h2>Routines</h2><button class="btn ghost sm" data-act="open" data-screen="routine" data-id="new">${icon('plus', 18)} New</button></div>
    ${routines.length ? routines.map(r => {
      const names = r.items.map(i => exName(i.exId));
      const last = fins.find(w => w.routineId === r.id);
      return `<div class="card routine">
        <div class="routine-main" data-act="open" data-screen="routine" data-id="${r.id}">
          <div class="routine-name">${esc(r.name)}</div>
          <div class="muted small clamp">${esc(names.slice(0, 4).join(', '))}${names.length > 4 ? ` +${names.length - 4} more` : ''}</div>
          <div class="faint small">${last ? 'Last done ' + relDays(last.startedAt) : 'Not done yet'}</div>
        </div>
        <button class="btn primary sm" data-act="start" data-routine="${r.id}">Start</button>
      </div>`;
    }).join('') : `<div class="empty">No routines yet. Build one like “Push Day” and start it with one tap. Your weights from last time come with it.</div>`}`;
}

function viewActive(w) {
  return `<header class="top sticky wk-head">
      <div class="wk-title"><input class="title-input" data-bind="w-name" value="${esc(w.name)}" aria-label="Workout name" enterkeyhint="done">
        <div class="muted small row" style="gap:5px">${icon('timer', 15)}<span data-clock="workout"></span></div></div>
      <button class="btn primary sm" data-act="finish">Finish</button>
    </header>
    ${w.entries.map(en => entryCard(w, en)).join('') || `<div class="empty">Add your first exercise to get going.</div>`}
    <div class="stack">
      <button class="btn block" data-act="pick-ex" data-for="workout">${icon('plus')} Add exercise</button>
      <button class="btn ghost danger-text block" data-act="discard">Discard workout</button>
    </div>`;
}

function entryCard(w, en) {
  const e = ex(en.exId) || { name: 'Unknown exercise', type: 'weight', rest: 0 };
  const t = e.type;
  const prev = lastSession(en.exId, w.id) || [];
  const sug = suggest(en.exId, w.id);
  const targets = sug && sug.targets.length ? sug.targets : prev;
  const cols = t === 'weight' ? ['lb', 'Reps'] : t === 'bodyweight' ? ['+lb', 'Reps'] : ['Time'];
  const sugIcon = { weight: 'up', reps: 'plus', hold: 'back', new: 'chev' };
  return `<section class="card entry" data-entry="${en.id}">
    <div class="entry-head">
      <button class="entry-name" data-act="open" data-screen="exercise" data-id="${en.exId}">${esc(e.name)}</button>
      <button class="chip" data-act="rest-sheet" data-ex="${en.exId}" aria-label="Rest timer">${icon('timer', 14)}${e.rest ? fmtClock(e.rest) : 'Off'}</button>
      <button class="icon-btn" data-act="remove-entry" aria-label="Remove exercise">${icon('x', 18)}</button>
    </div>
    ${sug ? `<div class="sug sug-${sug.mode}">${icon(sugIcon[sug.mode] || 'chev', 15)}<span>${sug.text}</span></div>` : ''}
    <div class="set-grid set-head t-${t}"><span>Set</span><span>Last time</span>${cols.map(c => `<span>${c}</span>`).join('')}<span></span></div>
    ${en.sets.map((s, j) => setRow(t, en, s, j, prev, targets)).join('')}
    <div class="entry-foot">
      <button class="btn ghost sm" data-act="add-set">${icon('plus', 16)} Add set</button>
      ${en.sets.length > 1 ? `<button class="btn ghost sm muted-btn" data-act="remove-set">${icon('minus', 16)} Remove set</button>` : ''}
    </div>
  </section>`;
}

function setRow(t, en, s, j, prev, targets) {
  const h = hintFor(en, j, targets);
  let inputs;
  if (t === 'time') {
    inputs = `<input class="set-in" data-f="sec" inputmode="decimal" placeholder="${h.sec ? fmtClock(h.sec) : '0:30'}" value="${s.sec !== '' && s.sec != null ? fmtClock(s.sec) : ''}" aria-label="Time">`;
  } else {
    const lbPh = t === 'bodyweight' ? (+h.lb > 0 ? h.lb : '0') : num(h.lb);
    inputs = `<input class="set-in" data-f="lb" inputmode="decimal" placeholder="${esc(lbPh)}" value="${esc(num(s.lb))}" aria-label="Weight">
      <input class="set-in" data-f="reps" inputmode="numeric" placeholder="${esc(num(h.reps))}" value="${esc(num(s.reps))}" aria-label="Reps">`;
  }
  return `<div class="set-grid set t-${t} ${s.done ? 'done' : ''} ${s.pr ? 'pr' : ''}" data-set="${s.id}">
    <span class="set-no">${j + 1}</span>
    <span class="prev">${prev[j] ? fmtSetShort(t, prev[j]) : '—'}</span>
    ${inputs}
    <button class="check" data-act="toggle-set" aria-label="${s.done ? 'Undo set' : 'Complete set'}">${s.pr ? '<b>PR</b>' : icon('check', 18)}</button>
  </div>`;
}

function viewWorkoutDetail(id, opts = {}) {
  const w = S.get('workouts', id);
  if (!w || w.deleted) return notFound();
  const st = wStats(w);
  return `${topBar('')}
    ${opts.summary ? `<div class="banner">${icon('check')} Workout saved${st.prs ? ` · ${st.prs} new PR${st.prs > 1 ? 's' : ''}` : ''}</div>` : ''}
    <div class="detail-title"><h2>${esc(w.name)}</h2><div class="muted">${dateLabel(w.startedAt)} · ${timeOfDay(w.startedAt)}</div></div>
    <div class="stats3">
      <div class="stat"><b>${fmtDur(st.dur)}</b><span>duration</span></div>
      <div class="stat"><b>${st.sets}</b><span>sets</span></div>
      <div class="stat"><b>${fmtNum(st.vol)}</b><span>lb volume</span></div>
    </div>
    ${w.entries.map(en => {
      const t = exType(en.exId);
      return `<div class="card d-entry"><button class="d-entry-name" data-act="open" data-screen="exercise" data-id="${en.exId}">${esc(exName(en.exId))}</button>
        ${en.sets.filter(s => s.done).map((s, i) => `<div class="d-set"><span class="n">${i + 1}</span><span>${fmtSetLong(t, s)}</span>${s.pr ? '<span class="badge">PR</span>' : ''}</div>`).join('')}</div>`;
    }).join('')}
    <div class="stack">
      <button class="btn block" data-act="save-as-routine" data-id="${w.id}">Save as routine</button>
      <button class="btn ghost danger-text block" data-act="delete-workout" data-id="${w.id}">Delete workout</button>
    </div>`;
}

// ---------- views: runs ----------
let runForm = null;    // form being edited
let newRunDraft = null; // survives leaving the screen mid-run
const rcGet = () => S.getMeta('runClock') || { acc: 0, startAt: null };
function runElapsed() { const c = rcGet(); return c.acc + (c.startAt ? Date.now() - c.startAt : 0); }

function runFormSeconds() {
  const typed = parseClock(runForm && runForm.time, 'min');
  if (typed) return typed;
  return runForm && !runForm.id ? Math.round(runElapsed() / 1000) : 0;
}
function paceHTML() {
  if (!runForm) return '';
  const mi = parseFloat(String(runForm.dist).replace(',', '.'));
  const sec = runFormSeconds();
  return mi > 0 && sec > 0 ? `Pace <b>${fmtPace(sec, mi)}</b> /mi` : 'Enter distance and time to see your pace';
}
function updatePace() { const el = document.getElementById('run-pace'); if (el) { const h = paceHTML(); if (el.innerHTML !== h) el.innerHTML = h; } }

function viewRun() {
  const f = runForm;
  if (!f) return notFound();
  const editing = !!f.id;
  const c = rcGet();
  const running = !!c.startAt, hasTime = runElapsed() > 0;
  return `${topBar(editing ? 'Edit run' : 'Log a run', `<button class="btn primary sm" data-act="save-run">Save</button>`)}
    ${editing ? '' : `<div class="card stopwatch"><div class="big-time" data-clock="run">0:00</div>
      <div class="row" style="justify-content:center">
        ${running ? `<button class="btn big wide" data-act="run-pause">Pause</button>` : `<button class="btn primary big wide" data-act="run-start">${hasTime ? 'Resume' : 'Start stopwatch'}</button>`}
        ${hasTime && !running ? `<button class="btn big ghost" data-act="run-reset">Reset</button>` : ''}
      </div></div>`}
    <div class="field-row">
      <label class="field"><span>Distance (mi)</span><input class="input" inputmode="decimal" data-bind="run-dist" value="${esc(f.dist)}" placeholder="3.1"></label>
      <label class="field"><span>Time</span><input class="input" inputmode="decimal" data-bind="run-time" value="${esc(f.time)}" placeholder="${editing ? 'mm:ss' : 'stopwatch'}"></label>
    </div>
    <div class="pace-line" id="run-pace">${paceHTML()}</div>
    <label class="field"><span>Date</span><input class="input" type="date" data-bind="run-date" value="${esc(f.date)}" max="${isoDate(Date.now())}"></label>
    <label class="field"><span>Notes</span><textarea class="input" data-bind="run-notes" rows="2" placeholder="Route, treadmill, how it felt…">${esc(f.notes)}</textarea></label>
    ${editing ? `<div class="stack"><button class="btn ghost danger-text block" data-act="delete-run">Delete run</button></div>` : ''}`;
}

// ---------- views: routines ----------
let routineDraft = null;
function viewRoutine() {
  const r = routineDraft;
  if (!r) return notFound();
  return `${topBar(r.id ? 'Edit routine' : 'New routine', `<button class="btn primary sm" data-act="save-routine">Save</button>`)}
    <label class="field"><span>Name</span><input class="input" data-bind="r-name" value="${esc(r.name)}" placeholder="e.g. Push Day"></label>
    <div class="section-head"><h2>Exercises</h2></div>
    ${r.items.length ? `<div class="card list">${r.items.map((it, i) => `<div class="r-item" data-i="${i}">
        <div class="r-top"><div class="r-name">${esc(exName(it.exId))}</div>
          <button class="icon-btn" data-act="r-remove" aria-label="Remove">${icon('x', 18)}</button></div>
        <div class="r-ctrl">
          <div class="stepper"><button class="icon-btn" data-act="r-sets" data-d="-1" aria-label="Fewer sets">${icon('minus', 18)}</button><span>${it.sets} set${it.sets > 1 ? 's' : ''}</span><button class="icon-btn" data-act="r-sets" data-d="1" aria-label="More sets">${icon('plus', 18)}</button></div>
          <div class="row" style="gap:2px"><button class="icon-btn" data-act="r-move" data-d="-1" ${i === 0 ? 'disabled' : ''} aria-label="Move up">${icon('up', 18)}</button><button class="icon-btn" data-act="r-move" data-d="1" ${i === r.items.length - 1 ? 'disabled' : ''} aria-label="Move down">${icon('down', 18)}</button></div>
        </div></div>`).join('')}</div>` : `<div class="empty">No exercises yet.</div>`}
    <div class="stack">
      <button class="btn block" data-act="pick-ex" data-for="routine">${icon('plus')} Add exercise</button>
      ${r.id ? `<button class="btn ghost danger-text block" data-act="delete-routine">Delete routine</button>` : ''}
    </div>`;
}

// ---------- views: exercises ----------
function viewExercise(id, opts = {}) {
  const e = ex(id);
  if (!e || e.deleted) return notFound();
  const t = e.type;
  const sess = sessionsFor(id);
  const b = bests(id);
  const metric = opts.metric || (t === 'weight' ? 'e1rm' : 'max');

  let records = '';
  if (t === 'weight') {
    records = `<div class="stat"><b>${b.best ? `${fmtNum(b.best.lb, 1)}×${b.best.reps}` : '—'}</b><span>best set</span></div>
      <div class="stat"><b>${b.e1rm ? fmtNum(b.e1rm) : '—'}</b><span>est. 1RM (lb)</span></div>
      <div class="stat"><b>${b.lb ? fmtNum(b.lb, 1) : '—'}</b><span>heaviest (lb)</span></div>`;
  } else if (t === 'bodyweight') {
    records = `<div class="stat"><b>${b.reps || '—'}</b><span>most reps</span></div>
      <div class="stat"><b>${b.lb ? '+' + fmtNum(b.lb, 1) : '—'}</b><span>most added lb</span></div>
      <div class="stat"><b>${sess.length}</b><span>sessions</span></div>`;
  } else {
    records = `<div class="stat"><b>${b.sec ? fmtClock(b.sec) : '—'}</b><span>longest hold</span></div>
      <div class="stat"><b>${sess.length}</b><span>sessions</span></div><div class="stat"><b>${sess.length ? relDays(sess[sess.length - 1].at) : '—'}</b><span>last done</span></div>`;
  }

  let points = [], fmtY = v => fmtNum(v), title = '';
  if (t === 'weight') {
    if (metric === 'top') { title = 'Top weight (lb)'; points = sess.map(s => ({ x: s.at, y: Math.max(...s.sets.map(z => +z.lb || 0)) })); }
    else { title = 'Estimated 1-rep max (lb)'; points = sess.map(s => ({ x: s.at, y: Math.max(...s.sets.map(z => e1rm(+z.lb || 0, +z.reps || 0))) })); }
  } else if (t === 'bodyweight') {
    title = 'Most reps in a set'; points = sess.map(s => ({ x: s.at, y: Math.max(...s.sets.map(z => +z.reps || 0)) }));
  } else {
    title = 'Longest hold'; fmtY = v => fmtClock(v); points = sess.map(s => ({ x: s.at, y: Math.max(...s.sets.map(z => +z.sec || 0)) }));
  }

  return `${topBar('', `<button class="btn ghost sm" data-act="open" data-screen="exercise-edit" data-id="${id}">Edit</button>`)}
    <div class="detail-title"><h2>${esc(e.name)}</h2><div class="muted">${esc(e.group || 'Other')} · ${TYPES[t]}</div></div>
    <button class="chip" data-act="rest-sheet" data-ex="${id}" style="margin:0 0 14px">${icon('timer', 14)} Rest ${e.rest ? fmtClock(e.rest) : 'off'}</button>
    ${(() => {
      const sug = suggest(id, null), c = progCfg(e);
      return sug ? `<div class="card pad next-card"><div class="card-head"><span class="card-title">Next session</span>
        ${t !== 'time' ? `<button class="faint small" data-act="open" data-screen="exercise-edit" data-id="${id}">${c.repMin}–${c.repMax} reps${t === 'weight' ? ` · +${c.inc} lb` : ''}</button>` : ''}</div>
        <p>${sug.text}</p>${sug.targets.length ? `<p class="faint small" style="margin-top:6px">Last time: ${(lastSession(id) || []).map(z => fmtSetShort(t, z)).join(' · ')}</p>` : ''}</div>` : '';
    })()}
    <div class="stats3">${records}</div>
    <div class="card pad">
      <div class="card-head"><span class="card-title">${title}</span>
        ${t === 'weight' ? `<div class="seg"><button class="${metric === 'e1rm' ? 'on' : ''}" data-act="ex-metric" data-m="e1rm">1RM</button><button class="${metric === 'top' ? 'on' : ''}" data-act="ex-metric" data-m="top">Top</button></div>` : ''}</div>
      ${points.length ? lineChart(points, { fmtY }) : '<div class="chart-empty">Log this exercise to see your progress here.</div>'}
      ${t === 'weight' && points.length ? '<p class="faint small" style="margin:8px 0 0">Est. 1RM uses the Epley formula: what you could likely lift once, based on weight × reps.</p>' : ''}
    </div>
    ${sess.length ? `<div class="section-head"><h2>History</h2></div><div class="card list">${sess.slice().reverse().slice(0, 30).map(s => `
      <button class="row-item" data-act="open" data-screen="workout" data-id="${s.w.id}"><div style="min-width:0">
        <div class="small muted">${dateLabel(s.at)}</div>
        <div class="clamp">${s.sets.map(z => fmtSetShort(t, z) + (z.pr ? ' ★' : '')).join(' · ')}</div></div>${icon('chev', 18)}</button>`).join('')}</div>` : ''}`;
}

let exDraft = null;
function viewExerciseEdit() {
  const e = exDraft;
  if (!e) return notFound();
  return `${topBar(e.id ? 'Edit exercise' : 'New exercise', `<button class="btn primary sm" data-act="save-exercise">Save</button>`)}
    <label class="field"><span>Name</span><input class="input" data-bind="x-name" value="${esc(e.name)}" placeholder="e.g. Cable Lateral Raise"></label>
    <label class="field"><span>Type</span><select class="input" data-bind="x-type">${Object.entries(TYPES).map(([k, v]) => `<option value="${k}" ${e.type === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
    <div class="field-row">
      <label class="field"><span>Muscle group</span><select class="input" data-bind="x-group">${GROUPS.map(g => `<option ${e.group === g ? 'selected' : ''}>${g}</option>`).join('')}</select></label>
      <label class="field"><span>Rest timer</span><select class="input" data-bind="x-rest">${REST_OPTS.map(s => `<option value="${s}" ${(e.rest || 0) === s ? 'selected' : ''}>${s ? fmtClock(s) : 'Off'}</option>`).join('')}</select></label>
    </div>
    ${e.type !== 'time' ? `<div class="section-head"><h2>Progression</h2></div>
      <p class="muted small" style="margin:-2px 2px 12px">Add reps at the same weight until every set reaches the top of the range, then add weight and drop back to the bottom.</p>
      <div class="field-row three">
        <label class="field"><span>Min reps</span><input class="input" inputmode="numeric" data-bind="x-repMin" value="${esc(e.repMin)}"></label>
        <label class="field"><span>Max reps</span><input class="input" inputmode="numeric" data-bind="x-repMax" value="${esc(e.repMax)}"></label>
        <label class="field"><span>Add (lb)</span><input class="input" inputmode="decimal" data-bind="x-inc" value="${esc(e.inc)}"></label>
      </div>` : ''}
    ${e.id ? `<div class="stack"><button class="btn ghost danger-text block" data-act="delete-exercise">Delete exercise</button>
      <p class="faint small center">Past workouts keep their history.</p></div>` : ''}`;
}

function viewExerciseList() {
  const items = S.all('exercises').sort((a, b) => a.name.localeCompare(b.name));
  const groups = {};
  for (const e of items) (groups[GROUPS.includes(e.group) ? e.group : 'Other'] ||= []).push(e);
  return `${topBar('Exercises', `<button class="btn ghost sm" data-act="open" data-screen="exercise-edit" data-id="new">${icon('plus', 18)} New</button>`)}
    ${GROUPS.filter(g => groups[g]).map(g => `<div class="section-head"><h2>${g}</h2></div><div class="card list">${groups[g].map(e => `
      <button class="row-item" data-act="open" data-screen="exercise" data-id="${e.id}"><span>${esc(e.name)}</span>
        <span class="meta small">${e.rest ? fmtClock(e.rest) : 'no rest'} ${icon('chev', 18)}</span></button>`).join('')}</div>`).join('')}`;
}

// ---------- views: goals ----------
let goalDraft = null;
function viewGoal() {
  const g = goalDraft;
  if (!g) return notFound();
  const lifts = S.all('exercises').filter(e => e.type === 'weight').sort((a, b) => a.name.localeCompare(b.name));
  const label = { lift: 'Target weight (lb)', bodyweight: 'Target body weight (lb)', run_dist: 'Distance in one run (mi)', run_pace: 'Pace per mile (mm:ss)', weekly: 'Workouts per week (lifting + runs)' }[g.kind];
  const ph = { lift: '225', bodyweight: '180', run_dist: '5', run_pace: '8:00', weekly: '4' }[g.kind];
  const cur = goalCurrent({ ...g, target: 1 });
  return `${topBar(g.id ? 'Edit goal' : 'New goal', `<button class="btn primary sm" data-act="save-goal">Save</button>`)}
    <label class="field"><span>Goal type</span><select class="input" data-bind="g-kind">${Object.entries(GOAL_KINDS).map(([k, v]) => `<option value="${k}" ${g.kind === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
    ${g.kind === 'lift' ? `<label class="field"><span>Exercise</span><select class="input" data-bind="g-ex">${lifts.map(e => `<option value="${e.id}" ${g.exId === e.id ? 'selected' : ''}>${esc(e.name)}</option>`).join('')}</select></label>` : ''}
    <label class="field"><span>${label}</span><input class="input" inputmode="decimal" data-bind="g-target" value="${esc(g.targetText)}" placeholder="${ph}"></label>
    <p class="muted small" style="margin:0 2px">${cur != null ? `Right now: <b class="text">${goalFmt(g, cur)}</b>${g.kind === 'lift' ? ' (heaviest set)' : g.kind === 'weekly' ? ' this week' : ''}` : 'No data logged for this yet.'}</p>
    ${g.id ? `<div class="stack"><button class="btn ghost danger-text block" data-act="delete-goal">Delete goal</button></div>` : ''}`;
}

// ---------- views: history ----------
function viewHistory() {
  const items = [
    ...finished().map(w => ({ kind: 'w', at: w.startedAt, w })),
    ...runList().map(r => ({ kind: 'r', at: r.date, r })),
  ].sort((a, b) => b.at - a.at);
  let h = `<header class="top"><h1>History</h1></header>`;
  if (!items.length) return h + `<div class="empty">Finished workouts and runs show up here.</div>`;
  let month = '';
  for (const it of items) {
    const m = new Date(it.at).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    if (m !== month) { month = m; h += `<div class="section-head"><h2>${m}</h2></div>`; }
    if (it.kind === 'w') {
      const w = it.w, st = wStats(w);
      h += `<button class="card hist" data-act="open" data-screen="workout" data-id="${w.id}">
        <div class="hist-top"><b>${esc(w.name)}</b><span class="muted small">${dateLabel(w.startedAt)}</span></div>
        <div class="muted small">${fmtDur(st.dur)} · ${st.sets} sets${st.vol ? ` · ${fmtNum(st.vol)} lb` : ''}${st.prs ? ` · <span class="gold">${st.prs} PR${st.prs > 1 ? 's' : ''}</span>` : ''}</div>
        <div class="faint small clamp">${esc(w.entries.map(en => exName(en.exId)).join(', '))}</div></button>`;
    } else {
      const r = it.r;
      h += `<button class="card hist" data-act="open" data-screen="run" data-id="${r.id}">
        <div class="hist-top"><b class="row" style="gap:6px">${icon('run', 18)} Run · ${fmtNum(r.distance, 2)} mi</b><span class="muted small">${dateLabel(r.date)}</span></div>
        <div class="muted small">${fmtClock(r.duration)} · ${fmtPace(r.duration, r.distance)} /mi</div>
        ${r.notes ? `<div class="faint small clamp">${esc(r.notes)}</div>` : ''}</button>`;
    }
  }
  return h;
}

// ---------- views: progress ----------
let runMetric = 'pace';
let bwInput = '';

function heatmap() {
  const days = new Map();
  for (const t of activities()) { const k = startOfDay(t); days.set(k, (days.get(k) || 0) + 1); }
  const weeks = 18;
  const first = shiftDays(weekStart(Date.now()), -7 * (weeks - 1));
  const today = startOfDay(Date.now());
  let cells = '';
  for (let i = 0; i < weeks * 7; i++) {
    const k = startOfDay(shiftDays(first, i));
    const n = days.get(k) || 0;
    cells += `<i class="hm l${Math.min(n, 2)}${k === today ? ' today' : ''}${k > today ? ' future' : ''}" title="${new Date(k).toDateString()}${n ? ` · ${n} session${n > 1 ? 's' : ''}` : ''}"></i>`;
  }
  return `<div class="heatmap">${cells}</div><div class="hm-legend"><span>${new Date(first).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span><span>Mon–Sun columns</span><span>Today</span></div>`;
}

function viewProgress() {
  const now = Date.now();
  const acts = activities();
  const ms = new Date(); ms.setDate(1); ms.setHours(0, 0, 0, 0);
  const monthStart = ms.getTime();
  let h = `<header class="top"><h1>Progress</h1></header>`;

  // goals
  const goals = S.all('goals').sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  h += `<div class="section-head first"><h2>Goals</h2><button class="btn ghost sm" data-act="open" data-screen="goal" data-id="new">${icon('plus', 18)} New</button></div>`;
  h += goals.length ? goals.map(g => {
    const p = goalProgress(g);
    const weekly = g.kind === 'weekly';
    const badge = p.done ? `<span class="badge">${weekly ? 'Done this week' : 'Reached'}</span>` : `<span class="muted small">${Math.round(p.frac * 100)}%</span>`;
    const sub = p.cur == null
      ? (g.kind === 'bodyweight' ? 'Log your weight below to track this.' : g.kind === 'lift' ? 'Log this lift to start tracking.' : 'Log a run to start tracking.')
      : `Now ${goalFmt(g, p.cur)}${weekly ? ' this week' : ''} · Goal ${goalFmt(g, g.target)}`;
    return `<button class="card goal ${p.done ? 'reached' : ''}" data-act="open" data-screen="goal" data-id="${g.id}">
      <div class="goal-top"><b class="clamp">${esc(goalTitle(g))}</b>${badge}</div>
      <div class="goal-bar"><i style="width:${(p.frac * 100).toFixed(1)}%"></i></div>
      <div class="muted small">${sub}</div></button>`;
  }).join('') : `<div class="empty">Set a goal like “Bench 225 lb”, “Run 5 miles” or “Reach 180 lb” and track it here.</div>`;

  // consistency
  h += `<div class="section-head"><h2>Consistency</h2></div>
    <div class="stats3">
      <div class="stat"><b>${acts.filter(t => t >= weekStart(now)).length}</b><span>this week</span></div>
      <div class="stat"><b>${weekStreak()}</b><span>week streak</span></div>
      <div class="stat"><b>${acts.filter(t => t >= monthStart).length}</b><span>this month</span></div>
    </div>
    <div class="card pad">${heatmap()}</div>`;

  // strength & PRs
  const list = S.all('exercises').map(e => ({ e, s: sessionsFor(e.id) })).filter(x => x.s.length)
    .sort((a, b) => b.s[b.s.length - 1].at - a.s[a.s.length - 1].at);
  h += `<div class="section-head"><h2>Strength &amp; records</h2></div>`;
  h += list.length ? `<div class="card list">${list.map(({ e, s }) => {
    const b = bests(e.id);
    let right, vals;
    if (e.type === 'weight') {
      right = b.best ? `<b>${fmtNum(b.best.lb, 1)} × ${b.best.reps}</b><small>1RM ${fmtNum(b.e1rm)}</small>` : '';
      vals = s.map(x => Math.max(...x.sets.map(z => e1rm(+z.lb || 0, +z.reps || 0))));
    } else if (e.type === 'bodyweight') {
      right = `<b>${b.reps} reps</b>${b.lb ? `<small>+${fmtNum(b.lb, 1)} lb max</small>` : '<small>best set</small>'}`;
      vals = s.map(x => Math.max(...x.sets.map(z => +z.reps || 0)));
    } else {
      right = `<b>${fmtClock(b.sec)}</b><small>longest</small>`;
      vals = s.map(x => Math.max(...x.sets.map(z => +z.sec || 0)));
    }
    return `<button class="pr-row" data-act="open" data-screen="exercise" data-id="${e.id}">
      <div class="pr-main"><div class="pr-name clamp">${esc(e.name)}</div><div class="faint small">${s.length} session${s.length > 1 ? 's' : ''} · ${relDays(s[s.length - 1].at)}</div></div>
      ${sparkline(vals.slice(-12))}<div class="pr-val">${right}</div></button>`;
  }).join('')}</div>` : `<div class="empty">Finish a workout to see strength charts and personal records.</div>`;

  // workout length (ignore sessions accidentally left running for hours)
  const timed = finished().filter(w => w.endedAt - w.startedAt < 5 * 3600 * 1000);
  h += `<div class="section-head"><h2>Workout length</h2></div>`;
  if (timed.length) {
    const mins = w => (w.endedAt - w.startedAt) / 60000;
    const recent = timed.filter(w => w.startedAt >= now - 30 * DAY);
    const avg = recent.length ? recent.reduce((a, w) => a + mins(w), 0) / recent.length : 0;
    const monthMins = timed.filter(w => w.startedAt >= monthStart).reduce((a, w) => a + mins(w), 0);
    const pts = timed.slice(0, 40).reverse().map(w => ({ x: w.startedAt, y: mins(w) }));
    h += `<div class="stats3">
        <div class="stat"><b>${avg ? fmtDur(avg * 60) : '—'}</b><span>avg (30 days)</span></div>
        <div class="stat"><b>${fmtDur(Math.max(...timed.map(mins)) * 60)}</b><span>longest</span></div>
        <div class="stat"><b>${monthMins ? fmtDur(monthMins * 60) : '—'}</b><span>this month</span></div>
      </div>
      <div class="card pad"><div class="card-head"><span class="card-title">Minutes per workout</span></div>
      ${lineChart(pts, { fmtY: v => `${Math.round(v)}m`, color: 'var(--violet)' })}</div>`;
  } else {
    h += `<div class="empty">Finish a workout to see how long your sessions take.</div>`;
  }

  // running
  const rs = runList();
  h += `<div class="section-head"><h2>Running</h2>${rs.length ? `<div class="seg"><button class="${runMetric === 'pace' ? 'on' : ''}" data-act="run-metric" data-m="pace">Pace</button><button class="${runMetric === 'dist' ? 'on' : ''}" data-act="run-metric" data-m="dist">Distance</button></div>` : ''}</div>`;
  if (rs.length) {
    const monthMi = rs.filter(r => r.date >= monthStart).reduce((a, r) => a + r.distance, 0);
    const best = Math.min(...rs.map(r => r.duration / r.distance));
    const longest = Math.max(...rs.map(r => r.distance));
    const asc = rs.slice().reverse();
    const pts = asc.map(r => ({ x: r.date, y: runMetric === 'pace' ? r.duration / r.distance : r.distance }));
    h += `<div class="stats3">
        <div class="stat"><b>${fmtNum(monthMi, 1)}</b><span>mi this month</span></div>
        <div class="stat"><b>${fmtClock(best)}</b><span>best pace /mi</span></div>
        <div class="stat"><b>${fmtNum(longest, 2)}</b><span>longest (mi)</span></div>
      </div>
      <div class="card pad"><div class="card-head"><span class="card-title">${runMetric === 'pace' ? 'Pace per mile (higher on chart = faster)' : 'Distance (mi)'}</span></div>
      ${lineChart(pts, runMetric === 'pace' ? { fmtY: v => fmtClock(v), invert: true, color: 'var(--run)' } : { fmtY: v => fmtNum(v, 1), color: 'var(--run)' })}</div>`;
  } else {
    h += `<div class="empty">Log a run to see pace and distance trends.</div>`;
  }

  // body weight
  const bws = S.all('bodyweights').sort((a, b) => a.date - b.date);
  const latest = bws[bws.length - 1];
  h += `<div class="section-head"><h2>Body weight</h2></div><div class="card pad">`;
  if (latest) {
    const cutoff = now - 30 * DAY;
    const ref = [...bws].reverse().find(b => b.date <= cutoff) || bws[0];
    const diff = latest.lb - ref.lb;
    h += `<div class="bw-now"><b>${fmtNum(latest.lb, 1)}</b> lb <span class="muted small">${dateLabel(latest.date).toLowerCase()}</span>
      ${ref !== latest ? `<span class="delta ${diff > 0 ? 'up' : diff < 0 ? 'down' : ''}">${diff > 0 ? '+' : diff < 0 ? '−' : '±'}${fmtNum(Math.abs(diff), 1)} lb since ${dateLabel(ref.date)}</span>` : ''}</div>`;
    if (bws.length > 1) h += lineChart(bws.map(b => ({ x: b.date, y: b.lb })), { fmtY: v => fmtNum(v, 1), color: 'var(--gold)' });
  }
  h += `<div class="row" style="margin-top:${latest ? 14 : 0}px"><input class="input" inputmode="decimal" data-bind="bw" value="${esc(bwInput)}" placeholder="Today's weight (lb)"><button class="btn primary" data-act="log-bw">Log</button></div>`;
  if (bws.length) {
    h += `<div class="bw-list">${bws.slice(-5).reverse().map(b => `<div class="bw-item"><span class="muted">${dateLabel(b.date)}</span><span>${fmtNum(b.lb, 1)} lb</span><button class="icon-btn" data-act="del-bw" data-id="${b.id}" aria-label="Delete entry">${icon('x', 16)}</button></div>`).join('')}</div>`;
  }
  h += `</div>`;
  return h;
}

// ---------- views: settings ----------
function viewSettings() {
  const st = S.settings();
  const sw = (key, label, note = '') => `<label class="row-item"><span>${label}${note ? `<small class="faint block">${note}</small>` : ''}</span><input type="checkbox" class="switch" data-bind="set-${key}" ${st[key] ? 'checked' : ''}></label>`;
  return `<header class="top"><h1>Settings</h1></header>
    ${updateBanner()}
    <div class="section-head first"><h2>Rest timer</h2></div>
    <div class="card list">
      <label class="row-item"><span>Default rest for new exercises</span>
        <select class="select-sm" data-bind="set-defaultRest">${REST_OPTS.filter(Boolean).map(s => `<option value="${s}" ${st.defaultRest === s ? 'selected' : ''}>${fmtClock(s)}</option>`).join('')}</select></label>
      ${sw('sound', 'Sound when rest ends')}
      ${sw('vibrate', 'Vibrate when rest ends', 'Android only. iPhones don’t allow web apps to vibrate.')}
      ${sw('wakeLock', 'Keep screen on during workouts')}
      <button class="row-item" data-act="test-alert"><span>Test the alert</span>${icon('chev', 18)}</button>
    </div>
    <div class="section-head"><h2>Exercises</h2></div>
    <div class="card list"><button class="row-item" data-act="open" data-screen="exercises"><span>Manage exercises</span><span class="meta">${S.all('exercises').length} ${icon('chev', 18)}</span></button></div>
    <div class="section-head"><h2>Cloud sync</h2></div>
    <div class="card pad" id="sync-card">${syncCardHTML()}</div>
    <div class="section-head"><h2>Backup</h2></div>
    <div class="card list">
      <button class="row-item" data-act="export"><span>Export backup file</span>${icon('chev', 18)}</button>
      <label class="row-item"><span>Import backup file</span>${icon('chev', 18)}<input type="file" accept="application/json,.json" data-bind="import" hidden></label>
    </div>
    <div class="section-head"><h2>Install on your phone</h2></div>
    <div class="card pad muted small">
      <b class="text">iPhone:</b> open this page in Safari, tap Share, then <i>Add to Home Screen</i>.<br>
      <b class="text">Android:</b> open in Chrome, tap ⋮, then <i>Install app</i>.<br>
      Once installed it opens full screen and works without signal.
    </div>
    <div class="section-head"><h2>App</h2></div>
    <div class="card list">
      <div class="row-item"><span>Version</span><span class="meta">${VERSION}</span></div>
      ${updateInfo
        ? `<button class="row-item accent-row" data-act="apply-update" ${updating ? 'disabled' : ''}><span>${updating ? 'Updating…' : `Update to v${esc(updateInfo.version)}`}</span>${icon('chev', 18)}</button>`
        : `<button class="row-item" data-act="check-update"><span>Check for updates</span>${icon('chev', 18)}</button>`}
      <button class="row-item" data-act="apply-update-force"><span>Reload latest version<small class="faint block">Re-downloads the app if something looks out of date. Your data isn’t touched.</small></span>${icon('chev', 18)}</button>
    </div>`;
}

// ---------- sync UI ----------
let signInError = '';
let signingIn = false;
function agoText(t) {
  const s = Math.round((Date.now() - t) / 1000);
  if (s < 45) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return dateLabel(t);
}
function syncCardHTML() {
  if (!Sync.configured()) {
    return `<div class="sync-title">${icon('cloud', 20)} Not connected yet</div>
      <p class="muted small" style="margin-top:4px">Everything is saved on this device and works offline. Cloud sync turns on once Supabase is set up (see SETUP.md).</p>`;
  }
  const u = Sync.user();
  const st = Sync.getStatus();
  if (!u) {
    const err = signInError || (st.state === 'signedout' ? st.msg : '');
    return `<div class="sync-title">${icon('cloud', 20)} Sign in to sync</div>
      <p class="muted small" style="margin:4px 0 12px">Use the account you created in Supabase. Anything already on this device is kept and uploaded.</p>
      <form id="signin" class="stack" style="margin:0">
        <input class="input" type="email" name="email" autocomplete="username" placeholder="Email" required>
        <input class="input" type="password" name="password" autocomplete="current-password" placeholder="Password" required>
        <button class="btn primary block" type="submit" ${signingIn ? 'disabled' : ''}>${signingIn ? 'Signing in…' : 'Sign in'}</button>
      </form>
      ${err ? `<p class="small danger-text" style="margin-top:10px">${esc(err)}</p>` : ''}`;
  }
  const pend = S.pendingCount();
  const last = S.getMeta('lastSync');
  const line = st.state === 'syncing' ? 'Syncing…'
    : st.state === 'offline' ? `Offline. ${pend ? `${pend} change${pend > 1 ? 's' : ''} will upload` : 'Will sync'} when you’re back online.`
      : st.state === 'error' ? `Couldn’t sync: ${esc(st.msg)}`
        : last ? `Last synced ${agoText(last)}${pend ? ` · ${pend} waiting` : ''}` : 'Not synced yet';
  return `<div class="sync-title"><i class="dot ${st.state}"></i>${esc(u.email)}</div>
    <p class="muted small" style="margin:4px 0 12px">${line}</p>
    <div class="row" style="gap:6px"><button class="btn sm" data-act="sync-now" ${st.state === 'syncing' ? 'disabled' : ''}>Sync now</button>
    <button class="btn sm ghost muted-btn" data-act="sign-out">Sign out</button></div>`;
}
function updateSyncCard() {
  const el = document.getElementById('sync-card');
  if (el && !el.contains(document.activeElement)) el.innerHTML = syncCardHTML();
}

// ---------- app updates ----------
// version.json is always fetched live (the offline layer never caches it). If it names a newer
// version than this code, show an "Update available" banner; tapping it downloads fresh files and reloads.
const APP_FILES = ['./', 'index.html', 'css/styles.css', 'js/app.js', 'js/store.js', 'js/seed.js', 'js/charts.js', 'js/sync.js', 'js/config.js', 'manifest.webmanifest'];
let updateInfo = null;      // { version } when a newer version is published
let updating = false;
let lastUpdateCheck = 0;

function isNewer(a, b) {
  const x = String(a).split('.').map(n => parseInt(n, 10) || 0), y = String(b).split('.').map(n => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(x.length, y.length); i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0);
  return false;
}

async function checkForUpdate(manual = false) {
  lastUpdateCheck = Date.now();
  try {
    const res = await fetch('version.json?t=' + Date.now(), { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const { version } = await res.json();
    // also nudge the browser to look for a new offline layer
    if (navigator.serviceWorker) navigator.serviceWorker.getRegistration().then(r => r && r.update()).catch(() => {});
    const had = updateInfo && updateInfo.version;
    updateInfo = isNewer(version, VERSION) ? { version } : null;
    if (manual && !updateInfo) toast(`You’re up to date (v${VERSION})`);
    if ((updateInfo && updateInfo.version) !== had) safeRender();
  } catch (err) {
    if (manual) toast('Couldn’t check for updates. Are you online?');
  }
}

function waitForNewWorker(reg, ms) {
  return new Promise(resolve => {
    const t = setTimeout(resolve, ms);
    const w = reg.installing || reg.waiting;
    if (!w) { clearTimeout(t); resolve(); return; }
    if (w.state === 'installed') w.postMessage('skipWaiting');
    w.addEventListener('statechange', () => {
      if (w.state === 'installed') w.postMessage('skipWaiting');
      if (w.state === 'activated' || w.state === 'redundant') { clearTimeout(t); resolve(); }
    });
  });
}

async function applyUpdate() {
  if (updating) return;
  if (navigator.onLine === false) { toast('Connect to the internet to update'); return; }
  updating = true;
  safeRender();
  try {
    // 1) throw away the old offline copy
    if (window.caches) for (const k of await caches.keys()) await caches.delete(k);
    // 2) download every file fresh from the server (bypassing all caches)
    await Promise.all(APP_FILES.map(u => fetch(u, { cache: 'reload' }).catch(() => null)));
    // 3) install the newest offline layer and let it take over
    const reg = navigator.serviceWorker && await navigator.serviceWorker.getRegistration();
    if (reg) { await reg.update().catch(() => {}); await waitForNewWorker(reg, 8000); }
  } catch (err) { console.warn('update', err); }
  location.reload();
}

const updateBanner = () => updateInfo
  ? `<button class="update-banner" data-act="apply-update" ${updating ? 'disabled' : ''}>${icon('up', 18)}<span>${updating ? 'Updating…' : `Update available (v${esc(updateInfo.version)}). <b>Tap to update</b>`}</span></button>`
  : '';

// Re-render after remote changes arrive, but never while you're typing or a sheet is open.
let renderPending = false;
const isEditing = () => {
  const a = document.activeElement;
  return (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) || !sheetEl.hidden;
};
function safeRender() { if (isEditing()) renderPending = true; else render(); }
setInterval(() => {
  if (renderPending && !isEditing()) { renderPending = false; render(); }
}, 500);
setInterval(updateSyncCard, 20000);

// ---------- screen registry ----------
const TABS = {
  workout: () => { const w = activeWorkout(); return w ? viewActive(w) : viewHome(); },
  history: viewHistory,
  progress: viewProgress,
  settings: viewSettings,
};
const SCREENS = {
  workout: viewWorkoutDetail,
  run: viewRun,
  routine: viewRoutine,
  exercise: viewExercise,
  'exercise-edit': viewExerciseEdit,
  exercises: viewExerciseList,
  goal: viewGoal,
};
const ON_OPEN = {
  run: id => {
    if (id && id !== 'new') {
      const r = S.get('runs', id);
      runForm = r ? { id: r.id, dist: String(r.distance), time: fmtClock(r.duration), date: isoDate(r.date), notes: r.notes || '' } : null;
    } else {
      newRunDraft = newRunDraft || { id: null, dist: '', time: '', date: isoDate(Date.now()), notes: '' };
      runForm = newRunDraft;
    }
  },
  routine: id => {
    const r = id && id !== 'new' ? S.get('routines', id) : null;
    routineDraft = r ? clone(r) : { id: null, name: '', items: [] };
  },
  'exercise-edit': id => {
    const e = id && id !== 'new' ? ex(id) : null;
    const base = e ? clone(e) : { id: null, name: '', type: 'weight', group: 'Other', rest: S.settings().defaultRest };
    exDraft = { ...base, ...progCfg(base) };
  },
  goal: id => {
    const g = id && id !== 'new' ? S.get('goals', id) : null;
    goalDraft = g
      ? { ...clone(g), targetText: g.kind === 'run_pace' ? fmtClock(g.target) : String(g.target) }
      : { id: null, kind: 'lift', exId: 'ex_bench_press_barbell', targetText: '' };
  },
};

// ---------- actions ----------
const ACTIONS = {
  tab: el => go(el.dataset.tab),
  open: el => open(el.dataset.screen, el.dataset.id || null),
  back: () => back(),
  'close-sheet': () => closeSheet(),
  'confirm-yes': () => { const s = sheetState; sheetState = null; closeSheet(); if (s && s.res) s.res(true); },

  // workout
  start: el => startWorkout(el.dataset.routine ? S.get('routines', el.dataset.routine) : null),
  'pick-ex': el => openPicker(el.dataset.for),
  pick: el => addPicked(el.dataset.id),
  'pick-create': () => {
    const q = document.getElementById('pick-q');
    const name = q ? q.value.trim() : '';
    if (!name) return;
    const e = S.put('exercises', { name, type: 'weight', group: 'Other', rest: S.settings().defaultRest });
    toast(`Created “${name}”. Change its type under Settings → Exercises.`);
    addPicked(e.id);
  },
  'toggle-set': el => {
    const w = activeWorkout();
    if (!w) return;
    const { en, s, j } = findSet(w, el);
    if (!s) return;
    if (s.done) { s.done = false; s.pr = false; S.put('workouts', w); render(); return; }
    const t = exType(en.exId);
    const h = hintFor(en, j, targetsFor(en.exId, w.id));
    if (t === 'time') {
      if (s.sec === '' || s.sec == null) s.sec = h.sec ?? '';
      if (!(+s.sec > 0)) { toast('Enter a time first'); return; }
    } else {
      if (s.reps === '' || s.reps == null) s.reps = h.reps ?? '';
      if (s.lb === '' || s.lb == null) s.lb = h.lb ?? '';
      if (!(+s.reps > 0)) { toast('Enter reps first'); return; }
      if (t === 'weight' && s.lb === '') { toast('Enter a weight first'); return; }
    }
    s.done = true;
    s.doneAt = Date.now();
    s.pr = isPR(en.exId, s, w.id);
    S.put('workouts', w);
    const e = ex(en.exId);
    if (e && e.rest > 0) startRest(e.rest, e.name);
    if (s.pr) toast('New personal record!', 'gold');
    checkGoals();
    render();
  },
  'add-set': el => {
    const w = activeWorkout(); const { en } = findSet(w, el);
    if (!en) return;
    en.sets.push(newSet()); S.put('workouts', w); render();
  },
  'remove-set': el => {
    const w = activeWorkout(); const { en } = findSet(w, el);
    if (!en || en.sets.length < 2) return;
    en.sets.pop(); S.put('workouts', w); render();
  },
  'remove-entry': async el => {
    const w = activeWorkout(); const { en } = findSet(w, el);
    if (!en) return;
    if (en.sets.some(s => s.done) && !(await confirmBox(`Remove ${exName(en.exId)}?`, 'Its logged sets will be removed from this workout.', 'Remove', true))) return;
    w.entries = w.entries.filter(x => x !== en); S.put('workouts', w); render();
  },
  'rest-sheet': el => openRestSheet(el.dataset.ex),
  'set-rest': el => {
    const e = ex(el.dataset.ex);
    if (e) { e.rest = Number(el.dataset.s); S.put('exercises', e); }
    closeSheet(); render();
  },
  'rest-adj': el => {
    if (!rest) return;
    const d = Number(el.dataset.d);
    rest.endAt += d * 1000; rest.total = Math.max(1, rest.total + d);
    S.setMeta('rest', rest);
    if (rest.endAt <= Date.now()) clearRest(); else renderRest();
  },
  'rest-skip': () => clearRest(),
  finish: async () => {
    const w = activeWorkout();
    if (!w) return;
    const done = w.entries.reduce((n, en) => n + en.sets.filter(s => s.done).length, 0);
    if (!done) {
      if (await confirmBox('No sets completed', 'Discard this workout?', 'Discard', true)) discardWorkout(w);
      return;
    }
    const undone = w.entries.reduce((n, en) => n + en.sets.filter(s => !s.done).length, 0);
    if (!(await confirmBox('Finish workout?', undone ? `${undone} unchecked set${undone > 1 ? 's' : ''} will be left out.` : '', 'Finish'))) return;
    w.entries = w.entries.map(en => ({ ...en, sets: en.sets.filter(s => s.done) })).filter(en => en.sets.length);
    w.endedAt = Date.now();
    S.put('workouts', w);
    S.setMeta('activeWorkoutId', null);
    clearRest();
    open('workout', w.id, { summary: true });
  },
  discard: async () => {
    const w = activeWorkout();
    if (w && await confirmBox('Discard workout?', 'Nothing from this session will be saved.', 'Discard', true)) discardWorkout(w);
  },
  'save-as-routine': el => {
    const w = S.get('workouts', el.dataset.id);
    if (!w) return;
    S.put('routines', { name: w.name, items: w.entries.map(en => ({ exId: en.exId, sets: en.sets.length })) });
    toast('Saved to your routines');
  },
  'delete-workout': async el => {
    if (!(await confirmBox('Delete this workout?', 'This can’t be undone.', 'Delete', true))) return;
    S.remove('workouts', el.dataset.id);
    toast('Workout deleted');
    back();
  },

  // routines
  'r-sets': el => {
    const it = routineDraft.items[+el.closest('[data-i]').dataset.i];
    it.sets = Math.min(12, Math.max(1, it.sets + Number(el.dataset.d))); render();
  },
  'r-move': el => {
    const i = +el.closest('[data-i]').dataset.i, j = i + Number(el.dataset.d);
    const a = routineDraft.items;
    if (j < 0 || j >= a.length) return;
    [a[i], a[j]] = [a[j], a[i]]; render();
  },
  'r-remove': el => { routineDraft.items.splice(+el.closest('[data-i]').dataset.i, 1); render(); },
  'save-routine': () => {
    const r = routineDraft;
    r.name = r.name.trim();
    if (!r.name) { toast('Give the routine a name'); return; }
    if (!r.items.length) { toast('Add at least one exercise'); return; }
    const rec = { ...r }; if (!rec.id) delete rec.id;
    S.put('routines', rec);
    routineDraft = null;
    toast('Routine saved');
    back();
  },
  'delete-routine': async () => {
    if (!(await confirmBox(`Delete “${routineDraft.name}”?`, 'Past workouts are kept.', 'Delete', true))) return;
    S.remove('routines', routineDraft.id);
    routineDraft = null;
    back();
  },

  // runs
  'run-start': () => { const c = rcGet(); c.startAt = Date.now(); S.setMeta('runClock', c); render(); },
  'run-pause': () => {
    const c = rcGet();
    if (c.startAt) { c.acc += Date.now() - c.startAt; c.startAt = null; }
    S.setMeta('runClock', c);
    if (runForm) runForm.time = fmtClock(c.acc / 1000);
    render();
  },
  'run-reset': async () => {
    if (!(await confirmBox('Reset stopwatch?', '', 'Reset', true))) return;
    S.setMeta('runClock', null);
    if (runForm) runForm.time = '';
    render();
  },
  'save-run': () => {
    const f = runForm;
    const dist = parseFloat(String(f.dist).replace(',', '.'));
    const sec = runFormSeconds();
    if (!(dist > 0)) { toast('Enter the distance'); return; }
    if (!(sec > 0)) { toast('Enter the time, or use the stopwatch'); return; }
    const existing = f.id ? S.get('runs', f.id) : null;
    let date = fromIso(f.date) || Date.now();
    if (existing && isoDate(existing.date) === f.date) date = existing.date;
    else if (!existing && f.date === isoDate(Date.now())) date = Date.now();
    S.put('runs', { ...(existing || {}), distance: dist, duration: sec, date, notes: f.notes.trim() });
    if (!existing) { newRunDraft = null; S.setMeta('runClock', null); }
    runForm = null;
    toast('Run saved');
    checkGoals();
    back();
  },
  'delete-run': async () => {
    if (!(await confirmBox('Delete this run?', 'This can’t be undone.', 'Delete', true))) return;
    S.remove('runs', runForm.id);
    runForm = null;
    back();
  },

  // exercises
  'ex-metric': el => { nav.opts = { ...nav.opts, metric: el.dataset.m }; render(); },
  'save-exercise': () => {
    const e = exDraft;
    e.name = e.name.trim();
    if (!e.name) { toast('Give the exercise a name'); return; }
    if (S.all('exercises').some(x => x.id !== e.id && x.name.toLowerCase() === e.name.toLowerCase())) { toast('An exercise with that name already exists'); return; }
    if (e.type !== 'time') {
      e.repMin = Math.round(+e.repMin); e.repMax = Math.round(+e.repMax); e.inc = +e.inc;
      if (!(e.repMin >= 1 && e.repMax >= e.repMin)) { toast('Max reps must be at least min reps'); return; }
      if (!(e.inc > 0)) { toast('Enter how much weight to add'); return; }
    }
    const rec = { ...e }; if (!rec.id) delete rec.id;
    S.put('exercises', rec);
    exDraft = null;
    toast('Exercise saved');
    back();
  },
  'delete-exercise': async () => {
    if (!(await confirmBox(`Delete “${exDraft.name}”?`, 'It will be removed from the exercise list. Past workouts keep their history.', 'Delete', true))) return;
    const prev = stack[stack.length - 1];
    S.remove('exercises', exDraft.id);
    exDraft = null;
    if (prev && prev.screen === 'exercise' && stack.length >= 2) history.go(-2); else back();
  },

  // goals
  'save-goal': () => {
    const g = goalDraft;
    const target = g.kind === 'run_pace' ? parseClock(g.targetText, 'min') : parseFloat(String(g.targetText).replace(',', '.'));
    if (!(target > 0)) { toast('Enter a target'); return; }
    const existing = g.id ? S.get('goals', g.id) : null;
    const rec = { ...(existing || { createdAt: Date.now() }), kind: g.kind, exId: g.kind === 'lift' ? g.exId : null, target: g.kind === 'weekly' ? Math.round(target) : target };
    if (!existing || existing.kind !== rec.kind || existing.exId !== rec.exId) rec.start = goalCurrent(rec);
    if (!existing || existing.target !== rec.target) rec.achievedAt = null;
    S.put('goals', rec);
    goalDraft = null;
    toast('Goal saved');
    checkGoals();
    back();
  },
  'delete-goal': async () => {
    if (!(await confirmBox('Delete this goal?', '', 'Delete', true))) return;
    S.remove('goals', goalDraft.id);
    goalDraft = null;
    back();
  },

  // progress
  'run-metric': el => { runMetric = el.dataset.m; render(); },
  'log-bw': () => {
    const lb = parseFloat(String(bwInput).replace(',', '.'));
    if (!(lb > 0 && lb < 1500)) { toast('Enter your weight in lb'); return; }
    const today = startOfDay(Date.now());
    const existing = S.all('bodyweights').find(b => startOfDay(b.date) === today);
    S.put('bodyweights', existing ? { ...existing, lb } : { date: Date.now(), lb });
    bwInput = '';
    toast(existing ? 'Updated today’s weight' : 'Weight logged');
    checkGoals();
    render();
  },
  'del-bw': async el => {
    if (!(await confirmBox('Delete this entry?', '', 'Delete', true))) return;
    S.remove('bodyweights', el.dataset.id); render();
  },

  // updates
  'check-update': () => { toast('Checking…'); checkForUpdate(true); },
  'apply-update': () => applyUpdate(),
  'apply-update-force': async () => {
    if (await confirmBox('Reload the latest version?', 'Re-downloads the app files and restarts it. Your workouts and settings stay on this device.', 'Reload')) applyUpdate();
  },

  // sync
  'sync-now': () => { Sync.syncNow(); },
  'sign-out': async () => {
    if (!(await confirmBox('Sign out of sync?', 'Your data stays on this device. Sign in again any time to resume syncing.', 'Sign out', true))) return;
    Sync.signOut();
    render();
  },

  // settings
  'test-alert': () => { unlockAudio(); setTimeout(restAlert, 50); toast('Rest alert'); },
  export: () => {
    const blob = new Blob([JSON.stringify(S.exportAll(), null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `gym-log-backup-${isoDate(Date.now())}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  },
};

function addPicked(exId) {
  const target = sheetState && sheetState.target;
  closeSheet();
  if (target === 'workout') {
    const w = activeWorkout();
    if (!w) return;
    w.entries.push(makeEntry(exId));
    S.put('workouts', w);
    render();
    requestAnimationFrame(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }));
  } else if (target === 'routine' && routineDraft) {
    routineDraft.items.push({ exId, sets: 3 });
    render();
  }
}

// ---------- input bindings ----------
const BINDS = {
  'w-name': el => { const w = activeWorkout(); if (w) { w.name = el.value; S.put('workouts', w); } },
  'r-name': el => { if (routineDraft) routineDraft.name = el.value; },
  'run-dist': el => { runForm.dist = el.value; updatePace(); },
  'run-time': el => { runForm.time = el.value; updatePace(); },
  'run-date': el => { runForm.date = el.value; },
  'run-notes': el => { runForm.notes = el.value; },
  'x-name': el => { exDraft.name = el.value; },
  'x-type': el => { exDraft.type = el.value; Object.assign(exDraft, progCfg({ ...exDraft, repMin: 0, repMax: 0, inc: 0 })); render(); },
  'x-repMin': el => { exDraft.repMin = el.value; },
  'x-repMax': el => { exDraft.repMax = el.value; },
  'x-inc': el => { exDraft.inc = el.value; },
  'g-kind': el => { goalDraft.kind = el.value; goalDraft.targetText = ''; render(); },
  'g-ex': el => { goalDraft.exId = el.value; render(); },
  'g-target': el => { goalDraft.targetText = el.value; },
  'x-group': el => { exDraft.group = el.value; },
  'x-rest': el => { exDraft.rest = Number(el.value); },
  bw: el => { bwInput = el.value; },
  'set-defaultRest': el => S.setSettings({ defaultRest: Number(el.value) }),
  'set-sound': el => S.setSettings({ sound: el.checked }),
  'set-vibrate': el => S.setSettings({ vibrate: el.checked }),
  'set-wakeLock': el => { S.setSettings({ wakeLock: el.checked }); syncWakeLock(); },
};

function onSetInput(el) {
  const w = activeWorkout();
  if (!w) return;
  const { s } = findSet(w, el);
  if (!s) return;
  const f = el.dataset.f, v = el.value.trim();
  if (f === 'sec') {
    const sec = parseClock(v, 'sec');
    s.sec = v === '' ? '' : (sec ?? s.sec);
  } else {
    const n = parseFloat(v.replace(',', '.'));
    s[f] = v === '' ? '' : (isNaN(n) ? s[f] : n);
  }
  S.put('workouts', w);
}

document.addEventListener('click', e => {
  unlockAudio();
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled) return;
  const fn = ACTIONS[el.dataset.act];
  if (fn) { e.preventDefault(); fn(el, e); }
});
document.addEventListener('input', e => {
  const el = e.target;
  if (el.id === 'pick-q') return renderPickList(el.value);
  if (el.classList.contains('set-in')) return onSetInput(el);
  const b = el.dataset && el.dataset.bind;
  if (b && BINDS[b]) BINDS[b](el);
});
document.addEventListener('change', async e => {
  const el = e.target;
  if (el.dataset.bind !== 'import' || !el.files || !el.files[0]) return;
  try {
    const n = S.importAll(JSON.parse(await el.files[0].text()));
    toast(`Imported ${n} record${n === 1 ? '' : 's'}`);
    render();
  } catch (err) { toast(err.message || 'Import failed'); }
  el.value = '';
});
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && e.target.classList && e.target.classList.contains('set-in')) e.target.blur();
  if (e.key === 'Enter' && e.target.dataset && e.target.dataset.bind === 'bw') ACTIONS['log-bw']();
  if (e.key === 'Escape' && !sheetEl.hidden) closeSheet();
});

document.addEventListener('submit', async e => {
  if (e.target.id !== 'signin') return;
  e.preventDefault();
  const fd = new FormData(e.target);
  signingIn = true; signInError = ''; updateSyncCardForce();
  try {
    await Sync.signIn(String(fd.get('email')).trim(), String(fd.get('password')));
    toast('Signed in. Syncing…');
  } catch (err) {
    signInError = err instanceof TypeError ? 'Can’t reach the server. Check your connection.' : (err.message || 'Sign-in failed');
  }
  signingIn = false;
  updateSyncCardForce();
});
function updateSyncCardForce() { const el = document.getElementById('sync-card'); if (el) el.innerHTML = syncCardHTML(); }

// ---------- go ----------
render();
Sync.init({ onRemote: () => safeRender(), onStatus: () => updateSyncCard() });

// Look for app updates shortly after launch and whenever the app comes back to the foreground.
setTimeout(() => checkForUpdate(), 1500);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && Date.now() - lastUpdateCheck > 5 * 60 * 1000) checkForUpdate();
});

if ('serviceWorker' in navigator) {
  const local = ['localhost', '127.0.0.1'].includes(location.hostname) && !location.search.includes('sw=1');
  if (!local) navigator.serviceWorker.register('sw.js').catch(err => console.warn('SW registration failed', err));
}
