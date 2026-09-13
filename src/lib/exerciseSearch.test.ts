import { describe, expect, it } from 'vitest';
import {
  matchRank,
  matchedAlias,
  matchesGroup,
  matchesQuery,
  normalizeName,
} from './exerciseSearch';

/*
 * 種目を名前で探す。**カタログは 113 件あるので、当てに行く経路が要る。**
 *
 * 検索は 6 つの面が同じ関数を通る（記録画面・カタログ・プリセットの中身・
 * 種目の目標・移行の候補・推移の一覧）。ここが変わると 6 面ぶん変わるので、
 * 「どう当たるか」の規則をここに留めておく。
 */
describe('種目を名前で探す', () => {
  /*
   * スマホで「べんち」まで打った時点では、まだひらがなのことがある。
   * そこで 0 件になると、打ち切る前に諦めることになる。
   */
  it('ひらがなでもカタカナの種目に当たる', () => {
    expect(matchesQuery('ベンチプレス', 'べんち')).toBe(true);
    expect(matchesQuery('ダンベルカール', 'だんべる')).toBe(true);
    // 逆向き（カタカナで打ってひらがなの名前）も同じ土俵に乗る
    expect(matchesQuery('けんすい', 'ケンスイ')).toBe(true);
    expect(normalizeName('べんち')).toBe('ベンチ');
  });

  it('英字は大小を無視する。前後の空白も落とす', () => {
    expect(matchesQuery('Bench Press', 'bench')).toBe(true);
    expect(matchesQuery('Bench Press', '  BENCH ')).toBe(true);
  });

  it('空の検索語はすべてに当たる（絞り込んでいない状態）', () => {
    expect(matchesQuery('ベンチプレス', '')).toBe(true);
    expect(matchesQuery('ベンチプレス', '   ')).toBe(true);
    expect(matchRank('ベンチプレス', '')).toBe(0);
  });

  it('当たらないものは当たらない', () => {
    expect(matchesQuery('ベンチプレス', 'スクワット')).toBe(false);
  });

  /*
   * 「ベンチ」と打った人がまず見たいのはベンチプレスで、「ナローベンチプレス」ではない。
   * 同じ近さなら元の並び（部位 → マイ種目の順）のまま。
   */
  it('前方一致を先に出す', () => {
    expect(matchRank('ベンチプレス', 'ベンチ')).toBe(0);
    expect(matchRank('ナローベンチプレス', 'ベンチ')).toBe(1);
    expect(matchRank('ベンチプレス', 'ベンチ')).toBeLessThan(
      matchRank('ナローベンチプレス', 'ベンチ'),
    );
  });

  /*
   * **別名でも拾う。**同じ種目の呼び方は揺れる（チェストサポーテッドロウ /
   * チェストサポートロウ）。片方の綴りしか当たらないと**あるのに無いと思われ**、
   * 同じ種目をもう 1 つ自分で作ることになる。
   */
  it('別名でも当たる（呼び方の揺れを拾う）', () => {
    const aliases = ['チェストサポートロウ', 'マシンロウ'];
    // 名前そのままでは当たらない綴り
    expect(matchesQuery('チェストサポーテッドロウ', 'チェストサポート')).toBe(false);
    expect(matchesQuery('チェストサポーテッドロウ', 'チェストサポート', aliases)).toBe(true);
    expect(matchesQuery('チェストサポーテッドロウ', 'マシンロウ', aliases)).toBe(true);
    // 別名にも無い語は当たらない
    expect(matchesQuery('チェストサポーテッドロウ', 'スクワット', aliases)).toBe(false);
  });

  /*
   * 当たった別名は**打った語に近いほうを出す。**「プッシュダウン」と打ったときに
   * 「トライセプスプッシュダウン」を添えると、打った語が消えて読みにくい。
   */
  it('当たった別名を返す（名前で当たったときは返さない）', () => {
    const aliases = ['トライセプスプッシュダウン', 'プッシュダウン', 'ローププレスダウン'];
    const name = 'トライセプスプレスダウン';

    // 前方一致のある別名を優先する
    expect(matchedAlias(name, 'プッシュダウン', aliases)).toBe('プッシュダウン');
    // 名前に無い語で当たれば、その別名を返す（前方一致が無ければ先頭）
    expect(matchedAlias(name, 'セプスプッシュ', aliases)).toBe('トライセプスプッシュダウン');
    expect(matchedAlias(name, 'ロープ', aliases)).toBe('ローププレスダウン');

    // 名前で当たったなら、札に出す理由が無い
    expect(matchedAlias(name, 'プレスダウン', aliases)).toBeNull();
    expect(matchedAlias(name, '', aliases)).toBeNull();
    // どれにも当たらない
    expect(matchedAlias(name, 'スクワット', aliases)).toBeNull();
    expect(matchedAlias(name, 'プッシュダウン')).toBeNull();
  });

  it('別名の前方一致も「近い」として先に出す', () => {
    const aliases = ['プッシュダウン'];
    expect(matchRank('トライセプスプレスダウン', 'プッシュ', aliases)).toBe(0);
    // 別名を渡さなければ遠い（当たりはするが後ろ）
    expect(matchRank('ナロープッシュアップ', 'プッシュ')).toBe(1);
  });

  /*
   * **主部位だけで見る。**一覧の見出しも主部位で切っているので、補助で拾うと
   * 「腕」で絞ったのに胸の見出しの下にベンチプレスが並ぶ——絞り込みと見出しが食い違う。
   * 補助部位を含めて見たいのは量の話（部位別の配分・回復）で、そちらは係数ぶんで数える。
   */
  it('部位は主部位だけで絞る（補助部位では拾わない）', () => {
    const bench = { group: 'chest' } as const;
    expect(matchesGroup(bench, 'chest')).toBe(true);
    expect(matchesGroup(bench, 'arms')).toBe(false);
    expect(matchesGroup(bench, 'all')).toBe(true);
  });
});
