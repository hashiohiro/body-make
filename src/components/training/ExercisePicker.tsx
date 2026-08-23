import { useState } from 'react';
import { Modal } from '../Modal';
import { GROUP_LABELS, GROUP_ORDER } from '../../lib/exerciseCatalog';
import type { Exercise } from '../../types';
import ui from '../../styles/ui.module.scss';
import s from './training.module.scss';

interface Props {
  exercises: readonly Exercise[];
  usedIds: ReadonlySet<string>;
  /** すでにその日にある種目を選んだときは、重複を作らず既存カードへ移動する */
  onPick: (id: string) => void;
}

/**
 * その日の種目を選ぶ。
 *
 * モーダルで出す。ページに直接置くと、追加した種目のカードがピッカーより上に
 * 挿入されるぶんだけピッカーが下へ押し出され、続けて選ぶたびに
 * 指の下で一覧が動く（1 件ずつ閉じていた頃は起きなかった）。
 */
export function ExercisePicker({ exercises, usedIds, onPick }: Props) {
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
                        onClick={() => {
                          // すでにその日にある種目を選ぶのは「そのカードへ行く」操作。
                          // 行き先はモーダルの背面にあるので閉じる
                          if (used) setOpen(false);
                          onPick(e.id);
                        }}
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
