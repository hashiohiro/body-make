import { sameSet } from '../../lib/array';
import { useState } from 'react';
import { Modal } from '../Modal';
import { PresetCard } from './PresetCard';
import type { PresetOption } from './PresetCard';
import type { Preset } from '../../types';
import { RecoveryDialog, recoverySummary } from './Recovery';
import type { CheckHistory } from '../../lib/check';
import s from './training.module.scss';

interface Props {
  date: string;
  history: CheckHistory;
  presets: readonly PresetOption[];
  currentIds: readonly string[];
  currentName: string;
  /** その日を作った元のプリセット。呼び出していなければ null */
  applied: PresetOption | null;
  onSave: (name: string, exerciseIds: readonly string[]) => void;
  onUpdate: (preset: Preset) => void;
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
 * プリセットの入口が持つのは**保存だけ**。呼び出しは ＋ がやる（同じ一覧を
 * 2 か所に置かない）。代わりに **未保存であることを帯に出して**、
 * 「保存できることに気づけない」（design-training.md §7.2）を受ける。
 */
export function TrainingAside({
  date,
  history,
  presets,
  currentIds,
  currentName,
  applied,
  onSave,
  onUpdate,
}: Props) {
  const [open, setOpen] = useState<'recovery' | 'presets' | null>(null);

  const composing = currentIds.length > 0;
  /*
   * **出すのは保存の状態だけ。**呼び出しは ＋ がやるので、ここに件数を出しても
   * 押す理由にならない（押した先に一覧は無い）。
   */
  const unsaved = composing && !presets.some((p) => sameSet(p.exerciseIds, currentIds));
  const presetValue = !composing ? '—' : unsaved ? '未保存' : '保存済み';

  return (
    <>
      <section className={s.aside}>
        <button
          type="button"
          className={s.asideItem}
          aria-label="回復の状態を見る"
          onClick={() => setOpen('recovery')}
        >
          {/* 出しているのは回復した部位だけなので、見出しでそう言う（値は名前だけ） */}
          <span className={s.asideLabel}>回復済み</span>
          <span className={s.asideValue}>{recoverySummary(history, date)}</span>
          <span className={s.asideChevron} aria-hidden="true">
            ›
          </span>
        </button>

        <button
          type="button"
          className={s.asideItem}
          aria-label="プリセットを開く"
          onClick={() => setOpen('presets')}
        >
          <span className={s.asideLabel}>プリセット</span>
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
        <Modal open title="プリセット" onClose={() => setOpen(null)}>
          <PresetCard
            presets={presets}
            currentIds={currentIds}
            currentName={currentName}
            applied={applied}
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
