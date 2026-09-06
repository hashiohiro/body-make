import { useMemo, useState } from 'react';
import { CheckCard } from '../components/training/CheckCard';
import { TrainingAside } from '../components/training/TrainingAside';
import { ExerciseCard } from '../components/training/ExerciseCard';
import { ExerciseSetEditor } from '../components/training/ExerciseSetEditor';
import { ExerciseDetailDialog } from '../components/training/ExerciseDetailDialog';
import { ExercisePicker } from '../components/training/ExercisePicker';
import { GoalEditor } from '../components/training/GoalEditor';
import { Modal } from '../components/Modal';
import { OrderList } from '../components/training/OrderList';
import { groupsOf, isCardio } from '../lib/exerciseCatalog';
import { addDays } from '../lib/date';
import { personalBest, pickVolume, previousPoint } from '../lib/training';
import { isCardioSet } from '../types';
import type { Exercise, SessionSet } from '../types';
import type { BodyData } from '../hooks/useBodyData';
import ui from '../styles/ui.module.scss';
import s from '../components/training/training.module.scss';

interface Props {
  body: BodyData;
  /** 記録する日。ヘッダの日付ナビが持つ */
  date: string;
  /**
   * 読むだけ。**カレンダーから過去の日を開いたときに使う。**
   *
   * その日に何をしたかだけを出す。組むための面——プリセット・レビュー・回復・
   * 種目を足す——は出さない。それらは「これから決める」ための道具で、
   * 見に来た日には答える相手がいない。
   *
   * 推移（種目の詳細）だけは残す。読むための面なので。
   */
  readOnly?: boolean | undefined;
}

/** その行に何か打ってあるか。器で見るものが違う */
function hasValue(set: SessionSet): boolean {
  return isCardioSet(set)
    ? set.meters != null || set.seconds != null
    : set.weight != null || set.reps != null;
}

