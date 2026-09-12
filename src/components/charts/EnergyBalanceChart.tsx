import { useMemo, useRef, useState } from 'react';
import { useElementWidth } from '../../hooks/useElementWidth';
import { insideRect, useDismiss } from '../../hooks/useDismiss';
import { formatMD } from '../../lib/date';
import { fmtDelta } from '../../lib/format';
import type { EnergyPoint } from '../../lib/energy';
import { bandLayout, divergingBar, linearScale, niceScale } from './scales';
import { YAxis } from './YAxis';
import s from './charts.module.scss';

interface Props {
  points: readonly EnergyPoint[];
  height?: number;
}

const MARGIN = { top: 22, right: 8, bottom: 34, left: 52 } as const;
const MAX_BAR = 24;
const MAX_BAND = 76;

/** kcal は整数で出す。符号の付け方（0 は ±）は `fmtDelta` が持つ */
const kcal = (v: number) => fmtDelta(v, 0);

/**
 * ゼロを中心に上下へ伸びる発散型の棒。
 * 棒 = 体重ベースの推定（測定が安定している主系列）、
 * 破線マーカー = 体脂肪量ベースの推定（体組成計のノイズが乗るので色は与えず、形で区別する）。
 */
export function EnergyBalanceChart({ points, height = 250 }: Props) {
  const [wrapRef, width] = useElementWidth<HTMLDivElement>();
  /** プロットの矩形。外を触ったかどうかは**ここ**で判定する */
  const plotRef = useRef<SVGRectElement>(null);
  const [active, setActive] = useState<number | null>(null);

  // 指では pointerleave が来ないので、外を触るか Esc で閉じられるようにする
  useDismiss(active != null, () => setActive(null), insideRect(plotRef));

  const scale = useMemo(() => {
    const values: number[] = [0];
    for (const p of points) {
      values.push(p.kcalWeight);
      if (p.kcalFat != null) values.push(p.kcalFat);
    }
    // 0 を必ず含める。発散型はゼロ線が意味を持つ基準になる
    return niceScale(Math.min(...values), Math.max(...values), 5);
  }, [points]);

  const plotW = Math.max(0, width - MARGIN.left - MARGIN.right);
  const plotH = height - MARGIN.top - MARGIN.bottom;
  const y = linearScale([scale.min, scale.max], [MARGIN.top + plotH, MARGIN.top]);

  const { band, barW, bandX, barX } = bandLayout(
    points.length,
    plotW,
    MARGIN.left,
    MAX_BAND,
    MAX_BAR,
  );

  const yZero = y(0);
  const labelEvery = points.length <= 8;

  return (
    <figure>
      <div className={s.legend}>
        <span className={s.legendItem}>
          <i className={s.keyBox} style={{ background: 'var(--s-deficit)' }} aria-hidden="true" />
          不足（マイナス収支）
        </span>
        <span className={s.legendItem}>
          <i className={s.keyBox} style={{ background: 'var(--s-surplus)' }} aria-hidden="true" />
          余剰（プラス収支）
        </span>
        <span className={s.legendItem}>
          <i className={s.keyLine} style={{ background: 'var(--ink-2)' }} aria-hidden="true" />
          体脂肪量ベースの推定
        </span>
      </div>

      <div className={s.wrap} ref={wrapRef}>
        {width > 0 && (
          <svg
            viewBox={`0 0 ${width} ${height}`}
            width={width}
            height={height}
            role="img"
            aria-label="週ごとの推定カロリー収支（kcal/日）"
            onPointerLeave={() => setActive(null)}
          >
            <title>週ごとの推定カロリー収支（kcal/日）</title>

            {/* ゼロ線はグリッドではなく基準線なので、下で軸と同じ強さで引く */}
            <YAxis
              ticks={scale.ticks}
              y={y}
              left={MARGIN.left}
              right={MARGIN.left + plotW}
              format={(tick) => String(Math.round(tick))}
              skipZeroGrid
            />

            {/* 外を触ったかどうかを決めるだけの矩形。触れる的は棒ごとに持つ */}
            <rect
              ref={plotRef}
              data-plot=""
              x={MARGIN.left}
              y={MARGIN.top}
              width={plotW}
              height={plotH}
              fill="none"
              pointerEvents="none"
            />

            {points.map((point, i) => {
              const x = barX(i);
              const yValue = y(point.kcalWeight);
              const positive = point.kcalWeight > 0;
              const labelY = positive ? yValue - 7 : yValue + 14;

              return (
                <g
                  key={point.key}
                  onPointerEnter={() => setActive(i)}
                  onPointerDown={() => setActive(i)}
                >
                  <rect className={s.hit} x={bandX(i)} y={MARGIN.top} width={band} height={plotH} />

                  <path
                    d={divergingBar(x, barW, yZero, yValue, 4)}
                    fill={positive ? 'var(--s-surplus)' : 'var(--s-deficit)'}
                  />

                  {point.kcalFat != null && (
                    <>
                      {/* サーフェス色のハローを敷いて、棒の上でも地の上でも読めるようにする */}
                      <line
                        x1={x - 4}
                        x2={x + barW + 4}
                        y1={y(point.kcalFat)}
                        y2={y(point.kcalFat)}
                        stroke="var(--surface)"
                        strokeWidth={5}
                        strokeLinecap="round"
                      />
                      <line
                        x1={x - 4}
                        x2={x + barW + 4}
                        y1={y(point.kcalFat)}
                        y2={y(point.kcalFat)}
                        stroke="var(--ink-2)"
                        strokeWidth={2}
                        strokeLinecap="round"
                      />
                      {labelEvery && (
                        // 棒との差そのものが体組成計の荒れ具合の目安なので、両方の値を読めるようにする
                        <text
                          className={s.tickLabel}
                          x={x + barW + 10 + 34 < MARGIN.left + plotW ? x + barW + 10 : x - 10}
                          y={y(point.kcalFat)}
                          dy="0.32em"
                          textAnchor={x + barW + 10 + 34 < MARGIN.left + plotW ? 'start' : 'end'}
                        >
                          {kcal(point.kcalFat)}
                        </text>
                      )}
                    </>
                  )}

                  {labelEvery && (
                    <text className={s.endLabel} x={x + barW / 2} y={labelY} textAnchor="middle">
                      {kcal(point.kcalWeight)}
                    </text>
                  )}

                  <text
                    className={s.tickLabel}
                    x={bandX(i) + band / 2}
                    y={MARGIN.top + plotH + 15}
                    textAnchor="middle"
                  >
                    {point.label}
                  </text>
                  <text
                    className={s.tickLabel}
                    x={bandX(i) + band / 2}
                    y={MARGIN.top + plotH + 27}
                    textAnchor="middle"
                  >
                    {formatMD(point.to)}
                  </text>
                </g>
              );
            })}

            {/* ゼロ線はグリッドではなく基準線なので、軸と同じ強さで一段濃く引く */}
            <line
              className={s.axis}
              x1={MARGIN.left}
              x2={MARGIN.left + plotW}
              y1={yZero}
              y2={yZero}
            />
          </svg>
        )}

        {active != null && points[active] && (
          <div
            className={`${s.tip} ${s.tipOn}`}
            style={{ left: Math.min(Math.max(barX(active) - 60, 4), Math.max(4, width - 168)) }}
          >
            <div className={s.tipDate}>
              {formatMD(points[active]!.from)}〜{formatMD(points[active]!.to)}（
              {points[active]!.days}日）
            </div>
            <div className={s.tipRow}>
              <i
                className={s.keyDot}
                style={{
                  background:
                    points[active]!.kcalWeight > 0 ? 'var(--s-surplus)' : 'var(--s-deficit)',
                }}
                aria-hidden="true"
              />
              体重ベース
              <b>{kcal(points[active]!.kcalWeight)} kcal/日</b>
            </div>
            <div className={s.tipRow}>
              <i className={s.keyLine} style={{ background: 'var(--ink-2)' }} aria-hidden="true" />
              体脂肪量ベース
              <b>
                {points[active]!.kcalFat == null
                  ? '—'
                  : `${kcal(points[active]!.kcalFat!)} kcal/日`}
              </b>
            </div>
            <div className={s.tipRow}>
              体重の変化
              <b>{fmtDelta(points[active]!.weightDelta, 2)} kg</b>
            </div>
            <div className={s.tipRow}>
              体脂肪量の変化
              <b>
                {points[active]!.fatDelta == null
                  ? '—'
                  : `${fmtDelta(points[active]!.fatDelta, 2)} kg`}
              </b>
            </div>
          </div>
        )}
      </div>
    </figure>
  );
}
