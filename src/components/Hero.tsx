import { Sparkline } from './charts/Sparkline';
import { deltaTone, fmt, fmtDelta } from '../lib/format';
import ui from '../styles/ui.module.scss';
import s from './Hero.module.scss';

interface Props {
  weight: number | null;
  delta: number | null;
  spark: readonly { t: number; v: number }[];
  caption: string;
}

const TONE_CLASS = { good: ui.good, bad: ui.bad, flat: ui.flat } as const;
const TONE_ICON = { good: '▼', bad: '▲', flat: '＝' } as const;

/** ダッシュボードが最初に見せる 1 つの数値。1 画面に 1 つだけ置く */
export function Hero({ weight, delta, spark, caption }: Props) {
  const tone = deltaTone(delta, true);

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

      <p className={s.caption}>{caption}</p>
    </section>
  );
}
