import type {
  DailyPoint,
  Exercise,
  ExercisePoint,
  GoalType,
  MuscleGroup,
  SessionExercise,
  SessionPoint,
  SetPoint,
  SetRole,
  WorkSet,
  Workouts,
} from '../types';
import { addDays, diffDays, formatMD, isoToTime, startOfWeek, todayISO } from './date';

/** 高レップほど外挿が大きく誤差が増えるため、12 レップを超えたセットは 1RM に採らない */
export const E1RM_MAX_REPS = 12;

/** 1RM 換算の分母の既定値（Epley） */
export const DEFAULT_RM_DIVISOR = 30;

/** 開始値を出すのに必要なセッション数。初回 1 点だと当日の調子が以後すべての差分に乗る */
export const BASELINE_SESSIONS = 3;

/* ------------------------------------------------------------------ *
 * 体重の引き当て
 * ------------------------------------------------------------------ */

export interface BodyWeightLookup {
  (date: string): number | null;
}

/**
 * 自重種目と相対筋力に使う体重。
 * その日の日平均 → その日の 7 日移動平均 → 直近過去の値、の順に落とす。
 * 「直近過去」まで許すのは、体重を毎日測らない日にトレーニングした記録を落とさないため。
 * 一度も体重を記録していない期間は null のままにする（推測した値を指標にしない）。
 */
export function buildBodyWeightLookup(daily: readonly DailyPoint[]): BodyWeightLookup {
  const points = daily
    .map((d) => ({ date: d.date, value: d.weight ?? d.maWeight }))
    .filter((p): p is { date: string; value: number } => p.value != null);

  return (date) => {
    let found: number | null = null;
    for (const p of points) {
      if (p.date > date) break;
      found = p.value;
    }
    return found;
  };
}

/* ------------------------------------------------------------------ *
 * セット単位の計算
 * ------------------------------------------------------------------ */

/**
 * perSide と loadType を解決した「実際に挙げた重量」。
 *
 * 自重種目で weight が空でも成立する（懸垂を加重なしでやる場合が普通なので）。
 * 逆に external で weight が空なら負荷が決まらないため null。
 */
export function effectiveWeight(
  exercise: Pick<Exercise, 'loadMode' | 'bodyweightFactor'>,
  set: Pick<WorkSet, 'weight'>,
  bodyWeight: number | null,
): number | null {
  switch (exercise.loadMode) {
    case 'standard':
      return set.weight;
    // 左右に 1 つずつ持つ種目。ダンベル 20kg×2 を バーベル 40kg として計上する
    case 'perSide':
      return set.weight == null ? null : set.weight * 2;
    case 'bodyweight': {
      if (bodyWeight == null) return null;
      return bodyWeight * (exercise.bodyweightFactor ?? 1) + (set.weight ?? 0);
    }
  }
}

/**
 * 推定 1RM。reps = 1 は実測なので Epley を通さない
 * （通すと w × (1 + 1/30) = 1.033w となり 3.3% 過大評価する）。
 *
 * Epley は特定の種目・集団の実測に当てはめた経験式で、
 * 「何レップできるか」と「1RM の何%か」の関係は種目でも個人でも変わる。
 * したがってこの値は **同じ種目の推移を見るための換算値** であって、
 * 実際に 1 回挙げられる重量の予測ではない。種目をまたいで比べる意味もない。
 */
export function estimateOneRm(
  weight: number | null,
  reps: number | null,
  divisor: number = DEFAULT_RM_DIVISOR,
): number | null {
  if (weight == null || reps == null) return null;
  if (reps < 1 || reps > E1RM_MAX_REPS) return null;
  if (reps === 1) return weight;
  return weight * (1 + reps / divisor);
}

/**
 * 最大重量のセットを 1 つに確定させる。同率ならレップ最大、それも同率なら最初。
 * ストレートセット（60×10, 60×10, 60×11）では 3 セットとも最大重量に該当するため、
 * 順序規則がないと「トップセット」を参照する画面が壊れる。
 */
function pickTop(weights: readonly (number | null)[], reps: readonly (number | null)[]): number {
  let best = -1;
  for (let i = 0; i < weights.length; i++) {
    const w = weights[i];
    const r = reps[i];
    if (w == null || r == null) continue;
    if (best < 0) {
      best = i;
      continue;
    }
    const bw = weights[best]!;
    const br = reps[best]!;
    if (w > bw || (w === bw && r > br)) best = i;
  }
  return best;
}

