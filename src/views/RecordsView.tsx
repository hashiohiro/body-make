import { useMemo, useState } from 'react';
import { BodyTrendDialog } from '../components/BodyTrendDialog';
import { QuickEntry } from '../components/QuickEntry';
import { RecordCalendar } from '../components/RecordCalendar';
import { TrainingView } from './TrainingView';
import { formatMD, weekdayJa } from '../lib/date';
import { fmt } from '../lib/format';
import type { BodyData } from '../hooks/useBodyData';
import type { Domain } from '../types';
import ui from '../styles/ui.module.scss';
import s from './RecordsView.module.scss';

interface Props {
  body: BodyData;
  date: string;
  onDateChange: (date: string) => void;
  /** 体組成／トレーニングの切り替えはヘッダが持つ */
  domain: Domain;
}

/**
 * 一覧に最初から出す日数。
 *
 * 枠の高さは 60vh で、実際に見えているのは 10 行前後。それでも以前は
 * **記録のある日をすべて DOM に出していた**ので、値を 1 つ打つたびに
 * 全期間ぶんの差分を取っていた（10 年ぶんで 3,650 行・29,000 ノード・約 200ms）。
 * 打鍵ごとに払う量を、記録の長さから切り離す。
 */
const INITIAL_ROWS = 60;
/** 「もっと見る」1 回ぶん */
const MORE_ROWS = 180;

export function RecordsView({ body, date, onDateChange, domain }: Props) {
  const { daily, data, sessions, stats, trainingStats, setValue } = body;
  const [limit, setLimit] = useState(INITIAL_ROWS);
  const [trendOpen, setTrendOpen] = useState(false);

  // カレンダーに出す印。切り替えに従って片方だけを使う
  const bodyDates = useMemo(
    () => new Set(daily.filter((d) => d.slots > 0).map((d) => d.date)),
    [daily],
  );
  const bodyFullDates = useMemo(
    () => new Set(daily.filter((d) => d.slots === 2).map((d) => d.date)),
    [daily],
  );
  const trainingDates = useMemo(() => new Set(sessions.map((x) => x.date)), [sessions]);
  // 新しい順に出すので、後ろから切ってから반転する
  const rows = useMemo(() => daily.slice(-limit).reverse(), [daily, limit]);
  const rest = daily.length - rows.length;

  /*
   * カレンダーは**記録画面の先頭**。打つ前に「前はいつ付けたか」を見て、
   * そのまま日付を選べる。切り替えに従って、体組成とトレーニングを別々に出す。
   */
  const calendar =
    domain === 'body' ? (
      <RecordCalendar
        marked={bodyDates}
        filled={bodyFullDates}
        selected={date}
        summary={`最長 ${stats.bestStreak}日 · 通算 ${stats.recordedDays}日`}
        firstDate={stats.first?.date ?? null}
        onSelect={onDateChange}
      />
    ) : (
      <RecordCalendar
        marked={trainingDates}
        filled={trainingDates}
        selected={date}
        summary={`今週 ${trainingStats.thisWeekDays}日 · 通算 ${trainingStats.sessions}回`}
        firstDate={trainingStats.firstDate}
        onSelect={onDateChange}
      />
    );

  if (domain === 'training') {
    return (
      <>
        {calendar}
        <TrainingView body={body} date={date} />
      </>
    );
  }

  return (
    <>
      {calendar}

      <QuickEntry
        date={date}
        entries={data.entries}
        daily={daily}
        onValue={setValue}
        onOpenTrend={() => setTrendOpen(true)}
      />

      <BodyTrendDialog
        open={trendOpen}
        onClose={() => setTrendOpen(false)}
        daily={daily}
        settings={data.settings}
        date={date}
      />

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
                      <small>
                        {point.bodyFat == null ? '体脂肪率なし' : `${fmt(point.bodyFat)} %`}
                      </small>
                    </>
                  )}
                </span>
                <span className={s.slots} aria-label={`記録回数 ${point.slots}`}>
                  <i
                    className={`${s.dot} ${point.am.weight != null || point.am.bodyFat != null ? s.dotOn : ''}`}
                  />
                  <i
                    className={`${s.dot} ${point.pm.weight != null || point.pm.bodyFat != null ? s.dotOn : ''}`}
                  />
                </span>
              </button>
            ))}

            {/*
              古い日は「もっと見る」で伸ばす。任意の日へはヘッダの日付ナビから直接跳べるので、
              一覧は最近を眺めるためのものとして扱う。
            */}
            {rest > 0 && (
              <button
                type="button"
                className={`${ui.btn} ${ui.btnGhost} ${s.more}`}
                onClick={() => setLimit((n) => n + MORE_ROWS)}
              >
                さらに{Math.min(rest, MORE_ROWS)}日ぶん見る<small>残り {rest}日</small>
              </button>
            )}
          </div>
        )}
      </section>
    </>
  );
}
