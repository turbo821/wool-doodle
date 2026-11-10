const PATHS: Record<string, string> = {
  select: 'M4 4h3M10 4h4M17 4h3v3M20 10v4M20 17v3h-3M14 20h-4M7 20H4v-3M4 14v-4M4 7V4',
  paint: 'M4 20l1-4L16 5l3 3L8 19l-4 1zM14 7l3 3',
  fill: 'M4 5h16v14H4zM4 12h16M12 5v14',
  bucket: 'M5 13l7-7 7 7-6 6a1.5 1.5 0 0 1-2 0l-6-6zM12 6V3M20 16c0 1.5 1 2 1 3a1 1 0 0 1-2 0c0-1 1-1.5 1-3z',
  undo: 'M9 7L4 12l5 5M4 12h10a5 5 0 0 1 0 10h-2',
  redo: 'M15 7l5 5-5 5M20 12H10a5 5 0 0 0 0 10h2',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  rotate: 'M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5',
  rotateL: 'M4 12a8 8 0 1 0 2.3-5.7M4 4v5h5',
  flipH: 'M12 3v18M8 7l-5 5 5 5V7zM16 7l5 5-5 5V7z',
  flipV: 'M3 12h18M7 8l5-5 5 5H7zM7 16l5 5 5-5H7z',
  left: 'M15 6l-6 6 6 6',
  right: 'M9 6l6 6-6 6',
  up: 'M6 15l6-6 6 6',
  down: 'M6 9l6 6 6-6',
  trash: 'M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13',
  chevron: 'M7 10l5 5 5-5',
  close: 'M6 6l12 12M18 6L6 18',
  copy: 'M9 9h11v11H9zM5 15H4V4h11v1',
  swap: 'M7 7h13l-3-3M17 17H4l3 3',
};

export function Icon({ name, size = 18 }: { name: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={PATHS[name] ?? ''} />
    </svg>
  );
}
