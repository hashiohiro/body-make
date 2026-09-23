import { useState } from 'react';
import { PresetBlock } from './PresetBlock';
import { ExerciseSummaryCard } from './ExerciseSummaryCard';
import { MiniButton } from '../MiniButton';
import { removePresetRequest } from './presetConfirm';
import { PresetCreateDialog } from './PresetCreateDialog';
import { Modal } from '../Modal';
import { useConfirm } from '../ConfirmDialog';
import { groupsOf } from '../../lib/exerciseCatalog';
import { weekdaysLabel } from '../../lib/preset';
import type { Exercise, Preset } from '../../types';
import { CardHeader } from '../CardHeader';
import { Button } from '../Button';
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
      tag={weekdaysLabel(preset.weekdays)}
      factLeft={`${preset.exerciseIds.length}種目 · ${groupsOf(exercises, preset.exerciseIds)}`}
      actions={
        <>
          <MiniButton label={`${preset.name}を編集`} onClick={() => setOpenId(preset.id)}>
            編集
          </MiniButton>
          {/*
            伏せる／戻す。**押す前に一覧で読める位置に置く**（マイ種目と同じ並び）。
            確認は挟まない——失うものが無く、同じボタンで元に戻る。
          */}
          <MiniButton
            label={preset.hidden ? `${preset.name}を表示に戻す` : `${preset.name}を非表示にする`}
            onClick={() => onUpdate({ ...preset, hidden: !preset.hidden })}
          >
            {preset.hidden ? '表示に戻す' : '非表示'}
          </MiniButton>
          <MiniButton
            label={`${preset.name}を削除`}
            onClick={() => ask(removePresetRequest(preset, () => onRemove(preset.id)))}
          >
            削除
          </MiniButton>
        </>
      }
    />
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

      {/*
        作る口と一覧のあいだを空ける。**続きに見せない**——
        ボタンのすぐ下に 1 件目のカードが来ると、そのカードの操作に見える。
      */}
      <div className={s.presetList}>
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
