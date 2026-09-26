import { useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { insideNode, useDismiss } from '../hooks/useDismiss';
import { badgeDetail, badgeName } from '../lib/badges';
import type { Badge } from '../lib/badges';
import { CardHeader } from './CardHeader';
import { Modal } from './Modal';
import ui from '../styles/ui.module.scss';
import s from './BadgeGrid.module.scss';
import { useT } from '../lib/i18n';

/** 押したバッジの位置。吹き出しを出す高さと、しっぽの横位置を決める */
interface Anchor {
  top: number;
  centerX: number;
}

/** カードに出す数。**残りは数で畳んで、押したらダイアログで全部出す** */
const FOLDED = 5;

/** 伏せてある実績のタイル。名前の代わりに出す印 */
const MASK_ICON = '❓';

/**
 * 名前も条件も出さないか。**伏せてある実績は、解除するまで `???`。**
 * 解除したら普通のバッジとして並ぶ（そこで初めて何だったか読める）。
 */
const isMasked = (badge: Badge) => badge.hidden && !badge.earned;

/**
 * 獲った順に並べる。**新しいものが先。**
 *
 * 日付を持たないもの（記録を始める前から獲っていたぶん）は獲得順に置けないので
 * 後ろにまとめ、その中は**閾値の大きい順**にする。いまの実績はどれも
 * 「n 回」「n 日」なので、達成しにくいものほど後から獲ったことになる。
 */
function byEarned(a: Badge, b: Badge): number {
  if (a.earnedAt && b.earnedAt)
    return a.earnedAt < b.earnedAt ? 1 : a.earnedAt > b.earnedAt ? -1 : 0;
  if (a.earnedAt) return -1;
  if (b.earnedAt) return 1;
  return (b.goal ?? 0) - (a.goal ?? 0);
}

/**
 * バッジを並べて、押したら条件を出す。**カードでもダイアログでも同じもの。**
 *
 * 吹き出しは押したバッジの真下に絶対配置で出すので、器（`box`）ごと持つ。
 * 2 か所に写すと、しっぽの位置合わせと閉じ方が片方だけずれる。
 */
function Grid({ badges, extra }: { badges: readonly Badge[]; extra?: ReactNode }) {
  const t = useT();
  const [openId, setOpenId] = useState<string | null>(null);
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const open = badges.find((b) => b.id === openId) ?? null;

  /*
   * 外を触ったら閉じる。**グラフのツールチップと同じ作法**（`useDismiss`）。
   * 開いたまま別のカードへ目を移すと、どのバッジの話か分からない吹き出しが残る。
   *
   * 判定は矩形ではなく「器の中か」。吹き出しは押したバッジの真下に絶対配置で出るので、
   * グリッドの矩形より下へ抜けることがある。
   */
  useDismiss(openId != null, () => setOpenId(null), insideNode(boxRef));

  /**
   * 押されたバッジの真下に出す。
   *
   * 中心の位置だけを渡し、**寄せて止めるのは CSS に任せる**（`.tip` の `clamp`）。
   * 幅を JS で測って足し引きすると、字の大きさや言語で幅が変わるたびに合わなくなる。
   *
   * 下へ潜らないための余地は、画面の下余白で先に空けてある（`--tip-room`）。
   * ここで高さを測って器を伸ばしても、すでに一番下まで送ってあると視界が動かない。
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
    <div className={s.box} ref={boxRef}>
      <div className={s.grid}>
        {badges.map((badge) => (
          <button
            key={badge.id}
            type="button"
            className={`${s.badge} ${badge.earned ? s.earned : ''}`}
            aria-pressed={openId === badge.id}
            aria-label={t('badge.condition', {
              name: isMasked(badge) ? t('badge.hiddenLabel') : badgeName(t, badge),
            })}
            onClick={(e) => toggle(badge, e.currentTarget)}
          >
            <div className={s.icon} aria-hidden="true">
              {isMasked(badge) ? MASK_ICON : badge.icon}
            </div>
            <div className={s.name}>
              {isMasked(badge) ? t('badge.hiddenName') : badgeName(t, badge)}
            </div>
            {!badge.earned && badge.progress > 0 && (
              <div className={s.progress} aria-hidden="true">
                <i style={{ width: `${Math.round(badge.progress * 100)}%` }} />
              </div>
            )}
          </button>
        ))}
        {extra}
      </div>

      {open && anchor && (
        <>
          {/*
            しっぽは吹き出しの外に置く。**吹き出しは端で寄せて止まる**ので、
            中に入れると、寄せたぶんだけ指す先がずれる。
          */}
          <i
            className={s.tipArrow}
            style={{ top: anchor.top - 5, left: anchor.centerX }}
            aria-hidden="true"
          />
          <div
            className={s.tip}
            role="status"
            style={{ top: anchor.top, ['--tip-x' as string]: `${anchor.centerX}px` }}
          >
            <div className={s.detailName}>
              {isMasked(open) ? MASK_ICON : open.icon}{' '}
              {isMasked(open) ? t('badge.hiddenName') : badgeName(t, open)}
              {open.earned && <span className={s.detailEarned}>{t('badge.earned')}</span>}
            </div>
            <p className={s.detailText}>
              {isMasked(open) ? t('badge.hiddenDetail') : badgeDetail(t, open)}
            </p>
            {open.value != null && open.goal != null && (
              <p className={s.detailValue}>
                {t('badge.progress', { value: open.value, goal: open.goal })}
              </p>
            )}
          </div>
        </>
      )}

      {/* 押せることは形から読めないので 1 行置く。開いているあいだは要らない */}
      {open == null && <p className={ui.note}>{t('badge.hint')}</p>}
    </div>
  );
}

