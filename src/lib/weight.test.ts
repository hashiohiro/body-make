import { describe, expect, it } from 'vitest';
import { LB_IN_KG, fromKg, isWeightUnit, rangeIn, toKg } from './weight';
import { SET_WEIGHT_RANGE, parseSetWeight, sanitizeData } from './storage';

/**
 * 重量の単位。**保存は常にキログラム**で、換算するのは入口と出口だけ
 * （`lib/weight.ts`）。ここが崩れると、遠征中の記録だけ別の物差しになる。
 */
describe('kg とポンドの換算', () => {
  it('定義値どおりに換算する', () => {
    expect(LB_IN_KG).toBe(0.45359237);
    expect(toKg(135, 'lb')).toBeCloseTo(61.23497, 5);
    expect(fromKg(61.23497, 'lb')).toBeCloseTo(135, 5);
  });

  it('kg のときは素通し', () => {
    expect(toKg(60, 'kg')).toBe(60);
    expect(fromKg(60, 'kg')).toBe(60);
  });

  /*
   * ここが今回いちばん効く。保存が小数第 1 位のままだと
   * `135 lb → 61.2 kg → 134.9 lb` となり、**打った数字と違う値**が表示される。
   */
  it('ポンドで打った値が、保存して戻しても同じ数字になる', () => {
    for (const lb of [45, 95, 135, 225, 315, 405]) {
      const stored = parseSetWeight(toKg(lb, 'lb'));
      expect(stored).not.toBeNull();
      // 表示は小数第 1 位。打った数字に戻る
      expect(Math.round(fromKg(stored!, 'lb') * 10) / 10).toBe(lb);
    }
  });

  it('セットの重量は小数第 2 位まで持つ', () => {
    expect(parseSetWeight(61.2349)).toBe(61.23);
    // kg で打つぶんには今までどおり
    expect(parseSetWeight(60)).toBe(60);
    expect(parseSetWeight(62.5)).toBe(62.5);
  });

  /*
   * 値域は**打った単位のまま**で見る。kg に直してから見ると、
   * 上限ちょうど（500kg = 1102.31lb）が丸めの向きで弾かれる。
   */
  it('値域を打つ単位に合わせて広げる', () => {
    expect(rangeIn(SET_WEIGHT_RANGE, 'kg')).toEqual([0, 500]);
    const [min, max] = rangeIn(SET_WEIGHT_RANGE, 'lb');
    expect(min).toBe(0);
    // 500kg ぶんが収まる大きさ。切り捨てると上限ちょうどが打てない
    expect(max).toBeGreaterThanOrEqual(fromKg(500, 'lb'));
    expect(toKg(max, 'lb')).toBeGreaterThanOrEqual(500);
  });

  it('知らない単位は受け取らない', () => {
    expect(isWeightUnit('kg')).toBe(true);
    expect(isWeightUnit('lb')).toBe(true);
    expect(isWeightUnit('pound')).toBe(false);
    expect(isWeightUnit(null)).toBe(false);
  });
});

describe('単位の設定', () => {
  it('既定はどちらも kg', () => {
    const { settings } = sanitizeData({});
    expect(settings.inputWeightUnit).toBe('kg');
    expect(settings.displayWeightUnit).toBe('kg');
  });

  it('入力と表示を別々に持てる', () => {
    const { settings } = sanitizeData({
      settings: { inputWeightUnit: 'lb', displayWeightUnit: 'kg' },
    });
    expect(settings.inputWeightUnit).toBe('lb');
    expect(settings.displayWeightUnit).toBe('kg');
  });

  it('知らない単位を持つバックアップは kg に落ちる', () => {
    const { settings } = sanitizeData({
      settings: { inputWeightUnit: 'stone', displayWeightUnit: 7 },
    });
    expect(settings.inputWeightUnit).toBe('kg');
    expect(settings.displayWeightUnit).toBe('kg');
  });

  /** 単位を持たない古いバックアップ（今回より前のもの）がそのまま読めること */
  it('単位を持たないバックアップは kg で埋まる', () => {
    const { settings, entries } = sanitizeData({
      version: 7,
      settings: { heightCm: 172, theme: 'system' },
      entries: { '2026-03-01': { am: { weight: 70, bodyFat: 20 } } },
    });
    expect(settings.inputWeightUnit).toBe('kg');
    expect(settings.heightCm).toBe(172);
    expect(entries['2026-03-01']?.am.weight).toBe(70);
  });
});
