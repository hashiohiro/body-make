export interface NiceScale {
  min: number;
  max: number;
  step: number;
  ticks: number[];
}

function niceNum(range: number, round: boolean): number {
  const exponent = Math.floor(Math.log10(range));
  const fraction = range / 10 ** exponent;
  let nice: number;
  if (round) nice = fraction < 1.5 ? 1 : fraction < 3 ? 2 : fraction < 7 ? 5 : 10;
  else nice = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;
  return nice * 10 ** exponent;
}

/**
 * 軸目盛りを「1 / 2 / 5 × 10^n」の切りの良い値に丸める。
 * 体重のようにレンジの狭い系列でも刻みが 0.5kg などに収まるようにする。
 */
export function niceScale(min: number, max: number, maxTicks = 5): NiceScale {
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return { min: 0, max: 1, step: 1, ticks: [0, 1] };
  }
  let lo = min;
  let hi = max;
  if (lo === hi) {
    lo -= 0.5;
    hi += 0.5;
  }
  const range = niceNum(hi - lo, false);
  const step = niceNum(range / Math.max(1, maxTicks - 1), true);
  const niceMin = Math.floor(lo / step) * step;
  const niceMax = Math.ceil(hi / step) * step;

  const ticks: number[] = [];
  const decimals = Math.max(0, -Math.floor(Math.log10(step)));
  for (let v = niceMin; v <= niceMax + step / 2; v += step) {
    ticks.push(Number(v.toFixed(decimals + 2)));
  }
  return { min: niceMin, max: niceMax, step, ticks };
}

export function tickDecimals(step: number): number {
  return Math.max(0, Math.min(2, -Math.floor(Math.log10(step))));
}

export type Scale = (value: number) => number;

export function linearScale(
  domain: readonly [number, number],
  range: readonly [number, number],
): Scale {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const span = d1 - d0;
  if (span === 0) return () => (r0 + r1) / 2;
  return (value) => r0 + ((value - d0) / span) * (r1 - r0);
}

/** 欠測をまたぐ折れ線は繋がず、区間ごとに分割した path を返す */
export function linePath(points: readonly { x: number; y: number | null }[]): string {
  let d = '';
  let pen = false;
  for (const p of points) {
    if (p.y == null || !Number.isFinite(p.y)) {
      pen = false;
      continue;
    }
    d += `${pen ? 'L' : 'M'}${p.x.toFixed(2)} ${p.y.toFixed(2)}`;
    pen = true;
  }
  return d;
}

/** 上端だけ角丸の矩形（積み上げ棒の天面。ベースライン側は直角のまま） */
export function roundedTopRect(x: number, y: number, w: number, h: number, r: number): string {
  const radius = Math.max(0, Math.min(r, w / 2, h));
  return [
    `M${x} ${y + h}`,
    `V${y + radius}`,
    `Q${x} ${y} ${x + radius} ${y}`,
    `H${x + w - radius}`,
    `Q${x + w} ${y} ${x + w} ${y + radius}`,
    `V${y + h}`,
    'Z',
  ].join('');
}

/**
 * ゼロを挟んで上下に伸びる棒。データ側の端だけ角丸にし、ゼロ側は直角のまま残す。
 * yZero / yValue は画面座標（下向きが正）。
 */
export function divergingBar(
  x: number,
  w: number,
  yZero: number,
  yValue: number,
  r: number,
): string {
  const h = Math.abs(yValue - yZero);
  const radius = Math.max(0, Math.min(r, w / 2, h));

  if (yValue <= yZero) return roundedTopRect(x, yValue, w, h, r);

  return [
    `M${x} ${yZero}`,
    `V${yValue - radius}`,
    `Q${x} ${yValue} ${x + radius} ${yValue}`,
    `H${x + w - radius}`,
    `Q${x + w} ${yValue} ${x + w} ${yValue - radius}`,
    `V${yZero}`,
    'Z',
  ].join('');
}

/** x 軸の日付目盛りを、端が潰れない程度の本数だけ返す */
export function pickTimeTicks(times: readonly number[], count: number): number[] {
  if (times.length === 0) return [];
  if (times.length <= count) return [...times];
  const out: number[] = [];
  const stride = (times.length - 1) / (count - 1);
  for (let i = 0; i < count; i++) {
    out.push(times[Math.round(i * stride)]!);
  }
  return [...new Set(out)];
}
