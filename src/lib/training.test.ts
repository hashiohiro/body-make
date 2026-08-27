import { beforeEach, describe, expect, it } from 'vitest';
import { CATALOG } from './exerciseCatalog';
import {
  buildBodyWeightLookup,
  buildExercisePoint,
  buildSessions,
  effectiveWeight,
  estimateOneRm,
  exerciseBaseline,
  personalBest,
  pickOneRm,
  resolveSets,
  summarizeSets,
} from './training';
import { loadData, sanitizeData, sanitizeWorkouts } from './storage';
import type { DailyPoint, Exercise, SessionExercise, WorkSet } from '../types';

/* ---------------- helpers ---------------- */

function ex(patch: Partial<Exercise> = {}): Exercise {
  return {
    id: 'ex_test',
    name: 'テスト種目',
    group: 'chest',
    subGroups: [],
    loadMode: 'standard',
    repUnit: 'reps',
    bodyweightFactor: null,
    rmDivisor: 30,
    goal: null,
    order: 0,
    ...patch,
  };
}

function sets(...rows: [number | null, number | null][]): WorkSet[] {
  return rows.map(([weight, reps]) => ({ weight, reps }));
}

function entry(sets: WorkSet[], exerciseId = 'ex_test'): SessionExercise {
  return { exerciseId, sets };
}

function day(date: string, weight: number | null, maWeight: number | null = weight): DailyPoint {
  const blank = { weight: null, bodyFat: null };
  return {
    date,
    time: 0,
    am: blank,
    pm: blank,
    weight,
    bodyFat: null,
    maWeight,
    maBodyFat: null,
    slots: weight == null ? 0 : 1,
  };
}

class MemStorage {
  private store = new Map<string, string>();
  get length() {
    return this.store.size;
  }
  clear() {
    this.store.clear();
  }
  getItem(k: string) {
    return this.store.get(k) ?? null;
  }
  key(i: number) {
    return [...this.store.keys()][i] ?? null;
  }
  removeItem(k: string) {
    this.store.delete(k);
  }
  setItem(k: string, v: string) {
    this.store.set(k, String(v));
  }
}

/* ---------------- 有効重量 ---------------- */

describe('有効重量', () => {
  it('片側記録は ×2 する（ダンベル 20kg は 40kg 挙げている）', () => {
    const point = buildExercisePoint(ex({ loadMode: 'perSide' }), entry(sets([20, 10])), null);
    expect(point.sets[0]!.effectiveWeight).toBe(40);
    expect(point.volume).toBe(400);
  });

  it('自重種目は体重 × 係数 + 追加重量', () => {
    const pullup = ex({ loadMode: 'bodyweight', bodyweightFactor: 1 });
    const point = buildExercisePoint(pullup, entry(sets([10, 5])), 70);
    expect(point.sets[0]!.effectiveWeight).toBe(80);
    expect(point.volume).toBe(400);
  });

  it('自重種目は追加重量が空でも成立する（加重なしの懸垂が普通なので）', () => {
    const pullup = ex({ loadMode: 'bodyweight', bodyweightFactor: 1 });
    const point = buildExercisePoint(pullup, entry(sets([null, 10])), 70);
    expect(point.volume).toBe(700);
  });

  it('当日の体重が欠測なら移動平均、それも無ければ直近過去の値を使う', () => {
    const daily = [day('2026-03-01', 70), day('2026-03-02', null, 70.5)];
    const at = buildBodyWeightLookup(daily);
    expect(at('2026-03-02')).toBe(70.5);
    expect(at('2026-03-09')).toBe(70.5); // daily の範囲外は直近過去へ落ちる
    expect(at('2026-02-01')).toBeNull(); // 過去に一度も記録がなければ出さない
  });

  it('体重の記録が一切なければ自重種目は集計から外れる', () => {
    const pullup = ex({ loadMode: 'bodyweight', bodyweightFactor: 1 });
    const point = buildExercisePoint(pullup, entry(sets([null, 10])), null);
    expect(point.volume).toBe(0);
    expect(point.sets[0]!.counted).toBe(false);
  });

  it('体重の一部だけ乗る種目は係数をかける', () => {
    const legRaise = ex({ loadMode: 'bodyweight', bodyweightFactor: 0.5 });
    expect(effectiveWeight(legRaise, { weight: null }, 70)).toBe(35);
  });

  it('秒で数える種目は挙上量に計上しないが、セット数には数える', () => {
    const plank = ex({ repUnit: 'seconds' });
    // 加重プランクでも重量×秒は挙上量にならない
    const point = buildExercisePoint(plank, entry(sets([20, 60])), 70);
    expect(point.volume).toBe(0);
    expect(point.workSets).toBe(1);
    expect(point.oneRm).toBeNull();
  });

  it('external で重量が空のセットは 0 ではなく除外する', () => {
    const point = buildExercisePoint(ex(), entry(sets([null, 10], [60, 10])), null);
    expect(point.volume).toBe(600);
    expect(point.sets[0]!.counted).toBe(false);
  });
});

