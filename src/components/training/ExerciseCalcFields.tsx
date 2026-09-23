import { useId } from 'react';
import { LOAD_MODE_HINT_KEYS, LOAD_MODE_KEYS, LOAD_MODE_ORDER } from '../../lib/exerciseCatalog';
import { NumericInput } from '../NumericInput';
import { Select } from '../Select';
import { FACTOR_RANGE, RM_DIVISOR_RANGE } from '../../lib/storage';
import type { LoadMode, RepUnit } from '../../types';
import s from './training.module.scss';
import { useT } from '../../lib/i18n';
import type { MessageKey } from '../../lib/i18n';

/** 計算に効く 4 つ。種目の実体でも、作りかけのフォームでも同じ形で渡せるだけを持つ */
export interface CalcValues {
  loadMode: LoadMode;
  repUnit: RepUnit;
  bodyweightFactor: number | null;
  rmDivisor: number;
}

/*
 * 選ぶときの名前。`REP_UNIT_LABELS`（「回」「秒」）は数字に添える単位なので、
 * ここでは使わない——何を選んでいるのかは、例が付いていないと決めにくい
 */
const REP_UNIT_KEYS: Record<RepUnit, MessageKey> = {
  reps: 'calc.reps',
  seconds: 'calc.seconds',
};

interface Props {
  value: CalcValues;
  /** 触った項目だけを返す。書き戻し先（種目 / フォーム）は呼び出し側が決める */
  onChange: (patch: Partial<CalcValues>) => void;
}

/**
 * 種目の計算設定。**新しく作る面と、あとから変える面で同じものを使う。**
 *
 * 同じ 4 項目を 2 つのフォームが別々に持っていた。**ラベルもヒントも値域も
 * 一字一句同じ**だったので、片方を直すともう片方が古くなる——実際、
 * 回数の単位のヒントだけ 2 通りに分かれていた。
 *
 * ここに置くのは「計算に効く値」だけ。部位・補助部位・レビューの値は、
 * 触る場面が違うので面の側が持つ。
 */
export function ExerciseCalcFields({ value, onChange }: Props) {
  const t = useT();
  const id = useId();

  return (
    <>
      {/* 器具の名前ではなく、見れば分かる持ち方を選ばせる */}
      <label className={s.newField}>
        {t('calc.loadMode')}
        <Select
          value={value.loadMode}
          options={LOAD_MODE_ORDER.map((m) => ({ id: m, label: t(LOAD_MODE_KEYS[m]) }))}
          onChange={(loadMode) => onChange({ loadMode })}
        />
        <small>{t(LOAD_MODE_HINT_KEYS[value.loadMode])}</small>
      </label>

      <label className={s.newField}>
        {t('calc.repUnit')}
        <Select
          value={value.repUnit}
          options={(Object.keys(REP_UNIT_KEYS) as RepUnit[]).map((u) => ({
            id: u,
            label: t(REP_UNIT_KEYS[u]),
          }))}
          onChange={(repUnit) => onChange({ repUnit })}
        />
        <small>{t('calc.secondsNote')}</small>
      </label>

      {/* 体重が乗る割合が要るのは自重種目だけ。ほかで出すと効かない値を見せることになる */}
      {value.loadMode === 'bodyweight' && (
        <label className={s.newField} htmlFor={`${id}-factor`}>
          {t('calc.bodyweightFactor')}
          {/* 係数なので小数第 2 位まで残す。1 位で丸めると 0.65 が 0.7 になる */}
          <NumericInput
            id={`${id}-factor`}
            value={value.bodyweightFactor}
            min={FACTOR_RANGE[0]}
            max={FACTOR_RANGE[1]}
            step={0.05}
            decimals={2}
            placeholder="1"
            onCommit={(v) => onChange({ bodyweightFactor: v })}
          />
        </label>
      )}

      {/* 秒で数える種目は挙上量を持たないので、1RM 換算もしない */}
      {value.repUnit === 'reps' && (
        <label className={s.newField} htmlFor={`${id}-divisor`}>
          {t('calc.rmDivisor')}
          {/* 空にはできない項目。消した状態から離れたら、もとの値の表示に戻る */}
          <NumericInput
            id={`${id}-divisor`}
            value={value.rmDivisor}
            min={RM_DIVISOR_RANGE[0]}
            max={RM_DIVISOR_RANGE[1]}
            step={0.1}
            onCommit={(v) => onChange({ rmDivisor: v ?? value.rmDivisor })}
          />
        </label>
      )}
    </>
  );
}
