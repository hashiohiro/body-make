import { Segmented } from '../Segmented';
import { WEIGHT_UNIT_OPTIONS } from '../../lib/weight';
import type { Settings } from '../../types';
import { CardHeader } from '../CardHeader';
import ui from '../../styles/ui.module.scss';

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
  return (
    <>
      <section className={ui.card}>
        <CardHeader title="入力" />
        <Segmented
          label="重量を打つときの単位"
          value={settings.inputWeightUnit}
          options={WEIGHT_UNIT_OPTIONS}
          onChange={(inputWeightUnit) => onUpdate({ inputWeightUnit })}
        />
        <p className={ui.note}>
          セットの重量欄の既定です。記録画面の重量欄の見出しから
          <b>その場で切り替えられます</b>（そちらはこの設定を書き換えません）。
        </p>
      </section>

      <section className={ui.card}>
        <CardHeader title="表示" />
        <Segmented
          label="重量を読むときの単位"
          value={settings.displayWeightUnit}
          options={WEIGHT_UNIT_OPTIONS}
          onChange={(displayWeightUnit) => onUpdate({ displayWeightUnit })}
        />
        <p className={ui.note}>
          最高重量・推定1RM・挙上量・目標の出し方が変わります。
          <br />
          記録はどちらを選んでもキログラムで保存されるので、切り替えても過去の記録は変わりません。
        </p>
      </section>
    </>
  );
}
