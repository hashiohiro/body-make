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
 *
 * **画面を回したときに固まらないようにする。**縮んだ割合は
 * `visualViewport.height ÷ window.innerHeight` で見ているが、この 2 つは
 * **別のタイミングで更新される**。回転の途中で視覚ビューポートだけが新しい高さに
 * なると、比が 0.5 前後まで落ちて「キーボードが出ている」と読む。
 * そのあと視覚ビューポートの resize が来なければ**その判定のまま居座り**、
 * タブバーが引っ込んだきり戻らない（画面を移れなくなる）。
 *
 * そこで `window` の resize と orientationchange も聞き、さらに
 * **次のフレームでもう一度測る**。どちらが先に更新されても、最後には
 * 揃った値で判定し直す。
 */
export function useKeyboardOpen(): boolean {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;

    let frame = 0;
    const update = () => {
      // innerHeight はレイアウトビューポート。キーボードでは変わらないので、これを分母にする
      const layout = window.innerHeight;
      setOpen(layout > 0 && viewport.height / layout < SHRUNK);
    };
    /** いま測って、レイアウトが落ち着いた次のフレームでもう一度測る */
    const schedule = () => {
      update();
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };
    update();

    viewport.addEventListener('resize', schedule);
    window.addEventListener('resize', schedule);
    window.addEventListener('orientationchange', schedule);
    return () => {
      cancelAnimationFrame(frame);
      viewport.removeEventListener('resize', schedule);
      window.removeEventListener('resize', schedule);
      window.removeEventListener('orientationchange', schedule);
    };
  }, []);

  return open;
}
