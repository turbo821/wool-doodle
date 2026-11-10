import { isHex } from './colors';

export type Texture = 'solid' | 'heather' | 'tweed' | 'marl';

export interface Yarn {
  id: string;
  name: string;
  color: string;
  /** Second ply colour, used by the "marl" texture. */
  color2?: string;
  texture: Texture;
}

export interface Gauge {
  /** Stitches per 10 cm. */
  sts: number;
  /** Rows per 10 cm. */
  rows: number;
}

export interface Design {
  id: string;
  name: string;
  description: string;
  cols: number;
  rows: number;
  /** Row-major, row 0 is the top row. 0 = empty stitch, n = yarns[n - 1]. */
  cells: number[];
  yarns: Yarn[];
  gauge: Gauge;
  repeatX: number;
  repeatY: number;
  /** How the swatch is laid out: flat fabric, or rings around a centre (yokes, hat crowns). */
  shape: Shape;
  /** Round shapes: how many chart repeats make the full circle. */
  around: number;
  updatedAt: number;
}

export type Shape = 'flat' | 'arc' | 'circle';

export interface Rect { x: number; y: number; w: number; h: number }
export interface Patch { w: number; h: number; cells: number[] }
export interface Point { x: number; y: number }

export const MAX_SIZE = 200;
export const MAX_YARNS = 12;
export const MAX_REPEAT = 8;
export const MAX_AROUND = 60;
export const SYMBOLS = '123456789ABC';

export const TEXTURE_LABELS: Record<Texture, string> = {
  solid: 'Гладкая',
  heather: 'Меланж',
  tweed: 'Твид',
  marl: 'Мулине (2 цвета)',
};

export const uid = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);

export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function makeYarn(name: string, color: string, texture: Texture = 'solid', color2?: string): Yarn {
  return { id: uid(), name, color, texture, ...(color2 ? { color2 } : {}) };
}

export function blankDesign(cols = 20, rows = 20): Design {
  return {
    id: uid(),
    name: 'Новый узор',
    description: '',
    cols,
    rows,
    cells: new Array(cols * rows).fill(0),
    yarns: [makeYarn('Молочный', '#efe6d2'), makeYarn('Морская волна', '#2f6f73')],
    gauge: { sts: 20, rows: 20 },
    repeatX: 1,
    repeatY: 1,
    shape: 'flat',
    around: 8,
    updatedAt: Date.now(),
  };
}

export function normRect(ax: number, ay: number, bx: number, by: number): Rect {
  const x = Math.min(ax, bx), y = Math.min(ay, by);
  return { x, y, w: Math.abs(ax - bx) + 1, h: Math.abs(ay - by) + 1 };
}

export function clipRect(r: Rect, cols: number, rows: number): Rect | null {
  const x = Math.max(0, r.x), y = Math.max(0, r.y);
  const x2 = Math.min(cols, r.x + r.w), y2 = Math.min(rows, r.y + r.h);
  if (x2 <= x || y2 <= y) return null;
  return { x, y, w: x2 - x, h: y2 - y };
}

export const inRect = (r: Rect, x: number, y: number) =>
  x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h;

export const fullRect = (d: Design): Rect => ({ x: 0, y: 0, w: d.cols, h: d.rows });

/* ---------- patches ---------- */

export function getPatch(d: Design, r: Rect): Patch {
  const cells: number[] = new Array(r.w * r.h);
  for (let y = 0; y < r.h; y++)
    for (let x = 0; x < r.w; x++) cells[y * r.w + x] = d.cells[(r.y + y) * d.cols + r.x + x];
  return { w: r.w, h: r.h, cells };
}

/** Writes a patch into the design at (px, py); parts outside the grid are clipped. */
export function putPatch(d: Design, p: Patch, px: number, py: number): Design {
  const cells = d.cells.slice();
  for (let y = 0; y < p.h; y++) {
    const ty = py + y;
    if (ty < 0 || ty >= d.rows) continue;
    for (let x = 0; x < p.w; x++) {
      const tx = px + x;
      if (tx < 0 || tx >= d.cols) continue;
      cells[ty * d.cols + tx] = p.cells[y * p.w + x];
    }
  }
  return { ...d, cells };
}

