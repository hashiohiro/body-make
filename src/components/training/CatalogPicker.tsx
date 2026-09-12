import { useState } from 'react';
import {
  CATALOG_CHOICES,
  EXERCISE_GROUP_ORDER,
  GROUP_LABELS,
  IMPLEMENT_LABELS,
  catalogId,
  fromCatalog,
  isCatalogCandidate,
} from '../../lib/exerciseCatalog';
import type { CatalogChoice } from '../../lib/exerciseCatalog';
import { ChipGroup } from '../ChipGroup';
import { ExercisePickList } from './ExercisePickList';
import type { Exercise } from '../../types';
import ui from '../../styles/ui.module.scss';
import { Tag } from '../Tag';
import { Pill } from '../Pill';
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
  /**
   * すでにその日に入っている種目。**候補から外す。**
   *
   * 記録画面から開いたときに使う。マイ種目に残さず入れた種目（＝非表示のまま
   * その日だけ使う種目）は「まだ持っていない」ものとして一覧に残るので、
   * 外さないと、入れたはずの種目がもう一度並ぶ。
   */
  usedIds?: ReadonlySet<string> | undefined;
  /**
   * すでに足し終えた種目。**消さずに ✓ で出す。**
   *
   * プリセットを組みながらカタログから足すときに使う。追加した種目はマイ種目へ
   * 入るので、そのままだと候補から消えて「入ったのか」が分からない。
   * 押し直せば外せる（呼び出し側が `onAdd` の相手を決める）。
   */
  selectedIds?: ReadonlySet<string> | undefined;
  /** ✓ を押したときの呼び先。渡さなければ ✓ の行は押せない */
  onToggle?: ((id: string) => void) | undefined;
}

/**
 * カタログから種目を追加する。
 *
 * 設定タブのマイ種目と、記録タブの種目ピッカーの両方から使う。
 * マイ種目の置き場所は設定のままだが、入口が設定にしか無いと、
 * 初めて記録タブを開いた人が「設定から追加してください」で行き止まる。
 */
export function CatalogPicker({ exercises, onAdd, usedIds, selectedIds, onToggle }: Props) {
  /*
   * 器具の絞り込みだけをここで持つ。**部位と検索は `ExercisePickList` が持っている**
   * （選ぶ面はどこも同じ組みなので、そこに寄せた）。
   */
  const [filter, setFilter] = useState<CatalogFilter>('all');
  /*
   * 伏せてある種目（`hidden`）と、マイ種目に入れていない種目（`adhoc`）を、ここに出す。
   * 伏せたものを「追加済み」として消すと、戻す道がマイ種目の非表示欄しか無くなる。
   * 選び直したら表示に戻る（useBodyData.addExercises）。
   *
   * **3 つとも見分けが付くようにする。**実体がまだ無い（印なし）／その日だけ使った
   * （記録あり）／一度入れて伏せた（非表示）は別の状態で、押した結果も違う。
   */
  const known = new Set(exercises.filter((e) => !isCatalogCandidate(e)).map((e) => e.id));
  const byId = new Map(exercises.map((e) => [e.id, e]));
  const notAdded = CATALOG_CHOICES.filter((c) => {
    const id = catalogId(c.entry, c.implement);
    if (usedIds?.has(id)) return false;
    // 足し終えたものは残す（消えると、入ったのかどうかが分からない）
    if (known.has(id) && !selectedIds?.has(id)) return false;
    return matchesFilter(c, filter);
  });
  const filtered = filter !== 'all';

  /**
   * カタログの 1 件。**束ねた一覧でも、探した結果でも同じものを出す。**
   *
   * 印はカタログに並ぶものどうしの違いを示す。
   *   （印なし）… 実体がまだ無い。初めて入れる
   *   記録あり  … その日だけ入れて使った種目（shelf: adhoc）。記録が繋がる
   *   非表示    … 一度入れて伏せた種目。押すと表示に戻る
   *
   * 探した結果では、束ねる見出しが無いので部位も行に添える。
   */
  const pill = (c: CatalogChoice, searching: boolean) => {
    const id = catalogId(c.entry, c.implement);
    const picked = selectedIds?.has(id) ?? false;
    const shelf = byId.get(id)?.shelf;
    return (
      <Pill
        key={id}
        pressed={picked}
        disabled={picked && onToggle == null}
        onClick={() =>
          picked ? onToggle?.(id) : onAdd([fromCatalog(c.entry, exercises.length, c.implement)])
        }
      >
        {picked ? '✓ ' : '＋ '}
        {c.entry.name}
        {c.entry.implements && `（${IMPLEMENT_LABELS[c.implement]}）`}
        {searching && <Tag>{GROUP_LABELS[c.entry.group]}</Tag>}
        {shelf === 'hidden' && <Tag>非表示</Tag>}
        {shelf === 'adhoc' && <Tag>記録あり</Tag>}
      </Pill>
    );
  };

  /**
   * 並べる形にそろえる。`ExercisePickList` は id / name / group しか見ないので、
   * 器具まで展開した行をその形に写して渡す（押したときに元の行へ戻す）。
   */
  const items = notAdded.map((c) => ({
    id: catalogId(c.entry, c.implement),
    name: `${c.entry.name}${c.entry.implements ? `（${IMPLEMENT_LABELS[c.implement]}）` : ''}`,
    group: c.entry.group,
    choice: c,
  }));

  return (
    <div className={s.pickerGroup}>
      {/* 選ぶ面はどこも同じ組み。器具の絞り込みだけがカタログ固有なので、そこを渡す */}
      <ExercisePickList
        items={items}
        heading="カタログ"
        threshold={0}
        // 部位チップは器具で絞る前の分類から出す（切り替えでチップが消えないように）
        groups={EXERCISE_GROUP_ORDER}
        filters={
          /* ダンベルに切り替えて追加すれば、バーベル版と別種目として両方持てる */
          <ChipGroup
            options={CATALOG_FILTERS}
            value={filter}
            onChange={setFilter}
            label="器具"
            showLabel
            tight
          />
        }
        empty={
          <p className={ui.note}>
            {filtered
              ? 'このフィルターに合う種目はありません。'
              : 'カタログの種目はすべて追加済みです。'}
          </p>
        }
        renderItem={(item, searching) => pill(item.choice, searching)}
      />
    </div>
  );
}
