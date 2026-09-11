import { useState } from 'react';
import { CatalogPicker } from './CatalogPicker';
import { CustomExerciseForm } from './CustomExerciseForm';
import { Modal } from '../Modal';
import { useFabPosition } from './useFabPosition';
import { EXERCISE_GROUP_ORDER, GROUP_LABELS, isListed } from '../../lib/exerciseCatalog';
import { ExerciseFilterBar, FILTER_THRESHOLD, matchesGroup } from './ExerciseFilterBar';
import type { PresetOption } from './PresetCard';
import type { Exercise, ExerciseGroup } from '../../types';
import ui from '../../styles/ui.module.scss';
import s from './training.module.scss';

interface Props {
  exercises: readonly Exercise[];
  usedIds: ReadonlySet<string>;
  /** 保存してある組み合わせ。ここからも入れられる */
  presets: readonly PresetOption[];
  /** その日に入れる／外すの切り替え。押すたびに増えることはない */
  onToggle: (id: string) => void;
  /** プリセットの中身をまとめてその日に入れる */
  onAddPreset: (exerciseIds: readonly string[]) => void;
  /**
   * カタログから 1 種目を、その日に入れる。
   * `keep` はマイ種目にも残すか（false なら、その日だけの種目として非表示で持つ）。
   */
  onAddFromCatalog: (exercise: Exercise, keep: boolean) => void;
}

/** ＋ を押して最初に出る面と、そこから開く面 */
type Panel = 'menu' | 'exercises' | 'presets' | 'catalog' | 'keep';

const TITLES: Record<Panel, string> = {
  menu: '種目を追加',
  exercises: 'マイ種目から選ぶ',
  presets: 'プリセットから入れる',
  catalog: 'カタログから選ぶ',
  keep: 'マイ種目にも追加しますか？',
};

/**
 * その日の種目を足す。**足し方を 3 つ持つ。**
 *
 *   マイ種目   … いつもの種目から選ぶ
 *   プリセット … 保存した組み合わせをまとめて入れる
 *   カタログ   … まだ持っていない種目を、その場で足す
 *
 * ＋ からいきなりマイ種目を出していた頃は、残り 2 つが別の場所（帯・一覧の下）に
 * 散っていて、いま欲しいものがどこにあるのか毎回探すことになっていた。
 * どれも「その日に種目を入れる」ための道なので、入口をひとつにまとめる。
 *
 * モーダルで出す。ページに直接置くと、追加した種目のカードがピッカーより上に
 * 挿入されるぶんだけピッカーが下へ押し出され、続けて選ぶたびに
 * 指の下で一覧が動く（1 件ずつ閉じていた頃は起きなかった）。
 */
