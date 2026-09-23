import { TimeSeriesChart } from './TimeSeriesChart';
import type { ChartSeries } from './TimeSeriesChart';
import { isoToTime, todayISO } from '../../lib/date';
import type { DailyPoint, Settings } from '../../types';
import { CardHeader } from '../CardHeader';
import ui from '../../styles/ui.module.scss';
import { useT } from '../../lib/i18n';

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
 * 体重・腹囲・体脂肪率の推移。
 *
 * **推移画面と記録から開くダイアログで同じものを使う。**
 * 同じグラフを 2 通りに組むと、片方だけ直る事故が起きる
 * （種目の推移が `ExerciseDetailDialog` を両方から開いているのと同じ作法）。
 */
export function BodyTrendCharts({ daily, settings, highlight = null, note = false }: Props) {
  const t = useT();
  const today = todayISO();
  const domain: [number, number] = [
    isoToTime(daily[0]?.date ?? today),
    isoToTime(daily[daily.length - 1]?.date ?? today),
  ];

  const weightSeries: ChartSeries[] = [
    {
      id: 'weight-raw',
      label: t('chart.dailyAverage'),
      color: 'var(--s-weight)',
      kind: 'dots',
      points: daily.filter((p) => p.weight != null).map((p) => ({ t: p.time, v: p.weight! })),
    },
    {
      id: 'weight-ma',
      label: t('chart.movingAverage'),
      color: 'var(--s-weight)',
      kind: 'line',
      emphasis: true,
      points: daily.filter((p) => p.maWeight != null).map((p) => ({ t: p.time, v: p.maWeight! })),
    },
  ];

  const waistSeries: ChartSeries[] = [
    {
      id: 'waist-raw',
      label: t('chart.dailyAverage'),
      color: 'var(--s-waist)',
      kind: 'dots',
      points: daily.filter((p) => p.waist != null).map((p) => ({ t: p.time, v: p.waist! })),
    },
    {
      id: 'waist-ma',
      label: t('chart.movingAverage'),
      color: 'var(--s-waist)',
      kind: 'line',
      emphasis: true,
      points: daily.filter((p) => p.maWaist != null).map((p) => ({ t: p.time, v: p.maWaist! })),
    },
  ];

  const bodyFatSeries: ChartSeries[] = [
    {
      id: 'bf-raw',
      label: t('chart.dailyAverage'),
      color: 'var(--s-fat)',
      kind: 'dots',
      points: daily.filter((p) => p.bodyFat != null).map((p) => ({ t: p.time, v: p.bodyFat! })),
    },
    {
      id: 'bf-ma',
      label: t('chart.movingAverage'),
      color: 'var(--s-fat)',
      kind: 'line',
      emphasis: true,
      points: daily.filter((p) => p.maBodyFat != null).map((p) => ({ t: p.time, v: p.maBodyFat! })),
    },
  ];

  return (
    <>
      <section className={ui.card}>
        <CardHeader title={t('chart.weightTitle')} hint={<>kg</>} />
        <TimeSeriesChart
          series={weightSeries}
          domain={domain}
          unit="kg"
          highlight={highlight}
          ariaLabel={t('common.dailyAvgTrendOf', { name: t('common.weight') })}
          emptyMessage={t('common.noRecords')}
          reference={
            settings.targetWeight != null
              ? {
                  value: settings.targetWeight,
                  label: t('goal.target', { n: settings.targetWeight.toFixed(1) }),
                }
              : null
          }
        />

        {note && <p className={ui.note}>{t('chart.weightNote')}</p>}
      </section>

      {/*
        腹囲は独立したカード。**軸は重ねない**——単位が違う（kg と cm）ので
        1 本の y 軸に乗せるとレンジの広いほうに潰される。第 2 軸も立てない。
        2 つの軸の原点と縮尺をこちらで決めることになり、線が交わる位置に
        意味があるように見えてしまう（実際には何も意味しない）。

        カードが分かれても、同じ `domain` を渡すので x 軸は揃う。目盛りは軸の範囲を
        等分して出す（`timeTicks`）ので、腹囲を週に 1 度しか測っていなくても、
        体重・体脂肪率のカードと同じ日付が同じ横位置に並ぶ。
      */}
      {settings.waistEnabled && (
        <section className={ui.card}>
          <CardHeader title={t('chart.waistTitle')} hint={<>cm</>} />
          <TimeSeriesChart
            series={waistSeries}
            domain={domain}
            unit="cm"
            highlight={highlight}
            ariaLabel={t('common.dailyAvgTrendOf', { name: t('hero.waist') })}
            emptyMessage={t('chart.waistEmpty')}
          />
        </section>
      )}

      <section className={ui.card}>
        <CardHeader title={t('chart.bodyFatTitle')} hint={<>%</>} />
        <TimeSeriesChart
          series={bodyFatSeries}
          domain={domain}
          unit="%"
          highlight={highlight}
          ariaLabel={t('common.dailyAvgTrendOf', { name: t('common.bodyFat') })}
          emptyMessage={t('common.noRecords')}
          reference={
            settings.targetBodyFat != null
              ? {
                  value: settings.targetBodyFat,
                  label: t('chart.targetBodyFat', { n: settings.targetBodyFat.toFixed(1) }),
                }
              : null
          }
        />
      </section>
    </>
  );
}
