import { MiniButton } from './MiniButton';
import { TextField } from './TextField';
import { PRESET_NAME_MAX } from '../lib/storage';
import s from './NameEntryRow.module.scss';

interface Props {
  value: string;
  onChange: (value: string) => void;
  /** 確定。押せるかどうかは `disabled` で決める（空のまま確定させない） */
  onCommit: () => void;
  onCancel: () => void;
  /** 読み上げに出す欄の名前（「新しいプリセットの名前」など） */
  label: string;
  /** 確定の読み上げ名。「この名前で保存」「この名前にする」など、結果を書く */
  commitLabel: string;
  cancelLabel: string;
  /** 確定を押せない理由があるとき（空・名前がぶつかっている） */
  disabled?: boolean | undefined;
}

/**
 * 名前を打って確定する 1 行。**名前を付ける場面はすべてこれ。**
 *
 * **Enter で確定、Esc でやめる。**打ち終わって Enter を押すのは自然な手つきだし、
 * スマホのキーボードは「改行」を出してくるので、効かないと一度閉じて ✓ を探すことになる。
 *
 * 入力欄 ＋ ✓ ＋ × の組を 3 か所で組み立てていた（プリセットの新規作成・
 * 名前の変更・記録画面からの保存）。上限（`PRESET_NAME_MAX`）も、
 * 空なら押せないことも、写すたびに抜ける余地がある。
 *
 * ✓ と × は記号だけなので、**読み上げの名前は結果を書く**
 * （「この名前で保存」「保存をやめる」）。記号を読み上げても何も伝わらない。
 */
export function NameEntryRow({
  value,
  onChange,
  onCommit,
  onCancel,
  label,
  commitLabel,
  cancelLabel,
  disabled,
}: Props) {
  return (
    <div className={s.row}>
      <TextField
        className={s.input}
        value={value}
        maxLength={PRESET_NAME_MAX}
        label={label}
        onChange={onChange}
        onCommit={disabled ? undefined : onCommit}
        onCancel={onCancel}
      />
      <MiniButton label={commitLabel} disabled={disabled} onClick={onCommit}>
        ✓
      </MiniButton>
      <MiniButton label={cancelLabel} onClick={onCancel}>
        ×
      </MiniButton>
    </div>
  );
}
