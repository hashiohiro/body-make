import { Fragment, useMemo, useState } from 'react';
import { Sparkline } from '../charts/Sparkline';
import { TimeSeriesChart } from '../charts/TimeSeriesChart';
import type { ChartSeries, SeriesPoint } from '../charts/TimeSeriesChart';
import { GroupSetsHeatmap } from './GroupSetsHeatmap';
import { GROUP_LABELS, GROUP_ORDER } from '../../lib/exerciseCatalog';
import { formatMD, isoToTime, todayISO } from '../../lib/date';
import { deltaTone, fmt, fmtDelta } from '../../lib/format';
import { BASELINE_SESSIONS, buildWeeklySets, exerciseHistory, plateau } from '../../lib/training';
import type { ExerciseHistoryPoint } from '../../lib/training';
import type { Exercise, ExercisePoint, MuscleGroup, SessionPoint } from '../../types';
import ui from '../../styles/ui.module.scss';
import s from './training.module.scss';

const TONE_CLASS = { good: ui.good, bad: ui.bad, flat: ui.flat } as const;

interface Metric {
  id: string;
  label: string;
  unit: string;
  digits: number;
  /** 挙上量に計上しない種目では出さない */
  needsWeight?: boolean;
  /** 目標の参照線と進捗を出す指標。実際に扱えた最大重量だけが目標と直接比較できる */
  weightLike?: boolean;
  pick: (point: ExercisePoint) => number | null;
}

const METRICS: Metric[] = [
  { id: 'volume', label: '挙上量', unit: 'kg', digits: 0, needsWeight: true, pick: (p) => (p.volume > 0 ? p.volume : null) },
  { id: 'sets', label: 'セット数', unit: 'セット', digits: 0, pick: (p) => p.workSets },
  // レップ数に左右されない「その日いちばん重かった重量」。推定1RM と並べると、
  // 重量が上がったのか同じ重量で回数が伸びたのかを切り分けられる
  // 最大重量と目標は「バーに載せた数字」で見る。挙上量と推定1RM は換算後の負荷
  { id: 'maxWeight', label: '最大重量', unit: 'kg', digits: 1, weightLike: true, needsWeight: true, pick: (p) => p.top?.weight ?? null },
  { id: 'maxReps', label: '最大回数', unit: '', digits: 0, pick: (p) => p.maxReps },
  { id: 'oneRm', label: '推定1RM', unit: 'kg', digits: 1, needsWeight: true, pick: (p) => p.oneRm },
];

/** 開始値は最初の 3 セッションの平均。初回 1 点だと当日の調子が以後すべての差分に乗る */
function baselineOf(history: readonly ExerciseHistoryPoint[], metric: Metric): number | null {
  const values = history.map((h) => metric.pick(h.point)).filter((v): v is number => v != null);
  if (values.length < BASELINE_SESSIONS) return null;
  const head = values.slice(0, BASELINE_SESSIONS);
  return head.reduce((a, b) => a + b, 0) / head.length;
}

function lastOf(history: readonly ExerciseHistoryPoint[], metric: Metric): number | null {
  for (let i = history.length - 1; i >= 0; i--) {
    const v = metric.pick(history[i]!.point);
    if (v != null) return v;
  }
  return null;
}

interface Props {
  sessions: readonly SessionPoint[];
  exercises: readonly Exercise[];
  /** 表示期間の開始日 */
  from: string;
}

