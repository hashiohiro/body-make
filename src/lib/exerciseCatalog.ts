import type { Exercise, GoalType, LoadMode, MuscleGroup, RepUnit, SubGroup } from '../types';

/**
 * 種目カタログ。
 *
 * localStorage へ投入する初期データではなく、コード内の不変の一覧。
 * ユーザーが選んだものだけが AppData.exercises に入る。
 * 体重側の seed（seed.ts / SEEDED_KEY）とは別物で、
 * 「一度消したら復活させない」フラグも持たない。消してもここには残るので入れ直せる。
 *
 * id は固定文字列にしてある。削除して入れ直しても過去ログの exerciseId 参照が繋がる。
 * （自作種目は randomUUID なのでこの保証はなく、JSON バックアップだけが担保）
 */
/**
 * 補助部位に数える既定の割合。
 *
 * 0.5 は fractional set として広く使われている数え方。
 * 等倍にすると、押す日にベンチ 9 セットやっただけで肩 9・腕 9 が計上され、
 * カールを 1 セットもやっていない週でも「腕は足りている」と見えてしまう。
 * 配分を見るために入れた補助部位が、配分の信号を潰す。
 */
export const SUB_GROUP_WEIGHT = 0.5;

/** 0 は「補助部位から外す」と同じなので下限を持たせる。上限は主部位と同じ 1 */
export const SUB_GROUP_WEIGHT_RANGE: [number, number] = [0.1, 1];

/**
 * 画面で選ばせる刻み。
 *
 * 自由入力にすると 0.55 と 0.6 を選ぶ判断が要るが、その差に根拠は出せない。
 * 「ほとんど関与しない／半分／主働筋に近い／主部位と同じ」の 4 段で足りる。
 */
export const SUB_GROUP_WEIGHT_STEPS = [0.25, 0.5, 0.75, 1];

/**
 * 構成チェックの値（`loads` / `forearmDirect` / `minutesPerSet`）は
 * カタログの 75 行に散らさず、下の CHECK 表でまとめて持つ。
 *
 * 散らすと「どの種目にどれだけ配ったか」が一望できなくなり、
 * 根拠のない値が紛れ込んでも気づけない。**表に載っていない種目は 0 / null** という
 * 対応が見えていることが、値の少なさをそのまま担保にする。
 */
export type CatalogEntry = Omit<
  Exercise,
  'goal' | 'order' | 'repUnit' | 'subGroups' | 'axial' | 'minutesPerSet'
> & {
  repUnit?: RepUnit;
  /**
   * 補助的に使う部位。明らかなものだけ入れてある。種目の詳細設定で変えられる。
   * 既定の 0.5 と違う割合にしたいものだけ [部位, 割合] で書く
   */
  subGroups?: (MuscleGroup | [MuscleGroup, number])[];
  /**
   * バーベルとダンベルを選べる種目。追加するときに選ぶ。
   *
   * 出す基準は「**同じ動作を、器具を替えてそのまま行えるか**」。
   *   出す   … ベンチプレス、ショルダープレス、カール（軌道が変わらない）
   *            ランジ、ブルガリアンスクワット、カーフレイズ（**何も持たなくても同じ動作**）
   *   出さない … マシン・ケーブル（器具が決まっている）
   *            ダンベルにしか無い種目（フライ、サイドレイズ、ハンマーカール）
   *            自重でしか行わない種目（懸垂、腕立て伏せ、プランク）
   *            器具を替えると別の動作になる種目（スクワット、デッドリフト、ロウ）
   *
   * 自重を選べる種目は、その版だけ `loadMode: 'bodyweight'` と `bodyweightFactor` で作られる。
   * 加重版と同じ 1 種目に混ぜると、体重 70kg と バーベル 40kg が同じ線に並ぶ。
   *
   * 選んだ器具は種目名と「負荷の数え方」に反映され、別の種目として登録される。
   * 同じ 1 種目に混ぜると、バーベル 100kg とダンベル 35kg×2 が同じ線に並んで推移が読めなくなる。
   */
  implements?: Implement[];
  /**
   * 絞り込み用の器具。名前にも「負荷の数え方」にも影響しない。
   *
   * loadMode は「記録した重量をどう換算するか」であって、器具ではない。
   * ワンハンドロウはダンベルだが片手ずつなので standard、
   * クランチは自重だが体重を挙上量に足さないので standard になる。
   * 絞り込みを loadMode で代用すると、こういう種目が「バーベル・マシン」に出る。
   *
   * 省略はバーベル・マシン。ダンベル専用・自重の種目は必ず書く
   */
  equipment?: Equipment;
};

export type Implement = 'barbell' | 'dumbbell' | 'bodyweight';

export type Equipment = Implement;

const BOTH: Implement[] = ['barbell', 'dumbbell'];
/** 加重でも自重でも同じ動作でやる種目（ランジ・ブルガリアンスクワットなど） */
const BOTH_OR_BW: Implement[] = ['barbell', 'dumbbell', 'bodyweight'];

/**
 * 目標の立て方のラベル。一覧では ↑ を付けた短い形でバッジにする。
 * 「維持」だけ矢印を持たない（伸ばさないと決めたもの）。
 */
export const GOAL_TYPE_LABELS: Record<GoalType, string> = {
  maintain: '維持',
  weight: '重量',
  volume: '挙上量',
  reps: '回数',
};

/** 秒で数える種目は「回数」ではなく「秒数」。バッジは矢印つき */
export function goalTypeLabel(type: GoalType, repUnit: RepUnit, arrow = false): string {
  const base = type === 'reps' && repUnit === 'seconds' ? '秒数' : GOAL_TYPE_LABELS[type];
  return arrow && type !== 'maintain' ? `${base}↑` : base;
}

