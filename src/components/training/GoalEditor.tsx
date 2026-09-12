import { useState } from 'react';
import { NumericInput } from '../NumericInput';
import { GOAL_TYPE_LABELS, REP_UNIT_LABELS, isCardio } from '../../lib/exerciseCatalog';
import { todayISO } from '../../lib/date';
import { fmt } from '../../lib/format';
import {
  TARGET_DISTANCE_RANGE,
  TARGET_DURATION_RANGE,
  TARGET_REPS_RANGE,
  TARGET_SPEED_RANGE,
  TARGET_VOLUME_RANGE,
  TARGET_WEIGHT_RANGE,
} from '../../lib/storage';
import { exerciseHistory, goalCurrent, personalBest } from '../../lib/training';
import type { Exercise, ExercisePoint, GoalType, SessionPoint } from '../../types';
import { Button } from '../Button';
import { Segmented } from '../Segmented';
import ui from '../../styles/ui.module.scss';
import s from './training.module.scss';

interface Props {
  exercise: Exercise;
  sessions: readonly SessionPoint[];
  onUpdate: (exercise: Exercise) => void;
}

const NOTES: Record<GoalType, string> = {
  // どれも 2 行に収まる長さにそろえる（下の goalNote が 2 行ぶんの高さを持つ）
  maintain:
    'いまの水準を保てていればよい種目です。数値は決めず、到達の判定もしません（開始比だけ出ます）。',
  weight: '判定は、その日いちばん重かった記録した重量で行います（推定1RMでは判定しません）。',
  volume: '判定は、その日の総挙上量（有効重量 × レップ数の合計）で行います。',
  reps: 'そのセッションの最大レップ数で判定します。',
  distance: 'その日の合計距離（m）で判定します。何本に分けても合計で数えます。',
  speed: '合計距離 ÷ 合計時間（m/分）で判定します。速いほど大きい値です。',
  duration: 'その日の合計時間で判定します。',
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
  const cardio = isCardio(exercise.group);
  const types: GoalType[] = cardio
    ? ['maintain', 'distance', 'duration', 'speed']
    : seconds
      ? ['maintain', 'reps']
      : ['maintain', 'weight', 'volume', 'reps'];

  const [type, setType] = useState<GoalType>(
    exercise.goal?.type ?? (cardio ? 'distance' : seconds ? 'reps' : 'weight'),
  );

  const maintain = type === 'maintain';
  const range =
    type === 'reps'
      ? TARGET_REPS_RANGE
      : type === 'volume'
        ? TARGET_VOLUME_RANGE
        : type === 'distance'
          ? TARGET_DISTANCE_RANGE
          : type === 'duration'
            ? TARGET_DURATION_RANGE
            : type === 'speed'
              ? TARGET_SPEED_RANGE
              : TARGET_WEIGHT_RANGE;
  const history = exerciseHistory(sessions, exercise.id);
  /*
   * **維持は主指標そのものを見る**ので、単位も主指標に合わせる。
   *
   * 有酸素の主指標は合計距離だが、距離を打たない種目（縄跳び）では時間に落ちる。
   * どちらになるかは記録を見ないと決まらないので、履歴から引く。
   * m/分 にはならない。速度は「維持」ではなく「速度」を選んだときの指標。
   */
  const maintainUnit = cardio
    ? history.some((h) => h.point.meters != null)
      ? 'm'
      : '分'
    : exercise.repUnit === 'seconds'
      ? '秒'
      : 'kg';
  const unit =
    type === 'reps'
      ? REP_UNIT_LABELS[exercise.repUnit]
      : type === 'distance'
        ? 'm'
        : type === 'duration'
          ? '分'
          : type === 'speed'
            ? 'm/分'
            : type === 'maintain'
              ? maintainUnit
              : 'kg';
  const digits = type === 'weight' || type === 'speed' ? 1 : 0;

  /*
   * 決める材料は**到達率と同じ取り方**で出す（`goalCurrent`）。
   * 以前はここに同じ 7 通りの表を置いていて、片方を直すともう片方が古くなる形だった
   * ——「いま 100kg」と出しているのに、到達率は別の値で計算しうる。
   */
  const pick = (p: ExercisePoint) => goalCurrent(type, p);
  const values = history.map((h) => pick(h.point)).filter((v): v is number => v != null);
  const latest = values.length > 0 ? values[values.length - 1]! : null;
  const best = personalBest(sessions, exercise.id, todayISO(), pick);

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
      <Segmented
        label={`${exercise.name}の目標の種類`}
        value={type}
        options={types.map((id) => ({
          id,
          label: id === 'reps' && seconds ? '秒数' : GOAL_TYPE_LABELS[id],
        }))}
        onChange={choose}
      />

      {/*
        **「維持」でも欄はそのまま置いて、見えなくするだけ。**
        種類を切り替えるたびにダイアログの高さが変わると、次に押したい場所が動く。

        高さを別に指定して場所だけ確保する形だと、欄の実際の高さ
        （枠線・行の高さ・端末のフォント）とわずかにずれる。
        **同じ要素を残せば、確保する高さは常に一致する。**
        visibility: hidden はフォーカスの順序からも外れるので、触れることはない。
      */}
      <div
        className={`${s.goalValueRow} ${maintain ? s.goalValueHidden : ''}`}
        aria-hidden={maintain || undefined}
      >
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

      {/*
        **場所は常に空けておく。**
        「維持」は選んだ時点で目標として成立するので、ここでボタンが現れる。
        出たり消えたりすると、種類を切り替えるたびに下がその高さぶん動く。
      */}
      <div className={exercise.goal ? undefined : s.goalRemoveEmpty}>
        {exercise.goal && (
          <Button tone="ghost" size="sub" onClick={() => onUpdate({ ...exercise, goal: null })}>
            目標を外す
          </Button>
        )}
      </div>

      <p className={`${ui.note} ${s.goalNote}`}>{NOTES[type]}</p>
    </div>
  );
}
