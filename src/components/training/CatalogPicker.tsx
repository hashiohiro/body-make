import { useState } from 'react';
import {
  CATALOG,
  GROUP_LABELS,
  GROUP_ORDER,
  IMPLEMENT_LABELS,
  catalogId,
  fromCatalog,
} from '../../lib/exerciseCatalog';
import type { CatalogEntry, Implement } from '../../lib/exerciseCatalog';
import type { Exercise, MuscleGroup } from '../../types';
import ui from '../../styles/ui.module.scss';
import s from './training.module.scss';

/**
 * カタログの絞り込み。器具を選べる種目は、選んだ器具で登録される。
 *
 * バーベルとマシンを分けられないのは、種目が持っているのが「負荷の数え方」だけで
 * 器具の名前を持っていないため（standard に両方が入る）。
 * 分けられないものを分かれているように見せないよう、ラベルもまとめてある。
 */
type CatalogFilter = 'all' | 'barbell' | 'dumbbell' | 'bodyweight';

const CATALOG_FILTERS: { id: CatalogFilter; label: string }[] = [
  { id: 'all', label: 'すべて' },
  { id: 'barbell', label: 'バーベル・マシン' },
  { id: 'dumbbell', label: 'ダンベル' },
  { id: 'bodyweight', label: '自重' },
];

/**
 * カタログの 1 行と、それを登録するときの器具の組。
 *
 * バーベルとダンベルを選べる種目は 2 つに展開する。
 * 絞り込みで器具を兼ねると「すべて」で片方しか出せない
 * （＝すべてなのに全部出ない）ので、行のほうを分ける。
 */
interface CatalogChoice {
  entry: CatalogEntry;
  implement: Implement;
}

const CATALOG_CHOICES: CatalogChoice[] = CATALOG.flatMap((entry) =>
  entry.implements
    ? entry.implements.map((implement) => ({ entry, implement }))
    : [{ entry, implement: 'barbell' as Implement }],
);

function matchesFilter({ entry, implement }: CatalogChoice, filter: CatalogFilter): boolean {
  switch (filter) {
    case 'all':
      return true;
    // loadMode は重量の換算方法であって器具ではないので、ここでは一切見ない
    case 'barbell':
      return entry.implements ? implement === 'barbell' : entry.equipment == null;
    case 'dumbbell':
      return entry.implements ? implement === 'dumbbell' : entry.equipment === 'dumbbell';
    case 'bodyweight':
      return entry.implements ? implement === 'bodyweight' : entry.equipment === 'bodyweight';
  }
}

interface Props {
  exercises: readonly Exercise[];
  onAdd: (exercises: readonly Exercise[]) => void;
}

/**
 * カタログから種目を追加する。
 *
 * 設定タブのマイ種目と、記録タブの種目ピッカーの両方から使う。
 * マイ種目の置き場所は設定のままだが、入口が設定にしか無いと、
 * 初めて記録タブを開いた人が「設定から追加してください」で行き止まる。
 */
export function CatalogPicker({ exercises, onAdd }: Props) {
  const [filter, setFilter] = useState<CatalogFilter>('all');
  // 部位は主部位だけで絞る。一覧の見出しも主部位で切っているので、見え方が一致する
  const [group, setGroup] = useState<MuscleGroup | 'all'>('all');

  /*
   * 非表示にしてある種目は **まだ持っていない扱い** にして、ここに出す。
   * 「追加済み」として伏せると、戻す道がマイ種目の非表示欄しか無くなる。
   * 選び直したら表示に戻る（useBodyData.addExercises）。
   */
  const known = new Set(exercises.filter((e) => !e.hidden).map((e) => e.id));
  const notAdded = CATALOG_CHOICES.filter(
    (c) =>
      !known.has(catalogId(c.entry, c.implement)) &&
      matchesFilter(c, filter) &&
      (group === 'all' || c.entry.group === group),
  );
  const filtered = filter !== 'all' || group !== 'all';

  return (
    <div className={s.pickerGroup}>
      <div className={s.pickerLabel}>カタログから追加（{notAdded.length}件）</div>

      <div className={s.filters}>
        {/* ダンベルに切り替えて追加すれば、バーベル版と別種目として両方持てる */}
        <div className={s.pickerLabel} id="filter-implement">
          器具
        </div>
        <div
          className={`${ui.chipRow} ${s.filterRow}`}
          role="group"
          aria-labelledby="filter-implement"
        >
          {CATALOG_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              className={ui.chip}
              aria-pressed={filter === f.id}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className={s.pickerLabel} id="filter-group">
          部位
        </div>
        <div className={`${ui.chipRow} ${s.filterRow}`} role="group" aria-labelledby="filter-group">
          <button
            type="button"
            className={ui.chip}
            aria-pressed={group === 'all'}
            onClick={() => setGroup('all')}
          >
            すべて
          </button>
          {GROUP_ORDER.map((g) => (
            <button
              key={g}
              type="button"
              className={ui.chip}
              aria-pressed={group === g}
              onClick={() => setGroup(g)}
            >
              {GROUP_LABELS[g]}
            </button>
          ))}
        </div>
      </div>

      {notAdded.length === 0 ? (
        <p className={ui.note}>
          {filtered
            ? 'この絞り込みに合う種目はありません。'
            : 'カタログの種目はすべて追加済みです。'}
        </p>
      ) : (
        GROUP_ORDER.map((g) => {
          const items = notAdded.filter((c) => c.entry.group === g);
          if (items.length === 0) return null;
          return (
            <div key={g} className={s.pickerGroup}>
              <div className={s.pickerLabel}>{GROUP_LABELS[g]}</div>
              <div className={s.pickerList}>
                {items.map((c) => (
                  <button
                    key={catalogId(c.entry, c.implement)}
                    type="button"
                    className={s.pickerBtn}
                    onClick={() => onAdd([fromCatalog(c.entry, exercises.length, c.implement)])}
                  >
                    ＋ {c.entry.name}
                    {c.entry.implements && `（${IMPLEMENT_LABELS[c.implement]}）`}
                  </button>
                ))}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
