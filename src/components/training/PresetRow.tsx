import s from './training.module.scss';
import { useT } from '../../lib/i18n';

interface Props {
  name: string;
  /** その組み合わせでやる部位の読み。名前だけでは中身が思い出せない */
  groups: string;
  /** 入っている種目の数 */
  count: number;
  /** 読み上げに出す名前。押した先が面ごとに違うので、呼ぶ側が決める */
  label: string;
  onClick: () => void;
}

/**
 * プリセット 1 件の行。**押して選ぶ面はどこも同じ形。**
 *
 * ＋ の「プリセットから入れる」、週メニューの「曜日に置く」、
 * 記録画面の帯（まだ空の日）の 3 か所に、同じ 3 つの `span` を写していた。
 * 片方だけ直すと、同じものが面によって違う形で出る。
 *
 * 違うのは**押した先と読み上げ名だけ**なので、それだけを受け取る。
 */
export function PresetRow({ name, groups, count, label, onClick }: Props) {
  const t = useT();

  return (
    <button type="button" className={s.presetPick} aria-label={label} onClick={onClick}>
      <span className={s.presetName}>{name}</span>
      <span className={s.presetGroups}>{groups}</span>
      <span className={s.presetCount}>{t('training.exercises', { n: count })}</span>
    </button>
  );
}
