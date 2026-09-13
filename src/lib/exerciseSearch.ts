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

/**
 * 空の検索語はすべてに当たる（絞り込んでいない状態）。
 *
 * **別名も見る。**同じ種目の呼び方は揺れる（チェストサポーテッドロウ /
 * チェストサポートロウ、トライセプスプレスダウン / プッシュダウン）。
 * 片方の綴りしか当たらないと、**あるのに無いと思われる**——それが
 * いちばん困る（同じ種目をもう 1 つ自分で作ることになる）。
 */
export function matchesQuery(name: string, query: string, aliases?: readonly string[]): boolean {
  const q = normalizeName(query);
  if (q === '') return true;
  if (normalizeName(name).includes(q)) return true;
  return (aliases ?? []).some((alias) => normalizeName(alias).includes(q));
}

/**
 * 当たった別名。**名前で当たったときは null**（札に出す理由がない）。
 *
 * 「プッシュダウン」で探して「トライセプスプレスダウン」が出ると、
 * 一瞬「これは違うのでは」と思う。打った語を行に添えれば、なぜ出たのかが読める。
 * 複数に当たっても**先頭の 1 つだけ**（札を並べると行が伸びる）。
 */
export function matchedAlias(
  name: string,
  query: string,
  aliases?: readonly string[],
): string | null {
  const q = normalizeName(query);
  if (q === '' || normalizeName(name).includes(q)) return null;
  const hits = (aliases ?? []).filter((alias) => normalizeName(alias).includes(q));
  /*
   * **打った語に近いほうを出す。**「プッシュダウン」と打ったときに
   * 「トライセプスプッシュダウン」を添えると、打った語が消えて読みにくい。
   * 前方一致があればそれを採る（打ち始めがその語）。
   */
  return hits.find((alias) => normalizeName(alias).startsWith(q)) ?? hits[0] ?? null;
}

/**
 * 検索語に対する近さ。**小さいほど前。**
 *
 * 前方一致を先に出す。「ベンチ」と打った人がまず見たいのはベンチプレスで、
 * 「ナローベンチプレス」ではない。同じ近さなら元の並び（部位 → マイ種目の順）のまま。
 */
export function matchRank(name: string, query: string, aliases?: readonly string[]): number {
  const q = normalizeName(query);
  if (q === '') return 0;
  if (normalizeName(name).startsWith(q)) return 0;
  // 別名の前方一致も「近い」とみなす（「プッシュダウン」で当てた人の目当てはそれ）
  return (aliases ?? []).some((alias) => normalizeName(alias).startsWith(q)) ? 0 : 1;
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
