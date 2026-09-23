import { NumericInput } from '../NumericInput';
import { Strong } from '../Strong';
import { describeKey } from '../../lib/check';
import { MINUTES_PER_SET_RANGE, SESSION_MINUTES_RANGE } from '../../lib/storage';
import type { CheckSettings, Exercise } from '../../types';
import { CardHeader } from '../CardHeader';
import { Pill } from '../Pill';
import { Button } from '../Button';
import ui from '../../styles/ui.module.scss';
import s from './training.module.scss';
import { useT } from '../../lib/i18n';

interface Props {
  checks: CheckSettings;
  suppressed: readonly string[];
  exercises: readonly Exercise[];
  onUpdate: (patch: Partial<CheckSettings>) => void;
  onUnsuppress: (key: string) => void;
}

/**
 * トレーニング種目のレビューの設定（設定 &gt; トレーニング &gt; トレーニング種目のレビュー）。
 *
 * ここに置くのは滅多に変えない定義だけ、という設定タブの規則に従う。
 * 指摘そのもの（何が引っかかっているか）は記録画面とプリセット画面にある。
 *
 * **既定は無効。** 負荷値も所要時間も、入れ終わるまでは判定が当たらない。
 * 勝手に出はじめると「よく分からない指摘が出るもの」として最初に閉じられる。
 */
export function CheckSettingsForm({
  checks,
  suppressed,
  exercises,
  onUpdate,
  onUnsuppress,
}: Props) {
  const t = useT();
  return (
    <>
      <section className={ui.card}>
        <div className={ui.formRow}>
          <label id="check-enabled">{t('checks.show')}</label>
          <Pill
            pressed={checks.enabled}
            label={t('checks.show')}
            onClick={() => onUpdate({ enabled: !checks.enabled })}
          >
            {checks.enabled ? t('settings.on') : t('settings.off')}
          </Pill>
        </div>
        <p className={ui.note}>
          <Strong text={t('checks.showNote')} values={[t('checks.needAxial')]} />
          <br />
          <Strong text={t('checks.datesOnlyNote')} values={[t('checks.datesOnly')]} />
        </p>
      </section>

      {checks.enabled && (
        <>
          <section className={ui.card}>
            <CardHeader title={t('checks.sessionLength')} />

            <div className={s.checkFields}>
              <label className={s.newField}>
                {t('checks.limitMinutes')}
                <small>{t('checks.limitHint')}</small>
                <NumericInput
                  id="check-session-minutes"
                  value={checks.sessionMinutes}
                  min={SESSION_MINUTES_RANGE[0]}
                  max={SESSION_MINUTES_RANGE[1]}
                  step={5}
                  placeholder={t('checks.noLimit')}
                  onCommit={(v) => onUpdate({ sessionMinutes: v })}
                />
              </label>
              <label className={s.newField}>
                {t('exSettings.minutesPerSet')}
                <small>{t('checks.perSetHint')}</small>
                <NumericInput
                  id="check-minutes-per-set"
                  value={checks.minutesPerSet}
                  min={MINUTES_PER_SET_RANGE[0]}
                  max={MINUTES_PER_SET_RANGE[1]}
                  step={0.5}
                  onCommit={(v) => onUpdate({ minutesPerSet: v ?? checks.minutesPerSet })}
                />
              </label>
            </div>

            {/* 80 文字以内。何をどう数えるか → だからこの出し方、だけを言う */}
            <p className={ui.note}>{t('checks.timeNote')}</p>
          </section>

          <section className={ui.card}>
            <CardHeader
              title={t('checks.suppressed')}
              hint={<>{t('settings.count', { n: suppressed.length })}</>}
            />

            {suppressed.length === 0 ? (
              <p className={ui.emptyState}>
                {t('checks.noneYet')}
                <br />
                {t('checks.noneYetHint')}
              </p>
            ) : (
              suppressed.map((key) => (
                <div key={key} className={s.suppressRow}>
                  <span className={s.suppressName}>{describeKey(t, key, exercises)}</span>
                  <Button
                    tone="ghost"
                    size="sub"
                    label={t('checks.unsuppressOf', { name: describeKey(t, key, exercises) })}
                    onClick={() => onUnsuppress(key)}
                  >
                    {t('checks.undo')}
                  </Button>
                </div>
              ))
            )}

            <p className={ui.note}>{t('checks.suppressNote')}</p>
          </section>
        </>
      )}
    </>
  );
}
