import { useId, useState } from 'react';
import {
  EXERCISE_GROUP_ORDER,
  GROUP_LABELS,
  GROUP_ORDER,
  isCardio,
  SUB_GROUP_WEIGHT,
  SUB_GROUP_WEIGHT_STEPS,
} from '../../lib/exerciseCatalog';
import { MINUTES_PER_SET_RANGE } from '../../lib/storage';
import { ExerciseCalcFields } from './ExerciseCalcFields';
import type { Exercise } from '../../types';
import { NumericInput } from '../NumericInput';
import { Select } from '../Select';
import { Pill } from '../Pill';
import { Button } from '../Button';
import s from './training.module.scss';

interface Props {
  exercise: Exercise;
  onUpdate: (exercise: Exercise) => void;
}

/**
 * 種目そのものの性質（部位・補助部位・負荷の数え方・単位・係数）。
 *
 * **マイ種目（設定）と部位の目標（目標タブ）で同じものを使う。**
 * どちらの画面でも同じ種目カードを開くのに、片方だけ「設定」が無いと、
 * 直したくなったときにもう一方の画面を探しに行くことになる。
 */
export function ExerciseSettingsForm({ exercise: ex, onUpdate }: Props) {
  // 計算の仕方は、カタログから入れれば埋まっている。開いた瞬間に並べず、もう一段畳む
  const [calc, setCalc] = useState(false);
  // 構成チェックの値も同じ扱い。触らなくても記録は取れる
  const [check, setCheck] = useState(false);
  const fieldId = useId();

  // 取り込んだデータが刻みから外れた値でも、選択中の値は必ず出す
  const subWeightOptions = (current: number) =>
    SUB_GROUP_WEIGHT_STEPS.includes(current)
      ? SUB_GROUP_WEIGHT_STEPS
      : [...SUB_GROUP_WEIGHT_STEPS, current].sort((a, b) => a - b);

  return (
    <div className={s.newForm}>
      {/* フォーム次第で主働筋が変わる種目（ディップスなど）があるので、部位も変えられる */}
      <label className={s.newField}>
        部位
        <Select
          value={ex.group}
          options={EXERCISE_GROUP_ORDER.map((g) => ({ id: g, label: GROUP_LABELS[g] }))}
          onChange={(group) => {
            // 新しい主部位が補助部位に残っていると、その部位を二重に数える。
            // 保存時のサニタイズは読み込みでしか走らないので、ここで落とす
            onUpdate({
              ...ex,
              group,
              subGroups: ex.subGroups.filter((x) => x.group !== group),
            });
          }}
        />
      </label>

      <div className={s.newField}>
        補助的に使う部位
        <div className={s.pickerList}>
          {GROUP_ORDER.filter((g) => g !== ex.group).map((g) => {
            const on = ex.subGroups.some((x) => x.group === g);
            return (
              <Pill
                key={g}
                pressed={on}
                onClick={() =>
                  onUpdate({
                    ...ex,
                    subGroups: on
                      ? ex.subGroups.filter((x) => x.group !== g)
                      : [...ex.subGroups, { group: g, weight: SUB_GROUP_WEIGHT }],
                  })
                }
              >
                {GROUP_LABELS[g]}
              </Pill>
            );
          })}
        </div>
        {/*
            関与の大きさは種目で違う。デッドリフトの脚は主働筋なので 1、
            体幹は姿勢の保持なので 0.5 が近い。既定のままでも困らないので、
            選んだ部位のぶんだけ出す
          */}
        {ex.subGroups.map((sub) => (
          <div key={sub.group} className={s.subWeightRow}>
            <span className={s.subWeightName}>{GROUP_LABELS[sub.group]}</span>
            <div className={s.pickerList}>
              {subWeightOptions(sub.weight).map((w) => (
                <Pill
                  key={w}
                  small
                  pressed={sub.weight === w}
                  label={`${GROUP_LABELS[sub.group]}を${w}で数える`}
                  onClick={() =>
                    onUpdate({
                      ...ex,
                      subGroups: ex.subGroups.map((x) =>
                        x.group === sub.group ? { ...x, weight: w } : x,
                      ),
                    })
                  }
                >
                  ×{w}
                </Pill>
              ))}
            </div>
          </div>
        ))}
        <small>
          主部位を1としたときの割合。ベンチが胸1・肩0.5・腕0.5なら、3セットで 胸3・肩1.5・腕1.5
        </small>
      </div>

      {/*
          ここから下は計算の仕方。カタログから追加すれば既に埋まっていて、
          触る必要がほとんど無い。開いた瞬間に並べると
          「決めなければいけない項目」に見えるので、もう一段畳む
        */}
      <Button tone="ghost" size="sub" expanded={calc} onClick={() => setCalc((v) => !v)}>
        {calc ? '計算方法を閉じる' : '計算方法を変える'}
      </Button>

      {calc && (
        <>
          <ExerciseCalcFields value={ex} onChange={(patch) => onUpdate({ ...ex, ...patch })} />

          {/*
            繰り返すかどうか。既定はカタログが持っていて、ここで種目ごとに変えられる。
            走る人がインターバルもやる、という切り替えがここで済む
          */}
          <label className={s.newField}>
            {isCardio(ex.group) ? '本数' : 'セット'}
            <Select
              value={ex.repeated ? 'many' : 'one'}
              options={[
                {
                  id: 'many',
                  label: isCardio(ex.group)
                    ? '分けて記録する（インターバル）'
                    : '複数セットで記録する',
                },
                { id: 'one', label: '1回で完結する' },
              ]}
              onChange={(mode) => onUpdate({ ...ex, repeated: mode === 'many' })}
            />
            <small>1回で完結する種目は、行を足すボタンを出しません</small>
          </label>
        </>
      )}

      {/*
        構成チェックの値。カタログから入れた種目でも、順序がはっきりしている種目にしか
        入っていない（design-checks.md §4.3）。触らなければ判定に出てこないだけで、
        記録そのものには一切効かないので、計算方法と同じくもう一段畳む。
      */}
      <Button tone="ghost" size="sub" expanded={check} onClick={() => setCheck((v) => !v)}>
        {check ? 'レビューの値を閉じる' : 'レビューの値を変える'}
      </Button>

      {check && (
        <>
          <div className={s.newField}>
            この種目の性質
            <div className={s.pickerList}>
              <Pill pressed={ex.axial} onClick={() => onUpdate({ ...ex, axial: !ex.axial })}>
                {ex.axial ? '✓ ' : ''}軸荷重種目
              </Pill>
            </div>
            <small>
              背骨に荷重を通す種目（デッドリフト・スクワット・RDLなど）。連日になったときに知らせます
            </small>
          </div>

          <label className={s.newField} htmlFor={`${fieldId}-minutes`}>
            1セットあたりの時間（分）
            <NumericInput
              id={`${fieldId}-minutes`}
              value={ex.minutesPerSet}
              min={MINUTES_PER_SET_RANGE[0]}
              max={MINUTES_PER_SET_RANGE[1]}
              step={0.5}
              placeholder="既定値を使う"
              onCommit={(v) => onUpdate({ ...ex, minutesPerSet: v })}
            />
            <small>
              空欄なら設定の既定値。休憩の長い高重量種目だけ入れます。
              ラック確保やプレートの付け替えもここに含めます（基本時間は別に持ちません）
            </small>
          </label>
        </>
      )}
    </div>
  );
}
