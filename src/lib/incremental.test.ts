import { beforeEach, describe, expect, it } from 'vitest';
import { buildDaily, buildWeeks, computeProjection, computeStats } from './derive';
import { createDeriveCache, deriveAll } from './incremental';
import { computeBadgeFacts } from './badgeFacts';
import { buildCheckHistory } from './check';
import { CATALOG, fromCatalog } from './exerciseCatalog';
import { buildSessions, buildWeeklySets, computeTrainingStats, exerciseGoals } from './training';
import { emptyData } from './storage';
import { addDays, todayISO } from './date';
import type { AppData, Entries, Settings, Workouts } from '../types';
import { makeT } from './i18n';

const t = makeT('ja');

/**
 * 増分の経路と、定義である純関数の経路が、同じ答えを返すことを固定する。
 *
 * **導出値を保存しない代わりの安全網。**増分は「変わっていないものを作り直さない」
 * 仕組みなので、依存を 1 つ書き漏らすと古い値が残る。それを人の注意ではなく
 * テストで捕まえる（`docs/design-storage.md` §5）。
 */

const SETTINGS: Settings = {
  heightCm: 172,
  targetWeight: 68,
  targetBodyFat: 15,
  targetDate: null,
  theme: 'system',
  locale: 'system',
  waistEnabled: true,
  inputWeightUnit: 'kg' as const,
  displayWeightUnit: 'kg' as const,
};

/** 決定的な擬似乱数。落ちたときに同じ並びで再現できるようにする */
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function entriesOf(days: number, seed: number, gapRate = 0.2): Entries {
  const rand = rng(seed);
  const start = addDays(todayISO(), -(days - 1));
  const out: Entries = {};
  for (let i = 0; i < days; i++) {
    if (rand() < gapRate) continue; // 欠測日を混ぜる
    const iso = addDays(start, i);
    const w = 70 + Math.sin(i / 9) * 1.5;
    /*
     * 腹囲は体重よりまばらに入れる（補足の値なので毎日は測らない）。
     * **体重を入れない日にも入れる**——腹囲だけの日は増分と全計算で
     * 扱いが割れやすい場所なので、ここで通しておく。
     */
    const waist = rand() < 0.6 ? null : Math.round((82 + Math.sin(i / 11) * 2) * 10) / 10;
    if (rand() < 0.08) {
      out[iso] = {
        am: { weight: null, bodyFat: null, waist: waist ?? 81 },
        pm: { weight: null, bodyFat: null, waist: null },
      };
      continue;
    }
    out[iso] = {
      am: { weight: Math.round(w * 10) / 10, bodyFat: rand() < 0.15 ? null : 20, waist },
      // 夜だけ・朝だけの日も作る
      pm:
        rand() < 0.3
          ? { weight: null, bodyFat: null, waist: null }
          : { weight: Math.round((w + 0.5) * 10) / 10, bodyFat: 20.5, waist: null },
    };
  }
  return out;
}

/*
 * 生成データの種目。**一部に目標を付けておく。**
 *
 * 目標は記録の有無に依らない値（種目に付いている）なのに、生成データの種目に
 * 1 つも目標が無かったため、**記録が 0 件のとき目標が落ちる不具合を
 * 一致テストが素通ししていた**。以後どの一致テストでも目標の導出を通す。
 */
const EXERCISES = CATALOG.slice(0, 12).map((c, i) => {
  const exercise = fromCatalog(c, i);
  if (i % 4 === 0) return { ...exercise, goal: { type: 'weight' as const, value: 100 + i } };
  if (i % 4 === 1) return { ...exercise, goal: { type: 'maintain' as const, value: null } };
  return exercise;
});

/** 週 3 回・1 回 3 種目 × 3 セット。自重種目も混ぜて体重への依存を通す */
function workoutsOf(days: number, seed: number): Workouts {
  const rand = rng(seed);
  const start = addDays(todayISO(), -(days - 1));
  const out: Workouts = {};
  for (let i = 0; i < days; i++) {
    if (rand() > 0.45) continue;
    const iso = addDays(start, i);
    out[iso] = [0, 1, 2].map((k) => {
      const exercise = EXERCISES[(i + k) % EXERCISES.length]!;
      return {
        exerciseId: exercise.id,
        sets: [0, 1, 2].map(() => ({
          weight: 40 + Math.round(rand() * 20),
          reps: 5 + Math.round(rand() * 5),
        })),
      };
    });
  }
  return out;
}

function dataOf(entries: Entries, workouts: Workouts = {}): AppData {
  return { ...emptyData(), settings: SETTINGS, entries, exercises: EXERCISES, workouts };
}