export const IMPLEMENT_LABELS: Record<Implement, string> = {
  barbell: 'バーベル',
  dumbbell: 'ダンベル',
  bodyweight: '自重',
};

/**
 * 器具ごとの ID の接尾辞。
 * バーベルは既存の ID をそのまま使う（過去ログの参照先なので変えられない）。
 */
const IMPLEMENT_SUFFIX: Record<Implement, string> = {
  barbell: '',
  dumbbell: '_db',
  bodyweight: '_bw',
};

const RM_BENCH = 40;
const RM_SQUAT_DEADLIFT = 33.3;
const RM_DEFAULT = 30;

/**
 * 左右に 1 つずつ持つ種目だけ perSide。片手ずつ・両手で 1 つの種目は standard。
 *
 * 補助部位は既定で 0.5 セットとして数える（SUB_GROUP_WEIGHT）。
 * 半分で数えるので、**効いた実感のある部位は入れる**方針にしてある。
 * 等尺性に支えるだけの筋（スクワットの腹圧、デッドリフトの脊柱起立筋）も入れる。
 * 等倍だと押す日のベンチだけで腕の目標が埋まるので絞る必要があったが、
 * 係数が入った今は、絞ることのほうが実感とのズレを生む。
 *
 * それでも入れないのは、関与が小さく実感も伴わないもの
 * （サイドレイズの僧帽上部、デッドリフトのグリップなど）。
 *
 * 主働筋なのに主部位に置けないものは、係数を 1 にして等倍で数える
 * （デッドリフトの脚。主部位を背中にしたぶん、脚が半分になってしまうため）。
 */
/* ------------------------------------------------------------------ *
 * 構成チェックの値（lib/check.ts が読む）
 *
 * ここに載っていない種目は 負荷 0 / 前腕直接でない / 時間は既定値。
 * **順序が明確な種目にだけ値を置く。** 75 種すべてに数値を並べると、
 * 根拠のない値まで根拠があるように見え、過信を招く。
 * 埋まっていない範囲は設定画面が件数で出す（穴を見えるようにする）。
 * ------------------------------------------------------------------ */

/**
 * 軸荷重種目。**背骨に荷重を通し、体幹で支える種目。**
 *
 * 以前は 0〜10 の負荷値で持っていたが、1 本の数字に時定数の違う層を混ぜていた。
 * 真偽値なら順序を決める必要がなく、「RDL は 8 か 0 か」という答えの出ない問いも消える。
 *
 * 背中がパッドやシートで支えられる種目（レッグプレス・ハックスクワット・マシン全般）は入らない。
 */
const AXIAL: ReadonlySet<string> = new Set([
  'ex_deadlift',
  'ex_squat',
  'ex_front_squat',
  'ex_rdl',
  'ex_good_morning',
  'ex_military_press',
  'ex_bb_row',
  'ex_t_bar_row',
  'ex_back_extension',
  'ex_ohp',
  'ex_hip_thrust',
  'ex_shrug',
  'ex_ab_roller',
]);

/**
 * 1 セットあたりの時間（分）の上書き。**休憩が明らかに長い高重量コンパウンドだけ。**
 * 根拠は 1 文で書ける ——「高重量コンパウンドは休憩が長い」。
 *
 * 載っていない種目は `CheckSettings.minutesPerSet`（既定 3 分）に落ちる。
 * ラック確保やプレートの付け替えといった固定コストも、この値に畳んである
 * （基本時間を別に持たない／design-checks.md §3.1）。
 */
const MINUTES_PER_SET: Readonly<Record<string, number>> = {
  ex_deadlift: 4.5,
  ex_squat: 4.5,
  ex_bench: 4.5,
  ex_ohp: 4.5,
  ex_rdl: 4.5,
};

/**
 * レビュー用の値を持たない状態。自作種目の初期値。
 *
 * 自作種目を作るときに聞くのは 名前・部位・負荷の数え方・回数の単位 の 4 つのまま
 * （design-training.md §11-23 がわざわざ 4 つに減らした経緯があるので、そこは動かさない）。
 * 軸荷重かどうかと時間は、必要になったら種目の設定から入れる。
 */
export function emptyCheckValues(): Pick<Exercise, 'axial' | 'minutesPerSet'> {
  return { axial: false, minutesPerSet: null };
}

