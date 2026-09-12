import { useEffect, useRef, useState } from 'react';
import type { Badge } from '../lib/badges';
import ui from '../styles/ui.module.scss';
import s from './BadgeGrid.module.scss';

/** 押したバッジの位置。吹き出しを出す高さと、しっぽの横位置を決める */
interface Anchor {
  top: number;
  centerX: number;
}

/**
 * 実績バッジ。
 *
 * 「次の目標」は出さない。獲得済みと未獲得はグリッドで見えていて、
 * 並びも達成率の高い順なので、いちばん近いものは先頭に来ている。
 * 同じことを言い直したうえに、アプリが次の一歩を指定する言い方になる（設計 §1.1）。
 *
 * **条件はタップで読めるようにする。** 以前は title 属性に入れていたが、
 * それが出るのはマウスのある環境だけで、スマホでは何を満たせばいいのか読む手段が無かった。
 *
 * **出し方はツールチップ。** カードの末尾に面として出していた頃は、
 * 押したバッジから遠く、しかも開くたびにカードが伸びて下のカードが動いた。
 * どのバッジの話かは、そのバッジの真下に出ていれば言わずに済む。
 */
export function BadgeGrid({ badges }: { badges: readonly Badge[] }) {
  const earned = badges.filter((b) => b.earned).length;
  const [openId, setOpenId] = useState<string | null>(null);
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  const open = badges.find((b) => b.id === openId) ?? null;

  /*
   * 外を触ったら閉じる。**グラフのツールチップと同じ作法。**
   * 開いたまま別のカードへ目を移すと、どのバッジの話か分からない吹き出しが残る。
   */
  useEffect(() => {
    if (openId == null) return;
    const onDown = (e: PointerEvent) => {
      if (!(e.target instanceof Node)) return;
      if (boxRef.current?.contains(e.target)) return;
      setOpenId(null);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpenId(null);
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [openId]);

  /**
   * 押されたバッジの真下に出す。
   *
   * 横幅はグリッドいっぱいに取る。バッジの幅（94px〜）に合わせると条件文が縦に伸びるし、
   * 端のバッジで枠から出る。**しっぽだけをバッジの中心に置く**ことで、
   * どのバッジの話かは幅を狭めなくても伝わる。
   */
  const toggle = (badge: Badge, el: HTMLElement) => {
    if (openId === badge.id) {
      setOpenId(null);
      return;
    }
    const box = boxRef.current;
    if (box) {
      const grid = box.getBoundingClientRect();
      const rect = el.getBoundingClientRect();
      setAnchor({
        top: rect.bottom - grid.top + 6,
        centerX: rect.left - grid.left + rect.width / 2,
      });
    }
    setOpenId(badge.id);
  };

  return (
    <section className={ui.card}>
      <header className={ui.cardHeader}>
        <h2 className={ui.cardTitle}>実績</h2>
        <span className={ui.hint}>
          {earned} / {badges.length}
        </span>
      </header>

      <div className={s.box} ref={boxRef}>
        <div className={s.grid}>
          {badges.map((badge) => (
            <button
              key={badge.id}
              type="button"
              className={`${s.badge} ${badge.earned ? s.earned : ''}`}
              aria-pressed={openId === badge.id}
              aria-label={`${badge.name}の条件`}
              onClick={(e) => toggle(badge, e.currentTarget)}
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

        {open && anchor && (
          <div className={s.tip} role="status" style={{ top: anchor.top }}>
            <i className={s.tipArrow} style={{ left: anchor.centerX }} aria-hidden="true" />
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
        )}
      </div>

      {/* 押せることは形から読めないので、1 行だけ置く（開いているあいだは要らない） */}
      {open == null && <p className={ui.note}>バッジを押すと、獲得の条件が出ます。</p>}
    </section>
  );
}
