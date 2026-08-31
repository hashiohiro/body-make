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

/** グラフと記録で共通の「どちらの記録を見るか」。タブをまたいで保つ */
export type Domain = 'body' | 'training';

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
  version: 7;
  settings: Settings;
  /** 観測レイヤー（測る） */
  entries: Entries;
  /** マイ種目（カタログから選んで手元に置いた種目） */
  exercises: Exercise[];
  /** 行動レイヤー（やる） */
  workouts: Workouts;
  /** 週あたりの部位別セット数の目標 */
  groupGoals: GroupGoals;
  /** よくやる種目の組み合わせ。名前を付けて呼び出す */
  presets: Preset[];
  /** 構成チェックの閾値 */
  checks: CheckSettings;
  /**
   * 許容済みにした警告のキー（`ルール|スコープ`）。
   *
   * 意図して受け入れた警告（ショルダープレスの腰部負荷を承知で置く等）が毎回出続けると、
   * 警告そのものが読み飛ばされるようになる。抑制できないチェックは使われない。
   */
  suppressed: string[];
}

/**
 * その日の種目の組み合わせに名前を付けたもの。
 *
 * 持つのは **種目だけ**。重量もレップも、セット数も持たない。
 * 値まで持たせると「今日やるべき重量」を先に決めることになり、
 * 実績記録型（設計 §1.1）ではなく計画型になる。
 */
export interface Preset {
  /** 生成後は不変 */
  id: string;
  name: string;
  exerciseIds: string[];
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
 * 種目の分類。**有酸素は部位ではない**ので、`MuscleGroup` とは別の型にする。
 *
 * 同じ 1 つの enum にまとめると、部位別セット数・部位の回復・ヒートマップといった
 * 「筋肉の話をしている集計」に有酸素が自動で流れ込む。それらは `Record<MuscleGroup, …>`
 * のままにしておき、**部位として読んでいる箇所はコンパイラに炙り出させる。**
 */
export type ExerciseGroup = MuscleGroup | 'cardio';

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

/**
 * 種目ごとの目標の立て方。
 *
 * 数値を決めるものと、**決めないもの（現状維持）**がある。
 * 種目によっては「これ以上は伸ばさない、いまの水準を保てればいい」が答えになる。
 * 全部の種目に数値を求めると、そう思っている種目にも未達の顔をさせることになる。
 */
/**
 * 目標の測り方。前半 4 つは筋トレ、後半 3 つは有酸素で使う。
 *
 * 有酸素の分を `weight` / `volume` に相乗りさせない。
 * 「重量目標 5」が km を指す状態は、読む側にも書く側にも説明が要る。
 */
export type GoalType =
  | 'maintain'
  | 'weight'
  | 'volume'
  | 'reps'
  /** その日の合計距離（km） */
  | 'distance'
  /** その日の合計時間（分） */
  | 'duration'
  /** 速度（m/分）。**大きいほど良い** に揃えるため、ペース（分/km）では持たない */
  | 'speed';

export interface ExerciseTarget {
  type: GoalType;
  /** 現状維持は数値を持たない */
  value: number | null;
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
 *
 * **有酸素はここを使わない。**距離と時間は `CardioSet` が別に持つ。
 */
export type RepUnit = 'reps' | 'seconds';

export interface Exercise {
  /** 生成後は不変。ログはこれを参照する。カタログ由来は固定 ID、自作は randomUUID */
  id: string;
  name: string;
  /** 主に効かせる部位。有酸素は部位を持たず 'cardio'（種目の並びと目標の見出しに使う） */
  group: ExerciseGroup;
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
  /**
   * 候補一覧から外すか（表示 / 非表示）。
   *
   * **消すことの代わりではなく、選ぶことをやめる印。**
   * 削除は記録ごと消す（元に戻せない）ので、種目を入れ替えるたびに
   * 過去の推移を捨てることになっていた。非表示なら記録はそのまま残る。
   *
   * 外れるのは **これから組む場面** だけ（記録画面の種目選び・プリセットの候補・
   * 種目の目標を追加）。**過去を読む場面には出したまま**にする
   * （推移・記録一覧・その日のカード・保存済みプリセットの中身）。
   * 記録が残っているのに辿り着けないのは、論理削除のいちばん悪い形。
   */
  hidden: boolean;

  /* ---- ここから下は構成チェック（lib/check.ts）だけが読む ---- */

