import type {
  AppData,
  CheckSettings,
  DayEntry,
  Entries,
  Exercise,
  ExerciseTarget,
  GroupGoals,
  LoadMode,
  Measurement,
  MuscleGroup,
  Preset,
  SessionExercise,
  Settings,
  SubGroup,
  ThemePref,
  WorkSet,
  Workouts,
} from '../types';
import { SUB_GROUP_WEIGHT, SUB_GROUP_WEIGHT_RANGE, catalogCheckValues } from './exerciseCatalog';
import { THEME_IDS } from './themes';
import { IS_DEMO } from './env';
import { SEED_DATA } from './seed';

/** キー名はスキーマ版ではなく保存先のアドレス。v2 でも変えない（変えると既存データが見えなくなる） */
const DATA_KEY = 'bodymake.data.v1';

/**
 * スキーマ版。**移行の判定はこれで行う。**
 *
 * キーの有無で「移行済みか」を見ると、途中のビルドが既定値を書き戻したデータを
 * 「本人が選んだ値」と誤って尊重する。実際 v3 では 2 度それが起きた
 * （`loads: 0` と `axial: false`）。版で見れば、その世代のデータをまとめて読み直せる。
 */
export const DATA_VERSION = 5;

/** レビューの値が信用できるようになった版。これ未満はカタログから引き直す */
const CHECK_FIELDS_VERSION = 4;

export const DEFAULT_SETTINGS: Settings = {
  heightCm: null,
  targetWeight: null,
  targetBodyFat: null,
  targetDate: null,
  theme: 'system',
};

/**
 * レビューの既定値。
 *
 * **疲労の量を持たない。** 軸荷重も前腕も真偽値で、判定は記録した日付から出る。
 * 調整する係数は時間まわりだけになった。
 */
export function defaultChecks(): CheckSettings {
  return { enabled: false, sessionMinutes: 90, minutesPerSet: 3 };
}

const EMPTY_GROUP_GOALS: GroupGoals = {
  chest: null,
  back: null,
  legs: null,
  shoulders: null,
  arms: null,
  core: null,
};

export function emptyData(): AppData {
  return {
    // 定数から引く。直に書くと版を上げたときにここだけ古い値が残る
    version: DATA_VERSION,
    settings: { ...DEFAULT_SETTINGS },
    entries: {},
    exercises: [],
    workouts: {},
    groupGoals: { ...EMPTY_GROUP_GOALS },
    presets: [],
    checks: defaultChecks(),
    suppressed: [],
  };
}

function sanitizeGroupGoals(raw: unknown): GroupGoals {
  const o = (raw ?? {}) as Record<string, unknown>;
  const out = { ...EMPTY_GROUP_GOALS };
  for (const g of GROUPS) out[g] = int(o[g], GROUP_GOAL_RANGE[0], GROUP_GOAL_RANGE[1]);
  return out;
}

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

function num(value: unknown, min: number, max: number): number | null {
  const n = typeof value === 'string' ? Number(value) : value;
  if (typeof n !== 'number' || !Number.isFinite(n)) return null;
  if (n < min || n > max) return null;
  return Math.round(n * 10) / 10;
}

/** レップのように小数を許さない値。四捨五入してから値域を見る */
function int(value: unknown, min: number, max: number): number | null {
  const n = typeof value === 'string' ? Number(value) : value;
  if (typeof n !== 'number' || !Number.isFinite(n)) return null;
  const rounded = Math.round(n);
  if (rounded < min || rounded > max) return null;
  return rounded;
}

export const WEIGHT_RANGE: [number, number] = [20, 300];
export const BODYFAT_RANGE: [number, number] = [1, 70];
export const HEIGHT_RANGE: [number, number] = [100, 250];

/** セットの重量は体重と値域が違う（自重種目の追加重量は 0 もありうる） */
export const SET_WEIGHT_RANGE: [number, number] = [0, 500];
export const REPS_RANGE: [number, number] = [1, 100];
export const RM_DIVISOR_RANGE: [number, number] = [20, 60];
export const FACTOR_RANGE: [number, number] = [0, 2];
export const TARGET_WEIGHT_RANGE: [number, number] = [0, 500];
/** 1 日の総挙上量。重い種目を多セットやると数千 kg になる */
export const TARGET_VOLUME_RANGE: [number, number] = [0, 100000];
export const TARGET_REPS_RANGE: [number, number] = [1, 200];
export const GROUP_GOAL_RANGE: [number, number] = [1, 50];

