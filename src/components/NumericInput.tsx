import { useNumericField } from '../hooks/useNumericField';

interface Props {
  id: string;
  value: number | null;
  min: number;
  max: number;
  step?: number;
  placeholder?: string;
  className?: string;
  onCommit: (value: number | null) => void;
}

/** 設定画面のような、ステッパーを持たない素の数値入力欄 */
export function NumericInput({
  id,
  value,
  min,
  max,
  step = 0.1,
  placeholder,
  className,
  onCommit,
}: Props) {
  const field = useNumericField(value, min, max, onCommit);

  return (
    <input
      id={id}
      className={className}
      type="number"
      inputMode="decimal"
      step={step}
      min={min}
      max={max}
      placeholder={placeholder}
      value={field.text}
      onChange={(e) => field.handleChange(e.target.value)}
      onBlur={field.handleBlur}
    />
  );
}
