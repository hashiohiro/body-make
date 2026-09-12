import { useState } from 'react';
import { EXERCISE_GROUP_ORDER, GROUP_LABELS, emptyCheckValues } from '../../lib/exerciseCatalog';
import { ExerciseCalcFields } from './ExerciseCalcFields';
import { newId } from '../../lib/id';
import { Select } from '../Select';
import { TextField } from '../TextField';
import { DEFAULT_RM_DIVISOR } from '../../lib/training';
import type { Exercise, ExerciseGroup, LoadMode, RepUnit } from '../../types';
import { Button } from '../Button';
import ui from '../../styles/ui.module.scss';
import s from './training.module.scss';

/** 種目名の上限。一覧で枠を割らない長さ（プリセット名より少し長く取る） */
const NAME_MAX = 40;

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

  const name = form.name.trim();
  /*
   * 同じ名前は作らせない。**プリセットと同じ作法。**
   * 黙って 2 つ並べると、一覧（マイ種目・目標・移行の候補・プリセットの中身）で
   * どちらがどちらか分からなくなる。手がかりは名前と部位しかない。
   *
   * 見ているのは自分の持ちもの（非表示・臨時のものも含む）。伏せた種目と同じ名前でも
   * 一覧では見分けられないので、出ていないからといって許すわけにはいかない。
   */
  const taken = exercises.some((e) => e.name === name);

  const submit = () => {
    if (!name || taken) return;
    // 自作種目だけ randomUUID。カタログ由来は固定 ID なので入れ直しても過去ログが繋がる
    onCreate({
      id: newId(),
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
        {/* 追加のボタンは部位と詳細設定の下にある。打ち終わりに Enter でそのまま作れる */}
        <TextField
          value={form.name}
          maxLength={NAME_MAX}
          onChange={(value) => setForm((f) => ({ ...f, name: value }))}
          onCommit={name === '' || taken ? undefined : submit}
        />
      </label>

      <label className={s.newField}>
        部位
        <Select
          value={form.group}
          options={EXERCISE_GROUP_ORDER.map((g) => ({ id: g, label: GROUP_LABELS[g] }))}
          onChange={(group) => setForm((f) => ({ ...f, group }))}
        />
      </label>

      <div className={ui.btnRow}>
        <Button tone="ghost" size="sub" expanded={advanced} onClick={() => setAdvanced((v) => !v)}>
          {advanced ? '詳細設定を閉じる' : '詳細設定'}
        </Button>
      </div>

      {advanced && (
        <ExerciseCalcFields
          value={form}
          onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
        />
      )}

      <div className={ui.btnRow}>
        <Button tone="primary" size="sub" disabled={name === '' || taken} onClick={submit}>
          追加
        </Button>
      </div>

      {taken && <p className={ui.note}>同じ名前の種目があります（非表示のものも含みます）。</p>}

      <p className={ui.note}>
        名前と部位だけで作れます。触らなければ「ウエイト1つ」「回で数える」になり、
        あとから各行の「設定」で変えられます。
      </p>
    </div>
  );
}
