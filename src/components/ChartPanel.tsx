import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { SYMBOLS, clamp, longFloats } from '../model';
import { GUTTER } from '../render/chart';
import { store, useApp } from '../store';
import { ChartCanvas } from './ChartCanvas';
import { Icon } from './Icon';
import { Dropdown, NumInput } from './ui';

const ZMIN = 4, ZMAX = 46;

function ReplaceForm({ close }: { close: () => void }) {
  const yarns = useApp((s) => s.design.yarns);
  const slot = useApp((s) => s.slot);
  const [from, setFrom] = useState(slot);
  const [to, setTo] = useState(slot === 1 ? Math.min(2, yarns.length) : 1);
  const [swap, setSwap] = useState(false);
  const options = [
    <option key={0} value={0}>0 — Пустая петля</option>,
    ...yarns.map((y, i) => <option key={y.id} value={i + 1}>{SYMBOLS[i]} — {y.name}</option>),
  ];
  return (
    <div className="menu-form">
      <label className="field"><span>Найти</span>
        <select value={from} onChange={(e) => setFrom(Number(e.target.value))}>{options}</select>
      </label>
      <label className="field"><span>Заменить на</span>
        <select value={to} onChange={(e) => setTo(Number(e.target.value))}>{options}</select>
      </label>
      <label className="check">
        <input type="checkbox" checked={swap} onChange={(e) => setSwap(e.target.checked)} /> Поменять местами
      </label>
      <button
        className="btn primary"
        disabled={from === to}
        onClick={() => {
          store.replace(from, to, swap);
          close();
        }}
      >
        Заменить
      </button>
    </div>
  );
}

export function ChartPanel() {
  const selection = useApp((s) => s.selection);
  const floating = useApp((s) => s.floating);
  const design = useApp((s) => s.design);
  const [zoom, setZoom] = useState<number | 'fit'>('fit');
  const [floatsOn, setFloatsOn] = useState(false);
  const [floatLimit, setFloatLimit] = useState(5);
  const scroll = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 600, h: 400 });

  useLayoutEffect(() => {
    const el = scroll.current!;
    const measure = () => setBox({ w: el.clientWidth, h: el.clientHeight });
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    return () => ro.disconnect();
  }, []);

  // 28 px of padding plus the number gutters; a little slack keeps scrollbars from appearing.
  const fit = clamp(
    Math.floor(Math.min((box.w - 34 - GUTTER) / design.cols, (box.h - 34 - GUTTER) / design.rows)),
    ZMIN,
    ZMAX,
  );
  const cs = zoom === 'fit' ? fit : zoom;
  const csRef = useRef(cs);
  csRef.current = cs;

  useEffect(() => {
    const el = scroll.current!;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      setZoom(clamp(csRef.current + (e.deltaY < 0 ? 2 : -2), ZMIN, ZMAX));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const floatMask = useMemo(() => (floatsOn ? longFloats(design, floatLimit) : null), [floatsOn, floatLimit, design]);
  const floatCount = floatMask ? floatMask.reduce((n, m) => n + (m ? 1 : 0), 0) : 0;
  const scope = floating ? 'вставляемый фрагмент' : selection ? 'выделение' : 'вся схема';
  const item = (label: string, fn: () => void, close: () => void, disabled = false) => (
    <button
      className="menu-item"
      disabled={disabled}
      onClick={() => {
        fn();
        close();
      }}
    >
      {label}
    </button>
  );

  return (
    <section className="panel chart-panel">
      <header className="panel-bar">
        <h2>Схема</h2>
        <div className="bar-group" title={`Действует на: ${scope}`}>
          <button className="icon-btn" title="Отразить по горизонтали" onClick={() => store.flip('h')}><Icon name="flipH" /></button>
          <button className="icon-btn" title="Отразить по вертикали" onClick={() => store.flip('v')}><Icon name="flipV" /></button>
          <button className="icon-btn" title="Повернуть на 90° против часовой" onClick={() => store.rotate(270)}><Icon name="rotateL" /></button>
          <button className="icon-btn" title="Повернуть на 90° по часовой" onClick={() => store.rotate(90)}><Icon name="rotate" /></button>
          <span className="sep" />
          <button className="icon-btn" title="Сдвинуть влево (с переносом)" onClick={() => store.shift(-1, 0)}><Icon name="left" /></button>
          <button className="icon-btn" title="Сдвинуть вправо (с переносом)" onClick={() => store.shift(1, 0)}><Icon name="right" /></button>
          <button className="icon-btn" title="Сдвинуть вверх (с переносом)" onClick={() => store.shift(0, -1)}><Icon name="up" /></button>
          <button className="icon-btn" title="Сдвинуть вниз (с переносом)" onClick={() => store.shift(0, 1)}><Icon name="down" /></button>
          <span className="sep" />
          <Dropdown label="Заменить" className="btn small" title="Найти и заменить цвет">
            {(close) => <ReplaceForm close={close} />}
          </Dropdown>
          <Dropdown label="Ряды и петли" className="btn small">
            {(close) => (
              <>
                {item('Добавить ряд выше', () => store.insertRows('above'), close)}
                {item('Добавить ряд ниже', () => store.insertRows('below'), close)}
                {item('Добавить столбец слева', () => store.insertCols('left'), close)}
                {item('Добавить столбец справа', () => store.insertCols('right'), close)}
                <hr />
                {item('Удалить выделенные ряды', () => store.deleteRows(), close, !selection || selection.h >= design.rows)}
                {item('Удалить выделенные столбцы', () => store.deleteCols(), close, !selection || selection.w >= design.cols)}
                <p className="menu-note">
                  {selection
                    ? 'Добавляется столько же, сколько выделено.'
                    : 'Без выделения добавляется по краю схемы. Щёлкните по номеру ряда или петли, чтобы выделить.'}
                </p>
              </>
            )}
          </Dropdown>
        </div>
        <div className="bar-group end">
          <span className="scope">{selection ? `${selection.w} × ${selection.h}` : `${design.cols} × ${design.rows}`}</span>
          <button className="icon-btn" title="Мельче (Ctrl + колесо)" onClick={() => setZoom(clamp(cs - 3, ZMIN, ZMAX))}><Icon name="minus" /></button>
          <button className="icon-btn" title="Крупнее (Ctrl + колесо)" onClick={() => setZoom(clamp(cs + 3, ZMIN, ZMAX))}><Icon name="plus" /></button>
          <button className={`btn small${zoom === 'fit' ? ' active' : ''}`} onClick={() => setZoom('fit')}>Вписать</button>
        </div>
      </header>
      <div className="panel-subbar">
        <label className="check" title="Подсветить места, где нить другого цвета идёт за работой слишком долго. Ряд считается вязаным по кругу.">
          <input type="checkbox" checked={floatsOn} onChange={(e) => setFloatsOn(e.target.checked)} /> Длинные протяжки
        </label>
        {floatsOn && (
          <>
            <span className="bar-num">
              <NumInput label="длиннее, петель" value={floatLimit} min={2} max={30} onCommit={setFloatLimit} />
            </span>
            <span className={`float-count${floatCount ? ' warn' : ''}`}>
              {floatCount ? `Отмечено петель: ${floatCount}` : 'Длинных протяжек нет'}
            </span>
          </>
        )}
      </div>
      <div className="chart-scroll" ref={scroll}>
        <ChartCanvas zoom={cs} floatMask={floatMask} />
      </div>
      {floating && !floating.lifted && (
        <div className="toast-inline">Щёлкните по схеме, чтобы вставить фрагмент · <kbd>Esc</kbd> — отмена</div>
      )}
    </section>
  );
}
