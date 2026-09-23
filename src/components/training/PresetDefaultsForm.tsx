import { SetRow } from './SetRow';
import { Strong } from '../Strong';
import { exerciseName, isCardio } from '../../lib/exerciseCatalog';
import { useWeightUnit } from '../../hooks/useWeightUnit';
import type { Exercise, Preset, SessionSet } from '../../types';
import type { SetField } from '../../hooks/useBodyData';
import { Button } from '../Button';
import ui from '../../styles/ui.module.scss';
import s from './training.module.scss';
import { useT } from '../../lib/i18n';

interface Props {
  preset: Preset;
  exercises: readonly Exercise[];
  onUpdate: (preset: Preset) => void;
}

/** その種目の空行。器は種目が決める（記録側の `emptySetOf` と同じ考え方） */
function emptySet(exercise: Exercise): SessionSet {
  return isCardio(exercise.group) ? { meters: null, seconds: null } : { weight: null, reps: null };
}

/**
 * プリセットの既定のセット。**「いつも通りの組み立て」を書いておく場所。**
 *
 * ここに書いた値は**記録に入らない**。入れたときに入力欄へ薄く出るだけで、
 * 打つまでは空のまま（`Preset.defaults`）。自動で書き込むと
 * 「打っていない数字が記録になる」——`addDayExercises` が種目だけを入れて
 * 値を写さないのと同じ理由（設計 §1.3）。
 *
 * **持たないのが既定。**この面は破線の入口から開いたときだけ出る。
 */
export function PresetDefaultsForm({ preset, exercises, onUpdate }: Props) {
  const t = useT();
  /*
   * 単位は「読むときの単位」を使う。ここは打つ場所だが**定義を書く面**で、
   * 記録画面のような、その場で切り替えるトグルは置かない
   * （遠征先でその場の器具に合わせるための口で、書き置きには要らない）。
   */
  const weightUnit = useWeightUnit();
  const byId = new Map(exercises.map((e) => [e.id, e]));

  const setSets = (exerciseId: string, sets: SessionSet[]) =>
    onUpdate({ ...preset, defaults: { ...preset.defaults, [exerciseId]: sets } });

  const drop = (exerciseId: string) => {
    const { [exerciseId]: _removed, ...rest } = preset.defaults;
    onUpdate({ ...preset, defaults: rest });
  };

  return (
    <div>
      <p className={ui.note}>
        <Strong text={t('defaults.note')} values={[t('defaults.noteStrong')]} />
      </p>

      {preset.exerciseIds.map((id) => {
        const exercise = byId.get(id);
        if (!exercise) return null;
        const sets = preset.defaults[id] ?? [];
        const cardio = isCardio(exercise.group);
        // 秒で数える種目は挙上量に計上しないので、重量の欄も出さない（記録側と同じ）
        const showWeight = cardio || exercise.repUnit === 'reps';

        return (
          <div key={id} className={s.presetBlock}>
            <div className={s.prev}>
              <span>{exerciseName(t, exercise)}</span>
              {sets.length > 0 && (
                <Button tone="ghost" size="sub" onClick={() => drop(id)}>
                  {t('defaults.remove')}
                </Button>
              )}
            </div>

            {sets.length === 0 ? (
              <div className={ui.btnRow}>
                <button
                  type="button"
                  className={s.optionalEntry}
                  onClick={() => setSets(id, [emptySet(exercise)])}
                >
                  <span aria-hidden="true">＋ </span>
                  {t('defaults.add')}
                </button>
              </div>
            ) : (
              <>
                <div className={s.setHead} aria-hidden="true">
                  <span />
                  <span>
                    {cardio
                      ? t('set.duration')
                      : exercise.repUnit === 'reps'
                        ? t('set.reps')
                        : t('set.seconds')}
                  </span>
                  {showWeight && (
                    <>
                      <span />
                      <span>{cardio ? t('set.distance') : t('metric.maxWeight')}</span>
                    </>
                  )}
                  <span />
                </div>

                {sets.map((set, i) => (
                  <SetRow
                    key={i}
                    index={i}
                    set={set}
                    point={null}
                    repUnit={exercise.repUnit}
                    cardio={cardio}
                    showWeight={showWeight}
                    weightUnit={weightUnit}
                    // 自重種目の「足される側」は、その日の体重で決まる。書き置きには出せない
                    baseWeight={null}
                    fallbackWeight={null}
                    fallbackReps={null}
                    showIndex
                    rowClass=""
                    onValue={(field: SetField, value) =>
                      setSets(
                        id,
                        sets.map((x, j) => (j === i ? { ...x, [field]: value } : x)),
                      )
                    }
                    onRemove={() =>
                      setSets(
                        id,
                        sets.filter((_, j) => j !== i),
                      )
                    }
                  />
                ))}

                <button
                  type="button"
                  className={s.addSet}
                  onClick={() => setSets(id, [...sets, { ...sets[sets.length - 1]! }])}
                >
                  <span aria-hidden="true">＋ </span>
                  {t('set.addSet')}
                </button>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
