import { sameSet } from '../../lib/array';
import { useState } from 'react';
import { PRESET_NAME_MAX } from '../../lib/storage';
import type { Preset } from '../../types';
import { CardHeader } from '../CardHeader';
import { useConfirm } from '../ConfirmDialog';
import ui from '../../styles/ui.module.scss';
import { Button } from '../Button';
import { NameEntryRow } from '../NameEntryRow';
import s from './training.module.scss';
import { useT } from '../../lib/i18n';

export interface PresetOption extends Preset {
  /** その組み合わせでやる部位の読み。名前だけでは中身が思い出せない */
  groupsLabel: string;
}

interface Props {
  presets: readonly PresetOption[];
  /** その日にいま入っている種目 */
  currentIds: readonly string[];
  /** 保存するときの名前の下書き。その日の部位から作る */
  currentName: string;
  /**
   * その日を作った元のプリセット。呼び出していなければ null。
   *
   * **上書きの相手は ID で決める。**名前で突き合わせていたときは、
   * 名前を変えた瞬間に別のプリセットが増えていた。
   */
  applied: PresetOption | null;
  onSave: (name: string, exerciseIds: readonly string[]) => void;
  onUpdate: (preset: Preset) => void;
}

/**
 * いまの組み合わせに名前を付けて残す。**保存だけの面。**
 *
 * 以前はここに一覧も置いて、呼び出しと削除もできた。ただ**呼び出しは ＋ の
 * 「プリセットから入れる」がやる**ので、同じ一覧が 2 か所にあった。
 * 削除は設定のプリセット画面にある。役割を 1 つずつに割り直して、
 * ここには**ここにしか無い仕事**（いまの日から作る）だけを残す。
 *
 * この面が要る理由は `docs/design-training.md` §7.2——組み合わせを保存できることに
 * 気づけない、という指摘への答えなので、記録している最中に見える場所に置く。
 *
 * 持つのは種目だけで、重量もレップもセット数も持たない。
 * そこまで持たせると、記録するアプリではなく計画を配るアプリになる（設計 §1.1）。
 */
export function PresetCard({ presets, currentIds, currentName, applied, onSave, onUpdate }: Props) {
  const t = useT();
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [ask, confirmDialog] = useConfirm();

  const composing = currentIds.length > 0;
  // いまの組み合わせがそのまま残っているなら、保存しても同じものが増えるだけ
  const alreadySaved = presets.some((preset) => sameSet(preset.exerciseIds, currentIds));
  /** 呼び出したあとに中身を変えたか。変えていなければ上書きする意味がない */
  const changed = applied != null && !sameSet(applied.exerciseIds, currentIds);

  return (
    <section className={ui.card}>
      <CardHeader title={t('settings.presets')} />

      {!composing ? (
        <p className={ui.emptyState}>
          {t('preset.saveHint')}
          <br />
          {t('preset.saveHintLoad')}
        </p>
      ) : alreadySaved && !changed ? (
        <p className={ui.emptyState}>{t('preset.alreadySaved')}</p>
      ) : saving ? (
        <NameEntryRow
          value={name}
          onChange={setName}
          label={t('preset.nameLabel')}
          placeholder={t('preset.nameLabel')}
          commitLabel={t('preset.saveWithName')}
          cancelLabel={t('preset.cancelSave')}
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
              title: t('preset.nameTaken'),
              subject: trimmed,
              note: t('preset.overwriteNote', { n: currentIds.length }),
              confirmLabel: t('preset.overwrite'),
              destructive: true,
              onConfirm: save,
            });
          }}
        />
      ) : (
        <>
          <p className={s.presetSaveLabel}>{t('preset.current', { n: currentIds.length })}</p>

          {/*
            **押す言葉に結果を書く。**記号（＋ や ↻）では、保存なのか
            入れ直しなのかが読めない。`ChoicePanel` と同じ作法にそろえる。

            呼び出したプリセットを直して戻す道は、相手を **ID で決める**。
            名前で突き合わせていたときは、名前を変えた瞬間に別のものが増えていた。
            結果が字に書いてあるので、確認は挟まない。
          */}
          <div className={ui.btnRow}>
            {changed && applied && (
              <Button
                tone="primary"
                onClick={() => onUpdate({ ...applied, exerciseIds: [...currentIds] })}
              >
                {t('preset.updateNamed', { name: applied.name })}
              </Button>
            )}
            <Button
              tone={changed ? undefined : 'primary'}
              onClick={() => {
                // 下書きは部位から作る。そのまま使ってもいいし、書き換えてもいい
                setName(currentName);
                setSaving(true);
              }}
            >
              {changed ? t('preset.saveAsOther') : t('preset.save')}
            </Button>
          </div>
        </>
      )}

      {confirmDialog}
    </section>
  );
}
