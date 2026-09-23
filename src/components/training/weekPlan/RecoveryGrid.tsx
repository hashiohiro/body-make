import { GROUP_COLORS, GROUP_KEYS } from '../../../lib/exerciseCatalog';
import { recoveryRule } from '../../../lib/check';
import { recoveryRows } from '../../../lib/weekPlan';
import { formatSets } from '../../../lib/training';
import type { CSSProperties } from 'react';
import type { MuscleGroup } from '../../../types';
import ui from '../../../styles/ui.module.scss';
import s from './weekPlan.module.scss';
import { useT } from '../../../lib/i18n';
import type { T } from '../../../lib/i18n';

interface Props {
  /** 並びぶんの部位別セット数。**並びの意味は呼ぶ側が決める** */
  days: readonly Record<MuscleGroup, number>[];
  /** 列の見出し。曜日（日〜土）でも、直近 7 日の日付でもよい */
  labels: readonly string[];
  /**
   * 最後の次を先頭へ戻すか。**週の組み立ては戻し、実績は戻さない。**
   * 金土に置いた脚が日月に置いたのと同じことにならないように（組み立て側）。
   * 実績のほうは先がまだ無いので、戻すと未来を塗ることになる。
   */
  wrap?: boolean | undefined;
  /** 何の並びかを書く見出し */
  caption: string;
  /**
   * 何も置いていない部位の行も出すか。
   * 実績では「今週まだやっていない部位」がそのまま読む相手になるので出す。
   */
  all?: boolean | undefined;
  /** 手前に足した助走の数。計算にだけ使い、表示からは落とす */
  skip?: number | undefined;
}

/** やる日の塗り。濃さはセット数（部位ごとに正規化する） */
const fill = (color: string, ratio: number) =>
  `color-mix(in srgb, ${color} ${18 + ratio * 52}%, transparent)`;

/**
 * 回復中の斜線。**塗りの濃さではなく、柄で区別する。**
 *
 * はじめは薄い塗りで表していたが、やる日の薄い塗り（＝セット数が少ない日）と
 * 見分けがつかなかった。柄なら、塗りと重なっても両方が読める
 * ——「回復中にやる日」が、塗りの上に斜線が乗る形で**そのまま出る**。
 */
const stripes = (color: string) =>
  `repeating-linear-gradient(135deg, color-mix(in srgb, ${color} 40%, transparent) 0 2px, transparent 2px 5px)`;

/**
 * 回復の帯。**いつ効かせて、いつまで回復中かを、曜日の並びで見せる。**
 *
 * 警告文だけだと「金と月が近い」と言われても、週全体のどこが詰まっているのかは
 * 読み取れない。図で詰まりに気づき、下の文で理由を読む、という順にする。
 *
 * 色は部位別グラフと同じもの（`GROUP_COLORS`）。濃淡は**部位ごとに正規化**する
 * ——全体で正規化すると、扱う値の小さい腕や肩の行が常に薄くなる
 * （「部位別の配分」のヒートマップと同じ理由）。
 *
 * **採点はしない。**詰まっている日に柄が重なるだけで、点も達成率も出さない。
 */
export function RecoveryGrid({ days, labels, wrap, caption, all, skip }: Props) {
  const t = useT();
  const rows = recoveryRows(days, { wrap: wrap ?? true, all: all ?? false, skip: skip ?? 0 });
  if (rows.length === 0) return null;

  return (
    <div className={s.recoveryWrap}>
      <p className={ui.sectionLabel}>{caption}</p>

      {/*
        凡例は**実物**で出す。文だけだと、どの塗りがどれか読み合わせることになる。
        色は部位ごとに変わるので、見本は柄の違いが分かる中立色で描く。
      */}
      <div className={s.legend}>
        <span className={s.legendItem}>
          <span className={s.swatch} style={{ backgroundColor: fill('var(--ink-2)', 1) }} />
          {t('recoveryGrid.doDay')}
        </span>
        <span className={s.legendItem}>
          <span className={s.swatch} style={{ backgroundImage: stripes('var(--ink-2)') }} />
          {t('recoveryGrid.recoveringLegend')}
        </span>
        <span className={s.legendItem}>
          <span
            className={s.swatch}
            style={{
              backgroundColor: fill('var(--ink-2)', 1),
              backgroundImage: stripes('var(--ink-2)'),
            }}
          />
          {t('recoveryGrid.overlap')}
        </span>
      </div>

      <table className={s.recovery}>
        <thead>
          <tr>
            <th scope="col">{t('group.label')}</th>
            {labels.map((text, i) => (
              <th key={i} scope="col">
                {text}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.group}>
              <th scope="row">{t(GROUP_KEYS[row.group])}</th>
              {row.cells.map((cell, at) => {
                const color = GROUP_COLORS[row.group];
                const style: CSSProperties = {};
                if (cell.sets > 0) style.backgroundColor = fill(color, cell.sets / row.max);
                if (cell.recovering) style.backgroundImage = stripes(color);
                return (
                  <td
                    key={at}
                    style={style}
                    title={cellTitle(t, row.group, labels[at] ?? '', cell)}
                  >
                    {cell.sets > 0 ? formatSets(cell.sets) : ''}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {/*
        規則だけを 1 行で。詰まっている場所は上の図が出しているので、
        「胸が月→火で中0日」のように組み合わせごとに並べる必要はない。
      */}
      <p className={ui.note}>
        {t('recoveryGrid.rule')}
        {recoveryRule(t)}
      </p>
    </div>
  );
}

/**
 * そのマスが何を言っているか。柄だけでは読めない人にも、触れば出る。
 * `t` は引数で受ける——ここは部品ではないのでフックを呼べない。
 */
function cellTitle(
  t: T,
  group: MuscleGroup,
  label: string,
  cell: { sets: number; recovering: boolean },
): string {
  const where = `${t(GROUP_KEYS[group])} ${label}`;
  if (cell.sets === 0)
    return cell.recovering
      ? t('recoveryGrid.recovering', { where })
      : t('recoveryGrid.free', { where });
  const load = t('common.sets', { n: formatSets(cell.sets) });
  return cell.recovering
    ? t('recoveryGrid.onRecovery', { where, load })
    : t('recoveryGrid.plain', { where, load });
}
