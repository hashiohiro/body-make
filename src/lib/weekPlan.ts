import { MAX_RECOVERY_DAYS, requiredDays } from './check';
import { GROUP_ORDER, muscleOf } from './exerciseCatalog';
import type { Exercise, GroupGoals, MuscleGroup, Preset, Weekday } from '../types';

/**
 * 週のメニューを組んでいる最中の下書き。**保存しない。**
 *
 * 出来上がるのは既存のプリセット（種目と、任意の曜日・既定セット）で、
 * この形のまま残すことはしない。計画データを新しく持たないため
 * （`docs/design-checks.md` §1）。
 */
export interface WeekDraftDay {
  /** その日に鍛える部位。全身図で選ぶ */
  groups: MuscleGroup[];
  /** その日にやる種目と、何セットやるか */
  items: { exerciseId: string; sets: number }[];
}

export type WeekDraft = Record<Weekday, WeekDraftDay>;

export const WEEKDAYS: Weekday[] = [0, 1, 2, 3, 4, 5, 6];

export function emptyDraft(): WeekDraft {
  const out = {} as WeekDraft;
  for (const day of WEEKDAYS) out[day] = { groups: [], items: [] };
  return out;
}

/**
 * 1 日あたりのセット数の提案。**本人が決めた週の目標を、置いた日数で割るだけ。**
 *
 * こちらで標準値を発明しない。目標を決めていない部位は提案しない（null）。
 * 割り切れないぶんは切り上げる——足りないより多いほうが、目標に届く。
 */
export function suggestSetsPerDay(
  goals: GroupGoals,
  group: MuscleGroup,
  days: number,
): number | null {
  const target = goals[group];
  if (target == null || target.type !== 'sets' || days <= 0) return null;
  return Math.ceil(target.value / days);
}

/**
 * 下書きの週あたり部位別セット数。
 *
 * 数え方は記録側とまったく同じ——**主部位は 1 セット、補助部位は種目ごとの係数ぶん**
 * （`buildWeeklySets`）。別の数え方にすると、組んだときの数字と
 * 実際に記録したときの数字が合わなくなる。
 */
export function draftGroupSets(
  draft: WeekDraft,
  exercises: readonly Exercise[],
): Record<MuscleGroup, number> {
  const byId = new Map(exercises.map((e) => [e.id, e]));
  const totals = {
    chest: 0,
    back: 0,
    legs: 0,
    shoulders: 0,
    arms: 0,
    core: 0,
  } satisfies Record<MuscleGroup, number>;

  for (const day of WEEKDAYS) {
    for (const item of draft[day].items) {
      const exercise = byId.get(item.exerciseId);
      if (!exercise) continue;
      // 有酸素は部位ではないので、部位別の数には入れない
      const muscle = muscleOf(exercise.group);
      if (muscle == null) continue;
      totals[muscle] += item.sets;
      for (const sub of exercise.subGroups) totals[sub.group] += item.sets * sub.weight;
    }
  }
  // 係数を足し上げると 1.2000000000000002 のような値になる（記録側と同じ丸め）
  for (const group of Object.keys(totals) as MuscleGroup[]) {
    totals[group] = Math.round(totals[group] * 100) / 100;
  }
  return totals;
}

/** 回復の帯の 1 マス。**置いた日と、その後の回復中を分けて持つ** */
export interface RecoveryCell {
  /** その日に置いたセット数。0 なら置いていない */
  sets: number;
  /** 前に置いたぶんの回復がまだ続いているか */
  recovering: boolean;
  /** 回復中に次を置いたか。警告文と同じ条件（`recoveryWarningsFrom`） */
  overlap: boolean;
}

export interface RecoveryRow {
  group: MuscleGroup;
  /** 日〜土の 7 マス */
  cells: RecoveryCell[];
  /** 濃淡を部位ごとに正規化する。部位間でセット数の大きさが違う */
  max: number;
}

/**
 * 回復の帯。**いつ効かせて、いつまで回復中かを、並びで出す。**
 *
 * 閾値は記録側とまったく同じところから取る（`requiredDays`）。別に数えると、
 * 図と数字が食い違う。
 *
 * **並びの意味は呼ぶ側が決める。**週の組み立ては日〜土で、最後の次は先頭へ
 * 戻る（`wrap`）——金土に置いた脚が、日月に置いたのと同じことにならないように。
 * 実績は「直近 7 日、右端が今日」で、先はまだ無いので戻さない。
 *
 * **何も置いていない部位を出すかは呼ぶ側が決める。**組み立てでは空行で埋まるだけ
 * だが、実績では「今週まだやっていない部位」がそのまま読む相手になる（`all`）。
 *
 * `skip` は**手前に足した助走**。実績の帯は今週（日〜土）を出すが、先週の土曜に
 * やったぶんの回復は日曜まで続く。手前の日も渡して計算し、表示からは落とす
 * ——助走が無いと、日曜に開いた帯が空になって「回復中」が消えていた。
 */
