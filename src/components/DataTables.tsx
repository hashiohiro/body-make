import { useMemo, useState } from 'react';
import { formatMD, formatMDW } from '../lib/date';
import type { EnergyPoint } from '../lib/energy';
import { fmtDelta } from '../lib/format';
import type { DailyPoint, WeekPoint } from '../types';
import { DataTable } from './DataTable';
import { Button } from './Button';
import ui from '../styles/ui.module.scss';

function Cell({ value, digits = 1 }: { value: number | null; digits?: number }) {
  if (value == null) return <td className={ui.cellEmpty}>—</td>;
  return <td>{value.toFixed(digits)}</td>;
}

/** チャートの表ビュー版。色だけに頼らず値へ到達できる経路を必ず残すため */
export function WeeklyTable({ weeks }: { weeks: readonly WeekPoint[] }) {
  return (
    <DataTable
      summary="週次サマリを表で見る"
      columns={[
        '週',
        '期間',
        '平均体重',
        '前週差',
        '体脂肪率',
        '前週差',
        '体脂肪量',
        '除脂肪',
        '日数',
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
  const signed = (v: number | null, digits: number) => fmtDelta(v, digits);

  return (
    <DataTable
      summary="推定カロリー収支を表で見る"
      columns={['週', '期間', '体重変化', '体重ベース', '体脂肪量変化', '体脂肪量ベース']}
    >
      {points.map((point) => (
        <tr key={point.key}>
          <th scope="row">{point.label}</th>
          <td>
            {formatMD(point.from)}–{formatMD(point.to)}
          </td>
          <td>{signed(point.weightDelta, 2)} kg</td>
          <td>{signed(point.kcalWeight, 0)} kcal/日</td>
          <td className={point.fatDelta == null ? ui.cellEmpty : ''}>
            {point.fatDelta == null ? '—' : `${signed(point.fatDelta, 2)} kg`}
          </td>
          <td className={point.kcalFat == null ? ui.cellEmpty : ''}>
            {point.kcalFat == null ? '—' : `${signed(point.kcalFat, 0)} kcal/日`}
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

export function DailyTable({ daily }: { daily: readonly DailyPoint[] }) {
  const [limit, setLimit] = useState(INITIAL_ROWS);
  const rows = useMemo(() => daily.slice(-limit).reverse(), [daily, limit]);
  const rest = daily.length - rows.length;

  return (
    <DataTable
      summary="日次データを表で見る"
      columns={['日付', '朝 体重', '朝 体脂肪', '夜 体重', '夜 体脂肪', '日平均', '7日平均']}
      footer={
        /* 古い日は押して伸ばす。全部が最初から要る場面は無い */
        rest > 0 ? (
          <div className={ui.btnRow}>
            <Button tone="ghost" onClick={() => setLimit((n) => n + MORE_ROWS)}>
              さらに{Math.min(rest, MORE_ROWS)}日ぶん見る（残り {rest}日）
            </Button>
          </div>
        ) : null
      }
    >
      {rows.map((point) => (
        <tr key={point.date}>
          <th scope="row">{formatMDW(point.date)}</th>
          <Cell value={point.am.weight} />
          <Cell value={point.am.bodyFat} />
          <Cell value={point.pm.weight} />
          <Cell value={point.pm.bodyFat} />
          <Cell value={point.weight} />
          <Cell value={point.maWeight} digits={2} />
        </tr>
      ))}
    </DataTable>
  );
}