/* ---- 構成チェック ---- */
/** 1 セッションの上限（分）。null は「時間を見ない」 */
export const SESSION_MINUTES_RANGE: [number, number] = [10, 600];
/** 1 セットあたりの時間（分）。0 は「時間に数えない」 */
export const MINUTES_PER_SET_RANGE: [number, number] = [0, 30];

export function parseWeight(value: unknown): number | null {
  return num(value, WEIGHT_RANGE[0], WEIGHT_RANGE[1]);
}

export function parseBodyFat(value: unknown): number | null {
  return num(value, BODYFAT_RANGE[0], BODYFAT_RANGE[1]);
}

export function parseSetWeight(value: unknown): number | null {
  return num(value, SET_WEIGHT_RANGE[0], SET_WEIGHT_RANGE[1]);
}

export function parseReps(value: unknown): number | null {
  return int(value, REPS_RANGE[0], REPS_RANGE[1]);
}

function sanitizeMeasurement(raw: unknown): Measurement {
  const o = (raw ?? {}) as Record<string, unknown>;
  return { weight: parseWeight(o.weight), bodyFat: parseBodyFat(o.bodyFat) };
}

function sanitizeDay(raw: unknown): DayEntry {
  const o = (raw ?? {}) as Record<string, unknown>;
  return { am: sanitizeMeasurement(o.am), pm: sanitizeMeasurement(o.pm) };
}

/** 外部から来た JSON は形が保証されないため、必ずここで型と値域を通してから state に入れる */
export function sanitizeEntries(raw: unknown): Entries {
  const out: Entries = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!ISO_RE.test(key)) continue;
    const day = sanitizeDay(value);
    if (
      day.am.weight == null &&
      day.am.bodyFat == null &&
      day.pm.weight == null &&
      day.pm.bodyFat == null
    ) {
      continue;
    }
    out[key] = day;
  }
  return out;
}

const GROUPS: MuscleGroup[] = ['chest', 'back', 'legs', 'shoulders', 'arms', 'core'];

const LOAD_MODES: LoadMode[] = ['standard', 'perSide', 'bodyweight'];

/** 「負荷の種類 + 片手ぶんか」で持っていた頃のデータを読み替える */
function sanitizeLoadMode(o: Record<string, unknown>): LoadMode {
  if (LOAD_MODES.includes(o.loadMode as LoadMode)) return o.loadMode as LoadMode;
  if (o.loadType === 'bodyweight' || o.loadType === 'assisted') return 'bodyweight';
  return o.perSide === true ? 'perSide' : 'standard';
}

function sanitizeGoal(o: Record<string, unknown>): ExerciseTarget | null {
  const raw = (o.goal ?? null) as Record<string, unknown> | null;
  // 現状維持だけは数値を持たない
  if (raw && raw.type === 'maintain') return { type: 'maintain', value: null };
  if (raw && raw.type === 'volume') {
    const value = int(raw.value, TARGET_VOLUME_RANGE[0], TARGET_VOLUME_RANGE[1]);
    return value == null ? null : { type: 'volume', value };
  }
  if (raw && raw.type === 'reps') {
    const value = int(raw.value, TARGET_REPS_RANGE[0], TARGET_REPS_RANGE[1]);
    return value == null ? null : { type: 'reps', value };
  }
  if (raw && raw.type === 'weight') {
    const value = num(raw.value, TARGET_WEIGHT_RANGE[0], TARGET_WEIGHT_RANGE[1]);
    return value == null ? null : { type: 'weight', value };
  }
  // 目標を重量固定で持っていた頃のデータを拾う
  const legacy = num(o.targetWeight, TARGET_WEIGHT_RANGE[0], TARGET_WEIGHT_RANGE[1]);
  return legacy == null ? null : { type: 'weight', value: legacy };
}

