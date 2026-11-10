import { useEffect, useRef, useState } from 'react';
import { ChartPanel } from './components/ChartPanel';
import { Icon } from './components/Icon';
import { PreviewCanvas } from './components/PreviewCanvas';
import { Sidebar } from './components/Sidebar';
import { ImageImportDialog, LibraryDialog } from './components/dialogs';
import { Dropdown } from './components/ui';
import { exportChartPng, exportJson, exportSwatchPng } from './exporters';
import { parseDesign, uid } from './model';
import { saveDraft } from './storage';
import { store, useApp } from './store';
import { TEMPLATES } from './templates';

const isTyping = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);

export function App() {
  const design = useApp((s) => s.design);
  const dirty = useApp((s) => s.design !== s.saved);
  const canUndo = useApp((s) => s.undo.length > 0 || !!s.floating);
  const canRedo = useApp((s) => s.redo.length > 0);
  const [library, setLibrary] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [notice, setNotice] = useState('');
  const [view, setView] = useState<'both' | 'chart' | 'preview'>('both');
  const jsonInput = useRef<HTMLInputElement>(null);
  const imgInput = useRef<HTMLInputElement>(null);

  const flash = (msg: string) => {
    setNotice(msg);
    window.setTimeout(() => setNotice((n) => (n === msg ? '' : n)), 2600);
  };

  const save = () => flash(store.save() ? 'Узор сохранён в библиотеку этого браузера' : 'Не удалось сохранить: хранилище браузера недоступно или переполнено');

  const confirmDiscard = () =>
    !store.get().undo.length || store.get().design === store.get().saved ||
    window.confirm('В текущем узоре есть несохранённые изменения. Продолжить без сохранения?');

  // Keep a draft so a reload never loses work.
  useEffect(() => {
    const id = window.setTimeout(() => saveDraft(design), 400);
    return () => window.clearTimeout(id);
  }, [design]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      // Physical key letter, so shortcuts work on any keyboard layout (e.g. Russian).
      const c = e.code && e.code.startsWith('Key') ? e.code.slice(3).toLowerCase() : e.code === 'Backquote' ? '`' : k;
      if (mod && c === 's') {
        e.preventDefault();
        save();
        return;
      }
      if (isTyping(e.target)) return;
      if (mod) {
        if (c === 'z') { e.preventDefault(); e.shiftKey ? store.redo() : store.undo(); }
        else if (c === 'y') { e.preventDefault(); store.redo(); }
        else if (c === 'c') { e.preventDefault(); store.copy(); }
        else if (c === 'x') { e.preventDefault(); store.cut(); }
        else if (c === 'v') { e.preventDefault(); store.paste(); }
        else if (c === 'a') { e.preventDefault(); store.selectAll(); }
        return;
      }
      if (e.altKey) return;
      if (c === '`') store.cycleTool();
      else if (c === 'v') store.setTool('select');
      else if (c === 'b') store.setTool('paint');
      else if (c === 'r') store.setTool('fill');
      else if (c === 'g') store.setTool('bucket');
      else if (k === 'escape') {
        if (store.get().floating) store.cancelFloating();
        else store.setSelection(null);
      } else if (k === 'enter') store.dropFloating();
      else if (k === 'delete' || k === 'backspace') { e.preventDefault(); store.clearSelection(); }
      else if (/^[0-9]$/.test(k)) store.setSlot(Number(k));
      else if (k.startsWith('arrow') && (store.get().selection || store.get().floating)) {
        e.preventDefault();
        const dx = k === 'arrowleft' ? -1 : k === 'arrowright' ? 1 : 0;
        const dy = k === 'arrowup' ? -1 : k === 'arrowdown' ? 1 : 0;
        const s = store.get();
        if (s.floating) store.moveFloating(s.floating.x + dx, s.floating.y + dy);
        else if (s.selection) store.setSelection({ ...s.selection, x: s.selection.x + dx, y: s.selection.y + dy });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const openJson = async (file: File) => {
    try {
      const d = parseDesign(JSON.parse(await file.text()));
      if (!confirmDiscard()) return;
      store.open({ ...d, id: uid() }, null);
      flash(`Открыт «${d.name}»`);
    } catch (err) {
      flash(err instanceof SyntaxError ? 'Файл не является JSON' : (err as Error).message);
    }
  };

  const item = (label: string, fn: () => void, close: () => void) => (
    <button className="menu-item" onClick={() => { close(); fn(); }}>{label}</button>
  );

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand" aria-label="WoolDoodle">
          <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden="true">
            <circle cx="16" cy="16" r="14" fill="var(--accent)" />
            <path d="M9 10l7 13 7-13" fill="none" stroke="#f6efe2" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>WoolDoodle</span>
        </div>
        <input
          className="title-input"
          value={design.name}
          maxLength={80}
          aria-label="Название узора"
          placeholder="Название узора"
          onChange={(e) => store.setMeta({ name: e.target.value })}
        />
        <span className={`status${dirty ? ' dirty' : ''}`}>{dirty ? 'не сохранён' : 'сохранён'}</span>

        <div className="top-actions">
          <button className="icon-btn" title="Отменить (Ctrl+Z)" disabled={!canUndo} onClick={() => store.undo()}><Icon name="undo" /></button>
          <button className="icon-btn" title="Повторить (Ctrl+Shift+Z)" disabled={!canRedo} onClick={() => store.redo()}><Icon name="redo" /></button>
          <span className="sep" />
          <Dropdown label="Новый" align="right">
            {(close) => (
              <>
                {TEMPLATES.map((t) =>
                  item(t.title, () => { if (confirmDiscard()) store.open(t.build(), null); }, close),
                )}
                <hr />
                {item('Копия текущего узора', () => store.duplicate(), close)}
              </>
            )}
          </Dropdown>
          <button className="btn" onClick={() => setLibrary(true)}>Мои узоры</button>
          <Dropdown label="Импорт" align="right">
            {(close) => (
              <>
                {item('Схема из картинки…', () => imgInput.current?.click(), close)}
                {item('Файл WoolDoodle (.json)…', () => jsonInput.current?.click(), close)}
              </>
            )}
          </Dropdown>
          <Dropdown label="Экспорт" align="right">
            {(close) => (
              <>
                {item('Схема с легендой (PNG)', () => void exportChartPng(store.get().design), close)}
                {item('Вязаный образец (PNG)', () => void exportSwatchPng(store.get().design), close)}
                {item('Файл WoolDoodle (.json)', () => exportJson(store.get().design), close)}
              </>
            )}
          </Dropdown>
          <button className="btn primary" title="Сохранить в библиотеку (Ctrl+S)" onClick={save}>Сохранить</button>
        </div>
      </header>

      <div className="workspace">
        <Sidebar />
        <main className={`stage view-${view}`}>
          <div className="view-tabs" role="tablist">
            {(['both', 'chart', 'preview'] as const).map((v) => (
              <button key={v} role="tab" aria-selected={view === v} className={view === v ? 'active' : ''} onClick={() => setView(v)}>
                {v === 'both' ? 'Схема + образец' : v === 'chart' ? 'Схема' : 'Образец'}
              </button>
            ))}
          </div>
          <div className="panels">
            {view !== 'preview' && <ChartPanel />}
            {view !== 'chart' && <PreviewCanvas />}
          </div>
        </main>
      </div>

      <input
        ref={jsonInput}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) void openJson(f);
        }}
      />
      <input
        ref={imgInput}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) setImageFile(f);
        }}
      />
      {library && <LibraryDialog onClose={() => setLibrary(false)} confirmDiscard={confirmDiscard} />}
      {imageFile && <ImageImportDialog file={imageFile} onClose={() => setImageFile(null)} />}
      {notice && <div className="toast" role="status">{notice}</div>}
    </div>
  );
}