export const CATALOG: readonly CatalogEntry[] = [
  // 胸
  {
    id: 'ex_bench',
    implements: BOTH,
    name: 'ベンチプレス',
    group: 'chest',
    subGroups: ['shoulders', 'arms'],
    loadMode: 'standard',
    bodyweightFactor: null,
    rmDivisor: RM_BENCH,
  },
  {
    id: 'ex_incline_bench',
    implements: BOTH,
    name: 'インクラインベンチプレス',
    group: 'chest',
    subGroups: ['shoulders', 'arms'],
    loadMode: 'standard',
    bodyweightFactor: null,
    rmDivisor: RM_DEFAULT,
  },
  {
    id: 'ex_chest_press',
    name: 'チェストプレス',
    group: 'chest',
    subGroups: ['shoulders', 'arms'],
    loadMode: 'standard',
    bodyweightFactor: null,
    rmDivisor: RM_DEFAULT,
  },
  {
    id: 'ex_db_fly',
    equipment: 'dumbbell',
    name: 'ダンベルフライ',
    group: 'chest',
    subGroups: [['shoulders', 0.25]],
    loadMode: 'perSide',
    bodyweightFactor: null,
    rmDivisor: RM_DEFAULT,
  },
  {
    id: 'ex_dips',
    equipment: 'bodyweight',
    name: 'ディップス',
    group: 'chest',
    subGroups: ['shoulders', ['arms', 0.75]],
    loadMode: 'bodyweight',
    bodyweightFactor: 1,
    rmDivisor: RM_DEFAULT,
  },
  {
    id: 'ex_decline_bench',
    implements: BOTH,
    name: 'デクラインベンチプレス',
    group: 'chest',
    subGroups: ['shoulders', 'arms'],
    loadMode: 'standard',
    bodyweightFactor: null,
    rmDivisor: RM_DEFAULT,
  },
  {
    id: 'ex_pec_fly',
    name: 'ペックフライ',
    group: 'chest',
    subGroups: [['shoulders', 0.25]],
    loadMode: 'standard',
    bodyweightFactor: null,
    rmDivisor: RM_DEFAULT,
  },
  {
    id: 'ex_pushup',
    equipment: 'bodyweight',
    name: '腕立て伏せ',
    group: 'chest',
    subGroups: ['shoulders', 'arms'],
    loadMode: 'bodyweight',
    bodyweightFactor: 0.65,
    rmDivisor: RM_DEFAULT,
  },

  {
    id: 'ex_knee_pushup',
    equipment: 'bodyweight',
    name: '膝つき腕立て伏せ',
    group: 'chest',
    subGroups: ['shoulders', 'arms'],
    loadMode: 'bodyweight',
    // 膝から下を床に残すぶん、通常の腕立てより軽い
    bodyweightFactor: 0.5,
    rmDivisor: RM_DEFAULT,
  },

  {
    id: 'ex_wide_pushup',
    equipment: 'bodyweight',
    name: 'ワイドプッシュアップ',
    group: 'chest',
    // 手幅を広げるぶん、腕より胸に寄る
    subGroups: [
      ['shoulders', 0.5],
      ['arms', 0.25],
    ],
    loadMode: 'bodyweight',
    bodyweightFactor: 0.65,
    rmDivisor: RM_DEFAULT,
  },
  {
    id: 'ex_decline_pushup',
    equipment: 'bodyweight',
    name: 'デクラインプッシュアップ',
    group: 'chest',
    subGroups: ['shoulders', 'arms'],
    loadMode: 'bodyweight',
    // 足を台に乗せるぶん、手にかかる体重が増える
    bodyweightFactor: 0.75,
    rmDivisor: RM_DEFAULT,
  },

  {
    id: 'ex_pullover',
    equipment: 'dumbbell',
    /*
     * 両手で 1 つ持つので perSide にしない。
     * 胸か背中かは人によって使い方が違うので、部位は種目の設定から変えられる。
     */
    name: 'ダンベルプルオーバー',
    group: 'chest',
    subGroups: ['back'],
    loadMode: 'standard',
    bodyweightFactor: null,
    rmDivisor: RM_DEFAULT,
  },
  {
    id: 'ex_cable_crossover',
    // ケーブル。可動域の終わりまで張力が残るのがフライとの違い
    name: 'ケーブルクロスオーバー',
    group: 'chest',
    subGroups: [['shoulders', 0.25]],
    loadMode: 'standard',
    bodyweightFactor: null,
    rmDivisor: RM_DEFAULT,
  },
  // 背中
  {
    id: 'ex_deadlift',
    name: 'デッドリフト',
    group: 'back',
    subGroups: [['legs', 1], ['arms', 0.25], 'core'],
    loadMode: 'standard',
    bodyweightFactor: null,
    rmDivisor: RM_SQUAT_DEADLIFT,
  },
  {
    id: 'ex_bb_row',
    name: 'ベントオーバーロウ',
    group: 'back',
    subGroups: [['shoulders', 0.25], 'arms'],
    loadMode: 'standard',
    bodyweightFactor: null,
    rmDivisor: RM_DEFAULT,
  },
  {
    id: 'ex_lat_pulldown',
    name: 'ラットプルダウン',
    group: 'back',
    subGroups: [['shoulders', 0.25], 'arms'],
    loadMode: 'standard',
    bodyweightFactor: null,
    rmDivisor: RM_DEFAULT,
  },
  {
    id: 'ex_seated_row',
    name: 'シーテッドロウ',
    group: 'back',
    subGroups: [['shoulders', 0.25], 'arms'],
    loadMode: 'standard',
    bodyweightFactor: null,
    rmDivisor: RM_DEFAULT,
  },
  {
    id: 'ex_pullup',
    equipment: 'bodyweight',
    name: '懸垂',
    group: 'back',
    subGroups: [['shoulders', 0.25], 'arms'],
    loadMode: 'bodyweight',
    bodyweightFactor: 1,
    rmDivisor: RM_DEFAULT,
  },
  {
    id: 'ex_one_arm_row',
    equipment: 'dumbbell',
    name: 'ワンハンドロウ',
    group: 'back',
    subGroups: [['shoulders', 0.25], 'arms'],
    loadMode: 'standard',
    bodyweightFactor: null,
    rmDivisor: RM_DEFAULT,
  },
  {
    id: 'ex_t_bar_row',
    name: 'Tバーロウ',
    group: 'back',
    subGroups: [['shoulders', 0.25], 'arms'],
    loadMode: 'standard',
    bodyweightFactor: null,
    rmDivisor: RM_DEFAULT,
  },
  // 主働筋は僧帽上部。握力の保持もあるので腕を少しだけ数える
  {
    id: 'ex_shrug',
    implements: BOTH,
    name: 'シュラッグ',
    group: 'back',
    subGroups: [['arms', 0.25]],
    loadMode: 'standard',
    bodyweightFactor: null,
    rmDivisor: RM_DEFAULT,
  },
  // 股関節伸展が主体で、ハムと大臀筋の関与が大きい
  {
    id: 'ex_back_extension',
    equipment: 'bodyweight',
    name: 'バックエクステンション',
    group: 'back',
    subGroups: [['legs', 0.75]],
    loadMode: 'bodyweight',
    bodyweightFactor: 0.5,
    rmDivisor: RM_DEFAULT,
  },

  {
    id: 'ex_chinup',
    equipment: 'bodyweight',
    name: '逆手懸垂',
    group: 'back',
    // 手のひらを自分に向けて引く。順手より上腕二頭の関与が大きい
    subGroups: [
      ['shoulders', 0.25],
      ['arms', 0.75],
    ],
    loadMode: 'bodyweight',
    bodyweightFactor: 1,
    rmDivisor: RM_DEFAULT,
  },
  {
    id: 'ex_inverted_row',
    equipment: 'bodyweight',
    name: '斜め懸垂',
    group: 'back',
    subGroups: ['arms'],
    loadMode: 'bodyweight',
    // 足を床に残すので、上がるのは体重の半分ほど
    bodyweightFactor: 0.5,
    rmDivisor: RM_DEFAULT,
  },

  {
    id: 'ex_superman',
    equipment: 'bodyweight',
    name: 'スーパーマン',
    group: 'back',
    subGroups: [['legs', 0.25]],
    // うつ伏せで手足を上げる。台が要らない床の背中種目
    loadMode: 'standard',
    bodyweightFactor: null,
    rmDivisor: RM_DEFAULT,
  },

  {
    id: 'ex_chest_supported_row',
    // 胸をパッドに預けるので、前傾の保持が要らない（＝軸荷重にならない）
    name: 'チェストサポーテッドロウ',
    group: 'back',
    subGroups: [['shoulders', 0.25], 'arms'],
    loadMode: 'standard',
    bodyweightFactor: null,
    rmDivisor: RM_DEFAULT,
  },
  {
    id: 'ex_straight_arm_pulldown',
    // 肘を曲げないので腕は数えない。広背筋の単関節種目
    name: 'ストレートアームプルダウン',
    group: 'back',
    loadMode: 'standard',
    bodyweightFactor: null,
    rmDivisor: RM_DEFAULT,
  },
  // 脚
  {
    id: 'ex_squat',
    name: 'スクワット',
    group: 'legs',
    subGroups: [['core', 0.25]],
    loadMode: 'standard',
    bodyweightFactor: null,
    rmDivisor: RM_SQUAT_DEADLIFT,
  },
  {
    id: 'ex_front_squat',
    name: 'フロントスクワット',
    group: 'legs',
    subGroups: ['core'],
    loadMode: 'standard',
    bodyweightFactor: null,
    rmDivisor: RM_DEFAULT,
  },
  {
    id: 'ex_leg_press',
    name: 'レッグプレス',
    group: 'legs',
    loadMode: 'standard',
    bodyweightFactor: null,
    rmDivisor: RM_DEFAULT,
  },
  {
    id: 'ex_rdl',
    name: 'ルーマニアンデッドリフト',
    group: 'legs',
    subGroups: ['back'],
    loadMode: 'standard',
    bodyweightFactor: null,
    rmDivisor: RM_DEFAULT,
  },
  {
    id: 'ex_leg_extension',
    name: 'レッグエクステンション',
    group: 'legs',
    loadMode: 'standard',
    bodyweightFactor: null,
    rmDivisor: RM_DEFAULT,
  },
  {
    id: 'ex_leg_curl',
    name: 'レッグカール',
    group: 'legs',
    loadMode: 'standard',
    bodyweightFactor: null,
    rmDivisor: RM_DEFAULT,
  },
  {
    id: 'ex_calf_raise',
    // 何も持たずに立って踵を上げるだけでも成立する。ダンベル版は片手持ちが普通なので出さない
    implements: ['barbell', 'bodyweight'],
    name: 'カーフレイズ',
    group: 'legs',
    loadMode: 'standard',
    // 自重版で使う。爪先立ちで体のほぼ全部が上がる
    bodyweightFactor: 0.9,
    rmDivisor: RM_DEFAULT,
  },
  {
    id: 'ex_seated_calf_raise',
    // 膝を曲げるのでヒラメ筋が主体。立って行うカーフレイズとは効く筋が変わる
    name: 'シーテッドカーフレイズ',
    group: 'legs',
    loadMode: 'standard',
    bodyweightFactor: null,
    rmDivisor: RM_DEFAULT,
  },
  {
    id: 'ex_hack_squat',
    name: 'ハックスクワット',
    group: 'legs',
    loadMode: 'standard',
    bodyweightFactor: null,
    rmDivisor: RM_DEFAULT,
  },
  // 片脚で立つぶん、体幹の関与は両脚のスクワットより大きい
  {
    id: 'ex_lunge',
    implements: BOTH_OR_BW,
    name: 'ランジ',
    group: 'legs',
    subGroups: [['core', 0.5]],
    loadMode: 'standard',
    // 自重版で使う。踏み出した脚に体のほとんどが乗る
    bodyweightFactor: 0.7,
    rmDivisor: RM_DEFAULT,
  },
  {
    id: 'ex_bulgarian_squat',
    implements: BOTH_OR_BW,
    name: 'ブルガリアンスクワット',
    group: 'legs',
    subGroups: [['core', 0.5]],
    loadMode: 'standard',
    // 自重版で使う。後ろ足は台に置くだけなので、前脚がほぼ全部を受ける
    bodyweightFactor: 0.75,
    rmDivisor: RM_DEFAULT,
  },
  {
    id: 'ex_hip_thrust',
    name: 'ヒップスラスト',
    group: 'legs',
    subGroups: [['core', 0.25]],
    loadMode: 'standard',
    bodyweightFactor: null,
    rmDivisor: RM_DEFAULT,
  },

  {
    id: 'ex_bw_squat',
    equipment: 'bodyweight',
    name: '自重スクワット',
    group: 'legs',
    subGroups: [['core', 0.25]],
    loadMode: 'bodyweight',
    // 脛から下は上がらない。腕立てと同じ扱いにする
    bodyweightFactor: 0.65,
    rmDivisor: RM_DEFAULT,
  },
  {
    id: 'ex_step_up',
    equipment: 'bodyweight',
    name: 'ステップアップ',
    group: 'legs',
    subGroups: [['core', 0.25]],
    loadMode: 'bodyweight',
    // 片脚で体を台まで持ち上げる
    bodyweightFactor: 0.8,
    rmDivisor: RM_DEFAULT,
  },
  {
    id: 'ex_hip_lift',
    equipment: 'bodyweight',
    name: 'ヒップリフト',
    group: 'legs',
    subGroups: [
      ['back', 0.25],
      ['core', 0.25],
    ],
    loadMode: 'bodyweight',
    // 床から腰を上げるだけなので、上がるのは体の一部
    bodyweightFactor: 0.4,
    rmDivisor: RM_DEFAULT,
  },
  {
    id: 'ex_nordic_curl',
    equipment: 'bodyweight',
    name: 'ノルディックハムカール',
    group: 'legs',
    subGroups: [['core', 0.25]],
    loadMode: 'bodyweight',
    // 膝から上ぜんぶをハムストリングスで支える
    bodyweightFactor: 0.6,
    rmDivisor: RM_DEFAULT,
  },
  {
    id: 'ex_wall_sit',
    equipment: 'bodyweight',
    name: 'ウォールシット',
    group: 'legs',
    // 動かないので挙上量には乗らない。プランクと同じく秒で数える
    loadMode: 'standard',
    bodyweightFactor: null,
    rmDivisor: RM_DEFAULT,
    repUnit: 'seconds',
  },

  {
    id: 'ex_split_squat',
    equipment: 'bodyweight',
    name: 'スプリットスクワット',
    group: 'legs',
    // 後ろ足も床に置く。台に乗せるブルガリアンより後ろ脚が支えるぶん軽い
    subGroups: [['core', 0.25]],
    loadMode: 'bodyweight',
    bodyweightFactor: 0.7,
    rmDivisor: RM_DEFAULT,
  },
  {
    id: 'ex_side_lunge',
    equipment: 'bodyweight',
    name: 'サイドランジ',
    group: 'legs',
    subGroups: [['core', 0.25]],
    loadMode: 'bodyweight',
    bodyweightFactor: 0.7,
    rmDivisor: RM_DEFAULT,
  },

  {
    id: 'ex_good_morning',
    // 股関節伸展。RDL と同じヒンジだが、バーが背中にある分だけ体幹の保持が大きい
    name: 'グッドモーニング',
    group: 'legs',
    subGroups: ['back'],
    loadMode: 'standard',
    bodyweightFactor: null,
    rmDivisor: RM_DEFAULT,
  },
  {
    id: 'ex_hip_abduction',
    name: 'アブダクション',
    group: 'legs',
    loadMode: 'standard',
    bodyweightFactor: null,
    rmDivisor: RM_DEFAULT,
  },
  {
    id: 'ex_hip_adduction',
    name: 'アダクション',
    group: 'legs',
    loadMode: 'standard',
    bodyweightFactor: null,
    rmDivisor: RM_DEFAULT,
  },
  // 肩
  {
    id: 'ex_ohp',
    implements: BOTH,
    name: 'ショルダープレス',
    group: 'shoulders',
    subGroups: ['arms'],
    loadMode: 'standard',
    bodyweightFactor: null,
    rmDivisor: RM_DEFAULT,
  },
  {
    id: 'ex_lateral_raise',
    equipment: 'dumbbell',
    name: 'サイドレイズ',
    group: 'shoulders',
    subGroups: [['back', 0.25]],
    loadMode: 'perSide',
    bodyweightFactor: null,
    rmDivisor: RM_DEFAULT,
  },
  {
    id: 'ex_rear_raise',
    equipment: 'dumbbell',
    name: 'リアレイズ',
    group: 'shoulders',
    subGroups: [['back', 0.75]],
    loadMode: 'perSide',
    bodyweightFactor: null,
    rmDivisor: RM_DEFAULT,
  },
  // 前部三角筋。大胸筋上部も引かれる
  {
    id: 'ex_front_raise',
    equipment: 'dumbbell',
    name: 'フロントレイズ',
    group: 'shoulders',
    subGroups: [['chest', 0.25]],
    loadMode: 'perSide',
    bodyweightFactor: null,
    rmDivisor: RM_DEFAULT,
  },
  // 後部三角筋と、僧帽中下部・菱形筋。上背部の種目としての性格が強い
  {
    id: 'ex_face_pull',
    name: 'フェイスプル',
    group: 'shoulders',
    subGroups: ['back'],
    loadMode: 'standard',
    bodyweightFactor: null,
    rmDivisor: RM_DEFAULT,
  },
  {
    id: 'ex_upright_row',
    implements: BOTH,
    name: 'アップライトロウ',
    group: 'shoulders',
    subGroups: ['back', ['arms', 0.25]],
    loadMode: 'standard',
    bodyweightFactor: null,
    rmDivisor: RM_DEFAULT,
  },

  {
    id: 'ex_pike_pushup',
    equipment: 'bodyweight',
    name: 'パイクプッシュアップ',
    group: 'shoulders',
    subGroups: [['chest', 0.25], 'arms'],
    loadMode: 'bodyweight',
    // 腰を高く折るぶん、体重の多くが肩に乗る
    bodyweightFactor: 0.6,
    rmDivisor: RM_DEFAULT,
  },
  {
    id: 'ex_handstand_pushup',
    equipment: 'bodyweight',
    name: '逆立ち腕立て伏せ',
    group: 'shoulders',
    subGroups: ['arms', ['core', 0.25]],
    loadMode: 'bodyweight',
    bodyweightFactor: 0.9,
    rmDivisor: RM_DEFAULT,
  },

  {
    id: 'ex_wall_handstand',
    equipment: 'bodyweight',
    name: '壁倒立',
    group: 'shoulders',
    subGroups: [
      ['arms', 0.5],
      ['core', 0.25],
    ],
    // 静止して支える。挙上量には乗せず、秒で数える
    loadMode: 'standard',
    bodyweightFactor: null,
    rmDivisor: RM_DEFAULT,
    repUnit: 'seconds',
  },
  {
    id: 'ex_shoulder_tap',
    equipment: 'bodyweight',
    name: 'ショルダータップ',
    group: 'shoulders',
    // 腕立ての姿勢で片手を離す。上げ下げはしないので挙上量には乗せない
    subGroups: [
      ['chest', 0.25],
      ['core', 0.5],
    ],
    loadMode: 'standard',
    bodyweightFactor: null,
    rmDivisor: RM_DEFAULT,
  },

  {
    id: 'ex_military_press',
    /*
     * 立って、足を揃えてバーベルを頭上へ。
     * ショルダープレス（バーベル）と軌道は同じだが、座位で支えが取れない分だけ
     * 扱える重量が変わる。同じ 1 種目に混ぜると推移が読めなくなるので分けてある
     * （バーベルとダンベルを分けているのと同じ理由）。
     */
    name: 'ミリタリープレス',
    group: 'shoulders',
    subGroups: ['arms', ['core', 0.25]],
    loadMode: 'standard',
    bodyweightFactor: null,
    rmDivisor: RM_DEFAULT,
  },
  {
    id: 'ex_arnold_press',
    equipment: 'dumbbell',
    // 回旋を伴うので前部から中部まで通る
    name: 'アーノルドプレス',
    group: 'shoulders',
    subGroups: ['arms'],
    loadMode: 'perSide',
    bodyweightFactor: null,
    rmDivisor: RM_DEFAULT,
  },
  // 腕
  {
    id: 'ex_curl',
    implements: BOTH,
    name: 'カール',
    group: 'arms',
    loadMode: 'standard',
    bodyweightFactor: null,
    rmDivisor: RM_DEFAULT,
  },
  {
    id: 'ex_reverse_curl',
    implements: BOTH,
    name: 'リバースカール',
    group: 'arms',
    loadMode: 'standard',
    bodyweightFactor: null,
    rmDivisor: RM_DEFAULT,
  },
  {
    id: 'ex_hammer_curl',
    equipment: 'dumbbell',
    name: 'ハンマーカール',
    group: 'arms',
    loadMode: 'perSide',
    bodyweightFactor: null,
    rmDivisor: RM_DEFAULT,
  },
  {
    id: 'ex_wrist_curl',
    name: 'リストカール',
    group: 'arms',
    loadMode: 'standard',
    bodyweightFactor: null,
    rmDivisor: RM_DEFAULT,
  },
  {
    id: 'ex_reverse_wrist_curl',
    name: 'リバースリストカール',
    group: 'arms',
    loadMode: 'standard',
    bodyweightFactor: null,
    rmDivisor: RM_DEFAULT,
  },
  {
    id: 'ex_pushdown',
    name: 'トライセプスプレスダウン',
    group: 'arms',
    loadMode: 'standard',
    bodyweightFactor: null,
    rmDivisor: RM_DEFAULT,
  },
  {
    id: 'ex_skull_crusher',
    name: 'スカルクラッシャー',
    group: 'arms',
    loadMode: 'standard',
    bodyweightFactor: null,
    rmDivisor: RM_DEFAULT,
  },
  {
    id: 'ex_preacher_curl',
    name: 'プリーチャーカール',
    group: 'arms',
    loadMode: 'standard',
    bodyweightFactor: null,
    rmDivisor: RM_DEFAULT,
  },
  {
    id: 'ex_overhead_extension',
    name: 'オーバーヘッドエクステンション',
    group: 'arms',
    loadMode: 'standard',
    bodyweightFactor: null,
    rmDivisor: RM_DEFAULT,
  },
  {
    id: 'ex_kickback',
    equipment: 'dumbbell',
    name: 'キックバック',
    group: 'arms',
    loadMode: 'standard',
    bodyweightFactor: null,
    rmDivisor: RM_DEFAULT,
  },
  // 三頭が主働筋だが、胸の関与も大きい。ベンチの派生なので換算の分母も同じ
  {
    id: 'ex_close_grip_bench',
    name: 'ナローグリップベンチプレス',
    group: 'arms',
    subGroups: [
      ['chest', 0.75],
      ['shoulders', 0.25],
    ],
    loadMode: 'standard',
    bodyweightFactor: null,
    rmDivisor: RM_DEFAULT,
  },

  {
    id: 'ex_diamond_pushup',
    equipment: 'bodyweight',
    name: 'ダイヤモンドプッシュアップ',
    group: 'arms',
    // 手を狭く組む腕立て。三頭に寄るぶん、胸は主部位から外れる
    subGroups: [
      ['chest', 0.75],
      ['shoulders', 0.25],
    ],
    loadMode: 'bodyweight',
    bodyweightFactor: 0.65,
    rmDivisor: RM_DEFAULT,
  },
  {
    id: 'ex_bench_dips',
    equipment: 'bodyweight',
    name: 'ベンチディップス',
    group: 'arms',
    subGroups: [
      ['chest', 0.25],
      ['shoulders', 0.25],
    ],
    loadMode: 'bodyweight',
    // 足を床に残すので、ディップスより軽い
    bodyweightFactor: 0.45,
    rmDivisor: RM_DEFAULT,
  },

  {
    id: 'ex_underhand_inverted_row',
    equipment: 'bodyweight',
    name: '逆手斜め懸垂',
    group: 'arms',
    // 逆手で引くと上腕二頭が主役になる。順手の斜め懸垂は背中に置いてある
    subGroups: [['back', 0.75]],
    loadMode: 'bodyweight',
    bodyweightFactor: 0.5,
    rmDivisor: RM_DEFAULT,
  },

  {
    id: 'ex_concentration_curl',
    equipment: 'dumbbell',
    // 片手ずつなので perSide にしない（記録した重量がそのまま負荷）
    name: 'コンセントレーションカール',
    group: 'arms',
    loadMode: 'standard',
    bodyweightFactor: null,
    rmDivisor: RM_DEFAULT,
  },
  {
    id: 'ex_incline_curl',
    equipment: 'dumbbell',
    name: 'インクラインダンベルカール',
    group: 'arms',
    loadMode: 'perSide',
    bodyweightFactor: null,
    rmDivisor: RM_DEFAULT,
  },
  // 体幹
  {
    id: 'ex_hanging_leg_raise',
    equipment: 'bodyweight',
    name: 'ハンギングレッグレイズ',
    group: 'core',
    subGroups: [['legs', 0.25]],
    loadMode: 'bodyweight',
    bodyweightFactor: 0.5,
    rmDivisor: RM_DEFAULT,
  },
  {
    id: 'ex_cable_crunch',
    name: 'ケーブルクランチ',
    group: 'core',
    loadMode: 'standard',
    bodyweightFactor: null,
    rmDivisor: RM_DEFAULT,
  },
  // 秒で数える種目は挙上量に計上しない（単位から決まるので、種目側にフラグを持たない）。
  // アブローラーは重量を記録しないので、そのまま計上しても 0 になる
  {
    id: 'ex_ab_roller',
    equipment: 'bodyweight',
    name: 'アブローラー',
    group: 'core',
    subGroups: [['back', 0.25]],
    loadMode: 'standard',
    bodyweightFactor: null,
    rmDivisor: RM_DEFAULT,
  },
  {
    id: 'ex_plank',
    equipment: 'bodyweight',
    name: 'プランク',
    group: 'core',
    loadMode: 'standard',
    bodyweightFactor: null,
    rmDivisor: RM_DEFAULT,
    repUnit: 'seconds',
  },
  {
    id: 'ex_side_plank',
    equipment: 'bodyweight',
    name: 'サイドプランク',
    group: 'core',
    loadMode: 'standard',
    bodyweightFactor: null,
    rmDivisor: RM_DEFAULT,
    repUnit: 'seconds',
  },
  {
    id: 'ex_crunch',
    equipment: 'bodyweight',
    name: 'クランチ',
    group: 'core',
    loadMode: 'standard',
    bodyweightFactor: null,
    rmDivisor: RM_DEFAULT,
  },
  {
    id: 'ex_russian_twist',
    equipment: 'bodyweight',
    name: 'ロシアンツイスト',
    group: 'core',
    loadMode: 'standard',
    bodyweightFactor: null,
    rmDivisor: RM_DEFAULT,
  },
  {
    id: 'ex_leg_raise',
    equipment: 'bodyweight',
    name: 'レッグレイズ',
    group: 'core',
    subGroups: [['legs', 0.25]],
    // 床に寝て行う。クランチと同じく体重は挙上量に乗せない
    loadMode: 'standard',
    bodyweightFactor: null,
    rmDivisor: RM_DEFAULT,
  },
  {
    id: 'ex_mountain_climber',
    equipment: 'bodyweight',
    name: 'マウンテンクライマー',
    group: 'core',
    subGroups: [
      ['legs', 0.25],
      ['shoulders', 0.25],
    ],
    // 姿勢を保ったまま脚を動かす。体重は挙上量に乗せない
    loadMode: 'standard',
    bodyweightFactor: null,
    rmDivisor: RM_DEFAULT,
  },
  {
    id: 'ex_dead_bug',
    equipment: 'bodyweight',
    name: 'デッドバグ',
    group: 'core',
    loadMode: 'standard',
    bodyweightFactor: null,
    rmDivisor: RM_DEFAULT,
  },
  {
    id: 'ex_situp',
    equipment: 'bodyweight',
    // 上体を起こしきる。可動域が狭いクランチとは別の種目として扱う
    name: 'シットアップ',
    group: 'core',
    subGroups: [['legs', 0.25]],
    loadMode: 'standard',
    bodyweightFactor: null,
    rmDivisor: RM_DEFAULT,
  },
  {
    id: 'ex_bicycle_crunch',
    equipment: 'bodyweight',
    name: 'バイシクルクランチ',
    group: 'core',
    loadMode: 'standard',
    bodyweightFactor: null,
    rmDivisor: RM_DEFAULT,
  },
  {
    id: 'ex_pallof_press',
    // 回旋に抗して耐える種目。動かさないことが目的なので、レップ数より保持の質で見る
    name: 'パロフプレス',
    group: 'core',
    loadMode: 'standard',
    bodyweightFactor: null,
    rmDivisor: RM_DEFAULT,
  },
];

