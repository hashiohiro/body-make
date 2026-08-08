import { useCallback, useEffect, useMemo, useState } from 'react';
import { buildDaily, buildWeeks, computeProjection, computeStats, emptyDay } from '../lib/derive';
import { emptyData, loadData, saveData } from '../lib/storage';
import type { AppData, Entries, Measurement, Settings, SlotId } from '../types';

export type MeasurementField = keyof Measurement;

export interface BodyData {
  data: AppData;
  daily: ReturnType<typeof buildDaily>;
  weeks: ReturnType<typeof buildWeeks>;
  stats: ReturnType<typeof computeStats>;
  projection: ReturnType<typeof computeProjection>;
  setValue: (date: string, slot: SlotId, field: MeasurementField, value: number | null) => void;
  removeDay: (date: string) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  mergeEntries: (entries: Entries, mode: 'merge' | 'replace') => void;
  clearAll: () => void;
}

export function useBodyData(): BodyData {
  const [data, setData] = useState<AppData>(loadData);

  useEffect(() => {
    saveData(data);
  }, [data]);

  const daily = useMemo(() => buildDaily(data.entries), [data.entries]);
  const weeks = useMemo(() => buildWeeks(daily), [daily]);
  const stats = useMemo(() => computeStats(daily, weeks, data.settings), [daily, weeks, data.settings]);
  const projection = useMemo(
    () => computeProjection(daily, stats, data.settings),
    [daily, stats, data.settings],
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
          day.am.weight == null && day.am.bodyFat == null && day.pm.weight == null && day.pm.bodyFat == null;
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

  const mergeEntries = useCallback((entries: Entries, mode: 'merge' | 'replace') => {
    setData((prev) => ({
      ...prev,
      entries: mode === 'replace' ? entries : { ...prev.entries, ...entries },
    }));
  }, []);

  const clearAll = useCallback(() => {
    setData((prev) => ({ ...emptyData(), settings: prev.settings }));
  }, []);

  return { data, daily, weeks, stats, projection, setValue, removeDay, updateSettings, mergeEntries, clearAll };
}
