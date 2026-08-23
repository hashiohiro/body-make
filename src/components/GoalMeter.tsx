import { formatRelativeDays, formatYMD, todayISO, diffDays } from '../lib/date';
import { fmt, fmtPercent } from '../lib/format';
import type { Projection, Settings, Stats } from '../types';
import ui from '../styles/ui.module.scss';
import s from './GoalMeter.module.scss';

interface Props {
  settings: Settings;
  stats: Stats;
  projection: Projection;
  onOpenSettings: () => void;
}

export function GoalMeter({ settings, stats, projection, onOpenSettings }: Props) {
  const target = settings.targetWeight;
  const current = stats.currentWeight;

  if (target == null || current == null) {
    return (
      <section className={ui.card}>
        <header className={ui.cardHeader}>
          <h2 className={ui.cardTitle}>目標</h2>
        </header>
        <p className={ui.emptyState}>
          目標体重を決めると、到達予測日と進捗バーが出ます。
        </p>
        <div className={ui.btnRow}>
          <button type="button" className={`${ui.btn} ${ui.btnPrimary}`} onClick={onOpenSettings}>
            目標を設定する
          </button>
        </div>
      </section>
    );
  }

  const remaining = current - target;
  const progress = projection.progress ?? 0;
  const pace = projection.pacePerWeek;

  return (
    <section className={ui.card}>
      <div className={s.head}>
        <span>目標まで あと {fmt(Math.max(0, remaining))} kg</span>
        <span className={s.pct}>{fmtPercent(progress)}</span>
      </div>

      <div
        className={s.track}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
        aria-label="目標体重までの進捗"
      >
        <i className={s.fill} style={{ width: `${Math.round(progress * 100)}%` }} />
      </div>

      <div className={s.foot}>
        <span>開始 {fmt(stats.startWeight)}kg</span>
        <span>目標 {fmt(target)}kg</span>
      </div>

      <div className={s.eta}>
        <div className={s.etaRow}>
          <span>現在のペース（直近28日）</span>
          <span>
            <b>
              {pace == null ? '—' : `${pace > 0 ? '+' : '−'}${Math.abs(pace).toFixed(2)}`}
            </b>
            {' kg/週'}
          </span>
        </div>

        <div className={s.etaRow}>
          <span>このペースでの到達</span>
          <span>
            {projection.etaDate && projection.etaDays != null ? (
              <>
                <b>{formatYMD(projection.etaDate)}</b>
                {`（${formatRelativeDays(projection.etaDays)}）`}
              </>
            ) : (
              <b>まだ予測できません</b>
            )}
          </span>
        </div>

        {settings.targetDate && projection.requiredPerWeek != null && (
          <div className={s.etaRow}>
            <span>{formatYMD(settings.targetDate)}までに必要なペース</span>
            <span>
              <b>
                {`${projection.requiredPerWeek > 0 ? '+' : '−'}${Math.abs(projection.requiredPerWeek).toFixed(2)}`}
              </b>
              {' kg/週'}
            </span>
          </div>
        )}

        {settings.targetBodyFat != null && stats.currentBodyFat != null && (
          <div className={s.etaRow}>
            <span>体脂肪率</span>
            <span>
              {`${fmt(stats.currentBodyFat)}% → 目標 `}
              <b>{fmt(settings.targetBodyFat)}%</b>
            </span>
          </div>
        )}
      </div>

      {settings.targetDate && diffDays(settings.targetDate, todayISO()) <= 0 && (
        <p className={ui.note}>目標日を過ぎています。設定から次の期限を決め直しましょう。</p>
      )}
    </section>
  );
}
