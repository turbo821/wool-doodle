import { useSyncExternalStore } from 'react';
import {
  type Design, type Patch, type Point, type Rect, type Yarn,
  MAX_REPEAT, MAX_YARNS, clamp, clipRect, deleteCols, deleteRows, fillRect, flipH, flipV, floodFill,
  fullRect, getPatch, insertCols, insertRows, putPatch, removeYarn, replaceValue, resizeDesign, rotate,
  setCells, shiftWrap, uid,
} from './model';
import { loadDraft, saveDesign } from './storage';
import { defaultDesign } from './templates';

export type Tool = 'select' | 'paint' | 'fill' | 'bucket';
export const TOOLS: Tool[] = ['select', 'paint', 'fill', 'bucket'];

export interface Floating {
  patch: Patch;
  x: number;
  y: number;
  /** true: cut out of the chart by dragging (history already recorded). false: pasted, follows the pointer. */
  lifted: boolean;
}

export interface AppState {
  design: Design;
  /** The design object as last saved to the library (identity comparison gives the dirty flag). */
  saved: Design | null;
  tool: Tool;
  /** Active yarn slot: 0 = empty stitch, n = yarns[n - 1]. */
  slot: number;
  selection: Rect | null;
  floating: Floating | null;
  undo: Design[];
  redo: Design[];
}

const HISTORY_LIMIT = 200;

class Store {
  private state: AppState;
  private listeners = new Set<() => void>();
  private lastTag = '';
  private lastTagTime = 0;
  clipboard: Patch | null = null;
  hover: Point | null = null;

  constructor() {
    const draft = typeof localStorage !== 'undefined' ? loadDraft() : null;
    this.state = {
      design: draft ?? defaultDesign(),
      saved: null,
      tool: 'paint',
      slot: 2,
      selection: null,
      floating: null,
      undo: [],
      redo: [],
    };
    if (this.state.slot > this.state.design.yarns.length) this.state.slot = this.state.design.yarns.length;
  }

