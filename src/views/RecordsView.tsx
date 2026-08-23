import { useState } from 'react';
import { QuickEntry } from '../components/QuickEntry';
import { TrainingView } from './TrainingView';
import { formatMD, weekdayJa } from '../lib/date';
import { fmt } from '../lib/format';
import type { BodyData } from '../hooks/useBodyData';
import ui from '../styles/ui.module.scss';
import s from './RecordsView.module.scss';

interface Props {
  body: BodyData;
  date: string;
  onDateChange: (date: string) => void;
}

type Mode = 'weight' | 'training';

export function RecordsView({ body, date, onDateChange }: Props) {
  const { daily, data, setValue, removeDay } = body;
  const [mode, setMode] = useState<Mode>('weight');
  const rows = [...daily].reverse();
  const selected = data.entries[date];

  // 体重もトレーニングも「その日に何をしたか」の記録なので、同じタブの中で切り替える
  const tabs = (
    <div className={ui.chipRow} role="group" aria-label="記録の種類">
      {([
        ['weight', '体組成'],
        ['training', 'トレーニング'],
      ] as [Mode, string][]).map(([id, label]) => (
        <button
          key={id}
          type="button"
          className={ui.chip}
          aria-pressed={mode === id}
          onClick={() => setMode(id)}
        >
          {label}
        </button>
      ))}
    </div>
  );

  if (mode === 'training') {
    return (
      <>
        {tabs}
        <TrainingView body={body} date={date} onDateChange={onDateChange} />
      </>
    );
  }

  return (
    <>
      {tabs}
      <QuickEntry
        date={date}
        entries={data.entries}
        daily={daily}
        onDateChange={onDateChange}
        onValue={setValue}
      />

      {selected && (
        <div className={ui.btnRow} style={{ marginTop: 0, marginBottom: 12 }}>
          <button
            type="button"
            className={`${ui.btn} ${ui.btnGhost} ${ui.btnDanger}`}
            onClick={() => {
              if (confirm(`${formatMD(date)} の記録を削除しますか？`)) removeDay(date);
            }}
          >
            この日の記録を削除
          </button>
        </div>
      )}

      <section className={ui.card}>
        <header className={ui.cardHeader}>
          <h2 className={ui.cardTitle}>記録一覧</h2>
          <span className={ui.hint}>タップで編集</span>
        </header>

        {rows.length === 0 ? (
          <p className={ui.emptyState}>まだ記録がありません。</p>
        ) : (
          <div className={s.list}>
            {rows.map((point) => (
              <button
                key={point.date}
                type="button"
                className={s.row}
                aria-current={point.date === date}
                onClick={() => onDateChange(point.date)}
              >
                <span className={s.date}>
                  {formatMD(point.date)}
                  <br />
                  {weekdayJa(point.date)}
                </span>
                <span className={s.values}>
                  {point.weight == null ? (
                    <span className={s.missing}>未記録</span>
                  ) : (
                    <>
                      {fmt(point.weight)} kg
                      <small>{point.bodyFat == null ? '体脂肪率なし' : `${fmt(point.bodyFat)} %`}</small>
                    </>
                  )}
                </span>
                <span className={s.slots} aria-label={`記録回数 ${point.slots}`}>
                  <i className={`${s.dot} ${point.am.weight != null || point.am.bodyFat != null ? s.dotOn : ''}`} />
                  <i className={`${s.dot} ${point.pm.weight != null || point.pm.bodyFat != null ? s.dotOn : ''}`} />
                </span>
              </button>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
