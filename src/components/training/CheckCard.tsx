import { useMemo } from 'react';
import { CheckWarnings } from './CheckWarnings';
import { checkDay, estimateTime, visibleWarnings, type CheckHistory } from '../../lib/check';
import type { CheckSettings, Exercise, SessionExercise } from '../../types';
import ui from '../../styles/ui.module.scss';
import s from './training.module.scss';

interface Props {
  date: string;
  /** その日に並んでいる種目。**生の workouts** を渡す（値を打つ前でも検算するため） */
  entries: readonly SessionExercise[];
  exercises: readonly Exercise[];
  history: CheckHistory;
  checks: CheckSettings;
  suppressed: readonly string[];
  onSuppress: (key: string) => void;
}

/**
 * その日のレビュー（記録画面）。
 *
 * 扱うのは **組んだ構成に無理がないか** だけ。
 * 「体が回復しているか」は回復カードが持つ（見る場面が違う。
 * あちらは種目を選ぶ前、こちらは選んだあと）。
 *
 * **出すのは警告と見積もり時間だけ。** 腰椎の日内合計はゲージで常時出していたが、
 * 上限を超えたかどうかは W2 が警告として言う。越えていない日にゲージだけ置いても、
 * 毎回そこにあるものは読まれなくなる。判定はこれまでどおり行っていて、
 * 見えなくなったのは「あと少しで越える」の一段だけ。
 *
 * プリセットカードのすぐ下、種目カードより上に置く。
 * 献立を選ぶのは記録を始める前なので、構成の話は種目カードより手前で終わらせる。
 *
 * **種目が 1 つも無い日は出さない。** 検算する対象がないうちから枠だけ置くと、
 * 画面を開くたびに空のチェック欄が目に入る。
 */
export function CheckCard({
  date,
  entries,
  exercises,
  history,
  checks,
  suppressed,
  onSuppress,
}: Props) {
  const byId = useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises]);

  const warnings = useMemo(
    () => visibleWarnings(checkDay({ date, entries }, exercises, history, checks), suppressed),
    [date, entries, exercises, history, checks, suppressed],
  );

  const items = useMemo(
    () =>
      entries
        .map((entry) => {
          const exercise = byId.get(entry.exerciseId);
          return exercise ? { exercise, sets: entry.sets.length } : null;
        })
        .filter((x): x is { exercise: Exercise; sets: number } => x != null),
    [entries, byId],
  );

  // 有効にしていなければ何も出さない。判定は当たらないので、出しても読む意味がない
  if (!checks.enabled || items.length === 0) return null;

  const time = estimateTime(items, checks);

  return (
    <>
      {/*
        **警告が無ければカードごと出さない。** 「レビュー なし」と書かれた枠が毎日そこにあると、
        中身が入った日にも枠として読み飛ばされる。出るときだけ出るから目に入る。
      */}
      {warnings.length > 0 && (
        <section className={ui.card}>
          <header className={ui.cardHeader}>
            <h2 className={ui.cardTitle}>レビュー</h2>
            <span className={ui.hint}>{warnings.length}件</span>
          </header>

          <CheckWarnings warnings={warnings} onSuppress={onSuppress} />
        </section>
      )}

      {/*
        見積もり時間は**常に出す。** 上限を超えたかどうかは警告が言うが、
        枠に対してどれくらい積んだかは、越える前から見えていないと組み替えようがない。
        カードにはしない（1 行のために枠を作ると、種目カードがそのぶん下へ流れる）。
      */}
      <p className={s.checkTime}>
        見積もり時間 {time.total}分
        {checks.sessionMinutes != null && ` / 上限 ${checks.sessionMinutes}分`}
      </p>
    </>
  );
}
