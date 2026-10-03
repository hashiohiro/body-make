import { BASELINE_SESSIONS, pickOneRm, pickTopWeight, pickVolume } from '../../lib/training';
import type { ExerciseHistoryPoint } from '../../lib/training';
import { WEIGHT_UNIT_LABEL, fromKgOrNull } from '../../lib/weight';
import type { WeightUnit } from '../../lib/weight';
import type { ExercisePoint, GoalPeriod } from '../../types';
import { isoToTime, startOfWeek } from '../../lib/date';
import type { MessageKey, T } from '../../lib/i18n';

/** 種目の推移で切り替えられる指標。一覧とダイアログの両方が同じ定義を使う */
export interface Metric {
  id: string;
  label: string;
  unit: string;
  digits: number;
  /** 挙上量に計上しない種目では出さない */
  needsWeight?: boolean;
  /** 有酸素だけで意味を持つ指標。筋トレの一覧には出さない */
  cardioOnly?: boolean;
  /** 目標の参照線と進捗を出す指標。実際に扱えた最大重量だけが目標と直接比較できる */
  weightLike?: boolean;
  /**
   * 週ごとに見るときのまとめ方。**量（挙上量・セット数・本数・距離・時間）は合計、
   * 強さ（最大重量・最大レップ・推定1RM・速度）は最大。**種目の目標の週次と同じ分け方（`goalSeries`）。
   */
  weekly: 'sum' | 'max';
  pick: (point: ExercisePoint) => number | null;
}

/**
 * 重量で数える指標かどうか。**読むときの単位で換算する対象。**
 *
 * 記録は kg で持っているので（`lib/weight.ts`）、ポンド表示のときは
 * ここに挙げたものだけを換算し、単位の綴りも合わせて差し替える。
 * セット数・回数・距離・時間・速度は重量ではないので触らない。
 */
const WEIGHT_METRICS = new Set(['volume', 'maxWeight', 'oneRm']);

const BASE_METRICS: Metric[] = [
  {
    id: 'volume',
    weekly: 'sum',
    label: 'metric.volume',
    unit: 'kg',
    digits: 0,
    needsWeight: true,
    pick: pickVolume,
  },
  {
    id: 'sets',
    weekly: 'sum',
    label: 'metric.sets',
    unit: 'metric.setsUnit',
    digits: 0,
    pick: (p) => p.workSets,
  },
  // 有酸素は本数（インターバルの本数、サーキットのラウンド数）
  {
    id: 'bouts',
    weekly: 'sum',
    label: 'metric.bouts',
    unit: 'metric.boutsUnit',
    digits: 0,
    cardioOnly: true,
    pick: (p) => p.workSets,
  },
  // レップ数に左右されない「その日いちばん重かった重量」。推定1RM と並べると、
  // 重量が上がったのか同じ重量で回数が伸びたのかを切り分けられる
  // 最大重量と目標は「バーに載せた数字」で見る。挙上量と推定1RM は換算後の負荷
  {
    id: 'maxWeight',
    weekly: 'max',
    label: 'metric.maxWeight',
    unit: 'kg',
    digits: 1,
    weightLike: true,
    needsWeight: true,
    pick: pickTopWeight,
  },
  {
    id: 'maxReps',
    weekly: 'max',
    label: 'metric.maxReps',
    unit: '',
    digits: 0,
    pick: (p) => p.maxReps,
  },
  {
    id: 'oneRm',
    weekly: 'max',
    label: 'metric.oneRm',
    unit: 'kg',
    digits: 1,
    needsWeight: true,
    pick: pickOneRm,
  },

  /*
   * 有酸素。距離が「量」、速度が「強度」で、筋トレの 挙上量 / 推定1RM にあたる。
   * どれも大きいほど良い向きに揃えてある（ペースで持つと速度だけ向きが反転する）。
   */
  {
    id: 'distance',
    weekly: 'sum',
    label: 'metric.distance',
    // 入力欄と同じ m。桁を合わせ直さずに読める
    unit: 'm',
    digits: 0,
    cardioOnly: true,
    weightLike: true,
    pick: (p) => p.meters,
  },
  {
    id: 'minutes',
    weekly: 'sum',
    label: 'metric.duration',
    unit: 'metric.durationUnit',
    digits: 0,
    cardioOnly: true,
    pick: (p) => p.minutes,
  },
  {
    id: 'speed',
    weekly: 'max',
    label: 'metric.speed',
    unit: 'metric.speedUnit',
    digits: 1,
    cardioOnly: true,
    pick: (p) => p.speed,
  },
];

