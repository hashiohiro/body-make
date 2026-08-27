import { useState } from 'react';
import { NumericInput } from '../NumericInput';
import { REP_UNIT_LABELS } from '../../lib/exerciseCatalog';
import { todayISO } from '../../lib/date';
import { fmt } from '../../lib/format';
import { TARGET_REPS_RANGE, TARGET_WEIGHT_RANGE } from '../../lib/storage';
import { exerciseHistory, personalBest } from '../../lib/training';
import type { Exercise, ExercisePoint, GoalType, SessionPoint } from '../../types';
import ui from '../../styles/ui.module.scss';
import s from './training.module.scss';

interface Props {
  exercise: Exercise;
  sessions: readonly SessionPoint[];
  onUpdate: (exercise: Exercise) => void;
}

/** 目標の種類ごとの、判定に使う値。ExerciseGoal の currentOf と同じ取り方 */
const PICK: Record<GoalType, (p: ExercisePoint) => number | null> = {
  weight: (p) => p.top?.weight ?? null,
  reps: (p) => p.maxReps,
};

/**
 * 種目 1 件の目標。
 *
 * 目標画面の行からも、目標を新しく決めるときのモーダルからも同じものを使う。
 * 目標の種類は値が入る前でも選べる必要があるので、goal とは別に持つ。
 *
 * 種類はドロップダウンにしない。2 択を開いて選ばせる意味がなく、
 * 選んだあとに単位が変わることが 1 タップで見えたほうが決めやすい。
 *
 * 「いま」と「過去最大」を添える。100kg を目標にするかは、いま何 kg 挙がっているかを
 * 見ないと決められない。**値は入れない**（アプリが目標を発明することになる）。
 */
export function GoalEditor({ exercise, sessions, onUpdate }: Props) {
  /*
   * 秒で数える種目は重量を記録できない（挙上量に計上されないので入力欄も出していない）。
   * 届きようのない目標を選択肢に出さない。
   */
  const seconds = exercise.repUnit === 'seconds';
  const [type, setType] = useState<GoalType>(seconds ? 'reps' : (exercise.goal?.type ?? 'weight'));

  const range = type === 'reps' ? TARGET_REPS_RANGE : TARGET_WEIGHT_RANGE;
  const unit = type === 'reps' ? REP_UNIT_LABELS[exercise.repUnit] : 'kg';
  const digits = type === 'reps' ? 0 : 1;

  const history = exerciseHistory(sessions, exercise.id);
  const values = history.map((h) => PICK[type](h.point)).filter((v): v is number => v != null);
  const latest = values.length > 0 ? values[values.length - 1]! : null;
  const best = personalBest(sessions, exercise.id, todayISO(), PICK[type]);

  return (
    <div className={s.goalForm}>
      {!seconds && (
        <div className={ui.segmented} role="group" aria-label={`${exercise.name}の目標の種類`}>
          {(['weight', 'reps'] as GoalType[]).map((id) => (
            <button
              key={id}
              type="button"
              className={ui.segment}
              aria-pressed={type === id}
              onClick={() => {
                setType(id);
                // 値が入っているなら、種類を変えた時点でその値の意味も変わる
                if (exercise.goal)
                  onUpdate({ ...exercise, goal: { type: id, value: exercise.goal.value } });
              }}
            >
              {id === 'weight' ? '重量' : '回数'}
            </button>
          ))}
        </div>
      )}

      <div className={s.goalValueRow}>
        <NumericInput
          id={`goal-value-${exercise.id}`}
          className={s.goalValue}
          ariaLabel={`${exercise.name}の目標`}
          value={exercise.goal?.value ?? null}
          min={range[0]}
          max={range[1]}
          step={type === 'reps' ? 1 : 0.5}
          placeholder="—"
          /*
           * 欄を空にしただけで目標を消さない。
           * 打ち直すために一度消すのが普通の手順なので、そこで目標ごと落とすと
           * （目標を持つ種目でなくなり）編集中の行がその場から消える。
           * 外すのは下の「目標を外す」だけの仕事。空欄はフォーカスを外した時点で元の値に戻る。
           */
          onCommit={(value) => {
            if (value == null) return;
            onUpdate({
              ...exercise,
              goal: { type, value: type === 'reps' ? Math.round(value) : value },
            });
          }}
        />
        <span className={s.goalUnit}>{unit}</span>
      </div>

      <p className={s.goalFacts}>
        {best == null ? (
          'この種目の記録はまだありません。'
        ) : (
          <>
            いま{' '}
            <b>
              {fmt(latest, digits)} {unit}
            </b>{' '}
            ・ 過去最大{' '}
            <b>
              {fmt(best, digits)} {unit}
            </b>
          </>
        )}
      </p>

      {exercise.goal && (
        <button
          type="button"
          className={`${ui.btn} ${ui.btnGhost} ${ui.btnSm}`}
          onClick={() => onUpdate({ ...exercise, goal: null })}
        >
          目標を外す
        </button>
      )}

      <p className={ui.note}>
        {type === 'weight'
          ? '判定は、その日いちばん重かった記録した重量で行います（推定1RMでは判定しません）。'
          : 'そのセッションの最大レップ数で判定します。'}
      </p>
    </div>
  );
}