/* ---------------- 役割の判定 ---------------- */

describe('トップセット', () => {
  it('ランプアップを含む並びでも最大重量のセットが選ばれる', () => {
    const r = resolveSets(
      ex(),
      sets([60, 5], [80, 3], [100, 2], [120, 3], [90, 10], [90, 9]),
      null,
    );
    expect(r.roles).toEqual(['work', 'work', 'work', 'top', 'work', 'work']);
    expect(r.topIndex).toBe(3);
  });

  it('書いたセットはすべて挙上量に数える（ウォームアップという区別を持たない）', () => {
    const point = buildExercisePoint(ex(), entry(sets([60, 5], [100, 5])), null);
    expect(point.workSets).toBe(2);
    expect(point.volume).toBe(300 + 500);
  });

  it('同じ重量が並んだらレップ最大がトップ', () => {
    const r = resolveSets(ex(), sets([60, 10], [60, 10], [60, 11]), null);
    expect(r.topIndex).toBe(2);
    expect(r.roles).toEqual(['work', 'work', 'top']);
  });

  it('重量もレップも同率なら最初がトップ', () => {
    const r = resolveSets(ex(), sets([60, 10], [60, 10]), null);
    expect(r.topIndex).toBe(0);
  });

  it('逆ピラミッドでは最初がトップになる', () => {
    const r = resolveSets(ex(), sets([100, 5], [90, 8], [80, 10]), null);
    expect(r.roles).toEqual(['top', 'work', 'work']);
  });

  it('単一セットならそれがトップ', () => {
    const r = resolveSets(ex(), sets([60, 10]), null);
    expect(r.roles).toEqual(['top']);
  });
});

/* ---------------- 1RM ---------------- */

describe('1RM', () => {
  it('1 レップは実測なので Epley を通さない', () => {
    expect(estimateOneRm(120, 1)).toBe(120);
    const point = buildExercisePoint(ex(), entry(sets([120, 1])), null);
    expect(point.oneRm).toBe(120);
    expect(point.measured).toBe(true);
  });

  it('12 レップまでは Epley（既定の分母 30）', () => {
    expect(estimateOneRm(100, 12)).toBeCloseTo(140, 6);
  });

  it('分母は種目ごとに変えられる（ベンチ 40 / スクワット・デッド 33.3）', () => {
    // 同じ 100kg×10 でも、動員する筋量が大きい種目ほど 1RM は高く見積もる
    expect(estimateOneRm(100, 10, 40)).toBeCloseTo(125, 6);
    expect(estimateOneRm(100, 10, 33.3)).toBeCloseTo(130.03, 2);
    expect(estimateOneRm(100, 10, 30)).toBeCloseTo(133.33, 2);
  });

  it('カタログはベンチ 40、スクワットとデッドリフト 33.3、他は 30', () => {
    const by = (id: string) => CATALOG.find((c) => c.id === id)!.rmDivisor;
    expect(by('ex_bench')).toBe(40);
    expect(by('ex_squat')).toBe(33.3);
    expect(by('ex_deadlift')).toBe(33.3);
    expect(by('ex_incline_bench')).toBe(30);
  });

  it('13 レップ以上は採らない', () => {
    expect(estimateOneRm(100, 13)).toBeNull();
  });

  it('レップが埋まっていないセッションでは 1RM を出さない', () => {
    const point = buildExercisePoint(ex(), entry(sets([60, null])), null);
    expect(point.oneRm).toBeNull();
  });

  it('トップセットから換算するので、ランプアップにもバックオフにも引きずられない', () => {
    const point = buildExercisePoint(ex(), entry(sets([60, 5], [120, 3], [90, 10])), null);
    expect(point.oneRm).toBeCloseTo(132, 6);
    expect(point.measured).toBe(false);
  });

  it('セットを足しても値がぶれない（全セットの最大を採ると上振れする）', () => {
    const few = buildExercisePoint(ex(), entry(sets([100, 5])), null);
    const many = buildExercisePoint(ex(), entry(sets([100, 5], [95, 8], [90, 10])), null);
    // 95×8 は 120.3、90×10 は 120.0 で、いずれも 100×5 の 116.7 を上回る。
    // それでもトップセット基準なので値は変わらない
    expect(many.oneRm).toBeCloseTo(few.oneRm!, 6);
    expect(many.oneRm).toBeCloseTo(100 * (1 + 5 / 30), 6);
  });

  it('トップセットのレップが 12 を超える日は 1RM を出さない', () => {
    const point = buildExercisePoint(ex(), entry(sets([100, 15], [80, 5])), null);
    expect(point.oneRm).toBeNull();
  });
});

