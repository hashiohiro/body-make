import { useCallback, useEffect, useMemo, useState } from 'react';
import { buildDaily, buildWeeks, computeProjection, computeStats, emptyDay } from '../lib/derive';
import { PRESET_NAME_MAX, emptyData, loadData, sanitizeData, saveData } from '../lib/storage';
import { buildSessions, computeTrainingStats, exerciseGoals } from '../lib/training';
import type { ImportPayload } from '../lib/io';
import type {
  AppData,
  Entries,
  Exercise,
  Measurement,
  MuscleGroup,
  Preset,
  SessionExercise,
  Settings,
  SlotId,
  WorkSet,
  Workouts,
} from '../types';

export type MeasurementField = keyof Measurement;
export type SetField = 'weight' | 'reps';

const EMPTY_SET: WorkSet = { weight: null, reps: null };

/**
 * 空の器を残さない。ただし落とすのは **いま触った種目** だけ。
 *
 * 以前はその日ぜんぶを掃いていて、値の入っていないセットを一括で消していた。
 * 追加した直後の種目は「空のセットが 1 行ある」状態なので、
 * どこか 1 つのセットを消しただけで、まだ打っていない種目まで巻き添えで消えていた。
 *
 * セットが 1 行でも残っていれば、中身が空でもそのまま残す。
 * 空欄は「まだ打っていない」であって「消してよい」ではない。
 */
function pruneEntry(workouts: Workouts, date: string, exerciseId: string): Workouts {
  const day = workouts[date];
  if (!day) return workouts;

  const entry = day.find((e) => e.exerciseId === exerciseId);
  if (!entry || entry.sets.length > 0) return workouts;

  const kept = day.filter((e) => e.exerciseId !== exerciseId);
  const next = { ...workouts };
  if (kept.length === 0) delete next[date];
  else next[date] = kept;
  return next;
}

function mapDayExercise(
  workouts: Workouts,
  date: string,
  exerciseId: string,
  fn: (entry: SessionExercise) => SessionExercise,
): Workouts {
  const day = workouts[date] ?? [];
  const found = day.some((e) => e.exerciseId === exerciseId);
  const nextDay = found
    ? day.map((e) => (e.exerciseId === exerciseId ? fn(e) : e))
    : [...day, fn({ exerciseId, sets: [] })];
  return { ...workouts, [date]: nextDay };
}

export interface BodyData {
  data: AppData;
  daily: ReturnType<typeof buildDaily>;
  weeks: ReturnType<typeof buildWeeks>;
  stats: ReturnType<typeof computeStats>;
  projection: ReturnType<typeof computeProjection>;
  sessions: ReturnType<typeof buildSessions>;
  trainingStats: ReturnType<typeof computeTrainingStats>;
  trainingGoals: ReturnType<typeof exerciseGoals>;

  setValue: (date: string, slot: SlotId, field: MeasurementField, value: number | null) => void;
  removeDay: (date: string) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  importData: (payload: ImportPayload, mode: 'merge' | 'replace') => void;

  /** 実績のみ削除（種目マスタと設定は残す） */
  clearRecords: () => void;
  /** すべて削除（設定だけ残す） */
  clearAll: () => void;

  addDayExercise: (date: string, exerciseId: string) => void;
  removeDayExercise: (date: string, exerciseId: string) => void;
  addSet: (date: string, exerciseId: string) => void;
  removeSet: (date: string, exerciseId: string, index: number) => void;
  setSetValue: (
    date: string,
    exerciseId: string,
    index: number,
    field: SetField,
    value: number | null,
  ) => void;
  copySets: (date: string, exerciseId: string, sets: readonly WorkSet[]) => void;
  /** 過去の日から種目だけをまとめて足す。すでにある種目は飛ばす */
  addDayExercises: (date: string, exerciseIds: readonly string[]) => void;

  setGroupGoal: (group: MuscleGroup, value: number | null) => void;
  /** いまの組み合わせに名前を付けて残す */
  addPreset: (name: string, exerciseIds: readonly string[]) => void;
  removePreset: (id: string) => void;
  upsertExercise: (exercise: Exercise) => void;
  addExercises: (exercises: readonly Exercise[]) => void;
  /** 種目とその記録をまとめて消す。参照だけ残すと次回読み込みでログが黙って落ちるため */
  removeExercise: (id: string) => void;
}

