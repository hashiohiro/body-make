import type { WeekSetCount } from '../../lib/training';
import { WEIGHT_UNIT_LABEL, fromKg } from '../../lib/weight';
import type { WeightUnit } from '../../lib/weight';
import type { GroupGoalType, MuscleGroup } from '../../types';
import type { MessageKey, T } from '../../lib/i18n';

/**
 * 見る値の軸。**部位の目標の立て方と同じもの**（`GroupGoalType`）。
 * 別に持つと、目標は挙上量で立てられるのに配分の表には出ない、という食い違いが起きる。
 */
export type GroupValueId = GroupGoalType;

export interface GroupValue {
  id: GroupValueId;
  label: string;
  unit: string;
  digits: number;
  pick: (week: WeekSetCount, group: MuscleGroup) => number;
}

/**
 * 部位別に見る値。推移（線）と配分（表）で同じ定義を使い、選択も親で共有する。
 * 別々に持つと、線をセット数で見ながら表は挙上量、という食い違いが起きる。
 */
const BASE_GROUP_VALUES: GroupValue[] = [
  {
    id: 'sets',
    label: 'metric.sets',
    unit: 'metric.setsUnit',
    digits: 1,
    pick: (w, g) => w.setsByGroup[g],
  },
  {
    id: 'volume',
    label: 'metric.volume',
    unit: 'kg',
    digits: 0,
    pick: (w, g) => Math.round(w.volumeByGroup[g]),
  },
];

/**
 * 読むときの単位に合わせた、部位別に見る値。
 *
 * 挙上量は kg で積んであるので（`lib/weight.ts`）、ポンド表示のときは
 * 出口で換算して単位の綴りも差し替える。セット数は重量ではないので触らない。
 */
export function groupValuesFor(t: T, unit: WeightUnit): GroupValue[] {
  return BASE_GROUP_VALUES.map((value) => {
    // 名前と単位はキーで持っているので、出す直前に引く（`docs/design-i18n.md`）
    const named = {
      ...value,
      label: t(value.label as MessageKey),
      unit: value.unit === 'kg' ? 'kg' : t(value.unit as MessageKey),
    };
    if (unit === 'kg' || value.id !== 'volume') return named;
    return {
      ...named,
      unit: WEIGHT_UNIT_LABEL[unit],
      pick: (w: WeekSetCount, g: MuscleGroup) => Math.round(fromKg(value.pick(w, g), unit)),
    };
  });
}
