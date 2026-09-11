import { useState } from 'react';
import {
  EXERCISE_GROUP_ORDER,
  GROUP_LABELS,
  REP_UNIT_LABELS,
  goalTypeLabel,
  isListed,
} from '../../lib/exerciseCatalog';
import type { Exercise, ExerciseGroup, SessionPoint } from '../../types';
import { CatalogPicker } from './CatalogPicker';
import { CustomExerciseForm } from './CustomExerciseForm';
import { ExerciseFilterBar, FILTER_THRESHOLD, matchesGroup } from './ExerciseFilterBar';
import { ExerciseSettingsForm } from './ExerciseSettingsForm';
import { GoalEditor } from './GoalEditor';
import { ExerciseSummaryCard } from './ExerciseSummaryCard';
import { Modal } from '../Modal';
import ui from '../../styles/ui.module.scss';
import s from './training.module.scss';

interface Props {
  exercises: readonly Exercise[];
  /** 種目 ID → その種目の記録がある日数。削除で何が消えるかを出すために使う */
  usage: ReadonlyMap<string, number>;
  onAdd: (exercises: readonly Exercise[]) => void;
  onUpdate: (exercise: Exercise) => void;
  onRemove: (id: string) => void;
  /** その種目の目標へ。決めるのは目標タブの仕事で、ここは入口だけ持つ */
  /** 目標を決めるときに「いま」と「過去最大」を出すために使う */
  sessions: readonly SessionPoint[];
}

/**
 * 目標の立て方と値。**目標タブの種目カードと同じ出し方にそろえる。**
 * 立て方はバッジ、値は「目標 100kg」。同じ種目を 2 画面で見るのに、形を変える理由がない。
 */
function goalKind(exercise: Exercise): string | null {
  return exercise.goal ? goalTypeLabel(exercise.goal.type, exercise.repUnit, true) : null;
}

function goalValue(exercise: Exercise): string | null {
  const goal = exercise.goal;
  if (!goal || goal.value == null) return null;
  const unit = goal.type === 'reps' ? REP_UNIT_LABELS[exercise.repUnit] : 'kg';
  return `${goal.value}${unit}`;
}

/**
 * マイ種目（カタログから選んで手元に置いた種目）の追加・削除と、種目ごとの性質。
 *
 * **お気に入りのようなもので、使い方は人それぞれ。**
 * ぜんぶ入れて使う人もいれば、日々やる種目はプリセットに持って、
 * マイ種目には臨時のものだけを入れる人もいる。**揃っていないことを欠けとして扱わない**
 * （足りない・未登録という言い方をしない／`Exercise.shelf` の `adhoc`）。
 *
 * カタログはその選択肢の一覧にすぎない。「種目を追加する」は、**マイ種目に足す**こと。
 * 記録そのものはここに入っていない種目でも取れる（棚が `adhoc` になる）。
 *
 * 目標値はここに置かない。進捗を見ながら何度も変わるので目標タブが持つ。
 * 一覧には目標をタグとして出す。どの種目に目標があるかは、ここでも見えていたほうがいい。
 */
