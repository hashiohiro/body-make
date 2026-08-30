import { useMemo, useState } from 'react';
import { CheckCard } from '../components/training/CheckCard';
import { RecoveryCard } from '../components/training/RecoveryCard';
import { ExerciseCard } from '../components/training/ExerciseCard';
import { ExerciseDetailDialog } from '../components/training/ExerciseDetailDialog';
import { ExercisePicker } from '../components/training/ExercisePicker';
import { GoalEditor } from '../components/training/GoalEditor';
import { Modal } from '../components/Modal';
import { OrderList } from '../components/training/OrderList';
import { PresetCard } from '../components/training/PresetCard';
import { groupsOf } from '../lib/exerciseCatalog';
import { addDays } from '../lib/date';
import { personalBest, pickVolume, previousPoint } from '../lib/training';
import type { BodyData } from '../hooks/useBodyData';
import ui from '../styles/ui.module.scss';

interface Props {
  body: BodyData;
  /** 記録する日。ヘッダの日付ナビが持つ */
  date: string;
}

export function TrainingView({ body, date }: Props) {
  const {
    data,
    sessions,
    checkHistory,
    suppressWarning,
    addDayExercise,
    removeDayExercise,
    reorderDayExercises,
    addSet,
    removeSet,
    setSetValue,
    copySets,
    addDayExercises,
    addExercises,
    savePreset,
    removePreset,
    upsertExercise,
  } = body;

  const dayEntries = data.workouts[date] ?? [];
  const byId = useMemo(() => new Map(data.exercises.map((e) => [e.id, e])), [data.exercises]);

  const active = useMemo(
    () => [...data.exercises].sort((a, b) => a.order - b.order),
    [data.exercises],
  );

  const session = useMemo(() => sessions.find((x) => x.date === date) ?? null, [sessions, date]);

  const [detailId, setDetailId] = useState<string | null>(null);
  /** 目標を開いている種目。記録しながらでも決め直せるように */
  const [goalId, setGoalId] = useState<string | null>(null);
  /** 並べ替えで掴んでいる種目。カードは大きいので、掴んでいる間だけ一覧に畳む */
  const [moving, setMoving] = useState<string | null>(null);

  const usedIds = new Set(dayEntries.map((e) => e.exerciseId));
  const goalExercise = goalId ? (byId.get(goalId) ?? null) : null;

  // 名前を付けて残した組み合わせ。中身の部位は、そのつどマイ種目から引き直す
  const presets = useMemo(
    () =>
      data.presets.map((preset) => ({
        ...preset,
        groups: groupsOf(data.exercises, preset.exerciseIds),
      })),
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
        currentName={currentIds.length > 0 ? `${groupsOf(data.exercises, currentIds)}の日` : ''}
        onAdd={(ids) => addDayExercises(date, ids)}
        onSave={savePreset}
        onRemove={removePreset}
      />

      {/*
        レビューが先、回復が後。
        レビューは**いま組んだものへの指摘**なので、種目カードのすぐ上にあるのが素直。
        回復は入口 1 行だけなので、下に置いても埋もれない。

        回復は種目が 1 つも無い日でも出す
        （何も置いていないときこそ「どこが回復しているか」を知りたい）。
      */}
      {moving == null && (
        <CheckCard
          date={date}
          entries={dayEntries}
          exercises={data.exercises}
          history={checkHistory}
          checks={data.checks}
          suppressed={data.suppressed}
          onSuppress={suppressWarning}
        />
      )}

      {moving == null && <RecoveryCard date={date} history={checkHistory} />}

      {/*
        並べ替え中は、カードの代わりにその日の種目だけを一覧で出す。
        カードは縦に長いので、そのまま置き場所を探させると画面の外まで探しに行かせることになる。
        操作はプリセットの中身と同じ（掴む → 置き場所をタップ）。
      */}
      {moving != null && (
        <section className={ui.card}>
          <header className={ui.cardHeader}>
            <h2 className={ui.cardTitle}>並べ替え</h2>
            <span className={ui.hint}>{dayEntries.length}種目</span>
          </header>

          <OrderList
            entries={dayEntries.map((entry) => ({
              id: entry.exerciseId,
              name: byId.get(entry.exerciseId)?.name ?? '',
              group: byId.get(entry.exerciseId)?.group ?? null,
            }))}
            movingId={moving}
            label="この日"
            onGrab={setMoving}
            onCancel={() => setMoving(null)}
            onReorder={(ids) => {
              reorderDayExercises(date, ids);
              setMoving(null);
            }}
          />

          <p className={ui.note}>置き場所を選ぶと、カードの並びが変わります。記録は動きません。</p>
        </section>
      )}

      {moving == null &&
        dayEntries.map((entry) => {
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
              // 1 種目しか無い日に、動かしようのない操作を出さない
              onMove={dayEntries.length > 1 ? () => setMoving(entry.exerciseId) : undefined}
              onOpenDetail={() => setDetailId(entry.exerciseId)}
              onOpenGoal={() => setGoalId(entry.exerciseId)}
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

      {goalExercise && (
        <Modal open title={`${goalExercise.name}の目標`} onClose={() => setGoalId(null)}>
          <GoalEditor exercise={goalExercise} sessions={sessions} onUpdate={upsertExercise} />
        </Modal>
      )}

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
