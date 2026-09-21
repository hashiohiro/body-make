import { DateField } from './DateField';
import { Button } from './Button';
import { useState } from 'react';
import { NumericInput } from './NumericInput';
import { formatRelativeDays, formatYMD, todayISO, diffDays } from '../lib/date';
import { fmt, fmtDelta, fmtPercent } from '../lib/format';
import { BODYFAT_RANGE, WEIGHT_RANGE } from '../lib/storage';
import type { Projection, Settings, Stats } from '../types';
import { Meter } from './Meter';
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
  const [editing, setEditing] = useState(false);
  const target = settings.targetWeight;
  const current = stats.currentWeight;

  const editor = (
    <div className={s.editor}>
      <div className={ui.formRow}>
        <label htmlFor="target-weight">
          目標体重
          <small>到達予測と進捗バーの基準になります</small>
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
        <label htmlFor="target-bf">目標体脂肪率</label>
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
          目標日
          <small>必要ペースを逆算します</small>
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
      {settings.heightCm == null && (
        <p className={ui.note}>設定 &gt; 体組成 で身長を入れると、BMI が出ます。</p>
      )}
    </div>
  );

  if (target == null || current == null) {
    return (
      <section className={ui.card}>
        {!editing && (
          <p className={ui.emptyState}>
            {target == null
              ? '目標体重を決めると、到達予測日と進捗バーが出ます。'
              : '体重を記録すると、目標までの進捗が出ます。'}
          </p>
        )}

        {editing && editor}

        <div className={ui.btnRow}>
          <Button
            tone={editing ? 'ghost' : 'primary'}
            expanded={editing}
            onClick={() => setEditing((v) => !v)}
          >
            {editing ? '閉じる' : target == null ? '目標を決める' : '目標を変更'}
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
        <span>目標まで あと {fmt(Math.max(0, remaining))} kg</span>
        <span className={s.pct}>{fmtPercent(progress)}</span>
      </div>

      <Meter value={progress} label="目標体重までの進捗" size="card" tinted animated />

      <div className={s.foot}>
        <span>開始 {fmt(stats.startWeight)}kg</span>
        <span>目標 {fmt(target)}kg</span>
      </div>

      <div className={s.eta}>
        <div className={s.etaRow}>
          <span>現在のペース（直近28日）</span>
          <span>
            <b>{fmtDelta(pace, 2)}</b>
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
              <b>{fmtDelta(projection.requiredPerWeek, 2)}</b>
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

        {settings.heightCm != null && stats.bmi != null && (
          <div className={s.etaRow}>
            <span>BMI（身長 {fmt(settings.heightCm, 0)}cm）</span>
            <span>
              <b>{fmt(stats.bmi)}</b>
            </span>
          </div>
        )}
      </div>

      {settings.targetDate && diffDays(settings.targetDate, todayISO()) <= 0 && (
        <p className={ui.note}>目標日を過ぎています。次の期限を決め直しましょう。</p>
      )}

      {editing && editor}

      <div className={ui.btnRow}>
        <Button
          tone={editing ? 'ghost' : undefined}
          expanded={editing}
          onClick={() => setEditing((v) => !v)}
        >
          {editing ? '閉じる' : '目標を変更'}
        </Button>
      </div>
    </section>
  );
}
