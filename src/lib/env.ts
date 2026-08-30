/**
 * このビルドがデモ環境向けかどうか。
 *
 * デモは「開いてすぐグラフが動いている」ことに価値があるので、作者の実測値を初期データに入れる。
 * 自分の記録として使うビルドに他人の体重が入っていると、消すまで自分の数字が読めない。
 * `vite build --mode demo`（`npm run build:demo` / `npm run deploy`）でだけ立つ。
 */
export const IS_DEMO = import.meta.env.VITE_DEMO === '1';
