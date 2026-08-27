import type {
  AppData,
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
import { SUB_GROUP_WEIGHT, SUB_GROUP_WEIGHT_RANGE } from './exerciseCatalog';
import { THEME_IDS } from './themes';
import { seedEntries } from './seed';

/** キー名はスキーマ版ではなく保存先のアドレス。v2 でも変えない（変えると既存データが見えなくなる） */
const DATA_KEY = 'bodymake.data.v1';
const SEEDED_KEY = 'bodymake.seeded.v1';

export const DATA_VERSION = 2;

export const DEFAULT_SETTINGS: Settings = {
  heightCm: null,
  targetWeight: null,
  targetBodyFat: null,
  targetDate: null,
  theme: 'system',
};

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
    version: 2,
    settings: { ...DEFAULT_SETTINGS },
    entries: {},
    exercises: [],
    workouts: {},
    groupGoals: { ...EMPTY_GROUP_GOALS },
    presets: [],
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
export const TARGET_REPS_RANGE: [number, number] = [1, 200];
export const GROUP_GOAL_RANGE: [number, number] = [1, 50];

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

function sanitizeExercise(raw: unknown, order: number): Exercise | null {
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
  };
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

export function sanitizeExercises(raw: unknown): Exercise[] {
  if (!Array.isArray(raw)) return [];
  const out: Exercise[] = [];
  const seen = new Set<string>();
  raw.forEach((item, i) => {
    const ex = sanitizeExercise(item, i);
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
 * v1 は entries と settings しか持たない。足りないキーを空で補うだけで移行が済む。
 * 逆にロールバックすると exercises / workouts は落ちるが、それは許容している（docs 参照）。
 */
export function sanitizeData(raw: unknown): AppData {
  const o = (raw ?? {}) as Record<string, unknown>;
  const exercises = sanitizeExercises(o.exercises);
  const knownIds = new Set(exercises.map((e) => e.id));
  return {
    version: 2,
    settings: sanitizeSettings(o.settings),
    entries: sanitizeEntries(o.entries),
    exercises,
    workouts: sanitizeWorkouts(o.workouts, knownIds),
    groupGoals: sanitizeGroupGoals(o.groupGoals),
    presets: sanitizePresets(o.presets, knownIds),
  };
}

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
  if (Object.keys(base.entries).length > 0) return base;

  // 初回起動時のみエクセルの記録を投入する。ユーザーが全消ししたあとに復活させない
  let seeded = false;
  try {
    seeded = localStorage.getItem(SEEDED_KEY) === '1';
  } catch {
    seeded = true;
  }
  if (!seeded) {
    try {
      localStorage.setItem(SEEDED_KEY, '1');
    } catch {
      /* プライベートモード等で書けなくても続行する */
    }
    return { ...base, entries: seedEntries() };
  }

  return base;
}

export function saveData(data: AppData): void {
  try {
    localStorage.setItem(DATA_KEY, JSON.stringify(data));
  } catch {
    /* 容量超過などは保存失敗として黙って握る（UI 側でエクスポートを促す） */
  }
}
