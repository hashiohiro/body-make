import { useElementWidth } from '../../hooks/useElementWidth';
import type { ExerciseGoal } from '../../lib/training';

interface Props {
  goal: ExerciseGoal;
  /** 読み上げの名前（`exGoal.rate`） */
  label: string;
}

const HEIGHT = 22;
const MID = HEIGHT / 2;
/** 左端の余白。開始より下の「いま」を置く区間で、全行に同じ幅を取る（行ごとに左端がずれない） */
const LEFT = 8;
const START = 40;
const RIGHT_PAD = 40;
/** 印の大きさは体組成側の `PacePanel` とそろえる（いま＝丸、目標＝ひし形） */
const MARK_R = 6;
const DIAMOND_R = 5.5;

/**
 * 種目の目標を 1 本の線で出す。**開始 ○ → いま ● → 最大 │ → 目標 ◆。**
 *
 * 以前はバー 1 本（開始→目標の到達率）だった。バーは「どこまで来たか」は言えるが、
 * 開始より下がっているとき（バーは空）と、始めたばかりのとき（これも空）が同じ形になる。
 * 線にすると、開始より下は左の区間へはみ出して赤い点線で見える。
 *
 * 縮尺は行ごとに「開始 → 目標」を同じ長さに取る。種目どうしで長さを比べる図ではない。
 * 「いま」は直近 1 回の値なので、記録のたびに前後する（到達したあとも動き続ける）。
 */
export function GoalTrack({ goal, label }: Props) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const { baseline, current, best, target, reached, progress } = goal;
  const end = Math.max(START + 1, width - RIGHT_PAD);

  /*
   * 縮尺。**「いま」は記録のたびに動く**——到達したあとも目標の先へ進み、下がれば戻る。
   *
   * ふだんは「開始 → 目標」を START〜end に取る（目標の先は右の余白へはみ出す）。
   * 開始値がまだ無い（3 セッション未満）・目標が開始値以下のときは、その縮尺が取れない。
   * 以前はそのとき「到達なら目標の位置・未到達なら開始の位置」に固定していて、
   * 一度届くと点が目標に貼り付いたまま動かなかった。そこで、**開始・いま・最大・目標の
   * 範囲そのもの**を START〜end に取る（点は必ず値どおりの位置に出る）。
   */
  const scaled = baseline != null && target != null && target > baseline;
  const values = [baseline, current, best, target].filter((v): v is number => v != null);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const x = (v: number) => {
    const raw = scaled
      ? START + ((v - baseline) / (target - baseline)) * (end - START)
      : hi > lo
        ? START + ((v - lo) / (hi - lo)) * (end - START)
        : end;
    // 左は余白の端まで、右は目標の先の余白まで
    return Math.max(LEFT, Math.min(width - LEFT, raw));
  };
  const xTarget = target == null ? end : x(target);
  const xStart = baseline == null ? START : x(baseline);

  const xNow = current == null ? null : x(current);
  const xBest = best == null ? null : x(best);
  const below = current != null && baseline != null && current < baseline;

  return (
    <div
      ref={ref}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={progress == null ? undefined : Math.round(progress * 100)}
      style={{ marginTop: 6 }}
    >
      {width > 0 && (
        <svg
          viewBox={`0 0 ${width} ${HEIGHT}`}
          width={width}
          height={HEIGHT}
          aria-hidden="true"
          style={{ display: 'block', overflow: 'visible' }}
        >
          {/* 左の区間。全行に引いて、開始の位置をそろえる */}
          <line
            x1={LEFT}
            x2={START}
            y1={MID}
            y2={MID}
            stroke="var(--border)"
            strokeWidth={2}
            strokeDasharray="2 4"
            strokeLinecap="round"
          />
          <line
            x1={START}
            x2={xTarget}
            y1={MID}
            y2={MID}
            stroke="var(--border)"
            strokeWidth={current == null ? 3 : 4}
            strokeDasharray={current == null ? '2 6' : undefined}
            strokeLinecap="round"
          />
          {xNow != null && below && (
            <line
              x1={xNow}
              x2={xStart}
              y1={MID}
              y2={MID}
              stroke="var(--critical)"
              strokeWidth={2}
              strokeDasharray="3 3"
            />
          )}
          {xNow != null && !below && (
            <line
              x1={xStart}
              x2={xNow}
              y1={MID}
              y2={MID}
              stroke={reached ? 'var(--good-text)' : 'var(--s-weight)'}
              strokeWidth={4}
              strokeLinecap="round"
            />
          )}
          {baseline != null && (
            <circle
              cx={xStart}
              cy={MID}
              r={3.5}
              fill="var(--surface)"
              stroke="var(--ink-muted)"
              strokeWidth={1.5}
            />
          )}
          {xBest != null && (
            <line
              x1={xBest}
              x2={xBest}
              y1={MID - 7}
              y2={MID + 7}
              stroke="var(--ink-2)"
              strokeWidth={2}
            />
          )}
          <path
            d={`M${xTarget} ${MID - DIAMOND_R}L${xTarget + DIAMOND_R} ${MID}L${xTarget} ${MID + DIAMOND_R}L${xTarget - DIAMOND_R} ${MID}Z`}
            fill={reached ? 'var(--good-text)' : 'var(--surface)'}
            stroke="var(--ink)"
            strokeWidth={2}
            strokeLinejoin="round"
          />
          {xNow != null && (
            <circle
              cx={xNow}
              cy={MID}
              r={MARK_R}
              fill="var(--s-weight)"
              stroke="var(--surface)"
              strokeWidth={2}
            />
          )}
        </svg>
      )}
    </div>
  );
}
