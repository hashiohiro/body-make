import type { ReactNode } from 'react';
import ui from '../styles/ui.module.scss';

interface Props {
  /**
   * 畳んだときの文言。「〜を表で見る」で統一する。
   * 省略すると畳まず、表だけを置く（ダイアログの中など、それ自体が目的の面）。
   */
  summary?: string | undefined;
  /** 列の見出し。数と並びは本文の `<td>` と合わせる */
  columns: readonly string[];
  children: ReactNode;
  /** 表の下に置くもの（古い行を伸ばす的など） */
  footer?: ReactNode;
}

/**
 * グラフに併設する元データの表。**表はすべてこれ。**
 *
 * 同じ器（畳む `<details>` → 横スクロール → `<table>` → `scope` 付きの `<thead>`）が
 * 4 か所に写してあった。列と行だけが違うのに、`scope="col"` の付け忘れや
 * 横スクロールの器の抜けが、写すたびに起こりうる。
 *
 * **畳んで置く。**色だけに頼らず値へ到達できる経路を必ず残すためのものだが、
 * ふだん読むのはグラフのほうなので、開いていると本題が下へ流れる。
 *
 * 横スクロールは器の中だけで起こす。表が画面幅を超えても、地のほうは動かさない。
 */
export function DataTable({ summary, columns, children, footer }: Props) {
  const table = (
    <>
      <div className={ui.tableScroll}>
        <table className={ui.table}>
          <thead>
            <tr>
              {columns.map((c, i) => (
                // 同じ見出しが 2 回出る表がある（前週差 ×2）ので、位置も鍵に混ぜる
                <th key={`${c}-${i}`} scope="col">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>
      {footer}
    </>
  );

  if (summary == null) return table;
  return (
    <details className={ui.tableView}>
      <summary>{summary}</summary>
      {table}
    </details>
  );
}
