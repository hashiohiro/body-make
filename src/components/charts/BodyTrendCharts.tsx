import { TimeSeriesChart } from './TimeSeriesChart';
import type { ChartSeries } from './TimeSeriesChart';
import { isoToTime, todayISO } from '../../lib/date';
import type { DailyPoint, Settings } from '../../types';
import { CardHeader } from '../CardHeader';
import ui from '../../styles/ui.module.scss';
import s from './charts.module.scss';

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
 * 体重と体脂肪率の推移。**腹囲は体重の下に添える。**
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

  const waistSeries: ChartSeries[] = [
    {
      id: 'waist-raw',
      label: '日平均（実測）',
      color: 'var(--s-waist)',
      kind: 'dots',
      points: daily.filter((p) => p.waist != null).map((p) => ({ t: p.time, v: p.waist! })),
    },
    {
      id: 'waist-ma',
      label: '7日移動平均',
      color: 'var(--s-waist)',
      kind: 'line',
      emphasis: true,
      points: daily.filter((p) => p.maWaist != null).map((p) => ({ t: p.time, v: p.maWaist! })),
    },
  ];

  /*
   * 腹囲の目盛りを出すか。**まだ 1 件も無いときは出さない。**
   *
   * 下のグラフが空のまま日付ラベルだけを引き継ぐと、体重のグラフからも
   * 下のグラフからも目盛りが消える。欄は出す（設定がオンであることの手がかり）が、
   * x 軸の受け持ちは戻す。
   */
  const waistPlotted =
    settings.waistEnabled && waistSeries.some((serie) => serie.points.length > 0);

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
        <CardHeader title="体重の推移" hint={<>kg</>} />
        <TimeSeriesChart
          series={weightSeries}
          domain={domain}
          unit="kg"
          highlight={highlight}
          ariaLabel="日平均体重と7日移動平均の推移"
          /* 腹囲を下に敷くときは、同じ日付目盛りを 2 回並べない */
          xLabels={!waistPlotted}
          reference={
            settings.targetWeight != null
              ? {
                  value: settings.targetWeight,
                  label: `目標 ${settings.targetWeight.toFixed(1)}kg`,
                }
              : null
          }
        />

        {/*
          腹囲は**体重に添える補足**なので、対等なカードにはせず同じカードの中へ置く。
          軸は分ける——単位が違う（kg と cm）ので 1 本の y 軸に重ねると、
          レンジの広いほうに潰されて片方が横線になる。第 2 軸を立てるのも採らない。
          2 つの軸の原点と縮尺をこちらで決めることになり、線が交わる位置に
          意味があるように見えてしまう（実際には何も意味しない）。

          縦に積めば y 軸はそれぞれ独立のまま、x 軸だけが揃う。`MARGIN` は固定で
          `domain` も同じものを渡すので、**同じ日が必ず同じ横位置に来る**。
        */}
        {settings.waistEnabled && (
          <>
            <p className={s.subTitle}>
              腹囲 <small>cm</small>
            </p>
            <TimeSeriesChart
              series={waistSeries}
              domain={domain}
              unit="cm"
              height={150}
              highlight={highlight}
              ariaLabel="日平均腹囲と7日移動平均の推移"
              legend={false}
              emptyMessage="まだ腹囲の記録がありません"
            />
          </>
        )}

        {note && (
          <p className={ui.note}>
            体重は水分や食事で1日のうちに1〜2kg動きます。判断は移動平均の線のほうで。
          </p>
        )}
      </section>

      <section className={ui.card}>
        <CardHeader title="体脂肪率の推移" hint={<>%</>} />
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
