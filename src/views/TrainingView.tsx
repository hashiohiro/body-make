import { useMemo, useState } from 'react';
import { ExerciseCard } from '../components/training/ExerciseCard';
import { ExerciseDetailDialog } from '../components/training/ExerciseDetailDialog';
import { ExercisePicker } from '../components/training/ExercisePicker';
import { PresetCard } from '../components/training/PresetCard';
import { GROUP_LABELS, GROUP_ORDER } from '../lib/exerciseCatalog';
import { addDays } from '../lib/date';
import { personalBest, pickVolume, previousPoint } from '../lib/training';
import type { BodyData } from '../hooks/useBodyData';

interface Props {
  body: BodyData;
  /** 記録する日。ヘッダの日付ナビが持つ */
  date: string;
}

export function TrainingView({ body, date }: Props) {
  const {
    data,
    sessions,
    addDayExercise,
    removeDayExercise,
    addSet,
    removeSet,
    setSetValue,
    copySets,
    addDayExercises,
    addExercises,
    addPreset,
    removePreset,
  } = body;

  const dayEntries = data.workouts[date] ?? [];
  const byId = useMemo(() => new Map(data.exercises.map((e) => [e.id, e])), [data.exercises]);

  const active = useMemo(
    () => [...data.exercises].sort((a, b) => a.order - b.order),
    [data.exercises],
  );

  const session = useMemo(() => sessions.find((x) => x.date === date) ?? null, [sessions, date]);

  const [detailId, setDetailId] = useState<string | null>(null);

  const usedIds = new Set(dayEntries.map((e) => e.exerciseId));

  /** 種目 ID の並びから、やる部位の並び（表示順）を作る */
  const groupsOf = (ids: readonly string[]) => {
    const groups = new Set(ids.map((id) => byId.get(id)?.group).filter(Boolean));
    return GROUP_ORDER.filter((g) => groups.has(g))
      .map((g) => GROUP_LABELS[g])
      .join('・');
  };

  // 名前を付けて残した組み合わせ。中身の部位は、そのつど種目マスタから引き直す
  const presets = useMemo(
    () =>
      data.presets.map((preset) => ({
        ...preset,
        groups: groupsOf(preset.exerciseIds),
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data.presets, data.exercises],
  );

  const currentIds = dayEntries.map((e) => e.exerciseId);

  /**
   * その日に入れる／外すの切り替え。
   *
   * 同一種目は 1 日 1 エントリなので、押すたびに増えることはない。
   * 入力済みのセットがあるときだけ確認する（消えるものがあると伝える必要があるときだけ挟む）。
   */
  const toggle = (id: string) => {
    const entry = dayEntries.find((e) => e.exerciseId === id);
    if (!entry) {
      addDayExercise(date, id);
      return;
    }
    const hasValue = entry.sets.some((set) => set.weight != null || set.reps != null);
    const name = byId.get(id)?.name ?? '';
    if (hasValue && !confirm(`「${name}」をこの日から外します。\n入力したセットも消えます。`))
      return;
    removeDayExercise(date, id);
  };

  return (
    <>
      {/*
        よくやる組み合わせ。呼び出しと保存を同じカードでやる。
        ダイアログの中に畳むと「保存できること」に気づけない。
        置き場所は種目カードより上。献立を選ぶのは記録を始める前なので、最初に目に入る位置にする
      */}
      <PresetCard
        presets={presets}
        currentIds={currentIds}
        currentName={currentIds.length > 0 ? `${groupsOf(currentIds)}の日` : ''}
        onAdd={(ids) => addDayExercises(date, ids)}
        onSave={addPreset}
        onRemove={removePreset}
      />

      {dayEntries.map((entry) => {
        const exercise = byId.get(entry.exerciseId);
        if (!exercise) return null;
        return (
          <ExerciseCard
            key={entry.exerciseId}
            exercise={exercise}
            entry={entry}
            point={session?.exercises.find((p) => p.exerciseId === entry.exerciseId) ?? null}
            previous={previousPoint(sessions, entry.exerciseId, date)}
            best={personalBest(sessions, entry.exerciseId, addDays(date, -1), pickVolume)}
            bestWeight={personalBest(
              sessions,
              entry.exerciseId,
              addDays(date, -1),
              // 換算後ではなく、バーに載せた数字。目標やグラフの「最大重量」と揃える
              (p) => p.top?.weight ?? null,
            )}
            onValue={(index, field, value) =>
              setSetValue(date, entry.exerciseId, index, field, value)
            }
            onAddSet={() => addSet(date, entry.exerciseId)}
            onRemoveSet={(index) => removeSet(date, entry.exerciseId, index)}
            onRemove={() => removeDayExercise(date, entry.exerciseId)}
            onOpenDetail={() => setDetailId(entry.exerciseId)}
            onCopyPrevious={() => {
              const prev = previousPoint(sessions, entry.exerciseId, date);
              if (!prev) return;
              copySets(
                date,
                entry.exerciseId,
                prev.point.sets.map((set) => ({ weight: set.weight, reps: set.reps })),
              );
            }}
          />
        );
      })}

      {/*
        種目を足す入口。画面の中に置くとカードが積み上がるほど遠くなるので、右下に固定する。
        過去の日から写す動線もここに預ける。その日をどう始めるかの選択肢なので、同じ面にあるほうがいい
      */}
      <ExercisePicker
        exercises={active}
        usedIds={usedIds}
        onToggle={toggle}
        onAddExercises={addExercises}
      />

      <ExerciseDetailDialog
        open={detailId != null}
        onClose={() => setDetailId(null)}
        exercise={detailId == null ? null : (byId.get(detailId) ?? null)}
        sessions={sessions}
        // 記録画面は期間で絞らない。過去ぜんぶを見せる
        from=""
        date={date}
      />
    </>
  );
}
