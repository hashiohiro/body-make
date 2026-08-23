/** 1 日 2 回（朝・夜）計測というエクセル「日次記録」シートの計測設計をそのまま型にしている */
export type SlotId = 'am' | 'pm';

export interface Measurement {
  /** kg */
  weight: number | null;
  /** % */
  bodyFat: number | null;
}

export interface DayEntry {
  am: Measurement;
  pm: Measurement;
}

/** キーは 'YYYY-MM-DD'（ローカル日付） */
export type Entries = Record<string, DayEntry>;

export type ThemePref =
  | 'system'
  | 'light'
  | 'dark'
  // ReRail のプリセットを移したもの（lib/themes.ts と _tokens.scss で対にする）
  | 'indigo-night'
  | 'ocean-blue'
  | 'sakura'
  | 'solarized-light';

export interface Settings {
  heightCm: number | null;
  targetWeight: number | null;
  targetBodyFat: number | null;
  /** 'YYYY-MM-DD' */
  targetDate: string | null;
  theme: ThemePref;
}

export interface AppData {
  version: 2;
  settings: Settings;
  /** 観測レイヤー（測る） */
  entries: Entries;
  /** 種目マスタ */
  exercises: Exercise[];
  /** 行動レイヤー（やる） */
  workouts: Workouts;
  /** 週あたりの部位別セット数の目標 */
  groupGoals: GroupGoals;
}

/** 日次記録シートの 1 行に相当する導出値 */
export interface DailyPoint {
  date: string;
  /** ローカル正午の epoch ms。DST の影響を受けずに日付を x 軸へ写すため */
  time: number;
  am: Measurement;
  pm: Measurement;
  /** 日平均体重 = 朝夕の平均（片方欠測ならある方） */
  weight: number | null;
  /** 日平均体脂肪率 */
  bodyFat: number | null;
  /** 7 日移動平均（後方 7 日窓・欠測日は分母から除外） */
  maWeight: number | null;
  maBodyFat: number | null;
  /** 記録されたスロット数（0〜2）— ストリークと記録率の判定に使う */
  slots: 0 | 1 | 2;
}

/** 週次分析シートの 1 行に相当する導出値（週 = 日曜〜土曜） */
export interface WeekPoint {
  /** 週開始日 'YYYY-MM-DD'（日曜） */
  start: string;
  /** 週終了日 'YYYY-MM-DD'（土曜） */
  end: string;
  /** 'W01' 形式 */
  label: string;
  time: number;
  weight: number | null;
  weightDelta: number | null;
  bodyFat: number | null;
  bodyFatDelta: number | null;
  /** 体脂肪量 = 平均体重 × 平均体脂肪率 / 100（近似） */
  fatMass: number | null;
  /** 除脂肪体重 = 平均体重 − 体脂肪量 */
  leanMass: number | null;
  /** 記録日数 */
  days: number;
}

export interface Projection {
  /** kg/週（負なら減量ペース）。直近 28 日の日平均体重を線形回帰した傾き */
  pacePerWeek: number | null;
  /** 目標到達予測日 'YYYY-MM-DD'。到達しない見込みなら null */
  etaDate: string | null;
  etaDays: number | null;
  /** 0〜1。開始体重→目標体重の到達率 */
  progress: number | null;
  /** 目標日が設定されている場合に必要なペース kg/週 */
  requiredPerWeek: number | null;
}

export interface Stats {
  first: DailyPoint | null;
  latest: DailyPoint | null;
  /** 基準となる現在値（7 日移動平均。単日のブレを除く） */
  currentWeight: number | null;
  currentBodyFat: number | null;
  currentFatMass: number | null;
  currentLeanMass: number | null;
  /** 開始時点の 7 日移動平均（最初に移動平均が立った日の値） */
  startWeight: number | null;
  startBodyFat: number | null;
  startFatMass: number | null;
  startLeanMass: number | null;
  weightDelta: number | null;
  bodyFatDelta: number | null;
  fatMassDelta: number | null;
  leanMassDelta: number | null;
  /** BMI（身長設定時のみ） */
  bmi: number | null;
  /** 連続記録日数（今日 or 昨日から遡る） */
  streak: number;
  bestStreak: number;
  /** 直近 30 日の記録率 0〜1 */
  recordRate: number;
  /** 記録のある日数 */
  recordedDays: number;
  /** 朝夜そろって記録した日数 */
  fullDays: number;
  /** 7 日すべて記録できた週の数 */
  perfectWeeks: number;
  totalSpanDays: number;
}

/* ========================================================================
 * 筋トレ（行動レイヤー）
 *
 * 体重は「測る」＝受動的な観測、筋トレは「やる」＝能動的な行動で、
 * 欠測の意味が違う（体重の空白は測り忘れ、筋トレの空白は休養か記録忘れか区別できない）。
 * そのため entries には混ぜず、同じ日付キー空間の兄弟として持つ。
 * ====================================================================== */

export type MuscleGroup = 'chest' | 'back' | 'legs' | 'shoulders' | 'arms' | 'core';

/**
 * 目標の立て方。加重できる種目は重量、自重種目は回数で決めたいことが多い。
 * どちらで判定するかは種目ごとに選ぶ。
 */
/**
 * 補助部位と、そこに数える割合。
 *
 * 主部位を 1 としたときの比。既定は 0.5（fractional set として広く使われている数え方）。
 * 種目ごとに変えられるのは、補助部位の関与が種目によって違うため。
 * デッドリフトの脚は主働筋なので 1、体幹は保持なので 0.5 が近い。
 */
