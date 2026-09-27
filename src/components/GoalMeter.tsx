import { DateField } from './DateField';
import { Button } from './Button';
import { useState } from 'react';
import { NumericInput } from './NumericInput';
import { formatMD, formatRelativeDays, formatYMD, todayISO, diffDays } from '../lib/date';
import { fmt, fmtPercent } from '../lib/format';
import { BODYFAT_RANGE, WEIGHT_RANGE } from '../lib/storage';
import type { Projection, Settings, Stats } from '../types';
import { Meter } from './Meter';
import { Modal } from './Modal';
import { PacePanel } from './pace/PacePanel';
import { paceGap } from '../lib/pace';
import type { PaceLine } from '../lib/pace';
import { useT } from '../lib/i18n';
import ui from '../styles/ui.module.scss';
import s from './GoalMeter.module.scss';

interface Props {
  settings: Settings;
  stats: Stats;
  projection: Projection;
  onUpdate: (patch: Partial<Settings>) => void;
  /** 目標日までの小さな図（`paceLine`）。出せなければ null */
  line: PaceLine | null;
}

/**
 * 体組成の目標と、その進捗。
 *
 * 目標値の編集をこのカードの中に持つ。設定タブへ飛ばすと、
 * 「あと 3.2kg」を見る場所と、その 3.2kg を決め直す場所が離れたままになる。
 */
export function GoalMeter({ settings, stats, projection, onUpdate, line }: Props) {
  const t = useT();
  const [editing, setEditing] = useState(false);
  /*
   * 開始日。**決めていなければ最初の記録の日**（開始値もそこから取っている。`startValues`）。
   * 保存は決めたときだけ——既定のままなら null で持ち、記録を遡って足せば既定も一緒に動く。
   */
  const firstDate = stats.first?.date ?? null;
  const startDate = settings.startDate ?? firstDate;
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

      <div className={ui.formRow}>
        <label htmlFor="start-date">
          {t('goal.startDate')}
          <small>{t('goal.startDateHint')}</small>
        </label>
        {/* 決めていなければ、記録の最初の日から（空を受ける） */}
        <DateField
          id="start-date"
          value={startDate ?? ''}
          // 既定（最初の記録の日）と同じ日を選び直したら、決めていない状態に戻す
          clearable={settings.startDate != null}
          onChange={(value) =>
            onUpdate({ startDate: !value || value === firstDate ? null : value })
          }
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

  /*
   * 目標値の編集は**ダイアログで開く。**以前はカードの下に広げていたが、
   * 開くたびに下のカードが押し下げられ、閉じると戻る——読んでいた場所が動く。
   * 種目・部位の目標と同じく、決める面は重ねて出す。
   */
  const dialog = (
    <Modal open={editing} title={t('goal.change')} onClose={() => setEditing(false)}>
      {editor}
    </Modal>
  );

  if (target == null || current == null) {
    return (
      <section className={ui.card}>
        <p className={ui.emptyState}>
          {target == null ? t('goal.needTarget') : t('goal.needRecord')}
        </p>

        <div className={ui.btnRow}>
          <Button tone="primary" onClick={() => setEditing(true)}>
            {target == null ? t('goal.set') : t('goal.change')}
          </Button>
        </div>
        {dialog}
      </section>
    );
  }

  const remaining = current - target;
  const progress = projection.progress ?? 0;

  return (
    <section className={ui.card}>
      <div className={s.head}>
        <span>{t('goal.remaining', { n: fmt(Math.max(0, remaining)) })}</span>
        <span className={s.pct}>{fmtPercent(progress)}</span>
      </div>

      <Meter value={progress} label={t('goal.progressBar')} size="card" tinted animated />

      <div className={s.foot}>
        <span>
          {startDate
            ? t('goal.startOn', { date: formatMD(startDate), n: fmt(stats.startWeight) })
            : t('goal.start', { n: fmt(stats.startWeight) })}
        </span>
        <span>{t('goal.target', { n: fmt(target) })}</span>
      </div>

      {/*
        実績と必要のペースは 1 本の軸で出す（`docs/design-pace.md`）。
        以前はここに文字で 2 行並べていた。値が揃わなくても枠は出し、空の側に入れ方を添える。
      */}
      <PacePanel gap={paceGap(projection)} line={line} targetDate={settings.targetDate} />

      <div className={s.eta}>
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

        {/* 体脂肪率の目標は「目標の体組成」のカードが棒で出す（同じ値を 2 か所に出さない） */}
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

      <div className={ui.btnRow}>
        <Button onClick={() => setEditing(true)}>{t('goal.change')}</Button>
      </div>
      {dialog}
    </section>
  );
}
