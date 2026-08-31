import { useState } from 'react';
import { CatalogPicker } from './CatalogPicker';
import { OrderList } from './OrderList';
import { Modal } from '../Modal';
import { EXERCISE_GROUP_ORDER, GROUP_LABELS, groupsOf } from '../../lib/exerciseCatalog';
import { PRESET_NAME_MAX } from '../../lib/storage';
import type { Exercise, Preset } from '../../types';
import ui from '../../styles/ui.module.scss';
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
  /** カタログからマイ種目を増やす。ここに無い種目を入れたくなったときの逃げ道 */
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
  const choices = items.filter((e) => !e.hidden || selected.has(e.id));

  if (catalog) {
    return (
      <Modal open title="マイ種目に追加" onClose={onClose} onBack={() => setCatalog(false)}>
        <CatalogPicker exercises={items} onAdd={onAddExercises} />
      </Modal>
    );
  }

  return (
    <Modal open title={`${label}に種目を足す`} onClose={onClose}>
      <div>
        {choices.length === 0 ? (
          <p className={ui.note}>マイ種目がまだありません。</p>
        ) : (
          EXERCISE_GROUP_ORDER.map((group) => {
            const list = choices.filter((e) => e.group === group);
            if (list.length === 0) return null;
            return (
              <div key={group} className={s.pickerGroup}>
                <div className={s.pickerLabel}>{GROUP_LABELS[group]}</div>
                <div className={s.pickerList}>
                  {list.map((e) => {
                    const used = selected.has(e.id);
                    return (
                      <button
                        key={e.id}
                        type="button"
                        className={s.pickerBtn}
                        aria-pressed={used}
                        // 最後の 1 つを外すのは削除と同じ意味になるので、ここでは受け付けない
                        disabled={used && selected.size === 1}
                        onClick={() => onToggle(e.id)}
                      >
                        {used ? '✓ ' : '＋ '}
                        {e.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}

        <div className={ui.btnRow}>
          {/*
            入れたい種目がマイ種目にまだ無いとき、ここが行き止まりになる。
            作りかけのプリセットは画面を離れると消えるので、なおさら戻ってこられない。
            記録画面のピッカーと同じで、入口だけ出して管理の場所は動かさない。
          */}
          <button
            type="button"
            className={`${ui.btn} ${ui.btnSm}`}
            onClick={() => setCatalog(true)}
          >
            ＋ マイ種目を増やす
          </button>
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
  const [pickingDraft, setPickingDraft] = useState(false);

  const byId = new Map(exercises.map((e) => [e.id, e]));
  const nameOf = (id: string) => byId.get(id)?.name ?? '（削除された種目）';
  /*
   * プリセットを作れるかは **表示中の種目** で決まる。
   * すでに保存してある組み合わせの中身は非表示になっても残す（掃除で消さない・設計 §2.2）。
   */
  const usable = exercises.filter((e) => !e.hidden);

  const trimmed = draft.trim().slice(0, PRESET_NAME_MAX);
  const taken = presets.some((p) => p.id !== renaming && p.name === trimmed);

  const newName = creating ? creating.name.trim().slice(0, PRESET_NAME_MAX) : '';
  const newTaken = presets.some((p) => p.name === newName);

  const remove = (preset: Preset) => {
    // 記録は消えないが、付けた名前と組み合わせは戻せない（記録画面の削除と同じ作法）
    if (confirm(`プリセット「${preset.name}」を削除します。\n元に戻せません。`)) {
      onRemove(preset.id);
    }
  };

  const drop = (preset: Preset, exerciseId: string) => {
    if (preset.exerciseIds.length === 1) {
      if (
        confirm(
          `「${nameOf(exerciseId)}」を外すと種目が無くなります。\n` +
            `プリセット「${preset.name}」ごと削除します。元に戻せません。`,
        )
      ) {
        onRemove(preset.id);
      }
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
      <header className={ui.cardHeader}>
        <h2 className={ui.cardTitle}>プリセット</h2>
        <span className={ui.hint}>{presets.length}件</span>
      </header>

      {/* 作るのは一番上。溜まるほど、下に置くとスクロールを強いることになる */}
      {creating == null && (
        <div className={ui.btnRow}>
          <button
            type="button"
            className={`${ui.btn} ${presets.length === 0 ? ui.btnPrimary : ''}`}
            // 足せる種目が 1 つも無ければ、名前だけ付けても何も入らない
            disabled={usable.length === 0}
            onClick={() => {
              setCreating({ name: '', exerciseIds: [] });
              setPickingDraft(true);
            }}
          >
            ＋ プリセットを作る
          </button>
        </div>
      )}

      {usable.length === 0 && (
        <p className={ui.note}>
          先にマイ種目を追加してください（設定 &gt; トレーニング &gt; マイ種目）。
        </p>
      )}

      {creating && (
        <div className={s.presetBlock}>
          <div className={s.presetSave}>
            <input
              type="text"
              className={s.presetInput}
              value={creating.name}
              maxLength={PRESET_NAME_MAX}
              placeholder="押す日"
              aria-label="新しいプリセットの名前"
              onChange={(e) => setCreating({ ...creating, name: e.target.value })}
            />
            <button
              type="button"
              className={s.miniBtn}
              aria-label="このプリセットを作る"
              disabled={newName === '' || newTaken || creating.exerciseIds.length === 0}
              onClick={() => {
                onCreate(creating.name, creating.exerciseIds);
                setCreating(null);
              }}
            >
              ✓
            </button>
            <button
              type="button"
              className={s.miniBtn}
              aria-label="作るのをやめる"
              onClick={() => setCreating(null)}
            >
              ×
            </button>
          </div>

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
                onAddExercises={onAddExercises}
                onClose={() => setPickingDraft(false)}
              />
            )}

            {moving?.owner === DRAFT ? null : (
              <div className={ui.btnRow}>
                <button
                  type="button"
                  className={`${ui.btn} ${ui.btnSm}`}
                  aria-label="新しいプリセットに種目を足す"
                  onClick={() => setPickingDraft(true)}
                >
                  ＋ 種目を足す
                </button>
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
                <div className={s.presetSave}>
                  <input
                    type="text"
                    className={s.presetInput}
                    value={draft}
                    maxLength={PRESET_NAME_MAX}
                    aria-label={`${preset.name}の新しい名前`}
                    onChange={(e) => setDraft(e.target.value)}
                  />
                  <button
                    type="button"
                    className={s.miniBtn}
                    aria-label="この名前にする"
                    disabled={trimmed === '' || taken}
                    onClick={() => {
                      onUpdate({ ...preset, name: draft });
                      setRenaming(null);
                    }}
                  >
                    ✓
                  </button>
                  <button
                    type="button"
                    className={s.miniBtn}
                    aria-label="名前の変更をやめる"
                    onClick={() => setRenaming(null)}
                  >
                    ×
                  </button>
                </div>
              ) : (
                <div className={s.presetRow}>
                  <span className={s.presetName}>{preset.name}</span>
                  <span className={s.presetGroups}>{groupsOf(exercises, preset.exerciseIds)}</span>
                  <span className={s.presetCount}>{preset.exerciseIds.length}種目</span>

                  <button
                    type="button"
                    className={s.miniBtn}
                    aria-label={`${preset.name}の名前を変更`}
                    onClick={() => {
                      setDraft(preset.name);
                      setRenaming(preset.id);
                    }}
                  >
                    ✎
                  </button>
                  <button
                    type="button"
                    className={s.miniBtn}
                    aria-label={`${preset.name}を削除`}
                    onClick={() => remove(preset)}
                  >
                    ×
                  </button>
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
                    onAddExercises={onAddExercises}
                    onClose={() => setPicking(null)}
                  />
                )}

                {moving?.owner === preset.id ? null : (
                  <div className={ui.btnRow}>
                    <button
                      type="button"
                      className={`${ui.btn} ${ui.btnSm}`}
                      aria-label={`${preset.name}に種目を足す`}
                      onClick={() => setPicking(preset.id)}
                    >
                      ＋ 種目を足す
                    </button>
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
    </section>
  );
}