export const GROUP_LABELS: Record<MuscleGroup, string> = {
  chest: '胸',
  back: '背中',
  legs: '脚',
  shoulders: '肩',
  arms: '腕',
  core: '体幹',
};

export const GROUP_ORDER: MuscleGroup[] = ['chest', 'back', 'legs', 'shoulders', 'arms', 'core'];

/**
 * 種目 ID の並びから、やる部位の並びを作る（「胸・肩・腕」）。
 * プリセットは名前だけでは中身を思い出せないので、記録画面でも設定でも同じ形で添える。
 */
export function groupsOf(exercises: readonly Exercise[], ids: readonly string[]): string {
  const byId = new Map(exercises.map((e) => [e.id, e]));
  const groups = new Set<MuscleGroup>();
  for (const id of ids) {
    const group = byId.get(id)?.group;
    if (group) groups.add(group);
  }
  return GROUP_ORDER.filter((g) => groups.has(g))
    .map((g) => GROUP_LABELS[g])
    .join('・');
}

/** 部位を同時に 6 本描くとき用。トークン側で配色によらず固定してある */
export const GROUP_COLORS: Record<MuscleGroup, string> = {
  chest: 'var(--g-chest)',
  back: 'var(--g-back)',
  legs: 'var(--g-legs)',
  shoulders: 'var(--g-shoulders)',
  arms: 'var(--g-arms)',
  core: 'var(--g-core)',
};

