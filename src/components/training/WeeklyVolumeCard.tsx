import { useState } from 'react';
import { GroupGoalEditor } from './GroupGoalEditor';
import { Meter } from '../Meter';
import { Modal } from '../Modal';
import { GROUP_LABELS, GROUP_ORDER, isCardio, isListed } from '../../lib/exerciseCatalog';
import { addDays, formatMD, startOfWeek, todayISO } from '../../lib/date';
import { fmtVolume } from '../../lib/format';
import { formatSets } from '../../lib/training';
import type { TrainingStats } from '../../lib/training';
import type { Exercise, GroupGoals, GroupTarget, MuscleGroup, SessionPoint } from '../../types';
import { CardHeader } from '../CardHeader';
import ui from '../../styles/ui.module.scss';
import s from './training.module.scss';

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
  onSetGroupGoal: (group: MuscleGroup, target: GroupTarget | null) => void;
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
  /** 開いている部位。押したらそのまま目標を決める面（段は増やさない） */
  const [open, setOpen] = useState<MuscleGroup | null>(null);

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
    const volume = stats.thisWeekVolumeByGroup[group];
    // 立て方で割る相手が変わる。行に出す数字も進捗も、同じ軸から引く
    const done = target?.type === 'volume' ? volume : sets;
    return {
      group,
      target,
      sets,
      volume,
      done,
      days: stats.daysSinceGroup[group],
      /** 量の進捗。目標を決めていない部位は出さない（割る相手がない） */
      progress: target == null ? null : Math.min(1, done / target.value),
    };
  });

  const hasCardio = exercises.some((e) => isCardio(e.group) && isListed(e));
  const current = open == null ? null : rows.find((r) => r.group === open)!;

  return (
    <>
      <section className={ui.card}>
        <CardHeader
          title="今週の量"
          hint={
            <>
              {stats.thisWeekDays}日 ・ {formatSets(totalSets)}セット
            </>
          }
        />

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
              <Meter value={row.progress} label={`${GROUP_LABELS[row.group]}の今週の量`} />
            )}

            {/*
              単位は行に書かない（バーがそのぶん痩せる）。セット数なら見出しが言っていて、
              挙上量なら桁で分かる。**目標の立て方に合わせた軸で出す**——
              セット数の目標に挙上量を並べても、足りているかが読めない。
            */}
            <span className={s.volValue}>
              {row.target?.type === 'volume' ? fmtVolume(row.volume) : formatSets(row.sets)} /{' '}
              {row.target?.value ?? '—'}
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
        {/*
          **有酸素の行は押せない。**部位ではないので目標を持たず、開いた先に決める
          ものが無い。押せる行と同じ形で並べて、開いたら行き止まりのほうが悪い。
          「›」も出さない（形から押せないことが読める）。
        */}
        {hasCardio && (
          <div className={s.volRow}>
            <span className={s.volName}>{GROUP_LABELS.cardio}</span>
            <span className={s.volWide}>
              {cardioWeek.days}回 / {cardioWeek.minutes}分
            </span>
            <span className={s.volStatus}>{lastDoneLabel(stats.daysSinceCardio)}</span>
          </div>
        )}

        <p className={ui.note}>
          今週は {formatMD(thisWeekStart)} 〜 {formatMD(thisWeekEnd)}。日曜に 0 へ戻ります。
        </p>
      </section>

      {/*
        **開いたらそのまま決める面。**以前は「読む面 →『部位目標を設定』→ 決める面」の
        2 段だったが、部位を開く用はほぼ目標を触ることなので、1 枚にした。
        組みは種目の目標と同じ（`GroupGoalEditor`）。
      */}
      {current && (
        <Modal open title={`${GROUP_LABELS[current.group]}の目標`} onClose={() => setOpen(null)}>
          <GroupGoalEditor
            group={current.group}
            target={current.target}
            sets={current.sets}
            volume={current.volume}
            days={current.days}
            onChange={(target) => onSetGroupGoal(current.group, target)}
          />
        </Modal>
      )}
    </>
  );
}
