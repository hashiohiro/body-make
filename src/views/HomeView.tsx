import { useMemo, useState } from 'react';
import { BadgeGrid } from '../components/BadgeGrid';
import { Hero } from '../components/Hero';
import { SafetyNotices } from '../components/SafetyNotices';
import { StatTiles } from '../components/StatTiles';
import { GroupSetsHeatmap } from '../components/training/GroupSetsHeatmap';
import { TrainingSummary } from '../components/training/TrainingSummary';
import type { GroupValueId } from '../components/training/groupValues';
import { computeBadges } from '../lib/badges';
import { formatMD } from '../lib/date';
import type { BodyData } from '../hooks/useBodyData';
import type { Domain } from '../types';
import { Button } from '../components/Button';
import { useT } from '../lib/i18n';
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
  // 部位別の配分は全期間ぶん（表側が直近 5 週に切る）。作るのは useBodyData で 1 回だけ
  const { daily, stats, sessions, weeklySets, trainingStats, badgeFacts, data } = body;
  const t = useT();
  const waistEnabled = data.settings.waistEnabled;
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
  // 腹囲も移動平均ベース。メジャーを当てる位置と呼気で単日は 1〜2cm 振れる
  const waistSpark = recent
    .filter((p) => p.maWaist != null)
    .map((p) => ({ t: p.time, v: p.maWaist! }));

  /*
   * 実績もいまの側だけを出す。
   * 体重を測っただけの日に「トレ100回まであと少し」が並ぶと、
   * どちらの話をしている画面なのか読めなくなる。
   */
  const badges = useMemo(
    () =>
      computeBadges(stats, trainingStats, body.data.badgesEarnedAt, badgeFacts).filter(
        (b) => b.domain === domain,
      ),
    [stats, trainingStats, badgeFacts, body.data.badgesEarnedAt, domain],
  );

  const earnedBadges = badges.filter((b) => b.earned);
  const lockedBadges = badges.filter((b) => !b.earned);

  const trendLink = (label: string) => (
    <button type="button" className={`${ui.card} ${ui.linkRow}`} onClick={onOpenTrend}>
      <span>{label}</span>
      <span aria-hidden="true">›</span>
    </button>
  );

  const caption =
    stats.first && stats.latest
      ? t('home.since', {
          date: formatMD(stats.first.date),
          days: stats.totalSpanDays,
          recorded: stats.recordedDays,
        })
      : t('home.firstStep');

  return (
    <>
      <SafetyNotices data={body.data} />

      {domain === 'body' &&
        (daily.length === 0 ? (
          <section className={ui.card}>
            <p className={ui.emptyState}>
              {t('common.noRecords')}
              <br />
              {t('home.emptyHint')}
            </p>
            <div className={ui.btnRow}>
              <Button tone="primary" onClick={onOpenRecords}>
                {t('home.record')}
              </Button>
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
              // 設定でオフなら行ごと出ない（記録は残っていても隠す）
              waist={waistEnabled ? stats.currentWaist : null}
              waistDelta={stats.waistDelta}
              waistSpark={waistSpark}
              caption={caption}
            />
            <StatTiles stats={stats} />
            {trendLink(t('home.bodyTrendLink'))}
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
              {trendLink(t('home.exerciseTrendLink'))}
            </>
          )}
        </>
      )}

      {/*
        実績は**解除済みと未解除で 2 枚に分ける。**1 枚に混ぜると、獲ったものが
        未獲得に埋もれて「何を取ったか」が読めない。
        解除済みは獲った順、未解除は達成率の高い順（`computeBadges` の並びのまま）。
      */}
      {((domain === 'body' && daily.length > 0) ||
        (domain === 'training' && trainingStats.sessions > 0)) && (
        <>
          <p className={ui.sectionLabel}>{t('badge.section')}</p>
          {earnedBadges.length > 0 && (
            <BadgeGrid
              badges={earnedBadges}
              title={t('badge.earnedSection')}
              total={badges.length}
              recentFirst
            />
          )}
          {lockedBadges.length > 0 && (
            <BadgeGrid badges={lockedBadges} title={t('badge.lockedSection')} />
          )}
        </>
      )}
    </>
  );
}
