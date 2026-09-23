/** 日付はすべて「ローカル日付の YYYY-MM-DD 文字列」を正とする。
 *  UTC 変換を挟むと深夜の記録が前日にずれるため、Date への出入りは必ずここを通す。 */
import { IS_DEMO } from './env';
import type { MessageKey, T } from './i18n';

/**
 * デモで「今日」として扱う日。**初期データの最終記録日に時計を止める。**
 *
 * 止めないと、日が経つほどデモが壊れていく。最終記録からの日数が伸び、
 * 今週のセット数は 0 になり、連続記録は途切れ、回復は「記録なし」に寄っていく。
 * 説明用のデモが、放置された記録の見本になってしまう。
 *
 * 8/29（土）にしてあるのは、その週（8/23〜8/29）に 5 日ぶんのトレーニングが入っていて、
 * 週次の集計が埋まっているため。翌日の 8/30 は日曜＝週の初日で、今週が空になる。
 */
export const DEMO_TODAY = '2026-08-29';

/** 曜日の名前。日曜 = 0（`weekdayIndex` と同じ並び） */
/** 曜日の文言のキー。文字そのものは辞書が持つ（`docs/design-i18n.md`） */
export const WEEKDAY_KEYS = [
  'weekday.0',
  'weekday.1',
  'weekday.2',
  'weekday.3',
  'weekday.4',
  'weekday.5',
  'weekday.6',
] as const satisfies readonly MessageKey[];

export const MS_PER_DAY = 86_400_000;

export function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** 'YYYY-MM-DD' をローカル 0 時の Date にする */
export function fromISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

/** x 軸用の epoch ms。DST 切替日でも日単位の等間隔が崩れないようローカル正午を使う */
export function isoToTime(iso: string): number {
  const d = fromISO(iso);
  d.setHours(12, 0, 0, 0);
  return d.getTime();
}

/**
 * 「今日」。**アプリ内で現在時刻を読むのはここだけ**なので、ここを止めれば全体が止まる。
 * （ほかの `new Date()` は epoch ms から日付を作るためのもので、現在時刻は見ていない）
 */
export function todayISO(): string {
  return IS_DEMO ? DEMO_TODAY : toISO(new Date());
}

export function addDays(iso: string, n: number): string {
  const d = fromISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
}

/** iso1 − iso2 の日数差 */
export function diffDays(iso1: string, iso2: string): number {
  return Math.round((isoToTime(iso1) - isoToTime(iso2)) / MS_PER_DAY);
}

export function weekdayIndex(iso: string): number {
  return fromISO(iso).getDay();
}

export function weekdayLabel(t: T, iso: string): string {
  const key = WEEKDAY_KEYS[weekdayIndex(iso)];
  return key ? t(key) : '';
}

/** 週 = 日曜〜土曜（エクセル「週次分析」シートと同じ区切り） */
export function startOfWeek(iso: string): string {
  return addDays(iso, -weekdayIndex(iso));
}

export function clampISO(iso: string, min: string, max: string): string {
  return iso < min ? min : iso > max ? max : iso;
}

export function formatMD(iso: string): string {
  const d = fromISO(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

/**
 * 月日と曜日。**`t` を引数で受ける**——ここは部品ではないのでフックを呼べない。
 * 曜日の文字も、並べ方（括弧の位置）も辞書が決める。
 */
export function formatMDW(t: T, iso: string): string {
  return t('date.mdw', { md: formatMD(iso), w: weekdayLabel(t, iso) });
}

export function formatYMD(t: T, iso: string): string {
  const d = fromISO(iso);
  return t('date.ymd', { y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate() });
}

/** 「あと 12 日」「3 か月後」のような相対表現 */
export function formatRelativeDays(t: T, days: number): string {
  if (days < 1) return t('common.today');
  if (days < 31) return t('date.inDays', { n: Math.round(days) });
  if (days < 365) return t('date.inMonths', { n: Math.round(days / 30.4) });
  return t('date.inYears', { n: (days / 365).toFixed(1) });
}
