import { addDays, formatMD } from '../../lib/date';
import { GROUP_KEYS, muscleOf } from '../../lib/exerciseCatalog';
import { requiredDays } from '../../lib/check';
import type { GroupSets } from '../../lib/check';
import type { CardioWeek } from '../../lib/training';
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
  /** **その日を含む週**の部位別セット数。今日の週とは限らない（遡って打つ日がある） */
  weekSets: Record<MuscleGroup, number>;
  weekVolume: Record<MuscleGroup, number>;
  /**
   * 部位の今週の行を出すか。入力ダイアログでは `GroupWeekLine` が同じ部位の今週を出すので、
   * 重ねないように外す（回復の日・目標の到達はこちらに残る）。
   */
  showGroup?: boolean;
  /** 同じ週の部位別挙上量（kg）。部位の目標を挙上量で立てたときに割る相手 */
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
  weekSets,
  weekVolume,
  showGroup = true,
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
    /*
     * 見る軸は 1 つ。**セット数の目標があればセット数、挙上量だけならその挙上量。**
     * 1 打ごとの行なので、2 つの目標を並べると答え（届いたか）が埋もれる。
     * 行に出す数字も、跨いだかどうかも、同じ軸から引く。
     */
    const goal = groupGoals[muscle];
    const volumeAxis = goal != null && goal.sets == null && goal.volume != null;
    const target = goal == null ? null : volumeAxis ? goal.volume : goal.sets;
    const after = volumeAxis ? weekVolume[muscle] : weekSets[muscle];
    const mine = volumeAxis ? (point?.volume ?? 0) : (point?.workSets ?? 0);
    const before = after - mine;

    const show = (n: number) => (volumeAxis ? fmt(conv(n), 0) : sets1(n));
    // まだ何も打っていなければ矢印を出さない（8 → 8 は読むものが増えるだけ）
    const moved = mine > 0 ? `${show(before)} → ${show(after)}` : show(after);

    /*
     * 単位と目標は**辞書側の穴に入れる**（`docs/design-i18n.md` §2.2）。
     * 和語の単位は詰める（`3セット`）。区切りは言語ごとに違うので、コードで決めない。
     */
    const amount = volumeAxis
      ? t('common.valueUnit', { value: moved, unit: unitLabel })
      : t('common.sets', { n: moved });

    if (showGroup) {
      rows.push({
        key: 'group',
        label: t('ripple.groupWeek', { group: t(GROUP_KEYS[muscle]) }),
        value:
          target == null
            ? amount
            : after >= target && before < target
              ? t('ripple.goalReached', { amount, value: show(target) })
              : t('ripple.goalOf', { amount, value: show(target) }),
      });
    }

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
        /*
         * **日付だけ。**セット数は添えない——すぐ上の行（`{部位} 今週`）が
         * すでにセット数を言っているし、日数は日付そのものが言っている。
         * 根拠を並べると、答えである日付が埋もれる。
         */
        value: formatMD(addDays(date, days)),
      });
    }
  }

  /*
   * 種目の目標は、ここでは出さない。カードと入力ダイアログの「{指標}の目標」の行
   * （`ExerciseGoalLine`）が、いまの値と目標を常に並べ、届けば「到達」と言う。
   * ここにも跨いだ行を置くと、同じことを 2 回言うことになる（2026/10/10）。
   */

  if (rows.length === 0) return null;

  return (
    <dl className={s.ripple} data-ripple data-e2e="ripple">
      {/* 上限 3 行。外へ及んだ順に置いてあるので、溢れたら後ろから落ちる */}
      {rows.slice(0, 3).map((row) => (
        <div key={row.key} className={s.rippleRow} data-e2e="ripple-row" data-e2e-key={row.key}>
          <dt className={s.rippleLabel}>{row.label}</dt>
          <dd className={s.rippleValue}>{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}
