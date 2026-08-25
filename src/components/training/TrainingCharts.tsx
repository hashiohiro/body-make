import { useMemo, useState } from 'react';
import { Sparkline } from '../charts/Sparkline';
import { ExerciseDetailDialog } from './ExerciseDetailDialog';
import { METRICS, baselineOf, lastOf } from './metrics';
import { GROUP_LABELS, GROUP_ORDER } from '../../lib/exerciseCatalog';
import { deltaTone, fmt, fmtDelta } from '../../lib/format';
import { exerciseHistory } from '../../lib/training';
import type { Exercise, MuscleGroup, SessionPoint } from '../../types';
import ui from '../../styles/ui.module.scss';
import s from './training.module.scss';

const TONE_CLASS = { good: ui.good, bad: ui.bad, flat: ui.flat } as const;

interface Props {
  sessions: readonly SessionPoint[];
  exercises: readonly Exercise[];
  /** 表示期間の開始日 */
  from: string;
  /** 目標画面の行から来たときの初期選択。以後は一覧のタップが優先される */
  initialOpenId?: string | null;
}

/**
 * 種目ごとの推移。
 *
 * 種目ごとの詳細（大きいグラフ・週の内訳・元データ）はここに常駐させず、
 * 一覧の行を選んだときにダイアログで出す。
 * 1 種目ぶんの詳細が画面に居座ると、一覧を見比べるのに毎回その脇を通ることになる。
 */
export function TrainingCharts({ sessions, exercises, from, initialOpenId }: Props) {
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

  const [openId, setOpenId] = useState<string | null>(initialOpenId ?? null);
  const [metricId, setMetricId] = useState<string | null>(null);
  const [group, setGroup] = useState<MuscleGroup | 'all'>('all');

  // 部位は主部位だけで絞る。ここで見たいのは種目の推移で、配分ではない
  // （補助部位まで拾うと、腕にベンチプレスが並ぶ）
  const groups = GROUP_ORDER.filter((g) => recorded.some((e) => e.group === g));
  const shown = group === 'all' ? recorded : recorded.filter((e) => e.group === group);

  // 指標は一覧ぜんぶに効くので、出ている種目全体で出せるかを見る。
  // 秒で数える種目しか無いときだけ、重量系の指標が消える
  const metrics = METRICS.filter(
    (m) => !m.needsWeight || shown.some((e) => e.repUnit !== 'seconds'),
  );
  const fallbackId = metrics.some((m) => m.id === 'volume') ? 'volume' : 'maxReps';
  const metric =
    metrics.find((m) => m.id === metricId) ??
    metrics.find((m) => m.id === fallbackId) ??
    metrics[0]!;

  /*
   * 一覧は「切り替えないと見えない」を無くすためのもの。
   * ドロップダウンだと 1 種目見るのに 開く→探す→選ぶ→閉じる の 4 手かかり、
   * どれが伸びているかを知るだけでも種目数ぶん繰り返すことになる。
   *
   * 値と開始比は全履歴で計算し、折れ線だけ期間で切る（形を見るためのものなので）。
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
        return { ex, points, value, delta: base != null && value != null ? value - base : null };
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
                .map((row) => (
                  <button
                    key={row.ex.id}
                    type="button"
                    className={s.trendRow}
                    onClick={() => setOpenId(row.ex.id)}
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
                ))}
            </div>
          ))}
        </div>
      </section>

      <ExerciseDetailDialog
        open={openId != null}
        onClose={() => setOpenId(null)}
        exercise={recorded.find((e) => e.id === openId) ?? null}
        sessions={sessions}
        from={from}
      />
    </>
  );
}
