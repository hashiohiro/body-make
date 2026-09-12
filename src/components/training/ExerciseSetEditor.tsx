import { useState } from 'react';
import { ExerciseTotals } from './ExerciseTotals';
import { SetRow } from './SetRow';
import { catalogEquipment, isCardio } from '../../lib/exerciseCatalog';
import { formatMD } from '../../lib/date';
import { summarizeSets } from '../../lib/training';
import type { ExerciseHistoryPoint } from '../../lib/training';
import { isCardioSet } from '../../types';
import type { Exercise, ExercisePoint, RepUnit, SessionExercise, SessionSet } from '../../types';
import type { SetField } from '../../hooks/useBodyData';
import s from './training.module.scss';

interface Props {
  exercise: Exercise;
  entry: SessionExercise;
  point: ExercisePoint | null;
  previous: ExerciseHistoryPoint | null;
  /** その日より前の挙上量の最高値。カードと同じものを、打ちながら見られるようにする */
  best: number | null;
  /** 同じくその日より前の、記録した重量の最高値 */
  bestWeight: number | null;
  onValue: (index: number, field: SetField, value: number | null) => void;
  onAddSet: () => void;
  onRemoveSet: (index: number) => void;
  onCopyPrevious: () => void;
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
      ? previousSet.seconds == null
        ? null
        : Math.round((previousSet.seconds / 60) * 100) / 100
      : previousSet.meters;
  }
  if (isCardioSet(previousSet)) return null;
  return which === 'first' ? previousSet.weight : previousSet.reps;
}

/**
 * セットの入力。**カードではなくダイアログに置く。**
 *
 * カードに積んだままだと、種目が増えるほど、いま打っている種目に届くまで
 * スクロールが要る。打つあいだは 1 種目に集中するので、面を分けたほうが
 * 入力欄も大きく取れる。カード側は要約と入口だけを持つ。
 */
export function ExerciseSetEditor({
  exercise,
  entry,
  point,
  previous,
  best,
  bestWeight,
  onValue,
  onAddSet,
  onRemoveSet,
  onCopyPrevious,
}: Props) {
  const cardio = isCardio(exercise.group);
  // まだ何も入っていないときにだけ複製を出す。入力済みを黙って上書きしない
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
   * 既定では畳んで、必要な人がここで開く。
   * すでに入っている値は必ず見えるようにする（畳んで消えたように見せない）。
   */
  const weightCounts = exercise.repUnit === 'reps';
  const bodyweight =
    !cardio &&
    (exercise.loadMode === 'bodyweight' || catalogEquipment(exercise.id) === 'bodyweight');
  // 体重に足す追加重量か、記録した重量がそのまま負荷か
  const additional = exercise.loadMode === 'bodyweight';
  const hasWeight = entry.sets.some((set) => !isCardioSet(set) && set.weight != null);
  const [addWeight, setAddWeight] = useState(false);
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
    <div>
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
          // 連番は「行を足せる種目か」で決まる（削除を出すかとは別）
          showIndex={repeated}
          onRemove={repeated ? () => onRemoveSet(i) : undefined}
          rowClass={rowClass}
        />
      ))}

      {/*
        その日の合計と通算の最高を、**打っている面にも出す。**
        「前回より重く」「最高に届くか」を確かめるために、いちいち閉じてカードへ
        戻ることになっていた。カードと同じ部品なので、数字の出し方もそろう。

        置き場所はセットの行の下——**カードと同じ並び**（セット → 合計 → 最高）にする。
        打ち終わった行の続きに合計が出るので、1 セット足すたびに目が動く距離も短い。
      */}
      <ExerciseTotals
        exercise={exercise}
        point={point}
        previous={previous}
        best={best}
        bestWeight={bestWeight}
      />

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
    </div>
  );
}
