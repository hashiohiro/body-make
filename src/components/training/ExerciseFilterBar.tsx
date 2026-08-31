import { useState } from 'react';
import { EXERCISE_GROUP_ORDER, GROUP_LABELS } from '../../lib/exerciseCatalog';
import type { Exercise, ExerciseGroup } from '../../types';
import ui from '../../styles/ui.module.scss';
import s from './training.module.scss';

/** 絞り込みを出すしきい値。これ以下なら一覧のまま見渡せる */
export const FILTER_THRESHOLD = 8;

/**
 * 比べるための正規化。**ひらがなをカタカナに寄せる。**
 *
 * 種目名はほとんどカタカナで、スマホで「べんち」まで打った時点では
 * まだひらがなのことがある。そこで 0 件になると、打ち切る前に諦めることになる。
 * 英字は大小を無視する（ローマ字入力の途中で拾えるように）。
 */
export function normalizeName(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[ぁ-ゖ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60));
}

/** 空の検索語はすべてに当たる（絞り込んでいない状態） */
export function matchesQuery(name: string, query: string): boolean {
  const q = normalizeName(query);
  return q === '' || normalizeName(name).includes(q);
}

export function matchesGroup(exercise: Exercise, group: ExerciseGroup | 'all'): boolean {
  if (group === 'all') return true;
  // 補助部位でも拾う。「腕」でベンチプレスが出るのは、実際に腕を使うから
  return exercise.group === group || exercise.subGroups.some((x) => x.group === group);
}

/**
 * フィルターの開閉ボタン。カタログ側も同じ形にそろえるために切り出してある。
 *
 * **閉じても条件は効いたまま。**そのぶん、効いていることがボタンから読めないと
 * 「種目が減っている理由が画面のどこにも無い」状態になるので、
 * 条件が入っているあいだは文言を変えて知らせる。
 */
export function FilterToggle({
  open,
  active,
  onToggle,
}: {
  open: boolean;
  /** 何か条件が入っているか。畳んでいるときの文言に効く */
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <div className={`${ui.btnRow} ${s.filterToggle}`}>
      <button
        type="button"
        className={`${ui.btn} ${ui.btnSm}`}
        aria-expanded={open}
        onClick={onToggle}
      >
        {open ? 'フィルターを閉じる' : active ? 'フィルター中' : 'フィルター'}
      </button>
    </div>
  );
}

interface Props {
  query: string;
  onQuery: (value: string) => void;
  group: ExerciseGroup | 'all';
  onGroup: (group: ExerciseGroup | 'all') => void;
  /** チップに出す分類。**絞り込む前の一覧から決める**（打つたびにチップが消えないように） */
  exercises: readonly Exercise[];
}

/**
 * 種目一覧の絞り込み。マイ種目と、記録画面の「マイ種目から選ぶ」で同じものを使う。
 *
 * **既定は畳んでおく。**種目を探すのは毎回ではないので、常に置くと
 * 一覧が検索欄とチップ 2 段ぶん下がる。押したときだけ開く。
 * 畳んでも条件は効いたままで、効いていることはボタンの文言で知らせる。
 *
 * **検索と部位は AND。**片方を触ったらもう片方が外れる、という挙動にはしない。
 * 「腕で絞ってからカールを探す」がそのまま通る。
 *
 * 部位チップは**持っている種目の分類だけ**出す。全部並べると、
 * 押しても 0 件にしかならないチップが並ぶ。
 */
export function ExerciseFilterBar({ query, onQuery, group, onGroup, exercises }: Props) {
  const [open, setOpen] = useState(false);
  const groups = EXERCISE_GROUP_ORDER.filter((g) => exercises.some((e) => matchesGroup(e, g)));
  const active = query.trim() !== '' || group !== 'all';
  const toggle = () => setOpen(!open);

  if (!open) return <FilterToggle open={false} active={active} onToggle={toggle} />;

  return (
    <div className={s.filterBar}>
      <FilterToggle open active={active} onToggle={toggle} />

      <input
        type="search"
        className={s.searchField}
        value={query}
        placeholder="種目を検索"
        aria-label="種目を検索"
        onChange={(e) => onQuery(e.target.value)}
      />

      {groups.length > 1 && (
        <div className={`${ui.chipRow} ${s.filterRow}`} role="group" aria-label="部位で絞り込む">
          {(['all', ...groups] as (ExerciseGroup | 'all')[]).map((g) => (
            <button
              key={g}
              type="button"
              className={ui.chip}
              aria-pressed={group === g}
              onClick={() => onGroup(g)}
            >
              {g === 'all' ? 'すべて' : GROUP_LABELS[g]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
