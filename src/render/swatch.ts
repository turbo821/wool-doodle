import { hashStr, hexToRgb, hslCss, mulberry32, rgbToHsl } from '../colors';
import { type Design, type Yarn, clamp } from '../model';

/**
 * Knitted-swatch renderer.
 *
 * Every stitch is a "V" made of two plied-yarn legs. Legs are pre-rendered into small sprites
 * (a few random variants per yarn so the fabric does not look tiled) and stamped row by row from
 * the bottom up, so each stitch overlaps the top of the stitch below it, as in real stockinette.
 */

interface Sprite { canvas: HTMLCanvasElement; ox: number; oy: number }

const VARIANTS = 4;
const MAX_CANVAS = 8000;
const MAX_STITCHES = 90000;
const FLECKS = ['#efe3c8', '#c9683b', '#3d8188', '#d6a733', '#2b2b33', '#8b5a9a'];

const cache = new Map<string, Sprite[]>();

function drawLeg(
  ctx: CanvasRenderingContext2D,
  x0: number, y0: number, x1: number, y1: number,
  t: number,
  yarn: Yarn,
  rnd: () => number,
) {
  const [h, s, l] = rgbToHsl(hexToRgb(yarn.color));
  const second = yarn.texture === 'marl' ? rgbToHsl(hexToRgb(yarn.color2 ?? '#f2ede2')) : null;
  const heather = yarn.texture === 'heather';
  const tweed = yarn.texture === 'tweed';
  const len = Math.hypot(x1 - x0, y1 - y0);
  const ext = t * 0.3;

  ctx.save();
  ctx.translate(x0, y0);
  ctx.rotate(Math.atan2(y1 - y0, x1 - x0));
  // Local frame: x runs along the leg (0..len), y across it (-t/2..t/2).

  const body = new Path2D();
  body.roundRect(-ext, -t / 2, len + ext * 2, t, t / 2);
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = t * 0.28;
  ctx.shadowOffsetY = t * 0.06;
  ctx.fillStyle = hslCss(h, s, l);
  ctx.fill(body);
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  ctx.clip(body);

  // Plies: slanted bands with a dark groove between them.
  const pitch = t * 0.5, slant = t * 0.75;
  let k = Math.floor(rnd() * 2);
  ctx.lineWidth = Math.max(0.5, t * 0.05);
  for (let x = -ext - slant - rnd() * pitch; x < len + ext + slant; x += pitch, k++) {
    const c = second && k % 2 ? second : [h, s, l];
    const dl = (rnd() - 0.5) * (heather ? 0.1 : 0.05);
    ctx.fillStyle = hslCss(c[0], c[1], c[2] + dl);
    ctx.beginPath();
    ctx.moveTo(x, -t / 2);
    ctx.lineTo(x + pitch + 0.5, -t / 2);
    ctx.lineTo(x + pitch + slant + 0.5, t / 2);
    ctx.lineTo(x + slant, t / 2);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.17)';
    ctx.beginPath();
    ctx.moveTo(x, -t / 2);
    ctx.lineTo(x + slant, t / 2);
    ctx.stroke();
  }

  // Fibres: fine light/dark strokes along the ply direction.
  const norm = Math.hypot(slant, t);
  const dx = slant / norm, dy = t / norm;
  const amp = heather ? 0.34 : tweed ? 0.2 : 0.12;
  const count = Math.round(clamp((len * t) / 28, 10, 150) * (heather ? 2.2 : tweed ? 1.4 : 1));
  ctx.lineWidth = Math.max(0.5, t * 0.035);
  for (let i = 0; i < count; i++) {
    const fx = -ext + rnd() * (len + ext * 2);
    const fy = (rnd() - 0.5) * t;
    const fl = t * (0.2 + rnd() * 0.5);
    const a = rnd() * amp;
    // Dark yarns get mostly light fibres and vice versa, as heathered wool does.
    const light = rnd() < (heather ? 0.35 + (0.5 - l) * 0.6 : 0.5);
    ctx.strokeStyle = light ? `rgba(255,250,240,${a})` : `rgba(10,8,6,${a})`;
    ctx.beginPath();
    ctx.moveTo(fx, fy);
    ctx.lineTo(fx + dx * fl, fy + dy * fl);
    ctx.stroke();
  }

  if (tweed) {
    const n = rnd() < 0.6 ? 1 + Math.floor(rnd() * 2) : 0;
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = FLECKS[Math.floor(rnd() * FLECKS.length)];
      ctx.globalAlpha = 0.75 + rnd() * 0.25;
      ctx.beginPath();
      ctx.ellipse(rnd() * len, (rnd() - 0.5) * t * 0.7, t * (0.07 + rnd() * 0.08), t * (0.05 + rnd() * 0.05), rnd() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // Roundness: darker towards both edges, a soft highlight off-centre.
  const across = ctx.createLinearGradient(0, -t / 2, 0, t / 2);
  across.addColorStop(0, 'rgba(0,0,0,0.34)');
  across.addColorStop(0.28, 'rgba(255,255,255,0.11)');
  across.addColorStop(0.56, 'rgba(255,255,255,0)');
  across.addColorStop(1, 'rgba(0,0,0,0.4)');
  ctx.fillStyle = across;
  ctx.fillRect(-ext, -t / 2, len + ext * 2, t);

  // The leg dips behind its neighbours at both ends.
  const along = ctx.createLinearGradient(0, 0, len, 0);
  along.addColorStop(0, 'rgba(0,0,0,0.24)');
  along.addColorStop(0.3, 'rgba(0,0,0,0)');
  along.addColorStop(0.8, 'rgba(0,0,0,0)');
  along.addColorStop(1, 'rgba(0,0,0,0.2)');
  ctx.fillStyle = along;
  ctx.fillRect(-ext, -t / 2, len + ext * 2, t);

  ctx.restore();
}

function makeSprite(yarn: Yarn, sw: number, sh: number, variant: number): Sprite {
  const pad = Math.ceil(sw * 0.3) + 2;
  const top = Math.ceil(sh * 0.32);
  const canvas = document.createElement('canvas');
  canvas.width = sw + pad * 2;
  canvas.height = sh + top + pad * 2;
  const ox = pad, oy = pad + top;
  const ctx = canvas.getContext('2d')!;
  const rnd = mulberry32(hashStr(`${yarn.color}|${yarn.color2 ?? ''}|${yarn.texture}`) + variant * 7919);
  const j = () => (rnd() - 0.5) * sw * 0.04;
  const t = sw * 0.41;
  drawLeg(ctx, ox + sw * 0.15 + j(), oy - sh * 0.2, ox + sw * 0.46 + j(), oy + sh * 0.98, t, yarn, rnd);
  drawLeg(ctx, ox + sw * 0.85 + j(), oy - sh * 0.2, ox + sw * 0.54 + j(), oy + sh * 0.98, t, yarn, rnd);
  return { canvas, ox, oy };
}

function spritesFor(yarn: Yarn, sw: number, sh: number): Sprite[] {
  const key = `${yarn.color}|${yarn.color2 ?? ''}|${yarn.texture}|${sw}|${sh}`;
  let s = cache.get(key);
  if (!s) {
    if (cache.size > 160) cache.clear();
    s = Array.from({ length: VARIANTS }, (_, i) => makeSprite(yarn, sw, sh, i));
    cache.set(key, s);
  }
  return s;
}

export interface SwatchLayout {
  /** Stitch size in device pixels. */
  sw: number;
  sh: number;
  /** Tiled size in stitches. */
  tc: number;
  tr: number;
  /** Canvas size in device pixels, before rotation. */
  W: number;
  H: number;
  padX: number;
  padT: number;
}

export function swatchLayout(d: Design, swCss: number, dpr: number): SwatchLayout {
  let rx = d.repeatX, ry = d.repeatY;
  while (d.cols * rx * d.rows * ry > MAX_STITCHES && (rx > 1 || ry > 1)) {
    if (rx >= ry) rx--;
    else ry--;
  }
  const tc = d.cols * rx, tr = d.rows * ry;
  const aspect = d.gauge.sts / d.gauge.rows; // stitch height / stitch width
  let sw = Math.floor(swCss * dpr);
  sw = Math.min(sw, Math.floor(MAX_CANVAS / tc), Math.floor(MAX_CANVAS / (tr * aspect)));
  sw = Math.max(2, sw);
  const sh = Math.max(2, Math.round(sw * aspect));
  const padX = Math.ceil(sw * 0.4), padT = Math.ceil(sh * 0.35 + sw * 0.35), padB = Math.ceil(sw * 0.4);
  return { sw, sh, tc, tr, padX, padT, W: tc * sw + padX * 2, H: tr * sh + padT + padB };
}

/** Renders the knitted swatch into `canvas`, resizing it. Returns the canvas size in device pixels. */
export function drawSwatch(canvas: HTMLCanvasElement, d: Design, swCss: number, dpr: number, rotated: boolean) {
  const L = swatchLayout(d, swCss, dpr);
  const { sw, sh, tc, tr, padX, padT, W, H } = L;
  canvas.width = rotated ? H : W;
  canvas.height = rotated ? W : H;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (rotated) {
    ctx.translate(H, 0);
    ctx.rotate(Math.PI / 2);
  }

  const sprites = d.yarns.map((y) => spritesFor(y, sw, sh));
  const backing = d.yarns.map((y) => {
    const [h, s, l] = rgbToHsl(hexToRgb(y.color));
    return hslCss(h, s * 0.8, l * 0.42);
  });

  // Pass 1: shadowed backing so gaps between stitches read as yarn, not as page.
  for (let ty = 0; ty < tr; ty++) {
    const row = (ty % d.rows) * d.cols;
    for (let tx = 0; tx < tc; tx++) {
      const v = d.cells[row + (tx % d.cols)];
      if (!v) continue;
      ctx.fillStyle = backing[v - 1];
      ctx.fillRect(padX + tx * sw, padT + ty * sh, sw, sh);
    }
  }

  // Pass 2: stitches, bottom row first.
  for (let ty = tr - 1; ty >= 0; ty--) {
    const row = (ty % d.rows) * d.cols;
    for (let tx = 0; tx < tc; tx++) {
      const v = d.cells[row + (tx % d.cols)];
      if (!v) continue;
      const sp = sprites[v - 1][(tx * 7 + ty * 13 + ((tx * ty) % 5)) % VARIANTS];
      ctx.drawImage(sp.canvas, padX + tx * sw - sp.ox, padT + ty * sh - sp.oy);
    }
  }
  return { width: canvas.width, height: canvas.height, layout: L };
}
