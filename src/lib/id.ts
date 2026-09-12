/**
 * 自作のもの（種目・プリセット）に振る ID。
 *
 * **`crypto.randomUUID()` をそのまま呼ばない。**あれは Safari 15.4 以降でしか無く、
 * しかも**セキュアコンテキスト（https / localhost）でないと生えない**。
 * 無い環境では「追加」を押しても何も起きない、という形で黙って失敗していた。
 *
 * 保存のほうは古い環境に手当てしてある（IndexedDB が使えなければ localStorage、
 * README の「保存先」）のに、UI が先に動かなくなるのは噛み合っていない。
 * ここで下限を引き受けて、**新しい API は使えるときだけ使う**。
 *
 * 代わりの値も衝突しなければ十分。ID は「同じ種目を指し続ける」ためのもので、
 * 推測できないことは要求されない（端末の中にしか無い）。
 */
export function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // 時刻（36 進）＋乱数。同じミリ秒に 2 つ作っても後半で分かれる
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
