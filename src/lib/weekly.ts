import type {
  DailyPoint,
  DayEntry,
  Entries,
  Exercise,
  ExercisePoint,
  Measurement,
  MuscleGroup,
  SessionExercise,
  SessionPoint,
  WeekPoint,
  Workouts,
} from '../types';
import type { ExerciseHistoryPoint } from './training';
import { buildExercisePoint, hasAnySet, sessionGroups } from './training';
import type { GroupSets } from './check';
import { emptyGroupSets } from './check';
import { GROUP_ORDER, isCardio, muscleOf } from './exerciseCatalog';
import {
  MA_WINDOW,
  dayAverageBodyFat,
  dayAverageWeight,
  emptyDay,
  hasAnyValue,
  mean,
  slotCount,
} from './derive';
import { addDays, isoToTime, startOfWeek, todayISO } from './date';

/**
 * 週（日曜〜土曜）ごとの生データと、そこから出る部分結果。
 *
 * **区切る目的は書き込みと再計算の局所化**で、読み込みの局所化ではない
 * （`docs/design-storage.md` §1）。導出値はここでもメモリ上にしか置かない。
 *
 * 増分が成り立つ条件はひとつ——**中身が変わっていない週は、同じオブジェクトのまま返すこと**。
 * 参照が変わらなければ下流の memo が外れないので、無効化の条件を人が書かずに済む。
 */

/** 週の日数。日曜〜土曜 */
export const WEEK_DAYS = 7;

export interface WeekSlice {
  /** 週開始日（日曜）'YYYY-MM-DD' */
  start: string;
  /** 日曜から 7 日ぶん。記録の無い日は null */
  days: (DayEntry | null)[];
}

/** トレの週スライス。体組成と同じ週の並びに乗せる */
export interface WorkoutSlice {
  start: string;
  /** 日曜から 7 日ぶん。その日に種目が無ければ null */
  days: (SessionExercise[] | null)[];
}

/** その週の 1 日ぶんの日平均。移動平均の入力になる */
interface DayAverage {
  weight: number | null;
  bodyFat: number | null;
  slots: 0 | 1 | 2;
}

/**
 * 連続記録の部分結果。
 *
 * 週をまたいだ最長連続は、週ごとに「先頭から続く数」「末尾へ続く数」「内部の最大」
 * 「全部埋まっているか」を持てば合成できる。全期間を舐め直さずに済む。
 */
export interface StreakPart {
  lead: number;
  trail: number;
  best: number;
  all: boolean;
}

export interface BodyWeek {
  slice: WeekSlice;
  /**
   * 前の週から持ち込んだもの（`averages` の参照）。
   *
   * 移動平均が週を跨ぐので、この週の結果は前の週にも依存する。
   * 何を持ち込んだかを覚えておかないと、前の週が変わったのに
   * この週を使い回してしまう。**依存を書き留めておくための欄。**
   */
  carry: unknown;
  /** 日曜から 7 日ぶん。範囲外の日も含む（合成のときに切る） */
  averages: DayAverage[];
  /** 移動平均まで入った 7 日ぶん */
  daily: DailyPoint[];
  /** 週次集計。`label` と前週差は合成のときに埋める */
  week: Omit<WeekPoint, 'label' | 'weightDelta' | 'bodyFatDelta'>;
  recordedDays: number;
  fullDays: number;
  streak: StreakPart;
  /** 開始値のための、この週の日平均（欠測を除いた並び順のまま） */
  headWeights: number[];
  headBodyFats: number[];
}

/* ------------------------------------------------------------------ *
 * 分割
 * ------------------------------------------------------------------ */

