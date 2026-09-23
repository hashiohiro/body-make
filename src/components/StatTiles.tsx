import { deltaTone, fmt, fmtDelta } from '../lib/format';
import type { DeltaTone } from '../lib/format';
import type { Stats } from '../types';
import { TONE_CLASS } from './tone';
import { useT } from '../lib/i18n';
import ui from '../styles/ui.module.scss';
import s from './StatTiles.module.scss';

interface Tile {
  key: string;
  label: string;
  value: string;
  unit: string;
  delta: string | null;
  tone: DeltaTone;
  color: string | null;
  deltaLabel: string;
}

export function StatTiles({ stats }: { stats: Stats }) {
  const t = useT();
  const tiles: Tile[] = [
    {
      key: 'bodyFat',
      label: t('common.bodyFat'),
      value: fmt(stats.currentBodyFat),
      unit: '%',
      delta: fmtDelta(stats.bodyFatDelta),
      tone: deltaTone(stats.bodyFatDelta, true),
      color: 'var(--s-fat)',
      deltaLabel: t('stat.fromStart'),
    },
    {
      key: 'fatMass',
      label: t('table.fatMass'),
      value: fmt(stats.currentFatMass),
      unit: 'kg',
      delta: fmtDelta(stats.fatMassDelta),
      tone: deltaTone(stats.fatMassDelta, true),
      color: 'var(--s-fat)',
      deltaLabel: t('stat.fromStart'),
    },
    {
      key: 'streak',
      label: t('stat.bodyStreak'),
      value: String(stats.streak),
      unit: t('stat.days'),
      delta: t('stat.recordRate', { rate: Math.round(stats.recordRate * 100) }),
      tone: 'flat',
      color: null,
      deltaLabel: '',
    },
  ];

  return (
    <div className={s.grid}>
      {tiles.map((tile) => (
        <div key={tile.key} className={s.tile}>
          <div className={s.key}>
            {tile.color && (
              <i className={ui.swatch} style={{ background: tile.color }} aria-hidden="true" />
            )}
            {tile.label}
          </div>
          <div className={s.value}>
            {tile.value}
            <span className={s.unit}>{tile.unit}</span>
          </div>
          {tile.delta && (
            <div className={`${s.delta} ${TONE_CLASS[tile.tone]}`}>
              {tile.deltaLabel && `${tile.deltaLabel} `}
              {tile.delta}
              {tile.deltaLabel && ` ${tile.unit}`}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
