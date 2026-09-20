/**
 * 重量の単位。**保存は必ずキログラム。**
 *
 * ポンドを記録に混ぜない。挙上量・推定1RM・自重換算・部位の集計・目標が
 * すべて kg で出来ているので、保存に単位が混ざると **同じ種目の記録どうしが
 * 直接比べられなくなる**（遠征中の 1 週間だけ別の物差しになる）。
 * 換算するのは入口（打つとき）と出口（出すとき）だけにする。
 */
export type WeightUnit = 'kg' | 'lb';

/** 表示に出す単位の綴り */
export const WEIGHT_UNIT_LABEL: Record<WeightUnit, string> = { kg: 'kg', lb: 'lb' };

/** 設定の選択肢。綴りだけでは何のことか読めないので、名前を添える */
export const WEIGHT_UNIT_OPTIONS: { id: WeightUnit; label: string }[] = [
  { id: 'kg', label: 'キログラム (kg)' },
  { id: 'lb', label: 'ポンド (lb)' },
];

/** 1 lb = 0.45359237 kg（国際ヤード・ポンドの定義値。近似ではない） */
export const LB_IN_KG = 0.45359237;

export function isWeightUnit(value: unknown): value is WeightUnit {
  return value === 'kg' || value === 'lb';
}

/** 打たれた値を保存の単位（kg）へ。kg ならそのまま */
export function toKg(value: number, unit: WeightUnit): number {
  return unit === 'lb' ? value * LB_IN_KG : value;
}

/** 保存の値（kg）を出す単位へ。kg ならそのまま */
export function fromKg(value: number, unit: WeightUnit): number {
  return unit === 'lb' ? value / LB_IN_KG : value;
}

/** null を素通しする版。欄と表示はほぼこちらを使う */
export function toKgOrNull(value: number | null, unit: WeightUnit): number | null {
  return value == null ? null : toKg(value, unit);
}

export function fromKgOrNull(value: number | null, unit: WeightUnit): number | null {
  return value == null ? null : fromKg(value, unit);
}

/**
 * **打つ欄に出す値。ポンドは小数第 1 位で丸める。**
 *
 * kg → lb は割り切れないので、換算したままだと欄に
 * `134.99999999999997` が出る（`useNumericField` は `String(value)` をそのまま出す）。
 *
 * kg のときは丸めない。保存が小数第 2 位なので（ポンドの往復のため）、
 * ここで 1 位に丸めると、触っていない欄からフォーカスを外しただけで桁が落ちる。
 */
export function fromKgForField(value: number | null, unit: WeightUnit): number | null {
  if (value == null) return null;
  const converted = fromKg(value, unit);
  return unit === 'lb' ? Math.round(converted * 10) / 10 : converted;
}

/**
 * kg で決めてある値域を、打つ単位に合わせて広げる。
 *
 * 値域の判定は**打った単位のまま**で行う。kg に直してから見ると、
 * 上限ちょうど（500kg = 1102.31lb）を打ったときに丸めの向き次第で弾かれる。
 */
export function rangeIn(range: readonly [number, number], unit: WeightUnit): [number, number] {
  if (unit === 'kg') return [range[0], range[1]];
  return [Math.floor(fromKg(range[0], unit)), Math.ceil(fromKg(range[1], unit))];
}
