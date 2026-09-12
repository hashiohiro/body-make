import type { ReactNode } from 'react';
import s from './MiniButton.module.scss';

interface Props {
  children: ReactNode;
  onClick: () => void;
  /** 読み上げに出す名前。記号 1 文字（× / ⇅ / ✎）のときは必ず渡す */
  label?: string | undefined;
  pressed?: boolean | undefined;
  disabled?: boolean | undefined;
}

/**
 * 行に添える小さな操作。**行の中の操作はすべてこれ。**
 *
 * 記号 1 文字（× / ⇅ / ✎ / ✓）や短い語（推移を見る・目標）で、
 * 行の右端に並ぶもの。指で狙える下限（32px）をここで担保する——
 * 行ごとに書くと、狭い行で小さく作ってしまう。
 *
 * 何をするかは呼び出し側が持つ。ここが持つのは的の大きさと見た目だけ。
 */
export function MiniButton({ children, onClick, label, pressed, disabled }: Props) {
  return (
    <button
      type="button"
      className={s.mini}
      {...(label == null ? {} : { 'aria-label': label })}
      {...(pressed == null ? {} : { 'aria-pressed': pressed })}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
