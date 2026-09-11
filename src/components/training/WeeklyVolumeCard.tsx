import { useState } from 'react';
import { Modal } from '../Modal';
import { NumericInput } from '../NumericInput';
import { GROUP_LABELS, GROUP_ORDER, isCardio, isListed } from '../../lib/exerciseCatalog';
import { GROUP_GOAL_RANGE } from '../../lib/storage';
import { addDays, formatMD, startOfWeek, todayISO } from '../../lib/date';
import { formatSets } from '../../lib/training';
import type { TrainingStats } from '../../lib/training';
import type { Exercise, ExerciseGroup, GroupGoals, MuscleGroup, SessionPoint } from '../../types';
import ui from '../../styles/ui.module.scss';
import s from './training.module.scss';

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

/** 最終実施からの日数の言い方。回復ダイアログと同じ語彙を使う */
function lastDoneLabel(days: number | null): string {
  if (days == null) return '記録なし';
  if (days === 0) return '今日';
  if (days === 1) return '昨日';
  return `${days}日前`;
}

interface Props {
  groupGoals: GroupGoals;
  stats: TrainingStats;
  exercises: readonly Exercise[];
  /** 有酸素の今週（回数と時間）を数えるために使う */
  sessions: readonly SessionPoint[];
  onSetGroupGoal: (group: MuscleGroup, value: number | null) => void;
}

/**
 * 今週の量。**部位ごとに、どれだけやったか。**
 *
 * 種目の目標（`ExerciseGoalsCard`）とはカードを分ける。時間軸も数える対象も違う。
 *
 * | | 今週の量 | 種目の目標 |
 * | --- | --- | --- |
 * | 数える対象 | 部位 | 種目 |
 * | 時間 | 今週だけ。日曜に 0 へ戻る | 週をまたいで積み上がる |
 * | 意味 | どれだけやったか | どれだけ強くなったか |
 *
 * 以前は 1 つの行に両方を積んでいた。「2 つを同じ形で並べない」と決めておきながら、
 * 同じ部位の中に入れた時点で並べてしまっていて、しかも「種目の目標 2/3 到達」は
 * 部位の行にあるのに中身は種目の話で、開くまで何の 2/3 なのか読めなかった。
 *
 * 1 部位 1 行。足りているかはバーで出す。数字だけだと、割り算をしないと分からない。
 * 6 部位すべてを常に出すので、決めていない部位は欠けとして見える。
 *
 * 決めるのはダイアログの中。行はあくまで俯瞰で、部位目標はその部位を開いた先で完結させる。
 */
