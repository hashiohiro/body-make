import { useState } from 'react';
import type { ReactNode } from 'react';
import { ChoicePanel } from './ChoicePanel';
import { Modal } from './Modal';

export interface ConfirmRequest {
  /**
   * 問い。見出しに出す。**「〜しますか？」**で書く。
   * 何が消えるかは `note` のほう——見出しに詰めると題が読めなくなる。
   */
  title: string;
  /** 何についての問いか（種目名・プリセット名）。名前だけ */
  subject?: string | undefined;
  /** 押したら起きること。**失われるものを必ず書く** */
  note?: ReactNode;
  /** 進む側のボタン。**結果を書く**（「記録ごと削除」）。「OK」は書かない */
  confirmLabel: string;
  /** 消えるものがあるか。色を付ける */
  destructive?: boolean | undefined;
  onConfirm: () => void;
}

/**
 * 消える前に聞く面。**アプリ中の確認はすべてこれ。**
 *
 * `confirm()` を 8 か所で使っていた。**あれは「OK / キャンセル」しか書けない**ので、
 * どちらがどちらの結果なのかを本文から読み取らせることになる（しかもボタンの語と
 * 並び順はブラウザが決めるので、アプリの側では揃えられない）。
 * 押す言葉に結果を書けば、読む前に決まる——それを `ChoicePanel` が持っている。
 *
 * 器は `Modal`（高さは中身なり）。スマホでは下から出るシートになるので、
 * **押すボタンが指の近くに来る**——画面中央のシステムダイアログより届きやすい。
 *
 * 答えは 1 つ＋やめる。2 つ以上の答えを聞きたい面は `ChoicePanel` を直接使う
 * （カタログからの追加・移行先の衝突）。あれは「消える確認」ではなく選択なので、
 * 見出しの問いも器も違っていい。
 */
export function ConfirmDialog({
  request,
  onClose,
}: {
  request: ConfirmRequest | null;
  onClose: () => void;
}) {
  if (request == null) return null;

  return (
    <Modal open title={request.title} onClose={onClose}>
      <ChoicePanel
        subject={request.subject}
        choices={[
          {
            label: request.confirmLabel,
            tone: request.destructive ? 'danger' : undefined,
            onSelect: () => {
              request.onConfirm();
              onClose();
            },
          },
        ]}
        note={request.note}
        onCancel={onClose}
      />
    </Modal>
  );
}

/**
 * 確認を 1 行で出せるようにする。
 *
 * ```tsx
 * const [ask, confirmDialog] = useConfirm();
 * ...
 * onClick={() => ask({ title: '…', confirmLabel: '…', onConfirm: () => remove(id) })}
 * ...
 * {confirmDialog}
 * ```
 *
 * 状態を呼び出し側に持たせないのは、**問い方を面ごとに組み立てさせない**ため。
 * `confirm()` の頃は、同じ「プリセットを削除」が 2 か所に別々に書かれていた。
 */
export function useConfirm(): [(request: ConfirmRequest) => void, ReactNode] {
  const [request, setRequest] = useState<ConfirmRequest | null>(null);
  return [
    setRequest,
    <ConfirmDialog key="confirm" request={request} onClose={() => setRequest(null)} />,
  ];
}