/**
 * 挙上量と推定1RM を出すときに、記録した重量をどう換算するか。
 * 最大重量と目標は記録した数字のまま扱うので、ここの選択に影響されない。
 *
 * 「負荷の種類」と「片手ぶんか」を別々に考えさせず、
 * 見れば分かる事実（何を持っているか）だけを 1 つ選ばせる。
 */
export const LOAD_MODE_LABELS: Record<LoadMode, string> = {
  standard: '挙上ウエイト',
  perSide: 'バーベル換算',
  bodyweight: '自重換算',
};

export const LOAD_MODE_HINTS: Record<LoadMode, string> = {
  standard: '記録した重量がそのまま負荷。バーベル・マシン・片手ずつのダンベル',
  perSide: '左右に1つずつ持つ。ダンベル20kg×2 を バーベル40kg として計上します',
  bodyweight: '体重を足して計上。懸垂・ディップス。重量欄は追加分',
};

export const LOAD_MODE_ORDER: LoadMode[] = ['standard', 'perSide', 'bodyweight'];

export const REP_UNIT_LABELS: Record<RepUnit, string> = {
  reps: '回',
  seconds: '秒',
};

function toSubGroup(entry: MuscleGroup | [MuscleGroup, number]): SubGroup {
  return Array.isArray(entry)
    ? { group: entry[0], weight: entry[1] }
    : { group: entry, weight: SUB_GROUP_WEIGHT };
}

