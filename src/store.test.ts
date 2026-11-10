import { beforeEach, describe, expect, it } from 'vitest';
import { blankDesign, longFloats, mirrorPoints, yarnMeters } from './model';
import { Store } from './store';

const row = (s: Store, y = 0) => {
  const d = s.get().design;
  return d.cells.slice(y * d.cols, (y + 1) * d.cols).join('');
};

let s: Store;
beforeEach(() => {
  s = new Store();
  s.open({ ...blankDesign(4, 2), cells: [1, 2, 0, 0, 0, 0, 0, 0] });
});

describe('history', () => {
  it('records a whole brush stroke as one undo step', () => {
    s.beginStroke();
    s.paint([{ x: 2, y: 0 }], 2);
    s.paint([{ x: 3, y: 0 }], 2);
    s.endStroke();
    expect(row(s)).toBe('1222');
    expect(s.get().undo).toHaveLength(1);
    s.undo();
    expect(row(s)).toBe('1200');
    s.redo();
    expect(row(s)).toBe('1222');
  });
  it('drops the undo entry of a stroke that changed nothing', () => {
    s.beginStroke();
    s.paint([{ x: 0, y: 0 }], 1);
    s.endStroke();
    expect(s.get().undo).toHaveLength(0);
  });
  it('merges rapid edits that share a tag', () => {
    s.updateYarn(0, { color: '#111111' });
    s.updateYarn(0, { color: '#222222' });
    expect(s.get().undo).toHaveLength(1);
    s.undo();
    expect(s.get().design.yarns[0].color).toBe(blankDesign().yarns[0].color);
  });
});

describe('selection and clipboard', () => {
  it('moves a selection and undoes the move in one step', () => {
    s.setSelection({ x: 0, y: 0, w: 2, h: 1 });
    s.lift();
    expect(row(s)).toBe('0000');
    s.moveFloating(2, 1);
    s.dropFloating();
    expect(row(s, 0)).toBe('0000');
    expect(row(s, 1)).toBe('0012');
    expect(s.get().selection).toEqual({ x: 2, y: 1, w: 2, h: 1 });
    s.undo();
    expect(row(s, 0)).toBe('1200');
    expect(row(s, 1)).toBe('0000');
  });
  it('cancelling a move restores the chart', () => {
    s.setSelection({ x: 0, y: 0, w: 2, h: 1 });
    s.lift();
    s.moveFloating(2, 0);
    s.cancelFloating();
    expect(row(s)).toBe('1200');
    expect(s.get().undo).toHaveLength(0);
  });
  it('copies and pastes, clipping at the edge', () => {
    s.setSelection({ x: 0, y: 0, w: 2, h: 1 });
    s.copy();
    s.paste();
    s.moveFloating(3, 1);
    s.dropFloating();
    expect(row(s, 0)).toBe('1200');
    expect(row(s, 1)).toBe('0001');
    s.undo();
    expect(row(s, 1)).toBe('0000');
  });
  it('cancelling a paste leaves the chart untouched', () => {
    s.setSelection({ x: 0, y: 0, w: 1, h: 1 });
    s.copy();
    s.paste();
    s.cancelFloating();
    expect(row(s)).toBe('1200');
    expect(s.get().floating).toBeNull();
  });
  it('rotates a non-square selection into a movable piece', () => {
    s.setSelection({ x: 0, y: 0, w: 2, h: 1 });
    s.rotate(90);
    expect(s.get().floating?.patch).toEqual({ w: 1, h: 2, cells: [1, 2] });
    s.dropFloating();
    expect(row(s, 0)).toBe('1000');
    expect(row(s, 1)).toBe('2000');
  });
});

describe('yarns and brush symmetry', () => {
  it('removing a yarn keeps the active slot valid', () => {
    s.setSlot(2);
    s.removeYarn(1);
    expect(s.get().slot).toBe(1);
    expect(row(s)).toBe('1000');
  });
  it('mirrors brush strokes across both axes', () => {
    s.setMirror('x', true);
    s.setMirror('y', true);
    s.beginStroke();
    s.paint([{ x: 0, y: 0 }], 2);
    s.endStroke();
    expect(row(s, 0)).toBe('2202');
    expect(row(s, 1)).toBe('2002');
  });
});

describe('knitting helpers', () => {
  it('finds long floats, wrapping around the row', () => {
    const d = { ...blankDesign(8, 2), cells: [1, 1, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1] };
    // Row 0: the run of 1s wraps (4 at the end + 3 at the start = 7 > 5). Row 1 is one colour: no floats.
    expect(longFloats(d, 5).map(Number).join('')).toBe('1110111100000000');
    expect(longFloats(d, 7).some(Boolean)).toBe(false);
  });
  it('mirrorPoints and yarnMeters', () => {
    expect(mirrorPoints([{ x: 0, y: 0 }], 4, 2, true, false)).toEqual([{ x: 0, y: 0 }, { x: 3, y: 0 }]);
    expect(yarnMeters(200, { sts: 20, rows: 28 })).toBeCloseTo(3.5);
  });
});