/* ---------------- 主指標・開始値・自己最高 ---------------- */

describe('主指標と履歴', () => {
  const compound = ex({ id: 'ex_bench' });
  const isolation = ex({ id: 'ex_raise', loadMode: 'perSide' });

  it('主指標は挙上量。換算できない種目だけ最大回数になる', () => {
    const a = buildExercisePoint(compound, entry(sets([100, 5]), 'ex_bench'), null);
    const b = buildExercisePoint(isolation, entry(sets([10, 15]), 'ex_raise'), null);
    const plank = buildExercisePoint(ex({ repUnit: 'seconds' }), entry(sets([null, 60])), null);
    expect(a.metric).toBe(500);
    expect(b.metric).toBe(20 * 15); // 左右に 1 つずつ → 2 倍
    expect(plank.metric).toBe(60);
  });

  function sessionsOf(rows: [string, number][]) {
    const workouts = Object.fromEntries(
      rows.map(([date, weight]) => [date, [entry(sets([weight, 5]), 'ex_bench')]]),
    );
    return buildSessions(workouts, [compound], []);
  }

  it('3 セッション未満では開始値を出さない', () => {
    const s = sessionsOf([
      ['2026-03-01', 100],
      ['2026-03-04', 102.5],
    ]);
    expect(exerciseBaseline(s, 'ex_bench')).toBeNull();
  });

  it('開始値は最初の 3 セッションの平均（初回 1 点にしない）', () => {
    const s = sessionsOf([
      ['2026-03-01', 90],
      ['2026-03-04', 100],
      ['2026-03-07', 110],
      ['2026-03-10', 200],
    ]);
    // 主指標は挙上量。450 / 500 / 550 の平均
    expect(exerciseBaseline(s, 'ex_bench')).toBe(500);
  });

  it('自己最高はその日までしか見ない（後日入力で未来を参照しない）', () => {
    const s = sessionsOf([
      ['2026-03-01', 100],
      ['2026-03-04', 120],
    ]);
    const k = 1 + 5 / 30;
    expect(personalBest(s, 'ex_bench', '2026-03-01', pickOneRm)).toBeCloseTo(100 * k, 6);
    expect(personalBest(s, 'ex_bench', '2026-03-04', pickOneRm)).toBeCloseTo(120 * k, 6);
  });

  it('セット構成を「60kg×10,10,9」形式にまとめる', () => {
    const point = buildExercisePoint(
      ex(),
      entry(sets([40, 10], [60, 10], [60, 10], [60, 9])),
      null,
    );
    expect(summarizeSets(point)).toBe('40kg×10 / 60kg×10,10,9');
  });
});

/* ---------------- 永続化 ---------------- */

