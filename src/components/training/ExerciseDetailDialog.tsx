import { useMemo, useState } from 'react';
import { Modal } from '../Modal';
import { TimeSeriesChart } from '../charts/TimeSeriesChart';
import type { ChartSeries, SeriesPoint } from '../charts/TimeSeriesChart';
import { GROUP_LABELS, countsReps, isCardio } from '../../lib/exerciseCatalog';
import { addDays, formatMD, isoToTime, startOfWeek, todayISO } from '../../lib/date';
import { deltaTone, fmt, fmtDelta } from '../../lib/format';
import {
  buildWeeklySets,
  exerciseHistory,
  formatSets,
  personalBest,
  plateau,
} from '../../lib/training';
import { METRICS, baselineOf, lastOf } from './metrics';
import type { Exercise, MuscleGroup, SessionPoint } from '../../types';
import ui from '../../styles/ui.module.scss';
import s from './training.module.scss';

const TONE_CLASS = { good: ui.good, bad: ui.bad, flat: ui.flat } as const;

interface Props {
  open: boolean;
  onClose: () => void;
  exercise: Exercise | null;
  sessions: readonly SessionPoint[];
  /** グラフの表示期間の開始日 */
  from: string;
  /** 週の内訳をどの週で見るか。記録画面から開いたときは編集中の日 */
  date?: string;
}

/**
 * 1 種目の詳細。グラフ・週の内訳・元データ。
 *
 * グラフ画面と記録画面の両方から同じものを開く。
 * 記録しながら「過去最高までどれくらいか」を見るのと、
 * 一覧から掘り下げるのは、見たいものが同じなので画面を分ける理由がない。
 */
