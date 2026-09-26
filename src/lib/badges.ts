import type { BadgeFacts } from './badgeFacts';
import { EMPTY_BADGE_FACTS } from './badgeFacts';
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
  /**
   * 解除するまで名前と条件を伏せるか。**伏せてあるあいだは `???` のタイルで出す。**
   *
   * 「元日に記録する」のような小ネタを条件つきで並べると、やることリストとして
   * 読める（§1.1 の「次の一歩を指定しない」）。伏せておけば、後から気づく事実になる。
   * 進捗も出さない——8 割まで来ていると分かれば、条件はだいたい割れてしまう。
   */
  hidden: boolean;
  /**
   * 獲得した日（`YYYY-MM-DD`）。**この仕組みより前に取ったものは null。**
   * 日付が無いものは獲得順に並べられないので、並べる側で後ろにまとめる。
   */
  earnedAt: string | null;
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
  value: (s: Stats, t: TrainingStats, f: BadgeFacts) => number | null;
  /** 到達条件 */
  goal: number;
  /** 解除するまで伏せる（`Badge.hidden`）。付けないものは最初から読める */
  hidden?: true;
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
    id: 'streak-180',
    domain: 'body',
    icon: '💎',
    nameKey: 'badge.streak.name',
    detailKey: 'badge.streak.detail',
    value: (s) => s.bestStreak,
    goal: 180,
  },
  {
    id: 'streak-365',
    domain: 'body',
    icon: '🐉',
    nameKey: 'badge.streak.name',
    detailKey: 'badge.streak.detail',
    value: (s) => s.bestStreak,
    goal: 365,
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
    id: 'days-50',
    domain: 'body',
    icon: '📓',
    nameKey: 'badge.days.name',
    detailKey: 'badge.days.detail',
    value: (s) => s.recordedDays,
    goal: 50,
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
    id: 'days-200',
    domain: 'body',
    icon: '📔',
    nameKey: 'badge.days.name',
    detailKey: 'badge.days.detail',
    value: (s) => s.recordedDays,
    goal: 200,
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
    id: 'days-500',
    domain: 'body',
    icon: '🗂️',
    nameKey: 'badge.days.name',
    detailKey: 'badge.days.detail',
    value: (s) => s.recordedDays,
    goal: 500,
  },
  {
    id: 'full-7',
    domain: 'body',
    icon: '🌘',
    nameKey: 'badge.full.name',
    detailKey: 'badge.full.detail',
    value: (s) => s.fullDays,
    goal: 7,
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
    id: 'full-300',
    domain: 'body',
    icon: '🌖',
    nameKey: 'badge.full.name',
    detailKey: 'badge.full.detail',
    value: (s) => s.fullDays,
    goal: 300,
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
    id: 'perfect-week-26',
    domain: 'body',
    icon: '🏵️',
    nameKey: 'badge.perfect-weeks.name',
    detailKey: 'badge.perfect-weeks.detail',
    value: (s) => s.perfectWeeks,
    goal: 26,
  },
  {
    id: 'perfect-week-52',
    domain: 'body',
    icon: '🎗️',
    nameKey: 'badge.perfect-weeks.name',
    detailKey: 'badge.perfect-weeks.detail',
    value: (s) => s.perfectWeeks,
    goal: 52,
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
  {
    id: 'fat-4',
    domain: 'body',
    icon: '🔽',
    nameKey: 'badge.fat.name',
    detailKey: 'badge.fat.detail',
    value: (s) => (s.fatMassDelta == null ? null : -s.fatMassDelta),
    goal: 4,
  },
  {
    id: 'fat-6',
    domain: 'body',
    icon: '⏬',
    nameKey: 'badge.fat.name',
    detailKey: 'badge.fat.detail',
    value: (s) => (s.fatMassDelta == null ? null : -s.fatMassDelta),
    goal: 6,
  },
  /*
   * **増やす方向も数える。**
   *
   * 減らす側（体重・体脂肪率・脂肪量）だけを実績にしていたので、増量期の人には
   * 11 個が永久に未解除のまま並んでいた。除脂肪体重が増えたことは減量と同じ 1 本の線で
   * 数えられる事実で、どちらが良いという話にはしない（§1.2）。
   */
  {
    id: 'lean-1',
    domain: 'body',
    icon: '🥛',
    nameKey: 'badge.lean.name',
    detailKey: 'badge.lean.detail',
    value: (s) => s.leanMassDelta,
    goal: 1,
  },
  {
    id: 'lean-2',
    domain: 'body',
    icon: '🍗',
    nameKey: 'badge.lean.name',
    detailKey: 'badge.lean.detail',
    value: (s) => s.leanMassDelta,
    goal: 2,
  },
  {
    id: 'lean-3',
    domain: 'body',
    icon: '🥩',
    nameKey: 'badge.lean.name',
    detailKey: 'badge.lean.detail',
    value: (s) => s.leanMassDelta,
    goal: 3,
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
    id: 'train-kinds-50',
    icon: '🏰',
    nameKey: 'training.exercises',
    detailKey: 'badge.train-kinds.detail',
    domain: 'training',
    value: (_s, t) => t.exerciseKinds,
    goal: 50,
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
  /*
   * **幅。**「何を回したか」の事実で、挙げた量の伸びではない（§6.3）。
   *
   * 有酸素はここまで実績が 1 つも無かった。部位ではないので部位別の集計には
   * 流れ込まず（`ExerciseGroup` が別の型）、そのぶん数える場所も無かった。
   */
  {
    id: 'train-cardio-1',
    icon: '🏃',
    nameKey: 'badge.train-cardio.name',
    detailKey: 'badge.train-cardio.detail',
    domain: 'training',
    value: (_s, t) => t.cardioDays,
    goal: 1,
  },
  {
    id: 'train-cardio-10',
    icon: '🚴',
    nameKey: 'badge.train-cardio.name',
    detailKey: 'badge.train-cardio.detail',
    domain: 'training',
    value: (_s, t) => t.cardioDays,
    goal: 10,
  },
  {
    id: 'train-cardio-30',
    icon: '🏊',
    nameKey: 'badge.train-cardio.name',
    detailKey: 'badge.train-cardio.detail',
    domain: 'training',
    value: (_s, t) => t.cardioDays,
    goal: 30,
  },
  /*
   * 全部位を N 日ずつ。**いちばん少ない部位で見る**ので、1 本の線で「偏っていない」が言える。
   * 週で一巡したか（`fullBodyWeeks`）の通算版。
   */
  {
    id: 'train-groups-5',
    icon: '🔄',
    nameKey: 'badge.train-groups.name',
    detailKey: 'badge.train-groups.detail',
    domain: 'training',
    value: (_s, t) => t.minGroupDays,
    goal: 5,
  },
  {
    id: 'train-groups-10',
    icon: '🔁',
    nameKey: 'badge.train-groups.name',
    detailKey: 'badge.train-groups.detail',
    domain: 'training',
    value: (_s, t) => t.minGroupDays,
    goal: 10,
  },
  {
    id: 'train-groups-25',
    icon: '♻️',
    nameKey: 'badge.train-groups.name',
    detailKey: 'badge.train-groups.detail',
    domain: 'training',
    value: (_s, t) => t.minGroupDays,
    goal: 25,
  },
  /*
   * **行為の量。**何回行ったかだけでなく、何本やって何 t 動かしたかを数える。
   *
   * 挙上量は**伸びではなく量**なので、成果を褒めないこと（§6.3）とは両立する。
   * 推定 1RM や自己ベストの更新回数は入れない——あちらは「強くなったか」の話。
   */
  {
    id: 'train-sets-100',
    icon: '🔢',
    nameKey: 'badge.train-sets.name',
    detailKey: 'badge.train-sets.detail',
    domain: 'training',
    value: (_s, t) => t.totalSets,
    goal: 100,
  },
  {
    id: 'train-sets-500',
    icon: '🧾',
    nameKey: 'badge.train-sets.name',
    detailKey: 'badge.train-sets.detail',
    domain: 'training',
    value: (_s, t) => t.totalSets,
    goal: 500,
  },
  {
    id: 'train-sets-2000',
    icon: '📦',
    nameKey: 'badge.train-sets.name',
    detailKey: 'badge.train-sets.detail',
    domain: 'training',
    value: (_s, t) => t.totalSets,
    goal: 2000,
  },
  {
    id: 'train-sets-5000',
    icon: '🏭',
    nameKey: 'badge.train-sets.name',
    detailKey: 'badge.train-sets.detail',
    domain: 'training',
    value: (_s, t) => t.totalSets,
    goal: 5000,
  },
  // 挙上量は t で数える。kg のままだと「いま 12500 / 100000」になって桁が読めない
  {
    id: 'train-volume-10',
    icon: '🪨',
    nameKey: 'badge.train-volume.name',
    detailKey: 'badge.train-volume.detail',
    domain: 'training',
    value: (_s, t) => t.totalVolume / 1000,
    goal: 10,
  },
  {
    id: 'train-volume-100',
    icon: '🚚',
    nameKey: 'badge.train-volume.name',
    detailKey: 'badge.train-volume.detail',
    domain: 'training',
    value: (_s, t) => t.totalVolume / 1000,
    goal: 100,
  },
  {
    id: 'train-volume-500',
    icon: '🚂',
    nameKey: 'badge.train-volume.name',
    detailKey: 'badge.train-volume.detail',
    domain: 'training',
    value: (_s, t) => t.totalVolume / 1000,
    goal: 500,
  },
  {
    id: 'train-volume-1000',
    icon: '🗿',
    nameKey: 'badge.train-volume.name',
    detailKey: 'badge.train-volume.detail',
    domain: 'training',
    value: (_s, t) => t.totalVolume / 1000,
    goal: 1000,
  },
  /*
   * ここから下は**伏せてある実績**（`hidden`）。解除するまで `???` で出る。
   *
   * 数えるのは日付と値と行為の形だけ。**時刻は持っていない**ので
   * 「深夜に記録した」のような小ネタは作れない（`workouts` も `entries` も日付単位で、
   * `SessionPoint.time` は日付をミリ秒に直しただけ）。
   *
   * 暦のネタは体組成とトレーニングで**文言を共有する**。ホームは切り替えで
   * 片側しか出さないので、同じ名前が並んで見えることはない。
   */
  {
    id: 'hid-weekdays',
    domain: 'body',
    icon: '🎴',
    nameKey: 'badge.hid-weekdays.name',
    detailKey: 'badge.hid-weekdays.detail',
    value: (_s, _t, f) => f.weekdaysRecorded,
    goal: 7,
    hidden: true,
  },
  {
    id: 'hid-seasons',
    domain: 'body',
    icon: '🎏',
    nameKey: 'badge.hid-seasons.name',
    detailKey: 'badge.hid-seasons.detail',
    value: (_s, _t, f) => f.seasonsRecorded,
    goal: 4,
    hidden: true,
  },
  {
    id: 'hid-months',
    domain: 'body',
    icon: '🎋',
    nameKey: 'badge.hid-months.name',
    detailKey: 'badge.hid-months.detail',
    value: (_s, _t, f) => f.monthsRecorded,
    goal: 12,
    hidden: true,
  },
  {
    id: 'hid-new-year',
    domain: 'body',
    icon: '🎍',
    nameKey: 'badge.hid-new-year.name',
    detailKey: 'badge.hid-new-year.detail',
    value: (_s, _t, f) => f.newYearDays,
    goal: 1,
    hidden: true,
  },
  {
    id: 'hid-leap-day',
    domain: 'body',
    icon: '🐸',
    nameKey: 'badge.hid-leap-day.name',
    detailKey: 'badge.hid-leap-day.detail',
    value: (_s, _t, f) => f.leapDays,
    goal: 1,
    hidden: true,
  },
  {
    id: 'hid-anniversary',
    domain: 'body',
    icon: '🎁',
    nameKey: 'badge.hid-anniversary.name',
    detailKey: 'badge.hid-anniversary.detail',
    value: (_s, _t, f) => f.anniversaryDays,
    goal: 1,
    hidden: true,
  },
  {
    id: 'hid-same-weight',
    domain: 'body',
    icon: '🧊',
    nameKey: 'badge.hid-same-weight.name',
    detailKey: 'badge.hid-same-weight.detail',
    value: (_s, _t, f) => f.sameWeightRun,
    goal: 3,
    hidden: true,
  },
  {
    id: 'hid-round-weight',
    domain: 'body',
    icon: '🎲',
    nameKey: 'badge.hid-round-weight.name',
    detailKey: 'badge.hid-round-weight.detail',
    value: (_s, _t, f) => f.roundWeightDays,
    goal: 1,
    hidden: true,
  },
  {
    id: 'hid-ampm-gap',
    domain: 'body',
    icon: '🪞',
    nameKey: 'badge.hid-ampm-gap.name',
    detailKey: 'badge.hid-ampm-gap.detail',
    value: (_s, _t, f) => f.ampmGapDays,
    goal: 1,
    hidden: true,
  },
  {
    id: 'hid-comeback',
    domain: 'body',
    icon: '🏡',
    nameKey: 'badge.hid-comeback.name',
    detailKey: 'badge.hid-comeback.detail',
    value: (_s, _t, f) => f.bodyReturnGap,
    goal: 30,
    hidden: true,
  },
  {
    id: 'hid-train-weekdays',
    domain: 'training',
    icon: '🃏',
    nameKey: 'badge.hid-weekdays.name',
    detailKey: 'badge.hid-weekdays.detail',
    value: (_s, _t, f) => f.trainWeekdays,
    goal: 7,
    hidden: true,
  },
  {
    id: 'hid-train-seasons',
    domain: 'training',
    icon: '🎐',
    nameKey: 'badge.hid-seasons.name',
    detailKey: 'badge.hid-seasons.detail',
    value: (_s, _t, f) => f.trainSeasons,
    goal: 4,
    hidden: true,
  },
  {
    id: 'hid-train-months',
    domain: 'training',
    icon: '🗞️',
    nameKey: 'badge.hid-months.name',
    detailKey: 'badge.hid-months.detail',
    value: (_s, _t, f) => f.trainMonths,
    goal: 12,
    hidden: true,
  },
  {
    id: 'hid-train-new-year',
    domain: 'training',
    icon: '🎌',
    nameKey: 'badge.hid-new-year.name',
    detailKey: 'badge.hid-new-year.detail',
    value: (_s, _t, f) => f.trainNewYearDays,
    goal: 1,
    hidden: true,
  },
  {
    id: 'hid-train-leap-day',
    domain: 'training',
    icon: '🦘',
    nameKey: 'badge.hid-leap-day.name',
    detailKey: 'badge.hid-leap-day.detail',
    value: (_s, _t, f) => f.trainLeapDays,
    goal: 1,
    hidden: true,
  },
  {
    id: 'hid-cardio-only',
    domain: 'training',
    icon: '👟',
    nameKey: 'badge.hid-cardio-only.name',
    detailKey: 'badge.hid-cardio-only.detail',
    value: (_s, _t, f) => f.cardioOnlyDays,
    goal: 1,
    hidden: true,
  },
  {
    id: 'hid-groups-in-day',
    domain: 'training',
    icon: '🐙',
    nameKey: 'badge.hid-groups-in-day.name',
    detailKey: 'badge.hid-groups-in-day.detail',
    value: (_s, _t, f) => f.bestGroupsInDay,
    goal: 4,
    hidden: true,
  },
  {
    id: 'hid-single',
    domain: 'training',
    icon: '🧘',
    nameKey: 'badge.hid-single.name',
    detailKey: 'badge.hid-single.detail',
    value: (_s, _t, f) => f.singleExerciseDays,
    goal: 1,
    hidden: true,
  },
  {
    id: 'hid-devotion',
    domain: 'training',
    icon: '🧲',
    nameKey: 'badge.hid-devotion.name',
    detailKey: 'badge.hid-devotion.detail',
    value: (_s, _t, f) => f.topExerciseSessions,
    goal: 100,
    hidden: true,
  },
  {
    id: 'hid-train-comeback',
    domain: 'training',
    icon: '🚪',
    nameKey: 'badge.hid-comeback.name',
    detailKey: 'badge.hid-comeback.detail',
    value: (_s, _t, f) => f.trainReturnGap,
    goal: 30,
    hidden: true,
  },
];

/**
 * 2 つの条件の AND で決まる特別枠。ボディメイクとしての「質」を見る。
 *
 * 段階のあるバッジと違って「あと何 kg」が 1 本の線にならないので、
 * 満たした条件の数だけ進捗に出す（0 / 半分 / 達成）。
 */
function bothOf(
  id: string,
  icon: string,
  nameKey: MessageKey,
  detailKey: MessageKey,
  a: boolean,
  b: boolean,
): Omit<Badge, 'earnedAt'> {
  return {
    id,
    domain: 'body',
    icon,
    nameKey,
    detailKey,
    hidden: false,
    earned: a && b,
    progress: ((a ? 1 : 0) + (b ? 1 : 0)) / 2,
  };
}

/**
 * 質を見る 2 つ。**減らす側と増やす側で対にする。**
 *
 * 減量の質だけを置いていた頃は、増量期の人にはこの枠が永久に未解除だった。
 * どちらが良いという順序は付けない——満たした側が出るだけ（§1.2）。
 */
function qualityBadges(stats: Stats): Omit<Badge, 'earnedAt'>[] {
  return [
    bothOf(
      'quality-cut',
      '💪',
      'badge.quality-cut.name',
      'badge.quality-cut.detail',
      stats.weightDelta != null && stats.weightDelta <= -1,
      stats.leanMassDelta != null && stats.leanMassDelta >= -0.5,
    ),
    bothOf(
      'quality-bulk',
      '🦾',
      'badge.quality-bulk.name',
      'badge.quality-bulk.detail',
      stats.weightDelta != null && stats.weightDelta >= 1,
      stats.bodyFatDelta != null && stats.bodyFatDelta <= 0.5,
    ),
  ];
}

/**
 * 実績を数える。**獲得日は渡された表から引く**（ここでは決めない）。
 *
 * いつ取ったかは記録の合計からは戻らないので、保存してあるものを読むだけにする。
 * 持っていない ID は、この仕組みより前に取ったもの（`earnedAt` は null）。
 */
export function computeBadges(
  stats: Stats,
  training: TrainingStats,
  earnedAt: Record<string, string> = {},
  facts: BadgeFacts = EMPTY_BADGE_FACTS,
): Badge[] {
  const fromRules = RULES.map<Badge>((rule) => {
    const value = rule.value(stats, training, facts) ?? 0;
    const earned = value >= rule.goal;
    /*
     * 伏せてあるうちは**値も閾値も渡さない。**
     * 「いま 6 / 7」が出れば、名前を隠しても何を数えているかは読める。
     */
    const masked = rule.hidden === true && !earned;
    return {
      id: rule.id,
      icon: rule.icon,
      nameKey: rule.nameKey,
      detailKey: rule.detailKey,
      domain: rule.domain,
      hidden: rule.hidden === true,
      earned,
      earnedAt: earnedAt[rule.id] ?? null,
      progress: masked ? 0 : Math.min(1, Math.max(0, value / rule.goal)),
      ...(masked ? {} : { value: Math.round(value * 10) / 10, goal: rule.goal }),
    };
  });
  const quality = qualityBadges(stats).map<Badge>((q) => ({
    ...q,
    earnedAt: earnedAt[q.id] ?? null,
  }));
  const all = [...fromRules, ...quality];
  // 獲得済みを先に、未獲得は達成率の高い順に並べて「次の一歩」を見せる
  return all.sort((a, b) => {
    if (a.earned !== b.earned) return a.earned ? -1 : 1;
    // 伏せてあるものは最後。進捗を持たないので、混ぜると 0% の列に紛れて読みにくい
    if (!a.earned && a.hidden !== b.hidden) return a.hidden ? 1 : -1;
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
