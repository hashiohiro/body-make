import { useState } from 'react';
import {
  EXERCISE_GROUP_ORDER,
  GROUP_LABELS,
  LOAD_MODE_HINTS,
  LOAD_MODE_LABELS,
  LOAD_MODE_ORDER,
  REP_UNIT_LABELS,
  emptyCheckValues,
  goalTypeLabel,
} from '../../lib/exerciseCatalog';
import { FACTOR_RANGE, RM_DIVISOR_RANGE } from '../../lib/storage';
import { DEFAULT_RM_DIVISOR } from '../../lib/training';
import type { Exercise, ExerciseGroup, LoadMode, RepUnit, SessionPoint } from '../../types';
import { CatalogPicker } from './CatalogPicker';
import {
  ExerciseFilterBar,
  FILTER_THRESHOLD,
  matchesGroup,
  matchesQuery,
} from './ExerciseFilterBar';
import { ExerciseSettingsForm } from './ExerciseSettingsForm';
import { GoalEditor } from './GoalEditor';
import { ExerciseSummaryCard } from './ExerciseSummaryCard';
import { Modal } from '../Modal';
import ui from '../../styles/ui.module.scss';
import s from './training.module.scss';

interface Props {
  exercises: readonly Exercise[];
  /** 種目 ID → その種目の記録がある日数。削除で何が消えるかを出すために使う */
  usage: ReadonlyMap<string, number>;
  onAdd: (exercises: readonly Exercise[]) => void;
  onUpdate: (exercise: Exercise) => void;
  onRemove: (id: string) => void;
  /** その種目の目標へ。決めるのは目標タブの仕事で、ここは入口だけ持つ */
  /** 目標を決めるときに「いま」と「過去最大」を出すために使う */
  sessions: readonly SessionPoint[];
}

function numOrNull(raw: string): number | null {
  const n = Number(raw);
  return raw.trim() === '' || !Number.isFinite(n) ? null : n;
}

/**
 * 目標の立て方と値。**目標タブの種目カードと同じ出し方にそろえる。**
 * 立て方はバッジ、値は「目標 100kg」。同じ種目を 2 画面で見るのに、形を変える理由がない。
 */
function goalKind(exercise: Exercise): string | null {
  return exercise.goal ? goalTypeLabel(exercise.goal.type, exercise.repUnit, true) : null;
}

function goalValue(exercise: Exercise): string | null {
  const goal = exercise.goal;
  if (!goal || goal.value == null) return null;
  const unit = goal.type === 'reps' ? REP_UNIT_LABELS[exercise.repUnit] : 'kg';
  return `${goal.value}${unit}`;
}

const EMPTY_FORM = {
  name: '',
  group: 'chest' as ExerciseGroup,
  // 既定のまま作れる値。触りたい人だけ「詳細設定」から変える
  loadMode: 'standard' as LoadMode,
  repUnit: 'reps' as RepUnit,
  bodyweightFactor: null as number | null,
  rmDivisor: DEFAULT_RM_DIVISOR,
};

/**
 * マイ種目（カタログから選んで手元に置いた種目）の追加・削除と、種目ごとの性質。
 *
 * 記録で選べるのはここにある種目だけで、カタログはその選択肢の一覧にすぎない。
 * 「種目を追加する」は、**マイ種目に足す**こと。
 *
 * 目標値はここに置かない。進捗を見ながら何度も変わるので目標タブが持つ。
 * 一覧には目標をタグとして出す。どの種目に目標があるかは、ここでも見えていたほうがいい。
 */
