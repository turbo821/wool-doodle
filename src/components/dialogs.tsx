import { useEffect, useMemo, useRef, useState } from 'react';
import { type Design, MAX_SIZE, clamp, makeYarn } from '../model';
import { type Quantized, quantizeImage } from '../imageImport';
import { drawChart } from '../render/chart';
import { deleteDesign, listDesigns } from '../storage';
import { store, useApp } from '../store';
import { Icon } from './Icon';
import { Modal, NumInput } from './ui';

function Thumb({ design, max = 120 }: { design: Pick<Design, 'cols' | 'rows' | 'cells' | 'yarns'>; max?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const cs = Math.max(1, Math.floor(max / Math.max(design.cols, design.rows)));
  useEffect(() => {
    const c = ref.current!;
    c.width = design.cols * cs + 1;
    c.height = design.rows * cs + 1;
    drawChart(c.getContext('2d')!, design, cs, { numbers: false, symbols: false });
  }, [design, cs]);
  return <canvas ref={ref} className="thumb" />;
}

export function LibraryDialog({ onClose, confirmDiscard }: { onClose: () => void; confirmDiscard: () => boolean }) {
  const [items, setItems] = useState(listDesigns);
  const currentId = useApp((s) => s.design.id);
  return (
    <Modal title="Мои узоры" onClose={onClose} wide>
      {items.length === 0 ? (
        <p className="empty">Здесь появятся узоры, сохранённые на этом устройстве. Нажмите «Сохранить» (Ctrl+S), чтобы добавить текущий.</p>
      ) : (
        <ul className="library">
          {items.map((d) => (
            <li key={d.id} className={d.id === currentId ? 'current' : ''}>
              <Thumb design={d} />
              <div className="lib-info">
                <strong>{d.name}</strong>
                <span>{d.cols} × {d.rows} · {d.yarns.length} цв.</span>
                <span>{new Date(d.updatedAt).toLocaleString('ru-RU', { dateStyle: 'medium', timeStyle: 'short' })}</span>
              </div>
              <div className="lib-actions">
                <button
                  className="btn primary small"
                  onClick={() => {
                    if (!confirmDiscard()) return;
                    store.open(d, d);
                    onClose();
                  }}
                >
                  Открыть
                </button>
                <button
                  className="icon-btn danger"
                  title="Удалить из библиотеки"
                  onClick={() => {
                    if (!window.confirm(`Удалить «${d.name}» из библиотеки? Это действие нельзя отменить.`)) return;
                    deleteDesign(d.id);
                    setItems(listDesigns());
                  }}
                >
                  <Icon name="trash" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

export function ImageImportDialog({ file, onClose }: { file: File; onClose: () => void }) {
  const gauge = useApp((s) => s.design.gauge);
  const [img, setImg] = useState<ImageBitmap | null>(null);
  const [error, setError] = useState('');
  const [cols, setCols] = useState(40);
  const [colors, setColors] = useState(4);

  useEffect(() => {
    let alive = true;
    createImageBitmap(file).then(
      (b) => alive && setImg(b),
      () => alive && setError('Не удалось прочитать изображение. Попробуйте PNG или JPEG.'),
    );
    return () => {
      alive = false;
    };
  }, [file]);

  // Stitches are not square: more rows are needed per cm when the row gauge is higher.
  const rows = img ? clamp(Math.round(((cols * img.height) / img.width) * (gauge.rows / gauge.sts)), 1, MAX_SIZE) : 1;
  const result: Quantized | null = useMemo(
    () => (img ? quantizeImage(img, cols, rows, colors) : null),
    [img, cols, rows, colors],
  );
  const previewDesign = useMemo(
    () =>
      result && {
        cols: result.cols,
        rows: result.rows,
        cells: result.cells,
        yarns: result.colors.map((c, i) => makeYarn(`Цвет ${i + 1}`, c)),
      },
    [result],
  );

  return (
    <Modal title="Схема из картинки" onClose={onClose} wide>
      {error && <p className="error">{error}</p>}
      {!error && !img && <p className="empty">Загрузка…</p>}
      {previewDesign && (
        <div className="import">
          <div className="import-controls">
            <NumInput label="Ширина, петель" value={cols} min={4} max={MAX_SIZE} onCommit={setCols} />
            <NumInput label="Цветов" value={colors} min={2} max={8} onCommit={setColors} />
            <p className="hint">
              Получится {previewDesign.cols} × {previewDesign.rows} петель, цветов: {previewDesign.yarns.length}. Высота
              посчитана по плотности {gauge.sts} × {gauge.rows}, чтобы пропорции сохранились в вязке.
            </p>
            <p className="hint">Текущая схема будет заменена — это можно отменить (Ctrl+Z).</p>
            <button
              className="btn primary"
              onClick={() => {
                const d = store.get().design;
                store.commit({ ...d, ...previewDesign, repeatX: 1, repeatY: 1 });
                store.setSelection(null);
                store.setSlot(1);
                onClose();
              }}
            >
              Создать схему
            </button>
          </div>
          <div className="import-preview">
            <Thumb design={previewDesign} max={420} />
          </div>
        </div>
      )}
    </Modal>
  );
}
