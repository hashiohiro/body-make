import { useState } from 'react';
import { OrderList } from './OrderList';
import { PickDialog } from './PickDialog';
import { PresetDefaultsForm } from './PresetDefaultsForm';
import { Modal } from '../Modal';
import { dropLastExerciseRequest } from './presetConfirm';
import { exerciseName, groupsOf } from '../../lib/exerciseCatalog';
import { weekdaysLabel } from '../../lib/preset';
import { Tag } from '../Tag';
import { PRESET_NAME_MAX } from '../../lib/storage';
import type { ConfirmRequest } from '../ConfirmDialog';
import type { Exercise, Preset } from '../../types';
import { Button } from '../Button';
import { MiniButton } from '../MiniButton';
import { NameEntryRow } from '../NameEntryRow';
import ui from '../../styles/ui.module.scss';
import s from './training.module.scss';
import { useT } from '../../lib/i18n';

interface Props {
  preset: Preset;
  /** マイ種目。プリセットに足せるのはここにある種目だけ */
  exercises: readonly Exercise[];
  /**
   * 名前の重複を見るための全件。**いま表示していないものとも突き合わせる。**
   * 面が「プリセット」と「週メニュー」に分かれたので、見えている中だけで
   * 判定すると、別の面にある名前と同じものを作れてしまう。
   */
  presets: readonly Preset[];
  onUpdate: (preset: Preset) => void;
  onRemove: (id: string) => void;
  onAddExercises: (exercises: readonly Exercise[]) => void;
  /** 削除の問いは面をまたいで同じものを出す（`presetConfirm`） */
  ask: (request: ConfirmRequest) => void;
}

/** 既定のセットを 1 種目でも決めてあるか */
function hasDefaults(preset: Preset): boolean {
  return Object.keys(preset.defaults).length > 0;
}

/**
 * プリセット 1 件ぶんの行と中身。**プリセット画面と週メニュー画面で同じものを使う。**
 *
 * 持っているものは曜日の有無しか違わないので、名前を変える・種目を出し入れする・
 * 既定のセットを決める・消す、はどちらの面でも同じ操作になる。
 * 面ごとに書き分けると、片方だけ直って挙動がずれる。
 *
 * **曜日はここでは触れない。**曜日を持つかどうかは、その行がどちらの面に居るかを
 * 決めている当のものなので、行の中から変えられると面をまたいで飛ぶことになる。
 * 曜日を付けるのは週のメニューを組むときだけ（`WeekPlanDialog`）。
 */
