import { useState } from 'react';
import { ExerciseDetailDialog } from './ExerciseDetailDialog';
import { ExerciseSettingsForm } from './ExerciseSettingsForm';
import { ExerciseSummaryCard } from './ExerciseSummaryCard';
import { GoalEditor } from './GoalEditor';
import { Modal } from '../Modal';
import { NumericInput } from '../NumericInput';
import { GROUP_LABELS, GROUP_ORDER, goalTypeLabel, isCardio } from '../../lib/exerciseCatalog';
import { deltaTone, fmt, fmtDelta, fmtPercent } from '../../lib/format';
import { GROUP_GOAL_RANGE } from '../../lib/storage';
import { addDays, formatMD, startOfWeek, todayISO } from '../../lib/date';
import { RECENT_DAYS, STALE_WEEKS, formatSets } from '../../lib/training';
import type { ExerciseGoal, TrainingStats } from '../../lib/training';
import type { Exercise, ExerciseGroup, GroupGoals, MuscleGroup, SessionPoint } from '../../types';
import ui from '../../styles/ui.module.scss';
import s from './training.module.scss';

const TONE_CLASS = { good: ui.good, bad: ui.bad, flat: ui.flat } as const;

/** 最終実施からの日数の言い方。回復ダイアログと同じ語彙を使う */
function lastDoneLabel(days: number | null): string {
  if (days == null) return '記録なし';
  if (days === 0) return '前回 今日';
  if (days === 1) return '前回 昨日';
  return `前回 ${days}日前`;
}

