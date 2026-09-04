import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { useElementWidth } from '../../hooks/useElementWidth';
import { formatMD, formatMDW, toISO } from '../../lib/date';
import { linePath, linearScale, niceScale, pickTimeTicks, tickDecimals } from './scales';
import s from './charts.module.scss';

export interface SeriesPoint {
  t: number;
  v: number;
  /** ツールチップに添える補足（例: 換算元のセット「120×3」） */
  note?: string;
}

export interface ChartSeries {
  id: string;
  label: string;
  /** CSS カスタムプロパティ参照（例: 'var(--s-weight)'）。実体に固定した色を渡す */
  color: string;
  kind: 'line' | 'dots';
  points: readonly SeriesPoint[];
  /** 主役の系列。太線＋端点ラベルを付ける */
  emphasis?: boolean;
}

export interface TimeSeriesChartProps {
  series: readonly ChartSeries[];
  domain: readonly [number, number];
  unit: string;
  ariaLabel: string;
  height?: number;
  digits?: number;
  /** 目標値などの参照線 */
  reference?: { value: number; label: string } | null;
  emptyMessage?: string;
  /** 既定は系列が 2 本以上のとき。同じ量を点と線で描く場合は明示的に消す */
  legend?: boolean;
}

const MARGIN = { top: 14, right: 50, bottom: 24, left: 40 } as const;

