import type { Exercise, ExerciseGroup } from '../types';

/*
 * 種目を探す・絞るための照合。**画面を持たない純粋な関数だけ。**
 *
 * 以前は `components/training/ExerciseFilterBar.tsx` に、絞り込みの行（部品）と
 * 同居していた。部品のほうは `GroupChips` に吸収されたので、残った関数をここへ移した。
 */

/** 絞り込みを出すしきい値。これ以下なら一覧のまま見渡せる */
export const FILTER_THRESHOLD = 8;

/**
 * 比べるための正規化。**ひらがなをカタカナに寄せる。**
 *
 * 種目名はほとんどカタカナで、スマホで「べんち」まで打った時点では
 * まだひらがなのことがある。そこで 0 件になると、打ち切る前に諦めることになる。
 * 英字は大小を無視する（ローマ字入力の途中で拾えるように）。
 */
export function normalizeName(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[ぁ-ゖ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60));
}

/** 空の検索語はすべてに当たる（絞り込んでいない状態） */
export function matchesQuery(name: string, query: string): boolean {
  const q = normalizeName(query);
  return q === '' || normalizeName(name).includes(q);
}

/**
 * 検索語に対する近さ。**小さいほど前。**
 *
 * 前方一致を先に出す。「ベンチ」と打った人がまず見たいのはベンチプレスで、
 * 「ナローベンチプレス」ではない。同じ近さなら元の並び（部位 → マイ種目の順）のまま。
 */
export function matchRank(name: string, query: string): number {
  const q = normalizeName(query);
  const n = normalizeName(name);
  if (q === '') return 0;
  return n.startsWith(q) ? 0 : 1;
}

/**
 * 部位で絞る。**主部位だけで見る。**
 *
 * 一度は補助部位でも拾っていた（「腕」でベンチプレスが出るのは、実際に腕を使うから）。
 * ただしそれはマイ種目の一覧だけで、記録画面・カタログ・移行先・グラフは主部位だけ
 * だった。同じチップを押したのに面によって出るものが違うことになる。
 *
 * 主部位に寄せた。**一覧の見出しも主部位で切っている**ので、
 * 補助で拾うと「腕」で絞ったのに胸の見出しの下にベンチプレスが並ぶ——
 * 絞り込みと見出しが食い違う。
 * 補助部位を含めて見たいのは量の話（部位別の配分・回復）で、そちらは係数ぶんで数える。
 */
export function matchesGroup(
  exercise: Pick<Exercise, 'group'>,
  group: ExerciseGroup | 'all',
): boolean {
  return group === 'all' || exercise.group === group;
}
