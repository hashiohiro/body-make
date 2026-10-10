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

/** 丸を並べる上限（3 行）。それより多い週は丸を増やさず、右端の数が持つ */
const MAX_DOTS = 30;

/**
 * 記録のカードの「この部位の今週」。**数字ではなく丸の数で見せる**（2026/10/10、利用者の指摘）。
 *
 * 部位の目標のセット数だけ丸を並べ、やったぶんを塗る。届いたら塗りの色が変わる。
 * **目標を超えたぶんも丸を足して塗る**（超えた量が見える。2026/10/10、利用者の指摘）。
 * 目標が無ければ、やったぶんだけを塗って並べる。正確な数は右端の数と読み上げが持つ。
 * 補助部位の係数で半端（1.5 セット）になるので、塗るのは切り捨てた数。
 */
export function GroupWeekDots({ group, sets, target }: Props) {
  const t = useT();
  const goal = target?.sets ?? null;
  const total = Math.min(MAX_DOTS, Math.max(goal ?? 0, Math.ceil(sets)));
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
    <div
      className={s.meterRow}
      data-e2e="group-week"
      data-e2e-key={group}
      data-e2e-state={reached ? 'reached' : 'open'}
    >
      {/* 部位の名前だけではセット数と伝わらない（2026/10/10、利用者の指摘） */}
      <span className={s.meterLabel} aria-hidden="true">
        {t('card.setsOfGroup', { group: t(GROUP_KEYS[group]) })}
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
