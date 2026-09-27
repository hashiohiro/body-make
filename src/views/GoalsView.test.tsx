// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { GoalsView } from './GoalsView';
import { useBodyData } from '../hooks/useBodyData';
import { WeightUnitProvider } from '../hooks/useWeightUnit';
import { addDays, todayISO } from '../lib/date';
import { CATALOG, fromCatalog } from '../lib/exerciseCatalog';
import { sanitizeData } from '../lib/storage';
import type { AppData } from '../types';

/*
 * 目標タブ（体組成）の 3 枚のカード（`docs/design-pace.md`）。
 * 値の正しさは lib/pace.test.ts が見ている。ここで見るのは、出る条件と結線。
 */

afterEach(cleanup);

let seeded: AppData;

function Harness() {
  const body = useBodyData(seeded);
  return (
    <WeightUnitProvider unit={body.data.settings.displayWeightUnit}>
      <GoalsView body={body} domain="body" onOpenExercises={() => {}} />
    </WeightUnitProvider>
  );
}

/** 直近 20 日ぶん、体重が週 0.2kg ほど増えている記録 */
function seed(settings: Record<string, unknown>, withWeightGoal = true, days = 20) {
  const today = todayISO();
  const entries: Record<string, unknown> = {};
  for (let i = days - 1; i >= 0; i--) {
    const weight = 76 - i * 0.03;
    entries[addDays(today, -i)] = {
      am: { weight, bodyFat: 17, waist: null },
      pm: { weight: null, bodyFat: null, waist: null },
    };
  }

  const squat = fromCatalog(
    CATALOG.find((c) => c.id === 'ex_squat')!,
    0,
  );
  squat.goal = withWeightGoal ? { type: 'weight', value: 130 } : { type: 'maintain', value: null };

  seeded = sanitizeData({
    version: 7,
    settings,
    entries,
    exercises: [squat],
    workouts: {
      [addDays(today, -14)]: [{ exerciseId: 'ex_squat', sets: [{ weight: 110, reps: 10 }] }],
      [addDays(today, -7)]: [{ exerciseId: 'ex_squat', sets: [{ weight: 100, reps: 10 }] }],
      [addDays(today, -1)]: [{ exerciseId: 'ex_squat', sets: [{ weight: 90, reps: 10 }] }],
    },
  });
}

const card = (title: string) =>
  within(screen.getByRole('heading', { name: title }).closest('section')!);

describe('目標のペース・体組成', () => {
  /** ペースは単独のカードではなく、目標のカード（「目標まで あと ○kg」）の中に持つ */
  const goalCard = () => within(screen.getByText(/目標まで あと/).closest('section')!);

  it('目標体重・目標日・目標体脂肪率があれば、ペースと体組成が出る', () => {
    seed({ targetWeight: 70, targetBodyFat: 10, targetDate: addDays(todayISO(), 90) });
    render(<Harness />);

    // 図は幅を測ってから描く（jsdom は幅 0）。並べた 2 つの値と換算で見る
    const goal = goalCard();
    expect(goal.getByText('実績（直近28日）')).toBeTruthy();
    expect(goal.getByText(/までに必要$/)).toBeTruthy();
    expect(goal.getAllByText(/kcal\/日$/).length).toBe(2);
    expect(card('目標の体組成').getByText(/いまの除脂肪体重のまま/)).toBeTruthy();
  });

  it('ペースは目標のカードの中だけに出す（別のカードにしない・文字の 2 行も残さない）', () => {
    seed({ targetWeight: 70, targetDate: addDays(todayISO(), 90) });
    render(<Harness />);
    expect(screen.queryByRole('heading', { name: 'ペース' })).toBeNull();
    expect(screen.queryByText('現在のペース（直近28日）')).toBeNull();
    expect(screen.queryByText(/までに必要なペース/)).toBeNull();
  });

  it('目標日が無くても枠は出し、必要の側に入れ方を添える', () => {
    seed({ targetWeight: 70, targetBodyFat: 10 });
    render(<Harness />);
    const goal = goalCard();
    expect(goal.getByText('実績（直近28日）')).toBeTruthy();
    expect(goal.getByText('目標日までに必要')).toBeTruthy();
    expect(goal.getByText('目標日を決めると出ます。')).toBeTruthy();
    // 体組成のカードは目標日に依らない
    expect(screen.getByRole('heading', { name: '目標の体組成' })).toBeTruthy();
  });

  it('記録が足りず実績が出なくても枠は出し、実績の側に入れ方を添える', () => {
    seed({ targetWeight: 70, targetDate: addDays(todayISO(), 90) }, true, 2);
    render(<Harness />);
    const goal = goalCard();
    expect(goal.getByText('直近28日に体重を4日以上記録すると出ます。')).toBeTruthy();
    // 必要の側は出る
    expect(goal.getAllByText(/kcal\/日$/).length).toBe(1);
  });

  it('目標体脂肪率が無ければ体組成のカードは出ない', () => {
    seed({ targetWeight: 70, targetDate: addDays(todayISO(), 90) });
    render(<Harness />);
    expect(screen.queryByRole('heading', { name: '目標の体組成' })).toBeNull();
  });

  it('目標体重が無ければ、どれも出ない', () => {
    seed({ targetDate: addDays(todayISO(), 90), targetBodyFat: 10 });
    render(<Harness />);
    expect(screen.queryByText('実績（直近28日）')).toBeNull();
    for (const title of ['目標の体組成']) {
      expect(screen.queryByRole('heading', { name: title })).toBeNull();
    }
  });

  /** 背骨（設計 §1）。差は図にするが、読み方は言わない */
  it('判定語と指示語を出さない', () => {
    seed({ targetWeight: 65, targetBodyFat: 10, targetDate: addDays(todayISO(), 90) });
    render(<Harness />);
    expect(
      screen.queryByText(/遅れ|速すぎ|順調|減らしましょう|増やしましょう|にしませんか/),
    ).toBeNull();
  });
});

/** 推定1RM はトレーニングの話。体組成の目標タブには出さない */
it('体組成の目標タブに推定1RM のカードは無い', () => {
  seed({ targetWeight: 70, targetBodyFat: 10, targetDate: addDays(todayISO(), 90) });
  render(<Harness />);
  expect(screen.queryByRole('heading', { name: '推定1RM' })).toBeNull();
});

/** 目標の開始日は、決めていなければ最初の記録の日を出す（保存は決めたときだけ） */
it('目標の開始日は既定で最初の記録の日', () => {
  seed({ targetWeight: 70 });
  render(<Harness />);
  fireEvent.click(screen.getByRole('button', { name: '目標を変更' }));
  const field = screen.getByLabelText(/目標の開始日/) as HTMLInputElement;
  expect(field.value).toBe(addDays(todayISO(), -19));

  // 別の日に決めると、その日が出る。最初の記録の日に選び直すと、決めていない状態に戻る
  fireEvent.change(field, { target: { value: addDays(todayISO(), -5) } });
  expect((screen.getByLabelText(/目標の開始日/) as HTMLInputElement).value).toBe(
    addDays(todayISO(), -5),
  );
  fireEvent.change(screen.getByLabelText(/目標の開始日/), {
    target: { value: addDays(todayISO(), -19) },
  });
  expect((screen.getByLabelText(/目標の開始日/) as HTMLInputElement).value).toBe(
    addDays(todayISO(), -19),
  );
});
