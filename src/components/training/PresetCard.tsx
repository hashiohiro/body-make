import { sameSet } from '../../lib/array';
import { useState } from 'react';
import { PRESET_NAME_MAX } from '../../lib/storage';
import type { Preset } from '../../types';
import { CardHeader } from '../CardHeader';
import { useConfirm } from '../ConfirmDialog';
import { removePresetRequest } from './presetConfirm';
import ui from '../../styles/ui.module.scss';
import { MiniButton } from '../MiniButton';
import { NameEntryRow } from '../NameEntryRow';
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
 *
 * 名前は一意。同じ名前で保存すると、確認したうえで中身を置き換える。
 */
export function PresetCard({ presets, currentIds, currentName, onAdd, onSave, onRemove }: Props) {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [ask, confirmDialog] = useConfirm();

  const composing = currentIds.length > 0;
  // いまの組み合わせがそのまま残っているなら、保存しても同じものが増えるだけ
  const alreadySaved = presets.some((preset) => sameSet(preset.exerciseIds, currentIds));
  if (composing && alreadySaved) return null;

  return (
    <section className={ui.card}>
      <CardHeader
        title="プリセット"
        hint={!composing && presets.length > 0 ? `${presets.length}件` : null}
      />

      {composing ? (
        saving ? (
          <NameEntryRow
            value={name}
            onChange={setName}
            label="プリセットの名前"
            commitLabel="この名前で保存"
            cancelLabel="保存をやめる"
            disabled={name.trim() === ''}
            onCancel={() => setSaving(false)}
            onCommit={() => {
              const save = () => {
                onSave(name, currentIds);
                setSaving(false);
              };
              /*
               * 同じ名前があれば上書きする。黙って 2 つ並べると、
               * 一覧で名前から見分けられないものが増える（手がかりが部位と件数しかない）。
               * 消えるのは前の中身なので、上書きすることは先に伝える。
               */
              const trimmed = name.trim().slice(0, PRESET_NAME_MAX);
              if (!presets.some((preset) => preset.name === trimmed)) {
                save();
                return;
              }
              ask({
                title: '同じ名前のプリセットがあります',
                subject: trimmed,
                note: `中身をいまの組み合わせ（${currentIds.length}種目）に置き換えます。前の組み合わせは戻せません。`,
                confirmLabel: 'この組み合わせで上書き',
                destructive: true,
                onConfirm: save,
              });
            }}
          />
        ) : (
          <div className={s.presetSave}>
            <span className={s.presetSaveLabel}>
              いまの組み合わせを保存（{currentIds.length}種目）
            </span>
            <MiniButton
              label="いまの組み合わせをプリセットに保存"
              onClick={() => {
                // 下書きは部位から作る。そのまま使ってもいいし、書き換えてもいい
                setName(currentName);
                setSaving(true);
              }}
            >
              ＋
            </MiniButton>
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

            <MiniButton
              label={`${preset.name}をこの日に入れる`}
              onClick={() => onAdd(preset.exerciseIds)}
            >
              ＋
            </MiniButton>
            <MiniButton
              label={`${preset.name}を削除`}
              // 聞き方は設定のプリセット管理と同じ（presetConfirm）
              onClick={() => ask(removePresetRequest(preset, () => onRemove(preset.id)))}
            >
              ×
            </MiniButton>
          </div>
        ))
      )}

      {confirmDialog}
    </section>
  );
}
