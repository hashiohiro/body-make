import { useMemo, useState } from 'react';
import { useElementWidth } from '../../hooks/useElementWidth';
import { formatMD } from '../../lib/date';
import type { WeekPoint } from '../../types';
import { linearScale, niceScale, roundedTopRect, tickDecimals } from './scales';
import s from './charts.module.scss';

interface Props {
  weeks: readonly WeekPoint[];
  height?: number;
}

const MARGIN = { top: 20, right: 8, bottom: 34, left: 40 } as const;
const MAX_BAR = 24;
/** 週が少ないときに棒が散らばらないよう、1 本あたりの占有幅にも上限を置く */
const MAX_BAND = 76;
/** 積み上げの境目はサーフェス色の隙間で切る（枠線を描くとデータ以外のインクが増える） */
const SEGMENT_GAP = 2;

export function WeeklyCompositionChart({ weeks, height = 250 }: Props) {
  const [wrapRef, width] = useElementWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);

  const rows = useMemo(
    () => weeks.filter((w) => w.leanMass != null && w.fatMass != null),
    [weeks],
  );

  const scale = useMemo(() => {
    const totals = rows.map((w) => (w.leanMass ?? 0) + (w.fatMass ?? 0));
    if (totals.length === 0) return niceScale(0, 1);
    // 積み上げ棒は 0 から積むのが前提。天面ラベルの余白は上マージンで確保する
    return niceScale(0, Math.max(...totals), 5);
  }, [rows]);

  const plotW = Math.max(0, width - MARGIN.left - MARGIN.right);
  const plotH = height - MARGIN.top - MARGIN.bottom;
  const y = linearScale([scale.min, scale.max], [MARGIN.top + plotH, MARGIN.top]);
  const decimals = tickDecimals(scale.step);

  const band = rows.length > 0 ? Math.min(plotW / rows.length, MAX_BAND) : plotW;
  const barW = Math.min(MAX_BAR, band * 0.6);
  // 上限に当たったぶんは全体を中央へ寄せる
  const originX = MARGIN.left + (plotW - band * rows.length) / 2;
  const bandX = (i: number) => originX + band * i;
  const barX = (i: number) => bandX(i) + (band - barW) / 2;

  const labelEvery = rows.length <= 8;

  if (rows.length === 0) {
    return (
      <figure>
        <div className={s.wrap} ref={wrapRef}>
          <div className={s.empty}>
            体組成の内訳には体重と体脂肪率の両方が必要です。
            <br />
            両方そろった週ができると表示されます。
          </div>
        </div>
      </figure>
    );
  }

  return (
    <figure>
      <div className={s.legend}>
        <span className={s.legendItem}>
          <i className={s.keyBox} style={{ background: 'var(--s-lean)' }} aria-hidden="true" />
          除脂肪体重
        </span>
        <span className={s.legendItem}>
          <i className={s.keyBox} style={{ background: 'var(--s-fat)' }} aria-hidden="true" />
          体脂肪量
        </span>
      </div>

      <div className={s.wrap} ref={wrapRef}>
        {width > 0 && (
          <svg
            viewBox={`0 0 ${width} ${height}`}
            width={width}
            height={height}
            role="img"
            aria-label="週平均の体組成（除脂肪体重と体脂肪量の積み上げ）"
            onPointerLeave={() => setActive(null)}
          >
            <title>週平均の体組成（除脂肪体重と体脂肪量の積み上げ）</title>

            {scale.ticks.map((tick) => (
              <g key={tick}>
                <line className={s.grid} x1={MARGIN.left} x2={MARGIN.left + plotW} y1={y(tick)} y2={y(tick)} />
                <text className={s.tickLabel} x={MARGIN.left - 7} y={y(tick)} textAnchor="end" dy="0.32em">
                  {tick.toFixed(decimals)}
                </text>
              </g>
            ))}

            {rows.map((week, i) => {
              const lean = week.leanMass ?? 0;
              const fat = week.fatMass ?? 0;
              const total = lean + fat;
              const baseY = y(scale.min);
              const leanTop = y(lean);
              const totalTop = y(total);
              const leanH = Math.max(0, baseY - leanTop - SEGMENT_GAP);
              const fatH = Math.max(0, leanTop - totalTop);
              const x = barX(i);

              return (
                <g
                  key={week.start}
                  onPointerEnter={() => setActive(i)}
                  onPointerDown={() => setActive(i)}
                >
                  {/* 当たり判定は棒より広く取り、細い棒でも触りやすくする */}
                  <rect
                    className={s.hit}
                    x={bandX(i)}
                    y={MARGIN.top}
                    width={band}
                    height={plotH}
                  />
                  <rect x={x} y={leanTop + SEGMENT_GAP} width={barW} height={leanH} fill="var(--s-lean)" />
                  <path d={roundedTopRect(x, totalTop, barW, fatH, 4)} fill="var(--s-fat)" />
                  {(labelEvery || i === rows.length - 1) && (
                    <text className={s.endLabel} x={x + barW / 2} y={totalTop - 7} textAnchor="middle">
                      {total.toFixed(1)}
                    </text>
                  )}
                  <text
                    className={s.tickLabel}
                    x={bandX(i) + band / 2}
                    y={MARGIN.top + plotH + 15}
                    textAnchor="middle"
                  >
                    {week.label}
                  </text>
                  <text
                    className={s.tickLabel}
                    x={bandX(i) + band / 2}
                    y={MARGIN.top + plotH + 27}
                    textAnchor="middle"
                  >
                    {formatMD(week.start)}
                  </text>
                </g>
              );
            })}

            <line
              className={s.axis}
              x1={MARGIN.left}
              x2={MARGIN.left + plotW}
              y1={MARGIN.top + plotH}
              y2={MARGIN.top + plotH}
            />
          </svg>
        )}

        {active != null && rows[active] && (
          <div
            className={`${s.tip} ${s.tipOn}`}
            style={{ left: Math.min(Math.max(barX(active) - 50, 4), Math.max(4, width - 132)) }}
          >
            <div className={s.tipDate}>
              {rows[active]!.label} · {formatMD(rows[active]!.start)}〜{formatMD(rows[active]!.end)}
            </div>
            <div className={s.tipRow}>
              <i className={s.keyDot} style={{ background: 'var(--s-lean)' }} aria-hidden="true" />
              除脂肪体重
              <b>{rows[active]!.leanMass!.toFixed(1)}kg</b>
            </div>
            <div className={s.tipRow}>
              <i className={s.keyDot} style={{ background: 'var(--s-fat)' }} aria-hidden="true" />
              体脂肪量
              <b>{rows[active]!.fatMass!.toFixed(1)}kg</b>
            </div>
            <div className={s.tipRow}>
              体脂肪率
              <b>{rows[active]!.bodyFat!.toFixed(1)}%</b>
            </div>
          </div>
        )}
      </div>
    </figure>
  );
}
