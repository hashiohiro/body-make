import { describe, expect, it } from 'vitest';
import { gaugeDomain, paceGap, paceLine, targetComposition } from './pace';
import { isoToTime } from './date';
import type { DailyPoint, Projection, Settings, Stats } from '../types';

/* 値は 2026-09-27 時点の実データから取っている（`docs/design-pace.md` §6） */

const TODAY = '2026-09-27';

function projection(patch: Partial<Projection>): Projection {
  return {
    pacePerWeek: null,
    etaDate: null,
    etaDays: null,
    progress: null,
    requiredPerWeek: null,
    ...patch,
  };
}

function settings(patch: Partial<Settings>): Settings {
  return {
    heightCm: 168,
    targetWeight: null,
    targetBodyFat: null,
    targetDate: null,
    startDate: null,
    theme: 'system',
    locale: 'ja',
    waistEnabled: false,
    inputWeightUnit: 'kg',
    displayWeightUnit: 'kg',
    ...patch,
  };
}

function stats(lean: number | null, fat: number | null): Stats {
  return { currentLeanMass: lean, currentFatMass: fat } as Stats;
}

describe('paceGap', () => {
  it('実績と必要を kcal/日 に換算する（1kg = 7,200kcal）', () => {
    const gap = paceGap(projection({ pacePerWeek: 0.2332, requiredPerWeek: -0.4437 }));
    expect(gap.kcalPace).toBeCloseTo(239.9, 0);
    expect(gap.kcalRequired).toBeCloseTo(-456.4, 0);
  });

  it('目標日が無い（必要ペースが出ない）ときは、必要の側だけ空', () => {
    const gap = paceGap(projection({ pacePerWeek: 0.23 }));
    expect(gap.pace).toBe(0.23);
    expect(gap.required).toBeNull();
    expect(gap.kcalRequired).toBeNull();
  });

  it('実績が出ない（記録が 4 日未満）ときは、実績の側だけ空', () => {
    const gap = paceGap(projection({ requiredPerWeek: -0.44 }));
    expect(gap.pace).toBeNull();
    expect(gap.kcalPace).toBeNull();
    expect(gap.required).toBe(-0.44);
  });
});

describe('gaugeDomain', () => {
  it('0 を必ず含み、両端に余白を取る', () => {
    const [lo, hi] = gaugeDomain(
      paceGap(projection({ pacePerWeek: -0.2, requiredPerWeek: -0.5 })),
    )!;
    // 2 点とも負でも 0 が軸に入る
    expect(hi).toBeGreaterThan(0);
    expect(lo).toBeLessThan(-0.5);
  });

  it('値がすべて 0 でも幅を持つ', () => {
    const [lo, hi] = gaugeDomain(paceGap(projection({ pacePerWeek: 0, requiredPerWeek: 0 })))!;
    expect(hi - lo).toBeGreaterThan(0);
  });

  it('片方だけでも軸を立て、両方無ければ描かない', () => {
    expect(gaugeDomain(paceGap(projection({ requiredPerWeek: -0.44 })))).not.toBeNull();
    expect(gaugeDomain(paceGap(projection({})))).toBeNull();
  });
});

describe('targetComposition', () => {
  const now = stats(62.86, 13.16);

  it('目標 70kg / 10% はいまの除脂肪体重とほぼ同じ', () => {
    const c = targetComposition(settings({ targetWeight: 70, targetBodyFat: 10 }), now)!;
    expect(c.target.lean).toBeCloseTo(63.0, 5);
    expect(c.target.fat).toBeCloseTo(7.0, 5);
    expect(c.leanDelta).toBeCloseTo(0.14, 2);
    expect(c.weightAtCurrentLean).toBeCloseTo(69.84, 2);
  });

  it('目標 65kg / 10% は除脂肪体重を 4kg あまり減らす置き方になる', () => {
    const c = targetComposition(settings({ targetWeight: 65, targetBodyFat: 10 }), now)!;
    expect(c.leanDelta).toBeCloseTo(-4.36, 2);
  });

  it('目標体脂肪率が無いと出さない', () => {
    expect(targetComposition(settings({ targetWeight: 70 }), now)).toBeNull();
  });

  it('体脂肪率の記録が無い（体組成が出ない）と出さない', () => {
    expect(
      targetComposition(settings({ targetWeight: 70, targetBodyFat: 10 }), stats(null, null)),
    ).toBeNull();
  });
});

describe('paceLine', () => {
  function day(date: string, maWeight: number | null): DailyPoint {
    return { date, time: isoToTime(date), maWeight } as DailyPoint;
  }

  it('直近 28 日だけを持ち、今日の移動平均から目標日の目標体重へ線を引く', () => {
    const daily = [day('2026-08-30', 75.0), day('2026-08-31', 75.18), day('2026-09-27', 76.02)];
    const line = paceLine(daily, settings({ targetWeight: 70, targetDate: '2026-12-31' }), TODAY)!;
    expect(line.recent.map((p) => p.date)).toEqual(['2026-08-31', '2026-09-27']);
    expect(line.from).toEqual({ date: '2026-09-27', value: 76.02 });
    expect(line.to).toEqual({ date: '2026-12-31', value: 70 });
  });

  it('目標日を過ぎていれば引かない', () => {
    const daily = [day('2026-09-27', 76.02)];
    expect(
      paceLine(daily, settings({ targetWeight: 70, targetDate: '2026-09-01' }), TODAY),
    ).toBeNull();
  });
});
