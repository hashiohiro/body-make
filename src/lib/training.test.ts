import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CATALOG, GROUP_ORDER } from './exerciseCatalog';
import {
  buildBodyWeightLookup,
  buildExercisePoint,
  buildSessions,
  buildWeeklySets,
  computeTrainingStats,
  effectiveWeight,
  estimateOneRm,
  exerciseBaseline,
  personalBest,
  pickOneRm,
  resolveSets,
  summarizeSets,
} from './training';
import { DATA_VERSION, sanitizeData, sanitizeWorkouts } from './storage';
import type {
  CardioSet,
  DailyPoint,
  Exercise,
  SessionExercise,
  SessionSet,
  WorkSet,
} from '../types';

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
    hidden: false,
    repeated: true,
    axial: false,
    minutesPerSet: null,
    ...patch,
  };
}

function sets(...rows: [number | null, number | null][]): WorkSet[] {
  return rows.map(([weight, reps]) => ({ weight, reps }));
}

function entry(sets: SessionSet[], exerciseId = 'ex_test'): SessionExercise {
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
    const known = new Map([['a', { cardio: false, repUnit: 'reps' as const }]]);
    const out = sanitizeWorkouts(
      { '2026-03-01': [{ exerciseId: 'a', sets: [{ weight: null, reps: null }] }] },
      known,
    );
    expect(out['2026-03-01']).toEqual([{ exerciseId: 'a', sets: [{ weight: null, reps: null }] }]);
  });

  it('セットが 0 本の種目も残る（外すのは種目カードの × だけ）', () => {
    const known = new Map([['a', { cardio: false, repUnit: 'reps' as const }]]);
    const out = sanitizeWorkouts({ '2026-03-01': [{ exerciseId: 'a', sets: [] }] }, known);
    expect(out['2026-03-01']).toEqual([{ exerciseId: 'a', sets: [] }]);
  });

  it('同じ種目が 1 日に重複していたらセットを連結する', () => {
    const known = new Map([['a', { cardio: false, repUnit: 'reps' as const }]]);
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
    // 版は定数から引く。上げるたびにテストを書き換えるのは、上げ忘れの検出にならない
    expect(data.version).toBe(DATA_VERSION);
    expect(data.entries['2026-03-01']!.am.weight).toBe(70);
    expect(data.settings.heightCm).toBe(170);
    expect(data.exercises).toEqual([]);
    expect(data.workouts).toEqual({});
    // v3 で足したキーも既定値で埋まる（欠けたまま state に入ると判定が黙って止まる）
    expect(data.checks.enabled).toBe(false);
    expect(data.suppressed).toEqual([]);
  });

  it('非表示は既定で false。持っているデータは値をそのまま保つ', () => {
    // 非表示を持たなかった頃のデータは、そのまま表示でよい（既定値を書き戻すだけ）
    const old = sanitizeData({
      exercises: [{ id: 'ex_bench', name: 'ベンチプレス', group: 'chest' }],
    });
    expect(old.exercises[0]!.hidden).toBe(false);

    const hidden = sanitizeData({
      version: 5,
      exercises: [{ id: 'ex_bench', name: 'ベンチプレス', group: 'chest', hidden: true }],
      workouts: { '2026-03-01': [{ exerciseId: 'ex_bench', sets: [{ weight: 60, reps: 10 }] }] },
    });
    expect(hidden.exercises[0]!.hidden).toBe(true);
    // 非表示にしても記録は落とさない。落とすのは削除だけ
    expect(hidden.workouts['2026-03-01']).toHaveLength(1);
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

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('デモ向けビルドでなければ投入しない', async () => {
    const { loadData: load } = await import('./storage');
    expect(Object.keys(load().entries)).toHaveLength(0);
  });

  it('保存済みがあれば、読み込みでは上書きしない（戻すのは確認を通ってから）', async () => {
    // IS_DEMO はモジュールの読み込み時に決まるので、差し替えてから読み直す
    vi.stubEnv('VITE_DEMO', '1');
    vi.resetModules();
    const { loadData: load } = await import('./storage');

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

    /*
     * デモは開くたびに初期データへ戻すが、戻すのは断り書き（DemoNotice）を通ってから。
     * 読み込みの時点で消すと、触った内容が理由の分からないまま消えたように見える。
     */
    const data = load();
    expect(Object.keys(data.entries)).toHaveLength(0);
    expect(data.exercises).toHaveLength(1);
    expect(data.workouts['2026-03-01']).toBeDefined();
  });

  it('demoSeed はデモ向けビルドでなければ null（本番のバンドルから落とすため）', async () => {
    const { demoSeed } = await import('./storage');
    expect(demoSeed()).toBeNull();
  });

  it('demoSeed は何度呼んでも同じ初期データを返す（開き直すたびに同じ画面になる）', async () => {
    vi.stubEnv('VITE_DEMO', '1');
    vi.resetModules();
    const { demoSeed } = await import('./storage');

    const first = demoSeed();
    expect(first).not.toBeNull();
    expect(Object.keys(first!.workouts).length).toBeGreaterThan(0);
    expect(demoSeed()).toEqual(first);
  });

  it('まっさらな端末には、体組成も筋トレも入れる', async () => {
    vi.stubEnv('VITE_DEMO', '1');
    vi.resetModules();
    const { loadData: load } = await import('./storage');

    const data = load();
    expect(Object.keys(data.entries).length).toBeGreaterThan(0);
    expect(data.exercises.length).toBeGreaterThan(0);
    expect(Object.keys(data.workouts).length).toBeGreaterThan(0);
    expect(data.presets.length).toBeGreaterThan(0);
    // 配色は訪問者の環境に従わせる
    expect(data.settings.theme).toBe('system');
  });
});

