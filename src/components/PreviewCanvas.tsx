import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { clamp } from '../model';
import { drawSwatch } from '../render/swatch';
import { useApp } from '../store';
import { Icon } from './Icon';

const MIN = 3, MAX = 90;

export function PreviewCanvas() {
  const design = useApp((s) => s.design);
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [zoom, setZoom] = useState<number | 'fit'>('fit');
  const [rotated, setRotated] = useState(false);
  const [box, setBox] = useState({ w: 600, h: 400 });

  useLayoutEffect(() => {
    const el = wrap.current!;
    const ro = new ResizeObserver(() => setBox({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setBox({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const aspect = design.gauge.sts / design.gauge.rows;
  const tw = design.cols * design.repeatX + 0.8;
  const th = (design.rows * design.repeatY + 1) * aspect + 0.8;
  const fit = clamp(
    rotated ? Math.min((box.w - 44) / th, (box.h - 44) / tw) : Math.min((box.w - 44) / tw, (box.h - 44) / th),
    MIN,
    MAX,
  );
  const sw = zoom === 'fit' ? fit : zoom;

  useEffect(() => {
    const c = canvas.current!;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const id = requestAnimationFrame(() => {
      const { width, height } = drawSwatch(c, design, sw, dpr, rotated);
      c.style.width = `${width / dpr}px`;
      c.style.height = `${height / dpr}px`;
    });
    return () => cancelAnimationFrame(id);
  }, [design, sw, rotated]);

  const step = (f: number) => setZoom(clamp(Math.round(sw * f * 10) / 10, MIN, MAX));

  return (
    <section className="panel preview-panel">
      <header className="panel-bar">
        <h2>Образец</h2>
        <div className="bar-group">
          <button className="icon-btn" title="Мельче" onClick={() => step(1 / 1.25)}><Icon name="minus" /></button>
          <button className="icon-btn" title="Крупнее" onClick={() => step(1.25)}><Icon name="plus" /></button>
          <button className={`btn small${zoom === 'fit' ? ' active' : ''}`} onClick={() => setZoom('fit')}>Вписать</button>
          <button
            className={`icon-btn${rotated ? ' active' : ''}`}
            title="Повернуть образец на 90° (схема не меняется)"
            onClick={() => setRotated((r) => !r)}
          >
            <Icon name="rotate" />
          </button>
        </div>
      </header>
      <div className="preview-scroll" ref={wrap}>
        <canvas ref={canvas} className="preview-canvas" id="swatch-canvas" />
      </div>
    </section>
  );
}
