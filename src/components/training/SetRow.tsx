import { NumericInput } from '../NumericInput';
import {
  DISTANCE_M_RANGE,
  DURATION_SEC_RANGE,
  SET_WEIGHT_RANGE,
  repRangeOf,
} from '../../lib/storage';
import { fmt } from '../../lib/format';
import { WEIGHT_UNIT_LABEL, fromKg, fromKgForField, rangeIn, toKgOrNull } from '../../lib/weight';
import type { WeightUnit } from '../../lib/weight';
import type { CardioSet, RepUnit, SessionSet, SetPoint, WorkSet } from '../../types';
import type { SetField } from '../../hooks/useBodyData';
import s from './training.module.scss';
import { useT } from '../../lib/i18n';
import type { MessageKey } from '../../lib/i18n';

interface NumberCellProps {
  value: number | null;
  /** 直近の値。未入力のときプレースホルダに薄く出す */
  fallback: number | null;
  min: number;
  max: number;
  integer?: boolean;
  ariaLabel: string;
  onCommit: (value: number | null) => void;
}

/**
 * セット行の中の数字の欄。
 *
 * 欄そのものは `NumericInput`。ここが持つのは**行の中に置くための形**だけ
 * （幅いっぱい・中央寄せ・ラベルは読み上げだけ）。
 * 刻みは端末に任せる——重量は 2.5kg プレートで 0.5 刻みになる。
 */
function NumberCell({ value, fallback, min, max, integer, ariaLabel, onCommit }: NumberCellProps) {
  return (
    <NumericInput
      className={s.input}
      value={value}
      fallback={fallback}
      min={min}
      max={max}
      step="any"
      integer={integer}
      ariaLabel={ariaLabel}
      onCommit={onCommit}
    />
  );
}

/** 1 つ目の欄が何を指すか。読み上げとテストがこの名前で引く */
const FIELD_KEYS: Record<RepUnit, MessageKey> = {
  reps: 'set.reps',
  seconds: 'set.seconds',
};

interface Props {
  index: number;
  set: SessionSet;
  point: SetPoint | null;
  repUnit: RepUnit;
  /**
   * 有酸素か。2 つの欄が 時間(分) と 距離(m) になり、間の記号も「×」ではなくなる。
   * **持っている値は 秒 と m。**分と km は読み書きのときの単位で、丸めを持ち込まない。
   */
  cardio: boolean;
  /** 重量欄を出すか。自重種目と秒で数える種目では畳む（ExerciseCard が決める） */
  showWeight: boolean;
  /**
   * 重量欄で打つ単位。**保存は常に kg**（`lib/weight.ts`）。
   *
   * 換算するのはこの欄の中だけ。回数・距離・時間には効かない。
   */
  weightUnit: WeightUnit;
  /**
   * 自重ぶん（kg）。**null なら「追加」ではないので、式も出さない。**
   *
   * 自重種目の重量欄は「追加重量」で、負荷は `自重 ＋ 追加` で決まる。
   * ところが欄には追加ぶんしか出ないので、**何に足されるのかが画面のどこにも
   * 書かれていなかった**（20kg と打って 320kg と出る理由が読めない）。
   * 足される側を欄の前に固定で置いて、行そのものを式にする。
   */
  baseWeight: number | null;
  fallbackWeight: number | null;
  fallbackReps: number | null;
  onValue: (field: SetField, value: number | null) => void;
  /** 行を足せない種目では、連番も削除も出さない（1 回で完結する種目） */
  rowClass: string;
  /**
   * 連番（と TOP の印）を出すか。**行を足せる種目かどうかで決まる。**
   *
   * 以前は `onRemove` の有無で出し分けていたが、削除を落とすと連番まで消え、
   * `grid-template-columns` の 1 列目（34px）に入力欄が入って潰れた。
   * **見せる情報と、押せる操作は別。**
   */
  showIndex: boolean;
  onRemove: (() => void) | undefined;
}

