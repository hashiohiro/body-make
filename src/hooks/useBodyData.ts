import { useCallback, useEffect, useMemo, useState } from 'react';
import { buildDaily, buildWeeks, computeProjection, computeStats, emptyDay } from '../lib/derive';
import { isCardio } from '../lib/exerciseCatalog';
import {
  PRESET_NAME_MAX,
  demoSeed,
  emptyData,
  loadData,
  sanitizeData,
  saveData,
} from '../lib/storage';
import { buildSessions, computeTrainingStats, exerciseGoals } from '../lib/training';
import { buildCheckHistory } from '../lib/check';
import type { ImportPayload } from '../lib/io';
import type {
  AppData,
  CardioSet,
  CheckSettings,
  Entries,
  Exercise,
  Measurement,
  MuscleGroup,
  Preset,
  SessionExercise,
  SessionSet,
  Settings,
  SlotId,
  WorkSet,
  Workouts,
} from '../types';

export type MeasurementField = keyof Measurement;
/** 筋トレは 重量 と 回/秒、有酸素は 距離(m) と 時間(秒)。どちらが来るかは種目が決める */
export type SetField = 'weight' | 'reps' | 'meters' | 'seconds';

const EMPTY_SET: WorkSet = { weight: null, reps: null };
const EMPTY_BOUT: CardioSet = { meters: null, seconds: null };

/** その種目の空行。器が違うので、種目を見てから作る */
function emptySetOf(exercises: readonly Exercise[], exerciseId: string): SessionSet {
  const exercise = exercises.find((e) => e.id === exerciseId);
  return exercise && isCardio(exercise.group) ? { ...EMPTY_BOUT } : { ...EMPTY_SET };
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
  /**
   * 直近の保存に失敗しているか。
   *
   * 容量超過やプライベートモードでは localStorage が書けない。
   * **打った値が画面には出るのに保存されていない**のがこの状態で、
   * 気づかせないまま進むと、次に開いたときにまとめて消えている。
   * 画面に出す責任は `components/StorageAlert.tsx` が持つ。
   */
  saveFailed: boolean;
  daily: ReturnType<typeof buildDaily>;
  weeks: ReturnType<typeof buildWeeks>;
  stats: ReturnType<typeof computeStats>;
  projection: ReturnType<typeof computeProjection>;
  sessions: ReturnType<typeof buildSessions>;
  trainingStats: ReturnType<typeof computeTrainingStats>;
  trainingGoals: ReturnType<typeof exerciseGoals>;
  /** 過去の日の資源消費。構成チェックが読む（lib/check.ts） */
  checkHistory: ReturnType<typeof buildCheckHistory>;

  setValue: (date: string, slot: SlotId, field: MeasurementField, value: number | null) => void;
  removeDay: (date: string) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  importData: (payload: ImportPayload, mode: 'merge' | 'replace') => void;

  /** 実績のみ削除（マイ種目と設定は残す） */
  clearRecords: () => void;
  /** すべて削除（設定だけ残す） */
  clearAll: () => void;
  /** デモの初期データへ戻す。デモ向けビルド以外では何もしない */
  resetToSeed: () => void;

  addDayExercise: (date: string, exerciseId: string) => void;
  removeDayExercise: (date: string, exerciseId: string) => void;
  /** その日の種目の並びを入れ替える。並びはやった順で、記録そのものは動かさない */
  reorderDayExercises: (date: string, exerciseIds: readonly string[]) => void;
  addSet: (date: string, exerciseId: string) => void;
  removeSet: (date: string, exerciseId: string, index: number) => void;
  setSetValue: (
    date: string,
    exerciseId: string,
    index: number,
    field: SetField,
    value: number | null,
  ) => void;
  copySets: (date: string, exerciseId: string, sets: readonly SessionSet[]) => void;
  /** 過去の日から種目だけをまとめて足す。すでにある種目は飛ばす */
  addDayExercises: (date: string, exerciseIds: readonly string[]) => void;

  setGroupGoal: (group: MuscleGroup, value: number | null) => void;
  /** いまの組み合わせに名前を付けて残す。同じ名前があれば中身を置き換える */
  savePreset: (name: string, exerciseIds: readonly string[]) => void;
  /** 名前と中身を書き換える（設定側の編集） */
  updatePreset: (preset: Preset) => void;
  removePreset: (id: string) => void;
  updateChecks: (patch: Partial<CheckSettings>) => void;
  /** 警告を許容済みにする。同じキーの警告は次から出ない */
  suppressWarning: (key: string) => void;
  /** 許容を取り消す。一方通行にすると押し間違いが永久に残る */
  unsuppressWarning: (key: string) => void;

  upsertExercise: (exercise: Exercise) => void;
  addExercises: (exercises: readonly Exercise[]) => void;
  /** マイ種目から消す。その種目の記録も一緒に消える（参照だけ残すとログが黙って落ちるため） */
  removeExercise: (id: string) => void;
}

