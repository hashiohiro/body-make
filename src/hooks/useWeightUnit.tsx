import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import { WEIGHT_UNIT_LABEL, fromKg, fromKgOrNull } from '../lib/weight';
import type { WeightUnit } from '../lib/weight';

/**
 * **読むときの**重量の単位（`Settings.displayWeightUnit`）。
 *
 * このアプリで唯一のコンテキスト。props で通さない理由は配る先の数と深さで、
 * 重量を出す場所が 10 ファイルある——種目カードの合計・推移の指標・部位の集計・
 * 種目と部位の目標・記録の移行。末端（`ExerciseTotals` は `point` と `best` しか
 * 受け取らない）まで通すと、**重量に関係のない中間コンポーネントにも単位の引数が生える。**
 *
 * 打つときの単位はここに入れない。あちらは記録画面のトグルで動く一時的な状態で、
 * 生存期間も置き場所も違う（`TrainingView`）。
 */
const WeightUnitContext = createContext<WeightUnit>('kg');

export function WeightUnitProvider({ unit, children }: { unit: WeightUnit; children: ReactNode }) {
  return <WeightUnitContext value={unit}>{children}</WeightUnitContext>;
}

/** 読むときの単位そのもの */
export function useWeightUnit(): WeightUnit {
  return useContext(WeightUnitContext);
}

/**
 * 読むときの単位と、kg からの換算をまとめて受け取る。
 *
 * 呼び出し側が `fromKg(v, unit)` と `WEIGHT_UNIT_LABEL[unit]` を毎回書くと、
 * **片方だけ書き忘れた場所**——ポンドの数字に kg と添えてある表示——が生まれる。
 * 値と綴りを必ず対で出す。
 */
export function useWeightFormat(): {
  unit: WeightUnit;
  /** 単位の綴り。'kg' | 'lb' */
  label: string;
  /** kg の値を、読むときの単位へ */
  conv: (kg: number) => number;
  /** null を素通しする版 */
  convOrNull: (kg: number | null) => number | null;
} {
  const unit = useWeightUnit();
  return {
    unit,
    label: WEIGHT_UNIT_LABEL[unit],
    conv: (kg) => fromKg(kg, unit),
    convOrNull: (kg) => fromKgOrNull(kg, unit),
  };
}

/**
 * 導出済みの目標（`ExerciseGoal`）を、読むときの単位へ直す。
 *
 * 目標の導出（`exerciseGoals`）は表示の都合を知らない——単位の好みが混ざると
 * 増分キャッシュまで表示設定に依存することになる。**導出は kg のまま**にして、
 * 出す直前のここで直す。
 *
 * 換算の対象かどうかは **`unit` が 'kg' かどうか**で決める。`goalUnitOf` が
 * 付けた綴りをそのまま見るので、値だけ直して綴りが kg のまま残る、が起こらない。
 */
export function useGoalUnit(): (goalUnit: string) => {
  label: string;
  conv: (value: number | null) => number | null;
} {
  const { unit, label, convOrNull } = useWeightFormat();
  return (goalUnit) =>
    goalUnit === 'kg' && unit !== 'kg'
      ? { label, conv: convOrNull }
      : { label: goalUnit, conv: (value) => value };
}
