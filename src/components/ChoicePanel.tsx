import type { ReactNode } from 'react';
import { Button } from './Button';
import ui from '../styles/ui.module.scss';
import s from './ChoicePanel.module.scss';

/** 選べる答え 1 つ。**押す言葉に結果を書く。** */
export interface Choice {
  label: string;
  onSelect: () => void;
  /**
   * 答えの性質。**1 つだけ**（`Button` の `tone` と同じ軸）。
   *   primary … 勧める答え。1 つだけ
   *   danger  … 消えるものがある答え。押す前に色で分かるようにする
   *
   * 以前は `primary` と `destructive` の 2 つの真偽値で、**両方立てられた**。
   * 「勧める」と「消える」を同時に言えてしまうのは、言葉として矛盾している。
   */
  tone?: 'primary' | 'danger' | undefined;
}

interface Props {
  /** 何について聞かれているか。**問いは面の見出しが持つ**ので、ここは相手の名前だけ */
  subject?: string | undefined;
  /**
   * 答えを選ぶ前に読む一行。**いまどうなっているか**を書く
   * （「すでに記録がある日が 3 日ぶんあります」）。
   * 選んだ結果は `note` のほう——先に状況、あとに結果の順で読ませる。
   */
  lead?: ReactNode;
  choices: readonly Choice[];
  /** 答えの下に置く一行。**どちらを選んでも起きること**を書く */
  note?: ReactNode;
  /** 何も選ばずにやめる。別の行に置く（答えと並べると 3 択に見える） */
  onCancel?: (() => void) | undefined;
  cancelLabel?: string | undefined;
}

/**
 * 答えを聞く面。**答えはボタンそのもの。**
 *
 * `confirm()` の OK / キャンセルでは、どちらがどちらの結果なのかを文から
 * 読み取らせることになる。押す言葉に結果を書けば、読む前に決まる。
 *
 * **やめるは別の行に置く。**答えと並べると 3 択に見えて、
 * 「やめる」も選択肢の 1 つだと読めてしまう。あれは答えないための出口。
 *
 * 消えるものがある答えには色を付ける（`destructive`）。
 * 何が消えるかは `note` に書く——色だけでは何が起きるか分からない。
 */
export function ChoicePanel({
  subject,
  lead,
  choices,
  note,
  onCancel,
  cancelLabel = 'やめる',
}: Props) {
  return (
    <div>
      {subject != null && <p className={s.subject}>{subject}</p>}
      {lead != null && <p className={ui.note}>{lead}</p>}

      <div className={ui.btnRow}>
        {choices.map((c) => (
          <Button key={c.label} tone={c.tone} onClick={c.onSelect}>
            {c.label}
          </Button>
        ))}
      </div>

      {note != null && <p className={ui.note}>{note}</p>}

      {onCancel && (
        <div className={ui.btnRow}>
          <Button tone="ghost" onClick={onCancel}>
            {cancelLabel}
          </Button>
        </div>
      )}
    </div>
  );
}