describe('デモの今日', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('デモ向けビルドでなければ実際の今日を返す', async () => {
    vi.resetModules();
    const { todayISO, toISO } = await import('./date');
    expect(todayISO()).toBe(toISO(new Date()));
  });

  it('デモ向けビルドでは固定した日を返す', async () => {
    vi.stubEnv('VITE_DEMO', '1');
    vi.resetModules();
    const { todayISO, DEMO_TODAY } = await import('./date');
    expect(todayISO()).toBe(DEMO_TODAY);
  });

  it('固定した日は初期データの最終記録日で、その週にトレーニングが入っている', async () => {
    vi.stubEnv('VITE_DEMO', '1');
    vi.resetModules();
    (globalThis as { localStorage?: unknown }).localStorage = new MemStorage();
    const { DEMO_TODAY, startOfWeek } = await import('./date');
    const { demoSeed } = await import('./storage');

    const seed = demoSeed();
    expect(seed).not.toBeNull();

    /*
     * 固定日より先の記録があると、まだ来ていない日の記録が画面に出る。
     * 逆に週が空だと、今週のセット数が全部位 0 のまま動かない。
     * どちらもデモとして成り立たないので、日付を動かしたらここで落ちる。
     */
    const dates = [...Object.keys(seed!.entries), ...Object.keys(seed!.workouts)];
    expect(dates.every((d) => d <= DEMO_TODAY)).toBe(true);
    expect(dates).toContain(DEMO_TODAY);

    const week = startOfWeek(DEMO_TODAY);
    const inWeek = Object.keys(seed!.workouts).filter((d) => startOfWeek(d) === week);
    expect(inWeek.length).toBeGreaterThan(0);
  });
});

