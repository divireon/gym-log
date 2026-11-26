// Sample data for the tutorial: about 4 weeks of believable training so every screen has
// something to show. Built fresh in memory each time; never saved or synced.

import { SEED_EXERCISES } from './seed.js';

const DAY = 86400000;

export function buildDemo() {
  const now = Date.now();
  let n = 0;
  const id = p => `demo_${p}_${++n}`;
  const db = { exercises: {}, routines: {}, workouts: {}, runs: {}, bodyweights: {}, goals: {}, settings: {} };

  for (const e of SEED_EXERCISES) db.exercises[e.id] = { ...e, updatedAt: 0 };
  db.settings.main = { id: 'main', defaultRest: 90, vibrate: true, wakeLock: true, updatedAt: 0 };

  // a day N days ago at a given hour
  const at = (daysAgo, hour, min = 0) => { const d = new Date(now - daysAgo * DAY); d.setHours(hour, min, 0, 0); return Math.min(d.getTime(), now - 60000); };

  // cardio finishers: [level, minutes in the oldest session]; one set, a minute longer each week
  const cardio = { ex_stairmaster: [8, 5] };

  // routines
  const routine = (name, exIds) => {
    const r = { id: id('routine'), name, items: exIds.map(exId => ({ exId, sets: cardio[exId] ? 1 : 3 })), updatedAt: now };
    db.routines[r.id] = r;
    return r;
  };
  const push = routine('Push Day', ['ex_bench_press_barbell', 'ex_overhead_press_barbell', 'ex_lateral_raise', 'ex_triceps_pushdown']);
  const pull = routine('Pull Day', ['ex_deadlift', 'ex_pull_up', 'ex_barbell_row', 'ex_dumbbell_curl']);
  const legs = routine('Leg Day', ['ex_squat_barbell', 'ex_romanian_deadlift', 'ex_leg_press', 'ex_calf_raise', 'ex_stairmaster']);

  // [starting lb, lb added per week, reps for the 3 sets]; lb null = bodyweight
  const plan = {
    ex_bench_press_barbell: [155, 5, [8, 7, 6]],
    ex_overhead_press_barbell: [95, 5, [8, 7, 6]],
    ex_lateral_raise: [15, 2.5, [12, 12, 10]],
    ex_triceps_pushdown: [40, 5, [12, 11, 10]],
    ex_deadlift: [225, 10, [6, 5, 5]],
    ex_pull_up: [null, 0, [7, 6, 5]],
    ex_barbell_row: [115, 5, [10, 9, 8]],
    ex_dumbbell_curl: [25, 2.5, [12, 10, 9]],
    ex_squat_barbell: [185, 10, [6, 6, 5]],
    ex_romanian_deadlift: [135, 10, [10, 9, 8]],
    ex_leg_press: [270, 20, [12, 11, 10]],
    ex_calf_raise: [90, 10, [15, 14, 12]],
  };

  // weeks 3..0 ago: Push (5 days back), Pull (3), Legs (1), each a little stronger than the last
  for (let week = 3; week >= 0; week--) {
    const k = 3 - week; // 0 = oldest session
    [[push, 5, 18], [pull, 3, 7], [legs, 1, 18]].forEach(([r, back, hour]) => {
      const start = at(week * 7 + back, hour, 10 + k * 7);
      let t = start + 4 * 60000;
      const entries = r.items.map(({ exId }) => {
        if (cardio[exId]) {
          const [lvl, min] = cardio[exId];
          t += (min + k) * 60000;
          return { id: id('entry'), exId, sets: [{ id: id('set'), lb: '', reps: '', sec: (min + k) * 60, lvl, done: true, doneAt: t, pr: k > 0 }] };
        }
        const [lb0, inc, reps] = plan[exId];
        const sets = reps.map((rp, i) => {
          t += 2.5 * 60000;
          const bw = lb0 === null;
          return {
            id: id('set'), lb: bw ? '' : lb0 + inc * k, reps: bw ? rp + k : rp, sec: '', done: true, doneAt: t,
            pr: k > 0 && i === 0, // the first set each week beat the week before
          };
        });
        return { id: id('entry'), exId, sets };
      });
      const w = { id: id('workout'), name: r.name, routineId: r.id, startedAt: start, endedAt: t + 3 * 60000, entries, updatedAt: now };
      db.workouts[w.id] = w;
    });
  }

  // a weekly run, getting longer and quicker
  [[26, 3.0, 9.4], [19, 3.1, 9.2], [12, 3.5, 9.0], [5, 4.0, 8.75]].forEach(([back, mi, paceMin]) => {
    const r = { id: id('run'), date: at(back, 7, 30), distance: mi, duration: Math.round(mi * paceMin * 60), notes: back === 5 ? 'Felt strong, negative split' : '', updatedAt: now };
    db.runs[r.id] = r;
  });

  // body weight drifting down
  [[28, 186.4], [24, 186.0], [21, 185.6], [17, 185.1], [14, 184.8], [10, 184.0], [7, 183.6], [3, 183.1], [0, 182.8]].forEach(([back, lb]) => {
    const b = { id: id('bw'), date: at(back, 7, 5), lb, updatedAt: now };
    db.bodyweights[b.id] = b;
  });

  // goals, created a month ago
  const goal = g => { const r = { id: id('goal'), createdAt: now - 30 * DAY, updatedAt: now, ...g }; db.goals[r.id] = r; };
  goal({ kind: 'lift', exId: 'ex_bench_press_barbell', target: 185, start: 155 });
  goal({ kind: 'run_dist', target: 5, start: 3 });
  goal({ kind: 'bodyweight', target: 180, start: 186.4 });
  goal({ kind: 'weekly', target: 3 });

  return { db, routines: { push, pull, legs } };
}
