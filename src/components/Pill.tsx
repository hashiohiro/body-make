import type { ReactNode } from 'react';
import s from './Pill.module.scss';

interface Props {
  children: ReactNode;
  /**
   * 押したときの動き。**渡さなければボタンにしない。**
   *
   * 押せないものをボタンの形で出すと、色が薄いだけの「押せるもの」に見えて、
   * 押して初めて反応しないと分かる。操作ではなく**状態**（カタログの追加済みなど）は
   * 札として出す——触れないものに触りに行かせない。
   */
  onClick?: (() => void) | undefined;
  /** 選ばれているか。選択でない使い方（ただ押すだけ）では渡さない */
  pressed?: boolean | undefined;
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
export function Pill({ children, onClick, pressed, label, small, dashed }: Props) {
  const shape = `${s.pill} ${small ? s.small : ''} ${dashed ? s.dashed : ''}`;

  /*
   * 押す先が無いものは `<span>`。**見た目は同じまま、ボタンではなくす。**
   * 無効なボタンとして置くと、薄くなるだけで形は押せるものと同じなので、
   * 指が伸びる。選ばれている見え方は `data-picked` で保つ。
   */
  if (onClick == null) {
    return (
      <span
        className={shape}
        {...(pressed == null ? {} : { 'data-picked': String(pressed) })}
        {...(label == null ? {} : { 'aria-label': label })}
      >
        {children}
      </span>
    );
  }

  return (
    <button
      type="button"
      className={shape}
      {...(pressed == null ? {} : { 'aria-pressed': pressed })}
      {...(label == null ? {} : { 'aria-label': label })}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
