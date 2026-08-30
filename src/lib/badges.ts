import type { TrainingStats } from './training';
import type { Domain, Stats } from '../types';

export interface Badge {
  id: string;
  icon: string;
  name: string;
  detail: string;
  /**
   * どちらの側の実績か。ホームは体組成／トレーニングの切り替えに従って出し分ける。
   * 混ぜて並べると、体重を測っただけの日にトレーニングのバッジが「あと少し」で出てくる。
   */
  domain: Domain;
  earned: boolean;
  /** 0〜1。未獲得バッジの「あと少し」を出すため */
  progress: number;
  /** いまの値と到達条件。段階のあるバッジだけが持つ（「質の高い減量」のような複合条件は持たない） */
  value?: number;
  goal?: number;
  /** 値の単位。「12 / 30 回」のように読ませる */
  unit?: string;
}

interface Rule {
  id: string;
  icon: string;
  name: string;
  detail: string;
  domain: Domain;
  /** 現在値 */
  value: (s: Stats, t: TrainingStats) => number | null;
  /** 到達条件 */
  goal: number;
}

const RULES: Rule[] = [
  {
    id: 'streak-1',
    domain: 'body',
    icon: '🥚',
    name: 'はじめの1日',
    detail: '1日記録する',
    value: (s) => s.bestStreak,
    goal: 1,
  },
  {
    id: 'streak-3',
    domain: 'body',
    icon: '🌱',
    name: '3日連続',
    detail: '3日続けて記録',
    value: (s) => s.bestStreak,
    goal: 3,
  },
  {
    id: 'streak-7',
    domain: 'body',
    icon: '🔥',
    name: '1週間連続',
    detail: '7日続けて記録',
    value: (s) => s.bestStreak,
    goal: 7,
  },
  {
    id: 'streak-14',
    domain: 'body',
    icon: '⚡',
    name: '2週間連続',
    detail: '14日続けて記録',
    value: (s) => s.bestStreak,
    goal: 14,
  },
  {
    id: 'streak-30',
    domain: 'body',
    icon: '🏆',
    name: '1か月連続',
    detail: '30日続けて記録',
    value: (s) => s.bestStreak,
    goal: 30,
  },
  {
    id: 'streak-60',
    domain: 'body',
    icon: '🌟',
    name: '2か月連続',
    detail: '60日続けて記録',
    value: (s) => s.bestStreak,
    goal: 60,
  },
  {
    id: 'streak-100',
    domain: 'body',
    icon: '👑',
    name: '100日連続',
    detail: '100日続けて記録',
    value: (s) => s.bestStreak,
    goal: 100,
  },
  {
    id: 'days-7',
    domain: 'body',
    icon: '📗',
    name: '1週間ぶん',
    detail: '7日ぶん記録',
    value: (s) => s.recordedDays,
    goal: 7,
  },
  {
    id: 'days-14',
    domain: 'body',
    icon: '📙',
    name: '2週間ぶん',
    detail: '14日ぶん記録',
    value: (s) => s.recordedDays,
    goal: 14,
  },
  {
    id: 'days-30',
    domain: 'body',
    icon: '📘',
    name: '30日ぶん',
    detail: '通算30日を記録',
    value: (s) => s.recordedDays,
    goal: 30,
  },
  {
    id: 'days-100',
    domain: 'body',
    icon: '📚',
    name: '100日ぶん',
    detail: '通算100日を記録',
    value: (s) => s.recordedDays,
    goal: 100,
  },
  {
    id: 'days-300',
    domain: 'body',
    icon: '📕',
    name: '300日ぶん',
    detail: '300日ぶん記録',
    value: (s) => s.recordedDays,
    goal: 300,
  },
  {
    id: 'full-14',
    domain: 'body',
    icon: '🌗',
    name: '朝夕そろって14日',
    detail: '朝と夜の両方を14日ぶん',
    value: (s) => s.fullDays,
    goal: 14,
  },
  {
    id: 'full-30',
    domain: 'body',
    icon: '🌓',
    name: '朝夜30日',
    detail: '朝夜そろって30日',
    value: (s) => s.fullDays,
    goal: 30,
  },
  {
    id: 'full-100',
    domain: 'body',
    icon: '🌔',
    name: '朝夜100日',
    detail: '朝夜そろって100日',
    value: (s) => s.fullDays,
    goal: 100,
  },
  {
    id: 'perfect-week',
    domain: 'body',
    icon: '🎯',
    name: '皆勤の週',
    detail: '1週間すべての日を記録',
    value: (s) => s.perfectWeeks,
    goal: 1,
  },
  {
    id: 'perfect-week-4',
    domain: 'body',
    icon: '🎖️',
    name: '皆勤 ×4週',
    detail: '皆勤の週を4回',
    value: (s) => s.perfectWeeks,
    goal: 4,
  },
  {
    id: 'perfect-week-12',
    domain: 'body',
    icon: '💯',
    name: '完璧な週 ×12',
    detail: '7日すべて記録できた週が12',
    value: (s) => s.perfectWeeks,
    goal: 12,
  },
  {
    id: 'span-30',
    domain: 'body',
    icon: '⏳',
    name: 'はじめて30日',
    detail: '最初の記録から30日',
    value: (s) => s.totalSpanDays,
    goal: 30,
  },
  {
    id: 'span-100',
    domain: 'body',
    icon: '⌛',
    name: 'はじめて100日',
    detail: '最初の記録から100日',
    value: (s) => s.totalSpanDays,
    goal: 100,
  },
  {
    id: 'span-365',
    domain: 'body',
    icon: '🎂',
    name: 'はじめて1年',
    detail: '最初の記録から365日',
    value: (s) => s.totalSpanDays,
    goal: 365,
  },
  {
    id: 'lose-1',
    domain: 'body',
    icon: '🪶',
    name: '−1kg',
    detail: '開始から体重−1.0kg',
    value: (s) => (s.weightDelta == null ? null : -s.weightDelta),
    goal: 1,
  },
  {
    id: 'lose-3',
    domain: 'body',
    icon: '💨',
    name: '−3kg',
    detail: '開始から体重−3.0kg',
    value: (s) => (s.weightDelta == null ? null : -s.weightDelta),
    goal: 3,
  },
  {
    id: 'lose-5',
    domain: 'body',
    icon: '🚀',
    name: '−5kg',
    detail: '開始から体重−5.0kg',
    value: (s) => (s.weightDelta == null ? null : -s.weightDelta),
    goal: 5,
  },
  {
    id: 'lose-8',
    domain: 'body',
    icon: '🍃',
    name: '−8kg',
    detail: '開始から体重−8.0kg',
    value: (s) => (s.weightDelta == null ? null : -s.weightDelta),
    goal: 8,
  },
  {
    id: 'bf-1',
    domain: 'body',
    icon: '📉',
    name: '体脂肪−1%',
    detail: '開始から体脂肪率−1.0%',
    value: (s) => (s.bodyFatDelta == null ? null : -s.bodyFatDelta),
    goal: 1,
  },
  {
    id: 'bf-3',
    domain: 'body',
    icon: '✨',
    name: '体脂肪−3%',
    detail: '開始から体脂肪率−3.0%',
    value: (s) => (s.bodyFatDelta == null ? null : -s.bodyFatDelta),
    goal: 3,
  },
  {
    id: 'bf-5',
    domain: 'body',
    icon: '🫧',
    name: '体脂肪率−5%',
    detail: '開始から体脂肪率−5.0pt',
    value: (s) => (s.bodyFatDelta == null ? null : -s.bodyFatDelta),
    goal: 5,
  },
  {
    id: 'fat-2',
    domain: 'body',
    icon: '🔻',
    name: '体脂肪量−2kg',
    detail: '開始から体脂肪量−2.0kg',
    value: (s) => (s.fatMassDelta == null ? null : -s.fatMassDelta),
    goal: 2,
  },
  /*
   * トレーニングは「やった事実」だけを数える。成果（挙上重量の伸び）は褒めない（設計 §6.3）。
   * 段階を細かく刻むのは、始めたばかりの人にも次に届くものがあるようにするため。
   */
  {
    id: 'train-1',
    icon: '🎬',
    name: 'はじめの1回',
    detail: 'トレーニングを1回記録',
    domain: 'training',
    value: (_s, t) => t.sessions,
    goal: 1,
  },
  {
    id: 'train-5',
    icon: '🔰',
    name: 'トレ5回',
    detail: 'トレーニングを通算5回',
    domain: 'training',
    value: (_s, t) => t.sessions,
    goal: 5,
  },
  {
    id: 'train-10',
    icon: '🧱',
    name: 'トレ10回',
    detail: 'トレーニングを通算10回',
    domain: 'training',
    value: (_s, t) => t.sessions,
    goal: 10,
  },
  {
    id: 'train-30',
    icon: '🏋️',
    name: 'トレ30回',
    detail: 'トレーニングを通算30回',
    domain: 'training',
    value: (_s, t) => t.sessions,
    goal: 30,
  },
  {
    id: 'train-50',
    icon: '🛠️',
    name: 'トレ50回',
    detail: 'トレーニングを通算50回',
    domain: 'training',
    value: (_s, t) => t.sessions,
    goal: 50,
  },
  {
    id: 'train-100',
    icon: '🥇',
    name: 'トレ100回',
    detail: 'トレーニングを通算100回',
    domain: 'training',
    value: (_s, t) => t.sessions,
    goal: 100,
  },
  {
    id: 'train-200',
    icon: '🏅',
    name: 'トレ200回',
    detail: 'トレーニングを通算200回',
    domain: 'training',
    value: (_s, t) => t.sessions,
    goal: 200,
  },
  {
    id: 'train-365',
    icon: '🎖️',
    name: 'トレ365回',
    detail: 'トレーニングを通算365回',
    domain: 'training',
    value: (_s, t) => t.sessions,
    goal: 365,
  },
  {
    id: 'train-week-2',
    icon: '📌',
    name: '週2回 ×2週',
    detail: '週2回以上を2週続ける',
    domain: 'training',
    value: (_s, t) => t.bestWeeklyStreak,
    goal: 2,
  },
  {
    id: 'train-week-4',
    icon: '📅',
    name: '週2回 ×4週',
    detail: '週2回以上を4週続ける',
    domain: 'training',
    value: (_s, t) => t.bestWeeklyStreak,
    goal: 4,
  },
  {
    id: 'train-week-8',
    icon: '🗒️',
    name: '週2回 ×8週',
    detail: '週2回以上を8週続ける',
    domain: 'training',
    value: (_s, t) => t.bestWeeklyStreak,
    goal: 8,
  },
  {
    id: 'train-week-12',
    icon: '🗓️',
    name: '週2回 ×12週',
    detail: '週2回以上を12週続ける',
    domain: 'training',
    value: (_s, t) => t.bestWeeklyStreak,
    goal: 12,
  },
  {
    id: 'train-week-24',
    icon: '📗',
    name: '週2回 ×24週',
    detail: '週2回以上を24週続ける',
    domain: 'training',
    value: (_s, t) => t.bestWeeklyStreak,
    goal: 24,
  },
  {
    id: 'train-week-52',
    icon: '📚',
    name: '週2回 ×52週',
    detail: '週2回以上を52週続ける',
    domain: 'training',
    value: (_s, t) => t.bestWeeklyStreak,
    goal: 52,
  },
  {
    id: 'train-w3-1',
    icon: '⏱️',
    name: '週3回の週',
    detail: '週3回以上できた週が1つ',
    domain: 'training',
    value: (_s, t) => t.weeks3Plus,
    goal: 1,
  },
  {
    id: 'train-w3-10',
    icon: '⏳',
    name: '週3回 ×10週',
    detail: '週3回以上できた週が10',
    domain: 'training',
    value: (_s, t) => t.weeks3Plus,
    goal: 10,
  },
  {
    id: 'train-w3-30',
    icon: '🕰️',
    name: '週3回 ×30週',
    detail: '週3回以上できた週が30',
    domain: 'training',
    value: (_s, t) => t.weeks3Plus,
    goal: 30,
  },
  {
    id: 'train-days-3',
    icon: '3️⃣',
    name: '1週に3日',
    detail: '1週で3日やった',
    domain: 'training',
    value: (_s, t) => t.bestWeekDays,
    goal: 3,
  },
  {
    id: 'train-days-4',
    icon: '4️⃣',
    name: '1週に4日',
    detail: '1週で4日やった',
    domain: 'training',
    value: (_s, t) => t.bestWeekDays,
    goal: 4,
  },
  {
    id: 'train-days-5',
    icon: '5️⃣',
    name: '1週に5日',
    detail: '1週で5日やった',
    domain: 'training',
    value: (_s, t) => t.bestWeekDays,
    goal: 5,
  },
  {
    id: 'train-full-body',
    icon: '🧩',
    name: '全部位を一巡',
    detail: '1週間で6部位すべてを回す',
    domain: 'training',
    value: (_s, t) => t.fullBodyWeeks,
    goal: 1,
  },
  {
    id: 'train-full-body-5',
    icon: '🧭',
    name: '全部位 ×5週',
    detail: '6部位すべてを回した週が5',
    domain: 'training',
    value: (_s, t) => t.fullBodyWeeks,
    goal: 5,
  },
  {
    id: 'train-full-body-10',
    icon: '🗺️',
    name: '全部位 ×10週',
    detail: '6部位すべてを回した週が10',
    domain: 'training',
    value: (_s, t) => t.fullBodyWeeks,
    goal: 10,
  },
  {
    id: 'train-full-body-25',
    icon: '🌏',
    name: '全部位 ×25週',
    detail: '6部位すべてを回した週が25',
    domain: 'training',
    value: (_s, t) => t.fullBodyWeeks,
    goal: 25,
  },
  {
    id: 'train-kinds-5',
    icon: '🎒',
    name: '5種目',
    detail: '5種類の種目を記録',
    domain: 'training',
    value: (_s, t) => t.exerciseKinds,
    goal: 5,
  },
  {
    id: 'train-kinds-10',
    icon: '🧰',
    name: '10種目',
    detail: '10種類の種目を記録',
    domain: 'training',
    value: (_s, t) => t.exerciseKinds,
    goal: 10,
  },
  {
    id: 'train-kinds-20',
    icon: '🏗️',
    name: '20種目',
    detail: '20種類の種目を記録',
    domain: 'training',
    value: (_s, t) => t.exerciseKinds,
    goal: 20,
  },
  {
    id: 'train-kinds-30',
    icon: '🏛️',
    name: '30種目',
    detail: '30種類の種目を記録',
    domain: 'training',
    value: (_s, t) => t.exerciseKinds,
    goal: 30,
  },
  {
    id: 'train-span-30',
    icon: '🌗',
    name: 'はじめて30日',
    detail: '最初の記録から30日',
    domain: 'training',
    value: (_s, t) => t.spanDays,
    goal: 30,
  },
  {
    id: 'train-span-100',
    icon: '🌕',
    name: 'はじめて100日',
    detail: '最初の記録から100日',
    domain: 'training',
    value: (_s, t) => t.spanDays,
    goal: 100,
  },
];

