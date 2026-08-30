import { NumericInput } from '../NumericInput';
import { describeKey } from '../../lib/check';
import { MINUTES_PER_SET_RANGE, SESSION_MINUTES_RANGE } from '../../lib/storage';
import type { CheckSettings, Exercise } from '../../types';
import ui from '../../styles/ui.module.scss';
import s from './training.module.scss';

interface Props {
  checks: CheckSettings;
  suppressed: readonly string[];
  exercises: readonly Exercise[];
  onUpdate: (patch: Partial<CheckSettings>) => void;
  onUnsuppress: (key: string) => void;
}

/**
 * トレーニング種目のレビューの設定（設定 &gt; トレーニング &gt; トレーニング種目のレビュー）。
 *
 * ここに置くのは滅多に変えない定義だけ、という設定タブの規則に従う。
 * 指摘そのもの（何が引っかかっているか）は記録画面とプリセット画面にある。
 *
 * **既定は無効。** 負荷値も所要時間も、入れ終わるまでは判定が当たらない。
 * 勝手に出はじめると「よく分からない指摘が出るもの」として最初に閉じられる。
 */
export function CheckSettingsForm({
  checks,
  suppressed,
  exercises,
  onUpdate,
  onUnsuppress,
}: Props) {
  return (
    <>
      <section className={ui.card}>
        <div className={ui.formRow}>
          <label id="check-enabled">レビューを表示する</label>
          <button
            type="button"
            className={s.pickerBtn}
            aria-pressed={checks.enabled}
            aria-labelledby="check-enabled"
            onClick={() => onUpdate({ enabled: !checks.enabled })}
          >
            {checks.enabled ? 'オン' : 'オフ'}
          </button>
        </div>
        <p className={ui.note}>
          オンにすると、記録画面にレビューが出ます。
          <b>種目に「軸荷重種目」を入れていないと判定は当たりません</b>
          （マイ種目 &gt; その種目 &gt; レビューの値）。
          <br />
          見るのは<b>記録した日付だけ</b>です。疲労の量は持ちません。
        </p>
      </section>

      {checks.enabled && (
        <>
          <section className={ui.card}>
            <header className={ui.cardHeader}>
              <h2 className={ui.cardTitle}>セッションの長さ</h2>
            </header>

            <div className={s.checkFields}>
              <label className={s.newField}>
                上限（分）
                <small>空欄なら見ない</small>
                <NumericInput
                  id="check-session-minutes"
                  value={checks.sessionMinutes}
                  min={SESSION_MINUTES_RANGE[0]}
                  max={SESSION_MINUTES_RANGE[1]}
                  step={5}
                  placeholder="見ない"
                  onCommit={(v) => onUpdate({ sessionMinutes: v })}
                />
              </label>
              <label className={s.newField}>
                1セットあたり（分）
                <small>種目ごとに上書きできます</small>
                <NumericInput
                  id="check-minutes-per-set"
                  value={checks.minutesPerSet}
                  min={MINUTES_PER_SET_RANGE[0]}
                  max={MINUTES_PER_SET_RANGE[1]}
                  step={0.5}
                  onCommit={(v) => onUpdate({ minutesPerSet: v ?? checks.minutesPerSet })}
                />
              </label>
            </div>

            {/* 80 文字以内。何をどう数えるか → だからこの出し方、だけを言う */}
            <p className={ui.note}>
              時間はセット数×1セットの時間で見積もります。休憩が大半を占めるので、回数は掛けません。
            </p>
          </section>

          <section className={ui.card}>
            <header className={ui.cardHeader}>
              <h2 className={ui.cardTitle}>許容済み</h2>
              <span className={ui.hint}>{suppressed.length}件</span>
            </header>

            {suppressed.length === 0 ? (
              <p className={ui.emptyState}>
                まだありません。
                <br />
                指摘の「許容する」を押すと、ここに溜まります。
              </p>
            ) : (
              suppressed.map((key) => (
                <div key={key} className={s.suppressRow}>
                  <span className={s.suppressName}>{describeKey(key, exercises)}</span>
                  <button
                    type="button"
                    className={`${ui.btn} ${ui.btnGhost} ${ui.btnSm}`}
                    aria-label={`${describeKey(key, exercises)}の許容を取り消す`}
                    onClick={() => onUnsuppress(key)}
                  >
                    戻す
                  </button>
                </div>
              ))
            )}

            <p className={ui.note}>
              許容した指摘は出なくなります。意図して受け入れたものが毎回出続けると、
              全体を読まなくなるためです。ここから戻せます。
            </p>
          </section>
        </>
      )}
    </>
  );
}
