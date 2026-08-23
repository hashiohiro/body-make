import { addDays, todayISO } from '../lib/date';
import { dayAverageBodyFat, dayAverageWeight, emptyDay } from '../lib/derive';
import { fmt } from '../lib/format';
import { BODYFAT_RANGE, WEIGHT_RANGE } from '../lib/storage';
import type { DailyPoint, Entries, SlotId } from '../types';
import type { MeasurementField } from '../hooks/useBodyData';
import { NumberField } from './NumberField';
import ui from '../styles/ui.module.scss';
import s from './QuickEntry.module.scss';

interface Props {
  date: string;
  entries: Entries;
  daily: readonly DailyPoint[];
  onDateChange: (date: string) => void;
  onValue: (date: string, slot: SlotId, field: MeasurementField, value: number | null) => void;
}

const SLOTS: { id: SlotId; label: string; icon: string }[] = [
  { id: 'am', label: '朝', icon: '☀️' },
  { id: 'pm', label: '夜', icon: '🌙' },
];

/** 直近で記録された値。未入力欄の ± の起点にして、初回のタップ数を減らす */
function lastKnown(
  daily: readonly DailyPoint[],
  date: string,
  slot: SlotId,
  field: MeasurementField,
): number | null {
  for (let i = daily.length - 1; i >= 0; i--) {
    const point = daily[i]!;
    if (point.date >= date) continue;
    const value = point[slot][field];
    if (value != null) return value;
  }
  return null;
}

export function QuickEntry({ date, entries, daily, onDateChange, onValue }: Props) {
  const entry = entries[date] ?? emptyDay();
  const today = todayISO();
  const avgWeight = dayAverageWeight(entry);
  const avgBodyFat = dayAverageBodyFat(entry);

  return (
    <section className={ui.card}>
      <header className={ui.cardHeader}>
        <h2 className={ui.cardTitle}>体組成</h2>
      </header>

      <div className={s.dateRow}>
        <button
          type="button"
          className={s.nav}
          onClick={() => onDateChange(addDays(date, -1))}
          aria-label="前の日"
        >
          ‹
        </button>
        <input
          className={s.dateInput}
          type="date"
          value={date}
          max={today}
          onChange={(e) => e.target.value && onDateChange(e.target.value)}
          aria-label="記録する日付"
        />
        <button
          type="button"
          className={s.nav}
          onClick={() => onDateChange(addDays(date, 1))}
          disabled={date >= today}
          aria-label="次の日"
        >
          ›
        </button>
        <button
          type="button"
          className={`${ui.btn} ${ui.btnSm}`}
          onClick={() => onDateChange(today)}
          disabled={date === today}
        >
          今日
        </button>
      </div>

      <div className={s.slots}>
        {SLOTS.map((slot) => {
          const measurement = entry[slot.id];
          const prevWeight = lastKnown(daily, date, slot.id, 'weight');
          const prevBodyFat = lastKnown(daily, date, slot.id, 'bodyFat');
          const canCopy = measurement.weight == null && prevWeight != null;

          return (
            <div key={slot.id} className={s.slot}>
              <div className={s.slotHead}>
                <span aria-hidden="true">{slot.icon}</span>
                {slot.label}
                {canCopy && (
                  <button
                    type="button"
                    className={s.copy}
                    onClick={() => {
                      onValue(date, slot.id, 'weight', prevWeight);
                      if (prevBodyFat != null) onValue(date, slot.id, 'bodyFat', prevBodyFat);
                    }}
                  >
                    前回値
                  </button>
                )}
              </div>

              <NumberField
                label="体重 kg"
                value={measurement.weight}
                fallback={prevWeight}
                step={0.1}
                min={WEIGHT_RANGE[0]}
                max={WEIGHT_RANGE[1]}
                onCommit={(v) => onValue(date, slot.id, 'weight', v)}
              />
              <NumberField
                label="体脂肪率 %"
                value={measurement.bodyFat}
                fallback={prevBodyFat}
                step={0.1}
                min={BODYFAT_RANGE[0]}
                max={BODYFAT_RANGE[1]}
                onCommit={(v) => onValue(date, slot.id, 'bodyFat', v)}
              />
            </div>
          );
        })}
      </div>

      <div className={s.summary}>
        <span>この日の平均</span>
        <b>
          {fmt(avgWeight)} kg / {fmt(avgBodyFat)} %
        </b>
      </div>
    </section>
  );
}
