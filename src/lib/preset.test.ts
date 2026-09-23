import { describe, expect, it } from 'vitest';
import { defaultSetsFor, orderForDate, weekdayChoices, weekdaysLabel } from './preset';
import { makeT } from './i18n';

const t = makeT('ja');
import { sanitizeData } from './storage';
import type { Preset } from '../types';

const preset = (id: string, weekdays: Preset['weekdays']): Preset => ({
  id,
  name: id,
  exerciseIds: ['ex_bench'],
  weekdays,
  hidden: false,
  defaults: {},
});

/**
 * 曜日は **持たないのが既定**。決めた人にだけ効き、決めていない人の並びは変わらない。
 * 効くのは**並べ替えと札**までで、やらなかった日は数えない（`types.ts` の `Preset.weekday`）。
 */
describe('プリセットの曜日', () => {
  it('日曜 = 0 の並び', () => {
    expect(weekdayChoices(t).map((c) => c.label)).toEqual([
      '日',
      '月',
      '火',
      '水',
      '木',
      '金',
      '土',
    ]);
    expect(weekdaysLabel(t, [1])).toBe('月');
    // 複数なら中黒でつなぐ
    expect(weekdaysLabel(t, [1, 4])).toBe('月・木');
    expect(weekdaysLabel(t, [])).toBeNull();
  });

  /* 2026-09-21 は月曜 */
  it('その日の曜日のものを先頭に出す', () => {
    const list = [preset('a', []), preset('b', [3]), preset('c', [1])];
    expect(orderForDate(list, '2026-09-21').map((p) => p.id)).toEqual(['c', 'a', 'b']);
  });

  /** **絞らない。**別の曜日も、曜日を持たないものも、これまでどおり全部出る */
  it('並べ替えるだけで、減らさない', () => {
    const list = [preset('a', []), preset('b', [3]), preset('c', [1])];
    expect(orderForDate(list, '2026-09-21')).toHaveLength(3);
  });

  it('その曜日のものが無ければ、並びは元のまま', () => {
    const list = [preset('a', []), preset('b', [3])];
    expect(orderForDate(list, '2026-09-21').map((p) => p.id)).toEqual(['a', 'b']);
  });

  it('曜日を 1 つも決めていなければ、並びは元のまま', () => {
    const list = [preset('a', []), preset('b', []), preset('c', [])];
    expect(orderForDate(list, '2026-09-21').map((p) => p.id)).toEqual(['a', 'b', 'c']);
  });

  /* 同じ曜日が複数あってもよい。元の並びは保つ */
  it('同じ曜日が複数あっても、その中の並びは変わらない', () => {
    const list = [preset('a', []), preset('b', [1]), preset('c', [1])];
    expect(orderForDate(list, '2026-09-21').map((p) => p.id)).toEqual(['b', 'c', 'a']);
  });
});

describe('曜日の読み込み', () => {
  const load = (raw: Record<string, unknown>) =>
    sanitizeData({
      version: 7,
      exercises: [{ id: 'ex_bench', name: 'ベンチプレス', group: 'chest' }],
      presets: [{ id: 'p1', name: '胸の日', exerciseIds: ['ex_bench'], ...raw }],
    }).presets[0]?.weekdays;

  it('0〜6 を受け取る', () => {
    expect(load({ weekdays: [0, 6] })).toEqual([0, 6]);
  });

  it('範囲外・小数・文字は落として空にする', () => {
    expect(load({ weekdays: [-1, 7, 1.5, 'mon', true, {}] })).toEqual([]);
    // 読める値だけを残す
    expect(load({ weekdays: [1, 99, 4] })).toEqual([1, 4]);
  });

  it('重複は畳み、曜日順にそろえる', () => {
    expect(load({ weekdays: [4, 1, 4] })).toEqual([1, 4]);
  });

  /** 曜日を持たない既存のバックアップがそのまま読めること（版は上げていない） */
  it('曜日を持たないバックアップは null で埋まる', () => {
    const data = sanitizeData({
      version: 7,
      exercises: [{ id: 'ex_bench', name: 'ベンチプレス', group: 'chest' }],
      presets: [{ id: 'p1', name: '胸の日', exerciseIds: ['ex_bench'] }],
    });
    expect(data.presets[0]?.weekdays).toEqual([]);
    expect(data.presets[0]?.exerciseIds).toEqual(['ex_bench']);
  });
});

/**
 * 既定のセットは **薄く出すだけ** の目安で、記録には入らない（`Preset.defaults`）。
 */
