import type {
  AppData,
  CheckSettings,
  DayEntry,
  Entries,
  Exercise,
  ExerciseGroup,
  ExerciseTarget,
  GroupGoals,
  LoadMode,
  Measurement,
  MuscleGroup,
  Preset,
  RepUnit,
  SessionExercise,
  SessionSet,
  Settings,
  SubGroup,
  ThemePref,
  Workouts,
} from '../types';
import {
  SUB_GROUP_WEIGHT,
  SUB_GROUP_WEIGHT_RANGE,
  catalogCheckValues,
  isCardio,
} from './exerciseCatalog';
import { THEME_IDS } from './themes';
import { IS_DEMO } from './env';
import { SEED_DATA } from './seed';
import { readRecord, writeRecord } from './db';

/** キー名はスキーマ版ではなく保存先のアドレス。v2 でも変えない（変えると既存データが見えなくなる） */
const DATA_KEY = 'bodymake.data.v1';

/**
 * スキーマ版。**移行の判定はこれで行う。**
 *
 * キーの有無で「移行済みか」を見ると、途中のビルドが既定値を書き戻したデータを
 * 「本人が選んだ値」と誤って尊重する。実際 v3 では 2 度それが起きた
 * （`loads: 0` と `axial: false`）。版で見れば、その世代のデータをまとめて読み直せる。
 */
export const DATA_VERSION = 7;

/** レビューの値が信用できるようになった版。これ未満はカタログから引き直す */
const CHECK_FIELDS_VERSION = 4;
/** 「繰り返して行う種目か」を足した版。それ以前のデータはカタログから引き直す */
const REPEATED_VERSION = 7;

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
/**
 * 2 つ目の欄の値域。**単位ごとに分ける。**
 *
 * 1 つの範囲で兼ねていたころは 1〜100 で、3 分プランク（180秒）が入らなかった。
 * 単位が違えば取りうる幅も違う。
 */
export const REPS_RANGE: [number, number] = [1, 100];
/** 秒。プランクや保持系。1 時間を上限にする */
export const SECONDS_RANGE: [number, number] = [1, 3600];

export function repRangeOf(repUnit: RepUnit): [number, number] {
  return repUnit === 'seconds' ? SECONDS_RANGE : REPS_RANGE;
}

/* ---- 有酸素。筋トレとは器が違うので値域も別に持つ ---- */
/** 距離（m）。整数で持つので 25m も入り、フルマラソンでも収まる */
export const DISTANCE_M_RANGE: [number, number] = [1, 200000];
/** 時間（秒）。整数で持つので 90 秒がそのまま入る */
export const DURATION_SEC_RANGE: [number, number] = [1, 86400];

export function parseMeters(value: unknown): number | null {
  return int(value, DISTANCE_M_RANGE[0], DISTANCE_M_RANGE[1]);
}

export function parseSeconds(value: unknown): number | null {
  return int(value, DURATION_SEC_RANGE[0], DURATION_SEC_RANGE[1]);
}
export const RM_DIVISOR_RANGE: [number, number] = [20, 60];
export const FACTOR_RANGE: [number, number] = [0, 2];
export const TARGET_WEIGHT_RANGE: [number, number] = [0, 500];
/** 1 日の総挙上量。重い種目を多セットやると数千 kg になる */
export const TARGET_VOLUME_RANGE: [number, number] = [0, 100000];
export const TARGET_REPS_RANGE: [number, number] = [1, 200];
export const GROUP_GOAL_RANGE: [number, number] = [1, 50];
/** 有酸素の目標。距離(m) / 時間(分) / 速度(m/分)。どれも入力欄と同じ単位 */
export const TARGET_DISTANCE_RANGE: [number, number] = [1, 200000];
export const TARGET_DURATION_RANGE: [number, number] = [1, 600];
/** 歩いて 80、走って 170、自転車で 420 前後 */
export const TARGET_SPEED_RANGE: [number, number] = [1, 1000];

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

