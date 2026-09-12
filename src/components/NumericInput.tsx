import { useNumericField } from '../hooks/useNumericField';

interface Props {
  id?: string | undefined;
  value: number | null;
  min: number;
  max: number;
  /**
   * 刻み。`'any'` は「端末に任せる」。
   * セットの重量は 2.5kg プレートで 0.5 刻みになるので、値域だけ見て刻みは縛らない。
   */
  step?: number | 'any';
  /** 残す小数の桁数。既定は 1 桁。係数のように 0.65 を落としたくない欄だけ 2 を渡す */
  decimals?: number | undefined;
  /**
   * 小数を取らない欄（レップ数・本数）。
   * キーボードを数字だけにして、刻みも 1 にする。
   */
  integer?: boolean | undefined;
  placeholder?: string;
  /**
   * 直近の値。**未入力のときプレースホルダに薄く出して目安にする。**
   * `placeholder` を直接渡すより、こちらのほうが「前回値」だと分かる。
   */
  fallback?: number | null | undefined;
  // CSS Modules のクラス名は string | undefined で来る
  className?: string | undefined;
  /** 見出しラベルを置けない場所（一覧の行の中など）で使う */
  ariaLabel?: string | undefined;
  onCommit: (value: number | null) => void;
}

/**
 * 数字を打つ欄。**アプリ中の `type="number"` はすべてこれ。**
 *
 * ± ボタンは置かない。1 行に重量と回数を並べる都合上、ボタンを付けると
 * 数値の表示幅が削られて読みにくくなる。直接打つほうが速く、前回値は
 * プレースホルダで示す。
 *
 * 打鍵途中を潰さない確定（`useNumericField`）はもともと共通だったのに、
 * **`<input>` のほうは 3 か所で書いていた**（ここ・体組成の欄・セット行）。
 * 属性が 8 つ並ぶので、片方にだけ足した口（`decimals`）が他へ回らない形だった。
 */
export function NumericInput({
  id,
  value,
  min,
  max,
  step = 0.1,
  decimals,
  integer,
  placeholder,
  fallback,
  className,
  ariaLabel,
  onCommit,
}: Props) {
  const field = useNumericField(value, min, max, onCommit, decimals);

  return (
    <input
      id={id}
      className={className}
      type="number"
      inputMode={integer ? 'numeric' : 'decimal'}
      step={integer ? 1 : step}
      min={min}
      max={max}
      placeholder={placeholder ?? (fallback == null ? '—' : String(fallback))}
      aria-label={ariaLabel}
      value={field.text}
      onChange={(e) => field.handleChange(e.target.value)}
      onBlur={field.handleBlur}
    />
  );
}
