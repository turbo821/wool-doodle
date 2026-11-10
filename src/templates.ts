import { type Design, blankDesign, makeYarn, uid } from './model';

export interface Template {
  key: string;
  title: string;
  build: () => Design;
}

function fromFn(
  name: string,
  cols: number,
  rows: number,
  yarns: ReturnType<typeof makeYarn>[],
  fn: (x: number, y: number) => number,
  extra: Partial<Design> = {},
): Design {
  const cells: number[] = [];
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) cells.push(fn(x, y));
  return {
    id: uid(),
    name,
    description: '',
    cols,
    rows,
    cells,
    yarns,
    gauge: { sts: 22, rows: 24 },
    repeatX: 2,
    repeatY: 1,
    shape: 'flat',
    around: 8,
    updatedAt: Date.now(),
    ...extra,
  };
}

function fairIsle(): Design {
  // Bands, top to bottom: [height, painter(x, localY)]
  const zig = (c: number) => (x: number, y: number) => (y === Math.abs((x % 4) - 2) ? c : 1);
  const diamond = (x: number, y: number) => {
    const s = Math.abs((x % 8) - 4) + Math.abs(y - 3);
    return s === 3 ? 2 : s === 0 ? 4 : s < 3 ? 3 : 1;
  };
  const bands: [number, (x: number, y: number) => number][] = [
    [1, () => 2],
    [1, (x) => (x % 2 === 0 ? 2 : 1)],
    [1, () => 1],
    [3, zig(3)],
    [1, () => 1],
    [7, diamond],
    [1, () => 1],
    [3, zig(4)],
    [1, () => 1],
    [1, (x) => (x % 2 === 0 ? 2 : 1)],
    [1, () => 2],
  ];
  const rowMap: { fn: (x: number, y: number) => number; ly: number }[] = [];
  for (const [h, fn] of bands) for (let i = 0; i < h; i++) rowMap.push({ fn, ly: i });
  return fromFn(
    'Северная кайма',
    24,
    rowMap.length,
    [
      makeYarn('Овсяный', '#ece2cc', 'heather'),
      makeYarn('Ночной синий', '#27375a'),
      makeYarn('Брусника', '#b23a3a'),
      makeYarn('Горчица', '#d3a02c', 'heather'),
    ],
    (x, y) => rowMap[y].fn(x, rowMap[y].ly),
  );
}

function hearts(): Design {
  const art = ['01100110', '11111111', '11111111', '01111110', '00111100', '00011000', '00000000', '00000000'];
  return fromFn(
    'Сердечки',
    16,
    16,
    [makeYarn('Сливки', '#f1e9da'), makeYarn('Малина', '#c2334d')],
    (x, y) => {
      const row = Math.floor(y / 8);
      const sx = (x + (row % 2) * 4) % 8;
      return art[y % 8][sx] === '1' ? 2 : 1;
    },
    { repeatX: 2, repeatY: 2 },
  );
}

function stripes(): Design {
  const seq = [1, 1, 1, 1, 2, 2, 3, 3, 3, 1, 1, 4];
  return fromFn(
    'Полоски',
    16,
    24,
    [
      makeYarn('Графит', '#3b3f46', 'heather'),
      makeYarn('Песок', '#d8c59f'),
      makeYarn('Терракота', '#b9593a', 'tweed'),
      makeYarn('Шалфей', '#8aa38b'),
    ],
    (_x, y) => seq[y % seq.length],
    { repeatX: 1 },
  );
}

export const TEMPLATES: Template[] = [
  { key: 'fairisle', title: 'Северная кайма (жаккард)', build: fairIsle },
  { key: 'hearts', title: 'Сердечки', build: hearts },
  { key: 'stripes', title: 'Полоски', build: stripes },
  { key: 'blank', title: 'Пустая сетка 20 × 20', build: () => blankDesign(20, 20) },
];

export const defaultDesign = fairIsle;
