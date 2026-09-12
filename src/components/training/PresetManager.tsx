import { useState } from 'react';
import { CatalogPicker } from './CatalogPicker';
import { CustomExerciseForm } from './CustomExerciseForm';
import { ExercisePickList } from './ExercisePickList';
import { OrderList } from './OrderList';
import { Modal } from '../Modal';
import { useConfirm } from '../ConfirmDialog';
import { removePresetRequest } from './presetConfirm';
import { GROUP_LABELS, groupsOf, isListed } from '../../lib/exerciseCatalog';
import { PRESET_NAME_MAX } from '../../lib/storage';
import type { Exercise, Preset } from '../../types';
import { CardHeader } from '../CardHeader';
import { Button } from '../Button';
import ui from '../../styles/ui.module.scss';
import { Tag } from '../Tag';
import { MiniButton } from '../MiniButton';
import { NameEntryRow } from '../NameEntryRow';
import { Pill } from '../Pill';
import s from './training.module.scss';

/** 作りかけのプリセットを、掴んでいる相手として指すための名前（Preset.id と混ざらない） */
const DRAFT = 'draft';

interface PickDialogProps {
  /** マイ種目ぜんぶ。入っているものは ✓ で出す */
  items: readonly Exercise[];
  /** いまこの組み合わせに入っている種目 */
  selected: ReadonlySet<string>;
  label: string;
  onToggle: (id: string) => void;
  /**
   * カタログ（と自作）から種目を増やす。**マイ種目とこの組み合わせの両方に入れる。**
   * マイ種目へ入れるだけだと、戻ってもう一度選び直すことになる。
   */
  onAddExercises: (exercises: readonly Exercise[]) => void;
  onClose: () => void;
}

/**
 * 中身に足す種目を選ぶ。新規作成と既存の編集で同じものを使う。
 *
 * **ダイアログで出す。** 画面に直接置くと、1 つ選ぶたびに上の一覧が伸びて、
 * その下にあるボタンが押すたびに下へ動く。続けて選ぶあいだ指を狙い直すことになる。
 *
 * 入っている種目も ✓ を付けたまま残す。選んだものを消すと、
 * そのぶんだけ後ろの並びが詰まって、やはり位置が動く。
 */
