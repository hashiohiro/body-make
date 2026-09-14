import { Modal } from './Modal';
import { BodyTrend } from './charts/BodyTrend';
import { isoToTime } from '../lib/date';
import type { DailyPoint, Settings, WeekPoint } from '../types';

interface Props {
  open: boolean;
  onClose: () => void;
  daily: readonly DailyPoint[];
  weeks: readonly WeekPoint[];
  settings: Settings;
  /** 開いている日。折れ線のその日に印を付ける */
  date: string;
}

/**
 * 体組成の推移。記録の側から開く。
 *
 * **期間で絞らない。**記録から開いたときは過去ぜんぶを見せる
 * （種目の推移を記録画面から開くときと同じ作法）。絞りたいときは推移画面へ行く。
 *
 * 中身は推移画面と同じ `BodyTrend` ひとそろい——体重と腹囲・体脂肪率・週平均の体組成・
 * 推定カロリー収支・元データ。**同じ名前の面に、開き方で違うものを出さない。**
 */
export function BodyTrendDialog({ open, onClose, daily, weeks, settings, date }: Props) {
  return (
    <Modal open={open} title="体組成の推移" onClose={onClose}>
      <BodyTrend daily={daily} weeks={weeks} settings={settings} highlight={isoToTime(date)} />
    </Modal>
  );
}
