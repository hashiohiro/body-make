import { GROUP_KEYS } from '../../lib/exerciseCatalog';
import { formatSets } from '../../lib/training';
import { useT } from '../../lib/i18n';
import type { GroupTarget, MuscleGroup } from '../../types';
import s from './training.module.scss';

interface Props {
  group: MuscleGroup;
  /** 見ている日の週の、この部位のセット数 */
  sets: number;
  target: GroupTarget | null;
}

/**
 * 「この部位の今週」。**主部位だけ。ラベルと値の文字だけで出す**（ゲージは置かない）。
 *
 * 打ちながら「今週の胸はあと何セットか」を見たい。目標タブまで行かずに読めるように、
 * 記録のカードと入力ダイアログの両方で、今週の量を部位の目標と並べる（目標が無ければ量だけ）。
 * 並びは波及行（`ExerciseRipple`）と同じ「ラベル　値」。
 *
 * **部位の挙上量の行は置かない。**「挙上量 1,800 kg/週（目標 2,000）」は胸の今週の合計
 * （ほかの種目・補助部位の係数ぶんも入る）なのに、この種目の値に見えた。種目の画面で
 * 目標と並べるのは種目の目標（`ExerciseGoalLine`）。部位の挙上量は目標の画面が持つ
 * （2026/10/10、利用者の指摘）。
 */
export function GroupWeekLine({ group, sets, target }: Props) {
  const t = useT();
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
    <dl className={s.ripple} data-group-week data-e2e="group-week">
      <div className={s.rippleRow}>
        <dt className={s.rippleLabel}>{t('ripple.groupWeek', { group: t(GROUP_KEYS[group]) })}</dt>
        <dd className={s.rippleValue}>{setsValue}</dd>
      </div>
    </dl>
  );
}

/** 丸を並べる上限。超えたぶんは丸を増やさない（カードの幅に収める） */
const MAX_DOTS = 20;

/**
 * 記録のカードの「この部位の今週」。**数字ではなく丸の数で見せる**（2026/10/10、利用者の指摘）。
 *
 * 部位の目標のセット数だけ丸を並べ、やったぶんを塗る。届いたら塗りの色が変わる。
 * 目標が無ければ、やったぶんだけを塗って並べる。正確な数は読み上げと入力ダイアログが持つ。
 * 補助部位の係数で半端（1.5 セット）になるので、塗るのは切り捨てた数。
 */
export function GroupWeekDots({ group, sets, target }: Props) {
  const t = useT();
  const goal = target?.sets ?? null;
  const total = Math.min(MAX_DOTS, goal ?? Math.ceil(sets));
  const filled = Math.min(total, Math.floor(sets));
  const reached = goal != null && sets >= goal;
  const value =
    goal == null
      ? t('common.sets', { n: formatSets(sets) })
      : t('ripple.goalOf', {
          amount: t('common.sets', { n: formatSets(sets) }),
          value: String(goal),
        });

  return (
    <div className={s.meterRow} data-group-week data-e2e="group-week">
      <span className={s.meterLabel} aria-hidden="true">
        {t(GROUP_KEYS[group])}
      </span>
      <span
        className={`${s.dots} ${reached ? s.dotsReached : ''}`}
        role="img"
        aria-label={t('card.groupWeekOf', { group: t(GROUP_KEYS[group]), value })}
      >
        {/* 5 つごとに間を空ける。目標まであといくつかを数えやすくする */}
        {Array.from({ length: Math.ceil(total / 5) }, (_, g) => (
          <span key={g} className={s.dotGroup}>
            {Array.from({ length: Math.min(5, total - g * 5) }, (_, j) => {
              const i = g * 5 + j;
              return <i key={i} className={i < filled ? s.dotOn : s.dot} />;
            })}
          </span>
        ))}
      </span>
      {/* 丸だけでは数えにくい（2026/10/10、利用者の指摘）。右端に数を添える */}
      <span className={s.meterEnd} aria-hidden="true">
        {goal == null
          ? t('common.sets', { n: formatSets(sets) })
          : t('card.setsOfGoal', { n: formatSets(sets), goal })}
      </span>
    </div>
  );
}
