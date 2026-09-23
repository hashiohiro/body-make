import { GROUP_KEYS } from '../../lib/exerciseCatalog';
import { addDays, formatMD, startOfWeek, todayISO, weekdayLabel } from '../../lib/date';
import { fmt } from '../../lib/format';
import { sessionGroups } from '../../lib/training';
import type { TrainingStats } from '../../lib/training';
import type { SessionPoint } from '../../types';
import { CardHeader } from '../CardHeader';
import ui from '../../styles/ui.module.scss';
import s from './training.module.scss';
import { useT } from '../../lib/i18n';

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
  const t = useT();
  const latest = sessions[sessions.length - 1];
  if (!latest) return null;

  const groups = sessionGroups(latest).map((g) => t(GROUP_KEYS[g]));

  const today = todayISO();
  const weekStart = startOfWeek(today);
  const trained = new Set(sessions.map((x) => x.date));
  // 日数だけでは「いつやったか」が分からないので、今週の 7 日を並べる
  const week = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <>
      <div className={s.pair}>
        <section className={ui.card}>
          <CardHeader title={t('summary.thisWeek')} />

          <div className={s.statRow} style={{ marginBottom: 0 }}>
            <b>{stats.thisWeekDays}</b>
            <span>{t('stat.days')}</span>
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
                  title={
                    trained.has(date)
                      ? t('summary.dayTrained', { date: formatMD(date) })
                      : formatMD(date)
                  }
                />
                {weekdayLabel(t, date)}
              </span>
            ))}
          </div>

          <div className={s.goalFoot}>
            <span>{t('summary.recent', { value: groups.join(t('common.listSep')) })}</span>
          </div>
        </section>

        <section className={ui.card}>
          <CardHeader title={t('summary.total')} />

          <div className={s.statRow} style={{ marginBottom: 0 }}>
            <b>{stats.sessions}</b>
            <span>{t('summary.times')}</span>
          </div>

          <div className={s.goalFoot}>
            <span>
              {stats.firstDate ? t('summary.since', { date: formatMD(stats.firstDate) }) : ''}
            </span>
          </div>
          <div className={s.goalFoot}>
            <span>{t('summary.weeklyAverage', { n: fmt(stats.weeklyAverage) })}</span>
          </div>
        </section>
      </div>
    </>
  );
}
