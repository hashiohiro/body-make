export function fmt(value: number | null | undefined, digits = 1): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return value.toFixed(digits);
}

/** 符号を必ず付ける（±0.0 は「±」表記にして「変化なし」を読み取れるようにする） */
export function fmtDelta(value: number | null | undefined, digits = 1): string {
  if (value == null || !Number.isFinite(value)) return '—';
  const rounded = Number(value.toFixed(digits));
  if (rounded === 0) return `±${(0).toFixed(digits)}`;
  return `${rounded > 0 ? '+' : '−'}${Math.abs(rounded).toFixed(digits)}`;
}

export type DeltaTone = 'good' | 'bad' | 'flat';

/**
 * 変化量の色分け。「下がるほど良い」指標（体重・体脂肪）は lowerIsBetter=true。
 * 除脂肪体重のように維持が良い指標は tolerance を渡して中立域を作る。
 */
export function deltaTone(
  value: number | null | undefined,
  lowerIsBetter: boolean,
  tolerance = 0.05,
): DeltaTone {
  if (value == null || !Number.isFinite(value) || Math.abs(value) <= tolerance) return 'flat';
  const improving = lowerIsBetter ? value < 0 : value > 0;
  return improving ? 'good' : 'bad';
}

export function fmtPercent(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${Math.round(value * 100)}%`;
}
