import { useState } from 'react';
import {
  EXERCISE_GROUP_ORDER,
  GROUP_KEYS,
  REP_UNIT_KEYS,
  copyOf,
  exerciseName,
  goalTypeLabel,
  isListed,
  otherLocaleNames,
} from '../../lib/exerciseCatalog';
import type { BodyData } from '../../hooks/useBodyData';
import type { Exercise, ExerciseGroup, SessionPoint } from '../../types';
import { CatalogPicker } from './CatalogPicker';
import { CustomExerciseForm } from './CustomExerciseForm';
import { TextField } from '../TextField';
import { FILTER_THRESHOLD, matchRank, matchesGroup, matchesQuery } from '../../lib/exerciseSearch';
import { GroupChips } from './GroupChips';
import { SearchToggle } from './SearchToggle';
import { ExerciseSettingsForm } from './ExerciseSettingsForm';
import { RecordMoveDialog } from './RecordMoveDialog';
import { ExerciseSummaryCard } from './ExerciseSummaryCard';
import { ExerciseDetailDialog } from './ExerciseDetailDialog';
import { Modal } from '../Modal';
import { useConfirm } from '../ConfirmDialog';
import { CardHeader } from '../CardHeader';
import { Button } from '../Button';
import ui from '../../styles/ui.module.scss';
import { MiniButton } from '../MiniButton';
import s from './training.module.scss';
import { useWeightUnit } from '../../hooks/useWeightUnit';
import { todayISO } from '../../lib/date';
import { WEIGHT_UNIT_LABEL, fromKg } from '../../lib/weight';
import type { WeightUnit } from '../../lib/weight';
import { useT } from '../../lib/i18n';
import type { T } from '../../lib/i18n';

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
  /**
   * 記録の移行に使う（`RecordMoveDialog`）。
   * 移すには workouts と体重（自重換算）が要るので、ここだけまとめて受け取る。
   */
  body?: BodyData | undefined;
}

/**
 * 目標の立て方と値。**目標タブの種目カードと同じ出し方にそろえる。**
 * 立て方はバッジ、値は「目標 100kg」。同じ種目を 2 画面で見るのに、形を変える理由がない。
 */
function goalKind(t: T, exercise: Exercise): string | null {
  return exercise.goal ? goalTypeLabel(t, exercise.goal.type, exercise.repUnit, true) : null;
}

/**
 * 目標の値と単位。**重量で数える立て方だけ、読むときの単位へ直す。**
 * 保存は kg（`lib/weight.ts`）なので、ここは出す直前の換算。
 */
