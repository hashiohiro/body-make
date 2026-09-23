import { describe, expect, it } from 'vitest';
import {
  WEEKDAYS,
  draftGroupSets,
  emptyDraft,
  recoveryRows,
  suggestSetsPerDay,
  weekLoad,
} from './weekPlan';
import { CATALOG, fromCatalog } from './exerciseCatalog';
import { RECOVERY_RULE } from './check';
import type { GroupGoals, MuscleGroup, Preset, Weekday } from '../types';

const ex = (id: string, order = 0) =>
  fromCatalog(
    CATALOG.find((c) => c.id === id)!,
    order,
  );
const bench = ex('ex_bench');
const squat = ex('ex_squat', 1);
const EXERCISES = [bench, squat];

const goals = (partial: Partial<GroupGoals>): GroupGoals => ({
  chest: null,
  back: null,
  legs: null,
  shoulders: null,
  arms: null,
  core: null,
  ...partial,
});

/** その日にその種目を n セット置いた下書き */
function draftOf(entries: [Weekday, string, number][]) {
  const draft = emptyDraft();
  for (const [day, id, sets] of entries) draft[day].items.push({ exerciseId: id, sets });
  return draft;
}

/**
 * セット数の提案は **本人が決めた週の目標を、置いた日数で割るだけ**。
 * こちらで標準値を発明しない。
 */
describe('セット数の提案', () => {
  it('週の目標を置いた日数で割る', () => {
    expect(suggestSetsPerDay(goals({ chest: { type: 'sets', value: 12 } }), 'chest', 2)).toBe(6);
  });

  it('割り切れなければ切り上げる（足りないより多いほうが目標に届く）', () => {
    expect(suggestSetsPerDay(goals({ chest: { type: 'sets', value: 13 } }), 'chest', 2)).toBe(7);
  });

  it('目標を決めていない部位は提案しない', () => {
    expect(suggestSetsPerDay(goals({}), 'chest', 2)).toBeNull();
  });

  /** 挙上量で立てた目標からはセット数を出せない（別の軸） */
  it('挙上量の目標からは出さない', () => {
    expect(
      suggestSetsPerDay(goals({ chest: { type: 'volume', value: 20000 } }), 'chest', 2),
    ).toBeNull();
  });

  it('置いた日が 0 なら出さない', () => {
    expect(suggestSetsPerDay(goals({ chest: { type: 'sets', value: 12 } }), 'chest', 0)).toBeNull();
  });
});

/**
 * 数え方は記録側とまったく同じ（主部位は 1 セット、補助部位は係数ぶん）。
 * 別の数え方にすると、組んだときの数字と記録したときの数字が合わなくなる。
 */
describe('週の部位別セット数', () => {
  it('主部位に足す', () => {
    const totals = draftGroupSets(draftOf([[1, bench.id, 4]]), EXERCISES);
    expect(totals.chest).toBe(4);
  });

  it('補助部位は係数ぶん', () => {
    const totals = draftGroupSets(draftOf([[1, bench.id, 4]]), EXERCISES);
    // ベンチプレスの補助部位（肩・腕）は既定 0.5
    for (const sub of bench.subGroups) expect(totals[sub.group]).toBe(4 * sub.weight);
  });

  it('曜日をまたいで足し上げる', () => {
    const totals = draftGroupSets(
      draftOf([
        [1, bench.id, 4],
        [4, bench.id, 3],
      ]),
      EXERCISES,
    );
    expect(totals.chest).toBe(7);
  });

  it('空の下書きは全部 0', () => {
    const totals = draftGroupSets(emptyDraft(), EXERCISES);
    expect(Object.values(totals).every((v) => v === 0)).toBe(true);
  });
});

describe('曜日', () => {
  it('日曜から土曜の 7 つ', () => {
    expect(WEEKDAYS).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });
});

/**
 * 間隔の目安は**閾値そのものから組み立てる**。値を変えても文が古くならない。
 */
