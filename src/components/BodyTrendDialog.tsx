import { Modal } from './Modal';
import { BodyTrendCharts } from './charts/BodyTrendCharts';
import { isoToTime } from '../lib/date';
import type { DailyPoint, Settings } from '../types';

interface Props {
  open: boolean;
  onClose: () => void;
  daily: readonly DailyPoint[];
  settings: Settings;
  /** 開いている日。折れ線のその日に印を付ける */
  date: string;
}

/**
 * 体重と体脂肪率の推移。記録の側から開く。
 *
 * **期間で絞らない。**記録から開いたときは過去ぜんぶを見せる
 * （種目の推移を記録画面から開くときと同じ作法）。絞りたいときは推移画面へ行く。
 *
 * 中身は推移画面と同じ `BodyTrendCharts`。同じグラフを 2 通りに組まない。
 */
export function BodyTrendDialog({ open, onClose, daily, settings, date }: Props) {
  return (
    <Modal open={open} title="体組成の推移" onClose={onClose}>
      <BodyTrendCharts daily={daily} settings={settings} highlight={isoToTime(date)} />
    </Modal>
  );
}
