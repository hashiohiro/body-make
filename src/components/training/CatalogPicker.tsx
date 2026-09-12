import { useState } from 'react';
import {
  CATALOG_CHOICES,
  GROUP_LABELS,
  EXERCISE_GROUP_ORDER,
  IMPLEMENT_LABELS,
  catalogId,
  fromCatalog,
  isCatalogCandidate,
} from '../../lib/exerciseCatalog';
import type { CatalogChoice } from '../../lib/exerciseCatalog';
import { matchRank, matchesQuery } from './ExerciseFilterBar';
import { SearchToggle } from './SearchToggle';
import type { Exercise, ExerciseGroup } from '../../types';
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
  const [filter, setFilter] = useState<CatalogFilter>('all');
  // 部位は主部位だけで絞る。一覧の見出しも主部位で切っているので、見え方が一致する
  const [group, setGroup] = useState<ExerciseGroup | 'all'>('all');
  /** 名前で探す。90 種目あるので、目当てが決まっているときはこちらが速い */
  const [query, setQuery] = useState('');
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
    return (
      matchesFilter(c, filter) &&
      (group === 'all' || c.entry.group === group) &&
      // 器具の接尾辞は付けずに、名前そのもので照合する（「ベンチ」で両方に当たる）
      matchesQuery(c.entry.name, query)
    );
  });
  const searching = query.trim() !== '';
  const filtered = filter !== 'all' || group !== 'all' || searching;
  /* 打っている最中の並び。前方一致を先に出し、同じ近さならカタログの並びのまま */
  const hits = searching
    ? [...notAdded].sort((a, b) => matchRank(a.entry.name, query) - matchRank(b.entry.name, query))
    : notAdded;

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
  const pill = (c: CatalogChoice) => {
    const id = catalogId(c.entry, c.implement);
    const picked = selectedIds?.has(id) ?? false;
    const shelf = byId.get(id)?.shelf;
    return (
      <button
        key={id}
        type="button"
        className={s.pickerBtn}
        aria-pressed={picked}
        disabled={picked && onToggle == null}
        onClick={() =>
          picked ? onToggle?.(id) : onAdd([fromCatalog(c.entry, exercises.length, c.implement)])
        }
      >
        {picked ? '✓ ' : '＋ '}
        {c.entry.name}
        {c.entry.implements && `（${IMPLEMENT_LABELS[c.implement]}）`}
        {searching && <span className={s.catalogTag}>{GROUP_LABELS[c.entry.group]}</span>}
        {shelf === 'hidden' && <span className={s.catalogTag}>非表示</span>}
        {shelf === 'adhoc' && <span className={s.catalogTag}>記録あり</span>}
      </button>
    );
  };

  return (
    <div className={s.pickerGroup}>
      <div className={s.catalogHead}>
        <span className={s.pickerLabel}>カタログ（{notAdded.length}件）</span>
        {/* 見出しの行に畳む。使わない日に高さを取らせない（SearchToggle） */}
        <SearchToggle query={query} onQuery={setQuery} label="種目を検索" />
      </div>

      {/*
        絞り込みは出しっぱなしにする。畳んでいた頃は、開くのに 1 回・選ぶのに 1 回で
        毎回 2 回押していた。チップは押す的であると同時に、
        いま何で絞っているかの表示でもある（`ExerciseFilterBar` と同じ扱い）。
      */}
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
          {EXERCISE_GROUP_ORDER.map((g) => (
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
            ? 'このフィルターに合う種目はありません。'
            : 'カタログの種目はすべて追加済みです。'}
        </p>
      ) : searching ? (
        /*
          **探しているあいだは部位で束ねない。**名前で当てに行っているので、
          部位の見出しは読まれないまま場所だけ取る。どの部位かは行の右に添える。
        */
        <div className={s.pickerList}>{hits.map(pill)}</div>
      ) : (
        EXERCISE_GROUP_ORDER.map((g) => {
          const items = notAdded.filter((c) => c.entry.group === g);
          if (items.length === 0) return null;
          return (
            <div key={g} className={s.pickerGroup}>
              <div className={s.pickerLabel}>{GROUP_LABELS[g]}</div>
              <div className={s.pickerList}>{items.map(pill)}</div>
            </div>
          );
        })
      )}
    </div>
  );
}
