import { useState } from 'react';
import { PresetBlock } from './PresetBlock';
import { PresetCreateDialog } from './PresetCreateDialog';
import { Modal } from '../Modal';
import { useConfirm } from '../ConfirmDialog';
import { groupsOf } from '../../lib/exerciseCatalog';
import { weekdaysLabel } from '../../lib/preset';
import type { Exercise, Preset } from '../../types';
import { CardHeader } from '../CardHeader';
import { Button } from '../Button';
import { Tag } from '../Tag';
import ui from '../../styles/ui.module.scss';
import s from './training.module.scss';

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
  const [creating, setCreating] = useState(false);
  /** 開いているプリセット。中身は書き換わるので id から毎回引き直す */
  const [openId, setOpenId] = useState<string | null>(null);
  const [ask, confirmDialog] = useConfirm();

  const open = presets.find((p) => p.id === openId) ?? null;
  /*
   * 伏せたものは下にまとめる。**消したのではない**ので、一覧から居なくならない
   * （マイ種目の「非表示」欄と同じ作法）。
   */
  const shown = presets.filter((p) => !p.hidden);
  const hidden = presets.filter((p) => p.hidden);

  const row = (preset: Preset) => (
    <button
      key={preset.id}
      type="button"
      className={s.presetPick}
      aria-label={`${preset.name}を編集`}
      onClick={() => setOpenId(preset.id)}
    >
      <span className={s.presetName}>
        {preset.name}
        {/* 曜日を決めた人にだけ出る札。決めていなければ何も増えない */}
        {preset.weekdays.length > 0 && <Tag>{weekdaysLabel(preset.weekdays)}</Tag>}
      </span>
      <span className={s.presetGroups}>{groupsOf(exercises, preset.exerciseIds)}</span>
      <span className={s.presetCount}>{preset.exerciseIds.length}種目</span>
    </button>
  );

  return (
    <section className={ui.card}>
      <CardHeader title="プリセット" hint={<>{presets.length}件</>} />

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
          ＋ プリセットを作る
        </Button>
      </div>

      {presets.length === 0 ? (
        <p className={ui.emptyState}>
          まだプリセットがありません。
          <br />
          ここで作るか、記録画面で種目を入れて、いまの組み合わせに名前を付けて残せます。
        </p>
      ) : (
        shown.map(row)
      )}

      {hidden.length > 0 && (
        <>
          <div className={s.manageGroup}>非表示</div>
          {hidden.map(row)}
        </>
      )}

      {/* 押したその場が編集の面。名前・実施順・既定のセット・削除がここに揃う */}
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
          title="プリセットを作る"
          onCreate={onCreate}
          onAddExercises={onAddExercises}
          onClose={() => setCreating(false)}
        />
      )}

      {confirmDialog}
    </section>
  );
}