export function TrainingView({ body, date, readOnly }: Props) {
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
  /**
   * セットを打っている種目。**入力はカードではなくダイアログに置く。**
   *
   * カードに積んだままだと、種目が増えるほど、いま打つ種目に届くまでスクロールが要る。
   * 打つあいだは 1 種目に集中するので、面を分けたほうが入力欄も大きく取れる。
   */
  const [editId, setEditId] = useState<string | null>(null);

  const usedIds = new Set(dayEntries.map((e) => e.exerciseId));
  const goalExercise = goalId ? (byId.get(goalId) ?? null) : null;
  const editExercise = editId ? (byId.get(editId) ?? null) : null;
  const editEntry = editId ? (dayEntries.find((e) => e.exerciseId === editId) ?? null) : null;

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
      /*
       * 足しただけでは開かない。**ピッカーが開いたままなので、面が重なる。**
       * 何種目か続けて足すこともあるので、打ちはじめる種目はカードの「編集」で選ぶ。
       */
      addDayExercise(date, id);
      return;
    }
    removeExercise(id);
  };

  /**
   * その日から種目を外す。**入力済みなら確認する**（設計 §2.2）。
   *
   * ピッカーの ✓ を外すのも、カードの × も同じ操作なので、同じ確認を通す。
   * 片方だけ確認するのは、どちらを押したかで結果が変わるということになる。
   */
  const removeExercise = (id: string) => {
    const entry = dayEntries.find((e) => e.exerciseId === id);
    const name = byId.get(id)?.name ?? '';
    if (entry?.sets.some(hasValue)) {
      if (!confirm(`「${name}」を削除します。`)) return;
    }
    removeDayExercise(date, id);
  };

  /**
   * カタログから、その日に種目を足す。
   *
   * `keep` は「マイ種目にも残すか」。**聞くのはピッカーの仕事**で、ここは答えを書くだけ。
   * 残さないと答えても、種目そのものは非表示で持つ。その日の記録が種目を参照して
   * いるので、実体が無いと記録のほうが行き先を失う（sanitize が黙って落とす）。
   * 非表示の種目はカタログにまた並ぶので、次に選べば同じ問いに戻る。
   */
  const addFromCatalog = (exercise: Exercise, keep: boolean) => {
    addExercises([keep ? exercise : { ...exercise, hidden: true }]);
    addDayExercise(date, exercise.id);
  };

  /**
   * セット行を 1 本消す。**その行に値が入っていれば確認する。**
   *
   * 打ち直すために消すこともあるが、押し間違いで消えた値は戻せない。
   * 空の行は失うものが無いので、確認を挟まない（§2.2 の「消えるものがあるときだけ聞く」）。
   */
  const removeSetAt = (id: string, index: number) => {
    const entry = dayEntries.find((e) => e.exerciseId === id);
    const set = entry?.sets[index];
    const exercise = byId.get(id);
    if (set && hasValue(set)) {
      // 押した行のすぐ隣に出るので、どれを消すかは番号だけで足りる
      const unit = exercise && isCardio(exercise.group) ? '本' : 'セット';
      if (!confirm(`${index + 1}${unit}目を削除します。`)) return;
    }
    removeSet(date, id, index);
  };

  return (
    <>
      {/*
        よくやる組み合わせ。呼び出しと保存を同じカードでやる。
        ダイアログの中に畳むと「保存できること」に気づけない。
        置き場所は種目カードより上。献立を選ぶのは記録を始める前なので、最初に目に入る位置にする
      */}
      {/*
        補助（回復・プリセット）は 1 行の帯にまとめる。
        カードで積むと、種目カードに届くまでのスクロールがそのぶん伸びる。
        帯は入口であると同時に要約なので、開かずに読める範囲もある。
      */}
      {!readOnly && moving == null && (
        <TrainingAside
          date={date}
          history={checkHistory}
          presets={presets}
          currentIds={currentIds}
          currentName={currentIds.length > 0 ? `${groupsOf(data.exercises, currentIds)}の日` : ''}
          onAdd={(ids) => addDayExercises(date, ids)}
          onSave={savePreset}
          onRemove={removePreset}
        />
      )}

      {/*
        レビューは**いま組んだものへの指摘**なので、種目カードのすぐ上に置く。
        警告があるときだけ出るので、無い日は高さを取らない。
      */}
      {!readOnly && moving == null && (
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
              onOpenDetail={() => setDetailId(entry.exerciseId)}
              onOpenGoal={() => setGoalId(entry.exerciseId)}
              onEdit={() => setEditId(entry.exerciseId)}
              onRemove={() => removeExercise(entry.exerciseId)}
              // 1 種目しか無い日に、動かしようのない操作を出さない
              onMove={
                !readOnly && dayEntries.length > 1 ? () => setMoving(entry.exerciseId) : undefined
              }
              readOnly={readOnly}
            />
          );
        })}

      {/*
        種目を足す入口。画面の中に置くとカードが積み上がるほど遠くなるので、右下に固定する。
        過去の日から写す動線もここに預ける。その日をどう始めるかの選択肢なので、同じ面にあるほうがいい
      */}
      {/*
        ＋ボタンのぶんの余白。いちばん下まで送ったときに、最後のカードが
        ボタンの下に潜らないようにする。**この画面にだけ置く**——ボタンが無い画面で
        同じ余白を取ると、下に理由の無い空きができる。
      */}
      {!readOnly && <div className={s.fabSpace} aria-hidden="true" />}

      {!readOnly && (
        <ExercisePicker
          exercises={active}
          usedIds={usedIds}
          presets={presets}
          onToggle={toggle}
          onAddPreset={(ids) => addDayExercises(date, ids)}
          onAddFromCatalog={addFromCatalog}
        />
      )}

      {/*
        セットを打つ面。カードから開く。
        1 種目に集中して打てるようにするのと、カードの高さをそろえるため
      */}
      {editExercise && editEntry && (
        <Modal open title={editExercise.name} onClose={() => setEditId(null)}>
          <ExerciseSetEditor
            exercise={editExercise}
            entry={editEntry}
            point={session?.exercises.find((p) => p.exerciseId === editExercise.id) ?? null}
            previous={previousPoint(sessions, editExercise.id, date)}
            onValue={(index, field, value) =>
              setSetValue(date, editExercise.id, index, field, value)
            }
            onAddSet={() => addSet(date, editExercise.id)}
            onRemoveSet={(index) => removeSetAt(editExercise.id, index)}
            onCopyPrevious={() => {
              const prev = previousPoint(sessions, editExercise.id, date);
              if (!prev) return;
              copySets(
                date,
                editExercise.id,
                prev.point.sets.map((set) => ({ weight: set.weight, reps: set.reps })),
              );
            }}
            readOnly={readOnly}
          />
        </Modal>
      )}

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
