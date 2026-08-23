import { useMemo, useState } from 'react';
import { useElementWidth } from '../../hooks/useElementWidth';
import { formatMD } from '../../lib/date';
import type { EnergyPoint } from '../../lib/energy';
import { divergingBar, linearScale, niceScale } from './scales';
import s from './charts.module.scss';

interface Props {
  points: readonly EnergyPoint[];
  height?: number;
}

const MARGIN = { top: 22, right: 8, bottom: 34, left: 52 } as const;
const MAX_BAR = 24;
const MAX_BAND = 76;

const kcal = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : '±'}${Math.abs(Math.round(v))}`;

/**
 * ゼロを中心に上下へ伸びる発散型の棒。
 * 棒 = 体重ベースの推定（測定が安定している主系列）、
 * 破線マーカー = 体脂肪量ベースの推定（体組成計のノイズが乗るので色は与えず、形で区別する）。
 */
export function EnergyBalanceChart({ points, height = 250 }: Props) {
  const [wrapRef, width] = useElementWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);

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

  const band = points.length > 0 ? Math.min(plotW / points.length, MAX_BAND) : plotW;
  const barW = Math.min(MAX_BAR, band * 0.6);
  const originX = MARGIN.left + (plotW - band * points.length) / 2;
  const bandX = (i: number) => originX + band * i;
  const barX = (i: number) => bandX(i) + (band - barW) / 2;

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

            {scale.ticks
              .filter((tick) => tick !== 0)
              .map((tick) => (
                <line
                  key={tick}
                  className={s.grid}
                  x1={MARGIN.left}
                  x2={MARGIN.left + plotW}
                  y1={y(tick)}
                  y2={y(tick)}
                />
              ))}

            {scale.ticks.map((tick) => (
              <text
                key={`t${tick}`}
                className={s.tickLabel}
                x={MARGIN.left - 7}
                y={y(tick)}
                textAnchor="end"
                dy="0.32em"
              >
                {Math.round(tick)}
              </text>
            ))}

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
              <b>
                {points[active]!.weightDelta > 0 ? '+' : '−'}
                {Math.abs(points[active]!.weightDelta).toFixed(2)} kg
              </b>
            </div>
            <div className={s.tipRow}>
              体脂肪量の変化
              <b>
                {points[active]!.fatDelta == null
                  ? '—'
                  : `${points[active]!.fatDelta! > 0 ? '+' : '−'}${Math.abs(points[active]!.fatDelta!).toFixed(2)} kg`}
              </b>
            </div>
          </div>
        )}
      </div>
    </figure>
  );
}
