import { describe, expect, it } from 'vitest';
import { moveRecords, planMove } from './move';
import type { Workouts } from '../types';

/**
 * 記録を別の種目へ移す。**唯一「過去を書き換える」操作**なので、
 * 何日ぶんが動くか・どの日がぶつかるかを数えるところと、実際に動かすところを分けてある。
 */

const sets = (n: number) => Array.from({ length: n }, (_, i) => ({ weight: 10 + i, reps: 10 }));

const data = (): Workouts => ({
  '2026-03-01': [{ exerciseId: 'a', sets: sets(2) }],
  '2026-03-05': [
    { exerciseId: 'x', sets: sets(1) },
    { exerciseId: 'a', sets: sets(3) },
  ],
  // 移行先がすでにある日
  '2026-03-10': [
    { exerciseId: 'b', sets: sets(1) },
    { exerciseId: 'a', sets: sets(4) },
  ],
  // 移し元がない日
  '2026-03-20': [{ exerciseId: 'x', sets: sets(1) }],
});

describe('移す日を数える', () => {
  it('移し元がある日だけを拾い、移行先がある日は分ける', () => {
    const plan = planMove(data(), 'a', 'b');
    expect(plan.dates).toEqual(['2026-03-01', '2026-03-05']);
    expect(plan.conflicts).toEqual(['2026-03-10']);
  });

  it('期間で切れる（両端を含む）', () => {
    expect(planMove(data(), 'a', 'b', '2026-03-05').dates).toEqual(['2026-03-05']);
    expect(planMove(data(), 'a', 'b', '2026-03-05').conflicts).toEqual(['2026-03-10']);

    expect(planMove(data(), 'a', 'b', null, '2026-03-05').dates).toEqual([
      '2026-03-01',
      '2026-03-05',
    ]);
    expect(planMove(data(), 'a', 'b', null, '2026-03-05').conflicts).toEqual([]);

    const mid = planMove(data(), 'a', 'b', '2026-03-05', '2026-03-09');
    expect(mid.dates).toEqual(['2026-03-05']);
    expect(mid.conflicts).toEqual([]);
  });
});

describe('移す', () => {
  it('セットはそのまま運ぶ（値を書き換えない）', () => {
    const before = data();
    const plan = planMove(before, 'a', 'b');
    const after = moveRecords(before, 'a', 'b', plan, 'keep');

    expect(after['2026-03-01']).toEqual([{ exerciseId: 'b', sets: sets(2) }]);
    // 並びはやった順。移し元があった位置に置く
    expect(after['2026-03-05']!.map((e) => e.exerciseId)).toEqual(['x', 'b']);
    expect(after['2026-03-05']![1]!.sets).toEqual(sets(3));
    // 触っていない日はそのまま
    expect(after['2026-03-20']).toEqual(before['2026-03-20']);
  });

  it('元の記録は書き換えない（新しい形を返す）', () => {
    const before = data();
    const plan = planMove(before, 'a', 'b');
    moveRecords(before, 'a', 'b', plan, 'overwrite');
    expect(before['2026-03-01']![0]!.exerciseId).toBe('a');
  });

  it('衝突する日を残すと、その日は移し元に残る', () => {
    const before = data();
    const plan = planMove(before, 'a', 'b');
    const after = moveRecords(before, 'a', 'b', plan, 'keep');

    expect(after['2026-03-10']!.map((e) => e.exerciseId)).toEqual(['b', 'a']);
    expect(after['2026-03-10']![0]!.sets).toEqual(sets(1));
  });

  it('上書きすると、移行先のその日の記録は消える', () => {
    const before = data();
    const plan = planMove(before, 'a', 'b');
    const after = moveRecords(before, 'a', 'b', plan, 'overwrite');

    // 1 日 1 種目なので、残るのは移し元から来た 1 件だけ
    expect(after['2026-03-10']!.map((e) => e.exerciseId)).toEqual(['b']);
    expect(after['2026-03-10']![0]!.sets).toEqual(sets(4));
  });

  it('期間の外は動かさない', () => {
    const before = data();
    const plan = planMove(before, 'a', 'b', '2026-03-05');
    const after = moveRecords(before, 'a', 'b', plan, 'keep');

    expect(after['2026-03-01']![0]!.exerciseId).toBe('a');
    expect(after['2026-03-05']![1]!.exerciseId).toBe('b');
  });
});
