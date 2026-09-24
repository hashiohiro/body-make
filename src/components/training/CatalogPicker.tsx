import { useState } from 'react';
import {
  CATALOG_CHOICES,
  EXERCISE_GROUP_ORDER,
  GROUP_KEYS,
  catalogFullName,
  catalogId,
  exerciseName,
  fromCatalog,
  isCatalogCandidate,
  isFromCatalog,
} from '../../lib/exerciseCatalog';
import type { CatalogChoice } from '../../lib/exerciseCatalog';
import { ChipGroup } from '../ChipGroup';
import { ExercisePickList } from './ExercisePickList';
import type { Exercise, ExerciseGroup } from '../../types';
import ui from '../../styles/ui.module.scss';
import { Tag } from '../Tag';
import { Pill } from '../Pill';
import s from './training.module.scss';
import { useT } from '../../lib/i18n';
import type { MessageKey } from '../../lib/i18n';

/**
 * カタログの絞り込み。器具を選べる種目は、選んだ器具で登録される。
 *
 * バーベルとマシンを分けられないのは、種目が持っているのが「負荷の数え方」だけで
 * 器具の名前を持っていないため（standard に両方が入る）。
 * 分けられないものを分かれているように見せないよう、ラベルもまとめてある。
 */
type CatalogFilter = 'all' | 'barbell' | 'dumbbell' | 'bodyweight';

const CATALOG_FILTERS: { id: CatalogFilter; key: MessageKey }[] = [
  { id: 'all', key: 'catalog.all' },
  { id: 'barbell', key: 'catalog.barbell' },
  { id: 'dumbbell', key: 'catalog.dumbbell' },
  { id: 'bodyweight', key: 'catalog.bodyweight' },
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

/**
 * 一覧に並べる 1 行。**カタログの行か、手元に無い自作種目か。**
 * どちらも同じ見た目で並び、押した結果だけが違う。
 */
type Row = {
  id: string;
  name: string;
  group: ExerciseGroup;
  aliases?: readonly string[] | undefined;
} & ({ choice: CatalogChoice; exercise?: undefined } | { choice?: undefined; exercise: Exercise });

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
   * マイ種目に入れてある種目も一覧に出すか。**押した先がマイ種目の先にある面だけ真。**
   *
   * 記録画面（その日に入る）とプリセットの中身（その組み合わせに入る）では、
   * すでに持っている種目を押すことに意味がある。隠すと**カタログで「ベンチ」と
   * 打っても出ない**——持っているからこそ 0 件になる、という読めない挙動になる。
   *
   * 設定のマイ種目から開いたときは偽。あそこで押した先はマイ種目そのものなので、
   * すでにあるものを並べても押す理由が無い。
   */
  includeOwned?: boolean | undefined;
  /**
   * すでに足し終えた種目と、その外し方。**2 つで 1 つ。**
   *
   * プリセットを組みながらカタログから足すときに使う。追加した種目はマイ種目へ
   * 入るので、そのままだと候補から消えて「入ったのか」が分からない。
   * 消さずに ✓ で出し、押し直せば外せる。
   *
   * **別々の任意プロパティにしない。**片方だけ渡せる形にすると
   * 「✓ なのに外せない」——押しても何も起きない札——という状態が型の上では
   * 起こり得て、そのための分岐を書くことになる。実際には入らない道だった。
   * 組で持てば、✓ が出るときは必ず外せる。
   */
  selection?: { ids: ReadonlySet<string>; onToggle: (id: string) => void } | undefined;
}

/**
 * カタログから種目を追加する。
 *
 * 設定タブのマイ種目と、記録タブの種目ピッカーの両方から使う。
 * マイ種目の置き場所は設定のままだが、入口が設定にしか無いと、
 * 初めて記録タブを開いた人が「設定から追加してください」で行き止まる。
 */