/** 定義側（全計算）の答え */
function full(data: AppData) {
  const daily = buildDaily(data.entries);
  const weeks = buildWeeks(daily);
  const stats = computeStats(daily, weeks, data.settings);
  const sessions = buildSessions(data.workouts, data.exercises, daily);
  const weeklySets = sessions.length > 0 ? buildWeeklySets(sessions, sessions[0]!.date) : [];
  return {
    daily,
    weeks,
    stats,
    projection: computeProjection(daily, stats, data.settings),
    sessions,
    weeklySets,
    trainingStats: computeTrainingStats(sessions, weeklySets),
    checkHistory: buildCheckHistory(sessions, data.exercises),
    trainingGoals: exerciseGoals(
      t,
      sessions,
      data.exercises.filter((e) => e.shelf === 'listed'),
    ),
    badgeFacts: computeBadgeFacts(daily, sessions),
  };
}

/** 増分の答え。キャッシュを渡さなければ毎回まっさらから */
function inc(data: AppData, cache = createDeriveCache()) {
  return deriveAll(t, data, cache);
}

describe('増分と全計算の一致', () => {
  it('記録が無いとき', () => {
    expect(inc(dataOf({}))).toEqual(full(dataOf({})));
  });

  it('1 日だけ', () => {
    const entries = entriesOf(1, 1, 0);
    const workouts = workoutsOf(1, 1);
    const data = dataOf(entries, workouts);
    expect(inc(data)).toEqual(full(data));
  });

  for (const days of [7, 30, 200, 800]) {
    it(`${days}日ぶん（欠測・片側記録を含む）`, () => {
      const entries = entriesOf(days, days, 0.2);
      const data = dataOf(entries, workoutsOf(days, days));
      expect(inc(data)).toEqual(full(data));
    });
  }

  it('全期間が欠測でも壊れない', () => {
    const entries = entriesOf(60, 7, 0.95);
    const workouts = workoutsOf(60, 7);
    const data = dataOf(entries, workouts);
    expect(inc(data)).toEqual(full(data));
  });
});

describe('編集を重ねても一致し続ける', () => {
  /*
   * ここが本番。キャッシュを使い回したまま編集を続けて、
   * 「変わったのに作り直されない」が起きないことを見る。
   */
  it('直近の日を打ち続けても、毎回 全計算と同じ', () => {
    const cache = createDeriveCache();
    const entries = entriesOf(400, 3, 0.15);
    const workouts = workoutsOf(400, 3);
    const today = todayISO();

    for (let n = 0; n < 20; n++) {
      entries[today] = {
        am: { weight: 70 + n / 10, bodyFat: 20, waist: null },
        pm: { weight: null, bodyFat: null, waist: null },
      };
      expect(deriveAll(t, dataOf(entries, workouts), cache)).toEqual(
        full(dataOf(entries, workouts)),
      );
    }
  });

  it('過去の日を遡って直しても一致する（後日入力）', () => {
    const cache = createDeriveCache();
    const entries = entriesOf(400, 5, 0.15);
    const workouts = workoutsOf(400, 5);
    deriveAll(t, dataOf(entries, workouts), cache);

    // 週をまたいで散らばった日を直す。移動平均は跨ぐので後ろの週も変わる
    for (const back of [3, 40, 111, 250, 399, 8]) {
      const iso = addDays(todayISO(), -back);
      entries[iso] = {
        am: { weight: 65, bodyFat: 18, waist: null },
        pm: { weight: 66, bodyFat: 19, waist: null },
      };
      expect(deriveAll(t, dataOf(entries, workouts), cache)).toEqual(
        full(dataOf(entries, workouts)),
      );
    }
  });

  it('日を消しても一致する', () => {
    const cache = createDeriveCache();
    const entries = entriesOf(300, 11, 0.1);
    const workouts = workoutsOf(300, 11);
    deriveAll(t, dataOf(entries, workouts), cache);

    for (const back of [0, 1, 2, 150, 299]) {
      delete entries[addDays(todayISO(), -back)];
      expect(deriveAll(t, dataOf(entries, workouts), cache)).toEqual(
        full(dataOf(entries, workouts)),
      );
    }
  });

  it('すべて消してから入れ直しても、古い週が残らない', () => {
    const cache = createDeriveCache();
    const entries = entriesOf(200, 13, 0.1);
    const workouts = workoutsOf(200, 13);
    deriveAll(t, dataOf(entries, workouts), cache);

    for (const key of Object.keys(entries)) delete entries[key];
    expect(deriveAll(t, dataOf(entries, workouts), cache)).toEqual(full(dataOf(entries, workouts)));

    const fresh = entriesOf(30, 17, 0.1);
    for (const [k, v] of Object.entries(fresh)) entries[k] = v;
    expect(deriveAll(t, dataOf(entries, workouts), cache)).toEqual(full(dataOf(entries, workouts)));
  });
});