function goalValue(t: T, exercise: Exercise, weightUnit: WeightUnit): string | null {
  const goal = exercise.goal;
  if (!goal || goal.value == null) return null;
  if (goal.type === 'reps') return `${goal.value}${t(REP_UNIT_KEYS[exercise.repUnit])}`;
  const value = fromKg(goal.value, weightUnit);
  return `${Math.round(value * 10) / 10}${WEIGHT_UNIT_LABEL[weightUnit]}`;
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
export function ExerciseManager({
  exercises,
  usage,
  onAdd,
  onUpdate,
  onRemove,
  sessions,
  body,
}: Props) {
  // 目標の重量は kg で保存されている。一覧に出すときだけ読む単位へ直す
  const weightUnit = useWeightUnit();
  const t = useT();
  const [adding, setAdding] = useState(false);
  const [filter, setFilter] = useState<ExerciseGroup | 'all'>('all');
  /** 名前で探す。打ちはじめたら、部位の見出しをやめて平たい候補に差し替える */
  const [query, setQuery] = useState('');
  /** 記録の移行を開いているか。種目の設定の面から開く */
  const [moving, setMoving] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  /** 推移を開いている種目。**重ねる**——画面ごと移ると、閉じたとき一覧に戻る */
  const [trendOf, setTrendOf] = useState<string | null>(null);
  const [ask, confirmDialog] = useConfirm();
  /** 写して作っている最中の名前。空でも重複でも作らせない */
  const [copying, setCopying] = useState(false);
  const [copyName, setCopyName] = useState('');

  /*
   * 同じ名前は作らせない（自作種目と同じ作法）。見るのは自分の持ちものぜんぶ——
   * 非表示や臨時のものと同名でも、一覧では見分けられない。
   */
  const nameTaken = (raw: string) => {
    const name = raw.trim();
    return name !== '' && exercises.some((e) => exerciseName(t, e) === name);
  };
  const canCopy = copyName.trim() !== '' && !nameTaken(copyName);
  const openDetail = (ex: Exercise) => {
    setEditing((cur) => (cur === ex.id ? null : ex.id));
  };

  const byId = new Map(exercises.map((e) => [e.id, e]));
  const settingsExercise = editing ? (byId.get(editing) ?? null) : null;

  /**
   * 複製する。**作ったら、その種目の設定をそのまま開く。**
   *
   * 複製の用は「元の値を写して、少しだけ変える」（ワイドグリップなら補助部位の腕を
   * 0.5 → 0.25）なので、直す場所に着いている状態で終わるのが速い。
   * **作ったものが目の前に出る**ので、できたことも伝わる——閉じてしまうと、
   * 一覧のどこに増えたのかを探すことになる。
   */
  const copy = () => {
    if (settingsExercise == null || !canCopy) return;
    const made = copyOf(settingsExercise, copyName.trim(), exercises.length);
    onAdd([made]);
    setCopying(false);
    setEditing(made.id);
  };

  const sorted = [...exercises].sort((a, b) => a.order - b.order);
  const searching = query.trim() !== '';
  // 検索とチップは AND。「腕で絞ってからカールを探す」がそのまま通る
  const filtered = sorted.filter(
    (e) =>
      matchesGroup(e, filter) && matchesQuery(exerciseName(t, e), query, otherLocaleNames(e.id)),
  );
  /* 打っている最中の並び。前方一致を先に出し、同じ近さなら元の並びのまま */
  const hits = searching
    ? [...filtered].sort(
        (a, b) => matchRank(exerciseName(t, a), query) - matchRank(exerciseName(t, b), query),
      )
    : filtered;
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

  const remove = (ex: Exercise) => {
    const days = usage.get(ex.id) ?? 0;
    /*
     * 確認を挟むのは「一緒に消えるものがある」と伝える必要があるときだけ。
     * ここでは**記録だけを見る。**
     *
     * カタログに元があるか（＝選び直して戻せるか）では分けない。
     * 一度は「複製と自作は ID が二度と同じにならないので、記録が無くても聞く」
     * としたが、**カタログの有無は使う側の関心事ではない**し、
     * バックアップの案内を削除のたびに繰り返すことにもなる
     * （JSON の書き出しは設定と README が案内している）。
     */
    if (days === 0) {
      onRemove(ex.id);
      return;
    }
    ask({
      title: t('manage.deleteTitle'),
      subject: exerciseName(t, ex),
      note: t('manage.deleteNote', { days }),
      confirmLabel: t('manage.deleteConfirm'),
      destructive: true,
      onConfirm: () => onRemove(ex.id),
    });
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
      name={exerciseName(t, ex)}
      // 主部位は見出しが持っているので、ここは補助部位だけ
      tag={
        ex.subGroups.length > 0 ? ex.subGroups.map((x) => t(GROUP_KEYS[x.group])).join('·') : null
      }
      kind={goalKind(t, ex)}
      goal={goalValue(t, ex, weightUnit)}
      factLeft={
        (usage.get(ex.id) ?? 0) > 0
          ? t('manage.recordedDays', { n: usage.get(ex.id)! })
          : t('common.noRecord')
      }
      /*
        負荷の数え方と回数の単位は出さない。**一覧で読むものではない。**
        ふだんはカタログの既定で正しく、触るのは自作種目のときくらいなので、
        全部の行に並べても読む量が増えるだけになる（変えるのは「設定」の中）。
      */
      actions={
        ex.shelf === 'hidden' ? (
          <>
            <MiniButton
              label={t('manage.unhideOf', { name: exerciseName(t, ex) })}
              onClick={() => onUpdate({ ...ex, shelf: 'listed' })}
            >
              {t('manage.unhide')}
            </MiniButton>
            <MiniButton
              label={t('manage.deleteOf', { name: exerciseName(t, ex) })}
              onClick={() => remove(ex)}
            >
              {t('settings.delete')}
            </MiniButton>
            {/*
              伏せた種目でも**推移は開ける。**非表示は「選ぶのをやめた」印で、
              記録はそのまま残っている。読む道が無いほうが不整合になる。
            */}
            <span className={s.actionsTail}>
              <MiniButton
                label={t('common.trendOf', { name: exerciseName(t, ex) })}
                onClick={() => setTrendOf(ex.id)}
              >
                {t('common.trend')}
              </MiniButton>
            </span>
          </>
        ) : (
          <>
            {/*
              **目標はここに置かない。**決めるのは目標タブの仕事で、
              この画面が持つのは種目そのものの手入れ（設定・伏せる・消す）。
            */}
            <MiniButton
              pressed={editing === ex.id}
              label={t('exercise.settingsOf', { name: exerciseName(t, ex) })}
              onClick={() => openDetail(ex)}
            >
              {t('common.settings')}
            </MiniButton>
            <MiniButton
              label={t('manage.hideOf', { name: exerciseName(t, ex) })}
              onClick={() => onUpdate({ ...ex, shelf: 'hidden' })}
            >
              {t('manage.hidden')}
            </MiniButton>
            <MiniButton
              label={t('manage.deleteOf', { name: exerciseName(t, ex) })}
              onClick={() => remove(ex)}
            >
              {t('settings.delete')}
            </MiniButton>
            {/*
              推移は**この種目をどうするか**ではなく、**過去を読む**ための入口。
              性格が違うので、右端へ離して置く（`actionsTail`）。
            */}
            <span className={s.actionsTail}>
              <MiniButton
                label={t('common.trendOf', { name: exerciseName(t, ex) })}
                onClick={() => setTrendOf(ex.id)}
              >
                {t('common.trend')}
              </MiniButton>
            </span>
          </>
        )
      }
    />
  );

  return (
    <section className={ui.card}>
      {/* 検索を開いているあいだは、件数の代わりに欄が入る（行は増やさない） */}
      <CardHeader
        title={t('settings.exercises')}
        /*
          件数は出さない。**一覧がそのまま件数になっている**うえ、
          「目標 nn件」も「非表示 nn件」も、下にその一覧が並んでいる話を
          見出しでもう一度言っていた。見出しに数字が 3 つ並ぶと題が読めない。
        */
      >
        {sorted.length > FILTER_THRESHOLD && (
          <SearchToggle query={query} onQuery={setQuery} label={t('picker.search')} />
        )}
      </CardHeader>

      {/* 追加は一番上。登録済みが増えるほど、下に置くとスクロールを強いることになる */}
      <div className={ui.btnRow}>
        <Button adds tone="primary" onClick={() => setAdding(true)}>
          {t('manage.add')}
        </Button>
      </div>

      {/* 一覧の続きに出すと、どこまでが追加の画面か分からなくなるのでモーダルにする */}
      {/* カタログは一覧なので高さを固定する（検索で件数が減っても縮まない） */}
      <Modal open={adding} title={t('manage.add')} tall onClose={() => setAdding(false)}>
        <div>
          <CatalogPicker exercises={exercises} onAdd={onAdd} />

          <CustomExerciseForm exercises={exercises} onCreate={(ex) => onAdd([ex])} />
        </div>
      </Modal>

      {sorted.length === 0 ? (
        <p className={ui.emptyState}>{t('common.noExercises')}</p>
      ) : (
        <>
          {sorted.length > FILTER_THRESHOLD && (
            <div className={s.filterBar}>
              {/*
                部位チップは**持っている種目の分類だけ**出す
                （押しても 0 件にしかならないチップを並べない）。
              */}
              <GroupChips
                value={filter}
                onChange={setFilter}
                groups={EXERCISE_GROUP_ORDER.filter((g) => sorted.some((e) => matchesGroup(e, g)))}
              />
            </div>
          )}

          {/*
            部位ごとに見出しを付ける。並び替えを持たないので、探し方は「何番目か」ではなく
            「どの部位か」になる。見出しは主部位で切る（一覧の絞り込みと同じ切り方）。

            **探しているあいだは束ねない。**名前で当てに行っているので、
            部位の見出しは読まれないまま場所だけ取る。
          */}
          {searching
            ? hits.filter((ex) => isListed(ex)).map(card)
            : EXERCISE_GROUP_ORDER.map((group) => {
                const items = shown.filter((ex) => ex.group === group);
                if (items.length === 0) return null;

                return (
                  <div key={group}>
                    <div className={s.manageGroup}>{t(GROUP_KEYS[group])}</div>

                    {items.map(card)}
                  </div>
                );
              })}

          {filtered.length === 0 && <p className={ui.emptyState}>{t('catalog.noMatch')}</p>}

          {hiddenShown.length > 0 && (
            <>
              <div className={s.manageGroup}>{t('manage.hidden')}</div>
              {hiddenShown.map(card)}
            </>
          )}

          <p className={ui.note}>{t('manage.entryNote')}</p>
          {/* 80 文字以内 */}
          <p className={ui.note}>{t('manage.hideNote')}</p>
        </>
      )}

      {/*
        設定は**ダイアログで出す。** 行の中で展開すると、開くたびに下の種目が
        押し下げられ、次に押したい場所が動く（部位の目標の面と同じ扱いにそろえる）。
      */}
      {/*
        推移は**ダイアログで重ねる。**目標タブの種目カードと同じ扱いで、
        閉じれば見ていた一覧の位置に戻る。
      */}
      <ExerciseDetailDialog
        open={trendOf != null}
        onClose={() => setTrendOf(null)}
        exercise={exercises.find((e) => e.id === trendOf) ?? null}
        sessions={sessions}
        from={sessions[0]?.date ?? todayISO()}
      />

      {settingsExercise && !moving && (
        /*
          複製は**面を差し替える**（重ねない）。同じ作業の続きなので、
          右上は「‹ 戻る」＋「閉じる」になる（設計の「3 段は作らない」）。

          以前は設定の面の中に名前の行を出していたが、**決めるのが小さな ✓** で、
          そのすぐ上に目立つ「閉じる」がある形だった。打った名前が黙って捨てられる。
          面を分ければ、決めるのは 44px の主ボタン 1 つになる。
        */
        <Modal
          open
          title={
            copying
              ? t('manage.copyOf', { name: exerciseName(t, settingsExercise) })
              : t('exercise.settingsOf', { name: exerciseName(t, settingsExercise) })
          }
          onClose={() => {
            setCopying(false);
            setEditing(null);
          }}
          onBack={copying ? () => setCopying(false) : undefined}
        >
          {copying ? (
            <div className={s.newForm}>
              <p className={ui.note}>{t('manage.copyNote')}</p>

              <label className={s.newField} htmlFor="copy-name">
                {t('manage.newName')}
                {/* この面は名前を打つだけなので、開いたらすぐ打てるようにする */}
                <TextField
                  id="copy-name"
                  value={copyName}
                  maxLength={40}
                  autoFocus
                  onChange={setCopyName}
                  onCommit={canCopy ? copy : undefined}
                />
              </label>

              {nameTaken(copyName) && <p className={ui.note}>{t('manage.nameTakenRename')}</p>}

              <div className={ui.btnRow}>
                <Button tone="primary" disabled={!canCopy} onClick={copy}>
                  {t('manage.copyDo')}
                </Button>
              </div>
            </div>
          ) : (
            <div>
              <ExerciseSettingsForm exercise={settingsExercise} onUpdate={onUpdate} />

              {/*
                **この種目を複製して、別の種目として持つ。**
                グリップやスタンスを変えた版（ワイドグリップ懸垂、スモウデッドリフト）は
                回数も部位の配分も変わるので、**記録は分けたい**。ただし作るたびに
                部位・補助部位・体重係数・1RM の分母を入れ直すのは現実的でない。
                いま開いている種目はその値が全部埋まっているので、ここから複製する。
              */}
              <div className={ui.btnRow}>
                <Button
                  size="sub"
                  onClick={() => {
                    // 元の名前を入れておく。**同じ名前では作れない**ので、
                    // どこを足せばいいか（ワイドグリップ〜）が形から分かる
                    setCopyName(exerciseName(t, settingsExercise));
                    setCopying(true);
                  }}
                >
                  {t('manage.copyThis')}
                </Button>
              </div>

              {/*
                **記録を別の種目へ移行する入口。**ここにしか置かない。
                「別の種目として記録してしまった」を直す操作で、滅多にやらないうえ
                過去を書き換えるので、種目の性質を見ている場所の末尾に置く。
                記録が 1 日も無ければ、移すものが無い。
              */}
              {(usage.get(settingsExercise.id) ?? 0) > 0 && (
                <div className={ui.btnRow}>
                  <Button size="sub" onClick={() => setMoving(true)}>
                    {t('manage.moveRecords')}
                  </Button>
                </div>
              )}
            </div>
          )}
        </Modal>
      )}

      {settingsExercise && moving && body && (
        <RecordMoveDialog body={body} from={settingsExercise} onClose={() => setMoving(false)} />
      )}

      {confirmDialog}
    </section>
  );
}
