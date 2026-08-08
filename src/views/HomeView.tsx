import { BadgeGrid } from '../components/BadgeGrid';
import { GoalMeter } from '../components/GoalMeter';
import { Hero } from '../components/Hero';
import { QuickEntry } from '../components/QuickEntry';
import { StatTiles } from '../components/StatTiles';
import { StreakStrip } from '../components/StreakStrip';
import { computeBadges } from '../lib/badges';
import { formatMD } from '../lib/date';
import type { BodyData } from '../hooks/useBodyData';
import ui from '../styles/ui.module.scss';

interface Props {
  body: BodyData;
  date: string;
  onDateChange: (date: string) => void;
  onOpenSettings: () => void;
}

const SPARK_DAYS = 30;

export function HomeView({ body, date, onDateChange, onOpenSettings }: Props) {
  const { daily, stats, projection, data, setValue } = body;

  const spark = daily
    .slice(-SPARK_DAYS)
    .filter((p) => p.maWeight != null)
    .map((p) => ({ t: p.time, v: p.maWeight! }));

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
            下のフォームから今日の体重を入れると、ここに推移と目標までの進捗が出ます。
          </p>
        </section>
      ) : (
        <>
          <Hero weight={stats.currentWeight} delta={stats.weightDelta} spark={spark} caption={caption} />
          <GoalMeter
            settings={data.settings}
            stats={stats}
            projection={projection}
            onOpenSettings={onOpenSettings}
          />
          <StatTiles stats={stats} />
        </>
      )}

      <QuickEntry
        date={date}
        entries={data.entries}
        daily={daily}
        onDateChange={onDateChange}
        onValue={setValue}
      />

      {daily.length > 0 && (
        <>
          <StreakStrip daily={daily} stats={stats} />
          <BadgeGrid badges={computeBadges(stats)} />
        </>
      )}
    </>
  );
}