export function TrainingCharts({ sessions, exercises, from }: Props) {
  // 記録のある種目だけを選択肢にする
  const recorded = useMemo(() => {
    const counts = new Map<string, number>();
    for (const session of sessions) {
      for (const point of session.exercises) {
        counts.set(point.exerciseId, (counts.get(point.exerciseId) ?? 0) + 1);
      }
    }
    return exercises
      .filter((e) => counts.has(e.id))
      .sort((a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0));
  }, [sessions, exercises]);

  const [exerciseId, setExerciseId] = useState<string | null>(null);
  const [metricId, setMetricId] = useState<string | null>(null);
  const [group, setGroup] = useState<MuscleGroup | 'all'>('all');

  // 部位は主部位だけで絞る。ここで見たいのは種目の推移で、配分ではない
  // （補助部位まで拾うと、腕にベンチプレスが並ぶ）
  const groups = GROUP_ORDER.filter((g) => recorded.some((e) => e.group === g));
  const shown = group === 'all' ? recorded : recorded.filter((e) => e.group === group);

  // 絞り込みで選択中の種目が消えたら、残っている先頭へ移す
  const exercise = shown.find((e) => e.id === exerciseId) ?? shown[0] ?? null;

  // 指標は一覧ぜんぶに効くので、選んだ 1 種目ではなく出ている種目全体で出せるかを見る。
  // 秒で数える種目しか無いときだけ、重量系の指標が消える
  const metrics = METRICS.filter(
    (m) => !m.needsWeight || shown.some((e) => e.repUnit !== 'seconds'),
  );
  const fallbackId = metrics.some((m) => m.id === 'volume') ? 'volume' : 'maxReps';
  const metric =
    metrics.find((m) => m.id === metricId) ??
    metrics.find((m) => m.id === fallbackId) ??
    metrics[0]!;

  // 開始比は期間フィルタの影響を受けない（「開始から」なので全履歴で見る）
  const allHistory = useMemo(
    () => (exercise ? exerciseHistory(sessions, exercise.id) : []),
    [sessions, exercise],
  );
  const history = useMemo(() => allHistory.filter((h) => h.date >= from), [allHistory, from]);
  const weeklySets = useMemo(() => buildWeeklySets(sessions, from), [sessions, from]);

  /*
   * 一覧は「切り替えないと見えない」を無くすためのもの。
   * ドロップダウンだと 1 種目見るのに 開く→探す→選ぶ→閉じる の 4 手かかり、
   * どれが伸びているかを知るだけでも種目数ぶん繰り返すことになる。
   *
   * 現在値と開始比は下の詳細と同じ出し方（全履歴）で計算する。
   * 折れ線だけ期間で切る（形を見るためのものなので）。
   */
  const rows = useMemo(
    () =>
      shown.map((ex) => {
        const all = exerciseHistory(sessions, ex.id);
        const points = all
          .filter((h) => h.date >= from)
          .map((h) => ({ t: h.time, v: metric.pick(h.point) }))
          .filter((p): p is { t: number; v: number } => p.v != null);
        const base = baselineOf(all, metric);
        const value = lastOf(all, metric);
        return {
          ex,
          points,
          value,
          delta: base != null && value != null ? value - base : null,
        };
      }),
    [shown, sessions, from, metric],
  );

  if (recorded.length === 0) {
    return (
      <section className={ui.card}>
        <p className={ui.emptyState}>まだトレーニングの記録がありません。</p>
      </section>
    );
  }

  const points: SeriesPoint[] = [];
  for (const h of history) {
    const v = metric.pick(h.point);
    if (v == null) continue;
    const top = h.point.top;
    // 換算元のセットを添える。同じ種目でもレップ帯が変わると外挿量が変わる
    points.push(
      top?.weight != null ? { t: h.time, v, note: `${top.weight}×${top.reps}` } : { t: h.time, v },
    );
  }

  const series: ChartSeries[] = [
    {
      id: 'dots',
      label: metric.label,
      color: 'var(--s-lean)',
      kind: 'dots',
      points,
    },
    {
      id: 'line',
      label: metric.label,
      color: 'var(--s-lean)',
      kind: 'line',
      emphasis: true,
      points,
    },
  ];

  const baseline = baselineOf(allHistory, metric);
  const current = lastOf(allHistory, metric);
  const delta = baseline != null && current != null ? current - baseline : null;
  const stall = metric.weightLike ? plateau(allHistory) : null;

  const weightTarget = exercise?.goal?.type === 'weight' ? exercise.goal.value : null;
  const target = metric.weightLike ? weightTarget : null;
  const progress =
    target != null && current != null && baseline != null && target !== baseline
      ? Math.min(1, Math.max(0, (current - baseline) / (target - baseline)))
      : null;

  const today = todayISO();
  const domain: [number, number] = [
    isoToTime(history[0]?.date ?? from),
    isoToTime(history[history.length - 1]?.date ?? today),
  ];

  return (
    <>
      <section className={ui.card}>
        <header className={ui.cardHeader}>
          <h2 className={ui.cardTitle}>種目別の推移</h2>
        </header>

        <div className={s.filters}>
          <div className={s.pickerLabel} id="trend-metric">
            指標
          </div>
          <div
            className={`${ui.chipRow} ${s.filterRow}`}
            role="group"
            aria-labelledby="trend-metric"
          >
            {metrics.map((m) => (
              <button
                key={m.id}
                type="button"
                className={ui.chip}
                aria-pressed={metric.id === m.id}
                onClick={() => setMetricId(m.id)}
              >
                {m.label}
              </button>
            ))}
          </div>

          {groups.length > 1 && (
            <>
              <div className={s.pickerLabel} id="trend-group">
                部位
              </div>
              <div
                className={`${ui.chipRow} ${s.filterRow}`}
                role="group"
                aria-labelledby="trend-group"
              >
                <button
                  type="button"
                  className={ui.chip}
                  aria-pressed={group === 'all'}
                  onClick={() => setGroup('all')}
                >
                  すべて
                </button>
                {groups.map((g) => (
                  <button
                    key={g}
                    type="button"
                    className={ui.chip}
                    aria-pressed={group === g}
                    onClick={() => setGroup(g)}
                  >
                    {GROUP_LABELS[g]}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <div className={s.trendList}>
          {/* 見出しは主部位で切る。並びも部位順にして、どこを見ているかを見失わないようにする */}
          {GROUP_ORDER.filter((g) => rows.some((r) => r.ex.group === g)).map((g) => (
            <div key={g} className={s.trendGroup}>
              <div className={s.pickerLabel}>{GROUP_LABELS[g]}</div>
              {rows
                .filter((r) => r.ex.group === g)
                .map((row) => {
                  const open = row.ex.id === exercise?.id;
                  return (
                    <Fragment key={row.ex.id}>
                      <button
                        type="button"
                        className={s.trendRow}
                        aria-pressed={open}
                        onClick={() => setExerciseId(row.ex.id)}
                      >
                        <span className={s.trendName}>{row.ex.name}</span>
                        <span className={s.trendStat}>
                          <b>{fmt(row.value, metric.digits)}</b>
                          {metric.unit && <em>{metric.unit}</em>}
                          {row.delta != null && (
                            <i className={TONE_CLASS[deltaTone(row.delta, false, 0)]}>
                              {fmtDelta(row.delta, metric.digits)}
                            </i>
                          )}
                        </span>
                        {/* 幅を全部渡す。列に押し込むと線が潰れて、形を見比べるという用途に届かない */}
                        <span className={s.trendSpark}>
                          <Sparkline
                            points={row.points}
                            height={22}
                            dot={false}
                            color="var(--s-lean)"
                            ariaLabel={`${row.ex.name}の${metric.label}の推移`}
                          />
                        </span>
                      </button>

                      {/* 選んだ行の直下に開く。離すと、どの行のグラフかを目で往復して確かめることになる */}
                      {open && (
                        <div className={s.trendOpen}>
                          <div className={s.statRow}>
                            <b>{fmt(current, metric.digits)}</b>
                            <span>{metric.unit}</span>
                            {delta != null && (
                              <span className={TONE_CLASS[deltaTone(delta, false, 0)]}>
                                開始比 {fmtDelta(delta, metric.digits)}
                              </span>
                            )}
                            {stall && (
                              <span style={{ marginLeft: 'auto' }}>
                                {fmt(stall.weight)}kg のまま {stall.weeks}週
                              </span>
                            )}
                          </div>

                          {progress != null && (
                            <>
                              <div className={s.meter}>
                                <div
                                  className={s.meterFill}
                                  style={{
                                    width: `${Math.round(progress * 100)}%`,
                                  }}
                                />
                              </div>
                              <div className={s.statRow} style={{ marginTop: 0, fontSize: 11 }}>
                                <span>目標 {weightTarget} kg まで</span>
                                <span style={{ marginLeft: 'auto' }}>
                                  {Math.round(progress * 100)}%
                                </span>
                              </div>
                            </>
                          )}

                          <TimeSeriesChart
                            series={series}
                            domain={domain}
                            unit={metric.unit}
                            digits={metric.digits}
                            legend={false}
                            ariaLabel={`${exercise?.name ?? ''}の${metric.label}の推移`}
                            emptyMessage={
                              metric.needsWeight && exercise?.repUnit === 'seconds'
                                ? '秒で数える種目なので、この指標は出せません'
                                : 'この期間に記録がありません'
                            }
                            reference={
                              metric.weightLike && weightTarget != null
                                ? {
                                    value: weightTarget,
                                    label: `目標 ${weightTarget}kg`,
                                  }
                                : null
                            }
                          />

                          {metric.id === 'oneRm' && (
                            <p className={ui.note}>推定1RMは記録からの換算値です。</p>
                          )}
                        </div>
                      )}
                    </Fragment>
                  );
                })}
            </div>
          ))}
        </div>
      </section>

      <section className={ui.card}>
        <header className={ui.cardHeader}>
          <h2 className={ui.cardTitle}>元データ</h2>
          <span className={ui.hint}>{exercise?.name}</span>
        </header>

        <div className={ui.tableScroll}>
          <table className={ui.table}>
            <thead>
              <tr>
                <th scope="col">日付</th>
                <th scope="col">トップセット</th>
                <th scope="col">セット</th>
                <th scope="col">挙上量</th>
                <th scope="col">推定1RM</th>
              </tr>
            </thead>
            <tbody>
              {[...history].reverse().map((h) => (
                <tr key={h.date}>
                  <th scope="row">{formatMD(h.date)}</th>
                  <td>
                    {h.point.top?.weight != null
                      ? `${h.point.top.weight} × ${h.point.top.reps ?? '—'}`
                      : '—'}
                  </td>
                  <td>{h.point.workSets}</td>
                  <td>
                    {h.point.volume > 0 ? (
                      `${Math.round(h.point.volume).toLocaleString()} kg`
                    ) : (
                      <span className={ui.cellEmpty}>—</span>
                    )}
                  </td>
                  <td>
                    {h.point.oneRm == null ? (
                      <span className={ui.cellEmpty}>—</span>
                    ) : (
                      `${fmt(h.point.oneRm)}${h.point.measured ? ' *' : ''}`
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <GroupSetsHeatmap weeks={weeklySets} />
    </>
  );
}
