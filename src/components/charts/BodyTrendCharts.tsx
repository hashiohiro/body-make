import { TimeSeriesChart } from './TimeSeriesChart';
import type { ChartSeries } from './TimeSeriesChart';
import { isoToTime, todayISO } from '../../lib/date';
import type { DailyPoint, Settings } from '../../types';
import ui from '../../styles/ui.module.scss';

interface Props {
  /** 期間で絞ったあとの日次。絞るのは呼び出し側の仕事 */
  daily: readonly DailyPoint[];
  settings: Settings;
  /** 「いま」の点。日次なので今日か、記録から開いたときはその日 */
  highlight?: number | null;
  /** 単日を見ないことの説明を添えるか。推移画面では出し、ダイアログでは畳む */
  note?: boolean;
}

/**
 * 体重と体脂肪率の推移。
 *
 * **推移画面と記録から開くダイアログで同じものを使う。**
 * 同じグラフを 2 通りに組むと、片方だけ直る事故が起きる
 * （種目の推移が `ExerciseDetailDialog` を両方から開いているのと同じ作法）。
 */
export function BodyTrendCharts({ daily, settings, highlight = null, note = false }: Props) {
  const today = todayISO();
  const domain: [number, number] = [
    isoToTime(daily[0]?.date ?? today),
    isoToTime(daily[daily.length - 1]?.date ?? today),
  ];

  const weightSeries: ChartSeries[] = [
    {
      id: 'weight-raw',
      label: '日平均（実測）',
      color: 'var(--s-weight)',
      kind: 'dots',
      points: daily.filter((p) => p.weight != null).map((p) => ({ t: p.time, v: p.weight! })),
    },
    {
      id: 'weight-ma',
      label: '7日移動平均',
      color: 'var(--s-weight)',
      kind: 'line',
      emphasis: true,
      points: daily.filter((p) => p.maWeight != null).map((p) => ({ t: p.time, v: p.maWeight! })),
    },
  ];

  const bodyFatSeries: ChartSeries[] = [
    {
      id: 'bf-raw',
      label: '日平均（実測）',
      color: 'var(--s-fat)',
      kind: 'dots',
      points: daily.filter((p) => p.bodyFat != null).map((p) => ({ t: p.time, v: p.bodyFat! })),
    },
    {
      id: 'bf-ma',
      label: '7日移動平均',
      color: 'var(--s-fat)',
      kind: 'line',
      emphasis: true,
      points: daily.filter((p) => p.maBodyFat != null).map((p) => ({ t: p.time, v: p.maBodyFat! })),
    },
  ];

  return (
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
          highlight={highlight}
          ariaLabel="日平均体重と7日移動平均の推移"
          reference={
            settings.targetWeight != null
              ? {
                  value: settings.targetWeight,
                  label: `目標 ${settings.targetWeight.toFixed(1)}kg`,
                }
              : null
          }
        />
        {note && (
          <p className={ui.note}>
            体重は水分や食事で1日のうちに1〜2kg動きます。判断は移動平均の線のほうで。
          </p>
        )}
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
          highlight={highlight}
          ariaLabel="日平均体脂肪率と7日移動平均の推移"
          reference={
            settings.targetBodyFat != null
              ? {
                  value: settings.targetBodyFat,
                  label: `目標 ${settings.targetBodyFat.toFixed(1)}%`,
                }
              : null
          }
        />
      </section>
    </>
  );
}
