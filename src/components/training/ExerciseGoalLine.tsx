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
 * 「この種目の目標」。**カードと入力ダイアログの両方で、いまの値に目標を添える。**
 *
 * 以前は部位の挙上量の行（胸の今週の合計）だけが目標と並んでいて、この種目の値に見えた
 * （2026/10/10、利用者の指摘）。打ちながら知りたいのは、この種目が目標に届くかどうか。
 *
 * いまの値は目標の画面と同じ数え方（`goalSeries`）から引く。日次はその日、週次はその週。
 * 面ごとに数え直すと、目標の画面と数字が割れる。
 */
export function ExerciseGoalLine({ exercise, sessions, date, goalPeriod }: Props) {
  const t = useT();
  const g = useGoalNumbers(exercise, sessions, date, goalPeriod);
  if (g == null) return null;

  // 維持は数値を決めない目標。値は並べず、立て方だけを出す
  if (g.kind === 'maintain') {
    return (
      <dl className={s.ripple} data-e2e="exercise-goal-line">
        <div className={s.rippleRow}>
          <dt className={s.rippleLabel}>{t('common.goal')}</dt>
          <dd className={s.rippleValue}>{t('goalType.maintain')}</dd>
        </div>
      </dl>
    );
  }

  return (
    <dl className={s.ripple} data-e2e="exercise-goal-line">
      <div className={s.rippleRow}>
        <dt className={s.rippleLabel}>{t('exerciseGoal.metricOf', { metric: g.metric })}</dt>
        <dd className={s.rippleValue}>{g.text}</dd>
      </div>
    </dl>
  );
}

/**
 * 記録のカードの「目標までの棒」。**文字を減らし、形で読ませる**（2026/10/10、利用者の指摘）。
 *
 * 左に指標の名前、右端に目標の値。いまの値は棒の長さで見せ、届いたら棒の色が変わる。
 * 正確な値は読み上げ（`aria-label`）と、入力ダイアログの「{指標}の目標」の行が持つ。
 * 維持は数値を持たないので棒を出さない。
 */
export function ExerciseGoalBar({ exercise, sessions, date, goalPeriod }: Props) {
  const g = useGoalNumbers(exercise, sessions, date, goalPeriod);
  if (g == null || g.kind === 'maintain') return null;
  return (
    <div className={s.meterRow} data-e2e="exercise-goal-bar">
      <span className={s.meterLabel}>{g.metric}</span>
      <Meter size="line" value={g.ratio} label={g.text} reached={g.reached} />
      <span className={s.meterEnd}>{g.targetText}</span>
    </div>
  );
}

/** いまの値と目標を、目標の画面と同じ数え方（`goalSeries`）で出す。行と棒の両方が使う */
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
