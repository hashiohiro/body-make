import type { ReactNode } from 'react';
import s from './Pill.module.scss';

interface Props {
  children: ReactNode;
  onClick: () => void;
  /** 選ばれているか。選択でない使い方（ただ押すだけ）では渡さない */
  pressed?: boolean | undefined;
  disabled?: boolean | undefined;
  /** 読み上げに出す名前。中身の文字だけで足りるときは渡さない */
  label?: string | undefined;
  /** 一段小さく出す。従属する値（補助部位の係数など）に使う */
  small?: boolean | undefined;
  /** 輪郭を破線にする。手元にない種目など、状態への断りがあるとき */
  dashed?: boolean | undefined;
}

/**
 * 丸い選択ボタン。**押せる丸ピルはすべてこれ。**
 *
 * 読むだけの札（`Tag`）と形が近いので、**描き分けを 1 か所に持つ**。
 *
 *   札（読むだけ）  … 枠線なし・沈んだ地・ink-muted
 *   ピル（押せる）  … 枠線あり・地は沈み・ink、選択中はアクセント
 *
 * 揃えてしまうと、押せるものと押せないものが見分けられない。
 * 見た目はここ、何を選ぶのかは呼び出し側（種目・部位・係数）が持つ。
 */
export function Pill({ children, onClick, pressed, disabled, label, small, dashed }: Props) {
  return (
    <button
      type="button"
      className={`${s.pill} ${small ? s.small : ''} ${dashed ? s.dashed : ''}`}
      {...(pressed == null ? {} : { 'aria-pressed': pressed })}
      {...(label == null ? {} : { 'aria-label': label })}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
