import { GROUP_KEYS, exerciseName, goalTypeLabel } from '../../lib/exerciseCatalog';
import { ExerciseTotals } from './ExerciseTotals';
import type { ExerciseHistoryPoint } from '../../lib/training';
import type { Exercise, ExercisePoint } from '../../types';
import ui from '../../styles/ui.module.scss';
import { MiniButton } from '../MiniButton';
import { Tag } from '../Tag';
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
  onRemove: () => void;
  /** 並べ替えを始める。その日に 2 種目以上あるときだけ渡される */
  onMove?: (() => void) | undefined;
  /** グラフ画面と同じ詳細ダイアログを開く */
  onOpenDetail: () => void;
  /** その種目の目標を、記録しながら決め直す */
  onOpenGoal: () => void;
  /** セットを打つダイアログを開く。**入力はカードではなく面を分けて置く** */
  onEdit: () => void;
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
  onOpenDetail,
  onOpenGoal,
}: Props) {
  const t = useT();

  return (
    <section className={ui.card} id={`ex-card-${exercise.id}`}>
      <div className={s.exHead}>
        <span className={s.exName}>{exerciseName(t, exercise)}</span>
        <Tag>{t(GROUP_KEYS[exercise.group])}</Tag>
        {/*
          マイ種目に入れていない種目。**記録としては他と同じに数える**が、
          次に選ぶ場面（マイ種目から選ぶ・プリセット・目標）には出てこない。
          出しておかないと、次の日に探して見つからないことになる。
        */}
        {exercise.shelf === 'adhoc' && <Tag kind="state">{t('exercise.notAdded')}</Tag>}
        {/* この種目をどうしたいか（維持 / 重量↑ / 挙上量↑ / 回数↑）。打ちながら分かるように */}
        {exercise.goal && (
          <Tag kind="chosen">{goalTypeLabel(t, exercise.goal.type, exercise.repUnit, true)}</Tag>
        )}
        <span className={s.exHeadBtns}>
          {/* 並びはやった順。掴むと、その日の種目だけが小さな一覧に畳まれる */}
          {onMove && (
            <MiniButton
              label={t('exercise.reorderOf', { name: exerciseName(t, exercise) })}
              onClick={onMove}
            >
              ⇅
            </MiniButton>
          )}
          <MiniButton
            label={t('exercise.removeFromDay', { name: exerciseName(t, exercise) })}
            onClick={onRemove}
          >
            ×
          </MiniButton>
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
        <button
          type="button"
          className={`${ui.detailBtn} ${s.editBtn}`}
          aria-label={t('exercise.editSetsOf', { name: exerciseName(t, exercise) })}
          onClick={onEdit}
        >
          {t('common.edit')}
        </button>
        <button
          type="button"
          className={ui.detailBtn}
          aria-label={t('common.trendOf', { name: exerciseName(t, exercise) })}
          onClick={onOpenDetail}
        >
          {t('common.viewTrend')}
        </button>
        {/*
          打っている最中に「この種目はどこを目指しているか」を決め直したくなる。
          マイ種目や目標タブと同じ入口（目標）を、同じ並びでここにも置く
        */}
        <button
          type="button"
          className={ui.detailBtn}
          aria-label={
            exercise.goal
              ? t('exGoal.changeOf', { name: exerciseName(t, exercise) })
              : t('exercise.setGoalOf', { name: exerciseName(t, exercise) })
          }
          onClick={onOpenGoal}
        >
          {t('common.goal')}
        </button>
      </div>
    </section>
  );
}