/** 主部位と重複するもの・未知の値・重複は落とす */
/** num() は小数第 1 位までなので 0.25 が潰れる。係数だけ第 2 位まで見る */
function subWeight(value: unknown): number | null {
  const n = typeof value === 'string' ? Number(value) : value;
  if (typeof n !== 'number' || !Number.isFinite(n)) return null;
  if (n < SUB_GROUP_WEIGHT_RANGE[0] || n > SUB_GROUP_WEIGHT_RANGE[1]) return null;
  return Math.round(n * 100) / 100;
}

function sanitizeSubGroups(raw: unknown, primary: MuscleGroup): SubGroup[] {
  if (!Array.isArray(raw)) return [];
  const out: SubGroup[] = [];
  for (const item of raw) {
    // 係数を持たせる前のバックアップは部位名の配列。既定の割合で読む
    const o =
      typeof item === 'string' ? { group: item } : ((item ?? {}) as Record<string, unknown>);
    const g = o.group as MuscleGroup;
    if (!GROUPS.includes(g) || g === primary || out.some((x) => x.group === g)) continue;
    out.push({
      group: g,
      weight: subWeight(o.weight) ?? SUB_GROUP_WEIGHT,
    });
  }
  return out;
}

function sanitizeExercise(raw: unknown, order: number, fromVersion: number): Exercise | null {
  const o = (raw ?? {}) as Record<string, unknown>;
  const id = typeof o.id === 'string' ? o.id.trim() : '';
  const name = typeof o.name === 'string' ? o.name.trim().slice(0, 40) : '';
  // ID と名前が無い種目はログから参照できず、画面にも出せないので落とす
  if (!id || !name) return null;

  const group = GROUPS.includes(o.group as MuscleGroup) ? (o.group as MuscleGroup) : 'chest';

  return {
    id,
    name,
    group,
    subGroups: sanitizeSubGroups(o.subGroups, group),
    loadMode: sanitizeLoadMode(o),
    repUnit: o.repUnit === 'seconds' ? 'seconds' : 'reps',
    bodyweightFactor: num(o.bodyweightFactor, FACTOR_RANGE[0], FACTOR_RANGE[1]),
    rmDivisor: num(o.rmDivisor, RM_DIVISOR_RANGE[0], RM_DIVISOR_RANGE[1]) ?? 30,
    goal: sanitizeGoal(o),
    order: int(o.order, 0, 9999) ?? order,
    // 既定は表示。キーが無いのは非表示を持たなかった頃のデータで、そのまま表示でよい
    hidden: o.hidden === true,
    ...checkFieldsOf(o, id, fromVersion),
  };
}

/**
 * レビューの 2 フィールド。
 *
 * **どれも持っていない種目は v2 以前のデータ**なので、カタログから既定値を引き直す。
 * false のまま読むと、カタログからデッドリフトを入れてあるのに軸荷重でない、という
 * 食い違いが起きて、既存ユーザーだけ判定が一切効かない状態になる。
 *
 * 逆に 1 つでも持っていれば v3 以降の保存。**そのときは false も選択として尊重する**
 * （「この種目は軸荷重に数えない」と決めた結果を、移行が上書きしてはいけない）。
 */
function checkFieldsOf(
  o: Record<string, unknown>,
  id: string,
  fromVersion: number,
): Pick<Exercise, 'axial' | 'minutesPerSet'> {
  /*
   * **版で判定する。キーの有無では判定しない。**
   *
   * キーの有無は「途中のビルドが既定値を書き戻した」と「本人が false を選んだ」を
   * 区別できない。v3 では実際に 2 度それが起きて、どちらも二度と戻らなくなった。
   * 版が古いデータは、値があってもカタログから引き直す。
   */
  const stale = fromVersion < CHECK_FIELDS_VERSION;
  if (stale || !('axial' in o)) {
    const fromCatalog = catalogCheckValues(id);
    if (fromCatalog) return fromCatalog;
  }
  return {
    axial: o.axial === true,
    // 空欄は「既定値に落とす」という意味を持つので、値域外も null に潰す
    minutesPerSet: num(o.minutesPerSet, MINUTES_PER_SET_RANGE[0], MINUTES_PER_SET_RANGE[1]),
  };
}

/**
 * しきい値。**値域外や欠損は既定値に落とす。**
 * ここだけは「打ちかけを残す」作法（§2.2）を採らない。
 * 判定に使う値が空のままだと、指摘が黙って出なくなる（壊れたことに気づけない）。
 */
