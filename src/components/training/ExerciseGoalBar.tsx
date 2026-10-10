import { goalTypeLabel } from '../../lib/exerciseCatalog';
import { fmt, fmtVolume } from '../../lib/format';
import { exerciseHistory, goalCurrent, goalSeries, goalUnitOf } from '../../lib/training';
import { useWeightFormat } from '../../hooks/useWeightUnit';
import { useT } from '../../lib/i18n';
import { Meter } from '../Meter';
import type { Exercise, GoalPeriod, GoalType, SessionPoint } from '../../types';
import s from './training.module.scss';

interface Props {
  exercise: Exercise;
  sessions: readonly SessionPoint[];
  /** 見ている日。日次ならその日の値、週次ならその日を含む週の値と並べる */
  date: string;
  goalPeriod: GoalPeriod;
}

/** 合計で数える目標。量なので「/日」「/週」を添える（重量・回数・速度は量ではないので添えない） */
const SUM_TYPES: ReadonlySet<GoalType> = new Set<GoalType>(['volume', 'distance', 'duration']);

/**
 * 記録のカードの「目標までの棒」。**文字を減らし、形で読ませる**（2026/10/10、利用者の指摘）。
 *
 * 左に指標の名前、右端に目標の値。いまの値は棒の長さで見せ、届いたら棒の色が変わる。
 * 正確な値は読み上げ（`aria-label`）が持つ。
 * 維持は数値を持たないので棒を出さない。
 */
export function ExerciseGoalBar({ exercise, sessions, date, goalPeriod }: Props) {
  const g = useGoalNumbers(exercise, sessions, date, goalPeriod);
  if (g == null || g.kind === 'maintain') return null;
  return (
    <div
      className={s.meterRow}
      data-e2e="exercise-goal-bar"
      data-e2e-state={g.reached ? 'reached' : 'open'}
    >
      <span className={s.meterLabel}>{g.metric}</span>
      <Meter size="line" value={g.ratio} label={g.text} reached={g.reached} />
      <span className={s.meterEnd}>{g.targetText}</span>
    </div>
  );
}

/**
 * いまの値と目標を、目標の画面と同じ数え方（`goalSeries`）で出す。日次はその日、週次はその週。
 * 面ごとに数え直すと、目標の画面と数字が割れる。
 */
function useGoalNumbers(
  exercise: Exercise,
  sessions: readonly SessionPoint[],
  date: string,
  goalPeriod: GoalPeriod,
) {
  const t = useT();
  const { label: unitLabel, conv } = useWeightFormat();
  const goal = exercise.goal;
  if (goal == null) return null;
  if (goal.type === 'maintain' || goal.value == null) return { kind: 'maintain' as const };

  const history = exerciseHistory(sessions, exercise.id);
  const current =
    goalPeriod === 'week'
      ? goalSeries(goal.type, 'week', history, date).current
      : (() => {
          const today = history.find((h) => h.date === date);
          return today ? goalCurrent(goal.type, today.point) : null;
        })();

  const unit = goalUnitOf(t, goal.type, exercise.repUnit);
  const kg = unit === 'kg';
  const digits = goal.type === 'weight' || goal.type === 'speed' ? 1 : 0;
  // 記録は kg で持っている。出す直前に読むときの単位へ直す（目標も同じ物差しで）
  const show = (n: number) =>
    goal.type === 'volume' ? fmtVolume(conv(n)) : fmt(kg ? conv(n) : n, digits);
  const shownUnit = kg ? unitLabel : unit;
  const unitText = SUM_TYPES.has(goal.type)
    ? t(goalPeriod === 'week' ? 'goalPeriod.perWeek' : 'goalPeriod.perDay', { unit: shownUnit })
    : shownUnit;
  const target = show(goal.value);
  const reached = current != null && current >= goal.value;

  return {
    kind: 'value' as const,
    metric: goalTypeLabel(t, goal.type, exercise.repUnit),
    // まだ値が無い（打つ前・その週にまだやっていない）ときは、目標だけを出す。0 と書かない
    text:
      current == null
        ? t('card.goal', { value: target })
        : t(reached ? 'ripple.goalReached' : 'ripple.goalOf', {
            amount: t('common.valueUnit', { value: show(current), unit: unitText }),
            value: target,
          }),
    targetText: t('common.valueUnit', { value: target, unit: unitText }),
    ratio: current == null || goal.value <= 0 ? 0 : current / goal.value,
    reached,
  };
}
