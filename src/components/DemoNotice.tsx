import { Modal } from './Modal';
import { DEMO_TODAY, formatMD } from '../lib/date';
import ui from '../styles/ui.module.scss';

interface Props {
  onStart: () => void;
}

/**
 * デモを開いたときの断り書き。
 *
 * **上書きする前に出す。**
 * デモは開くたびに初期データへ戻す。断りなく戻すと、前に触った内容が
 * 理由の分からないまま消えたように見える。何が起きるかを先に書いて、
 * 進んだ時点で戻す。
 *
 * 出口はこのボタンだけにする（Esc も背面も同じ扱い）。
 * 閉じるだけで通り抜けられると、初期データに戻っている日と戻っていない日ができて、
 * 見せている画面がどの状態なのか説明できなくなる。
 *
 * 書くのは 4 点だけ。デモであること、上書きされること、日付が止まっていること、
 * 保存先がこの端末であること。使い方の案内は置かない。
 */
export function DemoNotice({ onStart }: Props) {
  return (
    <Modal open title="デモ" onClose={onStart}>
      <p className={ui.note}>
        操作を試すためのサイトです。中身は作成者の記録で、開き直すたびに初期データへ戻ります。
      </p>
      <p className={ui.note}>この端末で入力した内容は、進むと初期データで上書きされます。</p>
      <p className={ui.note}>
        記録に合わせて、今日を {formatMD(DEMO_TODAY)} として動きます。日付は進みません。
      </p>
      <p className={ui.note}>記録が送られる先はありません。この端末のブラウザにだけ残ります。</p>

      <div className={ui.btnRow}>
        <button type="button" className={`${ui.btn} ${ui.btnPrimary}`} onClick={onStart}>
          初期データではじめる
        </button>
      </div>
    </Modal>
  );
}
