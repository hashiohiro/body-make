import type { Entries } from '../types';

/**
 * 体重推移_final.xlsx「日次記録」シート（2026-07-26 起点）から取り込んだ初期データ。
 * 初回起動時に一度だけ投入される（storage.ts の SEEDED_KEY で管理）。
 */
export const SEED_SOURCE = '体重推移_final.xlsx';

type Row = [iso: string, amW: number | null, amBf: number | null, pmW: number | null, pmBf: number | null];

const ROWS: Row[] = [
  ['2026-07-26', 73.3, 19.9, 73.9, 19.3],
  ['2026-07-27', 73.9, 20.0, 74.0, 20.0],
  ['2026-07-28', 73.8, 19.4, 74.4, 18.4],
  ['2026-07-29', null, null, 74.0, 18.3],
  ['2026-07-30', 73.8, 19.3, 73.2, 17.9],
  ['2026-07-31', 73.4, 21.5, null, null],
  ['2026-08-01', 74.3, 20.3, null, null],
  ['2026-08-02', null, null, 76.3, 23.6],
  ['2026-08-03', 75.9, 23.4, 74.2, 18.8],
  ['2026-08-04', 74.2, 23.4, 74.7, 22.3],
  ['2026-08-05', 74.0, 21.4, 74.7, 20.0],
  ['2026-08-06', 74.1, 19.5, 74.3, 19.3],
  ['2026-08-07', 74.0, 20.8, 73.1, 18.1],
  ['2026-08-08', 73.1, 20.5, null, null],
];

export function seedEntries(): Entries {
  const entries: Entries = {};
  for (const [iso, amW, amBf, pmW, pmBf] of ROWS) {
    entries[iso] = {
      am: { weight: amW, bodyFat: amBf },
      pm: { weight: pmW, bodyFat: pmBf },
    };
  }
  return entries;
}
