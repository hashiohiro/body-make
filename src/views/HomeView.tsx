import { useMemo, useState } from 'react';
import { BadgeGrid } from '../components/BadgeGrid';
import { Hero } from '../components/Hero';
import { SafetyNotices } from '../components/SafetyNotices';
import { StatTiles } from '../components/StatTiles';
import { StreakStrip } from '../components/StreakStrip';
import { GroupSetsHeatmap } from '../components/training/GroupSetsHeatmap';
import { TrainingSummary } from '../components/training/TrainingSummary';
import type { GroupValueId } from '../components/training/groupValues';
import { computeBadges } from '../lib/badges';
import { buildWeeklySets } from '../lib/training';
import { formatMD } from '../lib/date';
import type { BodyData } from '../hooks/useBodyData';
import type { Domain } from '../types';
import ui from '../styles/ui.module.scss';

interface Props {
  body: BodyData;
  /** 体組成／トレーニングの切り替えはヘッダが持つ */
  domain: Domain;
  onOpenRecords: () => void;
  onOpenTrend: () => void;
}

const SPARK_DAYS = 30;

/**
 * ホームは「いまどうなっているか」を見る場所。入力は記録タブに、目標は目標タブに集約する。
 *
 * 推移への入口をそれぞれの側の最後に置く。
 * 推移は独立した機能ではなく、いま見ている数字の続きなので、タブにはしない。
 */
export function HomeView({ body, domain, onOpenRecords, onOpenTrend }: Props) {
  const { daily, stats, sessions, trainingStats } = body;

  // 部位別の配分は全期間ぶん作る（表側が直近 12 週に切る）
  const weeklySets = useMemo(
    () => (sessions.length > 0 ? buildWeeklySets(sessions, sessions[0]!.date) : []),
    [sessions],
  );
  // 表とダイアログのグラフで同じ値を見る
  const [groupValueId, setGroupValueId] = useState<GroupValueId>('sets');

  const recent = daily.slice(-SPARK_DAYS);
  const spark = recent
    .filter((p) => p.maWeight != null)
    .map((p) => ({ t: p.time, v: p.maWeight! }));
  // 除脂肪体重も移動平均ベースで出す。体組成計の体脂肪率は単日で大きく振れる
  const leanSpark = recent
    .filter((p) => p.maWeight != null && p.maBodyFat != null)
    .map((p) => ({ t: p.time, v: p.maWeight! - (p.maWeight! * p.maBodyFat!) / 100 }));

  // 体組成の記録カレンダーに、トレーニングした日を重ねる
  const trainingDates = new Set(sessions.map((x) => x.date));

  /*
   * 実績もいまの側だけを出す。
   * 体重を測っただけの日に「トレ100回まであと少し」が並ぶと、
   * どちらの話をしている画面なのか読めなくなる。
   */
  const badges = useMemo(
    () => computeBadges(stats, trainingStats).filter((b) => b.domain === domain),
    [stats, trainingStats, domain],
  );

  const trendLink = (label: string) => (
    <button type="button" className={`${ui.card} ${ui.linkRow}`} onClick={onOpenTrend}>
      <span>{label}</span>
      <span aria-hidden="true">›</span>
    </button>
  );

  const caption =
    stats.first && stats.latest
      ? `${formatMD(stats.first.date)} から ${stats.totalSpanDays}日間 · ${stats.recordedDays}日ぶん記録`
      : 'まずは今日の体重を入れてみましょう';

  return (
    <>
      {domain === 'body' &&
        (daily.length === 0 ? (
          <section className={ui.card}>
            <p className={ui.emptyState}>
              記録がまだありません。
              <br />
              今日の体重を入れると、ここに現在地と推移が出ます。
            </p>
            <div className={ui.btnRow}>
              <button
                type="button"
                className={`${ui.btn} ${ui.btnPrimary}`}
                onClick={onOpenRecords}
              >
                記録する
              </button>
            </div>
          </section>
        ) : (
          <>
            <Hero
              weight={stats.currentWeight}
              delta={stats.weightDelta}
              spark={spark}
              lean={stats.currentLeanMass}
              leanDelta={stats.leanMassDelta}
              leanSpark={leanSpark}
              caption={caption}
            />
            <StatTiles stats={stats} />
            {trendLink('体重・体脂肪率の推移')}
          </>
        ))}

      {domain === 'training' && (
        <>
          <TrainingSummary sessions={sessions} stats={trainingStats} />
          {trainingStats.sessions > 0 && (
            <>
              {/* 週ごとの部位別の数字。グラフ画面ではなくここに置く（今週の状況を見る場所なので） */}
              <GroupSetsHeatmap
                weeks={weeklySets}
                valueId={groupValueId}
                onValueChange={setGroupValueId}
              />
              {trendLink('種目別の推移')}
            </>
          )}
        </>
      )}

      {/* 記録の継続は体組成の記録カレンダー。トレーニング側は今週の 7 日を上のカードが持つ */}
      {domain === 'body' && daily.length > 0 && (
        <>
          <p className={ui.sectionLabel}>実績</p>
          <StreakStrip daily={daily} stats={stats} trainingDates={trainingDates} />
          <BadgeGrid badges={badges} />
        </>
      )}

      {domain === 'training' && trainingStats.sessions > 0 && (
        <>
          <p className={ui.sectionLabel}>実績</p>
          <BadgeGrid badges={badges} />
        </>
      )}

      {/*
        記録の置き場所の話は、毎日見る数字のあとに置く。
        切り替えのどちら側でも同じことを言うので、出し分けない
      */}
      <SafetyNotices data={body.data} />
    </>
  );
}
