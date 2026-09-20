import { useState } from 'react';
import { ExerciseTotals } from './ExerciseTotals';
import { SetRow } from './SetRow';
import { catalogEquipment, isCardio } from '../../lib/exerciseCatalog';
import { formatMD } from '../../lib/date';
import { baseLoad, summarizeSets } from '../../lib/training';
import type { ExerciseHistoryPoint } from '../../lib/training';
import { isCardioSet } from '../../types';
import type { Exercise, ExercisePoint, RepUnit, SessionExercise, SessionSet } from '../../types';
import type { SetField } from '../../hooks/useBodyData';
import { fmt } from '../../lib/format';
import { WEIGHT_UNIT_LABEL, fromKg } from '../../lib/weight';
import ui from '../../styles/ui.module.scss';
import type { WeightUnit } from '../../lib/weight';
import s from './training.module.scss';
import { useWeightUnit } from '../../hooks/useWeightUnit';

interface Props {
  exercise: Exercise;
  entry: SessionExercise;
  point: ExercisePoint | null;
  previous: ExerciseHistoryPoint | null;
  /** その日より前の挙上量の最高値。カードと同じものを、打ちながら見られるようにする */
  best: number | null;
  /** 同じくその日より前の、記録した重量の最高値 */
  bestWeight: number | null;
  /**
   * 重量欄で打つ単位。**保存は常に kg。**
   *
   * 状態は記録画面（`TrainingView`）が持つ。種目を移っても選んだ単位のままで、
   * 1 種目ごとに選び直さずに済む。**設定は書き換えない**ので、閉じて開き直せば
   * 普段の単位に戻る（遠征先での、その場限りの都合）。
   */
  weightUnit: WeightUnit;
  onWeightUnitChange: (unit: WeightUnit) => void;
  /** その日に使える体重（kg）。自重種目の「足される側」を出すのに要る。無ければ null */
  bodyWeight: number | null;
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
  weightUnit,
  onWeightUnitChange,
  bodyWeight,
  onValue,
  onAddSet,
  onRemoveSet,
  onCopyPrevious,
}: Props) {
  // 前回の構成は「読む」場所。打つ単位（weightUnit）ではなく表示の単位で出す
  const displayUnit = useWeightUnit();
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
  /*
   * 自重種目の負荷の内訳に出す値。**打ったセットではなく種目と体重で決まる**ので、
   * まだ何も入っていなくても出せる（打つ前に式が読めるのが狙い）。
   * 追加ぶんだけはその日のトップセットから引く。
   */
  const unitLabel = WEIGHT_UNIT_LABEL[weightUnit];
  const base = baseLoad(exercise, bodyWeight);
  const factor = exercise.bodyweightFactor ?? 1;
  const addedTop = point?.top?.weight ?? 0;

  const repeated = exercise.repeated;
  const rowClass = [
    showWeight ? '' : s.setRowSolo,
    repeated ? '' : s.setRowBare,
    // 自重種目は「自重 ＋ 欄」で 1 列ぶん広く要る
    additional && showWeight ? s.setRowAdded : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div>
      <div className={s.prev}>
        {previous ? (
          <>
            <span>
              前回 {formatMD(previous.date)}: {summarizeSets(previous.point, displayUnit)}
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
        自重種目の負荷の内訳。**打ち始める前に、何に足されるのかを出す。**

        重量欄が受け取るのは追加ぶんだけなので、足される側は画面のどこにも
        出ていなかった。体重 75kg の人に 52.5 と出る理由（この種目は体重の 70%）も、
        数字だけでは読めない。式のまま、打つ前に目に入る位置へ置く。

        割合は マイ種目 > その種目 > 設定 で種目ごとに変えられる。
      */}
      {additional && (
        <div className={s.loadCalc}>
          <span>
            自重 {fmt(fromKg(base, displayUnit), base === 0 ? 0 : 1)}{' '}
            {WEIGHT_UNIT_LABEL[displayUnit]}
            {bodyWeight != null && (
              <span className={ui.hint}>
                （体重 {fmt(fromKg(bodyWeight, displayUnit))} × {factor}）
              </span>
            )}
            {/* 加重していない日に「＋ 追加 0.0」は要らない。足していないことは欄が言っている */}
            {addedTop > 0 && <> ＋ 追加 {fmt(fromKg(addedTop, displayUnit))}</>}
          </span>
          {bodyWeight == null && (
            <span className={ui.hint}>
              体重が未記録なので、自重ぶんを 0 として数えています。
              体組成に体重を入れると、この種目の挙上量も遡って出ます。
            </span>
          )}
        </div>
      )}

      {/*
        **1 回で完結する種目は、行の道具立てを出さない。**
        連番も行の × も「何本目か」を扱うためのもので、通しで 1 回走る種目には要らない。
        残るのは入力欄 2 つだけになる（Exercise.repeated / カタログが既定を持つ）。
      */}
      {/*
        見出しの行。**重量の単位だけは押せる。**
        aria-hidden は欄ごとに付ける——行ごと隠すと、中の切り替えボタンまで
        読み上げから消えてしまう（欄そのものの読み上げ名は SetRow が持つ）。
      */}
      <div className={`${s.setHead} ${rowClass}`}>
        {repeated && <span aria-hidden="true" />}
        <span aria-hidden="true">{cardio ? '時間 分' : FIELD_LABELS[exercise.repUnit]}</span>
        {showWeight && (
          <>
            <span aria-hidden="true" />
            {/*
              **見出しは欄の真上に、そのまま読める形で置く。**
              単位まで含めて 1 つの文字列（「追加重量 kg」）にする。
              以前は見出しごとボタンにして単位を青の太字にしていたので、
              いちばん読ませたい「追加重量」が行の中でもっとも薄い字になっていた。
            */}
            <span aria-hidden="true">
              {cardio ? '距離 m' : `${additional ? '追加重量' : '重量'} ${unitLabel}`}
            </span>
            {/*
              単位の切り替えは **× の真上**（行の操作と同じ列）。
              見出しの文字そのものを押させない——読む場所と押す場所を分ける。
            */}
            {repeated && !cardio && (
              <button
                type="button"
                className={s.unitToggle}
                aria-label={`重量の単位を切り替える（いま ${unitLabel}）`}
                onClick={() => onWeightUnitChange(weightUnit === 'kg' ? 'lb' : 'kg')}
              >
                ⇄
              </button>
            )}
          </>
        )}
        {/* 行を足せない種目には × の列が無いので、見出しの列も空けない */}
        {repeated && (!showWeight || cardio) && <span aria-hidden="true" />}
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
          weightUnit={weightUnit}
          // 自重種目だけ、足される側を欄の前に出して行を式にする
          baseWeight={additional ? baseLoad(exercise, bodyWeight) : null}
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
