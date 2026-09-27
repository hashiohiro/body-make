import { useT } from '../../lib/i18n';
import s from './training.module.scss';

/** 種目の目標の線の記号（`GoalTrack`）。形は体組成側のペースとそろえる（いま＝丸、目標＝ひし形） */
export function GoalLegend() {
  const t = useT();
  return (
    <div className={s.goalLegend} aria-hidden="true">
      <span>
        <svg width={10} height={10} viewBox="0 0 10 10">
          <circle cx={5} cy={5} r={3.5} fill="none" stroke="var(--ink-muted)" strokeWidth={1.5} />
        </svg>
        {t('exGoal.legendStart')}
      </span>
      <span>
        <svg width={10} height={10} viewBox="0 0 10 10">
          <circle cx={5} cy={5} r={4} fill="var(--s-weight)" />
        </svg>
        {t('goalEditor.now')}
      </span>
      <span>
        <svg width={10} height={10} viewBox="0 0 10 10">
          <line x1={5} y1={1} x2={5} y2={9} stroke="var(--ink-2)" strokeWidth={2} />
        </svg>
        {t('detail.best')}
      </span>
      <span>
        <svg width={10} height={10} viewBox="0 0 10 10">
          <path d="M5 1.5L8.5 5L5 8.5L1.5 5Z" fill="none" stroke="var(--ink)" strokeWidth={1.5} />
        </svg>
        {t('common.goal')}
      </span>
    </div>
  );
}

/** 到達の数を輪で出す。数字は隣に必ず並べる（輪だけでは何件中かが読めない） */
export function ReachedRing({ done, total }: { done: number; total: number }) {
  const r = 7;
  const circ = 2 * Math.PI * r;
  const ratio = total > 0 ? done / total : 0;
  return (
    <svg width={18} height={18} viewBox="0 0 18 18" aria-hidden="true">
      <circle cx={9} cy={9} r={r} fill="none" stroke="var(--border)" strokeWidth={3} />
      {ratio > 0 && (
        <circle
          cx={9}
          cy={9}
          r={r}
          fill="none"
          stroke="var(--good-text)"
          strokeWidth={3}
          strokeDasharray={`${circ * ratio} ${circ}`}
          strokeLinecap="round"
          transform="rotate(-90 9 9)"
        />
      )}
    </svg>
  );
}
