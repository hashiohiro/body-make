import { describe, expect, it } from 'vitest';
import {
  axialStatus,
  buildCheckHistory,
  checkDay,
  describeKey,
  estimateTime,
  groupReadiness,
  requiredDays,
  visibleWarnings,
} from './check';
import { CATALOG, fromCatalog } from './exerciseCatalog';
import { defaultChecks, sanitizeChecks, sanitizeData } from './storage';
import { buildSessions } from './training';
import type { CheckSettings, Exercise, SessionExercise, Workouts } from '../types';

/* ---------------- helpers ---------------- */

function ex(patch: Partial<Exercise> = {}): Exercise {
  return {
    id: patch.id ?? 'ex_test',
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

/** カタログから 1 件引く。既定値そのものを確かめるテストで使う */
function fromCat(id: string): Exercise {
  return fromCatalog(
    CATALOG.find((c) => c.id === id)!,
    0,
  );
}

function entries(...ids: [string, number][]): SessionExercise[] {
  return ids.map(([exerciseId, count]) => ({
    exerciseId,
    sets: Array.from({ length: count }, () => ({ weight: 60, reps: 10 })),
  }));
}

const CHECKS: CheckSettings = defaultChecks();

/* ================================================================== */

describe('カタログの既定値', () => {
  it('軸荷重は背骨に荷重を通す種目だけ（大小は持たない）', () => {
    for (const id of [
      'ex_deadlift',
      'ex_squat',
      'ex_rdl',
      'ex_bb_row',
      'ex_ohp',
      'ex_good_morning',
      'ex_military_press',
    ]) {
      expect(fromCat(id).axial).toBe(true);
    }
    // 背中がパッドやシートで支えられる種目は入らない
    for (const id of [
      'ex_leg_press',
      'ex_hack_squat',
      'ex_leg_extension',
      'ex_bench',
      // 胸をパッドに預けるので前傾の保持が要らない
      'ex_chest_supported_row',
    ]) {
      expect(fromCat(id).axial).toBe(false);
    }
  });

  it('器具を選べる種目は、バーベル版とダンベル版で同じ', () => {
    const entry = CATALOG.find((c) => c.id === 'ex_ohp')!;
    expect(fromCatalog(entry, 0, 'barbell').axial).toBe(true);
    expect(fromCatalog(entry, 0, 'dumbbell').axial).toBe(true);
  });

  it('1セットの時間は高重量コンパウンドだけ上書きされ、他は null', () => {
    expect(fromCat('ex_deadlift').minutesPerSet).toBe(4.5);
    expect(fromCat('ex_calf_raise').minutesPerSet).toBeNull();
  });
});

describe('時間の見積もり', () => {
  it('セット数に比例し、種目の上書きが無ければ既定値に落ちる', () => {
    const dead = ex({ id: 'a', name: 'デッドリフト', minutesPerSet: 4.5 });
    const calf = ex({ id: 'b', name: 'カーフレイズ' }); // null → 既定 3 分
    const { total, items } = estimateTime(
      [
        { exercise: dead, sets: 3 },
        { exercise: calf, sets: 5 },
      ],
      CHECKS,
    );
    expect(items[0]!.minutes).toBe(13.5);
    expect(items[1]!.minutes).toBe(15);
    expect(total).toBe(28.5);
  });

  it('回復コストの低い種目でも、セット数を増やせば時間だけが伸びる', () => {
    const calf = ex({ name: 'カーフレイズ' });
    expect(estimateTime([{ exercise: calf, sets: 5 }], CHECKS).total).toBe(15);
    expect(estimateTime([{ exercise: calf, sets: 8 }], CHECKS).total).toBe(24);
  });
});

describe('軸荷重（W2）', () => {
  const dead = ex({ id: 'dead', name: 'デッドリフト', axial: true, minutesPerSet: 4.5 });
  const squat = ex({ id: 'squat', name: 'スクワット', axial: true, minutesPerSet: 4.5 });
  const bench = ex({ id: 'bench', name: 'ベンチプレス' });
  const exercises = [dead, squat, bench];

  const history = (workouts: Workouts) =>
    buildCheckHistory(buildSessions(workouts, exercises, []), exercises);

  it('いつ置いたかだけを返す（疲労の量は持たない）', () => {
    const h = history({
      '2026-03-02': entries(['dead', 3]),
      '2026-03-05': entries(['squat', 3]),
    });
    // 週は日曜〜土曜。2026-03-01 が日曜
    const a = axialStatus(h, '2026-03-06');
    expect(a.since).toBe(1);
    expect(a.names).toEqual(['スクワット']);
    expect(a.daysInWeek).toBe(2);
    // どの週を数えたかを返す。「今週」だと過去の日を開いたときに現在週と読める
    expect(a.weekStart).toBe('2026-03-01');
  });

  it('記録が無ければ null', () => {
    expect(axialStatus(history({}), '2026-03-06').since).toBeNull();
  });

  it('連日になったら知らせる', () => {
    const past: Workouts = { '2026-03-09': entries(['dead', 3]) };
    const w = checkDay(
      { date: '2026-03-10', entries: entries(['squat', 3]) },
      exercises,
      history(past),
      CHECKS,
    );
    const axial = w.filter((x) => x.rule === 'axial');
    expect(axial).toHaveLength(1);
    expect(axial[0]!.detail).toContain('デッドリフト');
    expect(axial[0]!.detail).toContain('スクワット');
    expect(axial[0]!.key).toBe('axial|d:2026-03-10');
  });

  it('中1日空いていれば出ない', () => {
    const past: Workouts = { '2026-03-08': entries(['dead', 3]) };
    const w = checkDay(
      { date: '2026-03-10', entries: entries(['squat', 3]) },
      exercises,
      history(past),
      CHECKS,
    );
    expect(w.filter((x) => x.rule === 'axial')).toEqual([]);
  });

  it('軸荷重でない種目なら連日でも出ない', () => {
    const past: Workouts = { '2026-03-09': entries(['dead', 3]) };
    const w = checkDay(
      { date: '2026-03-10', entries: entries(['bench', 3]) },
      exercises,
      history(past),
      CHECKS,
    );
    expect(w.filter((x) => x.rule === 'axial')).toEqual([]);
  });

  it('過去の日は「やった事実」だけを数える（並べただけの日は数えない）', () => {
    const laidOut: Workouts = {
      '2026-03-09': [{ exerciseId: 'dead', sets: [{ weight: null, reps: null }] }],
    };
    const w = checkDay(
      { date: '2026-03-10', entries: entries(['squat', 3]) },
      exercises,
      history(laidOut),
      CHECKS,
    );
    expect(w.filter((x) => x.rule === 'axial')).toEqual([]);
  });
});

describe('部位の空き（今日やってよいか）', () => {
  /** ベンチは胸1・肩0.5・腕0.5（カタログの既定） */
  const bench = fromCat('ex_bench');
  const exercises = [bench];

  const history = (workouts: Workouts) =>
    buildCheckHistory(buildSessions(workouts, exercises, []), exercises);

  /*
   * **回復は主部位のセット数だけで数える。**種目ごとの記入は要らないままだが、
   * 補助部位は入れない。週の配分（buildWeeklySets）は係数込みで数えるので、
   * ここだけ数え方が違う——疲労と配分は別の話だから（lib/check.ts）。
   */
  it('主部位のセット数だけを使う（補助は入れない）', () => {
    const h = history({ '2026-03-01': entries([bench.id, 4]) });
    const sets = h.groupSets.get('2026-03-01')!;
    expect(sets.chest).toBe(4);
    // ベンチの肩と腕は補助。実際に働いてはいるが、直接やった疲労と同じには数えない
    expect(sets.shoulders).toBe(0);
    expect(sets.arms).toBe(0);
    expect(sets.back).toBe(0);
  });

  /*
   * 補助でしか入っていない部位は、翌日やってよい。
   * ベンチの翌日にショルダープレスを止めない（実データでもそう動いている）。
   */
  it('補助でしか入っていない部位は空けない', () => {
    const h = history({ '2026-03-01': entries([bench.id, 12]) });
    expect(groupReadiness(h, '2026-03-02').chest.daysLeft).toBe(2);
    expect(groupReadiness(h, '2026-03-02').shoulders.daysLeft).toBe(0);
    expect(groupReadiness(h, '2026-03-02').arms.daysLeft).toBe(0);
  });

  it('空ける日数はセッションの大きさで決まり、3日を超えない', () => {
    expect(requiredDays(4)).toBe(1);
    expect(requiredDays(6)).toBe(2);
    expect(requiredDays(10)).toBe(2);
    expect(requiredDays(11)).toBe(3);
    // 回復の窓は 24〜72 時間。それ以上は空けても進まない
    expect(requiredDays(30)).toBe(3);
    expect(requiredDays(100)).toBe(3);
    expect(requiredDays(0)).toBe(0);
  });

  it('経過日数ぶん減り、0 になったら今日やれる', () => {
    // 8 セット → 中1日（2日あける）
    const h = history({ '2026-03-01': entries([bench.id, 8]) });
    expect(groupReadiness(h, '2026-03-02').chest.daysLeft).toBe(1);
    expect(groupReadiness(h, '2026-03-03').chest.daysLeft).toBe(0);
    expect(groupReadiness(h, '2026-03-10').chest.daysLeft).toBe(0);
  });

  it('現実離れした日数を出さない（16セットでも あと2日 まで）', () => {
    // 16 セット → 3日あける。昨日やっていれば残りは 2 日
    const h = history({ '2026-03-01': entries([bench.id, 16]) });
    expect(groupReadiness(h, '2026-03-02').chest.daysLeft).toBe(2);
    expect(groupReadiness(h, '2026-03-04').chest.daysLeft).toBe(0);
  });

  it('積み上げない。週次ボリュームが多くても発散しない', () => {
    const workouts: Workouts = {};
    for (let d = 1; d <= 28; d++) {
      workouts[`2026-03-${String(d).padStart(2, '0')}`] = entries([bench.id, 10]);
    }
    const h = history(workouts);
    // 毎日足し込む式なら数十日ぶんに積み上がるが、1 セッションぶんが上限
    expect(groupReadiness(h, '2026-03-29').chest.daysLeft).toBeLessThanOrEqual(3);
  });

  it('いちばん効いているセッションを採る（小さい直近より大きい過去）', () => {
    const h = history({
      '2026-03-01': entries([bench.id, 16]), // 3日前 16セット → 3 − 3 = 0
      '2026-03-02': entries([bench.id, 12]), // 2日前 12セット → 3 − 2 = 1
      '2026-03-03': entries([bench.id, 2]), // 前日 2セット → 1 − 1 = 0
    });
    const chest = groupReadiness(h, '2026-03-04').chest;
    expect(chest.daysLeft).toBe(1);
    expect(chest.since).toBe(2);
  });

  it('その日の分は入らない（種目を足す前の状態を見るため）', () => {
    const h = history({ '2026-03-02': entries([bench.id, 16]) });
    expect(groupReadiness(h, '2026-03-02').chest.daysLeft).toBe(0);
  });

  it('やっていない部位は記録なしとして返す', () => {
    const h = history({ '2026-03-01': entries([bench.id, 6]) });
    expect(groupReadiness(h, '2026-03-02').legs).toEqual({ daysLeft: 0, since: null, sets: 0 });
  });
});

describe('checkDay', () => {
  const exercises = [
    ex({ id: 'dead', name: 'デッドリフト', axial: true, minutesPerSet: 4.5 }),
    ex({ id: 'squat', name: 'スクワット', axial: true, minutesPerSet: 4.5 }),
    ex({ id: 'calf', name: 'カーフレイズ' }),
  ];

  const history = (workouts: Workouts) =>
    buildCheckHistory(buildSessions(workouts, exercises, []), exercises);

  it('種目が無い日は何も出さない', () => {
    expect(checkDay({ date: '2026-03-10', entries: [] }, exercises, history({}), CHECKS)).toEqual(
      [],
    );
  });

  it('指摘には「改善するなら」を必ず添える', () => {
    // 指摘を出しておいて消し方を書かないのは、読む側に判定の再現を強いる
    const day = { date: '2026-03-10', entries: entries(['dead', 5], ['squat', 5], ['calf', 8]) };
    const w = checkDay(day, exercises, history({}), { ...CHECKS, sessionMinutes: 60 });
    // 69分 − 60分 = 9分。既定 3 分/セットなので 3 セット相当
    expect(w.find((x) => x.rule === 'time')!.fix).toBe('セットを3つ減らすか、種目を別の日に回す');

    const past: Workouts = { '2026-03-09': entries(['dead', 3]) };
    const axial = checkDay(
      { date: '2026-03-10', entries: entries(['squat', 3]) },
      exercises,
      history(past),
      CHECKS,
    );
    expect(axial.find((x) => x.rule === 'axial')!.fix).toBe('スクワットを別の日に回す');
  });

  it('W1: 上限を超えたら出る。上限が null なら出ない', () => {
    const day = { date: '2026-03-10', entries: entries(['dead', 5], ['squat', 5], ['calf', 8]) };
    // 5×4.5 + 5×4.5 + 8×3 = 69
    const w = checkDay(day, exercises, history({}), { ...CHECKS, sessionMinutes: 60 });
    expect(w.filter((x) => x.rule === 'time')[0]!.detail).toContain('69分 / 上限 60分');
    expect(
      checkDay(day, exercises, history({}), { ...CHECKS, sessionMinutes: null }).filter(
        (x) => x.rule === 'time',
      ),
    ).toEqual([]);
  });

  it('値を打つ前でも検算できる（空のセット行も設計として数える）', () => {
    const blank: SessionExercise[] = [
      {
        exerciseId: 'dead',
        sets: [
          { weight: null, reps: null },
          { weight: null, reps: null },
        ],
      },
    ];
    const w = checkDay({ date: '2026-03-10', entries: blank }, exercises, history({}), {
      ...CHECKS,
      sessionMinutes: 5,
    });
    expect(w.find((x) => x.rule === 'time')!.detail).toContain('9分');
  });
});

describe('許容済み', () => {
  it('キーが一致した警告だけ消える', () => {
    const warnings = [
      { rule: 'axial' as const, message: '', detail: '', fix: '', key: 'a' },
      { rule: 'time' as const, message: '', detail: '', fix: '', key: 'b' },
    ];
    expect(visibleWarnings(warnings, ['a']).map((w) => w.key)).toEqual(['b']);
    expect(visibleWarnings(warnings, [])).toHaveLength(2);
  });

  it('キーから何を消したかを読み戻せる', () => {
    const exercises = [ex({ id: 'dead', name: 'デッドリフト' })];
    expect(describeKey('axial|d:2026-03-10', exercises)).toBe('軸荷重種目の連日 — 3/10');
    expect(describeKey('time|d:2026-03-10', exercises)).toBe('セッションの長さ — 3/10');
  });

  it('消した種目を指すキーも読める（解除できなくならない）', () => {
    expect(describeKey('axial|e:gone', [])).toContain('削除された種目');
  });
});

describe('サニタイズ', () => {
  it('欠損と値域外は既定値に落ちる（判定が黙って止まらない）', () => {
    const c = sanitizeChecks({ minutesPerSet: 999 });
    expect(c.minutesPerSet).toBe(3);
    // 既定は無効。負荷値を入れ終わるまで判定は当たらない
    expect(c.enabled).toBe(false);
  });

  it('sessionMinutes の null は「時間を見ない」として残す', () => {
    expect(sanitizeChecks({ sessionMinutes: null }).sessionMinutes).toBeNull();
    expect(sanitizeChecks({}).sessionMinutes).toBe(90);
    expect(sanitizeChecks({ sessionMinutes: 3 }).sessionMinutes).toBe(90);
  });

  it('種目の性質は真偽値で読み、値域外の時間は null に潰す', () => {
    const data = sanitizeData({
      exercises: [{ id: 'a', name: 'A', axial: 'yes', minutesPerSet: 999 }],
    });
    // 真偽値以外は false（'yes' を通すと、壊れた値が有効な設定になる）
    expect(data.exercises[0]!.axial).toBe(false);
    expect(data.exercises[0]!.minutesPerSet).toBeNull();
  });

  it('v2 以前の種目は、カタログから既定値を引き直して移行する', () => {
    const data = sanitizeData({
      exercises: [
        { id: 'ex_deadlift', name: 'デッドリフト', group: 'back' },
        { id: 'ex_ohp_db', name: 'ショルダープレス（ダンベル）', group: 'shoulders' },
        { id: 'self-made', name: '自作', group: 'chest' },
      ],
    });
    expect(data.exercises[0]!.axial).toBe(true);
    expect(data.exercises[0]!.minutesPerSet).toBe(4.5);
    // 器具の接尾辞を落として引く
    expect(data.exercises[1]!.axial).toBe(true);
    // カタログに無い自作種目は false のまま
    expect(data.exercises[2]!.axial).toBe(false);
  });

  it('版が古ければ、値を持っていてもカタログから引き直す', () => {
    /*
     * 途中のビルドが `axial: false` を書き戻したデータ。
     * キーの有無で判定していたころは「本人が false を選んだ」と誤って尊重し、
     * 二度と戻らなくなっていた（`loads: 0` のときと同じ罠）。
     */
    const data = sanitizeData({
      version: 3,
      exercises: [
        {
          id: 'ex_deadlift',
          name: 'デッドリフト',
          group: 'back',
          axial: false,
          minutesPerSet: null,
        },
      ],
    });
    expect(data.exercises[0]!.axial).toBe(true);
    expect(data.exercises[0]!.minutesPerSet).toBe(4.5);
  });

  it('ひとつ前の形（loads を持ち axial を持たない）も移行する', () => {
    const data = sanitizeData({
      version: 3,
      exercises: [
        {
          id: 'ex_deadlift',
          name: 'デッドリフト',
          group: 'back',
          loads: { lowBack: 10 },
          minutesPerSet: 4.5,
        },
      ],
    });
    expect(data.exercises[0]!.axial).toBe(true);
  });

  it('いまの版の false は選択として尊重する（移行が上書きしない）', () => {
    const data = sanitizeData({
      version: 4,
      exercises: [{ id: 'ex_deadlift', name: 'デッドリフト', group: 'back', axial: false }],
    });
    expect(data.exercises[0]!.axial).toBe(false);
  });

  it('いまの版のバックアップはレビューの値ごと往復する', () => {
    const original = sanitizeData({
      version: 4,
      exercises: [{ id: 'ex_bench', name: 'ベンチプレス', group: 'chest', axial: true }],
      checks: { sessionMinutes: 75 },
      suppressed: ['time|d:2026-03-10', 'time|d:2026-03-10'],
    });
    expect(original.suppressed).toEqual(['time|d:2026-03-10']);
    expect(sanitizeData(JSON.parse(JSON.stringify(original)))).toEqual(original);
  });
});
