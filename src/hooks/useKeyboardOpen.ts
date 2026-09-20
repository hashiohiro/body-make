import { useEffect, useState } from 'react';

/**
 * 視覚ビューポートがこの割合より縮んだら、ソフトキーボードが出ているとみなす。
 *
 * キーボードは画面の 35〜50% を占める。アドレスバーの出入りで縮むのは 10% 前後なので、
 * その間に線を引く。厳密な高さは端末とキーボード（絵文字・予測変換のバー）で変わるので、
 * 「何 px 縮んだか」ではなく割合で見る。
 */
const SHRUNK = 0.75;

/**
 * ソフトキーボードが出ているか。
 *
 * **iOS はキーボードでレイアウトビューポートを変えない。**縮むのは視覚ビューポートだけ。
 * そのため `position: fixed; bottom: 0` のタブバーは画面の下端ではなく
 * **キーボードの上**——見た目には画面の真ん中あたり——に現れる。
 * 記録中は数値欄を叩くたびにこれが起きる。
 *
 * ビューポートのメタタグにある `interactive-widget` は Chromium だけの口で、
 * iOS（Safari も、ホーム画面に追加した PWA も、iOS の Chrome も中身は WebKit）には効かない。
 * 端末に任せられないので、視覚ビューポートの高さを見てこちらで判断する。
 *
 * `visualViewport` を持たない環境では常に false（＝これまでどおり出したまま）。
 */
export function useKeyboardOpen(): boolean {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;

    const update = () => {
      // innerHeight はレイアウトビューポート。キーボードでは変わらないので、これを分母にする
      const layout = window.innerHeight;
      setOpen(layout > 0 && viewport.height / layout < SHRUNK);
    };
    update();

    viewport.addEventListener('resize', update);
    return () => viewport.removeEventListener('resize', update);
  }, []);

  return open;
}
