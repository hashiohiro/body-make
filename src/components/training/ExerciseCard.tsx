import { useState } from 'react';
import { formatMD } from '../../lib/date';
import { deltaTone, fmt, fmtDelta } from '../../lib/format';
import { GROUP_LABELS, catalogEquipment, goalTypeLabel, isCardio } from '../../lib/exerciseCatalog';
import { formatTopSet, summarizeSets } from '../../lib/training';
import type { ExerciseHistoryPoint } from '../../lib/training';
import { isCardioSet } from '../../types';
import type { SetField } from '../../hooks/useBodyData';
import type { Exercise, ExercisePoint, RepUnit, SessionExercise, SessionSet } from '../../types';
import { SetRow } from './SetRow';
import ui from '../../styles/ui.module.scss';
import s from './training.module.scss';

const TONE_CLASS = { good: ui.good, bad: ui.bad, flat: ui.flat } as const;

interface Props {
  exercise: Exercise;
  entry: SessionExercise;
  point: ExercisePoint | null;
  previous: ExerciseHistoryPoint | null;
  /** その日より前の挙上量の最高値。当日を含めると、入れた瞬間に自分が最高になって指標にならない */
  best: number | null;
  /** 同じくその日より前の、記録した重量の最高値 */
  bestWeight: number | null;
  onValue: (index: number, field: SetField, value: number | null) => void;
  onAddSet: () => void;
  onRemoveSet: (index: number) => void;
  onRemove: () => void;
  /** 並べ替えを始める。その日に 2 種目以上あるときだけ渡される */
  onMove?: (() => void) | undefined;
  onCopyPrevious: () => void;
  /** グラフ画面と同じ詳細ダイアログを開く */
  onOpenDetail: () => void;
  /** その種目の目標を、記録しながら決め直す */
  onOpenGoal: () => void;
}

/** 1 つ目の欄の見出し。単位で決まる（有酸素はここを使わない） */
const FIELD_LABELS: Record<RepUnit, string> = {
  reps: '回数',
  seconds: '秒数',
};

/**
 * 直前の行の値。**未入力のときプレースホルダに薄く出す**ためだけに使う。
 * 有酸素は 秒 で持っているので、打つ単位（分）に直してから渡す。
 */
function fallbackOf(
  previousSet: SessionSet | undefined,
  cardio: boolean,
  which: 'first' | 'second',
): number | null {
  if (!previousSet) return null;
  if (cardio) {
    if (!isCardioSet(previousSet)) return null;
    return which === 'first'
      ? previousSet.meters
      : previousSet.seconds == null
        ? null
        : previousSet.seconds / 60;
  }
  if (isCardioSet(previousSet)) return null;
  return which === 'first' ? previousSet.weight : previousSet.reps;
}

