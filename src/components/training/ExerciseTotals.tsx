import { deltaTone, fmtDelta, fmtVolume } from '../../lib/format';
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
  /** 入力ダイアログに置く。右に寄せ、数字を少し控えめにする（主役は入力欄） */
  inEditor?: boolean | undefined;
}

/**
 * その日の量。**数字 1 つと前回との差（+ / −）、最高を超えたら ★ の印。**
 * カードとセット入力の両方で同じものを出す（別々に組むと数字の出し方がずれる）。
 *
 * 推定1RM・合計の回数・通算の最高の文字は置かない（2026/10/10、利用者の指摘：文字が多い）。
 * 数字は「推移」が持つ。
 */
export function ExerciseTotals({
  exercise,
  point,
  bodyWeight,
  previous,
  best,
  bestWeight,
  inEditor,
}: Props) {
  /*
   * 記録は kg で持っている（`lib/weight.ts`）。ここは読む場所なので、
   * 出す直前に読むときの単位へ直す。**差分も換算後どうしで取る**——
   * 片方だけ直すと、前回比が別の物差しの引き算になる。
   */
  const t = useT();
  const { label: unitLabel, conv } = useWeightFormat();
  /** 挙上量の単位。**その日（1 回のトレーニング）の量なので「/日」**を添える（重量は量ではないので添えない） */
  const volumeUnit = t('goalPeriod.perDay', { unit: unitLabel });
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
   */
  const count = point?.reps ?? 0;

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

  /*
   * 体重が乗る種目で、体重の記録が無いまま加重だけ打った日。
   * **指示ではなく事実**を書く（§1.2）——入れれば遡って出し直すのは仕組みの側の話。
   */
  const partialNote = partialVolume && (
    <p className={ui.note} data-e2e="exercise-partial-volume">
      {t('totals.noBodyWeight')}
    </p>
  );

  const big = cardio
    ? point?.meters != null
      ? { label: t('metric.distance'), value: String(point.meters), unit: 'm' }
      : (point?.minutes ?? 0) > 0
        ? {
            label: t('metric.duration'),
            value: String(point?.minutes),
            unit: t('metric.durationUnit'),
          }
        : null
    : byVolume
      ? rawVolume > 0
        ? { label: t('metric.volume'), value: fmtVolume(volume), unit: volumeUnit }
        : null
      : count > 0
        ? { label: null, value: String(count), unit: t(REP_UNIT_KEYS[exercise.repUnit]) }
        : null;
  // 差は符号と色で見せる。挙上量のときだけ（前回比を持つのは挙上量）
  const arrow = big && byVolume && !cardio && delta != null ? delta : null;
  return (
    <>
      <div className={`${s.exBig} ${inEditor ? s.exBigEditor : ''}`} data-e2e="exercise-totals">
        {big == null ? (
          // まだ何も打っていない。0 と書かず、セット数だけを出す
          <span className={s.exBigEmpty}>{t('common.sets', { n: point?.workSets ?? 0 })}</span>
        ) : (
          <>
            {big.label && <span className={s.exBigLabel}>{big.label}</span>}
            <b className={s.exBigValue} data-e2e="exercise-amount">
              {big.value}
            </b>
            <span className={s.exBigUnit}>{big.unit}</span>
            {arrow != null && (
              <span className={`${s.exBigDelta} ${TONE_CLASS[tone]}`} data-e2e="exercise-delta">
                {/* 符号は + / −（▲▼ より読み慣れている。2026/10/10、利用者の指摘）。桁区切りは量と同じ */}
                {fmtDelta(arrow, 0).slice(0, 1)}
                {fmtVolume(Math.abs(arrow))}
                {/* 入力ダイアログでは何との差かを添える（2026/10/10、利用者の指摘） */}
                {inEditor && <span className={s.exBigDeltaNote}>（{t('totals.vsPrevious')}）</span>}
              </span>
            )}
            {/* 通算の最高（重量か挙上量）を超えた日。数字ではなく印で知らせる */}
            {!cardio && (overVolume || overWeight) && (
              <span className={s.exBigBest} data-e2e="exercise-new-best">
                <span aria-hidden="true">★</span>
                {t('totals.newBest')}
              </span>
            )}
          </>
        )}
      </div>
      {partialNote}
    </>
  );
}
