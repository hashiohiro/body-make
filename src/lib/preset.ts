import { WEEKDAY_JA, weekdayIndex } from './date';
import type { Preset, SessionSet, Weekday } from '../types';

/** 曜日の札に出す文字。複数なら「月・木」。持たないプリセットは null */
export function weekdaysLabel(weekdays: readonly Weekday[]): string | null {
  if (weekdays.length === 0) return null;
  return weekdays.map((d) => WEEKDAY_JA[d]).join('・');
}

/** 選べる曜日の一覧。日曜から土曜（`startOfWeek` と同じ並び） */
export const WEEKDAY_CHOICES: { id: Weekday; label: string }[] = WEEKDAY_JA.map((label, i) => ({
  id: i as Weekday,
  label,
}));

/**
 * その日に出す順に並べ替える。**今日の曜日のものを先頭へ。**
 *
 * 並べ替えるだけで、**絞らない**。曜日を 1 つも決めていなければ、並びは元のまま。
 *
 * いまは既定セットの引き当て（`defaultSetsFor`）だけが使う。記録画面の一覧は
 * 並べ替えではなく、**今日の週メニューを 1 つ別に出す**形になった（`TrainingView`）。
 */
export function orderForDate(presets: readonly Preset[], date: string): Preset[] {
  const today = weekdayIndex(date) as Weekday;
  // 元の並びを保ったまま、今日のものだけを前に出す（安定な並べ替え）
  const mine = presets.filter((p) => p.weekdays.includes(today));
  return mine.length === 0
    ? [...presets]
    : [...mine, ...presets.filter((p) => !p.weekdays.includes(today))];
}

/**
 * その種目に使う既定のセット。**無ければ null。**
 *
 * 入力欄に**薄く出すだけ**の目安で、記録には入らない（`Preset.defaults`）。
 *
 * 同じ種目が複数のプリセットに入っていることはある。選ぶ順は
 * **その日の曜日のものが先、次に一覧の並び順**。その日の週メニューが
 * 記録画面で先に出るので、目安の出どころもそこに合わせる。
 */
export function defaultSetsFor(
  presets: readonly Preset[],
  exerciseId: string,
  date: string,
): SessionSet[] | null {
  for (const preset of orderForDate(presets, date)) {
    const sets = preset.defaults[exerciseId];
    if (sets && sets.length > 0) return sets;
  }
  return null;
}