export function fillRect(d: Design, r: Rect, v: number): Design {
  const c = clipRect(r, d.cols, d.rows);
  if (!c) return d;
  const cells = d.cells.slice();
  for (let y = c.y; y < c.y + c.h; y++) cells.fill(v, y * d.cols + c.x, y * d.cols + c.x + c.w);
  return { ...d, cells };
}

export function setCells(d: Design, pts: Point[], v: number): Design {
  let cells: number[] | null = null;
  for (const p of pts) {
    if (p.x < 0 || p.y < 0 || p.x >= d.cols || p.y >= d.rows) continue;
    const i = p.y * d.cols + p.x;
    if (d.cells[i] === v) continue;
    cells ??= d.cells.slice();
    cells[i] = v;
  }
  return cells ? { ...d, cells } : d;
}

export function floodFill(d: Design, sx: number, sy: number, v: number): Design {
  const from = d.cells[sy * d.cols + sx];
  if (from === v) return d;
  const cells = d.cells.slice();
  const stack = [sx, sy];
  while (stack.length) {
    const y = stack.pop()!, x = stack.pop()!;
    if (x < 0 || y < 0 || x >= d.cols || y >= d.rows) continue;
    const i = y * d.cols + x;
    if (cells[i] !== from) continue;
    cells[i] = v;
    stack.push(x + 1, y, x - 1, y, x, y + 1, x, y - 1);
  }
  return { ...d, cells };
}

/** Bresenham line, inclusive of both ends. */
export function linePoints(x0: number, y0: number, x1: number, y1: number): Point[] {
  const pts: Point[] = [];
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    pts.push({ x: x0, y: y0 });
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
  return pts;
}

export function flipH(p: Patch): Patch {
  const cells = new Array(p.cells.length);
  for (let y = 0; y < p.h; y++)
    for (let x = 0; x < p.w; x++) cells[y * p.w + x] = p.cells[y * p.w + (p.w - 1 - x)];
  return { ...p, cells };
}

export function flipV(p: Patch): Patch {
  const cells = new Array(p.cells.length);
  for (let y = 0; y < p.h; y++)
    for (let x = 0; x < p.w; x++) cells[y * p.w + x] = p.cells[(p.h - 1 - y) * p.w + x];
  return { ...p, cells };
}

/** Rotates clockwise by 90, 180 or 270 degrees. */
export function rotate(p: Patch, deg: 90 | 180 | 270): Patch {
  if (deg === 180) return { ...p, cells: p.cells.slice().reverse() };
  const w = p.h, h = p.w;
  const cells = new Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const sx = deg === 90 ? y : p.w - 1 - y;
      const sy = deg === 90 ? p.h - 1 - x : x;
      cells[y * w + x] = p.cells[sy * p.w + sx];
    }
  return { w, h, cells };
}

/** Shifts the contents with wrap-around. */
export function shiftWrap(p: Patch, dx: number, dy: number): Patch {
  const cells = new Array(p.cells.length);
  for (let y = 0; y < p.h; y++)
    for (let x = 0; x < p.w; x++) {
      const sx = (((x - dx) % p.w) + p.w) % p.w;
      const sy = (((y - dy) % p.h) + p.h) % p.h;
      cells[y * p.w + x] = p.cells[sy * p.w + sx];
    }
  return { ...p, cells };
}

export function replaceValue(p: Patch, from: number, to: number, swap: boolean): Patch {
  return {
    ...p,
    cells: p.cells.map((v) => (v === from ? to : swap && v === to ? from : v)),
  };
}

/* ---------- grid structure ---------- */