export function useBodyData(): BodyData {
  const [data, setData] = useState<AppData>(loadData);

  useEffect(() => {
    saveData(data);
  }, [data]);

  const daily = useMemo(() => buildDaily(data.entries), [data.entries]);
  const weeks = useMemo(() => buildWeeks(daily), [daily]);
  const stats = useMemo(
    () => computeStats(daily, weeks, data.settings),
    [daily, weeks, data.settings],
  );
  const projection = useMemo(
    () => computeProjection(daily, stats, data.settings),
    [daily, stats, data.settings],
  );
  // 自重換算に体重が要るので daily → sessions の順で導出する
  const sessions = useMemo(
    () => buildSessions(data.workouts, data.exercises, daily),
    [data.workouts, data.exercises, daily],
  );
  const trainingStats = useMemo(() => computeTrainingStats(sessions), [sessions]);
  const trainingGoals = useMemo(
    () => exerciseGoals(sessions, data.exercises),
    [sessions, data.exercises],
  );

  const setValue = useCallback(
    (date: string, slot: SlotId, field: MeasurementField, value: number | null) => {
      setData((prev) => {
        const current = prev.entries[date] ?? emptyDay();
        const next: AppData = {
          ...prev,
          entries: {
            ...prev.entries,
            [date]: { ...current, [slot]: { ...current[slot], [field]: value } },
          },
        };
        // 4 項目すべて空になった日はキーごと落とす（欠測日と未記録日を同じ扱いにする）
        const day = next.entries[date]!;
        const blank =
          day.am.weight == null &&
          day.am.bodyFat == null &&
          day.pm.weight == null &&
          day.pm.bodyFat == null;
        if (blank) {
          const { [date]: _removed, ...rest } = next.entries;
          next.entries = rest;
        }
        return next;
      });
    },
    [],
  );

  const removeDay = useCallback((date: string) => {
    setData((prev) => {
      const { [date]: _removed, ...rest } = prev.entries;
      return { ...prev, entries: rest };
    });
  }, []);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setData((prev) => ({ ...prev, settings: { ...prev.settings, ...patch } }));
  }, []);

  /**
   * インポートは最後に sanitizeData を通す。
   * 種目とログを別々にマージすると、片方だけ入って参照先のない workouts が残りうるため。
   */
  const importData = useCallback((payload: ImportPayload, mode: 'merge' | 'replace') => {
    setData((prev) => {
      const entries: Entries =
        mode === 'replace' ? payload.entries : { ...prev.entries, ...payload.entries };

      const exercises =
        payload.exercises == null
          ? prev.exercises
          : mode === 'replace'
            ? payload.exercises
            : [
                ...prev.exercises,
                ...payload.exercises.filter((e) => !prev.exercises.some((p) => p.id === e.id)),
              ];

      const workouts =
        payload.workouts == null
          ? prev.workouts
          : mode === 'replace'
            ? payload.workouts
            : { ...prev.workouts, ...payload.workouts };

      return sanitizeData({
        version: 2,
        settings: payload.settings ?? prev.settings,
        entries,
        exercises,
        workouts,
      });
    });
  }, []);

  const clearRecords = useCallback(() => {
    setData((prev) => ({ ...prev, entries: {}, workouts: {} }));
  }, []);

  const clearAll = useCallback(() => {
    setData((prev) => ({ ...emptyData(), settings: prev.settings }));
  }, []);

  /* ---- 筋トレのログ ---- */

  const addDayExercise = useCallback((date: string, exerciseId: string) => {
    setData((prev) => {
      // 同一種目は 1 日 1 エントリ。すでにあれば何もしない（画面側で既存カードへ移動する）
      if ((prev.workouts[date] ?? []).some((e) => e.exerciseId === exerciseId)) return prev;
      const day = prev.workouts[date] ?? [];
      return {
        ...prev,
        workouts: { ...prev.workouts, [date]: [...day, { exerciseId, sets: [{ ...EMPTY_SET }] }] },
      };
    });
  }, []);

  const removeDayExercise = useCallback((date: string, exerciseId: string) => {
    setData((prev) => {
      const day = prev.workouts[date];
      if (!day) return prev;
      const kept = day.filter((e) => e.exerciseId !== exerciseId);
      const workouts = { ...prev.workouts };
      if (kept.length === 0) delete workouts[date];
      else workouts[date] = kept;
      return { ...prev, workouts };
    });
  }, []);

  const addSet = useCallback((date: string, exerciseId: string) => {
    setData((prev) => ({
      ...prev,
      workouts: mapDayExercise(prev.workouts, date, exerciseId, (e) => ({
        ...e,
        // 直前のセットを複製する。同じ重量で続けるのが普通なので、入力は差分だけで済む
        sets: [...e.sets, e.sets.length > 0 ? { ...e.sets[e.sets.length - 1]! } : { ...EMPTY_SET }],
      })),
    }));
  }, []);

  const removeSet = useCallback((date: string, exerciseId: string, index: number) => {
    setData((prev) => {
      const workouts = mapDayExercise(prev.workouts, date, exerciseId, (e) => ({
        ...e,
        sets: e.sets.filter((_, i) => i !== index),
      }));
      return { ...prev, workouts: pruneEntry(workouts, date, exerciseId) };
    });
  }, []);

  const setSetValue = useCallback(
    (date: string, exerciseId: string, index: number, field: SetField, value: number | null) => {
      setData((prev) => ({
        ...prev,
        workouts: mapDayExercise(prev.workouts, date, exerciseId, (e) => ({
          ...e,
          sets: e.sets.map((s, i) => (i === index ? { ...s, [field]: value } : s)),
        })),
      }));
    },
    [],
  );

  const copySets = useCallback((date: string, exerciseId: string, sets: readonly WorkSet[]) => {
    setData((prev) => ({
      ...prev,
      workouts: mapDayExercise(prev.workouts, date, exerciseId, (e) => ({
        ...e,
        sets: sets.map((s) => ({ weight: s.weight, reps: s.reps })),
      })),
    }));
  }, []);

  /**
   * 過去の日の献立を、その日に写す。
   *
   * 入るのは **種目だけ** で、重量とレップは空のまま。
   * 値まで写すと、打っていない数字が記録になる（設計 §1.3）。
   * 値の複製は種目カードの「前回の構成で始める」が持っていて、そちらは 1 種目ぶんなので
   * 見比べてから入れられる。
   *
   * すでにその日にある種目は飛ばす。同一種目は 1 日 1 エントリ。
   */
  const addDayExercises = useCallback((date: string, exerciseIds: readonly string[]) => {
    setData((prev) => {
      const day = prev.workouts[date] ?? [];
      const known = new Set(day.map((e) => e.exerciseId));
      const added = exerciseIds
        .filter((id) => !known.has(id))
        .map((exerciseId) => ({ exerciseId, sets: [{ ...EMPTY_SET }] }));
      if (added.length === 0) return prev;
      return { ...prev, workouts: { ...prev.workouts, [date]: [...day, ...added] } };
    });
  }, []);

  /* ---- 種目マスタ ---- */

  /**
   * 組み合わせに名前を付けて残す。持つのは種目だけで、重量もレップも持たない（types.ts の Preset）。
   * 同じ中身でも別の名前で残せる（呼び方は人それぞれなので、重複は止めない）。
   */
  const addPreset = useCallback((name: string, exerciseIds: readonly string[]) => {
    const trimmed = name.trim().slice(0, PRESET_NAME_MAX);
    const ids = [...new Set(exerciseIds)];
    if (!trimmed || ids.length === 0) return;
    setData((prev) => {
      const preset: Preset = { id: crypto.randomUUID(), name: trimmed, exerciseIds: ids };
      return { ...prev, presets: [...prev.presets, preset] };
    });
  }, []);

  const removePreset = useCallback((id: string) => {
    setData((prev) => ({ ...prev, presets: prev.presets.filter((p) => p.id !== id) }));
  }, []);

  const setGroupGoal = useCallback((group: MuscleGroup, value: number | null) => {
    setData((prev) => ({ ...prev, groupGoals: { ...prev.groupGoals, [group]: value } }));
  }, []);

  const upsertExercise = useCallback((exercise: Exercise) => {
    setData((prev) => {
      const exists = prev.exercises.some((e) => e.id === exercise.id);
      return {
        ...prev,
        exercises: exists
          ? prev.exercises.map((e) => (e.id === exercise.id ? exercise : e))
          : [...prev.exercises, { ...exercise, order: prev.exercises.length }],
      };
    });
  }, []);

  const addExercises = useCallback((exercises: readonly Exercise[]) => {
    setData((prev) => {
      const known = new Set(prev.exercises.map((e) => e.id));
      const added = exercises
        .filter((e) => !known.has(e.id))
        .map((e, i) => ({ ...e, order: prev.exercises.length + i }));
      if (added.length === 0) return prev;
      return { ...prev, exercises: [...prev.exercises, ...added] };
    });
  }, []);

  const removeExercise = useCallback((id: string) => {
    setData((prev) => {
      // 種目を消してログを残すと、sanitize が参照先のないログとして黙って落とす。
      // 消えるものが見えるように、ここで明示的に一緒に消す
      const workouts: Workouts = {};
      for (const [date, day] of Object.entries(prev.workouts)) {
        const kept = day.filter((e) => e.exerciseId !== id);
        if (kept.length > 0) workouts[date] = kept;
      }
      return {
        ...prev,
        exercises: prev.exercises.filter((e) => e.id !== id).map((e, i) => ({ ...e, order: i })),
        workouts,
      };
    });
  }, []);

  return {
    data,
    daily,
    weeks,
    stats,
    projection,
    sessions,
    trainingStats,
    trainingGoals,
    setValue,
    removeDay,
    updateSettings,
    importData,
    clearRecords,
    clearAll,
    addDayExercise,
    removeDayExercise,
    addSet,
    removeSet,
    setSetValue,
    copySets,
    addDayExercises,
    setGroupGoal,
    addPreset,
    removePreset,
    upsertExercise,
    addExercises,
    removeExercise,
  };
}
