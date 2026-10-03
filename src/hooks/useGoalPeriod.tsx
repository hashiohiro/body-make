import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import type { GoalPeriod } from '../types';

/**
 * 種目の目標を数える単位（日次／週次）。**全種目で 1 つの設定**（`Settings.goalPeriod`）。
 *
 * 目標の一覧だけでなく、種目の推移（`ExerciseDetailDialog`）もこれに従う——
 * 目標を週次で立てたのに、推移の「過去最大」が 1 回ごとのままだと、比べる物差しが割れる。
 * 推移はいくつもの画面から開くので、引き回さずに App が配る（重量の単位と同じ形）。
 */
const GoalPeriodContext = createContext<GoalPeriod>('session');

export function GoalPeriodProvider({
  period,
  children,
}: {
  period: GoalPeriod;
  children: ReactNode;
}) {
  return <GoalPeriodContext value={period}>{children}</GoalPeriodContext>;
}

export function useGoalPeriod(): GoalPeriod {
  return useContext(GoalPeriodContext);
}
