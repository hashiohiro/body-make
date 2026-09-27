import { Strong } from '../Strong';
import { linePath, linearScale } from '../charts/scales';
import { useElementWidth } from '../../hooks/useElementWidth';
import { formatMD, formatYMD, isoToTime } from '../../lib/date';
import { fmtDelta } from '../../lib/format';
import { gaugeDomain } from '../../lib/pace';
import type { PaceGap, PaceLine } from '../../lib/pace';
import { useT } from '../../lib/i18n';
import ui from '../../styles/ui.module.scss';
import s from './pace.module.scss';

interface Props {
  gap: PaceGap;
  /** 目標日までの小さな図。目標日が無い・移動平均がまだ出ていなければ null */
  line: PaceLine | null;
  targetDate: string | null;
}

/**
 * 実績と必要のペースを 1 本の軸に置く。**目標のカード（`GoalMeter`）の中身**で、単独のカードではない。
 *
 * 以前は同じ 2 つの値を文字で 2 行出していた。**2 つの符号が逆**だということは、
 * 同じ軸に乗せれば判定語を足さなくても読める（`docs/design-pace.md` §1.1）。
 * 2 点は色だけでなく形（丸と菱形）でも分ける。
 *
 * 片方の値が出なくても**枠は出し続ける。**空のタイルに「何を入れれば出るか」を添える。
 */
export function PacePanel({ gap, line, targetDate }: Props) {
  const t = useT();

  return (
    <div className={s.panel}>
      <Gauge gap={gap} />

      <div className={s.pair}>
        <div className={s.tile}>
          <span className={s.tileLabel}>
            <Marker kind="actual" />
            {t('pace.actual')}
          </span>
          <span className={s.big}>
            {fmtDelta(gap.pace, 2)} <small>{t('pace.perWeek')}</small>
          </span>
          {gap.kcalPace != null ? (
            <span>
              <Strong text={t('pace.kcal')} values={[fmtDelta(gap.kcalPace, 0)]} />
            </span>
          ) : (
            <span>{t('pace.needRecords')}</span>
          )}
        </div>
        <div className={s.tile}>
          <span className={s.tileLabel}>
            <Marker kind="required" />
            {targetDate
              ? t('pace.required', { date: formatMD(targetDate) })
              : t('pace.requiredNoDate')}
          </span>
          <span className={s.big}>
            {fmtDelta(gap.required, 2)} <small>{t('pace.perWeek')}</small>
          </span>
          {gap.kcalRequired != null ? (
            <span>
              <Strong text={t('pace.kcal')} values={[fmtDelta(gap.kcalRequired, 0)]} />
            </span>
          ) : (
            <span>{targetDate ? '—' : t('pace.needDate')}</span>
          )}
        </div>
      </div>

      {line && targetDate && (
        <div className={s.sub}>
          <p className={s.subTitle}>{t('pace.lineTitle')}</p>
          <LineChart
            line={line}
            ariaLabel={t('pace.lineLabel', { date: formatYMD(t, targetDate) })}
          />
        </div>
      )}

      {(gap.kcalPace != null || gap.kcalRequired != null) && (
        <p className={ui.note}>{t('pace.kcalNote')}</p>
      )}
    </div>
  );
}

/**
 * 印の大きさ。**ゲージと推移図とで 1 つにそろえる。**
 * ひし形は丸と同じ半径だと枠線のぶん大きく見えるので、対角の半分を少し詰める。
 */
const MARK_R = 6;
const DIAMOND_R = 5.5;
const MARK_STROKE = 2;

const GAUGE_HEIGHT = 58;
const GAUGE_Y = 30;

