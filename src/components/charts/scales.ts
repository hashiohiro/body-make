import { addDays, diffDays, isoToTime, toISO } from '../../lib/date';

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

export interface BandLayout {
  /** 1 本が占める幅（棒どうしの間隔を含む） */
  band: number;
  /** 棒そのものの幅 */
  barW: number;
  /** i 本目の占有域の左端。触れる矩形はここから `band` ぶん */
  bandX: (index: number) => number;
  /** i 本目の棒の左端 */
  barX: (index: number) => number;
}

/**
 * 棒グラフの横位置。**上限に当たったぶんは全体を中央へ寄せる。**
 *
 * 週が少ないとき、幅を等分すると 1 本が極端に太くなり、棒が散らばって
 * 「量を見比べる図」に見えなくなる。占有幅（`maxBand`）と棒の幅（`maxBar`）に
 * 上限を置き、余った幅は左右に均等に流す。
 *
 * 同じ 6 行が 2 つの棒グラフ（カロリー収支・週平均の体組成）に写してあった。
 */
export function bandLayout(
  count: number,
  plotW: number,
  left: number,
  maxBand: number,
  maxBar: number,
): BandLayout {
  const band = count > 0 ? Math.min(plotW / count, maxBand) : plotW;
  const barW = Math.min(maxBar, band * 0.6);
  const originX = left + (plotW - band * count) / 2;
  const bandX = (index: number) => originX + band * index;
  return { band, barW, bandX, barX: (index) => bandX(index) + (band - barW) / 2 };
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

/**
 * x 軸の日付目盛り。**軸の範囲を等分して返す。**
 *
 * 点の並びからは選ばない。以前は系列が実際に持っている日付から拾っていたので、
 * 同じ期間を縦に並べた 2 枚でも、記録の密度が違うと目盛りがそろわなかった
 * （体脂肪率は毎日・腹囲は週に 1 度、など）。読む側は同じ横位置を
 * 別の日付として読むことになる。
 *
 * 記録が少ないときの寄りも同じ原因。点が一方に固まっていると、
 * ラベルもそこに固まって、残りの軸が無目盛りのまま残っていた。
 * 軸を等分すれば、**開始日から今日まで**が常に同じ間隔で並ぶ。
 *
 * 刻みは暦日で進める。等分した生の時刻をそのまま使うと、期間が短いときに
 * 同じ日付のラベルが 2 つ出る。ミリ秒で足すと DST の日に 1 時間ずれる。
 */
export function timeTicks(domain: readonly [number, number], count: number): number[] {
  const [d0, d1] = domain;
  if (!Number.isFinite(d0) || !Number.isFinite(d1)) return [];

  const from = toISO(new Date(d0));
  const span = diffDays(toISO(new Date(d1)), from);
  // 1 日ぶんしか無ければ目盛りも 1 本。0 除算も避ける
  if (span <= 0 || count < 2) return [isoToTime(from)];

  // 日数より多くは打てない（同じ日のラベルが並ぶ）
  const n = Math.min(count, span + 1);
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    out.push(isoToTime(addDays(from, Math.round((i * span) / (n - 1)))));
  }
  return [...new Set(out)];
}