export function recoveryRows(
  days: readonly Record<MuscleGroup, number>[],
  { wrap = true, all = false, skip = 0 }: { wrap?: boolean; all?: boolean; skip?: number } = {},
): RecoveryRow[] {
  const out: RecoveryRow[] = [];
  const span = days.length;

  for (const group of GROUP_ORDER) {
    const sets = days.map((d) => d[group] ?? 0);
    if (!all && sets.slice(skip).every((n) => n === 0)) continue;

    const cells: RecoveryCell[] = sets.map((n) => ({
      sets: n,
      recovering: false,
      overlap: false,
    }));

    for (let at = 0; at < span; at++) {
      const n = sets[at]!;
      if (n === 0) continue;
      const needs = Math.min(requiredDays(n), MAX_RECOVERY_DAYS);
      // 空ける日数が 1 なら翌日にやってよい。回復中として塗るのは、その手前まで
      for (let i = 1; i < needs; i++) {
        const at2 = at + i;
        if (!wrap && at2 >= span) break;
        const cell = cells[at2 % span]!;
        cell.recovering = true;
        if (cell.sets > 0) cell.overlap = true;
      }
    }
    // 助走ぶんは出さない。濃さの基準も、見えている範囲だけから取る
    const shown = cells.slice(skip);
    out.push({ group, cells: shown, max: Math.max(...shown.map((c) => c.sets), 0) });
  }
  return out;
}

/** 曜日を持つプリセットから読んだ、週の置きかた */
export interface WeekLoad {
  /** 曜日ごとの部位別セット数。回復の帯に渡す */
  perDay: Record<Weekday, Record<MuscleGroup, number>>;
  /** 週の部位別セット数。全身図の濃さに使う */
  totals: Record<MuscleGroup, number>;
  /** 置いてあるのに数えられなかった部位。既定のセットも週目標も無いもの */
  unknown: MuscleGroup[];
}

/**
 * いま週に置いてあるものを読む。**計画データは持たない。**
 *
 * 出どころは曜日を持つプリセットだけ。セット数は 2 段で決める。
 *
 *   1. **本人が打った数字**（`defaults` の行数）があれば、それをそのまま
 *   2. 無ければ**週目標を、その部位を置いた日数で割る**（`suggestSetsPerDay`）
 *
 * 既定のセットを必須にしない。曜日に割り当てた時点で「どの部位を週に何日やるか」
 * は分かるので、そこまで決めた人には目標から割った見込みが出せる。
 * どちらも無い部位は 0 のままで、`unknown` に入れて呼ぶ側が書く
 * ——1 種目 1 セットと仮定すると、置いてあるのに少ししかやらないように見える。
 */
export function weekLoad(
  presets: readonly Preset[],
  exercises: readonly Exercise[],
  goals: GroupGoals,
): WeekLoad {
  // 伏せたものは曜日を持ったままでも週から降りる（戻せば曜日つきで戻る）
  const placed = presets.filter((p) => p.weekdays.length > 0 && !p.hidden);
  const byId = new Map(exercises.map((e) => [e.id, e]));

  /** その日に置いてある種目と、打ってある行数（無ければ 0） */
  const itemsOf = (day: Weekday) =>
    placed
      .filter((p) => p.weekdays.includes(day))
      .flatMap((p) =>
        p.exerciseIds.map((exerciseId) => ({
          exerciseId,
          sets: p.defaults[exerciseId]?.length ?? 0,
        })),
      );

  /** その日に触る部位。主部位も補助部位も含める（数え方は `draftGroupSets` と同じ） */
  const groupsOfDay = (day: Weekday) => {
    const out = new Set<MuscleGroup>();
    for (const item of itemsOf(day)) {
      const exercise = byId.get(item.exerciseId);
      if (!exercise) continue;
      const muscle = muscleOf(exercise.group);
      if (muscle) out.add(muscle);
      for (const sub of exercise.subGroups) out.add(sub.group);
    }
    return out;
  };

  const dayGroups = Object.fromEntries(WEEKDAYS.map((d) => [d, groupsOfDay(d)])) as Record<
    Weekday,
    Set<MuscleGroup>
  >;
  const daysOf = (group: MuscleGroup) => WEEKDAYS.filter((d) => dayGroups[d].has(group)).length;

  const perDay = {} as Record<Weekday, Record<MuscleGroup, number>>;
  const unknown = new Set<MuscleGroup>();

  for (const day of WEEKDAYS) {
    // 打ってある行数から出した、その日の部位別セット数
    const one = emptyDraft();
    one[day] = { groups: [], items: itemsOf(day).filter((item) => item.sets > 0) };
    const typed = draftGroupSets(one, exercises);

    const row = {} as Record<MuscleGroup, number>;
    for (const group of GROUP_ORDER) {
      if (!dayGroups[day].has(group)) {
        row[group] = 0;
        continue;
      }
      // 打った数字が勝つ。無ければ目標から割る
      const guess = suggestSetsPerDay(goals, group, daysOf(group)) ?? 0;
      row[group] = typed[group] > 0 ? typed[group] : guess;
      if (row[group] === 0) unknown.add(group);
    }
    perDay[day] = row;
  }

  const totals = {} as Record<MuscleGroup, number>;
  for (const group of GROUP_ORDER) {
    let sum = 0;
    for (const day of WEEKDAYS) sum += perDay[day][group];
    // 係数を足し上げると 1.2000000000000002 のような値になる（記録側と同じ丸め）
    totals[group] = Math.round(sum * 100) / 100;
  }

  return { perDay, totals, unknown: GROUP_ORDER.filter((g) => unknown.has(g)) };
}