/** 週の中身が前回と同じか。日単位の参照比較なので、日数ぶんの比較で済む */
function sameDays<T>(a: readonly (T | null)[], b: readonly (T | null)[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/**
 * 週の並びを決める。
 *
 * 範囲は体組成とトレの**両方**を含む。片方だけで決めると、
 * 体重を付けていない期間のトレーニングが週の外に落ちる。
 *
 * 端は `buildDaily` と同じ考え方——最初の記録から、最終記録日か今日の遅いほうまで——を
 * 週の境目まで広げたもの。広がったぶんの日は記録が無いので、結果に影響しない。
 */
export function weekStarts(entries: Entries, workouts: Workouts): string[] {
  const dates = [
    ...Object.keys(entries).filter((k) => hasAnyValue(entries[k]!)),
    ...Object.keys(workouts).filter((k) => (workouts[k]?.length ?? 0) > 0),
  ];
  if (dates.length === 0) return [];

  let min = dates[0]!;
  let max = dates[0]!;
  for (const d of dates) {
    if (d < min) min = d;
    if (d > max) max = d;
  }
  const today = todayISO();
  const last = startOfWeek(max > today ? max : today);

  const out: string[] = [];
  for (let start = startOfWeek(min); start <= last; start = addDays(start, WEEK_DAYS)) {
    out.push(start);
  }
  return out;
}

/**
 * 体組成の週スライス。**変わっていない週は前回のオブジェクトをそのまま返す。**
 * ここが増分の土台。
 */
export function sliceEntries(
  entries: Entries,
  starts: readonly string[],
  cache: Map<string, WeekSlice>,
): WeekSlice[] {
  return sliceBy(
    starts,
    cache,
    (iso) => {
      const entry = entries[iso];
      return entry && hasAnyValue(entry) ? entry : null;
    },
    (start, days) => ({ start, days }),
  );
}

/** トレの週スライス。体組成と同じ週の並びに乗せる */
export function sliceWorkouts(
  workouts: Workouts,
  starts: readonly string[],
  cache: Map<string, WorkoutSlice>,
): WorkoutSlice[] {
  return sliceBy(
    starts,
    cache,
    (iso) => {
      const day = workouts[iso];
      return day && day.length > 0 ? day : null;
    },
    (start, days) => ({ start, days }),
  );
}

function sliceBy<T, S extends { start: string; days: (T | null)[] }>(
  starts: readonly string[],
  cache: Map<string, S>,
  pick: (iso: string) => T | null,
  make: (start: string, days: (T | null)[]) => S,
): S[] {
  const out: S[] = [];
  const seen = new Set<string>();
  for (const start of starts) {
    const days: (T | null)[] = [];
    for (let i = 0; i < WEEK_DAYS; i++) days.push(pick(addDays(start, i)));
    const cached = cache.get(start);
    const slice = cached && sameDays(cached.days, days) ? cached : make(start, days);
    cache.set(start, slice);
    seen.add(start);
    out.push(slice);
  }
  // 範囲から外れた週は捨てる（記録をすべて消したあとに古い週が残らないように）
  for (const key of [...cache.keys()]) if (!seen.has(key)) cache.delete(key);
  return out;
}

/* ------------------------------------------------------------------ *
 * 週ごとの導出
 * ------------------------------------------------------------------ */

const EMPTY_DAY = emptyDay();

function averageOf(day: DayEntry | null): DayAverage {
  const entry = day ?? EMPTY_DAY;
  return {
    weight: dayAverageWeight(entry),
    bodyFat: dayAverageBodyFat(entry),
    slots: slotCount(entry),
  };
}

/** 週の中の連続記録。合成に必要な 4 つだけを出す */
function streakOf(averages: readonly DayAverage[]): StreakPart {
  let lead = 0;
  while (lead < averages.length && averages[lead]!.slots > 0) lead++;
  let trail = 0;
  while (trail < averages.length && averages[averages.length - 1 - trail]!.slots > 0) trail++;
  let best = 0;
  let run = 0;
  for (const a of averages) {
    run = a.slots > 0 ? run + 1 : 0;
    if (run > best) best = run;
  }
  return { lead, trail, best, all: lead === averages.length };
}

/**
 * 1 週ぶんの導出。
 *
 * **前の週を入力に取る。** 7 日移動平均は週を跨ぐので、その週の最初の 6 日は
 * 前の週の末尾を見ないと出せない（`docs/design-storage.md` §4.1）。
 * 前の週のオブジェクトが変わらなければ、この週の結果も変わらない。
 */
export function deriveBodyWeek(slice: WeekSlice, prev: BodyWeek | null): BodyWeek {
  const averages = slice.days.map(averageOf);

  // 前週の末尾（MA_WINDOW - 1 日）を頭に付けて、窓が跨いでも同じ値になるようにする
  const carry = prev ? prev.averages.slice(WEEK_DAYS - (MA_WINDOW - 1)) : [];
  const ctx = [...carry, ...averages];

  const daily: DailyPoint[] = averages.map((avg, i) => {
    const at = carry.length + i;
    const from = Math.max(0, at - (MA_WINDOW - 1));
    const win = ctx.slice(from, at + 1);
    const iso = addDays(slice.start, i);
    const entry = slice.days[i] ?? EMPTY_DAY;
    return {
      date: iso,
      time: isoToTime(iso),
      am: entry.am as Measurement,
      pm: entry.pm as Measurement,
      weight: avg.weight,
      bodyFat: avg.bodyFat,
      maWeight: mean(win.map((w) => w.weight)),
      maBodyFat: mean(win.map((w) => w.bodyFat)),
      slots: avg.slots,
    };
  });

  const weight = mean(averages.map((a) => a.weight));
  const bodyFat = mean(averages.map((a) => a.bodyFat));
  const fatMass = weight != null && bodyFat != null ? (weight * bodyFat) / 100 : null;

  return {
    slice,
    carry: prev?.averages ?? null,
    averages,
    daily,
    week: {
      start: slice.start,
      end: addDays(slice.start, WEEK_DAYS - 1),
      time: isoToTime(slice.start),
      weight,
      bodyFat,
      fatMass,
      leanMass: weight != null && fatMass != null ? weight - fatMass : null,
      days: averages.filter((a) => a.weight != null).length,
    },
    recordedDays: averages.filter((a) => a.slots > 0).length,
    fullDays: slice.days.filter((d) => d != null && d.am.weight != null && d.pm.weight != null)
      .length,
    streak: streakOf(averages),
    headWeights: averages.map((a) => a.weight).filter((v): v is number => v != null),
    headBodyFats: averages.map((a) => a.bodyFat).filter((v): v is number => v != null),
  };
}

/** 週をまたいだ最長連続記録。部分結果どうしを畳む */
export function combineStreak(parts: readonly StreakPart[]): number {
  let best = 0;
  let carry = 0;
  for (const part of parts) {
    const joined = carry + part.lead;
    if (joined > best) best = joined;
    if (part.best > best) best = part.best;
    carry = part.all ? carry + part.lead : part.trail;
  }
  return carry > best ? carry : best;
}

/* ------------------------------------------------------------------ *
 * トレの週ごとの導出
 * ------------------------------------------------------------------ */

export interface TrainingWeek {
  slice: WorkoutSlice;
  /* ---- 何に依存して作ったか。これが変われば作り直す ---- */
  /** 体重の引き当てに使った体組成の週 */
  body: BodyWeek | null;
  /** その週に入る時点の直近体重（前の週から持ち込む） */
  carryIn: number | null;
  exercises: readonly Exercise[];

  /* ---- 出てくるもの ---- */
  sessions: SessionPoint[];
  setsByGroup: Record<MuscleGroup, number>;
  volumeByGroup: Record<MuscleGroup, number>;
  totalSets: number;
  /** その週にトレーニングした日数 */
  days: number;
  /** 種目ごとの履歴（この週ぶん）。週をまたいだ合成は呼び出し側 */
  historyById: Map<string, ExerciseHistoryPoint[]>;
  /** 部位ごとの、この週での最終実施日 */
  lastByGroup: Map<MuscleGroup, string>;
  lastCardio: string | null;
  /** 構成チェックが読む、日付ごとの事実 */
  groupSets: Map<string, GroupSets>;
  exercisesAt: Map<string, Exercise[]>;
  axialAt: Map<string, Exercise[]>;
  /** 次の週へ持ち出す直近体重 */
  carryOut: number | null;
}

/** その週の中で使える体重。無ければ持ち込みに落ちる */
function bodyWeightsOf(body: BodyWeek | null, carryIn: number | null): (number | null)[] {
  const out: (number | null)[] = [];
  let last = carryIn;
  for (let i = 0; i < WEEK_DAYS; i++) {
    const point = body?.daily[i];
    // buildBodyWeightLookup と同じ順序（その日の日平均 → その日の移動平均 → 直近過去）
    const here = point ? (point.weight ?? point.maWeight) : null;
    if (here != null) last = here;
    out.push(last);
  }
  return out;
}

/**
 * 1 週ぶんのトレの導出。
 *
 * 依存は 4 つ——その週の記録・体組成の週・持ち込みの体重・種目マスタ。
 * **種目マスタが変われば全週が作り直される**（補助部位の係数や 1RM の分母を変えると
 * 過去の集計もすべて変わるため）。参照が変わるので、書き漏らしようがない。
 */
export function deriveTrainingWeek(
  slice: WorkoutSlice,
  body: BodyWeek | null,
  carryIn: number | null,
  exercises: readonly Exercise[],
): TrainingWeek {
  const byId = new Map(exercises.map((e) => [e.id, e]));
  const weights = bodyWeightsOf(body, carryIn);

  const sessions: SessionPoint[] = [];
  const historyById = new Map<string, ExerciseHistoryPoint[]>();
  const lastByGroup = new Map<MuscleGroup, string>();
  const groupSets = new Map<string, GroupSets>();
  const exercisesAt = new Map<string, Exercise[]>();
  const axialAt = new Map<string, Exercise[]>();
  const setsByGroup = emptyGroupSets();
  const volumeByGroup = emptyGroupSets();
  let lastCardio: string | null = null;

  for (let i = 0; i < WEEK_DAYS; i++) {
    const entries = slice.days[i];
    if (!entries || entries.length === 0) continue;
    const date = addDays(slice.start, i);

    const points = entries
      .filter(hasAnySet)
      .map((entry) => {
        const exercise = byId.get(entry.exerciseId);
        return exercise ? buildExercisePoint(exercise, entry, weights[i]!) : null;
      })
      .filter((p): p is ExercisePoint => p !== null);
    if (points.length === 0) continue;

    const session: SessionPoint = { date, time: isoToTime(date), exercises: points };
    sessions.push(session);

    const list: Exercise[] = [];
    const daySets = emptyGroupSets();
    for (const point of points) {
      const item: ExerciseHistoryPoint = { date, time: session.time, point };
      const found = historyById.get(point.exerciseId);
      if (found) found.push(item);
      else historyById.set(point.exerciseId, [item]);

      const exercise = byId.get(point.exerciseId);
      if (exercise) list.push(exercise);
      if (isCardio(point.group)) lastCardio = date;

      // 有酸素は部位ではないので、部位別の数にも回復にも入れない
      const muscle = muscleOf(point.group);
      if (muscle == null) continue;
      // 回復は主部位だけ。補助で入ったぶんは数えない（lib/check.ts の buildCheckHistory）
      daySets[muscle] += point.workSets;
      setsByGroup[muscle] += point.workSets;
      volumeByGroup[muscle] += point.volume;
      // 週の配分は係数込み。疲労と配分は別の話なので、数え方が違ってよい
      for (const sub of point.subGroups) {
        setsByGroup[sub.group] += point.workSets * sub.weight;
        volumeByGroup[sub.group] += point.volume * sub.weight;
      }
    }

    exercisesAt.set(date, list);
    groupSets.set(date, daySets);
    const axial = list.filter((e) => e.axial);
    if (axial.length > 0) axialAt.set(date, axial);
    for (const group of sessionGroups(session)) lastByGroup.set(group, date);
  }

  // 係数を足し上げると 1.2000000000000002 のような値になる。丸め方は buildWeeklySets と同じ
  for (const group of GROUP_ORDER) {
    setsByGroup[group] = Math.round(setsByGroup[group] * 100) / 100;
    volumeByGroup[group] = Math.round(volumeByGroup[group] * 10) / 10;
  }

  return {
    slice,
    body,
    carryIn,
    exercises,
    sessions,
    setsByGroup,
    volumeByGroup,
    totalSets: Math.round(Object.values(setsByGroup).reduce((a, b) => a + b, 0) * 100) / 100,
    days: sessions.length,
    historyById,
    lastByGroup,
    lastCardio,
    groupSets,
    exercisesAt,
    axialAt,
    carryOut: weights[WEEK_DAYS - 1] ?? carryIn,
  };
}
