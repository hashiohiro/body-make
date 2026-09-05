import type {
  AppData,
  DailyPoint,
  Exercise,
  MuscleGroup,
  Projection,
  SessionPoint,
  Settings,
  Stats,
  WeekPoint,
} from '../types';
import { MA_WINDOW, computeProjection } from './derive';
import { addDays, formatMD, todayISO } from './date';
import { buildCheckHistory } from './check';
import type { CheckHistory, GroupSets } from './check';
import { computeTrainingStats, exerciseGoals } from './training';
import type { ExerciseHistoryPoint, TrainingStats, WeekSetCount } from './training';
import {
  WEEK_DAYS,
  combineStreak,
  deriveBodyWeek,
  deriveTrainingWeek,
  sliceEntries,
  sliceWorkouts,
  weekStarts,
} from './weekly';
import type { BodyWeek, TrainingWeek, WeekSlice, WorkoutSlice } from './weekly';

/**
 * 増分の導出。
 *
 * 公開している純関数（`buildDaily` など）は**そのまま残してある**。
 * あちらが定義で、こちらは同じ答えを速く出すための経路。
 * 一致は `incremental.test.ts` が固定していて、ずれたら落ちる。
 *
 * 保持するのは**計算の途中結果だけ**で、保存はしない（`docs/design-storage.md` §1）。
 * 起動のたびにゼロから作り直されるので、ずれた状態が残ることが起こらない。
 */

/** 直近の記録率を見る窓 */
const RECORD_RATE_DAYS = 30;

export interface DeriveCache {
  entrySlices: Map<string, WeekSlice>;
  workoutSlices: Map<string, WorkoutSlice>;
  bodyWeeks: Map<string, BodyWeek>;
  trainingWeeks: Map<string, TrainingWeek>;
}

export function createDeriveCache(): DeriveCache {
  return {
    entrySlices: new Map(),
    workoutSlices: new Map(),
    bodyWeeks: new Map(),
    trainingWeeks: new Map(),
  };
}

export interface Derived {
  daily: DailyPoint[];
  weeks: WeekPoint[];
  stats: Stats;
  projection: Projection;
  sessions: SessionPoint[];
  weeklySets: WeekSetCount[];
  trainingStats: TrainingStats;
  checkHistory: CheckHistory;
  trainingGoals: ReturnType<typeof exerciseGoals>;
}

const EMPTY_STATS: Stats = {
  first: null,
  latest: null,
  currentWeight: null,
  currentBodyFat: null,
  currentFatMass: null,
  currentLeanMass: null,
  startWeight: null,
  startBodyFat: null,
  startFatMass: null,
  startLeanMass: null,
  weightDelta: null,
  bodyFatDelta: null,
  fatMassDelta: null,
  leanMassDelta: null,
  bmi: null,
  streak: 0,
  bestStreak: 0,
  recordRate: 0,
  recordedDays: 0,
  fullDays: 0,
  perfectWeeks: 0,
  totalSpanDays: 0,
};

/**
 * 導出をまとめて出す。**変わった週だけを計算し直す。**
 *
 * 週の並びは体組成とトレの和集合で決める。片方だけで決めると、
 * 体重を付けていない期間のトレーニングが週の外に落ちる。
 *
 * 週は前から順に作る。前の週を入力に取るので（移動平均と体重の持ち込み）、
 * 途中の週が変わればそこから後ろは作り直しになる。逆に、直近の日を打っている
 * あいだは**最後の 1 週だけ**が作り直される。
 */
