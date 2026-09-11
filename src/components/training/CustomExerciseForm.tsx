import { useState } from 'react';
import {
  EXERCISE_GROUP_ORDER,
  GROUP_LABELS,
  LOAD_MODE_HINTS,
  LOAD_MODE_LABELS,
  LOAD_MODE_ORDER,
  emptyCheckValues,
} from '../../lib/exerciseCatalog';
import { FACTOR_RANGE, RM_DIVISOR_RANGE } from '../../lib/storage';
import { DEFAULT_RM_DIVISOR } from '../../lib/training';
import type { Exercise, ExerciseGroup, LoadMode, RepUnit } from '../../types';
import ui from '../../styles/ui.module.scss';
import s from './training.module.scss';

function numOrNull(raw: string): number | null {
  const n = Number(raw);
  return raw.trim() === '' || !Number.isFinite(n) ? null : n;
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

interface Props {
  /** いま持っている種目。並び順（order）を決めるのに使う */
  exercises: readonly Exercise[];
  /** 作った種目を受け取る。マイ種目へ足すのも、その日に入れるのも呼び出し側が決める */
  onCreate: (exercise: Exercise) => void;
}

/**
 * カタログにない種目を作る。**カタログを出す面すべてに置く。**
 *
 * 以前は設定のマイ種目にしか無かった。記録しようとしてカタログに無いと気づいた人が、
 * 設定タブを探しに行くことになり、しかも記録画面へ戻ってもう一度選び直すことになる。
 * 「カタログから選ぶ」と「無いから作る」は同じ場面で続くので、同じ面に置く。
 *
 * 聞くのは**名前と部位だけ。**残りは既定値で作れて、あとから種目の設定で変えられる。
 */
export function CustomExerciseForm({ exercises, onCreate }: Props) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [advanced, setAdvanced] = useState(false);

  const submit = () => {
    const name = form.name.trim();
    if (!name) return;
    // 自作種目だけ randomUUID。カタログ由来は固定 ID なので入れ直しても過去ログが繋がる
    onCreate({
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
      shelf: 'listed',
      // 構成チェックの値は持たせない。必要になったら種目の設定から入れる
      ...emptyCheckValues(),
    });
    setForm(EMPTY_FORM);
    setAdvanced(false);
  };

  return (
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
              onChange={(e) => setForm((f) => ({ ...f, loadMode: e.target.value as LoadMode }))}
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
        名前と部位だけで作れます。触らなければ「ウエイト1つ」「回で数える」になり、
        あとから各行の「設定」で変えられます。
      </p>
    </div>
  );
}