/** Resizes keeping the bottom-right corner fixed (row 1 / stitch 1 stay in place). */
export function resizeDesign(d: Design, cols: number, rows: number): Design {
  cols = clamp(Math.round(cols), 1, MAX_SIZE);
  rows = clamp(Math.round(rows), 1, MAX_SIZE);
  if (cols === d.cols && rows === d.rows) return d;
  const cells = new Array(cols * rows).fill(0);
  const dx = cols - d.cols, dy = rows - d.rows;
  for (let y = 0; y < d.rows; y++) {
    const ny = y + dy;
    if (ny < 0 || ny >= rows) continue;
    for (let x = 0; x < d.cols; x++) {
      const nx = x + dx;
      if (nx < 0 || nx >= cols) continue;
      cells[ny * cols + nx] = d.cells[y * d.cols + x];
    }
  }
  return { ...d, cols, rows, cells };
}

export function insertRows(d: Design, at: number, n: number): Design {
  n = Math.min(n, MAX_SIZE - d.rows);
  if (n <= 0) return d;
  const cells = d.cells.slice();
  cells.splice(at * d.cols, 0, ...new Array(n * d.cols).fill(0));
  return { ...d, rows: d.rows + n, cells };
}

export function deleteRows(d: Design, at: number, n: number): Design {
  n = Math.min(n, d.rows - 1);
  if (n <= 0) return d;
  at = Math.min(at, d.rows - n);
  const cells = d.cells.slice();
  cells.splice(at * d.cols, n * d.cols);
  return { ...d, rows: d.rows - n, cells };
}

export function insertCols(d: Design, at: number, n: number): Design {
  n = Math.min(n, MAX_SIZE - d.cols);
  if (n <= 0) return d;
  const cols = d.cols + n;
  const cells: number[] = [];
  for (let y = 0; y < d.rows; y++) {
    const row = d.cells.slice(y * d.cols, (y + 1) * d.cols);
    row.splice(at, 0, ...new Array(n).fill(0));
    cells.push(...row);
  }
  return { ...d, cols, cells };
}

export function deleteCols(d: Design, at: number, n: number): Design {
  n = Math.min(n, d.cols - 1);
  if (n <= 0) return d;
  at = Math.min(at, d.cols - n);
  const cells: number[] = [];
  for (let y = 0; y < d.rows; y++) {
    const row = d.cells.slice(y * d.cols, (y + 1) * d.cols);
    row.splice(at, n);
    cells.push(...row);
  }
  return { ...d, cols: d.cols - n, cells };
}

/** Removes a yarn slot; its stitches become empty and later slots shift down. */
export function removeYarn(d: Design, slotIndex: number): Design {
  const v = slotIndex + 1;
  return {
    ...d,
    yarns: d.yarns.filter((_, i) => i !== slotIndex),
    cells: d.cells.map((c) => (c === v ? 0 : c > v ? c - 1 : c)),
  };
}

/** Number of stitches knitted with each slot; index 0 counts empty stitches. */
export function countStitches(d: Design): number[] {
  const out = new Array(d.yarns.length + 1).fill(0);
  for (const c of d.cells) out[c]++;
  return out;
}

/**
 * Marks stitches that sit in a single-colour run longer than `limit` in a row knitted with two or
 * more colours: the other yarns float behind the work for that whole run. Rows are treated as
 * knitted in the round, so a run may wrap from the last stitch to the first.
 */
export function longFloats(d: Design, limit: number): boolean[] {
  const mask: boolean[] = new Array(d.cells.length).fill(false);
  for (let y = 0; y < d.rows; y++) {
    const at = (x: number) => d.cells[y * d.cols + x];
    const colours = new Set<number>();
    for (let x = 0; x < d.cols; x++) if (at(x)) colours.add(at(x));
    if (colours.size < 2) continue;
    const runs: { start: number; len: number; v: number }[] = [];
    for (let x = 0; x < d.cols; ) {
      let e = x;
      while (e < d.cols && at(e) === at(x)) e++;
      runs.push({ start: x, len: e - x, v: at(x) });
      x = e;
    }
    if (runs.length > 1 && runs[0].v === runs[runs.length - 1].v) {
      const last = runs.pop()!;
      runs[0] = { start: last.start, len: last.len + runs[0].len, v: last.v };
    }
    for (const r of runs)
      if (r.v > 0 && r.len > limit)
        for (let i = 0; i < r.len; i++) mask[y * d.cols + ((r.start + i) % d.cols)] = true;
  }
  return mask;
}