describe('間隔の目安の文', () => {
  it('閾値の段ごとに、範囲と中◯日を書く', () => {
    expect(RECOVERY_RULE).toBe('1〜5セットは中0日、6〜10セットは中1日、11セット以上は中2日');
  });
});

/**
 * 回復の帯。**閾値も週の巡回も、警告文とまったく同じところから取る。**
 * 別に数えると図と文が食い違う。
 */
describe('回復の帯', () => {
  const perDay = (rows: Partial<Record<Weekday, Partial<Record<MuscleGroup, number>>>>) =>
    WEEKDAYS.map((day) => ({
      chest: 0,
      back: 0,
      legs: 0,
      shoulders: 0,
      arms: 0,
      core: 0,
      ...rows[day],
    }));

  it('置いていない部位の行は出さない', () => {
    const rows = recoveryRows(perDay({ 1: { chest: 3 } }));
    expect(rows.map((r) => r.group)).toEqual(['chest']);
  });

  /** 空ける日数が 1（＝翌日にやってよい）なら、回復中に塗るマスは無い */
  it('軽い日は、翌日を回復中にしない', () => {
    const rows = recoveryRows(perDay({ 1: { chest: 3 } }));
    expect(rows[0]?.cells[1]).toMatchObject({ sets: 3, recovering: false });
    expect(rows[0]?.cells[2]).toMatchObject({ sets: 0, recovering: false });
  });

  /* 11 セット以上は 3 日空ける＝翌日と翌々日が回復中 */
  it('重い日のあとは、空ける日数ぶん回復中になる', () => {
    const rows = recoveryRows(perDay({ 1: { chest: 12 } }));
    expect(rows[0]?.cells[2]?.recovering).toBe(true);
    expect(rows[0]?.cells[3]?.recovering).toBe(true);
    expect(rows[0]?.cells[4]?.recovering).toBe(false);
  });

  it('回復中に次を置いた日に印を付ける', () => {
    const rows = recoveryRows(perDay({ 1: { chest: 12 }, 2: { chest: 6 } }));
    expect(rows[0]?.cells[2]).toMatchObject({ sets: 6, recovering: true, overlap: true });
    // 置いた日そのものは、印の対象ではない
    expect(rows[0]?.cells[1]?.overlap).toBe(false);
  });

  /** 週は巡回する。金土に置いたものが、日月に置いたのと同じ扱いにならないように */
  it('週をまたいで回復中が続く', () => {
    const rows = recoveryRows(perDay({ 6: { legs: 12 } }));
    expect(rows[0]?.cells[0]?.recovering).toBe(true);
    expect(rows[0]?.cells[1]?.recovering).toBe(true);
  });

  /** 実績の並びは「直近 7 日、右端が今日」。**先はまだ無いので戻さない** */
  it('戻さない並びでは、末尾から先頭へ回り込まない', () => {
    const rows = recoveryRows(perDay({ 6: { legs: 12 } }), { wrap: false });
    expect(rows[0]?.cells[0]?.recovering).toBe(false);
    expect(rows[0]?.cells[1]?.recovering).toBe(false);
  });

  /** 濃淡は部位ごとに正規化する。腕や肩の行が常に薄くならないように */
  it('濃さの基準は部位ごとに持つ', () => {
    const rows = recoveryRows(perDay({ 1: { chest: 12, arms: 3 } }));
    expect(rows.find((r) => r.group === 'chest')?.max).toBe(12);
    expect(rows.find((r) => r.group === 'arms')?.max).toBe(3);
  });
});

/**
 * 週の置きかたを読む。**計画データは持たない**——曜日を持つプリセットだけが出どころ。
 */