  /**
   * 軸荷重種目か。背骨に荷重を通す種目（デッドリフト・スクワット・RDL・
   * ベントオーバーロウ・ショルダープレスなど）。
   *
   * **大小ではなく真偽で持つ。** 以前は 0〜10 の負荷値で持っていたが、
   * 1 本の数字に時定数の違う 4 つの層（起立筋 24〜72h / 神経系 48〜96h /
   * 椎間板・靭帯 数日〜週 / 骨 週〜月）を代表させていて、どの層としても正しくなかった。
   * アプリが言えるのは **軸荷重をいつ置いたか** までで、腰の状態ではない。
   */
  axial: boolean;
  /**
   * 繰り返して行う種目か。**行を足せるかどうかを決める。**
   *
   * 筋トレはセットを重ねるのが前提だが、有酸素は種目で分かれる。
   * ランニングはふつう通しで 1 回走るもので、そこで知りたいのは「どれだけ走ったか」。
   * インターバル走・水泳（25m×20本）・サーキット（ラウンド）は逆に本数そのものが量。
   *
   * 偽なら記録画面から「＋ 追加」も連番も行の × も消えて、入力欄 2 つだけになる。
   * 既定はカタログが持ち、種目ごとに設定から変えられる（走る人がインターバルもやる）。
   */
  repeated: boolean;
  /**
   * 1 セットあたりの所要時間（分）。**null なら `CheckSettings.minutesPerSet` に落ちる。**
   *
   * 休憩が明らかに長い高重量コンパウンドだけ上書きする。
   * 基本時間（ラック確保・プレートの付け替え）は別に持たない。
   * その固定コストは「この種目の 1 セットは長い」に畳めるので、パラメータが 1 つで済む。
   */
  minutesPerSet: number | null;
}

/**
 * トレーニング種目のレビューの設定。
 *
 * 体組成の目標（`Settings`）とも部位別セット数の目標（`GroupGoals`）とも別のレイヤー。
 * あちらは「どこへ向かうか」で、こちらは「明らかにおかしい構成を弾く線」。
 *
 * **疲労の量を持たない。** 軸荷重も前腕も真偽値で、判定は記録した日付から出る。
 * 推定した量を閾値と比べるのをやめたので、調整する係数は時間まわりだけになった。
 */
export interface CheckSettings {
  /**
   * レビューを表示するか。**既定は false。**
   *
   * 負荷値も所要時間も、入れ終わるまでは判定が当たらない。
   * 使う気になったときに本人が入れるもので、勝手に出はじめると
   * 「よく分からない指摘が出るもの」として最初に閉じられる。
   */
  enabled: boolean;
  /** 1 セッションの上限（分）。null なら時間を見ない */
  sessionMinutes: number | null;
  /**
   * 1 セットあたりの時間（分）の既定値。種目が null のときここに落ちる。
   *
   * **時間のパラメータはこれ 1 つ。** 種目ごとに分数を配ると、根拠のない値が
   * 根拠ありげに並ぶうえ、ずれたときに 75 個のどこを直すか決められなくなる。
   * 既定を 1 つにしておけば、系統的なズレはこの数字 1 つで直る。
   */
  minutesPerSet: number;
}

export interface WorkSet {
  /** kg。自重種目では追加重量。perSide なら片側の値 */
  weight: number | null;
  reps: number | null;
}

/**
 * 有酸素の 1 本。**筋トレのセットとは別の器で持つ。**
 *
 * 距離と時間を `weight` / `reps` に相乗りさせていたときは、
 * 重量の丸め（小数第 1 位）でプールの 25m が 0 になり、
 * レップの値域（1〜100）で 120 分のライドが保存できなかった。
 * 数えているものが違えば、入る値の刻みも幅も違う。
 *
 * **どちらも整数で持つ。**m と 秒 なら丸めが要らず、
 * 「25m」も「90秒」もそのまま入る。表示のとき km と 分に直す。
 */
export interface CardioSet {
  /** m */
  meters: number | null;
  /** 秒 */
  seconds: number | null;
}

/** 1 行ぶんの記録。種目が有酸素かどうかで、どちらが入るかが決まる */
export type SessionSet = WorkSet | CardioSet;

export function isCardioSet(set: SessionSet): set is CardioSet {
  return 'meters' in set || 'seconds' in set;
}

export interface SessionExercise {
  exerciseId: string;
  /** 順序が意味を持つ（ランプアップ／バックオフの判定）ため、並びを保って保存する */
  sets: SessionSet[];
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
  /** 有酸素だけ。その 1 本の距離(m) */
  meters: number | null;
  /** 有酸素だけ。その 1 本の時間(秒) */
  seconds: number | null;
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
  /** 主部位。有酸素は 'cardio' */
  group: ExerciseGroup;
  /** 主部位 + 補助部位。「その部位をやったか」の判定に使う（係数は見ない）。有酸素は空 */
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
  /**
   * 有酸素だけ。そのセッションの合計距離（m）。距離を打っていなければ null。
   * 筋トレの挙上量にあたる「量」。
   *
   * **単位は入力欄と同じ m。**打つのが m なのに目標や合計が km だと、
   * 見るたびに桁を合わせ直すことになる。
   */
  meters: number | null;
  /** 有酸素だけ。そのセッションの合計時間（分）。保存は秒 */
  minutes: number | null;
  /**
   * 有酸素だけ。速度（m/分）= 合計距離 ÷ 合計時間。どちらか欠ければ null。
   *
   * **単位は入力欄に揃える。**距離が m、時間が分なので、割った答えは m/分。
   * km/h に直すと、打った 2 つの数字からどう出た値なのかが読めなくなる。
   *
   * 筋トレの推定1RM にあたる「強度」。**実測 2 つからの導出**なので、
   * 推定1RM と違って経験式を通していない。
   *
   * ペース（分/km）では持たない。小さいほど良い値を 1 つ混ぜると、
   * 自己最高・到達率・停滞判定・グラフの向きがその指標だけ反転する。
   */
  speed: number | null;
  /** 成長の主指標。挙上量が出せない種目は最大レップ数、有酸素は合計距離 */
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
