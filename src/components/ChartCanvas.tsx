import { useCallback, useEffect, useRef } from 'react';
import { type Rect, clamp, inRect, linePoints, normRect } from '../model';
import { chartSize, drawChart } from '../render/chart';
import { store, useApp } from '../store';

type Drag =
  | { kind: 'paint'; lx: number; ly: number; v: number }
  | { kind: 'rect'; ax: number; ay: number; v: number }
  | { kind: 'select'; ax: number; ay: number }
  | { kind: 'move'; ox: number; oy: number }
  | { kind: 'rows'; a: number }
  | { kind: 'cols'; a: number };

const MAX_CANVAS = 8000;

function strokeMarquee(ctx: CanvasRenderingContext2D, r: Rect, cs: number) {
  const x = r.x * cs + 0.5, y = r.y * cs + 0.5, w = r.w * cs, h = r.h * cs;
  ctx.lineWidth = 2;
  ctx.setLineDash([]);
  ctx.strokeStyle = 'rgba(255,255,255,0.95)';
  ctx.strokeRect(x, y, w, h);
  ctx.setLineDash([6, 4]);
  ctx.strokeStyle = '#1d4f52';
  ctx.strokeRect(x, y, w, h);
  ctx.setLineDash([]);
}

export function ChartCanvas({ zoom, floatMask }: { zoom: number; floatMask: boolean[] | null }) {
  const design = useApp((s) => s.design);
  const selection = useApp((s) => s.selection);
  const floating = useApp((s) => s.floating);
  const tool = useApp((s) => s.tool);
  const slot = useApp((s) => s.slot);
  const mirrorX = useApp((s) => s.mirrorX);
  const mirrorY = useApp((s) => s.mirrorY);
  const maskRef = useRef(floatMask);
  maskRef.current = floatMask;

  const ref = useRef<HTMLCanvasElement>(null);
  const drag = useRef<Drag | null>(null);
  const preview = useRef<Rect | null>(null); // rectangle being dragged with the fill tool
  const raf = useRef(0);

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  // Keep the backing canvas within browser limits on very large charts.
  const cs = Math.max(3, Math.min(zoom, Math.floor(MAX_CANVAS / dpr / Math.max(design.cols, design.rows))));
  const size = chartSize(design, cs);

  const draw = useCallback(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const s = store.get();
    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawChart(ctx, s.design, cs);

    const mask = maskRef.current;
    if (mask && mask.length === s.design.cells.length) {
      // Long floats: tint the run and underline it.
      const { cols, rows } = s.design;
      const bar = Math.max(2, cs * 0.14);
      for (let y = 0; y < rows; y++)
        for (let x = 0; x < cols; x++) {
          if (!mask[y * cols + x]) continue;
          ctx.fillStyle = 'rgba(214,40,130,0.3)';
          ctx.fillRect(x * cs, y * cs, cs, cs);
          ctx.fillStyle = '#d62882';
          ctx.fillRect(x * cs, (y + 1) * cs - bar, cs, bar);
        }
    }
    if (s.mirrorX || s.mirrorY) {
      // Symmetry axes.
      const W = s.design.cols * cs, H = s.design.rows * cs;
      ctx.strokeStyle = '#d62882';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      if (s.mirrorX) { ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H); }
      if (s.mirrorY) { ctx.moveTo(0, H / 2); ctx.lineTo(W, H / 2); }
      ctx.stroke();
      ctx.setLineDash([]);
    }

    const fill = preview.current;
    if (fill) {
      const d = drag.current;
      const yarn = d && d.kind === 'rect' && d.v ? s.design.yarns[d.v - 1] : undefined;
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = yarn ? yarn.color : '#efe9de';
      ctx.fillRect(fill.x * cs, fill.y * cs, fill.w * cs, fill.h * cs);
      ctx.globalAlpha = 1;
      strokeMarquee(ctx, fill, cs);
    }
    if (s.selection) {
      ctx.fillStyle = 'rgba(47,111,115,0.14)';
      ctx.fillRect(s.selection.x * cs, s.selection.y * cs, s.selection.w * cs, s.selection.h * cs);
      strokeMarquee(ctx, s.selection, cs);
    }
    if (s.floating) {
      const f = s.floating;
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, s.design.cols * cs, s.design.rows * cs);
      ctx.clip();
      ctx.translate(f.x * cs, f.y * cs);
      ctx.globalAlpha = 0.9;
      drawChart(ctx, { cols: f.patch.w, rows: f.patch.h, cells: f.patch.cells, yarns: s.design.yarns }, cs, { numbers: false });
      ctx.globalAlpha = 1;
      ctx.restore();
      strokeMarquee(ctx, { x: f.x, y: f.y, w: f.patch.w, h: f.patch.h }, cs);
    }
    const hv = store.hover;
    if (hv && !drag.current && !s.floating) {
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(29,79,82,0.8)';
      ctx.strokeRect(hv.x * cs + 1, hv.y * cs + 1, cs - 1, cs - 1);
    }
  }, [cs, dpr]);

  const requestDraw = useCallback(() => {
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(draw);
  }, [draw]);

  useEffect(() => {
    const canvas = ref.current!;
    canvas.width = Math.round(size.w * dpr);
    canvas.height = Math.round(size.h * dpr);
    draw();
  }, [design, selection, floating, floatMask, mirrorX, mirrorY, size.w, size.h, dpr, draw]);

  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  const locate = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    const d = store.get().design;
    const fx = Math.floor((e.clientX - r.left) / cs), fy = Math.floor((e.clientY - r.top) / cs);
    const inX = fx >= 0 && fx < d.cols, inY = fy >= 0 && fy < d.rows;
    const zone = inX && inY ? 'grid' : inY && fx >= d.cols ? 'rows' : inX && fy >= d.rows ? 'cols' : 'out';
    return { x: clamp(fx, 0, d.cols - 1), y: clamp(fy, 0, d.rows - 1), fx, fy, zone } as const;
  };

  const onDown = (e: React.PointerEvent) => {
    if (e.button === 1) return;
    const p = locate(e);
    const s = store.get();
    const d = s.design;
    ref.current!.setPointerCapture(e.pointerId);

    if (s.floating) {
      const f = s.floating;
      const inside = p.zone === 'grid' && inRect({ x: f.x, y: f.y, w: f.patch.w, h: f.patch.h }, p.x, p.y);
      if (inside && f.lifted) drag.current = { kind: 'move', ox: p.x - f.x, oy: p.y - f.y };
      else store.dropFloating();
      return;
    }
    if (p.zone === 'rows') {
      drag.current = { kind: 'rows', a: p.y };
      store.setSelection({ x: 0, y: p.y, w: d.cols, h: 1 });
      return;
    }
    if (p.zone === 'cols') {
      drag.current = { kind: 'cols', a: p.x };
      store.setSelection({ x: p.x, y: 0, w: 1, h: d.rows });
      return;
    }
    if (p.zone !== 'grid') {
      store.setSelection(null);
      return;
    }
    if (e.altKey) {
      store.setSlot(d.cells[p.y * d.cols + p.x]);
      return;
    }
    const v = e.button === 2 ? 0 : s.slot;
    switch (s.tool) {
      case 'paint':
        store.beginStroke();
        store.paint([p], v);
        drag.current = { kind: 'paint', lx: p.x, ly: p.y, v };
        break;
      case 'fill':
        drag.current = { kind: 'rect', ax: p.x, ay: p.y, v };
        preview.current = { x: p.x, y: p.y, w: 1, h: 1 };
        requestDraw();
        break;
      case 'bucket':
        store.bucket(p.x, p.y, v);
        break;
      case 'select':
        if (s.selection && inRect(s.selection, p.x, p.y)) {
          const ox = p.x - s.selection.x, oy = p.y - s.selection.y;
          store.lift();
          drag.current = { kind: 'move', ox, oy };
        } else {
          drag.current = { kind: 'select', ax: p.x, ay: p.y };
          store.setSelection({ x: p.x, y: p.y, w: 1, h: 1 });
        }
        break;
    }
  };

  const onMove = (e: React.PointerEvent) => {
    const p = locate(e);
    const s = store.get();
    const d = s.design;
    const g = drag.current;
    const hover = p.zone === 'grid' ? { x: p.x, y: p.y } : null;
    const hoverChanged = hover?.x !== store.hover?.x || hover?.y !== store.hover?.y;
    store.hover = hover;

    if (!g) {
      if (s.floating && !s.floating.lifted) {
        // Paste preview follows the pointer, centred on it.
        const f = s.floating;
        store.moveFloating(p.fx - Math.floor(f.patch.w / 2), p.fy - Math.floor(f.patch.h / 2));
      } else if (hoverChanged) requestDraw();
      return;
    }
    switch (g.kind) {
      case 'paint':
        if (p.x !== g.lx || p.y !== g.ly) {
          store.paint(linePoints(g.lx, g.ly, p.x, p.y), g.v);
          g.lx = p.x;
          g.ly = p.y;
        }
        break;
      case 'rect':
        preview.current = normRect(g.ax, g.ay, p.x, p.y);
        requestDraw();
        break;
      case 'select':
        store.setSelection(normRect(g.ax, g.ay, p.x, p.y));
        break;
      case 'move':
        store.moveFloating(p.fx - g.ox, p.fy - g.oy);
        break;
      case 'rows':
        store.setSelection({ ...normRect(0, g.a, 0, p.y), x: 0, w: d.cols });
        break;
      case 'cols':
        store.setSelection({ ...normRect(g.a, 0, p.x, 0), y: 0, h: d.rows });
        break;
    }
  };

  const onUp = () => {
    const g = drag.current;
    drag.current = null;
    if (!g) return;
    if (g.kind === 'paint') store.endStroke();
    else if (g.kind === 'rect' && preview.current) {
      const r = preview.current;
      preview.current = null;
      store.fill(r, g.v);
      requestDraw();
    } else if (g.kind === 'move') store.dropFloating();
  };

  const onLeave = () => {
    if (store.hover) {
      store.hover = null;
      requestDraw();
    }
  };

  const cursor = floating ? 'move' : tool === 'select' ? 'crosshair' : tool === 'bucket' ? 'cell' : 'crosshair';

  return (
    <canvas
      ref={ref}
      className="chart-canvas"
      style={{ width: size.w, height: size.h, cursor }}
      data-slot={slot}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onPointerLeave={onLeave}
      onContextMenu={(e) => e.preventDefault()}
    />
  );
}