export function ExerciseManager({ exercises, usage, onAdd, onUpdate, onRemove, sessions }: Props) {
  const [adding, setAdding] = useState(false);
  const [filter, setFilter] = useState<ExerciseGroup | 'all'>('all');
  const [editing, setEditing] = useState<string | null>(null);
  /** 目標を開いている種目。設定（詳細）とは同時に開かない */
  const [goalOf, setGoalOf] = useState<string | null>(null);
  const openDetail = (ex: Exercise) => {
    setGoalOf(null);
    setEditing((cur) => (cur === ex.id ? null : ex.id));
  };

  const byId = new Map(exercises.map((e) => [e.id, e]));
  const goalExercise = goalOf ? (byId.get(goalOf) ?? null) : null;
  const settingsExercise = editing ? (byId.get(editing) ?? null) : null;

  const sorted = [...exercises].sort((a, b) => a.order - b.order);
  /** 件数の見出し用。絞り込みでは動かさない */
  const shownAll = sorted.filter((e) => isListed(e));
  const filtered = sorted.filter((e) => matchesGroup(e, filter));
  const shown = filtered.filter((e) => isListed(e));
  /*
   * 非表示も部位で切る。**絞り込みは一覧ぜんぶに掛かる。**
   *
   * 末尾にまとめてあるからと絞り込みから外していたが、
   * 「有酸素」で絞っているのに関係ない部位の非表示が下に並ぶ状態になっていた。
   * 絞り込みは「この部位の話だけにする」という指示なので、例外を作らない。
   */
  /*
   * 伏せた種目だけ。**マイ種目に入れていない種目（adhoc）は並べない。**
   * 1 日だけ試した種目やプリセットのためだけに足した種目は、
   * 本人が伏せたものではないので「表示に戻す」と言える相手がいない
   * （入れたいなら、カタログから選び直せば入る）。
   */
  const hiddenShown = filtered.filter((e) => e.shelf === 'hidden');
  /** 件数の見出しは一覧ぜんぶの話。絞り込みでは動かさない */
  const hiddenAll = sorted.filter((e) => e.shelf === 'hidden');

  const remove = (ex: Exercise) => {
    const days = usage.get(ex.id) ?? 0;
    // 記録が無ければ失うものが無いので、確認しない。
    // 確認を挟むのは「一緒に消えるものがある」と伝える必要があるときだけ
    if (days === 0) {
      onRemove(ex.id);
      return;
    }
    const message = `「${ex.name}」を削除します。\nこの種目の記録 ${days}日ぶんも一緒に消えます。元に戻せません。`;
    if (confirm(message)) onRemove(ex.id);
  };

  /*
    1 種目ぶんの見せ方は、目標画面の種目カードと同じ部品を使う。
    同じ種目を 2 つの画面で見るのに、違う形で出す理由がない。
    変わるのは出す事実だけ（あちらはいまの値と到達率、ここは記録の量と数え方）。

    非表示の行は操作だけ差し替える。目標と設定は表示に戻してから触ればよく、
    使わないと決めた種目の下にボタンを 4 つ並べても選ぶ手間が増えるだけ。
  */
  const card = (ex: Exercise) => (
    <ExerciseSummaryCard
      key={ex.id}
      name={ex.name}
      // 主部位は見出しが持っているので、ここは補助部位だけ
      tag={
        ex.subGroups.length > 0 ? ex.subGroups.map((x) => GROUP_LABELS[x.group]).join('·') : null
      }
      kind={goalKind(ex)}
      goal={goalValue(ex)}
      factLeft={(usage.get(ex.id) ?? 0) > 0 ? `記録 ${usage.get(ex.id)}日` : '記録はまだありません'}
      /*
        負荷の数え方と回数の単位は出さない。**一覧で読むものではない。**
        ふだんはカタログの既定で正しく、触るのは自作種目のときくらいなので、
        全部の行に並べても読む量が増えるだけになる（変えるのは「設定」の中）。
      */
      actions={
        ex.shelf === 'hidden' ? (
          <>
            <button
              type="button"
              className={s.miniBtn}
              aria-label={`${ex.name}を表示に戻す`}
              onClick={() => onUpdate({ ...ex, shelf: 'listed' })}
            >
              表示に戻す
            </button>
            <button
              type="button"
              className={s.miniBtn}
              aria-label={`${ex.name}を削除`}
              onClick={() => remove(ex)}
            >
              削除
            </button>
          </>
        ) : (
          <>
            {/*
              目標はこの場で決める。目標タブへ連れて行くと、
              マイ種目を見ていたつもりが別の画面に移っていて、戻り方も分からない。
              決める道具（GoalEditor）は目標タブと同じものを使う。
            */}
            <button
              type="button"
              className={s.miniBtn}
              aria-pressed={goalOf === ex.id}
              aria-label={ex.goal ? `${ex.name}の目標を変える` : `${ex.name}の目標を決める`}
              onClick={() =>
                setGoalOf((cur) => {
                  setEditing(null);
                  return cur === ex.id ? null : ex.id;
                })
              }
            >
              目標
            </button>
            <button
              type="button"
              className={s.miniBtn}
              aria-pressed={editing === ex.id}
              aria-label={`${ex.name}の設定`}
              onClick={() => openDetail(ex)}
            >
              設定
            </button>
            <button
              type="button"
              className={s.miniBtn}
              aria-label={`${ex.name}を非表示にする`}
              onClick={() => onUpdate({ ...ex, shelf: 'hidden' })}
            >
              非表示
            </button>
            <button
              type="button"
              className={s.miniBtn}
              aria-label={`${ex.name}を削除`}
              onClick={() => remove(ex)}
            >
              削除
            </button>
          </>
        )
      }
    />
  );

  return (
    <section className={ui.card}>
      <header className={ui.cardHeader}>
        <h2 className={ui.cardTitle}>マイ種目</h2>
        <span className={ui.hint}>
          {shownAll.length}件 / 目標 {shownAll.filter((e) => e.goal != null).length}件
          {hiddenAll.length > 0 && ` / 非表示 ${hiddenAll.length}件`}
        </span>
      </header>

      {/* 追加は一番上。登録済みが増えるほど、下に置くとスクロールを強いることになる */}
      <div className={ui.btnRow}>
        <button
          type="button"
          className={`${ui.btn} ${ui.btnPrimary}`}
          onClick={() => setAdding(true)}
        >
          ＋ マイ種目に追加
        </button>
      </div>

      {/* 一覧の続きに出すと、どこまでが追加の画面か分からなくなるのでモーダルにする */}
      <Modal open={adding} title="マイ種目に追加" onClose={() => setAdding(false)}>
        <div>
          <CatalogPicker exercises={exercises} onAdd={onAdd} />

          <CustomExerciseForm exercises={exercises} onCreate={(ex) => onAdd([ex])} />
        </div>
      </Modal>

      {sorted.length === 0 ? (
        <p className={ui.emptyState}>マイ種目はまだ空です。</p>
      ) : (
        <>
          {sorted.length > FILTER_THRESHOLD && (
            <ExerciseFilterBar group={filter} onGroup={setFilter} exercises={sorted} />
          )}

          {/*
            部位ごとに見出しを付ける。並び替えを持たないので、探し方は「何番目か」ではなく
            「どの部位か」になる。見出しは主部位で切る（一覧の絞り込みと同じ切り方）
          */}
          {EXERCISE_GROUP_ORDER.map((group) => {
            const items = shown.filter((ex) => ex.group === group);
            if (items.length === 0) return null;

            return (
              <div key={group}>
                <div className={s.manageGroup}>{GROUP_LABELS[group]}</div>

                {items.map(card)}
              </div>
            );
          })}

          {filtered.length === 0 && (
            <p className={ui.emptyState}>このフィルターに合う種目はありません。</p>
          )}

          {hiddenShown.length > 0 && (
            <>
              <div className={s.manageGroup}>非表示</div>
              {hiddenShown.map(card)}
            </>
          )}

          <p className={ui.note}>目標も、種目そのものの性質も、行の入口から開けます。</p>
          {/* 80 文字以内 */}
          <p className={ui.note}>
            非表示にすると、記録やプリセットで選ぶときの候補から外れます。
            記録は残るので、推移では今までどおり見られます。
          </p>
        </>
      )}

      {/*
        目標と設定は**ダイアログで出す。** 行の中で展開すると、開くたびに下の種目が
        押し下げられ、次に押したい場所が動く（部位の目標の面と同じ扱いにそろえる）。
      */}
      {goalExercise && (
        <Modal open title={`${goalExercise.name}の目標`} onClose={() => setGoalOf(null)}>
          <GoalEditor exercise={goalExercise} sessions={sessions} onUpdate={onUpdate} />
        </Modal>
      )}

      {settingsExercise && (
        <Modal open title={`${settingsExercise.name}の設定`} onClose={() => setEditing(null)}>
          <ExerciseSettingsForm exercise={settingsExercise} onUpdate={onUpdate} />
        </Modal>
      )}
    </section>
  );
}
