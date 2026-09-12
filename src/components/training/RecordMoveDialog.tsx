import { useMemo, useState } from 'react';
import { Modal } from '../Modal';
import {
  CATALOG_CHOICES,
  EXERCISE_GROUP_ORDER,
  GROUP_LABELS,
  LOAD_MODE_LABELS,
  catalogId,
  fromCatalog,
  isListed,
} from '../../lib/exerciseCatalog';
import { buildSessions } from '../../lib/training';
import { matchRank, matchesQuery } from './ExerciseFilterBar';
import { SearchToggle } from './SearchToggle';
import { planMove } from '../../lib/move';
import type { OnConflict } from '../../lib/move';
import { formatMD } from '../../lib/date';
import type { BodyData } from '../../hooks/useBodyData';
import type { Exercise, ExerciseGroup, LoadMode, Workouts } from '../../types';
import ui from '../../styles/ui.module.scss';
import s from './training.module.scss';

/** 期間の切り方。既定は全期間（取り違えは最初からのことが多い） */
const RANGES = [
  { id: 'all', label: 'すべて' },
  { id: 'since', label: 'この日以降' },
  { id: 'between', label: '期間を指定' },
] as const;

type RangeId = (typeof RANGES)[number]['id'];

/**
 * 候補の広さ。**既定はマイ種目。**
 *
 * 手元にある種目のほうが数が少なく、行き先もたいていそこにある。
 * カタログまで開くのは、行き先がまだ手元に無いときだけ（ダンベル版で付けていたのを
 * ケーブル版へ、など）。並びも狭いほうを左に置いて、押す順にそろえる。
 *
 * **「カタログ」とは呼ばない。**すべてにはカタログの 113 種のほかに自作種目も入る。
 * マイ種目はカタログ由来の種目と自作種目でできているので、
 * 「カタログ」と書くと自作種目がどちらに入るのか読めなくなる。
 */
const SOURCES = [
  { id: 'mine', label: 'マイ種目' },
  { id: 'all', label: 'すべて' },
] as const;

type SourceId = (typeof SOURCES)[number]['id'];

/** 移行先の候補 1 件。マイ種目の種目でも、カタログの行でも同じ形で扱う */
interface Candidate {
  id: string;
  name: string;
  group: ExerciseGroup;
  loadMode: LoadMode;
  /** すでにマイ種目にあるか。無ければ移行するときに足す */
  mine: boolean;
  /** 移行先として渡す実体 */
  make: () => Exercise;
}

interface Props {
  body: BodyData;
  /** 移し元。この種目の記録を動かす */
  from: Exercise;
  onClose: () => void;
}

/** その種目ぶんだけを抜いた `Workouts`。前後の挙上量を、本番と同じ経路で出すために作る */
function onlyOf(workouts: Workouts, exerciseId: string, dates: readonly string[]): Workouts {
  const out: Workouts = {};
  for (const date of dates) {
    const entry = (workouts[date] ?? []).find((e) => e.exerciseId === exerciseId);
    if (entry) out[date] = [entry];
  }
  return out;
}

/**
 * 記録を別の種目へ移す。**唯一「過去を書き換える」操作。**
 *
 * 「別の種目として記録してしまった」を、消して打ち直さずに直すために持つ。
 * 起きるのは、同じ動きを器具違いで記録していた（ダンベルのハンマーカールとして
 * 付けていたが実際はケーブル）、自作で作ったあとカタログに本物が入った、など。
 *
 * **値は 1 つも書き換えない。**動かすのは参照先だけ。ただし挙上量と推定1RM は
 * 移行先の数え方で計算し直される（数え方は種目側にある）ので、
 * **その差を実行の前に数字で出す**。書いた重量が変わらないのに通算が半分になることが
 * あるので、黙ってやると過去が書き換わったように見える。
 *
 * 移行先はマイ種目とカタログの両方から選べる。カタログの種目を選ぶと、
 * マイ種目にも追加される（記録の行き先になる種目は、実体が要る）。
 */
