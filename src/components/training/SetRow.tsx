import { useNumericField } from '../../hooks/useNumericField';
import {
  DISTANCE_M_RANGE,
  DURATION_SEC_RANGE,
  SET_WEIGHT_RANGE,
  repRangeOf,
} from '../../lib/storage';
import type { CardioSet, RepUnit, SessionSet, SetPoint, WorkSet } from '../../types';
import type { SetField } from '../../hooks/useBodyData';
import s from './training.module.scss';

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
 * ± ボタンは置かない。
 * 1 行に重量と回数を並べる都合上、ボタンを付けると数値の表示幅が削られて読みにくくなる。
 * 打鍵途中を潰さない確定ロジックは useNumericField に集約されている。
 */
function NumberCell({ value, fallback, min, max, integer, ariaLabel, onCommit }: NumberCellProps) {
  const field = useNumericField(value, min, max, onCommit);

  return (
    <input
      className={s.input}
      type="number"
      inputMode={integer ? 'numeric' : 'decimal'}
      step={integer ? 1 : 'any'}
      min={min}
      max={max}
      placeholder={fallback == null ? '—' : String(fallback)}
      aria-label={ariaLabel}
      value={field.text}
      onChange={(e) => field.handleChange(e.target.value)}
      onBlur={field.handleBlur}
    />
  );
}

/** 1 つ目の欄が何を指すか。読み上げとテストがこの名前で引く */
const FIELD_NOUNS: Record<RepUnit, string> = {
  reps: '回数',
  seconds: '秒数',
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
  fallbackWeight: number | null;
  fallbackReps: number | null;
  onValue: (field: SetField, value: number | null) => void;
  /** 行を足せない種目では、連番も削除も出さない（1 回で完結する種目） */
  rowClass: string;
  onRemove: (() => void) | undefined;
}

export function SetRow({
  index,
  set,
  point,
  repUnit,
  cardio,
  showWeight,
  fallbackWeight,
  fallbackReps,
  onValue,
  onRemove,
  rowClass,
}: Props) {
  const role = point?.role ?? 'work';
  // 器はこの行の描き方そのものを変える。種目が決めるので set 側の形は見ない
  const bout = set as CardioSet;
  const work = set as WorkSet;

  return (
    <div className={`${s.setRow} ${rowClass}`} data-set-row={index}>
      {/* TOP は「いちばん重かったセット」の印。有酸素にその概念はない */}
      {onRemove && (
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
            ariaLabel={`${index + 1}セット目の時間`}
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
            ariaLabel={`${index + 1}セット目の距離`}
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
            ariaLabel={`${index + 1}セット目の${FIELD_NOUNS[repUnit]}`}
            onCommit={(v) => onValue('reps', v)}
          />

          {showWeight && (
            <>
              <span className={s.times} aria-hidden="true">
                ×
              </span>

              <NumberCell
                value={work.weight}
                fallback={fallbackWeight}
                min={SET_WEIGHT_RANGE[0]}
                max={SET_WEIGHT_RANGE[1]}
                ariaLabel={`${index + 1}セット目の重量`}
                onCommit={(v) => onValue('weight', v)}
              />
            </>
          )}
        </>
      )}

      {onRemove && (
        <button
          type="button"
          className={s.rowBtn}
          aria-label={`${index + 1}セット目を削除`}
          onClick={onRemove}
        >
          ×
        </button>
      )}
    </div>
  );
}
