import type { ReactNode } from 'react';
import { Tag } from '../Tag';
import s from './training.module.scss';

interface Props {
  /** 行までスクロールしたいときに使う */
  id?: string | undefined;
  name: string;
  /** 名前の右に添えるラベル（補助部位など） */
  tag?: string | null;
  /** 目標の立て方（維持 / 重量↑ / 挙上量↑ / 回数↑）。一覧で一目で分かるように */
  kind?: string | null;
  /** 目標の値。**必ず「目標」と書いてから出す**（数字だけだと何の数字か読めない） */
  goal?: string | null;
  /** その画面が持つ事実（記録日数など） */
  factLeft: ReactNode;
  /**
   * 右端に振る事実（到達率など）。**器は左右に振り分ける作り**なので、
   * 渡さなければ左の事実だけが出る。
   */
  factRight?: ReactNode;
  /** 事実と入口のあいだに挟む図（到達のバーなど）。持たない画面では出ない */
  meter?: ReactNode;
  /** 下に並べる入口。画面ごとに違うのはここだけ */
  actions: ReactNode;
  /** 開いたときのフォーム（目標の編集・種目の詳細設定） */
  children?: ReactNode;
}

/**
 * 一覧の 1 件ぶん。**設定の一覧はすべてこれで出す。**
 *
 * 同じものを 2 つの画面で見るのに、違う形で出す理由がない。
 * 並びは 名前 → 事実 → 入口 で固定し、画面ごとに変わるのは中身だけ。
 *
 *   マイ種目     … 記録の量
 *   種目の目標   … いまの値と、目標への到達率
 *   プリセット   … 何種目あるかと、どの部位に効くか
 *
 * **入口はボタンで出す。**行ぜんたいを押させない——同じ行に「開く」「伏せる」
 * 「消す」が要るので、押す場所で結果が変わる面にすると、何が起きるか読めない。
 */
export function ExerciseSummaryCard({
  id,
  name,
  tag,
  kind,
  goal,
  factLeft,
  factRight,
  meter,
  actions,
  children,
}: Props) {
  return (
    <div className={s.itemCard} id={id}>
      <div className={s.statRow}>
        <span className={s.exName}>{name}</span>
        {tag && <Tag>{tag}</Tag>}
        {kind && <Tag kind="chosen">{kind}</Tag>}
        {goal && <Tag kind="chosen">目標 {goal}</Tag>}
      </div>

      <div className={s.goalFoot}>
        <span>{factLeft}</span>
        {factRight != null && <span>{factRight}</span>}
      </div>

      {meter}

      <div className={s.itemActions}>{actions}</div>

      {children}
    </div>
  );
}