describe('作り直す範囲', () => {
  beforeEach(() => undefined);

  /*
   * 増分になっている証拠。直近の日を打ったとき、前の週のオブジェクトが
   * 作り直されていないことを参照で確かめる。
   */
  it('直近の日を打っても、前の週は作り直されない', () => {
    const cache = createDeriveCache();
    const entries = entriesOf(300, 19, 0.1);
    const workouts = workoutsOf(300, 19);
    deriveAll(t, dataOf(entries, workouts), cache);

    const before = [...cache.bodyWeeks.values()];
    const kept = before.slice(0, -1);

    entries[todayISO()] = {
      am: { weight: 71.2, bodyFat: 21, waist: null },
      pm: { weight: null, bodyFat: null, waist: null },
    };
    deriveAll(t, dataOf(entries, workouts), cache);

    const after = [...cache.bodyWeeks.values()];
    for (let i = 0; i < kept.length; i++) expect(after[i]).toBe(kept[i]);
    // 最後の週だけは別のオブジェクトになる
    expect(after[after.length - 1]).not.toBe(before[before.length - 1]);
  });

  it('古い週を直すと、そこから後ろだけが作り直される', () => {
    const cache = createDeriveCache();
    const entries = entriesOf(300, 23, 0.1);
    const workouts = workoutsOf(300, 23);
    deriveAll(t, dataOf(entries, workouts), cache);
    const before = [...cache.bodyWeeks.values()];

    // 真ん中あたりの日を直す
    entries[addDays(todayISO(), -150)] = {
      am: { weight: 60, bodyFat: 15, waist: null },
      pm: { weight: null, bodyFat: null, waist: null },
    };
    deriveAll(t, dataOf(entries, workouts), cache);
    const after = [...cache.bodyWeeks.values()];

    const changed = after.findIndex((w, i) => w !== before[i]);
    expect(changed).toBeGreaterThan(0);
    // 手前は使い回されている
    for (let i = 0; i < changed; i++) expect(after[i]).toBe(before[i]);
  });
});

describe('トレの作り直す範囲', () => {
  it('セットを打っても、前の週は作り直されない', () => {
    const cache = createDeriveCache();
    const entries = entriesOf(300, 31, 0.1);
    const workouts = workoutsOf(300, 31);
    deriveAll(t, dataOf(entries, workouts), cache);
    const before = [...cache.trainingWeeks.values()];

    workouts[todayISO()] = [{ exerciseId: EXERCISES[0]!.id, sets: [{ weight: 80, reps: 5 }] }];
    const after = deriveAll(t, dataOf(entries, workouts), cache);

    const now = [...cache.trainingWeeks.values()];
    for (let i = 0; i < before.length - 1; i++) expect(now[i]).toBe(before[i]);
    expect(after).toEqual(full(dataOf(entries, workouts)));
  });

  /*
   * 種目の設定を変えると、過去の集計もすべて変わる（補助部位の係数・1RM の分母）。
   * **全週が作り直されること**を確かめる。ここが漏れると古い値が残る。
   */
  it('種目の設定を変えると、全週が作り直される', () => {
    const cache = createDeriveCache();
    const entries = entriesOf(200, 37, 0.1);
    const workouts = workoutsOf(200, 37);
    deriveAll(t, dataOf(entries, workouts), cache);
    const before = [...cache.trainingWeeks.values()];

    const changed = EXERCISES.map((e, i) =>
      i === 0 ? { ...e, subGroups: [{ group: 'core' as const, weight: 1 }] } : e,
    );
    const data: AppData = { ...dataOf(entries, workouts), exercises: changed };
    const after = deriveAll(t, data, cache);

    const now = [...cache.trainingWeeks.values()];
    for (let i = 0; i < before.length; i++) expect(now[i]).not.toBe(before[i]);
    expect(after).toEqual(full(data));
  });

  it('体重を遡って直すと、自重換算を通じてトレ側も一致し続ける', () => {
    const cache = createDeriveCache();
    const entries = entriesOf(300, 41, 0.1);
    const workouts = workoutsOf(300, 41);
    deriveAll(t, dataOf(entries, workouts), cache);

    for (const back of [5, 90, 220]) {
      entries[addDays(todayISO(), -back)] = {
        am: { weight: 55, bodyFat: 12, waist: null },
        pm: { weight: null, bodyFat: null, waist: null },
      };
      expect(deriveAll(t, dataOf(entries, workouts), cache)).toEqual(
        full(dataOf(entries, workouts)),
      );
    }
  });

  it('体重が 1 件も無くても、トレだけで成り立つ', () => {
    const workouts = workoutsOf(120, 43);
    const data = dataOf({}, workouts);
    expect(inc(data)).toEqual(full(data));
  });
});