/** Adds the mirror images of the points across the chart's vertical and/or horizontal centre line. */
export function mirrorPoints(pts: Point[], cols: number, rows: number, mx: boolean, my: boolean): Point[] {
  if (!mx && !my) return pts;
  const out = pts.slice();
  if (mx) for (const p of pts) out.push({ x: cols - 1 - p.x, y: p.y });
  if (my) for (const p of out.slice()) out.push({ x: p.x, y: rows - 1 - p.y });
  return out;
}

/**
 * Rough yarn length for `stitches` stockinette stitches, in metres. Uses the common rule of thumb
 * that a row takes about 3.5 times its width; floats and tails are not included.
 */
export function yarnMeters(stitches: number, gauge: Gauge): number {
  return (stitches * (10 / gauge.sts) * 3.5) / 100;
}

/* ---------- (de)serialisation ---------- */

const TEXTURES: Texture[] = ['solid', 'heather', 'tweed', 'marl'];

/** Validates untrusted JSON and returns a clean Design, or throws. */
export function parseDesign(raw: unknown): Design {
  if (!raw || typeof raw !== 'object') throw new Error('Файл не похож на узор WoolDoodle');
  const o = raw as Record<string, unknown>;
  const cols = Number(o.cols), rows = Number(o.rows);
  if (!Number.isInteger(cols) || !Number.isInteger(rows) || cols < 1 || rows < 1 || cols > MAX_SIZE || rows > MAX_SIZE)
    throw new Error('Некорректный размер сетки');
  if (!Array.isArray(o.yarns) || !Array.isArray(o.cells) || o.cells.length !== cols * rows)
    throw new Error('Повреждённые данные узора');
  const yarns: Yarn[] = o.yarns.slice(0, MAX_YARNS).map((y, i) => {
    const yo = (y ?? {}) as Record<string, unknown>;
    const texture = TEXTURES.includes(yo.texture as Texture) ? (yo.texture as Texture) : 'solid';
    return {
      id: typeof yo.id === 'string' ? yo.id : uid(),
      name: typeof yo.name === 'string' ? yo.name.slice(0, 60) : `Пряжа ${i + 1}`,
      color: isHex(yo.color) ? yo.color : '#888888',
      texture,
      ...(isHex(yo.color2) ? { color2: yo.color2 } : {}),
    };
  });
  const cells = o.cells.map((c) => {
    const v = Number(c);
    return Number.isInteger(v) && v >= 0 && v <= yarns.length ? v : 0;
  });
  const g = (o.gauge ?? {}) as Record<string, unknown>;
  const num = (v: unknown, def: number, lo: number, hi: number) =>
    Number.isFinite(Number(v)) ? clamp(Number(v), lo, hi) : def;
  return {
    id: typeof o.id === 'string' ? o.id : uid(),
    name: typeof o.name === 'string' ? o.name.slice(0, 80) : 'Без названия',
    description: typeof o.description === 'string' ? o.description.slice(0, 2000) : '',
    cols,
    rows,
    cells,
    yarns,
    gauge: { sts: num(g.sts, 20, 4, 60), rows: num(g.rows, 20, 4, 80) },
    repeatX: Math.round(num(o.repeatX, 1, 1, MAX_REPEAT)),
    repeatY: Math.round(num(o.repeatY, 1, 1, MAX_REPEAT)),
    shape: o.shape === 'arc' || o.shape === 'circle' ? o.shape : 'flat',
    around: Math.round(num(o.around, 8, 2, MAX_AROUND)),
    updatedAt: num(o.updatedAt, Date.now(), 0, Number.MAX_SAFE_INTEGER),
  };
}
