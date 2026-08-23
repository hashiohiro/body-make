import { useMemo, useState } from 'react';
import { ExerciseCard } from '../components/training/ExerciseCard';
import { ExerciseDetailDialog } from '../components/training/ExerciseDetailDialog';
import { ExercisePicker } from '../components/training/ExercisePicker';
import { GROUP_LABELS } from '../lib/exerciseCatalog';
import { addDays, formatMD, formatMDW, todayISO, weekdayJa } from '../lib/date';
import { fmt } from '../lib/format';
import { personalBest, pickVolume, previousPoint, sessionGroups } from '../lib/training';
import type { BodyData } from '../hooks/useBodyData';
import ui from '../styles/ui.module.scss';
import s from '../components/training/training.module.scss';
import rs from './RecordsView.module.scss';

interface Props {
  body: BodyData;
  date: string;
  onDateChange: (date: string) => void;
}

export function TrainingView({ body, date, onDateChange }: Props) {
  const {
    data,
    sessions,
    addDayExercise,
    removeDayExercise,
    addSet,
    removeSet,
    setSetValue,
    copySets,
  } = body;

  const today = todayISO();
  const dayEntries = data.workouts[date] ?? [];
  const byId = useMemo(() => new Map(data.exercises.map((e) => [e.id, e])), [data.exercises]);

  const active = useMemo(
    () => [...data.exercises].sort((a, b) => a.order - b.order),
    [data.exercises],
  );

  const session = useMemo(() => sessions.find((x) => x.date === date) ?? null, [sessions, date]);
  const [openDate, setOpenDate] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  const usedIds = new Set(dayEntries.map((e) => e.exerciseId));

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
      <section className={ui.card}>
        <header className={ui.cardHeader}>
          <h2 className={ui.cardTitle}>トレーニング</h2>
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
      </section>

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

      <section className={ui.card}>
        {dayEntries.length === 0 && active.length > 0 && (
          <p className={ui.emptyState}>{formatMDW(date)} の記録はまだありません。</p>
        )}
        <ExercisePicker exercises={active} usedIds={usedIds} onToggle={toggle} />
      </section>

      <section className={ui.card}>
        <header className={ui.cardHeader}>
          <h2 className={ui.cardTitle}>記録一覧</h2>
          <span className={ui.hint}>タップで内訳</span>
        </header>

        {sessions.length === 0 ? (
          <p className={ui.emptyState}>まだ記録がありません。</p>
        ) : (
          <div className={rs.list}>
            {[...sessions].reverse().map((point) => {
              const groups = sessionGroups(point).map((g) => GROUP_LABELS[g]);
              const open = openDate === point.date;

              return (
                <div key={point.date}>
                  <button
                    type="button"
                    className={rs.row}
                    aria-expanded={open}
                    aria-current={point.date === date}
                    onClick={() => setOpenDate(open ? null : point.date)}
                  >
                    <span className={rs.date}>
                      {formatMD(point.date)}
                      <br />
                      {weekdayJa(point.date)}
                    </span>
                    <span className={rs.values}>{groups.join('・')}</span>
                    <span className={rs.values}>{point.exercises.length}種目</span>
                  </button>

                  {open && (
                    <div className={s.sessionDetail}>
                      <div className={ui.tableScroll}>
                        <table className={ui.table}>
                          <thead>
                            <tr>
                              <th scope="col">種目</th>
                              <th scope="col">セット</th>
                              <th scope="col">挙上量</th>
                              <th scope="col">推定1RM</th>
                            </tr>
                          </thead>
                          <tbody>
                            {point.exercises.map((ex) => (
                              <tr key={ex.exerciseId}>
                                <th scope="row">{ex.name}</th>
                                <td>{ex.workSets}</td>
                                <td>
                                  {ex.volume > 0 ? (
                                    `${Math.round(ex.volume).toLocaleString()} kg`
                                  ) : (
                                    <span className={ui.cellEmpty}>—</span>
                                  )}
                                </td>
                                <td>
                                  {ex.oneRm != null ? (
                                    `${fmt(ex.oneRm)}${ex.measured ? ' *' : ''}`
                                  ) : (
                                    <span className={ui.cellEmpty}>—</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div className={ui.btnRow}>
                        <button
                          type="button"
                          className={`${ui.btn} ${ui.btnSm}`}
                          disabled={point.date === date}
                          onClick={() => {
                            onDateChange(point.date);
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                        >
                          この日を編集
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <p className={ui.note}>
          推定1RMは記録からの換算値で、実際に挙げられる重量の予測ではありません。
          <b>*</b> は1レップの実測。
        </p>
      </section>

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
