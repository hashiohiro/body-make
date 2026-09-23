import { DateField } from './DateField';
import { Strong } from './Strong';
import { Button } from './Button';
import { useState } from 'react';
import { NumericInput } from './NumericInput';
import { formatRelativeDays, formatYMD, todayISO, diffDays } from '../lib/date';
import { fmt, fmtDelta, fmtPercent } from '../lib/format';
import { BODYFAT_RANGE, WEIGHT_RANGE } from '../lib/storage';
import type { Projection, Settings, Stats } from '../types';
import { Meter } from './Meter';
import { useT } from '../lib/i18n';
import ui from '../styles/ui.module.scss';
import s from './GoalMeter.module.scss';

interface Props {
  settings: Settings;
  stats: Stats;
  projection: Projection;
  onUpdate: (patch: Partial<Settings>) => void;
}

/**
 * 体組成の目標と、その進捗。
 *
 * 目標値の編集をこのカードの中に持つ。設定タブへ飛ばすと、
 * 「あと 3.2kg」を見る場所と、その 3.2kg を決め直す場所が離れたままになる。
 */
export function GoalMeter({ settings, stats, projection, onUpdate }: Props) {
  const t = useT();
  const [editing, setEditing] = useState(false);
  const target = settings.targetWeight;
  const current = stats.currentWeight;

  const editor = (
    <div className={s.editor}>
      <div className={ui.formRow}>
        <label htmlFor="target-weight">
          {t('goal.targetWeight')}
          <small>{t('goal.targetWeightHint')}</small>
        </label>
        <span className={ui.inputUnit}>
          <NumericInput
            id="target-weight"
            value={settings.targetWeight}
            min={WEIGHT_RANGE[0]}
            max={WEIGHT_RANGE[1]}
            placeholder="—"
            onCommit={(v) => onUpdate({ targetWeight: v })}
          />
          <span>kg</span>
        </span>
      </div>

      <div className={ui.formRow}>
        <label htmlFor="target-bf">{t('goal.targetBodyFat')}</label>
        <span className={ui.inputUnit}>
          <NumericInput
            id="target-bf"
            value={settings.targetBodyFat}
            min={BODYFAT_RANGE[0]}
            max={BODYFAT_RANGE[1]}
            placeholder="—"
            onCommit={(v) => onUpdate({ targetBodyFat: v })}
          />
          <span>%</span>
        </span>
      </div>

      <div className={ui.formRow}>
        <label htmlFor="target-date">
          {t('goal.targetDate')}
          <small>{t('goal.targetDateHint')}</small>
        </label>
        {/* 目標日は外せる（決めていない状態がある）ので、空を受ける */}
        <DateField
          id="target-date"
          value={settings.targetDate ?? ''}
          clearable
          onChange={(value) => onUpdate({ targetDate: value || null })}
        />
      </div>

      {/*
        身長は**目標ではなく定義**なので、設定 &gt; 体組成 が持つ
        （伸びも縮みもしないものを、進捗を見ながら触る面に置かない）。
        ここに欄を作らないのは、同じ値を直す場所を 2 つにしないため。
        入れていない人には、どこにあるかだけ書く。
      */}
      {settings.heightCm == null && <p className={ui.note}>{t('goal.heightHint')}</p>}
    </div>
  );

  if (target == null || current == null) {
    return (
      <section className={ui.card}>
        {!editing && (
          <p className={ui.emptyState}>
            {target == null ? t('goal.needTarget') : t('goal.needRecord')}
          </p>
        )}

        {editing && editor}

        <div className={ui.btnRow}>
          <Button
            tone={editing ? 'ghost' : 'primary'}
            expanded={editing}
            onClick={() => setEditing((v) => !v)}
          >
            {editing ? t('common.close') : target == null ? t('goal.set') : t('goal.change')}
          </Button>
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
        <span>{t('goal.remaining', { n: fmt(Math.max(0, remaining)) })}</span>
        <span className={s.pct}>{fmtPercent(progress)}</span>
      </div>

      <Meter value={progress} label={t('goal.progressBar')} size="card" tinted animated />

      <div className={s.foot}>
        <span>{t('goal.start', { n: fmt(stats.startWeight) })}</span>
        <span>{t('goal.target', { n: fmt(target) })}</span>
      </div>

      <div className={s.eta}>
        <div className={s.etaRow}>
          <span>{t('goal.pace')}</span>
          <span>
            <Strong text={t('goal.perWeek')} values={[fmtDelta(pace, 2)]} />
          </span>
        </div>

        <div className={s.etaRow}>
          <span>{t('goal.eta')}</span>
          <span>
            {projection.etaDate && projection.etaDays != null ? (
              <>
                <b>{formatYMD(t, projection.etaDate)}</b>
                {`（${formatRelativeDays(t, projection.etaDays)}）`}
              </>
            ) : (
              <b>{t('goal.noEta')}</b>
            )}
          </span>
        </div>

        {settings.targetDate && projection.requiredPerWeek != null && (
          <div className={s.etaRow}>
            <span>{t('goal.requiredPace', { date: formatYMD(t, settings.targetDate) })}</span>
            <span>
              <b>{fmtDelta(projection.requiredPerWeek, 2)}</b>
              {t('goal.perWeek')}
            </span>
          </div>
        )}

        {settings.targetBodyFat != null && stats.currentBodyFat != null && (
          <div className={s.etaRow}>
            <span>{t('common.bodyFat')}</span>
            <span>
              <Strong
                text={t('goal.bodyFatProgress', { current: fmt(stats.currentBodyFat) })}
                values={[`${fmt(settings.targetBodyFat)}%`]}
              />
            </span>
          </div>
        )}

        {settings.heightCm != null && stats.bmi != null && (
          <div className={s.etaRow}>
            <span>{t('goal.bmi', { height: fmt(settings.heightCm, 0) })}</span>
            <span>
              <b>{fmt(stats.bmi)}</b>
            </span>
          </div>
        )}
      </div>

      {settings.targetDate && diffDays(settings.targetDate, todayISO()) <= 0 && (
        <p className={ui.note}>{t('goal.datePassed')}</p>
      )}

      {editing && editor}

      <div className={ui.btnRow}>
        <Button
          tone={editing ? 'ghost' : undefined}
          expanded={editing}
          onClick={() => setEditing((v) => !v)}
        >
          {editing ? t('common.close') : t('goal.change')}
        </Button>
      </div>
    </section>
  );
}