export interface ResolvedSets {
  roles: SetRole[];
  effective: (number | null)[];
  /** トップセットの index。無ければ -1 */
  topIndex: number;
}

/**
 * トップセット（そのセッション・その種目の最大重量）を 1 つに確定させるだけ。
 *
 * ウォームアップの判定は持たない。数えたくないセットは書かなければいいだけで、
 * 書いたものはすべて実績として数える。並びから「これはウォームアップだろう」と
 * 推測して集計から外すのは、ユーザーが入れていない判断をアプリが足すことになる。
 */
export function resolveSets(
  exercise: Pick<Exercise, 'loadMode' | 'bodyweightFactor'>,
  sets: readonly WorkSet[],
  bodyWeight: number | null,
): ResolvedSets {
  const effective = sets.map((s) => effectiveWeight(exercise, s, bodyWeight));
  const topIndex = pickTop(
    effective,
    sets.map((s) => s.reps),
  );
  const roles: SetRole[] = sets.map((_, i) => (i === topIndex ? 'top' : 'work'));
  return { roles, effective, topIndex };
}

/* ------------------------------------------------------------------ *
 * 種目・セッション単位の集計
 * ------------------------------------------------------------------ */

export function buildExercisePoint(
  exercise: Exercise,
  entry: SessionExercise,
  bodyWeight: number | null,
): ExercisePoint {
  const { roles, effective, topIndex } = resolveSets(exercise, entry.sets, bodyWeight);

  const sets: SetPoint[] = entry.sets.map((set, i) => {
    const ew = effective[i]!;
    // 挙上量は「重量 × レップ数」なので、秒で数える種目は計上しない。
    // 欠測セットも 0 として数えず、母数から外す
    const counted = ew != null && set.reps != null && exercise.repUnit === 'reps';
    return {
      index: i,
      weight: set.weight,
      reps: set.reps,
      role: roles[i]!,
      counted,
      effectiveWeight: ew,
      volume: counted ? ew * set.reps! : null,
    };
  });

  let volume = 0;
  let workSets = 0;
  let reps = 0;
  let maxReps: number | null = null;

  for (const s of sets) {
    if (s.reps != null && (maxReps == null || s.reps > maxReps)) maxReps = s.reps;
    // 挙上量に計上しない種目でも「やったセット」には数える（部位別セット数に出すため）
    workSets++;
    if (s.volume != null) volume += s.volume;
    if (s.reps != null) reps += s.reps;
  }

  const top = topIndex >= 0 ? sets[topIndex]! : null;

  /*
   * 1RM は「全セットの最大」ではなく **トップセットから** 換算する。
   *
   * 全セットの最大を採ると、セットを多くやった日ほど高い値が出やすい
   * （ノイズを含む推定を N 個並べて最大を取るので、N が増えるほど上振れする）。
   * セット数はその日の予定で変わるため、推移を読むときの系統誤差になる。
   * トップセットに固定すれば、値の出どころが 1 セットに定まり、
   * たいていの場合レップ数も最小なので外挿も小さくなる。
   */
  const oneRm = top?.counted
    ? estimateOneRm(top.effectiveWeight, top.reps, exercise.rmDivisor)
    : null;
  const measured = oneRm != null && top?.reps === 1;
  // 挙上量が出せない種目（プランクなど）は最大レップ数を主指標にする
  const metric = volume > 0 ? volume : maxReps;

  return {
    exerciseId: exercise.id,
    name: exercise.name,
    group: exercise.group,
    groups: [exercise.group, ...exercise.subGroups.map((sub) => sub.group)],
    subGroups: exercise.subGroups,
    repUnit: exercise.repUnit,
    sets,
    top,
    volume,
    workSets,
    reps,
    oneRm,
    measured,
    maxReps,
    metric,
  };
}

export function buildSessions(
  workouts: Workouts,
  exercises: readonly Exercise[],
  daily: readonly DailyPoint[],
): SessionPoint[] {
  const byId = new Map(exercises.map((e) => [e.id, e]));
  const bodyWeightAt = buildBodyWeightLookup(daily);

  return Object.keys(workouts)
    .sort()
    .map((date) => {
      const bodyWeight = bodyWeightAt(date);
      const points = (workouts[date] ?? [])
        .map((entry) => {
          const exercise = byId.get(entry.exerciseId);
          return exercise ? buildExercisePoint(exercise, entry, bodyWeight) : null;
        })
        .filter((p): p is ExercisePoint => p !== null);

      return { date, time: isoToTime(date), exercises: points };
    })
    .filter((s) => s.exercises.length > 0);
}

