import type { CheckSettings, Exercise, MuscleGroup, SessionExercise, SessionPoint } from '../types';
import { GROUP_LABELS, GROUP_ORDER, muscleOf } from './exerciseCatalog';
import { addDays, diffDays, formatMD, startOfWeek } from './date';

/**
 * 構成チェック。
 *
 * **組んだ構成を検算するだけで、最適なメニューは作らない**（design-checks.md §1）。
 * 判定の対象は人の実績ではなく、いま組んでいる構成という設計物。
 * だから「未達」を突きつける相手が人にならず、`design-training.md` §1.1 の
 * 「未達という状態を作らない」と衝突しない。
 *
 * すべて警告で、エラーは持たない。保存も入力も止めない。
 */

export type CheckRule =
  /** W1: セッションの所要時間が上限を超過 */
  | 'time'
  /** W2: 軸荷重の日が連日になっている */
  | 'axial';

export interface Warning {
  rule: CheckRule;
  /** 一行の本文 */
  message: string;
  /**
   * **なぜそう出たかを必ず添える。**
   * 理由を追えない警告は、読み飛ばされるか、間違って信じられるかのどちらかになる。
   */
  detail: string;
  /**
   * どう変えればこの指摘が出なくなるか。
   *
   * **書くのは「この判定が偽になる条件」だけ。**トレーニングの良し悪しは言わない。
   * 「重量を上げましょう」は指示だが（design-training.md §1.1）、
   * 「セットを 4 つ減らすと上限に収まる」は判定の言い換えでしかない。
   * 指摘を出す以上、どうすれば消えるかは指摘の一部として持っているべきもの。
   */
  fix: string;
  /** 許容済みにするときのキー（§3.3）。同じキーの警告は二度と出ない */
  key: string;
}

/* ------------------------------------------------------------------ *
 * 許容済みのキー
 * ------------------------------------------------------------------ */

/**
 * `ルール|資源|スコープ` の 3 つ組。スコープは日・種目・プリセットの 3 種類。
 *
 * 日スコープは「今日は承知」、種目スコープは「この種目については以後ずっと承知」。
 * プリセットのスコープは持たない。指摘を出すのは記録画面だけなので、作られる場面がない。
 * 粒度をルールごとに固定しているのは、同じ警告に 2 通りの消し方があると
 * 「どちらで消したか」を覚えていないと解除できなくなるため。
 */
export type Scope =
  { kind: 'day'; date: string } | { kind: 'exercise'; id: string } | { kind: 'preset'; id: string };

const SCOPE_PREFIX = { day: 'd', exercise: 'e', preset: 'p' } as const;

function keyOf(rule: CheckRule, scope: Scope): string {
  const target = scope.kind === 'day' ? scope.date : scope.id;
  return `${rule}|${SCOPE_PREFIX[scope.kind]}:${target}`;
}

const RULE_LABELS: Record<CheckRule, string> = {
  time: 'セッションの長さ',
  axial: '軸荷重種目の連日',
};

/**
 * 許容済みのキーを人が読める形に戻す（設定画面の一覧用）。
 *
 * 解除できないサプレスは、押し間違いが永久に残る。
 * 一覧に出す以上、何を消したのかが分からなければ解除の判断ができない。
 */
export function describeKey(key: string, exercises: readonly Exercise[]): string {
  const [rule, scope = ''] = key.split('|');
  const head = RULE_LABELS[rule as CheckRule] ?? rule ?? '';

  const [kind, ...rest] = scope.split(':');
  const target = rest.join(':');
  if (kind === 'd') return `${head} — ${formatMD(target)}`;
  if (kind === 'e')
    return `${head} — ${exercises.find((e) => e.id === target)?.name ?? '削除された種目'}`;
  return head;
}

/** 許容済みを除いた、実際に出す警告 */
export function visibleWarnings(
  warnings: readonly Warning[],
  suppressed: readonly string[],
): Warning[] {
  const hidden = new Set(suppressed);
  return warnings.filter((w) => !hidden.has(w.key));
}

/* ------------------------------------------------------------------ *
 * 時間
 * ------------------------------------------------------------------ */

/**
 * 1 セットあたりの時間。種目に上書きが無ければ既定値に落ちる。
 *
 * **回数は掛けない。** セットの所要時間は休憩が支配していて、
 * デッドリフト 5×3 と 5×10 はほぼ同じ時間で終わる（design-checks.md §4.2）。
 */
