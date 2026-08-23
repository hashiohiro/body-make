import { BadgeGrid } from '../components/BadgeGrid';
import { GoalMeter } from '../components/GoalMeter';
import { Hero } from '../components/Hero';
import { StatTiles } from '../components/StatTiles';
import { StreakStrip } from '../components/StreakStrip';
import { TrainingGoals } from '../components/training/TrainingGoals';
import { TrainingSummary } from '../components/training/TrainingSummary';
import { computeBadges } from '../lib/badges';
import { formatMD } from '../lib/date';
import type { BodyData } from '../hooks/useBodyData';
import ui from '../styles/ui.module.scss';

interface Props {
  body: BodyData;
  onOpenSettings: () => void;
  onOpenRecords: () => void;
  onOpenGoals: () => void;
}

const SPARK_DAYS = 30;

/** ホームは「いまどうなっているか」を見る場所。入力は記録タブに集約する */
export function HomeView({ body, onOpenSettings, onOpenRecords, onOpenGoals }: Props) {
  const { daily, stats, projection, sessions, trainingStats, trainingGoals, data } = body;

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

  const caption =
    stats.first && stats.latest
      ? `${formatMD(stats.first.date)} から ${stats.totalSpanDays}日間 · ${stats.recordedDays}日ぶん記録`
      : 'まずは今日の体重を入れてみましょう';

  return (
    <>
      {daily.length === 0 ? (
        <section className={ui.card}>
          <p className={ui.emptyState}>
            記録がまだありません。
            <br />
            今日の体重を入れると、ここに推移と目標までの進捗が出ます。
          </p>
          <div className={ui.btnRow}>
            <button type="button" className={`${ui.btn} ${ui.btnPrimary}`} onClick={onOpenRecords}>
              記録する
            </button>
          </div>
        </section>
      ) : (
        <>
          <p className={ui.sectionLabel}>体組成</p>
          <Hero
            weight={stats.currentWeight}
            delta={stats.weightDelta}
            spark={spark}
            lean={stats.currentLeanMass}
            leanDelta={stats.leanMassDelta}
            leanSpark={leanSpark}
            caption={caption}
          />
          <GoalMeter
            settings={data.settings}
            stats={stats}
            projection={projection}
            onOpenSettings={onOpenSettings}
          />
          <StatTiles stats={stats} />
        </>
      )}

      {trainingStats.sessions > 0 && <p className={ui.sectionLabel}>トレーニング</p>}
      <TrainingSummary sessions={sessions} stats={trainingStats} goals={data.groupGoals} />

      {trainingStats.sessions > 0 && (
        <TrainingGoals goals={trainingGoals} stats={trainingStats} onOpenGoals={onOpenGoals} />
      )}

      {daily.length > 0 && (
        <>
          <p className={ui.sectionLabel}>実績</p>
          <StreakStrip daily={daily} stats={stats} trainingDates={trainingDates} />
          <BadgeGrid badges={computeBadges(stats, trainingStats)} />
        </>
      )}
    </>
  );
}