/**
 * 読むときの単位に合わせた指標の一覧。
 *
 * **定数ではなく関数で持つ。** 挙上量・最大重量・推定1RM は kg で出来ているので、
 * ポンド表示のときは `pick` の出口で換算し、単位の綴りも差し替える必要がある。
 * ここで一度にやれば、推移のグラフ・軸・ツールチップ・開始比がまとめて追従する。
 */
export function metricsFor(t: T, unit: WeightUnit): Metric[] {
  return BASE_METRICS.map((metric) => {
    // 名前と単位はキーで持っているので、出す直前に引く（`docs/design-i18n.md`）
    const named = {
      ...metric,
      label: t(metric.label as MessageKey),
      unit:
        metric.unit === '' || metric.unit === 'kg' || metric.unit === 'm'
          ? metric.unit
          : t(metric.unit as MessageKey),
    };
    if (unit === 'kg' || !WEIGHT_METRICS.has(metric.id)) return named;
    return {
      ...named,
      unit: WEIGHT_UNIT_LABEL[unit],
      pick: (point: ExercisePoint) => fromKgOrNull(metric.pick(point), unit),
    };
  });
}

/**
 * 週（日〜土）ごとにまとめた値。並びは週の順。値の無い週は持たない。
 * まとめ方は指標が持つ（`Metric.weekly`）。
 */
function weeklyValues(
  history: readonly ExerciseHistoryPoint[],
  metric: Metric,
): { start: string; value: number }[] {
  const byWeek = new Map<string, number>();
  for (const h of history) {
    const v = metric.pick(h.point);
    if (v == null) continue;
    const start = startOfWeek(h.date);
    const prev = byWeek.get(start);
    byWeek.set(start, prev == null ? v : metric.weekly === 'sum' ? prev + v : Math.max(prev, v));
  }
  return [...byWeek].map(([start, value]) => ({ start, value }));
}

/**
 * 1 種目の指標の並びと、開始値・直近・過去最大。**日次なら 1 回ごと、週次なら週ごと。**
 * 推移の一覧（`TrainingCharts`）と推移のダイアログ（`ExerciseDetailDialog`）の両方がこれを使う——
 * 片方だけ週次を知っていると、同じ種目の「直近」が画面ごとに割れる。
 *
 * 開始値は最初の 3 つ（日次なら 3 回、週次なら 3 週）の平均。過去最大は並び全体の最大。
 */
export function metricSeries(
  history: readonly ExerciseHistoryPoint[],
  metric: Metric,
  period: GoalPeriod,
): {
  points: { date: string; t: number; v: number; point: ExercisePoint | null }[];
  baseline: number | null;
  current: number | null;
  best: number | null;
} {
  const points =
    period === 'week'
      ? weeklyValues(history, metric).map((w) => ({
          date: w.start,
          t: isoToTime(w.start),
          v: w.value,
          point: null,
        }))
      : history.flatMap((h) => {
          const v = metric.pick(h.point);
          return v == null ? [] : [{ date: h.date, t: h.time, v, point: h.point }];
        });
  const values = points.map((p) => p.v);
  return {
    points,
    baseline:
      values.length >= BASELINE_SESSIONS
        ? values.slice(0, BASELINE_SESSIONS).reduce((a, b) => a + b, 0) / BASELINE_SESSIONS
        : null,
    current: values.length ? values[values.length - 1]! : null,
    best: values.length ? Math.max(...values) : null,
  };
}
