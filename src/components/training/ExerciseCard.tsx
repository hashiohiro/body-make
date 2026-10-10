import { GROUP_KEYS, REP_UNIT_KEYS, exerciseName, isCardio } from '../../lib/exerciseCatalog';
import type { ReactNode } from 'react';
import { ExerciseTotals } from './ExerciseTotals';
import type { ExerciseHistoryPoint } from '../../lib/training';
import type { Exercise, ExercisePoint, RepUnit } from '../../types';
import { useWeightFormat } from '../../hooks/useWeightUnit';
import ui from '../../styles/ui.module.scss';
import { MiniButton } from '../MiniButton';
import { Tag } from '../Tag';
import s from './training.module.scss';
import { useT } from '../../lib/i18n';

interface Props {
  exercise: Exercise;
  point: ExercisePoint | null;
  /** その日の体重（kg）。合計の行が読む（`ExerciseTotals`） */
  bodyWeight: number | null;
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
  /** この部位の今週と部位の目標（`GroupWeekLine`）、この種目の目標（`ExerciseGoalLine`） */
  groupWeek?: ReactNode;
}

export function ExerciseCard({
  exercise,
  point,
  bodyWeight,
  previous,
  best,
  bestWeight,
  onRemove,
  onMove,
  onEdit,
  onOpenDetail,
  onOpenGoal,
  groupWeek,
}: Props) {
  const t = useT();

  return (
    <section
      className={ui.card}
      id={`ex-card-${exercise.id}`}
      data-e2e="exercise-card"
      data-e2e-key={exercise.id}
    >
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
        {/* 目標の札は置かない。目標は下の「{指標}の目標」の行が、いまの値と一緒に持つ */}
        <span className={s.exHeadBtns}>
          {/* 並びはやった順。掴むと、その日の種目だけが小さな一覧に畳まれる */}
          {onMove && (
            <MiniButton
              label={t('exercise.reorderOf', { name: exerciseName(t, exercise) })}
              onClick={onMove}
              e2e="exercise-move"
            >
              ⇅
            </MiniButton>
          )}
          <MiniButton
            label={t('exercise.removeFromDay', { name: exerciseName(t, exercise) })}
            onClick={onRemove}
            e2e="exercise-remove"
          >
            ×
          </MiniButton>
        </span>
      </div>

      {/*
        **カードは数字 1 つと形だけ**（2026/10/10、利用者の指摘：文字が多い）。
        その日の量を大きく、セットは「60×10」を並べ、目標は棒、部位の今週は丸で見せる。
        推定1RM・回数・通算の最高は、入力ダイアログと「推移」が持つ。
      */}
      <ExerciseTotals
        compact
        exercise={exercise}
        point={point}
        bodyWeight={bodyWeight}
        previous={previous}
        best={best}
        bestWeight={bestWeight}
      />

      {!isCardio(exercise.group) && <SetChips point={point} repUnit={exercise.repUnit} />}

      {groupWeek && <div className={s.meterRows}>{groupWeek}</div>}

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
          data-e2e="exercise-edit"
          onClick={onEdit}
        >
          {t('common.edit')}
        </button>
        <button
          type="button"
          className={ui.detailBtn}
          aria-label={t('common.trendOf', { name: exerciseName(t, exercise) })}
          data-e2e="exercise-trend"
          onClick={onOpenDetail}
        >
          {t('common.trend')}
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
          data-e2e="exercise-goal"
        >
          {t('common.goal')}
        </button>
      </div>
    </section>
  );
}

/**
 * その日のセットを「60 kg × 10回」で並べる。重量の無いセット（自重・秒）は「10回」「30秒」。
 * 重量は打った値を読むときの単位で出し、小数は要るときだけ付ける（60 / 62.5）。
 */
function SetChips({ point, repUnit }: { point: ExercisePoint | null; repUnit: RepUnit }) {
  const t = useT();
  const { label: unitLabel, conv } = useWeightFormat();
  const sets = (point?.sets ?? []).filter((x) => x.reps != null || x.weight != null);
  if (sets.length === 0) return null;
  // 回数には単位が付くので、重量にも付ける（「9×10」では何の 9 か読めない。2026/10/10、利用者の指摘）
  const amount = (n: number | null) =>
    n == null ? '—' : t('totals.amount', { n, unit: t(REP_UNIT_KEYS[repUnit]) });
  return (
    <ul className={s.setChips} data-e2e="exercise-set-chips">
      {sets.map((x) => (
        <li key={x.index}>
          {x.weight != null
            ? t('card.setOf', {
                weight: Number(conv(x.weight).toFixed(1)),
                unit: unitLabel,
                amount: amount(x.reps),
              })
            : amount(x.reps)}
        </li>
      ))}
    </ul>
  );
}
