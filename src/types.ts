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

export type ThemePref = 'system' | 'light' | 'dark';

export interface Settings {
  heightCm: number | null;
  targetWeight: number | null;
  targetBodyFat: number | null;
  /** 'YYYY-MM-DD' */
  targetDate: string | null;
  theme: ThemePref;
}

export interface AppData {
  version: 1;
  settings: Settings;
  entries: Entries;
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
