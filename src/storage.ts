import { type Design, parseDesign } from './model';

const LIB_KEY = 'wooldoodle:library:v1';
const DRAFT_KEY = 'wooldoodle:draft:v1';

function read<T>(key: string): T | null {
  try {
    const s = localStorage.getItem(key);
    return s ? (JSON.parse(s) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function listDesigns(): Design[] {
  const raw = read<unknown[]>(LIB_KEY);
  if (!Array.isArray(raw)) return [];
  const out: Design[] = [];
  for (const r of raw) {
    try {
      out.push(parseDesign(r));
    } catch {
      /* skip broken entries */
    }
  }
  return out.sort((a, b) => b.updatedAt - a.updatedAt);
}

/** Saves (or replaces by id) a design in the local library. Returns false if storage is unavailable or full. */
export function saveDesign(d: Design): boolean {
  const all = listDesigns().filter((x) => x.id !== d.id);
  all.unshift(d);
  return write(LIB_KEY, all);
}

export function deleteDesign(id: string): void {
  write(LIB_KEY, listDesigns().filter((x) => x.id !== id));
}

export function loadDraft(): Design | null {
  const raw = read<unknown>(DRAFT_KEY);
  if (!raw) return null;
  try {
    return parseDesign(raw);
  } catch {
    return null;
  }
}

export function saveDraft(d: Design): void {
  write(DRAFT_KEY, d);
}
