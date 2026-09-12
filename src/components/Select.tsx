import { Fragment } from 'react';

/** 選択肢 1 つ。`id` が値、`label` が出す文字（`ChipGroup` と同じ形） */
export interface SelectOption<T> {
  id: T;
  label: string;
}

interface Props<T extends string> {
  value: T;
  options: readonly SelectOption<T>[];
  onChange: (value: T) => void;
  /** 見出しラベルを別に置けない場所で使う */
  label?: string | undefined;
  /** 外のラベルと `htmlFor` で結ぶとき */
  id?: string | undefined;
  /**
   * この選択肢の下に区切り線を引く。
   * 端末に従うものと、名指しで選ぶものの境目に使う（配色の選択）。
   * `option` で線を引くと 1 行ぶんの高さを取るので `<hr>` にする——
   * 古いブラウザは無視するだけで、選択肢は壊れない。
   */
  dividerAfter?: T | undefined;
}

/**
 * 1 つ選ぶ欄。**アプリ中の `<select>` はすべてこれ。**
 *
 * 6 か所で `<select value onChange>` ＋ `options.map` を書いていた。
 * どれも `e.target.value as なにか` のキャストを含んでいて、**型の抜け道が
 * 選択肢の数だけ開いていた**（選択肢の並びと値の型がずれても気づけない）。
 * 値の型を引数で持てば、キャストはここ 1 か所で済む。
 *
 * 見た目は置かれた場所が持つ（`.newField` や `.formRow` が `select` を直接指す）。
 * ここが持つのは「選択肢と値の結び方」だけ。
 */
export function Select<T extends string>({
  value,
  options,
  onChange,
  label,
  id,
  dividerAfter,
}: Props<T>) {
  return (
    <select
      id={id}
      value={value}
      {...(label == null ? {} : { 'aria-label': label })}
      onChange={(e) => onChange(e.target.value as T)}
    >
      {options.map((o) => (
        <Fragment key={o.id}>
          <option value={o.id}>{o.label}</option>
          {dividerAfter === o.id && <hr />}
        </Fragment>
      ))}
    </select>
  );
}
