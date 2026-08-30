import type { Warning } from '../../lib/check';
import ui from '../../styles/ui.module.scss';
import s from './training.module.scss';

interface Props {
  warnings: readonly Warning[];
  /**
   * 許容済みにする。押した警告は次から出ない（解除は設定の「レビュー」）。
   *
   * 省略すると「許容する」を出さない。作りかけのプリセットのように、
   * まだ許容を紐づける相手（id）が決まっていない場面で使う。
   */
  onSuppress?: (key: string) => void;
}

/**
 * 警告の一覧。記録画面とプリセット画面で同じものを使う。
 *
 * **理由を本文と同じ大きさで出す。** 「なぜこの警告が出たか」を追えなくなった時点で、
 * 警告は読み飛ばされるか、間違って信じられるかのどちらかになる。
 * 数値の出どころを畳んだり、タップして開く形にしたりしない。
 *
 * 「許容する」は必ず 1 件ずつ。まとめて消せる操作を置くと、
 * 読まずに消すのがいちばん速い操作になってしまう。
 */
export function CheckWarnings({ warnings, onSuppress }: Props) {
  if (warnings.length === 0) return null;

  return (
    <ul className={s.warnList}>
      {warnings.map((w) => (
        <li key={w.key} className={s.warnItem}>
          <div className={s.warnBody}>
            <span className={s.warnMessage}>{w.message}</span>
            <small className={s.warnDetail}>{w.detail}</small>
            {/*
              **書くのは「この判定が偽になる条件」だけ。**
              指摘を出しておいて消し方を書かないのは、読む側に判定の再現を強いる。
              条件形（〜なら）にしてあるのは、やるかどうかを決めるのが本人だから。
            */}
            <small className={s.warnFix}>改善するなら {w.fix}</small>
          </div>
          {onSuppress && (
            <button
              type="button"
              className={`${ui.btn} ${ui.btnGhost} ${ui.btnSm}`}
              aria-label={`${w.message}を許容済みにする`}
              onClick={() => onSuppress(w.key)}
            >
              許容する
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
