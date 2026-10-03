import { useState } from 'react';
import { GroupGoalEditor } from './GroupGoalEditor';
import { groupColor } from './groupColor';
import { GroupTrendChart } from './GroupTrendChart';
import type { GroupValueId } from './groupValues';
import { VolumeSwatch } from './VolumeSwatch';
import { volumeBarStyle } from './volumeBar';
import { fmtVolume } from '../../lib/format';
import { useWeightFormat } from '../../hooks/useWeightUnit';
import { Modal } from '../Modal';
import { GROUP_KEYS, GROUP_ORDER, isCardio, isListed } from '../../lib/exerciseCatalog';
import { addDays, formatMD, startOfWeek, todayISO, weekdayLabel } from '../../lib/date';
import { cardioWeek, formatSets } from '../../lib/training';
import type { TrainingStats, WeekSetCount } from '../../lib/training';
import type { Exercise, GroupGoals, GroupTarget, MuscleGroup, SessionPoint } from '../../types';
import { CardHeader } from '../CardHeader';
import ui from '../../styles/ui.module.scss';
import s from './training.module.scss';
import { useT } from '../../lib/i18n';
import type { T } from '../../lib/i18n';

/** 棒の縦の物差しの上端（目標に対する割合）。§ 本体のコメント */
const VOL_TOP_MIN = 1.25;
const VOL_TOP_MAX = 2.5;

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
  /** 週ごとの部位別の量（推移のグラフに使う） */
  weeks: readonly WeekSetCount[];
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
  weeks,
}: Props) {
  const t = useT();
  const { conv } = useWeightFormat();
  /** 開いている部位。押したらそのまま目標を決める面（段は増やさない） */
  const [open, setOpen] = useState<MuscleGroup | null>(null);
  /** 推移を開いている部位（目標の面の上に重ねる） */
  const [trendOf, setTrendOf] = useState<MuscleGroup | null>(null);
  const [trendValue, setTrendValue] = useState<GroupValueId>('sets');

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
    return {
      group,
      target,
      sets,
      volume,
      days: stats.daysSinceGroup[group],
      /** 目標に対する割合。目標を決めていない側は null（割る相手がない） */
      setsRatio: target?.sets == null ? null : sets / target.sets,
      volumeRatio: target?.volume == null ? null : volume / target.volume,
    };
  });

  /*
   * 棒の縦の物差しは**目標に対する割合**。セット数と挙上量で桁が 3 つ違い、部位ごとに値も違うので、
   * 実数で 1 本の軸に並べると目標の線が棒ごとに別の高さになる。
   * 割合なら目標の線は 1 本（100%）で済み、セット数と挙上量の棒も同じ線で読める。
   * 上端は目標の 1.25 倍か、いちばん高い棒まで（2.5 倍で頭打ち。1 本だけ突き抜けても
   * ほかの棒が潰されないように）。
   */
  const ratios = rows
    .flatMap((r) => [r.setsRatio, r.volumeRatio])
    .filter((v): v is number => v != null);
  const top = Math.min(VOL_TOP_MAX, Math.max(VOL_TOP_MIN, ...ratios));
  const hasVolumeGoal = rows.some((r) => r.volumeRatio != null);

  /* その週にやった日。数は見出しが言っている（`thisWeekDays`）ので、ここは位置だけ */
  const doneDays = new Set(
    sessions.filter((x) => x.date >= thisWeekStart && x.date <= thisWeekEnd).map((x) => x.date),
  );
  const week = Array.from({ length: 7 }, (_, i) => addDays(thisWeekStart, i));

  /*
   * 目標の線の名前。全部位がセット数だけの同じ目標なら数も書く（「目標 15」）。
   * そうでなければ数は書けない（物差しが割合なので、線の高さは同じでも数は棒ごとに違う）。
   */
  const targets = rows.map((r) => r.target).filter((x): x is GroupTarget => x != null);
  const sameSets =
    targets.length > 0 &&
    !hasVolumeGoal &&
    targets.every((x) => x.sets != null && x.sets === targets[0]!.sets);
  const targetLabel =
    targets.length === 0
      ? null
      : sameSets
        ? t('volume.targetLine', { n: targets[0]!.sets! })
        : t('common.goal');

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

        {/* 週の 7 日。やった日を塗る（日曜始まり。週の数え方は `startOfWeek`） */}
        <div className={s.weekDots} aria-hidden="true">
          {week.map((d) => (
            <span key={d} className={doneDays.has(d) ? s.weekDotOn : undefined}>
              <i />
              {weekdayLabel(t, d)}
            </span>
          ))}
        </div>

        {/*
          部位 1 つにつき 1 本の棒。**棒ごと押せる**（押したらその部位の目標を決める面）。
          目標を決めていない部位には棒を出さない。割る相手がないので、
          空の棒を置くと「0 のまま伸びていない」と読めてしまう。
        */}
        <div className={s.volChart}>
          {rows.map((row, index) => {
            const name = t(GROUP_KEYS[row.group]);
            const color = groupColor(row.group);
            const tallest = Math.max(row.setsRatio ?? 0, row.volumeRatio ?? 0);
            /* 棒 1 本。高さは同じ列の高いほうの棒に対する割合（列の器がその高さを持つ） */
            const bar = (ratio: number | null, kind: 'sets' | 'volume') =>
              ratio == null ? null : (
                <span
                  role="progressbar"
                  aria-label={t(kind === 'sets' ? 'volume.setsOf' : 'volume.volumeOf', { name })}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(Math.min(1, ratio) * 100)}
                  className={s.volBar}
                  style={{
                    height:
                      tallest > 0 ? `${(Math.min(ratio, top) / Math.min(tallest, top)) * 100}%` : 0,
                    ...volumeBarStyle(kind, color),
                  }}
                />
              );
            return (
              <button
                key={row.group}
                type="button"
                className={s.volCol}
                aria-label={t('volume.ofGroup', { name })}
                onClick={() => setOpen(row.group)}
              >
                <span className={s.volPlot}>
                  {row.target != null && (
                    <span
                      className={s.volTarget}
                      style={{ bottom: `calc(${1 / top} * (100% - 22px))` }}
                    />
                  )}
                  {/* 目標の線の名前は 1 度だけ（右端の列に置く） */}
                  {index === rows.length - 1 && targetLabel && (
                    <span
                      className={s.volTargetLabel}
                      style={{ bottom: `calc(${1 / top} * (100% - 22px) + 3px)` }}
                    >
                      {targetLabel}
                    </span>
                  )}
                  {/*
                    いまの値は棒の頭に乗せる。セット数の目標があればセット数、挙上量だけなら挙上量。
                    挙上量は kg で積んであるので、読む単位へ直す。
                  */}
                  <span className={s.volNow}>
                    {row.setsRatio == null && row.volumeRatio != null
                      ? fmtVolume(conv(row.volume))
                      : formatSets(row.sets)}
                  </span>
                  <span
                    className={s.volBars}
                    style={{ height: `calc(${Math.min(tallest, top) / top} * (100% - 22px))` }}
                  >
                    {bar(row.setsRatio, 'sets')}
                    {bar(row.volumeRatio, 'volume')}
                  </span>
                </span>
                <span className={s.volName}>{name}</span>
              </button>
            );
          })}
        </div>

        {/* 挙上量の目標が 1 つでもあれば、棒の模様の見方を添える（セット数＝塗り、挙上量＝斜線） */}
        {hasVolumeGoal && (
          <div className={s.volLegend} aria-hidden="true">
            <span>
              <VolumeSwatch kind="sets" />
              {t('metric.sets')}
            </span>
            <span>
              <VolumeSwatch kind="volume" />
              {t('metric.volume')}
            </span>
          </div>
        )}

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
          // 決める前に過去の週を見たい。推移は重ねて出し、閉じるとこの面に戻る
          action={{
            label: t('common.trend'),
            ariaLabel: t('common.trendOf', { name: t(GROUP_KEYS[current.group]) }),
            onClick: () => setTrendOf(current.group),
          }}
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

      {/* 部位 1 つの週ごとの量。セット数・挙上量を切り替え、決めてある目標を水平線で添える */}
      {trendOf && (
        <Modal
          open
          title={t('common.trendOf', { name: t(GROUP_KEYS[trendOf]) })}
          onClose={() => setTrendOf(null)}
        >
          <GroupTrendChart
            weeks={weeks}
            valueId={trendValue}
            onValueChange={setTrendValue}
            only={{ group: trendOf, target: groupGoals[trendOf] }}
          />
        </Modal>
      )}
    </>
  );
}