function Gauge({ gap }: { gap: PaceGap }) {
  const t = useT();
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const domain = gaugeDomain(gap);
  if (domain == null) return null;

  const x = linearScale(domain, [10, Math.max(11, width - 10)]);
  const xPace = gap.pace == null ? null : x(gap.pace);
  const xRequired = gap.required == null ? null : x(gap.required);

  return (
    <div className={s.chart} ref={ref}>
      {width > 0 && (
        <svg
          viewBox={`0 0 ${width} ${GAUGE_HEIGHT}`}
          height={GAUGE_HEIGHT}
          role="img"
          aria-label={t('pace.gaugeLabel', {
            pace: fmtDelta(gap.pace, 2),
            required: fmtDelta(gap.required, 2),
          })}
        >
          <line
            x1={10}
            x2={width - 10}
            y1={GAUGE_Y}
            y2={GAUGE_Y}
            stroke="var(--border)"
            strokeWidth={6}
            strokeLinecap="round"
          />
          <line
            x1={x(0)}
            x2={x(0)}
            y1={GAUGE_Y - 12}
            y2={GAUGE_Y + 12}
            stroke="var(--ink-muted)"
            strokeWidth={1.5}
          />
          <text x={x(0)} y={GAUGE_HEIGHT - 2} textAnchor="middle">
            0
          </text>
          {/* 差は 2 点が揃ったときだけ */}
          {xPace != null && xRequired != null && (
            <>
              <line
                x1={xRequired}
                x2={xPace}
                y1={GAUGE_Y}
                y2={GAUGE_Y}
                stroke="var(--ink)"
                strokeWidth={1.5}
                strokeDasharray="4 3"
              />
              <text x={(xPace + xRequired) / 2} y={11} textAnchor="middle" className={s.strongText}>
                {t('pace.gap', { n: Math.abs(gap.pace! - gap.required!).toFixed(2) })}
              </text>
            </>
          )}
          {xRequired != null && <Diamond cx={xRequired} cy={GAUGE_Y} />}
          {xPace != null && (
            <circle
              cx={xPace}
              cy={GAUGE_Y}
              r={MARK_R}
              fill="var(--s-weight)"
              stroke="var(--surface)"
              strokeWidth={MARK_STROKE}
            />
          )}
        </svg>
      )}
    </div>
  );
}

const LINE_HEIGHT = 140;

function LineChart({ line, ariaLabel }: { line: PaceLine; ariaLabel: string }) {
  const t = useT();
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const first = line.recent[0]!;

  const values = [...line.recent.map((p) => p.value), line.to.value];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = Math.max((max - min) * 0.12, 0.3);

  const right = Math.max(40, width - 30);
  const x = linearScale([isoToTime(first.date), isoToTime(line.to.date)], [4, right]);
  const y = linearScale([min - pad, max + pad], [LINE_HEIGHT - 20, 8]);

  const fromX = x(isoToTime(line.from.date));
  const fromY = y(line.from.value);
  const toX = x(isoToTime(line.to.date));
  const toY = y(line.to.value);

  return (
    <div className={s.chart} ref={ref}>
      {width > 0 && (
        <svg
          viewBox={`0 0 ${width} ${LINE_HEIGHT}`}
          height={LINE_HEIGHT}
          role="img"
          aria-label={ariaLabel}
        >
          <line x1={4} x2={right} y1={toY} y2={toY} stroke="var(--border)" />
          <text x={width - 2} y={toY + 4} textAnchor="end" className={s.strongText}>
            {line.to.value.toFixed(1)}
          </text>
          <text x={width - 2} y={fromY + 4} textAnchor="end">
            {line.from.value.toFixed(1)}
          </text>

          <line
            x1={fromX}
            y1={fromY}
            x2={toX}
            y2={toY}
            stroke="var(--ink)"
            strokeWidth={1.5}
            strokeDasharray="5 4"
          />
          <path
            d={linePath(line.recent.map((p) => ({ x: x(isoToTime(p.date)), y: y(p.value) })))}
            fill="none"
            stroke="var(--s-weight)"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle
            cx={fromX}
            cy={fromY}
            r={MARK_R}
            fill="var(--s-weight)"
            stroke="var(--surface)"
            strokeWidth={MARK_STROKE}
          />
          <Diamond cx={toX} cy={toY} />

          <text x={4} y={LINE_HEIGHT - 2}>
            {formatMD(first.date)}
          </text>
          <text x={fromX} y={LINE_HEIGHT - 2} textAnchor="middle" className={s.strongText}>
            {t('common.today')}
          </text>
          <text x={toX} y={LINE_HEIGHT - 2} textAnchor="end">
            {formatMD(line.to.date)}
          </text>
        </svg>
      )}
    </div>
  );
}

/** 必要ペース（目標）側の印。実績の丸と形で分ける */
function Diamond({ cx, cy, r = DIAMOND_R }: { cx: number; cy: number; r?: number }) {
  return (
    <path
      d={`M${cx} ${cy - r}L${cx + r} ${cy}L${cx} ${cy + r}L${cx - r} ${cy}Z`}
      fill="var(--surface)"
      stroke="var(--ink)"
      strokeWidth={MARK_STROKE}
      strokeLinejoin="round"
    />
  );
}

function Marker({ kind }: { kind: 'actual' | 'required' }) {
  return (
    <svg width={10} height={10} viewBox="0 0 10 10" aria-hidden="true">
      {kind === 'actual' ? (
        <circle cx={5} cy={5} r={4} fill="var(--s-weight)" />
      ) : (
        // 図の中の印と同じ比（丸 6 : ひし形 5.5）で、凡例の丸 4 に合わせる
        <path d="M5 1.5L8.5 5L5 8.5L1.5 5Z" fill="none" stroke="var(--ink)" strokeWidth={1.5} />
      )}
    </svg>
  );
}
