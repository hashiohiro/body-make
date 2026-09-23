import { useState } from 'react';
import { PresetRow } from './PresetRow';
import { CatalogPicker } from './CatalogPicker';
import { ChoicePanel } from '../ChoicePanel';
import { CustomExerciseForm } from './CustomExerciseForm';
import { ExercisePickList } from './ExercisePickList';
import { Modal } from '../Modal';
import { useFabPosition } from './useFabPosition';
import { GROUP_KEYS, exerciseName, isListed } from '../../lib/exerciseCatalog';
import type { PresetOption } from './PresetCard';
import type { Exercise } from '../../types';
import { Button } from '../Button';
import ui from '../../styles/ui.module.scss';
import { Pill } from '../Pill';
import { Tag } from '../Tag';

import s from './training.module.scss';
import { useT } from '../../lib/i18n';
import type { MessageKey } from '../../lib/i18n';

interface Props {
  exercises: readonly Exercise[];
  usedIds: ReadonlySet<string>;
  /** 保存してある組み合わせ。ここからも入れられる */
  presets: readonly PresetOption[];
  /**
   * 開いている日の週メニュー。**その日のぶんだけ、1 つ。**
   * 別の曜日のものは出さない。部位だけ決めた段階のものも渡さない（入れるものが無い）。
   */
  todayMenu: PresetOption | null;
  /** その日に入れる／外すの切り替え。押すたびに増えることはない */
  onToggle: (id: string) => void;
  /**
   * プリセットの中身をまとめてその日に入れる。
   * **プリセットごと渡す**——既定のセットを持っていれば、その本数ぶん空行を用意する。
   */
  onAddPreset: (preset: PresetOption) => void;
  /**
   * カタログから 1 種目を、その日に入れる。
   * `keep` はマイ種目にも残すか（false なら、その日だけの種目として非表示で持つ）。
   */
  onAddFromCatalog: (exercise: Exercise, keep: boolean) => void;
}

/** ＋ を押して最初に出る面と、そこから開く面 */
type Panel = 'menu' | 'exercises' | 'presets' | 'catalog' | 'keep';