/* ------------------------------------------------------------------ *
 * 種目ごとの履歴
 * ------------------------------------------------------------------ */

export interface ExerciseHistoryPoint {
  date: string;
  time: number;
  point: ExercisePoint;
}

export function exerciseHistory(
  sessions: readonly SessionPoint[],
  exerciseId: string,
): ExerciseHistoryPoint[] {
  const out: ExerciseHistoryPoint[] = [];
  for (const s of sessions) {
    const point = s.exercises.find((e) => e.exerciseId === exerciseId);
    if (point) out.push({ date: s.date, time: s.time, point });
  }
  return out;
}

/** 対象日より前の直近セッション。後日入力で未来の記録を参照しないよう、必ず < で切る */
export function previousPoint(
  sessions: readonly SessionPoint[],
  exerciseId: string,
  date: string,
): ExerciseHistoryPoint | null {
  const history = exerciseHistory(sessions, exerciseId);
  for (let i = history.length - 1; i >= 0; i--) {
    const h = history[i]!;
    if (h.date < date) return h;
  }
  return null;
}

/**
 * 種目の開始値。最初の 3 セッションの主指標の平均で、それ未満なら出さない。
 * 体重側が「最初の 7 日の平均」を開始値にしているのと同じ理由
 * （初回 1 点にすると、その日の調子が以後すべての差分に乗り続ける）。
 */
export function exerciseBaseline(
  sessions: readonly SessionPoint[],
  exerciseId: string,
): number | null {
  const values = exerciseHistory(sessions, exerciseId)
    .map((h) => h.point.metric)
    .filter((v): v is number => v != null);
  if (values.length < BASELINE_SESSIONS) return null;
  const head = values.slice(0, BASELINE_SESSIONS);
  return head.reduce((a, b) => a + b, 0) / head.length;
}

/** その日までの自己最高。保存せず毎回引き直す（設定を変えたら物差しごと変わる） */
export function personalBest(
  sessions: readonly SessionPoint[],
  exerciseId: string,
  date: string,
  pick: (p: ExercisePoint) => number | null,
): number | null {
  let best: number | null = null;
  for (const h of exerciseHistory(sessions, exerciseId)) {
    if (h.date > date) break;
    const v = pick(h.point);
    if (v != null && (best == null || v > best)) best = v;
  }
  return best;
}

export const pickOneRm = (p: ExercisePoint) => p.oneRm;
export const pickVolume = (p: ExercisePoint) => (p.volume > 0 ? p.volume : null);
export const pickMetric = (p: ExercisePoint) => p.metric;

/* ------------------------------------------------------------------ *
 * 表示用
 * ------------------------------------------------------------------ */

/** 「60kg×10,10,9」形式。同じ重量が続く間はまとめる。重量のない種目は「60,60秒」 */
export function summarizeSets(point: ExercisePoint): string {
  const unit = point.repUnit === 'seconds' ? '秒' : '';
  const work = point.sets.filter((s) => s.reps != null);
  if (work.length === 0) return '—';

  const groups: { weight: number | null; reps: number[] }[] = [];
  for (const s of work) {
    const last = groups[groups.length - 1];
    if (last && last.weight === s.weight) last.reps.push(s.reps!);
    else groups.push({ weight: s.weight, reps: [s.reps!] });
  }
  return groups
    .map((g) => `${g.weight == null ? '' : `${g.weight}kg×`}${g.reps.join(',')}${unit}`)
    .join(' / ');
}

/* ------------------------------------------------------------------ *
 * 週次の配分（部位別セット数）
 * ------------------------------------------------------------------ */

/**
 * セット数は補助部位の係数ぶんで端数が出る。
 * 小数第 2 位まで（係数の刻みが 0.25 なので）出し、末尾の 0 は付けない
 */
export function formatSets(sets: number): string {
  return String(Math.round(sets * 100) / 100);
}

export interface WeekSetCount {
  /** 週開始日（日曜）。体組成側の buildWeeks と同じ区切り */
  start: string;
  label: string;
  setsByGroup: Record<MuscleGroup, number>;
  volumeByGroup: Record<MuscleGroup, number>;
  totalSets: number;
  /** その週にトレーニングした日数 */
  days: number;
}

