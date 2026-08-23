import type { Exercise, LoadMode, MuscleGroup, RepUnit, SubGroup } from '../types';

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

export type CatalogEntry = Omit<Exercise, 'goal' | 'order' | 'repUnit' | 'subGroups'> & {
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
   *   出さない … マシン・ケーブル・自重（器具が決まっている）
   *            ダンベルにしか無い種目（フライ、サイドレイズ、ハンマーカール）
   *            器具を替えると別の動作になる種目（スクワット、デッドリフト、ロウ）
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

export type Implement = 'barbell' | 'dumbbell';

export type Equipment = Implement | 'bodyweight';

const BOTH: Implement[] = ['barbell', 'dumbbell'];

export const IMPLEMENT_LABELS: Record<Implement, string> = {
  barbell: 'バーベル',
  dumbbell: 'ダンベル',
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
    name: 'カーフレイズ',
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
    implements: BOTH,
    name: 'ランジ',
    group: 'legs',
    subGroups: [['core', 0.5]],
    loadMode: 'standard',
    bodyweightFactor: null,
    rmDivisor: RM_DEFAULT,
  },
  {
    id: 'ex_bulgarian_squat',
    implements: BOTH,
    name: 'ブルガリアンスクワット',
    group: 'legs',
    subGroups: [['core', 0.5]],
    loadMode: 'standard',
    bodyweightFactor: null,
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
  return entry.implements && implement === 'dumbbell' ? `${entry.id}_db` : entry.id;
}

export function fromCatalog(
  entry: CatalogEntry,
  order: number,
  implement: Implement = 'barbell',
): Exercise {
  const dual = entry.implements != null;
  return {
    ...entry,
    id: catalogId(entry, implement),
    name: dual ? `${entry.name}（${IMPLEMENT_LABELS[implement]}）` : entry.name,
    // ダンベルは左右に 1 つずつ持つので 2 倍で計上する
    loadMode: dual && implement === 'dumbbell' ? 'perSide' : entry.loadMode,
    subGroups: (entry.subGroups ?? []).map(toSubGroup),
    repUnit: entry.repUnit ?? 'reps',
    goal: null,
    order,
  };
}