/**
 * 腹囲は**体重に添える補足**で、記録の単位ではない（`types.ts` の `Measurement.waist`）。
 * ここが崩れると、腹囲を測っただけの日で連続記録とカレンダーの印が伸びる。
 */
describe('腹囲は記録として数えない', () => {
  const ago = (n: number) => addDays(todayISO(), -n);

  /** 3日前・2日前は体重、昨日は腹囲だけ、今日は体重 */
  const MIXED: Entries = {
    [ago(3)]: {
      am: { weight: 70, bodyFat: 20, waist: 82 },
      pm: { weight: null, bodyFat: null, waist: null },
    },
    [ago(2)]: {
      am: { weight: 69.8, bodyFat: 20, waist: null },
      pm: { weight: null, bodyFat: null, waist: null },
    },
    [ago(1)]: {
      am: { weight: null, bodyFat: null, waist: 81 },
      pm: { weight: null, bodyFat: null, waist: null },
    },
    [todayISO()]: {
      am: { weight: 69.5, bodyFat: 19.8, waist: 80.5 },
      pm: { weight: null, bodyFat: null, waist: null },
    },
  };

  it('腹囲だけの日は連続記録を繋がない', () => {
    const { stats } = inc(dataOf(MIXED));
    // 今日は体重を入れているが、昨日は腹囲だけ。連続は今日の 1 日で切れる
    expect(stats.streak).toBe(1);
    expect(stats.recordedDays).toBe(3);
  });

  it('腹囲だけの日も推移には出る（値は落とさない）', () => {
    const { daily } = inc(dataOf(MIXED));
    const yesterday = daily.find((d) => d.date === ago(1));
    expect(yesterday?.waist).toBe(81);
    // 記録としては数えないので slots は 0 のまま
    expect(yesterday?.slots).toBe(0);
  });

  it('体重より先に腹囲だけの日があっても、増分と全計算が一致する', () => {
    const data = dataOf(MIXED);
    expect(inc(data)).toEqual(full(data));
  });

  /*
   * 開始値は最初の 7 個の実測の平均（`baseline`）なので、
   * それより短い記録では現在値と開き切らない。30 日ぶんで見る。
   */
  it('腹囲の開始比が出る', () => {
    const entries: Entries = {};
    for (let i = 29; i >= 0; i--) {
      entries[ago(i)] = {
        am: { weight: 70, bodyFat: 20, waist: 85 - (29 - i) * 0.1 },
        pm: { weight: null, bodyFat: null, waist: null },
      };
    }
    const data = dataOf(entries);
    const { stats } = inc(data);

    // 85.0 から 0.1cm/日 で細くなる。開始（最初の 7 日の平均）より現在は小さい
    expect(stats.startWaist).toBeCloseTo(85 - 0.3, 10);
    expect(stats.currentWaist).toBeCloseTo(85 - 2.6, 10);
    expect(stats.waistDelta).toBeCloseTo(-2.3, 10);
    // 体重は動かしていないので、そちらの開始比は 0
    expect(stats.weightDelta).toBe(0);
    expect(inc(data)).toEqual(full(data));
  });
});

/**
 * **目標は記録の有無に依らない。**種目に付いている値なので、記録が 1 件も
 * 無くても決めてある目標はそのまま出す。
 *
 * 記録が 0 件のときの早道（`deriveAll` の早期リターン）に空の配列を渡していて、
 * **記録を始める前に決めた目標が画面から消えていた**。増分と全計算の一致テストは
 * 通っていた——生成データの種目に目標が 1 つも付いていなかったため。
 */
describe('記録が無くても目標は残る', () => {
  /** この describe だけは種目を自前で組む（共有の EXERCISES は目標付きが混ざる） */
  const only = (goal: unknown, shelf: 'listed' | 'adhoc' = 'listed') => {
    const base = fromCatalog(CATALOG[0]!, 0);
    return { ...dataOf({}), exercises: [{ ...base, shelf, goal }] } as AppData;
  };

  it('記録が 1 件も無くても、決めた目標が出る', () => {
    const { trainingGoals } = inc(only({ type: 'weight', value: 100 }));
    expect(trainingGoals).toHaveLength(1);
    expect(trainingGoals[0]!.target).toBe(100);
    // 記録が無いので、いまの値と到達率は出しようがない
    expect(trainingGoals[0]!.current).toBeNull();
  });

  it('記録が無いときも、増分と全計算が一致する', () => {
    const data = only({ type: 'weight', value: 100 });
    expect(inc(data)).toEqual(full(data));
  });

  /** 伏せた種目・マイ種目に入れていない種目は、これまでどおり目標に出さない */
  it('マイ種目に無い種目の目標は出さない', () => {
    const data = only({ type: 'weight', value: 100 }, 'adhoc');
    expect(inc(data).trainingGoals).toHaveLength(0);
    expect(inc(data)).toEqual(full(data));
  });
});