const EMPTY_GROUPS: Record<MuscleGroup, number> = {
  chest: 0,
  back: 0,
  legs: 0,
  shoulders: 0,
  arms: 0,
  core: 0,
};

/**
 * 週ごとの配分。セット数と挙上量の両方を出す。
 *
 * 部位をまたいで比べるならセット数（挙上量は重量に比例するので脚と背中が支配する）。
 * 挙上量のほうは、行ごとに正規化して同じ部位の週次推移として読む前提でだけ意味を持つ。
 */
export function buildWeeklySets(sessions: readonly SessionPoint[], from: string): WeekSetCount[] {
  const target = sessions.filter((s) => s.date >= from);
  if (target.length === 0) return [];

  const first = startOfWeek(target[0]!.date);
  const last = startOfWeek(target[target.length - 1]!.date);

  const weeks: WeekSetCount[] = [];
  for (let start = first; start <= last; start = addDays(start, 7)) {
    const end = addDays(start, 6);
    const inWeek = target.filter((s) => s.date >= start && s.date <= end);
    const setsByGroup = { ...EMPTY_GROUPS };
    const volumeByGroup = { ...EMPTY_GROUPS };
    for (const session of inWeek) {
      for (const point of session.exercises) {
        // 主部位は 1 セット、補助部位は種目ごとの係数（既定 0.5）ぶん
        setsByGroup[point.group] += point.workSets;
        volumeByGroup[point.group] += point.volume;
        for (const sub of point.subGroups) {
          setsByGroup[sub.group] += point.workSets * sub.weight;
          volumeByGroup[sub.group] += point.volume * sub.weight;
        }
      }
    }
    // 係数を足し上げると 1.2000000000000002 のような値になる。
    // セット数は 0.25 刻みを潰さないよう小数第 2 位まで残す
    for (const group of ALL_GROUPS) {
      setsByGroup[group] = Math.round(setsByGroup[group] * 100) / 100;
      volumeByGroup[group] = Math.round(volumeByGroup[group] * 10) / 10;
    }
    weeks.push({
      start,
      label: formatMD(start),
      setsByGroup,
      volumeByGroup,
      totalSets: Math.round(Object.values(setsByGroup).reduce((a, b) => a + b, 0) * 100) / 100,
      days: inWeek.length,
    });
  }
  return weeks;
}

/* ------------------------------------------------------------------ *
 * 停滞の提示
 * ------------------------------------------------------------------ */

export interface Plateau {
  weight: number;
  weeks: number;
  sessions: number;
}

/**
 * トップセットの重量が変わっていない期間。解釈ではなく事実として出す。
 * 判断材料としては最も価値が高いが、こちらから「上げるべき」とは言わない。
 */
export function plateau(history: readonly ExerciseHistoryPoint[]): Plateau | null {
  const latest = history[history.length - 1];
  const weight = latest?.point.top?.weight;
  if (latest == null || weight == null) return null;

  let i = history.length - 1;
  while (i > 0 && history[i - 1]!.point.top?.weight === weight) i--;

  const sessions = history.length - i;
  const weeks = Math.floor(diffDays(latest.date, history[i]!.date) / 7);
  if (weeks < 2 || sessions < 2) return null;
  return { weight, weeks, sessions };
}

/* ------------------------------------------------------------------ *
 * 継続の集計（バッジとホームのタイル用）
 * ------------------------------------------------------------------ */

/** 更新・停滞を見る窓 */
export const RECENT_DAYS = 28;
export const STALE_WEEKS = 4;

/**
 * 「伸びたか」を見る値。強さ寄りの指標を使う。
 *
 * 主指標（挙上量）で判定すると、セットを 1 つ足すだけで自己最高が出てしまい、
 * ジャンクボリュームを更新として数えることになる。目標の判定と同じ土俵にそろえる。
 */
const strengthOf = (p: ExercisePoint) => p.top?.weight ?? p.maxReps;

