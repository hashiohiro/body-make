/*
 * 配列の小さな道具。
 *
 * **新しい API に寄りかからない線引きをここに集める。**
 * `Array.prototype.at` と `findLastIndex` はどちらも Safari 15.4 以降でしか無い。
 * 片方だけ手書きで避けて、もう片方を素で使っていたので、避けた意味が無くなっていた
 * （`crypto.randomUUID` も同じ 15.4 で、そちらは `lib/id.ts` が引き受ける）。
 *
 * 保存のほうは古い環境に手当てしてある（IndexedDB が無ければ localStorage）のに、
 * 画面が先に落ちるのでは噛み合わない。下限を上げるなら、上げるとどうなるかを
 * 決めてからまとめて上げる。
 */

/** 最後の 1 つ。`list.at(-1)` の代わり */
export function last<T>(list: readonly T[]): T | undefined {
  return list.length === 0 ? undefined : list[list.length - 1];
}

/**
 * 並びが違っても、同じものが同じ数だけ入っていれば同じと見る。
 *
 * プリセットの「もう保存してある組み合わせか」の判定に使う。
 * 記録画面（`PresetCard`）と帯（`TrainingAside`）で**同じ 5 行を持っていた**——
 * 片方だけ「並びも見る」に変えたら、保存済みかどうかの答えが面によって変わる。
 */
export function sameSet(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((id) => set.has(id));
}

/** 後ろから探して位置を返す。`list.findLastIndex(hit)` の代わり */
export function findLastIndex<T>(list: readonly T[], hit: (item: T) => boolean): number {
  for (let i = list.length - 1; i >= 0; i--) if (hit(list[i]!)) return i;
  return -1;
}
