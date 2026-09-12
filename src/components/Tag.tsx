import type { ReactNode } from 'react';
import s from './Tag.module.scss';

/**
 * 札の種類。**色ではなく、書いてあることの性質で選ぶ。**
 *
 *   fact    … 事実（部位・器具・記録あり）。中立の地
 *   chosen  … 本人が決めたこと（目標の立て方・目標の値）。アクセント
 *   state   … いまの状態への断り（マイ種目に未追加・非表示）。輪郭だけ
 *
 * `state` に注意の色を使わないのは、**欠けを指しているわけではない**から。
 * マイ種目はお気に入りのようなもので、入っていないことは間違いではない。
 */
type Kind = 'fact' | 'chosen' | 'state';

interface Props {
  children: ReactNode;
  kind?: Kind | undefined;
}

/**
 * 名前に添える小さな札。**アプリ中の札はすべてこれ。**
 *
 * クラスが 5 つに分かれていた（`exTag` / `kindTag` / `goalTag` / `adhocTag` /
 * `catalogTag`）うえ、**2 つは CSS が無く素の文字で出ていた**。
 * 器を 1 つにして、違いを 3 種類の役目に畳む。
 */
export function Tag({ children, kind = 'fact' }: Props) {
  return <span className={`${s.tag} ${s[kind]}`}>{children}</span>;
}
