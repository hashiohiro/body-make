import { useEffect, useState } from 'react';
import { ExerciseSummaryCard } from './ExerciseSummaryCard';
import { GoalEditor } from './GoalEditor';
import { Modal } from '../Modal';
import { NumericInput } from '../NumericInput';
import { GROUP_LABELS, GROUP_ORDER } from '../../lib/exerciseCatalog';
import { deltaTone, fmt, fmtDelta, fmtPercent } from '../../lib/format';
import { GROUP_GOAL_RANGE } from '../../lib/storage';
import { RECENT_DAYS, STALE_WEEKS, formatSets } from '../../lib/training';
import type { ExerciseGoal, TrainingStats } from '../../lib/training';
import type { Exercise, GroupGoals, MuscleGroup, SessionPoint } from '../../types';
import ui from '../../styles/ui.module.scss';
import s from './training.module.scss';

const TONE_CLASS = { good: ui.good, bad: ui.bad, flat: ui.flat } as const;

/**
 * 週のセット数の目安。押すと 6 部位すべてに入り、そのあと部位ごとに変えられる。
 *
 * 部位ごとに違う数字を配らず、どこも同じ値にしてある。
 * 補助部位は係数ぶんで数えるので、腕や肩はプレスや懸垂から自然に積み上がる。
 * こちらで部位ごとの上下を決めると、その積み上がりと二重に効いてしまう。
 */
const PRESETS: { label: string; sets: number | null }[] = [
  { label: '少なめ 8', sets: 8 },
  { label: '標準 12', sets: 12 },
  { label: '多め 16', sets: 16 },
  { label: '決めない', sets: null },
];

interface Props {
  goals: readonly ExerciseGoal[];
  groupGoals: GroupGoals;
  stats: TrainingStats;
  exercises: readonly Exercise[];
  /** 目標を決めるときに「いま」と「過去最大」を出すために使う */
  sessions: readonly SessionPoint[];
  onSetGroupGoal: (group: MuscleGroup, value: number | null) => void;
  onUpdate: (exercise: Exercise) => void;
  onOpenTrend: (exerciseId: string) => void;
  /** 外から名指しで開く種目（マイ種目の行から飛んできたとき） */
  focusExerciseId?: string | null;
  /** 開き終わったら知らせる。同じ指名で開き直さないため */
  onFocusDone?: (() => void) | undefined;
}

/**
 * トレーニングの目標。**軸は部位ひとつ。**
 *
 * 以前は「週の部位別セット数」と「種目の目標」を別のカードに置いていた。
 * 同じ部位という軸を 2 度並べたうえに、どちらの行も片側の事実しか持たず、
 * 部位の状態を知るのに 2 枚を往復することになっていた。
 *
 * 1 行に **量（今週のセット数 ÷ 目標）と強さ（その部位の種目目標の到達数）** を並べる。
 * 6 部位すべてを常に出すので、決めていない部位は欠けとして見える。
 *
 * 決めるのはダイアログの中。行はあくまで俯瞰で、
 * 週のセット数も種目の目標も、その部位を開いた先で完結させる。
 *
 * **実績（今週のセット数）をここに出す。** 以前は「実績はホームのヒートマップが持つ」
 * として目標だけを置いていたが、種目の目標は初めから「いま」を並べていた
 * （決めるには現在地が要る）。部位にも同じ規則を当てる。
 * ヒートマップは週をまたいだ配分の推移、こちらは今週 1 週ぶん、と役割で分ける。
 */
