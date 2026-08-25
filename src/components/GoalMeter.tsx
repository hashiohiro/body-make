import { useState } from 'react';
import { NumericInput } from './NumericInput';
import { formatRelativeDays, formatYMD, todayISO, diffDays } from '../lib/date';
import { fmt, fmtPercent } from '../lib/format';
import { BODYFAT_RANGE, HEIGHT_RANGE, WEIGHT_RANGE } from '../lib/storage';
import type { Projection, Settings, Stats } from '../types';
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
        <input
          id="target-date"
          type="date"
          value={settings.targetDate ?? ''}
          onChange={(e) => onUpdate({ targetDate: e.target.value || null })}
        />
      </div>

      {/*
        身長そのものは目標ではないが、目標体重と BMI は同じ話題なので同じ面に置く。
        別の画面に分けると、身長を入れる理由が画面の中で完結しない
      */}
      <div className={ui.formRow}>
        <label htmlFor="height">
          身長
          <small>BMI の計算に使います（任意）</small>
        </label>
        <span className={ui.inputUnit}>
          <NumericInput
            id="height"
            value={settings.heightCm}
            min={HEIGHT_RANGE[0]}
            max={HEIGHT_RANGE[1]}
            placeholder="—"
            onCommit={(v) => onUpdate({ heightCm: v })}
          />
          <span>cm</span>
        </span>
      </div>
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
          <button
            type="button"
            className={`${ui.btn} ${editing ? ui.btnGhost : ui.btnPrimary}`}
            aria-expanded={editing}
            onClick={() => setEditing((v) => !v)}
          >
            {editing ? '閉じる' : target == null ? '目標を決める' : '目標を変更'}
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
            <b>{pace == null ? '—' : `${pace > 0 ? '+' : '−'}${Math.abs(pace).toFixed(2)}`}</b>
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

        {/* 身長を入れる理由をこの画面で完結させる。入れていなければ何も出さない */}
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
        <button
          type="button"
          className={`${ui.btn} ${editing ? ui.btnGhost : ''}`}
          aria-expanded={editing}
          onClick={() => setEditing((v) => !v)}
        >
          {editing ? '閉じる' : '目標を変更'}
        </button>
      </div>
    </section>
  );
}
