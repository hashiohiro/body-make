import type { AppData, DayEntry, Entries, Measurement, Settings, ThemePref } from '../types';
import { seedEntries } from './seed';

const DATA_KEY = 'bodymake.data.v1';
const SEEDED_KEY = 'bodymake.seeded.v1';

export const DEFAULT_SETTINGS: Settings = {
  heightCm: null,
  targetWeight: null,
  targetBodyFat: null,
  targetDate: null,
  theme: 'system',
};

export function emptyData(): AppData {
  return { version: 1, settings: { ...DEFAULT_SETTINGS }, entries: {} };
}

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

function num(value: unknown, min: number, max: number): number | null {
  const n = typeof value === 'string' ? Number(value) : value;
  if (typeof n !== 'number' || !Number.isFinite(n)) return null;
  if (n < min || n > max) return null;
  return Math.round(n * 10) / 10;
}

export const WEIGHT_RANGE: [number, number] = [20, 300];
export const BODYFAT_RANGE: [number, number] = [1, 70];
export const HEIGHT_RANGE: [number, number] = [100, 250];

export function parseWeight(value: unknown): number | null {
  return num(value, WEIGHT_RANGE[0], WEIGHT_RANGE[1]);
}

export function parseBodyFat(value: unknown): number | null {
  return num(value, BODYFAT_RANGE[0], BODYFAT_RANGE[1]);
}

function sanitizeMeasurement(raw: unknown): Measurement {
  const o = (raw ?? {}) as Record<string, unknown>;
  return { weight: parseWeight(o.weight), bodyFat: parseBodyFat(o.bodyFat) };
}

function sanitizeDay(raw: unknown): DayEntry {
  const o = (raw ?? {}) as Record<string, unknown>;
  return { am: sanitizeMeasurement(o.am), pm: sanitizeMeasurement(o.pm) };
}

/** 外部から来た JSON は形が保証されないため、必ずここで型と値域を通してから state に入れる */
export function sanitizeEntries(raw: unknown): Entries {
  const out: Entries = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!ISO_RE.test(key)) continue;
    const day = sanitizeDay(value);
    if (day.am.weight == null && day.am.bodyFat == null && day.pm.weight == null && day.pm.bodyFat == null) {
      continue;
    }
    out[key] = day;
  }
  return out;
}

function sanitizeSettings(raw: unknown): Settings {
  const o = (raw ?? {}) as Record<string, unknown>;
  const theme = o.theme;
  return {
    heightCm: num(o.heightCm, HEIGHT_RANGE[0], HEIGHT_RANGE[1]),
    targetWeight: parseWeight(o.targetWeight),
    targetBodyFat: parseBodyFat(o.targetBodyFat),
    targetDate: typeof o.targetDate === 'string' && ISO_RE.test(o.targetDate) ? o.targetDate : null,
    theme: theme === 'light' || theme === 'dark' ? (theme as ThemePref) : 'system',
  };
}

export function sanitizeData(raw: unknown): AppData {
  const o = (raw ?? {}) as Record<string, unknown>;
  return {
    version: 1,
    settings: sanitizeSettings(o.settings),
    entries: sanitizeEntries(o.entries),
  };
}

export function loadData(): AppData {
  let stored: AppData | null = null;
  try {
    const raw = localStorage.getItem(DATA_KEY);
    if (raw) stored = sanitizeData(JSON.parse(raw) as unknown);
  } catch {
    stored = null;
  }

  if (stored && Object.keys(stored.entries).length > 0) return stored;

  // 初回起動時のみエクセルの記録を投入する。ユーザーが全消ししたあとに復活させない
  let seeded = false;
  try {
    seeded = localStorage.getItem(SEEDED_KEY) === '1';
  } catch {
    seeded = true;
  }
  if (!seeded) {
    try {
      localStorage.setItem(SEEDED_KEY, '1');
    } catch {
      /* プライベートモード等で書けなくても続行する */
    }
    return { version: 1, settings: stored?.settings ?? { ...DEFAULT_SETTINGS }, entries: seedEntries() };
  }

  return stored ?? emptyData();
}

export function saveData(data: AppData): void {
  try {
    localStorage.setItem(DATA_KEY, JSON.stringify(data));
  } catch {
    /* 容量超過などは保存失敗として黙って握る（UI 側でエクスポートを促す） */
  }
}
