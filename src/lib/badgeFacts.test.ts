import { describe, expect, it } from 'vitest';
import { EMPTY_BADGE_FACTS, computeBadgeFacts } from './badgeFacts';
import { computeBadges } from './badges';
import { buildDaily, buildWeeks, computeStats } from './derive';
import { CATALOG, fromCatalog } from './exerciseCatalog';
import { DEFAULT_SETTINGS } from './storage';
import { buildSessions, computeTrainingStats } from './training';
import type { Entries, Measurement, Workouts } from '../types';

/* ---------------- helpers ---------------- */

const blank: Measurement = { weight: null, bodyFat: null, waist: null };

/** 朝（と夜）に体重だけ打った日を並べる */
function entriesOf(rows: Record<string, number | [number, number]>): Entries {
  const out: Entries = {};
  for (const [date, value] of Object.entries(rows)) {
    const [am, pm] = Array.isArray(value) ? value : [value, null];
    out[date] = {
      am: { ...blank, weight: am },
      pm: { ...blank, weight: pm },
    };
  }
  return out;
}

const bench = fromCatalog(
  CATALOG.find((c) => c.id === 'ex_bench')!,
  0,
);
const squat = fromCatalog(
  CATALOG.find((c) => c.id === 'ex_squat')!,
  1,
);
const running = fromCatalog(
  CATALOG.find((c) => c.group === 'cardio')!,
  2,
);
const EXERCISES = [bench, squat, running];

function factsOf(rows: Record<string, number | [number, number]>, workouts: Workouts = {}) {
  const daily = buildDaily(entriesOf(rows));
  return computeBadgeFacts(daily, buildSessions(workouts, EXERCISES, daily));
}

const lift = (id: string) => ({ exerciseId: id, sets: [{ weight: 60, reps: 10 }] });
const run = () => ({ exerciseId: running.id, sets: [{ meters: 3000, seconds: 1200 }] });

/*
 * 伏せてある実績（`Badge.hidden`）が見る小ネタ。
 *
 * 数えるのは日付と値と行為の形だけ。**時刻は持っていない**ので、
 * 「深夜に記録した」のような条件は作れない（`badges.ts` の注記）。
 */
describe('伏せてある実績の材料', () => {
  it('曜日・季節・月を埋めた度合いを数える', () => {
    // 2026-03-01 は日曜。7 日並べれば全曜日が埋まる
    const week = factsOf(
      Object.fromEntries(Array.from({ length: 7 }, (_, i) => [`2026-03-0${i + 1}`, 60 + i * 0.1])),
    );
    expect(week.weekdaysRecorded).toBe(7);
    // 3 月だけなので春の 1 季、1 か月
    expect(week.seasonsRecorded).toBe(1);
    expect(week.monthsRecorded).toBe(1);

    // 季節は 12 月を冬の頭に折り返す（12・1・2 が同じ季節）
    const seasons = factsOf({
      '2026-03-01': 60,
      '2026-07-01': 60,
      '2026-10-01': 60,
      '2026-12-01': 60,
    });
    expect(seasons.seasonsRecorded).toBe(4);
    expect(factsOf({ '2026-12-01': 60, '2027-01-01': 60, '2027-02-01': 60 }).seasonsRecorded).toBe(
      1,
    );
  });

  it('元日とうるう日を拾う', () => {
    expect(factsOf({ '2027-01-01': 60 }).newYearDays).toBe(1);
    expect(factsOf({ '2026-01-02': 60 }).newYearDays).toBe(0);
    // 2028 はうるう年
    expect(factsOf({ '2028-02-29': 60 }).leapDays).toBe(1);
    expect(factsOf({ '2028-02-28': 60 }).leapDays).toBe(0);
  });

  it('最初の記録と同じ月日に、別の年も記録したら数える', () => {
    expect(factsOf({ '2026-03-01': 60, '2027-03-01': 60 }).anniversaryDays).toBe(1);
    // 同じ年の同じ日は 1 件しかないので、初回だけでは立たない
    expect(factsOf({ '2026-03-01': 60, '2026-03-02': 60 }).anniversaryDays).toBe(0);
  });

  it('同じ体重が続いた長さは、日付も続いていることを見る', () => {
    expect(factsOf({ '2026-03-01': 60, '2026-03-02': 60, '2026-03-03': 60 }).sameWeightRun).toBe(3);
    // 1 日空けて同じ値でも「続いた」にはしない
    expect(factsOf({ '2026-03-01': 60, '2026-03-03': 60 }).sameWeightRun).toBe(1);
    expect(factsOf({ '2026-03-01': 60, '2026-03-02': 60.1, '2026-03-03': 60 }).sameWeightRun).toBe(
      1,
    );
  });

  it('10 の倍数ちょうどと、朝夜の開きを拾う', () => {
    expect(factsOf({ '2026-03-01': 60 }).roundWeightDays).toBe(1);
    expect(factsOf({ '2026-03-01': 60.1 }).roundWeightDays).toBe(0);
    expect(factsOf({ '2026-03-01': 65 }).roundWeightDays).toBe(0);

    expect(factsOf({ '2026-03-01': [61, 62.5] }).ampmGapDays).toBe(1);
    expect(factsOf({ '2026-03-01': [61, 61.5] }).ampmGapDays).toBe(0);
    // 片方しか打っていない日は比べられない
    expect(factsOf({ '2026-03-01': 61 }).ampmGapDays).toBe(0);
  });

  it('空けてから戻ってきた空白だけを数える（いま空いているぶんは数えない）', () => {
    // 記録と記録のあいだが 40 日
    expect(factsOf({ '2026-03-01': 60, '2026-04-10': 60 }).bodyReturnGap).toBe(40);
    // 1 件しかなければ、まだ戻ってきていない
    expect(factsOf({ '2026-03-01': 60 }).bodyReturnGap).toBe(0);
  });

  it('トレーニング側も、暦と空白を別に数える', () => {
    const f = factsOf({}, { '2026-03-01': [lift(bench.id)], '2026-04-10': [lift(bench.id)] });
    expect(f.trainWeekdays).toBe(2);
    expect(f.trainMonths).toBe(2);
    expect(f.trainReturnGap).toBe(40);
    // 体組成の記録は 1 件も無いので、そちらは 0 のまま
    expect(f.weekdaysRecorded).toBe(0);
    expect(f.bodyReturnGap).toBe(0);
  });

  it('行為の形（有酸素だけ・1種目だけ・部位数・いちばんやった種目）', () => {
    const f = factsOf(
      {},
      {
        '2026-03-01': [run()],
        '2026-03-02': [lift(bench.id)],
        '2026-03-03': [lift(bench.id), lift(squat.id), run()],
      },
    );
    // 走っただけの日は 1 日（3/3 は筋トレも入っている）
    expect(f.cardioOnlyDays).toBe(1);
    // 1 種目だけの日は 2 日（3/1 と 3/2）
    expect(f.singleExerciseDays).toBe(2);
    // ベンチは 2 日、スクワットは 1 日
    expect(f.topExerciseSessions).toBe(2);
    // スクワットは脚が主で体幹などに補助が付くので、いちばん多い日の部位数は 2 以上
    expect(f.bestGroupsInDay).toBeGreaterThanOrEqual(2);
  });

  it('記録が無ければ、すべて 0', () => {
    expect(factsOf({})).toEqual(EMPTY_BADGE_FACTS);
  });
});