export function ExerciseCard({
  exercise,
  entry,
  point,
  previous,
  best,
  bestWeight,
  onValue,
  onAddSet,
  onRemoveSet,
  onRemove,
  onMove,
  onCopyPrevious,
  onOpenDetail,
  onOpenGoal,
}: Props) {
  const volume = point?.volume ?? 0;
  const prevVolume = previous?.point.volume ?? null;
  const delta = prevVolume != null && prevVolume > 0 && volume > 0 ? volume - prevVolume : null;
  // 挙上量は増えたほうが前進なので lowerIsBetter = false。方向の反転は既存の仕組みに任せる
  const tone = deltaTone(delta, false, 0.5);

  const cardio = isCardio(exercise.group);
  // まだ何も入っていないカードにだけ複製を出す。入力済みを黙って上書きしない
  const empty = entry.sets.every((set) =>
    isCardioSet(set)
      ? set.meters == null && set.seconds == null
      : set.weight == null && set.reps == null,
  );

  /*
   * 重量欄を出すか。
   *
   * 秒で数える種目では、重量を入れても挙上量に計上されない（counted の条件が repUnit==='reps'）。
   * 効かない欄を置いて入力を求めるのはおかしいので、出さない。
   *
   * 自重種目の重量は「体重に足す追加重量」で、ベルトで足す人だけが使う。
   * 既定では畳んで、必要な人がその種目のカードで開く。
   * すでに入っている値は必ず見えるようにする（畳んで消えたように見せない）。
   */
  const weightCounts = exercise.repUnit === 'reps';
  /*
   * 体重が負荷になる種目（腕立て・懸垂）と、器具を使わない種目（クランチ・デッドバグ）の両方。
   * 有酸素は含めない。走るのに「加重する」欄を出しても入れるものがない
   * （カタログでは道具を使わない種目として bodyweight を持っている）。
   */
  const bodyweight =
    !cardio &&
    (exercise.loadMode === 'bodyweight' || catalogEquipment(exercise.id) === 'bodyweight');
  // 体重に足す追加重量か、記録した重量がそのまま負荷か
  const additional = exercise.loadMode === 'bodyweight';
  const hasWeight = entry.sets.some((set) => !isCardioSet(set) && set.weight != null);
  const [addWeight, setAddWeight] = useState(false);
  /*
   * 有酸素は 2 つの欄が 時間 と 距離。距離は主指標そのものなので常に出す
   * （距離の出ない種目は空欄のままでよく、その場合は時間だけで扱う）。
   */
  const showWeight = cardio || (weightCounts && (!bodyweight || hasWeight || addWeight));

  /*
   * 行の形。連番と × を置くかどうかで列の数が変わる。
   * 置かないときに空の列を残すと、入力欄が中央から寄って見える
   */
  const repeated = exercise.repeated;
  const rowClass = [showWeight ? '' : s.setRowSolo, repeated ? '' : s.setRowBare]
    .filter(Boolean)
    .join(' ');

  return (
    <section className={ui.card} id={`ex-card-${exercise.id}`}>
      <div className={s.exHead}>
        <span className={s.exName}>{exercise.name}</span>
        <span className={s.exTag}>{GROUP_LABELS[exercise.group]}</span>
        {/* この種目をどうしたいか（維持 / 重量↑ / 挙上量↑ / 回数↑）。打ちながら分かるように */}
        {exercise.goal && (
          <span className={s.kindTag}>
            {goalTypeLabel(exercise.goal.type, exercise.repUnit, true)}
          </span>
        )}
        <span className={s.exHeadBtns}>
          {/* 並びはやった順。掴むと、その日の種目だけが小さな一覧に畳まれる */}
          {onMove && (
            <button
              type="button"
              className={s.exRemove}
              aria-label={`${exercise.name}の順番を変える`}
              onClick={onMove}
            >
              ⇅
            </button>
          )}
          <button
            type="button"
            className={s.exRemove}
            aria-label={`${exercise.name}をこの日から外す`}
            onClick={onRemove}
          >
            ×
          </button>
        </span>
      </div>

      <div className={s.prev}>
        {previous ? (
          <>
            <span>
              前回 {formatMD(previous.date)}: {summarizeSets(previous.point)}
            </span>
            {empty && (
              <button type="button" className={s.prevBtn} onClick={onCopyPrevious}>
                前回の構成で始める
              </button>
            )}
          </>
        ) : (
          <span>この種目の記録は初めてです</span>
        )}
      </div>

      {/*
        **1 回で完結する種目は、行の道具立てを出さない。**
        連番も行の × も「何本目か」を扱うためのもので、通しで 1 回走る種目には要らない。
        残るのは入力欄 2 つだけになる（Exercise.repeated / カタログが既定を持つ）。
      */}
      <div className={`${s.setHead} ${rowClass}`} aria-hidden="true">
        {repeated && <span />}
        <span>{cardio ? '時間 分' : FIELD_LABELS[exercise.repUnit]}</span>
        {showWeight && (
          <>
            <span />
            <span>{cardio ? '距離 m' : additional ? '追加重量 kg' : '重量 kg'}</span>
          </>
        )}
        {repeated && <span />}
      </div>

      {entry.sets.map((set, i) => (
        <SetRow
          key={i}
          index={i}
          set={set}
          point={point?.sets[i] ?? null}
          repUnit={exercise.repUnit}
          cardio={cardio}
          showWeight={showWeight}
          fallbackWeight={
            fallbackOf(entry.sets[i - 1], cardio, 'first') ??
            (cardio ? null : (previous?.point.top?.weight ?? null))
          }
          fallbackReps={
            fallbackOf(entry.sets[i - 1], cardio, 'second') ??
            (cardio ? null : (previous?.point.top?.reps ?? null))
          }
          onValue={(field, value) => onValue(i, field, value)}
          onRemove={repeated ? () => onRemoveSet(i) : undefined}
          rowClass={rowClass}
        />
      ))}

      <div className={s.setActions}>
        {repeated && (
          <button type="button" className={s.addSet} onClick={onAddSet}>
            ＋ {cardio ? '本' : 'セット'}を追加
          </button>
        )}

        {/* 自重種目で、ベルトなどで加重した日だけ開く。値が入っていれば畳ませない */}
        {weightCounts && bodyweight && !hasWeight && (
          <button
            type="button"
            className={s.weightToggle}
            aria-pressed={addWeight}
            onClick={() => setAddWeight((v) => !v)}
          >
            {addWeight ? '加重をやめる' : '＋ 加重'}
          </button>
        )}
      </div>

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
            {/* 推定1RM はこのカードにだけ出す */}
            {point?.oneRm != null && (
              <span>
                推定1RM {fmt(point.oneRm)} kg{point.measured ? ' *' : ''}
                {formatTopSet(point) && ` （${formatTopSet(point)} から）`}
              </span>
            )}
            <b>
              {Math.round(volume).toLocaleString()} kg
              {delta != null && (
                <span className={`${ui.hint} ${TONE_CLASS[tone]}`}> {fmtDelta(delta, 0)}</span>
              )}
            </b>
          </>
        )}
      </div>

      {/*
        通算の最高。前回との差は上の行が持っているので、ここは通算で見る。
        残りは入力の途中から出す（上の差分は volume が 0 のあいだ出ない）。
        「あと」は挙上量に括り付ける。並べただけだと、どちらまでの残りか読めない
      */}
      {!cardio && (bestWeight != null || (best != null && best > 0)) && (
        <div className={s.exPrev}>
          {bestWeight != null && <span>最高重量 {fmt(bestWeight)} kg</span>}
          {best != null && best > 0 && (
            <span>
              最高挙上量 {Math.round(best).toLocaleString()} kg
              {volume < best && `（あと ${Math.round(best - volume).toLocaleString()} kg）`}
            </span>
          )}
        </div>
      )}

      {/*
        記録しながら過去の推移を見たくなる。グラフ画面と同じものを開く。
        通算の数字のすぐ下に置く（そこから掘り下げる動線なので）
      */}
      <div className={s.exDetailRow}>
        <button
          type="button"
          className={s.exDetail}
          aria-label={`${exercise.name}の推移を見る`}
          onClick={onOpenDetail}
        >
          推移を見る
        </button>
        {/*
          打っている最中に「この種目はどこを目指しているか」を決め直したくなる。
          マイ種目や目標タブと同じ入口（目標）を、同じ並びでここにも置く
        */}
        <button
          type="button"
          className={s.exDetail}
          aria-label={
            exercise.goal ? `${exercise.name}の目標を変える` : `${exercise.name}の目標を決める`
          }
          onClick={onOpenGoal}
        >
          目標
        </button>
      </div>
    </section>
  );
}
