import { useState } from 'react';
import { GROUP_LABELS, GROUP_ORDER } from '../../lib/exerciseCatalog';
import { formatSets } from '../../lib/training';
import type { WeekSetCount } from '../../lib/training';
import type { MuscleGroup } from '../../types';
import ui from '../../styles/ui.module.scss';
import s from './training.module.scss';

/** 週が多いと横に潰れるので、直近ぶんだけ出す */
const MAX_WEEKS = 12;

type ValueId = 'sets' | 'volume';

const VALUES: { id: ValueId; label: string; pick: (w: WeekSetCount, g: MuscleGroup) => number }[] = [
  { id: 'sets', label: 'セット数', pick: (w, g) => w.setsByGroup[g] },
  { id: 'volume', label: '挙上量', pick: (w, g) => Math.round(w.volumeByGroup[g]) },
];

interface Props {
  weeks: readonly WeekSetCount[];
}

export function GroupSetsHeatmap({ weeks }: Props) {
  const [valueId, setValueId] = useState<ValueId>('sets');
  const value = VALUES.find((v) => v.id === valueId)!;
  const visible = weeks.slice(-MAX_WEEKS);

  if (visible.length === 0) {
    return (
      <section className={ui.card}>
        <p className={ui.emptyState}>まだトレーニングの記録がありません。</p>
      </section>
    );
  }

  return (
    <section className={ui.card}>
      <header className={ui.cardHeader}>
        <h2 className={ui.cardTitle}>部位別の配分</h2>
        <span className={ui.hint}>週あたり</span>
      </header>

      <div className={ui.chipRow} role="group" aria-label="表示する値">
        {VALUES.map((v) => (
          <button
            key={v.id}
            type="button"
            className={ui.chip}
            aria-pressed={valueId === v.id}
            onClick={() => setValueId(v.id)}
          >
            {v.label}
          </button>
        ))}
      </div>

      <div className={ui.tableScroll}>
        <table className={`${ui.table} ${s.heatmap}`}>
          <thead>
            <tr>
              <th scope="col">部位</th>
              {visible.map((w) => (
                <th key={w.start} scope="col">
                  {w.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {GROUP_ORDER.map((group) => {
              // 濃淡は部位ごとに正規化する。全体で正規化すると、扱う値の小さい腕や肩の行が
              // 常に薄くなり、やっているのにサボって見える。
              // 挙上量を部位間で比べないのもこれと同じ理由（重量の大きい種目に支配される）
              const max = Math.max(...visible.map((w) => value.pick(w, group)), 1);
              return (
                <tr key={group}>
                  <th scope="row">{GROUP_LABELS[group]}</th>
                  {visible.map((w) => {
                    const n = value.pick(w, group);
                    return (
                      <td
                        key={w.start}
                        style={
                          n > 0
                            ? { background: `color-mix(in srgb, var(--s-lean) ${(n / max) * 60}%, transparent)` }
                            : undefined
                        }
                      >
                        {n > 0 ? (
                          valueId === 'sets' ? formatSets(n) : n.toLocaleString()
                        ) : (
                          <span className={ui.cellEmpty}>—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            <tr>
              <th scope="row">実施日数</th>
              {visible.map((w) => (
                <td key={w.start}>{w.days}</td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}
