import { useRef, useState } from 'react';
import { parseNumericInput } from '../lib/numeric';

function toText(value: number | null): string {
  return value == null ? '' : String(value);
}

export interface NumericField {
  /** 入力欄に出す文字列（入力途中の未確定状態を保持する） */
  text: string;
  handleChange: (raw: string) => void;
  /** フォーカスを外したら、確定済みの値へ表示を戻す */
  handleBlur: () => void;
  /** ± ボタンのように、値が確実に決まっている経路から入れる */
  setNumber: (value: number) => void;
}

/**
 * 数値入力欄の共通ロジック。
 * props を直接編集すると、値域の下限に届くまでの途中入力が毎回 null に潰されて打てなくなる。
 */
export function useNumericField(
  value: number | null,
  min: number,
  max: number,
  onCommit: (value: number | null) => void,
): NumericField {
  const [text, setText] = useState(() => toText(value));
  const lastValue = useRef(value);

  // 外部（日付切り替え・インポート・リセット）で値が変わったときだけ表示を追従させる
  if (lastValue.current !== value) {
    lastValue.current = value;
    const parsed = text.trim() === '' ? null : Number(text);
    if (parsed !== value) setText(toText(value));
  }

  return {
    text,
    handleChange: (raw) => {
      setText(raw);
      const parsed = parseNumericInput(raw, min, max);
      if (parsed.commit) onCommit(parsed.value);
    },
    handleBlur: () => setText(toText(value)),
    setNumber: (next) => {
      setText(String(next));
      onCommit(next);
    },
  };
}
