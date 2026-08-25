import { NumericInput } from '../NumericInput';
import { GROUP_LABELS, GROUP_ORDER } from '../../lib/exerciseCatalog';
import { GROUP_GOAL_RANGE } from '../../lib/storage';
import type { GroupGoals, MuscleGroup } from '../../types';
import ui from '../../styles/ui.module.scss';
import s from './training.module.scss';

/**
 * 週の部位別セット数の目安。押すと 6 部位すべてに入り、そのあと部位ごとに変えられる。
 *
 * 部位ごとに違う数字を配らず、どこも同じ値にしてある。
 * 補助部位は係数ぶんで数えるので、腕や肩はプレスや懸垂から自然に積み上がる。
 * こちらで部位ごとの上下を決めると、その積み上がりと二重に効いてしまう。
 */
const PRESETS: { label: string; sets: number | null }[] = [
  { label: '少なめ 8', sets: 8 },
  { label: '標準 12', sets: 12 },
  { label: '多め 16', sets: 16 },
  { label: '決めない', sets: null },
];

interface Props {
  goals: GroupGoals;
  onSetGoal: (group: MuscleGroup, value: number | null) => void;
}

/**
 * 週の部位別セット数の目標。
 *
 * 実績（部位別の配分）はホームのヒートマップが持っている。ここは目標を決める場所で、
 * 同じ数字を 2 か所で見せない。
 */
export function WeekGoals({ goals, onSetGoal }: Props) {
  return (
    <section className={ui.card}>
      <header className={ui.cardHeader}>
        <h2 className={ui.cardTitle}>週の部位別セット数の目標</h2>
      </header>

      {/*
        6 部位ぶんの数字を最初から入れさせない。
        「胸は何セットが妥当か」は始めたばかりの人には決めようがないので、
        まとめて入る目安を先に置き、部位ごとの調整はそのあとにする
      */}
      <div className={`${ui.chipRow} ${s.presetRow}`} role="group" aria-label="目安から決める">
        {PRESETS.map((preset) => (
          <button
            key={preset.label}
            type="button"
            className={ui.chip}
            onClick={() => {
              for (const group of GROUP_ORDER) onSetGoal(group, preset.sets);
            }}
          >
            {preset.label}
          </button>
        ))}
      </div>

      {GROUP_ORDER.map((group) => (
        <div className={ui.formRow} key={group}>
          <label htmlFor={`group-goal-${group}`}>{GROUP_LABELS[group]}</label>
          <span className={ui.inputUnit}>
            <NumericInput
              id={`group-goal-${group}`}
              value={goals[group]}
              min={GROUP_GOAL_RANGE[0]}
              max={GROUP_GOAL_RANGE[1]}
              step={1}
              placeholder="—"
              onCommit={(v) => onSetGoal(group, v == null ? null : Math.round(v))}
            />
            <span>セット</span>
          </span>
        </div>
      ))}

      <p className={ui.note}>
        決めた部位だけ、ホームの部位別の配分で目標までの進捗として出ます。
        決めなければセット数だけを出します。種目の補助部位は、既定で0.5セットとして数えます。
      </p>
    </section>
  );
}
