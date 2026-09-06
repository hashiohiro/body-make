import { EXERCISE_GROUP_ORDER, GROUP_LABELS } from '../../lib/exerciseCatalog';
import type { Exercise, ExerciseGroup } from '../../types';
import ui from '../../styles/ui.module.scss';
import s from './training.module.scss';

/** 絞り込みを出すしきい値。これ以下なら一覧のまま見渡せる */
export const FILTER_THRESHOLD = 8;

export function matchesGroup(exercise: Exercise, group: ExerciseGroup | 'all'): boolean {
  if (group === 'all') return true;
  // 補助部位でも拾う。「腕」でベンチプレスが出るのは、実際に腕を使うから
  return exercise.group === group || exercise.subGroups.some((x) => x.group === group);
}

interface Props {
  group: ExerciseGroup | 'all';
  onGroup: (group: ExerciseGroup | 'all') => void;
  /** チップに出す分類。**絞り込む前の一覧から決める**（打つたびにチップが消えないように） */
  exercises: readonly Exercise[];
}

/**
 * 種目一覧の絞り込み。マイ種目と、記録画面の「マイ種目から選ぶ」で同じものを使う。
 *
 * **部位のチップだけを、出しっぱなしにする。**
 *
 * 畳んで「フィルター」ボタンにしていた頃は、開くのに 1 回・選ぶのに 1 回で、
 * 探すたびに 2 回押していた。何で絞っているかも開くまで読めない。
 * チップは押す的であると同時に、いま何で絞っているかの表示でもある。
 *
 * 検索欄は置かない。持っている種目は多くても数十件で、部位で切れば一画面に収まる。
 * 常に置くと、押す気の無い日にも一覧が 1 段ぶん下がり、
 * 触れば iOS はキーボードを出す（探す道具として、部位のほうが速い）。
 *
 * チップは一段小さくする。語が短く、押し分けるためのものなので（`.filterRow`）。
 *
 * 部位チップは**持っている種目の分類だけ**出す。全部並べると、
 * 押しても 0 件にしかならないチップが並ぶ。
 */
export function ExerciseFilterBar({ group, onGroup, exercises }: Props) {
  const groups = EXERCISE_GROUP_ORDER.filter((g) => exercises.some((e) => matchesGroup(e, g)));

  return (
    <div className={s.filterBar}>
      {groups.length > 1 && (
        <div className={`${ui.chipRow} ${s.filterRow}`} role="group" aria-label="部位で絞り込む">
          {(['all', ...groups] as (ExerciseGroup | 'all')[]).map((g) => (
            <button
              key={g}
              type="button"
              className={ui.chip}
              aria-pressed={group === g}
              onClick={() => onGroup(g)}
            >
              {g === 'all' ? 'すべて' : GROUP_LABELS[g]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
