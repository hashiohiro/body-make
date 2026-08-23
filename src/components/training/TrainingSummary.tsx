import { GROUP_LABELS, GROUP_ORDER } from '../../lib/exerciseCatalog';
import { addDays, formatMD, startOfWeek, todayISO, weekdayJa } from '../../lib/date';
import { fmt } from '../../lib/format';
import { formatSets, sessionGroups } from '../../lib/training';
import type { TrainingStats } from '../../lib/training';
import type { GroupGoals, SessionPoint } from '../../types';
import ui from '../../styles/ui.module.scss';
import s from './training.module.scss';

interface Props {
  sessions: readonly SessionPoint[];
  stats: TrainingStats;
  goals: GroupGoals;
}

/**
 * ホームでのトレーニングの現況。
 *
 * 「今週どうか」「これまでどうか」「どこに配分したか」は別の問いなので、カードを分ける。
 * 種目をまたいだセット数の合計は出さない。スクワットとサイドレイズを同じ 1 セットとして
 * 足した数字は、何をやったのかを説明しない（部位別の内訳のほうが常に情報量が多い）。
 */
export function TrainingSummary({ sessions, stats, goals }: Props) {
  const latest = sessions[sessions.length - 1];
  if (!latest) return null;

  const groups = sessionGroups(latest).map((g) => GROUP_LABELS[g]);

  const today = todayISO();
  const weekStart = startOfWeek(today);
  const trained = new Set(sessions.map((x) => x.date));
  // 日数だけでは「いつやったか」が分からないので、今週の 7 日を並べる
  const week = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <>
      <div className={s.pair}>
        <section className={ui.card}>
          <header className={ui.cardHeader}>
            <h2 className={ui.cardTitle}>今週のトレーニング</h2>
          </header>

          <div className={s.statRow} style={{ marginBottom: 0 }}>
            <b>{stats.thisWeekDays}</b>
            <span>日</span>
          </div>

          <div className={s.week}>
            {week.map((date) => (
              <span key={date} className={s.weekDay}>
                <i
                  className={[
                    s.weekCell,
                    trained.has(date) ? s.weekCellOn : '',
                    date === today ? s.weekCellToday : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  title={`${formatMD(date)}${trained.has(date) ? ' トレーニング' : ''}`}
                />
                {weekdayJa(date)}
              </span>
            ))}
          </div>

          <div className={s.goalFoot}>
            <span>直近 {groups.join('・')}</span>
          </div>
        </section>

        <section className={ui.card}>
          <header className={ui.cardHeader}>
            <h2 className={ui.cardTitle}>トレーニングの通算回数</h2>
          </header>

          <div className={s.statRow} style={{ marginBottom: 0 }}>
            <b>{stats.sessions}</b>
            <span>回</span>
          </div>

          <div className={s.goalFoot}>
            <span>{stats.firstDate ? `${formatMD(stats.firstDate)} から` : ''}</span>
          </div>
          <div className={s.goalFoot}>
            <span>週平均 {fmt(stats.weeklyAverage)} 日</span>
          </div>
        </section>
      </div>

      <section className={ui.card}>
        <header className={ui.cardHeader}>
          <h2 className={ui.cardTitle}>今週の部位別セット数</h2>
        </header>

        {GROUP_ORDER.map((group) => {
          const sets = stats.thisWeekSetsByGroup[group];
          const days = stats.daysSinceGroup[group];
          const goal = goals[group];
          return (
            <div key={group} className={`${s.groupRow} ${sets > 0 ? '' : s.groupRowOff}`}>
              <span>{GROUP_LABELS[group]}</span>

              {/*
                ゲージは目標を決めた部位にだけ出す。目標が無いのに棒を引くと、
                基準をこちらで決めることになる（その週の最大部位を 100% にすると、
                全体が半分の週でも同じ形になって多寡が読めない）。
              */}
              {goal != null ? (
                <span className={s.groupBarTrack}>
                  <span
                    className={s.groupBarFill}
                    style={{ width: `${Math.min(1, sets / goal) * 100}%` }}
                  />
                </span>
              ) : (
                <span />
              )}

              <span className={s.groupValue}>
                {/*
                  目標の有無で数字の置き場所を変えない。
                  片方だけチップにすると、同じカードの中で読み方が 2 通りになる。
                  単位はカードの見出しが持っているので、ここには出さない。
                  今週やっていない部位は、代わりに何日空いているかを出す
                */}
                {goal != null ? (
                  <>
                    <b>{formatSets(sets)}</b> / {goal}
                  </>
                ) : sets > 0 ? (
                  <b>{formatSets(sets)}</b>
                ) : days == null ? (
                  '—'
                ) : (
                  `${days}日`
                )}
              </span>
            </div>
          );
        })}
      </section>
    </>
  );
}