/**
 * 週のセット数の目安。開いている部位にだけ入る。
 *
 * 「胸は何セットが妥当か」は始めたばかりの人には決めようがないので、
 * 打つ前に押せる値を並べておく。値は部位ごとに変えていない。
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
}: Props) {
  const [open, setOpen] = useState<ExerciseGroup | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  /** 推移を開いている種目。部位のダイアログの上に重ねる（閉じると元の面に戻る） */
  const [trendOf, setTrendOf] = useState<string | null>(null);
  /** 種目そのものの設定を開いている種目。目標とは同時に開かない */
  const [settingsOf, setSettingsOf] = useState<string | null>(null);
  /** 部位目標の設定を開いているか。種目の設定と同じく面を差し替える */
  const [editingGroupGoal, setEditingGroupGoal] = useState(false);

  const byId = new Map(exercises.map((e) => [e.id, e]));

  const closeGroup = () => {
    setOpen(null);
    setEditing(null);
    setSettingsOf(null);
    setEditingGroupGoal(false);
    setPicked(null);
    setPicking(false);
  };

  const editingExercise = editing ? (byId.get(editing) ?? null) : null;
  const settingsExercise = settingsOf ? (byId.get(settingsOf) ?? null) : null;

  /** 部位の面へ戻す。深い面では、右上のボタンがこれになる */
  const backToGroup = () => {
    setEditing(null);
    setSettingsOf(null);
    setEditingGroupGoal(false);
  };

  /** 面ごとに見出しを変える。いまどこを触っているのかを、上に出しておく */
  const dialogTitle = (group: ExerciseGroup) =>
    editingExercise
      ? `${editingExercise.name}の目標`
      : settingsExercise
        ? `${settingsExercise.name}の設定`
        : editingGroupGoal
          ? `${GROUP_LABELS[group]}の部位目標`
          : `${GROUP_LABELS[group]}の目標`;

  const totalSets = GROUP_ORDER.reduce((sum, g) => sum + stats.thisWeekSetsByGroup[g], 0);
  const thisWeekStart = startOfWeek(todayISO());
  const thisWeekEnd = addDays(thisWeekStart, 6);

  /*
   * 有酸素の今週。**距離は種目をまたいで足さない**（走った 10km と漕いだ 30km を
   * 足した 40km に読み方がない／§11-18）。足せるのは回数と時間まで。
   * 距離と速度は種目ごとの話なので、種目の詳細ダイアログが持つ。
   */
  const cardioWeek = (() => {
    const days = new Set<string>();
    let minutes = 0;
    for (const session of sessions) {
      if (session.date < thisWeekStart || session.date > thisWeekEnd) continue;
      for (const point of session.exercises) {
        if (!isCardio(point.group)) continue;
        days.add(session.date);
        minutes += point.minutes ?? 0;
      }
    }
    return { days: days.size, minutes: Math.round(minutes) };
  })();

  const cardioRow = {
    group: 'cardio' as const,
    items: goals.filter((g) => g.group === 'cardio'),
    days: stats.daysSinceCardio,
  };

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
      /** 先週の実績。今週が 0 のときだけ添える（週替わりで空になったことを示す） */
      lastWeek: stats.lastWeekSetsByGroup[group],
      /** 量の進捗。目標を決めていない部位は出さない（割る相手がない） */
      progress: target == null ? null : Math.min(1, sets / target),
    };
  });

  /**
   * 開いている面。**muscle が null なら部位ではない（有酸素）。**
   * 部位目標・週のセット数・補助部位の話はそこでは出さない。
   */
  const current =
    open == null
      ? null
      : open === 'cardio'
        ? {
            group: 'cardio' as ExerciseGroup,
            muscle: null,
            items: cardioRow.items,
            days: cardioRow.days,
            target: null as number | null,
            sets: 0,
            progress: null as number | null,
          }
        : (() => {
            const row = rows.find((r) => r.group === open)!;
            return { ...row, group: row.group as ExerciseGroup, muscle: row.group };
          })();
  const pickedExercise = picked ? byId.get(picked) : null;
  /** その部位の、まだ目標を持たない種目 */
  const withoutGoal =
    current == null
      ? []
      : exercises
          // 非表示の種目には目標を足さない（一覧にも出ない）
          .filter((e) => !e.hidden && e.group === current.group && e.goal == null)
          .sort((a, b) => a.order - b.order);

  return (
    <section className={ui.card}>
      <header className={ui.cardHeader}>
        <h2 className={ui.cardTitle}>トレーニングの目標</h2>
        <span className={ui.hint}>
          今週 {stats.thisWeekDays}日 ・ {formatSets(totalSets)}セット
        </span>
      </header>

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
            {/*
              最終実施からの日数。「4日空き」は余裕があるようにも読めるので、
              いつやったかをそのまま書く。回復ダイアログと同じ言い方にそろえる
            */}
            <span className={s.boardStatus}>{lastDoneLabel(row.days)}</span>
            <span className={s.chevron} aria-hidden="true">
              ›
            </span>
          </span>

          {/*
            **2 つを同じ形で並べない。**
            今週のセット数は日曜に 0 へ戻り、種目の目標は週をまたいで積み上がる。
            時間軸の違うものを同じメーターで隣に置くと、片方が毎週 0 になるのが故障に見える。
            名前で何を数えているかを言い、量だけにバーを付ける。
          */}
          <span className={s.boardLine}>
            <span className={s.boardLabel}>今週のセット数</span>
            <span className={s.boardValue}>
              {formatSets(row.sets)}
              {row.target == null ? ' セット（目標なし）' : ` / ${row.target} セット`}
              {/* 週替わりで空になっただけ、と分かるように */}
              {row.sets === 0 && row.lastWeek > 0 && (
                <span className={s.boardRef}> · 先週 {formatSets(row.lastWeek)}</span>
              )}
            </span>
          </span>

          <span className={s.boardLine}>
            <span className={s.boardLabel}>種目の目標</span>
            <span className={s.boardValue}>
              {row.items.length === 0 ? '未設定' : `${row.reached} / ${row.items.length} 到達`}
            </span>
          </span>
        </button>
      ))}

      {/*
        有酸素は部位ではないので、**週のセット数も部位目標も持たない。**
        代わりに出すのは回数と時間で、これは種目をまたいでも足せる量。
        行が出るのは有酸素の種目を持っているときだけ（持たない人に空の行を見せない）。
      */}
      {exercises.some((e) => isCardio(e.group) && !e.hidden) && (
        <button
          type="button"
          className={s.boardRow}
          aria-label={`${GROUP_LABELS.cardio}の目標`}
          onClick={() => setOpen('cardio')}
        >
          <span className={s.boardHead}>
            <span className={s.boardName}>{GROUP_LABELS.cardio}</span>
            <span className={s.boardStatus}>{lastDoneLabel(cardioRow.days)}</span>
            <span className={s.chevron} aria-hidden="true">
              ›
            </span>
          </span>

          <span className={s.boardLine}>
            <span className={s.boardLabel}>今週</span>
            <span className={s.boardValue}>
              {cardioWeek.days}回 / {cardioWeek.minutes}分
            </span>
          </span>

          <span className={s.boardLine}>
            <span className={s.boardLabel}>種目の目標</span>
            <span className={s.boardValue}>
              {cardioRow.items.length === 0
                ? '未設定'
                : `${cardioRow.items.filter((g) => g.reached).length} / ${cardioRow.items.length} 到達`}
            </span>
          </span>
        </button>
      )}

      <p className={ui.note}>
        <b>今週のセット数</b>は日曜に 0 へ戻ります（今週は {formatMD(thisWeekStart)} 〜{' '}
        {formatMD(thisWeekEnd)}）。<b>種目の目標</b>は週をまたいで積み上がります。
      </p>

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

      {/*
        推移も**ダイアログで重ねる。** 画面ごと移ってしまうと、閉じたときに戻るのは
        目標の一覧で、開いていた部位の面ではない。見ていた場所に戻れるようにする。
      */}
      <ExerciseDetailDialog
        open={trendOf != null}
        onClose={() => setTrendOf(null)}
        exercise={exercises.find((e) => e.id === trendOf) ?? null}
        sessions={sessions}
        from={sessions[0]?.date ?? todayISO()}
      />

      {current && (
        <Modal
          open
          title={dialogTitle(current.group)}
          onClose={closeGroup}
          onBack={editingExercise || settingsExercise || editingGroupGoal ? backToGroup : undefined}
        >
          {/*
            目標も設定も、カードの中で展開せず**同じダイアログの面を差し替える**。
            展開すると開くたびに下の種目が押し下げられ、次に押したい場所が動く。
            同じ作業（この部位の目標を決める）の続きなので、重ねずに差し替えて戻る。
          */}
          {editingExercise ? (
            <div>
              <GoalEditor exercise={editingExercise} sessions={sessions} onUpdate={onUpdate} />
            </div>
          ) : settingsExercise ? (
            <div>
              <ExerciseSettingsForm exercise={settingsExercise} onUpdate={onUpdate} />
            </div>
          ) : editingGroupGoal ? (
            /*
              **部位目標の設定の面。** 種目の設定（ExerciseSettingsForm）と同じ扱いで、
              入口を押すと面を差し替える。
              決める作業のあいだ、その部位の種目一覧が下にあると
              「どれを触ればいいのか」が 2 つ見えてしまう。
            */
            <div>
              {/*
                打つ前に押せる値を先に置く。効くのは開いている部位だけで、
                ほかの部位は動かさない（1 か所を開いているのに 6 か所が変わると驚く）
              */}
              <div className={ui.chipRow} role="group" aria-label="目安から決める">
                {PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    className={ui.chip}
                    aria-pressed={current.target === preset.sets}
                    onClick={() => current.muscle && onSetGroupGoal(current.muscle, preset.sets)}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

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
                    onCommit={(v) =>
                      current.muscle &&
                      onSetGroupGoal(current.muscle, v == null ? null : Math.round(v))
                    }
                  />
                  <span>セット</span>
                </span>
              </div>

              {/* 決めた値がいまの実績にどう当たるかを、同じ面で見せる */}
              {current.target != null && (
                <span className={s.meter}>
                  <span
                    className={s.meterFill}
                    style={{ width: `${(current.progress ?? 0) * 100}%` }}
                  />
                </span>
              )}

              <p className={ui.note}>
                今週 {formatSets(current.sets)} セット。補助部位は既定で 0.5 セットとして数えます。
                この値は日曜に 0 へ戻ります。
              </p>
            </div>
          ) : (
            <div>
              {/*
                部位の概要。**決めるのは 1 段先の面**にして、この面は読むことに専念させる。
                入力欄をここに置くと、種目一覧と並んで「どれを触るのか」が 2 つ見える。
                種目カードが「目標 / 設定」で面を差し替えるのと同じ作法にそろえる。
              */}
              {/*
                表示部。読むためのもので、押す場所ではない。
                区切り線はここには引かない（部位目標のかたまりは設定ボタンまで続く）
              */}
              <div className={s.groupSummary}>
                <span>{current.muscle ? '今週のセット数' : '今週'}</span>
                <span className={s.boardValue}>
                  {current.muscle ? (
                    <>
                      {formatSets(current.sets)}
                      {current.target == null
                        ? ' セット（目標なし）'
                        : ` / ${current.target} セット`}
                    </>
                  ) : (
                    `${cardioWeek.days}回 / ${cardioWeek.minutes}分`
                  )}
                </span>
              </div>

              {current.target != null && (
                <span className={s.meter}>
                  <span
                    className={s.meterFill}
                    style={{ width: `${(current.progress ?? 0) * 100}%` }}
                  />
                </span>
              )}

              <p className={ui.note}>
                {current.days == null
                  ? current.muscle
                    ? 'この部位の記録はまだありません'
                    : '有酸素の記録はまだありません'
                  : current.days === 0
                    ? '今日やりました'
                    : `最後にやってから ${current.days}日`}
                。
                {current.muscle
                  ? '補助部位は既定で 0.5 セットとして数えます。'
                  : /* 走った km と漕いだ km を足しても読めない（§11-18） */
                    '距離は種目ごとに見ます（種目の行から開けます）。'}
              </p>

              {/*
                **決める場所は小さいボタン 1 つ。**表示部と同じ大きさで並べると、
                どちらが読むもので どちらが押すものか分からなくなる。
                種目カードの「推移を見る / 設定」と同じ部品を使う。
              */}
              {current.muscle && (
                <div className={`${ui.btnRow} ${s.groupSummaryEnd}`}>
                  <button
                    type="button"
                    className={s.miniBtn}
                    onClick={() => setEditingGroupGoal(true)}
                  >
                    部位目標を設定
                  </button>
                </div>
              )}

              {/* 強さ。その部位の種目ごとの目標 */}
              <div className={s.pickerLabel}>種目の目標</div>

              {current.items.length === 0 ? (
                <p className={ui.emptyState}>
                  {current.muscle ? 'この部位の種目には' : '有酸素の種目には'}
                  、まだ目標がありません。
                </p>
              ) : (
                current.items.map((goal) => {
                  const exercise = byId.get(goal.exerciseId);
                  const editingThis = editing === goal.exerciseId;

                  return (
                    <ExerciseSummaryCard
                      key={goal.exerciseId}
                      name={goal.name}
                      kind={goalTypeLabel(goal.type, exercise?.repUnit ?? 'reps', true)}
                      // 維持は数値を決めないので、目標の値もメーターも出さない
                      goal={
                        goal.target == null ? null : `${fmt(goal.target, goal.digits)} ${goal.unit}`
                      }
                      progress={goal.target == null ? null : (goal.progress ?? 0)}
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
                        goal.target == null
                          ? '数値は決めない'
                          : goal.reached
                            ? '到達'
                            : `到達率 ${goal.progress == null ? '—' : fmtPercent(goal.progress)}`
                      }
                      actions={
                        <>
                          {/* 目標の隣に推移への入口を置く。伸びの中身は推移の側が持っている */}
                          <button
                            type="button"
                            className={s.miniBtn}
                            aria-label={`${goal.name}の推移を見る`}
                            onClick={() => setTrendOf(goal.exerciseId)}
                          >
                            推移を見る
                          </button>
                          {/*
                          入口はマイ種目の行と同じ並び（目標 / 設定）。同じ種目カードなのに
                          画面によってボタンの名前や数が違うと、どちらで何ができるか覚え直しになる
                        */}
                          {exercise && (
                            <>
                              <button
                                type="button"
                                className={s.miniBtn}
                                aria-pressed={editingThis}
                                aria-label={`${goal.name}の目標を変える`}
                                onClick={() => {
                                  setSettingsOf(null);
                                  setEditing(editingThis ? null : goal.exerciseId);
                                }}
                              >
                                目標
                              </button>
                              <button
                                type="button"
                                className={s.miniBtn}
                                aria-pressed={settingsOf === goal.exerciseId}
                                aria-label={`${goal.name}の設定`}
                                onClick={() => {
                                  setEditing(null);
                                  setSettingsOf((cur) =>
                                    cur === goal.exerciseId ? null : goal.exerciseId,
                                  );
                                }}
                              >
                                設定
                              </button>
                            </>
                          )}
                        </>
                      }
                    >
                      {editingThis && exercise && (
                        <GoalEditor exercise={exercise} sessions={sessions} onUpdate={onUpdate} />
                      )}

                      {settingsOf === goal.exerciseId && exercise && (
                        <ExerciseSettingsForm exercise={exercise} onUpdate={onUpdate} />
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
                    disabled={exercises.every((e) => e.hidden || e.group !== current.group)}
                    onClick={() => setPicking(true)}
                  >
                    {/*
                      見出し「種目の目標」の直下にあり、開いているのは その部位のダイアログ。
                      部位名は要らない。**することは「追加」**で、
                      すでにある目標を決め直すのは各カードの「目標」ボタンが持つ
                    */}
                    ＋ 種目の目標を追加
                  </button>
                </div>
              )}

              {exercises.every((e) => e.hidden || e.group !== current.group) && (
                <p className={ui.note}>
                  この部位の種目がマイ種目にありません（設定 &gt; トレーニング &gt; マイ種目）。
                </p>
              )}
            </div>
          )}
        </Modal>
      )}
    </section>
  );
}
