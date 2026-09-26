import { useEffect, useState } from 'react';

/**
 * 視覚ビューポートがレイアウトビューポートよりこの割合を超えて小さいか。
 *
 * **キーボードの高さは測らない。**iOS と Android でも、絵文字や予測変換のバーの
 * 有無でも変わるので、そこに線を引くと端末ごとに外れる。
 *
 * 見ているのは**2 つのビューポートのずれ**そのもの。ずれているとは
 * 「レイアウトは縮んでいないのに、見えている範囲だけが狭い」状態で、
 * そのときだけ `position: fixed; bottom: 0` が画面の途中に浮く。
 * どのキーボードでもずれは 3 割を超えるので、閾値は**緩くてよい**
 * （狭く取ると端末差で漏れる）。
 *
 * ずれだけでは URL バーの開閉も拾ってしまうので、入力中かどうかと**両方**見る。
 */
const SHRUNK = 0.9;

/**
 * いまキーボードを出す欄に入っているか。
 *
 * **縮んだかどうかだけでは足りない。**iOS Safari は URL バーの開閉で
 * `window.innerHeight` そのものが変わるので、分子と分母が別々に動いて
 * キーボードが無くても比が閾値を割る（タブバーが勝手に引っ込む）。
 * 知りたいのは「入力中か」なので、それを直接見る。
 *
 * ボタンやチェックボックスの `input` はキーボードを出さないので数えない。
 */
const NO_KEYBOARD = new Set([
  'button',
  'submit',
  'reset',
  'checkbox',
  'radio',
  'file',
  'range',
  'color',
  'image',
]);

function editableFocused(): boolean {
  const el = document.activeElement;
  if (!(el instanceof HTMLElement)) return false;
  if (el.isContentEditable) return true;
  if (el.tagName === 'TEXTAREA') return true;
  if (el.tagName !== 'INPUT') return false;
  return !NO_KEYBOARD.has((el as HTMLInputElement).type);
}

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
 * **縮んだことと、入力欄に入っていることの両方**を見る。片方だけでは誤る。
 *   縮んだだけ（URL バーの開閉）      → 隠さない
 *   入力欄に入っただけ（外付けキーボード）→ 隠さない
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
      const layout = window.innerHeight;
      const shrunk = layout > 0 && viewport.height / layout < SHRUNK;
      setOpen(shrunk && editableFocused());
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
    // 欄に入った・出たの両方で測り直す（縮みの通知より先に来ることも後に来ることもある）
    document.addEventListener('focusin', schedule);
    document.addEventListener('focusout', schedule);
    return () => {
      cancelAnimationFrame(frame);
      viewport.removeEventListener('resize', schedule);
      window.removeEventListener('resize', schedule);
      window.removeEventListener('orientationchange', schedule);
      document.removeEventListener('focusin', schedule);
      document.removeEventListener('focusout', schedule);
    };
  }, []);

  return open;
}
