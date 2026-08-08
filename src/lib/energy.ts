import { diffDays } from './date';
import type { WeekPoint } from '../types';

/**
 * 体組織 1kg あたりのエネルギー。国内で一般的に使われる 7,200 kcal/kg を採用。
 * （純脂肪なら約 7,700、脂肪組織なら約 7,000。減った分がすべて脂肪とは限らないので中間値をとる慣習）
 */
export const KCAL_PER_KG = 7200;

export const ENERGY_WINDOWS = [1, 2, 4] as const;
export type EnergyWindow = (typeof ENERGY_WINDOWS)[number];

export interface EnergyPoint {
  key: string;
  /** 対象週のラベル（W03 など） */
  label: string;
  /** 比較元の週開始 */
  from: string;
  /** 対象週の週終了 */
  to: string;
  days: number;
  weightDelta: number;
  fatDelta: number | null;
  /** 体重ベースの推定収支 kcal/日 */
  kcalWeight: number;
  /** 体脂肪量ベースの推定収支 kcal/日 */
  kcalFat: number | null;
}

/**
 * 週平均どうしを windowWeeks 週ぶん離して比べ、その差をカロリー収支に換算する。
 *
 * 週平均は「その週の中心」を代表する値なので、N 週離れた 2 つの週平均の差は
 * ちょうど N×7 日ぶんの収支に対応する。日次の生データを使わないのは、
 * 水分変動が数百 kcal 相当のノイズとして乗るため。
 */
export function computeEnergyBalance(
  weeks: readonly WeekPoint[],
  windowWeeks: EnergyWindow,
): EnergyPoint[] {
  const points: EnergyPoint[] = [];

  for (let i = windowWeeks; i < weeks.length; i++) {
    const to = weeks[i];
    const from = weeks[i - windowWeeks];
    if (!to || !from || to.weight == null || from.weight == null) continue;

    const days = diffDays(to.start, from.start);
    if (days <= 0) continue;

    const weightDelta = to.weight - from.weight;
    const fatDelta =
      to.fatMass != null && from.fatMass != null ? to.fatMass - from.fatMass : null;

    points.push({
      key: to.start,
      label: to.label,
      from: from.start,
      to: to.end,
      days,
      weightDelta,
      fatDelta,
      kcalWeight: (weightDelta * KCAL_PER_KG) / days,
      kcalFat: fatDelta == null ? null : (fatDelta * KCAL_PER_KG) / days,
    });
  }

  return points;
}

/** 集計期間に必要な週数に対して、あと何週ぶんの記録が足りないか */
export function weeksShort(weeks: readonly WeekPoint[], windowWeeks: EnergyWindow): number {
  const usable = weeks.filter((w) => w.weight != null).length;
  return Math.max(0, windowWeeks + 1 - usable);
}
