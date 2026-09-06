import { addDays, todayISO } from '../lib/date';
import ui from '../styles/ui.module.scss';
import s from './DateNav.module.scss';

interface Props {
  date: string;
  onChange: (date: string) => void;
}

/**
 * 記録する日を選ぶ。
 *
 * 日付は記録タブ全体の状態で、体組成とトレーニングで同じ日を見続ける。
 * だから置き場所も 1 つでよく、ヘッダに出す（体組成／トレーニングの切り替えと同じ考え方）。
 * 以前は QuickEntry と TrainingView が同じものを別々に持っていて、
 * どちらの入力カードにも同じ 4 部品が載っていた。
 */
export function DateNav({ date, onChange }: Props) {
  const today = todayISO();

  return (
    <div className={s.row}>
      <button
        type="button"
        className={s.nav}
        onClick={() => onChange(addDays(date, -1))}
        aria-label="前の日"
      >
        ‹
      </button>

      <input
        className={s.dateInput}
        type="date"
        value={date}
        /*
          **先の日も選べる。**旅行や大会の前に予定の日へ入れておく、
          日付をまたいだ深夜に翌日ぶんとして付ける、といった使い方がある。
          導出は先の日付を織り込んである（連続記録と記録率は今日までしか数えない）。
        */
        onChange={(e) => e.target.value && onChange(e.target.value)}
        aria-label="記録する日付"
      />

      <button
        type="button"
        className={s.nav}
        onClick={() => onChange(addDays(date, 1))}
        aria-label="次の日"
      >
        ›
      </button>

      {/* 今日を見ているときは押しても何も起きない。無効のまま置かず、消す */}
      {date !== today && (
        <button
          type="button"
          className={`${ui.btn} ${ui.btnSm} ${s.today}`}
          onClick={() => onChange(today)}
        >
          今日
        </button>
      )}
    </div>
  );
}
