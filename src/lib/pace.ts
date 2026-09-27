import type { DailyPoint, Projection, Settings, Stats } from '../types';
import { addDays } from './date';
import { PACE_WINDOW } from './derive';
import { KCAL_PER_KG } from './energy';

/*
 * 目標タブ（体組成）のペースと目標の体組成が描く値。`docs/design-pace.md`。
 *
 * **ここにある数字は、すべて記録と目標からの算術。**
 * 閾値も既定値も持たない——「適正なペース」や「遅れ」を決める値がここに入ったら、
 * それは設計 §1 の背骨を割っている。
 */

/* ------------------------------------------------------------------ *
 * A. ペース
 * ------------------------------------------------------------------ */

export interface PaceGap {
  /** kg/週。直近 28 日の回帰（`Projection.pacePerWeek`）。記録が 4 日未満なら null */
  pace: number | null;
  /** kg/週。目標日までに要るペース（`Projection.requiredPerWeek`）。目標日が無ければ null */
  required: number | null;
  /**
   * 推定収支 kcal/日。**摂取量の指示ではない。**
   * 体重の変化を `KCAL_PER_KG` で換算しただけで、`computeEnergyBalance` と同じ換算。
   */
  kcalPace: number | null;
  kcalRequired: number | null;
}

const toKcalPerDay = (kgPerWeek: number | null) =>
  kgPerWeek == null ? null : (kgPerWeek * KCAL_PER_KG) / 7;

/**
 * 片方しか出なくても返す。**カードは出し続けて、出ない値は「—」にする**——
 * 値が揃うまでカードごと消えると、何を入れれば出るのかが読めない。
 */
export function paceGap(projection: Projection): PaceGap {
  const { pacePerWeek: pace, requiredPerWeek: required } = projection;
  return {
    pace,
    required,
    kcalPace: toKcalPerDay(pace),
    kcalRequired: toKcalPerDay(required),
  };
}

/** ゲージの端の余白（値の幅に対する比）。点が端に貼り付かないためだけの値 */
const GAUGE_PAD = 0.2;

/**
 * ゲージの軸の端。**0 を必ず含める。**
 *
 * 増えているか減っているかは符号で読むので、0 の位置が見えないと 2 点の関係が読めない。
 * 区間（帯）は持たない。帯の幅は「適正」の発明になる（設計 §7-3）。
 * 点が 1 つも無ければ null（ゲージを描かない）。
 */
export function gaugeDomain(gap: PaceGap): [number, number] | null {
  const values = [gap.pace, gap.required].filter((v): v is number => v != null);
  if (values.length === 0) return null;
  const lo = Math.min(...values, 0);
  const hi = Math.max(...values, 0);
  // 値がすべて 0 なら幅が無い。軸を立てるための最小幅（見た目だけの値）
  const span = hi - lo || 0.1;
  return [lo - span * GAUGE_PAD, hi + span * GAUGE_PAD];
}

export interface PaceLine {
  /** 直近 PACE_WINDOW 日の 7 日移動平均 */
  recent: { date: string; value: number }[];
  /** 到達線の始点（今日の移動平均）と終点（目標日の目標体重） */
  from: { date: string; value: number };
  to: { date: string; value: number };
}

/**
 * 小さな推移図の値。**目標日までを描くのはこの図だけ**（設計 §5.3）。
 * 推移グラフの x 範囲を目標日まで伸ばすと、過去の記録が縮む。
 */
export function paceLine(
  daily: readonly DailyPoint[],
  settings: Settings,
  today: string,
): PaceLine | null {
  const { targetWeight, targetDate } = settings;
  if (targetWeight == null || targetDate == null || targetDate <= today) return null;

  const from = addDays(today, -(PACE_WINDOW - 1));
  const recent = daily
    .filter((d) => d.date >= from && d.date <= today && d.maWeight != null)
    .map((d) => ({ date: d.date, value: d.maWeight! }));
  const last = recent[recent.length - 1];
  if (!last) return null;

  return {
    recent,
    from: last,
    to: { date: targetDate, value: targetWeight },
  };
}

/* ------------------------------------------------------------------ *
 * B. 目標の体組成
 * ------------------------------------------------------------------ */

export interface TargetComposition {
  current: { lean: number; fat: number };
  target: { lean: number; fat: number };
  /** target.lean − current.lean。負なら、目標は除脂肪体重を減らす置き方になっている */
  leanDelta: number;
  /**
   * いまの除脂肪体重のまま目標体脂肪率になる体重。
   * **算術の結果を 1 行出すだけ**で、目標欄に入れる操作は持たない（設計 §7-4）。
   */
  weightAtCurrentLean: number;
}

export function targetComposition(settings: Settings, stats: Stats): TargetComposition | null {
  const { targetWeight, targetBodyFat } = settings;
  const { currentLeanMass: lean, currentFatMass: fat } = stats;
  if (targetWeight == null || targetBodyFat == null || lean == null || fat == null) return null;
  if (targetBodyFat >= 100) return null;

  const targetFat = (targetWeight * targetBodyFat) / 100;
  const targetLean = targetWeight - targetFat;
  return {
    current: { lean, fat },
    target: { lean: targetLean, fat: targetFat },
    leanDelta: targetLean - lean,
    weightAtCurrentLean: lean / (1 - targetBodyFat / 100),
  };
}
