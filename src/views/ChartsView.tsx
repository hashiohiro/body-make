import { useMemo, useState } from 'react';
import { BodyTrendCharts } from '../components/charts/BodyTrendCharts';
import { ChipGroup } from '../components/ChipGroup';
import { EnergyBalanceChart } from '../components/charts/EnergyBalanceChart';
import { WeeklyCompositionChart } from '../components/charts/WeeklyCompositionChart';
import { DailyTable, EnergyTable, WeeklyTable } from '../components/DataTables';
import { TrainingCharts } from '../components/training/TrainingCharts';
import { addDays, isoToTime, todayISO } from '../lib/date';
import { computeEnergyBalance, ENERGY_WINDOWS, weeksShort } from '../lib/energy';
import type { EnergyWindow } from '../lib/energy';
import type { BodyData } from '../hooks/useBodyData';
import type { Domain } from '../types';
import { CardHeader } from '../components/CardHeader';
import ui from '../styles/ui.module.scss';

type RangeId = '30' | '90' | 'all';

const RANGES: { id: RangeId; label: string; days: number | null }[] = [
  { id: '30', label: '30日', days: 30 },
  { id: '90', label: '90日', days: 90 },
  { id: 'all', label: '全期間', days: null },
];

interface Props {
  body: BodyData;
  /** 体組成／トレーニングの切り替えはヘッダが持つ */
  domain: Domain;
  /** 目標画面の行から来たときに、その種目の詳細を開いた状態で出す */
  exerciseId?: string | null;
}

/**
 * 推移。タブではなく、ホームで見ている数字の下位画面として置く（）。
 * 中身は体組成／トレーニングの切り替えに従う。
 */
export function ChartsView({ body, domain: mode, exerciseId }: Props) {
  const { daily, weeks, sessions, data } = body;
  const [range, setRange] = useState<RangeId>('all');
  const [energyWindow, setEnergyWindow] = useState<EnergyWindow>(1);

  const today = todayISO();
  // 折れ線の上で「いま」がどこかを出す。x は日付から作る（lib/date の isoToTime）
  const todayTime = isoToTime(today);
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

  return (
    <>
      {/* フィルタはすべてのグラフに効く 1 行としてカードの外に置く */}
      <ChipGroup options={RANGES} value={range} onChange={setRange} label="表示期間" />

      {mode === 'training' && (
        <TrainingCharts
          sessions={sessions}
          exercises={data.exercises}
          from={from}
          initialOpenId={exerciseId ?? null}
        />
      )}

      {mode === 'body' && (
        <>
          <BodyTrendCharts daily={visible} settings={data.settings} highlight={todayTime} note />

          <section className={ui.card}>
            <CardHeader title="週平均の体組成" hint={<>kg</>} />
            <WeeklyCompositionChart weeks={visibleWeeks} />
            <p className={ui.note}>
              除脂肪体重を保ったまま体脂肪量だけ減っているのが理想の形です。
            </p>
            <WeeklyTable weeks={visibleWeeks} />
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
            <DailyTable daily={visible} />
          </section>
        </>
      )}
    </>
  );
}