export interface TrainingStats {
  /** 通算セッション数 */
  sessions: number;
  /** 最初にトレーニングした日 */
  firstDate: string | null;
  /** 週あたりの実施日数の平均。続いているかの目安 */
  weeklyAverage: number | null;
  /** 部位ごとの最終実施からの日数。null は記録なし */
  daysSinceGroup: Record<MuscleGroup, number | null>;
  /** 今週の部位別セット数。0 の部位は daysSinceGroup で「何日空いているか」を見る */
  thisWeekSetsByGroup: Record<MuscleGroup, number>;
  /** 直近 RECENT_DAYS 日に自己最高を更新した種目数 */
  recentBests: number;
  /** STALE_WEEKS 週以上、トップセットの重量が動いていない種目数 */
  stalled: number;
  /** 週 2 回以上が続いた最長週数 */
  bestWeeklyStreak: number;
  /** 6 部位すべてを回した週の数 */
  fullBodyWeeks: number;
  thisWeekDays: number;
  lastWeekDays: number;
}

const ALL_GROUPS = Object.keys(EMPTY_GROUPS) as MuscleGroup[];

/**
 * その部位を「やった」とみなす下限。1 セット相当。
 *
 * 補助部位に含まれるかどうかで見ると、係数 0.25 の部位まで「やった」になる。
 * サイドレイズとフロントレイズだけやった日が「胸・背中・肩」と出て、
 * 胸と背中の空き日数もその日でリセットされてしまう。
 */
export const TRAINED_SETS = 1;

/** そのセッションで 1 セット相当以上を積んだ部位。表示順に返す */
export function sessionGroups(session: SessionPoint): MuscleGroup[] {
  const totals = { ...EMPTY_GROUPS };
  for (const point of session.exercises) {
    totals[point.group] += point.workSets;
    for (const sub of point.subGroups) totals[sub.group] += point.workSets * sub.weight;
  }
  return ALL_GROUPS.filter((g) => Math.round(totals[g] * 100) / 100 >= TRAINED_SETS);
}

/**
 * 数えるのは「行為の事実」だけで、成果は数えない。
 * 成果を閾値表示すると褒めることになり、それは種目ごとの推移が担当する（設計 §6.3）。
 */
export function computeTrainingStats(sessions: readonly SessionPoint[]): TrainingStats {
  const noGroups = Object.fromEntries(ALL_GROUPS.map((g) => [g, null])) as Record<
    MuscleGroup,
    number | null
  >;

  const empty: TrainingStats = {
    sessions: 0,
    firstDate: null,
    weeklyAverage: null,
    daysSinceGroup: noGroups,
    thisWeekSetsByGroup: { ...EMPTY_GROUPS },
    recentBests: 0,
    stalled: 0,
    bestWeeklyStreak: 0,
    fullBodyWeeks: 0,
    thisWeekDays: 0,
    lastWeekDays: 0,
  };
  if (sessions.length === 0) return empty;

  const weeks = buildWeeklySets(sessions, sessions[0]!.date);

  let best = 0;
  let run = 0;
  let fullBodyWeeks = 0;
  for (const week of weeks) {
    run = week.days >= 2 ? run + 1 : 0;
    if (run > best) best = run;
    if (ALL_GROUPS.every((g) => week.setsByGroup[g] >= TRAINED_SETS)) fullBodyWeeks++;
  }

  // 部位ごとの最終実施日。偏りは「合計」ではなく「触ったかどうか」でしか見えない
  const today = todayISO();
  const lastByGroup = new Map<MuscleGroup, string>();
  for (const session of sessions) {
    for (const group of sessionGroups(session)) lastByGroup.set(group, session.date);
  }
  const daysSinceGroup = Object.fromEntries(
    ALL_GROUPS.map((g) => {
      const last = lastByGroup.get(g);
      return [g, last == null ? null : diffDays(today, last)];
    }),
  ) as Record<MuscleGroup, number | null>;

  // 種目ごとに「最近伸びたか」「止まっているか」を数える。
  // 数えるのはイベントの件数なので、種目をまたいでも合計が壊れない（量を足すのとは違う）
  let recentBests = 0;
  let stalled = 0;
  const exerciseIds = new Set(sessions.flatMap((s) => s.exercises.map((e) => e.exerciseId)));

  for (const id of exerciseIds) {
    const history = exerciseHistory(sessions, id);
    // 1 回しかやっていない種目は必ず「自己最高」になるので数えない
    if (history.length < 2) continue;
    // やめた種目は「止まっている」でも「伸びた」でもないので、直近の記録があるものだけ見る
    if (diffDays(today, history[history.length - 1]!.date) >= RECENT_DAYS) continue;

    const values = history
      .map((h) => ({ date: h.date, value: strengthOf(h.point) }))
      .filter((x): x is { date: string; value: number } => x.value != null);

    // 「更新」は窓の外の自己最高を超えたときだけ。
    // 単に「最高を出した日が最近」だと、始めたばかりの種目や横ばいの種目まで数えてしまう
    const before = values.filter((x) => diffDays(today, x.date) >= RECENT_DAYS);
    const within = values.filter((x) => diffDays(today, x.date) < RECENT_DAYS);
    if (before.length > 0 && within.length > 0) {
      const bestBefore = Math.max(...before.map((x) => x.value));
      const bestWithin = Math.max(...within.map((x) => x.value));
      if (bestWithin > bestBefore) recentBests++;
    }

    const stall = plateau(history);
    if (stall && stall.weeks >= STALE_WEEKS) stalled++;
  }

  const thisStart = startOfWeek(todayISO());
  const lastStart = addDays(thisStart, -7);
  const weekOf = (start: string) => weeks.find((w) => w.start === start);

  const firstDate = sessions[0]!.date;
  const elapsedWeeks = Math.max(1, (diffDays(today, firstDate) + 1) / 7);

  return {
    sessions: sessions.length,
    firstDate,
    weeklyAverage: sessions.length / elapsedWeeks,
    daysSinceGroup,
    thisWeekSetsByGroup: weekOf(thisStart)?.setsByGroup ?? { ...EMPTY_GROUPS },
    recentBests,
    stalled,
    bestWeeklyStreak: best,
    fullBodyWeeks,
    thisWeekDays: weekOf(thisStart)?.days ?? 0,
    lastWeekDays: weekOf(lastStart)?.days ?? 0,
  };
}

