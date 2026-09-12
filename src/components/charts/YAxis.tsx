import type { Scale } from './scales';
import s from './charts.module.scss';

interface Props {
  ticks: readonly number[];
  y: Scale;
  /** グリッド線を引く左端・右端（プロットの幅） */
  left: number;
  right: number;
  /** 目盛りの文字。桁数は面ごとに違う（kg は小数 1 桁、kcal は整数） */
  format: (tick: number) => string;
  /**
   * 0 のグリッド線を引かないか。
   *
   * 発散型（カロリー収支）はゼロ線を**基準線**として軸と同じ強さで別に引くので、
   * 薄いグリッド線が重なると二重に見える。
   */
  skipZeroGrid?: boolean | undefined;
}

/**
 * 縦軸のグリッド線と目盛り。**グラフの縦軸はすべてこれ。**
 *
 * 同じ 20 行が 3 つのグラフに写してあった（推移・週平均の体組成は一字一句同じ、
 * カロリー収支はゼロ線のぶんだけ違う）。線の濃さや目盛りの寄せ（`dy="0.32em"` で
 * 文字の中心を線に合わせる）を直すのに 3 か所を回ることになる。
 *
 * 目盛りの文字は線の左に置く。中に置くとデータの上に文字が乗る。
 */
export function YAxis({ ticks, y, left, right, format, skipZeroGrid }: Props) {
  return (
    <>
      {ticks.map((tick) => (
        <g key={tick}>
          {!(skipZeroGrid && tick === 0) && (
            <line className={s.grid} x1={left} x2={right} y1={y(tick)} y2={y(tick)} />
          )}
          <text className={s.tickLabel} x={left - 7} y={y(tick)} textAnchor="end" dy="0.32em">
            {format(tick)}
          </text>
        </g>
      ))}
    </>
  );
}
