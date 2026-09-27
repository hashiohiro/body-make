import { GoalMeter } from '../components/GoalMeter';
import { CompositionCard } from '../components/pace/CompositionCard';
import { TrainingGoalBoard } from '../components/training/TrainingGoalBoard';
import type { BodyData } from '../hooks/useBodyData';
import { useToday } from '../hooks/useToday';
import { paceLine, targetComposition } from '../lib/pace';
import type { Domain } from '../types';

interface Props {
  body: BodyData;
  /** 体組成／トレーニングの切り替えはヘッダが持つ */
  domain: Domain;
  /**
   * マイ種目の画面へ行く。**マイ種目が空だと目標は 1 つも決められない**ので、
   * そのときだけ目標カードが入口を出す（ホームの「記録する」と同じ作法で、
   * 画面をまたぐ移動はルートを持つ App から渡す）。
   */
  onOpenExercises: () => void;
}

/**
 * どこへ向かうか（目標）と、それに対する進捗。
 *
 * 目標値の編集もここで完結する。設定タブに置くと、
 * 「あと 3.2kg」を見る場所と決め直す場所が離れたままになる。
 * 設定に残すのは、滅多に変えない定義（種目そのもの・表示・データ）だけ。
 */
export function GoalsView({ body, domain, onOpenExercises }: Props) {
  const today = useToday();
  const {
    data,
    daily,
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
        onOpenExercises={onOpenExercises}
      />
    );
  }

  /*
   * 目標のカードの下に、目標の体組成のカードを 1 枚（`docs/design-pace.md`）。
   * ペースは目標のカードの中に持つ（`PacePanel`）。
   * 目標体重が無ければどれも出さない——`GoalMeter` の空状態が入口になる。
   */
  const { settings } = data;
  const hasTarget = settings.targetWeight != null && stats.currentWeight != null;
  const composition = hasTarget ? targetComposition(settings, stats) : null;

  return (
    <>
      <GoalMeter
        settings={settings}
        stats={stats}
        projection={projection}
        onUpdate={updateSettings}
        line={paceLine(daily, settings, today)}
      />
      {composition && settings.targetBodyFat != null && stats.currentBodyFat != null && (
        <CompositionCard
          composition={composition}
          currentBodyFat={stats.currentBodyFat}
          targetBodyFat={settings.targetBodyFat}
        />
      )}
    </>
  );
}
