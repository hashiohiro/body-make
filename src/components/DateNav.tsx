import { DateField } from './DateField';
import { addDays } from '../lib/date';
import { Button } from './Button';
import s from './DateNav.module.scss';

interface Props {
  date: string;
  /**
   * いまの日付。**渡された値を使う**（自分では読まない）。
   *
   * 描画のたびに `todayISO()` を呼んでも、再描画が起きなければ値は変わらない。
   * PWA は閉じずに背面へ回るので、日が変わったことに気づけるのは
   * 前面に戻ったときに読み直している側（`hooks/useToday`）だけ。
   * その値をそのまま受け取ることで、「今日」ボタンの出方をそこに一致させる。
   */
  today: string;
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
export function DateNav({ date, today, onChange }: Props) {
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

      {/*
        **先の日も選べる。**旅行や大会の前に予定の日へ入れておく、
        日付をまたいだ深夜に翌日ぶんとして付ける、といった使い方がある。
        導出は先の日付を織り込んである（連続記録と記録率は今日までしか数えない）。

        空にはできない。見ている日が無い状態は作れない。
      */}
      <DateField className={s.dateInput} value={date} label="記録する日付" onChange={onChange} />

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
        <Button size="sub" onClick={() => onChange(today)} className={s.today}>
          今日
        </Button>
      )}
    </div>
  );
}
