import { useState } from 'react';
import type { ReactNode } from 'react';
import {
  EXERCISE_GROUP_ORDER,
  GROUP_KEYS,
  byName,
  otherLocaleNames,
} from '../../lib/exerciseCatalog';
import {
  FILTER_THRESHOLD,
  matchRank,
  matchedAlias,
  matchesGroup,
  matchesQuery,
} from '../../lib/exerciseSearch';
import { GroupChips } from './GroupChips';
import { SearchToggle } from './SearchToggle';
import type { ExerciseGroup } from '../../types';
import ui from '../../styles/ui.module.scss';
import s from './training.module.scss';
import { useT } from '../../lib/i18n';

/** 並べられる最小の形。マイ種目でも、カタログの行でも、移行先の候補でも同じ */
interface Item {
  id: string;
  name: string;
  group: ExerciseGroup;
  /**
   * 検索で拾う別の呼び方。**カタログだけが持つ。**
   * 手元に置いたあとは名前を知っているので、要るのは「まだ持っていないものを
   * 探すとき」だけ（`CatalogEntry.aliases`）。
   */
  aliases?: readonly string[] | undefined;
}

interface Props<T extends Item> {
  /** 絞り込む前の候補。部位チップはここから決める（打つたびにチップが消えないように） */
  items: readonly T[];
  /** 見出し。件数は呼び出し側が足さない（絞り込みで動くので、ここが持つ） */
  heading: string;
  /**
   * 1 件の見せ方。
   *
   * `searching` が真なら、束ねる見出しが無いので部位を添える。
   * `alias` は**当たった別名**（名前で当たったときは null）——打った語を
   * 行に添えられるようにする。なぜ出たのかが読めないと、別の種目に見える。
   */
  renderItem: (item: T, searching: boolean, alias: string | null) => ReactNode;
  /** 0 件のときの文言。絞り込みで 0 件になった場合は共通の文を出す */
  empty?: ReactNode;
  /**
   * 検索と部位チップを出すしきい値。これ以下なら一覧のまま見渡せる。
   * 既定は `FILTER_THRESHOLD`（8）。
   */
  threshold?: number;
  /**
   * 部位の上に足す絞り込み（カタログの「器具」）。**面ごとに違う軸だけを渡す。**
   * 絞った結果は `items` に反映して渡してもらう——ここでは見た目の場所だけ貸す。
   */
  filters?: ReactNode;
  /**
   * 部位チップに出す分類。既定は `items` にある部位だけ
   * （押しても 0 件にしかならないチップを並べないため）。
   *
   * **`filters` を渡す面では、そちらで絞る前の分類を渡す。**
   * `items` から決めると、器具を切り替えたとたんに部位チップが消えて、
   * 指の下でチップが動く。
   */
  groups?: readonly ExerciseGroup[];
}

/**
 * 種目を選ぶ一覧。**選ぶ面はすべてこれを使う。**
 *
 * 同じ「マイ種目から 1 つ選ぶ」なのに、面ごとに道具が違っていた——
 * 記録画面とカタログには検索と部位チップがあり、プリセットの中身と
 * 種目の目標を足す面には見出しだけ、という状態だった。
 * どこで絞れるのかを面ごとに覚え直すことになるので、組みを 1 つにする。
 *
 * 持っているのは 3 つ。
 *
 *   - 見出しの行に畳んだ検索（`SearchToggle`。待機中の高さは 0）
 *   - 部位のチップ（出しっぱなし。押す的であると同時に、いま何で絞っているかの表示）
 *   - 部位ごとの見出し（**探しているあいだは束ねない**。名前で当てに行っているので、
 *     見出しは読まれないまま場所だけ取る）
 *
 * 1 件の見せ方だけが面ごとに違う（✓ のトグル、印、押した先）ので、そこは渡してもらう。
 */
export function ExercisePickList<T extends Item>({
  items,
  heading,
  renderItem,
  empty,
  threshold = FILTER_THRESHOLD,
  filters,
  groups: fixedGroups,
}: Props<T>) {
  const t = useT();
  const [group, setGroup] = useState<ExerciseGroup | 'all'>('all');
  const [query, setQuery] = useState('');

  const searching = query.trim() !== '';
  /*
    **並びは名前順。**追加順は使う側から見ると意味を持たない並びで、
    あとから足した 1 件がどこにいるか分からなくなる（見出しの中だけを並べ替える）。
  */
  const sorted = byName(t, items);
  // 検索とチップは AND。「腕で絞ってからカールを探す」がそのまま通る
  const narrowed = sorted.filter(
    (e) =>
      matchesGroup(e, group) &&
      matchesQuery(e.name, query, [...(e.aliases ?? []), ...otherLocaleNames(e.id)]),
  );
  /* 打っている最中の並び。前方一致を先に出し、同じ近さなら元の並びのまま */
  const hits = searching
    ? [...narrowed].sort(
        (a, b) => matchRank(a.name, query, a.aliases) - matchRank(b.name, query, b.aliases),
      )
    : narrowed;

  // チップは絞り込む前の一覧から決める（押したとたんにチップが消えないように）
  const groups =
    fixedGroups ?? EXERCISE_GROUP_ORDER.filter((g) => items.some((e) => e.group === g));
  const withTools = items.length > threshold;

  if (items.length === 0) return <>{empty}</>;

  return (
    <>
      <div className={s.catalogHead}>
        <span className={s.pickerLabel}>
          {heading}
          {/* 括弧は見出しの飾り。件数そのものは一覧の見出しと同じキーから引く */}（
          {t('settings.count', { n: narrowed.length })}）
        </span>
        {withTools && <SearchToggle query={query} onQuery={setQuery} label={t('picker.search')} />}
      </div>

      {(filters != null || withTools) && (
        <div className={s.filters}>
          {filters}
          {withTools && <GroupChips value={group} onChange={setGroup} groups={groups} showLabel />}
        </div>
      )}

      {narrowed.length === 0 ? (
        <p className={ui.emptyState}>{t('catalog.noMatch')}</p>
      ) : searching ? (
        <div className={s.pickerList}>
          {hits.map((e) => renderItem(e, true, matchedAlias(e.name, query, e.aliases)))}
        </div>
      ) : (
        EXERCISE_GROUP_ORDER.map((g) => {
          const list = narrowed.filter((e) => e.group === g);
          if (list.length === 0) return null;
          return (
            <div key={g} className={s.pickerGroup}>
              <div className={s.pickerLabel}>{t(GROUP_KEYS[g])}</div>
              <div className={s.pickerList}>{list.map((e) => renderItem(e, false, null))}</div>
            </div>
          );
        })
      )}
    </>
  );
}
