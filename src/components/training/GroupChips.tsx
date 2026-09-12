import { EXERCISE_GROUP_ORDER, GROUP_LABELS } from '../../lib/exerciseCatalog';
import { ChipGroup } from '../ChipGroup';
import type { ExerciseGroup } from '../../types';

interface Props {
  value: ExerciseGroup | 'all';
  onChange: (group: ExerciseGroup | 'all') => void;
  /**
   * チップに出す分類。省略すると全部位。
   *
   * **絞り込む前の一覧から決めて渡す。**絞った結果から決めると、
   * 押したとたんにチップが消えて、指の下でチップが動く。
   * 持っていない部位を出さないのは、押しても 0 件にしかならないチップを並べないため。
   */
  groups?: readonly ExerciseGroup[];
  /**
   * 見出しを画面にも出すか。
   * 同じ面に絞り込みの行が 2 つ以上あるときに使う（カタログの 器具 / 部位）。
   */
  showLabel?: boolean | undefined;
}

/**
 * 部位で絞るチップの行。**部位で絞る面はすべてこれ。**
 *
 * 「`すべて` を先頭に足して、持っている部位を `GROUP_LABELS` で並べる」を
 * 3 か所で組み立てていた。`すべて` の値（`'all'`）も、部位の並び順も、
 * 出す・出さないの決め方も、写すたびにずれる余地がある。
 *
 * 読み上げの名前は「部位」でそろえる。同じものを指すのに面ごとに名前が違うと、
 * 読み上げで画面を渡り歩く人にとっては別の部品に見える。
 */
export function GroupChips({ value, onChange, groups = EXERCISE_GROUP_ORDER, showLabel }: Props) {
  // 1 種類しか無ければ、押し分ける相手がいない
  if (groups.length <= 1) return null;

  return (
    <ChipGroup
      options={[
        { id: 'all' as const, label: 'すべて' },
        ...groups.map((g) => ({ id: g, label: GROUP_LABELS[g] })),
      ]}
      value={value}
      onChange={onChange}
      label="部位"
      showLabel={showLabel}
      tight
    />
  );
}
