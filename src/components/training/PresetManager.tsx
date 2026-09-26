import { useState } from 'react';
import { PresetBlock } from './PresetBlock';
import { ExerciseSummaryCard } from './ExerciseSummaryCard';
import { MiniButton } from '../MiniButton';
import { removePresetRequest } from './presetConfirm';
import { PresetCreateDialog } from './PresetCreateDialog';
import { Modal } from '../Modal';
import { useConfirm } from '../ConfirmDialog';
import { byName, groupsOf } from '../../lib/exerciseCatalog';
import { weekdaysLabel } from '../../lib/preset';
import type { Exercise, Preset } from '../../types';
import { CardHeader } from '../CardHeader';
import { Button } from '../Button';
import ui from '../../styles/ui.module.scss';
import s from './training.module.scss';
import { useT } from '../../lib/i18n';

interface Props {
  presets: readonly Preset[];
  /** マイ種目。プリセットに足せるのはここにある種目だけ */
  exercises: readonly Exercise[];
  onCreate: (name: string, exerciseIds: readonly string[]) => void;
  onUpdate: (preset: Preset) => void;
  onRemove: (id: string) => void;
  /** カタログからマイ種目を増やす。増えた種目はそのまま下の一覧に出る */
  onAddExercises: (exercises: readonly Exercise[]) => void;
}

/**
 * プリセットの一覧・作成・編集（設定 &gt; トレーニング &gt; プリセット）。
 *
 * **一覧は 1 行に畳み、押すと中身が開く。**以前はすべてのプリセットを開いた
 * まま積んでいたので、3 つ持つだけで画面が種目の羅列で埋まり、目当ての
 * プリセットを探すのにスクロールすることになっていた。週メニューの面と
 * 同じ作法（行 → ダイアログ）にそろえる。
 *
 * **曜日で絞らない。**プリセットに種類は無い——曜日を持つものも同じ一覧に
 * 出る（札が付くだけ）。週メニューは「曜日で並べ直して見せる画面」でしかない。
 *
 * 名前は一意。この画面では一覧が目の前にあるので、ぶつかる名前は**確定させない**
 * （直したい相手がその場に見えているなら、上書きより「その行を直す」ほうが素直）。
 */
export function PresetManager({
  presets,
  exercises,
  onCreate,
  onUpdate,
  onRemove,
  onAddExercises,
}: Props) {
  const t = useT();
  const [creating, setCreating] = useState(false);
  /** 開いているプリセット。中身は書き換わるので id から毎回引き直す */
  const [openId, setOpenId] = useState<string | null>(null);
  const [ask, confirmDialog] = useConfirm();

  const open = presets.find((p) => p.id === openId) ?? null;
  /*
   * 伏せたものは下にまとめる。**消したのではない**ので、一覧から居なくならない
   * （マイ種目の「非表示」欄と同じ作法）。
   */
  /* 並びは名前順。作った順だと、あとから足した 1 件がどこにいるか分からない */
  const sorted = byName(t, presets);
  const shown = sorted.filter((p) => !p.hidden);
  const hidden = sorted.filter((p) => p.hidden);

  /*
   * 1 件ぶんは**マイ種目の一覧と同じ部品**（`ExerciseSummaryCard`）で出す。
   * 名前 → 事実 → 入口 の 3 段。似た形を別に作ると、あとで片方だけ変わる。
   *
   * **行ぜんたいを押させない。**マイ種目に合わせて、何をするかはボタンで選ぶ
   * （記録画面の呼び出しの面は行ごと押せるままにする。あちらは「入れる」ための面）。
   */
  const row = (preset: Preset) => (
    <ExerciseSummaryCard
      key={preset.id}
      name={preset.name}
      // 曜日を決めた人にだけ出る札。決めていなければ何も増えない
      tag={weekdaysLabel(t, preset.weekdays)}
      factLeft={`${t('training.exercises', { n: preset.exerciseIds.length })} · ${groupsOf(t, exercises, preset.exerciseIds)}`}
      actions={
        <>
          <MiniButton
            label={t('preset.editOf', { name: preset.name })}
            onClick={() => setOpenId(preset.id)}
          >
            {t('common.edit')}
          </MiniButton>
          {/*
            伏せる／戻す。**押す前に一覧で読める位置に置く**（マイ種目と同じ並び）。
            確認は挟まない——失うものが無く、同じボタンで元に戻る。
          */}
          <MiniButton
            label={
              preset.hidden
                ? t('manage.unhideOf', { name: preset.name })
                : t('manage.hideOf', { name: preset.name })
            }
            onClick={() => onUpdate({ ...preset, hidden: !preset.hidden })}
          >
            {preset.hidden ? t('manage.unhide') : t('manage.hidden')}
          </MiniButton>
          <MiniButton
            label={t('manage.deleteOf', { name: preset.name })}
            onClick={() => ask(removePresetRequest(t, preset, () => onRemove(preset.id)))}
          >
            {t('settings.delete')}
          </MiniButton>
        </>
      }
    />
  );

  return (
    <section className={ui.card}>
      <CardHeader
        title={t('settings.presets')}
        hint={<>{t('settings.count', { n: presets.length })}</>}
      />

      {/* 作るのは一番上。溜まるほど、下に置くとスクロールを強いることになる */}
      <div className={ui.btnRow}>
        {/*
          マイ種目が空でも押せる。**足す面からカタログへ行ける**ので、
          ここで止めると行き止まりを作るだけになる。
        */}
        <Button
          tone={presets.length === 0 ? 'primary' : undefined}
          onClick={() => setCreating(true)}
        >
          {t('preset.createTitle')}
        </Button>
      </div>

      {/*
        作る口と一覧のあいだを空ける。**続きに見せない**——
        ボタンのすぐ下に 1 件目のカードが来ると、そのカードの操作に見える。
      */}
      <div className={s.presetList}>
        {presets.length === 0 ? (
          <p className={ui.emptyState}>
            {t('preset.managerEmpty')}
            <br />
            {t('preset.managerEmptyHint')}
          </p>
        ) : (
          shown.map(row)
        )}

        {hidden.length > 0 && (
          <>
            <div className={s.manageGroup}>{t('manage.hidden')}</div>
            {hidden.map(row)}
          </>
        )}
      </div>

      {/* 「編集」を押した先。名前・実施順・既定のセットを直す面（伏せる・消すは一覧が持つ） */}
      {open && (
        <Modal open title={open.name} onClose={() => setOpenId(null)}>
          <PresetBlock
            preset={open}
            exercises={exercises}
            presets={presets}
            onUpdate={onUpdate}
            onRemove={(id) => {
              setOpenId(null);
              onRemove(id);
            }}
            onAddExercises={onAddExercises}
            ask={ask}
          />
        </Modal>
      )}

      {creating && (
        <PresetCreateDialog
          exercises={exercises}
          presets={presets}
          title={t('preset.createTitle')}
          onCreate={onCreate}
          onAddExercises={onAddExercises}
          onClose={() => setCreating(false)}
        />
      )}

      {confirmDialog}
    </section>
  );
}
