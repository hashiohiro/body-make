// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { GroupWeekDots } from './GroupWeekDots';

afterEach(cleanup);

const dots = () => [...screen.getByRole('img').querySelectorAll('i')];
const kinds = () =>
  dots().map((d) =>
    d.className.includes('dotOn')
      ? 'on'
      : d.className.includes('dotPartOver')
        ? `over ${d.style.getPropertyValue('--fill')}`
        : d.className.includes('dotPart')
          ? `part ${d.style.getPropertyValue('--fill')}`
          : 'open',
  );

/*
 * 補助部位の係数で半端なセット数になる。端数は 1/4 単位で欠けた丸にし、
 * 「まだ」の色は目標に届いていない丸だけに使う（2026/10/10、利用者の指摘）。
 */
describe('GroupWeekDots', () => {
  it('目標に届いていれば、超えた端数の丸に「まだ」を出さない', () => {
    render(<GroupWeekDots group="shoulders" sets={2.5} target={{ sets: 2, volume: null }} />);
    expect(kinds()).toEqual(['on', 'on', 'over 180deg']);
    expect(screen.getByRole('img').className).toMatch(/dotsReached/);
  });

  it('目標の内側の端数は、残りを「まだ」の色で塗る', () => {
    render(<GroupWeekDots group="shoulders" sets={1.75} target={{ sets: 3, volume: null }} />);
    expect(kinds()).toEqual(['on', 'part 270deg', 'open']);
  });

  it('端数は 1/4 単位に丸める', () => {
    render(<GroupWeekDots group="shoulders" sets={1.3} target={null} />);
    // 1.3 → 1.25。目標が無いので残りは空ける
    expect(kinds()).toEqual(['on', 'over 90deg']);
  });

  it('目標どおりなら、丸は目標の数だけですべて塗る', () => {
    render(<GroupWeekDots group="chest" sets={3} target={{ sets: 3, volume: null }} />);
    expect(kinds()).toEqual(['on', 'on', 'on']);
  });
});
