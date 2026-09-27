import { Button } from '../Button';
import { useState } from 'react';
import { ExerciseDetailDialog } from './ExerciseDetailDialog';
import { ExercisePickList } from './ExercisePickList';
import { ExerciseSettingsForm } from './ExerciseSettingsForm';
import { GoalEditor } from './GoalEditor';
import { GoalTrack } from './GoalTrack';
import { GoalLegend, ReachedRing } from './GoalLegend';
import { TONE_CLASS } from '../tone';
import { groupColor } from './groupColor';
import { Modal } from '../Modal';
import {
  EXERCISE_GROUP_ORDER,
  GROUP_KEYS,
  byName,
  exerciseName,
  isListed,
} from '../../lib/exerciseCatalog';
import { fmt } from '../../lib/format';
import { todayISO } from '../../lib/date';
import { RECENT_DAYS, STALE_WEEKS } from '../../lib/training';
import type { ExerciseGoal, TrainingStats } from '../../lib/training';
import type { Exercise, SessionPoint } from '../../types';
import { CardHeader } from '../CardHeader';
import ui from '../../styles/ui.module.scss';
import { Tag } from '../Tag';
import { Pill } from '../Pill';
import s from './training.module.scss';
import { useGoalUnit } from '../../hooks/useWeightUnit';
import { useT } from '../../lib/i18n';

interface Props {
  goals: readonly ExerciseGoal[];
  exercises: readonly Exercise[];
  /** 目標を決めるときに「いま」と「過去最大」を出すために使う */
  sessions: readonly SessionPoint[];
  stats: TrainingStats;
  onUpdate: (exercise: Exercise) => void;
  /**
   * マイ種目の画面へ行く。**必須。**
   *
   * 任意にすると「渡されなかったとき用」の分岐が要るが、画面をまたぐ移動は
   * ルートを持つ `App` が必ず渡すので、その分岐には入らない。
   * **入らない道を書かない**（ホームの「記録する」と同じ、導線の作法）。
   */
  onOpenExercises: () => void;
}

/**
 * 種目の目標。**軸は種目ひとつ。**
 *
 * 今週の量（`WeeklyVolumeCard`）とはカードを分ける。あちらは部位の話で今週限り、
 * こちらは種目の話で週をまたいで積み上がる。同じ行に置くと、
 * 日曜に 0 へ戻る数字と積み上がる数字が隣り合って、片方が毎週壊れて見える。
 *
 * 部位で束ねない。**部位を軸にすると、また 2 つの軸が混ざる。**
 * 並びは部位の順（胸 → 背中 → …）にするが、見出しは付けず種目をそのまま並べる。
 *
 * 1 種目 2 行。1 行目に名前と立て方、2 行目に「いま → 目標」とバー。
 * 決めるのは行を押した先のダイアログで、この面は読むことに専念させる。
 */