export function CatalogPicker({ exercises, onAdd, usedIds, selection, includeOwned }: Props) {
  const t = useT();
  /*
   * 器具の絞り込みだけをここで持つ。**部位と検索は `ExercisePickList` が持っている**
   * （選ぶ面はどこも同じ組みなので、そこに寄せた）。
   */
  const [filter, setFilter] = useState<CatalogFilter>('all');
  /*
   * **カタログは全部出す。**マイ種目に入れてあるものも隠さない。
   *
   * 以前はマイ種目にあるものを外していたが、そうすると**カタログで「ベンチ」と
   * 打っても出ない**——すでに持っているからこそ 0 件になる、という読めない挙動になる。
   * 足すには ‹ で戻って「マイ種目から選ぶ」を開き直すことになっていた。
   *
   * カタログとマイ種目の違いは**中身ではなく広さ**にする（すべて／よく使うもの）。
   *
   * **状態は印で見分ける。**押した結果が違う。
   *   （印なし）… 実体がまだ無い。初めて入れる
   *   マイ種目  … すでに持っている。そのまま入る（残すかは聞かない）
   *   記録あり  … その日だけ入れて使った種目（shelf: adhoc）。記録が繋がる
   *   非表示    … 一度入れて伏せた種目。押すと表示に戻る
   */
  const byId = new Map(exercises.map((e) => [e.id, e]));
  const notAdded = CATALOG_CHOICES.filter((c) => {
    const id = catalogId(c.entry, c.implement);
    // その日に入っているものは外す（二重に足す意味が無い）
    if (usedIds?.has(id)) return false;
    // 押した先がマイ種目そのものの面では、すでにあるものを並べない
    if (!includeOwned && byId.get(id)?.shelf === 'listed' && !selection?.ids.has(id)) return false;
    return matchesFilter(c, filter);
  });

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
  const pill = (c: CatalogChoice, searching: boolean, alias: string | null) => {
    const id = catalogId(c.entry, c.implement);
    const picked = selection?.ids.has(id) ?? false;
    const shelf = byId.get(id)?.shelf;
    return (
      <Pill
        key={id}
        pressed={picked}
        onClick={() =>
          picked && selection
            ? selection.onToggle(id)
            : /*
                すでに持っているものは作り直さない（写すと種目ごとの設定と目標が
                巻き戻る）。**表示に戻すのは shelf で伝える**——そのまま渡すと、
                伏せてあるものが伏せたままになる（`useBodyData.addExercises`）。
              */
              onAdd([
                byId.has(id)
                  ? { ...byId.get(id)!, shelf: 'listed' as const }
                  : fromCatalog(c.entry, exercises.length, c.implement),
              ])
        }
      >
        {picked ? '✓ ' : '＋ '}
        {catalogFullName(t.locale, c.entry, c.implement)}
        {/*
          **打った語で当たったなら、その語を添える。**
          「プッシュダウン」で探して「トライセプスプレスダウン」が出ると、
          一瞬「これは違うのでは」と思う。並びは 別名 → 部位 で固定する。
          登録されるのは**正式名のまま**——手元の一覧で名前が揺れないように。
        */}
        {alias != null && <Tag>{alias}</Tag>}
        {searching && <Tag>{t(GROUP_KEYS[c.entry.group])}</Tag>}
        {shelf === 'listed' && <Tag>{t('settings.exercises')}</Tag>}
        {shelf === 'hidden' && <Tag>{t('manage.hidden')}</Tag>}
        {shelf === 'adhoc' && <Tag>{t('catalog.hasRecords')}</Tag>}
      </Pill>
    );
  };

  /**
   * 手元に無い自作種目の 1 件。**カタログの行と同じ見た目**で、押した結果だけが違う。
   * カタログには元が無いので、作り直さずに**その種目をそのまま表示に戻す**。
   */
  const ownPill = (exercise: Exercise, searching: boolean) => {
    const picked = selection?.ids.has(exercise.id) ?? false;
    return (
      <Pill
        key={exercise.id}
        pressed={picked}
        onClick={() =>
          picked && selection
            ? selection.onToggle(exercise.id)
            : onAdd([{ ...exercise, shelf: 'listed' }])
        }
      >
        {picked ? '✓ ' : '＋ '}
        {exerciseName(t, exercise)}
        {searching && <Tag>{t(GROUP_KEYS[exercise.group])}</Tag>}
        {exercise.shelf === 'listed' && <Tag>{t('settings.exercises')}</Tag>}
        {exercise.shelf === 'hidden' && <Tag>{t('manage.hidden')}</Tag>}
        {exercise.shelf === 'adhoc' && <Tag>{t('catalog.hasRecords')}</Tag>}
      </Pill>
    );
  };

  /**
   * 並べる形にそろえる。`ExercisePickList` は id / name / group しか見ないので、
   * 器具まで展開した行をその形に写して渡す（押したときに元の行へ戻す）。
   */
  const items: Row[] = notAdded.map((c) => ({
    id: catalogId(c.entry, c.implement),
    name: catalogFullName(t.locale, c.entry, c.implement),
    group: c.entry.group,
    // 呼び方の揺れで「無い」と思われないように、別名でも拾えるようにする
    aliases: c.entry.aliases,
    choice: c,
  }));

  /*
   * **手元に無い自作種目も、ここに出す。**カタログ由来とまったく同じ規則
   * （`isCatalogCandidate`）で、伏せてあるもの（hidden）と、マイ種目に入れて
   * いないもの（adhoc）を並べる。
   *
   * これが無いと、**自作種目を伏せたときに戻す道がマイ種目の非表示欄しか無くなる。**
   * カタログ由来には戻す道が 2 つあるのに、自作だけ 1 つという状態だった。
   *
   * 器具の絞り込みには乗せない（「すべて」のときだけ出す）。自作種目は器具を
   * 持たないので、どの籠に入れても根拠が無い——黙って分類するより出さない。
   */
  const own: Row[] = exercises
    .filter(
      (e) =>
        !isFromCatalog(e.id) &&
        (isCatalogCandidate(e) || includeOwned || (selection?.ids.has(e.id) ?? false)) &&
        !usedIds?.has(e.id) &&
        (filter === 'all' || (selection?.ids.has(e.id) ?? false)),
    )
    .map((e) => ({
      id: e.id,
      name: exerciseName(t, e),
      group: e.group,
      exercise: e,
    }));

  return (
    <div className={s.pickerGroup}>
      {/* 選ぶ面はどこも同じ組み。器具の絞り込みだけがカタログ固有なので、そこを渡す */}
      <ExercisePickList
        items={[...items, ...own]}
        heading={t('catalog.title')}
        threshold={0}
        // 部位チップは器具で絞る前の分類から出す（切り替えでチップが消えないように）
        groups={EXERCISE_GROUP_ORDER}
        filters={
          /* ダンベルに切り替えて追加すれば、バーベル版と別種目として両方持てる */
          <ChipGroup
            options={CATALOG_FILTERS.map((f) => ({ id: f.id, label: t(f.key) }))}
            value={filter}
            onChange={setFilter}
            label={t('catalog.equipment')}
            showLabel
            tight
          />
        }
        empty={<p className={ui.note}>{t('catalog.noMatch')}</p>}
        renderItem={(item, searching, alias) =>
          item.choice ? pill(item.choice, searching, alias) : ownPill(item.exercise, searching)
        }
      />
    </div>
  );
}
