import { REP_UNIT_KEYS } from '../../lib/exerciseCatalog';
import { useWeightFormat } from '../../hooks/useWeightUnit';
import { useT } from '../../lib/i18n';
import type { ExercisePoint, RepUnit } from '../../types';
import s from './training.module.scss';

/**
 * その日のセットを「60 kg × 10回」で並べる。重量の無いセット（自重・秒）は「10回」「30秒」。
 * 重量は打った値を読むときの単位で出し、小数は要るときだけ付ける（60 / 62.5）。
 * 記録のカード（今日）と入力ダイアログ（前回）で同じ札を使う。
 */
export function SetChips({
  point,
  repUnit,
  muted,
}: {
  point: ExercisePoint | null;
  repUnit: RepUnit;
  /** 前回のセット（入力ダイアログ）。今日の札と見分けるため薄く出す */
  muted?: boolean | undefined;
}) {
  const t = useT();
  const { label: unitLabel, conv } = useWeightFormat();
  const sets = (point?.sets ?? []).filter((x) => x.reps != null || x.weight != null);
  if (sets.length === 0) return null;
  // 回数には単位が付くので、重量にも付ける（「9×10」では何の 9 か読めない。2026/10/10、利用者の指摘）
  const amount = (n: number | null) =>
    n == null ? '—' : t('totals.amount', { n, unit: t(REP_UNIT_KEYS[repUnit]) });
  return (
    <ul
      className={`${s.setChips} ${muted ? s.setChipsMuted : ''}`}
      data-e2e={muted ? 'set-previous-chips' : 'exercise-set-chips'}
    >
      {sets.map((x) => (
        <li key={x.index} data-e2e="set-chip">
          {x.weight != null
            ? t('card.setOf', {
                weight: Number(conv(x.weight).toFixed(1)),
                unit: unitLabel,
                amount: amount(x.reps),
              })
            : amount(x.reps)}
        </li>
      ))}
    </ul>
  );
}
