import type { DailyPoint, SessionPoint } from '../types';
import { diffDays, weekdayIndex } from './date';
import { isCardio } from './exerciseCatalog';
import { sessionGroups } from './training';

/**
 * 伏せてある実績（隠し実績）が見る事実。
 *
 * **`Stats` や `TrainingStats` には入れない。**あちらは画面のあちこちが読む値で、
 * こちらはバッジ 1 種類しか読まない小ネタ（うるう日に記録があるか、朝と夜で
 * 1kg 違った日があるか）。混ぜると、どの値が画面のどこに出るのか読めなくなる。
 *
 * **真偽ではなく件数で持つ。**判定は「値 ≧ 閾値」の 1 本の線で書けるようにしてある
 * （`badges.ts` の `Rule`）ので、0 か 1 かで足りるものも件数で返す。
 */
export interface BadgeFacts {
  /* --- 暦（体組成の記録） --- */
  /** 記録がある曜日の数（0〜7） */
  weekdaysRecorded: number;
  /** 記録がある季節の数（0〜4）。春 3-5 / 夏 6-8 / 秋 9-11 / 冬 12-2 */
  seasonsRecorded: number;
  /** 記録がある月の数（0〜12）。年はまたいでよい */
  monthsRecorded: number;
  /** 1月1日に記録した日数 */
  newYearDays: number;
  /** 2月29日に記録した日数 */
  leapDays: number;
  /** 最初の記録と同じ月日に、別の年も記録した日数 */
  anniversaryDays: number;

  /* --- 値の偶然 --- */
  /** 日平均体重（0.1kg まで）が同じまま続いた最長の日数 */
  sameWeightRun: number;
  /** 10 の倍数ぴったりの体重を打った回数 */
  roundWeightDays: number;
  /** 同じ日の朝と夜で 1.0kg 以上ちがった日数 */
  ampmGapDays: number;

  /* --- 復帰 --- */
  /**
   * 空けてから戻ってきたときの、最長の空白日数（体組成）。
   *
   * **記録と記録のあいだだけを見る。**いま空いているぶん（最後の記録から今日まで）は
   * 数えない——まだ戻ってきていないので、「戻ってきた」という事実にならない。
   */
  bodyReturnGap: number;

  /* --- 暦（トレーニング） --- */
  trainWeekdays: number;
  trainSeasons: number;
  trainMonths: number;
  trainNewYearDays: number;
  trainLeapDays: number;

  /* --- 行動の形 --- */
  /** 有酸素だけで終えた日数 */
  cardioOnlyDays: number;
  /** 1 日にやった部位数の最大 */
  bestGroupsInDay: number;
  /** 1 種目だけで終えた日数 */
  singleExerciseDays: number;
  /** いちばん多く記録した種目の回数 */
  topExerciseSessions: number;
  /** 空けてから戻ってきたときの、最長の空白日数（トレーニング） */
  trainReturnGap: number;
}

export const EMPTY_BADGE_FACTS: BadgeFacts = {
  weekdaysRecorded: 0,
  seasonsRecorded: 0,
  monthsRecorded: 0,
  newYearDays: 0,
  leapDays: 0,
  anniversaryDays: 0,
  sameWeightRun: 0,
  roundWeightDays: 0,
  ampmGapDays: 0,
  bodyReturnGap: 0,
  trainWeekdays: 0,
  trainSeasons: 0,
  trainMonths: 0,
  trainNewYearDays: 0,
  trainLeapDays: 0,
  cardioOnlyDays: 0,
  bestGroupsInDay: 0,
  singleExerciseDays: 0,
  topExerciseSessions: 0,
  trainReturnGap: 0,
};

/** 'YYYY-MM-DD' から月（1〜12）。`Date` を作らずに読む（日付の足し引きはしないので足りる） */
const monthOf = (iso: string) => Number(iso.slice(5, 7));

/** 季節（0〜3）。12 月を冬の頭に寄せるため 12 を 0 に折り返す */
const seasonOf = (iso: string) => Math.floor((monthOf(iso) % 12) / 3);

/** 'MM-DD'。何年かを落として、同じ月日を突き合わせる */
const monthDayOf = (iso: string) => iso.slice(5);

