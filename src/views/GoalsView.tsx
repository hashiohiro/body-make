import { GoalMeter } from '../components/GoalMeter';
import { TrainingGoals } from '../components/training/TrainingGoals';
import { WeekGoals } from '../components/training/WeekGoals';
import type { BodyData } from '../hooks/useBodyData';
import type { Domain } from '../types';

interface Props {
  body: BodyData;
  /** 体組成／トレーニングの切り替えはヘッダが持つ */
  domain: Domain;
  /** 種目の目標の行から、その種目の推移へ */
  onOpenTrend: (exerciseId: string) => void;
}

/**
 * どこへ向かうか（目標）と、それに対する進捗。
 *
 * 目標値の編集もここで完結する。設定タブに置くと、
 * 「あと 3.2kg」を見る場所と決め直す場所が離れたままになる。
 * 設定に残すのは、滅多に変えない定義（種目そのもの・表示・データ）だけ。
 */
export function GoalsView({ body, domain, onOpenTrend }: Props) {
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
      <>
        <WeekGoals goals={data.groupGoals} onSetGoal={setGroupGoal} />
        <TrainingGoals
          goals={trainingGoals}
          stats={trainingStats}
          exercises={data.exercises}
          sessions={sessions}
          onUpdate={upsertExercise}
          onOpenTrend={onOpenTrend}
        />
      </>
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
