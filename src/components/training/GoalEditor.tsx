import { useState } from 'react';
import { NumericInput } from '../NumericInput';
import { GOAL_TYPE_LABELS, REP_UNIT_LABELS } from '../../lib/exerciseCatalog';
import { todayISO } from '../../lib/date';
import { fmt } from '../../lib/format';
import { TARGET_REPS_RANGE, TARGET_VOLUME_RANGE, TARGET_WEIGHT_RANGE } from '../../lib/storage';
import { exerciseHistory, personalBest } from '../../lib/training';
import type { Exercise, ExercisePoint, GoalType, SessionPoint } from '../../types';
import ui from '../../styles/ui.module.scss';
import s from './training.module.scss';

interface Props {
  exercise: Exercise;
  sessions: readonly SessionPoint[];
  onUpdate: (exercise: Exercise) => void;
}

/** 目標の種類ごとの、判定に使う値。lib/training の currentOf と同じ取り方 */
const PICK: Record<GoalType, (p: ExercisePoint) => number | null> = {
  maintain: (p) => (p.volume > 0 ? p.volume : p.maxReps),
  weight: (p) => p.top?.weight ?? null,
  volume: (p) => (p.volume > 0 ? p.volume : null),
  reps: (p) => p.maxReps,
};

const NOTES: Record<GoalType, string> = {
  maintain:
    'いまの水準を保てていればよい種目です。数値は決めず、到達・未到達の判定もしません（開始比だけ出ます）。',
  weight: '判定は、その日いちばん重かった記録した重量で行います（推定1RMでは判定しません）。',
  volume: '判定は、その日の総挙上量（有効重量 × レップ数の合計）で行います。',
  reps: 'そのセッションの最大レップ数で判定します。',
};

/**
 * 種目 1 件の目標。
 *
 * 目標画面の行からも、目標を新しく決めるときのモーダルからも同じものを使う。
 * 目標の種類は値が入る前でも選べる必要があるので、goal とは別に持つ。
 *
 * 種類はドロップダウンにしない。開いて選ばせる意味がなく、
 * 選んだあとに単位が変わることが 1 タップで見えたほうが決めやすい。
 *
 * **現状維持を選べるようにしてある。** 種目によっては「これ以上は伸ばさない」が答えで、
 * 全部の種目に数値を求めると、そう思っている種目にも未達の顔をさせることになる。
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
  const types: GoalType[] = seconds
    ? ['maintain', 'reps']
    : ['maintain', 'weight', 'volume', 'reps'];

  const [type, setType] = useState<GoalType>(exercise.goal?.type ?? (seconds ? 'reps' : 'weight'));

  const maintain = type === 'maintain';
  const range =
    type === 'reps'
      ? TARGET_REPS_RANGE
      : type === 'volume'
        ? TARGET_VOLUME_RANGE
        : TARGET_WEIGHT_RANGE;
  const unit = type === 'reps' ? REP_UNIT_LABELS[exercise.repUnit] : 'kg';
  const digits = type === 'weight' ? 1 : 0;

  const history = exerciseHistory(sessions, exercise.id);
  const values = history.map((h) => PICK[type](h.point)).filter((v): v is number => v != null);
  const latest = values.length > 0 ? values[values.length - 1]! : null;
  const best = personalBest(sessions, exercise.id, todayISO(), PICK[type]);

  const choose = (next: GoalType) => {
    setType(next);
    // 現状維持は数値を持たない。選んだ時点で目標として成立する
    if (next === 'maintain') {
      onUpdate({ ...exercise, goal: { type: 'maintain', value: null } });
      return;
    }
    // 値が入っているなら、種類を変えた時点でその値の意味も変わる
    if (exercise.goal?.value != null) {
      onUpdate({ ...exercise, goal: { type: next, value: exercise.goal.value } });
    }
  };

  return (
    <div className={s.goalForm}>
      <div className={ui.segmented} role="group" aria-label={`${exercise.name}の目標の種類`}>
        {types.map((id) => (
          <button
            key={id}
            type="button"
            className={ui.segment}
            aria-pressed={type === id}
            onClick={() => choose(id)}
          >
            {id === 'reps' && seconds ? '秒数' : GOAL_TYPE_LABELS[id]}
          </button>
        ))}
      </div>

      {!maintain && (
        <div className={s.goalValueRow}>
          <NumericInput
            id={`goal-value-${exercise.id}`}
            className={s.goalValue}
            ariaLabel={`${exercise.name}の目標`}
            value={exercise.goal?.value ?? null}
            min={range[0]}
            max={range[1]}
            step={type === 'weight' ? 0.5 : 1}
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
                goal: { type, value: type === 'weight' ? value : Math.round(value) },
              });
            }}
          />
          <span className={s.goalUnit}>{unit}</span>
        </div>
      )}

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

      <p className={ui.note}>{NOTES[type]}</p>
    </div>
  );
}