  subscribe = (l: () => void) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };
  get = () => this.state;

  private set(p: Partial<AppState>) {
    this.state = { ...this.state, ...p };
    this.listeners.forEach((l) => l());
  }

  /* ----- history ----- */

  /** Applies a new design with an undo entry. Commits sharing a `tag` within 800 ms are merged. */
  commit(next: Design, tag = '') {
    const s = this.state;
    if (next === s.design) return;
    const now = Date.now();
    const merge = tag !== '' && tag === this.lastTag && now - this.lastTagTime < 800 && s.undo.length > 0;
    this.lastTag = tag;
    this.lastTagTime = now;
    this.set({
      design: next,
      undo: merge ? s.undo : [...s.undo, s.design].slice(-HISTORY_LIMIT),
      redo: [],
      selection: this.fitSelection(s.selection, next),
    });
  }

  /** Records the current design once; follow with `stroke()` updates that add no further history. */
  beginStroke() {
    const s = this.state;
    this.lastTag = '';
    this.set({ undo: [...s.undo, s.design].slice(-HISTORY_LIMIT), redo: [] });
  }

  stroke(next: Design) {
    if (next !== this.state.design) this.set({ design: next });
  }

  /** Drops the undo entry made by beginStroke if nothing changed. */
  endStroke() {
    const s = this.state;
    if (s.undo.length && s.undo[s.undo.length - 1] === s.design) this.set({ undo: s.undo.slice(0, -1) });
  }

  private fitSelection(sel: Rect | null, d: Design): Rect | null {
    return sel ? clipRect(sel, d.cols, d.rows) : null;
  }

  undo() {
    const s = this.state;
    if (s.floating) return this.cancelFloating();
    if (!s.undo.length) return;
    const prev = s.undo[s.undo.length - 1];
    this.lastTag = '';
    this.set({
      design: prev,
      undo: s.undo.slice(0, -1),
      redo: [...s.redo, s.design],
      selection: this.fitSelection(s.selection, prev),
      slot: Math.min(s.slot, prev.yarns.length),
    });
  }

  redo() {
    const s = this.state;
    if (s.floating || !s.redo.length) return;
    const next = s.redo[s.redo.length - 1];
    this.lastTag = '';
    this.set({
      design: next,
      redo: s.redo.slice(0, -1),
      undo: [...s.undo, s.design],
      selection: this.fitSelection(s.selection, next),
      slot: Math.min(s.slot, next.yarns.length),
    });
  }

  /* ----- documents ----- */

  /** Replaces the whole document and clears history. */
  open(d: Design, saved: Design | null = null) {
    this.lastTag = '';
    this.set({
      design: d,
      saved,
      undo: [],
      redo: [],
      selection: null,
      floating: null,
      slot: Math.min(Math.max(this.state.slot, 1), d.yarns.length),
    });
  }

  /** Saves to the local library. Returns false when the browser storage refused the write. */
  save(): boolean {
    this.dropFloating();
    const d = { ...this.state.design, updatedAt: Date.now() };
    if (!saveDesign(d)) return false;
    this.set({ design: d, saved: d });
    return true;
  }

  /** Turns the current document into a new library entry on next save. */
  duplicate() {
    const d = this.state.design;
    this.open({ ...d, id: uid(), name: `${d.name} — копия` }, null);
  }

  /* ----- tools ----- */

  setTool(tool: Tool) {
    this.dropFloating();
    this.set({ tool });
  }

  cycleTool() {
    const i = TOOLS.indexOf(this.state.tool);
    this.setTool(TOOLS[(i + 1) % TOOLS.length]);
  }

  setSlot(slot: number) {
    this.set({ slot: clamp(slot, 0, this.state.design.yarns.length) });
  }

  setSelection(selection: Rect | null) {
    const d = this.state.design;
    this.set({ selection: selection ? clipRect(selection, d.cols, d.rows) : null });
  }

  selectAll() {
    this.dropFloating();
    this.set({ selection: fullRect(this.state.design), tool: 'select' });
  }

  paint(pts: Point[], v: number) {
    this.stroke(setCells(this.state.design, pts, v));
  }

  fill(r: Rect, v: number) {
    this.commit(fillRect(this.state.design, r, v));
  }

  bucket(x: number, y: number, v: number) {
    this.commit(floodFill(this.state.design, x, y, v));
  }

  /* ----- selection & clipboard ----- */

  /** The area edit commands act on: the selection, or the whole chart. */
  private target(): Rect {
    return this.state.selection ?? fullRect(this.state.design);
  }

  private mapTarget(fn: (p: Patch) => Patch) {
    const s = this.state;
    if (s.floating) {
      this.set({ floating: { ...s.floating, patch: fn(s.floating.patch) } });
      return;
    }
    const r = this.target();
    this.commit(putPatch(s.design, fn(getPatch(s.design, r)), r.x, r.y));
  }

  flip(axis: 'h' | 'v') {
    this.mapTarget(axis === 'h' ? flipH : flipV);
  }

  shift(dx: number, dy: number) {
    this.mapTarget((p) => shiftWrap(p, dx, dy));
  }

  replace(from: number, to: number, swap: boolean) {
    if (from === to) return;
    this.mapTarget((p) => replaceValue(p, from, to, swap));
  }

  rotate(deg: 90 | 180 | 270) {
    const s = this.state;
    if (s.floating) {
      this.set({ floating: { ...s.floating, patch: rotate(s.floating.patch, deg) } });
      return;
    }
    const r = this.target();
    const patch = rotate(getPatch(s.design, r), deg);
    if (patch.w === r.w && patch.h === r.h) {
      this.commit(putPatch(s.design, patch, r.x, r.y));
    } else if (!s.selection) {
      // Whole non-square chart: rotate the grid itself.
      this.commit({ ...s.design, cols: patch.w, rows: patch.h, cells: patch.cells });
    } else {
      // Non-square selection: cut it out and let the user place the rotated piece.
      this.beginStroke();
      this.set({
        design: fillRect(this.state.design, r, 0),
        floating: { patch, x: r.x, y: r.y, lifted: true },
        selection: null,
        tool: 'select',
      });
    }
  }

  clearSelection() {
    const s = this.state;
    if (s.floating) return this.cancelFloating();
    if (s.selection) this.commit(fillRect(s.design, s.selection, 0));
  }

  copy() {
    const s = this.state;
    if (s.floating) this.clipboard = s.floating.patch;
    else if (s.selection) this.clipboard = getPatch(s.design, s.selection);
  }

  cut() {
    this.copy();
    this.clearSelection();
  }

  /** Starts a paste preview that follows the pointer until clicked (or Enter / Esc). */
  paste() {
    if (!this.clipboard) return;
    this.dropFloating();
    const s = this.state;
    const at = s.selection ?? (this.hover ? { x: this.hover.x, y: this.hover.y } : { x: 0, y: 0 });
    this.set({
      floating: { patch: this.clipboard, x: at.x, y: at.y, lifted: false },
      selection: null,
      tool: 'select',
    });
  }

  /** Cuts the selection out of the chart so it can be dragged. */
  lift() {
    const s = this.state;
    if (!s.selection || s.floating) return;
    const patch = getPatch(s.design, s.selection);
    this.beginStroke();
    this.set({
      design: fillRect(this.state.design, s.selection, 0),
      floating: { patch, x: s.selection.x, y: s.selection.y, lifted: true },
      selection: null,
    });
  }

  moveFloating(x: number, y: number) {
    const f = this.state.floating;
    if (f && (f.x !== x || f.y !== y)) this.set({ floating: { ...f, x, y } });
  }

  dropFloating() {
    const s = this.state;
    const f = s.floating;
    if (!f) return;
    const next = putPatch(s.design, f.patch, f.x, f.y);
    const sel = clipRect({ x: f.x, y: f.y, w: f.patch.w, h: f.patch.h }, next.cols, next.rows);
    if (f.lifted) {
      this.set({ design: next, floating: null, selection: sel });
      this.endStroke();
    } else {
      this.set({ floating: null });
      this.commit(next);
      this.set({ selection: sel });
    }
  }

  cancelFloating() {
    const s = this.state;
    if (!s.floating) return;
    if (s.floating.lifted && s.undo.length) {
      // Restore the chart as it was before the piece was cut out.
      this.set({ design: s.undo[s.undo.length - 1], undo: s.undo.slice(0, -1), floating: null });
    } else {
      this.set({ floating: null });
    }
  }

  /* ----- rows & stitches ----- */

  insertRows(where: 'above' | 'below') {
    const s = this.state;
    const r = this.target();
    this.commit(insertRows(s.design, where === 'above' ? r.y : r.y + r.h, s.selection ? r.h : 1));
  }

  insertCols(where: 'left' | 'right') {
    const s = this.state;
    const r = this.target();
    this.commit(insertCols(s.design, where === 'left' ? r.x : r.x + r.w, s.selection ? r.w : 1));
  }

  deleteRows() {
    const s = this.state;
    if (!s.selection) return;
    const next = deleteRows(s.design, s.selection.y, s.selection.h);
    this.set({ selection: null });
    this.commit(next);
  }

  deleteCols() {
    const s = this.state;
    if (!s.selection) return;
    const next = deleteCols(s.design, s.selection.x, s.selection.w);
    this.set({ selection: null });
    this.commit(next);
  }

  resize(cols: number, rows: number) {
    this.dropFloating();
    this.commit(resizeDesign(this.state.design, cols, rows));
  }

  /* ----- yarns & settings ----- */

  addYarn(y: Yarn) {
    const d = this.state.design;
    if (d.yarns.length >= MAX_YARNS) return;
    this.commit({ ...d, yarns: [...d.yarns, y] });
    this.set({ slot: d.yarns.length + 1 });
  }

  updateYarn(index: number, patch: Partial<Yarn>) {
    const d = this.state.design;
    const yarns = d.yarns.map((y, i) => (i === index ? { ...y, ...patch } : y));
    this.commit({ ...d, yarns }, `yarn:${index}:${Object.keys(patch).join()}`);
  }

  removeYarn(index: number) {
    const s = this.state;
    if (s.design.yarns.length <= 1) return;
    this.dropFloating();
    this.commit(removeYarn(this.state.design, index));
    this.set({ slot: Math.min(this.state.slot, this.state.design.yarns.length) });
  }

  setGauge(sts: number, rows: number) {
    const d = this.state.design;
    this.commit({ ...d, gauge: { sts: clamp(sts, 4, 60), rows: clamp(rows, 4, 80) } }, 'gauge');
  }

  setRepeats(x: number, y: number) {
    const d = this.state.design;
    this.commit(
      { ...d, repeatX: clamp(Math.round(x), 1, MAX_REPEAT), repeatY: clamp(Math.round(y), 1, MAX_REPEAT) },
      'repeat',
    );
  }

  setMeta(patch: { name?: string; description?: string }) {
    this.commit({ ...this.state.design, ...patch }, 'meta');
  }
}

export const store = new Store();

export function useApp<T>(selector: (s: AppState) => T): T {
  return useSyncExternalStore(store.subscribe, () => selector(store.get()));
}