export function deriveAll(data: AppData, cache: DeriveCache): Derived {
  const starts = weekStarts(data.entries, data.workouts);
  if (starts.length === 0) {
    cache.entrySlices.clear();
    cache.workoutSlices.clear();
    cache.bodyWeeks.clear();
    cache.trainingWeeks.clear();
    return empty(data);
  }

  const entrySlices = sliceEntries(data.entries, starts, cache.entrySlices);
  const workoutSlices = sliceWorkouts(data.workouts, starts, cache.workoutSlices);

  const bodyWeeks: BodyWeek[] = [];
  const trainingWeeks: TrainingWeek[] = [];
  let prevBody: BodyWeek | null = null;
  let carry: number | null = null;

  for (let i = 0; i < starts.length; i++) {
    const start = starts[i]!;
    const entrySlice = entrySlices[i]!;
    const workoutSlice = workoutSlices[i]!;

    const cachedBody = cache.bodyWeeks.get(start);
    // 中身と、前の週から持ち込むものの両方が同じなら作り直さない
    const bodyReusable =
      cachedBody != null &&
      cachedBody.slice === entrySlice &&
      cachedBody.carry === (prevBody?.averages ?? null);
    const body: BodyWeek = bodyReusable ? cachedBody : deriveBodyWeek(entrySlice, prevBody);
    cache.bodyWeeks.set(start, body);
    bodyWeeks.push(body);

    const cachedTraining = cache.trainingWeeks.get(start);
    const trainingReusable =
      cachedTraining != null &&
      cachedTraining.slice === workoutSlice &&
      cachedTraining.body === body &&
      cachedTraining.carryIn === carry &&
      cachedTraining.exercises === data.exercises;
    const training: TrainingWeek = trainingReusable
      ? cachedTraining
      : deriveTrainingWeek(workoutSlice, body, carry, data.exercises);
    cache.trainingWeeks.set(start, training);
    trainingWeeks.push(training);

    prevBody = body;
    carry = training.carryOut;
  }

  for (const key of [...cache.bodyWeeks.keys()]) {
    if (!cache.entrySlices.has(key)) {
      cache.bodyWeeks.delete(key);
      cache.trainingWeeks.delete(key);
    }
  }

  const body = combineBody(bodyWeeks, data.settings);
  const training = combineTraining(trainingWeeks, data.exercises);
  return { ...body, ...training };
}

function empty(data: AppData): Derived {
  return {
    daily: [],
    weeks: [],
    stats: EMPTY_STATS,
    projection: computeProjection([], EMPTY_STATS, data.settings),
    sessions: [],
    weeklySets: [],
    trainingStats: computeTrainingStats([]),
    checkHistory: buildCheckHistory([], data.exercises),
    trainingGoals: exerciseGoals([], []),
  };
}

/* ------------------------------------------------------------------ *
 * 合成（体組成）
 * ------------------------------------------------------------------ */

/** 後ろから探す。`Array.prototype.findLastIndex` は対象環境を上げないと使えない */
function findLastIndex<T>(list: readonly T[], hit: (item: T) => boolean): number {
  for (let i = list.length - 1; i >= 0; i--) if (hit(list[i]!)) return i;
  return -1;
}

function combineBody(
  built: readonly BodyWeek[],
  settings: Settings,
): Pick<Derived, 'daily' | 'weeks' | 'stats' | 'projection'> {
  /*
   * 週の並びはトレも含む範囲で作ってあるので、体組成の側はそこから切り出す。
   * `buildDaily` は「最初に記録のある日から、最終記録日か今日の遅いほうまで」なので、
   * その範囲に合わせないと配列の長さ（= totalSpanDays）が変わる。
   *
   * **探すのは境目だけ。**週ごとの記録日数を持っているので、
   * 全期間を絞り込まなくても、端の週の中を見れば決まる。
   */
  const today = todayISO();
  const firstWeek = built.findIndex((w) => w.recordedDays > 0);
  if (firstWeek < 0) {
    return {
      daily: [],
      weeks: [],
      stats: EMPTY_STATS,
      projection: computeProjection([], EMPTY_STATS, settings),
    };
  }
  const lastWeek = findLastIndex(built, (w) => w.recordedDays > 0);
  const firstAt = firstWeek * WEEK_DAYS + built[firstWeek]!.daily.findIndex((d) => d.slots > 0);
  const lastRecordedAt =
    lastWeek * WEEK_DAYS + findLastIndex(built[lastWeek]!.daily, (d) => d.slots > 0);

  const flat = built.flatMap((w) => w.daily);
  const lastRecorded = flat[lastRecordedAt]!.date;
  // 今日が最終記録日より後なら、そこまで伸ばす（`buildDaily` と同じ）
  let lastAt = lastRecordedAt;
  if (lastRecorded <= today) {
    while (lastAt + 1 < flat.length && flat[lastAt + 1]!.date <= today) lastAt++;
  }
  const daily = flat.slice(firstAt, lastAt + 1);

  // 週次分析も体組成の範囲だけ。`W01` の採番はその先頭から
  const weeks: WeekPoint[] = [];
  for (let i = firstWeek; i <= Math.floor(lastAt / WEEK_DAYS); i++) {
    const w = built[i]!;
    const before = weeks[weeks.length - 1];
    weeks.push({
      ...w.week,
      label: `W${`${weeks.length + 1}`.padStart(2, '0')}`,
      weightDelta:
        w.week.weight != null && before?.weight != null ? w.week.weight - before.weight : null,
      bodyFatDelta:
        w.week.bodyFat != null && before?.bodyFat != null ? w.week.bodyFat - before.bodyFat : null,
    });
  }

  const stats = combineStats(built, weeks, daily, settings, today);
  return { daily, weeks, stats, projection: computeProjection(daily, stats, settings) };
}

