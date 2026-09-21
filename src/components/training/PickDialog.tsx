import { useState } from 'react';
import { CatalogPicker } from './CatalogPicker';
import { CustomExerciseForm } from './CustomExerciseForm';
import { ExercisePickList } from './ExercisePickList';
import { Modal } from '../Modal';
import { GROUP_LABELS, isListed } from '../../lib/exerciseCatalog';
import type { Exercise } from '../../types';
import { Button } from '../Button';
import { Pill } from '../Pill';
import { Tag } from '../Tag';
import ui from '../../styles/ui.module.scss';

interface Props {
  /** マイ種目ぜんぶ。入っているものは ✓ で出す */
  items: readonly Exercise[];
  /** いまこの組み合わせに入っている種目 */
  selected: ReadonlySet<string>;
  label: string;
  onToggle: (id: string) => void;
  /**
   * 最後の 1 つの ✓ を外そうとしたとき。**渡されたらこちらが呼ばれる。**
   *
   * 既にあるプリセットでは、それはプリセットを消すのと同じことなので聞く
   * （中身の一覧から外すときと同じ問い）。作りかけの下書きは保存前なので
   * 渡さない——0 件になっても消えるものが無い。
   */
  onRemoveLast?: ((id: string) => void) | undefined;
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
export function PickDialog({
  items,
  selected,
  label,
  onToggle,
  onRemoveLast,
  onAddExercises,
  onClose,
}: Props) {
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
            onAdd={onAddExercises}
            // 足し終えた種目は ✓ で残す。外し方と組で渡す（片方だけでは意味を持たない）
            selection={{ ids: selected, onToggle }}
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
                  /*
                    最後の 1 つを外すのは、プリセットを消すのと同じこと。
                    **無言で押せなくしない**——中身の一覧と同じように、そう書いて聞く。
                  */
                  onClick={() =>
                    used && selected.size === 1 && onRemoveLast
                      ? onRemoveLast(e.id)
                      : onToggle(e.id)
                  }
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
