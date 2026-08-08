import { useElementWidth } from '../../hooks/useElementWidth';
import { linePath, linearScale } from './scales';
import s from './charts.module.scss';

interface Props {
  points: readonly { t: number; v: number }[];
  color?: string;
  height?: number;
  ariaLabel: string;
}

/** ヒーロー数値に添える 12〜30 点の軌跡。軸も目盛りも持たない「形だけ」の図 */
export function Sparkline({ points, color = 'var(--s-weight)', height = 44, ariaLabel }: Props) {
  const [wrapRef, width] = useElementWidth<HTMLDivElement>();

  const values = points.map((p) => p.v);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = Math.max((max - min) * 0.15, 0.2);

  const x = linearScale(
    [points[0]?.t ?? 0, points[points.length - 1]?.t ?? 1],
    [3, Math.max(4, width - 3)],
  );
  const y = linearScale([min - pad, max + pad], [height - 5, 5]);
  const last = points[points.length - 1];

  return (
    <div className={s.wrap} ref={wrapRef}>
      {points.length >= 2 && width > 0 && (
        <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} role="img" aria-label={ariaLabel}>
          <path
            d={linePath(points.map((p) => ({ x: x(p.t), y: y(p.v) })))}
            fill="none"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {last && (
            <circle cx={x(last.t)} cy={y(last.v)} r={4} fill={color} stroke="var(--surface)" strokeWidth={2} />
          )}
        </svg>
      )}
    </div>
  );
}