describe('週の置きかた', () => {
  const menu = (id: string, days: Weekday[], ids: string[], sets?: number): Preset => ({
    id,
    name: id,
    exerciseIds: ids,
    weekdays: days,
    hidden: false,
    defaults: sets
      ? Object.fromEntries(
          ids.map((x) => [x, Array.from({ length: sets }, () => ({ weight: null, reps: null }))]),
        )
      : {},
  });

  /*
   * 伏せたものは週から降りる。**曜日は持ったまま**なので、表示に戻せば
   * この面へそのまま戻る（`Preset.hidden`）。
   */
  it('伏せた週メニューは週から降りる', () => {
    const menus = [menu('m1', [1], [bench.id], 4)];
    expect(weekLoad(menus, EXERCISES, goals({})).totals.chest).toBe(4);

    const hiddenMenus = [{ ...menus[0]!, hidden: true }];
    const load = weekLoad(hiddenMenus, EXERCISES, goals({}));
    expect(load.totals.chest).toBe(0);
    // 曜日は消していない
    expect(hiddenMenus[0]!.weekdays).toEqual([1]);
  });

  /** 本人が打った数字が勝つ */
  it('既定のセットがあれば、その行数を使う', () => {
    const load = weekLoad([menu('m1', [1], [bench.id], 4)], EXERCISES, goals({}));
    expect(load.perDay[1].chest).toBe(4);
    expect(load.totals.chest).toBe(4);
  });

  /** **既定のセットは必須にしない。**曜日に割り当てれば、目標から割れる */
  it('既定のセットが無ければ、週目標を置いた日数で割る', () => {
    const load = weekLoad(
      [menu('m1', [1, 4], [bench.id])],
      EXERCISES,
      goals({ chest: { type: 'sets', value: 12 } }),
    );
    expect(load.perDay[1].chest).toBe(6);
    expect(load.perDay[4].chest).toBe(6);
    expect(load.totals.chest).toBe(12);
  });

  /** 1 種目 1 セットと仮定すると、置いてあるのに少ししかやらないように見える */
  it('目標も既定のセットも無ければ、数えずに部位を挙げる', () => {
    const load = weekLoad([menu('m1', [1], [bench.id])], EXERCISES, goals({}));
    expect(load.totals.chest).toBe(0);
    expect(load.unknown).toContain('chest');
  });

  it('曜日を持たないものは入れない', () => {
    const load = weekLoad([menu('m1', [], [bench.id], 3)], EXERCISES, goals({}));
    expect(load.totals.chest).toBe(0);
  });

  /** 補助部位も数える。数え方は記録側と同じ（主部位 1・補助は係数ぶん） */
  it('補助部位のぶんも週の数に入る', () => {
    const load = weekLoad([menu('m1', [1], [bench.id], 4)], EXERCISES, goals({}));
    // ベンチは肩・腕が補助（既定 0.5）
    expect(load.totals.shoulders).toBe(2);
    expect(load.totals.arms).toBe(2);
  });
});

/**
 * 実績の帯は今週（日〜土）を出すが、**先週やったぶんの回復は日曜まで続く。**
 * 手前の日も渡して計算し、表示からは落とす。
 */
describe('帯の助走', () => {
  const row = (chest: number) => ({ chest, back: 0, legs: 0, shoulders: 0, arms: 0, core: 0 });

  it('手前の日のぶんが、先頭のマスに回復中として出る', () => {
    // 助走 1 日ぶん（土曜に 12 セット）＋ 今週 7 日
    const days = [row(12), ...Array.from({ length: 7 }, () => row(0))];
    const rows = recoveryRows(days, { wrap: false, skip: 1, all: true });
    const chest = rows.find((r) => r.group === 'chest')!;

    expect(chest.cells).toHaveLength(7);
    // 日曜（表示の先頭）はまだ回復中
    expect(chest.cells[0]).toMatchObject({ sets: 0, recovering: true });
    expect(chest.cells[2]?.recovering).toBe(false);
  });

  it('助走のマスは表示に出さない', () => {
    const days = [row(12), ...Array.from({ length: 7 }, () => row(0))];
    const rows = recoveryRows(days, { wrap: false, skip: 1, all: true });
    const chest = rows.find((r) => r.group === 'chest')!;
    // 12 は助走ぶんなので、見えている範囲の濃さの基準には入れない
    expect(chest.cells.some((c) => c.sets > 0)).toBe(false);
    expect(chest.max).toBe(0);
  });
});
