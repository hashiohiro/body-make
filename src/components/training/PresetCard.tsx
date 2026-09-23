import { sameSet } from '../../lib/array';
import { PresetRow } from './PresetRow';
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
  /**
   * 開いている日の週メニュー。**その日のぶんだけ、1 つ。**
   * 一覧の先頭に別枠で出す（＋ の「プリセットから入れる」と同じ並べ方）。
   */
  todayMenu: PresetOption | null;
  onSave: (name: string, exerciseIds: readonly string[]) => void;
  onUpdate: (preset: Preset) => void;
  /** 組み合わせをまとめてその日に入れる。**まだ何も入っていない日にだけ出す** */
  onApply: (preset: PresetOption) => void;
}

/**
 * その日のプリセット。**まだ空なら呼び出し、組んであれば保存。**
 *
 * 一度は呼び出しを外して保存だけにした（＋ の「プリセットから入れる」と
 * 同じ一覧が 2 か所になるため）。ただ**プリセットで組む日の動線がいちばん深く**なり、
 * ＋ → メニュー → プリセット → 選ぶ の 4 タップになっていた。
 * そのあいだ、この面の「まだ空」の側は説明文が 2 行あるだけで空いていた。
 *
 * **状態で役割を分ける。**まだ 1 つも入っていない日は呼び出す以外にすることが無く、
 * 入っている日は呼び出すと今の組み合わせが混ざる。**同時に両方は出ない**ので、
 * 一覧が 2 か所に見える瞬間もない。
 *
 * 削除は設定のプリセット画面にある。ここには置かない。
 *
 * この面が要る理由は `docs/design-training.md` §7.2——組み合わせを保存できることに
 * 気づけない、という指摘への答えなので、記録している最中に見える場所に置く。
 *
 * 持つのは種目だけで、重量もレップもセット数も持たない。
 * そこまで持たせると、記録するアプリではなく計画を配るアプリになる（設計 §1.1）。
 */
export function PresetCard({
  presets,
  currentIds,
  currentName,
  applied,
  todayMenu,
  onSave,
  onUpdate,
  onApply,
}: Props) {
  const t = useT();
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [ask, confirmDialog] = useConfirm();

  const composing = currentIds.length > 0;
  // いまの組み合わせがそのまま残っているなら、保存しても同じものが増えるだけ
  const alreadySaved = presets.some((preset) => sameSet(preset.exerciseIds, currentIds));
  /** 呼び出したあとに中身を変えたか。変えていなければ上書きする意味がない */
  const changed = applied != null && !sameSet(applied.exerciseIds, currentIds);

  /* 行の形は ＋ の一覧・週メニューと同じ部品（`PresetRow`） */
  const row = (preset: PresetOption) => (
    <PresetRow
      key={preset.id}
      name={preset.name}
      groups={preset.groupsLabel}
      count={preset.exerciseIds.length}
      label={t('picker.applyPreset', { name: preset.name })}
      onClick={() => onApply(preset)}
    />
  );

  return (
    <section className={ui.card}>
      <CardHeader title={t('settings.presets')} />

      {!composing ? (
        /*
          まだ何も入っていない日。**押せば入る一覧をそのまま出す。**
          持っていなければ、作り方だけを書く（押せない一覧は出さない）。
        */
        presets.length === 0 && todayMenu == null ? (
          <p className={ui.emptyState}>
            {t('preset.saveHint')}
            <br />
            {t('preset.saveHintLoad')}
          </p>
        ) : (
          <div>
            {/*
              今日の曜日に置いているものを先頭に、別枠で出す。
              **出すだけで判定はしない**——押さなければ何も起きない（§11-3）。
            */}
            {todayMenu && (
              <>
                <p className={ui.sectionLabel}>{t('picker.todayMenu')}</p>
                {row(todayMenu)}
              </>
            )}
            {presets.length > 0 && (
              <>
                {todayMenu && <p className={ui.sectionLabel}>{t('settings.presets')}</p>}
                {presets.map(row)}
              </>
            )}
          </div>
        )
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
