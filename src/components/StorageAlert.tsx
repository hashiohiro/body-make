import { markExported } from '../lib/device';
import { exportJson } from '../lib/io';
import { currentBackend } from '../lib/storage';
import type { AppData } from '../types';
import ui from '../styles/ui.module.scss';
import s from './StorageAlert.module.scss';

interface Props {
  data: AppData;
  /** 直近の保存に失敗しているか（hooks/useBodyData.ts） */
  failed: boolean;
}

/**
 * 保存できていないことを画面に出す。
 *
 * **このアプリでいちばん重い失敗はここ。** 打った値は画面に出ているので、
 * 何も言わなければ入力は続く。そして次に開いたときに、その日ぶんがまとめて消えている。
 *
 * だからこれだけは全画面に出す。閉じられるようにもしない
 * （閉じたあとに打った値も同じように消えるので、閉じられることに意味がない）。
 *
 * **失敗は 2 種類あって、言うべきことが逆になる。**
 * 書けないだけなら「いまの内容が失われる」、読めなかったのなら
 * 「記録は消えていないので触らないでほしい」。同じ文面で済ませない。
 */
export function StorageAlert({ data, failed }: Props) {
  if (!failed) return null;

  /*
   * 移行済みの端末で保存領域を開けなかった場合。
   *
   * このとき画面は**空の記録**を表示している。「保存できていません」とだけ言うと、
   * 記録が消えたと読めてしまい、最悪の対応（作り直す・すべて削除して入れ直す）を招く。
   * 言うべきなのは「消えていない」と「このまま触らないでほしい」のほう。
   */
  if (currentBackend() === 'none') {
    return (
      <div className={s.alert} role="alert">
        <p className={s.message}>
          <b>記録を読み出せませんでした。</b>
          <br />
          この端末の保存領域を開けませんでした。<b>記録は消えていません。</b>
          この画面が空に見えても、そのままにしてください。いま打った内容は保存されません。
          開き直すと元に戻ることがあります。
        </p>
        <div className={ui.btnRow}>
          <button
            type="button"
            className={`${ui.btn} ${ui.btnPrimary}`}
            onClick={() => window.location.reload()}
          >
            開き直す
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={s.alert} role="alert">
      <p className={s.message}>
        <b>記録を保存できていません。</b>
        <br />
        いま画面に出ている内容は、このまま閉じると失われます。ブラウザの空き容量が足りないか、
        プライベートモードで開いている可能性があります。
      </p>
      <div className={ui.btnRow}>
        <button
          type="button"
          className={`${ui.btn} ${ui.btnPrimary}`}
          onClick={() => {
            exportJson(data);
            markExported();
          }}
        >
          いますぐ JSON で書き出す
        </button>
      </div>
    </div>
  );
}
