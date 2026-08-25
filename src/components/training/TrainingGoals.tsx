import { useState } from 'react';
import { Modal } from '../Modal';
import { GoalEditor } from './GoalEditor';
import { GROUP_LABELS, GROUP_ORDER } from '../../lib/exerciseCatalog';
import { deltaTone, fmt, fmtDelta, fmtPercent } from '../../lib/format';
import { RECENT_DAYS, STALE_WEEKS } from '../../lib/training';
import type { ExerciseGoal, TrainingStats } from '../../lib/training';
import type { Exercise, MuscleGroup, SessionPoint } from '../../types';
import ui from '../../styles/ui.module.scss';
import s from './training.module.scss';

const TONE_CLASS = { good: ui.good, bad: ui.bad, flat: ui.flat } as const;

interface Props {
  goals: readonly ExerciseGoal[];
  stats: TrainingStats;
  exercises: readonly Exercise[];
  /** 目標を決めるときに「いま」と「過去最大」を出すために使う */
  sessions: readonly SessionPoint[];
  onUpdate: (exercise: Exercise) => void;
  onOpenTrend: (exerciseId: string) => void;
}

/**
 * 種目ごとの目標と、その進捗。
 *
 * 部位ごとの進捗までを畳んだ形で出し、種目ごとの内訳は開いたときに出す。
 * 種目の数だけ進捗バーを並べると、縦に長すぎる。
 *
 * 部位の進捗は、その部位の各種目の到達率の平均。
 * 到達率は単位のない 0〜1 の値なので、種目をまたいで平均しても
 * 「重量の大きい種目に支配される」問題は起きない（挙上量を足すのとは事情が違う）。
 *
 * ここに種目マスタの一覧は出さない。出るのは目標を持つ種目だけで、
 * 種目そのものの追加と詳細設定は設定タブの仕事。
 */
export function TrainingGoals({ goals, stats, exercises, sessions, onUpdate, onOpenTrend }: Props) {
  const [open, setOpen] = useState<MuscleGroup | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);

  const byId = new Map(exercises.map((e) => [e.id, e]));
  const withoutGoal = [...exercises]
    .filter((e) => e.goal == null)
    .sort((a, b) => a.order - b.order);
  const pickedExercise = picked ? byId.get(picked) : null;

  const closeAdding = () => {
    setAdding(false);
    setPicked(null);
  };

  const addButton = (
    <div className={ui.btnRow}>
      <button
        type="button"
        className={`${ui.btn} ${goals.length === 0 ? ui.btnPrimary : ''}`}
        disabled={exercises.length === 0}
        onClick={() => setAdding(true)}
      >
        ＋ 種目に目標を決める
      </button>
    </div>
  );

  const addModal = adding && (
    <Modal open title="種目に目標を決める" onClose={closeAdding}>
      {pickedExercise ? (
        <div>
          <div className={s.pickerLabel}>{pickedExercise.name}</div>
          <GoalEditor exercise={pickedExercise} sessions={sessions} onUpdate={onUpdate} />
          <div className={ui.btnRow}>
            <button
              type="button"
              className={`${ui.btn} ${ui.btnGhost} ${ui.btnSm}`}
              onClick={() => setPicked(null)}
            >
              ‹ 他の種目を選ぶ
            </button>
          </div>
        </div>
      ) : withoutGoal.length === 0 ? (
        <p className={ui.note}>すべての種目に目標を決めています。</p>
      ) : (
        <div>
          {GROUP_ORDER.map((group) => {
            const items = withoutGoal.filter((e) => e.group === group);
            if (items.length === 0) return null;
            return (
              <div key={group} className={s.pickerGroup}>
                <div className={s.pickerLabel}>{GROUP_LABELS[group]}</div>
                <div className={s.pickerList}>
                  {items.map((e) => (
                    <button
                      key={e.id}
                      type="button"
                      className={s.pickerBtn}
                      onClick={() => setPicked(e.id)}
                    >
                      {e.name}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );

  if (goals.length === 0) {
    return (
      <section className={ui.card}>
        <header className={ui.cardHeader}>
          <h2 className={ui.cardTitle}>種目の目標</h2>
        </header>
        <p className={ui.emptyState}>
          {exercises.length === 0
            ? '種目がありません。記録タブか設定から追加すると、目標を決められます。'
            : '種目の目標を決めると、ここに進捗が出ます。'}
        </p>
        {addButton}
        {addModal}
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
            items.map((goal) => {
              const exercise = byId.get(goal.exerciseId);
              const editingThis = editing === goal.exerciseId;

              return (
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
                    <div
                      className={s.meterFill}
                      style={{ width: `${(goal.progress ?? 0) * 100}%` }}
                    />
                  </div>

                  <div className={s.goalFoot}>
                    <span>
                      目標 {fmt(goal.target, goal.digits)} {goal.unit}
                    </span>
                    <span>
                      {goal.reached
                        ? '到達'
                        : goal.progress == null
                          ? '—'
                          : fmtPercent(goal.progress)}
                    </span>
                  </div>

                  <div className={s.goalActions}>
                    {/* 目標の隣に推移への入口を置く。伸びの中身は推移の側が持っている */}
                    <button
                      type="button"
                      className={s.miniBtn}
                      onClick={() => onOpenTrend(goal.exerciseId)}
                    >
                      推移を見る
                    </button>
                    {exercise && (
                      <button
                        type="button"
                        className={s.miniBtn}
                        aria-expanded={editingThis}
                        aria-label={`${goal.name}の目標を変更`}
                        onClick={() => setEditing(editingThis ? null : goal.exerciseId)}
                      >
                        変更
                      </button>
                    )}
                  </div>

                  {editingThis && exercise && (
                    <GoalEditor exercise={exercise} sessions={sessions} onUpdate={onUpdate} />
                  )}
                </div>
              );
            })}
        </div>
      ))}

      {addButton}
      {addModal}
    </section>
  );
}
