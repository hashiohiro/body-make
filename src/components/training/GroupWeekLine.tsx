import { GROUP_KEYS } from '../../lib/exerciseCatalog';
import { fmtVolume } from '../../lib/format';
import { formatSets } from '../../lib/training';
import { useWeightFormat } from '../../hooks/useWeightUnit';
import { useT } from '../../lib/i18n';
import type { GroupTarget, MuscleGroup } from '../../types';
import s from './training.module.scss';

interface Props {
  group: MuscleGroup;
  /** 見ている日の週の、この部位のセット数と挙上量（kg） */
  sets: number;
  volume: number;
  target: GroupTarget | null;
}

/**
 * 「この部位の今週」。**主部位だけ。ラベルと値の文字だけで出す**（ゲージは置かない）。
 *
 * 打ちながら「今週の胸はあと何セットか」を見たい。目標タブまで行かずに読めるように、
 * 記録のカードと入力ダイアログの両方で、今週の量を部位の目標と並べる（目標が無ければ量だけ）。
 * 挙上量の目標もあれば、その行を足す。並びは波及行（`ExerciseRipple`）と同じ「ラベル　値」。
 */
export function GroupWeekLine({ group, sets, volume, target }: Props) {
  const t = useT();
  const { label: unitLabel, conv } = useWeightFormat();
  /*
   * **いまの量に単位を付け、目標はかっこで添える**（12セット（目標 15））。
   * 「12 / 15セット」のように並べると、どちらがいまでどちらが目標か読み取れない。
   */
  const withGoal = (amount: string, goal: string | null) =>
    goal == null ? amount : t('ripple.goalOf', { amount, value: goal });
  const setsValue = withGoal(
    t('common.sets', { n: formatSets(sets) }),
    target?.sets == null ? null : String(target.sets),
  );

  return (
    <dl className={s.ripple} data-group-week>
      <div className={s.rippleRow}>
        <dt className={s.rippleLabel}>{t('ripple.groupWeek', { group: t(GROUP_KEYS[group]) })}</dt>
        <dd className={s.rippleValue}>{setsValue}</dd>
      </div>
      {target?.volume != null && (
        <div className={s.rippleRow}>
          <dt className={s.rippleLabel}>{t('metric.volume')}</dt>
          <dd className={s.rippleValue}>
            {withGoal(
              t('common.valueUnit', {
                value: fmtVolume(conv(volume)),
                // 今週（日〜土）の量なので「/週」
                unit: t('goalPeriod.perWeek', { unit: unitLabel }),
              }),
              fmtVolume(conv(target.volume)),
            )}
          </dd>
        </div>
      )}
    </dl>
  );
}
