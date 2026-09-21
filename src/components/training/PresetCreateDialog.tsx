import { useState } from 'react';
import { OrderList } from './OrderList';
import { PickDialog } from './PickDialog';
import { Modal } from '../Modal';
import { PRESET_NAME_MAX } from '../../lib/storage';
import type { Exercise, Preset } from '../../types';
import { Button } from '../Button';
import { NameEntryRow } from '../NameEntryRow';
import ui from '../../styles/ui.module.scss';
import s from './training.module.scss';

interface Props {
  /** マイ種目。プリセットに足せるのはここにある種目だけ */
  exercises: readonly Exercise[];
  /** 名前の重複を見るための全件 */
  presets: readonly Preset[];
  /** 見出し。曜日から作るときは「月曜日に置く」のように場面の名前を入れる */
  title: string;
  onCreate: (name: string, exerciseIds: readonly string[]) => void;
  onAddExercises: (exercises: readonly Exercise[]) => void;
  onClose: () => void;
}

/**
 * プリセットを作る面。**作る場所が 2 つあるので、部品を 1 つにする。**
 *
 * プリセットの一覧からも、週の曜日からも作れる。面ごとに組み立てると、
 * 片方だけ直って操作がずれる（すでにあるものを直す `PresetBlock` と同じ理屈）。
 *
 * **ダイアログで出す。**一覧に直接置くと、種目を 1 つ選ぶたびに下のボタンが
 * 押し下げられて、続けて選ぶあいだ指を狙い直すことになる。
 */
export function PresetCreateDialog({
  exercises,
  presets,
  title,
  onCreate,
  onAddExercises,
  onClose,
}: Props) {
  const [name, setName] = useState('');
  const [ids, setIds] = useState<string[]>([]);
  /** 掴んでいる種目。置くまで並びは変えない */
  const [moving, setMoving] = useState<string | null>(null);
  /** 開いてすぐ選べるようにする。空の一覧を見せてから押させない */
  const [picking, setPicking] = useState(true);

  const byId = new Map(exercises.map((e) => [e.id, e]));
  const trimmed = name.trim().slice(0, PRESET_NAME_MAX);
  const taken = presets.some((p) => p.name === trimmed);

  return (
    <Modal open title={title} onClose={onClose}>
      {/* 押せない理由は**確定ボタンの上**。押したあとの位置に置かない */}
      {taken && <p className={ui.note}>同じ名前のプリセットがあります。</p>}
      {ids.length === 0 && <p className={ui.note}>種目を 1 つ以上入れてください。</p>}

      <NameEntryRow
        value={name}
        onChange={setName}
        label="新しいプリセットの名前"
        placeholder="プリセット名"
        commitLabel="このプリセットを作る"
        cancelLabel="作るのをやめる"
        disabled={trimmed === '' || taken || ids.length === 0}
        onCommit={() => {
          onCreate(name, ids);
          onClose();
        }}
        onCancel={onClose}
      />

      <div className={s.presetBody}>
        {/* 中身の行は、すでにあるプリセットと同じ部品・同じ操作（`PresetBlock`） */}
        <OrderList
          entries={ids.map((id) => ({
            id,
            name: byId.get(id)?.name ?? '（削除された種目）',
            group: byId.get(id)?.group ?? null,
          }))}
          movingId={moving}
          label="新しいプリセット"
          onGrab={setMoving}
          onCancel={() => setMoving(null)}
          onReorder={(next) => {
            setIds(next);
            setMoving(null);
          }}
          // まだ保存していないので、0 件になっても確認することは無い
          onDrop={(id) => setIds(ids.filter((x) => x !== id))}
        />

        {picking && (
          <PickDialog
            items={exercises}
            selected={new Set(ids)}
            label="新しいプリセット"
            onToggle={(id) => setIds(ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id])}
            /*
              カタログから足した種目は、**マイ種目とこの組み合わせの両方へ入れる。**
              マイ種目へ入れるだけだと、戻ってもう一度選び直すことになる。
            */
            onAddExercises={(added) => {
              onAddExercises(added);
              const next = added.map((e) => e.id).filter((id) => !ids.includes(id));
              if (next.length > 0) setIds([...ids, ...next]);
            }}
            onClose={() => setPicking(false)}
          />
        )}

        {moving == null && (
          <div className={ui.btnRow}>
            <Button
              size="sub"
              label="新しいプリセットに種目を足す"
              onClick={() => setPicking(true)}
            >
              ＋ 種目を足す
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}
