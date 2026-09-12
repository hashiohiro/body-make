import { useState } from 'react';
import { Button } from '../Button';
import { NumericInput } from '../NumericInput';
import { Segmented } from '../Segmented';
import { GROUP_LABELS } from '../../lib/exerciseCatalog';
import { GROUP_GOAL_RANGE, GROUP_VOLUME_GOAL_RANGE } from '../../lib/storage';
import { fmtVolume } from '../../lib/format';
import { formatSets } from '../../lib/training';
import type { GroupGoalType, GroupTarget, MuscleGroup } from '../../types';
import ui from '../../styles/ui.module.scss';
import s from './training.module.scss';

/** 立て方の名前。部位別に見る値（`GROUP_VALUES`）と同じ語にそろえる */
const TYPE_LABELS: Record<GroupGoalType, string> = {
  sets: 'セット数',
  volume: '挙上量',
};

const UNITS: Record<GroupGoalType, string> = { sets: 'セット', volume: 'kg' };

const NOTES: Record<GroupGoalType, string> = {
  // どちらも 2 行に収まる長さにそろえる（下の goalNote が高さを持つ）
  sets: '標準は週10〜15セット。補助部位は既定で0.5セットとして数えます。',
  volume: '重量 × レップ数の合計です。補助部位は係数ぶんで数えます。',
};

interface Props {
  group: MuscleGroup;
  target: GroupTarget | null;
  /** 今週の実績。立て方ごとに割る相手が違う */
  sets: number;
  volume: number;
  /** 最終実施からの日数。null は記録なし */
  days: number | null;
  onChange: (target: GroupTarget | null) => void;
}

/**
 * 部位の目標を決める面。**種目の目標（`GoalEditor`）と同じ組み。**
 *
 * 立て方をトグルで選び、値を欄に打ち、外すのはボタン 1 つ。
 * 同じ「目標を決める」なのに、部位だけ手順が違うと覚え直しになる。
 *
 * **ゲージは出さない。**開いた先で読む相手は 1 つなので、
 * 「12.5 / 20」の数字のほうが速い（バーは行に並べて見比べるためのもの）。
 * 以前は「読む面 →『部位目標を設定』→ 決める面」と 2 段だったが、
 * 部位を開く用はほぼ目標を触ることなので、開いた時点で編集にする。
 *
 * **立て方を変えても値は持ち越さない。**セット数（十の桁）と挙上量（万の桁）で
 * 桁が 3 つ違うので、持ち越すと必ず直すことになる。かわりに
 * **選び替えただけでは保存に触らない**——決めてある目標は、値を打つまで残る。
 */
export function GroupGoalEditor({ group, target, sets, volume, days, onChange }: Props) {
  const [type, setType] = useState<GroupGoalType>(target?.type ?? 'sets');

  // 打ってある値は、その立て方のものだけ出す（別の軸の値を流用しない）
  const value = target != null && target.type === type ? target.value : null;
  const range = type === 'volume' ? GROUP_VOLUME_GOAL_RANGE : GROUP_GOAL_RANGE;
  const current = type === 'volume' ? fmtVolume(volume) : formatSets(sets);

  return (
    <div className={s.goalForm}>
      <Segmented
        label={`${GROUP_LABELS[group]}の目標の種類`}
        value={type}
        options={(Object.keys(TYPE_LABELS) as GroupGoalType[]).map((id) => ({
          id,
          label: TYPE_LABELS[id],
        }))}
        onChange={setType}
      />

      <div className={s.goalValueRow}>
        <NumericInput
          id={`group-goal-${group}`}
          className={s.goalValue}
          ariaLabel={`${GROUP_LABELS[group]}の目標`}
          value={value}
          min={range[0]}
          max={range[1]}
          step={1}
          integer
          placeholder="—"
          /*
           * 欄を空にしただけで目標を消さない（種目の目標と同じ作法）。
           * 打ち直すために一度消すのが普通の手順なので、そこで目標ごと落とすと
           * 決めてあった値が戻せない。外すのは下のボタンだけの仕事。
           */
          onCommit={(next) => {
            if (next == null) return;
            onChange({ type, value: Math.round(next) });
          }}
        />
        <span className={s.goalUnit}>{UNITS[type]}</span>
      </div>

      <p className={s.goalFacts}>
        今週{' '}
        <b>
          {current} {UNITS[type]}
        </b>{' '}
        ・{' '}
        {days == null
          ? 'この部位の記録はまだありません'
          : days === 0
            ? '今日やりました'
            : `最後にやってから ${days}日`}
      </p>

      {/* 場所は常に空けておく（出たり消えたりで下が動かないように） */}
      <div className={target ? undefined : s.goalRemoveEmpty}>
        {target && (
          <Button tone="ghost" size="sub" onClick={() => onChange(null)}>
            目標を外す
          </Button>
        )}
      </div>

      <p className={`${ui.note} ${s.goalNote}`}>{NOTES[type]}この値は日曜に 0 へ戻ります。</p>
    </div>
  );
}
