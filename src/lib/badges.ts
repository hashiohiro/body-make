import type { TrainingStats } from './training';
import type { Domain, Stats } from '../types';
import type { MessageKey, T } from './i18n';

export interface Badge {
  id: string;
  icon: string;
  /**
   * 名前と条件の文は**キーで持つ**（`docs/design-i18n.md` §5）。
   * 判定の値（閾値・条件）は訳さない——数え方は言語で変わらない。
   */
  nameKey: MessageKey;
  detailKey: MessageKey;
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
  nameKey: MessageKey;
  detailKey: MessageKey;
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
    nameKey: 'badge.streak-1.name',
    detailKey: 'badge.streak-1.detail',
    value: (s) => s.bestStreak,
    goal: 1,
  },
  {
    id: 'streak-3',
    domain: 'body',
    icon: '🌱',
    nameKey: 'badge.streak.name',
    detailKey: 'badge.streak.detail',
    value: (s) => s.bestStreak,
    goal: 3,
  },
  {
    id: 'streak-7',
    domain: 'body',
    icon: '🔥',
    nameKey: 'badge.streak.name',
    detailKey: 'badge.streak.detail',
    value: (s) => s.bestStreak,
    goal: 7,
  },
  {
    id: 'streak-14',
    domain: 'body',
    icon: '⚡',
    nameKey: 'badge.streak.name',
    detailKey: 'badge.streak.detail',
    value: (s) => s.bestStreak,
    goal: 14,
  },
  {
    id: 'streak-30',
    domain: 'body',
    icon: '🏆',
    nameKey: 'badge.streak.name',
    detailKey: 'badge.streak.detail',
    value: (s) => s.bestStreak,
    goal: 30,
  },
  {
    id: 'streak-60',
    domain: 'body',
    icon: '🌟',
    nameKey: 'badge.streak.name',
    detailKey: 'badge.streak.detail',
    value: (s) => s.bestStreak,
    goal: 60,
  },
  {
    id: 'streak-100',
    domain: 'body',
    icon: '👑',
    nameKey: 'badge.streak.name',
    detailKey: 'badge.streak.detail',
    value: (s) => s.bestStreak,
    goal: 100,
  },
  {
    id: 'days-7',
    domain: 'body',
    icon: '📗',
    nameKey: 'badge.days.name',
    detailKey: 'badge.days.detail',
    value: (s) => s.recordedDays,
    goal: 7,
  },
  {
    id: 'days-14',
    domain: 'body',
    icon: '📙',
    nameKey: 'badge.days.name',
    detailKey: 'badge.days.detail',
    value: (s) => s.recordedDays,
    goal: 14,
  },
  {
    id: 'days-30',
    domain: 'body',
    icon: '📘',
    nameKey: 'badge.days.name',
    detailKey: 'badge.days.detail',
    value: (s) => s.recordedDays,
    goal: 30,
  },
  {
    id: 'days-100',
    domain: 'body',
    icon: '📚',
    nameKey: 'badge.days.name',
    detailKey: 'badge.days.detail',
    value: (s) => s.recordedDays,
    goal: 100,
  },
  {
    id: 'days-300',
    domain: 'body',
    icon: '📕',
    nameKey: 'badge.days.name',
    detailKey: 'badge.days.detail',
    value: (s) => s.recordedDays,
    goal: 300,
  },
  {
    id: 'full-14',
    domain: 'body',
    icon: '🌗',
    nameKey: 'badge.full.name',
    detailKey: 'badge.full.detail',
    value: (s) => s.fullDays,
    goal: 14,
  },
  {
    id: 'full-30',
    domain: 'body',
    icon: '🌓',
    nameKey: 'badge.full.name',
    detailKey: 'badge.full.detail',
    value: (s) => s.fullDays,
    goal: 30,
  },
  {
    id: 'full-100',
    domain: 'body',
    icon: '🌔',
    nameKey: 'badge.full.name',
    detailKey: 'badge.full.detail',
    value: (s) => s.fullDays,
    goal: 100,
  },
  {
    id: 'perfect-week',
    domain: 'body',
    icon: '🎯',
    nameKey: 'badge.perfect-week.name',
    detailKey: 'badge.perfect-week.detail',
    value: (s) => s.perfectWeeks,
    goal: 1,
  },
  {
    id: 'perfect-week-4',
    domain: 'body',
    icon: '🎖️',
    nameKey: 'badge.perfect-weeks.name',
    detailKey: 'badge.perfect-weeks.detail',
    value: (s) => s.perfectWeeks,
    goal: 4,
  },
  {
    id: 'perfect-week-12',
    domain: 'body',
    icon: '💯',
    nameKey: 'badge.perfect-weeks.name',
    detailKey: 'badge.perfect-weeks.detail',
    value: (s) => s.perfectWeeks,
    goal: 12,
  },
  {
    id: 'span-30',
    domain: 'body',
    icon: '⏳',
    nameKey: 'badge.span.name',
    detailKey: 'badge.span.detail',
    value: (s) => s.totalSpanDays,
    goal: 30,
  },
  {
    id: 'span-100',
    domain: 'body',
    icon: '⌛',
    nameKey: 'badge.span.name',
    detailKey: 'badge.span.detail',
    value: (s) => s.totalSpanDays,
    goal: 100,
  },
  {
    id: 'span-365',
    domain: 'body',
    icon: '🎂',
    nameKey: 'badge.span.name',
    detailKey: 'badge.span.detail',
    value: (s) => s.totalSpanDays,
    goal: 365,
  },
  {
    id: 'lose-1',
    domain: 'body',
    icon: '🪶',
    nameKey: 'badge.lose.name',
    detailKey: 'badge.lose.detail',
    value: (s) => (s.weightDelta == null ? null : -s.weightDelta),
    goal: 1,
  },
  {
    id: 'lose-3',
    domain: 'body',
    icon: '💨',
    nameKey: 'badge.lose.name',
    detailKey: 'badge.lose.detail',
    value: (s) => (s.weightDelta == null ? null : -s.weightDelta),
    goal: 3,
  },
  {
    id: 'lose-5',
    domain: 'body',
    icon: '🚀',
    nameKey: 'badge.lose.name',
    detailKey: 'badge.lose.detail',
    value: (s) => (s.weightDelta == null ? null : -s.weightDelta),
    goal: 5,
  },
  {
    id: 'lose-8',
    domain: 'body',
    icon: '🍃',
    nameKey: 'badge.lose.name',
    detailKey: 'badge.lose.detail',
    value: (s) => (s.weightDelta == null ? null : -s.weightDelta),
    goal: 8,
  },
  {
    id: 'bf-1',
    domain: 'body',
    icon: '📉',
    nameKey: 'badge.bf.name',
    detailKey: 'badge.bf.detail',
    value: (s) => (s.bodyFatDelta == null ? null : -s.bodyFatDelta),
    goal: 1,
  },
  {
    id: 'bf-3',
    domain: 'body',
    icon: '✨',
    nameKey: 'badge.bf.name',
    detailKey: 'badge.bf.detail',
    value: (s) => (s.bodyFatDelta == null ? null : -s.bodyFatDelta),
    goal: 3,
  },
  {
    id: 'bf-5',
    domain: 'body',
    icon: '🫧',
    nameKey: 'badge.bf.name',
    detailKey: 'badge.bf.detail',
    value: (s) => (s.bodyFatDelta == null ? null : -s.bodyFatDelta),
    goal: 5,
  },
  {
    id: 'fat-2',
    domain: 'body',
    icon: '🔻',
    nameKey: 'badge.fat.name',
    detailKey: 'badge.fat.detail',
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
    nameKey: 'badge.train-1.name',
    detailKey: 'badge.train-1.detail',
    domain: 'training',
    value: (_s, t) => t.sessions,
    goal: 1,
  },
  {
    id: 'train-5',
    icon: '🔰',
    nameKey: 'badge.train.name',
    detailKey: 'badge.train.detail',
    domain: 'training',
    value: (_s, t) => t.sessions,
    goal: 5,
  },
  {
    id: 'train-10',
    icon: '🧱',
    nameKey: 'badge.train.name',
    detailKey: 'badge.train.detail',
    domain: 'training',
    value: (_s, t) => t.sessions,
    goal: 10,
  },
  {
    id: 'train-30',
    icon: '🏋️',
    nameKey: 'badge.train.name',
    detailKey: 'badge.train.detail',
    domain: 'training',
    value: (_s, t) => t.sessions,
    goal: 30,
  },
  {
    id: 'train-50',
    icon: '🛠️',
    nameKey: 'badge.train.name',
    detailKey: 'badge.train.detail',
    domain: 'training',
    value: (_s, t) => t.sessions,
    goal: 50,
  },
  {
    id: 'train-100',
    icon: '🥇',
    nameKey: 'badge.train.name',
    detailKey: 'badge.train.detail',
    domain: 'training',
    value: (_s, t) => t.sessions,
    goal: 100,
  },
  {
    id: 'train-200',
    icon: '🏅',
    nameKey: 'badge.train.name',
    detailKey: 'badge.train.detail',
    domain: 'training',
    value: (_s, t) => t.sessions,
    goal: 200,
  },
  {
    id: 'train-365',
    icon: '🎖️',
    nameKey: 'badge.train.name',
    detailKey: 'badge.train.detail',
    domain: 'training',
    value: (_s, t) => t.sessions,
    goal: 365,
  },
  {
    id: 'train-week-2',
    icon: '📌',
    nameKey: 'badge.train-week.name',
    detailKey: 'badge.train-week.detail',
    domain: 'training',
    value: (_s, t) => t.bestWeeklyStreak,
    goal: 2,
  },
  {
    id: 'train-week-4',
    icon: '📅',
    nameKey: 'badge.train-week.name',
    detailKey: 'badge.train-week.detail',
    domain: 'training',
    value: (_s, t) => t.bestWeeklyStreak,
    goal: 4,
  },
  {
    id: 'train-week-8',
    icon: '🗒️',
    nameKey: 'badge.train-week.name',
    detailKey: 'badge.train-week.detail',
    domain: 'training',
    value: (_s, t) => t.bestWeeklyStreak,
    goal: 8,
  },
  {
    id: 'train-week-12',
    icon: '🗓️',
    nameKey: 'badge.train-week.name',
    detailKey: 'badge.train-week.detail',
    domain: 'training',
    value: (_s, t) => t.bestWeeklyStreak,
    goal: 12,
  },
  {
    id: 'train-week-24',
    icon: '📗',
    nameKey: 'badge.train-week.name',
    detailKey: 'badge.train-week.detail',
    domain: 'training',
    value: (_s, t) => t.bestWeeklyStreak,
    goal: 24,
  },
  {
    id: 'train-week-52',
    icon: '📚',
    nameKey: 'badge.train-week.name',
    detailKey: 'badge.train-week.detail',
    domain: 'training',
    value: (_s, t) => t.bestWeeklyStreak,
    goal: 52,
  },
  {
    id: 'train-w3-1',
    icon: '⏱️',
    nameKey: 'badge.train-w3-1.name',
    detailKey: 'badge.train-w3-1.detail',
    domain: 'training',
    value: (_s, t) => t.weeks3Plus,
    goal: 1,
  },
  {
    id: 'train-w3-10',
    icon: '⏳',
    nameKey: 'badge.train-w3.name',
    detailKey: 'badge.train-w3.detail',
    domain: 'training',
    value: (_s, t) => t.weeks3Plus,
    goal: 10,
  },
  {
    id: 'train-w3-30',
    icon: '🕰️',
    nameKey: 'badge.train-w3.name',
    detailKey: 'badge.train-w3.detail',
    domain: 'training',
    value: (_s, t) => t.weeks3Plus,
    goal: 30,
  },
  {
    id: 'train-days-3',
    icon: '3️⃣',
    nameKey: 'badge.train-days.name',
    detailKey: 'badge.train-days.detail',
    domain: 'training',
    value: (_s, t) => t.bestWeekDays,
    goal: 3,
  },
  {
    id: 'train-days-4',
    icon: '4️⃣',
    nameKey: 'badge.train-days.name',
    detailKey: 'badge.train-days.detail',
    domain: 'training',
    value: (_s, t) => t.bestWeekDays,
    goal: 4,
  },
  {
    id: 'train-days-5',
    icon: '5️⃣',
    nameKey: 'badge.train-days.name',
    detailKey: 'badge.train-days.detail',
    domain: 'training',
    value: (_s, t) => t.bestWeekDays,
    goal: 5,
  },
  {
    id: 'train-full-body',
    icon: '🧩',
    nameKey: 'badge.train-full-body.name',
    detailKey: 'badge.train-full-body.detail',
    domain: 'training',
    value: (_s, t) => t.fullBodyWeeks,
    goal: 1,
  },
  {
    id: 'train-full-body-5',
    icon: '🧭',
    nameKey: 'badge.train-full-bodies.name',
    detailKey: 'badge.train-full-bodies.detail',
    domain: 'training',
    value: (_s, t) => t.fullBodyWeeks,
    goal: 5,
  },
  {
    id: 'train-full-body-10',
    icon: '🗺️',
    nameKey: 'badge.train-full-bodies.name',
    detailKey: 'badge.train-full-bodies.detail',
    domain: 'training',
    value: (_s, t) => t.fullBodyWeeks,
    goal: 10,
  },
  {
    id: 'train-full-body-25',
    icon: '🌏',
    nameKey: 'badge.train-full-bodies.name',
    detailKey: 'badge.train-full-bodies.detail',
    domain: 'training',
    value: (_s, t) => t.fullBodyWeeks,
    goal: 25,
  },
  {
    id: 'train-kinds-5',
    icon: '🎒',
    nameKey: 'training.exercises',
    detailKey: 'badge.train-kinds.detail',
    domain: 'training',
    value: (_s, t) => t.exerciseKinds,
    goal: 5,
  },
  {
    id: 'train-kinds-10',
    icon: '🧰',
    nameKey: 'training.exercises',
    detailKey: 'badge.train-kinds.detail',
    domain: 'training',
    value: (_s, t) => t.exerciseKinds,
    goal: 10,
  },
  {
    id: 'train-kinds-20',
    icon: '🏗️',
    nameKey: 'training.exercises',
    detailKey: 'badge.train-kinds.detail',
    domain: 'training',
    value: (_s, t) => t.exerciseKinds,
    goal: 20,
  },
  {
    id: 'train-kinds-30',
    icon: '🏛️',
    nameKey: 'training.exercises',
    detailKey: 'badge.train-kinds.detail',
    domain: 'training',
    value: (_s, t) => t.exerciseKinds,
    goal: 30,
  },
  {
    id: 'train-span-30',
    icon: '🌗',
    nameKey: 'badge.train-span.name',
    detailKey: 'badge.train-span.detail',
    domain: 'training',
    value: (_s, t) => t.spanDays,
    goal: 30,
  },
  {
    id: 'train-span-100',
    icon: '🌕',
    nameKey: 'badge.train-span.name',
    detailKey: 'badge.train-span.detail',
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
    nameKey: 'badge.quality-cut.name',
    detailKey: 'badge.quality-cut.detail',
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
      nameKey: rule.nameKey,
      detailKey: rule.detailKey,
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

/*
 * 名前と条件の文は**段階ごとに書かない。**「3日連続」「7日連続」…と閾値のぶんだけ
 * 文を持つと、同じ規則の中で言い方が割れる（実際「7日ぶん記録」と「通算30日を記録」が
 * 並んでいた）。閾値は `goal` が持っているので、文は 1 つにして穴を埋める。
 */
export function badgeName(t: T, badge: Badge): string {
  return t(badge.nameKey, { n: badge.goal ?? 0 });
}

export function badgeDetail(t: T, badge: Badge): string {
  return t(badge.detailKey, { n: badge.goal ?? 0 });
}
