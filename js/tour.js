// Spotlight tour engine: dims the screen, cuts a highlight around one element, and shows a caption
// card with Back / Next. Taps on the app underneath are blocked so the tour stays on its script;
// each step's `before()` sets up the screen it needs (switching tabs, starting a workout...).
//
// step = { target?: CSS selector | () => Element, title, text, before?: async () => void, keepSheet?: bool }

let el = null, steps = [], i = 0, hooks = {}, busy = false;

// wait for the screen to update (with a timer fallback so a step can never hang)
const frame = () => new Promise(r => {
  let done = false;
  const go = () => { if (!done) { done = true; r(); } };
  requestAnimationFrame(() => requestAnimationFrame(go));
  setTimeout(go, 80);
});
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const running = () => !!el;

export function startTour(tourSteps, h) {
  steps = tourSteps; hooks = h || {}; i = 0;
  el = document.createElement('div');
  el.id = 'tour';
  el.innerHTML = `<div class="tour-dim"></div><div class="tour-spot"></div><div class="tour-card" role="dialog" aria-live="polite"></div>`;
  document.body.appendChild(el);
  el.addEventListener('click', onClick);
  el.addEventListener('touchmove', e => e.preventDefault(), { passive: false }); // keep the page still
  window.addEventListener('resize', place);
  show(0);
}

export function endTour() {
  if (!el) return;
  window.removeEventListener('resize', place);
  el.remove(); el = null;
  if (hooks.onExit) hooks.onExit();
}

function onClick(e) {
  e.preventDefault(); e.stopPropagation();
  const b = e.target.closest('[data-tour]');
  if (!b || busy) return;
  const a = b.dataset.tour;
  if (a === 'next') { if (i < steps.length - 1) show(i + 1); else endTour(); }
  else if (a === 'back' && i > 0) show(i - 1);
  else if (a === 'exit') endTour();
}

async function show(n) {
  busy = true;
  i = n;
  const s = steps[i];
  if (!s.keepSheet && hooks.closeSheets) hooks.closeSheets();
  try { if (s.before) await s.before(); } catch (err) { console.warn('tour step', err); }
  await frame();
  const t = target();
  if (t) { t.scrollIntoView({ block: 'center', inline: 'nearest' }); await frame(); }
  renderCard();
  place();
  busy = false;
}

function target() {
  const s = steps[i];
  if (!s || !s.target) return null;
  const t = typeof s.target === 'function' ? s.target() : document.querySelector(s.target);
  return t && t.getClientRects().length ? t : null;
}

function renderCard() {
  const s = steps[i], last = i === steps.length - 1;
  el.querySelector('.tour-card').innerHTML = `
    <div class="tour-top"><span class="tour-count">${i + 1} of ${steps.length}</span>
      <button class="tour-x" data-tour="exit" aria-label="Exit tour">Exit</button></div>
    <h3>${esc(s.title)}</h3>
    <p>${s.text}</p>
    <div class="tour-btns">
      ${i > 0 ? '<button class="btn" data-tour="back">Back</button>' : '<span></span>'}
      <button class="btn primary" data-tour="next">${last ? 'Done' : 'Next'}</button>
    </div>`;
}

function place() {
  if (!el) return;
  const spot = el.querySelector('.tour-spot'), card = el.querySelector('.tour-card'), dim = el.querySelector('.tour-dim');
  const t = target();
  if (!t) {
    spot.style.display = 'none';
    dim.style.display = 'block';
    card.className = 'tour-card center';
    return;
  }
  const r = t.getBoundingClientRect(), pad = 6;
  const top = Math.max(4, r.top - pad), left = Math.max(4, r.left - pad);
  const right = Math.min(innerWidth - 4, r.right + pad), bottom = Math.min(innerHeight - 4, r.bottom + pad);
  Object.assign(spot.style, { display: 'block', top: top + 'px', left: left + 'px', width: (right - left) + 'px', height: (bottom - top) + 'px' });
  dim.style.display = 'none'; // the spotlight's own shadow dims everything else
  // caption goes on whichever side has more room
  card.className = 'tour-card ' + ((r.top + r.bottom) / 2 > innerHeight / 2 ? 'at-top' : 'at-bottom');
}
