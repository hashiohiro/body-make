import { Modal } from './Modal';
import { DEMO_TODAY, formatMD } from '../lib/date';
import { Button } from './Button';
import ui from '../styles/ui.module.scss';
import { useT } from '../lib/i18n';

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
  const t = useT();

  return (
    <Modal open title={t('demo.title')} onClose={onStart}>
      <p className={ui.note}>{t('demo.note1')}</p>
      <p className={ui.note}>{t('demo.note2')}</p>
      <p className={ui.note}>{t('demo.note3', { date: formatMD(DEMO_TODAY) })}</p>
      <p className={ui.note}>{t('demo.note4')}</p>

      <div className={ui.btnRow}>
        <Button tone="primary" onClick={onStart}>
          {t('demo.start')}
        </Button>
      </div>
    </Modal>
  );
}
