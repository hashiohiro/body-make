import { useState } from 'react';
import { Button } from '../Button';
import { NumericInput } from '../NumericInput';
import { Segmented } from '../Segmented';
import { GROUP_KEYS } from '../../lib/exerciseCatalog';
import { GROUP_GOAL_RANGE, GROUP_VOLUME_GOAL_RANGE } from '../../lib/storage';
import { fmtVolume } from '../../lib/format';
import { formatSets } from '../../lib/training';
import { useWeightFormat } from '../../hooks/useWeightUnit';
import { rangeIn, toKg } from '../../lib/weight';
import type { GroupGoalType, GroupTarget, MuscleGroup } from '../../types';
import ui from '../../styles/ui.module.scss';
import s from './training.module.scss';
import { useT } from '../../lib/i18n';
import type { MessageKey } from '../../lib/i18n';

/** 立て方の名前。部位別に見る値（`GROUP_VALUES`）と同じ語にそろえる */
const TYPE_KEYS: Record<GroupGoalType, MessageKey> = {
  sets: 'metric.sets',
  volume: 'metric.volume',
};

const NOTE_KEYS: Record<GroupGoalType, MessageKey> = {
  // どちらも 2 行に収まる長さにそろえる（下の goalNote が高さを持つ）
  sets: 'groupGoal.setsNote',
  volume: 'groupGoal.volumeNote',
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
  const t = useT();
  const [type, setType] = useState<GroupGoalType>(target?.type ?? 'sets');
  /*
   * 挙上量の目標は kg で保存する（`lib/weight.ts`）。ここは打つ場所でもあるので、
   * **出すときに換算し、しまうときに戻す。**値域も打つ単位のまま見る——
   * kg に直してから見ると、上限ちょうどが丸めの向きで弾かれる。
   * セット数は重量ではないので、どちらの単位でも素通し。
   */
  const { unit: weightUnit, label: weightLabel, conv } = useWeightFormat();
  const isVolume = type === 'volume';
  const unitLabel = isVolume ? weightLabel : t('metric.setsUnit');

  // 打ってある値は、その立て方のものだけ出す（別の軸の値を流用しない）
  const stored = target != null && target.type === type ? target.value : null;
  const value = stored == null ? null : isVolume ? Math.round(conv(stored)) : stored;
  const range = isVolume ? rangeIn(GROUP_VOLUME_GOAL_RANGE, weightUnit) : GROUP_GOAL_RANGE;
  const current = isVolume ? fmtVolume(conv(volume)) : formatSets(sets);

  return (
    <div className={s.goalForm}>
      <Segmented
        label={t('goalEditor.typeOf', { name: t(GROUP_KEYS[group]) })}
        value={type}
        options={(Object.keys(TYPE_KEYS) as GroupGoalType[]).map((id) => ({
          id,
          label: t(TYPE_KEYS[id]),
        }))}
        onChange={setType}
      />

      <div className={s.goalValueRow}>
        <NumericInput
          id={`group-goal-${group}`}
          className={s.goalValue}
          ariaLabel={t('exercise.goalOf', { name: t(GROUP_KEYS[group]) })}
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
            // 打った値は選んでいる単位。保存は kg に戻してから
            onChange({ type, value: Math.round(isVolume ? toKg(next, weightUnit) : next) });
          }}
        />
        <span className={s.goalUnit}>{unitLabel}</span>
      </div>

      <p className={s.goalFacts}>
        {t('recovery.thisWeek')}{' '}
        <b>
          {current} {unitLabel}
        </b>{' '}
        ・{' '}
        {days == null
          ? t('groupGoal.noRecord')
          : days === 0
            ? t('groupGoal.today')
            : t('groupGoal.sinceDays', { n: days })}
      </p>

      {/* 場所は常に空けておく（出たり消えたりで下が動かないように） */}
      <div className={target ? undefined : s.goalRemoveEmpty}>
        {target && (
          <Button tone="ghost" size="sub" onClick={() => onChange(null)}>
            {t('groupGoal.remove')}
          </Button>
        )}
      </div>

      <p className={`${ui.note} ${s.goalNote}`}>
        {t(NOTE_KEYS[type])}
        {t('groupGoal.resetNote')}
      </p>
    </div>
  );
}