const TITLE_KEYS: Record<Panel, MessageKey> = {
  menu: 'picker.menu',
  exercises: 'picker.fromMine',
  presets: 'picker.fromPresets',
  catalog: 'picker.fromCatalog',
  keep: 'picker.keepTitle',
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
  todayMenu,
  onToggle,
  onAddPreset,
  onAddFromCatalog,
}: Props) {
  const t = useT();
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

  /*
   * 非表示の種目は候補に出さない。
   * ただし **その日にすでに入っているもの** は出す（プリセットから入ることがある）。
   * 出さないと、ここで外せず閉じてカードの × を探すことになる。
   */
  const choices = exercises.filter((e) => isListed(e) || usedIds.has(e.id));

  const close = () => {
    setOpen(false);
    setPanel('menu');
    setPending(null);
    /*
     * 絞り込みは開くたびに白紙に戻る。**面ごと捨てるので、状態を持たなくてよい**
     * （`ExercisePickList` が自分で持っていて、閉じると外れる）。
     * 前に「腕」で絞ったまま次の日に開くと、種目が減ったように見える——
     * 探すための状態であって、この画面の設定ではない。
     */
  };

  /** 候補の 1 件。束ねた一覧でも、探した結果でも同じものを出す */
  const pill = (e: Exercise, searching: boolean) => {
    const used = usedIds.has(e.id);
    // マイ種目に入れていない種目。その日に入っているときだけここに出る
    const adhoc = e.shelf === 'adhoc';
    return (
      <Pill
        key={e.id}
        pressed={used}
        dashed={adhoc}
        // ✓ はトグル。押しても外れないと、間違えて入れたものを
        // ここで取り消せず、閉じてカードの × を探すことになる
        onClick={() => onToggle(e.id)}
      >
        {used ? '✓ ' : '＋ '}
        {exerciseName(t, e)}
        {/* 束ねる見出しが無いので、探した結果では部位も行に添える */}
        {searching && <Tag>{t(GROUP_KEYS[e.group])}</Tag>}
        {adhoc && <Tag kind="state">{t('exercise.notAdded')}</Tag>}
      </Pill>
    );
  };

  /** 組み合わせ 1 件ぶんの行。**今日のメニューも、プリセットも同じ見た目・同じ操作** */
  const presetRow = (preset: PresetOption) => (
    <PresetRow
      key={preset.id}
      name={preset.name}
      groups={preset.groupsLabel}
      count={preset.exerciseIds.length}
      label={t('picker.applyPreset', { name: preset.name })}
      onClick={() => {
        onAddPreset(preset);
        close();
      }}
    />
  );

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
        aria-label={t('picker.menu')}
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
        title={t(TITLE_KEYS[panel])}
        /*
          一覧を出す面は高さを固定する。絞り込みや検索で件数が減るたびに縮むと、
          下から出るシートなので上の縁が下がって、読んでいた結果が下へ逃げていく。
          足し方のメニューと「マイ種目にも追加しますか？」は中身なり（短い面）。
        */
        tall={panel === 'exercises' || panel === 'catalog' || panel === 'presets'}
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
            {menuItem(
              'exercises',
              t('picker.fromMine'),
              t('picker.mineHint', { n: choices.length }),
            )}
            {menuItem(
              'presets',
              t('picker.fromPresets'),
              t('picker.presetsHint', { n: presets.length }),
            )}
            {menuItem('catalog', t('picker.fromCatalog'), t('picker.catalogHint'))}
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

            <p className={ui.note}>{t('picker.manageNote')}</p>
          </div>
        ) : panel === 'keep' ? (
          /*
           * **答えは 2 つのボタンそのものにする。**
           * OK / キャンセルで聞くと、どちらがどちらの結果なのかを文から
           * 読み取らせることになる。押す言葉に結果を書く。
           */
          <ChoicePanel
            subject={pending ? exerciseName(t, pending) : undefined}
            choices={[
              {
                label: t('manage.add'),
                tone: 'primary',
                onSelect: () => {
                  if (pending) onAddFromCatalog(pending, true);
                  setPending(null);
                  setPanel('catalog');
                },
              },
              {
                label: t('picker.keepNo'),
                onSelect: () => {
                  if (pending) onAddFromCatalog(pending, false);
                  setPending(null);
                  setPanel('catalog');
                },
              },
            ]}
            note={t('picker.keepNote')}
          />
        ) : panel === 'presets' ? (
          presets.length === 0 && todayMenu == null ? (
            <p className={ui.emptyState}>
              {t('picker.noPresets')}
              <br />
              {t('picker.noPresetsHint')}
            </p>
          ) : (
            <div>
              {/*
                **今日のぶんだけを、1 つ。**出すだけで判定はしない——押さなければ
                何も起きず、押さなかった日に印も残らない（`design-training.md` §11-3）。
              */}
              {todayMenu && (
                <>
                  <p className={ui.sectionLabel}>{t('picker.todayMenu')}</p>
                  {presetRow(todayMenu)}
                </>
              )}
              {presets.length > 0 && (
                <>
                  {todayMenu && <p className={ui.sectionLabel}>{t('settings.presets')}</p>}
                  {presets.map(presetRow)}
                </>
              )}
            </div>
          )
        ) : choices.length === 0 ? (
          /*
           * マイ種目が空のとき。以前は「設定 > トレーニング から追加してください」とだけ出していて、
           * 初めて開いた人がその場では何もできなかった。ここから追加できるようにする。
           */
          <div>
            <p className={ui.emptyState}>
              {t('common.noExercises')}
              <br />
              {t('picker.noExercisesHint')}
            </p>
            <div className={ui.btnRow}>
              <Button adds tone="primary" onClick={() => setPanel('catalog')}>
                {t('picker.fromCatalog')}
              </Button>
            </div>
          </div>
        ) : (
          /* 選ぶ面はどこも同じ組み（検索・部位チップ・部位ごとの見出し） */
          <ExercisePickList items={choices} heading={t('settings.exercises')} renderItem={pill} />
        )}
      </Modal>
    </>
  );
}
