import { describe, expect, it } from 'vitest';
import { metricSeries, metricsFor } from './metrics';
import { makeT } from '../../lib/i18n';
import type { ExerciseHistoryPoint } from '../../lib/training';
import type { ExercisePoint } from '../../types';

/*
 * 推移の一覧とダイアログが共有する並び（`metricSeries`）。
 * 週次は量の指標が合計、強さの指標が最大（種目の目標の週次と同じ分け方）。
 */
const t = makeT('ja');
const metric = (id: string) => metricsFor(t, 'kg').find((m) => m.id === id)!;
const at = (date: string, point: Partial<ExercisePoint>) =>
  ({ date, time: 0, point: point as ExercisePoint }) as ExerciseHistoryPoint;

// 9/20（日）〜9/26 が 1 週目、9/27（日）〜が 2 週目
const history = [
  at('2026-09-20', { volume: 600, maxReps: 10 }),
  at('2026-09-22', { volume: 500, maxReps: 12 }),
  at('2026-09-27', { volume: 800, maxReps: 8 }),
];

describe('推移の並び（日次と週次）', () => {
  it('日次は 1 回ごと。直近は最後の 1 回、過去最大は 1 回の最大', () => {
    const s = metricSeries(history, metric('volume'), 'session');
    expect(s.points.map((p) => p.v)).toEqual([600, 500, 800]);
    expect(s.current).toBe(800);
    expect(s.best).toBe(800);
  });

  it('週次の挙上量は週の合計。点は週の始まり（日曜）に置く', () => {
    const s = metricSeries(history, metric('volume'), 'week');
    expect(s.points.map((p) => [p.date, p.v])).toEqual([
      ['2026-09-20', 1100],
      ['2026-09-27', 800],
    ]);
    expect(s.best).toBe(1100);
  });

  it('週次の最大レップは週の最大', () => {
    expect(metricSeries(history, metric('maxReps'), 'week').points.map((p) => p.v)).toEqual([
      12, 8,
    ]);
  });

  it('開始値は最初の 3 つ（日次は 3 回、週次は 3 週）。足りなければ出さない', () => {
    expect(metricSeries(history, metric('volume'), 'session').baseline).toBeCloseTo(
      (600 + 500 + 800) / 3,
      5,
    );
    expect(metricSeries(history, metric('volume'), 'week').baseline).toBeNull();
  });
});

describe('週ごとのグラフの目盛り', () => {
  it('目盛りは日曜にだけ打つ', async () => {
    const { weekTicks } = await import('../charts/scales');
    const { isoToTime, toISO } = await import('../../lib/date');
    const ticks = weekTicks([isoToTime('2026-08-30'), isoToTime('2026-09-27')], 4);
    for (const tick of ticks) expect(new Date(tick).getDay()).toBe(0);
    expect(ticks.map((x) => toISO(new Date(x)))).toContain('2026-08-30');
    expect(ticks.map((x) => toISO(new Date(x)))).toContain('2026-09-27');
  });
});
