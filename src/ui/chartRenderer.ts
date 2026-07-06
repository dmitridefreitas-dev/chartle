// Hand-rolled canvas chart renderer — candlesticks for the daily puzzle,
// a progressive line for Ride mode. No chart library: full control over
// the look, zero dependencies, and it draws a 90-bar chart in well under
// a millisecond. HiDPI-aware (device pixel ratio scaling).

export const COLORS = {
  up: '#26a69a',
  down: '#ef5350',
  grid: 'rgba(148,163,184,0.10)',
  axis: 'rgba(148,163,184,0.45)',
  line: '#4f8ff7',
  lineDanger: '#ef5350',
  fill: 'rgba(79,143,247,0.12)',
};

function setupCanvas(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

function drawGrid(
  ctx: CanvasRenderingContext2D, w: number, h: number,
  lo: number, hi: number, pad: number,
): void {
  ctx.strokeStyle = COLORS.grid;
  ctx.fillStyle = COLORS.axis;
  ctx.font = '10px ui-monospace, monospace';
  ctx.textAlign = 'right';
  ctx.lineWidth = 1;
  const steps = 4;
  for (let i = 0; i <= steps; i++) {
    const value = lo + ((hi - lo) * i) / steps;
    const y = h - pad - ((h - 2 * pad) * i) / steps;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
    ctx.fillText(value.toFixed(0), w - 4, y - 3);
  }
}

// Candles for the daily puzzle: `visible` of `bars.length` bars drawn, the
// hidden remainder shown as a fogged region so players see what a wrong
// guess will buy them.
export function drawCandles(
  canvas: HTMLCanvasElement,
  bars: [number, number, number, number][],
  visible: number,
): void {
  const ctx = setupCanvas(canvas);
  const w = canvas.getBoundingClientRect().width;
  const h = canvas.getBoundingClientRect().height;
  const pad = 12;
  ctx.clearRect(0, 0, w, h);

  const shown = bars.slice(0, visible);
  let lo = Infinity, hi = -Infinity;
  for (const [, high, low] of shown) {
    hi = Math.max(hi, high);
    lo = Math.min(lo, low);
  }
  const span = hi - lo || 1;
  lo -= span * 0.05; hi += span * 0.05;

  drawGrid(ctx, w, h, lo, hi, pad);

  const slot = w / bars.length;
  const bodyW = Math.max(2, slot * 0.62);
  const y = (v: number) => h - pad - ((v - lo) / (hi - lo)) * (h - 2 * pad);

  for (let i = 0; i < visible; i++) {
    const [open, high, low, close] = bars[i];
    const x = slot * i + slot / 2;
    const color = close >= open ? COLORS.up : COLORS.down;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y(high));
    ctx.lineTo(x, y(low));
    ctx.stroke();
    const top = y(Math.max(open, close));
    const bot = y(Math.min(open, close));
    ctx.fillRect(x - bodyW / 2, top, bodyW, Math.max(1, bot - top));
  }

  if (visible < bars.length) {
    const fogX = slot * visible;
    const fog = ctx.createLinearGradient(fogX, 0, w, 0);
    fog.addColorStop(0, 'rgba(10,14,23,0.55)');
    fog.addColorStop(1, 'rgba(10,14,23,0.92)');
    ctx.fillStyle = fog;
    ctx.fillRect(fogX, 0, w - fogX, h);
    ctx.fillStyle = COLORS.axis;
    ctx.font = '11px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('?', fogX + (w - fogX) / 2, h / 2);
  }
}

// Progressive line for Ride mode: prices up to `upTo` (fractional for
// smooth interpolation), coloured by whether the ride is above water.
export function drawRideLine(
  canvas: HTMLCanvasElement,
  closes: number[],
  upTo: number,
  underwater: boolean,
  decisionIndex?: number,   // dashed vertical marker: "you called it from here"
): void {
  const ctx = setupCanvas(canvas);
  const w = canvas.getBoundingClientRect().width;
  const h = canvas.getBoundingClientRect().height;
  const pad = 12;
  ctx.clearRect(0, 0, w, h);

  const count = Math.min(closes.length - 1, upTo);
  const full = Math.floor(count);
  const frac = count - full;

  // Scale on the revealed portion only — the future must not leak.
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i <= full; i++) {
    lo = Math.min(lo, closes[i]);
    hi = Math.max(hi, closes[i]);
  }
  const span = hi - lo || 1;
  lo -= span * 0.1; hi += span * 0.1;

  drawGrid(ctx, w, h, lo, hi, pad);

  const x = (i: number) => (i / (closes.length - 1)) * w;
  const y = (v: number) => h - pad - ((v - lo) / (hi - lo)) * (h - 2 * pad);

  const color = underwater ? COLORS.lineDanger : COLORS.line;
  ctx.beginPath();
  ctx.moveTo(x(0), y(closes[0]));
  for (let i = 1; i <= full; i++) ctx.lineTo(x(i), y(closes[i]));
  let tipX = x(full), tipY = y(closes[full]);
  if (frac > 0 && full + 1 < closes.length) {
    const v = closes[full] + (closes[full + 1] - closes[full]) * frac;
    tipX = x(full + frac); tipY = y(v);
    ctx.lineTo(tipX, tipY);
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Area fill under the line, then a glowing tip dot.
  ctx.lineTo(tipX, h - pad);
  ctx.lineTo(x(0), h - pad);
  ctx.closePath();
  ctx.fillStyle = underwater ? 'rgba(239,83,80,0.10)' : COLORS.fill;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(tipX, tipY, 4, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 12;
  ctx.fill();
  ctx.shadowBlur = 0;

  if (decisionIndex !== undefined && decisionIndex <= full) {
    ctx.setLineDash([3, 5]);
    ctx.strokeStyle = 'rgba(251,191,36,0.55)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x(decisionIndex), pad);
    ctx.lineTo(x(decisionIndex), h - pad);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Entry reference line at 100.
  if (100 >= lo && 100 <= hi) {
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = COLORS.axis;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, y(100));
    ctx.lineTo(w, y(100));
    ctx.stroke();
    ctx.setLineDash([]);
  }
}
