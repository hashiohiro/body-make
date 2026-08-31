import { Fragment } from 'react';
import { GROUP_LABELS } from '../../lib/exerciseCatalog';
import type { ExerciseGroup } from '../../types';
import s from './training.module.scss';

export interface OrderEntry {
  id: string;
  name: string;
  /** 種目の分類（有酸素を含む）。マイ種目から消えた種目を指している行では null */
  group: ExerciseGroup | null;
}

/**
 * from 番目のものを、to の位置（元の並びでの挿入点 0〜n）へ移す。
 * to が from と同じか、その 1 つ後ろなら並びは変わらない（呼ぶ前に弾く）。
 */
export function move(ids: readonly string[], from: number, to: number): string[] {
  const next = [...ids];
  const [id] = next.splice(from, 1);
  next.splice(from < to ? to - 1 : to, 0, id!);
  return next;
}

interface Props {
  entries: readonly OrderEntry[];
  /** 掴んでいる種目の id。掴んでいなければ null */
  movingId: string | null;
  /** 読み上げに出す持ち主の呼び名（「押す日のスクワットを移動」） */
  label: string;
  onGrab: (id: string) => void;
  onCancel: () => void;
  onReorder: (ids: string[]) => void;
  /** − を出すなら渡す。記録画面は外すのがカードの × なので渡さない */
  onDrop?: ((id: string) => void) | undefined;
}

/**
 * 並びを持つ種目の一覧。**掴んでから置き場所をタップ**して動かす。
 *
 * ↑↓ にしない。押した行が動くので、1 つ動かすたびに指を狙い直すことになる。
 * 掴む方式なら、掴んだあと行は動かず、距離によらず 2 タップで終わる。
 *
 * プリセットの中身（設定）と、その日の種目（記録画面）の両方で使う。
 * 同じことをする場所が 2 つあるので、操作も見た目も 1 つの部品に持たせる。
 */
export function OrderList({
  entries,
  movingId,
  label,
  onGrab,
  onCancel,
  onReorder,
  onDrop,
}: Props) {
  const ids = entries.map((e) => e.id);
  const from = movingId == null ? -1 : ids.indexOf(movingId);
  const movingName = from >= 0 ? entries[from]!.name : '';

  /**
   * 置き場所。いまと同じ並びになる位置には出さない
   * （押しても何も起きないボタンを置かない）。
   */
  const slot = (to: number) => {
    if (from < 0 || to === from || to === from + 1) return null;
    return (
      <button
        type="button"
        className={s.orderSlot}
        aria-label={
          to === 0 ? `${movingName}を先頭へ` : `${movingName}を${entries[to - 1]!.name}の後ろへ`
        }
        onClick={() => onReorder(move(ids, from, to))}
      >
        ここへ
      </button>
    );
  };

  return (
    <>
      {entries.map((entry, i) => (
        <Fragment key={entry.id}>
          {slot(i)}

          {i === from ? (
            <div className={`${s.orderItem} ${s.orderItemMoving}`}>
              <span className={s.orderItemName}>{movingName} を移動中</span>
              <button
                type="button"
                className={s.miniBtn}
                aria-label="移動をやめる"
                onClick={onCancel}
              >
                やめる
              </button>
            </div>
          ) : (
            <div className={s.orderItem}>
              {/* 並びはやる順番。番号を出しておけば、掴む前に現状が読める */}
              <span className={s.orderIndex}>{i + 1}</span>
              <span className={s.orderItemName}>{entry.name}</span>

              {/* 移動中は、置き場所を選ぶこと以外を出さない */}
              {from < 0 && (
                <>
                  <span className={s.exTag}>{entry.group ? GROUP_LABELS[entry.group] : ''}</span>
                  {entries.length > 1 && (
                    <button
                      type="button"
                      className={s.miniBtn}
                      aria-label={`${label}の${entry.name}を移動`}
                      onClick={() => onGrab(entry.id)}
                    >
                      ⇅
                    </button>
                  )}
                  {onDrop && (
                    <button
                      type="button"
                      className={s.miniBtn}
                      aria-label={`${label}から${entry.name}を外す`}
                      onClick={() => onDrop(entry.id)}
                    >
                      −
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </Fragment>
      ))}

      {slot(entries.length)}
    </>
  );
}