/*
 * 伏せてあるあいだは、**名前も条件も進捗も渡さない。**
 * 「いま 6 / 7」が出れば、名前を隠しても何を数えているかは読める。
 */
describe('伏せてある実績の出し方', () => {
  const badgesOf = (rows: Record<string, number | [number, number]>, workouts: Workouts = {}) => {
    const daily = buildDaily(entriesOf(rows));
    const sessions = buildSessions(workouts, EXERCISES, daily);
    const stats = computeStats(daily, buildWeeks(daily), DEFAULT_SETTINGS);
    return computeBadges(
      stats,
      computeTrainingStats(sessions),
      {},
      computeBadgeFacts(daily, sessions),
    );
  };

  it('解除前は値も閾値も持たず、進捗も 0', () => {
    // 6 日ぶん。全曜日（7）まであと 1 日
    const almost = badgesOf(
      Object.fromEntries(Array.from({ length: 6 }, (_, i) => [`2026-03-0${i + 1}`, 60 + i * 0.1])),
    );
    const weekdays = almost.find((b) => b.id === 'hid-weekdays')!;
    expect(weekdays.earned).toBe(false);
    expect(weekdays.value).toBeUndefined();
    expect(weekdays.goal).toBeUndefined();
    expect(weekdays.progress).toBe(0);
  });

  it('解除すると、ふつうのバッジとして値まで出る', () => {
    const week = badgesOf(
      Object.fromEntries(Array.from({ length: 7 }, (_, i) => [`2026-03-0${i + 1}`, 60 + i * 0.1])),
    );
    const weekdays = week.find((b) => b.id === 'hid-weekdays')!;
    expect(weekdays.earned).toBe(true);
    expect(weekdays.value).toBe(7);
    expect(weekdays.goal).toBe(7);
  });

  it('未解除の並びでは、伏せてあるものが後ろに回る', () => {
    const locked = badgesOf({ '2026-03-01': 60.1 }).filter((b) => !b.earned);
    const firstHidden = locked.findIndex((b) => b.hidden);
    const lastOpen = locked.reduce((at, b, i) => (b.hidden ? at : i), -1);
    expect(firstHidden).toBeGreaterThan(lastOpen);
  });
});
