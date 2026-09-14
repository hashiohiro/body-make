import { useMemo, useState } from 'react';
import { BodyTrend } from '../components/charts/BodyTrend';
import { ChipGroup } from '../components/ChipGroup';
import { TrainingCharts } from '../components/training/TrainingCharts';
import { addDays, isoToTime, todayISO } from '../lib/date';
import type { BodyData } from '../hooks/useBodyData';
import type { Domain } from '../types';

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
        <BodyTrend
          daily={visible}
          weeks={visibleWeeks}
          settings={data.settings}
          highlight={todayTime}
          note
        />
      )}
    </>
  );
}
