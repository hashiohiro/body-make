import { describe, expect, it } from 'vitest';
import { CATALOG, byName, exerciseName, fromCatalog } from './exerciseCatalog';
import { makeT } from './i18n';
import type { Exercise } from '../types';

const ja = makeT('ja');
const en = makeT('en');
const made = (id: string) =>
  fromCatalog(
    CATALOG.find((c) => c.id === id)!,
    0,
  );
const names = (list: readonly Exercise[]) => byName(ja, list).map((e) => e.name);

/*
 * 並びは名前順（`docs/design-training.md` §7.5）。追加順は使う側から見ると
 * 意味を持たない並びで、51 種目あると、あとから足した 1 件がどこにいるか分からない。
 */
describe('種目の並び', () => {
  it('カタカナは五十音順', () => {
    const list = [made('ex_leg_press'), made('ex_hip_adduction'), made('ex_hip_thrust')];
    expect(names(list)).toEqual(['アダクション', 'ヒップスラスト', 'レッグプレス']);
  });

  /*
   * **読みは持たない。**ブラウザの日本語照合は漢字を読みでは並べないので、
   * 漢字の名前は仮名のあとにまとまる。読みを持たせるには自作種目でも
   * 入力してもらうことになり、種目を作るたびに欄が 1 つ増える。
   */
  it('漢字の名前は仮名のあとにまとまる', () => {
    const list = [
      made('ex_lat_pulldown'),
      made('ex_pullup'),
      made('ex_chinup'),
      made('ex_deadlift'),
    ];
    expect(names(list)).toEqual(['デッドリフト', 'ラットプルダウン', '逆手懸垂', '懸垂']);
  });

  it('自作種目も、打った名前でそのまま並ぶ', () => {
    const custom: Exercise = { ...made('ex_squat'), id: 'made-up-id', name: 'あいうえおマシン' };
    expect(names([made('ex_leg_press'), custom])[0]).toBe('あいうえおマシン');
  });

  it('英語では英名のアルファベット順', () => {
    const list = [made('ex_pullup'), made('ex_deadlift')];
    expect(byName(en, list).map((e) => exerciseName(en, e))).toEqual(['Deadlift', 'Pull-Up']);
  });
});
