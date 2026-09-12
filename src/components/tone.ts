import type { DeltaTone } from '../lib/format';
import ui from '../styles/ui.module.scss';

/**
 * 増減の色。**良い / 悪い / 横ばいの 3 つだけ。**
 *
 * 同じ 1 行が 5 ファイルに写してあった（ヒーロー・タイル・種目の通算・
 * 推移の一覧・種目の詳細）。色の割り当てが面ごとにずれる余地を残す意味が無い。
 *
 * **どちらが良いかは値では決まらない**（体重の −1kg は減量なら良く、増量なら悪い）。
 * その判断は `deltaTone()` が持っていて、ここは判断を色に置き換えるだけ。
 */
export const TONE_CLASS = {
  good: ui.good,
  bad: ui.bad,
  flat: ui.flat,
} as const satisfies Record<DeltaTone, string | undefined>;
