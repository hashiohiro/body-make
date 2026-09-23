import { Segmented } from '../Segmented';
import { Strong } from '../Strong';
import { WEIGHT_UNIT_OPTIONS } from '../../lib/weight';
import type { Settings } from '../../types';
import { CardHeader } from '../CardHeader';
import ui from '../../styles/ui.module.scss';
import { useT } from '../../lib/i18n';

interface Props {
  settings: Settings;
  onUpdate: (patch: Partial<Settings>) => void;
}

/**
 * ウエイトの単位（設定 &gt; トレーニング &gt; ウエイトの単位）。
 *
 * **入力と表示を別に持つ。** 遠征先のジムにポンド表記の器具があるとき、
 * 打つのはポンド（器具がそうだから）でも、読むのはキロ（普段の記録と並べたいから）、
 * が成り立つ。逆も同じ。1 つの設定にまとめると、どちらかを諦めることになる。
 *
 * **記録そのものは常にキログラムで保存される。** ここで変えるのは
 * 打つときと読むときの見え方だけで、過去の記録は 1 件も書き換わらない。
 */
export function WeightUnitForm({ settings, onUpdate }: Props) {
  const t = useT();
  return (
    <>
      <section className={ui.card}>
        <CardHeader title={t('unitForm.input')} />
        <Segmented
          label={t('unitForm.inputHint')}
          value={settings.inputWeightUnit}
          options={WEIGHT_UNIT_OPTIONS.map((o) => ({ id: o.id, label: t(o.key) }))}
          onChange={(inputWeightUnit) => onUpdate({ inputWeightUnit })}
        />
        <p className={ui.note}>
          <Strong text={t('unitForm.inputNote')} values={[t('unitForm.inputNoteStrong')]} />
        </p>
      </section>

      <section className={ui.card}>
        <CardHeader title={t('settings.display')} />
        <Segmented
          label={t('unitForm.displayHint')}
          value={settings.displayWeightUnit}
          options={WEIGHT_UNIT_OPTIONS.map((o) => ({ id: o.id, label: t(o.key) }))}
          onChange={(displayWeightUnit) => onUpdate({ displayWeightUnit })}
        />
        <p className={ui.note}>
          {t('unitForm.displayNote')}
          <br />
          {t('unitForm.storedNote')}
        </p>
      </section>
    </>
  );
}
