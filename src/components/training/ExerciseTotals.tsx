import { deltaTone, fmt, fmtDelta, fmtVolume } from '../../lib/format';
import { REP_UNIT_KEYS, catalogEquipment, countsReps, isCardio } from '../../lib/exerciseCatalog';
import type { ExerciseHistoryPoint } from '../../lib/training';
import type { Exercise, ExercisePoint } from '../../types';
import { useWeightFormat } from '../../hooks/useWeightUnit';
import { TONE_CLASS } from '../tone';
import ui from '../../styles/ui.module.scss';
import s from './training.module.scss';
import { useT } from '../../lib/i18n';

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
  /*
   * 記録は kg で持っている（`lib/weight.ts`）。ここは読む場所なので、
   * 出す直前に読むときの単位へ直す。**差分も換算後どうしで取る**——
   * 片方だけ直すと、前回比が別の物差しの引き算になる。
   */
  const t = useT();
  const { label: unitLabel, conv } = useWeightFormat();
  const volume = conv(point?.volume ?? 0);
  const prevVolume = previous?.point.volume == null ? null : conv(previous.point.volume);
  const delta = prevVolume != null && prevVolume > 0 && volume > 0 ? volume - prevVolume : null;
  // 挙上量は増えたほうが前進なので lowerIsBetter = false。方向の反転は既存の仕組みに任せる
  const tone = deltaTone(delta, false, 0.5);
  const cardio = isCardio(exercise.group);

  /*
   * その日が通算の最高を超えたか。**比べるのは換算前の kg**——
   * 片方だけ換算すると、丸めの違いで超えた／超えないが変わる。
   */
  const topWeight = point?.top?.weight ?? null;
  const rawVolume = point?.volume ?? 0;
  const overWeight = bestWeight != null && topWeight != null && topWeight > bestWeight;
  const overVolume = best != null && best > 0 && rawVolume > best;

  /*
   * **まだ何も打っていないか。**行はあるが値が 1 つも無い状態。
   *
   * 種目を入れた直後はここに居る。そのときに `合計 0回` や `挙上量 —` を出すと、
   * 持っていない指標を書くことになる（0 kg と書かないのと同じ理由）。
   * 出すのはセット数だけにして、打ちはじめてから合計を出す。
   */
  const typed = (point?.sets ?? []).some((set) => set.weight != null || set.reps != null);

  /*
   * **挙上量を出せる種目か。**出せないものに `—` を置くと、
   * 「重量を打てば出る」と読めてしまう——出せない理由が違う。
   *
   *   秒で数える種目（プランク）                … 重量 × 秒 は挙上量にならない
   *   器具を使わない自重種目（Vアップ・クランチ）… 重量欄そのものが出ない
   *
   * 体重が乗る種目（懸垂・腕立て）は出せる側。**体重を記録すれば遡って出る**ので、
   * いま出ていないことは `—` で正しく言える。器具を使わない種目でも、
   * 加重を打っていれば同じ（打った値は挙上量に入る）。
   */
  const hasWeight = (point?.sets ?? []).some((set) => set.weight != null);
  const noEquipment = catalogEquipment(exercise.id) === 'bodyweight';
  const canVolume =
    countsReps(exercise.repUnit) &&
    (exercise.loadMode === 'bodyweight' || !noEquipment || hasWeight);
  const count = point?.reps ?? 0;
  const countLabel = t('totals.count', { n: count, unit: t(REP_UNIT_KEYS[exercise.repUnit]) });

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
              ? t('totals.cardioSets', { n: point?.workSets ?? 0 })
              : ''
            : t('common.sets', { n: point?.workSets ?? 0 })}
        </span>
        {/*
          有酸素は挙上量を持たない。**0 kg と書かない。**
          出すのはその日の合計距離と、そこから出した速度（筋トレの 挙上量 / 推定1RM にあたる）。
        */}
        {cardio ? (
          <>
            {point?.speed != null && <span>{t('common.speed', { n: fmt(point.speed) })}</span>}
            <b>
              {point?.meters != null
                ? `${point.meters} m`
                : t('totals.minutes', { n: point?.minutes ?? 0 })}
            </b>
          </>
        ) : (
          <>
            {/*
              推定1RM は**元にしたセットを添えない。**その日のセットはすぐ下に並んでいて、
              どれが最大かは見れば分かる。「（60kg × 10 から）」まで置くと読むものが増える。
            */}
            {point?.oneRm != null && (
              <span>
                {t('totals.oneRm', { value: fmt(conv(point.oneRm)), unit: unitLabel })}
                {point.measured ? ' *' : ''}
              </span>
            )}
            {/*
              **持っていない指標を 0 と書かない。**有酸素で 0 kg を出さないのと同じ理由。

              挙上量が出ないのは 3 通りある。どれも「掛ける相手がない」で、
              やっていないという意味ではない。
                重量が空のセットしかない          … 重量 × 回数 の重量が無い
                秒で数える種目（プランク）        … 重量 × 秒 は挙上量にならない
                体重を乗せない自重種目（レッグレイズ）… 重量欄が空なら 0 × 回数
              代わりに、その種目が実際に持っている量（合計の回数・秒数）を出す。
            */}
            {canVolume && rawVolume === 0 && count > 0 && <span>{countLabel}</span>}
            {/*
              **挙上量を出せる種目では、その場所を消さない。**出せないときは `—`。

              消すと「合計 30回」だけが残り、ウエイトなのに回数が出ている理由が
              画面から読めない（数えていないのか、出せないのかが分からない）。
              場所を残せば、重量を打った瞬間に同じ位置が kg に変わる。
              **「重量を入れましょう」とは書かない**——出すのは事実だけ（§1.2）。

              秒で数える種目は挙上量を**原理的に持たない**ので `—` も出さない。
              「打てば出る」と読めてしまう（出せない理由が違う）。合計が主役になる。
            */}
            <b>
              {rawVolume > 0 ? (
                <>
                  {fmtVolume(volume)} {unitLabel}
                  {delta != null && (
                    <span className={`${ui.hint} ${TONE_CLASS[tone]}`}> {fmtDelta(delta, 0)}</span>
                  )}
                </>
              ) : !typed ? (
                ''
              ) : canVolume ? (
                t('totals.noVolume')
              ) : (
                countLabel
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
          {/*
            その日が通算の最高を超えたら、**この行そのものを `60.0 → 62.5` にする。**

            超えた事実を別の行で足すと、すぐ上と同じことを 2 回言うことになる
            （`bestWeight` は「その日より前」の最高なので、並べれば超えたことは
            読めるが、読む側に引き算をさせる）。行は増やさない。

            **残り（あと N kg）は出さない**のは今までどおり。出すのは跨いだ事実だけで、
            距離ではない。
          */}
          {bestWeight != null && (
            <span>
              {t('totals.bestWeight')} {fmt(conv(bestWeight))}
              {overWeight && <> → {fmt(conv(topWeight!))}</>} {unitLabel}
            </span>
          )}
          {best != null && best > 0 && (
            <span>
              {t('totals.bestVolume')} {fmtVolume(conv(best))}
              {overVolume && <> → {fmtVolume(conv(rawVolume))}</>} {unitLabel}
            </span>
          )}
        </div>
      )}
    </>
  );
}