export function ExerciseGoalsCard({
  goals,
  exercises,
  sessions,
  stats,
  onUpdate,
  onOpenExercises,
}: Props) {
  const t = useT();
  // 目標は kg で導出されている。出す直前に読む単位へ直す
  const shown = useGoalUnit();
  /** 開いている種目。目標を決める面と、種目そのものの設定の面を持つ */
  const [openId, setOpenId] = useState<string | null>(null);
  const [settings, setSettings] = useState(false);
  /** 推移を開いている種目。目標のダイアログの上に重ねる（閉じると元の面に戻る） */
  const [trendOf, setTrendOf] = useState<string | null>(null);
  /** 目標を足す面。まだ目標を持たない種目から選ぶ */
  const [picking, setPicking] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);

  const byId = new Map(exercises.map((e) => [e.id, e]));
  const order = new Map(EXERCISE_GROUP_ORDER.map((g, i) => [g, i]));

  /*
   * **並びは進み具合の順**（到達 → 到達率の高い順 → 記録なし）。同じ進み具合なら部位の順 → 名前順。
   *
   * 以前は部位ごとに見出しを付けて名前順に並べていた。1 本の線で進み具合を描くようにしたので、
   * 近いものから上に来るほうが一目で読める。どの部位かは行頭の色の丸（今週の量の棒と同じ色）が持つ。
   */
  const collator = new Intl.Collator(t.locale);
  const rank = (g: ExerciseGoal) => (g.reached ? 2 : g.current == null ? -1 : (g.progress ?? 0));
  const byGroupName = (a: ExerciseGoal, b: ExerciseGoal) => {
    const ga = order.get(a.group) ?? 99;
    const gb = order.get(b.group) ?? 99;
    if (ga !== gb) return ga - gb;
    return collator.compare(a.name, b.name);
  };
  const sorted = [...goals].sort((a, b) => rank(b) - rank(a) || byGroupName(a, b));
  /** 数値の目標。1 本の線で出す */
  const tracked = sorted.filter((g) => g.target != null);
  /** 維持は数値を決めないので線を持たない。名前だけを下に並べる */
  const maintained = sorted.filter((g) => g.target == null);
  const reached = tracked.filter((g) => g.reached).length;

  /** まだ目標を持たない種目。非表示の種目には足さない（一覧にも出ない） */
  const withoutGoal = byName(
    t,
    exercises.filter((e) => isListed(e) && e.goal == null),
  ).sort((a, b) => (order.get(a.group) ?? 99) - (order.get(b.group) ?? 99));

  /*
   * マイ種目が 1 つも無い状態。**ここでは目標を決めようがない。**
   *
   * 以前は「種目を選ぶと決められます」と誘っておきながらボタンは無効で、
   * 理由（マイ種目が空）は**押したあとの位置**に小さく置いてあった。
   * 押して初めて何かおかしいと気づき、そこから理由を探すことになる。
   * 行き先があるのだから、死んだボタンではなく **そこへの入口** を出す。
   */
  const noListed = !exercises.some(isListed);

  const openExercise = openId ? (byId.get(openId) ?? null) : null;
  const trendExercise = trendOf ? (byId.get(trendOf) ?? null) : null;
  const pickedExercise = picked ? (byId.get(picked) ?? null) : null;

  /**
   * 目標 1 件。**色の丸・名前・いま / 目標** の 1 行と、その下に 1 本の線。
   *
   * 行ぜんたいが**推移**への入口。目標を決める面は、推移の見出し（閉じるの左）から開く——
   * 目標を決め直すのは推移を見てからのことが多いので、見る → 決めるの順に並べる。
   * いまの値の色は事実だけ：届いた（緑）・開始より下（赤）。
   */
  const row = (goal: ExerciseGoal) => {
    const unit = shown(goal.unit);
    return (
      <button
        key={goal.exerciseId}
        type="button"
        className={s.goalRow}
        aria-label={t('common.trendOf', { name: goal.name })}
        onClick={() => setTrendOf(goal.exerciseId)}
      >
        <span className={s.goalRowHead}>
          <i
            className={s.goalRowDot}
            style={{ background: groupColor(goal.group) }}
            aria-hidden="true"
          />
          <span className={s.goalRowName}>{goal.name}</span>
          <b className={nowTone(goal)}>{fmt(unit.conv(goal.current), goal.digits)}</b>
          <span className={s.goalRowOf}>
            {`/ ${fmt(unit.conv(goal.target), goal.digits)} ${unit.label}`}
          </span>
        </span>
        <GoalTrack goal={goal} label={t('exGoal.rate', { name: goal.name })} />
      </button>
    );
  };

  const close = () => {
    setOpenId(null);
    setSettings(false);
    setPicking(false);
    setPicked(null);
  };

  return (
    <>
      <section className={ui.card}>
        <CardHeader
          title={t('exGoal.title')}
          hint={
            tracked.length > 0 ? (
              <span className={s.ringHint}>
                <ReachedRing done={reached} total={tracked.length} />
                {t('exGoal.reachedCount', { done: reached, total: tracked.length })}
              </span>
            ) : null
          }
        />

        {sorted.length === 0 ? (
          <p className={ui.emptyState}>
            {noListed ? (
              <>
                {t('common.noExercises')}
                <br />
                {t('exGoal.noExercisesHint')}
              </>
            ) : (
              <>
                {t('exGoal.empty')}
                <br />
                {t('exGoal.emptyHint')}
              </>
            )}
          </p>
        ) : (
          <>
            {tracked.length > 0 && <GoalLegend />}
            {tracked.map(row)}
            {maintained.length > 0 && (
              <div className={s.maintainRow}>
                <span>{t('goalType.maintain')}</span>
                {maintained.map((goal) => (
                  <button
                    key={goal.exerciseId}
                    type="button"
                    className={s.maintainChip}
                    aria-label={t('common.trendOf', { name: goal.name })}
                    onClick={() => setTrendOf(goal.exerciseId)}
                  >
                    {goal.name}
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {/*
          **押せないボタンは置かない。**

          3 つの状態がある。**未着手**（マイ種目が空）はやることが 1 つしかないので、
          その入口を目立たせる。**続きがある**（候補が残っている）は今までどおり。
          **完了**（ぜんぶ決めた）は、できることが無いのだからボタンを出さない——
          灰色のボタンは「薄いだけの押せるもの」に見えて、押して初めて反応しないと分かる。

          完了でも進む道はある（マイ種目を増やす）。ただしそれは
          「目標を追加」とは別の行き先なので、**同じ位置に同じ形では置かない。**
          押し間違えると、目標を足すつもりで設定へ飛ばされる。文章の続きとして、
          行き先が読めるリンクの姿で添える。
        */}
        {noListed ? (
          <div className={ui.btnRow}>
            <Button adds tone="primary" onClick={onOpenExercises}>
              {t('exGoal.addExercise')}
            </Button>
          </div>
        ) : withoutGoal.length === 0 ? (
          <>
            <p className={ui.note}>{t('exGoal.allSet')}</p>
            <div className={ui.detailRow}>
              <button type="button" className={ui.detailBtn} onClick={onOpenExercises}>
                {t('exGoal.openExercises')}
              </button>
            </div>
          </>
        ) : (
          <div className={ui.btnRow}>
            <Button
              tone={goals.length === 0 ? 'primary' : undefined}
              onClick={() => setPicking(true)}
            >
              {t('exGoal.addTitle')}
            </Button>
          </div>
        )}

        {/* 更新と停滞はどちらも種目ごとの話。目標を持たない種目も含むので、行には出せない */}
        {(stats.recentBests > 0 || stats.stalled > 0) && (
          <div className={s.statRow} style={{ fontSize: 11 }}>
            <span>{t('exGoal.recentDays', { days: RECENT_DAYS })}</span>
            <span className={s.coverCount}>
              {t('exGoal.bests')} <b>{stats.recentBests}</b> {t('exGoal.exerciseUnit')}
            </span>
            <span className={s.coverCount}>
              {t('exGoal.stalled', { weeks: STALE_WEEKS })} <b>{stats.stalled}</b>{' '}
              {t('exGoal.exerciseUnit')}
            </span>
          </div>
        )}
      </section>

      {/*
        推移は**ダイアログで重ねる。** 見出しの「閉じる」の左に「目標」を置き、
        そこから目標を決める面をさらに重ねる（閉じると推移に戻る）。
      */}
      <ExerciseDetailDialog
        open={trendOf != null}
        onClose={() => setTrendOf(null)}
        exercise={trendExercise}
        sessions={sessions}
        from={sessions[0]?.date ?? todayISO()}
        action={
          trendExercise
            ? {
                label: t('common.goal'),
                ariaLabel: t('exGoal.changeOf', { name: exerciseName(t, trendExercise) }),
                onClick: () => setOpenId(trendExercise.id),
              }
            : undefined
        }
      />

      {openExercise && (
        <Modal
          open
          title={
            settings
              ? t('exercise.settingsOf', { name: exerciseName(t, openExercise) })
              : t('exercise.goalOf', { name: exerciseName(t, openExercise) })
          }
          onClose={close}
          onBack={settings ? () => setSettings(false) : undefined}
        >
          {settings ? (
            <ExerciseSettingsForm exercise={openExercise} onUpdate={onUpdate} />
          ) : (
            /*
              目標を決める面（推移の見出しから開く）。種目そのものの設定の入口はここに置き、
              この面を差し替えて出す（‹ 戻る で戻る）。
            */
            <>
              <GoalEditor exercise={openExercise} sessions={sessions} onUpdate={onUpdate} />
              <div className={ui.detailRow}>
                <button
                  type="button"
                  className={ui.detailBtn}
                  aria-label={t('exercise.settingsOf', { name: exerciseName(t, openExercise) })}
                  onClick={() => setSettings(true)}
                >
                  {t('common.settings')}
                </button>
              </div>
            </>
          )}
        </Modal>
      )}

      {picking && (
        <Modal
          open
          title={
            pickedExercise
              ? t('exercise.goalOf', { name: exerciseName(t, pickedExercise) })
              : t('exGoal.addTitle')
          }
          onClose={close}
          onBack={pickedExercise ? () => setPicked(null) : undefined}
        >
          {pickedExercise ? (
            <GoalEditor exercise={pickedExercise} sessions={sessions} onUpdate={onUpdate} />
          ) : (
            <div>
              {/* 選ぶ面はどこも同じ組み（検索・部位チップ・部位ごとの見出し） */}
              <ExercisePickList
                items={withoutGoal}
                heading={t('exGoal.pickHeading')}
                empty={<p className={ui.emptyState}>{t('exGoal.allSet')}</p>}
                renderItem={(e, searching) => (
                  <Pill key={e.id} onClick={() => setPicked(e.id)}>
                    {exerciseName(t, e)}
                    {/* 束ねる見出しが無いので、探した結果では部位も行に添える */}
                    {searching && <Tag>{t(GROUP_KEYS[e.group])}</Tag>}
                  </Pill>
                )}
              />
            </div>
          )}
        </Modal>
      )}
    </>
  );
}

/** 「いま」の色。届いたか・開始より下か、の 2 つの事実だけ（それ以外は色を付けない） */
function nowTone(goal: ExerciseGoal): string | undefined {
  if (goal.reached) return TONE_CLASS.good;
  if (goal.current != null && goal.baseline != null && goal.current < goal.baseline) {
    return TONE_CLASS.bad;
  }
  return undefined;
}
