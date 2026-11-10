import { type ReactNode, useEffect, useRef, useState } from 'react';
import { clamp } from '../model';
import { Icon } from './Icon';

/** Number field that commits on blur / Enter, so half-typed values never resize the chart. */
export function NumInput(props: {
  value: number;
  min: number;
  max: number;
  step?: number;
  label: string;
  onCommit: (v: number) => void;
}) {
  const { value, min, max, step = 1, label, onCommit } = props;
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  const commit = () => {
    const v = Number(text.replace(',', '.'));
    if (!Number.isFinite(v)) return setText(String(value));
    const c = clamp(step >= 1 ? Math.round(v) : Math.round(v * 2) / 2, min, max);
    setText(String(c));
    if (c !== value) onCommit(c);
  };
  return (
    <label className="num">
      <span>{label}</span>
      <input
        type="number"
        inputMode="decimal"
        value={text}
        min={min}
        max={max}
        step={step}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        }}
      />
    </label>
  );
}

export function Dropdown(props: {
  label: ReactNode;
  title?: string;
  className?: string;
  align?: 'left' | 'right';
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  return (
    <div className="dropdown" ref={ref}>
      <button
        className={props.className ?? 'btn'}
        title={props.title}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {props.label}
        <Icon name="chevron" size={14} />
      </button>
      {open && <div className={`menu ${props.align === 'right' ? 'right' : ''}`}>{props.children(() => setOpen(false))}</div>}
    </div>
  );
}

export function Modal(props: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && props.onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });
  return (
    <div className="modal-backdrop" onPointerDown={(e) => e.target === e.currentTarget && props.onClose()}>
      <div className={`modal${props.wide ? ' wide' : ''}`} role="dialog" aria-modal="true" aria-label={props.title}>
        <header>
          <h2>{props.title}</h2>
          <button className="icon-btn" onClick={props.onClose} title="Закрыть"><Icon name="close" /></button>
        </header>
        <div className="modal-body">{props.children}</div>
      </div>
    </div>
  );
}