describe('サニタイズと移行', () => {
  it('値域外は null に落ちる', () => {
    const data = sanitizeData({
      exercises: [{ id: 'a', name: 'A' }],
      workouts: {
        '2026-03-01': [
          {
            exerciseId: 'a',
            sets: [
              { weight: 600, reps: 0 },
              { weight: 60, reps: 10.4 },
            ],
          },
        ],
      },
    });
    // 重量 600 / レップ 0 はどちらも値域外 → null に落ちるが、行そのものは残る
    expect(data.workouts['2026-03-01']![0]!.sets).toEqual([
      { weight: null, reps: null },
      { weight: 60, reps: 10 },
    ]);
  });

  it('存在しない種目を指すログは落とす', () => {
    const data = sanitizeData({
      exercises: [{ id: 'a', name: 'A' }],
      workouts: { '2026-03-01': [{ exerciseId: 'ghost', sets: [{ weight: 60, reps: 10 }] }] },
    });
    expect(data.workouts['2026-03-01']).toBeUndefined();
  });

  it('値が空でも種目は残る（読み込みのたびに掃かない）', () => {
    const known = new Set(['a']);
    const out = sanitizeWorkouts(
      { '2026-03-01': [{ exerciseId: 'a', sets: [{ weight: null, reps: null }] }] },
      known,
    );
    expect(out['2026-03-01']).toEqual([{ exerciseId: 'a', sets: [{ weight: null, reps: null }] }]);
  });

  it('セットが 0 本の種目も残る（外すのは種目カードの × だけ）', () => {
    const known = new Set(['a']);
    const out = sanitizeWorkouts({ '2026-03-01': [{ exerciseId: 'a', sets: [] }] }, known);
    expect(out['2026-03-01']).toEqual([{ exerciseId: 'a', sets: [] }]);
  });

  it('同じ種目が 1 日に重複していたらセットを連結する', () => {
    const known = new Set(['a']);
    const out = sanitizeWorkouts(
      {
        '2026-03-01': [
          { exerciseId: 'a', sets: [{ weight: 60, reps: 10 }] },
          { exerciseId: 'a', sets: [{ weight: 60, reps: 8 }] },
        ],
      },
      known,
    );
    expect(out['2026-03-01']).toHaveLength(1);
    expect(out['2026-03-01']![0]!.sets).toHaveLength(2);
  });

  it('v1 データは entries を保ったまま筋トレのキーが補われる', () => {
    const v1 = {
      version: 1,
      settings: { heightCm: 170, theme: 'dark' },
      entries: {
        '2026-03-01': { am: { weight: 70, bodyFat: 20 }, pm: { weight: null, bodyFat: null } },
      },
    };
    const data = sanitizeData(v1);
    expect(data.version).toBe(2);
    expect(data.entries['2026-03-01']!.am.weight).toBe(70);
    expect(data.settings.heightCm).toBe(170);
    expect(data.exercises).toEqual([]);
    expect(data.workouts).toEqual({});
  });

  it('v2 バックアップは筋トレも含めて往復する', () => {
    const original = sanitizeData({
      exercises: [{ id: 'ex_bench', name: 'ベンチプレス', mechanic: 'compound', group: 'chest' }],
      workouts: { '2026-03-01': [{ exerciseId: 'ex_bench', sets: [{ weight: 60, reps: 10 }] }] },
      entries: {
        '2026-03-01': { am: { weight: 70, bodyFat: null }, pm: { weight: null, bodyFat: null } },
      },
    });
    const roundTripped = sanitizeData(JSON.parse(JSON.stringify(original)));
    expect(roundTripped).toEqual(original);
  });
});

describe('loadData の seed 分岐', () => {
  beforeEach(() => {
    (globalThis as { localStorage?: unknown }).localStorage = new MemStorage();
  });

  it('体重が 0 件で未 seed でも、筋トレの記録を落とさない', () => {
    localStorage.setItem(
      'bodymake.data.v1',
      JSON.stringify({
        version: 2,
        settings: {},
        entries: {},
        exercises: [{ id: 'ex_bench', name: 'ベンチプレス' }],
        workouts: { '2026-03-01': [{ exerciseId: 'ex_bench', sets: [{ weight: 60, reps: 10 }] }] },
      }),
    );

    const data = loadData();
    expect(Object.keys(data.entries).length).toBeGreaterThan(0); // seed は入る
    expect(data.exercises).toHaveLength(1); // 筋トレは残る
    expect(data.workouts['2026-03-01']).toBeDefined();
  });
});

describe('カタログ', () => {
  it('ID が重複していない（重複すると過去ログの参照先が曖昧になる）', () => {
    expect(new Set(CATALOG.map((c) => c.id)).size).toBe(CATALOG.length);
  });

  it('6 部位すべてが埋まっている', () => {
    expect(new Set(CATALOG.map((c) => c.group)).size).toBe(6);
  });

  it('サニタイズを通しても ID が変わらない（削除して入れ直しても過去ログが繋がる）', () => {
    const data = sanitizeData({
      exercises: CATALOG.map((c, i) => ({ ...c, goal: null, order: i })),
    });
    expect(data.exercises.map((e) => e.id)).toEqual(CATALOG.map((c) => c.id));
  });
});