describe('有酸素', () => {
  const run = ex({ id: 'ex_running', name: 'ランニング', group: 'cardio' });
  const rope = ex({ id: 'ex_jump_rope', name: '縄跳び', group: 'cardio' });
  const bench = ex({ id: 'ex_bench', name: 'ベンチプレス', group: 'chest' });

  /** 有酸素の 1 本。距離(m) と 時間(秒) */
  function bouts(...rows: [number | null, number | null][]): CardioSet[] {
    return rows.map(([meters, seconds]) => ({ meters, seconds }));
  }

  it('距離と時間から速度を出す（合計 ÷ 合計）', () => {
    // 5000m を 1800秒。166.7 m/分
    const p = buildExercisePoint(run, entry(bouts([5000, 1800]), 'ex_running'), null);
    // 距離は入力欄と同じ m のまま。km に直すのは速度を出すときだけ
    expect(p.meters).toBe(5000);
    expect(p.minutes).toBe(30);
    expect(p.speed).toBe(166.7);
    // 量の指標は合計距離。挙上量は出さない
    expect(p.metric).toBe(5000);
    expect(p.volume).toBe(0);
    expect(p.oneRm).toBeNull();
  });

  it('プールの 25m も 90 秒も、丸められずに入る', () => {
    /*
     * 相乗りしていた頃は距離が重量の欄で小数第 1 位に丸められ、
     * 0.025km が 0 になっていた。m と 秒の整数で持てば起きない
     */
    const p = buildExercisePoint(run, entry(bouts([25, 90]), 'ex_running'), null);
    expect(p.meters).toBe(25);
    expect(p.minutes).toBe(1.5);
    expect(p.speed).toBe(16.7);
  });

  it('インターバルは合計で数える（セットごとの速度を平均しない）', () => {
    /*
     * 400m×300秒 と 1600m×480秒。
     * セットごとの速度を平均すると (80 + 200) / 2 = 140 になるが、
     * 実際に動いた量は 2000m / 13分 = 153.8 m/分。短い 1 本が同じ重みで効いてはいけない
     */
    const p = buildExercisePoint(run, entry(bouts([400, 300], [1600, 480]), 'ex_running'), null);
    expect(p.meters).toBe(2000);
    expect(p.minutes).toBe(13);
    expect(p.speed).toBe(153.8);
  });

  it('距離を打たない種目は時間だけで扱い、速度を出さない', () => {
    const p = buildExercisePoint(rope, entry(bouts([null, 1200]), 'ex_jump_rope'), null);
    expect(p.meters).toBeNull();
    expect(p.speed).toBeNull();
    // 主指標は時間に落ちる（推測で距離を埋めない）
    expect(p.metric).toBe(20);
  });

  it('部位別セット数に入らない（有酸素は部位ではない）', () => {
    const sessions = buildSessions(
      {
        '2026-03-02': [entry(bouts([5000, 1800]), 'ex_running'), entry(sets([60, 10]), 'ex_bench')],
      },
      [run, bench],
      [],
    );
    const week = buildWeeklySets(sessions, '2026-03-01')[0]!;
    expect(week.setsByGroup.chest).toBe(1);
    // 脚にも体幹にもどこにも入らない
    expect(GROUP_ORDER.reduce((sum, g) => sum + week.setsByGroup[g], 0)).toBe(1);
  });

  it('実施日数には数える（走った日はトレーニングした日）', () => {
    const sessions = buildSessions(
      { '2026-03-02': [entry(bouts([5000, 1800]), 'ex_running')] },
      [run],
      [],
    );
    expect(sessions).toHaveLength(1);
    expect(computeTrainingStats(sessions).sessions).toBe(1);
  });

  it('まとめは合計で書く（セットの並びを出さない）', () => {
    const p = buildExercisePoint(run, entry(bouts([5000, 1800]), 'ex_running'), null);
    expect(summarizeSets(p)).toBe('5000m / 30分 / 166.7m/分');
    const r = buildExercisePoint(rope, entry(bouts([null, 1200]), 'ex_jump_rope'), null);
    expect(summarizeSets(r)).toBe('20分');
  });

  it('保存も m と 秒のまま往復する（120 分のライドが消えない）', () => {
    const data = sanitizeData({
      version: DATA_VERSION,
      exercises: [{ id: 'ex_cycling', name: 'サイクリング', group: 'cardio' }],
      workouts: {
        '2026-03-01': [{ exerciseId: 'ex_cycling', sets: [{ meters: 40000, seconds: 7200 }] }],
      },
    });
    expect(data.workouts['2026-03-01']![0]!.sets).toEqual([{ meters: 40000, seconds: 7200 }]);
  });

  it('相乗りしていた頃の形（km と 分）は m と 秒に読み替える', () => {
    const data = sanitizeData({
      version: 5,
      exercises: [{ id: 'ex_running', name: 'ランニング', group: 'cardio' }],
      workouts: { '2026-03-01': [{ exerciseId: 'ex_running', sets: [{ weight: 5.2, reps: 30 }] }] },
    });
    expect(data.workouts['2026-03-01']![0]!.sets).toEqual([{ meters: 5200, seconds: 1800 }]);
  });
});

describe('カタログ', () => {
  it('ID が重複していない（重複すると過去ログの参照先が曖昧になる）', () => {
    expect(new Set(CATALOG.map((c) => c.id)).size).toBe(CATALOG.length);
  });

  it('6 部位すべてが埋まっていて、有酸素もある', () => {
    const groups = new Set(CATALOG.map((c) => c.group));
    for (const g of GROUP_ORDER) expect(groups.has(g)).toBe(true);
    expect(groups.has('cardio')).toBe(true);
  });

  it('水中は泳法で分ける（速度の物差しが違うものを 1 つにまとめない）', () => {
    const names = CATALOG.filter((c) => c.group === 'cardio').map((c) => c.name);
    // 「水泳」で引くと泳法がぜんぶ出る（検索は名前で照合する）
    expect(names.filter((n) => n.includes('水泳')).length).toBeGreaterThan(1);
    // 歩くのは泳ぐのとは別。歩き方のバリエーションはここに畳む
    expect(names).toContain('水中ウォーキング');
    // 自転車も同じ基準。屋外の実距離と、機種が推定するエアロバイクの距離は別物
    expect(names.filter((n) => n.includes('サイクリング')).length).toBe(2);
    expect(names.some((n) => n.includes('横歩き') || n.includes('後ろ歩き'))).toBe(false);
  });

  it('有酸素は部位も単位も持たない', () => {
    const cardio = CATALOG.filter((c) => c.group === 'cardio');
    expect(cardio.length).toBeGreaterThan(0);
    for (const entry of cardio) {
      // セットは CardioSet（m と 秒）なので、回でも秒でも数えない
      expect(entry.repUnit).toBeUndefined();
      // 補助部位を持たせない。持たせると部位別セット数に流れ込む
      expect(entry.subGroups ?? []).toEqual([]);
    }
  });

  it('サニタイズを通しても ID が変わらない（削除して入れ直しても過去ログが繋がる）', () => {
    const data = sanitizeData({
      exercises: CATALOG.map((c, i) => ({ ...c, goal: null, order: i })),
    });
    expect(data.exercises.map((e) => e.id)).toEqual(CATALOG.map((c) => c.id));
  });
});
