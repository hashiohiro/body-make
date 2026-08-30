import { GoalMeter } from '../components/GoalMeter';
import { TrainingGoalBoard } from '../components/training/TrainingGoalBoard';
import type { BodyData } from '../hooks/useBodyData';
import type { Domain } from '../types';

interface Props {
  body: BodyData;
  /** 体組成／トレーニングの切り替えはヘッダが持つ */
  domain: Domain;
}

/**
 * どこへ向かうか（目標）と、それに対する進捗。
 *
 * 目標値の編集もここで完結する。設定タブに置くと、
 * 「あと 3.2kg」を見る場所と決め直す場所が離れたままになる。
 * 設定に残すのは、滅多に変えない定義（種目そのもの・表示・データ）だけ。
 */
export function GoalsView({ body, domain }: Props) {
  const {
    data,
    stats,
    projection,
    sessions,
    trainingStats,
    trainingGoals,
    updateSettings,
    setGroupGoal,
    upsertExercise,
  } = body;

  if (domain === 'training') {
    return (
      <TrainingGoalBoard
        goals={trainingGoals}
        groupGoals={data.groupGoals}
        stats={trainingStats}
        exercises={data.exercises}
        sessions={sessions}
        onSetGroupGoal={setGroupGoal}
        onUpdate={upsertExercise}
      />
    );
  }

  return (
    <GoalMeter
      settings={data.settings}
      stats={stats}
      projection={projection}
      onUpdate={updateSettings}
    />
  );
}
