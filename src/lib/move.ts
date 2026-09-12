import type { Workouts } from '../types';

/** 移行先にすでに記録がある日の扱い */
export type OnConflict = 'overwrite' | 'keep';

export interface MovePlan {
  /** 移す日（移行先に記録が無い日）。古い順 */
  dates: string[];
  /** 移行先にすでに記録がある日。古い順。扱いは呼び出し側が決める */
  conflicts: string[];
}

/**
 * 記録を別の種目へ移す計画。**期間で切ってから、衝突する日を分ける。**
 *
 * 移行は「別の種目として記録してしまった」を直すための操作。
 * 消して打ち直すしかない状態を残さないために持つが、**過去を書き換える**ので、
 * 何日ぶんが動くのか・どの日がぶつかるのかを、実行の前に数えられるようにしてある。
 *
 * @param from  含む。省略（null）なら期間の始まりを切らない
 * @param until 含む。省略（null）なら期間の終わりを切らない
 */
export function planMove(
  workouts: Workouts,
  fromId: string,
  toId: string,
  from: string | null = null,
  until: string | null = null,
): MovePlan {
  const dates: string[] = [];
  const conflicts: string[] = [];

  for (const date of Object.keys(workouts).sort()) {
    if (from != null && date < from) continue;
    if (until != null && date > until) continue;
    const day = workouts[date] ?? [];
    if (!day.some((e) => e.exerciseId === fromId)) continue;
    if (day.some((e) => e.exerciseId === toId)) conflicts.push(date);
    else dates.push(date);
  }
  return { dates, conflicts };
}

/**
 * 計画のとおりに移す。**セットはそのまま運ぶ**（値は 1 つも書き換えない）。
 *
 * 数え方（`loadMode` ほか）は種目側にあるので、挙上量と推定1RM は移行先の性質で
 * 計算し直される。書いた重量が変わらないまま導出だけ変わるので、
 * 画面はその差を実行の前に出す（`RecordMoveDialog`）。
 *
 * 衝突する日は 2 択。**セットを混ぜることはしない**——
 * 混ぜると、順番も本数もどちらの日のものか分からなくなる。
 *
 *   overwrite … 移行先のその日を、移し元の記録で置き換える
 *   keep      … その日は移さない（移し元に残る）
 */
export function moveRecords(
  workouts: Workouts,
  fromId: string,
  toId: string,
  plan: MovePlan,
  onConflict: OnConflict,
): Workouts {
  const moving = new Set(plan.dates);
  const clashing = new Set(plan.conflicts);
  const out: Workouts = {};

  for (const [date, day] of Object.entries(workouts)) {
    const hit = moving.has(date);
    const clash = clashing.has(date);
    // 衝突する日を残すなら、その日は何も触らない
    if ((!hit && !clash) || (clash && onConflict === 'keep')) {
      out[date] = day;
      continue;
    }

    if (!day.some((e) => e.exerciseId === fromId)) {
      out[date] = day;
      continue;
    }

    /*
     * 並びはやった順。**移し元があった位置に置く**（移行先が後ろにあっても前に出さない）。
     * 置き換えのときは、移行先の古い記録をその場から落とす。
     */
    const kept = day
      .filter((e) => e.exerciseId !== toId)
      .map((e) => (e.exerciseId === fromId ? { ...e, exerciseId: toId } : e));
    if (kept.length > 0) out[date] = kept;
  }
  return out;
}
