import { formatMD, formatMDW } from '../lib/date';
import type { EnergyPoint } from '../lib/energy';
import { fmtDelta } from '../lib/format';
import type { DailyPoint, WeekPoint } from '../types';
import ui from '../styles/ui.module.scss';

function Cell({ value, digits = 1 }: { value: number | null; digits?: number }) {
  if (value == null) return <td className={ui.cellEmpty}>—</td>;
  return <td>{value.toFixed(digits)}</td>;
}

/** チャートの表ビュー版。色だけに頼らず値へ到達できる経路を必ず残すため */
export function WeeklyTable({ weeks }: { weeks: readonly WeekPoint[] }) {
  return (
    <details className={ui.tableView}>
      <summary>週次サマリを表で見る</summary>
      <div className={ui.tableScroll}>
        <table className={ui.table}>
          <thead>
            <tr>
              <th scope="col">週</th>
              <th scope="col">期間</th>
              <th scope="col">平均体重</th>
              <th scope="col">前週差</th>
              <th scope="col">体脂肪率</th>
              <th scope="col">前週差</th>
              <th scope="col">体脂肪量</th>
              <th scope="col">除脂肪</th>
              <th scope="col">日数</th>
            </tr>
          </thead>
          <tbody>
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
          </tbody>
        </table>
      </div>
    </details>
  );
}

export function EnergyTable({ points }: { points: readonly EnergyPoint[] }) {
  const signed = (v: number | null, digits: number) =>
    v == null ? '—' : `${v > 0 ? '+' : v < 0 ? '−' : '±'}${Math.abs(v).toFixed(digits)}`;

  return (
    <details className={ui.tableView}>
      <summary>推定カロリー収支を表で見る</summary>
      <div className={ui.tableScroll}>
        <table className={ui.table}>
          <thead>
            <tr>
              <th scope="col">週</th>
              <th scope="col">期間</th>
              <th scope="col">体重変化</th>
              <th scope="col">体重ベース</th>
              <th scope="col">体脂肪量変化</th>
              <th scope="col">体脂肪量ベース</th>
            </tr>
          </thead>
          <tbody>
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
          </tbody>
        </table>
      </div>
    </details>
  );
}

export function DailyTable({ daily }: { daily: readonly DailyPoint[] }) {
  const rows = [...daily].reverse();

  return (
    <details className={ui.tableView}>
      <summary>日次データを表で見る</summary>
      <div className={ui.tableScroll}>
        <table className={ui.table}>
          <thead>
            <tr>
              <th scope="col">日付</th>
              <th scope="col">朝 体重</th>
              <th scope="col">朝 体脂肪</th>
              <th scope="col">夜 体重</th>
              <th scope="col">夜 体脂肪</th>
              <th scope="col">日平均</th>
              <th scope="col">7日平均</th>
            </tr>
          </thead>
          <tbody>
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
          </tbody>
        </table>
      </div>
    </details>
  );
}
