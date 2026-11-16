// Tiny dependency-free SVG charts.

let gid = 0;
const shortDate = t => new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

/**
 * points: [{x: timestamp, y: number}] sorted by x
 * invert: draw lower values higher (e.g. running pace, where lower is better)
 */
export function lineChart(points, { height = 170, fmtY = v => String(Math.round(v)), color = 'var(--accent)', invert = false } = {}) {
  if (!points.length) return '<div class="chart-empty">No data yet</div>';
  const W = 340, H = height, L = 42, R = 12, T = 12, B = 24;
  const xs = points.map(p => p.x), ys = points.map(p => p.y);
  let x0 = Math.min(...xs), x1 = Math.max(...xs);
  let y0 = Math.min(...ys), y1 = Math.max(...ys);
  if (x0 === x1) { x0 -= 1; x1 += 1; }
  if (y0 === y1) { const d = Math.max(1, Math.abs(y0) * 0.05); y0 -= d; y1 += d; }
  const pad = (y1 - y0) * 0.15; y0 -= pad; y1 += pad;

  const sx = x => L + (x - x0) / (x1 - x0) * (W - L - R);
  const sy = y => {
    const f = (y - y0) / (y1 - y0);
    return invert ? T + f * (H - T - B) : H - B - f * (H - T - B);
  };

  const id = 'g' + (++gid);
  let grid = '';
  for (let k = 0; k < 3; k++) {
    const v = y0 + (y1 - y0) * (0.15 + k * 0.35);
    const y = sy(v).toFixed(1);
    grid += `<line class="gl" x1="${L}" x2="${W - R}" y1="${y}" y2="${y}"/><text x="${L - 6}" y="${y}" text-anchor="end" dominant-baseline="middle">${fmtY(v)}</text>`;
  }
  const xl = points.length === 1
    ? `<text x="${sx(points[0].x)}" y="${H - 6}" text-anchor="middle">${shortDate(points[0].x)}</text>`
    : `<text x="${L}" y="${H - 6}">${shortDate(x0)}</text><text x="${W - R}" y="${H - 6}" text-anchor="end">${shortDate(x1)}</text>`;

  const pts = points.map(p => [sx(p.x).toFixed(1), sy(p.y).toFixed(1)]);
  const line = 'M' + pts.map(p => p.join(',')).join('L');
  const base = invert ? T : H - B;
  const area = points.length > 1 ? `<path d="${line}L${pts[pts.length - 1][0]},${base}L${pts[0][0]},${base}Z" fill="url(#${id})"/>` : '';
  const dots = pts.map((p, i) => {
    const last = i === pts.length - 1;
    if (!last && pts.length > 40) return '';
    return `<circle cx="${p[0]}" cy="${p[1]}" r="${last ? 4 : 2.6}" style="fill:${last ? color : 'var(--surface)'};stroke:${color}" stroke-width="2"/>`;
  }).join('');

  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img">
    <defs><linearGradient id="${id}" x1="0" y1="${invert ? 1 : 0}" x2="0" y2="${invert ? 0 : 1}">
      <stop offset="0" style="stop-color:${color};stop-opacity:.22"/><stop offset="1" style="stop-color:${color};stop-opacity:0"/>
    </linearGradient></defs>
    ${grid}${xl}${area}
    ${points.length > 1 ? `<path class="ln" d="${line}" style="stroke:${color}"/>` : ''}
    ${dots}
  </svg>`;
}

export function sparkline(vals) {
  if (vals.length < 2) return '<span class="spark"></span>';
  const W = 64, H = 24;
  const lo = Math.min(...vals), hi = Math.max(...vals), r = hi - lo || 1;
  const pts = vals.map((v, i) => `${(2 + i / (vals.length - 1) * (W - 4)).toFixed(1)},${(H - 2 - (v - lo) / r * (H - 4)).toFixed(1)}`).join(' ');
  return `<svg class="spark" viewBox="0 0 ${W} ${H}"><polyline points="${pts}" fill="none" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round" style="stroke:var(--accent)"/></svg>`;
}
