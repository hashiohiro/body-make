import ui from '../styles/ui.module.scss';
import type { SelectOption } from './Select';

interface Props<T extends string> {
  options: readonly SelectOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** 何を選ぶ列か。読み上げに出す */
  label: string;
}

/**
 * どちらか一方を、枠続きで見せる切り替え。**アプリ中のセグメントはすべてこれ。**
 *
 * **`ChipGroup` との違いは「主題そのものが入れ替わるか」。**
 * ここは体組成／トレーニングの切り替えや、目標の立て方のように、
 * 選んだ先で**中身が別のものになる**場面だけ。絞り込みや表示の切り替えは
 * `ChipGroup`（独立した丸チップ）のほう。
 *
 * 形（枠 + `role="group"` + `aria-pressed`）を 2 か所で組み立てていた。
 * `ChipGroup` を作ったときに 15 か所で見たのと同じ形で、
 * 写すたびに読み上げの名前が抜ける余地がある。
 */
export function Segmented<T extends string>({ options, value, onChange, label }: Props<T>) {
  return (
    <div className={ui.segmented} role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          className={ui.segment}
          aria-pressed={value === o.id}
          onClick={() => onChange(o.id)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
