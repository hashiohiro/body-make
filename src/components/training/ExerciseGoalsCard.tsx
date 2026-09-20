import { Button } from '../Button';
import { useState } from 'react';
import { ExerciseDetailDialog } from './ExerciseDetailDialog';
import { ExercisePickList } from './ExercisePickList';
import { ExerciseSettingsForm } from './ExerciseSettingsForm';
import { GoalEditor } from './GoalEditor';
import { Meter } from '../Meter';
import { Modal } from '../Modal';
import {
  EXERCISE_GROUP_ORDER,
  GROUP_LABELS,
  goalTypeLabel,
  isListed,
} from '../../lib/exerciseCatalog';
import { fmt, fmtPercent } from '../../lib/format';
import { todayISO } from '../../lib/date';
import { RECENT_DAYS, STALE_WEEKS } from '../../lib/training';
import type { ExerciseGoal, TrainingStats } from '../../lib/training';
import type { Exercise, SessionPoint } from '../../types';
import { CardHeader } from '../CardHeader';
import ui from '../../styles/ui.module.scss';
import { Tag } from '../Tag';
import { MiniButton } from '../MiniButton';
import { Pill } from '../Pill';
import s from './training.module.scss';
import { useGoalUnit } from '../../hooks/useWeightUnit';

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

  /* 並びは部位の順 → その部位の中はマイ種目の並び。押すたびに順が変わらないように */
  const sorted = [...goals].sort((a, b) => {
    const ga = order.get(a.group) ?? 99;
    const gb = order.get(b.group) ?? 99;
    if (ga !== gb) return ga - gb;
    return (byId.get(a.exerciseId)?.order ?? 0) - (byId.get(b.exerciseId)?.order ?? 0);
  });
  const reached = goals.filter((g) => g.reached).length;

  /** まだ目標を持たない種目。非表示の種目には足さない（一覧にも出ない） */
  const withoutGoal = exercises
    .filter((e) => isListed(e) && e.goal == null)
    .sort((a, b) => {
      const ga = order.get(a.group) ?? 99;
      const gb = order.get(b.group) ?? 99;
      return ga === gb ? a.order - b.order : ga - gb;
    });

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
  const pickedExercise = picked ? (byId.get(picked) ?? null) : null;

  /**
   * 目標 1 件の行。**部位ごとに束ねて出す**ので、行の側に部位は書かない
   * （見出しが言っている）。
   */
  const row = (goal: ExerciseGoal) => {
    const exercise = byId.get(goal.exerciseId);
    return (
      <button
        key={goal.exerciseId}
        type="button"
        className={s.goalRow}
        aria-label={`${goal.name}の目標`}
        onClick={() => setOpenId(goal.exerciseId)}
      >
        <span className={s.goalRowHead}>
          <span className={s.goalRowName}>{goal.name}</span>
          <Tag kind="chosen">{goalTypeLabel(goal.type, exercise?.repUnit ?? 'reps', true)}</Tag>
          <span className={s.chevron} aria-hidden="true">
            ›
          </span>
        </span>

        {/*
          いまと目標を並べる。**片方だけでは決めた値に近いのか分からない。**
          維持は数値を決めないので、目標もバーも出さない（割る相手がない）
        */}
        <span className={s.goalRowBody}>
          {/*
            前回からの増減はここに足さない。**1 行で動く数字は 1 つにする。**
            足すと「いま → 目標」の右に別の軸の数字が並び、
            そのぶん列を広げるとバーが痩せる。伸びの中身は推移が持っている。
          */}
          <span className={s.goalRowValue}>
            {fmt(shown(goal.unit).conv(goal.current), goal.digits)}
            {goal.target != null &&
              ` → ${fmt(shown(goal.unit).conv(goal.target), goal.digits)}`}{' '}
            {shown(goal.unit).label}
          </span>

          {goal.target == null ? (
            <span />
          ) : (
            <Meter value={goal.progress ?? 0} label={`${goal.name}の到達率`} />
          )}

          {/* 維持は数値を決めないので割合も出ない。それは上の「維持」が言っている */}
          <span className={s.goalRowPct}>
            {goal.target == null
              ? '—'
              : goal.reached
                ? '到達'
                : goal.progress == null
                  ? '—'
                  : fmtPercent(goal.progress)}
          </span>
        </span>
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
          title="種目の目標"
          hint={
            goals.length > 0 ? (
              <>
                {reached} / {goals.length} 到達
              </>
            ) : null
          }
        />

        {sorted.length === 0 ? (
          <p className={ui.emptyState}>
            {noListed ? (
              <>
                マイ種目がまだ空です。
                <br />
                種目を手元に入れると、そこから目標を決められます。
              </>
            ) : (
              <>
                まだ目標がありません。
                <br />
                種目を選ぶと、いまの値を見ながら決められます。
              </>
            )}
          </p>
        ) : (
          /*
            **部位ごとに見出しを付ける。**マイ種目・カタログ・移行先と同じ切り方。
            並び順だけ部位の順にしていたが、見出しが無いと切れ目が読めず、
            どこまでが同じ部位なのかを行の右の札で数えることになっていた。
          */
          EXERCISE_GROUP_ORDER.map((g) => {
            const items = sorted.filter((goal) => goal.group === g);
            if (items.length === 0) return null;
            return (
              <div key={g}>
                <div className={s.manageGroup}>{GROUP_LABELS[g]}</div>
                {items.map(row)}
              </div>
            );
          })
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
            <Button tone="primary" onClick={onOpenExercises}>
              ＋ マイ種目に種目を追加
            </Button>
          </div>
        ) : withoutGoal.length === 0 ? (
          <>
            <p className={ui.note}>
              すべてのマイ種目に目標を決めています。種目を増やすと、その目標も決められます。
            </p>
            <div className={ui.detailRow}>
              <button type="button" className={ui.detailBtn} onClick={onOpenExercises}>
                マイ種目を開く
              </button>
            </div>
          </>
        ) : (
          <div className={ui.btnRow}>
            <Button
              tone={goals.length === 0 ? 'primary' : undefined}
              onClick={() => setPicking(true)}
            >
              ＋ 種目の目標を追加
            </Button>
          </div>
        )}

        {/* 更新と停滞はどちらも種目ごとの話。目標を持たない種目も含むので、行には出せない */}
        {(stats.recentBests > 0 || stats.stalled > 0) && (
          <div className={s.statRow} style={{ fontSize: 11 }}>
            <span>直近{RECENT_DAYS}日</span>
            <span className={s.coverCount}>
              自己最高 <b>{stats.recentBests}</b> 種目
            </span>
            <span className={s.coverCount}>
              {STALE_WEEKS}週以上動いていない <b>{stats.stalled}</b> 種目
            </span>
          </div>
        )}
      </section>

      {/*
        推移は**ダイアログで重ねる。** 画面ごと移ってしまうと、閉じたときに戻るのは
        目標の一覧で、開いていた種目の面ではない。見ていた場所に戻れるようにする。
      */}
      <ExerciseDetailDialog
        open={trendOf != null}
        onClose={() => setTrendOf(null)}
        exercise={exercises.find((e) => e.id === trendOf) ?? null}
        sessions={sessions}
        from={sessions[0]?.date ?? todayISO()}
      />

      {openExercise && (
        <Modal
          open
          title={settings ? `${openExercise.name}の設定` : `${openExercise.name}の目標`}
          onClose={close}
          onBack={settings ? () => setSettings(false) : undefined}
        >
          {settings ? (
            <ExerciseSettingsForm exercise={openExercise} onUpdate={onUpdate} />
          ) : (
            <div>
              <GoalEditor exercise={openExercise} sessions={sessions} onUpdate={onUpdate} />

              {/*
                入口はマイ種目の行と同じ並び（推移 / 設定）。同じ種目なのに
                画面によってボタンの名前や数が違うと、どちらで何ができるか覚え直しになる
              */}
              <div className={ui.btnRow}>
                <MiniButton
                  label={`${openExercise.name}の推移を見る`}
                  onClick={() => setTrendOf(openExercise.id)}
                >
                  推移を見る
                </MiniButton>
                <MiniButton label={`${openExercise.name}の設定`} onClick={() => setSettings(true)}>
                  設定
                </MiniButton>
              </div>
            </div>
          )}
        </Modal>
      )}

      {picking && (
        <Modal
          open
          title={pickedExercise ? `${pickedExercise.name}の目標` : '種目の目標を追加'}
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
                heading="目標を決めていない種目"
                empty={<p className={ui.emptyState}>すべての種目に目標を決めています。</p>}
                renderItem={(e, searching) => (
                  <Pill key={e.id} onClick={() => setPicked(e.id)}>
                    {e.name}
                    {/* 束ねる見出しが無いので、探した結果では部位も行に添える */}
                    {searching && <Tag>{GROUP_LABELS[e.group]}</Tag>}
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
