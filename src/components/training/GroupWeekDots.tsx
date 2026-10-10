import type { CSSProperties } from 'react';
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
 *
 * 補助部位の係数で半端（1.5 セット）になる。**端数は 1/4 単位で欠けた丸**にする。
 * 「まだ」の色（地）を出すのは目標に届いていない丸だけ——目標を超えた先の端数や、
 * 目標の無い部位の端数は、塗ったぶんだけを描いて残りは空ける（2026/10/10、利用者の指摘：
 * 届いているのに端数の丸が「まだ」に見えた）。
 */
export function GroupWeekDots({ group, sets, target }: Props) {
  const t = useT();
  const goal = target?.sets ?? null;
  const quarters = Math.round(sets * 4) / 4;
  const total = Math.min(MAX_DOTS, Math.max(goal ?? 0, Math.ceil(quarters)));
  const reached = goal != null && sets >= goal;
  /** i 番目の丸の塗り（0・0.25・0.5・0.75・1） */
  const fillOf = (i: number) => Math.min(1, Math.max(0, quarters - i));
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
              const fill = fillOf(i);
              if (fill === 1) return <i key={i} className={s.dotOn} />;
              // 目標の内側だけが「まだ」。外側の端数は残りを空ける
              const open = goal != null && i < goal;
              if (fill === 0) return <i key={i} className={s.dot} />;
              return (
                <i
                  key={i}
                  className={open ? s.dotPart : s.dotPartOver}
                  style={{ '--fill': `${fill * 360}deg` } as CSSProperties}
                />
              );
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
