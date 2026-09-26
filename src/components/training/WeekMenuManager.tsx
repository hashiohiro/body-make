import { useState } from 'react';
import { PresetRow } from './PresetRow';
import { Strong } from '../Strong';
import { PresetBlock } from './PresetBlock';
import { Modal } from '../Modal';
import { BodyMap } from './weekPlan/BodyMap';
import { RecoveryGrid } from './weekPlan/RecoveryGrid';
import { useConfirm } from '../ConfirmDialog';
import { ChoicePanel } from '../ChoicePanel';
import { PresetCreateDialog } from './PresetCreateDialog';
import { WEEKDAYS } from '../../lib/weekPlan';
import { WEEKDAY_KEYS } from '../../lib/date';
import { GROUP_KEYS, GROUP_ORDER, byName, groupsOf } from '../../lib/exerciseCatalog';
import { weekLoad } from '../../lib/weekPlan';
import type { Exercise, GroupGoals, MuscleGroup, Preset, Weekday } from '../../types';
import { CardHeader } from '../CardHeader';
import { Button } from '../Button';
import ui from '../../styles/ui.module.scss';
import s from './training.module.scss';
import { useT } from '../../lib/i18n';

interface Props {
  presets: readonly Preset[];
  /** マイ種目。週メニューに置けるのはここにある種目だけ */
  exercises: readonly Exercise[];
  /** 部位の週目標。セット数の提案はここからしか出さない */
  groupGoals: GroupGoals;
  onUpdate: (preset: Preset) => void;
  onRemove: (id: string) => void;
  onAddExercises: (exercises: readonly Exercise[]) => void;
  /** 新しいプリセットを作る。曜日を渡すと、そのままその曜日に置く */
  onCreate: (name: string, exerciseIds: readonly string[], weekdays?: readonly Weekday[]) => void;
}

/**
 * 週メニュー（設定 &gt; トレーニング &gt; 週メニュー）。
 *
 * **曜日を持つプリセットを、日〜土の 7 行として読む面。**持ちものはプリセットのままで、
 * 週という器は持たない——曜日から並べ直せば同じものが出る（導出値を保存しない作法）。
 * `Routine` を撤回したときの判定基準「いま生きている思想だけから再導出できるか」に、
 * この形なら乗る（`docs/design-training.md` §11-6）。
 *
 * **組んだ結果を採点しない。**やらなかった曜日は空くだけで、未達も進捗も出さない
 * （§11-3 で撤回した「今日のメニュー表」と分かれるのはここ）。
 *
 * 行の中身はプリセット画面とまったく同じ部品（`PresetBlock`）。
 * 違うのは並べ方だけで、直し方まで面ごとに変えると覚えることが増える。
 */
