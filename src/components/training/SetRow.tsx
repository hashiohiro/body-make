import { useNumericField } from '../../hooks/useNumericField';
import { REPS_RANGE, SET_WEIGHT_RANGE } from '../../lib/storage';
import type { RepUnit, SetPoint, WorkSet } from '../../types';
import s from './training.module.scss';

interface NumberCellProps {
  value: number | null;
  /** 直近の値。未入力のときプレースホルダに薄く出す */
  fallback: number | null;
  min: number;
  max: number;
  integer?: boolean;
  ariaLabel: string;
  onCommit: (value: number | null) => void;
}

/**
 * ± ボタンは置かない。
 * 1 行に重量と回数を並べる都合上、ボタンを付けると数値の表示幅が削られて読みにくくなる。
 * 打鍵途中を潰さない確定ロジックは useNumericField に集約されている。
 */
function NumberCell({ value, fallback, min, max, integer, ariaLabel, onCommit }: NumberCellProps) {
  const field = useNumericField(value, min, max, onCommit);

  return (
    <input
      className={s.input}
      type="number"
      inputMode={integer ? 'numeric' : 'decimal'}
      step={integer ? 1 : 'any'}
      min={min}
      max={max}
      placeholder={fallback == null ? '—' : String(fallback)}
      aria-label={ariaLabel}
      value={field.text}
      onChange={(e) => field.handleChange(e.target.value)}
      onBlur={field.handleBlur}
    />
  );
}

interface Props {
  index: number;
  set: WorkSet;
  point: SetPoint | null;
  repUnit: RepUnit;
  fallbackWeight: number | null;
  fallbackReps: number | null;
  onValue: (field: 'weight' | 'reps', value: number | null) => void;
  onRemove: () => void;
}

export function SetRow({
  index,
  set,
  point,
  repUnit,
  fallbackWeight,
  fallbackReps,
  onValue,
  onRemove,
}: Props) {
  const role = point?.role ?? 'work';

  return (
    <div className={s.setRow} data-set-row={index}>
      <span className={`${s.setIndex} ${role === 'top' ? s.setIndexTop : ''}`}>
        {role === 'top' ? 'TOP' : index + 1}
      </span>

      <NumberCell
        value={set.reps}
        fallback={fallbackReps}
        integer
        min={REPS_RANGE[0]}
        max={REPS_RANGE[1]}
        ariaLabel={`${index + 1}セット目の${repUnit === 'seconds' ? '秒数' : '回数'}`}
        onCommit={(v) => onValue('reps', v)}
      />

      <span className={s.times} aria-hidden="true">
        ×
      </span>

      <NumberCell
        value={set.weight}
        fallback={fallbackWeight}
        min={SET_WEIGHT_RANGE[0]}
        max={SET_WEIGHT_RANGE[1]}
        ariaLabel={`${index + 1}セット目の重量`}
        onCommit={(v) => onValue('weight', v)}
      />

      <button
        type="button"
        className={s.rowBtn}
        aria-label={`${index + 1}セット目を削除`}
        onClick={onRemove}
      >
        ×
      </button>
    </div>
  );
}
