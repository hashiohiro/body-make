import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import s from './Modal.module.scss';

interface Props {
  open: boolean;
  title: string;
  onClose: () => void;
  /**
   * 面を差し替えている最中の戻り先。
   *
   * 渡すと、見出しの左に「‹ 戻る」が出る。**閉じるは残す。**
   * 戻るだけにすると、用が済んだ人が閉じるまでに 2 回押すことになる
   * （深い面ほど、そこで終わる回数のほうが多い）。
   * Esc と背面のキャンセルは戻るに合わせる。ダイアログごと消えると、
   * 元居た面まで一緒に失われるため。
   */
  onBack?: (() => void) | undefined;
  /**
   * 高さを決め打ちにする。**一覧を出す面で使う。**
   *
   * 既定は中身なり（`max-height`）で、短い面が無駄に伸びないようにしてある。
   * ただし一覧では、絞り込みや検索で件数が減るたびに高さが縮む。
   * スマホでは下から出るシートなので、縮むと**上の縁が下がって**、
   * いま読んでいた結果が画面の下へ逃げていく。
   * 件数で高さが動かないようにして、読む位置を留める。
   */
  tall?: boolean | undefined;
  children: ReactNode;
}

/*
 * 背面のスクロールを止める。
 *
 * showModal() が止めるのは操作（クリックとフォーカス）だけで、
 * ダイアログの外を指でなぞると地のほうが動く。位置を保ったまま body を固定して、
 * 閉じたら元の位置へ戻す（overflow: hidden だけでは iOS の慣性スクロールが残る）。
 *
 * 入れ子で開くことがあるので、開いている数を数えて最後の 1 枚で解除する。
 */
let openCount = 0;
let savedY = 0;

function lockScroll() {
  if (openCount++ > 0) return;
  savedY = window.scrollY;
  const { style } = document.body;
  style.position = 'fixed';
  style.top = `-${savedY}px`;
  style.left = '0';
  style.right = '0';
  style.width = '100%';
}

function unlockScroll() {
  if (openCount === 0 || --openCount > 0) return;
  const { style } = document.body;
  style.position = '';
  style.top = '';
  style.left = '';
  style.right = '';
  style.width = '';
  window.scrollTo(0, savedY);
}

/**
 * ネイティブ `<dialog>` の薄いラッパー。
 * フォーカストラップ・Esc・背面の不活性化はブラウザに任せる（依存を足さない）。
 */
export function Modal({ open, title, onClose, onBack, tall, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;

    if (open) {
      // showModal を持たない環境（テスト用の DOM 実装など）でも中身は出す
      if (typeof dialog.showModal === 'function') {
        try {
          if (!dialog.open) dialog.showModal();
        } catch {
          dialog.setAttribute('open', '');
        }
      } else {
        dialog.setAttribute('open', '');
      }
    } else if (dialog.open) {
      // 開く側と同じく、close を持たない環境でも閉じられるようにする
      if (typeof dialog.close === 'function') dialog.close();
      else dialog.removeAttribute('open');
    }
  }, [open]);

  // 開いたまま外されることがある（呼び出し側が開いているときだけ置く形）ので、
  // 後始末はクリーンアップに任せる
  useEffect(() => {
    if (!open) return;
    lockScroll();
    return unlockScroll;
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={`${s.dialog} ${tall ? s.tall : ''}`}
      onCancel={onBack ?? onClose}
      onClose={onBack ?? onClose}
    >
      <div className={s.head}>
        {onBack && (
          <button type="button" className={s.back} onClick={onBack}>
            ‹ 戻る
          </button>
        )}
        <span className={s.title}>{title}</span>
        <button type="button" className={s.close} onClick={onClose}>
          閉じる
        </button>
      </div>
      <div className={`${s.body} ${tall ? s.bodyTall : ''}`}>{open && children}</div>
    </dialog>
  );
}
