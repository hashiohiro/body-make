import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import s from './Modal.module.scss';

interface Props {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

/**
 * ネイティブ `<dialog>` の薄いラッパー。
 * フォーカストラップ・Esc・背面の不活性化はブラウザに任せる（依存を足さない）。
 */
export function Modal({ open, title, onClose, children }: Props) {
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

  return (
    <dialog ref={ref} className={s.dialog} onCancel={onClose} onClose={onClose}>
      <div className={s.head}>
        <span className={s.title}>{title}</span>
        <button type="button" className={s.close} onClick={onClose}>
          閉じる
        </button>
      </div>
      <div className={s.body}>{open && children}</div>
    </dialog>
  );
}
