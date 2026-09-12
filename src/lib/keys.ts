import type { KeyboardEvent } from 'react';

/**
 * 文字を打つ欄のキー操作。**Enter で確定、Esc でやめる。**
 *
 * どの欄も `<form>` を持たないので、Enter は何も起こさないままだった
 * （名前を付ける欄が 4 か所ある）。スマホのキーボードは「改行」を出してくるので、
 * 効かないと**一度キーボードを閉じて ✓ を探しに行く**ことになる。
 *
 * **変換中の Enter は無視する。**日本語入力では、Enter は候補の確定にも使う。
 * `isComposing` を見ないと、変換を確定したつもりで欄そのものが確定してしまう。
 *
 * @param commit 確定。押せない状態（空・名前がぶつかっている）なら渡さない
 * @param cancel やめる。無ければ Esc は何もしない
 */
export function onEnter(
  event: KeyboardEvent<HTMLInputElement>,
  commit: (() => void) | undefined,
  cancel?: (() => void) | undefined,
): void {
  if (event.key === 'Escape') {
    if (cancel == null) return;
    event.preventDefault();
    cancel();
    return;
  }
  if (event.key !== 'Enter' || event.nativeEvent.isComposing) return;
  if (commit == null) return;
  event.preventDefault();
  commit();
}
