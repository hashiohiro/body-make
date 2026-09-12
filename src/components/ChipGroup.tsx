import { useId } from 'react';
import ui from '../styles/ui.module.scss';
import s from './ChipGroup.module.scss';

/** 選択肢 1 つ。`id` が値、`label` が出す文字 */
export interface ChipOption<T> {
  id: T;
  label: string;
}

interface Props<T> {
  options: readonly ChipOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /**
   * 何を選ぶ行か。
   *
   * **既定は読み上げにだけ出す**（`aria-label`）。チップの語だけで何の話か分かる場面
   * （表示期間・表示する値）では、見出しを置くと行が 1 段増えるだけになる。
   */
  label: string;
  /**
   * 見出しを画面にも出すか。
   *
   * 同じ面に行が 2 つ以上あるときに使う（カタログの 器具 / 部位）。
   * どちらが何の絞り込みなのか、チップの語だけでは決められない。
   */
  showLabel?: boolean | undefined;
  /** 折り返す行に使う詰めた見た目（`s.tight`）。一覧の上に重ねる絞り込みで使う */
  tight?: boolean | undefined;
}

/**
 * 選択肢から 1 つ選ぶチップの行。**アプリ中のチップ行はすべてこれ。**
 *
 * 同じ形（`ui.chipRow` + `ui.chip` + `aria-pressed`）が 15 か所に写してあった。
 * 写すたびに `role="group"` や読み上げの名前が抜けうるし、
 * 押した見た目を直すのに 15 か所を回ることになる。
 *
 * **2 択でも同じものを使う。**「どちらか一方」を枠続きで見せる `Segmented` は
 * 体組成／トレーニングの切り替え（画面の主題そのものが入れ替わる）のためにあって、
 * 絞り込みや表示の切り替えはこちら。
 */
export function ChipGroup<T extends string | number>({
  options,
  value,
  onChange,
  label,
  showLabel,
  tight,
}: Props<T>) {
  const id = useId();

  return (
    <>
      {showLabel && (
        <div className={s.label} id={id}>
          {label}
        </div>
      )}
      <div
        className={`${ui.chipRow} ${tight ? s.tight : ''}`}
        role="group"
        {...(showLabel ? { 'aria-labelledby': id } : { 'aria-label': label })}
      >
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            className={ui.chip}
            aria-pressed={value === o.id}
            onClick={() => onChange(o.id)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </>
  );
}
