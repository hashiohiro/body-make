import type {
  DailyPoint,
  Entries,
  Measurement,
  Projection,
  Settings,
  Stats,
  WeekPoint,
} from '../types';
import { addDays, diffDays, isoToTime, startOfWeek, todayISO } from './date';

const MA_WINDOW = 7;
/** ペース推定に使う直近日数。短すぎると水分変動を拾い、長すぎると直近の変化に追随しない */
const PACE_WINDOW = 28;

export const EMPTY_MEASUREMENT: Measurement = { weight: null, bodyFat: null };

export function emptyDay(): { am: Measurement; pm: Measurement } {
  return { am: { ...EMPTY_MEASUREMENT }, pm: { ...EMPTY_MEASUREMENT } };
}

/** 朝夕の平均。片方しか無ければある方をそのまま採用（エクセルの AVERAGE(C,E) と同じ挙動） */
function mean(values: readonly (number | null)[]): number | null {
  const nums = values.filter((v): v is number => v != null && Number.isFinite(v));
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

export function dayAverageWeight(day: { am: Measurement; pm: Measurement }): number | null {
  return mean([day.am.weight, day.pm.weight]);
}

export function dayAverageBodyFat(day: { am: Measurement; pm: Measurement }): number | null {
  return mean([day.am.bodyFat, day.pm.bodyFat]);
}

function slotCount(day: { am: Measurement; pm: Measurement }): 0 | 1 | 2 {
  let n = 0;
  if (day.am.weight != null || day.am.bodyFat != null) n++;
  if (day.pm.weight != null || day.pm.bodyFat != null) n++;
  return n as 0 | 1 | 2;
}

export function hasAnyValue(day: { am: Measurement; pm: Measurement }): boolean {
  return slotCount(day) > 0;
}

/**
 * 記録のある最初の日から「最終記録日 or 今日」までを 1 日も飛ばさずに並べる。
 * 欠測日を明示的に null で持つことで、記録率・ストリーク・移動平均が同じ配列から出せる。
 */
export function buildDaily(entries: Entries): DailyPoint[] {
  const keys = Object.keys(entries)
    .filter((k) => hasAnyValue(entries[k]!))
    .sort();
  if (keys.length === 0) return [];

  const first = keys[0]!;
  const lastRecorded = keys[keys.length - 1]!;
  const today = todayISO();
  const last = lastRecorded > today ? lastRecorded : today;

  const points: DailyPoint[] = [];
  for (let iso = first; iso <= last; iso = addDays(iso, 1)) {
    const entry = entries[iso] ?? emptyDay();
    points.push({
      date: iso,
      time: isoToTime(iso),
      am: entry.am,
      pm: entry.pm,
      weight: dayAverageWeight(entry),
      bodyFat: dayAverageBodyFat(entry),
      maWeight: null,
      maBodyFat: null,
      slots: slotCount(entry),
    });
  }

  /*
   * 後方 7 日窓の移動平均。窓は暦日で切り、欠測日は分母に数えない。
   *
   * 窓の中はその場で足す。以前は日ごとに `slice` して `map` していたが、
   * 1 日あたり配列を 3 つ作ることになり、記録が伸びるほど効いてくる
   * （値を 1 つ打つたびに全期間ぶん走り直すため）。
   * **足す順序は変えていない**ので、出る値は 1 ビットも変わらない。
   */
  for (let i = 0; i < points.length; i++) {
    const from = Math.max(0, i - (MA_WINDOW - 1));
    let sumWeight = 0;
    let countWeight = 0;
    let sumBodyFat = 0;
    let countBodyFat = 0;
    for (let j = from; j <= i; j++) {
      const p = points[j]!;
      if (p.weight != null && Number.isFinite(p.weight)) {
        sumWeight += p.weight;
        countWeight++;
      }
      if (p.bodyFat != null && Number.isFinite(p.bodyFat)) {
        sumBodyFat += p.bodyFat;
        countBodyFat++;
      }
    }
    points[i]!.maWeight = countWeight === 0 ? null : sumWeight / countWeight;
    points[i]!.maBodyFat = countBodyFat === 0 ? null : sumBodyFat / countBodyFat;
  }

  return points;
}

/** 週 = 日曜〜土曜。エクセル「週次分析」シートの D〜J 列と同じ定義で集計する */
export function buildWeeks(daily: DailyPoint[]): WeekPoint[] {
  if (daily.length === 0) return [];

  const firstStart = startOfWeek(daily[0]!.date);
  const lastStart = startOfWeek(daily[daily.length - 1]!.date);
  const byDate = new Map(daily.map((p) => [p.date, p]));

  const weeks: WeekPoint[] = [];
  let index = 0;
  for (let start = firstStart; start <= lastStart; start = addDays(start, 7)) {
    index++;
    const days: DailyPoint[] = [];
    for (let i = 0; i < 7; i++) {
      const p = byDate.get(addDays(start, i));
      if (p) days.push(p);
    }
    const weight = mean(days.map((d) => d.weight));
    const bodyFat = mean(days.map((d) => d.bodyFat));
    const fatMass = weight != null && bodyFat != null ? (weight * bodyFat) / 100 : null;
    const prev = weeks[weeks.length - 1];

    weeks.push({
      start,
      end: addDays(start, 6),
      label: `W${`${index}`.padStart(2, '0')}`,
      time: isoToTime(start),
      weight,
      weightDelta: weight != null && prev?.weight != null ? weight - prev.weight : null,
      bodyFat,
      bodyFatDelta: bodyFat != null && prev?.bodyFat != null ? bodyFat - prev.bodyFat : null,
      fatMass,
      leanMass: weight != null && fatMass != null ? weight - fatMass : null,
      days: days.filter((d) => d.weight != null).length,
    });
  }
  return weeks;
}

/** 最初の n 個の実測値の平均を基準値とする。初日 1 点だけを基準にすると当日の変動に引きずられるため */
function baseline(values: readonly (number | null)[], n = MA_WINDOW): number | null {
  const nums: number[] = [];
  for (const v of values) {
    if (v != null && Number.isFinite(v)) nums.push(v);
    if (nums.length >= n) break;
  }
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
}

function lastNonNull(values: readonly (number | null)[]): number | null {
  for (let i = values.length - 1; i >= 0; i--) {
    const v = values[i];
    if (v != null && Number.isFinite(v)) return v;
  }
  return null;
}

/** 最小二乗法の傾き（kg/日）。x は基準日からの経過日数 */
function slopePerDay(points: readonly { x: number; y: number }[]): number | null {
  if (points.length < 4) return null;
  const n = points.length;
  const mx = points.reduce((a, p) => a + p.x, 0) / n;
  const my = points.reduce((a, p) => a + p.y, 0) / n;
  let num = 0;
  let den = 0;
  for (const p of points) {
    num += (p.x - mx) * (p.y - my);
    den += (p.x - mx) ** 2;
  }
  if (den === 0) return null;
  return num / den;
}

export function computeStats(daily: DailyPoint[], weeks: WeekPoint[], settings: Settings): Stats {
  const empty: Stats = {
    first: null,
    latest: null,
    currentWeight: null,
    currentBodyFat: null,
    currentFatMass: null,
    currentLeanMass: null,
    startWeight: null,
    startBodyFat: null,
    startFatMass: null,
    startLeanMass: null,
    weightDelta: null,
    bodyFatDelta: null,
    fatMassDelta: null,
    leanMassDelta: null,
    bmi: null,
    streak: 0,
    bestStreak: 0,
    recordRate: 0,
    recordedDays: 0,
    fullDays: 0,
    perfectWeeks: 0,
    totalSpanDays: 0,
  };
  if (daily.length === 0) return empty;

  const currentWeight = lastNonNull(daily.map((d) => d.maWeight));
  const currentBodyFat = lastNonNull(daily.map((d) => d.maBodyFat));
  const startWeight = baseline(daily.map((d) => d.weight));
  const startBodyFat = baseline(daily.map((d) => d.bodyFat));

  const compose = (w: number | null, bf: number | null) =>
    w != null && bf != null ? { fat: (w * bf) / 100, lean: w - (w * bf) / 100 } : null;
  const now = compose(currentWeight, currentBodyFat);
  const start = compose(startWeight, startBodyFat);

  // ストリーク: 今日がまだ未記録なら昨日から遡る（朝しか計らない日の途切れを罰しない）
  const today = todayISO();
  const recorded = new Set(daily.filter((d) => d.slots > 0).map((d) => d.date));
  let cursor = recorded.has(today) ? today : addDays(today, -1);
  let streak = 0;
  while (recorded.has(cursor)) {
    streak++;
    cursor = addDays(cursor, -1);
  }

  let bestStreak = 0;
  let run = 0;
  for (const d of daily) {
    run = d.slots > 0 ? run + 1 : 0;
    if (run > bestStreak) bestStreak = run;
  }

  const windowStart = addDays(today, -29);
  const recent = daily.filter((d) => d.date >= windowStart && d.date <= today);
  const recordRate = recent.length ? recent.filter((d) => d.slots > 0).length / recent.length : 0;

  const bmi =
    settings.heightCm && currentWeight ? currentWeight / (settings.heightCm / 100) ** 2 : null;

  return {
    first: daily[0] ?? null,
    latest: daily[daily.length - 1] ?? null,
    currentWeight,
    currentBodyFat,
    currentFatMass: now?.fat ?? null,
    currentLeanMass: now?.lean ?? null,
    startWeight,
    startBodyFat,
    startFatMass: start?.fat ?? null,
    startLeanMass: start?.lean ?? null,
    weightDelta: currentWeight != null && startWeight != null ? currentWeight - startWeight : null,
    bodyFatDelta:
      currentBodyFat != null && startBodyFat != null ? currentBodyFat - startBodyFat : null,
    fatMassDelta: now && start ? now.fat - start.fat : null,
    leanMassDelta: now && start ? now.lean - start.lean : null,
    bmi,
    streak,
    bestStreak,
    recordRate,
    recordedDays: recorded.size,
    fullDays: daily.filter((d) => d.am.weight != null && d.pm.weight != null).length,
    perfectWeeks: weeks.filter((w) => w.days === 7).length,
    totalSpanDays: daily.length,
  };
}

export function computeProjection(
  daily: DailyPoint[],
  stats: Stats,
  settings: Settings,
): Projection {
  const none: Projection = {
    pacePerWeek: null,
    etaDate: null,
    etaDays: null,
    progress: null,
    requiredPerWeek: null,
  };
  if (daily.length === 0) return none;

  const today = todayISO();
  const from = addDays(today, -(PACE_WINDOW - 1));
  const sample = daily
    .filter((d) => d.date >= from && d.weight != null)
    .map((d) => ({ x: diffDays(d.date, from), y: d.weight! }));

  const perDay = slopePerDay(sample);
  const pacePerWeek = perDay == null ? null : perDay * 7;

  const target = settings.targetWeight;
  const current = stats.currentWeight;
  const startWeight = stats.startWeight;

  let progress: number | null = null;
  if (target != null && current != null && startWeight != null && startWeight !== target) {
    progress = Math.min(1, Math.max(0, (startWeight - current) / (startWeight - target)));
  }

  let etaDays: number | null = null;
  let etaDate: string | null = null;
  if (target != null && current != null && perDay != null && Math.abs(perDay) > 1e-4) {
    const days = (target - current) / perDay;
    // 進行方向が目標と逆、または 3 年超は「予測不能」として出さない
    if (days > 0 && days <= 365 * 3) {
      etaDays = days;
      etaDate = addDays(today, Math.ceil(days));
    }
  }

  let requiredPerWeek: number | null = null;
  if (target != null && current != null && settings.targetDate) {
    const remainingDays = diffDays(settings.targetDate, today);
    if (remainingDays > 0) requiredPerWeek = ((target - current) / remainingDays) * 7;
  }

  return { pacePerWeek, etaDate, etaDays, progress, requiredPerWeek };
}
