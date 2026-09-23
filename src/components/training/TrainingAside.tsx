import { sameSet } from '../../lib/array';
import { useState } from 'react';
import { Modal } from '../Modal';
import { PresetCard } from './PresetCard';
import type { PresetOption } from './PresetCard';
import type { Preset } from '../../types';
import { RecoveryDialog, recoverySummary } from './Recovery';
import type { CheckHistory } from '../../lib/check';
import s from './training.module.scss';
import { useT } from '../../lib/i18n';

interface Props {
  date: string;
  history: CheckHistory;
  presets: readonly PresetOption[];
  currentIds: readonly string[];
  currentName: string;
  /** その日を作った元のプリセット。呼び出していなければ null */
  applied: PresetOption | null;
  /** 開いている日の週メニュー。まだ空の日は、一覧の先頭に別枠で出す */
  todayMenu: PresetOption | null;
  onSave: (name: string, exerciseIds: readonly string[]) => void;
  onUpdate: (preset: Preset) => void;
  /** 組み合わせをまとめてその日に入れる。まだ空の日にだけ使う */
  onApplyPreset: (preset: PresetOption) => void;
}

/**
 * 記録を組むための補助を、**1 行の帯にまとめる。**
 *
 * 回復もプリセットも、種目を打ちはじめる前に見るもので、打っている最中は用が済んでいる。
 * それぞれをカードで積むと、種目カードに届くまでのスクロールがそのぶん伸びる。
 *
 * **帯は入口であると同時に要約。**開かなくても「どこが回復しているか」
 * 「いまの組み合わせが保存済みか」が読める。
 *
 * プリセットの入口は**その日の状態で役割が変わる**。まだ空なら呼び出しの一覧、
 * 組んであれば保存の面（`PresetCard`）。同時に両方は出ないので、＋ の
 * 「プリセットから入れる」と一覧が 2 か所に見える瞬間はない。
 *
 * 帯の値は**その状態をそのまま言う**。空の日は持っている件数（押す理由がある）、
 * 組んだあとは保存済みかどうか——「保存できることに気づけない」
 * （design-training.md §7.2）を受けるのは後者。
 */
export function TrainingAside({
  date,
  history,
  presets,
  currentIds,
  currentName,
  applied,
  todayMenu,
  onSave,
  onUpdate,
  onApplyPreset,
}: Props) {
  const [open, setOpen] = useState<'recovery' | 'presets' | null>(null);

  const t = useT();
  const composing = currentIds.length > 0;
  /*
   * **押した先にあるものを言う。**まだ空の日は一覧が出るので件数を、
   * 組んだあとは保存の面が出るので保存の状態を出す。
   * 一度は空の日を「—」にしていたが、その頃は押した先に一覧が無かった。
   */
  const unsaved = composing && !presets.some((p) => sameSet(p.exerciseIds, currentIds));
  const pickable = presets.length + (todayMenu ? 1 : 0);
  const presetValue = !composing
    ? pickable === 0
      ? '—'
      : t('settings.count', { n: pickable })
    : unsaved
      ? t('aside.unsaved')
      : t('aside.saved');

  return (
    <>
      <section className={s.aside}>
        <button
          type="button"
          className={s.asideItem}
          aria-label={t('aside.recovery')}
          onClick={() => setOpen('recovery')}
        >
          {/* 出しているのは回復した部位だけなので、見出しでそう言う（値は名前だけ） */}
          <span className={s.asideLabel}>{t('aside.recovered')}</span>
          <span className={s.asideValue}>
            {recoverySummary(t, history, date) ?? t('recovery.none')}
          </span>
          <span className={s.asideChevron} aria-hidden="true">
            ›
          </span>
        </button>

        <button
          type="button"
          className={s.asideItem}
          aria-label={t('aside.presets')}
          onClick={() => setOpen('presets')}
        >
          <span className={s.asideLabel}>{t('settings.presets')}</span>
          <span className={`${s.asideValue} ${unsaved ? s.asideAlert : ''}`}>{presetValue}</span>
          <span className={s.asideChevron} aria-hidden="true">
            ›
          </span>
        </button>
      </section>

      <RecoveryDialog
        open={open === 'recovery'}
        onClose={() => setOpen(null)}
        date={date}
        history={history}
      />

      {open === 'presets' && (
        <Modal open title={t('settings.presets')} onClose={() => setOpen(null)}>
          <PresetCard
            presets={presets}
            currentIds={currentIds}
            currentName={currentName}
            applied={applied}
            todayMenu={todayMenu}
            onApply={(preset) => {
              onApplyPreset(preset);
              setOpen(null);
            }}
            onUpdate={(preset) => {
              onUpdate(preset);
              setOpen(null);
            }}
            onSave={(name, ids) => {
              onSave(name, ids);
              setOpen(null);
            }}
          />
        </Modal>
      )}
    </>
  );
}
