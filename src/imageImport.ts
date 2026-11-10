import { rgbToHex } from './colors';

export interface Quantized {
  cols: number;
  rows: number;
  /** 0 = transparent / empty, n = colors[n - 1]. */
  cells: number[];
  colors: string[];
}

/**
 * Converts an image into a chart: downsamples to cols × rows and reduces it to `k` colours
 * with k-means. Colours are returned most-used first. Transparent pixels become empty stitches.
 */
export function quantizeImage(img: CanvasImageSource, cols: number, rows: number, k: number): Quantized {
  const c = document.createElement('canvas');
  c.width = cols;
  c.height = rows;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, cols, rows);
  const px = ctx.getImageData(0, 0, cols, rows).data;
  return quantizePixels(px, cols, rows, k);
}

export function quantizePixels(px: Uint8ClampedArray | number[], cols: number, rows: number, k: number): Quantized {
  const n = cols * rows;
  const opaque: number[] = [];
  for (let i = 0; i < n; i++) if (px[i * 4 + 3] >= 128) opaque.push(i);
  if (!opaque.length) return { cols, rows, cells: new Array(n).fill(0), colors: [] };

  // k-means++ style seeding, deterministic: start at the first pixel, then pick the farthest pixel each time.
  const cent: number[][] = [];
  const dist = new Float64Array(opaque.length).fill(Infinity);
  let pick = 0;
  while (cent.length < k) {
    const i = opaque[pick];
    const c = [px[i * 4], px[i * 4 + 1], px[i * 4 + 2]];
    cent.push(c);
    let far = -1, farD = 0;
    for (let j = 0; j < opaque.length; j++) {
      const p = opaque[j] * 4;
      const d = (px[p] - c[0]) ** 2 + (px[p + 1] - c[1]) ** 2 + (px[p + 2] - c[2]) ** 2;
      if (d < dist[j]) dist[j] = d;
      if (dist[j] > farD) { farD = dist[j]; far = j; }
    }
    if (far < 0 || farD === 0) break; // fewer distinct colours than k
    pick = far;
  }

  const assign = new Int32Array(opaque.length);
  for (let iter = 0; iter < 16; iter++) {
    let changed = false;
    const sum = cent.map(() => [0, 0, 0, 0]);
    for (let j = 0; j < opaque.length; j++) {
      const p = opaque[j] * 4;
      let best = 0, bestD = Infinity;
      for (let c = 0; c < cent.length; c++) {
        const d = (px[p] - cent[c][0]) ** 2 + (px[p + 1] - cent[c][1]) ** 2 + (px[p + 2] - cent[c][2]) ** 2;
        if (d < bestD) { bestD = d; best = c; }
      }
      if (assign[j] !== best) { assign[j] = best; changed = true; }
      const s = sum[best];
      s[0] += px[p]; s[1] += px[p + 1]; s[2] += px[p + 2]; s[3]++;
    }
    for (let c = 0; c < cent.length; c++)
      if (sum[c][3]) cent[c] = [sum[c][0] / sum[c][3], sum[c][1] / sum[c][3], sum[c][2] / sum[c][3]];
    if (!changed && iter > 0) break;
  }

  const count = cent.map(() => 0);
  for (let j = 0; j < opaque.length; j++) count[assign[j]]++;
  const order = cent.map((_, i) => i).filter((i) => count[i] > 0).sort((a, b) => count[b] - count[a]);
  const rank = new Map(order.map((c, i) => [c, i + 1]));
  const cells = new Array(n).fill(0);
  for (let j = 0; j < opaque.length; j++) cells[opaque[j]] = rank.get(assign[j]) ?? 0;
  return { cols, rows, cells, colors: order.map((c) => rgbToHex(cent[c][0], cent[c][1], cent[c][2])) };
}
