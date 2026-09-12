import { describe, expect, it } from 'vitest';
import { deltaTone, fmt, fmtBytes, fmtDelta, fmtPercent, fmtVolume } from './format';

/*
 * 数の書き方。**これが揃っていないと、同じ値が面によって違う文字で出る。**
 *
 * 実際、符号付きの数を 7 か所で手書きしていて、**うち 5 か所は 0 のときに
 * 「−0.00」と出ていた**（減量期の停滞でペースがちょうど 0 になるのは普通に起きる）。
 * 寄せたので、ここで規則そのものを留めておく。
 */
describe('数の書き方', () => {
  it('値が無ければ「—」。0 は 0 として出す', () => {
    for (const value of [null, undefined, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(fmt(value)).toBe('—');
      expect(fmtDelta(value)).toBe('—');
      expect(fmtVolume(value)).toBe('—');
      expect(fmtPercent(value)).toBe('—');
    }
    expect(fmt(0)).toBe('0.0');
    expect(fmtVolume(0)).toBe('0');
  });

  it('変化なしは「±」。「−0.0」とは書かない', () => {
    expect(fmtDelta(0)).toBe('±0.0');
    expect(fmtDelta(0, 2)).toBe('±0.00');
    expect(fmtDelta(0, 0)).toBe('±0');
    // 桁を落として 0 になる値も「変化なし」として扱う（−0.004 は ±0.00）
    expect(fmtDelta(-0.004, 2)).toBe('±0.00');
    expect(fmtDelta(0.04)).toBe('±0.0');
  });

  it('符号は必ず付ける。マイナスは U+2212', () => {
    expect(fmtDelta(1.25, 2)).toBe('+1.25');
    expect(fmtDelta(-1.25, 2)).toBe('−1.25');
    // 全角の「−」であってハイフンではない（数字と並べたときに高さがそろう）
    expect(fmtDelta(-1)).toContain('−');
  });

  it('挙上量は 3 桁区切りの整数', () => {
    expect(fmtVolume(1234)).toBe('1,234');
    expect(fmtVolume(1234.6)).toBe('1,235');
  });

  /*
   * どちらが良いかは値では決まらない。体重の −1kg は減量なら良く、増量なら悪い。
   * 判定はここが持ち、色に置き換えるのは `TONE_CLASS` の仕事。
   */
  it('良い向きは指標ごとに決める。中立域を持てる', () => {
    // 体重・体脂肪は下がるほど良い
    expect(deltaTone(-1, true)).toBe('good');
    expect(deltaTone(1, true)).toBe('bad');
    // 挙上量は上がるほど良い
    expect(deltaTone(1, false)).toBe('good');
    // 既定の許容（0.05）に収まれば横ばい
    expect(deltaTone(0.05, true)).toBe('flat');
    expect(deltaTone(null, true)).toBe('flat');
    // 除脂肪体重は「維持が良い」ので中立域を広く取れる
    expect(deltaTone(-0.4, false, 0.5)).toBe('flat');
  });

  /*
   * KB から始める。B で出すと、記録が増えても桁がなかなか動かない
   * （体組成 1 日が 86 バイト）。MB へ繰り上げるのは 1024 KB を超えてから。
   */
  it('保存サイズは KB から始めて MB へ繰り上げる', () => {
    expect(fmtBytes(512)).toBe('1 KB');
    expect(fmtBytes(2048)).toBe('2 KB');
    expect(fmtBytes(1024 * 1024 * 1.5)).toBe('1.5 MB');
  });
});