interface Props {
  badges: readonly Badge[];
  /** 見出し。解除済みと未解除で別のカードにする */
  title: string;
  /**
   * 見出しの右に出す母数。解除済みのカードにだけ渡す（`12 / 59`）。
   * 未解除のカードは件数だけでよい——割合を出すと、残りを課題として並べることになる。
   */
  total?: number | undefined;
  /** 獲った順に並べる（解除済み）。未解除は渡された順（達成率の高い順）のまま */
  recentFirst?: boolean | undefined;
}

/**
 * 実績のカード。**解除済みと未解除で分ける**（`HomeView` が 2 枚置く）。
 *
 * 1 枚に 59 個を混ぜていた頃は、獲ったものが未獲得に埋もれて
 * 「何を取ったか」が読めなかった。分ければ、取ったものは取ったものとして並ぶ。
 *
 * **カードに出すのは 5 件まで。**残りは数で畳み、押すとダイアログで全部出す。
 * その場で広げると、下にあるカードが押すたびに動く（バッジは 59 個ある）。
 *
 * 「次の目標」は出さない。並びが同じことを言っているうえ、アプリが次の一歩を
 * 指定する言い方になる（設計 §1.1）。
 *
 * **条件はタップで読めるようにする。**以前は title 属性に入れていたが、
 * それが出るのはマウスのある環境だけで、スマホでは読む手段が無かった。
 */
export function BadgeGrid({ badges, title, total, recentFirst }: Props) {
  const t = useT();
  const [more, setMore] = useState(false);

  const ordered = recentFirst ? [...badges].sort(byEarned) : badges;
  const shown = ordered.slice(0, FOLDED);
  const rest = ordered.length - shown.length;

  return (
    <>
      <section className={ui.card}>
        <CardHeader
          title={title}
          hint={<>{total == null ? badges.length : `${badges.length} / ${total}`}</>}
        />

        <Grid
          badges={shown}
          extra={
            rest > 0 && (
              <button
                type="button"
                className={`${s.badge} ${s.more}`}
                onClick={() => setMore(true)}
              >
                {t('badge.more', { n: rest })}
              </button>
            )
          }
        />
      </section>

      {more && (
        <Modal open title={title} tall onClose={() => setMore(false)}>
          <Grid badges={ordered} />
        </Modal>
      )}
    </>
  );
}
