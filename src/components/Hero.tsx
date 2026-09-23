import { Sparkline } from './charts/Sparkline';
import { deltaTone, fmt, fmtDelta } from '../lib/format';
import type { DeltaTone } from '../lib/format';
import { TONE_CLASS } from './tone';
import s from './Hero.module.scss';
import { useT } from '../lib/i18n';

interface Props {
  weight: number | null;
  delta: number | null;
  spark: readonly { t: number; v: number }[];
  /** 除脂肪体重。体重が落ちてもここが保たれているかが減量の質 */
  lean: number | null;
  leanDelta: number | null;
  leanSpark: readonly { t: number; v: number }[];
  /** 腹囲。設定で有効にしたときだけ渡ってくる（null なら行ごと出ない） */
  waist: number | null;
  waistDelta: number | null;
  waistSpark: readonly { t: number; v: number }[];
  caption: string;
}

const TONE_ICON = { good: '▼', bad: '▲', flat: '＝' } as const;

interface SubProps {
  label: string;
  value: number;
  unit: string;
  delta: number | null;
  tone: DeltaTone;
  color: string;
  spark: readonly { t: number; v: number }[];
}

/**
 * 主役の数値に添える 1 行。**体重と並べて読むためのもの。**
 *
 * 除脂肪体重は「体重が落ちてもここが保たれているか」、
 * 腹囲は「体重が止まっていてもここは落ちているか」。どちらも
 * 単独で見る数字ではないので、大きな数値にはせず、同じ器で下に積む。
 */
function SubRow({ label, value, unit, delta, tone, color, spark }: SubProps) {
  const t = useT();

  return (
    <div className={s.sub}>
      <p className={s.subHead}>
        <span className={s.subLabel}>{label}</span>
        <b className={s.subValue}>
          {fmt(value)}
          <span className={s.subUnit}>{unit}</span>
        </b>
        <span className={`${s.subDelta} ${TONE_CLASS[tone]}`}>
          {t('common.fromStart', { delta: fmtDelta(delta), unit: '' })}
        </span>
      </p>
      {spark.length >= 2 && (
        <Sparkline
          points={spark}
          color={color}
          height={36}
          ariaLabel={t('common.recentTrendOf', { name: label })}
        />
      )}
    </div>
  );
}

/**
 * ダッシュボードが最初に見せる 1 つの数値。大きな数字は 1 画面に 1 つだけ置く。
 * 除脂肪体重と腹囲は、体重と並べて読むための従属的な行として下に添える。
 */
export function Hero({
  weight,
  delta,
  spark,
  lean,
  leanDelta,
  leanSpark,
  waist,
  waistDelta,
  waistSpark,
  caption,
}: Props) {
  const t = useT();
  const tone = deltaTone(delta, true);
  // 除脂肪体重は維持が正解。±0.5kg を中立域として色を付けない
  const leanTone = deltaTone(leanDelta, false, 0.5);

  return (
    <section className={s.hero}>
      <p className={s.label}>{t('hero.movingAverageOf', { name: t('common.weight') })}</p>
      <p className={s.value}>
        {fmt(weight)}
        <span className={s.unit}>kg</span>
      </p>
      <p className={`${s.delta} ${TONE_CLASS[tone]}`}>
        <span aria-hidden="true">{TONE_ICON[tone]}</span>
        {t('common.fromStart', { delta: fmtDelta(delta), unit: ' kg' })}
      </p>

      {spark.length >= 2 && (
        <div className={s.spark}>
          <Sparkline
            points={spark}
            ariaLabel={t('common.recentTrendOf', { name: t('common.weight') })}
          />
        </div>
      )}

      {lean != null && (
        <SubRow
          label={t('hero.leanMass')}
          value={lean}
          unit="kg"
          delta={leanDelta}
          tone={leanTone}
          color="var(--s-lean)"
          spark={leanSpark}
        />
      )}

      {waist != null && (
        <SubRow
          label={t('hero.waist')}
          value={waist}
          unit="cm"
          delta={waistDelta}
          // 腹囲は減るのが良い。体重と同じ向きで色を付ける
          tone={deltaTone(waistDelta, true)}
          color="var(--s-waist)"
          spark={waistSpark}
        />
      )}

      <p className={s.caption}>{caption}</p>
    </section>
  );
}
