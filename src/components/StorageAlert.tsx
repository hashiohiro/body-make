import { markExported } from '../lib/device';
import { exportJson } from '../lib/io';
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
 * 出せる逃げ道は 1 つ——いま画面にある内容をファイルへ出すこと——なので、
 * ボタンもそれだけにする。
 */
export function StorageAlert({ data, failed }: Props) {
  if (!failed) return null;

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