export function useBodyData(): BodyData {
  const [data, setData] = useState<AppData>(loadData);
  const [saveFailed, setSaveFailed] = useState(false);

  useEffect(() => {
    setSaveFailed(!saveData(data));
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
  // 過去の消費は「やった事実」から作る。並べただけの日を数えないため sessions を読む
  const checkHistory = useMemo(
    () => buildCheckHistory(sessions, data.exercises),
    [sessions, data.exercises],
  );
  /*
   * 目標一覧は表示中の種目だけ。非表示にした種目の目標は消さずに持ったままにして、
   * 表示に戻したときにそのまま復活させる（消すのは「目標を外す」を押したときだけ）。
   */
  const trainingGoals = useMemo(
    () =>
      exerciseGoals(
        sessions,
        data.exercises.filter((e) => !e.hidden),
      ),
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

      /*
       * 組み合わせは種目と同じ扱い。id が無いものだけ足す。
       * ここに書き忘れると、取り込んだ瞬間にプリセットと部位別の目標が消える
       * （sanitizeData は渡したキーしか見ないため）。
       */
      const presets =
        payload.presets == null
          ? prev.presets
          : mode === 'replace'
            ? payload.presets
            : [
                ...prev.presets,
                ...payload.presets.filter((p) => !prev.presets.some((x) => x.id === p.id)),
              ];

      // 部位別の目標は 6 つの値の組。ファイルにある部位だけを上書きする（entries と同じ考え方）
      const groupGoals =
        payload.groupGoals == null
          ? prev.groupGoals
          : mode === 'replace'
            ? payload.groupGoals
            : (Object.fromEntries(
                Object.entries(prev.groupGoals).map(([g, v]) => [
                  g,
                  payload.groupGoals?.[g as MuscleGroup] ?? v,
                ]),
              ) as typeof prev.groupGoals);

      return sanitizeData({
        version: 3,
        settings: payload.settings ?? prev.settings,
        entries,
        exercises,
        workouts,
        presets,
        groupGoals,
        /*
         * 閾値と許容済みも必ず渡す。ここに書き忘れると、取り込んだ瞬間に
         * sanitizeData が渡されなかったキーを既定値へ戻し、その場で設定が消える。
         * 閾値は 1 組の設定なのでファイルにあれば丸ごと置き換え、
         * 許容済みはマージ側では足すだけにする（消したものを取り込みで復活させない）。
         */
        checks: payload.checks ?? prev.checks,
        suppressed:
          payload.suppressed == null
            ? prev.suppressed
            : mode === 'replace'
              ? payload.suppressed
              : [...new Set([...prev.suppressed, ...payload.suppressed])],
      });
    });
  }, []);

  const clearRecords = useCallback(() => {
    setData((prev) => ({ ...prev, entries: {}, workouts: {} }));
  }, []);

  const clearAll = useCallback(() => {
    setData((prev) => ({ ...emptyData(), settings: prev.settings }));
  }, []);

  /*
   * デモを初期データへ戻す。
   *
   * テーマだけは引き継ぐ。見た目は端末の好みで、デモの中身とは別のもの。
   * 戻す対象は記録・種目・目標・設定のほうで、配色まで巻き戻す理由がない。
   */
  const resetToSeed = useCallback(() => {
    const seed = demoSeed();
    if (!seed) return;
    setData((prev) => ({ ...seed, settings: { ...seed.settings, theme: prev.settings.theme } }));
  }, []);

  /* ---- 筋トレのログ ---- */

  const addDayExercise = useCallback((date: string, exerciseId: string) => {
    setData((prev) => {
      // 同一種目は 1 日 1 エントリ。すでにあれば何もしない（画面側で既存カードへ移動する）
      if ((prev.workouts[date] ?? []).some((e) => e.exerciseId === exerciseId)) return prev;
      const day = prev.workouts[date] ?? [];
      return {
        ...prev,
        workouts: {
          ...prev.workouts,
          [date]: [...day, { exerciseId, sets: [emptySetOf(prev.exercises, exerciseId)] }],
        },
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

  /**
   * その日の種目の並びを入れ替える。**動くのは並びだけ**で、セットには触らない。
   * 渡された並びに無い種目は後ろに残す（取りこぼしで記録を落とさないため）。
   */
  const reorderDayExercises = useCallback((date: string, exerciseIds: readonly string[]) => {
    setData((prev) => {
      const day = prev.workouts[date];
      if (!day) return prev;
      const wanted = new Set(exerciseIds);
      const byId = new Map(day.map((e) => [e.exerciseId, e]));
      const moved = exerciseIds
        .map((id) => byId.get(id))
        .filter((e): e is SessionExercise => e != null);
      const rest = day.filter((e) => !wanted.has(e.exerciseId));
      return { ...prev, workouts: { ...prev.workouts, [date]: [...moved, ...rest] } };
    });
  }, []);

  const addSet = useCallback((date: string, exerciseId: string) => {
    setData((prev) => ({
      ...prev,
      workouts: mapDayExercise(prev.workouts, date, exerciseId, (e) => ({
        ...e,
        // 直前のセットを複製する。同じ重量で続けるのが普通なので、入力は差分だけで済む
        sets: [
          ...e.sets,
          e.sets.length > 0
            ? { ...e.sets[e.sets.length - 1]! }
            : emptySetOf(prev.exercises, exerciseId),
        ],
      })),
    }));
  }, []);

  /**
   * セット行を 1 本消す。**種目そのものには手を出さない。**
   *
   * 以前は最後の 1 行を消した時点で種目ごと落としていた。
   * だが「セットを消す」と「種目をこの日から外す」は別の操作で、
   * 行の × を押しただけで種目が消えるのは、頼んでいない削除になる。
   * 外すのはカード右上の × だけの仕事（設計 §2.2）。
   */
  const removeSet = useCallback((date: string, exerciseId: string, index: number) => {
    setData((prev) => ({
      ...prev,
      workouts: mapDayExercise(prev.workouts, date, exerciseId, (e) => ({
        ...e,
        sets: e.sets.filter((_, i) => i !== index),
      })),
    }));
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

  const copySets = useCallback((date: string, exerciseId: string, sets: readonly SessionSet[]) => {
    setData((prev) => ({
      ...prev,
      workouts: mapDayExercise(prev.workouts, date, exerciseId, (e) => ({
        ...e,
        sets: sets.map((s) => ({ ...s })),
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
        .map((exerciseId) => ({ exerciseId, sets: [emptySetOf(prev.exercises, exerciseId)] }));
      if (added.length === 0) return prev;
      return { ...prev, workouts: { ...prev.workouts, [date]: [...day, ...added] } };
    });
  }, []);

  /* ---- マイ種目・プリセット ---- */

  /**
   * 組み合わせに名前を付けて残す。持つのは種目だけで、重量もレップも持たない（types.ts の Preset）。
   *
   * **同じ名前があれば、その中身を置き換える。** 同名を 2 つ並べると、
   * どちらを呼び出すのか名前から決められない（一覧で見分ける手がかりが部位と件数しかない）。
   * 上書きしてよいかを聞くのは画面側の仕事で、ここは聞かれた結果を書くだけ。
   */
  const savePreset = useCallback((name: string, exerciseIds: readonly string[]) => {
    const trimmed = name.trim().slice(0, PRESET_NAME_MAX);
    const ids = [...new Set(exerciseIds)];
    if (!trimmed || ids.length === 0) return;
    setData((prev) => {
      const found = prev.presets.find((p) => p.name === trimmed);
      return {
        ...prev,
        presets: found
          ? prev.presets.map((p) => (p.id === found.id ? { ...p, exerciseIds: ids } : p))
          : [...prev.presets, { id: crypto.randomUUID(), name: trimmed, exerciseIds: ids }],
      };
    });
  }, []);

  /**
   * 名前と中身の編集（設定側のプリセット画面から使う）。
   * 名前が他のプリセットとぶつかる場合は変えない（同名を作らないのが savePreset の前提）。
   * 種目が 0 件になる編集も受け付けない。空の組み合わせは読み込み時に落ちる（storage.ts）。
   */
  const updatePreset = useCallback((preset: Preset) => {
    const name = preset.name.trim().slice(0, PRESET_NAME_MAX);
    const ids = [...new Set(preset.exerciseIds)];
    if (!name || ids.length === 0) return;
    setData((prev) => {
      if (prev.presets.some((p) => p.id !== preset.id && p.name === name)) return prev;
      return {
        ...prev,
        presets: prev.presets.map((p) =>
          p.id === preset.id ? { ...p, name, exerciseIds: ids } : p,
        ),
      };
    });
  }, []);

  const removePreset = useCallback((id: string) => {
    setData((prev) => ({ ...prev, presets: prev.presets.filter((p) => p.id !== id) }));
  }, []);

  const setGroupGoal = useCallback((group: MuscleGroup, value: number | null) => {
    setData((prev) => ({ ...prev, groupGoals: { ...prev.groupGoals, [group]: value } }));
  }, []);

  const updateChecks = useCallback((patch: Partial<CheckSettings>) => {
    setData((prev) => ({ ...prev, checks: { ...prev.checks, ...patch } }));
  }, []);

  const suppressWarning = useCallback((key: string) => {
    setData((prev) =>
      prev.suppressed.includes(key) ? prev : { ...prev, suppressed: [...prev.suppressed, key] },
    );
  }, []);

  const unsuppressWarning = useCallback((key: string) => {
    setData((prev) => ({ ...prev, suppressed: prev.suppressed.filter((k) => k !== key) }));
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

  /**
   * カタログからマイ種目へ足す。
   *
   * **非表示にしてあった種目を選んだら、表示に戻す。**
   * ID は同じなので新しく足すことはできず、何も起きないボタンになってしまう。
   * 「もう一度これを使う」と言われたのだから、記録も設定も目標も付いたまま戻す。
   */
  const addExercises = useCallback((exercises: readonly Exercise[]) => {
    setData((prev) => {
      const incoming = new Set(exercises.map((e) => e.id));
      const known = new Set(prev.exercises.map((e) => e.id));
      const added = exercises
        .filter((e) => !known.has(e.id))
        .map((e, i) => ({ ...e, order: prev.exercises.length + i }));
      const shown = prev.exercises.map((e) =>
        e.hidden && incoming.has(e.id) ? { ...e, hidden: false } : e,
      );
      if (added.length === 0 && shown.every((e, i) => e === prev.exercises[i])) return prev;
      return { ...prev, exercises: [...shown, ...added] };
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
    saveFailed,
    daily,
    weeks,
    stats,
    projection,
    sessions,
    trainingStats,
    trainingGoals,
    checkHistory,
    setValue,
    removeDay,
    updateSettings,
    importData,
    clearRecords,
    clearAll,
    resetToSeed,
    addDayExercise,
    removeDayExercise,
    reorderDayExercises,
    addSet,
    removeSet,
    setSetValue,
    copySets,
    addDayExercises,
    setGroupGoal,
    updateChecks,
    suppressWarning,
    unsuppressWarning,
    savePreset,
    updatePreset,
    removePreset,
    upsertExercise,
    addExercises,
    removeExercise,
  };
}