/**
 * 体重を落としつつ除脂肪体重を保てたか。ボディメイクとしての「質」を見る特別枠。
 *
 * 2 つの条件の AND なので、段階のあるバッジと違って「あと何 kg」が 1 本の線にならない。
 * 満たした条件の数だけ進捗に出す（0 / 半分 / 達成）。
 */
function qualityBadge(stats: Stats): Badge {
  const lostWeight = stats.weightDelta != null && stats.weightDelta <= -1;
  const keptLean = stats.leanMassDelta != null && stats.leanMassDelta >= -0.5;
  const earned = lostWeight && keptLean;
  const met = (lostWeight ? 1 : 0) + (keptLean ? 1 : 0);
  return {
    id: 'quality-cut',
    domain: 'body',
    icon: '💪',
    name: '質の高い減量',
    detail:
      '開始から体重が1.0kg以上減り、そのあいだ除脂肪体重の減少が0.5kg以内に収まっている（開始・現在とも7日移動平均で見ます）',
    earned,
    progress: met / 2,
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
      domain: rule.domain,
      earned: value >= rule.goal,
      progress: Math.min(1, Math.max(0, value / rule.goal)),
      value: Math.round(value * 10) / 10,
      goal: rule.goal,
    };
  });
  const all = [...fromRules, qualityBadge(stats)];
  // 獲得済みを先に、未獲得は達成率の高い順に並べて「次の一歩」を見せる
  return all.sort((a, b) => {
    if (a.earned !== b.earned) return a.earned ? -1 : 1;
    return b.progress - a.progress;
  });
}
