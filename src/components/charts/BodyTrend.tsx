import { useMemo, useState } from 'react';
import { BodyTrendCharts } from './BodyTrendCharts';
import { EnergyBalanceChart } from './EnergyBalanceChart';
import { WeeklyCompositionChart } from './WeeklyCompositionChart';
import { ChipGroup } from '../ChipGroup';
import { DailyTable, EnergyTable, WeeklyTable } from '../DataTables';
import { computeEnergyBalance, ENERGY_WINDOWS, weeksShort } from '../../lib/energy';
import type { EnergyWindow } from '../../lib/energy';
import type { DailyPoint, Settings, WeekPoint } from '../../types';
import { CardHeader } from '../CardHeader';
import ui from '../../styles/ui.module.scss';

interface Props {
  /** 期間で絞ったあとの日次。絞るのは呼び出し側の仕事 */
  daily: readonly DailyPoint[];
  /** 同じ期間の週次 */
  weeks: readonly WeekPoint[];
  settings: Settings;
  /** 「いま」の点。推移画面では今日、記録から開いたときはその日 */
  highlight?: number | null;
  /** 単日を見ないことの説明を添えるか。推移画面では出し、ダイアログでは畳む */
  note?: boolean;
}

/**
 * 体組成の推移ひとそろい。**推移画面と、記録から開くダイアログで同じものを使う。**
 *
 * 以前はグラフ（`BodyTrendCharts`）だけを共有して、週平均・カロリー収支・元データは
 * 推移画面の中に直に書いていた。結果、同じ「体組成の推移」という名前の面が
 * 2 種類あって、記録から開いたほうには 4 枚のうち 1 枚しか無かった。
 * **どこから開いても同じものが出る**ように、ひとそろいでここに置く。
 *
 * 期間の絞り込み（表示期間）は持たない。あれは推移画面だけの道具で、
 * 記録から開いたときは過去ぜんぶを見せる（`BodyTrendDialog`）。
 * 集計期間はこのカードだけに効くパラメータなので、ここが持つ。
 */
export function BodyTrend({ daily, weeks, settings, highlight = null, note = false }: Props) {
  const [energyWindow, setEnergyWindow] = useState<EnergyWindow>(1);

  const energy = useMemo(() => computeEnergyBalance(weeks, energyWindow), [weeks, energyWindow]);
  const shortBy = weeksShort(weeks, energyWindow);

  return (
    <>
      <BodyTrendCharts daily={daily} settings={settings} highlight={highlight} note={note} />

      <section className={ui.card}>
        <CardHeader title="週平均の体組成" hint={<>kg</>} />
        <WeeklyCompositionChart weeks={weeks} />
        <p className={ui.note}>除脂肪体重を保ったまま体脂肪量だけ減っているのが理想の形です。</p>
        <WeeklyTable weeks={weeks} />
      </section>

      <section className={ui.card}>
        <CardHeader title="推定カロリー収支" hint={<>kcal/日</>} />

        {/* 集計期間はこのグラフだけに効くパラメータなので、対象の直上に置く */}
        <ChipGroup
          options={ENERGY_WINDOWS.map((w) => ({ id: w, label: `${w}週ごと` }))}
          value={energyWindow}
          onChange={setEnergyWindow}
          label="集計期間"
        />

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
        <CardHeader title="元データ" />
        <DailyTable daily={daily} waist={settings.waistEnabled} />
      </section>
    </>
  );
}