/** 器具を選べる種目は、選んだ器具ごとに別の ID・名前で登録する */
export function catalogId(entry: CatalogEntry, implement: Implement): string {
  return entry.implements ? `${entry.id}${IMPLEMENT_SUFFIX[implement]}` : entry.id;
}

/**
 * 種目 ID からカタログの器具を引く。
 *
 * `Exercise` は器具を持たない（負荷の数え方と器具は別物なので、種目側に持たせていない）。
 * それでも「重量を記録する種目か」を知りたい場面があるので、ID から引き直す。
 * カタログの ID は固定で、器具を選べる種目は接尾辞で分かれている。
 * 自作種目は分からないので undefined を返す（重量を聞く側に倒す）。
 */
export function catalogEquipment(id: string): Equipment | undefined {
  const suffix = id.endsWith('_bw') ? 'bodyweight' : id.endsWith('_db') ? 'dumbbell' : null;
  const base = suffix ? id.slice(0, id.lastIndexOf('_')) : id;
  const entry = CATALOG.find((c) => c.id === base);
  if (!entry) return undefined;
  if (entry.implements) return suffix ?? 'barbell';
  return entry.equipment;
}

/** 器具を選べる種目で、器具から決まる負荷の数え方。バーベルは種目側の指定に従う */
const IMPLEMENT_LOAD: Partial<Record<Implement, LoadMode>> = {
  dumbbell: 'perSide',
  bodyweight: 'bodyweight',
};

