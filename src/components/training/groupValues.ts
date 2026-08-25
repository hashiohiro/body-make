import type { WeekSetCount } from '../../lib/training';
import type { MuscleGroup } from '../../types';

export type GroupValueId = 'sets' | 'volume';

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
export const GROUP_VALUES: GroupValue[] = [
  { id: 'sets', label: 'セット数', unit: 'セット', digits: 1, pick: (w, g) => w.setsByGroup[g] },
  {
    id: 'volume',
    label: '挙上量',
    unit: 'kg',
    digits: 0,
    pick: (w, g) => Math.round(w.volumeByGroup[g]),
  },
];
