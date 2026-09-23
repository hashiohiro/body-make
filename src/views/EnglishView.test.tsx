// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { App } from '../App';
import { emptyData, resetStorageForTests } from '../lib/storage';
import { en } from '../lib/i18n/en';
import type { AppData } from '../types';

/*
 * **英語で画面を描いて確かめる。**
 *
 * 辞書そのものは `i18n.test.ts` が見ているが、**画面を英語で描いたテストが
 * 1 つも無かった**（`src/test-setup.ts` が端末を日本語に固定しているので、
 * 既存のテストはすべて日本語で走る）。
 *
 * それだと、辞書の検査をすり抜けるもの——差し込みが埋まらず `{n}` のまま出る、
 * `Strong` の `{strong}` が画面に見えてしまう、剥がし漏れた日本語が残っている
 * ——を誰も見ていないことになる。**中身の正しさではなく、漏れだけ**を見る。
 */

function english(): AppData {
  const base = emptyData();
  return { ...base, settings: { ...base.settings, locale: 'en' } };
}

const JAPANESE = /[ぁ-んァ-ヶ一-龯]/;

/** 英語の画面に日本語で出てよいもの。言語の選択肢はその言語の名前で出す */
const ALLOWED = [en['settings.language.ja']];

/** いま出ている画面の文字。**読み上げ名も見る**（画面を見ても気づけない漏れ） */
function shown(): string {
  const aria = [...document.querySelectorAll('[aria-label]')]
    .map((el) => el.getAttribute('aria-label') ?? '')
    .join(' ');
  return `${document.body.textContent ?? ''} ${aria}`;
}

/** その画面に漏れが無いか。タブごとに同じ見方をする */
function expectClean(where: string) {
  let text = shown();
  for (const ok of ALLOWED) text = text.split(ok).join('');
  expect(`${where}: ${text.match(/\{\w+\}/g)?.join(' ') ?? ''}`).toBe(`${where}: `);
  expect(`${where}: ${[...text].filter((c) => JAPANESE.test(c)).join('')}`).toBe(`${where}: `);
}

beforeEach(async () => {
  await resetStorageForTests();
});
afterEach(cleanup);

describe('英語で描く', () => {
  it('どのタブにも、差し込みの穴と日本語が漏れていない', () => {
    render(<App initial={english()} />);
    expectClean('Home');

    for (const tab of ['Goals', 'Records', 'Settings']) {
      fireEvent.click(screen.getByRole('tab', { name: new RegExp(tab) }));
      expectClean(tab);
    }
  });

  /*
   * **下位画面まで開く。**設定のトップにあるのは 3 行だけで、
   * 中身（表示・データ・マイ種目・プリセット・週メニュー）はその先にある。
   * 最初に書いたときは行の名前を間違えていて**一度も開けておらず**、
   * わざと壊しても落ちなかった。開けたことを `opened` で数えて、空振りを防ぐ。
   */
  it('設定の下位画面にも漏れていない', () => {
    render(<App initial={english()} />);
    let opened = 0;

    const dig = (name: RegExp, where: string) => {
      const entry = screen.queryAllByRole('button').find((b) => name.test(b.textContent ?? ''));
      if (!entry) return false;
      fireEvent.click(entry);
      expectClean(where);
      opened++;
      return true;
    };

    for (const section of [/^General/, /^Body/, /^Training/]) {
      fireEvent.click(screen.getByRole('tab', { name: /Settings/ }));
      dig(section, `Settings › ${section.source}`);
      // トレーニングはさらに 1 段ある（マイ種目・プリセット・週メニュー）
      for (const inner of [/^My exercises/, /^Presets/, /^Weekly menu/, /^Review/]) {
        if (dig(inner, `Settings › ${inner.source}`)) {
          fireEvent.click(screen.getByRole('tab', { name: /Settings/ }));
          dig(section, `Settings › ${section.source}`);
        }
      }
    }
    // 開けていなければ、この試験は何も見ていない
    expect(opened).toBeGreaterThanOrEqual(4);
  });
});
