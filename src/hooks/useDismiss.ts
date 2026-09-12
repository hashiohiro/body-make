import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';

/**
 * 開いているものを、**外を触るか Esc で**閉じる。
 *
 * 同じ作法が要るものが 4 つあった（実績バッジ・推移グラフ・カロリー収支・
 * 週平均の体組成）のに、揃っていなかった。
 *
 *   実績バッジ         … 外を触る ○ / Esc ○
 *   推移グラフ         … 外を触る ○ / Esc ×
 *   カロリー収支       … どちらも ×
 *   週平均の体組成     … どちらも ×
 *
 * 下の 2 つは `onPointerLeave` だけを持っていた。**マウスでは閉じるが、
 * 指では閉じない**——タップで pointerleave は来ないので、別の棒を触るまで
 * 吹き出しが残る。スマホで読む面なので、そこが効かないのは実質「閉じられない」。
 *
 * 捕捉フェーズで見るのは、内側のハンドラが動く前に外かどうかを決めたいため。
 *
 * @param open     開いているか。閉じているあいだは何も掛けない
 * @param isInside 触った先を「中」と見るか。`insideNode` / `insideRect` で作る
 */
export function useDismiss(
  open: boolean,
  onDismiss: () => void,
  isInside: (event: PointerEvent) => boolean,
): void {
  /*
   * 呼び出し側はその場で作った関数を渡してくる（`insideRect(ref)` など）。
   * そのまま依存に入れると毎描画で掛け直すことになるので、参照だけ差し替える。
   */
  const inside = useRef(isInside);
  const dismiss = useRef(onDismiss);
  useEffect(() => {
    inside.current = isInside;
    dismiss.current = onDismiss;
  });

  useEffect(() => {
    if (!open) return;

    const onDown = (e: PointerEvent) => {
      if (!inside.current(e)) dismiss.current();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismiss.current();
    };

    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
}

/**
 * その要素の中（子孫を含む）を触ったか。
 *
 * **中身が器からはみ出して出るもの**に使う（実績バッジの吹き出しは、
 * 押したバッジの真下に絶対配置で出るので、グリッドの下へ抜けることがある）。
 */
export function insideNode(ref: RefObject<Node | null>): (event: PointerEvent) => boolean {
  return (e) => e.target instanceof Node && (ref.current?.contains(e.target) ?? false);
}

/**
 * その要素の**矩形**の中を触ったか。
 *
 * グラフに使う。**「包んでいる要素の中か」では広すぎる**——軸ラベルや上下の余白、
 * 見た目にはグラフの外を触っても残ってしまう。読む人にとってのグラフは、
 * 点と棒が乗っている範囲のほう。
 */
export function insideRect(ref: RefObject<Element | null>): (event: PointerEvent) => boolean {
  return (e) => {
    const rect = ref.current?.getBoundingClientRect();
    if (rect == null) return false;
    return (
      e.clientX >= rect.left &&
      e.clientX <= rect.right &&
      e.clientY >= rect.top &&
      e.clientY <= rect.bottom
    );
  };
}
