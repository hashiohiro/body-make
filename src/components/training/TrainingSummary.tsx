import { GROUP_LABELS } from '../../lib/exerciseCatalog';
import { addDays, formatMD, startOfWeek, todayISO, weekdayJa } from '../../lib/date';
import { fmt } from '../../lib/format';
import { sessionGroups } from '../../lib/training';
import type { TrainingStats } from '../../lib/training';
import type { SessionPoint } from '../../types';
import ui from '../../styles/ui.module.scss';
import s from './training.module.scss';

interface Props {
  sessions: readonly SessionPoint[];
  stats: TrainingStats;
}

/**
 * ホームでのトレーニングの現況。
 *
 * 「今週どうか」「これまでどうか」「どこに配分したか」は別の問いなので、カードを分ける。
 * 種目をまたいだセット数の合計は出さない。スクワットとサイドレイズを同じ 1 セットとして
 * 足した数字は、何をやったのかを説明しない（部位別の内訳のほうが常に情報量が多い）。
 */
export function TrainingSummary({ sessions, stats }: Props) {
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
    </>
  );
}
