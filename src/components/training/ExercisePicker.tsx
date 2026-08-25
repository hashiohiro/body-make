import { useState } from 'react';
import { CatalogPicker } from './CatalogPicker';
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
  /** カタログからの追加。種目マスタの置き場所は設定のままで、入口だけをここにも出す */
  onAddExercises: (exercises: readonly Exercise[]) => void;
}

/**
 * その日の種目を選ぶ。
 *
 * モーダルで出す。ページに直接置くと、追加した種目のカードがピッカーより上に
 * 挿入されるぶんだけピッカーが下へ押し出され、続けて選ぶたびに
 * 指の下で一覧が動く（1 件ずつ閉じていた頃は起きなかった）。
 */
export function ExercisePicker({ exercises, usedIds, onToggle, onAddExercises }: Props) {
  const [open, setOpen] = useState(false);
  const [catalog, setCatalog] = useState(false);

  // 開いているときだけ置く。閉じた dialog を記録画面に常駐させない
  const catalogModal = catalog && (
    <Modal open title="種目を追加" onClose={() => setCatalog(false)}>
      <CatalogPicker exercises={exercises} onAdd={onAddExercises} />
      <p className={ui.note}>
        並べ替え・削除・種目ごとの設定は、設定 &gt; トレーニング でまとめて行えます。
      </p>
    </Modal>
  );

  return (
    <>
      {/*
        画面の中に置いた追加ボタンは、種目カードが積み上がるほど上へ流れていく。
        記録している最中でも指の届く位置に、1 つだけ置く。
      */}
      <button type="button" className={s.fab} aria-label="種目を追加" onClick={() => setOpen(true)}>
        ＋
      </button>

      <Modal open={open} title="種目を追加" onClose={() => setOpen(false)}>
        {exercises.length === 0 ? (
          /*
           * 種目マスタが空のとき。以前は「設定 > トレーニング から追加してください」とだけ出していて、
           * 初めて開いた人がその場では何もできなかった。ここから追加できるようにする。
           */
          <div>
            <p className={ui.emptyState}>
              まだ種目がありません。
              <br />
              カタログから、自分がやる種目を選んでください。
            </p>
            <div className={ui.btnRow}>
              <button
                type="button"
                className={`${ui.btn} ${ui.btnPrimary}`}
                onClick={() => {
                  setOpen(false);
                  setCatalog(true);
                }}
              >
                ＋ カタログから追加
              </button>
            </div>
          </div>
        ) : (
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

            {/* やる種目が増えたときの逃げ道。設定タブを探しに行かせない */}
            <div className={ui.btnRow}>
              <button
                type="button"
                className={`${ui.btn} ${ui.btnSm}`}
                onClick={() => {
                  setOpen(false);
                  setCatalog(true);
                }}
              >
                ＋ カタログから種目を増やす
              </button>
            </div>
          </div>
        )}
      </Modal>

      {catalogModal}
    </>
  );
}