export function sanitizeChecks(raw: unknown): CheckSettings {
  const o = (raw ?? {}) as Record<string, unknown>;
  const base = defaultChecks();
  return {
    enabled: o.enabled === true,
    // null は「時間を見ない」という選択なので、未指定と区別して残す
    sessionMinutes:
      o.sessionMinutes === null
        ? null
        : (int(o.sessionMinutes, SESSION_MINUTES_RANGE[0], SESSION_MINUTES_RANGE[1]) ??
          base.sessionMinutes),
    minutesPerSet:
      num(o.minutesPerSet, MINUTES_PER_SET_RANGE[0], MINUTES_PER_SET_RANGE[1]) ??
      base.minutesPerSet,
  };
}

/** 許容済みのキー。中身は check.ts が組み立てた文字列なので、形だけ見る */
export function sanitizeSuppressed(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return [
    ...new Set(
      raw.filter((x): x is string => typeof x === 'string' && x.length > 0 && x.length <= 200),
    ),
  ];
}

/** 名前の長さの上限。種目名と同じにそろえる */
export const PRESET_NAME_MAX = 40;

/**
 * 種目の組み合わせ。
 *
 * 存在しない種目を指す ID は落とす（種目を消したら、その種目だけ組み合わせから抜ける）。
 * 中身が空になった組み合わせは、名前だけが残っても呼び出せないので落とす。
 */
export function sanitizePresets(raw: unknown, knownIds: ReadonlySet<string>): Preset[] {
  if (!Array.isArray(raw)) return [];

  const out: Preset[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const o = (item ?? {}) as Record<string, unknown>;
    const id = typeof o.id === 'string' ? o.id : '';
    const name = typeof o.name === 'string' ? o.name.trim().slice(0, PRESET_NAME_MAX) : '';
    if (!id || !name || seen.has(id) || !Array.isArray(o.exerciseIds)) continue;

    const exerciseIds = [
      ...new Set(
        o.exerciseIds.filter((x): x is string => typeof x === 'string' && knownIds.has(x)),
      ),
    ];
    if (exerciseIds.length === 0) continue;

    seen.add(id);
    out.push({ id, name, exerciseIds });
  }
  return out;
}

export function sanitizeExercises(raw: unknown, fromVersion = DATA_VERSION): Exercise[] {
  if (!Array.isArray(raw)) return [];
  const out: Exercise[] = [];
  const seen = new Set<string>();
  raw.forEach((item, i) => {
    const ex = sanitizeExercise(item, i, fromVersion);
    // 同じ ID が二重にいるとログの参照先が曖昧になるため、先勝ちで落とす
    if (!ex || seen.has(ex.id)) return;
    seen.add(ex.id);
    out.push(ex);
  });
  return out.sort((a, b) => a.order - b.order).map((ex, i) => ({ ...ex, order: i }));
}

/**
 * 値だけを直す。**行そのものは落とさない。**
 * 値域外は null に潰すが、空欄の行は「まだ打っていない」であって「消してよい」ではない。
 */
function sanitizeWorkSet(raw: unknown): WorkSet {
  const o = (raw ?? {}) as Record<string, unknown>;
  return {
    weight: parseSetWeight(o.weight),
    reps: parseReps(o.reps),
  };
}

/**
 * 同一種目は 1 日 1 エントリ。重複していたらセットを連結して 1 つにまとめる
 * （落とすとユーザーの記録が消えるため、統合するほうを選ぶ）。
 * 存在しない種目を指すログは表示も編集もできないので落とす。
 *
 * 値が 1 つも入っていない種目も残す。読み込みのたびに掃くと、
 * 種目を並べただけで閉じた日が、開き直すと空になっている（設計 §2.2）。
 * 実績として数えないのは buildSessions 側の仕事（hasAnySet）。
 */