export function ExercisePicker({
  exercises,
  usedIds,
  presets,
  onToggle,
  onAddPreset,
  onAddFromCatalog,
}: Props) {
  const [open, setOpen] = useState(false);
  // 置き場所は動かせる。記録している最中に、指の下や読みたい行を塞ぐことがある
  const fab = useFabPosition();
  /*
   * 面はダイアログを重ねず、**同じダイアログの中で差し替える**。
   * 同じ作業（今日の種目を決める）の続きなので、閉じたら元の面に戻るのが自然で、
   * 暗幕を二重にする理由も無い。重ねるのは「別の主題を参照しに行く」ときだけにする。
   */
  const [panel, setPanel] = useState<Panel>('menu');
  /** カタログで選んだ種目。マイ種目に残すかを答えてもらうまで、まだ入れない */
  const [pending, setPending] = useState<Exercise | null>(null);
  const [group, setGroup] = useState<ExerciseGroup | 'all'>('all');

  /*
   * 非表示の種目は候補に出さない。
   * ただし **その日にすでに入っているもの** は出す（プリセットから入ることがある）。
   * 出さないと、ここで外せず閉じてカードの × を探すことになる。
   */
  const choices = exercises.filter((e) => isListed(e) || usedIds.has(e.id));
  const narrowed = choices.filter((e) => matchesGroup(e, group));

  const close = () => {
    setOpen(false);
    setPanel('menu');
    setPending(null);
    /*
     * 絞り込みは開くたびに白紙に戻す。
     * 前に「腕」で絞ったまま次の日に開くと、種目が減ったように見える。
     * 探すための状態であって、この画面の設定ではない。
     */
    setGroup('all');
  };

  const menuItem = (id: Panel, name: string, hint: string) => (
    <button type="button" className={s.menuItem} onClick={() => setPanel(id)}>
      <span className={s.menuName}>{name}</span>
      <span className={s.menuHint}>{hint}</span>
      <span className={s.menuChevron} aria-hidden="true">
        ›
      </span>
    </button>
  );

  return (
    <>
      {/*
        画面の中に置いた追加ボタンは、種目カードが積み上がるほど上へ流れていく。
        記録している最中でも指の届く位置に、1 つだけ置く。
        **押したまま動かすと置き場所を変えられる**（片手で届く高さは人によって違うし、
        読みたい行を塞ぐこともある）。離すと左右どちらかの端に寄る。
      */}
      <button
        type="button"
        className={s.fab}
        aria-label="種目を追加"
        style={fab.style}
        onPointerDown={fab.onPointerDown}
        onPointerMove={fab.onPointerMove}
        onPointerUp={fab.onPointerUp}
        // 動かした指を離したときは、押した扱いにしない
        onClick={() => !fab.dragged() && setOpen(true)}
      >
        ＋
      </button>

      <Modal
        open={open}
        title={TITLES[panel]}
        onClose={close}
        // 答えずに戻ったら、その種目は入れない。戻り先は選んでいた面
        onBack={
          panel === 'menu'
            ? undefined
            : () => {
                setPending(null);
                setPanel(panel === 'keep' ? 'catalog' : 'menu');
              }
        }
      >
        {panel === 'menu' ? (
          <div className={s.menu}>
            {menuItem('exercises', 'マイ種目から選ぶ', `いつもの種目（${choices.length}件）`)}
            {menuItem(
              'presets',
              'プリセットから入れる',
              `保存した組み合わせ（${presets.length}件）`,
            )}
            {menuItem('catalog', 'カタログから選ぶ', 'マイ種目に無い種目を、この日に足す')}
          </div>
        ) : panel === 'catalog' ? (
          <div>
            {/*
              ここで選んだ種目は、**その日に入る**。マイ種目に残すかは
              入れたあとに聞く（設定を先に決めさせると、1 回だけ試したい種目が入れにくい）。
            */}
            <CatalogPicker
              exercises={exercises}
              usedIds={usedIds}
              onAdd={(added) => {
                const [first] = added;
                if (!first) return;
                setPending(first);
                setPanel('keep');
              }}
            />

            {/*
              **カタログに無いと気づくのはここ。**設定タブを探しに行かせない
              （行った先で足しても、記録画面へ戻ってもう一度選び直すことになる）。
              作った種目はマイ種目に入り、そのままこの日にも入る。
            */}
            <CustomExerciseForm
              exercises={exercises}
              onCreate={(ex) => {
                onAddFromCatalog(ex, true);
                close();
              }}
            />

            <p className={ui.note}>
              削除と種目ごとの設定は、設定 &gt; トレーニング &gt; マイ種目 でまとめて行えます。
            </p>
          </div>
        ) : panel === 'keep' ? (
          /*
           * **答えは 2 つのボタンそのものにする。**
           * OK / キャンセルで聞くと、どちらがどちらの結果なのかを文から
           * 読み取らせることになる。押す言葉に結果を書く。
           */
          <div>
            <p className={s.keepName}>{pending?.name}</p>
            <div className={ui.btnRow}>
              <button
                type="button"
                className={`${ui.btn} ${ui.btnPrimary}`}
                onClick={() => {
                  if (pending) onAddFromCatalog(pending, true);
                  setPending(null);
                  setPanel('catalog');
                }}
              >
                マイ種目に追加
              </button>
              <button
                type="button"
                className={ui.btn}
                onClick={() => {
                  if (pending) onAddFromCatalog(pending, false);
                  setPending(null);
                  setPanel('catalog');
                }}
              >
                この日だけ
              </button>
            </div>
            <p className={ui.note}>どちらでも、この日には入ります。</p>
          </div>
        ) : panel === 'presets' ? (
          presets.length === 0 ? (
            <p className={ui.emptyState}>
              保存した組み合わせはまだありません。
              <br />
              種目を入れたあと、記録画面の「プリセット」から名前を付けて残せます。
            </p>
          ) : (
            <div>
              {presets.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  className={s.presetPick}
                  aria-label={`${preset.name}をこの日に入れる`}
                  onClick={() => {
                    onAddPreset(preset.exerciseIds);
                    close();
                  }}
                >
                  <span className={s.presetName}>{preset.name}</span>
                  <span className={s.presetGroups}>{preset.groups}</span>
                  <span className={s.presetCount}>{preset.exerciseIds.length}種目</span>
                </button>
              ))}
            </div>
          )
        ) : choices.length === 0 ? (
          /*
           * マイ種目が空のとき。以前は「設定 > トレーニング から追加してください」とだけ出していて、
           * 初めて開いた人がその場では何もできなかった。ここから追加できるようにする。
           */
          <div>
            <p className={ui.emptyState}>
              マイ種目がまだ空です。
              <br />
              カタログから、自分がやる種目を選んでください。
            </p>
            <div className={ui.btnRow}>
              <button
                type="button"
                className={`${ui.btn} ${ui.btnPrimary}`}
                onClick={() => setPanel('catalog')}
              >
                ＋ カタログから選ぶ
              </button>
            </div>
          </div>
        ) : (
          <div>
            {choices.length > FILTER_THRESHOLD && (
              <ExerciseFilterBar group={group} onGroup={setGroup} exercises={choices} />
            )}

            {narrowed.length === 0 && (
              <p className={ui.emptyState}>このフィルターに合う種目はありません。</p>
            )}

            {EXERCISE_GROUP_ORDER.map((g) => {
              const items = narrowed.filter((e) => e.group === g);
              if (items.length === 0) return null;
              return (
                <div key={g} className={s.pickerGroup}>
                  <div className={s.pickerLabel}>{GROUP_LABELS[g]}</div>
                  <div className={s.pickerList}>
                    {items.map((e) => {
                      const used = usedIds.has(e.id);
                      // マイ種目に入れていない種目。その日に入っているときだけここに出る
                      const adhoc = e.shelf === 'adhoc';
                      return (
                        <button
                          key={e.id}
                          type="button"
                          className={`${s.pickerBtn} ${adhoc ? s.pickerBtnAdhoc : ''}`}
                          aria-pressed={used}
                          // ✓ はトグル。押しても外れないと、間違えて入れたものを
                          // ここで取り消せず、閉じてカードの × を探すことになる
                          onClick={() => onToggle(e.id)}
                        >
                          {used ? '✓ ' : '＋ '}
                          {e.name}
                          {adhoc && <span className={s.adhocTag}>未追加</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Modal>
    </>
  );
}
