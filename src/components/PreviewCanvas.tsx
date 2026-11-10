import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { MAX_AROUND, type Shape, clamp } from '../model';
import { drawSwatch, swatchExtent } from '../render/swatch';
import { store, useApp } from '../store';
import { Icon } from './Icon';
import { NumInput } from './ui';

const MIN = 1.5, MAX = 90;

const SHAPES: { value: Shape; label: string }[] = [
  { value: 'flat', label: 'Плоское полотно' },
  { value: 'arc', label: 'Дуга (часть кокетки)' },
  { value: 'circle', label: 'Круг (кокетка, макушка)' },
];

export function PreviewCanvas() {
  const design = useApp((s) => s.design);
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [zoom, setZoom] = useState<number | 'fit'>('fit');
  const [rotated, setRotated] = useState(false);
  const [box, setBox] = useState({ w: 600, h: 400 });
  const round = design.shape !== 'flat';

  useLayoutEffect(() => {
    const el = wrap.current!;
    const ro = new ResizeObserver(() => setBox({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setBox({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const ext = swatchExtent(design);
  const turn = rotated && !round;
  const fit = clamp(
    Math.min((box.w - 44) / (turn ? ext.h : ext.w), (box.h - 44) / (turn ? ext.w : ext.h)),
    MIN,
    MAX,
  );
  const sw = zoom === 'fit' ? fit : zoom;
  const swRef = useRef(sw);
  swRef.current = sw;
  const anchor = useRef<{ fx: number; fy: number; px: number; py: number } | null>(null);
  const pan = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const [panning, setPanning] = useState(false);

  useEffect(() => {
    const c = canvas.current!;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const id = requestAnimationFrame(() => {
      const { width, height } = drawSwatch(c, design, sw, dpr, turn);
      c.style.width = `${width / dpr}px`;
      c.style.height = `${height / dpr}px`;
      // After a wheel zoom, keep the point that was under the cursor under the cursor.
      const a = anchor.current;
      const el = wrap.current;
      if (a && el) {
        anchor.current = null;
        el.scrollLeft = c.offsetLeft + a.fx * c.offsetWidth - a.px;
        el.scrollTop = c.offsetTop + a.fy * c.offsetHeight - a.py;
      }
    });
    return () => cancelAnimationFrame(id);
  }, [design, sw, turn]);

  // The wheel zooms towards the cursor. A non-passive listener is needed to stop the page scrolling.
  useEffect(() => {
    const el = wrap.current!;
    const onWheel = (e: WheelEvent) => {
      if (e.deltaY === 0) return;
      e.preventDefault();
      const next = clamp(Math.round(swRef.current * (e.deltaY < 0 ? 1.15 : 1 / 1.15) * 10) / 10, MIN, MAX);
      if (next === swRef.current) return;
      const c = canvas.current!;
      const cr = c.getBoundingClientRect(), wr = el.getBoundingClientRect();
      anchor.current = {
        fx: (e.clientX - cr.left) / cr.width,
        fy: (e.clientY - cr.top) / cr.height,
        px: e.clientX - wr.left,
        py: e.clientY - wr.top,
      };
      setZoom(next);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // Dragging pans the swatch.
  const onPanDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.button !== 1) return;
    const el = e.currentTarget;
    pan.current = { x: e.clientX, y: e.clientY, left: el.scrollLeft, top: el.scrollTop };
    el.setPointerCapture(e.pointerId);
    setPanning(true);
  };
  const onPanMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const p = pan.current;
    if (!p) return;
    e.currentTarget.scrollLeft = p.left - (e.clientX - p.x);
    e.currentTarget.scrollTop = p.top - (e.clientY - p.y);
  };
  const onPanUp = () => {
    pan.current = null;
    setPanning(false);
  };

  const step = (f: number) => setZoom(clamp(Math.round(sw * f * 10) / 10, MIN, MAX));

  return (
    <section className="panel preview-panel">
      <header className="panel-bar">
        <h2>Образец</h2>
        <div className="bar-group">
          <select
            className="bar-select"
            aria-label="Форма образца"
            value={design.shape}
            onChange={(e) => store.setShape(e.target.value as Shape, design.around)}
          >
            {SHAPES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          {round && (
            <span className="bar-num" title="Сколько раппортов схемы укладывается в полный круг">
              <NumInput
                label="Раппортов в круге"
                value={design.around}
                min={2}
                max={MAX_AROUND}
                onCommit={(v) => store.setShape(design.shape, v)}
              />
            </span>
          )}
        </div>
        <div className="bar-group end">
          <button className="icon-btn" title="Мельче (колесо мыши)" onClick={() => step(1 / 1.25)}><Icon name="minus" /></button>
          <button className="icon-btn" title="Крупнее (колесо мыши)" onClick={() => step(1.25)}><Icon name="plus" /></button>
          <button className={`btn small${zoom === 'fit' ? ' active' : ''}`} onClick={() => setZoom('fit')}>Вписать</button>
          {!round && (
            <button
              className={`icon-btn${rotated ? ' active' : ''}`}
              title="Повернуть образец на 90° (схема не меняется)"
              onClick={() => setRotated((r) => !r)}
            >
              <Icon name="rotate" />
            </button>
          )}
        </div>
      </header>
      <div
        className={`preview-scroll${panning ? ' panning' : ''}`}
        ref={wrap}
        onPointerDown={onPanDown}
        onPointerMove={onPanMove}
        onPointerUp={onPanUp}
        onPointerCancel={onPanUp}
      >
        <canvas ref={canvas} className="preview-canvas" id="swatch-canvas" />
      </div>
      {round && (
        <p className="panel-note">
          Верхний ряд схемы — у центра. Пустые петли считаются убавленными: ряд, где их больше, получается у́же.
          {design.shape === 'arc' && ' Дуга показывает столько раппортов, сколько задано в «Повторах по ширине».'}
        </p>
      )}
    </section>
  );
}
