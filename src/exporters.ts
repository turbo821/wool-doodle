import { type Design, SYMBOLS, TEXTURE_LABELS, countStitches } from './model';
import { chartSize, drawChart } from './render/chart';
import { drawSwatch } from './render/swatch';

export function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function fileBase(d: Design): string {
  const s = d.name.trim().replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, '-');
  return s || 'wooldoodle';
}

const toBlob = (c: HTMLCanvasElement) =>
  new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('Не удалось создать PNG'))), 'image/png'));

export function exportJson(d: Design) {
  const data = { app: 'WoolDoodle', version: 1, ...d };
  download(new Blob([JSON.stringify(data)], { type: 'application/json' }), `${fileBase(d)}.wooldoodle.json`);
}

/** Printable chart: title, grid with numbers, and a yarn legend with stitch counts. */
export async function exportChartPng(d: Design) {
  const cs = Math.max(8, Math.min(28, Math.floor(2400 / Math.max(d.cols, d.rows))));
  const size = chartSize(d, cs);
  const counts = countStitches(d);
  const pad = 24, titleH = 44, rowH = 26;
  const legendH = d.yarns.length * rowH + 34;
  const W = Math.max(size.w + pad * 2, 420);
  const H = titleH + size.h + legendH + pad * 2;
  const c = document.createElement('canvas');
  c.width = W * 2;
  c.height = H * 2;
  const ctx = c.getContext('2d')!;
  ctx.scale(2, 2);
  ctx.fillStyle = '#fbf8f2';
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = '#3a342c';
  ctx.textBaseline = 'middle';
  ctx.font = '600 20px system-ui, sans-serif';
  ctx.fillText(d.name, pad, pad + 12);
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillStyle = '#7a7166';
  ctx.fillText(
    `${d.cols} × ${d.rows} петель · плотность ${d.gauge.sts} п. × ${d.gauge.rows} р. на 10 см`,
    pad,
    pad + 32,
  );

  ctx.save();
  ctx.translate(pad, pad + titleH);
  drawChart(ctx, d, cs);
  ctx.restore();

  let y = pad + titleH + size.h + 22;
  ctx.textAlign = 'left';
  ctx.font = '600 13px system-ui, sans-serif';
  ctx.fillStyle = '#3a342c';
  ctx.fillText('Пряжа', pad, y);
  y += 22;
  ctx.font = '13px system-ui, sans-serif';
  d.yarns.forEach((yarn, i) => {
    ctx.fillStyle = yarn.color;
    ctx.fillRect(pad, y - 9, 18, 18);
    ctx.strokeStyle = '#3a342c';
    ctx.lineWidth = 1;
    ctx.strokeRect(pad + 0.5, y - 8.5, 18, 18);
    ctx.fillStyle = '#3a342c';
    ctx.fillText(
      `${SYMBOLS[i]} — ${yarn.name} (${TEXTURE_LABELS[yarn.texture].toLowerCase()}), ${counts[i + 1]} п.`,
      pad + 28,
      y + 1,
    );
    y += rowH;
  });
  download(await toBlob(c), `${fileBase(d)}-схема.png`);
}

export async function exportSwatchPng(d: Design) {
  const c = document.createElement('canvas');
  const sw = Math.max(8, Math.min(48, Math.floor(3200 / Math.max(d.cols * d.repeatX, d.rows * d.repeatY))));
  drawSwatch(c, d, sw, 1, false);
  download(await toBlob(c), `${fileBase(d)}-образец.png`);
}
