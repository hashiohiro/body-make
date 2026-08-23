import { addDays, formatMDW, todayISO } from '../lib/date';
import type { DailyPoint, Stats } from '../types';
import ui from '../styles/ui.module.scss';
import s from './StreakStrip.module.scss';

interface Props {
  daily: readonly DailyPoint[];
  stats: Stats;
  /** トレーニングした日。体組成の記録の上に重ねて、いつ動いたかを見せる */
  trainingDates: ReadonlySet<string>;
}

const DAYS = 28;

export function StreakStrip({ daily, stats, trainingDates }: Props) {
  const today = todayISO();
  const bySlots = new Map(daily.map((p) => [p.date, p.slots]));

  const cells = Array.from({ length: DAYS }, (_, i) => {
    const date = addDays(today, -(DAYS - 1 - i));
    return { date, slots: bySlots.get(date) ?? 0, trained: trainingDates.has(date) };
  });

  return (
    <section className={ui.card}>
      <header className={ui.cardHeader}>
        <h2 className={ui.cardTitle}>記録の継続</h2>
        <span className={ui.hint}>直近{DAYS}日</span>
      </header>

      <div className={s.grid}>
        {cells.map((cell) => (
          <i
            key={cell.date}
            className={[
              s.cell,
              cell.slots === 2 ? s.full : cell.slots === 1 ? s.half : '',
              cell.trained ? s.trained : '',
            ]
              .filter(Boolean)
              .join(' ')}
            title={`${formatMDW(cell.date)} ${cell.slots === 0 ? '未記録' : `${cell.slots}回`}${
              cell.trained ? ' · トレーニング' : ''
            }`}
          />
        ))}
      </div>

      <div className={s.legend}>
        <span className={s.legendItem}>
          <i className={s.swatch} aria-hidden="true" />
          未記録
        </span>
        <span className={s.legendItem}>
          <i className={`${s.swatch} ${s.half}`} aria-hidden="true" />
          1回
        </span>
        <span className={s.legendItem}>
          <i className={`${s.swatch} ${s.full}`} aria-hidden="true" />
          朝夜
        </span>
        <span className={s.legendItem}>
          <i className={`${s.swatch} ${s.trained}`} aria-hidden="true" />
          トレ
        </span>
        <span className={s.stats}>
          最長 {stats.bestStreak}日 · 通算 {stats.recordedDays}日
        </span>
      </div>
    </section>
  );
}