export interface SubGroup {
  group: MuscleGroup;
  weight: number;
}

export type GoalType = 'weight' | 'reps';

export interface ExerciseTarget {
  type: GoalType;
  value: number;
}

/**
 * 記録した重量をどう数えるか。
 *
 * 「負荷の種類」と「片手ぶんかどうか」を別々に考えさせない。
 * ダンベルなら一律 2 倍、でもない（片手ずつのロウや両手で 1 つ持つ種目は 1 倍）。
 * 選ぶのは器具の名前ではなく、見れば分かる持ち方。
 */
export type LoadMode =
  /** 記録した重量がそのまま負荷（バーベル・マシン・片手ずつのダンベル） */
  | 'standard'
  /** 左右に 1 つずつ持つ。ダンベル 20kg×2 を バーベル 40kg として計上する */
  | 'perSide'
  /** 懸垂・ディップスなど、体重が乗る。weight は追加重量 */
  | 'bodyweight';

/**
 * 2 つ目の入力欄の単位。時間で計る種目は秒で記録する。
 *
 * 挙上量は「重量 × レップ数」なので、秒で数える種目は計上しない。
 * 別のフラグを持たず、単位から決まる。
 */
export type RepUnit = 'reps' | 'seconds';

export interface Exercise {
  /** 生成後は不変。ログはこれを参照する。カタログ由来は固定 ID、自作は randomUUID */
  id: string;
  name: string;
  /** 主に効かせる部位。種目の並びや目標のグループ分けに使う */
  group: MuscleGroup;
  /**
   * 補助的に使う部位。ベンチなら肩と腕など。
   * 部位別の集計では weight ぶんだけ数える（fractional set の数え方）。
   */
  subGroups: SubGroup[];
  loadMode: LoadMode;
  /** 2 つ目の欄を「回」で数えるか「秒」で数えるか */
  repUnit: RepUnit;
  /** 自重種目で体重の何割が乗るか（懸垂 1.0 / 腕立て 0.65 など） */
  bodyweightFactor: number | null;
  /**
   * 1RM 換算の分母 d。`1RM = w × (1 + reps / d)`。
   * 動員する筋量が大きい種目ほど同じ %1RM で反復が伸びるので、種目ごとに変わる。
   * 既定 30（Epley）/ ベンチプレス 40 / スクワット・デッドリフト 33.3。
   */
  rmDivisor: number;
  /** 任意の目標。重量で決めるか回数で決めるかを種目ごとに選ぶ */
  goal: ExerciseTarget | null;
  order: number;
}

export interface WorkSet {
  /** kg。自重種目では追加重量。perSide なら片側の値 */
  weight: number | null;
  reps: number | null;
}

export interface SessionExercise {
  exerciseId: string;
  /** 順序が意味を持つ（ランプアップ／バックオフの判定）ため、並びを保って保存する */
  sets: WorkSet[];
}

/** キーは 'YYYY-MM-DD'（entries と同じローカル日付）。同一種目は 1 日 1 エントリ */
export type Workouts = Record<string, SessionExercise[]>;

/**
 * 週あたりの部位別セット数の目標。null は未設定。
 *
 * 体組成の設定（身長・目標体重）とは別のレイヤーなので Settings には混ぜない。
 * 目標があると「今週の配分」のゲージが進捗として読めるようになる。
 * 無いときは基準値をこちらで発明せず、数値だけを出す。
 */
export type GroupGoals = Record<MuscleGroup, number | null>;

/* ---- 以下は導出値。保存しない ---- */

/**
 * ウォームアップという区別は持たない。
 * 数えたくないセットは書かなければいいだけで、書いたものはすべて実績として数える。
 * アプリが「これはウォームアップだろう」と推測して集計から外すのは、
 * ユーザーが入れていない判断を勝手に足すことになる。
 */
export type SetRole = 'work' | 'top';

export interface SetPoint {
  index: number;
  weight: number | null;
  reps: number | null;
  role: SetRole;
  /** 挙上量に数えるか（欠測・loadType none は false） */
  counted: boolean;
  /** perSide と loadType を解決したあとの重量 */
  effectiveWeight: number | null;
  volume: number | null;
}

export interface ExercisePoint {
  exerciseId: string;
  name: string;
  /** 主部位 */
  group: MuscleGroup;
  /** 主部位 + 補助部位。「その部位をやったか」の判定に使う（係数は見ない） */
  groups: MuscleGroup[];
  /** 補助部位と、その係数。セット数と挙上量の配分に使う */
  subGroups: SubGroup[];
  repUnit: RepUnit;
  sets: SetPoint[];
  /** 最大重量のセット。同率ならレップ最大、それも同率なら最初 */
  top: SetPoint | null;
  volume: number;
  workSets: number;
  reps: number;
  /** 推定または実測の 1RM。アイソレーションでも計算はするが主指標には使わない */
  oneRm: number | null;
  /** reps = 1 の実測が採用されたか（Epley を通していない） */
  measured: boolean;
  /** そのセッションで挙げた最大レップ数（回数目標の判定に使う） */
  maxReps: number | null;
  /** 成長の主指標。挙上量が出せない種目（loadMode none）は最大レップ数 */
  metric: number | null;
}

/**
 * 種目をまたいだ合計（総挙上量・総セット数・総レップ数）は持たない。
 * スクワットの 1,500kg とサイドレイズの 900kg を足した数字は、
 * 何が動いたのかを説明しない。集計は種目ごと（ExercisePoint）で完結させる。
 */
export interface SessionPoint {
  date: string;
  time: number;
  exercises: ExercisePoint[];
}