export function RecordMoveDialog({ body, from, onClose }: Props) {
  const { data, daily, moveRecords } = body;
  const [toId, setToId] = useState<string | null>(null);
  const [source, setSource] = useState<SourceId>('mine');
  /** 部位で絞る。カタログと同じチップ（`CatalogPicker`） */
  const [group, setGroup] = useState<ExerciseGroup | 'all'>('all');
  /** 名前で探す。打ちはじめたら、部位の見出しをやめて平たい候補に差し替える */
  const [query, setQuery] = useState('');
  const [rangeId, setRangeId] = useState<RangeId>('all');
  const [since, setSince] = useState('');
  const [until, setUntil] = useState('');
  /** 衝突の扱いを聞いている面。答えるまで動かさない */
  const [asking, setAsking] = useState(false);

  /*
   * 候補。**カタログとマイ種目を同じ形にそろえてから並べる。**
   * カタログの行はまだ実体が無いので、選ばれたときに作る（`make`）。
   * すでにマイ種目にあるものは、その実体をそのまま使う（記録も目標も付いたまま）。
   */
  const candidates = useMemo<Candidate[]>(() => {
    const mine = new Map(data.exercises.map((e) => [e.id, e]));
    const out: Candidate[] = [];
    const seen = new Set<string>([from.id]);

    // すべてのときはカタログも並べる。手元にあるものは、その実体をそのまま使う
    if (source === 'all') {
      CATALOG_CHOICES.forEach((c, i) => {
        const id = catalogId(c.entry, c.implement);
        if (seen.has(id)) return;
        seen.add(id);
        const held = mine.get(id);
        const made = held ?? fromCatalog(c.entry, data.exercises.length + i, c.implement);
        out.push({
          id,
          name: made.name,
          group: made.group,
          loadMode: made.loadMode,
          mine: held != null,
          make: () => made,
        });
      });
    }

    /*
     * マイ種目。**すべてのときも通る**——自作種目はカタログに無いので、
     * ここで拾わないと「すべて」に出てこない。
     */
    for (const e of data.exercises) {
      if (seen.has(e.id) || !isListed(e)) continue;
      seen.add(e.id);
      out.push({
        id: e.id,
        name: e.name,
        group: e.group,
        loadMode: e.loadMode,
        mine: true,
        make: () => e,
      });
    }
    return out;
  }, [data.exercises, from.id, source]);

  const picked = candidates.find((c) => c.id === toId) ?? null;
  const target = picked?.make() ?? null;

  // 検索とチップは AND。カタログと同じ（「腕で絞ってからカールを探す」が通る）
  const narrowed = candidates.filter(
    (c) => (group === 'all' || c.group === group) && matchesQuery(c.name, query),
  );
  const searching = query.trim() !== '';
  /* 打っている最中の並び。前方一致を先に出し、同じ近さなら元の並びのまま */
  const hits = searching
    ? [...narrowed].sort((a, b) => matchRank(a.name, query) - matchRank(b.name, query))
    : narrowed;

  const range = {
    from: rangeId === 'all' ? null : since || null,
    until: rangeId === 'between' ? until || null : null,
  };

  const plan = useMemo(
    () =>
      target == null
        ? { dates: [], conflicts: [] }
        : planMove(data.workouts, from.id, target.id, range.from, range.until),
    [data.workouts, from.id, target, range.from, range.until],
  );

  /*
   * 移す前と後の挙上量。**本番と同じ経路（`buildSessions`）で出す。**
   * 掛け算をここに書き写すと、数え方が増えたときに画面だけ古い答えを出す。
   */
  const totals = useMemo(() => {
    if (target == null) return null;
    const dates = [...plan.dates, ...plan.conflicts];
    const slice = onlyOf(data.workouts, from.id, dates);
    const sum = (exercise: Exercise, id: string) => {
      const moved: Workouts = {};
      for (const [date, day] of Object.entries(slice)) {
        moved[date] = day.map((e) => ({ ...e, exerciseId: id }));
      }
      return buildSessions(moved, [{ ...exercise, id }], daily).reduce(
        (acc, session) => acc + session.exercises.reduce((a, p) => a + p.volume, 0),
        0,
      );
    };
    return { before: sum(from, from.id), after: sum(target, target.id) };
  }, [target, plan, data.workouts, from, daily]);

  /**
   * 候補の 1 件。**束ねた一覧でも、探した結果でも、選んだあとでも同じものを出す。**
   * 印はカタログと同じ器（`catalogTag` / `adhocTag`）。
   *
   * @param chosen 選んだ 1 件として出すか。もう一度押すと選び直しに戻る
   */
  const pill = (c: Candidate, chosen: boolean) => (
    <button
      key={c.id}
      type="button"
      className={s.pickerBtn}
      aria-pressed={chosen || toId === c.id}
      aria-label={`${c.name}へ移行する`}
      onClick={() => setToId(chosen ? null : c.id)}
    >
      {chosen && '✓ '}
      {c.name}
      {/* 探した結果では束ねる見出しが無いので、部位も行に添える（カタログと同じ） */}
      {searching && !chosen && <span className={s.catalogTag}>{GROUP_LABELS[c.group]}</span>}
      {/*
        数え方が違う候補には印を付ける。**選ぶのを止めはしない**——
        器具が違えば数え方も違うのが普通で、それを直すのが移行の目的。
        変わる量は下に数字で出す。
      */}
      {c.loadMode !== from.loadMode && (
        <span className={s.catalogTag}>{LOAD_MODE_LABELS[c.loadMode]}</span>
      )}
      {!c.mine && <span className={s.adhocTag}>未追加</span>}
    </button>
  );

  const run = (onConflict: OnConflict) => {
    if (target == null) return;
    moveRecords({ fromId: from.id, to: target, from: range.from, until: range.until, onConflict });
    onClose();
  };

  const submit = () => {
    if (target == null) return;
    // ぶつかる日があるときだけ聞く（消えるものがあるときだけ確認する・§2.2）
    if (plan.conflicts.length > 0) setAsking(true);
    else run('keep');
  };

  if (asking && target) {
    return (
      <Modal open title="移行先に記録がある日" onClose={onClose} onBack={() => setAsking(false)}>
        <div>
          <p className={ui.note}>
            「{target.name}」にすでに記録がある日が {plan.conflicts.length}日ぶんあります（
            {plan.conflicts.map(formatMD).join('・')}）。
          </p>

          {/*
            **答えは 3 つのボタンそのもの。**セットを混ぜる選択肢は作らない——
            混ぜると、順番も本数もどちらの日のものか分からなくなる。
          */}
          <div className={ui.btnRow}>
            <button
              type="button"
              className={`${ui.btn} ${ui.btnDanger}`}
              onClick={() => run('overwrite')}
            >
              上書きする
            </button>
            <button type="button" className={ui.btn} onClick={() => run('keep')}>
              その日は移さない
            </button>
          </div>
          <p className={ui.note}>
            上書きすると「{target.name}」のその日の記録は消えます（元に戻せません）。
            移さない場合、その日は「{from.name}」に残ります。
          </p>

          <div className={ui.btnRow}>
            <button type="button" className={`${ui.btn} ${ui.btnGhost}`} onClick={onClose}>
              やめる
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  const moving = plan.dates.length + plan.conflicts.length;

  return (
    <Modal open title={`${from.name}の記録を移行する`} onClose={onClose}>
      <div>
        {/* 見出しの行に検索を畳む。組みはカタログと同じ（`CatalogPicker`） */}
        <div className={s.catalogHead}>
          <span className={s.pickerLabel}>
            移行先{picked == null && `（${narrowed.length}件）`}
          </span>
          {picked == null && <SearchToggle query={query} onQuery={setQuery} label="種目を検索" />}
        </div>

        {/*
          絞り込みはカタログと同じ形にそろえる。ラベル付きのチップ行を並べ、
          出しっぱなしにする（チップは押す的であると同時に、いま何で絞っているかの表示）。

          選び終わったら、絞り込みごと畳む（選び直すまで使わない）。
        */}
        {picked == null && (
          <div className={s.filters}>
            {/*
              **既定はマイ種目**——行き先はたいてい手元にある。
              すべてにはカタログの種目と自作種目の両方が入る。
            */}
            {/*
              見出しは「候補」。カタログの 器具 / 部位 はどちらも種目の性質だが、
              この行が選んでいるのは性質ではなく**候補の広さ**なので、そう名づける。
            */}
            <div className={s.pickerLabel} id="move-source">
              候補
            </div>
            <div
              className={`${ui.chipRow} ${s.filterRow}`}
              role="group"
              aria-labelledby="move-source"
            >
              {SOURCES.map((src) => (
                <button
                  key={src.id}
                  type="button"
                  className={ui.chip}
                  aria-pressed={source === src.id}
                  onClick={() => setSource(src.id)}
                >
                  {src.label}
                </button>
              ))}
            </div>

            <div className={s.pickerLabel} id="move-group">
              部位
            </div>
            <div
              className={`${ui.chipRow} ${s.filterRow}`}
              role="group"
              aria-labelledby="move-group"
            >
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
        )}

        {/*
          **選んだら候補を畳む。**選び終われば読むものではなく、
          113 種を残したままだと期間と「移す」が画面の外へ押し出される。
          選び直したいときは、選んだ行をもう一度押す。
        */}
        {picked ? (
          <div className={s.pickerList}>{pill(picked, true)}</div>
        ) : narrowed.length === 0 ? (
          <p className={ui.emptyState}>このフィルターに合う種目はありません。</p>
        ) : searching ? (
          /* 探しているあいだは部位で束ねない（カタログと同じ） */
          <div className={s.pickerList}>{hits.map((c) => pill(c, false))}</div>
        ) : (
          EXERCISE_GROUP_ORDER.map((g) => {
            const items = narrowed.filter((c) => c.group === g);
            if (items.length === 0) return null;
            return (
              <div key={g} className={s.pickerGroup}>
                <div className={s.pickerLabel}>{GROUP_LABELS[g]}</div>
                <div className={s.pickerList}>{items.map((c) => pill(c, false))}</div>
              </div>
            );
          })
        )}

        {picked && !picked.mine && (
          <p className={ui.note}>
            「{picked.name}」はマイ種目にありません。移すとマイ種目にも追加されます
            （記録の行き先になる種目は実体が要ります）。
          </p>
        )}

        <div className={s.pickerLabel}>期間</div>
        <div className={ui.chipRow} role="group" aria-label="移す期間">
          {RANGES.map((r) => (
            <button
              key={r.id}
              type="button"
              className={ui.chip}
              aria-pressed={rangeId === r.id}
              onClick={() => setRangeId(r.id)}
            >
              {r.label}
            </button>
          ))}
        </div>

        {rangeId !== 'all' && (
          <div className={ui.formRow}>
            <label htmlFor="move-since">開始日</label>
            <input
              id="move-since"
              type="date"
              value={since}
              onChange={(e) => setSince(e.target.value)}
            />
          </div>
        )}
        {rangeId === 'between' && (
          <div className={ui.formRow}>
            <label htmlFor="move-until">終了日</label>
            <input
              id="move-until"
              type="date"
              value={until}
              onChange={(e) => setUntil(e.target.value)}
            />
          </div>
        )}

        {/*
          **実行の前に、何がどう変わるかを数字で出す。**
          書いた重量は動かないのに、挙上量は移行先の数え方で計算し直される。
          黙ってやると、過去が書き換わったように見える。
        */}
        {target && (
          <div className={s.presetBody}>
            <div className={s.groupSummary}>
              <span>移行する記録</span>
              <span className={s.boardValue}>
                {moving}日ぶん
                {moving > 0 &&
                  `（${formatMD([...plan.dates, ...plan.conflicts].sort()[0]!)} 〜 ${formatMD(
                    [...plan.dates, ...plan.conflicts].sort().at(-1)!,
                  )}）`}
              </span>
            </div>
            {totals && (
              <div className={s.groupSummary}>
                <span>挙上量の通算</span>
                <span className={s.boardValue}>
                  {Math.round(totals.before).toLocaleString()} kg →{' '}
                  {Math.round(totals.after).toLocaleString()} kg
                </span>
              </div>
            )}
            {totals && Math.round(totals.before) !== Math.round(totals.after) && (
              <p className={ui.note}>
                打った重量は変わりません。数え方が違うので、挙上量と推定1RM が移行先の性質で
                計算し直されます（{LOAD_MODE_LABELS[from.loadMode]} →{' '}
                {LOAD_MODE_LABELS[target.loadMode]}）。
              </p>
            )}
            {plan.conflicts.length > 0 && (
              <p className={ui.note}>
                移行先に記録がある日が {plan.conflicts.length}日あります。扱いは次の面で選びます。
              </p>
            )}
          </div>
        )}

        <div className={ui.btnRow}>
          <button
            type="button"
            className={`${ui.btn} ${ui.btnPrimary}`}
            disabled={target == null || moving === 0}
            onClick={submit}
          >
            移行
          </button>
        </div>
      </div>
    </Modal>
  );
}
