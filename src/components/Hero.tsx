import { Sparkline } from './charts/Sparkline';
import { deltaTone, fmt, fmtDelta } from '../lib/format';
import ui from '../styles/ui.module.scss';
import s from './Hero.module.scss';

interface Props {
  weight: number | null;
  delta: number | null;
  spark: readonly { t: number; v: number }[];
  /** 除脂肪体重。体重が落ちてもここが保たれているかが減量の質 */
  lean: number | null;
  leanDelta: number | null;
  leanSpark: readonly { t: number; v: number }[];
  caption: string;
}

const TONE_CLASS = { good: ui.good, bad: ui.bad, flat: ui.flat } as const;
const TONE_ICON = { good: '▼', bad: '▲', flat: '＝' } as const;

/**
 * ダッシュボードが最初に見せる 1 つの数値。大きな数字は 1 画面に 1 つだけ置く。
 * 除脂肪体重は「体重が落ちても保たれているか」を並べて読むための従属的な行として添える。
 */
export function Hero({ weight, delta, spark, lean, leanDelta, leanSpark, caption }: Props) {
  const tone = deltaTone(delta, true);
  // 除脂肪体重は維持が正解。±0.5kg を中立域として色を付けない
  const leanTone = deltaTone(leanDelta, false, 0.5);

  return (
    <section className={s.hero}>
      <p className={s.label}>現在の体重（7日移動平均）</p>
      <p className={s.value}>
        {fmt(weight)}
        <span className={s.unit}>kg</span>
      </p>
      <p className={`${s.delta} ${TONE_CLASS[tone]}`}>
        <span aria-hidden="true">{TONE_ICON[tone]}</span>
        開始から {fmtDelta(delta)} kg
      </p>

      {spark.length >= 2 && (
        <div className={s.spark}>
          <Sparkline points={spark} ariaLabel="直近の体重（7日移動平均）の推移" />
        </div>
      )}

      {lean != null && (
        <div className={s.sub}>
          <p className={s.subHead}>
            <span className={s.subLabel}>除脂肪体重</span>
            <b className={s.subValue}>
              {fmt(lean)}
              <span className={s.subUnit}>kg</span>
            </b>
            <span className={`${s.subDelta} ${TONE_CLASS[leanTone]}`}>
              開始から {fmtDelta(leanDelta)}
            </span>
          </p>
          {leanSpark.length >= 2 && (
            <Sparkline
              points={leanSpark}
              color="var(--s-lean)"
              height={36}
              ariaLabel="直近の除脂肪体重（7日移動平均）の推移"
            />
          )}
        </div>
      )}

      <p className={s.caption}>{caption}</p>
    </section>
  );
}
