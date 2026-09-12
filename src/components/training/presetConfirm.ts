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
