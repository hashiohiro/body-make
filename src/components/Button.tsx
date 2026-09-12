import type { ReactNode } from 'react';
import ui from '../styles/ui.module.scss';

/**
 * 押した結果の性質。**1 つだけ選ぶ。**
 *
 *   （既定）… ふつうの決定。面に 2 つ以上並ぶときの地の姿
 *   primary … 勧める答え。**1 つの面に 1 つだけ**
 *   ghost   … 控える。並びの中で主役でないもの（やめる・閉じる・折りたたみ）
 *   danger  … 消えるものがある。**塗らずに字の色で示す**
 *
 * 以前は `btn` + `btnPrimary` / `btnGhost` / `btnDanger` を文字列で組み立てていて、
 * **重ねられないものが重ねられる形**になっていた（実際、`ChoicePanel` の型は
 * 「勧める」と「消える」を同時に指定できた）。1 つの軸にすれば書けなくなる。
 */
type Tone = 'primary' | 'ghost' | 'danger';

interface Props {
  children: ReactNode;
  onClick: () => void;
  tone?: Tone | undefined;
  /** 面の中の入口・切り替えなら `sub`。既定は面の決定（`--tap-main`） */
  size?: 'sub' | undefined;
  disabled?: boolean | undefined;
  /** 読み上げに出す名前。中の文字だけで足りるときは渡さない */
  label?: string | undefined;
  pressed?: boolean | undefined;
  /** 押すと下に面が開くとき（詳細設定・レビューの値） */
  expanded?: boolean | undefined;
  /**
   * **置き場所だけ**を渡す（幅・余白）。見た目は `tone` と `size` が持つ。
   * 色や大きさをここから足すと、軸を 1 つにした意味が無くなる。
   */
  className?: string | undefined;
}

const TONE_CLASS: Record<Tone, string> = {
  primary: ui.btnPrimary ?? '',
  ghost: ui.btnGhost ?? '',
  // 消えるものがある答えは、塗りをやめて字の色で示す（塗ると勧めているように見える）
  danger: ui.btnDanger ?? '',
};

/**
 * 面の決定ボタン。**アプリ中の決定ボタンはすべてこれ。**
 *
 * 41 か所で `className` を文字列で組み立てていた。`type="button"` の付け忘れも、
 * 重ねられない見た目の取り合わせも、写すたびに起こりうる。
 *
 * 行に添える操作（× ⇅ 設定）は `MiniButton`、選ぶ的は `Pill` / `ChipGroup`。
 * **ここは「この面で何をするか」を決める的**だけを持つ。
 */
export function Button({
  children,
  onClick,
  tone,
  size,
  disabled,
  label,
  pressed,
  expanded,
  className,
}: Props) {
  return (
    <button
      type="button"
      className={[ui.btn, tone && TONE_CLASS[tone], size === 'sub' && ui.btnSm, className]
        .filter(Boolean)
        .join(' ')}
      disabled={disabled}
      {...(label == null ? {} : { 'aria-label': label })}
      {...(pressed == null ? {} : { 'aria-pressed': pressed })}
      {...(expanded == null ? {} : { 'aria-expanded': expanded })}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
