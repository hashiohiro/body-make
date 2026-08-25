import { useState } from 'react';
import {
  GROUP_LABELS,
  GROUP_ORDER,
  LOAD_MODE_HINTS,
  LOAD_MODE_LABELS,
  LOAD_MODE_ORDER,
  REP_UNIT_LABELS,
  SUB_GROUP_WEIGHT,
  SUB_GROUP_WEIGHT_STEPS,
} from '../../lib/exerciseCatalog';
import { FACTOR_RANGE, RM_DIVISOR_RANGE } from '../../lib/storage';
import { DEFAULT_RM_DIVISOR } from '../../lib/training';
import type { Exercise, LoadMode, MuscleGroup, RepUnit } from '../../types';
import { CatalogPicker } from './CatalogPicker';
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
  onMove: (id: string, delta: number) => void;
}

function numOrNull(raw: string): number | null {
  const n = Number(raw);
  return raw.trim() === '' || !Number.isFinite(n) ? null : n;
}

function goalLabel(exercise: Exercise): string | null {
  if (!exercise.goal) return null;
  const unit = exercise.goal.type === 'weight' ? 'kg' : REP_UNIT_LABELS[exercise.repUnit];
  return `${exercise.goal.value}${unit}`;
}

const EMPTY_FORM = {
  name: '',
  group: 'chest' as MuscleGroup,
  // 既定のまま作れる値。触りたい人だけ「詳細設定」から変える
  loadMode: 'standard' as LoadMode,
  repUnit: 'reps' as RepUnit,
  bodyweightFactor: null as number | null,
  rmDivisor: DEFAULT_RM_DIVISOR,
};

/** 絞り込みチップを出す件数。これ以下なら一覧のまま見渡せる */
const FILTER_THRESHOLD = 8;

/**
 * 種目の追加・並べ替え・削除と、種目ごとの性質。
 *
 * 目標値はここに置かない。進捗を見ながら何度も変わるので目標タブが持つ。
 * 一覧には目標をタグとして出す。どの種目に目標があるかは、ここでも見えていたほうがいい。
 */