/** 日付の並びから、暦を埋めた度合いを数える */
function calendar(dates: readonly string[]) {
  const weekdays = new Set<number>();
  const seasons = new Set<number>();
  const months = new Set<number>();
  let newYear = 0;
  let leap = 0;
  for (const date of dates) {
    weekdays.add(weekdayIndex(date));
    seasons.add(seasonOf(date));
    months.add(monthOf(date));
    if (monthDayOf(date) === '01-01') newYear++;
    if (monthDayOf(date) === '02-29') leap++;
  }
  const first = dates[0];
  const anniversary =
    first == null
      ? 0
      : dates.filter((d) => d !== first && monthDayOf(d) === monthDayOf(first)).length;
  return {
    weekdays: weekdays.size,
    seasons: seasons.size,
    months: months.size,
    newYear,
    leap,
    anniversary,
  };
}

/** 記録と記録のあいだで、いちばん長く空いた日数 */
function longestGap(dates: readonly string[]): number {
  let longest = 0;
  for (let i = 1; i < dates.length; i++) {
    const gap = diffDays(dates[i]!, dates[i - 1]!);
    if (gap > longest) longest = gap;
  }
  return longest;
}

/**
 * 伏せてある実績のための事実を数える。**走査は 1 回ずつ。**
 *
 * 渡すのは導出済みの日次とセッション（`deriveAll` が持っているもの）。
 * 生の `entries` から数え直すと、記録の無い日の扱いが `buildDaily` と割れる。
 */
export function computeBadgeFacts(
  daily: readonly DailyPoint[],
  sessions: readonly SessionPoint[],
): BadgeFacts {
  // 範囲を埋めるために作られた「記録の無い日」は数えない（`slots` が 0 の日）
  const recorded = daily.filter((d) => d.slots > 0);
  const body = calendar(recorded.map((d) => d.date));
  const train = calendar(sessions.map((s) => s.date));

  /*
   * 同じ体重が続いた長さ。**日付が続いていることも見る。**
   *
   * 記録のある日だけを並べて比べると、1 週間空けて同じ値だった日が「続いた」になる。
   * 0.1kg まで丸めてから比べるのは、日平均が 60.05 のような値になるため。
   */
  let sameWeightRun = 0;
  let run = 0;
  let prev: { date: string; weight: number } | null = null;
  for (const point of recorded) {
    const weight = point.weight == null ? null : Math.round(point.weight * 10);
    if (weight == null) {
      prev = null;
      run = 0;
      continue;
    }
    const continues =
      prev != null && prev.weight === weight && diffDays(point.date, prev.date) === 1;
    run = continues ? run + 1 : 1;
    if (run > sameWeightRun) sameWeightRun = run;
    prev = { date: point.date, weight };
  }

  let roundWeightDays = 0;
  let ampmGapDays = 0;
  for (const point of recorded) {
    for (const slot of [point.am, point.pm]) {
      // 10 の倍数ぴったり。0.1kg 刻みで打つので、整数に直してから見る
      if (slot.weight != null && Math.round(slot.weight * 10) % 100 === 0) roundWeightDays++;
    }
    const { am, pm } = point;
    if (am.weight != null && pm.weight != null && Math.abs(am.weight - pm.weight) >= 1) {
      ampmGapDays++;
    }
  }

  let cardioOnlyDays = 0;
  let bestGroupsInDay = 0;
  let singleExerciseDays = 0;
  const byExercise = new Map<string, number>();
  for (const session of sessions) {
    const { exercises } = session;
    if (exercises.length === 0) continue;
    if (exercises.every((e) => isCardio(e.group))) cardioOnlyDays++;
    if (exercises.length === 1) singleExerciseDays++;
    const groups = sessionGroups(session).length;
    if (groups > bestGroupsInDay) bestGroupsInDay = groups;
    for (const point of exercises) {
      byExercise.set(point.exerciseId, (byExercise.get(point.exerciseId) ?? 0) + 1);
    }
  }

  return {
    weekdaysRecorded: body.weekdays,
    seasonsRecorded: body.seasons,
    monthsRecorded: body.months,
    newYearDays: body.newYear,
    leapDays: body.leap,
    anniversaryDays: body.anniversary,
    sameWeightRun,
    roundWeightDays,
    ampmGapDays,
    bodyReturnGap: longestGap(recorded.map((d) => d.date)),
    trainWeekdays: train.weekdays,
    trainSeasons: train.seasons,
    trainMonths: train.months,
    trainNewYearDays: train.newYear,
    trainLeapDays: train.leap,
    cardioOnlyDays,
    bestGroupsInDay,
    singleExerciseDays,
    topExerciseSessions: Math.max(0, ...byExercise.values()),
    trainReturnGap: longestGap(sessions.map((s) => s.date)),
  };
}
