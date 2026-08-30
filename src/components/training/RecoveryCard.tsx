import { useMemo, useState } from 'react';
import { Modal } from '../Modal';
import { GROUP_LABELS, GROUP_ORDER } from '../../lib/exerciseCatalog';
import { MAX_RECOVERY_DAYS, axialStatus, groupReadiness, type CheckHistory } from '../../lib/check';
import { formatMD } from '../../lib/date';
import { formatSets } from '../../lib/training';
import ui from '../../styles/ui.module.scss';
import s from './training.module.scss';

interface Props {
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
export function RecoveryCard({ date, history }: Props) {
  const [open, setOpen] = useState(false);
  const readiness = useMemo(() => groupReadiness(history, date), [history, date]);

  const muscles: Row[] = GROUP_ORDER.map((g) => {
    const r = readiness[g];
    return {
      key: g,
      label: GROUP_LABELS[g],
      left: r.daysLeft,
      max: MAX_RECOVERY_DAYS,
      reason:
        r.since == null
          ? '記録なし'
          : `${r.since === 1 ? '昨日' : `${r.since}日前`} ${formatSets(r.sets)}セット`,
    };
  });

  const axial = axialStatus(history, date);

  /*
   * ゲージは **表示している日数だけ** から引く。
   *
   * 以前は「経過日数 ÷ そのセッションに要る日数」で、分母がセッションの大きさで動いていた。
   * 胸（8セット・2日必要・1日経過＝50%）と脚（16セット・3日必要・2日経過＝67%）が
   * どちらも「あと1日」なのにバーの長さが違い、まばらに見えていた。
   *
   * 目盛りは全行で共通にする。行ごとに分母が違うと、同じ「あと1日」がまた別の長さになる。
   */
  const scale = Math.max(...muscles.map((r) => r.max), 1);
  const progress = (r: Row) => Math.max(0, (scale - r.left) / scale);

  const recovered = muscles.filter((r) => r.left === 0);

  /*
   * カードに出すのは **回復している側**。
   * 「脚・胸 は空くのを待っています」だと、できないことの一覧を毎回読むことになる。
   * 献立を決める場面で要るのは「どこが使えるか」のほう。
   */
  const summary =
    recovered.length === 0
      ? '回復した部位はありません'
      : `${recovered.map((r) => r.label).join('・')} が回復済み`;

  const row = (r: Row) => (
    <div key={r.key} className={s.recoveryRow}>
      <span className={s.recoveryName}>{r.label}</span>
      <span className={s.groupBarTrack}>
        <span className={s.groupBarFill} style={{ width: `${progress(r) * 100}%` }} />
      </span>
      <span className={r.left > 0 ? s.recoveryWait : s.recoveryReady}>
        {r.left > 0 ? `あと${r.left}日` : '回復済み'}
      </span>
      <span className={s.recoveryReason}>{r.reason}</span>
    </div>
  );

  return (
    <>
      <button
        type="button"
        className={`${ui.card} ${ui.linkRow}`}
        aria-label="回復の状態を見る"
        onClick={() => setOpen(true)}
      >
        <span>回復</span>
        <span className={s.recoverySummary}>
          {summary}
          {/* 軸荷重は回復の話ではないが、連日かどうかは献立を決める前に知りたい */}
          {axial.since === 1 && '（軸荷重種目は昨日）'}
        </span>
        <span aria-hidden="true">›</span>
      </button>

      {open && (
        <Modal open title="回復" onClose={() => setOpen(false)}>
          <div>
            <div className={ui.sectionLabel}>筋肉の疲労</div>
            {muscles.map(row)}
            {/* 80 文字以内 */}
            <p className={ui.note}>
              5セットまで翌日 / 6〜10セット中1日 /
              11セット以上中2日。積み上げず、直近の1回で決めます。
            </p>

            <div className={ui.sectionLabel}>軸荷重種目</div>
            <div className={s.recoveryRow}>
              <span className={s.recoveryName}>前回</span>
              <span />
              <span className={s.recoveryReady}>
                {axial.since == null
                  ? '記録なし'
                  : axial.since === 0
                    ? '今日'
                    : axial.since === 1
                      ? '昨日'
                      : `${axial.since}日前`}
              </span>
              <span className={s.recoveryReason}>
                {/* どの週を数えたかを書く。「今週」だと、過去の日を開いたときに現在週と読める */}
                {axial.names.join('・') || '—'} ／ {formatMD(axial.weekStart)}の週{' '}
                {axial.daysInWeek}日
              </span>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