/**
 * 構成チェックの値を表から引く。**引くのはカタログの基底 ID**（器具の接尾辞を付ける前）。
 *
 * 器具で分かれる種目でも値は変わらない。ダンベルショルダープレスもバーベル版と同じく
 * 立って行うので、腰の使い方も引き方も変わらない。
 */
function checkValues(entry: CatalogEntry): Pick<Exercise, 'axial' | 'minutesPerSet'> {
  return {
    axial: AXIAL.has(entry.id),
    minutesPerSet: MINUTES_PER_SET[entry.id] ?? null,
  };
}

export function catalogCheckValues(
  id: string,
): Pick<Exercise, 'axial' | 'minutesPerSet'> | undefined {
  const suffix = id.endsWith('_bw') || id.endsWith('_db');
  const base = suffix ? id.slice(0, id.lastIndexOf('_')) : id;
  const entry = CATALOG.find((c) => c.id === base);
  return entry ? checkValues(entry) : undefined;
}

export function fromCatalog(
  entry: CatalogEntry,
  order: number,
  implement: Implement = 'barbell',
): Exercise {
  const dual = entry.implements != null;
  return {
    ...entry,
    ...checkValues(entry),
    id: catalogId(entry, implement),
    name: dual ? `${entry.name}（${IMPLEMENT_LABELS[implement]}）` : entry.name,
    // ダンベルは左右に 1 つずつ持つので 2 倍。自重版は体重を係数ぶん乗せる
    loadMode: dual ? (IMPLEMENT_LOAD[implement] ?? entry.loadMode) : entry.loadMode,
    // 係数を使うのは自重版だけ。加重版に残すと、効かない値が設定画面に出る
    bodyweightFactor: dual && implement !== 'bodyweight' ? null : entry.bodyweightFactor,
    subGroups: (entry.subGroups ?? []).map(toSubGroup),
    repUnit: entry.repUnit ?? 'reps',
    goal: null,
    order,
  };
}