export function TrainingGoalBoard({
  goals,
  groupGoals,
  stats,
  exercises,
  sessions,
  onSetGroupGoal,
  onUpdate,
  onOpenTrend,
  focusExerciseId = null,
  onFocusDone,
}: Props) {
  const [open, setOpen] = useState<MuscleGroup | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);

  const byId = new Map(exercises.map((e) => [e.id, e]));

  const closeGroup = () => {
    setOpen(null);
    setEditing(null);
    setPicked(null);
    setPicking(false);
  };

  /*
   * 名指しで開く（マイ種目の行から）。その種目の部位を開いて、
   * すでに目標があればその行の編集を、まだ無ければ決めるところを開く。
   */
  useEffect(() => {
    if (focusExerciseId == null) return;
    const exercise = exercises.find((e) => e.id === focusExerciseId);
    if (exercise) {
      setOpen(exercise.group);
      if (exercise.goal) {
        setEditing(focusExerciseId);
        setPicked(null);
        setPicking(false);
      } else {
        setEditing(null);
        setPicked(focusExerciseId);
        setPicking(true);
      }
    }
    onFocusDone?.();
  }, [focusExerciseId, exercises, onFocusDone]);

  const totalSets = GROUP_ORDER.reduce((sum, g) => sum + stats.thisWeekSetsByGroup[g], 0);

  const rows = GROUP_ORDER.map((group) => {
    const items = goals.filter((g) => g.group === group);
    const target = groupGoals[group];
    const sets = stats.thisWeekSetsByGroup[group];
    const days = stats.daysSinceGroup[group];
    return {
      group,
      items,
      target,
      sets,
      days,
      reached: items.filter((g) => g.reached).length,
      /** 量の進捗。目標を決めていない部位は出さない（割る相手がない） */
      progress: target == null ? null : Math.min(1, sets / target),
    };
  });

  const current = open == null ? null : rows.find((r) => r.group === open)!;
  const pickedExercise = picked ? byId.get(picked) : null;
  /** その部位の、まだ目標を持たない種目 */
  const withoutGoal =
    current == null
      ? []
      : exercises
          .filter((e) => e.group === current.group && e.goal == null)
          .sort((a, b) => a.order - b.order);

  return (
    <section className={ui.card}>
      <header className={ui.cardHeader}>
        <h2 className={ui.cardTitle}>トレーニングの目標</h2>
        <span className={ui.hint}>
          今週 {stats.thisWeekDays}日 ・ {formatSets(totalSets)}セット
        </span>
      </header>

      {/*
        6 部位ぶんの数字を最初から入れさせない。
        「胸は何セットが妥当か」は始めたばかりの人には決めようがないので、
        まとめて入る目安を先に置き、部位ごとの調整は開いた先でやる
      */}
      <div className={`${ui.chipRow} ${s.presetRow}`} role="group" aria-label="目安から決める">
        {PRESETS.map((preset) => (
          <button
            key={preset.label}
            type="button"
            className={ui.chip}
            onClick={() => {
              for (const group of GROUP_ORDER) onSetGroupGoal(group, preset.sets);
            }}
          >
            {preset.label}
          </button>
        ))}
      </div>

      {rows.map((row) => (
        <button
          key={row.group}
          type="button"
          className={s.boardRow}
          aria-label={`${GROUP_LABELS[row.group]}の目標`}
          onClick={() => setOpen(row.group)}
        >
          <span className={s.boardHead}>
            <span className={s.boardName}>{GROUP_LABELS[row.group]}</span>
            <span className={s.boardSets}>
              {formatSets(row.sets)}
              {row.target == null ? ' セット' : ` / ${row.target} セット`}
            </span>
            <span className={s.chevron} aria-hidden="true">
              ›
            </span>
          </span>

          <span className={s.boardFoot}>
            <span className={s.meter}>
              <span className={s.meterFill} style={{ width: `${(row.progress ?? 0) * 100}%` }} />
            </span>
            <span className={s.boardStatus}>
              {row.items.length > 0
                ? `種目 ${row.reached}/${row.items.length} 到達`
                : row.days == null
                  ? '記録なし'
                  : `${row.days}日空き`}
            </span>
          </span>
        </button>
      ))}

      {/* 更新と停滞はどちらも種目ごとの話。部位の行には出せないので、下にまとめる */}
      {(stats.recentBests > 0 || stats.stalled > 0) && (
        <div className={s.statRow} style={{ fontSize: 11 }}>
          <span>直近{RECENT_DAYS}日</span>
          <span className={s.coverCount}>
            自己最高 <b>{stats.recentBests}</b> 種目
          </span>
          <span className={s.coverCount}>
            {STALE_WEEKS}週以上動いていない <b>{stats.stalled}</b> 種目
          </span>
        </div>
      )}

      {current && (
        <Modal open title={`${GROUP_LABELS[current.group]}の目標`} onClose={closeGroup}>
          <div>
            {/* 量。週に何セットやるか */}
            <div className={ui.formRow}>
              <label htmlFor={`group-goal-${current.group}`}>週のセット数</label>
              <span className={ui.inputUnit}>
                <NumericInput
                  id={`group-goal-${current.group}`}
                  ariaLabel={GROUP_LABELS[current.group]}
                  value={current.target}
                  min={GROUP_GOAL_RANGE[0]}
                  max={GROUP_GOAL_RANGE[1]}
                  step={1}
                  placeholder="—"
                  onCommit={(v) => onSetGroupGoal(current.group, v == null ? null : Math.round(v))}
                />
                <span>セット</span>
              </span>
            </div>

            <p className={ui.note}>
              今週 {formatSets(current.sets)} セット
              {current.days == null
                ? ' ・ この部位の記録はまだありません'
                : current.days === 0
                  ? ' ・ 今日やりました'
                  : ` ・ 最後にやってから ${current.days}日`}
              。補助部位は既定で 0.5 セットとして数えます。
            </p>

            {/* 強さ。その部位の種目ごとの目標 */}
            <div className={s.pickerLabel}>種目の目標</div>

            {current.items.length === 0 ? (
              <p className={ui.emptyState}>この部位の種目には、まだ目標がありません。</p>
            ) : (
              current.items.map((goal) => {
                const exercise = byId.get(goal.exerciseId);
                const editingThis = editing === goal.exerciseId;

                return (
                  <ExerciseSummaryCard
                    key={goal.exerciseId}
                    name={goal.name}
                    goal={`${fmt(goal.target, goal.digits)} ${goal.unit}`}
                    progress={goal.progress ?? 0}
                    factLeft={
                      <>
                        いま {fmt(goal.current, goal.digits)} {goal.unit}
                        {goal.delta != null && (
                          <span className={TONE_CLASS[deltaTone(goal.delta, false, 0)]}>
                            {' '}
                            {fmtDelta(goal.delta, goal.digits)}
                          </span>
                        )}
                      </>
                    }
                    /*
                      何の割合かを書く。数字だけだと、いまの値なのか目標なのか読めない
                      （マイ種目の「目標 100kg」と同じ作法）。到達済みは割合より事実が強い
                    */
                    factRight={
                      goal.reached
                        ? '到達'
                        : `到達率 ${goal.progress == null ? '—' : fmtPercent(goal.progress)}`
                    }
                    actions={
                      <>
                        {/* 目標の隣に推移への入口を置く。伸びの中身は推移の側が持っている */}
                        <button
                          type="button"
                          className={s.miniBtn}
                          onClick={() => {
                            closeGroup();
                            onOpenTrend(goal.exerciseId);
                          }}
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
                      </>
                    }
                  >
                    {editingThis && exercise && (
                      <GoalEditor exercise={exercise} sessions={sessions} onUpdate={onUpdate} />
                    )}
                  </ExerciseSummaryCard>
                );
              })
            )}

            {/* 追加も部位の中。決めたい部位はもう選び終わっている */}
            {picking && pickedExercise ? (
              <div className={s.itemCard}>
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
            ) : picking ? (
              <div className={s.pickerGroup}>
                {withoutGoal.length === 0 ? (
                  <p className={ui.note}>この部位の種目には、すべて目標を決めています。</p>
                ) : (
                  <div className={s.pickerList}>
                    {withoutGoal.map((e) => (
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
                )}
                <div className={ui.btnRow}>
                  <button
                    type="button"
                    className={`${ui.btn} ${ui.btnGhost} ${ui.btnSm}`}
                    onClick={() => setPicking(false)}
                  >
                    やめる
                  </button>
                </div>
              </div>
            ) : (
              <div className={ui.btnRow}>
                <button
                  type="button"
                  className={`${ui.btn} ${current.items.length === 0 ? ui.btnPrimary : ''}`}
                  disabled={exercises.every((e) => e.group !== current.group)}
                  onClick={() => setPicking(true)}
                >
                  ＋ {GROUP_LABELS[current.group]}の種目に目標を決める
                </button>
              </div>
            )}

            {exercises.every((e) => e.group !== current.group) && (
              <p className={ui.note}>
                この部位の種目がマイ種目にありません（設定 &gt; トレーニング &gt; マイ種目）。
              </p>
            )}
          </div>
        </Modal>
      )}
    </section>
  );
}
