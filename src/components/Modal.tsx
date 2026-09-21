import { useEffect, useId, useLayoutEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import s from './Modal.module.scss';

interface Props {
  open: boolean;
  title: string;
  onClose: () => void;
  /**
   * 面を差し替えている最中の戻り先。
   *
   * 渡すと、見出しの左に「‹ 戻る」が出る。**閉じるは残す。**
   * 戻るだけにすると、用が済んだ人が閉じるまでに 2 回押すことになる
   * （深い面ほど、そこで終わる回数のほうが多い）。
   * Esc と背面のキャンセルは戻るに合わせる。ダイアログごと消えると、
   * 元居た面まで一緒に失われるため。
   */
  onBack?: (() => void) | undefined;
  /**
   * 高さを決め打ちにする。**一覧を出す面と、セットを打つ面で使う。**
   *
   * 既定は中身なり（`max-height`）で、短い面が無駄に伸びないようにしてある。
   * ただし一覧では、絞り込みや検索で件数が減るたびに高さが縮む。
   * スマホでは下から出るシートなので、縮むと**上の縁が下がって**、
   * いま読んでいた結果が画面の下へ逃げていく。
   * 件数で高さが動かないようにして、読む位置を留める。
   */
  tall?: boolean | undefined;
  children: ReactNode;
}

/*
 * 背面のスクロールを止める。
 *
 * showModal() が止めるのは操作（クリックとフォーカス）だけで、
 * ダイアログの外を指でなぞると地のほうが動く。位置を保ったまま body を固定して、
 * 閉じたら元の位置へ戻す（overflow: hidden だけでは iOS の慣性スクロールが残る）。
 *
 * 入れ子で開くことがあるので、開いている数を数えて最後の 1 枚で解除する。
 */
let openCount = 0;
let savedY = 0;

function lockScroll() {
  if (openCount++ > 0) return;
  savedY = window.scrollY;
  const { style } = document.body;
  style.position = 'fixed';
  style.top = `-${savedY}px`;
  style.left = '0';
  style.right = '0';
  style.width = '100%';
}

function unlockScroll() {
  if (openCount === 0 || --openCount > 0) return;
  const { style } = document.body;
  style.position = '';
  style.top = '';
  style.left = '';
  style.right = '';
  style.width = '';
  window.scrollTo(0, savedY);
}

/**
 * ネイティブ `<dialog>` の薄いラッパー。
 * フォーカストラップ・Esc・背面の不活性化はブラウザに任せる（依存を足さない）。
 */
export function Modal({ open, title, onClose, onBack, tall, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  /*
   * **`useLayoutEffect` で持つ。**
   *
   * 後始末（下の戻り値）を **DOM から外れる前に** 走らせる必要がある。
   * 通常の `useEffect` の後始末は要素が外されたあとに呼ばれるので、
   * そのとき `close()` してもトップレイヤーからは抜けられない。
   */
  useLayoutEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;

    const shut = () => {
      if (!dialog.open) return;
      // 開く側と同じく、close を持たない環境でも閉じられるようにする
      if (typeof dialog.close === 'function') dialog.close();
      else dialog.removeAttribute('open');
    };

    if (!open) {
      shut();
      return;
    }

    // showModal を持たない環境（テスト用の DOM 実装など）でも中身は出す
    if (typeof dialog.showModal === 'function') {
      try {
        if (!dialog.open) dialog.showModal();
      } catch {
        dialog.setAttribute('open', '');
      }
    } else {
      dialog.setAttribute('open', '');
    }

    /*
     * **開いたまま外されることがある。必ず閉じてから外す。**
     *
     * 呼び出し側は `{条件 && <Modal open … />}` の形で置いている
     * （消す前の確認・セット入力・種目の目標・プリセット・記録の移行）。
     * 答えた瞬間に条件が false になるので、`open` が true のまま要素ごと消える。
     *
     * `showModal()` で開いた `<dialog>` はトップレイヤーに入り、背面を
     * 操作不能（inert）にする。閉じずに外すとその後始末が走らず、
     * **見た目はふつうなのに、どこを押しても反応しない**状態が残る。
     * 記録中はセットを 1 本消すたびにこの経路を通る。
     */
    return shut;
  }, [open]);

  // 開いたまま外されることがある（呼び出し側が開いているときだけ置く形）ので、
  // 後始末はクリーンアップに任せる
  useEffect(() => {
    if (!open) return;
    lockScroll();
    return unlockScroll;
  }, [open]);

  return (
    /*
      見出しは面の名前として渡す（`aria-labelledby`）。**`<dialog>` は
      それだけでは名前を持たない**ので、読み上げでは「ダイアログ」としか出ず、
      どの面が開いたのか分からないままになる。
    */
    <dialog
      ref={ref}
      className={`${s.dialog} ${tall ? s.tall : ''}`}
      aria-labelledby={titleId}
      /*
        **`close` イベントは聞かない。`cancel` だけにする。**

        `close` は `dialog.close()` を呼んだときにも飛ぶ——つまり**こちらが
        閉じたとき**にも飛ぶ。そこから `onClose` を呼び返すと輪になる:

          開く → （下の後始末が）閉じる → close が飛ぶ → onClose →
          呼び出し側が state を落とす → 開いたはずの面が消える

        実際 StrictMode（開発時は effect が 作る→捨てる→作る の順で走る）では、
        カードのボタンを押しても面が出ないところまで行った。
        本番でも「開いたまま外す」たびに、外れていく側の state を触り続けることになる。

        `cancel` は **利用者が閉じようとしたときだけ**飛ぶ（Esc）。
        こちらからの `close()` では飛ばないので、呼び返す先はこれで足りる。
        「閉じる」ボタンは下で直接 `onClose` を呼んでいる。
      */
      onCancel={(e) => {
        /*
          **Esc でブラウザに閉じさせない。**閉じるかどうかはこちらで決める。

          既定のままだと、DOM の `<dialog>` だけが閉じて React の `open` は
          true のまま残る経路がある——戻り先を持つ面（`onBack`）は、Esc を
          「一段戻る」として受けるので面そのものは開いたままにしたい。
          そこでブラウザに閉じられると、**閉じたのに開いているつもり**になり、
          もう一度開こうとしても state が変わらないので二度と出てこない。

          止めたうえでハンドラを呼べば、閉じる側は state が落ちて上の effect が
          閉じ、戻る側は面を保ったまま中身だけが入れ替わる。
        */
        e.preventDefault();
        (onBack ?? onClose)();
      }}
    >
      <div className={s.head}>
        {onBack && (
          <button type="button" className={s.back} onClick={onBack}>
            ‹ 戻る
          </button>
        )}
        <h2 className={s.title} id={titleId}>
          {title}
        </h2>
        <button type="button" className={s.close} onClick={onClose}>
          閉じる
        </button>
      </div>
      <div className={`${s.body} ${tall ? s.bodyTall : ''}`}>{open && children}</div>
    </dialog>
  );
}
