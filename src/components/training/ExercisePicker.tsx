import { useState } from 'react';
import { Modal } from '../Modal';
import { GROUP_LABELS, GROUP_ORDER } from '../../lib/exerciseCatalog';
import type { Exercise } from '../../types';
import ui from '../../styles/ui.module.scss';
import s from './training.module.scss';

interface Props {
  exercises: readonly Exercise[];
  usedIds: ReadonlySet<string>;
  /** その日に入れる／外すの切り替え。押すたびに増えることはない */
  onToggle: (id: string) => void;
}

/**
 * その日の種目を選ぶ。
 *
 * モーダルで出す。ページに直接置くと、追加した種目のカードがピッカーより上に
 * 挿入されるぶんだけピッカーが下へ押し出され、続けて選ぶたびに
 * 指の下で一覧が動く（1 件ずつ閉じていた頃は起きなかった）。
 */
export function ExercisePicker({ exercises, usedIds, onToggle }: Props) {
  const [open, setOpen] = useState(false);

  if (exercises.length === 0) {
    return (
      <p className={ui.emptyState}>
        種目がありません。設定 &gt; トレーニング から追加してください。
      </p>
    );
  }

  return (
    <>
      <div className={ui.btnRow}>
        <button
          type="button"
          className={`${ui.btn} ${ui.btnPrimary}`}
          onClick={() => setOpen(true)}
        >
          ＋ 種目を追加
        </button>
        {usedIds.size > 0 && <span className={ui.hint}>この日 {usedIds.size}種目</span>}
      </div>

      <Modal open={open} title="種目を追加" onClose={() => setOpen(false)}>
        <div>
          {GROUP_ORDER.map((group) => {
            const items = exercises.filter((e) => e.group === group);
            if (items.length === 0) return null;
            return (
              <div key={group} className={s.pickerGroup}>
                <div className={s.pickerLabel}>{GROUP_LABELS[group]}</div>
                <div className={s.pickerList}>
                  {items.map((e) => {
                    const used = usedIds.has(e.id);
                    return (
                      <button
                        key={e.id}
                        type="button"
                        className={s.pickerBtn}
                        aria-pressed={used}
                        // ✓ はトグル。押しても外れないと、間違えて入れたものを
                        // ここで取り消せず、閉じてカードの × を探すことになる
                        onClick={() => onToggle(e.id)}
                      >
                        {used ? '✓ ' : '＋ '}
                        {e.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </Modal>
    </>
  );
}
