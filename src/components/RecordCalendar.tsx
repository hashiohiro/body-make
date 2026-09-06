import { useMemo, useState } from 'react';
import { addDays, formatMD, formatMDW, fromISO, startOfWeek, todayISO, toISO } from '../lib/date';
import ui from '../styles/ui.module.scss';
import s from './RecordCalendar.module.scss';

interface Props {
  /** 記録のある日 */
  marked: ReadonlySet<string>;
  /**
   * 印を塗りつぶす日（●）。塗らない日は中抜き（○）。
   *
   * 体組成では朝夜そろった日に使う。付けるだけだと、
   * 片方しか計らなかった日との区別が付かなくなる。
   */
  filled?: ReadonlySet<string> | undefined;
  /** いま開いている日。押した日に移るので、どこにいるかを出す */
  selected: string;
  /** 見出しの右に添える一行。中身は呼び出し側が決める */
  summary: string;
  /** いちばん古い記録。それより前へは戻さない */
  firstDate: string | null;
  onSelect: (date: string) => void;
}

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

/**
 * 表示する範囲。
 *
 * **既定は 2 週。**記録画面の先頭に置くので、開いているぶんだけ入力欄が下がる。
 * それでも 1 週にしないのは、週が暦で区切られているため——日曜に開くと
 * 過去が 1 日も映らない。2 週なら、週のどこで開いても直前の記録が入る。
 */
const RANGES = [
  { id: 'week', label: '1週', weeks: 1 },
  { id: 'two', label: '2週', weeks: 2 },
  { id: 'month', label: '月', weeks: 0 },
] as const;

type RangeId = (typeof RANGES)[number]['id'];

function daysInMonth(month: string): number {
  const d = fromISO(`${month}-01`);
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

function shiftMonth(iso: string, by: number): string {
  const d = fromISO(iso);
  d.setMonth(d.getMonth() + by);
  return toISO(d);
}

/**
 * 記録した日のカレンダー。**記録画面の先頭に置く。**
 *
 * 打つ前に「前はいつ付けたか」を見て、そのまま日付を選べる。
 * 押した日に移るので、ヘッダの日付ナビと同じ働きをする——
 * あちらが 1 日ずつ、こちらが面で選ぶ。
 *
 * **体組成とトレーニングは別々に出す。**1 つの面に 2 つの軸が乗ると、
 * どちらの話をしているのか読むたびに切り替わる。ヘッダの切り替えに従わせる。
 *
 * **まるは日そのもの（今日は線、開いている日は塗り）、数字の下の小さな印が記録。**
 * まるの大きさは 2 つとも同じにする——大きさで意味を分けると、
 * どちらが「いま見ている日」でどちらが「今日」なのか読み替えが要る。
 * 記録の有無を同じまるの濃さ違いにしないのも同じ理由で、
 * それをやると「今日はまだ付けていない」が読み取れない。
 */
export function RecordCalendar({ marked, filled, selected, summary, firstDate, onSelect }: Props) {
  const today = todayISO();
  const [rangeId, setRangeId] = useState<RangeId>('two');
  /** 表示の起点。押した日ではなく、めくった位置を持つ */
  const [anchor, setAnchor] = useState(today);

  const range = RANGES.find((r) => r.id === rangeId)!;

  const { cells, label, back, next } = useMemo(() => {
    if (range.weeks === 0) {
      const month = anchor.slice(0, 7);
      const first = `${month}-01`;
      const start = startOfWeek(first);
      const last = `${month}-${String(daysInMonth(month)).padStart(2, '0')}`;
      const out: string[] = [];
      for (let iso = start; iso <= last || out.length % 7 !== 0; iso = addDays(iso, 1)) {
        out.push(iso);
      }
      const [y, m] = month.split('-');
      return {
        cells: out,
        label: `${y}年${Number(m)}月`,
        back: shiftMonth(anchor, -1),
        next: shiftMonth(anchor, 1),
      };
    }
    // 週表示は「アンカーの週」で終わる並び。直前の記録が右下に来る
    const end = startOfWeek(anchor);
    const start = addDays(end, -7 * (range.weeks - 1));
    const out: string[] = [];
    for (let i = 0; i < range.weeks * 7; i++) out.push(addDays(start, i));
    return {
      cells: out,
      label: `${formatMD(out[0]!)} 〜 ${formatMD(out[out.length - 1]!)}`,
      back: addDays(anchor, -7 * range.weeks),
      next: addDays(anchor, 7 * range.weeks),
    };
  }, [anchor, range]);

  /*
   * 記録より前へは戻さない。**先へは進める。**
   * 予定の日に付けておく使い方があるので、未来を締め出さない
   * （導出は先の日付を織り込んである）。
   */
  const canBack = firstDate == null || cells[0]! > firstDate;
  const month = range.weeks === 0 ? anchor.slice(0, 7) : null;

  return (
    <section className={ui.card}>
      <header className={ui.cardHeader}>
        <h2 className={ui.cardTitle}>記録の継続</h2>
        <span className={ui.hint}>{summary}</span>
      </header>

      <div className={ui.chipRow} role="group" aria-label="表示する範囲">
        {RANGES.map((r) => (
          <button
            key={r.id}
            type="button"
            className={ui.chip}
            aria-pressed={rangeId === r.id}
            onClick={() => {
              setRangeId(r.id);
              // 範囲を変えたら、いま見ている日が入る位置に戻す
              setAnchor(selected > today ? today : selected);
            }}
          >
            {r.label}
          </button>
        ))}
      </div>

      <div className={s.nav}>
        <button
          type="button"
          className={s.navBtn}
          onClick={() => setAnchor(back)}
          disabled={!canBack}
          aria-label="前へ"
        >
          ‹
        </button>
        <span className={s.month} aria-live="polite">
          {label}
        </span>
        <button
          type="button"
          className={s.navBtn}
          onClick={() => setAnchor(next)}
          aria-label="次へ"
        >
          ›
        </button>
      </div>

      <div className={s.week} aria-hidden="true">
        {WEEKDAYS.map((w) => (
          <span key={w} className={s.weekday}>
            {w}
          </span>
        ))}
      </div>

      <div className={s.grid} role="grid">
        {cells.map((iso) => {
          const outside = month != null && iso.slice(0, 7) !== month;
          const has = marked.has(iso);
          return (
            <button
              key={iso}
              type="button"
              role="gridcell"
              className={[
                s.day,
                outside ? s.outside : '',
                iso === today ? s.today : '',
                iso === selected ? s.selected : '',
              ]
                .filter(Boolean)
                .join(' ')}
              aria-current={iso === selected}
              aria-label={`${formatMDW(iso)}${iso === today ? ' 今日' : ''}${has ? ' 記録あり' : ''}`}
              onClick={() => onSelect(iso)}
            >
              <span className={s.num}>{Number(iso.slice(8))}</span>
              {has && (
                <i
                  className={`${s.mark} ${filled?.has(iso) ? s.markFull : ''}`}
                  aria-hidden="true"
                  data-mark={filled?.has(iso) ? 'full' : 'half'}
                />
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}
