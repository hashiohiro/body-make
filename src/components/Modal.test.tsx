// @vitest-environment jsdom
import { StrictMode, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Modal } from './Modal';

/**
 * **jsdom は `<dialog>` を実装していない。**`showModal` も `close` も無いので、
 * `Modal` は属性を付け外しするほうの道に落ちる。そちらは `close` イベントを
 * 飛ばさないため、**本物のブラウザでだけ起きる不具合をテストが素通しする。**
 *
 * 仕様どおりの最小実装を当てて、その道を通す。
 *   showModal() … open 属性を付ける（トップレイヤーは jsdom に無いので省く）
 *   close()     … open 属性を外し、**close イベントを飛ばす**
 *   cancel      … 利用者が閉じようとしたときだけ（Esc）。close() では飛ばない
 */
function installDialog() {
  const proto = HTMLDialogElement.prototype as unknown as Record<string, unknown>;
  proto.showModal = function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  proto.close = function (this: HTMLDialogElement) {
    if (!this.hasAttribute('open')) return;
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  };
}

function uninstallDialog() {
  const proto = HTMLDialogElement.prototype as unknown as Record<string, unknown>;
  delete proto.showModal;
  delete proto.close;
}

const dialog = () => document.querySelector('dialog');
const isOpen = () => dialog()?.hasAttribute('open') ?? false;

beforeEach(installDialog);
afterEach(() => {
  cleanup();
  uninstallDialog();
});

/** 呼び出し側の形。条件が false になると `open` のまま要素ごと外れる */
function Conditional({ onClose }: { onClose?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
        }}
      >
        開く
      </button>
      {open && (
        <Modal
          open
          title="セット入力"
          onClose={() => {
            setOpen(false);
            onClose?.();
          }}
        >
          <p>中身</p>
        </Modal>
      )}
    </>
  );
}

/**
 * `close` イベントは `dialog.close()` を呼んだときにも飛ぶ。そこから `onClose` を
 * 呼び返すと輪になり、**開いた面がその場で消える**。
 */
describe('ダイアログが開くこと', () => {
  it('カードのボタンから開ける', () => {
    render(<Conditional />);
    fireEvent.click(screen.getByText('開く'));
    expect(isOpen()).toBe(true);
  });

  /*
   * StrictMode は effect を 作る → 捨てる → 作る の順で走らせる。
   * 後始末が `close()` を呼び、その `close` イベントが `onClose` を呼び返すと、
   * **押した瞬間に面が消える**（開発中はこれで種目カード・プリセット・回復・
   * 種目別の推移が、どれも押しても何も出ない状態になった）。
   */
  it('StrictMode でも開いたままになる', () => {
    render(
      <StrictMode>
        <Conditional />
      </StrictMode>,
    );
    fireEvent.click(screen.getByText('開く'));
    expect(dialog()).not.toBeNull();
    expect(isOpen()).toBe(true);
  });

  it('常設の置き方（open を出し入れする形）でも開く', () => {
    function Always() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            開く
          </button>
          <Modal open={open} title="推移" onClose={() => setOpen(false)}>
            <p>中身</p>
          </Modal>
        </>
      );
    }
    render(
      <StrictMode>
        <Always />
      </StrictMode>,
    );
    fireEvent.click(screen.getByText('開く'));
    expect(isOpen()).toBe(true);
  });

  /** こちらから閉じたぶんは呼び返さない（呼び返すと上の輪になる） */
  it('自分で閉じたときに onClose を呼び返さない', () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <Modal open title="A" onClose={onClose}>
        A
      </Modal>,
    );
    rerender(
      <Modal open={false} title="A" onClose={onClose}>
        A
      </Modal>,
    );
    expect(isOpen()).toBe(false);
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('ダイアログの後始末', () => {
  /*
   * `showModal()` で開いた `<dialog>` はトップレイヤーに入り、背面を操作不能にする。
   * 閉じずに外すとその後始末が走らず、見た目はふつうなのに押せない状態が残る。
   */
  it('開いたまま外されても、閉じてから外れる', () => {
    const { unmount } = render(
      <Modal open title="セット入力" onClose={() => {}}>
        中身
      </Modal>,
    );
    const el = dialog()!;
    expect(el.hasAttribute('open')).toBe(true);

    unmount();

    expect(el.hasAttribute('open')).toBe(false);
  });

  it('地のスクロール止めも外れる', () => {
    const { unmount } = render(
      <Modal open title="A" onClose={() => {}}>
        A
      </Modal>,
    );
    expect(document.body.style.position).toBe('fixed');
    unmount();
    expect(document.body.style.position).toBe('');
  });
});

describe('閉じる操作', () => {
  it('「閉じる」ボタンで閉じる', () => {
    render(<Conditional />);
    fireEvent.click(screen.getByText('開く'));
    fireEvent.click(screen.getByRole('button', { name: '閉じる' }));
    expect(dialog()).toBeNull();
  });

  /** Esc は利用者が閉じようとした合図。こちらからの close() とは別の口で受ける */
  it('Esc（cancel）は閉じる側に伝わる', () => {
    const onClose = vi.fn();
    render(
      <Modal open title="A" onClose={onClose}>
        A
      </Modal>,
    );
    fireEvent(dialog()!, new Event('cancel', { cancelable: true }));
    expect(onClose).toHaveBeenCalled();
  });

  /*
   * 戻り先を持つ面は、Esc を「一段戻る」として受ける——面そのものは開いたまま。
   * ブラウザに閉じさせると、**閉じたのに開いているつもり**の state が残り、
   * もう一度開こうとしても何も起きなくなる。
   */
  it('戻る先がある面は、Esc で閉じてしまわない', () => {
    const onBack = vi.fn();
    render(
      <Modal open title="カタログから足す" onClose={() => {}} onBack={onBack}>
        A
      </Modal>,
    );
    fireEvent(dialog()!, new Event('cancel', { cancelable: true }));

    expect(onBack).toHaveBeenCalled();
    // 開いたまま。DOM と React の食い違いを作らない
    expect(isOpen()).toBe(true);
  });
});
