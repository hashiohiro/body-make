import { useId } from 'react';
import { NumericInput } from './NumericInput';
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
}

/**
 * ラベルを上に置いた数字の欄。**体組成の入力（朝 / 夕）で使う。**
 *
 * 欄そのものは `NumericInput`。ここが持つのは**ラベルの置き場所**だけ
 * （上に小さく置いて、数字は大きく中央に出す）。
 * 1 行に 2 つ並べるので、ラベルを横に置くと数字の幅が削られる。
 */
export function NumberField({ label, value, fallback, step, min, max, onCommit }: Props) {
  const id = useId();

  return (
    <div className={s.field}>
      <label className={s.fieldLabel} htmlFor={id}>
        {label}
      </label>
      <NumericInput
        id={id}
        className={s.input}
        value={value}
        fallback={fallback}
        step={step}
        min={min}
        max={max}
        onCommit={onCommit}
      />
    </div>
  );
}
