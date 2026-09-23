import { addDays, formatMD } from '../../lib/date';
import { GROUP_KEYS, muscleOf } from '../../lib/exerciseCatalog';
import { requiredDays } from '../../lib/check';
import type { GroupSets } from '../../lib/check';
import { goalCurrent, goalUnitOf } from '../../lib/training';
import type { CardioWeek, ExerciseHistoryPoint } from '../../lib/training';
import { fmt } from '../../lib/format';
import { useWeightFormat } from '../../hooks/useWeightUnit';
import type { Exercise, ExercisePoint, GroupGoals, MuscleGroup } from '../../types';
import s from './training.module.scss';
import { useT } from '../../lib/i18n';

interface Props {
  exercise: Exercise;
  /** 打っている日。回復の「次はいつ」を出すのに要る */
  date: string;
  /** その日のこの種目。まだ何も打っていなければ null */
  point: ExercisePoint | null;
  /** この種目の前回。目標を跨いだかを見る相手 */
  previous: ExerciseHistoryPoint | null;
  /** **その日を含む週**の部位別セット数。今日の週とは限らない（遡って打つ日がある） */
  weekSets: Record<MuscleGroup, number>;
  /** 同じ週の部位別挙上量（kg）。部位の目標を挙上量で立てたときに割る相手 */
  weekVolume: Record<MuscleGroup, number>;
  groupGoals: GroupGoals;
  /** その日の部位別セット数。**回復と同じ数え方**（`CheckHistory`）を借りる */
  todayGroupSets: GroupSets | null;
  /** その日を含む週の有酸素。部位を持たない種目の行 */
  cardio: CardioWeek;
}

interface Row {
  key: string;
  label: string;
  value: string;
}

/** セット数は補助部位の係数で端数が出る。小数第 1 位まで。整数なら小数点を出さない */
function sets1(n: number): string {
  const rounded = Math.round(n * 10) / 10;
  return fmt(rounded, Number.isInteger(rounded) ? 0 : 1);
}

/**
 * 波及行。**その一打が、この種目の外に及んだぶんを出す。**
 *
 * 1 セット打つと 8 つの面が動くのに、打った場所で見えるのはその日の合計と
 * 通算の最高だけだった。残りは別のタブで、切り替えの向こう側にある。
 * **複利はもう動いていて、見えていないだけ**だったので、動いた先をここへ戻す。
 *
 * ここは **新しい計算を 1 つも持たない。**週の配分も回復も目標も、
 * すでに画面のどこかに出ている値を、打っている場所で引き直しているだけ。
 *
 * 出すのは **数値と符号だけ**。「更新」「達成」「いい調子」は書かない
 * （`design-training.md` §1.2）。`→` が向きを持っている。
 */