export function PresetBlock({
  preset,
  exercises,
  presets,
  onUpdate,
  onRemove,
  onAddExercises,
  ask,
}: Props) {
  const t = useT();
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState('');
  const [picking, setPicking] = useState(false);
  const [defaultsOpen, setDefaultsOpen] = useState(false);
  /** 掴んでいる種目。置くまで並びは変えない */
  const [moving, setMoving] = useState<string | null>(null);

  const byId = new Map(exercises.map((e) => [e.id, e]));
  const nameOf = (id: string) => {
    const found = byId.get(id);
    // 括弧は「これは名前ではない」という飾り。語そのものは指摘の面と同じキー
    return found ? exerciseName(t, found) : `（${t('rule.deletedExercise')}）`;
  };
  const trimmed = draft.trim().slice(0, PRESET_NAME_MAX);
  const taken = presets.some((p) => p.id !== preset.id && p.name === trimmed);

  /** 最後の 1 つを外すのは削除と同じ。問いは中身の一覧と選ぶ面で共有する */
  const askDropLast = (exerciseId: string) =>
    ask(dropLastExerciseRequest(t, preset, nameOf(exerciseId), () => onRemove(preset.id)));

  const drop = (exerciseId: string) => {
    if (preset.exerciseIds.length === 1) {
      askDropLast(exerciseId);
      return;
    }
    onUpdate({ ...preset, exerciseIds: preset.exerciseIds.filter((id) => id !== exerciseId) });
  };

  return (
    <div className={s.presetBlock}>
      {/* 押せない理由は**確定ボタンの上**。押したあとの位置に置かない */}
      {renaming && taken && <p className={ui.note}>{t('preset.nameTaken')}</p>}
      {renaming ? (
        <NameEntryRow
          value={draft}
          onChange={setDraft}
          label={t('preset.newNameOf', { name: preset.name })}
          placeholder={t('preset.nameLabel')}
          commitLabel={t('preset.commitName')}
          cancelLabel={t('preset.cancelName')}
          disabled={trimmed === '' || taken}
          onCommit={() => {
            onUpdate({ ...preset, name: draft });
            setRenaming(false);
          }}
          onCancel={() => setRenaming(false)}
        />
      ) : (
        <div className={s.presetRow}>
          <span className={s.presetName}>
            {preset.name}
            {/* 曜日を決めた人にだけ出る札。決めていなければ何も増えない */}
            {preset.weekdays.length > 0 && <Tag>{weekdaysLabel(t, preset.weekdays)}</Tag>}
          </span>
          <span className={s.presetGroups}>{groupsOf(t, exercises, preset.exerciseIds)}</span>
          <span className={s.presetCount}>
            {t('training.exercises', { n: preset.exerciseIds.length })}
          </span>

          {/*
            ここに残すのは名前の変更だけ。**伏せる・消すは一覧のカードが持つ**
            （マイ種目と同じで、押す前に何をするかが一覧で読める位置に置く）。
            同じ操作を 2 か所に置くと、片方だけ直って挙動がずれる。
          */}
          <MiniButton
            label={t('preset.renameOf', { name: preset.name })}
            onClick={() => {
              setDraft(preset.name);
              setRenaming(true);
            }}
          >
            ✎
          </MiniButton>
        </div>
      )}

      {/*
        既定のセットを決める入口。**破線で小さく置く。**
        既定は「持たない」で、決めたい人だけが開く——自重種目の「＋ 加重」と同じ作法。
      */}
      <div className={ui.btnRow}>
        <button type="button" className={s.optionalEntry} onClick={() => setDefaultsOpen(true)}>
          {/* 決めてあるかは ＋ の有無で読む */}
          {!hasDefaults(preset) && <span aria-hidden="true">＋ </span>}
          {t('preset.defaults')}
        </button>
      </div>

      {defaultsOpen && (
        <Modal
          open
          title={t('preset.defaultsOf', { name: preset.name })}
          onClose={() => setDefaultsOpen(false)}
        >
          <PresetDefaultsForm preset={preset} exercises={exercises} onUpdate={onUpdate} />
        </Modal>
      )}

      {/* 中身。名前と部位だけでは、どの種目が入っているかまでは思い出せない */}
      <div className={s.presetBody}>
        <OrderList
          entries={preset.exerciseIds.map((id) => ({
            id,
            name: nameOf(id),
            group: byId.get(id)?.group ?? null,
          }))}
          movingId={moving}
          label={preset.name}
          onGrab={setMoving}
          onCancel={() => setMoving(null)}
          onReorder={(next) => {
            onUpdate({ ...preset, exerciseIds: next });
            setMoving(null);
          }}
          onDrop={drop}
        />

        {picking && (
          <PickDialog
            items={exercises}
            selected={new Set(preset.exerciseIds)}
            label={preset.name}
            onToggle={(id) =>
              onUpdate({
                ...preset,
                exerciseIds: preset.exerciseIds.includes(id)
                  ? preset.exerciseIds.filter((x) => x !== id)
                  : [...preset.exerciseIds, id],
              })
            }
            onRemoveLast={askDropLast}
            onAddExercises={(added) => {
              onAddExercises(added);
              const ids = added.map((e) => e.id).filter((id) => !preset.exerciseIds.includes(id));
              if (ids.length > 0) {
                onUpdate({ ...preset, exerciseIds: [...preset.exerciseIds, ...ids] });
              }
            }}
            onClose={() => setPicking(false)}
          />
        )}

        {moving == null && (
          <div className={ui.btnRow}>
            <Button
              adds
              size="sub"
              label={t('preset.addExerciseTo', { name: preset.name })}
              onClick={() => setPicking(true)}
            >
              {t('picker.menu')}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
