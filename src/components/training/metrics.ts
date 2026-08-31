import { BASELINE_SESSIONS } from '../../lib/training';
import type { ExerciseHistoryPoint } from '../../lib/training';
import type { ExercisePoint } from '../../types';

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
  pick: (point: ExercisePoint) => number | null;
}

export const METRICS: Metric[] = [
  {
    id: 'volume',
    label: '挙上量',
    unit: 'kg',
    digits: 0,
    needsWeight: true,
    pick: (p) => (p.volume > 0 ? p.volume : null),
  },
  { id: 'sets', label: 'セット数', unit: 'セット', digits: 0, pick: (p) => p.workSets },
  // 有酸素は本数（インターバルの本数、サーキットのラウンド数）
  { id: 'bouts', label: '本数', unit: '本', digits: 0, cardioOnly: true, pick: (p) => p.workSets },
  // レップ数に左右されない「その日いちばん重かった重量」。推定1RM と並べると、
  // 重量が上がったのか同じ重量で回数が伸びたのかを切り分けられる
  // 最大重量と目標は「バーに載せた数字」で見る。挙上量と推定1RM は換算後の負荷
  {
    id: 'maxWeight',
    label: '最大重量',
    unit: 'kg',
    digits: 1,
    weightLike: true,
    needsWeight: true,
    pick: (p) => p.top?.weight ?? null,
  },
  { id: 'maxReps', label: '最大回数', unit: '', digits: 0, pick: (p) => p.maxReps },
  { id: 'oneRm', label: '推定1RM', unit: 'kg', digits: 1, needsWeight: true, pick: (p) => p.oneRm },

  /*
   * 有酸素。距離が「量」、速度が「強度」で、筋トレの 挙上量 / 推定1RM にあたる。
   * どれも大きいほど良い向きに揃えてある（ペースで持つと速度だけ向きが反転する）。
   */
  {
    id: 'distance',
    label: '距離',
    // 入力欄と同じ m。桁を合わせ直さずに読める
    unit: 'm',
    digits: 0,
    cardioOnly: true,
    weightLike: true,
    pick: (p) => p.meters,
  },
  {
    id: 'minutes',
    label: '時間',
    unit: '分',
    digits: 0,
    cardioOnly: true,
    pick: (p) => p.minutes,
  },
  {
    id: 'speed',
    label: '速度',
    unit: 'm/分',
    digits: 1,
    cardioOnly: true,
    pick: (p) => p.speed,
  },
];

/** 開始値は最初の 3 セッションの平均。初回 1 点だと当日の調子が以後すべての差分に乗る */
export function baselineOf(
  history: readonly ExerciseHistoryPoint[],
  metric: Metric,
): number | null {
  const values = history.map((h) => metric.pick(h.point)).filter((v): v is number => v != null);
  if (values.length < BASELINE_SESSIONS) return null;
  const head = values.slice(0, BASELINE_SESSIONS);
  return head.reduce((a, b) => a + b, 0) / head.length;
}

export function lastOf(history: readonly ExerciseHistoryPoint[], metric: Metric): number | null {
  for (let i = history.length - 1; i >= 0; i--) {
    const v = metric.pick(history[i]!.point);
    if (v != null) return v;
  }
  return null;
}
