import { useState } from 'react';
import { CardHeader } from '../CardHeader';
import { useElementWidth } from '../../hooks/useElementWidth';
import { fmt } from '../../lib/format';
import type { TargetComposition } from '../../lib/pace';
import { useT } from '../../lib/i18n';
import ui from '../../styles/ui.module.scss';
import s from './pace.module.scss';

interface Props {
  composition: TargetComposition;
  currentBodyFat: number;
  targetBodyFat: number;
}

const HEIGHT = 250;
const BASE = 214;
const TOP = 26;

/**
 * いまと目標を、除脂肪と脂肪の積み上げ棒 2 本で並べる。
 *
 * 目標体重と目標体脂肪率から、目標の除脂肪体重が逆算できる。
 * それがいまより少ない置き方になっていても**提案はしない**——
 * 棒の高さと点線（いまの除脂肪の高さ）で差を見せ、いまの除脂肪のまま
 * 目標体脂肪率になる体重を 1 行添えるだけ（`docs/design-pace.md` §4.3・§7-4）。
 *
 * **棒を押すと内訳**（体重・除脂肪・脂肪・体脂肪率）を吹き出しで出す。
 * 棒の中に数を全部書くと、細い脂肪の段に文字が収まらない。
 */
export function CompositionCard({ composition, currentBodyFat, targetBodyFat }: Props) {
  const t = useT();
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const { current, target, weightAtCurrentLean } = composition;
  /** 内訳を開いている棒（0 = 現在、1 = 目標） */
  const [shown, setShown] = useState<0 | 1 | null>(null);

  const currentTotal = current.lean + current.fat;
  const targetTotal = target.lean + target.fat;
  const scale = (BASE - TOP) / Math.max(currentTotal, targetTotal);

  const barW = Math.min(88, width * 0.26);
  const leftX = width * 0.14;
  const rightX = width - width * 0.14 - barW;

  const bar = (x: number, lean: number, fat: number) => {
    const leanH = lean * scale;
    const fatH = fat * scale;
    const leanY = BASE - leanH;
    const fatY = leanY - fatH;
    return { x, leanY, leanH, fatY, fatH };
  };
  const now = bar(leftX, current.lean, current.fat);
  const goal = bar(rightX, target.lean, target.fat);

  const parts = [
    {
      bar: now,
      label: t('composition.current'),
      lean: current.lean,
      fat: current.fat,
      bf: currentBodyFat,
    },
    {
      bar: goal,
      label: t('composition.target'),
      lean: target.lean,
      fat: target.fat,
      bf: targetBodyFat,
    },
  ] as const;
  const open = shown == null ? null : parts[shown];

  return (
    <section className={ui.card}>
      <CardHeader title={t('composition.title')} hint="kg" />

      <div className={s.chart} ref={ref}>
        {width > 0 && (
          <svg
            viewBox={`0 0 ${width} ${HEIGHT}`}
            height={HEIGHT}
            role="img"
            aria-label={t('composition.label', {
              current: fmt(currentTotal),
              currentLean: fmt(current.lean),
              target: fmt(targetTotal),
              targetLean: fmt(target.lean),
            })}
          >
            <line x1={0} x2={width} y1={BASE} y2={BASE} stroke="var(--border)" strokeWidth={1.5} />

            {[now, goal].map((b, i) => (
              <g key={i}>
                <rect
                  x={b.x}
                  y={b.leanY}
                  width={barW}
                  height={b.leanH}
                  rx={5}
                  fill="var(--s-lean)"
                />
                <rect
                  x={b.x}
                  y={b.fatY}
                  width={barW}
                  height={Math.max(0, b.fatH - 2)}
                  rx={5}
                  fill="var(--ink-muted)"
                  opacity={0.55}
                />
                <text
                  x={b.x + barW / 2}
                  y={b.fatY - 7}
                  textAnchor="middle"
                  className={s.strongText}
                >
                  {fmt(i === 0 ? currentTotal : targetTotal)}
                </text>
                <text
                  x={b.x + barW / 2}
                  y={b.leanY + 20}
                  textAnchor="middle"
                  style={{ fill: 'var(--surface)', fontWeight: 700 }}
                >
                  {fmt(i === 0 ? current.lean : target.lean)}
                </text>
                <text x={b.x + barW / 2} y={BASE + 16} textAnchor="middle" className={s.strongText}>
                  {i === 0 ? t('composition.current') : t('composition.target')}
                </text>
                <text x={b.x + barW / 2} y={BASE + 32} textAnchor="middle">
                  {`${fmt(i === 0 ? currentBodyFat : targetBodyFat)}%`}
                </text>
              </g>
            ))}

            {/* いまの除脂肪体重の高さ。目標の棒の上端と比べるための物差し */}
            <line
              x1={leftX + barW}
              x2={rightX + barW + 12}
              y1={now.leanY}
              y2={now.leanY}
              stroke="var(--ink)"
              strokeWidth={1.2}
              strokeDasharray="3 3"
            />
          </svg>
        )}

        {/*
          棒の上に透明の押し場所を重ねる（SVG の中の図形は Tab で辿れないので、本物のボタンにする）。
          もう一度押すか、もう一方を押すと切り替わる。
        */}
        {width > 0 &&
          parts.map((p, i) => (
            <button
              key={i}
              type="button"
              className={s.barHit}
              aria-label={t('composition.breakdownOf', { name: p.label })}
              aria-expanded={shown === i}
              style={{
                left: p.bar.x,
                top: p.bar.fatY,
                width: barW,
                height: BASE - p.bar.fatY,
              }}
              onClick={() => setShown((v) => (v === i ? null : (i as 0 | 1)))}
            />
          ))}

        {open && (
          <div
            className={s.tooltip}
            role="status"
            style={{
              left: Math.min(Math.max(open.bar.x + barW / 2, 70), width - 70),
              top: open.bar.fatY - 8,
            }}
          >
            <b>{open.label}</b>
            <dl>
              <dt>{t('common.weight')}</dt>
              <dd>{fmt(open.lean + open.fat)} kg</dd>
              <dt>
                <i style={{ background: 'var(--s-lean)' }} aria-hidden="true" />
                {t('table.lean')}
              </dt>
              <dd>{fmt(open.lean)} kg</dd>
              <dt>
                <i style={{ background: 'var(--ink-muted)', opacity: 0.55 }} aria-hidden="true" />
                {t('composition.fat')}
              </dt>
              <dd>{fmt(open.fat)} kg</dd>
              <dt>{t('common.bodyFat')}</dt>
              <dd>{fmt(open.bf)}%</dd>
            </dl>
          </div>
        )}
      </div>

      <div className={s.legend}>
        <span>
          <i className={ui.swatch} style={{ background: 'var(--s-lean)' }} aria-hidden="true" />
          {t('table.lean')}
        </span>
        <span>
          <i
            className={ui.swatch}
            style={{ background: 'var(--ink-muted)', opacity: 0.55 }}
            aria-hidden="true"
          />
          {t('composition.fat')}
        </span>
      </div>

      <div className={s.row}>
        <span>{t('composition.weightAtLean', { bf: fmt(targetBodyFat) })}</span>
        <b>{fmt(weightAtCurrentLean)} kg</b>
      </div>
    </section>
  );
}
