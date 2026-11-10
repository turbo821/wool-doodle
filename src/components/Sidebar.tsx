import { useState } from 'react';
import { MAX_REPEAT, MAX_SIZE, MAX_YARNS, SYMBOLS, TEXTURE_LABELS, type Texture, countStitches, makeYarn, yarnMeters } from '../model';
import { PALETTE } from '../palette';
import { type Tool, store, useApp } from '../store';
import { Icon } from './Icon';
import { NumInput } from './ui';

const TOOL_INFO: { tool: Tool; label: string; key: string; hint: string }[] = [
  { tool: 'select', label: 'Выделение', key: 'V', hint: 'Выделить область; перетащите выделение, чтобы переместить' },
  { tool: 'paint', label: 'Кисть', key: 'B', hint: 'Рисовать петли; правая кнопка мыши стирает' },
  { tool: 'fill', label: 'Прямоугольник', key: 'R', hint: 'Залить прямоугольную область' },
  { tool: 'bucket', label: 'Заливка', key: 'G', hint: 'Залить область одного цвета' },
];

function Tools() {
  const tool = useApp((s) => s.tool);
  const mirrorX = useApp((s) => s.mirrorX);
  const mirrorY = useApp((s) => s.mirrorY);
  return (
    <section className="side-section">
      <h3>Инструменты</h3>
      <div className="tool-grid">
        {TOOL_INFO.map((t) => (
          <button
            key={t.tool}
            className={`tool${tool === t.tool ? ' active' : ''}`}
            title={`${t.hint} (${t.key})`}
            onClick={() => store.setTool(t.tool)}
          >
            <Icon name={t.tool} />
            <span>{t.label}</span>
          </button>
        ))}
      </div>
      <div className="row mirror-row">
        <span className="row-label">Симметрия кисти</span>
        <button
          className={`icon-btn${mirrorX ? ' active' : ''}`}
          aria-pressed={mirrorX}
          title="Зеркалить мазки слева направо"
          onClick={() => store.setMirror('x', !mirrorX)}
        >
          <Icon name="flipH" />
        </button>
        <button
          className={`icon-btn${mirrorY ? ' active' : ''}`}
          aria-pressed={mirrorY}
          title="Зеркалить мазки сверху вниз"
          onClick={() => store.setMirror('y', !mirrorY)}
        >
          <Icon name="flipV" />
        </button>
      </div>
      <p className="hint">Клавиша <kbd>`</kbd> переключает инструменты, <kbd>Alt</kbd>+клик берёт цвет со схемы.</p>
    </section>
  );
}

function Yarns() {
  const yarns = useApp((s) => s.design.yarns);
  const design = useApp((s) => s.design);
  const slot = useApp((s) => s.slot);
  const [showPalette, setShowPalette] = useState(false);
  const counts = countStitches(design);
  const active = slot > 0 ? yarns[slot - 1] : undefined;
  const full = yarns.length >= MAX_YARNS;

  return (
    <section className="side-section">
      <h3>Пряжа</h3>
      <ul className="yarn-list">
        {yarns.map((y, i) => (
          <li key={y.id}>
            <button className={`yarn${slot === i + 1 ? ' active' : ''}`} onClick={() => store.setSlot(i + 1)}>
              <span
                className="chip"
                style={{
                  background:
                    y.texture === 'marl' && y.color2
                      ? `linear-gradient(135deg, ${y.color} 0 55%, ${y.color2} 55%)`
                      : y.color,
                }}
              />
              <span className="sym">{SYMBOLS[i]}</span>
              <span className="yarn-name">{y.name}</span>
              <span className="count" title="Петель этим цветом">{counts[i + 1]}</span>
            </button>
          </li>
        ))}
        <li>
          <button className={`yarn${slot === 0 ? ' active' : ''}`} onClick={() => store.setSlot(0)}>
            <span className="chip empty" />
            <span className="sym">0</span>
            <span className="yarn-name">Пустая петля</span>
            <span className="count">{counts[0]}</span>
          </button>
        </li>
      </ul>

      {active && (
        <div className="yarn-edit">
          <p className="usage" title="Грубая оценка: ряд лицевой глади расходует примерно 3,5 своей ширины. Протяжки и хвосты не учтены.">
            В одном раппорте: {counts[slot]} п., примерно {yarnMeters(counts[slot], design.gauge).toFixed(1)} м
          </p>
          <label className="field">
            <span>Название</span>
            <input
              type="text"
              value={active.name}
              maxLength={60}
              onChange={(e) => store.updateYarn(slot - 1, { name: e.target.value })}
            />
          </label>
          <div className="row">
            <label className="field color">
              <span>Цвет</span>
              <input type="color" value={active.color} onChange={(e) => store.updateYarn(slot - 1, { color: e.target.value })} />
            </label>
            {active.texture === 'marl' && (
              <label className="field color">
                <span>2-я нить</span>
                <input
                  type="color"
                  value={active.color2 ?? '#f2ede2'}
                  onChange={(e) => store.updateYarn(slot - 1, { color2: e.target.value })}
                />
              </label>
            )}
            <label className="field grow">
              <span>Фактура</span>
              <select
                value={active.texture}
                onChange={(e) => {
                  const texture = e.target.value as Texture;
                  store.updateYarn(slot - 1, {
                    texture,
                    ...(texture === 'marl' && !active.color2 ? { color2: '#f2ede2' } : {}),
                  });
                }}
              >
                {(Object.keys(TEXTURE_LABELS) as Texture[]).map((t) => (
                  <option key={t} value={t}>{TEXTURE_LABELS[t]}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="row">
            <button className="btn small" onClick={() => setShowPalette((v) => !v)}>
              {showPalette ? 'Скрыть палитру' : 'Палитра оттенков'}
            </button>
            <button
              className="btn small danger"
              disabled={yarns.length <= 1}
              title="Удалить пряжу; её петли станут пустыми"
              onClick={() => store.removeYarn(slot - 1)}
            >
              <Icon name="trash" size={15} /> Удалить
            </button>
          </div>
          {showPalette && (
            <div className="palette" role="listbox" aria-label="Палитра оттенков">
              {PALETTE.map((p) => (
                <button
                  key={p.name}
                  className="swatch"
                  title={`${p.name} · ${TEXTURE_LABELS[p.texture].toLowerCase()}`}
                  style={{
                    background: p.color2 ? `linear-gradient(135deg, ${p.color} 0 55%, ${p.color2} 55%)` : p.color,
                  }}
                  onClick={() =>
                    store.updateYarn(slot - 1, { name: p.name, color: p.color, texture: p.texture, color2: p.color2 })
                  }
                />
              ))}
            </div>
          )}
        </div>
      )}

      <button
        className="btn wide"
        disabled={full}
        title={full ? `Не больше ${MAX_YARNS} цветов в узоре` : undefined}
        onClick={() => {
          const used = new Set(yarns.map((y) => y.color));
          const p = PALETTE.find((c) => !used.has(c.color)) ?? PALETTE[0];
          store.addYarn(makeYarn(p.name, p.color, p.texture, p.color2));
          setShowPalette(true);
        }}
      >
        <Icon name="plus" size={15} /> Добавить пряжу
      </button>
    </section>
  );
}

function Grid() {
  const d = useApp((s) => s.design);
  const wCm = (d.cols / d.gauge.sts) * 10, hCm = (d.rows / d.gauge.rows) * 10;
  return (
    <section className="side-section">
      <h3>Сетка</h3>
      <div className="row">
        <NumInput label="Петли" value={d.cols} min={1} max={MAX_SIZE} onCommit={(v) => store.resize(v, d.rows)} />
        <NumInput label="Ряды" value={d.rows} min={1} max={MAX_SIZE} onCommit={(v) => store.resize(d.cols, v)} />
      </div>
      <h3>Плотность на 10 см</h3>
      <div className="row">
        <NumInput label="Петли" value={d.gauge.sts} min={4} max={60} step={0.5} onCommit={(v) => store.setGauge(v, d.gauge.rows)} />
        <NumInput label="Ряды" value={d.gauge.rows} min={4} max={80} step={0.5} onCommit={(v) => store.setGauge(d.gauge.sts, v)} />
      </div>
      <p className="hint">Раппорт: {wCm.toFixed(1)} × {hCm.toFixed(1)} см</p>
      <h3>Повторы в образце</h3>
      <div className="row">
        <NumInput label="По ширине" value={d.repeatX} min={1} max={MAX_REPEAT} onCommit={(v) => store.setRepeats(v, d.repeatY)} />
        <NumInput label="По высоте" value={d.repeatY} min={1} max={MAX_REPEAT} onCommit={(v) => store.setRepeats(d.repeatX, v)} />
      </div>
    </section>
  );
}

export function Sidebar() {
  return (
    <aside className="sidebar">
      <Tools />
      <Yarns />
      <Grid />
    </aside>
  );
}
