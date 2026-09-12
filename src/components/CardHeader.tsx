import type { ReactNode } from 'react';
import ui from '../styles/ui.module.scss';

interface Props {
  title: string;
  /**
   * 見出しの右に添える一行。**数と単位だけ**にする。
   * 説明は本文（`ui.note`）が持つ——見出しの行に文が入ると、題が読めなくなる。
   */
  hint?: ReactNode;
  /** 見出しの行に置く操作（検索を畳んだ的など）。無ければ置かない */
  children?: ReactNode;
}

/**
 * カードの見出し。**アプリ中のカードの頭はすべてこれ。**
 *
 * 同じ形（`<header>` + `<h2>` + 右のひとこと）が 25 か所に写してあった。
 * 写すたびに `<div>` で書いたり `h3` にしたりする余地があるし、
 * ひとことの置き場所（右端）も手で決め直すことになる。
 *
 * 見出しは h2 で固定する。カードはどれも画面（h1）の直下にある兄弟なので、
 * 段を掘る理由が無い。
 */
export function CardHeader({ title, hint, children }: Props) {
  return (
    <header className={ui.cardHeader}>
      <h2 className={ui.cardTitle}>{title}</h2>
      {hint != null && <span className={ui.hint}>{hint}</span>}
      {children}
    </header>
  );
}
