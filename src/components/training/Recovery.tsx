import { useMemo } from 'react';
import { Modal } from '../Modal';
import { RecoveryGrid } from './weekPlan/RecoveryGrid';
import { GROUP_KEYS, GROUP_ORDER } from '../../lib/exerciseCatalog';
import { MAX_RECOVERY_DAYS, groupReadiness, type CheckHistory } from '../../lib/check';
import { WEEKDAY_KEYS, addDays, startOfWeek } from '../../lib/date';
import { formatSets } from '../../lib/training';
import type { MuscleGroup } from '../../types';
import { useT } from '../../lib/i18n';
import type { T } from '../../lib/i18n';

interface Props {
  open: boolean;
  onClose: () => void;
  date: string;
  history: CheckHistory;
}

interface Row {
  key: string;
  label: string;
  /** あと何日で回復するか。0 は回復済み */
  left: number;
  /** その行が取りうる最大の「あと何日」。ゲージの目盛りをここから決める */
  max: number;
  /** なぜその日数なのか。追えない数字は読み飛ばされるか、誤って信じられる */
  reason: string;
}

/**
 * 回復（記録画面）。
 *
 * **「この部位は回復しているか」だけを扱う。**
 * 構成チェックは「組んだ構成に無理がないか」で、見る場面もタイミングも違う
 * （こちらは種目を選ぶ前、あちらは選んだあと）。同じカードに積むと、
 * 種目を 1 つ足すたびに両方が動いて、どちらを読んでいるのか分からなくなる。
 *
 * **筋肉と腰椎はセクションを分ける。疲労の溜まり方が違う。**
 *
 * | | 筋肉 | 腰椎 |
 * | --- | --- | --- |
 * | 消費 | 部位別セット数 | 種目ごとの負荷値（0〜10） |
 * | 積み上がるか | 積み上がらない（1 回ぶんが上限） | 日をまたいで積み上がる |
 * | 抜けるまで | 24〜72 時間で飽和 | 消費量に応じて延びる |
 *
 * 7 行を 1 つの表に並べると、同じ物差しの同じ量に見える。
 * 腰椎は部位ではないし、回復のしかたも違う。
 *
 * **カードは入口だけにして、中身はダイアログで出す。**
 * 常時置くと種目カードが毎回それだけ下へ流れる。
 * 見るのは献立を決める一瞬だけで、打っている最中はいらない。
 *
 * 種目が 1 つも無い日でも出す。**空きを見てから種目を選ぶ**のが本来の順序なので、
 * 何も置いていないときこそ必要になる（構成チェックはその逆で、置いてから出る）。
 *
 * 軸荷重の行には注記を置かない。「前回」と「週の日数」が並んでいれば、
 * それが実績の表示であることは読めば分かる。読めば分かることを言い直さない。
 *
 * **状態の言葉は「回復済み／あと N 日」。**「今日やれる」とは書かない。
 * それは許可を出す言い方で、決めるのは本人（design-training.md §1.1）。
 * アプリが言えるのは体がどうなっているかまでで、やるかどうかはその先にある。
 */
/**
 * 部位ごとの行。要約と中身の両方が同じ数え方を通るように、1 か所で作る。
 * `t` は引数で受ける——ここは部品ではないのでフックを呼べない。
 */
function rowsOf(t: T, history: CheckHistory, date: string): Row[] {
  const readiness = groupReadiness(history, date);
  return GROUP_ORDER.map((g) => {
    const r = readiness[g];
    return {
      key: g,
      label: t(GROUP_KEYS[g]),
      left: r.daysLeft,
      max: MAX_RECOVERY_DAYS,
      reason:
        r.since == null
          ? t('common.noRecord')
          : t('recovery.sets', {
              when: r.since === 1 ? t('recovery.yesterday') : t('recovery.daysAgo', { n: r.since }),
              sets: formatSets(r.sets),
            }),
    };
  });
}

/**
 * 帯に出す一行。**出すのは回復している側。**
 *
 * 「脚・胸 は空くのを待っています」だと、できないことの一覧を毎回読むことになる。
 * 献立を決める場面で要るのは「どこが使えるか」のほう。
 *
 * **部位の名前だけを並べる。**帯の見出しが「回復済み」なので、
 * 値のほうに「が回復済み」と書くと同じことを 2 回言うことになる。
 *
 * **軸荷重は混ぜない。**部位の名前が並んでいるところに「（軸荷重は昨日）」が
 * 続くと、部位と同じ物差しの話に見える。あれは回復ではなく実績で、
 * 置き場所はダイアログの中（別のセクション）にある。
 */
export function recoverySummary(t: T, history: CheckHistory, date: string): string | null {
  const recovered = rowsOf(t, history, date).filter((r) => r.left === 0);
  return recovered.length === 0 ? null : recovered.map((r) => r.label).join(t('common.listSep'));
}

/**
 * 今週の実績の帯。**回復の面のいちばん上に置く。**
 *
 * 週メニューの帯と同じ絵で、軸と出どころだけが違う——あちらは日〜土の
 * 組み立て（これから）、こちらは今週の記録（やったこと）。
 *
 * 軸は**日曜はじまりの今週**で固定する。週の集計も「日曜に 0 へ戻る」も
 * 同じ区切りなので、ここだけ「直近 7 日」にすると数字の期間がずれる。
 * **先へは戻さない**（`wrap: false`）——土曜の次は来週で、まだ無い日を塗ることになる。
 *
 * **手前の日も渡して計算する。**先週の土曜にやったぶんの回復は日曜まで続く。
 * 助走が無いと、日曜に開いた帯が空になって「回復中」が消えていた（`skip`）。
 */
/** 帯の手前に足す助走の日数。回復は最長でも中2日（`MAX_RECOVERY_DAYS` − 1） */
const LEAD = MAX_RECOVERY_DAYS - 1;

function RecoveryBand({ history, date }: { history: CheckHistory; date: string }) {
  const t = useT();
  const band = useMemo(() => {
    const from = startOfWeek(date);
    // 回復は最長でも中2日なので、手前 2 日ぶんあれば持ち越しは拾いきれる
    return Array.from({ length: LEAD + WEEKDAY_KEYS.length }, (_, i) => {
      const sets = history.groupSets?.get(addDays(from, i - LEAD));
      return Object.fromEntries(GROUP_ORDER.map((g) => [g, sets?.[g] ?? 0])) as Record<
        MuscleGroup,
        number
      >;
    });
  }, [history, date]);

  /*
   * **6 部位を常に出す。**組み立ての帯は置いていない部位の行を落とすが、
   * こちらは「今週まだやっていない部位」がそのまま読む相手になる。
   * 落とすと、記録がゼロの週には表ごと出なくなっていた。
   */
  return (
    <RecoveryGrid
      caption={t('recovery.thisWeek')}
      days={band}
      labels={WEEKDAY_KEYS.map((k) => t(k))}
      wrap={false}
      all
      skip={LEAD}
    />
  );
}

export function RecoveryDialog({ open, onClose, date, history }: Props) {
  const t = useT();
  if (!open) return null;

  /*
   * 中身は帯だけ。**軸荷重の節は置かない。**
   *
   * あれは回復ではなく実績（前回いつやったか・その週に何日あったか）で、
   * 回復の面に並べると部位と同じ物差しの話に見えていた。
   * 連日になっているかどうかはレビューが指摘する（`check.ts` の `axial`）ので、
   * 読むだけの行をここに持つ必要がない。
   */
  return (
    <Modal open title={t('recovery.title')} onClose={onClose}>
      <RecoveryBand history={history} date={date} />
    </Modal>
  );
}
