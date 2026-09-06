import { GROUP_LABELS, goalTypeLabel } from '../../lib/exerciseCatalog';
import { ExerciseTotals } from './ExerciseTotals';
import type { ExerciseHistoryPoint } from '../../lib/training';
import type { Exercise, ExercisePoint } from '../../types';
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
  onRemove: () => void;
  /** 並べ替えを始める。その日に 2 種目以上あるときだけ渡される */
  onMove?: (() => void) | undefined;
  /** グラフ画面と同じ詳細ダイアログを開く */
  onOpenDetail: () => void;
  /** その種目の目標を、記録しながら決め直す */
  onOpenGoal: () => void;
  /** セットを打つダイアログを開く。**入力はカードではなく面を分けて置く** */
  onEdit: () => void;
  /**
   * 読むだけ。**カレンダーから過去の日を開いたときに使う。**
   * 値を変えられず、足す・消す・写す・並べ替えるの入口も出さない。
   * 推移（詳細）だけは残す——読むための面なので。
   */
  readOnly?: boolean | undefined;
}

export function ExerciseCard({
  exercise,
  point,
  previous,
  best,
  bestWeight,
  onRemove,
  onMove,
  onEdit,
  readOnly,
  onOpenDetail,
  onOpenGoal,
}: Props) {
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
          {!readOnly && onMove && (
            <button
              type="button"
              className={s.exRemove}
              aria-label={`${exercise.name}の順番を変える`}
              onClick={onMove}
            >
              ⇅
            </button>
          )}
          {!readOnly && (
            <button
              type="button"
              className={s.exRemove}
              aria-label={`${exercise.name}をこの日から外す`}
              onClick={onRemove}
            >
              ×
            </button>
          )}
        </span>
      </div>

      {/* その日の合計と通算の最高。セット入力のダイアログでも同じものを出す */}
      <ExerciseTotals
        exercise={exercise}
        point={point}
        previous={previous}
        best={best}
        bestWeight={bestWeight}
      />

      {/*
        記録しながら過去の推移を見たくなる。グラフ画面と同じものを開く。
        通算の数字のすぐ下に置く（そこから掘り下げる動線なので）
      */}
      <div className={ui.detailRow}>
        {/*
          セットを打つのはダイアログ。カードは要約と入口だけを持つ。
          並べたときにカードの高さがそろうので、いま打つ種目を探しやすい
        */}
        {!readOnly && (
          <button
            type="button"
            className={`${ui.detailBtn} ${s.editBtn}`}
            aria-label={`${exercise.name}のセットを編集`}
            onClick={onEdit}
          >
            編集
          </button>
        )}
        <button
          type="button"
          className={ui.detailBtn}
          aria-label={`${exercise.name}の推移を見る`}
          onClick={onOpenDetail}
        >
          推移を見る
        </button>
        {/*
          打っている最中に「この種目はどこを目指しているか」を決め直したくなる。
          マイ種目や目標タブと同じ入口（目標）を、同じ並びでここにも置く
        */}
        {!readOnly && (
          <button
            type="button"
            className={ui.detailBtn}
            aria-label={
              exercise.goal ? `${exercise.name}の目標を変える` : `${exercise.name}の目標を決める`
            }
            onClick={onOpenGoal}
          >
            目標
          </button>
        )}
      </div>
    </section>
  );
}
