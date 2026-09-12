import { onEnter } from '../lib/keys';

interface Props {
  value: string;
  onChange: (value: string) => void;
  /** 読み上げに出す名前。外のラベルと結ぶときは `id` のほうを使う */
  label?: string | undefined;
  id?: string | undefined;
  maxLength: number;
  placeholder?: string | undefined;
  /** 置かれた場所が持つ見た目（`.newField` などが element で当てるなら渡さない） */
  className?: string | undefined;
  /** Enter で確定。押せない状態（空・名前がぶつかっている）なら渡さない */
  onCommit?: (() => void) | undefined;
  /** Esc でやめる */
  onCancel?: (() => void) | undefined;
}

/**
 * 文字を打つ欄。**アプリ中の `type="text"` はすべてこれ。**
 *
 * 持っているのは 3 つだけ。
 *
 *   - **上限（`maxLength`）を必ず取る。**無いと、一覧で名前が枠を割るまで気づけない
 *   - **Enter で確定、Esc でやめる**（`lib/keys`）。変換中の Enter は無視する
 *   - 字の大きさは `field-text`（16px 未満だと iOS が focus で画面を拡大する）
 *
 * 見た目は置かれた場所が持つ。ここが持つのは「打つ欄の作法」だけ。
 */
export function TextField({
  value,
  onChange,
  label,
  id,
  maxLength,
  placeholder,
  className,
  onCommit,
  onCancel,
}: Props) {
  return (
    <input
      id={id}
      className={className}
      type="text"
      value={value}
      maxLength={maxLength}
      placeholder={placeholder}
      {...(label == null ? {} : { 'aria-label': label })}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => onEnter(e, onCommit, onCancel)}
    />
  );
}
