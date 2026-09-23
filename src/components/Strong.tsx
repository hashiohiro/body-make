import { Fragment } from 'react';

interface Props {
  /** 文ぜんぶ。強める場所は `{strong}` で開けておく */
  text: string;
  /** `{strong}` に入れる語。出てくる順に並べる */
  values: readonly string[];
}

/**
 * 文の中の語を強める。**語順は辞書が決める。**
 *
 * これまでは「前」「強める語」「後」の 3 キーに割って JSX で並べていた。
 * 日本語では通る（`見るのは` + **日付だけ** + `です。`）が、**英語では順が変わる**ので、
 * 割った場所をすべて直して回ることになる——`t()` の穴を辞書側に開けたのと同じ理由で、
 * ここも 1 文 1 キーにする。
 *
 * ```ts
 * 'checks.datesOnlyNote': '見るのは{strong}です。疲労の量は持ちません。'
 * 'checks.datesOnlyNote': 'It reads {strong}. It does not model fatigue.'
 * ```
 *
 * 穴が複数あるときは、出てくる順に `values` から埋める。
 */
export function Strong({ text, values }: Props) {
  return (
    <>
      {text.split('{strong}').map((part, i) => (
        <Fragment key={i}>
          {part}
          {i < values.length && <b>{values[i]}</b>}
        </Fragment>
      ))}
    </>
  );
}
