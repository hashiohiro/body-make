import { useMemo, useState } from 'react';
import { Sparkline } from '../charts/Sparkline';
import { ExerciseDetailDialog } from './ExerciseDetailDialog';
import { ChipGroup } from '../ChipGroup';
import { GroupChips } from './GroupChips';
import { FILTER_THRESHOLD, matchesGroup, matchesQuery } from '../../lib/exerciseSearch';
import { METRICS, baselineOf, lastOf } from './metrics';
import { SearchToggle } from './SearchToggle';
import {
  EXERCISE_GROUP_ORDER,
  GROUP_LABELS,
  countsReps,
  isCardio,
} from '../../lib/exerciseCatalog';
import { deltaTone, fmt, fmtDelta } from '../../lib/format';
import { exerciseHistory } from '../../lib/training';
import type { Exercise, ExerciseGroup, SessionPoint } from '../../types';
import { CardHeader } from '../CardHeader';
import { TONE_CLASS } from '../tone';
import ui from '../../styles/ui.module.scss';
import s from './training.module.scss';

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
  const [group, setGroup] = useState<ExerciseGroup | 'all'>('all');
  /** 名前で探す。見出しの行に畳んである（`SearchToggle`） */
  const [query, setQuery] = useState('');

  // 部位は主部位だけで絞る。ここで見たいのは種目の推移で、配分ではない
  // （補助部位まで拾うと、腕にベンチプレスが並ぶ）
  const groups = EXERCISE_GROUP_ORDER.filter((g) => recorded.some((e) => e.group === g));
  /*
   * 出す種目。部位チップと検索は AND。
   *
   * 検索は**見出しの行に畳む**（待機中の高さは 0）。この画面は
   * 「全種目の折れ線を並べて形を比べる」のが主な用途なので、絞り込みを主役にしない。
   * それでも「ベンチだけ見たい」はよくあり、胸に 10 種持つ人には部位チップだけでは足りない。
   */
  const shown = recorded.filter((e) => matchesGroup(e, group) && matchesQuery(e.name, query));

  /*
   * 指標は一覧ぜんぶに効くので、出ている種目全体で出せるかを見る。
   * 秒で数える種目しか無いときは重量系が消え、有酸素だけのときは距離・時間・速度に入れ替わる。
   * 混在しているとき（すべて）は筋トレ側を出す。有酸素の行は空欄になるが、
   * 有酸素チップを選べば専用の指標に切り替わる。
   */
  const allCardio = shown.length > 0 && shown.every((e) => isCardio(e.group));
  const metrics = METRICS.filter((m) =>
    allCardio
      ? m.cardioOnly
      : !m.cardioOnly && (!m.needsWeight || shown.some((e) => countsReps(e.repUnit))),
  );
  const fallbackId = allCardio
    ? 'distance'
    : metrics.some((m) => m.id === 'volume')
      ? 'volume'
      : 'maxReps';
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
        <CardHeader title="種目別の推移">
          {recorded.length > FILTER_THRESHOLD && (
            <SearchToggle query={query} onQuery={setQuery} label="種目を検索" />
          )}
        </CardHeader>

        <div className={s.filters}>
          <ChipGroup
            options={metrics}
            value={metric.id}
            onChange={setMetricId}
            label="指標"
            showLabel
            tight
          />

          <GroupChips value={group} onChange={setGroup} groups={groups} showLabel />
        </div>

        <div className={s.trendList}>
          {/* 見出しは主部位で切る。並びも部位順にして、どこを見ているかを見失わないようにする */}
          {EXERCISE_GROUP_ORDER.filter((g) => rows.some((r) => r.ex.group === g)).map((g) => (
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
