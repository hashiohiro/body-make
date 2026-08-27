import type { ReactNode } from 'react';
import s from './training.module.scss';

interface Props {
  /** 行までスクロールしたいときに使う */
  id?: string | undefined;
  name: string;
  /** 名前の右に添えるラベル（補助部位など） */
  tag?: string | null;
  /** 目標の値。**必ず「目標」と書いてから出す**（数字だけだと何の数字か読めない） */
  goal?: string | null;
  /** 0〜1 の到達率。null ならメーターを出さない */
  progress?: number | null;
  /** その画面が持つ事実。左が主、右が従 */
  factLeft: ReactNode;
  factRight: ReactNode;
  /** 下に並べる入口。画面ごとに違うのはここだけ */
  actions: ReactNode;
  /** 開いたときのフォーム（目標の編集・種目の詳細設定） */
  children?: ReactNode;
}

/**
 * 種目 1 件のカード。**マイ種目（設定）と種目の目標（目標タブ）で同じものを使う。**
 *
 * 同じ種目を 2 つの画面で見るのに、違う形で出す理由がない。
 * 並びは 名前 → 事実 → 入口 で固定し、画面ごとに変わるのは中身だけ。
 *
 *   マイ種目 … 記録の量と、負荷の数え方
 *   目標     … いまの値と、目標への到達率
 */
export function ExerciseSummaryCard({
  id,
  name,
  tag,
  goal,
  progress = null,
  factLeft,
  factRight,
  actions,
  children,
}: Props) {
  return (
    <div className={s.itemCard} id={id}>
      <div className={s.statRow}>
        <span className={s.exName}>{name}</span>
        {tag && <span className={s.exTag}>{tag}</span>}
        {goal && <span className={s.goalTag}>目標 {goal}</span>}
      </div>

      {progress != null && (
        <div className={s.meter}>
          <div className={s.meterFill} style={{ width: `${progress * 100}%` }} />
        </div>
      )}

      <div className={s.goalFoot}>
        <span>{factLeft}</span>
        <span>{factRight}</span>
      </div>

      <div className={s.itemActions}>{actions}</div>

      {children}
    </div>
  );
}