/* ------------------------------------------------------------------ *
 * 種目の目標
 * ------------------------------------------------------------------ */

export interface ExerciseGoal {
  exerciseId: string;
  name: string;
  group: MuscleGroup;
  type: GoalType;
  unit: string;
  digits: number;
  target: number;
  current: number | null;
  /** 最初の 3 セッションの平均 */
  baseline: number | null;
  delta: number | null;
  /** 0〜1。開始値 → 目標 の到達率 */
  progress: number | null;
  reached: boolean;
}

/**
 * 目標の現在地。
 *
 * 重量目標は **記録した重量のうち最大のもの**で測る。
 * 打った数字と同じ土俵にしないと、ダンベルカールに「30kg」と入れたとき
 * 有効重量（片手30kg×2=60）と比べることになり、いつまでも到達しない。
 *
 * 推定1RM でも測らない。換算値なので「100kg 挙げたい」に対して
 * 換算値が 100 を超えたから達成、では嘘になる。
 *
 * 回数目標はそのセッションの最大レップ数（自重種目・時間種目で使う）。
 */
const currentOf = (type: GoalType, p: ExercisePoint) =>
  type === 'weight' ? (p.top?.weight ?? null) : p.maxReps;

export function exerciseGoals(
  sessions: readonly SessionPoint[],
  exercises: readonly Exercise[],
): ExerciseGoal[] {
  const goals: ExerciseGoal[] = [];

  for (const exercise of exercises) {
    const goal = exercise.goal;
    if (goal == null) continue;

    const history = exerciseHistory(sessions, exercise.id);
    const values = history
      .map((h) => currentOf(goal.type, h.point))
      .filter((v): v is number => v != null);

    const current = values.length ? values[values.length - 1]! : null;
    const baseline =
      values.length >= BASELINE_SESSIONS
        ? values.slice(0, BASELINE_SESSIONS).reduce((a, b) => a + b, 0) / BASELINE_SESSIONS
        : null;

    const progress =
      current != null && baseline != null && goal.value !== baseline
        ? Math.min(1, Math.max(0, (current - baseline) / (goal.value - baseline)))
        : null;

    goals.push({
      exerciseId: exercise.id,
      name: exercise.name,
      group: exercise.group,
      type: goal.type,
      unit: goal.type === 'weight' ? 'kg' : exercise.repUnit === 'seconds' ? '秒' : '回',
      digits: goal.type === 'weight' ? 1 : 0,
      target: goal.value,
      current,
      baseline,
      delta: current != null && baseline != null ? current - baseline : null,
      progress,
      reached: current != null && current >= goal.value,
    });
  }

  return goals.sort((a, b) => (b.progress ?? 0) - (a.progress ?? 0));
}
