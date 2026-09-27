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
  /**
   * その日の体重（kg）。**体重が乗る種目で、負荷が埋まっているかを見るために要る。**
   *
   * 無いまま加重だけ打つと、`effectiveWeight` は加重ぶんだけを返す
   * （打った値が消えたように見せないため）。本当の負荷より小さいので、その旨を添える。
   */
  bodyWeight: number | null;
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
export function ExerciseTotals({ exercise, point, bodyWeight, previous, best, bestWeight }: Props) {
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
  /*
   * **この行は「その日の量」を出す場所。量はその種目の性質で 1 つに決まる。**
   *
   *   器具で負荷をかける / 体重が乗る … 挙上量（kg）
   *   器具を使わない自重（Vアップ）  … 総レップ
   *   秒で数える（プランク）          … 総秒数
   *   有酸素                          … 距離（なければ時間）
   *
   * 以前は太字の枠が「挙上量 → 出せなければ回数 → それも無ければ —」と意味を変えていた。
   * 重量を打った瞬間に太字が「30回」から「600 kg」へすり替わり、
   * 出せない種目には何を書くべきかが場面ごとの判断になっていた。
   *
   * **同じ事実を 2 か所に出さない。**量が回数の種目では回数を左に添えない
   * （太字がそれを言っている）。逆に挙上量が量の種目では、回数を左に出す。
   */
  const count = point?.reps ?? 0;
  const countLabel = t('totals.amount', {
    n: count,
    unit: t(REP_UNIT_KEYS[exercise.repUnit]),
  });

  /*
   * 挙上量を量にできる種目か。**打てば出る／体重を入れれば出る**ものだけ。
   *
   *   秒で数える種目                            … 重量 × 秒 は挙上量にならない
   *   器具を使わない自重（Vアップ・クランチ）    … 体重が乗らず、重量欄も出ない
   *
   * 器具を使わない種目で加重した日も、**量は総レップのまま**にする。
   * 日によって太字の意味が変わるほうが読みにくい（打った加重は左に添える）。
   */
  const byVolume =
    countsReps(exercise.repUnit) &&
    (exercise.loadMode === 'bodyweight' || catalogEquipment(exercise.id) !== 'bodyweight');

  /*
   * 体重が乗る種目なのに体重の記録が無く、加重だけで挙上量が出ている状態。
   * 本当の負荷より小さいので、そのことを添える（体重を 1 件入れれば遡って正しくなる）。
   */
  const partialVolume = exercise.loadMode === 'bodyweight' && bodyWeight == null && rawVolume > 0;

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
            {/* 回数は、挙上量が量の種目でだけ左に添える（量が回数なら太字が言っている） */}
            {byVolume && count > 0 && <span>{countLabel}</span>}
            {/*
              器具を使わない自重種目で加重した日。**量は総レップのまま**なので、
              打った加重ぶんの挙上量はここに添える。
            */}
            {!byVolume && rawVolume > 0 && (
              <span>{t('totals.volumeValue', { value: fmtVolume(volume), unit: unitLabel })}</span>
            )}
            {/*
              **太字はその種目の量。**挙上量が量の種目で、まだ出せないときは空にする
              （`0 kg` も `—` も書かない。打てば同じ位置が kg になる）。
            */}
            <b>
              {byVolume ? (
                rawVolume > 0 ? (
                  <>
                    {fmtVolume(volume)} {unitLabel}
                    {delta != null && (
                      <span className={`${ui.hint} ${TONE_CLASS[tone]}`}>
                        {' '}
                        {fmtDelta(delta, 0)}
                      </span>
                    )}
                  </>
                ) : (
                  ''
                )
              ) : count > 0 ? (
                countLabel
              ) : (
                ''
              )}
            </b>
          </>
        )}
      </div>

      {/*
        体重が乗る種目で、体重の記録が無いまま加重だけ打った日。
        **指示ではなく事実**を書く（§1.2）——入れれば遡って出し直すのは仕組みの側の話。
      */}
      {partialVolume && <p className={ui.note}>{t('totals.noBodyWeight')}</p>}

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
