import { ExerciseGoalsCard } from './ExerciseGoalsCard';
import { WeeklyVolumeCard } from './WeeklyVolumeCard';
import type { ExerciseGoal, TrainingStats } from '../../lib/training';
import type { Exercise, GroupGoals, MuscleGroup, SessionPoint } from '../../types';

interface Props {
  goals: readonly ExerciseGoal[];
  groupGoals: GroupGoals;
  stats: TrainingStats;
  exercises: readonly Exercise[];
  /** 目標を決めるときに「いま」と「過去最大」を出すために使う */
  sessions: readonly SessionPoint[];
  onSetGroupGoal: (group: MuscleGroup, value: number | null) => void;
  onUpdate: (exercise: Exercise) => void;
}

/**
 * トレーニングの目標。**軸ごとにカードを分ける。**
 *
 *   今週の量   … 部位ごとに、どれだけやったか（今週だけ。日曜に 0 へ戻る）
 *   種目の目標 … 種目ごとに、どれだけ強くなったか（週をまたいで積み上がる）
 *
 * 以前は 1 つの行に両方を積んでいた。数える対象（部位／種目）も時間軸も違うものが
 * 同じ形で上下に並び、「種目の目標 2/3 到達」は部位の行にあるのに中身は種目の話で、
 * 開くまで何の 2/3 なのか読めなかった。
 *
 * 分けたことで、それぞれのカードに単位も注記も 1 つずつしか出てこない。
 * 「どの種目があと少しか」も、部位を 6 回開かずに一覧で読める。
 */
export function TrainingGoalBoard({
  goals,
  groupGoals,
  stats,
  exercises,
  sessions,
  onSetGroupGoal,
  onUpdate,
}: Props) {
  return (
    <>
      <WeeklyVolumeCard
        groupGoals={groupGoals}
        stats={stats}
        exercises={exercises}
        sessions={sessions}
        onSetGroupGoal={onSetGroupGoal}
      />

      <ExerciseGoalsCard
        goals={goals}
        exercises={exercises}
        sessions={sessions}
        stats={stats}
        onUpdate={onUpdate}
      />
    </>
  );
}
