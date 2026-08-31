import { useState } from 'react';
import { CatalogPicker } from './CatalogPicker';
import { Modal } from '../Modal';
import { useFabPosition } from './useFabPosition';
import { EXERCISE_GROUP_ORDER, GROUP_LABELS } from '../../lib/exerciseCatalog';
import {
  ExerciseFilterBar,
  FILTER_THRESHOLD,
  matchesGroup,
  matchesQuery,
} from './ExerciseFilterBar';
import type { Exercise, ExerciseGroup } from '../../types';
import ui from '../../styles/ui.module.scss';
import s from './training.module.scss';

interface Props {
  exercises: readonly Exercise[];
  usedIds: ReadonlySet<string>;
  /** その日に入れる／外すの切り替え。押すたびに増えることはない */
  onToggle: (id: string) => void;
  /** カタログからマイ種目への追加。置き場所は設定のままで、入口だけをここにも出す */
  onAddExercises: (exercises: readonly Exercise[]) => void;
}

/**
 * その日の種目を、マイ種目から選ぶ。
 *
 * モーダルで出す。ページに直接置くと、追加した種目のカードがピッカーより上に
 * 挿入されるぶんだけピッカーが下へ押し出され、続けて選ぶたびに
 * 指の下で一覧が動く（1 件ずつ閉じていた頃は起きなかった）。
 */
export function ExercisePicker({ exercises, usedIds, onToggle, onAddExercises }: Props) {
  const [open, setOpen] = useState(false);
  // 置き場所は動かせる。記録している最中に、指の下や読みたい行を塞ぐことがある
  const fab = useFabPosition();
  /*
   * カタログはダイアログを重ねず、**同じダイアログの面を差し替える**。
   * 同じ作業（今日の種目を決める）の続きなので、閉じたら元の面に戻るのが自然で、
   * 暗幕を二重にする理由も無い。重ねるのは「別の主題を参照しに行く」ときだけにする。
   */
  const [panel, setPanel] = useState<'exercises' | 'catalog'>('exercises');
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState<ExerciseGroup | 'all'>('all');

  /*
   * 非表示の種目は候補に出さない。
   * ただし **その日にすでに入っているもの** は出す（プリセットから入ることがある）。
   * 出さないと、ここで外せず閉じてカードの × を探すことになる。
   */
  const choices = exercises.filter((e) => !e.hidden || usedIds.has(e.id));
  const narrowed = choices.filter((e) => matchesGroup(e, group) && matchesQuery(e.name, query));

  const close = () => {
    setOpen(false);
    setPanel('exercises');
    /*
     * 絞り込みは開くたびに白紙に戻す。
     * 前に「腕」で絞ったまま次の日に開くと、種目が減ったように見える。
     * 探すための状態であって、この画面の設定ではない。
     */
    setQuery('');
    setGroup('all');
  };

  return (
    <>
      {/*
        画面の中に置いた追加ボタンは、種目カードが積み上がるほど上へ流れていく。
        記録している最中でも指の届く位置に、1 つだけ置く。
        **押したまま動かすと置き場所を変えられる**（片手で届く高さは人によって違うし、
        読みたい行を塞ぐこともある）。離すと左右どちらかの端に寄る。
      */}
      <button
        type="button"
        className={s.fab}
        aria-label="種目を追加"
        style={fab.style}
        onPointerDown={fab.onPointerDown}
        onPointerMove={fab.onPointerMove}
        onPointerUp={fab.onPointerUp}
        // 動かした指を離したときは、押した扱いにしない
        onClick={() => !fab.dragged() && setOpen(true)}
      >
        ＋
      </button>

      <Modal
        open={open}
        title={panel === 'catalog' ? 'マイ種目に追加' : 'マイ種目から選ぶ'}
        onClose={close}
        onBack={panel === 'catalog' ? () => setPanel('exercises') : undefined}
      >
        {panel === 'catalog' ? (
          <div>
            <CatalogPicker exercises={exercises} onAdd={onAddExercises} />
            <p className={ui.note}>
              削除と種目ごとの設定は、設定 &gt; トレーニング &gt; マイ種目 でまとめて行えます。
            </p>
          </div>
        ) : choices.length === 0 ? (
          /*
           * マイ種目が空のとき。以前は「設定 > トレーニング から追加してください」とだけ出していて、
           * 初めて開いた人がその場では何もできなかった。ここから追加できるようにする。
           */
          <div>
            <p className={ui.emptyState}>
              マイ種目がまだ空です。
              <br />
              カタログから、自分がやる種目を選んでください。
            </p>
            <div className={ui.btnRow}>
              <button
                type="button"
                className={`${ui.btn} ${ui.btnPrimary}`}
                onClick={() => setPanel('catalog')}
              >
                ＋ マイ種目に追加
              </button>
            </div>
          </div>
        ) : (
          <div>
            {choices.length > FILTER_THRESHOLD && (
              <ExerciseFilterBar
                query={query}
                onQuery={setQuery}
                group={group}
                onGroup={setGroup}
                exercises={choices}
              />
            )}

            {narrowed.length === 0 && (
              <p className={ui.emptyState}>このフィルターに合う種目はありません。</p>
            )}

            {EXERCISE_GROUP_ORDER.map((g) => {
              const items = narrowed.filter((e) => e.group === g);
              if (items.length === 0) return null;
              return (
                <div key={g} className={s.pickerGroup}>
                  <div className={s.pickerLabel}>{GROUP_LABELS[g]}</div>
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
                onClick={() => setPanel('catalog')}
              >
                ＋ マイ種目を増やす
              </button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
