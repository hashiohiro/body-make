import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCard } from '../components/training/CheckCard';
import { ChipGroup } from '../components/ChipGroup';
import { ExerciseRipple } from '../components/training/ExerciseRipple';
import { TrainingAside } from '../components/training/TrainingAside';
import type { PresetOption } from '../components/training/PresetCard';
import { ExerciseCard } from '../components/training/ExerciseCard';
import { ExerciseSetEditor } from '../components/training/ExerciseSetEditor';
import { ExerciseDetailDialog } from '../components/training/ExerciseDetailDialog';
import { ExercisePicker } from '../components/training/ExercisePicker';
import { GoalEditor } from '../components/training/GoalEditor';
import { Modal } from '../components/Modal';
import type { WeightUnit } from '../lib/weight';
import { defaultSetsFor } from '../lib/preset';
import { useConfirm } from '../components/ConfirmDialog';
import { OrderList } from '../components/training/OrderList';
import { byName, exerciseName, groupsOf, isCardio } from '../lib/exerciseCatalog';
import { addDays, startOfWeek, weekdayIndex } from '../lib/date';
import {
  buildBodyWeightLookup,
  cardioWeek,
  personalBest,
  pickTopWeight,
  pickVolume,
  previousPoint,
} from '../lib/training';
import { emptyGroupSets } from '../lib/check';
import { useT } from '../lib/i18n';
import { isCardioSet } from '../types';
import type { Exercise, Preset, SessionSet, Weekday } from '../types';
import type { BodyData } from '../hooks/useBodyData';
import { CardHeader } from '../components/CardHeader';
import ui from '../styles/ui.module.scss';
import s from '../components/training/training.module.scss';

interface Props {
  body: BodyData;
  /** 記録する日。ヘッダの日付ナビが持つ */
  date: string;
}

/**
 * 記録の無い週ぶん。**毎回作らない**——描くたびに新しい物になると、
 * 中身が同じでも下の面が作り直しになる。
 */
const NO_WEEK = emptyGroupSets();

/** その行に何か打ってあるか。器で見るものが違う */
function hasValue(set: SessionSet): boolean {
  return isCardioSet(set)
    ? set.meters != null || set.seconds != null
    : set.weight != null || set.reps != null;
}

