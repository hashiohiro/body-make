import { useState } from 'react';
import type { Badge } from '../lib/badges';
import ui from '../styles/ui.module.scss';
import s from './BadgeGrid.module.scss';

/**
 * 実績バッジ。
 *
 * 「次の目標」は出さない。獲得済みと未獲得はグリッドで見えていて、
 * 並びも達成率の高い順なので、いちばん近いものは先頭に来ている。
 * 同じことを言い直したうえに、アプリが次の一歩を指定する言い方になる（設計 §1.1）。
 *
 * **条件はタップで読めるようにする。** 以前は title 属性に入れていたが、
 * それが出るのはマウスのある環境だけで、スマホでは何を満たせばいいのか読む手段が無かった。
 */
export function BadgeGrid({ badges }: { badges: readonly Badge[] }) {
  const earned = badges.filter((b) => b.earned).length;
  const [openId, setOpenId] = useState<string | null>(null);
  const open = badges.find((b) => b.id === openId) ?? null;

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
          <button
            key={badge.id}
            type="button"
            className={`${s.badge} ${badge.earned ? s.earned : ''}`}
            aria-pressed={openId === badge.id}
            aria-label={`${badge.name}の条件`}
            onClick={() => setOpenId((cur) => (cur === badge.id ? null : badge.id))}
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
          </button>
        ))}
      </div>

      {open ? (
        <div className={s.detail}>
          <div className={s.detailName}>
            {open.icon} {open.name}
            {open.earned && <span className={s.detailEarned}>獲得</span>}
          </div>
          <p className={s.detailText}>{open.detail}</p>
          {open.value != null && open.goal != null && (
            <p className={s.detailValue}>
              いま {open.value} / {open.goal}
            </p>
          )}
        </div>
      ) : (
        <p className={ui.note}>バッジを押すと、獲得の条件が出ます。</p>
      )}
    </section>
  );
}