export function ExerciseDetailDialog({ open, onClose, exercise, sessions, from, date }: Props) {
  const [metricId, setMetricId] = useState<string | null>(null);

  // 開始比は期間フィルタの影響を受けない（「開始から」なので全履歴で見る）
  const allHistory = useMemo(
    () => (exercise ? exerciseHistory(sessions, exercise.id) : []),
    [sessions, exercise],
  );
  const history = useMemo(() => allHistory.filter((h) => h.date >= from), [allHistory, from]);

  /*
   * 週の内訳をどの週で見るか。
   * 記録画面から開いたときは編集中の日。グラフ画面から開いたときは
   * 「その種目を最後にやった週」にする。今週やっていない種目を開くと
   * 空欄しか出ず、置いてある意味が無くなるため。
   */
  const refDate = date ?? allHistory[allHistory.length - 1]?.date ?? todayISO();
  const weekStart = startOfWeek(refDate);

  /*
   * その週にこの種目が積んだセット数と、それが各部位へ入った量。
   * 週の部位別セット数は種目をまたいだ合計なので、そこに自分がどれだけ効いたかは
   * 合計だけを見ても分からない。
   */
  /**
   * 有酸素のその週の合計。回数・距離・時間と、そこから出した速度。
   * 部位別セット数の代わりに置く「現状の可視化」。
   */
  const cardioWeek = useMemo(() => {
    if (!exercise || !isCardio(exercise.group)) return null;
    const weekEnd = addDays(weekStart, 6);
    let days = 0;
    let distance = 0;
    let hasDistance = false;
    let minutes = 0;
    for (const session of sessions) {
      if (session.date < weekStart || session.date > weekEnd) continue;
      const point = session.exercises.find((p) => p.exerciseId === exercise.id);
      if (!point) continue;
      days++;
      minutes += point.minutes ?? 0;
      if (point.meters != null) {
        distance += point.meters;
        hasDistance = true;
      }
    }
    if (days === 0) return null;
    const meters = hasDistance ? Math.round(distance) : null;
    const mins = Math.round(minutes);
    return {
      weekStart,
      weekEnd,
      days,
      distance: meters,
      minutes: mins,
      // 距離も速度も入力欄と同じ単位（m と m/分）
      speed:
        meters != null && meters > 0 && mins > 0 ? Math.round((meters / mins) * 10) / 10 : null,
    };
  }, [exercise, sessions, weekStart]);

  const contribution = useMemo(() => {
    // 有酸素は部位を持たないので、部位への貢献という話にならない
    if (!exercise || isCardio(exercise.group)) return null;
    const weekEnd = addDays(weekStart, 6);
    let sets = 0;
    for (const session of sessions) {
      if (session.date < weekStart || session.date > weekEnd) continue;
      for (const point of session.exercises) {
        if (point.exerciseId === exercise.id) sets += point.workSets;
      }
    }
    if (sets === 0) return null;

    const week = buildWeeklySets(sessions, weekStart).find((w) => w.start === weekStart) ?? null;
    const rows = [
      { group: exercise.group as MuscleGroup, weight: 1, sets },
      ...exercise.subGroups.map((sub) => ({
        group: sub.group,
        weight: sub.weight,
        sets: Math.round(sets * sub.weight * 100) / 100,
      })),
    ];
    return { weekStart, weekEnd, rows, week };
  }, [exercise, sessions, weekStart]);

  if (!exercise) return null;

  // 秒で数える種目は挙上量に計上しないので重量系を出さない。有酸素は距離・時間・速度に入れ替わる
  const metrics = METRICS.filter((m) =>
    isCardio(exercise.group)
      ? m.cardioOnly
      : !m.cardioOnly && (!m.needsWeight || countsReps(exercise.repUnit)),
  );
  const fallbackId = isCardio(exercise.group)
    ? 'distance'
    : exercise.repUnit === 'seconds'
      ? 'maxReps'
      : 'volume';
  const metric =
    metrics.find((m) => m.id === metricId) ??
    metrics.find((m) => m.id === fallbackId) ??
    metrics[0]!;

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
    { id: 'dots', label: metric.label, color: 'var(--s-lean)', kind: 'dots', points },
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
  // 見出しは通算の最高。直近の値は下に添える（伸びしろが一目で分かるのは最高値のほう）
  const best = personalBest(sessions, exercise.id, todayISO(), metric.pick);

  const weightTarget = exercise.goal?.type === 'weight' ? exercise.goal.value : null;
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
    <Modal open={open} title={exercise.name} onClose={onClose}>
      <div>
        <div className={`${ui.chipRow} ${s.filterRow}`} role="group" aria-label="指標">
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

        <div className={s.statRow}>
          <span className={s.statLabel}>過去最大</span>
          <b>{fmt(best, metric.digits)}</b>
          <span>{metric.unit}</span>
          {stall && (
            <span style={{ marginLeft: 'auto' }}>
              {fmt(stall.weight)}kg のまま {stall.weeks}週
            </span>
          )}
        </div>

        <div className={s.statSub}>
          <span>
            直近 {fmt(current, metric.digits)} {metric.unit}
          </span>
          {delta != null && (
            <span className={TONE_CLASS[deltaTone(delta, false, 0)]}>
              開始比 {fmtDelta(delta, metric.digits)}
            </span>
          )}
        </div>

        {progress != null && (
          <>
            <div className={s.meter}>
              <div className={s.meterFill} style={{ width: `${Math.round(progress * 100)}%` }} />
            </div>
            <div className={s.statSub}>
              <span>目標 {weightTarget} kg まで</span>
              <span style={{ marginLeft: 'auto' }}>{Math.round(progress * 100)}%</span>
            </div>
          </>
        )}

        <TimeSeriesChart
          series={series}
          domain={domain}
          unit={metric.unit}
          digits={metric.digits}
          legend={false}
          ariaLabel={`${exercise.name}の${metric.label}の推移`}
          emptyMessage={
            metric.needsWeight && exercise.repUnit === 'seconds'
              ? '秒で数える種目なので、この指標は出せません'
              : 'この期間に記録がありません'
          }
          reference={
            metric.weightLike && weightTarget != null
              ? { value: weightTarget, label: `目標 ${weightTarget}kg` }
              : null
          }
        />

        {metric.id === 'oneRm' && <p className={ui.note}>推定1RMは記録からの換算値です。</p>}

        {cardioWeek && (
          <>
            <div className={s.dialogHead}>
              <span>今週の合計</span>
              <span>
                {formatMD(cardioWeek.weekStart)}〜{formatMD(cardioWeek.weekEnd)}
              </span>
            </div>
            <div className={s.goalFoot}>
              <span>{cardioWeek.days}回</span>
              <span>
                {cardioWeek.distance != null && `${cardioWeek.distance}m ・ `}
                {cardioWeek.minutes}分{cardioWeek.speed != null && ` ・ ${cardioWeek.speed}m/分`}
              </span>
            </div>
            {/* 種目をまたいだ合計は出さない。走った距離と漕いだ距離を足しても読めない */}
            <p className={ui.note}>この種目ぶんだけの合計です。</p>
          </>
        )}

        {contribution && (
          <>
            <div className={s.dialogHead}>
              <span>週のセット数への貢献</span>
              <span>
                {formatMD(contribution.weekStart)}〜{formatMD(contribution.weekEnd)}
              </span>
            </div>
            {contribution.rows.map((row) => {
              const total = contribution.week?.setsByGroup[row.group] ?? 0;
              return (
                <div key={row.group} className={s.groupRow}>
                  <span>{GROUP_LABELS[row.group]}</span>
                  <span className={s.groupBarTrack}>
                    <span
                      className={s.groupBarFill}
                      style={{ width: `${total > 0 ? Math.min(1, row.sets / total) * 100 : 0}%` }}
                    />
                  </span>
                  <span className={s.groupValue}>
                    <b>{formatSets(row.sets)}</b> / {formatSets(total)}
                  </span>
                </div>
              );
            })}
            <p className={ui.note}>
              補助部位は種目ごとの係数ぶんで数えます（この種目は
              {[
                `${GROUP_LABELS[exercise.group]}×1`,
                ...exercise.subGroups.map((x) => `${GROUP_LABELS[x.group]}×${x.weight}`),
              ].join('・')}
              ）。
            </p>
          </>
        )}

        <div className={s.dialogHead}>
          <span>元データ</span>
          <span>{history.length}日ぶん</span>
        </div>

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
      </div>
    </Modal>
  );
}
