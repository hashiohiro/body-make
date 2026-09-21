/**
 * テスト環境の下ごしらえ。
 *
 * 記録の保存先が IndexedDB になったので、jsdom に実装を持たせる。
 * `fake-indexeddb` は devDependency で、配布物には入らない
 * （README の「ランタイムの依存は React だけ」は崩れない）。
 */
import 'fake-indexeddb/auto';

/**
 * `scrollIntoView` を生やす。**jsdom が持っていないだけ**で、実ブラウザには必ずある。
 *
 * レイアウトを持たない環境なので、呼ばれても何もしないのが正しい振る舞い。
 * ここで埋めずにアプリ側を `?.()` で守ると、**本番で消えていても気づけない**
 * 呼び出しになる（チップ行が寄らないのは画面を見るまで分からない）。
 *
 * **環境を見てから足す。**この下ごしらえは全テストに読まれるが、
 * jsdom を指定していないファイル（`src/lib` の純関数）は node で走るので
 * `Element` が無い。持っている環境にだけ、持っていなければ足す。
 */
if (typeof Element !== 'undefined' && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function scrollIntoView() {};
}
