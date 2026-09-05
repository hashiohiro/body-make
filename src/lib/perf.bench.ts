import { bench, describe } from 'vitest';
import { buildDaily, buildWeeks, computeProjection, computeStats } from './derive';
import { buildCheckHistory } from './check';
import { CATALOG, fromCatalog } from './exerciseCatalog';
import { addDays } from './date';
import { emptyData } from './storage';
import { buildSessions, buildWeeklySets, computeTrainingStats, exerciseGoals } from './training';
import { createDeriveCache, deriveAll } from './incremental';
import { startOfWeek, todayISO } from './date';
import type { AppData, Entries, Workouts } from '../types';

/*
 * 入力 1 回ぶんの重さを測る。
 *
 * **測る対象は保存ではなく導出。** 値を 1 つ打つと `AppData` の同一性が変わり、
 * `useBodyData` の memo が作り直される。そこで走る計算がそのまま入力の体感になる。
 * 保存（structuredClone）も並べてあるが、実測では導出のほうが 2〜3 倍重い。
 *
 * 数字はこの機械での相対値。実機のスマホは数倍遅いので、**絶対値ではなく
 * 変更の前後で比べるためのもの**として使う。
 */

/** 週 3 回・1 回 5 種目 × 4 セット。作者の実際の付け方に寄せた密度 */
const SESSIONS_PER_WEEK = [1, 3, 5];
const EXERCISES_PER_SESSION = 5;
const SETS_PER_EXERCISE = 4;

/** 生成は決定的にする。走るたびに中身が変わると、前後の比較にならない */
function makeData(years: number): AppData {
  const days = Math.round(365 * years);
  const start = addDays('2026-09-05', -days);
  const entries: Entries = {};
  const workouts: Workouts = {};
  const exercises = CATALOG.slice(0, 26).map((c, i) => fromCatalog(c, i));
  const lifting = exercises.filter((e) => e.group !== 'cardio');

  for (let i = 0; i < days; i++) {
    const iso = addDays(start, i);
    const weight = 70 + Math.sin(i / 30) * 2;
    entries[iso] = {
      am: { weight: Math.round(weight * 10) / 10, bodyFat: 20 },
      pm: { weight: Math.round((weight + 0.4) * 10) / 10, bodyFat: 20.4 },
    };
    if (!SESSIONS_PER_WEEK.includes(i % 7)) continue;
    workouts[iso] = Array.from({ length: EXERCISES_PER_SESSION }, (_, k) => {
      const exercise = lifting[(i + k) % lifting.length]!;
      return {
        exerciseId: exercise.id,
        sets: Array.from({ length: SETS_PER_EXERCISE }, () => ({ weight: 60, reps: 8 })),
      };
    });
  }
  return { ...emptyData(), entries, exercises, workouts };
}

interface Fixture {
  data: AppData;
  daily: ReturnType<typeof buildDaily>;
  weeks: ReturnType<typeof buildWeeks>;
  sessions: ReturnType<typeof buildSessions>;
}

/** 直近 1 週ぶんの生データを切り出す。保存で実際に変換される単位 */
function weekOf(data: AppData): { entries: Entries; workouts: Workouts } {
  const start = startOfWeek(todayISO());
  const entries: Entries = {};
  const workouts: Workouts = {};
  for (let i = 0; i < 7; i++) {
    const iso = addDays(start, i);
    const entry = data.entries[iso];
    if (entry) entries[iso] = entry;
    const day = data.workouts[iso];
    if (day) workouts[iso] = day;
  }
  return { entries, workouts };
}

function fixture(years: number): Fixture {
  const data = makeData(years);
  const daily = buildDaily(data.entries);
  const weeks = buildWeeks(daily);
  return { data, daily, weeks, sessions: buildSessions(data.workouts, data.exercises, daily) };
}

/** 打ち替えに使う空の夜スロット。毎回作ると測っているものがぶれる */
const EMPTY_PM = { weight: null, bodyFat: null };
const today = todayISO();
let tick = 0;

/** 体組成側の導出（全計算）。体重を打つと必ず走る */
function deriveBodyFull({ data, daily, weeks }: Fixture) {
  const d = buildDaily(data.entries);
  const w = buildWeeks(d);
  const stats = computeStats(d, w, data.settings);
  computeProjection(d, stats, data.settings);
  return [daily, weeks];
}

/**
 * 筋トレ側の導出。セットを打つと走る（いまは体重を打っても走る＝下の「体重入力」）。
 *
 * 週次の配分は `useBodyData` で 1 回だけ作って共有するので、ここでも 1 回にする。
 * 2 回作っていた頃を測ると、実際より悪い数字が出る。
 */
function deriveTraining({ data, daily, sessions }: Fixture) {
  const s = buildSessions(data.workouts, data.exercises, daily);
  const weekly = s.length > 0 ? buildWeeklySets(s, s[0]!.date) : [];
  computeTrainingStats(s, weekly);
  buildCheckHistory(s, data.exercises);
  exerciseGoals(s, data.exercises);
  return sessions;
}

for (const years of [1, 5, 10]) {
  describe(`${years}年ぶん`, () => {
    const f = fixture(years);
    const cache = createDeriveCache();
    deriveAll(f.data, cache);
    // 1 週ぶんの生データ。保存で実際に変換される単位
    const oneWeek = weekOf(f.data);

    /*
     * いまはこれが 1 打鍵ぶん。`buildSessions` が `daily` に依存しているので、
     * 体重を打つだけで筋トレ側の集計まで走り直す。
     * ここが「トレ入力」と同じ水準まで下がれば、依存を切った効果が出たことになる。
     */
    bench('体重入力（体組成 + トレの両方が走る）', () => {
      deriveBodyFull(f);
      deriveTraining(f);
    });

    bench('トレ入力（トレ側のみ）', () => {
      deriveTraining(f);
    });

    bench('体組成のみ（全計算）', () => {
      deriveBodyFull(f);
    });

    /*
     * 増分の経路。直近の日を打ち替えながら測る。
     * 変わらない週は作り直さないので、全計算との差がそのまま増分の効き。
     * **体組成もトレも、この 1 回に入っている**（実際のアプリと同じ経路）。
     */
    bench('体重入力（増分・体組成 + トレ）', () => {
      const entries = { ...f.data.entries };
      entries[today] = { am: { weight: 70 + (tick++ % 50) / 100, bodyFat: 20 }, pm: EMPTY_PM };
      deriveAll({ ...f.data, entries }, cache);
    });

    /*
     * 保存の側。IndexedDB の put はこの変換をメインスレッドで同期に行う。
     * 週ごとのレコードに割ったので、実際に変換されるのは**変わった週だけ**。
     * 全体を割らずに書いていた頃との差を並べて出す。
     */
    bench('保存: 全体を書く（週に割る前）', () => {
      structuredClone(f.data);
    });

    bench('保存: 変わった週だけ書く', () => {
      structuredClone(oneWeek);
    });
  });
}