describe('既定のセット', () => {
  const load = (presets: unknown) =>
    sanitizeData({
      version: 7,
      exercises: [
        { id: 'ex_bench', name: 'ベンチプレス', group: 'chest' },
        { id: 'ex_run', name: 'ランニング', group: 'cardio' },
      ],
      presets,
    }).presets[0];

  it('種目ごとにセット列を持てる', () => {
    const p = load([
      {
        id: 'p1',
        name: '胸の日',
        exerciseIds: ['ex_bench'],
        defaults: { ex_bench: [{ weight: 100, reps: 5 }] },
      },
    ]);
    expect(p?.defaults.ex_bench).toEqual([{ weight: 100, reps: 5 }]);
  });

  /** 器は種目が決める。有酸素は距離と時間で持つ（ログと同じ `sanitizeSet` を通す） */
  it('有酸素は有酸素の器で持つ', () => {
    const p = load([
      {
        id: 'p1',
        name: '走る日',
        exerciseIds: ['ex_run'],
        defaults: { ex_run: [{ meters: 5000, seconds: 1800 }] },
      },
    ]);
    expect(p?.defaults.ex_run).toEqual([{ meters: 5000, seconds: 1800 }]);
  });

  it('値域の外は落とす', () => {
    const p = load([
      {
        id: 'p1',
        name: '胸の日',
        exerciseIds: ['ex_bench'],
        defaults: { ex_bench: [{ weight: 9999, reps: 5 }] },
      },
    ]);
    expect(p?.defaults.ex_bench).toEqual([{ weight: null, reps: 5 }]);
  });

  it('その組み合わせに入っていない種目の分は捨てる', () => {
    const p = load([
      {
        id: 'p1',
        name: '胸の日',
        exerciseIds: ['ex_bench'],
        defaults: { ex_run: [{ meters: 5000, seconds: 1800 }] },
      },
    ]);
    expect(p?.defaults).toEqual({});
  });

  it('持たないバックアップは空で埋まる', () => {
    const p = load([{ id: 'p1', name: '胸の日', exerciseIds: ['ex_bench'] }]);
    expect(p?.defaults).toEqual({});
  });

  /* 伏せてあるかは後から足した項目。持たないバックアップは「表示」で読む */
  it('伏せてあるかを持たないバックアップは、表示として読む', () => {
    expect(load([{ id: 'p1', name: '胸の日', exerciseIds: ['ex_bench'] }])?.hidden).toBe(false);
    expect(
      load([{ id: 'p1', name: '胸の日', exerciseIds: ['ex_bench'], hidden: true }])?.hidden,
    ).toBe(true);
  });
});

describe('既定のセットの引き当て', () => {
  const withDefaults = (id: string, weekdays: Preset['weekdays'], weight: number): Preset => ({
    id,
    name: id,
    exerciseIds: ['ex_bench'],
    weekdays,
    hidden: false,
    defaults: { ex_bench: [{ weight, reps: 5 }] },
  });

  it('持っていなければ null', () => {
    expect(defaultSetsFor([preset('a', [])], 'ex_bench', '2026-09-21')).toBeNull();
  });

  /* 2026-09-21 は月曜。画面で先に出るものと、目安の出どころをそろえる */
  it('その日の曜日のものを先に見る', () => {
    const list = [withDefaults('a', [], 60), withDefaults('b', [1], 100)];
    expect(defaultSetsFor(list, 'ex_bench', '2026-09-21')).toEqual([{ weight: 100, reps: 5 }]);
  });

  it('曜日が合うものが無ければ、一覧の並び順', () => {
    const list = [withDefaults('a', [], 60), withDefaults('b', [3], 100)];
    expect(defaultSetsFor(list, 'ex_bench', '2026-09-21')).toEqual([{ weight: 60, reps: 5 }]);
  });

  /*
   * 伏せたものは目安も出さない。呼び出せないプリセットの数字が欄に薄く出ると、
   * どこから来た値なのか辿れない。
   */
  it('伏せたプリセットは見ない', () => {
    const hiddenOne = { ...withDefaults('a', [], 60), hidden: true };
    expect(defaultSetsFor([hiddenOne], 'ex_bench', '2026-09-21')).toBeNull();
    // 伏せていないものがあれば、そちらが出る
    expect(
      defaultSetsFor([hiddenOne, withDefaults('b', [], 80)], 'ex_bench', '2026-09-21'),
    ).toEqual([{ weight: 80, reps: 5 }]);
  });
});
