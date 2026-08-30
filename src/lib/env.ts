/**
 * このビルドがデモ環境向けかどうか。
 *
 * デモは「開いてすぐグラフが動いている」ことに価値があるので、作者の実測値を初期データに入れる。
 * 自分の記録として使うビルドに他人の体重が入っていると、消すまで自分の数字が読めない。
 * `vite build --mode demo`（`npm run build:demo` / `npm run deploy:demo`）でだけ立つ。
 *
 * デモでは初期データを入れるほかに、開くたびに初期データへ戻し（components/DemoNotice.tsx）、
 * 「今日」を記録の最終日で止める（lib/date.ts）。放っておくと日が経つほど画面が古びていくため。
 */
export const IS_DEMO = import.meta.env.VITE_DEMO === '1';