export function ExerciseRipple({
  exercise,
  date,
  point,
  previous,
  weekSets,
  weekVolume,
  groupGoals,
  todayGroupSets,
  cardio,
}: Props) {
  const t = useT();
  const { label: unitLabel, conv } = useWeightFormat();
  const rows: Row[] = [];
  const muscle = muscleOf(exercise.group);

  if (muscle == null) {
    /*
     * 有酸素は部位ではないので、部位の行も回復の行も出ない。
     * 代わりに週の回数と時間を出す（目標画面が部位と別に持っている行と同じ軸）。
     * **「部位には入りません」とは書かない**——入らない道を書かない。
     */
    rows.push({
      key: 'cardio',
      label: t('ripple.cardioWeek'),
      value: t('volume.cardio', { times: cardio.days, minutes: cardio.minutes }),
    });
  } else {
    /*
     * 部位の今週。**跨いでいなくても常に出す。**
     *
     * その一打が必ず動かすものが 1 つだけあり、部位の目標を立てていない人には
     * これが唯一の「外に及んだ」情報になる。ブロックが出たり消えたりもしなくなる。
     *
     * **主部位だけ。**ベンチは肩にも腕にも係数ぶん積まれるが、3 部位ぶん並べると
     * 部位だけで 3 行を使い切る。補助ぶんの配分はホームのヒートマップが持つ話。
     */
    const target = groupGoals[muscle];
    // 立て方で見る軸が変わる。行に出す数字も、跨いだかどうかも、同じ軸から引く
    const volumeAxis = target?.type === 'volume';
    const after = volumeAxis ? weekVolume[muscle] : weekSets[muscle];
    const mine = volumeAxis ? (point?.volume ?? 0) : (point?.workSets ?? 0);
    const before = after - mine;

    const show = (n: number) => (volumeAxis ? fmt(conv(n), 0) : sets1(n));
    const unit = volumeAxis ? unitLabel : t('metric.setsUnit');
    // まだ何も打っていなければ矢印を出さない（8 → 8 は読むものが増えるだけ）
    const moved = mine > 0 ? `${show(before)} → ${show(after)}` : show(after);

    let note = '';
    if (target) {
      const reached = after >= target.value && before < target.value;
      note = reached
        ? t('ripple.goalReached', { value: show(target.value) })
        : t('ripple.goalOf', { value: show(target.value) });
    }

    rows.push({
      key: 'group',
      label: t('ripple.groupWeek', { group: t(GROUP_KEYS[muscle]) }),
      value: `${moved} ${unit}${note}`,
    });

    /*
     * 部位の空き。**変わったときだけ。**
     *
     * 段は 3 つしかないので（`RECOVERY_STEPS`）、1 セット足すたびには動かない。
     * 動いたときだけ「次にこの部位を置けるのはいつか」が変わる。
     * 数えるのは `CheckHistory` と同じ形なので、回復カードの数字と必ず一致する。
     */
    const todaySets = todayGroupSets?.[muscle] ?? 0;
    const withoutMine = todaySets - (point?.workSets ?? 0);
    const days = requiredDays(todaySets);
    if (days > 0 && days !== requiredDays(withoutMine)) {
      rows.push({
        key: 'recovery',
        label: t('ripple.nextOf', { group: t(GROUP_KEYS[muscle]) }),
        // 日付が答えで、セット数がその根拠。日数は日付が言っているので添えない
        value: t('ripple.nextValue', {
          date: formatMD(addDays(date, days)),
          sets: sets1(todaySets),
        }),
      });
    }
  }

  /*
   * 種目の目標。**跨いだときだけ。**
   *
   * 「含まない場合と含む場合の差」なので、比べる相手は前回のセッション
   * （その日を除いた直近の値）。超えている日に毎回出すと、到達した事実ではなく
   * 状態の表示になり、読み飛ばされる。
   */
  const goal = exercise.goal;
  if (goal?.value != null && point) {
    const current = goalCurrent(goal.type, point);
    const before = previous ? goalCurrent(goal.type, previous.point) : null;
    if (current != null && current >= goal.value && (before == null || before < goal.value)) {
      const unit = goalUnitOf(t, goal.type, exercise.repUnit);
      const kg = unit === 'kg';
      const digits = goal.type === 'weight' || goal.type === 'speed' ? 1 : 0;
      const value = kg ? conv(goal.value) : goal.value;
      rows.push({
        key: 'goal',
        label: t('common.goal'),
        value: t('ripple.reached', {
          value: fmt(value, digits),
          unit: kg ? unitLabel : unit,
        }),
      });
    }
  }

  if (rows.length === 0) return null;

  return (
    <dl className={s.ripple} data-ripple>
      {/* 上限 3 行。外へ及んだ順に置いてあるので、溢れたら後ろから落ちる */}
      {rows.slice(0, 3).map((row) => (
        <div key={row.key} className={s.rippleRow}>
          <dt className={s.rippleLabel}>{row.label}</dt>
          <dd className={s.rippleValue}>{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}