export function WeekMenuManager({
  presets,
  exercises,
  groupGoals,
  onUpdate,
  onRemove,
  onAddExercises,
  onCreate,
}: Props) {
  const t = useT();
  /** その曜日のプリセットを作っている最中か */
  const [creatingFor, setCreatingFor] = useState<Weekday | null>(null);
  /** 編集しているプリセット。**行を押したらそのまま開く**（畳んだ段を挟まない） */
  const [editingId, setEditingId] = useState<string | null>(null);
  /** 始め方を選んでいる曜日 */
  const [starting, setStarting] = useState<Weekday | null>(null);
  /** 置くプリセットを選んでいる曜日 */
  const [picking, setPicking] = useState<Weekday | null>(null);
  const [ask, confirmDialog] = useConfirm();

  /*
   * **区別は曜日の有無だけ。**「週メニュー」という別のものは無く、
   * 曜日を持つプリセットを日〜土に並べ直して見せているだけ。
   * 月曜のメニューとは「月曜に使っているプリセット」でしかない。
   */
  /*
   * 曜日を持つもの。**伏せたものは降ろす**——曜日は持ったままなので、
   * 表示に戻せばこの面へそのまま戻る（`Preset.hidden`）。
   */
  /* 曜日の中も一覧も名前順（作った順は使う側から見ると意味を持たない） */
  const sorted = byName(t, presets);
  const placed = sorted.filter((p) => p.weekdays.length > 0);
  const onDay = (day: Weekday) => placed.filter((p) => p.weekdays.includes(day));
  /**
   * その曜日に置ける候補。**その日にまだ無いものは、ぜんぶ出す。**
   *
   * 以前は「曜日を持たないもの」だけを候補にしていたので、一度どこかに置くと
   * **二度と別の曜日に置けなかった**。押す日を月曜と木曜にやる、は普通のことで、
   * 持ちものは 1 つのまま曜日を 2 つ持てばよい（`Preset.weekdays` は配列で、
   * 押したときの処理も足す形になっている）。塞いでいたのはこの絞り込みだけ。
   *
   * **伏せたものは出さない。**置いてある側（`placed`）では降ろしているのに、
   * 置く候補にだけ残っていた——使わないと決めたものを、置く先で勧めていた。
   */
  const candidates = (day: Weekday) => sorted.filter((p) => !p.hidden && !p.weekdays.includes(day));
  /* 置いてあるものを読むだけ。計画データは持たない（`weekLoad`） */
  const load = weekLoad(presets, exercises, groupGoals);
  const peak = Math.max(...GROUP_ORDER.map((g) => load.totals[g]), 0);
  const tint = Object.fromEntries(
    GROUP_ORDER.map((g) => [g, peak > 0 ? load.totals[g] / peak : 0]),
  ) as Partial<Record<MuscleGroup, number>>;
  // 中身は書き換わるので、id から毎回引き直す
  const editing = presets.find((p) => p.id === editingId) ?? null;

  return (
    <section className={ui.card}>
      <CardHeader
        title={t('settings.week')}
        hint={<>{t('settings.count', { n: placed.length })}</>}
      />

      {placed.length === 0 && (
        <p className={ui.emptyState}>
          {t('week.empty')}
          <br />
          {t('week.emptyHint')}
        </p>
      )}

      {/*
        週にどの部位を置いているか。**押せない読む専用の図。**
        濃さは週のセット数そのもの（いちばん多い部位が最も濃い）。
        週目標に対する比にすると、目標を決めていない部位が常に空になり
        「サボっている」と読める塗りになる（§1.2）。
      */}
      {peak > 0 && (
        <div className={s.weekFigure}>
          <p className={ui.sectionLabel}>{t('week.bodyMap')}</p>
          <BodyMap tint={tint} label={t('week.bodyMap')} />
          <p className={ui.note}>
            {t('week.tintNote', {
              breakdown: GROUP_ORDER.filter((g) => load.totals[g] > 0)
                .map((g) => `${t(GROUP_KEYS[g])} ${load.totals[g]}`)
                .join(' / '),
            })}
          </p>
        </div>
      )}

      {/* 7 日ぶん。置いていない曜日も**行として残す**——休みも週の一部 */}
      {WEEKDAYS.map((day) => {
        const items = onDay(day);
        return (
          <div key={day} className={s.weekRow}>
            {items.length === 0 ? (
              /*
               * 置いていない日。**始め方を選ばせる。**いきなり全身図を開くと、
               * すでに持っているプリセットを置きたいだけの人が遠回りになる。
               */
              <button
                type="button"
                className={s.weekRowHead}
                aria-label={t('week.setDay', { day: t(WEEKDAY_KEYS[day]) })}
                onClick={() => setStarting(day)}
              >
                <span className={s.weekRowDay}>{t(WEEKDAY_KEYS[day])}</span>
                <span className={s.weekRowRest}>{t('week.rest')}</span>
                <span className={s.weekRowMark} aria-hidden="true">
                  ＋
                </span>
              </button>
            ) : (
              /*
               * **押したら中身の編集へ。**そこが実施順・種目・既定のセットの置き場所。
               * 部位から組み直したいときは、編集の面から全身図へ行ける。
               */
              items.map((preset, i) => (
                <button
                  key={preset.id}
                  type="button"
                  className={s.weekRowHead}
                  aria-label={t('week.editOn', { day: t(WEEKDAY_KEYS[day]), name: preset.name })}
                  onClick={() => setEditingId(preset.id)}
                >
                  {/* 同じ日に 2 件置けるので、曜日は先頭の行にだけ出す */}
                  <span className={s.weekRowDay}>{i === 0 ? t(WEEKDAY_KEYS[day]) : ''}</span>
                  <span className={s.weekRowBody}>
                    <span className={s.weekRowName}>{preset.name}</span>
                    <span className={s.weekRowGroups}>
                      {t('week.presetSummary', {
                        groups: groupsOf(t, exercises, preset.exerciseIds),
                        n: preset.exerciseIds.length,
                      })}
                    </span>
                  </span>
                  <span className={s.weekRowMark} aria-hidden="true">
                    ›
                  </span>
                </button>
              ))
            )}
          </div>
        );
      })}

      {/* 間隔は週全体の話。開かなくても読めるよう、一覧に出す */}
      {peak > 0 && (
        <RecoveryGrid
          caption={t('week.interval')}
          days={WEEKDAYS.map((d) => load.perDay[d])}
          labels={WEEKDAY_KEYS.map((k) => t(k))}
        />
      )}

      {load.unknown.length > 0 && (
        <p className={ui.note}>
          <Strong
            text={t('week.unknownNote', {
              groups: load.unknown.map((g) => t(GROUP_KEYS[g])).join(t('common.listSep')),
            })}
            values={[t('week.weeklyGoal'), t('preset.defaults')]}
          />
        </p>
      )}

      {/* 休みの日を押したときの、始め方を選ぶ面 */}
      {starting != null && (
        <Modal
          open
          title={t('week.dayTitle', { day: t(WEEKDAY_KEYS[starting]) })}
          onClose={() => setStarting(null)}
        >
          <ChoicePanel
            choices={[
              {
                label: t('week.createNew'),
                onSelect: () => {
                  setCreatingFor(starting);
                  setStarting(null);
                },
              },
              {
                label: t('picker.fromPresets'),
                onSelect: () => {
                  setPicking(starting);
                  setStarting(null);
                },
              },
            ]}
            onCancel={() => setStarting(null)}
          />
        </Modal>
      )}

      {/* その場で作って、そのままその曜日に置く */}
      {creatingFor != null && (
        <PresetCreateDialog
          exercises={exercises}
          presets={presets}
          title={t('week.createOn', { day: t(WEEKDAY_KEYS[creatingFor]) })}
          onCreate={(name, ids) => onCreate(name, ids, [creatingFor])}
          onAddExercises={onAddExercises}
          onClose={() => setCreatingFor(null)}
        />
      )}

      {/*
        曜日に置くプリセットを選ぶ。**写さずに、そのプリセットに曜日を足す。**
        月曜のメニューとは「月曜に使っているプリセット」でしかないので、
        複製を作ると同じものが 2 つになる（片方だけ直る事故のもと）。
      */}
      {picking != null && (
        <Modal
          open
          title={t('week.pickOn', { day: t(WEEKDAY_KEYS[picking]) })}
          onClose={() => setPicking(null)}
        >
          {candidates(picking).length === 0 ? (
            <p className={ui.emptyState}>
              {t('preset.managerEmpty')}
              <br />
              {t('week.noPresetsHint')}
            </p>
          ) : (
            <div>
              {candidates(picking).map((preset) => (
                <PresetRow
                  key={preset.id}
                  name={preset.name}
                  groups={groupsOf(t, exercises, preset.exerciseIds)}
                  count={preset.exerciseIds.length}
                  label={t('week.assignTo', {
                    name: preset.name,
                    day: t(WEEKDAY_KEYS[picking]),
                  })}
                  onClick={() => {
                    onUpdate({
                      ...preset,
                      weekdays: [...preset.weekdays, picking].sort((a, b) => a - b),
                    });
                    setPicking(null);
                  }}
                />
              ))}
            </div>
          )}
        </Modal>
      )}

      {/* 押したその場が編集の面。実施順・種目・既定のセット・削除がここに揃う */}
      {editing && (
        <Modal open title={editing.name} onClose={() => setEditingId(null)}>
          <PresetBlock
            preset={editing}
            exercises={exercises}
            presets={presets}
            onUpdate={onUpdate}
            onRemove={(id) => {
              setEditingId(null);
              onRemove(id);
            }}
            onAddExercises={onAddExercises}
            ask={ask}
          />

          {/*
            曜日から外す道をここに置く。**消すのとは別。**
            プリセットそのものは残り、週の並びから居なくなるだけ。
          */}
          <div className={ui.btnRow}>
            {editing.weekdays.map((d) => (
              <Button
                key={d}
                tone="ghost"
                size="sub"
                onClick={() =>
                  onUpdate({ ...editing, weekdays: editing.weekdays.filter((x) => x !== d) })
                }
              >
                {t('week.removeDay', { day: t(WEEKDAY_KEYS[d]) })}
              </Button>
            ))}
          </div>
        </Modal>
      )}

      {confirmDialog}
    </section>
  );
}
