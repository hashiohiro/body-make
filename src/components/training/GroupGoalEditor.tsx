import { Button } from '../Button';
import { NumericInput } from '../NumericInput';
import { GROUP_KEYS } from '../../lib/exerciseCatalog';
import { GROUP_GOAL_RANGE, GROUP_VOLUME_GOAL_RANGE } from '../../lib/storage';
import { fmtVolume } from '../../lib/format';
import { useWeightFormat } from '../../hooks/useWeightUnit';
import { rangeIn, toKg } from '../../lib/weight';
import { VolumeSwatch } from './VolumeSwatch';
import { formatSets } from '../../lib/training';
import type { GroupTarget, MuscleGroup } from '../../types';
import ui from '../../styles/ui.module.scss';
import s from './training.module.scss';
import { useT } from '../../lib/i18n';

interface Props {
  group: MuscleGroup;
  target: GroupTarget | null;
  /** 今週の実績。欄ごとに割る相手が違う */
  sets: number;
  volume: number;
  /** 最終実施からの日数。null は記録なし */
  days: number | null;
  onChange: (target: GroupTarget | null) => void;
}

/**
 * 部位の目標を決める面。**セット数と挙上量の欄を 2 つ並べる**（どちらか片方だけでもよい）。
 *
 * 以前は立て方をトグルで 1 つ選び、欄は 1 つだった。セット数（どれだけ回数を重ねたか）と
 * 挙上量（どれだけの量を動かしたか）は別の問いなので、両方を同時に追えるようにした。
 *
 * - 欄を空にしただけでは目標を消さない（種目の目標と同じ作法）。**ただし、もう片方の欄に
 *   目標が残っているときだけは、空にした側を外す**——片方だけを外す手段が要る。
 *   最後の 1 つを外すのは下のボタンの仕事。
 * - 挙上量は kg で保存する（`lib/weight.ts`）。出すときに換算し、しまうときに戻す。
 *   値域も打つ単位のまま見る（kg に直してから見ると、上限ちょうどが丸めの向きで弾かれる）。
 */
export function GroupGoalEditor({ group, target, sets, volume, days, onChange }: Props) {
  const t = useT();
  const { unit: weightUnit, label: weightLabel, conv } = useWeightFormat();
  const name = t(GROUP_KEYS[group]);

  const commit = (patch: Partial<GroupTarget>) => {
    const next: GroupTarget = {
      sets: target?.sets ?? null,
      volume: target?.volume ?? null,
      ...patch,
    };
    onChange(next.sets == null && next.volume == null ? null : next);
  };

  const field = (kind: 'sets' | 'volume') => {
    const isVolume = kind === 'volume';
    const stored = target?.[kind] ?? null;
    const other = isVolume ? target?.sets : target?.volume;
    const value = stored == null ? null : isVolume ? Math.round(conv(stored)) : stored;
    const range = isVolume ? rangeIn(GROUP_VOLUME_GOAL_RANGE, weightUnit) : GROUP_GOAL_RANGE;
    const unitLabel = isVolume ? weightLabel : t('metric.setsUnit');
    const current = isVolume ? fmtVolume(conv(volume)) : formatSets(sets);
    const id = `group-goal-${kind}-${group}`;
    return (
      <div className={s.groupGoalField}>
        <label htmlFor={id}>
          <VolumeSwatch kind={kind} />
          {t(isVolume ? 'metric.volume' : 'metric.sets')}
        </label>
        <div className={s.goalValueRow}>
          <NumericInput
            id={id}
            className={s.goalValue}
            ariaLabel={t(isVolume ? 'groupGoal.volumeOf' : 'exercise.goalOf', { name })}
            value={value}
            min={range[0]}
            max={range[1]}
            step={1}
            integer
            placeholder="—"
            onCommit={(next) => {
              if (next == null) {
                // もう片方が残っているときだけ、この側を外す（最後の 1 つは下のボタンで）
                if (stored != null && other != null) commit({ [kind]: null });
                return;
              }
              // 打った値は選んでいる単位。保存は kg に戻してから
              commit({ [kind]: Math.round(isVolume ? toKg(next, weightUnit) : next) });
            }}
          />
          <span className={s.goalUnit}>{unitLabel}</span>
        </div>
        <p className={s.goalFacts}>
          {t('recovery.thisWeek')}{' '}
          <b>
            {current} {unitLabel}
          </b>
        </p>
      </div>
    );
  };

  return (
    <div className={s.goalForm}>
      <div className={s.groupGoalFields}>
        {field('sets')}
        {field('volume')}
      </div>

      <p className={s.goalFacts}>
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

      <p className={ui.note}>
        {t('groupGoal.setsNote')}
        {t('groupGoal.volumeNote')}
        {t('groupGoal.resetNote')}
      </p>
    </div>
  );
}