function PickDialog({
  items,
  selected,
  label,
  onToggle,
  onAddExercises,
  onClose,
}: PickDialogProps) {
  /*
   * カタログはダイアログを重ねず、**同じダイアログの面を差し替える**。
   * 同じ作業（この組み合わせの中身を決める）の続きなので、閉じたら元の面に戻る。
   */
  const [catalog, setCatalog] = useState(false);

  // 非表示は候補に出さない。すでに入っているものは、外せるように残す
  const choices = items.filter((e) => isListed(e) || selected.has(e.id));

  if (catalog) {
    return (
      <Modal open title="カタログから足す" tall onClose={onClose} onBack={() => setCatalog(false)}>
        <div>
          {/*
            **カタログから選んだ種目は、マイ種目とこの組み合わせの両方に入る。**
            マイ種目へ入れるだけだと、戻ってもう一度選び直すことになる。
            入れ終わった種目は消さずに ✓ で残す（消えると入ったのか分からない）。
          */}
          {/* 黙って増やさない。マイ種目にも入ることは、押す前に書いておく */}
          <p className={ui.note}>選んだ種目はマイ種目にも追加され、この組み合わせに入ります。</p>

          <CatalogPicker
            exercises={items}
            selectedIds={selected}
            onAdd={onAddExercises}
            onToggle={onToggle}
          />

          {/* カタログにも無いときの逃げ道。作った種目もそのまま組み合わせに入る */}
          <CustomExerciseForm exercises={items} onCreate={(ex) => onAddExercises([ex])} />
        </div>
      </Modal>
    );
  }

  return (
    <Modal open title={`${label}に種目を足す`} tall onClose={onClose}>
      <div>
        {choices.length === 0 ? (
          /*
           * マイ種目が空でも行き止まりにしない。**カタログから直接組める。**
           * 以前は「＋ プリセットを作る」自体を押せなくして、
           * 先に設定のマイ種目へ行かせていた（そこから戻る道が無かった）。
           */
          <p className={ui.emptyState}>
            マイ種目がまだ空です。
            <br />
            カタログから選ぶと、マイ種目とこの組み合わせの両方に入ります。
          </p>
        ) : (
          /* 選ぶ面はどこも同じ組み（検索・部位チップ・部位ごとの見出し） */
          <ExercisePickList
            items={choices}
            heading="マイ種目"
            renderItem={(e, searching) => {
              const used = selected.has(e.id);
              return (
                <Pill
                  key={e.id}
                  pressed={used}
                  // 最後の 1 つを外すのは削除と同じ意味になるので、ここでは受け付けない
                  disabled={used && selected.size === 1}
                  onClick={() => onToggle(e.id)}
                >
                  {used ? '✓ ' : '＋ '}
                  {e.name}
                  {/* 束ねる見出しが無いので、探した結果では部位も行に添える */}
                  {searching && <Tag>{GROUP_LABELS[e.group]}</Tag>}
                </Pill>
              );
            }}
          />
        )}

        <div className={ui.btnRow}>
          {/*
            入れたい種目がマイ種目にまだ無いとき、ここが行き止まりになる。
            作りかけのプリセットは画面を離れると消えるので、なおさら戻ってこられない。
            記録画面のピッカーと同じで、入口だけ出して管理の場所は動かさない。
          */}
          <Button
            tone={choices.length === 0 ? 'primary' : undefined}
            size="sub"
            onClick={() => setCatalog(true)}
          >
            ＋ カタログから足す
          </Button>
        </div>
      </div>
    </Modal>
  );
}

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
 * 記録画面のカードは「その日に呼び出す／**いまの組み合わせ**を保存する」ための場所。
 * こちらは溜まってきたものを見直す場所で、**名前と中身の種目を直接いじれる。**
 *
 * 空から作る手段もここに置く。記録画面から作るには一度どこかの日に種目を入れることになり、
 * 献立を考えるためだけにその日のログへ空のカードが残る（§2.2 で消さないと決めた）。
 *
 * 並びはやる順番。呼び出すとこの順にカードが積まれる（addDayExercises）ので、
 * 中身と同じく本人が決めるもの。**掴んでから置き場所を選ぶ**形で動かす。
 * ↑↓ だと押した行が動くので、1 つ動かすたびに指を狙い直すことになる。
 * **作りかけでも、すでにあるプリセットでも同じ操作**（`items` を共有）。
 *
 * 中身を編集できるようにしたぶん、0 件になる編集だけは受け付けない。
 * 種目を持たないプリセットは読み込み時に落ちる（storage.ts）ので、
 * 空にすることは削除と同じ意味になる。それなら削除として確認する。
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
  const [renaming, setRenaming] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [picking, setPicking] = useState<string | null>(null);
  /** 掴んでいる種目と、その持ち主（プリセットの id か DRAFT）。置くまで並びは変えない */
  const [moving, setMoving] = useState<{ owner: string; exerciseId: string } | null>(null);
  /** 作りかけのプリセット。決まるまで保存しない */
  const [creating, setCreating] = useState<{ name: string; exerciseIds: string[] } | null>(null);
  const [ask, confirmDialog] = useConfirm();
  const [pickingDraft, setPickingDraft] = useState(false);

  const byId = new Map(exercises.map((e) => [e.id, e]));
  const nameOf = (id: string) => byId.get(id)?.name ?? '（削除された種目）';
  const trimmed = draft.trim().slice(0, PRESET_NAME_MAX);
  const taken = presets.some((p) => p.id !== renaming && p.name === trimmed);

  const newName = creating ? creating.name.trim().slice(0, PRESET_NAME_MAX) : '';
  const newTaken = presets.some((p) => p.name === newName);

  // 聞き方は記録画面のプリセットと同じ（presetConfirm）
  const remove = (preset: Preset) => ask(removePresetRequest(preset, () => onRemove(preset.id)));

  const drop = (preset: Preset, exerciseId: string) => {
    // 最後の 1 つを外すのは、プリセットを消すのと同じこと。そう書いて聞く
    if (preset.exerciseIds.length === 1) {
      ask({
        title: 'プリセットごと削除しますか？',
        subject: preset.name,
        note: `「${nameOf(exerciseId)}」を外すと種目が無くなります。記録は消えません。`,
        confirmLabel: 'プリセットごと削除',
        destructive: true,
        onConfirm: () => onRemove(preset.id),
      });
      return;
    }
    onUpdate({ ...preset, exerciseIds: preset.exerciseIds.filter((id) => id !== exerciseId) });
  };

  /**
   * 中身の行。**作りかけでも、すでにあるプリセットでも同じ見た目・同じ操作**にする。
   * 記録画面のその日の種目とも同じ部品（OrderList）で、違うのは書き戻し先だけ。
   *
   * @param owner   掴んでいる相手を見分ける名前（プリセットの id か DRAFT）
   * @param label   読み上げに出す持ち主の呼び名
   */
  const list = (
    owner: string,
    label: string,
    ids: readonly string[],
    onReorder: (next: string[]) => void,
    onDropItem: (id: string) => void,
  ) => (
    <OrderList
      entries={ids.map((id) => ({
        id,
        name: nameOf(id),
        group: byId.get(id)?.group ?? null,
      }))}
      movingId={moving?.owner === owner ? moving.exerciseId : null}
      label={label}
      onGrab={(id) => setMoving({ owner, exerciseId: id })}
      onCancel={() => setMoving(null)}
      onReorder={(next) => {
        onReorder(next);
        setMoving(null);
      }}
      onDrop={onDropItem}
    />
  );

  return (
    <section className={ui.card}>
      <CardHeader title="プリセット" hint={<>{presets.length}件</>} />

      {/* 作るのは一番上。溜まるほど、下に置くとスクロールを強いることになる */}
      {creating == null && (
        <div className={ui.btnRow}>
          {/*
            マイ種目が空でも押せる。**足す面からカタログへ行ける**ので、
            ここで止めると行き止まりを作るだけになる（以前は押せなくしていた）。
          */}
          <Button
            tone={presets.length === 0 ? 'primary' : undefined}
            onClick={() => {
              setCreating({ name: '', exerciseIds: [] });
              setPickingDraft(true);
            }}
          >
            ＋ プリセットを作る
          </Button>
        </div>
      )}

      {creating && (
        <div className={s.presetBlock}>
          <NameEntryRow
            value={creating.name}
            onChange={(name) => setCreating({ ...creating, name })}
            label="新しいプリセットの名前"
            commitLabel="このプリセットを作る"
            cancelLabel="作るのをやめる"
            disabled={newName === '' || newTaken || creating.exerciseIds.length === 0}
            onCommit={() => {
              onCreate(creating.name, creating.exerciseIds);
              setCreating(null);
            }}
            onCancel={() => setCreating(null)}
          />

          {newTaken && <p className={ui.note}>同じ名前のプリセットがあります。</p>}

          <div className={s.presetBody}>
            {creating.exerciseIds.length === 0 && (
              <p className={ui.note}>種目を 1 つ以上入れてください。</p>
            )}

            {list(
              DRAFT,
              '新しいプリセット',
              creating.exerciseIds,
              (next) => setCreating({ ...creating, exerciseIds: next }),
              // まだ保存していないので、0 件になっても確認することは無い
              (id) =>
                setCreating({
                  ...creating,
                  exerciseIds: creating.exerciseIds.filter((x) => x !== id),
                }),
            )}

            {pickingDraft && (
              <PickDialog
                items={exercises}
                selected={new Set(creating.exerciseIds)}
                label="新しいプリセット"
                onToggle={(id) =>
                  setCreating({
                    ...creating,
                    exerciseIds: creating.exerciseIds.includes(id)
                      ? creating.exerciseIds.filter((x) => x !== id)
                      : [...creating.exerciseIds, id],
                  })
                }
                /*
                  カタログから足した種目は、**マイ種目とこの組み合わせの両方へ入れる。**
                  マイ種目へ入れるだけだと、戻ってもう一度選び直すことになる。
                */
                onAddExercises={(added) => {
                  onAddExercises(added);
                  const ids = added
                    .map((e) => e.id)
                    .filter((id) => !creating.exerciseIds.includes(id));
                  if (ids.length > 0) {
                    setCreating({ ...creating, exerciseIds: [...creating.exerciseIds, ...ids] });
                  }
                }}
                onClose={() => setPickingDraft(false)}
              />
            )}

            {moving?.owner === DRAFT ? null : (
              <div className={ui.btnRow}>
                <Button
                  size="sub"
                  label="新しいプリセットに種目を足す"
                  onClick={() => setPickingDraft(true)}
                >
                  ＋ 種目を足す
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {presets.length === 0
        ? creating == null && (
            <p className={ui.emptyState}>
              まだプリセットがありません。
              <br />
              ここで作るか、記録画面で種目を入れて、いまの組み合わせに名前を付けて残せます。
            </p>
          )
        : presets.map((preset) => (
            <div key={preset.id} className={s.presetBlock}>
              {renaming === preset.id ? (
                <NameEntryRow
                  value={draft}
                  onChange={setDraft}
                  label={`${preset.name}の新しい名前`}
                  commitLabel="この名前にする"
                  cancelLabel="名前の変更をやめる"
                  disabled={trimmed === '' || taken}
                  onCommit={() => {
                    onUpdate({ ...preset, name: draft });
                    setRenaming(null);
                  }}
                  onCancel={() => setRenaming(null)}
                />
              ) : (
                <div className={s.presetRow}>
                  <span className={s.presetName}>{preset.name}</span>
                  <span className={s.presetGroups}>{groupsOf(exercises, preset.exerciseIds)}</span>
                  <span className={s.presetCount}>{preset.exerciseIds.length}種目</span>

                  <MiniButton
                    label={`${preset.name}の名前を変更`}
                    onClick={() => {
                      setDraft(preset.name);
                      setRenaming(preset.id);
                    }}
                  >
                    ✎
                  </MiniButton>
                  <MiniButton label={`${preset.name}を削除`} onClick={() => remove(preset)}>
                    ×
                  </MiniButton>
                </div>
              )}

              {renaming === preset.id && taken && (
                <p className={ui.note}>同じ名前のプリセットがあります。</p>
              )}

              {/* 中身。名前と部位だけでは、どの種目が入っているかまでは思い出せない */}
              <div className={s.presetBody}>
                {list(
                  preset.id,
                  preset.name,
                  preset.exerciseIds,
                  (next) => onUpdate({ ...preset, exerciseIds: next }),
                  (id) => drop(preset, id),
                )}

                {picking === preset.id && (
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
                    onAddExercises={(added) => {
                      onAddExercises(added);
                      const ids = added
                        .map((e) => e.id)
                        .filter((id) => !preset.exerciseIds.includes(id));
                      if (ids.length > 0) {
                        onUpdate({ ...preset, exerciseIds: [...preset.exerciseIds, ...ids] });
                      }
                    }}
                    onClose={() => setPicking(null)}
                  />
                )}

                {moving?.owner === preset.id ? null : (
                  <div className={ui.btnRow}>
                    <Button
                      size="sub"
                      label={`${preset.name}に種目を足す`}
                      onClick={() => setPicking(preset.id)}
                    >
                      ＋ 種目を足す
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}

      <p className={ui.note}>
        持つのは種目だけで、重量もレップもセット数も持ちません。
        呼び出すのは記録画面のプリセットカードから行います。
        <br />
        ここで見えるのは1日の負荷の合計だけです。残っている疲労と所要時間は、
        いつやるかとセット数が決まって初めて出せるので、記録画面で確認できます （設定 &gt;
        トレーニング &gt; トレーニング種目のレビュー で有効にしたときだけ出ます）。
      </p>

      {confirmDialog}
    </section>
  );
}
