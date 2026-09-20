import type { ConfirmRequest } from '../ConfirmDialog';
import type { Preset } from '../../types';

/**
 * プリセットを削除する前の問い。
 *
 * **記録画面（`PresetCard`）と設定（`PresetManager`）で同じものを出す。**
 * `confirm()` の頃は同じ文が 2 か所に別々に書かれていて、片方を直すともう片方が
 * 古くなる状態だった。同じ操作が面によって違う言い方で聞いてくるのもおかしい。
 */
export function removePresetRequest(preset: Preset, onRemove: () => void): ConfirmRequest {
  return {
    title: 'プリセットを削除しますか？',
    subject: preset.name,
    // 記録は消えない。消えるのは「付けた名前」と「組み合わせ」だけ
    note: '記録は消えません。付けた名前と組み合わせは戻せません。',
    confirmLabel: '削除',
    destructive: true,
    onConfirm: onRemove,
  };
}

/**
 * 最後の 1 種目を外そうとしたときの問い。**それはプリセットを消すのと同じこと。**
 *
 * 中身を並べた一覧からも、種目を選ぶ面（✓ を外す）からも同じ操作になるので、
 * 問いもここで 1 つにする。以前は選ぶ面のほうだけ **無言で押せなくして**いて、
 * 押しても何も起きない ✓ が残っていた（理由はコードのコメントにしか無かった）。
 */
export function dropLastExerciseRequest(
  preset: Preset,
  exerciseName: string,
  onRemove: () => void,
): ConfirmRequest {
  return {
    title: 'プリセットごと削除しますか？',
    subject: preset.name,
    note: `「${exerciseName}」を外すと種目が無くなります。記録は消えません。`,
    confirmLabel: 'プリセットごと削除',
    destructive: true,
    onConfirm: onRemove,
  };
}
