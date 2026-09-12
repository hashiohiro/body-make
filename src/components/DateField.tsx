interface Props {
  /** 'YYYY-MM-DD'。空は「決めていない」 */
  value: string;
  onChange: (value: string) => void;
  /** 読み上げに出す名前。外のラベルと結ぶときは `id` のほうを使う */
  label?: string | undefined;
  id?: string | undefined;
  /** 置かれた場所が持つ見た目 */
  className?: string | undefined;
  /**
   * 空にできるか。**既定は空にできない。**
   *
   * 空の扱いが 4 か所で 3 通りに分かれていた——空を弾く（日付ナビ）／
   * `null` にする（目標日）／素通し（移行の期間）。素通しの 2 か所は、
   * **日付を消すと「指定なし」に落ちて範囲が黙って全期間に広がる**形だった。
   * 消せてよい欄（目標日）だけが明示的に手を挙げる。
   */
  clearable?: boolean | undefined;
}

/**
 * 日付を選ぶ欄。**アプリ中の `type="date"` はすべてこれ。**
 *
 * 持っているのは「空にできるか」と、字の大きさ（`field-text`）。
 * 端末のピッカーが出るので、見た目の作り込みはしない。
 */
export function DateField({ value, onChange, label, id, className, clearable }: Props) {
  return (
    <input
      id={id}
      className={className}
      type="date"
      value={value}
      {...(label == null ? {} : { 'aria-label': label })}
      onChange={(e) => {
        // 空を受けないなら、消す操作はいまの値を残す（画面と値をずらさない）
        if (e.target.value === '' && !clearable) return;
        onChange(e.target.value);
      }}
    />
  );
}
