import { useState } from 'react';
import type { Preset } from '../../types';
import ui from '../../styles/ui.module.scss';
import s from './training.module.scss';

export interface PresetOption extends Preset {
  /** その組み合わせでやる部位。名前だけでは中身が思い出せない */
  groups: string;
}

interface Props {
  presets: readonly PresetOption[];
  /** その日にいま入っている種目 */
  currentIds: readonly string[];
  /** 保存するときの名前の下書き。その日の部位から作る */
  currentName: string;
  onAdd: (exerciseIds: readonly string[]) => void;
  onSave: (name: string, exerciseIds: readonly string[]) => void;
  onRemove: (id: string) => void;
}

/** 並びは違っても、同じ種目の組み合わせなら同じものとして扱う */
function sameSet(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((id) => set.has(id));
}

/**
 * よくやる種目の組み合わせ。
 *
 * 置き場所は画面のいちばん上（体組成／トレーニングの切り替えのすぐ下）で固定し、
 * **中身のほうを、その日の状態に合わせて変える**。
 *
 *   まだ種目を入れていない日 … 保存した組み合わせを呼び出す
 *   種目を入れた日           … いまの組み合わせを保存する
 *   すでに同じ組み合わせがある … 何も出さない（することが無い）
 *
 * 持つのは種目だけで、重量もレップもセット数も持たない。
 * そこまで持たせると、記録するアプリではなく計画を配るアプリになる（設計 §1.1）。
 */
export function PresetCard({ presets, currentIds, currentName, onAdd, onSave, onRemove }: Props) {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  const composing = currentIds.length > 0;
  // いまの組み合わせがそのまま残っているなら、保存しても同じものが増えるだけ
  const alreadySaved = presets.some((preset) => sameSet(preset.exerciseIds, currentIds));
  if (composing && alreadySaved) return null;

  return (
    <section className={ui.card}>
      <header className={ui.cardHeader}>
        <h2 className={ui.cardTitle}>プリセット</h2>
        {!composing && presets.length > 0 && <span className={ui.hint}>{presets.length}件</span>}
      </header>

      {composing ? (
        saving ? (
          <div className={s.presetSave}>
            <input
              type="text"
              className={s.presetInput}
              value={name}
              maxLength={40}
              aria-label="プリセットの名前"
              onChange={(e) => setName(e.target.value)}
            />
            <button
              type="button"
              className={s.miniBtn}
              aria-label="この名前で保存"
              disabled={name.trim() === ''}
              onClick={() => {
                onSave(name, currentIds);
                setSaving(false);
              }}
            >
              ✓
            </button>
            <button
              type="button"
              className={s.miniBtn}
              aria-label="保存をやめる"
              onClick={() => setSaving(false)}
            >
              ×
            </button>
          </div>
        ) : (
          <div className={s.presetSave}>
            <span className={s.presetSaveLabel}>
              いまの組み合わせを保存（{currentIds.length}種目）
            </span>
            <button
              type="button"
              className={s.miniBtn}
              aria-label="いまの組み合わせをプリセットに保存"
              onClick={() => {
                // 下書きは部位から作る。そのまま使ってもいいし、書き換えてもいい
                setName(currentName);
                setSaving(true);
              }}
            >
              ＋
            </button>
          </div>
        )
      ) : presets.length === 0 ? (
        <p className={ui.emptyState}>
          よくやる組み合わせに名前を付けて残すと、次から1つ押すだけで入ります。
          <br />
          種目を入れると、ここが保存の場所になります。
        </p>
      ) : (
        presets.map((preset) => (
          <div key={preset.id} className={s.presetRow}>
            <span className={s.presetName}>{preset.name}</span>
            <span className={s.presetGroups}>{preset.groups}</span>
            <span className={s.presetCount}>{preset.exerciseIds.length}種目</span>

            <button
              type="button"
              className={s.miniBtn}
              aria-label={`${preset.name}をこの日に入れる`}
              onClick={() => onAdd(preset.exerciseIds)}
            >
              ＋
            </button>
            <button
              type="button"
              className={s.miniBtn}
              aria-label={`${preset.name}を削除`}
              onClick={() => {
                // 記録は消えないが、付けた名前と組み合わせは戻せない
                if (confirm(`プリセット「${preset.name}」を削除します。\n元に戻せません。`)) {
                  onRemove(preset.id);
                }
              }}
            >
              ×
            </button>
          </div>
        ))
      )}
    </section>
  );
}
