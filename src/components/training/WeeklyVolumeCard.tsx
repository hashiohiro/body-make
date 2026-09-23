import { useState } from 'react';
import { GroupGoalEditor } from './GroupGoalEditor';
import { Meter } from '../Meter';
import { Modal } from '../Modal';
import { GROUP_KEYS, GROUP_ORDER, isCardio, isListed } from '../../lib/exerciseCatalog';
import { addDays, formatMD, startOfWeek, todayISO } from '../../lib/date';
import { fmtVolume } from '../../lib/format';
import { cardioWeek, formatSets } from '../../lib/training';
import type { TrainingStats } from '../../lib/training';
import type { Exercise, GroupGoals, GroupTarget, MuscleGroup, SessionPoint } from '../../types';
import { CardHeader } from '../CardHeader';
import ui from '../../styles/ui.module.scss';
import s from './training.module.scss';
import { useWeightFormat } from '../../hooks/useWeightUnit';
import { useT } from '../../lib/i18n';
import type { T } from '../../lib/i18n';

/**
 * 最終実施からの日数の言い方。回復ダイアログと同じ語彙を使う。
 * `t` は引数で受ける——ここは部品ではないのでフックを呼べない。
 */
function lastDoneLabel(t: T, days: number | null): string {
  if (days == null) return t('common.noRecord');
  if (days === 0) return t('common.today');
  if (days === 1) return t('recovery.yesterday');
  return t('recovery.daysAgo', { n: days });
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
  const t = useT();
  const { conv } = useWeightFormat();
  /** 開いている部位。押したらそのまま目標を決める面（段は増やさない） */
  const [open, setOpen] = useState<MuscleGroup | null>(null);

  const totalSets = GROUP_ORDER.reduce((sum, g) => sum + stats.thisWeekSetsByGroup[g], 0);
  const thisWeekStart = startOfWeek(todayISO());
  const thisWeekEnd = addDays(thisWeekStart, 6);

  /*
   * 有酸素の今週。**数え方は `lib/training.ts` が持つ**——打鍵点の波及行も
   * 同じものを読む。2 か所に書くと、片方だけ直って数字が食い違う。
   */
  const cardio = cardioWeek(sessions, thisWeekStart);

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
          title={t('volume.thisWeek')}
          hint={
            <>{t('volume.daysSets', { days: stats.thisWeekDays, sets: formatSets(totalSets) })}</>
          }
        />

        {rows.map((row) => (
          <button
            key={row.group}
            type="button"
            className={s.volRow}
            aria-label={t('volume.ofGroup', { name: t(GROUP_KEYS[row.group]) })}
            onClick={() => setOpen(row.group)}
          >
            <span className={s.volName}>{t(GROUP_KEYS[row.group])}</span>

            {/*
              目標を決めていない部位にはバーを出さない。割る相手がないので、
              空のバーを置くと「0 のまま伸びていない」と読めてしまう。
            */}
            {row.progress == null ? (
              <span />
            ) : (
              <Meter
                value={row.progress}
                label={t('volume.ofGroup', { name: t(GROUP_KEYS[row.group]) })}
              />
            )}

            {/*
              単位は行に書かない（バーがそのぶん痩せる）。セット数なら見出しが言っていて、
              挙上量なら桁で分かる。**目標の立て方に合わせた軸で出す**——
              セット数の目標に挙上量を並べても、足りているかが読めない。
            */}
            <span className={s.volValue}>
              {/*
                挙上量は kg で積んである。実績と目標の**両方**を読む単位へ直す——
                片方だけ直すと、行の「いま / 目標」が別の物差しの比較になる。
                バーの割合は kg どうしの比なので、単位を変えても動かない。
              */}
              {row.target?.type === 'volume' ? fmtVolume(conv(row.volume)) : formatSets(row.sets)} /{' '}
              {row.target == null
                ? '—'
                : row.target.type === 'volume'
                  ? fmtVolume(conv(row.target.value))
                  : row.target.value}
            </span>
            {/*
              最終実施からの日数。「4日空き」は余裕があるようにも読めるので、
              いつやったかをそのまま書く。回復ダイアログと同じ言い方にそろえる。
              今週が 0 でも、ここが「昨日」なら週替わりで空になっただけだと読める
            */}
            <span className={s.volStatus}>{lastDoneLabel(t, row.days)}</span>
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
            <span className={s.volName}>{t(GROUP_KEYS.cardio)}</span>
            <span className={s.volWide}>
              {t('volume.cardio', { times: cardio.days, minutes: cardio.minutes })}
            </span>
            <span className={s.volStatus}>{lastDoneLabel(t, stats.daysSinceCardio)}</span>
          </div>
        )}

        <p className={ui.note}>
          {t('volume.weekRange', { from: formatMD(thisWeekStart), to: formatMD(thisWeekEnd) })}
        </p>
      </section>

      {/*
        **開いたらそのまま決める面。**以前は「読む面 →『部位目標を設定』→ 決める面」の
        2 段だったが、部位を開く用はほぼ目標を触ることなので、1 枚にした。
        組みは種目の目標と同じ（`GroupGoalEditor`）。
      */}
      {current && (
        <Modal
          open
          title={t('exercise.goalOf', { name: t(GROUP_KEYS[current.group]) })}
          onClose={() => setOpen(null)}
        >
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