export function TimeSeriesChart({
  series,
  domain,
  unit,
  ariaLabel,
  height = 220,
  digits = 1,
  reference = null,
  emptyMessage = 'まだ記録がありません',
  legend,
}: TimeSeriesChartProps) {
  const [wrapRef, width] = useElementWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const [tipW, setTipW] = useState(128);

  /*
   * **グラフの外を触ったら選択を解く。**
   *
   * 指を離しても残すようにしたぶん、放っておくと消す手段が無くなる。
   * 別のグラフを触ったときもそちらが選ばれてこちらは消える（同時に 2 つ出さない）。
   * 捕捉フェーズで見るのは、内側のハンドラが動く前に外かどうかを決めたいため。
   */
  useEffect(() => {
    if (active == null) return;
    const onDown = (e: PointerEvent) => {
      const node = wrapRef.current;
      if (node && !node.contains(e.target as Node)) setActive(null);
    };
    document.addEventListener('pointerdown', onDown, true);
    return () => document.removeEventListener('pointerdown', onDown, true);
  }, [active, wrapRef]);

  // 中身で幅が変わるので測る。同じ値なら state を触らない（再描画を呼ばない）
  useLayoutEffect(() => {
    const el = tipRef.current;
    if (!el) return;
    const w = el.offsetWidth;
    setTipW((prev) => (prev === w ? prev : w));
  });

  const times = useMemo(() => {
    const set = new Set<number>();
    for (const serie of series) for (const p of serie.points) set.add(p.t);
    return [...set].sort((a, b) => a - b);
  }, [series]);

  const yScaleInfo = useMemo(() => {
    const values: number[] = [];
    for (const serie of series) for (const p of serie.points) values.push(p.v);
    if (reference) values.push(reference.value);
    if (values.length === 0) return niceScale(0, 1);
    const min = Math.min(...values);
    const max = Math.max(...values);
    // レンジが極端に狭いと直線に見えるので最低幅を確保する
    const pad = Math.max((max - min) * 0.12, 0.4);
    return niceScale(min - pad, max + pad, 5);
  }, [series, reference]);

  const hasData = times.length > 0;
  const plotW = Math.max(0, width - MARGIN.left - MARGIN.right);
  const plotH = height - MARGIN.top - MARGIN.bottom;

  const x = linearScale(domain, [MARGIN.left, MARGIN.left + plotW]);
  const y = linearScale([yScaleInfo.min, yScaleInfo.max], [MARGIN.top + plotH, MARGIN.top]);
  const decimals = tickDecimals(yScaleInfo.step);

  const xTicks = useMemo(() => pickTimeTicks(times, 4), [times]);

  const activeTime = active != null ? times[active] : undefined;

  function handleMove(event: ReactPointerEvent<SVGRectElement>) {
    if (!hasData || plotW <= 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientX - rect.left) / rect.width;
    const t = domain[0] + ratio * (domain[1] - domain[0]);
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < times.length; i++) {
      const dist = Math.abs(times[i]! - t);
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    }
    setActive(best);
  }

  /*
   * ツールチップの横位置。**実測した幅で寄せる。**
   *
   * 以前は幅を 128px と決め打ちしてクランプしていたが、中身は
   * 「● 日平均（実測） 72.3kg」のような行が入るので実際は 150px を超える。
   * その差ぶんだけ、右端の点を選んだときに画面からはみ出していた。
   */
  const tipLeft =
    activeTime != null && width > 0
      ? Math.min(Math.max(x(activeTime) - tipW / 2, 4), Math.max(4, width - tipW - 4))
      : 0;

  const showLegend = legend ?? series.length >= 2;

  return (
    <figure>
      {showLegend && (
        <div className={s.legend}>
          {series.map((serie) => (
            <span key={serie.id} className={s.legendItem}>
              <i
                className={serie.kind === 'dots' ? s.keyDot : s.keyLine}
                style={{ background: serie.color }}
                aria-hidden="true"
              />
              {serie.label}
            </span>
          ))}
        </div>
      )}

      <div className={s.wrap} ref={wrapRef}>
        {!hasData && <div className={s.empty}>{emptyMessage}</div>}

        {hasData && width > 0 && (
          <svg
            viewBox={`0 0 ${width} ${height}`}
            width={width}
            height={height}
            role="img"
            aria-label={ariaLabel}
          >
            <title>{ariaLabel}</title>

            {yScaleInfo.ticks.map((tick) => (
              <g key={tick}>
                <line
                  className={s.grid}
                  x1={MARGIN.left}
                  x2={MARGIN.left + plotW}
                  y1={y(tick)}
                  y2={y(tick)}
                />
                <text
                  className={s.tickLabel}
                  x={MARGIN.left - 7}
                  y={y(tick)}
                  textAnchor="end"
                  dy="0.32em"
                >
                  {tick.toFixed(decimals)}
                </text>
              </g>
            ))}

            <line
              className={s.axis}
              x1={MARGIN.left}
              x2={MARGIN.left + plotW}
              y1={MARGIN.top + plotH}
              y2={MARGIN.top + plotH}
            />

            {xTicks.map((t) => (
              <text
                key={t}
                className={s.tickLabel}
                x={x(t)}
                y={MARGIN.top + plotH + 15}
                textAnchor="middle"
              >
                {formatMD(toISO(new Date(t)))}
              </text>
            ))}

            {reference && (
              <>
                <line
                  className={s.refLine}
                  x1={MARGIN.left}
                  x2={MARGIN.left + plotW}
                  y1={y(reference.value)}
                  y2={y(reference.value)}
                />
                <text
                  className={s.refLabel}
                  x={MARGIN.left + plotW}
                  y={y(reference.value) - 5}
                  textAnchor="end"
                >
                  {reference.label}
                </text>
              </>
            )}

            {activeTime != null && (
              <line
                className={s.crosshair}
                x1={x(activeTime)}
                x2={x(activeTime)}
                y1={MARGIN.top}
                y2={MARGIN.top + plotH}
              />
            )}

            {/* 点群を先に、線を後に描いて主役の系列を最前面に置く */}
            {series
              .filter((serie) => serie.kind === 'dots')
              .map((serie) => (
                <g key={serie.id}>
                  {serie.points.map((p) => (
                    <circle
                      key={p.t}
                      cx={x(p.t)}
                      cy={y(p.v)}
                      r={3}
                      fill={serie.color}
                      opacity={0.75}
                    />
                  ))}
                </g>
              ))}

            {series
              .filter((serie) => serie.kind === 'line')
              .map((serie) => {
                const path = linePath(serie.points.map((p) => ({ x: x(p.t), y: y(p.v) })));
                const last = serie.points[serie.points.length - 1];
                return (
                  <g key={serie.id}>
                    <path
                      d={path}
                      fill="none"
                      stroke={serie.color}
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    {serie.emphasis && last && (
                      <>
                        <circle
                          cx={x(last.t)}
                          cy={y(last.v)}
                          r={4.5}
                          fill={serie.color}
                          stroke="var(--surface)"
                          strokeWidth={2}
                        />
                        <text className={s.endLabel} x={x(last.t) + 9} y={y(last.v)} dy="0.32em">
                          {last.v.toFixed(digits)}
                        </text>
                      </>
                    )}
                  </g>
                );
              })}

            {/* ホバー中の点は 2px のサーフェスリングで線から浮かせる */}
            {activeTime != null &&
              series.map((serie) => {
                const p = serie.points.find((point) => point.t === activeTime);
                if (!p) return null;
                return (
                  <circle
                    key={`hi-${serie.id}`}
                    cx={x(p.t)}
                    cy={y(p.v)}
                    r={4.5}
                    fill={serie.color}
                    stroke="var(--surface)"
                    strokeWidth={2}
                  />
                );
              })}

            <rect
              className={s.hit}
              x={MARGIN.left}
              y={MARGIN.top}
              width={plotW}
              height={plotH}
              onPointerMove={handleMove}
              onPointerDown={handleMove}
              /*
                **指を離しても選択を残す。**
                タッチは離した時点でポインタが消えて pointerleave が飛ぶので、
                ここで捨てると「押しっぱなしにしないと読めない」になる。
                押したまま滑らせて合わせ、離して読む、という操作を通す。
                マウスは離れたら消す（ホバーはそういうもの）。
              */
              onPointerLeave={(e) => {
                if (e.pointerType === 'mouse') setActive(null);
              }}
            />
          </svg>
        )}

        {activeTime != null && (
          <div ref={tipRef} className={`${s.tip} ${s.tipOn}`} style={{ left: tipLeft }}>
            <div className={s.tipDate}>{formatMDW(toISO(new Date(activeTime)))}</div>
            {series.map((serie) => {
              const p = serie.points.find((point) => point.t === activeTime);
              return (
                <div key={serie.id} className={s.tipRow}>
                  <i className={s.keyDot} style={{ background: serie.color }} aria-hidden="true" />
                  {serie.label}
                  <b>
                    {p ? `${p.v.toFixed(digits)}${unit}` : '—'}
                    {p?.note ? ` · ${p.note}` : ''}
                  </b>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </figure>
  );
}
