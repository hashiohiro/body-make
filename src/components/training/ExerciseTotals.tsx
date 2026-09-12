import { deltaTone, fmt, fmtDelta, fmtVolume } from '../../lib/format';
import { isCardio } from '../../lib/exerciseCatalog';
import type { ExerciseHistoryPoint } from '../../lib/training';
import type { Exercise, ExercisePoint } from '../../types';
import { TONE_CLASS } from '../tone';
import ui from '../../styles/ui.module.scss';
import s from './training.module.scss';

interface Props {
  exercise: Exercise;
  point: ExercisePoint | null;
  previous: ExerciseHistoryPoint | null;
  /** その日より前の挙上量の最高値。当日を含めると、入れた瞬間に自分が最高になって指標にならない */
  best: number | null;
  /** 同じくその日より前の、記録した重量の最高値 */
  bestWeight: number | null;
}

/**
 * その日の合計と、通算の最高。**カードとセット入力の両方で同じものを出す。**
 *
 * 打ちながら「前回を超えたか」「最高に届くか」を見たくなる。入力はダイアログに
 * 移したので、そこに無いと、確かめるたびに閉じてカードへ戻ることになる。
 * 別々に組むと数字の出し方がずれるので、同じ部品を両方に置く。
 */
export function ExerciseTotals({ exercise, point, previous, best, bestWeight }: Props) {
  const volume = point?.volume ?? 0;
  const prevVolume = previous?.point.volume ?? null;
  const delta = prevVolume != null && prevVolume > 0 && volume > 0 ? volume - prevVolume : null;
  // 挙上量は増えたほうが前進なので lowerIsBetter = false。方向の反転は既存の仕組みに任せる
  const tone = deltaTone(delta, false, 0.5);
  const cardio = isCardio(exercise.group);

  return (
    <>
      <div className={s.exFoot}>
        {/*
          有酸素の 1 行は「セット」ではなく **1 本**（インターバルの 400m×5本、
          サーキットのラウンド数）。筋トレの言葉のままにはしない。

          **1 本のときは数を出さない。**ランニングはふつう通しで 1 回走るもので、
          そこで知りたいのは「どれだけ走ったか」。「1 本」は読むものが増えるだけになる。
          分けて打ったときだけ、本数そのものが量として意味を持つ。
        */}
        <span>
          {cardio
            ? (point?.workSets ?? 0) > 1
              ? `${point?.workSets} 本`
              : ''
            : `${point?.workSets ?? 0} セット`}
        </span>
        {/*
          有酸素は挙上量を持たない。**0 kg と書かない。**
          出すのはその日の合計距離と、そこから出した速度（筋トレの 挙上量 / 推定1RM にあたる）。
        */}
        {cardio ? (
          <>
            {point?.speed != null && <span>{fmt(point.speed)} m/分</span>}
            <b>{point?.meters != null ? `${point.meters} m` : `${point?.minutes ?? 0} 分`}</b>
          </>
        ) : (
          <>
            {/*
              推定1RM は**元にしたセットを添えない。**その日のセットはすぐ下に並んでいて、
              どれが最大かは見れば分かる。「（60kg × 10 から）」まで置くと読むものが増える。
            */}
            {point?.oneRm != null && (
              <span>
                推定1RM {fmt(point.oneRm)} kg{point.measured ? ' *' : ''}
              </span>
            )}
            <b>
              {fmtVolume(volume)} kg
              {delta != null && (
                <span className={`${ui.hint} ${TONE_CLASS[tone]}`}> {fmtDelta(delta, 0)}</span>
              )}
            </b>
          </>
        )}
      </div>

      {/*
        通算の最高。前回との差は上の行が持っているので、ここは通算で見る。

        **残り（あと N kg）は出さない。**その日の合計はすぐ上の行にあり、
        並べれば届いたかどうかは読める。差を書くと、打つたびに動く数字が
        1 行に 2 つ並ぶ（前回比と残り）。
      */}
      {!cardio && (bestWeight != null || (best != null && best > 0)) && (
        <div className={s.exPrev}>
          {bestWeight != null && <span>最高重量 {fmt(bestWeight)} kg</span>}
          {best != null && best > 0 && <span>最高挙上量 {fmtVolume(best)} kg</span>}
        </div>
      )}
    </>
  );
}