/**
 * 週ごとの部分結果を畳んで `Stats` にする。
 *
 * **全期間を舐める回数を減らすのがここの仕事。**増分で週の計算を減らしても、
 * 合成が毎回 `map` と `filter` を重ねていたら、そこが新しい底になる。
 * 数え上げ（記録日数・朝夜そろった日・完全な週・最長連続）は週の部分結果から出し、
 * 端しか見ない値（現在値・直近の記録率・いまの連続）は端から必要なぶんだけ走る。
 */
function combineStats(
  built: readonly BodyWeek[],
  weeks: readonly WeekPoint[],
  daily: readonly DailyPoint[],
  settings: Settings,
  today: string,
): Stats {
  // 現在値は後ろから最初に見つかったもの。配列を作り直さずに走る
  let currentWeight: number | null = null;
  let currentBodyFat: number | null = null;
  for (let i = daily.length - 1; i >= 0 && (currentWeight == null || currentBodyFat == null); i--) {
    const d = daily[i]!;
    if (currentWeight == null && d.maWeight != null) currentWeight = d.maWeight;
    if (currentBodyFat == null && d.maBodyFat != null) currentBodyFat = d.maBodyFat;
  }

  // 開始値は最初の 7 個の実測。**集まった時点で打ち切る**（全期間を繋がない）
  const startWeight = headAverage(built, (w) => w.headWeights);
  const startBodyFat = headAverage(built, (w) => w.headBodyFats);

  const compose = (w: number | null, bf: number | null) =>
    w != null && bf != null ? { fat: (w * bf) / 100, lean: w - (w * bf) / 100 } : null;
  const now = compose(currentWeight, currentBodyFat);
  const start = compose(startWeight, startBodyFat);

  /*
   * いまの連続記録と直近の記録率は、どちらも後ろの端しか見ない。
   * `daily` は日付順に隙間なく並んでいるので、末尾から数えれば足りる。
   */
  let streak = 0;
  for (let i = daily.length - 1; i >= 0; i--) {
    const d = daily[i]!;
    if (d.date > today) continue;
    // 今日がまだ未記録なら昨日から遡る（朝しか計らない日の途切れを罰しない）
    if (d.date === today && d.slots === 0) continue;
    if (d.slots === 0) break;
    streak++;
  }

  let recentDays = 0;
  let recentRecorded = 0;
  const windowStart = addDays(today, -(RECORD_RATE_DAYS - 1));
  for (let i = daily.length - 1; i >= 0; i--) {
    const d = daily[i]!;
    if (d.date > today) continue;
    if (d.date < windowStart) break;
    recentDays++;
    if (d.slots > 0) recentRecorded++;
  }

  let recordedDays = 0;
  let fullDays = 0;
  for (const w of built) {
    recordedDays += w.recordedDays;
    fullDays += w.fullDays;
  }

  const bmi =
    settings.heightCm && currentWeight ? currentWeight / (settings.heightCm / 100) ** 2 : null;

  return {
    first: daily[0] ?? null,
    latest: daily[daily.length - 1] ?? null,
    currentWeight,
    currentBodyFat,
    currentFatMass: now?.fat ?? null,
    currentLeanMass: now?.lean ?? null,
    startWeight,
    startBodyFat,
    startFatMass: start?.fat ?? null,
    startLeanMass: start?.lean ?? null,
    weightDelta: currentWeight != null && startWeight != null ? currentWeight - startWeight : null,
    bodyFatDelta:
      currentBodyFat != null && startBodyFat != null ? currentBodyFat - startBodyFat : null,
    fatMassDelta: now && start ? now.fat - start.fat : null,
    leanMassDelta: now && start ? now.lean - start.lean : null,
    bmi,
    streak,
    bestStreak: combineStreak(built.map((w) => w.streak)),
    recordRate: recentDays ? recentRecorded / recentDays : 0,
    recordedDays,
    fullDays,
    // 完全な週は体組成の範囲だけを数える（`buildWeeks` の出力と同じ並び）
    perfectWeeks: weeks.filter((w) => w.days === WEEK_DAYS).length,
    totalSpanDays: daily.length,
  };
}

