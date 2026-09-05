/**
 * テスト環境の下ごしらえ。
 *
 * 記録の保存先が IndexedDB になったので、jsdom に実装を持たせる。
 * `fake-indexeddb` は devDependency で、配布物には入らない
 * （README の「ランタイムの依存は React だけ」は崩れない）。
 */
import 'fake-indexeddb/auto';