export function parseReps(value: unknown, repUnit: RepUnit = 'reps'): number | null {
  const [min, max] = repRangeOf(repUnit);
  return int(value, min, max);
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

/** 部位（補助部位に使える値）。有酸素は部位ではないので入れない */
const GROUPS: MuscleGroup[] = ['chest', 'back', 'legs', 'shoulders', 'arms', 'core'];
/** 種目が主分類として持てる値。有酸素を含む */
const EXERCISE_GROUPS: ExerciseGroup[] = [...GROUPS, 'cardio'];

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
  // 距離は m の整数。速度だけ小数を持つ（166.7 m/分）
  if (raw && raw.type === 'distance') {
    const value = int(raw.value, TARGET_DISTANCE_RANGE[0], TARGET_DISTANCE_RANGE[1]);
    return value == null ? null : { type: 'distance', value };
  }
  if (raw && raw.type === 'duration') {
    const value = int(raw.value, TARGET_DURATION_RANGE[0], TARGET_DURATION_RANGE[1]);
    return value == null ? null : { type: 'duration', value };
  }
  if (raw && raw.type === 'speed') {
    const value = num(raw.value, TARGET_SPEED_RANGE[0], TARGET_SPEED_RANGE[1]);
    return value == null ? null : { type: 'speed', value };
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

function sanitizeRepUnit(raw: unknown): RepUnit {
  return raw === 'seconds' ? 'seconds' : 'reps';
}

function sanitizeSubGroups(raw: unknown, primary: ExerciseGroup): SubGroup[] {
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

  const group = EXERCISE_GROUPS.includes(o.group as ExerciseGroup)
    ? (o.group as ExerciseGroup)
    : 'chest';

  return {
    id,
    name,
    group,
    subGroups: sanitizeSubGroups(o.subGroups, group),
    loadMode: sanitizeLoadMode(o),
    repUnit: sanitizeRepUnit(o.repUnit),
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
): Pick<Exercise, 'axial' | 'minutesPerSet' | 'repeated'> {
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
    repeated: repeatedOf(o, id, fromVersion),
  };
}

/**
 * 繰り返して行う種目か。
 *
 * **版で判定する**（checkFieldsOf と同じ理由）。この項目より前に保存されたデータは
 * 値を持っていないので、既定を false で埋めるとランニングもベンチプレスも
 * 1 回で完結する種目になってしまう。カタログから引き直す。
 */
function repeatedOf(o: Record<string, unknown>, id: string, fromVersion: number): boolean {
  if (fromVersion < REPEATED_VERSION) {
    return catalogCheckValues(id)?.repeated ?? true;
  }
  // 自作種目も含め、持っていなければ繰り返す側にする（1 回で完結する種目のほうが少ない）
  return o.repeated !== false;
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

/** 種目ごとに、セットをどちらの器で読むか */
export interface SetShape {
  cardio: boolean;
  repUnit: RepUnit;
}

/**
 * 値だけを直す。**行そのものは落とさない。**
 * 値域外は null に潰すが、空欄の行は「まだ打っていない」であって「消してよい」ではない。
 *
 * **どちらの器で読むかは種目が決める。**同じ「2 つ目の数字」でも、
 * 回・秒・距離・時間で取りうる幅も刻みも違う。1 つの値域で兼ねると、
 * 画面には入っているのに次の読み込みで消える、という壊れ方をする。
 */
function sanitizeSet(raw: unknown, shape: SetShape): SessionSet {
  const o = (raw ?? {}) as Record<string, unknown>;
  if (!shape.cardio) {
    return { weight: parseSetWeight(o.weight), reps: parseReps(o.reps, shape.repUnit) };
  }
  /*
   * 距離と時間を weight / reps に相乗りさせていた頃の形を拾う（km と 分）。
   * 公開前の形なので、いずれ落としてよい。
   */
  const legacyMeters = o.meters == null && o.weight != null ? num(o.weight, 0, 500) : null;
  const legacySeconds = o.seconds == null && o.reps != null ? int(o.reps, 0, 600) : null;
  return {
    meters:
      parseMeters(o.meters) ?? (legacyMeters == null ? null : parseMeters(legacyMeters * 1000)),
    seconds:
      parseSeconds(o.seconds) ?? (legacySeconds == null ? null : parseSeconds(legacySeconds * 60)),
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
export function sanitizeWorkouts(
  raw: unknown,
  /** 種目 ID → セットの器。ここに無い ID のログは参照先が無いので落とす */
  shapes: ReadonlyMap<string, SetShape>,
): Workouts {
  const out: Workouts = {};
  if (!raw || typeof raw !== 'object') return out;

  for (const [date, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!ISO_RE.test(date) || !Array.isArray(value)) continue;

    const byId = new Map<string, SessionExercise>();
    for (const item of value) {
      const o = (item ?? {}) as Record<string, unknown>;
      const exerciseId = typeof o.exerciseId === 'string' ? o.exerciseId : '';
      const shape = shapes.get(exerciseId);
      if (!exerciseId || shape == null) continue;
      if (!Array.isArray(o.sets)) continue;

      const sets = o.sets.map((set) => sanitizeSet(set, shape));

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
  // 値域はセットの器で決まるので、種目の側の情報をログの読み込みへ渡す
  const shapes = new Map<string, SetShape>(
    exercises.map((e) => [e.id, { cardio: isCardio(e.group), repUnit: e.repUnit }]),
  );
  return {
    version: DATA_VERSION,
    settings: sanitizeSettings(o.settings),
    entries: sanitizeEntries(o.entries),
    exercises,
    workouts: sanitizeWorkouts(o.workouts, shapes),
    groupGoals: sanitizeGroupGoals(o.groupGoals),
    presets: sanitizePresets(o.presets, knownIds),
    checks: sanitizeChecks(o.checks),
    suppressed: sanitizeSuppressed(o.suppressed),
  };
}

/* ------------------------------------------------------------------ *
 * 保存先
 *
 * **IndexedDB が主。localStorage は「一度も IndexedDB を使えていない端末」だけの落とし先。**
 * どちらを使うかは起動時に一度だけ決めて、以後は変えない。
 * 書き込みのたびに選び直すと、同じ記録が 2 か所に分かれて残る。
 * ------------------------------------------------------------------ */

type Backend =
  | 'idb'
  | 'local'
  /**
   * 移行済みなのに IndexedDB を開けなかった。**どこにも書かない。**
   *
   * ここで localStorage へ落ちてはいけない。落ちると、移行の時点で止まった
   * 古いスナップショット（あるいは空）を本物として見せたうえ、
   * そこへ打ち込んだ内容で上書きしてしまう。本物は IndexedDB に残ったまま見えなくなる。
   * **空に見えるより、それらしく見えて違うほうが悪い。**
   *
   * 保存は失敗させて `StorageAlert` に出し、記録には一切触らない。
   * 次に開けた起動で、そのまま元の記録に戻る。
   */
  | 'none';

/** `loadData()` が確定させる。それまでは IndexedDB を前提に置く */
let backend: Backend = 'idb';

/** いまどこに書いているか（画面の文言と、テストの確認用） */
export function currentBackend(): Backend {
  return backend;
}

/**
 * この端末が IndexedDB へ移行済みか。**localStorage に置く。**
 *
 * 記録そのものではなく端末の状態なので `AppData` には混ぜない。
 * 同期で読めることが要件（IndexedDB が開けないときの判断に使うので、
 * IndexedDB の中には置けない）。
 */
const STORE_KEY = 'bodymake.store.v1';

function markerIsIdb(): boolean {
  try {
    return localStorage.getItem(STORE_KEY) === 'idb';
  } catch {
    return false;
  }
}

/**
 * 移行が終わったことを記録し、**旧版のコピーを消す。**
 *
 * 残しておくと、そのコピーは日ごとに古くなる。古いだけならまだしも、
 * IndexedDB を開けなかった起動でそれが本物として読まれると、
 * 1 か月前の記録に打ち込むことになる（上の `'none'` の説明）。
 *
 * 消しても失うものは無い。古いビルドへ戻したときに空に見えるだけで、
 * 記録は IndexedDB にあるので、ビルドを戻せばそのまま出てくる。
 */
function completeMigration(): void {
  try {
    localStorage.setItem(STORE_KEY, 'idb');
    localStorage.removeItem(DATA_KEY);
  } catch {
    /* 書けない端末。次の起動でもう一度片付ける */
  }
}

/** 旧版の保存先。読むのは移行のときと、`'local'` で動いている端末だけ */
function readLocal(): AppData | null {
  try {
    const raw = localStorage.getItem(DATA_KEY);
    return raw ? sanitizeData(JSON.parse(raw) as unknown) : null;
  } catch {
    return null;
  }
}

/**
 * IndexedDB を開き、入っていれば読む。空なら旧版の記録を引き取る。
 *
 * **移行は読み出しのついでに 1 回だけ起きる。**専用の移行画面も確認も出さない。
 * 利用者から見れば保存先が変わっただけで、記録は 1 件も変わらないため。
 */
async function readStored(): Promise<AppData | null> {
  let record: unknown = null;
  try {
    record = await readRecord<unknown>();
  } catch {
    // 移行済みの端末で開けないのは異常。**旧版へは落ちない**（Backend の 'none' 参照）
    if (markerIsIdb()) {
      backend = 'none';
      return null;
    }
    // 一度も IndexedDB を使えていない端末（古いブラウザ・一部のプライベートモード）。
    // ここで落ちても記録を失わせない。従来どおり localStorage を使う
    backend = 'local';
    return readLocal();
  }

  backend = 'idb';

  if (record != null) {
    // 印を書く前に落ちた起動があると、旧版のコピーが残ったままになる。毎回片付ける
    completeMigration();
    return sanitizeData(record);
  }

  // IndexedDB は開けたが空。前の版の記録があれば、そのまま引き取る
  const legacy = readLocal();
  if (!legacy) {
    completeMigration();
    return null;
  }

  try {
    // 移った先へ確実に入ってから、旧版を消す。順番を逆にすると移行中の事故で記録が消える
    await writeRecord(legacy);
    completeMigration();
  } catch {
    // 書けなかった。旧版はそのまま残っているので、こちらで動かして次の起動に賭ける
    backend = 'local';
  }
  return legacy;
}

/**
 * 保存済みを読む。壊れていれば空から始める。
 *
 * **非同期になった。** 呼ぶのは `main.tsx` の 1 か所だけで、
 * 読み終えてから React を載せる。画面の中に「まだ読んでいない」状態を作らないため
 * （作ると、記録が無い状態と読み込み中が同じ見た目になる画面が増える）。
 *
 * **デモでは、ここで勝手に上書きしない。**
 * 初期データへ戻すのは起動時の確認（DemoNotice）を通ってからで、
 * 断りなく消すと、触った内容が理由の分からないまま消えたように見える。
 * 何も入っていない端末のときだけ、空の画面を見せないためにここで入れる。
 */
export async function loadData(): Promise<AppData> {
  const stored = await readStored();

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

/**
 * いま保存しているデータの大きさ（バイト）。
 *
 * JSON にしたときの長さで測る。IndexedDB は structured clone で持つので
 * 実際の占有とは一致しないが、**増え方を読むための目盛り**としてはこれで足りる。
 *
 * 見るべきなのは天井よりも入力の重さのほう。ただし重いのは書き込みではなく**導出**で、
 * 10年ぶんの生成データでは書き込み 47ms に対して導出が 113ms かかる（`db.ts` 参照）。
 * 保存先を割ってもそちらは軽くならない。
 */
export function storedBytes(data: AppData): number {
  return JSON.stringify(data).length;
}

/* ------------------------------------------------------------------ *
 * 書き込み
 * ------------------------------------------------------------------ */

async function writeOnce(data: AppData): Promise<boolean> {
  // 移行済みなのに開けなかった端末。**どこにも書かない**（記録を上書きしない）
  if (backend === 'none') return false;

  if (backend === 'local') {
    try {
      localStorage.setItem(DATA_KEY, JSON.stringify(data));
      return true;
    } catch {
      return false;
    }
  }
  try {
    await writeRecord(data);
    return true;
  } catch {
    return false;
  }
}

/** 書き込み中のもの。null なら止まっている */
let inflight: Promise<boolean> | null = null;
/** 書き込み中に来た最新の内容。1 つだけ持つ（途中の版を書く意味がない） */
let pending: AppData | null = null;

async function drain(): Promise<boolean> {
  let ok = true;
  while (pending != null) {
    const next = pending;
    pending = null;
    ok = await writeOnce(next);
  }
  inflight = null;
  return ok;
}

/**
 * 保存できたかを返す。**握りつぶさない。**
 *
 * 書けないとき（容量超過・プライベートモード）に黙って戻ると、利用者は打ち続けて、
 * 次に開いたときに初めて消えているのを知る。記録アプリでいちばん重い失敗なので、
 * 結果を呼び出し側へ上げて画面に出す
 * （`useBodyData` の `saveFailed` → `components/StorageAlert.tsx`）。
 *
 * **書き込み中に来た変更は最新の 1 つにまとめる。** 連続して打っているあいだ、
 * 途中の版をすべて書く意味はない。タイマーは持たない——遅らせるほど、
 * 書き終わる前にタブが閉じられる窓が広がる。書けるようになり次第すぐ書く。
 */
export function saveData(data: AppData): Promise<boolean> {
  pending = data;
  inflight ??= drain();
  return inflight;
}

/** 書き込み中のものが片付くまで待つ。テストと、画面を閉じるときに使う */
export function flushSave(): Promise<boolean> {
  return inflight ?? Promise.resolve(true);
}
