import { useMemo, useState } from 'react';
import { TimeSeriesChart } from '../components/charts/TimeSeriesChart';
import type { ChartSeries } from '../components/charts/TimeSeriesChart';
import { EnergyBalanceChart } from '../components/charts/EnergyBalanceChart';
import { WeeklyCompositionChart } from '../components/charts/WeeklyCompositionChart';
import { DailyTable, EnergyTable, WeeklyTable } from '../components/DataTables';
import { TrainingCharts } from '../components/training/TrainingCharts';
import { addDays, isoToTime, todayISO } from '../lib/date';
import { computeEnergyBalance, ENERGY_WINDOWS, weeksShort } from '../lib/energy';
import type { EnergyWindow } from '../lib/energy';
import type { BodyData } from '../hooks/useBodyData';
import ui from '../styles/ui.module.scss';

type RangeId = '30' | '90' | 'all';

const RANGES: { id: RangeId; label: string; days: number | null }[] = [
  { id: '30', label: '30日', days: 30 },
  { id: '90', label: '90日', days: 90 },
  { id: 'all', label: '全期間', days: null },
];

type Mode = 'body' | 'training';

export function ChartsView({ body }: { body: BodyData }) {
  const { daily, weeks, sessions, data } = body;
  const [mode, setMode] = useState<Mode>('body');
  const [range, setRange] = useState<RangeId>('all');
  const [energyWindow, setEnergyWindow] = useState<EnergyWindow>(1);

  const today = todayISO();
  // 体重より先にトレーニングを記録し始めた場合も期間の起点に含める
  const firstDate = [daily[0]?.date, sessions[0]?.date].filter(Boolean).sort()[0] ?? today;

  const from = useMemo(() => {
    const days = RANGES.find((r) => r.id === range)?.days ?? null;
    if (days == null) return firstDate;
    const start = addDays(today, -(days - 1));
    return start < firstDate ? firstDate : start;
  }, [range, firstDate, today]);

  const visible = useMemo(() => daily.filter((p) => p.date >= from), [daily, from]);
  const visibleWeeks = useMemo(() => weeks.filter((w) => w.end >= from), [weeks, from]);
  const energy = useMemo(
    () => computeEnergyBalance(visibleWeeks, energyWindow),
    [visibleWeeks, energyWindow],
  );
  const shortBy = weeksShort(visibleWeeks, energyWindow);

  const domain: [number, number] = [
    isoToTime(visible[0]?.date ?? from),
    isoToTime(visible[visible.length - 1]?.date ?? today),
  ];

  const weightSeries: ChartSeries[] = [
    {
      id: 'weight-raw',
      label: '日平均（実測）',
      color: 'var(--s-weight)',
      kind: 'dots',
      points: visible.filter((p) => p.weight != null).map((p) => ({ t: p.time, v: p.weight! })),
    },
    {
      id: 'weight-ma',
      label: '7日移動平均',
      color: 'var(--s-weight)',
      kind: 'line',
      emphasis: true,
      points: visible.filter((p) => p.maWeight != null).map((p) => ({ t: p.time, v: p.maWeight! })),
    },
  ];

  const bodyFatSeries: ChartSeries[] = [
    {
      id: 'bf-raw',
      label: '日平均（実測）',
      color: 'var(--s-fat)',
      kind: 'dots',
      points: visible.filter((p) => p.bodyFat != null).map((p) => ({ t: p.time, v: p.bodyFat! })),
    },
    {
      id: 'bf-ma',
      label: '7日移動平均',
      color: 'var(--s-fat)',
      kind: 'line',
      emphasis: true,
      points: visible.filter((p) => p.maBodyFat != null).map((p) => ({ t: p.time, v: p.maBodyFat! })),
    },
  ];

  return (
    <>
      {/* 体組成とトレーニングは別の物差しなので、同じ画面に混ぜず切り替える */}
      <div className={ui.chipRow} role="group" aria-label="グラフの種類">
        {([
          ['body', '体組成'],
          ['training', 'トレーニング'],
        ] as [Mode, string][]).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={ui.chip}
            aria-pressed={mode === id}
            onClick={() => setMode(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* フィルタはすべてのグラフに効く 1 行としてカードの外に置く */}
      <div className={ui.chipRow} role="group" aria-label="表示期間">
        {RANGES.map((r) => (
          <button
            key={r.id}
            type="button"
            className={ui.chip}
            aria-pressed={range === r.id}
            onClick={() => setRange(r.id)}
          >
            {r.label}
          </button>
        ))}
      </div>

      {mode === 'training' && (
        <TrainingCharts sessions={sessions} exercises={data.exercises} from={from} />
      )}

      {mode === 'body' && (
        <>
      <section className={ui.card}>
        <header className={ui.cardHeader}>
          <h2 className={ui.cardTitle}>体重の推移</h2>
          <span className={ui.hint}>kg</span>
        </header>
        <TimeSeriesChart
          series={weightSeries}
          domain={domain}
          unit="kg"
          ariaLabel="日平均体重と7日移動平均の推移"
          reference={
            data.settings.targetWeight != null
              ? { value: data.settings.targetWeight, label: `目標 ${data.settings.targetWeight.toFixed(1)}kg` }
              : null
          }
        />
        <p className={ui.note}>
          体重は水分や食事で1日のうちに1〜2kg動きます。判断は移動平均の線のほうで。
        </p>
      </section>

      <section className={ui.card}>
        <header className={ui.cardHeader}>
          <h2 className={ui.cardTitle}>体脂肪率の推移</h2>
          <span className={ui.hint}>%</span>
        </header>
        <TimeSeriesChart
          series={bodyFatSeries}
          domain={domain}
          unit="%"
          ariaLabel="日平均体脂肪率と7日移動平均の推移"
          reference={
            data.settings.targetBodyFat != null
              ? { value: data.settings.targetBodyFat, label: `目標 ${data.settings.targetBodyFat.toFixed(1)}%` }
              : null
          }
        />
      </section>

      <section className={ui.card}>
        <header className={ui.cardHeader}>
          <h2 className={ui.cardTitle}>週平均の体組成</h2>
          <span className={ui.hint}>kg</span>
        </header>
        <WeeklyCompositionChart weeks={visibleWeeks} />
        <p className={ui.note}>
          除脂肪体重を保ったまま体脂肪量だけ減っているのが理想の形です。
        </p>
        <WeeklyTable weeks={visibleWeeks} />
      </section>

      <section className={ui.card}>
        <header className={ui.cardHeader}>
          <h2 className={ui.cardTitle}>推定カロリー収支</h2>
          <span className={ui.hint}>kcal/日</span>
        </header>

        {/* 集計期間はこのグラフだけに効くパラメータなので、対象の直上に置く */}
        <div className={ui.chipRow} role="group" aria-label="集計期間">
          {ENERGY_WINDOWS.map((w) => (
            <button
              key={w}
              type="button"
              className={ui.chip}
              aria-pressed={energyWindow === w}
              onClick={() => setEnergyWindow(w)}
            >
              {w}週ごと
            </button>
          ))}
        </div>

        {energy.length === 0 ? (
          <p className={ui.emptyState}>
            {shortBy > 0 ? (
              <>
                {energyWindow}週ごとの比較には{energyWindow + 1}週ぶんの記録が必要です。
                <br />
                あと{shortBy}週ぶん記録すると表示されます。
              </>
            ) : (
              <>この期間に比較できる週がありません。</>
            )}
          </p>
        ) : (
          <>
            <EnergyBalanceChart points={energy} />
            <EnergyTable points={energy} />
          </>
        )}

        <p className={ui.note}>
          「摂取 − 消費」の推定値です（摂取カロリーそのものではありません）。
          数週間の傾向で見る値で、1週ぶんを鵜呑みにしないでください。
          棒と灰色マーカーの差が大きい週ほど、体組成計の読みが荒れています。
        </p>
      </section>

      <section className={ui.card}>
        <header className={ui.cardHeader}>
          <h2 className={ui.cardTitle}>元データ</h2>
        </header>
        <DailyTable daily={visible} />
      </section>
        </>
      )}
    </>
  );
}
