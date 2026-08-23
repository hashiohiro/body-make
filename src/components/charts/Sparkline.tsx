import { useElementWidth } from '../../hooks/useElementWidth';
import { linePath, linearScale } from './scales';
import s from './charts.module.scss';

interface Props {
  points: readonly { t: number; v: number }[];
  color?: string;
  height?: number;
  /** 最新点の丸。地の色で縁取るので、面の色が違う場所に置くときは切る */
  dot?: boolean;
  ariaLabel: string;
}

/**
 * ヒーロー数値に添える 12〜30 点の軌跡。軸も目盛りも持たない「形だけ」の図。
 *
 * 系列ごとに 1 つ描く。体重と除脂肪体重を 1 本の軸に重ねると、
 * 差（＝体脂肪量）は正しく見えるが縦幅が 14kg ほどに広がり、
 * それぞれの ±0.5kg の動きが潰れて読めなくなる。
 * ここで見たいのは差の絶対量ではなく「それぞれの形」なので、別々に描く。
 *
 * 線と点の太さは height に追従させる。一覧の行（24px 前後）に
 * ヒーロー用の太さのまま置くと、線が図を塗り潰してしまう。
 */
export function Sparkline({
  points,
  color = 'var(--s-weight)',
  height = 44,
  dot = true,
  ariaLabel,
}: Props) {
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
  const stroke = Math.max(1.5, height / 22);
  const dotRadius = Math.max(2.5, height / 11);

  return (
    <div className={s.wrap} ref={wrapRef}>
      {points.length >= 2 && width > 0 && (
        <svg
          viewBox={`0 0 ${width} ${height}`}
          width={width}
          height={height}
          role="img"
          aria-label={ariaLabel}
        >
          <path
            d={linePath(points.map((p) => ({ x: x(p.t), y: y(p.v) })))}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {dot && last && (
            <circle
              cx={x(last.t)}
              cy={y(last.v)}
              r={dotRadius}
              fill={color}
              stroke="var(--surface)"
              strokeWidth={stroke}
            />
          )}
        </svg>
      )}
    </div>
  );
}
