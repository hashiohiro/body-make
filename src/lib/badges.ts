import type { TrainingStats } from './training';
import type { Stats } from '../types';

export interface Badge {
  id: string;
  icon: string;
  name: string;
  detail: string;
  earned: boolean;
  /** 0〜1。未獲得バッジの「あと少し」を出すため */
  progress: number;
}

interface Rule {
  id: string;
  icon: string;
  name: string;
  detail: string;
  /** 現在値 */
  value: (s: Stats, t: TrainingStats) => number | null;
  /** 到達条件 */
  goal: number;
}

const RULES: Rule[] = [
  { id: 'streak-3', icon: '🌱', name: '3日連続', detail: '3日続けて記録', value: (s) => s.bestStreak, goal: 3 },
  { id: 'streak-7', icon: '🔥', name: '1週間連続', detail: '7日続けて記録', value: (s) => s.bestStreak, goal: 7 },
  { id: 'streak-14', icon: '⚡', name: '2週間連続', detail: '14日続けて記録', value: (s) => s.bestStreak, goal: 14 },
  { id: 'streak-30', icon: '🏆', name: '1か月連続', detail: '30日続けて記録', value: (s) => s.bestStreak, goal: 30 },
  { id: 'streak-100', icon: '👑', name: '100日連続', detail: '100日続けて記録', value: (s) => s.bestStreak, goal: 100 },
  { id: 'days-30', icon: '📘', name: '30日ぶん', detail: '通算30日を記録', value: (s) => s.recordedDays, goal: 30 },
  { id: 'days-100', icon: '📚', name: '100日ぶん', detail: '通算100日を記録', value: (s) => s.recordedDays, goal: 100 },
  { id: 'full-14', icon: '🌗', name: '朝夕そろって14日', detail: '朝と夜の両方を14日ぶん', value: (s) => s.fullDays, goal: 14 },
  { id: 'perfect-week', icon: '🎯', name: '皆勤の週', detail: '1週間すべての日を記録', value: (s) => s.perfectWeeks, goal: 1 },
  { id: 'perfect-week-4', icon: '🎖️', name: '皆勤 ×4週', detail: '皆勤の週を4回', value: (s) => s.perfectWeeks, goal: 4 },
  { id: 'lose-1', icon: '🪶', name: '−1kg', detail: '開始から体重−1.0kg', value: (s) => (s.weightDelta == null ? null : -s.weightDelta), goal: 1 },
  { id: 'lose-3', icon: '💨', name: '−3kg', detail: '開始から体重−3.0kg', value: (s) => (s.weightDelta == null ? null : -s.weightDelta), goal: 3 },
  { id: 'lose-5', icon: '🚀', name: '−5kg', detail: '開始から体重−5.0kg', value: (s) => (s.weightDelta == null ? null : -s.weightDelta), goal: 5 },
  { id: 'bf-1', icon: '📉', name: '体脂肪−1%', detail: '開始から体脂肪率−1.0%', value: (s) => (s.bodyFatDelta == null ? null : -s.bodyFatDelta), goal: 1 },
  { id: 'bf-3', icon: '✨', name: '体脂肪−3%', detail: '開始から体脂肪率−3.0%', value: (s) => (s.bodyFatDelta == null ? null : -s.bodyFatDelta), goal: 3 },
  { id: 'fat-2', icon: '🔻', name: '体脂肪量−2kg', detail: '開始から体脂肪量−2.0kg', value: (s) => (s.fatMassDelta == null ? null : -s.fatMassDelta), goal: 2 },
  // トレーニングは「やった事実」だけを数える。成果（挙上重量の伸び）は褒めない
  { id: 'train-30', icon: '🏋️', name: 'トレ30回', detail: 'トレーニングを通算30回', value: (_s, t) => t.sessions, goal: 30 },
  { id: 'train-100', icon: '🥇', name: 'トレ100回', detail: 'トレーニングを通算100回', value: (_s, t) => t.sessions, goal: 100 },
  { id: 'train-week-4', icon: '📅', name: '週2回 ×4週', detail: '週2回以上を4週続ける', value: (_s, t) => t.bestWeeklyStreak, goal: 4 },
  { id: 'train-week-12', icon: '🗓️', name: '週2回 ×12週', detail: '週2回以上を12週続ける', value: (_s, t) => t.bestWeeklyStreak, goal: 12 },
  { id: 'train-full-body', icon: '🧩', name: '全部位を一巡', detail: '1週間で6部位すべてを回す', value: (_s, t) => t.fullBodyWeeks, goal: 1 },
];

/** 体重を落としつつ除脂肪体重を保てたか。ボディメイクとしての「質」を見る特別枠 */
function qualityBadge(stats: Stats): Badge {
  const lostWeight = stats.weightDelta != null && stats.weightDelta <= -1;
  const keptLean = stats.leanMassDelta != null && stats.leanMassDelta >= -0.5;
  const earned = lostWeight && keptLean;
  return {
    id: 'quality-cut',
    icon: '💪',
    name: '質の高い減量',
    detail: '体重−1kg以上、かつ除脂肪体重の減少0.5kg以内',
    earned,
    progress: earned ? 1 : 0,
  };
}

export function computeBadges(stats: Stats, training: TrainingStats): Badge[] {
  const fromRules = RULES.map<Badge>((rule) => {
    const value = rule.value(stats, training) ?? 0;
    return {
      id: rule.id,
      icon: rule.icon,
      name: rule.name,
      detail: rule.detail,
      earned: value >= rule.goal,
      progress: Math.min(1, Math.max(0, value / rule.goal)),
    };
  });
  const all = [...fromRules, qualityBadge(stats)];
  // 獲得済みを先に、未獲得は達成率の高い順に並べて「次の一歩」を見せる
  return all.sort((a, b) => {
    if (a.earned !== b.earned) return a.earned ? -1 : 1;
    return b.progress - a.progress;
  });
}
