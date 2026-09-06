import { useId } from 'react';
import { useNumericField } from '../hooks/useNumericField';
import s from './QuickEntry.module.scss';

interface Props {
  label: string;
  value: number | null;
  /** 直近の記録。未入力のときプレースホルダに薄く出して、目安にする */
  fallback: number | null;
  step: number;
  min: number;
  max: number;
  onCommit: (value: number | null) => void;
  /** 読むだけ。押せる的は残すが、値は変えられない（カレンダーから開いた過去の日） */
  readOnly?: boolean | undefined;
}

/**
 * ± ボタンは置かない。
 * モバイルの 1 行に収めると数値の表示幅が削られ、肝心の値が読みにくくなる。
 * 直接打つほうが速く、前回値はプレースホルダで示す。
 */
export function NumberField({ label, value, fallback, step, min, max, onCommit, readOnly }: Props) {
  const id = useId();
  const field = useNumericField(value, min, max, onCommit);

  return (
    <div className={s.field}>
      <label className={s.fieldLabel} htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className={s.input}
        type="number"
        inputMode="decimal"
        step={step}
        min={min}
        max={max}
        placeholder={readOnly ? '—' : fallback == null ? '—' : String(fallback)}
        readOnly={readOnly}
        value={field.text}
        onChange={(e) => field.handleChange(e.target.value)}
        onBlur={field.handleBlur}
      />
    </div>
  );
}
