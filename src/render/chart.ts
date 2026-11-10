import { luminance } from '../colors';
import { type Design, SYMBOLS } from '../model';

/** Width of the row-number gutter (right) and height of the stitch-number gutter (bottom). */
export const GUTTER = 28;

export const EMPTY_FILL = '#efe9de';
const PAPER = '#fbf8f2';
const INK = '#3a342c';

export function chartSize(d: Pick<Design, 'cols' | 'rows'>, cs: number) {
  return { w: d.cols * cs + GUTTER, h: d.rows * cs + GUTTER };
}

export interface ChartOptions {
  symbols?: boolean;
  numbers?: boolean;
}

/**
 * Draws the chart grid at the origin with `cs` px cells.
 * Knitting convention: row 1 is the bottom row, stitch 1 is the rightmost column.
 */
export function drawChart(
  ctx: CanvasRenderingContext2D,
  d: Pick<Design, 'cols' | 'rows' | 'cells' | 'yarns'>,
  cs: number,
  { symbols = true, numbers = true }: ChartOptions = {},
) {
  const { cols, rows, cells, yarns } = d;
  const W = cols * cs, H = rows * cs;

  if (numbers) {
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, W + GUTTER, H + GUTTER);
  }

  const showSym = symbols && cs >= 15;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `600 ${Math.round(cs * 0.5)}px system-ui, sans-serif`;

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const v = cells[y * cols + x];
      const yarn = v ? yarns[v - 1] : undefined;
      ctx.fillStyle = yarn ? yarn.color : EMPTY_FILL;
      ctx.fillRect(x * cs, y * cs, cs, cs);
      if (yarn && yarn.texture === 'marl' && yarn.color2) {
        // Second ply shown as a corner triangle.
        ctx.fillStyle = yarn.color2;
        ctx.beginPath();
        ctx.moveTo(x * cs + cs, y * cs + cs * 0.45);
        ctx.lineTo(x * cs + cs, y * cs + cs);
        ctx.lineTo(x * cs + cs * 0.45, y * cs + cs);
        ctx.closePath();
        ctx.fill();
      }
      if (!yarn && cs >= 9) {
        ctx.fillStyle = 'rgba(58,52,44,0.22)';
        ctx.beginPath();
        ctx.arc(x * cs + cs / 2, y * cs + cs / 2, Math.max(0.8, cs * 0.06), 0, Math.PI * 2);
        ctx.fill();
      } else if (yarn && showSym) {
        ctx.fillStyle = luminance(yarn.color) > 0.55 ? 'rgba(30,26,20,0.72)' : 'rgba(255,255,255,0.85)';
        ctx.fillText(SYMBOLS[v - 1] ?? '?', x * cs + cs / 2, y * cs + cs / 2 + 0.5);
      }
    }
  }

  // Grid lines; every 5th (counted from the bottom-right corner) is heavier.
  if (cs >= 4) {
    const lines = (heavy: boolean) => {
      ctx.beginPath();
      for (let x = 0; x <= cols; x++) {
        if (((cols - x) % 5 === 0) !== heavy) continue;
        ctx.moveTo(Math.round(x * cs) + 0.5, 0);
        ctx.lineTo(Math.round(x * cs) + 0.5, H);
      }
      for (let y = 0; y <= rows; y++) {
        if (((rows - y) % 5 === 0) !== heavy) continue;
        ctx.moveTo(0, Math.round(y * cs) + 0.5);
        ctx.lineTo(W, Math.round(y * cs) + 0.5);
      }
      ctx.stroke();
    };
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(58,52,44,0.16)';
    lines(false);
    ctx.strokeStyle = 'rgba(58,52,44,0.5)';
    lines(true);
  }
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, W, H);

  if (!numbers) return;
  ctx.fillStyle = INK;
  const fs = Math.max(9, Math.min(12, Math.round(cs * 0.55)));
  ctx.font = `${fs}px system-ui, sans-serif`;
  const every = cs >= 16 ? 1 : cs >= 9 ? 5 : 10;
  ctx.textAlign = 'left';
  for (let y = 0; y < rows; y++) {
    const n = rows - y;
    if (n % every === 0 || n === 1) ctx.fillText(String(n), W + 5, y * cs + cs / 2 + 0.5);
  }
  ctx.textAlign = 'center';
  for (let x = 0; x < cols; x++) {
    const n = cols - x;
    if (n % every === 0 || n === 1) ctx.fillText(String(n), x * cs + cs / 2, H + GUTTER / 2);
  }
}
