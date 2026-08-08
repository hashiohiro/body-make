import { useMemo, useState } from 'react';
import { TimeSeriesChart } from '../components/charts/TimeSeriesChart';
import type { ChartSeries } from '../components/charts/TimeSeriesChart';
import { EnergyBalanceChart } from '../components/charts/EnergyBalanceChart';
import { WeeklyCompositionChart } from '../components/charts/WeeklyCompositionChart';
import { DailyTable, EnergyTable, WeeklyTable } from '../components/DataTables';
import { addDays, isoToTime, todayISO } from '../lib/date';
import { computeEnergyBalance, ENERGY_WINDOWS, KCAL_PER_KG, weeksShort } from '../lib/energy';
import type { EnergyWindow } from '../lib/energy';
import type { BodyData } from '../hooks/useBodyData';
import ui from '../styles/ui.module.scss';

type RangeId = '30' | '90' | 'all';

const RANGES: { id: RangeId; label: string; days: number | null }[] = [
  { id: '30', label: '30日', days: 30 },
  { id: '90', label: '90日', days: 90 },
  { id: 'all', label: '全期間', days: null },
];

export function ChartsView({ body }: { body: BodyData }) {
  const { daily, weeks, data } = body;
  const [range, setRange] = useState<RangeId>('all');
  const [energyWindow, setEnergyWindow] = useState<EnergyWindow>(1);

  const today = todayISO();
  const firstDate = daily[0]?.date ?? today;

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
          点は朝夕の平均（その日の実測）、線は7日移動平均。水分や食事で1〜2kg動くため、判断は線のほうで行います。
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
        <p className={ui.note}>
          体重とは単位が違うので別のグラフにしています（2軸で重ねると目盛りの合わせ方しだいで相関があるように見えてしまうため）。
        </p>
      </section>

      <section className={ui.card}>
        <header className={ui.cardHeader}>
          <h2 className={ui.cardTitle}>週平均の体組成</h2>
          <span className={ui.hint}>kg</span>
        </header>
        <WeeklyCompositionChart weeks={visibleWeeks} />
        <p className={ui.note}>
          体脂肪量 = 週平均体重 × 週平均体脂肪率 ÷ 100（近似）。除脂肪体重が保たれたまま体脂肪量だけ減っているのが理想の形です。
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
          体組織1kgあたり {KCAL_PER_KG.toLocaleString()} kcal として、週平均どうしの差を1日あたりの収支に換算しています。
          摂取カロリーそのものではなく「摂取 − 消費」の推定値です。
          <br />
          <br />
          棒は<b>体重ベース</b>。体組成計の体脂肪率は水分や食事で大きく振れるため、値の信頼度は体重ベースのほうが高くなります。
          灰色のマーカーが<b>体脂肪量ベース</b>の推定で、棒との差が大きい週ほど体組成計の読みが荒れていると考えてください。
          どちらも数週間ぶんの傾向で見る値で、1週ぶんの値を鵜呑みにしないのが安全です。
        </p>
      </section>

      <section className={ui.card}>
        <header className={ui.cardHeader}>
          <h2 className={ui.cardTitle}>元データ</h2>
        </header>
        <DailyTable daily={visible} />
      </section>
    </>
  );
}
