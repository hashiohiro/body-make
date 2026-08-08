export interface NumericParse {
  /** 親の状態へ確定させてよいか。false のときは画面の文字列だけ進めて値は据え置く */
  commit: boolean;
  value: number | null;
}

/**
 * 入力欄の生文字列を数値に解釈する。
 *
 * 「68」と打つ途中の「6」は下限 20 を下回るが、ここで null を確定させると
 * 欄がクリアされて 2 文字目にたどり着けなくなる。値域外と解釈不能は
 * どちらも「まだ確定しない」として扱い、表示だけ進めるのが正しい。
 */
export function parseNumericInput(raw: string, min: number, max: number): NumericParse {
  if (raw.trim() === '') return { commit: true, value: null };

  const n = Number(raw);
  if (!Number.isFinite(n)) return { commit: false, value: null };
  if (n < min || n > max) return { commit: false, value: null };

  return { commit: true, value: Math.round(n * 10) / 10 };
}
