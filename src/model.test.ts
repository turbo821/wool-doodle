import { describe, expect, it } from 'vitest';
import { quantizePixels } from './imageImport';
import {
  type Design, type Patch, blankDesign, deleteCols, deleteRows, fillRect, flipH, flipV, floodFill, getPatch,
  insertCols, insertRows, linePoints, parseDesign, putPatch, removeYarn, replaceValue, resizeDesign, rotate, shiftWrap,
} from './model';

const patch = (w: number, h: number, cells: number[]): Patch => ({ w, h, cells });
const design = (cols: number, rows: number, cells: number[]): Design => ({ ...blankDesign(cols, rows), cells });

describe('patch transforms', () => {
  const p = patch(3, 2, [1, 2, 3, 4, 5, 6]);
  it('flips', () => {
    expect(flipH(p).cells).toEqual([3, 2, 1, 6, 5, 4]);
    expect(flipV(p).cells).toEqual([4, 5, 6, 1, 2, 3]);
  });
  it('rotates clockwise', () => {
    expect(rotate(p, 90)).toEqual(patch(2, 3, [4, 1, 5, 2, 6, 3]));
    expect(rotate(p, 180).cells).toEqual([6, 5, 4, 3, 2, 1]);
    expect(rotate(p, 270)).toEqual(patch(2, 3, [3, 6, 2, 5, 1, 4]));
    expect(rotate(rotate(p, 90), 270)).toEqual(p);
  });
  it('shifts with wrap', () => {
    expect(shiftWrap(p, 1, 0).cells).toEqual([3, 1, 2, 6, 4, 5]);
    expect(shiftWrap(p, 0, 1).cells).toEqual([4, 5, 6, 1, 2, 3]);
    expect(shiftWrap(shiftWrap(p, -1, 0), 1, 0)).toEqual(p);
  });
  it('replaces and swaps', () => {
    expect(replaceValue(patch(4, 1, [1, 2, 1, 3]), 1, 2, false).cells).toEqual([2, 2, 2, 3]);
    expect(replaceValue(patch(4, 1, [1, 2, 1, 3]), 1, 2, true).cells).toEqual([2, 1, 2, 3]);
  });
});

describe('grid edits', () => {
  it('get/put patch round-trips and clips', () => {
    const d = design(3, 3, [1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(getPatch(d, { x: 1, y: 1, w: 2, h: 2 }).cells).toEqual([5, 6, 8, 9]);
    expect(putPatch(d, patch(2, 2, [0, 0, 0, 0]), 2, 2).cells).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 0]);
    expect(putPatch(d, patch(2, 2, [0, 0, 0, 0]), -1, -1).cells).toEqual([0, 2, 3, 4, 5, 6, 7, 8, 9]);
  });
  it('fills and flood-fills', () => {
    const d = design(3, 3, [0, 0, 1, 0, 1, 0, 1, 0, 0]);
    expect(fillRect(d, { x: 0, y: 0, w: 2, h: 1 }, 2).cells).toEqual([2, 2, 1, 0, 1, 0, 1, 0, 0]);
    expect(floodFill(d, 0, 0, 2).cells).toEqual([2, 2, 1, 2, 1, 0, 1, 0, 0]);
  });
  it('resizes anchored at the bottom-right corner', () => {
    const d = design(2, 2, [1, 2, 3, 4]);
    expect(resizeDesign(d, 3, 3).cells).toEqual([0, 0, 0, 0, 1, 2, 0, 3, 4]);
    expect(resizeDesign(d, 1, 1).cells).toEqual([4]);
  });
  it('inserts and deletes rows and columns', () => {
    const d = design(2, 2, [1, 2, 3, 4]);
    expect(insertRows(d, 1, 1).cells).toEqual([1, 2, 0, 0, 3, 4]);
    expect(insertCols(d, 2, 1).cells).toEqual([1, 2, 0, 3, 4, 0]);
    expect(deleteRows(d, 0, 1).cells).toEqual([3, 4]);
    expect(deleteCols(d, 1, 1).cells).toEqual([1, 3]);
    expect(deleteRows(d, 0, 5).rows).toBe(1);
  });
  it('removing a yarn empties its stitches and renumbers the rest', () => {
    const d = { ...design(4, 1, [1, 2, 3, 0]), yarns: [...blankDesign().yarns, blankDesign().yarns[0]] };
    const r = removeYarn(d, 1);
    expect(r.yarns).toHaveLength(2);
    expect(r.cells).toEqual([1, 0, 2, 0]);
  });
  it('draws connected lines', () => {
    expect(linePoints(0, 0, 3, 1)).toHaveLength(4);
    expect(linePoints(2, 2, 2, 2)).toEqual([{ x: 2, y: 2 }]);
  });
});

describe('parseDesign', () => {
  it('round-trips a design through JSON', () => {
    const d = design(2, 2, [1, 2, 0, 1]);
    expect(parseDesign(JSON.parse(JSON.stringify(d)))).toEqual(d);
  });
  it('rejects bad data and repairs out-of-range cells', () => {
    expect(() => parseDesign({ cols: 2, rows: 2, cells: [1], yarns: [] })).toThrow();
    expect(() => parseDesign({ cols: 9999, rows: 2, cells: [], yarns: [] })).toThrow();
    const d = parseDesign({ cols: 2, rows: 1, cells: [7, 1], yarns: [{ color: '#112233' }] });
    expect(d.cells).toEqual([0, 1]);
    expect(d.yarns[0].texture).toBe('solid');
  });
});

describe('image quantisation', () => {
  it('reduces pixels to k colours, most used first, and keeps transparency empty', () => {
    const px = [
      250, 0, 0, 255, 255, 5, 0, 255, 0, 0, 250, 255,
      245, 0, 5, 255, 0, 0, 0, 0, 0, 5, 255, 255,
    ];
    const q = quantizePixels(px, 3, 2, 2);
    expect(q.colors).toHaveLength(2);
    expect(q.cells).toEqual([1, 1, 2, 1, 0, 2]);
  });
});
