import { markExported } from '../lib/device';
import { Strong } from './Strong';
import { exportJson } from '../lib/io';
import { currentBackend } from '../lib/storage';
import type { AppData } from '../types';
import { Button } from './Button';
import ui from '../styles/ui.module.scss';
import s from './StorageAlert.module.scss';
import { useT } from '../lib/i18n';

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
  const t = useT();
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
          <b>{t('alert.readFailed')}</b>
          <br />
          <Strong text={t('alert.readFailedNote')} values={[t('alert.notLost')]} />
        </p>
        <div className={ui.btnRow}>
          <Button tone="primary" onClick={() => window.location.reload()}>
            {t('alert.reopen')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={s.alert} role="alert">
      <p className={s.message}>
        <b>{t('alert.saveFailed')}</b>
        <br />
        {t('alert.saveFailedNote')}
      </p>
      <div className={ui.btnRow}>
        <Button
          tone="primary"
          onClick={() => {
            exportJson(data);
            markExported();
          }}
        >
          {t('alert.exportNow')}
        </Button>
      </div>
    </div>
  );
}