export function ExerciseManager({ exercises, usage, onAdd, onUpdate, onRemove, sessions }: Props) {
  const [adding, setAdding] = useState(false);
  const [filter, setFilter] = useState<ExerciseGroup | 'all'>('all');
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  /** 目標を開いている種目。設定（詳細）とは同時に開かない */
  const [goalOf, setGoalOf] = useState<string | null>(null);
  // 詳細設定のさらに内側。負荷の数え方・単位・換算の分母
  // 自作フォームで聞くのは名前と部位だけ。残りは既定値で作れる
  const [advanced, setAdvanced] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const openDetail = (ex: Exercise) => {
    setGoalOf(null);
    setEditing((cur) => (cur === ex.id ? null : ex.id));
  };

  const byId = new Map(exercises.map((e) => [e.id, e]));
  const goalExercise = goalOf ? (byId.get(goalOf) ?? null) : null;
  const settingsExercise = editing ? (byId.get(editing) ?? null) : null;

  const sorted = [...exercises].sort((a, b) => a.order - b.order);
  const filtered = sorted.filter((e) => matchesGroup(e, filter) && matchesQuery(e.name, query));
  const shown = filtered.filter((e) => !e.hidden);
  /*
   * 非表示も部位で切る。**絞り込みは一覧ぜんぶに掛かる。**
   *
   * 末尾にまとめてあるからと絞り込みから外していたが、
   * 「有酸素」で絞っているのに関係ない部位の非表示が下に並ぶ状態になっていた。
   * 絞り込みは「この部位の話だけにする」という指示なので、例外を作らない。
   */
  const hiddenShown = filtered.filter((e) => e.hidden);
  /** 件数の見出しは一覧ぜんぶの話。絞り込みでは動かさない */
  const hiddenAll = sorted.filter((e) => e.hidden);

  const submit = () => {
    const name = form.name.trim();
    if (!name) return;
    // 自作種目だけ randomUUID。カタログ由来は固定 ID なので入れ直しても過去ログが繋がる
    onAdd([
      {
        id: crypto.randomUUID(),
        name,
        group: form.group,
        subGroups: [],
        loadMode: form.loadMode,
        repUnit: form.repUnit,
        bodyweightFactor: form.bodyweightFactor,
        rmDivisor: form.rmDivisor,
        goal: null,
        order: exercises.length,
        hidden: false,
        // 構成チェックの値は持たせない。必要になったら種目の設定から入れる
        ...emptyCheckValues(),
      },
    ]);
    setForm(EMPTY_FORM);
    setAdvanced(false);
  };

  const remove = (ex: Exercise) => {
    const days = usage.get(ex.id) ?? 0;
    // 記録が無ければ失うものが無いので、確認しない。
    // 確認を挟むのは「一緒に消えるものがある」と伝える必要があるときだけ
    if (days === 0) {
      onRemove(ex.id);
      return;
    }
    const message = `「${ex.name}」を削除します。\nこの種目の記録 ${days}日ぶんも一緒に消えます。元に戻せません。`;
    if (confirm(message)) onRemove(ex.id);
  };

  /*
    1 種目ぶんの見せ方は、目標画面の種目カードと同じ部品を使う。
    同じ種目を 2 つの画面で見るのに、違う形で出す理由がない。
    変わるのは出す事実だけ（あちらはいまの値と到達率、ここは記録の量と数え方）。

    非表示の行は操作だけ差し替える。目標と設定は表示に戻してから触ればよく、
    使わないと決めた種目の下にボタンを 4 つ並べても選ぶ手間が増えるだけ。
  */
  const card = (ex: Exercise) => (
    <ExerciseSummaryCard
      key={ex.id}
      name={ex.name}
      // 主部位は見出しが持っているので、ここは補助部位だけ
      tag={
        ex.subGroups.length > 0 ? ex.subGroups.map((x) => GROUP_LABELS[x.group]).join('·') : null
      }
      kind={goalKind(ex)}
      goal={goalValue(ex)}
      factLeft={(usage.get(ex.id) ?? 0) > 0 ? `記録 ${usage.get(ex.id)}日` : '記録はまだありません'}
      factRight={`${LOAD_MODE_LABELS[ex.loadMode]} ・ ${REP_UNIT_LABELS[ex.repUnit]}で数える`}
      actions={
        ex.hidden ? (
          <>
            <button
              type="button"
              className={s.miniBtn}
              aria-label={`${ex.name}を表示に戻す`}
              onClick={() => onUpdate({ ...ex, hidden: false })}
            >
              表示に戻す
            </button>
            <button
              type="button"
              className={s.miniBtn}
              aria-label={`${ex.name}を削除`}
              onClick={() => remove(ex)}
            >
              削除
            </button>
          </>
        ) : (
          <>
            {/*
              目標はこの場で決める。目標タブへ連れて行くと、
              マイ種目を見ていたつもりが別の画面に移っていて、戻り方も分からない。
              決める道具（GoalEditor）は目標タブと同じものを使う。
            */}
            <button
              type="button"
              className={s.miniBtn}
              aria-pressed={goalOf === ex.id}
              aria-label={ex.goal ? `${ex.name}の目標を変える` : `${ex.name}の目標を決める`}
              onClick={() =>
                setGoalOf((cur) => {
                  setEditing(null);
                  return cur === ex.id ? null : ex.id;
                })
              }
            >
              目標
            </button>
            <button
              type="button"
              className={s.miniBtn}
              aria-pressed={editing === ex.id}
              aria-label={`${ex.name}の設定`}
              onClick={() => openDetail(ex)}
            >
              設定
            </button>
            <button
              type="button"
              className={s.miniBtn}
              aria-label={`${ex.name}を非表示にする`}
              onClick={() => onUpdate({ ...ex, hidden: true })}
            >
              非表示
            </button>
            <button
              type="button"
              className={s.miniBtn}
              aria-label={`${ex.name}を削除`}
              onClick={() => remove(ex)}
            >
              削除
            </button>
          </>
        )
      }
    />
  );

  return (
    <section className={ui.card}>
      <header className={ui.cardHeader}>
        <h2 className={ui.cardTitle}>マイ種目</h2>
        <span className={ui.hint}>
          {sorted.length - hiddenAll.length}件 / 目標{' '}
          {sorted.filter((e) => !e.hidden && e.goal != null).length}件
          {hiddenAll.length > 0 && ` / 非表示 ${hiddenAll.length}件`}
        </span>
      </header>

      {/* 追加は一番上。登録済みが増えるほど、下に置くとスクロールを強いることになる */}
      <div className={ui.btnRow}>
        <button
          type="button"
          className={`${ui.btn} ${ui.btnPrimary}`}
          onClick={() => setAdding(true)}
        >
          ＋ マイ種目に追加
        </button>
      </div>

      {/* 一覧の続きに出すと、どこまでが追加の画面か分からなくなるのでモーダルにする */}
      <Modal open={adding} title="マイ種目に追加" onClose={() => setAdding(false)}>
        <div>
          <CatalogPicker exercises={exercises} onAdd={onAdd} />

          <div className={s.newForm}>
            <div className={s.pickerLabel}>カタログにない種目を作る</div>

            <label className={s.newField}>
              名前
              <input
                type="text"
                value={form.name}
                maxLength={40}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </label>

            <label className={s.newField}>
              部位
              <select
                value={form.group}
                onChange={(e) => setForm((f) => ({ ...f, group: e.target.value as ExerciseGroup }))}
              >
                {EXERCISE_GROUP_ORDER.map((g) => (
                  <option key={g} value={g}>
                    {GROUP_LABELS[g]}
                  </option>
                ))}
              </select>
            </label>

            <div className={ui.btnRow}>
              <button
                type="button"
                className={`${ui.btn} ${ui.btnGhost} ${ui.btnSm}`}
                aria-expanded={advanced}
                onClick={() => setAdvanced((v) => !v)}
              >
                {advanced ? '詳細設定を閉じる' : '詳細設定'}
              </button>
            </div>

            {advanced && (
              <>
                {/* 器具の名前ではなく、見れば分かる持ち方を選ばせる */}
                <label className={s.newField}>
                  負荷の数え方
                  <select
                    value={form.loadMode}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, loadMode: e.target.value as LoadMode }))
                    }
                  >
                    {LOAD_MODE_ORDER.map((m) => (
                      <option key={m} value={m}>
                        {LOAD_MODE_LABELS[m]}
                      </option>
                    ))}
                  </select>
                  <small>{LOAD_MODE_HINTS[form.loadMode]}</small>
                </label>

                <label className={s.newField}>
                  回数の単位
                  <select
                    value={form.repUnit}
                    onChange={(e) => setForm((f) => ({ ...f, repUnit: e.target.value as RepUnit }))}
                  >
                    <option value="reps">回（レップ）</option>
                    <option value="seconds">秒（プランクなど）</option>
                  </select>
                  <small>秒で数える種目は挙上量に計上しません（挙上量＝重量×レップ数のため）</small>
                </label>

                {form.loadMode === 'bodyweight' && (
                  <label className={s.newField}>
                    体重が乗る割合（懸垂 1.0 / 腕立て 0.65 など）
                    <input
                      type="number"
                      inputMode="decimal"
                      step={0.05}
                      min={FACTOR_RANGE[0]}
                      max={FACTOR_RANGE[1]}
                      placeholder="1"
                      value={form.bodyweightFactor ?? ''}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, bodyweightFactor: numOrNull(e.target.value) }))
                      }
                    />
                  </label>
                )}

                {form.repUnit === 'reps' && (
                  <label className={s.newField}>
                    1RM換算の分母（ベンチ 40 / スクワット・デッド 33.3 / 既定 30）
                    <input
                      type="number"
                      inputMode="decimal"
                      step={0.1}
                      min={RM_DIVISOR_RANGE[0]}
                      max={RM_DIVISOR_RANGE[1]}
                      value={form.rmDivisor}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          rmDivisor: numOrNull(e.target.value) ?? f.rmDivisor,
                        }))
                      }
                    />
                  </label>
                )}
              </>
            )}

            <div className={ui.btnRow}>
              <button
                type="button"
                className={`${ui.btn} ${ui.btnPrimary} ${ui.btnSm}`}
                disabled={form.name.trim() === ''}
                onClick={submit}
              >
                追加
              </button>
            </div>

            <p className={ui.note}>
              名前と部位だけで作れます。触らなければ「そのまま重量」「回で数える」になり、
              あとから各行の「設定」で変えられます。
            </p>
          </div>
        </div>
      </Modal>

      {sorted.length === 0 ? (
        <p className={ui.emptyState}>マイ種目はまだ空です。</p>
      ) : (
        <>
          {sorted.length > FILTER_THRESHOLD && (
            <ExerciseFilterBar
              query={query}
              onQuery={setQuery}
              group={filter}
              onGroup={setFilter}
              exercises={sorted}
            />
          )}

          {/*
            部位ごとに見出しを付ける。並び替えを持たないので、探し方は「何番目か」ではなく
            「どの部位か」になる。見出しは主部位で切る（一覧の絞り込みと同じ切り方）
          */}
          {EXERCISE_GROUP_ORDER.map((group) => {
            const items = shown.filter((ex) => ex.group === group);
            if (items.length === 0) return null;

            return (
              <div key={group}>
                <div className={s.manageGroup}>{GROUP_LABELS[group]}</div>

                {items.map(card)}
              </div>
            );
          })}

          {filtered.length === 0 && (
            <p className={ui.emptyState}>このフィルターに合う種目はありません。</p>
          )}

          {hiddenShown.length > 0 && (
            <>
              <div className={s.manageGroup}>非表示</div>
              {hiddenShown.map(card)}
            </>
          )}

          <p className={ui.note}>目標も、種目そのものの性質も、行の入口から開けます。</p>
          {/* 80 文字以内 */}
          <p className={ui.note}>
            非表示にすると、記録やプリセットで選ぶときの候補から外れます。
            記録は残るので、推移では今までどおり見られます。
          </p>
        </>
      )}

      {/*
        目標と設定は**ダイアログで出す。** 行の中で展開すると、開くたびに下の種目が
        押し下げられ、次に押したい場所が動く（部位の目標の面と同じ扱いにそろえる）。
      */}
      {goalExercise && (
        <Modal open title={`${goalExercise.name}の目標`} onClose={() => setGoalOf(null)}>
          <GoalEditor exercise={goalExercise} sessions={sessions} onUpdate={onUpdate} />
        </Modal>
      )}

      {settingsExercise && (
        <Modal open title={`${settingsExercise.name}の設定`} onClose={() => setEditing(null)}>
          <ExerciseSettingsForm exercise={settingsExercise} onUpdate={onUpdate} />
        </Modal>
      )}
    </section>
  );
}