export function minutesPerSetOf(exercise: Exercise, checks: CheckSettings): number {
  return exercise.minutesPerSet ?? checks.minutesPerSet;
}

export interface TimeItem {
  exercise: Exercise;
  /** 並べたセット行の数。値を打つ前でも設計としては決まっている */
  sets: number;
  minutes: number;
}

export function estimateTime(
  items: readonly { exercise: Exercise; sets: number }[],
  checks: CheckSettings,
): { total: number; items: TimeItem[] } {
  const detailed = items.map(({ exercise, sets }) => ({
    exercise,
    sets,
    minutes: round1(sets * minutesPerSetOf(exercise, checks)),
  }));
  return { total: round1(detailed.reduce((sum, x) => sum + x.minutes, 0)), items: detailed };
}

/** 分は 0.1 刻みで足りる。0.5 刻みの値を足すと 13.500000000000002 が出る */
function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/* ------------------------------------------------------------------ *
 * 記録から引く事実
 * ------------------------------------------------------------------ */

/** 部位別のセット数。主部位は 1 セット、補助部位は種目ごとの係数ぶん */
export type GroupSets = Record<MuscleGroup, number>;

export function emptyGroupSets(): GroupSets {
  return Object.fromEntries(GROUP_ORDER.map((g) => [g, 0])) as GroupSets;
}

export interface CheckHistory {
  /**
   * 日付 → その日の部位別セット数。
   *
   * **部位の疲労には新しい記入が要らない。** 資源（腰部）は種目ごとに 0〜10 を決める必要が
   * あるが、部位の消費はすでにある部位別セット数——主部位 + 補助部位 × 係数——がそのまま使える。
   * 係数は利用者が種目ごとに決めたもので、こちらが発明した値ではない。
   */
  groupSets: ReadonlyMap<string, GroupSets>;
  /** 日付 → その日にあった種目。理由に「何をやった日か」を名前で書くために持つ */
  exercisesAt: ReadonlyMap<string, Exercise[]>;
  /** 日付 → その日にあった軸荷重種目 */
  axialAt: ReadonlyMap<string, Exercise[]>;
}

/**
 * 過去の日の消費は **`sessions`（やった事実）から作る。**
 *
 * 生の `workouts` を使うと、種目を並べて閉じただけの日（値が 1 つも入っていない日）が
 * 消費として数えられる。`buildSessions` が `hasAnySet` で落としたあとの形を読む。
 * 編集中の日だけは逆に生エントリを読む（`checkDay` の `entries`）。
 * 値を打つ前でも検算したいのがこの機能の目的なので、そこだけ扱いが反転する。
 */
export function buildCheckHistory(
  sessions: readonly SessionPoint[],
  exercises: readonly Exercise[],
): CheckHistory {
  const byId = new Map(exercises.map((e) => [e.id, e]));
  const groupSets = new Map<string, GroupSets>();
  const exercisesAt = new Map<string, Exercise[]>();
  const axialAt = new Map<string, Exercise[]>();

  for (const session of sessions) {
    const list = session.exercises
      .map((p) => byId.get(p.exerciseId))
      .filter((e): e is Exercise => e != null);
    exercisesAt.set(session.date, list);

    // 部位別セット数の数え方は buildWeeklySets と同じ。2 通りの数え方を持たない
    const sets = emptyGroupSets();
    for (const point of session.exercises) {
      // 有酸素は部位ではない。回復（筋肥大の回復モデル）にも乗せない
      const muscle = muscleOf(point.group);
      if (muscle == null) continue;
      sets[muscle] += point.workSets;
      for (const sub of point.subGroups) sets[sub.group] += point.workSets * sub.weight;
    }
    groupSets.set(session.date, sets);

    const axial = list.filter((e) => e.axial);
    if (axial.length > 0) axialAt.set(session.date, axial);
  }
  return { groupSets, exercisesAt, axialAt };
}

/**
 * 同じ部位を次にやるまでに要る日数を、そのセッションの大きさから決める。
 *
 * **上限は 3 日。** 回復の窓は 24〜72 時間で、それを超えて空けても回復は進まない
 * （超えた分は detraining 側に働く）。
 * 以前は線形減衰でこれを出していて、16 セットのセッションに「7 日ぶん」と答えていた。
 * ボリュームに比例して回復が延びると仮定していたためで、**実際の回復は飽和する。**
 *
 * 段は 3 つだけ。細かく刻んでも、決められるのは「今日やるか、1〜2 日待つか」しかない。
 * セット数は補助部位の係数で端数が出るので、境目は以上／未満で見る。
 */
