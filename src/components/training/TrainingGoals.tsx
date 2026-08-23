import { useState } from 'react';
import { GROUP_LABELS, GROUP_ORDER } from '../../lib/exerciseCatalog';
import { deltaTone, fmt, fmtDelta, fmtPercent } from '../../lib/format';
import { RECENT_DAYS, STALE_WEEKS } from '../../lib/training';
import type { ExerciseGoal, TrainingStats } from '../../lib/training';
import type { MuscleGroup } from '../../types';
import ui from '../../styles/ui.module.scss';
import s from './training.module.scss';

const TONE_CLASS = { good: ui.good, bad: ui.bad, flat: ui.flat } as const;

interface Props {
  goals: readonly ExerciseGoal[];
  stats: TrainingStats;
  onOpenGoals: () => void;
}

/**
 * ホームでは部位ごとの進捗までにとどめ、種目ごとの内訳は開いたときに出す。
 * 種目の数だけ進捗バーを並べると、ダッシュボードに置くには縦に長すぎる。
 *
 * 部位の進捗は、その部位の各種目の到達率の平均。
 * 到達率は単位のない 0〜1 の値なので、種目をまたいで平均しても
 * 「重量の大きい種目に支配される」問題は起きない（挙上量を足すのとは事情が違う）。
 */
export function TrainingGoals({ goals, stats, onOpenGoals }: Props) {
  const [open, setOpen] = useState<MuscleGroup | null>(null);

  if (goals.length === 0) {
    return (
      <section className={ui.card}>
        <header className={ui.cardHeader}>
          <h2 className={ui.cardTitle}>種目の目標</h2>
        </header>
        <p className={ui.emptyState}>種目の目標を決めると、ここに進捗が出ます。</p>
        <div className={ui.btnRow}>
          <button type="button" className={`${ui.btn} ${ui.btnPrimary}`} onClick={onOpenGoals}>
            目標を決める
          </button>
        </div>
      </section>
    );
  }

  const groups = GROUP_ORDER.map((group) => {
    const items = goals.filter((g) => g.group === group);
    const rates = items.map((g) => g.progress).filter((v): v is number => v != null);
    return {
      group,
      items,
      reached: items.filter((g) => g.reached).length,
      progress: rates.length ? rates.reduce((a, b) => a + b, 0) / rates.length : null,
    };
  }).filter((g) => g.items.length > 0);

  return (
    <section className={ui.card}>
      <header className={ui.cardHeader}>
        <h2 className={ui.cardTitle}>種目の目標</h2>
        <span className={ui.hint}>{goals.length}件</span>
      </header>

      {/* 更新と停滞はどちらも種目ごとの話なので、目標と同じカードに置く */}
      {(stats.recentBests > 0 || stats.stalled > 0) && (
        <div className={s.statRow} style={{ marginTop: 0, fontSize: 11 }}>
          <span>直近{RECENT_DAYS}日</span>
          <span className={s.coverCount}>
            自己最高 <b>{stats.recentBests}</b> 種目
          </span>
          <span className={s.coverCount}>
            {STALE_WEEKS}週以上動いていない <b>{stats.stalled}</b> 種目
          </span>
        </div>
      )}

      {groups.map(({ group, items, reached, progress }) => (
        <div key={group}>
          <button
            type="button"
            className={s.goalGroup}
            aria-expanded={open === group}
            onClick={() => setOpen((cur) => (cur === group ? null : group))}
          >
            <span className={s.goalGroupName}>{GROUP_LABELS[group]}</span>
            <span className={s.goalGroupCount}>
              {reached > 0 ? `${reached}/${items.length} 到達` : `${items.length}件`}
            </span>
            <span className={s.meter}>
              <span className={s.meterFill} style={{ width: `${(progress ?? 0) * 100}%` }} />
            </span>
            <span className={s.goalGroupRate}>{progress == null ? '—' : fmtPercent(progress)}</span>
          </button>

          {open === group &&
            items.map((goal) => (
              <div key={goal.exerciseId} className={s.goalDetail}>
                <div className={s.statRow}>
                  <span className={s.exName}>{goal.name}</span>
                  <b style={{ marginLeft: 'auto' }}>{fmt(goal.current, goal.digits)}</b>
                  <span>{goal.unit}</span>
                  {goal.delta != null && (
                    <span className={TONE_CLASS[deltaTone(goal.delta, false, 0)]}>
                      {fmtDelta(goal.delta, goal.digits)}
                    </span>
                  )}
                </div>

                <div className={s.meter}>
                  <div className={s.meterFill} style={{ width: `${(goal.progress ?? 0) * 100}%` }} />
                </div>

                <div className={s.goalFoot}>
                  <span>
                    目標 {fmt(goal.target, goal.digits)} {goal.unit}
                  </span>
                  <span>
                    {goal.reached ? '到達' : goal.progress == null ? '—' : fmtPercent(goal.progress)}
                  </span>
                </div>
              </div>
            ))}
        </div>
      ))}
    </section>
  );
}