/** 先頭から `MA_WINDOW` 個の実測が集まったところで打ち切って平均する */
function headAverage(
  built: readonly BodyWeek[],
  pick: (week: BodyWeek) => readonly number[],
): number | null {
  const head: number[] = [];
  for (const w of built) {
    for (const v of pick(w)) {
      head.push(v);
      if (head.length >= MA_WINDOW) break;
    }
    if (head.length >= MA_WINDOW) break;
  }
  return head.length ? head.reduce((a, b) => a + b, 0) / head.length : null;
}

/* ------------------------------------------------------------------ *
 * 合成（トレ）
 * ------------------------------------------------------------------ */

function combineTraining(
  built: readonly TrainingWeek[],
  exercises: readonly Exercise[],
): Pick<Derived, 'sessions' | 'weeklySets' | 'trainingStats' | 'checkHistory' | 'trainingGoals'> {
  const sessions = built.flatMap((w) => w.sessions);

  // 週次の配分は「記録のある週の範囲」だけ（`buildWeeklySets` と同じ）
  const first = built.findIndex((w) => w.sessions.length > 0);
  const last = findLastIndex(built, (w) => w.sessions.length > 0);
  const weeklySets: WeekSetCount[] = [];
  for (let i = first; i >= 0 && i <= last; i++) {
    const w = built[i]!;
    weeklySets.push({
      start: w.slice.start,
      label: formatMD(w.slice.start),
      setsByGroup: w.setsByGroup,
      volumeByGroup: w.volumeByGroup,
      totalSets: w.totalSets,
      days: w.days,
    });
  }

  // 種目ごとの履歴は週の順に繋ぐ。並びが変わると `plateau` と開始値の判定が変わる
  const historyById = new Map<string, ExerciseHistoryPoint[]>();
  const lastByGroup = new Map<MuscleGroup, string>();
  const groupSets = new Map<string, GroupSets>();
  const exercisesAt = new Map<string, Exercise[]>();
  const axialAt = new Map<string, Exercise[]>();
  let lastCardio: string | null = null;

  for (const w of built) {
    for (const [id, points] of w.historyById) {
      const found = historyById.get(id);
      if (found) found.push(...points);
      else historyById.set(id, [...points]);
    }
    for (const [group, date] of w.lastByGroup) lastByGroup.set(group, date);
    if (w.lastCardio != null) lastCardio = w.lastCardio;
    for (const [date, sets] of w.groupSets) groupSets.set(date, sets);
    for (const [date, list] of w.exercisesAt) exercisesAt.set(date, list);
    for (const [date, list] of w.axialAt) axialAt.set(date, list);
  }

  return {
    sessions,
    weeklySets,
    trainingStats: computeTrainingStats(sessions, weeklySets, {
      historyById,
      lastByGroup,
      lastCardio,
    }),
    checkHistory: { groupSets, exercisesAt, axialAt },
    /*
     * 目標一覧は表示中の種目だけ。非表示にした種目の目標は消さずに持ったままにして、
     * 表示に戻したときにそのまま復活させる（消すのは「目標を外す」を押したときだけ）。
     */
    trainingGoals: exerciseGoals(
      sessions,
      exercises.filter((e) => !e.hidden),
    ),
  };
}