const RECOVERY_STEPS: readonly (readonly [minSets: number, days: number])[] = [
  [11, 3],
  [6, 2],
  [1, 1],
];

/** 部位が空けることになる日数の最大。回復の窓（24〜72時間）の上限 */
export const MAX_RECOVERY_DAYS = RECOVERY_STEPS[0]![1];

/** そのセッションのあと、次に同じ部位をやるまでに空ける日数 */
export function requiredDays(sets: number): number {
  return RECOVERY_STEPS.find(([min]) => sets >= min)?.[1] ?? 0;
}

export interface GroupReadiness {
  /** あと何日空けることになるか。0 なら今日やれる */
  daysLeft: number;
  /** 判定の根拠になったセッションからの経過日数。記録が無ければ null */
  since: number | null;
  /** そのセッションのセット数 */
  sets: number;
}

/**
 * 部位ごとの「今日やってよいか」。
 *
 * ```
 * あと何日 = max( そのセッションに要る日数 − 経過日数 )   ← 直近のセッションぶんで最大のもの
 * ```
 *
 * **積み上げない。** 毎日足し込む式にすると、回復量を上回る週次ボリュームで際限なく積み上がり、
 * 「背中 22 日ぶん」のような値になる。出ているのは疲労ではなく累積ボリュームで、
 * 「今日やってよいか」には答えていない。
 *
 * 最大を採るので、**大きい古いセッションと小さい直近のセッションの両方**が拾える
 * （3 日前に 12 セット、昨日 2 セットなら、効いているのは前者）。
 * 構造上 3 日を超えないので、現実離れした日数は出ない。
 *
 * **その日の種目は入らない。** 種目を足す前の状態を見るためのもの。
 */
export function groupReadiness(
  history: CheckHistory,
  date: string,
): Record<MuscleGroup, GroupReadiness> {
  const out = Object.fromEntries(
    GROUP_ORDER.map((g) => [g, { daysLeft: 0, since: null, sets: 0 }]),
  ) as Record<MuscleGroup, GroupReadiness>;

  // 上限の 3 日を超えた過去はどの部位も 0 になる。直近の実績を出すために少し長く見る
  for (let i = 1; i <= 30; i++) {
    const sets = history.groupSets?.get(addDays(date, -i));
    if (!sets) continue;
    for (const group of GROUP_ORDER) {
      const count = sets[group] ?? 0;
      if (count <= 0) continue;
      const left = Math.max(0, requiredDays(count) - i);
      const cur = out[group];
      // 効いているセッションを 1 つに決める。同点なら直近（i が小さいほう）が先に入っている
      if (left > cur.daysLeft || cur.since == null) {
        out[group] = { daysLeft: Math.max(left, cur.daysLeft), since: i, sets: round1(count) };
      }
    }
  }
  return out;
}

export const groupLabel = (group: MuscleGroup) => GROUP_LABELS[group];

/**
 * 残っている疲れを「何日ぶんか」に直す。
 *
 * 線形減衰なので割り算 1 つで出る。新しい仮定は入っていない。
 *
 * **単位のある数にするための表示上の変換で、判定には使わない。**
 * 日数に丸めると残り 3 と 5 がどちらも「1 日ぶん」になり、閾値の意味が変わる。
 * 判定は元の値のまま行い、画面に出すときだけこちらを通す。
 */
/* ------------------------------------------------------------------ *
 * 軸荷重
 * ------------------------------------------------------------------ */

export interface AxialStatus {
  /** 前回、軸荷重種目を置いた日からの日数。記録が無ければ null */
  since: number | null;
  /** その日に置いていた軸荷重種目の名前 */
  names: string[];
  /**
   * その週に軸荷重種目を置いた日数。
   *
   * **基準は今日ではなく、画面が表示している日。** 過去の日を開いているときは
   * その日を含む週を数える。数える範囲は `weekStart` から表示日の前日まで
   * （その日の種目を置く前の状態を見るためのもの）。
   */
  daysInWeek: number;
  /** 数えた週の始まり（日曜）。画面に出して、どの週を数えたか分かるようにする */
  weekStart: string;
}

