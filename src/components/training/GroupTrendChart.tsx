import { useState } from 'react';
import { TimeSeriesChart } from '../charts/TimeSeriesChart';
import type { ChartSeries } from '../charts/TimeSeriesChart';
import { GROUP_COLORS, GROUP_LABELS, GROUP_ORDER } from '../../lib/exerciseCatalog';
import { addDays, isoToTime } from '../../lib/date';
import type { WeekSetCount } from '../../lib/training';
import type { MuscleGroup } from '../../types';
import ui from '../../styles/ui.module.scss';

type ValueId = 'sets' | 'volume';

const VALUES: {
  id: ValueId;
  label: string;
  unit: string;
  digits: number;
  pick: (w: WeekSetCount, g: MuscleGroup) => number;
}[] = [
  { id: 'sets', label: 'セット数', unit: 'セット', digits: 1, pick: (w, g) => w.setsByGroup[g] },
  {
    id: 'volume',
    label: '挙上量',
    unit: 'kg',
    digits: 0,
    pick: (w, g) => Math.round(w.volumeByGroup[g]),
  },
];

interface Props {
  weeks: readonly WeekSetCount[];
}

/**
 * 部位ごとの週次推移。
 *
 * 下の「部位別の配分」は 1 週ずつの数字を読む表で、そこから増減の向きは読み取れない。
 * どの部位を増やしてきて、どこが落ちたままかは形でしか見えないので、別に線で描く。
 *
 * 6 本を同時に描くため、色は配色に依らず固定する（GROUP_COLORS）。
 * 記録の無い部位は線を出さない。0 が横に伸びるだけで場所を取る
 */
export function GroupTrendChart({ weeks }: Props) {
  const [valueId, setValueId] = useState<ValueId>('sets');
  const value = VALUES.find((v) => v.id === valueId)!;

  if (weeks.length === 0) {
    return (
      <section className={ui.card}>
        <p className={ui.emptyState}>まだトレーニングの記録がありません。</p>
      </section>
    );
  }

  const series: ChartSeries[] = GROUP_ORDER.filter((g) =>
    weeks.some((w) => value.pick(w, g) > 0),
  ).map((g) => ({
    id: g,
    label: GROUP_LABELS[g],
    color: GROUP_COLORS[g],
    kind: 'line',
    points: weeks.map((w) => ({ t: isoToTime(w.start), v: value.pick(w, g) })),
  }));

  const first = weeks[0]!;
  const last = weeks[weeks.length - 1]!;
  const domain: [number, number] = [isoToTime(first.start), isoToTime(addDays(last.start, 6))];

  return (
    <section className={ui.card}>
      <header className={ui.cardHeader}>
        <h2 className={ui.cardTitle}>部位別の推移</h2>
        <span className={ui.hint}>週あたり</span>
      </header>

      <div className={ui.chipRow} role="group" aria-label="表示する値">
        {VALUES.map((v) => (
          <button
            key={v.id}
            type="button"
            className={ui.chip}
            aria-pressed={valueId === v.id}
            onClick={() => setValueId(v.id)}
          >
            {v.label}
          </button>
        ))}
      </div>

      <TimeSeriesChart
        series={series}
        domain={domain}
        unit={value.unit}
        digits={value.digits}
        legend
        ariaLabel={`部位別の週あたり${value.label}の推移`}
        emptyMessage="この期間に記録がありません"
      />
    </section>
  );
}
