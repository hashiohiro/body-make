import { useId } from 'react';
import { useNumericField } from '../hooks/useNumericField';
import s from './QuickEntry.module.scss';

interface Props {
  label: string;
  value: number | null;
  /** 未入力の状態で ± を押したときの開始値（前回の記録） */
  fallback: number | null;
  step: number;
  min: number;
  max: number;
  onCommit: (value: number | null) => void;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export function NumberField({ label, value, fallback, step, min, max, onCommit }: Props) {
  const id = useId();
  const field = useNumericField(value, min, max, onCommit);

  const bump = (delta: number) => {
    const base = value ?? fallback ?? (min + max) / 2;
    field.setNumber(Math.min(max, Math.max(min, round1(base + delta))));
  };

  return (
    <div className={s.field}>
      <label className={s.fieldLabel} htmlFor={id}>
        {label}
      </label>
      <div className={s.stepper}>
        <button type="button" className={s.step} onClick={() => bump(-step)} aria-label={`${label}を減らす`}>
          −
        </button>
        <input
          id={id}
          className={s.input}
          type="number"
          inputMode="decimal"
          step={step}
          min={min}
          max={max}
          placeholder="—"
          value={field.text}
          onChange={(e) => field.handleChange(e.target.value)}
          onBlur={field.handleBlur}
        />
        <button type="button" className={s.step} onClick={() => bump(step)} aria-label={`${label}を増やす`}>
          ＋
        </button>
      </div>
    </div>
  );
}