export function ExerciseManager({ exercises, usage, onAdd, onUpdate, onRemove, onMove }: Props) {
  const [adding, setAdding] = useState(false);
  const [filter, setFilter] = useState<MuscleGroup | 'all'>('all');
  const [editing, setEditing] = useState<string | null>(null);
  // 詳細設定のさらに内側。負荷の数え方・単位・換算の分母
  const [calc, setCalc] = useState(false);
  // 自作フォームで聞くのは名前と部位だけ。残りは既定値で作れる
  const [advanced, setAdvanced] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const openDetail = (ex: Exercise) => {
    setEditing((cur) => (cur === ex.id ? null : ex.id));
    setCalc(false);
  };

  // 取り込んだデータが刻みから外れた値でも、選択中の値は必ず出す
  const subWeightOptions = (current: number) =>
    SUB_GROUP_WEIGHT_STEPS.includes(current)
      ? SUB_GROUP_WEIGHT_STEPS
      : [...SUB_GROUP_WEIGHT_STEPS, current].sort((a, b) => a - b);

  const sorted = [...exercises].sort((a, b) => a.order - b.order);
  const visible =
    filter === 'all'
      ? sorted
      : sorted.filter((e) => e.group === filter || e.subGroups.some((x) => x.group === filter));

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

  return (
    <section className={ui.card}>
      <header className={ui.cardHeader}>
        <h2 className={ui.cardTitle}>種目</h2>
        <span className={ui.hint}>
          {sorted.length}件 / 目標 {sorted.filter((e) => e.goal != null).length}件
        </span>
      </header>

      {/* 追加は一番上。登録済みが増えるほど、下に置くとスクロールを強いることになる */}
      <div className={ui.btnRow}>
        <button
          type="button"
          className={`${ui.btn} ${ui.btnPrimary}`}
          onClick={() => setAdding(true)}
        >
          ＋ 種目を追加
        </button>
      </div>

      {/* 一覧の続きに出すと、どこまでが追加の画面か分からなくなるのでモーダルにする */}
      <Modal open={adding} title="種目を追加" onClose={() => setAdding(false)}>
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
                onChange={(e) => setForm((f) => ({ ...f, group: e.target.value as MuscleGroup }))}
              >
                {GROUP_ORDER.map((g) => (
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
        <p className={ui.emptyState}>まだ種目がありません。</p>
      ) : (
        <>
          {sorted.length > FILTER_THRESHOLD && (
            <div
              className={`${ui.chipRow} ${s.filterRow}`}
              role="group"
              aria-label="部位で絞り込む"
            >
              {(['all', ...GROUP_ORDER] as (MuscleGroup | 'all')[]).map((g) => (
                <button
                  key={g}
                  type="button"
                  className={ui.chip}
                  aria-pressed={filter === g}
                  onClick={() => setFilter(g)}
                >
                  {g === 'all' ? 'すべて' : GROUP_LABELS[g]}
                </button>
              ))}
            </div>
          )}

          {visible.map((ex, i) => (
            <div key={ex.id}>
              <div className={s.manageRow}>
                <span className={s.manageName}>{ex.name}</span>
                <span className={s.exTag}>
                  {[ex.group, ...ex.subGroups.map((x) => x.group)]
                    .map((g) => GROUP_LABELS[g])
                    .join('·')}
                </span>
                {/* 目標は目標タブで決めるが、どの種目にあるかは一覧でも見えるようにする */}
                {goalLabel(ex) && <span className={s.goalTag}>{goalLabel(ex)}</span>}

                {/* 並べ替えは全体の順序を動かすので、絞り込み中は無効にする */}
                <button
                  type="button"
                  className={s.miniBtn}
                  aria-label={`${ex.name}を上へ`}
                  disabled={filter !== 'all' || i === 0}
                  onClick={() => onMove(ex.id, -1)}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className={s.miniBtn}
                  aria-label={`${ex.name}を下へ`}
                  disabled={filter !== 'all' || i === visible.length - 1}
                  onClick={() => onMove(ex.id, 1)}
                >
                  ↓
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
                  aria-label={`${ex.name}を削除`}
                  onClick={() => remove(ex)}
                >
                  ×
                </button>
              </div>

              {editing === ex.id && (
                <div className={s.newForm}>
                  {/* フォーム次第で主働筋が変わる種目（ディップスなど）があるので、部位も変えられる */}
                  <label className={s.newField}>
                    部位
                    <select
                      value={ex.group}
                      onChange={(e) => {
                        const group = e.target.value as MuscleGroup;
                        // 新しい主部位が補助部位に残っていると、その部位を二重に数える。
                        // 保存時のサニタイズは読み込みでしか走らないので、ここで落とす
                        onUpdate({
                          ...ex,
                          group,
                          subGroups: ex.subGroups.filter((x) => x.group !== group),
                        });
                      }}
                    >
                      {GROUP_ORDER.map((g) => (
                        <option key={g} value={g}>
                          {GROUP_LABELS[g]}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className={s.newField}>
                    補助的に使う部位
                    <div className={s.pickerList}>
                      {GROUP_ORDER.filter((g) => g !== ex.group).map((g) => {
                        const on = ex.subGroups.some((x) => x.group === g);
                        return (
                          <button
                            key={g}
                            type="button"
                            className={s.pickerBtn}
                            aria-pressed={on}
                            onClick={() =>
                              onUpdate({
                                ...ex,
                                subGroups: on
                                  ? ex.subGroups.filter((x) => x.group !== g)
                                  : [...ex.subGroups, { group: g, weight: SUB_GROUP_WEIGHT }],
                              })
                            }
                          >
                            {GROUP_LABELS[g]}
                          </button>
                        );
                      })}
                    </div>
                    {/*
                      関与の大きさは種目で違う。デッドリフトの脚は主働筋なので 1、
                      体幹は姿勢の保持なので 0.5 が近い。既定のままでも困らないので、
                      選んだ部位のぶんだけ出す
                    */}
                    {ex.subGroups.map((sub) => (
                      <div key={sub.group} className={s.subWeightRow}>
                        <span className={s.subWeightName}>{GROUP_LABELS[sub.group]}</span>
                        <div className={s.pickerList}>
                          {subWeightOptions(sub.weight).map((w) => (
                            <button
                              key={w}
                              type="button"
                              className={`${s.pickerBtn} ${s.stepBtn}`}
                              aria-pressed={sub.weight === w}
                              aria-label={`${GROUP_LABELS[sub.group]}を${w}で数える`}
                              onClick={() =>
                                onUpdate({
                                  ...ex,
                                  subGroups: ex.subGroups.map((x) =>
                                    x.group === sub.group ? { ...x, weight: w } : x,
                                  ),
                                })
                              }
                            >
                              ×{w}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                    <small>
                      主部位を1としたときの割合。ベンチが胸1・肩0.5・腕0.5なら、3セットで
                      胸3・肩1.5・腕1.5
                    </small>
                  </div>

                  {/*
                    ここから下は計算の仕方。カタログから追加すれば既に埋まっていて、
                    触る必要がほとんど無い。開いた瞬間に並べると
                    「決めなければいけない項目」に見えるので、もう一段畳む
                  */}
                  <button
                    type="button"
                    className={`${ui.btn} ${ui.btnGhost} ${ui.btnSm}`}
                    aria-expanded={calc}
                    onClick={() => setCalc((v) => !v)}
                  >
                    {calc ? '計算方法を閉じる' : '計算方法を変える'}
                  </button>

                  {calc && (
                    <>
                      <label className={s.newField}>
                        負荷の数え方
                        <select
                          value={ex.loadMode}
                          onChange={(e) =>
                            onUpdate({ ...ex, loadMode: e.target.value as LoadMode })
                          }
                        >
                          {LOAD_MODE_ORDER.map((m) => (
                            <option key={m} value={m}>
                              {LOAD_MODE_LABELS[m]}
                            </option>
                          ))}
                        </select>
                        <small>{LOAD_MODE_HINTS[ex.loadMode]}</small>
                      </label>

                      <label className={s.newField}>
                        回数の単位
                        <select
                          value={ex.repUnit}
                          onChange={(e) => onUpdate({ ...ex, repUnit: e.target.value as RepUnit })}
                        >
                          {(Object.keys(REP_UNIT_LABELS) as RepUnit[]).map((u) => (
                            <option key={u} value={u}>
                              {u === 'reps' ? '回（レップ）' : '秒（プランクなど）'}
                            </option>
                          ))}
                        </select>
                        <small>秒で数える種目は挙上量に計上しません</small>
                      </label>

                      {ex.loadMode === 'bodyweight' && (
                        <label className={s.newField}>
                          体重が乗る割合（懸垂 1.0 / 腕立て 0.65 など）
                          <input
                            type="number"
                            inputMode="decimal"
                            step={0.05}
                            min={FACTOR_RANGE[0]}
                            max={FACTOR_RANGE[1]}
                            value={ex.bodyweightFactor ?? ''}
                            onChange={(e) =>
                              onUpdate({ ...ex, bodyweightFactor: numOrNull(e.target.value) })
                            }
                          />
                        </label>
                      )}
                    </>
                  )}

                  {ex.repUnit === 'reps' && (
                    <label className={s.newField}>
                      1RM換算の分母（ベンチ 40 / スクワット・デッド 33.3 / 既定 30）
                      <input
                        type="number"
                        inputMode="decimal"
                        step={0.1}
                        min={RM_DIVISOR_RANGE[0]}
                        max={RM_DIVISOR_RANGE[1]}
                        value={ex.rmDivisor}
                        onChange={(e) =>
                          onUpdate({
                            ...ex,
                            rmDivisor: numOrNull(e.target.value) ?? ex.rmDivisor,
                          })
                        }
                      />
                    </label>
                  )}
                </div>
              )}
            </div>
          ))}

          <p className={ui.note}>
            目標は目標タブで決めます。ここで決めるのは、種目そのものの性質だけです。
          </p>
        </>
      )}
    </section>
  );
}