export function TrainingView({ body, date }: Props) {
  const {
    data,
    daily,
    sessions,
    weeklySets,
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
    updatePreset,
    upsertExercise,
  } = body;

  const dayEntries = data.workouts[date] ?? [];
  const byId = useMemo(() => new Map(data.exercises.map((e) => [e.id, e])), [data.exercises]);

  const active = useMemo(
    () => [...data.exercises].sort((a, b) => a.order - b.order),
    [data.exercises],
  );

  const session = useMemo(() => sessions.find((x) => x.date === date) ?? null, [sessions, date]);
  /*
   * 波及行が読む「その週」。**今日の週ではなく、打っている日の週。**
   *
   * `TrainingStats.thisWeekSetsByGroup` は今週ぶんなので、先週の記録を直している
   * あいだ、今週の数字が動いたように見える。週は日付から引く。
   */
  const weekOfDate = useMemo(
    () => weeklySets.find((w) => w.start === startOfWeek(date)) ?? null,
    [weeklySets, date],
  );
  const cardioOfWeek = useMemo(() => cardioWeek(sessions, startOfWeek(date)), [sessions, date]);
  /*
   * その日に使える体重。自重種目の「足される側」を出すのに要る。
   * 集計側と**同じ引き当て**（その日 → その日の移動平均 → 直近過去）を使う。
   * 別々に書くと、画面に出る内訳と計算された挙上量が食い違う。
   */
  const bodyWeightAt = useMemo(() => buildBodyWeightLookup(daily), [daily]);

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
  /*
   * 重量を打つときの単位。**この画面を開いているあいだだけ保つ。**
   *
   * 遠征先のジムにポンド表記の器具があったとき、その場で切り替えて打てるようにする。
   * 種目を移っても選んだままにするので、状態は種目ごとの面ではなくここが持つ。
   *
   * **設定（`inputWeightUnit`）は書き換えない。**その場限りの都合なので、
   * 閉じて開き直せば普段の単位に戻る。設定そのものを変えたときは、
   * こちらもその値に追従する（下の effect）。
   */
  const [inputUnit, setInputUnit] = useState<WeightUnit>(data.settings.inputWeightUnit);
  useEffect(() => setInputUnit(data.settings.inputWeightUnit), [data.settings.inputWeightUnit]);
  const t = useT();
  const [ask, confirmDialog] = useConfirm();
  /** 種目 ID から、いまの言語で読む名前。消えた種目は空（確認の見出しに出す相手がいない） */
  const nameOf = (id: string) => {
    const found = byId.get(id);
    return found ? exerciseName(t, found) : '';
  };

  const usedIds = new Set(dayEntries.map((e) => e.exerciseId));
  const goalExercise = goalId ? (byId.get(goalId) ?? null) : null;
  const editExercise = editId ? (byId.get(editId) ?? null) : null;
  const editEntry = editId ? (dayEntries.find((e) => e.exerciseId === editId) ?? null) : null;

  // 名前を付けて残した組み合わせ。中身の部位は、そのつどマイ種目から引き直す
  const option = useCallback(
    (preset: Preset) => ({
      ...preset,
      groupsLabel: groupsOf(t, data.exercises, preset.exerciseIds),
    }),
    [data.exercises],
  );

  /**
   * 開いている日の曜日を持つプリセット。**その日のぶんだけ、1 つ。**
   *
   * 別の曜日のものは先に出さない——木曜の組み立てを月曜に呼び出す場面より、
   * 一覧が 7 日ぶん伸びる害のほうが大きい。
   *
   * 出すだけで、判定はしない。押さなければ何も起きず、押さなかった日に印も残らない
   * ——予定行を並べる面は撤回してある（`docs/design-training.md` §11-3）。
   */
  const todayMenu = useMemo(() => {
    const day = weekdayIndex(date) as Weekday;
    const found = data.presets.find((p) => p.weekdays.includes(day) && !p.hidden);
    return found ? option(found) : null;
  }, [data.presets, date, option]);

  /**
   * 持っている組み合わせ。**伏せたものは出さない。**
   *
   * 外れるのは呼び出しと、帯の「保存済み／未保存」の突き合わせ。
   * 伏せたものと突き合わせると、呼び出せないのに「保存済み」と出て行き止まりになる。
   * **名前の重複だけは伏せたものとも見る**（`PresetBlock`）——戻したときにぶつかるため。
   */
  const presets = useMemo(
    // 並びは名前順。作った順は使う側から見ると意味を持たない（マイ種目と同じ作法）
    () => byName(t, data.presets.filter((p) => !p.hidden).map(option)),
    [t, data.presets, option],
  );

  /**
   * ＋ から出す一覧ぶん。**今日のぶんは見出しの下に別に出すので、ここでは繰り返さない。**
   * 帯のカードのほうは見出しで分けないので、あちらには全部渡す
   * ——除いた配列を両方に渡していて、カードから今日のものが消えていた。
   */
  const pickerPresets = useMemo(
    () => presets.filter((p) => p.id !== todayMenu?.id),
    [presets, todayMenu],
  );

  const currentIds = dayEntries.map((e) => e.exerciseId);

  /**
   * その日を、どのプリセットから作ったか。**覚えておくのは画面のあいだだけ。**
   *
   * 呼び出したあとに種目を足し引きして保存するとき、**元のプリセットを
   * 上書きする**ために要る（名前で突き合わせると、名前を変えた瞬間に
   * 別物が増える）。記録には持たせない——どの日に何を使ったかは実績ではないし、
   * 保存物を増やさずに済む。日を変えれば忘れる。
   */
  const [appliedAt, setAppliedAt] = useState<{ date: string; id: string } | null>(null);

  /**
   * プリセットの中身をまとめてその日に入れる。**＋ からも帯からも同じ道を通す。**
   * 写して 2 つ持つと、既定のセットの扱いや「どこから作った日か」が片方だけ古くなる。
   */
  const applyPreset = useCallback(
    (preset: PresetOption) => {
      // どこから作った日かを覚える。あとで上書きするときの相手になる
      setAppliedAt({ date, id: preset.id });
      // 既定のセットを持つ種目は、その本数ぶん空行を出す（値は空のまま）
      addDayExercises(
        date,
        preset.exerciseIds,
        Object.fromEntries(Object.entries(preset.defaults).map(([id, sets]) => [id, sets.length])),
      );
    },
    [date, setAppliedAt, addDayExercises],
  );

  const applied =
    appliedAt?.date === date ? (presets.find((p) => p.id === appliedAt.id) ?? null) : null;

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
    if (entry?.sets.some(hasValue)) {
      ask({
        title: t('training.removeTitle'),
        subject: nameOf(id),
        note: t('training.removeNote'),
        confirmLabel: t('training.removeConfirm'),
        destructive: true,
        onConfirm: () => removeDayExercise(date, id),
      });
      return;
    }
    removeDayExercise(date, id);
  };

  /**
   * カタログから、その日に種目を足す。
   *
   * `keep` は「マイ種目にも残すか」。**聞くのはピッカーの仕事**で、ここは答えを書くだけ。
   * 残さないと答えても、種目そのものは `adhoc` として持つ。その日の記録が種目を
   * 参照しているので、実体が無いと記録のほうが行き先を失う（sanitize が黙って落とす）。
   * `adhoc` はカタログにまた並ぶので、次に選べばマイ種目に入る。
   * **伏せた種目（hidden）とは別の状態。**マイ種目の非表示欄には並ばない。
   */
  const addFromCatalog = (exercise: Exercise, keep: boolean) => {
    // 残さないと答えたものは adhoc。伏せたのではなく、そもそも入れていない状態
    addExercises([keep ? exercise : { ...exercise, shelf: 'adhoc' as const }]);
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
      const bout = exercise != null && isCardio(exercise.group);
      ask({
        title: bout
          ? t('training.deleteBoutTitle', { n: index + 1 })
          : t('training.deleteSetTitle', { n: index + 1 }),
        subject: exercise ? exerciseName(t, exercise) : undefined,
        note: t('training.deleteNote'),
        confirmLabel: bout
          ? t('training.deleteBout', { n: index + 1 })
          : t('setRow.remove', { n: index + 1 }),
        destructive: true,
        onConfirm: () => removeSet(date, id, index),
      });
      return;
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
      {moving == null && (
        <TrainingAside
          date={date}
          history={checkHistory}
          presets={presets}
          currentIds={currentIds}
          currentName={
            currentIds.length > 0
              ? t('training.dayName', { groups: groupsOf(t, data.exercises, currentIds) })
              : ''
          }
          applied={applied}
          todayMenu={todayMenu}
          onSave={savePreset}
          onUpdate={updatePreset}
          onApplyPreset={applyPreset}
        />
      )}

      {/*
        レビューは**いま組んだものへの指摘**なので、種目カードのすぐ上に置く。
        警告があるときだけ出るので、無い日は高さを取らない。
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

      {/*
        並べ替え中は、カードの代わりにその日の種目だけを一覧で出す。
        カードは縦に長いので、そのまま置き場所を探させると画面の外まで探しに行かせることになる。
        操作はプリセットの中身と同じ（掴む → 置き場所をタップ）。
      */}
      {moving != null && (
        <section className={ui.card}>
          <CardHeader
            title={t('training.reorder')}
            hint={<>{t('training.exercises', { n: dayEntries.length })}</>}
          />

          <OrderList
            entries={dayEntries.map((entry) => ({
              id: entry.exerciseId,
              name: byId.get(entry.exerciseId)?.name ?? '',
              group: byId.get(entry.exerciseId)?.group ?? null,
            }))}
            movingId={moving}
            label={t('training.reorderLabel')}
            onGrab={setMoving}
            onCancel={() => setMoving(null)}
            onReorder={(ids) => {
              reorderDayExercises(date, ids);
              setMoving(null);
            }}
          />

          <p className={ui.note}>{t('training.reorderNote')}</p>
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
              // 換算後ではなく、バーに載せた数字（目標やグラフの「最大重量」と同じ取り方）
              bestWeight={personalBest(
                sessions,
                entry.exerciseId,
                addDays(date, -1),
                pickTopWeight,
              )}
              onOpenDetail={() => setDetailId(entry.exerciseId)}
              onOpenGoal={() => setGoalId(entry.exerciseId)}
              onEdit={() => setEditId(entry.exerciseId)}
              onRemove={() => removeExercise(entry.exerciseId)}
              // 1 種目しか無い日に、動かしようのない操作を出さない
              onMove={dayEntries.length > 1 ? () => setMoving(entry.exerciseId) : undefined}
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
      <div className={s.fabSpace} aria-hidden="true" />

      <ExercisePicker
        exercises={active}
        usedIds={usedIds}
        presets={pickerPresets}
        todayMenu={todayMenu}
        onToggle={toggle}
        onAddPreset={applyPreset}
        onAddFromCatalog={addFromCatalog}
      />

      {/*
        セットを打つ面。カードから開く。
        1 種目に集中して打てるようにするのと、カードの高さをそろえるため

        **高さは決め打ち（`tall`）。**中身なりにすると、セットを足す・消すたび、
        帯で別の種目へ移るたび、波及行が出入りするたびにシートの縁が上下して、
        打っている欄が指の下から逃げる。一覧の面と同じ理由で、件数に高さを預けない。
      */}
      {editExercise && editEntry && (
        <Modal open title={exerciseName(t, editExercise)} tall onClose={() => setEditId(null)}>
          {/*
            その日の種目。**閉じずに移れるようにする**（`docs/design-ripple.md` §4）。
            1 種目打つたびに 閉じる → スクロール → 次のカードを探す → 開く を
            払っていた。帯はその往復だけを消すもので、順序は持たない
            ——並びは記録そのもの（やった順）で、押さなかった種目に印も残らない。

            **1 種目の日には出さない。**移る先が無い（行き止まりを作らない）。

            `＋` は置かない。開くのは検索とカタログを持つ面で、この面に重なる。
            行き来は毎セット起きるが、足すのはその日 1 回あるかどうか。
          */}
          {dayEntries.length > 1 && (
            <ChipGroup
              options={dayEntries.map((entry) => ({
                id: entry.exerciseId,
                label: nameOf(entry.exerciseId),
              }))}
              value={editExercise.id}
              onChange={setEditId}
              label={t('training.pickExercise')}
              // 種目が増えると端が切れる。開いている種目へ寄せ、まだ続くことを端に出す
              scrollable
            />
          )}

          <ExerciseSetEditor
            exercise={editExercise}
            entry={editEntry}
            point={session?.exercises.find((p) => p.exerciseId === editExercise.id) ?? null}
            previous={previousPoint(sessions, editExercise.id, date)}
            // カードと同じ通算の最高。打ちながら「最高に届くか」を見られるようにする
            best={personalBest(sessions, editExercise.id, addDays(date, -1), pickVolume)}
            bestWeight={personalBest(sessions, editExercise.id, addDays(date, -1), pickTopWeight)}
            weightUnit={inputUnit}
            onWeightUnitChange={setInputUnit}
            // 既定のセット。**薄く出すだけ**で、打つまで記録には入らない
            defaultSets={defaultSetsFor(data.presets, editExercise.id, date)}
            /*
              その一打が、この種目の外に動かしたもの（`docs/design-ripple.md` §2）。
              組み立てるのはここ——週の配分も部位の回復も、入力の面は持っていない。
            */
            ripple={
              <ExerciseRipple
                exercise={editExercise}
                date={date}
                point={session?.exercises.find((p) => p.exerciseId === editExercise.id) ?? null}
                previous={previousPoint(sessions, editExercise.id, date)}
                weekSets={weekOfDate?.setsByGroup ?? NO_WEEK}
                weekVolume={weekOfDate?.volumeByGroup ?? NO_WEEK}
                groupGoals={data.groupGoals}
                // 回復と同じ数え方を借りる。ここで数え直すと回復カードと食い違う
                todayGroupSets={checkHistory.groupSets.get(date) ?? null}
                cardio={cardioOfWeek}
              />
            }
            // 自重種目の「足される側」。その日以前の直近の体重を引く
            bodyWeight={bodyWeightAt(date)}
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
          />
        </Modal>
      )}

      {goalExercise && (
        <Modal
          open
          title={t('exercise.goalOf', { name: exerciseName(t, goalExercise) })}
          onClose={() => setGoalId(null)}
        >
          <GoalEditor exercise={goalExercise} sessions={sessions} onUpdate={upsertExercise} />
        </Modal>
      )}

      {confirmDialog}

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
