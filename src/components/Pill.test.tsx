// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Pill } from './Pill';

afterEach(cleanup);

/**
 * **押せないものをボタンの形で出さない。**
 *
 * 以前は `disabled` を持っていて、押せないときは薄くなるだけだった。
 * 形は押せるものと同じなので指が伸び、押して初めて反応しないと分かる。
 * 操作ではなく**状態**（カタログの追加済みなど）は札として出す。
 */
describe('Pill', () => {
  it('押す先があればボタン', () => {
    const onClick = vi.fn();
    render(<Pill onClick={onClick}>ベンチプレス</Pill>);

    const el = screen.getByText('ベンチプレス');
    expect(el.tagName).toBe('BUTTON');
    fireEvent.click(el);
    expect(onClick).toHaveBeenCalled();
  });

  it('押す先が無ければボタンにしない', () => {
    render(<Pill>ベンチプレス</Pill>);

    const el = screen.getByText('ベンチプレス');
    expect(el.tagName).toBe('SPAN');
    // 触れる的として残さない（読み上げのボタン一覧にも出ない）
    expect(screen.queryByRole('button')).toBeNull();
  });

  /** 選ばれている見え方は、ボタンでなくても保つ */
  it('札でも選択の見え方は保つ', () => {
    render(<Pill pressed>✓ ベンチプレス</Pill>);
    expect(screen.getByText('✓ ベンチプレス').getAttribute('data-picked')).toBe('true');
  });

  it('ボタンのときは aria-pressed で出す', () => {
    render(
      <Pill pressed onClick={() => {}}>
        ✓ ベンチプレス
      </Pill>,
    );
    expect(screen.getByRole('button').getAttribute('aria-pressed')).toBe('true');
  });
});