/**
 * 軸荷重を**いつ置いたか**。疲労の量は持たない。
 *
 * 以前は 0〜10 の負荷値を線形減衰させて「あと何日」を出していたが、
 * 1 本の数字に時定数の違う 4 つの層を混ぜていた。
 *
 * | 層 | 時定数 |
 * | --- | --- |
 * | 脊柱起立筋 | 24〜72h |
 * | 神経系・全身性 | 48〜96h |
 * | 椎間板・靭帯 | 数日〜週（無血管性で拡散依存） |
 * | 椎弓・終板 | 週〜月（もはや「抜ける」対象ではない） |
 *
 * 下 2 層は**待てばゼロに戻るもの**ではないので、「あと何日」という枠組み自体が合わない。
 * しかも椎間板の内部はほぼ無神経で、症状は早期警告として機能しない。
 * だからこそ**外形的な積み方**——いつ置いたか——を見る価値があるが、
 * それは腰の状態ではない。アプリが言えるのはここまで。
 */
export function axialStatus(history: CheckHistory, date: string): AxialStatus {
  const weekStart = startOfWeek(date);
  let since: number | null = null;
  let names: string[] = [];
  let daysInWeek = 0;

  for (const [day, list] of history.axialAt) {
    if (day >= date) continue;
    if (since == null || diffDays(date, day) < since) {
      since = diffDays(date, day);
      names = list.map((e) => e.name);
    }
    if (day >= weekStart) daysInWeek++;
  }
  return { since, names, daysInWeek, weekStart };
}

export interface DayInput {
  date: string;
  /** その日に並んでいる種目とセット行数。**生の workouts から作る**（値を打つ前でも検算する） */
  entries: readonly SessionExercise[];
}

/**
 * その日の構成に対する指摘。**疲労の量は持たない。**
 *
 * 判定に使うのは、記録した日付と、種目が持つ真偽値だけ。
 * 推定した量を閾値と比べるのをやめたので、係数も減衰も出てこない。
 */
export function checkDay(
  day: DayInput,
  exercises: readonly Exercise[],
  history: CheckHistory,
  checks: CheckSettings,
): Warning[] {
  const byId = new Map(exercises.map((e) => [e.id, e]));
  const items = day.entries
    .map((entry) => {
      const exercise = byId.get(entry.exerciseId);
      return exercise ? { exercise, sets: entry.sets.length } : null;
    })
    .filter((x): x is { exercise: Exercise; sets: number } => x != null);
  const list = items.map((x) => x.exercise);
  if (list.length === 0) return [];

  const out: Warning[] = [];
  const yesterday = addDays(day.date, -1);

  /* W1 — 所要時間 */
  const time = estimateTime(items, checks);
  if (checks.sessionMinutes != null && time.total > checks.sessionMinutes) {
    const longest = [...time.items].sort((a, b) => b.minutes - a.minutes).slice(0, 3);
    // 超過ぶんを「何セット相当か」に直す。分だけ言われても、何を削ればいいか決まらない
    const overSets = Math.ceil((time.total - checks.sessionMinutes) / checks.minutesPerSet);
    out.push({
      rule: 'time',
      message: 'セッションが上限より長くなります',
      detail:
        `${time.total}分 / 上限 ${checks.sessionMinutes}分 — ` +
        longest.map((x) => `${x.exercise.name} ${x.minutes}分`).join(' / '),
      fix: `セットを${overSets}つ減らすか、種目を別の日に回す`,
      key: keyOf('time', { kind: 'day', date: day.date }),
    });
  }

  /*
   * W2 — 軸荷重が連日になっている。
   *
   * 疲労の残量ではなく **置いた間隔** を見る。起立筋なら 24〜72h で戻るが、
   * 中 0 日はその窓にも入らない。それより長い層（椎間板・靭帯）は
   * 待って戻るものではないので、日数の判定を伸ばしても意味を持たない。
   */
  const axialYesterday = history.axialAt.get(yesterday) ?? [];
  const axialToday = list.filter((e) => e.axial);
  if (axialYesterday.length > 0 && axialToday.length > 0) {
    out.push({
      rule: 'axial',
      message: '軸荷重種目が連日になっています',
      detail:
        `${formatMD(yesterday)} ${axialYesterday.map((e) => e.name).join('・')}` +
        ` → ${axialToday.map((e) => e.name).join('・')}`,
      fix: `${axialToday.map((e) => e.name).join('・')}を別の日に回す`,
      key: keyOf('axial', { kind: 'day', date: day.date }),
    });
  }

  return out;
}