export function WeeklyVolumeCard({
  groupGoals,
  stats,
  exercises,
  sessions,
  onSetGroupGoal,
}: Props) {
  const [open, setOpen] = useState<ExerciseGroup | null>(null);
  /** 部位目標の設定を開いているか。面を差し替える（重ねない） */
  const [editing, setEditing] = useState(false);

  const close = () => {
    setOpen(null);
    setEditing(false);
  };

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

  const rows = GROUP_ORDER.map((group) => {
    const target = groupGoals[group];
    const sets = stats.thisWeekSetsByGroup[group];
    return {
      group,
      target,
      sets,
      days: stats.daysSinceGroup[group],
      /** 量の進捗。目標を決めていない部位は出さない（割る相手がない） */
      progress: target == null ? null : Math.min(1, sets / target),
    };
  });

  const hasCardio = exercises.some((e) => isCardio(e.group) && isListed(e));
  const current = open == null || open === 'cardio' ? null : rows.find((r) => r.group === open)!;

  return (
    <>
      <section className={ui.card}>
        <header className={ui.cardHeader}>
          <h2 className={ui.cardTitle}>今週の量</h2>
          <span className={ui.hint}>
            {stats.thisWeekDays}日 ・ {formatSets(totalSets)}セット
          </span>
        </header>

        {rows.map((row) => (
          <button
            key={row.group}
            type="button"
            className={s.volRow}
            aria-label={`${GROUP_LABELS[row.group]}の今週の量`}
            onClick={() => setOpen(row.group)}
          >
            <span className={s.volName}>{GROUP_LABELS[row.group]}</span>

            {/*
              目標を決めていない部位にはバーを出さない。割る相手がないので、
              空のバーを置くと「0 のまま伸びていない」と読めてしまう。
            */}
            {row.progress == null ? (
              <span />
            ) : (
              <span className={s.meter}>
                <span className={s.meterFill} style={{ width: `${row.progress * 100}%` }} />
              </span>
            )}

            {/* 単位（セット）はカードの見出しが持つ。行に書くとバーがそのぶん痩せる */}
            <span className={s.volValue}>
              {formatSets(row.sets)} / {row.target ?? '—'}
            </span>
            {/*
              最終実施からの日数。「4日空き」は余裕があるようにも読めるので、
              いつやったかをそのまま書く。回復ダイアログと同じ言い方にそろえる。
              今週が 0 でも、ここが「昨日」なら週替わりで空になっただけだと読める
            */}
            <span className={s.volStatus}>{lastDoneLabel(row.days)}</span>
            <span className={s.chevron} aria-hidden="true">
              ›
            </span>
          </button>
        ))}

        {/*
          有酸素は部位ではないので、**週のセット数も部位目標も持たない。**
          代わりに出すのは回数と時間で、これは種目をまたいでも足せる量。
          行が出るのは有酸素の種目を持っているときだけ（持たない人に空の行を見せない）。
        */}
        {hasCardio && (
          <button
            type="button"
            className={s.volRow}
            aria-label={`${GROUP_LABELS.cardio}の今週の量`}
            onClick={() => setOpen('cardio')}
          >
            <span className={s.volName}>{GROUP_LABELS.cardio}</span>
            <span className={s.volWide}>
              {cardioWeek.days}回 / {cardioWeek.minutes}分
            </span>
            <span className={s.volStatus}>{lastDoneLabel(stats.daysSinceCardio)}</span>
            <span className={s.chevron} aria-hidden="true">
              ›
            </span>
          </button>
        )}

        <p className={ui.note}>
          今週は {formatMD(thisWeekStart)} 〜 {formatMD(thisWeekEnd)}。日曜に 0 へ戻ります。
        </p>
      </section>

      {open != null && (
        <Modal
          open
          title={editing ? `${GROUP_LABELS[open]}の部位目標` : `${GROUP_LABELS[open]}の量`}
          onClose={close}
          onBack={editing ? () => setEditing(false) : undefined}
        >
          {editing && current ? (
            /*
              **部位目標を決める面。**入口を押すと面を差し替える。
              決める作業のあいだ、読むための数字が下に残っていると
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
                    onClick={() => onSetGroupGoal(current.group, preset.sets)}
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
                      onSetGroupGoal(current.group, v == null ? null : Math.round(v))
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
              <div className={s.groupSummary}>
                <span>{current ? '今週のセット数' : '今週'}</span>
                <span className={s.boardValue}>
                  {current ? (
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

              {current?.target != null && (
                <span className={s.meter}>
                  <span
                    className={s.meterFill}
                    style={{ width: `${(current.progress ?? 0) * 100}%` }}
                  />
                </span>
              )}

              <p className={ui.note}>
                {(() => {
                  const days = current ? current.days : stats.daysSinceCardio;
                  if (days == null) {
                    return current
                      ? 'この部位の記録はまだありません'
                      : '有酸素の記録はまだありません';
                  }
                  return days === 0 ? '今日やりました' : `最後にやってから ${days}日`;
                })()}
                。
                {current
                  ? '補助部位は既定で 0.5 セットとして数えます。'
                  : /* 走った km と漕いだ km を足しても読めない（§11-18） */
                    '距離は種目ごとに見ます（種目の目標から開けます）。'}
              </p>

              {/*
                **決める場所は小さいボタン 1 つ。**表示部と同じ大きさで並べると、
                どちらが読むもので どちらが押すものか分からなくなる。
              */}
              {current && (
                <div className={ui.btnRow}>
                  <button type="button" className={s.miniBtn} onClick={() => setEditing(true)}>
                    部位目標を設定
                  </button>
                </div>
              )}
            </div>
          )}
        </Modal>
      )}
    </>
  );
}
