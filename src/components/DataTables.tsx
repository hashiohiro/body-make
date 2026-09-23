import { useMemo, useState } from 'react';
import { formatMD, formatMDW } from '../lib/date';
import type { EnergyPoint } from '../lib/energy';
import { fmtDelta } from '../lib/format';
import type { DailyPoint, WeekPoint } from '../types';
import { DataTable } from './DataTable';
import { Button } from './Button';
import ui from '../styles/ui.module.scss';
import { useT } from '../lib/i18n';

function Cell({ value, digits = 1 }: { value: number | null; digits?: number }) {
  if (value == null) return <td className={ui.cellEmpty}>—</td>;
  return <td>{value.toFixed(digits)}</td>;
}

/** チャートの表ビュー版。色だけに頼らず値へ到達できる経路を必ず残すため */
export function WeeklyTable({ weeks }: { weeks: readonly WeekPoint[] }) {
  const t = useT();
  return (
    <DataTable
      summary={t('table.weekly')}
      columns={[
        t('table.week'),
        t('table.period'),
        t('table.avgWeight'),
        t('table.weekDelta'),
        t('common.bodyFat'),
        t('table.weekDelta'),
        t('table.fatMass'),
        t('table.lean'),
        t('table.days'),
      ]}
    >
      {weeks.map((week) => (
        <tr key={week.start}>
          <th scope="row">{week.label}</th>
          <td>
            {formatMD(week.start)}–{formatMD(week.end)}
          </td>
          <Cell value={week.weight} />
          <td className={week.weightDelta == null ? ui.cellEmpty : ''}>
            {fmtDelta(week.weightDelta, 2)}
          </td>
          <Cell value={week.bodyFat} />
          <td className={week.bodyFatDelta == null ? ui.cellEmpty : ''}>
            {fmtDelta(week.bodyFatDelta, 2)}
          </td>
          <Cell value={week.fatMass} />
          <Cell value={week.leanMass} />
          <td>{week.days}</td>
        </tr>
      ))}
    </DataTable>
  );
}

export function EnergyTable({ points }: { points: readonly EnergyPoint[] }) {
  const t = useT();
  const signed = (v: number | null, digits: number) => fmtDelta(v, digits);

  return (
    <DataTable
      summary={t('table.energy')}
      columns={[
        t('table.week'),
        t('table.period'),
        t('energy.weightChange'),
        t('energy.weightBased'),
        t('energy.fatChange'),
        t('energy.fatBasedShort'),
      ]}
    >
      {points.map((point) => (
        <tr key={point.key}>
          <th scope="row">{point.label}</th>
          <td>
            {formatMD(point.from)}–{formatMD(point.to)}
          </td>
          <td>{signed(point.weightDelta, 2)} kg</td>
          <td>
            {signed(point.kcalWeight, 0)} {t('trend.kcalPerDay')}
          </td>
          <td className={point.fatDelta == null ? ui.cellEmpty : ''}>
            {point.fatDelta == null ? '—' : `${signed(point.fatDelta, 2)} kg`}
          </td>
          <td className={point.kcalFat == null ? ui.cellEmpty : ''}>
            {point.kcalFat == null ? '—' : `${signed(point.kcalFat, 0)} ${t('trend.kcalPerDay')}`}
          </td>
        </tr>
      ))}
    </DataTable>
  );
}

/**
 * 日次の元データ。
 *
 * 期間の既定が「全期間」なので、以前は記録のある日をすべて表の行にしていた。
 * `<details>` が閉じていても要素は作られるため、10 年ぶんでは開く前から
 * 3,000 行以上を抱えることになる。**出す量を記録の長さから切り離す。**
 */
const INITIAL_ROWS = 60;
const MORE_ROWS = 180;

/** グラフで見えた値の裏を取る場所。腹囲を出しているなら、ここにも要る */
export function DailyTable({
  daily,
  waist = false,
}: {
  daily: readonly DailyPoint[];
  waist?: boolean;
}) {
  const t = useT();
  const [limit, setLimit] = useState(INITIAL_ROWS);
  const rows = useMemo(() => daily.slice(-limit).reverse(), [daily, limit]);
  const rest = daily.length - rows.length;

  return (
    <DataTable
      summary={t('table.daily')}
      columns={[
        t('table.date'),
        t('table.amWeight'),
        t('table.amBodyFat'),
        ...(waist ? [t('table.amWaist')] : []),
        t('table.pmWeight'),
        t('table.pmBodyFat'),
        ...(waist ? [t('table.pmWaist')] : []),
        t('table.dayAverage'),
        t('table.movingAverage'),
      ]}
      footer={
        /* 古い日は押して伸ばす。全部が最初から要る場面は無い */
        rest > 0 ? (
          <div className={ui.btnRow}>
            <Button tone="ghost" onClick={() => setLimit((n) => n + MORE_ROWS)}>
              {t('table.showMore', { n: Math.min(rest, MORE_ROWS), rest })}
            </Button>
          </div>
        ) : null
      }
    >
      {rows.map((point) => (
        <tr key={point.date}>
          <th scope="row">{formatMDW(t, point.date)}</th>
          <Cell value={point.am.weight} />
          <Cell value={point.am.bodyFat} />
          {waist && <Cell value={point.am.waist} />}
          <Cell value={point.pm.weight} />
          <Cell value={point.pm.bodyFat} />
          {waist && <Cell value={point.pm.waist} />}
          <Cell value={point.weight} />
          <Cell value={point.maWeight} digits={2} />
        </tr>
      ))}
    </DataTable>
  );
}
