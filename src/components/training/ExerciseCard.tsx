import { useState } from 'react';
import { formatMD } from '../../lib/date';
import { deltaTone, fmt, fmtDelta } from '../../lib/format';
import { GROUP_LABELS, catalogEquipment } from '../../lib/exerciseCatalog';
import { summarizeSets } from '../../lib/training';
import type { ExerciseHistoryPoint } from '../../lib/training';
import type { Exercise, ExercisePoint, SessionExercise } from '../../types';
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
  onValue: (index: number, field: 'weight' | 'reps', value: number | null) => void;
  onAddSet: () => void;
  onRemoveSet: (index: number) => void;
  onRemove: () => void;
  /** 並べ替えを始める。その日に 2 種目以上あるときだけ渡される */
  onMove?: (() => void) | undefined;
  onCopyPrevious: () => void;
  /** グラフ画面と同じ詳細ダイアログを開く */
  onOpenDetail: () => void;
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
}: Props) {
  const volume = point?.volume ?? 0;
  const prevVolume = previous?.point.volume ?? null;
  const delta = prevVolume != null && prevVolume > 0 && volume > 0 ? volume - prevVolume : null;
  // 挙上量は増えたほうが前進なので lowerIsBetter = false。方向の反転は既存の仕組みに任せる
  const tone = deltaTone(delta, false, 0.5);

  // まだ何も入っていないカードにだけ複製を出す。入力済みを黙って上書きしない
  const empty = entry.sets.every((set) => set.weight == null && set.reps == null);

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
  // 体重が負荷になる種目（腕立て・懸垂）と、器具を使わない種目（クランチ・デッドバグ）の両方
  const bodyweight =
    exercise.loadMode === 'bodyweight' || catalogEquipment(exercise.id) === 'bodyweight';
  // 体重に足す追加重量か、記録した重量がそのまま負荷か
  const additional = exercise.loadMode === 'bodyweight';
  const hasWeight = entry.sets.some((set) => set.weight != null);
  const [addWeight, setAddWeight] = useState(false);
  const showWeight = weightCounts && (!bodyweight || hasWeight || addWeight);

  return (
    <section className={ui.card} id={`ex-card-${exercise.id}`}>
      <div className={s.exHead}>
        <span className={s.exName}>{exercise.name}</span>
        <span className={s.exTag}>{GROUP_LABELS[exercise.group]}</span>
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

      <div className={`${s.setHead} ${showWeight ? '' : s.setRowSolo}`} aria-hidden="true">
        <span />
        <span>{exercise.repUnit === 'seconds' ? '秒数' : '回数'}</span>
        {showWeight && (
          <>
            <span />
            <span>{additional ? '追加重量 kg' : '重量 kg'}</span>
          </>
        )}
        <span />
      </div>

      {entry.sets.map((set, i) => (
        <SetRow
          key={i}
          index={i}
          set={set}
          point={point?.sets[i] ?? null}
          repUnit={exercise.repUnit}
          showWeight={showWeight}
          fallbackWeight={entry.sets[i - 1]?.weight ?? previous?.point.top?.weight ?? null}
          fallbackReps={entry.sets[i - 1]?.reps ?? previous?.point.top?.reps ?? null}
          onValue={(field, value) => onValue(i, field, value)}
          onRemove={() => onRemoveSet(i)}
        />
      ))}

      <div className={s.setActions}>
        <button type="button" className={s.addSet} onClick={onAddSet}>
          ＋ セットを追加
        </button>

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
        <span>{point?.workSets ?? 0} セット</span>
        {/* 推定1RM はこのカードにだけ出す */}
        {point?.oneRm != null && (
          <span>
            推定1RM {fmt(point.oneRm)} kg{point.measured ? ' *' : ''}
            {point.top?.weight != null && ` （${point.top.weight}×${point.top.reps} から）`}
          </span>
        )}
        <b>
          {Math.round(volume).toLocaleString()} kg
          {delta != null && (
            <span className={`${ui.hint} ${TONE_CLASS[tone]}`}> {fmtDelta(delta, 0)}</span>
          )}
        </b>
      </div>

      {/*
        通算の最高。前回との差は上の行が持っているので、ここは通算で見る。
        残りは入力の途中から出す（上の差分は volume が 0 のあいだ出ない）。
        「あと」は挙上量に括り付ける。並べただけだと、どちらまでの残りか読めない
      */}
      {(bestWeight != null || (best != null && best > 0)) && (
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
      </div>
    </section>
  );
}