export function sanitizeWorkouts(raw: unknown, knownIds: ReadonlySet<string>): Workouts {
  const out: Workouts = {};
  if (!raw || typeof raw !== 'object') return out;

  for (const [date, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!ISO_RE.test(date) || !Array.isArray(value)) continue;

    const byId = new Map<string, SessionExercise>();
    for (const item of value) {
      const o = (item ?? {}) as Record<string, unknown>;
      const exerciseId = typeof o.exerciseId === 'string' ? o.exerciseId : '';
      if (!exerciseId || !knownIds.has(exerciseId)) continue;
      if (!Array.isArray(o.sets)) continue;

      const sets = o.sets.map(sanitizeWorkSet);

      const existing = byId.get(exerciseId);
      if (existing) existing.sets.push(...sets);
      else byId.set(exerciseId, { exerciseId, sets });
    }

    if (byId.size > 0) out[date] = [...byId.values()];
  }
  return out;
}

function sanitizeSettings(raw: unknown): Settings {
  const o = (raw ?? {}) as Record<string, unknown>;
  const theme = o.theme;
  return {
    heightCm: num(o.heightCm, HEIGHT_RANGE[0], HEIGHT_RANGE[1]),
    targetWeight: parseWeight(o.targetWeight),
    targetBodyFat: parseBodyFat(o.targetBodyFat),
    targetDate: typeof o.targetDate === 'string' && ISO_RE.test(o.targetDate) ? o.targetDate : null,
    // 知らない配色を持つバックアップは 'system' に落とす
    theme: THEME_IDS.includes(theme as ThemePref) ? (theme as ThemePref) : 'system',
  };
}

/**
 * v1 は entries と settings しか、v2 は checks / suppressed と種目の構成チェック値しか持たない。
 * どちらも**足りないキーを既定値で補うだけ**で移行が済む。
 * 逆にロールバックすると新しいキーは落ちるが、それは許容している（docs 参照）。
 */
export function sanitizeData(raw: unknown): AppData {
  const o = (raw ?? {}) as Record<string, unknown>;
  // 版が無いデータは v1（entries と settings しか無かったころ）とみなす
  const fromVersion = typeof o.version === 'number' ? o.version : 1;
  const exercises = sanitizeExercises(o.exercises, fromVersion);
  const knownIds = new Set(exercises.map((e) => e.id));
  return {
    version: DATA_VERSION,
    settings: sanitizeSettings(o.settings),
    entries: sanitizeEntries(o.entries),
    exercises,
    workouts: sanitizeWorkouts(o.workouts, knownIds),
    groupGoals: sanitizeGroupGoals(o.groupGoals),
    presets: sanitizePresets(o.presets, knownIds),
    checks: sanitizeChecks(o.checks),
    suppressed: sanitizeSuppressed(o.suppressed),
  };
}

/**
 * 保存済みを読む。壊れていれば空から始める。
 *
 * **デモでは、ここで勝手に上書きしない。**
 * 初期データへ戻すのは起動時の確認（DemoNotice）を通ってからで、
 * 断りなく消すと、触った内容が理由の分からないまま消えたように見える。
 * 何も入っていない端末のときだけ、空の画面を見せないためにここで入れる。
 */
export function loadData(): AppData {
  let stored: AppData | null = null;
  try {
    const raw = localStorage.getItem(DATA_KEY);
    if (raw) stored = sanitizeData(JSON.parse(raw) as unknown);
  } catch {
    stored = null;
  }

  // 以降どの分岐でも base を土台にする。再構築すると筋トレのキーが落ちる
  const base = stored ?? emptyData();

  // 投入するのはデモ向けビルドだけ。自分の記録として使う側に他人の数字を入れない
  if (!IS_DEMO) return base;
  // 触ったあとの内容は、確認を出すあいだだけそのまま見せる
  if (stored) return base;
  return demoSeed() ?? base;
}

/**
 * デモの初期データ。デモ向けビルド以外では null を返す。
 *
 * `IS_DEMO` はビルド時に畳まれるので、本番のバンドルからは
 * この分岐ごと（＝ seed の 60KB ごと）落ちる。
 */
export function demoSeed(): AppData | null {
  // 生の書き出しなので、値域も参照も sanitizeData に通してから state へ入れる
  return IS_DEMO ? sanitizeData(SEED_DATA) : null;
}

export function saveData(data: AppData): void {
  try {
    localStorage.setItem(DATA_KEY, JSON.stringify(data));
  } catch {
    /* 容量超過などは保存失敗として黙って握る（UI 側でエクスポートを促す） */
  }
}
