import type { Badge } from '../lib/badges';
import ui from '../styles/ui.module.scss';
import s from './BadgeGrid.module.scss';

export function BadgeGrid({ badges }: { badges: readonly Badge[] }) {
  const earned = badges.filter((b) => b.earned).length;
  const next = badges.find((b) => !b.earned);

  return (
    <section className={ui.card}>
      <header className={ui.cardHeader}>
        <h2 className={ui.cardTitle}>実績</h2>
        <span className={ui.hint}>
          {earned} / {badges.length}
        </span>
      </header>

      <div className={s.grid}>
        {badges.map((badge) => (
          <div
            key={badge.id}
            className={`${s.badge} ${badge.earned ? s.earned : ''}`}
            title={badge.detail}
          >
            <div className={s.icon} aria-hidden="true">
              {badge.icon}
            </div>
            <div className={s.name}>{badge.name}</div>
            {!badge.earned && badge.progress > 0 && (
              <div className={s.progress} aria-hidden="true">
                <i style={{ width: `${Math.round(badge.progress * 100)}%` }} />
              </div>
            )}
          </div>
        ))}
      </div>

      {next && (
        <div className={s.summary}>
          <span>次の目標</span>
          <span className={s.next}>
            {next.name} — {next.detail}
          </span>
        </div>
      )}
    </section>
  );
}