export function SetRow({
  index,
  set,
  point,
  repUnit,
  cardio,
  showWeight,
  weightUnit,
  baseWeight,
  fallbackWeight,
  fallbackReps,
  onValue,
  showIndex,
  onRemove,
  rowClass,
}: Props) {
  const t = useT();
  const role = point?.role ?? 'work';
  // 器はこの行の描き方そのものを変える。種目が決めるので set 側の形は見ない
  const bout = set as CardioSet;
  const work = set as WorkSet;

  return (
    <div className={`${s.setRow} ${rowClass}`} data-set-row={index}>
      {/* TOP は「いちばん重かったセット」の印。有酸素にその概念はない */}
      {showIndex && (
        <span className={`${s.setIndex} ${role === 'top' && !cardio ? s.setIndexTop : ''}`}>
          {role === 'top' && !cardio ? 'TOP' : index + 1}
        </span>
      )}

      {cardio ? (
        <>
          <NumberCell
            /*
              秒を分に直して出す。**小数第 2 位まで丸める。**
              47 秒をそのまま割ると 0.7833333333 が欄に出る。
              2 桁なら 0.78 で、打ち直しても 47 秒に戻る（1 桁だと 0.8＝48 秒にずれる）。
            */
            value={bout.seconds == null ? null : Math.round((bout.seconds / 60) * 100) / 100}
            fallback={fallbackReps}
            min={DURATION_SEC_RANGE[0] / 60}
            max={DURATION_SEC_RANGE[1] / 60}
            ariaLabel={t('setRow.duration', { n: index + 1 })}
            // 打つのは分、持つのは秒。90 秒を 1.5 と書けて、丸めも起きない
            onCommit={(v) => onValue('seconds', v == null ? null : Math.round(v * 60))}
          />

          {/* 掛け算になるのは「重量 × 回数」のときだけ。距離と時間は掛けない */}
          <span className={s.times} aria-hidden="true">
            /
          </span>

          <NumberCell
            value={bout.meters}
            fallback={fallbackWeight}
            integer
            min={DISTANCE_M_RANGE[0]}
            max={DISTANCE_M_RANGE[1]}
            ariaLabel={t('setRow.distance', { n: index + 1 })}
            onCommit={(v) => onValue('meters', v)}
          />
        </>
      ) : (
        <>
          <NumberCell
            value={work.reps}
            fallback={fallbackReps}
            integer
            // 値域は単位ごとに違う（3 分プランクも入る）
            min={repRangeOf(repUnit)[0]}
            max={repRangeOf(repUnit)[1]}
            ariaLabel={t('setRow.field', { n: index + 1, field: t(FIELD_KEYS[repUnit]) })}
            onCommit={(v) => onValue('reps', v)}
          />

          {showWeight && (
            <>
              <span className={s.times} aria-hidden="true">
                ×
              </span>

              <span className={baseWeight == null ? undefined : s.addedCell}>
                {/*
                  足される側。**押せない固定表示**で、行を「自重 ＋ 追加」の式にする。
                  体重が未記録のときは 0（`effectiveWeight` もそう数える）。
                */}
                {baseWeight != null && (
                  <span className={s.addedBase} aria-hidden="true">
                    {fmt(fromKg(baseWeight, weightUnit), baseWeight === 0 ? 0 : 1)}
                    <i className={s.addedPlus}>＋</i>
                  </span>
                )}
                <NumberCell
                  /*
                    打つのは選んだ単位、持つのは kg。
                    **値域も打つ単位のまま見る**（`rangeIn`）——kg に直してから見ると、
                    上限ちょうど（500kg = 1102.31lb）が丸めの向きで弾かれる。
                  */
                  value={fromKgForField(work.weight, weightUnit)}
                  fallback={fromKgForField(fallbackWeight, weightUnit)}
                  min={rangeIn(SET_WEIGHT_RANGE, weightUnit)[0]}
                  max={rangeIn(SET_WEIGHT_RANGE, weightUnit)[1]}
                  ariaLabel={
                    baseWeight == null
                      ? t('setRow.weight', {
                          n: index + 1,
                          unit: WEIGHT_UNIT_LABEL[weightUnit],
                        })
                      : t('setRow.addedWeight', {
                          n: index + 1,
                          unit: WEIGHT_UNIT_LABEL[weightUnit],
                        })
                  }
                  onCommit={(v) => onValue('weight', toKgOrNull(v, weightUnit))}
                />
              </span>
            </>
          )}
        </>
      )}

      {/* 列を空けたままにする。落とすと残りの欄が寄って、幅が変わって見える */}
      {showIndex &&
        (onRemove ? (
          <button
            type="button"
            className={s.rowBtn}
            aria-label={t('setRow.remove', { n: index + 1 })}
            onClick={onRemove}
          >
            ×
          </button>
        ) : (
          <span />
        ))}
    </div>
  );
}
